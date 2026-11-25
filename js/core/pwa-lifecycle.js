// ==========================================
// NISHA PWA INSTALL PROMPT, BFCACHE, OFFLINE WIN95 & BATTERY ADAPTER
// ==========================================

import { invokeAction, registerActions } from './action-registry.js';
import { debugPwaLog } from './pwa-sw-versioning.js';
import { getRuntimeSupabase, getRuntimeOpenedItem, getRuntimeStorage, tSafe } from './runtime-env.js';

let deferredPrompt = null;
let lifecycleListenersBound = false;
const PWA_INSTALLED_KEY = 'nisha_pwa_installed';
const PWA_BROADCAST_DISMISSED_KEY = 'nisha_pwa_broadcast_dismissed_at';
const PWA_BROADCAST_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Checks synchronously whether the app is already running as or recorded as an installed PWA.
 * @returns {boolean}
 */
export function isPwaAlreadyInstalled() {
    if (typeof window === 'undefined') return false;
    try {
        if (window.navigator && window.navigator.standalone === true) return true;
        if (typeof window.matchMedia === 'function') {
            if (
                window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                window.matchMedia('(display-mode: minimal-ui)').matches
            ) {
                return true;
            }
        }
        if (typeof document !== 'undefined' && typeof document.referrer === 'string' && document.referrer.startsWith('android-app://')) {
            return true;
        }
        const store = getRuntimeStorage();
        if (store && store.get(PWA_INSTALLED_KEY) === '1') return true;
    } catch {}
    return false;
}

function markPwaInstalled() {
    try {
        const store = getRuntimeStorage();
        if (store) store.set(PWA_INSTALLED_KEY, '1');
        const btn = typeof document !== 'undefined' ? document.getElementById('installAppBtn') : null;
        if (btn) btn.style.display = 'none';
    } catch {}
}

async function detectPwaInstalledAsync() {
    if (isPwaAlreadyInstalled()) return true;
    if (typeof navigator !== 'undefined' && typeof navigator.getInstalledRelatedApps === 'function') {
        try {
            const related = await navigator.getInstalledRelatedApps();
            if (Array.isArray(related) && related.length > 0) {
                markPwaInstalled();
                return true;
            }
        } catch {}
    }
    return false;
}

function isIosSafariBrowser() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    const isIos = /iPad|iPhone|iPod/i.test(ua) || ((platform === 'MacIntel' || platform === 'macOS') && navigator.maxTouchPoints > 1);
    const isCriOS = /CriOS|FxiOS|EdgiOS/i.test(ua);
    return isIos && !isCriOS;
}

/**
 * Shows a broadcast-styled PWA install prompt after a successful order (or on manual footer button click),
 * strictly skipping if the PWA is already installed or recently dismissed.
 * @param {object} [options]
 * @param {boolean} [options.skipCooldown=false]
 * @returns {Promise<boolean>}
 */
