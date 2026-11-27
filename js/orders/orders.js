// @ts-check
// ==========================================
// NISHA MY ORDERS MODULE (Lazy Chunk Orchestrator: MY_ORDERS.EXE & JSBARCODE)
// ==========================================

import { registerActions } from '../core/action-registry.js';

if (typeof document !== 'undefined') {
    import(/** @type {string} */ ('../../css/lazy-orders-modal.css')).catch(() => {});
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

import {
    buildDeliveryTruckSvg,
    buildOrderTrackingBarHtml,
    hydrateVisibleOrderTracking,
    refreshOrderTracking,
    resolveTrackingDisplayState
} from './orders-tracking.js';

export * from './orders-state.js';
export * from './orders-fetch.js';
export * from './orders-render.js';
export * from './orders-tracking.js';

const ORDER_WINDOW_EXPORTS = {
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
    renderFilteredOrders,
    hydrateVisibleOrderTracking,
    refreshOrderTracking
};

const ORDER_REGISTRY_ACTIONS = {
    ...ORDER_WINDOW_EXPORTS,
    buildDeliveryTruckSvg,
    buildOrderTrackingBarHtml,
    resolveTrackingDisplayState
};

Object.entries(ORDER_WINDOW_EXPORTS).forEach(([name, fn]) => {
    if (typeof window !== 'undefined') window[name] = fn;
    if (typeof globalThis !== 'undefined') (/** @type {any} */ (globalThis))[name] = fn;
});

registerActions(ORDER_REGISTRY_ACTIONS);

if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    try { updateOrderTabCounters(); } catch {}
}
