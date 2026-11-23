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
import { isItemBargainEnabled, escCardHtml } from './catalog-card-markup.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeFavorites, isSiteHackedMode } from '../core/runtime-env.js';

export {
    updateSidebarCounters,
    clearSearchInput,
    updatePriceUI,
    toggleMobileSidebar
};

let applyFiltersTimeout = null;
let _resolveApplyFilters = null;

/**
 * Проверяет соответствие товара (или строки размера) выбранному фильтру размера.
 * @param {object|string} itemOrSize
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
let _catalogFuseCache = null;
let _catalogFuseItemsRef = null;

function getCatalogFuse(items) {
    if (!_catalogFuseCache || _catalogFuseItemsRef !== items) {
        _catalogFuseItemsRef = items;
        const fuseOptions = {
            includeScore: true, threshold: 0.4, ignoreLocation: true, useExtendedSearch: true,
            keys: [{ name: 'tags', weight: 1.0 }, { name: 'brand', weight: 0.8 }, { name: 'name', weight: 0.8 }, { name: 'size', weight: 0.8 }, { name: 'category', weight: 0.2 }]
        };
        _catalogFuseCache = new Fuse(items, fuseOptions);
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

    clearTimeout(applyFiltersTimeout);
    const delay = (immediate || preserveViewport || isInitialRender) ? 0 : 160;
    const filterSeq = ++_applyFiltersSeq;

    if (typeof _resolveApplyFilters === 'function') {
        _resolveApplyFilters();
        _resolveApplyFilters = null;
    }
    const { promise, resolve } = Promise.withResolvers();
    _resolveApplyFilters = resolve;
    applyFiltersTimeout = setTimeout(async () => {
        try {
            if (filterSeq !== _applyFiltersSeq) return;
            const searchInput = typeof document !== 'undefined' ? document.getElementById('mainSearch') : null;
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const checkedSizes = typeof document !== 'undefined' ? Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => cb.value) : [];
            const onlySale = typeof document !== 'undefined' && document.getElementById('onlySaleCb') ? document.getElementById('onlySaleCb').checked : false;
            const onlyBargain = typeof document !== 'undefined' && document.getElementById('onlyBargainCb') ? document.getElementById('onlyBargainCb').checked : false;
            const hideUnavailable = typeof document !== 'undefined' && document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;

            const minInput = typeof document !== 'undefined' ? document.getElementById('priceMin') : null;
            const maxInput = typeof document !== 'undefined' ? document.getElementById('priceMax') : null;
            const rawMin = minInput ? Number.parseInt(minInput.value, 10) : NaN;
            const minPrice = (Number.isFinite(rawMin) && rawMin >= 0) ? rawMin : 0;
            const rawMax = maxInput ? Number.parseInt(maxInput.value, 10) : NaN;
            const maxPrice = (Number.isFinite(rawMax) && rawMax > 0) ? rawMax : Infinity;

            const getSafePrice = (price) => Number.parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
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
                        window.filteredItems = matchedIds.map(id => itemMap.get(id)).filter(Boolean);
                    } else {
                        const priceQuery = (typeof parsePriceSearchQuery === 'function')
                            ? parsePriceSearchQuery(cleanSearchTerm)
                            : (hasAction('parsePriceSearchQuery') ? invokeAction('parsePriceSearchQuery', cleanSearchTerm) : null);
                        const canCheckPrice = typeof itemMatchesPrice === 'function' || hasAction('itemMatchesPrice');
                        const checkPriceFn = (itm, pq) => (typeof itemMatchesPrice === 'function'
                            ? itemMatchesPrice(itm, pq)
                            : invokeAction('itemMatchesPrice', itm, pq));

                        const matchedIds = new Set();
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

                        const queryVariants = (typeof expandSearchQuery === 'function')
                            ? expandSearchQuery(cleanSearchTerm)
                            : [cleanSearchTerm.toLowerCase()];

                        if (typeof Fuse !== 'undefined') {
                            const fuse = getCatalogFuse(window.filteredItems);
                            for (const variant of queryVariants) {
                                const found = fuse.search(variant);
                                found.forEach(res => {
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
                                return queryVariants.some(q => name.includes(q) || brand.includes(q) || tags.includes(q));
                            });
                        }
                    }
                }
            }

            if (hasAction('yieldToMain')) await invokeAction('yieldToMain');
            if (filterSeq !== _applyFiltersSeq) return;

            // 3. Сортировка
            const now = Date.now();
            const isItemTop = (item) => item.is_top === true && item.top_until && Date.parse(item.top_until) > now;
            const sortCheap = typeof document !== 'undefined' ? document.getElementById('sort-cheap') : null;

            const comparator = (sortCheap && sortCheap.classList.contains('active-sort'))
                ? (a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return getSafePrice(a.price) - getSafePrice(b.price);
                }
                : (a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
                };

            window.filteredItems = hasAction('toSorted')
                ? invokeAction('toSorted', window.filteredItems, comparator)
                : (window.filteredItems.toSorted ? window.filteredItems.toSorted(comparator) : [...window.filteredItems].sort(comparator));

            if (hasAction('yieldToMain')) await invokeAction('yieldToMain');
            if (filterSeq !== _applyFiltersSeq) return;

            // 4. СБРОС И РЕНДЕР (при preserveViewport сохраняем текущую страницу на ПК и число карточек на моб)
            const prevRenderedCount = window.renderedCount || 0;
            const prevPage = window.currentPage || 1;
            const batchSizeNow = window.innerWidth <= 900 ? 12 : 15;
            const maxPageNow = Math.max(1, Math.ceil(window.filteredItems.length / batchSizeNow));

            const savedScrollState = (isInitialRender && !preserveViewport) ? getSavedFeedScrollState() : null;
            const canRestoreScroll = Boolean(
                savedScrollState &&
                savedScrollState.scrollY > 80 &&
                (savedScrollState.category || '') === (curCat || '') &&
                (savedScrollState.search || '') === (searchTerm || '') &&
                Boolean(savedScrollState.showingFavs) === Boolean(onlyFavs)
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
                countEl.textContent = window.filteredItems.length;
            }

            if (window.filteredItems.length === 0) {
                const noItemsMsg = typeof i18next !== 'undefined' ? i18next.t('search.no_items', { defaultValue: 'ТОВАРОВ НЕ НАЙДЕНО' }) : 'ТОВАРОВ НЕ НАЙДЕНО';
                if (grid) grid.innerHTML = `<div class="catalog-empty-state">[ ${noItemsMsg} ]</div>`;
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

            // Обновляем URL параметры
            if (typeof window !== 'undefined' && window.location && window.history) {
                try {
                    const url = new URL(window.location);
                    if (curCat) url.searchParams.set('cat', curCat); else url.searchParams.delete('cat');
                    if (searchTerm) url.searchParams.set('q', searchTerm); else url.searchParams.delete('q');
                    if (onlySale) url.searchParams.set('sale', '1'); else url.searchParams.delete('sale');
                    if (onlyBargain) url.searchParams.set('bargain', '1'); else url.searchParams.delete('bargain');
                    const curState = (window.history && window.history.state !== undefined) ? window.history.state : null;
                    window.history.replaceState(curState, '', url);
                } catch {}
            }

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
                const safeRenderErr = escCardHtml(err?.message || 'Unknown error');
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
        clearTimeout(resizeTimer);
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

        const countEl = document.getElementById('itemCount');
        if (countEl) {
            if (countEl._sortFlashCtrl) {
                try { countEl._sortFlashCtrl.abort(); } catch {}
            }
            const flashCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            countEl._sortFlashCtrl = flashCtrl;

            countEl.style.transition = 'opacity 0.3s ease, color 0.3s ease';
            countEl.style.opacity = '0.2';
            countEl.style.color = 'var(--accent-yellow)';

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

    const scrollGridIntoView = (tr) => {
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

const CATEGORY_CHIP_I18N_KEYS = Object.freeze({
    'Верхняя одежда': 'sidebar.outerwear',
    'Кофты и Свитера': 'sidebar.sweaters',
    'Штаны и Джинсы': 'sidebar.pants',
    'Обувь': 'sidebar.shoes',
    'Аксессуары': 'sidebar.accs'
});

const SIZE_CHIP_LABELS = Object.freeze({
    S: 'S',
    M: 'M',
    L: 'L',
    XL: 'XL / XXL',
    '40-42': '40 - 42',
    '43-46': '43 - 46'
});

function tCatalog(key, defaultValue) {
    if (typeof i18next !== 'undefined' && typeof i18next.t === 'function') {
        return i18next.t(key, { defaultValue });
    }
    return defaultValue;
}

/**
 * Рендерит полоску чипсов активных фильтров над сеткой каталога.
 * Скрывает контейнер, когда ни один фильтр не активен.
 */
