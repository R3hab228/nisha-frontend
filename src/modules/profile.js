// ==========================================
// NISHA STORE - MODULAR PROFILE & AUTH FACADE
// Safe, typed ES module exports for profile, auth & favorites
// ==========================================

import { callAction, callAsyncAction } from './_facade.js';
import { getStore } from './store.js';

/**
 * Opens user profile or auth modal dialog
 */
export function openProfileModal() {
    return callAction('openProfileModal');
}

/**
 * Checks current Supabase authentication session
 * @returns {Promise<any>}
 */
export function checkSession() {
    return callAsyncAction('checkSession', [], () => null);
}

/**
 * Toggles between Login and Registration mode in modal
 */
export function toggleRegMode() {
    return callAction('toggleRegMode');
}

/**
 * Handles email/password authentication submission
 * @param {Event} [event]
 * @returns {Promise<void>}
 */
export function handleAuth(event) {
    return callAsyncAction('handleAuth', [event]);
}

/**
 * Triggers forgot password reset flow
 * @returns {Promise<void>}
 */
export function handleForgotPassword() {
    return callAsyncAction('handleForgotPassword');
}

/**
 * Logs out current authenticated user and cleans state
 * @returns {Promise<void>}
 */
export function logout() {
    return callAsyncAction('logout');
}

/**
 * Initiates Google OAuth Sign-in flow
 * @returns {Promise<void>}
 */
export function loginWithGoogle() {
    return callAsyncAction('loginWithGoogle');
}

/**
 * Toggles input password mask visibility
 * @param {string} inputId
 * @param {HTMLElement} [iconElement]
 */
export function togglePasswordVisibility(inputId, iconElement) {
    return callAction('togglePasswordVisibility', [inputId, iconElement]);
}

/**
 * Toggles favorite state for item
 * @param {string|number} itemId
 * @param {boolean} [silent=false]
 * @returns {Promise<boolean>}
 */
export function toggleFav(itemId, silent = false) {
    return callAsyncAction('toggleFav', [itemId, silent], () => false);
}

/**
 * Loads user favorites from database / storage
 * @returns {Promise<any[]>}
 */
export function loadFavorites() {
    return callAsyncAction('loadFavorites', [], () => {
        const s = getStore();
        return s ? (s.favorites || []) : [];
    });
}

/**
 * Updates UI favorite badge counters across the site
 */
export function updateFavBadge() {
    return callAction('updateFavBadge');
}

/**
 * Subscribes to Supabase auth state changes
 */
export function initAuthListener() {
    return callAction('initAuthListener');
}
