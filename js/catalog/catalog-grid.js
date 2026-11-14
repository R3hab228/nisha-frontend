// ==========================================
// NISHA CATALOG — СЕТКА КАРТОЧЕК, ПАГИНАЦИЯ И ВЗАИМОДЕЙСТВИЯ
// ==========================================

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
import {
    buildStatusBadgeHtml,
    buildCardPriceHtml,
    buildCardDOM
} from './catalog-card-markup.js';
import {
    markCardImageLoaded,
    gridVideoObserver,
    changePage,
    getCatalogItemComparator,
    insertNewItemCardSmoothly,
    renderNextBatch
} from './catalog-pagination.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeOpenedItem, getRuntimeFavorites, isSiteHackedMode } from '../core/runtime-env.js';

export {
    buildStatusBadgeHtml,
    buildCardPriceHtml,
    buildCardDOM,
    markCardImageLoaded,
    gridVideoObserver,
    changePage,
    getCatalogItemComparator,
    insertNewItemCardSmoothly,
    renderNextBatch
};

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
    const activeModal = getRuntimeOpenedItem();
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
            const isHackedActive = isSiteHackedMode();
            const finalPrice = isHackedActive ? Math.floor(item.price * 0.9) : item.price;
            modalPriceEl.innerText = hasAction('formatPrice') ? invokeAction('formatPrice', finalPrice) : (finalPrice + ' ' + curr);
        }
    }
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

    const userFavs = getRuntimeFavorites();
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
    initGridEventDelegation,
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
    window.getCatalogItemComparator = getCatalogItemComparator;
    window.insertNewItemCardSmoothly = insertNewItemCardSmoothly;
    window.updateCardDots = updateCardDots;
}