export function renderActiveFilterChips() {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('activeFiltersBar');
    if (!bar) return;

    const chips = [];
    const curCat = (typeof window !== 'undefined' && window.currentCategory) ? String(window.currentCategory).trim() : '';
    const curBrand = (typeof window !== 'undefined' && window.currentBrand) ? String(window.currentBrand).trim() : '';
    const onlyFavs = Boolean(typeof window !== 'undefined' && window.showingOnlyFavs);
    const searchInput = document.getElementById('mainSearch');
    const searchRaw = searchInput ? String(searchInput.value || '').trim() : '';
    const checkedSizes = Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => String(cb.value || '').trim()).filter(Boolean);
    const onlySale = Boolean(document.getElementById('onlySaleCb')?.checked);
    const onlyBargain = Boolean(document.getElementById('onlyBargainCb')?.checked);
    const hideUnavailable = Boolean(document.getElementById('hideUnavailableCb')?.checked);

    const minInput = document.getElementById('priceMin');
    const maxInput = document.getElementById('priceMax');
    const minDefault = minInput ? (Number.parseInt(minInput.min, 10) || 0) : 0;
    const maxDefault = maxInput ? (Number.parseInt(maxInput.max, 10) || 15000) : 15000;
    const minVal = minInput ? Number.parseInt(minInput.value, 10) : minDefault;
    const maxVal = maxInput ? Number.parseInt(maxInput.value, 10) : maxDefault;
    const hasMinPrice = Number.isFinite(minVal) && minVal > minDefault;
    const hasMaxPrice = Number.isFinite(maxVal) && maxVal > 0 && maxVal < maxDefault;

    if (onlyFavs) {
        chips.push({
            type: 'fav',
            value: '1',
            label: `★ ${tCatalog('nav.favorites', 'ИЗБРАННОЕ')}`,
            cls: 'is-fav'
        });
    }

    if (curCat && !onlyFavs) {
        const catKey = Object.hasOwn(CATEGORY_CHIP_I18N_KEYS, curCat) ? CATEGORY_CHIP_I18N_KEYS[curCat] : '';
        const rawCatLabel = catKey ? tCatalog(catKey, curCat) : curCat;
        const cleanCatLabel = String(rawCatLabel).replace(/^\[>\]\s*/, '').trim();
        chips.push({
            type: 'category',
            value: curCat,
            label: cleanCatLabel,
            cls: 'is-category'
        });
    }

    if (curBrand && !onlyFavs) {
        chips.push({
            type: 'brand',
            value: curBrand,
            label: curBrand,
            cls: 'is-category'
        });
    }

    if (searchRaw) {
        chips.push({
            type: 'search',
            value: searchRaw,
            label: `"${searchRaw}"`,
            cls: 'is-search'
        });
    }

    if (!onlyFavs) {
        checkedSizes.forEach(sz => {
            const label = Object.hasOwn(SIZE_CHIP_LABELS, sz) ? SIZE_CHIP_LABELS[sz] : sz;
            chips.push({
                type: 'size',
                value: sz,
                label,
                cls: 'is-size'
            });
        });

        if (hasMinPrice || hasMaxPrice) {
            const uah = tCatalog('sidebar.uah', 'грн');
            const fromWord = tCatalog('sidebar.from', 'ОТ').toLowerCase();
            const toWord = tCatalog('sidebar.to', 'ДО').toLowerCase();
            let priceLabel = '';
            if (hasMinPrice && hasMaxPrice) priceLabel = `${minVal}–${maxVal} ${uah}`;
            else if (hasMinPrice) priceLabel = `${fromWord} ${minVal} ${uah}`;
            else priceLabel = `${toWord} ${maxVal} ${uah}`;
            chips.push({
                type: 'price',
                value: `${minVal}-${maxVal}`,
                label: priceLabel,
                cls: 'is-price'
            });
        }
    }

    if (onlySale) {
        chips.push({
            type: 'sale',
            value: '1',
            label: tCatalog('sidebar.only_sale', '% Только со скидкой'),
            cls: 'is-sale'
        });
    }

    if (onlyBargain) {
        chips.push({
            type: 'bargain',
            value: '1',
            label: tCatalog('sidebar.only_bargain', 'Только с торгом'),
            cls: 'is-bargain'
        });
    }

    if (hideUnavailable) {
        chips.push({
            type: 'unavailable',
            value: '1',
            label: tCatalog('filters.in_stock', 'Только в наличии'),
            cls: 'is-stock'
        });
    }

    if (chips.length === 0) {
        bar.style.display = 'none';
        if (typeof bar.replaceChildren === 'function') bar.replaceChildren();
        else bar.innerHTML = '';
        return;
    }

    const removeAriaPrefix = tCatalog('filters.remove_aria', 'Убрать фильтр');
    const htmlParts = chips.map(chip => {
        const safeLabel = escCardHtml(chip.label);
        const safeVal = escCardHtml(chip.value);
        const safeAria = escCardHtml(`${removeAriaPrefix}: ${chip.label}`);
        return `<button type="button" class="filter-chip ${chip.cls}" data-action="remove-filter-chip" data-filter-type="${chip.type}" data-filter-value="${safeVal}" aria-label="${safeAria}"><span>${safeLabel}</span><span class="filter-chip-close" aria-hidden="true">×</span></button>`;
    });

    bar.innerHTML = htmlParts.join('');
    bar.style.display = 'flex';
}

