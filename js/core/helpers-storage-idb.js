// ==========================================
// NISHA CORE HELPERS: SAFE WEB STORAGE & INDEXEDDB KEY-VAL STORE
// Quota / Safari Incognito Guard + Async IndexedDB Key-Val Cache
// ==========================================

import { registerActions } from './action-registry.js';
import { hasOwn } from './helpers-core-utils.js';

const _memStorageFallback = {};
const _memSessionFallback = {};

function getWebStore(storeProp) {
    try {
        if (typeof window !== 'undefined' && window[storeProp] && typeof window[storeProp].getItem === 'function') {
            return window[storeProp];
        }
        const gStore = typeof globalThis !== 'undefined' ? globalThis[storeProp] : null;
        if (gStore && typeof gStore.getItem === 'function') {
            return gStore;
        }
    } catch {}
    return null;
}

const getLocalStore = () => getWebStore('localStorage');
const getSessionStore = () => getWebStore('sessionStorage');

/**
 * Enforces retention limits on localStorage history keys to guard against QuotaExceededError.
 */
export function cleanStorageLimits() {
    try {
        // 1. Cap view history to 30 items
        const hist = storage.getJSON('nisha_history', null);
        if (Array.isArray(hist) && hist.length > 30) {
            storage.setJSON('nisha_history', hist.slice(0, 30));
        }

        // 2. Cap seen item IDs to 200 items
        const seen = storage.getJSON('nisha_seen_items', null);
        if (Array.isArray(seen) && seen.length > 200) {
            storage.setJSON('nisha_seen_items', seen.slice(-200));
        }

        // 3. Cap search history to 15 queries
        const searches = storage.getJSON('nisha_search_history', null) || storage.getJSON('nisha_recent_searches', null);
        if (Array.isArray(searches) && searches.length > 15) {
            storage.setJSON('nisha_search_history', searches.slice(0, 15));
        }
        storage.remove('nisha_recent_searches');
    } catch (e) {
        console.warn('Storage cleanup notice:', e);
    }
}
if (typeof window !== 'undefined') window.cleanStorageLimits = cleanStorageLimits;

function createStorageArea({ getStore, fallbackMap, allowQuotaCleanup }) {
    const readRaw = (key) => {
        const store = getStore();
        let val = null;
        try {
            val = store ? store.getItem(key) : null;
        } catch {
            val = null;
        }
        if (val !== null && val !== undefined) return val;
        return hasOwn(fallbackMap, key) ? fallbackMap[key] : null;
    };

    const writeRaw = (key, strVal) => {
        const store = getStore();
        if (!store) {
            fallbackMap[key] = strVal;
            return true;
        }
        try {
            store.setItem(key, strVal);
            delete fallbackMap[key];
            return true;
        } catch {
            if (allowQuotaCleanup) {
                try {
                    cleanStorageLimits();
                    store.setItem(key, strVal);
                    delete fallbackMap[key];
                    return true;
                } catch {}
            }
            fallbackMap[key] = strVal;
            return false;
        }
    };

    return {
        getJSON(key, defaultValue = null) {
            try {
                const raw = readRaw(key);
                if (raw === null || raw === undefined || raw === '') return defaultValue;
                const parsed = JSON.parse(raw);
                return parsed !== null && parsed !== undefined ? parsed : defaultValue;
            } catch {
                return defaultValue;
            }
        },
        setJSON(key, value) {
            try {
                return writeRaw(key, JSON.stringify(value));
            } catch {
                return false;
            }
        },
        get(key, defaultValue = null) {
            try {
                const val = readRaw(key);
                return val !== null && val !== undefined ? val : defaultValue;
            } catch {
                return hasOwn(fallbackMap, key) ? fallbackMap[key] : defaultValue;
            }
        },
        set(key, value) {
            try {
                return writeRaw(key, String(value));
            } catch {
                return false;
            }
        },
        remove(key) {
            delete fallbackMap[key];
            try {
                const store = getStore();
                if (store) store.removeItem(key);
                return true;
            } catch {
                return false;
            }
        },
        has(key) {
            try {
                const store = getStore();
                let hasInStore = false;
                try {
                    hasInStore = !!(store && store.getItem(key) !== null);
                } catch {
                    hasInStore = false;
                }
                if (hasInStore) return true;
                return hasOwn(fallbackMap, key);
            } catch {
                return hasOwn(fallbackMap, key);
            }
        },
        clear() {
            for (const k of Object.keys(fallbackMap)) delete fallbackMap[k];
            try {
                const store = getStore();
                if (store) store.clear();
                return true;
            } catch {
                return false;
            }
        }
    };
}

