// ==========================================
// NISHA CORE HELPERS: CDN MEDIA, XSS SANITIZATION & LAZY RESOURCE LOADERS
// ==========================================

import { hasAction, invokeAction, registerActions } from './action-registry.js';
import { canParseURL, safeEncodeURIComponent } from './helpers-core-utils.js';

/**
 * Rewrites Supabase Storage URLs to CDN and appends responsive image optimization query params.
 * @param {string} url
 * @param {{ isThumb?: boolean, width?: number, w?: number, height?: number, h?: number, quality?: number, q?: number, format?: string, fmt?: string }} [options={}]
 * @returns {string}
 */
export function toCDN(url, options = {}) {
    if (!url || typeof url !== 'string') return '';
    let result = url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://cdn.nisha-store.shop');

    // Return plain CDN URL without extra query parameters when no options are provided
    if (!options || typeof options !== 'object' || Object.keys(options).length === 0) {
        return result;
    }

    // Skip video and vector graphics
    if (result.endsWith('.mp4') || result.endsWith('.webm') || result.endsWith('.svg')) {
        return result;
    }

    // 1. Automatic thumbnail resolution inside items-images
    const isThumb = options.isThumb === true || (typeof options.width === 'number' && options.width <= 480);
    if (isThumb && result.includes('/items-images/item_') && !result.includes('/items-images/thumb_item_')) {
        result = result.replace('/items-images/item_', '/items-images/thumb_item_');
    }

    // 2. Edge Image Resizing params
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
if (typeof window !== 'undefined') window.toCDN = toCDN;
if (typeof globalThis !== 'undefined') globalThis.toCDN = toCDN;

/**
 * Alias for toCDN responsive image optimizer.
 * @param {string} url
 * @param {Object} [options={}]
 * @returns {string}
 */
export function getOptimizedCDNImageUrl(url, options = {}) {
    return toCDN(url, options);
}
if (typeof window !== 'undefined') window.getOptimizedCDNImageUrl = getOptimizedCDNImageUrl;
if (typeof globalThis !== 'undefined') globalThis.getOptimizedCDNImageUrl = getOptimizedCDNImageUrl;

/**
 * Generates responsive srcset string for catalog/product images.
 * @param {string} url
 * @param {number[]} [widths=[320, 480, 768]]
 * @returns {string}
 */
export function getImageSrcSet(url, widths = [320, 480, 768]) {
    if (!url || typeof url !== 'string' || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.svg')) return '';
    return widths
        .map(w => `${toCDN(url, { width: w, quality: 85, format: 'webp' })} ${w}w`)
        .join(', ');
}
if (typeof window !== 'undefined') window.getImageSrcSet = getImageSrcSet;
if (typeof globalThis !== 'undefined') globalThis.getImageSrcSet = getImageSrcSet;

/**
 * Escapes HTML special characters to neutralize XSS injection.
 * @param {*} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
if (typeof window !== 'undefined') window.escapeHtml = escapeHtml;

/**
 * Escapes attribute values safely.
 * @param {*} str
 * @returns {string}
 */
export function escapeAttr(str) {
    return escapeHtml(str);
}
if (typeof window !== 'undefined') window.escapeAttr = escapeAttr;

/**
 * Escapes strings embedded into JS string literals.
 * @param {*} str
 * @returns {string}
 */
export function escapeJsString(str) {
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
if (typeof window !== 'undefined') window.escapeJsString = escapeJsString;

/**
 * Sanitizes rich/plain user text using DOMPurify when present, else HTML-escaping.
 * @param {*} value
 * @returns {string}
 */
export function sanitizeText(value) {
    if (value == null) return '';
    const str = String(value);
    if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
        return DOMPurify.sanitize(str);
    }
    return escapeHtml(str);
}
if (typeof window !== 'undefined') window.sanitizeText = sanitizeText;
if (typeof globalThis !== 'undefined') globalThis.sanitizeText = sanitizeText;

/**
 * Validates and normalizes an HTML media URL, allowing only http/https/data protocols.
 * @param {string} rawUrl
 * @returns {string|null}
 */
export function sanitizeHtmlMediaUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    try {
        const cleaned = (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function')
            ? window.DOMPurify.sanitize(rawUrl)
            : rawUrl;
        const trimmed = String(cleaned || '').trim();
        if (!trimmed) return null;
        const base = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null')
            ? window.location.origin
            : 'https://www.nisha-store.shop';
        if (!canParseURL(trimmed, base)) return null;
        const u = new URL(trimmed, base);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'data:') {
            return u.href;
        }
        return null;
    } catch (_) {
        return null;
    }
}
if (typeof window !== 'undefined') window.sanitizeHtmlMediaUrl = sanitizeHtmlMediaUrl;

/**
 * Returns true if rawUrl resolves to a safe media URL.
 * @param {string} rawUrl
 * @returns {boolean}
 */
export function isSafeMediaUrl(rawUrl) {
    return Boolean(sanitizeHtmlMediaUrl(rawUrl));
}
if (typeof window !== 'undefined') window.isSafeMediaUrl = isSafeMediaUrl;

/**
 * Safe getter for active Supabase client.
 * @returns {Object|null}
 */
export function getSupabase() {
    return (typeof window !== 'undefined' && window._supabase)
        ? window._supabase
        : (typeof _supabase !== 'undefined' ? _supabase : null);
}
if (typeof window !== 'undefined') window.getSupabase = getSupabase;

/**
 * Safe getter for active catalog array.
 * @returns {Array}
 */
export function getCatalog() {
    return (typeof window !== 'undefined' && window.allItems)
        ? window.allItems
        : (typeof allItems !== 'undefined' ? allItems : []);
}
if (typeof window !== 'undefined') window.getCatalog = getCatalog;

/**
 * Resolves the primary optimized image URL for a catalog item.
 * @param {Object} item
 * @param {boolean} [thumb=true]
 * @returns {string}
 */
export function getOptimizedImg(item, thumb = true) {
    if (hasAction('getOptimizedImageUrl')) {
        return invokeAction('getOptimizedImageUrl', item, thumb);
    }
    return (item && item.images && item.images[0])
        ? toCDN(item.images[0])
        : '';
}
if (typeof window !== 'undefined') window.getOptimizedImg = getOptimizedImg;

registerActions({
    toCDN,
    escapeHtml,
    escapeAttr,
    escapeJsString,
    sanitizeText,
    sanitizeHtmlMediaUrl,
    isSafeMediaUrl,
    getSupabase,
    getCatalog,
    getOptimizedImg,
    loadExternalScript,
    loadExternalStyle,
    ensurePhotoSwipe
});

// --- LAZY EXTERNAL SCRIPT / STYLE LOADERS ---
const _loadedExternalScripts = {};

/**
 * Lazily loads an external script once and caches its completion promise.
 * @param {string} src
 * @returns {Promise<void>}
 */
export function loadExternalScript(src) {
    if (_loadedExternalScripts[src]) return _loadedExternalScripts[src];
    const { promise, resolve, reject } = Promise.withResolvers();
    _loadedExternalScripts[src] = promise;
    try {
        if (typeof document === 'undefined') {
            resolve();
            return promise;
        }
        const existing = typeof document.querySelector === 'function' ? document.querySelector(`script[src="${src}"]`) : null;
        if (existing) {
            resolve();
            return promise;
        }
        const targetEl = document.head || document.body || document.documentElement;
        if (!targetEl || typeof targetEl.appendChild !== 'function' || typeof document.createElement !== 'function') {
            resolve();
            return promise;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = (err) => {
            delete _loadedExternalScripts[src];
            reject(err);
        };
        targetEl.appendChild(s);
    } catch (err) {
        delete _loadedExternalScripts[src];
        reject(err);
    }
    return promise;
}
if (typeof window !== 'undefined') window.loadExternalScript = loadExternalScript;

const _loadedExternalStyles = {};

/**
 * Lazily loads an external stylesheet once and caches its promise.
 * @param {string} href
 * @returns {Promise<void>}
 */
export function loadExternalStyle(href) {
    if (_loadedExternalStyles[href]) return _loadedExternalStyles[href];
    const { promise, resolve } = Promise.withResolvers();
    _loadedExternalStyles[href] = promise;
    try {
        if (typeof document === 'undefined') {
            resolve();
            return promise;
        }
        const existing = typeof document.querySelector === 'function' ? document.querySelector(`link[href="${href}"]`) : null;
        if (existing) {
            resolve();
            return promise;
        }
        const targetEl = document.head || document.body || document.documentElement;
        if (!targetEl || typeof targetEl.appendChild !== 'function' || typeof document.createElement !== 'function') {
            resolve();
            return promise;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = () => resolve();
        targetEl.appendChild(link);
    } catch (_) {
        resolve();
    }
    return promise;
}
if (typeof window !== 'undefined') window.loadExternalStyle = loadExternalStyle;

let _photoSwipeInitPromise = null;

/**
 * Lazily imports PhotoSwipe and its lightbox CSS on demand with CDN fallback.
 * @returns {Promise<*>}
 */
export async function ensurePhotoSwipe() {
    if (typeof window !== 'undefined' && window.PhotoSwipeLightbox) return window.PhotoSwipeLightbox;
    if (_photoSwipeInitPromise) return _photoSwipeInitPromise;
    _photoSwipeInitPromise = (async () => {
        try {
            const [lightboxMod, pswpMod] = await Promise.all([
                import('photoswipe/lightbox'),
                import('photoswipe'),
                import('photoswipe/style.css')
            ]);
            const Lightbox = lightboxMod.default || lightboxMod.PhotoSwipeLightbox || lightboxMod;
            const PhotoSwipe = pswpMod.default || pswpMod.PhotoSwipe || pswpMod;
            if (typeof window !== 'undefined') {
                window.PhotoSwipeLightbox = Lightbox;
                window.PhotoSwipe = PhotoSwipe;
            }
            return Lightbox;
        } catch (e) {
            console.warn('[PhotoSwipe] Local module load failed, attempting CDN fallback:', e);
            try {
                loadExternalStyle('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.css');
                const [mod, pswpMod] = await Promise.all([
                    import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe-lightbox.esm.min.js'),
                    import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.esm.min.js')
                ]);
                const Lightbox = mod.default || mod.PhotoSwipeLightbox || mod;
                const PhotoSwipe = pswpMod.default || pswpMod.PhotoSwipe || pswpMod;
                if (typeof window !== 'undefined') {
                    window.PhotoSwipeLightbox = Lightbox;
                    window.PhotoSwipe = PhotoSwipe;
                }
                return Lightbox;
            } catch (cdnErr) {
                console.error('[PhotoSwipe] All loaders failed:', cdnErr);
                _photoSwipeInitPromise = null;
                return null;
            }
        }
    })();
    return _photoSwipeInitPromise;
}
if (typeof window !== 'undefined') window.ensurePhotoSwipe = ensurePhotoSwipe;
