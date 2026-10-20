// ==========================================
// NISHA LAZY MODULE LOADER (Code Splitting Bridge)
// ==========================================

function registerLazyModuleBridge(loaderFn, methodNames) {
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

    methodNames.forEach(fnName => {
        if (typeof window[fnName] === 'function') return;
        const proxyStub = async function (...args) {
            await ensureLoaded();
            if (typeof window[fnName] === 'function' && window[fnName] !== proxyStub) {
                return window[fnName].apply(this, args);
            }
        };
        window[fnName] = proxyStub;
        if (typeof globalThis !== 'undefined') globalThis[fnName] = proxyStub;
    });

    return ensureLoaded;
}

const loadDropModule = registerLazyModuleBridge(
    () => import('../drop/drop.js'),
    [
        'openProposeModal',
        'compressImage',
        'resetProposalForm',
        'handleNewProposalFiles',
        'renderProposalPreviews',
        'submitProposal'
    ]
);

const loadReviewsModule = registerLazyModuleBridge(
    () => import('../reviews/reviews.js'),
    [
        'openReviewsModal',
        'openReviewImage',
        'scrollReviews',
        'equalizeReviewCardHeights',
        'promptOrderReview',
        'submitAutoReview',
        'skipAutoReview',
        'writeReviewOnSite',
        'submitManualReview',
        'initReviewsRealtime'
    ]
);

const loadChatModule = registerLazyModuleBridge(
    () => import('../chat/chat.js'),
    [
        'openSupportModalWindow',
        'submitSupportTicket',
        'initSupportRepliesSystem',
        'checkUnreadSupportReplies'
    ]
);

const loadOrdersModule = registerLazyModuleBridge(
    () => import('../orders/orders.js'),
    [
        'openOrdersModal',
        'fetchMyOrders',
        'switchOrderTab',
        'copyTTN'
    ]
);

// Фоновая предзагрузка вторичных чанков в простой браузера (не блокирует First Contentful Paint)
const preloadSecondaryModules = () => {
    loadDropModule();
    loadReviewsModule();
    loadChatModule();
    loadOrdersModule();
};

if ('requestIdleCallback' in window) {
    requestIdleCallback(preloadSecondaryModules, { timeout: 2000 });
} else {
    setTimeout(preloadSecondaryModules, 800);
}
