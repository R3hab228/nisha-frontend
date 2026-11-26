// ==========================================
// NISHA PRODUCT BARGAIN SYSTEM MODULE
// ==========================================

import {
    productState,
    getActiveOpenedItem,
    getActiveCartSafe,
    parseItemBargainInfo,
    getBargainOfferState,
    applyOfferButtonState
} from './product-state.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeFingerprint, getRuntimeSiteLang, tSafe } from '../core/runtime-env.js';
import { getActiveCurrencyCode, convertFromUah } from '../core/currency.js';
import { getAcceptedBargain, isBargainDeclined, setAcceptedBargain, setPendingBargain } from '../core/bargain-storage.js';
import {
    getBestBuyerContact,
    checkClientBargainRateLimit,
    recordClientBargainOffer,
    validateBargainSubmission,
    buildBargainPayload,
    markPendingBargainLocally,
    resolveBargainErrorMessage
} from './product-bargain-logic.js';

export {
    getBestBuyerContact,
    checkClientBargainRateLimit,
    recordClientBargainOffer
};

const _t = (key, def) => tSafe(key, def);

/**
 * Синхронизирует плейсхолдер «Минимальная ставка», min/step, лейбл валюты и цену товара
 * в полях торга (`#inlineBargainPriceInput`, `#bargainPriceInput`, `#bargainModal`) под текущую валюту.
 * @param {any} [activeItem]
 */
export function syncBargainInputsCurrency(activeItem = getActiveOpenedItem()) {
    if (typeof document === 'undefined' || !activeItem) return;
    const { itemMinBargain } = parseItemBargainInfo(activeItem);
    const minOfferUah = itemMinBargain || 100;
    const activeCode = getActiveCurrencyCode();
    const isForeign = activeCode !== 'UAH';
    const minDisplayNum = isForeign ? convertFromUah(minOfferUah, activeCode) : minOfferUah;
    const minDisplayFormatted = (typeof formatPrice === 'function')
        ? formatPrice(minOfferUah)
        : `${minDisplayNum} ${typeof getCurrency === 'function' ? getCurrency() : 'грн'}`;
    const lang = getRuntimeSiteLang();
    const defaultPh = lang === 'ru'
        ? `Минимальная ставка: ${minDisplayFormatted}`
        : (lang === 'en' ? `Minimum bid: ${minDisplayFormatted}` : `Мінімальна ставка: ${minDisplayFormatted}`);
    const phText = _t('product.offer_min_bid_ph', defaultPh).replace('{{min}}', minDisplayFormatted);
    const stepStr = isForeign ? '1' : '10';

    ['bargainPriceInput', 'inlineBargainPriceInput'].forEach((id) => {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.min = String(minDisplayNum);
        inp.step = stepStr;
        inp.placeholder = phText;
    });

    const priceLabelEl = document.getElementById('bargainPriceLabel');
    if (priceLabelEl) {
        const currLabel = typeof getCurrency === 'function' ? getCurrency() : (lang === 'en' ? 'UAH' : 'грн');
        const labelFallback = lang === 'ru'
            ? `Ваша цена (${currLabel}):`
            : (lang === 'en' ? `Your price (${currLabel}):` : `Ваша ціна (${currLabel}):`);
        priceLabelEl.textContent = _t('product.offer_your_price_currency', labelFallback).replace('{{curr}}', currLabel);
    }

    const bargainPriceEl = document.getElementById('bargainItemPrice');
    if (bargainPriceEl) {
        const curPrice = activeItem.price || 0;
        bargainPriceEl.textContent = (typeof formatPrice === 'function')
            ? formatPrice(curPrice)
            : `${Number(curPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${typeof getCurrency === 'function' ? getCurrency() : 'грн'}`;
    }
}

/**
 * Opens the dedicated bargain offer modal populated with active item info.
 */
