// @ts-check
// ==========================================
// NISHA CHECKOUT — VALIDATION, EMAIL PROMPT & ORDER EXECUTION
// ==========================================

import {
    cartState,
    resetPromoState,
    getActiveCart,
    setActiveCart,
    getCurrentUser,
    getSupabaseClient,
    withCheckoutLock,
    setSelectedCityRefState,
    setSelectedBranchRefState
} from './cart-state.js';
import { updateCartUI } from './cart-ui.js';
import { syncCartToServer } from './cart-operations.js';
import { _npNorm } from './novaposhta-helpers.js';
import { ensureCityRef, ensureBranchRef } from './novaposhta-delivery.js';
import { clearCheckoutDraft } from './checkout-form.js';
import { hasAction, invokeAction, registerActions, resolveAction } from '../core/action-registry.js';
import { getRuntimeUser, getRuntimeProfile, getRuntimeFingerprint, getRuntimeStorage, getRuntimeSiteLang, tSafe } from '../core/runtime-env.js';
import { clearAllBargainState } from '../core/bargain-storage.js';

/**
 * Нормализует телефон к международному формату `+380...`.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeOrderPhone(raw) {
    if (!raw) return '';
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length === 10 && digits.startsWith('0')) {
        return '+38' + digits;
    } else if (digits.length === 9) {
        return '+380' + digits;
    } else if (digits.length === 12 && digits.startsWith('380')) {
        return '+' + digits;
    }
    return raw.replace(/[^\d+]/g, '');
}

/**
 * Подсвечивает ошибочное поле ввода и снимает подсветку при первом изменении.
 * @param {(HTMLElement & { _clearErrorCtrl?: AbortController | null }) | null} inputEl
 */
export function highlightFieldError(inputEl) {
    if (!inputEl) return;
    inputEl.classList.add('input-field-error');
    try {
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}
    try {
        inputEl.focus();
    } catch {}
    if (inputEl._clearErrorCtrl) {
        try { inputEl._clearErrorCtrl.abort(); } catch {}
    }
    const clearCtrl = new AbortController();
    inputEl._clearErrorCtrl = clearCtrl;
    const onClear = () => {
        inputEl.classList.remove('input-field-error');
        clearCtrl.abort();
        inputEl._clearErrorCtrl = null;
    };
    inputEl.addEventListener('input', onClear, { signal: clearCtrl.signal });
    inputEl.addEventListener('change', onClear, { signal: clearCtrl.signal });
}

/**
 * Первичная проверка формы оформления заказа, OTP-верификация и запрос E-mail.
 * @returns {Promise<void>}
 */
