// ==========================================
// NISHA ORDERS RENDER, TABS & SWIPE UI MODULE
// ==========================================

import { resolveAction } from '../core/action-registry.js';
import {
    escAttr,
    escHtml,
    fmtPrice,
    formatOrderDate,
    formatOrderStatus,
    getCurrentOrderTab,
    getNovaPoshtaTrackingUrl,
    getOrderTabBucket,
    getOrdersData,
    getStorage,
    setCurrentOrderTab
} from './orders-state.js';
import { ensureOrderImagesLoaded, fetchMyOrders, getOrderItemImage } from './orders-fetch.js';

const ORDER_TAB_ORDER = ['accepted', 'shipped', 'cancelled'];

export function updateOrderTabCounters() {
    const ordersList = getOrdersData();
    const grouped = (typeof Object.groupBy === 'function')
        ? Object.groupBy(ordersList, getOrderTabBucket)
        : ordersList.reduce((acc, o) => {
            const b = getOrderTabBucket(o);
            (acc[b] = acc[b] || []).push(o);
            return acc;
        }, {});

    const acceptedCount = grouped.accepted ? grouped.accepted.length : 0;
    const shippedCount = grouped.shipped ? grouped.shipped.length : 0;
    const cancelledCount = grouped.cancelled ? grouped.cancelled.length : 0;

    const tabYellow = document.querySelector('.order-tab.tab-yellow');
    const tabBlue = document.querySelector('.order-tab.tab-blue');
    const tabRed = document.querySelector('.order-tab.tab-red');

    const txtAccepted = typeof i18next !== 'undefined' ? i18next.t('orders_modal.tab_accepted', { defaultValue: 'ПРИНЯТЫЕ' }) : 'ПРИНЯТЫЕ';
    const txtShipped = typeof i18next !== 'undefined' ? i18next.t('orders_modal.tab_shipped', { defaultValue: 'ОТПРАВЛЕННЫЕ' }) : 'ОТПРАВЛЕННЫЕ';
    const txtCancelled = typeof i18next !== 'undefined' ? i18next.t('orders_modal.tab_cancelled', { defaultValue: 'ОТМЕНЕННЫЕ' }) : 'ОТМЕНЕННЫЕ';

    if (tabYellow) {
        tabYellow.removeAttribute('data-i18n');
        tabYellow.innerHTML = `<span data-i18n="orders_modal.tab_accepted">${txtAccepted}</span> <span id="orderTabCountAccepted">(${acceptedCount})</span>`;
    }
    if (tabBlue) {
        tabBlue.removeAttribute('data-i18n');
        tabBlue.innerHTML = `<span data-i18n="orders_modal.tab_shipped">${txtShipped}</span> <span id="orderTabCountShipped">(${shippedCount})</span>`;
    }
    if (tabRed) {
        tabRed.removeAttribute('data-i18n');
        tabRed.innerHTML = `<span data-i18n="orders_modal.tab_cancelled">${txtCancelled}</span> <span id="orderTabCountCancelled">(${cancelledCount})</span>`;
    }

    let currentTab = getCurrentOrderTab();
    if (acceptedCount === 0 && shippedCount > 0 && currentTab === 'accepted') {
        currentTab = 'shipped';
        setCurrentOrderTab(currentTab);
    } else if (!currentTab || (currentTab !== 'shipped' && currentTab !== 'cancelled')) {
        currentTab = 'accepted';
        setCurrentOrderTab(currentTab);
    }

    if (tabYellow) tabYellow.classList.toggle('active', currentTab === 'accepted');
    if (tabBlue) tabBlue.classList.toggle('active', currentTab === 'shipped');
    if (tabRed) tabRed.classList.toggle('active', currentTab === 'cancelled');
}

