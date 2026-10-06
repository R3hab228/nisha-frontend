// ==========================================
// NISHA PROFILE, AUTH, CONTACTS & ORDERS MODULE
// ==========================================

// Глобальные переменные состояния пользователя и заказов
if (typeof window.currentUser === 'undefined') window.currentUser = null;
if (typeof window.userProfile === 'undefined') window.userProfile = null;
if (typeof window.favorites === 'undefined') window.favorites = [];
if (typeof window.orderItemsImageCache === 'undefined') window.orderItemsImageCache = {};

var currentUser = window.currentUser;
var userProfile = window.userProfile;
var favorites = window.favorites;

let isRegMode = false;
let globalOrdersData = [];
let currentOrderTab = 'accepted'; // accepted, shipped, cancelled
let isTogglingFav = false; // Защита от двойного клика

if (typeof window.orderStatusChannel === 'undefined') window.orderStatusChannel = null;
if (typeof window.qaUpdatesChannel === 'undefined') window.qaUpdatesChannel = null;
var orderStatusChannel = window.orderStatusChannel;
var qaUpdatesChannel = window.qaUpdatesChannel;

let isCheckingPhoneOtp = false;
let isPhoneOtpCompleted = false;
let isCheckingTgOtp = false;
let isTgOtpCompleted = false;
let lastPhoneSendTimestamp = 0;
let lastTgSendTimestamp = 0;

// Безопасные геттеры зависимостей
function getSupabase() {
    return window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
}

function getCatalog() {
    return window.allItems || (typeof allItems !== 'undefined' ? allItems : []);
}

function getHourglass(height = 14) {
    if (typeof window.getWin95HourglassHtml === 'function') {
        return window.getWin95HourglassHtml(height);
    }
    if (typeof getWin95HourglassHtml === 'function') {
        return getWin95HourglassHtml(height);
    }
    return '⌛';
}

// ==========================================
// 1. ОТКРЫТИЕ МОДАЛКИ ПРОФИЛЯ
// ==========================================

function openProfileModal() {
    if (typeof window.stopLenis === 'function') window.stopLenis();
    else if (typeof lenis !== 'undefined') lenis.stop();
    
    const modal = document.getElementById('profileModal');
    if (modal) modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
window.openProfileModal = openProfileModal;

// ==========================================
// 2. СЕССИЯ ПОЛЬЗОВАТЕЛЯ (CHECK SESSION)
// ==========================================

async function checkSession() {
    const sb = getSupabase();
    if (!sb) return;

    try {
        const { data: { user }, error: userError } = await sb.auth.getUser();
        
        if (user && !userError) {
            currentUser = user;
            window.currentUser = currentUser;

            const { data: profiles, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).limit(1);
            if (!error && profiles && profiles.length > 0) { 
                userProfile = profiles[0]; 
                window.userProfile = userProfile;
                
                // Синхронизация языка из БД в браузер
                if (userProfile.language) {
                    const currentLang = localStorage.getItem('nisha_lang') || 'ru';
                    if (userProfile.language !== currentLang) {
                        localStorage.setItem('nisha_lang', userProfile.language);
                        const newFlag = userProfile.language === 'ru' ? '🇷🇺' : (userProfile.language === 'en' ? '🇬🇧' : '🇺🇦');
                        localStorage.setItem('nisha_flag', newFlag);
                        if (typeof i18next !== 'undefined') {
                            i18next.changeLanguage(userProfile.language).then(() => {
                                if (typeof updateContentLanguage === 'function') updateContentLanguage();
                                const footLang = document.getElementById('currentLangLabelFooter');
                                if (footLang) footLang.innerText = '[' + userProfile.language.toUpperCase() + '] ▼';
                            });
                        }
                    }
                }
            }

            // Определение имени (если пусто или User — берем из метаданных)
            let uName = userProfile?.username;
            if (!uName || uName === 'User') {
                uName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
            }
            const uEmail = currentUser.email;

            // Сайдбар (ПК)
            const loginForm = document.getElementById('loginForm');
            const profileForm = document.getElementById('profileForm');
            if (loginForm) loginForm.style.display = 'none';
            if (profileForm) profileForm.style.display = 'flex';
            
            const profNameEl = document.getElementById('profileName');
            const profEmailEl = document.getElementById('profileEmail');
            if (profNameEl) profNameEl.innerText = uName;
            if (profEmailEl) profEmailEl.innerText = uEmail;

            // Модалка (Мобилка)
            const mLog = document.getElementById('modalLoginForm');
            const mProf = document.getElementById('modalProfileForm');
            if (mLog) mLog.style.display = 'none';
            if (mProf) mProf.style.display = 'block';
            
            const mProfNameEl = document.getElementById('modalProfileName');
            const mProfEmailEl = document.getElementById('modalProfileEmail');
            if (mProfNameEl) mProfNameEl.innerText = uName;
            if (mProfEmailEl) mProfEmailEl.innerText = uEmail;

            // Контакты
            const uPhone = (userProfile?.phone || '').trim();
            renderProfilePhone(uPhone);
            const uTg = (userProfile?.tg || '').trim();
            renderProfileTg(uTg);

            if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();

            // Проверка ожидающих подтверждений (OTP)
            if (localStorage.getItem('nisha_pending_otp_phone') && typeof checkPendingPhoneVerification === 'function') {
                checkPendingPhoneVerification();
                if (localStorage.getItem('nisha_pending_otp_phone') && !window.profileOtpPollInterval) {
                    window.profileOtpPollInterval = setInterval(() => {
                        checkPendingPhoneVerification();
                    }, 2000);
                }
            }
            if (localStorage.getItem('nisha_pending_otp_tg') && typeof checkPendingTgVerification === 'function') {
                checkPendingTgVerification();
                if (localStorage.getItem('nisha_pending_otp_tg') && !window.profileTgPollInterval) {
                    window.profileTgPollInterval = setInterval(() => {
                        checkPendingTgVerification();
                    }, 2000);
                }
            }

            // Привязка Push-уведомлений к профилю
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    if (typeof subscribeUserToPush === 'function') {
                        subscribeUserToPush(reg, true);
                    }
                });
            }
            
            // Уведомления о статусе заказа в реальном времени
            if (orderStatusChannel) sb.removeChannel(orderStatusChannel);
            orderStatusChannel = sb.channel('order-status-updates')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'orders',
                    filter: `user_id=eq.${currentUser.id}` 
                }, payload => {
                    const newStatus = payload.new.status;
                    if (newStatus !== payload.old.status) {
                        showToast(`Заказ #${payload.new.id.split('-')[0].toUpperCase()}: ${newStatus.toUpperCase()}`, 'success');
                        
                        if (typeof showTerminalModal === 'function') {
                            showTerminalModal(
                                'SYSTEM_NOTIFICATION.LOG',
                                `ВНИМАНИЕ! Статус вашего заказа изменился.<br><br>` +
                                `Заказ: #${payload.new.id.split('-')[0].toUpperCase()}<br>` +
                                `Новый статус: <b style="color:var(--accent-green);">${newStatus.toUpperCase()}</b>`,
                                '[ ПОСМОТРЕТЬ ]',
                                () => openOrdersModal()
                            );
                        }
                    }
                })
                .subscribe();

            // Уведомления об ответах на вопросы в Q&A
            if (qaUpdatesChannel) sb.removeChannel(qaUpdatesChannel);
            qaUpdatesChannel = sb.channel('qa-updates')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'item_questions',
                    filter: `user_id=eq.${currentUser.id}` 
                }, payload => {
                    if (payload.new.answer && !payload.old.answer) {
                        const msg = typeof i18next !== 'undefined' ? i18next.t('messages.qa_answered', {defaultValue: 'Вам ответили на вопрос!'}) : 'Вам ответили на вопрос!';
                        showToast(msg, 'success');
                    }
                })
                .subscribe();

            await loadFavorites();
           
            // Восстановление / объединение брошенной корзины
            let localCart = window.cart || [];
            if (userProfile && userProfile.cart && userProfile.cart.length > 0) {
                const dbCart = userProfile.cart;
                
                if (localCart.length === 0) {
                    localCart = dbCart;
                    window.cart = localCart;
                    showToast('Корзина восстановлена', 'success');
                } else {
                    let mergedCart = [...localCart];
                    let addedCount = 0;
                    
                    dbCart.forEach(dbItem => {
                        if (!mergedCart.some(it => it.id === dbItem.id)) {
                            mergedCart.push(dbItem);
                            addedCount++;
                        }
                    });
                    
                    localCart = mergedCart;
                    window.cart = localCart;
                    if (addedCount > 0) showToast('Корзины синхронизированы', 'success');
                }
                
                localStorage.setItem('nisha_cart', JSON.stringify(localCart));
                if (typeof syncCartToServer === 'function') await syncCartToServer();
            } else {
                if (localCart.length > 0 && typeof syncCartToServer === 'function') {
                    await syncCartToServer();
                }
            }
            if (typeof updateCartUI === 'function') updateCartUI();

        } else {
            currentUser = null;
            window.currentUser = null;
            userProfile = null;
            window.userProfile = null;
            favorites = [];
            window.favorites = [];
            renderProfilePhone('');
            renderProfileTg('');
            if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
            
            const loginForm = document.getElementById('loginForm');
            const profileForm = document.getElementById('profileForm');
            if (loginForm) loginForm.style.display = 'flex';
            if (profileForm) profileForm.style.display = 'none';
            
            const mLog = document.getElementById('modalLoginForm');
            const mProf = document.getElementById('modalProfileForm');
            if (mLog) mLog.style.display = 'flex';
            if (mProf) mProf.style.display = 'none';
            
            updateFavBadge();
        }
    } catch (err) {
        console.error("Ошибка в checkSession:", err);
    }
}
window.checkSession = checkSession;

