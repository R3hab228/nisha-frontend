// ==========================================
// NISHA STORE - MODULAR CORE HELPERS FACADE
// Safe, typed ES module exports for utilities & sanitization
// ==========================================

/**
 * Rewrites Supabase asset URL to Worker CDN URL
 * @param {string} url
 * @returns {string}
 */
/**
 * Checks if browser supports Speculation Rules API for instant 0ms prefetching/prerendering
 * @returns {boolean}
 */
export function isSpeculationRulesSupported() {
    return typeof HTMLScriptElement !== 'undefined' &&
           typeof HTMLScriptElement.supports === 'function' &&
           HTMLScriptElement.supports('speculationrules');
}

// Polyfill Promise.withResolvers (ES2024) if not natively present
if (typeof Promise !== 'undefined' && typeof Promise.withResolvers !== 'function') {
    Promise.withResolvers = function() {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

/**
 * Modern URL validator (ES2024 URL.canParse with safe fallback)
 * @param {string} url
 * @param {string} [base]
 * @returns {boolean}
 */
export function canParseURL(url, base) {
    if (!url || typeof url !== 'string') return false;
    if (typeof URL !== 'undefined' && typeof URL.canParse === 'function') {
        try {
            return base !== undefined ? URL.canParse(url, base) : URL.canParse(url);
        } catch (_) {
            return false;
        }
    }
    try {
        if (base !== undefined) new URL(url, base);
        else new URL(url);
        return true;
    } catch (_) {
        return false;
    }
}
if (typeof window !== 'undefined') window.canParseURL = canParseURL;
if (typeof globalThis !== 'undefined') globalThis.canParseURL = canParseURL;

/**
 * Modern String validator & sanitizer (ES2024 String.prototype.toWellFormed & isWellFormed)
 * Guarantees no lone surrogates that cause URIError in encodeURIComponent
 * @param {*} str
 * @returns {string}
 */
export function toWellFormed(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    if (typeof s.toWellFormed === 'function') {
        return s.toWellFormed();
    }
    return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
}
if (typeof window !== 'undefined') window.toWellFormed = toWellFormed;
if (typeof globalThis !== 'undefined') globalThis.toWellFormed = toWellFormed;

export function isWellFormed(str) {
    if (str === null || str === undefined) return true;
    const s = String(str);
    if (typeof s.isWellFormed === 'function') {
        return s.isWellFormed();
    }
    return !(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s));
}
if (typeof window !== 'undefined') window.isWellFormed = isWellFormed;
if (typeof globalThis !== 'undefined') globalThis.isWellFormed = isWellFormed;

/**
 * Exception-free URI encoder using ES2024 toWellFormed
 * @param {*} str
 * @returns {string}
 */
export function safeEncodeURIComponent(str) {
    try {
        return encodeURIComponent(toWellFormed(str));
    } catch (_) {
        return '';
    }
}
if (typeof window !== 'undefined') window.safeEncodeURIComponent = safeEncodeURIComponent;
if (typeof globalThis !== 'undefined') globalThis.safeEncodeURIComponent = safeEncodeURIComponent;

/**
 * Grapheme-safe text segmentation and truncation (Intl.Segmenter Baseline 2023/2024)
 * Guarantees that compound emojis (e.g. 🇺🇦, 🔥, 👕, 👨‍👩‍👧‍👦) and accented characters are never severed
 */
let _cachedGraphemeSegmenter = null;
export function getGraphemeSegmenter(locale = 'uk') {
    if (!_cachedGraphemeSegmenter && typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
        try {
            _cachedGraphemeSegmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });
        } catch (_) {
            _cachedGraphemeSegmenter = null;
        }
    }
    return _cachedGraphemeSegmenter;
}
if (typeof window !== 'undefined') window.getGraphemeSegmenter = getGraphemeSegmenter;
if (typeof globalThis !== 'undefined') globalThis.getGraphemeSegmenter = getGraphemeSegmenter;

export function safeTruncateText(text, maxGraphemes, suffix = '') {
    if (!text) return '';
    const str = toWellFormed(text);
    if (maxGraphemes <= 0) return suffix;

    const segmenter = getGraphemeSegmenter();
    if (segmenter) {
        try {
            const segments = Array.from(segmenter.segment(str));
            if (segments.length <= maxGraphemes) return str;
            return segments.slice(0, maxGraphemes).map(s => s.segment).join('') + suffix;
        } catch {}
    }
    const chars = Array.from(str);
    if (chars.length <= maxGraphemes) return str;
    return chars.slice(0, maxGraphemes).join('') + suffix;
}
if (typeof window !== 'undefined') window.safeTruncateText = safeTruncateText;
if (typeof globalThis !== 'undefined') globalThis.safeTruncateText = safeTruncateText;

