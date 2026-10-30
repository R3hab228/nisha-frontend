// ==========================================
// NISHA STORE - MODULAR INTERNATIONALIZATION FACADE
// Safe, typed ES module exports for multi-language support
// ==========================================

import { getStore } from './store.js';

/**
 * Returns currently selected site language code ('ru', 'en', 'uk', etc.)
 * @returns {string}
 */
export function getCurrentSiteLang() {
    if (typeof window !== 'undefined' && typeof window.getCurrentSiteLang === 'function') {
        return window.getCurrentSiteLang();
    }
    const s = getStore();
    if (s && s.lang) return s.lang;
    if (typeof window !== 'undefined' && window.i18next && window.i18next.language) {
        return window.i18next.language;
    }
    return 'ru';
}

/**
 * Switches site language, loads dictionary if needed and updates DOM
 * @param {string} lng
 * @returns {Promise<void>}
 */
export async function changeLanguage(lng) {
    if (typeof window !== 'undefined' && typeof window.changeLanguage === 'function') {
        return window.changeLanguage(lng);
    }
    const s = getStore();
    if (s) {
        s.lang = lng;
    }
}

/**
 * Ensures dictionary bundle for language is loaded in memory
 * @param {string} lng
 * @returns {Promise<void>}
 */
export async function ensureLanguageLoaded(lng) {
    if (typeof window !== 'undefined' && typeof window.ensureLanguageLoaded === 'function') {
        return window.ensureLanguageLoaded(lng);
    }
}

/**
 * Toggles dropdown menu for language selection
 * @param {Event} [event]
 */
export function toggleLangDropdown(event) {
    if (typeof window !== 'undefined' && typeof window.toggleLangDropdown === 'function') {
        return window.toggleLangDropdown(event);
    }
}

/**
 * Updates all DOM elements with data-i18n attributes
 * @param {HTMLElement|Document} [root=document]
 */
export function updateContentLanguage(root) {
    if (typeof window !== 'undefined' && typeof window.updateContentLanguage === 'function') {
        return window.updateContentLanguage(root);
    }
}

/**
 * Translates key into localized string
 * @param {string} key
 * @param {any} [options]
 * @returns {string}
 */
export function t(key, options) {
    if (typeof window !== 'undefined' && window.i18next && typeof window.i18next.t === 'function') {
        return window.i18next.t(key, options);
    }
    return key;
}
