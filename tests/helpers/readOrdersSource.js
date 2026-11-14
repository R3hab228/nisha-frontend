import { readCatalogSource } from './readCatalogSource.js';

/**
 * Читает js/orders/orders.js и рекурсивно разворачивает локальные `import`/`export ... from './...'`
 * в строгом порядке модулей. Позволяет структурным тестам проверять код заказов
 * независимо от разбиения на подмодули в js/orders/.
 * @returns {string}
 */
export function readOrdersSource() {
    return readCatalogSource('js/orders/orders.js');
}
