// @ts-check
// ==========================================
// NISHA PRIVACY-FIRST ANALYTICS SERVICE (Plausible + PostHog + TikTok Pixel Facade)
// ==========================================
// Единый неблокирующий сервис продуктовой аналитики и воронки продаж:
// - Работает без сторонних cookies (GDPR-friendly, не требует cookie-баннеров)
// - Использует актуальный асинхронный скрипт Plausible (pa-IsJtnQu_ZBbpTLtjSuhRq.js)
// - Поддерживает Plausible Analytics, PostHog и синхронную передачу e-commerce событий в TikTok Pixel (ttq)
// - Загружается без блокировки рендера (async / requestIdleCallback, 0 мс влияния на LCP / TBT)
// - UI фича-флагов вынесен в js/core/analytics-feature-ui.js, теги вендоров — в js/core/analytics-vendors.js.

(function initAnalyticsModule() {
    const DEFAULT_DOMAIN = 'nisha-store.shop';
    const DEFAULT_PLAUSIBLE_SCRIPT_SRC = 'https://plausible.io/js/pa-IsJtnQu_ZBbpTLtjSuhRq.js';
    let _initialized = false;
    let _lastIdentifiedUserId = '';
    let _flagLangListenerBound = false;
    const FLAG_CACHE_KEY = 'nisha_ph_flags_cache';
    const _flagListeners = new Set();

    function readCachedFlags() {
        try {
            const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FLAG_CACHE_KEY) : null;
            if (!raw) return { flags: {}, payloads: {} };
            const parsed = JSON.parse(raw);
            return {
                flags: (parsed && parsed.flags && typeof parsed.flags === 'object') ? parsed.flags : {},
                payloads: (parsed && parsed.payloads && typeof parsed.payloads === 'object') ? parsed.payloads : {}
            };
        } catch {
            return { flags: {}, payloads: {} };
        }
    }

    /**
     * @param {any} flagsObj
     * @param {any} payloadsObj
     */
    function writeCachedFlags(flagsObj, payloadsObj) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(FLAG_CACHE_KEY, JSON.stringify({
                    flags: flagsObj || {},
                    payloads: payloadsObj || {},
                    updatedAt: Date.now()
                }));
            }
        } catch {}
    }

    /**
     * Возвращает значение фича-флага PostHog (boolean или строку варианта) с мгновенным кэш-фоллбэком.
     * @param {string} flagKey
     * @param {*} [defaultValue=undefined]
     * @returns {*}
     */
    function getFeatureFlag(flagKey, defaultValue = undefined) {
        if (!flagKey || typeof flagKey !== 'string') return defaultValue;
        try {
            if (typeof window !== 'undefined' && window.posthog && typeof window.posthog.getFeatureFlag === 'function' && window.posthog.__loaded) {
                const live = window.posthog.getFeatureFlag(flagKey);
                if (live !== undefined) return live;
            }
        } catch {}
        const cached = readCachedFlags();
        if (Object.hasOwn(cached.flags, flagKey) && cached.flags[flagKey] !== undefined) {
            return cached.flags[flagKey];
        }
        return defaultValue;
    }

    /**
     * Проверяет, включён ли boolean фича-флаг в PostHog (с кэш-фоллбэком без мигания UI).
     * @param {string} flagKey
     * @param {boolean} [defaultValue=false]
     * @returns {boolean}
     */
    function isFeatureEnabled(flagKey, defaultValue = false) {
        const val = getFeatureFlag(flagKey, undefined);
        if (val === undefined) return Boolean(defaultValue);
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return val !== 'false' && val !== 'off' && val !== '0';
        return Boolean(val);
    }

    /**
     * Возвращает JSON payload фича-флага PostHog (например, текст/настройки промо-баннера).
     * @param {string} flagKey
     * @param {*} [defaultValue=null]
     * @returns {*}
     */
    function getFeatureFlagPayload(flagKey, defaultValue = null) {
        if (!flagKey || typeof flagKey !== 'string') return defaultValue;
        try {
            if (typeof window !== 'undefined' && window.posthog && typeof window.posthog.getFeatureFlagPayload === 'function' && window.posthog.__loaded) {
                const live = window.posthog.getFeatureFlagPayload(flagKey);
                if (live !== undefined && live !== null) return live;
            }
        } catch {}
        const cached = readCachedFlags();
        if (Object.hasOwn(cached.payloads, flagKey) && cached.payloads[flagKey] !== undefined) {
            return cached.payloads[flagKey];
        }
        return defaultValue;
    }

    // Подключаем вынесенный контроллер DOM-эффектов фича-флагов (если загружен через бандл)
    const featureUiFactory = (typeof window !== 'undefined' && typeof (/** @type {any} */ (window)).__nishaAnalyticsFeatureUiFactory === 'function')
        ? (/** @type {any} */ (window)).__nishaAnalyticsFeatureUiFactory
        : null;
    const featureUi = featureUiFactory
        ? featureUiFactory({ isFeatureEnabled, getFeatureFlagPayload })
        : { syncFreeShippingUI: () => {}, applyBuiltinFeatureFlags: () => {} };

    /** @param {number} [cartTotalUah] */
    function syncFreeShippingUI(cartTotalUah) {
        return featureUi.syncFreeShippingUI(cartTotalUah);
    }

    function applyBuiltinFeatureFlags() {
        return featureUi.applyBuiltinFeatureFlags();
    }

    /** @param {any} flagsMap */
    function notifyFlagListeners(flagsMap) {
        applyBuiltinFeatureFlags();
        _flagListeners.forEach((cb) => {
            try { cb(flagsMap); } catch {}
        });
    }

    // 1. Создаём неблокирующую очередь команд Plausible и init-конфиг до загрузки внешнего скрипта
    if (typeof window !== 'undefined') {
        window.plausible = window.plausible || function () {
            (window.plausible.q = window.plausible.q || []).push(arguments);
        };
        window.plausible.init = window.plausible.init || function (/** @type {any} */ i) {
            window.plausible.o = i || {};
        };
    }

    function getAnalyticsConfig() {
        const env = (typeof window !== 'undefined' && window.ENV) ? window.ENV : {};
        return {
            domain: env.PLAUSIBLE_DOMAIN || DEFAULT_DOMAIN,
            scriptSrc: env.PLAUSIBLE_SCRIPT_SRC || DEFAULT_PLAUSIBLE_SCRIPT_SRC,
            posthogKey: env.POSTHOG_KEY || '',
            posthogHost: env.POSTHOG_HOST || 'https://eu.i.posthog.com'
        };
    }

    function isLocalhost() {
        if (typeof window === 'undefined' || !window.location) return true;
        const h = window.location.hostname || '';
        return h === 'localhost' || h === '127.0.0.1' || h === '' || h.endsWith('.local');
    }

    /**
     * Отложенная загрузка / проверка скрипта Plausible (и опционально PostHog)
     */
    function init() {
        if (_initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
        _initialized = true;

        const cfg = getAnalyticsConfig();

        const loadScripts = () => {
            // В локальной разработке или тестах не инжектируем внешние теги, оставляя очередь window.plausible.q
            if (isLocalhost() && !(window.ENV && window.ENV.FORCE_ANALYTICS)) return;
            const vendors = /** @type {any} */ (window).__nishaAnalyticsVendors;
            if (vendors && typeof vendors.loadCoreAnalyticsScripts === 'function') {
                vendors.loadCoreAnalyticsScripts({ cfg, writeCachedFlags, notifyFlagListeners });
            }
        };

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(loadScripts, { timeout: 3000 });
        } else {
            setTimeout(loadScripts, 2000);
        }
    }

    /**
     * Универсальная отправка события в Plausible и PostHog
     * @param {string} eventName - Название события (например, 'Product Viewed', 'Add to Cart', 'Order Completed')
     * @param {object} [props={}] - Свойства события
     */
    function track(eventName, props = {}) {
        if (!eventName || typeof eventName !== 'string') return;
        const safeProps = (props && typeof props === 'object') ? props : {};

        try {
            if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
                window.plausible(eventName, { props: safeProps });
            }
        } catch {}

        try {
            if (typeof window !== 'undefined' && window.posthog && typeof window.posthog.capture === 'function') {
                window.posthog.capture(eventName, safeProps);
            }
        } catch {}
    }

    /**
     * Просмотр карточки товара (воронка: шаг 1)
     * @param {any} item
     */
    function trackProductView(item) {
        if (!item || typeof item !== 'object') return;
        const price = Number(item.price) || 0;

        track('Product Viewed', {
            item_id: String(item.id || ''),
            brand: String(item.brand || ''),
            name: String(item.name || ''),
            category: String(item.category || ''),
            size: String(item.size || ''),
            price,
            currency: 'UAH'
        });

        try {
            if (typeof window !== 'undefined' && window.ttq && typeof window.ttq.track === 'function') {
                window.ttq.track('ViewContent', {
                    content_id: item.id,
                    content_name: item.name,
                    value: price,
                    currency: 'UAH'
                });
            }
        } catch {}
    }

    /**
     * Добавление товара в корзину (воронка: шаг 2)
     * @param {any} item
     */
    function trackAddToCart(item) {
        if (!item || typeof item !== 'object') return;
        const price = Number(item.price) || 0;

        track('Add to Cart', {
            item_id: String(item.id || ''),
            brand: String(item.brand || ''),
            name: String(item.name || ''),
            price,
            currency: 'UAH'
        });

        try {
            if (typeof window !== 'undefined' && window.ttq && typeof window.ttq.track === 'function') {
                window.ttq.track('AddToCart', {
                    contents: [{ content_id: item.id, content_name: item.name }],
                    value: price,
                    currency: 'UAH'
                });
            }
        } catch {}
    }

    /**
     * Открытие окна оформления заказа (воронка: шаг 3)
     * @param {any[]} [cartItems=[]]
     */
    function trackCheckoutStart(cartItems = []) {
        const items = Array.isArray(cartItems) ? cartItems : [];
        const total = items.reduce((sum, i) => sum + (Number(i?.price) || 0), 0);

        track('Checkout Started', {
            items_count: items.length,
            cart_value: total,
            currency: 'UAH'
        });

        try {
            if (typeof window !== 'undefined' && window.ttq && typeof window.ttq.track === 'function') {
                window.ttq.track('InitiateCheckout', {
                    contents: items.map((i) => ({ content_id: i.id, content_name: i.name })),
                    value: total,
                    currency: 'UAH'
                });
            }
        } catch {}
    }

    /**
     * Успешное оформление заказа (воронка: шаг 4 / конверсия)
     * @param {{ orderId?: string, items?: any[], value?: number, paymentMethod?: string }} [opts={}]
     */
    function trackPurchase({ orderId = '', items = [], value = 0, paymentMethod = '' } = {}) {
        const safeItems = Array.isArray(items) ? items : [];
        const numericValue = Number(value) || 0;

        track('Order Completed', {
            order_id: String(orderId || ''),
            items_count: safeItems.length,
            revenue: numericValue,
            payment_method: String(paymentMethod || ''),
            currency: 'UAH'
        });

        try {
            if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
                window.plausible('Purchase', {
                    revenue: { currency: 'UAH', amount: numericValue },
                    props: { order_id: String(orderId || ''), items_count: safeItems.length }
                });
            }
        } catch {}

        try {
            if (typeof window !== 'undefined' && window.ttq && typeof window.ttq.track === 'function') {
                window.ttq.track('CompletePayment', {
                    contents: safeItems.map((i) => ({ content_id: i.id, content_name: i.name })),
                    value: numericValue,
                    currency: 'UAH'
                });
            }
        } catch {}
    }

    /**
     * Отправка заявки в предложку (Drop / Consignment)
     */
    function trackProposalSubmitted({ brand = '', price = 0, filesCount = 0 } = {}) {
        track('Proposal Submitted', {
            brand: String(brand || ''),
            asked_price: Number(price) || 0,
            files_count: Number(filesCount) || 0
        });
    }

    /**
     * Добавление/удаление из избранного
     * @param {any} itemId
     * @param {boolean} [isAdded=true]
     */
    function trackFavorite(itemId, isAdded = true) {
        track(isAdded ? 'Favorite Added' : 'Favorite Removed', {
            item_id: String(itemId || '')
        });
    }

    /**
     * Выбор города/отделения Новой Почты (воронка: шаг доставки)
     */
    function trackDeliverySelected({ city = '', branch = '', branchRef = '' } = {}) {
        track('Delivery Selected', {
            city: String(city || ''),
            branch: String(branch || ''),
            branch_ref: String(branchRef || '')
        });
    }

    /**
     * Попытка нажатия "Подтвердить заказ" (до ответа сервера / валидация)
     */
    function trackCheckoutAttempt({ stage = 'submit_click', reason = '', itemsCount = 0 } = {}) {
        track('Checkout Attempt', {
            stage: String(stage || 'submit_click'),
            reason: String(reason || ''),
            items_count: Number(itemsCount) || 0
        });
    }

    /**
     * Привязывает авторизованного пользователя в PostHog для таргетированных фича-флагов и A/B-тестов.
     * @param {string} userId
     * @param {Record<string, any>} [props={}]
     */
    function identifyUser(userId, props = {}) {
        const cleanId = String(userId || '').trim();
        if (!cleanId || _lastIdentifiedUserId === cleanId) return;
        _lastIdentifiedUserId = cleanId;
        try {
            if (typeof window !== 'undefined' && window.posthog && typeof window.posthog.identify === 'function') {
                window.posthog.identify(cleanId, (props && typeof props === 'object') ? props : {});
            }
        } catch {}
    }

    /**
     * Сбрасывает идентификацию пользователя в PostHog при выходе из аккаунта.
     */
    function resetIdentity() {
        if (!_lastIdentifiedUserId) return;
        _lastIdentifiedUserId = '';
        try {
            if (typeof window !== 'undefined' && window.posthog && typeof window.posthog.reset === 'function') {
                window.posthog.reset();
            }
        } catch {}
    }

    /**
     * Подписывается на обновление фича-флагов PostHog (сразу вызывает callback с кэшем, если он есть).
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    function onFeatureFlags(callback) {
        if (typeof callback !== 'function') return () => {};
        _flagListeners.add(callback);
        const cached = readCachedFlags();
        if (Object.keys(cached.flags).length > 0) {
            try { callback(cached.flags); } catch {}
        }
        return () => _flagListeners.delete(callback);
    }

    /**
     * Принудительно перезапрашивает актуальные фича-флаги из PostHog.
     */
    function reloadFeatureFlags() {
        try {
            if (typeof window !== 'undefined' && window.posthog && typeof window.posthog.reloadFeatureFlags === 'function') {
                window.posthog.reloadFeatureFlags();
            }
        } catch {}
    }

    const analyticsApi = {
        init,
        track,
        trackProductView,
        trackAddToCart,
        trackCheckoutStart,
        trackDeliverySelected,
        trackCheckoutAttempt,
        trackPurchase,
        trackProposalSubmitted,
        trackFavorite,
        identifyUser,
        resetIdentity,
        isFeatureEnabled,
        getFeatureFlag,
        getFeatureFlagPayload,
        onFeatureFlags,
        reloadFeatureFlags,
        syncFreeShippingUI,
        applyBuiltinFeatureFlags
    };

    const initFlagDomSync = () => {
        applyBuiltinFeatureFlags();
        if (!_flagLangListenerBound && typeof window !== 'undefined' && window.i18next && typeof window.i18next.on === 'function') {
            _flagLangListenerBound = true;
            window.i18next.on('languageChanged', () => applyBuiltinFeatureFlags());
        }
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
            document.addEventListener('DOMContentLoaded', initFlagDomSync, { once: true });
        } else {
            initFlagDomSync();
        }
    }

    if (typeof window !== 'undefined') {
        window.analytics = analyticsApi;
    }
    if (typeof globalThis !== 'undefined') {
        const g = /** @type {any} */ (globalThis);
        g.analytics = analyticsApi;
        g.trackEvent = track;
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && !isLocalhost()) {
        const vendors = /** @type {any} */ (window).__nishaAnalyticsVendors;
        if (vendors && typeof vendors.initDeferredVendorPixels === 'function') {
            vendors.initDeferredVendorPixels();
        }
    }
})();
