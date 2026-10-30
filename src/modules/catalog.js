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
 * @param {string} [lang='ru']
 * @returns {string}
 */
export function formatMeasurementItem(key, val, lang = 'ru') {
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
