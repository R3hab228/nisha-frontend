// ==========================================
// NISHA CORE HELPERS (Утилиты, тосты, вибрация)
// ==========================================

// --- UNIFIED CDN URL REWRITER ---
function toCDN(url) {
    if (!url || typeof url !== 'string') return '';
    return url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://nisha-cdn.mtyagniryadno.workers.dev');
}
window.toCDN = window.toCDN || toCDN;
if (typeof globalThis !== 'undefined') globalThis.toCDN = globalThis.toCDN || toCDN;

// --- SANITIZATION & ESCAPING UTILITIES (XSS SHIELD) ---
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
window.escapeHtml = escapeHtml;

function escapeAttr(str) {
    return escapeHtml(str);
}
window.escapeAttr = escapeAttr;

function escapeJsString(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('"', '\\"')
        .replaceAll('<', '\\x3c')
        .replaceAll('>', '\\x3e')
        .replaceAll('\n', '\\n')
        .replaceAll('\r', '\\r');
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
    // 1. Telegram WebApp HapticFeedback (нативный Taptic Engine на iOS и Android)
    try {
        const tgHaptic = (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp)
            ? window.Telegram.WebApp.HapticFeedback
            : null;
        if (tgHaptic) {
            if (type === 'success' || type === 'error') {
                if (typeof tgHaptic.notificationOccurred === 'function') {
                    tgHaptic.notificationOccurred(type);
                    return;
                }
            } else if (typeof tgHaptic.impactOccurred === 'function') {
                const style = type === 'heavy' ? 'heavy' : (type === 'medium' ? 'medium' : 'light');
                tgHaptic.impactOccurred(style);
                return;
            }
        }
    } catch (e) {}

    // 2. Стандартный Web Vibration API для мобильных браузеров
    if (typeof window === 'undefined' || window.innerWidth > 900 || typeof navigator === 'undefined' || !navigator.vibrate) return;
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
if (typeof globalThis !== 'undefined') globalThis.triggerHaptic = triggerHaptic;

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
    
    // Если передали картинку — добавляем её слева от текста (с защитой от CSS/HTML инъекции)
    let html = '';
    if (imgUrl && typeof imgUrl === 'string' && !/^\s*javascript:/i.test(imgUrl)) {
        const safeImgUrl = escapeAttr(imgUrl).replaceAll('(', '%28').replaceAll(')', '%29');
        html += `<div style="width: 35px; height: 35px; background-image: url('${safeImgUrl}'); background-size: cover; background-position: center; border-radius: 4px; border: 1px solid #444; flex-shrink: 0;"></div>`;
    }
    const rawMsgStr = String(message ?? '');
    const safeMsgHtml = (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function')
        ? window.DOMPurify.sanitize(rawMsgStr)
        : rawMsgStr.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=/gi, ' data-blocked=');
    html += `<div>${safeMsgHtml}</div>`;
    
    toast.innerHTML = html;
    container.appendChild(toast);
    
    // 2500 миллисекунд (2.5 секунды) + 500мс на саму анимацию затухания
    setTimeout(() => { 
        toast.remove();
    }, 3000);
}
window.showToast = showToast;

// --- ОЧЕРЕДЬ ТОСТОВ О НОВЫХ ТОВАРАХ (МАКСИМУМ 2 ОДНОВРЕМЕННО + ПЛАВНАЯ СМЕНА) ---
let _batchedNewItemsList = [];
let _batchToastTimer = null;
let _activeUnifiedToast = null;

function safeToastEscape(str) {
    return escapeHtml(str);
}

function enqueueNewItemToast(itemOrItems) {
    if (!itemOrItems) return;
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    items.forEach(item => {
        if (item && item.id && !_batchedNewItemsList.some(b => String(b.id) === String(item.id))) {
            _batchedNewItemsList.push(item);
        }
    });

    if (_batchToastTimer) clearTimeout(_batchToastTimer);
    _batchToastTimer = setTimeout(() => {
        if (_batchedNewItemsList.length === 0) return;
        const batch = [..._batchedNewItemsList];
        _batchedNewItemsList = [];
        _displayUnifiedNewItemToast(batch);
    }, 350);
}
window.enqueueNewItemToast = enqueueNewItemToast;

