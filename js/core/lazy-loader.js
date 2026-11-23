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
    () => import('../reviews/reviews.js'),
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
        ['copyTTN', 'copy-ttn']
    ]
);

const loadProductModule = registerLazyModuleBridge(
    () => import('../product/product.js'),
    [
        ['openProductModal', 'open-product'],
        'openProductModalById',
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
    () => import('../cart/checkout-bundle.js'),
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

// Умная фоновая предзагрузка в простой браузера:
// - на Save-Data / медленном мобильном интернете (2G/3G) ничего лишнего не качаем;
// - на быстром соединении предзагружаем только карточку товара (главное действие на витрине),
//   а редкие модалки (Drop, Отзывы, Чат, Заказы, Чекаут, IMask) грузятся строго по клику.
const preloadSecondaryModules = () => {
    const conn = typeof navigator !== 'undefined' ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection) : null;
    const isConstrained = Boolean(conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || conn.effectiveType === '3g'));
    if (isConstrained) return;

    loadProductModule();
};

if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(preloadSecondaryModules, { timeout: 3500 });
} else {
    setTimeout(preloadSecondaryModules, 2000);
}

export {
    loadProductModule,
    loadCheckoutModule,
    loadDropModule,
    loadReviewsModule,
    loadChatModule,
    loadOrdersModule,
    preloadSecondaryModules
};