/**
 * Quota-safe and incognito-safe wrapper around localStorage and sessionStorage.
 */
export const storage = {
    ...createStorageArea({
        getStore: getLocalStore,
        fallbackMap: _memStorageFallback,
        allowQuotaCleanup: true
    }),
    session: createStorageArea({
        getStore: getSessionStore,
        fallbackMap: _memSessionFallback,
        allowQuotaCleanup: false
    })
};

export function safeSetItem(key, value) {
    return storage.set(key, value);
}

export function safeGetItem(key, fallback = null) {
    return storage.get(key, fallback);
}

export function safeRemoveItem(key) {
    return storage.remove(key);
}

export const safeStorage = {
    setItem: safeSetItem,
    getItem: safeGetItem,
    removeItem: safeRemoveItem
};

if (typeof window !== 'undefined') {
    window.storage = storage;
    window.getStorageJSON = (key, defaultValue = null) => storage.getJSON(key, defaultValue);
    window.setStorageJSON = (key, value) => storage.setJSON(key, value);
    window.safeSetItem = safeSetItem;
    window.safeGetItem = safeGetItem;
    window.safeRemoveItem = safeRemoveItem;
    window.safeStorage = safeStorage;
}
if (typeof globalThis !== 'undefined') {
    globalThis.storage = storage;
    globalThis.getStorageJSON = (key, defaultValue = null) => storage.getJSON(key, defaultValue);
    globalThis.setStorageJSON = (key, value) => storage.setJSON(key, value);
}

// Guard direct Storage.prototype calls against Safari Private / QuotaExceededError
(function initStorageSafeGuard() {
    try {
        if (typeof Storage !== 'undefined' && Storage.prototype && !Storage.prototype._nishaGuarded) {
            Storage.prototype._nishaGuarded = true;
            const getFallbackMap = (storageInstance) => {
                try {
                    if (typeof sessionStorage !== 'undefined' && storageInstance === sessionStorage) {
                        return _memSessionFallback;
                    }
                } catch {}
                return _memStorageFallback;
            };
            const originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                const fbMap = getFallbackMap(this);
                try {
                    originalSetItem.call(this, key, value);
                    if (fbMap[key] !== undefined) delete fbMap[key];
                } catch {
                    try {
                        if (typeof localStorage !== 'undefined' && this === localStorage) {
                            cleanStorageLimits();
                        }
                        originalSetItem.call(this, key, value);
                        if (fbMap[key] !== undefined) delete fbMap[key];
                    } catch {
                        fbMap[key] = String(value);
                    }
                }
            };
            const originalGetItem = Storage.prototype.getItem;
            Storage.prototype.getItem = function(key) {
                const fbMap = getFallbackMap(this);
                try {
                    const res = originalGetItem.call(this, key);
                    if (res !== null) return res;
                    return fbMap[key] !== undefined ? fbMap[key] : null;
                } catch {
                    return fbMap[key] !== undefined ? fbMap[key] : null;
                }
            };
            const originalRemoveItem = Storage.prototype.removeItem;
            if (typeof originalRemoveItem === 'function') {
                Storage.prototype.removeItem = function(key) {
                    const fbMap = getFallbackMap(this);
                    delete fbMap[key];
                    try {
                        originalRemoveItem.call(this, key);
                    } catch {}
                };
            }
        }
    } catch {}
})();

// ==========================================
// ULTRA-LIGHTWEIGHT INDEXEDDB KEY-VAL STORE
// ==========================================
const DB_NAME = 'nisha_idb_v1';
const STORE_NAME = 'keyval';
let _dbPromise = null;

