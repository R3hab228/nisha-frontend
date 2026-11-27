// @ts-check
// ==========================================
// NISHA PRODUCT MEASUREMENTS PARSER & TABLE RENDERER
// ==========================================

const MEASUREMENT_CACHE_LIMIT = 250;
const _measurementParseCache = new Map();

/**
 * Canonical measurement term definitions ordered from longest/most-specific phrases
 * to shortest so compound labels match before generic ones.
 * @type {Array<{ pattern: string, key: string, qualifier?: string }>}
 */
const MEASUREMENT_PATTERNS = [
    // Leg opening
    { pattern: 'ширина штанины снизу (выход)', key: 'leg_opening' },
    { pattern: 'ширина штанины внизу (выход)', key: 'leg_opening' },
    { pattern: 'ширина штанины внизу (вихід)', key: 'leg_opening' },
    { pattern: 'ширина штанины на выходе', key: 'leg_opening' },
    { pattern: 'ширина штанини на виході', key: 'leg_opening' },
    { pattern: 'ширина штанины снизу', key: 'leg_opening' },
    { pattern: 'ширина штанины внизу', key: 'leg_opening' },
    { pattern: 'ширина штанини внизу', key: 'leg_opening' },
    { pattern: 'выход штанины', key: 'leg_opening' },
    { pattern: 'вихід штанини', key: 'leg_opening' },
    { pattern: 'leg opening', key: 'leg_opening' },

    // Sleeve (with optional qualifier)
    { pattern: 'довжина рукава від плеча', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'довжина рукава віл плеча', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'длина рукава от плеча', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'длинна рукава от плеча', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'рукава від плечей', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'рукава от плеч', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'рукава от плеча', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'довжина рукава від горла', key: 'sleeve', qualifier: 'from_neck' },
    { pattern: 'довжина рукава віл горла', key: 'sleeve', qualifier: 'from_neck' },
    { pattern: 'длина рукава от горла', key: 'sleeve', qualifier: 'from_neck' },
    { pattern: 'довжина рукава від шва', key: 'sleeve', qualifier: 'from_seam' },
    { pattern: 'довжина рукава віл шва', key: 'sleeve', qualifier: 'from_seam' },
    { pattern: 'длина рукава от шва', key: 'sleeve', qualifier: 'from_seam' },
    { pattern: 'длинна рукава от шва', key: 'sleeve', qualifier: 'from_seam' },
    { pattern: 'рукав від плеча', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'рукав віл плеча', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'рукав от плеча', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'рукав з плечем', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'рукав с плечом', key: 'sleeve', qualifier: 'from_shoulder' },
    { pattern: 'рукав від горла', key: 'sleeve', qualifier: 'from_neck' },
    { pattern: 'рукав віл горла', key: 'sleeve', qualifier: 'from_neck' },
    { pattern: 'рукав от горла', key: 'sleeve', qualifier: 'from_neck' },
    { pattern: 'рукав від шва', key: 'sleeve', qualifier: 'from_seam' },
    { pattern: 'рукав віл шва', key: 'sleeve', qualifier: 'from_seam' },
    { pattern: 'рукав от шва', key: 'sleeve', qualifier: 'from_seam' },
    { pattern: 'довжина рукава', key: 'sleeve' },
    { pattern: 'длина рукава', key: 'sleeve' },
    { pattern: 'длинна рукава', key: 'sleeve' },

    // Waist & half-waist
    { pattern: 'ширина в талії (найвужче місце)', key: 'waist' },
    { pattern: 'ширина в талии (самое узкое место)', key: 'waist' },
    { pattern: 'талія (напівобхват)', key: 'waist' },
    { pattern: 'талія(напівобхват)', key: 'waist' },
    { pattern: 'талія (півобхват)', key: 'waist' },
    { pattern: 'талія(півобхват)', key: 'waist' },
    { pattern: 'талия (полуобхват)', key: 'waist' },
    { pattern: 'талия(полуобхват)', key: 'waist' },
    { pattern: 'пояс (напівобхват)', key: 'half_waist' },
    { pattern: 'пояс(напівобхват)', key: 'half_waist' },
    { pattern: 'пояс (полуобхват)', key: 'half_waist' },
    { pattern: 'пояс(полуобхват)', key: 'half_waist' },
    { pattern: 'полуобхват по поясу', key: 'half_waist' },
    { pattern: 'напівобхват по поясу', key: 'half_waist' },
    { pattern: 'полуобхват талии', key: 'waist' },
    { pattern: 'полу обхват талии', key: 'waist' },
    { pattern: 'пол обхват талии', key: 'waist' },
    { pattern: 'напівобхват талії', key: 'waist' },
    { pattern: 'напів обхват талії', key: 'waist' },
    { pattern: 'півобхват талії', key: 'waist' },
    { pattern: 'пів обхват талії', key: 'waist' },
    { pattern: 'ширина в талии', key: 'waist' },
    { pattern: 'ширина в талії', key: 'waist' },

    // Chest
    { pattern: 'а в грудях (напівобхват під пахвами)', key: 'chest' },
    { pattern: 'ширина в грудях (напівобхват під пахвами)', key: 'chest' },
    { pattern: 'ширина (полуобхват груди)', key: 'chest' },
    { pattern: 'ширина (полуобхват грудей)', key: 'chest' },
    { pattern: 'напівобхват під пахвами', key: 'chest' },
    { pattern: 'напів обхват під пахвами', key: 'chest' },
    { pattern: 'пів обхват під пахвами', key: 'chest' },
    { pattern: 'полуобхват грудей', key: 'chest' },
    { pattern: 'полуобхват груди', key: 'chest' },
    { pattern: 'полу обхват груди', key: 'chest' },
    { pattern: 'пол обхват груди', key: 'chest' },
    { pattern: 'півобхват грудей', key: 'chest' },
    { pattern: 'пів обхват грудей', key: 'chest' },
    { pattern: 'напівобхват грудей', key: 'chest' },
    { pattern: 'напів обхват грудей', key: 'chest' },
    { pattern: 'груди (півобхват)', key: 'chest' },
    { pattern: 'груди (полуобхват)', key: 'chest' },
    { pattern: 'грудь (полуобхват)', key: 'chest' },
    { pattern: 'ширина по пахвах', key: 'chest' },
    { pattern: 'ширина в грудях', key: 'chest' },
    { pattern: 'грудь( пол обхват)', key: 'chest' },
    { pattern: 'грудь (пол обхват)', key: 'chest' },
    { pattern: 'груди повністю', key: 'chest' },
    { pattern: 'pit to pit', key: 'chest' },

    // Shoulders
    { pattern: 'плечи(пол обхват)', key: 'shoulders' },
    { pattern: 'плечи (пол обхват)', key: 'shoulders' },
    { pattern: 'плечи полуобхват', key: 'shoulders' },
    { pattern: 'плечі напівобхват', key: 'shoulders' },
    { pattern: 'ширина плечей', key: 'shoulders' },
    { pattern: 'ширина плеч', key: 'shoulders' },

    // Hips
    { pattern: 'полуобхват бёдер', key: 'hips' },
    { pattern: 'полуобхват бедер', key: 'hips' },
    { pattern: 'полу обхват бедер', key: 'hips' },
    { pattern: 'пол обхват бедер', key: 'hips' },
    { pattern: 'напівобхват стегон', key: 'hips' },
    { pattern: 'напів обхват стегон', key: 'hips' },
    { pattern: 'півобхват стегон', key: 'hips' },
    { pattern: 'пів обхват стегон', key: 'hips' },
    { pattern: 'ширина в бёдрах', key: 'hips' },
    { pattern: 'ширина в бедрах', key: 'hips' },
    { pattern: 'ширина у стегнах', key: 'hips' },

    // Length
    { pattern: 'довжина по спинці', key: 'length' },
    { pattern: 'длина по спинке', key: 'length' },
    { pattern: 'довжина від плеча', key: 'length' },
    { pattern: 'длина от плеча', key: 'length' },
    { pattern: 'длина от пояса', key: 'length' },
    { pattern: 'довжина від пояса', key: 'length' },
    { pattern: 'длина до угла', key: 'length' },
    { pattern: 'общая длина', key: 'length' },
    { pattern: 'загальна довжина', key: 'length' },
    { pattern: 'довжина куртки', key: 'length' },
    { pattern: 'длина куртки', key: 'length' },
    { pattern: 'довжина виробу', key: 'length' },
    { pattern: 'длина изделия', key: 'length' },

    // Inseam, elastic, wrist, neckline, generic width
    { pattern: 'по внутреннему шву', key: 'inseam' },
    { pattern: 'по внутрішньому шву', key: 'inseam' },
    { pattern: 'внутренний шов', key: 'inseam' },
    { pattern: 'внутрішній крок', key: 'inseam' },
    { pattern: 'внутрішній шов', key: 'inseam' },
    { pattern: 'кроковий шов', key: 'inseam' },
    { pattern: 'шаговый шов', key: 'inseam' },
    { pattern: 'обхват запястья', key: 'wrist' },
    { pattern: "обхват зап'ястя", key: 'wrist' },
    { pattern: 'ширина полуобхват', key: 'width' },
    { pattern: 'ширина напівобхват', key: 'width' },
    { pattern: 'ширина резинки', key: 'elastic_width' },
    { pattern: 'ширина вирізу', key: 'neck_width' },
    { pattern: 'ширина выреза', key: 'neck_width' },

    // Single-word terms
    { pattern: 'полупояс', key: 'half_waist' },
    { pattern: 'напівпояс', key: 'half_waist' },
    { pattern: 'полуобхват', key: 'half_measure' },
    { pattern: 'полу обхват', key: 'half_measure' },
    { pattern: 'пол обхват', key: 'half_measure' },
    { pattern: 'напівобхват', key: 'half_measure' },
    { pattern: 'напів обхват', key: 'half_measure' },
    { pattern: 'півобхват', key: 'half_measure' },
    { pattern: 'пів обхват', key: 'half_measure' },
    { pattern: 'посадка', key: 'rise' },
    { pattern: 'rise', key: 'rise' },
    { pattern: 'half waist', key: 'half_waist' },
    { pattern: 'shoulders', key: 'shoulders' },
    { pattern: 'длинна', key: 'length' },
    { pattern: 'довжина', key: 'length' },
    { pattern: 'длина', key: 'length' },
    { pattern: 'length', key: 'length' },
    { pattern: 'ширина', key: 'width' },
    { pattern: 'width', key: 'width' },
    { pattern: 'рукав', key: 'sleeve' },
    { pattern: 'sleeve', key: 'sleeve' },
    { pattern: 'плечи', key: 'shoulders' },
    { pattern: 'плечі', key: 'shoulders' },
    { pattern: 'талия', key: 'waist' },
    { pattern: 'талія', key: 'waist' },
    { pattern: 'waist', key: 'waist' },
    { pattern: 'пояс', key: 'half_waist' },
    { pattern: 'грудь', key: 'chest' },
    { pattern: 'груди', key: 'chest' },
    { pattern: 'chest', key: 'chest' },
    { pattern: 'пог', key: 'chest' },
    { pattern: 'бёдра', key: 'hips' },
    { pattern: 'бедра', key: 'hips' },
    { pattern: 'стегна', key: 'hips' },
    { pattern: 'hips', key: 'hips' },
    { pattern: 'ляжка', key: 'thigh' },
    { pattern: 'ляшка', key: 'thigh' },
    { pattern: 'ляха', key: 'thigh' },
    { pattern: 'стегно', key: 'thigh' },
    { pattern: 'бедро', key: 'thigh' },
    { pattern: 'thigh', key: 'thigh' },
    { pattern: 'колено', key: 'knee' },
    { pattern: 'коліно', key: 'knee' },
    { pattern: 'knee', key: 'knee' },
    { pattern: 'выход', key: 'leg_opening' },
    { pattern: 'вихід', key: 'leg_opening' },
    { pattern: 'шаговый', key: 'inseam' },
    { pattern: 'кроковий', key: 'inseam' },
    { pattern: 'крок', key: 'inseam' },
    { pattern: 'inseam', key: 'inseam' },
    { pattern: 'стелька', key: 'insole' },
    { pattern: 'устілка', key: 'insole' },
    { pattern: 'insole', key: 'insole' },
    { pattern: 'запястье', key: 'wrist' },
    { pattern: 'wrist', key: 'wrist' },
    { pattern: 'высота', key: 'height' },
    { pattern: 'висота', key: 'height' },
    { pattern: 'height', key: 'height' }
];

