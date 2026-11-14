import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Читает js/catalog/catalog.js и рекурсивно разворачивает локальные `import`/`export ... from './...'`
 * в строгом порядке модулей. Позволяет структурным тестам проверять код каталога
 * независимо от разбиения на подмодули в js/catalog/.
 * @param {string} [entryRelativePath='js/catalog/catalog.js']
 * @param {Set<string>} [visited]
 * @returns {string}
 */
export function readCatalogSource(entryRelativePath = 'js/catalog/catalog.js', visited = new Set()) {
    const absPath = resolve(ROOT_DIR, entryRelativePath);
    if (visited.has(absPath)) return '';
    visited.add(absPath);

    const dir = dirname(absPath);
    const raw = readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n');

    return raw.replace(
        /^\s*(?:export\s+(?:\*|\{[^}]*\})\s+from|import(?:\s+[\s\S]*?\s+from)?)\s+['"](\.[^'"]+)['"]\s*;\s*$/gm,
        (_, importPath) => {
            const targetAbs = resolve(dir, importPath);
            const relFromRoot = targetAbs.slice(ROOT_DIR.length + 1);
            return readCatalogSource(relFromRoot, visited);
        }
    );
}
