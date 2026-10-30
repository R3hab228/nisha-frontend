// ==========================================
// NISHA CATALOG & FILTERS MODULE
// ==========================================

// Инициализация глобального состояния каталога
if (!window.allItems) window.allItems = [];
if (!window.filteredItems) window.filteredItems = [];
window.renderedCount = 0;
window.currentPage = 1;
window.currentCategory = '';
window.currentBrand = '';
window.showingOnlyFavs = false;

let itemsPageSize = window.innerWidth <= 900 ? 12 : 15;
let applyFiltersTimeout = null;
let _resolveApplyFilters = null;
let changePageTimeout = null;
let priceTimeout = null;

// Запрещаем браузеру восстанавливать скролл при перезагрузке страницы
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Глобальный перехватчик URL для CDN
window.toCDN = window.toCDN || function(url) {
    if (typeof url === 'string' && url.includes('nmpuefxqtkhvtltdvllz.supabase.co')) {
        return url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://nisha-cdn.mtyagniryadno.workers.dev');
    }
    return url || '';
};
const toCDN = (u) => (typeof window.toCDN === 'function' ? window.toCDN(u) : (u || ''));

// Оптимизированный URL картинки (превью / оригинал)
function getOptimizedImageUrl(item, wantsThumb = false) {
    if (!item || typeof item !== 'object') return '';
    const isValid = (url) => typeof url === 'string' && url.trim().length > 10;

    let resultUrl = '';

    if (wantsThumb && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
        if (isValid(item.thumbnails[0])) resultUrl = item.thumbnails[0];
    }

    if (!resultUrl && Array.isArray(item.images) && item.images.length > 0) {
        if (isValid(item.images[0])) resultUrl = item.images[0];
    }

    return window.toCDN(resultUrl);
}
window.getOptimizedImageUrl = getOptimizedImageUrl;

// ОПТИМИЗАЦИЯ PREFETCH: отложенная предзагрузка картинок (задержка 100мс на hover для мгновенного 0мс открытия товара)
let _prefetchDebounceTimer = null;
let _prefetchPendingId = null;

window.prefetchItemImages = function(id) {
    if (!window._prefetchedItems) window._prefetchedItems = new Set();
    if (window._prefetchedItems.has(id)) return;
    
    clearTimeout(_prefetchDebounceTimer);
    _prefetchPendingId = id;
    _prefetchDebounceTimer = setTimeout(() => {
        if (window._prefetchedItems.has(id)) return;
        window._prefetchedItems.add(id);
        const catalog = typeof getCatalog === 'function' ? getCatalog() : (window.allItems || []);
        const item = catalog.find(i => String(i.id) === String(id));
        if (item) {
            // Предзагрузка миниатюр карточки для мгновенного свайпа в сетке
            if (item.thumbnails && item.thumbnails.length > 1) {
                item.thumbnails.slice(1, 4).forEach(url => {
                    if (url && typeof url === 'string' && !url.endsWith('.mp4')) {
                        const img = new Image();
                        img.decoding = 'async';
                        img.src = toCDN(url);
                    }
                });
            }
            // Предзагрузка фото высокого качества для мгновенного открытия модалки (0 мс)
            if (item.images && item.images.length > 0) {
                item.images.slice(0, 2).forEach(url => {
                    if (url && typeof url === 'string' && !url.endsWith('.mp4')) {
                        const img = new Image();
                        img.decoding = 'async';
                        img.src = toCDN(url);
                    }
                });
            }
        }
    }, 100);
};

window.cancelPrefetchItemImages = function(id) {
    if (_prefetchPendingId === id) {
        clearTimeout(_prefetchDebounceTimer);
        _prefetchPendingId = null;
    }
};

// ==========================================
// МОДУЛЬ ЗАМЕРОВ ДЛЯ КАРТОЧЕК (ТОЛЬКО ПК)
// ==========================================

