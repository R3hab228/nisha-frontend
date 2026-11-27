// @ts-check
// ==========================================
// NISHA CORE HELPERS: NETWORK MODE, PWA BADGING, HAPTICS, POPOVER, SHARE & VIEW TRANSITIONS
// ==========================================

import { registerActions } from './action-registry.js';
import { showToast } from './helpers-toasts-modals.js';

/**
 * Detects whether client has Data Saver enabled or is on a 2G/constrained network.
 * @returns {boolean}
 */
export function isSaveDataMode() {
    if (typeof navigator === 'undefined') return false;
    const nav = /** @type {any} */ (navigator);
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (!conn) return false;
    if (conn.saveData === true) return true;
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return true;
    return false;
}
if (typeof window !== 'undefined') window.isSaveDataMode = isSaveDataMode;

/**
 * Automatically attaches or updates save-data CSS class on document element.
 */
export function initNetworkAwareRendering() {
    if (typeof document === 'undefined' || typeof navigator === 'undefined') return;
    const update = () => {
        const active = isSaveDataMode();
        if (active) {
            if (document.documentElement.classList && typeof document.documentElement.classList.add === 'function') {
                document.documentElement.classList.add('save-data-active');
            }
            if (typeof document.documentElement.setAttribute === 'function') {
                document.documentElement.setAttribute('data-save-data', 'true');
            }
        } else {
            if (document.documentElement.classList && typeof document.documentElement.classList.remove === 'function') {
                document.documentElement.classList.remove('save-data-active');
            }
            if (typeof document.documentElement.removeAttribute === 'function') {
                document.documentElement.removeAttribute('data-save-data');
            }
        }
    };
    update();
    const nav = /** @type {any} */ (navigator);
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn && typeof conn.addEventListener === 'function' && !conn._hasSaveDataListener) {
        conn.addEventListener('change', update, { passive: true });
        conn._hasSaveDataListener = true;
    }
}
if (typeof window !== 'undefined') window.initNetworkAwareRendering = initNetworkAwareRendering;

/**
 * Checks if browser supports the Badging API (PWA / Installed Desktop & Mobile).
 * @returns {boolean}
 */
export function isAppBadgingSupported() {
    return typeof navigator !== 'undefined' &&
        'setAppBadge' in navigator &&
        typeof navigator.setAppBadge === 'function';
}
if (typeof window !== 'undefined') window.isAppBadgingSupported = isAppBadgingSupported;

/**
 * Updates application icon badge in PWA / Installed Web App mode.
 * Synchronizes with total items in cart or clears badge if empty.
 * @param {number} [count]
 * @returns {Promise<boolean>}
 */
export async function updateAppBadge(count) {
    if (typeof navigator === 'undefined') return false;
    let badgeCount = count;
    if (typeof badgeCount !== 'number') {
        const cartList = (typeof window !== 'undefined' && window.cart)
            ? window.cart
            : (typeof cart !== 'undefined' ? cart : []);
        badgeCount = Array.isArray(cartList) ? cartList.length : 0;
    }
    badgeCount = Math.max(0, Math.floor(Number(badgeCount) || 0));

    try {
        if (badgeCount > 0) {
            if ('setAppBadge' in navigator && typeof navigator.setAppBadge === 'function') {
                await navigator.setAppBadge(badgeCount);
                return true;
            }
        } else {
            if ('clearAppBadge' in navigator && typeof navigator.clearAppBadge === 'function') {
                await navigator.clearAppBadge();
                return true;
            }
        }
    } catch {}
    return false;
}
if (typeof window !== 'undefined') window.updateAppBadge = updateAppBadge;

/**
 * Clears application icon badge.
 * @returns {Promise<boolean>}
 */
export async function clearAppBadge() {
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator && typeof navigator.clearAppBadge === 'function') {
        try {
            await navigator.clearAppBadge();
            return true;
        } catch {}
    }
    return false;
}
if (typeof window !== 'undefined') window.clearAppBadge = clearAppBadge;

// --- VIBRATION & HAPTIC FEEDBACK ---

/**
 * Triggers a simple device vibration pattern when supported.
 * @param {number|number[]} [duration=150]
 */
export function triggerVibration(duration = 150) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(duration); } catch {}
    }
}

/** @type {HTMLLabelElement | null} */
let _iosHapticLabel = null;
let _lastIosHapticAt = 0;

/**
 * Detects iOS / iPadOS touch devices where Web Vibration API is absent
 * and native Safari 17.4+ `<input type="checkbox" switch>` triggers Taptic Engine.
 * @returns {boolean}
 */
function isIosTouchDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = String(navigator.userAgent || '');
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1;
}