export async function maybeShowPostOrderPwaBroadcast({ skipCooldown = false } = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    if (await detectPwaInstalledAsync()) return false;

    const store = getRuntimeStorage();
    if (store && !skipCooldown) {
        const dismissedAt = Number(store.get(PWA_BROADCAST_DISMISSED_KEY) || 0);
        if (dismissedAt && (Date.now() - dismissedAt) < PWA_BROADCAST_COOLDOWN_MS) {
            return false;
        }
    }

    const t = (key, fallback) => tSafe(key, { defaultValue: fallback });

    const title = t('footer.pwa_broadcast_title', 'SYSTEM_BROADCAST.MSG');

    if (deferredPrompt) {
        const desc = t(
            'footer.pwa_broadcast_desc',
            'Заказ принят! Установите приложение <b>NISHA</b> на главный экран, чтобы в 1 клик отслеживать <b>ТТН Новой Почты</b> и получать уведомления о статусе посылки.'
        );
        const installLabel = t('footer.pwa_broadcast_install', '⬇ УСТАНОВИТЬ');
        const laterLabel = t('footer.pwa_broadcast_later', 'ПОЗЖЕ');

        document.querySelectorAll('.terminal-modal-overlay').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'terminal-modal-overlay pwa-broadcast-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 10000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;';

        overlay.innerHTML = `
            <div class="success-terminal-box">
                <div class="success-title typewriter">${title}</div>
                <div class="success-divider"></div>
                <div class="success-text" style="margin-bottom: 20px; color: #ddd; text-align: left;">${desc}</div>
                <div style="display: flex; gap: 10px;">
                    <button type="button" class="cart-checkout-btn btn-target pwa-bc-install" style="flex: 2; padding: 14px;">${installLabel}</button>
                    <button type="button" class="cart-checkout-btn btn-target pwa-bc-later" style="flex: 1; padding: 14px; background: #222; border-color: #444; color: #aaa;">${laterLabel}</button>
                </div>
                <div class="pwa-bc-status" style="margin-top: 12px; font-family: var(--font-mono); font-size: 12px; color: var(--accent-green, #00ff00); min-height: 16px;"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        invokeAction('playNotifySound', { kind: 'broadcast' });

        const ctrl = new AbortController();
        let isInstalling = false;
        let isInstallDone = false;
        const closeOverlay = (markDismissed = false) => {
            ctrl.abort();
            overlay.remove();
            if (markDismissed && store) {
                store.set(PWA_BROADCAST_DISMISSED_KEY, String(Date.now()));
            }
        };

        const installBtnEl = overlay.querySelector('.pwa-bc-install');
        const laterBtnEl = overlay.querySelector('.pwa-bc-later');
        const statusEl = overlay.querySelector('.pwa-bc-status');

        installBtnEl.addEventListener('click', async () => {
            if (isInstalling) return;
            const promptEvent = deferredPrompt;
            if (!promptEvent) {
                closeOverlay(false);
                return;
            }
            isInstalling = true;

            const TOTAL_BARS = 14;
            const lockedHeight = installBtnEl.offsetHeight ? `${installBtnEl.offsetHeight}px` : '46px';
            installBtnEl.disabled = true;
            installBtnEl.style.height = lockedHeight;
            installBtnEl.style.background = '#050505';
            installBtnEl.style.borderStyle = 'inset';
            installBtnEl.style.borderColor = '#555';
            installBtnEl.style.padding = '5px';
            installBtnEl.style.display = 'flex';
            installBtnEl.style.alignItems = 'stretch';
            installBtnEl.style.gap = '3px';
            installBtnEl.style.cursor = 'default';
            installBtnEl.innerHTML = Array.from({ length: TOTAL_BARS }, () => (
                '<span class="pwa-bc-bar" style="flex:1;background:#141414;transition:background 0.12s ease,box-shadow 0.12s ease;"></span>'
            )).join('');

            if (laterBtnEl) {
                laterBtnEl.style.pointerEvents = 'none';
                laterBtnEl.style.opacity = '0.4';
            }

            const bars = Array.from(installBtnEl.querySelectorAll('.pwa-bc-bar'));
            let currentBars = 0;
            const setBars = (count) => {
                const target = Math.max(0, Math.min(TOTAL_BARS, count));
                for (let i = 0; i < bars.length; i++) {
                    if (i < target) {
                        bars[i].style.background = 'var(--accent-green, #00ff00)';
                        bars[i].style.boxShadow = '0 0 6px rgba(0, 255, 0, 0.55)';
                    } else {
                        bars[i].style.background = '#141414';
                        bars[i].style.boxShadow = 'none';
                    }
                }
                currentBars = target;
            };

            // Этап 1: ожидание подтверждения в системном диалоге
            setBars(2);
            let progressTimer = setInterval(() => {
                if (currentBars < 4) setBars(currentBars + 1);
            }, 220);

            try {
                promptEvent.prompt();
                const { outcome } = await promptEvent.userChoice;
                deferredPrompt = null;
                clearInterval(progressTimer);

                if (outcome === 'accepted') {
                    // Этап 2: реальная установка PWA и готовность Service Worker
                    setBars(Math.max(currentBars, 6));
                    let installCompleted = false;
                    const finishInstall = () => {
                        if (installCompleted) return;
                        installCompleted = true;
                        isInstallDone = true;
                        clearInterval(progressTimer);
                        setBars(TOTAL_BARS);
                        if (statusEl) {
                            statusEl.textContent = t('footer.pwa_broadcast_installed', 'PWA установлено');
                        }
                        if (laterBtnEl) {
                            laterBtnEl.textContent = t('footer.pwa_broadcast_close', 'ЗАКРЫТЬ');
                            laterBtnEl.style.pointerEvents = 'auto';
                            laterBtnEl.style.opacity = '1';
                            laterBtnEl.style.color = '#fff';
                            laterBtnEl.style.borderColor = '#777';
                        }
                        markPwaInstalled();
                        if (window.analytics && typeof window.analytics.track === 'function') {
                            window.analytics.track('PWA Installed', { source: 'post_order_broadcast' });
                        }
                        setTimeout(() => closeOverlay(false), 1500);
                    };

                    window.addEventListener('appinstalled', finishInstall, { once: true, signal: ctrl.signal });
                    if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.ready) {
                        navigator.serviceWorker.ready.then(() => {
                            setTimeout(finishInstall, 450);
                        }).catch(() => {});
                    }
                    progressTimer = setInterval(() => {
                        if (currentBars < TOTAL_BARS - 2) {
                            setBars(currentBars + 1);
                        }
                    }, 180);
                    setTimeout(finishInstall, 2200);
                } else {
                    closeOverlay(true);
                }
            } catch {
                clearInterval(progressTimer);
                closeOverlay(false);
            }
        }, { signal: ctrl.signal });

        laterBtnEl.addEventListener('click', () => {
            if (!isInstalling) closeOverlay(true);
            else if (isInstallDone) closeOverlay(false);
        }, { signal: ctrl.signal });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (!isInstalling) closeOverlay(true);
                else if (isInstallDone) closeOverlay(false);
            }
        }, { signal: ctrl.signal });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!isInstalling) closeOverlay(true);
                else if (isInstallDone) closeOverlay(false);
            }
        }, { signal: ctrl.signal });

        return true;
    }

    if (isIosSafariBrowser()) {
        const iosDesc = t(
            'footer.pwa_broadcast_ios_hint',
            'Заказ принят! Нажмите <b>«Поделиться»</b> (⬆️) внизу браузера → <b>«На экран „Домой“»</b>, чтобы в 1 клик отслеживать <b>ТТН Новой Почты</b>.'
        );
        const okLabel = t('footer.pwa_broadcast_ok', 'ПОНЯТНО');
        const markDismissed = () => {
            if (store) store.set(PWA_BROADCAST_DISMISSED_KEY, String(Date.now()));
        };
        if (typeof window.tryShowBroadcast === 'function') {
            window.tryShowBroadcast(title, iosDesc, okLabel, markDismissed);
            return true;
        }
        invokeAction('playNotifySound', { kind: 'broadcast' });
        invokeAction('showTerminalModal', title, iosDesc, okLabel, markDismissed);
        return true;
    }

    return false;
}

/**
 * Creates the retro Win95 Error_NISHA.exe offline screen DOM node.
 * @returns {HTMLDivElement}
 */
export function createNetErrorElement() {
    const wrapper = document.createElement('div');
    wrapper.id = 'win95-net-error';
    wrapper.style.cssText = 'display:none;justify-content:center;padding:50px 10px;width:100%;box-sizing:border-box';
    wrapper.innerHTML = `
<div style="background:#dfd8c1;border-top:2px solid #fff;border-left:2px solid #fff;border-right:2px solid #0a0a0a;border-bottom:2px solid #0a0a0a;padding:2px;width:100%;max-width:300px;box-shadow:4px 4px 0 rgba(0,0,0,.8)">
<div style="background:navy;color:#fff;font-family:Tahoma,sans-serif;font-weight:700;font-size:12px;padding:3px 5px;display:flex;justify-content:space-between;align-items:center">
<span>Error_NISHA.exe</span>
<div data-action="dismiss-net-error" style="background:silver;color:#000;border:1px solid #000;width:14px;height:14px;display:flex;justify-content:center;align-items:center;font-size:10px;cursor:pointer">X</div>
</div>
<div style="padding:20px;text-align:center;background:#dfd8c1">
<div style="height:60px;display:flex;align-items:center;justify-content:center;margin:0 auto">
<svg class="win95-pixel-cables" viewBox="0 0 57 32" width="114" height="64" shape-rendering="crispEdges" style="display:block;margin:0 auto;width:114px;height:auto;max-width:100%" xmlns="http://www.w3.org/2000/svg">
  <path fill="#c0d7e8" d="M24,1h1v1h-1z M23,2h1v1h-1z M25,2h1v1h-1z M33,2h1v1h-1z M22,3h1v1h-1z M26,3h1v1h-1z M29,3h1v1h-1z M31,4h1v1h-1z M26,5h1v1h-1z M26,6h1v1h-1z M37,13h1v1h-1z M38,14h1v1h-1z M14,15h1v1h-1z M17,15h1v1h-1z M42,15h1v1h-1z M16,16h1v1h-1z M42,16h1v1h-1z M13,18h1v1h-1z M12,19h1v1h-1z M29,19h1v1h-1z M44,19h1v1h-1z M19,21h1v1h-1z M28,22h1v1h-1z M43,22h1v1h-1z M28,23h1v1h-1z M17,24h1v1h-1z M28,24h1v1h-1z M31,24h1v1h-1z M56,24h1v1h-1z M30,25h1v1h-1z M48,25h6v1h-6z M0,26h1v1h-1z M56,26h1v1h-1z M42,27h1v1h-1z M56,27h1v1h-1z M56,28h1v1h-1z M12,29h1v1h-1z M46,29h1v1h-1z M56,29h1v1h-1z M10,30h1v1h-1z M51,30h4v1h-4z M1,31h8v1h-8z" />
  <path fill="#94b1c7" d="M31,1h1v1h-1z M22,2h1v1h-1z M24,2h1v1h-1z M32,2h1v1h-1z M32,3h1v1h-1z M23,4h1v1h-1z M26,4h1v1h-1z M29,5h2v1h-2z M25,6h1v1h-1z M38,11h1v1h-1z M17,12h1v1h-1z M33,12h1v1h-1z M36,12h2v1h-2z M39,12h1v1h-1z M16,13h1v1h-1z M18,13h1v1h-1z M38,13h1v1h-1z M40,13h1v1h-1z M15,14h1v1h-1z M17,14h2v1h-2z M37,14h1v1h-1z M39,14h1v1h-1z M15,15h2v1h-2z M18,15h1v1h-1z M38,15h2v1h-2z M17,16h1v1h-1z M39,16h2v1h-2z M16,17h2v1h-2z M31,17h1v1h-1z M40,17h1v1h-1z M42,17h1v1h-1z M15,18h1v1h-1z M32,18h1v1h-1z M41,18h1v1h-1z M43,18h1v1h-1z M15,19h1v1h-1z M23,19h1v1h-1z M28,19h1v1h-1z M12,20h1v1h-1z M14,20h1v1h-1z M22,20h1v1h-1z M29,20h1v1h-1z M36,20h1v1h-1z M42,20h1v1h-1z M11,21h1v1h-1z M13,21h2v1h-2z M20,21h1v1h-1z M29,21h1v1h-1z M42,21h2v1h-2z M46,21h1v1h-1z M10,22h1v1h-1z M13,22h1v1h-1z M18,22h1v1h-1z M30,22h1v1h-1z M38,22h1v1h-1z M44,22h1v1h-1z M8,23h2v1h-2z M12,23h2v1h-2z M31,23h1v1h-1z M44,23h2v1h-2z M0,24h1v1h-1z M2,24h6v1h-6z M10,24h2v1h-2z M39,24h1v1h-1z M45,24h3v1h-3z M0,25h1v1h-1z M8,25h3v1h-3z M16,25h1v1h-1z M28,25h1v1h-1z M40,25h1v1h-1z M54,25h2v1h-2z M1,26h8v1h-8z M41,26h1v1h-1z M0,27h1v1h-1z M0,28h1v1h-1z M44,28h1v1h-1z M0,29h1v1h-1z" />
  <path fill="#8ee0ff" d="M30,2h1v1h-1z M23,3h1v1h-1z M25,3h1v1h-1z M24,4h2v1h-2z M30,4h1v1h-1z M29,23h1v1h-1z M29,24h1v1h-1z" />
  <path fill="#3da3e8" d="M31,2h1v1h-1z M24,3h1v1h-1z M30,3h2v1h-2z M24,5h2v1h-2z M30,23h1v1h-1z M30,24h1v1h-1z" />
  <path fill="#d89c5e" d="M22,7h3v1h-3z M32,7h2v1h-2z M23,8h2v1h-2z M31,8h2v1h-2z M23,9h2v1h-2z M30,9h2v1h-2z M33,9h1v1h-1z M22,10h2v1h-2z M25,10h1v1h-1z M29,10h3v1h-3z M33,10h2v1h-2z M21,11h1v1h-1z M25,11h1v1h-1z M30,11h1v1h-1z M32,11h1v1h-1z M23,12h3v1h-3z M29,13h3v1h-3z M29,14h2v1h-2z M32,14h1v1h-1z M24,15h3v1h-3z M23,16h2v1h-2z M29,16h1v1h-1z M25,17h1v1h-1z" />
  <path fill="#8d5830" d="M22,8h1v1h-1z M33,8h1v1h-1z M21,9h2v1h-2z M34,9h1v1h-1z M21,10h1v1h-1z M35,10h1v1h-1z M22,12h1v1h-1z M31,12h1v1h-1z M22,13h2v1h-2z M32,13h1v1h-1z M23,15h1v1h-1z M30,15h2v1h-2z M26,16h1v1h-1z M30,16h1v1h-1z" />
  <path fill="#2c3b47" d="M34,8h1v1h-1z M35,9h1v1h-1z M20,10h1v1h-1z M21,12h1v1h-1z M32,12h1v1h-1z M35,12h1v1h-1z M21,13h1v1h-1z M23,14h1v1h-1z M21,15h1v1h-1z M33,15h2v1h-2z M31,16h4v1h-4z M22,17h2v1h-2z M34,17h1v1h-1z M21,18h1v1h-1z M33,18h1v1h-1z M18,19h3v1h-3z M36,19h1v1h-1z M38,19h1v1h-1z M17,20h1v1h-1z M39,20h1v1h-1z M38,21h1v1h-1z M40,21h1v1h-1z M39,22h1v1h-1z M40,24h1v1h-1z M42,24h1v1h-1z M14,25h1v1h-1z M41,25h1v1h-1z M43,25h1v1h-1z M13,26h1v1h-1z M42,26h1v1h-1z M11,27h1v1h-1z M43,27h2v1h-2z M47,27h1v1h-1z M9,28h1v1h-1z M12,28h1v1h-1z M45,28h11v1h-11z M1,29h4v1h-4z M6,29h1v1h-1z M8,29h1v1h-1z M47,29h1v1h-1z" />
  <path fill="#4c667a" d="M19,10h1v1h-1z M19,11h1v1h-1z M31,11h1v1h-1z M33,11h1v1h-1z M18,12h1v1h-1z M34,12h1v1h-1z M17,13h1v1h-1z M24,13h1v1h-1z M33,13h3v1h-3z M39,13h1v1h-1z M16,14h1v1h-1z M20,14h3v1h-3z M34,14h2v1h-2z M19,15h2v1h-2z M35,15h1v1h-1z M19,16h4v1h-4z M25,16h1v1h-1z M35,16h1v1h-1z M41,16h1v1h-1z M14,17h1v1h-1z M21,17h1v1h-1z M35,17h4v1h-4z M41,17h1v1h-1z M14,18h1v1h-1z M17,18h4v1h-4z M24,18h1v1h-1z M37,18h3v1h-3z M42,18h1v1h-1z M13,19h1v1h-1z M17,19h1v1h-1z M34,19h2v1h-2z M39,19h2v1h-2z M42,19h1v1h-1z M13,20h1v1h-1z M15,20h2v1h-2z M40,20h1v1h-1z M43,20h2v1h-2z M12,21h1v1h-1z M15,21h2v1h-2z M18,21h1v1h-1z M41,21h1v1h-1z M44,21h2v1h-2z M15,22h1v1h-1z M17,22h1v1h-1z M41,22h1v1h-1z M45,22h1v1h-1z M10,23h1v1h-1z M14,23h2v1h-2z M39,23h1v1h-1z M41,23h2v1h-2z M8,24h2v1h-2z M13,24h2v1h-2z M16,24h1v1h-1z M43,24h2v1h-2z M49,24h2v1h-2z M52,24h1v1h-1z M54,24h2v1h-2z M1,25h7v1h-7z M12,25h2v1h-2z M44,25h3v1h-3z M11,26h2v1h-2z M45,26h2v1h-2z M3,27h1v1h-1z M9,27h2v1h-2z M48,27h8v1h-8z M1,28h8v1h-8z M5,29h1v1h-1z M7,29h1v1h-1z M9,30h1v1h-1z" />
  <path fill="#fce0b6" d="M24,10h1v1h-1z M24,11h1v1h-1z M28,14h1v1h-1z M29,15h1v1h-1z" />
  <path fill="#000000" d="M36,10h1v1h-1z M34,11h2v1h-2z M20,13h1v1h-1z M33,14h1v1h-1z M22,15h1v1h-1z M24,17h1v1h-1z M32,17h2v1h-2z M22,18h2v1h-2z M34,18h3v1h-3z M21,19h2v1h-2z M37,19h1v1h-1z M18,20h3v1h-3z M38,20h1v1h-1z M17,21h1v1h-1z M39,21h1v1h-1z M16,22h1v1h-1z M40,22h1v1h-1z M16,23h1v1h-1z M40,23h1v1h-1z M15,24h1v1h-1z M41,24h1v1h-1z M15,25h1v1h-1z M42,25h1v1h-1z M14,26h1v1h-1z M43,26h2v1h-2z M12,27h2v1h-2z M45,27h2v1h-2z M10,28h2v1h-2z M9,29h3v1h-3z M48,29h8v1h-8z M1,30h8v1h-8z" />
  <path fill="#6e899e" d="M37,10h1v1h-1z M18,11h1v1h-1z M20,11h1v1h-1z M36,11h2v1h-2z M19,12h2v1h-2z M38,12h1v1h-1z M19,13h1v1h-1z M36,13h1v1h-1z M19,14h1v1h-1z M36,14h1v1h-1z M40,14h1v1h-1z M32,15h1v1h-1z M36,15h2v1h-2z M40,15h2v1h-2z M14,16h2v1h-2z M18,16h1v1h-1z M36,16h3v1h-3z M15,17h1v1h-1z M18,17h3v1h-3z M39,17h1v1h-1z M16,18h1v1h-1z M40,18h1v1h-1z M14,19h1v1h-1z M16,19h1v1h-1z M33,19h1v1h-1z M41,19h1v1h-1z M43,19h1v1h-1z M21,20h1v1h-1z M28,20h1v1h-1z M37,20h1v1h-1z M41,20h1v1h-1z M28,21h1v1h-1z M11,22h2v1h-2z M14,22h1v1h-1z M42,22h1v1h-1z M46,22h2v1h-2z M11,23h1v1h-1z M17,23h1v1h-1z M43,23h1v1h-1z M46,23h10v1h-10z M1,24h1v1h-1z M12,24h1v1h-1z M48,24h1v1h-1z M51,24h1v1h-1z M53,24h1v1h-1z M11,25h1v1h-1z M29,25h1v1h-1z M47,25h1v1h-1z M9,26h2v1h-2z M15,26h1v1h-1z M47,26h9v1h-9z M1,27h2v1h-2z M4,27h5v1h-5z M14,27h1v1h-1z M13,28h1v1h-1z M0,30h1v1h-1z" />
  <path fill="#1c5e96" d="M29,22h1v1h-1z" />
</svg>
</div>
<p id="win95-error-msg" data-i18n="pwa.offline_msg" style="color:#000;margin-top:15px;margin-bottom:0;font-family:Tahoma,sans-serif;font-size:13px;font-weight:normal">${tSafe('pwa.offline_msg', 'Соединение потеряно')}</p>
</div>
</div>`;
    return wrapper;
}

/**
 * Hides Win95 net-error box with fade-out and animates catalog grid restoration.
 * @param {HTMLElement|null} netError
 * @param {HTMLElement|null} grid
 */
function hideNetErrorAndRestoreGrid(netError, grid) {
    if (netError) {
        if (netError.style) netError.style.display = 'none';
        if (netError.classList) {
            netError.classList.remove('fade-out');
            netError.classList.remove('fade-in');
        }
    }
    if (grid) {
        if (grid.style) grid.style.display = '';
        if (grid.classList) {
            grid.classList.remove('fade-out');
            grid.classList.add('feed-restore-anim');
        }
        setTimeout(() => {
            if (grid && grid.classList) grid.classList.remove('feed-restore-anim');
        }, 700);
    }
}

/**
 * Displays sticky offline banner or Win95 offline window when browser loses network.
 */
export function handleNetworkOffline() {
    if (typeof document === 'undefined') return;
    const grid = document.getElementById('itemsGrid');
    const offlineBanner = document.getElementById('offlineStickyBanner');
    let netError = document.getElementById('win95-net-error');
    const loader = document.getElementById('win95-loader');

    if (loader) loader.style.display = 'none';

    const hasCards = grid && grid.querySelectorAll('.item-card:not(.skeleton-card)').length > 0;

    if (hasCards) {
        if (offlineBanner) {
            if (typeof i18next !== 'undefined') {
                offlineBanner.textContent = i18next.t('checkout.offline_banner');
            }
            offlineBanner.classList.add('active');
        }
    } else {
        if (grid) grid.classList.add('fade-out');

        setTimeout(() => {
            if (grid) {
                grid.style.display = 'none';
                grid.classList.remove('fade-out');
                grid.classList.remove('feed-restore-anim');
            }

            if (!netError && grid && grid.parentElement) {
                netError = createNetErrorElement();
                grid.before(netError);
            }

            if (netError) {
                const msgEl = document.getElementById('win95-error-msg') || (netError.querySelector && netError.querySelector('#win95-error-msg'));
                if (msgEl) {
                    msgEl.textContent = tSafe('pwa.offline_msg', 'Соединение потеряно');
                    msgEl.style.color = '#000';
                    msgEl.style.fontFamily = 'Tahoma, sans-serif';
                    msgEl.style.fontSize = '13px';
                    msgEl.style.fontWeight = 'normal';
                }
                netError.classList.remove('fade-out');
                netError.classList.add('fade-in');
                netError.style.display = 'flex';
            }
            if (typeof window !== 'undefined' && window.scrollY > 150) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 280);
    }
    if (typeof triggerHaptic === 'function') triggerHaptic('error');
}

/**
 * Restores online catalog feed, hides offline indicators, and resyncs session/cart.
 */
export function handleNetworkOnline() {
    if (typeof document === 'undefined') return;
    const offlineBanner = document.getElementById('offlineStickyBanner');
    if (offlineBanner && offlineBanner.classList.contains('active')) {
        offlineBanner.classList.remove('active');
    }

    const netError = document.getElementById('win95-net-error');
    const msgEl = document.getElementById('win95-error-msg');
    const grid = document.getElementById('itemsGrid');

    if (msgEl) {
        msgEl.textContent = tSafe('pwa.online_msg', 'Соединение восстановлено!!!');
        msgEl.style.color = '#008000';
        msgEl.style.fontFamily = 'Tahoma, sans-serif';
        msgEl.style.fontSize = '13px';
        msgEl.style.fontWeight = 'normal';
    }
    if (typeof triggerHaptic === 'function') triggerHaptic('success');

    setTimeout(() => {
        if (netError && netError.style && netError.style.display !== 'none') {
            netError.classList.remove('fade-in');
            netError.classList.add('fade-out');
        }

        setTimeout(async () => {
            hideNetErrorAndRestoreGrid(netError, grid);
            if (grid && typeof loadAllItems === 'function') {
                loadAllItems();
            }
            if (typeof checkSession === 'function') checkSession();
            if (typeof updateCartUI === 'function') updateCartUI();
        }, 280);
    }, 850);
}

/**
 * Dismisses the Win95 offline modal manually and restores catalog grid.
 */
export function dismissNetError() {
    if (typeof document === 'undefined') return;
    const netError = document.getElementById('win95-net-error');
    const grid = document.getElementById('itemsGrid');
    if (netError && netError.classList) {
        netError.classList.remove('fade-in');
        netError.classList.add('fade-out');
    }
    setTimeout(() => {
        hideNetErrorAndRestoreGrid(netError, grid);
    }, 280);
}

/**
 * Initializes install button prompt, tab visibility sync, BFCache handlers, network events, and battery adapter.
 */
export function initPwaLifecycle() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    window.handleNetworkOffline = handleNetworkOffline;
    window.handleNetworkOnline = handleNetworkOnline;

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn && isPwaAlreadyInstalled()) {
        installBtn.style.display = 'none';
    }
    if (installBtn && !installBtn._pwaInstallBound) {
        installBtn._pwaInstallBound = true;
        installBtn.addEventListener('click', () => {
            maybeShowPostOrderPwaBroadcast({ skipCooldown: true });
        });
    }

    if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
        navigator.getBattery().then(battery => {
            const checkBattery = () => {
                if (!battery.charging && battery.level <= 0.20) {
                    document.documentElement.classList.add('low-power-mode');
                } else if (battery.charging || battery.level > 0.25) {
                    document.documentElement.classList.remove('low-power-mode');
                }
            };
            checkBattery();
            battery.addEventListener('levelchange', checkBattery);
            battery.addEventListener('chargingchange', checkBattery);
        }).catch(() => {});
    }

    if (lifecycleListenersBound || typeof window.addEventListener !== 'function') return;
    lifecycleListenersBound = true;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        if (isPwaAlreadyInstalled()) {
            deferredPrompt = null;
            return;
        }
        deferredPrompt = e;
        const btn = document.getElementById('installAppBtn');
        if (btn) btn.style.display = 'block';
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        markPwaInstalled();
        debugPwaLog('PWA установлено (appinstalled)');
    });

    if (typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden) {
                document.title = 'Zzz... | NISHA';
            } else {
                const activeItem = getRuntimeOpenedItem();
                if (activeItem) {
                    document.title = `NISHA | ${activeItem.brand} - ${activeItem.name}`;
                } else {
                    document.title = 'NISHA | Underground Store';
                }
                const sb = getRuntimeSupabase();
                if (sb && typeof checkSession === 'function') {
                    await checkSession();
                }
            }
        });
    }

    window.addEventListener("pageshow", async (event) => {
        if (event.persisted) {
            console.info('[BFCache] Страница мгновенно восстановлена из памяти браузера (0ms Instant Load)');

            try { invokeAction('updateCartUI'); } catch {}
            try { invokeAction('updateAppBadge'); } catch {}
            try { invokeAction('renderFavoritesMarkers'); } catch {}

            const spinner = document.getElementById('loadingSpinner') || (document.querySelector && document.querySelector('.global-loading'));
            if (spinner) spinner.style.display = 'none';

            try { invokeAction('initLeaderElection'); } catch {}
            try { invokeAction('initCatalogRealtimeSubscription'); } catch {}
            try { invokeAction('syncCriticalStatuses'); } catch {}

            const activeItem = getRuntimeOpenedItem();
            if (activeItem) {
                try { await invokeAction('checkItemAvailability', activeItem.id); } catch {}
            }
        }
    }, { passive: true });

    window.addEventListener("pagehide", (event) => {
        if (event.persisted && document.querySelectorAll) {
            document.querySelectorAll('video').forEach(video => {
                try { video.pause(); } catch {}
            });
        }
    }, { passive: true });

    window.addEventListener('offline', handleNetworkOffline);
    window.addEventListener('online', handleNetworkOnline);
}

registerActions({
    dismissNetError,
    'dismiss-net-error': dismissNetError,
    isPwaAlreadyInstalled,
    maybeShowPostOrderPwaBroadcast
});
