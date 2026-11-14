// ==========================================
// NISHA CATALOG — ЧИСТАЯ РАЗМЕТКА И DOM-СБОРКА КАРТОЧЕК ТОВАРОВ
// ==========================================

import { getCatalogStore } from './catalog-state.js';
import { toCDN } from './media-prefetch.js';
import { hasAction, invokeAction, resolveAction } from '../core/action-registry.js';
import { getRuntimeFavorites } from '../core/runtime-env.js';

function fallbackEscHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escCardHtml(v) {
    return hasAction('escapeHtml') ? invokeAction('escapeHtml', v) : fallbackEscHtml(v);
}

function escCardAttr(v) {
    return hasAction('escapeAttr') ? invokeAction('escapeAttr', v) : fallbackEscHtml(v);
}

/**
 * Читает сохранённую персональную цену по принятому торгу (sessionStorage / localStorage).
 * @param {object} item
 * @returns {object|null}
 */
export function readAcceptedBargain(item) {
    try {
        const rawB = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('accepted_bargain_' + item.id) : null)
            || (typeof localStorage !== 'undefined' ? localStorage.getItem('accepted_bargain_' + item.id) : null);
        return rawB ? JSON.parse(rawB) : null;
    } catch {
        return null;
    }
}

/**
 * Генерирует HTML-разметку статус-бейджей карточки товара (SOLD, RESERVED, TOP, SALE, HOT).
 * @param {object} item
 * @returns {string}
 */
export function buildStatusBadgeHtml(item) {
    if (!item) return '';
    if (item.status === 'sold') {
        return '<div class="sold-badge">SOLD</div>';
    }
    if (item.status === 'reserved') {
        return '<div class="reserved-badge">RESERVED</div>';
    }

    const hasSale = !!item.is_sale;
    const hasHot = (item.views_count || 0) >= 25;
    const isTop = item.is_top === true && item.top_until && Date.parse(item.top_until) > Date.now();
    if (!hasSale && !hasHot && !isTop) return '';

    const parts = [];
    if (isTop) {
        parts.push('<span class="status-item status-top"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> TOP</span>');
    }
    if (hasSale) {
        parts.push('<span class="status-item status-sale">% SALE</span>');
    }
    if (hasHot) {
        const chartSvg = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>';
        parts.push(`<span class="status-item status-hot">${chartSvg} HOT</span>`);
    }
    return `<div class="system-status-bar">${parts.join('<div class="status-divider"></div>')}</div>`;
}

/**
 * Генерирует HTML-разметку цены карточки с учётом принятого торга или скидки.
 * @param {object} item
 * @param {string} [curr='грн']
 * @returns {string}
 */
export function buildCardPriceHtml(item, curr = 'грн') {
    const formatPriceFn = resolveAction('formatPrice') || ((val) => `${val} ${curr}`);

    const savedBargain = readAcceptedBargain(item);
    if (savedBargain && savedBargain.acceptedPrice) {
        const fOldB = formatPriceFn(savedBargain.originalPrice || item.price);
        const fAccB = formatPriceFn(savedBargain.acceptedPrice);
        return `<span class="card-old-price" style="color: #777; text-decoration: line-through; margin-right: 6px;">${fOldB}</span><span class="card-current-price" style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${fAccB}</span>`;
    }
    if (item.is_sale && item.old_price) {
        const fOld = formatPriceFn(item.old_price);
        const fPrice = formatPriceFn(item.price);
        return `<span class="card-old-price" style="color: #4a704a; text-decoration: line-through;">${fOld}</span><span class="card-current-price" style="color: var(--accent-green);">${fPrice}</span>`;
    }
    const fPrice = formatPriceFn(item.price);
    return `<span class="card-current-price" style="color: var(--accent-green);">${fPrice}</span>`;
}

/**
 * Ленивый кэш просмотренных товаров (`nisha_seen_items`) на `window._seenItemsSet`.
 * @returns {Set<string>}
 */
export function getSeenItemsSet() {
    if (!window._seenItemsSet) {
        try {
            const store = getCatalogStore();
            const parsedSeen = store ? store.getJSON('nisha_seen_items', []) : [];
            window._seenItemsSet = new Set(Array.isArray(parsedSeen) ? parsedSeen.map(String) : []);
        } catch {
            window._seenItemsSet = new Set();
        }
    }
    return window._seenItemsSet;
}

/**
 * Создаёт DOM-элемент карточки товара для сетки каталога.
 * @param {object} item
 * @param {number} [idx=0]
 * @returns {HTMLElement|null}
 */