/** @param {string} str */
function escapeRegExp(str) {
    const regExpEscape = /** @type {any} */ (RegExp).escape;
    return typeof regExpEscape === 'function'
        ? regExpEscape(str)
        : str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const WORD_CHAR_CLASS = 'а-яА-ЯёЁіІїЇєЄґҐa-zA-Z0-9_';
const TERMS_ALTERNATION = MEASUREMENT_PATTERNS.map(p => escapeRegExp(p.pattern)).join('|');
const PATTERN_LOOKUP = new Map(MEASUREMENT_PATTERNS.map(p => [p.pattern, p]));

// Note: uses explicit Cyrillic+Latin boundary instead of JS \b (which treats Cyrillic as \W)
// Also accepts optional parenthetical half-measure qualifiers like "(напівобхват)" / "(полуобхват)" after any term.
const MEASUREMENT_LINE_RE = new RegExp(
    `(^|[^${WORD_CHAR_CLASS}])(${TERMS_ALTERNATION})(?:\\s*\\(\\s*(?:напівобхват|півобхват|полуобхват|пол\\s*обхват)\\s*\\))?(?:[\\s:=\\u2014\\u2013\\-~≈•]+)?(\\d{1,3}(?:[.,]\\d{1,2})?)(?:\\s*(?:см|cm)(?![${WORD_CHAR_CLASS}]))?`,
    'gi'
);
const INSOLE_PREFIX_RE = new RegExp(
    `(^|[^${WORD_CHAR_CLASS}])(\\d{1,2}(?:[.,]\\d{1,2})?)\\s*(?:см|cm)?\\s+(стелька|устілка|insole)(?![${WORD_CHAR_CLASS}])`,
    'gi'
);

/** @type {Record<string, string>} */
const DEFAULT_LABELS = {
    measurements_title: 'ЗАМЕРЫ:',
    meas_cm: 'см',
    meas_length: 'Длина',
    meas_width: 'Ширина',
    meas_chest: 'Грудь',
    meas_shoulders: 'Плечи',
    meas_sleeve: 'Рукав',
    meas_waist: 'Талия',
    meas_half_waist: 'Полупояс',
    meas_hips: 'Бёдра',
    meas_thigh: 'Бедро (ляжка)',
    meas_knee: 'Колено',
    meas_leg_opening: 'Выход штанины',
    meas_inseam: 'Шаговый шов',
    meas_insole: 'Стелька',
    meas_elastic_width: 'Ширина резинки',
    meas_neck_width: 'Ширина выреза',
    meas_half_measure: 'Полуобхват',
    meas_rise: 'Посадка',
    meas_wrist: 'Запястье',
    meas_height: 'Высота',
    meas_qual_from_shoulder: 'от плеча',
    meas_qual_from_seam: 'от шва',
    meas_qual_from_neck: 'от горла'
};

/** @param {string} key */
const _t = (key) => {
    const def = DEFAULT_LABELS[key] || key;
    if (typeof i18next !== 'undefined' && typeof i18next.t === 'function') {
        return i18next.t(`product.${key}`, { defaultValue: def });
    }
    return def;
};

/**
 * Normalizes invisible bidi/zero-width Unicode marks commonly inserted by mobile
 * keyboards/messengers (which otherwise break whitespace & boundary detection).
 * @param {string} raw
 * @returns {string}
 */
function normalizeSourceText(raw) {
    return String(raw || '')
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s*\[ТОРГ:?[^\]]*\]/gi, '')
        .trim();
}

