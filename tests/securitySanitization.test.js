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
});
