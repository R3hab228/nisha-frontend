// ==========================================
// NISHA CHECKOUT — DRAFT, MODAL OPEN, PROMOCODES & PAYMENT DROPDOWN
// ==========================================

import {
    cartState,
    parseCartPrice,
    renderPromoCodeNotice,
    clearDropdownInlineStyles,
    getActiveCart,
    setActiveCart,
    getSupabaseClient,
    setSelectedCityRefState,
    setSelectedBranchRefState
} from './cart-state.js';
import { updateCartUI, closeCartDropdown } from './cart-ui.js';
import { syncCartToServer } from './cart-operations.js';
import {
    updateNPClearButtons,
    hideNPDropdowns,
    calculateDeliveryCost
} from './novaposhta-helpers.js';
import {
    ensureCityRef,
    ensureBranchRef,
    loadNPBranches,
    autoDetectCity
} from './novaposhta-delivery.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';

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
 * Автосохранение черновика формы оформления заказа в sessionStorage.
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
        const store = (typeof window !== 'undefined' && window.storage) || (typeof storage !== 'undefined' ? storage : null);
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
        const store = (typeof window !== 'undefined' && window.storage) || (typeof storage !== 'undefined' ? storage : null);
        let draft = null;
        if (store && store.session) {
            draft = store.session.getJSON('nisha_checkout_draft', null);
        } else {
            try {
                if (typeof sessionStorage !== 'undefined') {
                    const raw = sessionStorage.getItem('nisha_checkout_draft');
                    draft = raw ? JSON.parse(raw) : null;
                }
            } catch (e) {
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
    } catch (e) { return false; }
}

/**
 * Очищает сохранённый черновик оформления заказа.
 */
