import { readCatalogSource } from './readCatalogSource.js';

/**
 * Читает js/cart/cart.js и рекурсивно разворачивает локальные `import`/`export ... from './...'`
 * в строгом порядке модулей. Позволяет структурным тестам проверять код корзины и чекаута
 * независимо от разбиения на подмодули в js/cart/.
 * @returns {string}
 */
export function readCartSource() {
    return readCatalogSource('js/cart/cart.js');
}
