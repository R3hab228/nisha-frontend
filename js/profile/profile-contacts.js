// ==========================================
// NISHA PROFILE CONTACTS (PHONE & TELEGRAM + OTP VERIFICATION)
// ==========================================

import {
    profileState,
    getSupabase,
    getStore,
    getHourglass,
    tProfile,
    notifyToast,
    getGlobalFn,
    bindWindowFn
} from './profile-state.js';

export const CONTACT_CONFIG = {
    phone: {
        cap: 'Phone',
        removeAction: 'remove-profile-phone',
        removeTitle: 'Удалить номер',
        removedToast: 'Номер телефона удален!',
        timeoutToast: 'Время ожидания подтверждения номера истекло',
        duplicateToast: 'Номер уже подтвержден на другом аккаунте!',
        linkedToast: 'Этот номер уже привязан к другому аккаунту!',
        pollVar: 'profileOtpPollInterval',
        pendingVar: 'pendingOtpPhone',
        storageLast: 'nisha_last_phone',
        storagePending: 'nisha_pending_otp_phone',
        storageTime: 'nisha_pending_otp_phone_time'
    },
    tg: {
        cap: 'Tg',
        removeAction: 'remove-profile-tg',
        removeTitle: 'Удалить Telegram',
        removedToast: 'Telegram удален!',
        timeoutToast: 'Время ожидания подтверждения Telegram истекло',
        duplicateToast: 'Этот Telegram уже подтвержден на другом аккаунте!',
        linkedToast: 'Этот Telegram уже привязан к другому аккаунту!',
        pollVar: 'profileTgPollInterval',
        pendingVar: 'pendingOtpTg',
        storageLast: 'nisha_last_tg',
        storagePending: 'nisha_pending_otp_tg',
        storageTime: 'nisha_pending_otp_tg_time'
    }
};

let isCheckingPhoneOtp = false;
let isPhoneOtpCompleted = false;
let isCheckingTgOtp = false;
let isTgOtpCompleted = false;
let lastPhoneSendTimestamp = 0;
let lastTgSendTimestamp = 0;
let contactListenersBound = false;

/**
 * Resolves contact descriptor safely from CONTACT_CONFIG.
 * @param {string} type
 * @returns {object|null}
 */
function getContactCfg(type) {
    return Object.hasOwn(CONTACT_CONFIG, type) ? CONTACT_CONFIG[type] : null;
}

/**
 * Re-enables contact save buttons and restores default checkmark label.
 * @param {'phone'|'tg'} type
 */
export function resetContactSaveButtons(type) {
    const cfg = getContactCfg(type);
    if (!cfg || typeof document === 'undefined') return;
    const selector = `#profile${cfg.cap}InputWrap .win95-save-btn, #modalProfile${cfg.cap}InputWrap .win95-save-btn`;
    document.querySelectorAll(selector).forEach(b => {
        b.disabled = false;
        b.innerText = '✓';
    });
}

/**
 * Clears OTP polling timer and pending contact storage entries.
 * @param {'phone'|'tg'} type
 */
export function clearPendingContactState(type) {
    const cfg = getContactCfg(type);
    if (!cfg) return;
    if (typeof window !== 'undefined') {
        if (window[cfg.pollVar]) {
            clearInterval(window[cfg.pollVar]);
            window[cfg.pollVar] = null;
        }
        window[cfg.pendingVar] = null;
    }
    const store = getStore();
    if (store) {
        store.remove(cfg.storagePending);
        store.remove(cfg.storageTime);
    }
}

/**
 * Opens Telegram bot deep link externally on desktop or in-place on mobile devices.
 * @param {string} tgLink
 */
export function openTelegramBotDeepLink(tgLink) {
    if (typeof window === 'undefined') return;
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.toLowerCase() : '';
    const isMobile = /android|iphone|ipad|ipod/i.test(ua);
    if (isMobile) {
        window.location.href = tgLink;
    } else {
        const win = typeof window.open === 'function' ? window.open(tgLink, '_blank') : null;
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = tgLink;
        }
    }
}

/**
 * Renders contact badge & delete button across desktop sidebar and profile modal.
 * @param {'phone'|'tg'} type
 * @param {string} rawVal
 */
