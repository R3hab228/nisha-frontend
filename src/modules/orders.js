// ==========================================
// NISHA STORE - MODULAR ORDERS FACADE
// Safe, typed ES module exports for order tracking & history
// ==========================================

import { callAction, callAsyncAction } from './_facade.js';
import { safeEncodeURIComponent } from './helpers.js';

/**
 * Opens user orders history modal dialog
 */
export function openOrdersModal() {
    return callAction('openOrdersModal');
}

/**
 * Maps raw backend order status string to UI tab bucket
 * @param {any} order
 * @returns {'accepted'|'shipped'|'cancelled'|'other'}
 */
export function getOrderTabBucket(order) {
    return callAction('getOrderTabBucket', [order], (ord) => {
        const status = String(ord?.status || '').toLowerCase().trim();
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
    });
}

/**
 * Updates tab counters in orders modal
 */
export function updateOrderTabCounters() {
    return callAction('updateOrderTabCounters');
}

/**
 * Fetches user orders from backend API
 * @param {boolean} [forceReload=false]
 * @returns {Promise<any[]>}
 */
export function fetchMyOrders(forceReload = false) {
    return callAsyncAction('fetchMyOrders', [forceReload], () => []);
}

/**
 * Resolves product image thumbnail for order line item
 * @param {any} item
 * @returns {string}
 */
export function getOrderItemImage(item) {
    return callAction('getOrderItemImage', [item], () => '');
}

/**
 * Ensures item images for order cards are preloaded
 * @param {any[]} orders
 * @returns {Promise<void>}
 */
export function ensureOrderImagesLoaded(orders) {
    return callAsyncAction('ensureOrderImagesLoaded', [orders]);
}

/**
 * Switches active orders tab filter ('accepted', 'shipped', 'cancelled')
 * @param {'accepted'|'shipped'|'cancelled'} tabName
 */
export function switchOrderTab(tabName) {
    return callAction('switchOrderTab', [tabName]);
}

/**
 * Copies Nova Poshta tracking number to clipboard with feedback
 * @param {string} ttn
 * @param {HTMLElement} [btnEl]
 * @returns {Promise<boolean>}
 */
export function copyTTN(ttn, btnEl) {
    return callAsyncAction('copyTTN', [ttn, btnEl], () => false);
}

/**
 * Encodes TTN for Nova Poshta tracking web application (base64 reverse format)
 * @param {string} ttn
 * @returns {string}
 */
export function encodeNovaPoshtaTtn(ttn) {
    return callAction('encodeNovaPoshtaTtn', [ttn], (rawTtn) => {
        const clean = String(rawTtn || '').replace(/\D+/g, '');
        if (!clean) return '';
        try {
            const b64 = (typeof btoa === 'function' ? btoa(clean) : Buffer.from(clean).toString('base64')).replace(/=+$/, '');
            const chars = b64.split('');
            return (typeof chars.toReversed === 'function' ? chars.toReversed() : chars.reverse()).join('');
        } catch (_) {
            return clean;
        }
    });
}

/**
 * Returns direct URL to Nova Poshta official tracking web app for a given TTN
 * @param {string} ttn
 * @param {'uk'|'ru'} [lang]
 * @returns {string}
 */
export function getNovaPoshtaTrackingUrl(ttn, lang) {
    return callAction('getNovaPoshtaTrackingUrl', [ttn, lang], (rawTtn, lng) => {
        const cleanTtn = String(rawTtn || '').trim();
        if (!cleanTtn) return 'https://tracking.novaposhta.ua/';
        const currentLang = lng || ((typeof i18next !== 'undefined' && i18next.language === 'ru') ? 'ru' : 'uk');
        const encoded = encodeNovaPoshtaTtn(cleanTtn) || safeEncodeURIComponent(cleanTtn);
        return `https://tracking.novaposhta.ua/#/${currentLang}/${encoded}`;
    });
}

/**
 * Re-renders orders list matching active tab filter
 */
export function renderFilteredOrders() {
    return callAction('renderFilteredOrders');
}

/**
 * Localizes raw order status string based on current language
 * @param {string} rawStatus
 * @returns {string}
 */
export function formatOrderStatus(rawStatus) {
    return callAction('formatOrderStatus', [rawStatus], (raw) => String(raw || '').toUpperCase());
}
