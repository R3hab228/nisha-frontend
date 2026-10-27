import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Security Sanitization & XSS Shield', () => {
    beforeEach(() => {
        // Execute helpers.js in a clean window context
        global.window = global.window || {};
        const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        eval(helpersCode);
    });

    it('escapeHtml escapes dangerous HTML characters (<, >, ", \', &)', () => {
        const { escapeHtml } = window;
        expect(typeof escapeHtml).toBe('function');
        
        const payload = '<script>alert("XSS")</script>&\'hello\'';
        const escaped = escapeHtml(payload);
        
        expect(escaped).not.toContain('<');
        expect(escaped).not.toContain('>');
        expect(escaped).not.toContain('"');
        expect(escaped).not.toContain("'");
        expect(escaped).toContain('&lt;script&gt;');
        expect(escaped).toContain('&quot;XSS&quot;');
        expect(escaped).toContain('&#39;hello&#39;');
    });

    it('escapeJsString safely neutralizes quotes and script breakouts for inline JS handlers', () => {
        const { escapeJsString } = window;
        expect(typeof escapeJsString).toBe('function');

        const maliciousImg = "https://evil.com/img.jpg'); alert('XSS');//";
        const safe = escapeJsString(maliciousImg);
        
        expect(safe).toContain("\\');");
        expect(safe).toContain("\\'");
    });

    it('apiClient transparently injects Authorization Bearer token from Supabase session', async () => {
        // Mock Supabase session
        window._supabase = {
            auth: {
                getSession: vi.fn().mockResolvedValue({
                    data: {
                        session: {
                            access_token: 'fake-jwt-token-12345'
                        }
                    }
                })
            }
        };

        const originalFetch = global.fetch;
        let capturedHeaders = null;
        global.fetch = vi.fn().mockImplementation((url, opts) => {
            capturedHeaders = opts.headers;
            return Promise.resolve(new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
        });

        try {
            // Load apiClient.js
            const clientCode = readFileSync(resolve(__dirname, '../js/core/apiClient.js'), 'utf8');
            eval(clientCode);

            await window.apiClient.post('/api/link-orders', { userId: 'u1', phone: '0991234567' });

            expect(capturedHeaders).toBeDefined();
            expect(capturedHeaders.get('Authorization')).toBe('Bearer fake-jwt-token-12345');
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('handleDelegatedAction dispatches data-action events cleanly and respects disabled state', () => {
        const { handleDelegatedAction } = window;
        expect(typeof handleDelegatedAction).toBe('function');

        window.openProductModalById = vi.fn();
        window.removeHistoryItem = vi.fn();
        window.copyTTN = vi.fn();
        window.promptOrderReview = vi.fn();
        window.closeModal = vi.fn();
        window.changePage = vi.fn();

        // 1. open-product
        const openEl = {
            disabled: false,
            hasAttribute: () => false,
            getAttribute: (k) => (k === 'data-action' ? 'open-product' : k === 'data-id' ? 'item-99' : null)
        };
        handleDelegatedAction({ target: { closest: () => openEl } });
        expect(window.openProductModalById).toHaveBeenCalledWith('item-99');

        // 2. remove-history-item stops propagation and calls removeHistoryItem
        const stopProp = vi.fn();
        const rmHistEl = {
            disabled: false,
            hasAttribute: () => false,
            getAttribute: (k) => (k === 'data-action' ? 'remove-history-item' : k === 'data-id' ? 'hist-42' : null)
        };
        const fakeEvent = { target: { closest: () => rmHistEl }, stopPropagation: stopProp };
        handleDelegatedAction(fakeEvent);
        expect(stopProp).toHaveBeenCalled();
        expect(window.removeHistoryItem).toHaveBeenCalledWith(fakeEvent, 'hist-42');

        // 3. prompt-order-review passes all 4 data-* attributes
        const revEl = {
            disabled: false,
            hasAttribute: () => false,
            getAttribute: (k) => ({
                'data-action': 'prompt-order-review',
                'data-order-id': 'ord-1',
                'data-item-name': 'Rick Owens Jacket',
                'data-item-img': 'https://cdn/img.webp',
                'data-item-id': 'item-1'
            }[k] || null)
        };
        handleDelegatedAction({ target: { closest: () => revEl } });
        expect(window.closeModal).toHaveBeenCalledWith('ordersModal');
        expect(window.promptOrderReview).toHaveBeenCalledWith('ord-1', 'Rick Owens Jacket', 'https://cdn/img.webp', 'item-1');

        // 4. Disabled button is ignored
        const disabledPageBtn = {
            disabled: true,
            hasAttribute: (k) => k === 'disabled',
            getAttribute: (k) => (k === 'data-action' ? 'change-page' : k === 'data-dir' ? '-1' : null)
        };
        handleDelegatedAction({ target: { closest: () => disabledPageBtn } });
        expect(window.changePage).not.toHaveBeenCalled();
    });

    it('handleDelegatedMediaLoad, handleDelegatedMediaError, handleDelegatedMediaCanPlay and handleDelegatedScroll work cleanly', () => {
        const {
            handleDelegatedMediaLoad,
            handleDelegatedMediaError,
            handleDelegatedMediaCanPlay,
            handleDelegatedScroll
        } = window;

        // 1. Card image load removes loading class and sets opacity=1
        const parentSlide = {
            classList: { remove: vi.fn(), add: vi.fn() }
        };
        const cardImg = {
            classList: { contains: (c) => c === 'card-slide-img' },
            style: { opacity: '0' },
            parentElement: parentSlide
        };
        handleDelegatedMediaLoad({ target: cardImg });
        expect(cardImg.style.opacity).toBe('1');
        expect(parentSlide.classList.remove).toHaveBeenCalledWith('img-8bit-loading');
        expect(parentSlide.classList.add).toHaveBeenCalledWith('img-8bit-loaded');

        // 2. Card image error first retries fallbackSrc, then shows NO SIGNAL on second error
        const errImg = {
            classList: { contains: (c) => c === 'card-slide-img' },
            dataset: { fallbackSrc: 'https://cdn/fallback.jpg' },
            src: 'https://cdn/broken-thumb.webp',
            outerHTML: '',
            parentElement: { classList: { remove: vi.fn() } }
        };
        handleDelegatedMediaError({ target: errImg });
        expect(errImg.dataset.fb).toBe('1');
        expect(errImg.src).toBe('https://cdn/fallback.jpg');

        // Second error after fallback already tried
        handleDelegatedMediaError({ target: errImg });
        expect(errImg.outerHTML).toContain('NO SIGNAL');

        // 3. Video canplay reveals grid-lazy-video
        const gridVideo = {
            classList: { contains: (c) => c === 'grid-lazy-video' },
            style: { opacity: '0' },
            parentElement: { classList: { remove: vi.fn(), add: vi.fn() } }
        };
        handleDelegatedMediaCanPlay({ target: gridVideo });
        expect(gridVideo.style.opacity).toBe('1');
        expect(gridVideo.parentElement.classList.remove).toHaveBeenCalledWith('img-8bit-loading');

        // 4. Delegated scroll calls updateCardDots
        window.updateCardDots = vi.fn();
        const sliderEl = {
            classList: { contains: (c) => c === 'card-slider-container' },
            getAttribute: (k) => (k === 'data-item-id' ? 'item-777' : null),
            id: 'slider-item-777'
        };
        handleDelegatedScroll({ target: sliderEl });
        expect(window.updateCardDots).toHaveBeenCalledWith(sliderEl, 'item-777');
    });

    it('orders.js lazy chunk initializes and resolves order images and tab counters accurately', () => {
        const ordersCode = readFileSync(resolve(__dirname, '../js/orders/orders.js'), 'utf8');
        eval(ordersCode);

        expect(typeof window.openOrdersModal).toBe('function');
        expect(typeof window.updateOrderTabCounters).toBe('function');
        expect(typeof window.getOrderItemImage).toBe('function');
        expect(typeof window.renderFilteredOrders).toBe('function');

        window.toCDN = (u) => u;
        const resolved = window.getOrderItemImage({ id: 'i1', image: 'https://cdn.nisha.Vintage/jacket.webp' });
        expect(resolved).toBe('https://cdn.nisha.Vintage/jacket.webp');
    });

    it('storage.getJSON and storage.setJSON safely serialize, parse and handle corrupted localStorage entries', () => {
        const mem = {};
        window.localStorage = {
            getItem: (k) => (k in mem ? mem[k] : null),
            setItem: (k, v) => { mem[k] = String(v); },
            removeItem: (k) => { delete mem[k]; }
        };

        const { storage } = window;
        expect(storage).toBeDefined();
        expect(typeof storage.getJSON).toBe('function');
        expect(typeof storage.setJSON).toBe('function');

        storage.setJSON('nisha_test_key', { a: 1, items: ['x', 'y'] });
        expect(storage.getJSON('nisha_test_key', {})).toEqual({ a: 1, items: ['x', 'y'] });
        expect(storage.has('nisha_test_key')).toBe(true);

        storage.set('nisha_str_key', 'hello_world');
        expect(storage.get('nisha_str_key')).toBe('hello_world');
        expect(storage.has('nisha_non_existent')).toBe(false);

        window.localStorage.setItem('nisha_corrupted_key', '{not-valid-json');
        expect(storage.getJSON('nisha_corrupted_key', ['fallback'])).toEqual(['fallback']);

        storage.remove('nisha_test_key');
        storage.remove('nisha_str_key');
        storage.remove('nisha_corrupted_key');
        expect(storage.getJSON('nisha_test_key', null)).toBeNull();
        expect(storage.has('nisha_test_key')).toBe(false);
    });

    it('unified profile contacts render Phone and Telegram badges and action buttons accurately', () => {
        const els = {};
        const prevDoc = global.document;
        global.document = {
            readyState: 'complete',
            addEventListener: vi.fn(),
            getElementById: (id) => {
                if (!els[id]) {
                    els[id] = { innerHTML: '', style: { display: '' }, value: '' };
                }
                return els[id];
            },
            querySelectorAll: () => []
        };
        window.addEventListener = window.addEventListener || vi.fn();

        try {
            const profileCode = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf8');
            eval(profileCode);

            window.renderProfilePhone('+380991112233');
            expect(els['profilePhone'].innerHTML).toContain('+380991112233');
            expect(els['profilePhone'].innerHTML).toContain('data-action="remove-profile-phone"');
            expect(els['profileAddPhoneBtn'].style.display).toBe('none');

            window.renderProfileTg('nisha_vintage');
            expect(els['profileTg'].innerHTML).toContain('@nisha_vintage');
            expect(els['profileTg'].innerHTML).toContain('data-action="remove-profile-tg"');
            expect(els['profileAddTgBtn'].style.display).toBe('none');

            window.renderProfileTg('');
            expect(els['profileTg'].style.display).toBe('none');
            expect(els['profileAddTgBtn'].style.display).toBe('inline-block');
        } finally {
            global.document = prevDoc;
        }
    });

    it('generateShortId and copyToClipboard use modern Web Crypto and Clipboard APIs', async () => {
        const id1 = window.generateShortId(9);
        const id2 = window.generateShortId(9);
        expect(typeof id1).toBe('string');
        expect(id1.length).toBe(9);
        expect(id1).not.toBe(id2);

        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        const prevClipboard = globalThis.navigator?.clipboard;
        Object.defineProperty(globalThis.navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            configurable: true,
            writable: true
        });
        try {
            const ok = await window.copyToClipboard('20450999887766', null);
            expect(ok).toBe(true);
            expect(writeTextMock).toHaveBeenCalledWith('20450999887766');
        } finally {
            Object.defineProperty(globalThis.navigator, 'clipboard', {
                value: prevClipboard,
                configurable: true,
                writable: true
            });
        }
    });

    it('isElementVisible uses inline styles and Element.checkVisibility without unnecessary getComputedStyle', () => {
        const prevDoc = global.document;
        global.document = {
            readyState: 'complete',
            addEventListener: vi.fn(),
            querySelectorAll: () => [],
            getElementById: () => null
        };
        try {
            const winCode = readFileSync(resolve(__dirname, '../js/ui/windows.js'), 'utf8');
            eval(winCode);

            expect(window.isElementVisible(null)).toBe(false);
            expect(window.isElementVisible({ style: { display: 'none' } })).toBe(false);
            expect(window.isElementVisible({ style: { display: 'flex' } })).toBe(true);

            const checkVisSpy = vi.fn().mockReturnValue(true);
            expect(window.isElementVisible({ style: { display: '' }, checkVisibility: checkVisSpy })).toBe(true);
            expect(checkVisSpy).toHaveBeenCalledWith({ checkOpacity: true, checkVisibilityCSS: true });
        } finally {
            global.document = prevDoc;
        }
    });

    it('privacy-first analytics service (Plausible / PostHog / TikTok facade) tracks funnel events cleanly', () => {
        const analyticsCode = readFileSync(resolve(__dirname, '../js/core/analytics.js'), 'utf8');
        eval(analyticsCode);

        const plausibleSpy = vi.fn();
        const posthogSpy = { capture: vi.fn() };
        const ttqSpy = { track: vi.fn() };

        window.plausible = plausibleSpy;
        window.posthog = posthogSpy;
        window.ttq = ttqSpy;

        const testItem = { id: 'item-42', brand: 'Stone Island', name: 'Jacket', price: 4500, category: 'jackets', size: 'L' };

        window.analytics.trackProductView(testItem);
        expect(plausibleSpy).toHaveBeenCalledWith('Product Viewed', {
            props: expect.objectContaining({ item_id: 'item-42', brand: 'Stone Island', price: 4500 })
        });
        expect(posthogSpy.capture).toHaveBeenCalledWith('Product Viewed', expect.objectContaining({ item_id: 'item-42' }));
        expect(ttqSpy.track).toHaveBeenCalledWith('ViewContent', expect.objectContaining({ content_id: 'item-42', value: 4500 }));

        window.analytics.trackAddToCart(testItem);
        expect(plausibleSpy).toHaveBeenCalledWith('Add to Cart', {
            props: expect.objectContaining({ item_id: 'item-42', price: 4500 })
        });

        window.analytics.trackCheckoutStart([testItem]);
        expect(plausibleSpy).toHaveBeenCalledWith('Checkout Started', {
            props: expect.objectContaining({ items_count: 1, cart_value: 4500 })
        });

        window.analytics.trackPurchase({ orderId: 'ord-99', items: [testItem], value: 4500, paymentMethod: 'Полная предоплата' });
        expect(plausibleSpy).toHaveBeenCalledWith('Order Completed', {
            props: expect.objectContaining({ order_id: 'ord-99', revenue: 4500 })
        });
        expect(ttqSpy.track).toHaveBeenCalledWith('CompletePayment', expect.objectContaining({ value: 4500 }));
    });

    it('bottom modals in index.html have zero inline onclick handlers and use data-action delegation', () => {
        const htmlContent = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
        const bottomModalsHtml = htmlContent.slice(htmlContent.indexOf('id=proposeModal'));
        expect(bottomModalsHtml.length).toBeGreaterThan(100);
        expect(bottomModalsHtml).not.toMatch(/\bonclick\s*=/i);
        expect(bottomModalsHtml).toContain('data-action=close-modal');
        expect(bottomModalsHtml).toContain('data-action=submit-proposal');
        expect(bottomModalsHtml).toContain('data-action=submit-manual-review');
        expect(bottomModalsHtml).toContain('data-action=submit-auto-review');
        expect(bottomModalsHtml).toContain('data-action=submit-support-ticket');
    });

    it('isolates Driver.js onboarding popover header and footer from global site header/footer CSS rules', () => {
        const cssContent = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
        expect(cssContent).toContain('header:not(.driver-popover-title)');
        expect(cssContent).toContain('footer:not(.driver-popover-footer)');
        expect(cssContent).toContain('header.driver-popover-title');
        expect(cssContent).toContain('footer.driver-popover-footer');
    });

    it('catalog.js wires Supabase Realtime postgres_changes on items and updates badges (TOP, HOT, SALE, SOLD, RESERVED) without reload', () => {
        const catalogCode = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
        expect(catalogCode).toContain("sb.channel('public-items-live-feed')");
        expect(catalogCode).toContain("table: 'items'");
        expect(catalogCode).toContain('function handleRealtimeCatalogEvent');
        expect(catalogCode).toContain('function initCatalogRealtimeSubscription');
        expect(catalogCode).toContain("new BroadcastChannel('nisha_catalog_sync')");
        expect(catalogCode).toContain('status-top');
        expect(catalogCode).toContain('status-sale');
        expect(catalogCode).toContain('status-hot');
        expect(catalogCode).toContain('sold-badge');
        expect(catalogCode).toContain('reserved-badge');
    });

    it('measurement scheme excision: button, delegated action, CSS and modal logic are completely removed', () => {
        // 1. Verify index.html does NOT contain the scheme button
        const htmlContent = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
        expect(htmlContent).not.toContain('measure-scheme-btn');
        expect(htmlContent).not.toContain('data-action="open-measure-scheme"');
        expect(htmlContent).not.toContain('data-i18n="product.measure_scheme_btn"');

        // 2. Verify locales do NOT contain scheme keys
        const locales = JSON.parse(readFileSync(resolve(__dirname, '../locales.json'), 'utf8'));
        expect(locales.ru.translation.product.measure_scheme_btn).toBeUndefined();
        expect(locales.ua.translation.product.measure_scheme_btn).toBeUndefined();
        expect(locales.en.translation.product.measure_scheme_btn).toBeUndefined();

        // 3. Verify CSS does NOT contain scheme classes
        const cssContent = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
        expect(cssContent).not.toContain('.measure-scheme-btn');

        // 4. Verify helpers.js does NOT contain scheme action
        const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        expect(helpersCode).not.toContain("case 'open-measure-scheme':");
        expect(helpersCode).not.toContain('window.showMeasurementSchemeModal');

        // 5. Verify product.js does NOT contain scheme functions
        const productCode = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');
        expect(productCode).not.toContain('function detectItemClothingType');
        expect(productCode).not.toContain('function parseItemMeasurementParams');
        expect(productCode).not.toContain('function generateMeasurementSchemeSvg');
        expect(productCode).not.toContain('function showMeasurementSchemeModal');
    });

    it('showToast sanitizes XSS payloads in message and imgUrl', () => {
        const appended = [];
        const prevDoc = global.document;
        global.document = {
            getElementById: (id) => (id === 'toastContainer' ? { appendChild: (el) => appended.push(el) } : null),
            createElement: () => ({ className: '', style: {}, innerHTML: '', remove: vi.fn() })
        };
        try {
            window.showToast(
                'Hello <script>alert(1)</script><img src=x onerror="alert(2)">',
                'success',
                "https://evil.com/a.jpg'); background:red; ('"
            );
            expect(appended.length).toBe(1);
            const html = appended[0].innerHTML;
            expect(html).not.toContain('<script>');
            expect(html).not.toContain('onerror=');
            expect(html).not.toContain("a.jpg')");
        } finally {
            global.document = prevDoc;
        }
    });
});
