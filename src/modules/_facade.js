// @ts-check
// ==========================================
// NISHA STORE - SHARED MODULAR FACADE HELPER
// Unified delegation through ActionRegistry + compat global override resolution
// ==========================================

import { resolveAction } from '../../js/core/action-registry.js';
export { resolveAction };

/**
 * Resolves and invokes a registered module action (or global test mock),
 * falling back to an optional local implementation when unloaded.
 * @param {string} actionName
 * @param {any[]} [args=[]]
 * @param {(...args: any[]) => any} [fallback]
 * @returns {any}
 */
export function callAction(actionName, args = [], fallback) {
    const fn = resolveAction(actionName, actionName);
    if (typeof fn === 'function') {
        return fn(...args);
    }
    return typeof fallback === 'function' ? fallback(...args) : undefined;
}

/**
 * Resolves an async action handler and guarantees a Promise return value.
 * @param {string} actionName
 * @param {any[]} [args=[]]
 * @param {(...args: any[]) => any} [fallback]
 * @returns {Promise<any>}
 */
export async function callAsyncAction(actionName, args = [], fallback) {
    return callAction(actionName, args, fallback);
}
