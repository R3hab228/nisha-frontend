// @ts-check
// ==========================================
// NISHA SUPPORT MODAL UI & BUG CONTEXT HELPERS
// ==========================================

import { invokeAction } from '../core/action-registry.js';
import { getLenisInstance } from '../core/runtime-env.js';

export const SUPPORT_MAX_LENGTH = 500;

export function resetSupportTopicChips() {
    const chips = document.querySelectorAll('#supportTopicChips .support-topic-chip');
    chips.forEach((chip) => {
        chip.classList.remove('active');
        chip.setAttribute('aria-pressed', 'false');
    });
}

/**
 * Toggles an active topic chip inside the support modal.
 * @param {HTMLElement | null} topicEl
 */
export function selectSupportTopic(topicEl) {
    if (!topicEl) return;
    const wasActive = topicEl.classList.contains('active');
    resetSupportTopicChips();
    if (!wasActive) {
        topicEl.classList.add('active');
        topicEl.setAttribute('aria-pressed', 'true');
    }
    const triggerHapticFn = /** @type {any} */ (globalThis).triggerHaptic;
    if (typeof triggerHapticFn === 'function') triggerHapticFn('light');
}

export function updateSupportCharCounter() {
    const input = /** @type {HTMLTextAreaElement | HTMLInputElement | null} */ (document.getElementById('supportInput'));
    const counter = document.getElementById('supportCharCounter');
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = `${len}/${SUPPORT_MAX_LENGTH}`;
    counter.classList.toggle('near-limit', len >= 450 && len < SUPPORT_MAX_LENGTH);
    counter.classList.toggle('at-limit', len >= SUPPORT_MAX_LENGTH);
}

/**
 * Collects lightweight device/language/URL diagnostics for bug report tickets.
 * @returns {{ device: string, lang: string, url: string } | null}
 */
export function collectSupportBugContext() {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;
    const ua = String(navigator.userAgent || '');
    let os = 'Desktop';
    if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/android/i.test(ua)) os = 'Android';
    const isStandalone = (typeof document !== 'undefined' && Boolean(document.documentElement?.classList.contains('pwa-standalone'))) ||
        Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    const device = `${os}${isStandalone ? ' (PWA)' : ''}`;
    const i18n = /** @type {any} */ (globalThis).i18next;
    const lang = (i18n && i18n.language)
        ? String(i18n.language).slice(0, 10)
        : String(document?.documentElement?.lang || 'ua').slice(0, 10);
    const url = `${window.location.pathname || '/'}${window.location.search || ''}`.slice(0, 300);
    return { device, lang, url };
}

export function openSupportModalWindow() {
    if (getLenisInstance()) invokeAction('stopLenis');
    const input = /** @type {(HTMLTextAreaElement | HTMLInputElement) & { _supportCounterBound?: boolean } | null} */ (
        document.getElementById('supportInput')
    );
    if (input) {
        input.value = '';
        if (!input._supportCounterBound) {
            input._supportCounterBound = true;
            input.addEventListener('input', updateSupportCharCounter);
        }
    }
    updateSupportCharCounter();
    resetSupportTopicChips();

    const openModalFn = /** @type {any} */ (globalThis).openModal;
    const triggerTypewriterFn = /** @type {any} */ (globalThis).triggerModalTypewriter;
    if (typeof openModalFn === 'function') {
        openModalFn('supportModal');
        if (typeof triggerTypewriterFn === 'function') triggerTypewriterFn('supportModal');
    } else {
        const modal = /** @type {HTMLElement | null} */ (document.getElementById('supportModal'));
        if (modal) {
            modal.inert = false;
            modal.removeAttribute('inert');
            modal.setAttribute('aria-hidden', 'false');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
}
