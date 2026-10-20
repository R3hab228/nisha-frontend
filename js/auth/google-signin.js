// ==========================================
// NISHA GOOGLE SIGN-IN (Google Identity Services, ID Token)
// ------------------------------------------
// Вместо редиректа через *.supabase.co пользователь входит через официальную кнопку Google
// (окно с нашим доменом nisha-store.shop). Полученный ID Token передается в Supabase:
// supabase.auth.signInWithIdToken({ provider: 'google', token, nonce }).
//
// Безопасный фоллбэк: если GIS не загрузился (блокировщик, оффлайн, in-app браузер, чужой домен) —
// кнопка "GOOGLE ID" работает как раньше (OAuth-редирект через Supabase).
// ==========================================

(function () {
    'use strict';

    const GOOGLE_CLIENT_ID = '150814094251-mjd3ol7383v54h7preolcnb19lbujhd8.apps.googleusercontent.com';
    const GSI_SRC = 'https://accounts.google.com/gsi/client';
    // GIS работает только на доменах, добавленных в "Authorized JavaScript origins" в Google Cloud
    const GSI_HOSTS = ['nisha-store.shop', 'www.nisha-store.shop'];
    const BTN_SELECTOR = '[data-google-signin]';
    const GOOGLE_BTN_HEIGHT = 40; // высота стандартной кнопки size:'large'
    const OAUTH_REDIRECT_URL = 'https://www.nisha-store.shop';

    let readyPromise = null;
    let gsiReady = false;
    let rawNonce = '';
    let isSigningIn = false;
    const mounted = new Map(); // button -> { overlay, host, renderedWidth }

    function isInAppBrowser() {
        return /Instagram|FBAN|FBAV|TikTok/i.test(navigator.userAgent || '');
    }

    function toast(message, type) {
        if (typeof window.showToast === 'function') window.showToast(message, type);
    }

    function getSb() {
        return typeof window.getSupabase === 'function' ? window.getSupabase() : null;
    }

    // --- Nonce: в Google уходит SHA-256 (hex), в Supabase — исходная строка ---
    async function createNonce() {
        try {
            if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
                return { raw: '', hashed: '' };
            }
            const bytes = new Uint8Array(32);
            window.crypto.getRandomValues(bytes);
            const raw = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
            const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
            const hashed = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
            return { raw, hashed };
        } catch (e) {
            return { raw: '', hashed: '' };
        }
    }

    function loadGsiScript() {
        if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve(true);
        return new Promise(resolve => {
            const script = document.createElement('script');
            script.src = GSI_SRC;
            script.async = true;
            script.defer = true;
            const timer = setTimeout(() => { script.remove(); resolve(false); }, 10000);
            script.onload = () => {
                clearTimeout(timer);
                resolve(Boolean(window.google && window.google.accounts && window.google.accounts.id));
            };
            script.onerror = () => {
                clearTimeout(timer);
                script.remove();
                resolve(false);
            };
            document.head.appendChild(script);
        });
    }

    // Единоразовая загрузка и инициализация GIS
    function ensureReady() {
        if (readyPromise) return readyPromise;
        readyPromise = (async () => {
            const loaded = await loadGsiScript();
            if (!loaded) return false;
            const nonce = await createNonce();
            rawNonce = nonce.raw;
            try {
                const config = {
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredential,
                    auto_select: false,
                    cancel_on_tap_outside: true,
                    itp_support: true,
                    ux_mode: 'popup',
                    context: 'signin'
                };
                if (nonce.hashed) config.nonce = nonce.hashed;
                window.google.accounts.id.initialize(config);
                gsiReady = true;
                return true;
            } catch (e) {
                console.warn('[GOOGLE] Не удалось инициализировать GIS:', e);
                return false;
            }
        })().then(ok => {
            if (!ok) readyPromise = null; // разрешаем повторную попытку позже
            return ok;
        });
        return readyPromise;
    }

    // --- Получили ID Token от Google -> входим в Supabase ---
    async function handleCredential(response) {
        if (!response || !response.credential || isSigningIn) return;
        isSigningIn = true;
        try {
            const sb = getSb();
            if (!sb) throw new Error('Сервис авторизации недоступен');

            const payload = { provider: 'google', token: response.credential };
            if (rawNonce) payload.nonce = rawNonce;

            const { error } = await sb.auth.signInWithIdToken(payload);
            if (error) throw error;

            const msg = typeof window.i18next !== 'undefined' ? window.i18next.t('messages.login_success') : 'Вход выполнен успешно!';
            toast(msg, 'success');

            if (typeof window.checkSession === 'function') await window.checkSession();

            const profileModal = document.getElementById('profileModal');
            if (profileModal && profileModal.style.display === 'flex' && typeof window.closeModal === 'function') {
                window.closeModal('profileModal');
            }
        } catch (err) {
            console.error('[GOOGLE] Ошибка входа:', err);
            toast('Ошибка входа через Google: ' + ((err && err.message) || 'попробуйте ещё раз'), 'error');
        } finally {
            isSigningIn = false;
        }
    }

    // --- Невидимая официальная кнопка Google поверх нашей кнопки (дизайн сайта не меняется) ---
    function layoutOverlay(btn, state) {
        const w = btn.offsetWidth;
        const h = btn.offsetHeight;
        const style = state.overlay.style;
        if (!w || !h) {
            style.display = 'none'; // кнопка скрыта (закрытая модалка) — пересчитаем, когда появится
            return;
        }

        const parent = btn.parentElement;
        let left = btn.offsetLeft;
        let top = btn.offsetTop;
        if (parent && btn.offsetParent !== parent) {
            const b = btn.getBoundingClientRect();
            const p = parent.getBoundingClientRect();
            left = b.left - p.left - parent.clientLeft + parent.scrollLeft;
            top = b.top - p.top - parent.clientTop + parent.scrollTop;
        }

        style.display = 'block';
        style.left = left + 'px';
        style.top = top + 'px';
        style.width = w + 'px';
        style.height = h + 'px';

        const googleWidth = Math.max(200, Math.min(400, Math.round(w)));
        if (state.renderedWidth !== googleWidth) {
            state.host.innerHTML = '';
            window.google.accounts.id.renderButton(state.host, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: googleWidth
            });
            state.renderedWidth = googleWidth;
        }
        state.host.style.width = googleWidth + 'px';
        state.host.style.height = GOOGLE_BTN_HEIGHT + 'px';
        state.host.style.transform = 'scale(' + (w / googleWidth) + ',' + (h / GOOGLE_BTN_HEIGHT) + ')';
    }

    function mountButton(btn) {
        if (mounted.has(btn) || !btn.parentElement) return;
        const parent = btn.parentElement;
        if (window.getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

        const overlay = document.createElement('div');
        overlay.className = 'g-signin-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.cssText = 'position:absolute;z-index:6;overflow:hidden;opacity:0.01;display:none;cursor:pointer;touch-action:manipulation;';
        const host = document.createElement('div');
        host.style.cssText = 'transform-origin:0 0;';
        overlay.appendChild(host);
        btn.insertAdjacentElement('afterend', overlay);

        const state = { overlay, host, renderedWidth: 0 };
        mounted.set(btn, state);

        const sync = () => {
            try { layoutOverlay(btn, state); } catch (e) { overlay.style.display = 'none'; }
        };
        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(sync);
            ro.observe(btn);
            ro.observe(parent);
        }
        window.addEventListener('resize', sync);
        sync();
    }

    function mountAll() {
        document.querySelectorAll(BTN_SELECTOR).forEach(mountButton);
    }

    // --- Запасной путь: прежний OAuth-редирект через Supabase ---
    async function redirectToGoogle() {
        const sb = getSb();
        if (!sb) return;
        const { error } = await sb.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: OAUTH_REDIRECT_URL,
                queryParams: { prompt: 'select_account', access_type: 'offline' }
            }
        });
        if (error) toast('Ошибка: ' + error.message, 'error');
    }

    // Вызывается, когда клик дошёл до нашей кнопки (клавиатура или GIS не готов)
    async function loginWithGoogle() {
        if (isInAppBrowser()) {
            alert('Для входа через Google открой сайт в обычном браузере (Safari или Chrome)');
            return;
        }

        if (gsiReady && window.google && window.google.accounts && window.google.accounts.id) {
            let fellBack = false;
            try {
                window.google.accounts.id.prompt(notification => {
                    const notShown = notification && (
                        (notification.isNotDisplayed && notification.isNotDisplayed()) ||
                        (notification.isSkippedMoment && notification.isSkippedMoment())
                    );
                    if (notShown && !fellBack) {
                        fellBack = true;
                        redirectToGoogle();
                    }
                });
                return;
            } catch (e) { /* падаем в редирект */ }
        }

        await redirectToGoogle();
    }
    window.loginWithGoogle = loginWithGoogle;

    function start() {
        if (isInAppBrowser()) return;
        if (!GSI_HOSTS.includes(window.location.hostname)) return; // превью/localhost: оставляем обычный редирект
        ensureReady().then(ok => { if (ok) mountAll(); });
    }

    window.NishaGoogleAuth = { start, ensureReady, handleCredential, createNonce };

    const schedule = () => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(start, { timeout: 3000 });
        } else {
            setTimeout(start, 1500);
        }
    };
    if (document.readyState === 'complete') {
        schedule();
    } else {
        window.addEventListener('load', schedule);
    }
})();
