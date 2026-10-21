// ==========================================
// NISHA CORE HELPERS (Утилиты, тосты, вибрация)
// ==========================================

// --- SANITIZATION & ESCAPING UTILITIES (XSS SHIELD) ---
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

function escapeAttr(str) {
    return escapeHtml(str);
}
window.escapeAttr = escapeAttr;

function escapeJsString(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}
window.escapeJsString = escapeJsString;

// --- VIBRATION & HAPTIC FEEDBACK ---
function triggerVibration(duration = 150) {
    if ('vibrate' in navigator) {
        try { navigator.vibrate(duration); } catch(e){}
    }
}
window.triggerVibration = triggerVibration;

function triggerHaptic(type = 'light') {
    if (window.innerWidth > 900 || !navigator.vibrate) return;
    try {
        switch(type) {
            case 'light': navigator.vibrate(25); break;
            case 'medium': navigator.vibrate(40); break;
            case 'heavy': navigator.vibrate(70); break;
            case 'success': navigator.vibrate([20, 60, 20]); break;
            case 'error': navigator.vibrate([30, 50, 30, 50, 30]); break;
        }
    } catch(e) {}
}
window.triggerHaptic = triggerHaptic;

// --- ТОСТЫ (ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ) ---
let lastToastMsg = '';
let lastToastTime = 0;

function showToast(message, type = 'success', imgUrl = null, onClick = null) {
    const now = Date.now();
    if (message === lastToastMsg && (now - lastToastTime < 2500)) return;
    lastToastMsg = message;
    lastToastTime = now;
    
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    if (onClick && typeof onClick === 'function') {
        toast.style.cursor = 'pointer';
        toast.style.pointerEvents = 'auto';
        toast.onclick = (e) => {
            e.stopPropagation();
            try { onClick(); } catch(err) { console.warn(err); }
        };
    }
    
    // Если передали картинку — добавляем её слева от текста
    let html = '';
    if (imgUrl) {
        html += `<div style="width: 35px; height: 35px; background-image: url('${imgUrl}'); background-size: cover; background-position: center; border-radius: 4px; border: 1px solid #444; flex-shrink: 0;"></div>`;
    }
    html += `<div>${message}</div>`;
    
    toast.innerHTML = html;
    container.appendChild(toast);
    
    // 2500 миллисекунд (2.5 секунды) + 500мс на саму анимацию затухания
    setTimeout(() => { 
        toast.remove();
    }, 3000);
}
window.showToast = showToast;

// --- ОЧЕРЕДЬ ТОСТОВ О НОВЫХ ТОВАРАХ (МАКСИМУМ 2 ОДНОВРЕМЕННО + ПЛАВНАЯ СМЕНА) ---
const _newItemToastQueue = [];
let _activeNewItemToastCount = 0;
const MAX_CONCURRENT_NEW_ITEM_TOASTS = 2;

function safeToastEscape(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function enqueueNewItemToast(item) {
    if (!item || !item.id) return;
    // Защита от дублей в очереди
    if (_newItemToastQueue.some(q => q.id === item.id)) return;
    _newItemToastQueue.push(item);
    _drainNewItemToastQueue();
}
window.enqueueNewItemToast = enqueueNewItemToast;

function _drainNewItemToastQueue() {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    while (_activeNewItemToastCount < MAX_CONCURRENT_NEW_ITEM_TOASTS && _newItemToastQueue.length > 0) {
        const item = _newItemToastQueue.shift();
        _activeNewItemToastCount++;
        _displayNewItemToast(item, container);
    }
}

function _displayNewItemToast(item, container) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-new-item success';
    
    const imgUrl = (Array.isArray(item.thumbnails) && item.thumbnails[0]) 
        || (Array.isArray(item.images) && item.images[0]) 
        || null;

    const brandPart = item.brand ? `${safeToastEscape(item.brand)} — ` : '';
    const namePart = safeToastEscape(item.name || 'Новая вещь');
    const pricePart = item.price ? `<span class="toast-item-price">${safeToastEscape(item.price)} ₴</span>` : '';

    let html = '';
    if (imgUrl) {
        const cdnImg = (typeof window.toCDN === 'function') ? window.toCDN(imgUrl) : imgUrl;
        html += `<div class="toast-item-thumb" style="background-image: url('${safeToastEscape(cdnImg)}');"></div>`;
    }
    html += `
        <div class="toast-item-content">
            <div class="toast-item-tag">🆕 НОВАЯ ВЕЩЬ НА САЙТЕ</div>
            <div class="toast-item-title">${brandPart}${namePart}</div>
            ${pricePart}
        </div>
        <button type="button" class="toast-close-btn" aria-label="Закрыть">&times;</button>
    `;
    toast.innerHTML = html;

    let isDismissed = false;
    let timerId = null;

    const dismiss = () => {
        if (isDismissed) return;
        isDismissed = true;
        if (timerId) clearTimeout(timerId);

        toast.classList.add('toast-leaving');
        setTimeout(() => {
            toast.remove();
            _activeNewItemToastCount = Math.max(0, _activeNewItemToastCount - 1);
            // Плавная задержка перед появлением следующего тоста для естественности анимации
            setTimeout(_drainNewItemToastQueue, 150);
        }, 320);
    };

    // Клик по тосту открывает карточку товара
    toast.onclick = (e) => {
        if (e.target.closest('.toast-close-btn')) {
            e.stopPropagation();
            dismiss();
            return;
        }
        if (typeof openProductModalById === 'function') {
            try {
                openProductModalById(item.id);
            } catch (err) {
                console.warn('[TOAST] Error opening product modal:', err);
            }
        }
        dismiss();
    };

    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            dismiss();
        };
    }

    container.appendChild(toast);

    // Тост отображается 3.5 сек, затем плавно улетает и освобождает место следующему
    timerId = setTimeout(dismiss, 3500);
}

