// ==========================================
// NISHA STORE — BARGAIN STORAGE HELPER (js/core/bargain-storage.js)
// Единый слой чтения/записи/очистки состояния торга в sessionStorage и localStorage.
// ==========================================

const ACCEPTED_PREFIX = 'accepted_bargain_';
const PENDING_PREFIX = 'pending_bargain_';
const DECLINED_PREFIX = 'declined_bargain_';
const DEFAULT_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DECLINED_TTL_MS = 48 * 60 * 60 * 1000;

function resolveWebStorage(prop) {
    try {
        if (typeof window !== 'undefined' && window[prop] && typeof window[prop].getItem === 'function') {
            return window[prop];
        }
    } catch {}
    try {
        if (typeof globalThis !== 'undefined' && globalThis[prop] && typeof globalThis[prop].getItem === 'function') {
            return globalThis[prop];
        }
    } catch {}
    return null;
}

function getStorageAreas() {
    return [resolveWebStorage('sessionStorage'), resolveWebStorage('localStorage')].filter(Boolean);
}

function readRawKey(key) {
    for (const area of getStorageAreas()) {
        try {
            const val = area.getItem(key);
            if (val !== null && val !== undefined && val !== '') {
                return val;
            }
        } catch {}
    }
    return null;
}

function writeRawKey(key, value) {
    for (const area of getStorageAreas()) {
        try {
            area.setItem(key, value);
        } catch {}
    }
}

function removeRawKey(key) {
    for (const area of getStorageAreas()) {
        try {
            area.removeItem(key);
        } catch {}
    }
}

function parseJsonSafe(raw) {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Reads accepted bargain payload for an item from sessionStorage/localStorage.
 * @param {string|number} itemId
 * @returns {object|null}
 */
export function getAcceptedBargain(itemId) {
    if (itemId === undefined || itemId === null || itemId === '') return null;
    return parseJsonSafe(readRawKey(`${ACCEPTED_PREFIX}${itemId}`));
}

/**
 * Checks whether an item bargain was recently declined within the 48-hour cooldown window.
 * Expired or legacy permanent markers are automatically evicted.
 * @param {string|number} itemId
 * @param {number} [maxAgeMs=172800000]
 * @returns {boolean}
 */
export function isBargainDeclined(itemId, maxAgeMs = DEFAULT_DECLINED_TTL_MS) {
    if (itemId === undefined || itemId === null || itemId === '') return false;
    const raw = readRawKey(`${DECLINED_PREFIX}${itemId}`);
    if (!raw) return false;
    if (raw === 'true') {
        clearDeclinedBargain(itemId);
        return false;
    }
    const parsed = parseJsonSafe(raw);
    if (!parsed || !parsed.declined) {
        clearDeclinedBargain(itemId);
        return false;
    }
    const ts = Number(parsed.timestamp || 0);
    if (Number.isFinite(ts) && ts > 0 && (Date.now() - ts) < maxAgeMs) {
        return true;
    }
    clearDeclinedBargain(itemId);
    return false;
}

/**
 * Reads an active (non-expired) pending bargain offer for an item.
 * Expired entries are automatically evicted.
 * @param {string|number} itemId
 * @param {number} [maxAgeMs=86400000]
 * @returns {object|null}
 */
export function getPendingBargain(itemId, maxAgeMs = DEFAULT_PENDING_TTL_MS) {
    if (itemId === undefined || itemId === null || itemId === '') return null;
    const parsed = parseJsonSafe(readRawKey(`${PENDING_PREFIX}${itemId}`));
    if (!parsed) return null;
    const ts = Number(parsed.timestamp || 0);
    if (Date.now() - ts < maxAgeMs) {
        return parsed;
    }
    clearPendingBargain(itemId);
    return null;
}

/**
 * Persists an accepted bargain and clears declined/pending markers for the item.
 * @param {string|number} itemId
 * @param {object} payload
 */
export function setAcceptedBargain(itemId, payload) {
    if (itemId === undefined || itemId === null || itemId === '') return;
    const id = String(itemId);
    try {
        writeRawKey(`${ACCEPTED_PREFIX}${id}`, JSON.stringify(payload));
    } catch {}
    removeRawKey(`${DECLINED_PREFIX}${id}`);
    removeRawKey(`${PENDING_PREFIX}${id}`);
}

/**
 * Persists a pending bargain offer in both sessionStorage and localStorage.
 * @param {string|number} itemId
 * @param {object} payload
 */
export function setPendingBargain(itemId, payload) {
    if (itemId === undefined || itemId === null || itemId === '') return;
    const id = String(itemId);
    try {
        writeRawKey(`${PENDING_PREFIX}${id}`, JSON.stringify(payload));
    } catch {}
}

/**
 * Persists a declined bargain state with timestamp and clears accepted/pending markers for the item.
 * @param {string|number} itemId
 */
export function setBargainDeclined(itemId) {
    if (itemId === undefined || itemId === null || itemId === '') return;
    const id = String(itemId);
    try {
        writeRawKey(`${DECLINED_PREFIX}${id}`, JSON.stringify({
            declined: true,
            timestamp: Date.now()
        }));
    } catch {}
    removeRawKey(`${ACCEPTED_PREFIX}${id}`);
    removeRawKey(`${PENDING_PREFIX}${id}`);
}

/**
 * Clears declined bargain state for the item.
 * @param {string|number} itemId
 */
export function clearDeclinedBargain(itemId) {
    if (itemId === undefined || itemId === null || itemId === '') return;
    removeRawKey(`${DECLINED_PREFIX}${itemId}`);
}

/**
 * Clears pending bargain state for the item.
 * @param {string|number} itemId
 */
export function clearPendingBargain(itemId) {
    if (itemId === undefined || itemId === null || itemId === '') return;
    removeRawKey(`${PENDING_PREFIX}${itemId}`);
}

/**
 * Clears all bargain markers (accepted, declined, pending) for the item.
 * @param {string|number} itemId
 */
export function clearAllBargainState(itemId) {
    if (itemId === undefined || itemId === null || itemId === '') return;
    const id = String(itemId);
    removeRawKey(`${ACCEPTED_PREFIX}${id}`);
    removeRawKey(`${DECLINED_PREFIX}${id}`);
    removeRawKey(`${PENDING_PREFIX}${id}`);
}
