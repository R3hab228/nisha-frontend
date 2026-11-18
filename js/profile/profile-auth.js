// ==========================================
// NISHA PROFILE AUTHENTICATION, LOGOUT & AUTH LISTENER MODULE
// ==========================================

import {
    profileState,
    getSupabase,
    getStore,
    tProfile,
    notifyToast,
    getGlobalFn,
    bindWindowFn
} from './profile-state.js';
import { resetSignedOutProfileUI, checkSession } from './profile-session.js';

/**
 * Toggles sidebar or modal authentication form between login and registration modes.
 * @param {boolean} [isModal=false]
 */
export function toggleRegMode(isModal = false) {
    if (typeof document === 'undefined') return;
    const p = isModal ? 'modal' : '';
    const a = isModal ? 'modalAuth' : 'auth';

    const btnLogin = document.getElementById(p ? 'modalBtnLogin' : 'btnLogin');
    const btnShowReg = document.getElementById(p ? 'modalBtnShowReg' : 'btnShowReg');
    const btnRegister = document.getElementById(p ? 'modalBtnRegister' : 'btnRegister');
    const btnBackLogin = document.getElementById(p ? 'modalBtnBackLogin' : 'btnBackLogin');
    const authUsername = document.getElementById(a + 'Username');
    const forgotPassWrap = document.getElementById(p ? 'modalAuthForgotPassWrap' : 'authForgotPassWrap');

    const currentlyReg = btnRegister && btnRegister.style.display === 'block';
    const nextRegMode = !currentlyReg;
    profileState.isRegMode = nextRegMode;

    if (nextRegMode) {
        if (btnLogin) btnLogin.style.display = 'none';
        if (btnShowReg) btnShowReg.style.display = 'none';
        if (btnRegister) btnRegister.style.display = 'block';
        if (btnBackLogin) btnBackLogin.style.display = 'block';
        if (authUsername) authUsername.style.display = 'block';
        if (forgotPassWrap) forgotPassWrap.style.display = 'none';
    } else {
        if (btnLogin) btnLogin.style.display = 'block';
        if (btnShowReg) btnShowReg.style.display = 'block';
        if (btnRegister) btnRegister.style.display = 'none';
        if (btnBackLogin) btnBackLogin.style.display = 'none';
        if (authUsername) authUsername.style.display = 'none';
        if (forgotPassWrap) forgotPassWrap.style.display = 'flex';
    }
}
bindWindowFn('toggleRegMode', toggleRegMode);

/**
 * Executes Supabase email/password sign-in or registration and syncs session UI.
 * @param {'login'|'register'} action
 * @param {boolean} [isModal=false]
 */
export async function handleAuth(action, isModal = false) {
    const sb = getSupabase();
    if (!sb || typeof document === 'undefined') return;

    const p = isModal ? 'modalAuth' : 'auth';
    const emailInput = document.getElementById(p + 'Email');
    const passInput = document.getElementById(p + 'Pass');
    const userInput = document.getElementById(p + 'Username');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';
    const username = userInput ? userInput.value.trim() : '';

    if (!email || !password) {
        notifyToast(tProfile('messages.enter_email_pass', 'Введите Email и пароль!'), 'error');
        return;
    }

    let result;
    if (action === 'register') {
        if (!username) {
            notifyToast(tProfile('messages.need_nickname', 'Для регистрации нужен никнейм!'), 'error');
            return;
        }
        const userMetaData = {
            username: username,
            display_name: username,
            full_name: username,
            name: username
        };
        result = await sb.auth.signUp({
            email,
            password,
            options: { data: userMetaData }
        });
        if (!result.error) {
            notifyToast(tProfile('messages.reg_success', 'Регистрация успешна! Проверьте почту.'), 'success');
            if (result.data?.user?.id) {
                try {
                    const table = typeof sb.from === 'function' ? sb.from('profiles') : null;
                    if (table && typeof table.upsert === 'function') {
                        await table.upsert({
                            id: result.data.user.id,
                            username: username
                        }, { onConflict: 'id' });
                    }
                } catch {}
            }
        }
    } else {
        result = await sb.auth.signInWithPassword({ email, password });
        if (!result.error) {
            const playFn = getGlobalFn('playSound');
            if (playFn) playFn('chimes', { kind: 'success' }).catch(() => {});
            notifyToast(tProfile('messages.login_success', 'Вход выполнен успешно!'), 'success');
        }
    }

    if (result.error) {
        let msg = result.error.message;
        const errLower = (msg || '').toLowerCase();

        if (errLower.includes('invalid login credentials')) {
            msg = tProfile('messages.invalid_credentials', 'Неверный email или пароль. Если вы входили через Google — нажмите «GOOGLE ID» ниже.');
        } else if (errLower.includes('email not confirmed')) {
            msg = tProfile('messages.email_not_confirmed', 'Подтвердите email по ссылке из письма или войдите через Google.');
        } else if (errLower.includes('user already registered')) {
            msg = tProfile('messages.user_already_registered', 'Этот email уже зарегистрирован. Попробуйте войти или сбросить пароль.');
        }
        notifyToast(msg, 'error');
    } else {
        await checkSession();
        const closeFn = getGlobalFn('closeModal');
        if (isModal && closeFn) closeFn('profileModal');
    }
}
bindWindowFn('handleAuth', handleAuth);

