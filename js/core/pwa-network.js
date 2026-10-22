// ==========================================
// NISHA PWA, SENTRY, PUSH & NETWORK MODULE
// ==========================================

// === 1. АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ САЙТА (SERVICE WORKER) ===
const APP_BUILD_ID = (typeof __BUILD_ID__ !== 'undefined') ? __BUILD_ID__ : 'dev';
const APP_SW_VERSION = 'nisha-cache-' + APP_BUILD_ID;
// Уникальный URL воркера на каждый деплой: CDN (Cloudflare) физически не может отдать устаревший sw.js
const SW_SCRIPT_URL = '/sw.js?b=' + encodeURIComponent(APP_BUILD_ID);

function queryServiceWorkerVersion(worker) {
    return new Promise(resolve => {
        if (!worker || typeof MessageChannel === 'undefined') {
            return resolve(null);
        }
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                resolve(null);
            }
        }, 1200);
        try {
            const channel = new MessageChannel();
            channel.port1.onmessage = event => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve((event.data && event.data.version) ? event.data.version : null);
                }
            };
            worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
        } catch (e) {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(null);
            }
        }
    });
}

if ('serviceWorker' in navigator) {
    // Фиксируем наличие контроллера ДО регистрации, чтобы в новом браузере (например, при переходе из Chrome в Safari)
    // первая установка SW никогда не вызывала плашку "Обновить сейчас"
    const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);
    let updateModalShownInPage = false;

    window.addEventListener('load', () => {
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        if (store) store.set('nisha_sw_current_bundle', APP_SW_VERSION);

        navigator.serviceWorker.register(SW_SCRIPT_URL, { updateViaCache: 'none' }).then(registration => {
            console.log('[PWA] SW зарегистрирован');

            // Проверяем обновления без использования HTTP-кэша
            registration.update().catch(() => {});

            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (!installingWorker) return;

                installingWorker.onstatechange = async () => {
                    if (installingWorker.state === 'installed' && hadControllerAtBoot && navigator.serviceWorker.controller) {
                        if (updateModalShownInPage || APP_BUILD_ID === 'dev') return;

                        // Если пользователь уже нажал "Обновить сейчас" в этой сессии или менее 10 минут назад — не показываем повторно
                        try {
                            if (sessionStorage.getItem('nisha_sw_update_reloaded') === '1') return;
                            const lastUpdateTs = parseInt(store ? store.get('nisha_sw_updated_ts', '0') : '0', 10);
                            if (lastUpdateTs && (Date.now() - lastUpdateTs) < 10 * 60 * 1000) return;
                        } catch (e) {}

                        // Узнаем версию нового воркера: если страница УЖЕ загружена со свежим JS-бандлом этой же версии,
                        // плашка не нужна (воркер тихо активируется в фоне)
                        const workerVersion = await queryServiceWorkerVersion(installingWorker);
                        if (!workerVersion || workerVersion === APP_SW_VERSION) {
                            if (store) store.set('nisha_sw_ack_version', workerVersion || APP_SW_VERSION);
                            return;
                        }

                        if (store && store.get('nisha_sw_ack_version') === workerVersion) return;

                        updateModalShownInPage = true;
                        console.log('[PWA] Найдено новое обновление:', workerVersion);

                        const triggerUpdateModal = () => {
                            showTerminalModal(
                                'SYSTEM_UPDATE.EXE',
                                'Выпущена новая версия сайта (исправление багов, новые фичи).<br><br>Рекомендуем обновить страницу.',
                                '[ ОБНОВИТЬ СЕЙЧАС ]',
                                async () => {
                                    try {
                                        sessionStorage.setItem('nisha_sw_update_reloaded', '1');
                                        if (store) {
                                            store.set('nisha_sw_updated_ts', String(Date.now()));
                                            store.set('nisha_sw_ack_version', workerVersion || APP_SW_VERSION);
                                        }
                                    } catch (e) {}

                                    try {
                                        if (registration.waiting) {
                                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                                        }
                                        if (installingWorker) {
                                            installingWorker.postMessage({ type: 'SKIP_WAITING' });
                                        }
                                    } catch (e) {}

                                    try {
                                        if ('caches' in window) {
                                            const names = await caches.keys();
                                            await Promise.all(names.map(name => caches.delete(name)));
                                        }
                                    } catch (e) {}

                                    window.location.reload();
                                }
                            );
                        };

                        // Проверяем, не занят ли пользователь оформлением заказа прямо сейчас
                        const isUserBusyWithOrder = () => {
                            const checkout = document.getElementById('checkoutModal');
                            const isCheckoutOpen = checkout && (checkout.style.display === 'flex' || checkout.classList.contains('active'));
                            const isSubmitting = window.isOrderSubmitting;
                            return isCheckoutOpen || isSubmitting;
                        };

                        if (isUserBusyWithOrder()) {
                            const checkInterval = setInterval(() => {
                                if (!isUserBusyWithOrder()) {
                                    clearInterval(checkInterval);
                                    setTimeout(triggerUpdateModal, 2500);
                                }
                            }, 2000);
                        } else {
                            triggerUpdateModal();
                        }
                    }
                };
            };
        }).catch(err => console.log('[PWA] Ошибка SW: ', err));
    });
}

