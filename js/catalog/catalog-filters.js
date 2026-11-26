// @ts-check
// ==========================================
// NISHA CATALOG — ФИЛЬТРЫ, ПОИСК, СОРТИРОВКА И САЙДБАР
// ==========================================

import { getCatalogStore } from './catalog-state.js';
import {
    getSavedFeedScrollState,
    clearSavedFeedScrollState,
    restoreFeedScrollPosition
} from './scroll-restoration.js';
import {
    runCatalogViewTransition,
    updateSidebarCounters,
    clearSearchInput,
    updatePriceUI,
    toggleMobileSidebar
} from './catalog-sidebar-ui.js';
import { renderNextBatch } from './catalog-grid.js';
import { getItemSortMeta } from './catalog-pagination.js';
import { isItemBargainEnabled, escCardHtml } from './catalog-card-markup.js';
import { renderActiveFilterChips, removeActiveFilterChip } from './catalog-filter-chips.js';
import {
    CATEGORY_TO_SLUG,
    normalizeCategoryParam,
    categoryToUrlSlug,
    normalizeBrandParam,
    normalizeSizeToken,
    parseSizesFromParams,
    parsePriceBoundsFromParams,
    parseSortParam,
    hasExplicitFilterParams,
    parseCatalogFiltersFromUrl,
    hydrateCatalogFiltersFromUrl,
    buildCatalogFilterUrl,
    syncCatalogFiltersToUrl,
    shareCurrentFilterLink
} from './catalog-url-sync.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeFavorites, isSiteHackedMode, tSafe } from '../core/runtime-env.js';

export {
    updateSidebarCounters,
    clearSearchInput,
    updatePriceUI,
    toggleMobileSidebar,
    renderActiveFilterChips,
    removeActiveFilterChip,
    CATEGORY_TO_SLUG,
    normalizeCategoryParam,
    categoryToUrlSlug,
    normalizeBrandParam,
    normalizeSizeToken,
    parseSizesFromParams,
    parsePriceBoundsFromParams,
    parseSortParam,
    hasExplicitFilterParams,
    parseCatalogFiltersFromUrl,
    hydrateCatalogFiltersFromUrl,
    buildCatalogFilterUrl,
    syncCatalogFiltersToUrl,
    shareCurrentFilterLink
};

/** @type {ReturnType<typeof setTimeout> | null} */
let applyFiltersTimeout = null;
/** @type {(() => void) | null} */
let _resolveApplyFilters = null;

/**
 * Проверяет соответствие товара (или строки размера) выбранному фильтру размера.
 * @param {{ size?: any, category?: any } | string} itemOrSize
 * @param {string} filterVal
 * @returns {boolean}
 */
export function itemMatchesSizeFilter(itemOrSize, filterVal) {
    if (!itemOrSize || !filterVal) return false;
    let sizeStr = '';
    let category = '';
    if (typeof itemOrSize === 'object') {
        sizeStr = itemOrSize.size ? String(itemOrSize.size).trim() : '';
        category = itemOrSize.category ? String(itemOrSize.category).trim() : '';
    } else {
        sizeStr = String(itemOrSize).trim();
    }
    if (!sizeStr) return false;
    const upperSize = sizeStr.toUpperCase();
    const fVal = String(filterVal).trim().toUpperCase();

    // 1. Обувь (40 - 42) и Обувь (43 - 46)
    const isShoesFilter1 = (fVal === '42' || fVal === '40-42' || fVal === '40 - 42');
    const isShoesFilter2 = (fVal === '44' || fVal === '43-46' || fVal === '43 - 46');

    if (isShoesFilter1 || isShoesFilter2) {
        if (category && category !== 'Обувь') return false;

        if (isShoesFilter1) {
            if (upperSize.includes('40 - 42') || upperSize.includes('40-42')) return true;
            const numMatch = upperSize.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
                const n = Number.parseFloat(numMatch[1].replaceAll(',', '.'));
                if (n >= 35 && n <= 42.5) return true;
            }
            return false;
        }

        if (isShoesFilter2) {
            if (upperSize.includes('43 - 46') || upperSize.includes('43-46')) return true;
            const numMatch = upperSize.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
                const n = Number.parseFloat(numMatch[1].replaceAll(',', '.'));
                if (n >= 42.8 && n <= 50) return true;
            }
            return false;
        }
    }

    if (category === 'Обувь') {
        return false;
    }

    // 2. Размер S
    if (fVal === 'S') {
        return (upperSize === 'S' || upperSize === 'XS' || upperSize === 'С' ||
            upperSize.startsWith('S-') || upperSize.startsWith('S -') ||
            upperSize.startsWith('S/') || upperSize.startsWith('S ') ||
            upperSize.startsWith('S(') || upperSize.includes('(S)') ||
            upperSize.includes('S M L'));
    }

    // 3. Размер M
    if (fVal === 'M') {
        return (upperSize === 'M' || upperSize === 'М' ||
            upperSize.startsWith('M-') || upperSize.startsWith('M -') ||
            upperSize.startsWith('M/') || upperSize.startsWith('M ') ||
            upperSize.startsWith('M(') || upperSize.startsWith('М ') ||
            upperSize.startsWith('М(') || upperSize.includes('S M L'));
    }

    // 4. Размер L
    if (fVal === 'L') {
        if (upperSize.includes('XL') || upperSize.includes('ХЛ') ||
            upperSize.includes('XXL') || upperSize.includes('ХХЛ')) {
            return false;
        }
        return (upperSize === 'L' || upperSize === 'Л' ||
            upperSize.startsWith('L ') || upperSize.startsWith('L(') ||
            upperSize.startsWith('Л ') || upperSize.startsWith('Л(') ||
            upperSize.includes('S M L'));
    }

    // 5. Размер XL / XXL
    if (fVal === 'XL' || fVal === 'XL / XXL') {
        return (upperSize.includes('XL') || upperSize.includes('XXL') ||
            upperSize.includes('ХЛ') || upperSize.includes('ХХЛ') ||
            upperSize.includes('3XL') || upperSize.includes('XXXL'));
    }

    return upperSize === fVal;
}

