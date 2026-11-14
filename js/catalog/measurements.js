// ==========================================
// NISHA CATALOG — МОДУЛЬ ЗАМЕРОВ И ТУЛТИПОВ (ПК)
// ==========================================

import { getCurrentSiteLang } from './catalog-state.js';

const MEASUREMENT_NOTE_TRANSLATIONS = [
    {
        pattern: /(?:тро[шх][ки]?\s*тягнет[ьс]+я|немного\s*тянет[ьс]+я|чуть\s*тянет[ьс]+я|тягнет[ьс]+я|тянет[ьс]+я|стрейч|stretch)/i,
        ru: 'тянется',
        ua: 'тягнеться',
        en: 'stretches'
    },
    {
        pattern: /(?:в\s*натя[гж][ку]?|натягнуто)/i,
        ru: 'в натяг',
        ua: 'в натяг',
        en: 'stretched'
    },
    {
        pattern: /(?:на\s*резин[кц][еі])/i,
        ru: 'на резинке',
        ua: 'на резинці',
        en: 'elastic'
    },
    {
        pattern: /(?:без\s*натя[гж][ку]?|в[іе]льно|свободно)/i,
        ru: 'без натяжки',
        ua: 'без натягу',
        en: 'relaxed'
    },
    {
        pattern: /(?:максимум|макс\.?)/i,
        ru: 'макс.',
        ua: 'макс.',
        en: 'max'
    }
];

function formatMeasurementNote(rawNote, lang) {
    if (!rawNote) return '';
    const cleaned = rawNote.trim();
    for (const rule of MEASUREMENT_NOTE_TRANSLATIONS) {
        if (rule.pattern.test(cleaned)) {
            const tr = rule[lang] || rule.ru;
            return ` (${tr})`;
        }
    }
    // Если на английском сайте остался нераспознанный кириллический комментарий - не выводим кириллицу
    if (lang === 'en' && /[а-яёієїґ]/i.test(cleaned)) {
        return '';
    }
    return ` (${cleaned})`;
}