export function getGraphemeCount(text) {
    if (!text) return 0;
    const str = toWellFormed(text);
    const segmenter = getGraphemeSegmenter();
    if (segmenter) {
        try {
            let count = 0;
            for (const _ of segmenter.segment(str)) count++;
            return count;
        } catch {}
    }
    return Array.from(str).length;
}
if (typeof window !== 'undefined') window.getGraphemeCount = getGraphemeCount;
if (typeof globalThis !== 'undefined') globalThis.getGraphemeCount = getGraphemeCount;

/**
 * Combines multiple AbortSignals into one (ES2024 AbortSignal.any with fallback)
 * @param {Array<AbortSignal|null|undefined>} signals
 * @returns {AbortSignal|null}
 */
export function combineAbortSignals(signals) {
    const validSignals = (signals || []).filter(Boolean);
    if (validSignals.length === 0) return null;
    if (validSignals.length === 1) return validSignals[0];
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
        try {
            return AbortSignal.any(validSignals);
        } catch {}
    }
    const controller = new AbortController();
    for (const sig of validSignals) {
        if (sig.aborted) {
            controller.abort(sig.reason);
            return controller.signal;
        }
        sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
    }
    return controller.signal;
}
if (typeof window !== 'undefined') window.combineAbortSignals = combineAbortSignals;
if (typeof globalThis !== 'undefined') globalThis.combineAbortSignals = combineAbortSignals;

/**
 * Cooperative Task Scheduling (scheduler.yield() with fallback)
 * Yields execution to the browser main thread to process high-priority input, touch, and animations (Zero INP)
 * @returns {Promise<void>}
 */
export async function yieldToMain() {
    if (typeof globalThis.scheduler !== 'undefined' && typeof globalThis.scheduler.yield === 'function') {
        try {
            return await globalThis.scheduler.yield();
        } catch (_) {
            // fallback if scheduler.yield rejects or is aborted
        }
    }
    const { promise, resolve } = Promise.withResolvers();
    if (typeof MessageChannel !== 'undefined') {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
            try {
                channel.port1.close();
                channel.port2.close();
            } catch {}
            resolve();
        };
        channel.port2.postMessage(null);
    } else {
        setTimeout(resolve, 0);
    }
    return promise;
}

/**
 * Checks if browser natively supports scheduler.yield()
 * @returns {boolean}
 */
export function isSchedulerYieldSupported() {
    return typeof globalThis.scheduler !== 'undefined' && typeof globalThis.scheduler.yield === 'function';
}

/**
 * Detects whether client has Data Saver enabled or is on a 2G/constrained network
 * @returns {boolean}
 */
export function isSaveDataMode() {
    if (typeof navigator === 'undefined') return false;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return false;
    if (conn.saveData === true) return true;
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return true;
    return false;
}

/**
 * Automatically attaches or updates save-data CSS class on document element
 */
export function initNetworkAwareRendering() {
    if (typeof document === 'undefined' || typeof navigator === 'undefined') return;
    const update = () => {
        const active = isSaveDataMode();
        if (active) {
            if (document.documentElement.classList && typeof document.documentElement.classList.add === 'function') {
                document.documentElement.classList.add('save-data-active');
            }
            if (typeof document.documentElement.setAttribute === 'function') {
                document.documentElement.setAttribute('data-save-data', 'true');
            }
        } else {
            if (document.documentElement.classList && typeof document.documentElement.classList.remove === 'function') {
                document.documentElement.classList.remove('save-data-active');
            }
            if (typeof document.documentElement.removeAttribute === 'function') {
                document.documentElement.removeAttribute('data-save-data');
            }
        }
    };
    update();
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && typeof conn.addEventListener === 'function' && !conn._hasSaveDataListener) {
        conn.addEventListener('change', update, { passive: true });
        conn._hasSaveDataListener = true;
    }
}

/**
 * Checks if browser natively supports Compression Streams API (gzip/deflate)
 * @returns {boolean}
 */

/**
 * Checks if browser supports the Badging API (PWA / Installed Desktop & Mobile)
 * @returns {boolean}
 */
export function isAppBadgingSupported() {
    return typeof navigator !== 'undefined' &&
           'setAppBadge' in navigator &&
           typeof navigator.setAppBadge === 'function';
}

/**
 * Updates application icon badge in PWA / Installed Web App mode
 * Synchronizes with total items in cart or clears badge if empty
 * @param {number} [count]
 * @returns {Promise<boolean>}
 */
