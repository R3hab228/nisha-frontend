// ==========================================
// NISHA STORE - REAL USER MONITORING (RUM)
// js/core/rum.js - Web Vitals & Real Client Speed Telemetry
// ==========================================
// Monitors:
// - LCP (Largest Contentful Paint)
// - INP (Interaction to Next Paint / Event Timing & First Input)
// - CLS (Cumulative Layout Shift)
// - TTFB (Time to First Byte)
// - Device Category (iOS, Android, Desktop) & Connection Type
// Zero overhead: uses native PerformanceObserver with buffered: true

(function () {
    const rumData = {
        lcp: null,
        inp: null,
        cls: 0,
        ttfb: null,
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
        if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
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

    // Measure TTFB via Navigation Timing API (Level 2)
    function measureTTFB() {
        try {
            if (typeof performance === 'undefined') return;
            const navEntries = performance.getEntriesByType('navigation');
            if (navEntries && navEntries.length > 0 && Number.isFinite(navEntries[0].responseStart)) {
                rumData.ttfb = Math.round(navEntries[0].responseStart);
                return;
            }
            if (performance.timing && performance.timing.responseStart && performance.timing.requestStart) {
                const diff = performance.timing.responseStart - performance.timing.requestStart;
                if (diff >= 0 && diff < 60000) {
                    rumData.ttfb = Math.round(diff);
                }
            }
        } catch (_) {}
    }

    // Initialize PerformanceObservers for Core Web Vitals
    function initObservers() {
        if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

        // 1. LCP (Largest Contentful Paint)
        try {
            const lcpObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                if (entries.length > 0) {
                    const lastEntry = entries[entries.length - 1];
                    rumData.lcp = Math.round(lastEntry.startTime);
                }
            });
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (_) {}

        // 2. CLS (Cumulative Layout Shift)
        try {
            const clsObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    if (!entry.hadRecentInput) {
                        rumData.cls = Number((rumData.cls + entry.value).toFixed(4));
                    }
                }
            });
            clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (_) {}

        // 3. INP (Interaction to Next Paint) & First Input Delay
        const handleInputEntry = (entryList) => {
            for (const entry of entryList.getEntries()) {
                const duration = entry.duration || (entry.processingStart - entry.startTime);
                if (Number.isFinite(duration)) {
                    rumData.inp = Math.round(Math.max(rumData.inp || 0, duration));
                }
            }
        };

        // Modern Event Timing (INP) with durationThreshold
        try {
            const eventObserver = new PerformanceObserver(handleInputEntry);
            eventObserver.observe({ type: 'event', durationThreshold: 40, buffered: true });
        } catch (_) {}

        // Universal first-input fallback (FID / Initial Interaction)
        try {
            const fidObserver = new PerformanceObserver(handleInputEntry);
            fidObserver.observe({ type: 'first-input', buffered: true });
        } catch (_) {}
    }

    // Safely send RUM payload to backend
    function sendRumReport(reason = 'scheduled') {
        try {
            measureTTFB();

            // Do not report if no vitals are measured yet
            if (rumData.lcp === null && rumData.ttfb === null && rumData.cls === 0 && rumData.inp === null) {
                return false;
            }

            rumData.device = detectDevice();
            rumData.connection = detectConnection();
            rumData.url = (typeof window !== 'undefined' && window.location) ? window.location.pathname : '/';

            // Deduplication: do not re-send identical vitals unless triggered manually
            const payloadSig = `${rumData.lcp}_${rumData.inp}_${rumData.cls}_${rumData.ttfb}`;
            if (payloadSig === lastReportedSig && reason !== 'manual' && reason !== 'manual_test') {
                return false;
            }

            const payload = {
                lcp: rumData.lcp,
                inp: rumData.inp,
                cls: rumData.cls,
                ttfb: rumData.ttfb,
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

            // Modern transport: fetch with keepalive: true
            if (typeof fetch === 'function') {
                fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: jsonStr,
                    keepalive: true
                }).catch(() => {
                    // Fallback to beacon on network error
                    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                        try {
                            const blob = new Blob([jsonStr], { type: 'application/json' });
                            navigator.sendBeacon(endpoint, blob);
                        } catch (_) {
                            navigator.sendBeacon(endpoint, jsonStr);
                        }
                    }
                });
            } else if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
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

        // 2. Start Web Vitals Observers
        initObservers();

        // 3. Safety timer: send report after 6 seconds of page load so even quiet sessions are logged
        const timer = setTimeout(() => {
            if (!hasReported) {
                sendRumReport('timer');
            }
        }, 6000);
        if (timer && typeof timer.unref === 'function') {
            timer.unref();
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
    const rumApi = {
        initRUM,
        getMetrics: () => ({ ...rumData }),
        sendRumReport,
        rumData
    };

    if (typeof window !== 'undefined') {
        window.__nishaRUM = rumApi;
        window.getRumMetrics = rumApi.getMetrics;
        // Auto-initialize in browser
        initRUM();
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = rumApi;
    }
})();
