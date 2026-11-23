// ==========================================
// NISHA PROFILE CORE ENTRYPOINT (Eager Bundle)
// Loads auth, session, realtime & favorites on startup.
// Contacts OTP & Nova Poshta profile delivery live in profile-modal-bundle.js (lazy).
// ==========================================

import { initAuthListener } from './profile-auth.js';

export * from './profile-state.js';
export * from './profile-favorites.js';
export * from './profile-session.js';
export * from './profile-auth.js';

/**
 * Initializes eager Supabase auth listener on startup.
 */
export function initProfileCoreModule() {
    initAuthListener();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', initProfileCoreModule);
    } else {
        initProfileCoreModule();
    }
}