/**
 * Initiates Supabase password reset email flow with input/prompt validation and escaped feedback.
 * @param {boolean} [isModal=false]
 */
export async function handleForgotPassword(isModal = false) {
    const sb = getSupabase();
    if (!sb || typeof document === 'undefined') return;

    const p = isModal ? 'modalAuth' : 'auth';
    const emailInput = document.getElementById(p + 'Email');
    let email = emailInput ? emailInput.value.trim() : '';

    if (!email) {
        const promptText = tProfile('messages.forgot_prompt', 'Введите ваш Email для восстановления доступа к аккаунту:');
        const terminalPromptFn = getGlobalFn('showPromptTerminalModal');
        let userPrompt = null;
        if (terminalPromptFn) {
            userPrompt = await terminalPromptFn({
                title: 'PASSWORD_RECOVERY.EXE',
                message: promptText,
                placeholder: 'you@example.com',
                inputType: 'email',
                confirmBtnText: `[ ${tProfile('product.ask_send', 'ОТПРАВИТЬ')} ]`,
                cancelBtnText: tProfile('propose.btn_cancel', '[ ОТМЕНА ]')
            });
        } else {
            const promptFn = getGlobalFn('prompt');
            userPrompt = promptFn ? promptFn(promptText) : null;
        }
        if (userPrompt === null) return;
        email = String(userPrompt).trim();
    }

    if (!email) {
        notifyToast(tProfile('messages.forgot_specify_email', 'Укажите Email для восстановления пароля'), 'error');
        return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        notifyToast(tProfile('messages.invalid_email', 'Некорректный формат Email'), 'error');
        return;
    }

    try {
        const redirectUrl = (typeof window !== 'undefined' && window.location?.origin) || 'https://www.nisha-store.shop';
        const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl
        });
        if (error) {
            notifyToast(tProfile('messages.forgot_error', 'Ошибка восстановления: ') + error.message, 'error');
        } else {
            const template = tProfile('messages.forgot_sent', 'Письмо для сброса пароля отправлено на {{email}}! Проверьте входящие и Спам.');
            const escapeFn = getGlobalFn('escapeHtml');
            const safeEmail = escapeFn ? escapeFn(email) : email;
            notifyToast(template.replace('{{email}}', safeEmail), 'success');
        }
    } catch {
        notifyToast(tProfile('messages.forgot_failed', 'Не удалось отправить письмо для сброса пароля'), 'error');
    }
}
bindWindowFn('handleForgotPassword', handleForgotPassword);

/**
 * Signs out active user, clears cached personal/order/delivery data, and resets UI.
 */
