// ==========================================
// NISHA AUTH & SECURITY MODULE (OTP & Turnstile)
// ==========================================

import { store, storage, apiClient, showToast } from '../../src/modules/index.js';
import { invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeSupabase, getTurnstileApi, tSafe } from '../core/runtime-env.js';

// --- CLOUDFLARE TURNSTILE (CAPTCHA / BOT SHIELD) ---
const locHost = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
const locProto = (typeof window !== 'undefined' && window.location && window.location.protocol) || '';
const isLocalhost = Boolean(
    locHost === 'localhost' ||
    locHost === '[::1]' ||
    locHost === '127.0.0.1' ||
    locHost.startsWith('192.168.') ||
    locHost.startsWith('10.') ||
    locProto === 'file:'
);

// Для локальной разработки используем официальный тестовый ключ Cloudflare (Always passes),
// чтобы challenges.cloudflare.com не возвращал ошибку 401 Unauthorized из-за несовпадения домена.
// На боевом домене (nisha-store.shop) используется продакшн-ключ.
const TURNSTILE_SITE_KEY = isLocalhost 
    ? '1x00000000000000000000AA' 
    : '0x4AAAAAAFPA7MSg5EklX3ye';

let turnstileOtpWidgetId = null;
let turnstilePropWidgetId = null;
let _turnstileLoadPromise = null;
let _turnstileOtpToken = null;
let _checkActiveOtp = null;
window._turnstilePropToken = null;

