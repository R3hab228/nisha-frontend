// ==========================================
// NISHA STORE - MODULAR CATALOG FACADE
// Safe, typed ES module exports for catalog & product display
// ==========================================

import { callAction, callAsyncAction } from './_facade.js';
import { getStore } from './store.js';

/**
 * Loads all catalog items from backend / cache
 * @param {boolean} [forceReload=false]
 * @returns {Promise<any[]>}
 */
export function loadAllItems(forceReload = false) {
    return callAsyncAction('loadAllItems', [forceReload], () => []);
}

/**
 * Returns current loaded items catalog
 * @returns {any[]}
 */
export function getCatalog() {
    return callAction('getCatalog', [], () => {
        const s = getStore();
        if (s && Array.isArray(s.allItems)) {
            return s.allItems;
        }
        if (typeof window !== 'undefined' && Array.isArray(window.items)) {
            return window.items;
        }
        return [];
    });
}

/**
 * Applies active category, search and size filters to grid
 */
export function applyFilters() {
    return callAction('applyFilters');
}

/**
 * Triggers smooth filter change with View Transitions API for checkboxes and sorting
 * @returns {any}
 */
export function triggerFilterTransition() {
    return callAction('triggerFilterTransition');
}

/**
 * Sets current category filter
 * @param {string} category
 */
export function setCategoryFilter(category) {
    return callAction('setCategoryFilter', [category]);
}

/**
 * Extracts measurements schema from item
 * @param {any} item
 * @returns {Record<string, any>}
 */
export function extractItemMeasurements(item) {
    return callAction('extractItemMeasurements', [item], () => ({}));
}

/**
 * Formats individual measurement value for tooltip
 * @param {string} key
 * @param {any} val
 * @param {string} [lang='ua']
 * @returns {string}
 */
export function formatMeasurementItem(key, val, lang = 'ua') {
    return callAction('formatMeasurementItem', [key, val, lang], (k, v) => `${k}: ${v}`);
}

/**
 * Shows interactive measurements tooltip near hover element
 * @param {any} itemOrId
 * @param {MouseEvent|TouchEvent} e
 */
export function showItemMeasurementsTooltip(itemOrId, e) {
    return callAction('showItemMeasurementsTooltip', [itemOrId, e]);
}

/**
 * Hides active measurements tooltip
 */
export function hideItemMeasurementsTooltip() {
    return callAction('hideItemMeasurementsTooltip');
}

/**
 * Inserts new item card into grid smoothly with animation
 * @param {any} item
 */
export function insertNewItemCardSmoothly(item) {
    return callAction('insertNewItemCardSmoothly', [item]);
}

/**
 * Renders next chunk of items in infinite scroll
 */
export function renderNextBatch() {
    return callAction('renderNextBatch');
}

/**
 * Updates item counters in sidebar categories
 */
export function updateSidebarCounters() {
    return callAction('updateSidebarCounters');
}

/**
 * Filters view to favorite items only
 */
export function filterFavorites() {
    return callAction('filterFavorites');
}

/**
 * Sorts catalog items by sort type
 * @param {string} sortType
 */
export function sortItems(sortType) {
    return callAction('sortItems', [sortType]);
}

/**
 * Clears search input and resets search filter
 */
export function clearSearchInput() {
    return callAction('clearSearchInput');
}

/**
 * Starts interactive onboarding tour
 */
export function startOnboardingTour() {
    return callAction('startOnboardingTour');
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