const MEASUREMENT_TRANSLATIONS = [
    // 1. Длина/рукав от плеча
    {
        pattern: /(?:(?:довжина|длин+а)\s+р[ууы]кав[аеу]?(?:\s*(?:від|от)?\s*плеч[аея])?|р[ууы]кав[аеу]?\s*(?:від|от)?\s*плеч[аея])/i,
        ru: 'Рукав от плеча',
        ua: 'Рукав від плеча',
        en: 'Sleeve from shoulder'
    },
    // 2. Длина/рукав от шеи / от горла
    {
        pattern: /(?:(?:довжина|длин+а)\s+р[ууы]кав[аеу]?(?:\s*(?:від|от)?\s*(?:ши[їи]|горл[ае]|ворот[ае]|комір[ае])|р[ууы]кав[аеу]?\s*(?:від|от)?\s*(?:ши[їи]|горл[ае]|ворот[ае]|комір[ае])))/i,
        ru: 'Рукав от шеи',
        ua: 'Рукав від шиї',
        en: 'Sleeve from neck'
    },
    // 3. Длина рукава
    {
        pattern: /(?:(?:довжина|длин+а)\s+р[ууы]кав[аеу]?)/i,
        ru: 'Длина рукава',
        ua: 'Довжина рукава',
        en: 'Sleeve length'
    },
    // 4. Длина по спине / Довжина по спині
    {
        pattern: /(?:(?:довжина|длин+а)\s*(?:по\s*спин[іе]|спин[иы]))/i,
        ru: 'Длина по спине',
        ua: 'Довжина по спині',
        en: 'Back length'
    },
    // 5. Длина замка / Довжина замка
    {
        pattern: /(?:(?:довжина|длин+а)\s*замк[аи])/i,
        ru: 'Длина замка',
        ua: 'Довжина замка',
        en: 'Zipper length'
    },
    // 6. Длина штанины / Довжина штанини
    {
        pattern: /(?:(?:довжина|длин+а)\s*штанин[иы])/i,
        ru: 'Длина штанины',
        ua: 'Довжина штанини',
        en: 'Leg length'
    },
    // 7. Выход штанины / Вихід штанини
    {
        pattern: /(?:вихід\s*штанин[иы]|выход\s*штанин[ыи]|вихід|выход|низ\s*штанин[ыи])/i,
        ru: 'Выход штанины',
        ua: 'Вихід штанини',
        en: 'Leg opening'
    },
    // 8. Полуобхват груди / Напівобхват грудей / ПОГ
    {
        pattern: /(?:полуобхват\s*груд[еиейяі]|напівобхват\s*груд[еиейяі]|пог(?![а-яёa-zієїґ]))/i,
        ru: 'Полуобхват груди',
        ua: 'Напівобхват грудей',
        en: 'Chest (pit-to-pit)'
    },
    // 9. Полуобхват талии / Напівобхват талії / ПОТ
    {
        pattern: /(?:полуобхват\s*тал[иі][їие]|напівобхват\s*тал[иі][їие]|пот(?![а-яёa-zієїґ]))/i,
        ru: 'Полуобхват талии',
        ua: 'Напівобхват талії',
        en: 'Waist width'
    },
    // 10. Полуобхват бедер / Напівобхват стегон / ПОБ
    {
        pattern: /(?:полуобхват\s*(?:бедер|стегон)|напівобхват\s*(?:бедер|стегон)|поб(?![а-яёa-zієїґ]))/i,
        ru: 'Полуобхват бедер',
        ua: 'Напівобхват стегон',
        en: 'Hips width'
    },
    // 11. Шаговый шов / Кроковий шов / Внутрішній шов
    {
        pattern: /(?:шагов(?:ый|ий)\s*шов|кроков(?:ий|ый)\s*шов|внутр[іе]шн[іий]{2}\s*шов|внутренн[ий]{2}\s*шов|шагов(?:ый|ий)|кроков(?:ий|ый)|шаг(?![а-яёa-zієїґ]))/i,
        ru: 'Шаговый шов',
        ua: 'Кроковий шов',
        en: 'Inseam'
    },
    // 12. Подмышки / Підмишки / Пахи
    {
        pattern: /(?:(?:от\s*плеча\s*до\s*)?подмышк[иае]|(?:від\s*плеча\s*до\s*)?підмишк[иае]|пахи|подмыхи|підмихами|пах(?![а-яёa-zієїґ]))/i,
        ru: 'Подмышки',
        ua: 'Підмишки',
        en: 'Pit to pit'
    },
    // 13. Длина / Довжина
    {
        pattern: /(?:(?:загальн[ао]|общ[ая]|полн[ая])\s+(?:довжина|длин+а)|довжина|длин+а)/i,
        ru: 'Длина',
        ua: 'Довжина',
        en: 'Length'
    },
    // 14. Плечи / Плечі
    {
        pattern: /(?:плеч[иіея]?)/i,
        ru: 'Плечи',
        ua: 'Плечі',
        en: 'Shoulders'
    },
    // 15. Грудь / Груди
    {
        pattern: /(?:груд[иіеяь])/i,
        ru: 'Грудь',
        ua: 'Груди',
        en: 'Chest'
    },
    // 16. Рукав
    {
        pattern: /(?:р[ууы]кав[аеу]?)/i,
        ru: 'Рукав',
        ua: 'Рукав',
        en: 'Sleeve'
    },
    // 17. Талия / Талія
    {
        pattern: /(?:(?:по\s*)?тал[иі][яеєїі])/i,
        ru: 'Талия',
        ua: 'Талія',
        en: 'Waist'
    },
    // 18. Пояс
    {
        pattern: /(?:(?:по\s*)?пояс[ау]?)/i,
        ru: 'Пояс',
        ua: 'Пояс',
        en: 'Waistband'
    },
    // 19. Бедра / Стегна
    {
        pattern: /(?:стегн[ао]|бедр[ао])/i,
        ru: 'Бедра',
        ua: 'Стегна',
        en: 'Hips'
    },
    // 20. Штанина
    {
        pattern: /(?:штанин[аы])/i,
        ru: 'Штанина',
        ua: 'Штанина',
        en: 'Leg length'
    },
    // 21. Посадка
    {
        pattern: /(?:посадк[аи])/i,
        ru: 'Посадка',
        ua: 'Посадка',
        en: 'Rise'
    },
    // 22. Стелька / Устілка
    {
        pattern: /(?:устілк[аи]|стельк[аи])/i,
        ru: 'Стелька',
        ua: 'Устілка',
        en: 'Insole'
    },
    // 23. Высота / Висота
    {
        pattern: /(?:висот[аы]|высот[аы])/i,
        ru: 'Высота',
        ua: 'Висота',
        en: 'Height'
    },
    // 24. Ширина
    {
        pattern: /(?:ширин[аы])/i,
        ru: 'Ширина',
        ua: 'Ширина',
        en: 'Width'
    },
    // 25. Замок / Блискавка
    {
        pattern: /(?:замок|блискавк[аи])/i,
        ru: 'Замок',
        ua: 'Замок',
        en: 'Zipper'
    },
    // 26. Воротник / Комір
    {
        pattern: /(?:комір[ае]?|воротник[ае]?|ворот[ае]?)/i,
        ru: 'Воротник',
        ua: 'Комір',
        en: 'Collar'
    },
    // 27. Манжет
    {
        pattern: /(?:манжет[аы]?)/i,
        ru: 'Манжет',
        ua: 'Манжет',
        en: 'Cuff'
    },
    // 28. Низ
    {
        pattern: /(?:низ(?![а-яёa-zієїґ]))/i,
        ru: 'Низ',
        ua: 'Низ',
        en: 'Bottom'
    },
    // 29. Глубина
    {
        pattern: /(?:глубин[аы]|глибин[аи])/i,
        ru: 'Глубина',
        ua: 'Глибина',
        en: 'Depth'
    }
];