// ==========================================
// 3. АВТОРИЗАЦИЯ, РЕГИСТРАЦИЯ И ВЫХОД
// ==========================================

function toggleRegMode(isModal = false) {
    isRegMode = !isRegMode;
    const p = isModal ? 'modal' : '';
    const a = isModal ? 'modalAuth' : 'auth';

    const btnLogin = document.getElementById(p ? 'modalBtnLogin' : 'btnLogin');
    const btnShowReg = document.getElementById(p ? 'modalBtnShowReg' : 'btnShowReg');
    const btnRegister = document.getElementById(p ? 'modalBtnRegister' : 'btnRegister');
    const btnBackLogin = document.getElementById(p ? 'modalBtnBackLogin' : 'btnBackLogin');
    const authUsername = document.getElementById(a + 'Username');

    if (isRegMode) {
        if (btnLogin) btnLogin.style.display = 'none';
        if (btnShowReg) btnShowReg.style.display = 'none';
        if (btnRegister) btnRegister.style.display = 'block';
        if (btnBackLogin) btnBackLogin.style.display = 'block';
        if (authUsername) authUsername.style.display = 'block';
    } else {
        if (btnLogin) btnLogin.style.display = 'block';
        if (btnShowReg) btnShowReg.style.display = 'block';
        if (btnRegister) btnRegister.style.display = 'none';
        if (btnBackLogin) btnBackLogin.style.display = 'none';
        if (authUsername) authUsername.style.display = 'none';
    }
}
window.toggleRegMode = toggleRegMode;

async function handleAuth(action, isModal = false) {
    const sb = getSupabase();
    if (!sb) return;

    const p = isModal ? 'modalAuth' : 'auth';
    const emailInput = document.getElementById(p + 'Email');
    const passInput = document.getElementById(p + 'Pass');
    const userInput = document.getElementById(p + 'Username');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';
    const username = userInput ? userInput.value.trim() : '';

    if (!email || !password) {
        showToast('Введите Email и пароль!', 'error');
        return;
    }

    let result;
    if (action === 'register') {
        if (!username) {
            showToast('Для регистрации нужен никнейм!', 'error');
            return;
        }
        result = await sb.auth.signUp({
            email,
            password,
            options: { data: { username: username } }
        });
        if (!result.error) showToast('Регистрация успешна! Проверьте почту.', 'success');
    } else {
        result = await sb.auth.signInWithPassword({ email, password });
        if (!result.error) {
            const msg = typeof i18next !== 'undefined' ? i18next.t('messages.login_success') : 'Вход выполнен успешно!';
            showToast(msg, 'success');
        }
    }

    if (result.error) {
        showToast(result.error.message, 'error');
    } else {
        await checkSession();
        if (isModal && typeof closeModal === 'function') closeModal('profileModal');
    }
}
window.handleAuth = handleAuth;

async function logout() {
    const sb = getSupabase();
    if (sb) {
        await sb.auth.signOut();
    }
    const msg = typeof i18next !== 'undefined' ? i18next.t('messages.logout') : 'Вы вышли из системы';
    showToast(msg, 'success');
    
    window.showingOnlyFavs = false;
    const favNav = document.getElementById('favNav');
    if (favNav) favNav.style.color = 'var(--accent-yellow)';
    
    await checkSession();
    if (typeof applyFilters === 'function') applyFilters();
}
window.logout = logout;

async function loginWithGoogle() {
    const isInApp = /Instagram|FBAN|FBAV|TikTok/i.test(navigator.userAgent);
    if (isInApp) {
        alert("Для входа через Google открой сайт в обычном браузере (Safari или Chrome)");
        return;
    }
    const sb = getSupabase();
    if (!sb) return;

    const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'https://www.nisha-store.shop',
            queryParams: { prompt: 'select_account', access_type: 'offline' }
        }
    });
    if (error) showToast('Ошибка: ' + error.message, 'error');
}
window.loginWithGoogle = loginWithGoogle;

window.togglePasswordVisibility = function(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        iconElement.classList.add('visible');
    } else {
        input.type = 'password';
        iconElement.classList.remove('visible');
    }
};

// ==========================================
// 4. ТЕЛЕФОН В ПРОФИЛЕ (WIN95 СТИЛЬ & OTP)
// ==========================================

function renderProfilePhone(phone) {
    const hasPhone = Boolean(phone && phone.trim().length > 0);
    const delBtnHtml = (isModal) => `<button onclick="removeProfilePhone(${isModal})" title="Удалить номер" class="win95-check-btn" style="background:#2a2a2a;border:2px outset #777;color:#ff5555;font-family:var(--font-mono);font-size:10px;padding:1px 5px;cursor:pointer;line-height:1;box-shadow:1px 1px 0 #000;margin-left:auto">✕</button>`;
    
    // 1. Сайдбар (ПК)
    const pPhone = document.getElementById('profilePhone');
    const pBtn = document.getElementById('profileAddPhoneBtn');
    const pWrap = document.getElementById('profilePhoneInputWrap');
    if (pPhone && pBtn) {
        if (hasPhone) {
            pPhone.innerHTML = `<span style="word-break:break-all">${phone}</span>${delBtnHtml(false)}`;
            pPhone.style.display = 'flex';
            pPhone.style.alignItems = 'center';
            pPhone.style.justifyContent = 'space-between';
            pBtn.style.display = 'none';
        } else {
            pPhone.innerHTML = '';
            pPhone.style.display = 'none';
            pBtn.style.display = 'inline-block';
        }
        if (pWrap) pWrap.style.display = 'none';
    }

    // 2. Модалка (Мобилка)
    const mPhone = document.getElementById('modalProfilePhone');
    const mBtn = document.getElementById('modalProfileAddPhoneBtn');
    const mWrap = document.getElementById('modalProfilePhoneInputWrap');
    if (mPhone && mBtn) {
        if (hasPhone) {
            mPhone.innerHTML = `<span style="word-break:break-all">${phone}</span>${delBtnHtml(true)}`;
            mPhone.style.display = 'flex';
            mPhone.style.alignItems = 'center';
            mPhone.style.justifyContent = 'space-between';
            mBtn.style.display = 'none';
        } else {
            mPhone.innerHTML = '';
            mPhone.style.display = 'none';
            mBtn.style.display = 'inline-block';
        }
        if (mWrap) mWrap.style.display = 'none';
    }

    const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn');
    saveBtns.forEach(b => {
        b.disabled = false;
        b.innerText = '✓';
    });
}
window.renderProfilePhone = renderProfilePhone;

