// @ts-check
// ==========================================
// NISHA CORE HELPERS: PLATFORM PRIMITIVES, COLLECTIONS & FORMATTING
// ES2022-2025 Polyfills, String/URL safety, Scheduling, Sets, Price & DOM utils
// ==========================================

import { registerAction } from './action-registry.js';
import { getActiveCurrencyCode, getCurrencySymbol, convertFromUah } from './currency.js';
import {
    escapeRegExp,
    isErrorLike,
    promiseTry,
    base64ToBytes,
    bytesToBase64
} from './es2025-utils.js';

export {
    escapeRegExp,
    isErrorLike,
    promiseTry,
    base64ToBytes,
    bytesToBase64
};

// Polyfill Promise.withResolvers (ES2024) if not natively present
if (typeof Promise !== 'undefined' && typeof Promise.withResolvers !== 'function') {
    /** @type {any} */ (Promise).withResolvers = function() {
        /** @type {any} */ let resolve;
        /** @type {any} */ let reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

/**
 * @param {string} name
 * @param {any} value
 */
function exposeGlobal(name, value) {
    if (typeof window !== 'undefined') /** @type {any} */ (window)[name] = value;
    if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis)[name] = value;
    if (typeof value === 'function') registerAction(name, value);
}

/**
 * Modern URL validator (ES2024 URL.canParse with safe fallback).
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
exposeGlobal('canParseURL', canParseURL);

/**
 * Modern String validator & sanitizer (ES2024 String.prototype.toWellFormed & isWellFormed).
 * Guarantees no lone surrogates that cause URIError in encodeURIComponent.
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
exposeGlobal('toWellFormed', toWellFormed);

/**
 * Checks whether a string contains no lone UTF-16 surrogates.
 * @param {*} str
 * @returns {boolean}
 */
export function isWellFormed(str) {
    if (str === null || str === undefined) return true;
    const s = String(str);
    if (typeof s.isWellFormed === 'function') {
        return s.isWellFormed();
    }
    return !(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s));
}
exposeGlobal('isWellFormed', isWellFormed);

/**
 * Exception-free URI encoder using ES2024 toWellFormed.
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
exposeGlobal('safeEncodeURIComponent', safeEncodeURIComponent);

/**
 * Grapheme-safe text segmentation (Intl.Segmenter Baseline 2023/2024).
 * Guarantees that compound emojis and accented characters are never severed.
 * @type {Intl.Segmenter | null}
 */
let _cachedGraphemeSegmenter = null;

/**
 * Returns a cached Intl.Segmenter instance with grapheme granularity.
 * @param {string} [locale='uk']
 * @returns {Intl.Segmenter|null}
 */
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
exposeGlobal('getGraphemeSegmenter', getGraphemeSegmenter);

/**
 * Truncates text cleanly along grapheme cluster boundaries.
 * @param {string} text
 * @param {number} maxGraphemes
 * @param {string} [suffix='']
 * @returns {string}
 */
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
exposeGlobal('safeTruncateText', safeTruncateText);

/**
 * Counts grapheme clusters in a string.
 * @param {string} text
 * @returns {number}
 */
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
exposeGlobal('getGraphemeCount', getGraphemeCount);

/**
 * Combines multiple AbortSignals into one (ES2024 AbortSignal.any with fallback).
 * @param {Array<AbortSignal|null|undefined>} signals
 * @returns {AbortSignal|null}
 */
export function combineAbortSignals(signals) {
    const validSignals = /** @type {AbortSignal[]} */ ((signals || []).filter(Boolean));
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
exposeGlobal('combineAbortSignals', combineAbortSignals);

/**
 * Yields control back to the main thread using scheduler.yield() or MessageChannel fallback.
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
    const { promise, resolve } = /** @type {PromiseWithResolvers<void>} */ (Promise.withResolvers());
    if (typeof MessageChannel !== 'undefined') {
        try {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => {
                try {
                    channel.port1.close();
                    channel.port2.close();
                } catch {}
                resolve();
            };
            channel.port2.postMessage(null);
            return promise;
        } catch {}
    }
    setTimeout(resolve, 0);
    return promise;
}
if (typeof window !== 'undefined') window.yieldToMain = yieldToMain;