function getCurrentSiteLang() {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    let l = store ? (store.get('nisha_lang') || store.get('i18nextLng') || 'ru') : 'ru';
    l = l.substring(0, 2).toLowerCase();
    if (l === 'uk') l = 'ua';
    if (!['ru', 'ua', 'en'].includes(l)) l = 'ru';
    return l;
}
window.getCurrentSiteLang = getCurrentSiteLang;

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
    for (let rule of MEASUREMENT_NOTE_TRANSLATIONS) {
        if (rule.pattern.test(cleaned)) {
            const tr = rule[lang] || rule['ru'];
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

function normalizeMeasurementUnits(str) {
    if (!str) return '';
    let s = str.trim()
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
window.normalizeMeasurementUnits = normalizeMeasurementUnits;

function formatMeasurementItem(str, lang) {
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

    // 2. Попытка выделить Метку и Числовое значение
    // Например: "Довжина 65 см", "Рукав от плеча 64 см", "Плечи: 41 см", "талія - 38см"
    const match = s.match(/^(.*?)(?:[\s\-–—:]+)(\d+(?:[\.,]\d+)?\s*(?:см|cm|с|c|мм|mm)?)\s*$/i);
    if (match) {
        let rawLabel = match[1].trim().replace(/^[\-\–—\•\*\s]+/, '').trim();
        let numMatch = match[2].match(/(\d+(?:[\.,]\d+)?)/);
        let num = numMatch ? numMatch[1] : match[2].trim();
        let unit = (lang === 'en') ? 'cm' : 'см';
        let val = `${num} ${unit}`;

        for (let rule of MEASUREMENT_TRANSLATIONS) {
            if (rule.pattern.test(rawLabel)) {
                const translatedLabel = rule[lang] || rule['ru'] || rawLabel;
                return `${translatedLabel} ${val}${formattedNote}`;
            }
        }
        rawLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
        return `${rawLabel} ${val}${formattedNote}`;
    }

    // 3. Обратный порядок: число в начале (например "28.5 см стелька", "38 см талія")
    const matchReverse = s.match(/^(\d+(?:[\.,]\d+)?\s*(?:см|cm|с|c|мм|mm)?)\s+(.*?)$/i);
    if (matchReverse) {
        let numMatch = matchReverse[1].match(/(\d+(?:[\.,]\d+)?)/);
        let num = numMatch ? numMatch[1] : matchReverse[1].trim();
        let rawLabel = matchReverse[2].trim();
        let unit = (lang === 'en') ? 'cm' : 'см';
        let val = `${num} ${unit}`;

        for (let rule of MEASUREMENT_TRANSLATIONS) {
            if (rule.pattern.test(rawLabel)) {
                const translatedLabel = rule[lang] || rule['ru'] || rawLabel;
                return `${translatedLabel} ${val}${formattedNote}`;
            }
        }
        rawLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
        return `${rawLabel} ${val}${formattedNote}`;
    }

    // Fallback: нормализуем единицы
    let normalized = normalizeMeasurementUnits(s);
    if (lang === 'en') {
        normalized = normalized.replace(/(?:см|с)\.?/gi, 'cm');
    }
    return `${normalized}${formattedNote}`;
}
window.formatMeasurementItem = formatMeasurementItem;

function extractItemMeasurements(item, customLang) {
    if (!item) return [];
    const lang = customLang || getCurrentSiteLang();
    let text = (item.description || '').trim();
    if (!text && item.size) {
        text = String(item.size).trim();
    }
    if (!text) return [];

    // Предобработка: разбиваем слитные замеры, записанные в одну строку (например: "довжина рукава від плеча - 66см длинна - 60см ширина - 47см")
    const kwSplitRegex = /(\d+(?:[\.,]\d+)?\s*(?:см|cm|с|c|мм|mm)?)(?:\s*[,;•|/\-–—]+\s*|\s+)((?:(?:довжина|длин+а)\s+р[ууы]кав[аеу]?(?:\s*(?:від|от)?\s*плеч[аея])?|(?:довжина|длин+а)\s+р[ууы]кав[аеу]?(?:\s*(?:від|от)?\s*(?:ши[їи]|горл[ае]|ворот[ае]|комір[ае]))?|(?:довжина|длин+а)\s*(?:по\s*спин[іе]|спин[иы])|(?:довжина|длин+а)\s*замк[аи]|(?:довжина|длин+а)\s*штанин[иы]|(?:загальн[ао]|общ[ая]|полн[ая])\s+(?:довжина|длин+а)|довжина|длин+а|плеч[иіея]?|груд[иіеяь]|підмишк[иае]|подмышк[иае]|пахи|подмыхи|пог|пот|поб|напівобхват|полуобхват|р[ууы]кав[аеу]?|тал[иі][яеєїі]|пояс|стегн[ао]|бедр[ао]|штанин[аы]|вихід|выход|посадк[аи]|кроков|шагов|внутр[іе]шн|устілк[аи]|стельк[аи]|висот[аы]|высот[аы]|ширин[аы]|замок|блискавк|манжет|комір|ворот|воротник|пах)(?![а-яёa-zієїґ]))/gi;
    text = text.replace(kwSplitRegex, '$1\n$2');

    let lines = [];
    const kwRegex = /(?:выход\s+штанины|вихід\s+штанини|довжина\s+замк[аи]|длина\s+замка|довжина\s+рукава|длина\s+рукава|полуобхват\s+груд[еиейяі]|груд[иеяьі]\s+повністю|грудь\s+полностью|довжина|длин+а|р[ууы]кав|плеч[иіея]|груд[иіеяь]|подмышк[иае]|підмишк[иае]|пахи|подмыхи|полуобхват|напівобхват|пог|пот|поб|стелька|устілка|пояс|вихід|выход|штанина|бедра|стегна|тал[иі][яеєїі]|висота|высота|ширина|замок|блискавк|посадка|кроковий|шаговый|внутр[іе]шн|манжет|ворот|комір|шов|пах)/i;
    const measureLinePattern = /^[\-\–—\•\*\s]*[а-яёa-zієїґ\s\(\)\/]{2,35}[\s\-–—:]+\d{1,3}(?:[\.,]\d+)?\s*(?:см|mm|мм|с|c)?$/i;
    const isStopLine = (str) => /^(?:стан|состояние|дефект|дефекти|нюанс|контакт|тг|tg|ціна|цена|город|місто|доставка|отправка|відправка|размер|розмір)[:\s]|(?:\d+\s*\/\s*\d+)|(?:грн|uah|\$|€|t\.me|\@)/i.test(str);

    // 1. Поиск по маркеру замеров (заміри, замеры, параметри, параметры, measurements и т.д.)
    const markerRegex = /(?:заміри|замеры|параметри|параметры|промери|виміри|measurements?)[:\s\-\n]/i;
    const markerMatch = text.search(markerRegex);

    if (markerMatch !== -1) {
        const afterMarker = text.slice(markerMatch).replace(/^(?:заміри|замеры|параметри|параметры|промери|виміри|measurements?)[:\s\-]*/i, '');
        const rawLines = afterMarker.split(/\r?\n/);
        
        for (let rawLine of rawLines) {
            let clean = rawLine.trim();
            if (!clean) {
                if (lines.length > 0) break; // Конец блока замеров
                continue;
            }
            if (isStopLine(clean)) break;
            
            // Если в строке после маркера слитные замеры (например "длина 60 ширина 50")
            const subLines = clean.replace(kwSplitRegex, '$1\n$2').split(/\r?\n/);
            for (let subLine of subLines) {
                const subItems = subLine.split(/[,;•|]|\s+\/\s+/);
                for (let sub of subItems) {
                    let s = sub.trim().replace(/^[\-\–—\•\*\s]*(?:\d+[\.\)]\s*)?/, '').trim();
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
        
        for (let rLine of rawLines) {
            let clean = rLine.trim();
            if (!clean || isStopLine(clean)) continue;

            const subLines = clean.replace(kwSplitRegex, '$1\n$2').split(/\r?\n/);
            for (let subLine of subLines) {
                let sl = subLine.trim();
                if (!sl) continue;

                // Если строка содержит несколько замеров через запятую/точку с запятой/разделитель
                if (/[,;•|]|\s+\/\s+/.test(sl)) {
                    const parts = sl.split(/[,;•|]|\s+\/\s+/);
                    for (let p of parts) {
                        let cp = p.trim().replace(/^[\-\–—\•\*\s]*(?:\d+[\.\)]\s*)?/, '').trim();
                        if (cp && /\d+/.test(cp) && (kwRegex.test(cp) || measureLinePattern.test(cp))) {
                            const formatted = formatMeasurementItem(cp, lang);
                            if (formatted) lines.push(formatted);
                        }
                    }
                }
                // Если строка сама по себе является замером (например: "Длинна 71", "Плечи 36", "Подмышки 44", "Рыкав от плеча 64")
                else if (/\d+/.test(sl) && (kwRegex.test(sl) || measureLinePattern.test(sl))) {
                    let cp = sl.replace(/^[\-\–—\•\*\s]*(?:\d+[\.\)]\s*)?/, '').trim();
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
    for (let l of lines) {
        if (kwSplitRegex.test(l)) {
            const parts = l.replace(kwSplitRegex, '$1\n$2').split(/\r?\n/);
            for (let p of parts) {
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
    for (let l of sanitizedLines) {
        if (!unique.includes(l)) unique.push(l);
    }
    const finalResult = unique.slice(0, 8);
    if (!item._measCache) item._measCache = {};
    item._measCache[lang] = finalResult;
    return finalResult;
}
window.extractItemMeasurements = extractItemMeasurements;

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

window.showItemMeasurementsTooltip = function(itemOrId, e) {
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
    const measures = (item._measCache && item._measCache[currentLang]) ? item._measCache[currentLang] : extractItemMeasurements(item, currentLang);
    if (!measures || measures.length === 0) return;

    const tooltip = getMeasurementsTooltip();
    
    const escape = (str) => String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const itemsHTML = measures.map(m => `
        <li class="measurements-tooltip-item">
            <span class="measurements-dot"></span>
            <span class="measurements-text">${escape(m)}</span>
        </li>
    `).join('');

    const titles = {
        ru: '[ ЗАМЕРЫ ]',
        ua: '[ ЗАМІРИ ]',
        en: '[ MEASUREMENTS ]'
    };
    const headerTitle = titles[currentLang] || titles.ru;

    tooltip.innerHTML = `
        <div class="measurements-tooltip-header">${headerTitle}</div>
        <ul class="measurements-tooltip-list">${itemsHTML}</ul>
    `;

    if (_tooltipHideTimer) {
        clearTimeout(_tooltipHideTimer);
        _tooltipHideTimer = null;
    }
    tooltip.style.display = 'block';
    tooltip.classList.add('visible');
    _isTooltipVisible = true;
    window.moveItemMeasurementsTooltip(e);
};

window.moveItemMeasurementsTooltip = function(e) {
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

    // Защита от вылета за правый край окна
    if (x + tooltipWidth > window.innerWidth - 12) {
        x = clientX - tooltipWidth - offset;
    }
    // Защита от вылета за нижний край окна
    if (y + tooltipHeight > window.innerHeight - 12) {
        y = clientY - tooltipHeight - offset;
    }

    if (x < 10) x = 10;
    if (y < 10) y = 10;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
};

window.isItemMeasurementsTooltipVisible = function() {
    return !!_isTooltipVisible;
};

window.hideItemMeasurementsTooltip = function() {
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

// Прячем тултип при скролле страницы (без нагрузки на скролл, когда тултип закрыт)
window.addEventListener('scroll', () => {
    if (_isTooltipVisible) window.hideItemMeasurementsTooltip();
}, { passive: true });

// Безопасное сохранение каталога в IndexedDB с защитой от переполнения квоты localStorage
async function safelySaveCatalogToStorage(items) {
    if (!items || !Array.isArray(items) || items.length === 0) return;
    
    // 1. Первичное и надежное сохранение в IndexedDB (без лимитов размера и без блокировки главного потока)
    if (typeof window.idbSet === 'function') {
        try {
            const saved = await window.idbSet('nisha_cached_db', items);
            if (saved) {
                // Очищаем тяжелый дубликат из storage, освобождая 4-5MB под корзину, профиль и заказы
                if (window.storage) window.storage.remove('nisha_cached_db');
                return;
            }
        } catch (idbErr) {
            console.warn("[КАТАЛОГ] Ошибка сохранения в IndexedDB, используем storage:", idbErr);
        }
    }

    // 2. Fallback для приватного режима или неподдерживающих браузеров
    try {
        if (window.storage) window.storage.setJSON('nisha_cached_db', items);
    } catch (e) {
        console.warn("[КАТАЛОГ] Лимит storage превышен, пробуем компактное сохранение:", e);
        try {
            // Компактная версия: обрезаем description до 200 символов (достаточно для замеров в тултипах)
            const slim = items.map(item => {
                if (!item.description || item.description.length <= 200) return item;
                return { ...item, description: item.description.slice(0, 200) };
            });
            if (window.storage) window.storage.setJSON('nisha_cached_db', slim);
        } catch (slimErr) {
            console.warn("[КАТАЛОГ] Не удалось закэшировать каталог в storage:", slimErr);
        }
    }
}

// Загрузка всех товаров из БД и кэша
async function loadAllItems() {
    const grid = document.getElementById('itemsGrid');
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    
    // 1. МГНОВЕННАЯ ЗАГРУЗКА (Из IndexedDB с миграцией из localStorage)
    let cachedItems = null;
    if (typeof window.idbGet === 'function') {
        try {
            cachedItems = await window.idbGet('nisha_cached_db');
        } catch (e) {}
    }

    if (!cachedItems) {
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        cachedItems = store ? store.getJSON('nisha_cached_db', null) : null;
        if (cachedItems) {
            // Мигрируем кэш в IndexedDB и освобождаем storage
            if (typeof window.idbSet === 'function' && Array.isArray(cachedItems) && cachedItems.length > 0) {
                window.idbSet('nisha_cached_db', cachedItems).then(() => {
                    if (window.storage) window.storage.remove('nisha_cached_db');
                });
            }
        }
    }

    if (cachedItems && Array.isArray(cachedItems) && window.allItems.length === 0) {
        try {
            const isCorrupted = cachedItems.length === 0 || 
                cachedItems[0].description === undefined || 
                ((!Array.isArray(cachedItems[0].images) || cachedItems[0].images.length === 0) &&
                 (!Array.isArray(cachedItems[0].thumbnails) || cachedItems[0].thumbnails.length === 0));

            if (isCorrupted) {
                console.warn("[КЭШ КАТАЛОГА] Обнаружены поврежденные данные без фото/описания, очищаем локальный кэш...");
                cachedItems = null;
                if (typeof window.idbDel === 'function') window.idbDel('nisha_cached_db');
                if (window.storage) window.storage.remove('nisha_cached_db');
            } else {
                window.allItems = cachedItems;
                if (window.searchWorker && typeof window.searchWorker.setItems === 'function') {
                    window.searchWorker.setItems(cachedItems);
                }
                applyFilters(true);
                updateSidebarCounters();
            }
        } catch(e) { 
            console.error("Ошибка парсинга кэша"); 
            cachedItems = null;
            if (typeof window.idbDel === 'function') window.idbDel('nisha_cached_db');
            if (window.storage) window.storage.remove('nisha_cached_db');
        }
    }

    if (!sb) return;
    if (typeof initCatalogRealtimeSubscription === 'function') initCatalogRealtimeSubscription();

    // 2. ФОНОВЫЙ ЗАПРОС К БД (Снимаем лимит, берем 1000 товаров, включая description)
    const { data, error } = await sb.from('items')
        .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable')
        .limit(1000)
        .order('created_at', { ascending: false });
    
    if (error) { 
        if (window.allItems.length === 0) {
            if (typeof handleNetworkOffline === 'function') {
                handleNetworkOffline();
            } else if (grid) {
                const safeErrMsg = typeof window.escapeHtml === 'function' ? window.escapeHtml(error.message) : error.message;
                grid.innerHTML = `<div style="color:red; padding:20px; grid-column: 1/-1;">[ ОШИБКА БД: ${safeErrMsg} ]</div>`;
            }
        }
        return; 
    }
    
    // Сравниваем изменения без блокирующего JSON.stringify на всем каталоге
    let isStructureChanged = !Array.isArray(window.allItems) || (data.length !== window.allItems.length);
    const changedCardItems = [];
    if (!isStructureChanged) {
        for (let i = 0; i < data.length; i++) {
            const cur = window.allItems[i];
            const next = data[i];
            if (!cur || cur.id !== next.id || cur.name !== next.name || cur.category !== next.category || cur.size !== next.size || cur.brand !== next.brand || !!cur.is_top !== !!next.is_top) {
                isStructureChanged = true;
                break;
            }
            const wasHot = (cur.views_count || 0) >= 25;
            const nowHot = (next.views_count || 0) >= 25;
            const curThumb0 = Array.isArray(cur.thumbnails) ? cur.thumbnails[0] : '';
            const nextThumb0 = Array.isArray(next.thumbnails) ? next.thumbnails[0] : '';
            if (cur.price !== next.price || cur.old_price !== next.old_price || cur.status !== next.status || !!cur.is_sale !== !!next.is_sale || wasHot !== nowHot || curThumb0 !== nextThumb0) {
                changedCardItems.push(next);
            }
        }
    }

    // Проверяем наличие валидных изображений в ответе
    const hasValidImages = Array.isArray(data) && data.length > 0 && (
        (Array.isArray(data[0].images) && data[0].images.length > 0) ||
        (Array.isArray(data[0].thumbnails) && data[0].thumbnails.length > 0)
    );

    const deferSave = () => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => safelySaveCatalogToStorage(data), { timeout: 2500 });
        } else {
            setTimeout(() => safelySaveCatalogToStorage(data), 1500);
        }
    };

    if (hasValidImages) {
        window.allItems = data; 
        if (window.searchWorker && typeof window.searchWorker.setItems === 'function') {
            window.searchWorker.setItems(data);
        }
        if (isStructureChanged || changedCardItems.length > 0 || !cachedItems) deferSave(); 
        updateSidebarCounters();
    } else if (data && data.length > 0) {
        console.warn("[КАТАЛОГ] Сервер или SW вернул ответ без фото, сохраняем существующие изображения...");
        const oldMap = new Map((window.allItems || []).map(i => [i.id, i]));
        data.forEach(item => {
            const old = oldMap.get(item.id);
            if (old) {
                if (!item.images || item.images.length === 0) item.images = old.images;
                if (!item.thumbnails || item.thumbnails.length === 0) item.thumbnails = old.thumbnails;
                if (!item.description) item.description = old.description;
            }
        });
        window.allItems = data;
        if (window.searchWorker && typeof window.searchWorker.setItems === 'function') {
            window.searchWorker.setItems(data);
        }
        updateSidebarCounters();
        if (data[0] && Array.isArray(data[0].images) && data[0].images.length > 0) {
            deferSave();
        }
    } 

    // Инициализируем множество уже известных товаров, чтобы не спамить тостом на вещи первой загрузки
    if (!window._notifiedItemIds) {
        window._notifiedItemIds = new Set(Array.isArray(window.allItems) ? window.allItems.map(i => i.id) : []);
    } else if (Array.isArray(window.allItems)) {
        window.allItems.forEach(i => window._notifiedItemIds.add(i.id));
    } 
    
    // 3. ИСТОРИЯ ПРОСМОТРОВ
    const profile = (typeof userProfile !== 'undefined') ? userProfile : (window.userProfile || null);
    if (profile && profile.viewed_history && profile.viewed_history.length > 0) {
        let dbHistory = [];
        profile.viewed_history.forEach(uuid => {
            const histItem = window.allItems.find(i => i.id === uuid);
            if (histItem) {
                const img = (histItem.images && histItem.images.length > 0) ? histItem.images[0] : '';
                dbHistory.push({ id: histItem.id, name: histItem.name, price: histItem.price, img: img });
            }
        });
        if (window.storage) window.storage.setJSON('nisha_history', dbHistory);
        if (typeof renderHistory === 'function') renderHistory();
    }

    // 4. СИНХРОНИЗАЦИЯ КОРЗИНЫ
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    let userCart = (typeof cart !== 'undefined') ? cart : (window.cart || (store ? store.getJSON('nisha_cart', []) : []));
    const validCart = userCart.filter(cItem => window.allItems.some(dbItem => dbItem.id === cItem.id));
    if (validCart.length !== userCart.length) {
        if (typeof cart !== 'undefined') cart = validCart;
        window.cart = validCart;
        if (store) store.setJSON('nisha_cart', validCart);
        if (typeof updateCartUI === 'function') updateCartUI();
    }

    // 5. ПЕРЕРИСОВКА (Без сброса скролла, если изменились только точечные статусы/цены)
    if (!cachedItems || isStructureChanged) {
        applyFilters(!cachedItems); 
    } else if (changedCardItems.length > 0) {
        const freshMap = new Map(window.allItems.map(i => [i.id, i]));
        if (Array.isArray(window.filteredItems)) {
            window.filteredItems = window.filteredItems.map(fi => freshMap.get(fi.id) || fi);
        }
        changedCardItems.forEach(item => updateCardDOM(item));
    }
}
window.loadAllItems = loadAllItems;

// ==========================================
// ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ КАРТОЧКИ В DOM (БЕЗ ПЕРЕРИСОВКИ ВСЕЙ СЕТКИ)
// ==========================================
function updateCardDOM(item) {
    if (!item || !item.id) return;

    if (Array.isArray(window.filteredItems)) {
        const fIdx = window.filteredItems.findIndex(fi => fi && String(fi.id) === String(item.id));
        if (fIdx !== -1 && window.filteredItems[fIdx] !== item) {
            Object.assign(window.filteredItems[fIdx], item);
        }
    }

    const cards = document.querySelectorAll(`.item-card[data-id="${item.id}"]`);
    const curr = (typeof getCurrency === 'function') ? getCurrency() : 'грн';
    const sizePrefix = (typeof i18next !== 'undefined') ? i18next.t('grid.size_prefix', { defaultValue: 'Размер: ' }) : 'Размер: ';

    if (cards && cards.length > 0) {
        cards.forEach(card => {
            // 1. Очищаем старые бейджи статуса
            const oldBadges = card.querySelectorAll('.sold-badge, .reserved-badge, .system-status-bar');
            oldBadges.forEach(b => b.remove());

            card.classList.remove('sold-out', 'reserved-item');

            const cartBtn = card.querySelector('.grid-cart-btn');

            // 2. Обрабатываем статус и бейджи (SOLD / RESERVED / TOP / SALE / HOT)
            if (item.status === 'sold') {
                card.classList.add('sold-out');
                card.classList.remove('unseen-pulse');
                card.insertAdjacentHTML('afterbegin', '<div class="sold-badge">SOLD</div>');
                if (cartBtn) cartBtn.style.display = 'none';
            } else if (item.status === 'reserved') {
                card.classList.add('reserved-item');
                card.classList.remove('unseen-pulse');
                card.insertAdjacentHTML('afterbegin', '<div class="reserved-badge">RESERVED</div>');
                if (cartBtn) cartBtn.style.display = '';
            } else {
                // available
                if (cartBtn) cartBtn.style.display = '';

                const hasSale = !!item.is_sale;
                const hasHot = (item.views_count || 0) >= 25;
                const isTop = item.is_top === true && item.top_until && new Date(item.top_until).getTime() > Date.now();

                if (hasSale || hasHot || isTop) {
                    let badgeHTML = `<div class="system-status-bar">`;
                    const parts = [];
                    if (isTop) {
                        parts.push(`<span class="status-item status-top"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> TOP</span>`);
                    }
                    if (hasSale) {
                        parts.push(`<span class="status-item status-sale">% SALE</span>`);
                    }
                    if (hasHot) {
                        const chartSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
                        parts.push(`<span class="status-item status-hot">${chartSvg} HOT</span>`);
                    }
                    badgeHTML += parts.join('<div class="status-divider"></div>') + `</div>`;
                    card.insertAdjacentHTML('afterbegin', badgeHTML);
                }
            }

            // 3. Обновляем цену, название, размер, бренд и состояние в карточке
            const priceDiv = card.querySelector('.item-price');
            if (priceDiv) {
                const fPrice = (typeof window.formatPrice === 'function') ? window.formatPrice(item.price) : `${item.price} ${curr}`;
                if (item.is_sale && item.old_price) {
                    const fOld = (typeof window.formatPrice === 'function') ? window.formatPrice(item.old_price) : `${item.old_price} ${curr}`;
                    priceDiv.innerHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 14px; margin-right: 8px;">${fOld}</span><span style="color: var(--accent-green);">${fPrice}</span>`;
                } else {
                    priceDiv.innerHTML = `<span style="color: var(--accent-green);">${fPrice}</span>`;
                }
            }

            const titleEl = card.querySelector('.item-title');
            if (titleEl && item.name) {
                titleEl.textContent = item.name;
            }
            const sizeEl = card.querySelector('.item-size');
            if (sizeEl && item.size !== undefined) {
                const safeSize = typeof window.escapeHtml === 'function' ? window.escapeHtml(item.size || '') : (item.size || '');
                sizeEl.innerHTML = `<span data-i18n="grid.size_prefix">${sizePrefix}</span>${safeSize}`;
            }
            const footerEl = card.querySelector('.item-footer');
            if (footerEl && (item.brand !== undefined || item.condition !== undefined)) {
                const safeBrand = typeof window.escapeHtml === 'function' ? window.escapeHtml(item.brand || '') : (item.brand || '');
                const safeCond = typeof window.escapeHtml === 'function' ? window.escapeHtml(item.condition || '') : (item.condition || '');
                footerEl.innerHTML = `<span>${safeBrand}</span><span>${safeCond}</span>`;
            }
        });
    }

    // 4. Если этот товар открыт в детальной модалке (productModal)
    const activeModal = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    if (activeModal && String(activeModal.id) === String(item.id)) {
        Object.assign(activeModal, item);
        const modalCartBtn = document.getElementById('modalCartBtn');
        const modalPriceEl = document.getElementById('modalItemPrice');
        const modalTitleEl = document.getElementById('modalItemTitle');
        const modalViewsEl = document.getElementById('modalItemViews');
        if (modalTitleEl && item.name) modalTitleEl.textContent = item.name;
        if (modalViewsEl && item.views_count !== undefined) modalViewsEl.textContent = item.views_count || 0;
        if (modalCartBtn) {
            if (item.status === 'sold') {
                modalCartBtn.style.display = 'none';
            } else {
                modalCartBtn.style.display = 'block';
                const userCart = (typeof getActiveCart === 'function') ? getActiveCart() : (window.cart || []);
                const isInCart = userCart.some(i => String(i.id) === String(item.id));
                const inCartText = (typeof i18next !== 'undefined') ? i18next.t('product.in_cart', { defaultValue: '[ В КОРЗИНЕ ]' }) : '[ В КОРЗИНЕ ]';
                const addToCartText = (typeof i18next !== 'undefined') ? i18next.t('product.add_to_cart', { defaultValue: 'В КОРЗИНУ' }) : 'В КОРЗИНУ';
                modalCartBtn.innerText = isInCart ? inCartText : addToCartText;
            }
        }
        if (modalPriceEl) {
            const isHackedActive = window.isHacked || (typeof isHacked !== 'undefined' && isHacked);
            const finalPrice = isHackedActive ? Math.floor(item.price * 0.9) : item.price;
            modalPriceEl.innerText = (typeof window.formatPrice === 'function') ? window.formatPrice(finalPrice) : (finalPrice + ' ' + curr);
        }
    }
}
window.updateCardDOM = updateCardDOM;

function removeSoldItemFromCart(itemId, itemName) {
    const currentCart = (typeof window.getActiveCart === 'function')
        ? window.getActiveCart()
        : ((typeof getActiveCart === 'function') ? getActiveCart() : (window.cart || []));
    const cartIdx = currentCart.findIndex(c => c && String(c.id) === String(itemId));
    if (cartIdx !== -1) {
        currentCart.splice(cartIdx, 1);
        if (typeof window.setActiveCart === 'function') {
            window.setActiveCart(currentCart);
        } else if (typeof setActiveCart === 'function') {
            setActiveCart(currentCart);
        } else {
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            if (store) store.setJSON('nisha_cart', currentCart);
            window.cart = currentCart;
        }
        if (typeof syncCartToServer === 'function') syncCartToServer();
        if (typeof updateCartUI === 'function') updateCartUI();
        if (typeof showToast === 'function') {
            const itemSoldRemovedMsg = typeof i18next !== 'undefined' ? i18next.t('messages.item_sold_removed', { name: itemName || '', defaultValue: `Товар ${itemName || ''} уже купили, он удален из корзины.` }) : `Товар ${itemName || ''} уже купили, он удален из корзины.`;
            showToast(itemSoldRemovedMsg, 'error');
        }
    }
}
window.removeSoldItemFromCart = removeSoldItemFromCart;

// КРОСС-ВКЛАДОЧНЫЙ BROADCAST CHANNEL (МГНОВЕННАЯ СИНХРОНИЗАЦИЯ МЕЖДУ ВКЛАДКАМИ БРАУЗЕРА)
let _catalogBroadcastChannel = null;
if (typeof BroadcastChannel !== 'undefined' && !window._nishaCatalogBcInit) {
    window._nishaCatalogBcInit = true;
    try {
        _catalogBroadcastChannel = new BroadcastChannel('nisha_catalog_sync');
        _catalogBroadcastChannel.onmessage = (event) => {
            const msg = event && event.data;
            if (!msg || !msg.type) return;
            if (msg.type === 'ITEM_UPSERT' && msg.item) {
                handleRealtimeCatalogEvent({ eventType: 'UPDATE', new: msg.item }, true);
            } else if (msg.type === 'ITEM_DELETE' && msg.id) {
                handleRealtimeCatalogEvent({ eventType: 'DELETE', old: { id: msg.id } }, true);
            }
        };
    } catch (e) {
        _catalogBroadcastChannel = null;
    }
}

// ОБРАБОТЧИК REALTIME СОБЫТИЙ SUPABASE (INSERT / UPDATE / DELETE БЕЗ ПЕРЕЗАГРУЗКИ СТРАНИЦЫ)
function handleRealtimeCatalogEvent(payload, fromBroadcast = false) {
    if (!payload) return;
    const eventType = payload.eventType || payload.type;
    if (!Array.isArray(window.allItems)) window.allItems = [];

    if (eventType === 'DELETE') {
        const delId = payload.old && payload.old.id;
        if (!delId) return;
        const existed = window.allItems.some(i => String(i.id) === String(delId));
        if (!existed) return;

        window.allItems = window.allItems.filter(i => String(i.id) !== String(delId));
        if (Array.isArray(window.filteredItems)) {
            window.filteredItems = window.filteredItems.filter(i => String(i.id) !== String(delId));
        }

        document.querySelectorAll(`.item-card[data-id="${delId}"]`).forEach(card => card.remove());
        removeSoldItemFromCart(delId);

        const countEl = document.getElementById('itemCount');
        if (countEl && Array.isArray(window.filteredItems)) {
            countEl.innerText = window.filteredItems.length;
        }

        const activeModal = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
        if (activeModal && String(activeModal.id) === String(delId) && typeof closeModal === 'function') {
            closeModal('productModal');
        }

        updateSidebarCounters();
        if (typeof renderHistory === 'function') renderHistory();
        if (typeof window.invalidateFuseCache === 'function') window.invalidateFuseCache();
        safelySaveCatalogToStorage(window.allItems);
        applyFilters(true, true);

        if (!fromBroadcast && _catalogBroadcastChannel) {
            try { _catalogBroadcastChannel.postMessage({ type: 'ITEM_DELETE', id: delId }); } catch (e) {}
        }
        return;
    }

    const fresh = payload.new;
    if (!fresh || !fresh.id) return;

    const existingIdx = window.allItems.findIndex(i => i && String(i.id) === String(fresh.id));

    if (eventType === 'INSERT' || existingIdx === -1) {
        window._notifiedItemIds = window._notifiedItemIds || new Set();
        const isNewUnseen = !window._notifiedItemIds.has(fresh.id);
        if (isNewUnseen) {
            window._notifiedItemIds.add(fresh.id);
        }

        if (existingIdx !== -1) {
            window.allItems[existingIdx] = fresh;
        } else {
            window.allItems.unshift(fresh);
        }
        const sortDateDesc = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
        window.allItems = (typeof window.toSorted === 'function')
            ? window.toSorted(window.allItems, sortDateDesc)
            : (window.allItems.toSorted ? window.allItems.toSorted(sortDateDesc) : [...window.allItems].sort(sortDateDesc));

        if (!fromBroadcast && isNewUnseen) {
            if (typeof enqueueNewItemToast === 'function') {
                enqueueNewItemToast(fresh);
            } else if (typeof showToast === 'function') {
                showToast((typeof i18next !== 'undefined' && i18next.t('messages.new_items_toast')) || 'Новые Вещи!!!', 'success');
            }
        }

        // Плавно добавляем карточку на витрину без дергания экрана
        if (typeof insertNewItemCardSmoothly === 'function') {
            insertNewItemCardSmoothly(fresh);
        } else {
            applyFilters(true, true);
        }

        updateSidebarCounters();
        if (typeof window.invalidateFuseCache === 'function') window.invalidateFuseCache();
        safelySaveCatalogToStorage(window.allItems);

        if (!fromBroadcast && _catalogBroadcastChannel) {
            try { _catalogBroadcastChannel.postMessage({ type: 'ITEM_UPSERT', item: fresh }); } catch (e) {}
        }
        return;
    }

    // UPDATE существующего товара
    const item = window.allItems[existingIdx];
    const nowTs = Date.now();
    const wasTop = item.is_top === true && item.top_until && new Date(item.top_until).getTime() > nowTs;
    const nowTop = fresh.is_top === true && fresh.top_until && new Date(fresh.top_until).getTime() > nowTs;
    const topChanged = wasTop !== nowTop || item.top_until !== fresh.top_until || !!item.is_top !== !!fresh.is_top;

    const oldStatus = item.status;
    const oldPrice = item.price;
    const oldIsSale = item.is_sale;

    const statusChanged = item.status !== fresh.status;
    const _saleChanged = (!!item.is_sale !== !!fresh.is_sale) || (item.old_price !== fresh.old_price);
    const _priceChanged = item.price !== fresh.price;
    const wasHot = (item.views_count || 0) >= 25;
    const nowHot = (fresh.views_count !== undefined ? fresh.views_count : (item.views_count || 0)) >= 25;
    const _hotChanged = wasHot !== nowHot;
    const categoryChanged = fresh.category !== undefined && item.category !== fresh.category;
    const sizeChanged = fresh.size !== undefined && item.size !== fresh.size;
    const _metaChanged = (fresh.name !== undefined && item.name !== fresh.name) ||
                        (fresh.brand !== undefined && item.brand !== fresh.brand) ||
                        (fresh.condition !== undefined && item.condition !== fresh.condition) ||
                        categoryChanged || sizeChanged;

    // Бережно мержим поля (сохраняя массив фото и описание, если в сжатом payload их нет)
    const preservedImages = (Array.isArray(fresh.images) && fresh.images.length > 0) ? fresh.images : item.images;
    const preservedThumbs = (Array.isArray(fresh.thumbnails) && fresh.thumbnails.length > 0) ? fresh.thumbnails : item.thumbnails;
    const preservedDesc = (fresh.description !== undefined && fresh.description !== null) ? fresh.description : item.description;

    Object.assign(item, fresh, {
        images: preservedImages,
        thumbnails: preservedThumbs,
        description: preservedDesc
    });

    updateCardDOM(item);

    if (!fromBroadcast && typeof showToast === 'function') {
        const numOldPrice = Number(oldPrice) || 0;
        const numNewPrice = Number(item.price) || 0;
        if ((!oldIsSale && item.is_sale) || (numOldPrice > 0 && numNewPrice > 0 && numOldPrice > numNewPrice)) {
            if (item.status === 'available') {
                const salePref = (typeof i18next !== 'undefined' && i18next.t('messages.sale_prefix')) || '🔥 СКИДКА: ';
                showToast(`${salePref}${item.name}`, 'success');
            }
        }
        if (oldStatus !== 'sold' && item.status === 'sold') {
            removeSoldItemFromCart(item.id, item.name);
        } else if (oldStatus === 'reserved' && item.status === 'available') {
            const expPref = (typeof i18next !== 'undefined' && i18next.t('messages.reservation_expired')) || 'Бронь истекла: ';
            const backInStock = (typeof i18next !== 'undefined' && i18next.t('messages.back_in_stock')) || ' снова в наличии!';
            showToast(`${expPref}${item.name}${backInStock}`, 'info');
        }
    }

    updateSidebarCounters();
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof window.invalidateFuseCache === 'function') window.invalidateFuseCache();
    safelySaveCatalogToStorage(window.allItems);

    const hideUnavailable = document.getElementById('hideUnavailableCb')?.checked || false;
    const onlySale = document.getElementById('onlySaleCb')?.checked || false;
    const needsGridResortOrRefilter = topChanged || categoryChanged || sizeChanged ||
                                      (hideUnavailable && statusChanged) ||
                                      (onlySale && saleChanged);

    if (needsGridResortOrRefilter) {
        applyFilters(true, true);
    }

    if (!fromBroadcast && _catalogBroadcastChannel) {
        try { _catalogBroadcastChannel.postMessage({ type: 'ITEM_UPSERT', item }); } catch (e) {}
    }
}
window.handleRealtimeCatalogEvent = handleRealtimeCatalogEvent;

let _catalogRealtimeChannel = null;
function initCatalogRealtimeSubscription() {
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!sb || typeof sb.channel !== 'function') return;

    if (_catalogRealtimeChannel) {
        const state = _catalogRealtimeChannel.state;
        if (state === 'joined' || state === 'joining') return;
        try { sb.removeChannel(_catalogRealtimeChannel); } catch (e) {}
        _catalogRealtimeChannel = null;
    }

    try {
        _catalogRealtimeChannel = sb.channel('public-items-live-feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
                handleRealtimeCatalogEvent(payload, false);
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    _catalogRealtimeChannel = null;
                }
            });
    } catch (e) {
        _catalogRealtimeChannel = null;
    }
}
window.initCatalogRealtimeSubscription = initCatalogRealtimeSubscription;

// СИНХРОНИЗАЦИЯ КАТАЛОГА В РЕАЛЬНОМ ВРЕМЕНИ (НОВЫЕ ТОВАРЫ, СТАТУСЫ, БЕЙДЖИ TOP/HOT/SALE)
let _isSyncingItems = false;
async function syncCriticalStatuses() {
    if (_isSyncingItems) return;
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!sb || !window.allItems || window.allItems.length === 0) return;
    initCatalogRealtimeSubscription();

    _isSyncingItems = true;
    try {
        const { data, error } = await sb.from('items')
            .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, views_count, created_at, category, size, condition')
            .order('created_at', { ascending: false })
            .limit(999);

        if (error || !data) return;

        const freshIdSet = new Set(data.map(d => d.id));
        const currentIdSet = new Set(window.allItems.map(i => i.id));
        let gridNeedsFullRefresh = false;

        // 1. Очистка от удаленных из БД товаров (Set.prototype.difference)
        const deletedIds = (typeof currentIdSet.difference === 'function')
            ? Array.from(currentIdSet.difference(freshIdSet))
            : ((typeof window.setDifference === 'function')
                ? Array.from(window.setDifference(currentIdSet, freshIdSet))
                : window.allItems.filter(i => i && !freshIdSet.has(i.id)).map(i => i.id));

        if (deletedIds.length > 0) {
            window.allItems = window.allItems.filter(i => freshIdSet.has(i.id));
            if (Array.isArray(window.filteredItems)) {
                window.filteredItems = window.filteredItems.filter(i => freshIdSet.has(i.id));
            }
            deletedIds.forEach(delId => {
                document.querySelectorAll(`.item-card[data-id="${delId}"]`).forEach(card => card.remove());
                removeSoldItemFromCart(delId);
            });
            gridNeedsFullRefresh = true;
        }

        // 2. Проверка новых товаров (которых еще нет в клиенте через Set.prototype.difference)
        const newIds = (typeof freshIdSet.difference === 'function')
            ? Array.from(freshIdSet.difference(currentIdSet))
            : ((typeof window.setDifference === 'function')
                ? Array.from(window.setDifference(freshIdSet, currentIdSet))
                : data.filter(d => d && !currentIdSet.has(d.id)).map(d => d.id));
        if (newIds.length > 0) {
            const { data: fullNewItems } = await sb.from('items')
                .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable')
                .in('id', newIds);

            if (fullNewItems && fullNewItems.length > 0) {
                window._notifiedItemIds = window._notifiedItemIds || new Set();
                const freshNewArrivals = [];
                fullNewItems.forEach(newItem => {
                    if (!window.allItems.some(i => i.id === newItem.id)) {
                        window.allItems.unshift(newItem);
                    }
                    if (!window._notifiedItemIds.has(newItem.id)) {
                        window._notifiedItemIds.add(newItem.id);
                        freshNewArrivals.push(newItem);
                    }
                });

                const sortDateDesc = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
                window.allItems = (typeof window.toSorted === 'function')
                    ? window.toSorted(window.allItems, sortDateDesc)
                    : (window.allItems.toSorted ? window.allItems.toSorted(sortDateDesc) : [...window.allItems].sort(sortDateDesc));

                // Плавно вставляем каждую новую карточку сверху без дергания сетки
                if (typeof insertNewItemCardSmoothly === 'function') {
                    freshNewArrivals.forEach(item => insertNewItemCardSmoothly(item));
                } else {
                    gridNeedsFullRefresh = true;
                }

                // Единый тост на всю пачку новинок (ровно 1 раз!)
                if (freshNewArrivals.length > 0) {
                    if (typeof enqueueNewItemToast === 'function') {
                        enqueueNewItemToast(freshNewArrivals);
                    } else if (typeof showToast === 'function') {
                        showToast((typeof i18next !== 'undefined' && i18next.t('messages.new_items_toast')) || 'Новые Вещи!!!', 'success');
                    }
                }
            }
        }

        // 3. Синхронизация статусов, бейджей (TOP/HOT/SALE/SOLD/RESERVED) и цен существующих товаров
        const freshMap = new Map();
        data.forEach(d => freshMap.set(d.id, d));
        let anyCardUpdated = false;
        const nowTs = Date.now();
        const hideUnavailable = document.getElementById('hideUnavailableCb')?.checked || false;
        const onlySale = document.getElementById('onlySaleCb')?.checked || false;

        window.allItems.forEach(item => {
            const fresh = freshMap.get(item.id);
            if (!fresh) return;

            const wasTop = item.is_top === true && item.top_until && new Date(item.top_until).getTime() > nowTs;
            const nowTop = fresh.is_top === true && fresh.top_until && new Date(fresh.top_until).getTime() > nowTs;
            const domCard = document.querySelector(`.item-card[data-id="${item.id}"]`);
            const domHasTopBadge = !!(domCard && domCard.querySelector('.status-top'));
            const topExpiredInDom = domHasTopBadge && !nowTop;
            const topChanged = wasTop !== nowTop || item.top_until !== fresh.top_until || !!item.is_top !== !!fresh.is_top || topExpiredInDom;

            const statusChanged = item.status !== fresh.status;
            const saleChanged = (!!item.is_sale !== !!fresh.is_sale) || (item.old_price !== fresh.old_price);
            const priceChanged = item.price !== fresh.price;
            const wasHot = (item.views_count || 0) >= 25;
            const nowHot = (fresh.views_count || 0) >= 25;
            const hotChanged = wasHot !== nowHot;
            const metaChanged = (fresh.name && item.name !== fresh.name) ||
                                (fresh.brand && item.brand !== fresh.brand) ||
                                (fresh.size !== undefined && item.size !== fresh.size) ||
                                (fresh.category !== undefined && item.category !== fresh.category) ||
                                (fresh.condition !== undefined && item.condition !== fresh.condition);

            if (item.views_count !== fresh.views_count) {
                item.views_count = fresh.views_count;
            }

            if (topChanged || statusChanged || saleChanged || priceChanged || hotChanged || metaChanged) {
                const oldStatus = item.status;
                const oldPrice = item.price;
                const oldIsSale = item.is_sale;

                // Обновляем поля объекта
                item.is_top = fresh.is_top;
                item.top_until = fresh.top_until;
                item.status = fresh.status;
                item.is_sale = fresh.is_sale;
                item.old_price = fresh.old_price;
                item.price = fresh.price;
                item.views_count = fresh.views_count;
                if (fresh.name) item.name = fresh.name;
                if (fresh.brand) item.brand = fresh.brand;
                if (fresh.size !== undefined) item.size = fresh.size;
                if (fresh.category !== undefined) item.category = fresh.category;
                if (fresh.condition !== undefined) item.condition = fresh.condition;

                // Мгновенно обновляем карточку в DOM без мерцания
                updateCardDOM(item);
                anyCardUpdated = true;

                if (topChanged || (hideUnavailable && statusChanged) || (onlySale && saleChanged)) {
                    gridNeedsFullRefresh = true;
                }

                // Уведомления пользователю
                if (typeof showToast === 'function') {
                    if ((!oldIsSale && fresh.is_sale) || (oldPrice > fresh.price)) {
                        if (fresh.status === 'available') {
                            const salePref = (typeof i18next !== 'undefined' && i18next.t('messages.sale_prefix')) || '🔥 СКИДКА: ';
                showToast(`${salePref}${item.name}`, 'success');
                        }
                    }
                    if (oldStatus !== 'sold' && fresh.status === 'sold') {
                        removeSoldItemFromCart(item.id, item.name);
                    } else if (oldStatus === 'reserved' && fresh.status === 'available') {
                        const expPref = (typeof i18next !== 'undefined' && i18next.t('messages.reservation_expired')) || 'Бронь истекла: ';
            const backInStock = (typeof i18next !== 'undefined' && i18next.t('messages.back_in_stock')) || ' снова в наличии!';
            showToast(`${expPref}${item.name}${backInStock}`, 'info');
                    }
                }
            }
        });

        const canSafelySaveCache = window.allItems && window.allItems.length > 0 && (
            (Array.isArray(window.allItems[0].images) && window.allItems[0].images.length > 0) ||
            (Array.isArray(window.allItems[0].thumbnails) && window.allItems[0].thumbnails.length > 0)
        );

        if (gridNeedsFullRefresh) {
            if (canSafelySaveCache) {
                safelySaveCatalogToStorage(window.allItems);
            }
            updateSidebarCounters();
            if (typeof renderHistory === 'function') renderHistory();
            if (typeof window.invalidateFuseCache === 'function') window.invalidateFuseCache();
            if (typeof applyFilters === 'function') applyFilters(true, true);
        } else if (anyCardUpdated) {
            if (canSafelySaveCache) {
                safelySaveCatalogToStorage(window.allItems);
            }
            updateSidebarCounters();
            if (typeof renderHistory === 'function') renderHistory();
            if (typeof window.invalidateFuseCache === 'function') window.invalidateFuseCache();
        }
    } catch (e) {
        console.warn("Sync error:", e);
    } finally {
        _isSyncingItems = false;
    }
}
window.syncCriticalStatuses = syncCriticalStatuses;

// Периодический фоновый опрос и мгновенная синхронизация при возвращении в PWA / вкладку
if (!window._catalogAutoSyncInitialized) {
    window._catalogAutoSyncInitialized = true;
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            syncCriticalStatuses();
        }
    }, 7000); // Быстрый и легкий фоновый опрос каждые 7 секунд (гарантия авто-появления вещей в PWA)

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            initCatalogRealtimeSubscription();
            syncCriticalStatuses();
        }
    });
    window.addEventListener('focus', () => {
        initCatalogRealtimeSubscription();
        syncCriticalStatuses();
    });
    window.addEventListener('online', () => {
        initCatalogRealtimeSubscription();
        syncCriticalStatuses();
    });
}

