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
        var CHUNK_RELOAD_KEY = 'nisha_chunk_reload_at';
        var tryRecoverStaleChunk = function () {
            try {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
                var now = Date.now();
                var last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
                if (last && (now - last) < 15000) return;
                sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
                window.location.reload();
            } catch (e) {}
        };
        window.addEventListener('vite:preloadError', function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            tryRecoverStaleChunk();
        });
        window.addEventListener('error', function (event) {
            var target = event && event.target;
            if (!target || target === window) return;
            var tag = target.tagName;
            var url = (tag === 'SCRIPT' ? target.src : (tag === 'LINK' ? target.href : '')) || '';
            if (!/\/assets\/[^?#]+\.(?:js|css)(?:[?#]|$)/i.test(url)) return;

            if (tag === 'LINK' && target.rel === 'stylesheet') {
                if (target.dataset && target.dataset.retried) return;
                try {
                    if (target.dataset) target.dataset.retried = '1';
                    var cleanHref = url.split('?')[0];
                    if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
                        caches.keys().then(function (keys) {
                            keys.forEach(function (k) {
                                caches.open(k).then(function (c) { c.delete(cleanHref); }).catch(function () {});
                            });
                        }).catch(function () {});
                    }
                    var fallbackLink = document.createElement('link');
                    fallbackLink.rel = 'stylesheet';
                    fallbackLink.href = cleanHref + '?cb=' + Date.now();
                    if (fallbackLink.dataset) fallbackLink.dataset.retried = '1';
                    document.head.appendChild(fallbackLink);
                } catch (e) {}
                return;
            }

            tryRecoverStaleChunk();
        }, true);
        window.addEventListener('unhandledrejection', function (event) {
            var reason = event && event.reason;
            var msg = reason && (reason.message || String(reason));
            if (msg && /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)) {
                tryRecoverStaleChunk();
            }
        });
    } catch (e) {}
})();