// --- ТЕРМИНАЛЬНЫЕ ОКНА ДЛЯ УВЕДОМЛЕНИЙ (ОДНОКНОПОЧНЫЕ) ---
function showTerminalModal(title, htmlText, btnText, callback) {
    if (!htmlText || htmlText === 'null' || (typeof htmlText === 'string' && !htmlText.trim())) {
        if (callback) callback();
        return;
    }
    // Удаляем любые зависшие оверлеи перед созданием нового, чтобы исключить наслоение и скачки
    document.querySelectorAll('.terminal-modal-overlay').forEach(el => el.remove());

    const isMeasureModal = title && title.includes('MEASURE_SYSTEM');
    const titleClass = isMeasureModal ? 'success-title measure-sys-title' : 'success-title typewriter';
    const boxExtraClass = isMeasureModal ? 'measure-terminal-box' : '';

    const overlay = document.createElement('div');
    overlay.className = 'terminal-modal-overlay';
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 10000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;";
    
    overlay.innerHTML = `
        <div class="success-terminal-box ${boxExtraClass}">
            <div class="${titleClass}">${title}</div>
            <div class="success-divider"></div>
            <div class="success-text" style="margin-bottom: 20px; color: #ddd; text-align: left;">${htmlText}</div>
            <button class="cart-checkout-btn btn-target" style="width: 100%; padding: 15px;">${btnText}</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const btn = overlay.querySelector('button');
    const closeOverlay = () => {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        overlay.remove();
        if (callback) callback();
    };

    btn.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay();
    });
}
window.showTerminalModal = showTerminalModal;

// --- ДВУХКНОПОЧНЫЙ ТЕРМИНАЛ ДЛЯ ПОДТВЕРЖДЕНИЙ (CONFIRM) ---
function showConfirmTerminalModal(title, htmlText, confirmBtnText, cancelBtnText, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'terminal-modal-overlay confirm-modal-overlay';
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 100000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;";
    
    overlay.innerHTML = `
        <div class="success-terminal-box" style="animation: none; transform: scale(1); opacity: 1;">
            <div class="success-title typewriter" style="color: var(--accent-yellow);">${title}</div>
            <div class="success-divider" style="background: repeating-linear-gradient(90deg, var(--accent-yellow), var(--accent-yellow) 5px, transparent 5px, transparent 10px);"></div>
            <div class="success-text" style="margin-bottom: 20px; color: #ddd; text-align: left;">${htmlText}</div>
            <div style="display: flex; gap: 10px;">
                <button class="cart-checkout-btn btn-target confirm-yes" style="flex: 1; background: var(--accent-red); border-color: var(--accent-red); color: #fff;">${confirmBtnText}</button>
                <button class="cart-checkout-btn btn-target confirm-no" style="flex: 1; background: #333; border-color: #555; color: #fff;">${cancelBtnText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    overlay.querySelector('.confirm-yes').addEventListener('click', () => { overlay.remove(); if (onConfirm) onConfirm(); });
    overlay.querySelector('.confirm-no').addEventListener('click', () => { overlay.remove(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}
window.showConfirmTerminalModal = showConfirmTerminalModal;

// --- ВАЛЮТА И ФОРМАТИРОВАНИЕ ---
function getCurrency() {
    const lang = localStorage.getItem('nisha_lang') || 'ru';
    return lang === 'en' ? 'UAH' : 'грн';
}
window.getCurrency = getCurrency;

// --- ГЕНЕРАЦИЯ БЕЗОПАСНЫХ КОРОТКИХ ID НА БАЗЕ CRYPTO.RANDOMUUID ---
function generateShortId(length = 9) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '').slice(0, length);
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => (b % 36).toString(36)).join('').slice(0, length);
    }
    return Date.now().toString(36).slice(-length);
}
window.generateShortId = generateShortId;
if (typeof globalThis !== 'undefined') globalThis.generateShortId = generateShortId;