export async function updateAppBadge(count) {
    if (typeof navigator === 'undefined') return false;
    let badgeCount = count;
    if (typeof badgeCount !== 'number') {
        const cartList = (typeof window !== 'undefined' && window.cart) ? window.cart : [];
        badgeCount = Array.isArray(cartList) ? cartList.length : 0;
    }
    badgeCount = Math.max(0, Math.floor(Number(badgeCount) || 0));

    try {
        if (badgeCount > 0) {
            if ('setAppBadge' in navigator && typeof navigator.setAppBadge === 'function') {
                await navigator.setAppBadge(badgeCount);
                return true;
            }
        } else {
            if ('clearAppBadge' in navigator && typeof navigator.clearAppBadge === 'function') {
                await navigator.clearAppBadge();
                return true;
            }
        }
    } catch {}
    return false;
}

/**
 * Clears application icon badge
 * @returns {Promise<boolean>}
 */
export async function clearAppBadge() {
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator && typeof navigator.clearAppBadge === 'function') {
        try {
            await navigator.clearAppBadge();
            return true;
        } catch {}
    }
    return false;
}

export function isCompressionStreamSupported() {
    return typeof globalThis.CompressionStream !== 'undefined' && typeof globalThis.DecompressionStream !== 'undefined';
}

/**
 * Compresses a UTF-8 string into a Uint8Array using native CompressionStream
 * @param {string} str
 * @param {'gzip'|'deflate'} [format='gzip']
 * @returns {Promise<Uint8Array>}
 */
export async function compressString(str, format = 'gzip') {
    if (!isCompressionStreamSupported()) {
        return new TextEncoder().encode(str);
    }
    const stream = new Blob([str]).stream().pipeThrough(new CompressionStream(format));
    const response = new Response(stream);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
}

/**
 * Decompresses a Uint8Array/ArrayBuffer back into a UTF-8 string using native DecompressionStream
 * @param {ArrayBuffer|Uint8Array} data
 * @param {'gzip'|'deflate'} [format='gzip']
 * @returns {Promise<string>}
 */
export async function decompressString(data, format = 'gzip') {
    if (!isCompressionStreamSupported()) {
        return new TextDecoder().decode(data);
    }
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream(format));
    const response = new Response(stream);
    return response.text();
}

/**
 * Compresses an object into a compressed Uint8Array using native CompressionStream
 * @param {any} obj
 * @param {'gzip'|'deflate'} [format='gzip']
 * @returns {Promise<Uint8Array>}
 */
export async function compressJSON(obj, format = 'gzip') {
    const jsonStr = JSON.stringify(obj);
    return compressString(jsonStr, format);
}

/**
 * Decompresses a compressed buffer back into an object using native DecompressionStream
 * @param {ArrayBuffer|Uint8Array} data
 * @param {'gzip'|'deflate'} [format='gzip']
 * @returns {Promise<any>}
 */
export async function decompressJSON(data, format = 'gzip') {
    const text = await decompressString(data, format);
    return JSON.parse(text);
}

export function toCDN(url, options = {}) {
    if (typeof window !== 'undefined' && typeof window.toCDN === 'function') {
        return window.toCDN(url, options);
    }
    if (!url || typeof url !== 'string') return '';
    let result = url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://nisha-cdn.mtyagniryadno.workers.dev');
    if (!options || typeof options !== 'object' || Object.keys(options).length === 0) {
        return result;
    }
    if (result.endsWith('.mp4') || result.endsWith('.webm') || result.endsWith('.svg')) {
        return result;
    }
    const isThumb = options.isThumb === true || (typeof options.width === 'number' && options.width <= 480);
    if (isThumb && result.includes('/items-images/item_') && !result.includes('/items-images/thumb_item_')) {
        result = result.replace('/items-images/item_', '/items-images/thumb_item_');
    }
    const width = options.width || options.w;
    const height = options.height || options.h;
    const quality = options.quality || options.q;
    const format = options.format || options.fmt;
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
}

export function getOptimizedCDNImageUrl(url, options = {}) {
    if (typeof window !== 'undefined' && typeof window.getOptimizedCDNImageUrl === 'function') {
        return window.getOptimizedCDNImageUrl(url, options);
    }
    return toCDN(url, options);
}

