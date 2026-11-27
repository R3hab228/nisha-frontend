// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import {
    positionAtCursor,
    attachFloatingPopover,
    detachFloatingPopover
} from '../js/core/floating-ui.js';

describe('Smart Floating Positioning (@floating-ui/dom — js/core/floating-ui.js)', () => {
    beforeEach(() => {
        /** @type {any} */ (globalThis).window = {
            innerWidth: 1000,
            innerHeight: 700
        };
    });

    it('positions cursor tooltip inside viewport bounds and never alters element dimensions', async () => {
        /** @type {any} */
        const tooltip = {
            offsetWidth: 200,
            offsetHeight: 120,
            style: {
                display: 'block',
                width: 'max-content',
                height: '',
                left: '-9999px',
                top: '-9999px'
            },
            dataset: {},
            getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 })
        };

        // Normal middle position
        await positionAtCursor(tooltip, 300, 200);
        expect(tooltip.style.left).toBe('316px');
        expect(tooltip.style.top).toBe('216px');
        // Never touches width or height
        expect(tooltip.style.width).toBe('max-content');
        expect(tooltip.style.height).toBe('');

        // Near bottom-right corner -> flips cleanly inside viewport
        await positionAtCursor(tooltip, 950, 650);
        expect(Number.parseInt(tooltip.style.left, 10)).toBeLessThan(950);
        expect(Number.parseInt(tooltip.style.top, 10)).toBeLessThan(650);
        expect(Number.parseInt(tooltip.style.left, 10)).toBeGreaterThanOrEqual(10);
        expect(Number.parseInt(tooltip.style.top, 10)).toBeGreaterThanOrEqual(10);
    });

    it('attaches popover cleanly without mutating width/height and restores inline styles on detach', () => {
        /** @type {any} */
        const refEl = {
            isConnected: true,
            getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 })
        };
        /** @type {any} */
        const floatingEl = {
            isConnected: true,
            style: {
                top: '',
                bottom: '100%',
                left: '0px',
                right: '',
                marginTop: '',
                marginBottom: '5px',
                width: '100%',
                maxHeight: '220px'
            },
            dataset: {}
        };

        const cleanup = attachFloatingPopover(refEl, floatingEl, {
            placement: 'top',
            strategy: 'absolute',
            offsetPx: 5
        });

        expect(typeof cleanup).toBe('function');
        // Sizes must remain untouched
        expect(floatingEl.style.width).toBe('100%');
        expect(floatingEl.style.maxHeight).toBe('220px');

        detachFloatingPopover(floatingEl);
        expect(floatingEl.style.bottom).toBe('100%');
        expect(floatingEl.style.marginBottom).toBe('5px');
        expect(floatingEl.style.width).toBe('100%');
        expect(floatingEl.style.maxHeight).toBe('220px');
    });

    it('preserves left/right CSS width rules when verticalOnly is enabled', () => {
        /** @type {any} */
        const refEl = {
            isConnected: true,
            getBoundingClientRect: () => ({ width: 240, height: 42, top: 100, left: 20, right: 260, bottom: 142 })
        };
        /** @type {any} */
        const dropdownEl = {
            isConnected: true,
            style: {
                top: '',
                bottom: '',
                left: '0px',
                right: '0px',
                marginTop: '',
                marginBottom: ''
            },
            dataset: {},
            getBoundingClientRect: () => ({ width: 240, height: 180, top: 146, left: 20, right: 260, bottom: 326 })
        };

        attachFloatingPopover(refEl, dropdownEl, {
            placement: 'bottom-start',
            strategy: 'absolute',
            offsetPx: 4,
            verticalOnly: true
        });

        expect(dropdownEl.style.left).toBe('0px');
        expect(dropdownEl.style.right).toBe('0px');
        detachFloatingPopover(dropdownEl);
        expect(dropdownEl.style.left).toBe('0px');
        expect(dropdownEl.style.right).toBe('0px');
    });
});
