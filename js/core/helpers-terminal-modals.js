// ==========================================
// NISHA CORE HELPERS: TERMINAL MODALS (ALERT / CONFIRM / PROMPT)
// ==========================================

import { hasAction, invokeAction } from './action-registry.js';
import { escapeAttr, escapeHtml } from './helpers-security-media.js';

function sanitizeTerminalHtml(rawHtml) {
    const str = String(rawHtml ?? '');
    const dp = typeof window !== 'undefined' ? window.DOMPurify : (typeof globalThis !== 'undefined' ? globalThis.DOMPurify : null);
    if (dp && typeof dp.sanitize === 'function') {
        return dp.sanitize(str, {
            ADD_ATTR: ['target', 'rel', 'data-pswp-width', 'data-pswp-height', 'data-fallback-src', 'data-action', 'data-modal-id', 'loading', 'decoding']
        });
    }
    return str;
}

function dismissExistingOverlays(selector) {
    document.querySelectorAll(selector).forEach(el => {
        if (typeof el._nishaDismiss === 'function') {
            try { el._nishaDismiss(); } catch { el.remove(); }
            if (el.isConnected) el.remove();
        } else {
            el.remove();
        }
    });
}

/**
 * Displays a single-button terminal dialog overlay.
 * @param {string} title
 * @param {string} htmlText
 * @param {string} btnText
 * @param {Function} [callback]
 * @param {{ persistent?: boolean }} [options={}]
 */
export function showTerminalModal(title, htmlText, btnText, callback, options = {}) {
    if (!htmlText || htmlText === 'null' || (typeof htmlText === 'string' && !htmlText.trim())) {
        if (callback) callback();
        return;
    }
    if (typeof document === 'undefined') return;
    dismissExistingOverlays('.terminal-modal-overlay');

    const isPersistent = Boolean(options && options.persistent);
    const isMeasureModal = title && title.includes('MEASURE_SYSTEM');
    const titleClass = isMeasureModal ? 'success-title measure-sys-title' : 'success-title typewriter';
    const boxExtraClass = isMeasureModal ? 'measure-terminal-box' : '';

    const overlay = document.createElement('div');
    overlay.className = 'terminal-modal-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 10000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;';

    const safeTitle = escapeHtml(title ?? '');
    const safeHtml = sanitizeTerminalHtml(htmlText);
    const safeBtn = escapeHtml(btnText ?? '[ OK ]');

    overlay.innerHTML = `
        <div class="success-terminal-box ${boxExtraClass}">
            <div class="${titleClass}">${safeTitle}</div>
            <div class="success-divider"></div>
            <div class="success-text" style="margin-bottom: 20px; color: #ddd; text-align: left;">${safeHtml}</div>
            <button class="cart-checkout-btn btn-target" style="width: 100%; padding: 15px;">${safeBtn}</button>
        </div>
    `;

    document.body.appendChild(overlay);

    const btn = overlay.querySelector('.cart-checkout-btn') || overlay.querySelector('button');
    const modalCtrl = new AbortController();
    const closeOverlay = () => {
        modalCtrl.abort();
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        overlay.remove();
        if (callback) callback();
    };
    overlay._nishaPersistent = isPersistent;
    overlay._nishaDismiss = () => {
        if (!isPersistent && !(document.querySelector && document.querySelector('.pswp--open'))) {
            closeOverlay();
        }
    };

    const mediaTiles = overlay.querySelectorAll ? Array.from(overlay.querySelectorAll('.broadcast-media-item')) : [];
    if (mediaTiles.length > 0) {
        overlay.addEventListener('click', (e) => {
            const tile = e.target && typeof e.target.closest === 'function' ? e.target.closest('.broadcast-media-item') : null;
            if (!tile || !overlay.contains(tile)) return;
            e.preventDefault();
            e.stopPropagation();

            const items = mediaTiles.map((el) => {
                const imgEl = el.querySelector ? el.querySelector('img') : null;
                const parsedW = Number.parseInt(el.getAttribute('data-pswp-width') || (imgEl && imgEl.naturalWidth) || 0, 10);
                const parsedH = Number.parseInt(el.getAttribute('data-pswp-height') || (imgEl && imgEl.naturalHeight) || 0, 10);
                const src = el.getAttribute('href') || (imgEl && (imgEl.currentSrc || imgEl.src)) || '';
                const msrc = (imgEl && (imgEl.currentSrc || imgEl.src)) || src;
                return {
                    src,
                    msrc,
                    width: parsedW > 0 ? parsedW : 1200,
                    height: parsedH > 0 ? parsedH : 1200,
                    element: el
                };
            }).filter(it => Boolean(it.src));

            const clickedIdx = Math.max(0, mediaTiles.indexOf(tile));
            if (items.length === 0) return;
            if (hasAction('openPhotoSwipeGallery')) {
                invokeAction('openPhotoSwipeGallery', items, clickedIdx);
            } else if (typeof window !== 'undefined' && typeof window.openPhotoSwipeGallery === 'function') {
                window.openPhotoSwipeGallery(items, clickedIdx);
            }
        }, { signal: modalCtrl.signal });
    }

    if (btn) {
        btn.addEventListener('click', closeOverlay, { signal: modalCtrl.signal });
    }
    if (!isPersistent) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !(document.querySelector && document.querySelector('.pswp--open'))) {
                closeOverlay();
            }
        }, { signal: modalCtrl.signal });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !(document.querySelector && document.querySelector('.pswp--open'))) {
                closeOverlay();
            }
        }, { signal: modalCtrl.signal });
    }
}
if (typeof window !== 'undefined') window.showTerminalModal = showTerminalModal;

