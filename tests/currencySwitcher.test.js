// @ts-check
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    CURRENCY_STORAGE_KEY,
    CURRENCY_UPDATED_AT_KEY,
    normalizeCurrencyCode,
    validateFxRatesPair,
    getActiveCurrencyCode,
    getCurrencySymbol,
    convertFromUah,
    convertToUah,
    applyExchangeRates,
    setCurrencyCode,
    cycleCurrency,
    syncCurrencyToggleUI,
    syncCurrencyFromUser,
    fetchLiveExchangeRates,
    _resetCurrencyTestState
} from '../js/core/currency.js';
import { formatPrice, getCurrency } from '../js/core/helpers-core-utils.js';
import { showCurrencyToast } from '../js/core/helpers-toasts-modals.js';
import { validateBargainSubmission } from '../js/product/product-bargain-logic.js';
import { syncBargainInputsCurrency } from '../js/product/product-bargain.js';

describe('Currency Switcher & Live FX Conversion (js/core/currency.js)', () => {
    /** @type {Map<string, string>} */
    let storageMap;
    /** @type {Map<string, any>} */
    let domById;

    /** @param {string} id */
    const makeBtn = (id) => {
        const classes = new Set();
        const attrs = new Map();
        const glyph = { textContent: '₴' };
        return {
            id,
            offsetWidth: 86,
            glyph,
            attrs,
            classList: {
                add: (/** @type {string[]} */ ...t) => t.forEach((x) => classes.add(x)),
                remove: (/** @type {string[]} */ ...t) => t.forEach((x) => classes.delete(x)),
                contains: (/** @type {string} */ t) => classes.has(t),
                toggle: (/** @type {string} */ t, /** @type {boolean} */ force) => {
                    const on = typeof force === 'boolean' ? force : !classes.has(t);
                    if (on) classes.add(t); else classes.delete(t);
                    return on;
                }
            },
            setAttribute: (/** @type {string} */ k, /** @type {string} */ v) => attrs.set(k, String(v)),
            getAttribute: (/** @type {string} */ k) => attrs.get(k) ?? null,
            querySelector: (/** @type {string} */ sel) => (sel === '.currency-glyph' ? glyph : null)
        };
    };

    beforeEach(() => {
        _resetCurrencyTestState();
        storageMap = new Map();
        domById = new Map();

        const storageFacade = {
            get: (/** @type {string} */ k, /** @type {any} */ fb = null) => (storageMap.has(k) ? storageMap.get(k) : fb),
            set: (/** @type {string} */ k, /** @type {any} */ v) => storageMap.set(k, String(v)),
            remove: (/** @type {string} */ k) => storageMap.delete(k)
        };

        const sidebarBtn = makeBtn('profileCurrencyToggleBtn');
        const modalBtn = makeBtn('modalProfileCurrencyToggleBtn');
        domById.set('profileCurrencyToggleBtn', sidebarBtn);
        domById.set('modalProfileCurrencyToggleBtn', modalBtn);

        /** @type {any} */ (globalThis).localStorage = {
            getItem: (/** @type {string} */ k) => (storageMap.has(k) ? storageMap.get(k) : null),
            setItem: (/** @type {string} */ k, /** @type {any} */ v) => storageMap.set(k, String(v)),
            removeItem: (/** @type {string} */ k) => storageMap.delete(k)
        };
        /** @type {any} */ (globalThis).storage = storageFacade;
        /** @type {any} */ (globalThis).document = {
            getElementById: (/** @type {string} */ id) => domById.get(id) || null,
            querySelector: () => null,
            querySelectorAll: () => []
        };
        /** @type {any} */ (globalThis).requestAnimationFrame = (/** @type {Function} */ cb) => {
            cb();
            return 1;
        };
        /** @type {any} */ (globalThis).window = {
            storage: storageFacade,
            apiClient: {
                get: vi.fn(async () => ({
                    success: true,
                    base: 'UAH',
                    rates: { UAH: 1, USD: 40, EUR: 44 },
                    source: 'nbu'
                }))
            }
        };
    });

    it('normalizes currency codes and validates safe FX bounds', () => {
        expect(normalizeCurrencyCode('usd')).toBe('USD');
        expect(normalizeCurrencyCode('$')).toBe('USD');
        expect(normalizeCurrencyCode('€')).toBe('EUR');
        expect(normalizeCurrencyCode('junk')).toBe('UAH');

        expect(validateFxRatesPair(41.25, 44.8)).toEqual({ UAH: 1, USD: 41.25, EUR: 44.8 });
        expect(validateFxRatesPair(0, 44)).toBeNull();
        expect(validateFxRatesPair(41, 999)).toBeNull();
    });

    it('cycles UAH -> USD -> EUR -> UAH and keeps sidebar & modal buttons in sync', () => {
        expect(getActiveCurrencyCode()).toBe('UAH');
        expect(getCurrencySymbol()).toBe('₴');

        expect(cycleCurrency()).toBe('USD');
        expect(storageMap.get(CURRENCY_STORAGE_KEY)).toBe('USD');
        expect(domById.get('profileCurrencyToggleBtn').glyph.textContent).toBe('$');
        expect(domById.get('modalProfileCurrencyToggleBtn').glyph.textContent).toBe('$');
        expect(domById.get('profileCurrencyToggleBtn').classList.contains('is-usd')).toBe(true);

        expect(cycleCurrency()).toBe('EUR');
        expect(domById.get('profileCurrencyToggleBtn').glyph.textContent).toBe('€');
        expect(domById.get('modalProfileCurrencyToggleBtn').glyph.textContent).toBe('€');

        expect(cycleCurrency()).toBe('UAH');
        expect(domById.get('profileCurrencyToggleBtn').glyph.textContent).toBe('₴');
        syncCurrencyToggleUI(false);
        expect(domById.get('modalProfileCurrencyToggleBtn').classList.contains('is-uah')).toBe(true);
    });

    it('converts prices accurately via live backend rates and preserves UAH defaults', async () => {
        storageMap.set('nisha_lang', 'ua');
        expect(getCurrency()).toBe('грн');
        expect(formatPrice(2000)).toBe('2,000\u00A0грн');

        await fetchLiveExchangeRates({ force: true });
        expect(window.apiClient.get).toHaveBeenCalledWith('/api/exchange-rates', expect.any(Object));

        setCurrencyCode('USD', { silent: true });
        expect(getCurrency()).toBe('$');
        expect(convertFromUah(2000, 'USD')).toBe(50);
        expect(formatPrice(2000)).toBe('50\u00A0$');
        expect(formatPrice(2000, { forceUah: true })).toBe('2,000\u00A0грн');

        setCurrencyCode('EUR', { silent: true });
        expect(getCurrency()).toBe('€');
        expect(convertFromUah(2200, 'EUR')).toBe(50);
        expect(formatPrice(2200)).toBe('50\u00A0€');

        // Rejects corrupt rates without breaking active conversion
        expect(applyExchangeRates({ USD: 0, EUR: -5 })).toBe(false);
        expect(convertFromUah(2200, 'EUR')).toBe(50);
    });

    it('renders localized currency toast across UA, RU, and EN for all currencies', () => {
        /** @type {any[]} */
        const appendedToasts = [];
        const container = {
            querySelector: () => null,
            appendChild: (/** @type {any} */ node) => { appendedToasts.push(node); return node; }
        };
        domById.set('toastContainer', container);
        /** @type {any} */ (globalThis).document.createElement = () => {
            const cls = new Set();
            return {
                className: '',
                innerHTML: '',
                dataset: {},
                classList: { add: (/** @type {string} */ c) => cls.add(c), remove: (/** @type {string} */ c) => cls.delete(c) },
                addEventListener: vi.fn(),
                remove: vi.fn()
            };
        };

        delete /** @type {any} */ (globalThis).i18next;

        storageMap.set('nisha_lang', 'ua');
        showCurrencyToast('USD', '$', 41.5);
        expect(appendedToasts.at(-1).innerHTML).toContain('Валюту змінено');
        expect(appendedToasts.at(-1).innerHTML).toContain('Долар США');
        expect(appendedToasts.at(-1).innerHTML).toContain('41.50');

        storageMap.set('nisha_lang', 'ru');
        showCurrencyToast('EUR', '€', 45);
        expect(appendedToasts.at(-1).innerHTML).toContain('Валюта изменена');
        expect(appendedToasts.at(-1).innerHTML).toContain('Евро');

        storageMap.set('nisha_lang', 'en');
        showCurrencyToast('UAH', '₴', 1);
        expect(appendedToasts.at(-1).innerHTML).toContain('Currency changed');
        expect(appendedToasts.at(-1).innerHTML).toContain('Hryvnia');
    });

    it('adapts bargain min-bid placeholder, label, validation, and UAH conversion to active currency', () => {
        applyExchangeRates({ USD: 40, EUR: 44 }, 'nbu');
        storageMap.set('nisha_lang', 'ua');
        setCurrencyCode('USD', { silent: true });

        const inlineInp = { id: 'inlineBargainPriceInput', min: '', step: '', placeholder: '', value: '' };
        const modalInp = { id: 'bargainPriceInput', min: '', step: '', placeholder: '', value: '' };
        const priceLabel = { id: 'bargainPriceLabel', textContent: '' };
        const itemPriceEl = { id: 'bargainItemPrice', textContent: '' };
        domById.set('inlineBargainPriceInput', inlineInp);
        domById.set('bargainPriceInput', modalInp);
        domById.set('bargainPriceLabel', priceLabel);
        domById.set('bargainItemPrice', itemPriceEl);

        const item = { id: 'item-1', price: 2000, is_bargain: true, min_bargain_price: 1600 };
        syncBargainInputsCurrency(item);

        // 1600 UAH / 40 = 40 $, 2000 UAH / 40 = 50 $
        expect(inlineInp.min).toBe('40');
        expect(inlineInp.step).toBe('1');
        expect(inlineInp.placeholder).toContain('40\u00A0$');
        expect(modalInp.placeholder).toContain('40\u00A0$');
        expect(priceLabel.textContent).toContain('($)');
        expect(itemPriceEl.textContent).toBe('50\u00A0$');

        // Below minimum in USD (35 < 40) -> localized error in USD
        const tooLow = validateBargainSubmission(item, 35);
        expect(tooLow.ok).toBe(false);
        expect(tooLow.message).toContain('40\u00A0$');

        // Valid bid in USD (45 $) -> converts back cleanly to UAH (1800) for backend
        expect(convertToUah(45, 'USD')).toBe(1800);
        const okBid = validateBargainSubmission(item, 45);
        expect(okBid.ok).toBe(true);
        expect(okBid.offeredPriceUah).toBe(1800);
    });

    it('remembers currency via cookie self-healing and syncs across devices via Supabase user_metadata', async () => {
        vi.useFakeTimers();
        try {
            /** @type {string} */
            let cookieJar = '';
            Object.defineProperty(/** @type {any} */ (globalThis).document, 'cookie', {
                configurable: true,
                get: () => cookieJar,
                set: (v) => { cookieJar = String(v).split(';')[0]; }
            });

            const updateUserMock = vi.fn(async () => ({ data: {}, error: null }));
            const mockUser = { id: 'user-1', user_metadata: /** @type {Record<string, any>} */ ({}) };
            /** @type {any} */ (globalThis).window.currentUser = mockUser;
            /** @type {any} */ (globalThis).window._supabase = { auth: { updateUser: updateUserMock } };

            // 1. Switching currency saves to localStorage, cookie, timestamp, and debounces Supabase updateUser
            setCurrencyCode('EUR', { silent: true, updatedAt: 1000 });
            expect(storageMap.get(CURRENCY_STORAGE_KEY)).toBe('EUR');
            expect(storageMap.get(CURRENCY_UPDATED_AT_KEY)).toBe('1000');
            expect(cookieJar).toBe('nisha_currency=EUR');
            expect(mockUser.user_metadata.preferred_currency).toBe('EUR');

            vi.advanceTimersByTime(450);
            expect(updateUserMock).toHaveBeenCalledTimes(1);
            expect(updateUserMock).toHaveBeenCalledWith({
                data: {
                    preferred_currency: 'EUR',
                    preferred_currency_updated_at: 1000
                }
            });

            // 2. If localStorage is cleared (e.g. Safari ITP), cookie restores currency and self-heals localStorage
            storageMap.delete(CURRENCY_STORAGE_KEY);
            expect(getActiveCurrencyCode()).toBe('EUR');
            expect(storageMap.get(CURRENCY_STORAGE_KEY)).toBe('EUR');

            // 3. Fresh device login restores currency from account user_metadata silently
            storageMap.clear();
            cookieJar = '';
            const restored = syncCurrencyFromUser({
                id: 'user-1',
                user_metadata: { preferred_currency: 'USD', preferred_currency_updated_at: 2000 }
            });
            expect(restored).toBe('USD');
            expect(storageMap.get(CURRENCY_STORAGE_KEY)).toBe('USD');
            expect(cookieJar).toBe('nisha_currency=USD');
            expect(domById.get('profileCurrencyToggleBtn').glyph.textContent).toBe('$');

            // 4. Newer local choice wins over older account metadata and pushes update to Supabase
            updateUserMock.mockClear();
            setCurrencyCode('EUR', { silent: true, syncRemote: false, updatedAt: 5000 });
            const keptLocal = syncCurrencyFromUser({
                id: 'user-1',
                user_metadata: { preferred_currency: 'USD', preferred_currency_updated_at: 2000 }
            });
            expect(keptLocal).toBe('EUR');
            vi.advanceTimersByTime(450);
            expect(updateUserMock).toHaveBeenCalledWith({
                data: {
                    preferred_currency: 'EUR',
                    preferred_currency_updated_at: 5000
                }
            });
        } finally {
            vi.useRealTimers();
        }
    });
});