export function switchOrderTab(tabName) {
    if (getCurrentOrderTab() === tabName) return;

    const bgGrid = document.getElementById('itemsGrid');
    const prevGridVt = bgGrid ? bgGrid.style.viewTransitionName : '';
    if (bgGrid) bgGrid.style.setProperty('view-transition-name', 'none', 'important');

    const bgCards = document.querySelectorAll('#itemsGrid .item-card');
    const cardsToRestore = [];
    if (bgCards && bgCards.length > 0) {
        bgCards.forEach(card => {
            const vt = card.style.getPropertyValue('view-transition-name');
            const prio = card.style.getPropertyPriority('view-transition-name');
            if (vt && vt !== 'none') {
                cardsToRestore.push({ card, vt, prio });
                card.style.setProperty('view-transition-name', 'none', 'important');
            }
        });
    }

    const restoreBgTransitions = () => {
        if (bgGrid) {
            if (prevGridVt) bgGrid.style.setProperty('view-transition-name', prevGridVt);
            else bgGrid.style.removeProperty('view-transition-name');
        }
        cardsToRestore.forEach(({ card, vt, prio }) => {
            card.style.setProperty('view-transition-name', vt, prio);
        });
    };

    const updateDom = () => {
        if (typeof window !== 'undefined') window.currentOrderTab = tabName;
        else setCurrentOrderTab(tabName);

        const tabYellow = document.querySelector('.order-tab.tab-yellow');
        const tabBlue = document.querySelector('.order-tab.tab-blue');
        const tabRed = document.querySelector('.order-tab.tab-red');
        if (tabYellow) tabYellow.classList.toggle('active', tabName === 'accepted');
        if (tabBlue) tabBlue.classList.toggle('active', tabName === 'shipped');
        if (tabRed) tabRed.classList.toggle('active', tabName === 'cancelled');

        const listArea = document.getElementById('ordersListArea');
        if (listArea) listArea.scrollTop = 0;

        renderFilteredOrders();
    };

    const viewTransitionFn = resolveAction('safeViewTransition') || (typeof safeViewTransition === 'function' ? safeViewTransition : null);
    let transitionResult;
    if (viewTransitionFn) {
        transitionResult = viewTransitionFn(updateDom);
    } else {
        transitionResult = updateDom();
    }

    if (transitionResult && typeof transitionResult.finished?.finally === 'function') {
        transitionResult.finished.finally(restoreBgTransitions);
    } else if (transitionResult && typeof transitionResult.then === 'function') {
        transitionResult.finally(restoreBgTransitions);
    } else {
        restoreBgTransitions();
    }

    return transitionResult;
}

/**
 * Подключает плавный мобильный свайп влево/вправо для переключения вкладок
 * («Принятые» ↔ «Отправлены» ↔ «Отменены») с жёсткой блокировкой оси и защитой от случайных свайпов.
 */
