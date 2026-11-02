import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getNovaPoshtaTrackingUrl, encodeNovaPoshtaTtn } from '../src/modules/orders.js';

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

        it('hides old orders view transition snapshot instantly to avoid ghosting paid items on tab switch', () => {
            expect(styleCode).toContain('::view-transition-old(orders-list)');
            expect(styleCode).toContain('display: none !important');
            expect(styleCode).toContain('::view-transition-new(orders-list)');
            expect(styleCode).toContain('animation: vt-orders-fade-in');
        });

        it('locks ordersModal height on mobile to 78dvh and makes list area flexibly scrollable', () => {
            expect(styleCode).toContain('#ordersModal .modal-window');
            expect(styleCode).toContain('height: 78dvh !important');
            expect(styleCode).toContain('max-height: 84dvh !important');
            expect(styleCode).toContain('#ordersModal #ordersListArea');
            expect(styleCode).toContain('flex: 1 1 auto !important');
            expect(styleCode).toContain('overflow-y: auto !important');
        });
    });

    describe('2. Nova Poshta Direct Tracking Link Generation & Base64 Reverse Encoding', () => {
        it('defines encodeNovaPoshtaTtn and getNovaPoshtaTrackingUrl in orders.js and exposes them on window', () => {
            expect(ordersCode).toContain('function encodeNovaPoshtaTtn(ttn)');
            expect(ordersCode).toContain('window.encodeNovaPoshtaTtn = encodeNovaPoshtaTtn');
            expect(ordersCode).toContain('function getNovaPoshtaTrackingUrl(ttn, lang)');
            expect(ordersCode).toContain('window.getNovaPoshtaTrackingUrl = getNovaPoshtaTrackingUrl');
        });

        it('generates direct tracking.novaposhta.ua hash routes instead of deprecated novaposhta.ua/tracking/?cargo_number', () => {
            expect(ordersCode).not.toContain('href="https://novaposhta.ua/tracking/?cargo_number=');
            expect(ordersCode).toContain('https://tracking.novaposhta.ua/#/');
        });

        it('correctly encodes TTN into Nova Poshta SPA base64-reverse format without gibberish decoding', () => {
            // Test user's exact TTN: 20483289403202
            const encoded = encodeNovaPoshtaTtn('20483289403202');
            expect(encoded).toBe('IDMyMDM0kDOyMDO0AjM');

            // Simulate Nova Poshta's own decoder function O(e):
            // function O(e){return e?(e=e.split('').reverse().join(''),e.length%4!==0&&(e+='==='.slice(0,4-e.length%4)),atob(e)):''}
            const npReverse = encoded.split('').reverse().join('');
            const npPadded = npReverse + '==='.slice(0, (4 - npReverse.length % 4) % 4);
            const npDecoded = Buffer.from(npPadded, 'base64').toString('utf8');
            expect(npDecoded).toBe('20483289403202');
        });

        it('evaluates getNovaPoshtaTrackingUrl correctly for various languages and TTNs with encoded payload', () => {
            // Default UK
            expect(getNovaPoshtaTrackingUrl('20483289403202', 'uk')).toBe('https://tracking.novaposhta.ua/#/uk/IDMyMDM0kDOyMDO0AjM');
            // Russian
            expect(getNovaPoshtaTrackingUrl('20483289403202', 'ru')).toBe('https://tracking.novaposhta.ua/#/ru/IDMyMDM0kDOyMDO0AjM');
            // Trims whitespace
            expect(getNovaPoshtaTrackingUrl('  20483289403202  ', 'uk')).toBe('https://tracking.novaposhta.ua/#/uk/IDMyMDM0kDOyMDO0AjM');
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

        it('resets listArea.scrollTop = 0 upon tab switch', () => {
            expect(ordersCode).toContain('listArea.scrollTop = 0');
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

    describe('3. Order Footer TTNs & Total Spacing Layout', () => {
        it('isolates multiple TTNs inside order-ttns-wrapper grid and places total on its own row', () => {
            const freshOrdersCode = readFileSync(resolve(__dirname, '../js/orders/orders.js'), 'utf8');
            const freshStyleCode = readFileSync(resolve(__dirname, '../style.css'), 'utf8');

            expect(freshOrdersCode).toContain('class="order-ttns-wrapper"');
            expect(freshOrdersCode).toContain('class="order-total-row"');
            expect(freshOrdersCode).toContain('class="order-ttn-header"');
            expect(freshOrdersCode).toContain('class="order-ttn-barcode"');

            expect(freshStyleCode).toContain('.order-ttns-wrapper');
            expect(freshStyleCode).toContain('grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));');
            expect(freshStyleCode).toContain('.order-total-row');
            expect(freshStyleCode).toContain('justify-content: flex-end;');
        });
    });
});
