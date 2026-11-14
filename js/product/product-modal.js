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
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getLenisInstance, isSiteHackedMode } from '../core/runtime-env.js';

function closeSecondaryOverlays() {
    if (typeof closeModal !== 'function') return;
    const om = document.getElementById('ordersModal');
    if (om && (om.style.display === 'flex' || om.style.display === 'block')) closeModal('ordersModal');
    const rm = document.getElementById('reviewsModal');
    if (rm && (rm.style.display === 'flex' || rm.style.display === 'block')) closeModal('reviewsModal');
}

function renderModalDescriptionContent(item, qaPart = '') {
    const defaultDesc = 'Оригинал. Любые проверки. Отличное состояние. Дополнительные замеры по запросу в ЛС.';
    const rawDesc = item.description ? String(item.description) : defaultDesc;
    const cleanDesc = rawDesc.replace(/\s*\[ТОРГ:?[^\]]*\]/gi, '').trim();
    const descText = (cleanDesc || defaultDesc).replaceAll('\r', '').replaceAll('\n', '<br>');
    const safeDescHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(descText) : getEscHtml(descText);
    const sizeTitle = typeof i18next !== 'undefined' ? i18next.t('product.size') : 'РАЗМЕР';
    const brandTitle = typeof i18next !== 'undefined' ? i18next.t('product.brand') : 'БРЕНД';

    return `
        <div style="margin-bottom: 5px;">
            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${sizeTitle}</span></strong> 
            <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${getEscHtml(item.size)}</span>
        </div>
        <div style="margin-bottom: 15px;">
            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${brandTitle}</span></strong> 
            <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${getEscHtml(item.brand)}</span>
        </div>
        <div style="color: #aaa; font-size: 13px;">${safeDescHtml}</div>
    ` + qaPart;
}