// --- КОПИРОВАНИЕ В БУФЕР ОБМЕНА (ЕДИНЫЙ НАТИВНЫЙ CLIPBOARD API С ЗАЩИТОЙ ДЛЯ IN-APP WEBVIEW) ---
function _copyViaSelectionFallback(str) {
    try {
        const ta = document.createElement('textarea');
        ta.value = str;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.left = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
        ta.remove();
        return Boolean(ok);
    } catch (e) {
        return false;
    }
}

function copyToClipboard(text, successMsg = 'Скопировано в буфер!', errorMsg = 'Ошибка копирования') {
    const str = String(text ?? '');
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(str)
            .then(() => {
                if (successMsg) showToast(successMsg, 'success');
                return true;
            })
            .catch(() => {
                if (_copyViaSelectionFallback(str)) {
                    if (successMsg) showToast(successMsg, 'success');
                    return true;
                }
                if (errorMsg) showToast(errorMsg, 'error');
                return false;
            });
    }
    if (_copyViaSelectionFallback(str)) {
        if (successMsg) showToast(successMsg, 'success');
        return Promise.resolve(true);
    }
    if (errorMsg) showToast(errorMsg, 'error');
    return Promise.resolve(false);
}
window.copyToClipboard = copyToClipboard;
if (typeof globalThis !== 'undefined') globalThis.copyToClipboard = copyToClipboard;

// --- БЕЗОПАСНЫЕ ГЕТТЕРЫ ДАННЫХ И КЛИЕНТОВ ---
function getSupabase() {
    return window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
}
window.getSupabase = getSupabase;

function getCatalog() {
    return window.allItems || (typeof allItems !== 'undefined' ? allItems : []);
}
window.getCatalog = getCatalog;

function getOptimizedImg(item, thumb = true) {
    if (typeof window.getOptimizedImageUrl === 'function') {
        return window.getOptimizedImageUrl(item, thumb);
    }
    if (typeof getOptimizedImageUrl === 'function') {
        return getOptimizedImageUrl(item, thumb);
    }
    return (item && item.images && item.images[0]) ? (window.toCDN ? window.toCDN(item.images[0]) : item.images[0]) : '';
}
window.getOptimizedImg = getOptimizedImg;

// --- ЕДИНЫЙ БЕЗОПАСНЫЙ ХЕЛПЕР LOCALSTORAGE (storage.getJSON / storage.setJSON) ---
function getLocalStore() {
    try {
        if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
            return window.localStorage;
        }
        if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
            return localStorage;
        }
    } catch (e) {}
    return null;
}