/**
 * Checks whether native scheduler.yield() is supported.
 * @returns {boolean}
 */
export function isSchedulerYieldSupported() {
    return typeof globalThis.scheduler !== 'undefined' && typeof globalThis.scheduler.yield === 'function';
}
if (typeof window !== 'undefined') window.isSchedulerYieldSupported = isSchedulerYieldSupported;

/**
 * Checks whether native CompressionStream and DecompressionStream APIs are available.
 * @returns {boolean}
 */
export function isCompressionStreamSupported() {
    return typeof globalThis.CompressionStream !== 'undefined' && typeof globalThis.DecompressionStream !== 'undefined';
}
if (typeof window !== 'undefined') window.isCompressionStreamSupported = isCompressionStreamSupported;

/**
 * Compresses a string using native CompressionStream (falls back to UTF-8 bytes).
 * @param {string} str
 * @param {CompressionFormat} [format='gzip']
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
if (typeof window !== 'undefined') window.compressString = compressString;

/**
 * Decompresses bytes compressed by compressString.
 * @param {BufferSource} data
 * @param {CompressionFormat} [format='gzip']
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
if (typeof window !== 'undefined') window.decompressString = decompressString;

/**
 * Serializes and compresses a JSON value.
 * @param {*} obj
 * @param {CompressionFormat} [format='gzip']
 * @returns {Promise<Uint8Array>}
 */
export async function compressJSON(obj, format = 'gzip') {
    const jsonStr = JSON.stringify(obj);
    return compressString(jsonStr, format);
}
if (typeof window !== 'undefined') window.compressJSON = compressJSON;

/**
 * Decompresses and parses a JSON payload.
 * @param {BufferSource} data
 * @param {CompressionFormat} [format='gzip']
 * @returns {Promise<*>}
 */
export async function decompressJSON(data, format = 'gzip') {
    const text = await decompressString(data, format);
    return JSON.parse(text);
}
if (typeof window !== 'undefined') window.decompressJSON = decompressJSON;

/**
 * Zero-delay microtask scheduler (queueMicrotask instead of setTimeout 0).
 * @param {() => void} fn
 */
