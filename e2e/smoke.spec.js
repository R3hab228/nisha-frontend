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
        if (await acceptRulesBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)) {
            await acceptRulesBtn.click();
            await expect(page.locator('#rulesModal')).not.toHaveClass(/is-open/, { timeout: 5000 });
        }

        const closeTourBtn = page.locator('.driver-popover-close-btn');
        if (await closeTourBtn.waitFor({ state: 'visible', timeout: 2500 }).then(() => true, () => false)) {
            await closeTourBtn.click();
            await expect(page.locator('.driver-popover')).toBeHidden({ timeout: 5000 });
        }

        const firstCard = page.locator('#itemsGrid .item-card:not(.skeleton-card)').first();
        await expect(firstCard).toBeVisible({ timeout: 15000 });

        const addBtn = firstCard.locator('[data-action="add-to-cart"]').first();
        await expect(addBtn).toBeVisible({ timeout: 5000 });
        await addBtn.click();

        await expect(page.locator('#cartCount')).toHaveText(/[1-9]/, { timeout: 5000 });
    });

    test('renders mobile catalog with CSS containment, flat layers, and 3+2 top-nav', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(() => {
            localStorage.setItem('siteLang', 'en');
        });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const cards = page.locator('#itemsGrid .item-card:not(.skeleton-card)');
        await expect(cards.first()).toBeVisible({ timeout: 15000 });

        const metrics = await page.evaluate(() => {
            const card = document.querySelector('#itemsGrid .item-card:not(.skeleton-card)');
            const slider = card?.querySelector('.card-slider-wrapper');
            const info = card?.querySelector('.item-info');
            const star = card?.querySelector('.fav-star');
            const unseen = document.querySelector('#itemsGrid .item-card.unseen-pulse');
            const navLinks = Array.from(document.querySelectorAll('.top-nav a')).map((a) => ({
                text: a.textContent?.trim(),
                top: Math.round(a.getBoundingClientRect().top),
            }));
            const rowTops = [...new Set(navLinks.map((n) => n.top))].sort((a, b) => a - b);
            const sliderRect = slider?.getBoundingClientRect();

            return {
                cardContain: card ? getComputedStyle(card).contain : null,
                sliderWidth: sliderRect ? Math.round(sliderRect.width) : 0,
                sliderHeight: sliderRect ? Math.round(sliderRect.height) : 0,
                infoTransform: info ? getComputedStyle(info).transform : null,
                starTransform: star ? getComputedStyle(star).transform : null,
                unseenAnim: unseen ? getComputedStyle(unseen).animationName : null,
                navRowsCount: rowTops.length,
                row1Count: navLinks.filter((n) => Math.abs(n.top - rowTops[0]) <= 4).length,
                row2Count: rowTops[1] !== undefined
                    ? navLinks.filter((n) => Math.abs(n.top - rowTops[1]) <= 4).length
                    : 0,
            };
        });

        expect(metrics.cardContain).toMatch(/^(content|strict)$|(?=.*layout)(?=.*style)(?=.*paint)/);
        expect(metrics.sliderWidth).toBeGreaterThan(140);
        expect(metrics.sliderHeight).toBe(160);
        expect(metrics.infoTransform).toBe('none');
        expect(metrics.starTransform).toBe('none');
        if (metrics.unseenAnim !== null) {
            expect(metrics.unseenAnim).toBe('none');
        }
        expect(metrics.navRowsCount).toBe(2);
        expect(metrics.row1Count).toBe(3);
        expect(metrics.row2Count).toBe(2);
    });
});
