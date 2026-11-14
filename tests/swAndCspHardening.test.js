import { describe, it, expect } from 'vitest';
import { readProjectCss } from './helpers/readProjectCss.js';
import { readCatalogSource } from './helpers/readCatalogSource.js';
import { readCartSource } from './helpers/readCartSource.js';
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
        const catalog = readCatalogSource();
        expect(catalog).toContain('const setFilterCountBadge = (el, count) =>');
        expect(catalog).toContain('const sizeCounts = new Map()');
        expect(catalog).not.toContain("link.innerHTML.split('<span')");
        expect(catalog).not.toContain("labelSpan.innerHTML.split('<span')");
    });

    it('5. style.css moves card-slide-img styles out of catalog.js inline templates and trims unused will-change', () => {
        const css = readProjectCss();
        const catalog = readCatalogSource();

        expect(css).toContain('.card-slide-img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }');
        expect(css).not.toContain('will-change: max-height, opacity;');
        expect(css).not.toContain('will-change: opacity, backdrop-filter;');
        expect(catalog).not.toContain('style="width:100%; height:100%; object-fit:cover; display:block; opacity:0; transition:opacity 0.2s ease; pointer-events:none;"');
    });

    it('6. catalog.js deduplicates foreground sync events with cooldown and uses 25s polling; product.js uses async image decoding', () => {
        const catalog = readCatalogSource();
        const product = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');

        expect(catalog).toContain('const triggerForegroundSync = () =>');
        expect(catalog).toContain('if (now - _lastForegroundSyncAt < 2500) return;');
        expect(catalog).toContain('}, 25000);');
        expect(product).toContain('<img class="modal-slide-img" src="${cdnUrl}" ${loadAttr} decoding="async"');
        expect(product).toContain('<img class="similar-slide-img" src="${sImg}" loading="lazy" decoding="async"');
    });

    it('7. cart.js uses CSP-safe delegated touch listeners for swipe-to-delete instead of inline ontouch* attributes', () => {
        const cart = readCartSource();

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
        const style = readProjectCss().replace(/\r\n/g, '\n');

        expect(helpers).toContain('function showFavoriteToast(');
        expect(helpers).toContain("className: `toast-fav-item${isAdded ? '' : ' toast-fav-removed'}`");
        expect(profile).toContain('window.showFavoriteToast(itemObj, false, imgUrl)');
        expect(profile).toContain('window.showFavoriteToast(itemObj, true, imgUrl)');
        expect(style).toContain('.toast.toast-new-item,\n.toast.toast-fav-item,\n.toast.toast-lang-item,\n.toast.toast-cart-item,\n.toast.toast-sale-item,\n.toast.toast-review-item');
        expect(style).toContain('.toast.toast-new-item,\n    .toast.toast-fav-item,\n    .toast.toast-lang-item,\n    .toast.toast-cart-item,\n    .toast.toast-sale-item,\n    .toast.toast-review-item');
    });

    it('9. language change toast uses compact toast-lang-item sizing and catalog double-tap uses 200ms window', () => {
        const helpers = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        const i18n = readFileSync(resolve(__dirname, '../js/core/i18n.js'), 'utf8');
        const catalog = readCatalogSource();

        expect(helpers).toContain('function showLanguageToast(');
        expect(helpers).toContain("className: 'toast-lang-item'");
        expect(i18n).toContain('window.showLanguageToast(normalized)');
        expect(catalog).toContain('const DOUBLE_TAP_DELAY_MS = 200;');
        expect(catalog).toContain('userFavs.some(id => String(id) === String(itemId))');
    });

    it('10. cart add/remove, sale, and review toasts use unified compact toast helpers', () => {
        const helpers = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        const cart = readCartSource();
        const catalog = readCatalogSource();
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
        const style = readProjectCss().replace(/\r\n/g, '\n');

        expect(style).toContain('.toast { background: rgba(10, 10, 10, 0.96); border: 1px solid var(--accent-green); color: #fff; padding: 6px 12px;');
        expect(style).toContain('height: 46px;');
        expect(style).toContain('.toast { max-width: 200px; width: auto; height: 40px; padding: 5px 10px; gap: 6px; font-size: 10.5px; }');
        expect(helpers).toContain('class="toast-item-thumb"');
    });

    it('11b. modular CSS architecture imports all css/ modules cleanly with balanced braces', () => {
        const entry = readFileSync(resolve(__dirname, '../style.css'), 'utf8');
        const imports = [...entry.matchAll(/@import\s+['"](\.\/css\/[^'"]+)['"]\s*;/g)].map(m => m[1]);
        expect(imports.length).toBeGreaterThanOrEqual(9);
        for (const rel of imports) {
            const modCss = readFileSync(resolve(__dirname, '..', rel), 'utf8');
            const opens = (modCss.match(/\{/g) || []).length;
            const closes = (modCss.match(/\}/g) || []).length;
            expect(opens).toBe(closes);
            expect(opens).toBeGreaterThan(0);
        }
    });

    it('12. background timers pause on visibilitychange and catalog double-tap covers full item-card', () => {
        const i18n = readFileSync(resolve(__dirname, '../js/core/i18n.js'), 'utf8');
        const sys = readFileSync(resolve(__dirname, '../js/ui/system-features.js'), 'utf8');
        const catalog = readCatalogSource();

        expect(i18n).toContain('function stopCursorBlink()');
        expect(i18n).toContain('if (document.hidden)');
        expect(i18n).toContain('window._searchTypewriterVisBound');
        expect(sys).toContain('function startPendingBroadcastPolling()');
        expect(sys).toContain('function stopPendingBroadcastPolling()');
        expect(catalog).toContain("const card = e.target.closest('.item-card');");
        expect(catalog).not.toContain('<div class="item-info" data-action="open-product"');
    });

    it('13. toasts support ARIA live status/alert, pause-on-hover/touch, and modals/sidebar contain overscroll', () => {
        const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
        const style = readProjectCss().replace(/\r\n/g, '\n');
        const helpers = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');

        expect(html).toContain('id=toastContainer aria-live=polite aria-atomic=false');
        expect(style).toContain('.toast:hover::after,\n.toast.toast-paused::after { animation-play-state: paused !important; }');
        expect(style).toMatch(/\.modal-overlay\s*\{[^}]*overscroll-behavior:\s*contain;/);
        expect(style).toMatch(/\.sidebar\.active-mobile\s*\{[^}]*overscroll-behavior:\s*auto;\s*touch-action:\s*pan-y;/);
        expect(helpers).toContain("toast.setAttribute('role', isAlert ? 'alert' : 'status');");
        expect(helpers).toContain('function attachToastLifecycle(');
        expect(helpers).toContain('const pauseDismiss = () => {');
        expect(helpers).toContain('const resumeDismiss = () => {');
        expect(style).toContain('.toast.toast-leaving { animation: slideOutRightSmooth 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards !important; }');
    });

    it('14. mobile touchstart prioritizes 2nd slide image fetchPriority in catalog cards', () => {
        const catalog = readCatalogSource();

        expect(catalog).toContain('function activateCardSlides(target, prioritizeNext = false)');
        expect(catalog).toContain('activateCardSlides(wrapper, true);');
        expect(catalog).toContain("secondImg.fetchPriority = 'high';");
    });

    it('15. web-locks releases on pagehide without beforeunload and rum prefers userAgentData.platform', () => {
        const webLocks = readFileSync(resolve(__dirname, '../js/core/web-locks.js'), 'utf8');
        const rum = readFileSync(resolve(__dirname, '../js/core/rum.js'), 'utf8');

        expect(webLocks).toContain("window.addEventListener('pagehide', resolve, { once: true });");
        expect(webLocks).not.toContain('beforeunload');
        expect(rum).toContain('navigator.userAgentData?.platform || navigator.platform');
    });

    it('16. withButtonBusy protects question and review submit buttons against double clicks', () => {
        const helpers = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        const style = readProjectCss();
        const product = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');
        const reviews = readFileSync(resolve(__dirname, '../js/reviews/reviews.js'), 'utf8');

        expect(helpers).toContain('async function withButtonBusy(');
        expect(style).toContain('button.is-loading, .is-loading[disabled]');
        expect(product).toContain("window.withButtonBusy('[data-action=\"submit-question\"]'");
        expect(reviews).toContain("window.withButtonBusy('[data-action=\"submit-auto-review\"]'");
        expect(reviews).toContain("window.withButtonBusy('#writeReviewModal .cart-checkout-btn'");
    });

    it('17. modal close unlocks scroll immediately without focus scroll jump or closing-phase grid restyle', () => {
        const windowsJs = readFileSync(resolve(__dirname, '../js/ui/windows.js'), 'utf8');
        const style = readProjectCss();

        expect(windowsJs).toContain('modal._returnFocusElement.focus({ preventScroll: true });');
        expect(windowsJs).toContain('window._preModalScrollY = null;');
        expect(windowsJs).toContain("if (document.documentElement && document.documentElement.style) document.documentElement.style.overflow = '';");
        expect(style).toContain('body:has(.modal-overlay[style*="display: flex"]:not(.closing)) #itemsGrid');
    });

    it('18. product modal opens smoothly at 190ms with pointerdown prewarm decode, cached thumb placeholder, and slower typewriter across modals', () => {
        const productJs = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');
        const catalogJs = readCatalogSource();
        const style = readProjectCss();

        expect(productJs).toContain('if (typeof img.decode === "function") img.decode().catch(() => {});');
        expect(productJs).toContain("url('${safeThumbBg}') center/contain no-repeat");
        expect(productJs).toContain('setTimeout(() => {');
        expect(productJs).toContain('if (typeof ensurePhotoSwipe === \'function\') ensurePhotoSwipe();');
        expect(productJs).toContain('setTimeout(() => addToHistory(item), 0);');
        expect(catalogJs).toContain("grid.addEventListener('pointerdown'");
        expect(catalogJs).toContain('const DOUBLE_TAP_DELAY_MS = 200;');
        expect(style).toContain('animation: modalPopDesktop 0.19s');
        expect(style).toContain('transition: opacity 0.19s cubic-bezier(0.16, 1, 0.3, 1)');
        expect(style).toContain('animation: typing 1.2s steps(36, end)');
    });

    it('19. product modal displays publish date next to views counter separated by a dot in unified muted mono style', () => {
        const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
        const productJs = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');
        const style = readProjectCss();

        expect(html).toContain('class=item-meta-row');
        expect(html).toContain('id=modalItemPublishedWrap');
        expect(html).toContain('class=item-meta-dot');
        expect(html).not.toContain('data-i18n=product.published');
        expect(productJs).toContain('item.published_at || item.created_at');
        expect(style).toContain('.item-views, .item-published');
        expect(style).toContain('justify-content: flex-start');
    });

    it('20. mobile modal swipe-to-dismiss tracks finger 1:1 without animation override and glides out from release position', () => {
        const windowsJs = readFileSync(resolve(__dirname, '../js/ui/windows.js'), 'utf8');
        const style = readProjectCss();

        expect(windowsJs).toContain("modalWin.style.animation = 'none';");
        expect(windowsJs).toContain('isHeaderTouch');
        expect(windowsJs).toContain('translate3d(0, ${dragY}px, 0)');
        expect(windowsJs).toContain('overlay._swipeClosing = true;');
        expect(style).toContain('.modal-overlay.closing.swipe-closing');
        expect(style).toContain('touch-action: none;');
        expect(style).toContain('border: 1px solid #555 !important; border-bottom: none !important;');
    });
});
