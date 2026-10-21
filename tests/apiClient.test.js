import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

let apiClient;

beforeAll(async () => {
    globalThis.window = globalThis.window || globalThis;
    globalThis.window.ENV = {
        API_BASE_URL: 'https://api.nisha-test.shop/'
    };
    await import('../js/core/apiClient.js');
    apiClient = globalThis.apiClient;
});

beforeEach(() => {
    vi.restoreAllMocks();
});

describe('Protected API Client (js/core/apiClient.js) — Retries, Deduplication & Idempotency', () => {
    it('resolves base URL and relative endpoints cleanly', () => {
        expect(apiClient.getBaseUrl()).toBe('https://api.nisha-test.shop');
        expect(apiClient.resolveUrl('/api/create-order')).toBe('https://api.nisha-test.shop/api/create-order');
        expect(apiClient.resolveUrl('api/check-promo')).toBe('https://api.nisha-test.shop/api/check-promo');
        expect(apiClient.resolveUrl('https://custom.domain/test')).toBe('https://custom.domain/test');
    });

    it('generates unique prefixed idempotency keys', () => {
        const key1 = apiClient.generateIdempotencyKey('order');
        const key2 = apiClient.generateIdempotencyKey('order');
        expect(key1.startsWith('order_')).toBe(true);
        expect(key1).not.toBe(key2);
    });

    it('injects idempotencyKey into JSON POST body and parses response', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true, orderId: 'ord-777' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        );
        globalThis.fetch = fetchMock;

        const res = await apiClient.post('/api/create-order', { name: 'Иван', itemIds: ['1'] }, {
            idempotencyKey: 'order_fixed_123'
        });

        expect(res.success).toBe(true);
        expect(res.orderId).toBe('ord-777');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [calledUrl, calledOpts] = fetchMock.mock.calls[0];
        expect(calledUrl).toBe('https://api.nisha-test.shop/api/create-order');
        expect(JSON.parse(calledOpts.body)).toEqual({
            name: 'Иван',
            itemIds: ['1'],
            idempotencyKey: 'order_fixed_123'
        });
    });

    it('automatically retries on HTTP 503 and succeeds on subsequent attempt', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ success: true, cost: 85 }), { status: 200 })
            );
        globalThis.fetch = fetchMock;

        const res = await apiClient.post('/api/calc-delivery', { cityRef: 'ref-1', cartTotal: 1000 }, {
            retries: 2,
            retryDelay: 10
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(res.success).toBe(true);
        expect(res.cost).toBe(85);
    });

    it('deduplicates identical concurrent in-flight requests when dedupe: true', async () => {
        let resolveFetch;
        const fetchMock = vi.fn().mockImplementation(() => new Promise(resolve => {
            resolveFetch = () => resolve(
                new Response(JSON.stringify({ success: true, data: ['city-1'] }), { status: 200 })
            );
        }));
        globalThis.fetch = fetchMock;

        const payload = { modelName: 'Address', calledMethod: 'getCities' };
        const p1 = apiClient.post('/api/np-proxy', payload, { dedupe: true });
        const p2 = apiClient.post('/api/np-proxy', payload, { dedupe: true });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        resolveFetch();

        const [r1, r2] = await Promise.all([p1, p2]);
        expect(r1).toEqual({ success: true, data: ['city-1'] });
        expect(r2).toEqual({ success: true, data: ['city-1'] });
    });

    it('handles non-JSON HTML error pages gracefully without crashing JSON.parse', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response('<html><body>502 Bad Gateway</body></html>', { status: 200 })
        );

        const res = await apiClient.get('/api/vapid-key', { retries: 0 });
        expect(res.success).toBe(false);
        expect(res._nonJson).toBe(true);
    });

    it('aborts timed-out requests via native AbortSignal.timeout and marks error with isTimeout', async () => {
        globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
            return new Promise((_resolve, reject) => {
                if (opts.signal) {
                    opts.signal.addEventListener('abort', () => {
                        reject(opts.signal.reason || new Error('Aborted'));
                    });
                }
            });
        });

        await expect(
            apiClient.get('/api/slow-endpoint', { timeout: 25, retries: 0 })
        ).rejects.toMatchObject({
            name: 'AbortError',
            isTimeout: true
        });
    });
});
