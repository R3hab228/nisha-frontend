// @ts-check
// ==========================================
// NISHA STORE - REAL USER MONITORING (RUM)
// js/core/rum.js - Web Vitals v5 & Real Client Speed Telemetry
// ==========================================
// Monitors via official Google `web-vitals` v5 (bfcache, hidden-tab & soft-nav safe):
// - LCP (Largest Contentful Paint)
// - INP (Interaction to Next Paint)
// - CLS (Cumulative Layout Shift)
// - TTFB (Time to First Byte)
// - FCP (First Contentful Paint)
// - Device Category (iOS, Android, Desktop) & Connection Type
// Zero LCP/TBT overhead: loaded lazily inside the deferred `app-analytics` chunk.

import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

/**
 * @typedef {{
 *   lcp: number | null,
 *   inp: number | null,
 *   cls: number,
 *   ttfb: number | null,
 *   fcp: number | null,
 *   ratings: Record<string, string>,
 *   device: string,
 *   connection: string,
 *   url: string
 * }} RumMetrics
 */

/** @type {RumMetrics} */
const rumData = {
    lcp: null,
    inp: null,
    cls: 0,
    ttfb: null,
    fcp: null,
    ratings: {},
    device: 'Desktop',
    connection: 'unknown',
    url: '/'
};

let hasReported = false;
let isInitialized = false;
let lastReportedSig = '';

// Detect device category safely
function detectDevice() {
    if (typeof navigator === 'undefined') return 'Desktop';
    const ua = navigator.userAgent || '';
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    if (/iPad|iPhone|iPod/.test(ua) || ((platform === 'MacIntel' || platform === 'macOS') && navigator.maxTouchPoints > 1)) {
        return 'iOS';
    }
    if (/Android/i.test(ua)) {
        return 'Android';
    }
    return 'Desktop';
}

// Detect network connection type if supported
function detectConnection() {
    if (typeof navigator !== 'undefined' && navigator.connection && navigator.connection.effectiveType) {
        return navigator.connection.effectiveType;
    }
    return 'unknown';
}

// Measure TTFB fallback via Navigation Timing API (Level 2) for synchronous reads before web-vitals fires
function measureTTFB() {
    try {
        if (rumData.ttfb !== null || typeof performance === 'undefined') return;
        const navEntries = performance.getEntriesByType('navigation');
        const navEntry = /** @type {PerformanceNavigationTiming | undefined} */ (navEntries && navEntries.at(-1));
        if (navEntry && Number.isFinite(navEntry.responseStart) && navEntry.responseStart > 0) {
            rumData.ttfb = Math.round(navEntry.responseStart);
        }
    } catch {}
}

// Initialize official Google web-vitals v5 observers (handles bfcache, hidden tabs & accurate CLS/INP windows)
function initWebVitalsObservers() {
    if (typeof window === 'undefined') return;

    try {
        onLCP((metric) => {
            if (Number.isFinite(metric.value)) {
                rumData.lcp = Math.round(metric.value);
                if (metric.rating) rumData.ratings.lcp = metric.rating;
            }
        }, { reportAllChanges: true });
    } catch {}

    try {
        onCLS((metric) => {
            if (Number.isFinite(metric.value)) {
                rumData.cls = Number(metric.value.toFixed(4));
                if (metric.rating) rumData.ratings.cls = metric.rating;
            }
        }, { reportAllChanges: true });
    } catch {}

    try {
        onINP((metric) => {
            if (Number.isFinite(metric.value)) {
                rumData.inp = Math.round(metric.value);
                if (metric.rating) rumData.ratings.inp = metric.rating;
            }
        }, { reportAllChanges: true });
    } catch {}

    try {
        onTTFB((metric) => {
            if (Number.isFinite(metric.value)) {
                rumData.ttfb = Math.round(metric.value);
                if (metric.rating) rumData.ratings.ttfb = metric.rating;
            }
        });
    } catch {}

    try {
        onFCP((metric) => {
            if (Number.isFinite(metric.value)) {
                rumData.fcp = Math.round(metric.value);
                if (metric.rating) rumData.ratings.fcp = metric.rating;
            }
        });
    } catch {}
}

