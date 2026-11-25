// ==========================================
// NISHA PRODUCT VIEWING HISTORY, SIMILAR ITEMS & SHARE MODULE
// ==========================================

import {
    getActiveOpenedItem,
    getCatalogItems,
    getStore,
    getSupabaseClient,
    getUser,
    getEscAttr,
    getEscHtml,
    toCDN,
    computeItemSimilarity
} from './product-state.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { isItemBargainEnabled } from '../catalog/catalog-card-markup.js';
import { getAcceptedBargain } from '../core/bargain-storage.js';
import { tSafe } from '../core/runtime-env.js';

const _preloadedSimilarUrls = new Set();
let _pendingSimilarImgUrls = [];
let _suppressHistoryRender = false;

function sanitizeHistoryMediaUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || (lower.startsWith('data:') && !lower.startsWith('data:image/'))) {
        return '';
    }
    return getEscAttr(trimmed);
}

function escapeHistoryCssUrl(rawUrl) {
    const safeAttr = sanitizeHistoryMediaUrl(rawUrl);
    if (!safeAttr) return '';
    return String(safeAttr)
        .replaceAll('(', '%28')
        .replaceAll(')', '%29');
}

/**
 * Eagerly preloads pending "Similar items" thumbnail images when the user starts
 * scrolling the product card or swiping/changing photos inside the modal.
 * @returns {number} Count of newly scheduled image preloads
 */
export function preloadSimilarItemsImages() {
    if (typeof document !== 'undefined') {
        document.querySelectorAll('.similar-slide-img[loading="lazy"]').forEach(imgEl => {
            imgEl.loading = 'eager';
            imgEl.setAttribute('loading', 'eager');
        });
    }
    if (_pendingSimilarImgUrls.length === 0) return 0;

    const urls = _pendingSimilarImgUrls.splice(0, _pendingSimilarImgUrls.length);
    let started = 0;
    urls.forEach(url => {
        if (!url || _preloadedSimilarUrls.has(url)) return;
        _preloadedSimilarUrls.add(url);
        if (typeof Image === 'function') {
            const img = new Image();
            img.decoding = 'async';
            img.src = url;
            started++;
        }
    });
    return started;
}

/**
 * Shares currently opened product URL via native Web Share API or clipboard fallback.
 */
export function shareItem() {
    const active = getActiveOpenedItem();
    if (!active) return;

    const rawLang = (typeof window !== 'undefined' && window.currentSiteLang) || (typeof i18next !== 'undefined' ? i18next.language : 'ua');
    const activeLang = typeof normalizeSiteLang === 'function'
        ? normalizeSiteLang(rawLang)
        : (rawLang === 'ru' || rawLang === 'en' ? rawLang : 'ua');
    const fallbackPrefix = activeLang === 'en' ? 'Check out:' : (activeLang === 'ru' ? 'Зацени:' : 'Заціни:');
    const sharePrefix = typeof i18next !== 'undefined'
        ? i18next.t('product.share_check_out', { defaultValue: fallbackPrefix })
        : fallbackPrefix;

    const shareUrl = `https://www.nisha-store.shop/share/${active.id}?lang=${activeLang}`;
    const shareTitle = `NISHA | ${active.brand} - ${active.name}`;
    const shareText = `${sharePrefix} ${active.brand} (${active.size}).`;

    const successMsg = typeof i18next !== 'undefined'
        ? i18next.t('messages.link_copied', { defaultValue: 'Ссылка скопирована!' })
        : 'Ссылка скопирована!';

    if (hasAction('shareContent')) {
        invokeAction('shareContent', {
            title: shareTitle,
            text: shareText,
            url: shareUrl,
            fallbackMsg: successMsg
        });
    } else if (hasAction('copyToClipboard')) {
        invokeAction('copyToClipboard', shareUrl, successMsg);
    }
}

/**
 * Renders similar items recommendation blocks (mobile + desktop containers).
 * @param {object} item
 */
