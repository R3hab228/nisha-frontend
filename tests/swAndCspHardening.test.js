import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Service Worker, CSP, BFCache & Catalog Counter Hardening', () => {
    it('1. sw.js uses per-cache trim timers, trims API_CACHE, uses 1400ms network timeout, and drops ignoreSearch on general match', () => {
        const sw = readFileSync(resolve(__dirname, '../sw.js'), 'utf8');
        const publicSw = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');

        expect(sw).toBe(publicSw);
        expect(sw).toContain('const _trimTimeouts = new Map()');
        expect(sw).toContain('scheduleTrimCache(API_CACHE, 80)');
        expect(sw).toContain('setTimeout(() => resolveTimeout(null), 1400)');
        expect(sw).not.toContain('setTimeout(() => resolveTimeout(null), 3500)');
        expect(sw).toContain('const cachedResponse = await caches.match(event.request);');
        expect(sw).toContain('const cached = await caches.match(event.request);');
        expect(sw).toContain("'/early-init.js'");
    });

    it('2. index.html uses strict script-src CSP without unsafe-inline/unsafe-eval, removes unused jsdelivr preconnect, and extracts inline scripts/handlers', () => {
        const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
        const cspMatch = html.match(/<meta http-equiv=Content-Security-Policy content="([^"]+)">/);
        expect(cspMatch).toBeTruthy();

        const csp = cspMatch[1];
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
        expect(csp).toContain("'inline-speculation-rules'");
        expect(csp).not.toMatch(/script-src[^;]*\shttps:\s/);
        expect(csp).not.toMatch(/worker-src[^;]*\shttps:/);

        expect(html).not.toContain('<link rel=preconnect href=https://cdn.jsdelivr.net');
        expect(html).toContain('<link rel=dns-prefetch href=https://cdn.jsdelivr.net>');
        expect(html).toContain('<script src="/early-init.js"></script>');
        expect(html).not.toContain('function syncInitialLangUI()');
        expect(html).not.toContain('function togglePaymentDropdown()');
        expect(html).not.toMatch(/\son(submit|input|change|focus)=/);
    });

    it('3. vercel.json omits no-store on browser Cache-Control for / and /index.html to preserve BFCache', () => {
        const vercel = JSON.parse(readFileSync(resolve(__dirname, '../vercel.json'), 'utf8'));
        const rootRule = vercel.headers.find(h => h.source === '/');
        const indexRule = vercel.headers.find(h => h.source === '/index.html');

        expect(rootRule.headers.find(h => h.key === 'Cache-Control').value).not.toContain('no-store');
        expect(indexRule.headers.find(h => h.key === 'Cache-Control').value).not.toContain('no-store');
        expect(rootRule.headers.find(h => h.key === 'CDN-Cache-Control').value).toContain('no-store');
    });

    it('4. catalog.js updateSidebarCounters updates badges via textContent and single-pass sizeCounts Map', () => {
        const catalog = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
        expect(catalog).toContain('const setFilterCountBadge = (el, count) =>');
        expect(catalog).toContain('const sizeCounts = new Map()');
        expect(catalog).not.toContain("link.innerHTML.split('<span')");
        expect(catalog).not.toContain("labelSpan.innerHTML.split('<span')");
    });

    it('5. style.css moves card-slide-img styles out of catalog.js inline templates and trims unused will-change', () => {
        const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
        const catalog = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');

        expect(css).toContain('.card-slide-img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }');
        expect(css).not.toContain('will-change: max-height, opacity;');
        expect(css).not.toContain('will-change: opacity, backdrop-filter;');
        expect(catalog).not.toContain('style="width:100%; height:100%; object-fit:cover; display:block; opacity:0; transition:opacity 0.2s ease; pointer-events:none;"');
    });

    it('6. catalog.js deduplicates foreground sync events with cooldown and uses 25s polling; product.js uses async image decoding', () => {
        const catalog = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
        const product = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');

        expect(catalog).toContain('const triggerForegroundSync = () =>');
        expect(catalog).toContain('if (now - _lastForegroundSyncAt < 2500) return;');
        expect(catalog).toContain('}, 25000);');
        expect(product).toContain('<img class="modal-slide-img" src="${cdnUrl}" ${loadAttr} decoding="async"');
        expect(product).toContain('<img class="similar-slide-img" src="${sImg}" loading="lazy" decoding="async"');
    });

    it('7. cart.js uses CSP-safe delegated touch listeners for swipe-to-delete instead of inline ontouch* attributes', () => {
        const cart = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');

        expect(cart).not.toContain('ontouchstart=');
        expect(cart).not.toContain('ontouchmove=');
        expect(cart).not.toContain('ontouchend=');
        expect(cart).toContain('list._swipeDelegatedBound');
        expect(cart).toContain('function resolveSwipeSurface(e)');
        expect(cart).toContain('cartSwipeCurrentX = cartSwipeStartX;');
    });

    it('8. favorite add/remove toasts reuse compact toast-new-item sizing and layout', () => {
        const helpers = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        const profile = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf8');
        const style = readFileSync(resolve(__dirname, '../style.css'), 'utf8').replace(/\r\n/g, '\n');

        expect(helpers).toContain('function showFavoriteToast(');
        expect(helpers).toContain("className: `toast-fav-item${isAdded ? '' : ' toast-fav-removed'}`");
        expect(profile).toContain('window.showFavoriteToast(itemObj, false, imgUrl)');
        expect(profile).toContain('window.showFavoriteToast(itemObj, true, imgUrl)');
        expect(style).toContain('.toast.toast-new-item,\n.toast.toast-fav-item,\n.toast.toast-lang-item,\n.toast.toast-cart-item,\n.toast.toast-sale-item,\n.toast.toast-review-item');
        expect(style).toContain('.toast.toast-new-item,\n    .toast.toast-fav-item,\n    .toast.toast-lang-item,\n    .toast.toast-cart-item,\n    .toast.toast-sale-item,\n    .toast.toast-review-item');
    });

    it('9. language change toast uses compact toast-lang-item sizing and catalog double-tap uses 260ms window', () => {
        const helpers = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        const i18n = readFileSync(resolve(__dirname, '../js/core/i18n.js'), 'utf8');
        const catalog = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');

        expect(helpers).toContain('function showLanguageToast(');
        expect(helpers).toContain("className: 'toast-lang-item'");
        expect(i18n).toContain('window.showLanguageToast(normalized)');
        expect(catalog).toContain('const DOUBLE_TAP_DELAY_MS = 260;');
        expect(catalog).toContain('userFavs.some(id => String(id) === String(itemId))');
    });

    it('10. cart add/remove, sale, and review toasts use unified compact toast helpers', () => {
        const helpers = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        const cart = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf8');
        const catalog = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');
        const reviews = readFileSync(resolve(__dirname, '../js/reviews/reviews.js'), 'utf8');

        expect(helpers).toContain('function showCompactToast(');
        expect(helpers).toContain('function showCartToast(');
        expect(helpers).toContain('function showSaleToast(');
        expect(helpers).toContain('function showReviewToast(');
        expect(cart).toContain('window.showCartToast(item, true, getOptimizedImg(item))');
        expect(cart).toContain('window.showCartToast(cartItem, true, getOptimizedImg(cartItem))');
        expect(cart).toContain('window.showCartToast(removedItem, false, imgUrl)');
        expect(catalog).toContain('window.showSaleToast(item)');
        expect(reviews).toContain('window.showReviewToast(');
    });

    it('11. base .toast uses compact sizing globally on desktop and mobile', () => {
        const helpers = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        const style = readFileSync(resolve(__dirname, '../style.css'), 'utf8').replace(/\r\n/g, '\n');

        expect(style).toContain('.toast { background: rgba(10, 10, 10, 0.96); border: 1px solid var(--accent-green); color: #fff; padding: 6px 12px;');
        expect(style).toContain('.toast { max-width: 200px; width: auto; padding: 5px 10px; gap: 6px; font-size: 10.5px; }');
        expect(helpers).toContain('class="toast-item-thumb"');
    });

    it('12. background timers pause on visibilitychange and catalog double-tap covers full item-card', () => {
        const i18n = readFileSync(resolve(__dirname, '../js/core/i18n.js'), 'utf8');
        const sys = readFileSync(resolve(__dirname, '../js/ui/system-features.js'), 'utf8');
        const catalog = readFileSync(resolve(__dirname, '../js/catalog/catalog.js'), 'utf8');

        expect(i18n).toContain('function stopCursorBlink()');
        expect(i18n).toContain('if (document.hidden)');
        expect(i18n).toContain('window._searchTypewriterVisBound');
        expect(sys).toContain('function startPendingBroadcastPolling()');
        expect(sys).toContain('function stopPendingBroadcastPolling()');
        expect(catalog).toContain("const card = e.target.closest('.item-card');");
        expect(catalog).not.toContain('<div class="item-info" data-action="open-product"');
    });
});