function _displayUnifiedNewItemToast(items) {
    const container = document.getElementById('toastContainer');
    if (!container || !items || items.length === 0) return;

    if (_activeUnifiedToast && typeof _activeUnifiedToast.dismiss === 'function') {
        _activeUnifiedToast.dismiss(true);
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast-new-item success';
    
    const firstItem = items[0];
    const isMulti = items.length > 1;

    const imgUrl = (Array.isArray(firstItem.thumbnails) && firstItem.thumbnails[0]) 
        || (Array.isArray(firstItem.images) && firstItem.images[0]) 
        || null;

    let titleText = '';
    if (isMulti) {
        titleText = typeof i18next !== 'undefined'
            ? i18next.t('messages.new_items_count', { count: items.length, defaultValue: `+${items.length} новых вещей в каталоге` })
            : `+${items.length} новых вещей в каталоге`;
    } else {
        const brandPart = firstItem.brand ? `${safeToastEscape(firstItem.brand)} — ` : '';
        const fallbackName = typeof i18next !== 'undefined'
            ? i18next.t('messages.new_item_fallback', { defaultValue: 'Новая вещь' })
            : 'Новая вещь';
        const namePart = safeToastEscape(firstItem.name || fallbackName);
        titleText = `${brandPart}${namePart}`;
    }


    let html = '';
    if (imgUrl) {
        const cdnImg = (typeof window.toCDN === 'function') ? window.toCDN(imgUrl) : imgUrl;
        html += `<div class="toast-item-thumb" style="background-image: url('${safeToastEscape(cdnImg)}');"></div>`;
    }
    html += `
        <div class="toast-item-content">
            <div class="toast-item-tag">${typeof i18next !== 'undefined' ? i18next.t('messages.new_items_toast', { defaultValue: 'Новые Вещи!!!' }) : 'Новые Вещи!!!'}</div>
            <div class="toast-item-title">${titleText}</div>
        </div>
    `;
    toast.innerHTML = html;

    let isDismissed = false;
    let timerId = null;

    const dismiss = (immediate = false) => {
        if (isDismissed) return;
        isDismissed = true;
        if (timerId) clearTimeout(timerId);
        _activeUnifiedToast = null;

        if (immediate) {
            toast.remove();
        } else {
            toast.classList.add('toast-leaving');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    };

    // Клик по тосту: если 1 вещь — открывает ее модалку, если несколько — плавно скроллит вверх к новинкам
    toast.onclick = () => {
        if (isMulti) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (firstItem && typeof openProductModalById === 'function') {
            try {
                openProductModalById(firstItem.id);
            } catch (err) {
                console.warn('[TOAST] Error opening product modal:', err);
            }
        }
        dismiss();
    };

    container.appendChild(toast);
    timerId = setTimeout(() => dismiss(false), 3800);
    _activeUnifiedToast = { toast, dismiss };
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
    const modalCtrl = new AbortController();
    const closeOverlay = () => {
        modalCtrl.abort();
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        overlay.remove();
        if (callback) callback();
    };

    btn.addEventListener('click', closeOverlay, { signal: modalCtrl.signal });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay();
    }, { signal: modalCtrl.signal });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeOverlay();
    }, { signal: modalCtrl.signal });
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
    
    const confirmCtrl = new AbortController();
    const closeOverlay = (confirmed = false) => {
        confirmCtrl.abort();
        overlay.remove();
        if (confirmed && onConfirm) onConfirm();
    };

    overlay.querySelector('.confirm-yes').addEventListener('click', () => closeOverlay(true), { signal: confirmCtrl.signal });
    overlay.querySelector('.confirm-no').addEventListener('click', () => closeOverlay(false), { signal: confirmCtrl.signal });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(false); }, { signal: confirmCtrl.signal });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(false); }, { signal: confirmCtrl.signal });
}
window.showConfirmTerminalModal = showConfirmTerminalModal;

