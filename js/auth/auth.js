// ==========================================
// NISHA AUTH & SECURITY MODULE (OTP & Turnstile)
// ==========================================

import { store, storage, apiClient, showToast } from '../../src/modules/index.js';

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
window.TURNSTILE_SITE_KEY = TURNSTILE_SITE_KEY;

let turnstileOtpWidgetId = null;
let turnstilePropWidgetId = null;
window._turnstileOtpToken = null;
window._turnstilePropToken = null;

function initTurnstileOtpWidget() {
    if (typeof turnstile === 'undefined') return;
    const otpContainer = document.getElementById('turnstile-otp-container');
    if (otpContainer && turnstileOtpWidgetId === null) {
        try {
            turnstileOtpWidgetId = turnstile.render('#turnstile-otp-container', {
                sitekey: TURNSTILE_SITE_KEY,
                size: 'compact',
                callback: function(token) {
                    window._turnstileOtpToken = token;
                },
                'expired-callback': function() {
                    window._turnstileOtpToken = null;
                },
                'error-callback': function() {
                    window._turnstileOtpToken = null;
                }
            });
            window.turnstileOtpWidgetId = turnstileOtpWidgetId;
        } catch(e) {
            console.warn('[TURNSTILE OTP ERROR]', e);
        }
    }
}
window.initTurnstileOtpWidget = initTurnstileOtpWidget;

