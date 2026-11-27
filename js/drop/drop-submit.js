// @ts-check
// ==========================================
// NISHA DROP MODAL LAUNCHER, UPLOAD QUEUE & SUBMISSION
// ==========================================

import { invokeAction, resolveAction } from '../core/action-registry.js';
import { getLenisInstance, getRuntimeFingerprint, getRuntimeUser, getTurnstileApi, getRuntimeSiteLang, tSafe } from '../core/runtime-env.js';
import {
    getProposalFiles,
    hasPrivateMeasurementsDodge,
    sanitizeProposalNameField,
    setProposalFiles
} from './drop-state.js';
import {
    confirmPropBargainInput,
    hidePropBargainInput,
    openPropBargainInput,
    resetPropBargainState,
    returnToDesiredPriceMode
} from './drop-bargain.js';
import {
    compressImage,
    handleNewProposalFiles,
    renderProposalPreviews
} from './drop-images.js';
import {
    syncPropSizeOptionsByCategory,
    refreshCustomPropSelect,
    initCustomPropSelect
} from './drop-custom-select.js';
import {
    getCachedTelegramUsernameStatus,
    resetProposalContactValidationState,
    scheduleBackgroundTelegramCheck,
    validateProposalContactSync,
    verifyProposalContactBeforeSubmit
} from './drop-contact-validation.js';

export {
    syncPropSizeOptionsByCategory,
    refreshCustomPropSelect,
    initCustomPropSelect
};

let _propCustomSelectI18nBound = false;
const globalEnv = /** @type {any} */ (globalThis);

// Очередь фоновой отправки предложки с авто-повтором при сбоях сети
/** @type {Promise<any>} */
let proposalUploadChain = Promise.resolve();
let activeProposalUploads = 0;
/** @type {string | null} */
let _lastUsedPropToken = null;
let _isSubmittingProposal = false;
let _isVerifyingContact = false;
let _lastBlurErrorContactKey = '';

/**
 * Возвращает локализованный текст ошибки валидации контакта.
 * @param {string} errorKey
 * @param {string} [tgUsername='']
 * @returns {string}
 */
function getProposalContactErrorMessage(errorKey, tgUsername = '') {
    /** @type {Record<string, string>} */
    const defaults = {
        'propose.err_phone_invalid': 'Некорректный номер телефона! Проверьте цифры и попробуйте ещё раз.',
        'propose.err_tg_format': 'Некорректный Telegram @ник (5–32 латинских символа, цифры или _).',
        'propose.err_tg_not_found': 'Telegram @{{nick}} не найден! Проверьте написание или укажите номер телефона.',
        'propose.err_contact_single_only': 'Укажите что-то одно: либо Telegram @ник, либо номер телефона (не два сразу)!',
        'propose.err_contact_invalid': 'Укажите корректный Telegram @ник или номер телефона (например @nick или +380...)',
        'propose.err_fill_all': 'Пожалуйста, заполните АБСОЛЮТНО ВСЕ поля!'
    };
    const fallback = defaults[errorKey] || defaults['propose.err_contact_invalid'];
    const resolved = tSafe(errorKey, { nick: tgUsername, defaultValue: fallback });
    return String(resolved || fallback).replaceAll('{{nick}}', tgUsername);
}

/**
 * Показывает красный error-тост со звуком ошибки и виброоткликом.
 * @param {string} errorKey
 * @param {string} [tgUsername='']
 * @param {{ focus?: boolean }} [options]
 */
function notifyInvalidProposalContact(errorKey, tgUsername = '', options = {}) {
    const g = /** @type {any} */ (globalThis);
    if (typeof g.triggerHaptic === 'function') g.triggerHaptic('error');
    const msg = getProposalContactErrorMessage(errorKey, tgUsername);
    if (typeof showToast === 'function') showToast(msg, 'error');
    if (options.focus) {
        const contactWrap = document.getElementById('propContactWrapper');
        if (contactWrap && contactWrap.style.display === 'none') {
            contactWrap.style.display = 'block';
        }
        const contactEl = /** @type {HTMLInputElement | null} */ (document.getElementById('propContact'));
        if (contactEl && typeof contactEl.focus === 'function') contactEl.focus();
    }
}

