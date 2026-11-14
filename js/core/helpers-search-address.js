// ==========================================
// NISHA CORE HELPERS: SEARCH SYNONYMS, PRICE PARSING, ADDRESS & NAME NORMALIZATION
// ==========================================

import { hasOwn } from './helpers-core-utils.js';
import { registerActions } from './action-registry.js';

export const SEARCH_SYNONYMS = {
    'найк': 'nike', 'найки': 'nike', 'адидас': 'adidas', 'адики': 'adidas',
    'пума': 'puma', 'левис': 'levis', 'левайс': 'levis', 'кархарт': 'carhartt',
    'кархартт': 'carhartt', 'каргарт': 'carhartt', 'стон': 'stone island',
    'стоник': 'stone island', 'айленд': 'island', 'армани': 'armani',
    'гесс': 'guess', 'гэсс': 'guess', 'рибок': 'reebok', 'ванс': 'vans',
    'вэнс': 'vans', 'нью беланс': 'new balance', 'нью баланс': 'new balance',
    'ньюбики': 'new balance', 'ральф': 'ralph lauren polo', 'поло': 'polo',
    'саутпол': 'southpole', 'соутпол': 'southpole', 'рокавер': 'rocawear',
    'эвис': 'evisu', 'эвису': 'evisu', 'норс фейс': 'the north face',
    'тнф': 'the north face', 'патагония': 'patagonia', 'диккис': 'dickies',
    'дикис': 'dickies', 'зилла': 'zilla', 'стэсси': 'stussy', 'стусси': 'stussy',
    'суприм': 'supreme', 'худи': 'hoodie', 'худак': 'hoodie', 'толстовка': 'hoodie sweatshirt',
    'зипка': 'zip hoodie', 'зип': 'zip', 'ветровка': 'jacket windbreaker',
    'куртка': 'jacket', 'пуховик': 'down jacket puffer', 'свитшот': 'sweatshirt',
    'кофта': 'sweater knitwear', 'свитер': 'sweater', 'футболка': 't-shirt tee',
    'тишка': 't-shirt tee', 'майка': 'tank top', 'лонгслив': 'longsleeve',
    'штаны': 'pants trousers', 'штани': 'pants', 'джинсы': 'jeans denim',
    'джинси': 'jeans denim', 'шорты': 'shorts', 'шорти': 'shorts',
    'кепка': 'cap hat', 'шапка': 'beanie hat', 'рюкзак': 'backpack',
    'сумка': 'bag', 'кроссовки': 'sneakers shoes', 'кроссы': 'sneakers',
    'кроси': 'sneakers', 'кеды': 'sneakers shoes vans'
};

export const CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ґ': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y',
    'э': 'e', 'ю': 'yu', 'я': 'ya', 'є': 'ye'
};

/**
 * Transliterates Cyrillic text into Latin characters for bilingual catalog search.
 * @param {string} str
 * @returns {string}
 */
export function transliterateCyrillic(str) {
    if (!str || typeof str !== 'string') return '';
    return str.split('').map(char => {
        const lower = char.toLowerCase();
        return hasOwn(CYRILLIC_TO_LATIN, lower) ? CYRILLIC_TO_LATIN[lower] : char;
    }).join('');
}
if (typeof window !== 'undefined') window.transliterateCyrillic = transliterateCyrillic;

/**
 * Expands a search query using brand/category synonyms and Cyrillic transliteration.
 * @param {string} query
 * @returns {string[]}
 */
