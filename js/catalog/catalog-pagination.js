// @ts-check
// ==========================================
// NISHA CATALOG — ПАГИНАЦИЯ, БАТЧИНГ, КОМПАРАТОР И ВИДЕО-ПЛЕЕР СЕТКИ
// ==========================================

import { buildCardDOM, getSeenItemsSet, isItemBargainEnabled } from './catalog-card-markup.js';
import { hasAction, invokeAction } from '../core/action-registry.js';

let itemsPageSize = typeof window !== 'undefined' && window.innerWidth <= 900 ? 12 : 15;
/** @type {ReturnType<typeof setTimeout> | null} */
let changePageTimeout = null;
let _renderBatchSeq = 0;

/**
 * Помечает изображение карточки как загруженное и снимает 8-bit плейсхолдер.
 * @param {HTMLImageElement} img
 */
export function markCardImageLoaded(img) {
    if (!img) return;
    img.style.opacity = '1';
    if (img.parentElement) {
        img.parentElement.classList.remove('img-8bit-loading');
        img.parentElement.classList.add('img-8bit-loaded');
    }
}

// Умный плеер для видео в сетке (IntersectionObserver с поддержкой Network Information API)
export const gridVideoObserver = (typeof IntersectionObserver !== 'undefined')
    ? new IntersectionObserver((entries) => {
        const nav = /** @type {any} */ (typeof navigator !== 'undefined' ? navigator : null);
        const conn = nav ? (nav.connection || nav.mozConnection || nav.webkitConnection) : null;
        const isSaveData = hasAction('isSaveDataMode')
            ? invokeAction('isSaveDataMode')
            : Boolean(conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'));

        entries.forEach(entry => {
            const video = /** @type {HTMLVideoElement} */ (entry.target);
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
                const vid = /** @type {HTMLVideoElement & { _wasPlaying?: boolean }} */ (v);
                if (!vid.paused) {
                    vid._wasPlaying = true;
                    vid.pause();
                }
            });
        } else {
            videos.forEach(v => {
                const vid = /** @type {HTMLVideoElement & { _wasPlaying?: boolean }} */ (v);
                if (vid._wasPlaying) {
                    delete vid._wasPlaying;
                    if (vid.classList.contains('modal-video-player')) {
                        const modal = document.getElementById('productModal');
                        if (modal && modal.style.display !== 'none') {
                            const slide = vid.closest('.slide');
                            const slides = Array.from(document.querySelectorAll('#sliderWrapper .slide'));
                            if (slide && slides.indexOf(slide) === window.currentSlide) {
                                vid.play().catch(() => {});
                            }
                        }
                    } else {
                        const rect = vid.getBoundingClientRect();
                        if (rect.top < window.innerHeight + 50 && rect.bottom > -50) {
                            vid.play().catch(() => {});
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

    if (changePageTimeout !== null) clearTimeout(changePageTimeout);
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
    }, 120);
}

const _itemSortMetaCache = new WeakMap();

/**
 * Возвращает кэшированные числовые метаданные товара для быстрой сортировки O(N) без повторных Date.parse/regex.
 * Автоматически обновляется при изменении цены, даты создания или top_until.
 * @param {any} item
 * @returns {{ createdTs: number, topUntilTs: number, priceNum: number }}
 */
export function getItemSortMeta(item) {
    if (!item || typeof item !== 'object') {
        return { createdTs: 0, topUntilTs: 0, priceNum: 0 };
    }
    const cached = _itemSortMetaCache.get(item);
    if (
        cached &&
        cached.createdRaw === item.created_at &&
        cached.topRaw === item.top_until &&
        cached.priceRaw === item.price
    ) {
        return cached;
    }
    const createdTs = item.created_at ? (Date.parse(item.created_at) || 0) : 0;
    const topUntilTs = item.top_until ? (Date.parse(item.top_until) || 0) : 0;
    const priceNum = typeof item.price === 'number'
        ? (Number.isFinite(item.price) ? item.price : 0)
        : (Number.parseInt(String(item.price || '').replace(/[^\d]/g, ''), 10) || 0);

    const meta = {
        createdRaw: item.created_at,
        topRaw: item.top_until,
        priceRaw: item.price,
        createdTs,
        topUntilTs,
        priceNum
    };
    _itemSortMetaCache.set(item, meta);
    return meta;
}

/**
 * Единый компаратор витрины (TOP-закрепленные всегда выше, далее активная сортировка: дата или цена).
 * @returns {(a: any, b: any) => number}
 */
export function getCatalogItemComparator() {
    const nowTs = Date.now();
    const isTopNow = (/** @type {any} */ it) => !!(it && it.is_top === true && getItemSortMeta(it).topUntilTs > nowTs);
    const sortCheapEl = typeof document !== 'undefined' ? document.getElementById('sort-cheap') : null;
    const byCheap = !!(sortCheapEl && sortCheapEl.classList.contains('active-sort'));
    return (a, b) => {
        const topA = isTopNow(a);
        const topB = isTopNow(b);
        if (topA && !topB) return -1;
        if (!topA && topB) return 1;
        if (byCheap) return getItemSortMeta(a).priceNum - getItemSortMeta(b).priceNum;
        return getItemSortMeta(b).createdTs - getItemSortMeta(a).createdTs;
    };
}

/**
 * Плавно добавляет новую карточку в витрину на правильную позицию с учётом TOP-товаров и сортировки.
 * @param {any} item
 */
export function insertNewItemCardSmoothly(item) {
    if (!item || !item.id || typeof document === 'undefined') return;
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;

    if (grid.querySelector(`.item-card[data-id="${item.id}"]`)) return;
    if (window.showingOnlyFavs) return;

    const curCat = window.currentCategory || '';
    const curBrand = window.currentBrand || '';
    const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('mainSearch'));
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const onlySale = /** @type {HTMLInputElement | null} */ (document.getElementById('onlySaleCb'))?.checked || false;
    const onlyBargain = /** @type {HTMLInputElement | null} */ (document.getElementById('onlyBargainCb'))?.checked || false;
    const hideUnavailable = /** @type {HTMLInputElement | null} */ (document.getElementById('hideUnavailableCb'))?.checked || false;

    if (curCat && item.category !== curCat) return;
    if (curBrand && (!item.brand || !item.brand.toLowerCase().includes(curBrand.toLowerCase()))) return;
    if (onlySale && !item.is_sale) return;
    if (onlyBargain && !isItemBargainEnabled(item)) return;
    if (hideUnavailable && item.status !== 'available') return;

    const checkedSizes = Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => String(/** @type {HTMLInputElement} */ (cb).value || '').toLowerCase());
    if (checkedSizes.length > 0) {
        const itemSizeStr = String(item.size || '').toLowerCase();
        if (!checkedSizes.some(sz => itemSizeStr === sz || itemSizeStr.includes(sz))) return;
    }

    const priceMinEl = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMin'));
    const priceMaxEl = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMax'));
    const minP = priceMinEl ? Number(priceMinEl.value) : NaN;
    const maxP = priceMaxEl ? Number(priceMaxEl.value) : NaN;
    const itemPriceNum = Number(item.price) || 0;
    if (Number.isFinite(minP) && minP > 0 && itemPriceNum < minP) return;
    if (Number.isFinite(maxP) && maxP > 0 && itemPriceNum > maxP) return;
    if (searchTerm) {
        const nameMatch = item.name && item.name.toLowerCase().includes(searchTerm);
        const brandMatch = item.brand && item.brand.toLowerCase().includes(searchTerm);
        if (!nameMatch && !brandMatch) return;
    }

    const emptyPlaceholder = grid.querySelector('.catalog-empty-state, div[style*="grid-column: 1/-1"]');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    if (!Array.isArray(window.filteredItems)) window.filteredItems = [];
    const list = window.filteredItems;
    if (list.some(i => i && String(i.id) === String(item.id))) return;

    const cmp = getCatalogItemComparator();
    let insertIdx = list.findIndex(existing => cmp(item, existing) < 0);
    if (insertIdx === -1) insertIdx = list.length;
    const prevLen = list.length;
    list.splice(insertIdx, 0, item);

    const isMobileView = window.innerWidth <= 900;

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
        if (countElDesktop) countElDesktop.textContent = String(list.length);
        return;
    }

    const alreadyRenderedAll = (window.renderedCount || 0) >= prevLen;
    if (!(insertIdx < (window.renderedCount || 0) || alreadyRenderedAll)) {
        const countElMobile = document.getElementById('itemCount');
        if (countElMobile) countElMobile.textContent = String(list.length);
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

        const img = /** @type {HTMLImageElement | null} */ (card.querySelector('img.card-slide-img'));
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
        countEl.textContent = String(window.filteredItems.length);
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
    if (hasAction('initGridEventDelegation')) {
        invokeAction('initGridEventDelegation');
    }
    const batchSeq = ++_renderBatchSeq;

    const isMobile = window.innerWidth <= 900;
    window._catalogRenderedAsMobile = isMobile;

    const oldPagination = document.getElementById('mainPagination');
    if (oldPagination) oldPagination.remove();

    let startIndex = 0;
    let endIndex = 0;
    const BATCH_SIZE = isMobile ? 12 : 15;
    itemsPageSize = BATCH_SIZE;

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
        startIndex = window.renderedCount || 0;
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
            if (scrollTrigger && (window.renderedCount || 0) >= (window.filteredItems ? window.filteredItems.length : 0)) {
                scrollTrigger.style.display = 'none';
            }
        }
        return;
    }

    getSeenItemsSet();

    const fragment = document.createDocumentFragment();
    /** @type {Element[]} */
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
        const shouldYield = isMobile
            ? ((i - startIndex + 1) % 6 === 0)
            : ((i - startIndex + 1) % 8 === 0);
        if (shouldYield && (i + 1) < endIndex && hasAction('yieldToMain')) {
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
    grid.querySelectorAll('img.card-slide-img').forEach(el => {
        const img = /** @type {HTMLImageElement} */ (el);
        if (img.complete && img.naturalWidth > 0 && img.style.opacity !== '1') {
            markCardImageLoaded(img);
        }
    });
    if (gridVideoObserver) {
        newVideoElements.forEach(v => gridVideoObserver.observe(v));
    }
}
