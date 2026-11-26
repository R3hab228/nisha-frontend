// @ts-check
// ==========================================
// NISHA PRODUCT MODAL LIFECYCLE & DETAILS RENDERING MODULE
// ==========================================

import {
    getActiveOpenedItem,
    setActiveOpenedItem,
    getActiveCartSafe,
    getCatalogItems,
    getEscAttr,
    getEscHtml,
    getFavs,
    getFingerprint,
    getStore,
    getSupabaseClient,
    getUser,
    parseItemBargainInfo,
    getBargainOfferState,
    applyOfferButtonState,
    fetchFullItemFromDb,
    updateProductSeoAndOg
} from './product-state.js';
import { renderModalSlider } from './product-gallery.js';
import { addToHistory, preloadSimilarItemsImages, renderSimilarItems } from './product-history.js';
import { loadItemQuestions } from './product-qa.js';
import { parseItemMeasurements, renderMeasurementsTableHtml } from './product-measurements.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getLenisInstance, isSiteHackedMode, tSafe } from '../core/runtime-env.js';

function closeSecondaryOverlays() {
    const closeModalFn = /** @type {any} */ (globalThis).closeModal;
    if (typeof closeModalFn !== 'function') return;
    const om = document.getElementById('ordersModal');
    if (om && (om.style.display === 'flex' || om.style.display === 'block')) closeModalFn('ordersModal');
    const rm = document.getElementById('reviewsModal');
    if (rm && (rm.style.display === 'flex' || rm.style.display === 'block')) closeModalFn('reviewsModal');
}

/**
 * @param {any} item
 * @param {string} [qaPart='']
 */
function renderModalDescriptionContent(item, qaPart = '') {
    const defaultDesc = tSafe('product.default_desc', 'Оригинал. Любые проверки. Отличное состояние. Дополнительные замеры по запросу в ЛС.');
    const rawDesc = item.description ? String(item.description) : defaultDesc;
    const { measurements, cleanText } = parseItemMeasurements(rawDesc);
    const bodyText = (cleanText || (measurements.length > 0 ? '' : defaultDesc)).replaceAll('\r', '').replaceAll('\n', '<br>');
    const domPurify = /** @type {any} */ (globalThis).DOMPurify;
    const safeDescHtml = bodyText
        ? `<div style="color: #aaa; font-size: 13px;">${domPurify ? domPurify.sanitize(bodyText) : getEscHtml(bodyText)}</div>`
        : '';
    const measurementsHtml = renderMeasurementsTableHtml(measurements, getEscHtml);
    const sizeTitle = tSafe('product.size', 'РАЗМЕР');
    const brandTitle = tSafe('product.brand', 'БРЕНД');

    return `
        <div style="margin-bottom: 5px;">
            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${sizeTitle}</span></strong> 
            <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${getEscHtml(item.size)}</span>
        </div>
        <div style="margin-bottom: 15px;">
            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${brandTitle}</span></strong> 
            <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${getEscHtml(item.brand)}</span>
        </div>
        ${safeDescHtml}
        ${measurementsHtml}
    ` + qaPart;
}

