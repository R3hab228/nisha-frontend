// ==========================================
// NISHA PRODUCT BARGAIN SYSTEM MODULE
// ==========================================

import {
    productState,
    getActiveOpenedItem,
    getActiveCartSafe,
    getFingerprint,
    getStore,
    getUser,
    parseItemBargainInfo,
    getBargainOfferState,
    applyOfferButtonState
} from './product-state.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeFingerprint } from '../core/runtime-env.js';

const BARGAIN_RATE_LIMIT_STORAGE_KEY = 'nisha_bargain_offers_history';
const BARGAIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const BARGAIN_RATE_LIMIT_MAX = 2;

const _t = (key, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
    ? i18next.t(key, { defaultValue: def })
    : def;

/**
 * Determines the best contact handle for bargain follow-ups (Telegram -> Phone -> Email).
 * @returns {string}
 */
export function getBestBuyerContact() {
    // 1. Telegram username из Telegram WebApp
    try {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (tgUser && tgUser.username) {
            return '@' + tgUser.username.replace(/^@/, '');
        }
    } catch {}

    // 2. Telegram username из профиля / хранилища
    try {
        const profile = (typeof window !== 'undefined' && window.userProfile) || null;
        const currentUser = getUser();
        const tgCandidate = (profile && (profile.tg || profile.telegram || profile.username)) ||
                            (currentUser && currentUser.user_metadata && (currentUser.user_metadata.telegram || currentUser.user_metadata.tg || currentUser.user_metadata.user_name)) ||
                            localStorage.getItem('nisha_last_tg') ||
                            localStorage.getItem('user_tg');
        if (tgCandidate && typeof tgCandidate === 'string' && tgCandidate.trim()) {
            const cleanTg = tgCandidate.trim().replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '');
            if (cleanTg && !cleanTg.includes('@')) return '@' + cleanTg;
        }
    } catch {}

    // 3. Номер телефона
    try {
        const profile = (typeof window !== 'undefined' && window.userProfile) || null;
        const currentUser = getUser();
        const store = getStore();
        const phoneCandidate = (profile && profile.phone) ||
                               (currentUser && (currentUser.phone || (currentUser.user_metadata && currentUser.user_metadata.phone))) ||
                               (store && store.get && (store.get('nisha_last_phone') || store.get('user_phone'))) ||
                               localStorage.getItem('nisha_last_phone') ||
                               localStorage.getItem('user_phone');
        if (phoneCandidate && typeof phoneCandidate === 'string' && phoneCandidate.trim()) {
            return phoneCandidate.trim();
        }
    } catch {}

    // 4. Email fallback
    try {
        const currentUser = getUser();
        if (currentUser && currentUser.email) return currentUser.email.trim();
        const lastEmail = localStorage.getItem('nisha_last_email');
        if (lastEmail) return lastEmail.trim();
    } catch {}

    return '';
}

/**
 * Checks client-side bargain rate limit (max 2 offers per 10 minutes).
 * @returns {{ allowed: boolean, remainingMin?: number }}
 */
export function checkClientBargainRateLimit() {
    try {
        const raw = localStorage.getItem(BARGAIN_RATE_LIMIT_STORAGE_KEY);
        if (!raw) return { allowed: true };
        const history = JSON.parse(raw);
        if (!Array.isArray(history)) return { allowed: true };

        const now = Date.now();
        const validTimestamps = history.filter(ts => typeof ts === 'number' && (now - ts) < BARGAIN_RATE_LIMIT_WINDOW_MS);
        if (validTimestamps.length >= BARGAIN_RATE_LIMIT_MAX) {
            const oldest = Math.min(...validTimestamps);
            const remainingMs = Math.max(0, BARGAIN_RATE_LIMIT_WINDOW_MS - (now - oldest));
            const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
            return { allowed: false, remainingMin };
        }
        return { allowed: true };
    } catch (e) {
        return { allowed: true };
    }
}

/**
 * Records a new bargain submission timestamp in localStorage for client-side rate limiting.
 */
export function recordClientBargainOffer() {
    try {
        const raw = localStorage.getItem(BARGAIN_RATE_LIMIT_STORAGE_KEY);
        const history = raw ? JSON.parse(raw) : [];
        const now = Date.now();
        const validTimestamps = Array.isArray(history)
            ? history.filter(ts => typeof ts === 'number' && (now - ts) < BARGAIN_RATE_LIMIT_WINDOW_MS)
            : [];
        validTimestamps.push(now);
        localStorage.setItem(BARGAIN_RATE_LIMIT_STORAGE_KEY, JSON.stringify(validTimestamps));
    } catch {}
}

/**
 * Shared validation for both modal and inline bargain submissions.
 * @param {object} activeItem
 * @param {number} offeredPrice
 * @returns {{ ok: boolean, message?: string, focusInput?: boolean }}
 */
