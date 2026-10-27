import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Service Worker & PWA Cache Automation', () => {
    const rootSwPath = resolve(process.cwd(), 'sw.js');
    const publicSwPath = resolve(process.cwd(), 'public', 'sw.js');
    const distSwPath = resolve(process.cwd(), 'dist', 'sw.js');

    it('public/sw.js exists and defines automated BUILD_ID and dynamic CACHE_NAME', () => {
        expect(existsSync(publicSwPath)).toBe(true);
        const content = readFileSync(publicSwPath, 'utf8');

        expect(content).toContain("const BUILD_ID = '__BUILD_ID__'");
        expect(content).toContain("const CACHE_NAME = 'nisha-cache-' + BUILD_ID");
        expect(content).toContain("url.hostname === 'accounts.google.com'");
        expect(content).toContain("url.pathname.startsWith('/api/')");
    });

    it('root sw.js is synchronized with public/sw.js template', () => {
        expect(existsSync(rootSwPath)).toBe(true);
        const rootContent = readFileSync(rootSwPath, 'utf8');
        const publicContent = readFileSync(publicSwPath, 'utf8');

        expect(rootContent).toBe(publicContent);
    });

    it('dist/sw.js has __BUILD_ID__ replaced with commit hash and timestamp', () => {
        if (!existsSync(distSwPath)) {
            // Если dist еще не собран в данной среде, пропускаем проверку дистрибутива
            return;
        }
        const distContent = readFileSync(distSwPath, 'utf8');

        // __BUILD_ID__ не должен оставаться сырым маркером в финальном бандле
        expect(distContent).not.toContain("'__BUILD_ID__'");
        
        // Должно начинаться с префикса git хеша или 'build-'
        const match = distContent.match(/const BUILD_ID = '([^']+)'/);
        expect(match).not.toBeNull();
        const buildId = match[1];
        expect(buildId.length).toBeGreaterThan(6);
        expect(buildId).toContain('-');
    });

    it('pwa-network.js uses APP_BUILD_ID to form dynamic cache version and SW URL', () => {
        const pwaPath = resolve(process.cwd(), 'js', 'core', 'pwa-network.js');
        expect(existsSync(pwaPath)).toBe(true);
        const pwaContent = readFileSync(pwaPath, 'utf8');

        expect(pwaContent).toContain("const APP_BUILD_ID = (typeof __BUILD_ID__ !== 'undefined') ? __BUILD_ID__ : 'dev'");
        expect(pwaContent).toContain("const APP_SW_VERSION = 'nisha-cache-' + APP_BUILD_ID");
        expect(pwaContent).toContain("const SW_SCRIPT_URL = '/sw.js?b=' + encodeURIComponent(APP_BUILD_ID)");
    });

    it('sw.js bypasses external trackers (clarity, tiktok) and avoids AbortError controller aborts', () => {
        const content = readFileSync(publicSwPath, 'utf8');

        // Проверяем, что сторонние домены не перехватываются
        expect(content).toContain('!isSameOrigin && !isAllowedCdn && !isAllowedBackend');
        // Проверяем отсутствие AbortController и опасного re-throw в respondWith
        expect(content).not.toContain('AbortController');
        expect(content).not.toContain('throw err;');
    });

    it('sw.js ensures push notifications use square v5 icons and redirect away from vercel preview domains', () => {
        const content = readFileSync(publicSwPath, 'utf8');

        expect(content).toContain('/icon-192.png?v=5');
        expect(content).toContain('/badge.png?v=5');
        expect(content).toContain("parsed.hostname.includes('vercel.app')");
        expect(content).toContain("parsed.hostname = 'www.nisha-store.shop'");
    });
});
