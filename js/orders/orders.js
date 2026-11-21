// ==========================================
// NISHA MY ORDERS MODULE (Lazy Chunk Orchestrator: MY_ORDERS.EXE & JSBARCODE)
// ==========================================

import { registerActions } from '../core/action-registry.js';

if (typeof document !== 'undefined') {
    import('../../css/lazy-orders-modal.css').catch(() => {});
}
import {
    clearOrderSelection,
    encodeNovaPoshtaTtn,
    formatOrderDate,
    formatOrderStatus,
    getNovaPoshtaTrackingUrl,
    getOrderTabBucket,
    getSelectedOrderIds,
    toggleOrderSelection
} from './orders-state.js';
import {
    ensureOrderImagesLoaded,
    fetchMyOrders,
    getOrderItemImage
} from './orders-fetch.js';
import {
    bindOrdersLongPressSelection,
    bindOrdersTabSwipe,
    copyTTN,
    deleteSelectedOrders,
    openOrdersModal,
    renderFilteredOrders,
    switchOrderTab,
    syncOrdersSelectionToolbar,
    updateOrderTabCounters
} from './orders-render.js';

export * from './orders-state.js';
export * from './orders-fetch.js';
export * from './orders-render.js';

const ORDER_EXPORTS = {
    formatOrderDate,
    openOrdersModal,
    formatOrderStatus,
    getOrderTabBucket,
    updateOrderTabCounters,
    fetchMyOrders,
    getOrderItemImage,
    ensureOrderImagesLoaded,
    encodeNovaPoshtaTtn,
    getNovaPoshtaTrackingUrl,
    switchOrderTab,
    bindOrdersTabSwipe,
    bindOrdersLongPressSelection,
    clearOrderSelection,
    getSelectedOrderIds,
    toggleOrderSelection,
    deleteSelectedOrders,
    copyTTN,
    syncOrdersSelectionToolbar,
    renderFilteredOrders
};

Object.entries(ORDER_EXPORTS).forEach(([name, fn]) => {
    if (typeof window !== 'undefined') window[name] = fn;
    if (typeof globalThis !== 'undefined') globalThis[name] = fn;
});

registerActions(ORDER_EXPORTS);

if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    try { updateOrderTabCounters(); } catch {}
}
