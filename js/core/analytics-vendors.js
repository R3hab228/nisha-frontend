// @ts-check
// ==========================================
// NISHA CORE — DEFERRED THIRD-PARTY ANALYTICS VENDORS
// Асинхронная неблокирующая загрузка Plausible, PostHog, Microsoft Clarity и TikTok Pixel.
// ==========================================

let _clarityLoaded = false;
let _tiktokLoaded = false;

/**
 * Загружает внешние теги Plausible и PostHog в idle-окне.
 * @param {{
 *   cfg: { scriptSrc: string, posthogKey: string, posthogHost: string },
 *   writeCachedFlags: (flagsObj: any, payloadsObj: any) => void,
 *   notifyFlagListeners: (flagsMap: any) => void
 * }} opts
 */
export function loadCoreAnalyticsScripts({ cfg, writeCachedFlags, notifyFlagListeners }) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    try {
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
            s.onerror = () => {};
            if (document.head) document.head.appendChild(s);
        }

        // Опциональная инициализация PostHog, если задан ключ в window.ENV.POSTHOG_KEY
        if (cfg.posthogKey && typeof window.posthog === 'undefined') {
            (function (/** @type {any} */ t, /** @type {any} */ e) {
                /** @type {any} */ var o, /** @type {any} */ n, /** @type {any} */ p, /** @type {any} */ r;
                e.__SV || (window.posthog = e, e._i = [], e.init = function (/** @type {any} */ i, /** @type {any} */ s, /** @type {any} */ a) {
                    function g(/** @type {any} */ t, /** @type {any} */ e) {
                        var o = e.split('.');
                        2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () {
                            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
                        };
                    }
                    (p = t.createElement('script')).type = 'text/javascript', p.crossOrigin = 'anonymous', p.async = !0, p.src = s.api_host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js', (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r);
                    /** @type {any} */ var u = e;
                    for (void 0 !== a ? u = e[a] = [] : a = 'posthog', u.people = u.people || [], u.toString = function (/** @type {any} */ t) {
                        var e = 'posthog';
                        return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e;
                    }, u.people.toString = function () { return u.toString(1) + '.people (stub)'; }, o = 'init identify capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId'.split(' '), n = 0; n < o.length; n++) g(u, o[n]);
                    e._i.push([i, s, a]);
                }, e.__SV = 1);
            })(document, /** @type {any} */ (window.posthog || []));

            window.posthog.init(cfg.posthogKey, {
                api_host: cfg.posthogHost,
                persistence: 'localStorage', // Без cookies, но со стабильным distinct_id для A/B-тестов
                person_profiles: 'identified_only',
                capture_pageview: true,
                capture_pageleave: true,
                loaded: (/** @type {any} */ ph) => {
                    if (ph && typeof ph.onFeatureFlags === 'function') {
                        ph.onFeatureFlags((/** @type {any} */ flagKeys, /** @type {any} */ flagVariants) => {
                            const variants = (flagVariants && typeof flagVariants === 'object') ? flagVariants : {};
                            /** @type {Record<string, any>} */
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
}

/**
 * Отложенная загрузка сторонних тегов (Microsoft Clarity + TikTok Pixel) вне index.html (для строгого CSP без unsafe-inline).
 */
export function initDeferredVendorPixels() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

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
        ttq.setAndDefer = function (/** @type {any} */ t, /** @type {any} */ e) {
            t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
        };
        for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function (/** @type {any} */ t) {
            const e = ttq._i[t] || [];
            for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
            return e;
        };
        ttq.load = function (/** @type {any} */ e, /** @type {any} */ n) {
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

if (typeof window !== 'undefined') {
    /** @type {any} */ (window).__nishaAnalyticsVendors = {
        loadCoreAnalyticsScripts,
        initDeferredVendorPixels
    };
}