/** @param {any} item */
function renderTrustBadges(item) {
    const badgesContainer = document.querySelector('.trust-badges');
    if (!badgesContainer) return;

    const normalizedTags = Array.isArray(item.tags)
        ? item.tags.map((/** @type {any} */ t) => String(t).toLowerCase())
        : (typeof item.tags === 'string' ? item.tags.split(',').map((/** @type {string} */ t) => t.trim().toLowerCase()) : []);
    const isDropItem = item.is_drop === true || normalizedTags.includes('drop');
    const isReturnable = item.is_returnable === true;

    let refundBadgeHTML = '';
    if (isDropItem) {
        const alertSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        refundBadgeHTML = `
            <div class="badge-item danger-badge" data-action="show-badge-info" data-badge="drop">
                <span class="badge-icon">${alertSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_drop">${tSafe('product.badge_drop', 'DROP ITEM')}</span>
            </div>`;
    } else if (isReturnable) {
        const returnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
        refundBadgeHTML = `
            <div class="badge-item" data-action="show-badge-info" data-badge="refund_yes">
                <span class="badge-icon">${returnSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_refund">${tSafe('product.badge_refund', 'ВОЗВРАТ 14 ДНЕЙ')}</span>
            </div>`;
    } else {
        const noReturnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
        refundBadgeHTML = `
            <div class="badge-item" data-action="show-badge-info" data-badge="refund_no">
                <span class="badge-icon">${noReturnSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_norefund">${tSafe('product.badge_norefund', 'БЕЗ ВОЗВРАТА')}</span>
            </div>`;
    }

    const secureSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`;
    const { hasBargain, itemMinBargain } = parseItemBargainInfo(item);

    let deliveryOrBargainBadgeHTML = '';
    if (hasBargain) {
        const gavelSvg = `<svg width="18" height="18" viewBox="30 30 205 170" fill="var(--accent-green, #00ff66)" stroke="none" aria-hidden="true"><path d="M128 37 L135 38 L170 67 L177 74 L177 81 L173 84 L165 82 L129 52 L124 47 L124 41 L127 38 Z M124 54 L126 54 L162 84 L162 86 L126 129 L123 132 L120 130 L85 101 L123 55 Z M77 101 L83 104 L118 133 L124 140 L123 146 L118 149 L112 147 L77 118 L70 110 L71 104 L76 102 Z M149 107 L222 163 L227 169 L226 176 L221 180 L216 180 L208 174 L143 115 L148 108 Z M55 167 H133 C136 167 138 169 138 172 V174 C138 175.5 140 176.5 142 176.5 H145 C148.5 176.5 151 179 151 182.5 V188.5 C151 192 148.5 194.5 145 194.5 H43 C39.5 194.5 37 192 37 188.5 V182.5 C37 179 39.5 176.5 43 176.5 H46 C48 176.5 50 175.5 50 174 V172 C50 169 52 167 55 167 Z" /></svg>`;
        const curLang = (typeof i18next !== 'undefined' && i18next.language) ? i18next.language : 'ru';
        const fallbackBargainText = (curLang.startsWith('ua') || curLang.startsWith('uk')) ? 'Є ТОРГ' : (curLang.startsWith('en') ? 'BARGAIN' : 'ЕСТЬ ТОРГ');
        let bargainText = tSafe('product.badge_bargain', { defaultValue: fallbackBargainText });
        if (!bargainText || bargainText === 'product.badge_bargain') {
            bargainText = fallbackBargainText;
        }
        if (itemMinBargain) {
            const activeCode = (typeof window !== 'undefined' && typeof window.getActiveCurrencyCode === 'function')
                ? window.getActiveCurrencyCode()
                : 'UAH';
            if (activeCode && activeCode !== 'UAH' && typeof formatPrice === 'function') {
                const formattedMin = formatPrice(itemMinBargain).toUpperCase();
                if (curLang.startsWith('ua') || curLang.startsWith('uk')) {
                    bargainText = `ВІД ${formattedMin}`;
                } else if (curLang.startsWith('en')) {
                    bargainText = `FROM ${formattedMin}`;
                } else {
                    bargainText = `ОТ ${formattedMin}`;
                }
            } else if (curLang.startsWith('ua') || curLang.startsWith('uk')) {
                bargainText = `ВІД ${itemMinBargain} ГРН`;
            } else if (curLang.startsWith('en')) {
                bargainText = `FROM ${itemMinBargain} UAH`;
            } else {
                bargainText = `ОТ ${itemMinBargain} ГРН`;
            }
        }
        const badgeI18nAttr = itemMinBargain ? `data-min-bargain="${itemMinBargain}"` : 'data-i18n="product.badge_bargain"';
        deliveryOrBargainBadgeHTML = `
            <div class="badge-item" data-action="show-badge-info" data-badge="bargain">
                <span class="badge-icon">${gavelSvg}</span>
                <span class="badge-text" ${badgeI18nAttr}>${bargainText}</span>
            </div>`;
    } else {
        deliveryOrBargainBadgeHTML = `
            <div class="badge-item" data-action="show-badge-info" data-badge="fast">
                <span class="badge-icon">24H</span> 
                <span class="badge-text" data-i18n="product.badge_fast">${tSafe('product.badge_fast', 'БЫСТРАЯ ОТПРАВКА')}</span>
            </div>`;
    }

    badgesContainer.innerHTML = `
        <div class="badge-item" data-action="show-badge-info" data-badge="secure">
            <span class="badge-icon">${secureSvg}</span> 
            <span class="badge-text" data-i18n="product.badge_orig">${tSafe('product.badge_orig', 'БЕЗОПАСНАЯ СДЕЛКА')}</span>
        </div>
        ${deliveryOrBargainBadgeHTML}
        ${refundBadgeHTML}
    `;
}

/**
 * Opens product modal instantly from cached catalog (if present) and hydrates full details in background.
 * @param {string|number} itemId
 * @returns {Promise<void>}
 */
export async function openProductModalById(itemId) {
    invokeAction('hideItemMeasurementsTooltip');
    const catalog = /** @type {any[]} */ (getCatalogItems());
    const item = catalog.find(i => String(i.id) === String(itemId));

    const key = String(itemId);
    const prewarmedPromise = (typeof window !== 'undefined' && window._prewarmedItemDetails)
        ? window._prewarmedItemDetails.get(key)
        : null;

    const onFullItemLoaded = (/** @type {any} */ fullItem) => {
        if (!fullItem) return;
        const active = /** @type {any} */ (getActiveOpenedItem());
        if (active && String(active.id) === String(fullItem.id)) {
            const hadNoImages = (!active.images || active.images.length === 0) && (!active.thumbnails || active.thumbnails.length === 0);
            const hasFullImages = (fullItem.images && fullItem.images.length > 0) || (fullItem.thumbnails && fullItem.thumbnails.length > 0);
            const hadBargain = parseItemBargainInfo(active).hasBargain;
            const nowHasBargain = parseItemBargainInfo(fullItem).hasBargain;

            const mergedItem = { ...active, ...fullItem };
            setActiveOpenedItem(mergedItem);
            if (typeof window !== 'undefined' && Array.isArray(window.allItems)) {
                const idx = window.allItems.findIndex(it => it && String(it.id) === String(fullItem.id));
                if (idx !== -1) window.allItems[idx] = { ...window.allItems[idx], ...fullItem };
            }

            if (hadNoImages && hasFullImages) {
                closeSecondaryOverlays();
                openProductModal(mergedItem);
                return;
            }
            if (hadBargain !== nowHasBargain) {
                const isBargainFlagEnabled = (typeof window !== 'undefined' && window.analytics && typeof window.analytics.isFeatureEnabled === 'function')
                    ? window.analytics.isFeatureEnabled('enable_bargain', true)
                    : true;
                const showBargain = nowHasBargain && isBargainFlagEnabled && mergedItem.status !== 'sold';
                const offerWrapper = document.getElementById('offerPriceWrapper');
                const offerPriceBtn = document.getElementById('modalOfferPriceBtn');
                if (offerWrapper) offerWrapper.style.display = showBargain ? 'block' : 'none';
                if (offerPriceBtn) offerPriceBtn.style.display = showBargain ? 'flex' : 'none';
                renderTrustBadges(mergedItem);
            }

            if (fullItem.description && String(active.description || '') !== String(fullItem.description || '')) {
                const descContainer = document.querySelector('.modal-desc');
                if (descContainer) {
                    const qaMarker = '<!-- Блок Вопросов и Ответов (Q&A) -->';
                    const qaIndex = descContainer.innerHTML.includes(qaMarker)
                        ? descContainer.innerHTML.indexOf(qaMarker)
                        : descContainer.innerHTML.indexOf('<div id="qaWrapper"');
                    const qaPart = qaIndex !== -1 ? descContainer.innerHTML.slice(qaIndex) : '';
                    descContainer.innerHTML = renderModalDescriptionContent(mergedItem, qaPart);
                }
            }
        }
    };

    if (item) {
        const cardInGrid = document.querySelector(`.item-card[data-id="${itemId}"]`);
        if (cardInGrid) cardInGrid.classList.remove('unseen-pulse');

        if (typeof window !== 'undefined' && window._seenItemsSet) {
            window._seenItemsSet.add(String(itemId));
        }
        setTimeout(() => {
            const store = /** @type {any} */ (getStore());
            let seenItemsIds = store ? store.getJSON('nisha_seen_items', []) : [];
            if (!seenItemsIds.includes(itemId)) {
                seenItemsIds.push(itemId);
                if (seenItemsIds.length > 200) seenItemsIds = seenItemsIds.slice(-200);
                if (store) store.setJSON('nisha_seen_items', seenItemsIds);
            }
        }, 0);

        closeSecondaryOverlays();
        openProductModal(item);
    }

    if (prewarmedPromise) {
        prewarmedPromise.then(onFullItemLoaded).catch(() => {});
    } else if (getSupabaseClient()) {
        try {
            const full = await fetchFullItemFromDb(itemId);
            if (!item && full) {
                closeSecondaryOverlays();
                openProductModal(full);
                return;
            }
            if (full) onFullItemLoaded(full);
        } catch (e) {
            console.error('Ошибка сети:', e);
        }
    }
}

/**
 * Renders full product modal dialog UI, media slider, views, badges, similar items, Q&A, and SEO metadata.
 * @param {any} item
 */
export function openProductModal(item) {
    const g = /** @type {any} */ (globalThis);
    setActiveOpenedItem(item);

    if (item && item.id) {
        document.querySelectorAll(`.item-card[data-id="${item.id}"]`).forEach(c => c.classList.remove('unseen-pulse'));
        if (typeof window !== 'undefined' && window._seenItemsSet) window._seenItemsSet.add(String(item.id));
    }

    setTimeout(() => {
        const ensurePhotoSwipe = g.ensurePhotoSwipe;
        if (typeof ensurePhotoSwipe === 'function') ensurePhotoSwipe();
    }, 0);

    if (hasAction('stopLenis')) invokeAction('stopLenis');
    else {
        const activeLenis = getLenisInstance();
        if (activeLenis) activeLenis.stop();
    }

    document.title = `NISHA | ${item.brand} - ${item.name}`;

    const titleEl = document.getElementById('modalItemTitle');
    if (titleEl) titleEl.textContent = item.name;

    const modalStar = document.getElementById('modalFavStar');
    const favs = getFavs();
    if (modalStar) {
        modalStar.style.removeProperty('color');
        modalStar.classList.toggle('active', favs.some(id => String(id) === String(item.id)));
    }

    const isHackedActive = isSiteHackedMode();
    const finalPrice = isHackedActive ? Math.floor(item.price * 0.9) : item.price;
    const priceEl = document.getElementById('modalItemPrice');
    if (priceEl) {
        priceEl.textContent = (typeof formatPrice === 'function')
            ? formatPrice(finalPrice)
            : (finalPrice + ' ' + (typeof getCurrency === 'function' ? getCurrency() : 'грн'));
    }

    try {
        const { acceptedData } = /** @type {any} */ (getBargainOfferState(item.id));
        const accPriceNum = Number(acceptedData && acceptedData.acceptedPrice);
        if (acceptedData && Number.isFinite(accPriceNum) && accPriceNum > 0 && priceEl) {
            const origPriceNum = Number(acceptedData.originalPrice ?? item.price);
            const safeOrig = Number.isFinite(origPriceNum) ? origPriceNum : 0;
            const cur = getEscHtml((typeof getCurrency === 'function' ? getCurrency() : 'грн').trim());
            const origFmt = (typeof formatPrice === 'function') ? getEscHtml(formatPrice(safeOrig)) : `${safeOrig} ${cur}`;
            const accFmt = (typeof formatPrice === 'function') ? getEscHtml(formatPrice(accPriceNum)) : `${accPriceNum} ${cur}`;
            priceEl.innerHTML = `<span style="text-decoration: line-through; color: #777; font-size: 0.75em; margin-right: 8px;">${origFmt}</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${accFmt}</span>`;
        }
    } catch {}

    const sizeDescEl = document.getElementById('modalItemSizeDesc');
    if (sizeDescEl) sizeDescEl.textContent = item.size;

    const brandEl = document.getElementById('modalItemBrand');
    if (brandEl) brandEl.textContent = item.brand;

    const condStr = item.condition || '9 / 10';
    const condMatch = condStr.match(/(\d+)/);
    const condNum = (condMatch && condMatch[1]) ? Number.parseInt(condMatch[1], 10) : 9;

    const condFill = document.getElementById('modalCondFill');
    if (condFill) condFill.style.width = (condNum * 10) + '%';

    const condText = document.getElementById('modalItemCond');
    if (condText) condText.textContent = condStr;

    if (condFill && condText) {
        let condColor = 'var(--accent-green)';
        if (condNum <= 3) condColor = 'var(--accent-red)';
        else if (condNum <= 6) condColor = '#ff9900';
        else if (condNum <= 8) condColor = 'var(--accent-yellow)';
        condFill.style.backgroundColor = condColor;
        condText.style.color = condColor;
    }

    const tagsContainer = document.getElementById('modalItemTags');
    if (tagsContainer) {
        if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
            tagsContainer.innerHTML = item.tags.slice(0, 3).map((/** @type {string} */ t) => `<span style="color: #fff; margin-right: 12px; letter-spacing: 0.5px;">#${getEscHtml(t)}</span>`).join('');
            tagsContainer.style.display = 'block';
        } else {
            tagsContainer.style.display = 'none';
            if (typeof tagsContainer.replaceChildren === 'function') tagsContainer.replaceChildren();
            else tagsContainer.innerHTML = '';
        }
    }

    const defaultDesc = 'Оригинал. Любые проверки. Отличное состояние. Дополнительные замеры по запросу в ЛС.';
    const rawDesc = item.description ? String(item.description) : defaultDesc;
    const cleanDesc = rawDesc.replace(/\s*\[ТОРГ:?[^\]]*\]/gi, '').trim();
    const descBlock = document.querySelector('.modal-desc');
    if (descBlock) {
        const qaShell = `
            <!-- БЛОК ВОПРОСОВ И ОТВЕТОВ (АККОРДЕОН) -->
            <div id="qaWrapper" class="qa-wrapper">
                <h4 class="qa-title" data-action="toggle-qa-section">
                    <span data-i18n="product.qa_title">${tSafe('product.qa_title', { defaultValue: 'Q&A: Вопросы покупателей' })}</span>
                    <span class="qa-arrow" style="transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1); color: var(--accent-green); display: inline-block;">▼</span>
                </h4>
                <div id="qaCollapseWrapper" class="qa-collapse-wrapper">
                    <div id="qaList" class="qa-content"></div>
                </div>
            </div>

            <!-- КНОПКА ЗАДАТЬ ВОПРОС -->
            <div style="margin-top: 15px; text-align: right;">
                <button data-action="toggle-question-form" class="ask-question-btn" data-i18n="product.ask_btn">${tSafe('product.ask_btn', { defaultValue: 'Задать вопрос?' })}</button>
            </div>
            <div id="questionFormContainer" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; margin-top: 5px;">
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <input type="text" id="questionInput" class="form-input" maxlength="100" placeholder="${getEscHtml(tSafe('product.ask_ph', { defaultValue: 'Ваш вопрос...' }))}" data-i18n-ph="product.ask_ph" style="font-size: 12px; padding: 8px;">
                    <button class="search-btn btn-target" data-action="submit-question" data-id="${getEscAttr(item.id)}" style="padding: 8px 15px; font-size: 12px;" data-i18n="product.ask_send">${tSafe('product.ask_send', { defaultValue: 'ОТПРАВИТЬ' })}</button>
                </div>
            </div>
        `;
        descBlock.innerHTML = renderModalDescriptionContent(item, qaShell);
    }

    const publishedWrap = document.getElementById('modalItemPublishedWrap');
    const publishedEl = document.getElementById('modalItemPublished');
    if (publishedWrap && publishedEl) {
        const rawPubDate = item.published_at || item.created_at;
        const pubMs = rawPubDate ? Date.parse(rawPubDate) : NaN;
        if (Number.isFinite(pubMs)) {
            const d = new Date(pubMs);
            publishedEl.textContent = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
            publishedWrap.style.display = 'flex';
        } else {
            publishedEl.textContent = '';
            publishedWrap.style.display = 'none';
        }
    }

    const viewCount = document.getElementById('modalItemViews');
    const sb = /** @type {any} */ (getSupabaseClient());
    if (viewCount) {
        viewCount.textContent = item.views_count || 0;

        if (sb) {
            const store = /** @type {any} */ (getStore());
            const viewedItems = store ? store.getJSON('nisha_added_views', []) : [];

            if (!viewedItems.includes(item.id)) {
                let visitorId = getFingerprint();
                if (!visitorId || visitorId.startsWith('guest_')) {
                    visitorId = (store ? store.get('nisha_visitor_id') : null) || ('user_' + (hasAction('generateShortId') ? invokeAction('generateShortId', 9) : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().replaceAll('-', '').slice(0, 9) : Date.now().toString(36))));
                }
                const currentUser = /** @type {any} */ (getUser());
                const viewerId = currentUser ? currentUser.id : visitorId;

                sb.rpc('increment_item_views', {
                    p_item_uuid: item.id,
                    p_viewer_id: viewerId
                }).then((/** @type {any} */ { data, error }) => {
                    if (!error && data !== null) {
                        const stillOpened = /** @type {any} */ (getActiveOpenedItem());
                        if (stillOpened && String(stillOpened.id) === String(item.id)) {
                            viewCount.textContent = data;
                        }
                        item.views_count = data;
                        if (typeof window !== 'undefined' && Array.isArray(window.allItems)) {
                            const catItem = window.allItems.find(i => i && String(i.id) === String(item.id));
                            if (catItem) catItem.views_count = data;
                        }
                        invokeAction('updateCardDOM', item);
                        viewedItems.push(item.id);
                        if (store) store.setJSON('nisha_added_views', viewedItems);
                    }
                });
            }
        }
    }

    const cartBtn = document.getElementById('modalCartBtn');
    if (cartBtn) {
        if (item.status === 'sold') {
            cartBtn.style.display = 'none';
        } else {
            cartBtn.style.display = 'block';
            const userCart = /** @type {any[]} */ (getActiveCartSafe());
            const isInCart = userCart.some(i => i && String(i.id) === String(item.id));
            const inCartText = tSafe('product.in_cart', { defaultValue: 'В КОРЗИНЕ' });
            const addToCartText = tSafe('product.add_to_cart', { defaultValue: 'В КОРЗИНУ' });
            cartBtn.textContent = isInCart ? inCartText : addToCartText;
        }
    }

    const offerWrapper = document.getElementById('offerPriceWrapper');
    const offerPriceBtn = document.getElementById('modalOfferPriceBtn');
    const offerInputRow = document.getElementById('offerPriceInputRow');
    const inlineInput = /** @type {HTMLInputElement | null} */ (document.getElementById('inlineBargainPriceInput'));

    if (offerWrapper || offerPriceBtn) {
        const { hasBargain } = parseItemBargainInfo(item);
        const isBargainFlagEnabled = (typeof window !== 'undefined' && window.analytics && typeof window.analytics.isFeatureEnabled === 'function')
            ? window.analytics.isFeatureEnabled('enable_bargain', true)
            : true;
        if ((item && item.status === 'sold') || !hasBargain || !isBargainFlagEnabled) {
            if (offerWrapper) offerWrapper.style.display = 'none';
            if (offerPriceBtn) offerPriceBtn.style.display = 'none';
            if (offerInputRow) offerInputRow.style.display = 'none';
        } else {
            if (offerWrapper) offerWrapper.style.display = 'block';
            const { isAcceptedBargain, isDeclinedBargain, isPendingBargain } = getBargainOfferState(item.id);
            if (offerPriceBtn) {
                offerPriceBtn.style.display = 'flex';
                offerPriceBtn.style.opacity = '1';
                offerPriceBtn.style.transform = 'translateY(0)';
                if (isDeclinedBargain) applyOfferButtonState(offerPriceBtn, 'declined');
                else if (isAcceptedBargain) applyOfferButtonState(offerPriceBtn, 'accepted');
                else if (isPendingBargain) applyOfferButtonState(offerPriceBtn, 'pending');
                else applyOfferButtonState(offerPriceBtn, 'default');
            }
            if (offerInputRow) {
                offerInputRow.style.display = 'none';
                offerInputRow.classList.remove('visible');
                offerInputRow.style.opacity = '0';
                offerInputRow.style.transform = 'translateY(4px)';
            }
            if (inlineInput) inlineInput.value = '';
        }
    }

    renderModalSlider(item);
    renderTrustBadges(item);

    const modalEl = document.getElementById('productModal');
    const isAlreadyOpen = Boolean(
        modalEl &&
        !modalEl.classList.contains('closing') &&
        (modalEl.classList.contains('is-open') || modalEl.style.display === 'flex')
    );

    if (!isAlreadyOpen) {
        if (item && item.id) {
            invokeAction('saveCurrentFeedScrollState', item.id);
        }
        if (typeof g.openModal === 'function') {
            g.openModal('productModal');
        } else if (modalEl) {
            invokeAction('playSound', 'start', { kind: 'ui' });
            modalEl.inert = false;
            modalEl.removeAttribute('inert');
            modalEl.classList.remove('closing');
            modalEl.style.pointerEvents = '';
            modalEl.setAttribute('aria-hidden', 'false');
            const win = /** @type {HTMLElement | null} */ (modalEl.querySelector('.modal-window'));
            if (win) {
                win.style.pointerEvents = '';
                win.style.transform = '';
                win.style.opacity = '';
                win.style.transition = '';
                win.style.animation = '';
            }
            modalEl.style.display = 'flex';
            if (!document.body.style.overflow || document.body.style.overflow !== 'hidden') {
                window._preModalScrollY = window.scrollY || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
            }
            document.body.style.overflow = 'hidden';
            if (typeof g.triggerModalTypewriter === 'function') {
                g.triggerModalTypewriter(modalEl);
            }
        }
    } else {
        invokeAction('playSound', 'start', { kind: 'ui' });
        if (modalEl) modalEl.style.pointerEvents = '';
        const win = /** @type {HTMLElement | null} */ (modalEl ? modalEl.querySelector('.modal-window') : null);
        if (win) win.style.pointerEvents = '';
        if (typeof g.triggerModalTypewriter === 'function') {
            g.triggerModalTypewriter(modalEl);
        }
    }

    if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => addToHistory(item));
    } else {
        Promise.resolve().then(() => addToHistory(item));
    }

    const modalWin = /** @type {any} */ (document.querySelector('#productModal .modal-window'));
    if (modalWin) {
        modalWin.style.pointerEvents = '';
        if (typeof modalWin.setAttribute === 'function') modalWin.setAttribute('data-lenis-prevent', 'true');
        if (!modalWin._similarPreloadBound && typeof modalWin.addEventListener === 'function') {
            modalWin._similarPreloadBound = true;
            modalWin.addEventListener('scroll', () => {
                if (modalWin.scrollTop > 0) {
                    preloadSimilarItemsImages();
                }
            }, { passive: true });
            modalWin.addEventListener('wheel', () => {
                preloadSimilarItemsImages();
            }, { passive: true });
            modalWin.addEventListener('touchmove', () => {
                preloadSimilarItemsImages();
            }, { passive: true });
        }
        if (isAlreadyOpen && modalWin.scrollTop > 20) {
            if (typeof modalWin.scrollTo === 'function') {
                try {
                    modalWin.scrollTo({ top: 0, behavior: 'smooth' });
                } catch (_) {
                    modalWin.scrollTop = 0;
                }
            } else {
                modalWin.scrollTop = 0;
            }
        } else {
            modalWin.scrollTop = 0;
            requestAnimationFrame(() => {
                const mWin = document.querySelector('#productModal .modal-window');
                if (mWin && mWin.scrollTop > 0) {
                    mWin.scrollTop = 0;
                }
            });
        }
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has('item')) {
        url.searchParams.delete('item');
        const curState = (window.history && window.history.state !== undefined) ? window.history.state : null;
        window.history.replaceState(curState, '', url.pathname + url.search);
    }

    if (sb) loadItemQuestions(item.id);

    const runDeferredModalWork = () => {
        const activeNow = /** @type {any} */ (getActiveOpenedItem());
        if (activeNow && String(activeNow.id) !== String(item.id)) return;
        renderSimilarItems(item);
        updateProductSeoAndOg(item, cleanDesc);
        if (typeof window !== 'undefined' && window.analytics && typeof window.analytics.trackProductView === 'function') {
            window.analytics.trackProductView(item);
        } else if (typeof window !== 'undefined' && window.ttq) {
            window.ttq.track('ViewContent', {
                content_id: item.id,
                content_name: item.name,
                value: item.price,
                currency: 'UAH'
            });
        }
    };
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(runDeferredModalWork);
    } else {
        runDeferredModalWork();
    }
}

