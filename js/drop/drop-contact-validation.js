// @ts-check
// ==========================================
// NISHA DROP: NON-BLOCKING PHONE & TELEGRAM CONTACT VALIDATOR
// ==========================================
// - Мгновенная синхронная проверка телефонов (UA + международные, отсев фейков) и формата Telegram @username
// - Асинхронная фоновая проверка существования @username через /api/verify-telegram-username
// - Дебаунс, AbortController, локальный TTL-кэш и дедупликация in-flight запросов — предложка никогда не зависает
// - Fail-open при сетевых сбоях/таймаутах: реальный пользователь никогда не будет заблокирован из-за недоступности t.me

const TELEGRAM_USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
const PHONE_CHARS_RE = /^[\d\s()+-]+$/;
const INVISIBLE_UNICODE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const UNICODE_DASH_RE = /[\u2012\u2013\u2014\u2015\u2212]/g;
const CONTACT_PREFIX_LABEL_RE = /^(?:tg|тг|telegram|телеграм|телеграмм|тел|tel|phone|телефон|номер)\s*[:\-]?\s+/i;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Очищает строку от невидимых Unicode-меток (копипаста из контактов iOS/Android/Viber) и нормализует тире/пробелы.
 * @param {unknown} raw
 * @returns {string}
 */
function cleanContactRaw(raw) {
    return String(raw || '')
        .replace(INVISIBLE_UNICODE_RE, '')
        .replace(UNICODE_DASH_RE, '-')
        .replace(/\u00A0/g, ' ')
        .trim();
}
const MAX_CACHE_ENTRIES = 200;
const DEFAULT_REMOTE_TIMEOUT_MS = 2800;

/** @typedef {{ exists: boolean | null, verified: boolean, username: string, ts: number }} CachedTgStatus */
/** @typedef {{ ok: boolean, kind: 'empty'|'phone'|'telegram'|'both'|'invalid', errorKey: string, tgUsername: string, phone: string }} ContactSyncResult */
/** @typedef {{ ok: boolean, errorKey: string, tgUsername: string, phone: string }} ContactVerifyResult */

/** @type {Map<string, CachedTgStatus>} */
const _tgStatusCache = new Map();
/** @type {Map<string, Promise<CachedTgStatus>>} */
const _inFlightTgChecks = new Map();

/** @type {ReturnType<typeof setTimeout> | null} */
let _bgDebounceTimer = null;
/** @type {AbortController | null} */
let _bgAbortController = null;
let _bgActiveUsernameKey = '';
let _bgGeneration = 0;

/**
 * Проверяет, не состоит ли хвост номера из одинаковых фейковых цифр (например 0000000 / 1111111).
 * @param {string} digits
 * @returns {boolean}
 */
function hasFakeRepeatedDigits(digits) {
    if (!digits) return true;
    if (/^(\d)\1+$/.test(digits)) return true;
    const subscriberTail = digits.length >= 7 ? digits.slice(-7) : digits;
    if (subscriberTail.length >= 7 && /^(\d)\1{6}$/.test(subscriberTail)) return true;
    return false;
}

/**
 * Проверяет и нормализует номер телефона (Украина и международные E.164).
 * @param {string} raw
 * @returns {{ valid: boolean, normalized: string }}
 */
export function validateProposalPhone(raw) {
    const trimmed = cleanContactRaw(raw);
    if (!trimmed || !PHONE_CHARS_RE.test(trimmed)) {
        return { valid: false, normalized: '' };
    }

    // Знак '+' допустим только один раз в самом начале
    const plusIdx = trimmed.indexOf('+');
    if (plusIdx > 0 || (plusIdx === 0 && trimmed.indexOf('+', 1) !== -1)) {
        return { valid: false, normalized: '' };
    }

    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
        return { valid: false, normalized: '' };
    }

    // Украинские форматы: +380XXXXXXXXX, 380XXXXXXXXX, 80XXXXXXXXX, 0XXXXXXXXX
    if (digits.startsWith('380')) {
        if (digits.length !== 12) return { valid: false, normalized: '' };
        if (!/^[3-9]$/.test(digits[3])) return { valid: false, normalized: '' };
        if (hasFakeRepeatedDigits(digits)) return { valid: false, normalized: '' };
        return { valid: true, normalized: `+${digits}` };
    }

    if (!hasPlus && digits.startsWith('80')) {
        if (digits.length !== 11) return { valid: false, normalized: '' };
        if (!/^[3-9]$/.test(digits[2])) return { valid: false, normalized: '' };
        if (hasFakeRepeatedDigits(digits)) return { valid: false, normalized: '' };
        return { valid: true, normalized: `+3${digits}` };
    }

    if (!hasPlus && digits.startsWith('0')) {
        if (digits.length !== 10) return { valid: false, normalized: '' };
        if (!/^[3-9]$/.test(digits[1])) return { valid: false, normalized: '' };
        if (hasFakeRepeatedDigits(digits)) return { valid: false, normalized: '' };
        return { valid: true, normalized: `+38${digits}` };
    }

    // Международный номер с явным '+' (кроме неполного +0... или +380..., уже отсечённого выше)
    if (hasPlus) {
        if (!/^[1-9]/.test(digits)) return { valid: false, normalized: '' };
        if (hasFakeRepeatedDigits(digits)) return { valid: false, normalized: '' };
        return { valid: true, normalized: `+${digits}` };
    }

    return { valid: false, normalized: '' };
}