// Кэшированный инстанс Fuse.js для каталога (устраняет создание индекса на каждое нажатие клавиши)
/** @type {any} */
let _catalogFuseCache = null;
/** @type {any} */
let _catalogFuseItemsRef = null;

/** @param {any[]} items */
function getCatalogFuse(items) {
    if (!_catalogFuseCache || _catalogFuseItemsRef !== items) {
        _catalogFuseItemsRef = items;
        const fuseOptions = {
            includeScore: true, threshold: 0.4, ignoreLocation: true, useExtendedSearch: true,
            keys: [{ name: 'tags', weight: 1.0 }, { name: 'brand', weight: 0.8 }, { name: 'name', weight: 0.8 }, { name: 'size', weight: 0.8 }, { name: 'category', weight: 0.2 }]
        };
        const FuseCtor = /** @type {any} */ (globalThis).Fuse;
        _catalogFuseCache = new FuseCtor(items, fuseOptions);
    }
    return _catalogFuseCache;
}

/**
 * Сбрасывает кэшированный индекс Fuse.js и синхронизирует воркер поиска.
 */
export function invalidateFuseCache() {
    _catalogFuseCache = null;
    _catalogFuseItemsRef = null;
    if (hasAction('invalidateLiveSearchFuse')) invokeAction('invalidateLiveSearchFuse');
    const searchWorker = invokeAction('getSearchWorker');
    if (searchWorker && typeof searchWorker.setItems === 'function' && Array.isArray(window.allItems)) {
        searchWorker.setItems(window.allItems);
    }
}

let _applyFiltersSeq = 0;

/**
 * Основная асинхронная фильтрация, поиск, сортировка и перерисовка витрины каталога.
 * @param {boolean} [immediate=false]
 * @param {boolean} [preserveViewport=false]
 * @returns {Promise<void>}
 */