export function runMicrotask(fn) {
    if (typeof fn !== 'function') return;
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
if (typeof window !== 'undefined') window.runMicrotask = runMicrotask;
if (typeof globalThis !== 'undefined') {
    const g = /** @type {any} */ (globalThis);
    g.runMicrotask = g.runMicrotask || runMicrotask;
}

/**
 * Returns the last element of an array/string without mutating it.
 * @param {any[]|string} arr
 * @returns {*}
 */
export function getLastItem(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr.at(-1);
}
if (typeof window !== 'undefined') window.getLastItem = getLastItem;
if (typeof globalThis !== 'undefined') {
    const g = /** @type {any} */ (globalThis);
    g.getLastItem = g.getLastItem || getLastItem;
}

/**
 * Returns the first element of an array/string without mutating it.
 * @param {any[]|string} arr
 * @returns {*}
 */
export function getFirstItem(arr) {
    if (!arr || arr.length === 0) return undefined;
    return typeof arr.at === 'function' ? arr.at(0) : arr[0];
}
if (typeof window !== 'undefined') window.getFirstItem = getFirstItem;
if (typeof globalThis !== 'undefined') {
    const g = /** @type {any} */ (globalThis);
    g.getFirstItem = g.getFirstItem || getFirstItem;
}

/**
 * Resolves a human-readable display name from profile and Supabase user metadata.
 * @param {any} user
 * @param {any} profile
 * @returns {string}
 */
export function getUserDisplayName(user, profile) {
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
if (typeof window !== 'undefined') window.getUserDisplayName = getUserDisplayName;
if (typeof globalThis !== 'undefined') globalThis.getUserDisplayName = globalThis.getUserDisplayName || getUserDisplayName;

/**
 * Safely clears all child nodes of an element via replaceChildren().
 * @param {Element|null} el
 */
export function clearElement(el) {
    if (!el) return;
    if (typeof el.replaceChildren === 'function') {
        el.replaceChildren();
    } else {
        el.innerHTML = '';
    }
}
exposeGlobal('clearElement', clearElement);

/**
 * Resolves the active 2-letter site language (`ua` | `ru` | `en`) across i18next, storage facade, and localStorage.
 * @returns {'ua'|'ru'|'en'}
 */
function resolveCurrencyDisplayLang() {
    const g = /** @type {any} */ (globalThis);
    const i18n = (typeof window !== 'undefined' && window.i18next) || g.i18next;
    const rawI18n = i18n && (i18n.resolvedLanguage || i18n.language);
    const storeRef = (typeof window !== 'undefined' && window.storage)
        ? window.storage
        : (typeof globalThis !== 'undefined' ? globalThis.storage : null);
    let rawStored = (storeRef && typeof storeRef.get === 'function')
        ? storeRef.get('nisha_lang', null)
        : null;
    if (!rawStored && typeof localStorage !== 'undefined') {
        try { rawStored = localStorage.getItem('nisha_lang'); } catch {}
    }
    const clean = String(rawI18n || rawStored || 'ua').trim().toLowerCase().slice(0, 2);
    if (clean === 'en') return 'en';
    if (clean === 'ru') return 'ru';
    return 'ua';
}

/**
 * Returns active display currency label (`грн`/`UAH` for UAH, `$` for USD, `€` for EUR).
 * @returns {'UAH'|'грн'|'$'|'€'}
 */
export function getCurrency() {
    const activeCode = getActiveCurrencyCode();
    if (activeCode === 'USD' || activeCode === 'EUR') {
        return /** @type {'$' | '€'} */ (getCurrencySymbol(activeCode));
    }
    return resolveCurrencyDisplayLang() === 'en' ? 'UAH' : 'грн';
}
exposeGlobal('getCurrency', getCurrency);

// High-performance cached number formatter (Intl.NumberFormat)
export const cachedPriceNumberFormatter = (typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function')
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : null;
exposeGlobal('cachedPriceNumberFormatter', cachedPriceNumberFormatter);

/**
 * Formats an integer/string UAH price into the active display currency using the cached Intl.NumberFormat singleton.
 * @param {number|string} amount
 * @param {{ currencyOnly?: boolean, numberOnly?: boolean, forceUah?: boolean }} [options={}]
 * @returns {string}
 */
export function formatPrice(amount, options = {}) {
    const cleanNum = typeof amount === 'number'
        ? amount
        : Number(String(amount || 0).replace(/[^\d.-]/g, '')) || 0;
    const activeCode = options.forceUah ? 'UAH' : getActiveCurrencyCode();
    const converted = activeCode === 'UAH'
        ? Math.round(cleanNum)
        : convertFromUah(cleanNum, activeCode);

    const lang = resolveCurrencyDisplayLang();
    const currency = activeCode === 'UAH'
        ? (lang === 'en' ? 'UAH' : 'грн')
        : getCurrencySymbol(activeCode);

    const formattedNum = cachedPriceNumberFormatter
        ? cachedPriceNumberFormatter.format(converted)
        : converted.toLocaleString('en-US', { maximumFractionDigits: 0 });

    if (options.currencyOnly) return currency;
    if (options.numberOnly) return formattedNum;
    return `${formattedNum}\u00A0${currency}`;
}
exposeGlobal('formatPrice', formatPrice);

/**
 * Clamps a numeric value inside [min, max].
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.min(Math.max(val, lo), hi);
}
exposeGlobal('clamp', clamp);

/**
 * Generates a compact random alphanumeric ID using crypto.randomUUID / crypto.getRandomValues.
 * @param {number} [length=9]
 * @returns {string}
 */
export function generateShortId(length = 9) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replaceAll('-', '').slice(0, length);
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => (b % 36).toString(36)).join('').slice(0, length);
    }
    return Date.now().toString(36).slice(-length);
}
exposeGlobal('generateShortId', generateShortId);

