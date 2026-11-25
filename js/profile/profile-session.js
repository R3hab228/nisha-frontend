// ==========================================
// NISHA PROFILE SESSION, REALTIME & CART SYNC MODULE
// ==========================================

import {
    profileState,
    getSupabase,
    getStore,
    tProfile,
    notifyToast,
    getGlobalFn,
    bindWindowFn,
    setProfileAuthFormsVisible
} from './profile-state.js';
import { loadFavorites, updateFavBadge } from './profile-favorites.js';

function callProfileModalFn(fnName, args = [], { skipIfLazyStub = false } = {}) {
    const fn = getGlobalFn(fnName);
    if (typeof fn !== 'function') return undefined;
    if (skipIfLazyStub && fn._isNishaLazyStub) return undefined;
    return fn(...args);
}

function escProfileHtml(str) {
    const escFn = getGlobalFn('escapeHtml');
    if (escFn) return escFn(str);
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Opens profile modal and synchronizes cached/saved contacts and delivery fields inside it.
 */
export function openProfileModal() {
    const updateLangFn = getGlobalFn('updateContentLanguage');
    if (updateLangFn) {
        try { updateLangFn(); } catch {}
    }

    const openModalFn = getGlobalFn('openModal');
    if (openModalFn) {
        openModalFn('profileModal');
    } else if (typeof document !== 'undefined') {
        const modal = document.getElementById('profileModal');
        if (modal) {
            modal.inert = false;
            modal.removeAttribute('inert');
            modal.setAttribute('aria-hidden', 'false');
            modal.style.display = 'flex';
        }
        if (document.body?.style) document.body.style.overflow = 'hidden';
    }

    const typewriterFn = getGlobalFn('triggerModalTypewriter');
    if (typewriterFn) typewriterFn('profileModal');

    // Повторная синхронизация контактов и данных доставки в модалке при каждом открытии
    const activeUser = profileState.currentUser;
    if (activeUser) {
        const store = getStore();
        const storedPhone = store ? (store.get('nisha_last_phone') || '') : '';
        const storedTg = store ? (store.get('nisha_last_tg') || '') : '';
        const uPhone = (profileState.userProfile?.phone || activeUser.user_metadata?.phone || storedPhone || '').trim();
        const uTg = (profileState.userProfile?.tg || activeUser.user_metadata?.tg || storedTg || '').trim();
        if (uPhone) callProfileModalFn('renderProfilePhone', [uPhone]);
        if (uTg) callProfileModalFn('renderProfileTg', [uTg]);

        const cachedDelivery = (store ? store.getJSON('nisha_profile_delivery') : null) || {};
        const uFullName = (profileState.userProfile?.full_name || cachedDelivery.full_name || '').trim();
        const uDeliveryAddress = (profileState.userProfile?.delivery_address || cachedDelivery.delivery_address || '').trim();
        callProfileModalFn('renderProfileDelivery', [uFullName, uDeliveryAddress]);
    }
}
bindWindowFn('openProfileModal', openProfileModal);

/**
 * Resets profile UI, favorites, and contacts to signed-out state.
 */
export function resetSignedOutProfileUI() {
    profileState.currentUser = null;
    profileState.userProfile = null;
    profileState.favorites = [];
    callProfileModalFn('renderProfilePhone', [''], { skipIfLazyStub: true });
    callProfileModalFn('renderProfileTg', [''], { skipIfLazyStub: true });
    callProfileModalFn('renderProfileDelivery', ['', ''], { skipIfLazyStub: true });
    const syncFields = getGlobalFn('updateProposeAndCheckoutFields');
    if (syncFields) syncFields();
    setProfileAuthFormsVisible(false);
    updateFavBadge();
    if (typeof window !== 'undefined' && window.analytics && typeof window.analytics.resetIdentity === 'function') {
        window.analytics.resetIdentity();
    }
}

/**
 * Queries the user's profile row with automatic fallback to legacy schema without delivery columns.
 * @param {object} sb
 * @param {string} userId
 * @returns {Promise<{profiles: any[]|null, profileErr: any}>}
 */
async function fetchProfileRecordWithFallback(sb, userId) {
    let profiles = null;
    let profileErr = null;
    try {
        const res = await sb.from('profiles').select('id, username, phone, tg, cart, language, last_broadcast_id, full_name, delivery_address').eq('id', userId).limit(1);
        if (res.error) {
            console.warn('[profile] Query with delivery fields failed, falling back to legacy profile schema:', res.error);
            const fallbackRes = await sb.from('profiles').select('id, username, phone, tg, cart, language, last_broadcast_id').eq('id', userId).limit(1);
            profiles = fallbackRes.data;
            profileErr = fallbackRes.error;
        } else {
            profiles = res.data;
        }
    } catch (qErr) {
        console.error('[profile] Exception in profiles query:', qErr);
        try {
            const fallbackRes = await sb.from('profiles').select('id, username, phone, tg, cart, language, last_broadcast_id').eq('id', userId).limit(1);
            profiles = fallbackRes.data;
            profileErr = fallbackRes.error;
        } catch {}
    }
    return { profiles, profileErr };
}

/**
 * Synchronizes UI language from stored profile language preference.
 * @param {string} rawLang
 */
function syncLanguageFromProfile(rawLang) {
    if (!rawLang) return;
    const normFn = getGlobalFn('normalizeSiteLang');
    const normLang = normFn ? normFn(rawLang) : rawLang;
    const store = getStore();
    const currentLang = store ? store.get('nisha_lang', 'ua') : 'ua';
    const changeLangFn = getGlobalFn('changeLanguage');
    const updateFooterFn = getGlobalFn('updateFooterLanguageUI');
    const updateContentFn = getGlobalFn('updateContentLanguage');

    if (normLang !== currentLang) {
        if (store) store.set('nisha_lang', normLang);
        const newFlag = normLang === 'ru' ? '🇷🇺' : (normLang === 'en' ? '🇬🇧' : '🇺🇦');
        if (store) store.set('nisha_flag', newFlag);
        if (changeLangFn) {
            changeLangFn(normLang);
        } else if (typeof i18next !== 'undefined') {
            i18next.changeLanguage(normLang).then(() => {
                if (updateContentFn) updateContentFn();
                if (updateFooterFn) updateFooterFn(normLang);
            });
        }
    } else if (updateFooterFn) {
        updateFooterFn(normLang);
    }
}

/**
 * Resolves and self-heals username across profile table and Supabase user metadata.
 * @param {object} sb
 * @param {object} user
 * @returns {string}
 */
function resolveAndHealDisplayName(sb, user) {
    const getNameFn = getGlobalFn('getUserDisplayName');
    let uName = getNameFn
        ? getNameFn(user, profileState.userProfile)
        : ((profileState.userProfile?.username || user.user_metadata?.display_name || user.user_metadata?.username || user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@').at(0) : '')) || 'User');
    if (uName === 'User' && user.email) {
        uName = user.email.split('@').at(0);
    }

    if (uName && uName !== 'User') {
        if (!profileState.userProfile?.username || profileState.userProfile.username === 'User') {
            const hadProfileRow = Boolean(profileState.userProfile);
            if (profileState.userProfile) {
                profileState.userProfile.username = uName;
            } else {
                profileState.userProfile = { id: user.id, username: uName };
            }
            try {
                const table = typeof sb.from === 'function' ? sb.from('profiles') : null;
                if (table) {
                    if (hadProfileRow && typeof table.update === 'function') {
                        table.update({ username: uName }).eq('id', user.id).then().catch(() => {});
                    } else if (typeof table.upsert === 'function') {
                        Promise.resolve(table.upsert({ id: user.id, username: uName }, { onConflict: 'id' })).catch(() => {});
                    }
                }
            } catch {}
        }
        if (!user.user_metadata?.display_name || !user.user_metadata?.full_name) {
            try {
                if (typeof sb.auth?.updateUser === 'function') {
                    sb.auth.updateUser({
                        data: {
                            display_name: uName,
                            username: uName,
                            full_name: user.user_metadata?.full_name || uName,
                            name: user.user_metadata?.name || uName
                        }
                    }).then().catch(() => {});
                }
            } catch {}
        }
    }
    return uName;
}

function isProcessingOrderStatus(status) {
    const s = String(status || '').trim().toLowerCase();
    if (!s) return true;
    return s.includes('обработ') || s.includes('оброб') || s.includes('process') || s === 'новый' || s === 'новий' || s === 'new';
}

function isModalElementOpen(el) {
    if (!el) return false;
    if (el.classList && typeof el.classList.contains === 'function' && el.classList.contains('is-open')) {
        return true;
    }
    const disp = el.style && el.style.display;
    return disp === 'flex' || disp === 'block';
}

function isUserOnMainFeed() {
    if (typeof document === 'undefined') return true;
    const ordersModal = typeof document.getElementById === 'function' ? document.getElementById('ordersModal') : null;
    if (isModalElementOpen(ordersModal)) return false;

    if (typeof document.querySelectorAll === 'function') {
        const overlays = document.querySelectorAll('.modal-overlay');
        for (const overlay of overlays) {
            if (isModalElementOpen(overlay)) return false;
        }
    }
    return true;
}

function findCachedOrderSnapshot(orderId) {
    if (!orderId) return null;
    if (Array.isArray(window.globalOrdersData)) {
        const found = window.globalOrdersData.find(o => o && String(o.id) === String(orderId));
        if (found) return found;
    }
    try {
        const store = getStore();
        const cached = store ? store.getJSON('nisha_cached_orders', []) : [];
        if (Array.isArray(cached)) {
            const found = cached.find(o => o && String(o.id) === String(orderId));
            if (found) return found;
        }
    } catch {}
    return null;
}

/**
 * Synchronizes incoming order status UPDATE payload with cached orders, modal counters, and catalog items.
 * @param {object} payload
 */
function syncOrderUpdateCachesAndCatalog(payload) {
    if (!payload.new || !payload.new.id) return;
    if (Array.isArray(window.globalOrdersData)) {
        const idx = window.globalOrdersData.findIndex(o => o && o.id === payload.new.id);
        if (idx !== -1) {
            window.globalOrdersData[idx] = { ...window.globalOrdersData[idx], ...payload.new };
        }
    }
    try {
        const store = getStore();
        const cached = store ? store.getJSON('nisha_cached_orders', []) : [];
        if (Array.isArray(cached)) {
            const cIdx = cached.findIndex(o => o && o.id === payload.new.id);
            if (cIdx !== -1) {
                cached[cIdx] = { ...cached[cIdx], ...payload.new };
                if (store) store.setJSON('nisha_cached_orders', cached);
            }
        }
    } catch {}
    if (typeof document !== 'undefined') {
        const ordModal = document.getElementById('ordersModal');
        if (isModalElementOpen(ordModal)) {
            getGlobalFn('updateOrderTabCounters')?.();
            getGlobalFn('renderFilteredOrders')?.();
        }
    }

    if (Array.isArray(payload.new.items) && payload.new.items.length > 0 && Array.isArray(window.allItems)) {
        const lowerSt = String(payload.new.status || '').toLowerCase();
        const isPaidOrShipped = lowerSt.includes('оплач') || lowerSt.includes('отправ') || lowerSt.includes('заверш');
        const isCancelled = lowerSt.includes('отмен') || lowerSt.includes('возврат');
        payload.new.items.forEach(orderedItem => {
            const itId = orderedItem && (orderedItem.id || orderedItem);
            const catItem = window.allItems.find(i => i && String(i.id) === String(itId));
            if (!catItem) return;
            if (isPaidOrShipped && catItem.status !== 'sold') {
                catItem.status = 'sold';
                getGlobalFn('updateCardDOM')?.(catItem);
                getGlobalFn('removeSoldItemFromCart')?.(catItem.id, catItem.name);
            } else if (isCancelled && catItem.status !== 'available') {
                catItem.status = 'available';
                getGlobalFn('updateCardDOM')?.(catItem);
            }
        });
    }
}

/**
 * Subscribes to realtime order status & Nova Poshta TTN updates for the signed-in user.
 * @param {object} sb
 * @param {string} userId
 */
export function subscribeOrderStatusUpdates(sb, userId) {
    if (profileState.orderStatusChannel && typeof sb.removeChannel === 'function') {
        sb.removeChannel(profileState.orderStatusChannel);
    }
    const terminalFn = getGlobalFn('showTerminalModal');
    profileState.orderStatusChannel = sb.channel('order-status-updates')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${userId}`
        }, payload => {
            const prevSnapshot = findCachedOrderSnapshot(payload.new?.id);
            syncOrderUpdateCachesAndCatalog(payload);

            // Уведомления о статусе/ТТН показываем только когда пользователь в главной ленте (не в «Моих заказах» / модалках)
            if (!isUserOnMainFeed()) return;

            const newStatus = payload.new.status;
            const oldStatus = (payload.old && payload.old.status !== undefined)
                ? payload.old.status
                : (prevSnapshot ? prevSnapshot.status : null);
            const shortId = payload.new.id.split('-').at(0).toUpperCase();

            // 1. Изменение статуса заказа (без эмодзи и без спама стартовым статусом «В обработке»)
            if (newStatus && newStatus !== oldStatus && !isProcessingOrderStatus(newStatus)) {
                const formatStatusFn = getGlobalFn('formatOrderStatus');
                const formattedNewStatus = formatStatusFn
                    ? formatStatusFn(newStatus)
                    : (newStatus || '').toUpperCase();

                if (newStatus === 'Завершен') {
                    const firstItem = (Array.isArray(payload.new.items) && payload.new.items[0]) || null;
                    const itemName = firstItem ? (firstItem.name || 'Товар') : 'Товар';
                    const itemImg = firstItem ? (firstItem.image || firstItem.img || '') : '';
                    const itemId = firstItem ? (firstItem.id || '') : '';

                    notifyToast(
                        tProfile('profile.order_completed_toast', 'Заказ #{{orderId}} получен. Оставьте отзыв о покупке!', { orderId: shortId }),
                        'info',
                        itemImg,
                        () => {
                            getGlobalFn('promptOrderReview')?.(payload.new.id, itemName, itemImg, itemId);
                        }
                    );

                    if (terminalFn) {
                        terminalFn(
                            'ORDER_COMPLETED.LOG',
                            `${tProfile('profile.order_completed_title', 'Заказ #{{orderId}} успешно получен.', { orderId: escProfileHtml(shortId) })}<br><br>` +
                            `${tProfile('profile.order_completed_desc', 'Будем благодарны за отзыв о покупке на сайте.')}`,
                            tProfile('profile.order_completed_btn', '[ ОСТАВИТЬ ОТЗЫВ ]'),
                            () => {
                                getGlobalFn('promptOrderReview')?.(payload.new.id, itemName, itemImg, itemId);
                            }
                        );
                    }
                } else {
                    const orderPref = tProfile('orders_modal.order_prefix', 'ЗАКАЗ #');
                    notifyToast(`${orderPref}${shortId}: ${formattedNewStatus}`, 'success');

                    if (terminalFn) {
                        terminalFn(
                            'SYSTEM_NOTIFICATION.LOG',
                            `${tProfile('profile.order_status_title', 'Статус вашего заказа изменился.')}<br><br>` +
                            `${tProfile('profile.order_status_order', 'Заказ:')} #${escProfileHtml(shortId)}<br>` +
                            `${tProfile('profile.order_status_new', 'Новый статус:')} <b style="color:var(--accent-green);">${escProfileHtml(formattedNewStatus)}</b>`,
                            tProfile('profile.order_status_view', '[ ПОСМОТРЕТЬ ]'),
                            () => { getGlobalFn('openOrdersModal')?.(); }
                        );
                    }
                }
            }

            // 2. Добавление / обновление номера ТТН Новой Почты (без эмодзи)
            const newTtn = payload.new.tracking_number;
            const oldTtn = (payload.old && payload.old.tracking_number !== undefined)
                ? payload.old.tracking_number
                : (prevSnapshot ? prevSnapshot.tracking_number : null);
            if (newTtn && newTtn !== oldTtn && !newTtn.startsWith('ОШИБКА')) {
                notifyToast(
                    tProfile('profile.ttn_added_toast', 'Заказ #{{orderId}}: добавлен номер ТТН {{ttn}}', { orderId: shortId, ttn: newTtn }),
                    'success',
                    null,
                    () => {
                        getGlobalFn('openOrdersModal')?.();
                    }
                );

                if (terminalFn) {
                    terminalFn(
                        'TRACKING_NUMBER.LOG',
                        `${tProfile('profile.ttn_added_title', 'Заказ #{{orderId}} передан в доставку.', { orderId: escProfileHtml(shortId) })}<br><br>` +
                        `${tProfile('profile.ttn_added_number', 'Номер ТТН Новой Почты:')} <b style="color:var(--accent-green);">${escProfileHtml(newTtn)}</b>`,
                        tProfile('profile.ttn_added_btn', '[ ОТСЛЕДИТЬ ]'),
                        () => {
                            getGlobalFn('openOrdersModal')?.();
                        }
                    );
                }
            }
        })
        .subscribe();
}

