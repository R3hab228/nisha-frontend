// ==========================================
// NISHA STORE - MODULAR WINDOWS & MODALS FACADE
// Safe, typed ES module exports for modal dialogs & drawers
// ==========================================

const _modularModalInits = new Map();

/**
 * Opens modal dialog by container ID
 * @param {string} modalId
 * @param {any} [options]
 */
export function openModal(modalId, options) {
    if (typeof window !== 'undefined' && typeof window.openModal === 'function') {
        return window.openModal(modalId, options);
    }
    const initFn = _modularModalInits.get(modalId);
    if (typeof initFn === 'function') {
        _modularModalInits.delete(modalId);
        try { initFn(); } catch (_) {}
    }
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
        const el = document.getElementById(modalId);
        if (el) {
            if (el.classList && typeof el.classList.add === 'function') el.classList.add('is-open');
            if (el.style) el.style.display = 'flex';
        }
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
    return executeCloseModal(modalId);
}

/**
 * Immediately executes closing logic without animation delay
 * @param {string} modalId
 */
export function executeCloseModal(modalId) {
    if (typeof window !== 'undefined' && typeof window.executeCloseModal === 'function') {
        return window.executeCloseModal(modalId);
    }
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
        const el = document.getElementById(modalId);
        if (el) {
            if (el.classList && typeof el.classList.remove === 'function') el.classList.remove('is-open');
            if (el.style) el.style.display = 'none';
        }
    }
}

/**
 * Registers lazy initializer callback for specific modal dialog
 * @param {string} modalId
 * @param {() => void} initFn
 */
export function registerModalInitializer(modalId, initFn) {
    if (typeof window !== 'undefined' && typeof window.registerModalInitializer === 'function') {
        return window.registerModalInitializer(modalId, initFn);
    }
    if (typeof initFn === 'function') {
        _modularModalInits.set(modalId, initFn);
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