function ensureTurnstileLoaded() {
    const existingTs = getTurnstileApi();
    if (existingTs) {
        return Promise.resolve(existingTs);
    }
    if (_turnstileLoadPromise) {
        return _turnstileLoadPromise;
    }
    if (typeof document === 'undefined') {
        return Promise.resolve(null);
    }

    const { promise, resolve } = typeof Promise.withResolvers === 'function'
        ? Promise.withResolvers()
        : (() => {
            let res;
            const p = new Promise((r) => { res = r; });
            return { promise: p, resolve: res };
        })();
    _turnstileLoadPromise = promise;

    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');
    if (existing) {
        const tsApi = getTurnstileApi();
        if (tsApi) {
            resolve(tsApi);
        } else {
            existing.addEventListener('load', () => resolve(getTurnstileApi()), { once: true });
            existing.addEventListener('error', () => {
                _turnstileLoadPromise = null;
                resolve(null);
            }, { once: true });
        }
        return _turnstileLoadPromise;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(getTurnstileApi());
    script.onerror = () => {
        _turnstileLoadPromise = null;
        resolve(null);
    };
    (document.head || document.documentElement).appendChild(script);

    return _turnstileLoadPromise;
}
window.ensureTurnstileLoaded = ensureTurnstileLoaded;

function initTurnstileOtpWidget() {
    const ts = getTurnstileApi();
    if (!ts) return;
    const otpContainer = document.getElementById('turnstile-otp-container');
    if (otpContainer && turnstileOtpWidgetId === null) {
        try {
            turnstileOtpWidgetId = ts.render('#turnstile-otp-container', {
                sitekey: TURNSTILE_SITE_KEY,
                size: 'compact',
                callback: function(token) {
                    _turnstileOtpToken = token;
                },
                'expired-callback': function() {
                    _turnstileOtpToken = null;
                },
                'error-callback': function() {
                    _turnstileOtpToken = null;
                }
            });
        } catch(e) {
            console.warn('[TURNSTILE OTP ERROR]', e);
        }
    }
}

function initTurnstilePropWidget() {
    const ts = getTurnstileApi();
    if (!ts) return;
    const propContainer = document.getElementById('turnstile-prop-container');
    if (propContainer && turnstilePropWidgetId === null) {
        try {
            turnstilePropWidgetId = ts.render('#turnstile-prop-container', {
                sitekey: TURNSTILE_SITE_KEY,
                size: 'compact',
                callback: function(token) {
                    window._turnstilePropToken = token;
                },
                'expired-callback': function() {
                    window._turnstilePropToken = null;
                },
                'error-callback': function() {
                    window._turnstilePropToken = null;
                }
            });
            window.turnstilePropWidgetId = turnstilePropWidgetId;
        } catch(e) {
            console.warn('[TURNSTILE PROP ERROR]', e);
        }
    }
}

function initTurnstileWidgets() {
    if (getTurnstileApi()) {
        initTurnstileOtpWidget();
        initTurnstilePropWidget();
        return;
    }
    ensureTurnstileLoaded().then((ts) => {
        if (ts || getTurnstileApi()) {
            initTurnstileOtpWidget();
            initTurnstilePropWidget();
        }
    });
}
window.initTurnstileWidgets = initTurnstileWidgets;

// --- КОНТАКТНЫЕ ДАННЫЕ ЮЗЕРА ---
function getUserPhone() {
    const activeUser = store.user || (typeof window !== 'undefined' ? window.currentUser : null);
    const profile = store.profile || (typeof window !== 'undefined' ? window.userProfile : null);
    if (profile?.phone && profile.phone.trim()) {
        return profile.phone.trim();
    }
    if (activeUser?.phone && activeUser.phone.trim()) {
        return activeUser.phone.trim();
    }
    if (activeUser?.user_metadata?.phone && activeUser.user_metadata.phone.trim()) {
        return activeUser.user_metadata.phone.trim();
    }
    return (storage ? storage.get('nisha_last_phone', '') : (typeof localStorage !== 'undefined' ? localStorage.getItem('nisha_last_phone') : '') || '').trim();
}
window.getUserPhone = getUserPhone;

function getUserTg() {
    const activeUser = store.user || (typeof window !== 'undefined' ? window.currentUser : null);
    const profile = store.profile || (typeof window !== 'undefined' ? window.userProfile : null);
    if (profile?.tg && profile.tg.trim()) {
        return profile.tg.trim();
    }
    if (activeUser?.user_metadata?.tg && activeUser.user_metadata.tg.trim()) {
        return activeUser.user_metadata.tg.trim();
    }
    return (storage ? storage.get('nisha_last_tg', '') : (typeof localStorage !== 'undefined' ? localStorage.getItem('nisha_last_tg') : '') || '').trim();
}

export function isPhoneMatchingVerified(inputPhone, verifiedPhone) {
    if (!inputPhone || !verifiedPhone) return false;
    const cleanA = String(inputPhone).replace(/\D/g, '');
    const cleanB = String(verifiedPhone).replace(/\D/g, '');
    if (!cleanA || !cleanB) return false;
    if (cleanA === cleanB) return true;
    if (cleanA.length >= 9 && cleanB.length >= 9) {
        return cleanA.slice(-9) === cleanB.slice(-9);
    }
    return false;
}

export function setOtpButtonSuccess(btnOtp) {
    if (!btnOtp) return;
    const successText = tSafe('checkout.btn_otp_success', 'УСПЕХ ✓');
    btnOtp.classList.add('btn-otp-success');
    btnOtp.setAttribute('data-i18n', 'checkout.btn_otp_success');
    btnOtp.disabled = true;
    btnOtp.style.display = 'block';
    btnOtp.style.pointerEvents = 'none';
    btnOtp.style.cursor = 'default';
    btnOtp.style.background = '#141414';
    btnOtp.style.borderColor = '#777';
    btnOtp.style.borderStyle = 'outset';
    btnOtp.style.opacity = '1';
    btnOtp.innerHTML = `<span class="otp-btn-success-label">${successText}</span>`;
}

export function setOtpButtonDefault(btnOtp) {
    if (!btnOtp) return;
    const defaultText = tSafe('checkout.btn_otp', 'Подтвердить');
    btnOtp.classList.remove('btn-otp-success');
    btnOtp.setAttribute('data-i18n', 'checkout.btn_otp');
    btnOtp.disabled = false;
    btnOtp.style.display = 'block';
    btnOtp.style.pointerEvents = 'auto';
    btnOtp.style.cursor = 'pointer';
    btnOtp.style.background = 'var(--text-main)';
    btnOtp.style.borderColor = '#eee';
    btnOtp.style.borderStyle = 'outset';
    btnOtp.style.opacity = '1';
    btnOtp.textContent = defaultText;
}

// Автоподстановка контактов в форму предложки и оформление заказа
function updateProposeAndCheckoutFields() {
    const phone = getUserPhone();
    const tg = getUserTg();
    const activeUser = store.user || (typeof window !== 'undefined' ? window.currentUser : null);
    const profile = store.profile || (typeof window !== 'undefined' ? window.userProfile : null);
    const hasVerifiedProfilePhone = Boolean(phone);
    const hasVerifiedProfileTg = Boolean(tg);

    // 1. Предложка: если заполнены и телефон, и tg в профиле — поле связи скрывается, иначе остается редактируемым
    const propContactWrap = document.getElementById('propContactWrapper');
    const propContactInput = document.getElementById('propContact');
    if (hasVerifiedProfilePhone && hasVerifiedProfileTg && (activeUser || profile)) {
        if (propContactWrap) propContactWrap.style.display = 'none';
        if (propContactInput) propContactInput.value = `${tg} | ${phone}`;
    } else {
        if (propContactWrap) propContactWrap.style.display = 'block';
        if (propContactInput && !propContactInput.value && (phone || tg)) {
            propContactInput.value = [tg, phone].filter(Boolean).join(' | ');
        }
    }

    // 2. Оформление заказа: поле телефона всегда остается видимым
    const checkoutPhoneWrap = document.getElementById('checkoutPhoneWrapper');
    const orderPhoneInput = document.getElementById('orderPhone');
    const btnOtp = document.getElementById('btnGetOtp');
    const statusOtp = document.getElementById('otpStatus');
    const btnSubmit = document.getElementById('btnSubmitOrder');

    if (checkoutPhoneWrap) checkoutPhoneWrap.style.display = 'flex';

    if (orderPhoneInput && phone) {
        if (!orderPhoneInput.value || !orderPhoneInput.dataset.userTyped) {
            orderPhoneInput.value = phone;
        }
    }

    const currentInputPhone = orderPhoneInput?.value || '';
    if (phone && isPhoneMatchingVerified(currentInputPhone, phone)) {
        window.otpVerified = true;
        otpVerified = true;
        if (btnSubmit) {
            btnSubmit.style.opacity = '1';
            btnSubmit.style.pointerEvents = 'auto';
        }
        if (statusOtp) statusOtp.style.display = 'none';
        if (orderPhoneInput) {
            orderPhoneInput.classList.add('input-valid');
            orderPhoneInput.classList.remove('input-invalid');
        }
        if (btnOtp) {
            setOtpButtonSuccess(btnOtp);
        }
    }
}
window.updateProposeAndCheckoutFields = updateProposeAndCheckoutFields;

// --- ПЕСОЧНЫЕ ЧАСЫ (WIN95 SVG ДЛЯ СТАТУСА) ---
function getWin95HourglassHtml(height = 14) {
    return `<svg class="win95-pixel-hourglass" style="height:${height}px;width:auto" viewBox="0 0 15 24" shape-rendering="crispEdges">
<path fill="#fff" d="M3,4 H12 V8 H11 V9 H10 V10 H9 V11 H8 V13 H9 V14 H10 V15 H11 V16 H12 V20 H3 V16 H4 V15 H5 V14 H6 V13 H7 V11 H6 V10 H5 V9 H4 V8 H3 Z" />
<rect x="3" y="2" width="9" height="1" fill="#fff" />
<rect x="3" y="21" width="9" height="1" fill="#fff" />
<g class="hg-top-1"><rect x="3" y="4" width="9" height="1" fill="#000" /></g>
<g class="hg-top-2"><rect x="3" y="5" width="9" height="1" fill="#000" /></g>
<g class="hg-top-3"><rect x="3" y="6" width="9" height="1" fill="#000" /></g>
<g class="hg-top-4"><rect x="4" y="7" width="7" height="1" fill="#000" /></g>
<g class="hg-top-5"><rect x="5" y="8" width="5" height="1" fill="#000" /></g>
<g class="hg-top-6"><rect x="6" y="9" width="3" height="1" fill="#000" /><rect x="7" y="10" width="1" height="1" fill="#000" /></g>
<g class="hg-stream"><rect class="hg-drop-1" x="7" y="11" width="1" height="1" fill="#000" /><rect class="hg-drop-2" x="7" y="13" width="1" height="1" fill="#000" /></g>
<g class="hg-bot-1"><rect x="3" y="19" width="9" height="1" fill="#000" /></g>
<g class="hg-bot-2"><rect x="3" y="18" width="9" height="1" fill="#000" /></g>
<g class="hg-bot-3"><rect x="4" y="17" width="7" height="1" fill="#000" /></g>
<g class="hg-bot-4"><rect x="5" y="16" width="5" height="1" fill="#000" /></g>
<g class="hg-bot-5"><rect x="6" y="15" width="3" height="1" fill="#000" /><rect x="7" y="14" width="1" height="1" fill="#000" /></g>
<g class="hg-bot-sand"><rect x="6" y="18" width="3" height="2" fill="#fff" /></g>
</svg>`;
}

// --- OTP ПОДТВЕРЖДЕНИЕ НОМЕРА ТЕЛЕФОНА (ЧЕКАУТ) ---
let otpVerified = false;
window.otpVerified = otpVerified;
let otpInterval = null;
let _otpPollSessionToken = 0;
let _otpCheckInFlight = null;

function stopOtpCountdown() {
    if (otpInterval) {
        clearInterval(otpInterval);
        otpInterval = null;
    }
}

export function stopOtpPolling() {
    _otpPollSessionToken++;
    _otpCheckInFlight = null;
    _checkActiveOtp = null;
    if (typeof window !== 'undefined' && window.otpPollInterval) {
        clearTimeout(window.otpPollInterval);
        clearInterval(window.otpPollInterval);
        window.otpPollInterval = null;
    }
}
if (typeof window !== 'undefined') {
    window.stopOtpPolling = stopOtpPolling;
}

async function checkPhoneAuth() {
    const sb = getRuntimeSupabase();
    const btnSubmit = document.getElementById('btnSubmitOrder');
    const btnOtp = document.getElementById('btnGetOtp');
    const statusOtp = document.getElementById('otpStatus');
    const rawPhone = document.getElementById('orderPhone')?.value || '';
    const cleanPhone = rawPhone.replace(/[^\d+]/g, ''); 

    const uPhone = (typeof getUserPhone === 'function' ? getUserPhone() : '').replace(/[^\d+]/g, '');
    const isProfileVerified = Boolean(uPhone && isPhoneMatchingVerified(cleanPhone, uPhone));

    if (isProfileVerified) {
        otpVerified = true;
        window.otpVerified = true;
        if (storage) storage.set('nisha_last_phone', cleanPhone);
        if (btnSubmit) {
            btnSubmit.style.opacity = '1';
            btnSubmit.style.pointerEvents = 'auto';
        }
        if (statusOtp) statusOtp.style.display = 'none';
        const phoneEl = document.getElementById('orderPhone');
        if (phoneEl) {
            phoneEl.classList.add('input-valid');
            phoneEl.classList.remove('input-invalid');
        }
        if (btnOtp) {
            setOtpButtonSuccess(btnOtp);
        }
        return;
    } 

    // Блокируем кнопку заказа по умолчанию
    otpVerified = false;
    window.otpVerified = false;
    if (btnSubmit) {
        btnSubmit.style.opacity = '0.5';
        btnSubmit.style.pointerEvents = 'none';
    }

    // Если номер короткий - просто показываем кнопку подтверждения
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
        if (btnOtp) {
            setOtpButtonDefault(btnOtp);
        }
        if (statusOtp) statusOtp.style.display = 'block';
        return;
    }

    // Проверяем статус в базе
    if (sb) {
        try {
            const { data: vResult } = await sb.rpc('check_otp_verified', { p_phone: cleanPhone });
            const existCode = vResult ? [{ is_verified: true }] : [];
            
            if (existCode && existCode.length > 0 && existCode[0].is_verified) {
                // Номер уже подтвержден
                otpVerified = true;
                window.otpVerified = true;
                if (storage) storage.set('nisha_last_phone', cleanPhone);
                if (btnSubmit) {
                    btnSubmit.style.opacity = '1';
                    btnSubmit.style.pointerEvents = 'auto';
                }
                if (statusOtp) statusOtp.style.display = 'none';
                const phoneEl = document.getElementById('orderPhone');
                if (phoneEl) {
                    phoneEl.classList.add('input-valid');
                    phoneEl.classList.remove('input-invalid');
                }
                if (btnOtp) {
                    setOtpButtonSuccess(btnOtp);
                }
            } else {
                // Номер есть, но еще не подтвержден
                if (btnOtp) {
                    setOtpButtonDefault(btnOtp);
                }
                if (statusOtp) statusOtp.style.display = 'block';
            }
        } catch (err) {
            console.warn('[checkPhoneAuth] Ошибка проверки RPC:', err);
        }
    }
}
window.checkPhoneAuth = checkPhoneAuth;

