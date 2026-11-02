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
});
