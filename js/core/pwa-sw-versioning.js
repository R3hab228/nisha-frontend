// ==========================================
// NISHA PWA SERVICE WORKER & BUILD VERSIONING MODULE
// ==========================================

/**
 * Logs PWA debug diagnostics when __NISHA_DEBUG__ flag is enabled.
 * @param {...any} args
 */
export function debugPwaLog(...args) {
    if (typeof window !== 'undefined' && window.__NISHA_DEBUG__) {
        console.log(...args);
    }
}

const APP_BUILD_ID = (typeof __BUILD_ID__ !== 'undefined') ? __BUILD_ID__ : 'dev';
const APP_SW_VERSION = 'nisha-cache-' + APP_BUILD_ID;
// Уникальный URL воркера на каждый деплой: CDN (Cloudflare) физически не может отдать устаревший sw.js
const SW_SCRIPT_URL = '/sw.js?b=' + encodeURIComponent(APP_BUILD_ID);

export { APP_BUILD_ID, APP_SW_VERSION, SW_SCRIPT_URL };

let swRegistrationBound = false;

/**
 * Queries active or installing Service Worker version via MessageChannel with timeout fallback.
 * @param {ServiceWorker|null} worker
 * @returns {Promise<string|null>}
 */
export function queryServiceWorkerVersion(worker) {
    if (!worker || typeof MessageChannel === 'undefined') {
        return Promise.resolve(null);
    }
    const { promise, resolve } = Promise.withResolvers();
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
    } catch {
        if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(null);
        }
    }
    return promise;
}

/**
 * Checks whether checkout modal or order submission is currently active.
 * @returns {boolean}
 */
function isUserBusyWithOrder() {
    if (typeof document === 'undefined') return false;
    const checkout = document.getElementById('checkoutModal');
    const isCheckoutOpen = checkout && (checkout.style.display === 'flex' || checkout.classList.contains('active'));
    const isSubmitting = typeof window !== 'undefined' && Boolean(window.isOrderSubmitting);
    return Boolean(isCheckoutOpen || isSubmitting);
}

/**
 * Registers Service Worker, enables Navigation Preload, and prompts user cleanly on new versions.
 */
export function initServiceWorkerUpdates() {
    if (swRegistrationBound) return;
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    swRegistrationBound = true;

    // Фиксируем наличие контроллера ДО регистрации, чтобы первая установка SW не вызывала плашку "Обновить сейчас"
    const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);
    let updateModalShownInPage = false;

    const registerSw = () => {
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        if (store) store.set('nisha_sw_current_bundle', APP_SW_VERSION);

        navigator.serviceWorker.register(SW_SCRIPT_URL, { updateViaCache: 'none' }).then(registration => {
            debugPwaLog('[PWA] SW зарегистрирован');
            if (registration.navigationPreload) {
                registration.navigationPreload.enable().catch(() => {});
            }

            registration.update().catch(() => {});

            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (!installingWorker) return;

                installingWorker.onstatechange = async () => {
                    if (installingWorker.state === 'installed' && hadControllerAtBoot && navigator.serviceWorker.controller) {
                        if (updateModalShownInPage || APP_BUILD_ID === 'dev') return;

                        try {
                            const isReloaded = (store && store.session)
                                ? (store.session.get('nisha_sw_update_reloaded') === '1')
                                : (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('nisha_sw_update_reloaded') === '1') : false);
                            if (isReloaded) return;
                            const lastUpdateTs = Number.parseInt(store ? store.get('nisha_sw_updated_ts', '0') : '0', 10);
                            if (lastUpdateTs && (Date.now() - lastUpdateTs) < 10 * 60 * 1000) return;
                        } catch {}

                        const workerVersion = await queryServiceWorkerVersion(installingWorker);
                        if (!workerVersion || workerVersion === APP_SW_VERSION) {
                            if (store) store.set('nisha_sw_ack_version', workerVersion || APP_SW_VERSION);
                            return;
                        }

                        if (store && store.get('nisha_sw_ack_version') === workerVersion) return;

                        updateModalShownInPage = true;
                        debugPwaLog('[PWA] Найдено новое обновление:', workerVersion);

                        const triggerUpdateModal = () => {
                            const i18n = typeof i18next !== 'undefined' ? i18next : null;
                            const updTitle = (i18n && i18n.t('pwa.update_title', { defaultValue: 'SYSTEM_UPDATE.EXE' })) || 'SYSTEM_UPDATE.EXE';
                            const updText = (i18n && i18n.t('pwa.update_text', { defaultValue: 'Выпущена новая версия сайта (исправление багов, новые фичи).<br><br>Рекомендуем обновить страницу.' })) || 'Выпущена новая версия сайта (исправление багов, новые фичи).<br><br>Рекомендуем обновить страницу.';
                            const updBtn = (i18n && i18n.t('pwa.btn_update', { defaultValue: '[ ОБНОВИТЬ СЕЙЧАС ]' })) || '[ ОБНОВИТЬ СЕЙЧАС ]';
                            if (typeof showTerminalModal !== 'function') return;
                            showTerminalModal(
                                updTitle,
                                updText,
                                updBtn,
                                async () => {
                                    try {
                                        if (store && store.session) store.session.set('nisha_sw_update_reloaded', '1');
                                        else if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('nisha_sw_update_reloaded', '1');
                                        if (store) {
                                            store.set('nisha_sw_updated_ts', String(Date.now()));
                                            store.set('nisha_sw_ack_version', workerVersion || APP_SW_VERSION);
                                        }
                                    } catch {}

                                    try {
                                        if (registration.waiting) {
                                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                                        }
                                        if (installingWorker) {
                                            installingWorker.postMessage({ type: 'SKIP_WAITING' });
                                        }
                                    } catch {}

                                    try {
                                        if ('caches' in window) {
                                            const names = await caches.keys();
                                            await Promise.all(names.map(name => caches.delete(name)));
                                        }
                                    } catch {}

                                    window.location.reload();
                                }
                            );
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
        }).catch(err => console.warn('[PWA] Ошибка SW: ', err));
    };

    if (typeof window.addEventListener === 'function') {
        window.addEventListener('load', registerSw);
    }
}