/**
 * Извлекает и проверяет формат Telegram @username (или ссылки t.me/username).
 * @param {string} raw
 * @returns {{ valid: boolean, username: string }}
 */
export function extractTelegramUsername(raw) {
    const trimmed = cleanContactRaw(raw);
    if (!trimmed || /\s/.test(trimmed)) {
        return { valid: false, username: '' };
    }

    let candidate = trimmed;
    const isUrlOrAt =
        candidate.startsWith('@') ||
        /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i.test(candidate);

    if (isUrlOrAt) {
        candidate = candidate
            .replace(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i, '')
            .replace(/^(?:www\.)?(?:t\.me|telegram\.me)\//i, '')
            .replace(/^@+/, '')
            .replace(/[/?#].*$/, '');
    }

    if (!TELEGRAM_USERNAME_RE.test(candidate)) {
        return { valid: false, username: '' };
    }
    if (candidate.includes('__') || candidate.endsWith('_')) {
        return { valid: false, username: '' };
    }

    return { valid: true, username: candidate };
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function looksLikeTelegramAttempt(raw) {
    const t = raw.trim();
    return (
        t.startsWith('@') ||
        /(?:t\.me|telegram\.me)\//i.test(t) ||
        /^[a-zA-Z][a-zA-Z0-9_]*$/.test(t)
    );
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function looksLikePhoneAttempt(raw) {
    const t = raw.trim();
    if (t.startsWith('+') || /^\d/.test(t)) return true;
    const digitCount = (t.match(/\d/g) || []).length;
    return digitCount >= 5 && !t.includes('@') && !/t\.me/i.test(t);
}

/**
 * Разбивает ввод пользователя на сегменты контактов (поддержка | , ;, меток вроде "тг @nick" и пар "@nick +380...").
 * @param {string} cleaned
 * @returns {string[]}
 */
function splitContactSegments(cleaned) {
    const rawParts = cleaned
        .split(/[|,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    /** @type {string[]} */
    const segments = [];
    for (const rawPart of rawParts) {
        const part = rawPart.replace(CONTACT_PREFIX_LABEL_RE, '').trim();
        if (!part) continue;

        // Поддержка пробельной пары "@nick +380..." / "t.me/nick 097..." или "+380... @nick"
        const tgFirst = part.match(/^((?:@|(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/)\S+)\s+([+\d][\d\s()+-]{6,})$/i);
        if (tgFirst) {
            segments.push(tgFirst[1].trim(), tgFirst[2].trim());
            continue;
        }
        const phoneFirst = part.match(/^([+\d][\d\s()+-]{6,})\s+((?:@|(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/)\S+)$/i);
        if (phoneFirst) {
            segments.push(phoneFirst[1].trim(), phoneFirst[2].trim());
            continue;
        }

        segments.push(part);
    }
    return segments;
}

/**
 * Синхронная 0ms валидация поля контакта предложки (телефон, Telegram @username или связка "@nick | +380...").
 * @param {string} rawContact
 * @returns {ContactSyncResult}
 */
export function validateProposalContactSync(rawContact) {
    const trimmed = cleanContactRaw(rawContact);
    if (!trimmed) {
        return { ok: false, kind: 'empty', errorKey: 'propose.err_fill_all', tgUsername: '', phone: '' };
    }

    const parts = splitContactSegments(trimmed);

    if (parts.length === 0 || parts.length > 3) {
        return { ok: false, kind: 'invalid', errorKey: 'propose.err_contact_invalid', tgUsername: '', phone: '' };
    }

    let phone = '';
    let tgUsername = '';

    for (const part of parts) {
        const phoneRes = validateProposalPhone(part);
        if (phoneRes.valid) {
            if (!phone) phone = phoneRes.normalized;
            continue;
        }

        const tgRes = extractTelegramUsername(part);
        if (tgRes.valid) {
            if (!tgUsername) tgUsername = tgRes.username;
            continue;
        }

        const errorKey = looksLikeTelegramAttempt(part)
            ? 'propose.err_tg_format'
            : looksLikePhoneAttempt(part)
                ? 'propose.err_phone_invalid'
                : 'propose.err_contact_invalid';

        return { ok: false, kind: 'invalid', errorKey, tgUsername: '', phone: '' };
    }

    const kind = phone && tgUsername ? 'both' : tgUsername ? 'telegram' : 'phone';
    return { ok: true, kind, errorKey: '', tgUsername, phone };
}

/**
 * Возвращает закэшированный результат проверки Telegram @username (если свежий).
 * @param {string} username
 * @returns {CachedTgStatus | null}
 */
export function getCachedTelegramUsernameStatus(username) {
    const key = String(username || '').trim().toLowerCase();
    if (!key) return null;
    const entry = _tgStatusCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        _tgStatusCache.delete(key);
        return null;
    }
    return entry;
}

/**
 * @param {string} key
 * @param {CachedTgStatus} entry
 */
function setCachedTelegramUsernameStatus(key, entry) {
    if (_tgStatusCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = _tgStatusCache.keys().next().value;
        if (oldestKey !== undefined) _tgStatusCache.delete(oldestKey);
    }
    _tgStatusCache.set(key, entry);
}

/**
 * Асинхронная проверка существования Telegram @username через бэкенд с дедупликацией и fail-open.
 * @param {string} rawUsername
 * @param {{ timeoutMs?: number, signal?: AbortSignal | null }} [options]
 * @returns {Promise<CachedTgStatus>}
 */
export async function checkTelegramUsernameRemote(rawUsername, options = {}) {
    const extracted = extractTelegramUsername(rawUsername);
    if (!extracted.valid) {
        return { exists: false, verified: true, username: '', ts: Date.now() };
    }

    const clean = extracted.username;
    const key = clean.toLowerCase();

    const cached = getCachedTelegramUsernameStatus(key);
    if (cached) return cached;

    const existingPromise = _inFlightTgChecks.get(key);
    if (existingPromise) return existingPromise;

    const timeoutMs = Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
        ? Number(options.timeoutMs)
        : DEFAULT_REMOTE_TIMEOUT_MS;

    const task = (async () => {
        try {
            const g = /** @type {any} */ (globalThis);
            /** @type {any} */
            let data = null;

            if (g.apiClient && typeof g.apiClient.post === 'function') {
                data = await g.apiClient.post(
                    '/api/verify-telegram-username',
                    { username: clean },
                    {
                        timeout: timeoutMs,
                        retries: 0,
                        signal: options.signal || undefined
                    }
                );
            } else if (typeof g.fetch === 'function') {
                const baseUrl = String(g.ENV?.API_BASE_URL || 'https://nisha-api.onrender.com').replace(/\/+$/, '');
                const timeoutSig = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
                    ? AbortSignal.timeout(timeoutMs)
                    : undefined;
                const signal = options.signal && timeoutSig && typeof AbortSignal.any === 'function'
                    ? AbortSignal.any([options.signal, timeoutSig])
                    : (options.signal || timeoutSig);
                const resp = await g.fetch(`${baseUrl}/api/verify-telegram-username`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: clean }),
                    signal
                });
                if (resp && resp.ok) {
                    data = await resp.json().catch(() => null);
                }
            }

            if (data && data.verified === true && typeof data.exists === 'boolean') {
                /** @type {CachedTgStatus} */
                const resolved = {
                    exists: data.exists,
                    verified: true,
                    username: clean,
                    ts: Date.now()
                };
                setCachedTelegramUsernameStatus(key, resolved);
                return resolved;
            }
        } catch {
            // fail-open: сетевой сбой или отмена запроса не должны блокировать пользователя
        }

        return { exists: null, verified: false, username: clean, ts: Date.now() };
    })();

    _inFlightTgChecks.set(key, task);
    task.finally(() => {
        _inFlightTgChecks.delete(key);
    }).catch(() => {});

    return task;
}

/**
 * Запускает фоновую проверку Telegram @username с дебаунсом, пока пользователь печатает.
 * Никогда не блокирует UI и отменяет устаревшие запросы при изменении текста.
 * @param {string} rawContact
 * @param {{ delayMs?: number, onResult?: ((res: CachedTgStatus, rawContact: string) => void) | null }} [options]
 */
export function scheduleBackgroundTelegramCheck(rawContact, options = {}) {
    if (_bgDebounceTimer !== null) {
        clearTimeout(_bgDebounceTimer);
        _bgDebounceTimer = null;
    }

    const sync = validateProposalContactSync(rawContact);
    const nextKey = sync.ok && sync.tgUsername ? sync.tgUsername.toLowerCase() : '';

    if (_bgAbortController && _bgActiveUsernameKey && _bgActiveUsernameKey !== nextKey) {
        _bgAbortController.abort();
        _bgAbortController = null;
        _bgActiveUsernameKey = '';
    }

    if (!nextKey) return;

    const myGeneration = ++_bgGeneration;
    const onResult = typeof options.onResult === 'function' ? options.onResult : null;

    const cached = getCachedTelegramUsernameStatus(nextKey);
    if (cached) {
        if (onResult) {
            queueMicrotask(() => {
                if (myGeneration === _bgGeneration) {
                    onResult(cached, rawContact);
                }
            });
        }
        return;
    }

    const delayMs = Number.isFinite(options.delayMs) && Number(options.delayMs) >= 0
        ? Number(options.delayMs)
        : 450;

    const run = () => {
        _bgDebounceTimer = null;
        if (myGeneration !== _bgGeneration) return;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        _bgAbortController = controller;
        _bgActiveUsernameKey = nextKey;

        checkTelegramUsernameRemote(sync.tgUsername, {
            timeoutMs: DEFAULT_REMOTE_TIMEOUT_MS,
            signal: controller ? controller.signal : null
        }).then((result) => {
            if (_bgAbortController === controller) {
                _bgAbortController = null;
                _bgActiveUsernameKey = '';
            }
            if (onResult && myGeneration === _bgGeneration) {
                onResult(result, rawContact);
            }
        }).catch(() => {});
    };

    if (delayMs === 0) {
        run();
    } else {
        _bgDebounceTimer = setTimeout(run, delayMs);
    }
}

/**
 * Финальная проверка контакта перед отправкой предложки (0ms если уже проверено в фоне или введен телефон).
 * @param {string} rawContact
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<ContactVerifyResult>}
 */
export async function verifyProposalContactBeforeSubmit(rawContact, options = {}) {
    const sync = validateProposalContactSync(rawContact);
    if (!sync.ok) {
        return { ok: false, errorKey: sync.errorKey, tgUsername: '', phone: '' };
    }

    if (!sync.tgUsername) {
        return { ok: true, errorKey: '', tgUsername: '', phone: sync.phone };
    }

    const remote = await checkTelegramUsernameRemote(sync.tgUsername, {
        timeoutMs: options.timeoutMs || DEFAULT_REMOTE_TIMEOUT_MS
    });

    if (remote.verified === true && remote.exists === false) {
        return {
            ok: false,
            errorKey: 'propose.err_tg_not_found',
            tgUsername: sync.tgUsername,
            phone: sync.phone
        };
    }

    return { ok: true, errorKey: '', tgUsername: sync.tgUsername, phone: sync.phone };
}

/**
 * Сбрасывает таймеры, контроллеры и кэш проверки контакта (для тестов и очистки).
 * @param {{ clearCache?: boolean }} [options]
 */
export function resetProposalContactValidationState(options = {}) {
    if (_bgDebounceTimer !== null) {
        clearTimeout(_bgDebounceTimer);
        _bgDebounceTimer = null;
    }
    if (_bgAbortController) {
        _bgAbortController.abort();
        _bgAbortController = null;
    }
    _bgActiveUsernameKey = '';
    _bgGeneration += 1;
    if (options.clearCache) {
        _tgStatusCache.clear();
        _inFlightTgChecks.clear();
    }
}
