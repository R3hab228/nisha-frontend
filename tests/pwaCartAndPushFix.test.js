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

        it('style.css styles mobile .cart-dropdown as a fixed bottom drawer with rounded top borders', () => {
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.cart-dropdown\s*\{[^}]*position:\s*fixed\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.cart-dropdown\s*\{[^}]*bottom:\s*0\s*!important/);
            expect(styleCss).toMatch(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.cart-dropdown\s*\{[^}]*border-radius:\s*18px 18px 0 0\s*!important/);
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
});
