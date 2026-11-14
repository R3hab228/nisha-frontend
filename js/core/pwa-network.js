// ==========================================
// NISHA PWA, SENTRY, PUSH & NETWORK ENTRYPOINT
// Modular ES barrel re-exporting all PWA & network submodules.
// ==========================================

import { initServiceWorkerUpdates } from './pwa-sw-versioning.js';
import { initTelemetry } from './pwa-telemetry.js';
import { initPwaLifecycle } from './pwa-lifecycle.js';
import { initPwaPush } from './pwa-push.js';
import { initPwaPullToRefresh } from './pwa-pull-refresh.js';

export * from './pwa-sw-versioning.js';
export * from './pwa-telemetry.js';
export * from './pwa-lifecycle.js';
export * from './pwa-push.js';
export * from './pwa-pull-refresh.js';

if (typeof window !== 'undefined') {
    window.initPwaPullToRefresh = initPwaPullToRefresh;
}

/**
 * Initializes SW updates, error telemetry, lifecycle listeners, Web Push, and pull-to-refresh.
 */
export function initPwaNetworkModule() {
    initServiceWorkerUpdates();
    initTelemetry();
    initPwaLifecycle();
    initPwaPush();
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
            document.addEventListener('DOMContentLoaded', initPwaPullToRefresh);
        } else {
            initPwaPullToRefresh();
        }
    }
}

initPwaNetworkModule();
