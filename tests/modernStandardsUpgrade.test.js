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

    describe('5. User Display Name & Profile Nickname Resolution (getUserDisplayName)', () => {
        it('prioritizes profile.username if present and not User', () => {
            const user = { email: 'test@example.com', user_metadata: { display_name: 'MetaNick' } };
            const profile = { username: 'ProfileNick' };
            expect(helpers.getUserDisplayName(user, profile)).toBe('ProfileNick');
        });

        it('prioritizes user_metadata.display_name when profile username is empty', () => {
            const user = { email: 'alex@example.com', user_metadata: { display_name: 'AlexVibe', full_name: 'Alex Full' } };
            const profile = { username: '' };
            expect(helpers.getUserDisplayName(user, profile)).toBe('AlexVibe');
        });

        it('supports username, full_name, or name in user_metadata', () => {
            const userWithUsername = { email: 'u@test.com', user_metadata: { username: 'CoolCat' } };
            expect(helpers.getUserDisplayName(userWithUsername, null)).toBe('CoolCat');

            const userWithFullName = { email: 'u@test.com', user_metadata: { full_name: 'John Doe' } };
            expect(helpers.getUserDisplayName(userWithFullName, null)).toBe('John Doe');
        });

        it('falls back to email prefix when metadata and profile are empty', () => {
            const user = { email: 'streetwear_fan@gmail.com', user_metadata: {} };
            expect(helpers.getUserDisplayName(user, null)).toBe('streetwear_fan');
        });

        it('returns User when user is null or undefined', () => {
            expect(helpers.getUserDisplayName(null, null)).toBe('User');
        });
    });

    describe('6. URL.canParse (ES2024 URL validation & safe parsing)', () => {
        it('validates absolute URLs correctly with canParseURL', () => {
            expect(helpers.canParseURL('https://www.nisha-store.shop/catalog')).toBe(true);
            expect(helpers.canParseURL('http://localhost:3000')).toBe(true);
            expect(helpers.canParseURL('invalid://domain')).toBe(true);
            expect(helpers.canParseURL('not a url at all')).toBe(false);
            expect(helpers.canParseURL('')).toBe(false);
            expect(helpers.canParseURL(null)).toBe(false);
            expect(helpers.canParseURL(undefined)).toBe(false);
        });

        it('validates relative URLs when a base URL is provided', () => {
            expect(helpers.canParseURL('/items/image.webp', 'https://www.nisha-store.shop')).toBe(true);
            expect(helpers.canParseURL('catalog?brand=stussy', 'https://www.nisha-store.shop')).toBe(true);
            expect(helpers.canParseURL('/path', 'not-a-valid-base')).toBe(false);
        });

        it('window.canParseURL and globalThis.canParseURL are exposed', () => {
            expect(typeof globalThis.canParseURL).toBe('function');
            expect(globalThis.canParseURL('https://www.nisha-store.shop')).toBe(true);
        });

        it('sw.js and catalog.js utilize URL.canParse safely', () => {
            const swCode = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8');
            expect(swCode).toContain('URL.canParse');

            const publicSwCode = fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf8');
            expect(publicSwCode).toContain('URL.canParse');

            const catalogCode = fs.readFileSync(path.resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
            expect(catalogCode).toContain('URL.canParse');

            const helpersCode = fs.readFileSync(path.resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            expect(helpersCode).toContain('URL.canParse');
        });
    });

    describe('7. Promise.withResolvers (ES2024 deferred promise resolution)', () => {
        it('Promise.withResolvers returns promise, resolve, and reject', () => {
            expect(typeof Promise.withResolvers).toBe('function');
            const resolvers = Promise.withResolvers();
            expect(resolvers).toHaveProperty('promise');
            expect(resolvers).toHaveProperty('resolve');
            expect(resolvers).toHaveProperty('reject');
            expect(typeof resolvers.resolve).toBe('function');
            expect(typeof resolvers.reject).toBe('function');
        });

        it('resolves value asynchronously through resolve()', async () => {
            const { promise, resolve } = Promise.withResolvers();
            setTimeout(() => resolve('nisha_resolved_ok'), 10);
            const val = await promise;
            expect(val).toBe('nisha_resolved_ok');
        });

        it('rejects error properly through reject()', async () => {
            const { promise, reject } = Promise.withResolvers();
            setTimeout(() => reject(new Error('custom_rejection')), 10);
            await expect(promise).rejects.toThrow('custom_rejection');
        });

        it('search-worker-client.js, web-locks.js and drop.js use Promise.withResolvers', () => {
            const swcCode = fs.readFileSync(path.resolve(__dirname, '../js/core/search-worker-client.js'), 'utf8');
            expect(swcCode).toContain('Promise.withResolvers');

            const webLocksCode = fs.readFileSync(path.resolve(__dirname, '../js/core/web-locks.js'), 'utf8');
            expect(webLocksCode).toContain('Promise.withResolvers');

            const dropCode = fs.readFileSync(path.resolve(__dirname, '../js/drop/drop.js'), 'utf8');
            expect(dropCode).toContain('Promise.withResolvers');
        });
    });

    describe('8. AbortSignal.any & combineAbortSignals (ES2024 signal combination)', () => {
        it('combineAbortSignals returns null on empty list', () => {
            expect(helpers.combineAbortSignals([])).toBeNull();
            expect(helpers.combineAbortSignals([null, undefined])).toBeNull();
        });

        it('combineAbortSignals returns original signal when only one valid signal passed', () => {
            const ctrl = new AbortController();
            expect(helpers.combineAbortSignals([ctrl.signal])).toBe(ctrl.signal);
        });

        it('aborts combined signal immediately when one of the inputs is already aborted', () => {
            const ctrl1 = new AbortController();
            const ctrl2 = new AbortController();
            ctrl1.abort('early_abort');

            const combined = helpers.combineAbortSignals([ctrl1.signal, ctrl2.signal]);
            expect(combined.aborted).toBe(true);
            expect(combined.reason).toBe('early_abort');
        });

        it('aborts combined signal when any component signal aborts dynamically', async () => {
            const ctrl1 = new AbortController();
            const ctrl2 = new AbortController();
            const combined = helpers.combineAbortSignals([ctrl1.signal, ctrl2.signal]);

            expect(combined.aborted).toBe(false);

            const abortPromise = new Promise(resolve => {
                combined.addEventListener('abort', () => resolve(combined.reason), { once: true });
            });

            ctrl2.abort('timeout_triggered');
            const reason = await abortPromise;
            expect(reason).toBe('timeout_triggered');
            expect(combined.aborted).toBe(true);
        });
    });

    describe('9. Native Set Operations (ES2025 difference, intersection, union, isSubsetOf)', () => {
        const setA = new Set(['nike', 'stussy', 'carhartt', 'bape']);
        const setB = new Set(['stussy', 'supreme', 'bape', 'palace']);

        it('setDifference computes elements in A but not in B', () => {
            const diff = helpers.setDifference(setA, setB);
            expect(Array.from(diff).sort()).toEqual(['carhartt', 'nike']);
            expect(helpers.setDifference(null, setB).size).toBe(0);
            expect(helpers.setDifference(setA, null)).toEqual(setA);
        });

        it('setIntersection computes common elements between A and B', () => {
            const inter = helpers.setIntersection(setA, setB);
            expect(Array.from(inter).sort()).toEqual(['bape', 'stussy']);
            expect(helpers.setIntersection(null, setB).size).toBe(0);
            expect(helpers.setIntersection(setA, null).size).toBe(0);
        });

        it('setUnion combines all unique elements from A and B', () => {
            const union = helpers.setUnion(setA, setB);
            expect(Array.from(union).sort()).toEqual(['bape', 'carhartt', 'nike', 'palace', 'stussy', 'supreme']);
            expect(helpers.setUnion(setA, null)).toEqual(setA);
            expect(helpers.setUnion(null, setB)).toEqual(setB);
        });

        it('setIsSubsetOf correctly verifies subset relationships', () => {
            const sub = new Set(['stussy', 'bape']);
            expect(helpers.setIsSubsetOf(sub, setA)).toBe(true);
            expect(helpers.setIsSubsetOf(setB, setA)).toBe(false);
            expect(helpers.setIsSubsetOf(new Set(), setA)).toBe(true);
            expect(helpers.setIsSubsetOf(setA, new Set())).toBe(false);
        });
    });

    describe('10. Modern CSS @starting-style & transition-behavior: allow-discrete', () => {
        it('style.css defines @supports (transition-behavior: allow-discrete)', () => {
            const css = fs.readFileSync(path.resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('@supports (transition-behavior: allow-discrete)');
            expect(css).toContain('@starting-style');
            expect(css).toContain('allow-discrete');
            expect(css).toContain('.modal-overlay.is-open');
            expect(css).toContain('.terminal-modal-overlay');
            expect(css).toContain('.cart-dropdown.active');
            expect(css).toContain('.live-search-dropdown');
        });

        it('modal closing styles and teardown prevent screen flickering and layout shifts', () => {
            const css = fs.readFileSync(path.resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('scrollbar-gutter: stable');
            expect(css).toContain('.modal-overlay.closing');
            expect(css).toContain('.modal-overlay:not(.is-open)');

            const winJs = fs.readFileSync(path.resolve(__dirname, '../js/ui/windows.js'), 'utf8');
            expect(winJs).toContain("modal.style.transition = 'none'");
            expect(winJs).toContain("modal.style.animation = 'none'");
            expect(winJs).toContain("modal.style.display = 'none'");
        });
    });

    describe('11. ES2024 toWellFormed & isWellFormed', () => {
        it('toWellFormed sanitizes lone surrogates and leaves well-formed strings untouched', () => {
            expect(helpers.toWellFormed('Винтажная куртка')).toBe('Винтажная куртка');
            expect(helpers.toWellFormed(null)).toBe('');
            expect(helpers.toWellFormed(undefined)).toBe('');

            const loneSurrogate = 'broken\uD800item';
            expect(helpers.toWellFormed(loneSurrogate)).toBe('broken\uFFFDitem');
        });

        it('isWellFormed correctly detects ill-formed surrogate strings', () => {
            expect(helpers.isWellFormed('Hello world')).toBe(true);
            expect(helpers.isWellFormed('🇺🇦')).toBe(true);
            expect(helpers.isWellFormed('test\uD800')).toBe(false);
            expect(helpers.isWellFormed(null)).toBe(true);
        });
    });

    describe('12. safeEncodeURIComponent (URIError Crash Immunity)', () => {
        it('encodes valid URIs properly', () => {
            expect(helpers.safeEncodeURIComponent('nike air max')).toBe('nike%20air%20max');
            expect(helpers.safeEncodeURIComponent('🇺🇦')).toBe('%F0%9F%87%BA%F0%9F%87%A6');
        });

        it('never throws URIError on lone surrogates, converting them safely', () => {
            expect(() => {
                const res = helpers.safeEncodeURIComponent('bad\uD800string');
                expect(res).toBe('bad%EF%BF%BDstring');
            }).not.toThrow();
        });
    });

    describe('13. Intl.Segmenter Grapheme-Safe Truncation & Counting', () => {
        it('safeTruncateText does not cut compound emojis or flag sequences in half', () => {
            const textWithFlags = 'Слава Україні 🇺🇦 и миру всем!';
            const truncated = helpers.safeTruncateText(textWithFlags, 15, '...');
            expect(truncated).toContain('🇺🇦');
            expect(truncated.endsWith('...')).toBe(true);
        });

        it('safeTruncateText handles complex ZWJ emoji sequences safely', () => {
            const text = 'Семья: 👨‍👩‍👧‍👦 супер!';
            const truncated = helpers.safeTruncateText(text, 8, '...');
            expect(truncated).toContain('👨‍👩‍👧‍👦');
        });

        it('getGraphemeCount counts user-perceived characters correctly', () => {
            expect(helpers.getGraphemeCount('hello')).toBe(5);
            expect('🇺🇦'.length).toBe(4);
            expect(helpers.getGraphemeCount('🇺🇦')).toBe(1);
            expect('👨‍👩‍👧‍👦'.length).toBe(11);
            expect(helpers.getGraphemeCount('👨‍👩‍👧‍👦')).toBe(1);
        });

        it('system-features.js uses getGraphemeCount for proposal textarea character counter', () => {
            const sysCode = fs.readFileSync(path.resolve(__dirname, '../js/ui/system-features.js'), 'utf8');
            expect(sysCode).toContain('getGraphemeCount');
        });

        it('catalog.js, reviews.js, product.js, chat.js use safeTruncateText', () => {
            const catCode = fs.readFileSync(path.resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
            const revCode = fs.readFileSync(path.resolve(__dirname, '../js/reviews/reviews.js'), 'utf8');
            const prodCode = fs.readFileSync(path.resolve(__dirname, '../js/product/product.js'), 'utf8');
            const chatCode = fs.readFileSync(path.resolve(__dirname, '../js/chat/chat.js'), 'utf8');

            expect(catCode).toContain('safeTruncateText');
            expect(revCode).toContain('safeTruncateText');
            expect(prodCode).toContain('safeTruncateText');
            expect(chatCode).toContain('safeTruncateText');
        });
    });

    describe('14. Cooperative Multitasking (yieldToMain / scheduler.yield)', () => {
        it('yieldToMain resolves without error', async () => {
            await expect(helpers.yieldToMain()).resolves.toBeUndefined();
        });

        it('catalog.js renderNextBatch includes cooperative yielding during large bursts', () => {
            const catCode = fs.readFileSync(path.resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
            expect(catCode).toContain('window.yieldToMain()');
            expect(catCode).toContain('(i - startIndex + 1) % 8 === 0');
        });
    });

});