window.removeProfilePhone = async function(isModal = false) {
    const sb = getSupabase();
    if (!currentUser || !sb) return;

    try {
        await sb.from('profiles').update({ phone: null }).eq('id', currentUser.id);
        try { await sb.auth.updateUser({ data: { phone: null } }); } catch(e) {}
    } catch(err) {
        console.error('Ошибка удаления телефона:', err);
    }

    if (userProfile) userProfile.phone = null;
    localStorage.removeItem('nisha_last_phone');
    localStorage.removeItem('nisha_pending_otp_phone');
    localStorage.removeItem('nisha_pending_otp_phone_time');

    renderProfilePhone('');
    showToast('Номер телефона удален!', 'info');
    if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
};

window.showPhoneInput = function(isModal = false) {
    const btn = document.getElementById(isModal ? 'modalProfileAddPhoneBtn' : 'profileAddPhoneBtn');
    const wrap = document.getElementById(isModal ? 'modalProfilePhoneInputWrap' : 'profilePhoneInputWrap');
    const input = document.getElementById(isModal ? 'modalProfilePhoneInput' : 'profilePhoneInput');
    const saveBtn = document.querySelector(isModal ? '#modalProfilePhoneInputWrap .win95-save-btn' : '#profilePhoneInputWrap .win95-save-btn');
    
    if (saveBtn && localStorage.getItem('nisha_pending_otp_phone')) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getHourglass(14);
    } else if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = '✓';
    }

    if (btn) btn.style.display = 'none';
    if (wrap) wrap.style.display = 'flex';
    if (input) {
        if (typeof IMask !== 'undefined' && !input._imask) {
            input._imask = IMask(input, { mask: '+{380} (00) 000-00-00' });
        }
        input.focus();
        input.onkeydown = (e) => {
            if (e.key === 'Enter') savePhoneFromInput(isModal);
            if (e.key === 'Escape') hidePhoneInput(isModal);
        };
    }
};

window.hidePhoneInput = function(isModal = false) {
    if (window.profileOtpPollInterval) {
        clearInterval(window.profileOtpPollInterval);
        window.profileOtpPollInterval = null;
    }
    window.pendingOtpPhone = null;
    localStorage.removeItem('nisha_pending_otp_phone');
    localStorage.removeItem('nisha_pending_otp_phone_time');

    const btn = document.getElementById(isModal ? 'modalProfileAddPhoneBtn' : 'profileAddPhoneBtn');
    const wrap = document.getElementById(isModal ? 'modalProfilePhoneInputWrap' : 'profilePhoneInputWrap');
    const input = document.getElementById(isModal ? 'modalProfilePhoneInput' : 'profilePhoneInput');

    if (wrap) wrap.style.display = 'none';
    if (btn) btn.style.display = 'inline-block';
    if (input && input._imask) {
        input._imask.value = '';
    } else if (input) {
        input.value = '';
    }
    const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn');
    saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; });
};

async function checkPendingPhoneVerification() {
    if (isCheckingPhoneOtp || isPhoneOtpCompleted) return;
    const pendingPhone = window.pendingOtpPhone || localStorage.getItem('nisha_pending_otp_phone');
    if (!pendingPhone) return;

    const phoneStartTime = parseInt(localStorage.getItem('nisha_pending_otp_phone_time') || '0', 10);
    if (phoneStartTime && (Date.now() - phoneStartTime > 120000)) {
        if (window.profileOtpPollInterval) {
            clearInterval(window.profileOtpPollInterval);
            window.profileOtpPollInterval = null;
        }
        window.pendingOtpPhone = null;
        localStorage.removeItem('nisha_pending_otp_phone');
        localStorage.removeItem('nisha_pending_otp_phone_time');
        const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn');
        saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; });
        showToast('Время ожидания подтверждения номера истекло', 'error');
        return;
    }

    const sb = getSupabase();
    if (!sb) return;

    isCheckingPhoneOtp = true;
    try {
        if (currentUser) {
            try {
                const { data: isAvail } = await sb.rpc('check_contact_available', {
                    p_type: 'phone',
                    p_val: pendingPhone,
                    p_user_id: currentUser.id
                });
                if (isAvail === false) {
                    if (window.profileOtpPollInterval) {
                        clearInterval(window.profileOtpPollInterval);
                        window.profileOtpPollInterval = null;
                    }
                    window.pendingOtpPhone = null;
                    localStorage.removeItem('nisha_pending_otp_phone');
                    localStorage.removeItem('nisha_pending_otp_phone_time');
                    showToast('Номер уже подтвержден на другом аккаунте!', 'error');
                    const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn');
                    saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; });
                    return;
                }
            } catch(e) {}
        }

        try {
            const { data: isVerified } = await sb.rpc('check_otp_verified', { p_phone: pendingPhone });
            if (isVerified) {
                isPhoneOtpCompleted = true;
                if (window.profileOtpPollInterval) {
                    clearInterval(window.profileOtpPollInterval);
                    window.profileOtpPollInterval = null;
                }
                window.pendingOtpPhone = null;
                localStorage.removeItem('nisha_pending_otp_phone');
                localStorage.removeItem('nisha_pending_otp_phone_time');

                if (currentUser) {
                    try {
                        let hasLinkedTg = false;
                        const { data: profData, error: profErr } = await sb
                            .from('profiles')
                            .select('phone, tg')
                            .eq('id', currentUser.id)
                            .single();

                        if (!profErr && profData) {
                            if (!userProfile) userProfile = {};
                            const confirmedPhone = profData.phone || pendingPhone;
                            userProfile.phone = confirmedPhone;
                            localStorage.setItem('nisha_last_phone', confirmedPhone);
                            renderProfilePhone(confirmedPhone);

                            if (profData.tg) {
                                userProfile.tg = profData.tg;
                                localStorage.setItem('nisha_last_tg', profData.tg);
                                renderProfileTg(profData.tg);
                                hasLinkedTg = true;

                                if (window.profileTgPollInterval) {
                                    clearInterval(window.profileTgPollInterval);
                                    window.profileTgPollInterval = null;
                                }
                                window.pendingOtpTg = null;
                                localStorage.removeItem('nisha_pending_otp_tg');
                                localStorage.removeItem('nisha_pending_otp_tg_time');
                            }

                            if (!profData.phone) {
                                await sb.from('profiles').update({ phone: pendingPhone }).eq('id', currentUser.id);
                            }
                        } else {
                            const { error: updErr } = await sb.from('profiles').update({ phone: pendingPhone }).eq('id', currentUser.id);
                            if (updErr && (updErr.code === '23505' || updErr.message?.includes('duplicate'))) {
                                const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn');
                                saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; });
                                showToast('Этот номер уже подтвержден на другом аккаунте!', 'error');
                                return;
                            }
                            if (!userProfile) userProfile = {};
                            userProfile.phone = pendingPhone;
                            localStorage.setItem('nisha_last_phone', pendingPhone);
                            renderProfilePhone(pendingPhone);
                        }
                        window._hasLinkedTgOnPhoneVerify = hasLinkedTg;
                        await sb.auth.updateUser({ data: { phone: pendingPhone } });
                    } catch(e) {}
                }

                if (!currentUser) {
                    if (!userProfile) userProfile = {};
                    userProfile.phone = pendingPhone;
                    localStorage.setItem('nisha_last_phone', pendingPhone);
                    renderProfilePhone(pendingPhone);
                }

                const msg = window._hasLinkedTgOnPhoneVerify
                    ? 'Номер и Telegram подтверждены!'
                    : (typeof i18next !== 'undefined' ? i18next.t('messages.phone_verified', { defaultValue: 'Номер подтвержден!' }) : 'Номер подтвержден!');
                delete window._hasLinkedTgOnPhoneVerify;
                showToast(msg, 'success');
                if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
            }
        } catch(err) {
            console.error('Ошибка проверки OTP в фоне:', err);
        }
    } finally {
        isCheckingPhoneOtp = false;
    }
}
window.checkPendingPhoneVerification = checkPendingPhoneVerification;

