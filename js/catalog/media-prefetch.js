// ==========================================
// NISHA CATALOG — CDN, MEDIA SANITIZATION & IMAGE PREFETCH
// ==========================================

import { hasAction, invokeAction, registerActions, resolveAction } from '../core/action-registry.js';

// Глобальный перехватчик URL для CDN
if (typeof window !== 'undefined') {
    window.toCDN = window.toCDN || function(url, options = {}) {
        if (!url || typeof url !== 'string') return '';
        let result = url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://cdn.nisha-store.shop');
        if (!options || typeof options !== 'object' || Object.keys(options).length === 0) return result;
        if (result.endsWith('.mp4') || result.endsWith('.webm') || result.endsWith('.svg')) return result;
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
            const _enc = (v) => (hasAction('safeEncodeURIComponent') ? invokeAction('safeEncodeURIComponent', v) : encodeURIComponent(v));
            if (width) params.push(`w=${_enc(width)}`);
            if (height) params.push(`h=${_enc(height)}`);
            if (quality) params.push(`q=${_enc(quality)}`);
            if (format) params.push(`fmt=${_enc(format)}`);
            result += sep + params.join('&');
        }
        return result;
    };
}

/**
 * Прокси для глобального CDN-конвертера URL.
 * @param {string} url
 * @param {object} [options]
 * @returns {string}
 */
export function toCDN(url, options) {
    const cdnFn = resolveAction('toCDN');
    return typeof cdnFn === 'function' && cdnFn !== toCDN
        ? cdnFn(url, options)
        : (url || '');
}

/**
 * Возвращает оптимизированный URL изображения (превью или оригинал) через CDN.
 * @param {object} item
 * @param {boolean} [wantsThumb=false]
 * @returns {string}
 */
export function getOptimizedImageUrl(item, wantsThumb = false) {
    if (!item || typeof item !== 'object') return '';
    const isValid = (url) => typeof url === 'string' && url.trim().length > 10;

    let resultUrl = '';

    if (wantsThumb && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
        if (isValid(item.thumbnails.at(0))) resultUrl = item.thumbnails.at(0);
    }

    if (!resultUrl && Array.isArray(item.images) && item.images.length > 0) {
        if (isValid(item.images.at(0))) resultUrl = item.images.at(0);
    }

    return toCDN(resultUrl, wantsThumb ? { isThumb: true } : {});
}

// ОПТИМИЗАЦИЯ PREFETCH: отложенная предзагрузка картинок (задержка 100мс на hover для мгновенного 0мс открытия товара)
let _prefetchDebounceTimer = null;
let _prefetchPendingId = null;

/**
 * Отложенно предзагружает миниатюры и основные фото товара при наведении курсора.
 * @param {string|number} id
 */
export function prefetchItemImages(id) {
    if (hasAction('prewarmProductModal')) {
        invokeAction('prewarmProductModal', id);
        return;
    }
    if (typeof window === 'undefined') return;
    if (!window._prefetchedItems) window._prefetchedItems = new Set();
    if (window._prefetchedItems.has(id)) return;

    clearTimeout(_prefetchDebounceTimer);
    _prefetchPendingId = id;
    _prefetchDebounceTimer = setTimeout(() => {
        if (window._prefetchedItems.has(id)) return;
        window._prefetchedItems.add(id);
        const catalog = typeof getCatalog === 'function' ? getCatalog() : (window.allItems || []);
        const item = catalog.find(i => String(i.id) === String(id));
        if (item) {
            // Предзагрузка миниатюр карточки для мгновенного свайпа в сетке
            if (item.thumbnails && item.thumbnails.length > 1) {
                item.thumbnails.slice(1, 4).forEach(url => {
                    if (url && typeof url === 'string' && !url.endsWith('.mp4')) {
                        const img = new Image();
                        img.decoding = 'async';
                        img.src = toCDN(url, { isThumb: true });
                    }
                });
            }
            // Предзагрузка фото высокого качества для мгновенного открытия модалки (0 мс)
            if (item.images && item.images.length > 0) {
                item.images.slice(0, 2).forEach(url => {
                    if (url && typeof url === 'string' && !url.endsWith('.mp4')) {
                        const img = new Image();
                        img.decoding = 'async';
                        img.src = toCDN(url);
                    }
                });
            }
        }
    }, 100);
}

/**
 * Отменяет запланированный prefetch картинок при уходе курсора с карточки.
 * @param {string|number} id
 */
export function cancelPrefetchItemImages(id) {
    if (_prefetchPendingId === id) {
        clearTimeout(_prefetchDebounceTimer);
        _prefetchPendingId = null;
    }
}

/**
 * Валидирует и санитайзит URL медиаресурсов с помощью URL.canParse и DOMPurify.
 * @param {string} rawUrl
 * @returns {string|null}
 */
export function sanitizeHtmlMediaUrl(rawUrl) {
    const sanitizeFn = resolveAction('sanitizeHtmlMediaUrl');
    if (typeof sanitizeFn === 'function' && sanitizeFn !== sanitizeHtmlMediaUrl) {
        return sanitizeFn(rawUrl);
    }
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    try {
        const cleaned = (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function')
            ? window.DOMPurify.sanitize(rawUrl)
            : rawUrl;
        const trimmed = String(cleaned || '').trim();
        if (!trimmed) return null;
        const base = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://www.nisha-store.shop';
        if (typeof canParseURL === 'function') {
            if (!canParseURL(trimmed, base)) return null;
        } else if (typeof URL !== 'undefined' && typeof URL.canParse === 'function') {
            if (!URL.canParse(trimmed, base)) return null;
        }
        const u = new URL(trimmed, base);
        if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'data:') {
            return u.href;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Возвращает true, если URL прошёл проверку протокола и структуры.
 * @param {string} rawUrl
 * @returns {boolean}
 */
export function isSafeMediaUrl(rawUrl) {
    return Boolean(sanitizeHtmlMediaUrl(rawUrl));
}

registerActions({
    getOptimizedImageUrl,
    prefetchItemImages,
    cancelPrefetchItemImages,
    isSafeMediaUrl
});

if (typeof window !== 'undefined') {
    window.getOptimizedImageUrl = getOptimizedImageUrl;
    window.prefetchItemImages = prefetchItemImages;
    window.cancelPrefetchItemImages = cancelPrefetchItemImages;
    window.isSafeMediaUrl = isSafeMediaUrl;
}