export function renderSimilarItems(item) {
    const simCont = document.getElementById('similarItemsContainer');
    const simContDesktop = document.getElementById('similarItemsContainerDesktop');
    if (!simCont && !simContDesktop) return;

    if (simCont) {
        if (typeof simCont.replaceChildren === 'function') simCont.replaceChildren();
        else simCont.innerHTML = '';
    }
    if (simContDesktop) {
        if (typeof simContDesktop.replaceChildren === 'function') simContDesktop.replaceChildren();
        else simContDesktop.innerHTML = '';
    }

    const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
    const catalog = getCatalogItems();

    const candidates = catalog.filter(i => {
        if (i.id === item.id) return false;
        if (i.status === 'sold') return false;
        if (hideUnavailable && i.status !== 'available') return false;
        return true;
    });

    const scoredCandidates = candidates.map(c => ({
        item: c,
        score: computeItemSimilarity(item, c)
    }));

    const sortScoreFn = (a, b) => b.score - a.score;
    const sortedCandidates = hasAction('toSorted')
        ? invokeAction('toSorted', scoredCandidates, sortScoreFn)
        : (scoredCandidates.toSorted ? scoredCandidates.toSorted(sortScoreFn) : [...scoredCandidates].sort(sortScoreFn));

    const similar = sortedCandidates.slice(0, 6).map(c => c.item);
    _pendingSimilarImgUrls = [];
    const store = getStore();
    const seenItemsIds = store ? store.getJSON('nisha_seen_items', []) : [];

    if (similar.length > 0) {
        let cardsHTML = '';
        similar.forEach(s => {
            const rawSimUrl = s.thumbnails?.[0] || s.images?.[0];
            const sImg = rawSimUrl
                ? toCDN(rawSimUrl, { isThumb: true, width: 320, quality: 80 })
                : (typeof getOptimizedImg === 'function' ? getOptimizedImg(s, true) : '');
            if (sImg && !sImg.endsWith('.mp4') && !_preloadedSimilarUrls.has(sImg)) {
                _pendingSimilarImgUrls.push(sImg);
            }
            let miniBadgeHTML = '';
            const hasSale = s.is_sale;
            const hasHot = (s.views_count || 0) >= 25;
            const isTop = s.is_top === true && s.top_until && Date.parse(s.top_until) > Date.now();
            const hasBargain = isItemBargainEnabled(s);

            if ((hasSale || hasHot || isTop || hasBargain) && s.status === 'available') {
                const miniParts = [];
                if (isTop) {
                    miniParts.push(`<span style="color: #cc00ff;"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: -1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> TOP</span>`);
                }
                if (hasSale) miniParts.push(`<span style="color: #cc0000;">% SALE</span>`);
                if (hasHot) {
                    miniParts.push(`<span style="color: #0044cc;"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: -1px;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg> HOT</span>`);
                }
                if (hasBargain) {
                    miniParts.push(`<span style="color: #007a1f;"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: -1px;"><path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg> BID</span>`);
                }
                miniBadgeHTML = `<div style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; display: flex; align-items: center; gap: 4px; padding: 1px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none;">${miniParts.join('<div style="width: 1px; height: 8px; background: #888;"></div>')}</div>`;
            }

            const curr = typeof getCurrency === 'function' ? getCurrency() : 'грн';
            const formattedSimilarPrice = (typeof formatPrice === 'function') ? formatPrice(s.price) : `${s.price} ${curr}`;
            let miniPriceHTML = formattedSimilarPrice;
            if (s.is_sale && s.old_price) {
                const formattedOld = (typeof formatPrice === 'function') ? formatPrice(s.old_price, { numberOnly: true }) : s.old_price;
                miniPriceHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 9px; margin-right: 4px;">${formattedOld}</span><span style="color: var(--accent-green);">${formattedSimilarPrice}</span>`;
            }
            const simBargain = s.status === 'available' ? getAcceptedBargain(s.id) : null;
            if (simBargain && simBargain.acceptedPrice) {
                const origSimPrice = getEscHtml(simBargain.originalPrice || s.price);
                const accSimPrice = getEscHtml(simBargain.acceptedPrice);
                miniPriceHTML = `<span class="history-old-price history-old-price--bargain">${origSimPrice} ${curr}</span><span class="history-current-price--bargain">${accSimPrice} ${curr}</span>`;
            }

            const isUnseen = !seenItemsIds.includes(s.id) && s.status === 'available';
            const unseenClass = isUnseen ? 'is-unseen' : '';

            let statusOverlayHTML = '';
            let imageFilter = '';

            if (s.status === 'sold') {
                statusOverlayHTML = `<div class="sold-badge" style="font-size: 14px !important; letter-spacing: 2px !important; padding: 2px 8px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">SOLD</div>`;
                imageFilter = 'filter: grayscale(80%) brightness(0.5);';
                miniPriceHTML = `<span style="color:#888; text-decoration:line-through;">${getEscHtml(s.price)} ${curr}</span>`;
            } else if (s.status === 'reserved') {
                statusOverlayHTML = `<div class="reserved-badge" style="font-size: 11px !important; letter-spacing: 1px !important; padding: 2px 4px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">RESERVED</div>`;
                imageFilter = 'filter: brightness(0.6);';
            }

            let imageBlockHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#555; font-family:var(--font-mono); font-size:10px;">NO FOTO</div>`;

            const safeSimImg = sanitizeHistoryMediaUrl(sImg);
            if (safeSimImg) {
                if (sImg.endsWith('.mp4')) {
                    imageBlockHTML = `<video src="${safeSimImg}#t=0.001" style="width:100%; height:100%; object-fit:cover; pointer-events:none; ${imageFilter} transition: 0.3s;" preload="metadata"></video>`;
                } else {
                    imageBlockHTML = `<img class="similar-slide-img" src="${safeSimImg}" loading="lazy" decoding="async" style="width:100%; height:100%; object-fit:cover; display:block; ${imageFilter} transition: 0.3s;">`;
                }
            }

            cardsHTML += `
                <div class="similar-item-card ${unseenClass}" 
                     data-action="open-product" data-hover-action="similar-item-tooltip" data-id="${getEscAttr(s.id)}"
                     data-tooltip-move="1"
                     data-tooltip-leave="1"
                     role="button">
                    <div class="similar-card-img-wrap">
                        ${miniBadgeHTML}
                        ${statusOverlayHTML}
                        ${imageBlockHTML}
                    </div>
                    <div class="similar-card-price">${miniPriceHTML}</div>
                </div>`;
        });
        if (simCont) simCont.innerHTML = cardsHTML;
        if (simContDesktop) simContDesktop.innerHTML = cardsHTML;

        if (hasAction('observeGridVideo')) {
            document.querySelectorAll('.similar-card-img-wrap video').forEach(v => {
                invokeAction('observeGridVideo', v);
            });
        }
    } else {
        const noItemsText = tSafe('product.no_similar', 'Похожих товаров пока нет.');
        const emptyHTML = `<div style="color:#555; font-size:12px; font-family: var(--font-mono);">${noItemsText}</div>`;
        if (simCont) simCont.innerHTML = emptyHTML;
        if (simContDesktop) simContDesktop.innerHTML = emptyHTML;
    }
}