/** @param {BeforeUnloadEvent} e */
function onProposalBeforeUnload(e) {
    if (activeProposalUploads > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
}

function updateProposalBeforeUnloadListener() {
    if (typeof window === 'undefined') return;
    if (activeProposalUploads > 0) {
        window.addEventListener('beforeunload', onProposalBeforeUnload);
    } else {
        window.removeEventListener('beforeunload', onProposalBeforeUnload);
    }
}

function resetProposalTurnstileWidget() {
    if (typeof window !== 'undefined') {
        window._turnstilePropToken = null;
    }
    const g = /** @type {any} */ (globalThis);
    const propWidgetId = (typeof g.turnstilePropWidgetId !== 'undefined')
        ? g.turnstilePropWidgetId
        : (typeof window !== 'undefined' ? window.turnstilePropWidgetId : null);
    const tsApi = getTurnstileApi();
    if (tsApi && propWidgetId !== null && propWidgetId !== undefined && typeof tsApi.reset === 'function') {
        try { tsApi.reset(propWidgetId); } catch {}
    }
}

/**
 * @param {FormData} formData
 * @param {number} [maxAttempts=3]
 */
export async function sendProposalFormDataWithRetry(formData, maxAttempts = 3) {
    let lastError = null;
    const sleepFn = resolveAction('sleep') || ((/** @type {number} */ ms) => new Promise(r => setTimeout(r, ms)));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await window.apiClient.fetchRaw('/api/propose-files', {
                method: 'POST',
                body: formData,
                timeout: 45000,
                retries: 0
            });
            if (res.ok) {
                return true;
            }
            const errText = await res.text().catch(() => '');
            lastError = new Error(`HTTP ${res.status}: ${errText}`);
            console.warn(`[PROPOSAL UPLOAD] Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);
            // Одноразовый Turnstile-токен и 4xx ошибки клиента не должны повторяться с тем же FormData
            if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
                if (res.status === 403) resetProposalTurnstileWidget();
                throw lastError;
            }
        } catch (err) {
            lastError = err;
            const errMsg = err instanceof Error ? err.message : String(err || '');
            if (err && /^HTTP 4\d\d:/.test(errMsg) && !/^HTTP (408|429):/.test(errMsg)) {
                throw err;
            }
            console.warn(`[PROPOSAL UPLOAD] Network error on attempt ${attempt}/${maxAttempts}:`, errMsg);
        }
        if (attempt < maxAttempts) {
            await sleepFn(1500 * attempt);
        }
    }
    throw lastError || new Error('Upload failed');
}

/** @param {FormData} formData */
export function enqueueProposalUpload(formData) {
    activeProposalUploads++;
    updateProposalBeforeUnloadListener();
    proposalUploadChain = proposalUploadChain
        .then(() => sendProposalFormDataWithRetry(formData, 3))
        .catch((err) => {
            console.error('[PROPOSAL BACKGROUND UPLOAD FAILED]', err);
            if (typeof showToast === 'function') {
                const errMsg = tSafe('propose.err_network', 'Ошибка отправки вещи на сервер. Проверьте интернет и попробуйте еще раз.');
                showToast(errMsg, 'error');
            }
        })
        .finally(() => {
            activeProposalUploads = Math.max(0, activeProposalUploads - 1);
            updateProposalBeforeUnloadListener();
        });
    return proposalUploadChain;
}

export function resetProposalForm() {
    _lastBlurErrorContactKey = '';
    resetProposalContactValidationState();
    window._propBargainEnabled = false;
    window._propBargainMode = false;
    if (typeof resetPropBargainState === 'function') {
        resetPropBargainState();
    } else {
        hidePropBargainInput(true);
    }
    const fields = ['propBrand', 'propCategory', 'propSize', 'propCond', 'propPrice', 'propContact', 'propName', 'propDesc', 'propMinBargainPrice'];
    fields.forEach(id => {
        const el = /** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null} */ (document.getElementById(id));
        if (el) {
            el.value = '';
            if (id === 'propName') delete el.dataset.userTyped;
        }
    });
    syncPropSizeOptionsByCategory('');
    refreshCustomPropSelect(/** @type {HTMLSelectElement | null} */ (document.getElementById('propCategory')));
    document.querySelectorAll('.prop-select-wrap.is-open').forEach(w => {
        w.classList.remove('is-open');
        const t = w.querySelector('.prop-custom-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
    });

    const filesInput = /** @type {HTMLInputElement | null} */ (document.getElementById('propFiles'));
    if (filesInput) filesInput.value = '';

    const currentProposalFiles = getProposalFiles();
    if (Array.isArray(currentProposalFiles)) {
        currentProposalFiles.forEach(item => {
            if (item) item._cancelled = true;
            if (item && item._uploadAbortCtrl) {
                try { item._uploadAbortCtrl.abort(); } catch {}
            }
            if (item && item.url) {
                try { URL.revokeObjectURL(item.url); } catch {}
            }
        });
    }

    setProposalFiles([]);

    renderProposalPreviews();
    if (typeof globalEnv.updateProposeAndCheckoutFields === 'function') globalEnv.updateProposeAndCheckoutFields();
    const contactWrap = document.getElementById('propContactWrapper');
    const isContactHidden = Boolean(contactWrap && (contactWrap.style.display === 'none' || contactWrap.hidden));
    const contactEl = /** @type {HTMLInputElement | null} */ (document.getElementById('propContact'));
    if (!isContactHidden && contactEl && !contactEl.value.trim() && window._lastProposalContact && !String(window._lastProposalContact).includes('|')) {
        contactEl.value = window._lastProposalContact;
    }
    _lastBlurErrorContactKey = '';
    const descLabel = document.getElementById('descLabel');
    if (descLabel) {
        descLabel.textContent = tSafe('propose.desc_label', { defaultValue: 'ОПИСАНИЕ И ДЕФЕКТЫ (ДО 250 СИМВОЛОВ):' });
        descLabel.style.color = '';
    }

    const propWidgetId = (typeof globalEnv.turnstilePropWidgetId !== 'undefined') ? globalEnv.turnstilePropWidgetId : window.turnstilePropWidgetId;
    const tsApi = getTurnstileApi();
    if (tsApi && propWidgetId !== null && propWidgetId !== undefined) {
        try { tsApi.reset(propWidgetId); } catch {}
    }
    window._turnstilePropToken = null;
}

export function openProposeModal() {
    if (getLenisInstance()) invokeAction('stopLenis');
    invokeAction('updateProposeAndCheckoutFields');
    resetPropBargainState();
    if (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.warmupBackendServer === 'function') {
        window.apiClient.warmupBackendServer();
    }
    const propNameEl = document.getElementById('propName');
    if (propNameEl) {
        delete propNameEl.dataset.userTyped;
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(sanitizeProposalNameField);
        } else if (typeof globalEnv.runMicrotask === 'function') {
            globalEnv.runMicrotask(sanitizeProposalNameField);
        } else {
            Promise.resolve().then(sanitizeProposalNameField);
        }
        [150, 400, 900, 1800].forEach(ms => setTimeout(sanitizeProposalNameField, ms));
    }
    const contactWrap = document.getElementById('propContactWrapper');
    const isContactHidden = Boolean(contactWrap && (contactWrap.style.display === 'none' || contactWrap.hidden));
    const contactEl = /** @type {HTMLInputElement | null} */ (document.getElementById('propContact'));
    if (!isContactHidden && contactEl && !contactEl.value.trim() && window._lastProposalContact && !String(window._lastProposalContact).includes('|')) {
        contactEl.value = window._lastProposalContact;
    }
    _lastBlurErrorContactKey = '';
    if (!isContactHidden && contactEl && contactEl.value.trim()) {
        scheduleBackgroundTelegramCheck(contactEl.value, { delayMs: 250 });
    }
    if (typeof globalEnv.Sortable === 'undefined' && typeof window.Sortable === 'undefined') {
        const loadSortableDeferred = () => {
            import('sortablejs').then(mod => {
                window.Sortable = mod.default || mod;
            }).catch(() => {});
        };
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            window.requestIdleCallback(loadSortableDeferred, { timeout: 800 });
        } else {
            setTimeout(loadSortableDeferred, 120);
        }
    }

    if (typeof globalEnv.openModal === 'function') {
        // openModal уже запускает triggerModalTypewriter без принудительного reflow на первом кадре
        globalEnv.openModal('proposeModal');
        if (typeof globalEnv.initTurnstileWidgets === 'function') {
            setTimeout(globalEnv.initTurnstileWidgets, 100);
        }
    } else {
        const modal = /** @type {any} */ (document.getElementById('proposeModal'));
        if (modal) {
            if (modal._closeTimer) {
                clearTimeout(modal._closeTimer);
                modal._closeTimer = null;
            }
            modal.inert = false;
            modal.removeAttribute('inert');
            modal.setAttribute('aria-hidden', 'false');
            modal.classList.remove('closing');
            modal.style.pointerEvents = '';
            const win = /** @type {HTMLElement | null} */ (modal.querySelector('.modal-window'));
            if (win) {
                win.style.transform = '';
                win.style.opacity = '';
                win.style.transition = '';
                win.style.animation = '';
            }
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            if (typeof globalEnv.initTurnstileWidgets === 'function') {
                setTimeout(globalEnv.initTurnstileWidgets, 100);
            }
        }
    }
}

export async function submitProposal() {
    const g = /** @type {any} */ (globalThis);
    const btn = document.getElementById('btnSubmitProp');
    if (!btn || _isSubmittingProposal || _isVerifyingContact) return;

    const proposalItems = getProposalFiles().filter(obj => obj && obj.file);
    const files = proposalItems.map(obj => obj.file);

    /** @param {string} id @returns {string} */
    const getFieldVal = (id) => (/** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null} */ (document.getElementById(id))?.value || '');
    const rawName = getFieldVal('propName').trim();
    const rawBrand = getFieldVal('propBrand').trim();
    const categoryEl = /** @type {HTMLSelectElement | null} */ (document.getElementById('propCategory'));
    const rawCategory = (categoryEl?.value || '').trim();
    const rawSize = getFieldVal('propSize').trim();
    const rawDesc = getFieldVal('propDesc').trim();
    const cond = Number.parseInt(getFieldVal('propCond'), 10);
    const price = Number.parseInt(getFieldVal('propPrice'), 10) || 0;
    const contactWrapEl = document.getElementById('propContactWrapper');
    const contactInputEl = /** @type {HTMLInputElement | null} */ (document.getElementById('propContact'));
    const isContactHiddenByProfile = Boolean(
        contactWrapEl && (contactWrapEl.style.display === 'none' || contactWrapEl.hidden)
    );
    const isProfileAutoContact = Boolean(
        isContactHiddenByProfile || contactInputEl?.dataset?.isProfileAuto === '1'
    );

    let rawContact = getFieldVal('propContact').trim();

    if (isProfileAutoContact && !rawContact) {
        const phoneFn = resolveAction('getUserPhone');
        const tgFn = resolveAction('getUserTg');
        const uPhone = typeof phoneFn === 'function' ? phoneFn() : '';
        const uTg = typeof tgFn === 'function' ? tgFn() : '';
        if (uPhone && uTg) rawContact = `${uTg} | ${uPhone}`;
        else if (uTg) rawContact = uTg;
        else if (uPhone) rawContact = uPhone;
    }

    const sanitizeFn = resolveAction('sanitizeText');
    const sanitize = sanitizeFn ? sanitizeFn : (/** @type {any} */ s) => String(s || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const nameItem = sanitize(rawName);
    const brand = sanitize(rawBrand);
    const category = sanitize(rawCategory);
    const size = sanitize(rawSize);
    const desc = sanitize(rawDesc);
    const contact = sanitize(rawContact);

    if ((Number.isNaN(price) || price <= 0) && window._propBargainMode) {
        const minEl = /** @type {HTMLInputElement | null} */ (document.getElementById('propMinBargainPrice'));
        const savedMin = Number.parseInt((minEl?.value || '').trim(), 10);
        if (!Number.isNaN(savedMin) && savedMin >= 100) {
            window._propBargainEnabled = true;
            returnToDesiredPriceMode(true);
        } else {
            returnToDesiredPriceMode(false);
        }
        const prEl = document.getElementById('propPrice');
        if (prEl) prEl.focus();
    }

    const minBargainInput = /** @type {HTMLInputElement | null} */ (document.getElementById('propMinBargainPrice'));
    const rawMinBargain = (minBargainInput?.value || '').trim();

    if (window._propBargainMode || (rawMinBargain && !window._propBargainEnabled)) {
        if (typeof g.triggerHaptic === 'function') g.triggerHaptic('warning');
        const confirmMsg = tSafe('propose.err_confirm_bargain', { defaultValue: 'Подтвердите торг нажатием на галочку [ ✓ ]!' });
        if (typeof showToast === 'function') showToast(confirmMsg, 'warning');

        const btnConfirm = document.getElementById('btnConfirmPropBargain');
        if (btnConfirm && btnConfirm.style.display !== 'none') {
            btnConfirm.focus();
            btnConfirm.classList.add('pulse-highlight');
            setTimeout(() => btnConfirm.classList.remove('pulse-highlight'), 1200);
        } else if (minBargainInput) {
            minBargainInput.focus();
        }
        return;
    }

    if (!files.length || !nameItem || !brand || (categoryEl && !category) || !size || !desc || Number.isNaN(cond) || Number.isNaN(price) || price <= 0 || !contact) {
        if (typeof g.triggerHaptic === 'function') g.triggerHaptic('error');
        const fillAllMsg = tSafe('propose.err_fill_all', 'Пожалуйста, заполните АБСОЛЮТНО ВСЕ поля!');
        if (typeof showToast === 'function') showToast(fillAllMsg, 'error');
        return;
    }

    if (cond < 1 || cond > 10) {
        if (typeof g.triggerHaptic === 'function') g.triggerHaptic('error');
        const condMsg = tSafe('propose.err_cond_range', 'Оценка состояния от 1 до 10!');
        if (typeof showToast === 'function') showToast(condMsg, 'error');
        return;
    }

    if (hasPrivateMeasurementsDodge(rawDesc) || hasPrivateMeasurementsDodge(rawName)) {
        if (typeof g.triggerHaptic === 'function') g.triggerHaptic('error');
        const measurementsDmMsg = tSafe('propose.err_measurements_dm', 'Замеры в ЛС запрещены — укажите замеры цифрами прямо в описании!');
        if (typeof showToast === 'function') showToast(measurementsDmMsg, 'error');
        const descEl = document.getElementById('propDesc');
        if (descEl && typeof descEl.focus === 'function') descEl.focus();
        return;
    }

    let minBargainPrice = null;

    if (window._propBargainEnabled && rawMinBargain) {
        minBargainPrice = Number.parseInt(rawMinBargain, 10);
        if (Number.isNaN(minBargainPrice) || minBargainPrice < 100) {
            if (typeof g.triggerHaptic === 'function') g.triggerHaptic('error');
            const minBargainMsg = tSafe('propose.err_bargain_min', 'Минимальная цена торга должна быть не менее 100 грн!');
            if (typeof showToast === 'function') showToast(minBargainMsg, 'error');
            if (!window._propBargainMode && typeof openPropBargainInput === 'function') openPropBargainInput();
            else if (minBargainInput) minBargainInput.focus();
            return;
        }
        if (minBargainPrice >= price) {
            if (typeof g.triggerHaptic === 'function') g.triggerHaptic('error');
            const lessPriceMsg = tSafe('propose.err_bargain_less_price', 'Минимальная цена торга должна быть меньше желаемой цены!');
            if (typeof showToast === 'function') showToast(lessPriceMsg, 'error');
            if (!window._propBargainMode && typeof openPropBargainInput === 'function') openPropBargainInput();
            else if (minBargainInput) minBargainInput.focus();
            return;
        }
    }

    // Если все контакты заполнены в профиле и поле скрыто — отправляем их автоматически без ручной валидации.
    // Если поле контакта видимо — требуем строго ОДИН корректный контакт (либо @Telegram, либо телефон) и проверяем TG.
    if (!isProfileAutoContact) {
        const syncContactCheck = validateProposalContactSync(rawContact);
        if (!syncContactCheck.ok) {
            notifyInvalidProposalContact(syncContactCheck.errorKey, '', { focus: true });
            return;
        }

        if (syncContactCheck.tgUsername) {
            const cachedTg = getCachedTelegramUsernameStatus(syncContactCheck.tgUsername);
            if (cachedTg && cachedTg.verified === true && cachedTg.exists === false) {
                _lastBlurErrorContactKey = `${rawContact}|not_found`;
                notifyInvalidProposalContact('propose.err_tg_not_found', syncContactCheck.tgUsername, { focus: true });
                return;
            }
            if (!cachedTg) {
                _isVerifyingContact = true;
                const prevBtnText = btn.textContent;
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.8';
                const slowHintTimer = setTimeout(() => {
                    if (_isVerifyingContact) {
                        const checkLabel = tSafe('propose.checking_contact', { defaultValue: 'ПРОВЕРКА КОНТАКТА' });
                        btn.textContent = `[ ${checkLabel}... ]`;
                    }
                }, 120);
                let verifyRes;
                try {
                    verifyRes = await verifyProposalContactBeforeSubmit(rawContact);
                } finally {
                    clearTimeout(slowHintTimer);
                    _isVerifyingContact = false;
                    btn.textContent = prevBtnText;
                    btn.style.pointerEvents = 'auto';
                    btn.style.opacity = '1';
                }
                if (!verifyRes.ok) {
                    _lastBlurErrorContactKey = `${rawContact}|not_found`;
                    notifyInvalidProposalContact(verifyRes.errorKey, verifyRes.tgUsername, { focus: true });
                    return;
                }
            }
        }

        window._lastProposalContact = contact;
    }

    const propWidgetId = (typeof g.turnstilePropWidgetId !== 'undefined') ? g.turnstilePropWidgetId : window.turnstilePropWidgetId;
    const tsApi = getTurnstileApi();
    let propToken = window._turnstilePropToken || (tsApi && propWidgetId !== null && propWidgetId !== undefined ? tsApi.getResponse(propWidgetId) : null);
    if (propToken && propToken === _lastUsedPropToken) {
        propToken = null;
    }
    if (propToken) {
        _lastUsedPropToken = propToken;
        resetProposalTurnstileWidget();
    }

    _isSubmittingProposal = true;
    if (typeof window !== 'undefined') window._isSubmittingProposal = true;
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.7';

    try {
        let compressedFiles;
        const allPrecompressed = proposalItems.every(item => Boolean(item.compressedFile));
        if (allPrecompressed) {
            compressedFiles = proposalItems.map(item => item.compressedFile);
        } else {
            const compressText = tSafe('propose.compressing', { defaultValue: 'СЖАТИЕ ФОТО' });
            let compressedDone = proposalItems.filter(item => Boolean(item.compressedFile)).length;
            btn.textContent = `[ ${compressText}: ${compressedDone}/${proposalItems.length} ]`;

            compressedFiles = new Array(proposalItems.length);
            const COMPRESS_CONCURRENCY = 3;
            let nextIndex = 0;
            const compressWorker = async () => {
                while (nextIndex < proposalItems.length) {
                    const idx = nextIndex++;
                    const item = proposalItems.at(idx);
                    if (item.compressedFile) {
                        compressedFiles[idx] = item.compressedFile;
                        continue;
                    }
                    const result = item.compressedPromise
                        ? await item.compressedPromise
                        : await compressImage(item.file);
                    item.compressedFile = result;
                    compressedFiles[idx] = result;
                    compressedDone++;
                    btn.textContent = `[ ${compressText}: ${compressedDone}/${proposalItems.length} ]`;
                }
            };
            await Promise.all(
                Array.from({ length: Math.min(COMPRESS_CONCURRENCY, proposalItems.length) }, compressWorker)
            );
        }

        const activeUser = getRuntimeUser();
        const activeFp = getRuntimeFingerprint();
        const activeClientId = activeUser ? activeUser.id : (activeFp || 'guest_' + Date.now());

        const formData = new FormData();
        formData.append('name', nameItem);
        formData.append('brand', brand);
        formData.append('measurements', category ? `${category} | ${size}` : size);
        formData.append('condition', String(cond));
        formData.append('price', String(price));
        let finalDesc = desc;
        if (minBargainPrice && !finalDesc.includes('[ТОРГ:')) {
            finalDesc = `${finalDesc}\n\n[ТОРГ: от ${minBargainPrice} грн]`;
        }
        formData.append('description', finalDesc);
        if (minBargainPrice) {
            formData.append('minBargainPrice', String(minBargainPrice));
            formData.append('isBargain', 'true');
        }
        formData.append('contact', contact);
        formData.append('clientId', activeClientId);
        formData.append('lang', getRuntimeSiteLang());
        if (propToken) formData.append('turnstileToken', propToken);

        // Дожидаемся уже запущенной предзагрузки фото (если юзер нажал «Отправить» сразу после выбора)
        const pendingPreuploads = proposalItems.filter(item => !item.uploadedUrl && item.uploadPromise);
        if (pendingPreuploads.length > 0) {
            const uploadingTextPre = tSafe('propose.uploading', { defaultValue: 'ОТПРАВКА НА СЕРВЕР...' });
            btn.textContent = `[ ${uploadingTextPre} ]`;
            await Promise.allSettled(pendingPreuploads.map(item => item.uploadPromise));
        }

        const allPreuploaded = proposalItems.length > 0 && proposalItems.every(item => Boolean(item.uploadedUrl));
        if (allPreuploaded) {
            formData.append('preuploadedUrls', JSON.stringify(proposalItems.map(item => item.uploadedUrl)));
        } else {
            compressedFiles.forEach((file, index) => {
                const isVid = (file && file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|m4v)$/i.test(file?.name || '');
                const ext = isVid ? 'mp4' : (file?.type === 'image/webp' ? 'webp' : 'jpg');
                formData.append('images', file, `prop_${index}.${ext}`);
            });
        }

        const uploadingText = tSafe('propose.uploading', { defaultValue: 'ОТПРАВКА НА СЕРВЕР...' });
        btn.textContent = `[ ${uploadingText} ]`;

        activeProposalUploads++;
        updateProposalBeforeUnloadListener();
        try {
            await sendProposalFormDataWithRetry(formData, 3);
        } finally {
            activeProposalUploads = Math.max(0, activeProposalUploads - 1);
            updateProposalBeforeUnloadListener();
        }

        if (window.analytics && typeof window.analytics.trackProposalSubmitted === 'function') {
            window.analytics.trackProposalSubmitted({
                brand,
                price,
                filesCount: compressedFiles.length
            });
        }

        resetProposalForm();
        btn.textContent = tSafe('propose.btn_submit', { defaultValue: '[ ОТПРАВИТЬ ЗАЯВКУ ]' });
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        _isSubmittingProposal = false;
        if (typeof window !== 'undefined') window._isSubmittingProposal = false;

        if (typeof g.executeCloseModal === 'function') {
            g.executeCloseModal('proposeModal');
        } else if (typeof g.closeModal === 'function') {
            g.closeModal('proposeModal');
        }

        setTimeout(() => {
            const okTitle = tSafe('propose.success_title', { defaultValue: 'SYSTEM_OK.LOG' });
            const okText = tSafe('propose.success_text', { defaultValue: 'Заявка успешно отправлена.' });
            const okBtn = tSafe('propose.btn_close', { defaultValue: '[ ЗАКРЫТЬ ]' });
            invokeAction('playSound', 'tada', { kind: 'celebrate' });
            if (typeof g.showTerminalModal === 'function') g.showTerminalModal(okTitle, okText, okBtn, null);
        }, 100);
    } catch (err) {
        console.error(err);
        const serverErrPref = tSafe('propose.err_server', { defaultValue: 'Сбой сервера: ' });
        const errMsg = err instanceof Error ? err.message : String(err || '');
        if (typeof showToast === 'function') showToast(serverErrPref + errMsg, 'error');
        btn.textContent = tSafe('propose.btn_retry', { defaultValue: '[ ПОВТОРИТЬ ПОПЫТКУ ]' });
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        _isSubmittingProposal = false;
        if (typeof window !== 'undefined') window._isSubmittingProposal = false;
    }
}

export function initProposalListeners() {
    const minInput = /** @type {any} */ (document.getElementById('propMinBargainPrice'));
    if (minInput && !minInput._bargainKeyBound) {
        minInput._bargainKeyBound = true;
        minInput.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmPropBargainInput();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hidePropBargainInput();
            }
        });
    }

    const catSelect = /** @type {(HTMLSelectElement & { _propCatBound?: boolean }) | null} */ (document.getElementById('propCategory'));
    const sizeSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('propSize'));
    if (catSelect && !catSelect._propCatBound) {
        catSelect._propCatBound = true;
        catSelect.addEventListener('change', function () {
            syncPropSizeOptionsByCategory(this.value);
        });
    }
    initCustomPropSelect(catSelect);
    initCustomPropSelect(sizeSelect);

    if (typeof i18next !== 'undefined' && typeof i18next.on === 'function' && !_propCustomSelectI18nBound) {
        _propCustomSelectI18nBound = true;
        i18next.on('languageChanged', () => {
            setTimeout(() => {
                refreshCustomPropSelect(/** @type {HTMLSelectElement | null} */ (document.getElementById('propCategory')));
                refreshCustomPropSelect(/** @type {HTMLSelectElement | null} */ (document.getElementById('propSize')));
            }, 0);
        });
    }

    const contactInput = /** @type {(HTMLInputElement & { _propContactBound?: boolean }) | null} */ (document.getElementById('propContact'));
    if (contactInput && !contactInput._propContactBound) {
        contactInput._propContactBound = true;
        contactInput.addEventListener('input', () => {
            _lastBlurErrorContactKey = '';
            scheduleBackgroundTelegramCheck(contactInput.value, { delayMs: 450 });
        }, { passive: true });

        contactInput.addEventListener('blur', () => {
            if (contactInput.dataset?.isProfileAuto === '1') return;
            const val = contactInput.value.trim();
            if (!val) return;
            const sync = validateProposalContactSync(val);
            if (!sync.ok) {
                const dedupeKey = `${val}|${sync.errorKey}`;
                if (_lastBlurErrorContactKey !== dedupeKey) {
                    _lastBlurErrorContactKey = dedupeKey;
                    notifyInvalidProposalContact(sync.errorKey, '', { focus: false });
                }
                return;
            }
            if (sync.tgUsername) {
                scheduleBackgroundTelegramCheck(val, {
                    delayMs: 0,
                    onResult: (res, checkedRaw) => {
                        if (!res || res.verified !== true || res.exists !== false) return;
                        const modal = document.getElementById('proposeModal');
                        if (!modal || modal.style.display === 'none' || modal.classList.contains('closing')) return;
                        if (contactInput.value.trim() !== checkedRaw.trim()) return;
                        const dedupeKey = `${checkedRaw.trim()}|not_found`;
                        if (_lastBlurErrorContactKey !== dedupeKey) {
                            _lastBlurErrorContactKey = dedupeKey;
                            notifyInvalidProposalContact('propose.err_tg_not_found', res.username || sync.tgUsername, { focus: false });
                        }
                    }
                });
            }
        });
    }

    const fileInput = /** @type {(HTMLInputElement & { _propBound?: boolean }) | null} */ (document.getElementById('propFiles'));
    if (fileInput && !fileInput._propBound) {
        fileInput._propBound = true;
        fileInput.addEventListener('change', function (e) {
            const target = /** @type {HTMLInputElement | null} */ (e.target);
            if (target && target.files) {
                handleNewProposalFiles(Array.from(target.files));
            }
            this.value = '';
        });
    }

    const dropzone = /** @type {(HTMLElement & { _propBound?: boolean }) | null} */ (document.getElementById('propDropzone'));
    if (dropzone && !dropzone._propBound) {
        dropzone._propBound = true;
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.add('drag-active'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.remove('drag-active'), false);
        });

        dropzone.addEventListener('drop', e => {
            if (e.dataTransfer && e.dataTransfer.files) {
                const droppedFiles = Array.from(e.dataTransfer.files);
                handleNewProposalFiles(droppedFiles);
            }
        });
    }
}
