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

/**
 * Cooperative Task Scheduling (scheduler.yield() with fallback)
 * Yields execution to the browser main thread to process high-priority input, touch, and animations (Zero INP)
 * @returns {Promise<void>}
 */
export async function yieldToMain() {
    if (typeof globalThis.scheduler !== 'undefined' && typeof globalThis.scheduler.yield === 'function') {
        return globalThis.scheduler.yield();
    }
    return new Promise(resolve => {
        if (typeof MessageChannel !== 'undefined') {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => resolve();
            channel.port2.postMessage(null);
        } else {
            setTimeout(resolve, 0);
        }
    });
}

/**
 * Checks if browser natively supports scheduler.yield()
 * @returns {boolean}
 */
export function isSchedulerYieldSupported() {
    return typeof globalThis.scheduler !== 'undefined' && typeof globalThis.scheduler.yield === 'function';
}

/**
 * Checks if browser natively supports Compression Streams API (gzip/deflate)
 * @returns {boolean}
 */
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

export function toCDN(url) {
    if (typeof window !== 'undefined' && typeof window.toCDN === 'function') {
        return window.toCDN(url);
    }
    if (!url || typeof url !== 'string') return '';
    return url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://nisha-cdn.mtyagniryadno.workers.dev');
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
        try { navigator.vibrate(duration); } catch (_) {}
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
export function formatPrice(price, currency = '₴') {
    if (typeof window !== 'undefined' && typeof window.formatPrice === 'function') {
        return window.formatPrice(price, currency);
    }
    const num = Number(price) || 0;
    return `${Math.round(num).toLocaleString('ru-RU')} ${currency}`;
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
    if (typeof window !== 'undefined' && typeof window.generateShortId === 'function') {
        return window.generateShortId(prefix);
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
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        } catch (_) {}
    }
    try {
        return JSON.parse(JSON.stringify(obj));
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
        } catch (_) {}
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
    if (!arr || typeof arr.at !== 'function' || arr.length === 0) return undefined;
    return arr.at(-1);
}

/**
 * Returns the first item of an array using ES2022 array.at(0)
 * @param {Array<any>} arr
 * @returns {any}
 */
export function getFirstItem(arr) {
    if (!arr || typeof arr.at !== 'function' || arr.length === 0) return undefined;
    return arr.at(0);
}
