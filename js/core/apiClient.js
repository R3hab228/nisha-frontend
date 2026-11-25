// @ts-check
// ==========================================
// NISHA STORE - PROTECTED API CLIENT (js/core/apiClient.js)
// ==========================================
// Единый защищенный транспортный уровень для общения с бэкендом:
// - Автоматические таймауты (AbortController) против зависаний при холодном старте Render
// - Умные повторы (Retry с экспоненциальной задержкой) при сетевых сбоях и статусах 408/429/502/503/504
// - Дедупликация идентичных параллельных запросов (In-Flight Deduplication)
// - Ключи идемпотентности (Idempotency Key) для критических транзакций (заказы, предложки)
// - Безопасный парсинг JSON без падений при HTML-страницах ошибок прокси/Cloudflare

import { invokeAction, registerActions } from './action-registry.js';

const DEFAULT_BASE_URL = 'https://nisha-api.onrender.com';
    const DEFAULT_TIMEOUT_MS = 12000;
    const UPLOAD_TIMEOUT_MS = 45000;
    const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

    // Карта активных in-flight запросов для предотвращения дублирующего спама
    const inFlightRequests = new Map();

    function getBaseUrl() {
        const envUrl = window.ENV && window.ENV.API_BASE_URL;
        return String(envUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    }

    /** @param {string} endpoint */
    function resolveUrl(endpoint) {
        if (!endpoint) return getBaseUrl();
        const str = String(endpoint).trim();
        if (/^https?:\/\//i.test(str)) return str;
        const cleanPath = str.startsWith('/') ? str : '/' + str;
        return getBaseUrl() + cleanPath;
    }

    function generateIdempotencyKey(prefix = 'req') {
        const rand = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID().replaceAll('-', '').slice(0, 10)
            : (invokeAction('generateShortId', 8) || Date.now().toString(36));
        return `${prefix}_${Date.now()}_${rand}`;
    }

    /** @param {number} ms */
    function waitMsDelay(ms) {
        const g = /** @type {any} */ (globalThis);
        if (typeof g.sleep === 'function') {
            return g.sleep(ms);
        }
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /** @param {unknown} body */
    function isFormDataBody(body) {
        return typeof FormData !== 'undefined' && body instanceof FormData;
    }

    /** @param {number} timeoutMs @param {AbortSignal | null | undefined} externalSignal */
    function createTimeoutSignal(timeoutMs, externalSignal) {
        const hasNativeTimeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function';
        /** @type {AbortSignal | null} */
        let timeoutSig = null;
        /** @type {ReturnType<typeof setTimeout> | null} */
        let fallbackTimer = null;
        let timedOut = false;

        if (timeoutMs > 0) {
            if (hasNativeTimeout) {
                timeoutSig = AbortSignal.timeout(timeoutMs);
            } else if (typeof AbortController !== 'undefined') {
                const fallbackCtrl = new AbortController();
                fallbackTimer = setTimeout(() => {
                    timedOut = true;
                    const err = new Error('Превышено время ожидания ответа от сервера');
                    err.name = 'TimeoutError';
                    fallbackCtrl.abort(err);
                }, timeoutMs);
                timeoutSig = fallbackCtrl.signal;
            }
        }

        let signal;
        if (externalSignal && timeoutSig) {
            if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
                signal = AbortSignal.any([externalSignal, timeoutSig]);
            } else if (typeof AbortController !== 'undefined') {
                const combinedCtrl = new AbortController();
                const forward = (/** @type {AbortSignal} */ src) => {
                    if (!combinedCtrl.signal.aborted) combinedCtrl.abort(src.reason);
                };
                if (externalSignal.aborted) forward(externalSignal);
                else externalSignal.addEventListener('abort', () => forward(externalSignal), { once: true });
                if (timeoutSig.aborted) forward(timeoutSig);
                else timeoutSig.addEventListener('abort', () => forward(timeoutSig), { once: true });
                signal = combinedCtrl.signal;
            } else {
                signal = externalSignal;
            }
        } else {
            signal = externalSignal || timeoutSig || undefined;
        }

        return {
            signal,
            isTimedOut: () => timedOut || Boolean(timeoutSig?.aborted),
            cleanup: () => {
                if (fallbackTimer) {
                    clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                }
            }
        };
    }

    /**
     * Низкоуровневый защищенный запрос с поддержкой таймаута и авто-повтора.
     * Возвращает нативный объект Response.
     * @param {string} endpoint
     * @param {Record<string, any>} [options]
     */
    async function fetchRaw(endpoint, options = {}) {
        const url = resolveUrl(endpoint);
        const method = String(options.method || 'GET').toUpperCase();
        const isUpload = isFormDataBody(options.body);
        const timeoutMs = typeof options.timeout === 'number'
            ? options.timeout
            : (isUpload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

        const maxRetries = typeof options.retries === 'number'
            ? Math.max(0, options.retries)
            : (method === 'GET' ? 2 : 0);

        const baseRetryDelay = typeof options.retryDelay === 'number' ? options.retryDelay : 1200;

        const headers = new Headers(options.headers || {});
        let finalBody = options.body;

        // Автоматическая передача JWT токена текущей авторизованной сессии Supabase (защита от IDOR/BOLA)
        if (!headers.has('Authorization') && typeof window !== 'undefined') {
            try {
                const sb = window._supabase || invokeAction('getSupabase');
                if (sb && sb.auth && typeof sb.auth.getSession === 'function') {
                    const sess = await sb.auth.getSession();
                    const tok = sess && sess.data && sess.data.session && sess.data.session.access_token;
                    if (tok) {
                        headers.set('Authorization', `Bearer ${tok}`);
                    }
                }
            } catch {}
        }

        if (finalBody !== undefined && finalBody !== null && !isUpload) {
            if (typeof finalBody === 'object' && !(finalBody instanceof Blob) && !(finalBody instanceof URLSearchParams)) {
                if (options.idempotencyKey && finalBody && typeof finalBody === 'object' && !Array.isArray(finalBody) && !finalBody.idempotencyKey) {
                    finalBody = { ...finalBody, idempotencyKey: options.idempotencyKey };
                }
                finalBody = JSON.stringify(finalBody);
                if (!headers.has('Content-Type')) {
                    headers.set('Content-Type', 'application/json');
                }
            }
            if (!headers.has('Accept')) {
                headers.set('Accept', 'application/json');
            }
        }

        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const { signal, isTimedOut, cleanup } = createTimeoutSignal(timeoutMs, options.signal);

            try {
                /** @type {RequestInit} */
                const fetchOpts = {
                    method,
                    headers,
                    signal
                };
                if (finalBody !== undefined && finalBody !== null && method !== 'GET' && method !== 'HEAD') {
                    fetchOpts.body = finalBody;
                }
                if (options.cache) fetchOpts.cache = options.cache;
                if (options.credentials) fetchOpts.credentials = options.credentials;
                if (options.mode) fetchOpts.mode = options.mode;
                if (options.keepalive) fetchOpts.keepalive = options.keepalive;

                const response = await fetch(url, fetchOpts);
                cleanup();

                if (!response.ok && RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
                    const waitMs = response.status === 429 ? Math.max(2500, baseRetryDelay * (attempt + 1)) : baseRetryDelay * (attempt + 1);
                    await waitMsDelay(waitMs);
                    continue;
                }

                return response;
            } catch (err) {
                cleanup();

                // Если запрос был отменен внешним AbortController пользователя — не повторяем
                if (options.signal && options.signal.aborted && !isTimedOut()) {
                    throw err;
                }

                const errObj = /** @type {any} */ (err);
                if (isTimedOut() || errObj?.name === 'TimeoutError') {
                    /** @type {Error & { isTimeout?: boolean }} */
                    const timeoutErr = new Error('Превышено время ожидания ответа от сервера');
                    timeoutErr.name = 'AbortError';
                    timeoutErr.isTimeout = true;
                    lastError = timeoutErr;
                } else {
                    if (errObj && typeof errObj === 'object') errObj.isNetworkError = true;
                    lastError = err;
                }

                if (attempt < maxRetries) {
                    await waitMsDelay(baseRetryDelay * (attempt + 1));
                    continue;
                }
                throw lastError;
            }
        }

        throw lastError || new Error('Ошибка сети при обращении к серверу');
    }

    /**
     * Безопасное чтение JSON из ответа сервера
     * @param {Response} response
     */
    async function parseResponseSafe(response) {
        const text = await response.text();
        if (!text || !text.trim()) {
            return { success: response.ok, _status: response.status };
        }
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
                try {
                    Object.defineProperty(parsed, '_status', { value: response.status, enumerable: false });
                    Object.defineProperty(parsed, '_ok', { value: response.ok, enumerable: false });
                } catch {}
            }
            return parsed;
        } catch (parseErr) {
            return {
                success: false,
                _status: response.status,
                _ok: false,
                _nonJson: true,
                rawText: text.slice(0, 300),
                message: `Ошибка сервера (HTTP ${response.status})`
            };
        }
    }

    /**
     * Основной метод выполнения API-запроса с парсингом JSON и опциональной дедупликацией
     * @param {string} endpoint
     * @param {Record<string, any>} [options]
     */
    async function request(endpoint, options = {}) {
        const url = resolveUrl(endpoint);
        const method = String(options.method || 'GET').toUpperCase();
        const shouldDedupe = Boolean(options.dedupe);

        let dedupeKey = null;
        if (shouldDedupe && !isFormDataBody(options.body)) {
            const bodyHash = options.body
                ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
                : '';
            dedupeKey = `${method}:${url}:${bodyHash}`;
            if (inFlightRequests.has(dedupeKey)) {
                return inFlightRequests.get(dedupeKey);
            }
        }

        const executePromise = (async () => {
            const response = await fetchRaw(url, options);
            const data = await parseResponseSafe(response);

            if (options.throwOnHttpError && !response.ok) {
                const errMessage = (data && (data.message || data.error)) || `Сетевая ошибка HTTP ${response.status}`;
                /** @type {Error & { status?: number, data?: any }} */
                const httpErr = new Error(errMessage);
                httpErr.status = response.status;
                httpErr.data = data;
                throw httpErr;
            }

            if (data && data._nonJson && !response.ok) {
                /** @type {Error & { status?: number, data?: any }} */
                const nonJsonErr = new Error(data.message || `Ошибка сервера HTTP ${response.status}`);
                nonJsonErr.status = response.status;
                nonJsonErr.data = data;
                throw nonJsonErr;
            }

            return data;
        })();

        if (dedupeKey) {
            inFlightRequests.set(dedupeKey, executePromise);
            executePromise.finally(() => {
                inFlightRequests.delete(dedupeKey);
            }).catch(() => {});
        }

        return executePromise;
    }

    /** @param {string} endpoint @param {Record<string, any>} [options] */
    function get(endpoint, options = {}) {
        return request(endpoint, { ...options, method: 'GET' });
    }

    /** @param {string} endpoint @param {any} [body] @param {Record<string, any>} [options] */
    function post(endpoint, body = {}, options = {}) {
        return request(endpoint, { ...options, method: 'POST', body });
    }

    /** @param {string} endpoint @param {FormData} formData @param {Record<string, any>} [options] */
    function postForm(endpoint, formData, options = {}) {
        return request(endpoint, {
            timeout: UPLOAD_TIMEOUT_MS,
            retries: 2,
            retryDelay: 1500,
            ...options,
            method: 'POST',
            body: formData
        });
    }

    function ping() {
        return fetchRaw('/ping', {
            method: 'GET',
            cache: 'no-store',
            timeout: 8000,
            retries: 0
        }).catch(() => null);
    }

    let lastPingTime = 0;
    const PING_COOLDOWN_MS = 4 * 60 * 1000; // 4 минуты кулдаун между пингами

    function warmupBackendServer(force = false) {
        const now = Date.now();
        if (!force && (now - lastPingTime < PING_COOLDOWN_MS)) return null;
        lastPingTime = now;
        if (typeof apiClient !== 'undefined' && typeof apiClient.ping === 'function') {
            return apiClient.ping();
        }
        return ping();
    }

    const apiClient = {
        getBaseUrl,
        resolveUrl,
        generateIdempotencyKey,
        fetchRaw,
        request,
        get,
        post,
        postForm,
        ping,
        warmup: warmupBackendServer
    };

    window.apiClient = apiClient;
    window.warmupBackendServer = warmupBackendServer;
    registerActions({
        apiRequest: request,
        warmupBackendServer
    });
    if (typeof globalThis !== 'undefined') {
        const g = /** @type {any} */ (globalThis);
        g.apiClient = apiClient;
        g.apiRequest = request;
        g.warmupBackendServer = warmupBackendServer;
    }

    // Фоновый прогрев при входе на сайт (в моменты простоя браузера, не тормозит загрузку каталога)
    if (typeof window !== 'undefined') {
        if ('requestIdleCallback' in window) {
            setTimeout(() => requestIdleCallback(() => warmupBackendServer(), { timeout: 3000 }), 1200);
        } else {
            setTimeout(() => warmupBackendServer(), 2000);
        }
    }
