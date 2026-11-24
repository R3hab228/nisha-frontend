// ==========================================
// NISHA CATALOG — REALTIME, BROADCAST CHANNEL И КЭШ-ХЕЛПЕРЫ
// ==========================================

import { getCatalogStore, getSupabaseClient } from './catalog-state.js';
import { updateCardDOM, insertNewItemCardSmoothly } from './catalog-grid.js';
import { isItemBargainEnabled } from './catalog-card-markup.js';
import { applyFilters, updateSidebarCounters } from './catalog-filters.js';
import { hasAction, invokeAction } from '../core/action-registry.js';
import { getRuntimeOpenedItem, tSafe } from '../core/runtime-env.js';

/**
 * Уведомляет пользователя о смене статуса/цены/скидки товара.
 * @param {object} item
 * @param {string} oldStatus
 * @param {number} oldPrice
 * @param {boolean} oldIsSale
 */
export function notifyItemStatusTransition(item, oldStatus, oldPrice, oldIsSale) {
    if (hasAction('showSaleToast') || typeof showToast === 'function') {
        const numOldPrice = Number(oldPrice) || 0;
        const numNewPrice = Number(item.price) || 0;
        if ((!oldIsSale && item.is_sale) || (numOldPrice > 0 && numNewPrice > 0 && numOldPrice > numNewPrice)) {
            if (item.status === 'available') {
                if (hasAction('showSaleToast')) {
                    invokeAction('showSaleToast', item);
                } else {
                    const salePref = tSafe('messages.sale_prefix', '🔥 СКИДКА: ');
                    showToast(`${salePref}${item.name}`, 'success');
                }
            }
        }
        if (oldStatus !== 'sold' && item.status === 'sold') {
            removeSoldItemFromCart(item.id, item.name);
        } else if (oldStatus === 'reserved' && item.status === 'available') {
            const expPref = tSafe('messages.reservation_expired', 'Бронь истекла: ');
            const backInStock = tSafe('messages.back_in_stock', ' снова в наличии!');
            showToast(`${expPref}${item.name}${backInStock}`, 'info');
        }
    }
}

/**
 * Безопасное сохранение каталога в IndexedDB с fallback в localStorage.
 * @param {any[]} items
 * @returns {Promise<void>}
 */
export async function safelySaveCatalogToStorage(items) {
    if (!items || !Array.isArray(items) || items.length === 0) return;

    // 1. Первичное и надежное сохранение в IndexedDB
    if (hasAction('idbSet')) {
        try {
            const saved = await invokeAction('idbSet', 'nisha_cached_db', items);
            if (saved) {
                if (window.storage) window.storage.remove('nisha_cached_db');
                return;
            }
        } catch (idbErr) {
            console.warn('[КАТАЛОГ] Ошибка сохранения в IndexedDB, используем storage:', idbErr);
        }
    }

    // 2. Fallback для приватного режима или неподдерживающих браузеров
    try {
        if (window.storage) window.storage.setJSON('nisha_cached_db', items);
    } catch (e) {
        console.warn('[КАТАЛОГ] Лимит storage превышен, пробуем компактное сохранение:', e);
        try {
            const slim = items.map(item => {
                if (!item.description || item.description.length <= 200) return item;
                const truncated = hasAction('safeTruncateText')
                    ? invokeAction('safeTruncateText', item.description, 200)
                    : item.description.slice(0, 200);
                return { ...item, description: truncated };
            });
            if (window.storage) window.storage.setJSON('nisha_cached_db', slim);
        } catch (slimErr) {
            console.warn('[КАТАЛОГ] Не удалось закэшировать каталог в storage:', slimErr);
        }
    }
}

/**
 * Удаляет проданный/удалённый товар из корзины пользователя и показывает уведомление.
 * @param {string|number} itemId
 * @param {string} [itemName]
 */
export function removeSoldItemFromCart(itemId, itemName) {
    const currentCart = hasAction('getActiveCart')
        ? invokeAction('getActiveCart')
        : ((typeof getActiveCart === 'function') ? getActiveCart() : (window.cart || []));
    const cartIdx = currentCart.findIndex(c => c && String(c.id) === String(itemId));
    if (cartIdx !== -1) {
        currentCart.splice(cartIdx, 1);
        if (hasAction('setActiveCart')) {
            invokeAction('setActiveCart', currentCart);
        } else if (typeof setActiveCart === 'function') {
            setActiveCart(currentCart);
        } else {
            const store = getCatalogStore();
            if (store) store.setJSON('nisha_cart', currentCart);
            window.cart = currentCart;
        }
        if (typeof syncCartToServer === 'function') syncCartToServer();
        if (typeof updateCartUI === 'function') updateCartUI();
        if (typeof showToast === 'function') {
            const itemSoldRemovedMsg = tSafe(
                'messages.item_sold_removed',
                `Товар ${itemName || ''} уже купили, он удален из корзины.`,
                { name: itemName || '' }
            );
            showToast(itemSoldRemovedMsg, 'error');
        }
    }
}

