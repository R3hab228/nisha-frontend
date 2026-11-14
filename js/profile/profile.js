// ==========================================
// NISHA PROFILE, AUTH, CONTACTS & ORDERS ENTRYPOINT
// Modular ES barrel re-exporting all profile submodules.
// ==========================================

import { initContactVisibilityListeners } from './profile-contacts.js';
import { initProfileDeliveryOutsideClick } from './profile-delivery.js';
import { initAuthListener } from './profile-auth.js';

export * from './profile-state.js';
export * from './profile-favorites.js';
export * from './profile-contacts.js';
export * from './profile-delivery.js';
export * from './profile-session.js';
export * from './profile-auth.js';

/**
 * Initializes Supabase auth state listener, contact OTP visibility polling,
 * and outside-click dismissal for Nova Poshta profile dropdowns.
 */
export function initProfileModule() {
    initAuthListener();
    initContactVisibilityListeners();
    initProfileDeliveryOutsideClick();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', initProfileModule);
    } else {
        initProfileModule();
    }
}