export function applyFilters(immediate = false, preserveViewport = false) {
    const grid = typeof document !== 'undefined' ? document.getElementById('itemsGrid') : null;
    const isInitialRender = !window.renderedCount || window.renderedCount === 0;

    if (!immediate && !preserveViewport && !isInitialRender && grid) {
        grid.classList.add('fade-out');
    }

    if (applyFiltersTimeout !== null) clearTimeout(applyFiltersTimeout);
    const delay = (immediate || preserveViewport || isInitialRender) ? 0 : 160;
    const filterSeq = ++_applyFiltersSeq;

    if (typeof _resolveApplyFilters === 'function') {
        _resolveApplyFilters();
        _resolveApplyFilters = null;
    }
    const { promise, resolve } = /** @type {PromiseWithResolvers<void>} */ (Promise.withResolvers());
    _resolveApplyFilters = resolve;
    applyFiltersTimeout = setTimeout(async () => {
        try {
            if (filterSeq !== _applyFiltersSeq) return;
            const g = /** @type {any} */ (globalThis);
            const searchInput = /** @type {HTMLInputElement | null} */ (typeof document !== 'undefined' ? document.getElementById('mainSearch') : null);
            const searchRaw = searchInput ? searchInput.value.trim() : '';
            const searchTerm = searchRaw.toLowerCase();
            const checkedSizes = typeof document !== 'undefined'
                ? Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => /** @type {HTMLInputElement} */ (cb).value)
                : [];
            const onlySaleEl = /** @type {HTMLInputElement | null} */ (typeof document !== 'undefined' ? document.getElementById('onlySaleCb') : null);
            const onlyBargainEl = /** @type {HTMLInputElement | null} */ (typeof document !== 'undefined' ? document.getElementById('onlyBargainCb') : null);
            const hideUnavailableEl = /** @type {HTMLInputElement | null} */ (typeof document !== 'undefined' ? document.getElementById('hideUnavailableCb') : null);
            const onlySale = onlySaleEl ? onlySaleEl.checked : false;
            const onlyBargain = onlyBargainEl ? onlyBargainEl.checked : false;
            const hideUnavailable = hideUnavailableEl ? hideUnavailableEl.checked : false;

            const minInput = /** @type {HTMLInputElement | null} */ (typeof document !== 'undefined' ? document.getElementById('priceMin') : null);
            const maxInput = /** @type {HTMLInputElement | null} */ (typeof document !== 'undefined' ? document.getElementById('priceMax') : null);
            const rawMin = minInput ? Number.parseInt(minInput.value, 10) : NaN;
            const minPrice = (Number.isFinite(rawMin) && rawMin >= 0) ? rawMin : 0;
            const rawMax = maxInput ? Number.parseInt(maxInput.value, 10) : NaN;
            const maxPrice = (Number.isFinite(rawMax) && rawMax > 0) ? rawMax : Infinity;

            const getSafePrice = (/** @type {any} */ price) => Number.parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
            let userFavs = getRuntimeFavorites();
            if (!userFavs || userFavs.length === 0) {
                const store = getCatalogStore();
                const cachedFavs = (store && typeof store.getJSON === 'function') ? store.getJSON('nisha_cached_favorites', null) : null;
                if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
                    userFavs = cachedFavs;
                    window.favorites = cachedFavs;
                }
            }
            const favsSet = new Set(userFavs);
            const hacked = isSiteHackedMode();
            const curCat = window.currentCategory || '';
            const curBrand = window.currentBrand || '';
            const onlyFavs = window.showingOnlyFavs || false;

            // 1. Фильтрация
            window.filteredItems = (window.allItems || []).filter(item => {
                if (!item) return false;

                const isFav = favsSet.has(item.id);
                const matchesAvailability = (!hideUnavailable && (searchTerm === '' || item.status !== 'sold')) || item.status === 'available';
                const matchesSale = !onlySale || !!item.is_sale;
                const matchesBargain = !onlyBargain || isItemBargainEnabled(item);

                if (onlyFavs) {
                    return isFav && matchesAvailability && matchesSale && matchesBargain;
                }

                const itemCategory = item.category || '';
                const itemBrand = item.brand ? item.brand.toLowerCase() : '';
                const searchBrand = curBrand ? curBrand.toLowerCase() : '';

                const matchesCategory = curCat === '' || itemCategory === curCat;
                const matchesBrand = searchBrand === '' || itemBrand.includes(searchBrand);
                const matchesSize = checkedSizes.length === 0 || checkedSizes.some(sz => itemMatchesSizeFilter(item, sz));

                const itemFinalPrice = hacked ? Math.floor(getSafePrice(item.price) * 0.9) : getSafePrice(item.price);
                const matchesPrice = itemFinalPrice >= minPrice && itemFinalPrice <= maxPrice;

                return matchesCategory && matchesBrand && matchesSize && matchesPrice && matchesAvailability && matchesSale && matchesBargain;
            });

            if (hasAction('yieldToMain')) await invokeAction('yieldToMain');
            if (filterSeq !== _applyFiltersSeq) return;

            // 2. Умный поиск (Web Worker Fuse.js с поддержкой транслитерации и надежный fallback)
            if (searchTerm !== '') {
                const cleanSearchTerm = searchTerm.replaceAll('#', '').trim();
                if (cleanSearchTerm) {
                    const searchWorker = invokeAction('getSearchWorker');
                    if (searchWorker && searchWorker.isReady()) {
                        const candidateIds = window.filteredItems.map(i => i.id);
                        const matchedIds = await searchWorker.searchCatalog(cleanSearchTerm, candidateIds);
                        if (filterSeq !== _applyFiltersSeq) return;
                        const itemMap = new Map(window.filteredItems.map(i => [i.id, i]));
                        window.filteredItems = matchedIds.map((/** @type {any} */ id) => itemMap.get(id)).filter(Boolean);
                    } else {
                        const priceQuery = (typeof g.parsePriceSearchQuery === 'function')
                            ? g.parsePriceSearchQuery(cleanSearchTerm)
                            : (hasAction('parsePriceSearchQuery') ? invokeAction('parsePriceSearchQuery', cleanSearchTerm) : null);
                        const canCheckPrice = typeof g.itemMatchesPrice === 'function' || hasAction('itemMatchesPrice');
                        const checkPriceFn = (/** @type {any} */ itm, /** @type {any} */ pq) => (typeof g.itemMatchesPrice === 'function'
                            ? g.itemMatchesPrice(itm, pq)
                            : invokeAction('itemMatchesPrice', itm, pq));

                        const matchedIds = new Set();
                        /** @type {any[]} */
                        const finalResults = [];

                        if (priceQuery && canCheckPrice) {
                            window.filteredItems.forEach(item => {
                                if (item && item.status !== 'sold' && checkPriceFn(item, priceQuery)) {
                                    if (!matchedIds.has(item.id)) {
                                        matchedIds.add(item.id);
                                        finalResults.push(item);
                                    }
                                }
                            });
                        }

                        const queryVariants = (typeof g.expandSearchQuery === 'function')
                            ? g.expandSearchQuery(cleanSearchTerm)
                            : [cleanSearchTerm.toLowerCase()];

                        if (typeof g.Fuse !== 'undefined') {
                            const fuse = getCatalogFuse(window.filteredItems);
                            for (const variant of queryVariants) {
                                const found = fuse.search(variant);
                                found.forEach((/** @type {any} */ res) => {
                                    if (res.item && res.item.status === 'sold') return;
                                    if (!matchedIds.has(res.item.id)) {
                                        matchedIds.add(res.item.id);
                                        finalResults.push(res.item);
                                    }
                                });
                            }
                            window.filteredItems = finalResults;
                        } else {
                            window.filteredItems = window.filteredItems.filter(item => {
                                if (item.status === 'sold') return false;
                                if (matchedIds.has(item.id)) return true;
                                const name = (item.name || '').toLowerCase();
                                const brand = (item.brand || '').toLowerCase();
                                const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : (item.tags || '').toLowerCase();
                                return queryVariants.some((/** @type {string} */ q) => name.includes(q) || brand.includes(q) || tags.includes(q));
                            });
                        }
                    }
                }
            }

            if (hasAction('yieldToMain')) await invokeAction('yieldToMain');
            if (filterSeq !== _applyFiltersSeq) return;

            // 3. Сортировка (кэшированные _ts / _priceNum через WeakMap без повторных Date.parse)
            const now = Date.now();
            const isItemTop = (/** @type {any} */ item) => item && item.is_top === true && getItemSortMeta(item).topUntilTs > now;
            const sortCheap = typeof document !== 'undefined' ? document.getElementById('sort-cheap') : null;

            const comparator = (sortCheap && sortCheap.classList.contains('active-sort'))
                ? (/** @type {any} */ a, /** @type {any} */ b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return getItemSortMeta(a).priceNum - getItemSortMeta(b).priceNum;
                }
                : (/** @type {any} */ a, /** @type {any} */ b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return getItemSortMeta(b).createdTs - getItemSortMeta(a).createdTs;
                };

            const preSortItems = window.filteredItems || [];
            /** @type {any[]} */
            const sortedItems = hasAction('toSorted')
                ? invokeAction('toSorted', preSortItems, comparator)
                : (preSortItems.toSorted ? preSortItems.toSorted(comparator) : [...preSortItems].sort(comparator));
            window.filteredItems = sortedItems;

            if (hasAction('yieldToMain')) await invokeAction('yieldToMain');
            if (filterSeq !== _applyFiltersSeq) return;

            // 4. СБРОС И РЕНДЕР (при preserveViewport сохраняем текущую страницу на ПК и число карточек на моб)
            const prevRenderedCount = window.renderedCount || 0;
            const prevPage = window.currentPage || 1;
            const batchSizeNow = window.innerWidth <= 900 ? 12 : 15;
            const maxPageNow = Math.max(1, Math.ceil(sortedItems.length / batchSizeNow));

            const savedScrollState = /** @type {any} */ ((isInitialRender && !preserveViewport) ? getSavedFeedScrollState() : null);
            const canRestoreScroll = Boolean(
                savedScrollState &&
                savedScrollState.scrollY > 80 &&
                (savedScrollState.category || '') === (curCat || '') &&
                (savedScrollState.search || '') === (searchTerm || '') &&
                Boolean(savedScrollState.showingFavs) === Boolean(onlyFavs) &&
                !curBrand &&
                checkedSizes.length === 0
            );

            if (grid) {
                if (typeof grid.replaceChildren === 'function') grid.replaceChildren();
                else grid.innerHTML = '';
            }
            window.renderedCount = 0;
            window.currentPage = preserveViewport
                ? Math.min(prevPage, maxPageNow)
                : (canRestoreScroll && window.innerWidth > 900 ? Math.min(savedScrollState.currentPage || 1, maxPageNow) : 1);

            const scrollTrigger = typeof document !== 'undefined' ? document.getElementById('loadingTrigger') : null;
            if (scrollTrigger && window.innerWidth <= 900) {
                scrollTrigger.style.display = 'block';
                if (typeof scrollTrigger.replaceChildren === 'function') scrollTrigger.replaceChildren();
                else scrollTrigger.innerHTML = '';
            }

            const countEl = typeof document !== 'undefined' ? document.getElementById('itemCount') : null;
            if (countEl) {
                /** @type {any} */ (countEl).textContent = sortedItems.length;
            }

            if (sortedItems.length === 0) {
                const noItemsMsg = tSafe('search.no_items', { defaultValue: 'ТОВАРОВ НЕ НАЙДЕНО' });
                const emptyHint = tSafe('search.no_items_hint', { defaultValue: 'Попробуйте изменить запрос или сбросить активные фильтры' });
                const resetBtnText = tSafe('search.reset_filters', { defaultValue: 'СБРОСИТЬ ФИЛЬТРЫ' });
                const hasCatalogItems = Array.isArray(window.allItems) && window.allItems.length > 0;
                const resetHtml = hasCatalogItems
                    ? `<div class="catalog-empty-hint">${emptyHint}</div><button type="button" class="catalog-empty-reset-btn btn-target" data-action="reset-to-main">[ ${resetBtnText} ]</button>`
                    : '';
                if (grid) {
                    grid.innerHTML = `<div class="catalog-empty-state"><div class="catalog-empty-title">[ ${noItemsMsg} ]</div>${resetHtml}</div>`;
                }
            } else {
                let targetMobileCount = 0;
                if (preserveViewport) {
                    targetMobileCount = Math.max(prevRenderedCount, batchSizeNow);
                } else if (canRestoreScroll) {
                    targetMobileCount = Math.max(savedScrollState.renderedCount || 0, batchSizeNow);
                }
                await renderNextBatch(targetMobileCount);
                if (filterSeq !== _applyFiltersSeq) return;

                if (canRestoreScroll) {
                    restoreFeedScrollPosition(savedScrollState);
                }
            }

            // Синхронизируем все активные фильтры с URL (?cat=...&brand=...&size=...&min=...&max=...&sort=...)
            const minDefault = minInput ? (Number.parseInt(minInput.min, 10) || 0) : 0;
            const maxDefault = maxInput ? (Number.parseInt(maxInput.max, 10) || 15000) : 15000;
            const activeSort = (sortCheap && sortCheap.classList.contains('active-sort')) ? 'cheap' : 'new';
            syncCatalogFiltersToUrl({
                category: curCat,
                brand: curBrand,
                sizes: checkedSizes,
                query: searchRaw,
                onlySale,
                onlyBargain,
                hideUnavailable,
                minPrice,
                maxPrice: Number.isFinite(maxPrice) ? maxPrice : maxDefault,
                minDefault,
                maxDefault,
                sort: activeSort,
                onlyFavs
            });

            // Подсветка активной категории
            if (typeof document !== 'undefined') {
                const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
                catLinks.forEach(el => el.classList.remove('active-filter'));

                if (curCat) {
                    catLinks.forEach(link => {
                        const dataCat = link.getAttribute('data-category');
                        const onclickText = link.getAttribute('onclick') || '';
                        if (dataCat === curCat || onclickText.includes(`'${curCat}'`)) {
                            link.classList.add('active-filter');
                        }
                    });
                } else {
                    const firstLink = document.querySelector('.sidebar .filter-list:first-of-type a');
                    if (firstLink) firstLink.classList.add('active-filter');
                }
            }

            updateSidebarCounters();
            renderActiveFilterChips();

            if (grid) {
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => grid.classList.remove('fade-out'));
                    });
                } else {
                    grid.classList.remove('fade-out');
                }
            }
        } catch (err) {
            console.error('ОШИБКА ФИЛЬТРАЦИИ:', err);
            if (grid) {
                const errMsg = err instanceof Error
                    ? err.message
                    : (err && typeof err === 'object' && 'message' in err ? String(/** @type {any} */ (err).message) : 'Unknown error');
                const safeRenderErr = escCardHtml(errMsg || 'Unknown error');
                grid.innerHTML = `<div class="catalog-error-state">[ ОШИБКА РЕНДЕРА: ${safeRenderErr} ]</div>`;
                grid.classList.remove('fade-out');
            }
        } finally {
            if (_resolveApplyFilters === resolve) {
                _resolveApplyFilters = null;
            }
            resolve();
        }
    }, delay);
    return promise;
}