/**
 * Lazily creates an off-screen `<input type="checkbox" switch>` + `<label>` pair
 * with click propagation isolated so triggering iOS Taptic Engine never affects app click handlers.
 * @returns {HTMLLabelElement|null}
 */
function getOrCreateIosHapticLabel() {
    if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') {
        return null;
    }
    if (_iosHapticLabel && _iosHapticLabel.isConnected !== false) {
        return _iosHapticLabel;
    }
    const existingLabel = /** @type {HTMLLabelElement | null} */ (document.getElementById('nishaHapticSwitchLabel'));
    if (existingLabel) {
        _iosHapticLabel = existingLabel;
        return _iosHapticLabel;
    }

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'nishaHapticSwitch';
    input.setAttribute('switch', '');
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;
    input.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0.001;pointer-events:none;left:-9999px;top:-9999px;margin:0;padding:0;border:0;';

    const label = document.createElement('label');
    label.id = 'nishaHapticSwitchLabel';
    label.setAttribute('for', 'nishaHapticSwitch');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0.001;pointer-events:none;left:-9999px;top:-9999px;margin:0;padding:0;border:0;';

    /** @param {Event} e */
    const isolateEvent = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    };
    if (typeof input.addEventListener === 'function') {
        input.addEventListener('click', isolateEvent);
        input.addEventListener('change', isolateEvent);
    }
    if (typeof label.addEventListener === 'function') {
        label.addEventListener('click', isolateEvent);
    }

    document.body.appendChild(input);
    document.body.appendChild(label);
    _iosHapticLabel = label;
    return _iosHapticLabel;
}

/**
 * Fires native iOS Safari 17.4+ / iOS PWA Taptic Engine feedback via hidden switch label click.
 * @param {'selection'|'light'|'medium'|'heavy'|'success'|'warning'|'error'} type
 * @returns {boolean}
 */
function triggerIosSwitchHaptic(type) {
    if (!isIosTouchDevice()) return false;
    const now = Date.now();
    if (now - _lastIosHapticAt < 30 && (type === 'light' || type === 'selection')) {
        return false;
    }
    const label = getOrCreateIosHapticLabel();
    if (!label || typeof label.click !== 'function') return false;

    _lastIosHapticAt = now;
    try {
        label.click();
        if (type === 'success' || type === 'warning' || type === 'error') {
            setTimeout(() => {
                try {
                    if (label.isConnected !== false) label.click();
                } catch {}
            }, type === 'error' ? 60 : 75);
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Triggers Telegram WebApp HapticFeedback, Android Vibration API, or iOS 17.4+ Taptic Engine switch feedback.
 * @param {'selection'|'light'|'medium'|'heavy'|'success'|'warning'|'error'} [type='light']
 */
export function triggerHaptic(type = 'light') {
    try {
        const tgHaptic = (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp)
            ? window.Telegram.WebApp.HapticFeedback
            : null;
        if (tgHaptic) {
            if (type === 'success' || type === 'warning' || type === 'error') {
                if (typeof tgHaptic.notificationOccurred === 'function') {
                    tgHaptic.notificationOccurred(type);
                    return;
                }
            } else if (type === 'selection' && typeof tgHaptic.selectionChanged === 'function') {
                tgHaptic.selectionChanged();
                return;
            } else if (typeof tgHaptic.impactOccurred === 'function') {
                const style = type === 'heavy' ? 'heavy' : (type === 'medium' ? 'medium' : 'light');
                tgHaptic.impactOccurred(style);
                return;
            }
        }
    } catch {}

    if (typeof window === 'undefined' || window.innerWidth > 900) return;

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
            switch (type) {
                case 'selection': navigator.vibrate(10); break;
                case 'light': navigator.vibrate(25); break;
                case 'medium': navigator.vibrate(40); break;
                case 'heavy': navigator.vibrate(70); break;
                case 'success': navigator.vibrate([20, 60, 20]); break;
                case 'warning': navigator.vibrate([25, 45, 25]); break;
                case 'error': navigator.vibrate([30, 50, 30, 50, 30]); break;
                default: navigator.vibrate(20); break;
            }
        } catch {}
        return;
    }

    // Fallback for iOS 17.4+ Safari & iOS PWA where navigator.vibrate is unavailable
    triggerIosSwitchHaptic(type);
}
if (typeof window !== 'undefined') /** @type {any} */ (window).triggerHaptic = triggerHaptic;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).triggerHaptic = triggerHaptic;

// --- NATIVE POPOVER API & SCROLL-DRIVEN ANIMATIONS FACADE ---

/**
 * Checks if native HTML Popover API is supported.
 * @returns {boolean}
 */
