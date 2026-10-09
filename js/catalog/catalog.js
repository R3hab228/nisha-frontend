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
let changePageTimeout = null;
let priceTimeout = null;

// Запрещаем браузеру восстанавливать скролл при перезагрузке страницы
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Глобальный перехватчик URL для CDN
window.toCDN = function(url) {
    if (typeof url === 'string' && url.includes('nmpuefxqtkhvtltdvllz.supabase.co')) {
        return url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://nisha-cdn.mtyagniryadno.workers.dev');
    }
    return url || '';
};

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

// ОПТИМИЗАЦИЯ PREFETCH: отложенная предзагрузка картинок (с задержкой 200мс, чтобы не тормозить при скролле)
let _prefetchDebounceTimer = null;
window.prefetchItemImages = function(id) {
    if (!window._prefetchedItems) window._prefetchedItems = new Set();
    if (window._prefetchedItems.has(id)) return;
    
    clearTimeout(_prefetchDebounceTimer);
    _prefetchDebounceTimer = setTimeout(() => {
        if (window._prefetchedItems.has(id)) return;
        window._prefetchedItems.add(id);
        const item = window.allItems.find(i => i.id === id);
        if (item) {
            const toCDN = window.toCDN || ((u) => u);
            // Предзагрузка миниатюр карточки для мгновенного свайпа в сетке
            if (item.thumbnails && item.thumbnails.length > 1) {
                item.thumbnails.slice(1, 4).forEach(url => {
                    const img = new Image();
                    img.decoding = 'async';
                    img.src = toCDN(url);
                });
            }
            // Предзагрузка фото высокого качества для модалки
            if (item.images && item.images.length > 0) {
                item.images.slice(0, 2).forEach(url => {
                    const img = new Image();
                    img.decoding = 'async';
                    img.src = toCDN(url);
                });
            }
        }
    }, 200);
};

// ==========================================
// МОДУЛЬ ЗАМЕРОВ ДЛЯ КАРТОЧЕК (ТОЛЬКО ПК)
// ==========================================

function getCurrentSiteLang() {
    let l = localStorage.getItem('nisha_lang') || localStorage.getItem('i18nextLng') || 'ru';
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
    return unique.slice(0, 8);
}
window.extractItemMeasurements = extractItemMeasurements;