// --- БЕЗОПАСНАЯ И БЫСТРАЯ ОЧИСТКА DOM-ЭЛЕМЕНТА ЧЕРЕЗ REPLACECHILDREN ---
function clearElement(el) {
    if (!el) return;
    if (typeof el.replaceChildren === 'function') {
        el.replaceChildren();
    } else {
        el.innerHTML = '';
    }
}
window.clearElement = clearElement;
if (typeof globalThis !== 'undefined') globalThis.clearElement = clearElement;

// --- ВАЛЮТА И ФОРМАТИРОВАНИЕ (INTL.NUMBERFORMAT) ---
function getCurrency() {
    const lang = (window.storage && typeof window.storage.get === 'function')
        ? window.storage.get('nisha_lang', 'ru')
        : (typeof storage !== 'undefined' && storage ? storage.get('nisha_lang', 'ru') : 'ru');
    return lang === 'en' ? 'UAH' : 'грн';
}
window.getCurrency = getCurrency;
if (typeof globalThis !== 'undefined') globalThis.getCurrency = getCurrency;

function formatPrice(amount, options = {}) {
    const num = Number(amount) || 0;
    const lang = (window.storage && typeof window.storage.get === 'function')
        ? window.storage.get('nisha_lang', 'ru')
        : (typeof storage !== 'undefined' && storage ? storage.get('nisha_lang', 'ru') : 'ru');
    const currency = lang === 'en' ? 'UAH' : 'грн';
    
    // Форматирование чисел через Intl с неразрывным пробелом (\u00A0)
    const formattedNum = num.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU', {
        maximumFractionDigits: 0
    });
    
    if (options.currencyOnly) return currency;
    if (options.numberOnly) return formattedNum;
    return `${formattedNum}\u00A0${currency}`;
}
window.formatPrice = formatPrice;
if (typeof globalThis !== 'undefined') globalThis.formatPrice = formatPrice;

// --- RANGE CLAMP UTILITY ---
function clamp(val, min, max) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.min(Math.max(val, lo), hi);
}
window.clamp = clamp;
if (typeof globalThis !== 'undefined') globalThis.clamp = clamp;

// --- ГЕНЕРАЦИЯ БЕЗОПАСНЫХ КОРОТКИХ ID НА БАЗЕ CRYPTO.RANDOMUUID ---
function generateShortId(length = 9) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replaceAll('-', '').slice(0, length);
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

// --- ГЛУБОКОЕ КЛОНИРОВАНИЕ НА БАЗЕ STRUCTUREDCLONE С SAFE FALLBACK ---
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        } catch (e) {
            // Safe fallback для объектов, которые structuredClone не может клонировать (DOM-элементы, функции, сигналы)
        }
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }
    const copy = {};
    for (const key of Object.keys(obj)) {
        copy[key] = deepClone(obj[key]);
    }
    return copy;
}
window.deepClone = deepClone;
if (typeof globalThis !== 'undefined') globalThis.deepClone = deepClone;

// --- ИММУТАБЕЛЬНАЯ СОРТИРОВКА МАССИВОВ (TOSORTED С SAFE FALLBACK) ---
function toSorted(array, compareFn) {
    if (!Array.isArray(array)) return [];
    if (typeof array.toSorted === 'function') {
        return array.toSorted(compareFn);
    }
    return [...array].sort(compareFn);
}
window.toSorted = toSorted;
if (typeof globalThis !== 'undefined') globalThis.toSorted = toSorted;

// --- ОПЕРАЦИИ НАД МНОЖЕСТВАМИ (SET.PROTOTYPE.DIFFERENCE / INTERSECTION) ---
function setDifference(setA, setB) {
    if (!setA) return new Set();
    if (!setB) return new Set(setA);
    if (typeof setA.difference === 'function') {
        return setA.difference(setB);
    }
    const diff = new Set();
    for (const elem of setA) {
        if (!setB.has(elem)) diff.add(elem);
    }
    return diff;
}
window.setDifference = setDifference;
if (typeof globalThis !== 'undefined') globalThis.setDifference = setDifference;

