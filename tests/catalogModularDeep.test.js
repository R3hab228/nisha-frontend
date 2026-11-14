import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';

class MemStorage {
    constructor() {
        this._map = new Map();
    }
    getItem(k) {
        return this._map.has(k) ? this._map.get(k) : null;
    }
    setItem(k, v) {
        this._map.set(k, String(v));
    }
    removeItem(k) {
        this._map.delete(k);
    }
    clear() {
        this._map.clear();
    }
}

function createFakeEl(tagName = 'div') {
    const attrs = new Map();
    const classes = new Set();
    const listeners = new Map();
    const children = [];
    const el = {
        tagName: tagName.toUpperCase(),
        id: '',
        innerHTML: '',
        innerText: '',
        textContent: '',
        value: '',
        checked: false,
        disabled: false,
        complete: true,
        naturalWidth: 100,
        clientWidth: 200,
        offsetWidth: 200,
        offsetHeight: 300,
        scrollLeft: 0,
        scrollHeight: 300,
        offsetTop: 0,
        children,
        childNodes: children,
        parentElement: null,
        isConnected: true,
        dataset: {},
        style: {
            display: '',
            opacity: '',
            color: '',
            borderColor: '',
            background: '',
            maxHeight: '',
            paddingBottom: '',
            left: '',
            right: '',
            top: '',
            transition: '',
            setProperty(k, v) { this[k] = v; }
        },
        classList: {
            add: (...tokens) => tokens.forEach(t => classes.add(t)),
            remove: (...tokens) => tokens.forEach(t => classes.delete(t)),
            contains: (t) => classes.has(t),
            toggle: (t, force) => {
                const on = typeof force === 'boolean' ? force : !classes.has(t);
                if (on) classes.add(t);
                else classes.delete(t);
                return on;
            }
        },
        setAttribute: (k, v) => {
            attrs.set(k, String(v));
            if (k === 'id') el.id = String(v);
            if (k === 'data-id') el.dataset.id = String(v);
        },
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        removeAttribute: (k) => attrs.delete(k),
        appendChild: (child) => {
            if (child && child.children && child.tagName === 'FRAGMENT') {
                child.children.forEach(c => {
                    c.parentElement = el;
                    children.push(c);
                });
                child.children.length = 0;
                return child;
            }
            if (child) child.parentElement = el;
            children.push(child);
            return child;
        },
        insertBefore: (child, ref) => {
            if (child) child.parentElement = el;
            const idx = children.indexOf(ref);
            if (idx === -1) children.push(child);
            else children.splice(idx, 0, child);
            return child;
        },
        replaceChildren: (...nodes) => {
            children.length = 0;
            el.innerHTML = '';
            nodes.forEach(n => el.appendChild(n));
        },
        remove: () => {
            if (el.parentElement) {
                const siblings = el.parentElement.children;
                const idx = siblings.indexOf(el);
                if (idx !== -1) siblings.splice(idx, 1);
            }
            el.isConnected = false;
        },
        insertAdjacentHTML: vi.fn((pos, html) => {
            el._insertedHtml = (el._insertedHtml || '') + html;
        }),
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(() => []),
        closest: vi.fn(() => null),
        getBoundingClientRect: () => ({ top: el.offsetTop, bottom: el.offsetTop + 200 }),
        addEventListener: vi.fn((evt, cb) => {
            if (!listeners.has(evt)) listeners.set(evt, []);
            listeners.get(evt).push(cb);
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: (evt) => {
            (listeners.get(evt.type) || []).forEach(cb => cb(evt));
        }
    };
    return el;
}

describe('Modular Catalog Runtime & Behavioral Deep Suite (js/catalog/*.js)', () => {
    let catalogMod;
    let elementsById;
    let allQuerySelectors;
    let mockSession;
    let mockLocal;
    let idbStore;

    beforeAll(async () => {
        elementsById = new Map();
        allQuerySelectors = new Map();
        mockSession = new MemStorage();
        mockLocal = new MemStorage();
        idbStore = new Map();

        const storageFacade = {
            get: (k) => mockLocal.getItem(k),
            set: (k, v) => mockLocal.setItem(k, v),
            remove: (k) => mockLocal.removeItem(k),
            getJSON: (k, fb = null) => {
                const raw = mockLocal.getItem(k);
                if (!raw) return fb;
                try { return JSON.parse(raw); } catch { return fb; }
            },
            setJSON: (k, v) => mockLocal.setItem(k, JSON.stringify(v)),
            session: {
                get: (k) => mockSession.getItem(k),
                set: (k, v) => mockSession.setItem(k, v)
            }
        };

        globalThis.sessionStorage = mockSession;
        globalThis.localStorage = mockLocal;
        globalThis.history = { scrollRestoration: 'auto', replaceState: vi.fn() };
        globalThis.requestAnimationFrame = (cb) => {
            cb();
            return 1;
        };
        globalThis.cancelAnimationFrame = vi.fn();

        const bodyEl = createFakeEl('body');
        globalThis.document = {
            hidden: false,
            visibilityState: 'visible',
            body: bodyEl,
            documentElement: { scrollTop: 0 },
            activeElement: null,
            createElement: (tag) => createFakeEl(tag),
            createTextNode: (text) => ({ nodeType: 3, textContent: text, remove: vi.fn() }),
            createDocumentFragment: () => createFakeEl('fragment'),
            getElementById: (id) => elementsById.get(id) || null,
            querySelector: (sel) => (allQuerySelectors.get(sel) || [])[0] || null,
            querySelectorAll: (sel) => allQuerySelectors.get(sel) || [],
            addEventListener: vi.fn()
        };

        globalThis.window = {
            innerWidth: 1280,
            innerHeight: 800,
            scrollY: 0,
            location: new URL('https://www.nisha-store.shop/'),
            history: globalThis.history,
            storage: storageFacade,
            scrollTo: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn() })),
            escapeHtml: (s) => String(s || '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;'),
            escapeAttr: (s) => String(s || '').replaceAll('"', '&quot;'),
            formatPrice: (p) => `${Number(p) || 0} грн`,
            safeTruncateText: (s, n) => String(s || '').slice(0, n),
            idbGet: vi.fn(async (k) => (idbStore.has(k) ? idbStore.get(k) : null)),
            idbSet: vi.fn(async (k, v) => {
                idbStore.set(k, v);
                return true;
            }),
            idbDel: vi.fn(async (k) => idbStore.delete(k))
        };

        globalThis.storage = storageFacade;
        globalThis.i18next = {
            t: (key, opts = {}) => opts.defaultValue || key
        };
        globalThis.getCurrency = () => 'грн';
        globalThis.showToast = vi.fn();
        globalThis.showTerminalModal = vi.fn();
        globalThis.enqueueNewItemToast = vi.fn();
        globalThis.closeModal = vi.fn();
        globalThis.renderHistory = vi.fn();
        globalThis.updateCartUI = vi.fn();
        globalThis.syncCartToServer = vi.fn();
        globalThis.tryShowBroadcast = vi.fn();

        catalogMod = await import('../js/catalog/catalog.js');
    });

    beforeEach(() => {
        elementsById.clear();
        allQuerySelectors.clear();
        mockSession.clear();
        mockLocal.clear();
        idbStore.clear();
        window.allItems = [];
        window.filteredItems = [];
        window.renderedCount = 0;
        window.currentPage = 1;
        window.currentCategory = '';
        window.currentBrand = '';
        window.showingOnlyFavs = false;
        window.favorites = [];
        window.cart = [];
        window.isHacked = false;
        window.innerWidth = 1280;
        window.scrollY = 0;
        window._notifiedItemIds = new Set();
        document.body.style.overflow = '';
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    afterAll(() => {
        if (window._catalogSyncIntervalId) {
            clearInterval(window._catalogSyncIntervalId);
        }
    });

    it('1. Re-exports full public API from catalog.js and registers runtime window globals where still required', () => {
        const expectedCatalogApi = [
            'getCurrentSiteLang',
            'saveCurrentFeedScrollState',
            'scheduleFeedScrollSave',
            'getSavedFeedScrollState',
            'clearSavedFeedScrollState',
            'restoreFeedScrollPosition',
            'showScrollRestoredBadge',
            'toCDN',
            'getOptimizedImageUrl',
            'prefetchItemImages',
            'cancelPrefetchItemImages',
            'isSafeMediaUrl',
            'normalizeMeasurementUnits',
            'formatMeasurementItem',
            'extractItemMeasurements',
            'showItemMeasurementsTooltip',
            'moveItemMeasurementsTooltip',
            'isItemMeasurementsTooltipVisible',
            'hideItemMeasurementsTooltip',
            'updateCardDOM',
            'buildCardDOM',
            'getCatalogItemComparator',
            'insertNewItemCardSmoothly',
            'renderNextBatch',
            'changePage',
            'activateCardSlides',
            'updateCardDots',
            'scrollGridSlider',
            'preloadGridSlide',
            'handleDoubleTapLike',
            'itemMatchesSizeFilter',
            'updateSidebarCounters',
            'invalidateFuseCache',
            'applyFilters',
            'sortItems',
            'triggerFilterTransition',
            'setCategoryFilter',
            'clearSearchInput',
            'updatePriceUI',
            'toggleMobileSidebar',
            'loadAllItems',
            'removeSoldItemFromCart',
            'handleRealtimeCatalogEvent',
            'initCatalogRealtimeSubscription',
            'syncCriticalStatuses',
            'showBadgeInfo',
            'flushPendingBroadcast',
            'startOnboardingTour'
        ];

        const expectedWindowFns = [
            'saveCurrentFeedScrollState',
            'getSavedFeedScrollState',
            'clearSavedFeedScrollState',
            'restoreFeedScrollPosition',
            'showScrollRestoredBadge',
            'toCDN',
            'isSafeMediaUrl',
            'isItemMeasurementsTooltipVisible',
            'hideItemMeasurementsTooltip',
            'updateCardDOM',
            'getCatalogItemComparator',
            'insertNewItemCardSmoothly',
            'changePage',
            'updateCardDots',
            'updateSidebarCounters',
            'invalidateFuseCache',
            'applyFilters',
            'sortItems',
            'setCategoryFilter',
            'loadAllItems',
            'removeSoldItemFromCart',
            'initCatalogRealtimeSubscription',
            'syncCriticalStatuses'
        ];

        for (const fnName of expectedCatalogApi) {
            expect(typeof catalogMod[fnName]).toBe('function');
        }
        for (const fnName of expectedWindowFns) {
            expect(typeof window[fnName]).toBe('function');
        }
        expect(history.scrollRestoration).toBe('manual');
    });

    it('2. catalog-state.js normalizes site languages accurately (uk->ua, ru_RU->ru, invalid->ua)', () => {
        mockLocal.setItem('nisha_lang', 'uk');
        expect(catalogMod.getCurrentSiteLang()).toBe('ua');

        mockLocal.setItem('nisha_lang', 'ru_RU');
        expect(catalogMod.getCurrentSiteLang()).toBe('ru');

        mockLocal.setItem('nisha_lang', 'en-US');
        expect(catalogMod.getCurrentSiteLang()).toBe('en');

        mockLocal.setItem('nisha_lang', 'fr');
        expect(catalogMod.getCurrentSiteLang()).toBe('ua');
    });

    it('3. scroll-restoration.js saves, validates TTL (4h), skips active modals, and clears feed state', () => {
        window.scrollY = 920;
        window.renderedCount = 24;
        window.currentPage = 2;
        window.currentCategory = 'Обувь';

        const searchEl = createFakeEl('input');
        searchEl.value = 'Nike ';
        elementsById.set('mainSearch', searchEl);

        const activeCard = createFakeEl('div');
        activeCard.dataset.id = 'item-77';
        activeCard.offsetTop = 100;
        allQuerySelectors.set('#itemsGrid .item-card', [activeCard]);

        catalogMod.saveCurrentFeedScrollState();
        const saved = catalogMod.getSavedFeedScrollState();
        expect(saved).toMatchObject({
            scrollY: 920,
            renderedCount: 24,
            currentPage: 2,
            category: 'Обувь',
            search: 'nike',
            activeItemId: 'item-77'
        });

        // Skips saving when a modal is active
        document.body.style.overflow = 'hidden';
        window.scrollY = 10;
        catalogMod.saveCurrentFeedScrollState();
        expect(catalogMod.getSavedFeedScrollState().scrollY).toBe(920);
        document.body.style.overflow = '';

        // Expires state older than 4 hours
        const expired = { ...saved, timestamp: Date.now() - (4 * 60 * 60 * 1000 + 5000) };
        mockSession.setItem('nisha_feed_scroll_v1', JSON.stringify(expired));
        expect(catalogMod.getSavedFeedScrollState()).toBeNull();

        catalogMod.saveCurrentFeedScrollState();
        expect(catalogMod.getSavedFeedScrollState()).not.toBeNull();
        catalogMod.clearSavedFeedScrollState();
        expect(catalogMod.getSavedFeedScrollState()).toBeNull();
    });

    it('4. media-prefetch.js rewrites Supabase URLs to CDN, prefixes thumbs, and blocks unsafe URL schemes', () => {
        const raw = 'https://nmpuefxqtkhvtltdvllz.supabase.co/storage/v1/object/public/items-images/item_123.webp';
        expect(catalogMod.toCDN(raw, { isThumb: true })).toBe(
            'https://cdn.nisha-store.shop/storage/v1/object/public/items-images/thumb_item_123.webp'
        );

        const vid = 'https://nmpuefxqtkhvtltdvllz.supabase.co/storage/v1/object/public/items-images/item_123.mp4';
        expect(catalogMod.toCDN(vid, { isThumb: true })).toBe(
            'https://cdn.nisha-store.shop/storage/v1/object/public/items-images/item_123.mp4'
        );

        const optimizedThumb = catalogMod.getOptimizedImageUrl({
            thumbnails: [raw],
            images: ['https://cdn.nisha-store.shop/fallback.jpg']
        }, true);
        expect(optimizedThumb).toContain('thumb_item_123.webp');

        expect(catalogMod.isSafeMediaUrl('https://cdn.nisha-store.shop/a.jpg')).toBe(true);
        expect(catalogMod.isSafeMediaUrl('javascript:alert(1)')).toBe(false);
        expect(catalogMod.isSafeMediaUrl('vbscript:msgbox(1)')).toBe(false);
        expect(catalogMod.isSafeMediaUrl('')).toBe(false);
    });

    it('5. measurements.js parses multi-line, inline, reverse-order, and note measurements across UA/RU/EN', () => {
        const item = {
            description: 'Заміри:\nДовжина рукава від плеча 64 см (трошки тягнеться)\nПОГ 54\n28.5 стелька\nСтан: 9/10\nЦена: 1200 грн'
        };

        const uaList = catalogMod.extractItemMeasurements(item, 'ua');
        expect(uaList).toEqual([
            'Рукав від плеча 64 см (тягнеться)',
            'Напівобхват грудей 54 см',
            'Устілка 28.5 см'
        ]);

        const enList = catalogMod.extractItemMeasurements(item, 'en');
        expect(enList).toEqual([
            'Sleeve from shoulder 64 cm (stretches)',
            'Chest (pit-to-pit) 54 cm',
            'Insole 28.5 cm'
        ]);

        // Inline smushed measurements split properly & cap at 8
        const inlineItem = {
            description: 'довжина 70 ширина 52 рукав 62 плечи 48 пояс 40 бедра 55 выход 21 замок 58 посадка 30'
        };
        const ruInline = catalogMod.extractItemMeasurements(inlineItem, 'ru');
        expect(ruInline).toHaveLength(8);
        expect(ruInline[0]).toBe('Длина 70 см');
        expect(ruInline[1]).toBe('Ширина 52 см');

        // Cyrillic unknown note stripped on English
        expect(catalogMod.formatMeasurementItem('Длина 70 (слегка маломерит)', 'en')).toBe('Length 70 cm');
    });

    it('6. catalog-filters.js itemMatchesSizeFilter enforces exact clothing & shoe boundaries', () => {
        expect(catalogMod.itemMatchesSizeFilter({ category: 'Обувь', size: '41 (26.5 см)' }, '40-42')).toBe(true);
        expect(catalogMod.itemMatchesSizeFilter({ category: 'Обувь', size: '44' }, '40-42')).toBe(false);
        expect(catalogMod.itemMatchesSizeFilter({ category: 'Обувь', size: '44' }, '43-46')).toBe(true);
        expect(catalogMod.itemMatchesSizeFilter({ category: 'Обувь', size: '42' }, 'S')).toBe(false);

        expect(catalogMod.itemMatchesSizeFilter({ category: 'Кофты и Свитера', size: 'XL / L' }, 'L')).toBe(false);
        expect(catalogMod.itemMatchesSizeFilter({ category: 'Кофты и Свитера', size: 'L (по факту M)' }, 'L')).toBe(true);
        expect(catalogMod.itemMatchesSizeFilter({ category: 'Кофты и Свитера', size: 'XS' }, 'S')).toBe(true);
        expect(catalogMod.itemMatchesSizeFilter({ category: 'Кофты и Свитера', size: 'М' }, 'M')).toBe(true);
        expect(catalogMod.itemMatchesSizeFilter({ category: 'Кофты и Свитера', size: '3XL' }, 'XL')).toBe(true);
    });

    it('7. catalog-grid.js buildStatusBadgeHtml, buildCardPriceHtml & comparator handle TOP, Bargain, XSS', () => {
        const now = Date.now();
        const future = new Date(now + 60_000).toISOString();
        const past = new Date(now - 60_000).toISOString();

        expect(catalogMod.buildStatusBadgeHtml({ status: 'sold' })).toBe('<div class="sold-badge">SOLD</div>');
        expect(catalogMod.buildStatusBadgeHtml({ status: 'reserved' })).toBe('<div class="reserved-badge">RESERVED</div>');

        const activeTopSaleHot = catalogMod.buildStatusBadgeHtml({
            status: 'available',
            is_top: true,
            top_until: future,
            is_sale: true,
            views_count: 30
        });
        expect(activeTopSaleHot).toContain('status-top');
        expect(activeTopSaleHot).toContain('status-sale');
        expect(activeTopSaleHot).toContain('status-hot');

        const expiredTop = catalogMod.buildStatusBadgeHtml({
            status: 'available',
            is_top: true,
            top_until: past,
            views_count: 5
        });
        expect(expiredTop).toBe('');

        // Bargain overrides normal price in feed card
        mockSession.setItem('accepted_bargain_i-9', JSON.stringify({ originalPrice: 2000, acceptedPrice: 1500 }));
        const bargainHtml = catalogMod.buildCardPriceHtml({ id: 'i-9', price: 2000, is_sale: true, old_price: 2500 });
        expect(bargainHtml).toContain('2000 грн');
        expect(bargainHtml).toContain('1500 грн');
        expect(bargainHtml).toContain('var(--accent-yellow');

        // Comparator puts active TOP items strictly above non-TOP even if cheaper/newer
        const topItem = { id: '1', is_top: true, top_until: future, price: 5000, created_at: '2025-01-01T00:00:00Z' };
        const regItem = { id: '2', is_top: false, price: 300, created_at: '2026-11-01T00:00:00Z' };
        const cmp = catalogMod.getCatalogItemComparator();
        expect(cmp(topItem, regItem)).toBeLessThan(0);

        // buildCardDOM escapes XSS in name/brand/size/condition and marks idx < 4 fetchpriority="high"
        const xssCard = catalogMod.buildCardDOM({
            id: 'x-1',
            name: '<img src=x onerror=alert(1)>',
            brand: 'Nike',
            size: 'M',
            condition: '9/10',
            price: 900,
            status: 'available',
            thumbnails: ['https://cdn.nisha-store.shop/1.webp'],
            images: ['https://cdn.nisha-store.shop/1.webp']
        }, 0);
        expect(xssCard.innerHTML).not.toContain('<img src=x onerror=alert(1)>');
        expect(xssCard.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(xssCard.innerHTML).toContain('fetchpriority="high"');
        expect(xssCard.style['view-transition-name']).toBe('item-x-1');

        const lazyCard = catalogMod.buildCardDOM({
            id: 'x-5',
            name: 'Hoodie',
            price: 900,
            status: 'available',
            images: ['https://cdn.nisha-store.shop/5.webp']
        }, 5);
        expect(lazyCard.innerHTML).toContain('loading="lazy"');
    });

    it('8. catalog-filters.js applyFilters filters by category, price, sale, favorites fallback, and updates grid & URL', async () => {
        const grid = createFakeEl('div');
        grid.id = 'itemsGrid';
        elementsById.set('itemsGrid', grid);
        const countEl = createFakeEl('span');
        elementsById.set('itemCount', countEl);
        const minEl = createFakeEl('input');
        minEl.value = '500';
        const maxEl = createFakeEl('input');
        maxEl.value = '1500';
        elementsById.set('priceMin', minEl);
        elementsById.set('priceMax', maxEl);

        const future = new Date(Date.now() + 100_000).toISOString();
        window.allItems = [
            { id: 'a1', name: 'Jacket', category: 'Верхняя одежда', price: 1000, status: 'available', created_at: '2026-11-10T10:00:00Z', images: ['https://cdn.nisha-store.shop/a1.jpg'] },
            { id: 'a2', name: 'Expensive Coat', category: 'Верхняя одежда', price: 3000, status: 'available', created_at: '2026-11-11T10:00:00Z', images: ['https://cdn.nisha-store.shop/a2.jpg'] },
            { id: 'a3', name: 'Sneakers', category: 'Обувь', price: 900, status: 'available', is_top: true, top_until: future, created_at: '2026-11-01T10:00:00Z', images: ['https://cdn.nisha-store.shop/a3.jpg'] },
            { id: 'a4', name: 'Sold Tee', category: 'Кофты и Свитера', price: 600, status: 'sold', created_at: '2026-11-12T10:00:00Z', images: ['https://cdn.nisha-store.shop/a4.jpg'] }
        ];
        window.currentCategory = 'Верхняя одежда';

        await catalogMod.applyFilters(true, false);
        expect(window.filteredItems.map(i => i.id)).toEqual(['a1']);
        expect(countEl.innerText).toBe(1);
        expect(grid.children.some(c => c.getAttribute('data-id') === 'a1')).toBe(true);
        expect(history.replaceState).toHaveBeenCalled();

        // Favorites mode falls back to cached nisha_cached_favorites when window.favorites is empty
        window.currentCategory = '';
        window.showingOnlyFavs = true;
        window.favorites = [];
        mockLocal.setItem('nisha_cached_favorites', JSON.stringify(['a3', 'a1']));
        await catalogMod.applyFilters(true, false);
        expect(window.filteredItems.map(i => i.id)).toEqual(['a3', 'a1']); // a3 first due to active TOP
    });

    it('9. catalog-sync.js handles Realtime INSERT, slim UPDATE preserving images, and DELETE removing from cart', () => {
        const grid = createFakeEl('div');
        elementsById.set('itemsGrid', grid);
        const countEl = createFakeEl('span');
        elementsById.set('itemCount', countEl);

        const existingCard = createFakeEl('div');
        existingCard.setAttribute('data-id', 'item-1');
        existingCard.querySelector = vi.fn((sel) => {
            if (sel === '.item-price') return createFakeEl('div');
            if (sel === '.item-title') return createFakeEl('h3');
            return null;
        });
        existingCard.querySelectorAll = vi.fn(() => []);
        allQuerySelectors.set('.item-card[data-id="item-1"]', [existingCard]);

        window.allItems = [
            {
                id: 'item-1',
                name: 'Vintage Hoodie',
                category: 'Кофты и Свитера',
                price: 1200,
                status: 'available',
                is_sale: false,
                images: ['https://cdn.nisha-store.shop/orig.jpg'],
                thumbnails: ['https://cdn.nisha-store.shop/thumb.jpg'],
                description: 'Full original description',
                created_at: '2026-11-05T10:00:00Z'
            }
        ];
        window.filteredItems = [...window.allItems];
        window.cart = [{ id: 'item-1', name: 'Vintage Hoodie', price: 1200 }];

        // 1. Slim UPDATE keeps existing images & description while marking SOLD and removing from cart
        catalogMod.handleRealtimeCatalogEvent({
            eventType: 'UPDATE',
            new: {
                id: 'item-1',
                status: 'sold',
                price: 1200
            }
        }, false);

        expect(window.allItems[0].images).toEqual(['https://cdn.nisha-store.shop/orig.jpg']);
        expect(window.allItems[0].description).toBe('Full original description');
        expect(window.cart).toEqual([]);
        expect(showToast).toHaveBeenCalled();

        // 2. INSERT new unseen item triggers notification & inserts into allItems
        catalogMod.handleRealtimeCatalogEvent({
            eventType: 'INSERT',
            new: {
                id: 'item-2',
                name: 'Archive Cap',
                category: 'Аксессуары',
                price: 550,
                status: 'available',
                created_at: '2026-11-14T10:00:00Z',
                images: ['https://cdn.nisha-store.shop/cap.jpg']
            }
        }, false);

        expect(window.allItems.some(i => i.id === 'item-2')).toBe(true);
        expect(enqueueNewItemToast).toHaveBeenCalledTimes(1);

        // 3. DELETE removes item and closes active modal if open
        window.currentOpenedItem = { id: 'item-2' };
        catalogMod.handleRealtimeCatalogEvent({
            eventType: 'DELETE',
            old: { id: 'item-2' }
        }, false);
        expect(window.allItems.some(i => i.id === 'item-2')).toBe(false);
        expect(closeModal).toHaveBeenCalledWith('productModal');
    });

    it('10. catalog-ui-info.js showBadgeInfo handles drop, returnable, bargain min-price & flushPendingBroadcast', () => {
        window.currentOpenedItem = {
            id: 'b1',
            is_returnable: true,
            is_drop: false,
            min_bargain_price: 750
        };

        catalogMod.showBadgeInfo('bargain');
        expect(showTerminalModal).toHaveBeenCalledWith(
            'BARGAIN_AVAILABLE.SYS',
            expect.stringContaining('750 грн'),
            '[ ПОНЯТНО ]',
            null
        );

        catalogMod.showBadgeInfo('secure');
        expect(showTerminalModal).toHaveBeenLastCalledWith(
            'SECURE_PAYMENT.EXE',
            expect.stringContaining('14 дней'),
            '[ ПОНЯТНО ]',
            null
        );

        window.currentOpenedItem.is_drop = true;
        catalogMod.showBadgeInfo('drop');
        expect(showTerminalModal).toHaveBeenLastCalledWith(
            'WARNING: DROP_ITEM',
            'badge_info.drop_desc',
            '[ ПОНЯТНО ]',
            null
        );

        // When i18next returns empty for drop_desc/drop_text, falls back to built-in drop warning HTML
        const prevT = globalThis.i18next.t;
        globalThis.i18next.t = (key, opts = {}) => {
            if (key === 'badge_info.drop_desc' || key === 'badge_info.drop_text') return '';
            return opts.defaultValue || key;
        };
        catalogMod.showBadgeInfo('drop');
        expect(showTerminalModal).toHaveBeenLastCalledWith(
            'WARNING: DROP_ITEM',
            expect.stringContaining('стороннего продавца'),
            '[ ПОНЯТНО ]',
            null
        );
        globalThis.i18next.t = prevT;

        vi.useFakeTimers();
        window.pendingBroadcastHtml = '<b>Promo Drop!</b>';
        window.pendingBroadcastId = 'bc-42';
        catalogMod.flushPendingBroadcast();
        expect(window.pendingBroadcastHtml).toBeNull();
        vi.advanceTimersByTime(3000);
        expect(tryShowBroadcast).toHaveBeenCalledWith(
            'SYSTEM_BROADCAST.MSG',
            '<b>Promo Drop!</b>',
            'propose.btn_close',
            expect.any(Function)
        );
    });

    it('11. catalog-filters.js updatePriceUI clamps crossed sliders & toggleMobileSidebar switches drawer/FAB state', () => {
        const minInput = createFakeEl('input');
        minInput.id = 'priceMin';
        minInput.value = '5000';
        const maxInput = createFakeEl('input');
        maxInput.id = 'priceMax';
        maxInput.value = '4800';
        const minLabel = createFakeEl('span');
        const maxLabel = createFakeEl('span');
        const rangeFill = createFakeEl('div');

        elementsById.set('priceMin', minInput);
        elementsById.set('priceMax', maxInput);
        elementsById.set('priceMinVal', minLabel);
        elementsById.set('priceMaxVal', maxLabel);
        elementsById.set('rangeFill', rangeFill);

        // Moving priceMin past priceMax clamps minInput to maxVal - 100 (4700)
        catalogMod.updatePriceUI({ target: { id: 'priceMin' } });
        expect(Number(minInput.value)).toBe(4700);
        expect(minLabel.innerText).toBe(4700);
        expect(maxLabel.innerText).toBe(4800);
        expect(rangeFill.style.left).toBe(`${(4700 / 15000) * 100}%`);

        // Toggle mobile sidebar open -> hides FAB and sets active-mobile class
        const sidebar = createFakeEl('aside');
        const btn = createFakeEl('button');
        btn.id = 'mobileFilterBtn';
        const fab = createFakeEl('button');
        fab.style.display = 'flex';
        allQuerySelectors.set('.sidebar', [sidebar]);
        elementsById.set('mobileFilterBtn', btn);
        allQuerySelectors.set('.fab-propose', [fab]);

        catalogMod.toggleMobileSidebar();
        expect(sidebar.classList.contains('active-mobile')).toBe(true);
        expect(btn.innerText).toBe('[-] СКРЫТЬ ФИЛЬТРЫ');
        expect(fab.style.display).toBe('none');

        // Toggle closed -> restores FAB and button label
        catalogMod.toggleMobileSidebar();
        expect(sidebar.classList.contains('active-mobile')).toBe(false);
        expect(btn.innerText).toBe('[+] ПОКАЗАТЬ ФИЛЬТРЫ');
        expect(fab.style.display).toBe('flex');
    });

    it('12. catalog-sync.js syncCriticalStatuses & updateCardDOM reconcile deletions, new arrivals & active modal', async () => {
        const grid = createFakeEl('div');
        grid.id = 'itemsGrid';
        elementsById.set('itemsGrid', grid);

        const deletedCard = createFakeEl('div');
        deletedCard.setAttribute('data-id', 'gone-1');
        vi.spyOn(deletedCard, 'remove');
        allQuerySelectors.set('.item-card[data-id="gone-1"]', [deletedCard]);

        const priceDiv = createFakeEl('div');
        const keptCard = createFakeEl('div');
        keptCard.querySelector = (sel) => (sel === '.item-price' ? priceDiv : null);
        allQuerySelectors.set('.item-card[data-id="keep-1"]', [keptCard]);

        const modalCartBtn = createFakeEl('button');
        const modalPriceEl = createFakeEl('div');
        const modalTitleEl = createFakeEl('h2');
        elementsById.set('modalCartBtn', modalCartBtn);
        elementsById.set('modalItemPrice', modalPriceEl);
        elementsById.set('modalItemTitle', modalTitleEl);

        window.allItems = [
            { id: 'gone-1', name: 'Old Tee', price: 400, status: 'available', created_at: '2026-11-01T10:00:00Z' },
            { id: 'keep-1', name: 'Archive Hoodie', price: 1500, status: 'available', created_at: '2026-11-02T10:00:00Z' }
        ];
        window.filteredItems = [...window.allItems];
        window.cart = [{ id: 'gone-1', name: 'Old Tee', price: 400 }];
        window.currentOpenedItem = { ...window.allItems[1] };

        const dbSummary = [
            { id: 'keep-1', name: 'Archive Hoodie v2', brand: 'CP', price: 1300, old_price: 1500, is_sale: true, is_top: true, status: 'sold', views_count: 15, created_at: '2026-11-02T10:00:00Z' },
            { id: 'new-1', name: 'Fresh Cargo', brand: 'Stone', price: 2200, is_top: false, status: 'available', created_at: '2026-11-14T12:00:00Z' }
        ];
        const fullNewRow = [{
            ...dbSummary[1],
            images: ['https://cdn.nisha-store.shop/cargo.jpg'],
            thumbnails: ['https://cdn.nisha-store.shop/cargo-t.jpg']
        }];

        window._supabase = {
            channel: () => ({
                on() { return this; },
                subscribe: vi.fn()
            }),
            from: () => ({
                select: () => ({
                    order: () => ({
                        limit: async () => ({ data: dbSummary, error: null })
                    }),
                    in: async () => ({ data: fullNewRow, error: null })
                })
            })
        };

        await catalogMod.syncCriticalStatuses();
        delete window._supabase;

        expect(deletedCard.remove).toHaveBeenCalled();
        expect(window.cart).toEqual([]);
        expect(window.allItems.some(i => i.id === 'gone-1')).toBe(false);
        expect(window.allItems.some(i => i.id === 'new-1')).toBe(true);
        expect(modalTitleEl.textContent).toBe('Archive Hoodie v2');
        expect(modalCartBtn.style.display).toBe('none');
    });
});