window.savePhoneFromInput = async function(isModal = false) {
    if (!currentUser) {
        showToast('Сначала авторизуйтесь!', 'error');
        return;
    }

    const sb = getSupabase();
    if (!sb) return;

    const now = Date.now();
    const phoneCooldownRemaining = Math.ceil((10000 - (now - lastPhoneSendTimestamp)) / 1000);
    if (phoneCooldownRemaining > 0) {
        showToast(`Подождите ${phoneCooldownRemaining} сек перед повторной отправкой!`, 'info');
        return;
    }

    const input = document.getElementById(isModal ? 'modalProfilePhoneInput' : 'profilePhoneInput');
    if (!input) return;

    const rawVal = input.value.trim();
    let clean = rawVal.replace(/[^\d+]/g, '');
    if (!clean.startsWith('+') && clean.startsWith('380')) clean = '+' + clean;
    if (!clean.startsWith('+') && clean.length === 10) clean = '+38' + clean;

    const digitsOnly = clean.replace(/[^\d]/g, '');
    if (digitsOnly.length < 10) {
        showToast('Введите корректный номер (минимум 10 цифр)!', 'error');
        input.focus();
        return;
    }

    // Проверяем Черный Список
    try {
        const { data: blacklisted } = await sb.from('blacklist').select('phone').eq('phone', clean).limit(1);
        if (blacklisted && blacklisted.length > 0) {
            showToast('[!] ОШИБКА БЕЗОПАСНОСТИ: ВАШ НОМЕР ЗАБЛОКИРОВАН', 'error');
            return;
        }
    } catch(e) {}

    // Проверяем доступность контакта
    try {
        const { data: isAvail, error: rpcErr } = await sb.rpc('check_contact_available', {
            p_type: 'phone',
            p_val: clean,
            p_user_id: currentUser.id
        });
        if (!rpcErr && isAvail === false) {
            showToast('Номер уже подтвержден на другом аккаунте!', 'error');
            input.focus();
            return;
        }
    } catch(e) {}
    try {
        const { data: existingPhone } = await sb
            .from('profiles')
            .select('id')
            .eq('phone', clean)
            .neq('id', currentUser.id)
            .limit(1);

        if (existingPhone && existingPhone.length > 0) {
            showToast('Этот номер уже привязан к другому аккаунту!', 'error');
            input.focus();
            return;
        }
    } catch(e) {}

    lastPhoneSendTimestamp = Date.now();
    isPhoneOtpCompleted = false;
    const saveBtn = document.querySelector(isModal ? '#modalProfilePhoneInputWrap .win95-save-btn' : '#profilePhoneInputWrap .win95-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getHourglass(14);
    }

    try {
        const { error: otpError } = await sb.rpc('generate_secure_otp', { p_phone: clean });
        if (otpError) {
            console.error('OTP generate error:', otpError);
            showToast('Ошибка сервера при генерации кода', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = '✓';
            }
            return;
        }
    } catch(e) {
        console.error('OTP RPC error:', e);
    }

    window.pendingOtpPhone = clean;
    localStorage.setItem('nisha_pending_otp_phone', clean);
    localStorage.setItem('nisha_pending_otp_phone_time', Date.now().toString());

    const payloadPhone = clean.replace('+', '');
    const userPrefix = (currentUser && currentUser.id) ? `${currentUser.id}_` : '';
    const tgLink = `https://t.me/nisha_store1_bot?start=otp_${userPrefix}${payloadPhone}`;

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    if (isMobile) {
        window.location.href = tgLink;
    } else {
        const win = window.open(tgLink, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = tgLink;
        }
    }

    showToast('Перейдите в бота и нажмите СТАРТ для подтверждения номера...', 'info');

    if (window.profileOtpPollInterval) clearInterval(window.profileOtpPollInterval);
    window.profileOtpPollInterval = setInterval(() => {
        checkPendingPhoneVerification();
    }, 2000);
};

// ==========================================
// 5. TELEGRAM В ПРОФИЛЕ (WIN95 СТИЛЬ & OTP)
// ==========================================

function renderProfileTg(tg) {
    const hasTg = Boolean(tg && tg.trim().length > 0 && tg.trim() !== '@');
    const formattedTg = hasTg ? (tg.startsWith('@') ? tg : '@' + tg) : '';
    const delBtnHtml = (isModal) => `<button onclick="removeProfileTg(${isModal})" title="Удалить Telegram" class="win95-check-btn" style="background:#2a2a2a;border:2px outset #777;color:#ff5555;font-family:var(--font-mono);font-size:10px;padding:1px 5px;cursor:pointer;line-height:1;box-shadow:1px 1px 0 #000;margin-left:auto">✕</button>`;
    
    // 1. Сайдбар (ПК)
    const pTg = document.getElementById('profileTg');
    const pBtn = document.getElementById('profileAddTgBtn');
    const pWrap = document.getElementById('profileTgInputWrap');
    if (pTg && pBtn) {
        if (hasTg) {
            pTg.innerHTML = `<span style="word-break:break-all">${formattedTg}</span>${delBtnHtml(false)}`;
            pTg.style.display = 'flex';
            pTg.style.alignItems = 'center';
            pTg.style.justifyContent = 'space-between';
            pBtn.style.display = 'none';
        } else {
            pTg.innerHTML = '';
            pTg.style.display = 'none';
            pBtn.style.display = 'inline-block';
        }
        if (pWrap) pWrap.style.display = 'none';
    }

    // 2. Модалка (Мобилка)
    const mTg = document.getElementById('modalProfileTg');
    const mBtn = document.getElementById('modalProfileAddTgBtn');
    const mWrap = document.getElementById('modalProfileTgInputWrap');
    if (mTg && mBtn) {
        if (hasTg) {
            mTg.innerHTML = `<span style="word-break:break-all">${formattedTg}</span>${delBtnHtml(true)}`;
            mTg.style.display = 'flex';
            mTg.style.alignItems = 'center';
            mTg.style.justifyContent = 'space-between';
            mBtn.style.display = 'none';
        } else {
            mTg.innerHTML = '';
            mTg.style.display = 'none';
            mBtn.style.display = 'inline-block';
        }
        if (mWrap) mWrap.style.display = 'none';
    }

    const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn');
    saveBtns.forEach(b => {
        b.disabled = false;
        b.innerText = '✓';
    });
}
window.renderProfileTg = renderProfileTg;

window.removeProfileTg = async function(isModal = false) {
    const sb = getSupabase();
    if (!currentUser || !sb) return;

    try {
        await sb.from('profiles').update({ tg: null }).eq('id', currentUser.id);
        try { await sb.auth.updateUser({ data: { tg: null } }); } catch(e) {}
    } catch(err) {
        console.error('Ошибка удаления Telegram:', err);
    }

    if (userProfile) userProfile.tg = null;
    localStorage.removeItem('nisha_last_tg');
    localStorage.removeItem('nisha_pending_otp_tg');
    localStorage.removeItem('nisha_pending_otp_tg_time');

    renderProfileTg('');
    showToast('Telegram удален!', 'info');
    if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
};