const storage = {
    getJSON(key, defaultValue = null) {
        try {
            const store = getLocalStore();
            if (!store) return defaultValue;
            const raw = store.getItem(key);
            if (raw === null || raw === undefined || raw === '') return defaultValue;
            const parsed = JSON.parse(raw);
            return parsed !== null && parsed !== undefined ? parsed : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },

    setJSON(key, value) {
        const store = getLocalStore();
        if (!store) return false;
        try {
            store.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            try {
                if (typeof cleanStorageLimits === 'function') cleanStorageLimits();
                store.setItem(key, JSON.stringify(value));
                return true;
            } catch (retryErr) {
                return false;
            }
        }
    },

    get(key, defaultValue = null) {
        try {
            const store = getLocalStore();
            if (!store) return defaultValue;
            const val = store.getItem(key);
            return val !== null ? val : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            const store = getLocalStore();
            if (!store) return false;
            store.setItem(key, String(value));
            return true;
        } catch (e) {
            return false;
        }
    },

    remove(key) {
        try {
            const store = getLocalStore();
            if (!store) return false;
            store.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    }
};
window.storage = storage;
window.getStorageJSON = (key, defaultValue = null) => storage.getJSON(key, defaultValue);
window.setStorageJSON = (key, value) => storage.setJSON(key, value);
if (typeof globalThis !== 'undefined') {
    globalThis.storage = storage;
    globalThis.getStorageJSON = window.getStorageJSON;
    globalThis.setStorageJSON = window.setStorageJSON;
}

// --- САМООЧИСТКА И ЛИМИТЫ ПАМЯТИ (LOCALSTORAGE GARBAGE COLLECTOR) ---
function cleanStorageLimits() {
    try {
        // 1. Ограничение истории просмотров (до 30 товаров)
        const hist = storage.getJSON('nisha_history', null);
        if (Array.isArray(hist) && hist.length > 30) {
            localStorage.setItem('nisha_history', JSON.stringify(hist.slice(0, 30)));
        }

        // 2. Ограничение просмотренных ID вещей (до 200 штук)
        const seen = storage.getJSON('nisha_seen_items', null);
        if (Array.isArray(seen) && seen.length > 200) {
            localStorage.setItem('nisha_seen_items', JSON.stringify(seen.slice(-200)));
        }

        // 3. Ограничение истории поиска (до 15 запросов)
        const searches = storage.getJSON('nisha_search_history', null) || storage.getJSON('nisha_recent_searches', null);
        if (Array.isArray(searches) && searches.length > 15) {
            localStorage.setItem('nisha_search_history', JSON.stringify(searches.slice(0, 15)));
        }
        storage.remove('nisha_recent_searches');
    } catch(e) {
        console.warn('Storage cleanup notice:', e);
    }
}
window.cleanStorageLimits = cleanStorageLimits;

// --- УМНЫЙ ПОИСК С ТРАНСЛИТЕРАЦИЕЙ И МАППИНГОМ БРЕНДОВ (RU/UA <-> EN) ---
const SEARCH_SYNONYMS = {
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

const CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ґ': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y',
    'э': 'e', 'ю': 'yu', 'я': 'ya', 'є': 'ye'
};

function transliterateCyrillic(str) {
    if (!str || typeof str !== 'string') return '';
    return str.split('').map(char => {
        const lower = char.toLowerCase();
        return CYRILLIC_TO_LATIN[lower] !== undefined ? CYRILLIC_TO_LATIN[lower] : char;
    }).join('');
}

function expandSearchQuery(query) {
    if (!query || typeof query !== 'string') return [];
    const clean = query.replace(/[#&]/g, '').trim().toLowerCase();
    if (!clean) return [];

    const variants = new Set();
    variants.add(clean);

    // 1. Прямой поиск по словарю синонимов
    if (SEARCH_SYNONYMS[clean]) {
        SEARCH_SYNONYMS[clean].split(' ').forEach(w => variants.add(w));
    }

    // 2. Пословный поиск по словарю синонимов
    const words = clean.split(/\s+/);
    if (words.length > 1) {
        let hasWordSynonym = false;
        const replacedWords = words.map(w => {
            if (SEARCH_SYNONYMS[w]) {
                hasWordSynonym = true;
                return SEARCH_SYNONYMS[w].split(' ')[0];
            }
            return w;
        });
        if (hasWordSynonym) {
            variants.add(replacedWords.join(' '));
        }
    }

    // 3. Если есть кириллические символы — добавляем базовую транслитерацию
    if (/[а-яёіїєґ]/i.test(clean)) {
        const translit = transliterateCyrillic(clean);
        if (translit && translit !== clean) {
            variants.add(translit);
        }
    }

    return Array.from(variants);
}
window.expandSearchQuery = expandSearchQuery;
window.transliterateCyrillic = transliterateCyrillic;

// --- ВНЕШНИЙ ЛОАДЕР СКРИПТОВ И СТИЛЕЙ ПО ТРЕБОВАНИЮ (LAZY LOADER) ---
const _loadedExternalScripts = {};
function loadExternalScript(src) {
    if (_loadedExternalScripts[src]) return _loadedExternalScripts[src];
    _loadedExternalScripts[src] = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = (err) => {
            delete _loadedExternalScripts[src];
            reject(err);
        };
        document.head.appendChild(s);
    });
    return _loadedExternalScripts[src];
}
window.loadExternalScript = loadExternalScript;

const _loadedExternalStyles = {};
function loadExternalStyle(href) {
    if (_loadedExternalStyles[href]) return _loadedExternalStyles[href];
    _loadedExternalStyles[href] = new Promise((resolve) => {
        const existing = document.querySelector(`link[href="${href}"]`);
        if (existing) {
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = () => resolve();
        document.head.appendChild(link);
    });
    return _loadedExternalStyles[href];
}
window.loadExternalStyle = loadExternalStyle;

// --- УНИВЕРСАЛЬНАЯ БЕЗОПАСНАЯ ОБЕРТКА SAFESTORAGE (Safari Incognito / Quota Guard) ---
const _memStorageFallback = {};

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        try {
            if (typeof cleanStorageLimits === 'function') cleanStorageLimits();
            localStorage.setItem(key, value);
            return true;
        } catch (innerErr) {
            _memStorageFallback[key] = String(value);
            return false;
        }
    }
}
window.safeSetItem = safeSetItem;

function safeGetItem(key, fallback = null) {
    try {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
        return _memStorageFallback[key] !== undefined ? _memStorageFallback[key] : fallback;
    } catch (e) {
        return _memStorageFallback[key] !== undefined ? _memStorageFallback[key] : fallback;
    }
}
window.safeGetItem = safeGetItem;

function safeRemoveItem(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {}
    delete _memStorageFallback[key];
}
window.safeRemoveItem = safeRemoveItem;

window.safeStorage = {
    setItem: safeSetItem,
    getItem: safeGetItem,
    removeItem: safeRemoveItem
};

// Автоматическая защита всех прямых вызовов Storage.prototype (Safari Private / QuotaExceededError)
(function initStorageSafeGuard() {
    try {
        if (typeof Storage !== 'undefined' && Storage.prototype) {
            const originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                try {
                    originalSetItem.call(this, key, value);
                } catch (err) {
                    try {
                        if (this === localStorage && typeof cleanStorageLimits === 'function') {
                            cleanStorageLimits();
                        }
                        originalSetItem.call(this, key, value);
                    } catch (retryErr) {
                        _memStorageFallback[key] = String(value);
                    }
                }
            };
            const originalGetItem = Storage.prototype.getItem;
            Storage.prototype.getItem = function(key) {
                try {
                    const res = originalGetItem.call(this, key);
                    if (res !== null) return res;
                    return _memStorageFallback[key] !== undefined ? _memStorageFallback[key] : null;
                } catch (err) {
                    return _memStorageFallback[key] !== undefined ? _memStorageFallback[key] : null;
                }
            };
        }
    } catch (e) {}
})();