/**
 * Subscribes to realtime admin answers on user's Q&A product questions.
 * @param {object} sb
 * @param {string} userId
 */
export function subscribeQaUpdates(sb, userId) {
    if (profileState.qaUpdatesChannel && typeof sb.removeChannel === 'function') {
        sb.removeChannel(profileState.qaUpdatesChannel);
    }
    const terminalFn = getGlobalFn('showTerminalModal');
    profileState.qaUpdatesChannel = sb.channel('qa-updates')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'item_questions',
            filter: `user_id=eq.${userId}`
        }, payload => {
            if (payload.new.answer && (!payload.old || !payload.old.answer)) {
                notifyToast(tProfile('messages.qa_answered', 'Вам ответили на вопрос по товару!'), 'success', null, () => {
                    if (payload.new.item_id) {
                        getGlobalFn('openProductModalById')?.(payload.new.item_id);
                    }
                });

                if (terminalFn) {
                    const truncateFn = getGlobalFn('safeTruncateText');
                    const safeSnippet = escProfileHtml(
                        truncateFn
                            ? truncateFn(String(payload.new.answer || ''), 150)
                            : String(payload.new.answer || '').slice(0, 150)
                    );
                    terminalFn(
                        'QUESTION_ANSWERED.LOG',
                        `${tProfile('profile.qa_answered_desc', 'На ваш вопрос по товару опубликован ответ.')}<br><br>` +
                        `<i>"${safeSnippet}"</i>`,
                        tProfile('profile.qa_answered_btn', '[ ПОСМОТРЕТЬ ТОВАР ]'),
                        () => {
                            if (payload.new.item_id) {
                                getGlobalFn('openProductModalById')?.(payload.new.item_id);
                            }
                        }
                    );
                }
            }
        })
        .subscribe();
}

