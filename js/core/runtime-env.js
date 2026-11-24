// @ts-check
// ==========================================
// NISHA CORE — RUNTIME ENVIRONMENT ACCESSORS
// Zero-dependency helpers replacing legacy `typeof global !== 'undefined'` checks.
// ==========================================

/**
 * @param {string} name
 * @returns {any}
 */
function readRuntimeProp(name) {
    if (typeof window !== 'undefined' && window && /** @type {any} */ (window)[name] !== undefined) {
        return /** @type {any} */ (window)[name];
    }
    if (typeof globalThis !== 'undefined' && /** @type {any} */ (globalThis)[name] !== undefined) {
        return /** @type {any} */ (globalThis)[name];
    }
    return undefined;
}

/** @returns {any} */
export function getRuntimeSupabase() {
    return readRuntimeProp('_supabase') || null;
}

/** @returns {any} */
export function getRuntimeUser() {
    return readRuntimeProp('currentUser') || null;
}

/** @returns {any} */
export function getRuntimeProfile() {
    return readRuntimeProp('userProfile') || null;
}

/** @returns {Array} */
export function getRuntimeCatalog() {
    const items = readRuntimeProp('allItems');
    return Array.isArray(items) ? items : [];
}

/** @returns {any} */
export function getRuntimeOpenedItem() {
    return readRuntimeProp('currentOpenedItem') || null;
}

/** @returns {Array} */
export function getRuntimeFavorites() {
    const favs = readRuntimeProp('favorites');
    return Array.isArray(favs) ? favs : [];
}

/** @returns {string|null} */
export function getRuntimeFingerprint() {
    return readRuntimeProp('clientFingerprint') || null;
}

/** @returns {any} */
export function getRuntimeStorage() {
    return readRuntimeProp('storage') || null;
}

/** @returns {boolean} */
export function isSiteHackedMode() {
    return Boolean(readRuntimeProp('isHacked'));
}

/** @returns {any} */
export function getTurnstileApi() {
    return readRuntimeProp('turnstile') || null;
}

/** @returns {any} */
export function getLenisInstance() {
    return readRuntimeProp('lenis') || null;
}

/**
 * Escapes HTML special characters safely without requiring DOM or circular helper imports.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtmlSafe(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Escapes attribute values safely for HTML attribute interpolation.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeAttrSafe(value) {
    return escapeHtmlSafe(value).replaceAll('`', '&#96;');
}

/**
 * Safely translates an i18n key via active i18next instance with fallback string.
 * @param {string} key
 * @param {object|string} [optionsOrFallback='']
 * @param {string} [fallback='']
 * @returns {string}
 */
export function tSafe(key, optionsOrFallback = '', fallback = '') {
    const i18n = readRuntimeProp('i18next');
    const isOptsObj = optionsOrFallback !== null && typeof optionsOrFallback === 'object';
    const opts = isOptsObj ? optionsOrFallback : undefined;
    const defaultText = isOptsObj ? (optionsOrFallback.defaultValue ?? fallback) : (optionsOrFallback || fallback);
    if (i18n && typeof i18n.t === 'function') {
        const res = opts !== undefined ? i18n.t(key, opts) : i18n.t(key);
        if (res !== undefined && res !== null && res !== '') {
            return String(res);
        }
    }
    let text = String(defaultText ?? '');
    if (opts && text.includes('{{')) {
        text = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, varName) => (
            Object.hasOwn(opts, varName) && opts[varName] !== undefined && opts[varName] !== null
                ? String(opts[varName])
                : match
        ));
    }
    return text;
}

/**
 * Resolves the active UI language normalized to 'ua' | 'ru' | 'en'.
 * @returns {'ua'|'ru'|'en'}
 */
export function getRuntimeSiteLang() {
    const normalize = (val) => {
        const clean = String(val || '').trim().toLowerCase();
        if (!clean) return null;
        if (clean === 'ua' || clean === 'uk' || clean.startsWith('uk-') || clean.startsWith('ua-')) return 'ua';
        if (clean === 'ru' || clean.startsWith('ru-')) return 'ru';
        if (clean === 'en' || clean.startsWith('en-')) return 'en';
        return null;
    };

    const i18n = readRuntimeProp('i18next');
    if (i18n && i18n.language) {
        const l = normalize(i18n.language);
        if (l) return l;
    }

    const store = getRuntimeStorage();
    if (store && typeof store.get === 'function') {
        const l = normalize(store.get('nisha_lang', ''));
        if (l) return l;
    }

    try {
        if (typeof localStorage !== 'undefined') {
            const l = normalize(localStorage.getItem('nisha_lang'));
            if (l) return l;
        }
    } catch {}

    if (typeof document !== 'undefined' && document.documentElement) {
        const l = normalize(document.documentElement.lang);
        if (l) return l;
    }

    return 'ua';
}
