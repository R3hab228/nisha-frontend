// ==========================================
// NISHA ORDERS SELECTION & LONG-PRESS DELETE MODULE
// ==========================================

import { invokeAction, resolveAction } from '../core/action-registry.js';
import { getRuntimeUser, tSafe } from '../core/runtime-env.js';
import {
    clearOrderSelection,
    getCurrentOrderTab,
    getOrdersData,
    getSelectedOrderIds,
    hasSelectedOrders,
    hideOrderIds,
    mergeRemoteHiddenOrderIds,
    pruneCachedOrdersByIds,
    setOrdersData,
    toggleOrderSelection
} from './orders-state.js';

const ORDER_TAB_ORDER = ['accepted', 'shipped', 'cancelled'];
const ORDER_LONG_PRESS_MS = 450;
const ORDER_MOVE_TOLERANCE_PX = 10;

function syncOrderCardSelectionDOM(cardEl, selected) {
    if (!cardEl || !cardEl.classList) return;
    cardEl.classList.toggle('is-selected', Boolean(selected));
    cardEl.setAttribute('aria-selected', selected ? 'true' : 'false');
}

export function syncOrdersSelectionToolbar() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('ordersDeleteSelectedBtn');
    const countEl = document.getElementById('ordersDeleteCount');
    const selectedCount = getSelectedOrderIds().length;
    if (countEl) countEl.textContent = String(selectedCount);
    if (!btn) return;
    const isVisible = selectedCount > 0;
    btn.hidden = !isVisible;
    if (typeof btn.setAttribute === 'function') {
        btn.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
        const label = tSafe('orders_modal.delete_selected_title', 'Видалити вибрані замовлення');
        btn.setAttribute('title', label);
        btn.setAttribute('aria-label', label);
    }
    if (btn.classList) btn.classList.toggle('is-visible', isVisible);
}

export function deleteSelectedOrders() {
    const selectedIds = getSelectedOrderIds();
    if (selectedIds.length === 0) return;

    const selectedSet = new Set(selectedIds);
    hideOrderIds(selectedIds);
    pruneCachedOrdersByIds(selectedIds);
    clearOrderSelection();

    const activeUser = getRuntimeUser();
    const apiClient = typeof window !== 'undefined' ? window.apiClient : null;
    if (activeUser && activeUser.id && apiClient && typeof apiClient.post === 'function') {
        const syncUserId = activeUser.id;
        Promise.resolve(apiClient.post('/api/orders/hide', { orderIds: selectedIds }, { timeout: 8000 }))
            .then((res) => {
                const currentUser = getRuntimeUser();
                if (currentUser && String(currentUser.id) !== String(syncUserId)) return;
                if (Array.isArray(res?.hiddenOrderIds)) {
                    mergeRemoteHiddenOrderIds(res.hiddenOrderIds);
                }
            })
            .catch(() => {});
    }

    const remaining = getOrdersData().filter(o => o && !selectedSet.has(String(o.id)));
    setOrdersData(remaining);

    const hapticFn = resolveAction('triggerHaptic');
    if (hapticFn) hapticFn('success');
    const soundFn = resolveAction('playSound');
    if (soundFn) Promise.resolve(soundFn('recycle', { kind: 'ui' })).catch(() => {});

    syncOrdersSelectionToolbar();
    invokeAction('updateOrderTabCounters');

    const runUpdate = () => invokeAction('renderFilteredOrders');
    const vtFn = resolveAction('safeViewTransition') || (typeof safeViewTransition === 'function' ? safeViewTransition : null);
    if (vtFn) vtFn(runUpdate);
    else runUpdate();

    const toastFn = resolveAction('showToast') || (typeof showToast === 'function' ? showToast : null);
    if (toastFn) {
        const defaultMsg = `Видалено замовлень: ${selectedIds.length}`;
        const msg = tSafe('orders_modal.deleted_selected', { count: selectedIds.length, defaultValue: defaultMsg }, defaultMsg);
        toastFn(msg, 'success');
    }
}

