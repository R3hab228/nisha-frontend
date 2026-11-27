// @ts-check
// ==========================================
// NISHA STORE - MODULAR CORE HELPERS FACADE
// Thin ES module facade delegating directly to js/core/helpers-*.js
// ==========================================

import { callAction, callAsyncAction, resolveAction } from './_facade.js';
import {
    safeEncodeURIComponent,
    yieldToMain as coreYieldToMain,
    isSchedulerYieldSupported as coreIsSchedulerYieldSupported,
    isCompressionStreamSupported as coreIsCompressionStreamSupported,
    compressString as coreCompressString,
    decompressString as coreDecompressString,
    compressJSON as coreCompressJSON,
    decompressJSON as coreDecompressJSON,
    getCurrency as coreGetCurrency,
    formatPrice as coreFormatPrice,
    generateShortId as coreGenerateShortId,
    cachedPriceNumberFormatter
} from '../../js/core/helpers-core-utils.js';

export * from '../../js/core/action-registry.js';
export {
    canParseURL,
    toWellFormed,
    isWellFormed,
    safeEncodeURIComponent,
    getGraphemeSegmenter,
    safeTruncateText,
    getGraphemeCount,
    combineAbortSignals,
    runMicrotask,
    getLastItem,
    getFirstItem,
    getUserDisplayName,
    clamp,
    deepClone,
    toSorted,
    toReversed,
    at,
    hasOwn,
    sleep,
    withWebLock,
    setDifference,
    setIntersection,
    setUnion,
    setIsSubsetOf,
    escapeRegExp,
    isErrorLike,
    promiseTry,
    base64ToBytes,
    bytesToBase64
} from '../../js/core/helpers-core-utils.js';

export {
    getOptimizedCDNImageUrl,
    getImageSrcSet,
    escapeHtml,
    escapeAttr,
    escapeJsString,
    sanitizeText,
    sanitizeCssMediaUrl
} from '../../js/core/helpers-security-media.js';

export {
    parseDeliveryAddress,
    parsePriceSearchQuery,
    itemMatchesPrice
} from '../../js/core/helpers-search-address.js';

export {
    isSaveDataMode,
    initNetworkAwareRendering,
    isAppBadgingSupported,
    updateAppBadge,
    clearAppBadge,
    triggerVibration,
    triggerHaptic,
    isPopoverSupported,
    showPopoverSafe,
    hidePopoverSafe,
    togglePopoverSafe,
    isPopoverOpenSafe,
    isScrollDrivenAnimationSupported,
    copyToClipboard,
    shareContent,
    isViewTransitionAbortError,
    safeViewTransition
} from '../../js/core/helpers-pwa-browser.js';

/**
 * Checks if browser supports Speculation Rules API for instant 0ms prefetching/prerendering.
 * @returns {boolean}
 */
export function isSpeculationRulesSupported() {
    return typeof HTMLScriptElement !== 'undefined' &&
           typeof HTMLScriptElement.supports === 'function' &&
           HTMLScriptElement.supports('speculationrules');
}

/**
 * Cooperative Task Scheduling (scheduler.yield() with MessageChannel fallback).
 * @returns {Promise<void>}
 */
export async function yieldToMain() {
    return coreYieldToMain();
}

/**
 * Checks if browser natively supports scheduler.yield().
 * @returns {boolean}
 */
export function isSchedulerYieldSupported() {
    return coreIsSchedulerYieldSupported();
}

/**
 * Checks if browser natively supports Compression Streams API (gzip/deflate).
 * @returns {boolean}
 */
export function isCompressionStreamSupported() {
    return coreIsCompressionStreamSupported();
}

/**
 * @param {string} str
 * @param {'gzip' | 'deflate' | 'deflate-raw'} [format='gzip']
 */
export async function compressString(str, format = 'gzip') {
    return coreCompressString(str, format);
}

/**
 * @param {any} data
 * @param {'gzip' | 'deflate' | 'deflate-raw'} [format='gzip']
 */
export async function decompressString(data, format = 'gzip') {
    return coreDecompressString(data, format);
}

/**
 * @param {any} obj
 * @param {'gzip' | 'deflate' | 'deflate-raw'} [format='gzip']
 */
export async function compressJSON(obj, format = 'gzip') {
    return coreCompressJSON(obj, format);
}

/**
 * @param {any} data
 * @param {'gzip' | 'deflate' | 'deflate-raw'} [format='gzip']
 */
export async function decompressJSON(data, format = 'gzip') {
    return coreDecompressJSON(data, format);
}

/**
 * Rewrites Supabase asset URL to Worker CDN URL with optional transform query params.
 * @param {string} url
 * @param {object} [options={}]
 * @returns {string}
 */