// Автоматическая перерисовка каталога при смене режима экрана (ПК <-> мобильный, брейкпоинт 900px)
function initCatalogBreakpointWatcher() {
    if (typeof window === 'undefined') return;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let resizeTimer = null;
    const checkBreakpoint = () => {
        const nowMobile = window.innerWidth <= 900;
        if (window._catalogRenderedAsMobile === undefined || window._catalogRenderedAsMobile === nowMobile) return;
        if (!Array.isArray(window.filteredItems) || window.filteredItems.length === 0) return;

        const trigger = document.getElementById('loadingTrigger');
        if (trigger) trigger.style.display = nowMobile ? 'block' : 'none';
        applyFilters(true, false);
    };
    const scheduleCheck = () => {
        if (resizeTimer !== null) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(checkBreakpoint, 150);
    };
    window.addEventListener('resize', scheduleCheck, { passive: true });
    window.addEventListener('orientationchange', scheduleCheck, { passive: true });
    if (typeof window.matchMedia === 'function') {
        try {
            const mq = window.matchMedia('(max-width: 900px)');
            if (typeof mq.addEventListener === 'function') mq.addEventListener('change', scheduleCheck);
        } catch {}
    }
}
initCatalogBreakpointWatcher();

/**
 * Сортировка товаров (`new` | `cheap`) с плавной анимацией View Transitions API.
 * @param {'new'|'cheap'} type
 * @returns {any}
 */