window.showTgInput = function(isModal = false) {
    const btn = document.getElementById(isModal ? 'modalProfileAddTgBtn' : 'profileAddTgBtn');
    const wrap = document.getElementById(isModal ? 'modalProfileTgInputWrap' : 'profileTgInputWrap');
    const input = document.getElementById(isModal ? 'modalProfileTgInput' : 'profileTgInput');
    const saveBtn = document.querySelector(isModal ? '#modalProfileTgInputWrap .win95-save-btn' : '#profileTgInputWrap .win95-save-btn');
    
    if (saveBtn && localStorage.getItem('nisha_pending_otp_tg')) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getHourglass(14);
    } else if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = '✓';
    }

    if (btn) btn.style.display = 'none';
    if (wrap) wrap.style.display = 'flex';
    if (input) {
        if (!input.value || !input.value.trim() || input.value === '@') {
            input.value = '@';
        } else if (!input.value.startsWith('@')) {
            input.value = '@' + input.value.trim().replace(/^@+/, '');
        }
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);

        input.oninput = () => {
            let val = input.value;
            val = val.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, '@');
            val = val.replace(/[^a-zA-Z0-9_@]/g, '');
            if (!val.startsWith('@')) {
                val = '@' + val.replace(/@/g, '');
            } else {
                val = '@' + val.slice(1).replace(/@/g, '');
            }
            input.value = val;
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') saveTgFromInput(isModal);
            if (e.key === 'Escape') hideTgInput(isModal);
        };
    }
};

window.hideTgInput = function(isModal = false) {
    if (window.profileTgPollInterval) {
        clearInterval(window.profileTgPollInterval);
        window.profileTgPollInterval = null;
    }
    window.pendingOtpTg = null;
    localStorage.removeItem('nisha_pending_otp_tg');
    localStorage.removeItem('nisha_pending_otp_tg_time');

    const btn = document.getElementById(isModal ? 'modalProfileAddTgBtn' : 'profileAddTgBtn');
    const wrap = document.getElementById(isModal ? 'modalProfileTgInputWrap' : 'profileTgInputWrap');
    const input = document.getElementById(isModal ? 'modalProfileTgInput' : 'profileTgInput');

    if (wrap) wrap.style.display = 'none';
    if (btn) btn.style.display = 'inline-block';
    if (input) input.value = '';

    const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn');
    saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; });
};

async function checkPendingTgVerification() {
    if (isCheckingTgOtp || isTgOtpCompleted) return;
    const pendingTg = window.pendingOtpTg || localStorage.getItem('nisha_pending_otp_tg');
    if (!pendingTg) return;

    const tgStartTime = parseInt(localStorage.getItem('nisha_pending_otp_tg_time') || '0', 10);
    if (tgStartTime && (Date.now() - tgStartTime > 120000)) {
        if (window.profileTgPollInterval) {
            clearInterval(window.profileTgPollInterval);
            window.profileTgPollInterval = null;
        }
        window.pendingOtpTg = null;
        localStorage.removeItem('nisha_pending_otp_tg');
        localStorage.removeItem('nisha_pending_otp_tg_time');
        const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn');
        saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; });
        showToast('Время ожидания подтверждения Telegram истекло', 'error');
        return;
    }

    const cleanUser = pendingTg.replace(/^@+/, '').trim().toLowerCase();
    if (!cleanUser) return;

    const sb = getSupabase();
    if (!sb) return;

    isCheckingTgOtp = true;
    try {
        if (currentUser) {
            try {
                const { data: isAvail } = await sb.rpc('check_contact_available', {
                    p_type: 'tg',
                    p_val: cleanUser,
                    p_user_id: currentUser.id
                });
                if (isAvail === false) {
                    if (window.profileTgPollInterval) {
                        clearInterval(window.profileTgPollInterval);
                        window.profileTgPollInterval = null;
                    }
                    window.pendingOtpTg = null;
                    localStorage.removeItem('nisha_pending_otp_tg');
                    localStorage.removeItem('nisha_pending_otp_tg_time');
                    showToast('Этот Telegram уже подтвержден на другом аккаунте!', 'error');
                    const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn');
                    saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; });
                    return;
                }
            } catch(e) {}
        }

        try {
            const { data: isVerified } = await sb.rpc('check_otp_verified', { p_phone: `tg_${cleanUser}` });
            if (isVerified) {
                isTgOtpCompleted = true;
                if (window.profileTgPollInterval) {
                    clearInterval(window.profileTgPollInterval);
                    window.profileTgPollInterval = null;
                }
                window.pendingOtpTg = null;
                localStorage.removeItem('nisha_pending_otp_tg');
                localStorage.removeItem('nisha_pending_otp_tg_time');

                const formattedTg = '@' + pendingTg.replace(/^@+/, '').trim();

                if (currentUser) {
                    try {
                        const { error: updErr } = await sb.from('profiles').update({ tg: formattedTg }).eq('id', currentUser.id);
                        if (updErr && (updErr.code === '23505' || updErr.message?.includes('duplicate'))) {
                            const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn');
                            saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; });
                            showToast('Этот Telegram уже подтвержден на другом аккаунте!', 'error');
                            return;
                        }
                        await sb.auth.updateUser({ data: { tg: formattedTg } });
                    } catch(e) {}
                }

                if (!userProfile) userProfile = {};
                userProfile.tg = formattedTg;
                localStorage.setItem('nisha_last_tg', formattedTg);

                renderProfileTg(formattedTg);
                const msg = typeof i18next !== 'undefined' ? i18next.t('messages.tg_verified', { defaultValue: 'Telegram подтвержден!' }) : 'Telegram подтвержден!';
                showToast(msg, 'success');
                if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
            }
        } catch(err) {
            console.error('Ошибка проверки TG OTP в фоне:', err);
        }
    } finally {
        isCheckingTgOtp = false;
    }
}
window.checkPendingTgVerification = checkPendingTgVerification;

