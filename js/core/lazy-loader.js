// ==========================================
// NISHA LAZY MODULE LOADER (Code Splitting Bridge)
// Registers lazy chunk loaders directly into ActionRegistry (+ compat global bridge)
// ==========================================

import { invokeAction, registerAction } from './action-registry.js';

function registerLazyModuleBridge(loaderFn, methodEntries) {
    let modulePromise = null;
    const ensureLoaded = () => {
        if (!modulePromise) {
            modulePromise = loaderFn().catch(err => {
                modulePromise = null;
                console.error('[LazyModule] Load error:', err);
            });
        }
        return modulePromise;
    };

    methodEntries.forEach(entry => {
        const [fnName, ...actionAliases] = Array.isArray(entry) ? entry : [entry];
        const proxyStub = async function (...args) {
            const loadedMod = await ensureLoaded();
            if (loadedMod && typeof loadedMod[fnName] === 'function') {
                return Reflect.apply(loadedMod[fnName], this, args);
            }
            const resolved = typeof window !== 'undefined' ? window[fnName] : globalThis[fnName];
            if (typeof resolved === 'function' && resolved !== proxyStub) {
                return Reflect.apply(resolved, this, args);
            }
            return invokeAction(fnName, ...args);
        };
        proxyStub._isNishaLazyStub = true;

        registerAction(fnName, proxyStub, { compatName: fnName, isLazyStub: true });
        actionAliases.forEach(alias => {
            registerAction(alias, proxyStub, { compatName: fnName, isLazyStub: true });
        });

        if (typeof window !== 'undefined' && typeof window[fnName] !== 'function') {
            window[fnName] = proxyStub;
        }
        if (typeof globalThis !== 'undefined' && typeof globalThis[fnName] !== 'function') {
            globalThis[fnName] = proxyStub;
        }
    });

    return ensureLoaded;
}

const loadDropModule = registerLazyModuleBridge(
    () => Promise.all([
        import('../drop/drop.js'),
        typeof document !== 'undefined' ? import('../../css/lazy-drop-modal.css').catch(() => {}) : Promise.resolve()
    ]).then(([mod]) => mod),
    [
        ['openProposeModal', 'open-propose-modal'],
        'compressImage',
        'resetProposalForm',
        'handleNewProposalFiles',
        'renderProposalPreviews',
        ['submitProposal', 'submit-proposal'],
        ['openPropBargainInput', 'toggle-prop-bargain'],
        ['confirmPropBargainInput', 'confirm-prop-bargain'],
        ['hidePropBargainInput', 'cancel-prop-bargain'],
        'resetPropBargainState',
        'updateCharCount'
    ]
);

const loadReviewsModule = registerLazyModuleBridge(
    () => Promise.all([
        import('../reviews/reviews.js'),
        typeof document !== 'undefined' ? import('../../css/lazy-reviews-modal.css').catch(() => {}) : Promise.resolve()
    ]).then(([mod]) => mod),
    [
        ['openReviewsModal', 'open-reviews'],
        ['openReviewImage', 'open-review-image'],
        ['scrollReviews', 'scroll-reviews'],
        'equalizeReviewCardHeights',
        ['promptOrderReview', 'prompt-order-review'],
        ['submitAutoReview', 'submit-auto-review'],
        ['skipAutoReview', 'skip-auto-review'],
        'writeReviewOnSite',
        ['submitManualReview', 'submit-manual-review'],
        'initReviewsRealtime'
    ]
);

const loadChatModule = registerLazyModuleBridge(
    () => import('../chat/chat.js'),
    [
        ['openSupportModalWindow', 'open-support-modal'],
        ['submitSupportTicket', 'submit-support-ticket'],
        'initSupportRepliesSystem',
        'checkUnreadSupportReplies'
    ]
);

