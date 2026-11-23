import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readProjectCss } from './helpers/readProjectCss.js';

describe('Modal WAI-ARIA Dialog Semantics & Lazy CSS Split', () => {
    const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');

    it('gives every .modal-overlay in index.html role="dialog", aria-modal="true", aria-hidden="true", and a valid aria-labelledby target', () => {
        const modalTags = html.match(/<div\b[^>]*\bclass=(?:"[^"]*\bmodal-overlay\b[^"]*"|modal-overlay)(?=[\s>])[^>]*>/g) || [];
        expect(modalTags.length).toBeGreaterThanOrEqual(11);

        for (const tag of modalTags) {
            expect(tag).toMatch(/\brole=(?:"dialog"|dialog)(?=[\s>])/);
            expect(tag).toMatch(/\baria-modal=(?:"true"|true)(?=[\s>])/);
            expect(tag).toMatch(/\baria-hidden=(?:"true"|true)(?=[\s>])/);

            const labelledByMatch = tag.match(/\baria-labelledby=(?:"([^"]+)"|([^\s>]+))/);
            expect(labelledByMatch).not.toBeNull();
            const titleId = labelledByMatch[1] || labelledByMatch[2];
            expect(html).toMatch(new RegExp(`\\bid=(?:"${titleId}"|${titleId})(?=[\\s>])`));
        }
    });

    it('keeps lazy-split modal CSS rules available across the project stylesheet map', () => {
        const fullCss = readProjectCss();
        expect(fullCss).toContain('.support-topics-row');
        expect(fullCss).toContain('.broadcast-media-grid');
        expect(fullCss).toContain('.driver-popover');
        expect(fullCss).toContain('#paymentDropdown');
        expect(fullCss).toContain('.input-field-error');
    });
});
