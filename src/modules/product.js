// ==========================================
// NISHA STORE - MODULAR PRODUCT FACADE
// Safe, typed ES module exports for product card, slider & questions
// ==========================================

/**
 * Returns currently opened item object or null
 * @returns {any}
 */
export function getCurrentOpenedItem() {
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
    if (typeof window !== 'undefined' && typeof window.openProductModal === 'function') {
        return window.openProductModal(item);
    }
}

/**
 * Fetches item by ID if needed and opens product modal
 * @param {string|number} id
 * @returns {Promise<any>}
 */
export async function openProductModalById(id) {
    if (typeof window !== 'undefined' && typeof window.openProductModalById === 'function') {
        return window.openProductModalById(id);
    }
}

/**
 * Closes product modal dialog
 */
export function closeProductModal() {
    if (typeof window !== 'undefined' && typeof window.closeModal === 'function') {
        return window.closeModal('productModal');
    }
}

/**
 * Shifts product gallery slider by direction (-1 / 1)
 * @param {number} direction
 */
export function moveSlide(direction) {
    if (typeof window !== 'undefined' && typeof window.moveSlide === 'function') {
        return window.moveSlide(direction);
    }
}

/**
 * Jumps product gallery slider directly to index
 * @param {number} index
 */
export function setSlide(index) {
    if (typeof window !== 'undefined' && typeof window.setSlide === 'function') {
        return window.setSlide(index);
    }
}

/**
 * Opens fullscreen PhotoSwipe zoom viewer
 * @param {number} [index=0]
 */
export function openProductPhotoZoom(index = 0) {
    if (typeof window !== 'undefined' && typeof window.openProductPhotoZoom === 'function') {
        return window.openProductPhotoZoom(index);
    }
}

/**
 * Shares product link or copies URL to clipboard
 * @param {string|number} [id]
 * @returns {Promise<boolean>}
 */
export async function shareItem(id) {
    if (typeof window !== 'undefined' && typeof window.shareItem === 'function') {
        return window.shareItem(id);
    }
    return false;
}

/**
 * Toggles product favorite state from inside product modal
 */
export function toggleFavFromModal() {
    if (typeof window !== 'undefined' && typeof window.toggleFavFromModal === 'function') {
        return window.toggleFavFromModal();
    }
}

/**
 * Adds item to user browse history
 * @param {any} item
 */
export function addToHistory(item) {
    if (typeof window !== 'undefined' && typeof window.addToHistory === 'function') {
        return window.addToHistory(item);
    }
}

/**
 * Renders browse history drawer DOM
 */
export function renderHistory() {
    if (typeof window !== 'undefined' && typeof window.renderHistory === 'function') {
        return window.renderHistory();
    }
}

/**
 * Removes individual item from history
 * @param {string|number} id
 */
export function removeHistoryItem(id) {
    if (typeof window !== 'undefined' && typeof window.removeHistoryItem === 'function') {
        return window.removeHistoryItem(id);
    }
}

/**
 * Submits user question for current product
 * @param {string|number} id
 * @returns {Promise<any>}
 */
export async function submitQuestion(id) {
    if (typeof window !== 'undefined' && typeof window.submitQuestion === 'function') {
        return window.submitQuestion(id);
    }
}

/**
 * Loads Q&A section questions from database for item
 * @param {string|number} id
 * @returns {Promise<any[]>}
 */
export async function loadItemQuestions(id) {
    if (typeof window !== 'undefined' && typeof window.loadItemQuestions === 'function') {
        return window.loadItemQuestions(id);
    }
    return [];
}