// КРОСС-ВКЛАДОЧНЫЙ BROADCAST CHANNEL (МГНОВЕННАЯ СИНХРОНИЗАЦИЯ МЕЖДУ ВКЛАДКАМИ БРАУЗЕРА)
let _catalogBroadcastChannel = null;
let _nishaCatalogBcInit = false;
if (typeof BroadcastChannel !== 'undefined' && typeof window !== 'undefined' && !_nishaCatalogBcInit) {
    _nishaCatalogBcInit = true;
    try {
        _catalogBroadcastChannel = new BroadcastChannel('nisha_catalog_sync');
        _catalogBroadcastChannel.onmessage = (event) => {
            const msg = event && event.data;
            if (!msg || !msg.type) return;
            if (msg.type === 'ITEM_UPSERT' && msg.item) {
                handleRealtimeCatalogEvent({ eventType: 'UPDATE', new: msg.item }, true);
            } else if (msg.type === 'ITEM_DELETE' && msg.id) {
                handleRealtimeCatalogEvent({ eventType: 'DELETE', old: { id: msg.id } }, true);
            }
        };
    } catch {
        _catalogBroadcastChannel = null;
    }
}

/**
 * Удаляет карточки товаров без перерисовки всей сетки и без резкого скачка скролла.
 * Сохраняет позицию первого видимого surviving-элемента вьюпорта через scrollBy-компенсацию
 * и при наличии View Transitions API плавно перестраивает соседние карточки.
 * @param {Array<string|number>} deletedIds
 */
export function removeCatalogCardsWithoutJerk(deletedIds) {
    if (!Array.isArray(deletedIds) || deletedIds.length === 0 || typeof document === 'undefined') return;

    const deletedIdSet = new Set(deletedIds.map(id => String(id)));
    const grid = document.getElementById('itemsGrid');
    let anchorCard = null;
    let anchorTopBefore = 0;
    let removedPrimaryCount = 0;

    if (grid && typeof grid.querySelectorAll === 'function') {
        const viewportH = typeof window !== 'undefined' && typeof window.innerHeight === 'number' ? window.innerHeight : 900;
        const gridCards = Array.from(grid.querySelectorAll('.item-card'));
        for (let i = 0; i < gridCards.length; i++) {
            const card = gridCards[i];
            const cardId = String(card?.dataset?.id ?? card?.getAttribute?.('data-id') ?? '');
            if (deletedIdSet.has(cardId)) {
                removedPrimaryCount++;
                continue;
            }
            if (!anchorCard && typeof card.getBoundingClientRect === 'function') {
                const rect = card.getBoundingClientRect();
                if (rect && rect.bottom > 0 && rect.top < viewportH) {
                    anchorCard = card;
                    anchorTopBefore = rect.top;
                }
            }
        }
    }

    const performDomRemoval = () => {
        deletedIds.forEach(delId => {
            document.querySelectorAll(`.item-card[data-id="${delId}"]`).forEach(card => {
                if (typeof card.remove === 'function') card.remove();
            });
        });

        if (typeof window !== 'undefined') {
            if (typeof window.renderedCount === 'number' && removedPrimaryCount > 0) {
                window.renderedCount = Math.max(0, window.renderedCount - removedPrimaryCount);
            }
            if (anchorCard && anchorCard.isConnected !== false && typeof anchorCard.getBoundingClientRect === 'function' && typeof window.scrollBy === 'function') {
                const afterRect = anchorCard.getBoundingClientRect();
                if (afterRect && typeof afterRect.top === 'number') {
                    const deltaY = afterRect.top - anchorTopBefore;
                    if (Math.abs(deltaY) >= 1) {
                        window.scrollBy(0, deltaY);
                    }
                }
            }
        }
    };

    if (typeof safeViewTransition === 'function') {
        safeViewTransition(performDomRemoval);
    } else if (hasAction('safeViewTransition')) {
        invokeAction('safeViewTransition', performDomRemoval);
    } else {
        performDomRemoval();
    }
}

