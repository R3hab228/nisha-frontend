// ==========================================
// NISHA CATALOG — ЗАГРУЗКА ИЗ БД, КЭШ, REALTIME И СИНХРОНИЗАЦИЯ
// ==========================================

import { getCatalogStore, getSupabaseClient } from './catalog-state.js';
import { updateCardDOM, insertNewItemCardSmoothly } from './catalog-grid.js';
import { applyFilters, updateSidebarCounters } from './catalog-filters.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeProfile, getRuntimeOpenedItem } from '../core/runtime-env.js';

const ITEM_FULL_COLS = 'id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable, is_bargain, min_bargain_price';
const ITEM_LEGACY_COLS = 'id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable';

function isMissingBargainColumnError(error) {
    return Boolean(
        error && (
            error.message?.includes('is_bargain') ||
            error.message?.includes('min_bargain_price') ||
            error.code === '42703' ||
            error.code === 'PGRST204'
        )
    );
}

async function queryItemsWithBargainFallback(runQuery) {
    const first = await runQuery(ITEM_FULL_COLS);
    if (isMissingBargainColumnError(first.error)) {
        return runQuery(ITEM_LEGACY_COLS);
    }
    return first;
}

function notifyItemStatusTransition(item, oldStatus, oldPrice, oldIsSale) {
    if (hasAction('showSaleToast') || typeof showToast === 'function') {
        const numOldPrice = Number(oldPrice) || 0;
        const numNewPrice = Number(item.price) || 0;
        if ((!oldIsSale && item.is_sale) || (numOldPrice > 0 && numNewPrice > 0 && numOldPrice > numNewPrice)) {
            if (item.status === 'available') {
                if (hasAction('showSaleToast')) {
                    invokeAction('showSaleToast', item);
                } else {
                    const salePref = (typeof i18next !== 'undefined' && i18next.t('messages.sale_prefix')) || '🔥 СКИДКА: ';
                    showToast(`${salePref}${item.name}`, 'success');
                }
            }
        }
        if (oldStatus !== 'sold' && item.status === 'sold') {
            removeSoldItemFromCart(item.id, item.name);
        } else if (oldStatus === 'reserved' && item.status === 'available') {
            const expPref = (typeof i18next !== 'undefined' && i18next.t('messages.reservation_expired')) || 'Бронь истекла: ';
            const backInStock = (typeof i18next !== 'undefined' && i18next.t('messages.back_in_stock')) || ' снова в наличии!';
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
 * Загружает каталог из кэша (IndexedDB / localStorage), а затем фоново актуализирует из Supabase.
 * @returns {Promise<void>}
 */
export async function loadAllItems() {
    const grid = typeof document !== 'undefined' ? document.getElementById('itemsGrid') : null;
    const sb = getSupabaseClient();

    // 1. МГНОВЕННАЯ ЗАГРУЗКА (Из IndexedDB с миграцией из localStorage)
    let cachedItems = null;
    if (hasAction('idbGet')) {
        try {
            cachedItems = await invokeAction('idbGet', 'nisha_cached_db');
        } catch {}
    }

    if (!cachedItems) {
        const store = getCatalogStore();
        cachedItems = store ? store.getJSON('nisha_cached_db', null) : null;
        if (cachedItems) {
            if (hasAction('idbSet') && Array.isArray(cachedItems) && cachedItems.length > 0) {
                invokeAction('idbSet', 'nisha_cached_db', cachedItems).then(() => {
                    if (window.storage) window.storage.remove('nisha_cached_db');
                });
            }
        }
    }

    if (cachedItems && Array.isArray(cachedItems) && window.allItems.length === 0) {
        try {
            const isCorrupted = cachedItems.length === 0 ||
                cachedItems[0].description === undefined ||
                ((!Array.isArray(cachedItems[0].images) || cachedItems[0].images.length === 0) &&
                 (!Array.isArray(cachedItems[0].thumbnails) || cachedItems[0].thumbnails.length === 0));

            if (isCorrupted) {
                console.warn('[КЭШ КАТАЛОГА] Обнаружены поврежденные данные без фото/описания, очищаем локальный кэш...');
                cachedItems = null;
                if (hasAction('idbDel')) invokeAction('idbDel', 'nisha_cached_db');
                if (window.storage) window.storage.remove('nisha_cached_db');
            } else {
                window.allItems = cachedItems;
                const searchWorker = invokeAction('getSearchWorker');
                if (searchWorker && typeof searchWorker.setItems === 'function') {
                    searchWorker.setItems(cachedItems);
                }
                applyFilters(true);
                updateSidebarCounters();
            }
        } catch {
            console.error('Ошибка парсинга кэша');
            cachedItems = null;
            if (hasAction('idbDel')) invokeAction('idbDel', 'nisha_cached_db');
            if (window.storage) window.storage.remove('nisha_cached_db');
        }
    }

    if (!sb) return;
    initCatalogRealtimeSubscription();

    // 2. ФОНОВЫЙ ЗАПРОС К БД
    const { data, error } = await queryItemsWithBargainFallback((cols) =>
        sb.from('items')
            .select(cols)
            .limit(1000)
            .order('created_at', { ascending: false })
    );

    if (error) {
        if (window.allItems.length === 0) {
            if (typeof handleNetworkOffline === 'function') {
                handleNetworkOffline();
            } else if (grid) {
                const safeErrMsg = hasAction('escapeHtml') ? invokeAction('escapeHtml', error.message) : error.message;
                grid.innerHTML = `<div style="color:red; padding:20px; grid-column: 1/-1;">[ ОШИБКА БД: ${safeErrMsg} ]</div>`;
            }
        }
        return;
    }

    // Сравниваем изменения без блокирующего JSON.stringify на всем каталоге
    let isStructureChanged = !Array.isArray(window.allItems) || (data.length !== window.allItems.length);
    const changedCardItems = [];
    if (!isStructureChanged) {
        for (let i = 0; i < data.length; i++) {
            const cur = window.allItems[i];
            const next = data[i];
            if (!cur || cur.id !== next.id || cur.name !== next.name || cur.category !== next.category || cur.size !== next.size || cur.brand !== next.brand || !!cur.is_top !== !!next.is_top) {
                isStructureChanged = true;
                break;
            }
            const wasHot = (cur.views_count || 0) >= 25;
            const nowHot = (next.views_count || 0) >= 25;
            const curThumb0 = Array.isArray(cur.thumbnails) ? cur.thumbnails[0] : '';
            const nextThumb0 = Array.isArray(next.thumbnails) ? next.thumbnails[0] : '';
            if (cur.price !== next.price || cur.old_price !== next.old_price || cur.status !== next.status || !!cur.is_sale !== !!next.is_sale || wasHot !== nowHot || curThumb0 !== nextThumb0 || cur.description !== next.description || !!cur.is_returnable !== !!next.is_returnable || cur.condition !== next.condition || !!cur.is_bargain !== !!next.is_bargain || cur.min_bargain_price !== next.min_bargain_price) {
                changedCardItems.push(next);
            }
        }
    }

    const hasValidImages = Array.isArray(data) && data.length > 0 && (
        (Array.isArray(data[0].images) && data[0].images.length > 0) ||
        (Array.isArray(data[0].thumbnails) && data[0].thumbnails.length > 0)
    );

    const deferSave = () => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => safelySaveCatalogToStorage(data), { timeout: 2500 });
        } else {
            setTimeout(() => safelySaveCatalogToStorage(data), 1500);
        }
    };

    if (hasValidImages) {
        window.allItems = data;
        const searchWorker = invokeAction('getSearchWorker');
        if (searchWorker && typeof searchWorker.setItems === 'function') {
            searchWorker.setItems(data);
        }
        if (isStructureChanged || changedCardItems.length > 0 || !cachedItems) deferSave();
        updateSidebarCounters();
    } else if (data && data.length > 0) {
        console.warn('[КАТАЛОГ] Сервер или SW вернул ответ без фото, сохраняем существующие изображения...');
        const oldMap = new Map((window.allItems || []).map(i => [i.id, i]));
        data.forEach(item => {
            const old = oldMap.get(item.id);
            if (old) {
                if (!item.images || item.images.length === 0) item.images = old.images;
                if (!item.thumbnails || item.thumbnails.length === 0) item.thumbnails = old.thumbnails;
                if (!item.description) item.description = old.description;
            }
        });
        window.allItems = data;
        const searchWorker = invokeAction('getSearchWorker');
        if (searchWorker && typeof searchWorker.setItems === 'function') {
            searchWorker.setItems(data);
        }
        updateSidebarCounters();
        if (data[0] && Array.isArray(data[0].images) && data[0].images.length > 0) {
            deferSave();
        }
    }

    // Инициализируем множество уже известных товаров, чтобы не спамить тостом на вещи первой загрузки
    if (!window._notifiedItemIds) {
        window._notifiedItemIds = new Set(Array.isArray(window.allItems) ? window.allItems.map(i => i.id) : []);
    } else if (Array.isArray(window.allItems)) {
        window.allItems.forEach(i => window._notifiedItemIds.add(i.id));
    }

    // 3. ИСТОРИЯ ПРОСМОТРОВ
    const profile = getRuntimeProfile();
    if (profile && profile.viewed_history && profile.viewed_history.length > 0) {
        const dbHistory = [];
        profile.viewed_history.forEach(uuid => {
            const histItem = window.allItems.find(i => i.id === uuid);
            if (histItem) {
                const img = (histItem.images && histItem.images.length > 0) ? histItem.images[0] : '';
                dbHistory.push({ id: histItem.id, name: histItem.name, price: histItem.price, img: img });
            }
        });
        if (window.storage) window.storage.setJSON('nisha_history', dbHistory);
        if (typeof renderHistory === 'function') renderHistory();
    }

    // 4. СИНХРОНИЗАЦИЯ КОРЗИНЫ
    const store = getCatalogStore();
    const userCart = (typeof cart !== 'undefined') ? cart : (window.cart || (store ? store.getJSON('nisha_cart', []) : []));
    const validCart = userCart.filter(cItem => {
        const cId = String(cItem?.id || cItem?.item_id || cItem).trim();
        return window.allItems.some(dbItem => String(dbItem.id).trim() === cId);
    });
    if (validCart.length !== userCart.length) {
        if (typeof cart !== 'undefined') cart = validCart;
        window.cart = validCart;
        if (store) store.setJSON('nisha_cart', validCart);
        if (typeof updateCartUI === 'function') updateCartUI();
    }

    // 5. ПЕРЕРИСОВКА (Без сброса скролла, если изменились только точечные статусы/цены)
    if (!cachedItems || isStructureChanged) {
        applyFilters(!cachedItems, Boolean(cachedItems));
    } else if (changedCardItems.length > 0) {
        const freshMap = new Map(window.allItems.map(i => [i.id, i]));
        if (Array.isArray(window.filteredItems)) {
            window.filteredItems = window.filteredItems.map(fi => freshMap.get(fi.id) || fi);
        }
        changedCardItems.forEach(item => updateCardDOM(item));
    }
    if (hasAction('syncUserBargains')) invokeAction('syncUserBargains');
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
            const itemSoldRemovedMsg = typeof i18next !== 'undefined'
                ? i18next.t('messages.item_sold_removed', { name: itemName || '', defaultValue: `Товар ${itemName || ''} уже купили, он удален из корзины.` })
                : `Товар ${itemName || ''} уже купили, он удален из корзины.`;
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

        document.querySelectorAll(`.item-card[data-id="${delId}"]`).forEach(card => card.remove());
        removeSoldItemFromCart(delId);

        const countEl = document.getElementById('itemCount');
        if (countEl && Array.isArray(window.filteredItems)) {
            countEl.innerText = window.filteredItems.length;
        }

        const activeModal = getRuntimeOpenedItem();
        if (activeModal && String(activeModal.id) === String(delId) && typeof closeModal === 'function') {
            closeModal('productModal');
        }

        updateSidebarCounters();
        if (typeof renderHistory === 'function') renderHistory();
        if (hasAction('invalidateFuseCache')) invokeAction('invalidateFuseCache');
        safelySaveCatalogToStorage(window.allItems);
        applyFilters(true, true);

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
                showToast((typeof i18next !== 'undefined' && i18next.t('messages.new_items_toast')) || 'Новые Вещи!!!', 'success');
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
    const needsGridResortOrRefilter = topChanged || categoryChanged || sizeChanged ||
                                      (hideUnavailable && statusChanged) ||
                                      (onlySale && saleChanged);

    if (needsGridResortOrRefilter) {
        applyFilters(true, true);
    }

    if (!fromBroadcast && _catalogBroadcastChannel) {
        try { _catalogBroadcastChannel.postMessage({ type: 'ITEM_UPSERT', item }); } catch {}
    }
}

