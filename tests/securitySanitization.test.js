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
});