// --- ЛЕНИВАЯ ЗАГРУЗКА PHOTOSWIPE ПО ТРЕБОВАНИЮ (ON-DEMAND) ---
let _photoSwipeInitPromise = null;
async function ensurePhotoSwipe() {
    if (window.PhotoSwipeLightbox) return window.PhotoSwipeLightbox;
    if (_photoSwipeInitPromise) return _photoSwipeInitPromise;
    _photoSwipeInitPromise = (async () => {
        try {
            const [lightboxMod, pswpMod] = await Promise.all([
                import('photoswipe/lightbox'),
                import('photoswipe'),
                import('photoswipe/style.css')
            ]);
            const Lightbox = lightboxMod.default || lightboxMod.PhotoSwipeLightbox || lightboxMod;
            const PhotoSwipe = pswpMod.default || pswpMod.PhotoSwipe || pswpMod;
            window.PhotoSwipeLightbox = Lightbox;
            window.PhotoSwipe = PhotoSwipe;
            if (!window.pswpLightbox && window.PhotoSwipeLightbox) {
                window.pswpLightbox = new window.PhotoSwipeLightbox({
                    gallery: '#sliderWrapper',
                    children: 'a.slide',
                    showHideAnimationType: 'fade',
                    zoomAnimationDuration: 200,
                    bgOpacity: 0.9,
                    closeOnVerticalDrag: true,
                    wheelToZoom: true,
                    pswpModule: PhotoSwipe
                });
                window.pswpLightbox.init();
            }
            return window.PhotoSwipeLightbox;
        } catch (e) {
            console.warn('[PhotoSwipe] Local module load failed, attempting CDN fallback:', e);
            try {
                if (typeof loadExternalStyle === 'function') {
                    loadExternalStyle('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.css');
                }
                const mod = await import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe-lightbox.esm.min.js');
                window.PhotoSwipeLightbox = mod.default || mod.PhotoSwipeLightbox;
                return window.PhotoSwipeLightbox;
            } catch (cdnErr) {
                console.error('[PhotoSwipe] All loaders failed:', cdnErr);
                _photoSwipeInitPromise = null;
                return null;
            }
        }
    })();
    return _photoSwipeInitPromise;
}
window.ensurePhotoSwipe = ensurePhotoSwipe;