export function buildCardDOM(item, idx = 0) {
    if (!item || !item.id || typeof document === 'undefined') return null;
    const itemIdStr = String(item.id);
    const curr = (typeof getCurrency === 'function') ? getCurrency() : 'грн';
    const sizePrefix = (typeof i18next !== 'undefined') ? i18next.t('grid.size_prefix', { defaultValue: 'Размер: ' }) : 'Размер: ';
    const addToCartText = (typeof i18next !== 'undefined') ? i18next.t('product.add_to_cart', { defaultValue: 'В КОРЗИНУ' }) : 'В КОРЗИНУ';

    const seenSet = getSeenItemsSet();
    const userFavs = getRuntimeFavorites();
    const favSet = new Set(Array.isArray(userFavs) ? userFavs.map(String) : []);

    const badgeHTML = buildStatusBadgeHtml(item);
    const thumbsArray = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails : (item.images && item.images.length > 0 ? item.images : []);
    let slidesStr = '';
    let dotsStr = '';

    const safeBrand = (item.brand || '').trim();
    const safeName = (item.name || '').trim();
    const baseAlt = [safeBrand, safeName].filter(Boolean).join(' ') || 'Винтажная одежда NISHA';
    const cleanAlt = fallbackEscHtml(baseAlt);

    thumbsArray.forEach((thumbUrl, thumbIdx) => {
        const rawVidUrl = (item.images && item.images[thumbIdx]) ? item.images[thumbIdx] : thumbUrl;
        const isVid = typeof rawVidUrl === 'string' && rawVidUrl.endsWith('.mp4');
        const cdnThumb = toCDN(thumbUrl, { isThumb: true });
        const cdnVidUrl = toCDN(rawVidUrl);
        const slideAlt = cleanAlt + (thumbIdx > 0 ? ` - фото ${thumbIdx + 1}` : '');

        if (isVid) {
            slidesStr += `
                <div class="card-slide ${thumbIdx === 0 ? 'img-8bit-loading' : ''}" style="background: #0a0a0a;">
                    <video class="grid-lazy-video" src="${escCardAttr(cdnVidUrl)}#t=0.001" muted loop playsinline preload="none" style="width:100%; height:100%; object-fit:cover; pointer-events:none; opacity:0;"></video>
                </div>`;
        } else if (thumbIdx === 0) {
            const firstLoadAttr = (idx < 4) ? 'fetchpriority="high"' : 'loading="lazy"';
            slidesStr += `
                <div class="card-slide img-8bit-loading">
                   <img class="card-slide-img" src="${escCardAttr(cdnThumb)}" data-fallback-src="${escCardAttr(cdnVidUrl || '')}" ${firstLoadAttr} decoding="async" alt="${slideAlt}">
                </div>`;
        } else {
            slidesStr += `
                <div class="card-slide">
                   <img class="card-slide-img" data-src="${escCardAttr(cdnThumb)}" data-fallback-src="${escCardAttr(cdnVidUrl || '')}" loading="lazy" decoding="async" alt="${slideAlt}">
                </div>`;
        }
        dotsStr += `<div class="card-dot ${thumbIdx === 0 ? 'active' : ''}"></div>`;
    });

    const starClass = favSet.has(itemIdStr) ? 'fav-star active' : 'fav-star';
    const isUnseen = !seenSet.has(itemIdStr) && item.status === 'available';
    const pulseClass = isUnseen ? 'unseen-pulse' : '';
    const statusClass = item.status === 'sold' ? 'sold-out' : (item.status === 'reserved' ? 'reserved-item' : '');

    const card = document.createElement('div');
    card.className = ['item-card', statusClass, pulseClass].filter(Boolean).join(' ');
    card.setAttribute('data-id', item.id);
    if (item && item.id && card.style && typeof card.style.setProperty === 'function') {
        const safeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        card.style.setProperty('view-transition-name', 'item-' + safeId);
    }

    const priceHTML = buildCardPriceHtml(item, curr);
    const safeItemIdAttr = escCardAttr(item.id);

    let controlsHTML = '';
    if (thumbsArray.length > 1) {
        controlsHTML = `
            <div class="grid-slider-btn prev" role="button" aria-label="Предыдущее фото" data-action="scroll-grid-slider" data-hover-action="preload-grid-slide" data-id="${safeItemIdAttr}" data-dir="-1">&#10094;</div>
            <div class="grid-slider-btn next" role="button" aria-label="Следующее фото" data-action="scroll-grid-slider" data-hover-action="preload-grid-slide" data-id="${safeItemIdAttr}" data-dir="1">&#10095;</div>
            <div class="card-dots-container" id="dots-${safeItemIdAttr}">${dotsStr}</div>
        `;
    }

    card.innerHTML = `
        ${badgeHTML}
        <div class="${starClass}" role="button" aria-label="В избранное" data-action="toggle-fav" data-id="${safeItemIdAttr}">★</div>
        <div class="card-slider-wrapper">
            <div class="card-slider-container" id="slider-${safeItemIdAttr}" data-item-id="${safeItemIdAttr}">
                ${slidesStr}
            </div>
            ${controlsHTML}
        </div>
        <div class="item-info">
            <h3 class="item-title">${escCardHtml(item.name || '')}</h3>
            <div class="item-price">${priceHTML}</div>
            <div class="item-size"><span data-i18n="grid.size_prefix">${escCardHtml(sizePrefix)}</span>${escCardHtml(item.size || '')}</div>
            <div class="item-footer"><span>${escCardHtml(item.brand || '')}</span><span>${escCardHtml(item.condition || '')}</span></div>
        </div>
        <button class="grid-cart-btn" data-i18n="product.add_to_cart" style="${item.status === 'sold' ? 'display:none;' : ''}" data-action="add-to-cart" data-id="${safeItemIdAttr}">${escCardHtml(addToCartText)}</button>
    `;

    return card;
}