window.saveTgFromInput = async function(isModal = false) {
    if (!currentUser) {
        showToast('Сначала авторизуйтесь!', 'error');
        return;
    }

    const sb = getSupabase();
    if (!sb) return;

    const now = Date.now();
    const tgCooldownRemaining = Math.ceil((10000 - (now - lastTgSendTimestamp)) / 1000);
    if (tgCooldownRemaining > 0) {
        showToast(`Подождите ${tgCooldownRemaining} сек перед повторной отправкой!`, 'info');
        return;
    }

    const input = document.getElementById(isModal ? 'modalProfileTgInput' : 'profileTgInput');
    if (!input) return;

    let rawVal = input.value.trim();
    rawVal = rawVal.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, '@');
    let cleanUser = rawVal.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');

    if (cleanUser.length < 2) {
        showToast('Введите корректный Telegram username!', 'error');
        input.focus();
        return;
    }

    const clean = '@' + cleanUser;
    const cleanLower = cleanUser.toLowerCase();

    // Проверяем доступность контакта
    try {
        const { data: isAvail, error: rpcErr } = await sb.rpc('check_contact_available', {
            p_type: 'tg',
            p_val: cleanUser,
            p_user_id: currentUser.id
        });
        if (!rpcErr && isAvail === false) {
            showToast('Этот Telegram уже подтвержден на другом аккаунте!', 'error');
            input.focus();
            return;
        }
    } catch(e) {}
    try {
        const { data: existingTg } = await sb
            .from('profiles')
            .select('id')
            .ilike('tg', clean)
            .neq('id', currentUser.id)
            .limit(1);

        if (existingTg && existingTg.length > 0) {
            showToast('Этот Telegram уже привязан к другому аккаунту!', 'error');
            input.focus();
            return;
        }
    } catch(e) {}

    lastTgSendTimestamp = Date.now();
    isTgOtpCompleted = false;
    const saveBtn = document.querySelector(isModal ? '#modalProfileTgInputWrap .win95-save-btn' : '#profileTgInputWrap .win95-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getHourglass(14);
    }

    try {
        const { error: otpError } = await sb.rpc('generate_secure_otp', { p_phone: `tg_${cleanLower}` });
        if (otpError) {
            console.error('OTP generate error for tg:', otpError);
            showToast('Ошибка сервера при генерации кода', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = '✓';
            }
            return;
        }
    } catch(e) {
        console.error('OTP RPC error for tg:', e);
    }

    window.pendingOtpTg = clean;
    localStorage.setItem('nisha_pending_otp_tg', clean);
    localStorage.setItem('nisha_pending_otp_tg_time', Date.now().toString());

    const tgLink = `https://t.me/nisha_store1_bot?start=tg_${currentUser.id}_${cleanLower}`;

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    if (isMobile) {
        window.location.href = tgLink;
    } else {
        const win = window.open(tgLink, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = tgLink;
        }
    }

    showToast('Перейдите в бота и нажмите СТАРТ для подтверждения Telegram...', 'info');

    if (window.profileTgPollInterval) clearInterval(window.profileTgPollInterval);
    window.profileTgPollInterval = setInterval(() => {
        checkPendingTgVerification();
    }, 2000);
};

// Проверка ожидающих OTP при смене вкладки и фокусе
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (window.pendingOtpPhone || localStorage.getItem('nisha_pending_otp_phone')) {
            checkPendingPhoneVerification();
        }
        if (window.pendingOtpTg || localStorage.getItem('nisha_pending_otp_tg')) {
            checkPendingTgVerification();
        }
    }
});
window.addEventListener('focus', () => {
    if (window.pendingOtpPhone || localStorage.getItem('nisha_pending_otp_phone')) {
        checkPendingPhoneVerification();
    }
    if (window.pendingOtpTg || localStorage.getItem('nisha_pending_otp_tg')) {
        checkPendingTgVerification();
    }
});

// ==========================================
// 6. ИЗБРАННОЕ (FAVORITES / LIKES)
// ==========================================

async function loadFavorites() {
    if (!currentUser) return;
    const sb = getSupabase();
    if (!sb) return;

    const { data, error } = await sb.from('favorites').select('item_id').eq('user_id', currentUser.id);
    if (data && !error) {
        favorites = data.map(f => f.item_id);
        window.favorites = favorites;
        const pCount = document.getElementById('profileLikesCount');
        if (pCount) pCount.innerText = favorites.length;
        const mCount = document.getElementById('modalProfileLikesCount');
        if (mCount) mCount.innerText = favorites.length;
    }
    updateFavBadge();
}
window.loadFavorites = loadFavorites;

async function toggleFav(event, itemId) {
    if (typeof window.triggerVibration === 'function') window.triggerVibration(150);
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!currentUser) { 
        const msg = typeof i18next !== 'undefined' ? i18next.t('messages.cart_error_auth') : 'Пожалуйста, войдите в аккаунт';
        showToast(msg, 'error'); 
        return; 
    }

    if (isTogglingFav) return;
    isTogglingFav = true;
    setTimeout(() => { isTogglingFav = false; }, 300);

    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    const isFav = favorites.includes(itemId);

    if (isFav) {
        favorites = favorites.filter(id => id !== itemId);
    } else {
        favorites.push(itemId);
    }
    window.favorites = favorites;

    // Звезда в сетке товаров
    const gridStar = document.querySelector(`.item-card[data-id="${itemId}"] .fav-star`);
    if (gridStar) {
        if (isFav) {
            gridStar.classList.remove('active');
            gridStar.style.color = '#444';
        } else {
            gridStar.classList.add('active');
            gridStar.style.color = 'var(--accent-red)';
        }
    }

    // Звезда в открытой модалке товара
    const opened = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    if (opened && opened.id === itemId) {
        const modalStar = document.getElementById('modalFavStar');
        if (modalStar) {
            if (isFav) {
                modalStar.classList.remove('active');
                modalStar.style.color = '#444';
            } else {
                modalStar.classList.add('active');
                modalStar.style.color = 'var(--accent-red)';
            }
        }
    }

    // Обновляем счетчики
    const profileLikes = document.getElementById('profileLikesCount');
    if (profileLikes) profileLikes.innerText = favorites.length;
    const modalProfileLikes = document.getElementById('modalProfileLikesCount');
    if (modalProfileLikes) modalProfileLikes.innerText = favorites.length;
    updateFavBadge();

    // Синхронизация с БД и уведомление
    const catalog = getCatalog();
    const itemObj = catalog.find(i => i.id === itemId);
    let imgUrl = null;
    if (itemObj) {
        if (typeof window.getOptimizedImageUrl === 'function') imgUrl = window.getOptimizedImageUrl(itemObj, true);
        else if (typeof getOptimizedImageUrl === 'function') imgUrl = getOptimizedImageUrl(itemObj, true);
    }

    const sb = getSupabase();
    if (sb) {
        try {
            if (isFav) {
                await sb.from('favorites').delete().match({ user_id: currentUser.id, item_id: itemId });
                const msg = typeof i18next !== 'undefined' ? i18next.t('messages.fav_remove') : 'Удалено из избранного';
                showToast(msg, 'success', imgUrl);
            } else {
                await sb.from('favorites').insert([{ user_id: currentUser.id, item_id: itemId }]);
                const msg = typeof i18next !== 'undefined' ? i18next.t('messages.fav_add') : 'Добавлено в избранное';
                showToast(msg, 'success', imgUrl);
            }
        } catch (err) {
            console.error("Ошибка лайка:", err);
        }
    }
}
window.toggleFav = toggleFav;

function updateFavBadge() { 
    const badge = document.getElementById('favCountBadge');
    if (badge) badge.innerText = `[${favorites.length}]`; 
}
window.updateFavBadge = updateFavBadge;

function filterFavorites() { 
    if (!currentUser) { 
        const msg = typeof i18next !== 'undefined' ? i18next.t('messages.cart_error_auth') : 'Пожалуйста, войдите в аккаунт';
        showToast(msg, 'error'); 
        return; 
    }
    const currentFavState = window.showingOnlyFavs || false;
    window.showingOnlyFavs = !currentFavState;
    sessionStorage.setItem('nisha_showing_favs', window.showingOnlyFavs);
    
    const favNav = document.getElementById('favNav');
    if (favNav) favNav.style.color = window.showingOnlyFavs ? '#fff' : 'var(--accent-yellow)'; 
    if (typeof applyFilters === 'function') applyFilters(); 
}
window.filterFavorites = filterFavorites;

// ==========================================
// 7. МОИ ЗАКАЗЫ (MY_ORDERS.EXE & JSBARCODE)
// ==========================================

