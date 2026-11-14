// ==========================================
// NISHA CORE — RUNTIME ENVIRONMENT ACCESSORS
// Zero-dependency helpers replacing legacy `typeof global !== 'undefined'` checks.
// ==========================================

function readRuntimeProp(name) {
    if (typeof window !== 'undefined' && window && window[name] !== undefined) {
        return window[name];
    }
    if (typeof globalThis !== 'undefined' && globalThis[name] !== undefined) {
        return globalThis[name];
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
    return String(defaultText ?? '');
}