function translateMeasurementLabel(rawLabel, lang) {
    for (const rule of MEASUREMENT_TRANSLATIONS) {
        if (rule.pattern.test(rawLabel)) {
            return rule[lang] || rule.ru || rawLabel;
        }
    }
    return rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
}

/**
 * Нормализует единицы измерения в строке замера (`см` / `мм`).
 * @param {string} str
 * @returns {string}
 */
export function normalizeMeasurementUnits(str) {
    if (!str) return '';
    const s = str.trim()
        .replace(/^[\-\–—\•\*\:\s]+/, '')
        .replace(/[\.\,\;\:\s]+$/, '')
        .trim();

    // 1. Если число уже сопровождается "см", "cm", "с", "c", "мм", "mm" (слитно или раздельно):
    // Преобразуем в единый формат "X см" (или "X мм") без разрыва цифр
    if (/(\d+(?:[\.,]\d+)?)\s*(?:см|cm|с|c)\.?(?![а-яёa-zієїґ])/i.test(s)) {
        return s.replace(/(\d+(?:[\.,]\d+)?)\s*(?:см|cm|с|c)\.?(?![а-яёa-zієїґ])/gi, '$1 см');
    }
    if (/(\d+(?:[\.,]\d+)?)\s*(?:мм|mm)\.?(?![а-яёa-zієїґ])/i.test(s)) {
        return s.replace(/(\d+(?:[\.,]\d+)?)\s*(?:мм|mm)\.?(?![а-яёa-zієїґ])/gi, '$1 мм');
    }

    // 2. Если единиц измерения нет вообще, но число в конце строки (например "довжина 60", "ширина 47") -> дописываем "см"
    if (/(\d+(?:[\.,]\d+)?)$/.test(s)) {
        return s.replace(/(\d+(?:[\.,]\d+)?)$/, '$1 см');
    }

    // 3. Если число в начале перед словом (например "28.5 стелька") -> "28.5 см стелька"
    if (/^(\d+(?:[\.,]\d+)?)\s+([а-яёa-z].*)$/i.test(s)) {
        return s.replace(/^(\d+(?:[\.,]\d+)?)\s+([а-яёa-z].*)$/i, '$1 см $2');
    }

    // 4. Любое оставшееся изолированное число
    return s.replace(/(\d+(?:[\.,]\d+)?)/, '$1 см');
}

/**
 * Форматирует и переводит отдельную строку замера.
 * @param {string} str
 * @param {'ua'|'ru'|'en'} [lang]
 * @returns {string}
 */