// === 2. SENTRY CLIENT-SIDE ERROR MONITORING ===
const earlySentryErrors = [];
const earlySentryCtrl = new AbortController();
function recordEarlySentryError(evt) {
    if (!window._sentryActive && earlySentryErrors.length < 20) {
        earlySentryErrors.push(evt);
        initSentryDeferred();
    }
}
window.addEventListener('error', recordEarlySentryError, { signal: earlySentryCtrl.signal });
window.addEventListener('unhandledrejection', recordEarlySentryError, { signal: earlySentryCtrl.signal });

function initSentryDeferred() {
    if (window._sentryActive) return;
    window._sentryActive = true;

    const setupSentry = () => {
        if (typeof Sentry !== 'undefined' && Sentry.init) {
            try {
                Sentry.init({
                    dsn: "https://13d63555c1c64605be8f9659af548581@o4511428929323008.ingest.de.sentry.io/4511428931682384", 
                    release: "nisha-store@1.0.0",
                    environment: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'development' : 'production',
                    sampleRate: 1.0,
                    tracesSampleRate: 0.1,
                    ignoreErrors: [
                        'ResizeObserver loop completed with undelivered notifications',
                        'ResizeObserver loop limit exceeded',
                        'Non-Error promise rejection captured',
                        'Load failed',
                        'Failed to fetch',
                        'NetworkError when attempting to fetch resource',
                        'The operation was aborted',
                        'AbortError: The play() request was interrupted'
                    ],
                    denyUrls: [
                        /extensions\//i,
                        /^chrome-extension:\/\//i,
                        /^moz-extension:\/\//i
                    ]
                });
                console.log('[ SENTRY ] СИСТЕМА МОНИТОРИНГА АКТИВНА.');

                earlySentryCtrl.abort();
                while (earlySentryErrors.length > 0) {
                    const earlyEvt = earlySentryErrors.shift();
                    if (earlyEvt && earlyEvt.error) {
                        Sentry.captureException(earlyEvt.error);
                    } else if (earlyEvt && earlyEvt.reason) {
                        Sentry.captureException(earlyEvt.reason);
                    } else if (earlyEvt && earlyEvt.message) {
                        Sentry.captureMessage(earlyEvt.message);
                    }
                }
            } catch(e) {}
        }
    };

    if (typeof Sentry === 'undefined') {
        if (typeof loadExternalScript === 'function') {
            loadExternalScript('https://browser.sentry-cdn.com/8.38.0/bundle.min.js')
                .then(setupSentry)
                .catch(() => {});
        }
    } else {
        setupSentry();
    }
}

window.captureError = function(err, context = {}) {
    if (typeof Sentry !== 'undefined' && Sentry.captureException) {
        try {
            Sentry.captureException(err, { extra: context });
        } catch(e) {}
    } else {
        console.warn('[ERROR CAPTURED]', err, context);
    }
};

if ('requestIdleCallback' in window) {
    setTimeout(() => requestIdleCallback(initSentryDeferred, { timeout: 1000 }), 2500);
} else {
    setTimeout(initSentryDeferred, 2500);
}
['scroll', 'touchstart', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, initSentryDeferred, { once: true, passive: true });
});

// === 3. PWA INSTALL BUTTON LOGIC ===
let deferredPrompt;
const installBtn = document.getElementById('installAppBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'block';
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('Пользователь установил PWA');
            installBtn.style.display = 'none';
        }
        deferredPrompt = null;
    });
}

