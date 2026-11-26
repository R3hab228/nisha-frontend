// @ts-check
// ==========================================
// NISHA CATALOG — УМНЫЕ ССЫЛКИ НА ФИЛЬТРЫ (?cat=...&brand=...&size=...)
// ==========================================

import { invokeAction } from '../core/action-registry.js';
import { tSafe } from '../core/runtime-env.js';

export const DEFAULT_PRICE_MIN = 0;
export const DEFAULT_PRICE_MAX = 15000;
const PRICE_STEP_GAP = 100;

/** Каноничные категории БД → короткие читаемые слаги для URL */
export const CATEGORY_TO_SLUG = Object.freeze({
    'Верхняя одежда': 'outerwear',
    'Кофты и Свитера': 'sweaters',
    'Штаны и Джинсы': 'pants',
    'Обувь': 'shoes',
    'Аксессуары': 'accs'
});

/** Карта алиасов (слаги, RU, UA, EN) → каноничная категория БД */
const CATEGORY_ALIAS_MAP = new Map([
    // Верхняя одежда
    ['outerwear', 'Верхняя одежда'],
    ['jackets', 'Верхняя одежда'],
    ['jacket', 'Верхняя одежда'],
    ['верхняя одежда', 'Верхняя одежда'],
    ['верхній одяг', 'Верхняя одежда'],
    ['куртки', 'Верхняя одежда'],
    // Кофты и Свитера
    ['sweaters', 'Кофты и Свитера'],
    ['hoodies', 'Кофты и Свитера'],
    ['tops', 'Кофты и Свитера'],
    ['кофты и свитера', 'Кофты и Свитера'],
    ['кофти та светри', 'Кофты и Свитера'],
    ['кофти і светри', 'Кофты и Свитера'],
    ['свитера', 'Кофты и Свитера'],
    ['светри', 'Кофты и Свитера'],
    ['худи', 'Кофты и Свитера'],
    ['худі', 'Кофты и Свитера'],
    // Штаны и Джинсы
    ['pants', 'Штаны и Джинсы'],
    ['jeans', 'Штаны и Джинсы'],
    ['bottoms', 'Штаны и Джинсы'],
    ['штаны и джинсы', 'Штаны и Джинсы'],
    ['штани та джинси', 'Штаны и Джинсы'],
    ['штани і джинси', 'Штаны и Джинсы'],
    ['штаны', 'Штаны и Джинсы'],
    ['штани', 'Штаны и Джинсы'],
    ['джинсы', 'Штаны и Джинсы'],
    ['джинси', 'Штаны и Джинсы'],
    // Обувь
    ['shoes', 'Обувь'],
    ['footwear', 'Обувь'],
    ['sneakers', 'Обувь'],
    ['обувь', 'Обувь'],
    ['взуття', 'Обувь'],
    // Аксессуары
    ['accs', 'Аксессуары'],
    ['accessories', 'Аксессуары'],
    ['acc', 'Аксессуары'],
    ['аксессуары', 'Аксессуары'],
    ['аксесуари', 'Аксессуары']
]);

/** Алиасы размеров → каноничные значения `.size-cb` */
const SIZE_ALIAS_MAP = new Map([
    ['S', 'S'],
    ['XS', 'S'],
    ['С', 'S'],
    ['M', 'M'],
    ['М', 'M'],
    ['L', 'L'],
    ['Л', 'L'],
    ['XL', 'XL'],
    ['XXL', 'XL'],
    ['XL/XXL', 'XL'],
    ['XL / XXL', 'XL'],
    ['40-42', '40-42'],
    ['40 - 42', '40-42'],
    ['42', '40-42'],
    ['43-46', '43-46'],
    ['43 - 46', '43-46'],
    ['44', '43-46']
]);

/** Все URL-ключи, которые относятся к фильтрам каталога (включая legacy-алиасы) */
const FILTER_URL_KEYS = [
    'cat',
    'brand',
    'size',
    'q',
    'search',
    'min',
    'max',
    'minPrice',
    'maxPrice',
    'sale',
    'bargain',
    'stock',
    'instock',
    'available',
    'sort'
];

/**
 * Преобразует `cat` из URL (слаг, RU/UA/EN) в точное название категории каталога.
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function normalizeCategoryParam(raw) {
    if (!raw) return '';
    const cleaned = String(raw).trim().replace(/\s+/g, ' ');
    if (!cleaned || cleaned.toLowerCase() === 'all') return '';
    const mapped = CATEGORY_ALIAS_MAP.get(cleaned.toLowerCase());
    return mapped || '';
}

/**
 * Преобразует каноничную категорию каталога в короткий URL-слаг.
 * @param {string | null | undefined} category
 * @returns {string}
 */