export async function logout() {
    const sb = getSupabase();
    if (sb) {
        await sb.auth.signOut();
    }
    notifyToast(tProfile('messages.logout', 'Вы вышли из системы'), 'success');

    if (typeof window !== 'undefined') {
        window.showingOnlyFavs = false;
        window.otpVerified = false;
    }
    profileState.globalOrdersData = [];
    profileState.favorites = [];

    const store = getStore();
    const keysToClear = [
        'nisha_cached_orders',
        'nisha_cached_favorites',
        'nisha_last_phone',
        'nisha_last_tg',
        'nisha_profile_delivery',
        'nisha_checkout_data',
        'nisha_email_preference'
    ];
    keysToClear.forEach(k => {
        if (store && typeof store.remove === 'function') store.remove(k);
        try { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); } catch {}
    });
    if (typeof caches !== 'undefined' && typeof caches.delete === 'function') {
        caches.delete('nisha-api-v2').catch(() => {});
    }
    if (typeof document !== 'undefined') {
        const favNav = document.getElementById('favNav');
        if (favNav) favNav.style.color = 'var(--accent-yellow)';
    }

    await checkSession();
    const applyFiltersFn = getGlobalFn('applyFilters');
    if (applyFiltersFn) applyFiltersFn();
}
bindWindowFn('logout', logout);

/**
 * Launches Google OAuth redirect login with embedded in-app WebView warning guard.
 */
export async function loginWithGoogle() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const isInApp = /Instagram|FBAN|FBAV|TikTok/i.test(ua);
    if (isInApp) {
        const alertFn = getGlobalFn('alert');
        const msg = tProfile('profile.google_webview_warn', 'Для входа через Google открой сайт в обычном браузере (Safari или Chrome)');
        if (alertFn) alertFn(msg);
        return;
    }
    const sb = getSupabase();
    if (!sb) return;

    const redirectUrl = (typeof window !== 'undefined' && window.location?.origin) || 'https://www.nisha-store.shop';
    const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl,
            queryParams: { prompt: 'select_account', access_type: 'offline' }
        }
    });
    if (error) {
        notifyToast(tProfile('profile.err_prefix', 'Ошибка: ') + error.message, 'error');
    }
}
bindWindowFn('loginWithGoogle', loginWithGoogle);

/**
 * Toggles password input visibility and eye icon class.
 * @param {string} inputId
 * @param {HTMLElement} [iconElement]
 */
export function togglePasswordVisibility(inputId, iconElement) {
    if (typeof document === 'undefined') return;
    const input = document.getElementById(inputId);
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (iconElement && iconElement.classList) {
        iconElement.classList.toggle('visible', isPassword);
    }
}
bindWindowFn('togglePasswordVisibility', togglePasswordVisibility);

/**
 * Escapes HTML special characters for safe template interpolation.
 * @param {string} str
 * @returns {string}
 */