function resetPriceSlidersDom() {
    const minInput = document.getElementById('priceMin');
    const maxInput = document.getElementById('priceMax');
    const minDefault = minInput ? (Number.parseInt(minInput.min, 10) || 0) : 0;
    const maxDefault = maxInput ? (Number.parseInt(maxInput.max, 10) || 15000) : 15000;
    if (minInput) minInput.value = String(minDefault);
    if (maxInput) maxInput.value = String(maxDefault);
    const minLabel = document.getElementById('priceMinVal');
    const maxLabel = document.getElementById('priceMaxVal');
    if (minLabel) minLabel.textContent = String(minDefault);
    if (maxLabel) maxLabel.textContent = String(maxDefault);
    const rangeFill = document.getElementById('rangeFill');
    if (rangeFill) {
        rangeFill.style.left = '0%';
        rangeFill.style.right = '0%';
    }
}

/**
 * Снимает один конкретный активный фильтр по клику на чипс.
 * @param {string} type
 * @param {string} [value='']
 */
export function removeActiveFilterChip(type, value = '') {
    if (!type || typeof document === 'undefined') return;
    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    switch (type) {
        case 'category':
            return setCategoryFilter('');
        case 'search':
            return clearSearchInput();
        case 'fav': {
            invokeAction('playSound', 'menu', { kind: 'ui' });
            window.showingOnlyFavs = false;
            try { sessionStorage.removeItem('nisha_showing_favs'); } catch {}
            const favNav = document.getElementById('favNav');
            if (favNav) favNav.style.color = 'var(--accent-yellow)';
            return runCatalogViewTransition(() => applyFilters(true, false));
        }
        case 'brand': {
            invokeAction('playSound', 'menu', { kind: 'ui' });
            window.currentBrand = '';
            return runCatalogViewTransition(() => applyFilters(true, false));
        }
        case 'size': {
            const targetVal = String(value || '').trim();
            document.querySelectorAll('.size-cb:checked').forEach(cb => {
                if (String(cb.value || '').trim() === targetVal) cb.checked = false;
            });
            return triggerFilterTransition();
        }
        case 'price': {
            resetPriceSlidersDom();
            return triggerFilterTransition();
        }
        case 'sale': {
            const cb = document.getElementById('onlySaleCb');
            if (cb) cb.checked = false;
            return triggerFilterTransition();
        }
        case 'bargain': {
            const cb = document.getElementById('onlyBargainCb');
            if (cb) cb.checked = false;
            return triggerFilterTransition();
        }
        case 'unavailable': {
            const cb = document.getElementById('hideUnavailableCb');
            if (cb) cb.checked = false;
            return triggerFilterTransition();
        }
        default:
            return;
    }
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
    removeActiveFilterChip
});

if (typeof window !== 'undefined') {
    window.updateSidebarCounters = updateSidebarCounters;
    window.invalidateFuseCache = invalidateFuseCache;
    window.applyFilters = applyFilters;
    window.sortItems = sortItems;
    window.setCategoryFilter = setCategoryFilter;
    window.renderActiveFilterChips = renderActiveFilterChips;
    window.removeActiveFilterChip = removeActiveFilterChip;
}