export function categoryToUrlSlug(category) {
    const clean = String(category || '').trim();
    if (!clean) return '';
    if (Object.hasOwn(CATEGORY_TO_SLUG, clean)) {
        return /** @type {Record<string, string>} */ (CATEGORY_TO_SLUG)[clean];
    }
    return clean;
}

/**
 * Удаляет управляющие ASCII-символы (0x00–0x1F, 0x7F) без control-regex.
 * @param {string} str
 * @returns {string}
 */
function stripControlChars(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= 0x20 && code !== 0x7f) {
            out += str[i];
        }
    }
    return out;
}

/**
 * Очищает значение `brand` из URL (защита от мусора и переполнения).
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function normalizeBrandParam(raw) {
    if (!raw) return '';
    return stripControlChars(String(raw))
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80);
}

/**
 * Преобразует один токен размера в каноничное значение `.size-cb`.
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function normalizeSizeToken(raw) {
    if (!raw) return '';
    const upper = String(raw).trim().replace(/\s+/g, ' ').toUpperCase();
    return SIZE_ALIAS_MAP.get(upper) || '';
}

/**
 * Парсит параметры `size` (поддерживает `?size=M,L` и `?size=M&size=L`).
 * @param {URLSearchParams} urlParams
 * @returns {string[]}
 */
export function parseSizesFromParams(urlParams) {
    const rawValues = urlParams.getAll('size');
    if (!rawValues || rawValues.length === 0) return [];
    /** @type {string[]} */
    const result = [];
    const seen = new Set();
    for (const raw of rawValues) {
        const parts = String(raw || '').split(',');
        for (const part of parts) {
            const norm = normalizeSizeToken(part);
            if (norm && !seen.has(norm)) {
                seen.add(norm);
                result.push(norm);
            }
        }
    }
    return result;
}

/**
 * Безопасно парсит и ограничивает ценовой диапазон из URL.
 * @param {URLSearchParams} urlParams
 * @param {{ minDefault?: number, maxDefault?: number }} [bounds]
 * @returns {{ minPrice: number, maxPrice: number, hasCustomMin: boolean, hasCustomMax: boolean }}
 */
export function parsePriceBoundsFromParams(urlParams, bounds = {}) {
    const minDefault = Number.isFinite(bounds.minDefault) ? Number(bounds.minDefault) : DEFAULT_PRICE_MIN;
    const maxDefault = Number.isFinite(bounds.maxDefault) ? Number(bounds.maxDefault) : DEFAULT_PRICE_MAX;

    const rawMinStr = urlParams.get('min') ?? urlParams.get('minPrice');
    const rawMaxStr = urlParams.get('max') ?? urlParams.get('maxPrice');

    const parsedMin = rawMinStr !== null && rawMinStr.trim() !== '' ? Number.parseInt(rawMinStr, 10) : NaN;
    const parsedMax = rawMaxStr !== null && rawMaxStr.trim() !== '' ? Number.parseInt(rawMaxStr, 10) : NaN;

    let minPrice = Number.isFinite(parsedMin)
        ? Math.min(Math.max(parsedMin, minDefault), maxDefault - PRICE_STEP_GAP)
        : minDefault;
    let maxPrice = Number.isFinite(parsedMax)
        ? Math.min(Math.max(parsedMax, minDefault + PRICE_STEP_GAP), maxDefault)
        : maxDefault;

    if (minPrice >= maxPrice) {
        if (Number.isFinite(parsedMin) && !Number.isFinite(parsedMax)) {
            maxPrice = maxDefault;
        } else if (!Number.isFinite(parsedMin) && Number.isFinite(parsedMax)) {
            minPrice = minDefault;
        } else {
            minPrice = Math.max(minDefault, maxPrice - PRICE_STEP_GAP);
        }
    }

    return {
        minPrice,
        maxPrice,
        hasCustomMin: minPrice > minDefault,
        hasCustomMax: maxPrice < maxDefault
    };
}

/**
 * Парсит параметр сортировки (`cheap` | `new`).
 * @param {string | null | undefined} raw
 * @returns {'new' | 'cheap'}
 */
export function parseSortParam(raw) {
    const val = String(raw || '').trim().toLowerCase();
    if (val === 'cheap' || val === 'price' || val === 'price_asc' || val === 'asc') {
        return 'cheap';
    }
    return 'new';
}

