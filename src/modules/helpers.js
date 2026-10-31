// ==========================================
// NISHA STORE - MODULAR CORE HELPERS FACADE
// Safe, typed ES module exports for utilities & sanitization
// ==========================================

/**
 * Rewrites Supabase asset URL to Worker CDN URL
 * @param {string} url
 * @returns {string}
 */
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
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
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