export function openOfferPriceModal() {
    const activeItem = getActiveOpenedItem();
    if (!activeItem) return;

    const rateCheck = checkClientBargainRateLimit();
    if (!rateCheck.allowed) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const limitMsg = _t('product.offer_rate_limit', 'Максимум 2 пропозиції за 10 хвилин. Будь ласка, зачекайте ще {{min}} хв.').replace('{{min}}', rateCheck.remainingMin);
        return showToast(limitMsg, 'error');
    }

    const modal = document.getElementById('bargainModal');
    if (!modal) return;

    const thumbEl = document.getElementById('bargainItemThumb');
    const nameEl = document.getElementById('bargainItemName');
    const priceEl = document.getElementById('bargainItemPrice');
    const priceInput = document.getElementById('bargainPriceInput');
    const contactInput = document.getElementById('bargainContactInput');
    const submitBtn = document.getElementById('bargainSubmitBtn');

    const firstImg = (Array.isArray(activeItem.images) && activeItem.images[0]) ||
                     (Array.isArray(activeItem.thumbnails) && activeItem.thumbnails[0]) ||
                     (typeof getOptimizedImg === 'function' ? getOptimizedImg(activeItem) : '') || '';

    if (thumbEl) {
        const safeThumb = typeof sanitizeHtmlMediaUrl === 'function' ? sanitizeHtmlMediaUrl(firstImg) : firstImg;
        if (safeThumb) thumbEl.src = safeThumb;
        thumbEl.alt = activeItem.name || 'Товар';
    }
    if (nameEl) nameEl.textContent = activeItem.name || 'Товар';
    if (priceEl) {
        const curPrice = activeItem.price || 0;
        priceEl.textContent = (typeof formatPrice === 'function')
            ? formatPrice(curPrice)
            : `${Number(curPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${typeof getCurrency === 'function' ? getCurrency() : 'грн'}`;
    }

    if (priceInput) {
        priceInput.value = '';
    }
    syncBargainInputsCurrency(activeItem);
    if (contactInput) {
        contactInput.value = getBestBuyerContact();
    }
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = _t('product.offer_send_btn', '[ НАДІСЛАТИ ПРОПОЗИЦІЮ ]');
    }

    if (typeof openModal === 'function') {
        openModal('bargainModal');
    } else {
        modal.style.display = 'flex';
    }

    setTimeout(() => {
        if (priceInput) priceInput.focus();
    }, 150);
}

/**
 * Submits a bargain price offer from `#bargainModal`.
 * @returns {Promise<void>}
 */
export async function submitBargainOffer() {
    if (productState.isSubmittingBargainOffer) return;
    const activeItem = getActiveOpenedItem();
    if (!activeItem) return;

    const priceInput = document.getElementById('bargainPriceInput');
    const contactInput = document.getElementById('bargainContactInput');
    const submitBtn = document.getElementById('bargainSubmitBtn');

    const offeredPrice = priceInput ? Number.parseInt(priceInput.value, 10) : 0;
    const validation = validateBargainSubmission(activeItem, offeredPrice);
    if (!validation.ok) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        showToast(validation.message, 'error');
        if (validation.focusInput && priceInput && typeof priceInput.focus === 'function') {
            priceInput.focus();
        }
        return;
    }

    const contact = contactInput ? contactInput.value.trim() : '';
    productState.isSubmittingBargainOffer = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.pointerEvents = 'none';
        submitBtn.style.position = 'relative';
        submitBtn.style.overflow = 'hidden';
        submitBtn.style.color = '#000';
        const sendingLabel = _t('product.offer_sending', '[ ВІДПРАВКА... ]');
        submitBtn.innerHTML = `
            <span style="position: relative; z-index: 2;">${sendingLabel}</span>
            <div id="bargainBtnProgressBar" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: #fff; z-index: 1; transition: width 3s cubic-bezier(0.1, 0.7, 1.0, 0.1);"></div>
        `;
        setTimeout(() => {
            const bar = document.getElementById('bargainBtnProgressBar');
            if (bar) bar.style.width = '90%';
        }, 50);
    }

    try {
        const finalOfferedUah = validation.offeredPriceUah ?? offeredPrice;
        const payload = buildBargainPayload(activeItem, finalOfferedUah, contact);
        let bargainResponse = null;
        if (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.post === 'function') {
            bargainResponse = await window.apiClient.post('/api/bargain', payload, {
                timeout: 15000,
                retries: 0,
                throwOnHttpError: true
            });
        }
        if (bargainResponse && bargainResponse.success === false) {
            throw new Error(bargainResponse.message || 'Ошибка отправки предложения');
        }
        const bar = document.getElementById('bargainBtnProgressBar');
        if (bar) {
            bar.style.transition = 'width 0.15s ease-out';
            bar.style.width = '100%';
        }
        recordClientBargainOffer();
        markPendingBargainLocally(activeItem.id, finalOfferedUah);

        if (typeof triggerHaptic === 'function') triggerHaptic('success');
        showToast(_t('product.offer_sent_toast', 'Пропозицію надіслано! Очікуйте відповіді продавця.'), 'success');

        if (typeof closeModal === 'function') {
            closeModal('bargainModal');
        } else {
            const m = document.getElementById('bargainModal');
            if (m) m.style.display = 'none';
        }
    } catch (err) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        showToast(resolveBargainErrorMessage(err), 'error');
    } finally {
        productState.isSubmittingBargainOffer = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.pointerEvents = 'auto';
            submitBtn.style.position = '';
            submitBtn.style.overflow = '';
            submitBtn.style.color = '';
            submitBtn.textContent = _t('product.offer_send_btn', '[ НАДІСЛАТИ ПРОПОЗИЦІЮ ]');
        }
    }
}