/**
 * Displays a two-button terminal confirmation overlay.
 * @param {string} title
 * @param {string} htmlText
 * @param {string} confirmBtnText
 * @param {string} cancelBtnText
 * @param {Function} [onConfirm]
 * @param {Function} [onCancel]
 */
export function showConfirmTerminalModal(title, htmlText, confirmBtnText, cancelBtnText, onConfirm, onCancel) {
    if (typeof document === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.className = 'terminal-modal-overlay confirm-modal-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 100000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;';

    const safeTitle = escapeHtml(title ?? '');
    const safeHtml = sanitizeTerminalHtml(htmlText);
    const safeConfirmBtn = escapeHtml(confirmBtnText ?? '[ OK ]');
    const safeCancelBtn = escapeHtml(cancelBtnText ?? '[ ОТМЕНА ]');

    overlay.innerHTML = `
        <div class="success-terminal-box" style="animation: none; transform: scale(1); opacity: 1;">
            <div class="success-title typewriter" style="color: var(--accent-yellow);">${safeTitle}</div>
            <div class="success-divider" style="background: repeating-linear-gradient(90deg, var(--accent-yellow), var(--accent-yellow) 5px, transparent 5px, transparent 10px);"></div>
            <div class="success-text" style="margin-bottom: 20px; color: #ddd; text-align: left;">${safeHtml}</div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="cart-checkout-btn btn-target confirm-yes" style="flex: 1 1 0; min-width: max-content; white-space: nowrap; padding-left: 12px; padding-right: 12px; background: var(--accent-red); border-color: var(--accent-red); color: #fff;">${safeConfirmBtn}</button>
                <button class="cart-checkout-btn btn-target confirm-no" style="flex: 1 1 0; min-width: max-content; white-space: nowrap; padding-left: 12px; padding-right: 12px; background: #333; border-color: #555; color: #fff;">${safeCancelBtn}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const confirmCtrl = new AbortController();
    let settled = false;
    const closeOverlay = (confirmed = false, dismissOptions = {}) => {
        if (settled) return;
        settled = true;
        confirmCtrl.abort();
        overlay.remove();
        if (confirmed) {
            if (onConfirm) onConfirm();
        } else if (onCancel) {
            onCancel(dismissOptions);
        }
    };
    overlay._nishaDismiss = (confirmed = false, dismissOptions = {}) => closeOverlay(Boolean(confirmed), dismissOptions);

    overlay.querySelector('.confirm-yes').addEventListener('click', () => closeOverlay(true), { signal: confirmCtrl.signal });
    overlay.querySelector('.confirm-no').addEventListener('click', () => closeOverlay(false), { signal: confirmCtrl.signal });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(false); }, { signal: confirmCtrl.signal });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(false); }, { signal: confirmCtrl.signal });
}
if (typeof window !== 'undefined') window.showConfirmTerminalModal = showConfirmTerminalModal;

/**
 * Displays a broadcast-styled terminal prompt modal with a text/email input.
 * Resolves to the entered string or `null` if dismissed/cancelled.
 * @param {{ title?: string, message?: string, placeholder?: string, defaultValue?: string, inputType?: string, confirmBtnText?: string, cancelBtnText?: string }} [options={}]
 * @returns {Promise<string|null>}
 */
export function showPromptTerminalModal({
    title = 'SYSTEM_INPUT.EXE',
    message = '',
    placeholder = '',
    defaultValue = '',
    inputType = 'text',
    confirmBtnText = '[ OK ]',
    cancelBtnText = '[ ОТМЕНА ]'
} = {}) {
    if (typeof document === 'undefined') return Promise.resolve(null);
    dismissExistingOverlays('.prompt-terminal-overlay');

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'bargain-broadcast-overlay terminal-modal-overlay prompt-terminal-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.58); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); z-index: 100000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;';

        const safeTitle = escapeHtml(title);
        const safeMsg = escapeHtml(message);
        const safePh = escapeAttr(placeholder);
        const safeDef = escapeAttr(defaultValue);
        const safeType = escapeAttr(inputType);
        const safeConfirm = escapeHtml(confirmBtnText);
        const safeCancel = escapeHtml(cancelBtnText);

        overlay.innerHTML = `
            <div class="success-terminal-box" style="animation: none; transform: scale(1); opacity: 1;">
                <div class="success-title typewriter">${safeTitle}</div>
                <div class="success-divider"></div>
                ${safeMsg ? `<div class="success-text" style="margin-bottom: 14px; color: #ddd; text-align: left;">${safeMsg}</div>` : ''}
                <input type="${safeType}" class="form-input prompt-terminal-input" value="${safeDef}" placeholder="${safePh}" autocomplete="email" style="margin-bottom: 16px;">
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button type="button" class="cart-checkout-btn btn-target prompt-confirm" style="flex: 1 1 0; min-width: max-content; white-space: nowrap; padding: 12px;">${safeConfirm}</button>
                    <button type="button" class="cart-checkout-btn btn-target prompt-cancel" style="flex: 1 1 0; min-width: max-content; white-space: nowrap; padding: 12px; background: #222; border-color: #555; color: #ccc;">${safeCancel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const inputEl = overlay.querySelector('.prompt-terminal-input');
        const ctrl = new AbortController();
        let settled = false;

        const finish = (value) => {
            if (settled) return;
            settled = true;
            ctrl.abort();
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            overlay.remove();
            resolve(value);
        };
        overlay._nishaDismiss = () => finish(null);

        overlay.querySelector('.prompt-confirm')?.addEventListener('click', () => finish(inputEl ? inputEl.value : ''), { signal: ctrl.signal });
        overlay.querySelector('.prompt-cancel')?.addEventListener('click', () => finish(null), { signal: ctrl.signal });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); }, { signal: ctrl.signal });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') finish(null);
        }, { signal: ctrl.signal });
        if (inputEl) {
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finish(inputEl.value);
                }
            }, { signal: ctrl.signal });
            setTimeout(() => {
                if (!settled && typeof inputEl.focus === 'function') inputEl.focus();
            }, 30);
        }
    });
}
if (typeof window !== 'undefined') window.showPromptTerminalModal = showPromptTerminalModal;
