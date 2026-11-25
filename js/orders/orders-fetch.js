// ==========================================
// NISHA ORDERS FETCH & IMAGE HYDRATION MODULE
// ==========================================

import { invokeAction, resolveAction } from '../core/action-registry.js';
import { getRuntimeProfile, getRuntimeSiteLang, getRuntimeUser, tSafe } from '../core/runtime-env.js';
import {
    escAttr,
    escHtml,
    getOrderItemsImageCache,
    getOrdersData,
    getStorage,
    getSupabase,
    mergeRemoteHiddenOrderIds,
    pruneCachedOrdersByIds,
    setOrdersData,
    toCDN
} from './orders-state.js';

export function getOrderItemImage(item) {
    if (!item) return '';

    if (item.image && typeof item.image === 'string' && item.image.trim().length > 5) {
        return toCDN(item.image);
    }
    for (const key of ['img', 'thumbnail', 'photo', 'picture']) {
        if (item[key] && typeof item[key] === 'string' && item[key].trim().length > 5) {
            return toCDN(item[key]);
        }
    }

    if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0 && typeof item.thumbnails.at(0) === 'string' && item.thumbnails.at(0).trim().length > 5) {
        return toCDN(item.thumbnails.at(0));
    }
    if (Array.isArray(item.images) && item.images.length > 0 && typeof item.images.at(0) === 'string' && item.images.at(0).trim().length > 5) {
        return toCDN(item.images.at(0));
    }

    const imageCache = getOrderItemsImageCache();
    if (item.id && imageCache && (typeof hasOwn === 'function' ? hasOwn(imageCache, item.id) : Object.hasOwn(imageCache, item.id))) {
        return imageCache[item.id];
    }

    const getCatalogFn = resolveAction('getCatalog');
    const catalog = getCatalogFn ? getCatalogFn() : ((typeof window !== 'undefined' && window.catalog) || []);
    if (Array.isArray(catalog)) {
        const catalogItem = catalog.find(p => (item.id && p && p.id === item.id) || (item.name && p && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()));
        if (catalogItem) {
            const optImgFn = resolveAction('getOptimizedImageUrl');
            let foundUrl = '';
            if (optImgFn) {
                foundUrl = optImgFn(catalogItem, true);
            } else if (typeof getOptimizedImageUrl === 'function') {
                foundUrl = getOptimizedImageUrl(catalogItem, true);
            }
            if (!foundUrl && Array.isArray(catalogItem.thumbnails) && catalogItem.thumbnails.length > 0) {
                foundUrl = catalogItem.thumbnails.at(0);
            }
            if (!foundUrl && Array.isArray(catalogItem.images) && catalogItem.images.length > 0) {
                foundUrl = catalogItem.images.at(0);
            }
            if (foundUrl) {
                const cdnUrl = toCDN(foundUrl);
                if (item.id && imageCache) imageCache[item.id] = cdnUrl;
                return cdnUrl;
            }
        }
    }

    return '';
}