// ==========================================
// ULTRA-LIGHTWEIGHT INDEXEDDB KEY-VAL STORE
// ==========================================
(function() {
    const DB_NAME = 'nisha_idb_v1';
    const STORE_NAME = 'keyval';
    let _dbPromise = null;

    function getDB() {
        if (!_dbPromise) {
            _dbPromise = new Promise((resolve) => {
                if (!window.indexedDB) return resolve(null);
                try {
                    const req = indexedDB.open(DB_NAME, 1);
                    req.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains(STORE_NAME)) {
                            db.createObjectStore(STORE_NAME);
                        }
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => {
                        console.warn('[IDB] Failed to open IndexedDB:', req.error);
                        resolve(null);
                    };
                } catch (e) {
                    resolve(null);
                }
            });
        }
        return _dbPromise;
    }

    window.idbGet = async function(key) {
        try {
            const db = await getDB();
            if (!db) return null;
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    };

    window.idbSet = async function(key, val) {
        try {
            const db = await getDB();
            if (!db) return false;
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put(val, key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            return false;
        }
    };

    window.idbDel = async function(key) {
        try {
            const db = await getDB();
            if (!db) return false;
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.delete(key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            return false;
        }
    };
})();

// ==========================================
// GLOBAL EVENT DELEGATION (data-action / data-hover-action)
// ==========================================
function handleDelegatedAction(e) {
    if (!e || !e.target || typeof e.target.closest !== 'function') return;
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl.disabled || (typeof actionEl.hasAttribute === 'function' && actionEl.hasAttribute('disabled'))) return;

    const action = actionEl.getAttribute('data-action');
    switch (action) {
        case 'open-product': {
            const id = actionEl.getAttribute('data-id');
            if (id && typeof window.openProductModalById === 'function') {
                window.openProductModalById(id);
            }
            break;
        }
        case 'scroll-grid-slider': {
            const id = actionEl.getAttribute('data-id');
            const dir = parseInt(actionEl.getAttribute('data-dir'), 10) || 1;
            if (id && typeof window.scrollGridSlider === 'function') {
                window.scrollGridSlider(e, id, dir);
            }
            break;
        }
        case 'toggle-fav': {
            const id = actionEl.getAttribute('data-id');
            if (id && typeof window.toggleFav === 'function') {
                window.toggleFav(e, id);
            }
            break;
        }
        case 'add-to-cart': {
            const id = actionEl.getAttribute('data-id');
            if (id && typeof window.addToCartWithAnimation === 'function') {
                window.addToCartWithAnimation(id, actionEl, e);
            }
            break;
        }
        case 'change-page': {
            const dir = parseInt(actionEl.getAttribute('data-dir'), 10);
            if (!Number.isNaN(dir) && typeof window.changePage === 'function') {
                window.changePage(dir);
            }
            break;
        }
        case 'remove-from-cart': {
            const idx = parseInt(actionEl.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx) && typeof window.removeFromCart === 'function') {
                const rowEl = typeof actionEl.closest === 'function' ? actionEl.closest('.cart-item-row') : null;
                window.removeFromCart(idx, e, rowEl);
            }
            break;
        }
        case 'clear-search-history': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            try { localStorage.removeItem('nisha_search_history'); } catch (err) {}
            if (typeof window.closeSearch === 'function') window.closeSearch();
            break;
        }
        case 'apply-search-history': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const term = actionEl.getAttribute('data-term') || '';
            const input = typeof document !== 'undefined' ? document.getElementById('mainSearch') : null;
            if (input) input.value = term;
            if (typeof window.handleLiveSearch === 'function') window.handleLiveSearch();
            break;
        }
        case 'select-live-search-item': {
            const id = actionEl.getAttribute('data-id');
            if (id && typeof window.openProductModalById === 'function') {
                window.openProductModalById(id);
            }
            if (typeof window.closeSearch === 'function') window.closeSearch();
            break;
        }
        case 'dismiss-net-error': {
            if (typeof window.dismissNetError === 'function') window.dismissNetError();
            break;
        }
        case 'toggle-qa-section': {
            if (typeof window.toggleQASection === 'function') window.toggleQASection(actionEl);
            break;
        }
        case 'toggle-question-form': {
            if (typeof window.toggleQuestionForm === 'function') window.toggleQuestionForm();
            break;
        }
        case 'submit-question': {
            const id = actionEl.getAttribute('data-id');
            if (id && typeof window.submitQuestion === 'function') window.submitQuestion(id);
            break;
        }
        case 'set-slide': {
            const idx = parseInt(actionEl.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx) && typeof window.setSlide === 'function') window.setSlide(idx);
            break;
        }
        case 'show-badge-info': {
            const badge = actionEl.getAttribute('data-badge');
            if (badge && typeof window.showBadgeInfo === 'function') window.showBadgeInfo(badge);
            break;
        }
        case 'remove-history-item': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const id = actionEl.getAttribute('data-id');
            if (id && typeof window.removeHistoryItem === 'function') window.removeHistoryItem(e, id);
            break;
        }
        case 'remove-profile-phone': {
            const isModal = actionEl.getAttribute('data-modal') === '1';
            if (typeof window.removeProfilePhone === 'function') window.removeProfilePhone(isModal);
            break;
        }
        case 'remove-profile-tg': {
            const isModal = actionEl.getAttribute('data-modal') === '1';
            if (typeof window.removeProfileTg === 'function') window.removeProfileTg(isModal);
            break;
        }
        case 'verify-orders-phone': {
            const phone = actionEl.getAttribute('data-phone') || '';
            const orderPhoneEl = typeof document !== 'undefined' ? document.getElementById('orderPhone') : null;
            if (orderPhoneEl) orderPhoneEl.value = phone;
            if (typeof window.generateAndSendOTP === 'function') window.generateAndSendOTP();
            break;
        }
        case 'copy-ttn': {
            const ttn = actionEl.getAttribute('data-ttn');
            if (ttn && typeof window.copyTTN === 'function') window.copyTTN(ttn, actionEl);
            break;
        }
        case 'prompt-order-review': {
            if (typeof window.closeModal === 'function') window.closeModal('ordersModal');
            if (typeof window.promptOrderReview === 'function') {
                window.promptOrderReview(
                    actionEl.getAttribute('data-order-id') || '',
                    actionEl.getAttribute('data-item-name') || '',
                    actionEl.getAttribute('data-item-img') || '',
                    actionEl.getAttribute('data-item-id') || ''
                );
            }
            break;
        }
        case 'open-review-image': {
            const img = actionEl.getAttribute('data-img');
            if (img && typeof window.openReviewImage === 'function') window.openReviewImage(img);
            break;
        }
        case 'close-modal': {
            const modalId = actionEl.getAttribute('data-modal-id');
            if (modalId && typeof window.closeModal === 'function') window.closeModal(modalId);
            break;
        }
        case 'trigger-prop-files': {
            const filesEl = typeof document !== 'undefined' ? document.getElementById('propFiles') : null;
            if (filesEl && typeof filesEl.click === 'function') filesEl.click();
            break;
        }
        case 'submit-proposal': {
            if (typeof window.submitProposal === 'function') window.submitProposal();
            break;
        }
        case 'submit-manual-review': {
            if (typeof window.submitManualReview === 'function') window.submitManualReview();
            break;
        }
        case 'skip-auto-review': {
            if (typeof window.skipAutoReview === 'function') window.skipAutoReview();
            break;
        }
        case 'submit-auto-review': {
            if (typeof window.submitAutoReview === 'function') window.submitAutoReview();
            break;
        }
        case 'submit-support-ticket': {
            if (typeof window.submitSupportTicket === 'function') window.submitSupportTicket();
            break;
        }
        case 'open-measure-scheme': {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (typeof window.showMeasurementSchemeModal === 'function') {
                window.showMeasurementSchemeModal();
            }
            break;
        }
    }
}
window.handleDelegatedAction = handleDelegatedAction;