/**
 * Adds an item to local viewing history (capped at 30) and re-renders the history drawer.
 * @param {object} item
 */
export function addToHistory(item) {
    const store = getStore();
    let hist = store ? store.getJSON('nisha_history', []) : [];
    hist = hist.filter(i => i.id !== item.id);
    const img = (typeof getOptimizedImg === 'function' ? getOptimizedImg(item, true) : '') || ((item.images && item.images.length > 0) ? item.images.at(0) : '');

    hist.unshift({
        id: item.id,
        name: item.name,
        price: item.price,
        old_price: item.old_price,
        is_sale: item.is_sale,
        img
    });

    if (hist.length > 30) hist = hist.slice(0, 30);

    if (store) store.setJSON('nisha_history', hist);
    renderHistory();
}

/**
 * Renders the viewing history grid and syncs viewed item IDs with Supabase profile.
 */
export function renderHistory() {
    if (_suppressHistoryRender) return;
    const store = getStore();
    let hist = store ? store.getJSON('nisha_history', []) : [];
    const container = document.getElementById('historyGrid');
    const section = document.getElementById('historySection');

    if (!container || !section) return;

    const catalog = getCatalogItems();
    if (catalog.length > 0) {
        const validHist = hist.filter(h => catalog.some(dbItem => dbItem.id === h.id));
        if (validHist.length !== hist.length) {
            hist = validHist;
            if (store) store.setJSON('nisha_history', hist);
        }
    }

    if (hist.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    if (typeof container.replaceChildren === 'function') container.replaceChildren();
    else container.innerHTML = '';

    const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
    const fragment = document.createDocumentFragment();
    const cardsForTilt = [];

    hist.forEach(h => {
        const realItem = catalog.find(i => i.id === h.id);
        const currentStatus = realItem ? realItem.status : 'available';

        if (hideUnavailable && currentStatus !== 'available') return;

        const rawHistUrl = realItem ? (realItem.thumbnails?.[0] || realItem.images?.[0] || h.img) : h.img;
        const optImg = rawHistUrl
            ? toCDN(rawHistUrl, { isThumb: true, width: 320, quality: 80 })
            : (realItem && typeof getOptimizedImg === 'function' ? getOptimizedImg(realItem, true) : '');
        const isVideo = optImg && optImg.endsWith('.mp4');
        const livePrice = realItem ? realItem.price : h.price;
        const liveOldPrice = realItem ? realItem.old_price : h.old_price;
        const liveIsSale = realItem ? !!realItem.is_sale : !!h.is_sale;
        const liveName = realItem && realItem.name ? realItem.name : h.name;
        const liveIsTop = !!(realItem && realItem.is_top === true && realItem.top_until && Date.parse(realItem.top_until) > Date.now());
        const liveIsHot = !!(realItem && (realItem.views_count || 0) >= 25);

        let finalPriceHTML = '';
        const curr = typeof getCurrency === 'function' ? getCurrency() : 'грн';
        const formattedHistoryPrice = (typeof formatPrice === 'function') ? formatPrice(livePrice) : `${livePrice} ${curr}`;
        if (liveIsSale && liveOldPrice) {
            const formattedOld = (typeof formatPrice === 'function') ? formatPrice(liveOldPrice) : `${liveOldPrice} ${curr}`;
            finalPriceHTML = `<span style="color:#4a704a; text-decoration:line-through; font-size:10px; margin-right:4px;">${formattedOld}</span>${formattedHistoryPrice}`;
        } else {
            finalPriceHTML = formattedHistoryPrice;
        }

        let statusOverlayHTML = '';
        let imageFilter = '';

        if (currentStatus === 'sold') {
            statusOverlayHTML = `<div class="sold-badge" style="font-size: 16px !important; letter-spacing: 2px !important; padding: 2px 10px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">SOLD</div>`;
            imageFilter = 'filter: grayscale(80%) brightness(0.5);';
        } else if (currentStatus === 'reserved') {
            statusOverlayHTML = `<div class="reserved-badge" style="font-size: 14px !important; letter-spacing: 1px !important; padding: 2px 5px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">RESERVED</div>`;
            imageFilter = 'filter: brightness(0.6);';
        }

        const card = document.createElement('div');
        card.className = 'history-card';
        card.setAttribute('data-action', 'open-product');
        card.setAttribute('data-id', h.id);

        let mediaHTML = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#555;">NO FOTO</div>';

        if (optImg) {
            if (isVideo) {
                const safeVideoUrl = sanitizeHistoryMediaUrl(optImg);
                if (safeVideoUrl) {
                    mediaHTML = `
                    <video src="${safeVideoUrl}#t=0.001" muted playsinline webkit-playsinline preload="metadata" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; ${imageFilter} transition: 0.3s;"></video>
                    <div style="position:absolute; z-index:5; top:4px; left:4px; background:rgba(0,0,0,0.8); padding:2px 4px; border-radius:2px; color:var(--accent-green); font-size:8px; font-family:var(--font-mono); border: 1px solid #333; pointer-events: none;">▶ VIDEO</div>
                `;
                }
            } else {
                const safeBgUrl = escapeHistoryCssUrl(optImg);
                if (safeBgUrl) {
                    mediaHTML = `<div style="width:100%; height:100%; background-image:url('${safeBgUrl}'); background-size:cover; background-position:center; ${imageFilter} transition: 0.3s;"></div>`;
                }
            }
        }

        let miniBadgeHTML = '';
        const liveHasBargain = isItemBargainEnabled(realItem || h);
        if ((liveIsTop || liveIsSale || liveIsHot || liveHasBargain) && currentStatus === 'available') {
            const parts = [];
            const starSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-top:-1px; flex-shrink:0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            const chartSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-top:-1px; flex-shrink:0;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
            const gavelSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-top:-1px; flex-shrink:0;"><path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg>`;
            if (liveIsTop) parts.push(`<span style="color: #cc00ff; display: inline-flex; align-items: center; gap: 2px;">${starSvg} TOP</span>`);
            if (liveIsSale) parts.push(`<span style="color: #cc0000; display: inline-flex; align-items: center;">% SALE</span>`);
            if (liveIsHot) parts.push(`<span style="color: #0044cc; display: inline-flex; align-items: center; gap: 2px;">${chartSvg} HOT</span>`);
            if (liveHasBargain) parts.push(`<span style="color: #007a1f; display: inline-flex; align-items: center; gap: 2px;">${gavelSvg} BID</span>`);
            miniBadgeHTML = `<div class="system-status-bar history-status-bar" style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; display: flex; align-items: center; gap: 4px; padding: 1.5px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none; line-height: 1; transform: translateZ(25px);">${parts.join('<div style="width:1px;height:8px;background:#888;flex-shrink:0;"></div>')}</div>`;
        }

        const removeLabel = getEscAttr(tSafe('history.remove_item', 'Удалить'));
        card.innerHTML = `
            <div class="history-img" style="position: relative; overflow: hidden; padding: 0; background: #111;">
                ${mediaHTML}
                ${miniBadgeHTML}
                ${statusOverlayHTML}
                <button type="button" class="close-btn history-item-remove" data-action="remove-history-item" data-id="${getEscAttr(h.id)}" title="${removeLabel}" aria-label="${removeLabel}" style="z-index: 20;">X</button>
            </div>
            <div class="history-info">
                <div class="history-name" title="${getEscAttr(liveName)}" style="${currentStatus !== 'available' ? 'color:#888; text-decoration:line-through;' : ''}">${getEscHtml(liveName)}</div>
                <div class="history-price">${finalPriceHTML}</div>
            </div>`;

        fragment.appendChild(card);

        if (window.innerWidth > 900) {
            cardsForTilt.push(card);
        }
    });

    container.appendChild(fragment);

    if (cardsForTilt.length > 0) {
        const TiltLib = (typeof window !== 'undefined' && window.VanillaTilt) || (typeof VanillaTilt !== 'undefined' ? VanillaTilt : null);
        if (TiltLib && typeof TiltLib.init === 'function') {
            TiltLib.init(cardsForTilt, { max: 15, speed: 300, scale: 1.05 });
        } else {
            import('vanilla-tilt').then((mod) => {
                const Tilt = mod.default || mod;
                if (Tilt && typeof Tilt.init === 'function') {
                    window.VanillaTilt = Tilt;
                    Tilt.init(cardsForTilt, { max: 15, speed: 300, scale: 1.05 });
                }
            }).catch(() => {
                if (typeof loadExternalScript === 'function') {
                    loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.1/vanilla-tilt.min.js').then(() => {
                        if (typeof VanillaTilt !== 'undefined') {
                            VanillaTilt.init(cardsForTilt, { max: 15, speed: 300, scale: 1.05 });
                        }
                    }).catch(() => {});
                }
            });
        }
    }

    const currentUser = getUser();
    const sb = getSupabaseClient();
    if (currentUser && sb) {
        sb.from('profiles').update({ viewed_history: hist.map(h => h.id) }).eq('id', currentUser.id).then();
    }
}