export function clearCheckoutDraft() {
    const store = (typeof window !== 'undefined' && window.storage) || (typeof storage !== 'undefined' ? storage : null);
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

        const store = (typeof window !== 'undefined' && window.storage) || (typeof storage !== 'undefined' ? storage : null);
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

/**
 * Открывает модальное окно оформления заказа с проверкой наличия и автоподстановкой профиля.
 * @returns {Promise<void>}
 */
export async function openCheckoutModal() {
    if (cartState.isCheckoutOpening) return;
    const btn = document.querySelector('.cart-panel .cart-checkout-btn');
    if (!btn) return;

    cartState.isCheckoutOpening = true;
    const originalText = btn.innerText;
    btn.innerText = typeof i18next !== 'undefined' ? i18next.t('checkout.checking_stock', { defaultValue: '[ ПРОВЕРКА НАЛИЧИЯ... ]' }) : '[ ПРОВЕРКА НАЛИЧИЯ... ]';
    btn.style.pointerEvents = 'none';

    try {
        let currentCart = getActiveCart();
        const itemIds = currentCart.map(i => i.id);
        const sb = getSupabaseClient();

        let hasSoldItems = false;
        if (sb && itemIds.length > 0) {
            const { data: dbItems, error } = await sb.from('items').select('id, name, status').in('id', itemIds);

            if (dbItems && !error) {
                currentCart = currentCart.filter(cartItem => {
                    const cId = String(cartItem?.id || cartItem?.item_id || cartItem).trim();
                    const dbItem = dbItems.find(i => String(i.id).trim() === cId);
                    if (dbItem && dbItem.status === 'sold') {
                        const itemBoughtMsg = typeof i18next !== 'undefined' ? i18next.t('checkout.item_bought_toast', { name: cartItem.name, defaultValue: `Товар "${cartItem.name}" уже кто-то купил! 😢` }) : `Товар "${cartItem.name}" уже кто-то купил! 😢`;
                        showToast(itemBoughtMsg, 'error');
                        hasSoldItems = true;
                        return false;
                    }
                    return true;
                });
            }
        }

        if (hasSoldItems) {
            setActiveCart(currentCart);
            await syncCartToServer();
            updateCartUI();
            btn.innerText = originalText;
            btn.style.pointerEvents = 'auto';
            if (currentCart.length === 0) closeCartDropdown();
            return;
        }

        btn.innerText = originalText;
        btn.style.pointerEvents = 'auto';

        closeCartDropdown();
        hideNPDropdowns();

        if (hasAction('stopLenis')) invokeAction('stopLenis');
        else if (typeof lenis !== 'undefined') lenis.stop();

        if (typeof openModal === 'function') {
            openModal('checkoutModal');
        } else {
            const checkoutModal = document.getElementById('checkoutModal');
            if (checkoutModal) {
                checkoutModal.inert = false;
                checkoutModal.removeAttribute('inert');
                checkoutModal.setAttribute('aria-hidden', 'false');
                checkoutModal.style.display = 'flex';
            }
            document.body.style.overflow = 'hidden';
        }
        if (typeof triggerModalTypewriter === 'function') triggerModalTypewriter('checkoutModal');
        if (typeof window !== 'undefined' && window.analytics && typeof window.analytics.trackCheckoutStart === 'function') {
            window.analytics.trackCheckoutStart(currentCart);
        }
        if (hasAction('warmupBackendServer')) invokeAction('warmupBackendServer', true);
        if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
        if (typeof initTurnstileWidgets === 'function') setTimeout(initTurnstileWidgets, 100);

        const orderNameEl = document.getElementById('orderName');
        if (orderNameEl) {
            if (hasAction('attachFullNameAutoCapitalize')) {
                invokeAction('attachFullNameAutoCapitalize', orderNameEl);
            } else if (!orderNameEl._lettersOnlyBound) {
                orderNameEl._lettersOnlyBound = true;
                orderNameEl.addEventListener('input', function() {
                    this.value = this.value.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '');
                });
            }

            if (typeof orderNameEl.addEventListener === 'function' && !orderNameEl._autofillShieldBound) {
                orderNameEl._autofillShieldBound = true;
                if (orderNameEl.value && typeof orderNameEl.value.trim === 'function' && orderNameEl.value.trim()) {
                    orderNameEl._lastExplicitValue = orderNameEl.value.trim();
                }
                orderNameEl.addEventListener('input', () => {
                    if (document.activeElement === orderNameEl) {
                        orderNameEl.dataset.userTyped = '1';
                        orderNameEl._lastExplicitValue = orderNameEl.value;
                    } else if (orderNameEl._lastExplicitValue && orderNameEl.value !== orderNameEl._lastExplicitValue) {
                        orderNameEl.value = orderNameEl._lastExplicitValue;
                        saveCheckoutDraft();
                    }
                });
            }
        }

        ['orderName', 'orderPhone', 'orderCity', 'orderBranch'].forEach(fieldId => {
            const el = document.getElementById(fieldId);
            if (el && !el._draftBound) {
                el._draftBound = true;
                el.addEventListener('input', saveCheckoutDraft);
            }
        });

        const promoEl = document.getElementById('promoInput');
        if (promoEl && !promoEl._guardBound) {
            promoEl._guardBound = true;
            promoEl.addEventListener('change', sanitizePromoField);
            promoEl.addEventListener('focus', sanitizePromoField);
        }

        hideNPDropdowns();

        const activeProfile = (typeof window !== 'undefined' && window.userProfile) || (typeof userProfile !== 'undefined' ? userProfile : null);
        const deliveryStore = (typeof window !== 'undefined' && window.storage) || (typeof storage !== 'undefined' ? storage : null);
        const cachedDelivery = deliveryStore ? deliveryStore.getJSON('nisha_profile_delivery', null) : null;
        const cachedRefs = deliveryStore ? deliveryStore.getJSON('nisha_profile_delivery_refs', null) : null;

        const profFullNameEl = document.getElementById('profileDeliveryFullName') || document.getElementById('modalProfileDeliveryFullName');
        const profPhoneEl = document.getElementById('profilePhone') || document.getElementById('modalProfilePhone');
        const profCityEl = document.getElementById('profileDeliveryCity') || document.getElementById('modalProfileDeliveryCity');
        const profBranchEl = document.getElementById('profileDeliveryBranch') || document.getElementById('modalProfileDeliveryBranch');
        const profAddrEl = document.getElementById('profileDeliveryAddress') || document.getElementById('modalProfileDeliveryAddress');

        const profileFullName = (activeProfile?.full_name || cachedDelivery?.full_name || profFullNameEl?.value || '').trim();
        const profilePhone = (activeProfile?.phone || window.userProfile?.phone || profPhoneEl?.value || (deliveryStore ? (deliveryStore.get('nisha_last_phone') || deliveryStore.get('user_phone')) : '') || '').trim();
        const profileAddress = (activeProfile?.delivery_address || cachedDelivery?.delivery_address || profAddrEl?.value || '').trim();
        const profCityVal = (profCityEl?.value || '').trim();
        const profBranchVal = (profBranchEl?.value || activeProfile?.delivery_branch || cachedDelivery?.delivery_branch || '').trim();

        const parsed = (typeof parseDeliveryAddress === 'function')
            ? parseDeliveryAddress(profileAddress)
            : (hasAction('parseDeliveryAddress') ? invokeAction('parseDeliveryAddress', profileAddress) : null);
        const pCity = (parsed && parsed.city) ? parsed.city : (profCityVal || profileAddress);
        const pBranch = (parsed && parsed.branch) ? parsed.branch : profBranchVal;

        const savedCityRef = activeProfile?.delivery_city_ref || cachedRefs?.cityRef || cachedDelivery?.delivery_city_ref || window.profileSelectedCityRef?.desktop || window.profileSelectedCityRef?.modal || '';
        const savedBranchRef = activeProfile?.delivery_branch_ref || cachedRefs?.branchRef || cachedDelivery?.delivery_branch_ref || window.profileSelectedBranchRef?.desktop || window.profileSelectedBranchRef?.modal || '';

        const nameInput = document.getElementById('orderName');
        const phoneInput = document.getElementById('orderPhone');
        const cityInput = document.getElementById('orderCity');
        const branchInput = document.getElementById('orderBranch');

        const alreadyFilled = !!(cityInput && cityInput.value.trim() && branchInput && branchInput.value.trim() && ((typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef));

        if (alreadyFilled) {
            if (branchInput) branchInput.readOnly = false;
            if (nameInput && !nameInput.value.trim() && profileFullName) nameInput.value = profileFullName;
            if (phoneInput && !phoneInput.value.trim() && profilePhone) {
                phoneInput.value = profilePhone;
                if (typeof formatPhoneInput === 'function') formatPhoneInput(phoneInput);
            }
        } else {
            restoreCheckoutDraft();

            if (nameInput && !nameInput.value.trim() && profileFullName) {
                nameInput.value = profileFullName;
                nameInput._lastExplicitValue = profileFullName;
            }

            if (phoneInput && !phoneInput.value.trim() && profilePhone) {
                phoneInput.value = profilePhone;
                if (typeof formatPhoneInput === 'function') formatPhoneInput(phoneInput);
            }

            if (cityInput && !cityInput.value.trim()) {
                if (pCity) {
                    cityInput.value = pCity;
                    if (savedCityRef) setSelectedCityRefState(savedCityRef);
                } else {
                    const store = (typeof window !== 'undefined' && window.storage) || (typeof storage !== 'undefined' ? storage : null);
                    const pastOrder = store ? store.getJSON('nisha_checkout_data', null) : null;
                    if (pastOrder && pastOrder.city) {
                        cityInput.value = pastOrder.city;
                        if (pastOrder.cityRef) setSelectedCityRefState(pastOrder.cityRef);
                    } else {
                        autoDetectCity();
                    }
                }
            }

            if (cityInput && cityInput.value.trim() && branchInput) {
                branchInput.readOnly = false;
            }

            if (branchInput && !branchInput.value.trim()) {
                if (pBranch) {
                    branchInput.value = pBranch;
                    branchInput.readOnly = false;
                    if (savedBranchRef) setSelectedBranchRefState(savedBranchRef);
                } else {
                    const store = (typeof window !== 'undefined' && window.storage) || (typeof storage !== 'undefined' ? storage : null);
                    const pastOrder = store ? store.getJSON('nisha_checkout_data', null) : null;
                    if (pastOrder && pastOrder.branch && (!pastOrder.city || pastOrder.city === (cityInput?.value || '').trim())) {
                        branchInput.value = pastOrder.branch;
                        branchInput.readOnly = false;
                        if (pastOrder.branchRef) setSelectedBranchRefState(pastOrder.branchRef);
                    }
                }
            }
        }

        const currentCityVal = (cityInput?.value || '').trim();
        const currentBranchVal = (branchInput?.value || '').trim();

        if (currentCityVal) {
            if (!((typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef)) {
                ensureCityRef().then(ref => {
                    if (!ref) return;
                    const bVal = (branchInput?.value || '').trim();
                    if (bVal && !((typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef)) {
                        ensureBranchRef(bVal).catch(() => {});
                    } else {
                        loadNPBranches('', false).catch(() => {});
                    }
                    hideNPDropdowns();
                }).catch(() => {});
            } else {
                if (currentBranchVal && !((typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef)) {
                    ensureBranchRef(currentBranchVal).catch(() => {});
                } else {
                    if ((typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef) {
                        calculateDeliveryCost();
                    }
                    loadNPBranches('', false).catch(() => {});
                }
            }
        }

        if (nameInput && nameInput.value.trim()) {
            nameInput._lastExplicitValue = nameInput.value.trim();
        }

        sanitizePromoField();
        updateNPClearButtons();
        setTimeout(sanitizePromoField, 400);
        setTimeout(updateNPClearButtons, 400);
        setTimeout(sanitizePromoField, 1500);
        setTimeout(hideNPDropdowns, 600);

        if (branchInput && !branchInput._unlockBound) {
            branchInput._unlockBound = true;
            const unlockOnly = () => {
                const cVal = document.getElementById('orderCity')?.value.trim();
                if (cVal && cVal.length >= 2) {
                    branchInput.readOnly = false;
                }
            };
            const unlockAndLoad = () => {
                const cVal = document.getElementById('orderCity')?.value.trim();
                if (cVal && cVal.length >= 2) {
                    branchInput.readOnly = false;
                    scrollNPFieldIntoModalView(branchInput);
                    const bd = document.getElementById('branchDropdown');
                    if (!bd || bd.style.display !== 'block') {
                        loadNPBranches('', true);
                    }
                }
            };
            branchInput.addEventListener('click', unlockAndLoad);
            branchInput.addEventListener('touchstart', unlockOnly, { passive: true });
        }

        if (cityInput && !cityInput._scrollBound) {
            cityInput._scrollBound = true;
            cityInput.addEventListener('focus', () => {
                scrollNPFieldIntoModalView(cityInput);
            });
        }

        if (branchInput && !branchInput._enterBound) {
            branchInput._enterBound = true;
            branchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const bd = document.getElementById('branchDropdown');
                    if (bd) {
                        const firstItem = bd.querySelector('.branch-item, div[data-branch-ref]');
                        if (firstItem && !window.selectedBranchRef) {
                            if (typeof firstItem._selectItem === 'function') {
                                firstItem._selectItem();
                            } else if (typeof firstItem.click === 'function') {
                                firstItem.click();
                            }
                        }
                        bd.style.display = 'none';
                    }
                    branchInput.blur();
                }
            });
        }

        if (cityInput && !cityInput._enterBound) {
            cityInput._enterBound = true;
            cityInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const cd = document.getElementById('cityDropdown');
                    if (cd) {
                        const firstCity = cd.querySelector('.city-item, div');
                        if (firstCity && !window.selectedCityRef) {
                            if (typeof firstCity._selectItem === 'function') {
                                firstCity._selectItem();
                            } else if (typeof firstCity.click === 'function') {
                                firstCity.click();
                            }
                        }
                        cd.style.display = 'none';
                    }
                    cityInput.blur();
                }
            });
        }

        const saveWrap = document.getElementById('saveDeliveryToProfileWrap');
        const isAuth = !!(window.currentUser || (typeof currentUser !== 'undefined' && currentUser));
        if (saveWrap) {
            saveWrap.style.display = isAuth ? 'flex' : 'none';
        }

        if (document.getElementById('orderPhone')?.value && typeof checkPhoneAuth === 'function') {
            checkPhoneAuth();
        }

        if (cartState.selectedCityRef && cartState.selectedBranchRef && getActiveCart().length > 0) {
            calculateDeliveryCost();
        }
    } finally {
        setTimeout(() => { cartState.isCheckoutOpening = false; }, 400);
    }
}

