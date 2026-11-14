// ==========================================
// NISHA STORE - MODULAR PRODUCT FACADE
// Safe, typed ES module exports for product card, slider & questions
// ==========================================

import { callAction, callAsyncAction } from './_facade.js';
import { getStore } from './store.js';

/**
 * Returns currently opened item object or null
 * @returns {any}
 */
export function getCurrentOpenedItem() {
    const s = getStore();
    if (s && s.currentOpenedItem) {
        return s.currentOpenedItem;
    }
    if (typeof window !== 'undefined' && window.currentOpenedItem) {
        return window.currentOpenedItem;
    }
    return null;
}

/**
 * Opens product modal dialog with full item details
 * @param {any} item
 */
export function openProductModal(item) {
    return callAction('openProductModal', [item]);
}

/**
 * Fetches item by ID if needed and opens product modal
 * @param {string|number} id
 * @returns {Promise<any>}
 */
export function openProductModalById(id) {
    return callAsyncAction('openProductModalById', [id]);
}

/**
 * Closes product modal dialog
 */
export function closeProductModal() {
    return callAction('closeModal', ['productModal']);
}

/**
 * Shifts product gallery slider by direction (-1 / 1)
 * @param {number} direction
 */
export function moveSlide(direction) {
    return callAction('moveSlide', [direction]);
}

/**
 * Jumps product gallery slider directly to index
 * @param {number} index
 */
export function setSlide(index) {
    return callAction('setSlide', [index]);
}

/**
 * Opens fullscreen PhotoSwipe zoom viewer
 * @param {number} [index=0]
 */
export function openProductPhotoZoom(index = 0) {
    return callAction('openProductPhotoZoom', [index]);
}

/**
 * Shares product link or copies URL to clipboard
 * @param {string|number} [id]
 * @returns {Promise<boolean>}
 */
export function shareItem(id) {
    return callAsyncAction('shareItem', [id], () => false);
}

/**
 * Toggles product favorite state from inside product modal
 */
export function toggleFavFromModal() {
    return callAction('toggleFavFromModal');
}

/**
 * Adds item to user browse history
 * @param {any} item
 */
export function addToHistory(item) {
    return callAction('addToHistory', [item]);
}

/**
 * Renders browse history drawer DOM
 */
export function renderHistory() {
    return callAction('renderHistory');
}

/**
 * Removes individual item from history
 * @param {string|number} id
 */
export function removeHistoryItem(id) {
    return callAction('removeHistoryItem', [id]);
}

/**
 * Submits user question for current product
 * @param {string|number} id
 * @returns {Promise<any>}
 */
export function submitQuestion(id) {
    return callAsyncAction('submitQuestion', [id]);
}

/**
 * Loads Q&A section questions from database for item
 * @param {string|number} id
 * @returns {Promise<any[]>}
 */
export function loadItemQuestions(id) {
    return callAsyncAction('loadItemQuestions', [id], () => []);
}

/**
 * Speculatively pre-warms product modal data, images and PhotoSwipe
 * @param {string|number} id
 * @param {boolean} [immediate=false]
 */
export function prewarmProductModal(id, immediate = false) {
    return callAction('prewarmProductModal', [id, immediate]);
}

/**
 * Cancels pending pre-warm debounce when cursor leaves card
 * @param {string|number} id
 */
export function cancelPrewarmProductModal(id) {
    return callAction('cancelPrewarmProductModal', [id]);
}