/**
 * Toggles favorite status for the currently opened modal product.
 * @param {Event} event
 * @returns {Promise<void>}
 */
export async function toggleFavFromModal(event) {
    const active = /** @type {any} */ (getActiveOpenedItem());
    if (!active) return;

    const modalStar = document.getElementById('modalFavStar');
    if (modalStar) modalStar.blur();

    const g = /** @type {any} */ (globalThis);
    if (hasAction('toggleFav')) {
        await invokeAction('toggleFav', event, active.id);
    } else if (typeof g.toggleFav === 'function') {
        await g.toggleFav(event, active.id);
    }
}

/**
 * Точечно обновляет цену и бейдж минимального торга в уже открытой модалке товара
 * при мгновенном переключении валюты.
 * @param {any} [item]
 */
export function refreshOpenedProductModalPrices(item = getActiveOpenedItem()) {
    if (!item || typeof document === 'undefined') return;
    const isHackedActive = isSiteHackedMode();
    const finalPrice = isHackedActive ? Math.floor(item.price * 0.9) : item.price;
    const priceEl = document.getElementById('modalItemPrice');
    if (priceEl) {
        let renderedBargain = false;
        try {
            const { acceptedData } = /** @type {any} */ (getBargainOfferState(item.id));
            const accPriceNum = Number(acceptedData && acceptedData.acceptedPrice);
            if (acceptedData && Number.isFinite(accPriceNum) && accPriceNum > 0) {
                const origPriceNum = Number(acceptedData.originalPrice ?? item.price);
                const safeOrig = Number.isFinite(origPriceNum) ? origPriceNum : 0;
                const cur = getEscHtml((typeof getCurrency === 'function' ? getCurrency() : 'грн').trim());
                const origFmt = (typeof formatPrice === 'function') ? getEscHtml(formatPrice(safeOrig)) : `${safeOrig} ${cur}`;
                const accFmt = (typeof formatPrice === 'function') ? getEscHtml(formatPrice(accPriceNum)) : `${accPriceNum} ${cur}`;
                priceEl.innerHTML = `<span style="text-decoration: line-through; color: #777; font-size: 0.75em; margin-right: 8px;">${origFmt}</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${accFmt}</span>`;
                renderedBargain = true;
            }
        } catch {}

        if (!renderedBargain) {
            priceEl.textContent = (typeof formatPrice === 'function')
                ? formatPrice(finalPrice)
                : (finalPrice + ' ' + (typeof getCurrency === 'function' ? getCurrency() : 'грн'));
        }
    }

    const minBadge = document.querySelector('#productModal [data-min-bargain]');
    if (minBadge) {
        const minRaw = Number(minBadge.getAttribute('data-min-bargain'));
        if (Number.isFinite(minRaw) && minRaw > 0) {
            const curLang = (typeof i18next !== 'undefined' && i18next.language) ? i18next.language : 'ua';
            const activeCode = (typeof window !== 'undefined' && typeof window.getActiveCurrencyCode === 'function')
                ? window.getActiveCurrencyCode()
                : 'UAH';
            if (activeCode && activeCode !== 'UAH' && typeof formatPrice === 'function') {
                const formattedMin = formatPrice(minRaw).toUpperCase();
                if (curLang.startsWith('ua') || curLang.startsWith('uk')) {
                    minBadge.textContent = `ВІД ${formattedMin}`;
                } else if (curLang.startsWith('en')) {
                    minBadge.textContent = `FROM ${formattedMin}`;
                } else {
                    minBadge.textContent = `ОТ ${formattedMin}`;
                }
            } else if (curLang.startsWith('ua') || curLang.startsWith('uk')) {
                minBadge.textContent = `ВІД ${minRaw} ГРН`;
            } else if (curLang.startsWith('en')) {
                minBadge.textContent = `FROM ${minRaw} UAH`;
            } else {
                minBadge.textContent = `ОТ ${minRaw} ГРН`;
            }
        }
    }

    if (hasAction('syncBargainInputsCurrency')) {
        invokeAction('syncBargainInputsCurrency', item);
    }
}

registerActions({
    openProductModalById,
    openProductModal,
    refreshOpenedProductModalPrices,
    toggleFavFromModal
});

if (typeof window !== 'undefined') {
    window.openProductModalById = openProductModalById;
    window.openProductModal = openProductModal;
}
