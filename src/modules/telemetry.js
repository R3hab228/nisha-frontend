// ==========================================
// NISHA STORE - MODULAR TELEMETRY & PWA FACADE
// Safe, typed ES module exports for client error logging & PWA
// ==========================================

/**
 * Captures error and dispatches telemetry event / logs to console
 * @param {Error|string|any} err
 * @param {Record<string, any>} [context={}]
 */
export function captureError(err, context = {}) {
    if (typeof window !== 'undefined' && typeof window.captureError === 'function') {
        return window.captureError(err, context);
    }
    console.error('[Telemetry]', err, context);
}

/**
 * Alias for captureError
 */
export const reportError = captureError;

/**
 * Returns telemetry diagnostics object
 * @returns {any}
 */
export function getTelemetryInfo() {
    if (typeof window !== 'undefined' && window.__telemetry) {
        return window.__telemetry;
    }
    return null;
}

/**
 * Checks whether app is running as standalone installed PWA
 * @returns {boolean}
 */
export function isPwaStandalone() {
    if (typeof window !== 'undefined' && typeof window.isPwaStandalone === 'function') {
        return window.isPwaStandalone();
    }
    return false;
}

/**
 * Checks if PWA was previously installed
 * @returns {boolean}
 */
export function checkIsPwaInstalled() {
    if (typeof window !== 'undefined' && typeof window.checkIsPwaInstalled === 'function') {
        return window.checkIsPwaInstalled();
    }
    return false;
}

/**
 * Subscribes user to Web Push notifications
 * @returns {Promise<any>}
 */
export async function subscribeUserToPush() {
    if (typeof window !== 'undefined' && typeof window.subscribeUserToPush === 'function') {
        return window.subscribeUserToPush();
    }
    return null;
}

/**
 * Initializes mobile pull-to-refresh gesture
 * @param {HTMLElement} [container]
 */
export function initPwaPullToRefresh(container) {
    if (typeof window !== 'undefined' && typeof window.initPwaPullToRefresh === 'function') {
        return window.initPwaPullToRefresh(container);
    }
}
