import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function flattenKeys(obj, prefix = '') {
    const result = new Map();
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            for (const [nestedKey, nestedVal] of flattenKeys(value, fullKey)) {
                result.set(nestedKey, nestedVal);
            }
        } else {
            result.set(fullKey, value);
        }
    }
    return result;
}

describe('i18n Locale Completeness (ua / ru / en)', () => {
    const localesDir = path.resolve(import.meta.dirname, '../locales');
    const ua = JSON.parse(fs.readFileSync(path.join(localesDir, 'ua.json'), 'utf8'));
    const ru = JSON.parse(fs.readFileSync(path.join(localesDir, 'ru.json'), 'utf8'));
    const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

    const uaMap = flattenKeys(ua);
    const ruMap = flattenKeys(ru);
    const enMap = flattenKeys(en);

    it('has identical translation key sets across ua.json, ru.json, and en.json', () => {
        const diffSets = (a, b) => [...a].filter((k) => !b.has(k));
        const uaKeys = new Set(uaMap.keys());
        const ruKeys = new Set(ruMap.keys());
        const enKeys = new Set(enMap.keys());

        expect(diffSets(uaKeys, ruKeys)).toEqual([]);
        expect(diffSets(ruKeys, uaKeys)).toEqual([]);
        expect(diffSets(uaKeys, enKeys)).toEqual([]);
        expect(diffSets(enKeys, uaKeys)).toEqual([]);
    });

    it('contains no empty string translations in any locale', () => {
        for (const [localeName, map] of [['ua', uaMap], ['ru', ruMap], ['en', enMap]]) {
            const emptyKeys = [];
            for (const [k, v] of map.entries()) {
                if (typeof v === 'string' && v.trim() === '') {
                    emptyKeys.push(`${localeName}:${k}`);
                }
            }
            expect(emptyKeys).toEqual([]);
        }
    });

    it('keeps locales/*.json, public/locales/*.json, locales.json, and public/locales.json 100% synchronized', () => {
        const publicLocalesDir = path.resolve(import.meta.dirname, '../public/locales');
        const rootBundle = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../locales.json'), 'utf8'));
        const publicBundle = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/locales.json'), 'utf8'));

        expect(publicBundle).toEqual(rootBundle);

        for (const [lang, expectedData] of [['ua', ua], ['ru', ru], ['en', en]]) {
            const pubSingle = JSON.parse(fs.readFileSync(path.join(publicLocalesDir, `${lang}.json`), 'utf8'));
            expect(pubSingle).toEqual(expectedData);
            expect(rootBundle[lang]).toEqual(expectedData);
        }
    });
});
