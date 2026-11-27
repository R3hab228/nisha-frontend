// @ts-check
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Rapid Scroll, Fast Open/Close Modal Stability & Instant Cold-Open (Orders/Drop/Product)', () => {
    const rootDir = resolve(import.meta.dirname, '..');
    const productModalSrc = readFileSync(resolve(rootDir, 'js/product/product-modal.js'), 'utf8');
    const productHistorySrc = readFileSync(resolve(rootDir, 'js/product/product-history.js'), 'utf8');
    const windowsSrc = readFileSync(resolve(rootDir, 'js/ui/windows.js'), 'utf8');
    const appRuntimeSrc = readFileSync(resolve(rootDir, 'js/core/app-runtime.js'), 'utf8');
    const scrollRestSrc = readFileSync(resolve(rootDir, 'js/catalog/scroll-restoration.js'), 'utf8');
    const catalogGridSrc = readFileSync(resolve(rootDir, 'js/catalog/catalog-grid.js'), 'utf8');
    const lazyLoaderSrc = readFileSync(resolve(rootDir, 'js/core/lazy-loader.js'), 'utf8');
    const ordersFetchSrc = readFileSync(resolve(rootDir, 'js/orders/orders-fetch.js'), 'utf8');
    const dropSubmitSrc = readFileSync(resolve(rootDir, 'js/drop/drop-submit.js'), 'utf8');

    it('cancels deferred product modal work (similar items, Q&A, PhotoSwipe, SEO) when closed quickly', () => {
        expect(productModalSrc).toContain('if (!activeNow || String(activeNow.id) !== String(item.id)) return;');
        expect(productModalSrc).toContain('if (!activeNow || String(activeNow.id) !== itemIdForPswp) return;');
        expect(productModalSrc).toContain('requestAnimationFrame(() => requestAnimationFrame(runDeferredModalWork))');
        // addToHistory must skip synchronous 30-card DOM rebuild while productModal is open
        expect(productHistorySrc).toContain('if (!isProductModalOpen)');
    });

    it('resets Lenis scroll inertia cleanly on stopLenis/startLenis and tracks scroll timestamps', () => {
        expect(appRuntimeSrc).toContain('lenis.scrollTo(window.scrollY || 0, { immediate: true, force: true })');
        expect(appRuntimeSrc).toContain('lenis.resize()');
        expect(appRuntimeSrc).toContain('__nishaLastScrollAt = Date.now()');
        // windows.js skips focus jump and defers renderHistory if user is actively scrolling after close
        expect(windowsSrc).toContain('scrolledSinceClose');
        expect(windowsSrc).toContain('msSinceScroll < 380');
    });

    it('uses O(1) elementsFromPoint in saveCurrentFeedScrollState and opens card info taps immediately on mobile', async () => {
        expect(scrollRestSrc).toContain('document.elementsFromPoint');
        expect(catalogGridSrc).toContain('if (lastPointerType === \'mouse\' || !tappedMedia)');
        expect(catalogGridSrc).toContain('__nishaLastScrollAt');

        // Verify live deduplication & elementsFromPoint fast path
        const hitCard = {
            dataset: { id: 'fast-card-42' },
            closest: (sel) => (sel === '#itemsGrid .item-card' ? hitCard : null)
        };
        const setItemSpy = vi.fn();
        vi.stubGlobal('sessionStorage', { setItem: setItemSpy, getItem: vi.fn(), removeItem: vi.fn() });
        vi.stubGlobal('window', { scrollY: 420, innerWidth: 390, innerHeight: 844, renderedCount: 12, currentPage: 1, addEventListener: vi.fn() });
        vi.stubGlobal('document', {
            body: { style: { overflow: '' } },
            querySelectorAll: () => [],
            getElementById: () => null,
            elementsFromPoint: vi.fn(() => [hitCard])
        });

        const { saveCurrentFeedScrollState } = await import('../js/catalog/scroll-restoration.js');
        saveCurrentFeedScrollState();
        saveCurrentFeedScrollState(); // Deduplicated within 80ms!

        expect(setItemSpy).toHaveBeenCalledTimes(1);
        const saved = JSON.parse(setItemSpy.mock.calls[0][1]);
        expect(saved.activeItemId).toBe('fast-card-42');
        vi.unstubAllGlobals();
    });

    it('pre-warms Orders and Drop chunks via intent & Wave-2 idle loading and runs Orders queries in parallel', () => {
        expect(lazyLoaderSrc).toContain('warmModalOnIntent');
        expect(lazyLoaderSrc).toContain('preloadWave2');
        expect(lazyLoaderSrc).toContain('loadOrdersModule()');
        expect(lazyLoaderSrc).toContain('loadDropModule()');
        // Orders fetch runs user_id query and known phone RPCs in parallel Promise.all
        expect(ordersFetchSrc).toContain('const initialPhoneTasks = buildPhoneRpcTasks(candidatePhones)');
        expect(ordersFetchSrc).toContain('...initialPhoneTasks');
        // Drop open avoids redundant duplicate triggerModalTypewriter reflow
        expect(dropSubmitSrc).not.toContain("globalEnv.triggerModalTypewriter('proposeModal')");
    });
});