let _inlineOfferToggleTimer = null;
let _inlineOfferActiveAnim = null;
let _inlineOfferToggleGen = 0;

function clearInlineOfferToggleTimer() {
    _inlineOfferToggleGen += 1;
    if (_inlineOfferToggleTimer !== null) {
        clearTimeout(_inlineOfferToggleTimer);
        _inlineOfferToggleTimer = null;
    }
    if (_inlineOfferActiveAnim) {
        try { _inlineOfferActiveAnim.cancel(); } catch {}
        _inlineOfferActiveAnim = null;
    }
}

/**
 * Runs a 110ms fade-out on `outEl` via Web Animations API (or timer fallback in mocks), then invokes `onSwapped`.
 * @param {HTMLElement} outEl
 * @param {string} outTranslateY
 * @param {Function} onSwapped
 */
function runInlineOfferOutTransition(outEl, outTranslateY, onSwapped) {
    clearInlineOfferToggleTimer();
    const gen = _inlineOfferToggleGen;
    outEl.style.opacity = '0';
    outEl.style.transform = `translateY(${outTranslateY})`;

    if (typeof outEl.animate === 'function') {
        try {
            const anim = outEl.animate(
                [
                    { opacity: 1, transform: 'translateY(0)' },
                    { opacity: 0, transform: `translateY(${outTranslateY})` }
                ],
                { duration: 110, easing: 'ease' }
            );
            _inlineOfferActiveAnim = anim;
            Promise.resolve(anim.finished).catch(() => {}).finally(() => {
                if (gen !== _inlineOfferToggleGen) return;
                _inlineOfferActiveAnim = null;
                onSwapped();
            });
            return;
        } catch {}
    }

    _inlineOfferToggleTimer = setTimeout(() => {
        _inlineOfferToggleTimer = null;
        if (gen !== _inlineOfferToggleGen) return;
        onSwapped();
    }, 110);
}

/**
 * Animates `inEl` cleanly into view after display toggle.
 * @param {HTMLElement} inEl
 * @param {string} startTranslateY
 */
function animateInlineOfferIn(inEl, startTranslateY) {
    inEl.style.opacity = '1';
    inEl.style.transform = 'translateY(0)';
    if (typeof inEl.animate === 'function') {
        try {
            _inlineOfferActiveAnim = inEl.animate(
                [
                    { opacity: 0, transform: `translateY(${startTranslateY})` },
                    { opacity: 1, transform: 'translateY(0)' }
                ],
                { duration: 110, easing: 'ease' }
            );
        } catch {}
    }
}

/**
 * Transitions the modal offer button into inline numeric price input mode.
 */
export function showInlineOfferPriceInput() {
    const btn = document.getElementById('modalOfferPriceBtn');
    const row = document.getElementById('offerPriceInputRow');
    const input = document.getElementById('inlineBargainPriceInput');
    const activeItem = getActiveOpenedItem();
    if (!activeItem || !btn || !row || !input) return;

    const { isAcceptedBargain, isDeclinedBargain, isPendingBargain } = getBargainOfferState(activeItem.id);
    if (isDeclinedBargain || isAcceptedBargain || isPendingBargain) return;

    const rateCheck = checkClientBargainRateLimit();
    if (!rateCheck.allowed) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const limitMsg = _t('product.offer_rate_limit', 'Максимум 2 пропозиції за 10 хвилин. Будь ласка, зачекайте ще {{min}} хв.').replace('{{min}}', rateCheck.remainingMin);
        showToast(limitMsg, 'error');
        return;
    }

    input.value = '';
    syncBargainInputsCurrency(activeItem);

    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    btn.style.pointerEvents = 'none';
    runInlineOfferOutTransition(btn, '-4px', () => {
        btn.style.display = 'none';
        row.style.display = 'flex';
        row.classList.add('visible');
        animateInlineOfferIn(row, '4px');
        if (typeof input.focus === 'function') input.focus();
    });
}

