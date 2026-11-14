// ==========================================
// NISHA PROFILE SHARED STATE & DEPENDENCY ACCESSORS
// ==========================================

import { registerAction, resolveAction } from '../core/action-registry.js';

/**
 * Resolves safe localStorage/sessionStorage wrapper from window or global scope.
 * @returns {object|null}
 */
export function getStore() {
    if (typeof window !== 'undefined' && window.storage) return window.storage;
    if (typeof storage !== 'undefined') return storage;
    return null;
}

/**
 * Resolves initial favorites array from window or cached storage.
 * @returns {any[]}
 */
function resolveInitialFavorites() {
    const winFavs = (typeof window !== 'undefined') ? window.favorites : undefined;
    if (Array.isArray(winFavs) && winFavs.length > 0) return winFavs;
    const store = getStore();
    const cachedFavs = (store && typeof store.getJSON === 'function') ? store.getJSON('nisha_cached_favorites', null) : null;
    if (Array.isArray(cachedFavs)) return cachedFavs;
    return Array.isArray(winFavs) ? winFavs : [];
}

/**
 * Resolves central reactive store instance when initialized.
 * @returns {object|null}
 */
export function getAppStore() {
    if (typeof window !== 'undefined' && window.store && typeof window.store.get === 'function' && typeof window.store.set === 'function') {
        return window.store;
    }
    if (typeof globalThis !== 'undefined' && globalThis.store && typeof globalThis.store.get === 'function' && typeof globalThis.store.set === 'function') {
        return globalThis.store;
    }
    return null;
}

const STORE_BACKED_KEYS = new Set([
    'currentUser',
    'userProfile',
    'favorites',
    'globalOrdersData',
    'currentOrderTab'
]);

/** Shared mutable profile, auth, favorites, orders, and realtime state. */
const _localProfileState = {
    currentUser: (typeof window !== 'undefined' && typeof window.currentUser !== 'undefined') ? window.currentUser : null,
    userProfile: (typeof window !== 'undefined' && typeof window.userProfile !== 'undefined') ? window.userProfile : null,
    favorites: resolveInitialFavorites(),
    orderItemsImageCache: (typeof window !== 'undefined' && typeof window.orderItemsImageCache !== 'undefined') ? window.orderItemsImageCache : {},
    isRegMode: (typeof window !== 'undefined' && typeof window.isRegMode !== 'undefined') ? Boolean(window.isRegMode) : false,
    globalOrdersData: (typeof window !== 'undefined' && typeof window.globalOrdersData !== 'undefined') ? window.globalOrdersData : [],
    currentOrderTab: (typeof window !== 'undefined' && typeof window.currentOrderTab !== 'undefined') ? window.currentOrderTab : 'accepted',
    orderStatusChannel: (typeof window !== 'undefined' && typeof window.orderStatusChannel !== 'undefined') ? window.orderStatusChannel : null,
    qaUpdatesChannel: (typeof window !== 'undefined' && typeof window.qaUpdatesChannel !== 'undefined') ? window.qaUpdatesChannel : null
};

// Seed store with any cached favorites if store has none yet
const _initStore = getAppStore();
if (_initStore && Array.isArray(_localProfileState.favorites) && _localProfileState.favorites.length > 0) {
    const storeFavs = _initStore.get('favorites');
    if (!Array.isArray(storeFavs) || storeFavs.length === 0) {
        _initStore.set('favorites', _localProfileState.favorites);
    }
}

export const profileState = new Proxy(_localProfileState, {
    get(target, prop) {
        if (STORE_BACKED_KEYS.has(prop)) {
            const s = getAppStore();
            if (s) {
                const val = s.get(prop);
                if (val !== undefined) return val;
            }
        }
        return target[prop];
    },
    set(target, prop, value) {
        target[prop] = value;
        if (STORE_BACKED_KEYS.has(prop)) {
            const s = getAppStore();
            if (s && s.get(prop) !== value) {
                s.set(prop, value);
            }
        }
        return true;
    }
});

/**
 * Installs configurable getter/setter proxies on window so legacy callers, external modules,
 * and unit tests reading or writing window.* stay synchronized with profileState.
 * @param {string} key
 */
function bindSyncedWindowStateProp(key) {
    if (typeof window === 'undefined') return;
    const desc = Object.getOwnPropertyDescriptor(window, key);
    if (desc && typeof desc.get === 'function' && desc.get._profileStateRef === profileState) {
        return;
    }
    if (desc && desc.configurable === false) {
        window[key] = profileState[key];
        return;
    }
    const getter = () => profileState[key];
    getter._profileStateRef = profileState;
    const setter = (val) => {
        profileState[key] = val;
    };
    Object.defineProperty(window, key, {
        configurable: true,
        enumerable: true,
        get: getter,
        set: setter
    });
}