// === 4. УМНАЯ ВКЛАДКА (СИНХРОНИЗАЦИЯ СЕССИИ И ЗАГОЛОВКА) ===
document.addEventListener("visibilitychange", async () => {
    if (document.hidden) {
        document.title = `Zzz... | NISHA`;
    } else {
        const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
        if (activeItem) {
            document.title = `NISHA | ${activeItem.brand} - ${activeItem.name}`;
        } else {
            document.title = 'NISHA | Underground Store';
        }
        const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
        if (sb && typeof checkSession === 'function') {
            await checkSession();
        }
    }
});

// === 5. WINDOWS 95 ОФЛАЙН-РЕЖИМ (Error_NISHA.exe) ===
function createNetErrorElement() {
    const wrapper = document.createElement('div');
    wrapper.id = 'win95-net-error';
    wrapper.style.cssText = 'display:none;justify-content:center;padding:50px 10px;width:100%;box-sizing:border-box';
    wrapper.innerHTML = `
<div style="background:#dfd8c1;border-top:2px solid #fff;border-left:2px solid #fff;border-right:2px solid #0a0a0a;border-bottom:2px solid #0a0a0a;padding:2px;width:100%;max-width:300px;box-shadow:4px 4px 0 rgba(0,0,0,.8)">
<div style="background:navy;color:#fff;font-family:Tahoma,sans-serif;font-weight:700;font-size:12px;padding:3px 5px;display:flex;justify-content:space-between;align-items:center">
<span>Error_NISHA.exe</span>
<div data-action="dismiss-net-error" style="background:silver;color:#000;border:1px solid #000;width:14px;height:14px;display:flex;justify-content:center;align-items:center;font-size:10px;cursor:pointer">X</div>
</div>
<div style="padding:20px;text-align:center;background:#dfd8c1">
<div style="height:60px;display:flex;align-items:center;justify-content:center;margin:0 auto">
<svg class="win95-pixel-cables" viewBox="0 0 57 32" width="114" height="64" shape-rendering="crispEdges" style="display:block;margin:0 auto;width:114px;height:auto;max-width:100%" xmlns="http://www.w3.org/2000/svg">
  <path fill="#c0d7e8" d="M24,1h1v1h-1z M23,2h1v1h-1z M25,2h1v1h-1z M33,2h1v1h-1z M22,3h1v1h-1z M26,3h1v1h-1z M29,3h1v1h-1z M31,4h1v1h-1z M26,5h1v1h-1z M26,6h1v1h-1z M37,13h1v1h-1z M38,14h1v1h-1z M14,15h1v1h-1z M17,15h1v1h-1z M42,15h1v1h-1z M16,16h1v1h-1z M42,16h1v1h-1z M13,18h1v1h-1z M12,19h1v1h-1z M29,19h1v1h-1z M44,19h1v1h-1z M19,21h1v1h-1z M28,22h1v1h-1z M43,22h1v1h-1z M28,23h1v1h-1z M17,24h1v1h-1z M28,24h1v1h-1z M31,24h1v1h-1z M56,24h1v1h-1z M30,25h1v1h-1z M48,25h6v1h-6z M0,26h1v1h-1z M56,26h1v1h-1z M42,27h1v1h-1z M56,27h1v1h-1z M56,28h1v1h-1z M12,29h1v1h-1z M46,29h1v1h-1z M56,29h1v1h-1z M10,30h1v1h-1z M51,30h4v1h-4z M1,31h8v1h-8z" />
  <path fill="#94b1c7" d="M31,1h1v1h-1z M22,2h1v1h-1z M24,2h1v1h-1z M32,2h1v1h-1z M32,3h1v1h-1z M23,4h1v1h-1z M26,4h1v1h-1z M29,5h2v1h-2z M25,6h1v1h-1z M38,11h1v1h-1z M17,12h1v1h-1z M33,12h1v1h-1z M36,12h2v1h-2z M39,12h1v1h-1z M16,13h1v1h-1z M18,13h1v1h-1z M38,13h1v1h-1z M40,13h1v1h-1z M15,14h1v1h-1z M17,14h2v1h-2z M37,14h1v1h-1z M39,14h1v1h-1z M15,15h2v1h-2z M18,15h1v1h-1z M38,15h2v1h-2z M17,16h1v1h-1z M39,16h2v1h-2z M16,17h2v1h-2z M31,17h1v1h-1z M40,17h1v1h-1z M42,17h1v1h-1z M15,18h1v1h-1z M32,18h1v1h-1z M41,18h1v1h-1z M43,18h1v1h-1z M15,19h1v1h-1z M23,19h1v1h-1z M28,19h1v1h-1z M12,20h1v1h-1z M14,20h1v1h-1z M22,20h1v1h-1z M29,20h1v1h-1z M36,20h1v1h-1z M42,20h1v1h-1z M11,21h1v1h-1z M13,21h2v1h-2z M20,21h1v1h-1z M29,21h1v1h-1z M42,21h2v1h-2z M46,21h1v1h-1z M10,22h1v1h-1z M13,22h1v1h-1z M18,22h1v1h-1z M30,22h1v1h-1z M38,22h1v1h-1z M44,22h1v1h-1z M8,23h2v1h-2z M12,23h2v1h-2z M31,23h1v1h-1z M44,23h2v1h-2z M0,24h1v1h-1z M2,24h6v1h-6z M10,24h2v1h-2z M39,24h1v1h-1z M45,24h3v1h-3z M0,25h1v1h-1z M8,25h3v1h-3z M16,25h1v1h-1z M28,25h1v1h-1z M40,25h1v1h-1z M54,25h2v1h-2z M1,26h8v1h-8z M41,26h1v1h-1z M0,27h1v1h-1z M0,28h1v1h-1z M44,28h1v1h-1z M0,29h1v1h-1z" />
  <path fill="#8ee0ff" d="M30,2h1v1h-1z M23,3h1v1h-1z M25,3h1v1h-1z M24,4h2v1h-2z M30,4h1v1h-1z M29,23h1v1h-1z M29,24h1v1h-1z" />
  <path fill="#3da3e8" d="M31,2h1v1h-1z M24,3h1v1h-1z M30,3h2v1h-2z M24,5h2v1h-2z M30,23h1v1h-1z M30,24h1v1h-1z" />
  <path fill="#d89c5e" d="M22,7h3v1h-3z M32,7h2v1h-2z M23,8h2v1h-2z M31,8h2v1h-2z M23,9h2v1h-2z M30,9h2v1h-2z M33,9h1v1h-1z M22,10h2v1h-2z M25,10h1v1h-1z M29,10h3v1h-3z M33,10h2v1h-2z M21,11h1v1h-1z M25,11h1v1h-1z M30,11h1v1h-1z M32,11h1v1h-1z M23,12h3v1h-3z M29,13h3v1h-3z M29,14h2v1h-2z M32,14h1v1h-1z M24,15h3v1h-3z M23,16h2v1h-2z M29,16h1v1h-1z M25,17h1v1h-1z" />
  <path fill="#8d5830" d="M22,8h1v1h-1z M33,8h1v1h-1z M21,9h2v1h-2z M34,9h1v1h-1z M21,10h1v1h-1z M35,10h1v1h-1z M22,12h1v1h-1z M31,12h1v1h-1z M22,13h2v1h-2z M32,13h1v1h-1z M23,15h1v1h-1z M30,15h2v1h-2z M26,16h1v1h-1z M30,16h1v1h-1z" />
  <path fill="#2c3b47" d="M34,8h1v1h-1z M35,9h1v1h-1z M20,10h1v1h-1z M21,12h1v1h-1z M32,12h1v1h-1z M35,12h1v1h-1z M21,13h1v1h-1z M23,14h1v1h-1z M21,15h1v1h-1z M33,15h2v1h-2z M31,16h4v1h-4z M22,17h2v1h-2z M34,17h1v1h-1z M21,18h1v1h-1z M33,18h1v1h-1z M18,19h3v1h-3z M36,19h1v1h-1z M38,19h1v1h-1z M17,20h1v1h-1z M39,20h1v1h-1z M38,21h1v1h-1z M40,21h1v1h-1z M39,22h1v1h-1z M40,24h1v1h-1z M42,24h1v1h-1z M14,25h1v1h-1z M41,25h1v1h-1z M43,25h1v1h-1z M13,26h1v1h-1z M42,26h1v1h-1z M11,27h1v1h-1z M43,27h2v1h-2z M47,27h1v1h-1z M9,28h1v1h-1z M12,28h1v1h-1z M45,28h11v1h-11z M1,29h4v1h-4z M6,29h1v1h-1z M8,29h1v1h-1z M47,29h1v1h-1z" />
  <path fill="#4c667a" d="M19,10h1v1h-1z M19,11h1v1h-1z M31,11h1v1h-1z M33,11h1v1h-1z M18,12h1v1h-1z M34,12h1v1h-1z M17,13h1v1h-1z M24,13h1v1h-1z M33,13h3v1h-3z M39,13h1v1h-1z M16,14h1v1h-1z M20,14h3v1h-3z M34,14h2v1h-2z M19,15h2v1h-2z M35,15h1v1h-1z M19,16h4v1h-4z M25,16h1v1h-1z M35,16h1v1h-1z M41,16h1v1h-1z M14,17h1v1h-1z M21,17h1v1h-1z M35,17h4v1h-4z M41,17h1v1h-1z M14,18h1v1h-1z M17,18h4v1h-4z M24,18h1v1h-1z M37,18h3v1h-3z M42,18h1v1h-1z M13,19h1v1h-1z M17,19h1v1h-1z M34,19h2v1h-2z M39,19h2v1h-2z M42,19h1v1h-1z M13,20h1v1h-1z M15,20h2v1h-2z M40,20h1v1h-1z M43,20h2v1h-2z M12,21h1v1h-1z M15,21h2v1h-2z M18,21h1v1h-1z M41,21h1v1h-1z M44,21h2v1h-2z M15,22h1v1h-1z M17,22h1v1h-1z M41,22h1v1h-1z M45,22h1v1h-1z M10,23h1v1h-1z M14,23h2v1h-2z M39,23h1v1h-1z M41,23h2v1h-2z M8,24h2v1h-2z M13,24h2v1h-2z M16,24h1v1h-1z M43,24h2v1h-2z M49,24h2v1h-2z M52,24h1v1h-1z M54,24h2v1h-2z M1,25h7v1h-7z M12,25h2v1h-2z M44,25h3v1h-3z M11,26h2v1h-2z M45,26h2v1h-2z M3,27h1v1h-1z M9,27h2v1h-2z M48,27h8v1h-8z M1,28h8v1h-8z M5,29h1v1h-1z M7,29h1v1h-1z M9,30h1v1h-1z" />
  <path fill="#fce0b6" d="M24,10h1v1h-1z M24,11h1v1h-1z M28,14h1v1h-1z M29,15h1v1h-1z" />
  <path fill="#000000" d="M36,10h1v1h-1z M34,11h2v1h-2z M20,13h1v1h-1z M33,14h1v1h-1z M22,15h1v1h-1z M24,17h1v1h-1z M32,17h2v1h-2z M22,18h2v1h-2z M34,18h3v1h-3z M21,19h2v1h-2z M37,19h1v1h-1z M18,20h3v1h-3z M38,20h1v1h-1z M17,21h1v1h-1z M39,21h1v1h-1z M16,22h1v1h-1z M40,22h1v1h-1z M16,23h1v1h-1z M40,23h1v1h-1z M15,24h1v1h-1z M41,24h1v1h-1z M15,25h1v1h-1z M42,25h1v1h-1z M14,26h1v1h-1z M43,26h2v1h-2z M12,27h2v1h-2z M45,27h2v1h-2z M10,28h2v1h-2z M9,29h3v1h-3z M48,29h8v1h-8z M1,30h8v1h-8z" />
  <path fill="#6e899e" d="M37,10h1v1h-1z M18,11h1v1h-1z M20,11h1v1h-1z M36,11h2v1h-2z M19,12h2v1h-2z M38,12h1v1h-1z M19,13h1v1h-1z M36,13h1v1h-1z M19,14h1v1h-1z M36,14h1v1h-1z M40,14h1v1h-1z M32,15h1v1h-1z M36,15h2v1h-2z M40,15h2v1h-2z M14,16h2v1h-2z M18,16h1v1h-1z M36,16h3v1h-3z M15,17h1v1h-1z M18,17h3v1h-3z M39,17h1v1h-1z M16,18h1v1h-1z M40,18h1v1h-1z M14,19h1v1h-1z M16,19h1v1h-1z M33,19h1v1h-1z M41,19h1v1h-1z M43,19h1v1h-1z M21,20h1v1h-1z M28,20h1v1h-1z M37,20h1v1h-1z M41,20h1v1h-1z M28,21h1v1h-1z M11,22h2v1h-2z M14,22h1v1h-1z M42,22h1v1h-1z M46,22h2v1h-2z M11,23h1v1h-1z M17,23h1v1h-1z M43,23h1v1h-1z M46,23h10v1h-10z M1,24h1v1h-1z M12,24h1v1h-1z M48,24h1v1h-1z M51,24h1v1h-1z M53,24h1v1h-1z M11,25h1v1h-1z M29,25h1v1h-1z M47,25h1v1h-1z M9,26h2v1h-2z M15,26h1v1h-1z M47,26h9v1h-9z M1,27h2v1h-2z M4,27h5v1h-5z M14,27h1v1h-1z M13,28h1v1h-1z M0,30h1v1h-1z" />
  <path fill="#1c5e96" d="M29,22h1v1h-1z" />
</svg>
</div>
<p id="win95-error-msg" style="color:#000;margin-top:15px;margin-bottom:0;font-family:Tahoma,sans-serif;font-size:13px;font-weight:normal">Соединение потеряно</p>
</div>
</div>`;
    return wrapper;
}