function openOrdersModal() {
    const modal = document.getElementById('ordersModal');
    if (modal) modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (typeof window.stopLenis === 'function') window.stopLenis();
    else if (typeof lenis !== 'undefined') lenis.stop();
    
    const guestInputGroup = document.getElementById('guestOrderInputGroup');
    const guestText = document.getElementById('guestOrderText');
    const listArea = document.getElementById('ordersListArea');

    if (currentUser) {
        if (guestInputGroup) guestInputGroup.style.display = 'none';
        
        let dName = userProfile?.username;
        if (!dName || dName === 'User') {
            dName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
        }
        
        const grantedMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.access_granted', {defaultValue: 'Доступ разрешен'}) : 'Доступ разрешен';
        if (guestText) guestText.innerHTML = `${grantedMsg}: <span style="color:var(--accent-green); font-weight:bold;">@${dName}</span>`;
        fetchMyOrders();
    } else {
        if (guestInputGroup) guestInputGroup.style.display = 'flex';
        if (guestText) guestText.innerHTML = 'Введите номер телефона, указанный при заказе, чтобы отследить статус:';
        if (listArea) listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace; padding: 30px;">Введите номер телефона для поиска...</div>';

        const lastPhone = localStorage.getItem('nisha_last_phone');
        const phoneInput = document.getElementById('ordersSearchPhone');
        if (lastPhone && phoneInput && !phoneInput.value) {
            phoneInput.value = lastPhone;
        }
        if (phoneInput && phoneInput.value) {
            fetchMyOrders();
        }
    }
}
window.openOrdersModal = openOrdersModal;

