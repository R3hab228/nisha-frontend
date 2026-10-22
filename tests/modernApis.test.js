import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { readFileSync } from 'fs';
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
            body: { style: { overflow: '' } },
            getElementById: vi.fn(() => null),
            querySelector: vi.fn(() => null),
            querySelectorAll: vi.fn(() => []),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            createElement: vi.fn(() => ({
                style: {},
                classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
                setAttribute: vi.fn(),
                appendChild: vi.fn(),
                remove: vi.fn()
            }))
        };

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

        it('generateMeasurementSchemeSvg uses crypto.randomUUID for unique SVG marker IDs', () => {
            const svg1 = window.generateMeasurementSchemeSvg('tshirt', { shoulders: 50, chest: 55, length: 70 }, 'ru');
            const svg2 = window.generateMeasurementSchemeSvg('tshirt', { shoulders: 50, chest: 55, length: 70 }, 'ru');
            
            const match1 = svg1.match(/id="(arrowG_[a-zA-Z0-9]+)"/);
            const match2 = svg2.match(/id="(arrowG_[a-zA-Z0-9]+)"/);
            
            expect(match1).not.toBeNull();
            expect(match2).not.toBeNull();
            expect(match1[1]).not.toBe(match2[1]);
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
});
