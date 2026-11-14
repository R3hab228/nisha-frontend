import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Читает style.css и рекурсивно разворачивает все локальные `@import './...'`
 * в строгом порядке каскада. Позволяет тестам проверять стили независимо от
 * разбиения CSS на модули в папке css/.
 * @param {string} [entryRelativePath='style.css']
 * @returns {string}
 */
export function readProjectCss(entryRelativePath = 'style.css') {
    const absPath = resolve(ROOT_DIR, entryRelativePath);
    const dir = dirname(absPath);
    const raw = readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n');

    return raw.replace(
        /^\s*@import\s+['"]([^'"]+)['"]\s*;\s*$/gm,
        (_, importPath) => {
            if (!importPath.startsWith('.')) return '';
            const targetAbs = resolve(dir, importPath);
            const relFromRoot = targetAbs.slice(ROOT_DIR.length + 1);
            return readProjectCss(relFromRoot);
        }
    );
}
