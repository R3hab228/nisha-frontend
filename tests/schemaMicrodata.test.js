import { describe, it, expect } from 'vitest';
import { readProductSource } from './helpers/readProductSource.js';
import fs from 'node:fs';
import path from 'node:path';

describe('JSON-LD & Schema.org Microdata Robustness', () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    it('all application/ld+json scripts in index.html are valid standalone objects (not arrays)', () => {
        const scriptRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
        const matches = [...htmlContent.matchAll(scriptRegex)];

        expect(matches.length).toBeGreaterThanOrEqual(1);

        for (const match of matches) {
            const rawJson = match[1].trim();
            expect(rawJson.startsWith('{')).toBe(true);
            expect(rawJson.endsWith('}')).toBe(true);
            expect(rawJson.startsWith('[')).toBe(false);

            let parsed;
            expect(() => {
                parsed = JSON.parse(rawJson);
            }).not.toThrow();

            expect(typeof parsed).toBe('object');
            expect(Array.isArray(parsed)).toBe(false);
            expect(parsed).not.toBeNull();

            // Verify @context is defined and a string
            expect(typeof parsed['@context']).toBe('string');
            expect(parsed['@context'].toLowerCase()).toMatch(/^https:\/\/schema\.org\/?$/i);

            // Verify @type is defined and a string
            expect(typeof parsed['@type']).toBe('string');
            expect(parsed['@type'].length).toBeGreaterThan(0);

            // Verify evaluating r["@context"].toLowerCase() executes cleanly without exception
            const r = parsed;
            expect(() => r['@context'].toLowerCase()).not.toThrow();
        }
    });

    it('product.js uses textContent and standard https://schema.org', () => {
        const productJsContent = readProductSource();

        expect(productJsContent).toContain('schemaScript.textContent = JSON.stringify(schemaData);');
        expect(productJsContent).not.toContain('schemaScript.innerText = JSON.stringify(schemaData);');
        expect(productJsContent).toContain('"@context": "https://schema.org"');
    });

    it('pwa-network.js filters out @context errors in IGNORED_ERROR_PATTERNS', () => {
        const pwaNetworkPath = path.resolve(__dirname, '../js/core/pwa-network.js');
        const pwaNetworkContent = fs.readFileSync(pwaNetworkPath, 'utf8');

        expect(pwaNetworkContent).toContain('/@context/i');
    });
});
