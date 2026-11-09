// ==========================================
// NISHA STORE - MODERN PERFORMANCE APIS TEST SUITE
// tests/modernPerformanceApis.test.js
// Tests for:
// 1. scheduler.yield() & Cooperative Task Scheduling
// 2. Back/Forward Cache (bfcache) + pageshow/pagehide lifecycle
// 3. Save-Data & Network-Aware Rendering (navigator.connection.saveData)
// ==========================================
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { yieldToMain, isSchedulerYieldSupported, isSaveDataMode, initNetworkAwareRendering } from '../src/modules/helpers.js';

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
});
