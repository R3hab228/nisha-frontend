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
})();
