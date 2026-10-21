// ==========================================
// NISHA PRIVACY-FIRST ANALYTICS SERVICE (Plausible + PostHog + TikTok Pixel Facade)
// ==========================================
// Единый неблокирующий сервис продуктовой аналитики и воронки продаж:
// - Работает без сторонних cookies (GDPR-friendly, не требует cookie-баннеров)
// - Использует first-party проксирование через Vercel (/js/pa.js -> plausible.io) для обхода AdBlock / Brave
// - Поддерживает Plausible Analytics, PostHog и синхронную передачу e-commerce событий в TikTok Pixel (ttq)
// - Загружается отложенно через requestIdleCallback (0 мс влияния на LCP / TBT)

(function initAnalyticsModule() {
    const DEFAULT_DOMAIN = 'nisha-store.shop';
    let _initialized = false;

    // 1. Создаём неблокирующую очередь команд Plausible до загрузки внешнего скрипта
    if (typeof window !== 'undefined') {
        window.plausible = window.plausible || function () {
            (window.plausible.q = window.plausible.q || []).push(arguments);
        };
    }

    function getAnalyticsConfig() {
        const env = (typeof window !== 'undefined' && window.ENV) ? window.ENV : {};
        return {
            domain: env.PLAUSIBLE_DOMAIN || DEFAULT_DOMAIN,
            scriptSrc: env.PLAUSIBLE_SCRIPT_SRC || '/js/pa.js',
            apiEndpoint: env.PLAUSIBLE_API_ENDPOINT || '/api/pa-event',
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
     * Отложенная загрузка легковесного скрипта Plausible (и опционально PostHog)
     */
    function init() {
        if (_initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
        _initialized = true;

        const cfg = getAnalyticsConfig();

        const loadScripts = () => {
            try {
                // В локальной разработке или тестах не инжектируем внешние теги, оставляя очередь window.plausible.q
                if (isLocalhost() && !(window.ENV && window.ENV.FORCE_ANALYTICS)) return;

                if (!document.querySelector('script[data-nisha-analytics="plausible"]')) {
                    const s = document.createElement('script');
                    s.defer = true;
                    s.src = cfg.scriptSrc;
                    s.setAttribute('data-domain', cfg.domain);
                    s.setAttribute('data-api', cfg.apiEndpoint);
                    s.setAttribute('data-nisha-analytics', 'plausible');
                    s.onerror = () => {}; // Тихий фоллбэк при блокировке или оффлайне
                    if (document.head) document.head.appendChild(s);
                }

                // Опциональная инициализация PostHog, если задан ключ в window.ENV.POSTHOG_KEY
                if (cfg.posthogKey && typeof window.posthog === 'undefined') {
                    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
                    window.posthog.init(cfg.posthogKey, {
                        api_host: cfg.posthogHost,
                        persistence: 'memory', // Privacy-first: без cookies
                        person_profiles: 'identified_only',
                        capture_pageview: true,
                        capture_pageleave: true
                    });
                }
            } catch (e) {}
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
        } catch (e) {}

        try {
            if (typeof window !== 'undefined' && window.posthog && typeof window.posthog.capture === 'function') {
                window.posthog.capture(eventName, safeProps);
            }
        } catch (e) {}
    }

    /**
     * Просмотр карточки товара (воронка: шаг 1)
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
        } catch (e) {}
    }

    /**
     * Добавление товара в корзину (воронка: шаг 2)
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
        } catch (e) {}
    }

    /**
     * Открытие окна оформления заказа (воронка: шаг 3)
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
                    contents: items.map(i => ({ content_id: i.id, content_name: i.name })),
                    value: total,
                    currency: 'UAH'
                });
            }
        } catch (e) {}
    }

    /**
     * Успешное оформление заказа (воронка: шаг 4 / конверсия)
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
            if (typeof window !== 'undefined' && window.plausible === 'function') {
                window.plausible('Purchase', {
                    revenue: { currency: 'UAH', amount: numericValue },
                    props: { order_id: String(orderId || ''), items_count: safeItems.length }
                });
            }
        } catch (e) {}

        try {
            if (typeof window !== 'undefined' && window.ttq && typeof window.ttq.track === 'function') {
                window.ttq.track('CompletePayment', {
                    contents: safeItems.map(i => ({ content_id: i.id, content_name: i.name })),
                    value: numericValue,
                    currency: 'UAH'
                });
            }
        } catch (e) {}
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
     */
    function trackFavorite(itemId, isAdded = true) {
        track(isAdded ? 'Favorite Added' : 'Favorite Removed', {
            item_id: String(itemId || '')
        });
    }

    const analyticsApi = {
        init,
        track,
        trackProductView,
        trackAddToCart,
        trackCheckoutStart,
        trackPurchase,
        trackProposalSubmitted,
        trackFavorite
    };

    if (typeof window !== 'undefined') {
        window.analytics = analyticsApi;
        window.trackEvent = track;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.analytics = analyticsApi;
        globalThis.trackEvent = track;
    }
})();