export function bindOrdersTabSwipe() {
    const listArea = document.getElementById('ordersListArea');
    if (!listArea || listArea.dataset.swipeBound === '1') return;
    listArea.dataset.swipeBound = '1';

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let lastDx = 0;
    let axis = null; // null | 'x' | 'y'
    let active = false;

    const resetVisual = (animate = true) => {
        if (!animate) {
            listArea.style.transition = 'none';
            listArea.style.transform = '';
            return;
        }
        listArea.style.transition = 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)';
        listArea.style.transform = 'translate3d(0, 0, 0)';
        const cleanup = () => {
            listArea.style.transition = '';
            listArea.style.transform = '';
        };
        listArea.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, 220);
    };

    listArea.addEventListener('touchstart', (e) => {
        active = false;
        axis = null;
        lastDx = 0;

        if (!e.touches || e.touches.length !== 1) return;
        const tabsEl = document.getElementById('ordersTabs');
        if (!tabsEl || tabsEl.style.display === 'none') return;

        const target = e.target;
        if (target && typeof target.closest === 'function' && target.closest('input, textarea, select')) return;

        const touch = e.touches[0];
        const vw = (typeof window !== 'undefined' && window.innerWidth) || document.documentElement.clientWidth || 375;
        if (touch.clientX < 20 || touch.clientX > vw - 20) return;

        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        active = true;
        listArea.style.transition = 'none';
    }, { passive: true });

    listArea.addEventListener('touchmove', (e) => {
        if (!active || !e.touches || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (axis === null) {
            if (Math.hypot(dx, dy) < 12) return;
            if (absDy >= absDx * 0.85) {
                axis = 'y';
                return;
            }
            if (absDx > absDy * 1.4 && absDx >= 14) {
                axis = 'x';
            } else {
                return;
            }
        }

        if (axis !== 'x') return;

        lastDx = dx;
        const currentIdx = ORDER_TAB_ORDER.indexOf(getCurrentOrderTab());
        const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
        const canSwitch = nextIdx >= 0 && nextIdx < ORDER_TAB_ORDER.length;

        const factor = canSwitch ? 0.22 : 0.08;
        const maxShift = canSwitch ? 28 : 10;
        const shift = Math.max(-maxShift, Math.min(maxShift, dx * factor));
        listArea.style.transform = `translate3d(${shift.toFixed(1)}px, 0, 0)`;
    }, { passive: true });

    const finishSwipe = (cancelled = false) => {
        if (!active) return;
        const wasHorizontal = axis === 'x';
        const dx = lastDx;
        const elapsed = Math.max(1, Date.now() - startTime);
        active = false;
        axis = null;
        lastDx = 0;

        if (!wasHorizontal || cancelled) {
            if (listArea.style.transform) resetVisual(true);
            else listArea.style.transition = '';
            return;
        }

        const absDx = Math.abs(dx);
        const velocity = absDx / elapsed;
        const passed = absDx >= 56 || (absDx >= 34 && velocity >= 0.35 && elapsed < 320);

        if (passed) {
            const currentIdx = ORDER_TAB_ORDER.indexOf(getCurrentOrderTab());
            const targetIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
            if (targetIdx >= 0 && targetIdx < ORDER_TAB_ORDER.length) {
                resetVisual(false);
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                    try { navigator.vibrate(10); } catch {}
                }
                switchOrderTab(ORDER_TAB_ORDER[targetIdx]);
                return;
            }
        }

        resetVisual(true);
    };

    listArea.addEventListener('touchend', () => finishSwipe(false), { passive: true });
    listArea.addEventListener('touchcancel', () => finishSwipe(true), { passive: true });
}

export function copyTTN(ttn, el) {
    if (!ttn) return;
    const cleanTtn = String(ttn).trim();
    const ttnCopiedPrefix = typeof i18next !== 'undefined' ? i18next.t('orders_modal.ttn_copied', { defaultValue: 'ТТН скопирован: ' }) : 'ТТН скопирован: ';
    const successMsg = ttnCopiedPrefix + cleanTtn;

    const animateCopiedIcon = () => {
        if (typeof triggerHaptic === 'function') triggerHaptic('success');
        if (el) {
            const icon = el.querySelector('.ttn-copy-icon');
            if (icon) {
                icon.style.transform = 'scale(1.25)';
                icon.style.stroke = '#fff';
                setTimeout(() => {
                    icon.style.transform = 'scale(1)';
                    icon.style.stroke = 'var(--accent-green)';
                }, 250);
            }
        }
    };

    const copyFn = resolveAction('copyToClipboard');
    if (copyFn) {
        copyFn(cleanTtn, successMsg).then(ok => {
            if (ok) animateCopiedIcon();
        });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(cleanTtn).then(() => {
            if (typeof showToast === 'function') showToast(successMsg, 'success');
            animateCopiedIcon();
        }).catch(() => {});
    }
}

