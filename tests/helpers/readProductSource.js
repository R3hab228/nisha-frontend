import { readCatalogSource } from './readCatalogSource.js';

/**
 * Reads `js/product/product.js` together with any modular ES imports inside `js/product/`.
 * @returns {string}
 */
export function readProductSource() {
    return readCatalogSource('js/product/product.js');
}
