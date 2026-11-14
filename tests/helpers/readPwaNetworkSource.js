import { readCatalogSource } from './readCatalogSource.js';

/**
 * Читает js/core/pwa-network.js и рекурсивно разворачивает все локальные ES-подмодули js/core/pwa-*.js.
 * Позволяет структурным тестам проверять код PWA/сети независимо от модульного разбиения.
 * @returns {string}
 */
export function readPwaNetworkSource() {
    return readCatalogSource('js/core/pwa-network.js');
}
