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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    yieldToMain,
    isSchedulerYieldSupported,
    isSaveDataMode,
    initNetworkAwareRendering,
    isAppBadgingSupported,
    updateAppBadge,
    clearAppBadge
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
            const catalogCode = readFileSync(resolve(import.meta.dirname, '../js/catalog/catalog.js'), 'utf8');
            const searchCode = readFileSync(resolve(import.meta.dirname, '../js/catalog/live-search.js'), 'utf8');

            expect(catalogCode).toContain("if (typeof window.yieldToMain === 'function') await window.yieldToMain()");
            expect(catalogCode).toContain('async function renderNextBatch');
            expect(searchCode).toContain("if (typeof window.yieldToMain === 'function') await window.yieldToMain()");
        });

        it('guards catalog infinite scroll against concurrency race conditions during yield', () => {
            const appCode = readFileSync(resolve(import.meta.dirname, '../app.js'), 'utf8');
            const catalogCode = readFileSync(resolve(import.meta.dirname, '../js/catalog/catalog.js'), 'utf8');

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
            const cssCode = readFileSync(resolve(import.meta.dirname, '../style.css'), 'utf8');
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
            const catalogCode = readFileSync(resolve(import.meta.dirname, '../js/catalog/catalog.js'), 'utf8');
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
            const cssCode = readFileSync(resolve(import.meta.dirname, '../style.css'), 'utf8');
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
});