/**
 * Проверяет, передан ли в URL хоть один явный параметр фильтра каталога.
 * @param {URLSearchParams} urlParams
 * @returns {boolean}
 */
export function hasExplicitFilterParams(urlParams) {
    return FILTER_URL_KEYS.some((key) => {
        if (!urlParams.has(key)) return false;
        const val = String(urlParams.get(key) || '').trim();
        return val.length > 0;
    });
}

/**
 * Проверяет булев флаг в URL (`1`, `true`, `yes`).
 * @param {string | null} raw
 * @returns {boolean}
 */
function isTruthyParam(raw) {
    if (!raw) return false;
    const v = String(raw).trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Парсит все поддерживаемые фильтры каталога из query-строки или `URLSearchParams`.
 * @param {string | URLSearchParams} searchOrParams
 * @param {{ minDefault?: number, maxDefault?: number }} [bounds]
 */
export function parseCatalogFiltersFromUrl(searchOrParams, bounds = {}) {
    const urlParams = searchOrParams instanceof URLSearchParams
        ? searchOrParams
        : new URLSearchParams(String(searchOrParams || ''));

    const hasAnyFilter = hasExplicitFilterParams(urlParams);
    const category = normalizeCategoryParam(urlParams.get('cat'));
    const brand = normalizeBrandParam(urlParams.get('brand'));
    const sizes = parseSizesFromParams(urlParams);
    const rawQuery = urlParams.get('q') ?? urlParams.get('search') ?? '';
    const query = stripControlChars(String(rawQuery)).trim().slice(0, 120);
    const onlySale = isTruthyParam(urlParams.get('sale'));
    const onlyBargain = isTruthyParam(urlParams.get('bargain'));
    const hideUnavailable = isTruthyParam(urlParams.get('stock'))
        || isTruthyParam(urlParams.get('instock'))
        || isTruthyParam(urlParams.get('available'));
    const { minPrice, maxPrice, hasCustomMin, hasCustomMax } = parsePriceBoundsFromParams(urlParams, bounds);
    const sort = parseSortParam(urlParams.get('sort'));

    return {
        hasAnyFilter,
        category,
        brand,
        sizes,
        query,
        onlySale,
        onlyBargain,
        hideUnavailable,
        minPrice,
        maxPrice,
        hasCustomMin,
        hasCustomMax,
        sort
    };
}

/**
 * Применяет фильтры из URL к состоянию `window` и элементам DOM сайдбара/поиска/сортировки.
 * Вызывается один раз при инициализации приложения (до загрузки каталога).
 * @param {URLSearchParams} urlParams
 * @returns {{ hasAnyFilter: boolean, parsed: ReturnType<typeof parseCatalogFiltersFromUrl> }}
 */
export function hydrateCatalogFiltersFromUrl(urlParams) {
    const minInput = /** @type {HTMLInputElement | null} */ (typeof document !== 'undefined' ? document.getElementById('priceMin') : null);
    const maxInput = /** @type {HTMLInputElement | null} */ (typeof document !== 'undefined' ? document.getElementById('priceMax') : null);
    const minDefault = minInput ? (Number.parseInt(minInput.min, 10) || DEFAULT_PRICE_MIN) : DEFAULT_PRICE_MIN;
    const maxDefault = maxInput ? (Number.parseInt(maxInput.max, 10) || DEFAULT_PRICE_MAX) : DEFAULT_PRICE_MAX;

    const parsed = parseCatalogFiltersFromUrl(urlParams, { minDefault, maxDefault });

    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return { hasAnyFilter: parsed.hasAnyFilter, parsed };
    }

    const quickAction = urlParams.get('action');

    // Если открыта умная ссылка с фильтрами — URL имеет приоритет над старым sessionStorage
    let showingFavs = quickAction === 'fav';
    let effectiveCategory = parsed.category;

    if (!parsed.hasAnyFilter && !showingFavs) {
        try {
            showingFavs = sessionStorage.getItem('nisha_showing_favs') === 'true';
            if (!effectiveCategory) {
                const storedCat = sessionStorage.getItem('nisha_last_category');
                effectiveCategory = normalizeCategoryParam(storedCat) || (storedCat ? String(storedCat).trim() : '');
            }
        } catch {}
    } else if (parsed.hasAnyFilter && quickAction !== 'fav') {
        showingFavs = false;
        try {
            sessionStorage.removeItem('nisha_showing_favs');
            sessionStorage.setItem('nisha_last_category', effectiveCategory);
        } catch {}
    }

    window.showingOnlyFavs = showingFavs;
    const favNav = document.getElementById('favNav');
    if (favNav) {
        favNav.style.color = showingFavs ? '#fff' : 'var(--accent-yellow)';
    }

    window.currentCategory = effectiveCategory;
    window.currentBrand = parsed.brand;

    // Подсветка активной категории в сайдбаре
    const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
    catLinks.forEach((el) => el.classList.remove('active-filter'));
    if (effectiveCategory) {
        let matchedLink = false;
        catLinks.forEach((link) => {
            const dataCat = link.getAttribute('data-category');
            const onclickText = link.getAttribute('onclick') || '';
            if (dataCat === effectiveCategory || onclickText.includes(`'${effectiveCategory}'`)) {
                link.classList.add('active-filter');
                matchedLink = true;
            }
        });
        if (!matchedLink && catLinks.length > 0) {
            catLinks[0].classList.add('active-filter');
        }
    } else if (catLinks.length > 0) {
        catLinks[0].classList.add('active-filter');
    }

    // Поиск
    if (parsed.query) {
        const sInput = /** @type {HTMLInputElement | null} */ (document.getElementById('mainSearch'));
        if (sInput) {
            sInput.value = parsed.query;
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) clearBtn.style.display = 'block';
        }
    }

    // Размеры
    if (parsed.sizes.length > 0) {
        const sizeSet = new Set(parsed.sizes);
        document.querySelectorAll('.size-cb').forEach((node) => {
            const cb = /** @type {HTMLInputElement} */ (node);
            if (sizeSet.has(String(cb.value || '').trim())) {
                cb.checked = true;
            }
        });
    }

    // Чекбоксы скидки / торга / наличия
    if (parsed.onlySale) {
        const saleCb = /** @type {HTMLInputElement | null} */ (document.getElementById('onlySaleCb'));
        if (saleCb) saleCb.checked = true;
    }
    if (parsed.onlyBargain) {
        const bargainCb = /** @type {HTMLInputElement | null} */ (document.getElementById('onlyBargainCb'));
        if (bargainCb) bargainCb.checked = true;
    }
    if (parsed.hideUnavailable) {
        const stockCb = /** @type {HTMLInputElement | null} */ (document.getElementById('hideUnavailableCb'));
        if (stockCb) stockCb.checked = true;
    }

    // Ценовой диапазон
    if (parsed.hasCustomMin || parsed.hasCustomMax) {
        if (minInput) minInput.value = String(parsed.minPrice);
        if (maxInput) maxInput.value = String(parsed.maxPrice);
        const minLabel = document.getElementById('priceMinVal');
        const maxLabel = document.getElementById('priceMaxVal');
        if (minLabel) minLabel.textContent = String(parsed.minPrice);
        if (maxLabel) maxLabel.textContent = String(parsed.maxPrice);
        const rangeFill = document.getElementById('rangeFill');
        if (rangeFill && maxDefault > 0) {
            rangeFill.style.left = `${(parsed.minPrice / maxDefault) * 100}%`;
            rangeFill.style.right = `${100 - (parsed.maxPrice / maxDefault) * 100}%`;
        }
    }

    // Сортировка
    if (parsed.sort === 'cheap') {
        const sortNew = document.getElementById('sort-new');
        const sortCheap = document.getElementById('sort-cheap');
        if (sortNew) sortNew.classList.remove('active-sort');
        if (sortCheap) sortCheap.classList.add('active-sort');
    }

    return { hasAnyFilter: parsed.hasAnyFilter, parsed };
}

