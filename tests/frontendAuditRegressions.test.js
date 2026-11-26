import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOrderTabBucket } from '../js/orders/orders-state.js';
import { withWebLock, formatUaPhoneDisplay, formatPhoneInput } from '../js/core/helpers-core-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

describe('Frontend Audit Regression Guards', () => {
    it('ensures static HTML pages have zero executable inline <script> blocks (strict CSP compliance)', () => {
        const htmlPages = ['index.html', 'return-policy.html', 'privacy-policy.html', 'shipping-payment.html', '404.html'];
        for (const page of htmlPages) {
            const content = fs.readFileSync(path.join(rootDir, page), 'utf8');
            const scriptTags = content.match(/<script\b[^>]*>/gi) || [];
            for (const tag of scriptTags) {
                const hasSrc = /\bsrc\s*=/i.test(tag);
                const isNonExecutableType = /\btype\s*=\s*["']?(?:speculationrules|application\/ld\+json)["']?/i.test(tag);
                expect(hasSrc || isNonExecutableType, `Unexpected executable inline script in ${page}: ${tag}`).toBe(true);
            }
        }
    });

    it('ensures chat.js imports getLenisInstance from runtime-env.js', () => {
        const chatSrc = fs.readFileSync(path.join(rootDir, 'js/chat/chat.js'), 'utf8');
        expect(chatSrc).toMatch(/import\s*\{[^}]*\bgetLenisInstance\b[^}]*\}\s*from\s*['"]\.\.\/core\/runtime-env\.js['"]/);
    });

    it('buckets localized Ukrainian, Russian, and English order statuses accurately', () => {
        expect(getOrderTabBucket({ status: 'Скасовано' })).toBe('cancelled');
        expect(getOrderTabBucket({ status: 'Отмена' })).toBe('cancelled');
        expect(getOrderTabBucket({ status: 'Повернення' })).toBe('cancelled');
        expect(getOrderTabBucket({ status: 'Cancelled' })).toBe('cancelled');
        expect(getOrderTabBucket({ status: 'Виконано' })).toBe('shipped');
        expect(getOrderTabBucket({ status: 'Отримано' })).toBe('shipped');
        expect(getOrderTabBucket({ status: 'Доставлено' })).toBe('shipped');
        expect(getOrderTabBucket({ status: 'Delivered' })).toBe('shipped');
        expect(getOrderTabBucket({ status: 'В обработке' })).toBe('accepted');
        expect(getOrderTabBucket({ status: 'Прийнято' })).toBe('accepted');
    });

    it('does not double-execute taskFn inside withWebLock when taskFn throws', async () => {
        const origNavigator = globalThis.navigator;
        const mockRequest = vi.fn(async (_name, cb) => cb({ name: _name }));
        Object.defineProperty(globalThis, 'navigator', {
            value: { ...origNavigator, locks: { request: mockRequest } },
            configurable: true
        });
        try {
            let calls = 0;
            await expect(withWebLock('test_lock_no_double', async () => {
                calls += 1;
                throw new Error('boom');
            })).rejects.toThrow('boom');
            expect(calls).toBe(1);
        } finally {
            Object.defineProperty(globalThis, 'navigator', {
                value: origNavigator,
                configurable: true
            });
        }
    });

    it('keeps .slide video pointer-events interactive and adds Firefox range slider thumb rule', () => {
        const productCss = fs.readFileSync(path.join(rootDir, 'css/lazy-product-checkout-modal.css'), 'utf8');
        expect(productCss).toMatch(/\.slide\s+video\s*\{[^}]*pointer-events:\s*auto/);

        const baseUiCss = fs.readFileSync(path.join(rootDir, 'css/05-cart-footer-reviews-ui.css'), 'utf8');
        expect(baseUiCss).toContain('::-moz-range-thumb');
        expect(baseUiCss).toMatch(/::-moz-range-thumb\s*\{[^}]*pointer-events:\s*auto/);
    });

    it('formats autofilled Ukrainian phone numbers into +380 (XX) XXX-XX-XX and syncs IMask without marking userTyped', () => {
        expect(formatUaPhoneDisplay('+380973115592')).toBe('+380 (97) 311-55-92');
        expect(formatUaPhoneDisplay('0973115592')).toBe('+380 (97) 311-55-92');
        expect(formatUaPhoneDisplay('380973115592')).toBe('+380 (97) 311-55-92');
        expect(formatUaPhoneDisplay('+380 (97) 311-55-92')).toBe('+380 (97) 311-55-92');

        const fakeMask = { value: '', updateValue: vi.fn() };
        const fakeInput = { value: '+380973115592', _nishaPhoneMask: fakeMask, _syncingMaskValue: false };
        const out = formatPhoneInput(fakeInput);
        expect(out).toBe('+380 (97) 311-55-92');
        expect(fakeInput.value).toBe('+380 (97) 311-55-92');
        expect(fakeMask.value).toBe('+380 (97) 311-55-92');
        expect(fakeMask.updateValue).toHaveBeenCalledTimes(1);
        expect(fakeInput._syncingMaskValue).toBe(false);
    });

    it('does not animate max-height on mobile .modal-window to prevent keyboard-close jump', () => {
        const mobileCss = fs.readFileSync(path.join(rootDir, 'css/06-mobile.css'), 'utf8');
        const modalSection = mobileCss.slice(mobileCss.indexOf('.modal-window {'), mobileCss.indexOf('.modal-header {'));
        expect(modalSection).not.toContain('max-height 0.28s');
        expect(mobileCss).toContain('html.keyboard-settling');
    });

    it('never sends unverified draft/pending phones to /api/link-orders (prevents false Security Radar 403 alerts)', () => {
        const profileSessionSrc = fs.readFileSync(path.join(rootDir, 'js/profile/profile-session.js'), 'utf8');
        expect(profileSessionSrc).toContain('const phoneToLink = dbVerifiedPhone;');
        expect(profileSessionSrc).toContain('profileState.userProfile._verifiedDbPhone = dbVerifiedPhone;');

        const ordersFetchSrc = fs.readFileSync(path.join(rootDir, 'js/orders/orders-fetch.js'), 'utf8');
        expect(ordersFetchSrc).toContain('const verifiedLinkPhones = new Set();');
        expect(ordersFetchSrc).not.toContain('Array.from(uniqueCleanPhones)');
    });
});
