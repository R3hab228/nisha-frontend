import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AI Discovery (llms.txt) & Universal Product Feed Routing (/feed.xml)', () => {
    const rootDir = resolve(import.meta.dirname, '..');

    it('ships synced llms.txt in both root and public/ following llmstxt.org format', () => {
        const publicLlms = readFileSync(resolve(rootDir, 'public/llms.txt'), 'utf8');
        const rootLlms = readFileSync(resolve(rootDir, 'llms.txt'), 'utf8');

        expect(publicLlms).toBe(rootLlms);
        expect(publicLlms.startsWith('# NISHA STORE')).toBe(true);
        expect(publicLlms).toContain('https://www.nisha-store.shop/');
        expect(publicLlms).toContain('https://www.nisha-store.shop/feed.xml');
        expect(publicLlms).toContain('https://www.nisha-store.shop/sitemap.xml');
        expect(publicLlms).toContain('https://www.nisha-store.shop/return-policy');
    });

    it('configures /feed.xml rewrites and /llms.txt headers in vercel.json and allows them in robots.txt', () => {
        const vercelJson = JSON.parse(readFileSync(resolve(rootDir, 'vercel.json'), 'utf8'));
        const rewrites = vercelJson.rewrites || [];
        const headers = vercelJson.headers || [];

        expect(rewrites.some(r => r.source === '/feed.xml' && r.destination.includes('/api/feed.xml'))).toBe(true);
        expect(rewrites.some(r => r.source === '/api/feed.xml' && r.destination.includes('/api/feed.xml'))).toBe(true);
        expect(headers.some(h => h.source === '/llms.txt')).toBe(true);

        const publicRobots = readFileSync(resolve(rootDir, 'public/robots.txt'), 'utf8');
        expect(publicRobots).toContain('Allow: /llms.txt');
        expect(publicRobots).toContain('Allow: /feed.xml');
    });
});
