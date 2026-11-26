// @ts-check
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    normalizeCategoryParam,
    categoryToUrlSlug,
    normalizeBrandParam,
    normalizeSizeToken,
    parseSizesFromParams,
    parsePriceBoundsFromParams,
    parseSortParam,
    hasExplicitFilterParams,
    parseCatalogFiltersFromUrl,
    buildCatalogFilterUrl,
    hydrateCatalogFiltersFromUrl,
    syncCatalogFiltersToUrl,
    shareCurrentFilterLink
} from '../js/catalog/catalog-url-sync.js';

describe('Smart Filter URLs (js/catalog/catalog-url-sync.js)', () => {
    it('normalizes category slugs, RU/UA/EN labels, and ignores unknown values safely', () => {
        expect(normalizeCategoryParam('outerwear')).toBe('Верхняя одежда');
        expect(normalizeCategoryParam('Верхняя одежда')).toBe('Верхняя одежда');
        expect(normalizeCategoryParam('верхній одяг')).toBe('Верхняя одежда');
        expect(normalizeCategoryParam('sweaters')).toBe('Кофты и Свитера');
        expect(normalizeCategoryParam('pants')).toBe('Штаны и Джинсы');
        expect(normalizeCategoryParam('shoes')).toBe('Обувь');
        expect(normalizeCategoryParam('Взуття')).toBe('Обувь');
        expect(normalizeCategoryParam('accs')).toBe('Аксессуары');
        expect(normalizeCategoryParam('all')).toBe('');
        expect(normalizeCategoryParam('unknown<script>')).toBe('');

        expect(categoryToUrlSlug('Верхняя одежда')).toBe('outerwear');
        expect(categoryToUrlSlug('Обувь')).toBe('shoes');
        expect(categoryToUrlSlug('')).toBe('');
    });

    it('normalizes brands and multi-size params (comma-separated & repeated keys)', () => {
        expect(normalizeBrandParam('  Rick   Owens \u0000 ')).toBe('Rick Owens');
        expect(normalizeBrandParam('a'.repeat(120))).toHaveLength(80);

        expect(normalizeSizeToken('m')).toBe('M');
        expect(normalizeSizeToken('xxl')).toBe('XL');
        expect(normalizeSizeToken('40 - 42')).toBe('40-42');
        expect(normalizeSizeToken('44')).toBe('43-46');
        expect(normalizeSizeToken('invalid')).toBe('');

        expect(parseSizesFromParams(new URLSearchParams('size=m,l,M,invalid'))).toEqual(['M', 'L']);
        expect(parseSizesFromParams(new URLSearchParams('size=S&size=40-42'))).toEqual(['S', '40-42']);
    });

    it('clamps price bounds and detects sort & explicit filter params', () => {
        expect(parsePriceBoundsFromParams(new URLSearchParams('min=1200&max=5000'))).toEqual({
            minPrice: 1200,
            maxPrice: 5000,
            hasCustomMin: true,
            hasCustomMax: true
        });
        expect(parsePriceBoundsFromParams(new URLSearchParams('min=-500&max=999999'))).toEqual({
            minPrice: 0,
            maxPrice: 15000,
            hasCustomMin: false,
            hasCustomMax: false
        });
        // Inverted range clamps cleanly so min < max
        const inverted = parsePriceBoundsFromParams(new URLSearchParams('min=8000&max=3000'));
        expect(inverted.minPrice).toBeLessThan(inverted.maxPrice);

        expect(parseSortParam('cheap')).toBe('cheap');
        expect(parseSortParam('price_asc')).toBe('cheap');
        expect(parseSortParam('new')).toBe('new');
        expect(parseSortParam('weird')).toBe('new');

        expect(hasExplicitFilterParams(new URLSearchParams('utm_source=tg&item=123'))).toBe(false);
        expect(hasExplicitFilterParams(new URLSearchParams('brand=Carhartt'))).toBe(true);
        expect(hasExplicitFilterParams(new URLSearchParams('size=M'))).toBe(true);
    });

    it('parses full smart URL into structured filter state', () => {
        const parsed = parseCatalogFiltersFromUrl('?cat=shoes&brand=Nike&size=40-42,43-46&q=Dunk&min=1500&max=6000&sale=1&bargain=true&stock=1&sort=cheap');
        expect(parsed).toEqual({
            hasAnyFilter: true,
            category: 'Обувь',
            brand: 'Nike',
            sizes: ['40-42', '43-46'],
            query: 'Dunk',
            onlySale: true,
            onlyBargain: true,
            hideUnavailable: true,
            minPrice: 1500,
            maxPrice: 6000,
            hasCustomMin: true,
            hasCustomMax: true,
            sort: 'cheap'
        });
    });

    it('builds canonical filter URL while preserving unrelated params (item, utm, action) and dropping defaults', () => {
        const next = buildCatalogFilterUrl('https://www.nisha-store.shop/?utm_source=ig&item=abc-1&search=old&minPrice=100', {
            category: 'Верхняя одежда',
            brand: 'Carhartt',
            sizes: ['M', 'L'],
            query: 'Detroit',
            onlySale: true,
            onlyBargain: false,
            hideUnavailable: true,
            minPrice: 1200,
            maxPrice: 15000,
            sort: 'cheap',
            onlyFavs: false
        });

        expect(next.searchParams.get('utm_source')).toBe('ig');
        expect(next.searchParams.get('item')).toBe('abc-1');
        expect(next.searchParams.get('cat')).toBe('outerwear');
        expect(next.searchParams.get('brand')).toBe('Carhartt');
        expect(next.searchParams.get('size')).toBe('M,L');
        expect(next.searchParams.get('q')).toBe('Detroit');
        expect(next.searchParams.get('min')).toBe('1200');
        expect(next.searchParams.has('max')).toBe(false);
        expect(next.searchParams.get('sale')).toBe('1');
        expect(next.searchParams.has('bargain')).toBe(false);
        expect(next.searchParams.get('stock')).toBe('1');
        expect(next.searchParams.get('sort')).toBe('cheap');
        // Legacy aliases cleaned up
        expect(next.searchParams.has('search')).toBe(false);
        expect(next.searchParams.has('minPrice')).toBe(false);

        // Resetting all filters leaves only non-filter params
        const clean = buildCatalogFilterUrl(next.href, {
            category: '',
            brand: '',
            sizes: [],
            query: '',
            onlySale: false,
            onlyBargain: false,
            hideUnavailable: false,
            minPrice: 0,
            maxPrice: 15000,
            sort: 'new',
            onlyFavs: false
        });
        expect(clean.search).toBe('?utm_source=ig&item=abc-1');
    });

    describe('DOM hydration, URL replaceState sync, and share link helper', () => {
        /** @type {Map<string, any>} */
        let byId;
        /** @type {any[]} */
        let sizeCbs;
        /** @type {any[]} */
        let catLinks;
        /** @type {Map<string, string>} */
        let sess;

        /** @param {string} [id] @param {Record<string, any>} [extra] */
        const makeEl = (id = '', extra = {}) => {
            const classes = new Set();
            return {
                id,
                value: '',
                textContent: '',
                checked: false,
                min: '',
                max: '',
                isConnected: true,
                style: { display: '', color: '', left: '', right: '' },
                classList: {
                    add: (/** @type {string[]} */ ...t) => t.forEach((x) => classes.add(x)),
                    remove: (/** @type {string[]} */ ...t) => t.forEach((x) => classes.delete(x)),
                    contains: (/** @type {string} */ t) => classes.has(t)
                },
                getAttribute: (/** @type {string} */ k) => extra[k] ?? null,
                ...extra
            };
        };

        beforeEach(() => {
            byId = new Map();
            sess = new Map();
            const priceMin = makeEl('priceMin', { min: '0', max: '15000', value: '0' });
            const priceMax = makeEl('priceMax', { min: '0', max: '15000', value: '15000' });
            const sortNew = makeEl('sort-new');
            sortNew.classList.add('active-sort');
            const sortCheap = makeEl('sort-cheap');
            const favNav = makeEl('favNav');
            byId.set('priceMin', priceMin);
            byId.set('priceMax', priceMax);
            byId.set('priceMinVal', makeEl('priceMinVal'));
            byId.set('priceMaxVal', makeEl('priceMaxVal'));
            byId.set('rangeFill', makeEl('rangeFill'));
            byId.set('mainSearch', makeEl('mainSearch'));
            byId.set('clearSearchBtn', makeEl('clearSearchBtn'));
            byId.set('onlySaleCb', makeEl('onlySaleCb'));
            byId.set('onlyBargainCb', makeEl('onlyBargainCb'));
            byId.set('hideUnavailableCb', makeEl('hideUnavailableCb'));
            byId.set('sort-new', sortNew);
            byId.set('sort-cheap', sortCheap);
            byId.set('favNav', favNav);

            sizeCbs = [
                makeEl('cb-s', { value: 'S' }),
                makeEl('cb-m', { value: 'M' }),
                makeEl('cb-l', { value: 'L' }),
                makeEl('cb-40', { value: '40-42' })
            ];
            catLinks = [
                makeEl('cat-all', { 'data-category': '' }),
                makeEl('cat-outer', { 'data-category': 'Верхняя одежда' }),
                makeEl('cat-shoes', { 'data-category': 'Обувь' })
            ];

            /** @type {any} */ (globalThis).sessionStorage = {
                getItem: (/** @type {string} */ k) => (sess.has(k) ? sess.get(k) : null),
                setItem: (/** @type {string} */ k, /** @type {any} */ v) => sess.set(k, String(v)),
                removeItem: (/** @type {string} */ k) => sess.delete(k)
            };
            /** @type {any} */ (globalThis).document = {
                getElementById: (/** @type {string} */ id) => byId.get(id) || null,
                querySelectorAll: (/** @type {string} */ sel) => {
                    if (sel === '.size-cb') return sizeCbs;
                    if (sel === '.sidebar .filter-list:first-of-type a') return catLinks;
                    return [];
                }
            };
            const replaceState = vi.fn((_st, _title, nextUrl) => {
                /** @type {any} */ (globalThis.window).location = new URL(String(nextUrl));
            });
            /** @type {any} */ (globalThis).window = {
                location: new URL('https://www.nisha-store.shop/?cat=outerwear&brand=Carhartt&size=M,L&min=1000&max=4500&sale=1&stock=1&sort=cheap&q=jacket'),
                history: { state: { nishaLayerDepth: 0 }, replaceState },
                currentCategory: '',
                currentBrand: '',
                showingOnlyFavs: false,
                copyToClipboard: vi.fn(async () => true)
            };
        });

        it('hydrates DOM controls from URL and overrides stale sessionStorage favorites/category', () => {
            sess.set('nisha_showing_favs', 'true');
            sess.set('nisha_last_category', 'Обувь');

            const res = hydrateCatalogFiltersFromUrl(new URLSearchParams(window.location.search));
            expect(res.hasAnyFilter).toBe(true);
            expect(window.showingOnlyFavs).toBe(false);
            expect(window.currentCategory).toBe('Верхняя одежда');
            expect(window.currentBrand).toBe('Carhartt');
            expect(catLinks[1].classList.contains('active-filter')).toBe(true);
            expect(byId.get('mainSearch').value).toBe('jacket');
            expect(byId.get('clearSearchBtn').style.display).toBe('block');
            expect(sizeCbs[1].checked).toBe(true);
            expect(sizeCbs[2].checked).toBe(true);
            expect(sizeCbs[0].checked).toBe(false);
            expect(byId.get('onlySaleCb').checked).toBe(true);
            expect(byId.get('hideUnavailableCb').checked).toBe(true);
            expect(byId.get('priceMin').value).toBe('1000');
            expect(byId.get('priceMax').value).toBe('4500');
            expect(byId.get('priceMinVal').textContent).toBe('1000');
            expect(byId.get('priceMaxVal').textContent).toBe('4500');
            expect(byId.get('sort-cheap').classList.contains('active-sort')).toBe(true);
            expect(byId.get('sort-new').classList.contains('active-sort')).toBe(false);
        });

        it('preserves sessionStorage fallback when URL has no explicit filter params', () => {
            sess.set('nisha_last_category', 'Обувь');
            /** @type {any} */ (window).location = new URL('https://www.nisha-store.shop/?utm_source=tg');

            const res = hydrateCatalogFiltersFromUrl(new URLSearchParams(window.location.search));
            expect(res.hasAnyFilter).toBe(false);
            expect(window.currentCategory).toBe('Обувь');
            expect(catLinks[2].classList.contains('active-filter')).toBe(true);
        });

        it('syncs URL only on actual change and copies current link via shareCurrentFilterLink', async () => {
            /** @type {any} */ (window).location = new URL('https://www.nisha-store.shop/');
            const updated1 = syncCatalogFiltersToUrl({ category: 'Обувь', brand: 'Salomon', sizes: ['40-42'] });
            expect(updated1).toBe(true);
            expect(window.location.search).toBe('?cat=shoes&brand=Salomon&size=40-42');

            // No redundant replaceState when URL is already identical
            const updated2 = syncCatalogFiltersToUrl({ category: 'Обувь', brand: 'Salomon', sizes: ['40-42'] });
            expect(updated2).toBe(false);
            expect(window.history.replaceState).toHaveBeenCalledTimes(1);

            const btn = makeEl('shareBtn');
            const ok = await shareCurrentFilterLink(/** @type {any} */ (btn));
            expect(ok).toBe(true);
            expect(window.copyToClipboard).toHaveBeenCalledWith(
                'https://www.nisha-store.shop/?cat=shoes&brand=Salomon&size=40-42',
                expect.any(String),
                expect.any(String)
            );
            expect(btn.classList.contains('is-copied')).toBe(true);
        });
    });
});