/**
 * Transitions inline bargain input back to the primary `#modalOfferPriceBtn`.
 */
export function hideInlineOfferPriceInput() {
    const btn = document.getElementById('modalOfferPriceBtn');
    const row = document.getElementById('offerPriceInputRow');
    const input = document.getElementById('inlineBargainPriceInput');
    if (!btn || !row) return;

    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    if (input) {
        if (typeof input.blur === 'function') input.blur();
        input.value = '';
    }

    row.classList.remove('visible');
    runInlineOfferOutTransition(row, '4px', () => {
        row.style.display = 'none';
        btn.style.display = 'flex';
        animateInlineOfferIn(btn, '-4px');
        btn.style.pointerEvents = btn.disabled ? 'none' : 'auto';
    });
}

/**
 * Submits an inline bargain price directly from the product modal card.
 * @returns {Promise<void>}
 */
export async function submitInlineBargainOffer() {
    if (productState.isSubmittingBargainOffer) return;
    const activeItem = getActiveOpenedItem();
    if (!activeItem) return;

    const input = document.getElementById('inlineBargainPriceInput');
    const submitBtn = document.getElementById('inlineBargainSubmitBtn');
    if (!input || !submitBtn) return;

    const offeredPrice = Number.parseInt(input.value, 10);
    const validation = validateBargainSubmission(activeItem, offeredPrice);
    if (!validation.ok) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        showToast(validation.message, 'error');
        if (validation.focusInput) input.focus();
        return;
    }

    const savedContact = getBestBuyerContact();
    productState.isSubmittingBargainOffer = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('sending');
    input.disabled = true;
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="inline-btn-spinner" aria-hidden="true"></span>';
    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    try {
        const finalOfferedUah = validation.offeredPriceUah ?? offeredPrice;
        const payload = buildBargainPayload(activeItem, finalOfferedUah, savedContact);
        let bargainResponse = null;
        if (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.post === 'function') {
            bargainResponse = await window.apiClient.post('/api/bargain', payload, {
                timeout: 15000,
                retries: 0,
                throwOnHttpError: true
            });
        }
        if (bargainResponse && bargainResponse.success === false) {
            throw new Error(bargainResponse.message || 'Ошибка отправки предложения');
        }
        recordClientBargainOffer();

        if (typeof triggerHaptic === 'function') triggerHaptic('success');
        submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green, #00ff66)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        submitBtn.style.borderColor = 'var(--accent-green, #00ff66)';

        if (typeof sleep === 'function') {
            await sleep(220);
        } else {
            await new Promise(resolve => setTimeout(resolve, 220));
        }

        showToast(_t('product.offer_sent_toast', 'Пропозицію надіслано! Очікуйте відповіді продавця.'), 'success');
        hideInlineOfferPriceInput();
        markPendingBargainLocally(activeItem.id, finalOfferedUah);
    } catch (err) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        showToast(resolveBargainErrorMessage(err), 'error');
    } finally {
        productState.isSubmittingBargainOffer = false;
        submitBtn.disabled = false;
        input.disabled = false;
        submitBtn.classList.remove('sending');
        submitBtn.innerHTML = originalBtnHtml;
        submitBtn.style.borderColor = '';
    }
}

/**
 * Registers idempotent Enter/Escape keyboard handlers for `#inlineBargainPriceInput`.
 */