async function fetchMyOrders() {
    const listArea = document.getElementById('ordersListArea');
    const tabsContainer = document.getElementById('ordersTabs');
    if (!listArea) return;
    
    listArea.innerHTML = '<div style="text-align:center; color:#aaa; font-family: monospace;">[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]</div>';
    if (tabsContainer) tabsContainer.style.display = 'none';

    let fetchError = null;
    const sb = getSupabase();
    if (!sb) return;

    if (currentUser) {
        const { data, error } = await sb.from('orders').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        globalOrdersData = data || []; 
        fetchError = error;
    } else {
        const phoneInput = document.getElementById('ordersSearchPhone');
        const phone = phoneInput ? phoneInput.value.replace(/[^\d+]/g, '') : '';
        if (!phone || phone.length < 10) { 
            showToast('Введите корректный номер телефона!', 'error'); 
            listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace;">[ НОМЕР НЕ ВВЕДЕН ]</div>';
            return; 
        }

        const { data: vResult } = await sb.rpc('check_otp_verified', { p_phone: phone });
        const otpCheck = vResult ? [{is_verified: true}] : [];
        if (!otpCheck || otpCheck.length === 0 || !otpCheck[0].is_verified) {
            listArea.innerHTML = `<div style="text-align:center; color:var(--accent-red); font-family: monospace; padding: 20px;">[ ДОСТУП ЗАПРЕЩЕН ]<br><br>Сначала подтвердите, что это ваш номер.</div>
            <button class="cart-checkout-btn btn-target" style="margin: 0 auto; display: block;" onclick="document.getElementById('orderPhone').value='${phone}'; if (typeof generateAndSendOTP==='function') generateAndSendOTP();">ПОДТВЕРДИТЬ НОМЕР В БОТЕ</button>`;
            return; 
        }

        const { data, error } = await sb.rpc('get_orders_by_phone', { search_phone: phone });
        globalOrdersData = data || []; 
        fetchError = error;
    }

    if (fetchError) { 
        listArea.innerHTML = `<div style="color:red; text-align:center;">[ ОШИБКА: ${fetchError.message} ]</div>`; 
        return; 
    }

    if (globalOrdersData.length === 0) { 
        const emptyTitle = typeof i18next !== 'undefined' ? i18next.t('orders_modal.empty_title') : 'ЗАКАЗОВ НЕТ';
        const emptyDesc = typeof i18next !== 'undefined' ? i18next.t('orders_modal.empty_desc') : 'Вы еще не делали заказов в нашем магазине.';
        listArea.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a;">
                <div style="font-size: 30px; margin-bottom: 15px;">📦</div>
                <div style="color:var(--accent-red); font-family: var(--font-mono); font-weight:bold; margin-bottom: 10px;">${emptyTitle}</div>
                <div style="color:#888; font-size: 13px; line-height: 1.5;">${emptyDesc}</div>
            </div>`; 
        return; 
    }

    if (tabsContainer) tabsContainer.style.display = 'flex';
    
    currentOrderTab = 'accepted';
    document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
    const tabYellow = document.querySelector('.order-tab.tab-yellow');
    if (tabYellow) tabYellow.classList.add('active');
    
    ensureOrderImagesLoaded();
    renderFilteredOrders();
}
window.fetchMyOrders = fetchMyOrders;

function getOrderItemImage(item) {
    if (!item) return '';

    const toCDN = window.toCDN || ((u) => u);

    // 1. Прямые свойства item
    if (item.image && typeof item.image === 'string' && item.image.trim().length > 5) {
        return toCDN(item.image);
    }
    for (const key of ['img', 'thumbnail', 'photo', 'picture']) {
        if (item[key] && typeof item[key] === 'string' && item[key].trim().length > 5) {
            return toCDN(item[key]);
        }
    }

    // 2. Массивы картинок
    if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0 && typeof item.thumbnails[0] === 'string' && item.thumbnails[0].trim().length > 5) {
        return toCDN(item.thumbnails[0]);
    }
    if (Array.isArray(item.images) && item.images.length > 0 && typeof item.images[0] === 'string' && item.images[0].trim().length > 5) {
        return toCDN(item.images[0]);
    }

    // 3. Кэш уже подгруженных картинок
    if (item.id && window.orderItemsImageCache[item.id]) {
        return window.orderItemsImageCache[item.id];
    }

    // 4. Поиск в каталоге
    const catalog = getCatalog();
    if (Array.isArray(catalog)) {
        const catalogItem = catalog.find(p => (item.id && p && p.id === item.id) || (item.name && p && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()));
        if (catalogItem) {
            let foundUrl = '';
            if (typeof window.getOptimizedImageUrl === 'function') {
                foundUrl = window.getOptimizedImageUrl(catalogItem, true);
            } else if (typeof getOptimizedImageUrl === 'function') {
                foundUrl = getOptimizedImageUrl(catalogItem, true);
            }
            if (!foundUrl && Array.isArray(catalogItem.thumbnails) && catalogItem.thumbnails.length > 0) {
                foundUrl = catalogItem.thumbnails[0];
            }
            if (!foundUrl && Array.isArray(catalogItem.images) && catalogItem.images.length > 0) {
                foundUrl = catalogItem.images[0];
            }
            if (foundUrl) {
                const cdnUrl = toCDN(foundUrl);
                if (item.id) window.orderItemsImageCache[item.id] = cdnUrl;
                return cdnUrl;
            }
        }
    }

    return '';
}
window.getOrderItemImage = getOrderItemImage;

async function ensureOrderImagesLoaded() {
    if (!globalOrdersData || !Array.isArray(globalOrdersData)) return;
    const missingIds = [];
    globalOrdersData.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                if (item && item.id && !getOrderItemImage(item)) {
                    if (!missingIds.includes(item.id)) missingIds.push(item.id);
                }
            });
        }
    });

    if (missingIds.length === 0) return;

    const sb = getSupabase();
    if (!sb) return;

    try {
        const toCDN = window.toCDN || ((u) => u);
        const { data } = await sb.from('items').select('id, thumbnails, images').in('id', missingIds);
        if (data && data.length > 0) {
            data.forEach(di => {
                const imgUrl = (di.thumbnails && di.thumbnails.length > 0) ? di.thumbnails[0] : (di.images && di.images.length > 0 ? di.images[0] : '');
                if (imgUrl) {
                    window.orderItemsImageCache[di.id] = toCDN(imgUrl);
                }
            });
        }

        const stillMissing = missingIds.filter(id => !window.orderItemsImageCache[id]);
        if (stillMissing.length > 0) {
            const { data: archData } = await sb.from('archived_items').select('id, thumbnails, images').in('id', stillMissing);
            if (archData && archData.length > 0) {
                archData.forEach(di => {
                    const imgUrl = (di.thumbnails && di.thumbnails.length > 0) ? di.thumbnails[0] : (di.images && di.images.length > 0 ? di.images[0] : '');
                    if (imgUrl) {
                        window.orderItemsImageCache[di.id] = toCDN(imgUrl);
                    }
                });
            }
        }

        // Динамически подставляем картинку во все отрендеренные карточки
        document.querySelectorAll('.order-item-img[data-item-id]').forEach(el => {
            const itId = el.getAttribute('data-item-id');
            const resolved = getOrderItemImage({ id: itId });
            if (resolved) {
                el.style.backgroundImage = `url('${resolved}')`;
                el.innerText = '';
            }
        });
    } catch (e) {
        console.warn('Could not batch fetch missing order images:', e);
    }
}
window.ensureOrderImagesLoaded = ensureOrderImagesLoaded;

window.switchOrderTab = function(tabName) {
    if (currentOrderTab === tabName) return;
    currentOrderTab = tabName;
    
    document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
    if (tabName === 'accepted') {
        const tab = document.querySelector('.order-tab.tab-yellow');
        if (tab) tab.classList.add('active');
    }
    if (tabName === 'shipped') {
        const tab = document.querySelector('.order-tab.tab-blue');
        if (tab) tab.classList.add('active');
    }
    if (tabName === 'cancelled') {
        const tab = document.querySelector('.order-tab.tab-red');
        if (tab) tab.classList.add('active');
    }
    
    renderFilteredOrders();
};

function renderFilteredOrders() {
    const listArea = document.getElementById('ordersListArea');
    if (!listArea) return;
    listArea.innerHTML = '';

    const filteredData = globalOrdersData.filter(order => {
        const s = (order.status || '').toLowerCase();
        if (currentOrderTab === 'accepted') return s.includes('принят') || s.includes('оплачен');
        if (currentOrderTab === 'shipped') return s.includes('отправлен') || s.includes('завершен');
        if (currentOrderTab === 'cancelled') return s.includes('отменен') || s.includes('возврат');
        return false;
    });

    if (filteredData.length === 0) {
        let emptyMsg = currentOrderTab === 'accepted' ? 'Нет активных заказов.' : 
                       currentOrderTab === 'shipped' ? 'Нет отправленных посылок.' : 'Нет отмененных заказов.';
        listArea.innerHTML = `<div style="text-align:center; color:#666; font-family: monospace; padding: 30px;">[ ${emptyMsg} ]</div>`;
        return;
    }

    filteredData.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
        let itemsHtml = '';
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const itemImg = getOrderItemImage(item);
                const imgStyle = itemImg ? `background-image: url('${itemImg}');` : '';
                itemsHtml += `
                    <div class="order-item-row" onclick="if(typeof openProductModalById==='function') openProductModalById('${item.id}')" title="Открыть карточку товара">
                        <div class="order-item-img" data-item-id="${item.id}" style="${imgStyle}">${itemImg ? '' : 'NO IMG'}</div>
                        <div class="order-item-details">
                            <div class="order-item-name">${item.name}</div>
                            <div class="order-item-meta"><span>Размер: ${item.size}</span><span class="order-item-price">${item.currentPrice} грн</span></div>
                        </div>
                    </div>`;
            });
        }

        let ttnHtml = "";
        if ((order.status || '').toUpperCase() !== "ОТМЕНЕН") {
            ttnHtml = order.tracking_number
                ? `<div class="order-ttn">ТТН: <span style="color:var(--accent-green); font-weight:bold;">${order.tracking_number}</span>
                     <div style="background:#fff; text-align:center; padding: 10px; margin-top: 10px; border-radius:4px;">
                         <svg class="barcode-svg" data-ttn="${order.tracking_number}"></svg>
                     </div>
                   </div>`
                : `<div class="order-ttn" style="color:#777;">ТТН: Ожидается генерация...</div>`;
        }

        // Кнопка отзыва для завершенных заказов
        let reviewBtnHtml = '';
        if ((order.status || '').toLowerCase() === 'завершен') {
            let reviewedOrders = JSON.parse(localStorage.getItem('nisha_reviewed_orders') || '[]');
            
            if (!reviewedOrders.includes(order.id) && order.items && order.items.length > 0) {
                const firstItem = order.items[0];
                const firstItemImg = getOrderItemImage(firstItem);
                const safeName = firstItem.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const msgIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; position: relative; top: 2px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
                
                reviewBtnHtml = `
                    <div style="margin-top: 10px; cursor: pointer; color: var(--accent-green); font-size: 12px; font-family: var(--font-main); text-align: center; transition: 0.2s;" 
                         onclick="if(typeof closeModal==='function') closeModal('ordersModal'); if(typeof promptOrderReview==='function') promptOrderReview('${order.id}', '${safeName}', '${firstItemImg}', '${firstItem.id}')" 
                         onmouseover="this.style.textDecoration='underline'; this.style.color='#fff';" 
                         onmouseout="this.style.textDecoration='none'; this.style.color='var(--accent-green)';">
                        ${msgIcon} Оставить отзыв
                    </div>
                `;
            } else if (reviewedOrders.includes(order.id)) {
                reviewBtnHtml = `
                    <div style="margin-top: 10px; color: #555; font-size: 12px; font-family: var(--font-mono); text-align: center; pointer-events: none;">
                        [✔] ОТЗЫВ ОСТАВЛЕН
                    </div>
                `;
            }
        }

        listArea.innerHTML += `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-id">ЗАКАЗ #${order.id.split('-')[0].toUpperCase()} <span style="color:#666; font-weight:normal;">(${date})</span></span>
                    <span class="order-status status-${order.status}">${(order.status || '').toUpperCase()}</span>
                </div>
                <div class="order-items-list">${itemsHtml}</div>
                ${reviewBtnHtml}
                <div class="order-footer">${ttnHtml}<div class="order-total">ИТОГО: ${order.total_sum} грн</div></div>
            </div>`;
    });

    ensureOrderImagesLoaded();

    // Отрисовка штрихкодов JsBarcode
    if (typeof JsBarcode !== 'undefined') {
        document.querySelectorAll('.barcode-svg').forEach(svg => {
            const ttn = svg.getAttribute('data-ttn');
            if (ttn) {
                try {
                    JsBarcode(svg, ttn, { format: "CODE128", lineColor: "#000", background: "transparent", width: 1.5, height: 50, displayValue: false });
                } catch(e) {}
            }
        });
    }
}
window.renderFilteredOrders = renderFilteredOrders;

// ==========================================
// 8. ИНИЦИАЛИЗАЦИЯ И СЛУШАТЕЛЬ СЕССИИ (AUTH LISTENER)
// ==========================================

function initAuthListener() {
    const sb = getSupabase();
    if (!sb) return;

    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
            console.log('[AUTH] Токен безопасности успешно продлен (Refresh Token).');
            currentUser = session.user;
            window.currentUser = currentUser;
        } else if (event === 'SIGNED_OUT') {
            console.log('[AUTH] Выполнен выход из аккаунта.');
            currentUser = null;
            window.currentUser = null;
            userProfile = null;
            window.userProfile = null;
            favorites = [];
            window.favorites = [];
            renderProfilePhone('');
            renderProfileTg('');
            if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
            updateFavBadge();

            const loginForm = document.getElementById('loginForm');
            const profileForm = document.getElementById('profileForm');
            if (loginForm) loginForm.style.display = 'flex';
            if (profileForm) profileForm.style.display = 'none';

            const mLog = document.getElementById('modalLoginForm');
            const mProf = document.getElementById('modalProfileForm');
            if (mLog) mLog.style.display = 'flex';
            if (mProf) mProf.style.display = 'none';
        } else if (event === 'SIGNED_IN') {
            if (!currentUser) await checkSession();
        }
    });
}
window.initAuthListener = initAuthListener;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthListener);
} else {
    initAuthListener();
}
