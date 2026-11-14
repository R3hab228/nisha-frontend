import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../..');

const LAZY_MODAL_STYLESHEETS = [
    'css/lazy-orders-modal.css',
    'css/lazy-drop-modal.css'
];

export function readProjectCss(entryRelativePath = 'style.css') {
    const absPath = resolve(ROOT_DIR, entryRelativePath);
    const dir = dirname(absPath);
    const raw = readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n');

    const expanded = raw.replace(
        /^\s*@import\s+['"]([^'"]+)['"]\s*;\s*$/gm,
        (_, importPath) => {
            if (!importPath.startsWith('.')) return '';
            const targetAbs = resolve(dir, importPath);
            const relFromRoot = targetAbs.slice(ROOT_DIR.length + 1);
            return readProjectCss(relFromRoot);
        }
    );

    if (entryRelativePath !== 'style.css') {
        return expanded;
    }

    const lazyChunks = LAZY_MODAL_STYLESHEETS.map(relPath =>
        readFileSync(resolve(ROOT_DIR, relPath), 'utf8').replace(/\r\n/g, '\n')
    );

    return [expanded, ...lazyChunks].join('\n');
}
