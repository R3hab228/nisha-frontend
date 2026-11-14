// ==========================================
// NISHA STORE - MODULAR TELEMETRY & PWA FACADE
// Safe, typed ES module exports for client error logging & PWA
// ==========================================

import { callAction, callAsyncAction } from './_facade.js';

/**
 * Captures error and dispatches telemetry event / logs to console
 * @param {Error|string|any} err
 * @param {Record<string, any>} [context={}]
 */
export function captureError(err, context = {}) {
    return callAction('captureError', [err, context], (e, ctx) => {
        console.error('[Telemetry]', e, ctx);
    });
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
    return callAction('isPwaStandalone', [], () => false);
}

/**
 * Checks if PWA was previously installed
 * @returns {boolean}
 */
export function checkIsPwaInstalled() {
    return callAction('checkIsPwaInstalled', [], () => false);
}

/**
 * Subscribes user to Web Push notifications
 * @returns {Promise<any>}
 */
export function subscribeUserToPush() {
    return callAsyncAction('subscribeUserToPush', [], () => null);
}

/**
 * Synchronizes notification permissions with system
 * @returns {Promise<string>}
 */
export function syncNotificationPermission() {
    return callAsyncAction('syncNotificationPermission', [], () => 'default');
}

/**
 * Handles offline network state
 */
export function handleNetworkOffline() {
    return callAction('handleNetworkOffline');
}

/**
 * Handles online network recovery state
 */
export function handleNetworkOnline() {
    return callAction('handleNetworkOnline');
}

/**
 * Dismisses network error banner
 */
export function dismissNetError() {
    return callAction('dismissNetError');
}

/**
 * Initializes mobile pull-to-refresh gesture
 * @param {HTMLElement} [container]
 */
export function initPwaPullToRefresh(container) {
    return callAction('initPwaPullToRefresh', [container]);
}

/**
 * Evaluates telemetry client error severity on a 1-10 scale
 * @param {Record<string, any>} [params={}]
 * @returns {{ score: number, level: string, emoji: string, reason: string }}
 */
export function evaluateTelemetrySeverity(params = {}) {
    return callAction('evaluateClientErrorSeverity', [params], () => ({
        score: 4,
        level: 'Средняя',
        emoji: '🟡',
        reason: 'Некритичное предупреждение интерфейса'
    }));
}

/**
 * Returns Real User Monitoring (RUM) metrics
 * @returns {Record<string, any>}
 */
export function getRumMetrics() {
    return callAction('getRumMetrics', [], () => ({
        lcp: null,
        inp: null,
        cls: 0,
        ttfb: null,
        device: 'Desktop',
        connection: 'unknown',
        url: '/'
    }));
}

/**
 * Manually dispatches RUM metrics report
 * @param {string} [reason='manual']
 * @returns {boolean}
 */
export function sendRumReport(reason = 'manual') {
    if (typeof window !== 'undefined' && window.__nishaRUM && typeof window.__nishaRUM.sendRumReport === 'function') {
        return window.__nishaRUM.sendRumReport(reason);
    }
    return false;
}
