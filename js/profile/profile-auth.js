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
        const promptFn = getGlobalFn('prompt');
        const userPrompt = promptFn ? promptFn(promptText) : null;
        if (userPrompt === null) return;
        email = userPrompt.trim();
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
 * Subscribes to Supabase auth state lifecycle events (TOKEN_REFRESHED, SIGNED_OUT, SIGNED_IN).
 */
export function initAuthListener() {
    const sb = getSupabase();
    if (!sb || !sb.auth || typeof sb.auth.onAuthStateChange !== 'function') return;

    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
            if (window.__NISHA_DEBUG__) console.log('[AUTH] Токен безопасности успешно продлен (Refresh Token).');
            profileState.currentUser = session.user;
        } else if (event === 'SIGNED_OUT') {
            if (window.__NISHA_DEBUG__) console.log('[AUTH] Выполнен выход из аккаунта.');
            profileState.globalOrdersData = [];
            const store = getStore();
            if (store) {
                store.remove('nisha_cached_orders');
                store.remove('nisha_cached_favorites');
            }
            resetSignedOutProfileUI();
        } else if (event === 'SIGNED_IN') {
            if (!profileState.currentUser) await checkSession();
        }
    });
}
bindWindowFn('initAuthListener', initAuthListener);
