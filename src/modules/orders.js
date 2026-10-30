// ==========================================
// NISHA STORE - MODULAR ORDERS FACADE
// Safe, typed ES module exports for order tracking & history
// ==========================================

/**
 * Opens user orders history modal dialog
 */
export function openOrdersModal() {
    if (typeof window !== 'undefined' && typeof window.openOrdersModal === 'function') {
        return window.openOrdersModal();
    }
}

/**
 * Maps raw backend order status string to UI tab bucket
 * @param {any} order
 * @returns {'accepted'|'shipped'|'cancelled'|'other'}
 */
export function getOrderTabBucket(order) {
    if (typeof window !== 'undefined' && typeof window.getOrderTabBucket === 'function') {
        return window.getOrderTabBucket(order);
    }
    const status = String(order?.status || '').toLowerCase().trim();
    if (status.includes('принят') || status.includes('оплачен') || status.includes('в обработке')) {
        return 'accepted';
    }
    if (status.includes('отправлен') || status.includes('завершен')) {
        return 'shipped';
    }
    if (status.includes('отменен') || status.includes('возврат')) {
        return 'cancelled';
    }
    return 'other';
}

/**
 * Updates tab counters in orders modal
 */
export function updateOrderTabCounters() {
    if (typeof window !== 'undefined' && typeof window.updateOrderTabCounters === 'function') {
        return window.updateOrderTabCounters();
    }
}

/**
 * Fetches user orders from backend API
 * @param {boolean} [forceReload=false]
 * @returns {Promise<any[]>}
 */
export async function fetchMyOrders(forceReload = false) {
    if (typeof window !== 'undefined' && typeof window.fetchMyOrders === 'function') {
        return window.fetchMyOrders(forceReload);
    }
    return [];
}

/**
 * Resolves product image thumbnail for order line item
 * @param {any} item
 * @returns {string}
 */
export function getOrderItemImage(item) {
    if (typeof window !== 'undefined' && typeof window.getOrderItemImage === 'function') {
        return window.getOrderItemImage(item);
    }
    return '';
}

/**
 * Ensures item images for order cards are preloaded
 * @param {any[]} orders
 * @returns {Promise<void>}
 */
export async function ensureOrderImagesLoaded(orders) {
    if (typeof window !== 'undefined' && typeof window.ensureOrderImagesLoaded === 'function') {
        return window.ensureOrderImagesLoaded(orders);
    }
}

/**
 * Switches active orders tab filter ('accepted', 'shipped', 'cancelled')
 * @param {'accepted'|'shipped'|'cancelled'} tabName
 */
export function switchOrderTab(tabName) {
    if (typeof window !== 'undefined' && typeof window.switchOrderTab === 'function') {
        return window.switchOrderTab(tabName);
    }
}

/**
 * Copies Nova Poshta tracking number to clipboard with feedback
 * @param {string} ttn
 * @param {HTMLElement} [btnEl]
 * @returns {Promise<boolean>}
 */
export async function copyTTN(ttn, btnEl) {
    if (typeof window !== 'undefined' && typeof window.copyTTN === 'function') {
        return window.copyTTN(ttn, btnEl);
    }
    return false;
}

/**
 * Re-renders orders list matching active tab filter
 */
export function renderFilteredOrders() {
    if (typeof window !== 'undefined' && typeof window.renderFilteredOrders === 'function') {
        return window.renderFilteredOrders();
    }
}