function renderTrustBadges(item) {
    const badgesContainer = document.querySelector('.trust-badges');
    if (!badgesContainer) return;

    const isDropItem = item.is_drop === true || (item.tags && item.tags.map(t => t.toLowerCase()).includes('drop'));
    const isReturnable = item.is_returnable === true;

    let refundBadgeHTML = '';
    if (isDropItem) {
        const alertSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        refundBadgeHTML = `
            <div class="badge-item danger-badge" data-action="show-badge-info" data-badge="drop">
                <span class="badge-icon">${alertSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_drop">${typeof i18next !== 'undefined' ? i18next.t('product.badge_drop') : 'DROP ITEM'}</span>
            </div>`;
    } else if (isReturnable) {
        const returnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
        refundBadgeHTML = `
            <div class="badge-item" data-action="show-badge-info" data-badge="refund_yes">
                <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${returnSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_refund">${typeof i18next !== 'undefined' ? i18next.t('product.badge_refund') : 'ВОЗВРАТ 14 ДНЕЙ'}</span>
            </div>`;
    } else {
        const noReturnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
        refundBadgeHTML = `
            <div class="badge-item" data-action="show-badge-info" data-badge="refund_no">
                <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${noReturnSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_norefund">${typeof i18next !== 'undefined' ? i18next.t('product.badge_norefund') : 'БЕЗ ВОЗВРАТА'}</span>
            </div>`;
    }

    const secureSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`;
    const { hasBargain, itemMinBargain } = parseItemBargainInfo(item);

    let deliveryOrBargainBadgeHTML = '';
    if (hasBargain) {
        const gavelSvg = `<svg width="18" height="18" viewBox="30 30 205 170" fill="var(--accent-green, #00ff66)" stroke="none" aria-hidden="true"><path d="M128 37 L135 38 L170 67 L177 74 L177 81 L173 84 L165 82 L129 52 L124 47 L124 41 L127 38 Z M124 54 L126 54 L162 84 L162 86 L126 129 L123 132 L120 130 L85 101 L123 55 Z M77 101 L83 104 L118 133 L124 140 L123 146 L118 149 L112 147 L77 118 L70 110 L71 104 L76 102 Z M149 107 L222 163 L227 169 L226 176 L221 180 L216 180 L208 174 L143 115 L148 108 Z M55 167 H133 C136 167 138 169 138 172 V174 C138 175.5 140 176.5 142 176.5 H145 C148.5 176.5 151 179 151 182.5 V188.5 C151 192 148.5 194.5 145 194.5 H43 C39.5 194.5 37 192 37 188.5 V182.5 C37 179 39.5 176.5 43 176.5 H46 C48 176.5 50 175.5 50 174 V172 C50 169 52 167 55 167 Z" /></svg>`;
        const curLang = (typeof i18next !== 'undefined' && i18next.language) ? i18next.language : 'ru';
        const fallbackBargainText = (curLang.startsWith('ua') || curLang.startsWith('uk')) ? 'Є ТОРГ' : (curLang.startsWith('en') ? 'BARGAIN' : 'ЕСТЬ ТОРГ');
        let bargainText = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
            ? i18next.t('product.badge_bargain', { defaultValue: fallbackBargainText })
            : fallbackBargainText;
        if (!bargainText || bargainText === 'product.badge_bargain') {
            bargainText = fallbackBargainText;
        }
        if (itemMinBargain) {
            if (curLang.startsWith('ua') || curLang.startsWith('uk')) {
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
                <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${gavelSvg}</span>
                <span class="badge-text" ${badgeI18nAttr}>${bargainText}</span>
            </div>`;
    } else {
        deliveryOrBargainBadgeHTML = `
            <div class="badge-item" data-action="show-badge-info" data-badge="fast">
                <span class="badge-icon">24H</span> 
                <span class="badge-text" data-i18n="product.badge_fast">${typeof i18next !== 'undefined' ? i18next.t('product.badge_fast') : 'БЫСТРАЯ ОТПРАВКА'}</span>
            </div>`;
    }

    badgesContainer.innerHTML = `
        <div class="badge-item" data-action="show-badge-info" data-badge="secure">
            <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${secureSvg}</span> 
            <span class="badge-text" data-i18n="product.badge_orig">${typeof i18next !== 'undefined' ? i18next.t('product.badge_orig') : '100% ОРИГИНАЛ'}</span>
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
    const catalog = getCatalogItems();
    const item = catalog.find(i => String(i.id) === String(itemId));

    const key = String(itemId);
    const prewarmedPromise = (typeof window !== 'undefined' && window._prewarmedItemDetails)
        ? window._prewarmedItemDetails.get(key)
        : null;

    const onFullItemLoaded = (fullItem) => {
        if (!fullItem) return;
        const active = getActiveOpenedItem();
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
                const offerWrapper = document.getElementById('offerPriceWrapper');
                const offerPriceBtn = document.getElementById('modalOfferPriceBtn');
                if (offerWrapper) offerWrapper.style.display = nowHasBargain ? 'block' : 'none';
                if (offerPriceBtn) offerPriceBtn.style.display = nowHasBargain ? 'block' : 'none';
            }

            if (fullItem.description) {
                const cleanFullDesc = String(fullItem.description).replace(/\s*\[ТОРГ:?[^\]]*\]/gi, '').trim();
                const descContainer = document.querySelector('.modal-desc');
                if (descContainer) {
                    const qaMarker = '<!-- Блок Вопросов и Ответов (Q&A) -->';
                    const qaIndex = descContainer.innerHTML.includes(qaMarker)
                        ? descContainer.innerHTML.indexOf(qaMarker)
                        : descContainer.innerHTML.indexOf('<div id="qaWrapper"');
                    const qaPart = qaIndex !== -1 ? descContainer.innerHTML.substring(qaIndex) : '';
                    const descText = cleanFullDesc ? cleanFullDesc.replaceAll('\n', '<br>') : '<span style="color:#666;">[ Описание отсутствует ]</span>';
                    const sizeTitle = typeof i18next !== 'undefined' ? i18next.t('product.size') : 'РАЗМЕР';
                    const brandTitle = typeof i18next !== 'undefined' ? i18next.t('product.brand') : 'БРЕНД';
                    descContainer.innerHTML = `
                        <div style="margin-bottom: 5px;">
                            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${sizeTitle}</span></strong> 
                            <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${getEscHtml(fullItem.size)}</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${brandTitle}</span></strong> 
                            <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${getEscHtml(fullItem.brand)}</span>
                        </div>
                        <div style="color: #aaa; font-size: 13px;">${typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(descText) : getEscHtml(descText)}</div>
                    ` + qaPart;
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
            const store = getStore();
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
 * @param {object} item
 */
export function openProductModal(item) {
    setActiveOpenedItem(item);

    if (item && item.id) {
        document.querySelectorAll(`.item-card[data-id="${item.id}"]`).forEach(c => c.classList.remove('unseen-pulse'));
        if (typeof window !== 'undefined' && window._seenItemsSet) window._seenItemsSet.add(String(item.id));
    }

    setTimeout(() => {
        if (typeof ensurePhotoSwipe === 'function') ensurePhotoSwipe();
    }, 0);

    if (hasAction('stopLenis')) invokeAction('stopLenis');
    else {
        const activeLenis = getLenisInstance();
        if (activeLenis) activeLenis.stop();
    }

    document.title = `NISHA | ${item.brand} - ${item.name}`;

    const titleEl = document.getElementById('modalItemTitle');
    if (titleEl) titleEl.innerText = item.name;

    if (typeof window !== 'undefined' && window.analytics && typeof window.analytics.trackProductView === 'function') {
        window.analytics.trackProductView(item);
    } else if (typeof window !== 'undefined' && window.ttq) {
        ttq.track('ViewContent', {
            content_id: item.id,
            content_name: item.name,
            value: item.price,
            currency: 'UAH'
        });
    }

    const modalStar = document.getElementById('modalFavStar');
    const favs = getFavs();
    if (modalStar) {
        modalStar.classList.toggle('active', favs.includes(item.id));
    }

    const isHackedActive = isSiteHackedMode();
    const finalPrice = isHackedActive ? Math.floor(item.price * 0.9) : item.price;
    const priceEl = document.getElementById('modalItemPrice');
    if (priceEl) {
        priceEl.innerText = (typeof formatPrice === 'function')
            ? formatPrice(finalPrice)
            : (finalPrice + ' ' + (typeof getCurrency === 'function' ? getCurrency() : 'грн'));
    }

    try {
        const { acceptedData } = getBargainOfferState(item.id);
        if (acceptedData && acceptedData.acceptedPrice && priceEl) {
            const cur = (typeof getCurrency === 'function' ? getCurrency() : 'грн').trim();
            priceEl.innerHTML = `<span style="text-decoration: line-through; color: #777; font-size: 0.75em; margin-right: 8px;">${acceptedData.originalPrice || item.price} ${cur}</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${acceptedData.acceptedPrice} ${cur}</span>`;
        }
    } catch {}

    const sizeDescEl = document.getElementById('modalItemSizeDesc');
    if (sizeDescEl) sizeDescEl.innerText = item.size;

    const brandEl = document.getElementById('modalItemBrand');
    if (brandEl) brandEl.innerText = item.brand;

    const condStr = item.condition || '9 / 10';
    const condMatch = condStr.match(/(\d+)/);
    const condNum = (condMatch && condMatch[1]) ? Number.parseInt(condMatch[1], 10) : 9;

    const condFill = document.getElementById('modalCondFill');
    if (condFill) condFill.style.width = (condNum * 10) + '%';

    const condText = document.getElementById('modalItemCond');
    if (condText) condText.innerText = condStr;

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
            tagsContainer.innerHTML = item.tags.slice(0, 3).map(t => `<span style="color: #fff; margin-right: 12px; letter-spacing: 0.5px;">#${getEscHtml(t)}</span>`).join('');
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
                    <span data-i18n="product.qa_title">${typeof i18next !== 'undefined' ? i18next.t('product.qa_title', { defaultValue: 'Q&A: Вопросы покупателей' }) : 'Q&A: Вопросы покупателей'}</span>
                    <span class="qa-arrow" style="transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1); color: var(--accent-green); display: inline-block;">▼</span>
                </h4>
                <div id="qaCollapseWrapper" class="qa-collapse-wrapper">
                    <div id="qaList" class="qa-content"></div>
                </div>
            </div>

            <!-- КНОПКА ЗАДАТЬ ВОПРОС -->
            <div style="margin-top: 15px; text-align: right;">
                <button data-action="toggle-question-form" class="ask-question-btn" data-i18n="product.ask_btn">${typeof i18next !== 'undefined' ? i18next.t('product.ask_btn', { defaultValue: 'Задать вопрос?' }) : 'Задать вопрос?'}</button>
            </div>
            <div id="questionFormContainer" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; margin-top: 5px;">
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <input type="text" id="questionInput" class="form-input" maxlength="100" placeholder="${getEscHtml(typeof i18next !== 'undefined' ? i18next.t('product.ask_ph', { defaultValue: 'Ваш вопрос...' }) : 'Ваш вопрос...')}" data-i18n-ph="product.ask_ph" style="font-size: 12px; padding: 8px;">
                    <button class="search-btn btn-target" data-action="submit-question" data-id="${getEscAttr(item.id)}" style="padding: 8px 15px; font-size: 12px;" data-i18n="product.ask_send">${typeof i18next !== 'undefined' ? i18next.t('product.ask_send', { defaultValue: 'ОТПРАВИТЬ' }) : 'ОТПРАВИТЬ'}</button>
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
    const sb = getSupabaseClient();
    if (viewCount) {
        viewCount.innerText = item.views_count || 0;

        if (sb) {
            const store = getStore();
            const viewedItems = store ? store.getJSON('nisha_added_views', []) : [];

            if (!viewedItems.includes(item.id)) {
                let visitorId = getFingerprint();
                if (!visitorId || visitorId.startsWith('guest_')) {
                    visitorId = (store ? store.get('nisha_visitor_id') : null) || ('user_' + (hasAction('generateShortId') ? invokeAction('generateShortId', 9) : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().replaceAll('-', '').slice(0, 9) : Date.now().toString(36))));
                }
                const currentUser = getUser();
                const viewerId = currentUser ? currentUser.id : visitorId;

                sb.rpc('increment_item_views', {
                    p_item_uuid: item.id,
                    p_viewer_id: viewerId
                }).then(({ data, error }) => {
                    if (!error && data !== null) {
                        viewCount.innerText = data;
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
            const userCart = getActiveCartSafe();
            const isInCart = userCart.some(i => i && String(i.id) === String(item.id));
            const inCartText = (typeof i18next !== 'undefined') ? i18next.t('product.in_cart', { defaultValue: 'В КОРЗИНЕ' }) : 'В КОРЗИНЕ';
            const addToCartText = (typeof i18next !== 'undefined') ? i18next.t('product.add_to_cart', { defaultValue: 'В КОРЗИНУ' }) : 'В КОРЗИНУ';
            cartBtn.innerText = isInCart ? inCartText : addToCartText;
        }
    }

    const offerWrapper = document.getElementById('offerPriceWrapper');
    const offerPriceBtn = document.getElementById('modalOfferPriceBtn');
    const offerInputRow = document.getElementById('offerPriceInputRow');
    const inlineInput = document.getElementById('inlineBargainPriceInput');

    if (offerWrapper || offerPriceBtn) {
        const { hasBargain } = parseItemBargainInfo(item);
        if ((item && item.status === 'sold') || !hasBargain) {
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
    renderSimilarItems(item);
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
        if (typeof openModal === 'function') {
            openModal('productModal');
        } else if (modalEl) {
            modalEl.inert = false;
            modalEl.removeAttribute('inert');
            modalEl.classList.remove('closing');
            modalEl.style.pointerEvents = '';
            modalEl.setAttribute('aria-hidden', 'false');
            const win = modalEl.querySelector('.modal-window');
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
            if (typeof triggerModalTypewriter === 'function') {
                triggerModalTypewriter(modalEl);
            }
        }
    } else {
        if (modalEl) modalEl.style.pointerEvents = '';
        const win = modalEl ? modalEl.querySelector('.modal-window') : null;
        if (win) win.style.pointerEvents = '';
        if (typeof triggerModalTypewriter === 'function') {
            triggerModalTypewriter(modalEl);
        }
    }

    setTimeout(() => addToHistory(item), 0);

    const modalWin = document.querySelector('#productModal .modal-window');
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

    const url = new URL(window.location);
    if (url.searchParams.has('item')) {
        url.searchParams.delete('item');
        window.history.replaceState(null, '', url.pathname + url.search);
    }

    if (sb) loadItemQuestions(item.id);
    updateProductSeoAndOg(item, cleanDesc);
}

/**
 * Toggles favorite status for the currently opened modal product.
 * @param {Event} event
 * @returns {Promise<void>}
 */
export async function toggleFavFromModal(event) {
    const active = getActiveOpenedItem();
    if (!active) return;

    const modalStar = document.getElementById('modalFavStar');
    if (modalStar) modalStar.blur();

    if (hasAction('toggleFav')) {
        await invokeAction('toggleFav', event, active.id);
    } else if (typeof toggleFav === 'function') {
        await toggleFav(event, active.id);
    }
}

registerActions({
    openProductModalById,
    openProductModal,
    toggleFavFromModal
});

if (typeof window !== 'undefined') {
    window.openProductModalById = openProductModalById;
    window.openProductModal = openProductModal;
}