const loadOrdersModule = registerLazyModuleBridge(
    () => Promise.all([
        import('../orders/orders.js'),
        typeof document !== 'undefined' ? import('../../css/lazy-orders-modal.css').catch(() => {}) : Promise.resolve()
    ]).then(([mod]) => mod),
    [
        ['openOrdersModal', 'open-orders'],
        ['fetchMyOrders', 'fetch-my-orders'],
        ['switchOrderTab', 'switch-order-tab'],
        ['copyTTN', 'copy-ttn'],
        ['refreshOrderTracking', 'refresh-ttn-track']
    ]
);

const loadProductCheckoutCss = () => (
    typeof document !== 'undefined'
        ? import('../../css/lazy-product-checkout-modal.css').catch(() => {})
        : Promise.resolve()
);

const loadProductModule = registerLazyModuleBridge(
    () => Promise.all([
        import('../product/product.js'),
        loadProductCheckoutCss()
    ]).then(([mod]) => mod),
    [
        ['openProductModal', 'open-product'],
        'openProductModalById',
        'prewarmProductModal',
        'cancelPrewarmProductModal',
        'prewarmProductDetails',
        'renderHistory',
        ['toggleHistory', 'toggle-history'],
        ['removeHistoryItem', 'remove-history-item'],
        ['clearHistory', 'clear-history'],
        ['changeSlide', 'change-slide'],
        ['setSlide', 'set-slide'],
        'preloadSlide',
        ['toggleFavFromModal', 'toggle-fav-from-modal'],
        ['shareItem', 'share-item'],
        ['toggleQuestionForm', 'toggle-question-form'],
        ['submitQuestion', 'submit-question'],
        'loadItemQuestions',
        ['toggleAccordion', 'toggle-accordion'],
        ['showInlineOfferPriceInput', 'offer-price'],
        ['hideInlineOfferPriceInput', 'cancel-offer-price'],
        ['submitInlineBargainOffer', 'submit-inline-bargain'],
        ['submitBargainOffer', 'submit-bargain-offer'],
        'openOfferPriceModal',
        'openBargainModal',
        'syncUserBargains',
        'renderSimilarItems',
        'preloadSimilarItemsImages'
    ]
);

const loadCheckoutModule = registerLazyModuleBridge(
    () => Promise.all([
        import('../cart/checkout-bundle.js'),
        loadProductCheckoutCss()
    ]).then(([mod]) => mod),
    [
        ['openCheckoutModal', 'open-checkout'],
        ['submitOrder', 'submit-order'],
        ['applyPromoCode', 'apply-promo-code'],
        ['togglePaymentDropdown', 'toggle-payment-dropdown'],
        ['selectPaymentMethod', 'select-payment-method'],
        'searchCities',
        'debouncedNPCitySearch',
        'selectCity',
        'searchBranches',
        'loadNPBranches',
        'filterNPBranches',
        'selectBranch',
        'detectUserCityAuto',
        'updateCheckoutTotal',
        'npStorageGet',
        'npStorageSet',
        'npStorageRemove'
    ]
);

const loadProfileModalModule = registerLazyModuleBridge(
    () => import('../profile/profile-modal-bundle.js'),
    [
        'renderProfilePhone',
        'renderProfileTg',
        ['removeProfilePhone', 'remove-profile-phone'],
        ['removeProfileTg', 'remove-profile-tg'],
        ['showPhoneInput', 'show-phone-input'],
        ['showTgInput', 'show-tg-input'],
        ['hidePhoneInput', 'hide-phone-input'],
        ['hideTgInput', 'hide-tg-input'],
        ['savePhoneFromInput', 'save-phone-input'],
        ['saveTgFromInput', 'save-tg-input'],
        'checkPendingPhoneVerification',
        'checkPendingTgVerification',
        'initProfileDeliveryEvents',
        'setProfileDeliveryLockState',
        'renderProfileDelivery',
        ['toggleProfileDeliveryAccordion', 'toggle-profile-delivery'],
        ['saveProfileDeliveryFromForm', 'save-profile-delivery'],
        'saveDeliveryToProfile',
        'syncProfileCombinedAddress',
        'searchProfileNPCity',
        'loadProfileBranches'
    ]
);

