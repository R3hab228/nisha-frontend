import { test, expect } from '@playwright/test';

test.describe('NISHA STORE — Production Smoke E2E', () => {
    test('loads catalog without CSP errors, Push errors, failed CDN requests, or NO SIGNAL images', async ({ page }) => {
        const cspErrors = [];
        const pushErrors = [];
        const failedCdnRequests = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                const text = msg.text();
                if (/content security policy|csp/i.test(text)) cspErrors.push(text);
                if (/Push error:/i.test(text)) pushErrors.push(text);
            }
        });

        page.on('requestfailed', (req) => {
            if (req.url().includes('cdn.nisha-store.shop')) {
                failedCdnRequests.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`);
            }
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const cards = page.locator('#itemsGrid .item-card');
        await expect(cards.first()).toBeVisible({ timeout: 15000 });

        await page.evaluate(() => window.scrollBy(0, 1200));
        await page.waitForTimeout(1500);

        const cardCount = await cards.count();
        expect(cardCount).toBeGreaterThan(4);

        const noSignalCount = await page.locator('#itemsGrid .item-card >> text=NO SIGNAL').count();
        expect(noSignalCount).toBe(0);

        expect(cspErrors).toEqual([]);
        expect(pushErrors).toEqual([]);
        expect(failedCdnRequests).toEqual([]);
    });

    test('accepts rules modal if shown and adds item to cart', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const acceptRulesBtn = page.locator('#rulesModal.is-open [data-action="accept-rules"]');
        if (await acceptRulesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await acceptRulesBtn.click();
        }

        const firstCard = page.locator('#itemsGrid .item-card').first();
        await expect(firstCard).toBeVisible({ timeout: 15000 });

        const addBtn = firstCard.locator('[data-action="add-to-cart"]').first();
        await expect(addBtn).toBeVisible({ timeout: 5000 });
        await addBtn.click();

        await expect(page.locator('#cartCount')).toHaveText(/[1-9]/, { timeout: 5000 });
    });
});