function handleNetworkOffline() {
    const grid = document.getElementById('itemsGrid');
    const offlineBanner = document.getElementById('offlineStickyBanner');
    let netError = document.getElementById('win95-net-error');
    const loader = document.getElementById('win95-loader');
    
    if (loader) loader.style.display = 'none';

    const hasCards = grid && grid.querySelectorAll('.item-card:not(.skeleton-card)').length > 0;

    if (hasCards) {
        if (offlineBanner) {
            if (typeof i18next !== 'undefined') {
                offlineBanner.innerText = i18next.t('checkout.offline_banner');
            }
            offlineBanner.classList.add('active');
        }
        if (typeof showToast === 'function') {
            const msg = typeof i18next !== 'undefined' ? i18next.t('checkout.offline_banner') : '[!] ОФЛАЙН-РЕЖИМ: Отображаются сохраненные товары.';
            showToast(msg, 'error');
        }
    } else {
        if (grid) {
            grid.classList.add('fade-out');
        }
        
        setTimeout(() => {
            if (grid) {
                grid.style.display = 'none';
                grid.classList.remove('fade-out');
                grid.classList.remove('feed-restore-anim');
            }
            
            if (!netError && grid && grid.parentElement) {
                netError = createNetErrorElement();
                grid.before(netError);
            }
            
            if (netError) {
                const msgEl = document.getElementById('win95-error-msg') || netError.querySelector('#win95-error-msg');
                if (msgEl) {
                    msgEl.textContent = 'Соединение потеряно';
                    msgEl.style.color = '#000';
                    msgEl.style.fontFamily = "Tahoma, sans-serif";
                    msgEl.style.fontSize = '13px';
                    msgEl.style.fontWeight = 'normal';
                }
                netError.classList.remove('fade-out');
                netError.classList.add('fade-in');
                netError.style.display = 'flex';
            }
            if (window.scrollY > 150) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 280);
    }
    if (typeof triggerHaptic === 'function') triggerHaptic('error');
}
window.handleNetworkOffline = handleNetworkOffline;

function handleNetworkOnline() {
    const offlineBanner = document.getElementById('offlineStickyBanner');
    if (offlineBanner && offlineBanner.classList.contains('active')) {
        offlineBanner.classList.remove('active');
    }

    const netError = document.getElementById('win95-net-error');
    const msgEl = document.getElementById('win95-error-msg');
    const grid = document.getElementById('itemsGrid');
    
    if (msgEl) {
        msgEl.textContent = 'Соединение восстановлено!!!';
        msgEl.style.color = '#008000';
        msgEl.style.fontFamily = "Tahoma, sans-serif";
        msgEl.style.fontSize = '13px';
        msgEl.style.fontWeight = 'normal';
    }
    if (typeof triggerHaptic === 'function') triggerHaptic('success');

    if (typeof showToast === 'function') {
        const msg = typeof i18next !== 'undefined' ? i18next.t('checkout.online_toast') : 'Соединение восстановлено!';
        showToast(msg, 'success');
    }
    
    setTimeout(() => {
        if (netError && netError.style.display !== 'none') {
            netError.classList.remove('fade-in');
            netError.classList.add('fade-out');
        }
        
        setTimeout(async () => {
            if (netError) {
                netError.style.display = 'none';
                netError.classList.remove('fade-out');
                netError.classList.remove('fade-in');
            }
            
            if (grid) {
                grid.style.display = '';
                grid.classList.remove('fade-out');
                grid.classList.add('feed-restore-anim');
                
                if (typeof loadAllItems === 'function') {
                    loadAllItems();
                }
                setTimeout(() => {
                    grid.classList.remove('feed-restore-anim');
                }, 700);
            }
            if (typeof checkSession === 'function') checkSession();
            if (typeof updateCartUI === 'function') updateCartUI();
        }, 280);
    }, 850);
}
window.handleNetworkOnline = handleNetworkOnline;

window.dismissNetError = function() {
    const netError = document.getElementById('win95-net-error');
    const grid = document.getElementById('itemsGrid');
    if (netError) {
        netError.classList.remove('fade-in');
        netError.classList.add('fade-out');
        setTimeout(() => {
            netError.style.display = 'none';
            netError.classList.remove('fade-out');
            netError.classList.remove('fade-in');
        }, 280);
    }
    if (grid) {
        grid.style.display = '';
        grid.classList.remove('fade-out');
        grid.classList.add('feed-restore-anim');
        setTimeout(() => {
            grid.classList.remove('feed-restore-anim');
        }, 700);
    }
};

window.addEventListener('offline', handleNetworkOffline);
window.addEventListener('online', handleNetworkOnline);

// === 6. WEB PUSH ПОДПИСКА ===
let pushPrompted = false;
async function subscribeUserToPush(registration, silent = false) {
    try {
        if (Notification.permission === 'denied') return;
        
        let targetSub = await registration.pushManager.getSubscription();
        
        if (!targetSub) {
            if (silent) return;
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
            
            const vapidData = await window.apiClient.get('/api/vapid-key', { timeout: 8000, retries: 1, dedupe: true });
            if (!vapidData || !vapidData.publicKey) return;
            const { publicKey } = vapidData;
            
            const padding = '='.repeat((4 - publicKey.length % 4) % 4);
            const base64 = (publicKey + padding).replaceAll('-', '+').replaceAll('_', '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }

            targetSub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: outputArray
            });
        }
        
        if (targetSub) {
            const activeUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : (window.currentUser || null);
            const fp = window.clientFingerprint || 'guest_' + Date.now();
            const payload = {
                subscription: targetSub,
                userId: activeUser ? activeUser.id : fp
            };
            await window.apiClient.post('/api/subscribe', payload, { timeout: 10000, retries: 1 });
        }
    } catch(e) {
        console.error('Push error:', e);
    }
}
window.subscribeUserToPush = subscribeUserToPush;

if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
    pushPrompted = true;
}

document.addEventListener('click', (e) => {
    if (pushPrompted) return;
    if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
        pushPrompted = true;
        return;
    }
    
    const openModal = document.querySelector('.modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"], #cartSidebar.active, .swal2-container');
    if (openModal) return;
    if (e.target.closest('.item-card')) return;
    if (e.target.closest('.bottom-nav, #cartBtn, #profileBtn, button, a')) return;

    pushPrompted = true;
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            subscribeUserToPush(reg);
        }).catch(() => {});
    }
}, { passive: true });

// === 7. УМНЫЙ РЕЖИМ ЭНЕРГОСБЕРЕЖЕНИЯ (BATTERY STATUS ADAPTER) ===
(function initLowPowerAdapter() {
    if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
        navigator.getBattery().then(battery => {
            const checkBattery = () => {
                if (!battery.charging && battery.level <= 0.20) {
                    document.documentElement.classList.add('low-power-mode');
                } else if (battery.charging || battery.level > 0.25) {
                    document.documentElement.classList.remove('low-power-mode');
                }
            };
            checkBattery();
            battery.addEventListener('levelchange', checkBattery);
            battery.addEventListener('chargingchange', checkBattery);
        }).catch(() => {});
    }
})();
