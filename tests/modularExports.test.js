import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import defaultModularFacade, {
    store,
    getStore,
    subscribeStore,
    getStoreState,
    setStoreState,
    apiClient,
    getApiClient,
    warmupBackendServer,
    resolveApiUrl,
    escapeHtml,
    escapeAttr,
    escapeJsString,
    sanitizeText,
    toCDN,
    formatPrice,
    getCurrency,
    clamp,
    generateShortId,
    deepClone,
    openModal,
    closeModal,
    executeCloseModal,
    isElementVisible,
    isUserInProductFeed,
    getCurrentSiteLang,
    changeLanguage,
    t,
    captureError,
    reportError,
    isPwaStandalone,
    checkIsPwaInstalled,
    loadAllItems,
    getCatalog,
    applyFilters,
    extractItemMeasurements,
    formatMeasurementItem,
    getActiveCart,
    setActiveCart,
    addToCartById,
    addToCartWithAnimation,
    removeFromCart,
    openCart,
    openCheckoutModal,
    updateCartUI,
    track,
    trackProductView,
    trackAddToCart,
    trackCheckoutStart,
    trackPurchase,
    trackFavorite,
    initAnalytics,
    openProductModal,
    openProductModalById,
    closeProductModal,
    moveSlide,
    setSlide,
    openProductPhotoZoom,
    shareItem,
    toggleFavFromModal,
    addToHistory,
    renderHistory,
    removeHistoryItem,
    submitQuestion,
    loadItemQuestions
} from '../src/modules/index.js';

class MockStorage {
    constructor() {
        this._map = new Map();
    }
    getItem(key) {
        return this._map.has(key) ? this._map.get(key) : null;
    }
    setItem(key, val) {
        this._map.set(key, String(val));
    }
    removeItem(key) {
        this._map.delete(key);
    }
    clear() {
        this._map.clear();
    }
}

beforeAll(async () => {
    globalThis.Storage = MockStorage;
    globalThis.localStorage = new MockStorage();
    globalThis.window = globalThis.window || globalThis;
    if (typeof globalThis.window.addEventListener !== 'function') {
        globalThis.window.addEventListener = vi.fn();
    }

    // Загружаем ядро хранилища и API-клиента
    await import('../js/core/store.js');
    await import('../js/core/apiClient.js');
});

beforeEach(() => {
    vi.restoreAllMocks();
});

