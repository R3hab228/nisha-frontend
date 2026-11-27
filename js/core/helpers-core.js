// ==========================================
// NISHA CORE HELPERS (Eager Entrypoint)
// Re-exports core utilities without pulling WebAudio sound-effects into initial bundle.
// sound-effects.js is lazy-loaded via lazy-loader.js on first interaction or sound call.
// ==========================================

import { initNetworkAwareRendering } from './helpers-pwa-browser.js';
import { initActionDelegation, bindFormAndFilterListeners } from './helpers-delegation.js';

export * from './action-registry.js';
export * from './helpers-core-utils.js';
export * from './helpers-security-media.js';
export * from './helpers-storage-idb.js';
export * from './helpers-search-address.js';
export * from './helpers-toasts-modals.js';
export * from './helpers-pwa-browser.js';
export * from './helpers-delegation.js';
export * from './floating-ui.js';

if (typeof window !== 'undefined') {
    initNetworkAwareRendering();
}

initActionDelegation();

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', bindFormAndFilterListeners);
    } else {
        bindFormAndFilterListeners();
    }
}