// --- КОПИРОВАНИЕ В БУФЕР ОБМЕНА (ЕДИНЫЙ НАТИВНЫЙ ASYNC CLIPBOARD API) ---
async function copyToClipboard(text, successMsg = 'Скопировано в буфер!', errorMsg = 'Ошибка копирования') {
    const str = String(text ?? '');
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            if (typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(str);
                if (successMsg) showToast(successMsg, 'success');
                return true;
            }
            if (typeof navigator.clipboard.write === 'function' && typeof ClipboardItem === 'function' && typeof Blob === 'function') {
                const item = new ClipboardItem({ 'text/plain': new Blob([str], { type: 'text/plain' }) });
                await navigator.clipboard.write([item]);
                if (successMsg) showToast(successMsg, 'success');
                return true;
            }
        }
    } catch (e) {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem === 'function' && typeof Blob === 'function') {
                const item = new ClipboardItem({ 'text/plain': new Blob([str], { type: 'text/plain' }) });
                await navigator.clipboard.write([item]);
                if (successMsg) showToast(successMsg, 'success');
                return true;
            }
        } catch (err) {}
    }
    if (errorMsg) showToast(errorMsg, 'error');
    return false;
}
window.copyToClipboard = copyToClipboard;
if (typeof globalThis !== 'undefined') globalThis.copyToClipboard = copyToClipboard;

async function shareContent({ title = '', text = '', url = '', fallbackMsg = '' } = {}) {
    const targetUrl = url || (typeof window !== 'undefined' && window.location ? window.location.href : '');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
            await navigator.share({
                title,
                text,
                url: targetUrl
            });
            return true;
        } catch (err) {
            if (err && err.name === 'AbortError') {
                return false; // Пользователь сам закрыл системный диалог
            }
        }
    }
    const defaultSuccess = typeof i18next !== 'undefined'
        ? i18next.t('messages.link_copied', { defaultValue: 'Ссылка скопирована!' })
        : 'Ссылка скопирована!';
    return copyToClipboard(targetUrl, fallbackMsg || defaultSuccess);
}
window.shareContent = shareContent;
if (typeof globalThis !== 'undefined') globalThis.shareContent = shareContent;

function sanitizeText(value) {
    if (value == null) return '';
    const str = String(value);
    if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
        return DOMPurify.sanitize(str);
    }
    return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
window.sanitizeText = sanitizeText;
if (typeof globalThis !== 'undefined') globalThis.sanitizeText = sanitizeText;

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

// --- ЕДИНЫЙ БЕЗОПАСНЫЙ ХЕЛПЕР LOCALSTORAGE & SESSIONSTORAGE (storage.getJSON / storage.setJSON) ---
const _memStorageFallback = {};
const _memSessionFallback = {};

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

function getSessionStore() {
    try {
        if (typeof window !== 'undefined' && window.sessionStorage && typeof window.sessionStorage.getItem === 'function') {
            return window.sessionStorage;
        }
        if (typeof sessionStorage !== 'undefined' && sessionStorage && typeof sessionStorage.getItem === 'function') {
            return sessionStorage;
        }
    } catch (e) {}
    return null;
}