function initTurnstilePropWidget() {
    if (typeof turnstile === 'undefined') return;
    const propContainer = document.getElementById('turnstile-prop-container');
    if (propContainer && turnstilePropWidgetId === null) {
        try {
            turnstilePropWidgetId = turnstile.render('#turnstile-prop-container', {
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
window.initTurnstilePropWidget = initTurnstilePropWidget;

function initTurnstileWidgets() {
    if (typeof turnstile === 'undefined') {
        if (!window._turnstileRetryCount) window._turnstileRetryCount = 0;
        if (window._turnstileRetryCount < 6) {
            window._turnstileRetryCount++;
            setTimeout(initTurnstileWidgets, 500);
        }
        return;
    }
    initTurnstileOtpWidget();
    initTurnstilePropWidget();
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
window.getUserTg = getUserTg;

function isPhoneMatchingVerified(inputPhone, verifiedPhone) {
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
window.isPhoneMatchingVerified = isPhoneMatchingVerified;

function setOtpButtonSuccess(btnOtp) {
    if (!btnOtp) return;
    const successText = typeof i18next !== 'undefined'
        ? i18next.t('checkout.btn_otp_success', { defaultValue: 'УСПЕХ ✓' })
        : 'УСПЕХ ✓';
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
    btnOtp.innerHTML = `<span style="color:var(--accent-green, #00ff00); font-weight:bold; font-family:var(--font-mono); letter-spacing:0.5px;">${successText}</span>`;
}
window.setOtpButtonSuccess = setOtpButtonSuccess;

function setOtpButtonDefault(btnOtp) {
    if (!btnOtp) return;
    const defaultText = typeof i18next !== 'undefined'
        ? i18next.t('checkout.btn_otp', { defaultValue: 'Подтвердить' })
        : 'Подтвердить';
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
    btnOtp.innerText = defaultText;
}
window.setOtpButtonDefault = setOtpButtonDefault;

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
window.getWin95HourglassHtml = getWin95HourglassHtml;

// --- OTP ПОДТВЕРЖДЕНИЕ НОМЕРА ТЕЛЕФОНА (ЧЕКАУТ) ---
let otpVerified = false;
window.otpVerified = otpVerified;
let otpInterval = null;

async function checkPhoneAuth() {
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
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
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    const rawPhone = document.getElementById('orderPhone')?.value || '';
    const cleanPhone = rawPhone.replace(/[^\d+]/g, ''); 
    
    if (!cleanPhone || cleanPhone.length < 10) {
        showToast(typeof i18next !== 'undefined' ? i18next.t('orders_modal.err_phone', { defaultValue: 'Введите корректный номер телефона!' }) : 'Введите корректный номер телефона!', 'error');
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
    const widgetId = (typeof turnstileOtpWidgetId !== 'undefined') ? turnstileOtpWidgetId : window.turnstileOtpWidgetId;
    let turnToken = window._turnstileOtpToken || (typeof turnstile !== 'undefined' && widgetId !== null && widgetId !== undefined ? turnstile.getResponse(widgetId) : null);
    
    // Блокируем кнопку от двойных нажатий
    btnOtp.disabled = true;
    btnOtp.innerText = typeof i18next !== 'undefined' ? i18next.t('auth.db_connecting', { defaultValue: 'Связь с БД...' }) : 'Связь с БД...';
    btnOtp.style.opacity = '0.5';

    // Верификация капчи на бэкенде
    if (turnToken) {
        try {
            const vData = await apiClient.post('/api/verify-turnstile', { token: turnToken }, { timeout: 8000 });
            if (!vData || !vData.success) {
                showToast(typeof i18next !== 'undefined' ? i18next.t('auth.turnstile_err', { defaultValue: 'Ошибка проверки безопасности Turnstile' }) : 'Ошибка проверки безопасности Turnstile', 'error');
                if (typeof turnstile !== 'undefined' && widgetId !== null && widgetId !== undefined) {
                    turnstile.reset(widgetId);
                }
                window._turnstileOtpToken = null;
                setOtpButtonDefault(btnOtp);
                return;
            }
        } catch(err) {
            console.warn('[TURNSTILE VERIFY FAILOVER]', err);
        }
    }

    if (!sb) return;

    // 1. Проверяем черный список
    const { data: blacklisted } = await sb.from('blacklist').select('phone').eq('phone', cleanPhone).limit(1);
    if (blacklisted && blacklisted.length > 0) {
        const statusEl = document.getElementById('otpStatus');
        const secBlockedText = typeof i18next !== 'undefined' ? i18next.t('profile.security_blocked', { defaultValue: '[!] ОШИБКА БЕЗОПАСНОСТИ: ВАШ НОМЕР ЗАБЛОКИРОВАН' }) : '[!] ОШИБКА БЕЗОПАСНОСТИ. ВАШ НОМЕР ЗАБЛОКИРОВАН.';
        if (statusEl) statusEl.innerHTML = `<span style='color:red; font-weight:bold;'>${secBlockedText}</span>`;
        showToast(typeof i18next !== 'undefined' ? i18next.t('auth.access_denied', { defaultValue: 'Доступ запрещен' }) : 'Доступ запрещен', 'error');
        setOtpButtonDefault(btnOtp);
        return; 
    }
    
    // 2. Двойная проверка: вдруг номер уже подтвержден
    const { data: vResult } = await sb.rpc('check_otp_verified', { p_phone: cleanPhone });
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
            btnOtp.innerText = typeof i18next !== 'undefined' ? i18next.t('auth.wait_sec', { sec: remaining, defaultValue: `Ждите ${remaining}с` }) : `Ждите ${remaining}с`;
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
    const { error } = await sb.rpc('generate_secure_otp', { p_phone: cleanPhone });
    if (error) {
        showToast(typeof i18next !== 'undefined' ? i18next.t('checkout.promo_error', { defaultValue: 'Ошибка сервера' }) : 'Ошибка сервера', 'error');
        clearInterval(otpInterval);
        setOtpButtonDefault(btnOtp);
        return;
    }
    
    // 5. Открываем Telegram-бота
    const payloadPhone = cleanPhone.replace('+', '');
    const activeUser = store.user;
    const userPrefix = (activeUser && activeUser.id) ? `${activeUser.id}_` : '';
    const tgLink = `https://t.me/nisha_store1_bot?start=otp_${userPrefix}${payloadPhone}`;
    
    if (/android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase())) {
        window.location.href = tgLink;
    } else {
        window.open(tgLink, '_blank');
    }
    
    const statusEl = document.getElementById('otpStatus');
    if (statusEl) {
        const botPromptText = typeof i18next !== 'undefined' ? i18next.t('profile.go_to_bot_phone', { defaultValue: "Перейдите в бота и нажмите 'СТАРТ' для подтверждения... " }) : "Перейдите в бота и нажмите 'СТАРТ' для подтверждения... ";
        statusEl.innerHTML = botPromptText + ' ' + getWin95HourglassHtml(14);
    }
    
    // 6. Опрос базы данных каждые 2 секунды с таймаутом безопасности 2.5 минуты
    if (window.otpPollInterval) clearInterval(window.otpPollInterval);

    let pollAttempts = 0;
    const maxPollAttempts = 75; // 75 * 2с = 150 сек (2.5 минуты)

    const doOtpCheck = async () => {
        if (!window.otpPollInterval && pollAttempts > 0) return;
        const { data: isVerified } = await sb.rpc('check_otp_verified', { p_phone: cleanPhone });
        if (isVerified) {
            if (window.otpPollInterval) {
                clearInterval(window.otpPollInterval);
                window.otpPollInterval = null;
            }
            if (otpInterval) {
                clearInterval(otpInterval);
                otpInterval = null;
            }
            window._checkActiveOtp = null;
            checkPhoneAuth();
        }
    };
    window._checkActiveOtp = doOtpCheck;

    window.otpPollInterval = setInterval(async () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return; // Пропускаем опрос при скрытой вкладке для экономии ресурсов
        }
        pollAttempts++;
        if (pollAttempts >= maxPollAttempts) {
            clearInterval(window.otpPollInterval);
            window.otpPollInterval = null;
            window._checkActiveOtp = null;
            if (otpInterval) {
                clearInterval(otpInterval);
                otpInterval = null;
            }
            if (btnOtp) {
                setOtpButtonDefault(btnOtp);
            }
            if (statusEl) {
                const expiredMsg = typeof i18next !== 'undefined' ? i18next.t('checkout.otp_expired') : 'Время ожидания подтверждения истекло. Запросите код снова.';
                statusEl.innerHTML = `<span style="color:var(--accent-red);">${expiredMsg}</span>`;
            }
            return;
        }

        await doOtpCheck();
    }, 2000);
}
window.generateAndSendOTP = generateAndSendOTP;

// Мгновенная проверка OTP и восстановление таймера при возврате пользователя во вкладку
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (typeof window._checkActiveOtp === 'function') {
            window._checkActiveOtp();
        }
        if (typeof window.checkPendingPhoneVerification === 'function' && storage && storage.get('nisha_pending_otp_phone')) {
            window.checkPendingPhoneVerification();
        }
        if (typeof window.checkPendingTgVerification === 'function' && storage && storage.get('nisha_pending_otp_tg')) {
            window.checkPendingTgVerification();
        }
    }
});
