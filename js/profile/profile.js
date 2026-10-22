// ==========================================
// NISHA PROFILE, AUTH, CONTACTS & ORDERS MODULE
// ==========================================

// Глобальные переменные состояния пользователя и заказов
if (typeof window.currentUser === 'undefined') window.currentUser = null;
if (typeof window.userProfile === 'undefined') window.userProfile = null;
if (typeof window.favorites === 'undefined') window.favorites = [];
if (typeof window.orderItemsImageCache === 'undefined') window.orderItemsImageCache = {};

let currentUser = window.currentUser;
let userProfile = window.userProfile;
let favorites = window.favorites;

let isRegMode = false;
if (typeof window.globalOrdersData === 'undefined') window.globalOrdersData = [];
if (typeof window.currentOrderTab === 'undefined') window.currentOrderTab = 'accepted'; // accepted, shipped, cancelled
let isTogglingFav = false; // Защита от двойного клика

if (typeof window.orderStatusChannel === 'undefined') window.orderStatusChannel = null;
if (typeof window.qaUpdatesChannel === 'undefined') window.qaUpdatesChannel = null;
let orderStatusChannel = window.orderStatusChannel;
let qaUpdatesChannel = window.qaUpdatesChannel;

let isCheckingPhoneOtp = false;
let isPhoneOtpCompleted = false;
let isCheckingTgOtp = false;
let isTgOtpCompleted = false;
let lastPhoneSendTimestamp = 0;
let lastTgSendTimestamp = 0;

