// ==========================================
// NISHA CHECKOUT — MODAL OPEN, AUTOFILL & DROPDOWN DISMISS
// ==========================================

import {
    cartState,
    clearDropdownInlineStyles,
    getActiveCart,
    setActiveCart,
    getSupabaseClient,
    setSelectedCityRefState,
    setSelectedBranchRefState
} from './cart-state.js';
import {
    sanitizePromoField,
    saveCheckoutDraft,
    restoreCheckoutDraft,
    clearCheckoutDraft,
    closePaymentDropdown,
    normalizePaymentMethodRu,
    selectPaymentMethod,
    togglePaymentDropdown,
    initPaymentPopoverSync,
    applyPromoCode
} from './checkout-promo.js';
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
import { getLenisInstance, getRuntimeProfile, getRuntimeStorage, getRuntimeUser } from '../core/runtime-env.js';

export {
    sanitizePromoField,
    saveCheckoutDraft,
    restoreCheckoutDraft,
    clearCheckoutDraft,
    closePaymentDropdown,
    normalizePaymentMethodRu,
    selectPaymentMethod,
    togglePaymentDropdown,
    initPaymentPopoverSync,
    applyPromoCode
};

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
        else {
            const activeLenis = getLenisInstance();
            if (activeLenis) activeLenis.stop();
        }

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

        const activeProfile = getRuntimeProfile();
        const deliveryStore = getRuntimeStorage();
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
                    const store = getRuntimeStorage();
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
                    const store = getRuntimeStorage();
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
        const isAuth = !!getRuntimeUser();
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
    window.clearCheckoutDraft = clearCheckoutDraft;
}
