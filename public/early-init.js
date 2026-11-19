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
                    new Promise(function (resolve) { setTimeout(resolve, 300); })
                ]).catch(function () {});
            } catch (e) {
                return Promise.resolve();
            }
        };
        const tryRecoverStaleChunk = function () {
            try {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
                const now = Date.now();
                const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
                if (last && (now - last) < 15000) return;
                sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
                clearHtmlCaches().then(function () {
                    window.location.reload();
                });
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
        }, 5000);
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
