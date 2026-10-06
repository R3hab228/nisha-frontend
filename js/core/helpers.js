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
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(5px); z-index: 10000; display: flex; justify-content: center; align-items: center; flex-direction: column;";
    
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
}
window.showTerminalModal = showTerminalModal;

// --- ДВУХКНОПОЧНЫЙ ТЕРМИНАЛ ДЛЯ ПОДТВЕРЖДЕНИЙ (CONFIRM) ---
function showConfirmTerminalModal(title, htmlText, confirmBtnText, cancelBtnText, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(5px); z-index: 100000; display: flex; justify-content: center; align-items: center; flex-direction: column;";
    
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