export function getImageSrcSet(url, widths = [320, 480, 768]) {
    if (typeof window !== 'undefined' && typeof window.getImageSrcSet === 'function') {
        return window.getImageSrcSet(url, widths);
    }
    if (!url || typeof url !== 'string' || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.svg')) return '';
    return widths
        .map(w => `${toCDN(url, { width: w, quality: 85, format: 'webp' })} ${w}w`)
        .join(', ');
}

/**
 * Escapes unsafe HTML characters to prevent XSS attacks
 * @param {any} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function') {
        return window.escapeHtml(str);
    }
    if (str === null || str === undefined) return '';
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Escapes unsafe attribute characters
 * @param {any} str
 * @returns {string}
 */
export function escapeAttr(str) {
    return escapeHtml(str);
}

/**
 * Escapes characters for embedding inside JavaScript string literals
 * @param {any} str
 * @returns {string}
 */
export function escapeJsString(str) {
    if (typeof window !== 'undefined' && typeof window.escapeJsString === 'function') {
        return window.escapeJsString(str);
    }
    if (str === null || str === undefined) return '';
    return String(str)
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('"', '\\"')
        .replaceAll('<', '\\x3c')
        .replaceAll('>', '\\x3e')
        .replaceAll('\n', '\\n')
        .replaceAll('\r', '\\r');
}

/**
 * Sanitizes arbitrary text input
 * @param {string} str
 * @returns {string}
 */
export function sanitizeText(str) {
    if (typeof window !== 'undefined' && typeof window.sanitizeText === 'function') {
        return window.sanitizeText(str);
    }
    return escapeHtml(str);
}

/**
 * Triggers physical vibration on supported mobile devices
 * @param {number} [duration=150]
 */
export function triggerVibration(duration = 150) {
    if (typeof window !== 'undefined' && typeof window.triggerVibration === 'function') {
        window.triggerVibration(duration);
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(duration); } catch {}
    }
}

/**
 * Triggers tactile haptic feedback (Taptic Engine / Web Vibration API)
 * @param {'light'|'medium'|'heavy'|'success'|'error'} [type='light']
 */
export function triggerHaptic(type = 'light') {
    if (typeof window !== 'undefined' && typeof window.triggerHaptic === 'function') {
        window.triggerHaptic(type);
    }
}

/**
 * Displays a non-blocking toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'|'gold'} [type='success']
 * @param {string|null} [imgUrl=null]
 * @param {(() => void)|null} [onClick=null]
 */
export function showToast(message, type = 'success', imgUrl = null, onClick = null) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        return window.showToast(message, type, imgUrl, onClick);
    }
}

/**
 * Returns current store currency symbol (e.g. ₴)
 * @returns {string}
 */
export function getCurrency() {
    if (typeof window !== 'undefined' && typeof window.getCurrency === 'function') {
        return window.getCurrency();
    }
    return '₴';
}

/**
 * Formats numeric price into localized string with currency
 * @param {number|string} price
 * @param {string} [currency='₴']
 * @returns {string}
 */
