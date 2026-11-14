// ==========================================
// КЭШ НОВОЙ ПОЧТЫ (IN-MEMORY L1 + INDEXEDDB L2 + SAFE FALLBACK)
// ==========================================
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';

export const NP_BRANCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа актуальности отделений
export const NP_CITY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней актуальности городов

// L1 In-Memory кэш (мгновенный отклик 0ms в рамках вкладки)
const npMemoryCache = new Map();
const NP_MAX_MEMORY_ENTRIES = 150;

function trimMemoryCacheIfNeeded() {
    if (npMemoryCache.size > NP_MAX_MEMORY_ENTRIES) {
        const oldestKey = npMemoryCache.keys().next().value;
        if (oldestKey) npMemoryCache.delete(oldestKey);
    }
}

export function getNPDefaultTTL(key) {
    if (typeof key === 'string' && key.startsWith('city_')) {
        return NP_CITY_CACHE_TTL_MS;
    }
    return NP_BRANCH_CACHE_TTL_MS;
}

// Минимальный вид отделения для кэша (экономит память и дисковое пространство)
export function slimBranches(list) {
    if (!Array.isArray(list)) return [];
    return list.map(b => ({
        Ref: b.Ref,
        Description: b.Description || '',
        TypeOfWarehouse: b.TypeOfWarehouse || '',
        Number: b.Number ? String(b.Number) : ''
    }));
}

/**
 * Асинхронно получает данные из кэша: Memory L1 -> IndexedDB L2 -> Safe Fallback L3
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getNPStorageAsync(key) {
    if (!key) return null;
    const ttl = getNPDefaultTTL(key);

    // 1. Проверяем L1 In-Memory Cache (0ms)
    const memEntry = npMemoryCache.get(key);
    if (memEntry && memEntry.ts && (Date.now() - memEntry.ts < (memEntry.ttl !== undefined ? memEntry.ttl : ttl)) && memEntry.data) {
        return memEntry.data;
    }

    // 2. Проверяем L2 IndexedDB (основное надёжное хранилище без 5MB лимита)
    if (hasAction('idbGet')) {
        try {
            const entry = await invokeAction('idbGet', 'np_' + key);
            if (entry && entry.ts && entry.data) {
                const itemTtl = entry.ttl !== undefined ? entry.ttl : ttl;
                if (Date.now() - entry.ts < itemTtl) {
                    let actualData = entry.data;
                    if (entry.compressed && hasAction('decompressJSON')) {
                        try {
                            actualData = await invokeAction('decompressJSON', entry.data);
                        } catch (compErr) {
                            console.warn('[NP Cache] Decompress error fallback:', compErr);
                            actualData = null;
                        }
                    }
                    if (actualData) {
                        // Синхронизируем в L1 In-Memory для мгновенного доступа при повторных обращениях
                        npMemoryCache.set(key, { ts: entry.ts, ttl: itemTtl, data: actualData });
                        trimMemoryCacheIfNeeded();
                        return actualData;
                    } else if (hasAction('idbDel')) {
                        // Асинхронно удаляем поврежденную запись
                        invokeAction('idbDel', 'np_' + key).catch(() => {});
                    }
                } else if (hasAction('idbDel')) {
                    // Асинхронно удаляем устаревшую запись
                    invokeAction('idbDel', 'np_' + key).catch(() => {});
                }
            }
        } catch (e) {
            console.warn('[NP Cache] Ошибка чтения IndexedDB:', e);
        }
    }

    // 3. Fallback к L3 Safe sessionStorage (для сред без IndexedDB)
    const fallbackData = getNPStorage(key);
    if (fallbackData) {
        npMemoryCache.set(key, { ts: Date.now(), ttl, data: fallbackData });
        trimMemoryCacheIfNeeded();
    }
    return fallbackData;
}
window.getNPStorageAsync = getNPStorageAsync;

/**
 * Синхронное получение из кэша (для мгновенного чтения fallback)
 * @param {string} key
 * @returns {any}
 */