export function expandSearchQuery(query) {
    if (!query || typeof query !== 'string') return [];
    const clean = query.replace(/[#&]/g, '').trim().toLowerCase();
    if (!clean) return [];

    const variants = new Set();
    variants.add(clean);

    // 1. Direct lookup in synonym map
    if (hasOwn(SEARCH_SYNONYMS, clean)) {
        SEARCH_SYNONYMS[clean].split(' ').forEach(w => variants.add(w));
    }

    // 2. Word-by-word replacement in multi-word queries
    const words = clean.split(/\s+/);
    if (words.length > 1) {
        let hasWordSynonym = false;
        const replacedWords = words.map(w => {
            if (hasOwn(SEARCH_SYNONYMS, w)) {
                hasWordSynonym = true;
                return SEARCH_SYNONYMS[w].split(' ').at(0);
            }
            return w;
        });
        if (hasWordSynonym) {
            variants.add(replacedWords.join(' '));
        }
    }

    // 3. Cyrillic -> Latin transliteration
    if (/[а-яёіїєґ]/i.test(clean)) {
        const translit = transliterateCyrillic(clean);
        if (translit && translit !== clean) {
            variants.add(translit);
        }
    }

    return Array.from(variants);
}
if (typeof window !== 'undefined') window.expandSearchQuery = expandSearchQuery;

/**
 * Parses price search syntax ("800", "800грн", "до 800", "от 800", "500-800").
 * @param {string} query
 * @returns {{ type: 'range'|'max'|'min'|'exact', price: number, min?: number, max?: number }|null}
 */
export function parsePriceSearchQuery(query) {
    if (!query || typeof query !== 'string') return null;
    const clean = query.trim().toLowerCase();

    // 1. Range: "500-800", "500 - 800 грн", "500..800", "500 to 800"
    const rangeMatch = clean.match(/^(\d+(?:[\s.,]\d+)?)\s*(?:-|–|—|\.\.|to)\s*(\d+(?:[\s.,]\d+)?)\s*(?:грн|uah|гривен|гривень|гр|г|₴)?\.?$/i);
    if (rangeMatch) {
        const min = Number.parseInt(rangeMatch[1].replace(/[\s.,]/g, ''), 10);
        const max = Number.parseInt(rangeMatch[2].replace(/[\s.,]/g, ''), 10);
        if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
            return { type: 'range', min: Math.min(min, max), max: Math.max(min, max), price: Math.min(min, max) };
        }
    }

    // 2. Upper bound: "до 800", "<= 800", "< 800"
    const maxMatch = clean.match(/^(?:до|<=|<)\s*(\d+(?:[\s.,]\d+)?)\s*(?:грн|uah|гривен|гривень|гр|г|₴)?\.?$/i);
    if (maxMatch) {
        const val = Number.parseInt(maxMatch[1].replace(/[\s.,]/g, ''), 10);
        if (Number.isFinite(val) && val > 0) {
            return { type: 'max', max: val, price: val };
        }
    }

    // 3. Lower bound: "от 800", "від 800", ">= 800", "> 800"
    const minMatch = clean.match(/^(?:от|від|>=|>)\s*(\d+(?:[\s.,]\d+)?)\s*(?:грн|uah|гривен|гривень|гр|г|₴)?\.?$/i);
    if (minMatch) {
        const val = Number.parseInt(minMatch[1].replace(/[\s.,]/g, ''), 10);
        if (Number.isFinite(val) && val > 0) {
            return { type: 'min', min: val, price: val };
        }
    }

    // 4. Exact price: "800", "800грн", "800 uah", "800₴"
    const exactMatch = clean.match(/^(\d+(?:[\s.,]\d+)?)\s*(?:грн|uah|гривен|гривень|гр|г|₴)?\.?$/i);
    if (exactMatch) {
        const val = Number.parseInt(exactMatch[1].replace(/[\s.,]/g, ''), 10);
        if (Number.isFinite(val) && val > 0) {
            return { type: 'exact', price: val };
        }
    }

    return null;
}
if (typeof window !== 'undefined') window.parsePriceSearchQuery = parsePriceSearchQuery;

/**
 * Checks whether a catalog item matches a parsed price query.
 * @param {Object} item
 * @param {Object} priceQuery
 * @returns {boolean}
 */
export function itemMatchesPrice(item, priceQuery) {
    if (!item || !priceQuery) return false;
    const rawPrice = item.price;
    const price = typeof rawPrice === 'number'
        ? rawPrice
        : (Number.parseInt(String(rawPrice || '').replace(/[^\d]/g, ''), 10) || 0);
    const oldPrice = (item.old_price !== null && item.old_price !== undefined)
        ? (typeof item.old_price === 'number' ? item.old_price : (Number.parseInt(String(item.old_price).replace(/[^\d]/g, ''), 10) || null))
        : null;

    if (priceQuery.type === 'exact') {
        return price === priceQuery.price || (oldPrice !== null && oldPrice === priceQuery.price);
    }
    if (priceQuery.type === 'max') {
        return price <= priceQuery.max;
    }
    if (priceQuery.type === 'min') {
        return price >= priceQuery.min;
    }
    if (priceQuery.type === 'range') {
        return price >= priceQuery.min && price <= priceQuery.max;
    }
    return false;
}
if (typeof window !== 'undefined') window.itemMatchesPrice = itemMatchesPrice;

/**
 * Parses a saved delivery address into city and branch/postomat without breaking regional commas.
 * @param {string} addr
 * @returns {{ city: string, branch: string }}
 */
export function parseDeliveryAddress(addr) {
    if (!addr || typeof addr !== 'string') return { city: '', branch: '' };
    const str = addr.trim();
    if (!str) return { city: '', branch: '' };

    // 1. Look for branch/postomat markers with Cyrillic-safe word boundaries
    const markerMatch = str.match(/,\s*(відділення|поштомат|пункт|склад|отделение|почтомат|нова\s*пошта|№|відд\.?|отд\.?)(?![а-яёіїєa-z0-9])/i);
    if (markerMatch && markerMatch.index !== undefined) {
        const cityPart = str.slice(0, markerMatch.index).trim();
        const branchPart = str.slice(markerMatch.index).replace(/^,\s*/, '').trim();
        return { city: cityPart, branch: branchPart };
    }

    // 2. Fallback: split by comma preserving oblast/raion parts in city
    const parts = str.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) {
        return { city: str, branch: '' };
    }

    let splitIdx = 1;
    while (splitIdx < parts.length && /обл|район|р-н/i.test(parts[splitIdx])) {
        splitIdx++;
    }
    if (splitIdx >= parts.length) {
        return { city: parts.join(', '), branch: '' };
    }
    return {
        city: parts.slice(0, splitIdx).join(', '),
        branch: parts.slice(splitIdx).join(', ')
    };
}
if (typeof window !== 'undefined') window.parseDeliveryAddress = parseDeliveryAddress;

