// ==========================================
// NISHA CORE HELPERS: TOASTS, BUTTON BUSY GUARD & TERMINAL MODALS
// ==========================================

import { hasAction, invokeAction, registerActions } from './action-registry.js';
import { escapeAttr, escapeHtml, toCDN } from './helpers-security-media.js';

let lastToastMsg = '';
let lastToastTime = 0;

/**
 * Escapes toast message strings via HTML escaping.
 * @param {*} str
 * @returns {string}
 */
export function safeToastEscape(str) {
    return escapeHtml(str);
}

/**
 * Attaches hover/touch-pauseable auto-dismiss lifecycle onto a toast DOM element.
 * @param {HTMLElement} toast
 * @param {{ duration?: number, onDismiss?: Function|null }} [options={}]
 * @returns {Function} dismiss callback
 */
export function attachToastLifecycle(toast, { duration = 2500, onDismiss = null } = {}) {
    let isDismissed = false;
    let remainingMs = duration;
    let timerStartedAt = Date.now();
    let dismissTimerId = null;
    let isPaused = false;

    const dismiss = () => {
        if (isDismissed) return;
        isDismissed = true;
        isPaused = false;
        clearTimeout(dismissTimerId);
        dismissTimerId = null;
        if (typeof onDismiss === 'function') onDismiss();
        if (toast.classList) {
            if (typeof toast.classList.remove === 'function') toast.classList.remove('toast-paused');
            if (typeof toast.classList.add === 'function') toast.classList.add('toast-leaving');
        }
        setTimeout(() => {
            if (toast.parentNode && typeof toast.remove === 'function') toast.remove();
        }, 300);
    };

    const scheduleDismiss = () => {
        if (isDismissed || isPaused) return;
        clearTimeout(dismissTimerId);
        timerStartedAt = Date.now();
        dismissTimerId = setTimeout(dismiss, Math.max(0, remainingMs));
    };

    const pauseDismiss = () => {
        if (isDismissed || isPaused) return;
        isPaused = true;
        clearTimeout(dismissTimerId);
        dismissTimerId = null;
        remainingMs = Math.max(0, remainingMs - (Date.now() - timerStartedAt));
        if (toast.classList && typeof toast.classList.add === 'function') {
            toast.classList.add('toast-paused');
        }
    };

    const resumeDismiss = () => {
        if (isDismissed || !isPaused) return;
        isPaused = false;
        if (toast.classList && typeof toast.classList.remove === 'function') {
            toast.classList.remove('toast-paused');
        }
        scheduleDismiss();
    };

    if (typeof toast.addEventListener === 'function') {
        toast.addEventListener('mouseenter', pauseDismiss);
        toast.addEventListener('mouseleave', resumeDismiss);
        toast.addEventListener('touchstart', pauseDismiss, { passive: true });
        toast.addEventListener('touchend', resumeDismiss, { passive: true });
        toast.addEventListener('touchcancel', resumeDismiss, { passive: true });
    }

    scheduleDismiss();
    return dismiss;
}

const _toastClickShieldByDoc = new WeakMap();
let _fallbackToastClickShieldUntil = 0;

/**
 * Arms a temporary click shield after toast interaction to prevent ghost clicks underneath.
 * @param {number} [ms=420]
 */
export function armToastClickShield(ms = 420) {
    const until = Date.now() + ms;
    if (typeof document !== 'undefined' && document && typeof document === 'object') {
        const current = _toastClickShieldByDoc.get(document) || 0;
        _toastClickShieldByDoc.set(document, Math.max(current, until));
    } else {
        _fallbackToastClickShieldUntil = Math.max(_fallbackToastClickShieldUntil, until);
    }
}

/**
 * Checks whether the toast click shield is currently active.
 * @returns {boolean}
 */
export function isToastClickShielded() {
    if (typeof document !== 'undefined' && document && typeof document === 'object') {
        return Date.now() < (_toastClickShieldByDoc.get(document) || 0);
    }
    return Date.now() < _fallbackToastClickShieldUntil;
}

