// ==========================================
// NISHA CORE HELPERS (Утилиты, тосты, вибрация)
// ==========================================

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

function showToast(message, type = 'success', imgUrl = null) {
    const now = Date.now();
    if (message === lastToastMsg && (now - lastToastTime < 2500)) return;
    lastToastMsg = message;
    lastToastTime = now;
    
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
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
        if(container.contains(toast)) container.removeChild(toast); 
    }, 3000);
}
window.showToast = showToast;

// --- ТЕРМИНАЛЬНЫЕ ОКНА ДЛЯ УВЕДОМЛЕНИЙ (ОДНОКНОПОЧНЫЕ) ---
function showTerminalModal(title, htmlText, btnText, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'terminal-modal-overlay';
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 10000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;";
    
    overlay.innerHTML = `
        <div class="success-terminal-box">
            <div class="success-title typewriter">${title}</div>
            <div class="success-divider"></div>
            <div class="success-text" style="margin-bottom: 20px; color: #ddd; text-align: left;">${htmlText}</div>
            <button class="cart-checkout-btn btn-target" style="width: 100%; padding: 15px;">${btnText}</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const btn = overlay.querySelector('button');
    btn.addEventListener('click', () => {
        overlay.remove();
        if (callback) callback();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            if (callback) callback();
        }
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

// --- КОПИРОВАНИЕ В БУФЕР ОБМЕНА ---
function copyToClipboard(text, successMsg = 'Скопировано в буфер!', errorMsg = 'Ошибка копирования') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text)
            .then(() => {
                showToast(successMsg, 'success');
                return true;
            })
            .catch(() => {
                showToast(errorMsg, 'error');
                return false;
            });
    } else {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast(successMsg, 'success');
            return Promise.resolve(true);
        } catch(e) {
            showToast(errorMsg, 'error');
            return Promise.resolve(false);
        }
    }
}
window.copyToClipboard = copyToClipboard;

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

// --- САМООЧИСТКА И ЛИМИТЫ ПАМЯТИ (LOCALSTORAGE GARBAGE COLLECTOR) ---
function cleanStorageLimits() {
    try {
        // 1. Ограничение истории просмотров (до 30 товаров)
        const histRaw = localStorage.getItem('nisha_history');
        if (histRaw) {
            const hist = JSON.parse(histRaw);
            if (Array.isArray(hist) && hist.length > 30) {
                localStorage.setItem('nisha_history', JSON.stringify(hist.slice(0, 30)));
            }
        }

        // 2. Ограничение просмотренных ID вещей (до 200 штук)
        const seenRaw = localStorage.getItem('nisha_seen_items');
        if (seenRaw) {
            const seen = JSON.parse(seenRaw);
            if (Array.isArray(seen) && seen.length > 200) {
                localStorage.setItem('nisha_seen_items', JSON.stringify(seen.slice(-200)));
            }
        }

        // 3. Ограничение истории поиска (до 15 запросов)
        const searchRaw = localStorage.getItem('nisha_search_history') || localStorage.getItem('nisha_recent_searches');
        if (searchRaw) {
            const searches = JSON.parse(searchRaw);
            if (Array.isArray(searches) && searches.length > 15) {
                localStorage.setItem('nisha_search_history', JSON.stringify(searches.slice(0, 15)));
            }
        }
        localStorage.removeItem('nisha_recent_searches');
    } catch(e) {
        console.warn('Storage cleanup notice:', e);
    }
}
window.cleanStorageLimits = cleanStorageLimits;

// --- БЕЗОПАСНАЯ РАБОТА С ХРАНИЛИЩЕМ (SAFARI PRIVATE & QUOTA PROTECTION) ---
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        try {
            cleanStorageLimits();
            localStorage.setItem(key, value);
            return true;
        } catch (innerErr) {
            console.warn(`[STORAGE] Не удалось записать ключ ${key}:`, innerErr);
            return false;
        }
    }
}
window.safeSetItem = safeSetItem;

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
            if (typeof loadExternalStyle === 'function') {
                loadExternalStyle('https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/photoswipe.css');
            }
            const mod = await import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/photoswipe-lightbox.esm.min.js');
            window.PhotoSwipeLightbox = mod.default || mod.PhotoSwipeLightbox;
            if (!window.pswpLightbox && window.PhotoSwipeLightbox) {
                window.pswpLightbox = new window.PhotoSwipeLightbox({
                    gallery: '#sliderWrapper',
                    children: 'a.slide',
                    showHideAnimationType: 'fade',
                    zoomAnimationDuration: 200,
                    bgOpacity: 0.9,
                    closeOnVerticalDrag: true,
                    wheelToZoom: true,
                    pswpModule: () => import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/photoswipe.esm.min.js')
                });
                window.pswpLightbox.init();
            }
            return window.PhotoSwipeLightbox;
        } catch (e) {
            console.error('[PhotoSwipe] Lazy load failed:', e);
            _photoSwipeInitPromise = null;
            return null;
        }
    })();
    return _photoSwipeInitPromise;
}
window.ensurePhotoSwipe = ensurePhotoSwipe;