/**
 * Toggles collapsed state of the viewing history drawer.
 */
export function toggleHistory() {
    const grid = document.getElementById('historyGrid');
    const arrow = document.getElementById('historyArrow');
    if (!grid) return;

    grid.classList.toggle('collapsed');

    if (arrow) {
        arrow.style.transform = grid.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
}

/**
 * Removes an item from viewing history and syncs with Supabase profile.
 * @param {Event|null} event
 * @param {string|number} itemId
 */
export function removeHistoryItem(event, itemId) {
    if (event) event.stopPropagation();

    const targetCard = (event && event.target && typeof event.target.closest === 'function'
        ? event.target.closest('.history-card')
        : null)
        || (typeof document !== 'undefined'
            ? Array.from(document.querySelectorAll('#historyGrid .history-card')).find(el => el.getAttribute('data-id') === String(itemId))
            : null);

    const store = getStore();
    let hist = store ? store.getJSON('nisha_history', []) : [];
    hist = hist.filter(item => item.id !== itemId);

    if (store) {
        if (targetCard) _suppressHistoryRender = true;
        try {
            store.setJSON('nisha_history', hist);
        } finally {
            _suppressHistoryRender = false;
        }
    }

    const currentUser = getUser();
    const sb = getSupabaseClient();
    if (currentUser && sb) {
        sb.from('profiles').update({
            viewed_history: hist.map(h => h.id)
        }).eq('id', currentUser.id).then();
    }

    if (targetCard) {
        targetCard.style.pointerEvents = 'none';
        targetCard.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        targetCard.style.opacity = '0';
        targetCard.style.transform = 'scale(0.88)';
        setTimeout(() => {
            targetCard.remove();
            const remaining = document.querySelectorAll('#historyGrid .history-card').length;
            if (hist.length === 0 || remaining === 0) {
                const section = document.getElementById('historySection');
                if (section) section.style.display = 'none';
            }
        }, 220);
        return;
    }

    renderHistory();
}

registerActions({
    shareItem,
    preloadSimilarItemsImages,
    addToHistory,
    renderHistory,
    toggleHistory,
    removeHistoryItem
});

if (typeof window !== 'undefined') {
    window.renderHistory = renderHistory;
    window.removeHistoryItem = removeHistoryItem;
}