export function formatMeasurementItem(str, lang) {
    if (!str) return '';
    if (!lang) lang = getCurrentSiteLang();
    let s = str.trim().replace(/^[\-\–—\•\*\:\s]+/, '').replace(/[\.\,\;\:\s]+$/, '').trim();
    if (!s) return '';

    // 1. Отделяем примечание в скобках (включая незакрытые скобки вроде "(трошки тягнеться")
    let noteText = '';
    const noteMatch = s.match(/\s*[\(\[]([^\)\]]+)[\)\]]?\s*$/);
    if (noteMatch) {
        noteText = noteMatch[1].trim();
        s = s.slice(0, noteMatch.index).trim();
    }

    const formattedNote = formatMeasurementNote(noteText, lang);
    const unit = lang === 'en' ? 'cm' : 'см';

    // 2. Попытка выделить Метку и Числовое значение
    const match = s.match(/^(.*?)(?:[\s\-–—:]+)(\d+(?:[\.,]\d+)?\s*(?:см|cm|с|c|мм|mm)?)\s*$/i);
    if (match) {
        const rawLabel = match[1].trim().replace(/^[\-\–—\•\*\s]+/, '').trim();
        const numMatch = match[2].match(/(\d+(?:[\.,]\d+)?)/);
        const num = numMatch ? numMatch[1] : match[2].trim();
        const translatedLabel = translateMeasurementLabel(rawLabel, lang);
        return `${translatedLabel} ${num} ${unit}${formattedNote}`;
    }

    // 3. Обратный порядок: число в начале (например "28.5 см стелька", "38 см талія")
    const matchReverse = s.match(/^(\d+(?:[\.,]\d+)?\s*(?:см|cm|с|c|мм|mm)?)\s+(.*?)$/i);
    if (matchReverse) {
        const numMatch = matchReverse[1].match(/(\d+(?:[\.,]\d+)?)/);
        const num = numMatch ? numMatch[1] : matchReverse[1].trim();
        const rawLabel = matchReverse[2].trim();
        const translatedLabel = translateMeasurementLabel(rawLabel, lang);
        return `${translatedLabel} ${num} ${unit}${formattedNote}`;
    }

    // Fallback: нормализуем единицы
    let normalized = normalizeMeasurementUnits(s);
    if (lang === 'en') {
        normalized = normalized.replace(/(?:см|с)\.?/gi, 'cm');
    }
    return `${normalized}${formattedNote}`;
}

/**
 * Извлекает список замеров товара из описания/размера с кэшированием по языку.
 * @param {object} item
 * @param {'ua'|'ru'|'en'} [customLang]
 * @returns {string[]}
 */
