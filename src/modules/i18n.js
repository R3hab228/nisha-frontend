// ==========================================
// NISHA STORE - MODULAR INTERNATIONALIZATION FACADE
// Safe, typed ES module exports for multi-language support
// ==========================================

import { callAction, callAsyncAction } from './_facade.js';
import { getStore } from './store.js';

export const NISHA_FLAGS = {
    ua: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 18'%3E%3Crect width='24' height='9' fill='%230057B7'/%3E%3Crect y='9' width='24' height='9' fill='%23FFD700'/%3E%3C/svg%3E",
    ru: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 18'%3E%3Crect width='24' height='6' fill='%23FFFFFF'/%3E%3Crect y='6' width='24' height='6' fill='%230039A6'/%3E%3Crect y='12' width='24' height='6' fill='%23D52B1E'/%3E%3C/svg%3E",
    en: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 18'%3E%3CclipPath id='s'%3E%3Cpath d='M0,0 v18 h24 v-18 z'/%3E%3C/clipPath%3E%3Cpath d='M0,0 L24,18 M24,0 L0,18' stroke='%23fff' stroke-width='3' clip-path='url(%23s)'/%3E%3Cpath d='M0,0 L24,18 M24,0 L0,18' stroke='%23C8102E' stroke-width='1.5' clip-path='url(%23s)'/%3E%3Cpath d='M12,0 v18 M0,9 h24' stroke='%23fff' stroke-width='5'/%3E%3Cpath d='M12,0 v18 M0,9 h24' stroke='%23C8102E' stroke-width='3'/%3E%3C/svg%3E"
};

export const NISHA_EMOJI_FLAGS = {
    ua: '🇺🇦',
    ru: '🇷🇺',
    en: '🇬🇧'
};

/**
 * Normalizes language string to supported canonical codes ('ua', 'ru', 'en')
 * @param {string} [lang]
 * @returns {'ua'|'ru'|'en'}
 */
export function normalizeSiteLang(lang) {
    return callAction('normalizeSiteLang', [lang], (rawLang) => {
        if (!rawLang || typeof rawLang !== 'string') return 'ua';
        const clean = rawLang.trim().toLowerCase().substring(0, 2);
        if (clean === 'ru') return 'ru';
        if (clean === 'en') return 'en';
        return 'ua';
    });
}

/**
 * Returns SVG data URI flag for given language
 * @param {string} [lang]
 * @returns {string}
 */
export function getFlagUrlByLang(lang) {
    return callAction('getFlagUrlByLang', [lang], (rawLang) => {
        const code = normalizeSiteLang(rawLang);
        return NISHA_FLAGS[code] || NISHA_FLAGS.ua;
    });
}

/**
 * Detects initial site language based on saved settings or browser locale
 * @returns {'ua'|'ru'|'en'}
 */
export function detectInitialSiteLang() {
    return callAction('detectInitialSiteLang', [], () => {
        const s = getStore();
        if (s && s.lang) return normalizeSiteLang(s.lang);
        if (typeof navigator !== 'undefined') {
            const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
            if (nav.startsWith('ru')) return 'ru';
            if (nav.startsWith('en')) return 'en';
            if (nav.startsWith('uk')) return 'ua';
        }
        return 'ua';
    });
}

/**
 * Updates footer language switcher UI (flag img, label, dropdown active states)
 * @param {string} [lang]
 */
export function updateFooterLanguageUI(lang) {
    return callAction('updateFooterLanguageUI', [lang], (rawLang) => {
        const code = normalizeSiteLang(rawLang);
        const upper = code.toUpperCase();
        const flagUrl = getFlagUrlByLang(code);

        if (typeof document === 'undefined') return;

        const flagImg = document.getElementById('currentFlagImg');
        if (flagImg) {
            flagImg.src = flagUrl;
            flagImg.alt = upper;
        }

        const labelFooter = document.getElementById('currentLangLabelFooter');
        if (labelFooter) {
            const span = labelFooter.querySelector('span');
            if (span) {
                span.textContent = `[${upper}] ▼`;
            }
        }

        const menuLinks = document.querySelectorAll('.footer-lang-menu a[data-lang]');
        menuLinks.forEach(link => {
            const itemLang = normalizeSiteLang(link.getAttribute('data-lang'));
            if (itemLang === code) {
                link.classList.add('active');
                link.setAttribute('aria-selected', 'true');
            } else {
                link.classList.remove('active');
                link.setAttribute('aria-selected', 'false');
            }
        });

        if (document.documentElement) {
            document.documentElement.lang = (code === 'ua' ? 'uk' : code);
        }
    });
}

/**
 * Returns currently selected site language code ('ru', 'en', 'uk', etc.)
 * @returns {string}
 */
export function getCurrentSiteLang() {
    return callAction('getCurrentSiteLang', [], () => {
        const s = getStore();
        if (s && s.lang) return s.lang;
        if (typeof window !== 'undefined' && window.i18next && window.i18next.language) {
            return window.i18next.language;
        }
        return 'ua';
    });
}

/**
 * Switches site language, loads dictionary if needed and updates DOM
 * @param {string} lng
 * @returns {Promise<void>}
 */
export function changeLanguage(lng) {
    return callAsyncAction('changeLanguage', [lng], (langCode) => {
        const s = getStore();
        if (s) s.lang = langCode;
    });
}

/**
 * Ensures dictionary bundle for language is loaded in memory
 * @param {string} lng
 * @returns {Promise<void>}
 */
export function ensureLanguageLoaded(lng) {
    return callAsyncAction('ensureLanguageLoaded', [lng]);
}

/**
 * Toggles dropdown menu for language selection
 * @param {Event} [event]
 */
export function toggleLangDropdown(event) {
    return callAction('toggleLangDropdown', [event]);
}

/**
 * Updates all DOM elements with data-i18n attributes
 * @param {HTMLElement|Document} [root=document]
 */
export function updateContentLanguage(root) {
    return callAction('updateContentLanguage', [root]);
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
