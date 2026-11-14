import { readCatalogSource } from './readCatalogSource.js';

/**
 * Читает js/drop/drop.js и рекурсивно разворачивает локальные `import`/`export ... from './...'`
 * в строгом порядке модулей. Позволяет структурным тестам проверять код предложки
 * независимо от разбиения на подмодули в js/drop/.
 * @returns {string}
 */
export function readDropSource() {
    return readCatalogSource('js/drop/drop.js');
}