export function renderProfileContact(type, rawVal) {
    const cfg = getContactCfg(type);
    if (!cfg || typeof document === 'undefined') return;

    const trimmed = (rawVal || '').trim();
    const hasVal = type === 'tg' ? Boolean(trimmed.length > 0 && trimmed !== '@') : Boolean(trimmed.length > 0);
    const displayVal = !hasVal ? '' : (type === 'tg' ? (trimmed.startsWith('@') ? trimmed : '@' + trimmed) : rawVal);
    const escapeFn = getGlobalFn('escapeHtml');
    const safeVal = escapeFn ? escapeFn(displayVal) : displayVal;
    const delBtnHtml = (isModal) => `<button data-action="${cfg.removeAction}" data-modal="${isModal ? '1' : '0'}" title="${cfg.removeTitle}" class="win95-check-btn" style="background:#2a2a2a;border:2px outset #777;color:#ff5555;font-family:var(--font-mono);font-size:10px;padding:1px 5px;cursor:pointer;line-height:1;box-shadow:1px 1px 0 #000;margin-left:auto">✕</button>`;

    [false, true].forEach(isModal => {
        const prefix = isModal ? 'modalProfile' : 'profile';
        const valEl = document.getElementById(`${prefix}${cfg.cap}`);
        const btnEl = document.getElementById(`${prefix}Add${cfg.cap}Btn`);
        const wrapEl = document.getElementById(`${prefix}${cfg.cap}InputWrap`);
        if (valEl && btnEl) {
            if (hasVal) {
                valEl.innerHTML = `<span style="word-break:break-all">${safeVal}</span>${delBtnHtml(isModal)}`;
                valEl.style.display = 'flex';
                valEl.style.alignItems = 'center';
                valEl.style.justifyContent = 'space-between';
                btnEl.style.display = 'none';
            } else {
                if (typeof valEl.replaceChildren === 'function') valEl.replaceChildren();
                else valEl.innerHTML = '';
                valEl.style.display = 'none';
                btnEl.style.display = 'inline-block';
            }
            if (wrapEl) wrapEl.style.display = 'none';
        }
    });
    resetContactSaveButtons(type);
}

/**
 * Renders verified phone number in profile UI.
 * @param {string} phone
 */
export function renderProfilePhone(phone) { renderProfileContact('phone', phone); }
bindWindowFn('renderProfilePhone', renderProfilePhone);

/**
 * Renders verified Telegram handle in profile UI.
 * @param {string} tg
 */
export function renderProfileTg(tg) { renderProfileContact('tg', tg); }
bindWindowFn('renderProfileTg', renderProfileTg);

/**
 * Removes saved phone or Telegram contact from Supabase profile, metadata, storage, and DOM.
 * @param {'phone'|'tg'} type
 */
export async function removeProfileContact(type) {
    const cfg = getContactCfg(type);
    const sb = getSupabase();
    const activeUser = profileState.currentUser;
    if (!cfg || !activeUser || !sb) return;

    try {
        await sb.from('profiles').update({ [type]: null }).eq('id', activeUser.id);
        try { await sb.auth.updateUser({ data: { [type]: null } }); } catch {}
    } catch (err) {
        console.error(`Ошибка удаления ${type}:`, err);
    }

    if (profileState.userProfile) profileState.userProfile[type] = null;
    const store = getStore();
    if (store) store.remove(cfg.storageLast);
    clearPendingContactState(type);

    renderProfileContact(type, '');
    notifyToast(tProfile('profile.removed_toast_' + type, cfg.removedToast), 'info');
    const syncFields = getGlobalFn('updateProposeAndCheckoutFields');
    if (syncFields) syncFields();
}
bindWindowFn('removeProfilePhone', (isModal = false) => removeProfileContact('phone', isModal));
bindWindowFn('removeProfileTg', (isModal = false) => removeProfileContact('tg', isModal));

/**
 * Opens inline Win95 contact editor for phone (with IMask) or Telegram (@ handle normalization).
 * @param {'phone'|'tg'} type
 * @param {boolean} [isModal=false]
 */