// Умное соответствие размеров (обувь и одежда)
function itemMatchesSizeFilter(itemOrSize, filterVal) {
    if (!itemOrSize || !filterVal) return false;
    let sizeStr = '';
    let category = '';
    if (typeof itemOrSize === 'object') {
        sizeStr = itemOrSize.size ? String(itemOrSize.size).trim() : '';
        category = itemOrSize.category ? String(itemOrSize.category).trim() : '';
    } else {
        sizeStr = String(itemOrSize).trim();
    }
    if (!sizeStr) return false;
    const upperSize = sizeStr.toUpperCase();
    const fVal = String(filterVal).trim().toUpperCase();

    // 1. Обувь (40 - 42) и Обувь (43 - 46)
    const isShoesFilter1 = (fVal === '42' || fVal === '40-42' || fVal === '40 - 42');
    const isShoesFilter2 = (fVal === '44' || fVal === '43-46' || fVal === '43 - 46');

    if (isShoesFilter1 || isShoesFilter2) {
        if (category && category !== 'Обувь') return false;

        if (isShoesFilter1) {
            if (upperSize.includes('40 - 42') || upperSize.includes('40-42')) return true;
            const numMatch = upperSize.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
                const n = Number.parseFloat(numMatch[1].replaceAll(',', '.'));
                if (n >= 35 && n <= 42.5) return true;
            }
            return false;
        }

        if (isShoesFilter2) {
            if (upperSize.includes('43 - 46') || upperSize.includes('43-46')) return true;
            const numMatch = upperSize.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
                const n = Number.parseFloat(numMatch[1].replaceAll(',', '.'));
                if (n >= 42.8 && n <= 50) return true;
            }
            return false;
        }
    }

    if (category === 'Обувь') {
        return false;
    }

    // 2. Размер S
    if (fVal === 'S') {
        return (upperSize === 'S' || upperSize === 'XS' || upperSize === 'С' ||
            upperSize.startsWith('S-') || upperSize.startsWith('S -') || 
            upperSize.startsWith('S/') || upperSize.startsWith('S ') || 
            upperSize.startsWith('S(') || upperSize.includes('(S)') ||
            upperSize.includes('S M L'));
    }

    // 3. Размер M
    if (fVal === 'M') {
        return (upperSize === 'M' || upperSize === 'М' || 
            upperSize.startsWith('M-') || upperSize.startsWith('M -') || 
            upperSize.startsWith('M/') || upperSize.startsWith('M ') || 
            upperSize.startsWith('M(') || upperSize.startsWith('М ') || 
            upperSize.startsWith('М(') || upperSize.includes('S M L'));
    }

    // 4. Размер L
    if (fVal === 'L') {
        if (upperSize.includes('XL') || upperSize.includes('ХЛ') || 
            upperSize.includes('XXL') || upperSize.includes('ХХЛ')) {
            return false;
        }
        return (upperSize === 'L' || upperSize === 'Л' || 
            upperSize.startsWith('L ') || upperSize.startsWith('L(') || 
            upperSize.startsWith('Л ') || upperSize.startsWith('Л(') ||
            upperSize.includes('S M L'));
    }

    // 5. Размер XL / XXL
    if (fVal === 'XL' || fVal === 'XL / XXL') {
        return (upperSize.includes('XL') || upperSize.includes('XXL') || 
            upperSize.includes('ХЛ') || upperSize.includes('ХХЛ') || 
            upperSize.includes('3XL') || upperSize.includes('XXXL'));
    }

    return upperSize === fVal;
}
window.itemMatchesSizeFilter = itemMatchesSizeFilter;

