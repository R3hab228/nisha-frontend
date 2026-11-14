// ==========================================
// NISHA CHECKOUT — DRAFT STORAGE, PROMOCODES & PAYMENT DROPDOWN
// ==========================================

import {
    cartState,
    parseCartPrice,
    renderPromoCodeNotice,
    getActiveCart,
    setSelectedCityRefState,
    setSelectedBranchRefState
} from './cart-state.js';
import { updateCartUI } from './cart-ui.js';
import { hasAction, invokeAction } from '../core/action-registry.js';
import { getRuntimeStorage } from '../core/runtime-env.js';

/**
 * Защита поля промокода от автозаполнения браузера (Chrome подставлял туда ФИО).
 */
export function sanitizePromoField() {
    const promoEl = document.getElementById('promoInput');
    if (!promoEl) return;
    const val = (promoEl.value || '').trim();
    if (!val || (typeof window !== 'undefined' && window.appliedPromoCode)) return;
    const normStr = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const nameVal = normStr(document.getElementById('orderName')?.value);
    const profName = normStr(typeof window !== 'undefined' && window.userProfile?.full_name);
    const v = normStr(val);
    const looksLikeName = /\s/.test(v) || (nameVal && v === nameVal) || (profName && v === profName);
    if (looksLikeName) promoEl.value = '';
}

/**
 * Сохраняет текущий черновик формы оформления заказа в sessionStorage.
 */
export function saveCheckoutDraft() {
    try {
        const draft = {
            name: document.getElementById('orderName')?.value || '',
            phone: document.getElementById('orderPhone')?.value || '',
            city: document.getElementById('orderCity')?.value || '',
            branch: document.getElementById('orderBranch')?.value || '',
            cityRef: (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef || '',
            branchRef: (typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef || '',
            paymentMethod: document.getElementById('orderPaymentMethod')?.value || '',
            paymentSelectedText: document.getElementById('paymentSelectedText')?.innerText || ''
        };
        const store = getRuntimeStorage();
        if (store && store.session) {
            store.session.setJSON('nisha_checkout_draft', draft);
        } else {
            try {
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('nisha_checkout_draft', JSON.stringify(draft));
                }
            } catch {}
        }
    } catch {}
}

/**
 * Восстанавливает черновик оформления заказа из sessionStorage.
 * @returns {boolean}
 */
export function restoreCheckoutDraft() {
    try {
        const store = getRuntimeStorage();
        let draft = null;
        if (store && store.session) {
            draft = store.session.getJSON('nisha_checkout_draft', null);
        } else {
            try {
                if (typeof sessionStorage !== 'undefined') {
                    const raw = sessionStorage.getItem('nisha_checkout_draft');
                    draft = raw ? JSON.parse(raw) : null;
                }
            } catch {
                draft = null;
            }
        }
        if (!draft || typeof draft !== 'object') return false;

        let hasRestored = false;
        const nameEl = document.getElementById('orderName');
        const phoneEl = document.getElementById('orderPhone');
        const cityEl = document.getElementById('orderCity');
        const branchEl = document.getElementById('orderBranch');

        if (nameEl && draft.name) { nameEl.value = draft.name; hasRestored = true; }
        if (phoneEl && draft.phone) { phoneEl.value = draft.phone; hasRestored = true; }
        if (cityEl && draft.city) { cityEl.value = draft.city; hasRestored = true; }
        if (branchEl && draft.branch) { branchEl.value = draft.branch; hasRestored = true; }

        if (draft.paymentMethod && document.getElementById('orderPaymentMethod')) {
            const rawDraftPm = String(draft.paymentMethod).toLowerCase();
            const isCod = rawDraftPm.includes('200') || rawDraftPm.includes('налож') || rawDraftPm.includes('наклад') || rawDraftPm.includes('delivery') || rawDraftPm.includes('cod');
            document.getElementById('orderPaymentMethod').value = isCod ? 'Наложка (предоплата 200грн)' : 'Полная предоплата';
            const txtEl = document.getElementById('paymentSelectedText');
            if (txtEl) {
                txtEl.setAttribute('data-i18n', isCod ? 'checkout.payment_cod' : 'checkout.payment_full');
                txtEl.innerText = typeof i18next !== 'undefined' ? i18next.t(isCod ? 'checkout.payment_cod' : 'checkout.payment_full') : (draft.paymentSelectedText || document.getElementById('orderPaymentMethod').value);
            }
        } else if (draft.paymentSelectedText && document.getElementById('paymentSelectedText')) {
            document.getElementById('paymentSelectedText').innerText = draft.paymentSelectedText;
        }

        if (draft.cityRef) setSelectedCityRefState(draft.cityRef);
        if (draft.branchRef) setSelectedBranchRefState(draft.branchRef);
        return hasRestored;
    } catch { return false; }
}

/**
 * Очищает сохранённый черновик оформления заказа.
 */
export function clearCheckoutDraft() {
    const store = getRuntimeStorage();
    if (store && store.session) {
        store.session.remove('nisha_checkout_draft');
    }
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('nisha_checkout_draft');
        }
    } catch {}
}