export function showContactInput(type, isModal = false) {
    const cfg = getContactCfg(type);
    if (!cfg || typeof document === 'undefined') return;
    const prefix = isModal ? 'modalProfile' : 'profile';
    const btn = document.getElementById(`${prefix}Add${cfg.cap}Btn`);
    const wrap = document.getElementById(`${prefix}${cfg.cap}InputWrap`);
    const input = document.getElementById(`${prefix}${cfg.cap}Input`);
    const saveBtn = document.querySelector(`#${prefix}${cfg.cap}InputWrap .win95-save-btn`);
    const store = getStore();

    if (saveBtn && store && store.get(cfg.storagePending)) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getHourglass(14);
    } else if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = '✓';
    }

    if (btn) btn.style.display = 'none';
    if (wrap) wrap.style.display = 'flex';
    if (!input) return;

    if (type === 'phone') {
        const attachMask = (MaskLib) => {
            if (MaskLib && input && (!input._imask || input._imask._isStub)) {
                input._imask = MaskLib(input, { mask: '+{380} (00) 000-00-00' });
            }
        };
        if (typeof IMask === 'function' && !IMask._isStub) {
            attachMask(IMask);
        } else if (typeof window !== 'undefined' && typeof window.loadIMask === 'function') {
            if (typeof IMask === 'function') attachMask(IMask);
            window.loadIMask().then(attachMask);
        } else if (typeof IMask !== 'undefined') {
            attachMask(IMask);
        }
        input.focus();
        input.onkeydown = (e) => {
            if (e.key === 'Enter') window.savePhoneFromInput(isModal);
            if (e.key === 'Escape') window.hidePhoneInput(isModal);
        };
    } else {
        if (!input.value || !input.value.trim() || input.value === '@') {
            input.value = '@';
        } else if (!input.value.startsWith('@')) {
            input.value = '@' + input.value.trim().replace(/^@+/, '');
        }
        input.focus();
        const len = input.value.length;
        if (typeof input.setSelectionRange === 'function') {
            input.setSelectionRange(len, len);
        }

        input.oninput = () => {
            let val = input.value.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, '@').replace(/[^a-zA-Z0-9_@]/g, '');
            val = '@' + val.replaceAll('@', '');
            input.value = val;
        };
        input.onkeydown = (e) => {
            if (e.key === 'Enter') window.saveTgFromInput(isModal);
            if (e.key === 'Escape') window.hideTgInput(isModal);
        };
    }
}
bindWindowFn('showPhoneInput', (isModal = false) => showContactInput('phone', isModal));
bindWindowFn('showTgInput', (isModal = false) => showContactInput('tg', isModal));

/**
 * Cancels pending OTP state and hides contact input editor.
 * @param {'phone'|'tg'} type
 * @param {boolean} [isModal=false]
 */
export function hideContactInput(type, isModal = false) {
    const cfg = getContactCfg(type);
    if (!cfg || typeof document === 'undefined') return;
    clearPendingContactState(type);

    const prefix = isModal ? 'modalProfile' : 'profile';
    const btn = document.getElementById(`${prefix}Add${cfg.cap}Btn`);
    const wrap = document.getElementById(`${prefix}${cfg.cap}InputWrap`);
    const input = document.getElementById(`${prefix}${cfg.cap}Input`);

    if (wrap) wrap.style.display = 'none';
    if (btn) btn.style.display = 'inline-block';
    if (input && input._imask) input._imask.value = '';
    else if (input) input.value = '';

    resetContactSaveButtons(type);
}
bindWindowFn('hidePhoneInput', (isModal = false) => hideContactInput('phone', isModal));
bindWindowFn('hideTgInput', (isModal = false) => hideContactInput('tg', isModal));

/**
 * Checks whether verified phone OTP belongs to another account and commits it to profile/state.
 * @param {object} sb
 * @param {object|null} activeUser
 * @param {string} pendingVal
 * @param {object|null} store
 * @returns {Promise<'aborted'|'ok'>}
 */