export function toCDN(url, options = {}) {
    return callAction('toCDN', [url, options], (rawUrl, opts = {}) => {
        if (!rawUrl || typeof rawUrl !== 'string') return '';
        let result = rawUrl.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://cdn.nisha-store.shop');
        if (!opts || typeof opts !== 'object' || Object.keys(opts).length === 0) {
            return result;
        }
        if (result.endsWith('.mp4') || result.endsWith('.webm') || result.endsWith('.svg')) {
            return result;
        }
        const isThumb = opts.isThumb === true || (typeof opts.width === 'number' && opts.width <= 480);
        if (isThumb && result.includes('/items-images/item_') && !result.includes('/items-images/thumb_item_')) {
            result = result.replace('/items-images/item_', '/items-images/thumb_item_');
        }
        const width = opts.width || opts.w;
        const height = opts.height || opts.h;
        const quality = opts.quality || opts.q;
        const format = opts.format || opts.fmt;
        if (width || height || quality || format) {
            const sep = result.includes('?') ? '&' : '?';
            const params = [];
            if (width) params.push(`w=${safeEncodeURIComponent(width)}`);
            if (height) params.push(`h=${safeEncodeURIComponent(height)}`);
            if (quality) params.push(`q=${safeEncodeURIComponent(quality)}`);
            if (format) params.push(`fmt=${safeEncodeURIComponent(format)}`);
            result += sep + params.join('&');
        }
        return result;
    });
}

/**
 * Returns current store currency symbol (e.g. ₴).
 * @returns {string}
 */
export function getCurrency() {
    const custom = resolveAction('getCurrency', 'getCurrency');
    if (typeof custom === 'function' && custom !== coreGetCurrency) {
        return custom();
    }
    return '₴';
}

/**
 * Displays a non-blocking toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'gold'} [type='success']
 * @param {string|null} [imgUrl=null]
 * @param {(() => void)|null} [onClick=null]
 */
export function showToast(message, type = 'success', imgUrl = null, onClick = null) {
    return callAction('showToast', [message, type, imgUrl, onClick]);
}

/**
 * Formats numeric price into localized string with currency or options object.
 * @param {number|string} price
 * @param {string|object} [currencyOrOptions='₴']
 * @returns {string}
 */
export function formatPrice(price, currencyOrOptions) {
    if (typeof currencyOrOptions === 'string') {
        const cleanNum = typeof price === 'number'
            ? price
            : Number(String(price || 0).replace(/[^\d.-]/g, '')) || 0;
        const rounded = Math.round(cleanNum);
        const formatted = cachedPriceNumberFormatter
            ? cachedPriceNumberFormatter.format(rounded)
            : rounded.toLocaleString('en-US', { maximumFractionDigits: 0 });
        return `${formatted} ${currencyOrOptions}`;
    }
    const custom = resolveAction('formatPrice', 'formatPrice');
    if (typeof custom === 'function' && custom !== formatPrice) {
        return custom(price, currencyOrOptions);
    }
    return coreFormatPrice(price, currencyOrOptions);
}

/**
 * Generates random short unique identifier with optional prefix.
 * @param {string} [prefix='id']
 * @returns {string}
 */
export function generateShortId(prefix = 'id') {
    const customGen = resolveAction('generateShortId', 'generateShortId');
    if (typeof customGen === 'function') {
        return `${prefix}_${customGen(8)}`;
    }
    return `${prefix}_${coreGenerateShortId(8)}`;
}

/**
 * Safe localStorage wrapper proxy delegating to window.storage.
 * @type {any}
 */
export const storage = new Proxy(/** @type {any} */ ({}), {
    get(_target, prop) {
        if (typeof window !== 'undefined' && window.storage) {
            const val = /** @type {any} */ (window.storage)[prop];
            return typeof val === 'function' ? val.bind(window.storage) : val;
        }
        return undefined;
    },
    set(_target, prop, value) {
        if (typeof window !== 'undefined' && window.storage) {
            /** @type {any} */ (window.storage)[prop] = value;
            return true;
        }
        return false;
    },
    has(_target, prop) {
        if (typeof window !== 'undefined' && window.storage) {
            return prop in window.storage;
        }
        return false;
    }
});

/**
 * Safe persistent storage proxy delegating to window.safeStorage.
 * @type {any}
 */
export const safeStorage = new Proxy(/** @type {any} */ ({}), {
    get(_target, prop) {
        if (typeof window !== 'undefined' && window.safeStorage) {
            const val = /** @type {any} */ (window.safeStorage)[prop];
            return typeof val === 'function' ? val.bind(window.safeStorage) : val;
        }
        return undefined;
    },
    set(_target, prop, value) {
        if (typeof window !== 'undefined' && window.safeStorage) {
            /** @type {any} */ (window.safeStorage)[prop] = value;
            return true;
        }
        return false;
    },
    has(_target, prop) {
        if (typeof window !== 'undefined' && window.safeStorage) {
            return prop in window.safeStorage;
        }
        return false;
    }
});

// Keep callAsyncAction reference used cleanly if needed by tree-shakers
void callAsyncAction;