// Обновление красных счетчиков категорий и размеров в боковом меню
function updateSidebarCounters() {
    if (!window.allItems || window.allItems.length === 0) return;
    const curCat = window.currentCategory || '';
    const onlySale = document.getElementById('onlySaleCb') ? document.getElementById('onlySaleCb').checked : false;

    // Считаем доступные товары (с учетом скидки, если чекбокс активен)
    const availableItemsAll = window.allItems.filter(i => {
        if (!i || i.status !== 'available') return false;
        if (onlySale && !i.is_sale) return false;
        return true;
    });

    const catCounts = { 'Все вещи': availableItemsAll.length };
    if (typeof Object.groupBy === 'function') {
        const groups = Object.groupBy(availableItemsAll, item => item?.category || 'Без категории');
        for (const cat in groups) {
            catCounts[cat] = groups[cat] ? groups[cat].length : 0;
        }
    } else {
        availableItemsAll.forEach(item => {
            if (!item) return;
            const c = item.category || 'Без категории';
            catCounts[c] = (catCounts[c] || 0) + 1;
        });
    }

    // 1. Категории
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(link => {
        let baseText = link.innerHTML.split('<span')[0].trim();
        const onclickAttr = link.getAttribute('onclick') || '';
        
        let catName = 'Все вещи';
        const match = onclickAttr.match(/setCategoryFilter\s*\(\s*["']([^"']*)["']/);
        if (match && match[1]) {
            catName = match[1];
        } else if (onclickAttr.includes('""') || onclickAttr.includes("''")) {
            catName = 'Все вещи';
        } else {
            // Fallback по тексту
            if (baseText.includes('Все') || baseText.includes('Всі') || baseText.includes('All')) catName = 'Все вещи';
            else if (baseText.includes('Верхн')) catName = 'Верхняя одежда';
            else if (baseText.includes('Кофт') || baseText.includes('Светр')) catName = 'Кофты и Свитера';
            else if (baseText.includes('Штан') || baseText.includes('Джинс')) catName = 'Штаны и Джинсы';
            else if (baseText.includes('Обув') || baseText.includes('Взутт') || baseText.includes('Shoes')) catName = 'Обувь';
            else if (baseText.includes('Акс') || baseText.includes('Acc')) catName = 'Аксессуары';
        }

        const count = catCounts[catName] || 0;
        if (count > 0) {
            link.innerHTML = `${baseText} <span class="filter-count-badge">(${count})</span>`;
        } else {
            link.innerHTML = baseText;
        }

        link.classList.remove('active-filter');
        if (curCat !== '' && catName === curCat) {
            link.classList.add('active-filter');
        } else if (curCat === '' && catName === 'Все вещи') {
            link.classList.add('active-filter');
        }
    });

    // 2. Размеры (только для текущей категории)
    const availableCategoryItems = availableItemsAll.filter(item => {
        if (curCat !== '' && item.category !== curCat) return false;
        return true;
    });

    document.querySelectorAll('.size-cb').forEach(cb => {
        const labelSpan = cb.nextElementSibling;
        if (!labelSpan) return;
        let baseText = labelSpan.innerHTML.split('<span')[0].trim();
        const sizeVal = cb.value;
        const count = availableCategoryItems.filter(item => itemMatchesSizeFilter(item, sizeVal)).length;

        if (count > 0) {
            labelSpan.innerHTML = `${baseText} <span class="filter-count-badge">(${count})</span>`;
            cb.parentElement.style.opacity = '1';
            cb.disabled = false;
        } else {
            labelSpan.innerHTML = baseText;
            cb.parentElement.style.opacity = '0.4';
            cb.disabled = true;
            cb.checked = false;
        }
    });
}
window.updateSidebarCounters = updateSidebarCounters;

// Кэшированный инстанс Fuse.js для каталога (устраняет создание индекса на каждое нажатие клавиши)
let _catalogFuseCache = null;
let _catalogFuseItemsRef = null;

function getCatalogFuse(items) {
    if (!_catalogFuseCache || _catalogFuseItemsRef !== items) {
        _catalogFuseItemsRef = items;
        const fuseOptions = {
            includeScore: true, threshold: 0.4, ignoreLocation: true, useExtendedSearch: true, 
            keys: [{ name: 'tags', weight: 1.0 }, { name: 'brand', weight: 0.8 }, { name: 'name', weight: 0.8 }, { name: 'size', weight: 0.8 }, { name: 'category', weight: 0.2 }]
        };
        _catalogFuseCache = new Fuse(items, fuseOptions);
    }
    return _catalogFuseCache;
}
window.invalidateFuseCache = function() {
    _catalogFuseCache = null;
    _catalogFuseItemsRef = null;
    if (typeof window.invalidateLiveSearchFuse === 'function') window.invalidateLiveSearchFuse();
    if (window.searchWorker && typeof window.searchWorker.setItems === 'function' && Array.isArray(window.allItems)) {
        window.searchWorker.setItems(window.allItems);
    }
};

// Основная функция фильтрации каталога
function applyFilters(immediate = false, preserveViewport = false) {
    const grid = document.getElementById('itemsGrid');
    const isInitialRender = !window.renderedCount || window.renderedCount === 0;

    if (!immediate && !preserveViewport && !isInitialRender && grid) {
        grid.classList.add('fade-out');
    }

    clearTimeout(applyFiltersTimeout);
    const delay = (immediate || preserveViewport || isInitialRender) ? 0 : 160;

    if (typeof _resolveApplyFilters === 'function') {
        _resolveApplyFilters();
        _resolveApplyFilters = null;
    }
    return new Promise((resolve) => {
        _resolveApplyFilters = resolve;
        applyFiltersTimeout = setTimeout(async () => {
        try {
            const searchInput = document.getElementById('mainSearch');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const checkedSizes = Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => cb.value);
            const onlySale = document.getElementById('onlySaleCb') ? document.getElementById('onlySaleCb').checked : false;
            const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
            
            const minInput = document.getElementById('priceMin');
            const maxInput = document.getElementById('priceMax');
            const rawMin = minInput ? Number.parseInt(minInput.value, 10) : NaN;
            const minPrice = (Number.isFinite(rawMin) && rawMin >= 0) ? rawMin : 0;
            const rawMax = maxInput ? Number.parseInt(maxInput.value, 10) : NaN;
            const maxPrice = (Number.isFinite(rawMax) && rawMax > 0) ? rawMax : Infinity;

            const getSafePrice = (price) => Number.parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
            const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
            const favsSet = new Set(userFavs);
            const hacked = (typeof isHacked !== 'undefined') ? isHacked : (window.isHacked || false);
            const curCat = window.currentCategory || '';
            const curBrand = window.currentBrand || '';
            const onlyFavs = window.showingOnlyFavs || false;

            // 1. Фильтрация
            window.filteredItems = window.allItems.filter(item => {
                if (!item) return false;
                
                const isFav = favsSet.has(item.id);
                const matchesAvailability = (!hideUnavailable && (searchTerm === '' || item.status !== 'sold')) || item.status === 'available';
                const matchesSale = !onlySale || !!item.is_sale;
                
                if (onlyFavs) {
                    return isFav && matchesAvailability && matchesSale;
                }

                const itemCategory = item.category || '';
                const itemBrand = item.brand ? item.brand.toLowerCase() : '';
                const searchBrand = curBrand ? curBrand.toLowerCase() : '';
                
                const matchesCategory = curCat === '' || itemCategory === curCat;
                const matchesBrand = searchBrand === '' || itemBrand.includes(searchBrand);
                const matchesSize = checkedSizes.length === 0 || checkedSizes.some(sz => itemMatchesSizeFilter(item, sz));
                
                const itemFinalPrice = hacked ? Math.floor(getSafePrice(item.price) * 0.9) : getSafePrice(item.price);
                const matchesPrice = itemFinalPrice >= minPrice && itemFinalPrice <= maxPrice;
                
                return matchesCategory && matchesBrand && matchesSize && matchesPrice && matchesAvailability && matchesSale;
            });

            // 2. Умный поиск (Web Worker Fuse.js с поддержкой транслитерации и надежный fallback)
            if (searchTerm !== '') {
                const cleanSearchTerm = searchTerm.replaceAll('#', '').trim();
                if (cleanSearchTerm) {
                    if (window.searchWorker && window.searchWorker.isReady()) {
                        const candidateIds = window.filteredItems.map(i => i.id);
                        const matchedIds = await window.searchWorker.searchCatalog(cleanSearchTerm, candidateIds);
                        const itemMap = new Map(window.filteredItems.map(i => [i.id, i]));
                        window.filteredItems = matchedIds.map(id => itemMap.get(id)).filter(Boolean);
                    } else {
                        const queryVariants = (typeof expandSearchQuery === 'function')
                            ? expandSearchQuery(cleanSearchTerm)
                            : [cleanSearchTerm.toLowerCase()];

                        if (typeof Fuse !== 'undefined') {
                            const fuse = getCatalogFuse(window.filteredItems);
                            const matchedIds = new Set();
                            const finalResults = [];

                            for (const variant of queryVariants) {
                                const found = fuse.search(variant);
                                found.forEach(res => {
                                    if (res.item && res.item.status === 'sold') return;
                                    if (!matchedIds.has(res.item.id)) {
                                        matchedIds.add(res.item.id);
                                        finalResults.push(res.item);
                                    }
                                });
                            }
                            window.filteredItems = finalResults;
                        } else {
                            window.filteredItems = window.filteredItems.filter(item => {
                                if (item.status === 'sold') return false;
                                const name = (item.name || '').toLowerCase();
                                const brand = (item.brand || '').toLowerCase();
                                const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : (item.tags || '').toLowerCase();
                                return queryVariants.some(q => name.includes(q) || brand.includes(q) || tags.includes(q));
                            });
                        }
                    }
                }
            }

            // 3. Сортировка
            const now = Date.now();
            const isItemTop = (item) => item.is_top === true && item.top_until && new Date(item.top_until).getTime() > now;
            const sortCheap = document.getElementById('sort-cheap');

            if (sortCheap && sortCheap.classList.contains('active-sort')) {
                const sortCheapFn = (a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return getSafePrice(a.price) - getSafePrice(b.price);
                };
                window.filteredItems = (typeof window.toSorted === 'function')
                    ? window.toSorted(window.filteredItems, sortCheapFn)
                    : (window.filteredItems.toSorted ? window.filteredItems.toSorted(sortCheapFn) : [...window.filteredItems].sort(sortCheapFn));
            } else {
                const sortDateFn = (a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                };
                window.filteredItems = (typeof window.toSorted === 'function')
                    ? window.toSorted(window.filteredItems, sortDateFn)
                    : (window.filteredItems.toSorted ? window.filteredItems.toSorted(sortDateFn) : [...window.filteredItems].sort(sortDateFn));
            }
            
            // СБРОС И РЕНДЕР (при preserveViewport сохраняем текущую страницу на ПК и число карточек на моб)
            const prevRenderedCount = window.renderedCount || 0;
            const prevPage = window.currentPage || 1;
            const batchSizeNow = window.innerWidth <= 900 ? 12 : 15;
            const maxPageNow = Math.max(1, Math.ceil(window.filteredItems.length / batchSizeNow));

            if (grid) {
                if (typeof grid.replaceChildren === 'function') grid.replaceChildren();
                else grid.innerHTML = '';
            }
            window.renderedCount = 0; 
            window.currentPage = preserveViewport ? Math.min(prevPage, maxPageNow) : 1; 
            
            const scrollTrigger = document.getElementById('loadingTrigger');
            if (scrollTrigger && window.innerWidth <= 900) {
                scrollTrigger.style.display = 'block';
                if (typeof scrollTrigger.replaceChildren === 'function') scrollTrigger.replaceChildren();
                else scrollTrigger.innerHTML = '';
            }
            
            const countEl = document.getElementById('itemCount');
            if (countEl) {
                countEl.innerText = window.filteredItems.length;
            }

            if (window.filteredItems.length === 0) {
                const noItemsMsg = typeof i18next !== 'undefined' ? i18next.t('search.no_items', { defaultValue: 'ТОВАРОВ НЕ НАЙДЕНО' }) : 'ТОВАРОВ НЕ НАЙДЕНО';
    if (grid) grid.innerHTML = `<div style="color: #666; font-family: monospace; padding: 30px; grid-column: 1/-1; text-align:center;">[ ${noItemsMsg} ]</div>`;
            } else {
                const targetMobileCount = preserveViewport ? Math.max(prevRenderedCount, batchSizeNow) : 0;
                renderNextBatch(targetMobileCount); 
            }

            // Обновляем URL параметры
            const url = new URL(window.location);
            if (curCat) url.searchParams.set('cat', curCat); else url.searchParams.delete('cat');
            if (searchTerm) url.searchParams.set('q', searchTerm); else url.searchParams.delete('q');
            if (onlySale) url.searchParams.set('sale', '1'); else url.searchParams.delete('sale');
            window.history.replaceState(null, '', url);

            // Подсветка активной категории
            const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
            catLinks.forEach(el => el.classList.remove('active-filter'));
            
            if (curCat) {
                catLinks.forEach(link => {
                    const onclickText = link.getAttribute('onclick') || '';
                    if (onclickText.includes(`'${curCat}'`)) {
                        link.classList.add('active-filter');
                    }
                });
            } else {
                const firstLink = document.querySelector('.sidebar .filter-list:first-of-type a');
                if (firstLink) firstLink.classList.add('active-filter');
            }

            updateSidebarCounters();
            
            if (grid) {
                requestAnimationFrame(() => {
                    setTimeout(() => grid.classList.remove('fade-out'), 50);
                });
            }
        } catch (err) {
            console.error("ОШИБКА ФИЛЬТРАЦИИ:", err);
            if (grid) {
                const safeRenderErr = typeof window.escapeHtml === 'function' ? window.escapeHtml(err.message) : err.message;
                grid.innerHTML = `<div style="color:red; grid-column:1/-1; padding:20px; text-align:center;">[ ОШИБКА РЕНДЕРА: ${safeRenderErr} ]</div>`;
                grid.classList.remove('fade-out');
            }
        } finally {
            if (_resolveApplyFilters === resolve) {
                _resolveApplyFilters = null;
            }
            resolve();
        }
    }, delay);
}); 
}
window.applyFilters = applyFilters;

