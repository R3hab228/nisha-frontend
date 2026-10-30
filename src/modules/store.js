// ==========================================
// NISHA STORE - MODULAR REACTIVE STORE FACADE
// Safe, typed ES module exports for centralized state
// ==========================================

/**
 * Returns active store instance from global scope or globalThis
 * @returns {any}
 */
export function getStore() {
    if (typeof window !== 'undefined' && window.store) return window.store;
    if (typeof globalThis !== 'undefined' && globalThis.store) return globalThis.store;
    return null;
}

/**
 * Subscribes to a store property changes
 * @param {string} prop
 * @param {(newVal: any, oldVal: any) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribeStore(prop, callback) {
    const s = getStore();
    if (s && typeof s.subscribe === 'function') {
        return s.subscribe(prop, callback);
    }
    return () => {};
}

/**
 * Safely retrieves state value by key
 * @param {string} key
 * @param {any} [defaultValue=undefined]
 * @returns {any}
 */
export function getStoreState(key, defaultValue = undefined) {
    const s = getStore();
    if (!s) return defaultValue;
    const val = typeof s.get === 'function' ? s.get(key) : s[key];
    return val !== undefined ? val : defaultValue;
}

/**
 * Safely updates state value by key
 * @param {string} key
 * @param {any} value
 * @returns {boolean}
 */
export function setStoreState(key, value) {
    const s = getStore();
    if (!s) return false;
    if (typeof s.set === 'function') {
        s.set(key, value);
        return true;
    }
    s[key] = value;
    return true;
}

/**
 * Reactive store proxy allowing modular imports:
 * `import { store } from '@/modules';` or `import store from '@/modules/store';`
 */
export const store = new Proxy({}, {
    get(_target, prop) {
        const s = getStore();
        if (!s) return undefined;
        const val = s[prop];
        if (typeof val === 'function') {
            return val.bind(s);
        }
        return val;
    },
    set(_target, prop, value) {
        const s = getStore();
        if (!s) return false;
        s[prop] = value;
        return true;
    },
    has(_target, prop) {
        const s = getStore();
        if (!s) return false;
        if (typeof s.get === 'function') {
            return s.get(prop) !== undefined || prop in s;
        }
        return prop in s;
    }
});

export { storage, safeStorage } from './helpers.js';

export default store;