// Безопасные геттеры зависимостей
function getSupabase() {
    if (typeof window !== 'undefined' && typeof window.getSupabase === 'function') return window.getSupabase();
    return (typeof window !== 'undefined' && (window._supabase || window.supabaseClient)) || null;
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

            const { data: profiles, error } = await sb.from('profiles').select('id, username, phone, tg, cart, language, last_broadcast_id').eq('id', currentUser.id).limit(1);
            if (!error && profiles && profiles.length > 0) { 
                userProfile = profiles[0]; 
                window.userProfile = userProfile;
                
                // Синхронизация языка из БД в браузер
                if (userProfile.language) {
                    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
                    const currentLang = store ? store.get('nisha_lang', 'ru') : 'ru';
                    if (userProfile.language !== currentLang) {
                        if (store) store.set('nisha_lang', userProfile.language);
                        const newFlag = userProfile.language === 'ru' ? '🇷🇺' : (userProfile.language === 'en' ? '🇬🇧' : '🇺🇦');
                        if (store) store.set('nisha_flag', newFlag);
                        if (typeof i18next !== 'undefined') {
                            i18next.changeLanguage(userProfile.language).then(() => {
                                if (typeof updateContentLanguage === 'function') updateContentLanguage();
                                const footLang = document.getElementById('currentLangLabelFooter');
                                if (footLang) {
                                    const span = footLang.querySelector('span');
                                    if (span) span.innerText = '[' + userProfile.language.toUpperCase() + '] ▼';
                                    const flagImg = document.getElementById('currentFlagImg');
                                    if (flagImg && typeof getFlagUrlByLang === 'function') {
                                        flagImg.src = getFlagUrlByLang(userProfile.language);
                                    }
                                }
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

            // Автоматическая привязка прошлых гостевых заказов при входе в аккаунт
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            const phoneToLink = uPhone || (store ? store.get('nisha_last_phone') : null) || '';
            if (phoneToLink && phoneToLink.replace(/[^\d]/g, '').length >= 9) {
                window.apiClient.post('/api/link-orders', {
                    userId: currentUser.id,
                    phone: phoneToLink
                }, { timeout: 8000, dedupe: true }).catch(() => {});
            }

            // Проверка ожидающих подтверждений (OTP)
            if (store && store.get('nisha_pending_otp_phone') && typeof checkPendingPhoneVerification === 'function') {
                checkPendingPhoneVerification();
                if (store.get('nisha_pending_otp_phone') && !window.profileOtpPollInterval) {
                    window.profileOtpPollInterval = setInterval(() => {
                        checkPendingPhoneVerification();
                    }, 2000);
                }
            }
            if (store && store.get('nisha_pending_otp_tg') && typeof checkPendingTgVerification === 'function') {
                checkPendingTgVerification();
                if (store.get('nisha_pending_otp_tg') && !window.profileTgPollInterval) {
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
                    if (payload.new && payload.new.id) {
                        if (Array.isArray(window.globalOrdersData)) {
                            const idx = window.globalOrdersData.findIndex(o => o && o.id === payload.new.id);
                            if (idx !== -1) {
                                window.globalOrdersData[idx] = { ...window.globalOrdersData[idx], ...payload.new };
                            }
                        }
                        try {
                            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
                            let cached = store ? store.getJSON('nisha_cached_orders', []) : [];
                            if (Array.isArray(cached)) {
                                const cIdx = cached.findIndex(o => o && o.id === payload.new.id);
                                if (cIdx !== -1) {
                                    cached[cIdx] = { ...cached[cIdx], ...payload.new };
                                    if (store) store.setJSON('nisha_cached_orders', cached);
                                }
                            }
                        } catch (e) {}
                        const ordModal = document.getElementById('ordersModal');
                        if (ordModal && ordModal.style.display === 'flex') {
                            if (typeof window.updateOrderTabCounters === 'function') window.updateOrderTabCounters();
                            if (typeof window.renderFilteredOrders === 'function') window.renderFilteredOrders();
                        }
                    }

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
                                () => { if (typeof window.openOrdersModal === 'function') window.openOrdersModal(); }
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
                
                const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
                if (store) store.setJSON('nisha_cart', localCart);
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
    const p = isModal ? 'modal' : '';
    const a = isModal ? 'modalAuth' : 'auth';

    const btnLogin = document.getElementById(p ? 'modalBtnLogin' : 'btnLogin');
    const btnShowReg = document.getElementById(p ? 'modalBtnShowReg' : 'btnShowReg');
    const btnRegister = document.getElementById(p ? 'modalBtnRegister' : 'btnRegister');
    const btnBackLogin = document.getElementById(p ? 'modalBtnBackLogin' : 'btnBackLogin');
    const authUsername = document.getElementById(a + 'Username');

    const currentlyReg = btnRegister && btnRegister.style.display === 'block';
    const nextRegMode = !currentlyReg;
    isRegMode = nextRegMode;

    if (nextRegMode) {
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
    window.globalOrdersData = [];
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (store) store.remove('nisha_cached_orders');
    const favNav = document.getElementById('favNav');
    if (favNav) favNav.style.color = 'var(--accent-yellow)';
    
    await checkSession();
    if (typeof applyFilters === 'function') applyFilters();
}
window.logout = logout;

// Вход через Google вынесен в js/auth/google-signin.js (Google Identity Services + ID Token,
// с фоллбэком на OAuth-редирект). window.loginWithGoogle определяется там.

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
// 4 & 5. ТЕЛЕФОН И TELEGRAM В ПРОФИЛЕ (WIN95 СТИЛЬ & OTP)
// ==========================================

const CONTACT_CONFIG = {
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

function resetContactSaveButtons(type) {
    const cfg = CONTACT_CONFIG[type];
    if (!cfg) return;
    const selector = `#profile${cfg.cap}InputWrap .win95-save-btn, #modalProfile${cfg.cap}InputWrap .win95-save-btn`;
    document.querySelectorAll(selector).forEach(b => {
        b.disabled = false;
        b.innerText = '✓';
    });
}

function clearPendingContactState(type) {
    const cfg = CONTACT_CONFIG[type];
    if (!cfg) return;
    if (window[cfg.pollVar]) {
        clearInterval(window[cfg.pollVar]);
        window[cfg.pollVar] = null;
    }
    window[cfg.pendingVar] = null;
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (store) {
        store.remove(cfg.storagePending);
        store.remove(cfg.storageTime);
    }
}

function openTelegramBotDeepLink(tgLink) {
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    if (isMobile) {
        window.location.href = tgLink;
    } else {
        const win = window.open(tgLink, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = tgLink;
        }
    }
}

function renderProfileContact(type, rawVal) {
    const cfg = CONTACT_CONFIG[type];
    if (!cfg) return;

    const trimmed = (rawVal || '').trim();
    const hasVal = type === 'tg' ? Boolean(trimmed.length > 0 && trimmed !== '@') : Boolean(trimmed.length > 0);
    const displayVal = !hasVal ? '' : (type === 'tg' ? (trimmed.startsWith('@') ? trimmed : '@' + trimmed) : rawVal);
    const safeVal = typeof window.escapeHtml === 'function' ? window.escapeHtml(displayVal) : displayVal;
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

function renderProfilePhone(phone) { renderProfileContact('phone', phone); }
window.renderProfilePhone = renderProfilePhone;

function renderProfileTg(tg) { renderProfileContact('tg', tg); }
window.renderProfileTg = renderProfileTg;

async function removeProfileContact(type) {
    const cfg = CONTACT_CONFIG[type];
    const sb = getSupabase();
    const activeUser = currentUser || window.currentUser;
    if (!cfg || !activeUser || !sb) return;

    try {
        await sb.from('profiles').update({ [type]: null }).eq('id', activeUser.id);
        try { await sb.auth.updateUser({ data: { [type]: null } }); } catch(e) {}
    } catch(err) {
        console.error(`Ошибка удаления ${type}:`, err);
    }

    if (userProfile) userProfile[type] = null;
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (store) store.remove(cfg.storageLast);
    clearPendingContactState(type);

    renderProfileContact(type, '');
    showToast(cfg.removedToast, 'info');
    if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
}

window.removeProfilePhone = (isModal = false) => removeProfileContact('phone', isModal);
window.removeProfileTg = (isModal = false) => removeProfileContact('tg', isModal);

function showContactInput(type, isModal = false) {
    const cfg = CONTACT_CONFIG[type];
    if (!cfg) return;
    const prefix = isModal ? 'modalProfile' : 'profile';
    const btn = document.getElementById(`${prefix}Add${cfg.cap}Btn`);
    const wrap = document.getElementById(`${prefix}${cfg.cap}InputWrap`);
    const input = document.getElementById(`${prefix}${cfg.cap}Input`);
    const saveBtn = document.querySelector(`#${prefix}${cfg.cap}InputWrap .win95-save-btn`);
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);

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
        if (typeof IMask !== 'undefined' && !input._imask) {
            input._imask = IMask(input, { mask: '+{380} (00) 000-00-00' });
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
        input.setSelectionRange(len, len);

        input.oninput = () => {
            let val = input.value.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, '@').replace(/[^a-zA-Z0-9_@]/g, '');
            val = '@' + val.replace(/@/g, '');
            input.value = val;
        };
        input.onkeydown = (e) => {
            if (e.key === 'Enter') window.saveTgFromInput(isModal);
            if (e.key === 'Escape') window.hideTgInput(isModal);
        };
    }
}

window.showPhoneInput = (isModal = false) => showContactInput('phone', isModal);
window.showTgInput = (isModal = false) => showContactInput('tg', isModal);

function hideContactInput(type, isModal = false) {
    const cfg = CONTACT_CONFIG[type];
    if (!cfg) return;
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

window.hidePhoneInput = (isModal = false) => hideContactInput('phone', isModal);
window.hideTgInput = (isModal = false) => hideContactInput('tg', isModal);

async function checkPendingContactVerification(type) {
    const isPhone = type === 'phone';
    if (isPhone ? (isCheckingPhoneOtp || isPhoneOtpCompleted) : (isCheckingTgOtp || isTgOtpCompleted)) return;

    const cfg = CONTACT_CONFIG[type];
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    const pendingVal = window[cfg.pendingVar] || (store ? store.get(cfg.storagePending) : null);
    if (!pendingVal) return;

    const startTime = parseInt((store ? store.get(cfg.storageTime, '0') : '0'), 10);
    if (startTime && (Date.now() - startTime > 120000)) {
        clearPendingContactState(type);
        resetContactSaveButtons(type);
        showToast(cfg.timeoutToast, 'error');
        return;
    }

    const cleanVal = isPhone ? pendingVal : pendingVal.replace(/^@+/, '').trim().toLowerCase();
    if (!cleanVal) return;

    const sb = getSupabase();
    if (!sb) return;

    if (isPhone) isCheckingPhoneOtp = true;
    else isCheckingTgOtp = true;

    const activeUser = currentUser || window.currentUser;
    if (activeUser) currentUser = activeUser;
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
                    showToast(cfg.duplicateToast, 'error');
                    return;
                }
            } catch(e) {}
        }

        const otpRpcTarget = isPhone ? pendingVal : `tg_${cleanVal}`;
        const { data: isVerified } = await sb.rpc('check_otp_verified', { p_phone: otpRpcTarget });
        if (!isVerified) return;

        if (isPhone) isPhoneOtpCompleted = true;
        else isTgOtpCompleted = true;
        clearPendingContactState(type);

        if (isPhone) {
            if (currentUser) {
                try {
                    let hasLinkedTg = false;
                    const { data: profData, error: profErr } = await sb.from('profiles').select('phone, tg').eq('id', currentUser.id).single();
                    if (!profErr && profData) {
                        if (!userProfile) userProfile = {};
                        window.userProfile = userProfile;
                        const confirmedPhone = profData.phone || pendingVal;
                        userProfile.phone = confirmedPhone;
                        if (store) store.set('nisha_last_phone', confirmedPhone);
                        renderProfilePhone(confirmedPhone);

                        if (profData.tg) {
                            userProfile.tg = profData.tg;
                            if (store) store.set('nisha_last_tg', profData.tg);
                            renderProfileTg(profData.tg);
                            hasLinkedTg = true;
                            clearPendingContactState('tg');
                        }
                        if (!profData.phone) {
                            await sb.from('profiles').update({ phone: pendingVal }).eq('id', currentUser.id);
                        }
                    } else {
                        const { error: updErr } = await sb.from('profiles').update({ phone: pendingVal }).eq('id', currentUser.id);
                        if (updErr && (updErr.code === '23505' || updErr.message?.includes('duplicate'))) {
                            resetContactSaveButtons('phone');
                            showToast('Этот номер уже подтвержден на другом аккаунте!', 'error');
                            return;
                        }
                        if (!userProfile) userProfile = {};
                        window.userProfile = userProfile;
                        userProfile.phone = pendingVal;
                        if (store) store.set('nisha_last_phone', pendingVal);
                        renderProfilePhone(pendingVal);
                    }
                    window._hasLinkedTgOnPhoneVerify = hasLinkedTg;
                    await sb.auth.updateUser({ data: { phone: pendingVal } });
                } catch(e) {}
            } else {
                if (!userProfile) userProfile = {};
                window.userProfile = userProfile;
                userProfile.phone = pendingVal;
                if (store) store.set('nisha_last_phone', pendingVal);
                renderProfilePhone(pendingVal);
            }

            const msg = window._hasLinkedTgOnPhoneVerify
                ? 'Номер и Telegram подтверждены!'
                : (typeof i18next !== 'undefined' ? i18next.t('messages.phone_verified', { defaultValue: 'Номер подтвержден!' }) : 'Номер подтвержден!');
            delete window._hasLinkedTgOnPhoneVerify;
            showToast(msg, 'success');
        } else {
            const formattedTg = '@' + pendingVal.replace(/^@+/, '').trim();
            if (currentUser) {
                try {
                    const { error: updErr } = await sb.from('profiles').update({ tg: formattedTg }).eq('id', currentUser.id);
                    if (updErr && (updErr.code === '23505' || updErr.message?.includes('duplicate'))) {
                        resetContactSaveButtons('tg');
                        showToast(cfg.duplicateToast, 'error');
                        return;
                    }
                    await sb.auth.updateUser({ data: { tg: formattedTg } });
                } catch(e) {}
            }
            if (!userProfile) userProfile = {};
            window.userProfile = userProfile;
            userProfile.tg = formattedTg;
            if (store) store.set('nisha_last_tg', formattedTg);
            renderProfileTg(formattedTg);
            const msg = typeof i18next !== 'undefined' ? i18next.t('messages.tg_verified', { defaultValue: 'Telegram подтвержден!' }) : 'Telegram подтвержден!';
            showToast(msg, 'success');
        }

        if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
    } catch(err) {
        console.error(`Ошибка проверки ${type} OTP в фоне:`, err);
    } finally {
        if (isPhone) isCheckingPhoneOtp = false;
        else isCheckingTgOtp = false;
    }
}

async function checkPendingPhoneVerification() { return checkPendingContactVerification('phone'); }
window.checkPendingPhoneVerification = checkPendingPhoneVerification;

async function checkPendingTgVerification() { return checkPendingContactVerification('tg'); }
window.checkPendingTgVerification = checkPendingTgVerification;

async function saveContactFromInput(type, isModal = false) {
    const activeUser = currentUser || window.currentUser;
    if (!activeUser) {
        showToast('Сначала авторизуйтесь!', 'error');
        return;
    }
    currentUser = activeUser;

    const sb = getSupabase();
    if (!sb) return;

    const isPhone = type === 'phone';
    const cfg = CONTACT_CONFIG[type];
    const now = Date.now();
    const lastTs = isPhone ? lastPhoneSendTimestamp : lastTgSendTimestamp;
    const cooldownRemaining = Math.ceil((10000 - (now - lastTs)) / 1000);
    if (cooldownRemaining > 0) {
        showToast(`Подождите ${cooldownRemaining} сек перед повторной отправкой!`, 'info');
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
            showToast('Введите корректный номер (минимум 10 цифр)!', 'error');
            input.focus();
            return;
        }
        try {
            const { data: blacklisted } = await sb.from('blacklist').select('phone').eq('phone', clean).limit(1);
            if (blacklisted && blacklisted.length > 0) {
                showToast('[!] ОШИБКА БЕЗОПАСНОСТИ: ВАШ НОМЕР ЗАБЛОКИРОВАН', 'error');
                return;
            }
        } catch(e) {}
        rpcAvailVal = clean;
        otpTarget = clean;
        const userPrefix = (currentUser && currentUser.id) ? `${currentUser.id}_` : '';
        tgLink = `https://t.me/nisha_store1_bot?start=otp_${userPrefix}${clean.replace('+', '')}`;
    } else {
        const rawVal = input.value.trim().replace(/^(https?:\/\/)?(www\.)?t\.me\//i, '@');
        const cleanUser = rawVal.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
        if (cleanUser.length < 2) {
            showToast('Введите корректный Telegram username!', 'error');
            input.focus();
            return;
        }
        clean = '@' + cleanUser;
        const cleanLower = cleanUser.toLowerCase();
        rpcAvailVal = cleanUser;
        otpTarget = `tg_${cleanLower}`;
        tgLink = `https://t.me/nisha_store1_bot?start=tg_${currentUser.id}_${cleanLower}`;
    }

    try {
        const { data: isAvail, error: rpcErr } = await sb.rpc('check_contact_available', {
            p_type: type,
            p_val: rpcAvailVal,
            p_user_id: currentUser.id
        });
        if (!rpcErr && isAvail === false) {
            showToast(cfg.duplicateToast, 'error');
            input.focus();
            return;
        }
    } catch(e) {}

    try {
        let query = sb.from('profiles').select('id').neq('id', currentUser.id).limit(1);
        query = isPhone ? query.eq('phone', clean) : query.ilike('tg', clean);
        const { data: existing } = await query;
        if (existing && existing.length > 0) {
            showToast(cfg.linkedToast, 'error');
            input.focus();
            return;
        }
    } catch(e) {}

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
            showToast('Ошибка сервера при генерации кода', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = '✓';
            }
            return;
        }
    } catch(e) {
        console.error(`OTP RPC error (${type}):`, e);
    }

    window[cfg.pendingVar] = clean;
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (store) {
        store.set(cfg.storagePending, clean);
        store.set(cfg.storageTime, Date.now().toString());
    }

    openTelegramBotDeepLink(tgLink);
    showToast(
        isPhone
            ? 'Перейдите в бота и нажмите СТАРТ для подтверждения номера...'
            : 'Перейдите в бота и нажмите СТАРТ для подтверждения Telegram...',
        'info'
    );

    if (window[cfg.pollVar]) clearInterval(window[cfg.pollVar]);
    window[cfg.pollVar] = setInterval(() => {
        checkPendingContactVerification(type);
    }, 2000);
}

window.savePhoneFromInput = (isModal = false) => saveContactFromInput('phone', isModal);
window.saveTgFromInput = (isModal = false) => saveContactFromInput('tg', isModal);

// Проверка ожидающих OTP при смене вкладки и фокусе
function triggerPendingContactChecks() {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (window.pendingOtpPhone || (store && store.get('nisha_pending_otp_phone'))) {
        checkPendingPhoneVerification();
    }
    if (window.pendingOtpTg || (store && store.get('nisha_pending_otp_tg'))) {
        checkPendingTgVerification();
    }
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerPendingContactChecks();
});
window.addEventListener('focus', triggerPendingContactChecks);

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
    if (window.analytics && typeof window.analytics.trackFavorite === 'function') {
        window.analytics.trackFavorite(itemId, !isFav);
    }

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
// 8. ИНИЦИАЛИЗАЦИЯ И СЛУШАТЕЛЬ СЕССИИ (AUTH LISTENER)
// ==========================================

function initAuthListener() {
    const sb = getSupabase();
    if (!sb) return;

    if (!sb.auth || typeof sb.auth.onAuthStateChange !== 'function') return;
    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
            console.log('[AUTH] Токен безопасности успешно продлен (Refresh Token).');
            currentUser = session.user;
            window.currentUser = currentUser;
        } else if (event === 'SIGNED_OUT') {
            console.log('[AUTH] Выполнен выход из аккаунта.');
            window.globalOrdersData = [];
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            if (store) store.remove('nisha_cached_orders');
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
