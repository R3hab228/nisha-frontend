import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Propose Bargain Mobile Resilience & State Reset', () => {
    let dropCode;
    let windowsCode;
    let lazyCode;
    let styleCss;
    let modularDropCode;

    beforeEach(() => {
        dropCode = fs.readFileSync(path.resolve(__dirname, '../js/drop/drop.js'), 'utf8');
        windowsCode = fs.readFileSync(path.resolve(__dirname, '../js/ui/windows.js'), 'utf8');
        lazyCode = fs.readFileSync(path.resolve(__dirname, '../js/core/lazy-loader.js'), 'utf8');
        styleCss = fs.readFileSync(path.resolve(__dirname, '../style.css'), 'utf8');
        modularDropCode = fs.readFileSync(path.resolve(__dirname, '../src/modules/drop.js'), 'utf8');
    });

    it('1. defines resetPropBargainState that safely restores [ ТОРГ ] button and desired price input', () => {
        expect(dropCode).toContain('function resetPropBargainState()');
        expect(dropCode).toContain('window.resetPropBargainState = resetPropBargainState');
        expect(dropCode).toContain("btnToggle.style.display = 'flex'");
        expect(dropCode).toContain("btnConfirm.style.display = 'none'");
        expect(dropCode).toContain("priceInput.style.display = 'block'");
        expect(dropCode).toContain("minBox.style.display = 'none'");
    });

    it('2. openProposeModal guarantees resetPropBargainState is called to prevent stuck display: none', () => {
        const openFnMatch = dropCode.match(/function openProposeModal\(\)\s*\{[\s\S]*?\}/);
        expect(openFnMatch).toBeTruthy();
        expect(openFnMatch[0]).toContain('resetPropBargainState()');
    });

    it('3. resetProposalForm resets flags and invokes resetPropBargainState', () => {
        const resetFnMatch = dropCode.match(/function resetProposalForm\(\)\s*\{[\s\S]*?\}/);
        expect(resetFnMatch).toBeTruthy();
        expect(resetFnMatch[0]).toContain('window._propBargainEnabled = false');
        expect(resetFnMatch[0]).toContain('window._propBargainMode = false');
        expect(resetFnMatch[0]).toContain('resetPropBargainState()');
    });

    it('4. executeCloseModal in windows.js automatically resets propose bargain state on close', () => {
        expect(windowsCode).toContain("id === 'proposeModal'");
        expect(windowsCode).toContain('window.resetPropBargainState()');
    });

    it('5. style.css guarantees flex-shrink: 0 and nowrap so [ ТОРГ ] is never squished on narrow screens', () => {
        expect(styleCss).toMatch(/\.prop-price-row\s*\{[^}]*flex-wrap:\s*nowrap;/);
        expect(styleCss).toMatch(/\.prop-bargain-toggle-btn\s*\{[^}]*flex-shrink:\s*0\s*!important;/);
        expect(styleCss).toMatch(/\.prop-bargain-confirm-btn\s*\{[^}]*flex-shrink:\s*0\s*!important;/);
    });

    it('6. style.css mobile viewport has dedicated sizing for .prop-bargain-toggle-btn', () => {
        expect(styleCss).toContain('.prop-bargain-toggle-btn {');
        expect(styleCss).toMatch(/min-width:\s*85px/);
    });

    it('7. lazy-loader.js bridges all proposal bargain functions', () => {
        expect(lazyCode).toContain("'openPropBargainInput'");
        expect(lazyCode).toContain("'confirmPropBargainInput'");
        expect(lazyCode).toContain("'hidePropBargainInput'");
        expect(lazyCode).toContain("'resetPropBargainState'");
    });

    it('8. src/modules/drop.js exports all proposal bargain methods', () => {
        expect(modularDropCode).toContain('export function openPropBargainInput');
        expect(modularDropCode).toContain('export function confirmPropBargainInput');
        expect(modularDropCode).toContain('export function hidePropBargainInput');
        expect(modularDropCode).toContain('export function resetPropBargainState');
    });

    it('9. simulated resetPropBargainState behavior works accurately in DOM environment', () => {
        const createMockEl = (id) => {
            const classes = new Set();
            return {
                id,
                style: {},
                classList: {
                    add: (cls) => classes.add(cls),
                    remove: (cls) => classes.delete(cls),
                    contains: (cls) => classes.has(cls)
                },
                setAttribute: vi.fn(),
                removeAttribute: vi.fn(),
                innerText: ''
            };
        };

        const elements = {
            propPriceLabel: createMockEl('propPriceLabel'),
            propPrice: createMockEl('propPrice'),
            propMinBargainBox: createMockEl('propMinBargainBox'),
            btnTogglePropBargain: createMockEl('btnTogglePropBargain'),
            btnConfirmPropBargain: createMockEl('btnConfirmPropBargain')
        };

        global.document = {
            getElementById: vi.fn((id) => elements[id] || null)
        };
        global.window = global.window || {};
        global.window._propBargainMode = true;
        global.window._propBargainEnabled = false;

        elements.btnTogglePropBargain.style.display = 'none';
        elements.btnConfirmPropBargain.style.display = 'flex';
        elements.propMinBargainBox.style.display = 'flex';
        elements.propPrice.style.display = 'none';

        const fnMatch = dropCode.match(/function resetPropBargainState\(\)\s*\{[\s\S]*?\n\}/);
        expect(fnMatch).toBeTruthy();
        const resetFn = new Function(fnMatch[0] + '; return resetPropBargainState;')();

        resetFn();

        expect(global.window._propBargainMode).toBe(false);
        expect(elements.btnTogglePropBargain.style.display).toBe('flex');
        expect(elements.btnConfirmPropBargain.style.display).toBe('none');
        expect(elements.propPrice.style.display).toBe('block');
        expect(elements.propMinBargainBox.style.display).toBe('none');
        expect(elements.btnTogglePropBargain.innerText).toBe('[ ТОРГ ]');
        expect(elements.btnTogglePropBargain.classList.contains('active')).toBe(false);

        // Test with bargain confirmed
        global.window._propBargainEnabled = true;
        resetFn();
        expect(elements.btnTogglePropBargain.innerText).toBe('[ ТОРГ ✓ ]');
        expect(elements.btnTogglePropBargain.classList.contains('active')).toBe(true);
    });
});
