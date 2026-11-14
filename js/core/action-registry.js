// ==========================================
// NISHA CORE: ACTION REGISTRY & EVENT BUS
// Replaces legacy global `window.*` function coupling with:
// 1) A central ES Map ActionRegistry (with safe lazy-stub & test-mock precedence)
// 2) A standard EventTarget-based CustomEvent bus (`appEvents`)
// ==========================================

/**
 * @typedef {Object} ActionEntry
 * @property {Function} handler
 * @property {string} [compatName]
 * @property {boolean} [isLazyStub]
 */

/** @type {Map<string, ActionEntry>} */
const actionRegistry = new Map();

/**
 * Native browser/Node EventTarget for decoupled cross-module CustomEvents.
 * @type {EventTarget}
 */
export const appEvents = typeof EventTarget !== 'undefined'
    ? new EventTarget()
    : {
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; }
    };

/**
 * Dispatches a typed CustomEvent on `appEvents`.
 * @param {string} eventName
 * @param {*} [detail]
 * @returns {boolean}
 */
export function emitAppEvent(eventName, detail) {
    if (!eventName || typeof appEvents?.dispatchEvent !== 'function') return false;
    if (typeof CustomEvent === 'function') {
        return appEvents.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
    return false;
}

/**
 * Subscribes to a typed event on `appEvents` and returns an unsubscribe function.
 * @param {string} eventName
 * @param {(event: CustomEvent) => void} listener
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {() => void}
 */
export function onAppEvent(eventName, listener, options) {
    if (!eventName || typeof listener !== 'function' || typeof appEvents?.addEventListener !== 'function') {
        return () => {};
    }
    appEvents.addEventListener(eventName, listener, options);
    return () => {
        if (typeof appEvents.removeEventListener === 'function') {
            appEvents.removeEventListener(eventName, listener, options);
        }
    };
}

/**
 * Subscribes once to an event on `appEvents`.
 * @param {string} eventName
 * @param {(event: CustomEvent) => void} listener
 * @returns {() => void}
 */
export function onceAppEvent(eventName, listener) {
    return onAppEvent(eventName, listener, { once: true });
}

/**
 * Registers a single action handler in the ES Map registry.
 * Real module handlers automatically supersede lazy-loader stubs.
 * @param {string} name
 * @param {Function} handler
 * @param {{ compatName?: string, isLazyStub?: boolean }} [options]
 */
export function registerAction(name, handler, options = {}) {
    if (!name || typeof handler !== 'function') return;
    const existing = actionRegistry.get(name);
    if (options.isLazyStub && existing && !existing.isLazyStub) {
        return;
    }
    actionRegistry.set(name, {
        handler,
        compatName: options.compatName || name,
        isLazyStub: Boolean(options.isLazyStub)
    });
}

/**
 * Batch-registers a dictionary of `{ name: handler }` pairs into the ActionRegistry.
 * @param {Record<string, Function>} handlers
 * @param {{ isLazyStub?: boolean }} [options]
 */
export function registerActions(handlers, options = {}) {
    if (!handlers || typeof handlers !== 'object') return;
    for (const [name, fn] of Object.entries(handlers)) {
        if (typeof fn === 'function') {
            registerAction(name, fn, options);
        }
    }
}

/**
 * Unregisters an action handler (useful in tests or cleanup).
 * @param {string} name
 */
export function unregisterAction(name) {
    actionRegistry.delete(name);
}

/**
 * Checks whether an action is registered in the ActionRegistry or available via compat global.
 * @param {string} name
 * @param {string} [compatName]
 * @returns {boolean}
 */
export function hasAction(name, compatName) {
    return typeof resolveAction(name, compatName) === 'function';
}

/**
 * Lists all registered action keys.
 * @returns {string[]}
 */
export function listRegisteredActions() {
    return Array.from(actionRegistry.keys());
}

/**
 * Resolves an action handler without hardcoding `window.*` dependencies.
 * Resolution order:
 * 1) Explicit non-stub test/runtime override on `globalThis[compatKey]` if it differs from the registered function
 * 2) Registered ES module handler in `actionRegistry`
 * 3) Compat global on `globalThis[compatKey]` when the owning module isn't loaded (e.g. unit test mocks)
 *
 * @param {string} name
 * @param {string} [compatName]
 * @returns {Function|null}
 */
function getCompatOverrideFn(compatKey) {
    if (!compatKey) return null;
    if (typeof window !== 'undefined' && typeof window[compatKey] === 'function') {
        return window[compatKey];
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis[compatKey] === 'function') {
        return globalThis[compatKey];
    }
    return null;
}

export function resolveAction(name, compatName) {
    const entry = (name ? actionRegistry.get(name) : undefined)
        || (compatName && compatName !== name ? actionRegistry.get(compatName) : undefined);
    const compatKey = compatName || entry?.compatName || name;
    const globalFn = getCompatOverrideFn(compatKey);

    if (typeof globalFn === 'function') {
        // Honor explicit test mocks (`window.fn = vi.fn()`) or external overrides
        // while preferring non-stub ES handlers over lazy proxy stubs.
        if (entry) {
            if (globalFn !== entry.handler && !globalFn._isNishaLazyStub && !entry.isLazyStub) {
                return globalFn;
            }
            if (entry.isLazyStub && !globalFn._isNishaLazyStub) {
                return globalFn;
            }
        } else {
            return globalFn;
        }
    }

    if (entry && typeof entry.handler === 'function') {
        return entry.handler;
    }

    return null;
}

/**
 * Resolves and invokes an action handler by registered name.
 * @param {string} name
 * @param {...*} args
 * @returns {*}
 */
export function invokeAction(name, ...args) {
    const fn = resolveAction(name);
    if (typeof fn === 'function') {
        return fn(...args);
    }
    return undefined;
}

/**
 * Resolves and invokes an action handler by `(actionKey, compatGlobalName)` pair.
 * @param {string} actionName
 * @param {string} compatName
 * @param {...*} args
 * @returns {*}
 */
export function invokeCompatAction(actionName, compatName, ...args) {
    const fn = resolveAction(actionName, compatName);
    if (typeof fn === 'function') {
        return fn(...args);
    }
    return undefined;
}