async function generateAndSendOTP() {
    const sb = getRuntimeSupabase();
    const rawPhone = document.getElementById('orderPhone')?.value || '';
    const cleanPhone = rawPhone.replace(/[^\d+]/g, ''); 
    
    if (!cleanPhone || cleanPhone.length < 10) {
        showToast(tSafe('orders_modal.err_phone', 'Введите корректный номер телефона!'), 'error');
        return;
    }

    const btnOtp = document.getElementById('btnGetOtp');
    if (!btnOtp || btnOtp.disabled) return;

    // Проверяем: если уже подтвержден в профиле
    const uPhone = (typeof getUserPhone === 'function' ? getUserPhone() : '').replace(/[^\d+]/g, '');
    if (uPhone && isPhoneMatchingVerified(cleanPhone, uPhone)) {
        checkPhoneAuth();
        return;
    }

    // Токен Turnstile из памяти
    const widgetId = turnstileOtpWidgetId;
    const tsApi = getTurnstileApi();
    let turnToken = _turnstileOtpToken || (tsApi && widgetId !== null && widgetId !== undefined ? tsApi.getResponse(widgetId) : null);
    
    // Блокируем кнопку от двойных нажатий
    btnOtp.disabled = true;
    btnOtp.textContent = tSafe('auth.db_connecting', 'Связь с БД...');
    btnOtp.style.opacity = '0.5';

    // Верификация капчи на бэкенде
    if (turnToken) {
        try {
            const vData = await apiClient.post('/api/verify-turnstile', { token: turnToken }, { timeout: 8000 });
            if (!vData || !vData.success) {
                showToast(tSafe('auth.turnstile_err', 'Ошибка проверки безопасности Turnstile'), 'error');
                if (tsApi && widgetId !== null && widgetId !== undefined) {
                    tsApi.reset(widgetId);
                }
                _turnstileOtpToken = null;
                setOtpButtonDefault(btnOtp);
                return;
            }
        } catch(err) {
            console.warn('[TURNSTILE VERIFY FAILOVER]', err);
        }
    }

    if (!sb) {
        setOtpButtonDefault(btnOtp);
        return;
    }

    // 1. Проверяем черный список
    let blacklisted = null;
    try {
        const blRes = await sb.from('blacklist').select('phone').eq('phone', cleanPhone).limit(1);
        blacklisted = blRes?.data || null;
    } catch (err) {
        console.error('[OTP] blacklist check error:', err);
        showToast(tSafe('checkout.promo_error', 'Ошибка сервера'), 'error');
        setOtpButtonDefault(btnOtp);
        return;
    }
    if (blacklisted && blacklisted.length > 0) {
        const statusEl = document.getElementById('otpStatus');
        const secBlockedText = tSafe('profile.security_blocked', '[!] ОШИБКА БЕЗОПАСНОСТИ: ВАШ НОМЕР ЗАБЛОКИРОВАН');
        if (statusEl) statusEl.innerHTML = `<span class="otp-status-blocked">${secBlockedText}</span>`;
        showToast(tSafe('auth.access_denied', 'Доступ запрещен'), 'error');
        setOtpButtonDefault(btnOtp);
        return; 
    }
    
    // 2. Двойная проверка: вдруг номер уже подтвержден
    let vResult = null;
    try {
        const vRes = await sb.rpc('check_otp_verified', { p_phone: cleanPhone });
        vResult = vRes?.data || null;
    } catch (err) {
        console.error('[OTP] check_otp_verified error:', err);
        showToast(tSafe('checkout.promo_error', 'Ошибка сервера'), 'error');
        setOtpButtonDefault(btnOtp);
        return;
    }
    const existCode = vResult ? [{ is_verified: true }] : [];
    if (existCode && existCode.length > 0 && existCode[0].is_verified) {
        checkPhoneAuth();
        return; 
    }

    // 3. Таймер ожидания (60 сек) на основе временной метки (не замерзает при сворачивании)
    const otpEndTime = Date.now() + 60 * 1000;
    const updateOtpBtnText = () => {
        const remaining = Math.max(0, Math.ceil((otpEndTime - Date.now()) / 1000));
        if (remaining > 0) {
            btnOtp.textContent = tSafe('auth.wait_sec', `Ждите ${remaining}с`, { sec: remaining });
            return false;
        } else {
            if (otpInterval) {
                clearInterval(otpInterval);
                otpInterval = null;
            }
            setOtpButtonDefault(btnOtp);
            return true;
        }
    };

    updateOtpBtnText();
    if (otpInterval) clearInterval(otpInterval);
    otpInterval = setInterval(updateOtpBtnText, 1000);

    // 4. Генерация кода в базе
    let otpError = null;
    try {
        const genRes = await sb.rpc('generate_secure_otp', { p_phone: cleanPhone });
        otpError = genRes?.error || null;
    } catch (err) {
        otpError = err;
    }
    if (otpError) {
        showToast(tSafe('checkout.promo_error', 'Ошибка сервера'), 'error');
        if (otpInterval) {
            clearInterval(otpInterval);
            otpInterval = null;
        }
        setOtpButtonDefault(btnOtp);
        return;
    }
    
    // 5. Получаем одноразовый токен и открываем Telegram-бота
    const payloadPhone = cleanPhone.replace('+', '');
    const activeUser = store.user;
    let tgLink = '';
    try {
        if (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.post === 'function') {
            const tokenRes = await window.apiClient.post('/api/auth/telegram-link-token', {
                type: 'otp',
                phone: cleanPhone
            }, { timeout: 8000, retries: 1 });
            if (tokenRes && tokenRes.botUrl) tgLink = tokenRes.botUrl;
        }
    } catch {}

    if (!tgLink) {
        if (!activeUser || !activeUser.id) {
            // Гостевой фоллбэк без UUID (не изменяет profiles)
            tgLink = `https://t.me/nisha_store1_bot?start=otp_${payloadPhone}`;
        } else {
            showToast(tSafe('checkout.promo_error', 'Ошибка сервера'), 'error');
            clearInterval(otpInterval);
            setOtpButtonDefault(btnOtp);
            return;
        }
    }
    
    if (/android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase())) {
        window.location.href = tgLink;
    } else {
        window.open(tgLink, '_blank', 'noopener,noreferrer');
    }
    
    const statusEl = document.getElementById('otpStatus');
    if (statusEl) {
        const botPromptText = tSafe('profile.go_to_bot_phone', "Перейдите в бота и нажмите 'СТАРТ' для подтверждения... ");
        statusEl.innerHTML = botPromptText + ' ' + getWin95HourglassHtml(14);
    }
    
    // 6. Сериализованный опрос базы данных каждые 2 секунды без наложения запросов (таймаут 2.5 минуты)
    stopOtpPolling();

    const pollSession = ++_otpPollSessionToken;
    const pollDeadline = Date.now() + 150 * 1000;
    const POLL_INTERVAL_MS = 2000;

    const doOtpCheck = () => {
        if (pollSession !== _otpPollSessionToken || !window.otpPollInterval) {
            return Promise.resolve(false);
        }
        if (_otpCheckInFlight) {
            return _otpCheckInFlight;
        }

        _otpCheckInFlight = (async () => {
            try {
                const { data: isVerified, error: rpcErr } = await sb.rpc('check_otp_verified', { p_phone: cleanPhone });
                if (pollSession !== _otpPollSessionToken) return false;
                if (!rpcErr && isVerified) {
                    stopOtpPolling();
                    stopOtpCountdown();
                    checkPhoneAuth();
                    return true;
                }
            } catch (pollErr) {
                console.warn('[OTP POLL] Ошибка проверки статуса:', pollErr);
            } finally {
                _otpCheckInFlight = null;
            }
            return false;
        })();

        return _otpCheckInFlight;
    };
    _checkActiveOtp = doOtpCheck;

    const scheduleNextPoll = () => {
        if (pollSession !== _otpPollSessionToken) return;
        window.otpPollInterval = setTimeout(async () => {
            if (pollSession !== _otpPollSessionToken || !window.otpPollInterval) return;

            if (Date.now() >= pollDeadline) {
                stopOtpPolling();
                stopOtpCountdown();
                if (btnOtp) {
                    setOtpButtonDefault(btnOtp);
                }
                if (statusEl) {
                    const expiredMsg = tSafe('checkout.otp_expired', 'Время ожидания подтверждения истекло. Запросите код снова.');
                    statusEl.innerHTML = `<span class="otp-status-expired">${expiredMsg}</span>`;
                }
                return;
            }

            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                scheduleNextPoll();
                return; // Пропускаем опрос при скрытой вкладке для экономии ресурсов
            }

            const verified = await doOtpCheck();
            if (!verified && pollSession === _otpPollSessionToken && window.otpPollInterval) {
                scheduleNextPoll();
            }
        }, POLL_INTERVAL_MS);
    };

    scheduleNextPoll();
}

// Мгновенная проверка OTP и восстановление таймера при возврате пользователя во вкладку
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (typeof _checkActiveOtp === 'function') {
            _checkActiveOtp();
        }
        if (storage && storage.get('nisha_pending_otp_phone')) {
            invokeAction('checkPendingPhoneVerification');
        }
        if (storage && storage.get('nisha_pending_otp_tg')) {
            invokeAction('checkPendingTgVerification');
        }
    }
});

registerActions({
    ensureTurnstileLoaded,
    initTurnstileOtpWidget,
    initTurnstilePropWidget,
    initTurnstileWidgets,
    getUserPhone,
    getUserTg,
    isPhoneMatchingVerified,
    setOtpButtonSuccess,
    setOtpButtonDefault,
    updateProposeAndCheckoutFields,
    getWin95HourglassHtml,
    checkPhoneAuth,
    generateAndSendOTP,
    stopOtpPolling
});
