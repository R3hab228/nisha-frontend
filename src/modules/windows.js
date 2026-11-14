// ==========================================
// NISHA STORE - MODULAR WINDOWS & MODALS FACADE
// Safe, typed ES module exports for modal dialogs & drawers
// ==========================================

import { callAction } from './_facade.js';

const _modularModalInits = new Map();

/**
 * Triggers typewriter animation on modal title elements (1-to-1 with ITEM_INFO.EXE)
 * @param {HTMLElement|string} modalOrId
 */
export function triggerModalTypewriter(modalOrId) {
    return callAction('triggerModalTypewriter', [modalOrId], (target) => {
        if (!target) return;
        const modal = typeof target === 'string'
            ? (typeof document !== 'undefined' && document.getElementById ? document.getElementById(target) : null)
            : target;
        if (!modal) return;

        const twElements = [];
        if (modal.classList && typeof modal.classList.contains === 'function' && modal.classList.contains('typewriter')) {
            twElements.push(modal);
        } else if (typeof modal.querySelectorAll === 'function') {
            try {
                modal.querySelectorAll('.typewriter').forEach(el => twElements.push(el));
            } catch {}
        } else if (typeof modal.querySelector === 'function') {
            try {
                const single = modal.querySelector('.typewriter');
                if (single) twElements.push(single);
            } catch {}
        }

        twElements.forEach(tw => {
            if (!tw || !tw.style) return;
            tw.style.animation = 'none';
            void tw.offsetHeight;
            tw.style.animation = '';
        });
    });
}

/**
 * Opens modal dialog by container ID
 * @param {string} modalId
 * @param {any} [options]
 */
export function openModal(modalId, options) {
    return callAction('openModal', [modalId, options], (id) => {
        const initFn = _modularModalInits.get(id);
        if (typeof initFn === 'function') {
            _modularModalInits.delete(id);
            try { initFn(); } catch {}
        }
        if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
            const el = document.getElementById(id);
            if (el) {
                if (el.classList && typeof el.classList.add === 'function') el.classList.add('is-open');
                if (el.style) {
                    el.style.display = 'flex';
                    el.style.pointerEvents = '';
                }
                triggerModalTypewriter(el);
            }
        }
    });
}

/**
 * Closes modal dialog by container ID
 * @param {string} [modalId]
 */
export function closeModal(modalId) {
    return callAction('closeModal', [modalId], (id) => executeCloseModal(id));
}

/**
 * Immediately executes closing logic without animation delay
 * @param {string} modalId
 */
export function executeCloseModal(modalId) {
    return callAction('executeCloseModal', [modalId], (id) => {
        if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
            const el = document.getElementById(id);
            if (el) {
                if (el.classList && typeof el.classList.remove === 'function') el.classList.remove('is-open');
                if (el.style) el.style.display = 'none';
            }
        }
    });
}

/**
 * Registers lazy initializer callback for specific modal dialog
 * @param {string} modalId
 * @param {() => void} initFn
 */
export function registerModalInitializer(modalId, initFn) {
    return callAction('registerModalInitializer', [modalId, initFn], (id, fn) => {
        if (typeof fn === 'function') {
            _modularModalInits.set(id, fn);
        }
    });
}

/**
 * Opens support chat dialog
 */
export function openSupportModalWindow() {
    return callAction('openSupportModalWindow');
}

/**
 * Checks whether DOM element is visible in viewport
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isElementVisible(element) {
    return callAction('isElementVisible', [element], () => false);
}

/**
 * Determines whether user is currently looking at product catalog feed
 * @returns {boolean}
 */
export function isUserInProductFeed() {
    return callAction('isUserInProductFeed', [], () => false);
}

/**
 * Displays branded terminal/system dialog
 * @param {string} title
 * @param {string} text
 * @param {'info'|'warning'|'error'|'success'} [type='info']
 * @param {(() => void)|null} [onConfirm=null]
 */
export function showTerminalModal(title, text, type = 'info', onConfirm = null) {
    return callAction('showTerminalModal', [title, text, type, onConfirm]);
}

/**
 * Displays terminal dialog with confirm & cancel actions
 * @param {string} title
 * @param {string} text
 * @param {(() => void)|null} [onConfirm=null]
 * @param {(() => void)|null} [onCancel=null]
 */
export function showConfirmTerminalModal(title, text, onConfirm = null, onCancel = null) {
    return callAction('showConfirmTerminalModal', [title, text, onConfirm, onCancel]);
}

/**
 * Ensures active input field remains visible without bounce or layout jump
 * @param {HTMLElement} targetEl
 */
export function ensureFieldVisibleInModal(targetEl) {
    return callAction('ensureFieldVisibleInModal', [targetEl]);
}

/**
 * Initializes mobile keyboard viewport adaptation
 */
export function initMobileKeyboardViewport() {
    return callAction('initMobileKeyboardViewport');
}