function validateBargainSubmission(activeItem, offeredPrice) {
    const rateCheck = checkClientBargainRateLimit();
    if (!rateCheck.allowed) {
        return {
            ok: false,
            message: _t('product.offer_rate_limit', 'Максимум 2 пропозиції за 10 хвилин. Будь ласка, зачекайте ще {{min}} хв.').replace('{{min}}', rateCheck.remainingMin)
        };
    }

    const currentPrice = Number(activeItem.price) || 0;
    if (!offeredPrice || Number.isNaN(offeredPrice) || offeredPrice < 100 || offeredPrice >= currentPrice) {
        return {
            ok: false,
            focusInput: true,
            message: (offeredPrice > 0 && offeredPrice < 100)
                ? _t('product.offer_min_100', 'Мінімальна ціна для пропозиції: 100 грн!')
                : _t('product.offer_invalid_price', 'Будь ласка, вкажіть реальну ціну нижче поточної!')
        };
    }

    const { hasBargain, itemMinBargain } = parseItemBargainInfo(activeItem);
    if (!hasBargain) {
        return { ok: false, message: _t('product.offer_disabled', 'Для цього товару торг не передбачено!') };
    }
    if (itemMinBargain && offeredPrice < itemMinBargain) {
        return {
            ok: false,
            focusInput: true,
            message: _t('product.offer_below_min', 'Мінімальна ціна для пропозиції: {{min}} грн!').replace('{{min}}', itemMinBargain)
        };
    }

    return { ok: true };
}

/**
 * Builds canonical `/api/bargain` request payload.
 * @param {object} activeItem
 * @param {number} offeredPrice
 * @param {string} contact
 * @returns {object}
 */
function buildBargainPayload(activeItem, offeredPrice, contact) {
    const fingerprint = getFingerprint();
    const firstImg = (Array.isArray(activeItem.images) && activeItem.images[0]) ||
                     (Array.isArray(activeItem.thumbnails) && activeItem.thumbnails[0]) ||
                     (typeof getOptimizedImg === 'function' ? getOptimizedImg(activeItem) : '') || '';
    const currentUid = (typeof window !== 'undefined' && window.currentUser && window.currentUser.id)
        ? String(window.currentUser.id)
        : null;

    return {
        itemId: String(activeItem.id),
        itemName: activeItem.name || '',
        itemImage: firstImg,
        currentPrice: Number(activeItem.price) || 0,
        offeredPrice,
        contact,
        clientId: String(fingerprint),
        userId: currentUid
    };
}

/**
 * Persists a newly submitted pending bargain state locally and updates `#modalOfferPriceBtn`.
 * @param {string|number} itemId
 * @param {number} offeredPrice
 */
function markPendingBargainLocally(itemId, offeredPrice) {
    try {
        const pData = { itemId: String(itemId), offeredPrice, timestamp: Date.now() };
        sessionStorage.setItem('pending_bargain_' + itemId, JSON.stringify(pData));
        localStorage.setItem('pending_bargain_' + itemId, JSON.stringify(pData));
    } catch {}
    applyOfferButtonState(document.getElementById('modalOfferPriceBtn'), 'pending');
}

/**
 * Formats safe user-facing bargain error message.
 * @param {Error|any} err
 * @returns {string}
 */
function resolveBargainErrorMessage(err) {
    const serverMsg = err?.response?.data?.message || err?.data?.message || err?.message;
    const isSafeServerMsg = serverMsg && typeof serverMsg === 'string'
        && !serverMsg.includes('status code')
        && !serverMsg.includes('fetch')
        && !serverMsg.includes('Network');
    return isSafeServerMsg ? serverMsg : _t('propose.err_network', 'Помилка зв\'язку з сервером.');
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
    if (nameEl) nameEl.innerText = activeItem.name || 'Товар';
    if (priceEl) priceEl.innerText = `${activeItem.price || 0} грн`;

    if (priceInput) {
        priceInput.value = '';
        const suggestedOffer = Math.max(1, Math.round((activeItem.price || 1000) * 0.85));
        priceInput.placeholder = String(suggestedOffer);
    }
    if (contactInput) {
        contactInput.value = getBestBuyerContact();
    }
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = _t('product.offer_send_btn', '[ НАДІСЛАТИ ПРОПОЗИЦІЮ ]');
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
        return showToast(validation.message, 'error');
    }

    const contact = contactInput ? contactInput.value.trim() : '';
    productState.isSubmittingBargainOffer = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="inline-btn-spinner" aria-hidden="true" style="margin-right:8px"></span>' + _t('product.offer_sending', '[ ВІДПРАВКА... ]');
    }

    try {
        const payload = buildBargainPayload(activeItem, offeredPrice, contact);
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
        markPendingBargainLocally(activeItem.id, offeredPrice);

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
            submitBtn.innerText = _t('product.offer_send_btn', '[ НАДІСЛАТИ ПРОПОЗИЦІЮ ]');
        }
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

    const suggested = Math.max(1, Math.round((activeItem.price || 1000) * 0.85));
    input.placeholder = _t('product.offer_your_price_ph', `Наприклад, ${suggested}`);
    input.value = '';

    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    btn.style.opacity = '0';
    btn.style.transform = 'translateY(-4px)';
    btn.style.pointerEvents = 'none';

    setTimeout(() => {
        btn.style.display = 'none';
        row.style.display = 'flex';
        row.style.opacity = '0';
        row.style.transform = 'translateY(4px)';
        void row.offsetWidth;
        row.classList.add('visible');
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
        input.focus();
    }, 110);
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

    row.classList.remove('visible');
    row.style.opacity = '0';
    row.style.transform = 'translateY(4px)';

    setTimeout(() => {
        row.style.display = 'none';
        btn.style.display = 'flex';
        btn.style.opacity = '0';
        btn.style.transform = 'translateY(-4px)';
        void btn.offsetWidth;
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
        btn.style.pointerEvents = btn.disabled ? 'none' : 'auto';
        if (input) input.value = '';
    }, 110);
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
        const payload = buildBargainPayload(activeItem, offeredPrice, savedContact);
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
        markPendingBargainLocally(activeItem.id, offeredPrice);
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
            hideInlineOfferPriceInput();
        } else if (e.key === 'Enter' && (document.activeElement === input || e.target === input)) {
            e.preventDefault();
            submitInlineBargainOffer();
        }
    });
}

