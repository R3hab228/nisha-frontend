// ==========================================
// NISHA STORE - MODULAR CART & CHECKOUT FACADE
// Safe, typed ES module exports for cart operations
// ==========================================

import { getStore } from './store.js';

/**
 * Returns current cart array
 * @returns {any[]}
 */
export function getActiveCart() {
    if (typeof window !== 'undefined' && typeof window.getActiveCart === 'function') {
        return window.getActiveCart();
    }
    const s = getStore();
    if (s && Array.isArray(s.cart)) {
        return s.cart;
    }
    return [];
}

/**
 * Sets active cart array and triggers state reactivity
 * @param {any[]} cart
 */
export function setActiveCart(cart) {
    if (typeof window !== 'undefined' && typeof window.setActiveCart === 'function') {
        return window.setActiveCart(cart);
    }
    const s = getStore();
    if (s) {
        s.cart = cart;
    }
}

/**
 * Adds item to cart by ID and selected size
 * @param {string|number} id
 * @param {string} [size='']
 * @param {any} [options={}]
 */
export async function addToCartById(id, size = '', options = {}) {
    if (typeof window !== 'undefined' && typeof window.addToCartById === 'function') {
        return window.addToCartById(id, size, options);
    }
}

/**
 * Adds item to cart with visual flying cart animation
 * @param {string|number} id
 * @param {MouseEvent|TouchEvent} [event]
 */
export async function addToCartWithAnimation(id, event) {
    if (typeof window !== 'undefined' && typeof window.addToCartWithAnimation === 'function') {
        return window.addToCartWithAnimation(id, event);
    }
}

/**
 * Removes item from cart by ID and optional size
 * @param {string|number} id
 * @param {string} [size]
 */
export function removeFromCart(id, size) {
    if (typeof window !== 'undefined' && typeof window.removeFromCart === 'function') {
        return window.removeFromCart(id, size);
    }
}

/**
 * Opens cart drawer
 */
export function openCart() {
    if (typeof window !== 'undefined' && typeof window.openCart === 'function') {
        return window.openCart();
    }
}

/**
 * Opens checkout modal dialog
 */
export function openCheckoutModal() {
    if (typeof window !== 'undefined' && typeof window.openCheckoutModal === 'function') {
        return window.openCheckoutModal();
    }
}

/**
 * Submits checkout order form
 * @param {FormData|Record<string, any>} formData
 * @returns {Promise<any>}
 */
export async function submitOrder(formData) {
    if (typeof window !== 'undefined' && typeof window.submitOrder === 'function') {
        return window.submitOrder(formData);
    }
}

/**
 * Validates and applies promo code
 * @param {string} code
 * @returns {Promise<any>}
 */
export async function applyPromoCode(code) {
    if (typeof window !== 'undefined' && typeof window.applyPromoCode === 'function') {
        return window.applyPromoCode(code);
    }
}

/**
 * Synchronizes cart state to server
 * @returns {Promise<void>}
 */
export async function syncCartToServer() {
    if (typeof window !== 'undefined' && typeof window.syncCartToServer === 'function') {
        return window.syncCartToServer();
    }
}