// ==========================================
// FULL NAME AUTO-CAPITALIZATION (ФИО / ПІБ)
// ==========================================

/**
 * Strips non-name characters and capitalizes the first letter of each word/hyphenated part.
 * @param {string} val
 * @returns {string}
 */
export function formatFullNameWords(val) {
    if (!val || typeof val !== 'string') return '';
    const cleaned = val.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '');
    return cleaned.replace(/(^|[\s\-])([a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ])/g, (match, sep, char) => {
        return sep + char.toUpperCase();
    });
}
if (typeof window !== 'undefined') window.formatFullNameWords = formatFullNameWords;

/**
 * Normalizes full name spacing and Title Case on input blur.
 * @param {string} val
 * @returns {string}
 */
export function normalizeFullNameOnBlur(val) {
    if (!val || typeof val !== 'string') return '';
    return val
        .replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '')
        .split(' ')
        .filter(Boolean)
        .map(word => {
            return word.split('-').map(part => {
                if (!part) return '';
                if (part === part.toUpperCase() || part === part.toLowerCase()) {
                    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
                }
                return part;
            }).join('-');
        })
        .join(' ');
}
if (typeof window !== 'undefined') window.normalizeFullNameOnBlur = normalizeFullNameOnBlur;

/**
 * Binds live word capitalization and blur normalization onto a full name input element.
 * @param {HTMLInputElement|null} input
 */
export function attachFullNameAutoCapitalize(input) {
    if (!input || input._nameCapBound) return;
    input._nameCapBound = true;

    if (typeof input.addEventListener === 'function') {
        input.addEventListener('input', () => {
            const orig = input.value;
            const formatted = formatFullNameWords(orig);
            if (orig !== formatted) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = formatted;
                if (typeof input.setSelectionRange === 'function' && start !== null && end !== null) {
                    input.setSelectionRange(start, end);
                }
            }
        });

        input.addEventListener('blur', () => {
            if (input.value) {
                input.value = normalizeFullNameOnBlur(input.value);
            }
        });
    }
}
if (typeof window !== 'undefined') window.attachFullNameAutoCapitalize = attachFullNameAutoCapitalize;

registerActions({
    expandSearchQuery,
    parsePriceSearchQuery,
    itemMatchesPrice,
    parseDeliveryAddress,
    attachFullNameAutoCapitalize
});
