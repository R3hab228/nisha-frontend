// @ts-check
// ==========================================
// NISHA WEB PUSH SUBSCRIPTION & PWA STANDALONE DEDUPLICATION MODULE
// ==========================================

import { registerActions } from './action-registry.js';
import { base64ToBytes } from './es2025-utils.js';
import { getRuntimeUser, getRuntimeFingerprint, getRuntimeSiteLang, getRuntimeStorage } from './runtime-env.js';

let pushPrompted = false;
let pushListenersBound = false;
/** @type {Promise<any> | null} */
let inFlightSubscribeSync = null;
let inFlightSubscribeKey = '';
const PUSH_SYNC_CACHE_KEY = 'nisha_push_sub_synced_meta';
const PUSH_SYNC_TTL_MS = 6 * 60 * 60 * 1000;

function readPushSyncMeta() {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PUSH_SYNC_CACHE_KEY) : null;
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.sig === 'string' && typeof parsed.ts === 'number') {
            return parsed;
        }
    } catch {}
    return null;
}

/** @param {string} sig */
function writePushSyncMeta(sig) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PUSH_SYNC_CACHE_KEY, JSON.stringify({ sig, ts: Date.now() }));
        }
    } catch {}
}

function clearPushSyncMeta() {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(PUSH_SYNC_CACHE_KEY);
        }
    } catch {}
}

/**
 * Persists PWA installed state across store, localStorage, and long-lived cookie.
 */
function markPwaInstalled() {
    if (typeof window !== 'undefined' && window.store) {
        window.store.set('isPwaInstalled', true);
    }
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('nisha_pwa_installed', 'true');
        if (typeof document !== 'undefined') {
            document.cookie = 'nisha_pwa_installed=true; path=/; max-age=31536000; SameSite=Lax';
        }
    } catch {}
}

/**
 * Unsubscribes active browser Web Push subscription on backend and client pushManager.
 * @param {ServiceWorkerRegistration|null} registration
 * @returns {Promise<void>}
 */
async function unsubscribeExistingPush(registration) {
    clearPushSyncMeta();
    if (!registration || !registration.pushManager) return;
    const sub = await registration.pushManager.getSubscription();
    if (!sub) return;
    try {
        if (typeof window !== 'undefined' && window.apiClient) {
            await window.apiClient.post('/api/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        }
    } catch {}
    await sub.unsubscribe().catch(() => {});
    if (typeof window !== 'undefined' && window.store) {
        window.store.set('pushSubEndpoint', '');
    }
}

/**
 * Detects whether app is running in installed PWA standalone/fullscreen/minimal-ui mode.
 * @returns {boolean}
 */
export function isPwaStandalone() {
    if (typeof window === 'undefined') return false;
    const isStandaloneDisplay = (typeof window.matchMedia === 'function') && window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreenDisplay = (typeof window.matchMedia === 'function') && window.matchMedia('(display-mode: fullscreen)').matches;
    const isMinimalUi = (typeof window.matchMedia === 'function') && window.matchMedia('(display-mode: minimal-ui)').matches;
    const isNavStandalone = typeof navigator !== 'undefined' && navigator.standalone === true;
    const isAndroidApp = typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://');
    const standalone = Boolean(isStandaloneDisplay || isFullscreenDisplay || isMinimalUi || isNavStandalone || isAndroidApp);
    if (standalone && typeof document !== 'undefined' && document.documentElement && document.documentElement.classList) {
        if (typeof document.documentElement.classList.contains === 'function') {
            if (!document.documentElement.classList.contains('pwa-standalone')) {
                document.documentElement.classList.add('pwa-standalone');
            }
        } else if (typeof document.documentElement.classList.add === 'function') {
            document.documentElement.classList.add('pwa-standalone');
        }
    }
    return standalone;
}

/**
 * Checks whether PWA is installed on device via standalone mode, store, localStorage, or cookie.
 * @returns {boolean}
 */
export function checkIsPwaInstalled() {
    if (isPwaStandalone()) return true;
    const storeInstalled = (typeof window !== 'undefined' && window.store) ? Boolean(window.store.get('isPwaInstalled')) : false;
    const localInstalled = typeof localStorage !== 'undefined' && (localStorage.getItem('nisha_pwa_installed') === 'true' || localStorage.getItem('nisha_pwa_installed') === '1');
    const cookieInstalled = typeof document !== 'undefined' && document.cookie && document.cookie.includes('nisha_pwa_installed=true');
    return Boolean(storeInstalled || localInstalled || cookieInstalled);
}

/**
 * Persists browser Notification permission to localStorage and reactive store unconditionally.
 * @returns {string}
 */
export function syncNotificationPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    const perm = Notification.permission;
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem('nisha_notification_permission', perm);
            localStorage.setItem('nisha_notification_permission_time', String(Date.now()));
        } catch {}
    }
    if (typeof window !== 'undefined' && window.store) {
        const stored = window.store.get('notificationPermission');
        if (stored !== perm) {
            window.store.set('notificationPermission', perm);
            window.store.set('notificationPermissionTime', Date.now());
        }
    }
    return perm;
}