export function extractItemMeasurements(item, customLang) {
    if (!item) return [];
    const lang = customLang || getCurrentSiteLang();
    let text = (item.description || '').trim();
    if (!text && item.size) {
        text = String(item.size).trim();
    }
    if (!text) return [];

    // Предобработка: разбиваем слитные замеры, записанные в одну строку, но не рвём обратный порядок ("28.5 см стелька")
    const kwSplitRegex = /(\d+(?:[\.,]\d+)?\s*(?:см|cm|с|c|мм|mm)?)(?:\s*[,;•|/\-–—]+\s*|\s+)((?:(?:довжина|длин+а)\s+р[ууы]кав[аеу]?(?:\s*(?:від|от)?\s*плеч[аея])?|(?:довжина|длин+а)\s+р[ууы]кав[аеу]?(?:\s*(?:від|от)?\s*(?:ши[їи]|горл[ае]|ворот[ае]|комір[ае]))?|(?:довжина|длин+а)\s*(?:по\s*спин[іе]|спин[иы])|(?:довжина|длин+а)\s*замк[аи]|(?:довжина|длин+а)\s*штанин[иы]|(?:загальн[ао]|общ[ая]|полн[ая])\s+(?:довжина|длин+а)|довжина|длин+а|плеч[иіея]?|груд[иіеяь]|підмишк[иае]|подмышк[иае]|пахи|подмыхи|пог|пот|поб|напівобхват|полуобхват|р[ууы]кав[аеу]?|тал[иі][яеєїі]|пояс|стегн[ао]|бедр[ао]|штанин[аы]|вихід|выход|посадк[аи]|кроков|шагов|внутр[іе]шн|устілк[аи]|стельк[аи]|висот[аы]|высот[аы]|ширин[аы]|замок|блискавк|манжет|комір|ворот|воротник|пах)(?![а-яёa-zієїґ]))/gi;
    const splitInlineMeasurements = (input) => input.replace(kwSplitRegex, (full, num, kw, offset, wholeStr) => {
        const before = wholeStr.slice(0, offset);
        const clauseStart = Math.max(
            before.lastIndexOf('\n'),
            before.lastIndexOf(','),
            before.lastIndexOf(';'),
            before.lastIndexOf('•'),
            before.lastIndexOf('|')
        );
        const clausePrefix = before.slice(clauseStart + 1);
        return /[а-яёa-zієїґ]/i.test(clausePrefix) ? `${num}\n${kw}` : full;
    });
    text = splitInlineMeasurements(text);

    let lines = [];
    const kwRegex = /(?:выход\s+штанины|вихід\s+штанини|довжина\s+замк[аи]|длина\s+замка|довжина\s+рукава|длина\s+рукава|полуобхват\s+груд[еиейяі]|груд[иеяьі]\s+повністю|грудь\s+полностью|довжина|длин+а|р[ууы]кав|плеч[иіея]|груд[иіеяь]|подмышк[иае]|підмишк[иае]|пахи|подмыхи|полуобхват|напівобхват|пог|пот|поб|стелька|устілка|пояс|вихід|выход|штанина|бедра|стегна|тал[иі][яеєїі]|висота|высота|ширина|замок|блискавк|посадка|кроковий|шаговый|внутр[іе]шн|манжет|ворот|комір|шов|пах)/i;
    const measureLinePattern = /^[\-\–—\•\*\s]*[а-яёa-zієїґ\s\(\)\/]{2,35}[\s\-–—:]+\d{1,3}(?:[\.,]\d+)?\s*(?:см|mm|мм|с|c)?$/i;
    const isStopLine = (str) => /^(?:стан|состояние|дефект|дефекти|нюанс|контакт|тг|tg|ціна|цена|город|місто|доставка|отправка|відправка|размер|розмір)[:\s]|(?:\d+\s*\/\s*\d+)|(?:грн|uah|\$|€|t\.me|\@)/i.test(str);
    // Срезаем буллиты и нумерацию списков ("1. ...", "2) ..."), не затрагивая десятичные значения ("28.5 стелька")
    const stripListPrefix = (str) => str.trim().replace(/^[\-\–—\•\*\s]*(?:\d+(?:\.(?!\d)|\))\s*)?/, '').trim();

    // 1. Поиск по маркеру замеров
    const markerRegex = /(?:заміри|замеры|параметри|параметры|промери|виміри|measurements?)[:\s\-\n]/i;
    const markerMatch = text.search(markerRegex);

    if (markerMatch !== -1) {
        const afterMarker = text.slice(markerMatch).replace(/^(?:заміри|замеры|параметри|параметры|промери|виміри|measurements?)[:\s\-]*/i, '');
        const rawLines = afterMarker.split(/\r?\n/);

        for (const rawLine of rawLines) {
            const clean = rawLine.trim();
            if (!clean) {
                if (lines.length > 0) break;
                continue;
            }
            if (isStopLine(clean)) break;

            const subLines = splitInlineMeasurements(clean).split(/\r?\n/);
            for (const subLine of subLines) {
                const subItems = subLine.split(/[,;•|]|\s+\/\s+/);
                for (const sub of subItems) {
                    const s = stripListPrefix(sub);
                    if (s && /\d+/.test(s) && (kwRegex.test(s) || measureLinePattern.test(s))) {
                        const formatted = formatMeasurementItem(s, lang);
                        if (formatted) lines.push(formatted);
                    }
                }
            }
        }
    }

    // 2. Если маркера "заміри:" нет: сканируем построчно и по предложениям
    if (lines.length === 0) {
        const rawLines = text.split(/\r?\n/);

        for (const rLine of rawLines) {
            const clean = rLine.trim();
            if (!clean || isStopLine(clean)) continue;

            const subLines = splitInlineMeasurements(clean).split(/\r?\n/);
            for (const subLine of subLines) {
                const sl = subLine.trim();
                if (!sl) continue;

                if (/[,;•|]|\s+\/\s+/.test(sl)) {
                    const parts = sl.split(/[,;•|]|\s+\/\s+/);
                    for (const p of parts) {
                        const cp = stripListPrefix(p);
                        if (cp && /\d+/.test(cp) && (kwRegex.test(cp) || measureLinePattern.test(cp))) {
                            const formatted = formatMeasurementItem(cp, lang);
                            if (formatted) lines.push(formatted);
                        }
                    }
                } else if (/\d+/.test(sl) && (kwRegex.test(sl) || measureLinePattern.test(sl))) {
                    const cp = stripListPrefix(sl);
                    const formatted = formatMeasurementItem(cp, lang);
                    if (formatted) lines.push(formatted);
                }
            }
        }
    }

    // 3. Fallback: прямой поиск регуляркой всех изолированных пар "параметр + число"
    if (lines.length === 0) {
        const inlineMatches = text.match(/(?:(?:довжина|длин+а|р[ууы]кав|плеч[иіея]|груд[иіеяь]|підмишк[иае]|подмышк[иае]|пахи|подмыхи|полуобхват|напівобхват|пог|пот|поб|стелька|устілка|пояс|вихід|выход|штанина|бедра|стегна|тал[иі][яеєїі]|висота|высота|ширина|замок|блискавк)[\s\-–—:]*\d+(?:[\.,]\d+)?\s*(?:см|mm|мм|с|c)?|\d+(?:[\.,]\d+)?\s*(?:см|mm|мм|с|c)?\s*(?:стелька|устілка))/gi);
        if (inlineMatches && inlineMatches.length > 0) {
            lines = inlineMatches.map(m => formatMeasurementItem(m, lang)).filter(Boolean);
        }
    }

    // Финальная санитария: если каким-то чудом в строке осталось больше одного замера
    const sanitizedLines = [];
    for (const l of lines) {
        const splitLine = splitInlineMeasurements(l);
        if (splitLine !== l) {
            const parts = splitLine.split(/\r?\n/);
            for (const p of parts) {
                const sp = p.trim();
                if (sp) {
                    const f = formatMeasurementItem(sp, lang);
                    if (f) sanitizedLines.push(f);
                }
            }
        } else {
            sanitizedLines.push(l);
        }
    }

    // Убираем дубликаты строк и ограничиваем до 8 пунктов
    const unique = [];
    for (const l of sanitizedLines) {
        if (!unique.includes(l)) unique.push(l);
    }
    const finalResult = unique.slice(0, 8);
    if (!item._measCache) item._measCache = {};
    item._measCache[lang] = finalResult;
    return finalResult;
}

