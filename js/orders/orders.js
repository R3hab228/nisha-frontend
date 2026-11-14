// ==========================================
// NISHA MY ORDERS MODULE (Lazy Chunk Orchestrator: MY_ORDERS.EXE & JSBARCODE)
// ==========================================

import { registerActions } from '../core/action-registry.js';

if (typeof document !== 'undefined') {
    import('../../css/lazy-orders-modal.css').catch(() => {});
}
import {
    encodeNovaPoshtaTtn,
    formatOrderDate,
    formatOrderStatus,
    getNovaPoshtaTrackingUrl,
    getOrderTabBucket
} from './orders-state.js';
import {
    ensureOrderImagesLoaded,
    fetchMyOrders,
    getOrderItemImage
} from './orders-fetch.js';
import {
    bindOrdersTabSwipe,
    copyTTN,
    openOrdersModal,
    renderFilteredOrders,
    switchOrderTab,
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
    copyTTN,
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
