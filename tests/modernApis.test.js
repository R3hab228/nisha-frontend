import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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

describe('Modern JS APIs (crypto.randomUUID, Object.groupBy, structuredClone)', () => {
    beforeAll(async () => {
        globalThis.Storage = MockStorage;
        globalThis.localStorage = new MockStorage();
        globalThis.window = globalThis.window || globalThis;
        if (typeof globalThis.window.addEventListener !== 'function') {
            globalThis.window.addEventListener = vi.fn();
        }
        globalThis.document = {
            body: { style: { overflow: '' }, classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) } },
            documentElement: { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) } },
            getElementById: vi.fn(() => null),
            querySelector: vi.fn(() => null),
            querySelectorAll: vi.fn(() => []),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            cookie: '',
            createElement: vi.fn(() => ({
                style: {},
                classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
                setAttribute: vi.fn(),
                appendChild: vi.fn(),
                remove: vi.fn()
            }))
        };
        globalThis.Notification = { permission: 'default', requestPermission: vi.fn(() => Promise.resolve('granted')) };
        globalThis.window.matchMedia = vi.fn((q) => ({ matches: false }));
        Object.defineProperty(globalThis.navigator, 'serviceWorker', {
            value: {
                ready: Promise.resolve({
                    pushManager: {
                        getSubscription: vi.fn(() => Promise.resolve(null)),
                        subscribe: vi.fn(() => Promise.resolve({ endpoint: 'https://test.fcm.endpoint' }))
                    }
                })
            },
            configurable: true,
            writable: true
        });
        Object.defineProperty(globalThis.navigator, 'standalone', {
            value: false,
            configurable: true,
            writable: true
        });

        // Evaluate helpers, store, product, orders in window context
        const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        eval(helpersCode);

        await import('../js/core/store.js');

        const productCode = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');
        eval(productCode);

        const ordersCode = readFileSync(resolve(__dirname, '../js/orders/orders.js'), 'utf8');
        eval(ordersCode);

        const dropCode = readFileSync(resolve(__dirname, '../js/drop/drop.js'), 'utf8');
        eval(dropCode);

        const pwaCode = readFileSync(resolve(__dirname, '../js/core/pwa-network.js'), 'utf8');
        eval(pwaCode);
    });

    beforeEach(() => {
        globalThis.localStorage.clear();
        if (globalThis.store && typeof globalThis.store.clearCart === 'function') {
            globalThis.store.clearCart();
        }
    });

    describe('1. crypto.randomUUID() replacements', () => {
        it('generateShortId generates clean alphanumeric IDs without hyphens', () => {
            const id1 = window.generateShortId(8);
            const id2 = window.generateShortId(8);
            expect(typeof id1).toBe('string');
            expect(id1.length).toBe(8);
            expect(id1).not.toContain('-');
            expect(id1).not.toBe(id2);
        });

        it('cleanly excised measurement scheme logic from product and helpers', () => {
            expect(window.generateMeasurementSchemeSvg).toBeUndefined();
            expect(window.showMeasurementSchemeModal).toBeUndefined();
        });
    });

    describe('2. Object.groupBy() grouping and fallbacks', () => {
        it('getOrderTabBucket correctly categorizes various order statuses', () => {
            expect(window.getOrderTabBucket({ status: 'Принят в обработку' })).toBe('accepted');
            expect(window.getOrderTabBucket({ status: 'Оплачен картой' })).toBe('accepted');
            expect(window.getOrderTabBucket({ status: 'В обработке' })).toBe('accepted');
            expect(window.getOrderTabBucket({ status: 'Отправлен' })).toBe('shipped');
            expect(window.getOrderTabBucket({ status: 'Завершен' })).toBe('shipped');
            expect(window.getOrderTabBucket({ status: 'Отменен покупателем' })).toBe('cancelled');
            expect(window.getOrderTabBucket({ status: 'Возврат товара' })).toBe('cancelled');
            expect(window.getOrderTabBucket({ status: 'Неизвестный статус' })).toBe('other');
        });

        it('Object.groupBy partitions orders into expected tab buckets', () => {
            const orders = [
                { id: '1', status: 'Принят' },
                { id: '2', status: 'Оплачен' },
                { id: '3', status: 'Отправлен' },
                { id: '4', status: 'Отменен' },
                { id: '5', status: 'В обработке' }
            ];

            const grouped = (typeof Object.groupBy === 'function')
                ? Object.groupBy(orders, window.getOrderTabBucket)
                : orders.reduce((acc, o) => {
                    const b = window.getOrderTabBucket(o);
                    (acc[b] = acc[b] || []).push(o);
                    return acc;
                }, {});

            expect(grouped.accepted).toHaveLength(3);
            expect(grouped.shipped).toHaveLength(1);
            expect(grouped.cancelled).toHaveLength(1);
            expect(grouped.accepted.map(o => o.id)).toEqual(['1', '2', '5']);
        });

        it('Object.groupBy handles catalog category counters accurately', () => {
            const catalog = [
                { id: 101, category: 'Худи' },
                { id: 102, category: 'Футболки' },
                { id: 103, category: 'Худи' },
                { id: 104, category: null }
            ];

            const grouped = (typeof Object.groupBy === 'function')
                ? Object.groupBy(catalog, item => item?.category || 'Без категории')
                : catalog.reduce((acc, item) => {
                    const c = item?.category || 'Без категории';
                    (acc[c] = acc[c] || []).push(item);
                    return acc;
                }, {});

            expect(grouped['Худи']).toHaveLength(2);
            expect(grouped['Футболки']).toHaveLength(1);
            expect(grouped['Без категории']).toHaveLength(1);
        });
    });

    describe('3. structuredClone() and deepClone() immutability', () => {
        it('deepClone clones nested objects and arrays without mutating source', () => {
            const original = {
                id: 'prod_1',
                name: 'Vintage Jacket',
                details: { size: 'L', color: 'Black', measurements: [52, 60, 72] },
                tags: ['outerwear', 'archive']
            };

            const clone = window.deepClone(original);
            expect(clone).toEqual(original);
            expect(clone).not.toBe(original);
            expect(clone.details).not.toBe(original.details);
            expect(clone.details.measurements).not.toBe(original.details.measurements);

            // Mutation test
            clone.details.size = 'M';
            clone.details.measurements.push(80);
            expect(original.details.size).toBe('L');
            expect(original.details.measurements).toHaveLength(3);
        });

        it('store.addToCart safely isolates stored item from outside reference mutations', () => {
            const sourceItem = {
                id: 'item-999',
                name: 'Cargo Pants',
                price: 1500,
                attributes: { color: 'Olive' }
            };

            const added = globalThis.store.addToCart(sourceItem);
            expect(added).toBe(true);

            // Mutate sourceItem after addition
            sourceItem.price = 9999;
            sourceItem.attributes.color = 'Red';

            const cart = globalThis.store.get('cart');
            expect(cart).toHaveLength(1);
            expect(cart[0].price).toBe(1500);
            expect(cart[0].attributes.color).toBe('Olive');
        });
    });

    describe('4. Proposal photos: preview & delete without triggering file explorer', () => {
        let mockFilesInput;

        beforeEach(() => {
            mockFilesInput = { click: vi.fn(), value: '' };
            globalThis.currentProposalFiles = [
                { file: { name: 'front.jpg', type: 'image/jpeg' }, url: 'blob:front' },
                { file: { name: 'back.jpg', type: 'image/jpeg' }, url: 'blob:back' }
            ];
            globalThis.window.currentProposalFiles = globalThis.currentProposalFiles;

            globalThis.document.getElementById = vi.fn(id => {
                if (id === 'propFiles') return mockFilesInput;
                if (id === 'propPreviewContainer') return { replaceChildren: vi.fn(), appendChild: vi.fn(), querySelectorAll: vi.fn(() => []) };
                if (id === 'propPlaceholder') return { style: {} };
                return null;
            });
        });

        it('clicking delete-proposal-photo removes file and does NOT trigger propFiles.click', () => {
            const delTarget = {
                getAttribute: (attr) => attr === 'data-action' ? 'delete-proposal-photo' : (attr === 'data-index' ? '0' : null),
                closest: vi.fn(selector => {
                    if (selector === '[data-action]') return delTarget;
                    return null;
                })
            };

            const mockEvent = {
                target: delTarget,
                stopPropagation: vi.fn(),
                stopImmediatePropagation: vi.fn(),
                preventDefault: vi.fn()
            };

            window.handleDelegatedAction(mockEvent);

            expect(mockFilesInput.click).not.toHaveBeenCalled();
            expect(globalThis.window.currentProposalFiles).toHaveLength(1);
            expect(globalThis.window.currentProposalFiles[0].url).toBe('blob:back');
        });

        it('clicking preview-proposal-photo calls openProposalPhotoByIndex and does NOT trigger propFiles.click', () => {
            window.openProposalPhotoByIndex = vi.fn();

            const imgTarget = {
                getAttribute: (attr) => attr === 'data-action' ? 'preview-proposal-photo' : (attr === 'data-index' ? '1' : null),
                closest: vi.fn(selector => {
                    if (selector === '[data-action]') return imgTarget;
                    return null;
                })
            };

            const mockEvent = {
                target: imgTarget,
                stopPropagation: vi.fn(),
                stopImmediatePropagation: vi.fn(),
                preventDefault: vi.fn()
            };

            window.handleDelegatedAction(mockEvent);

            expect(mockFilesInput.click).not.toHaveBeenCalled();
            expect(window.openProposalPhotoByIndex).toHaveBeenCalledWith(1, imgTarget);
        });

        it('clicking trigger-prop-files directly on dropzone triggers propFiles.click when < 5 files', () => {
            const dropzoneTarget = {
                getAttribute: (attr) => attr === 'data-action' ? 'trigger-prop-files' : null,
                closest: vi.fn(selector => {
                    if (selector === '[data-action]') return dropzoneTarget;
                    return null;
                })
            };

            const mockEvent = {
                target: dropzoneTarget,
                stopPropagation: vi.fn(),
                stopImmediatePropagation: vi.fn(),
                preventDefault: vi.fn()
            };

            window.handleDelegatedAction(mockEvent);

            expect(mockFilesInput.click).toHaveBeenCalledTimes(1);
        });

        it('trigger-prop-files is ignored if target is inside preview-img or preview-del-btn', () => {
            const childInsidePreview = {
                closest: vi.fn(selector => {
                    if (selector === '.preview-img') return {};
                    if (selector === '[data-action]') return { getAttribute: () => 'trigger-prop-files' };
                    return null;
                })
            };

            const mockEvent = {
                target: childInsidePreview,
                stopPropagation: vi.fn(),
                stopImmediatePropagation: vi.fn(),
                preventDefault: vi.fn()
            };

            window.handleDelegatedAction(mockEvent);

            expect(mockFilesInput.click).not.toHaveBeenCalled();
        });
    });

    describe('5. toSorted() immutability & setDifference() operations', () => {
        it('toSorted returns a new sorted array and leaves the original untouched', () => {
            const original = [30, 10, 50, 20];
            const sorted = window.toSorted(original, (a, b) => a - b);

            expect(sorted).toEqual([10, 20, 30, 50]);
            expect(original).toEqual([30, 10, 50, 20]);
            expect(sorted).not.toBe(original);
        });

        it('setDifference computes difference between sets accurately', () => {
            const setA = new Set(['1', '2', '3', '4']);
            const setB = new Set(['2', '4', '6']);

            const diff = window.setDifference(setA, setB);
            expect(Array.from(diff)).toEqual(['1', '3']);
        });
    });

    describe('6. formatPrice() with Intl.NumberFormat and non-breaking space', () => {
        it('formats amounts with non-breaking spaces and proper currency symbol', () => {
            const formatted = window.formatPrice(1500);
            expect(formatted).toContain('1');
            expect(formatted).toContain('500');
            expect(formatted).toContain('\u00A0');
            expect(formatted).toContain('грн');

            const numberOnly = window.formatPrice(25000, { numberOnly: true });
            expect(numberOnly).not.toContain('грн');
            expect(numberOnly).toContain('25');
        });
    });

    describe('7. Absence of legacy var declarations in js/ source files', () => {
        it('contains no residual var declarations across primary js files', () => {
            const files = ['cart/cart.js', 'product/product.js', 'profile/profile.js', 'catalog/catalog.js', 'core/helpers.js'];
            for (const relPath of files) {
                const code = readFileSync(resolve(__dirname, '../js', relPath), 'utf8');
                const varMatch = code.match(/^\s*var\s+[a-zA-Z0-9_$]+/gm);
                expect(varMatch).toBeNull();
            }
        });
    });

    describe('8. classList.toggle(name, condition)', () => {
        it('correctly toggles classes based on boolean flag', () => {
            const classSet = new Set();
            const mockEl = {
                classList: {
                    toggle(token, force) {
                        const shouldAdd = typeof force === 'boolean' ? force : !classSet.has(token);
                        if (shouldAdd) classSet.add(token);
                        else classSet.delete(token);
                        return classSet.has(token);
                    },
                    contains(token) { return classSet.has(token); }
                }
            };

            mockEl.classList.toggle('active', true);
            expect(mockEl.classList.contains('active')).toBe(true);

            mockEl.classList.toggle('active', false);
            expect(mockEl.classList.contains('active')).toBe(false);

            mockEl.classList.toggle('active-thumb', 2 === 2);
            expect(mockEl.classList.contains('active-thumb')).toBe(true);

            mockEl.classList.toggle('active-thumb', 1 === 2);
            expect(mockEl.classList.contains('active-thumb')).toBe(false);
        });
    });

    describe('9. String.prototype.replaceAll() in HTML sanitization & string cleaners', () => {
        it('replaces all occurrences without regex overhead', () => {
            const raw = 'Hello <world> & "friends" & \'all\'';
            const escaped = raw
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');

            expect(escaped).toBe('Hello &lt;world&gt; &amp; &quot;friends&quot; &amp; &#39;all&#39;');
            expect(escaped).not.toContain('<');
            expect(escaped).not.toContain('>');

            const searchWithHashtags = '###vintage #hoodie #oversized###';
            expect(searchWithHashtags.replaceAll('#', '').trim()).toBe('vintage hoodie oversized');

            const uuidLike = '123e4567-e89b-12d3-a456-426614174000';
            expect(uuidLike.replaceAll('-', '')).toBe('123e4567e89b12d3a456426614174000');
        });
    });

    describe('10. Number.isFinite() and Number.isNaN() strictness', () => {
        it('Number.isFinite rejects invalid inputs that legacy isNaN/isFinite loosely coerced', () => {
            expect(Number.isFinite(1500)).toBe(true);
            expect(Number.isFinite(0)).toBe(true);
            expect(Number.isFinite(-5)).toBe(true);

            // In contrast to global isFinite, Number.isFinite does NOT coerce
            expect(Number.isFinite('1500')).toBe(false);
            expect(Number.isFinite('')).toBe(false);
            expect(Number.isFinite(null)).toBe(false);
            expect(Number.isFinite(undefined)).toBe(false);
            expect(Number.isFinite(NaN)).toBe(false);
            expect(Number.isFinite(Infinity)).toBe(false);
        });

        it('Number.isNaN only returns true for actual NaN without coercion', () => {
            expect(Number.isNaN(NaN)).toBe(true);
            expect(Number.isNaN(Number('not_a_number'))).toBe(true);

            // In contrast to global isNaN('foo') === true:
            expect(Number.isNaN('foo')).toBe(false);
            expect(Number.isNaN(undefined)).toBe(false);
            expect(Number.isNaN({})).toBe(false);
        });
    });

    describe('11. URLSearchParams query parsing precision', () => {
        it('correctly inspects parameters without false positives on substrings', () => {
            const urlWithSubstr = 'https://www.nisha-store.shop/?order_item=123&action=catalog';
            const params = new URLSearchParams(new URL(urlWithSubstr).search);

            // Substring search on search.includes('item=') would be true (false positive for order_item!)
            expect(urlWithSubstr.includes('item=')).toBe(true);
            // URLSearchParams gives exact answer:
            expect(params.has('item')).toBe(false);
            expect(params.get('action')).toBe('catalog');

            const urlWithDirectItem = 'https://www.nisha-store.shop/?item=prod_456&action=cart';
            const paramsDirect = new URLSearchParams(new URL(urlWithDirectItem).search);
            expect(paramsDirect.has('item')).toBe(true);
            expect(paramsDirect.get('action')).toBe('cart');
        });

        it('constructs encoded query string cleanly for Nominatim geocoding', () => {
            const query = new URLSearchParams({
                lat: '50.4501',
                lon: '30.5234',
                format: 'json',
                'accept-language': 'uk'
            }).toString();

            expect(query).toBe('lat=50.4501&lon=30.5234&format=json&accept-language=uk');
        });
    });

    describe('12. Cleanliness check: Zero legacy global isNaN across frontend js source', () => {
        it('ensures no global isNaN calls remain in js source files', () => {
            const files = [
                'catalog/catalog.js',
                'catalog/live-search.js',
                'cart/cart.js',
                'core/store.js',
                'drop/drop.js',
                'orders/orders.js',
                'product/product.js',
                'profile/profile.js',
                'reviews/reviews.js'
            ];
            for (const relPath of files) {
                const code = readFileSync(resolve(__dirname, '../js', relPath), 'utf8');
                // Match isNaN( not preceded by a dot
                const legacyIsNaNMatch = code.match(/(?<!\.)\bisNaN\s*\(/g);
                expect(legacyIsNaNMatch).toBeNull();
            }
        });
    });

    describe('13. triggerHaptic with Telegram WebApp HapticFeedback integration', () => {
        it('prefers Telegram HapticFeedback impact and notification when available in WebApp', () => {
            const mockImpact = vi.fn();
            const mockNotification = vi.fn();
            globalThis.window.Telegram = {
                WebApp: {
                    HapticFeedback: {
                        impactOccurred: mockImpact,
                        notificationOccurred: mockNotification
                    }
                }
            };

            window.triggerHaptic('light');
            expect(mockImpact).toHaveBeenCalledWith('light');

            window.triggerHaptic('heavy');
            expect(mockImpact).toHaveBeenCalledWith('heavy');

            window.triggerHaptic('success');
            expect(mockNotification).toHaveBeenCalledWith('success');

            window.triggerHaptic('error');
            expect(mockNotification).toHaveBeenCalledWith('error');

            // Cleanup mock
            delete globalThis.window.Telegram;
        });

        it('falls back to navigator.vibrate on mobile browsers outside Telegram', () => {
            const mockVibrate = vi.fn();
            globalThis.navigator.vibrate = mockVibrate;
            globalThis.window.innerWidth = 400; // Mobile screen

            window.triggerHaptic('light');
            expect(mockVibrate).toHaveBeenCalledWith(25);

            window.triggerHaptic('medium');
            expect(mockVibrate).toHaveBeenCalledWith(40);
        });
    });

    describe('14. shareContent helper (Web Share API + Clipboard fallback)', () => {
        it('invokes navigator.share when supported by user agent', async () => {
            const mockShare = vi.fn().mockResolvedValue(undefined);
            globalThis.navigator.share = mockShare;

            const res = await window.shareContent({
                title: 'NISHA Store',
                text: 'Vintage drop',
                url: 'https://www.nisha-store.shop/share/123'
            });

            expect(mockShare).toHaveBeenCalledWith({
                title: 'NISHA Store',
                text: 'Vintage drop',
                url: 'https://www.nisha-store.shop/share/123'
            });
            expect(res).toBe(true);
        });

        it('gracefully falls back to clipboard copy when navigator.share is unavailable', async () => {
            delete globalThis.navigator.share;
            const mockWrite = vi.fn().mockResolvedValue(undefined);
            globalThis.navigator.clipboard = { writeText: mockWrite };

            const res = await window.shareContent({
                url: 'https://www.nisha-store.shop/share/456'
            });

            expect(mockWrite).toHaveBeenCalledWith('https://www.nisha-store.shop/share/456');
            expect(res).toBe(true);
        });
    });

    describe('15. Array.prototype.findLast for top-most z-stack modals', () => {
        it('finds the last matching visible element efficiently from the end', () => {
            const modals = [
                { id: 'modal-1', isVisible: false },
                { id: 'modal-2', isVisible: true },
                { id: 'modal-3', isVisible: true },
                { id: 'modal-4', isVisible: false }
            ];

            const top = modals.findLast(m => m.isVisible);
            expect(top).toBeDefined();
            expect(top.id).toBe('modal-3');
        });
    });

    describe('16. sanitizeText universal XSS prevention helper', () => {
        it('safely escapes special HTML characters using robust native fallback', () => {
            const dirty = '<script>alert("xss")</script> & \'evil\'';
            const clean = window.sanitizeText(dirty);

            expect(clean).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;evil&#39;');
            expect(clean).not.toContain('<script>');
            expect(clean).not.toContain('</script>');
            expect(clean).not.toContain('"');
            expect(clean).not.toContain("'");
        });

        it('handles null, undefined and numbers safely', () => {
            expect(window.sanitizeText(null)).toBe('');
            expect(window.sanitizeText(undefined)).toBe('');
            expect(window.sanitizeText(12345)).toBe('12345');
        });
    });

    describe('17. window.toCDN baseline rewriter in core helpers', () => {
        it('rewrites Supabase storage origin to Cloudflare Worker CDN domain', () => {
            const rawUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/storage/v1/object/public/items/photo.webp';
            const cdnUrl = window.toCDN(rawUrl);

            expect(cdnUrl).toBe('https://nisha-cdn.mtyagniryadno.workers.dev/storage/v1/object/public/items/photo.webp');
        });

        it('passes through external and already-proxied URLs without modification', () => {
            expect(window.toCDN('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
            expect(window.toCDN(null)).toBe('');
            expect(window.toCDN('')).toBe('');
        });
    });

    describe('18. String.prototype.replaceAll escaping utilities (escapeHtml & escapeJsString)', () => {
        it('replaces ALL multiple occurrences of HTML special characters without regex overhead', () => {
            const multiXss = '<<< "hello" & "world" & <test> >>> \'quote\' & \'quote\'';
            const escaped = window.escapeHtml(multiXss);

            expect(escaped).toBe('&lt;&lt;&lt; &quot;hello&quot; &amp; &quot;world&quot; &amp; &lt;test&gt; &gt;&gt;&gt; &#39;quote&#39; &amp; &#39;quote&#39;');
            expect(escaped.includes('<')).toBe(false);
            expect(escaped.includes('>')).toBe(false);
            expect(escaped.includes('"')).toBe(false);
            expect(escaped.includes("'")).toBe(false);
        });

        it('replaces ALL slashes, quotes and line breaks in escapeJsString', () => {
            const jsDirty = "path\\to\\dir 'string' \n and \r\n next";
            const escaped = window.escapeJsString(jsDirty);

            expect(escaped).toContain('\\\\');
            expect(escaped).toContain("\\'");
            expect(escaped).toContain('\\n');
            expect(escaped).toContain('\\r');
        });
    });

    describe('19. Uint8Array.from functional conversion for VAPID base64', () => {
        it('converts base64 decoded string directly to Uint8Array without manual index loops', () => {
            const base64 = 'AQIDBAUG';
            const binary = globalThis.atob ? globalThis.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
            const arr = Uint8Array.from(binary, c => c.charCodeAt(0));

            expect(arr instanceof Uint8Array).toBe(true);
            expect(arr.length).toBe(6);
            expect(Array.from(arr)).toEqual([1, 2, 3, 4, 5, 6]);
        });
    });

    describe('20. WAI-ARIA focus management & inert attribute on modals', () => {
        it('blurs active descendant element inside modal before applying aria-hidden to satisfy W3C specification', () => {
            const mockCloseBtn = {
                blur: vi.fn(),
                focus: vi.fn()
            };
            const modalClasses = new Set();
            const mockModal = {
                id: 'testModal',
                style: { display: 'flex', pointerEvents: '' },
                classList: {
                    contains: vi.fn(c => modalClasses.has(c)),
                    add: vi.fn(c => modalClasses.add(c)),
                    remove: vi.fn(c => modalClasses.delete(c))
                },
                setAttribute: vi.fn(),
                removeAttribute: vi.fn(),
                querySelector: vi.fn(() => null),
                querySelectorAll: vi.fn(() => []),
                contains: vi.fn(el => el === mockCloseBtn),
                inert: false
            };

            globalThis.document.activeElement = mockCloseBtn;
            globalThis.document.getElementById = vi.fn(id => (id === 'testModal' ? mockModal : null));

            const windowsCode = readFileSync(resolve(__dirname, '../js/ui/windows.js'), 'utf8');
            eval(windowsCode);

            vi.useFakeTimers();
            try {
                window.executeCloseModal('testModal');
                expect(mockCloseBtn.blur).toHaveBeenCalled();
                expect(mockModal.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');

                vi.advanceTimersByTime(350);
                expect(mockModal.inert).toBe(true);
            } finally {
                vi.useRealTimers();
            }
        });

        it('clears inert and restores focus element when opening a modal', () => {
            const mockReturnFocus = { focus: vi.fn() };
            const mockModal = {
                id: 'openTestModal',
                style: { display: 'none', pointerEvents: '' },
                classList: {
                    remove: vi.fn()
                },
                setAttribute: vi.fn(),
                removeAttribute: vi.fn(),
                querySelector: vi.fn(() => null),
                inert: true
            };

            globalThis.document.activeElement = mockReturnFocus;
            globalThis.document.getElementById = vi.fn(id => (id === 'openTestModal' ? mockModal : null));

            window.openModal('openTestModal');

            expect(mockModal.inert).toBe(false);
            expect(mockModal.removeAttribute).toHaveBeenCalledWith('inert');
            expect(mockModal.setAttribute).toHaveBeenCalledWith('aria-hidden', 'false');
            expect(mockModal._returnFocusElement).toBe(mockReturnFocus);
        });
    });

    describe('Numeric Utilities & Code Quality (clamp, Number.parseInt/parseFloat)', () => {
        it('clamp restricts values to min and max boundaries', () => {
            expect(typeof window.clamp).toBe('function');
            expect(window.clamp(5, 0, 10)).toBe(5);
            expect(window.clamp(-5, 0, 10)).toBe(0);
            expect(window.clamp(15, 0, 10)).toBe(10);
            expect(window.clamp(0, 0, 10)).toBe(0);
            expect(window.clamp(10, 0, 10)).toBe(10);
            // Inverted boundary guard
            expect(window.clamp(5, 10, 0)).toBe(5);
        });

        it('guarantees no loose parseInt/parseFloat exists in frontend js codebase', () => {
            const { readdirSync, statSync, readFileSync } = require('fs');
            const { join } = require('path');

            const jsDir = resolve(__dirname, '../js');
            const getFiles = (dir) => {
                let results = [];
                const list = readdirSync(dir);
                list.forEach((file) => {
                    const fullPath = join(dir, file);
                    const stat = statSync(fullPath);
                    if (stat && stat.isDirectory()) {
                        results = results.concat(getFiles(fullPath));
                    } else if (file.endsWith('.js')) {
                        results.push(fullPath);
                    }
                });
                return results;
            };

            const files = getFiles(jsDir);
            const loosePattern = /(?<!Number\.)(parseInt|parseFloat)\s*\(/g;
            const violations = [];

            for (const file of files) {
                const content = readFileSync(file, 'utf8');
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (loosePattern.test(line)) {
                        violations.push(`${file}:${idx + 1}: ${line.trim()}`);
                    }
                });
            }

            expect(violations).toEqual([]);
        });
    });

    describe('21. Click Bleed-Through & Ghost Click Prevention (Modal Overlay Shields)', () => {
        it('blocks delegated background actions like add-to-cart when a modal is active or closing', () => {
            const mockBgBtn = {
                disabled: false,
                hasAttribute: () => false,
                getAttribute: (attr) => (attr === 'data-action' ? 'add-to-cart' : 'item-123'),
                closest: vi.fn((sel) => {
                    if (sel === '[data-action]') return mockBgBtn;
                    if (sel === '.modal-overlay') return null; // Outside modal!
                    return null;
                })
            };

            const mockActiveModal = {
                classList: { contains: () => false },
                style: { display: 'flex' },
                addEventListener: vi.fn(),
                querySelector: vi.fn(() => null)
            };

            const origQuerySelectorAll = globalThis.document.querySelectorAll;
            globalThis.document.querySelectorAll = vi.fn((sel) => {
                if (sel === '.modal-overlay') return [mockActiveModal];
                return [];
            });

            window.addToCartWithAnimation = vi.fn();
            const mockEvent = {
                target: mockBgBtn,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                stopImmediatePropagation: vi.fn()
            };

            const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            eval(helpersCode);

            window.handleDelegatedAction(mockEvent);

            // Must be blocked!
            expect(window.addToCartWithAnimation).not.toHaveBeenCalled();
            expect(mockEvent.stopPropagation).toHaveBeenCalled();
            expect(mockEvent.preventDefault).toHaveBeenCalled();

            globalThis.document.querySelectorAll = origQuerySelectorAll;
        });

        it('stops propagation when closeModal is invoked with an event', () => {
            const mockEvt = {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                stopImmediatePropagation: vi.fn()
            };
            const mockModal = {
                classList: { contains: () => false, add: vi.fn(), remove: vi.fn() },
                style: { display: 'flex' },
                contains: () => false,
                setAttribute: vi.fn(),
                querySelectorAll: () => [],
                querySelector: vi.fn(() => null),
                addEventListener: vi.fn()
            };
            const origGetElementById = globalThis.document.getElementById;
            const origQuerySelectorAll = globalThis.document.querySelectorAll;
            globalThis.document.getElementById = vi.fn(() => mockModal);
            globalThis.document.querySelectorAll = vi.fn(() => []);

            const windowsCode = readFileSync(resolve(__dirname, '../js/ui/windows.js'), 'utf8');
            eval(windowsCode);

            window.closeModal('productModal', mockEvt);

            expect(mockEvt.preventDefault).toHaveBeenCalled();
            expect(mockEvt.stopPropagation).toHaveBeenCalled();
            expect(mockEvt.stopImmediatePropagation).toHaveBeenCalled();

            globalThis.document.getElementById = origGetElementById;
            globalThis.document.querySelectorAll = origQuerySelectorAll;
        });
    });

    describe('22. Safe Session Storage Facade (storage.session) with In-Memory Fallback', () => {
        it('supports get, set, getJSON, setJSON, remove, has and clear', () => {
            const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            eval(helpersCode);

            expect(window.storage).toBeDefined();
            expect(window.storage.session).toBeDefined();

            // Set string and read back
            window.storage.session.set('test_key', 'hello_world');
            expect(window.storage.session.get('test_key')).toBe('hello_world');
            expect(window.storage.session.has('test_key')).toBe(true);

            // Set JSON and read back
            window.storage.session.setJSON('test_json', { draft: true, amount: 42 });
            expect(window.storage.session.getJSON('test_json')).toEqual({ draft: true, amount: 42 });

            // Remove
            window.storage.session.remove('test_key');
            expect(window.storage.session.has('test_key')).toBe(false);
            expect(window.storage.session.get('test_key', 'default_val')).toBe('default_val');

            // Clear
            window.storage.session.clear();
            expect(window.storage.session.has('test_json')).toBe(false);
        });

        it('gracefully falls back to in-memory map when sessionStorage throws QuotaExceededError', () => {
            const throwingStore = {
                getItem: () => { throw new Error('QuotaExceededError'); },
                setItem: () => { throw new Error('QuotaExceededError'); },
                removeItem: () => { throw new Error('QuotaExceededError'); },
                clear: () => { throw new Error('QuotaExceededError'); }
            };

            const origSessionStorage = globalThis.sessionStorage;
            globalThis.sessionStorage = throwingStore;

            const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            eval(helpersCode);

            // Must not throw even when storage throws
            expect(() => {
                window.storage.session.set('safari_key', 'value_in_memory');
            }).not.toThrow();

            expect(window.storage.session.get('safari_key')).toBe('value_in_memory');

            expect(() => {
                window.storage.session.setJSON('safari_json', { ok: true });
            }).not.toThrow();
            expect(window.storage.session.getJSON('safari_json')).toEqual({ ok: true });

            globalThis.sessionStorage = origSessionStorage;
        });
    });

    describe('23. Profile Delivery Accordion & Two-Way Cart Synchronization', () => {
        it('validates presence of delivery accordion and checkout save-checkbox in index.html', () => {
            const htmlContent = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            expect(htmlContent).toContain('id=profileDeliveryToggleBtn');
            expect(htmlContent).toContain('id=profileDeliveryCollapse');
            expect(htmlContent).toContain('id=profileDeliveryFullName');
            expect(htmlContent).toContain('id=profileDeliveryAddress');

            expect(htmlContent).toContain('id=modalProfileDeliveryToggleBtn');
            expect(htmlContent).toContain('id=modalProfileDeliveryCollapse');
            expect(htmlContent).toContain('id=modalProfileDeliveryFullName');
            expect(htmlContent).toContain('id=modalProfileDeliveryAddress');

            expect(htmlContent).toContain('id=saveDeliveryToProfileCheckbox');
        });

        it('toggles delivery accordion collapsed state and updates button text', () => {
            let isCollapsed = true;
            let isOpen = false;
            let text = '[ ДАННЫЕ ДОСТАВКИ ▼ ]';

            const mockCollapse = {
                classList: {
                    toggle: vi.fn((cls) => {
                        if (cls === 'collapsed') {
                            isCollapsed = !isCollapsed;
                            return isCollapsed;
                        }
                        return false;
                    })
                }
            };
            const mockTextSpan = {
                set innerText(val) { text = val; },
                get innerText() { return text; }
            };
            const mockBtn = {
                classList: {
                    toggle: vi.fn((cls, val) => {
                        if (cls === 'is-open') isOpen = Boolean(val);
                    })
                },
                querySelector: vi.fn((sel) => {
                    if (sel === '.profile-delivery-btn-text') return mockTextSpan;
                    return null;
                })
            };

            const origGetElementById = globalThis.document.getElementById;
            globalThis.document.getElementById = vi.fn((id) => {
                if (id === 'profileDeliveryCollapse') return mockCollapse;
                if (id === 'profileDeliveryToggleBtn') return mockBtn;
                return null;
            });

            const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            eval(helpersCode);
            const profileCode = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf8');
            eval(profileCode);

            // 1. Open
            window.toggleProfileDeliveryAccordion(false, mockBtn);
            expect(isCollapsed).toBe(false);
            expect(isOpen).toBe(true);
            expect(text).toContain('▲');

            // 2. Close
            window.toggleProfileDeliveryAccordion(false, mockBtn);
            expect(isCollapsed).toBe(true);
            expect(isOpen).toBe(false);
            expect(text).toContain('▼');

            globalThis.document.getElementById = origGetElementById;
        });

        it('renders and saves delivery data to userProfile and storage across desktop and modal', async () => {
            const elements = {
                profileDeliveryFullName: { value: '' },
                profileDeliveryCity: { value: '' },
                profileDeliveryBranch: { value: '' },
                profileDeliveryAddress: { value: '' },
                modalProfileDeliveryFullName: { value: '' },
                modalProfileDeliveryCity: { value: '' },
                modalProfileDeliveryBranch: { value: '' },
                modalProfileDeliveryAddress: { value: '' }
            };

            const origGetElementById = globalThis.document.getElementById;
            globalThis.document.getElementById = vi.fn((id) => elements[id] || null);

            const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            eval(helpersCode);
            const profileCode = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf8');
            eval(profileCode);

            window.userProfile = { full_name: '', delivery_address: '' };
            await window.saveDeliveryToProfile('Іванов Петро Олексійович', 'Київ, Відділення №25');

            expect(window.userProfile.full_name).toBe('Іванов Петро Олексійович');
            expect(window.userProfile.delivery_address).toBe('Київ, Відділення №25');

            expect(elements.profileDeliveryFullName.value).toBe('Іванов Петро Олексійович');
            expect(elements.profileDeliveryCity.value).toBe('Київ');
            expect(elements.profileDeliveryBranch.value).toBe('Відділення №25');
            expect(elements.profileDeliveryAddress.value).toBe('Київ, Відділення №25');
            expect(elements.modalProfileDeliveryFullName.value).toBe('Іванов Петро Олексійович');
            expect(elements.modalProfileDeliveryCity.value).toBe('Київ');
            expect(elements.modalProfileDeliveryBranch.value).toBe('Відділення №25');
            expect(elements.modalProfileDeliveryAddress.value).toBe('Київ, Відділення №25');

            const cached = window.storage.getJSON('nisha_profile_delivery');
            expect(cached).toEqual({
                full_name: 'Іванов Петро Олексійович',
                delivery_address: 'Київ, Відділення №25'
            });

            globalThis.document.getElementById = origGetElementById;
        });


        it('renders Nova Poshta cities and branches with icons and two-way address synchronization', async () => {
            const elements = {
                profileDeliveryCity: { value: 'Київ' },
                profileDeliveryBranch: { value: '' },
                profileDeliveryAddress: { value: '' },
                profileDeliveryCityDropdown: { innerHTML: '', style: { display: 'none' }, appendChild: vi.fn() },
                profileDeliveryBranchDropdown: { innerHTML: '', style: { display: 'none' }, appendChild: vi.fn() }
            };

            const origGetElementById = globalThis.document.getElementById;
            globalThis.document.getElementById = vi.fn((id) => elements[id] || null);

            const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            eval(helpersCode);
            const profileCode = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf8');
            eval(profileCode);

            // Mock apiClient for NP proxy
            window.apiClient = {
                post: vi.fn(async (url, body) => {
                    if (body.calledMethod === 'searchSettlements') {
                        return {
                            success: true,
                            data: [{
                                Addresses: [
                                    { Present: 'м. Київ', DeliveryCity: '8d5a980d-391c-11dd-90d9-001a92567626', Ref: 'ref-kyiv' }
                                ]
                            }]
                        };
                    }
                    if (body.calledMethod === 'getWarehouses') {
                        return {
                            success: true,
                            data: [
                                { Ref: 'b-1', Description: 'Відділення №45 (до 30 кг)', TypeOfWarehouse: 'regular' },
                                { Ref: 'b-2', Description: 'Поштомат №1200', TypeOfWarehouse: 'f9316480-5f2d-425d-bc2c-ac7cd29decf0' }
                            ]
                        };
                    }
                    return { success: false };
                })
            };

            // Test searching cities
            await window.searchProfileNPCity(false, 'Київ');
            expect(window.apiClient.post).toHaveBeenCalledWith(
                '/api/np-proxy',
                expect.objectContaining({ calledMethod: 'searchSettlements' }),
                expect.any(Object)
            );
            expect(elements.profileDeliveryCityDropdown.style.display).toBe('block');

            // Test loading branches
            await window.loadProfileBranches(false, '45');
            expect(window.apiClient.post).toHaveBeenCalledWith(
                '/api/np-proxy',
                expect.objectContaining({ calledMethod: 'getWarehouses' }),
                expect.any(Object)
            );
            expect(elements.profileDeliveryBranchDropdown.style.display).toBe('block');

            globalThis.document.getElementById = origGetElementById;
        });


        it('auto-capitalizes full name words, normalizes all-caps on blur, and shows [ СОХРАНЕНО ✓ ] on save', async () => {
            const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            eval(helpersCode);
            const profileCode = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf8');
            eval(profileCode);

            // 1. Auto-capitalize full name words
            expect(window.formatFullNameWords('шевченко тарас григорович')).toBe('Шевченко Тарас Григорович');
            expect(window.formatFullNameWords('немирович-данченко')).toBe('Немирович-Данченко');
            expect(window.formatFullNameWords("в'ячеслав")).toBe("В'ячеслав");
            expect(window.formatFullNameWords('123іван45')).toBe('Іван');

            // 2. Normalize all-caps on blur
            expect(window.normalizeFullNameOnBlur('ИВАНОВ ИВАН ИВАНОВИЧ')).toBe('Иванов Иван Иванович');
            expect(window.normalizeFullNameOnBlur('  петренко   олександр  ')).toBe('Петренко Олександр');

            // 3. Save button visual feedback
            const mockBtn = {
                innerText: '[ СОХРАНИТЬ ]',
                classList: {
                    add: vi.fn(),
                    remove: vi.fn()
                },
                disabled: false,
                style: {}
            };
            const elements = {
                profileDeliveryFullName: { value: 'Шевченко Тарас' },
                profileDeliveryCity: { value: 'Київ' },
                profileDeliveryBranch: { value: 'Відділення №1' },
                profileDeliveryAddress: { value: 'Київ, Відділення №1' },
                profileDeliverySaveBtn: mockBtn
            };
            const origGetElementById = globalThis.document.getElementById;
            globalThis.document.getElementById = vi.fn((id) => elements[id] || null);

            window.userProfile = {};
            await window.saveProfileDeliveryFromForm(false, mockBtn);

            expect(mockBtn.innerText).toBe('[ СОХРАНЕНО ✓ ]');
            expect(mockBtn.classList.add).toHaveBeenCalledWith('is-saved');

            globalThis.document.getElementById = origGetElementById;
        });

        it('verifies Win95 retro-checkbox, clean labels without [x], and white-space nowrap on delivery button', () => {
            const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            const ruJson = JSON.parse(readFileSync(resolve(__dirname, '../locales/ru.json'), 'utf8'));
            const uaJson = JSON.parse(readFileSync(resolve(__dirname, '../locales/ua.json'), 'utf8'));
            const enJson = JSON.parse(readFileSync(resolve(__dirname, '../locales/en.json'), 'utf8'));

            // 1. Checkbox uses win95-cb class and win95-custom-checkbox wrapper
            expect(html).toContain('class="win95-cb"');
            expect(html).toContain('class="win95-custom-checkbox"');

            // 2. No [x] in labels or translations
            expect(html).not.toContain('[x] Запомнить');
            expect(ruJson.translation.checkout.save_to_profile).not.toMatch(/^\[x\]/i);
            expect(uaJson.translation.checkout.save_to_profile).not.toMatch(/^\[x\]/i);
            expect(enJson.translation.checkout.save_to_profile).not.toMatch(/^\[x\]/i);

            // 3. Delivery button has white-space nowrap to prevent bracket wrap
            expect(css).toMatch(/\.profile-delivery-btn[\s\S]*?white-space:\s*nowrap\s*!important/);

            // 4. Win95 checkbox styles render retro brackets and green square
            expect(css).toContain('.win95-cb:checked');
            expect(css).toContain('%2300ff00');
        });

        it('locks delivery fields into read-only state and toggles [ ИЗМЕНИТЬ ] / [ СОХРАНИТЬ ]', async () => {
            const profileCode = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf8');
            eval(profileCode);

            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('.profile-delivery-input.is-locked');
            expect(css).toContain('pointer-events: none !important');
            expect(css).toContain('.profile-delivery-save-btn.is-edit-mode');

            const makeMockInput = (val = '') => ({
                value: val,
                readOnly: false,
                attributes: {},
                classList: {
                    _classes: new Set(),
                    add(c) { this._classes.add(c); },
                    remove(c) { this._classes.delete(c); },
                    toggle(c, force) {
                        if (force === undefined) {
                            if (this._classes.has(c)) this._classes.delete(c);
                            else this._classes.add(c);
                        } else if (force) {
                            this._classes.add(c);
                        } else {
                            this._classes.delete(c);
                        }
                    },
                    contains(c) { return this._classes.has(c); }
                },
                setAttribute(k, v) { this.attributes[k] = v; },
                removeAttribute(k) { delete this.attributes[k]; },
                focus: vi.fn()
            });

            const fnEl = makeMockInput('Франко Іван');
            const cityEl = makeMockInput('Львів');
            const branchEl = makeMockInput('Відділення №5');
            const saveBtn = {
                innerText: '[ СОХРАНИТЬ ]',
                attributes: { 'data-mode': 'save' },
                classList: {
                    _classes: new Set(),
                    add(c) { this._classes.add(c); },
                    remove(c) { this._classes.delete(c); },
                    toggle(c, force) {
                        if (force === undefined) {
                            if (this._classes.has(c)) this._classes.delete(c);
                            else this._classes.add(c);
                        } else if (force) {
                            this._classes.add(c);
                        } else {
                            this._classes.delete(c);
                        }
                    },
                    contains(c) { return this._classes.has(c); }
                },
                setAttribute(k, v) { this.attributes[k] = v; },
                getAttribute(k) { return this.attributes[k]; },
                removeAttribute(k) { delete this.attributes[k]; },
                disabled: false,
                style: {}
            };

            const mockElements = {
                profileDeliveryFullName: fnEl,
                profileDeliveryCity: cityEl,
                profileDeliveryBranch: branchEl,
                profileDeliverySaveBtn: saveBtn
            };

            const origGetElementById = globalThis.document.getElementById;
            globalThis.document.getElementById = vi.fn((id) => mockElements[id] || null);

            // 1. Lock the form:
            window.setProfileDeliveryLockState(true);
            expect(fnEl.readOnly).toBe(true);
            expect(cityEl.readOnly).toBe(true);
            expect(branchEl.readOnly).toBe(true);
            expect(fnEl.classList.contains('is-locked')).toBe(true);
            expect(fnEl.attributes['tabindex']).toBe('-1');
            expect(saveBtn.innerText).toBe('[ ИЗМЕНИТЬ ]');
            expect(saveBtn.attributes['data-mode']).toBe('edit');
            expect(saveBtn.classList.contains('is-edit-mode')).toBe(true);

            // 2. Click button when data-mode is 'edit': it must unlock fields and focus full name
            await window.saveProfileDeliveryFromForm(false, saveBtn);
            expect(fnEl.readOnly).toBe(false);
            expect(cityEl.readOnly).toBe(false);
            expect(branchEl.readOnly).toBe(false);
            expect(fnEl.classList.contains('is-locked')).toBe(false);
            expect(fnEl.attributes['tabindex']).toBeUndefined();
            expect(saveBtn.innerText).toBe('[ СОХРАНИТЬ ]');
            expect(saveBtn.attributes['data-mode']).toBe('save');
            expect(saveBtn.classList.contains('is-edit-mode')).toBe(false);
            expect(fnEl.focus).toHaveBeenCalled();

            globalThis.document.getElementById = origGetElementById;
        });
    });

    describe('24. Product Card PhotoSwipe Zoom & Modal Slider Click Handler', () => {
        it('exposes openProductPhotoZoom on window object', () => {
            expect(typeof window.openProductPhotoZoom).toBe('function');
        });

        it('intercepts click on a.slide, prevents default, stops propagation and opens zoom', async () => {
            const slideImg = {
                tagName: 'IMG',
                classList: { contains: vi.fn(() => false) },
                src: 'https://nisha-cdn.mtyagniryadno.workers.dev/photo1.jpg',
                currentSrc: 'https://nisha-cdn.mtyagniryadno.workers.dev/photo1.jpg',
                naturalWidth: 1200,
                naturalHeight: 1600
            };

            const slideA = {
                tagName: 'A',
                href: 'https://nisha-cdn.mtyagniryadno.workers.dev/photo1.jpg',
                classList: {
                    contains: vi.fn((cls) => cls === 'slide'),
                    remove: vi.fn()
                },
                getAttribute: vi.fn((attr) => {
                    if (attr === 'data-pswp-width') return '1200';
                    if (attr === 'data-pswp-height') return '1600';
                    return null;
                }),
                querySelector: vi.fn((sel) => sel === 'img' ? slideImg : null)
            };

            const mockWrapper = {
                _pswpClickBound: false,
                contains: vi.fn((el) => el === slideA),
                querySelectorAll: vi.fn((sel) => {
                    if (sel === 'a.slide' || sel === '.slide') return [slideA];
                    return [];
                }),
                addEventListener: vi.fn((evt, cb) => {
                    mockWrapper._clickCb = cb;
                })
            };

            const origGetEl = globalThis.document.getElementById;
            globalThis.document.getElementById = vi.fn((id) => {
                if (id === 'sliderWrapper') return mockWrapper;
                return null;
            });

            // Simulate the click binding from openProductModal
            if (!mockWrapper._pswpClickBound) {
                mockWrapper._pswpClickBound = true;
                mockWrapper.addEventListener('click', (e) => {
                    const slide = e.target.closest('a.slide');
                    if (!slide || !mockWrapper.contains(slide)) return;
                    if (e.target.closest('button, [data-action], video')) return;

                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.openProductPhotoZoom === 'function') {
                        window.openProductPhotoZoom(slide);
                    }
                });
            }

            expect(mockWrapper.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

            // Mock PhotoSwipeLightbox constructor
            let createdConfig = null;
            let mockInstance = {
                init: vi.fn(),
                loadAndOpen: vi.fn(),
                destroy: vi.fn(),
                on: vi.fn(),
                pswp: { currIndex: 0 }
            };

            window.PhotoSwipeLightbox = vi.fn(function(cfg) {
                createdConfig = cfg;
                return mockInstance;
            });
            window.ensurePhotoSwipe = vi.fn().mockResolvedValue(window.PhotoSwipeLightbox);

            // Trigger click event on image inside a.slide
            const evt = {
                target: {
                    closest: vi.fn((sel) => {
                        if (sel === 'a.slide') return slideA;
                        return null;
                    })
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            mockWrapper._clickCb(evt);

            expect(evt.preventDefault).toHaveBeenCalled();
            expect(evt.stopPropagation).toHaveBeenCalled();

            // Wait microtask for async openProductPhotoZoom
            await new Promise(r => setTimeout(r, 10));

            expect(window.ensurePhotoSwipe).toHaveBeenCalled();
            expect(window.PhotoSwipeLightbox).toHaveBeenCalled();
            expect(createdConfig).not.toBeNull();
            expect(Array.isArray(createdConfig.dataSource)).toBe(true);
            expect(createdConfig.dataSource.length).toBe(1);
            expect(createdConfig.dataSource[0].src).toBe('https://nisha-cdn.mtyagniryadno.workers.dev/photo1.jpg');
            expect(createdConfig.dataSource[0].width).toBe(1200);
            expect(createdConfig.dataSource[0].height).toBe(1600);
            expect(mockInstance.init).toHaveBeenCalled();
            expect(mockInstance.loadAndOpen).toHaveBeenCalledWith(0);

            globalThis.document.getElementById = origGetEl;
        });

        it('does not prevent default or open zoom when clicking on video or control button', () => {
            const mockWrapper = {
                _pswpClickBound: false,
                contains: vi.fn(() => true),
                addEventListener: vi.fn((evt, cb) => {
                    mockWrapper._clickCb = cb;
                })
            };

            mockWrapper._pswpClickBound = true;
            mockWrapper.addEventListener('click', (e) => {
                const slide = e.target.closest('a.slide');
                if (!slide || !mockWrapper.contains(slide)) return;
                if (e.target.closest('button, [data-action], video')) return;

                e.preventDefault();
                e.stopPropagation();
                if (typeof window.openProductPhotoZoom === 'function') {
                    window.openProductPhotoZoom(slide);
                }
            });

            const zoomSpy = vi.spyOn(window, 'openProductPhotoZoom');

            // Click on video sound button inside a slide
            const btnEvt = {
                target: {
                    closest: vi.fn((sel) => {
                        if (sel === 'a.slide') return { tagName: 'A' };
                        if (sel === 'button, [data-action], video') return { tagName: 'BUTTON' };
                        return null;
                    })
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            mockWrapper._clickCb(btnEvt);
            expect(btnEvt.preventDefault).not.toHaveBeenCalled();
            expect(btnEvt.stopPropagation).not.toHaveBeenCalled();
            expect(zoomSpy).not.toHaveBeenCalled();

            // Click outside a.slide (e.g. video slide div)
            const vidEvt = {
                target: {
                    closest: vi.fn(() => null)
                },
                preventDefault: vi.fn(),
                stopPropagation: vi.fn()
            };

            mockWrapper._clickCb(vidEvt);
            expect(vidEvt.preventDefault).not.toHaveBeenCalled();
            expect(zoomSpy).not.toHaveBeenCalled();

            zoomSpy.mockRestore();
        });
    });

    describe('25. Offline Sticky Banner Positioning & Social Sharing Open Graph (1200x630)', () => {
        it('places offlineStickyBanner before header at the very top of wrapper in index.html', () => {
            const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            const bannerIdx = html.indexOf('id="offlineStickyBanner"');
            const headerIdx = html.indexOf('<header>');
            expect(bannerIdx).toBeGreaterThan(-1);
            expect(headerIdx).toBeGreaterThan(-1);
            expect(bannerIdx).toBeLessThan(headerIdx);
        });

        it('configures .offline-sticky-banner CSS with top: 0 and sticky positioning', () => {
            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            const bannerCssMatch = css.match(/\.offline-sticky-banner\s*\{([^}]+)\}/);
            expect(bannerCssMatch).not.toBeNull();
            const rules = bannerCssMatch[1];
            expect(rules).toMatch(/position:\s*sticky;/);
            expect(rules).toMatch(/top:\s*0;/);
            expect(rules).not.toMatch(/top:\s*65px;/);
        });

        it('configures 1200x630 og-image and summary_large_image in index.html for social sharing', () => {
            const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            expect(html).toContain('content="https://www.nisha-store.shop/og-image.png"');
            expect(html).toContain('property="og:image:width" content="1200"');
            expect(html).toContain('property="og:image:height" content="630"');
            expect(html).toContain('name="twitter:image" content="https://www.nisha-store.shop/og-image.png"');
            expect(html).toContain('name="twitter:card" content="summary_large_image"');
        });

        it('verifies og-image.png exists in public directory with valid dimensions', () => {
            const ogPath = resolve(__dirname, '../public/og-image.png');
            const exists = existsSync(ogPath);
            expect(exists).toBe(true);
            const buf = readFileSync(ogPath);
            // PNG signature
            expect(buf[0]).toBe(0x89);
            expect(buf[1]).toBe(0x50);
            expect(buf[2]).toBe(0x4E);
            expect(buf[3]).toBe(0x47);
            // IHDR width and height
            const width = buf.readUInt32BE(16);
            const height = buf.readUInt32BE(20);
            expect(width).toBe(1200);
            expect(height).toBe(630);
        });

        it('resetOpenGraphTags restores default 1200x630 og-image and twitter meta tags', () => {
            const setMetaCalls = [];
            window.setMetaTag = vi.fn((key, val) => {
                setMetaCalls.push({ key, val });
            });

            window.resetOpenGraphTags();

            expect(window.setMetaTag).toHaveBeenCalledWith('og:image', 'https://www.nisha-store.shop/og-image.png');
            expect(window.setMetaTag).toHaveBeenCalledWith('og:image:width', '1200');
            expect(window.setMetaTag).toHaveBeenCalledWith('og:image:height', '630');
            expect(window.setMetaTag).toHaveBeenCalledWith('twitter:image', 'https://www.nisha-store.shop/og-image.png');
        });
    });

    describe('26. Web Push & PWA Notification Deduplication & Storage Persistence', () => {
        it('isPwaStandalone detects standalone display mode or navigator.standalone', () => {
            window.matchMedia = vi.fn((q) => ({ matches: q.includes('standalone') }));
            expect(window.isPwaStandalone()).toBe(true);

            window.matchMedia = vi.fn(() => ({ matches: false }));
            globalThis.navigator.standalone = false;
            expect(window.isPwaStandalone()).toBe(false);

            globalThis.navigator.standalone = true;
            expect(window.isPwaStandalone()).toBe(true);
            globalThis.navigator.standalone = false;
        });

        it('checkIsPwaInstalled detects installed PWA via store, localStorage, or cookie', () => {
            window.matchMedia = vi.fn(() => ({ matches: false }));
            globalThis.store.set('isPwaInstalled', false);
            globalThis.localStorage.removeItem('nisha_pwa_installed');
            document.cookie = '';

            expect(window.checkIsPwaInstalled()).toBe(false);

            globalThis.store.set('isPwaInstalled', true);
            expect(window.checkIsPwaInstalled()).toBe(true);

            globalThis.store.set('isPwaInstalled', false);
            globalThis.localStorage.setItem('nisha_pwa_installed', 'true');
            expect(window.checkIsPwaInstalled()).toBe(true);

            globalThis.localStorage.removeItem('nisha_pwa_installed');
            document.cookie = 'nisha_pwa_installed=true';
            expect(window.checkIsPwaInstalled()).toBe(true);
            document.cookie = '';
        });

        it('syncNotificationPermission persists permission in store and localStorage', () => {
            globalThis.Notification = { permission: 'granted' };
            const perm = window.syncNotificationPermission();
            expect(perm).toBe('granted');
            expect(globalThis.store.get('notificationPermission')).toBe('granted');
            expect(globalThis.localStorage.getItem('nisha_notification_permission')).toBe('granted');
        });

        it('subscribeUserToPush unsubscribes browser and suppresses web subscription when PWA is installed', async () => {
            window.matchMedia = vi.fn(() => ({ matches: false }));
            globalThis.store.set('isPwaInstalled', true);

            const mockUnsubscribe = vi.fn(() => Promise.resolve(true));
            const mockExistingSub = { endpoint: 'https://browser.push.sub', unsubscribe: mockUnsubscribe };
            const mockSubscribe = vi.fn();
            const mockRegistration = {
                pushManager: {
                    getSubscription: vi.fn(() => Promise.resolve(mockExistingSub)),
                    subscribe: mockSubscribe
                }
            };

            const postSpy = vi.fn(() => Promise.resolve({ success: true }));
            window.apiClient = { post: postSpy, get: vi.fn() };

            await window.subscribeUserToPush(mockRegistration);

            // Existing browser subscription must be unsubscribed so notifications only go to PWA
            expect(mockUnsubscribe).toHaveBeenCalled();
            expect(postSpy).toHaveBeenCalledWith('/api/unsubscribe', { endpoint: 'https://browser.push.sub' });
            // Should NOT attempt to subscribe the browser
            expect(mockSubscribe).not.toHaveBeenCalled();
        });

        it('subscribeUserToPush registers standalone PWA with clientType pwa and marks installation in store', async () => {
            window.matchMedia = vi.fn((q) => ({ matches: q.includes('standalone') }));
            globalThis.Notification = {
                permission: 'granted',
                requestPermission: vi.fn(() => Promise.resolve('granted'))
            };

            const mockSub = { endpoint: 'https://pwa.push.sub' };
            const mockSubscribe = vi.fn(() => Promise.resolve(mockSub));
            const mockRegistration = {
                pushManager: {
                    getSubscription: vi.fn(() => Promise.resolve(null)),
                    subscribe: mockSubscribe
                }
            };

            const postSpy = vi.fn(() => Promise.resolve({ success: true }));
            window.apiClient = {
                get: vi.fn(() => Promise.resolve({ publicKey: 'BKag93TestKeyVapid1234567890' })),
                post: postSpy
            };

            await window.subscribeUserToPush(mockRegistration);

            expect(mockSubscribe).toHaveBeenCalled();
            expect(globalThis.store.get('isPwaInstalled')).toBe(true);
            expect(postSpy).toHaveBeenCalledWith('/api/subscribe', expect.objectContaining({
                subscription: mockSub,
                clientType: 'pwa',
                isPwa: true
            }), expect.any(Object));
        });

        it('manifests specify related_applications for PWA discovery', () => {
            const manifest = JSON.parse(readFileSync(resolve(__dirname, '../manifest.json'), 'utf8'));
            expect(manifest.related_applications).toBeDefined();
            expect(manifest.related_applications[0].platform).toBe('webapp');
            expect(manifest.related_applications[0].url).toBe('/manifest.json');
        });
    });

    describe('27. PWA Standalone Bottom Bezel Safe Area & Silent Offline Sticky Banner', () => {
        it('buy-share-row balances lower bottom placement on web while elevating for PWA standalone', () => {
            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('.buy-share-row');
            expect(css).toContain('bottom: calc(-20px + env(safe-area-inset-bottom, 0px))');
            expect(css).toContain('html.pwa-standalone .buy-share-row');
            expect(css).toContain('bottom: calc(-3px + env(safe-area-inset-bottom, 0px)) !important');
        });

        it('isPwaStandalone automatically adds pwa-standalone class to documentElement', () => {
            const mockHtml = { classList: { add: vi.fn(), contains: vi.fn(() => false) } };
            const origDocEl = globalThis.document.documentElement;
            globalThis.document.documentElement = mockHtml;

            window.matchMedia = vi.fn((q) => ({ matches: q.includes('standalone') }));
            expect(window.isPwaStandalone()).toBe(true);
            expect(mockHtml.classList.add).toHaveBeenCalledWith('pwa-standalone');

            globalThis.document.documentElement = origDocEl;
        });

        it('handleNetworkOffline and handleNetworkOnline never trigger showToast popups', () => {
            const toastSpy = vi.fn();
            window.showToast = toastSpy;

            const bannerEl = { classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => true) }, innerText: '' };
            const gridEl = { querySelectorAll: vi.fn(() => [{ classList: { contains: () => false } }]), classList: { add: vi.fn(), remove: vi.fn() } };

            document.getElementById = vi.fn((id) => {
                if (id === 'offlineStickyBanner') return bannerEl;
                if (id === 'itemsGrid') return gridEl;
                return null;
            });

            window.handleNetworkOffline();
            expect(toastSpy).not.toHaveBeenCalled();
            expect(bannerEl.classList.add).toHaveBeenCalledWith('active');

            window.handleNetworkOnline();
            expect(toastSpy).not.toHaveBeenCalled();
            expect(bannerEl.classList.remove).toHaveBeenCalledWith('active');
        });
    });

    describe('28. PWA Standalone Pull-to-Refresh with Rotating Circular Arrow and i18n Label', () => {
        it('validates presence of #pwaPullRefresh capsule and circular SVG arrow in index.html', () => {
            const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            expect(html).toContain('id="pwaPullRefresh"');
            expect(html).toContain('class="pwa-pull-capsule pwa-pull-terminal-box"');
            expect(html).toContain('class="pwa-pull-arrow"');
            expect(html).toContain('class="pwa-pull-bracket"');
            expect(html).toContain('class="pwa-pull-cursor"');
            expect(html).toContain('id="pwaPullLabel"');
            expect(html).toContain('data-i18n="pwa.refresh"');
            expect(html).toContain('ОБНОВИТЬ');
        });

        it('validates CSS scoping to standalone PWA and keyframe spin animation in style.css', () => {
            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('.pwa-pull-refresh');
            expect(css).toContain('html.pwa-standalone .pwa-pull-refresh');
            expect(css).toContain('.pwa-pull-capsule');
            expect(css).toContain('.pwa-pull-arrow');
            expect(css).toContain('@keyframes pwaSpin');
            expect(css).toContain('overscroll-behavior-y: none !important');
        });

        it('isEligibleForPull returns false on standard web and true in standalone PWA at scroll top', () => {
            const pullApi = window.__pwaPullRefresh;
            expect(pullApi).toBeDefined();

            // When NOT in standalone mode
            window.isPwaStandalone = vi.fn(() => false);
            expect(pullApi.isEligibleForPull()).toBe(false);

            // When in standalone mode and scroll at top
            window.isPwaStandalone = vi.fn(() => true);
            window.scrollY = 0;
            globalThis.document.documentElement.scrollTop = 0;
            expect(pullApi.isEligibleForPull()).toBe(true);

            // When user scrolled down
            window.scrollY = 100;
            expect(pullApi.isEligibleForPull()).toBe(false);
            window.scrollY = 0;
        });

        it('getPwaText localizes refresh and refreshing labels across RU, UA, and EN', () => {
            const pullApi = window.__pwaPullRefresh;
            expect(pullApi).toBeDefined();

            window.storage = { get: vi.fn(() => 'ru') };
            expect(pullApi.getPwaText('refresh')).toBe('ОБНОВИТЬ');
            expect(pullApi.getPwaText('refreshing')).toBe('ОБНОВЛЕНИЕ...');

            window.storage = { get: vi.fn(() => 'ua') };
            expect(pullApi.getPwaText('refresh')).toBe('ОНОВИТИ');
            expect(pullApi.getPwaText('refreshing')).toBe('ОНОВЛЕННЯ...');

            window.storage = { get: vi.fn(() => 'en') };
            expect(pullApi.getPwaText('refresh')).toBe('REFRESH');
            expect(pullApi.getPwaText('refreshing')).toBe('REFRESHING...');
        });

        it('triggerRefresh executes window.loadAllItems and triggers success haptic', async () => {
            const pullApi = window.__pwaPullRefresh;
            expect(pullApi).toBeDefined();

            const loadMock = vi.fn().mockResolvedValue([]);
            window.loadAllItems = loadMock;

            const hapticSpy = vi.fn();
            window.triggerHaptic = hapticSpy;

            const refreshPromise = pullApi.triggerRefresh();
            await refreshPromise;
            await new Promise((r) => setTimeout(r, 400));

            expect(loadMock).toHaveBeenCalled();
            expect(hapticSpy).toHaveBeenCalledWith('success');
        });

        it('isRestrictedOrScrollableTarget blocks pull-to-refresh on search dropdown, items, inputs and scrollable boxes', () => {
            const pullApi = window.__pwaPullRefresh;
            expect(pullApi).toBeDefined();
            expect(typeof pullApi.isRestrictedOrScrollableTarget).toBe('function');

            // 1. Elements inside live search dropdown
            const mockSearchItem = {
                closest: vi.fn((sel) => sel.includes('.live-search-item') || sel.includes('#liveSearchDropdown'))
            };
            expect(pullApi.isRestrictedOrScrollableTarget(mockSearchItem)).toBe(true);

            // 2. Elements with data-no-pull or no-pull
            const mockNoPullEl = {
                closest: vi.fn((sel) => sel.includes('.no-pull') || sel.includes('[data-no-pull]'))
            };
            expect(pullApi.isRestrictedOrScrollableTarget(mockNoPullEl)).toBe(true);

            // 3. Normal element in main feed
            const mockFeedEl = {
                closest: vi.fn(() => null),
                hasAttribute: vi.fn(() => false),
                parentElement: null
            };
            expect(pullApi.isRestrictedOrScrollableTarget(mockFeedEl)).toBe(false);
        });

        it('isEligibleForPull returns false when search dropdown is open or search is active', () => {
            const pullApi = window.__pwaPullRefresh;
            expect(pullApi).toBeDefined();

            window.isPwaStandalone = vi.fn(() => true);
            window.scrollY = 0;
            globalThis.document.documentElement.scrollTop = 0;

            // When search-lock is on body
            globalThis.document.body.classList.contains = vi.fn((cls) => cls === 'search-lock');
            expect(pullApi.isEligibleForPull()).toBe(false);

            // When search-lock is off
            globalThis.document.body.classList.contains = vi.fn(() => false);
            expect(pullApi.isEligibleForPull()).toBe(true);

            // When liveSearchDropdown is visible
            const origGetEl = globalThis.document.getElementById;
            globalThis.document.getElementById = vi.fn((id) => {
                if (id === 'liveSearchDropdown') return { style: { display: 'block' } };
                return null;
            });
            expect(pullApi.isEligibleForPull()).toBe(false);

            // Restore
            globalThis.document.getElementById = origGetEl;
        });
    });

    describe('29. Client Error Telemetry (Sentry + Telegram Logger & Anti-Flood)', () => {
        it('exposes window.captureError and window.reportError interfaces', () => {
            expect(typeof window.captureError).toBe('function');
            expect(typeof window.reportError).toBe('function');
            expect(window.reportError).toBe(window.captureError);
        });

        it('sanitizes and redacts sensitive credentials from telemetry context', () => {
            const telemetry = window.__telemetry;
            expect(telemetry).toBeDefined();

            const dirty = {
                action: 'checkout',
                password: 'superSecretPassword123',
                token: 'jwt_token_abc',
                nested: {
                    cardNumber: '4111222233334444',
                    cvv: '123',
                    city: 'Kyiv'
                }
            };

            const clean = telemetry.sanitizeContext(dirty);
            expect(clean.password).toBe('[REDACTED]');
            expect(clean.token).toBe('[REDACTED]');
            expect(clean.nested.cardNumber).toBe('[REDACTED]');
            expect(clean.nested.cvv).toBe('[REDACTED]');
            expect(clean.nested.city).toBe('Kyiv');
            expect(clean.action).toBe('checkout');
        });

        it('correctly filters out noisy browser errors like ResizeObserver, extensions, Script error, and network disconnects', () => {
            const telemetry = window.__telemetry;
            expect(telemetry.isIgnoredError('ResizeObserver loop completed with undelivered notifications')).toBe(true);
            expect(telemetry.isIgnoredError('Failed to fetch')).toBe(true);
            expect(telemetry.isIgnoredError('AbortError: The operation was aborted')).toBe(true);
            expect(telemetry.isIgnoredError('Script error.')).toBe(true);
            expect(telemetry.isIgnoredError('Script error')).toBe(true);
            expect(telemetry.isIgnoredError('Error in extension', '', 'chrome-extension://abc123xyz')).toBe(true);
            expect(telemetry.isIgnoredError('TypeError: Cannot read properties of undefined (reading "id")', 'at renderGrid (catalog.js:2100)')).toBe(false);
        });

        it('cleans URL hash fragments (e.g. Telegram WebApp theme params) from location string', () => {
            const telemetry = window.__telemetry;
            const tgUrl = 'https://nisha-store.shop/#tgWebAppData=query_id%3DAAH&tgWebAppThemeParams=%7B%22bottom_bar_bg_color%22%3A%22%23000000%22%7D';
            const cleanLoc = telemetry.formatCleanLocation(tgUrl);
            expect(cleanLoc).toBe('/');
            expect(cleanLoc).not.toContain('bottom_bar_bg_color');

            const scriptUrl = 'https://nisha-store.shop/js/cart/cart.js?v=1.2#debug';
            expect(telemetry.formatCleanLocation(scriptUrl)).toBe('/js/cart/cart.js');
        });

        it('deduplicates identical errors and prevents flooding backend telemetry endpoint', () => {
            const telemetry = window.__telemetry;
            const postSpy = vi.fn().mockResolvedValue({});
            window.apiClient = { post: postSpy };

            telemetry.reportedErrorHashes.clear();

            const err = new Error('Test fatal crash in payment gateway');
            telemetry.sendTelegramErrorAlert(err, { _forceSend: true, orderId: 999 });
            expect(postSpy).toHaveBeenCalledTimes(1);
            expect(postSpy.mock.calls[0][0]).toBe('/api/support');
            expect(postSpy.mock.calls[0][1].contact).toBe('🚨 SYSTEM_TELEMETRY');
            expect(postSpy.mock.calls[0][1].message).toContain('Test fatal crash in payment gateway');

            // Second call with same error must be suppressed by deduplication
            telemetry.sendTelegramErrorAlert(err, { _forceSend: true, orderId: 999 });
            expect(postSpy).toHaveBeenCalledTimes(1);
        });

        it('includes Sentry fallback CDN in pwa-network.js for adblock resilience', () => {
            const pwaCode = readFileSync(resolve(__dirname, '../js/core/pwa-network.js'), 'utf8');
            expect(pwaCode).toContain('https://browser.sentry-cdn.com/8.38.0/bundle.min.js');
            expect(pwaCode).toContain('https://cdn.jsdelivr.net/npm/@sentry/browser@8.38.0/bundle.min.js');
        });
    });

    describe('30. Realtime New Item Live Insertion & Unified Debounced Toast', () => {
        let origGetElementById;
        let origCreateElement;
        let createdToasts;
        let mockToastContainer;

        beforeEach(() => {
            vi.useFakeTimers();
            origGetElementById = globalThis.document.getElementById;
            origCreateElement = globalThis.document.createElement;

            createdToasts = [];
            mockToastContainer = {
                id: 'toastContainer',
                children: createdToasts,
                appendChild: vi.fn((el) => {
                    createdToasts.push(el);
                    return el;
                }),
                querySelectorAll: vi.fn((sel) => {
                    if (sel.includes('.toast.toast-new-item') || sel.includes('toast')) {
                        return createdToasts;
                    }
                    return [];
                })
            };

            globalThis.document.getElementById = vi.fn((id) => {
                if (id === 'toastContainer') return mockToastContainer;
                return null;
            });

            globalThis.document.createElement = vi.fn((tag) => {
                const el = {
                    tagName: tag.toUpperCase(),
                    className: '',
                    innerHTML: '',
                    style: {},
                    classList: {
                        add: vi.fn((c) => { el.className = `${el.className} ${c}`.trim(); }),
                        remove: vi.fn((c) => { el.className = el.className.replace(c, '').trim(); }),
                        contains: vi.fn((c) => el.className.split(/\s+/).includes(c))
                    },
                    remove: vi.fn(() => {
                        const idx = createdToasts.indexOf(el);
                        if (idx !== -1) createdToasts.splice(idx, 1);
                    }),
                    querySelector: vi.fn((sel) => {
                        if (sel === '.toast-item-tag') {
                            const match = el.innerHTML.match(/<div class="toast-item-tag">([^<]+)<\/div>/);
                            return match ? { textContent: match[1] } : null;
                        }
                        if (sel === '.toast-item-title') {
                            const match = el.innerHTML.match(/<div class="toast-item-title">([^<]+)<\/div>/);
                            return match ? { textContent: match[1] } : null;
                        }
                        return null;
                    })
                };
                return el;
            });
        });

        afterEach(() => {
            vi.useRealTimers();
            globalThis.document.getElementById = origGetElementById;
            globalThis.document.createElement = origCreateElement;
        });

        it('displays exactly 1 unified toast for single new item with "Новые Вещи!!!" tag', () => {
            const item = { id: 'it-1', brand: 'Stone Island', name: 'Nylon Metal Overshirt', price: 4500 };
            window.enqueueNewItemToast(item);

            // Wait for 350ms debounce
            vi.advanceTimersByTime(400);

            const container = document.getElementById('toastContainer');
            const toasts = container.querySelectorAll('.toast.toast-new-item');
            expect(toasts.length).toBe(1);

            const tag = toasts[0].querySelector('.toast-item-tag');
            const title = toasts[0].querySelector('.toast-item-title');
            expect(tag.textContent).toBe('Новые Вещи!!!');
            expect(title.textContent).toContain('Stone Island — Nylon Metal Overshirt');
        });

        it('batches multiple concurrent items into exactly 1 unified toast without spamming', () => {
            const items = [
                { id: 'it-1', brand: 'Arc\'teryx', name: 'Beta LT Jacket', price: 9000 },
                { id: 'it-2', brand: 'Salomon', name: 'XT-6 ADV', price: 6200 },
                { id: 'it-3', brand: 'Oakley', name: 'Software Fleece', price: 3400 }
            ];

            // Enqueue all items concurrently or in rapid succession
            window.enqueueNewItemToast(items[0]);
            window.enqueueNewItemToast(items[1]);
            window.enqueueNewItemToast(items[2]);

            vi.advanceTimersByTime(400);

            const container = document.getElementById('toastContainer');
            const toasts = container.querySelectorAll('.toast.toast-new-item');
            expect(toasts.length).toBe(1);

            const tag = toasts[0].querySelector('.toast-item-tag');
            const title = toasts[0].querySelector('.toast-item-title');
            expect(tag.textContent).toBe('Новые Вещи!!!');
            expect(title.textContent).toBe('+3 новых вещей в каталоге');
        });

        it('verifies smooth new arrival animation in style.css and live insertion logic in catalog.js', () => {
            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('@keyframes itemCardNewArrival');
            expect(css).toContain('.item-card.item-card-new-arrival');
            expect(css).toContain('cubic-bezier');

            const catalogCode = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
            expect(catalogCode).toContain('function insertNewItemCardSmoothly');
            expect(catalogCode).toContain('card.classList.add(\'item-card-new-arrival\')');
            expect(catalogCode).toContain('window.insertNewItemCardSmoothly = insertNewItemCardSmoothly');
            expect(catalogCode).toContain('enqueueNewItemToast(freshNewArrivals)');
            expect(catalogCode).toContain('window._notifiedItemIds');
        });
    });

    describe('31. Strict Nova Poshta Branch & City Validation and Mobile Touch Selection', () => {
        it('binds both onmousedown and onclick for touchscreen mobile branch selection in cart.js', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('div.onmousedown = selectBranchItem;');
            expect(cartCode).toContain('div.onclick = selectBranchItem;');
            expect(cartCode).toContain('div.onmousedown = selectCityItem;');
            expect(cartCode).toContain('div.onclick = selectCityItem;');
        });

        it('strictly blocks order submission in executeOrderFinal and confirmEmailPrompt if city or branch is missing', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('if (!city || !cityRef)');
            expect(cartCode).toContain('if (!branch || !branchRef)');
            expect(cartCode).toContain('isOrderSubmitting = false;');
            expect(cartCode).toContain('resetSubmitButton();');
        });

        it('prevents fallback to direct Supabase RPC when server returns 400 validation error', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('errMsg.includes(\'отделение\')');
            expect(cartCode).toContain('errMsg.includes(\'город\')');
            expect(cartCode).toContain('errMsg.includes(\'проверки данных\')');
        });

        it('normalizes city prefixes including г./гор./город and matches MainDescription in ensureCityRef', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('г\\.|гор\\.|город');
            expect(cartCode).toContain('_npStripPrefix(a.MainDescription) === wantedName');
            expect(cartCode).toContain('cleanTyped');
        });

        it('exposes window.getActiveCart and window.setActiveCart for cross-module reliability', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('window.getActiveCart = getActiveCart;');
            expect(cartCode).toContain('window.setActiveCart = setActiveCart;');

            const productCode = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');
            expect(productCode).toContain('window.getActiveCart');
            expect(productCode).toContain('String(i.id) === String(item.id)');
        });

        it('auto-unlocks branch input and pre-caches branches upon city detection or saved draft', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('window.selectedSettlementRef = cityObj.Ref || \'\'');
            expect(cartCode).toContain('branchInput._unlockBound');
        });

        it('defaults showDropdown to false in loadNPBranches to prevent auto-opening dropdown on checkout load', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('async function loadNPBranches(searchString = "", showDropdown = false)');
            expect(cartCode).toContain('loadNPBranches("", false)');

            const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            expect(html).toContain('onfocus="loadNPBranches(\'\', true)"');
            expect(html).toContain('enterkeyhint="done"');
            expect(html).toContain('enterkeyhint="next"');
        });

        it('binds keydown Enter handler on branch and city inputs to dismiss dropdown and blur mobile keyboard', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('branchInput._enterBound');
            expect(cartCode).toContain('cityInput._enterBound');
            expect(cartCode).toContain('e.key === \'Enter\'');
            expect(cartCode).toContain('branchInput.blur()');
            expect(cartCode).toContain('cityInput.blur()');
        });

        it('optimizes dropdown DOM rendering with MAX_RENDERED_BRANCHES limit and instant in-memory filtering', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('const MAX_RENDERED_BRANCHES = 50;');
            expect(cartCode).toContain('Math.min(branches.length, MAX_RENDERED_BRANCHES)');
            expect(cartCode).toContain('npBranchCache[cityRef + "_"]');
        });

        it('parses complex addresses with region commas and branch markers using parseDeliveryAddress', () => {
            const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            expect(helpersCode).toContain('function parseDeliveryAddress');
            expect(helpersCode).toContain('markerMatch');

            // Evaluate parseDeliveryAddress logic directly
            const fn = new Function(`${helpersCode}; return parseDeliveryAddress;`)();
            const res1 = fn('м. Кривий Ріг, Дніпропетровська обл., Відділення №25');
            expect(res1.city).toBe('м. Кривий Ріг, Дніпропетровська обл.');
            expect(res1.branch).toBe('Відділення №25');

            const res2 = fn('м. Кривий Ріг, Дніпропетровська обл., Поштомат 5040');
            expect(res2.city).toBe('м. Кривий Ріг, Дніпропетровська обл.');
            expect(res2.branch).toBe('Поштомат 5040');

            const res3 = fn('Київ, Відділення 12');
            expect(res3.city).toBe('Київ');
            expect(res3.branch).toBe('Відділення 12');
        });

        it('applies profile delivery address in checkout without ever auto-opening city/branch lists', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('Адрес из профиля пользователя');
            expect(cartCode).toContain('function matchAndSetBranchRef');
            expect(cartCode).toContain('function hideNPDropdowns');
            expect(cartCode).toContain('async function ensureCityRef(opts = {})');
            expect(cartCode).toContain('const interactive = !!(opts && opts.interactive)');
            expect(cartCode).toContain('if (interactive) renderCitySearchResults(data)');
            expect(cartCode).toContain('ensureCityRef({ interactive: showDropdown })');
            expect(cartCode).toContain('const alreadyFilled');
        });

        it('does not let GeoIP overwrite the city and never opens the city list from autoDetectCity', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('GeoIP не должен перетирать выбор');
            expect(cartCode).toContain('ensureCityRef().then(() => hideNPDropdowns())');
            expect(cartCode).not.toContain('searchNPCity(detectedCity)');
        });

        it('protects promo field from browser autofill of the full name', () => {
            const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            expect(html).toMatch(/id=promoInput[^>]*autocomplete=off/);
            expect(html).toMatch(/id=promoInput[^>]*name=promo_code/);
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('function sanitizePromoField');
            expect(cartCode).toContain('setTimeout(sanitizePromoField, 1500)');

            const profileCode = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf8');
            expect(profileCode).toContain('window.resetCheckoutAddressState');
        });

        it('guards IDBDatabase operations against closing connections and ignores connection closure in telemetry', () => {
            const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
            expect(helpersCode).toContain('db.onclose = () => { _dbPromise = null; };');
            expect(helpersCode).toContain('db.onversionchange');

            const pwaCode = readFileSync(resolve(__dirname, '../js/core/pwa-network.js'), 'utf8');
            expect(pwaCode).toContain('/database connection is closing/i');
            expect(pwaCode).toContain('/IDBDatabase/i');
        });

        it('routes review submissions via apiClient.post(/api/reviews) to bypass RLS with service_role and provides Supabase fallback', () => {
            const reviewsCode = readFileSync(resolve(__dirname, '../js/reviews/reviews.js'), 'utf8');
            expect(reviewsCode).toContain("window.apiClient.post('/api/reviews', payload");
            expect(reviewsCode).toContain("window.sendReviewPayload = sendReviewPayload;");
            expect(reviewsCode).toContain("sendReviewPayload(payload)");
            expect(reviewsCode).toContain("window.apiClient.get('/api/reviews'");
            expect(reviewsCode).toContain("sb.from('reviews').insert");
            expect(reviewsCode).toContain("is_published: true");
        });

        it('inserts new realtime items below pinned TOP items using the same comparator as applyFilters', () => {
            const catalogCode = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
            expect(catalogCode).toContain('function getCatalogItemComparator');
            expect(catalogCode).toContain('window.getCatalogItemComparator = getCatalogItemComparator');
            expect(catalogCode).toContain('list.findIndex(existing => cmp(item, existing) < 0)');
            expect(catalogCode).toContain('list.splice(insertIdx, 0, item)');
            // Больше нет слепой вставки новинки в самый верх сетки
            expect(catalogCode).not.toContain('grid.prepend(card)');
            expect(catalogCode).not.toContain('window.filteredItems.unshift(item)');
        });

        it('re-renders the catalog when crossing the 900px breakpoint so desktop never stays stuck on 12 items without pagination', () => {
            const catalogCode = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
            expect(catalogCode).toContain('initCatalogBreakpointWatcher');
            expect(catalogCode).toContain('window._catalogRenderedAsMobile = isMobile');
            expect(catalogCode).toContain("window.addEventListener('resize', scheduleCheck");
            expect(catalogCode).toContain("matchMedia('(max-width: 900px)')");
            expect(catalogCode).toContain('totalPagesGuard');
        });

        it('protects the proposal item-name field from browser autofill of the buyer full name', () => {
            const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            expect(html).toMatch(/id=propName[^>]*name=prop_item_title/);
            expect(html).toMatch(/id=propName[^>]*autocomplete=off/);
            const dropCode = readFileSync(resolve(__dirname, '../js/drop/drop.js'), 'utf8');
            expect(dropCode).toContain('function sanitizeProposalNameField');
            expect(dropCode).toContain('[0, 150, 400, 900, 1800].forEach(ms => setTimeout(sanitizeProposalNameField, ms))');
            expect(dropCode).toContain("dataset.userTyped = '1'");
        });

        it('matches and ranks branches and postomats by number without false positives on weight limits', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            eval(cartCode);

            expect(typeof window.parseNPBranchQuery).toBe('function');
            expect(typeof window.filterAndSortBranches).toBe('function');
            expect(typeof window.extractBranchNumber).toBe('function');

            // 1. Query parsing for numbers & postomats
            const q6745 = window.parseNPBranchQuery('6745');
            expect(q6745.isPureNumber).toBe(true);
            expect(q6745.number).toBe('6745');
            expect(q6745.apiSearch).toBe('№6745');

            const qPost = window.parseNPBranchQuery('почтомат 6745');
            expect(qPost.isPureNumber).toBe(true);
            expect(qPost.wantsPostomat).toBe(true);
            expect(qPost.apiSearch).toBe('№6745');

            // 2. Filtering and ranking: ignores "(до 30 кг)" when searching "30" and puts exact № first
            const sampleBranches = [
                { Ref: '1', Description: 'Відділення №1: вул. Пирогівський шлях, 135', TypeOfWarehouse: 'regular' },
                { Ref: '3', Description: 'Відділення №3 (до 30 кг на одне місце): вул. Слобожанська, 13', TypeOfWarehouse: 'regular' },
                { Ref: '250', Description: 'Відділення №250 (до 10 кг): вул. Чикаленка, 45', TypeOfWarehouse: 'regular' },
                { Ref: '25-street', Description: 'Відділення №19: вул. Райдужна, 25Б', TypeOfWarehouse: 'regular' },
                { Ref: '25-exact', Description: "Відділення №25 (до 30 кг): вул. Левка Лук'яненка, 9", TypeOfWarehouse: 'regular' },
                { Ref: '30-exact', Description: 'Відділення №30 (до 30 кг): просп. Берестейський, 20', TypeOfWarehouse: 'regular' },
                { Ref: '6745-post', Description: 'Поштомат "Нова Пошта" №6745: вул. Євгена Сверстюка, 2а', TypeOfWarehouse: 'f9316480-5f2d-425d-bc2c-ac7cd29decf0' }
            ];

            const res6745 = window.filterAndSortBranches(sampleBranches, '6745');
            expect(res6745.length).toBe(1);
            expect(res6745[0].Ref).toBe('6745-post');

            const res30 = window.filterAndSortBranches(sampleBranches, '30');
            expect(res30.length).toBe(1);
            expect(res30[0].Ref).toBe('30-exact');

            const res25 = window.filterAndSortBranches(sampleBranches, '25');
            expect(res25[0].Ref).toBe('25-exact');
            expect(res25[1].Ref).toBe('250');
            expect(res25[2].Ref).toBe('25-street');
        });

        it('provides touch tap selection, keyboard viewport adaptation, and clear buttons for NP fields', () => {
            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain('function bindTouchTapSelect');
            expect(cartCode).toContain('function scrollNPFieldIntoModalView');
            expect(cartCode).toContain('function clearNPBranchInput');
            expect(cartCode).toContain('function clearNPCityInput');
            expect(cartCode).toContain('scrollIntoView');
            expect(cartCode).toContain('PointerEvent');

            const windowsCode = readFileSync(resolve(__dirname, '../js/ui/windows.js'), 'utf8');
            expect(windowsCode).toContain('function initMobileKeyboardViewport');
            expect(windowsCode).toContain("e.target.closest('.custom-dropdown')");
            expect(windowsCode).toContain("e.target.closest('#branchDropdown')");

            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('html.keyboard-open .modal-overlay');
            expect(css).toContain('.np-clear-btn');
            expect(css).toContain('flex-shrink: 0 !important');
            expect(css).toContain('min-height: 48px');

            expect(cartCode).toContain('_autofillShieldBound');
            expect(cartCode).toContain('_lastExplicitValue');

            const indexHtml = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            expect(indexHtml).toContain('name=nisha_order_city');
            expect(indexHtml).toContain('name=nisha_order_branch');
            expect(indexHtml).toContain('data-lpignore="true"');
        });

        it('30. NP empty branch localization (ru, ua, en) and smooth keyboard scroll dismissal', () => {
            const ruJson = JSON.parse(readFileSync(resolve(__dirname, '../locales/ru.json'), 'utf8'));
            const uaJson = JSON.parse(readFileSync(resolve(__dirname, '../locales/ua.json'), 'utf8'));
            const enJson = JSON.parse(readFileSync(resolve(__dirname, '../locales/en.json'), 'utf8'));
            const publicRu = JSON.parse(readFileSync(resolve(__dirname, '../public/locales/ru.json'), 'utf8'));
            const publicUa = JSON.parse(readFileSync(resolve(__dirname, '../public/locales/ua.json'), 'utf8'));
            const publicEn = JSON.parse(readFileSync(resolve(__dirname, '../public/locales/en.json'), 'utf8'));

            const getNP = (json) => (json.translation && json.translation.np) || json.np;

            expect(getNP(ruJson).branch_empty).toBe('Не найдено');
            expect(getNP(ruJson).brauch_empty).toBe('Не найдено');
            expect(getNP(ruJson).not_found).toBe('Не найдено');
            expect(getNP(publicRu).branch_empty).toBe('Не найдено');

            expect(getNP(uaJson).branch_empty).toBe('Не знайдено');
            expect(getNP(uaJson).brauch_empty).toBe('Не знайдено');
            expect(getNP(uaJson).not_found).toBe('Не знайдено');
            expect(getNP(publicUa).branch_empty).toBe('Не знайдено');

            expect(getNP(enJson).branch_empty).toBe('Not found');
            expect(getNP(enJson).brauch_empty).toBe('Not found');
            expect(getNP(enJson).not_found).toBe('Not found');
            expect(getNP(publicEn).branch_empty).toBe('Not found');

            const cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
            expect(cartCode).toContain("i18next.t('np.branch_empty', { defaultValue: 'Не найдено' })");
            expect(cartCode).toContain("i18next.t('np.searching'");
            expect(cartCode).toContain('bindDropdownScrollDismissKeyboard');
            expect(cartCode).toContain('diffY > 24 && diffY > diffX');

            const profileCode = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf8');
            expect(profileCode).toContain("i18next.t('np.branch_empty', { defaultValue: 'Не найдено' })");

            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('transition: max-height 0.28s cubic-bezier(0.2, 0.8, 0.25, 1);');

            const windowsCode = readFileSync(resolve(__dirname, '../js/ui/windows.js'), 'utf8');
            expect(windowsCode).toContain('const isKeyboardOpen = kbDelta > 90 || (isInputFocused && kbDelta > 40);');

            const indexHtml = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            expect(indexHtml).toContain('id=authUsername class=auth-input');
            expect(indexHtml).toContain('id=authEmail class=auth-input');
            expect(indexHtml).toContain('id=authPass class=auth-input');
        });

        it('31. History items HOT badge arrow SVG and desktop PC seamless marquee banner', () => {
            const productCode = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');
            // History badge must contain the HOT trending arrow SVG matching the feed
            expect(productCode).toContain('polyline points="23 6 13.5 15.5 8.5 10.5 1 18"');
            expect(productCode).toContain('polyline points="17 6 23 6 23 12"');
            expect(productCode).toContain('history-status-bar');
            expect(productCode).toContain('${chartSvg} HOT');

            // CSS must provide custom sizing for history-status-bar
            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('.history-status-bar');
            expect(css).toContain('animation: marquee-scroll 45s linear infinite;');

            // HTML must contain sufficient marquee copies for seamless full-width PC monitors
            const indexHtml = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
            const marqueeMatches = indexHtml.match(/class="?marquee-content"?/g) || [];
            expect(marqueeMatches.length).toBeGreaterThanOrEqual(8);
        });

        it('32. Search input custom I-beam cursor and search results dropdown custom pointer on PC desktop', () => {
            const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
            expect(css).toContain('.search-input');
            expect(css).toContain('caret-color: var(--accent-green)');
            // Ensure .search-input has the custom I-beam cursor with hotspot 12 12, text
            expect(css).toContain('12 12, text !important');
            // Ensure .live-search-item and search results dropdown have the custom red arrow pointer cursor
            expect(css).toContain('.live-search-item');
            expect(css).toContain('.live-search-dropdown');
            expect(css).toMatch(/\.live-search-item[^}]*cursor:\s*url\(/);
        });
    });
});