/**
 * Subscribes user to Web Push while enforcing PWA-vs-browser deduplication and official host filtering.
 * @param {ServiceWorkerRegistration} registration
 * @param {boolean} [silent=false]
 */
export async function subscribeUserToPush(registration, silent = false) {
    try {
        const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
        const isOfficialHost = hostname === 'nisha-store.shop' || hostname === 'www.nisha-store.shop' || hostname === 'localhost' || hostname === '127.0.0.1';
        if (!isOfficialHost && hostname.includes('.vercel.app')) {
            unsubscribeExistingPush(registration).catch(() => {});
            return;
        }

        syncNotificationPermission();
        const isPwa = isPwaStandalone();
        const pwaInstalled = isPwa || checkIsPwaInstalled();

        // [ПРАВИЛО]: Если открыт обычный сайт в браузере, а на устройстве УЖЕ установлено PWA —
        // уведомления должны приходить ТОЛЬКО от PWA! Сайт в браузере отписываем.
        if (!isPwa && pwaInstalled) {
            await unsubscribeExistingPush(registration).catch(() => {});
            return;
        }

        if (isPwa) {
            markPwaInstalled();
        }

        if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
            return;
        }

        if (silent && inFlightSubscribeSync) {
            try { await inFlightSubscribeSync; } catch {}
        }

        let targetSub = await registration.pushManager.getSubscription();

        if (!targetSub) {
            if (silent && Notification.permission !== 'granted') return;
            const permission = Notification.permission === 'granted'
                ? 'granted'
                : await Notification.requestPermission();
            syncNotificationPermission();
            if (permission !== 'granted') return;

            const vapidData = await window.apiClient.get('/api/vapid-key', { timeout: 8000, retries: 1, dedupe: true });
            if (!vapidData || !vapidData.publicKey) return;
            const { publicKey } = vapidData;

            const outputArray = base64ToBytes(publicKey, { alphabet: 'base64url' });
            if (!outputArray || outputArray.length === 0) return;

            targetSub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: outputArray
            });
        }

        if (targetSub) {
            if (window.store) {
                window.store.set('pushSubEndpoint', targetSub.endpoint);
                syncNotificationPermission();
            }
            const activeUser = getRuntimeUser();
            const fp = window.clientFingerprint || 'guest_' + Date.now();
            const resolvedUserId = activeUser ? activeUser.id : fp;
            const clientType = isPwa ? 'pwa' : 'web';
            const siteLang = getRuntimeSiteLang();
            const syncSignature = `${targetSub.endpoint}|${resolvedUserId}|${fp}|${clientType}|${siteLang}`;

            if (silent) {
                const cachedSync = readPushSyncMeta();
                if (cachedSync && cachedSync.sig === syncSignature && (Date.now() - cachedSync.ts) < PUSH_SYNC_TTL_MS) {
                    return;
                }
            }

            if (inFlightSubscribeSync && inFlightSubscribeKey === syncSignature) {
                await inFlightSubscribeSync;
                return;
            }

            const payload = {
                subscription: targetSub,
                userId: resolvedUserId,
                deviceId: fp,
                clientId: fp,
                clientType,
                isPwa,
                lang: siteLang,
                origin: (typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://www.nisha-store.shop'
            };

            inFlightSubscribeKey = syncSignature;
            inFlightSubscribeSync = window.apiClient.post('/api/subscribe', payload, {
                timeout: 10000,
                retries: silent ? 0 : 1,
                dedupe: true
            }).then((/** @type {any} */ res) => {
                writePushSyncMeta(syncSignature);
                return res;
            }).finally(() => {
                if (inFlightSubscribeKey === syncSignature) {
                    inFlightSubscribeSync = null;
                    inFlightSubscribeKey = '';
                }
            });

            await inFlightSubscribeSync;
        }
    } catch (e) {
        const expectedPushSkipNames = new Set(['NotAllowedError', 'AbortError', 'InvalidStateError', 'NotSupportedError']);
        const err = /** @type {any} */ (e);
        const isExpectedSkip = err && (
            expectedPushSkipNames.has(err.name) ||
            (typeof Notification !== 'undefined' && Notification.permission === 'denied')
        );
        if (!isExpectedSkip) {
            console.error('Push error:', e);
        }
    }
}

