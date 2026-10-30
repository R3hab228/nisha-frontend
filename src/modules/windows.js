// ==========================================
// NISHA STORE - MODULAR WINDOWS & MODALS FACADE
// Safe, typed ES module exports for modal dialogs & drawers
// ==========================================

/**
 * Opens modal dialog by container ID
 * @param {string} modalId
 * @param {any} [options]
 */
export function openModal(modalId, options) {
    if (typeof window !== 'undefined' && typeof window.openModal === 'function') {
        return window.openModal(modalId, options);
    }
}

/**
 * Closes modal dialog by container ID
 * @param {string} [modalId]
 */
export function closeModal(modalId) {
    if (typeof window !== 'undefined' && typeof window.closeModal === 'function') {
        return window.closeModal(modalId);
    }
}

/**
 * Immediately executes closing logic without animation delay
 * @param {string} modalId
 */
export function executeCloseModal(modalId) {
    if (typeof window !== 'undefined' && typeof window.executeCloseModal === 'function') {
        return window.executeCloseModal(modalId);
    }
}


/**
 * Opens support chat dialog
 */
export function openSupportModalWindow() {
    if (typeof window !== 'undefined' && typeof window.openSupportModalWindow === 'function') {
        return window.openSupportModalWindow();
    }
}

/**
 * Checks whether DOM element is visible in viewport
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isElementVisible(element) {
    if (typeof window !== 'undefined' && typeof window.isElementVisible === 'function') {
        return window.isElementVisible(element);
    }
    return false;
}

/**
 * Determines whether user is currently looking at product catalog feed
 * @returns {boolean}
 */
export function isUserInProductFeed() {
    if (typeof window !== 'undefined' && typeof window.isUserInProductFeed === 'function') {
        return window.isUserInProductFeed();
    }
    return false;
}

/**
 * Displays branded terminal/system dialog
 * @param {string} title
 * @param {string} text
 * @param {'info'|'warning'|'error'|'success'} [type='info']
 * @param {(() => void)|null} [onConfirm=null]
 */
export function showTerminalModal(title, text, type = 'info', onConfirm = null) {
    if (typeof window !== 'undefined' && typeof window.showTerminalModal === 'function') {
        return window.showTerminalModal(title, text, type, onConfirm);
    }
}

/**
 * Displays terminal dialog with confirm & cancel actions
 * @param {string} title
 * @param {string} text
 * @param {(() => void)|null} [onConfirm=null]
 * @param {(() => void)|null} [onCancel=null]
 */
export function showConfirmTerminalModal(title, text, onConfirm = null, onCancel = null) {
    if (typeof window !== 'undefined' && typeof window.showConfirmTerminalModal === 'function') {
        return window.showConfirmTerminalModal(title, text, onConfirm, onCancel);
    }
}
