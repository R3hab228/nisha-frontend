// ==========================================
// NISHA PRIVACY-FIRST ANALYTICS SERVICE (Plausible + PostHog + TikTok Pixel Facade)
// ==========================================
// Единый неблокирующий сервис продуктовой аналитики и воронки продаж:
// - Работает без сторонних cookies (GDPR-friendly, не требует cookie-баннеров)
// - Использует актуальный асинхронный скрипт Plausible (pa-IsJtnQu_ZBbpTLtjSuhRq.js)
// - Поддерживает Plausible Analytics, PostHog и синхронную передачу e-commerce событий в TikTok Pixel (ttq)
// - Загружается без блокировки рендера (async / requestIdleCallback, 0 мс влияния на LCP / TBT)

(function initAnalyticsModule() {
    const DEFAULT_DOMAIN = 'nisha-store.shop';
    const DEFAULT_PLAUSIBLE_SCRIPT_SRC = 'https://plausible.io/js/pa-IsJtnQu_ZBbpTLtjSuhRq.js';
    let _initialized = false;
    let _clarityLoaded = false;
    let _tiktokLoaded = false;
    let _lastIdentifiedUserId = '';
    let _dropLockTimerId = null;
    let _flagLangListenerBound = false;
    const FLAG_CACHE_KEY = 'nisha_ph_flags_cache';
    const _flagListeners = new Set();

    function getCurrentFlagLang() {
        const raw = (typeof window !== 'undefined' && window.i18next && window.i18next.language)
            ? String(window.i18next.language).toLowerCase().slice(0, 2)
            : 'ua';
        if (raw === 'ru') return 'ru';
        if (raw === 'en') return 'en';
        return 'ua';
    }

    function pickLocalizedText(payload, baseKey, fallbacks) {
        const lang = getCurrentFlagLang();
        if (payload && typeof payload === 'object') {
            const direct = payload[`${baseKey}_${lang}`] || payload[lang] || payload[baseKey] || payload[`${baseKey}_ua`] || payload[`${baseKey}_ru`] || payload[`${baseKey}_en`];
            if (typeof direct === 'string' && direct.trim()) return direct.trim();
        }
        return (fallbacks && (fallbacks[lang] || fallbacks.ua)) || '';
    }

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

    function removeDropCountdownOverlay() {
        if (_dropLockTimerId) {
            clearInterval(_dropLockTimerId);
            _dropLockTimerId = null;
        }
        if (typeof document !== 'undefined') {
            const existing = document.getElementById('nishaDropCountdownOverlay');
            if (existing) existing.remove();
            if (document.body && document.body.dataset && document.body.dataset.dropLockScroll === '1') {
                delete document.body.dataset.dropLockScroll;
                document.body.style.overflow = '';
            }
        }
    }

    function applyDropCountdownLock() {
        if (typeof document === 'undefined' || !document.body) return;
        const enabled = isFeatureEnabled('drop_countdown_lock', false);
        if (!enabled) {
            removeDropCountdownOverlay();
            return;
        }

        const payload = getFeatureFlagPayload('drop_countdown_lock', null);
        const unlockRaw = payload && typeof payload === 'object' ? (payload.unlock_at || payload.unlockAt || '') : '';
        const unlockMs = unlockRaw ? Date.parse(String(unlockRaw)) : NaN;
        if (Number.isFinite(unlockMs) && unlockMs <= Date.now()) {
            removeDropCountdownOverlay();
            return;
        }

        const lang = getCurrentFlagLang();
        const title = pickLocalizedText(payload, 'title', {
            ua: 'ГОТУЄМО НОВИЙ ДРОП',
            ru: 'ГОТОВИМ НОВЫЙ ДРОП',
            en: 'PREPARING NEW DROP'
        });
        const subtitle = pickLocalizedText(payload, 'subtitle', {
            ua: 'Магазин відкриється автоматично за таймером. Слідкуй за анонсами в Telegram.',
            ru: 'Магазин откроется автоматически по таймеру. Следи за анонсами в Telegram.',
            en: 'Store unlocks automatically when the countdown ends.'
        });
        const labels = lang === 'en'
            ? ['DAYS', 'HRS', 'MIN', 'SEC']
            : (lang === 'ru' ? ['ДНИ', 'ЧАС', 'МИН', 'СЕК'] : ['ДНІ', 'ГОД', 'ХВ', 'СЕК']);
        const rawTgUrl = (payload && typeof payload === 'object' && typeof payload.tg_url === 'string') ? payload.tg_url.trim() : '';
        const safeTgUrl = /^https:\/\/t\.me\/[a-zA-Z0-9_/-]+$/i.test(rawTgUrl) ? rawTgUrl : '';

        let overlay = document.getElementById('nishaDropCountdownOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'nishaDropCountdownOverlay';
            overlay.className = 'nisha-drop-lock-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            document.body.appendChild(overlay);
        }

        const win = document.createElement('div');
        win.className = 'nisha-drop-lock-window';

        const hdr = document.createElement('div');
        hdr.className = 'modal-header';
        const hdrTitle = document.createElement('span');
        hdrTitle.className = 'modal-title';
        hdrTitle.textContent = 'DROP_LOCK.EXE';
        hdr.appendChild(hdrTitle);

        const body = document.createElement('div');
        body.className = 'nisha-drop-lock-body';

        const h2 = document.createElement('h2');
        h2.className = 'nisha-drop-lock-title';
        h2.textContent = title;
        body.appendChild(h2);

        const p = document.createElement('p');
        p.className = 'nisha-drop-lock-sub';
        p.textContent = subtitle;
        body.appendChild(p);

        let numEls = [];
        if (Number.isFinite(unlockMs)) {
            const timerGrid = document.createElement('div');
            timerGrid.className = 'nisha-drop-lock-timer';
            labels.forEach((lbl) => {
                const cell = document.createElement('div');
                cell.className = 'nisha-drop-lock-cell';
                const num = document.createElement('span');
                num.className = 'nisha-drop-lock-num';
                num.textContent = '00';
                const cap = document.createElement('span');
                cap.className = 'nisha-drop-lock-lbl';
                cap.textContent = lbl;
                cell.appendChild(num);
                cell.appendChild(cap);
                timerGrid.appendChild(cell);
                numEls.push(num);
            });
            body.appendChild(timerGrid);
        }

        if (safeTgUrl) {
            const link = document.createElement('a');
            link.className = 'nisha-drop-lock-link';
            link.href = safeTgUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = '[ TELEGRAM ]';
            body.appendChild(link);
        }

        win.appendChild(hdr);
        win.appendChild(body);
        if (typeof overlay.replaceChildren === 'function') overlay.replaceChildren(win);
        else { overlay.innerHTML = ''; overlay.appendChild(win); }

        if (document.body.style) {
            document.body.dataset.dropLockScroll = '1';
            document.body.style.overflow = 'hidden';
        }

        if (_dropLockTimerId) {
            clearInterval(_dropLockTimerId);
            _dropLockTimerId = null;
        }
        if (Number.isFinite(unlockMs) && numEls.length === 4) {
            const tick = () => {
                const diff = unlockMs - Date.now();
                if (diff <= 0) {
                    removeDropCountdownOverlay();
                    return;
                }
                const totalSec = Math.floor(diff / 1000);
                const d = Math.floor(totalSec / 86400);
                const h = Math.floor((totalSec % 86400) / 3600);
                const m = Math.floor((totalSec % 3600) / 60);
                const s = totalSec % 60;
                numEls[0].textContent = String(d).padStart(2, '0');
                numEls[1].textContent = String(h).padStart(2, '0');
                numEls[2].textContent = String(m).padStart(2, '0');
                numEls[3].textContent = String(s).padStart(2, '0');
            };
            tick();
            _dropLockTimerId = setInterval(tick, 1000);
        }
    }

    function applyCheckoutFeatureFlags() {
        if (typeof document === 'undefined') return;
        // 3. Рубильник наложенного платежа (default: enabled)
        const codEnabled = isFeatureEnabled('enable_cod_payment', true);
        const codOptions = document.querySelectorAll('#paymentDropdown .payment-dropdown-option[data-i18n="checkout.payment_cod"], #paymentDropdown [data-payment-method*="200"]');
        codOptions.forEach(opt => {
            if (opt && opt.style) opt.style.display = codEnabled ? '' : 'none';
        });
        if (!codEnabled) {
            const pmInput = document.getElementById('orderPaymentMethod');
            const pmText = document.getElementById('paymentSelectedText');
            const curVal = pmInput ? String(pmInput.value || '').toLowerCase() : '';
            if (curVal.includes('200') || curVal.includes('налож') || curVal.includes('наклад') || curVal.includes('cod')) {
                if (pmInput) pmInput.value = 'Полная предоплата';
                if (pmText) {
                    pmText.setAttribute('data-i18n', 'checkout.payment_full');
                    pmText.textContent = (typeof window !== 'undefined' && window.i18next && typeof window.i18next.t === 'function')
                        ? window.i18next.t('checkout.payment_full', { defaultValue: 'Полная предоплата' })
                        : 'Полная предоплата';
                }
            }
        }

        // 4. Рубильник поля промокодов в чекауте (default: enabled)
        const promoCodesEnabled = isFeatureEnabled('enable_promo_codes', true);
        const promoLabel = document.querySelector('#checkoutModal label[data-i18n="checkout.promo"]');
        const promoWrap = document.querySelector('#checkoutModal .promo-wrapper');
        const promoMsg = document.getElementById('promoMessage');
        if (promoLabel && promoLabel.style) promoLabel.style.display = promoCodesEnabled ? '' : 'none';
        if (promoWrap && promoWrap.style) promoWrap.style.display = promoCodesEnabled ? '' : 'none';
        if (promoMsg && promoMsg.style) promoMsg.style.display = promoCodesEnabled ? '' : 'none';
    }

    /**
     * Обновляет Win95-полоску прогресса бесплатной доставки в корзине и чекауте по флагу free_shipping_promo.
     * @param {number} [cartTotalUah]
     */
    function syncFreeShippingUI(cartTotalUah) {
        if (typeof document === 'undefined') return;
        const enabled = isFeatureEnabled('free_shipping_promo', false);
        const removeBars = () => {
            ['cartFreeShippingBar', 'checkoutFreeShippingBar'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.remove();
            });
        };

        if (!enabled) {
            removeBars();
            return;
        }

        const payload = getFeatureFlagPayload('free_shipping_promo', null);
        const rawMin = payload && typeof payload === 'object' ? Number(payload.min_uah ?? payload.min ?? 3000) : 3000;
        const minUah = (Number.isFinite(rawMin) && rawMin > 0) ? Math.round(rawMin) : 3000;

        let total = Number(cartTotalUah);
        if (!Number.isFinite(total)) {
            const activeCart = (typeof window !== 'undefined' && typeof window.getActiveCart === 'function')
                ? window.getActiveCart()
                : ((typeof window !== 'undefined' && Array.isArray(window.cart)) ? window.cart : []);
            total = Array.isArray(activeCart)
                ? activeCart.reduce((sum, item) => sum + (Number(item && item.price) || 0), 0)
                : 0;
        }

        if (total <= 0) {
            removeBars();
            return;
        }

        const remaining = Math.max(0, Math.round(minUah - total));
        const pct = Math.min(100, Math.max(0, Math.round((total / minUah) * 100)));
        const lang = getCurrentFlagLang();
        const curr = lang === 'en' ? 'UAH' : 'грн';
        const isUnlocked = remaining <= 0;
        const labelText = isUnlocked
            ? (lang === 'en' ? '✓ FREE SHIPPING UNLOCKED!' : (lang === 'ru' ? '✓ БЕСПЛАТНАЯ ДОСТАВКА АКТИВИРОВАНА!' : '✓ БЕЗКОШТОВНА ДОСТАВКА АКТИВОВАНА!'))
            : (lang === 'en'
                ? `ADD ${remaining} ${curr} FOR FREE SHIPPING`
                : (lang === 'ru'
                    ? `ДО БЕСПЛАТНОЙ ДОСТАВКИ: +${remaining} ${curr}`
                    : `ДО БЕЗКОШТОВНОЇ ДОСТАВКИ: +${remaining} ${curr}`));

        const renderBar = (barId, parentEl, anchorEl, extraClass = '') => {
            if (!parentEl) return;
            let bar = document.getElementById(barId);
            if (!bar) {
                bar = document.createElement('div');
                bar.id = barId;
                bar.className = `nisha-free-ship-bar${extraClass ? ' ' + extraClass : ''}`;
                const txt = document.createElement('div');
                txt.className = 'nisha-free-ship-text';
                const track = document.createElement('div');
                track.className = 'nisha-free-ship-track';
                const fill = document.createElement('div');
                fill.className = 'nisha-free-ship-fill';
                track.appendChild(fill);
                bar.appendChild(txt);
                bar.appendChild(track);
                if (anchorEl && anchorEl.parentNode === parentEl) {
                    parentEl.insertBefore(bar, anchorEl);
                } else {
                    parentEl.appendChild(bar);
                }
            }
            bar.classList.toggle('is-unlocked', isUnlocked);
            const txtEl = bar.querySelector('.nisha-free-ship-text');
            if (txtEl) txtEl.textContent = labelText;
            const fillEl = bar.querySelector('.nisha-free-ship-fill');
            if (fillEl) fillEl.style.width = `${pct}%`;
        };

        const cartDropdown = document.getElementById('cartDropdown');
        const cartList = document.getElementById('cartDropdownList');
        if (cartDropdown && cartList) {
            renderBar('cartFreeShippingBar', cartDropdown, cartList);
        }
        const deliveryInfo = document.getElementById('deliveryCostInfo');
        if (deliveryInfo && deliveryInfo.parentNode) {
            renderBar('checkoutFreeShippingBar', deliveryInfo.parentNode, deliveryInfo, 'nisha-free-ship-bar--checkout');
        }
    }

    function applyBuiltinFeatureFlags() {
        if (typeof document === 'undefined') return;
        try {
            // 1. Рубильник предложки DROP_ITEM.EXE (default: enabled)
            const dropEnabled = isFeatureEnabled('enable_drop_propose', true);
            document.querySelectorAll('[data-action="open-propose-modal"]').forEach(el => {
                if (el && el.style) el.style.display = dropEnabled ? '' : 'none';
            });

            // 2. Режим ожидания дропа с обратным отсчётом (default: disabled)
            applyDropCountdownLock();

            // 3 & 4. Рубильники наложенного платежа и промокодов в чекауте
            applyCheckoutFeatureFlags();

            // 5. Прогресс-бар бесплатной доставки в корзине и чекауте
            syncFreeShippingUI();

            // 6. Динамический промо-баннер из PostHog JSON payload (default: disabled)
            const promoEnabled = isFeatureEnabled('promo_banner', false);
            const existingBanner = document.getElementById('nishaFeaturePromoBanner');
            if (!promoEnabled) {
                if (existingBanner) existingBanner.remove();
                return;
            }

            const payload = getFeatureFlagPayload('promo_banner', null);
            const text = (payload && typeof payload === 'object')
                ? pickLocalizedText(payload, 'text', {})
                : (typeof payload === 'string' ? payload.trim() : '');
            if (!text) {
                if (existingBanner) existingBanner.remove();
                return;
            }

            let banner = existingBanner;
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'nishaFeaturePromoBanner';
                banner.className = 'nisha-ff-promo-banner';
                banner.setAttribute('role', 'status');
                const host = document.querySelector('header') || document.body;
                if (host && host.parentNode && host.tagName === 'HEADER') {
                    host.parentNode.insertBefore(banner, host.nextSibling);
                } else if (document.body) {
                    document.body.prepend(banner);
                }
            }
            banner.textContent = text;
        } catch {}
    }

    function notifyFlagListeners(flagsMap) {
        applyBuiltinFeatureFlags();
        _flagListeners.forEach(cb => {
            try { cb(flagsMap); } catch {}
        });
    }

    // 1. Создаём неблокирующую очередь команд Plausible и init-конфиг до загрузки внешнего скрипта
    if (typeof window !== 'undefined') {
        window.plausible = window.plausible || function () {
            (window.plausible.q = window.plausible.q || []).push(arguments);
        };
        window.plausible.init = window.plausible.init || function (i) {
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
            try {
                // В локальной разработке или тестах не инжектируем внешние теги, оставляя очередь window.plausible.q
                if (isLocalhost() && !(window.ENV && window.ENV.FORCE_ANALYTICS)) return;

                if (typeof window.plausible === 'function' && typeof window.plausible.init === 'function' && !window.plausible.o) {
                    window.plausible.init();
                }

                const hasPlausibleScript = Boolean(
                    document.querySelector('script[data-nisha-analytics="plausible"], script[src*="plausible.io/js/pa-"]')
                );
                if (!hasPlausibleScript) {
                    const s = document.createElement('script');
                    s.async = true;
                    s.src = cfg.scriptSrc;
                    s.setAttribute('data-nisha-analytics', 'plausible');
                    s.onerror = () => {}; // Тихий фоллбэк при блокировке или оффлайне
                    if (document.head) document.head.appendChild(s);
                }

                // Опциональная инициализация PostHog, если задан ключ в window.ENV.POSTHOG_KEY
                if (cfg.posthogKey && typeof window.posthog === 'undefined') {
                    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init identify capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
                    window.posthog.init(cfg.posthogKey, {
                        api_host: cfg.posthogHost,
                        persistence: 'localStorage', // Без cookies, но со стабильным distinct_id для A/B-тестов
                        person_profiles: 'identified_only',
                        capture_pageview: true,
                        capture_pageleave: true,
                        loaded: (ph) => {
                            if (ph && typeof ph.onFeatureFlags === 'function') {
                                ph.onFeatureFlags((flagKeys, flagVariants) => {
                                    const variants = (flagVariants && typeof flagVariants === 'object') ? flagVariants : {};
                                    const payloads = {};
                                    const keys = Array.isArray(flagKeys) ? flagKeys : Object.keys(variants);
                                    keys.forEach((k) => {
                                        if (typeof ph.getFeatureFlagPayload === 'function') {
                                            const p = ph.getFeatureFlagPayload(k);
                                            if (p !== undefined) payloads[k] = p;
                                        }
                                    });
                                    writeCachedFlags(variants, payloads);
                                    notifyFlagListeners(variants);
                                });
                            }
                        }
                    });
                }
            } catch {}
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
        } catch {}
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
        } catch {}

        try {
            if (typeof window !== 'undefined' && window.ttq && typeof window.ttq.track === 'function') {
                window.ttq.track('CompletePayment', {
                    contents: safeItems.map(i => ({ content_id: i.id, content_name: i.name })),
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
        globalThis.analytics = analyticsApi;
        globalThis.trackEvent = track;
    }

    // Отложенная загрузка сторонних тегов (Microsoft Clarity + TikTok Pixel) вне index.html (для строгого CSP без unsafe-inline)
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && !isLocalhost()) {
        const initClarityDeferred = () => {
            if (_clarityLoaded) return;
            _clarityLoaded = true;
            try {
                window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
                const t = document.createElement('script');
                t.async = true;
                t.src = 'https://www.clarity.ms/tag/ymals8sg94';
                const y = document.getElementsByTagName('script')[0];
                if (y && y.parentNode) y.parentNode.insertBefore(t, y);
            } catch {}
        };

        if (typeof window.requestIdleCallback === 'function') {
            setTimeout(() => window.requestIdleCallback(initClarityDeferred, { timeout: 2500 }), 4500);
        } else {
            setTimeout(initClarityDeferred, 4500);
        }

        try {
            window.TiktokAnalyticsObject = 'ttq';
            const ttq = window.ttq = window.ttq || [];
            ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
            ttq.setAndDefer = function (t, e) {
                t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
            };
            for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
            ttq.instance = function (t) {
                const e = ttq._i[t] || [];
                for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
                return e;
            };
            ttq.load = function (e, n) {
                const r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
                ttq._i = ttq._i || {};
                ttq._i[e] = [];
                ttq._i[e]._u = r;
                ttq._t = ttq._t || {};
                ttq._t[e] = Date.now();
                ttq._o = ttq._o || {};
                ttq._o[e] = n || {};
                const s = document.createElement('script');
                s.type = 'text/javascript';
                s.async = true;
                s.src = `${r}?sdkid=${e}&lib=ttq`;
                const first = document.getElementsByTagName('script')[0];
                if (first && first.parentNode) first.parentNode.insertBefore(s, first);
            };
            ttq.page();

            const initTikTokDeferred = () => {
                if (_tiktokLoaded) return;
                _tiktokLoaded = true;
                ttq.load('DB0HAT3C77U5HCCK4S10');
            };
            if (typeof window.requestIdleCallback === 'function') {
                setTimeout(() => window.requestIdleCallback(initTikTokDeferred, { timeout: 2000 }), 2500);
            } else {
                setTimeout(initTikTokDeferred, 2500);
            }
            const firstInteractCtrl = new AbortController();
            const onFirstInteraction = () => {
                firstInteractCtrl.abort();
                initTikTokDeferred();
            };
            document.addEventListener('click', onFirstInteraction, { passive: true, signal: firstInteractCtrl.signal });
            document.addEventListener('touchstart', onFirstInteraction, { passive: true, signal: firstInteractCtrl.signal });
            window.addEventListener('scroll', onFirstInteraction, { passive: true, signal: firstInteractCtrl.signal });
        } catch {}
    }
})();