/**
 * Initializes standalone detection, permission sync, appinstalled/related-apps hooks, and click prompt.
 */
export function initPwaPush() {
    if (typeof window !== 'undefined') {
        window.isPwaStandalone = isPwaStandalone;
        window.checkIsPwaInstalled = checkIsPwaInstalled;
        window.syncNotificationPermission = syncNotificationPermission;
        window.subscribeUserToPush = subscribeUserToPush;
    }

    syncNotificationPermission();

    if (isPwaStandalone()) {
        markPwaInstalled();
    }

    if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
        /** @type {any} */ (navigator).getInstalledRelatedApps().then((/** @type {any} */ apps) => {
            if (Array.isArray(apps) && apps.length > 0) {
                markPwaInstalled();
                if (!isPwaStandalone() && 'serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(reg => unsubscribeExistingPush(reg)).catch(() => {});
                }
            }
        }).catch(() => {});
    }

    if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('.vercel.app')) {
        pushPrompted = true;
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(async reg => {
                await unsubscribeExistingPush(reg).catch(() => {});
                if (reg && typeof reg.unregister === 'function') {
                    await reg.unregister().catch(() => {});
                }
            }).catch(() => {});
        }
    }

    if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
        pushPrompted = true;
        if (
            Notification.permission === 'granted' &&
            typeof navigator !== 'undefined' &&
            'serviceWorker' in navigator &&
            typeof window !== 'undefined' &&
            window.location &&
            !window.location.hostname.includes('.vercel.app')
        ) {
            navigator.serviceWorker.ready.then(reg => {
                if (reg) subscribeUserToPush(reg, true);
            }).catch(() => {});
        }
    }

    if (pushListenersBound) return;
    pushListenersBound = true;

    const i18n = (typeof window !== 'undefined' && window.i18next) || (typeof i18next !== 'undefined' ? i18next : null);
    if (i18n && typeof i18n.on === 'function') {
        let lastSyncedPushLang = getRuntimeSiteLang();
        i18n.on('languageChanged', () => {
            const nextLang = getRuntimeSiteLang();
            if (nextLang === lastSyncedPushLang) return;
            lastSyncedPushLang = nextLang;

            if (typeof window === 'undefined' || !window.apiClient || typeof window.apiClient.post !== 'function') return;
            const activeUser = getRuntimeUser();
            const fp = getRuntimeFingerprint();
            const store = getRuntimeStorage();
            const endpoint = (store && typeof store.get === 'function') ? store.get('pushSubEndpoint', '') : '';
            if (!activeUser && !fp && !endpoint) return;

            window.apiClient.post('/api/push/sync-lang', {
                lang: nextLang,
                userId: activeUser ? activeUser.id : null,
                deviceId: fp || null,
                clientId: fp || null,
                endpoint: endpoint || null
            }, { timeout: 6000, retries: 0 }).catch(() => {});
        });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('appinstalled', async () => {
            markPwaInstalled();
            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => unsubscribeExistingPush(reg)).catch(() => {});
            }
        });
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('click', (e) => {
            if (pushPrompted) return;

            const isPwa = isPwaStandalone();
            const pwaInstalled = isPwa || checkIsPwaInstalled();
            if (!isPwa && pwaInstalled) {
                pushPrompted = true;
                return;
            }

            if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
                pushPrompted = true;
                return;
            }

            const openModal = document.querySelector('.modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"], #cartSidebar.active, .swal2-container');
            if (openModal) return;
            const target = /** @type {Element | null} */ (e.target);
            if (target && target.closest && target.closest('.item-card')) return;
            if (target && target.closest && target.closest('.bottom-nav, #cartBtn, #profileBtn, button, a')) return;

            pushPrompted = true;
            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    subscribeUserToPush(reg);
                }).catch(() => {});
            }
        }, { passive: true });
    }
}

/**
 * Resets internal pushPrompted flag for unit tests.
 */
export function resetPushPromptTestState() {
    pushPrompted = false;
    inFlightSubscribeSync = null;
    inFlightSubscribeKey = '';
    clearPushSyncMeta();
}

registerActions({
    isPwaStandalone,
    checkIsPwaInstalled,
    syncNotificationPermission,
    subscribeUserToPush
});
