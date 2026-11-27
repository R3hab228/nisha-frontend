// @ts-check
// ==========================================
// NISHA PROFILE CONTACTS & DELIVERY BUNDLE (Lazy Chunk)
// Loaded on demand when authenticated user renders contacts/delivery
// or interacts with profile phone/Telegram/Nova Poshta controls.
// ==========================================

import { initContactVisibilityListeners } from './profile-contacts.js';
import { initProfileDeliveryOutsideClick } from './profile-delivery.js';

export * from './profile-contacts.js';
export * from './profile-delivery.js';
export * from './profile-np-delivery.js';

let _profileModalListenersBound = false;

/**
 * Initializes contact OTP visibility polling and outside-click dismissal for NP dropdowns.
 */
export function initProfileModalBundle() {
    if (_profileModalListenersBound) return;
    _profileModalListenersBound = true;
    initContactVisibilityListeners();
    initProfileDeliveryOutsideClick();
}

if (typeof document !== 'undefined') {
    initProfileModalBundle();
}
