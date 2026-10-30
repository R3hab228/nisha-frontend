// ==========================================
// NISHA STORE - MODULAR PROFILE & AUTH FACADE
// Safe, typed ES module exports for profile, auth & favorites
// ==========================================

import { getStore } from './store.js';

/**
 * Opens user profile or auth modal dialog
 */
export function openProfileModal() {
    if (typeof window !== 'undefined' && typeof window.openProfileModal === 'function') {
        return window.openProfileModal();
    }
}

/**
 * Checks current Supabase authentication session
 * @returns {Promise<any>}
 */
export async function checkSession() {
    if (typeof window !== 'undefined' && typeof window.checkSession === 'function') {
        return window.checkSession();
    }
    return null;
}

/**
 * Toggles between Login and Registration mode in modal
 */
export function toggleRegMode() {
    if (typeof window !== 'undefined' && typeof window.toggleRegMode === 'function') {
        return window.toggleRegMode();
    }
}

/**
 * Handles email/password authentication submission
 * @param {Event} [event]
 * @returns {Promise<void>}
 */
export async function handleAuth(event) {
    if (typeof window !== 'undefined' && typeof window.handleAuth === 'function') {
        return window.handleAuth(event);
    }
}

/**
 * Triggers forgot password reset flow
 * @returns {Promise<void>}
 */
export async function handleForgotPassword() {
    if (typeof window !== 'undefined' && typeof window.handleForgotPassword === 'function') {
        return window.handleForgotPassword();
    }
}

/**
 * Logs out current authenticated user and cleans state
 * @returns {Promise<void>}
 */
export async function logout() {
    if (typeof window !== 'undefined' && typeof window.logout === 'function') {
        return window.logout();
    }
}

/**
 * Initiates Google OAuth Sign-in flow
 * @returns {Promise<void>}
 */
export async function loginWithGoogle() {
    if (typeof window !== 'undefined' && typeof window.loginWithGoogle === 'function') {
        return window.loginWithGoogle();
    }
}

/**
 * Toggles input password mask visibility
 * @param {string} inputId
 * @param {HTMLElement} [iconElement]
 */
export function togglePasswordVisibility(inputId, iconElement) {
    if (typeof window !== 'undefined' && typeof window.togglePasswordVisibility === 'function') {
        return window.togglePasswordVisibility(inputId, iconElement);
    }
}

/**
 * Toggles favorite state for item
 * @param {string|number} itemId
 * @param {boolean} [silent=false]
 * @returns {Promise<boolean>}
 */
export async function toggleFav(itemId, silent = false) {
    if (typeof window !== 'undefined' && typeof window.toggleFav === 'function') {
        return window.toggleFav(itemId, silent);
    }
    return false;
}

/**
 * Loads user favorites from database / storage
 * @returns {Promise<any[]>}
 */
export async function loadFavorites() {
    if (typeof window !== 'undefined' && typeof window.loadFavorites === 'function') {
        return window.loadFavorites();
    }
    const s = getStore();
    return s ? (s.favorites || []) : [];
}

/**
 * Updates UI favorite badge counters across the site
 */
export function updateFavBadge() {
    if (typeof window !== 'undefined' && typeof window.updateFavBadge === 'function') {
        return window.updateFavBadge();
    }
}


/**
 * Subscribes to Supabase auth state changes
 */
export function initAuthListener() {
    if (typeof window !== 'undefined' && typeof window.initAuthListener === 'function') {
        return window.initAuthListener();
    }
}