/**
 * Deeply clones values via structuredClone with a recursive fallback for non-cloneables.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        } catch (e) {
            // Safe fallback for DOM nodes, functions, or signals that structuredClone rejects
        }
    }
    if (Array.isArray(obj)) {
        return /** @type {T} */ (/** @type {unknown} */ (obj.map(item => deepClone(item))));
    }
    /** @type {Record<string, any>} */
    const copy = {};
    const objRec = /** @type {Record<string, any>} */ (obj);
    for (const key of Object.keys(objRec)) {
        copy[key] = deepClone(objRec[key]);
    }
    return /** @type {T} */ (copy);
}
exposeGlobal('deepClone', deepClone);

/**
 * Non-mutating sort using Array.prototype.toSorted with safe fallback.
 * @param {any[]} array
 * @param {(a: any, b: any) => number} [compareFn]
 * @returns {any[]}
 */
export function toSorted(array, compareFn) {
    if (!Array.isArray(array)) return [];
    if (typeof array.toSorted === 'function') {
        return array.toSorted(compareFn);
    }
    return [...array].sort(compareFn);
}
exposeGlobal('toSorted', toSorted);

/**
 * Non-mutating reverse using Array.prototype.toReversed with safe fallback.
 * @param {any[]} array
 * @returns {any[]}
 */
export function toReversed(array) {
    if (!Array.isArray(array)) return [];
    if (typeof array.toReversed === 'function') {
        return array.toReversed();
    }
    return [...array].reverse();
}
exposeGlobal('toReversed', toReversed);

/**
 * Safe index lookup supporting negative offsets (Array.prototype.at).
 * @param {any[]|string} array
 * @param {number} index
 * @returns {*}
 */
export function at(array, index) {
    if (!Array.isArray(array) && typeof array !== 'string') return undefined;
    if (typeof array.at === 'function') {
        return array.at(index);
    }
    const idx = Number(index) || 0;
    return idx >= 0 ? array[idx] : array[array.length + idx];
}
exposeGlobal('at', at);

/**
 * Null-safe wrapper over ES2022 Object.hasOwn.
 * @param {*} obj
 * @param {string|symbol} prop
 * @returns {boolean}
 */
export function hasOwn(obj, prop) {
    if (obj === null || obj === undefined) return false;
    return Object.hasOwn(obj, prop);
}
exposeGlobal('hasOwn', hasOwn);

/**
 * AbortSignal-aware async sleep helper.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
export function sleep(ms, signal) {
    if (signal?.aborted) {
        return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }
    const { promise, resolve, reject } = /** @type {PromiseWithResolvers<void>} */ (Promise.withResolvers());
    const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
    }, ms);
    function onAbort() {
        clearTimeout(timer);
        reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    return promise;
}
exposeGlobal('sleep', sleep);

/**
 * Executes an async callback inside a named navigator.locks Web Lock if supported.
 * @param {string} name
 * @param {Function} fn
 * @returns {Promise<*>}
 */
export async function withWebLock(name, fn) {
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        let entered = false;
        try {
            return await navigator.locks.request(name, async (lock) => {
                entered = true;
                return await fn(lock);
            });
        } catch (e) {
            if (entered) throw e;
            return await fn();
        }
    }
    return await fn();
}
exposeGlobal('withWebLock', withWebLock);

/**
 * ES2025 Set difference with fallback.
 * @param {Set<any>|null} setA
 * @param {Set<any>|null} setB
 * @returns {Set<any>}
 */
export function setDifference(setA, setB) {
    if (!setA) return new Set();
    if (!setB) return new Set(setA);
    const setAAny = /** @type {any} */ (setA);
    if (typeof setAAny.difference === 'function') {
        return setAAny.difference(setB);
    }
    const diff = new Set();
    for (const elem of setA) {
        if (!setB.has(elem)) diff.add(elem);
    }
    return diff;
}
exposeGlobal('setDifference', setDifference);