/**
 * Обрабатывает Realtime-события Supabase (INSERT / UPDATE / DELETE) без перезагрузки страницы.
 * @param {object} payload
 * @param {boolean} [fromBroadcast=false]
 */
export function handleRealtimeCatalogEvent(payload, fromBroadcast = false) {
    if (!payload) return;
    const eventType = payload.eventType || payload.type;
    if (!Array.isArray(window.allItems)) window.allItems = [];

    if (eventType === 'DELETE') {
        const delId = payload.old && payload.old.id;
        if (!delId) return;
        const existed = window.allItems.some(i => String(i.id) === String(delId));
        if (!existed) return;

        window.allItems = window.allItems.filter(i => String(i.id) !== String(delId));
        if (Array.isArray(window.filteredItems)) {
            window.filteredItems = window.filteredItems.filter(i => String(i.id) !== String(delId));
        }

        removeCatalogCardsWithoutJerk([delId]);
        removeSoldItemFromCart(delId);

        const countEl = document.getElementById('itemCount');
        if (countEl && Array.isArray(window.filteredItems)) {
            countEl.textContent = window.filteredItems.length;
        }

        const activeModal = getRuntimeOpenedItem();
        if (activeModal && String(activeModal.id) === String(delId) && typeof closeModal === 'function') {
            closeModal('productModal');
        }

        updateSidebarCounters();
        if (typeof renderHistory === 'function') renderHistory();
        if (hasAction('invalidateFuseCache')) invokeAction('invalidateFuseCache');
        const searchWorker = invokeAction('getSearchWorker');
        if (searchWorker && typeof searchWorker.setItems === 'function') {
            searchWorker.setItems(window.allItems);
        }
        safelySaveCatalogToStorage(window.allItems);
        if (Array.isArray(window.filteredItems) && window.filteredItems.length === 0) {
            applyFilters(true, true);
        }

        if (!fromBroadcast && _catalogBroadcastChannel) {
            try { _catalogBroadcastChannel.postMessage({ type: 'ITEM_DELETE', id: delId }); } catch {}
        }
        return;
    }

    const fresh = payload.new;
    if (!fresh || !fresh.id) return;

    const existingIdx = window.allItems.findIndex(i => i && String(i.id) === String(fresh.id));

    if (eventType === 'INSERT' || existingIdx === -1) {
        window._notifiedItemIds = window._notifiedItemIds || new Set();
        const isNewUnseen = !window._notifiedItemIds.has(fresh.id);
        if (isNewUnseen) {
            window._notifiedItemIds.add(fresh.id);
        }

        if (existingIdx !== -1) {
            window.allItems[existingIdx] = fresh;
        } else {
            window.allItems.unshift(fresh);
        }
        const sortDateDesc = (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
        window.allItems = hasAction('toSorted')
            ? invokeAction('toSorted', window.allItems, sortDateDesc)
            : (window.allItems.toSorted ? window.allItems.toSorted(sortDateDesc) : [...window.allItems].sort(sortDateDesc));

        if (!fromBroadcast && isNewUnseen) {
            if (typeof enqueueNewItemToast === 'function') {
                enqueueNewItemToast(fresh);
            } else if (typeof showToast === 'function') {
                showToast(tSafe('messages.new_items_toast', 'Новые Вещи!!!'), 'success');
            }
        }

        insertNewItemCardSmoothly(fresh);
        updateSidebarCounters();
        if (hasAction('invalidateFuseCache')) invokeAction('invalidateFuseCache');
        safelySaveCatalogToStorage(window.allItems);

        if (!fromBroadcast && _catalogBroadcastChannel) {
            try { _catalogBroadcastChannel.postMessage({ type: 'ITEM_UPSERT', item: fresh }); } catch {}
        }
        return;
    }

    // UPDATE существующего товара
    const item = window.allItems[existingIdx];
    const nowTs = Date.now();
    const wasTop = item.is_top === true && item.top_until && Date.parse(item.top_until) > nowTs;
    const nowTop = fresh.is_top === true && fresh.top_until && Date.parse(fresh.top_until) > nowTs;
    const topChanged = wasTop !== nowTop || item.top_until !== fresh.top_until || !!item.is_top !== !!fresh.is_top;

    const oldStatus = item.status;
    const oldPrice = item.price;
    const oldIsSale = item.is_sale;

    const statusChanged = item.status !== fresh.status;
    const saleChanged = (!!item.is_sale !== !!fresh.is_sale) || (item.old_price !== fresh.old_price);
    const bargainChanged = isItemBargainEnabled(item) !== isItemBargainEnabled(fresh);
    const categoryChanged = fresh.category !== undefined && item.category !== fresh.category;
    const sizeChanged = fresh.size !== undefined && item.size !== fresh.size;

    // Бережно мержим поля (сохраняя массив фото и описание, если в сжатом payload их нет)
    const preservedImages = (Array.isArray(fresh.images) && fresh.images.length > 0) ? fresh.images : item.images;
    const preservedThumbs = (Array.isArray(fresh.thumbnails) && fresh.thumbnails.length > 0) ? fresh.thumbnails : item.thumbnails;
    const preservedDesc = (fresh.description !== undefined && fresh.description !== null) ? fresh.description : item.description;

    Object.assign(item, fresh, {
        images: preservedImages,
        thumbnails: preservedThumbs,
        description: preservedDesc
    });

    updateCardDOM(item);

    if (!fromBroadcast) {
        notifyItemStatusTransition(item, oldStatus, oldPrice, oldIsSale);
    }

    updateSidebarCounters();
    if (typeof renderHistory === 'function') renderHistory();
    if (hasAction('invalidateFuseCache')) invokeAction('invalidateFuseCache');
    safelySaveCatalogToStorage(window.allItems);

    const hideUnavailable = document.getElementById('hideUnavailableCb')?.checked || false;
    const onlySale = document.getElementById('onlySaleCb')?.checked || false;
    const onlyBargain = document.getElementById('onlyBargainCb')?.checked || false;
    const needsGridResortOrRefilter = topChanged || categoryChanged || sizeChanged ||
                                      (hideUnavailable && statusChanged) ||
                                      (onlySale && saleChanged) ||
                                      (onlyBargain && bargainChanged);

    if (needsGridResortOrRefilter) {
        applyFilters(true, true);
    }

    if (!fromBroadcast && _catalogBroadcastChannel) {
        try { _catalogBroadcastChannel.postMessage({ type: 'ITEM_UPSERT', item }); } catch {}
    }
}

let _catalogRealtimeChannel = null;
let _realtimeReconnectTimer = null;
let _realtimeReconnectAttempt = 0;
let _realtimeHadDisconnect = false;

/**
 * Подключает Realtime-канал Supabase `public-items-live-feed` с авто-переподключением.
 */
export function initCatalogRealtimeSubscription() {
    const sb = getSupabaseClient();
    if (!sb || typeof sb.channel !== 'function') return;

    if (_catalogRealtimeChannel) {
        const state = _catalogRealtimeChannel.state;
        if (state === 'joined' || state === 'joining') return;
        const staleChannel = _catalogRealtimeChannel;
        _catalogRealtimeChannel = null;
        try { sb.removeChannel(staleChannel); } catch {}
    }

    if (_realtimeReconnectTimer) {
        clearTimeout(_realtimeReconnectTimer);
        _realtimeReconnectTimer = null;
    }

    try {
        let isTearingDown = false;
        const channel = sb.channel('public-items-live-feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
                handleRealtimeCatalogEvent(payload, false);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    _realtimeReconnectAttempt = 0;
                    if (_realtimeHadDisconnect) {
                        _realtimeHadDisconnect = false;
                        if (hasAction('syncCriticalStatuses')) invokeAction('syncCriticalStatuses');
                    }
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    if (isTearingDown) return;
                    isTearingDown = true;
                    _realtimeHadDisconnect = true;
                    if (_catalogRealtimeChannel === channel) {
                        _catalogRealtimeChannel = null;
                    }
                    if (status !== 'CLOSED') {
                        try { sb.removeChannel(channel); } catch {}
                    }
                    if (!_realtimeReconnectTimer && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
                        const delay = Math.min(1500 * (2 ** _realtimeReconnectAttempt), 12000);
                        _realtimeReconnectAttempt = Math.min(_realtimeReconnectAttempt + 1, 4);
                        _realtimeReconnectTimer = setTimeout(() => {
                            _realtimeReconnectTimer = null;
                            if (typeof navigator === 'undefined' || navigator.onLine !== false) {
                                initCatalogRealtimeSubscription();
                            }
                        }, delay);
                    }
                }
            });
        if (!isTearingDown) {
            _catalogRealtimeChannel = channel;
        }
    } catch {
        _catalogRealtimeChannel = null;
    }
}