export function getNPStorage(key) {
    if (!key) return null;
    const ttl = getNPDefaultTTL(key);
    // Сначала проверяем memory cache с проверкой актуальности по TTL
    const mem = npMemoryCache.get(key);
    if (mem && mem.ts && (Date.now() - mem.ts < (mem.ttl !== undefined ? mem.ttl : ttl)) && mem.data) {
        return mem.data;
    }

    const store = window.storage || (typeof window !== 'undefined' && window.storage ? window.storage : null);
    if (store && store.session) {
        return store.session.getJSON('nisha_np_' + key, null);
    }
    try {
        if (typeof sessionStorage !== 'undefined') {
            const raw = sessionStorage.getItem('nisha_np_' + key);
            return raw ? JSON.parse(raw) : null;
        }
    } catch {}
    return null;
}

/**
 * Сохраняет данные Новой Почты в кэш: Memory L1 -> IndexedDB L2 -> Safe Fallback L3
 * @param {string} key
 * @param {any} val
 * @param {number} [customTtl]
 */
export function setNPStorage(key, val, customTtl) {
    if (!key || !val || typeof val !== 'object') return;
    const ttl = (typeof customTtl === 'number') ? customTtl : getNPDefaultTTL(key);

    // Сжимаем массив отделений перед сохранением
    let payload = val;
    if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === 'object' && 'Ref' in val[0]) {
        payload = slimBranches(val);
    }

    // 1. Сохраняем в L1 In-Memory кэш
    npMemoryCache.set(key, { ts: Date.now(), ttl, data: payload });
    trimMemoryCacheIfNeeded();

    // 2. Сохраняем в L2 IndexedDB (основное надёжное хранилище для всех городов и отделений)
    const hasIdb = hasAction('idbSet');
    if (hasIdb) {
        const shouldCompress = hasAction('compressJSON') &&
                               hasAction('isCompressionStreamSupported') &&
                               invokeAction('isCompressionStreamSupported') &&
                               Array.isArray(payload) && payload.length > 20;

        if (shouldCompress) {
            invokeAction('compressJSON', payload).then(compressedBuffer => {
                invokeAction('idbSet', 'np_' + key, { ts: Date.now(), ttl, data: compressedBuffer, compressed: true }).catch(() => {});
            }).catch(() => {
                invokeAction('idbSet', 'np_' + key, { ts: Date.now(), ttl, data: payload }).catch(() => {});
            });
        } else {
            invokeAction('idbSet', 'np_' + key, { ts: Date.now(), ttl, data: payload }).catch(() => {});
        }
    } else {
        // 3. Fallback в L3 sessionStorage только если IndexedDB недоступен
        if (!Array.isArray(payload) || payload.length <= 200) {
            try {
                const store = window.storage || null;
                if (store && store.session) {
                    store.session.setJSON('nisha_np_' + key, payload);
                } else if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('nisha_np_' + key, JSON.stringify(payload));
                }
            } catch {
                // Защита от QuotaExceededError
                try {
                    if (typeof sessionStorage !== 'undefined') {
                        for (let i = sessionStorage.length - 1; i >= 0; i--) {
                            const k = sessionStorage.key(i);
                            if (k && k.startsWith('nisha_np_')) {
                                sessionStorage.removeItem(k);
                            }
                        }
                    }
                } catch {}
            }
        }
    }
}
window.setNPStorage = setNPStorage;

const NP_MAX_CACHE_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 дней - предельный срок актуальности кэша
const NP_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 часа - интервал фоновой проверки устаревших записей

/**
 * Выполняет фоновую очистку устаревших или поврежденных записей Новой Почты из IndexedDB, SessionStorage и In-Memory кэша
 * @param {boolean} [forceAll=false] - Если true, удаляет абсолютно все записи Новой Почты (полный сброс)
 * @returns {Promise<{ deleted: number, checked: number, success: boolean }>}
 */
