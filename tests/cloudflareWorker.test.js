import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../scripts/cloudflare-image-worker.js';

describe('Cloudflare Image Worker CDN (scripts/cloudflare-image-worker.js)', () => {
    let mockCache;

    beforeEach(() => {
        mockCache = {
            match: vi.fn().mockResolvedValue(null),
            put: vi.fn().mockResolvedValue(undefined)
        };
        globalThis.caches = { default: mockCache };
    });

    it('blocks non-storage Supabase paths with 403 Forbidden', async () => {
        const req = new Request('https://nisha-cdn.example.com/rest/v1/users');
        const res = await worker.fetch(req, {}, { waitUntil: vi.fn() });
        expect(res.status).toBe(403);
    });

    it('selects AVIF automatically when Accept header includes image/avif and no fmt is given', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response('img-bytes', { status: 200, headers: { 'Content-Type': 'image/avif' } })
        );
        globalThis.fetch = fetchSpy;

        const req = new Request('https://nisha-cdn.example.com/storage/v1/object/public/items/1.jpg?w=400', {
            headers: { Accept: 'image/avif,image/webp,*/*' }
        });
        const res = await worker.fetch(req, {}, { waitUntil: vi.fn() });

        expect(res.status).toBe(200);
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(res.headers.get('Vary')).toBe('Accept');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy.mock.calls[0][1].cf.image.format).toBe('avif');
        expect(fetchSpy.mock.calls[0][1].cf.cacheEverything).toBe(true);
    });

    it('uses WebP when Accept header does not include image/avif', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response('img-bytes', { status: 200, headers: { 'Content-Type': 'image/webp' } })
        );
        globalThis.fetch = fetchSpy;

        const req = new Request('https://nisha-cdn.example.com/storage/v1/object/public/items/1.jpg?w=400', {
            headers: { Accept: 'image/webp,*/*' }
        });
        const res = await worker.fetch(req, {}, { waitUntil: vi.fn() });

        expect(res.status).toBe(200);
        expect(fetchSpy.mock.calls[0][1].cf.image.format).toBe('webp');
    });

    it('respects explicit fmt query parameter over Accept header', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response('img-bytes', { status: 200, headers: { 'Content-Type': 'image/webp' } })
        );
        globalThis.fetch = fetchSpy;

        const req = new Request('https://nisha-cdn.example.com/storage/v1/object/public/items/1.jpg?w=400&fmt=webp', {
            headers: { Accept: 'image/avif,image/webp,*/*' }
        });
        const res = await worker.fetch(req, {}, { waitUntil: vi.fn() });

        expect(res.status).toBe(200);
        expect(fetchSpy.mock.calls[0][1].cf.image.format).toBe('webp');
    });

    it('includes query string in caches.default cacheKey on fallback proxy', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response('raw-bytes', { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })
        );
        globalThis.fetch = fetchSpy;
        const waitUntil = vi.fn();

        const req = new Request('https://nisha-cdn.example.com/storage/v1/object/public/items/doc.pdf?download=1');
        const res = await worker.fetch(req, {}, { waitUntil });

        expect(res.status).toBe(200);
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(mockCache.match).toHaveBeenCalledTimes(1);
        const cacheKeyReq = mockCache.match.mock.calls[0][0];
        expect(cacheKeyReq.url).toContain('?download=1');
    });
});