/**
 * ES2025 Set intersection with fallback.
 * @param {Set<any>|null} setA
 * @param {Set<any>|null} setB
 * @returns {Set<any>}
 */
export function setIntersection(setA, setB) {
    if (!setA || !setB) return new Set();
    const setAAny = /** @type {any} */ (setA);
    if (typeof setAAny.intersection === 'function') {
        return setAAny.intersection(setB);
    }
    const inter = new Set();
    for (const elem of setB) {
        if (setA.has(elem)) inter.add(elem);
    }
    return inter;
}
exposeGlobal('setIntersection', setIntersection);

/**
 * ES2025 Set union with fallback.
 * @param {Set<any>|null} setA
 * @param {Set<any>|null} setB
 * @returns {Set<any>}
 */
export function setUnion(setA, setB) {
    if (!setA && !setB) return new Set();
    if (!setA) return new Set(setB);
    if (!setB) return new Set(setA);
    const setAAny = /** @type {any} */ (setA);
    if (typeof setAAny.union === 'function') {
        return setAAny.union(setB);
    }
    const union = new Set(setA);
    for (const elem of setB) {
        union.add(elem);
    }
    return union;
}
exposeGlobal('setUnion', setUnion);

/**
 * ES2025 Set isSubsetOf with fallback.
 * @param {Set<any>|null} setA
 * @param {Set<any>|null} setB
 * @returns {boolean}
 */
export function setIsSubsetOf(setA, setB) {
    if (!setA) return true;
    if (!setB) return setA.size === 0;
    const setAAny = /** @type {any} */ (setA);
    if (typeof setAAny.isSubsetOf === 'function') {
        return setAAny.isSubsetOf(setB);
    }
    for (const elem of setA) {
        if (!setB.has(elem)) return false;
    }
    return true;
}
exposeGlobal('setIsSubsetOf', setIsSubsetOf);

/**
 * Formats Ukrainian phone numbers into `+380 (XX) XXX-XX-XX` display mask format.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function formatUaPhoneDisplay(raw) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return '';
    let digits = trimmed.replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('0')) {
        digits = '38' + digits;
    } else if (digits.length === 9) {
        digits = '380' + digits;
    }
    if (digits.length === 12 && digits.startsWith('380')) {
        return `+380 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
    }
    return trimmed;
}
exposeGlobal('formatUaPhoneDisplay', formatUaPhoneDisplay);

/**
 * Applies `+380 (XX) XXX-XX-XX` mask formatting to a phone input and keeps IMask in sync
 * without falsely marking the field as manually typed.
 * @param {HTMLInputElement|null|undefined} inputEl
 * @param {string} [rawValue]
 * @returns {string}
 */
export function formatPhoneInput(inputEl, rawValue) {
    if (!inputEl) return '';
    const inputAny = /** @type {any} */ (inputEl);
    const source = rawValue !== undefined ? rawValue : inputEl.value;
    const formatted = formatUaPhoneDisplay(source);
    const mask = inputAny._imask || inputAny._nishaPhoneMask || null;
    inputAny._syncingMaskValue = true;
    try {
        inputEl.value = formatted;
        if (mask) {
            try { mask.value = formatted; } catch {}
            if (typeof mask.updateValue === 'function') {
                try { mask.updateValue(); } catch {}
            }
        }
    } finally {
        inputAny._syncingMaskValue = false;
    }
    return formatted;
}
exposeGlobal('formatPhoneInput', formatPhoneInput);

exposeGlobal('escapeRegExp', escapeRegExp);
exposeGlobal('isErrorLike', isErrorLike);
exposeGlobal('promiseTry', promiseTry);
exposeGlobal('base64ToBytes', base64ToBytes);
exposeGlobal('bytesToBase64', bytesToBase64);