// Автоматическая перерисовка каталога при смене режима экрана (ПК ↔ мобильный, брейкпоинт 900px).
// Без этого, если окно в момент первой отрисовки было "узким" (например, при открытии/закрытии F12 или
// очистке кэша), на ПК оставалось 12 карточек без пагинации до ручной перезагрузки.
(function initCatalogBreakpointWatcher() {
    let resizeTimer = null;
    const checkBreakpoint = () => {
        const nowMobile = window.innerWidth <= 900;
        if (window._catalogRenderedAsMobile === undefined || window._catalogRenderedAsMobile === nowMobile) return;
        if (!Array.isArray(window.filteredItems) || window.filteredItems.length === 0) return;

        const trigger = document.getElementById('loadingTrigger');
        if (trigger) trigger.style.display = nowMobile ? 'block' : 'none';
        applyFilters(true, false);
    };
    const scheduleCheck = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(checkBreakpoint, 150);
    };
    window.addEventListener('resize', scheduleCheck, { passive: true });
    window.addEventListener('orientationchange', scheduleCheck, { passive: true });
    if (typeof window.matchMedia === 'function') {
        try {
            const mq = window.matchMedia('(max-width: 900px)');
            if (typeof mq.addEventListener === 'function') mq.addEventListener('change', scheduleCheck);
        } catch (e) {}
    }
})();

// Умный плеер для видео в сетке (IntersectionObserver с поддержкой Network Information API)
const gridVideoObserver = new IntersectionObserver((entries) => {
    const conn = (typeof navigator !== 'undefined') ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection) : null;
    const isSaveData = Boolean(conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'));

    entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting && !document.hidden && !isSaveData) {
            video.play().catch(() => {}); 
        } else {
            video.pause(); 
        }
    });
}, { rootMargin: "50px" });
window.gridVideoObserver = gridVideoObserver;

// Пауза видео при переключении вкладки браузера
document.addEventListener('visibilitychange', () => {
    const videos = document.querySelectorAll('video');
    if (document.hidden) {
        videos.forEach(v => {
            if (!v.paused) {
                v._wasPlaying = true;
                v.pause();
            }
        });
    } else {
        videos.forEach(v => {
            if (v._wasPlaying) {
                delete v._wasPlaying;
                if (v.classList.contains('modal-video-player')) {
                    const modal = document.getElementById('productModal');
                    if (modal && modal.style.display !== 'none') {
                        const slide = v.closest('.slide');
                        const slides = Array.from(document.querySelectorAll('#sliderWrapper .slide'));
                        if (slides.indexOf(slide) === window.currentSlide) {
                            v.play().catch(() => {});
                        }
                    }
                } else {
                    const rect = v.getBoundingClientRect();
                    if (rect.top < window.innerHeight + 50 && rect.bottom > -50) {
                        v.play().catch(() => {});
                    }
                }
            }
        });
    }
});