const storage = {
    getJSON(key, defaultValue = null) {
        try {
            const store = getLocalStore();
            let raw = null;
            try {
                raw = store ? store.getItem(key) : null;
            } catch (readErr) {
                raw = null;
            }
            if (raw === null || raw === undefined || raw === '') {
                raw = _memStorageFallback[key];
            }
            if (raw === null || raw === undefined || raw === '') {
                return defaultValue;
            }
            const parsed = JSON.parse(raw);
            return parsed !== null && parsed !== undefined ? parsed : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },

    setJSON(key, value) {
        const jsonStr = JSON.stringify(value);
        const store = getLocalStore();
        if (!store) {
            _memStorageFallback[key] = jsonStr;
            return true;
        }
        try {
            store.setItem(key, jsonStr);
            delete _memStorageFallback[key];
            return true;
        } catch (e) {
            try {
                if (typeof cleanStorageLimits === 'function') cleanStorageLimits();
                store.setItem(key, jsonStr);
                delete _memStorageFallback[key];
                return true;
            } catch (retryErr) {
                _memStorageFallback[key] = jsonStr;
                return false;
            }
        }
    },

    get(key, defaultValue = null) {
        try {
            const store = getLocalStore();
            let val = null;
            try {
                val = store ? store.getItem(key) : null;
            } catch (readErr) {
                val = null;
            }
            if (val !== null && val !== undefined) return val;
            return _memStorageFallback[key] !== undefined ? _memStorageFallback[key] : defaultValue;
        } catch (e) {
            return _memStorageFallback[key] !== undefined ? _memStorageFallback[key] : defaultValue;
        }
    },

    set(key, value) {
        const valStr = String(value);
        const store = getLocalStore();
        if (!store) {
            _memStorageFallback[key] = valStr;
            return true;
        }
        try {
            store.setItem(key, valStr);
            delete _memStorageFallback[key];
            return true;
        } catch (e) {
            try {
                if (typeof cleanStorageLimits === 'function') cleanStorageLimits();
                store.setItem(key, valStr);
                delete _memStorageFallback[key];
                return true;
            } catch (retryErr) {
                _memStorageFallback[key] = valStr;
                return false;
            }
        }
    },

    remove(key) {
        delete _memStorageFallback[key];
        try {
            const store = getLocalStore();
            if (store) store.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    },

    has(key) {
        try {
            const store = getLocalStore();
            let hasInStore = false;
            try {
                hasInStore = !!(store && store.getItem(key) !== null);
            } catch (readErr) {
                hasInStore = false;
            }
            if (hasInStore) return true;
            return _memStorageFallback[key] !== undefined;
        } catch (e) {
            return _memStorageFallback[key] !== undefined;
        }
    },

    clear() {
        for (const k in _memStorageFallback) delete _memStorageFallback[k];
        try {
            const store = getLocalStore();
            if (store) store.clear();
            return true;
        } catch (e) {
            return false;
        }
    },

    session: {
        getJSON(key, defaultValue = null) {
            try {
                const store = getSessionStore();
                let raw = null;
                try {
                    raw = store ? store.getItem(key) : null;
                } catch (readErr) {
                    raw = null;
                }
                if (raw === null || raw === undefined || raw === '') {
                    raw = _memSessionFallback[key];
                }
                if (raw === null || raw === undefined || raw === '') {
                    return defaultValue;
                }
                const parsed = JSON.parse(raw);
                return parsed !== null && parsed !== undefined ? parsed : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        },

        setJSON(key, value) {
            try {
                const jsonStr = JSON.stringify(value);
                const store = getSessionStore();
                if (!store) {
                    _memSessionFallback[key] = jsonStr;
                    return true;
                }
                try {
                    store.setItem(key, jsonStr);
                    delete _memSessionFallback[key];
                    return true;
                } catch (e) {
                    _memSessionFallback[key] = jsonStr;
                    return false;
                }
            } catch (err) {
                return false;
            }
        },

        get(key, defaultValue = null) {
            try {
                const store = getSessionStore();
                let val = null;
                try {
                    val = store ? store.getItem(key) : null;
                } catch (readErr) {
                    val = null;
                }
                if (val !== null && val !== undefined) return val;
                return _memSessionFallback[key] !== undefined ? _memSessionFallback[key] : defaultValue;
            } catch (e) {
                return _memSessionFallback[key] !== undefined ? _memSessionFallback[key] : defaultValue;
            }
        },

        set(key, value) {
            try {
                const valStr = String(value);
                const store = getSessionStore();
                if (!store) {
                    _memSessionFallback[key] = valStr;
                    return true;
                }
                try {
                    store.setItem(key, valStr);
                    delete _memSessionFallback[key];
                    return true;
                } catch (e) {
                    _memSessionFallback[key] = valStr;
                    return false;
                }
            } catch (err) {
                return false;
            }
        },

        remove(key) {
            delete _memSessionFallback[key];
            try {
                const store = getSessionStore();
                if (store) store.removeItem(key);
                return true;
            } catch (e) {
                return false;
            }
        },

        has(key) {
            try {
                const store = getSessionStore();
                let hasInStore = false;
                try {
                    hasInStore = !!(store && store.getItem(key) !== null);
                } catch (readErr) {
                    hasInStore = false;
                }
                if (hasInStore) return true;
                return _memSessionFallback[key] !== undefined;
            } catch (e) {
                return _memSessionFallback[key] !== undefined;
            }
        },

        clear() {
            for (const k in _memSessionFallback) delete _memSessionFallback[k];
            try {
                const store = getSessionStore();
                if (store) store.clear();
                return true;
            } catch (e) {
                return false;
            }
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
            storage.setJSON('nisha_history', hist.slice(0, 30));
        }

        // 2. Ограничение просмотренных ID вещей (до 200 штук)
        const seen = storage.getJSON('nisha_seen_items', null);
        if (Array.isArray(seen) && seen.length > 200) {
            storage.setJSON('nisha_seen_items', seen.slice(-200));
        }

        // 3. Ограничение истории поиска (до 15 запросов)
        const searches = storage.getJSON('nisha_search_history', null) || storage.getJSON('nisha_recent_searches', null);
        if (Array.isArray(searches) && searches.length > 15) {
            storage.setJSON('nisha_search_history', searches.slice(0, 15));
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
function safeSetItem(key, value) {
    return storage.set(key, value);
}
window.safeSetItem = safeSetItem;

function safeGetItem(key, fallback = null) {
    return storage.get(key, fallback);
}
window.safeGetItem = safeGetItem;

function safeRemoveItem(key) {
    return storage.remove(key);
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
            const getFallbackMap = (storageInstance) => {
                try {
                    if (typeof sessionStorage !== 'undefined' && storageInstance === sessionStorage) {
                        return _memSessionFallback;
                    }
                } catch (e) {}
                return _memStorageFallback;
            };
            const originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                const fbMap = getFallbackMap(this);
                try {
                    originalSetItem.call(this, key, value);
                    if (fbMap[key] !== undefined) delete fbMap[key];
                } catch (err) {
                    try {
                        if (typeof localStorage !== 'undefined' && this === localStorage && typeof cleanStorageLimits === 'function') {
                            cleanStorageLimits();
                        }
                        originalSetItem.call(this, key, value);
                        if (fbMap[key] !== undefined) delete fbMap[key];
                    } catch (retryErr) {
                        fbMap[key] = String(value);
                    }
                }
            };
            const originalGetItem = Storage.prototype.getItem;
            Storage.prototype.getItem = function(key) {
                const fbMap = getFallbackMap(this);
                try {
                    const res = originalGetItem.call(this, key);
                    if (res !== null) return res;
                    return fbMap[key] !== undefined ? fbMap[key] : null;
                } catch (err) {
                    return fbMap[key] !== undefined ? fbMap[key] : null;
                }
            };
            const originalRemoveItem = Storage.prototype.removeItem;
            if (typeof originalRemoveItem === 'function') {
                Storage.prototype.removeItem = function(key) {
                    const fbMap = getFallbackMap(this);
                    delete fbMap[key];
                    try {
                        originalRemoveItem.call(this, key);
                    } catch (err) {}
                };
            }
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
            return window.PhotoSwipeLightbox;
        } catch (e) {
            console.warn('[PhotoSwipe] Local module load failed, attempting CDN fallback:', e);
            try {
                if (typeof loadExternalStyle === 'function') {
                    loadExternalStyle('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.css');
                }
                const [mod, pswpMod] = await Promise.all([
                    import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe-lightbox.esm.min.js'),
                    import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.esm.min.js')
                ]);
                window.PhotoSwipeLightbox = mod.default || mod.PhotoSwipeLightbox || mod;
                window.PhotoSwipe = pswpMod.default || pswpMod.PhotoSwipe || pswpMod;
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
                    req.onsuccess = () => {
                        const db = req.result;
                        db.onclose = () => { _dbPromise = null; };
                        db.onversionchange = () => {
                            try { db.close(); } catch (e) {}
                            _dbPromise = null;
                        };
                        resolve(db);
                    };
                    req.onerror = () => {
                        console.warn('[IDB] Failed to open IndexedDB:', req.error);
                        _dbPromise = null;
                        resolve(null);
                    };
                } catch (e) {
                    _dbPromise = null;
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
                try {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    tx.onerror = () => resolve(null);
                    tx.onabort = () => resolve(null);
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(key);
                    req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
                    req.onerror = () => resolve(null);
                } catch (txErr) {
                    _dbPromise = null;
                    resolve(null);
                }
            });
        } catch (e) {
            _dbPromise = null;
            return null;
        }
    };

    window.idbSet = async function(key, val) {
        try {
            const db = await getDB();
            if (!db) return false;
            return new Promise((resolve) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                    tx.onabort = () => resolve(false);
                    const store = tx.objectStore(STORE_NAME);
                    store.put(val, key);
                } catch (txErr) {
                    _dbPromise = null;
                    resolve(false);
                }
            });
        } catch (e) {
            _dbPromise = null;
            return false;
        }
    };

    window.idbDel = async function(key) {
        try {
            const db = await getDB();
            if (!db) return false;
            return new Promise((resolve) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                    tx.onabort = () => resolve(false);
                    const store = tx.objectStore(STORE_NAME);
                    store.delete(key);
                } catch (txErr) {
                    _dbPromise = null;
                    resolve(false);
                }
            });
        } catch (e) {
            _dbPromise = null;
            return false;
        }
    };
})();

