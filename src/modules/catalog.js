// ==========================================
// NISHA STORE - MODULAR CATALOG FACADE
// Safe, typed ES module exports for catalog & product display
// ==========================================

/**
 * Loads all catalog items from backend / cache
 * @param {boolean} [forceReload=false]
 * @returns {Promise<any[]>}
 */
export async function loadAllItems(forceReload = false) {
    if (typeof window !== 'undefined' && typeof window.loadAllItems === 'function') {
        return window.loadAllItems(forceReload);
    }
    return [];
}

/**
 * Returns current loaded items catalog
 * @returns {any[]}
 */
export function getCatalog() {
    if (typeof window !== 'undefined' && typeof window.getCatalog === 'function') {
        return window.getCatalog();
    }
    if (typeof window !== 'undefined' && Array.isArray(window.items)) {
        return window.items;
    }
    return [];
}

/**
 * Applies active category, search and size filters to grid
 */
export function applyFilters() {
    if (typeof window !== 'undefined' && typeof window.applyFilters === 'function') {
        return window.applyFilters();
    }
}

/**
 * Triggers smooth filter change with View Transitions API for checkboxes and sorting
 * @returns {any}
 */
export function triggerFilterTransition() {
    if (typeof window !== 'undefined' && typeof window.triggerFilterTransition === 'function') {
        return window.triggerFilterTransition();
    }
}

/**
 * Sets current category filter
 * @param {string} category
 */
export function setCategoryFilter(category) {
    if (typeof window !== 'undefined' && typeof window.setCategoryFilter === 'function') {
        return window.setCategoryFilter(category);
    }
}

/**
 * Extracts measurements schema from item
 * @param {any} item
 * @returns {Record<string, any>}
 */
export function extractItemMeasurements(item) {
    if (typeof window !== 'undefined' && typeof window.extractItemMeasurements === 'function') {
        return window.extractItemMeasurements(item);
    }
    return {};
}

/**
 * Formats individual measurement value for tooltip
 * @param {string} key
 * @param {any} val
 * @param {string} [lang='ua']
 * @returns {string}
 */
export function formatMeasurementItem(key, val, lang = 'ua') {
    if (typeof window !== 'undefined' && typeof window.formatMeasurementItem === 'function') {
        return window.formatMeasurementItem(key, val, lang);
    }
    return `${key}: ${val}`;
}

/**
 * Shows interactive measurements tooltip near hover element
 * @param {any} itemOrId
 * @param {MouseEvent|TouchEvent} e
 */
export function showItemMeasurementsTooltip(itemOrId, e) {
    if (typeof window !== 'undefined' && typeof window.showItemMeasurementsTooltip === 'function') {
        return window.showItemMeasurementsTooltip(itemOrId, e);
    }
}

/**
 * Hides active measurements tooltip
 */
export function hideItemMeasurementsTooltip() {
    if (typeof window !== 'undefined' && typeof window.hideItemMeasurementsTooltip === 'function') {
        return window.hideItemMeasurementsTooltip();
    }
}

/**
 * Inserts new item card into grid smoothly with animation
 * @param {any} item
 */
export function insertNewItemCardSmoothly(item) {
    if (typeof window !== 'undefined' && typeof window.insertNewItemCardSmoothly === 'function') {
        return window.insertNewItemCardSmoothly(item);
    }
}

/**
 * Renders next chunk of items in infinite scroll
 */
export function renderNextBatch() {
    if (typeof window !== 'undefined' && typeof window.renderNextBatch === 'function') {
        return window.renderNextBatch();
    }
}

/**
 * Updates item counters in sidebar categories
 */
export function updateSidebarCounters() {
    if (typeof window !== 'undefined' && typeof window.updateSidebarCounters === 'function') {
        return window.updateSidebarCounters();
    }
}

/**
 * Filters view to favorite items only
 */
export function filterFavorites() {
    if (typeof window !== 'undefined' && typeof window.filterFavorites === 'function') {
        return window.filterFavorites();
    }
}

/**
 * Sorts catalog items by sort type
 * @param {string} sortType
 */
export function sortItems(sortType) {
    if (typeof window !== 'undefined' && typeof window.sortItems === 'function') {
        return window.sortItems(sortType);
    }
}

/**
 * Clears search input and resets search filter
 */
export function clearSearchInput() {
    if (typeof window !== 'undefined' && typeof window.clearSearchInput === 'function') {
        return window.clearSearchInput();
    }
}

/**
 * Starts interactive onboarding tour
 */
export function startOnboardingTour() {
    if (typeof window !== 'undefined' && typeof window.startOnboardingTour === 'function') {
        return window.startOnboardingTour();
    }
}

/**
 * Checks if an item supports bargaining (ТОРГ)
 * @param {Object} item - Product item
 * @returns {boolean}
 */
export function isItemBargainEnabled(item) {
    if (!item || item.status === 'sold') return false;
    if (item.is_bargain === true || String(item.is_bargain) === 'true' || item.is_bargain === 1) return true;
    if (item.min_bargain_price !== null && item.min_bargain_price !== undefined && Number(item.min_bargain_price) > 0) return true;
    if (typeof item.description === 'string' && /(?:\[\s*(?:торг|bargain)|(?<![\p{L}\p{N}_])торг(?![\p{L}\p{N}_]))/iu.test(item.description)) return true;
    return false;
}
