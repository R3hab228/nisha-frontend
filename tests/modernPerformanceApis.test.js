// ==========================================
// NISHA STORE - MODERN PERFORMANCE APIS TEST SUITE
// tests/modernPerformanceApis.test.js
// Tests for:
// 1. scheduler.yield() & Cooperative Task Scheduling
// 2. Back/Forward Cache (bfcache) + pageshow/pagehide lifecycle
// 3. Save-Data & Network-Aware Rendering (navigator.connection.saveData)
// 4. App Badging API (navigator.setAppBadge / clearAppBadge)
// 5. Web Locks API (navigator.locks) & Leader Election
// 6. Live Search Bargain Badge ([ТОРГ])
// ==========================================
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readProjectCss } from './helpers/readProjectCss.js';
import { readCatalogSource } from './helpers/readCatalogSource.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    yieldToMain,
    isSchedulerYieldSupported,
    isSaveDataMode,
    initNetworkAwareRendering,
    isAppBadgingSupported,
    updateAppBadge,
    clearAppBadge,
    isPopoverSupported,
    showPopoverSafe,
    hidePopoverSafe,
    togglePopoverSafe,
    isPopoverOpenSafe,
    isScrollDrivenAnimationSupported
} from '../src/modules/helpers.js';
import {
    isWebLocksSupported,
    isTabLeader,
    onLeaderElected,
    runWithLock,
    initLeaderElection
} from '../src/modules/webLocks.js';