async function commitVerifiedPhone(sb, activeUser, pendingVal, store) {
    let hasLinkedTg = false;
    if (activeUser) {
        try {
            const { data: profData, error: profErr } = await sb.from('profiles').select('phone, tg').eq('id', activeUser.id).single();
            if (!profErr && profData) {
                if (!profileState.userProfile) profileState.userProfile = {};
                const confirmedPhone = profData.phone || pendingVal;
                profileState.userProfile.phone = confirmedPhone;
                if (store) store.set('nisha_last_phone', confirmedPhone);
                renderProfilePhone(confirmedPhone);

                if (profData.tg) {
                    profileState.userProfile.tg = profData.tg;
                    if (store) store.set('nisha_last_tg', profData.tg);
                    renderProfileTg(profData.tg);
                    hasLinkedTg = true;
                    clearPendingContactState('tg');
                }
                if (!profData.phone) {
                    await sb.from('profiles').update({ phone: pendingVal }).eq('id', activeUser.id);
                }
            } else {
                const { error: updErr } = await sb.from('profiles').update({ phone: pendingVal }).eq('id', activeUser.id);
                if (updErr && (updErr.code === '23505' || updErr.message?.includes('duplicate'))) {
                    resetContactSaveButtons('phone');
                    notifyToast(tProfile('profile.phone_already_verified', 'Этот номер уже подтвержден на другом аккаунте!'), 'error');
                    return 'aborted';
                }
                if (!profileState.userProfile) profileState.userProfile = {};
                profileState.userProfile.phone = pendingVal;
                if (store) store.set('nisha_last_phone', pendingVal);
                renderProfilePhone(pendingVal);
            }
            await sb.auth.updateUser({ data: { phone: pendingVal } });
        } catch {}
    } else {
        if (!profileState.userProfile) profileState.userProfile = {};
        profileState.userProfile.phone = pendingVal;
        if (store) store.set('nisha_last_phone', pendingVal);
        renderProfilePhone(pendingVal);
    }

    const msg = hasLinkedTg
        ? tProfile('profile.both_verified', 'Номер и Telegram подтверждены!')
        : tProfile('messages.phone_verified', 'Номер подтвержден!');
    notifyToast(msg, 'success');
    return 'ok';
}

/**
 * Checks whether verified Telegram handle belongs to another account and commits it to profile/state.
 * @param {object} sb
 * @param {object|null} activeUser
 * @param {string} pendingVal
 * @param {object} cfg
 * @param {object|null} store
 * @returns {Promise<'aborted'|'ok'>}
 */
async function commitVerifiedTg(sb, activeUser, pendingVal, cfg, store) {
    const formattedTg = '@' + pendingVal.replace(/^@+/, '').trim();
    if (activeUser) {
        try {
            const { error: updErr } = await sb.from('profiles').update({ tg: formattedTg }).eq('id', activeUser.id);
            if (updErr && (updErr.code === '23505' || updErr.message?.includes('duplicate'))) {
                resetContactSaveButtons('tg');
                notifyToast(cfg.duplicateToast, 'error');
                return 'aborted';
            }
            await sb.auth.updateUser({ data: { tg: formattedTg } });
        } catch {}
    }
    if (!profileState.userProfile) profileState.userProfile = {};
    profileState.userProfile.tg = formattedTg;
    if (store) store.set('nisha_last_tg', formattedTg);
    renderProfileTg(formattedTg);
    notifyToast(tProfile('messages.tg_verified', 'Telegram подтвержден!'), 'success');
    return 'ok';
}

/**
 * Polls OTP verification status in background until timeout (120s), conflict, or confirmation.
 * @param {'phone'|'tg'} type
 */
export async function checkPendingContactVerification(type) {
    const isPhone = type === 'phone';
    if (isPhone ? (isCheckingPhoneOtp || isPhoneOtpCompleted) : (isCheckingTgOtp || isTgOtpCompleted)) return;

    const cfg = getContactCfg(type);
    const store = getStore();
    const pendingVal = (typeof window !== 'undefined' ? window[cfg.pendingVar] : null)
        || (store ? store.get(cfg.storagePending) : null);
    if (!pendingVal) return;

    const startTime = Number.parseInt((store ? store.get(cfg.storageTime, '0') : '0'), 10);
    if (startTime && (Date.now() - startTime > 120000)) {
        clearPendingContactState(type);
        resetContactSaveButtons(type);
        notifyToast(tProfile('profile.timeout_toast_' + type, cfg.timeoutToast), 'error');
        return;
    }

    const cleanVal = isPhone ? pendingVal : pendingVal.replace(/^@+/, '').trim().toLowerCase();
    if (!cleanVal) return;

    const sb = getSupabase();
    if (!sb) return;

    if (isPhone) isCheckingPhoneOtp = true;
    else isCheckingTgOtp = true;

    const activeUser = profileState.currentUser;
    try {
        if (activeUser) {
            try {
                const { data: isAvail } = await sb.rpc('check_contact_available', {
                    p_type: type,
                    p_val: cleanVal,
                    p_user_id: activeUser.id
                });
                if (isAvail === false) {
                    clearPendingContactState(type);
                    resetContactSaveButtons(type);
                    notifyToast(tProfile('profile.duplicate_toast_' + type, cfg.duplicateToast), 'error');
                    return;
                }
            } catch {}
        }

        const otpRpcTarget = isPhone ? pendingVal : `tg_${cleanVal}`;
        const { data: isVerified } = await sb.rpc('check_otp_verified', { p_phone: otpRpcTarget });
        if (!isVerified) return;

        if (isPhone) isPhoneOtpCompleted = true;
        else isTgOtpCompleted = true;
        clearPendingContactState(type);

        const status = isPhone
            ? await commitVerifiedPhone(sb, activeUser, pendingVal, store)
            : await commitVerifiedTg(sb, activeUser, pendingVal, cfg, store);
        if (status === 'aborted') return;

        const syncFields = getGlobalFn('updateProposeAndCheckoutFields');
        if (syncFields) syncFields();
    } catch (err) {
        console.error(`Ошибка проверки ${type} OTP в фоне:`, err);
    } finally {
        if (isPhone) isCheckingPhoneOtp = false;
        else isCheckingTgOtp = false;
    }
}

