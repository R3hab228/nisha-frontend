// ==========================================
// NISHA STORE - MODULAR ANALYTICS FACADE
// Safe, typed ES module exports for Plausible / PostHog / TikTok tracking
// ==========================================

/**
 * Returns active analytics instance
 * @returns {any}
 */
export function getAnalytics() {
    if (typeof window !== 'undefined' && window.analytics) return window.analytics;
    if (typeof globalThis !== 'undefined' && globalThis.analytics) return globalThis.analytics;
    return null;
}

/**
 * Sends custom event to configured analytics providers
 * @param {string} eventName
 * @param {Record<string, any>} [props={}]
 */
export function track(eventName, props = {}) {
    const a = getAnalytics();
    if (a && typeof a.track === 'function') {
        return a.track(eventName, props);
    }
}

/**
 * Tracks product details view
 * @param {any} item
 */
export function trackProductView(item) {
    const a = getAnalytics();
    if (a && typeof a.trackProductView === 'function') {
        return a.trackProductView(item);
    }
}

/**
 * Tracks item addition to shopping cart
 * @param {any} item
 */
export function trackAddToCart(item) {
    const a = getAnalytics();
    if (a && typeof a.trackAddToCart === 'function') {
        return a.trackAddToCart(item);
    }
}

/**
 * Tracks start of order checkout process
 * @param {any[]} [cartItems=[]]
 */
export function trackCheckoutStart(cartItems = []) {
    const a = getAnalytics();
    if (a && typeof a.trackCheckoutStart === 'function') {
        return a.trackCheckoutStart(cartItems);
    }
}

/**
 * Tracks successful order completion
 * @param {{ orderId?: string, items?: any[], value?: number, paymentMethod?: string }} details
 */
export function trackPurchase(details = {}) {
    const a = getAnalytics();
    if (a && typeof a.trackPurchase === 'function') {
        return a.trackPurchase(details);
    }
}

/**
 * Tracks item consignment proposal submission
 * @param {{ brand?: string, price?: number, filesCount?: number }} details
 */
export function trackProposalSubmitted(details = {}) {
    const a = getAnalytics();
    if (a && typeof a.trackProposalSubmitted === 'function') {
        return a.trackProposalSubmitted(details);
    }
}

/**
 * Tracks item favorite addition or removal
 * @param {string|number} itemId
 * @param {boolean} [isAdded=true]
 */
export function trackFavorite(itemId, isAdded = true) {
    const a = getAnalytics();
    if (a && typeof a.trackFavorite === 'function') {
        return a.trackFavorite(itemId, isAdded);
    }
}

/**
 * Initializes privacy-first analytics provider tags
 */
export function initAnalytics() {
    const a = getAnalytics();
    if (a && typeof a.init === 'function') {
        return a.init();
    }
}

/**
 * Modular analytics proxy
 */
export const analytics = new Proxy({}, {
    get(_target, prop) {
        const a = getAnalytics();
        if (!a) return undefined;
        const val = a[prop];
        return typeof val === 'function' ? val.bind(a) : val;
    }
});

export default analytics;
