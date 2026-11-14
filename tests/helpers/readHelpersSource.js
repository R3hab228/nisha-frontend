import { readCatalogSource } from './readCatalogSource.js';

/**
 * Reads `js/core/helpers.js` together with all modular ES imports inside `js/core/helpers-*.js`.
 * @returns {string}
 */
export function readHelpersSource() {
    return readCatalogSource('js/core/helpers.js');
}
