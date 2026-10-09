// ==========================================
// NISHA AUTH & SECURITY MODULE (OTP & Turnstile)
// ==========================================

// --- CLOUDFLARE TURNSTILE (CAPTCHA / BOT SHIELD) ---
const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.protocol === 'file:'
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

function initTurnstileWidgets() {
    if (typeof turnstile === 'undefined') {
        if (!window._turnstileRetryCount) window._turnstileRetryCount = 0;
        if (window._turnstileRetryCount < 6) {
            window._turnstileRetryCount++;
            setTimeout(initTurnstileWidgets, 500);
        }
        return;
    }

    // 1. Фоновый невидимый виджет для подтверждения номера телефона (OTP)
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

    // 2. Фоновый невидимый виджет для формы "Предложить вещь"
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
window.initTurnstileWidgets = initTurnstileWidgets;

window.addEventListener('load', () => {
    setTimeout(initTurnstileWidgets, 800);
});

// --- КОНТАКТНЫЕ ДАННЫЕ ЮЗЕРА ---
function getUserPhone() {
    const activeUser = (typeof currentUser !== 'undefined') ? currentUser : (window.currentUser || null);
    const profile = (typeof userProfile !== 'undefined') ? userProfile : (window.userProfile || null);
    if (activeUser) {
        return (profile?.phone || '').trim();
    }
    return (localStorage.getItem('nisha_last_phone') || '').trim();
}
window.getUserPhone = getUserPhone;

function getUserTg() {
    const activeUser = (typeof currentUser !== 'undefined') ? currentUser : (window.currentUser || null);
    const profile = (typeof userProfile !== 'undefined') ? userProfile : (window.userProfile || null);
    if (activeUser) {
        return (profile?.tg || '').trim();
    }
    return (localStorage.getItem('nisha_last_tg') || '').trim();
}
window.getUserTg = getUserTg;

// Автоподстановка контактов в форму предложки и оформление заказа
function updateProposeAndCheckoutFields() {
    const phone = getUserPhone();
    const tg = getUserTg();

    // 1. Предложка: если заполнены и телефон, и tg — поле связи пропадает
    const propContactWrap = document.getElementById('propContactWrapper');
    const propContactInput = document.getElementById('propContact');
    if (phone && tg) {
        if (propContactWrap) propContactWrap.style.display = 'none';
        if (propContactInput) propContactInput.value = `${tg} | ${phone}`;
    } else {
        if (propContactWrap) propContactWrap.style.display = 'block';
    }

    // 2. Оформление заказа: если номер есть в профиле — поле телефон скрывается
    const checkoutPhoneWrap = document.getElementById('checkoutPhoneWrapper');
    const orderPhoneInput = document.getElementById('orderPhone');
    if (phone) {
        if (checkoutPhoneWrap) checkoutPhoneWrap.style.display = 'none';
        if (orderPhoneInput) orderPhoneInput.value = phone;
        window.otpVerified = true;
        const btnSubmit = document.getElementById('btnSubmitOrder');
        if (btnSubmit) {
            btnSubmit.style.opacity = '1';
            btnSubmit.style.pointerEvents = 'auto';
        }
    } else {
        if (checkoutPhoneWrap) checkoutPhoneWrap.style.display = 'block';
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

    if (typeof getUserPhone === 'function') {
        const uPhone = getUserPhone().replace(/[^\d+]/g, '');
        if (uPhone && cleanPhone && cleanPhone === uPhone) {
            otpVerified = true;
            window.otpVerified = true;
            if (btnSubmit) {
                btnSubmit.style.opacity = '1';
                btnSubmit.style.pointerEvents = 'auto';
            }
            if (statusOtp) statusOtp.style.display = 'none';
            return;
        }
    } 

    // Блокируем кнопку заказа по умолчанию
    otpVerified = false;
    window.otpVerified = false;
    if (btnSubmit) {
        btnSubmit.style.opacity = '0.5';
        btnSubmit.style.pointerEvents = 'none';
    }

    // Если номер короткий - просто показываем кнопку подтверждения
    if (!cleanPhone || cleanPhone.length < 10) {
        if (btnOtp) {
            btnOtp.style.display = 'block';
            btnOtp.disabled = false;
            btnOtp.innerHTML = 'Подтвердить';
            btnOtp.style.background = 'var(--text-main)';
            btnOtp.style.borderColor = '#eee';
            btnOtp.style.opacity = '1';
        }
        if (statusOtp) statusOtp.style.display = 'block';
        return;
    }

    // Проверяем статус в базе
    if (sb) {
        const { data: vResult } = await sb.rpc('check_otp_verified', { p_phone: cleanPhone });
        const existCode = vResult ? [{ is_verified: true }] : [];
        
        if (existCode && existCode.length > 0 && existCode[0].is_verified) {
            // Номер уже подтвержден
            otpVerified = true;
            window.otpVerified = true;
            if (btnSubmit) {
                btnSubmit.style.opacity = '1';
                btnSubmit.style.pointerEvents = 'auto';
            }
            if (statusOtp) statusOtp.style.display = 'none';
            if (btnOtp) {
                btnOtp.style.display = 'block';
                btnOtp.disabled = true; 
                btnOtp.innerHTML = "<span style='color:var(--accent-green); font-weight:bold;'>УСПЕХ!</span>";
                btnOtp.style.background = 'var(--text-main)';
                btnOtp.style.borderColor = 'var(--accent-green)';
                btnOtp.style.opacity = '1';
            }
        } else {
            // Номер есть, но еще не подтвержден
            if (btnOtp) {
                btnOtp.style.display = 'block';
                btnOtp.disabled = false;
                btnOtp.innerHTML = 'Подтвердить';
                btnOtp.style.background = 'var(--text-main)';
                btnOtp.style.borderColor = '#eee';
                btnOtp.style.opacity = '1';
            }
            if (statusOtp) statusOtp.style.display = 'block';
        }
    }
}
window.checkPhoneAuth = checkPhoneAuth;

async function generateAndSendOTP() {
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    const rawPhone = document.getElementById('orderPhone')?.value || '';
    const cleanPhone = rawPhone.replace(/[^\d+]/g, ''); 
    
    if (!cleanPhone || cleanPhone.length < 10) {
        showToast('Введите корректный номер телефона!', 'error');
        return;
    }

    const btnOtp = document.getElementById('btnGetOtp');
    if (!btnOtp || btnOtp.disabled) return;

    // Токен Turnstile из памяти
    const widgetId = (typeof turnstileOtpWidgetId !== 'undefined') ? turnstileOtpWidgetId : window.turnstileOtpWidgetId;
    let turnToken = window._turnstileOtpToken || (typeof turnstile !== 'undefined' && widgetId !== null && widgetId !== undefined ? turnstile.getResponse(widgetId) : null);
    
    // Блокируем кнопку от двойных нажатий
    btnOtp.disabled = true;
    btnOtp.innerText = 'Связь с БД...';
    btnOtp.style.opacity = '0.5';

    // Верификация капчи на бэкенде
    if (turnToken) {
        try {
            const vRes = await fetch('https://nisha-api.onrender.com/api/verify-turnstile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: turnToken })
            });
            const vData = await vRes.json();
            if (!vData.success) {
                showToast('Ошибка проверки безопасности Turnstile', 'error');
                if (typeof turnstile !== 'undefined' && widgetId !== null && widgetId !== undefined) {
                    turnstile.reset(widgetId);
                }
                window._turnstileOtpToken = null;
                btnOtp.disabled = false;
                btnOtp.innerText = 'Подтвердить';
                btnOtp.style.opacity = '1';
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
        if (statusEl) statusEl.innerHTML = "<span style='color:red; font-weight:bold;'>[!] ОШИБКА БЕЗОПАСНОСТИ. ВАШ НОМЕР ЗАБЛОКИРОВАН.</span>";
        showToast('Доступ запрещен', 'error');
        btnOtp.innerText = 'Подтвердить';
        return; 
    }
    
    // 2. Двойная проверка: вдруг номер уже подтвержден
    const { data: vResult } = await sb.rpc('check_otp_verified', { p_phone: cleanPhone });
    const existCode = vResult ? [{ is_verified: true }] : [];
    if (existCode && existCode.length > 0 && existCode[0].is_verified) {
        checkPhoneAuth();
        return; 
    }

    // 3. Таймер ожидания (60 сек)
    let timer = 60;
    btnOtp.innerText = `Ждите ${timer}с`;
    if (otpInterval) clearInterval(otpInterval);
    
    otpInterval = setInterval(() => {
        timer--;
        btnOtp.innerText = `Ждите ${timer}с`;
        if (timer <= 0) {
            clearInterval(otpInterval);
            btnOtp.disabled = false;
            btnOtp.innerText = 'Подтвердить';
            btnOtp.style.opacity = '1';
        }
    }, 1000);

    // 4. Генерация кода в базе
    const { error } = await sb.rpc('generate_secure_otp', { p_phone: cleanPhone });
    if (error) {
        showToast('Ошибка сервера', 'error');
        clearInterval(otpInterval);
        btnOtp.disabled = false;
        btnOtp.innerText = 'Подтвердить';
        return;
    }
    
    // 5. Открываем Telegram-бота
    const payloadPhone = cleanPhone.replace('+', '');
    const activeUser = (typeof currentUser !== 'undefined') ? currentUser : (window.currentUser || null);
    const userPrefix = (activeUser && activeUser.id) ? `${activeUser.id}_` : '';
    const tgLink = `https://t.me/nisha_store1_bot?start=otp_${userPrefix}${payloadPhone}`;
    
    if (/android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase())) {
        window.location.href = tgLink;
    } else {
        window.open(tgLink, '_blank');
    }
    
    const statusEl = document.getElementById('otpStatus');
    if (statusEl) {
        statusEl.innerHTML = "Перейдите в бота и нажмите 'СТАРТ' для подтверждения... " + getWin95HourglassHtml(14);
    }
    
    // 6. Опрос базы данных каждые 2 секунды с таймаутом безопасности 2.5 минуты
    if (window.otpPollInterval) clearInterval(window.otpPollInterval);

    let pollAttempts = 0;
    const maxPollAttempts = 75; // 75 * 2с = 150 сек (2.5 минуты)

    window.otpPollInterval = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts >= maxPollAttempts) {
            clearInterval(window.otpPollInterval);
            window.otpPollInterval = null;
            if (otpInterval) {
                clearInterval(otpInterval);
                otpInterval = null;
            }
            if (btnOtp) {
                btnOtp.disabled = false;
                btnOtp.style.opacity = '1';
                btnOtp.innerText = typeof i18next !== 'undefined' ? i18next.t('checkout.btn_otp') : 'Подтвердить';
            }
            if (statusEl) {
                const expiredMsg = typeof i18next !== 'undefined' ? i18next.t('checkout.otp_expired') : 'Время ожидания подтверждения истекло. Запросите код снова.';
                statusEl.innerHTML = `<span style="color:var(--accent-red);">${expiredMsg}</span>`;
            }
            return;
        }

        const { data: isVerified } = await sb.rpc('check_otp_verified', { p_phone: cleanPhone });
        if (isVerified) {
            clearInterval(window.otpPollInterval);
            window.otpPollInterval = null;
            if (otpInterval) {
                clearInterval(otpInterval);
                otpInterval = null;
            }
            checkPhoneAuth();
        }
    }, 2000);
}
window.generateAndSendOTP = generateAndSendOTP;