export async function submitOrder() {
    if (cartState.isOrderSubmitting) return;
    if (getActiveCart().length === 0) {
        if (typeof showToast === 'function') showToast(tSafe('messages.cart_empty', 'Корзина пуста!'), 'error');
        if (hasAction('closeModal')) invokeAction('closeModal', 'checkoutModal');
        return;
    }
    if (hasAction('triggerVibration')) invokeAction('triggerVibration', 150);
    const g = /** @type {any} */ (globalThis);
    const botTrap = /** @type {HTMLInputElement | null} */ (document.getElementById('botTrap'));
    if (botTrap && botTrap.value !== '') return;

    const activeUser = getRuntimeUser();
    const activeProfile = getRuntimeProfile();
    if (activeUser && activeProfile && activeProfile.phone && activeProfile.phone.trim()) {
        const ordPhone = /** @type {HTMLInputElement | null} */ (document.getElementById('orderPhone'));
        if (ordPhone) ordPhone.value = activeProfile.phone.trim();
        window.otpVerified = true;
    } else if (typeof g.getUserPhone === 'function') {
        const uPhone = g.getUserPhone();
        if (uPhone) {
            const ordPhone = /** @type {HTMLInputElement | null} */ (document.getElementById('orderPhone'));
            if (ordPhone && !ordPhone.value.trim()) ordPhone.value = uPhone;
            window.otpVerified = true;
        }
    }

    const trackAttempt = (/** @type {string} */ stage, reason = '') => {
        if (typeof window !== 'undefined' && window.analytics && typeof window.analytics.trackCheckoutAttempt === 'function') {
            window.analytics.trackCheckoutAttempt({
                stage,
                reason,
                itemsCount: getActiveCart().length
            });
        }
    };

    const isVerified = Boolean(window.otpVerified || g.otpVerified);
    if (!isVerified) {
        trackAttempt('validation_failed', 'phone_unverified');
        const verifyPhoneMsg = tSafe('checkout.verify_phone_first', 'Подтвердите номер телефона!');
        showToast?.(verifyPhoneMsg, 'error');
        return;
    }

    const nameInput = /** @type {HTMLInputElement | null} */ (document.getElementById('orderName'));
    const phoneInput = /** @type {HTMLInputElement | null} */ (document.getElementById('orderPhone'));
    const cityInput = /** @type {HTMLInputElement | null} */ (document.getElementById('orderCity'));
    const branchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('orderBranch'));

    const rawName = (nameInput ? nameInput.value : '').trim();
    const cleanLettersName = rawName.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '').trim();
    const rawCity = (cityInput ? cityInput.value : '').trim();
    const rawBranch = (branchInput ? branchInput.value : '').trim();

    const sanitize = resolveAction('sanitizeText') || ((/** @type {any} */ s) => String(s || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
    const name = sanitize(cleanLettersName);
    const city = sanitize(rawCity);
    const branch = sanitize(rawBranch);

    const phoneRaw = phoneInput ? phoneInput.value : '';
    const phone = normalizeOrderPhone(phoneRaw);

    if (!name || name.length < 2) {
        trackAttempt('validation_failed', 'invalid_name');
        highlightFieldError(nameInput);
        showToast?.(tSafe('messages.req_fields', 'Введите ваше имя (от 2 букв)!'), 'error');
        return;
    }

    const phoneDigits = phone.replace(/[^\d]/g, '');
    const isValidUAPhone = phoneDigits.length === 12 && phoneDigits.startsWith('380');
    if (!phone || !isValidUAPhone) {
        trackAttempt('validation_failed', 'invalid_phone');
        highlightFieldError(phoneInput);
        showToast?.(tSafe('messages.valid_phone', 'Введите полный номер телефона (+380...)!'), 'error');
        return;
    }

    let cityRef = (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef;
    if (!cityRef && city) {
        try {
            cityRef = await ensureCityRef();
        } catch (e) {
            console.warn('ensureCityRef on submit:', e);
        }
        if (!cityRef && city.length >= 2) {
            cityRef = 'city_auto_' + _npNorm(city);
            setSelectedCityRefState(cityRef);
        }
    }

    if (!city || !cityRef) {
        trackAttempt('validation_failed', 'missing_city');
        highlightFieldError(cityInput);
        const chooseCityMsg = tSafe('checkout.choose_city_from_dropdown', 'Выберите Город строго из выпадающего списка!');
        showToast?.(chooseCityMsg, 'error');
        return;
    }

    let branchRef = (typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef;
    if (!branchRef && branch) {
        try {
            branchRef = await ensureBranchRef(branch);
        } catch (e) {
            console.warn('ensureBranchRef on submit:', e);
        }
        if (!branchRef && branch.length >= 2) {
            branchRef = 'branch_auto_' + _npNorm(branch);
            setSelectedBranchRefState(branchRef);
        }
    }

    if (!branch || !branchRef) {
        trackAttempt('validation_failed', 'missing_branch');
        highlightFieldError(branchInput);
        const chooseBranchMsg = tSafe('checkout.choose_branch_from_dropdown', 'Выберите Отделение или Поштомат из выпадающего списка!');
        showToast?.(chooseBranchMsg, 'error');
        return;
    }

    trackAttempt('submit_valid', '');

    const store = getRuntimeStorage();
    const savedEmailPreference = store ? store.get('nisha_email_preference') : null;

    if (savedEmailPreference === 'skipped') {
        return await executeOrderFinal('');
    }
    if (savedEmailPreference && savedEmailPreference.includes('@')) {
        return await executeOrderFinal(savedEmailPreference);
    }

    const user = getCurrentUser();
    if (user && user.email) {
        if (store) store.set('nisha_email_preference', user.email);
        return await executeOrderFinal(user.email);
    }

    return await executeOrderFinal('');
}

/**
 * Атомарное создание заказа через backend API с безопасным RPC-фоллбэком.
 * @param {string} emailToSave
 * @returns {Promise<void>}
 */
export async function executeOrderFinal(emailToSave) {
    return await withCheckoutLock(async () => {
        if (cartState.isOrderSubmitting) return;
        if (getActiveCart().length === 0) {
            if (typeof showToast === 'function') showToast(tSafe('messages.cart_empty', 'Корзина пуста!'), 'error');
            if (hasAction('closeModal')) invokeAction('closeModal', 'checkoutModal');
            return;
        }
        cartState.isOrderSubmitting = true;
        const btnSubmit = document.getElementById('btnSubmitOrder');
        if (!btnSubmit) {
            cartState.isOrderSubmitting = false;
            return;
        }

        function resetSubmitButton() {
            if (!btnSubmit) return;
            btnSubmit.style.pointerEvents = 'auto';
            btnSubmit.style.position = '';
            btnSubmit.style.overflow = '';
            btnSubmit.style.color = '';
            btnSubmit.innerHTML = tSafe('checkout.btn_submit', 'ПОДТВЕРДИТЬ ЗАКАЗ');
        }

        btnSubmit.style.pointerEvents = 'none';
        btnSubmit.style.position = 'relative';
        btnSubmit.style.overflow = 'hidden';
        btnSubmit.style.color = '#000';
        const processingLabel = tSafe('checkout.processing_data', '[ ОБРАБОТКА ДАННЫХ... ]');
        btnSubmit.innerHTML = `
            <span class="checkout-submit-label">${processingLabel}</span>
            <div id="btnProgressBar" class="checkout-submit-progress"></div>
        `;

        const g = /** @type {any} */ (globalThis);
        const scheduleBarStart = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (/** @type {() => void} */ cb) => setTimeout(cb, 0);
        scheduleBarStart(() => {
            const bar = document.getElementById('btnProgressBar');
            if (bar) bar.style.width = '90%';
        });

        const orderNameEl = /** @type {HTMLInputElement | null} */ (document.getElementById('orderName'));
        const orderPhoneEl = /** @type {HTMLInputElement | null} */ (document.getElementById('orderPhone'));
        const orderCityEl = /** @type {HTMLInputElement | null} */ (document.getElementById('orderCity'));
        const orderBranchEl = /** @type {HTMLInputElement | null} */ (document.getElementById('orderBranch'));
        const orderPaymentEl = /** @type {HTMLInputElement | null} */ (document.getElementById('orderPaymentMethod'));

        const rawName = (orderNameEl ? orderNameEl.value : '').trim();
        const name = rawName.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '').trim();
        const phoneRaw = orderPhoneEl ? orderPhoneEl.value : '';
        const phone = normalizeOrderPhone(phoneRaw);
        const city = (orderCityEl ? orderCityEl.value : '').trim();
        const branch = (orderBranchEl ? orderBranchEl.value : '').trim();
        const rawPaymentVal = orderPaymentEl ? orderPaymentEl.value : '';
        const lowerPmVal = String(rawPaymentVal || '').toLowerCase();
        const paymentMethod = (lowerPmVal.includes('200') || lowerPmVal.includes('налож') || lowerPmVal.includes('наклад') || lowerPmVal.includes('delivery') || lowerPmVal.includes('cod'))
            ? 'Наложка (предоплата 200грн)'
            : 'Полная предоплата';
        const nameWithPayment = paymentMethod ? name + ' [' + paymentMethod + ']' : name;

        const currentCart = getActiveCart();
        const orderItemIds = currentCart.map(i => i.id);

        let cityRef = (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef;
        if (!cityRef && city) {
            try { cityRef = await ensureCityRef(); } catch {}
            if (!cityRef && city.length >= 2) {
                cityRef = 'city_auto_' + _npNorm(city);
                setSelectedCityRefState(cityRef);
            }
        }

        let branchRef = (typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef;
        if (!branchRef && branch) {
            try { branchRef = await ensureBranchRef(branch); } catch {}
            if (!branchRef && branch.length >= 2) {
                branchRef = 'branch_auto_' + _npNorm(branch);
                setSelectedBranchRefState(branchRef);
            }
        }

        if (!city || !cityRef) {
            cartState.isOrderSubmitting = false;
            resetSubmitButton();
            const cityInput = document.getElementById('orderCity');
            highlightFieldError(cityInput);
            const chooseCityMsg = tSafe('checkout.choose_city_from_dropdown', 'Выберите Город строго из выпадающего списка!');
            showToast?.(chooseCityMsg, 'error');
            return;
        }
        if (!branch || !branchRef) {
            cartState.isOrderSubmitting = false;
            resetSubmitButton();
            const branchInput = document.getElementById('orderBranch');
            highlightFieldError(branchInput);
            const chooseBranchMsg = tSafe('checkout.choose_branch_from_dropdown', 'Выберите Отделение или Поштомат из выпадающего списка!');
            showToast?.(chooseBranchMsg, 'error');
            return;
        }

        const checkoutData = {
            name: name,
            phone: phoneRaw,
            city: city,
            branch: branch,
            cityRef: cityRef,
            branchRef: branchRef
        };
        if (window.storage && typeof window.storage.setJSON === 'function') {
            window.storage.setJSON('nisha_checkout_data', checkoutData);
        }

        try {
            const user = getCurrentUser();
            const sb = getSupabaseClient();
            const activePromo = window.appliedPromoCode || cartState.appliedPromoCode || null;
            const idempotencyKey = window.apiClient.generateIdempotencyKey('order');

            let orderId = null;
            let finalTotalSum = currentCart.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
            let finalOrderItems = currentCart.map(i => {
                const clone = (typeof deepClone === 'function')
                    ? deepClone(i)
                    : ((typeof structuredClone === 'function') ? structuredClone(i) : { ...i });
                clone.currentPrice = clone.currentPrice !== undefined ? clone.currentPrice : clone.price;
                return clone;
            });
            let createdAtIso = new Date().toISOString();
            let handledViaAtomicServer = false;
            const saveDeliveryCheckbox = /** @type {HTMLInputElement | null} */ (document.getElementById('saveDeliveryToProfileCheckbox'));
            const shouldSaveToProfile = !!(user && (!saveDeliveryCheckbox || saveDeliveryCheckbox.checked));

            // 1. ОСНОВНОЙ ПУТЬ: Атомарное оформление через защищенный сервер (/api/create-order)
            try {
                const activeClientId = getRuntimeFingerprint() || (user ? user.id : null) || ('guest_' + Date.now());
                const serverOrderRes = await window.apiClient.post('/api/create-order', {
                    userId: user ? user.id : null,
                    clientId: String(activeClientId),
                    name: name,
                    phone: phone,
                    email: emailToSave,
                    tg: '',
                    city: city,
                    branch: branch,
                    cityRef: cityRef || '',
                    branchRef: branchRef || '',
                    itemIds: orderItemIds,
                    promocode: activePromo,
                    paymentMethod: paymentMethod,
                    saveToProfile: shouldSaveToProfile,
                    lang: getRuntimeSiteLang()
                }, {
                    idempotencyKey: idempotencyKey,
                    timeout: 15000,
                    retries: 1
                });

                if (serverOrderRes && serverOrderRes.success && serverOrderRes.orderId) {
                    orderId = serverOrderRes.orderId;
                    if (serverOrderRes.totalSum) finalTotalSum = Number(serverOrderRes.totalSum);
                    if (Array.isArray(serverOrderRes.items) && serverOrderRes.items.length > 0) {
                        finalOrderItems = serverOrderRes.items;
                    }
                    if (serverOrderRes.createdAt) createdAtIso = serverOrderRes.createdAt;
                    handledViaAtomicServer = true;
                } else if (serverOrderRes && !serverOrderRes.success) {
                    if (serverOrderRes.code === 'ITEM_UNAVAILABLE') {
                        const unavailIds = new Set((serverOrderRes.unavailableItems || []).map((/** @type {any} */ u) => String(u.id)));
                        const updatedCart = unavailIds.size > 0
                            ? currentCart.filter(ci => !unavailIds.has(String(ci.id)))
                            : currentCart;
                        setActiveCart(updatedCart);
                        await syncCartToServer();
                        updateCartUI();
                        if (updatedCart.length === 0 && typeof g.closeModal === 'function') {
                            g.closeModal('checkoutModal');
                        }
                        throw new Error(serverOrderRes.message || 'Один из товаров уже куплен другим покупателем!');
                    }
                    if (serverOrderRes._status && serverOrderRes._status >= 400 && serverOrderRes._status < 500 && serverOrderRes._status !== 404) {
                        throw new Error(serverOrderRes.message || 'Ошибка проверки данных заказа');
                    }
                }
            } catch (serverErr) {
                const errMsg = serverErr instanceof Error
                    ? serverErr.message
                    : (serverErr && typeof serverErr === 'object' && 'message' in serverErr ? String(/** @type {any} */ (serverErr).message) : '');
                if (
                    errMsg.includes('уже кто-то купил') ||
                    errMsg.includes('уже куплен') ||
                    errMsg.includes('оформляется другим') ||
                    errMsg.includes('Доступ запрещен') ||
                    errMsg.includes('отделение') ||
                    errMsg.includes('город') ||
                    errMsg.includes('имя') ||
                    errMsg.includes('телефон') ||
                    errMsg.includes('проверки данных') ||
                    errMsg.includes('Validation')
                ) {
                    cartState.isOrderSubmitting = false;
                    resetSubmitButton();
                    showToast?.(errMsg, 'error');
                    return;
                }
                console.warn('[ЗАКАЗ] Серверный /api/create-order недоступен, используем прямой RPC фоллбэк:', errMsg);
            }

            // 2. РЕЗЕРВНЫЙ ПУТЬ (если сервер Render перезагружается): Прямой транзакционный RPC в Supabase
            if (!handledViaAtomicServer) {
                if (!sb) throw new Error('База данных недоступна');

                if (!city || !branch) {
                    cartState.isOrderSubmitting = false;
                    resetSubmitButton();
                    const chooseCityBranchMsg = tSafe('checkout.choose_city_branch_from_dropdown', 'Выберите Город и Отделение строго из выпадающего списка!');
                    showToast?.(chooseCityBranchMsg, 'error');
                    return;
                }

                /** @type {Record<string, any>} */
                const rpcParams = {
                    p_user_id: user ? user.id : null,
                    p_name: name,
                    p_phone: phone,
                    p_email: emailToSave,
                    p_tg: '',
                    p_city: city,
                    p_branch: branch,
                    p_city_ref: cityRef || '',
                    p_branch_ref: branchRef || '',
                    p_item_ids: orderItemIds,
                    p_promocode: activePromo,
                    p_payment_method: paymentMethod
                };

                const atomicRpc = await sb.rpc('create_atomic_order', rpcParams);
                if (!atomicRpc.error && atomicRpc.data && atomicRpc.data.order_id) {
                    orderId = atomicRpc.data.order_id;
                    if (atomicRpc.data.total_sum) finalTotalSum = Number(atomicRpc.data.total_sum);
                    if (Array.isArray(atomicRpc.data.items) && atomicRpc.data.items.length > 0) {
                        finalOrderItems = atomicRpc.data.items;
                    }
                } else {
                    let { data: fbOrderId, error: orderError } = await sb.rpc('create_secure_order', rpcParams);

                    if (orderError && (orderError.message.includes('p_payment_method') || orderError.message.includes('create_secure_order') || orderError.code === 'PGRST202')) {
                        console.warn('[ЗАКАЗ] Используем обратную совместимость create_secure_order:', orderError.message);
                        delete rpcParams.p_payment_method;
                        rpcParams.p_name = nameWithPayment;
                        const fallbackRes = await sb.rpc('create_secure_order', rpcParams);
                        fbOrderId = fallbackRes.data;
                        orderError = fallbackRes.error;
                    }

                    if (orderError) throw orderError;
                    orderId = fbOrderId;

                    try {
                        await sb.from('orders').update({ status: 'В обработке', payment_method: paymentMethod }).eq('id', orderId);
                    } catch {}
                }
            }

            if (window.analytics && typeof window.analytics.trackPurchase === 'function') {
                window.analytics.trackPurchase({
                    orderId,
                    items: currentCart,
                    value: finalTotalSum,
                    paymentMethod
                });
            } else if (window.ttq) {
                window.ttq.track('CompletePayment', {
                    contents: currentCart.map(i => ({ content_id: i.id, content_name: i.name })),
                    value: finalTotalSum,
                    currency: 'UAH'
                });
            }

            const store = getRuntimeStorage();
            if (store) {
                store.set('nisha_last_phone', phone);
                store.set('nisha_last_order', Date.now());
            }

            if (user && user.id && phone) {
                if (!handledViaAtomicServer) {
                    window.apiClient.post('/api/link-orders', { userId: user.id, phone: phone }, { timeout: 8000 }).catch(() => {});
                }

                if (typeof window.userProfile === 'object' && window.userProfile && !window.userProfile.phone && sb) {
                    window.userProfile.phone = phone;
                    sb.from('profiles').update({ phone: phone }).eq('id', user.id).then(() => {
                        invokeAction('renderProfilePhone', phone);
                    }).catch(() => {});
                }

                if (shouldSaveToProfile) {
                    const combinedAddress = city && branch ? `${city}, ${branch}` : (city || branch);
                    invokeAction('saveDeliveryToProfile', name, combinedAddress, { cityRef, branchRef });
                }
            }

            try {
                let cached = store ? store.getJSON('nisha_cached_orders', []) : [];
                if (!Array.isArray(cached)) cached = [];
                const newOrderObj = {
                    id: orderId,
                    name: name,
                    phone: phone,
                    city: city,
                    branch: branch,
                    status: 'В обработке',
                    total_sum: finalTotalSum,
                    items: finalOrderItems,
                    created_at: createdAtIso
                };
                cached = [newOrderObj, ...cached.filter((/** @type {any} */ c) => c && c.id !== orderId)];
                if (store) store.setJSON('nisha_cached_orders', cached);
            } catch {}

            const allItems = window.allItems;
            if (Array.isArray(allItems) && Array.isArray(finalOrderItems)) {
                finalOrderItems.forEach(ordered => {
                    const catItem = allItems.find(i => i && String(i.id) === String(ordered.id));
                    if (catItem) {
                        catItem.status = 'reserved';
                        invokeAction('updateCardDOM', catItem);
                    }
                    clearAllBargainState(ordered.id);
                });
                invokeAction('updateSidebarCounters');
                if (typeof g.renderHistory === 'function') g.renderHistory();
            }

            setActiveCart([]);
            clearCheckoutDraft();
            resetPromoState();
            await syncCartToServer();
            updateCartUI();

            const bar = document.getElementById('btnProgressBar');
            if (bar) {
                bar.style.transition = 'width 0.2s ease';
                bar.style.width = '100%';
            }

            setTimeout(() => {
                if (typeof g.closeModal === 'function') g.closeModal('checkoutModal');
                btnSubmit.innerHTML = tSafe('checkout.btn_submit', 'ПОДТВЕРДИТЬ ЗАКАЗ');

                const overlay = document.getElementById('orderSuccessOverlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    if (typeof g.triggerModalTypewriter === 'function') g.triggerModalTypewriter(overlay);
                }
                invokeAction('playSound', 'tada', { kind: 'celebrate' });
                if (typeof g.triggerHaptic === 'function') g.triggerHaptic('success');

                setTimeout(() => {
                    if (overlay) overlay.style.display = 'none';
                    invokeAction('loadAllItems');
                    btnSubmit.style.pointerEvents = 'auto';
                    btnSubmit.style.opacity = '1';
                    cartState.isOrderSubmitting = false;
                    invokeAction('maybeShowPostOrderPwaBroadcast');
                }, 3500);
            }, 300);

        } catch (err) {
            cartState.isOrderSubmitting = false;
            invokeAction('captureError', err, { action: 'checkout_order_failed', city: city });
            const orderErrPref = tSafe('checkout.order_submit_err', 'Ошибка при оформлении: ');
            if (typeof g.triggerHaptic === 'function') g.triggerHaptic('error');
            const errMessage = err instanceof Error
                ? err.message
                : (err && typeof err === 'object' && 'message' in err ? String(/** @type {any} */ (err).message) : String(err));
            showToast?.(orderErrPref + errMessage, 'error');
            btnSubmit.innerHTML = tSafe('checkout.btn_submit', 'ПОДТВЕРДИТЬ ЗАКАЗ');
            btnSubmit.style.pointerEvents = 'auto';
            btnSubmit.style.opacity = '1';
            invokeAction('loadAllItems');
        }
    });
}

registerActions({
    normalizeOrderPhone,
    highlightFieldError,
    submitOrder
});

if (typeof window !== 'undefined') {
    window.submitOrder = submitOrder;
    window.executeOrderFinal = executeOrderFinal;
}
