// @ts-check
// ==========================================
// NISHA CATALOG — ACTIVE FILTER CHIPS UI
// ==========================================

import { invokeAction } from '../core/action-registry.js';
import { tSafe } from '../core/runtime-env.js';
import { escCardHtml } from './catalog-card-markup.js';
import { runCatalogViewTransition } from './catalog-sidebar-ui.js';

/** @type {Readonly<Record<string, string>>} */
const CATEGORY_CHIP_I18N_KEYS = Object.freeze({
    'Верхняя одежда': 'sidebar.outerwear',
    'Кофты и Свитера': 'sidebar.sweaters',
    'Штаны и Джинсы': 'sidebar.pants',
    'Обувь': 'sidebar.shoes',
    'Аксессуары': 'sidebar.accs'
});

/** @type {Readonly<Record<string, string>>} */
const SIZE_CHIP_LABELS = Object.freeze({
    S: 'S',
    M: 'M',
    L: 'L',
    XL: 'XL / XXL',
    '40-42': '40 - 42',
    '43-46': '43 - 46'
});

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
    const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('mainSearch'));
    const searchRaw = searchInput ? String(searchInput.value || '').trim() : '';
    const checkedSizes = Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => String(/** @type {HTMLInputElement} */ (cb).value || '').trim()).filter(Boolean);
    const onlySale = Boolean(/** @type {HTMLInputElement | null} */ (document.getElementById('onlySaleCb'))?.checked);
    const onlyBargain = Boolean(/** @type {HTMLInputElement | null} */ (document.getElementById('onlyBargainCb'))?.checked);
    const hideUnavailable = Boolean(/** @type {HTMLInputElement | null} */ (document.getElementById('hideUnavailableCb'))?.checked);

    const minInput = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMin'));
    const maxInput = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMax'));
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
            label: `★ ${tSafe('nav.favorites', 'ИЗБРАННОЕ')}`,
            cls: 'is-fav'
        });
    }

    if (curCat && !onlyFavs) {
        const catKey = Object.hasOwn(CATEGORY_CHIP_I18N_KEYS, curCat) ? CATEGORY_CHIP_I18N_KEYS[curCat] : '';
        const rawCatLabel = catKey ? tSafe(catKey, curCat) : curCat;
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
            const activeCode = (typeof window !== 'undefined' && typeof window.getActiveCurrencyCode === 'function')
                ? window.getActiveCurrencyCode()
                : 'UAH';
            const isForeignCurrency = activeCode && activeCode !== 'UAH';
            const displayMin = (isForeignCurrency && typeof formatPrice === 'function')
                ? formatPrice(minVal, { numberOnly: true })
                : String(minVal);
            const displayMax = (isForeignCurrency && typeof formatPrice === 'function')
                ? formatPrice(maxVal, { numberOnly: true })
                : String(maxVal);
            const currUnit = isForeignCurrency
                ? (typeof getCurrency === 'function' ? getCurrency() : activeCode)
                : tSafe('sidebar.uah', 'грн');
            const fromWord = tSafe('sidebar.from', 'ОТ').toLowerCase();
            const toWord = tSafe('sidebar.to', 'ДО').toLowerCase();
            let priceLabel = '';
            if (hasMinPrice && hasMaxPrice) priceLabel = `${displayMin}–${displayMax} ${currUnit}`;
            else if (hasMinPrice) priceLabel = `${fromWord} ${displayMin} ${currUnit}`;
            else priceLabel = `${toWord} ${displayMax} ${currUnit}`;
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
            label: tSafe('sidebar.only_sale', '% Только со скидкой'),
            cls: 'is-sale'
        });
    }

    if (onlyBargain) {
        chips.push({
            type: 'bargain',
            value: '1',
            label: tSafe('sidebar.only_bargain', 'Только с торгом'),
            cls: 'is-bargain'
        });
    }

    if (hideUnavailable) {
        chips.push({
            type: 'unavailable',
            value: '1',
            label: tSafe('filters.in_stock', 'Только в наличии'),
            cls: 'is-stock'
        });
    }

    if (chips.length === 0) {
        bar.style.display = 'none';
        if (typeof bar.replaceChildren === 'function') bar.replaceChildren();
        else bar.innerHTML = '';
        return;
    }

    const removeAriaPrefix = tSafe('filters.remove_aria', 'Убрать фильтр');
    const htmlParts = chips.map(chip => {
        const safeLabel = escCardHtml(chip.label);
        const safeVal = escCardHtml(chip.value);
        const safeAria = escCardHtml(`${removeAriaPrefix}: ${chip.label}`);
        return `<button type="button" class="filter-chip ${chip.cls}" data-action="remove-filter-chip" data-filter-type="${chip.type}" data-filter-value="${safeVal}" aria-label="${safeAria}"><span>${safeLabel}</span><span class="filter-chip-close" aria-hidden="true">×</span></button>`;
    });

    const hasShareableFilter = chips.some(chip => chip.type !== 'fav');
    if (hasShareableFilter) {
        const shareLabel = escCardHtml(tSafe('filters.share_link', 'Поделиться'));
        const shareAria = escCardHtml(tSafe('filters.share_link_aria', 'Скопировать ссылку на подборку'));
        htmlParts.push(
            `<button type="button" class="filter-chip is-share-link" data-action="share-filter-link" aria-label="${shareAria}" title="${shareAria}"><svg class="filter-chip-link-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg><span>${shareLabel}</span></button>`
        );
    }

    bar.innerHTML = htmlParts.join('');
    bar.style.display = 'flex';
}

