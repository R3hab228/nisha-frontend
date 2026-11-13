import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Service Worker, CSP & index.html hardening', () => {
    it('1. sw.js uses per-cache trim timers, trims API_CACHE, uses 1400ms network timeout, and drops ignoreSearch on general match', () => {
        const sw = readFileSync(resolve(__dirname, '../sw.js'), 'utf8');
        const publicSw = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');

        expect(sw).toBe(publicSw);
        expect(sw).toContain('const _trimTimeouts = new Map()');
        expect(sw).toContain('scheduleTrimCache(API_CACHE, 80)');
        expect(sw).toContain('setTimeout(() => resolveTimeout(null), 1400)');
        expect(sw).not.toContain('setTimeout(() => resolveTimeout(null), 3500)');
        expect(sw).toContain('const cachedResponse = await caches.match(event.request);');
        expect(sw).toContain('const cached = await caches.match(event.request);');
    });

    it('2. index.html drops unsafe-eval, restricts script-src/worker-src, removes unused jsdelivr preconnect, and extracts duplicate inline scripts', () => {
        const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
        const cspMatch = html.match(/<meta http-equiv=Content-Security-Policy content="([^"]+)">/);
        expect(cspMatch).toBeTruthy();

        const csp = cspMatch[1];
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).not.toMatch(/script-src[^;]*\shttps:\s/);
        expect(csp).not.toMatch(/worker-src[^;]*\shttps:/);

        expect(html).not.toContain('<link rel=preconnect href=https://cdn.jsdelivr.net');
        expect(html).toContain('<link rel=dns-prefetch href=https://cdn.jsdelivr.net>');
        expect(html).not.toContain('function syncInitialLangUI()');
        expect(html).not.toContain('function togglePaymentDropdown()');
    });
});