export function renderFilteredOrders() {
    const listArea = document.getElementById('ordersListArea');
    if (!listArea) return;
    if (typeof listArea.replaceChildren === 'function') listArea.replaceChildren();
    else listArea.innerHTML = '';

    const ordersList = getOrdersData();
    const activeTab = getCurrentOrderTab();

    const grouped = (typeof Object.groupBy === 'function')
        ? Object.groupBy(ordersList, getOrderTabBucket)
        : ordersList.reduce((acc, o) => {
            const b = getOrderTabBucket(o);
            (acc[b] = acc[b] || []).push(o);
            return acc;
        }, {});

    const filteredData = grouped[activeTab] || [];

    if (filteredData.length === 0) {
        const emptyAccepted = typeof i18next !== 'undefined' ? i18next.t('orders_modal.empty_accepted', { defaultValue: 'Нет активных заказов.' }) : 'Нет активных заказов.';
        const emptyShipped = typeof i18next !== 'undefined' ? i18next.t('orders_modal.empty_shipped', { defaultValue: 'Нет отправленных посылок.' }) : 'Нет отправленных посылок.';
        const emptyCancelled = typeof i18next !== 'undefined' ? i18next.t('orders_modal.empty_cancelled', { defaultValue: 'Нет отмененных заказов.' }) : 'Нет отмененных заказов.';
        const emptyMsg = activeTab === 'accepted' ? emptyAccepted :
            (activeTab === 'shipped' ? emptyShipped : emptyCancelled);
        listArea.innerHTML = `<div style="text-align:center; color:#666; font-family: monospace; padding: 30px;">[ ${emptyMsg} ]</div>`;
        return;
    }

    const store = getStorage();
    let reviewedOrders = store ? store.getJSON('nisha_reviewed_orders', []) : [];
    if (!Array.isArray(reviewedOrders)) reviewedOrders = [];

    const cardsHtml = filteredData.map(order => {
        const orderDateMs = Date.parse(order.created_at);
        const date = formatOrderDate(orderDateMs);
        const itemsHtml = (Array.isArray(order.items) ? order.items : []).map(item => {
            const itemImg = getOrderItemImage(item);
            const safeImgUrl = escHtml(itemImg);
            const imgStyle = itemImg ? `background-image: url('${safeImgUrl}');` : '';
            const itemPrice = item.currentPrice !== undefined ? item.currentPrice : (item.price || 0);
            return `
                    <div class="order-item-row" data-action="open-product" data-id="${escAttr(item.id)}" title="Открыть карточку товара">
                        <div class="order-item-img" data-item-id="${escAttr(item.id)}" style="${imgStyle}">${itemImg ? '' : 'NO IMG'}</div>
                        <div class="order-item-details">
                            <div class="order-item-name">${escHtml(item.name || 'Товар')}</div>
                            <div class="order-item-meta"><span>Размер: ${escHtml(item.size || '—')}</span><span class="order-item-price">${fmtPrice(itemPrice)}</span></div>
                        </div>
                    </div>`;
        }).join('');

        let ttnHtml = '';
        if ((order.status || '').toUpperCase() !== 'ОТМЕНЕН') {
            const rawTtns = String(order.tracking_number || '')
                .split(/[,;\n\r/]+/)
                .map(t => t.trim())
                .filter(Boolean);

            if (rawTtns.length > 0) {
                const trackingLang = (typeof i18next !== 'undefined' && i18next.language === 'ru') ? 'ru' : 'uk';
                ttnHtml = rawTtns.map((ttn, idx) => {
                    const labelPrefix = rawTtns.length > 1
                        ? ((typeof i18next !== 'undefined' ? i18next.t('orders_modal.parcel_prefix', { defaultValue: 'Посылка' }) : 'Посылка') + ` #${idx + 1} ТТН:`)
                        : 'ТТН:';
                    const safeTtnAttr = escAttr(ttn);
                    const safeTtnHtml = escHtml(ttn);
                    const npTrackingUrl = getNovaPoshtaTrackingUrl(ttn, trackingLang);

                    return `<div class="order-ttn">
                             <div class="order-ttn-header">
                                 <span class="order-ttn-label">${labelPrefix}</span>
                                 <div class="order-ttn-actions">
                                     <div class="ttn-copy-btn" data-action="copy-ttn" data-ttn="${safeTtnAttr}" title="Нажмите, чтобы скопировать номер ТТН">
                                         <svg class="ttn-copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                             <rect x="2" y="2" width="13" height="13" rx="3.5"></rect>
                                             <path d="M7.5 7.5h8.5a3.5 3.5 0 0 1 3.5 3.5v8.5a3.5 3.5 0 0 1-3.5 3.5H7.5a3.5 3.5 0 0 1-3.5-3.5"></path>
                                         </svg>
                                         <span class="ttn-number">${safeTtnHtml}</span>
                                     </div>
                                     <a href="${npTrackingUrl}" target="_blank" rel="noopener noreferrer" class="ttn-track-link" title="Отследить на Новой Почте">
                                         <span>ТРЕК</span>
                                         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                     </a>
                                 </div>
                             </div>
                             <div class="order-ttn-barcode">
                                 <svg class="barcode-svg" data-ttn="${safeTtnAttr}"></svg>
                             </div>
                           </div>`;
                }).join('');
            } else {
                ttnHtml = `<div class="order-ttn order-ttn-pending"><span style="color:#777; font-size:12px; font-family:var(--font-mono);">${typeof i18next !== 'undefined' ? i18next.t('orders_modal.ttn_pending', { defaultValue: 'ТТН: Ожидается генерация...' }) : 'ТТН: Ожидается генерация...'}</span></div>`;
            }
        }

        let reviewBtnHtml = '';
        if ((order.status || '').toLowerCase() === 'завершен' && order.items && order.items.length > 0) {
            const firstItem = order.items.at(0);
            const firstItemImg = getOrderItemImage(firstItem);
            const safeName = String(firstItem.name || '');
            const msgIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; position: relative; top: 2px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

            if (!reviewedOrders.includes(order.id)) {
                reviewBtnHtml = `
                        <div style="margin-top: 10px; cursor: pointer; color: var(--accent-green); font-size: 12px; font-family: var(--font-main); text-align: center; transition: 0.2s;" 
                             data-action="prompt-order-review" data-hover-action="review-link-hover" data-order-id="${escAttr(order.id)}" data-item-name="${escAttr(safeName)}" data-item-img="${escAttr(firstItemImg)}" data-item-id="${escAttr(firstItem.id)}"
                             role="button"
                             tabindex="0">
                            ${msgIcon} ${typeof i18next !== 'undefined' ? i18next.t('orders_modal.leave_review', { defaultValue: 'Оставить отзыв' }) : 'Оставить отзыв'}
                        </div>
                    `;
            } else {
                reviewBtnHtml = `
                        <div style="margin-top: 10px; color: #666; font-size: 12px; font-family: var(--font-mono); text-align: center; user-select: none; cursor: default;">
                            ${typeof i18next !== 'undefined' ? i18next.t('orders_modal.review_left', { defaultValue: '[✔] ОТЗЫВ ОСТАВЛЕН' }) : '[✔] ОТЗЫВ ОСТАВЛЕН'}
                        </div>
                    `;
            }
        }

        const statusSlug = (order.status || '').toLowerCase().replace(/[\s_]+/g, '-');
        const ttnBlock = ttnHtml ? `<div class="order-ttns-wrapper">${ttnHtml}</div>` : '';
        const totalPrefix = typeof i18next !== 'undefined' ? i18next.t('orders_modal.total_prefix', { defaultValue: 'ИТОГО:' }) : 'ИТОГО:';
        const formattedTotal = fmtPrice(order.total_sum);
        const fmtStatus = formatOrderStatus(order.status);

        return `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-id-wrap">
                        <span class="order-id">${typeof i18next !== 'undefined' ? i18next.t('orders_modal.order_prefix', { defaultValue: 'ЗАКАЗ #' }) : 'ЗАКАЗ #'}${String(order.id || '').split('-').at(0).toUpperCase()}</span>
                        ${date ? `<span class="order-date">${date}</span>` : ''}
                    </div>
                    <span class="order-status status-${escAttr(statusSlug)}" data-raw-status="${escAttr(order.status || '')}">${escHtml(fmtStatus)}</span>
                </div>
                <div class="order-items-list">${itemsHtml}</div>
                ${reviewBtnHtml}
                <div class="order-footer">
                    ${ttnBlock}
                    <div class="order-total-row">
                        <div class="order-total">${totalPrefix} ${formattedTotal}</div>
                    </div>
                </div>
            </div>`;
    }).join('');

    listArea.innerHTML = cardsHtml;

    ensureOrderImagesLoaded();

    const drawBarcodes = () => {
        const barcodeFn = (typeof window !== 'undefined' && window.JsBarcode) || (typeof JsBarcode !== 'undefined' ? JsBarcode : null);
        if (!barcodeFn) return;
        document.querySelectorAll('.barcode-svg').forEach(svg => {
            const ttn = svg.getAttribute('data-ttn');
            if (ttn) {
                try {
                    barcodeFn(svg, ttn, { format: 'CODE128', lineColor: '#000', background: 'transparent', width: 1.5, height: 50, displayValue: false });
                } catch {}
            }
        });
    };

    if ((typeof window !== 'undefined' && typeof window.JsBarcode !== 'undefined') || typeof JsBarcode !== 'undefined') {
        drawBarcodes();
    } else if (document.querySelector('.barcode-svg')) {
        import('jsbarcode').then(mod => {
            if (typeof window !== 'undefined') window.JsBarcode = mod.default || mod;
            drawBarcodes();
        }).catch(err => {
            console.warn('[JsBarcode] Local load failed, falling back to CDN:', err);
            const extScriptFn = resolveAction('loadExternalScript') || (typeof loadExternalScript === 'function' ? loadExternalScript : null);
            if (extScriptFn) {
                extScriptFn('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js').then(drawBarcodes).catch(() => {});
            }
        });
    }
}