/**
 * Сбрасывает inline-стили выпадающего меню способа оплаты.
 * @param {HTMLElement|null} pd
 */
export function resetPaymentDropdownStyles(pd) {
    if (!pd) return;
    pd.style.display = 'none';
    pd.style.opacity = '0';
    pd.style.visibility = 'hidden';
    pd.style.transform = 'translateY(-6px)';
    pd.style.position = 'absolute';
    pd.style.top = '';
    pd.style.left = '';
    pd.style.width = '';
}

/**
 * Закрывает выпадающее меню выбора способа оплаты.
 */
export function closePaymentDropdown() {
    const pd = document.getElementById('paymentDropdown');
    const display = document.getElementById('paymentDisplay');
    const arrow = document.getElementById('paymentArrow');
    if (display) display.classList.remove('is-open');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    if (hasAction('hidePopoverSafe')) {
        invokeAction('hidePopoverSafe', pd);
    } else if (pd && typeof pd.hidePopover === 'function' && pd.matches && pd.matches(':popover-open')) {
        try { pd.hidePopover(); } catch {}
    }
    resetPaymentDropdownStyles(pd);
}

/**
 * Нормализует строковое представление способа оплаты к каноничному виду БД.
 * @param {string} val
 * @returns {'Наложка (предоплата 200грн)'|'Полная предоплата'}
 */
export function normalizePaymentMethodRu(val) {
    const s = String(val || '').toLowerCase();
    if (s.includes('200') || s.includes('налож') || s.includes('наклад') || s.includes('delivery') || s.includes('cod')) {
        return 'Наложка (предоплата 200грн)';
    }
    return 'Полная предоплата';
}

/**
 * Выбирает способ оплаты и сохраняет выбор в черновик заказа.
 * @param {string} dbVal
 * @param {string} [displayLabel]
 */
export function selectPaymentMethod(dbVal, displayLabel) {
    const txt = document.getElementById('paymentSelectedText');
    const input = document.getElementById('orderPaymentMethod');
    const ruVal = normalizePaymentMethodRu(dbVal);
    if (txt) {
        txt.setAttribute('data-i18n', ruVal.includes('200') ? 'checkout.payment_cod' : 'checkout.payment_full');
        txt.innerText = displayLabel || dbVal;
    }
    if (input) input.value = ruVal;
    saveCheckoutDraft();
    closePaymentDropdown();
}

/**
 * Переключает открытие выпадающего списка способа оплаты.
 */
export function togglePaymentDropdown() {
    const pd = document.getElementById('paymentDropdown');
    const display = document.getElementById('paymentDisplay');
    const arrow = document.getElementById('paymentArrow');
    if (!pd) return;
    const isOpen = (pd.matches && pd.matches(':popover-open')) || (pd.style.display === 'block' && pd.style.opacity === '1') || (display && display.classList.contains('is-open'));
    if (isOpen) {
        closePaymentDropdown();
    } else {
        const bd = document.getElementById('branchDropdown');
        if (bd) bd.style.display = 'none';
        const cd = document.getElementById('cityDropdown');
        if (cd) cd.style.display = 'none';
        if (display) display.classList.add('is-open');
        if (hasAction('showPopoverSafe')) {
            invokeAction('showPopoverSafe', pd);
        } else if (typeof pd.showPopover === 'function') {
            try { pd.showPopover(); } catch {}
        }
        if (display && pd.matches && pd.matches(':popover-open')) {
            const rect = display.getBoundingClientRect();
            pd.style.position = 'fixed';
            pd.style.top = `${Math.round(rect.bottom)}px`;
            pd.style.bottom = 'auto';
            pd.style.left = `${Math.round(rect.left)}px`;
            pd.style.width = `${Math.round(rect.width)}px`;
            pd.style.margin = '0';
        }
        pd.style.display = 'block';
        requestAnimationFrame(() => {
            pd.style.opacity = '1';
            pd.style.visibility = 'visible';
            pd.style.transform = 'translateY(0)';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        });
    }
}