/**
 * Restores or merges abandoned server cart with local cart upon session check.
 * @param {object|null} profile
 */
export async function syncProfileAbandonedCart(profile) {
    let localCart = window.cart || [];
    const syncFn = getGlobalFn('syncCartToServer');
    if (profile && profile.cart && profile.cart.length > 0) {
        const dbCart = profile.cart;
        if (localCart.length === 0) {
            localCart = dbCart.map(it => {
                if (it && typeof it === 'object') {
                    const clean = { ...it };
                    delete clean._isSold;
                    return clean;
                }
                return it;
            });
            window.cart = localCart;
            notifyToast(tProfile('messages.cart_restored', 'Корзина восстановлена'), 'success');
        } else {
            const mergedCart = [...localCart];
            let addedCount = 0;

            dbCart.forEach(dbItem => {
                const dbId = String(dbItem?.id || dbItem?.item_id || dbItem).trim();
                if (!mergedCart.some(it => String(it?.id || it?.item_id || it).trim() === dbId)) {
                    const clean = (dbItem && typeof dbItem === 'object') ? { ...dbItem } : dbItem;
                    if (clean && typeof clean === 'object') delete clean._isSold;
                    mergedCart.push(clean);
                    addedCount++;
                }
            });

            localCart = mergedCart;
            window.cart = localCart;
            if (addedCount > 0) notifyToast(tProfile('messages.cart_synced', 'Корзины синхронизированы'), 'success');
        }

        const store = getStore();
        if (store) store.setJSON('nisha_cart', localCart);
        if (syncFn) await syncFn();
    } else if (localCart.length > 0 && syncFn) {
        await syncFn();
    }
    const updateCartFn = getGlobalFn('updateCartUI');
    if (updateCartFn) updateCartFn();
}