// Safely send RUM payload to backend
function sendRumReport(reason = 'scheduled') {
    try {
        measureTTFB();

        // Do not report if no vitals are measured yet
        if (rumData.lcp === null && rumData.ttfb === null && rumData.cls === 0 && rumData.inp === null && rumData.fcp === null) {
            return false;
        }

        rumData.device = detectDevice();
        rumData.connection = detectConnection();
        rumData.url = (typeof window !== 'undefined' && window.location) ? window.location.pathname : '/';

        // Deduplication: do not re-send identical vitals unless triggered manually
        const payloadSig = `${rumData.lcp}_${rumData.inp}_${rumData.cls}_${rumData.ttfb}_${rumData.fcp}`;
        if (payloadSig === lastReportedSig && reason !== 'manual' && reason !== 'manual_test') {
            return false;
        }

        const payload = {
            lcp: rumData.lcp,
            inp: rumData.inp,
            cls: rumData.cls,
            ttfb: rumData.ttfb,
            fcp: rumData.fcp,
            ratings: rumData.ratings,
            device: rumData.device,
            connection: rumData.connection,
            url: rumData.url,
            reason
        };

        const jsonStr = JSON.stringify(payload);
        const backendUrl = (typeof window !== 'undefined' && window.BACKEND_URL)
            ? String(window.BACKEND_URL).replace(/\/+$/, '')
            : 'https://nisha-api.onrender.com';

        const isProdDomain = typeof window !== 'undefined' && window.location && (
            window.location.hostname.includes('nisha-store.shop') ||
            window.location.hostname.includes('vercel.app')
        );
        const endpoint = isProdDomain ? '/api/rum' : `${backendUrl}/api/rum`;

        // Modern transport: fetch with keepalive: true with sync & async beacon fallback
        let fetchAttempted = false;
        if (typeof fetch === 'function') {
            try {
                fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: jsonStr,
                    keepalive: true
                }).catch(() => {
                    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                        try {
                            const blob = new Blob([jsonStr], { type: 'application/json' });
                            navigator.sendBeacon(endpoint, blob);
                        } catch (_) {
                            navigator.sendBeacon(endpoint, jsonStr);
                        }
                    }
                });
                fetchAttempted = true;
            } catch (_) {
                fetchAttempted = false;
            }
        }
        if (!fetchAttempted && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            try {
                const blob = new Blob([jsonStr], { type: 'application/json' });
                navigator.sendBeacon(endpoint, blob);
            } catch (_) {
                navigator.sendBeacon(endpoint, jsonStr);
            }
        }

        lastReportedSig = payloadSig;
        hasReported = true;
        return true;
    } catch (_) {
        return false;
    }
}

function initRUM() {
    if (isInitialized || typeof window === 'undefined') return;
    isInitialized = true;

    rumData.device = detectDevice();
    rumData.connection = detectConnection();

    // 1. Measure TTFB immediately and on load
    measureTTFB();
    if (document.readyState === 'complete') {
        measureTTFB();
    } else {
        window.addEventListener('load', measureTTFB, { once: true, passive: true });
    }

    // 2. Start official web-vitals v5 observers
    initWebVitalsObservers();

    // 3. Safety timer: send report after 6 seconds of page load so even quiet sessions are logged
    const timer = setTimeout(() => {
        if (!hasReported) {
            sendRumReport('timer');
        }
    }, 6000);
    const timerObj = /** @type {any} */ (timer);
    if (timerObj && typeof timerObj.unref === 'function') {
        timerObj.unref();
    }

    // 4. Send updated vitals when user hides tab or navigates away
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            sendRumReport('visibility_hidden');
        }
    }, { passive: true });

    window.addEventListener('pagehide', () => {
        sendRumReport('pagehide');
    }, { passive: true });
}

// Expose RUM API globally for debugging & vitest
export const rumApi = {
    initRUM,
    getMetrics: () => ({ ...rumData, ratings: { ...rumData.ratings } }),
    sendRumReport,
    rumData
};

if (typeof window !== 'undefined') {
    window.__nishaRUM = rumApi;
    window.getRumMetrics = rumApi.getMetrics;
    initRUM();
}

export { initRUM, sendRumReport, rumData };
export default rumApi;
