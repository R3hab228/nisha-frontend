import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Service Worker, CSP, BFCache & Catalog Counter Hardening', () => {
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
        expect(sw).toContain("'/early-init.js'");
    });

    it('2. index.html uses strict script-src CSP without unsafe-inline/unsafe-eval, removes unused jsdelivr preconnect, and extracts inline scripts/handlers', () => {
        const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
        const cspMatch = html.match(/<meta http-equiv=Content-Security-Policy content="([^"]+)">/);
        expect(cspMatch).toBeTruthy();

        const csp = cspMatch[1];
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
        expect(csp).toContain("'inline-speculation-rules'");
        expect(csp).not.toMatch(/script-src[^;]*\shttps:\s/);
        expect(csp).not.toMatch(/worker-src[^;]*\shttps:/);

        expect(html).not.toContain('<link rel=preconnect href=https://cdn.jsdelivr.net');
        expect(html).toContain('<link rel=dns-prefetch href=https://cdn.jsdelivr.net>');
        expect(html).toContain('<script src="/early-init.js"></script>');
        expect(html).not.toContain('function syncInitialLangUI()');
        expect(html).not.toContain('function togglePaymentDropdown()');
        expect(html).not.toMatch(/\son(submit|input|change|focus)=/);
    });

    it('3. vercel.json omits no-store on browser Cache-Control for / and /index.html to preserve BFCache', () => {
        const vercel = JSON.parse(readFileSync(resolve(__dirname, '../vercel.json'), 'utf8'));
        const rootRule = vercel.headers.find(h => h.source === '/');
        const indexRule = vercel.headers.find(h => h.source === '/index.html');

        expect(rootRule.headers.find(h => h.key === 'Cache-Control').value).not.toContain('no-store');
        expect(indexRule.headers.find(h => h.key === 'Cache-Control').value).not.toContain('no-store');
        expect(rootRule.headers.find(h => h.key === 'CDN-Cache-Control').value).toContain('no-store');
    });

    it('4. catalog.js updateSidebarCounters updates badges via textContent and single-pass sizeCounts Map', () => {
        const catalog = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
        expect(catalog).toContain('const setFilterCountBadge = (el, count) =>');
        expect(catalog).toContain('const sizeCounts = new Map()');
        expect(catalog).not.toContain("link.innerHTML.split('<span')");
        expect(catalog).not.toContain("labelSpan.innerHTML.split('<span')");
    });
});
