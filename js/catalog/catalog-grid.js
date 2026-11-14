// ==========================================
// NISHA CATALOG — СЕТКА КАРТОЧЕК, ПАГИНАЦИЯ И ВЗАИМОДЕЙСТВИЯ
// ==========================================

import { getCatalogStore } from './catalog-state.js';
import { saveCurrentFeedScrollState } from './scroll-restoration.js';
import {
    toCDN,
    sanitizeHtmlMediaUrl,
    prefetchItemImages,
    cancelPrefetchItemImages
} from './media-prefetch.js';
import {
    isItemMeasurementsTooltipVisible
} from './measurements.js';
import { hasAction, invokeAction, registerActions, resolveAction } from '../core/action-registry.js';

let itemsPageSize = typeof window !== 'undefined' && window.innerWidth <= 900 ? 12 : 15;
let changePageTimeout = null;
let _renderBatchSeq = 0;

function readAcceptedBargain(item) {
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

function getSeenItemsSet() {
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

function markCardImageLoaded(img) {
    if (!img) return;
    img.style.opacity = '1';
    if (img.parentElement) {
        img.parentElement.classList.remove('img-8bit-loading');
        img.parentElement.classList.add('img-8bit-loaded');
    }
}

// ==========================================
// ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ КАРТОЧКИ В DOM (БЕЗ ПЕРЕРИСОВКИ ВСЕЙ СЕТКИ)
// ==========================================

/**
 * Точечно обновляет статус, цену, заголовок и модалку карточки товара в DOM.
 * @param {object} item
 */
export function updateCardDOM(item) {
    if (!item || !item.id || typeof document === 'undefined') return;

    if (Array.isArray(window.filteredItems)) {
        const fIdx = window.filteredItems.findIndex(fi => fi && String(fi.id) === String(item.id));
        if (fIdx !== -1 && window.filteredItems[fIdx] !== item) {
            Object.assign(window.filteredItems[fIdx], item);
        }
    }

    const cards = document.querySelectorAll(`.item-card[data-id="${item.id}"]`);
    const curr = (typeof getCurrency === 'function') ? getCurrency() : 'грн';
    const sizePrefix = (typeof i18next !== 'undefined') ? i18next.t('grid.size_prefix', { defaultValue: 'Размер: ' }) : 'Размер: ';

    if (cards && cards.length > 0) {
        cards.forEach(card => {
            // 1. Очищаем старые бейджи статуса
            const oldBadges = card.querySelectorAll('.sold-badge, .reserved-badge, .system-status-bar');
            oldBadges.forEach(b => b.remove());
            card.classList.remove('sold-out', 'reserved-item');

            const cartBtn = card.querySelector('.grid-cart-btn');

            // 2. Обрабатываем статус и бейджи (SOLD / RESERVED / TOP / SALE / HOT)
            if (item.status === 'sold') {
                card.classList.add('sold-out');
                card.classList.remove('unseen-pulse');
                if (cartBtn) cartBtn.style.display = 'none';
            } else if (item.status === 'reserved') {
                card.classList.add('reserved-item');
                card.classList.remove('unseen-pulse');
                if (cartBtn) cartBtn.style.display = '';
            } else if (cartBtn) {
                cartBtn.style.display = '';
            }

            const badgeHTML = buildStatusBadgeHtml(item);
            if (badgeHTML) {
                card.insertAdjacentHTML('afterbegin', badgeHTML);
            }

            // 3. Обновляем цену, название, размер, бренд и состояние в карточке
            const priceDiv = card.querySelector('.item-price');
            if (priceDiv) {
                priceDiv.innerHTML = buildCardPriceHtml(item, curr);
            }

            const titleEl = card.querySelector('.item-title');
            if (titleEl && item.name) {
                titleEl.textContent = item.name;
            }
            const sizeEl = card.querySelector('.item-size');
            if (sizeEl && item.size !== undefined) {
                const safeSize = hasAction('escapeHtml') ? invokeAction('escapeHtml', item.size || '') : (item.size || '');
                sizeEl.innerHTML = `<span data-i18n="grid.size_prefix">${sizePrefix}</span>${safeSize}`;
            }
            const footerEl = card.querySelector('.item-footer');
            if (footerEl && (item.brand !== undefined || item.condition !== undefined)) {
                const safeBrand = hasAction('escapeHtml') ? invokeAction('escapeHtml', item.brand || '') : (item.brand || '');
                const safeCond = hasAction('escapeHtml') ? invokeAction('escapeHtml', item.condition || '') : (item.condition || '');
                footerEl.innerHTML = `<span>${safeBrand}</span><span>${safeCond}</span>`;
            }
        });
    }

    // 4. Если этот товар открыт в детальной модалке (productModal)
    const activeModal = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    if (activeModal && String(activeModal.id) === String(item.id)) {
        Object.assign(activeModal, item);
        const modalCartBtn = document.getElementById('modalCartBtn');
        const modalPriceEl = document.getElementById('modalItemPrice');
        const modalTitleEl = document.getElementById('modalItemTitle');
        const modalViewsEl = document.getElementById('modalItemViews');
        if (modalTitleEl && item.name) modalTitleEl.textContent = item.name;
        if (modalViewsEl && item.views_count !== undefined) modalViewsEl.textContent = item.views_count || 0;
        if (modalCartBtn) {
            if (item.status === 'sold') {
                modalCartBtn.style.display = 'none';
            } else {
                modalCartBtn.style.display = 'block';
                const userCart = (typeof getActiveCart === 'function') ? getActiveCart() : (window.cart || []);
                const isInCart = userCart.some(i => String(i.id) === String(item.id));
                const inCartText = (typeof i18next !== 'undefined') ? i18next.t('product.in_cart', { defaultValue: 'В КОРЗИНЕ' }) : 'В КОРЗИНЕ';
                const addToCartText = (typeof i18next !== 'undefined') ? i18next.t('product.add_to_cart', { defaultValue: 'В КОРЗИНУ' }) : 'В КОРЗИНУ';
                modalCartBtn.innerText = isInCart ? inCartText : addToCartText;
            }
        }
        if (modalPriceEl) {
            const isHackedActive = window.isHacked || (typeof isHacked !== 'undefined' && isHacked);
            const finalPrice = isHackedActive ? Math.floor(item.price * 0.9) : item.price;
            modalPriceEl.innerText = hasAction('formatPrice') ? invokeAction('formatPrice', finalPrice) : (finalPrice + ' ' + curr);
        }
    }
}

// Умный плеер для видео в сетке (IntersectionObserver с поддержкой Network Information API)
export const gridVideoObserver = (typeof IntersectionObserver !== 'undefined')
    ? new IntersectionObserver((entries) => {
        const conn = (typeof navigator !== 'undefined') ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection) : null;
        const isSaveData = hasAction('isSaveDataMode')
            ? invokeAction('isSaveDataMode')
            : Boolean(conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'));

        entries.forEach(entry => {
            const video = entry.target;
            if (entry.isIntersecting && !document.hidden && !isSaveData) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
        });
    }, { rootMargin: '50px' })
    : null;

if (typeof document !== 'undefined') {
    // Пауза видео при переключении вкладки браузера
    document.addEventListener('visibilitychange', () => {
        const videos = document.querySelectorAll('video');
        if (document.hidden) {
            videos.forEach(v => {
                if (!v.paused) {
                    v._wasPlaying = true;
                    v.pause();
                }
            });
        } else {
            videos.forEach(v => {
                if (v._wasPlaying) {
                    delete v._wasPlaying;
                    if (v.classList.contains('modal-video-player')) {
                        const modal = document.getElementById('productModal');
                        if (modal && modal.style.display !== 'none') {
                            const slide = v.closest('.slide');
                            const slides = Array.from(document.querySelectorAll('#sliderWrapper .slide'));
                            if (slides.indexOf(slide) === window.currentSlide) {
                                v.play().catch(() => {});
                            }
                        }
                    } else {
                        const rect = v.getBoundingClientRect();
                        if (rect.top < window.innerHeight + 50 && rect.bottom > -50) {
                            v.play().catch(() => {});
                        }
                    }
                }
            });
        }
    });
}

/**
 * Переключает страницу каталога на ПК с плавным переходом и прокруткой к верху сетки.
 * @param {number} step
 */
export function changePage(step) {
    window.currentPage += step;
    const grid = document.getElementById('itemsGrid');

    if (grid) {
        grid.classList.add('fade-out');
    }

    clearTimeout(changePageTimeout);
    changePageTimeout = setTimeout(() => {
        renderNextBatch();

        const sortingEl = document.querySelector('.sorting');
        if (sortingEl) {
            const y = sortingEl.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }

        if (grid) {
            requestAnimationFrame(() => {
                grid.classList.remove('fade-out');
            });
        }
    }, 300);
}

/**
 * Мгновенно активирует ленивые слайды внутри карточки при первом взаимодействии.
 * @param {HTMLElement} target
 * @param {boolean} [prioritizeNext=false]
 */
export function activateCardSlides(target, prioritizeNext = false) {
    if (!target) return;
    const wrapper = (target.classList && target.classList.contains('card-slider-wrapper'))
        ? target
        : (target.closest && target.closest('.card-slider-wrapper')) || (target.querySelector && target.querySelector('.card-slider-wrapper'));
    if (!wrapper) return;
    if (prioritizeNext && !wrapper._secondSlidePrioritized) {
        wrapper._secondSlidePrioritized = true;
        const secondImg = wrapper.querySelector('.card-slide:nth-child(2) img.card-slide-img');
        if (secondImg && !secondImg.complete) {
            secondImg.fetchPriority = 'high';
            secondImg.loading = 'eager';
        }
    }
    if (wrapper._slidesActivated) return;
    wrapper._slidesActivated = true;
    const lazyImgs = wrapper.querySelectorAll('img[data-src]');
    for (let i = 0; i < lazyImgs.length; i++) {
        const img = lazyImgs[i];
        const rawSrc = img.getAttribute('data-src');
        const safeSrc = sanitizeHtmlMediaUrl(rawSrc);
        if (safeSrc) {
            if (prioritizeNext && i === 0) {
                img.fetchPriority = 'high';
                img.loading = 'eager';
            }
            if (img.parentElement && !img.parentElement.classList.contains('img-8bit-loaded')) {
                img.parentElement.classList.add('img-8bit-loading');
            }
            img.src = safeSrc;
            img.removeAttribute('data-src');
            if (img.complete && img.naturalWidth > 0) {
                markCardImageLoaded(img);
            }
        }
    }
}

let _gridDelegationInitialized = false;

/**
 * Инициализирует единое делегирование событий на сетке `#itemsGrid`.
 */
export function initGridEventDelegation() {
    if (typeof document === 'undefined') return;
    const grid = document.getElementById('itemsGrid');
    if (!grid || _gridDelegationInitialized) return;
    _gridDelegationInitialized = true;

    // 1. Тултип замеров и предзагрузка картинок на десктопе
    let currentTooltipCard = null;

    grid.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.item-card');
        if (!card) return;
        activateCardSlides(card);

        if (card !== currentTooltipCard) {
            currentTooltipCard = card;
            const id = card.getAttribute('data-id');
            if (id) {
                if (hasAction('prewarmProductModal')) invokeAction('prewarmProductModal', id);
                else prefetchItemImages(id);
            }
        }

        const isCartBtn = !!(e.target && typeof e.target.closest === 'function' && e.target.closest('.grid-cart-btn, [data-action="add-to-cart"]'));
        if (isCartBtn) {
            invokeAction('hideItemMeasurementsTooltip');
            return;
        }

        if (!isItemMeasurementsTooltipVisible()) {
            const id = card.getAttribute('data-id');
            const item = window.allItems && window.allItems.find(i => String(i.id) === String(id));
            if (item) {
                invokeAction('showItemMeasurementsTooltip', item, e);
            }
        }
    });

    grid.addEventListener('mousemove', (e) => {
        if (!currentTooltipCard) return;
        const isCartBtn = !!(e.target && typeof e.target.closest === 'function' && e.target.closest('.grid-cart-btn, [data-action="add-to-cart"]'));
        if (isCartBtn) {
            if (isItemMeasurementsTooltipVisible()) {
                invokeAction('hideItemMeasurementsTooltip');
            }
            return;
        }

        if (!isItemMeasurementsTooltipVisible()) {
            const id = currentTooltipCard.getAttribute('data-id');
            const item = window.allItems && window.allItems.find(i => String(i.id) === String(id));
            if (item) {
                invokeAction('showItemMeasurementsTooltip', item, e);
            }
        }

        invokeAction('moveItemMeasurementsTooltip', e);
    });

    grid.addEventListener('mouseout', (e) => {
        if (!currentTooltipCard) return;
        if (!e.relatedTarget || !currentTooltipCard.contains(e.relatedTarget)) {
            const leavingId = currentTooltipCard.getAttribute('data-id');
            if (leavingId) {
                invokeAction('cancelPrewarmProductModal', leavingId);
                if (hasAction('cancelPrefetchItemImages')) invokeAction('cancelPrefetchItemImages', leavingId);
                else cancelPrefetchItemImages(leavingId);
            }
            currentTooltipCard = null;
            invokeAction('hideItemMeasurementsTooltip');
        }
    });

    grid.addEventListener('click', () => {
        invokeAction('hideItemMeasurementsTooltip');
    });

    // 2. Свайп и дабл-тап лайк по карточке товара
    let isDraggingSlider = false;
    let startX = 0;
    let startY = 0;
    let clickTimer = null;
    let lastClickedCard = null;

    grid.addEventListener('pointerdown', (e) => {
        const card = e.target.closest('.item-card');
        if (!card) return;
        const cardId = card.getAttribute('data-id');
        if (cardId && hasAction('prewarmProductModal')) {
            invokeAction('prewarmProductModal', cardId, true);
        }
    }, { passive: true });

    grid.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.item-card');
        if (!card) return;
        const cardId = card.getAttribute('data-id');
        if (cardId && hasAction('prewarmProductModal')) {
            invokeAction('prewarmProductModal', cardId, true);
        }
        const wrapper = e.target.closest('.card-slider-wrapper');
        if (!wrapper) return;
        activateCardSlides(wrapper, true);
        isDraggingSlider = false;
        if (e.touches && e.touches[0]) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }
    }, { passive: true });

    grid.addEventListener('touchend', (e) => {
        const wrapper = e.target.closest('.card-slider-wrapper');
        if (!wrapper) return;
        if (e.changedTouches && e.changedTouches[0]) {
            const dx = Math.abs(e.changedTouches[0].clientX - startX);
            const dy = Math.abs(e.changedTouches[0].clientY - startY);
            if (dx > 10 || dy > 10) isDraggingSlider = true;
        }
    }, { passive: true });

    grid.addEventListener('click', (e) => {
        if (e.target.closest('#toastContainer, .toast') || (hasAction('isToastClickShielded') && invokeAction('isToastClickShielded'))) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        const card = e.target.closest('.item-card');
        if (!card) return;
        if (e.target.closest('.fav-star, .grid-cart-btn, .grid-slider-btn, .card-dots-container, [data-action]')) return;
        if (isDraggingSlider && e.target.closest('.card-slider-wrapper')) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const itemId = card.getAttribute('data-id');
        if (!itemId) return;

        const DOUBLE_TAP_DELAY_MS = 200;
        if (clickTimer === null || lastClickedCard !== card) {
            if (clickTimer) clearTimeout(clickTimer);
            lastClickedCard = card;
            clickTimer = setTimeout(() => {
                clickTimer = null;
                lastClickedCard = null;
                saveCurrentFeedScrollState(itemId);
                if (typeof openProductModalById === 'function') openProductModalById(itemId);
            }, DOUBLE_TAP_DELAY_MS);
        } else {
            clearTimeout(clickTimer);
            clickTimer = null;
            lastClickedCard = null;
            const animContainer = card.querySelector('.card-slider-wrapper') || card;
            handleDoubleTapLike(e, itemId, animContainer);
        }
    });
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
    const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
    const favSet = new Set(Array.isArray(userFavs) ? userFavs.map(String) : []);

    const badgeHTML = buildStatusBadgeHtml(item);
    const thumbsArray = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails : (item.images && item.images.length > 0 ? item.images : []);
    let slidesStr = '';
    let dotsStr = '';

    const safeBrand = (item.brand || '').trim();
    const safeName = (item.name || '').trim();
    const baseAlt = [safeBrand, safeName].filter(Boolean).join(' ') || 'Винтажная одежда NISHA';
    const cleanAlt = baseAlt
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    thumbsArray.forEach((thumbUrl, thumbIdx) => {
        const rawVidUrl = (item.images && item.images[thumbIdx]) ? item.images[thumbIdx] : thumbUrl;
        const isVid = typeof rawVidUrl === 'string' && rawVidUrl.endsWith('.mp4');
        const cdnThumb = toCDN(thumbUrl, { isThumb: true });
        const cdnVidUrl = toCDN(rawVidUrl);
        const slideAlt = cleanAlt + (thumbIdx > 0 ? ` - фото ${thumbIdx + 1}` : '');

        if (isVid) {
            slidesStr += `
                <div class="card-slide ${thumbIdx === 0 ? 'img-8bit-loading' : ''}" style="background: #0a0a0a;">
                    <video class="grid-lazy-video" src="${cdnVidUrl}#t=0.001" muted loop playsinline preload="none" style="width:100%; height:100%; object-fit:cover; pointer-events:none; opacity:0;"></video>
                </div>`;
        } else if (thumbIdx === 0) {
            const firstLoadAttr = (idx < 4) ? 'fetchpriority="high"' : 'loading="lazy"';
            slidesStr += `
                <div class="card-slide img-8bit-loading">
                   <img class="card-slide-img" src="${cdnThumb}" data-fallback-src="${cdnVidUrl || ''}" ${firstLoadAttr} decoding="async" alt="${slideAlt}">
                </div>`;
        } else {
            slidesStr += `
                <div class="card-slide">
                   <img class="card-slide-img" data-src="${cdnThumb}" data-fallback-src="${cdnVidUrl || ''}" loading="lazy" decoding="async" alt="${slideAlt}">
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
    const escAttr = (v) => (hasAction('escapeAttr') ? invokeAction('escapeAttr', v) : v);
    const escHtml = (v) => (hasAction('escapeHtml') ? invokeAction('escapeHtml', v) : v);

    let controlsHTML = '';
    if (thumbsArray.length > 1) {
        controlsHTML = `
            <div class="grid-slider-btn prev" role="button" aria-label="Предыдущее фото" data-action="scroll-grid-slider" data-hover-action="preload-grid-slide" data-id="${escAttr(item.id)}" data-dir="-1">&#10094;</div>
            <div class="grid-slider-btn next" role="button" aria-label="Следующее фото" data-action="scroll-grid-slider" data-hover-action="preload-grid-slide" data-id="${escAttr(item.id)}" data-dir="1">&#10095;</div>
            <div class="card-dots-container" id="dots-${item.id}">${dotsStr}</div>
        `;
    }

    card.innerHTML = `
        ${badgeHTML}
        <div class="${starClass}" role="button" aria-label="В избранное" data-action="toggle-fav" data-id="${escAttr(item.id)}">★</div>
        <div class="card-slider-wrapper">
            <div class="card-slider-container" id="slider-${item.id}" data-item-id="${escAttr(item.id)}">
                ${slidesStr}
            </div>
            ${controlsHTML}
        </div>
        <div class="item-info">
            <h3 class="item-title">${escHtml(item.name || '')}</h3>
            <div class="item-price">${priceHTML}</div>
            <div class="item-size"><span data-i18n="grid.size_prefix">${sizePrefix}</span>${escHtml(item.size || '')}</div>
            <div class="item-footer"><span>${escHtml(item.brand || '')}</span><span>${escHtml(item.condition || '')}</span></div>
        </div>
        <button class="grid-cart-btn" data-i18n="product.add_to_cart" style="${item.status === 'sold' ? 'display:none;' : ''}" data-action="add-to-cart" data-id="${escAttr(item.id)}">${addToCartText}</button>
    `;

    return card;
}

/**
 * Единый компаратор витрины (TOP-закрепленные всегда выше, далее активная сортировка: дата или цена).
 * @returns {(a: object, b: object) => number}
 */
export function getCatalogItemComparator() {
    const nowTs = Date.now();
    const isTopNow = (it) => !!(it && it.is_top === true && it.top_until && Date.parse(it.top_until) > nowTs);
    const sortCheapEl = typeof document !== 'undefined' ? document.getElementById('sort-cheap') : null;
    const byCheap = !!(sortCheapEl && sortCheapEl.classList.contains('active-sort'));
    const safePrice = (p) => Number.parseInt(String(p).replace(/[^\d]/g, ''), 10) || 0;
    return (a, b) => {
        const topA = isTopNow(a);
        const topB = isTopNow(b);
        if (topA && !topB) return -1;
        if (!topA && topB) return 1;
        if (byCheap) return safePrice(a.price) - safePrice(b.price);
        return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
    };
}

/**
 * Плавно добавляет новую карточку в витрину на правильную позицию с учётом TOP-товаров и сортировки.
 * @param {object} item
 */
export function insertNewItemCardSmoothly(item) {
    if (!item || !item.id || typeof document === 'undefined') return;
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;

    if (grid.querySelector(`.item-card[data-id="${item.id}"]`)) return;

    const curCat = window.currentCategory || '';
    const curBrand = window.currentBrand || '';
    const searchInput = document.getElementById('mainSearch');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const onlySale = document.getElementById('onlySaleCb')?.checked || false;
    const hideUnavailable = document.getElementById('hideUnavailableCb')?.checked || false;

    if (curCat && item.category !== curCat) return;
    if (curBrand && (!item.brand || !item.brand.toLowerCase().includes(curBrand.toLowerCase()))) return;
    if (onlySale && !item.is_sale) return;
    if (hideUnavailable && item.status !== 'available') return;
    if (searchTerm) {
        const nameMatch = item.name && item.name.toLowerCase().includes(searchTerm);
        const brandMatch = item.brand && item.brand.toLowerCase().includes(searchTerm);
        if (!nameMatch && !brandMatch) return;
    }

    const emptyPlaceholder = grid.querySelector('div[style*="grid-column: 1/-1"]');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    if (!Array.isArray(window.filteredItems)) window.filteredItems = [];
    const list = window.filteredItems;
    if (list.some(i => i && String(i.id) === String(item.id))) return;

    // Находим правильную позицию новинки по той же сортировке, что и в applyFilters
    const cmp = getCatalogItemComparator();
    let insertIdx = list.findIndex(existing => cmp(item, existing) < 0);
    if (insertIdx === -1) insertIdx = list.length;
    const prevLen = list.length;
    list.splice(insertIdx, 0, item);

    const isMobileView = window.innerWidth <= 900;

    // ПК (постраничная навигация): перерисовываем текущую страницу только если новинка влияет на нее или на число страниц
    if (!isMobileView) {
        const pageSize = 15;
        const pageEnd = (window.currentPage || 1) * pageSize;
        const totalBefore = Math.max(1, Math.ceil(prevLen / pageSize));
        const totalAfter = Math.max(1, Math.ceil(list.length / pageSize));
        if (insertIdx < pageEnd || totalBefore !== totalAfter) {
            renderNextBatch();
            const renderedNew = grid.querySelector(`.item-card[data-id="${item.id}"]`);
            if (renderedNew) renderedNew.classList.add('item-card-new-arrival');
        }
        const countElDesktop = document.getElementById('itemCount');
        if (countElDesktop) countElDesktop.innerText = list.length;
        return;
    }

    // Моб. (бесконечная лента): вставляем в отрендеренную часть или ждём подгрузки при скролле
    const alreadyRenderedAll = (window.renderedCount || 0) >= prevLen;
    if (!(insertIdx < (window.renderedCount || 0) || alreadyRenderedAll)) {
        const countElMobile = document.getElementById('itemCount');
        if (countElMobile) countElMobile.innerText = list.length;
        return;
    }

    const card = buildCardDOM(item, 0);
    if (card) {
        card.classList.add('item-card-new-arrival');
        const renderedCards = grid.querySelectorAll(':scope > .item-card');
        const refCard = renderedCards[insertIdx];
        if (refCard) {
            grid.insertBefore(card, refCard);
        } else {
            grid.appendChild(card);
        }
        window.renderedCount = (window.renderedCount || 0) + 1;

        const vids = card.querySelectorAll('.grid-lazy-video');
        vids.forEach(v => {
            if (gridVideoObserver) gridVideoObserver.observe(v);
        });

        const img = card.querySelector('img.card-slide-img');
        if (img) {
            if (img.complete && img.naturalWidth > 0) {
                markCardImageLoaded(img);
            } else {
                img.onload = () => markCardImageLoaded(img);
            }
        }
    }

    const countEl = document.getElementById('itemCount');
    if (countEl && Array.isArray(window.filteredItems)) {
        countEl.innerText = window.filteredItems.length;
    }
}

/**
 * Рендерит следующую пачку товаров (бесконечная лента на мобильных или страница на ПК).
 * @param {number} [targetMobileCount=0]
 * @returns {Promise<void>}
 */
export async function renderNextBatch(targetMobileCount = 0) {
    if (typeof document === 'undefined') return;
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;
    initGridEventDelegation();
    const batchSeq = ++_renderBatchSeq;

    const isMobile = window.innerWidth <= 900;
    window._catalogRenderedAsMobile = isMobile;

    const oldPagination = document.getElementById('mainPagination');
    if (oldPagination) oldPagination.remove();

    let startIndex = 0;
    let endIndex = 0;
    const BATCH_SIZE = isMobile ? 12 : 15;
    itemsPageSize = BATCH_SIZE;

    // Защита от выхода за границы страниц на ПК
    if (!isMobile) {
        const totalPagesGuard = Math.max(1, Math.ceil(window.filteredItems.length / BATCH_SIZE));
        if (!window.currentPage || window.currentPage < 1) window.currentPage = 1;
        if (window.currentPage > totalPagesGuard) window.currentPage = totalPagesGuard;
    }

    if (isMobile) {
        if (window.renderedCount === 0) {
            if (gridVideoObserver) gridVideoObserver.disconnect();
            if (typeof grid.replaceChildren === 'function') grid.replaceChildren();
            else grid.innerHTML = '';
        }
        startIndex = window.renderedCount;
        const batchLen = (startIndex === 0 && targetMobileCount > BATCH_SIZE) ? targetMobileCount : BATCH_SIZE;
        endIndex = Math.min(startIndex + batchLen, window.filteredItems.length);
        window.renderedCount = endIndex;
    } else {
        if (gridVideoObserver) gridVideoObserver.disconnect();
        if (typeof grid.replaceChildren === 'function') grid.replaceChildren();
        else grid.innerHTML = '';
        startIndex = (window.currentPage - 1) * BATCH_SIZE;
        endIndex = Math.min(startIndex + BATCH_SIZE, window.filteredItems.length);
    }

    if (startIndex >= endIndex) {
        if (isMobile) {
            const scrollTrigger = document.getElementById('loadingTrigger');
            if (scrollTrigger && window.renderedCount >= (window.filteredItems ? window.filteredItems.length : 0)) {
                scrollTrigger.style.display = 'none';
            }
        }
        return;
    }

    getSeenItemsSet();

    const fragment = document.createDocumentFragment();
    const newVideoElements = [];

    for (let i = startIndex; i < endIndex; i++) {
        try {
            const item = window.filteredItems[i];
            if (!item) continue;
            const card = buildCardDOM(item, i - startIndex);
            if (card) {
                fragment.appendChild(card);
                const vids = card.querySelectorAll('.grid-lazy-video');
                vids.forEach(v => newVideoElements.push(v));
            }
        } catch (err) { console.error(err); }
        // Periodically flush and yield to main thread every 8 cards during large multi-batch bursts
        if ((i - startIndex + 1) % 8 === 0 && (endIndex - startIndex) > 15 && hasAction('yieldToMain')) {
            grid.appendChild(fragment);
            await invokeAction('yieldToMain');
            if (batchSeq !== _renderBatchSeq) return;
        }
    }

    if (fragment.childNodes.length > 0) {
        grid.appendChild(fragment);
    }

    if (isMobile) {
        window.renderedCount = endIndex;
        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) {
            if (window.renderedCount >= window.filteredItems.length) {
                scrollTrigger.style.display = 'none';
            } else {
                if (typeof scrollTrigger.replaceChildren === 'function') scrollTrigger.replaceChildren();
                else scrollTrigger.innerHTML = '';
            }
        }
    } else {
        window.renderedCount = window.filteredItems.length;

        const totalPages = Math.ceil(window.filteredItems.length / itemsPageSize);
        if (totalPages >= 1) {
            const paginationWrap = document.createElement('div');
            paginationWrap.id = 'mainPagination';
            paginationWrap.className = 'pagination-wrapper';
            paginationWrap.style.position = 'relative';
            paginationWrap.style.width = '100%';
            paginationWrap.style.marginTop = '40px';
            paginationWrap.style.display = 'flex';
            paginationWrap.style.justifyContent = 'center';
            paginationWrap.style.gridColumn = '1 / -1';

            const prevDisabled = window.currentPage === 1 ? 'disabled' : '';
            const nextDisabled = window.currentPage === totalPages ? 'disabled' : '';
            const pageText = (typeof i18next !== 'undefined' && i18next.t('pagination.page', { defaultValue: 'СТРАНИЦА' })) || 'СТРАНИЦА';
            const ofText = (typeof i18next !== 'undefined' && i18next.t('pagination.of', { defaultValue: 'ИЗ' })) || 'ИЗ';

            paginationWrap.innerHTML = `
                <button class="page-arrow" data-action="change-page" data-dir="-1" ${prevDisabled}>&#10094;</button>
                <div class="page-numbers">[ <span data-i18n="pagination.page">${pageText}</span> <span style="color:var(--accent-green); font-weight:bold;">${window.currentPage}</span> <span data-i18n="pagination.of">${ofText}</span> ${totalPages} ]</div>
                <button class="page-arrow" data-action="change-page" data-dir="1" ${nextDisabled}>&#10095;</button>
            `;

            grid.style.paddingBottom = '0px';
            grid.appendChild(paginationWrap);
        }
    }

    if (hasAction('yieldToMain')) await invokeAction('yieldToMain');
    if (batchSeq !== _renderBatchSeq) return;
    grid.querySelectorAll('img.card-slide-img').forEach(img => {
        if (img.complete && img.naturalWidth > 0 && img.style.opacity !== '1') {
            markCardImageLoaded(img);
        }
    });
    if (gridVideoObserver) {
        newVideoElements.forEach(v => gridVideoObserver.observe(v));
    }
}

// Логика слайдера фото в карточке товара на ПК/моб
let _dotsRaf = null;
const _lastDotIndices = {};

/**
 * Обновляет активную точку-индикатор слайдера в карточке при горизонтальном скролле.
 * @param {HTMLElement} container
 * @param {string|number} itemId
 */
export function updateCardDots(container, itemId) {
    if (!container) return;
    if (_dotsRaf) return;
    _dotsRaf = requestAnimationFrame(() => {
        _dotsRaf = null;
        const width = container.clientWidth;
        if (!width) return;
        const index = Math.round(container.scrollLeft / width);
        if ((typeof hasOwn === 'function' ? hasOwn(_lastDotIndices, itemId) : Object.hasOwn(_lastDotIndices, itemId)) && _lastDotIndices[itemId] === index) return;
        _lastDotIndices[itemId] = index;

        const dotsContainer = document.getElementById(`dots-${itemId}`);
        if (dotsContainer) {
            const dots = dotsContainer.children;
            for (let i = 0; i < dots.length; i++) {
                dots[i].classList.toggle('active', i === index);
            }
        }
    });
}

/**
 * Прокручивает мини-слайдер внутри карточки товара в сетке.
 * @param {Event} event
 * @param {string|number} itemId
 * @param {number} direction
 */
export function scrollGridSlider(event, itemId, direction) {
    if (event) event.stopPropagation();
    const slider = document.getElementById(`slider-${itemId}`);
    if (!slider) return;
    activateCardSlides(slider);
    const slideWidth = slider.offsetWidth;
    slider.scrollBy({ left: slideWidth * direction, behavior: 'smooth' });
}

/**
 * Предзагружает соседний слайд карточки товара при наведении на стрелку слайдера.
 * @param {Event} event
 * @param {string|number} itemId
 * @param {number} direction
 */
export function preloadGridSlide(event, itemId, direction) {
    if (event) event.stopPropagation();
    const slider = document.getElementById(`slider-${itemId}`);
    if (slider) activateCardSlides(slider);
    const catalog = typeof getCatalog === 'function' ? getCatalog() : [];
    const item = catalog.find(i => i.id === itemId);
    if (!item) return;
    const mediaArray = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails : (item.images || []);
    if (mediaArray.length <= 1) return;
    if (!slider) return;
    const slideWidth = slider.offsetWidth || 1;
    const currentIdx = Math.round(slider.scrollLeft / slideWidth);
    const targetIdx = typeof clamp === 'function'
        ? clamp(currentIdx + direction, 0, mediaArray.length - 1)
        : Math.max(0, Math.min(mediaArray.length - 1, currentIdx + direction));
    const url = toCDN(mediaArray.at(targetIdx), { isThumb: true });
    if (url && !url.endsWith('.mp4')) {
        const img = new Image();
        img.src = url;
    }
}

/**
 * Обрабатывает двойной тап по карточке для добавления в избранное с анимацией звезды.
 * @param {Event} event
 * @param {string|number} itemId
 * @param {HTMLElement} container
 */
export async function handleDoubleTapLike(event, itemId, container) {
    if (hasAction('triggerVibration')) invokeAction('triggerVibration', 150);
    if (event) { event.preventDefault(); event.stopPropagation(); }

    if (container) {
        const star = document.createElement('div');
        star.className = 'double-tap-star-anim';
        star.innerText = '★';
        container.appendChild(star);
        setTimeout(() => star.remove(), 800);
    }

    if (hasAction('triggerHaptic')) invokeAction('triggerHaptic', 'heavy');

    const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
    const isAlreadyFav = Array.isArray(userFavs) && userFavs.some(id => String(id) === String(itemId));
    if (!isAlreadyFav) {
        if (hasAction('toggleFav')) {
            await invokeAction('toggleFav', null, itemId);
        }
    }
}

registerActions({
    updateCardDOM,
    observeGridVideo: (v) => { if (gridVideoObserver && v) gridVideoObserver.observe(v); },
    changePage,
    activateCardSlides,
    buildCardDOM,
    getCatalogItemComparator,
    insertNewItemCardSmoothly,
    renderNextBatch,
    updateCardDots,
    scrollGridSlider,
    preloadGridSlide,
    handleDoubleTapLike
});

if (typeof window !== 'undefined') {
    window.updateCardDOM = updateCardDOM;
    window.changePage = changePage;
    window.activateCardSlides = activateCardSlides;
    window.buildCardDOM = buildCardDOM;
    window.getCatalogItemComparator = getCatalogItemComparator;
    window.insertNewItemCardSmoothly = insertNewItemCardSmoothly;
    window.renderNextBatch = renderNextBatch;
    window.updateCardDots = updateCardDots;
    window.scrollGridSlider = scrollGridSlider;
    window.preloadGridSlide = preloadGridSlide;
    window.handleDoubleTapLike = handleDoubleTapLike;
}