let _catalogRealtimeChannel = null;

/**
 * Подключает Realtime-канал Supabase `public-items-live-feed`.
 */
export function initCatalogRealtimeSubscription() {
    const sb = getSupabaseClient();
    if (!sb || typeof sb.channel !== 'function') return;

    if (_catalogRealtimeChannel) {
        const state = _catalogRealtimeChannel.state;
        if (state === 'joined' || state === 'joining') return;
        try { sb.removeChannel(_catalogRealtimeChannel); } catch {}
        _catalogRealtimeChannel = null;
    }

    try {
        _catalogRealtimeChannel = sb.channel('public-items-live-feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
                handleRealtimeCatalogEvent(payload, false);
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    _catalogRealtimeChannel = null;
                }
            });
    } catch {
        _catalogRealtimeChannel = null;
    }
}

// СИНХРОНИЗАЦИЯ КАТАЛОГА В РЕАЛЬНОМ ВРЕМЕНИ (НОВЫЕ ТОВАРЫ, СТАТУСЫ, БЕЙДЖИ TOP/HOT/SALE)
let _isSyncingItems = false;

/**
 * Синхронизирует критичные статусы, новинки, удаления и цены под Web Locks API.
 * @returns {Promise<void>}
 */
export async function syncCriticalStatuses() {
    if (_isSyncingItems) return;
    const sb = getSupabaseClient();
    if (!sb || !window.allItems || window.allItems.length === 0) return;
    initCatalogRealtimeSubscription();

    const executeSync = async () => {
        _isSyncingItems = true;
        try {
            const { data, error } = await sb.from('items')
                .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, views_count, created_at, category, size, condition')
                .order('created_at', { ascending: false })
                .limit(999);

            if (error || !data) return;

            const freshIdSet = new Set(data.map(d => d.id));
            const currentIdSet = new Set(window.allItems.map(i => i.id));
            let gridNeedsFullRefresh = false;

            // 1. Очистка от удаленных из БД товаров (Set.prototype.difference)
            const deletedIds = (typeof currentIdSet.difference === 'function')
                ? Array.from(currentIdSet.difference(freshIdSet))
                : (hasAction('setDifference')
                    ? Array.from(invokeAction('setDifference', currentIdSet, freshIdSet))
                    : window.allItems.filter(i => i && !freshIdSet.has(i.id)).map(i => i.id));

            if (deletedIds.length > 0) {
                window.allItems = window.allItems.filter(i => freshIdSet.has(i.id));
                if (Array.isArray(window.filteredItems)) {
                    window.filteredItems = window.filteredItems.filter(i => freshIdSet.has(i.id));
                }
                deletedIds.forEach(delId => {
                    document.querySelectorAll(`.item-card[data-id="${delId}"]`).forEach(card => card.remove());
                    removeSoldItemFromCart(delId);
                });
                gridNeedsFullRefresh = true;
            }

            // 2. Проверка новых товаров
            const newIds = (typeof freshIdSet.difference === 'function')
                ? Array.from(freshIdSet.difference(currentIdSet))
                : (hasAction('setDifference')
                    ? Array.from(invokeAction('setDifference', freshIdSet, currentIdSet))
                    : data.filter(d => d && !currentIdSet.has(d.id)).map(d => d.id));
            if (newIds.length > 0) {
                const { data: fullNewItems } = await queryItemsWithBargainFallback((cols) =>
                    sb.from('items').select(cols).in('id', newIds)
                );

                if (fullNewItems && fullNewItems.length > 0) {
                    window._notifiedItemIds = window._notifiedItemIds || new Set();
                    const freshNewArrivals = [];
                    fullNewItems.forEach(newItem => {
                        if (!window.allItems.some(i => i.id === newItem.id)) {
                            window.allItems.unshift(newItem);
                        }
                        if (!window._notifiedItemIds.has(newItem.id)) {
                            window._notifiedItemIds.add(newItem.id);
                            freshNewArrivals.push(newItem);
                        }
                    });

                    const sortDateDesc = (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
                    window.allItems = hasAction('toSorted')
                        ? invokeAction('toSorted', window.allItems, sortDateDesc)
                        : (window.allItems.toSorted ? window.allItems.toSorted(sortDateDesc) : [...window.allItems].sort(sortDateDesc));

                    freshNewArrivals.forEach(item => insertNewItemCardSmoothly(item));

                    if (freshNewArrivals.length > 0) {
                        if (typeof enqueueNewItemToast === 'function') {
                            enqueueNewItemToast(freshNewArrivals);
                        } else if (typeof showToast === 'function') {
                            showToast((typeof i18next !== 'undefined' && i18next.t('messages.new_items_toast')) || 'Новые Вещи!!!', 'success');
                        }
                    }
                }
            }

            // 3. Синхронизация статусов, бейджей (TOP/HOT/SALE/SOLD/RESERVED) и цен существующих товаров
            const freshMap = new Map();
            data.forEach(d => freshMap.set(d.id, d));
            let anyCardUpdated = false;
            const nowTs = Date.now();
            const hideUnavailable = document.getElementById('hideUnavailableCb')?.checked || false;
            const onlySale = document.getElementById('onlySaleCb')?.checked || false;

            window.allItems.forEach(item => {
                const fresh = freshMap.get(item.id);
                if (!fresh) return;

                const wasTop = item.is_top === true && item.top_until && Date.parse(item.top_until) > nowTs;
                const nowTop = fresh.is_top === true && fresh.top_until && Date.parse(fresh.top_until) > nowTs;
                const domCard = document.querySelector(`.item-card[data-id="${item.id}"]`);
                const domHasTopBadge = !!(domCard && domCard.querySelector('.status-top'));
                const topExpiredInDom = domHasTopBadge && !nowTop;
                const topChanged = wasTop !== nowTop || item.top_until !== fresh.top_until || !!item.is_top !== !!fresh.is_top || topExpiredInDom;

                const statusChanged = item.status !== fresh.status;
                const saleChanged = (!!item.is_sale !== !!fresh.is_sale) || (item.old_price !== fresh.old_price);
                const priceChanged = item.price !== fresh.price;
                const wasHot = (item.views_count || 0) >= 25;
                const nowHot = (fresh.views_count || 0) >= 25;
                const hotChanged = wasHot !== nowHot;
                const metaChanged = (fresh.name && item.name !== fresh.name) ||
                                    (fresh.brand && item.brand !== fresh.brand) ||
                                    (fresh.size !== undefined && item.size !== fresh.size) ||
                                    (fresh.category !== undefined && item.category !== fresh.category) ||
                                    (fresh.condition !== undefined && item.condition !== fresh.condition);

                if (item.views_count !== fresh.views_count) {
                    item.views_count = fresh.views_count;
                }

                if (topChanged || statusChanged || saleChanged || priceChanged || hotChanged || metaChanged) {
                    const oldStatus = item.status;
                    const oldPrice = item.price;
                    const oldIsSale = item.is_sale;

                    item.is_top = fresh.is_top;
                    item.top_until = fresh.top_until;
                    item.status = fresh.status;
                    item.is_sale = fresh.is_sale;
                    item.old_price = fresh.old_price;
                    item.price = fresh.price;
                    item.views_count = fresh.views_count;
                    if (fresh.name) item.name = fresh.name;
                    if (fresh.brand) item.brand = fresh.brand;
                    if (fresh.size !== undefined) item.size = fresh.size;
                    if (fresh.category !== undefined) item.category = fresh.category;
                    if (fresh.condition !== undefined) item.condition = fresh.condition;

                    updateCardDOM(item);
                    anyCardUpdated = true;

                    if (topChanged || (hideUnavailable && statusChanged) || (onlySale && saleChanged)) {
                        gridNeedsFullRefresh = true;
                    }

                    notifyItemStatusTransition(item, oldStatus, oldPrice, oldIsSale);
                }
            });

            const canSafelySaveCache = window.allItems && window.allItems.length > 0 && (
                (Array.isArray(window.allItems[0].images) && window.allItems[0].images.length > 0) ||
                (Array.isArray(window.allItems[0].thumbnails) && window.allItems[0].thumbnails.length > 0)
            );

            if (gridNeedsFullRefresh) {
                if (canSafelySaveCache) {
                    safelySaveCatalogToStorage(window.allItems);
                }
                updateSidebarCounters();
                if (typeof renderHistory === 'function') renderHistory();
                if (hasAction('invalidateFuseCache')) invokeAction('invalidateFuseCache');
                applyFilters(true, true);
            } else if (anyCardUpdated) {
                if (canSafelySaveCache) {
                    safelySaveCatalogToStorage(window.allItems);
                }
                updateSidebarCounters();
                if (typeof renderHistory === 'function') renderHistory();
                if (hasAction('invalidateFuseCache')) invokeAction('invalidateFuseCache');
            }
        } catch (e) {
            console.warn('Sync error:', e);
        } finally {
            _isSyncingItems = false;
        }
    };

    if (hasAction('runWithLock')) {
        return invokeAction('runWithLock', 'nisha_critical_sync_lock', executeSync, { ifAvailable: true });
    }
    return executeSync();
}

// Периодический фоновый опрос и мгновенная синхронизация при возвращении в PWA / вкладку (с дедупликацией)
let _catalogAutoSyncInitialized = false;
if (typeof window !== 'undefined' && typeof document !== 'undefined' && !_catalogAutoSyncInitialized) {
    _catalogAutoSyncInitialized = true;
    let _lastForegroundSyncAt = 0;

    const triggerForegroundSync = () => {
        if (document.visibilityState !== 'visible') return;
        const now = Date.now();
        if (now - _lastForegroundSyncAt < 2500) return;
        _lastForegroundSyncAt = now;
        initCatalogRealtimeSubscription();
        syncCriticalStatuses();
        if (hasAction('syncUserBargains')) invokeAction('syncUserBargains');
    };

    window._catalogSyncIntervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
            syncCriticalStatuses();
        }
    }, 25000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            triggerForegroundSync();
        }
    });
    window.addEventListener('focus', triggerForegroundSync);
    window.addEventListener('online', triggerForegroundSync);
}

registerActions({
    loadAllItems,
    removeSoldItemFromCart,
    handleRealtimeCatalogEvent,
    initCatalogRealtimeSubscription,
    syncCriticalStatuses
});

if (typeof window !== 'undefined') {
    window.loadAllItems = loadAllItems;
    window.removeSoldItemFromCart = removeSoldItemFromCart;
    window.initCatalogRealtimeSubscription = initCatalogRealtimeSubscription;
    window.syncCriticalStatuses = syncCriticalStatuses;
}
