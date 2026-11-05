import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PWA Quick Action Cart Drawer, FAB Propose Hiding & Notification Permission', () => {
    let styleCss;
    let cartJs;
    let pwaJs;
    let swJs;

    beforeAll(() => {
        styleCss = readFileSync(resolve(__dirname, '../style.css'), 'utf-8');
        cartJs = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf-8');
        pwaJs = readFileSync(resolve(__dirname, '../js/core/pwa-network.js'), 'utf-8');
        swJs = readFileSync(resolve(__dirname, '../sw.js'), 'utf-8');
    });

    describe('1. Mobile Cart Drawer & Alignment Fixes', () => {
        it('style.css ensures .cart-panel.dropdown-open has transform: translateY(0)', () => {
            expect(styleCss).toMatch(/\.cart-panel\.dropdown-open/);
            expect(styleCss).toMatch(/\.cart-panel\.show,\s*\.cart-panel\.dropdown-open/);
        });

        it('style.css styles mobile .cart-dropdown as a fixed bottom drawer with rounded top borders and full 100vw width', () => {
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.cart-dropdown\s*\{[^}]*position:\s*fixed\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.cart-dropdown\s*\{[^}]*bottom:\s*0\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.cart-dropdown\s*\{[^}]*width:\s*100vw\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.cart-dropdown\s*\{[^}]*border-radius:\s*18px 18px 0 0\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.cart-panel\s+\.cart-info\s*\{[^}]*position:\s*static\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.cart-panel\.show\s+\.cart-dropdown\s*\{[^}]*width:\s*100vw\s*!important/);
        });

        it('style.css hides .fab-propose completely when .cart-dropdown is active', () => {
            expect(styleCss).toMatch(/body:has\(\.cart-dropdown\.active\)\s*\.fab-propose/);
            expect(styleCss).toMatch(/\.cart-panel\.dropdown-open\s*~\s*\.fab-propose/);
        });

        it('cart.js updates dropdown-open class on cartPanel and manages fab display/opacity', () => {
            expect(cartJs).toMatch(/panel\.classList\.add\('dropdown-open'\)/);
            expect(cartJs).toMatch(/panel\.classList\.remove\('dropdown-open'\)/);
            expect(cartJs).toMatch(/fab\.style\.setProperty\('display',\s*'none',\s*'important'\)/);
        });
    });

    describe('2. Notification Permission Persistence & Origin Filtering', () => {
        it('syncNotificationPermission in pwa-network.js persists permission to localStorage unconditionally', () => {
            expect(pwaJs).toMatch(/function syncNotificationPermission\(\)\s*\{[\s\S]*?localStorage\.setItem\('nisha_notification_permission',\s*perm\);/);
        });

        it('sw.js ignores pushes received on vercel.app preview origin and auto-unsubscribes', () => {
            expect(swJs).toMatch(/self\.location\.origin\.includes\('vercel\.app'\)/);
            expect(swJs).toMatch(/sub\.unsubscribe\(\)/);
        });
    });

    describe('3. Footer Background Uniformity (No Grey Band Below Footer)', () => {
        it('footer has pure black background and margin-bottom: 0 to prevent wrapper grey background leakage', () => {
            expect(styleCss).toMatch(/footer:not\(\.driver-popover-footer\)\s*\{[^}]*background-color:\s*#000000;/);
            expect(styleCss).toMatch(/footer:not\(\.driver-popover-footer\)\s*\{[^}]*margin-bottom:\s*0\s*!important;/);
            expect(styleCss).toMatch(/footer:not\(\.driver-popover-footer\)\s*\{[^}]*padding:[^;]*calc\(120px \+ env\(safe-area-inset-bottom/);
        });
    });
    describe('4. Desktop Cart Dropdown Scroll Isolation (Overscroll Containment & Lenis Prevention)', () => {
        it('isolates scroll inside cart dropdown and cart dropdown list using overscroll-behavior: contain', () => {
            expect(styleCss).toMatch(/\.cart-dropdown\s*\{[^}]*overscroll-behavior:\s*contain/);
            expect(styleCss).toMatch(/\.cart-dropdown-list\s*\{[^}]*overscroll-behavior:\s*contain/);
        });

        it('index.html equips cartDropdown and cartDropdownList with data-lenis-prevent and data-no-pull', () => {
            const indexHtml = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');
            expect(indexHtml).toContain('id=cartDropdown class="cart-dropdown modal-window-style" data-lenis-prevent data-no-pull');
            expect(indexHtml).toContain('id=cartDropdownList class="cart-dropdown-list no-pull" data-lenis-prevent data-no-pull');
        });

        it('cart.js implements initCartScrollIsolation with wheel boundary traps to prevent page scrolling', () => {
            expect(cartJs).toContain('function initCartScrollIsolation()');
            expect(cartJs).toContain("el.setAttribute('data-lenis-prevent', 'true')");
            expect(cartJs).toContain('window.initCartScrollIsolation = initCartScrollIsolation');
        });
    });
});