export async function ensureOrderImagesLoaded() {
    const ordersList = getOrdersData();
    if (!Array.isArray(ordersList) || ordersList.length === 0) return;

    const missingIds = [];
    ordersList.forEach(order => {
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

    const imageCache = getOrderItemsImageCache();

    try {
        const { data } = await sb.from('items').select('id, thumbnails, images').in('id', missingIds);
        if (data && data.length > 0) {
            data.forEach(di => {
                const imgUrl = (di.thumbnails && di.thumbnails.length > 0) ? di.thumbnails.at(0) : (di.images && di.images.length > 0 ? di.images.at(0) : '');
                if (imgUrl) {
                    imageCache[di.id] = toCDN(imgUrl);
                }
            });
        }

        const stillMissing = missingIds.filter(id => !(typeof hasOwn === 'function' ? hasOwn(imageCache, id) : Object.hasOwn(imageCache, id)));
        if (stillMissing.length > 0) {
            const { data: archData } = await sb.from('archived_items').select('id, thumbnails, images').in('id', stillMissing);
            if (archData && archData.length > 0) {
                archData.forEach(di => {
                    const imgUrl = (di.thumbnails && di.thumbnails.length > 0) ? di.thumbnails.at(0) : (di.images && di.images.length > 0 ? di.images.at(0) : '');
                    if (imgUrl) {
                        imageCache[di.id] = toCDN(imgUrl);
                    }
                });
            }
        }

        if (typeof document !== 'undefined') {
            document.querySelectorAll('.order-item-img[data-item-id]').forEach(el => {
                const itId = el.getAttribute('data-item-id');
                const resolved = getOrderItemImage({ id: itId });
                if (resolved) {
                    el.style.backgroundImage = `url('${resolved}')`;
                    el.textContent = '';
                }
            });
        }
    } catch (e) {
        console.warn('Could not batch fetch missing order images:', e);
    }
}

function renderOrdersErrorCard(listArea, { code = 'SYSTEM_ERROR.LOG', messageHtml = '', actionHtml = '' } = {}) {
    if (!listArea) return;
    listArea.innerHTML = `
        <div class="orders-error-card" role="alert">
            <div class="orders-error-header">
                <span>[ ${escHtml(code)} ]</span>
            </div>
            <div class="orders-error-body">${messageHtml}</div>
            ${actionHtml ? `<div class="orders-error-actions">${actionHtml}</div>` : ''}
        </div>
    `;
}

export async function fetchMyOrders() {
    const listArea = document.getElementById('ordersListArea');
    const tabsContainer = document.getElementById('ordersTabs');
    if (!listArea) return;

    const store = getStorage();
    const initialUser = getRuntimeUser();
    let currentOrders = getOrdersData();

    if (!currentOrders || currentOrders.length === 0) {
        const cached = store ? store.getJSON('nisha_cached_orders', []) : [];
        const scopedCached = Array.isArray(cached)
            ? cached.filter(co => co && (!initialUser || !co.user_id || String(co.user_id) === String(initialUser.id)))
            : [];
        if (scopedCached.length > 0) {
            setOrdersData(scopedCached);
            currentOrders = getOrdersData();
            if (currentOrders.length > 0) {
                if (tabsContainer) tabsContainer.style.display = 'flex';
                invokeAction('updateOrderTabCounters');
                invokeAction('renderFilteredOrders');
            }
        }
    }

    if (!currentOrders || currentOrders.length === 0) {
        const loadingDbMsg = tSafe('orders_modal.loading_db', { defaultValue: '[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]' });
        listArea.innerHTML = `<div style="text-align:center; color:#aaa; font-family: monospace;">${loadingDbMsg}</div>`;
        if (tabsContainer) tabsContainer.style.display = 'none';
    }

    let fetchError = null;
    const sb = getSupabase();
    if (!sb) return;

    const activeUser = getRuntimeUser();
    const activeProfile = getRuntimeProfile();
    invokeAction('bindOrdersTabSwipe');

    if (activeUser) {
        try {
            const candidatePhones = new Set();
            if (activeProfile?.phone) candidatePhones.add(activeProfile.phone);
            if (activeUser?.phone) candidatePhones.add(activeUser.phone);
            if (activeUser?.user_metadata?.phone) candidatePhones.add(activeUser.user_metadata.phone);
            const lastPhone = store ? store.get('nisha_last_phone') : null;
            if (lastPhone) candidatePhones.add(lastPhone);
            const pendingPhone = store ? store.get('nisha_pending_otp_phone') : null;
            if (pendingPhone) candidatePhones.add(pendingPhone);
            const chkData = store ? store.getJSON('nisha_checkout_data', {}) : {};
            if (chkData && chkData.phone) candidatePhones.add(chkData.phone);
            const cachedLocal = store ? store.getJSON('nisha_cached_orders', []) : [];
            if (Array.isArray(cachedLocal)) {
                cachedLocal.forEach(co => { if (co && co.phone) candidatePhones.add(co.phone); });
            }

            const { data: userOrders, error: userOrdersErr } = await sb
                .from('orders')
                .select('id, phone, status, created_at, items, tracking_number, total_sum, user_id')
                .eq('user_id', activeUser.id)
                .order('created_at', { ascending: false });

            if (userOrdersErr) fetchError = userOrdersErr;

            const orderMap = new Map();
            (userOrders || []).forEach(o => {
                if (o && o.id) {
                    orderMap.set(o.id, o);
                    if (o.phone) candidatePhones.add(o.phone);
                }
            });

            const queriedLast9 = new Set();
            const uniqueCleanPhones = new Set();
            const phoneRpcTasks = [];

            for (const rawP of candidatePhones) {
                const clean = String(rawP).replace(/[^\d]/g, '');
                if (clean.length >= 9) {
                    const last9 = clean.slice(-9);
                    const canonicalPhone = '380' + last9;
                    uniqueCleanPhones.add(canonicalPhone);
                    if (queriedLast9.has(last9)) continue;
                    queriedLast9.add(last9);

                    phoneRpcTasks.push(
                        sb.rpc('get_orders_by_phone', { search_phone: canonicalPhone })
                            .then(({ data: phoneOrders }) => {
                                if (Array.isArray(phoneOrders) && phoneOrders.length > 0) {
                                    for (const po of phoneOrders) {
                                        if (po && po.id && !orderMap.has(po.id)) {
                                            orderMap.set(po.id, po);
                                        }
                                    }
                                }
                            })
                            .catch(() => {})
                    );
                }
            }

            if (phoneRpcTasks.length > 0) {
                await Promise.all(phoneRpcTasks);
            }

            if (Array.isArray(cachedLocal)) {
                cachedLocal.forEach(co => {
                    if (co && co.id && (!co.user_id || String(co.user_id) === String(activeUser.id)) && !orderMap.has(co.id)) {
                        orderMap.set(co.id, co);
                    }
                });
            }

            if (uniqueCleanPhones.size > 0 && typeof window !== 'undefined' && window.apiClient) {
                const uid = activeUser.id;
                const phonesToLink = Array.from(uniqueCleanPhones).filter((clean) => {
                    const key = `nisha_linked_orders_v1:${uid}:${String(clean).slice(-9)}`;
                    try {
                        const rawTs = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
                        if (rawTs && (Date.now() - Number(rawTs)) < 30 * 60 * 1000) return false;
                    } catch {}
                    return true;
                });

                const linkTasks = phonesToLink.map(clean => {
                    const key = `nisha_linked_orders_v1:${uid}:${String(clean).slice(-9)}`;
                    return window.apiClient.post('/api/link-orders', {
                        userId: uid,
                        phone: clean
                    }, { timeout: 8000, dedupe: true }).then((res) => {
                        if (res && res.success !== false) {
                            try {
                                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, String(Date.now()));
                            } catch {}
                        }
                        return res;
                    });
                });

                const settleHandler = typeof Promise.allSettled === 'function'
                    ? Promise.allSettled(linkTasks)
                    : Promise.all(linkTasks.map(p => p.catch(() => null)));

                settleHandler.then(async (results) => {
                    const currentActiveUser = getRuntimeUser();
                    const newlyLinked = results.some(r => {
                        const val = r && r.status ? (r.status === 'fulfilled' ? r.value : null) : r;
                        return val && val.count > 0;
                    });
                    if (newlyLinked && currentActiveUser && currentActiveUser.id === uid) {
                        const { data: refreshed } = await sb.from('orders').select('id, phone, status, created_at, items, tracking_number, total_sum, user_id').eq('user_id', uid).order('created_at', { ascending: false });
                        if (Array.isArray(refreshed) && refreshed.length > 0) {
                            let added = false;
                            refreshed.forEach(ro => {
                                if (ro && ro.id && !orderMap.has(ro.id)) {
                                    orderMap.set(ro.id, ro);
                                    added = true;
                                }
                            });
                            if (added) {
                                const orderValues = Array.from(orderMap.values());
                                const sortOrdersDesc = (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
                                const sortFn = resolveAction('toSorted');
                                const sortedOrders = sortFn
                                    ? sortFn(orderValues, sortOrdersDesc)
                                    : (typeof orderValues.toSorted === 'function'
                                        ? orderValues.toSorted(sortOrdersDesc)
                                        : [...orderValues].sort(sortOrdersDesc));
                                setOrdersData(sortedOrders);
                                const visibleAfterLink = getOrdersData();
                                try { if (store) store.setJSON('nisha_cached_orders', visibleAfterLink); } catch {}
                                invokeAction('updateOrderTabCounters');
                                ensureOrderImagesLoaded();
                                invokeAction('renderFilteredOrders');
                            }
                        }
                    }
                }).catch(() => {});
            }

            const initialOrderValues = Array.from(orderMap.values());
            const sortOrdersDesc = (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
            const sortFn = resolveAction('toSorted');
            const nextOrders = sortFn
                ? sortFn(initialOrderValues, sortOrdersDesc)
                : (typeof initialOrderValues.toSorted === 'function'
                    ? initialOrderValues.toSorted(sortOrdersDesc)
                    : [...initialOrderValues].sort(sortOrdersDesc));
            if (Array.isArray(activeUser.user_metadata?.hidden_order_ids) && activeUser.user_metadata.hidden_order_ids.length > 0) {
                mergeRemoteHiddenOrderIds(activeUser.user_metadata.hidden_order_ids);
            }
            setOrdersData(nextOrders);
            const visibleOrders = getOrdersData();
            if (visibleOrders.length > 0) {
                try { if (store) store.setJSON('nisha_cached_orders', visibleOrders); } catch {}
            } else if (nextOrders.length > 0) {
                try { if (store) store.setJSON('nisha_cached_orders', []); } catch {}
            }

            const apiClient = typeof window !== 'undefined' ? window.apiClient : null;
            if (apiClient && typeof apiClient.get === 'function') {
                const syncUserId = activeUser.id;
                Promise.resolve(apiClient.get('/api/orders/hidden', { timeout: 6000 }))
                    .then((res) => {
                        const currentUser = getRuntimeUser();
                        if (!currentUser || String(currentUser.id) !== String(syncUserId)) return;
                        if (!Array.isArray(res?.hiddenOrderIds) || res.hiddenOrderIds.length === 0) return;

                        const changed = mergeRemoteHiddenOrderIds(res.hiddenOrderIds);
                        pruneCachedOrdersByIds(res.hiddenOrderIds);
                        const beforeList = getOrdersData();
                        setOrdersData(beforeList);
                        const afterList = getOrdersData();

                        if (changed || afterList.length !== beforeList.length) {
                            invokeAction('syncOrdersSelectionToolbar');
                            invokeAction('updateOrderTabCounters');
                            invokeAction('renderFilteredOrders');
                        }
                    })
                    .catch(() => {});
            }
        } catch (e) {
            fetchError = e;
        }
    } else {
        const phoneInput = document.getElementById('ordersSearchPhone');
        const phone = phoneInput ? phoneInput.value.replace(/[^\d+]/g, '') : '';
        if (!phone || phone.length < 10) {
            const toastFn = resolveAction('showToast') || (typeof showToast === 'function' ? showToast : null);
            if (toastFn) {
                const errPhoneMsg = tSafe('orders_modal.err_phone', { defaultValue: 'Введите корректный номер телефона!' });
                toastFn(errPhoneMsg, 'error');
            }
            const errNoPhoneMsg = tSafe('orders_modal.err_no_phone', { defaultValue: '[ НОМЕР НЕ ВВЕДЕН ]' });
            listArea.innerHTML = `<div style="text-align:center; color:#555; font-family: monospace;">${errNoPhoneMsg}</div>`;
            return;
        }

        const { data: vResult } = await sb.rpc('check_otp_verified', { p_phone: phone });
        const otpCheck = vResult ? [{ is_verified: true }] : [];
        if (!otpCheck || otpCheck.length === 0 || !otpCheck.at(0).is_verified) {
            const deniedOtpMsg = tSafe('orders_modal.access_denied_otp', { defaultValue: 'Сначала подтвердите, что это ваш номер телефона.' });
            const verifyBotMsg = tSafe('orders_modal.verify_bot_btn', { defaultValue: 'ПОДТВЕРДИТЬ НОМЕР В БОТЕ' });
            renderOrdersErrorCard(listArea, {
                code: 'ACCESS_DENIED.SYS',
                messageHtml: deniedOtpMsg,
                actionHtml: `<button type="button" class="cart-checkout-btn btn-target" data-action="verify-orders-phone" data-phone="${escAttr(phone)}">[ ${escHtml(verifyBotMsg)} ]</button>`
            });
            return;
        }

        const cleanPhone = phone.replace(/[^\d]/g, '');
        const { data, error } = await sb.rpc('get_orders_by_phone', { search_phone: cleanPhone });
        setOrdersData(data || []);
        fetchError = error;

        const nextGuestOrders = getOrdersData();
        if (nextGuestOrders.length > 0) {
            try { if (store) store.setJSON('nisha_cached_orders', nextGuestOrders); } catch {}
        }
    }

    const latestOrders = getOrdersData();

    if (fetchError && (!latestOrders || latestOrders.length === 0)) {
        const rawErr = String(fetchError.message || 'Unknown error');
        const isAccessDenied = /ACCESS_DENIED|OTP|не подтвержден|не підтверджено/i.test(rawErr);
        const cleanMsg = rawErr.replace(/^\s*ACCESS_DENIED\s*:\s*/i, '').trim();
        const phoneInput = document.getElementById('ordersSearchPhone');
        const enteredPhone = phoneInput ? phoneInput.value.replace(/[^\d+]/g, '') : '';

        let displayMsg = cleanMsg || rawErr;
        let actionHtml = '';
        if (isAccessDenied) {
            if (/OTP|профил|профіл|не подтвержден|не підтверджено/i.test(rawErr)) {
                const lang = getRuntimeSiteLang();
                const otpErrFallbacks = {
                    ua: 'Номер телефону не підтверджено через OTP або профіль',
                    ru: 'Номер телефона не подтвержден через OTP или профиль',
                    en: 'Phone number is not verified via OTP or profile'
                };
                const localizedDefault = otpErrFallbacks[lang] || otpErrFallbacks.ua;
                displayMsg = tSafe('orders_modal.err_otp_unverified', { defaultValue: localizedDefault });
            }
            if (enteredPhone && enteredPhone.length >= 10) {
                const verifyBotMsg = tSafe('orders_modal.verify_bot_btn', { defaultValue: 'ПОДТВЕРДИТЬ НОМЕР В БОТЕ' });
                actionHtml = `<button type="button" class="cart-checkout-btn btn-target" data-action="verify-orders-phone" data-phone="${escAttr(enteredPhone)}">[ ${escHtml(verifyBotMsg)} ]</button>`;
            } else {
                const openProfileMsg = tSafe('profile.title', { defaultValue: 'ПРОФИЛЬ' });
                actionHtml = `<button type="button" class="cart-checkout-btn btn-target" data-action="open-profile">[ ${escHtml(openProfileMsg)} ]</button>`;
            }
        }

        renderOrdersErrorCard(listArea, {
            code: isAccessDenied ? 'ACCESS_DENIED.SYS' : 'SYSTEM_ERROR.LOG',
            messageHtml: escHtml(displayMsg),
            actionHtml
        });
        return;
    }

    if (!latestOrders || latestOrders.length === 0) {
        const emptyTitle = tSafe('orders_modal.empty_title', 'ЗАКАЗОВ НЕТ');
        const emptyDesc = tSafe('orders_modal.empty_desc', 'Вы еще не делали заказов в нашем магазине.');
        listArea.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a;">
                <div style="font-size: 30px; margin-bottom: 15px;">📦</div>
                <div style="color:var(--accent-red); font-family: var(--font-mono); font-weight:bold; margin-bottom: 10px;">${emptyTitle}</div>
                <div style="color:#888; font-size: 13px; line-height: 1.5;">${emptyDesc}</div>
            </div>`;
        return;
    }

    if (tabsContainer) tabsContainer.style.display = 'flex';

    invokeAction('updateOrderTabCounters');
    ensureOrderImagesLoaded();
    invokeAction('renderFilteredOrders');

    // Синхронизация статуса отзывов из БД: если отзыв уже был оставлен, он окончательно блокируется
    if (Array.isArray(latestOrders) && latestOrders.length > 0 && sb) {
        const completedIds = latestOrders.filter(o => (o.status || '').toLowerCase() === 'завершен').map(o => o.id);
        if (completedIds.length > 0) {
            sb.from('reviews').select('order_id').in('order_id', completedIds).then(({ data: revs }) => {
                if (Array.isArray(revs) && revs.length > 0) {
                    let rOrders = store ? store.getJSON('nisha_reviewed_orders', []) : [];
                    if (!Array.isArray(rOrders)) rOrders = [];
                    let hasNew = false;
                    revs.forEach(r => {
                        if (r.order_id && !rOrders.includes(r.order_id)) {
                            rOrders.push(r.order_id);
                            hasNew = true;
                        }
                    });
                    if (hasNew) {
                        if (store) store.setJSON('nisha_reviewed_orders', rOrders);
                        invokeAction('renderFilteredOrders');
                    }
                }
            }).catch(() => {});
        }
    }
}