/**
 * Checks active Supabase session, hydrates profile/contacts/delivery/favorites/cart, and subscribes realtime channels.
 */
export async function checkSession() {
    const sb = getSupabase();
    if (!sb) return;

    try {
        const { data: { user }, error: userError } = await sb.auth.getUser();
        if (!user || userError) {
            resetSignedOutProfileUI();
            return;
        }

        profileState.currentUser = user;
        const currentUser = user;
        const { profiles, profileErr } = await fetchProfileRecordWithFallback(sb, currentUser.id);

        if (!profileErr && profiles && profiles.length > 0) {
            profileState.userProfile = profiles.at(0);
            syncLanguageFromProfile(profileState.userProfile.language);
        }

        const uName = resolveAndHealDisplayName(sb, currentUser);
        const uEmail = currentUser.email;

        if (typeof document !== 'undefined') {
            setProfileAuthFormsVisible(true);
            const profNameEl = document.getElementById('profileName');
            const profEmailEl = document.getElementById('profileEmail');
            if (profNameEl) profNameEl.textContent = uName;
            if (profEmailEl) profEmailEl.textContent = uEmail;

            const mProfNameEl = document.getElementById('modalProfileName');
            const mProfEmailEl = document.getElementById('modalProfileEmail');
            if (mProfNameEl) mProfNameEl.textContent = uName;
            if (mProfEmailEl) mProfEmailEl.textContent = uEmail;
        }

        const store = getStore();
        const storedPhone = store ? (store.get('nisha_last_phone') || '') : '';
        const storedTg = store ? (store.get('nisha_last_tg') || '') : '';
        const uPhone = (profileState.userProfile?.phone || currentUser.user_metadata?.phone || storedPhone || '').trim();
        const uTg = (profileState.userProfile?.tg || currentUser.user_metadata?.tg || storedTg || '').trim();

        if (profileState.userProfile) {
            if (!profileState.userProfile.phone && uPhone) profileState.userProfile.phone = uPhone;
            if (!profileState.userProfile.tg && uTg) profileState.userProfile.tg = uTg;
        }

        if (uPhone) {
            if (store && !store.get('nisha_last_phone')) store.set('nisha_last_phone', uPhone);
            callProfileModalFn('renderProfilePhone', [uPhone]);
        } else {
            callProfileModalFn('renderProfilePhone', ['']);
        }

        if (uTg) {
            if (store && !store.get('nisha_last_tg')) store.set('nisha_last_tg', uTg);
            callProfileModalFn('renderProfileTg', [uTg]);
        } else {
            callProfileModalFn('renderProfileTg', ['']);
        }

        const cachedDelivery = (store ? store.getJSON('nisha_profile_delivery') : null) || {};
        const uFullName = (profileState.userProfile?.full_name || cachedDelivery.full_name || '').trim();
        const uDeliveryAddress = (profileState.userProfile?.delivery_address || cachedDelivery.delivery_address || '').trim();
        if (profileState.userProfile) {
            if (!profileState.userProfile.full_name && uFullName) profileState.userProfile.full_name = uFullName;
            if (!profileState.userProfile.delivery_address && uDeliveryAddress) profileState.userProfile.delivery_address = uDeliveryAddress;
        }
        callProfileModalFn('renderProfileDelivery', [uFullName, uDeliveryAddress]);

        const syncFields = getGlobalFn('updateProposeAndCheckoutFields');
        if (syncFields) syncFields();

        const phoneToLink = uPhone || (store ? store.get('nisha_last_phone') : null) || '';
        const phoneDigitsToLink = phoneToLink.replace(/[^\d]/g, '');
        if (phoneDigitsToLink.length >= 9 && window.apiClient) {
            const linkCacheKey = `nisha_linked_orders_v1:${currentUser.id}:${phoneDigitsToLink.slice(-9)}`;
            let alreadyLinked = false;
            try {
                const rawTs = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(linkCacheKey) : null;
                if (rawTs && (Date.now() - Number(rawTs)) < 30 * 60 * 1000) {
                    alreadyLinked = true;
                }
            } catch {}
            if (!alreadyLinked) {
                window.apiClient.post('/api/link-orders', {
                    userId: currentUser.id,
                    phone: phoneToLink
                }, { timeout: 8000, dedupe: true }).then((res) => {
                    if (res && res.success !== false) {
                        try {
                            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(linkCacheKey, String(Date.now()));
                        } catch {}
                    }
                }).catch(() => {});
            }
        }

        if (store && store.get('nisha_pending_otp_phone')) {
            callProfileModalFn('checkPendingPhoneVerification');
            if (store.get('nisha_pending_otp_phone') && !window.profileOtpPollInterval) {
                window.profileOtpPollInterval = setInterval(() => {
                    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
                    callProfileModalFn('checkPendingPhoneVerification');
                }, 2000);
            }
        }
        if (store && store.get('nisha_pending_otp_tg')) {
            callProfileModalFn('checkPendingTgVerification');
            if (store.get('nisha_pending_otp_tg') && !window.profileTgPollInterval) {
                window.profileTgPollInterval = setInterval(() => {
                    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
                    callProfileModalFn('checkPendingTgVerification');
                }, 2000);
            }
        }

        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker?.ready) {
            navigator.serviceWorker.ready.then(reg => {
                const subPush = getGlobalFn('subscribeUserToPush');
                if (subPush) subPush(reg, true);
            });
        }

        if (typeof sb.channel === 'function') {
            subscribeOrderStatusUpdates(sb, currentUser.id);
            subscribeQaUpdates(sb, currentUser.id);
        }

        await loadFavorites();
        await syncProfileAbandonedCart(profileState.userProfile);

        if (currentUser?.id) {
            getGlobalFn('subscribeUserRealtime')?.(currentUser.id);
            if (typeof window !== 'undefined' && window.analytics && typeof window.analytics.identifyUser === 'function') {
                window.analytics.identifyUser(currentUser.id, {
                    username: uName || '',
                    lang: profileState.userProfile?.language || 'ua'
                });
            }
        }
        getGlobalFn('syncUserBargains')?.();
        getGlobalFn('checkUnreadSupportReplies')?.();
    } catch (err) {
        console.error('Ошибка в checkSession:', err);
    }
}
bindWindowFn('checkSession', checkSession);
