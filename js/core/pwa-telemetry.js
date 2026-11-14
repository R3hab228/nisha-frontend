// ==========================================
// NISHA HYBRID CLIENT-SIDE ERROR TELEMETRY (SENTRY + TELEGRAM LOGGER)
// ==========================================

import { invokeAction, registerActions } from './action-registry.js';
import { debugPwaLog } from './pwa-sw-versioning.js';

const earlySentryErrors = [];
const earlySentryCtrl = new AbortController();
export const reportedErrorHashes = new Set();
let telemetrySentCount = 0;
const MAX_SESSION_TELEMETRY = 5;
let telemetryListenersBound = false;

export const IGNORED_ERROR_PATTERNS = [
    /^Script error\.?$/i,
    /ResizeObserver loop/i,
    /Non-Error promise rejection/i,
    /Load failed/i,
    /Failed to fetch/i,
    /NetworkError/i,
    /The operation was aborted/i,
    /AbortError/i,
    /Transition was aborted/i,
    /Viewport size changed/i,
    /ViewTransition/i,
    /chrome-extension:\/\//i,
    /moz-extension:\/\//i,
    /safari-extension:\/\//i,
    /safari-web-extension:\/\//i,
    /extensions\//i,
    /challenges\.cloudflare\.com/i,
    /clarity\.ms/i,
    /tiktok/i,
    /_META/i,
    /IABInnerFrame/i,
    /IAB/i,
    /__gCrWeb/i,
    /__firefox__/i,
    /fb_xd_fragment/i,
    /database connection is closing/i,
    /IDBDatabase/i,
    /ethereum/i,
    /selectedAddress/i,
    /web3/i,
    /Blocked a frame with origin/i,
    /cross-origin frame/i,
    /Protocols, domains, and ports must match/i,
    /SecurityError.*cross-origin/i,
    /@context/i
];

/**
 * Redacts sensitive fields recursively from telemetry context objects.
 * @param {object} context
 * @returns {object}
 */
export function sanitizeContext(context) {
    if (!context || typeof context !== 'object') return {};
    const clean = {};
    const SENSITIVE_KEYS = /password|token|secret|pin|card|cvv|auth/i;
    for (const [k, v] of Object.entries(context)) {
        if (SENSITIVE_KEYS.test(k)) {
            clean[k] = '[REDACTED]';
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
            clean[k] = sanitizeContext(v);
        } else {
            clean[k] = v;
        }
    }
    return clean;
}

/**
 * Checks whether an error matches noisy/extension/third-party ignore patterns.
 * @param {string} msg
 * @param {string} stack
 * @param {string} source
 * @returns {boolean}
 */
