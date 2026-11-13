import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Lazy Turnstile & Above-the-fold Priority', () => {
    it('does not eagerly load Turnstile script in index.html head', () => {
        const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
        expect(html).not.toContain('challenges.cloudflare.com/turnstile/v0/api.js');
        expect(html).toContain('dns-prefetch href=https://challenges.cloudflare.com');
    });

    it('lazy-loads Turnstile via singleton ensureTurnstileLoaded in js/auth/auth.js', () => {
        const authCode = readFileSync(resolve(__dirname, '../js/auth/auth.js'), 'utf8');
        expect(authCode).toContain('function ensureTurnstileLoaded()');
        expect(authCode).toContain('window.ensureTurnstileLoaded = ensureTurnstileLoaded');
        expect(authCode).toContain('challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
        expect(authCode).toMatch(/function initTurnstileWidgets\(\)[\s\S]*ensureTurnstileLoaded\(\)\.then/);
    });

    it('marks first 4 catalog cards with fetchpriority="high" in js/catalog/catalog.js', () => {
        const catalogCode = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
        expect(catalogCode).toContain("const firstLoadAttr = (idx < 4) ? 'fetchpriority=\"high\"' : 'loading=\"lazy\"';");
    });
});
