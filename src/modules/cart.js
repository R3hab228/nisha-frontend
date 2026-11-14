// ==========================================
// NISHA STORE - MODULAR CART & CHECKOUT FACADE
// Safe, typed ES module exports for cart operations
// ==========================================

import { callAction, callAsyncAction } from './_facade.js';
import { getStore } from './store.js';

/**
 * Returns current cart array
 * @returns {any[]}
 */
export function getActiveCart() {
    return callAction('getActiveCart', [], () => {
        const s = getStore();
        return (s && Array.isArray(s.cart)) ? s.cart : [];
    });
}

/**
 * Sets active cart array and triggers state reactivity
 * @param {any[]} cart
 */
export function setActiveCart(cart) {
    return callAction('setActiveCart', [cart], (nextCart) => {
        const s = getStore();
        if (s) s.cart = nextCart;
    });
}

/**
 * Adds item to cart by ID and selected size
 * @param {string|number} id
 * @param {string} [size='']
 * @param {any} [options={}]
 */
export function addToCartById(id, size = '', options = {}) {
    return callAsyncAction('addToCartById', [id, size, options]);
}

/**
 * Adds item to cart with visual flying cart animation
 * @param {string|number} id
 * @param {MouseEvent|TouchEvent} [event]
 */
export function addToCartWithAnimation(id, event) {
    return callAsyncAction('addToCartWithAnimation', [id, event]);
}

/**
 * Removes item from cart by ID and optional size
 * @param {string|number} id
 * @param {string} [size]
 */
export function removeFromCart(id, size) {
    return callAction('removeFromCart', [id, size]);
}

/**
 * Opens cart drawer
 */
export function openCart() {
    return callAction('openCart');
}

/**
 * Opens checkout modal dialog
 */
export function openCheckoutModal() {
    return callAction('openCheckoutModal');
}

/**
 * Submits checkout order form
 * @param {FormData|Record<string, any>} formData
 * @returns {Promise<any>}
 */
export function submitOrder(formData) {
    return callAsyncAction('submitOrder', [formData]);
}

/**
 * Validates and applies promo code
 * @param {string} code
 * @returns {Promise<any>}
 */
export function applyPromoCode(code) {
    return callAsyncAction('applyPromoCode', [code]);
}

/**
 * Synchronizes cart state to server
 * @returns {Promise<void>}
 */
export function syncCartToServer() {
    return callAsyncAction('syncCartToServer');
}

/**
 * Updates cart badges, counts and total price in DOM
 */
export function updateCartUI() {
    return callAction('updateCartUI');
}

/**
 * Asynchronously retrieves cached Nova Poshta data (Memory -> IndexedDB -> Fallback)
 * @param {string} key
 * @returns {Promise<any>}
 */
export function getNPStorageAsync(key) {
    return callAsyncAction('getNPStorageAsync', [key], () => null);
}

/**
 * Synchronous fallback retrieval of Nova Poshta data
 * @param {string} key
 * @returns {any}
 */
export function getNPStorage(key) {
    return callAction('getNPStorage', [key], () => null);
}

/**
 * Saves Nova Poshta data to cache (Memory -> IndexedDB -> Fallback)
 * @param {string} key
 * @param {any} val
 * @param {number} [ttl]
 */
export function setNPStorage(key, val, ttl) {
    return callAction('setNPStorage', [key, val, ttl]);
}

/**
 * Clears Nova Poshta caches across memory, IndexedDB and sessionStorage
 * @returns {Promise<void>}
 */
export function clearNPCache() {
    return callAsyncAction('clearNPCache');
}

/**
 * Sweeps expired or corrupted Nova Poshta records from storage
 * @param {boolean} [forceAll=false]
 * @returns {Promise<{ deleted: number, checked: number, success: boolean }>}
 */
export function cleanupStaleNPCache(forceAll = false) {
    return callAsyncAction('cleanupStaleNPCache', [forceAll], () => ({
        deleted: 0,
        checked: 0,
        success: true
    }));
}

/**
 * Slims Nova Poshta branch array to minimal payload for storage
 * @param {any[]} list
 * @returns {any[]}
 */
export function slimBranches(list) {
    return callAction('slimBranches', [list], (branches) => {
        if (!Array.isArray(branches)) return [];
        return branches.map(b => ({
            Ref: b.Ref,
            Description: b.Description || '',
            TypeOfWarehouse: b.TypeOfWarehouse || '',
            Number: b.Number ? String(b.Number) : ''
        }));
    });
}

async function runWithNativeLock(lockName, fn) {
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        try {
            return await navigator.locks.request(lockName, fn);
        } catch (_) {
            return await fn();
        }
    }
    return await fn();
}

/**
 * Safely executes asynchronous cart operation with Web Locks API
 * @template T
 * @param {() => Promise<T>|T} fn
 * @returns {Promise<T>}
 */
export function withCartLock(fn) {
    return callAsyncAction('withCartLock', [fn], (taskFn) => runWithNativeLock('nisha_cart_lock', taskFn));
}

/**
 * Safely executes asynchronous checkout submission with Web Locks API
 * @template T
 * @param {() => Promise<T>|T} fn
 * @returns {Promise<T>}
 */
export function withCheckoutLock(fn) {
    return callAsyncAction('withCheckoutLock', [fn], (taskFn) => runWithNativeLock('nisha_checkout_lock', taskFn));
}