function isSoundEnabledLite() {
    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('nisha_sound_enabled') !== '0';
        }
    } catch {}
    return true;
}

function syncSoundToggleUILite() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const enabled = isSoundEnabledLite();
    const i18nKey = enabled ? 'profile.sound_on' : 'profile.sound_off';
    const fallbackLabel = enabled ? 'УВІМК' : 'ВИМК';
    const labelText = (typeof window !== 'undefined' && window.i18next && typeof window.i18next.t === 'function')
        ? window.i18next.t(i18nKey, { defaultValue: fallbackLabel })
        : fallbackLabel;

    ['profileSoundToggleBtn', 'modalProfileSoundToggleBtn'].forEach((btnId) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (btn.classList) {
            btn.classList.toggle('is-on', enabled);
            btn.classList.toggle('is-off', !enabled);
        }
        if (typeof btn.setAttribute === 'function') {
            btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        }
        const stateEl = typeof btn.querySelector === 'function' ? btn.querySelector('.profile-sfx-state') : null;
        if (stateEl) {
            stateEl.textContent = labelText;
            if (typeof stateEl.setAttribute === 'function') {
                stateEl.setAttribute('data-i18n', i18nKey);
            }
        }
    });
}

// Register lightweight toggle sync as a lazy stub so i18n startup updates buttons
// without downloading app-sound; sound-effects.js replaces it once loaded.
registerAction('syncSoundToggleUI', syncSoundToggleUILite, { compatName: 'syncSoundToggleUI', isLazyStub: true });
if (typeof window !== 'undefined' && typeof window.syncSoundToggleUI !== 'function') {
    window.syncSoundToggleUI = syncSoundToggleUILite;
}

const loadSoundModule = registerLazyModuleBridge(
    () => import('./sound-effects.js'),
    [
        'playSound',
        'playNotifySound',
        ['toggleSoundEnabled', 'toggle-sound'],
        'isSoundEnabled',
        'setSoundEnabled'
    ]
);

// Warm sound-effects chunk passively on first real user gesture (when sound is ON)
// so UI click/toast sounds respond immediately without delaying initial load.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const warmSoundOnFirstGesture = () => {
        window.removeEventListener('pointerdown', warmSoundOnFirstGesture, true);
        window.removeEventListener('keydown', warmSoundOnFirstGesture, true);
        if (isSoundEnabledLite()) {
            loadSoundModule();
        }
    };
    window.addEventListener('pointerdown', warmSoundOnFirstGesture, { capture: true, passive: true, once: true });
    window.addEventListener('keydown', warmSoundOnFirstGesture, { capture: true, passive: true, once: true });
}

// Умная фоновая предзагрузка в простой браузера:
// - на Save-Data / медленном мобильном интернете (2G/3G) ничего лишнего не качаем;
// - на быстром соединении предзагружаем только карточку товара (главное действие на витрине),
//   а редкие модалки (Drop, Отзывы, Чат, Заказы, Чекаут, Профиль контакты/НП, IMask) грузятся строго по клику.
const preloadSecondaryModules = () => {
    const conn = typeof navigator !== 'undefined' ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection) : null;
    const isConstrained = Boolean(conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || conn.effectiveType === '3g'));
    if (isConstrained) return;

    loadProductModule();
};

registerAction('prewarmProductModule', () => {
    loadProductModule();
});

if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(preloadSecondaryModules, { timeout: 900 });
} else {
    setTimeout(preloadSecondaryModules, 500);
}

export {
    loadProductModule,
    loadCheckoutModule,
    loadProfileModalModule,
    loadSoundModule,
    loadDropModule,
    loadReviewsModule,
    loadChatModule,
    loadOrdersModule,
    preloadSecondaryModules
};