/**
 * Привязывает синхронизацию Popover API и скрытие списка оплаты при скролле.
 */
export function initPaymentPopoverSync() {
    if (typeof document === 'undefined') return;
    const pd = document.getElementById('paymentDropdown');
    if (pd && !pd._popoverBound) {
        pd._popoverBound = true;
        pd.addEventListener('toggle', (evt) => {
            if (evt.newState === 'closed') {
                const display = document.getElementById('paymentDisplay');
                const arrow = document.getElementById('paymentArrow');
                if (display) display.classList.remove('is-open');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
                resetPaymentDropdownStyles(pd);
            }
        });
    }
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal && !checkoutModal._scrollDismissBound) {
        checkoutModal._scrollDismissBound = true;
        checkoutModal.addEventListener('scroll', () => {
            closePaymentDropdown();
        }, { capture: true, passive: true });
    }
}

/**
 * Применяет промокод через API `/api/check-promo` и пересчитывает итог корзины.
 * @returns {Promise<void>}
 */
export async function applyPromoCode() {
    sanitizePromoField();
    const input = document.getElementById('promoInput').value.trim().toUpperCase();
    const msg = document.getElementById('promoMessage');
    const btn = document.querySelector('.promo-wrapper button');

    if (!input) return;

    if (btn) btn.innerText = '...';

    const currentCart = getActiveCart();
    const originalTotal = currentCart.reduce((sum, item) => sum + parseCartPrice(item.price), 0);

    try {
        const data = await window.apiClient.post('/api/check-promo', {
            code: input,
            cartTotal: originalTotal
        }, { timeout: 10000, retries: 1 });

        const store = getRuntimeStorage();
        const currentLang = store ? store.get('nisha_lang', 'ua') : 'ua';
        if (typeof i18next !== 'undefined' && i18next.language !== currentLang) {
            await i18next.changeLanguage(currentLang);
        }

        const limitErrorText = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_limit') : 'Лимит использований исчерпан';
        const invalidErrorText = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_invalid') : 'Неверный промокод';

        if (data && data.success) {
            cartState.currentPromoDiscount = data.discount_percent;
            cartState.appliedPromoCode = input;
            if (typeof window !== 'undefined') {
                window.currentPromoDiscount = cartState.currentPromoDiscount;
                window.appliedPromoCode = cartState.appliedPromoCode;
                window.currentPromoFixed = data.is_fixed ? (data.fixed_amount || data.saved_money) : null;
            }
            updateCartUI();
        } else {
            cartState.currentPromoDiscount = 0;
            cartState.appliedPromoCode = '';
            if (typeof window !== 'undefined') {
                window.currentPromoDiscount = 0;
                window.appliedPromoCode = '';
                window.currentPromoFixed = null;
            }

            let errorMsg = invalidErrorText;
            if (data && data.message && (data.message.includes('Лимит') || data.message.includes('Ліміт') || data.message.includes('limit'))) {
                errorMsg = limitErrorText;
            }
            if (msg) {
                msg.innerHTML = renderPromoCodeNotice({
                    isError: true,
                    message: errorMsg
                });
            }
            updateCartUI();
        }
    } catch (err) {
        if (err && (err.name === 'AbortError' || err.isTimeout)) {
            const warmingMsg = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_warming', { defaultValue: 'Сервер запускается, нажмите «Применить» ещё раз' }) : 'Сервер запускается, нажмите «Применить» ещё раз';
            if (msg) {
                msg.innerHTML = renderPromoCodeNotice({
                    isWarning: true,
                    message: warmingMsg
                });
            }
        } else {
            const errMsg = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_error') : 'Ошибка сервера';
            if (msg) {
                msg.innerHTML = renderPromoCodeNotice({
                    isError: true,
                    message: errMsg
                });
            }
        }
        updateCartUI();
    }

    if (btn) btn.innerText = typeof i18next !== 'undefined' ? i18next.t('checkout.apply') : 'ПРИМЕНИТЬ';
}