/** @param {string} key @param {any} value */
function setBoundedCache(key, value) {
    if (_measurementParseCache.size >= MEASUREMENT_CACHE_LIMIT) {
        const firstKey = _measurementParseCache.keys().next().value;
        _measurementParseCache.delete(firstKey);
    }
    _measurementParseCache.set(key, value);
}

/**
 * Parses measurement pairs from a raw product description string and returns
 * normalized measurement objects plus the remaining narrative description.
 * Uses an O(1) bounded cache so repeated modal opens never stall the UI.
 * @param {string} rawDescription
 * @returns {{ measurements: Array<{ key: string, qualifier: string|null, value: string }>, cleanText: string }}
 */
export function parseItemMeasurements(rawDescription) {
    const source = normalizeSourceText(rawDescription);
    if (!source) return { measurements: [], cleanText: '' };

    const cached = _measurementParseCache.get(source);
    if (cached) return cached;

    const found = [];
    const matchedSpans = [];
    MEASUREMENT_LINE_RE.lastIndex = 0;

    let match;
    while ((match = MEASUREMENT_LINE_RE.exec(source)) !== null) {
        const prefix = match[1] || '';
        const termRaw = match[2];
        const valueRaw = match[3];
        let startIdx = match.index + prefix.length;
        // Consume leading '--' list bullets immediately adjacent to the term
        if (prefix === '-' && startIdx >= 2 && source.slice(startIdx - 2, startIdx) === '--') {
            startIdx -= 2;
        } else if (prefix === '-' && startIdx >= 1) {
            startIdx -= 1;
        }
        const endIdx = match.index + match[0].length;

        // Ignore ratings like "9/10" or prices/years right after the number
        const afterTail = source.slice(endIdx, endIdx + 12).toLowerCase();
        if (/^\s*\/\s*\d/.test(afterTail) || /^\s*(?:грн|uah|\$|€|р\.|год|року)/.test(afterTail)) {
            continue;
        }

        const numVal = Number.parseFloat(valueRaw.replace(',', '.'));
        if (!Number.isFinite(numVal) || numVal <= 0 || numVal > 350) {
            continue;
        }

        const entry = PATTERN_LOOKUP.get(termRaw.toLowerCase());
        if (!entry) continue;

        found.push({
            key: entry.key,
            qualifier: entry.qualifier || null,
            value: valueRaw.replace(',', '.')
        });
        matchedSpans.push([startIdx, endIdx]);
    }

    // Check reversed "<number> см стелька" pattern if insole wasn't matched already
    if (!found.some(m => m.key === 'insole')) {
        INSOLE_PREFIX_RE.lastIndex = 0;
        let inMatch;
        while ((inMatch = INSOLE_PREFIX_RE.exec(source)) !== null) {
            const prefix = inMatch[1] || '';
            const val = Number.parseFloat(inMatch[2].replace(',', '.'));
            if (Number.isFinite(val) && val >= 15 && val <= 36) {
                found.push({ key: 'insole', qualifier: null, value: inMatch[2].replace(',', '.') });
                matchedSpans.push([inMatch.index + prefix.length, inMatch.index + inMatch[0].length]);
            }
        }
    }

    const hasExplicitHeader = /(?:^|[\s.])(?:основные\s+замеры|основні\s+заміри|замеры|заміри|measurements)\s*(?::|\r?\n|$)/i.test(source);
    const hasInsoleOnly = found.length === 1 && found[0].key === 'insole';
    if (found.length < 2 && !hasInsoleOnly && !(found.length === 1 && hasExplicitHeader)) {
        const result = { measurements: [], cleanText: source };
        setBoundedCache(source, result);
        return result;
    }

    // Sort spans ascending and build clean narrative text without extracted measurements
    matchedSpans.sort((a, b) => a[0] - b[0]);
    let rebuilt = '';
    let cursor = 0;
    for (const [s, e] of matchedSpans) {
        if (s < cursor) continue;
        rebuilt += source.slice(cursor, s);
        cursor = e;
    }
    rebuilt += source.slice(cursor);

    const cleanText = rebuilt
        .replace(/(?:основные\s+замеры|основні\s+заміри|замеры|заміри|measurements)\s*:?[ \t]*(?=\r?\n|$)/gi, '')
        .replace(/(?:основные\s+замеры|основні\s+заміри|замеры|заміри|measurements)\s*:\s*/gi, '')
        .replace(/\(\s*\)/g, '')
        .replace(/[ \t]*[•·]+(?=[ \t]*(?:\r?\n|$|[•·]))/g, '')
        .replace(/[ \t]*[,;—–\-]+(?=[ \t]*(?:\r?\n|$|\.|,))/g, '')
        .replace(/^\s*[,;—–\-•·]+\s*/gm, '')
        .replace(/([.!?])[ \t]*,+(?:[ \t]*[.,])*|[ \t]*,+[ \t]*(?=\r?\n|$)/g, '$1')
        .replace(/\s+[.,]+(?=\r?\n|$)/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/(?:[ \t]*\r?\n){3,}/g, '\n\n')
        .trim();

    const result = { measurements: found, cleanText };
    setBoundedCache(source, result);
    return result;
}