export function bindBargainKeyboardShortcuts() {
    if (typeof document === 'undefined' || document._bargainKeydownBound) return;
    document._bargainKeydownBound = true;
    document.addEventListener('keydown', (e) => {
        const input = document.getElementById('inlineBargainPriceInput');
        const row = document.getElementById('offerPriceInputRow');
        if (!row || row.style.display === 'none') return;

        if (e.key === 'Escape') {
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            hideInlineOfferPriceInput();
        } else if (e.key === 'Enter' && (document.activeElement === input || e.target === input)) {
            e.preventDefault();
            submitInlineBargainOffer();
        }
    }, { capture: true });
}

let _bargainSyncInFlight = null;
let _lastBargainSyncAt = 0;
let _bargainSyncBackoffUntil = 0;
const BARGAIN_SYNC_COOLDOWN_MS = 15000;
const BARGAIN_SYNC_429_BACKOFF_MS = 60000;

/**
 * Synchronizes active pending and accepted bargains across devices via `/api/bargains/active`.
 * Deduplicates concurrent calls, enforces a 15s cooldown, and backs off on HTTP 429.
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function syncUserBargains(options = {}) {
    const now = Date.now();
    const force = Boolean(options && options.force);
    if (!force && now < _bargainSyncBackoffUntil) return;
    if (!force && _lastBargainSyncAt > 0 && (now - _lastBargainSyncAt) < BARGAIN_SYNC_COOLDOWN_MS) return;
    if (_bargainSyncInFlight) return _bargainSyncInFlight;

    _lastBargainSyncAt = now;

    const runSync = async () => {
    try {
        const fp = (getRuntimeFingerprint() || '');
        let uid = (typeof window !== 'undefined' && window.currentUser && window.currentUser.id) ? String(window.currentUser.id) : '';
        if (uid && typeof window !== 'undefined') {
            try {
                const sb = window._supabase || (hasAction('getSupabase') ? invokeAction('getSupabase') : null);
                if (sb && sb.auth && typeof sb.auth.getSession === 'function') {
                    const sess = await sb.auth.getSession();
                    const tok = sess?.data?.session?.access_token;
                    const sessUid = sess?.data?.session?.user?.id ? String(sess.data.session.user.id) : '';
                    if (!tok || (sessUid && sessUid !== uid)) {
                        uid = '';
                    }
                }
            } catch {
                uid = '';
            }
        }
        if (!fp && !uid) return;

        const params = new URLSearchParams();
        if (fp) params.append('clientId', fp);
        if (uid) params.append('userId', uid);

        let bargains = null;
        if (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.get === 'function') {
            try {
                const res = await window.apiClient.get(`/api/bargains/active?${params.toString()}`, {
                    retries: 0,
                    timeout: 6000,
                    dedupe: true
                });
                bargains = res?.data?.bargains || res?.bargains || [];
            } catch (apiErr) {
                const errStatus = Number(apiErr?.status || apiErr?.response?.status || 0);
                if (errStatus === 429) {
                    _bargainSyncBackoffUntil = Date.now() + BARGAIN_SYNC_429_BACKOFF_MS;
                }
                // Не делаем повторный неавторизованный fetch при HTTP-ошибках (401/403/429)
                return;
            }
        } else {
            try {
                const backendUrl = ((typeof window !== 'undefined' && window.ENV && window.ENV.API_BASE_URL) || (typeof window !== 'undefined' && window.BACKEND_URL) || 'https://nisha-api.onrender.com');
                const res = await fetch(`${backendUrl}/api/bargains/active?${params.toString()}`, {
                    signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(6000) : undefined
                });
                if (res.status === 429) {
                    _bargainSyncBackoffUntil = Date.now() + BARGAIN_SYNC_429_BACKOFF_MS;
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    bargains = data?.bargains || [];
                }
            } catch {}
        }

        if (Array.isArray(bargains) && bargains.length > 0) {
            let cartUpdated = false;
            const activeCart = getActiveCartSafe();

            bargains.forEach(b => {
                if (!b || !b.itemId) return;

                if (b.status === 'pending' || (!b.acceptedPrice && b.offeredPrice)) {
                    const hasAccepted = Boolean(getAcceptedBargain(b.itemId));
                    const hasDeclined = isBargainDeclined(b.itemId);
                    if (!hasAccepted && !hasDeclined) {
                        setPendingBargain(b.itemId, {
                            itemId: String(b.itemId),
                            offeredPrice: b.offeredPrice,
                            timestamp: b.timestamp ? Date.parse(b.timestamp) || Date.now() : Date.now()
                        });
                    }

                    const activeItem = getActiveOpenedItem();
                    if (activeItem && String(activeItem.id) === String(b.itemId)) {
                        const offerBtn = document.getElementById('modalOfferPriceBtn');
                        if (offerBtn && !getAcceptedBargain(b.itemId)) {
                            applyOfferButtonState(offerBtn, 'pending');
                        }
                    }
                    return;
                }

                if (!b.acceptedPrice) return;
                const payload = {
                    type: 'BARGAIN_ACCEPTED',
                    bargainId: b.bargainId,
                    itemId: b.itemId,
                    itemName: b.itemName,
                    itemImage: b.itemImage,
                    originalPrice: b.originalPrice,
                    acceptedPrice: b.acceptedPrice,
                    expiresAt: b.expiresAt,
                    seen_popup: Boolean(b.seen_popup)
                };
                if (b.seen_popup) {
                    const offerKey = String(b.bargainId || ('accepted_' + b.itemId + '_' + b.acceptedPrice));
                    invokeAction('markBargainPopupAsSeen', offerKey);
                }
                setAcceptedBargain(b.itemId, payload);

                if (Array.isArray(activeCart)) {
                    const cartItem = activeCart.find(ci => ci && String(ci.id) === String(b.itemId));
                    if (cartItem && Number(cartItem.price) !== Number(b.acceptedPrice)) {
                        cartItem.originalPrice = Number(b.originalPrice || cartItem.originalPrice || cartItem.price);
                        cartItem.price = Number(b.acceptedPrice);
                        cartItem.bargainPrice = Number(b.acceptedPrice);
                        cartUpdated = true;
                    }
                }

                const activeItem = getActiveOpenedItem();
                if (activeItem && String(activeItem.id) === String(b.itemId)) {
                    applyOfferButtonState(document.getElementById('modalOfferPriceBtn'), 'accepted');
                    const priceEl = document.getElementById('modalItemPrice') || document.getElementById('modalPrice');
                    if (priceEl) {
                        const accNum = Number(b.acceptedPrice);
                        if (Number.isFinite(accNum) && accNum > 0) {
                            const origNum = Number(b.originalPrice ?? activeItem.price);
                            const safeOrig = Number.isFinite(origNum) ? origNum : 0;
                            const rawCur = (typeof getCurrency === 'function' ? getCurrency() : 'грн').trim();
                            const esc = (s) => (hasAction('escapeHtml') ? invokeAction('escapeHtml', s) : String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
                            const origFmt = (typeof formatPrice === 'function') ? esc(formatPrice(safeOrig)) : `${safeOrig} ${esc(rawCur)}`;
                            const accFmt = (typeof formatPrice === 'function') ? esc(formatPrice(accNum)) : `${accNum} ${esc(rawCur)}`;
                            priceEl.innerHTML = `<span style="text-decoration: line-through; color: #777; font-size: 0.75em; margin-right: 8px;">${origFmt}</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${accFmt}</span>`;
                        }
                    }
                }

                if (hasAction('updateCardDOM') && Array.isArray(window.allItems)) {
                    const found = window.allItems.find(it => String(it.id) === String(b.itemId));
                    if (found) invokeAction('updateCardDOM', found);
                }
            });

            if (cartUpdated && Array.isArray(activeCart)) {
                if (hasAction('setActiveCart')) invokeAction('setActiveCart', activeCart);
                else if (typeof setActiveCart === 'function') setActiveCart(activeCart);
                if (hasAction('updateCartUI')) invokeAction('updateCartUI');
                else if (typeof updateCartUI === 'function') updateCartUI();
            }
        }
    } catch (e) {
        console.warn('[SYNC BARGAINS] Error:', e);
    } finally {
        _bargainSyncInFlight = null;
    }
    };

    _bargainSyncInFlight = runSync();
    return _bargainSyncInFlight;
}

registerActions({
    getBestBuyerContact,
    checkClientBargainRateLimit,
    recordClientBargainOffer,
    openOfferPriceModal,
    submitBargainOffer,
    showInlineOfferPriceInput,
    hideInlineOfferPriceInput,
    submitInlineBargainOffer,
    syncBargainInputsCurrency,
    syncUserBargains
});

if (typeof window !== 'undefined') {
    window.syncUserBargains = syncUserBargains;
}