export function isPopoverSupported() {
    return typeof HTMLElement !== 'undefined' &&
        typeof HTMLElement.prototype.showPopover === 'function' &&
        typeof HTMLElement.prototype.hidePopover === 'function';
}
if (typeof window !== 'undefined') window.isPopoverSupported = isPopoverSupported;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).isPopoverSupported = isPopoverSupported;

/**
 * Safely calls showPopover() on a `[popover]` element without throwing if already open.
 * @param {HTMLElement|null} element
 * @returns {boolean}
 */
export function showPopoverSafe(element) {
    if (!element) return false;
    if (typeof element.hasAttribute === 'function' && !element.hasAttribute('popover')) return false;
    if (typeof element.showPopover === 'function') {
        try {
            if (typeof element.matches === 'function' && element.matches(':popover-open')) {
                return true;
            }
            element.showPopover();
            return true;
        } catch (_) {
            return false;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.showPopoverSafe = showPopoverSafe;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).showPopoverSafe = showPopoverSafe;

/**
 * Safely calls hidePopover() on a `[popover]` element without throwing if already closed.
 * @param {HTMLElement|null} element
 * @returns {boolean}
 */
export function hidePopoverSafe(element) {
    if (!element) return false;
    if (typeof element.hasAttribute === 'function' && !element.hasAttribute('popover')) return false;
    if (typeof element.hidePopover === 'function') {
        try {
            if (typeof element.matches === 'function' && !element.matches(':popover-open')) {
                return false;
            }
            element.hidePopover();
            return true;
        } catch (_) {
            return false;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.hidePopoverSafe = hidePopoverSafe;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).hidePopoverSafe = hidePopoverSafe;

/**
 * Safely toggles a `[popover]` element.
 * @param {HTMLElement|null} element
 * @param {boolean} [force]
 * @returns {boolean}
 */
export function togglePopoverSafe(element, force) {
    if (!element) return false;
    if (typeof element.hasAttribute === 'function' && !element.hasAttribute('popover')) return false;
    if (typeof element.togglePopover === 'function') {
        try {
            return element.togglePopover(force);
        } catch (_) {
            return false;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.togglePopoverSafe = togglePopoverSafe;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).togglePopoverSafe = togglePopoverSafe;

/**
 * Checks whether a popover element is open natively or via legacy class/style fallback.
 * @param {HTMLElement|null} element
 * @returns {boolean}
 */
export function isPopoverOpenSafe(element) {
    if (!element) return false;
    try {
        if (typeof element.matches === 'function' && element.matches(':popover-open')) {
            return true;
        }
    } catch {}
    if (element.classList && (element.classList.contains('is-open') || element.classList.contains('active'))) {
        return true;
    }
    if (element.style && element.style.display && element.style.display !== 'none' && element.style.display !== '') {
        if (element.style.opacity !== '0' && element.style.visibility !== 'hidden') {
            return true;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.isPopoverOpenSafe = isPopoverOpenSafe;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).isPopoverOpenSafe = isPopoverOpenSafe;

/**
 * Checks CSS scroll-driven animation timeline support.
 * @returns {boolean}
 */
export function isScrollDrivenAnimationSupported() {
    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
        try {
            return CSS.supports('animation-timeline', 'scroll()') ||
                CSS.supports('animation-timeline', 'view()');
        } catch (_) {
            return false;
        }
    }
    return false;
}
if (typeof window !== 'undefined') window.isScrollDrivenAnimationSupported = isScrollDrivenAnimationSupported;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).isScrollDrivenAnimationSupported = isScrollDrivenAnimationSupported;

// --- CLIPBOARD & WEB SHARE API ---

/**
 * Copies text to clipboard using native Async Clipboard API with ClipboardItem fallback.
 * @param {*} text
 * @param {string} [successMsg='Скопировано в буфер!']
 * @param {string} [errorMsg='Ошибка копирования']
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text, successMsg = 'Скопировано в буфер!', errorMsg = 'Ошибка копирования') {
    const str = String(text ?? '');
    const writeViaClipboardItem = async () => {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem === 'function' && typeof Blob === 'function') {
            const item = new ClipboardItem({ 'text/plain': new Blob([str], { type: 'text/plain' }) });
            await navigator.clipboard.write([item]);
            if (successMsg) showToast(successMsg, 'success');
            return true;
        }
        return false;
    };

    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            if (typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(str);
                if (successMsg) showToast(successMsg, 'success');
                return true;
            }
            if (await writeViaClipboardItem()) return true;
        }
    } catch {
        try {
            if (await writeViaClipboardItem()) return true;
        } catch {}
    }
    if (errorMsg) showToast(errorMsg, 'error');
    return false;
}
if (typeof window !== 'undefined') window.copyToClipboard = copyToClipboard;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).copyToClipboard = copyToClipboard;

/**
 * Invokes navigator.share when supported, falling back to clipboard copy on unsupported environments.
 * @param {{ title?: string, text?: string, url?: string, fallbackMsg?: string }} [opts={}]
 * @returns {Promise<boolean>}
 */
export async function shareContent({ title = '', text = '', url = '', fallbackMsg = '' } = {}) {
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
            const errObj = /** @type {any} */ (err);
            if (errObj && errObj.name === 'AbortError') {
                return false;
            }
        }
    }
    const defaultSuccess = typeof i18next !== 'undefined'
        ? i18next.t('messages.link_copied', { defaultValue: 'Ссылка скопирована!' })
        : 'Ссылка скопирована!';
    return copyToClipboard(targetUrl, fallbackMsg || defaultSuccess);
}
if (typeof window !== 'undefined') window.shareContent = shareContent;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).shareContent = shareContent;

// ==========================================
// VIEW TRANSITIONS API WRAPPER
// ==========================================

/**
 * Detects expected abort/viewport errors thrown when View Transitions cancel mid-flight.
 * @param {*} err
 * @returns {boolean}
 */
export function isViewTransitionAbortError(err) {
    if (!err) return false;
    const msg = String(err.message || err.reason || err);
    const name = String(err.name || '');
    return (
        name === 'AbortError' ||
        name === 'InvalidStateError' ||
        /Transition was aborted/i.test(msg) ||
        /Viewport size changed/i.test(msg) ||
        /ViewTransition/i.test(msg)
    );
}
if (typeof window !== 'undefined') window.isViewTransitionAbortError = isViewTransitionAbortError;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).isViewTransitionAbortError = isViewTransitionAbortError;

/** @param {() => void | Promise<void>} updateFn */
function runViewTransitionFallback(updateFn) {
    try {
        const res = updateFn();
        const p = res instanceof Promise ? res : Promise.resolve(res);
        return {
            finished: p,
            ready: Promise.resolve(),
            updateCallbackDone: p,
            skipTransition: () => {}
        };
    } catch (err) {
        console.error('[ViewTransitions] updateFn failed in fallback:', err);
        return {
            finished: Promise.reject(err),
            ready: Promise.resolve(),
            updateCallbackDone: Promise.reject(err),
            skipTransition: () => {}
        };
    }
}

/**
 * Safely executes a DOM update callback using document.startViewTransition
 * when supported, respecting prefers-reduced-motion and absorbing expected mobile viewport aborts.
 *
 * @param {() => void | Promise<void>} updateFn
 * @returns {{ finished: Promise<*>, ready: Promise<*>, updateCallbackDone: Promise<*>, skipTransition: () => void }}
 */
export function safeViewTransition(updateFn) {
    if (typeof updateFn !== 'function') {
        return {
            finished: Promise.resolve(),
            ready: Promise.resolve(),
            updateCallbackDone: Promise.resolve(),
            skipTransition: () => {}
        };
    }

    const prefersReducedMotion = typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (
        typeof document !== 'undefined' &&
        typeof document.startViewTransition === 'function' &&
        !prefersReducedMotion
    ) {
        try {
            const transition = document.startViewTransition(updateFn);

            if (transition && typeof transition.ready?.catch === 'function') {
                const safeReady = transition.ready.catch((err) => {
                    if (isViewTransitionAbortError(err)) return;
                    throw err;
                });
                try {
                    Object.defineProperty(transition, 'ready', { value: safeReady, configurable: true, writable: true });
                } catch {}
            }

            if (transition && typeof transition.updateCallbackDone?.catch === 'function') {
                transition.updateCallbackDone.catch((err) => {
                    if (isViewTransitionAbortError(err)) return;
                });
            }

            if (transition && typeof transition.finished?.catch === 'function') {
                const safeFinished = transition.finished.catch((err) => {
                    if (isViewTransitionAbortError(err)) return;
                    throw err;
                });
                try {
                    Object.defineProperty(transition, 'finished', { value: safeFinished, configurable: true, writable: true });
                } catch {}
            }

            return transition;
        } catch (e) {
            console.warn('[ViewTransitions] startViewTransition failed, falling back:', e);
            return runViewTransitionFallback(updateFn);
        }
    }

    return runViewTransitionFallback(updateFn);
}
if (typeof window !== 'undefined') window.safeViewTransition = safeViewTransition;
if (typeof globalThis !== 'undefined') /** @type {any} */ (globalThis).safeViewTransition = safeViewTransition;

registerActions({
    isSaveDataMode,
    updateAppBadge,
    clearAppBadge,
    triggerVibration,
    triggerHaptic,
    isPopoverOpenSafe,
    showPopoverSafe,
    hidePopoverSafe,
    togglePopoverSafe,
    copyToClipboard,
    shareContent,
    safeViewTransition
});