export async function cleanupStaleNPCache(forceAll = false) {
    let deleted = 0;
    let checked = 0;
    const now = Date.now();

    // 1. Очистка L1 In-Memory
    if (forceAll) {
        npMemoryCache.clear();
    } else {
        for (const [key, entry] of npMemoryCache.entries()) {
            const ttl = (entry && typeof entry.ttl === 'number') ? entry.ttl : getNPDefaultTTL(key);
            if (!entry || !entry.ts || (now - entry.ts >= ttl)) {
                npMemoryCache.delete(key);
            }
        }
    }

    // 2. Очистка L3 SessionStorage
    try {
        if (typeof sessionStorage !== 'undefined') {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith('nisha_np_')) {
                    if (forceAll) {
                        sessionStorage.removeItem(k);
                    } else {
                        try {
                            const raw = sessionStorage.getItem(k);
                            const parsed = raw ? JSON.parse(raw) : null;
                            if (!parsed || (parsed.ts && (now - parsed.ts >= (parsed.ttl || NP_BRANCH_CACHE_TTL_MS)))) {
                                sessionStorage.removeItem(k);
                            }
                        } catch {
                            sessionStorage.removeItem(k);
                        }
                    }
                }
            }
        }
    } catch {}

    // 3. Очистка L2 IndexedDB
    try {
        let keys = [];
        if (hasAction('idbGetAllKeys')) {
            keys = await invokeAction('idbGetAllKeys');
        } else if (hasAction('idbClearNP') && forceAll) {
            await invokeAction('idbClearNP');
            return { deleted: 1, checked: 1, success: true };
        }

        const npKeys = (Array.isArray(keys) ? keys : []).filter(k => typeof k === 'string' && k.startsWith('np_'));

        for (const fullKey of npKeys) {
            checked++;
            if (forceAll) {
                if (hasAction('idbDel')) {
                    await invokeAction('idbDel', fullKey);
                    deleted++;
                }
                continue;
            }

            const rawKey = fullKey.replace(/^np_/, '');
            const defaultTtl = getNPDefaultTTL(rawKey);

            if (hasAction('idbGet')) {
                const entry = await invokeAction('idbGet', fullKey);
                const isCorrupt = !entry || typeof entry !== 'object' || !entry.ts;
                const isExpired = entry && entry.ts && (now - entry.ts >= (typeof entry.ttl === 'number' ? entry.ttl : defaultTtl));
                const isTooOld = entry && entry.ts && (now - entry.ts >= NP_MAX_CACHE_AGE_MS);

                if (isCorrupt || isExpired || isTooOld) {
                    if (hasAction('idbDel')) {
                        await invokeAction('idbDel', fullKey);
                        deleted++;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[NP Cache] Ошибка фоновой очистки IndexedDB:', e);
    }

    return { deleted, checked, success: true };
}

/**
 * Очищает кэш отделений и городов Новой Почты во всех уровнях хранилища
 */
export async function clearNPCache(includeIdb = false) {
    npMemoryCache.clear();
    try {
        if (typeof sessionStorage !== 'undefined') {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith('nisha_np_')) {
                    sessionStorage.removeItem(k);
                }
            }
        }
    } catch {}
    if (includeIdb) {
        if (typeof cleanupStaleNPCache === 'function') {
            await cleanupStaleNPCache(true);
        } else if (hasAction('idbClearNP')) {
            await invokeAction('idbClearNP');
        }
    }
}
window.clearNPCache = clearNPCache;

registerActions({
    slimBranches,
    getNPStorage,
    getNPStorageAsync,
    setNPStorage,
    cleanupStaleNPCache,
    clearNPCache
});

if (typeof window !== 'undefined') {
    window.slimBranches = slimBranches;
    window.getNPStorage = getNPStorage;
    window.cleanupStaleNPCache = cleanupStaleNPCache;
}

/**
 * Автоматический запуск проверки устаревшего кэша в idle-время раз в 24 часа
 */
export function scheduleAutoNPCacheCleanup() {
    if (typeof window === 'undefined') return;
    try {
        const lastSweepStr = (typeof localStorage !== 'undefined') ? localStorage.getItem('nisha_np_last_sweep') : null;
        const lastSweep = lastSweepStr ? Number(lastSweepStr) : 0;
        const now = Date.now();

        if (!lastSweep || (now - lastSweep > NP_SWEEP_INTERVAL_MS)) {
            const executeSweep = () => {
                cleanupStaleNPCache(false).then(() => {
                    try {
                        if (typeof localStorage !== 'undefined') {
                            localStorage.setItem('nisha_np_last_sweep', String(Date.now()));
                        }
                    } catch {}
                }).catch(() => {});
            };

            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(executeSweep, { timeout: 4000 });
            } else {
                setTimeout(executeSweep, 3000);
            }
        }
    } catch {}
}
scheduleAutoNPCacheCleanup();
