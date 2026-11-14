// ==========================================
// NISHA CATALOG — ПАГИНАЦИЯ, БАТЧИНГ, КОМПАРАТОР И ВИДЕО-ПЛЕЕР СЕТКИ
// ==========================================

import { buildCardDOM, getSeenItemsSet } from './catalog-card-markup.js';
import { hasAction, invokeAction } from '../core/action-registry.js';

let itemsPageSize = typeof window !== 'undefined' && window.innerWidth <= 900 ? 12 : 15;
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
        if (countElDesktop) countElDesktop.innerText = list.length;
        return;
    }

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
