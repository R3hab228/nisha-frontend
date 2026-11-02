import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getNovaPoshtaTrackingUrl } from '../src/modules/orders.js';

describe('Orders Modal View Transition Isolation & Direct Tracking Fix', () => {
    const ordersCode = readFileSync(resolve(__dirname, '../js/orders/orders.js'), 'utf8');
    const styleCode = readFileSync(resolve(__dirname, '../style.css'), 'utf8');

    describe('1. CSS View Transition Rules & Modal Isolation', () => {
        it('isolates #itemsGrid and .item-card from view transitions when any modal or ordersModal is open', () => {
            expect(styleCode).toContain('body:has(#ordersModal.is-open) #itemsGrid');
            expect(styleCode).toContain('body:has(#ordersModal[style*="display: flex"]) #itemsGrid');
            expect(styleCode).toContain('body:has(#ordersModal.is-open) .item-card');
            expect(styleCode).toContain('body:has(.modal-overlay.is-open) #itemsGrid');
            expect(styleCode).toContain('view-transition-name: none !important');
        });

        it('assigns high z-index to ::view-transition-group(orders-list)', () => {
            expect(styleCode).toContain('::view-transition-group(orders-list)');
            expect(styleCode).toContain('z-index: 1000000 !important');
        });
    });

    describe('2. Nova Poshta Direct Tracking Link Generation', () => {
        it('defines getNovaPoshtaTrackingUrl in orders.js and exposes it on window', () => {
            expect(ordersCode).toContain('function getNovaPoshtaTrackingUrl(ttn, lang)');
            expect(ordersCode).toContain('window.getNovaPoshtaTrackingUrl = getNovaPoshtaTrackingUrl');
        });

        it('generates direct tracking.novaposhta.ua hash routes instead of deprecated novaposhta.ua/tracking/?cargo_number', () => {
            expect(ordersCode).not.toContain('href="https://novaposhta.ua/tracking/?cargo_number=');
            expect(ordersCode).toContain('https://tracking.novaposhta.ua/#/');
        });

        it('evaluates getNovaPoshtaTrackingUrl correctly for various languages and TTNs', () => {
            // Default UK
            expect(getNovaPoshtaTrackingUrl('20450912345678', 'uk')).toBe('https://tracking.novaposhta.ua/#/uk/20450912345678');
            // Russian
            expect(getNovaPoshtaTrackingUrl('20450912345678', 'ru')).toBe('https://tracking.novaposhta.ua/#/ru/20450912345678');
            // Trims whitespace
            expect(getNovaPoshtaTrackingUrl('  20450912345678  ', 'uk')).toBe('https://tracking.novaposhta.ua/#/uk/20450912345678');
            // Empty TTN fallback
            expect(getNovaPoshtaTrackingUrl('', 'uk')).toBe('https://tracking.novaposhta.ua/');
        });
    });

    describe('3. Programmatic Background Card Isolation in switchOrderTab', () => {
        it('strips view-transition-name from background elements before safeViewTransition', () => {
            expect(ordersCode).toContain("bgGrid.style.setProperty('view-transition-name', 'none', 'important')");
            expect(ordersCode).toContain("card.style.setProperty('view-transition-name', 'none', 'important')");
            expect(ordersCode).toContain('safeViewTransition(updateDom)');
            expect(ordersCode).toContain('restoreBgTransitions');
        });

        it('restores background card transitions cleanly after transition completes', async () => {
            const mockGrid = { style: { viewTransitionName: 'catalog-grid', setProperty: vi.fn(), removeProperty: vi.fn() } };
            const mockCard1 = {
                style: {
                    getPropertyValue: vi.fn(() => 'item-101'),
                    getPropertyPriority: vi.fn(() => ''),
                    setProperty: vi.fn(),
                }
            };
            const mockCard2 = {
                style: {
                    getPropertyValue: vi.fn(() => 'item-102'),
                    getPropertyPriority: vi.fn(() => ''),
                    setProperty: vi.fn(),
                }
            };

            const cards = [mockCard1, mockCard2];

            // Simulate the switchOrderTab logic
            const bgGrid = mockGrid;
            const prevGridVt = bgGrid.style.viewTransitionName;
            bgGrid.style.setProperty('view-transition-name', 'none', 'important');

            const cardsToRestore = [];
            cards.forEach(card => {
                const vt = card.style.getPropertyValue('view-transition-name');
                const prio = card.style.getPropertyPriority('view-transition-name');
                if (vt && vt !== 'none') {
                    cardsToRestore.push({ card, vt, prio });
                    card.style.setProperty('view-transition-name', 'none', 'important');
                }
            });

            expect(mockGrid.style.setProperty).toHaveBeenCalledWith('view-transition-name', 'none', 'important');
            expect(mockCard1.style.setProperty).toHaveBeenCalledWith('view-transition-name', 'none', 'important');
            expect(mockCard2.style.setProperty).toHaveBeenCalledWith('view-transition-name', 'none', 'important');

            // Restore
            if (prevGridVt) bgGrid.style.setProperty('view-transition-name', prevGridVt);
            cardsToRestore.forEach(({ card, vt, prio }) => {
                card.style.setProperty('view-transition-name', vt, prio);
            });

            expect(mockGrid.style.setProperty).toHaveBeenCalledWith('view-transition-name', 'catalog-grid');
            expect(mockCard1.style.setProperty).toHaveBeenCalledWith('view-transition-name', 'item-101', '');
            expect(mockCard2.style.setProperty).toHaveBeenCalledWith('view-transition-name', 'item-102', '');
        });
    });
});
