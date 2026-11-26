// @ts-check
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    CURRENCY_STORAGE_KEY,
    normalizeCurrencyCode,
    validateFxRatesPair,
    getActiveCurrencyCode,
    getCurrencySymbol,
    convertFromUah,
    applyExchangeRates,
    setCurrencyCode,
    cycleCurrency,
    syncCurrencyToggleUI,
    fetchLiveExchangeRates,
    _resetCurrencyTestState
} from '../js/core/currency.js';
import { formatPrice, getCurrency } from '../js/core/helpers-core-utils.js';

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
});