function triggerOrderSelectFeedback(selected) {
    const hapticFn = resolveAction('triggerHaptic');
    if (hapticFn) hapticFn(selected ? 'medium' : 'light');
    else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(selected ? 18 : 8); } catch {}
    }
    const soundFn = resolveAction('playSound');
    if (soundFn) {
        Promise.resolve(soundFn(selected ? 'menu' : 'minimize', { kind: 'ui' })).catch(() => {});
    }
}

/**
 * Привязывает современный long-press жест (Pointer Events) для выделения карточек заказов
 * во вкладках Принятые / Отправленные / Отмененные.
 */
export function bindOrdersLongPressSelection() {
    const listArea = document.getElementById('ordersListArea');
    if (!listArea || !listArea.dataset || listArea.dataset.selectionBound === '1') return;
    listArea.dataset.selectionBound = '1';

    let pressTimer = null;
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let pressedCard = null;
    let longPressFired = false;
    let suppressNextClickUntil = 0;

    const clearPressTimer = () => {
        if (pressTimer !== null) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        activePointerId = null;
        pressedCard = null;
    };

    listArea.addEventListener('pointerdown', (e) => {
        if (e.isPrimary === false) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const target = e.target;
        const card = target && typeof target.closest === 'function' ? target.closest('.order-card') : null;
        if (!card) return;
        const orderId = card.dataset ? card.dataset.orderId : card.getAttribute?.('data-order-id');
        if (!orderId) return;

        clearPressTimer();
        activePointerId = e.pointerId;
        startX = Number(e.clientX) || 0;
        startY = Number(e.clientY) || 0;
        pressedCard = card;
        longPressFired = false;

        pressTimer = setTimeout(() => {
            pressTimer = null;
            if (!pressedCard) return;
            const currentTab = getCurrentOrderTab();
            if (!ORDER_TAB_ORDER.includes(currentTab)) return;

            longPressFired = true;
            suppressNextClickUntil = Date.now() + 550;
            const nextSelected = toggleOrderSelection(orderId);
            syncOrderCardSelectionDOM(pressedCard, nextSelected);
            syncOrdersSelectionToolbar();
            triggerOrderSelectFeedback(nextSelected);
        }, ORDER_LONG_PRESS_MS);
    }, { passive: true });

    listArea.addEventListener('pointermove', (e) => {
        if (pressTimer === null || e.pointerId !== activePointerId) return;
        const dx = (Number(e.clientX) || 0) - startX;
        const dy = (Number(e.clientY) || 0) - startY;
        if (Math.hypot(dx, dy) > ORDER_MOVE_TOLERANCE_PX) {
            clearPressTimer();
        }
    }, { passive: true });

    const cancelPress = (e) => {
        if (e && activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
        clearPressTimer();
    };
    listArea.addEventListener('pointerup', cancelPress, { passive: true });
    listArea.addEventListener('pointercancel', cancelPress, { passive: true });

    listArea.addEventListener('contextmenu', (e) => {
        const target = e.target;
        const card = target && typeof target.closest === 'function' ? target.closest('.order-card') : null;
        if (card && (pressedCard !== null || longPressFired || Date.now() < suppressNextClickUntil || hasSelectedOrders())) {
            e.preventDefault();
        }
    });

    listArea.addEventListener('click', (e) => {
        if (longPressFired || Date.now() < suppressNextClickUntil) {
            longPressFired = false;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (!hasSelectedOrders()) return;
        const target = e.target;
        const card = target && typeof target.closest === 'function' ? target.closest('.order-card') : null;
        if (!card) return;
        const orderId = card.dataset ? card.dataset.orderId : card.getAttribute?.('data-order-id');
        if (!orderId) return;

        e.preventDefault();
        e.stopPropagation();
        const nextSelected = toggleOrderSelection(orderId);
        syncOrderCardSelectionDOM(card, nextSelected);
        syncOrdersSelectionToolbar();
        triggerOrderSelectFeedback(nextSelected);
    }, true);
}