export function openOrdersModal() {
    if (typeof openModal === 'function') {
        openModal('ordersModal');
    } else {
        const modal = document.getElementById('ordersModal');
        if (modal) {
            modal.inert = false;
            modal.removeAttribute('inert');
            modal.setAttribute('aria-hidden', 'false');
            modal.classList.add('is-open');
            modal.style.display = 'flex';
        }
        document.body.style.overflow = 'hidden';
    }
    if (typeof triggerModalTypewriter === 'function') {
        triggerModalTypewriter('ordersModal');
    }

    const stopLenisFn = resolveAction('stopLenis');
    if (stopLenisFn) stopLenisFn();
    else if (typeof lenis !== 'undefined') lenis.stop();

    const guestInputGroup = document.getElementById('guestOrderInputGroup');
    const guestText = document.getElementById('guestOrderText');
    const listArea = document.getElementById('ordersListArea');

    const activeUser = (typeof window !== 'undefined' && window.currentUser) || (typeof currentUser !== 'undefined' ? currentUser : null);
    const activeProfile = (typeof window !== 'undefined' && window.userProfile) || (typeof userProfile !== 'undefined' ? userProfile : null);
    bindOrdersTabSwipe();

    if (activeUser) {
        if (guestInputGroup) guestInputGroup.style.display = 'none';

        const displayNameFn = resolveAction('getUserDisplayName');
        const dName = displayNameFn
            ? displayNameFn(activeUser, activeProfile)
            : (activeProfile?.username || activeUser.user_metadata?.display_name || activeUser.user_metadata?.username || activeUser.user_metadata?.full_name || activeUser.user_metadata?.name || activeUser.email.split('@').at(0));

        const grantedMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.access_granted', { defaultValue: 'Доступ разрешен' }) : 'Доступ разрешен';
        const safeDName = escHtml(dName);
        if (guestText) guestText.innerHTML = `${grantedMsg}: <span style="color:var(--accent-green); font-weight:bold;">@${safeDName}</span>`;
        updateOrderTabCounters();
        fetchMyOrders();
    } else {
        if (guestInputGroup) guestInputGroup.style.display = 'flex';
        const guestDescMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.guest_desc', { defaultValue: 'Введите номер телефона, указанный при заказе, чтобы отследить статус:' }) : 'Введите номер телефона, указанный при заказе, чтобы отследить статус:';
        const searchPlaceholderMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.search_placeholder', { defaultValue: 'Введите номер телефона для поиска...' }) : 'Введите номер телефона для поиска...';
        if (guestText) guestText.innerHTML = guestDescMsg;
        if (listArea) listArea.innerHTML = `<div style="text-align:center; color:#555; font-family: monospace; padding: 30px;">${searchPlaceholderMsg}</div>`;
        updateOrderTabCounters();

        const store = getStorage();
        const lastPhone = store ? store.get('nisha_last_phone') : null;
        const phoneInput = document.getElementById('ordersSearchPhone');
        if (lastPhone && phoneInput && !phoneInput.value) {
            phoneInput.value = lastPhone;
        }
        if (phoneInput && phoneInput.value) {
            fetchMyOrders();
        }
    }
}