export function sortItems(type) {
    invokeAction('playSound', 'menu', { kind: 'ui' });
    const updateDom = async () => {
        const sortNew = document.getElementById('sort-new');
        const sortCheap = document.getElementById('sort-cheap');
        if (sortNew) sortNew.classList.remove('active-sort');
        if (sortCheap) sortCheap.classList.remove('active-sort');

        const targetSort = document.getElementById('sort-' + type);
        if (targetSort) targetSort.classList.add('active-sort');

        const countEl = /** @type {(HTMLElement & { _sortFlashCtrl?: AbortController | null }) | null} */ (document.getElementById('itemCount'));
        if (countEl) {
            if (countEl._sortFlashCtrl) {
                try { countEl._sortFlashCtrl.abort(); } catch {}
            }
            const flashCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            countEl._sortFlashCtrl = flashCtrl;

            countEl.style.transition = 'opacity 0.3s ease, color 0.3s ease';
            countEl.style.opacity = '0.2';
            countEl.style.color = 'var(--accent-yellow)';

            /** @type {ReturnType<typeof setTimeout> | null} */
            let fallbackTimer = null;
            const restoreCountStyle = () => {
                if (fallbackTimer) {
                    clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                }
                if (flashCtrl?.signal.aborted) return;
                if (flashCtrl) flashCtrl.abort();
                if (countEl._sortFlashCtrl === flashCtrl) countEl._sortFlashCtrl = null;
                countEl.style.opacity = '1';
                countEl.style.color = 'var(--accent-green)';
            };

            if (typeof countEl.addEventListener === 'function') {
                countEl.addEventListener(
                    'transitionend',
                    (ev) => {
                        if (!ev || ev.target === countEl) restoreCountStyle();
                    },
                    flashCtrl ? { once: true, signal: flashCtrl.signal } : { once: true }
                );
            }
            if (flashCtrl) {
                flashCtrl.signal.addEventListener('abort', () => {
                    if (fallbackTimer) {
                        clearTimeout(fallbackTimer);
                        fallbackTimer = null;
                    }
                }, { once: true });
            }
            fallbackTimer = setTimeout(restoreCountStyle, 320);
        }

        await applyFilters(true, false);
    };

    const scrollGridIntoView = (/** @type {any} */ tr) => {
        const onFinish = () => {
            const grid = document.getElementById('itemsGrid');
            if (grid) {
                const rect = grid.getBoundingClientRect();
                if (rect.top < -100 || rect.top > (window.innerHeight || 800)) {
                    const y = rect.top + window.scrollY - 100;
                    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                }
            }
        };

        if (tr && typeof tr.finished?.then === 'function') {
            tr.finished.then(onFinish).catch(() => {});
        } else {
            const grid = typeof document !== 'undefined' ? document.getElementById('itemsGrid') : null;
            const activeAnims = grid && typeof grid.getAnimations === 'function' ? grid.getAnimations() : [];
            if (activeAnims.length > 0) {
                Promise.allSettled(activeAnims.map(a => a.finished)).then(onFinish);
            } else if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => requestAnimationFrame(onFinish));
            } else {
                onFinish();
            }
        }
    };

    const tr = runCatalogViewTransition(updateDom);
    scrollGridIntoView(tr);
    return tr;
}