let _tooltipEl = null;
let _isTooltipVisible = false;
let _tooltipHideTimer = null;

function getMeasurementsTooltip() {
    if (_tooltipEl && _tooltipEl.isConnected) return _tooltipEl;
    _tooltipEl = document.getElementById('measurementsTooltip');
    if (!_tooltipEl) {
        _tooltipEl = document.createElement('div');
        _tooltipEl.id = 'measurementsTooltip';
        _tooltipEl.className = 'measurements-tooltip';
        document.body.appendChild(_tooltipEl);
    }
    return _tooltipEl;
}

/**
 * Показывает интерактивный тултип замеров рядом с курсором на десктопе.
 * @param {object|string} itemOrId
 * @param {MouseEvent|TouchEvent} e
 */
export const showItemMeasurementsTooltip = function(itemOrId, e) {
    // Не показываем на сенсорных мобильных устройствах
    if (('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768) return;

    // Не показываем плашку замеров при наведении на кнопку "В корзину"
    if (e && e.target && typeof e.target.closest === 'function' && e.target.closest('.grid-cart-btn, [data-action="add-to-cart"]')) {
        return;
    }

    let item = itemOrId;
    if (typeof itemOrId === 'string') {
        item = (window.allItems || []).find(i => i.id === itemOrId);
    }
    if (!item) return;

    // Если у переданного объекта нет description, ищем актуальный в window.allItems
    if (!item.description && item.id && Array.isArray(window.allItems)) {
        const fresh = window.allItems.find(i => i.id === item.id);
        if (fresh && fresh.description) {
            item = fresh;
        }
    }

    const currentLang = getCurrentSiteLang();
    const measures = (item._measCache && (typeof hasOwn === 'function' ? hasOwn(item._measCache, currentLang) : Object.hasOwn(item._measCache, currentLang)))
        ? item._measCache[currentLang]
        : extractItemMeasurements(item, currentLang);
    if (!measures || measures.length === 0) return;

    const tooltip = getMeasurementsTooltip();

    const titles = {
        ru: '[ ЗАМЕРЫ ]',
        ua: '[ ЗАМІРИ ]',
        en: '[ MEASUREMENTS ]'
    };
    const headerTitle = titles[currentLang] || titles.ru;

    if (typeof tooltip.replaceChildren === 'function') {
        tooltip.replaceChildren();
    } else {
        tooltip.textContent = '';
    }

    const headerEl = document.createElement('div');
    headerEl.className = 'measurements-tooltip-header';
    headerEl.textContent = headerTitle;
    tooltip.appendChild(headerEl);

    const listEl = document.createElement('ul');
    listEl.className = 'measurements-tooltip-list';
    measures.forEach(m => {
        const li = document.createElement('li');
        li.className = 'measurements-tooltip-item';
        const dot = document.createElement('span');
        dot.className = 'measurements-dot';
        const text = document.createElement('span');
        text.className = 'measurements-text';
        text.textContent = String(m);
        li.appendChild(dot);
        li.appendChild(text);
        listEl.appendChild(li);
    });
    tooltip.appendChild(listEl);

    if (_tooltipHideTimer) {
        clearTimeout(_tooltipHideTimer);
        _tooltipHideTimer = null;
    }
    tooltip.style.display = 'block';
    tooltip.classList.add('visible');
    _isTooltipVisible = true;
    window.moveItemMeasurementsTooltip(e);
};

/**
 * Позиционирует тултип замеров с учётом границ окна.
 * @param {MouseEvent|TouchEvent} e
 */
export const moveItemMeasurementsTooltip = function(e) {
    if (!e || !_isTooltipVisible) return;
    // Если курсор оказался над кнопкой корзины - прячем плашку замеров
    if (e.target && typeof e.target.closest === 'function' && e.target.closest('.grid-cart-btn, [data-action="add-to-cart"]')) {
        if (typeof window.hideItemMeasurementsTooltip === 'function') {
            window.hideItemMeasurementsTooltip();
        }
        return;
    }
    const tooltip = getMeasurementsTooltip();
    if (!tooltip || tooltip.style.display === 'none') return;

    const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    const clientY = (e.clientY !== undefined) ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (clientX === null || clientY === null) return;

    const offset = 16;
    const tooltipWidth = tooltip.offsetWidth || 190;
    const tooltipHeight = tooltip.offsetHeight || 120;

    let x = clientX + offset;
    let y = clientY + offset;

    if (x + tooltipWidth > window.innerWidth - 12) {
        x = clientX - tooltipWidth - offset;
    }
    if (y + tooltipHeight > window.innerHeight - 12) {
        y = clientY - tooltipHeight - offset;
    }

    if (x < 10) x = 10;
    if (y < 10) y = 10;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
};

/**
 * Возвращает текущую видимость тултипа замеров.
 * @returns {boolean}
 */
export const isItemMeasurementsTooltipVisible = function() {
    return !!_isTooltipVisible;
};

/**
 * Плавно скрывает активный тултип замеров.
 */
export const hideItemMeasurementsTooltip = function() {
    if (!_isTooltipVisible) return;
    _isTooltipVisible = false;
    const tooltip = getMeasurementsTooltip();
    if (tooltip) {
        tooltip.classList.remove('visible');
        if (_tooltipHideTimer) clearTimeout(_tooltipHideTimer);
        _tooltipHideTimer = setTimeout(() => {
            _tooltipHideTimer = null;
            if (!_isTooltipVisible) {
                tooltip.style.display = 'none';
            }
        }, 150);
    }
};

if (typeof window !== 'undefined') {
    window.normalizeMeasurementUnits = normalizeMeasurementUnits;
    window.formatMeasurementItem = formatMeasurementItem;
    window.extractItemMeasurements = extractItemMeasurements;
    window.showItemMeasurementsTooltip = showItemMeasurementsTooltip;
    window.moveItemMeasurementsTooltip = moveItemMeasurementsTooltip;
    window.isItemMeasurementsTooltipVisible = isItemMeasurementsTooltipVisible;
    window.hideItemMeasurementsTooltip = hideItemMeasurementsTooltip;

    // Прячем тултип при скролле страницы (без нагрузки на скролл, когда тултип закрыт)
    window.addEventListener('scroll', () => {
        if (_isTooltipVisible) window.hideItemMeasurementsTooltip();
    }, { passive: true });
}
