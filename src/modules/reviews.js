// ==========================================
// NISHA STORE - MODULAR REVIEWS FACADE
// Safe, typed ES module exports for customer reviews & feedback
// ==========================================

/**
 * Opens individual review photo in PhotoSwipe lightbox
 * @param {string} url
 * @returns {Promise<void>}
 */
export async function openReviewImage(url) {
    if (typeof window !== 'undefined' && typeof window.openReviewImage === 'function') {
        return window.openReviewImage(url);
    }
}

/**
 * Opens customer reviews modal dialog and loads latest reviews
 * @returns {Promise<void>}
 */
export async function openReviewsModal() {
    if (typeof window !== 'undefined' && typeof window.openReviewsModal === 'function') {
        return window.openReviewsModal();
    }
}

/**
 * Shifts reviews horizontal carousel by direction (-1 / 1)
 * @param {number} direction
 */
export function scrollReviews(direction) {
    if (typeof window !== 'undefined' && typeof window.scrollReviews === 'function') {
        return window.scrollReviews(direction);
    }
}

/**
 * Normalizes heights across all rendered review cards
 */
export function equalizeReviewCardHeights() {
    if (typeof window !== 'undefined' && typeof window.equalizeReviewCardHeights === 'function') {
        return window.equalizeReviewCardHeights();
    }
}

/**
 * Prompts user to leave a review for delivered order
 * @param {string|number} orderId
 * @param {string} [itemName]
 * @param {string} [itemImage]
 * @param {string|number} [itemId]
 */
export function promptOrderReview(orderId, itemName, itemImage, itemId) {
    if (typeof window !== 'undefined' && typeof window.promptOrderReview === 'function') {
        return window.promptOrderReview(orderId, itemName, itemImage, itemId);
    }
}

/**
 * Submits review payload to backend API with Supabase fallback
 * @param {Record<string, any>} payload
 * @returns {Promise<{ success: boolean, data?: any, error?: any }>}
 */
export async function sendReviewPayload(payload) {
    if (typeof window !== 'undefined' && typeof window.sendReviewPayload === 'function') {
        return window.sendReviewPayload(payload);
    }
    return { success: false, error: new Error('Runtime environment not available') };
}

/**
 * Submits auto-review for delivered package
 * @returns {Promise<void>}
 */
export async function submitAutoReview() {
    if (typeof window !== 'undefined' && typeof window.submitAutoReview === 'function') {
        return window.submitAutoReview();
    }
}

/**
 * Skips review prompt and marks order review as dismissed
 */
export function skipAutoReview() {
    if (typeof window !== 'undefined' && typeof window.skipAutoReview === 'function') {
        return window.skipAutoReview();
    }
}

/**
 * Navigates to write manual review dialog
 */
export function writeReviewOnSite() {
    if (typeof window !== 'undefined' && typeof window.writeReviewOnSite === 'function') {
        return window.writeReviewOnSite();
    }
}

/**
 * Submits manual customer review
 * @returns {Promise<void>}
 */
export async function submitManualReview() {
    if (typeof window !== 'undefined' && typeof window.submitManualReview === 'function') {
        return window.submitManualReview();
    }
}

/**
 * Initializes Supabase Postgres realtime broadcast for incoming reviews
 * @param {any} [sb]
 */
export function initReviewsRealtime(sb) {
    if (typeof window !== 'undefined' && typeof window.initReviewsRealtime === 'function') {
        return window.initReviewsRealtime(sb);
    }
}