/**
 * Synchronizes active pending and accepted bargains across devices via `/api/bargains/active`.
 * @returns {Promise<void>}
 */
export async function syncUserBargains() {
    try {
        const fp = (getRuntimeFingerprint() || '');
        const uid = (typeof window !== 'undefined' && window.currentUser && window.currentUser.id) ? String(window.currentUser.id) : '';
        if (!fp && !uid) return;

        const params = new URLSearchParams();
        if (fp) params.append('clientId', fp);
        if (uid) params.append('userId', uid);

        let bargains = null;
        if (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.get === 'function') {
            try {
                const res = await window.apiClient.get(`/api/bargains/active?${params.toString()}`);
                bargains = res?.data?.bargains || res?.bargains || [];
            } catch (apiErr) {
                // fallback to fetch below
            }
        }
        if (bargains === null) {
            try {
                const backendUrl = (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.getBaseUrl === 'function')
                    ? window.apiClient.getBaseUrl()
                    : ((typeof window !== 'undefined' && window.ENV && window.ENV.API_BASE_URL) || (typeof window !== 'undefined' && window.BACKEND_URL) || 'https://nisha-api.onrender.com');
                const res = await fetch(`${backendUrl}/api/bargains/active?${params.toString()}`, {
                    signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(6000) : undefined
                });
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
                    try {
                        const hasAccepted = localStorage.getItem('accepted_bargain_' + b.itemId) || sessionStorage.getItem('accepted_bargain_' + b.itemId);
                        const hasDeclined = localStorage.getItem('declined_bargain_' + b.itemId) || sessionStorage.getItem('declined_bargain_' + b.itemId);
                        if (!hasAccepted && !hasDeclined) {
                            const pData = {
                                itemId: String(b.itemId),
                                offeredPrice: b.offeredPrice,
                                timestamp: b.timestamp ? Date.parse(b.timestamp) || Date.now() : Date.now()
                            };
                            localStorage.setItem('pending_bargain_' + b.itemId, JSON.stringify(pData));
                            sessionStorage.setItem('pending_bargain_' + b.itemId, JSON.stringify(pData));
                        }
                    } catch {}

                    const activeItem = getActiveOpenedItem();
                    if (activeItem && String(activeItem.id) === String(b.itemId)) {
                        const offerBtn = document.getElementById('modalOfferPriceBtn');
                        if (offerBtn && !localStorage.getItem('accepted_bargain_' + b.itemId)) {
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
                try {
                    localStorage.setItem('accepted_bargain_' + b.itemId, JSON.stringify(payload));
                    sessionStorage.setItem('accepted_bargain_' + b.itemId, JSON.stringify(payload));
                    localStorage.removeItem('declined_bargain_' + b.itemId);
                    sessionStorage.removeItem('declined_bargain_' + b.itemId);
                    localStorage.removeItem('pending_bargain_' + b.itemId);
                    sessionStorage.removeItem('pending_bargain_' + b.itemId);
                } catch {}

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
                        const cur = (typeof getCurrency === 'function' ? getCurrency() : 'грн').trim();
                        priceEl.innerHTML = `<span style="text-decoration: line-through; color: #777; font-size: 0.75em; margin-right: 8px;">${b.originalPrice || activeItem.price} ${cur}</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${b.acceptedPrice} ${cur}</span>`;
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
    }
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
    syncUserBargains
});

if (typeof window !== 'undefined') {
    window.syncUserBargains = syncUserBargains;
}