// Парсинг адреса доставки (город и отделение/поштомат) без разрыва названий по запятым
function parseDeliveryAddress(addr) {
    if (!addr || typeof addr !== 'string') return { city: '', branch: '' };
    const str = addr.trim();
    if (!str) return { city: '', branch: '' };

    // 1. Ищем маркеры отделения/почтомата
    const markerMatch = str.match(/,\s*(відділення|поштомат|пункт|склад|отделение|почтомат)\b/i);
    if (markerMatch && markerMatch.index !== undefined) {
        const cityPart = str.slice(0, markerMatch.index).trim();
        const branchPart = str.slice(markerMatch.index).replace(/^,\s*/, '').trim();
        return { city: cityPart, branch: branchPart };
    }

    // 2. Если маркеров нет, делим по запятым с учетом области/района
    const parts = str.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) {
        return { city: str, branch: '' };
    }
    if (parts.length === 2) {
        return { city: parts[0], branch: parts[1] };
    }
    // Если 3 или более частей, проверяем, является ли 2-я часть областью/районом
    if (/обл|район|р-н/i.test(parts[1])) {
        const cityPart = `${parts[0]}, ${parts[1]}`;
        const branchPart = parts.slice(2).join(', ');
        return { city: cityPart, branch: branchPart };
    }
    return {
        city: parts[0],
        branch: parts.slice(1).join(', ')
    };
}
window.parseDeliveryAddress = parseDeliveryAddress;