describe('Modular ES Architecture Facade (src/modules/index.js)', () => {
    describe('Default Facade Object', () => {
        it('exports bundled domain namespaces', () => {
            expect(defaultModularFacade).toBeDefined();
            expect(defaultModularFacade.store).toBeDefined();
            expect(defaultModularFacade.apiClient).toBeDefined();
            expect(defaultModularFacade.helpers).toBeDefined();
            expect(defaultModularFacade.windows).toBeDefined();
            expect(defaultModularFacade.i18n).toBeDefined();
            expect(defaultModularFacade.telemetry).toBeDefined();
            expect(defaultModularFacade.catalog).toBeDefined();
            expect(defaultModularFacade.cart).toBeDefined();
            expect(defaultModularFacade.product).toBeDefined();
            expect(defaultModularFacade.analytics).toBeDefined();
            expect(defaultModularFacade.reviews).toBeDefined();
            expect(defaultModularFacade.orders).toBeDefined();
            expect(defaultModularFacade.drop).toBeDefined();
            expect(defaultModularFacade.profile).toBeDefined();
        });
    });

    describe('Store Module (src/modules/store.js)', () => {
        it('accesses reactive state via modular proxy and functional helpers', () => {
            expect(getStore()).toBeDefined();
            expect(store).toBeDefined();

            setStoreState('lang', 'uk');
            expect(getStoreState('lang')).toBe('uk');
            expect(store.lang).toBe('uk');

            store.lang = 'ru';
            expect(store.lang).toBe('ru');
        });

        it('supports reactive subscriptions via subscribeStore', () => {
            let capturedLang = null;
            const unsubscribe = subscribeStore('lang', (newVal) => {
                capturedLang = newVal;
            });

            store.lang = 'en';
            expect(capturedLang).toBe('en');

            unsubscribe();
            store.lang = 'ru';
            // После отписки значение не должно обновляться
            expect(capturedLang).toBe('en');
        });
    });

    describe('ApiClient Module (src/modules/apiClient.js)', () => {
        it('forwards method calls to global apiClient instance', () => {
            expect(getApiClient()).toBeDefined();
            expect(apiClient).toBeDefined();

            const key = apiClient.generateIdempotencyKey('modular_test');
            expect(key.startsWith('modular_test_')).toBe(true);
        });

        it('resolves API URLs seamlessly', () => {
            const url = resolveApiUrl('/api/test-route');
            expect(url.endsWith('/api/test-route')).toBe(true);
        });

        it('provides warmupBackendServer export without crashing', async () => {
            const res = await warmupBackendServer(false);
            expect(res !== undefined).toBe(true);
        });
    });

    describe('Helpers Module (src/modules/helpers.js)', () => {
        it('sanitizes and escapes HTML to prevent XSS injection', () => {
            const malicious = '<script>alert("xss")</script>&foo=1';
            const escaped = escapeHtml(malicious);
            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;script&gt;');
            expect(escaped).toContain('&amp;');

            expect(escapeAttr('" onfocus="alert(1)')).toContain('&quot;');
            expect(escapeJsString("hello'; alert(1); '")).toContain("\\'");
            expect(sanitizeText('<b>bold</b>')).toContain('&lt;b&gt;');
        });

        it('rewrites Supabase URLs to CDN URLs', () => {
            const supabaseUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/storage/v1/object/public/items/photo.jpg';
            const cdnUrl = toCDN(supabaseUrl);
            expect(cdnUrl).toBe('https://nisha-cdn.mtyagniryadno.workers.dev/storage/v1/object/public/items/photo.jpg');
        });

        it('formats prices and handles currency symbols', () => {
            expect(getCurrency()).toBe('₴');
            expect(formatPrice(1500, '₴')).toContain('1');
            expect(formatPrice(1500, '₴')).toContain('500');
            expect(formatPrice(1500, '₴')).toContain('₴');
        });

        it('implements pure utilities: clamp, generateShortId, deepClone', () => {
            expect(clamp(15, 0, 10)).toBe(10);
            expect(clamp(-5, 0, 10)).toBe(0);
            expect(clamp(5, 0, 10)).toBe(5);

            const id = generateShortId('prod');
            expect(id.startsWith('prod_')).toBe(true);

            const original = { a: [1, 2, { b: 3 }] };
            const cloned = deepClone(original);
            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned.a).not.toBe(original.a);
        });
    });

    describe('Windows & Modals Module (src/modules/windows.js)', () => {
        it('safely handles modal invocations in headless test environment', () => {
            expect(() => openModal('nonExistentModal')).not.toThrow();
            expect(() => closeModal('nonExistentModal')).not.toThrow();
            expect(() => executeCloseModal('nonExistentModal')).not.toThrow();
            expect(isElementVisible(null)).toBe(false);
            expect(isUserInProductFeed()).toBe(false);
            expect(() => defaultModularFacade.windows.registerModalInitializer('testModal', () => {})).not.toThrow();
        });

        it('manages lazy modal initialization and containment classes', () => {
            const classSet = new Set();
            const mockEl = {
                id: 'customLazyModal',
                style: { display: 'none' },
                classList: {
                    add: vi.fn(cls => classSet.add(cls)),
                    remove: vi.fn(cls => classSet.delete(cls)),
                    contains: vi.fn(cls => classSet.has(cls))
                },
                setAttribute: vi.fn(),
                removeAttribute: vi.fn(),
                querySelector: vi.fn(() => null)
            };

            const prevDoc = globalThis.document;
            globalThis.document = {
                getElementById: vi.fn(id => (id === 'customLazyModal' ? mockEl : null)),
                body: { style: {} }
            };

            try {
                const initSpy = vi.fn();
                defaultModularFacade.windows.registerModalInitializer('customLazyModal', initSpy);

                openModal('customLazyModal');
                expect(initSpy).toHaveBeenCalledTimes(1);
                expect(mockEl.classList.add).toHaveBeenCalledWith('is-open');

                // Second open should not re-trigger one-off initializer
                openModal('customLazyModal');
                expect(initSpy).toHaveBeenCalledTimes(1);

                executeCloseModal('customLazyModal');
                expect(mockEl.classList.remove).toHaveBeenCalledWith('is-open');
            } finally {
                globalThis.document = prevDoc;
            }
        });
    });

    describe('I18n Module (src/modules/i18n.js)', () => {
        it('retrieves site language and provides translation fallback', async () => {
            store.lang = 'ru';
            expect(getCurrentSiteLang()).toBe('ru');

            expect(t('common.buy')).toBe('common.buy');
            await expect(changeLanguage('en')).resolves.not.toThrow();
        });
    });

    describe('Telemetry & PWA Module (src/modules/telemetry.js)', () => {
        it('safely captures errors without unhandled exceptions', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            expect(() => captureError(new Error('Test modular error'), { meta: 123 })).not.toThrow();
            expect(() => reportError('Test report message')).not.toThrow();
            expect(isPwaStandalone()).toBe(false);
            expect(checkIsPwaInstalled()).toBe(false);
            consoleSpy.mockRestore();
        });
    });

    describe('Catalog Module (src/modules/catalog.js)', () => {
        it('provides catalog functions without throwing in test environment', async () => {
            expect(getCatalog()).toEqual([]);
            await expect(loadAllItems(false)).resolves.toEqual([]);
            expect(() => applyFilters()).not.toThrow();

            const item = { size_grid: '{"длина": 70, "ширина": 50}' };
            const measurements = extractItemMeasurements(item);
            expect(typeof measurements).toBe('object');

            const formatted = formatMeasurementItem('длина', 70, 'ru');
            expect(formatted).toContain('70');
        });
    });

    describe('Cart Module (src/modules/cart.js)', () => {
        it('manages cart state and handles actions gracefully', async () => {
            expect(getActiveCart()).toEqual([]);
            setActiveCart([{ id: 'item_1', size: 'M', quantity: 1 }]);
            expect(getActiveCart().length).toBe(1);

            expect(() => removeFromCart('item_1', 'M')).not.toThrow();
            expect(() => openCart()).not.toThrow();
            expect(() => openCheckoutModal()).not.toThrow();
            expect(() => updateCartUI()).not.toThrow();
            await expect(addToCartById('item_1', 'L')).resolves.not.toThrow();
            await expect(addToCartWithAnimation('item_1')).resolves.not.toThrow();
        });
    });

    describe('Analytics Module (src/modules/analytics.js)', () => {
        it('tracks e-commerce funnel events gracefully', () => {
            expect(() => track('Custom Event', { prop: 1 })).not.toThrow();
            expect(() => trackProductView({ id: 'item_1', name: 'Jacket', price: 1000 })).not.toThrow();
            expect(() => trackAddToCart({ id: 'item_1', name: 'Jacket', price: 1000 })).not.toThrow();
            expect(() => trackCheckoutStart([{ id: 'item_1', price: 1000 }])).not.toThrow();
            expect(() => trackPurchase({ orderId: 'ord_1', value: 1000 })).not.toThrow();
            expect(() => trackFavorite('item_1', true)).not.toThrow();
            expect(() => initAnalytics()).not.toThrow();
        });
    });

    describe('Product Module (src/modules/product.js)', () => {
        it('handles product modals, slider controls and history without throwing', async () => {
            expect(() => openProductModal({ id: 'item_1', name: 'Sweater' })).not.toThrow();
            await expect(openProductModalById('item_1')).resolves.not.toThrow();
            expect(() => closeProductModal()).not.toThrow();
            expect(() => moveSlide(1)).not.toThrow();
            expect(() => setSlide(0)).not.toThrow();
            expect(() => openProductPhotoZoom(0)).not.toThrow();
            await expect(shareItem('item_1')).resolves.not.toThrow();
            expect(() => toggleFavFromModal()).not.toThrow();
            expect(() => addToHistory({ id: 'item_1', name: 'Sweater', price: 1200 })).not.toThrow();
            expect(() => renderHistory()).not.toThrow();
            expect(() => removeHistoryItem('item_1')).not.toThrow();
            await expect(submitQuestion('item_1')).resolves.not.toThrow();
            await expect(loadItemQuestions('item_1')).resolves.toEqual([]);
        });
    });

    describe('Reviews Module (src/modules/reviews.js)', () => {
        it('handles reviews interactions without throwing', async () => {
            const reviews = defaultModularFacade.reviews;
            await expect(reviews.openReviewImage('https://cdn.example.com/test.jpg')).resolves.not.toThrow();
            await expect(reviews.openReviewsModal()).resolves.not.toThrow();
            expect(() => reviews.scrollReviews(1)).not.toThrow();
            expect(() => reviews.equalizeReviewCardHeights()).not.toThrow();
            expect(() => reviews.promptOrderReview('ord_1', 'Item', '', 1)).not.toThrow();
            await expect(reviews.sendReviewPayload({ text: 'Good' })).resolves.toBeDefined();
            await expect(reviews.submitAutoReview()).resolves.not.toThrow();
            expect(() => reviews.skipAutoReview()).not.toThrow();
            expect(() => reviews.writeReviewOnSite()).not.toThrow();
            await expect(reviews.submitManualReview()).resolves.not.toThrow();
            expect(() => reviews.initReviewsRealtime(null)).not.toThrow();
        });
    });

    describe('Orders Module (src/modules/orders.js)', () => {
        it('categorizes and manages order tabs safely', async () => {
            const orders = defaultModularFacade.orders;
            expect(orders.getOrderTabBucket({ status: 'Принят в обработку' })).toBe('accepted');
            expect(orders.getOrderTabBucket({ status: 'Отправлен' })).toBe('shipped');
            expect(orders.getOrderTabBucket({ status: 'Отменен покупателем' })).toBe('cancelled');
            expect(orders.getOrderTabBucket({ status: 'Неизвестный' })).toBe('other');

            expect(() => orders.openOrdersModal()).not.toThrow();
            expect(() => orders.updateOrderTabCounters()).not.toThrow();
            await expect(orders.fetchMyOrders()).resolves.toEqual([]);
            expect(orders.getOrderItemImage({})).toBe('');
            await expect(orders.ensureOrderImagesLoaded([])).resolves.not.toThrow();
            expect(() => orders.switchOrderTab('accepted')).not.toThrow();
            await expect(orders.copyTTN('20400000000000')).resolves.toBe(false);
            expect(() => orders.renderFilteredOrders()).not.toThrow();
        });
    });

    describe('Drop Module (src/modules/drop.js)', () => {
        it('handles proposal submissions and uploads gracefully', async () => {
            const drop = defaultModularFacade.drop;
            expect(drop.getCurrentProposalFiles()).toEqual([]);
            expect(() => drop.openProposeModal()).not.toThrow();
            expect(() => drop.resetProposalForm()).not.toThrow();
            await expect(drop.handleNewProposalFiles([])).resolves.not.toThrow();
            expect(() => drop.openProposalPhotoByIndex(0)).not.toThrow();
            expect(() => drop.removeProposalFile(0)).not.toThrow();
            expect(() => drop.renderProposalPreviews()).not.toThrow();
            await expect(drop.submitProposal()).resolves.not.toThrow();
        });
    });

    describe('Profile Module (src/modules/profile.js)', () => {
        it('manages profile actions and auth callbacks safely', async () => {
            const profile = defaultModularFacade.profile;
            expect(() => profile.openProfileModal()).not.toThrow();
            await expect(profile.checkSession()).resolves.toBeNull();
            expect(() => profile.toggleRegMode()).not.toThrow();
            await expect(profile.handleAuth()).resolves.not.toThrow();
            await expect(profile.handleForgotPassword()).resolves.not.toThrow();
            await expect(profile.logout()).resolves.not.toThrow();
            await expect(profile.loginWithGoogle()).resolves.not.toThrow();
            expect(() => profile.togglePasswordVisibility('testInput')).not.toThrow();
            await expect(profile.toggleFav('item_1', true)).resolves.toBe(false);
            await expect(profile.loadFavorites()).resolves.toEqual([]);
            expect(() => profile.updateFavBadge()).not.toThrow();
            expect(() => defaultModularFacade.catalog.filterFavorites()).not.toThrow();
            expect(() => profile.initAuthListener()).not.toThrow();
        });
    });
});