describe('Modern Performance APIs Suite', () => {
    beforeAll(() => {
        globalThis.window = globalThis.window || globalThis;
        if (typeof globalThis.window.addEventListener !== 'function') {
            globalThis.window.addEventListener = vi.fn();
        }
    });

    describe('1. Prioritized Task Scheduling (scheduler.yield() & Cooperative Yielding)', () => {
        it('yieldToMain resolves smoothly and relinquishes the main thread', async () => {
            const start = performance.now();
            await yieldToMain();
            expect(performance.now() - start).toBeGreaterThanOrEqual(0);
        });

        it('isSchedulerYieldSupported correctly detects scheduler.yield availability', async () => {
            const originalScheduler = globalThis.scheduler;

            delete globalThis.scheduler;
            expect(isSchedulerYieldSupported()).toBe(false);

            let nativeYieldCalled = false;
            globalThis.scheduler = {
                yield: () => {
                    nativeYieldCalled = true;
                    return Promise.resolve();
                }
            };
            expect(isSchedulerYieldSupported()).toBe(true);

            await yieldToMain();
            expect(nativeYieldCalled).toBe(true);

            if (originalScheduler) {
                globalThis.scheduler = originalScheduler;
            } else {
                delete globalThis.scheduler;
            }
        });

        it('yieldToMain is integrated in catalog renderNextBatch and live search', () => {
            const catalogCode = readCatalogSource();
            const searchCode = readFileSync(resolve(import.meta.dirname, '../js/catalog/live-search.js'), 'utf8');

            expect(catalogCode).toContain("if (typeof window.yieldToMain === 'function') await window.yieldToMain()");
            expect(catalogCode).toContain('async function renderNextBatch');
            expect(searchCode).toContain("if (typeof window.yieldToMain === 'function') await window.yieldToMain()");
        });

        it('guards catalog infinite scroll against concurrency race conditions during yield', () => {
            const appCode = readFileSync(resolve(import.meta.dirname, '../app.js'), 'utf8');
            const catalogCode = readCatalogSource();

            expect(appCode).toContain('await renderNextBatch()');
            expect(appCode).toContain('isBatchLoading = false');
            expect(catalogCode).toContain('window.renderedCount = endIndex;');
        });

        it('guards live search against stale query results after yielding', () => {
            const searchCode = readFileSync(resolve(import.meta.dirname, '../js/catalog/live-search.js'), 'utf8');
            expect(searchCode).toContain('if (seq !== currentLiveSearchSeq) return;');
            expect(searchCode).toContain('if (searchInput.value.trim() !== searchTerm) return;');
        });
    });

    describe('2. Back/Forward Cache (bfcache) + pageshow (event.persisted)', () => {
        it('pwa-network.js registers pageshow and pagehide lifecycle listeners for bfcache restoration', () => {
            const pwaCode = readFileSync(resolve(import.meta.dirname, '../js/core/pwa-network.js'), 'utf8');
            expect(pwaCode).toContain('window.addEventListener("pageshow"');
            expect(pwaCode).toContain('event.persisted');
            expect(pwaCode).toContain('[BFCache]');
            expect(pwaCode).toContain('window.addEventListener("pagehide"');
            expect(pwaCode).toContain('initCatalogRealtimeSubscription');
            expect(pwaCode).toContain('syncCriticalStatuses');
        });

        it('drop.js avoids permanent beforeunload listeners to ensure 100% bfcache compliance', () => {
            const dropCode = readFileSync(resolve(import.meta.dirname, '../js/drop/drop.js'), 'utf8');
            expect(dropCode).not.toContain("window.addEventListener('beforeunload', (e) => {\n    if (activeProposalUploads > 0)");
            expect(dropCode).toContain('updateProposalBeforeUnloadListener');
            expect(dropCode).toContain("window.removeEventListener('beforeunload', onProposalBeforeUnload)");
        });
    });

    describe('3. Save-Data & Network-Aware Rendering (navigator.connection.saveData)', () => {
        beforeEach(() => {
            delete globalThis.navigator.connection;
        });

        it('isSaveDataMode detects saveData boolean flag and 2g constrained networks', () => {
            expect(isSaveDataMode()).toBe(false);

            globalThis.navigator.connection = { saveData: true, effectiveType: '4g' };
            expect(isSaveDataMode()).toBe(true);

            globalThis.navigator.connection = { saveData: false, effectiveType: '2g' };
            expect(isSaveDataMode()).toBe(true);

            globalThis.navigator.connection = { saveData: false, effectiveType: 'slow-2g' };
            expect(isSaveDataMode()).toBe(true);

            globalThis.navigator.connection = { saveData: false, effectiveType: '4g' };
            expect(isSaveDataMode()).toBe(false);
        });

        it('initNetworkAwareRendering manages save-data-active class and data-save-data attribute on document', () => {
            const classList = new Set();
            const attributes = new Map();

            const mockDocument = {
                documentElement: {
                    classList: {
                        add: (cls) => classList.add(cls),
                        remove: (cls) => classList.delete(cls),
                        contains: (cls) => classList.has(cls)
                    },
                    setAttribute: (k, v) => attributes.set(k, v),
                    removeAttribute: (k) => attributes.delete(k)
                }
            };

            const prevDoc = globalThis.document;
            globalThis.document = mockDocument;

            globalThis.navigator.connection = { saveData: true, addEventListener: vi.fn() };
            initNetworkAwareRendering();

            expect(classList.has('save-data-active')).toBe(true);
            expect(attributes.get('data-save-data')).toBe('true');

            globalThis.navigator.connection = { saveData: false, effectiveType: '4g', addEventListener: vi.fn() };
            initNetworkAwareRendering();

            expect(classList.has('save-data-active')).toBe(false);
            expect(attributes.has('data-save-data')).toBe(false);

            globalThis.document = prevDoc;
        });

        it('style.css contains dedicated .save-data-active optimizations', () => {
            const cssCode = readProjectCss();
            expect(cssCode).toContain('html.save-data-active');
            expect(cssCode).toContain('backdrop-filter: none !important');
            expect(cssCode).toContain('grid-lazy-video');
        });
    });

    describe('4. App Badging API (navigator.setAppBadge / clearAppBadge)', () => {
        beforeEach(() => {
            delete globalThis.navigator.setAppBadge;
            delete globalThis.navigator.clearAppBadge;
        });

        it('isAppBadgingSupported correctly identifies browser support', () => {
            expect(isAppBadgingSupported()).toBe(false);

            globalThis.navigator.setAppBadge = vi.fn();
            expect(isAppBadgingSupported()).toBe(true);
        });

        it('updateAppBadge and clearAppBadge invoke native navigator methods safely', async () => {
            const setBadgeMock = vi.fn().mockResolvedValue(undefined);
            const clearBadgeMock = vi.fn().mockResolvedValue(undefined);

            globalThis.navigator.setAppBadge = setBadgeMock;
            globalThis.navigator.clearAppBadge = clearBadgeMock;

            const resSet = await updateAppBadge(3);
            expect(resSet).toBe(true);
            expect(setBadgeMock).toHaveBeenCalledWith(3);

            const resClear = await updateAppBadge(0);
            expect(resClear).toBe(true);
            expect(clearBadgeMock).toHaveBeenCalled();

            const resDirectClear = await clearAppBadge();
            expect(resDirectClear).toBe(true);
        });

        it('updateAppBadge defaults to window.cart length if count is omitted', async () => {
            const setBadgeMock = vi.fn().mockResolvedValue(undefined);
            globalThis.navigator.setAppBadge = setBadgeMock;

            globalThis.window.cart = [{ id: '1' }, { id: '2' }];
            await updateAppBadge();
            expect(setBadgeMock).toHaveBeenCalledWith(2);
        });
    });

    describe('5. Web Locks API (navigator.locks) & Leader Election', () => {
        let origLocks;

        beforeAll(() => {
            origLocks = Object.getOwnPropertyDescriptor(globalThis.navigator, 'locks');
        });

        afterEach(() => {
            if (origLocks) {
                Object.defineProperty(globalThis.navigator, 'locks', origLocks);
            }
        });

        it('isWebLocksSupported detects native locks.request support', () => {
            Object.defineProperty(globalThis.navigator, 'locks', {
                value: { request: vi.fn() },
                configurable: true
            });
            expect(isWebLocksSupported()).toBe(true);

            Object.defineProperty(globalThis.navigator, 'locks', {
                value: undefined,
                configurable: true
            });
            expect(isWebLocksSupported()).toBe(false);
        });

        it('runWithLock executes tasks with native lock or graceful fallback', async () => {
            Object.defineProperty(globalThis.navigator, 'locks', {
                value: undefined,
                configurable: true
            });

            let taskRan = false;
            const resFallback = await runWithLock('test_fallback', async () => {
                taskRan = true;
                return 'result';
            });
            expect(taskRan).toBe(true);
            expect(resFallback).toBe('result');

            let lockRequested = false;
            Object.defineProperty(globalThis.navigator, 'locks', {
                value: {
                    request: vi.fn().mockImplementation(async (name, opts, cb) => {
                        lockRequested = true;
                        return cb({ name });
                    })
                },
                configurable: true
            });

            const resLocked = await runWithLock('test_lock', async () => 42);
            expect(lockRequested).toBe(true);
            expect(resLocked).toBe(42);
        });

        it('runWithLock respects ifAvailable and returns null when lock is contested', async () => {
            Object.defineProperty(globalThis.navigator, 'locks', {
                value: {
                    request: vi.fn().mockImplementation(async (name, opts, cb) => {
                        // Simulates unavailable lock
                        return cb(null);
                    })
                },
                configurable: true
            });

            const contestedRes = await runWithLock('contested_lock', async () => 'not_run', { ifAvailable: true });
            expect(contestedRes).toBeNull();
        });

        it('catalog syncCriticalStatuses uses runWithLock with nisha_critical_sync_lock', () => {
            const catalogCode = readCatalogSource();
            expect(catalogCode).toContain("window.runWithLock('nisha_critical_sync_lock', executeSync, { ifAvailable: true })");
        });
    });

    describe('6. Live Search Bargain Badge ([ТОРГ])', () => {
        it('live-search.js contains isItemBargainEnabled helper and live-search-bargain-badge', () => {
            const searchCode = readFileSync(resolve(import.meta.dirname, '../js/catalog/live-search.js'), 'utf8');
            expect(searchCode).toContain('function isItemBargainEnabled');
            expect(searchCode).toContain('live-search-bargain-badge');
            expect(searchCode).toContain("t('search.bargain_badge'");
        });

        it('style.css defines .live-search-bargain-badge with no green border, transparent bg and glowing text', () => {
            const cssCode = readProjectCss();
            expect(cssCode).toContain('.live-search-bargain-badge');
            expect(cssCode).toContain('top: 12px');
            expect(cssCode).toContain('right: 12px');
            expect(cssCode).toContain('padding-right: 52px');
            expect(cssCode).toContain('border: none !important');
            expect(cssCode).toContain('background: transparent !important');
            expect(cssCode).toContain('box-shadow: none !important');
            expect(cssCode).toContain('text-shadow: 0 0 6px rgba(0, 255, 102, 0.45) !important');
        });

        it('isItemBargainEnabled accurately detects all bargaining flags and descriptions', async () => {
            const { isItemBargainEnabled } = await import('../src/modules/catalog.js');
            expect(isItemBargainEnabled(null)).toBe(false);
            expect(isItemBargainEnabled({ status: 'sold', is_bargain: true })).toBe(false);
            expect(isItemBargainEnabled({ is_bargain: true })).toBe(true);
            expect(isItemBargainEnabled({ is_bargain: 'true' })).toBe(true);
            expect(isItemBargainEnabled({ is_bargain: 1 })).toBe(true);
            expect(isItemBargainEnabled({ min_bargain_price: 540 })).toBe(true);
            expect(isItemBargainEnabled({ description: 'Крутая куртка [ТОРГ: от 540 грн]' })).toBe(true);
            expect(isItemBargainEnabled({ description: 'Винтажный худи [торг]' })).toBe(true);
            expect(isItemBargainEnabled({ description: 'Куртка из кожи, возможен торг' })).toBe(true);
            expect(isItemBargainEnabled({ description: 'Обычное описание без скидки' })).toBe(false);
        });

        it('search-worker-client fallback uses r.item without reference errors', () => {
            const clientCode = readFileSync(resolve(import.meta.dirname, '../js/core/search-worker-client.js'), 'utf8');
            expect(clientCode).toContain('item: r.item');
            expect(clientCode).not.toMatch(/collected\.push\(\{[\s\r\n]*item,[\s\r\n]*matches: r\.matches/);
        });
    });
    describe('7. Native Popover API ([popover]) & Light Dismiss', () => {
        it('isPopoverSupported accurately detects Popover API methods on HTMLElement prototype', () => {
            const origHTMLElement = globalThis.HTMLElement;

            delete globalThis.HTMLElement;
            expect(isPopoverSupported()).toBe(false);

            globalThis.HTMLElement = class MockHTMLElement {};
            expect(isPopoverSupported()).toBe(false);

            globalThis.HTMLElement.prototype.showPopover = vi.fn();
            globalThis.HTMLElement.prototype.hidePopover = vi.fn();
            expect(isPopoverSupported()).toBe(true);

            if (origHTMLElement) globalThis.HTMLElement = origHTMLElement;
            else delete globalThis.HTMLElement;
        });

        it('showPopoverSafe and hidePopoverSafe execute safely and handle DOMExceptions', () => {
            const fakeElement = {
                showPopover: vi.fn(),
                hidePopover: vi.fn(),
                togglePopover: vi.fn().mockReturnValue(true),
                matches: vi.fn().mockReturnValue(false),
                hasAttribute: vi.fn().mockReturnValue(true)
            };

            expect(showPopoverSafe(null)).toBe(false);
            expect(hidePopoverSafe(null)).toBe(false);
            expect(togglePopoverSafe(null)).toBe(false);

            // Open
            expect(showPopoverSafe(fakeElement)).toBe(true);
            expect(fakeElement.showPopover).toHaveBeenCalled();

            // When already open
            fakeElement.matches.mockReturnValue(true);
            expect(showPopoverSafe(fakeElement)).toBe(true);

            // Hide
            expect(hidePopoverSafe(fakeElement)).toBe(true);
            expect(fakeElement.hidePopover).toHaveBeenCalled();

            // When throwing DOMException (e.g. InvalidStateError)
            fakeElement.showPopover.mockImplementationOnce(() => {
                throw new Error('InvalidStateError');
            });
            fakeElement.matches.mockReturnValue(false);
            expect(showPopoverSafe(fakeElement)).toBe(false);

            fakeElement.matches.mockReturnValue(true);
            fakeElement.hidePopover.mockImplementationOnce(() => {
                throw new Error('InvalidStateError');
            });
            expect(hidePopoverSafe(fakeElement)).toBe(false);

            // Toggle
            expect(togglePopoverSafe(fakeElement, true)).toBe(true);
            expect(fakeElement.togglePopover).toHaveBeenCalledWith(true);
        });
it('isPopoverOpenSafe accurately detects open state across popover, class and styles', () => {
            expect(isPopoverOpenSafe(null)).toBe(false);
            expect(isPopoverOpenSafe(undefined)).toBe(false);

            // Native popover open (:popover-open)
            const openPopover = { matches: (sel) => sel === ':popover-open' };
            expect(isPopoverOpenSafe(openPopover)).toBe(true);

            // Closed popover
            const closedPopover = { matches: () => false, classList: { contains: () => false }, style: { display: 'none' } };
            expect(isPopoverOpenSafe(closedPopover)).toBe(false);

            // Active / is-open class
            const activeEl = { classList: { contains: (cls) => cls === 'active' } };
            expect(isPopoverOpenSafe(activeEl)).toBe(true);

            const isOpenEl = { classList: { contains: (cls) => cls === 'is-open' } };
            expect(isPopoverOpenSafe(isOpenEl)).toBe(true);

            // Visible display block
            const blockEl = { classList: { contains: () => false }, style: { display: 'block', opacity: '1', visibility: 'visible' } };
            expect(isPopoverOpenSafe(blockEl)).toBe(true);
        });

        it('index.html applies popover="auto" to #liveSearchDropdown and #paymentDropdown', () => {
            const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
            expect(html).toMatch(/id=["']?liveSearchDropdown["']?[^>]*popover=["']?auto["']?/);
            expect(html).toMatch(/id=["']?paymentDropdown["']?[^>]*popover=["']?auto["']?/);
            // #cartDropdown uses seamless bottom-sheet slide-up drawer docked flush to cartPanel
            expect(html).toContain('id=cartDropdown class="cart-dropdown modal-window-style" data-lenis-prevent data-no-pull');
        });

        it('style.css defines universal [popover] UA reset and :popover-open styling', () => {
            const css = readProjectCss();
            expect(css).toContain('[popover] {');
            expect(css).toContain('margin: unset;');
            expect(css).toContain('[popover]::backdrop {');
            expect(css).toContain('#liveSearchDropdown:popover-open');
            expect(css).toContain('background: #0a0a0a !important;');
            expect(css).toContain('#paymentDropdown:popover-open');
            // cart-dropdown is docked directly with translateY animation
            expect(css).toContain('.cart-panel.show .cart-dropdown.active');
            expect(css).toContain('transform: translateY(0)');
        });

        it('live-search.js and cart.js register toggle listeners for Light Dismiss, cart uses smooth bottom sheet', () => {
            const cartJs = readFileSync(resolve(import.meta.dirname, '../js/cart/cart.js'), 'utf8');
            const searchJs = readFileSync(resolve(import.meta.dirname, '../js/catalog/live-search.js'), 'utf8');

            expect(cartJs).toContain('function toggleCartDropdown');
            expect(cartJs).toContain('function closeCartDropdown');
            expect(searchJs).toContain("liveSearchDropEl.addEventListener('toggle'");
            expect(searchJs).toContain("evt.newState === 'closed'");
            expect(cartJs).toContain("pd.addEventListener('toggle'");
            expect(cartJs).toContain("evt.newState === 'closed'");
        });
    });

    describe('8. CSS Scroll-Driven Animations (animation-timeline: scroll() and view())', () => {
        it('isScrollDrivenAnimationSupported checks CSS.supports for scroll() and view()', () => {
            const origCSS = globalThis.CSS;
            globalThis.CSS = {
                supports: vi.fn().mockImplementation((prop, val) => {
                    return prop === 'animation-timeline' && (val === 'scroll()' || val === 'view()');
                })
            };

            expect(isScrollDrivenAnimationSupported()).toBe(true);
            expect(globalThis.CSS.supports).toHaveBeenCalledWith('animation-timeline', 'scroll()');

            globalThis.CSS.supports = vi.fn().mockReturnValue(false);
            expect(isScrollDrivenAnimationSupported()).toBe(false);

            if (origCSS) globalThis.CSS = origCSS;
            else delete globalThis.CSS;
        });

        it('index.html does not contain the intrusive progress bar', () => {
            const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
            expect(html).not.toContain('id="nishaScrollProgress"');
            expect(html).not.toContain('class="nisha-scroll-progress"');
        });

        it('style.css defines @supports (animation-timeline: scroll()) with header elevation and prevents feed dimming', () => {
            const css = readProjectCss();
            expect(css).toContain('@supports (animation-timeline: scroll())');
            expect(css).toContain('animation-timeline: scroll(root block);');
            expect(css).toContain('animation: headerScrollElevation');
            expect(css).not.toContain('@keyframes nishaScrollProgressAnim');
            expect(css).not.toContain('animation: itemCardViewEntrance');
            expect(css).toContain('opacity: 1 !important;');
        });

        it('style.css guarantees reduced motion and low-power-mode disable scroll animations', () => {
            const css = readProjectCss();
            expect(css).toContain('@media (prefers-reduced-motion: reduce)');
            expect(css).toContain('html.low-power-mode header:not(.driver-popover-title)');
            expect(css).toContain('animation: none !important;');
        });
    });
});