/**
 * Строит актуальный URL каталога с активными фильтрами, бережно сохраняя
 * посторонние query-параметры (`item`, `action`, `utm_*`, `orderId` и т.д.).
 * @param {string} currentHref
 * @param {{
 *   category?: string,
 *   brand?: string,
 *   sizes?: string[],
 *   query?: string,
 *   onlySale?: boolean,
 *   onlyBargain?: boolean,
 *   hideUnavailable?: boolean,
 *   minPrice?: number,
 *   maxPrice?: number,
 *   minDefault?: number,
 *   maxDefault?: number,
 *   sort?: 'new' | 'cheap',
 *   onlyFavs?: boolean
 * }} state
 * @returns {URL}
 */
export function buildCatalogFilterUrl(currentHref, state) {
    const url = new URL(String(currentHref));
    const params = url.searchParams;

    // Убираем legacy-алиасы, чтобы в адресной строке был один каноничный ключ
    params.delete('search');
    params.delete('minPrice');
    params.delete('maxPrice');
    params.delete('instock');
    params.delete('available');

    const onlyFavs = Boolean(state.onlyFavs);
    const minDefault = Number.isFinite(state.minDefault) ? Number(state.minDefault) : DEFAULT_PRICE_MIN;
    const maxDefault = Number.isFinite(state.maxDefault) ? Number(state.maxDefault) : DEFAULT_PRICE_MAX;

    if (!onlyFavs && state.category) {
        params.set('cat', categoryToUrlSlug(state.category));
    } else {
        params.delete('cat');
    }

    const cleanBrand = !onlyFavs ? normalizeBrandParam(state.brand) : '';
    if (cleanBrand) {
        params.set('brand', cleanBrand);
    } else {
        params.delete('brand');
    }

    const cleanSizes = !onlyFavs && Array.isArray(state.sizes)
        ? Array.from(new Set(state.sizes.map((s) => String(s || '').trim()).filter(Boolean)))
        : [];
    if (cleanSizes.length > 0) {
        params.set('size', cleanSizes.join(','));
    } else {
        params.delete('size');
    }

    const cleanQuery = String(state.query || '').trim();
    if (cleanQuery) {
        params.set('q', cleanQuery);
    } else {
        params.delete('q');
    }

    const minVal = Number(state.minPrice);
    if (!onlyFavs && Number.isFinite(minVal) && minVal > minDefault) {
        params.set('min', String(Math.round(minVal)));
    } else {
        params.delete('min');
    }

    const maxVal = Number(state.maxPrice);
    if (!onlyFavs && Number.isFinite(maxVal) && maxVal > 0 && maxVal < maxDefault) {
        params.set('max', String(Math.round(maxVal)));
    } else {
        params.delete('max');
    }

    if (state.onlySale) params.set('sale', '1'); else params.delete('sale');
    if (state.onlyBargain) params.set('bargain', '1'); else params.delete('bargain');
    if (state.hideUnavailable) params.set('stock', '1'); else params.delete('stock');
    if (state.sort === 'cheap') params.set('sort', 'cheap'); else params.delete('sort');

    return url;
}

