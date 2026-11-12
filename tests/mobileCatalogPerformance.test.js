import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function extractMediaBlock(css, mediaRegex) {
    const match = mediaRegex.exec(css);
    if (!match) return '';
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
    }
    return css.slice(match.index + match[0].length, i - 1);
}

describe('Mobile Catalog Rendering Performance (style.css)', () => {
    const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
    const mobileCss = extractMediaBlock(css, /@media\s*\(max-width:\s*900px\)\s*\{/);

    it('isolates catalog grid and cards with CSS containment on mobile viewports', () => {
        expect(mobileCss).toContain('.items-grid { contain: layout style; }');
        expect(mobileCss).toContain('contain: layout style paint;');
        expect(mobileCss).toContain('.card-slider-wrapper { contain: strict; }');
        expect(mobileCss).toContain('.card-slide { contain: layout style paint; }');
        expect(mobileCss).toContain('.item-card.skeleton-card { contain: layout style paint; }');
    });

    it('flattens unnecessary 3D GPU compositor layers on mobile catalog cards', () => {
        expect(mobileCss).toMatch(/\.item-card\s+\.fav-star[\s\S]*?\.item-card\s+\.item-info[\s\S]*?transform:\s*none\s*!important/);
        expect(mobileCss).toContain('will-change: auto;');
    });

    it('stops continuous non-composited border-color repaints on unseen mobile cards', () => {
        expect(mobileCss).toMatch(/\.item-card\.unseen-pulse\s*\{[^}]*animation:\s*none/);
        expect(mobileCss).toContain('transition: none;');
        expect(mobileCss).toContain('touch-action: manipulation;');
    });

    it('disables sticky touch hover glows/filters and scopes base64 cursors to fine pointers', () => {
        expect(css).toMatch(/@media\s*\(hover:\s*none\),\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.item-card:hover[\s\S]*?box-shadow:\s*none/);
        expect(css).toMatch(/@media\s*\(hover:\s*hover\)\s+and\s+\(pointer:\s*fine\)\s*\{[\s\S]*?cursor:\s*url\(/);
    });

    it('disables infinite skeleton and unseen animations in reduced-motion and low-power mode', () => {
        expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.item-card\.unseen-pulse[\s\S]*?animation:\s*none\s*!important/);
        expect(css).toMatch(/html\.low-power-mode\s+\.item-card\.unseen-pulse[\s\S]*?animation:\s*none\s*!important/);
    });
});