function getMeasurementsTooltip() {
    let tooltip = document.getElementById('measurementsTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'measurementsTooltip';
        tooltip.className = 'measurements-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

window.showItemMeasurementsTooltip = function(itemOrId, e) {
    // Не показываем на сенсорных мобильных устройствах
    if (('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768) return;
    
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
    const measures = extractItemMeasurements(item, currentLang);
    if (!measures || measures.length === 0) return;

    const tooltip = getMeasurementsTooltip();
    
    const escape = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    tooltip.style.display = 'block';
    tooltip.classList.add('visible');
    window.moveItemMeasurementsTooltip(e);
};

window.moveItemMeasurementsTooltip = function(e) {
    if (!e) return;
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

window.hideItemMeasurementsTooltip = function() {
    const tooltip = getMeasurementsTooltip();
    if (tooltip) {
        tooltip.classList.remove('visible');
        setTimeout(() => {
            if (!tooltip.classList.contains('visible')) {
                tooltip.style.display = 'none';
            }
        }, 150);
    }
};

// Прячем тултип при скролле страницы
window.addEventListener('scroll', () => {
    window.hideItemMeasurementsTooltip();
}, { passive: true });

// Загрузка всех товаров из БД и кэша
async function loadAllItems() {
    const grid = document.getElementById('itemsGrid');
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    
    // 1. МГНОВЕННАЯ ЗАГРУЗКА (Из кэша)
    const cachedData = localStorage.getItem('nisha_cached_db');
    if (cachedData && window.allItems.length === 0) {
        try {
            const parsed = JSON.parse(cachedData);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].description === undefined) {
                localStorage.removeItem('nisha_cached_db');
            } else {
                window.allItems = parsed;
                applyFilters();
            }
        } catch(e) { console.error("Ошибка кэша"); }
    }

    if (!sb) return;

    // 2. ФОНОВЫЙ ЗАПРОС К БД (Снимаем лимит, берем 1000 товаров, включая description)
    const { data, error } = await sb.from('items')
        .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop')
        .limit(1000)
        .order('created_at', { ascending: false });
    
    if (error) { 
        if (window.allItems.length === 0) {
            if (typeof handleNetworkOffline === 'function') {
                handleNetworkOffline();
            } else if (grid) {
                grid.innerHTML = `<div style="color:red; padding:20px; grid-column: 1/-1;">[ ОШИБКА БД: ${error.message} ]</div>`;
            }
        }
        return; 
    }
    
    // Сравниваем изменения без блокирующего JSON.stringify на всем каталоге
    let isChanged = !Array.isArray(window.allItems) || (data.length !== window.allItems.length);
    if (!isChanged) {
        for (let i = 0; i < data.length; i++) {
            const cur = window.allItems[i];
            const next = data[i];
            if (!cur || cur.id !== next.id || cur.price !== next.price || cur.status !== next.status || cur.is_top !== next.is_top || cur.name !== next.name) {
                isChanged = true;
                break;
            }
        }
    }
    window.allItems = data; 
    localStorage.setItem('nisha_cached_db', JSON.stringify(data)); 
    
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
        localStorage.setItem('nisha_history', JSON.stringify(dbHistory));
        if (typeof renderHistory === 'function') renderHistory();
    }

    // 4. СИНХРОНИЗАЦИЯ КОРЗИНЫ
    let userCart = (typeof cart !== 'undefined') ? cart : (window.cart || JSON.parse(localStorage.getItem('nisha_cart') || '[]'));
    const validCart = userCart.filter(cItem => window.allItems.some(dbItem => dbItem.id === cItem.id));
    if (validCart.length !== userCart.length) {
        if (typeof cart !== 'undefined') cart = validCart;
        window.cart = validCart;
        localStorage.setItem('nisha_cart', JSON.stringify(validCart));
        if (typeof updateCartUI === 'function') updateCartUI();
    }

    // 5. ПЕРЕРИСОВКА (Если данные реально обновились)
    if (!cachedData || isChanged) {
        applyFilters(); 
    }
    
    // 6. ФОНОВАЯ ПРОВЕРКА (Обход кеша CDN) - актуальные статусы TOP/SOLD
    syncCriticalStatuses();
}
window.loadAllItems = loadAllItems;

// СИНХРОНИЗАЦИЯ КРИТИЧЕСКИХ СТАТУСОВ (TOP, RESERVED, SOLD) в обход CDN
async function syncCriticalStatuses() {
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!sb) return;
    try {
        const { data } = await sb.from('items').select('id, is_top, top_until, status');
        
        if (data) {
            let changed = false;
            
            // 1. Очистка от удаленных из БД товаров
            const validIds = new Set(data.map(d => d.id));
            const originalLength = window.allItems.length;
            window.allItems = window.allItems.filter(i => validIds.has(i.id));
            if (window.allItems.length !== originalLength) changed = true;
            
            // 2. Синхронизация статусов
            const dataMap = new Map();
            data.forEach(d => dataMap.set(d.id, d));
            
            window.allItems.forEach(old => {
                const fresh = dataMap.get(old.id);
                if (fresh) {
                    if (old.is_top !== fresh.is_top || old.top_until !== fresh.top_until || old.status !== fresh.status) {
                        old.is_top = fresh.is_top;
                        old.top_until = fresh.top_until;
                        old.status = fresh.status;
                        changed = true;
                    }
                }
            });

            // 3. Подгрузка самых свежих товаров
            const { data: latestItems } = await sb.from('items')
                .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop')
                .order('created_at', { ascending: false })
                .limit(5);

            if (latestItems) {
                let latestAdded = false;
                latestItems.forEach(newItem => {
                    if (!window.allItems.find(i => i.id === newItem.id)) {
                        window.allItems.unshift(newItem);
                        latestAdded = true;
                        changed = true;
                    }
                });
                if (latestAdded) {
                    window.allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                }
            }
            
            if (changed) applyFilters();
        }
    } catch(e) { console.error("Sync error:", e); }
}
window.syncCriticalStatuses = syncCriticalStatuses;

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
                const n = parseFloat(numMatch[1].replace(',', '.'));
                if (n >= 35 && n <= 42.5) return true;
            }
            return false;
        }

        if (isShoesFilter2) {
            if (upperSize.includes('43 - 46') || upperSize.includes('43-46')) return true;
            const numMatch = upperSize.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
                const n = parseFloat(numMatch[1].replace(',', '.'));
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
    const curCat = window.currentCategory || '';
    const availableItemsAll = window.allItems.filter(i => i.status === 'available');
    const catCounts = { 'Все вещи': availableItemsAll.length };
    
    availableItemsAll.forEach(item => {
        if (!item) return;
        const c = item.category || 'Без категории';
        catCounts[c] = (catCounts[c] || 0) + 1;
    });

    // 1. Категории
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(link => {
        let baseText = link.innerHTML.split('<span')[0].trim();
        let catName = '';
        if (baseText.includes('Все вещи')) catName = 'Все вещи';
        else if (baseText.includes('Верхняя одежда')) catName = 'Верхняя одежда';
        else if (baseText.includes('Кофты и Свитера')) catName = 'Кофты и Свитера';
        else if (baseText.includes('Штаны и Джинсы')) catName = 'Штаны и Джинсы';
        else if (baseText.includes('Обувь')) catName = 'Обувь';
        else if (baseText.includes('Аксессуары')) catName = 'Аксессуары';

        const count = catCounts[catName] || 0;
        if (count > 0) {
            link.innerHTML = `${baseText} <span style="color:#ff3333; font-weight:bold; font-family:var(--font-mono); font-size:11px;">(${count})</span>`;
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
    const availableCategoryItems = window.allItems.filter(item => {
        if (!item || item.status !== 'available') return false;
        if (curCat !== '' && item.category !== curCat) return false;
        return true;
    });

    document.querySelectorAll('.size-cb').forEach(cb => {
        const labelSpan = cb.nextElementSibling;
        let baseText = labelSpan.innerHTML.split('<span')[0].trim();
        const sizeVal = cb.value;
        const count = availableCategoryItems.filter(item => itemMatchesSizeFilter(item, sizeVal)).length;

        if (count > 0) {
            labelSpan.innerHTML = `${baseText} <span style="color:#ff3333; font-weight:bold; font-family:var(--font-mono); font-size:11px;">(${count})</span>`;
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

// Основная функция фильтрации каталога
function applyFilters() {
    const grid = document.getElementById('itemsGrid');
    if (grid) grid.classList.add('fade-out');

    clearTimeout(applyFiltersTimeout);
    applyFiltersTimeout = setTimeout(() => {
        try {
            const searchInput = document.getElementById('mainSearch');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const checkedSizes = Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => cb.value);
            const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
            
            const minInput = document.getElementById('priceMin');
            const maxInput = document.getElementById('priceMax');
            const rawMin = minInput ? parseInt(minInput.value, 10) : NaN;
            const minPrice = (!isNaN(rawMin) && rawMin >= 0) ? rawMin : 0;
            const rawMax = maxInput ? parseInt(maxInput.value, 10) : NaN;
            const maxPrice = (!isNaN(rawMax) && rawMax > 0) ? rawMax : Infinity;

            const getSafePrice = (price) => parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
            const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
            const hacked = (typeof isHacked !== 'undefined') ? isHacked : (window.isHacked || false);
            const curCat = window.currentCategory || '';
            const curBrand = window.currentBrand || '';
            const onlyFavs = window.showingOnlyFavs || false;

            // 1. Фильтрация
            window.filteredItems = window.allItems.filter(item => {
                if (!item) return false;
                
                const isFav = userFavs.includes(item.id);
                const matchesAvailability = !hideUnavailable || item.status === 'available';
                
                if (onlyFavs) {
                    return isFav && matchesAvailability;
                }

                const itemCategory = item.category || '';
                const itemBrand = item.brand ? item.brand.toLowerCase() : '';
                const searchBrand = curBrand ? curBrand.toLowerCase() : '';
                
                const matchesCategory = curCat === '' || itemCategory === curCat;
                const matchesBrand = searchBrand === '' || itemBrand.includes(searchBrand);
                const matchesSize = checkedSizes.length === 0 || checkedSizes.some(sz => itemMatchesSizeFilter(item, sz));
                
                const itemFinalPrice = hacked ? Math.floor(getSafePrice(item.price) * 0.9) : getSafePrice(item.price);
                const matchesPrice = itemFinalPrice >= minPrice && itemFinalPrice <= maxPrice;
                
                return matchesCategory && matchesBrand && matchesSize && matchesPrice && matchesAvailability;
            });

            // 2. Умный поиск (Fuse.js или надежный fallback, работает также внутри категории и в избранном)
            if (searchTerm !== '') {
                const cleanSearchTerm = searchTerm.replace(/#/g, '').trim();
                if (cleanSearchTerm) {
                    if (typeof Fuse !== 'undefined') {
                        const fuseOptions = {
                            includeScore: true, threshold: 0.4, ignoreLocation: true, useExtendedSearch: true, 
                            keys: [{ name: 'tags', weight: 1.0 }, { name: 'brand', weight: 0.8 }, { name: 'name', weight: 0.8 }, { name: 'size', weight: 0.8 }, { name: 'category', weight: 0.2 }]
                        };
                        const fuse = new Fuse(window.filteredItems, fuseOptions);
                        window.filteredItems = fuse.search(cleanSearchTerm).map(result => result.item);
                    } else {
                        const lowSearch = cleanSearchTerm.toLowerCase();
                        window.filteredItems = window.filteredItems.filter(item => {
                            const name = (item.name || '').toLowerCase();
                            const brand = (item.brand || '').toLowerCase();
                            const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : (item.tags || '').toLowerCase();
                            return name.includes(lowSearch) || brand.includes(lowSearch) || tags.includes(lowSearch);
                        });
                    }
                }
            }

            // 3. Сортировка
            const now = Date.now();
            const isItemTop = (item) => item.is_top === true && item.top_until && new Date(item.top_until).getTime() > now;
            const sortCheap = document.getElementById('sort-cheap');

            if (sortCheap && sortCheap.classList.contains('active-sort')) {
                window.filteredItems.sort((a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return getSafePrice(a.price) - getSafePrice(b.price);
                });
            } else {
                window.filteredItems.sort((a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                });
            }
            
            // СБРОС И РЕНДЕР
            if (grid) grid.innerHTML = ''; 
            window.renderedCount = 0; 
            window.currentPage = 1; 
            
            const scrollTrigger = document.getElementById('loadingTrigger');
            if (scrollTrigger && window.innerWidth <= 900) {
                scrollTrigger.style.display = 'block';
                scrollTrigger.innerHTML = '';
            }
            
            const countEl = document.getElementById('itemCount');
            if (countEl) {
                countEl.innerText = window.filteredItems.length;
            }

            if (window.filteredItems.length === 0) {
                if (grid) grid.innerHTML = `<div style="color: #666; font-family: monospace; padding: 30px; grid-column: 1/-1; text-align:center;">[ ТОВАРОВ НЕ НАЙДЕНО ]</div>`;
            } else {
                renderNextBatch(); 
            }

            // Обновляем URL параметры
            const url = new URL(window.location);
            if (curCat) url.searchParams.set('cat', curCat); else url.searchParams.delete('cat');
            if (searchTerm) url.searchParams.set('q', searchTerm); else url.searchParams.delete('q');
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
                grid.innerHTML = `<div style="color:red; grid-column:1/-1; padding:20px; text-align:center;">[ ОШИБКА РЕНДЕРА: ${err.message} ]</div>`;
                grid.classList.remove('fade-out');
            }
        }
    }, 180); 
}
window.applyFilters = applyFilters;

// Умный плеер для видео в сетке (IntersectionObserver)
const gridVideoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting && !document.hidden) {
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
        if (!card || card === currentTooltipCard) return;
        currentTooltipCard = card;
        const id = card.getAttribute('data-id');
        if (!id) return;
        if (typeof window.prefetchItemImages === 'function') window.prefetchItemImages(id);
        const item = window.allItems && window.allItems.find(i => String(i.id) === String(id));
        if (item && typeof window.showItemMeasurementsTooltip === 'function') {
            window.showItemMeasurementsTooltip(item, e);
        }
    });

    grid.addEventListener('mousemove', (e) => {
        if (currentTooltipCard && typeof window.moveItemMeasurementsTooltip === 'function') {
            window.moveItemMeasurementsTooltip(e);
        }
    });

    grid.addEventListener('mouseout', (e) => {
        if (!currentTooltipCard) return;
        if (!e.relatedTarget || !currentTooltipCard.contains(e.relatedTarget)) {
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

// Рендер следующей пачки товаров
function renderNextBatch() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;
    initGridEventDelegation();
    
    const isMobile = window.innerWidth <= 900;
    
    let oldPagination = document.getElementById('mainPagination');
    if (oldPagination) oldPagination.remove();

    let startIndex = 0;
    let endIndex = 0;
    const BATCH_SIZE = isMobile ? 12 : 15;
    itemsPageSize = BATCH_SIZE;

    if (isMobile) {
        if (window.renderedCount === 0) grid.innerHTML = ''; 
        startIndex = window.renderedCount;
        endIndex = Math.min(startIndex + BATCH_SIZE, window.filteredItems.length); 
    } else {
        grid.innerHTML = ''; 
        startIndex = (window.currentPage - 1) * BATCH_SIZE; 
        endIndex = Math.min(startIndex + BATCH_SIZE, window.filteredItems.length);
    }
    
    if (startIndex >= endIndex) return;
    
    let seenItemsIds = [];
    try {
        seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items')) || [];
        if (!Array.isArray(seenItemsIds)) seenItemsIds = [];
    } catch(e) { seenItemsIds = []; }
    
    const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
    const curr = (typeof getCurrency === 'function') ? getCurrency() : 'грн';

    const fragment = document.createDocumentFragment();
    const newVideoElements = [];

    for (let i = startIndex; i < endIndex; i++) {
        try {
            const item = window.filteredItems[i];
            if (!item) continue;
            
            let badgeHTML = '';
            if (item.status === 'sold') {
                badgeHTML = '<div class="sold-badge">SOLD</div>';
            } else if (item.status === 'reserved') {
                badgeHTML = '<div class="reserved-badge">RESERVED</div>';
            } else {
                const hasSale = item.is_sale;
                const hasHot = (item.views_count || 0) >= 25;
                const isTop = item.is_top === true && item.top_until && new Date(item.top_until).getTime() > Date.now();

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

            const loadAttr = (i < 4) ? 'fetchpriority="high"' : 'loading="lazy"';

            thumbsArray.forEach((thumbUrl, idx) => {
                const rawVidUrl = item.images && item.images[idx] ? item.images[idx] : '';
                const isVid = typeof rawVidUrl === 'string' && rawVidUrl.endsWith('.mp4');
                
                const cdnThumb = window.toCDN(thumbUrl);
                const cdnVidUrl = window.toCDN(rawVidUrl);

                if (isVid) {
                    slidesStr += `
                        <div class="card-slide img-8bit-loading" style="background: #0a0a0a;">
                            <video class="grid-lazy-video" src="${cdnVidUrl}#t=0.001" muted loop playsinline preload="metadata" style="width:100%; height:100%; object-fit:cover; pointer-events:none; opacity:0;" oncanplay="this.style.opacity='1'; this.parentElement.classList.remove('img-8bit-loading'); this.parentElement.classList.add('img-8bit-loaded');"></video>
                        </div>`;
                } else {
                    slidesStr += `
                        <div class="card-slide img-8bit-loading" style="background-image: none;">
                           <img src="${cdnThumb}" ${loadAttr} decoding="async" style="position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none;" 
onload="this.parentElement.style.backgroundImage='url(\\''+this.src+'\\')'; this.parentElement.classList.remove('img-8bit-loading'); this.parentElement.classList.add('img-8bit-loaded');" 
onerror="this.parentElement.classList.remove('img-8bit-loading'); this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:red;font-size:10px;font-family:monospace;\\'>NO SIGNAL</div>';">
                        </div>`;
                }
                dotsStr += `<div class="card-dot ${idx === 0 ? 'active' : ''}"></div>`;
            });

            const starClass = userFavs.includes(item.id) ? 'fav-star active' : 'fav-star';
            const isUnseen = !seenItemsIds.includes(item.id) && item.status === 'available';
            const pulseClass = isUnseen ? 'unseen-pulse' : '';

            const card = document.createElement('div');
            card.className = `item-card ${item.status !== 'available' ? 'sold-out' : ''} ${pulseClass}`;
            card.setAttribute('data-id', item.id);
            
            let priceHTML = '';
            if (item.is_sale && item.old_price) {
                priceHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 14px; margin-right: 8px;">${item.old_price} ${curr}</span><span style="color: var(--accent-green);">${item.price} ${curr}</span>`;
            } else {
                priceHTML = `<span style="color: var(--accent-green);">${item.price} ${curr}</span>`;
            }

            let controlsHTML = '';
            if (thumbsArray.length > 1) {
                controlsHTML = `
                    <div class="grid-slider-btn prev" role="button" aria-label="Предыдущее фото" onmouseenter="preloadGridSlide(event, '${item.id}', -1)" onclick="scrollGridSlider(event, '${item.id}', -1)">&#10094;</div>
                    <div class="grid-slider-btn next" role="button" aria-label="Следующее фото" onmouseenter="preloadGridSlide(event, '${item.id}', 1)" onclick="scrollGridSlider(event, '${item.id}', 1)">&#10095;</div>
                    <div class="card-dots-container" id="dots-${item.id}">${dotsStr}</div>
                `;
            }

            const sizePrefix = (typeof i18next !== 'undefined') ? i18next.t('grid.size_prefix', { defaultValue: 'Размер: ' }) : 'Размер: ';
            const addToCartText = (typeof i18next !== 'undefined') ? i18next.t('product.add_to_cart', { defaultValue: 'В КОРЗИНУ' }) : 'В КОРЗИНУ';

            card.innerHTML = `
                ${badgeHTML}
                <div class="${starClass}" role="button" aria-label="В избранное" onclick="toggleFav(event, '${item.id}')">★</div>
                <div class="card-slider-wrapper">
                    <div class="card-slider-container" id="slider-${item.id}" onscroll="updateCardDots(this, '${item.id}')">
                        ${slidesStr}
                    </div>
                    ${controlsHTML}
                </div>
                <div class="item-info" onclick="openProductModalById('${item.id}')">
                    <h3 class="item-title">${item.name}</h3>
                    <div class="item-price">${priceHTML}</div>
                    <div class="item-size"><span data-i18n="grid.size_prefix">${sizePrefix}</span>${item.size}</div>
                    <div class="item-footer"><span>${item.brand}</span><span>${item.condition}</span></div>
                </div>
                <button class="grid-cart-btn" data-i18n="product.add_to_cart" style="${item.status === 'sold' ? 'display:none;' : ''}" onclick="addToCartWithAnimation('${item.id}', this, event)">${addToCartText}</button>
            `;

            fragment.appendChild(card);
            const vids = card.querySelectorAll('.grid-lazy-video');
            vids.forEach(v => newVideoElements.push(v));

        } catch (err) { console.error(err); }
    }

    grid.appendChild(fragment);
    newVideoElements.forEach(v => gridVideoObserver.observe(v));

    if (isMobile) {
        window.renderedCount = endIndex;
        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) {
            if (window.renderedCount >= window.filteredItems.length) {
                scrollTrigger.style.display = 'none';
            } else {
                scrollTrigger.innerHTML = '';
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

            paginationWrap.innerHTML = `
                <button class="page-arrow" onclick="changePage(-1)" ${prevDisabled}>&#10094;</button>
                <div class="page-numbers">[ СТРАНИЦА <span style="color:var(--accent-green); font-weight:bold;">${window.currentPage}</span> ИЗ ${totalPages} ]</div>
                <button class="page-arrow" onclick="changePage(1)" ${nextDisabled}>&#10095;</button>
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
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(el => el.classList.remove('active-filter'));
    if (element) {
        element.classList.add('active-filter');
    }
    window.currentCategory = cat; 
    sessionStorage.setItem('nisha_last_category', cat);
    applyFilters(); 
}
window.setCategoryFilter = setCategoryFilter;

// Очистка поиска крестиком
function clearSearchInput() {
    const input = document.getElementById('mainSearch');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    const liveDropdown = document.getElementById('liveSearchDropdown');
    if (liveDropdown) liveDropdown.style.display = 'none';
    document.body.classList.remove('search-lock'); 
    if (typeof window.startLenis === 'function') window.startLenis();
    applyFilters();
}
window.clearSearchInput = clearSearchInput;

// UI ценового диапазона
function updatePriceUI() {
    let minInput = document.getElementById('priceMin');
    let maxInput = document.getElementById('priceMax');
    if (!minInput || !maxInput) return;
    let minVal = parseInt(minInput.value);
    let maxVal = parseInt(maxInput.value);

    if (minVal >= maxVal) {
        if (window.event && window.event.target && window.event.target.id === 'priceMin') { 
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

        const onOpenEnd = (e) => {
            if (e.target === sidebar && e.propertyName === 'max-height') {
                sidebar.removeEventListener('transitionend', onOpenEnd);
                if (sidebar.classList.contains('active-mobile')) {
                    sidebar.style.maxHeight = 'none';
                }
            }
        };
        sidebar.addEventListener('transitionend', onOpenEnd);
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

        const onCloseEnd = (e) => {
            if (e.target === sidebar && e.propertyName === 'max-height') {
                sidebar.removeEventListener('transitionend', onCloseEnd);
                if (!sidebar.classList.contains('active-mobile')) {
                    sidebar.style.maxHeight = '';
                }
            }
        };
        sidebar.addEventListener('transitionend', onCloseEnd);
    }
}
window.toggleMobileSidebar = toggleMobileSidebar;

// Логика слайдера фото в карточке товара на ПК/моб
window.updateCardDots = function(container, itemId) {
    if (!container) return;
    const index = Math.round(container.scrollLeft / container.offsetWidth);
    const dotsContainer = document.getElementById(`dots-${itemId}`);
    if (dotsContainer) {
        const dots = dotsContainer.querySelectorAll('.card-dot');
        dots.forEach((dot, i) => {
            if (i === index) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }
};

window.scrollGridSlider = function(event, itemId, direction) {
    if (event) event.stopPropagation();
    const slider = document.getElementById(`slider-${itemId}`);
    if (!slider) return;
    const slideWidth = slider.offsetWidth;
    slider.scrollBy({ left: slideWidth * direction, behavior: 'smooth' });
};

window.preloadGridSlide = function(event, itemId, direction) {
    if (event) event.stopPropagation();
    const catalog = typeof getCatalog === 'function' ? getCatalog() : [];
    const item = catalog.find(i => i.id === itemId);
    if (!item) return;
    const mediaArray = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails : (item.images || []);
    if (mediaArray.length <= 1) return;
    const slider = document.getElementById(`slider-${itemId}`);
    if (!slider) return;
    const slideWidth = slider.offsetWidth || 1;
    const currentIdx = Math.round(slider.scrollLeft / slideWidth);
    const targetIdx = Math.max(0, Math.min(mediaArray.length - 1, currentIdx + direction));
    const toCDN = window.toCDN || ((u) => u);
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
        text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.drop_text', { defaultValue: defaultDropText }) : defaultDropText;
    }
    
    const btnText = (typeof i18next !== 'undefined') ? i18next.t('badge_info.btn_understood', { defaultValue: '[ ПОНЯТНО ]' }) : '[ ПОНЯТНО ]';
    if (typeof showTerminalModal === 'function') {
        showTerminalModal(title, text, btnText, null);
    }
};

// Тур онбординга
function startOnboardingTour() {
    if (!localStorage.getItem('nisha_rules_accepted') || 
        localStorage.getItem('nisha_tour_done')) return;

    if (typeof window.driver === 'undefined') {
        if (typeof loadExternalStyle === 'function') loadExternalStyle('https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.css');
        if (typeof loadExternalScript === 'function') {
            loadExternalScript('https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.js.iife.js').then(() => {
                startOnboardingTour();
            }).catch(() => {});
        }
        return;
    }

    const checkAndRun = setInterval(() => {
        const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some(el => {
            return window.getComputedStyle(el).display === 'flex';
        });
        
        const toastContainer = document.getElementById('toastContainer');
        const anyToastVisible = toastContainer && toastContainer.children.length > 0;

        if (anyModalOpen || anyToastVisible) return;

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

        const driverObj = window.driver.js.driver({
            showProgress: true,
            nextBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.next') : 'Далее',
            prevBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.prev') : 'Назад',
            doneBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.done') : 'Готово',
            steps: activeSteps,
            onDestroyStarted: () => {
                localStorage.setItem('nisha_tour_done', 'true');
                driverObj.destroy();
                
                if (window.pendingBroadcastHtml && typeof tryShowBroadcast === 'function') {
                    setTimeout(() => {
                        tryShowBroadcast('SYSTEM_BROADCAST.MSG', window.pendingBroadcastHtml, '[ ЗАКРЫТЬ ]', () => {
                            localStorage.setItem('nisha_last_broadcast', window.pendingBroadcastId);
                        });
                        window.pendingBroadcastHtml = null;
                    }, 600);
                }
            }
        });
        driverObj.drive();
    }, 500);
}
window.startOnboardingTour = startOnboardingTour;