export function isIgnoredError(msg, stack, source) {
    const text = String(msg || '') + ' ' + String(stack || '') + ' ' + String(source || '');
    if (/^Script error\.?$/i.test(String(msg || '').trim())) return true;
    return IGNORED_ERROR_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Extracts normalized pathname/location from URLs and filenames for telemetry reports.
 * @param {string} rawPath
 * @param {object} [context={}]
 * @returns {string}
 */
export function formatCleanLocation(rawPath, context = {}) {
    const raw = (context && context.filename) || rawPath || '';
    if (!raw) return 'index.html';
    try {
        const withoutHash = String(raw).split('#').at(0).split('?').at(0);
        if (withoutHash.startsWith('http://') || withoutHash.startsWith('https://')) {
            const canParse = (typeof URL !== 'undefined' && typeof URL.canParse === 'function')
                ? URL.canParse(withoutHash)
                : true;
            if (canParse) {
                const url = new URL(withoutHash);
                return url.pathname || '/';
            }
        }
        return withoutHash.slice(-60) || '/';
    } catch {
        return String(raw).split('#').at(0).split('?').at(0).slice(-60) || '/';
    }
}

/**
 * Resolves human-readable OS & browser fingerprint for client error logs.
 * @returns {string}
 */
export function getReadableDevice() {
    if (typeof navigator === 'undefined') return 'Неизвестно';
    const ua = navigator.userAgent || '';
    let os = 'Устройство';
    if (/iphone|ipad|ipod/i.test(ua)) os = '🍏 iOS';
    else if (/android/i.test(ua)) {
        const m = ua.match(/Android\s([0-9.]+)/i);
        os = m ? `🤖 Android ${m[1]}` : '🤖 Android';
    } else if (/windows/i.test(ua)) os = '💻 Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = '🍏 macOS';
    else if (/linux/i.test(ua)) os = '🐧 Linux';

    let browser = '';
    if (/brave/i.test(ua) || (typeof navigator !== 'undefined' && navigator.brave)) browser = 'Brave';
    else if (/chrome|crios/i.test(ua) && !/edg|opr|opera/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/edg/i.test(ua)) browser = 'Edge';
    else if (/opera|opr/i.test(ua)) browser = 'Opera';

    return `${os}${browser ? ' • ' + browser : ''}`;
}

/**
 * Detects runtime shell mode (PWA standalone, Telegram WebApp, or standard browser).
 * @returns {string}
 */
export function getAppMode() {
    if (typeof window === 'undefined') return '🌐 Веб-браузер';
    if (invokeAction('isPwaStandalone')) return '📱 PWA Standalone';
    if (window.Telegram?.WebApp?.initData || (typeof window.location !== 'undefined' && window.location.hash && window.location.hash.includes('tgWebAppData'))) {
        return '✈️ Telegram WebApp';
    }
    return '🌐 Web Browser';
}

/**
 * Formats non-internal telemetry context keys as a compact key=value summary.
 * @param {object} ctx
 * @returns {string}
 */
export function formatCleanContext(ctx) {
    if (!ctx || typeof ctx !== 'object') return '';
    const clean = {};
    for (const [k, v] of Object.entries(ctx)) {
        if (['_forceSend', 'source', 'filename', 'lineno', 'colno'].includes(k)) continue;
        if (v !== undefined && v !== null && v !== '') {
            clean[k] = v;
        }
    }
    if (Object.keys(clean).length === 0) return '';
    return Object.entries(clean).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
}

const SEVERITY_RULES = [
    {
        score: 10, level: 'Критическая', emoji: '💀', reason: 'Блокировка оформления заказа или оплаты',
        match: (t) => /create_?order|submit_?order|confirm_?order|make_?order|\/api\/orders|orderroutes|processorder|checkoutorder|oversell/i.test(t)
            || /payment|checkout_?error|novaposhta.*waybill|monobank|liqpay|fondy/i.test(t)
            || (/checkout/i.test(t) && /fail|error|fatal|cannot|uncaught|reject/i.test(t))
    },
    {
        score: 9, level: 'Критическая', emoji: '💀', reason: 'Сбой базы данных или блокировка корзины',
        match: (t) => /pgrst|postgrest|supabase.*deadlock|cart.*checkout|savecart|clearcart|item_reservations/i.test(t)
            || (/cart/i.test(t) && /uncaught|null|undefined|crash/i.test(t) && /order/i.test(t))
    },
    {
        score: 8, level: 'Высокая', emoji: '🔴', reason: 'Сбой авторизации или регистрации пользователей',
        match: (t) => /isregmode|toggle_?reg_?mode|handle_?auth|signin|signup|sign_in|sign_up|loginwithgoogle|google_?auth/i.test(t)
            || /check_?otp|generate_?secure_?otp|send_?otp|verify_?turnstile|checksession|auth\.js|app-profile/i.test(t)
            || (/login|register|profile/i.test(t) && /not defined|cannot read|uncaught/i.test(t))
    },
    {
        score: 7, level: 'Повышенная', emoji: '🟠', reason: 'Сбой каталога или карточки товара',
        match: (t) => /loadallitems|fetchitems|render_?catalog|openproductmodal|catalog\.js|product\.js|app-catalog|app-product/i.test(t)
            || (/catalog|items/i.test(t) && /cannot read|not defined|null|undefined/i.test(t))
    },
    {
        score: 6, level: 'Повышенная', emoji: '🟠', reason: 'Сбой поиска отделений Новой Почты или предложки',
        match: (t) => /novaposhta|searchcities|loadnpbranches|filternpbranches|propose_?item|drop\.js|app-drop|upload_?photo/i.test(t)
    },
    {
        score: 5, level: 'Средняя', emoji: '🟡', reason: 'Сбой вторичных функций (избранное, отзывы, история)',
        match: (t) => /togglefav|favorites|submitreview|reviews\.js|loaduserorders|switchordertab|orders\.js/i.test(t)
    },
    {
        score: 4, level: 'Средняя', emoji: '🟡', reason: 'Локальный сбой UI, фотогалереи или модальных окон',
        match: (t) => /photoswipe|photoswipelightbox|modal|openmodal|closemodal|windows\.js|gallery|zoom|tooltip|measurements/i.test(t)
    },
    {
        score: 3, level: 'Умеренная', emoji: '🟡', reason: 'Временный сбой сети или таймаут (автоповтор)',
        match: (t) => /failed to fetch|networkerror|network_error|load failed|timeout|etimedout|econnreset|502|503|504/i.test(t)
    },
    {
        score: 2, level: 'Низкая', emoji: '🟢', reason: 'Косметический сбой анимации, звуков или эффектов',
        match: (t) => /audiocontext|viewtransition|triggerhaptic|vibrate|tilt|vanillatilt|lenis|autoanimate|scroll|cursor/i.test(t)
    },
    {
        score: 1, level: 'Инфо', emoji: '⚪', reason: 'Фоновая аналитика или прерывание запроса',
        match: (t) => /aborterror|user aborted|resizeobserver|ttq|clarity|gtag|pixel|sentry|track/i.test(t)
    },
    {
        score: 6, level: 'Повышенная', emoji: '🟠', reason: 'Необработанное исключение выполнения JavaScript',
        match: (t) => /syntaxerror|referenceerror|typeerror/i.test(t)
    }
];

/**
 * Evaluates client error severity score (1-10) based on business impact.
 * @param {object} [params={}]
 * @returns {{score: number, level: string, emoji: string, reason: string}}
 */
export function evaluateClientErrorSeverity(params = {}) {
    const message = String(params.message || '');
    const location = String(params.location || '');
    const page = String(params.page || '');
    const stack = String(params.stack || '');
    const details = String(params.details || '');
    const fullText = `${message} ${location} ${page} ${stack} ${details}`.toLowerCase();

    for (const rule of SEVERITY_RULES) {
        if (rule.match(fullText)) {
            return { score: rule.score, level: rule.level, emoji: rule.emoji, reason: rule.reason };
        }
    }
    return { score: 4, level: 'Средняя', emoji: '🟡', reason: 'Некритичное предупреждение интерфейса' };
}

/**
 * Deduplicates, formats, and sends client error alerts to /api/support telemetry endpoint.
 * @param {any} errorObj
 * @param {object} [context={}]
 */
export function sendTelegramErrorAlert(errorObj, context = {}) {
    if (telemetrySentCount >= MAX_SESSION_TELEMETRY) return;

    const msg = String(errorObj && (errorObj.message || errorObj.reason || errorObj) || 'Unknown error');
    const stack = String(errorObj && errorObj.stack || '');
    const file = String(errorObj && (errorObj.filename || errorObj.source) || (typeof window !== 'undefined' && window.location ? window.location.href : ''));

    if (isIgnoredError(msg, stack, file)) return;

    const hash = `${msg.slice(0, 60)}_${file.slice(0, 40)}`;
    if (reportedErrorHashes.has(hash)) return;
    reportedErrorHashes.add(hash);
    telemetrySentCount++;

    const isLocal = typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocal && !context._forceSend) {
        console.warn('[TELEMETRY LOCAL DEV] Error intercepted:', msg, context);
        return;
    }

    const cleanCtx = sanitizeContext(context);
    const loc = formatCleanLocation(file, context) + (context && context.lineno && context.lineno > 0 ? `:${context.lineno}` : '');
    const cleanDetails = formatCleanContext(cleanCtx);
    let cleanPage = '/';
    if (typeof window !== 'undefined' && window.location) {
        try {
            cleanPage = window.location.pathname || '/';
            if (window.location.search && window.location.search.length < 40) {
                cleanPage += window.location.search;
            }
        } catch {}
    }

    const severity = evaluateClientErrorSeverity({
        message: msg,
        location: loc,
        page: cleanPage,
        stack,
        details: cleanDetails
    });

    const truncate = (str, len) => invokeAction('safeTruncateText', str, len) || str.slice(0, len);

    const alertMessage =
        `⚠️ [NISHA CLIENT ERROR ALERT]\n` +
        `• Опасность: ${severity.emoji} ${severity.score}/10 (${severity.level} — ${severity.reason})\n` +
        `• Ошибка: ${truncate(msg, 160)}\n` +
        `• Файл / Локация: ${loc}\n` +
        `• Страница: ${cleanPage}\n` +
        `• Устройство: ${getReadableDevice()}\n` +
        `• Режим: ${getAppMode()}` +
        (cleanDetails ? `\n• Детали: ${truncate(cleanDetails, 150)}` : '') +
        (stack && !stack.includes(msg) ? `\n• Стек: ${truncate(stack, 220)}` : '');

    const payload = {
        contact: '🚨 SYSTEM_TELEMETRY',
        message: alertMessage,
        clientId: 'telemetry_' + (typeof window !== 'undefined' && window.clientFingerprint ? window.clientFingerprint : Date.now())
    };

    try {
        if (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.post === 'function') {
            window.apiClient.post('/api/support', payload, { timeout: 8000, retries: 1 }).catch(() => {});
        } else if (typeof fetch === 'function') {
            fetch('https://nisha-api.onrender.com/api/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => {});
        }
    } catch {
        // Silent discard to avoid recursive crash
    }
}

/**
 * Buffers early uncaught errors prior to deferred Sentry initialization.
 * @param {ErrorEvent|PromiseRejectionEvent} evt
 */
export function recordEarlySentryError(evt) {
    const err = evt.error || evt.reason || evt.message || evt;
    if (isIgnoredError(err && (err.message || err.reason || err), err && err.stack, evt.filename || evt.source)) return;
    if (typeof window !== 'undefined' && !window._sentryActive && earlySentryErrors.length < 20) {
        earlySentryErrors.push(evt);
        initSentryDeferred();
    }
}

/**
 * Lazily loads Sentry SDK (with jsDelivr CDN fallback) and replays buffered early errors.
 */
export function initSentryDeferred() {
    if (typeof window === 'undefined' || window._sentryActive) return;
    window._sentryActive = true;

    const setupSentry = () => {
        if (typeof Sentry !== 'undefined' && Sentry.init) {
            try {
                Sentry.init({
                    dsn: 'https://13d63555c1c64605be8f9659af548581@o4511428929323008.ingest.de.sentry.io/4511428931682384',
                    release: 'nisha-store@1.0.0',
                    environment: (window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ? 'development' : 'production',
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
                        'AbortError: The play() request was interrupted',
                        'Transition was aborted because of invalid state. Viewport size changed',
                        'Transition was aborted',
                        'Viewport size changed',
                        "undefined is not an object (evaluating 'window._META.IABInnerFrame')",
                        "undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')",
                        '_META',
                        'IABInnerFrame',
                        'ethereum',
                        'selectedAddress',
                        'web3',
                        'Blocked a frame with origin',
                        'cross-origin frame',
                        'Protocols, domains, and ports must match',
                        'SecurityError: Blocked a frame with origin'
                    ],
                    denyUrls: [
                        /extensions\//i,
                        /^chrome-extension:\/\//i,
                        /^moz-extension:\/\//i
                    ]
                });
                debugPwaLog('[ SENTRY ] СИСТЕМА МОНИТОРИНГА АКТИВНА.');

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
            } catch {}
        }
    };

    if (typeof Sentry === 'undefined') {
        if (typeof loadExternalScript === 'function') {
            loadExternalScript('https://browser.sentry-cdn.com/8.38.0/bundle.min.js')
                .then(setupSentry)
                .catch(() => {
                    // Fallback на jsdelivr CDN, если sentry-cdn заблокирован адблоком
                    loadExternalScript('https://cdn.jsdelivr.net/npm/@sentry/browser@8.38.0/bundle.min.js')
                        .then(setupSentry)
                        .catch(() => {});
                });
        }
    } else {
        setupSentry();
    }
}

/**
 * Captures and reports errors to Sentry and Telegram telemetry logger.
 * @param {any} err
 * @param {object} [context={}]
 */
export function captureError(err, context = {}) {
    if (!err) return;

    if (typeof Sentry !== 'undefined' && Sentry.captureException) {
        try {
            Sentry.captureException(err, { extra: sanitizeContext(context) });
        } catch {}
    } else {
        console.warn('[ERROR CAPTURED]', err, context);
    }

    try {
        sendTelegramErrorAlert(err, context);
    } catch {}
}

/**
 * Binds window globals, error/rejection listeners, and deferred Sentry triggers.
 */
export function initTelemetry() {
    if (typeof window === 'undefined') return;
    window.evaluateClientErrorSeverity = evaluateClientErrorSeverity;
    window.captureError = captureError;
    window.reportError = captureError;
    window.__telemetry = {
        sendTelegramErrorAlert,
        sanitizeContext,
        isIgnoredError,
        reportedErrorHashes,
        formatCleanLocation,
        getReadableDevice,
        getAppMode
    };

    if (telemetryListenersBound || typeof window.addEventListener !== 'function') return;
    telemetryListenersBound = true;

    window.addEventListener('error', recordEarlySentryError, { signal: earlySentryCtrl.signal });
    window.addEventListener('unhandledrejection', recordEarlySentryError, { signal: earlySentryCtrl.signal });

    window.addEventListener('error', (evt) => {
        const err = evt.error || evt.message || evt;
        sendTelegramErrorAlert(err, { source: 'uncaught_window_error', filename: evt.filename, lineno: evt.lineno });
    });
    window.addEventListener('unhandledrejection', (evt) => {
        const err = evt.reason || evt;
        sendTelegramErrorAlert(err, { source: 'unhandled_promise_rejection' });
    });

    if ('requestIdleCallback' in window) {
        setTimeout(() => requestIdleCallback(initSentryDeferred, { timeout: 1000 }), 2500);
    } else {
        setTimeout(initSentryDeferred, 2500);
    }
    ['scroll', 'touchstart', 'pointerdown'].forEach(evt => {
        window.addEventListener(evt, initSentryDeferred, { once: true, passive: true });
    });
}

/**
 * Resets internal telemetry counters and hash sets for isolated unit tests.
 */
export function resetTelemetryTestState() {
    telemetrySentCount = 0;
    reportedErrorHashes.clear();
    earlySentryErrors.length = 0;
}

registerActions({
    captureError,
    sendTelegramErrorAlert
});