/**
 * Синхронизирует текущее состояние фильтров с адресной строкой через `history.replaceState`.
 * @param {Parameters<typeof buildCatalogFilterUrl>[1]} state
 * @returns {boolean} `true`, если URL был обновлён.
 */
export function syncCatalogFiltersToUrl(state) {
    if (typeof window === 'undefined' || !window.location || !window.history || typeof window.history.replaceState !== 'function') {
        return false;
    }
    try {
        const prevHref = String(window.location.href || window.location);
        const nextUrl = buildCatalogFilterUrl(prevHref, state);
        if (nextUrl.href === prevHref) {
            return false;
        }
        const curState = window.history.state !== undefined ? window.history.state : null;
        window.history.replaceState(curState, '', nextUrl);
        return true;
    } catch {
        return false;
    }
}

/**
 * Копирует умную ссылку текущей подборки фильтров в буфер обмена.
 * @param {HTMLElement | null} [triggerEl]
 * @returns {Promise<boolean>}
 */
export async function shareCurrentFilterLink(triggerEl = null) {
    if (typeof window === 'undefined' || !window.location) return false;
    const g = /** @type {any} */ (globalThis);
    if (typeof g.triggerHaptic === 'function') g.triggerHaptic('light');
    invokeAction('playSound', 'menu', { kind: 'ui' });

    const shareUrl = String(window.location.href || window.location);
    const copiedMsg = tSafe('filters.link_copied', 'Ссылка на подборку скопирована!');
    const errorMsg = tSafe('filters.link_copy_error', 'Не удалось скопировать ссылку');

    let copied = false;
    if (typeof window.copyToClipboard === 'function') {
        copied = await window.copyToClipboard(shareUrl, copiedMsg, errorMsg);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(shareUrl);
            copied = true;
            if (typeof g.showToast === 'function') g.showToast(copiedMsg, 'success');
        } catch {
            if (typeof g.showToast === 'function') g.showToast(errorMsg, 'error');
        }
    }

    if (copied && triggerEl && triggerEl.classList) {
        triggerEl.classList.add('is-copied');
        setTimeout(() => {
            if (triggerEl.isConnected) triggerEl.classList.remove('is-copied');
        }, 1600);
    }
    return copied;
}
