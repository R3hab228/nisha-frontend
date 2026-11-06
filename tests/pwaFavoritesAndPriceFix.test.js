import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

class MockStorage {
    constructor() {
        this._map = new Map();
    }
    getItem(key) {
        return this._map.has(key) ? this._map.get(key) : null;
    }
    setItem(key, val) {
        this._map.set(key, String(val));
    }
    removeItem(key) {
        this._map.delete(key);
    }
    clear() {
        this._map.clear();
    }
}

describe('PWA Quick Action Favorites, Mobile Price Layout & Modal Scrollbar Fixes', () => {
    let styleCss;
    let catalogJs;
    let profileJs;
    let appJs;

    beforeAll(() => {
        styleCss = readFileSync(resolve(__dirname, '../style.css'), 'utf-8');
        catalogJs = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf-8');
        profileJs = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf-8');
        appJs = readFileSync(resolve(__dirname, '../app.js'), 'utf-8');
    });

    describe('1. PWA Quick Action Favorites (/ ?action=fav) Race Condition Resolution', () => {
        it('app.js does NOT use premature setTimeout for quickAction === "fav"', () => {
            // Must not contain setTimeout to toggleFavFilter / applyFilters on 150ms arbitrary timer
            expect(appJs).not.toMatch(/quickAction === 'fav'[\s\S]{0,100}setTimeout\([^)]*applyFilters/);
            expect(appJs).not.toMatch(/quickAction === 'fav'[\s\S]{0,100}setTimeout\([^)]*toggleFavFilter/);
        });

        it('app.js awaits Promise.all before checking window.showingOnlyFavs and applying filters', () => {
            expect(appJs).toContain('await Promise.all([itemsPromise, sessionPromise, langPromise]);');
            expect(appJs).toMatch(/Promise\.all\(\[itemsPromise, sessionPromise, langPromise\]\);[\s\S]*?if\s*\(window\.showingOnlyFavs\)/);
        });

        it('profile.js initializes favorites from nisha_cached_favorites on startup', () => {
            expect(profileJs).toMatch(/nisha_cached_favorites/);
            expect(profileJs).toContain('window.favorites');
        });

        it('loadFavorites in profile.js saves to nisha_cached_favorites and triggers applyFilters if showingOnlyFavs', () => {
            expect(profileJs).toMatch(/loadFavorites[\s\S]*?nisha_cached_favorites/);
            expect(profileJs).toMatch(/loadFavorites[\s\S]*?if\s*\(window\.showingOnlyFavs\s*&&\s*typeof applyFilters === 'function'\)\s*\{\s*applyFilters\(\);/);
        });

        it('applyFilters in catalog.js falls back to cached favorites if window.favorites is not yet loaded', () => {
            expect(catalogJs).toMatch(/applyFilters[\s\S]*?nisha_cached_favorites/);
        });

        it('resetToMain in app.js cleans nisha_showing_favs from sessionStorage', () => {
            expect(appJs).toMatch(/function resetToMain[\s\S]*?nisha_showing_favs/);
        });
    });

    describe('2. Mobile Price Display & Currency Clipping Fixes (.item-price)', () => {
        it('style.css defines flex-wrap and responsive baseline alignment on .item-price', () => {
            expect(styleCss).toMatch(/\.item-price\s*\{[^}]*display:\s*flex;/);
            expect(styleCss).toMatch(/\.item-price\s*\{[^}]*flex-wrap:\s*wrap;/);
            expect(styleCss).toMatch(/\.item-price\s*\{[^}]*align-items:\s*baseline;/);
            expect(styleCss).toMatch(/\.item-price\s*\{[^}]*column-gap:\s*8px;/);
        });

        it('style.css styles .card-old-price and .card-current-price with white-space nowrap', () => {
            expect(styleCss).toMatch(/\.card-old-price[^}]*white-space:\s*nowrap;/);
            expect(styleCss).toMatch(/\.card-current-price[^}]*white-space:\s*nowrap;/);
        });

        it('style.css contains mobile @media adjustments with overflow protection and min-width 0', () => {
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.item-info\s*\{[^}]*overflow:\s*hidden;/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.item-info\s*\{[^}]*min-width:\s*0;/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.item-price\s*\{[^}]*flex-wrap:\s*wrap;/);
        });

        it('catalog.js uses semantic classes card-old-price and card-current-price without hardcoded 14px font-size', () => {
            expect(catalogJs).toContain('card-old-price');
            expect(catalogJs).toContain('card-current-price');
            // Ensure no hardcoded font-size: 14px on old price span in buildCardDOM
            expect(catalogJs).not.toMatch(/priceHTML = `<span style="[^"]*font-size:\s*14px/);
        });
    });

    describe('3. Mobile Modal Scrollbar Suppression (Eliminates Right-Side Card Clipping)', () => {
        it('desktop custom scrollbar is scoped to @media (min-width: 901px)', () => {
            expect(styleCss).toMatch(/@media\s*\(min-width:\s*901px\)\s*\{\s*::-webkit-scrollbar\s*\{\s*width:\s*8px;/);
        });

        it('desktop red arrow cursor for scrollbars is scoped to @media (min-width: 901px)', () => {
            expect(styleCss).toMatch(/@media\s*\(min-width:\s*901px\)\s*\{[\s\S]*?RED ARROW FOR SCROLLBARS[\s\S]*?cursor:\s*url/);
        });

        it('mobile @media (max-width: 900px) completely suppresses ::-webkit-scrollbar and sets scrollbar-width: none', () => {
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?::-webkit-scrollbar\s*\{[^}]*display:\s*none\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?::-webkit-scrollbar\s*\{[^}]*width:\s*0\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?scrollbar-width:\s*none/);
        });

        it('.modal-window on mobile includes scrollbar-width: none !important', () => {
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.modal-window\s*\{[^}]*scrollbar-width:\s*none\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.modal-window\s*\{[^}]*-ms-overflow-style:\s*none\s*!important/);
        });

        it('@media (pointer: coarse) suppresses scrollbars across all touch devices and modals', () => {
            expect(styleCss).toMatch(/@media\s*\(pointer:\s*coarse\)[\s\S]*?\.modal-window[\s\S]*?scrollbar-width:\s*none\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(pointer:\s*coarse\)[\s\S]*?\.modal-window::-webkit-scrollbar[\s\S]*?display:\s*none\s*!important/);
        });
    });

    describe('4. History Section Windows 95 Close Button Styling & Touch Accessibility', () => {
        const productJs = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf-8');
        const localesRu = JSON.parse(readFileSync(resolve(__dirname, '../locales.json'), 'utf-8')).ru.translation.history;
        const localesUa = JSON.parse(readFileSync(resolve(__dirname, '../locales.json'), 'utf-8')).ua.translation.history;
        const localesEn = JSON.parse(readFileSync(resolve(__dirname, '../locales.json'), 'utf-8')).en.translation.history;

        it('styles .history-item-remove with classic Windows 95 bevel, 24px comfortable size and black bold X', () => {
            expect(styleCss).toContain('.history-item-remove {');
            expect(styleCss).toMatch(/width:\s*24px/);
            expect(styleCss).toMatch(/height:\s*24px/);
            expect(styleCss).toMatch(/background:\s*var\(--text-main,\s*#c0c0c0\)/);
            expect(styleCss).toMatch(/border:\s*2px\s+outset\s+#eee/);
            expect(styleCss).toMatch(/box-shadow:\s*1px\s+1px\s+0px\s+#000/);
            expect(styleCss).toMatch(/color:\s*#000/);
            expect(styleCss).toMatch(/font-weight:\s*bold/);
            expect(styleCss).toMatch(/border-style:\s*inset/);
        });

        it('provides expanded hit area pseudo-element for effortless mobile tap precision', () => {
            expect(styleCss).toContain('.history-item-remove::before');
            expect(styleCss).toMatch(/\.history-item-remove::before\s*\{[^}]*position:\s*absolute/);
        });

        it('renders accessible semantic close-btn button in product.js with remove-history-item action', () => {
            expect(productJs).toContain('class="close-btn history-item-remove"');
            expect(productJs).toContain('data-action="remove-history-item"');
            expect(productJs).toContain('title="${typeof i18next !== \'undefined\' ? i18next.t(\'history.remove_item\', { defaultValue: \'Удалить\' }) : \'Удалить\'}"');
        });

        it('localizes history remove action in locales.json', () => {
            expect(localesRu.remove_item).toBe('Удалить из истории');
            expect(localesUa.remove_item).toBe('Видалити з історії');
            expect(localesEn.remove_item).toBe('Remove from history');
        });
    });

    describe('5. Mobile Propose Form Viewport Stability & Anti-Jitter Keyboard Adaptation', () => {
        const windowsJs = readFileSync(resolve(__dirname, '../js/ui/windows.js'), 'utf-8');

        it('sets stable full-height flex column layout on mobile for #proposeModal to prevent jumping', () => {
            expect(styleCss).toContain('#proposeModal .modal-window');
            expect(styleCss).toMatch(/#proposeModal\s+\.modal-window\s*\{[^}]*height:\s*85dvh\s*!important/);
            expect(styleCss).toMatch(/#proposeModal\s+\.modal-window\s*\{[^}]*display:\s*flex\s*!important/);
            expect(styleCss).toMatch(/#proposeModal\s+\.modal-window\s*\{[^}]*flex-direction:\s*column\s*!important/);
            expect(styleCss).toMatch(/#proposeModal\s+\.modal-window\s*\{[^}]*overflow:\s*hidden\s*!important/);
        });

        it('makes #proposeModal .form-layout smoothly scrollable with overscroll containment', () => {
            expect(styleCss).toContain('#proposeModal .form-layout');
            expect(styleCss).toMatch(/#proposeModal\s+\.form-layout\s*\{[^}]*flex:\s*1\s+1\s+auto\s*!important/);
            expect(styleCss).toMatch(/#proposeModal\s+\.form-layout\s*\{[^}]*overflow-y:\s*auto\s*!important/);
            expect(styleCss).toMatch(/#proposeModal\s+\.form-layout\s*\{[^}]*overscroll-behavior-y:\s*contain/);
        });

        it('disables animation transitions during keyboard-open to eliminate delay bouncing', () => {
            expect(styleCss).toMatch(/html\.keyboard-open\s+\.modal-overlay\s*\{[^}]*transition:\s*none\s*!important/);
            expect(styleCss).toMatch(/html\.keyboard-open\s+\.modal-window\s*\{[^}]*transition:\s*none\s*!important/);
            expect(styleCss).toMatch(/html\.keyboard-open\s+#proposeModal\s+\.modal-window\s*\{[^}]*height:\s*100%\s*!important/);
        });

        it('applies scroll-margin to inputs so focused fields never hide behind sticky modal header', () => {
            expect(styleCss).toMatch(/\.form-input[^}]*scroll-margin-top:\s*65px\s*!important/);
            expect(styleCss).toMatch(/\.form-input[^}]*scroll-margin-bottom:\s*25px\s*!important/);
        });

        it('defines ensureFieldVisibleInModal in windows.js and skips scrolling if element is already visible', async () => {
            globalThis.window = globalThis.window || globalThis;
            if (typeof globalThis.window.addEventListener !== 'function') globalThis.window.addEventListener = vi.fn();
            await import('../js/ui/windows.js');
            expect(typeof window.ensureFieldVisibleInModal).toBe('function');

            // Test element already within visible area
            const mockScrollContainer = {
                scrollTop: 100,
                scrollTo: vi.fn(),
                getBoundingClientRect: () => ({ top: 0, bottom: 400 })
            };
            const mockInputInView = {
                id: 'propName',
                closest: (sel) => (sel === '.form-layout' ? mockScrollContainer : null),
                getBoundingClientRect: () => ({ top: 120, bottom: 160 })
            };

            window.innerWidth = 390;
            window.ensureFieldVisibleInModal(mockInputInView);

            // Should NOT scroll when input is already comfortably visible
            expect(mockScrollContainer.scrollTo).not.toHaveBeenCalled();
            expect(mockScrollContainer.scrollTop).toBe(100);

            // Test element partially below viewport (behind keyboard)
            const mockInputBelow = {
                id: 'propPrice',
                closest: (sel) => (sel === '.form-layout' ? mockScrollContainer : null),
                getBoundingClientRect: () => ({ top: 380, bottom: 420 })
            };

            window.ensureFieldVisibleInModal(mockInputBelow);
            // Delta should scroll container down to reveal input
            expect(mockScrollContainer.scrollTo).toHaveBeenCalledWith({
                top: 100 + (420 - (400 - 24)),
                behavior: 'smooth'
            });
        });
    });
});