function resetPriceSlidersDom() {
    const minInput = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMin'));
    const maxInput = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMax'));
    const minDefault = minInput ? (Number.parseInt(minInput.min, 10) || 0) : 0;
    const maxDefault = maxInput ? (Number.parseInt(maxInput.max, 10) || 15000) : 15000;
    if (minInput) minInput.value = String(minDefault);
    if (maxInput) maxInput.value = String(maxDefault);
    const minLabel = document.getElementById('priceMinVal');
    const maxLabel = document.getElementById('priceMaxVal');
    const activeCode = (typeof window !== 'undefined' && typeof window.getActiveCurrencyCode === 'function')
        ? window.getActiveCurrencyCode()
        : 'UAH';
    if (activeCode && activeCode !== 'UAH' && typeof formatPrice === 'function') {
        if (minLabel) minLabel.textContent = formatPrice(minDefault, { numberOnly: true });
        if (maxLabel) maxLabel.textContent = formatPrice(maxDefault, { numberOnly: true });
    } else {
        if (minLabel) minLabel.textContent = String(minDefault);
        if (maxLabel) maxLabel.textContent = String(maxDefault);
    }
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
            return invokeAction('setCategoryFilter', '');
        case 'search':
            return invokeAction('clearSearchInput');
        case 'fav': {
            invokeAction('playSound', 'menu', { kind: 'ui' });
            window.showingOnlyFavs = false;
            try { sessionStorage.removeItem('nisha_showing_favs'); } catch {}
            const favNav = document.getElementById('favNav');
            if (favNav) favNav.style.color = 'var(--accent-yellow)';
            return runCatalogViewTransition(() => invokeAction('applyFilters', true, false));
        }
        case 'brand': {
            invokeAction('playSound', 'menu', { kind: 'ui' });
            window.currentBrand = '';
            return runCatalogViewTransition(() => invokeAction('applyFilters', true, false));
        }
        case 'size': {
            const targetVal = String(value || '').trim();
            document.querySelectorAll('.size-cb:checked').forEach(cb => {
                const input = /** @type {HTMLInputElement} */ (cb);
                if (String(input.value || '').trim() === targetVal) input.checked = false;
            });
            return invokeAction('triggerFilterTransition');
        }
        case 'price': {
            resetPriceSlidersDom();
            return invokeAction('triggerFilterTransition');
        }
        case 'sale': {
            const cb = /** @type {HTMLInputElement | null} */ (document.getElementById('onlySaleCb'));
            if (cb) cb.checked = false;
            return invokeAction('triggerFilterTransition');
        }
        case 'bargain': {
            const cb = /** @type {HTMLInputElement | null} */ (document.getElementById('onlyBargainCb'));
            if (cb) cb.checked = false;
            return invokeAction('triggerFilterTransition');
        }
        case 'unavailable': {
            const cb = /** @type {HTMLInputElement | null} */ (document.getElementById('hideUnavailableCb'));
            if (cb) cb.checked = false;
            return invokeAction('triggerFilterTransition');
        }
        default:
            return;
    }
}