// Пагинация на ПК
window.changePage = function(step) {
    window.currentPage += step;
    const grid = document.getElementById('itemsGrid');
    
    if (grid) {
        grid.classList.add('fade-out');
    }

    clearTimeout(changePageTimeout);
    changePageTimeout = setTimeout(() => {
        renderNextBatch(); 
        
        const sortingEl = document.querySelector('.sorting');
        if (sortingEl) {
            const y = sortingEl.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
        
        if (grid) {
            requestAnimationFrame(() => {
                grid.classList.remove('fade-out');
            });
        }
    }, 300);
};

// Мгновенная активация скрытых слайдов карточки при первом взаимодействии (свайп/наведение/стрелки)
function activateCardSlides(target) {
    if (!target) return;
    const wrapper = (target.classList && target.classList.contains('card-slider-wrapper'))
        ? target
        : (target.closest && target.closest('.card-slider-wrapper')) || (target.querySelector && target.querySelector('.card-slider-wrapper'));
    if (!wrapper || wrapper._slidesActivated) return;
    wrapper._slidesActivated = true;
    const lazyImgs = wrapper.querySelectorAll('img[data-src]');
    for (let i = 0; i < lazyImgs.length; i++) {
        const img = lazyImgs[i];
        const src = img.getAttribute('data-src');
        if (src) {
            if (img.parentElement && !img.parentElement.classList.contains('img-8bit-loaded')) {
                img.parentElement.classList.add('img-8bit-loading');
            }
            img.src = src;
            img.removeAttribute('data-src');
            if (img.complete && img.naturalWidth > 0) {
                img.style.opacity = '1';
                if (img.parentElement) {
                    img.parentElement.classList.remove('img-8bit-loading');
                    img.parentElement.classList.add('img-8bit-loaded');
                }
            }
        }
    }
}
window.activateCardSlides = activateCardSlides;

// Единое делегирование событий для всей сетки каталога (вместо сотен слушателей на карточках)
let _gridDelegationInitialized = false;
function initGridEventDelegation() {
    const grid = document.getElementById('itemsGrid');
    if (!grid || _gridDelegationInitialized) return;
    _gridDelegationInitialized = true;

    // 1. Тултип замеров и предзагрузка картинок на десктопе
    let currentTooltipCard = null;

    grid.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.item-card');
        if (!card) return;
        activateCardSlides(card);

        if (card !== currentTooltipCard) {
            currentTooltipCard = card;
            const id = card.getAttribute('data-id');
            if (id && typeof window.prefetchItemImages === 'function') window.prefetchItemImages(id);
        }

        const isCartBtn = !!(e.target && typeof e.target.closest === 'function' && e.target.closest('.grid-cart-btn, [data-action="add-to-cart"]'));
        if (isCartBtn) {
            if (typeof window.hideItemMeasurementsTooltip === 'function') {
                window.hideItemMeasurementsTooltip();
            }
            return;
        }

        // Если не над кнопкой корзины и плашка скрыта (например, вернулись с кнопки корзины на карточку)
        if (!_isTooltipVisible && typeof window.showItemMeasurementsTooltip === 'function') {
            const id = card.getAttribute('data-id');
            const item = window.allItems && window.allItems.find(i => String(i.id) === String(id));
            if (item) {
                window.showItemMeasurementsTooltip(item, e);
            }
        }
    });

    grid.addEventListener('mousemove', (e) => {
        if (!currentTooltipCard) return;
        const isCartBtn = !!(e.target && typeof e.target.closest === 'function' && e.target.closest('.grid-cart-btn, [data-action="add-to-cart"]'));
        if (isCartBtn) {
            if (_isTooltipVisible && typeof window.hideItemMeasurementsTooltip === 'function') {
                window.hideItemMeasurementsTooltip();
            }
            return;
        }

        // Если курсор вернулся с кнопки корзины на карточку товара
        if (!_isTooltipVisible && typeof window.showItemMeasurementsTooltip === 'function') {
            const id = currentTooltipCard.getAttribute('data-id');
            const item = window.allItems && window.allItems.find(i => String(i.id) === String(id));
            if (item) {
                window.showItemMeasurementsTooltip(item, e);
            }
        }

        if (typeof window.moveItemMeasurementsTooltip === 'function') {
            window.moveItemMeasurementsTooltip(e);
        }
    });

    grid.addEventListener('mouseout', (e) => {
        if (!currentTooltipCard) return;
        if (!e.relatedTarget || !currentTooltipCard.contains(e.relatedTarget)) {
            const leavingId = currentTooltipCard.getAttribute('data-id');
            if (leavingId && typeof window.cancelPrefetchItemImages === 'function') {
                window.cancelPrefetchItemImages(leavingId);
            }
            currentTooltipCard = null;
            if (typeof window.hideItemMeasurementsTooltip === 'function') {
                window.hideItemMeasurementsTooltip();
            }
        }
    });

    grid.addEventListener('click', () => {
        if (typeof window.hideItemMeasurementsTooltip === 'function') {
            window.hideItemMeasurementsTooltip();
        }
    });

    // 2. Свайп и дабл-тап лайк на слайдере карточки
    let isDraggingSlider = false;
    let startX = 0;
    let startY = 0;
    let clickTimer = null;
    let lastClickedWrapper = null;

    grid.addEventListener('touchstart', (e) => {
        const wrapper = e.target.closest('.card-slider-wrapper');
        if (!wrapper) return;
        activateCardSlides(wrapper);
        isDraggingSlider = false;
        if (e.touches && e.touches[0]) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }
    }, { passive: true });

    grid.addEventListener('touchend', (e) => {
        const wrapper = e.target.closest('.card-slider-wrapper');
        if (!wrapper) return;
        if (e.changedTouches && e.changedTouches[0]) {
            const dx = Math.abs(e.changedTouches[0].clientX - startX);
            const dy = Math.abs(e.changedTouches[0].clientY - startY);
            if (dx > 10 || dy > 10) isDraggingSlider = true;
        }
    }, { passive: true });

    grid.addEventListener('click', (e) => {
        const wrapper = e.target.closest('.card-slider-wrapper');
        if (!wrapper) return;
        if (e.target.closest('.grid-slider-btn') || e.target.closest('.card-dots-container')) return;
        if (isDraggingSlider) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const card = wrapper.closest('.item-card');
        const itemId = card ? card.getAttribute('data-id') : null;
        if (!itemId) return;

        if (clickTimer === null || lastClickedWrapper !== wrapper) {
            if (clickTimer) clearTimeout(clickTimer);
            lastClickedWrapper = wrapper;
            clickTimer = setTimeout(() => {
                clickTimer = null;
                lastClickedWrapper = null;
                if (typeof openProductModalById === 'function') openProductModalById(itemId);
            }, 180);
        } else {
            clearTimeout(clickTimer);
            clickTimer = null;
            lastClickedWrapper = null;
            handleDoubleTapLike(e, itemId, wrapper);
        }
    });
}

// Построение DOM-элемента карточки товара
function buildCardDOM(item, idx = 0) {
    if (!item || !item.id) return null;
    const itemIdStr = String(item.id);
    const nowTs = Date.now();
    const curr = (typeof getCurrency === 'function') ? getCurrency() : 'грн';
    const sizePrefix = (typeof i18next !== 'undefined') ? i18next.t('grid.size_prefix', { defaultValue: 'Размер: ' }) : 'Размер: ';
    const addToCartText = (typeof i18next !== 'undefined') ? i18next.t('product.add_to_cart', { defaultValue: 'В КОРЗИНУ' }) : 'В КОРЗИНУ';

    if (!window._seenItemsSet) {
        try {
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            const parsedSeen = store ? store.getJSON('nisha_seen_items', []) : [];
            window._seenItemsSet = new Set(Array.isArray(parsedSeen) ? parsedSeen.map(String) : []);
        } catch (e) {
            window._seenItemsSet = new Set();
        }
    }
    const seenSet = window._seenItemsSet;
    const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
    const favSet = new Set(Array.isArray(userFavs) ? userFavs.map(String) : []);

    let badgeHTML = '';
    if (item.status === 'sold') {
        badgeHTML = '<div class="sold-badge">SOLD</div>';
    } else if (item.status === 'reserved') {
        badgeHTML = '<div class="reserved-badge">RESERVED</div>';
    } else {
        const hasSale = item.is_sale;
        const hasHot = (item.views_count || 0) >= 25;
        const isTop = item.is_top === true && item.top_until && new Date(item.top_until).getTime() > nowTs;

        if (hasSale || hasHot || isTop) {
            badgeHTML = `<div class="system-status-bar">`;
            if (isTop) {
                badgeHTML += `<span class="status-item status-top"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> TOP</span>`;
            }
            if (isTop && (hasSale || hasHot)) badgeHTML += `<div class="status-divider"></div>`;
            if (hasSale) badgeHTML += `<span class="status-item status-sale">% SALE</span>`;
            if (hasSale && hasHot) badgeHTML += `<div class="status-divider"></div>`;
            if (hasHot) {
                const chartSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
                badgeHTML += `<span class="status-item status-hot">${chartSvg} HOT</span>`;
            }
            badgeHTML += `</div>`;
        }
    }

    const thumbsArray = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails : (item.images && item.images.length > 0 ? item.images : []);
    let slidesStr = '';
    let dotsStr = '';

    const safeBrand = (item.brand || '').trim();
    const safeName = (item.name || '').trim();
    const baseAlt = [safeBrand, safeName].filter(Boolean).join(' ') || 'Винтажная одежда NISHA';
    const cleanAlt = baseAlt.replaceAll('"', '&quot;');

    thumbsArray.forEach((thumbUrl, thumbIdx) => {
        const rawVidUrl = item.images && item.images[thumbIdx] ? item.images[thumbIdx] : '';
        const isVid = typeof rawVidUrl === 'string' && rawVidUrl.endsWith('.mp4');
        const cdnThumb = (typeof window.toCDN === 'function') ? window.toCDN(thumbUrl) : thumbUrl;
        const cdnVidUrl = (typeof window.toCDN === 'function') ? window.toCDN(rawVidUrl) : rawVidUrl;
        const slideAlt = cleanAlt + (thumbIdx > 0 ? ` - фото ${thumbIdx + 1}` : '');

        if (isVid) {
            slidesStr += `
                <div class="card-slide ${thumbIdx === 0 ? 'img-8bit-loading' : ''}" style="background: #0a0a0a;">
                    <video class="grid-lazy-video" src="${cdnVidUrl}#t=0.001" muted loop playsinline preload="none" style="width:100%; height:100%; object-fit:cover; pointer-events:none; opacity:0;"></video>
                </div>`;
        } else if (thumbIdx === 0) {
            const firstLoadAttr = (idx < 2) ? 'fetchpriority="high"' : 'loading="lazy"';
            slidesStr += `
                <div class="card-slide img-8bit-loading">
                   <img class="card-slide-img" src="${cdnThumb}" data-fallback-src="${cdnVidUrl || ''}" ${firstLoadAttr} decoding="async" alt="${slideAlt}" style="width:100%; height:100%; object-fit:cover; display:block; opacity:0; transition:opacity 0.2s ease; pointer-events:none;">
                </div>`;
        } else {
            slidesStr += `
                <div class="card-slide">
                   <img class="card-slide-img" data-src="${cdnThumb}" data-fallback-src="${cdnVidUrl || ''}" loading="lazy" decoding="async" alt="${slideAlt}" style="width:100%; height:100%; object-fit:cover; display:block; opacity:0; transition:opacity 0.2s ease; pointer-events:none;">
                </div>`;
        }
        dotsStr += `<div class="card-dot ${thumbIdx === 0 ? 'active' : ''}"></div>`;
    });

    const starClass = favSet.has(itemIdStr) ? 'fav-star active' : 'fav-star';
    const isUnseen = !seenSet.has(itemIdStr) && item.status === 'available';
    const pulseClass = isUnseen ? 'unseen-pulse' : '';
    const statusClass = item.status === 'sold' ? 'sold-out' : (item.status === 'reserved' ? 'reserved-item' : '');

    const card = document.createElement('div');
    card.className = ['item-card', statusClass, pulseClass].filter(Boolean).join(' ');
    card.setAttribute('data-id', item.id);

    let priceHTML = '';
    const formattedPrice = (typeof window.formatPrice === 'function') ? window.formatPrice(item.price) : `${item.price} ${curr}`;
    if (item.is_sale && item.old_price) {
        const formattedOldPrice = (typeof window.formatPrice === 'function') ? window.formatPrice(item.old_price) : `${item.old_price} ${curr}`;
        priceHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 14px; margin-right: 8px;">${formattedOldPrice}</span><span style="color: var(--accent-green);">${formattedPrice}</span>`;
    } else {
        priceHTML = `<span style="color: var(--accent-green);">${formattedPrice}</span>`;
    }

    let controlsHTML = '';
    if (thumbsArray.length > 1) {
        controlsHTML = `
            <div class="grid-slider-btn prev" role="button" aria-label="Предыдущее фото" data-action="scroll-grid-slider" data-hover-action="preload-grid-slide" data-id="${typeof window.escapeAttr === 'function' ? window.escapeAttr(item.id) : item.id}" data-dir="-1">&#10094;</div>
            <div class="grid-slider-btn next" role="button" aria-label="Следующее фото" data-action="scroll-grid-slider" data-hover-action="preload-grid-slide" data-id="${typeof window.escapeAttr === 'function' ? window.escapeAttr(item.id) : item.id}" data-dir="1">&#10095;</div>
            <div class="card-dots-container" id="dots-${item.id}">${dotsStr}</div>
        `;
    }

    card.innerHTML = `
        ${badgeHTML}
        <div class="${starClass}" role="button" aria-label="В избранное" data-action="toggle-fav" data-id="${typeof window.escapeAttr === 'function' ? window.escapeAttr(item.id) : item.id}">★</div>
        <div class="card-slider-wrapper">
            <div class="card-slider-container" id="slider-${item.id}" data-item-id="${typeof window.escapeAttr === 'function' ? window.escapeAttr(item.id) : item.id}">
                ${slidesStr}
            </div>
            ${controlsHTML}
        </div>
        <div class="item-info" data-action="open-product" data-id="${typeof window.escapeAttr === 'function' ? window.escapeAttr(item.id) : item.id}">
            <h3 class="item-title">${typeof window.escapeHtml === 'function' ? window.escapeHtml(item.name || '') : item.name}</h3>
            <div class="item-price">${priceHTML}</div>
            <div class="item-size"><span data-i18n="grid.size_prefix">${sizePrefix}</span>${typeof window.escapeHtml === 'function' ? window.escapeHtml(item.size || '') : item.size}</div>
            <div class="item-footer"><span>${typeof window.escapeHtml === 'function' ? window.escapeHtml(item.brand || '') : item.brand}</span><span>${typeof window.escapeHtml === 'function' ? window.escapeHtml(item.condition || '') : item.condition}</span></div>
        </div>
        <button class="grid-cart-btn" data-i18n="product.add_to_cart" style="${item.status === 'sold' ? 'display:none;' : ''}" data-action="add-to-cart" data-id="${typeof window.escapeAttr === 'function' ? window.escapeAttr(item.id) : item.id}">${addToCartText}</button>
    `;

    return card;
}
window.buildCardDOM = buildCardDOM;

// Единый компаратор витрины (TOP-закрепленные всегда выше, далее активная сортировка: дата или цена)
function getCatalogItemComparator() {
    const nowTs = Date.now();
    const isTopNow = (it) => !!(it && it.is_top === true && it.top_until && new Date(it.top_until).getTime() > nowTs);
    const sortCheapEl = document.getElementById('sort-cheap');
    const byCheap = !!(sortCheapEl && sortCheapEl.classList.contains('active-sort'));
    const safePrice = (p) => Number.parseInt(String(p).replace(/[^\d]/g, ''), 10) || 0;
    return (a, b) => {
        const topA = isTopNow(a);
        const topB = isTopNow(b);
        if (topA && !topB) return -1;
        if (!topA && topB) return 1;
        if (byCheap) return safePrice(a.price) - safePrice(b.price);
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    };
}
window.getCatalogItemComparator = getCatalogItemComparator;

