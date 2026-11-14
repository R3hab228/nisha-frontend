import { readCatalogSource } from './readCatalogSource.js';

/**
 * Reads `js/ui/windows.js` and expands its relative submodule imports/exports
 * so structural tests remain resilient across modularization.
 * @returns {string}
 */
export function readWindowsSource() {
    return readCatalogSource('js/ui/windows.js');
}