function escapeRecoveryHtml(str) {
    const escapeFn = getGlobalFn('escapeHtml');
    if (escapeFn) return escapeFn(String(str ?? ''));
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Opens a terminal-styled modal to set a new password after Supabase PASSWORD_RECOVERY event.
 * @returns {Promise<boolean>} Resolves true if password was updated, false if cancelled/unavailable.
 */
export function showPasswordRecoveryModal() {
    if (
        typeof document === 'undefined' ||
        !document.body ||
        typeof document.createElement !== 'function' ||
        typeof document.body.appendChild !== 'function'
    ) {
        return Promise.resolve(false);
    }
    const sb = getSupabase();
    if (!sb || !sb.auth || typeof sb.auth.updateUser !== 'function') return Promise.resolve(false);

    if (document.querySelector('.password-recovery-overlay')) {
        return Promise.resolve(false);
    }

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'bargain-broadcast-overlay terminal-modal-overlay password-recovery-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.58); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); z-index: 100000; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 15px; box-sizing: border-box;';

        const descText = escapeRecoveryHtml(tProfile('messages.recovery_new_pass_desc', 'Введите новый пароль для вашего аккаунта (минимум 6 символов):'));
        const newPassPh = escapeRecoveryHtml(tProfile('messages.new_password_placeholder', 'Новый пароль'));
        const confirmPassPh = escapeRecoveryHtml(tProfile('messages.confirm_password_placeholder', 'Повторите новый пароль'));
        const saveBtnText = escapeRecoveryHtml(tProfile('messages.btn_save_password', 'СОХРАНИТЬ'));
        const cancelBtnText = escapeRecoveryHtml(tProfile('propose.btn_cancel', '[ ОТМЕНА ]'));

        const eyeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line class="eye-slash" x1="2" y1="2" x2="22" y2="22"></line></svg>';

        overlay.innerHTML = `
            <form class="success-terminal-box password-recovery-form" style="animation: none; transform: scale(1); opacity: 1;" novalidate>
                <div class="success-title typewriter">NEW_PASSWORD.EXE</div>
                <div class="success-divider"></div>
                <div class="success-text" style="margin-bottom: 14px; color: #ddd; text-align: left;">${descText}</div>
                <div class="password-wrapper" style="margin-bottom: 12px;">
                    <input type="password" id="recoveryNewPassword" class="form-input" placeholder="${newPassPh}" autocomplete="new-password" style="margin-bottom: 0; padding-right: 42px;">
                    <div class="eye-icon" data-action="toggle-password-visibility" data-input-id="recoveryNewPassword" style="right: 12px;">${eyeSvg}</div>
                </div>
                <div class="password-wrapper" style="margin-bottom: 10px;">
                    <input type="password" id="recoveryConfirmPassword" class="form-input" placeholder="${confirmPassPh}" autocomplete="new-password" style="margin-bottom: 0; padding-right: 42px;">
                    <div class="eye-icon" data-action="toggle-password-visibility" data-input-id="recoveryConfirmPassword" style="right: 12px;">${eyeSvg}</div>
                </div>
                <div id="recoveryPassError" style="display: none; color: #ff4d4d; font-size: 12px; margin-bottom: 12px; text-align: left;"></div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px;">
                    <button type="submit" class="cart-checkout-btn btn-target recovery-submit" style="flex: 1 1 0; min-width: max-content; white-space: nowrap; padding: 12px;">[ ${saveBtnText} ]</button>
                    <button type="button" class="cart-checkout-btn btn-target recovery-cancel" style="flex: 1 1 0; min-width: max-content; white-space: nowrap; padding: 12px; background: #222; border-color: #555; color: #ccc;">${cancelBtnText}</button>
                </div>
            </form>
        `;
        document.body.appendChild(overlay);

        const formEl = overlay.querySelector('.password-recovery-form');
        const newPassInput = overlay.querySelector('#recoveryNewPassword');
        const confirmPassInput = overlay.querySelector('#recoveryConfirmPassword');
        const errorEl = overlay.querySelector('#recoveryPassError');
        const submitBtn = overlay.querySelector('.recovery-submit');
        const cancelBtn = overlay.querySelector('.recovery-cancel');
        const ctrl = new AbortController();
        let settled = false;
        let submitting = false;

        const showInlineError = (msg) => {
            if (!errorEl) return;
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        };

        const finish = (updated) => {
            if (settled) return;
            settled = true;
            ctrl.abort();
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            overlay.remove();
            resolve(updated);
        };

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => finish(false), { signal: ctrl.signal });
        }
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !submitting) finish(false);
        }, { signal: ctrl.signal });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !submitting) finish(false);
        }, { signal: ctrl.signal });

        if (formEl) {
            formEl.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (submitting) return;

                const newPassword = newPassInput ? newPassInput.value : '';
                const confirmPassword = confirmPassInput ? confirmPassInput.value : '';

                if (errorEl) errorEl.style.display = 'none';

                if (newPassword.length < 6) {
                    const msg = tProfile('messages.password_too_short', 'Пароль должен содержать минимум 6 символов');
                    showInlineError(msg);
                    notifyToast(msg, 'error');
                    if (newPassInput) newPassInput.focus();
                    return;
                }

                if (newPassword !== confirmPassword) {
                    const msg = tProfile('messages.passwords_mismatch', 'Пароли не совпадают');
                    showInlineError(msg);
                    notifyToast(msg, 'error');
                    if (confirmPassInput) confirmPassInput.focus();
                    return;
                }

                submitting = true;
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = `[ ${tProfile('messages.saving', 'СОХРАНЕНИЕ...')} ]`;
                }

                try {
                    const { error } = await sb.auth.updateUser({ password: newPassword });
                    if (error) {
                        const errMsg = tProfile('messages.password_update_error', 'Ошибка обновления пароля: ') + error.message;
                        showInlineError(errMsg);
                        notifyToast(errMsg, 'error');
                        submitting = false;
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = `[ ${tProfile('messages.btn_save_password', 'СОХРАНИТЬ')} ]`;
                        }
                        return;
                    }

                    if (typeof window !== 'undefined' && window.history?.replaceState && window.location?.hash) {
                        const hash = window.location.hash;
                        if (hash.includes('type=recovery') || hash.includes('access_token=')) {
                            window.history.replaceState(null, '', window.location.pathname + window.location.search);
                        }
                    }

                    const playFn = getGlobalFn('playSound');
                    if (playFn) playFn('chimes', { kind: 'success' }).catch(() => {});
                    notifyToast(tProfile('messages.password_updated', 'Пароль успешно обновлен!'), 'success');
                    finish(true);
                } catch {
                    const errMsg = tProfile('messages.password_update_error', 'Ошибка обновления пароля: ') + 'Network error';
                    showInlineError(errMsg);
                    notifyToast(errMsg, 'error');
                    submitting = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = `[ ${tProfile('messages.btn_save_password', 'СОХРАНИТЬ')} ]`;
                    }
                }
            }, { signal: ctrl.signal });
        }

        if (newPassInput) {
            setTimeout(() => {
                if (!settled && typeof newPassInput.focus === 'function') newPassInput.focus();
            }, 30);
        }
    });
}
bindWindowFn('showPasswordRecoveryModal', showPasswordRecoveryModal);