// Плавное добавление новой карточки в витрину (на правильное место с учетом закрепленных TOP-товаров)
function insertNewItemCardSmoothly(item) {
    if (!item || !item.id) return;
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;

    if (grid.querySelector(`.item-card[data-id="${item.id}"]`)) return;

    const curCat = window.currentCategory || '';
    const curBrand = window.currentBrand || '';
    const searchInput = document.getElementById('mainSearch');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const onlySale = document.getElementById('onlySaleCb')?.checked || false;
    const hideUnavailable = document.getElementById('hideUnavailableCb')?.checked || false;

    if (curCat && item.category !== curCat) return;
    if (curBrand && (!item.brand || !item.brand.toLowerCase().includes(curBrand.toLowerCase()))) return;
    if (onlySale && !item.is_sale) return;
    if (hideUnavailable && item.status !== 'available') return;
    if (searchTerm) {
        const nameMatch = item.name && item.name.toLowerCase().includes(searchTerm);
        const brandMatch = item.brand && item.brand.toLowerCase().includes(searchTerm);
        if (!nameMatch && !brandMatch) return;
    }

    const emptyPlaceholder = grid.querySelector('div[style*="grid-column: 1/-1"]');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    if (!Array.isArray(window.filteredItems)) window.filteredItems = [];
    const list = window.filteredItems;
    if (list.some(i => i && String(i.id) === String(item.id))) return;

    // Находим ПРАВИЛЬНУЮ позицию новинки по той же сортировке, что и в applyFilters:
    // закрепленные (TOP) товары всегда остаются выше обычных, новинка встает сразу под ними.
    const cmp = getCatalogItemComparator();
    let insertIdx = list.findIndex(existing => cmp(item, existing) < 0);
    if (insertIdx === -1) insertIdx = list.length;
    const prevLen = list.length;
    list.splice(insertIdx, 0, item);

    const isMobileView = window.innerWidth <= 900;

    // ПК (постраничная навигация): перерисовываем текущую страницу только если новинка влияет на нее или на число страниц
    if (!isMobileView) {
        const pageSize = 15;
        const pageEnd = (window.currentPage || 1) * pageSize;
        const totalBefore = Math.max(1, Math.ceil(prevLen / pageSize));
        const totalAfter = Math.max(1, Math.ceil(list.length / pageSize));
        if (insertIdx < pageEnd || totalBefore !== totalAfter) {
            renderNextBatch();
            const renderedNew = grid.querySelector(`.item-card[data-id="${item.id}"]`);
            if (renderedNew) renderedNew.classList.add('item-card-new-arrival');
        }
        const countElDesktop = document.getElementById('itemCount');
        if (countElDesktop) countElDesktop.innerText = list.length;
        return;
    }

    // Моб. (бесконечная лента): если карточка попадает в уже отрисованную часть — вставляем ее на нужное место,
    // иначе она сама подгрузится при прокрутке
    const alreadyRenderedAll = (window.renderedCount || 0) >= prevLen;
    if (!(insertIdx < (window.renderedCount || 0) || alreadyRenderedAll)) {
        const countElMobile = document.getElementById('itemCount');
        if (countElMobile) countElMobile.innerText = list.length;
        return;
    }

    const card = buildCardDOM(item, 0);
    if (card) {
        card.classList.add('item-card-new-arrival');
        const renderedCards = grid.querySelectorAll(':scope > .item-card');
        const refCard = renderedCards[insertIdx];
        if (refCard) {
            grid.insertBefore(card, refCard);
        } else {
            grid.appendChild(card);
        }
        window.renderedCount = (window.renderedCount || 0) + 1;

        const vids = card.querySelectorAll('.grid-lazy-video');
        vids.forEach(v => {
            if (typeof gridVideoObserver !== 'undefined' && gridVideoObserver) {
                gridVideoObserver.observe(v);
            }
        });

        const img = card.querySelector('img.card-slide-img');
        if (img) {
            if (img.complete && img.naturalWidth > 0) {
                img.style.opacity = '1';
                if (img.parentElement) {
                    img.parentElement.classList.remove('img-8bit-loading');
                    img.parentElement.classList.add('img-8bit-loaded');
                }
            } else {
                img.onload = () => {
                    img.style.opacity = '1';
                    if (img.parentElement) {
                        img.parentElement.classList.remove('img-8bit-loading');
                        img.parentElement.classList.add('img-8bit-loaded');
                    }
                };
            }
        }
    }

    const countEl = document.getElementById('itemCount');
    if (countEl && Array.isArray(window.filteredItems)) {
        countEl.innerText = window.filteredItems.length;
    }
}
window.insertNewItemCardSmoothly = insertNewItemCardSmoothly;

// Рендер следующей пачки товаров
function renderNextBatch(targetMobileCount = 0) {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;
    initGridEventDelegation();
    
    const isMobile = window.innerWidth <= 900;
    window._catalogRenderedAsMobile = isMobile;
    
    let oldPagination = document.getElementById('mainPagination');
    if (oldPagination) oldPagination.remove();

    let startIndex = 0;
    let endIndex = 0;
    const BATCH_SIZE = isMobile ? 12 : 15;
    itemsPageSize = BATCH_SIZE;

    // Защита от выхода за границы страниц на ПК (например, после удаления товаров или смены режима экрана)
    if (!isMobile) {
        const totalPagesGuard = Math.max(1, Math.ceil(window.filteredItems.length / BATCH_SIZE));
        if (!window.currentPage || window.currentPage < 1) window.currentPage = 1;
        if (window.currentPage > totalPagesGuard) window.currentPage = totalPagesGuard;
    }

    if (isMobile) {
        if (window.renderedCount === 0) {
            if (gridVideoObserver) gridVideoObserver.disconnect();
            if (typeof grid.replaceChildren === 'function') grid.replaceChildren();
            else grid.innerHTML = '';
        }
        startIndex = window.renderedCount;
        const batchLen = (startIndex === 0 && targetMobileCount > BATCH_SIZE) ? targetMobileCount : BATCH_SIZE;
        endIndex = Math.min(startIndex + batchLen, window.filteredItems.length); 
    } else {
        if (gridVideoObserver) gridVideoObserver.disconnect();
        if (typeof grid.replaceChildren === 'function') grid.replaceChildren();
        else grid.innerHTML = '';
        startIndex = (window.currentPage - 1) * BATCH_SIZE; 
        endIndex = Math.min(startIndex + BATCH_SIZE, window.filteredItems.length);
    }
    
    if (startIndex >= endIndex) return;
    
    if (!window._seenItemsSet) {
        try {
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            const parsedSeen = store ? store.getJSON('nisha_seen_items', []) : [];
            window._seenItemsSet = new Set(Array.isArray(parsedSeen) ? parsedSeen.map(String) : []);
        } catch (e) {
            window._seenItemsSet = new Set();
        }
    }
    // Note: card properties (seenSet, favSet, curr, etc.) are computed in buildCardDOM

    const fragment = document.createDocumentFragment();
    const newVideoElements = [];

    for (let i = startIndex; i < endIndex; i++) {
        try {
            const item = window.filteredItems[i];
            if (!item) continue;
            const card = buildCardDOM(item, i - startIndex);
            if (card) {
                fragment.appendChild(card);
                const vids = card.querySelectorAll('.grid-lazy-video');
                vids.forEach(v => newVideoElements.push(v));
            }
        } catch (err) { console.error(err); }
    }

    grid.appendChild(fragment);
    grid.querySelectorAll('img.card-slide-img').forEach(img => {
        if (img.complete && img.naturalWidth > 0 && img.style.opacity !== '1') {
            img.style.opacity = '1';
            if (img.parentElement) {
                img.parentElement.classList.remove('img-8bit-loading');
                img.parentElement.classList.add('img-8bit-loaded');
            }
        }
    });
    newVideoElements.forEach(v => gridVideoObserver.observe(v));

    if (isMobile) {
        window.renderedCount = endIndex;
        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) {
            if (window.renderedCount >= window.filteredItems.length) {
                scrollTrigger.style.display = 'none';
            } else {
                if (typeof scrollTrigger.replaceChildren === 'function') scrollTrigger.replaceChildren();
                else scrollTrigger.innerHTML = '';
            }
        }
    } else {
        window.renderedCount = window.filteredItems.length; 
        
        const totalPages = Math.ceil(window.filteredItems.length / itemsPageSize);
        if (totalPages >= 1) {
            const paginationWrap = document.createElement('div');
            paginationWrap.id = 'mainPagination';
            paginationWrap.className = 'pagination-wrapper';
            paginationWrap.style.position = 'relative';
            paginationWrap.style.width = '100%';
            paginationWrap.style.marginTop = '40px';
            paginationWrap.style.display = 'flex';
            paginationWrap.style.justifyContent = 'center';
            paginationWrap.style.gridColumn = '1 / -1'; 
            
            const prevDisabled = window.currentPage === 1 ? 'disabled' : '';
            const nextDisabled = window.currentPage === totalPages ? 'disabled' : '';
            const pageText = (typeof i18next !== 'undefined' && i18next.t('pagination.page', { defaultValue: 'СТРАНИЦА' })) || 'СТРАНИЦА';
            const ofText = (typeof i18next !== 'undefined' && i18next.t('pagination.of', { defaultValue: 'ИЗ' })) || 'ИЗ';

            paginationWrap.innerHTML = `
                <button class="page-arrow" data-action="change-page" data-dir="-1" ${prevDisabled}>&#10094;</button>
                <div class="page-numbers">[ <span data-i18n="pagination.page">${pageText}</span> <span style="color:var(--accent-green); font-weight:bold;">${window.currentPage}</span> <span data-i18n="pagination.of">${ofText}</span> ${totalPages} ]</div>
                <button class="page-arrow" data-action="change-page" data-dir="1" ${nextDisabled}>&#10095;</button>
            `;
            
            grid.style.paddingBottom = '0px';
            grid.appendChild(paginationWrap);
        }
    }
}
window.renderNextBatch = renderNextBatch;

// Сортировка товаров
function sortItems(type) {
    const sortNew = document.getElementById('sort-new');
    const sortCheap = document.getElementById('sort-cheap');
    if (sortNew) sortNew.classList.remove('active-sort');
    if (sortCheap) sortCheap.classList.remove('active-sort');
    
    const targetSort = document.getElementById('sort-' + type);
    if (targetSort) targetSort.classList.add('active-sort');
    
    const countEl = document.getElementById('itemCount');
    if (countEl) {
        countEl.style.transition = '0.3s';
        countEl.style.opacity = '0.2';
        countEl.style.color = 'var(--accent-yellow)';
        setTimeout(() => { 
            countEl.style.opacity = '1'; 
            countEl.style.color = 'var(--accent-green)';
        }, 300);
    }
    
    applyFilters();
    
    setTimeout(() => {
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            const y = grid.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, 100);
}
window.sortItems = sortItems;

// Установка фильтра категории
function setCategoryFilter(cat, element) { 
    const updateDom = async () => {
        document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(el => el.classList.remove('active-filter'));
        if (element) {
            element.classList.add('active-filter');
        }
        window.currentCategory = cat; 
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        if (store && store.session) store.session.set('nisha_last_category', cat);
        else { try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('nisha_last_category', cat); } catch (e) {} }
        await applyFilters(true, false); 
    };

    if (typeof safeViewTransition === 'function') {
        return safeViewTransition(updateDom);
    } else if (typeof window !== 'undefined' && typeof window.safeViewTransition === 'function') {
        return window.safeViewTransition(updateDom);
    } else {
        return updateDom();
    }
}
window.setCategoryFilter = setCategoryFilter;

// Очистка поиска крестиком
function clearSearchInput() {
    const updateDom = async () => {
        const input = document.getElementById('mainSearch');
        if (input) input.value = '';
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) clearBtn.style.display = 'none';
        const liveDropdown = document.getElementById('liveSearchDropdown');
        if (liveDropdown) liveDropdown.style.display = 'none';
        document.body.classList.remove('search-lock'); 
        if (typeof window.startLenis === 'function') window.startLenis();
        await applyFilters(true, false);
    };

    if (typeof safeViewTransition === 'function') {
        return safeViewTransition(updateDom);
    } else if (typeof window !== 'undefined' && typeof window.safeViewTransition === 'function') {
        return window.safeViewTransition(updateDom);
    } else {
        return updateDom();
    }
}
window.clearSearchInput = clearSearchInput;

// UI ценового диапазона
function updatePriceUI(e) {
    let minInput = document.getElementById('priceMin');
    let maxInput = document.getElementById('priceMax');
    if (!minInput || !maxInput) return;
    let minVal = Number.parseInt(minInput.value, 10);
    let maxVal = Number.parseInt(maxInput.value, 10);

    if (minVal >= maxVal) {
        const activeTargetId = (e && e.target && e.target.id) 
            || (typeof window !== 'undefined' && window.event && window.event.target && window.event.target.id);
        if (activeTargetId === 'priceMin') { 
            minInput.value = maxVal - 100; 
            minVal = maxVal - 100; 
        } else { 
            maxInput.value = minVal + 100; 
            maxVal = minVal + 100; 
        }
    }

    const minLabel = document.getElementById('priceMinVal');
    const maxLabel = document.getElementById('priceMaxVal');
    if (minLabel) minLabel.innerText = minVal;
    if (maxLabel) maxLabel.innerText = maxVal;

    const percentMin = (minVal / 15000) * 100;
    const percentMax = (maxVal / 15000) * 100;
    const rangeFill = document.getElementById('rangeFill');
    if (rangeFill) {
        rangeFill.style.left = percentMin + '%';
        rangeFill.style.right = (100 - percentMax) + '%';
    }

    clearTimeout(priceTimeout);
    priceTimeout = setTimeout(() => { applyFilters(); }, 300);
}
window.updatePriceUI = updatePriceUI;

// Переключение мобильного бокового меню фильтров
function toggleMobileSidebar() {
    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    const sidebar = document.querySelector('.sidebar');
    const btn = document.getElementById('mobileFilterBtn');
    const fab = document.querySelector('.fab-propose'); 
    if (!sidebar || !btn) return;
    
    const isOpen = sidebar.classList.contains('active-mobile');
    
    const hideText = (typeof i18next !== 'undefined') ? i18next.t('mobile.hide_filters', { defaultValue: '[-] СКРЫТЬ ФИЛЬТРЫ' }) : '[-] СКРЫТЬ ФИЛЬТРЫ';
    const showText = (typeof i18next !== 'undefined') ? i18next.t('mobile.show_filters', { defaultValue: '[+] ПОКАЗАТЬ ФИЛЬТРЫ' }) : '[+] ПОКАЗАТЬ ФИЛЬТРЫ';

    if (!isOpen) {
        // --- РАСКРЫВАЕМ ПЛАВНО ---
        btn.innerText = hideText;
        btn.style.borderColor = 'var(--accent-red)';
        btn.style.color = 'var(--accent-red)';
        btn.style.background = '#111'; 
        if (fab) fab.style.display = 'none';

        sidebar.classList.add('active-mobile');
        sidebar.style.maxHeight = '0px';
        sidebar.offsetHeight; // Принудительный reflow для старта анимации с 0

        const targetHeight = sidebar.scrollHeight + 35;
        sidebar.style.maxHeight = targetHeight + 'px';

        if (sidebar._transitionCtrl) {
            try { sidebar._transitionCtrl.abort(); } catch(e) {}
        }
        const openCtrl = new AbortController();
        sidebar._transitionCtrl = openCtrl;

        const onOpenEnd = (e) => {
            if (e.target === sidebar && e.propertyName === 'max-height') {
                openCtrl.abort();
                sidebar._transitionCtrl = null;
                if (sidebar.classList.contains('active-mobile')) {
                    sidebar.style.maxHeight = 'none';
                }
            }
        };
        sidebar.addEventListener('transitionend', onOpenEnd, { signal: openCtrl.signal });
        if (typeof updateSidebarCounters === 'function') updateSidebarCounters();
    } else {
        // --- СКРЫВАЕМ ТАК ЖЕ ПЛАВНО ---
        btn.innerText = showText;
        btn.style.borderColor = '#444';
        btn.style.color = 'var(--accent-green)';
        btn.style.background = '#050505'; 
        if (fab) fab.style.display = 'flex';

        // 1. Фиксируем точную текущую высоту (чтобы старт был мгновенным и плавным с текущей точки)
        const currentHeight = sidebar.offsetHeight || (sidebar.scrollHeight + 35);
        sidebar.style.maxHeight = currentHeight + 'px';
        sidebar.offsetHeight; // Принудительный reflow

        // 2. Плавно схлопываем до 0px
        sidebar.classList.remove('active-mobile');
        sidebar.style.maxHeight = '0px';

        if (sidebar._transitionCtrl) {
            try { sidebar._transitionCtrl.abort(); } catch(e) {}
        }
        const closeCtrl = new AbortController();
        sidebar._transitionCtrl = closeCtrl;

        const onCloseEnd = (e) => {
            if (e.target === sidebar && e.propertyName === 'max-height') {
                closeCtrl.abort();
                sidebar._transitionCtrl = null;
                if (!sidebar.classList.contains('active-mobile')) {
                    sidebar.style.maxHeight = '';
                }
            }
        };
        sidebar.addEventListener('transitionend', onCloseEnd, { signal: closeCtrl.signal });
        if (typeof checkPendingBroadcast === 'function') {
            setTimeout(checkPendingBroadcast, 350);
        }
    }
}
window.toggleMobileSidebar = toggleMobileSidebar;