/**
 * Единый обработчик кликов и тапов вне выпадающих меню (города, отделения, оплата, корзина, язык).
 * @param {Event} e
 */
export function handleDropdownsOutsideClick(e) {
    if (!e || !e.target || typeof e.target.closest !== 'function') return;
    if (!e.target.closest('#orderCity') && !e.target.closest('#cityDropdown') && !e.target.closest('#clearOrderCityBtn')) {
        const cd = document.getElementById('cityDropdown');
        if (cd) cd.style.display = 'none';
    }
    if (!e.target.closest('#orderBranch') && !e.target.closest('#branchDropdown') && !e.target.closest('#clearOrderBranchBtn')) {
        const bd = document.getElementById('branchDropdown');
        if (bd) bd.style.display = 'none';
    }
    if (!e.target.closest('#paymentDisplay') && !e.target.closest('#paymentDropdown')) {
        closePaymentDropdown();
    }
    if (!e.target.closest('#cartInfoWrapper') && !e.target.closest('#cartDropdown')) {
        const cartDrop = document.getElementById('cartDropdown');
        if (cartDrop && cartDrop.classList.contains('active')) {
            cartDrop.classList.remove('active');
            clearDropdownInlineStyles(cartDrop);
            const panel = document.getElementById('cartPanel');
            if (panel) panel.classList.remove('dropdown-open');
            const fab = document.querySelector('.fab-propose');
            if (fab) {
                fab.style.removeProperty('display');
                fab.style.removeProperty('opacity');
                fab.style.removeProperty('pointer-events');
            }
        }
    }
    if (!e.target.closest('#footerLangWrapper')) {
        const langWrap = document.getElementById('footerLangWrapper');
        if (langWrap) langWrap.classList.remove('active');
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', handleDropdownsOutsideClick, { passive: true });
    document.addEventListener('mousedown', handleDropdownsOutsideClick);
    document.addEventListener('touchstart', handleDropdownsOutsideClick, { passive: true });
}

registerActions({
    sanitizePromoField,
    saveCheckoutDraft,
    restoreCheckoutDraft,
    clearCheckoutDraft,
    closePaymentDropdown,
    normalizePaymentMethodRu,
    selectPaymentMethod,
    togglePaymentDropdown,
    applyPromoCode,
    openCheckoutModal
});

if (typeof window !== 'undefined') {
    window.sanitizePromoField = sanitizePromoField;
    window.saveCheckoutDraft = saveCheckoutDraft;
    window.restoreCheckoutDraft = restoreCheckoutDraft;
    window.clearCheckoutDraft = clearCheckoutDraft;
    window.closePaymentDropdown = closePaymentDropdown;
    window.normalizePaymentMethodRu = normalizePaymentMethodRu;
    window.selectPaymentMethod = selectPaymentMethod;
    window.togglePaymentDropdown = togglePaymentDropdown;
    window.applyPromoCode = applyPromoCode;
    window.openCheckoutModal = openCheckoutModal;
}