function buildToastThumbHtml(imgUrl, useCdn = false) {
    if (!imgUrl || typeof imgUrl !== 'string' || /^\s*javascript:/i.test(imgUrl)) {
        return '';
    }
    const resolved = useCdn ? toCDN(imgUrl) : imgUrl;
    const safeImgUrl = escapeAttr(resolved).replaceAll('(', '%28').replaceAll(')', '%29');
    return `<div class="toast-item-thumb" style="background-image: url('${safeImgUrl}');"></div>`;
}

function bindToastDismissClick(toast, onClick, dismiss, logError = false) {
    toast.onclick = (e) => {
        if (e) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        armToastClickShield();
        if (typeof onClick === 'function') {
            try {
                onClick();
            } catch (err) {
                if (logError) console.warn(err);
            }
        }
        dismiss();
    };
}

/**
 * Displays a notification toast with deduplication and XSS sanitization.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='success']
 * @param {string|null} [imgUrl=null]
 * @param {Function|null} [onClick=null]
 */
export function showToast(message, type = 'success', imgUrl = null, onClick = null) {
    const now = Date.now();
    if (message === lastToastMsg && (now - lastToastTime < 2500)) return;
    lastToastMsg = message;
    lastToastTime = now;

    if (typeof document === 'undefined') return;
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    if (typeof toast.setAttribute === 'function') {
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    }
    toast.style.cursor = 'pointer';
    toast.style.pointerEvents = 'auto';

    let html = buildToastThumbHtml(imgUrl, false);
    const rawMsgStr = String(message ?? '');
    const safeMsgHtml = (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function')
        ? window.DOMPurify.sanitize(rawMsgStr)
        : escapeHtml(rawMsgStr).replace(/\bon\w+\s*=/gi, 'data-blocked=');
    html += `<div>${safeMsgHtml}</div>`;

    toast.innerHTML = html;
    container.appendChild(toast);
    const dismiss = attachToastLifecycle(toast, { duration: 2500 });
    bindToastDismissClick(toast, onClick, dismiss, true);
}
if (typeof window !== 'undefined') window.showToast = showToast;

const _activeCompactToasts = new Map();

function extractCompactItemTitle(itemOrTitle) {
    if (itemOrTitle && typeof itemOrTitle === 'object') {
        const brand = itemOrTitle.brand ? `${String(itemOrTitle.brand).trim()} ` : '';
        const name = String(itemOrTitle.name || '').trim();
        return `${brand}${name}`.trim();
    }
    return typeof itemOrTitle === 'string' ? itemOrTitle.trim() : '';
}

/**
 * Renders a slot-deduplicated compact item/action toast notification.
 * @param {{ slot?: string, className: string, tagText: string, titleText?: string, imgUrl?: string|null, duration?: number, onClick?: Function|null }} opts
 */
export function showCompactToast({ slot, className, tagText, titleText = '', imgUrl = null, duration = 2500, onClick = null }) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('toastContainer');
    if (!container) return;

    if (slot) {
        const prev = _activeCompactToasts.get(slot);
        if (prev && prev.parentNode) prev.remove();
        _activeCompactToasts.delete(slot);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${className}`;
    const isAlert = /removed|error/i.test(className);
    if (typeof toast.setAttribute === 'function') {
        toast.setAttribute('role', isAlert ? 'alert' : 'status');
        toast.setAttribute('aria-live', isAlert ? 'assertive' : 'polite');
    }
    if (slot) _activeCompactToasts.set(slot, toast);

    let html = buildToastThumbHtml(imgUrl, true);
    html += `
        <div class="toast-item-content">
            <div class="toast-item-tag">${safeToastEscape(tagText)}</div>
            ${titleText ? `<div class="toast-item-title">${safeToastEscape(titleText)}</div>` : ''}
        </div>
    `;
    toast.innerHTML = html;
    container.appendChild(toast);

    const dismiss = attachToastLifecycle(toast, {
        duration,
        onDismiss: () => {
            if (slot && _activeCompactToasts.get(slot) === toast) _activeCompactToasts.delete(slot);
        }
    });

    bindToastDismissClick(toast, onClick, dismiss, false);
}

/**
 * Shows compact favorite add/remove notification toast.
 * @param {Object|string} itemOrTitle
 * @param {boolean} [isAdded=true]
 * @param {string|null} [imgUrl=null]
 */
export function showFavoriteToast(itemOrTitle, isAdded = true, imgUrl = null) {
    const tagText = typeof i18next !== 'undefined'
        ? i18next.t(isAdded ? 'messages.fav_add' : 'messages.fav_remove', {
            defaultValue: isAdded ? 'Добавлено в избранное' : 'Удалено из избранного'
        })
        : (isAdded ? 'Добавлено в избранное' : 'Удалено из избранного');

    showCompactToast({
        slot: 'fav',
        className: `toast-fav-item${isAdded ? '' : ' toast-fav-removed'}`,
        tagText,
        titleText: extractCompactItemTitle(itemOrTitle),
        imgUrl
    });
}
if (typeof window !== 'undefined') window.showFavoriteToast = showFavoriteToast;

/**
 * Shows compact language switched notification toast.
 * @param {string} langCode
 */
export function showLanguageToast(langCode) {
    const normalized = String(langCode || 'ua').trim().toUpperCase();
    const titleText = typeof i18next !== 'undefined'
        ? i18next.t('messages.lang_changed', { defaultValue: 'Язык изменен' })
        : 'Язык изменен';

    showCompactToast({
        slot: 'lang',
        className: 'toast-lang-item',
        tagText: `LANG [${normalized}]`,
        titleText
    });
}
if (typeof window !== 'undefined') window.showLanguageToast = showLanguageToast;

/**
 * Shows compact cart add/remove notification toast.
 * @param {Object|string} itemOrTitle
 * @param {boolean} [isAdded=true]
 * @param {string|null} [imgUrl=null]
 */
export function showCartToast(itemOrTitle, isAdded = true, imgUrl = null) {
    const rawTag = typeof i18next !== 'undefined'
        ? i18next.t(isAdded ? 'messages.cart_add' : 'messages.cart_delete', {
            defaultValue: isAdded ? 'Добавлено в корзину!' : 'Удалено'
        })
        : (isAdded ? 'Добавлено в корзину!' : 'Удалено');

    showCompactToast({
        slot: 'cart',
        className: `toast-cart-item${isAdded ? '' : ' toast-cart-removed'}`,
        tagText: String(rawTag).replace(/[:\s]+$/, ''),
        titleText: extractCompactItemTitle(itemOrTitle),
        imgUrl
    });
}
if (typeof window !== 'undefined') window.showCartToast = showCartToast;

/**
 * Shows compact sale alert toast with optional product deep-link click action.
 * @param {Object|string} itemOrTitle
 * @param {string|null} [imgUrl=null]
 */
export function showSaleToast(itemOrTitle, imgUrl = null) {
    const rawTag = typeof i18next !== 'undefined'
        ? i18next.t('messages.sale_prefix', { defaultValue: '🔥 СКИДКА' })
        : '🔥 СКИДКА';
    const thumbFallback = (itemOrTitle && typeof itemOrTitle === 'object')
        ? (itemOrTitle.thumbnails?.[0] || itemOrTitle.images?.[0] || null)
        : null;

    showCompactToast({
        slot: 'sale',
        className: 'toast-sale-item',
        tagText: String(rawTag).replace(/[:\s]+$/, ''),
        titleText: extractCompactItemTitle(itemOrTitle),
        imgUrl: imgUrl || thumbFallback,
        onClick: (itemOrTitle && typeof itemOrTitle === 'object' && itemOrTitle.id && hasAction('openProductModalById'))
            ? () => invokeAction('openProductModalById', itemOrTitle.id)
            : null
    });
}
if (typeof window !== 'undefined') window.showSaleToast = showSaleToast;

/**
 * Shows compact review feedback notification toast.
 * @param {string} tagText
 * @param {string} [titleText='']
 * @param {string|null} [imgUrl=null]
 * @param {Function|null} [onClick=null]
 */
export function showReviewToast(tagText, titleText = '', imgUrl = null, onClick = null) {
    showCompactToast({
        slot: 'review',
        className: 'toast-review-item',
        tagText: tagText || '⭐',
        titleText,
        imgUrl,
        onClick
    });
}
if (typeof window !== 'undefined') window.showReviewToast = showReviewToast;

/**
 * Prevents duplicate submits by toggling aria-busy / is-loading on a button during async execution.
 * @param {Element|string|null} btnOrSelector
 * @param {Function} asyncFn
 * @param {string} [loadingLabel='...']
 * @returns {Promise<*>}
 */
export async function withButtonBusy(btnOrSelector, asyncFn, loadingLabel = '...') {
    const btn = typeof btnOrSelector === 'string'
        ? (typeof document !== 'undefined' ? document.querySelector(btnOrSelector) : null)
        : btnOrSelector;
    if (!btn) return asyncFn();
    if (btn.dataset?.busy === '1' || btn.disabled) return undefined;

    const prevHtml = btn.innerHTML;
    const prevDisabled = Boolean(btn.disabled);
    if (btn.dataset) btn.dataset.busy = '1';
    btn.disabled = true;
    if (typeof btn.setAttribute === 'function') btn.setAttribute('aria-busy', 'true');
    if (btn.classList) btn.classList.add('is-loading');
    if (loadingLabel) btn.textContent = loadingLabel;

    try {
        return await asyncFn();
    } finally {
        if (btn.dataset) delete btn.dataset.busy;
        btn.disabled = prevDisabled;
        if (typeof btn.removeAttribute === 'function') btn.removeAttribute('aria-busy');
        if (btn.classList) btn.classList.remove('is-loading');
        btn.innerHTML = prevHtml;
    }
}
if (typeof window !== 'undefined') window.withButtonBusy = withButtonBusy;

// --- BATCHED NEW ITEMS TOAST QUEUE ---
let _batchedNewItemsList = [];
let _batchToastTimer = null;
let _activeUnifiedToast = null;

/**
 * Enqueues new realtime items and coalesces them into a unified toast banner.
 * @param {Object|Array<Object>} itemOrItems
 */
export function enqueueNewItemToast(itemOrItems) {
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
if (typeof window !== 'undefined') window.enqueueNewItemToast = enqueueNewItemToast;

function _displayUnifiedNewItemToast(items) {
    if (typeof document === 'undefined') return;
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
        const cdnImg = toCDN(imgUrl);
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

    bindToastDismissClick(toast, () => {
        if (isMulti) {
            if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else if (firstItem) {
            const openFn = (typeof window !== 'undefined' && typeof window.openProductModalById === 'function')
                ? window.openProductModalById
                : null;
            if (openFn) {
                try {
                    openFn(firstItem.id);
                } catch (err) {
                    console.warn('[TOAST] Error opening product modal:', err);
                }
            }
        }
    }, dismiss, false);

    container.appendChild(toast);
    timerId = setTimeout(() => dismiss(false), 3800);
    _activeUnifiedToast = { toast, dismiss };
}

/**
 * Displays a single-button terminal dialog overlay.
 * @param {string} title
 * @param {string} htmlText
 * @param {string} btnText
 * @param {Function} [callback]
 */
export function showTerminalModal(title, htmlText, btnText, callback) {
    if (!htmlText || htmlText === 'null' || (typeof htmlText === 'string' && !htmlText.trim())) {
        if (callback) callback();
        return;
    }
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.terminal-modal-overlay').forEach(el => el.remove());

    const isMeasureModal = title && title.includes('MEASURE_SYSTEM');
    const titleClass = isMeasureModal ? 'success-title measure-sys-title' : 'success-title typewriter';
    const boxExtraClass = isMeasureModal ? 'measure-terminal-box' : '';

    const overlay = document.createElement('div');
    overlay.className = 'terminal-modal-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 10000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;';

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
if (typeof window !== 'undefined') window.showTerminalModal = showTerminalModal;

/**
 * Displays a two-button terminal confirmation overlay.
 * @param {string} title
 * @param {string} htmlText
 * @param {string} confirmBtnText
 * @param {string} cancelBtnText
 * @param {Function} [onConfirm]
 */
export function showConfirmTerminalModal(title, htmlText, confirmBtnText, cancelBtnText, onConfirm) {
    if (typeof document === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.className = 'terminal-modal-overlay confirm-modal-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 100000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;';

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
if (typeof window !== 'undefined') window.showConfirmTerminalModal = showConfirmTerminalModal;

registerActions({
    showToast,
    showFavoriteToast,
    showLanguageToast,
    showCartToast,
    showSaleToast,
    showReviewToast,
    withButtonBusy,
    enqueueNewItemToast,
    showTerminalModal,
    showConfirmTerminalModal,
    isToastClickShielded
});