export async function checkPendingPhoneVerification() { return checkPendingContactVerification('phone'); }
bindWindowFn('checkPendingPhoneVerification', checkPendingPhoneVerification);

export async function checkPendingTgVerification() { return checkPendingContactVerification('tg'); }
bindWindowFn('checkPendingTgVerification', checkPendingTgVerification);

/**
 * Validates input contact, checks blacklist/duplicates, starts OTP polling, and opens bot link.
 * @param {'phone'|'tg'} type
 * @param {boolean} [isModal=false]
 */
export async function saveContactFromInput(type, isModal = false) {
    const activeUser = profileState.currentUser;
    if (!activeUser) {
        notifyToast(tProfile('messages.auth_required', 'Сначала авторизуйтесь!'), 'error');
        return;
    }

    const sb = getSupabase();
    if (!sb || typeof document === 'undefined') return;

    const isPhone = type === 'phone';
    const cfg = getContactCfg(type);
    const now = Date.now();
    const lastTs = isPhone ? lastPhoneSendTimestamp : lastTgSendTimestamp;
    const cooldownRemaining = Math.ceil((10000 - (now - lastTs)) / 1000);
    if (cooldownRemaining > 0) {
        notifyToast(tProfile('profile.cooldown_wait', `Подождите ${cooldownRemaining} сек перед повторной отправкой!`, { sec: cooldownRemaining }), 'info');
        return;
    }

    const prefix = isModal ? 'modalProfile' : 'profile';
    const input = document.getElementById(`${prefix}${cfg.cap}Input`);
    if (!input) return;

    let clean = '';
    let rpcAvailVal = '';
    let otpTarget = '';
    let tgLink = '';

    if (isPhone) {
        clean = input.value.trim().replace(/[^\d+]/g, '');
        if (!clean.startsWith('+') && clean.startsWith('380')) clean = '+' + clean;
        if (!clean.startsWith('+') && clean.length === 10) clean = '+38' + clean;
        if (clean.replace(/[^\d]/g, '').length < 10) {
            notifyToast(tProfile('profile.phone_min_digits', 'Введите корректный номер (минимум 10 цифр)!'), 'error');
            input.focus();
            return;
        }
        try {
            const { data: blacklisted } = await sb.from('blacklist').select('phone').eq('phone', clean).limit(1);
            if (blacklisted && blacklisted.length > 0) {
                notifyToast(tProfile('profile.security_blocked', '[!] ОШИБКА БЕЗОПАСНОСТИ: ВАШ НОМЕР ЗАБЛОКИРОВАН'), 'error');
                return;
            }
        } catch {}
        rpcAvailVal = clean;
        otpTarget = clean;
        const userPrefix = activeUser.id ? `${activeUser.id}_` : '';
        tgLink = `https://t.me/nisha_store1_bot?start=otp_${userPrefix}${clean.replace('+', '')}`;
    } else {
        const rawVal = input.value.trim().replace(/^(https?:\/\/)?(www\.)?t\.me\//i, '@');
        const cleanUser = rawVal.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
        if (cleanUser.length < 2) {
            notifyToast(tProfile('profile.tg_invalid', 'Введите корректный Telegram username!'), 'error');
            input.focus();
            return;
        }
        clean = '@' + cleanUser;
        const cleanLower = cleanUser.toLowerCase();
        rpcAvailVal = cleanUser;
        otpTarget = `tg_${cleanLower}`;
        tgLink = `https://t.me/nisha_store1_bot?start=tg_${activeUser.id}_${cleanLower}`;
    }

    try {
        const { data: isAvail, error: rpcErr } = await sb.rpc('check_contact_available', {
            p_type: type,
            p_val: rpcAvailVal,
            p_user_id: activeUser.id
        });
        if (!rpcErr && isAvail === false) {
            notifyToast(cfg.duplicateToast, 'error');
            input.focus();
            return;
        }
    } catch {}

    try {
        let query = sb.from('profiles').select('id').neq('id', activeUser.id).limit(1);
        query = isPhone ? query.eq('phone', clean) : query.ilike('tg', clean);
        const { data: existing } = await query;
        if (existing && existing.length > 0) {
            notifyToast(cfg.linkedToast, 'error');
            input.focus();
            return;
        }
    } catch {}

    if (isPhone) {
        lastPhoneSendTimestamp = Date.now();
        isPhoneOtpCompleted = false;
    } else {
        lastTgSendTimestamp = Date.now();
        isTgOtpCompleted = false;
    }

    const saveBtn = document.querySelector(`#${prefix}${cfg.cap}InputWrap .win95-save-btn`);
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getHourglass(14);
    }

    try {
        const { error: otpError } = await sb.rpc('generate_secure_otp', { p_phone: otpTarget });
        if (otpError) {
            console.error(`OTP generate error (${type}):`, otpError);
            notifyToast(tProfile('profile.otp_server_err', 'Ошибка сервера при генерации кода'), 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = '✓';
            }
            return;
        }
    } catch (e) {
        console.error(`OTP RPC error (${type}):`, e);
    }

    if (typeof window !== 'undefined') window[cfg.pendingVar] = clean;
    const store = getStore();
    if (store) {
        store.set(cfg.storagePending, clean);
        store.set(cfg.storageTime, Date.now().toString());
    }

    openTelegramBotDeepLink(tgLink);
    notifyToast(
        isPhone
            ? tProfile('profile.go_to_bot_phone', 'Перейдите в бота и нажмите СТАРТ для подтверждения номера...')
            : tProfile('profile.go_to_bot_tg', 'Перейдите в бота и нажмите СТАРТ для подтверждения Telegram...'),
        'info'
    );

    if (typeof window !== 'undefined') {
        if (window[cfg.pollVar]) clearInterval(window[cfg.pollVar]);
        window[cfg.pollVar] = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            checkPendingContactVerification(type);
        }, 2000);
    }
}
bindWindowFn('savePhoneFromInput', (isModal = false) => saveContactFromInput('phone', isModal));
bindWindowFn('saveTgFromInput', (isModal = false) => saveContactFromInput('tg', isModal));

/**
 * Checks any in-flight phone/Telegram OTP verifications when tab regains visibility or focus.
 */
export function triggerPendingContactChecks() {
    const store = getStore();
    if ((typeof window !== 'undefined' && window.pendingOtpPhone) || (store && store.get('nisha_pending_otp_phone'))) {
        checkPendingPhoneVerification();
    }
    if ((typeof window !== 'undefined' && window.pendingOtpTg) || (store && store.get('nisha_pending_otp_tg'))) {
        checkPendingTgVerification();
    }
}

/**
 * Registers tab visibility and window focus listeners for background OTP polling.
 */
export function initContactVisibilityListeners() {
    if (contactListenersBound) return;
    contactListenersBound = true;
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') triggerPendingContactChecks();
        });
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('focus', triggerPendingContactChecks);
    }
}

/**
 * Resets internal OTP throttling/completion flags for deterministic unit tests.
 */
export function resetContactOtpTestFlags() {
    isCheckingPhoneOtp = false;
    isPhoneOtpCompleted = false;
    isCheckingTgOtp = false;
    isTgOtpCompleted = false;
    lastPhoneSendTimestamp = 0;
    lastTgSendTimestamp = 0;
}