function getIDBDatabase() {
    if (!_dbPromise) {
        const { promise, resolve } = Promise.withResolvers();
        _dbPromise = promise;
        const idbApi = (typeof window !== 'undefined' && window.indexedDB)
            ? window.indexedDB
            : (typeof indexedDB !== 'undefined' ? indexedDB : null);
        if (!idbApi) {
            resolve(null);
            return _dbPromise;
        }
        try {
            const req = idbApi.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = () => {
                const db = req.result;
                db.onclose = () => { _dbPromise = null; };
                db.onversionchange = () => {
                    try { db.close(); } catch {}
                    _dbPromise = null;
                };
                resolve(db);
            };
            req.onerror = () => {
                console.warn('[IDB] Failed to open IndexedDB:', req.error);
                _dbPromise = null;
                resolve(null);
            };
        } catch {
            _dbPromise = null;
            resolve(null);
        }
    }
    return _dbPromise;
}

/**
 * Reads a value from IndexedDB by key, returning null on errors or missing entries.
 * @param {string} key
 * @returns {Promise<*>}
 */
export async function idbGet(key) {
    try {
        const db = await getIDBDatabase();
        if (!db) return null;
        const { promise, resolve } = Promise.withResolvers();
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            tx.onerror = () => resolve(null);
            tx.onabort = () => resolve(null);
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
            req.onerror = () => resolve(null);
        } catch {
            _dbPromise = null;
            resolve(null);
        }
        return promise;
    } catch {
        _dbPromise = null;
        return null;
    }
}

/**
 * Writes a value to IndexedDB by key.
 * @param {string} key
 * @param {*} val
 * @returns {Promise<boolean>}
 */
export async function idbSet(key, val) {
    try {
        const db = await getIDBDatabase();
        if (!db) return false;
        const { promise, resolve } = Promise.withResolvers();
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
            tx.objectStore(STORE_NAME).put(val, key);
        } catch {
            _dbPromise = null;
            resolve(false);
        }
        return promise;
    } catch {
        _dbPromise = null;
        return false;
    }
}

/**
 * Deletes an entry from IndexedDB by key.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function idbDel(key) {
    try {
        const db = await getIDBDatabase();
        if (!db) return false;
        const { promise, resolve } = Promise.withResolvers();
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
            tx.objectStore(STORE_NAME).delete(key);
        } catch {
            _dbPromise = null;
            resolve(false);
        }
        return promise;
    } catch {
        _dbPromise = null;
        return false;
    }
}

/**
 * Lists all keys stored in the IndexedDB keyval store.
 * @returns {Promise<Array>}
 */
export async function idbGetAllKeys() {
    try {
        const db = await getIDBDatabase();
        if (!db) return [];
        const { promise, resolve } = Promise.withResolvers();
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            tx.onerror = () => resolve([]);
            tx.onabort = () => resolve([]);
            const store = tx.objectStore(STORE_NAME);
            if (typeof store.getAllKeys === 'function') {
                const req = store.getAllKeys();
                req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
                req.onerror = () => resolve([]);
            } else {
                const keys = [];
                const req = store.openKeyCursor ? store.openKeyCursor() : store.openCursor();
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        keys.push(cursor.key);
                        cursor.continue();
                    } else {
                        resolve(keys);
                    }
                };
                req.onerror = () => resolve(keys);
            }
        } catch {
            _dbPromise = null;
            resolve([]);
        }
        return promise;
    } catch {
        _dbPromise = null;
        return [];
    }
}

/**
 * Clears all Nova Poshta cached keys (`np_*`) from IndexedDB.
 * @returns {Promise<boolean>}
 */
export async function idbClearNP() {
    try {
        const db = await getIDBDatabase();
        if (!db) return false;
        const { promise, resolve } = Promise.withResolvers();
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
            const store = tx.objectStore(STORE_NAME);
            if (typeof store.openCursor === 'function') {
                const req = store.openCursor();
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        if (typeof cursor.key === 'string' && cursor.key.startsWith('np_')) {
                            cursor.delete();
                        }
                        cursor.continue();
                    }
                };
            } else {
                resolve(false);
            }
        } catch {
            _dbPromise = null;
            resolve(false);
        }
        return promise;
    } catch {
        _dbPromise = null;
        return false;
    }
}

if (typeof window !== 'undefined') {
    window.idbGet = idbGet;
    window.idbSet = idbSet;
    window.idbDel = idbDel;
    window.idbGetAllKeys = idbGetAllKeys;
    window.idbClearNP = idbClearNP;
}

registerActions({
    cleanStorageLimits,
    idbGet,
    idbSet,
    idbDel,
    idbGetAllKeys,
    idbClearNP
});