/**
 * Плавное применение фильтров чекбоксов через View Transitions API.
 * @returns {any}
 */
export function triggerFilterTransition() {
    invokeAction('playSound', 'menu', { kind: 'ui' });
    const updateDom = async () => {
        await applyFilters(true, false);
    };
    return runCatalogViewTransition(updateDom);
}

/**
 * Устанавливает фильтр категории и перерисовывает каталог.
 * @param {string} cat
 * @param {HTMLElement} [element]
 * @returns {any}
 */
export function setCategoryFilter(cat, element) {
    invokeAction('playSound', 'menu', { kind: 'ui' });
    const updateDom = async () => {
        const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
        catLinks.forEach(el => el.classList.remove('active-filter'));
        if (element) {
            element.classList.add('active-filter');
        } else {
            const targetCat = String(cat || '');
            for (const el of catLinks) {
                if ((el.getAttribute('data-category') || '') === targetCat) {
                    el.classList.add('active-filter');
                    break;
                }
            }
        }
        const store = getCatalogStore();
        if (window.showingOnlyFavs) {
            window.showingOnlyFavs = false;
            if (store && store.session) store.session.remove('nisha_showing_favs');
            else { try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('nisha_showing_favs'); } catch {} }
            const favNav = document.getElementById('favNav');
            if (favNav) favNav.style.color = 'var(--accent-yellow)';
        }
        if (window.currentCategory !== cat) {
            clearSavedFeedScrollState();
        }
        window.currentCategory = cat;
        if (store && store.session) store.session.set('nisha_last_category', cat);
        else { try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('nisha_last_category', cat); } catch {} }
        await applyFilters(true, false);
    };

    return runCatalogViewTransition(updateDom);
}

registerActions({
    itemMatchesSizeFilter,
    updateSidebarCounters,
    invalidateFuseCache,
    applyFilters,
    sortItems,
    triggerFilterTransition,
    setCategoryFilter,
    clearSearchInput,
    updatePriceUI,
    toggleMobileSidebar,
    renderActiveFilterChips,
    removeActiveFilterChip,
    hydrateCatalogFiltersFromUrl,
    shareCurrentFilterLink
});

if (typeof window !== 'undefined') {
    window.updateSidebarCounters = updateSidebarCounters;
    window.invalidateFuseCache = invalidateFuseCache;
    window.applyFilters = applyFilters;
    window.sortItems = sortItems;
    window.setCategoryFilter = setCategoryFilter;
    window.renderActiveFilterChips = renderActiveFilterChips;
    window.removeActiveFilterChip = removeActiveFilterChip;
    window.shareCurrentFilterLink = shareCurrentFilterLink;
}
