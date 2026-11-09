// ==========================================
// NISHA STORE - REAL USER MONITORING (RUM) TESTS
// tests/rumTelemetry.test.js
// ==========================================
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getRumMetrics, sendRumReport } from '../src/modules/telemetry.js';

describe('Real User Monitoring (RUM) Module', () => {
    beforeAll(() => {
        globalThis.window = globalThis.window || globalThis;
        if (typeof globalThis.window.addEventListener !== 'function') {
            globalThis.window.addEventListener = vi.fn();
        }
        if (!globalThis.document) {
            globalThis.document = {
                addEventListener: vi.fn(),
                readyState: 'complete',
                visibilityState: 'visible'
            };
        }
        if (!globalThis.navigator) {
            globalThis.navigator = {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            };
        }
    });

    beforeEach(() => {
        // Reset fetch mock
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true })
        });
    });

    it('exports getRumMetrics and returns correct data shape', () => {
        const metrics = getRumMetrics();
        expect(metrics).toBeDefined();
        expect(metrics).toHaveProperty('lcp');
        expect(metrics).toHaveProperty('inp');
        expect(metrics).toHaveProperty('cls');
        expect(metrics).toHaveProperty('ttfb');
        expect(metrics).toHaveProperty('device');
        expect(metrics).toHaveProperty('connection');
        expect(metrics).toHaveProperty('url');
    });

    it('sendRumReport executes safely without throwing', () => {
        expect(() => {
            sendRumReport('test_trigger');
        }).not.toThrow();
    });

    it('loads js/core/rum.js and initializes window.__nishaRUM in browser environment', async () => {
        await import('../js/core/rum.js');
        expect(window.__nishaRUM).toBeDefined();
        expect(typeof window.__nishaRUM.initRUM).toBe('function');
        expect(typeof window.__nishaRUM.getMetrics).toBe('function');
        expect(typeof window.__nishaRUM.sendRumReport).toBe('function');

        const metrics = window.__nishaRUM.getMetrics();
        expect(metrics).toHaveProperty('device');
        expect(['iOS', 'Android', 'Desktop']).toContain(metrics.device);
    });

    it('sendRumReport sends POST to /api/rum with payload when vitals are present', async () => {
        await import('../js/core/rum.js');
        // Manually inject a vital metric to simulate browser measurement
        window.__nishaRUM.rumData.lcp = 1450;
        window.__nishaRUM.rumData.ttfb = 210;

        const sent = window.__nishaRUM.sendRumReport('manual_test');
        expect(sent).toBe(true);
        expect(global.fetch).toHaveBeenCalled();

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('/api/rum');
        expect(options.method).toBe('POST');
        expect(options.keepalive).toBe(true);

        const body = JSON.parse(options.body);
        expect(body.lcp).toBe(1450);
        expect(body.ttfb).toBe(210);
        expect(body.reason).toBe('manual_test');
    });
});
