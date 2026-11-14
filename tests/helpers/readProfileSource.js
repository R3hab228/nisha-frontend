import { readCatalogSource } from './readCatalogSource.js';

/**
 * Читает js/profile/profile.js и рекурсивно разворачивает все локальные ES-подмодули js/profile/*.js.
 * Позволяет структурным тестам проверять код профиля независимо от разбиения на подмодули.
 * @returns {string}
 */
export function readProfileSource() {
    return readCatalogSource('js/profile/profile.js');
}