/**
 * Renders Variant B receipt-style dotted measurement table HTML with full `data-i18n`
 * attributes so language switches update every label immediately.
 * @param {Array<{ key: string, qualifier: string|null, value: string }>} measurements
 * @param {(str: string) => string} escapeFn
 * @returns {string}
 */
export function renderMeasurementsTableHtml(measurements, escapeFn) {
    if (!Array.isArray(measurements) || measurements.length === 0) return '';
    const esc = typeof escapeFn === 'function' ? escapeFn : (/** @type {any} */ s) => String(s ?? '');

    const titleText = _t('measurements_title');
    const unitText = _t('meas_cm');

    const rowsHtml = measurements.map((m) => {
        const labelKey = `meas_${m.key}`;
        const labelText = _t(labelKey);
        const qualHtml = m.qualifier
            ? ` (<span class="product-measurement-qual" data-i18n="product.meas_qual_${esc(m.qualifier)}">${esc(_t(`meas_qual_${m.qualifier}`))}</span>)`
            : '';

        return `
            <div class="product-measurement-row">
                <span class="product-measurement-label"><span data-i18n="product.${esc(labelKey)}">${esc(labelText)}</span>${qualHtml}</span>
                <span class="product-measurement-dots" aria-hidden="true"></span>
                <span class="product-measurement-value">${esc(m.value)} <span data-i18n="product.meas_cm">${esc(unitText)}</span></span>
            </div>
        `;
    }).join('');

    return `
        <div class="product-measurements-box">
            <div class="product-measurements-title" data-i18n="product.measurements_title">${esc(titleText)}</div>
            <div class="product-measurements-list">
                ${rowsHtml}
            </div>
        </div>
    `;
}