function handleDelegatedMediaLoad(e) {
    const target = e && e.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('card-slide-img')) {
        target.style.opacity = '1';
        if (target.parentElement) {
            target.parentElement.classList.remove('img-8bit-loading');
            target.parentElement.classList.add('img-8bit-loaded');
        }
    } else if (target.classList.contains('modal-slide-img')) {
        target.style.opacity = '1';
        if (target.parentElement) {
            if (target.naturalWidth) target.parentElement.setAttribute('data-pswp-width', target.naturalWidth);
            if (target.naturalHeight) target.parentElement.setAttribute('data-pswp-height', target.naturalHeight);
            target.parentElement.classList.remove('skeleton');
            target.parentElement.style.border = 'none';
        }
    }
}
window.handleDelegatedMediaLoad = handleDelegatedMediaLoad;

function handleDelegatedMediaError(e) {
    const target = e && e.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('card-slide-img')) {
        const ds = target.dataset || {};
        const fallbackSrc = ds.fallbackSrc || (typeof target.getAttribute === 'function' ? target.getAttribute('data-fallback-src') : '');
        const hasTriedFb = ds.fb || (typeof target.getAttribute === 'function' ? target.getAttribute('data-fb') : '');
        const currentSrc = target.src || (typeof target.getAttribute === 'function' ? target.getAttribute('src') : '');
        if (!hasTriedFb && fallbackSrc && fallbackSrc !== currentSrc) {
            if (target.dataset) target.dataset.fb = '1';
            if (typeof target.setAttribute === 'function') target.setAttribute('data-fb', '1');
            target.src = fallbackSrc;
            return;
        }
        if (target.parentElement) {
            target.parentElement.classList.remove('img-8bit-loading');
        }
        target.outerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:red;font-size:10px;font-family:monospace;">NO SIGNAL</div>';
    } else if (target.classList.contains('similar-slide-img')) {
        target.style.display = 'none';
        if (target.parentElement) {
            target.parentElement.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;font-family:var(--font-mono);">ERROR</div>';
        }
    }
}
window.handleDelegatedMediaError = handleDelegatedMediaError;

