// @ts-check
// ==========================================
// NISHA CORE — PURE ES2025 NATIVE PRIMITIVES (0 side effects)
// RegExp.escape, Error.isError, Promise.try, Uint8Array.fromBase64 / toBase64
// с безопасными кроссбраузерными фоллбэками.
// ==========================================

/**
 * Escapes special RegExp characters using ES2025 RegExp.escape() with fallback.
 * @param {string} str
 * @returns {string}
 */
export function escapeRegExp(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    const nativeEscape = /** @type {any} */ (RegExp).escape;
    if (typeof nativeEscape === 'function') {
        return nativeEscape(s);
    }
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cross-realm error check using ES2025 Error.isError() with instanceof fallback.
 * Works reliably across iframes, Web Workers, and VM contexts.
 * @param {unknown} value
 * @returns {value is Error}
 */
export function isErrorLike(value) {
    const nativeIsError = /** @type {any} */ (Error).isError;
    if (typeof nativeIsError === 'function') {
        return Boolean(nativeIsError(value));
    }
    return value instanceof Error || Object.prototype.toString.call(value) === '[object Error]';
}

/**
 * Executes a sync or async function inside a unified Promise pipeline (ES2025 Promise.try with fallback).
 * @template T
 * @param {(...args: any[]) => T | Promise<T>} fn
 * @param {...any} args
 * @returns {Promise<T>}
 */
export function promiseTry(fn, ...args) {
    const nativeTry = /** @type {any} */ (Promise).try;
    if (typeof nativeTry === 'function') {
        return nativeTry.call(Promise, fn, ...args);
    }
    return new Promise((resolve) => resolve(fn(...args)));
}

/**
 * Decodes a Base64 / Base64URL string into Uint8Array using ES2025 Uint8Array.fromBase64() with atob() fallback.
 * @param {string} base64
 * @param {{ alphabet?: 'base64' | 'base64url' }} [options={}]
 * @returns {Uint8Array | null}
 */
export function base64ToBytes(base64, options = {}) {
    if (typeof base64 !== 'string') return null;
    const trimmed = base64.trim();
    if (!trimmed) return new Uint8Array(0);
    const alphabet = options.alphabet === 'base64url' ? 'base64url' : 'base64';
    try {
        const nativeFromBase64 = /** @type {any} */ (Uint8Array).fromBase64;
        if (typeof nativeFromBase64 === 'function') {
            return nativeFromBase64(trimmed, { alphabet });
        }
        if (typeof globalThis.atob === 'function') {
            let normalized = trimmed;
            if (alphabet === 'base64url') {
                normalized = normalized.replaceAll('-', '+').replaceAll('_', '/');
                const pad = normalized.length % 4;
                if (pad) normalized += '='.repeat(4 - pad);
            }
            const binary = globalThis.atob(normalized);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        }
    } catch {
        return null;
    }
    return null;
}

/**
 * Encodes a Uint8Array into Base64 / Base64URL using ES2025 Uint8Array.prototype.toBase64() with btoa() fallback.
 * @param {Uint8Array} bytes
 * @param {{ alphabet?: 'base64' | 'base64url', omitPadding?: boolean }} [options={}]
 * @returns {string}
 */
export function bytesToBase64(bytes, options = {}) {
    if (!(bytes instanceof Uint8Array)) return '';
    const alphabet = options.alphabet === 'base64url' ? 'base64url' : 'base64';
    const omitPadding = Boolean(options.omitPadding);
    try {
        const bytesAny = /** @type {any} */ (bytes);
        if (typeof bytesAny.toBase64 === 'function') {
            return bytesAny.toBase64({ alphabet, omitPadding });
        }
        if (typeof globalThis.btoa === 'function') {
            let binary = '';
            for (let i = 0; i < bytes.length; i += 1) {
                binary += String.fromCharCode(bytes[i]);
            }
            let out = globalThis.btoa(binary);
            if (alphabet === 'base64url') {
                out = out.replaceAll('+', '-').replaceAll('/', '_');
            }
            if (omitPadding) {
                out = out.replace(/=+$/, '');
            }
            return out;
        }
    } catch {
        return '';
    }
    return '';
}
