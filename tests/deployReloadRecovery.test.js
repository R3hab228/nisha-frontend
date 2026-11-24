import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Deploy-Safe Reload & Stale Chunk Recovery', () => {
    const rootDir = resolve(import.meta.dirname, '..');
    const swSrc = readFileSync(resolve(rootDir, 'public/sw.js'), 'utf8');
    const rootSwSrc = readFileSync(resolve(rootDir, 'sw.js'), 'utf8');
    const earlyInitSrc = readFileSync(resolve(rootDir, 'public/early-init.js'), 'utf8');
    const appSrc = readFileSync(resolve(rootDir, 'app.js'), 'utf8');

    it('keeps sw.js synced and enforces no-store + fail-fast MIME on deploy refresh', () => {
        expect(rootSwSrc).toBe(swSrc);
        expect(swSrc).toContain("const isForceFresh = event.request.cache === 'reload' || url.searchParams.has('_sw_upd');");
        expect(swSrc).toContain("if (!isForceFresh && event.request.mode === 'navigate' && event.preloadResponse)");
        expect(swSrc).toContain("fetch(event.request, { cache: 'no-store' })");
        expect(swSrc).toContain('return Response.error();');
        expect(swSrc).toContain('.catch(() => Response.error())');
    });

    it('early-init.js uses multi-attempt SW flush, _sw_upd cache-busting, and manual recovery banner', () => {
        expect(earlyInitSrc).toContain('MAX_AUTO_RECOVERIES = 2');
        expect(earlyInitSrc).toContain('flushStaleServiceWorkers');
        expect(earlyInitSrc).toContain("freshUrl.searchParams.set('_sw_upd'");
        expect(earlyInitSrc).toContain('showManualRecoveryBanner');
        expect(earlyInitSrc).toContain("id = 'nishaBootRecoveryBanner'");
    });

    it('app.js resets chunk recovery counters and removes recovery banner once booted', () => {
        expect(appSrc).toContain('function markAppBooted()');
        expect(appSrc).toContain("sessionStorage.removeItem('nisha_chunk_reload_count')");
        expect(appSrc).toContain("document.getElementById('nishaBootRecoveryBanner')");
    });
});