// ==========================================
// GLOBAL EVENT DELEGATION (data-action / data-hover-action)
// ==========================================
function handleDelegatedAction(e) {
    if (!e || !e.target || typeof e.target.closest !== 'function') return;
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl.disabled || (typeof actionEl.hasAttribute === 'function' && actionEl.hasAttribute('disabled'))) return;

    // ЗАЩИТА ОТ КЛИК-СКВОЗЬ (GHOST CLICKS / CLICK BLEED-THROUGH):
    // Если на странице открыто или анимирует закрытие модальное окно, блокируем клики по фоновым элементам
    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
        const hasActiveModal = Array.from(document.querySelectorAll('.modal-overlay')).some(m => {
            if (!m) return false;
            if (m.classList && typeof m.classList.contains === 'function' && m.classList.contains('closing')) return true;
            const disp = m.style ? (m.style.display || '') : '';
            return disp === 'flex' || disp === 'block';
        });
        const successOverlay = typeof document.getElementById === 'function' ? document.getElementById('orderSuccessOverlay') : null;
        const isSuccessActive = successOverlay && (successOverlay.style ? (successOverlay.style.display === 'flex' || successOverlay.style.display === 'block') : false);
        const emailPrompt = typeof document.getElementById === 'function' ? document.getElementById('emailPromptOverlay') : null;
        const isEmailPromptActive = emailPrompt && (emailPrompt.style ? (emailPrompt.style.display === 'flex' || emailPrompt.style.display === 'block') : false);
        const isShieldActive = isSuccessActive || isEmailPromptActive;
        if (hasActiveModal || isShieldActive) {
            const parentModal = actionEl.closest('.modal-overlay');
            if (!parentModal || (parentModal.classList && typeof parentModal.classList.contains === 'function' && parentModal.classList.contains('closing')) || isShieldActive) {
                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                return;
            }
        }
    }

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
            const dir = Number.parseInt(actionEl.getAttribute('data-dir'), 10) || 1;
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
            const dir = Number.parseInt(actionEl.getAttribute('data-dir'), 10);
            if (!Number.isNaN(dir) && typeof window.changePage === 'function') {
                window.changePage(dir);
            }
            break;
        }
        case 'remove-from-cart': {
            const idx = Number.parseInt(actionEl.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx) && typeof window.removeFromCart === 'function') {
                const rowEl = typeof actionEl.closest === 'function' ? actionEl.closest('.cart-item-row') : null;
                window.removeFromCart(idx, e, rowEl);
            }
            break;
        }
        case 'clear-search-history': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            storage.remove('nisha_search_history');
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
            const idx = Number.parseInt(actionEl.getAttribute('data-index'), 10);
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
        case 'toggle-profile-delivery': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const isModal = actionEl.getAttribute('data-modal') === '1';
            if (typeof window.toggleProfileDeliveryAccordion === 'function') {
                window.toggleProfileDeliveryAccordion(isModal, actionEl);
            }
            break;
        }
        case 'save-profile-delivery': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const isModal = actionEl.getAttribute('data-modal') === '1';
            if (typeof window.saveProfileDeliveryFromForm === 'function') {
                window.saveProfileDeliveryFromForm(isModal, actionEl);
            }
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
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
            const modalId = actionEl.getAttribute('data-modal-id');
            if (modalId && typeof window.closeModal === 'function') window.closeModal(modalId, e);
            break;
        }
        case 'delete-proposal-photo': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
            const idx = Number.parseInt(actionEl.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx) && typeof window.removeProposalFile === 'function') {
                window.removeProposalFile(idx, actionEl);
            }
            break;
        }
        case 'preview-proposal-photo': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
            const idx = Number.parseInt(actionEl.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx) && typeof window.openProposalPhotoByIndex === 'function') {
                window.openProposalPhotoByIndex(idx, actionEl);
            }
            break;
        }
        case 'trigger-prop-files': {
            // Защита: если клик пришелся на фото-превью или кнопку удаления — проводник НЕ открывать
            if (e.target && typeof e.target.closest === 'function') {
                if (e.target.closest('.preview-img') || e.target.closest('.preview-del-btn') || e.target.closest('[data-action="delete-proposal-photo"]') || e.target.closest('[data-action="preview-proposal-photo"]')) {
                    break;
                }
            }
            const filesCount = (window.currentProposalFiles && window.currentProposalFiles.length) || 0;
            if (filesCount >= 5) {
                if (typeof showToast === 'function') {
                    showToast(typeof i18next !== 'undefined' ? i18next.t('messages.prop_max_files', { defaultValue: 'Максимум 5 фото/видео!' }) : 'Максимум 5 фото/видео!', 'error');
                }
                break;
            }
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
    document.addEventListener('scroll', handleDelegatedScroll, { capture: true, passive: true });

    document.addEventListener('mouseover', (e) => {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const hoverEl = e.target.closest('[data-hover-action]');
        if (!hoverEl) return;
        if (e.relatedTarget && typeof hoverEl.contains === 'function' && hoverEl.contains(e.relatedTarget)) return;

        const hoverAction = hoverEl.getAttribute('data-hover-action');
        if (hoverAction === 'preload-grid-slide') {
            const id = hoverEl.getAttribute('data-id');
            const dir = Number.parseInt(hoverEl.getAttribute('data-dir'), 10) || 1;
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

// ==========================================
// FULL NAME AUTO-CAPITALIZATION (ФИО / ПІБ)
// ==========================================
function formatFullNameWords(val) {
    if (!val || typeof val !== 'string') return '';
    const cleaned = val.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '');
    return cleaned.replace(/(^|[\s\-])([a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ])/g, (match, sep, char) => {
        return sep + char.toUpperCase();
    });
}
window.formatFullNameWords = formatFullNameWords;

function normalizeFullNameOnBlur(val) {
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
window.normalizeFullNameOnBlur = normalizeFullNameOnBlur;

function attachFullNameAutoCapitalize(input) {
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
window.attachFullNameAutoCapitalize = attachFullNameAutoCapitalize;