function handleDelegatedMediaCanPlay(e) {
    const target = e && e.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('grid-lazy-video')) {
        target.style.opacity = '1';
        if (target.parentElement) {
            target.parentElement.classList.remove('img-8bit-loading');
            target.parentElement.classList.add('img-8bit-loaded');
        }
    } else if (target.classList.contains('modal-video-player')) {
        target.style.opacity = '1';
        if (target.parentElement) {
            target.parentElement.classList.remove('img-8bit-loading');
        }
    }
}
window.handleDelegatedMediaCanPlay = handleDelegatedMediaCanPlay;

function handleDelegatedScroll(e) {
    const target = e && e.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('card-slider-container')) {
        const itemId = (typeof target.getAttribute === 'function' && target.getAttribute('data-item-id'))
            || (target.id && target.id.startsWith('slider-') ? target.id.slice(7) : '');
        if (itemId && typeof window.updateCardDots === 'function') {
            window.updateCardDots(target, itemId);
        }
    }
}
window.handleDelegatedScroll = handleDelegatedScroll;

function initActionDelegation() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    if (window._nishaActionDelegationBound) return;
    window._nishaActionDelegationBound = true;

    document.addEventListener('click', handleDelegatedAction, true);
    document.addEventListener('load', handleDelegatedMediaLoad, true);
    document.addEventListener('error', handleDelegatedMediaError, true);
    document.addEventListener('canplay', handleDelegatedMediaCanPlay, true);
    document.addEventListener('scroll', handleDelegatedScroll, true);

    document.addEventListener('mouseover', (e) => {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const hoverEl = e.target.closest('[data-hover-action]');
        if (!hoverEl) return;
        if (e.relatedTarget && typeof hoverEl.contains === 'function' && hoverEl.contains(e.relatedTarget)) return;

        const hoverAction = hoverEl.getAttribute('data-hover-action');
        if (hoverAction === 'preload-grid-slide') {
            const id = hoverEl.getAttribute('data-id');
            const dir = parseInt(hoverEl.getAttribute('data-dir'), 10) || 1;
            if (id && typeof window.preloadGridSlide === 'function') window.preloadGridSlide(e, id, dir);
        } else if (hoverAction === 'similar-item-tooltip') {
            const id = hoverEl.getAttribute('data-id');
            if (id && typeof window.showItemMeasurementsTooltip === 'function') window.showItemMeasurementsTooltip(id, e);
        } else if (hoverAction === 'review-link-hover') {
            hoverEl.style.textDecoration = 'underline';
            hoverEl.style.color = '#fff';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const hoverEl = e.target.closest('[data-hover-action="similar-item-tooltip"]');
        if (hoverEl && typeof window.moveItemMeasurementsTooltip === 'function') {
            window.moveItemMeasurementsTooltip(e);
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const hoverEl = e.target.closest('[data-hover-action]');
        if (!hoverEl) return;
        if (e.relatedTarget && typeof hoverEl.contains === 'function' && hoverEl.contains(e.relatedTarget)) return;

        const hoverAction = hoverEl.getAttribute('data-hover-action');
        if (hoverAction === 'similar-item-tooltip') {
            if (typeof window.hideItemMeasurementsTooltip === 'function') window.hideItemMeasurementsTooltip();
        } else if (hoverAction === 'review-link-hover') {
            hoverEl.style.textDecoration = 'none';
            hoverEl.style.color = 'var(--accent-green)';
        }
    });
}
window.initActionDelegation = initActionDelegation;
initActionDelegation();
