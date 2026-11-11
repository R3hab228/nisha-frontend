import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as helpers from '../src/modules/helpers.js';
import * as cart from '../src/modules/cart.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Modern Standards Upgrade (Intl, ES2023 Arrays, Object.hasOwn, Web Locks)', () => {
    describe('1. Cached Intl.NumberFormat in formatPrice', () => {
        it('formats prices cleanly using cached Intl.NumberFormat', () => {
            const formatted = helpers.formatPrice(1850, 'грн');
            expect(formatted).toContain('1');
            expect(formatted).toContain('850');
            expect(formatted).toContain('грн');
        });

        it('js/core/helpers.js defines cachedPriceNumberFormatter singleton', () => {
            const code = fs.readFileSync(path.resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            expect(code).toContain('cachedPriceNumberFormatter');
            expect(code).toContain("new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })");
        });
    });

    describe('2. ES2023 Non-mutating Array Methods (toSorted, toReversed, at)', () => {
        it('toSorted returns new sorted array without mutating original', () => {
            const original = [30, 10, 50, 20];
            const sorted = helpers.toSorted(original, (a, b) => a - b);

            expect(sorted).toEqual([10, 20, 30, 50]);
            expect(original).toEqual([30, 10, 50, 20]); // Not mutated
        });

        it('toReversed returns reversed array without mutating original', () => {
            const original = ['alpha', 'beta', 'gamma'];
            const reversed = helpers.toReversed(original);

            expect(reversed).toEqual(['gamma', 'beta', 'alpha']);
            expect(original).toEqual(['alpha', 'beta', 'gamma']); // Not mutated
        });

        it('at accesses positive and negative indices correctly', () => {
            const items = ['first', 'second', 'penultimate', 'last'];
            expect(helpers.at(items, 0)).toBe('first');
            expect(helpers.at(items, 1)).toBe('second');
            expect(helpers.at(items, -1)).toBe('last');
            expect(helpers.at(items, -2)).toBe('penultimate');
            expect(helpers.at(items, 99)).toBeUndefined();
        });

        it('orders.js uses toReversed and rum.js uses at(-1)', () => {
            const ordersCode = fs.readFileSync(path.resolve(__dirname, '../js/orders/orders.js'), 'utf8');
            expect(ordersCode).toContain('toReversed');

            const rumCode = fs.readFileSync(path.resolve(__dirname, '../js/core/rum.js'), 'utf8');
            expect(rumCode).toContain('at(-1)');
        });
    });

    describe('3. Object.hasOwn (ES2022)', () => {
        it('correctly determines own properties and ignores prototype chain', () => {
            const proto = { inheritedProp: 'yes' };
            const obj = Object.create(proto);
            obj.ownProp = 'value';

            expect(helpers.hasOwn(obj, 'ownProp')).toBe(true);
            expect(helpers.hasOwn(obj, 'inheritedProp')).toBe(false);
            expect(helpers.hasOwn(obj, 'nonExistent')).toBe(false);
            expect(helpers.hasOwn(null, 'any')).toBe(false);
            expect(helpers.hasOwn(undefined, 'any')).toBe(false);
        });

        it('works safely on Object.create(null) dictionary objects', () => {
            const dict = Object.create(null);
            dict.key = 42;
            expect(helpers.hasOwn(dict, 'key')).toBe(true);
            expect(helpers.hasOwn(dict, 'missing')).toBe(false);
        });

        it('expandSearchQuery in helpers.js and search.worker.js uses Object.hasOwn / hasOwn to prevent prototype chain crashes', () => {
            const helpersCode = fs.readFileSync(path.resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            const workerCode = fs.readFileSync(path.resolve(__dirname, '../src/workers/search.worker.js'), 'utf8');
            expect(helpersCode).toContain('hasOwn(SEARCH_SYNONYMS, clean)');
            expect(helpersCode).toContain('hasOwn(SEARCH_SYNONYMS, w)');
            expect(workerCode).toContain('Object.hasOwn(SEARCH_SYNONYMS, clean)');
            expect(workerCode).toContain('Object.hasOwn(SEARCH_SYNONYMS, w)');
        });
    });

    describe('4. Web Locks API (navigator.locks) for PWA / Multi-tab Synchronization', () => {
        it('withWebLock executes callback and returns result when navigator.locks is present', async () => {
            const mockRequest = vi.fn().mockImplementation(async (name, cb) => cb());
            const origLocks = navigator.locks;
            try {
                Object.defineProperty(navigator, 'locks', {
                    value: { request: mockRequest },
                    configurable: true
                });

                const res = await helpers.withWebLock('test_lock', async () => 'locked_result');
                expect(res).toBe('locked_result');
                expect(mockRequest).toHaveBeenCalledWith('test_lock', expect.any(Function));
            } finally {
                Object.defineProperty(navigator, 'locks', {
                    value: origLocks,
                    configurable: true
                });
            }
        });

        it('withWebLock safely falls back to executing task if navigator.locks throws or rejects', async () => {
            const mockRequest = vi.fn().mockRejectedValue(new Error('Lock request aborted'));
            const origLocks = navigator.locks;
            try {
                Object.defineProperty(navigator, 'locks', {
                    value: { request: mockRequest },
                    configurable: true
                });

                const res = await helpers.withWebLock('fallback_lock', async () => 'fallback_ok');
                expect(res).toBe('fallback_ok');
            } finally {
                Object.defineProperty(navigator, 'locks', {
                    value: origLocks,
                    configurable: true
                });
            }
        });

        it('cart operations are protected with withCartLock and withCheckoutLock', () => {
            const cartCode = fs.readFileSync(path.resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('withCartLock');
            expect(cartCode).toContain('withCheckoutLock');
            expect(cartCode).toContain('nisha_cart_lock');
            expect(cartCode).toContain('nisha_checkout_lock');
        });
    });
});