[
    'currentUser',
    'userProfile',
    'favorites',
    'orderItemsImageCache',
    'isRegMode',
    'globalOrdersData',
    'currentOrderTab',
    'orderStatusChannel',
    'qaUpdatesChannel'
].forEach(bindSyncedWindowStateProp);

/**
 * Returns the active Supabase client or null.
 * @returns {object|null}
 */
export function getSupabase() {
    const fn = resolveAction('getSupabase');
    if (fn) {
        const res = fn();
        if (res) return res;
    }
    return (typeof window !== 'undefined' && (window._supabase || window.supabaseClient)) || null;
}

/**
 * Returns global product catalog array.
 * @returns {any[]}
 */
export function getCatalog() {
    if (typeof window !== 'undefined' && Array.isArray(window.allItems)) return window.allItems;
    if (typeof allItems !== 'undefined' && Array.isArray(allItems)) return allItems;
    return [];
}

/**
 * Returns Win95 hourglass icon markup or fallback symbol.
 * @param {number} [height=14]
 * @returns {string}
 */
export function getHourglass(height = 14) {
    const fn = resolveAction('getWin95HourglassHtml');
    if (fn) return fn(height);
    if (typeof getWin95HourglassHtml === 'function') {
        return getWin95HourglassHtml(height);
    }
    return '⌛';
}

/**
 * Translates an i18n key safely with a default fallback string.
 * @param {string} key
 * @param {string} fallback
 * @param {object} [vars]
 * @returns {string}
 */
export function tProfile(key, fallback, vars = {}) {
    const i18n = (typeof window !== 'undefined' && window.i18next) || (typeof i18next !== 'undefined' ? i18next : null);
    if (i18n && typeof i18n.t === 'function') {
        const translated = i18n.t(key, { defaultValue: fallback, ...vars });
        if (translated !== undefined && translated !== null && translated !== '') return translated;
    }
    return fallback;
}

/**
 * Displays toast via window.showToast or global showToast when available.
 * @param {string} msg
 * @param {string} [type='info']
 * @param {string|null} [imgUrl=null]
 * @param {Function|null} [onClick=null]
 */
export function notifyToast(msg, type = 'info', imgUrl = null, onClick = null) {
    const fn = resolveAction('showToast') || (typeof showToast === 'function' ? showToast : null);
    if (!fn) return;
    if (onClick !== null) return fn(msg, type, imgUrl, onClick);
    if (imgUrl !== null) return fn(msg, type, imgUrl);
    return fn(msg, type);
}

/**
 * Resolves a global or registered action helper by name.
 * @param {string} name
 * @returns {Function|null}
 */
export function getGlobalFn(name) {
    const resolved = resolveAction(name);
    if (resolved) return resolved;
    if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name];
    return null;
}

/**
 * Registers an action handler in the Action Registry and binds compatibility window alias.
 * @param {string} name
 * @param {Function} fn
 */
export function bindWindowFn(name, fn) {
    registerAction(name, fn);
    if (typeof window !== 'undefined') {
        window[name] = fn;
    }
}

/**
 * Toggles sidebar and modal auth vs profile forms consistently.
 * @param {boolean} isAuthenticated
 */
export function setProfileAuthFormsVisible(isAuthenticated) {
    if (typeof document === 'undefined') return;
    const loginForm = document.getElementById('loginForm');
    const profileForm = document.getElementById('profileForm');
    if (loginForm) loginForm.style.display = isAuthenticated ? 'none' : 'flex';
    if (profileForm) profileForm.style.display = isAuthenticated ? 'flex' : 'none';

    const mLog = document.getElementById('modalLoginForm');
    const mProf = document.getElementById('modalProfileForm');
    if (mLog) mLog.style.display = isAuthenticated ? 'none' : 'flex';
    if (mProf) mProf.style.display = isAuthenticated ? 'block' : 'none';
}

/**
 * Updates cached favorites in reactive store and DOM profile counters.
 * @param {any[]} nextFavorites
 */
export function syncProfileFavoritesCounters(nextFavorites) {
    const list = Array.isArray(nextFavorites) ? nextFavorites : [];
    if (typeof window !== 'undefined' && window.store && typeof window.store.set === 'function') {
        window.store.set('favorites', list);
    }
    if (typeof document !== 'undefined') {
        const pCount = document.getElementById('profileLikesCount');
        if (pCount) pCount.innerText = list.length;
        const mCount = document.getElementById('modalProfileLikesCount');
        if (mCount) mCount.innerText = list.length;
    }
}
