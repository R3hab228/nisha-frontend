// ==========================================
// NISHA CORE HELPERS: TOASTS, BUTTON BUSY GUARD & TERMINAL MODALS
// ==========================================

import { hasAction, invokeAction, registerActions } from './action-registry.js';
import { escapeAttr, escapeHtml, toCDN } from './helpers-security-media.js';
import { tSafe } from './runtime-env.js';
import {
    showTerminalModal,
    showConfirmTerminalModal,
    showPromptTerminalModal
} from './helpers-terminal-modals.js';

export {
    showTerminalModal,
    showConfirmTerminalModal,
    showPromptTerminalModal
};

function triggerToastSound(actionName, ...args) {
    const res = invokeAction(actionName, ...args);
    if (res && typeof res.catch === 'function') {
        res.catch(() => {});
    }
}

let lastToastTime = 0;
let activeToastState = null;

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
    dismiss.reset = () => {
        if (isDismissed || isPaused) return;
        remainingMs = duration;
        scheduleDismiss();
    };
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
    if (typeof toast.addEventListener !== 'function') return;
    toast.addEventListener('click', (e) => {
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
    });
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
    const rawMsgStr = String(message ?? '');

    if (
        activeToastState &&
        activeToastState.message === rawMsgStr &&
        activeToastState.type === type &&
        activeToastState.toast &&
        activeToastState.toast.parentNode &&
        !(activeToastState.toast.classList && typeof activeToastState.toast.classList.contains === 'function' && activeToastState.toast.classList.contains('toast-leaving')) &&
        (now - lastToastTime < 2500)
    ) {
        lastToastTime = now;
        activeToastState.count += 1;
        if (activeToastState.msgEl) {
            activeToastState.msgEl.innerHTML = `<span class="toast-repeat-badge" style="color:var(--accent-yellow,#ffd700);font-weight:bold;margin-right:6px">x${activeToastState.count}</span>${activeToastState.safeMsgHtml}`;
        }
        if (activeToastState.dismiss && typeof activeToastState.dismiss.reset === 'function') {
            activeToastState.dismiss.reset();
        }
        return;
    }
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
    const safeMsgHtml = (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function')
        ? window.DOMPurify.sanitize(rawMsgStr)
        : escapeHtml(rawMsgStr).replace(/\bon\w+\s*=/gi, 'data-blocked=');
    html += `<div class="toast-msg-body">${safeMsgHtml}</div>`;

    toast.innerHTML = html;
    container.appendChild(toast);
    if (type === 'error') {
        triggerToastSound('playSound', 'chord', { kind: 'alert' });
    } else {
        triggerToastSound('playNotifySound', { kind: 'toast' });
    }
    const msgEl = (typeof toast.querySelector === 'function') ? toast.querySelector('.toast-msg-body') : null;
    const currentState = { message: rawMsgStr, type, count: 1, toast, msgEl, safeMsgHtml, dismiss: null };
    const dismiss = attachToastLifecycle(toast, {
        duration: 2500,
        onDismiss: () => {
            if (activeToastState === currentState) activeToastState = null;
        }
    });
    currentState.dismiss = dismiss;
    activeToastState = currentState;
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
 * @param {{ slot?: string, className: string, tagText: string, titleText?: string, imgUrl?: string|null, duration?: number, onClick?: Function|null, sound?: string }} opts
 */
export function showCompactToast({ slot, className, tagText, titleText = '', imgUrl = null, duration = 2500, onClick = null, sound = '' }) {
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
    if (sound !== 'silent') {
        const resolvedSound = sound || (isAlert ? 'chord' : 'notify');
        const resolvedKind = resolvedSound === 'chord' ? 'alert' : 'toast';
        triggerToastSound('playSound', resolvedSound, { kind: resolvedKind });
    }

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
    const tagText = tSafe(isAdded ? 'messages.fav_add' : 'messages.fav_remove', {
        defaultValue: isAdded ? 'Добавлено в избранное' : 'Удалено из избранного'
    });

    showCompactToast({
        slot: 'fav',
        className: `toast-fav-item${isAdded ? '' : ' toast-fav-removed'}`,
        tagText,
        titleText: extractCompactItemTitle(itemOrTitle),
        imgUrl,
        sound: isAdded ? 'ding' : 'start'
    });
}
if (typeof window !== 'undefined') window.showFavoriteToast = showFavoriteToast;

/**
 * Shows compact language switched notification toast.
 * @param {string} langCode
 */
export function showLanguageToast(langCode) {
    const normalized = String(langCode || 'ua').trim().toUpperCase();
    const titleText = tSafe('messages.lang_changed', { defaultValue: 'Язык изменен' });

    showCompactToast({
        slot: 'lang',
        className: 'toast-lang-item',
        tagText: `LANG [${normalized}]`,
        titleText
    });
}
if (typeof window !== 'undefined') window.showLanguageToast = showLanguageToast;

/**
 * Shows compact sound toggle notification toast matching compact language/fav toast sizing.
 * @param {boolean} enabled
 */
export function showSoundToast(enabled) {
    const isOn = Boolean(enabled);
    const hasI18n = typeof i18next !== 'undefined' && typeof i18next.t === 'function';
    const rawLang = (hasI18n && (i18next.resolvedLanguage || i18next.language))
        || (typeof localStorage !== 'undefined' ? (localStorage.getItem('nisha_lang') || '') : '')
        || 'ua';
    const lang = String(rawLang).toLowerCase().slice(0, 2);

    const fallbackTag = lang === 'ru'
        ? (isOn ? 'ВКЛ' : 'ВЫКЛ')
        : (lang === 'en' ? (isOn ? 'ON' : 'OFF') : (isOn ? 'УВІМК' : 'ВИМК'));
    const fallbackTitle = lang === 'ru'
        ? (isOn ? 'Звук включен' : 'Звук выключен')
        : (lang === 'en' ? (isOn ? 'Sound enabled' : 'Sound disabled') : (isOn ? 'Звук увімкнено' : 'Звук вимкнено'));

    const tagState = hasI18n
        ? i18next.t(isOn ? 'profile.sound_on' : 'profile.sound_off', { defaultValue: fallbackTag })
        : fallbackTag;
    const titleText = hasI18n
        ? i18next.t(isOn ? 'messages.sound_enabled' : 'messages.sound_disabled', { defaultValue: fallbackTitle })
        : fallbackTitle;

    showCompactToast({
        slot: 'sound',
        className: isOn ? 'toast-sound-item' : 'toast-sound-item toast-sound-off',
        tagText: `SFX [${String(tagState).toUpperCase()}]`,
        titleText,
        sound: isOn ? 'ding' : 'silent'
    });
}
if (typeof window !== 'undefined') window.showSoundToast = showSoundToast;

/**
 * Shows compact cart add/remove notification toast.
 * @param {Object|string} itemOrTitle
 * @param {boolean} [isAdded=true]
 * @param {string|null} [imgUrl=null]
 */
export function showCartToast(itemOrTitle, isAdded = true, imgUrl = null) {
    const rawTag = tSafe(isAdded ? 'messages.cart_add' : 'messages.cart_delete', {
        defaultValue: isAdded ? 'Добавлено в корзину!' : 'Удалено'
    });

    showCompactToast({
        slot: 'cart',
        className: `toast-cart-item${isAdded ? '' : ' toast-cart-removed'}`,
        tagText: String(rawTag).replace(/[:\s]+$/, ''),
        titleText: extractCompactItemTitle(itemOrTitle),
        imgUrl,
        sound: isAdded ? 'ding' : 'recycle'
    });
}
if (typeof window !== 'undefined') window.showCartToast = showCartToast;

/**
 * Shows compact sale alert toast with optional product deep-link click action.
 * @param {Object|string} itemOrTitle
 * @param {string|null} [imgUrl=null]
 */
export function showSaleToast(itemOrTitle, imgUrl = null) {
    const rawTag = tSafe('messages.sale_prefix', { defaultValue: '🔥 СКИДКА' });
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

/**
 * Resolves CLDR plural category ('one' | 'few' | 'many') for ru/uk/en counts.
 * @param {number} count
 * @param {string} [lang='ru']
 * @returns {'one'|'few'|'many'}
 */
export function getPluralCategory(count, lang = 'ru') {
    const n = Math.abs(Math.trunc(Number(count) || 0));
    const normLang = String(lang || 'ru').toLowerCase().slice(0, 2);

    if (normLang === 'en') {
        return n === 1 ? 'one' : 'many';
    }

    const intlLocale = normLang === 'ua' ? 'uk' : normLang;
    if (typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
        try {
            const cat = new Intl.PluralRules(intlLocale).select(n);
            if (cat === 'one' || cat === 'few' || cat === 'many') return cat;
        } catch {}
    }

    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
    return 'many';
}

/**
 * Formats localized new-items count toast text with accurate pluralization.
 * @param {number} count
 * @returns {string}
 */
export function formatNewItemsCountText(count) {
    const n = Math.max(0, Math.trunc(Number(count) || 0));
    const hasI18n = typeof i18next !== 'undefined' && typeof i18next.t === 'function';
    const lang = (hasI18n && (i18next.resolvedLanguage || i18next.language)) || 'ru';
    const form = getPluralCategory(n, lang);

    const ruFallbacks = {
        one: `+${n} новая вещь в каталоге`,
        few: `+${n} новые вещи в каталоге`,
        many: `+${n} новых вещей в каталоге`
    };

    if (!hasI18n) return ruFallbacks[form];
    return i18next.t(`messages.new_items_count_${form}`, {
        count: n,
        defaultValue: ruFallbacks[form]
    });
}

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
        titleText = formatNewItemsCountText(items.length);
    } else {
        const brandPart = firstItem.brand ? `${safeToastEscape(firstItem.brand)} — ` : '';
        const fallbackName = tSafe('messages.new_item_fallback', { defaultValue: 'Новая вещь' });
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
            <div class="toast-item-tag">${tSafe('messages.new_items_toast', { defaultValue: 'Новые Вещи!!!' })}</div>
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
    triggerToastSound('playNotifySound', { kind: 'toast' });
    timerId = setTimeout(() => dismiss(false), 3800);
    _activeUnifiedToast = { toast, dismiss };
}

registerActions({
    showToast,
    showFavoriteToast,
    showLanguageToast,
    showSoundToast,
    showCartToast,
    showSaleToast,
    showReviewToast,
    withButtonBusy,
    enqueueNewItemToast,
    showTerminalModal,
    showConfirmTerminalModal,
    showPromptTerminalModal,
    isToastClickShielded
});