/**
 * Checks and consumes any pending password recovery flag captured before Supabase SDK consumed URL params.
 * @returns {boolean}
 */
function hasPendingPasswordRecoveryFlag() {
    if (typeof window === 'undefined') return false;
    if (window.__NISHA_PASSWORD_RECOVERY_PENDING__) return true;
    try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nisha_pw_recovery_pending') === '1') {
            return true;
        }
    } catch {}
    const locHash = (window.location && window.location.hash) || '';
    const locSearch = (window.location && window.location.search) || '';
    return /(?:^|[#&?])type=recovery(?:&|$)/i.test(locHash) || /(?:^|[&?])type=recovery(?:&|$)/i.test(locSearch);
}

/**
 * Clears pending password recovery flags once handled or cancelled.
 */
function clearPendingPasswordRecoveryFlag() {
    if (typeof window !== 'undefined') {
        window.__NISHA_PASSWORD_RECOVERY_PENDING__ = false;
    }
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('nisha_pw_recovery_pending');
        }
    } catch {}
}

/**
 * Subscribes to Supabase auth state lifecycle events (TOKEN_REFRESHED, SIGNED_OUT, SIGNED_IN, INITIAL_SESSION, PASSWORD_RECOVERY).
 */
export function initAuthListener() {
    const sb = getSupabase();
    if (!sb || !sb.auth || typeof sb.auth.onAuthStateChange !== 'function') return;
    if (sb.auth._nishaAuthListenerBound) return;
    sb.auth._nishaAuthListenerBound = true;

    const triggerPasswordRecoveryFlow = async (session) => {
        clearPendingPasswordRecoveryFlag();
        if (session?.user && !profileState.currentUser) {
            await checkSession();
        }
        showPasswordRecoveryModal();
    };

    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
            if (window.__NISHA_DEBUG__) console.log('[AUTH] Токен безопасности успешно продлен (Refresh Token).');
            profileState.currentUser = session.user;
        } else if (event === 'SIGNED_OUT') {
            if (window.__NISHA_DEBUG__) console.log('[AUTH] Выполнен выход из аккаунта.');
            clearPendingPasswordRecoveryFlag();
            profileState.globalOrdersData = [];
            const store = getStore();
            if (store) {
                store.remove('nisha_cached_orders');
                store.remove('nisha_cached_favorites');
            }
            resetSignedOutProfileUI();
        } else if (event === 'PASSWORD_RECOVERY') {
            await triggerPasswordRecoveryFlow(session);
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session?.user && hasPendingPasswordRecoveryFlag()) {
                await triggerPasswordRecoveryFlow(session);
                return;
            }
            if (event === 'SIGNED_IN' && !profileState.currentUser) {
                await checkSession();
            }
        }
    });

    // Fallback: if PASSWORD_RECOVERY already fired before listener bound, check active session + pending flag
    if (hasPendingPasswordRecoveryFlag() && typeof sb.auth.getSession === 'function') {
        Promise.resolve(sb.auth.getSession())
            .then((res) => {
                const session = res?.data?.session;
                if (session?.user && hasPendingPasswordRecoveryFlag()) {
                    return triggerPasswordRecoveryFlow(session);
                }
                return undefined;
            })
            .catch(() => {});
    }
}
bindWindowFn('initAuthListener', initAuthListener);