// Логика слайдера фото в карточке товара на ПК/моб
let _dotsRaf = null;
const _lastDotIndices = {};
window.updateCardDots = function(container, itemId) {
    if (!container) return;
    if (_dotsRaf) return;
    _dotsRaf = requestAnimationFrame(() => {
        _dotsRaf = null;
        const width = container.clientWidth;
        if (!width) return;
        const index = Math.round(container.scrollLeft / width);
        if (_lastDotIndices[itemId] === index) return;
        _lastDotIndices[itemId] = index;

        const dotsContainer = document.getElementById(`dots-${itemId}`);
        if (dotsContainer) {
            const dots = dotsContainer.children;
            for (let i = 0; i < dots.length; i++) {
                dots[i].classList.toggle('active', i === index);
            }
        }
    });
};

window.scrollGridSlider = function(event, itemId, direction) {
    if (event) event.stopPropagation();
    const slider = document.getElementById(`slider-${itemId}`);
    if (!slider) return;
    activateCardSlides(slider);
    const slideWidth = slider.offsetWidth;
    slider.scrollBy({ left: slideWidth * direction, behavior: 'smooth' });
};

window.preloadGridSlide = function(event, itemId, direction) {
    if (event) event.stopPropagation();
    const slider = document.getElementById(`slider-${itemId}`);
    if (slider) activateCardSlides(slider);
    const catalog = typeof getCatalog === 'function' ? getCatalog() : [];
    const item = catalog.find(i => i.id === itemId);
    if (!item) return;
    const mediaArray = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails : (item.images || []);
    if (mediaArray.length <= 1) return;
    if (!slider) return;
    const slideWidth = slider.offsetWidth || 1;
    const currentIdx = Math.round(slider.scrollLeft / slideWidth);
    const targetIdx = typeof clamp === 'function' 
        ? clamp(currentIdx + direction, 0, mediaArray.length - 1)
        : Math.max(0, Math.min(mediaArray.length - 1, currentIdx + direction));
    const url = toCDN(mediaArray[targetIdx]);
    if (url && !url.endsWith('.mp4')) {
        const img = new Image();
        img.src = url;
    }
};

// Двойной тап для лайка
window.handleDoubleTapLike = async function(event, itemId, container) {
    if (typeof triggerVibration === 'function') triggerVibration(150);
    if (event) { event.preventDefault(); event.stopPropagation(); }

    if (container) {
        const star = document.createElement('div');
        star.className = 'double-tap-star-anim';
        star.innerText = '★'; 
        container.appendChild(star);
        setTimeout(() => star.remove(), 800);
    }
    
    if (typeof triggerHaptic === 'function') triggerHaptic('heavy');

    const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
    if (!userFavs.includes(itemId)) {
        if (typeof toggleFav === 'function') {
            await toggleFav(null, itemId);
        }
    }
};

// Информационные окна для бейджей товаров
window.showBadgeInfo = function(type) {
    let title = '';
    let text = '';
    const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);

    if (type === 'secure') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.secure_title', { defaultValue: 'SECURE_PAYMENT.EXE' }) : 'SECURE_PAYMENT.EXE';
        const isReturnable = activeItem && activeItem.is_returnable === true;
        const isDropItem = activeItem && (activeItem.is_drop === true || (activeItem.tags && activeItem.tags.map(t => t.toLowerCase()).includes('drop')));

        if (!isReturnable || isDropItem) {
            const defaultSecureText = 'NISHA выступает гарантом сделки. Вы не рискуете всей суммой.<br><br>Примеряйте вещь на почте: при наложке вы можете отказаться от покупки прямо в отделении.<br><br>После забора посылки домой возврат или обмен невозможен.';
            text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.secure_no_return_text', { defaultValue: defaultSecureText }) : defaultSecureText;
        } else {
            text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.secure_return_text', { defaultValue: 'NISHA выступает гарантом сделки. Ваши деньги надежно защищены.<br><br>Вы можете примерить вещь на почте. Даже если вы забрали её домой, на данный товар действует <b style="color:var(--accent-green);">гарантия возврата и обмена в течение 14 дней</b>.<br><br><i>Обязательное условие возврата: сохранение товарного вида и отсутствие следов носки.</i>' }) : 'NISHA выступает гарантом сделки. Ваши деньги надежно защищены.<br><br>Вы можете примерить вещь на почте. Даже если вы забрали её домой, на данный товар действует <b style="color:var(--accent-green);">гарантия возврата и обмена в течение 14 дней</b>.<br><br><i>Обязательное условие возврата: сохранение товарного вида и отсутствие следов носки.</i>';
        }
    } else if (type === 'fast') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.fast_title', { defaultValue: 'FAST_SHIPPING.SYS' }) : 'FAST_SHIPPING.SYS';
        text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.fast_text', { defaultValue: 'Отправка заказа осуществляется в день оплаты (при подтверждении до 16:00) или на следующий рабочий день.' }) : 'Отправка заказа осуществляется в день оплаты (при подтверждении до 16:00) или на следующий рабочий день.';
    } else if (type === 'refund_no') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.refund_no_title', { defaultValue: 'NO_RETURN_POLICY.LOG' }) : 'NO_RETURN_POLICY.LOG';
        text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.refund_no_text', { defaultValue: '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ ТОВАР НЕ ПОДЛЕЖИТ ВОЗВРАТУ ]</span><br><br>Мы настоятельно просим вас внимательно изучать фото, замеры и описание перед оформлением заказа.<br><br><b style="color:var(--accent-red);">Данная вещь не подлежит возврату или обмену ни при каких условиях.</b>' }) : '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ ТОВАР НЕ ПОДЛЕЖИТ ВОЗВРАТУ ]</span><br><br>Мы настоятельно просим вас внимательно изучать фото, замеры и описание перед оформлением заказа.<br><br><b style="color:var(--accent-red);">Данная вещь не подлежит возврату или обмену ни при каких условиях.</b>';
    } else if (type === 'refund_yes') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.refund_yes_title', { defaultValue: 'RETURN_POLICY.SYS' }) : 'RETURN_POLICY.SYS';
        text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.refund_yes_text', { defaultValue: '<span style="color:var(--accent-green); font-weight:bold; font-size:16px;">[ ДОСТУПЕН ВОЗВРАТ ]</span><br><br>Данный товар подлежит возврату и обмену в течение <b>14 дней</b> с момента покупки, согласно законодательству Украины.<br><br><i>Условие возврата: сохранение товарного вида, всех бирок и отсутствие следов носки.</i>' }) : '<span style="color:var(--accent-green); font-weight:bold; font-size:16px;">[ ДОСТУПЕН ВОЗВРАТ ]</span><br><br>Данный товар подлежит возврату и обмену в течение <b>14 дней</b> с момента покупки, согласно законодательству Украины.<br><br><i>Условие возврата: сохранение товарного вида, всех бирок и отсутствие следов носки.</i>';
    } else if (type === 'drop') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.drop_title', { defaultValue: 'WARNING: DROP_ITEM' }) : 'WARNING: DROP_ITEM';
        const defaultDropText = '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ ВНИМАНИЕ ]</span><br><span style="color:#fff;">Вещь от стороннего продавца. NISHA — гарант сделки.</span><br><br>Осмотр и примерка — строго на «Новой Почте» (при наложке остаток оплачивается после проверки).<br><br>После забора посылки возврат невозможен: сделка считается закрытой, а деньги сразу переводятся владельцу.';
        text = (typeof i18next !== 'undefined') ? (i18next.t('badge_info.drop_desc') || i18next.t('badge_info.drop_text') || defaultDropText) : defaultDropText;
    }
    
    const btnText = (typeof i18next !== 'undefined') ? i18next.t('badge_info.btn_understood', { defaultValue: '[ ПОНЯТНО ]' }) : '[ ПОНЯТНО ]';
    if (typeof showTerminalModal === 'function') {
        showTerminalModal(title, text, btnText, null);
    }
};

// Вспомогательная функция безопасного показа отложенного броадкаста
function flushPendingBroadcast() {
    if (!window.pendingBroadcastHtml || typeof tryShowBroadcast !== 'function') return;
    const bHtml = window.pendingBroadcastHtml;
    const bId = window.pendingBroadcastId;
    window.pendingBroadcastHtml = null;
    window.pendingBroadcastId = null;

    if (!bHtml || bHtml === 'null' || (typeof bHtml === 'string' && !bHtml.trim())) return;

    setTimeout(() => {
        const closeBtnText = (typeof i18next !== 'undefined' && i18next.t('propose.btn_close')) || '[ ЗАКРЫТЬ ]';
        tryShowBroadcast('SYSTEM_BROADCAST.MSG', bHtml, closeBtnText, () => {
            if (bId && window.storage) window.storage.set('nisha_last_broadcast', bId);
        });
    }, 3000);
}
window.flushPendingBroadcast = flushPendingBroadcast;

// Тур онбординга
async function startOnboardingTour() {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (!store || !store.get('nisha_rules_accepted') || store.get('nisha_tour_done')) return;

    // ПРОВЕРКА: Если пользователь уже пролистал страницу (не находится в верхнем углу):
    const initScroll = window.scrollY || document.documentElement.scrollTop || 0;
    if (initScroll > 30) {
        if (store) store.set('nisha_tour_done', 'true');
        flushPendingBroadcast();
        return;
    }

    if (typeof window.driver === 'undefined') {
        try {
            const [driverMod] = await Promise.all([
                import('driver.js'),
                import('driver.js/dist/driver.css')
            ]);
            const driverFn = driverMod.driver || driverMod.default || driverMod;
            window.driver = { js: { driver: driverFn } };
            startOnboardingTour();
        } catch (err) {
            console.warn('[Driver.js] Local load failed, falling back to CDN:', err);
            if (typeof loadExternalStyle === 'function') loadExternalStyle('https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.css');
            if (typeof loadExternalScript === 'function') {
                loadExternalScript('https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.js.iife.js').then(() => {
                    startOnboardingTour();
                }).catch(() => {});
            }
        }
        return;
    }

    const checkAndRun = setInterval(() => {
        const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some(el => {
            return typeof window.isElementVisible === 'function'
                ? window.isElementVisible(el)
                : window.getComputedStyle(el).display === 'flex';
        });
        
        const toastContainer = document.getElementById('toastContainer');
        const anyToastVisible = toastContainer && toastContainer.children.length > 0;

        if (anyModalOpen || anyToastVisible) return;

        // Если во время ожидания пользователь начал листать — отменяем тур
        const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        if (currentScrollY > 30) {
            clearInterval(checkAndRun);
            if (store) store.set('nisha_tour_done', 'true');
            flushPendingBroadcast();
            return;
        }

        clearInterval(checkAndRun);
        const isMobile = window.innerWidth <= 900;
        const firstStar = document.querySelector('.item-card .fav-star');
        const firstCartBtn = document.querySelector('.item-card .grid-cart-btn');

        let activeSteps = [];
        activeSteps.push({ element: '.search-wrapper', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.search_title') : 'ПОИСК', description: typeof i18next !== 'undefined' ? i18next.t('tour.search_desc') : 'Поиск по вещам' } });

        if (isMobile) {
            activeSteps.push(
                { element: '.mobile-profile-link', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prof_title') : 'ПРОФИЛЬ', description: typeof i18next !== 'undefined' ? i18next.t('tour.prof_desc') : 'Личный кабинет' } },
                { element: '#mobileFilterBtn', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.filt_title') : 'ФИЛЬТРЫ', description: typeof i18next !== 'undefined' ? i18next.t('tour.filt_desc') : 'Фильтры каталога' } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.star_title') : 'ИЗБРАННОЕ', description: typeof i18next !== 'undefined' ? i18next.t('tour.star_desc') : 'Сохраняйте вещи' } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_title') : 'КОРЗИНА', description: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_desc') : 'Добавление в заказ' } });
            activeSteps.push({ element: '.fab-propose', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prop_title') : 'ПРЕДЛОЖКА', description: typeof i18next !== 'undefined' ? i18next.t('tour.prop_desc') : 'Продать свою вещь' } });
            activeSteps.push({ element: '#cartInfoWrapper', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.cart_title') : 'КОРЗИНА', description: typeof i18next !== 'undefined' ? i18next.t('tour.cart_desc') : 'Ваши покупки' } });
        } else {
            activeSteps.push(
                { element: '#authBox', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prof_title') : 'ПРОФИЛЬ', description: typeof i18next !== 'undefined' ? i18next.t('tour.prof_desc') : 'Авторизация' } },
                { element: '.sidebar', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.filt_title') : 'ФИЛЬТРЫ', description: typeof i18next !== 'undefined' ? i18next.t('tour.filt_desc') : 'Фильтры каталога' } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.star_title') : 'ИЗБРАННОЕ', description: typeof i18next !== 'undefined' ? i18next.t('tour.star_desc') : 'Сохраняйте вещи' } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_title') : 'КОРЗИНА', description: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_desc') : 'Добавление в заказ' } });
            activeSteps.push({ element: '.fab-propose', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prop_title') : 'ПРЕДЛОЖКА', description: typeof i18next !== 'undefined' ? i18next.t('tour.prop_desc') : 'Продать свою вещь' } });
        }

        const driverFn = (window.driver && window.driver.js && window.driver.js.driver) || (window.driver && window.driver.driver) || (typeof window.driver === 'function' ? window.driver : null);
        if (!driverFn) return;

        const driverObj = driverFn({
            showProgress: true,
            overlayColor: 'transparent',
            overlayOpacity: 0,
            nextBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.next') : 'Далее',
            prevBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.prev') : 'Назад',
            doneBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.done') : 'Готово',
            steps: activeSteps,
            onDestroyStarted: () => {
                if (store) store.set('nisha_tour_done', 'true');
                driverObj.destroy();
                window._activeDriverTour = null;
                flushPendingBroadcast();
            }
        });
        window._activeDriverTour = driverObj;
        driverObj.drive();
    }, 500);
}
window.startOnboardingTour = startOnboardingTour;

// Защита: если юзер при входе сразу начинает скроллить страницу — не показываем подсказки онбординга
const _tourStore = window.storage || (typeof storage !== 'undefined' ? storage : null);
if (!_tourStore || !_tourStore.get('nisha_tour_done')) {
    const tourScrollCtrl = new AbortController();
    const onEarlyTourScroll = function() {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        if (y > 30) {
            tourScrollCtrl.abort();
            const s = window.storage || (typeof storage !== 'undefined' ? storage : null);
            if (s && !s.get('nisha_tour_done')) {
                s.set('nisha_tour_done', 'true');
                if (window._activeDriverTour) {
                    try { window._activeDriverTour.destroy(); } catch (e) {}
                    window._activeDriverTour = null;
                }
                flushPendingBroadcast();
            }
        }
    };
    window.addEventListener('scroll', onEarlyTourScroll, { passive: true, signal: tourScrollCtrl.signal });
}
