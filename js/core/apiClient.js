// ==========================================
// NISHA STORE - PROTECTED API CLIENT (js/core/apiClient.js)
// ==========================================
// Единый защищенный транспортный уровень для общения с бэкендом:
// - Автоматические таймауты (AbortController) против зависаний при холодном старте Render
// - Умные повторы (Retry с экспоненциальной задержкой) при сетевых сбоях и статусах 408/429/502/503/504
// - Дедупликация идентичных параллельных запросов (In-Flight Deduplication)
// - Ключи идемпотентности (Idempotency Key) для критических транзакций (заказы, предложки)
// - Безопасный парсинг JSON без падений при HTML-страницах ошибок прокси/Cloudflare

(function () {
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

    function resolveUrl(endpoint) {
        if (!endpoint) return getBaseUrl();
        const str = String(endpoint).trim();
        if (/^https?:\/\//i.test(str)) return str;
        const cleanPath = str.startsWith('/') ? str : '/' + str;
        return getBaseUrl() + cleanPath;
    }

    function generateIdempotencyKey(prefix = 'req') {
        const rand = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
            : (typeof window !== 'undefined' && typeof window.generateShortId === 'function'
                ? window.generateShortId(8)
                : Date.now().toString(36));
        return `${prefix}_${Date.now()}_${rand}`;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function isFormDataBody(body) {
        return typeof FormData !== 'undefined' && body instanceof FormData;
    }

    function createTimeoutSignal(timeoutMs, externalSignal) {
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
            const timeoutSig = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : null;
            let signal = timeoutSig || externalSignal || undefined;
            if (timeoutSig && externalSignal) {
                signal = typeof AbortSignal.any === 'function'
                    ? AbortSignal.any([externalSignal, timeoutSig])
                    : timeoutSig;
            }
            return {
                signal,
                isTimedOut: () => Boolean(timeoutSig && timeoutSig.aborted),
                cleanup: () => {}
            };
        }

        const controller = new AbortController();
        let timedOut = false;

        const timerId = timeoutMs > 0
            ? setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, timeoutMs)
            : null;

        const onExternalAbort = () => {
            if (timerId) clearTimeout(timerId);
            controller.abort();
        };

        if (externalSignal) {
            if (externalSignal.aborted) {
                if (timerId) clearTimeout(timerId);
                controller.abort();
            } else {
                externalSignal.addEventListener('abort', onExternalAbort, { once: true });
            }
        }

        const cleanup = () => {
            if (timerId) clearTimeout(timerId);
            if (externalSignal) {
                externalSignal.removeEventListener('abort', onExternalAbort);
            }
        };

        return {
            signal: controller.signal,
            isTimedOut: () => timedOut,
            cleanup
        };
    }

    /**
     * Низкоуровневый защищенный запрос с поддержкой таймаута и авто-повтора.
     * Возвращает нативный объект Response.
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
                const sb = window._supabase || (typeof window.getSupabase === 'function' ? window.getSupabase() : null);
                if (sb && sb.auth && typeof sb.auth.getSession === 'function') {
                    const sess = await sb.auth.getSession();
                    const tok = sess && sess.data && sess.data.session && sess.data.session.access_token;
                    if (tok) {
                        headers.set('Authorization', `Bearer ${tok}`);
                    }
                }
            } catch (authErr) {}
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
                    await sleep(waitMs);
                    continue;
                }

                return response;
            } catch (err) {
                cleanup();

                // Если запрос был отменен внешним AbortController пользователя — не повторяем
                if (options.signal && options.signal.aborted && !isTimedOut()) {
                    throw err;
                }

                if (isTimedOut()) {
                    const timeoutErr = new Error('Превышено время ожидания ответа от сервера');
                    timeoutErr.name = 'AbortError';
                    timeoutErr.isTimeout = true;
                    lastError = timeoutErr;
                } else {
                    err.isNetworkError = true;
                    lastError = err;
                }

                if (attempt < maxRetries) {
                    await sleep(baseRetryDelay * (attempt + 1));
                    continue;
                }
                throw lastError;
            }
        }

        throw lastError || new Error('Ошибка сети при обращении к серверу');
    }

    /**
     * Безопасное чтение JSON из ответа сервера
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
                } catch (e) {}
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
                const httpErr = new Error(errMessage);
                httpErr.status = response.status;
                httpErr.data = data;
                throw httpErr;
            }

            if (data && data._nonJson && !response.ok) {
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

    function get(endpoint, options = {}) {
        return request(endpoint, { ...options, method: 'GET' });
    }

    function post(endpoint, body = {}, options = {}) {
        return request(endpoint, { ...options, method: 'POST', body });
    }

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

    const apiClient = {
        getBaseUrl,
        resolveUrl,
        generateIdempotencyKey,
        fetchRaw,
        request,
        get,
        post,
        postForm,
        ping
    };

    window.apiClient = apiClient;
    window.apiRequest = request;
    if (typeof globalThis !== 'undefined') {
        globalThis.apiClient = apiClient;
        globalThis.apiRequest = request;
    }
})();