const cachedPriceNumberFormatter = (typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function')
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : null;

/**
 * Formats numeric price into localized string with currency
 * @param {number|string} price
 * @param {string|object} [currencyOrOptions='₴']
 * @returns {string}
 */
export function formatPrice(price, currencyOrOptions = '₴') {
    if (typeof window !== 'undefined' && typeof window.formatPrice === 'function') {
        return window.formatPrice(price, currencyOrOptions);
    }
    const cleanNum = typeof price === 'number'
        ? price
        : Number(String(price || 0).replace(/[^\d.-]/g, '')) || 0;
    const rounded = Math.round(cleanNum);
    const formatted = cachedPriceNumberFormatter
        ? cachedPriceNumberFormatter.format(rounded)
        : rounded.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (currencyOrOptions && typeof currencyOrOptions === 'object') {
        const curr = getCurrency();
        if (currencyOrOptions.currencyOnly) return curr;
        if (currencyOrOptions.numberOnly) return formatted;
        return `${formatted}\u00A0${curr}`;
    }
    return `${formatted} ${currencyOrOptions}`;
}

/**
 * Clamps numeric value between min and max bounds
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
    if (typeof window !== 'undefined' && typeof window.clamp === 'function') {
        return window.clamp(val, min, max);
    }
    return Math.min(Math.max(val, min), max);
}

/**
 * Generates random short unique identifier
 * @param {string} [prefix='id']
 * @returns {string}
 */
export function generateShortId(prefix = 'id') {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`;
    }
    if (typeof window !== 'undefined' && typeof window.generateShortId === 'function') {
        return `${prefix}_${window.generateShortId(8)}`;
    }
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Safely deep-clones object or structured data
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function deepClone(obj) {
    if (typeof window !== 'undefined' && typeof window.deepClone === 'function') {
        return window.deepClone(obj);
    }
    try {
        return structuredClone(obj);
    } catch (_) {
        return obj;
    }
}

/**
 * Copies text to system clipboard with fallback
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    if (typeof window !== 'undefined' && typeof window.copyToClipboard === 'function') {
        return window.copyToClipboard(text);
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {}
    }
    return false;
}

/**
 * Triggers native Web Share API dialog with fallback
 * @param {{ title?: string, text?: string, url?: string }} data
 * @returns {Promise<boolean>}
 */
export async function shareContent(data) {
    if (typeof window !== 'undefined' && typeof window.shareContent === 'function') {
        return window.shareContent(data);
    }
    return false;
}

/**
 * Safe localStorage wrapper proxy
 */
export const storage = new Proxy({}, {
    get(_target, prop) {
        if (typeof window !== 'undefined' && window.storage) {
            const val = window.storage[prop];
            return typeof val === 'function' ? val.bind(window.storage) : val;
        }
        return undefined;
    },
    set(_target, prop, value) {
        if (typeof window !== 'undefined' && window.storage) {
            window.storage[prop] = value;
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
 * Safe persistent storage access
 */
export const safeStorage = new Proxy({}, {
    get(_target, prop) {
        if (typeof window !== 'undefined' && window.safeStorage) {
            const val = window.safeStorage[prop];
            return typeof val === 'function' ? val.bind(window.safeStorage) : val;
        }
        return undefined;
    },
    set(_target, prop, value) {
        if (typeof window !== 'undefined' && window.safeStorage) {
            window.safeStorage[prop] = value;
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

/**
 * Checks if an error is a benign ViewTransition abort (e.g. mobile URL bar resize)
 * @param {any} err
 * @returns {boolean}
 */
export function isViewTransitionAbortError(err) {
    if (typeof window !== 'undefined' && typeof window.isViewTransitionAbortError === 'function') {
        return window.isViewTransitionAbortError(err);
    }
    if (!err) return false;
    const msg = String(err.message || err.reason || err);
    const name = String(err.name || '');
    return (
        name === 'AbortError' ||
        name === 'InvalidStateError' ||
        /Transition was aborted/i.test(msg) ||
        /Viewport size changed/i.test(msg) ||
        /ViewTransition/i.test(msg)
    );
}

/**
 * Safely executes DOM mutation callback with View Transitions API when supported,
 * falling back gracefully for unsupported browsers or prefers-reduced-motion.
 * @param {() => void | Promise<void>} updateFn
 * @returns {{ finished: Promise<any>, ready: Promise<any>, updateCallbackDone: Promise<any>, skipTransition: () => void }}
 */
export function safeViewTransition(updateFn) {
    if (typeof window !== 'undefined' && typeof window.safeViewTransition === 'function') {
        return window.safeViewTransition(updateFn);
    }
    if (typeof updateFn !== 'function') {
        return {
            finished: Promise.resolve(),
            ready: Promise.resolve(),
            updateCallbackDone: Promise.resolve(),
            skipTransition: () => {}
        };
    }
    try {
        const res = updateFn();
        const p = res instanceof Promise ? res : Promise.resolve(res);
        return {
            finished: p,
            ready: Promise.resolve(),
            updateCallbackDone: p,
            skipTransition: () => {}
        };
    } catch (err) {
        console.error('[ViewTransitions] updateFn fallback failed:', err);
        return {
            finished: Promise.reject(err),
            ready: Promise.resolve(),
            updateCallbackDone: Promise.reject(err),
            skipTransition: () => {}
        };
    }
}

/**
 * Parses delivery address into city and branch components safely
 * @param {string} addr
 * @returns {{ city: string, branch: string }}
 */
export function parseDeliveryAddress(addr) {
    if (typeof window !== 'undefined' && typeof window.parseDeliveryAddress === 'function') {
        return window.parseDeliveryAddress(addr);
    }
    if (!addr || typeof addr !== 'string') return { city: '', branch: '' };
    const str = addr.trim();
    if (!str) return { city: '', branch: '' };

    const markerMatch = str.match(/,\s*(відділення|поштомат|пункт|склад|отделение|почтомат|нова\s*пошта|№|відд\.?|отд\.?)(?![а-яёіїєa-z0-9])/i);
    if (markerMatch && markerMatch.index !== undefined) {
        const cityPart = str.slice(0, markerMatch.index).trim();
        const branchPart = str.slice(markerMatch.index).replace(/^,\s*/, '').trim();
        return { city: cityPart, branch: branchPart };
    }

    const parts = str.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) {
        return { city: str, branch: '' };
    }

    let splitIdx = 1;
    while (splitIdx < parts.length && /обл|район|р-н/i.test(parts[splitIdx])) {
        splitIdx++;
    }
    if (splitIdx >= parts.length) {
        return { city: parts.join(', '), branch: '' };
    }
    return {
        city: parts.slice(0, splitIdx).join(', '),
        branch: parts.slice(splitIdx).join(', ')
    };
}

/**
 * Parses a search query looking for price specifications (e.g. "800", "800грн", "до 800", "500-800")
 * @param {string} query
 * @returns {{ type: 'exact'|'max'|'min'|'range', price?: number, min?: number, max?: number }|null}
 */
export function parsePriceSearchQuery(query) {
    if (typeof window !== 'undefined' && typeof window.parsePriceSearchQuery === 'function') {
        return window.parsePriceSearchQuery(query);
    }
    if (!query || typeof query !== 'string') return null;
    const clean = query.trim().toLowerCase();

    const rangeMatch = clean.match(/^(\d+(?:[\s.,]\d+)?)\s*(?:-|–|—|\.\.|to)\s*(\d+(?:[\s.,]\d+)?)\s*(?:грн|uah|гривен|гривень|гр|г|₴)?\.?$/i);
    if (rangeMatch) {
        const min = Number.parseInt(rangeMatch[1].replace(/[\s.,]/g, ''), 10);
        const max = Number.parseInt(rangeMatch[2].replace(/[\s.,]/g, ''), 10);
        if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
            return { type: 'range', min: Math.min(min, max), max: Math.max(min, max), price: Math.min(min, max) };
        }
    }

    const maxMatch = clean.match(/^(?:до|<=|<)\s*(\d+(?:[\s.,]\d+)?)\s*(?:грн|uah|гривен|гривень|гр|г|₴)?\.?$/i);
    if (maxMatch) {
        const val = Number.parseInt(maxMatch[1].replace(/[\s.,]/g, ''), 10);
        if (Number.isFinite(val) && val > 0) {
            return { type: 'max', max: val, price: val };
        }
    }

    const minMatch = clean.match(/^(?:от|від|>=|>)\s*(\d+(?:[\s.,]\d+)?)\s*(?:грн|uah|гривен|гривень|гр|г|₴)?\.?$/i);
    if (minMatch) {
        const val = Number.parseInt(minMatch[1].replace(/[\s.,]/g, ''), 10);
        if (Number.isFinite(val) && val > 0) {
            return { type: 'min', min: val, price: val };
        }
    }

    const exactMatch = clean.match(/^(\d+(?:[\s.,]\d+)?)\s*(?:грн|uah|гривен|гривень|гр|г|₴)?\.?$/i);
    if (exactMatch) {
        const val = Number.parseInt(exactMatch[1].replace(/[\s.,]/g, ''), 10);
        if (Number.isFinite(val) && val > 0) {
            return { type: 'exact', price: val };
        }
    }

    return null;
}

/**
 * Checks if a product matches a parsed price query
 * @param {object} item
 * @param {object} priceQuery
 * @returns {boolean}
 */
export function itemMatchesPrice(item, priceQuery) {
    if (typeof window !== 'undefined' && typeof window.itemMatchesPrice === 'function') {
        return window.itemMatchesPrice(item, priceQuery);
    }
    if (!item || !priceQuery) return false;
    const rawPrice = item.price;
    const price = typeof rawPrice === 'number' ? rawPrice : (Number.parseInt(String(rawPrice || '').replace(/[^\d]/g, ''), 10) || 0);
    const oldPrice = (item.old_price !== null && item.old_price !== undefined)
        ? (typeof item.old_price === 'number' ? item.old_price : (Number.parseInt(String(item.old_price).replace(/[^\d]/g, ''), 10) || null))
        : null;

    if (priceQuery.type === 'exact') {
        return price === priceQuery.price || (oldPrice !== null && oldPrice === priceQuery.price);
    }
    if (priceQuery.type === 'max') {
        return price <= priceQuery.max;
    }
    if (priceQuery.type === 'min') {
        return price >= priceQuery.min;
    }
    if (priceQuery.type === 'range') {
        return price >= priceQuery.min && price <= priceQuery.max;
    }
    return false;
}

/**
 * Schedules a zero-delay task in the microtask queue
 * @param {Function} fn
 */
export function runMicrotask(fn) {
    if (typeof fn !== 'function') return;
    if (typeof window !== 'undefined' && typeof window.runMicrotask === 'function') {
        window.runMicrotask(fn);
        return;
    }
    if (typeof queueMicrotask === 'function') {
        queueMicrotask(fn);
    } else if (typeof Promise !== 'undefined') {
        Promise.resolve().then(fn).catch(err => {
            setTimeout(() => { throw err; }, 0);
        });
    } else {
        setTimeout(fn, 0);
    }
}

/**
 * Returns the last item of an array using ES2022 array.at(-1)
 * @param {Array<any>} arr
 * @returns {any}
 */
export function getLastItem(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr.at(-1);
}

/**
 * Returns the first item of an array using ES2022 array.at(0)
 * @param {Array<any>} arr
 * @returns {any}
 */
export function getFirstItem(arr) {
    if (!arr || arr.length === 0) return undefined;
    return typeof arr.at === 'function' ? arr.at(0) : arr[0];
}

/**
 * Resolves user display name cleanly across profile and user metadata
 * Prioritizes username, display_name, full_name, name before email prefix fallback
 * @param {object} [user]
 * @param {object} [profile]
 * @returns {string}
 */
export function getUserDisplayName(user, profile) {
    if (typeof window !== 'undefined' && typeof window.getUserDisplayName === 'function') {
        return window.getUserDisplayName(user, profile);
    }
    const profName = (profile?.username || profile?.display_name || profile?.full_name || '').trim();
    if (profName && profName !== 'User') return profName;
    const meta = user?.user_metadata || {};
    const metaName = (meta.display_name || meta.username || meta.full_name || meta.name || '').trim();
    if (metaName && metaName !== 'User') return metaName;
    if (user?.email && typeof user.email === 'string') {
        const emailPrefix = user.email.split('@').at(0);
        if (emailPrefix) return emailPrefix;
    }
    return 'User';
}

/**
 * Checks if browser supports the native Popover API (HTMLElement.prototype.showPopover)
 * @returns {boolean}
 */
export function isPopoverSupported() {
    return typeof HTMLElement !== 'undefined' &&
           typeof HTMLElement.prototype.showPopover === 'function' &&
           typeof HTMLElement.prototype.hidePopover === 'function';
}
if (typeof window !== 'undefined') window.isPopoverSupported = isPopoverSupported;

/**
 * Safely displays a native popover element if supported, catching DOMExceptions
 * @param {HTMLElement} element
 * @returns {boolean} True if native showPopover was invoked successfully
 */
export function showPopoverSafe(element) {
    if (!element) return false;
    if (typeof element.hasAttribute === 'function' && !element.hasAttribute('popover')) return false;
    if (typeof element.showPopover === 'function') {
        try {
            if (typeof element.matches === 'function' && element.matches(':popover-open')) {
                return true;
            }
            element.showPopover();
            return true;
        } catch {
            return false;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.showPopoverSafe = showPopoverSafe;

/**
 * Safely hides a native popover element if supported, catching DOMExceptions
 * @param {HTMLElement} element
 * @returns {boolean} True if native hidePopover was invoked successfully
 */
export function hidePopoverSafe(element) {
    if (!element) return false;
    if (typeof element.hasAttribute === 'function' && !element.hasAttribute('popover')) return false;
    if (typeof element.hidePopover === 'function') {
        try {
            if (typeof element.matches === 'function' && !element.matches(':popover-open')) {
                return false;
            }
            element.hidePopover();
            return true;
        } catch {
            return false;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.hidePopoverSafe = hidePopoverSafe;

/**
 * Safely toggles a native popover element if supported, catching DOMExceptions
 * @param {HTMLElement} element
 * @param {boolean} [force]
 * @returns {boolean}
 */
export function togglePopoverSafe(element, force) {
    if (!element) return false;
    if (typeof element.hasAttribute === 'function' && !element.hasAttribute('popover')) return false;
    if (typeof element.togglePopover === 'function') {
        try {
            return element.togglePopover(force);
        } catch {
            return false;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.togglePopoverSafe = togglePopoverSafe;

/**
 * Checks if CSS Scroll-Driven Animations (animation-timeline: scroll() or view()) are supported
 * @returns {boolean}
 */
export function isScrollDrivenAnimationSupported() {
    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
        try {
            return CSS.supports('animation-timeline', 'scroll()') ||
                   CSS.supports('animation-timeline', 'view()');
        } catch {
            return false;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.isScrollDrivenAnimationSupported = isScrollDrivenAnimationSupported;
/**
 * Safely checks if a native popover or dropdown element is currently open
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isPopoverOpenSafe(element) {
    if (!element) return false;
    try {
        if (typeof element.matches === 'function' && element.matches(':popover-open')) {
            return true;
        }
    } catch {}
    if (element.classList && (element.classList.contains('is-open') || element.classList.contains('active'))) {
        return true;
    }
    if (element.style && element.style.display && element.style.display !== 'none' && element.style.display !== '') {
        if (element.style.opacity !== '0' && element.style.visibility !== 'hidden') {
            return true;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.isPopoverOpenSafe = isPopoverOpenSafe;


/**
 * Immutable array sort (ES2023 Array.prototype.toSorted with fallback)
 * @template T
 * @param {T[]} array
 * @param {(a: T, b: T) => number} [compareFn]
 * @returns {T[]}
 */
export function toSorted(array, compareFn) {
    if (!Array.isArray(array)) return [];
    if (typeof array.toSorted === 'function') {
        return array.toSorted(compareFn);
    }
    return [...array].sort(compareFn);
}

/**
 * Immutable array reverse (ES2023 Array.prototype.toReversed with fallback)
 * @template T
 * @param {T[]} array
 * @returns {T[]}
 */
export function toReversed(array) {
    if (!Array.isArray(array)) return [];
    if (typeof array.toReversed === 'function') {
        return array.toReversed();
    }
    return [...array].reverse();
}

/**
 * Safe element accessor with negative index support (ES2022 Array.prototype.at with fallback)
 * @template T
 * @param {T[]|string} array
 * @param {number} index
 * @returns {T|string|undefined}
 */
export function at(array, index) {
    if (!Array.isArray(array) && typeof array !== 'string') return undefined;
    if (typeof array.at === 'function') {
        return array.at(index);
    }
    const idx = Number(index) || 0;
    return idx >= 0 ? array[idx] : array[array.length + idx];
}

/**
 * Safe own-property check (ES2022 Object.hasOwn)
 * @param {object} obj
 * @param {string|symbol} prop
 * @returns {boolean}
 */
export function hasOwn(obj, prop) {
    if (obj === null || obj === undefined) return false;
    return Object.hasOwn(obj, prop);
}

/**
 * Asynchronous delay with optional AbortSignal cancellation
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
export function sleep(ms, signal) {
    if (typeof window !== 'undefined' && typeof window.sleep === 'function') {
        return window.sleep(ms, signal);
    }
    if (signal?.aborted) {
        return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        function onAbort() {
            clearTimeout(timer);
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        }
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

/**
 * Multi-tab / PWA asynchronous execution coordinator via Web Locks API
 * @template T
 * @param {string} name
 * @param {() => Promise<T>|T} fn
 * @returns {Promise<T>}
 */
export async function withWebLock(name, fn) {
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        try {
            return await navigator.locks.request(name, fn);
        } catch (_) {
            return await fn();
        }
    }
    return await fn();
}

/**
 * Computes difference between sets (ES2025 Set.prototype.difference with fallback)
 * @template T
 * @param {Set<T>} setA
 * @param {Set<T>} setB
 * @returns {Set<T>}
 */
export function setDifference(setA, setB) {
    if (!setA) return new Set();
    if (!setB) return new Set(setA);
    if (typeof setA.difference === 'function') {
        return setA.difference(setB);
    }
    const diff = new Set();
    for (const elem of setA) {
        if (!setB.has(elem)) diff.add(elem);
    }
    return diff;
}
if (typeof window !== 'undefined') window.setDifference = setDifference;
if (typeof globalThis !== 'undefined') globalThis.setDifference = setDifference;

/**
 * Computes intersection between sets (ES2025 Set.prototype.intersection with fallback)
 * @template T
 * @param {Set<T>} setA
 * @param {Set<T>} setB
 * @returns {Set<T>}
 */
export function setIntersection(setA, setB) {
    if (!setA || !setB) return new Set();
    if (typeof setA.intersection === 'function') {
        return setA.intersection(setB);
    }
    const inter = new Set();
    for (const elem of setB) {
        if (setA.has(elem)) inter.add(elem);
    }
    return inter;
}
if (typeof window !== 'undefined') window.setIntersection = setIntersection;
if (typeof globalThis !== 'undefined') globalThis.setIntersection = setIntersection;

/**
 * Computes union between sets (ES2025 Set.prototype.union with fallback)
 * @template T
 * @param {Set<T>} setA
 * @param {Set<T>} setB
 * @returns {Set<T>}
 */
export function setUnion(setA, setB) {
    if (!setA && !setB) return new Set();
    if (!setA) return new Set(setB);
    if (!setB) return new Set(setA);
    if (typeof setA.union === 'function') {
        return setA.union(setB);
    }
    const union = new Set(setA);
    for (const elem of setB) {
        union.add(elem);
    }
    return union;
}
if (typeof window !== 'undefined') window.setUnion = setUnion;
if (typeof globalThis !== 'undefined') globalThis.setUnion = setUnion;

/**
 * Checks if setA is a subset of setB (ES2025 Set.prototype.isSubsetOf with fallback)
 * @template T
 * @param {Set<T>} setA
 * @param {Set<T>} setB
 * @returns {boolean}
 */
export function setIsSubsetOf(setA, setB) {
    if (!setA) return true;
    if (!setB) return setA.size === 0;
    if (typeof setA.isSubsetOf === 'function') {
        return setA.isSubsetOf(setB);
    }
    for (const elem of setA) {
        if (!setB.has(elem)) return false;
    }
    return true;
}
if (typeof window !== 'undefined') window.setIsSubsetOf = setIsSubsetOf;
if (typeof globalThis !== 'undefined') globalThis.setIsSubsetOf = setIsSubsetOf;
