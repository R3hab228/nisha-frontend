// ==========================================
// NISHA STORE - MODULAR REVIEWS FACADE
// Safe, typed ES module exports for customer reviews & feedback
// ==========================================

import { callAction, callAsyncAction } from './_facade.js';

/**
 * Opens individual review photo in PhotoSwipe lightbox
 * @param {string} url
 * @returns {Promise<void>}
 */
export function openReviewImage(url) {
    return callAsyncAction('openReviewImage', [url]);
}

/**
 * Opens customer reviews modal dialog and loads latest reviews
 * @returns {Promise<void>}
 */
export function openReviewsModal() {
    return callAsyncAction('openReviewsModal');
}

/**
 * Shifts reviews horizontal carousel by direction (-1 / 1)
 * @param {number} direction
 */
export function scrollReviews(direction) {
    return callAction('scrollReviews', [direction]);
}

/**
 * Normalizes heights across all rendered review cards
 */
export function equalizeReviewCardHeights() {
    return callAction('equalizeReviewCardHeights');
}

/**
 * Prompts user to leave a review for delivered order
 * @param {string|number} orderId
 * @param {string} [itemName]
 * @param {string} [itemImage]
 * @param {string|number} [itemId]
 */
export function promptOrderReview(orderId, itemName, itemImage, itemId) {
    return callAction('promptOrderReview', [orderId, itemName, itemImage, itemId]);
}

/**
 * Submits review payload to backend API with Supabase fallback
 * @param {Record<string, any>} payload
 * @returns {Promise<{ success: boolean, data?: any, error?: any }>}
 */
export function sendReviewPayload(payload) {
    return callAsyncAction('sendReviewPayload', [payload], () => ({
        success: false,
        error: new Error('Runtime environment not available')
    }));
}

/**
 * Submits auto-review for delivered package
 * @returns {Promise<void>}
 */
export function submitAutoReview() {
    return callAsyncAction('submitAutoReview');
}

/**
 * Skips review prompt and marks order review as dismissed
 */
export function skipAutoReview() {
    return callAction('skipAutoReview');
}

/**
 * Navigates to write manual review dialog
 */
export function writeReviewOnSite() {
    return callAction('writeReviewOnSite');
}

/**
 * Submits manual customer review
 * @returns {Promise<void>}
 */
export function submitManualReview() {
    return callAsyncAction('submitManualReview');
}

/**
 * Initializes Supabase Postgres realtime broadcast for incoming reviews
 * @param {any} [sb]
 */
export function initReviewsRealtime(sb) {
    return callAction('initReviewsRealtime', [sb]);
}
