(function () {
    try {
        if (typeof window !== 'undefined' && !window._META) {
            window._META = typeof Proxy === 'function' ? new Proxy({}, { get: function (o, p) { return o[p]; } }) : {};
        }
    } catch (e) {}
    try {
        if (typeof window !== 'undefined' && typeof window.ethereum === 'undefined') {
            const ethTarget = {};
            window.ethereum = typeof Proxy === 'function' ? new Proxy(ethTarget, {
                get: (t, p) => t[p],
                set: (t, p, v) => { t[p] = v; return true; }
            }) : ethTarget;
        }
    } catch (e) {}
    try {
        if (typeof window !== 'undefined') {
            window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
            window.plausible.init = window.plausible.init || function (i) { window.plausible.o = i || {}; };
            if (!window.plausible.o) window.plausible.init();
        }
    } catch (e) {}
    try {
        const isStandalone = (window.matchMedia && (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: minimal-ui)').matches
        )) || (typeof navigator !== 'undefined' && navigator.standalone === true) ||
            (document.referrer && document.referrer.includes('android-app://'));
        if (isStandalone && document.documentElement) {
            document.documentElement.classList.add('pwa-standalone');
        }
    } catch (e) {}
    try {
        let l = (window.localStorage && (localStorage.getItem('nisha_lang') || localStorage.getItem('i18nextLng'))) || '';
        if (!l) {
            const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
            l = nav.startsWith('ru') ? 'ru' : (nav.startsWith('en') ? 'en' : 'ua');
        }
        l = l.toLowerCase();
        if (l.startsWith('ru')) l = 'ru';
        else if (l.startsWith('en')) l = 'en';
        else l = 'ua';
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'fetch';
        link.href = `/locales/${l}.json`;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    } catch (e) {}
    try {
        const CHUNK_RELOAD_KEY = 'nisha_chunk_reload_at';
        const CHUNK_COUNT_KEY = 'nisha_chunk_reload_count';
        const MAX_AUTO_RECOVERIES = 2;
        let recoveryInFlight = false;

        const clearHtmlCaches = function () {
            try {
                if (typeof caches === 'undefined' || !caches || typeof caches.keys !== 'function') {
                    return Promise.resolve();
                }
                return Promise.race([
                    caches.keys().then(function (keys) {
                        return Promise.all(
                            keys
                                .filter(function (k) { return k.indexOf('nisha-cache-') === 0; })
                                .map(function (k) { return caches.delete(k); })
                        );
                    }),
                    new Promise(function (resolve) { setTimeout(resolve, 400); })
                ]).catch(function () {});
            } catch (e) {
                return Promise.resolve();
            }
        };

        const flushStaleServiceWorkers = function (forceUnregister) {
            try {
                if (typeof navigator === 'undefined' || !navigator.serviceWorker || typeof navigator.serviceWorker.getRegistrations !== 'function') {
                    return Promise.resolve();
                }
                return Promise.race([
                    navigator.serviceWorker.getRegistrations().then(function (regs) {
                        return Promise.all(regs.map(function (reg) {
                            if (forceUnregister) {
                                return reg.unregister().catch(function () {});
                            }
                            if (reg.waiting) {
                                try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
                                return Promise.resolve();
                            }
                            return typeof reg.update === 'function' ? reg.update().catch(function () {}) : Promise.resolve();
                        }));
                    }),
                    new Promise(function (resolve) { setTimeout(resolve, 500); })
                ]).catch(function () {});
            } catch (e) {
                return Promise.resolve();
            }
        };

        const navigateFreshUrl = function () {
            try {
                const freshUrl = new URL(window.location.href);
                freshUrl.searchParams.set('_sw_upd', String(Date.now()));
                if (typeof window.location.replace === 'function') {
                    window.location.replace(freshUrl.toString());
                    return;
                }
            } catch (e) {}
            window.location.reload();
        };

        const showManualRecoveryBanner = function () {
            try {
                if (window.__nishaAppBooted || !document.body || document.getElementById('nishaBootRecoveryBanner')) return;
                let lang = 'ua';
                try {
                    const raw = (localStorage.getItem('nisha_lang') || localStorage.getItem('i18nextLng') || 'ua').toLowerCase();
                    lang = raw.startsWith('ru') ? 'ru' : (raw.startsWith('en') ? 'en' : 'ua');
                } catch (e) {}
                const copy = {
                    ua: { title: '[ ОНОВЛЕННЯ САЙТУ ]', text: 'Щось пішло не так під час завантаження оновлення. Натисніть кнопку нижче, щоб перезавантажити сторінку.', btn: '[ ОНОВИТИ СТОРІНКУ ]' },
                    ru: { title: '[ ОБНОВЛЕНИЕ САЙТА ]', text: 'Произошел сбой при загрузке обновления. Нажмите кнопку ниже, чтобы перезагрузить страницу.', btn: '[ ОБНОВИТЬ СТРАНИЦУ ]' },
                    en: { title: '[ SITE UPDATE ]', text: 'Loading was interrupted during a deployment. Tap below to reload the latest version.', btn: '[ RELOAD PAGE ]' }
                }[lang];

                const wrap = document.createElement('div');
                wrap.id = 'nishaBootRecoveryBanner';
                wrap.setAttribute('role', 'alert');
                wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(5,5,5,0.96);display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Courier New",Courier,monospace;';

                const box = document.createElement('div');
                box.style.cssText = 'max-width:420px;width:100%;background:#0e0e0e;border:2px solid #00ff66;padding:22px;text-align:center;color:#ddd;';

                const titleEl = document.createElement('div');
                titleEl.textContent = copy.title;
                titleEl.style.cssText = 'color:#00ff66;font-weight:700;font-size:15px;margin-bottom:12px;';

                const textEl = document.createElement('p');
                textEl.textContent = copy.text;
                textEl.style.cssText = 'font-size:13px;line-height:1.5;margin:0 0 18px;color:#bbb;';

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = copy.btn;
                btn.style.cssText = 'width:100%;padding:13px 16px;background:#111;color:#00ff66;border:2px solid #00ff66;font-family:"Courier New",Courier,monospace;font-size:13px;font-weight:700;cursor:pointer;';
                btn.addEventListener('click', function () {
                    btn.disabled = true;
                    btn.style.opacity = '0.6';
                    try {
                        sessionStorage.removeItem(CHUNK_COUNT_KEY);
                        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
                    } catch (e) {}
                    Promise.all([clearHtmlCaches(), flushStaleServiceWorkers(true)]).then(navigateFreshUrl);
                });

                box.appendChild(titleEl);
                box.appendChild(textEl);
                box.appendChild(btn);
                wrap.appendChild(box);
                document.body.appendChild(wrap);
            } catch (e) {}
        };

        const tryRecoverStaleChunk = function () {
            try {
                if (recoveryInFlight) return;
                if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
                const now = Date.now();
                const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
                let count = Number(sessionStorage.getItem(CHUNK_COUNT_KEY) || '0');
                // Reset attempt counter if previous recovery was over 45s ago
                if (last && (now - last) > 45000) {
                    count = 0;
                }
                if (count >= MAX_AUTO_RECOVERIES) {
                    showManualRecoveryBanner();
                    return;
                }
                if (last && (now - last) < 2500) return;

                recoveryInFlight = true;
                const nextCount = count + 1;
                sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
                sessionStorage.setItem(CHUNK_COUNT_KEY, String(nextCount));

                // On 2nd recovery attempt, force-unregister stale SW so fresh deploy HTML loads cleanly
                Promise.all([
                    clearHtmlCaches(),
                    flushStaleServiceWorkers(nextCount >= 2)
                ]).then(navigateFreshUrl);
            } catch (e) {}
        };
        window.addEventListener('vite:preloadError', function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            tryRecoverStaleChunk();
        });
        window.addEventListener('error', function (event) {
            const target = event && event.target;
            if (!target || target === window) return;
            const tag = target.tagName;
            const url = (tag === 'SCRIPT' ? target.src : (tag === 'LINK' ? target.href : '')) || '';
            if (!/\/assets\/[^?#]+\.(?:js|css)(?:[?#]|$)/i.test(url)) return;

            if (tag === 'LINK' && target.rel === 'stylesheet') {
                if (target.dataset && target.dataset.retried) {
                    tryRecoverStaleChunk();
                    return;
                }
                try {
                    if (target.dataset) target.dataset.retried = '1';
                    const cleanHref = url.split('?')[0];
                    if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
                        caches.keys().then(function (keys) {
                            keys.forEach(function (k) {
                                caches.open(k).then(function (c) { c.delete(cleanHref); }).catch(function () {});
                            });
                        }).catch(function () {});
                    }
                    const fallbackLink = document.createElement('link');
                    fallbackLink.rel = 'stylesheet';
                    fallbackLink.href = cleanHref + '?cb=' + Date.now();
                    if (fallbackLink.dataset) fallbackLink.dataset.retried = '1';
                    fallbackLink.onerror = function () {
                        tryRecoverStaleChunk();
                    };
                    document.head.appendChild(fallbackLink);
                } catch (e) {
                    tryRecoverStaleChunk();
                }
                return;
            }

            tryRecoverStaleChunk();
        }, true);
        window.addEventListener('unhandledrejection', function (event) {
            const reason = event && event.reason;
            const msg = reason && (reason.message || String(reason));
            if (msg && /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(msg)) {
                tryRecoverStaleChunk();
            }
        });
        setTimeout(function () {
            if (!window.__nishaAppBooted && typeof navigator !== 'undefined' && navigator.onLine !== false) {
                tryRecoverStaleChunk();
            }
        }, 4500);
        setTimeout(function () {
            if (!window.__nishaAppBooted && typeof navigator !== 'undefined' && navigator.onLine !== false) {
                showManualRecoveryBanner();
            }
        }, 9000);
    } catch (e) {}
    try {
        const locHash = (window.location && window.location.hash) || '';
        const locSearch = (window.location && window.location.search) || '';
        if (/(?:^|[#&?])type=recovery(?:&|$)/i.test(locHash) || /(?:^|[&?])type=recovery(?:&|$)/i.test(locSearch)) {
            window.__NISHA_PASSWORD_RECOVERY_PENDING__ = true;
            try { sessionStorage.setItem('nisha_pw_recovery_pending', '1'); } catch (e) {}
        }
        if (locSearch && locSearch.includes('_sw_upd=') && window.history && typeof window.history.replaceState === 'function') {
            const cleanedUrl = new URL(window.location.href);
            cleanedUrl.searchParams.delete('_sw_upd');
            window.history.replaceState(null, '', cleanedUrl.pathname + cleanedUrl.search + cleanedUrl.hash);
        }
    } catch (e) {}
})();
