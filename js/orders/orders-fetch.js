// ==========================================
// NISHA ORDERS FETCH & IMAGE HYDRATION MODULE
// ==========================================

import { invokeAction, resolveAction } from '../core/action-registry.js';
import {
    escAttr,
    escHtml,
    getOrderItemsImageCache,
    getOrdersData,
    getStorage,
    getSupabase,
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
                    el.innerText = '';
                }
            });
        }
    } catch (e) {
        console.warn('Could not batch fetch missing order images:', e);
    }
}

export async function fetchMyOrders() {
    const listArea = document.getElementById('ordersListArea');
    const tabsContainer = document.getElementById('ordersTabs');
    if (!listArea) return;

    const store = getStorage();
    let currentOrders = getOrdersData();

    if (!currentOrders || currentOrders.length === 0) {
        const cached = store ? store.getJSON('nisha_cached_orders', []) : [];
        if (Array.isArray(cached) && cached.length > 0) {
            setOrdersData(cached);
            currentOrders = cached;
            if (tabsContainer) tabsContainer.style.display = 'flex';
            invokeAction('updateOrderTabCounters');
            invokeAction('renderFilteredOrders');
        }
    }

    if (!currentOrders || currentOrders.length === 0) {
        const loadingDbMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.loading_db', { defaultValue: '[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]' }) : '[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]';
        listArea.innerHTML = `<div style="text-align:center; color:#aaa; font-family: monospace;">${loadingDbMsg}</div>`;
        if (tabsContainer) tabsContainer.style.display = 'none';
    }

    let fetchError = null;
    const sb = getSupabase();
    if (!sb) return;

    const activeUser = (typeof window !== 'undefined' && window.currentUser) || (typeof currentUser !== 'undefined' ? currentUser : null);
    const activeProfile = (typeof window !== 'undefined' && window.userProfile) || (typeof userProfile !== 'undefined' ? userProfile : null);
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
                    if (co && co.id && !orderMap.has(co.id)) {
                        orderMap.set(co.id, co);
                    }
                });
            }

            if (uniqueCleanPhones.size > 0 && typeof window !== 'undefined' && window.apiClient) {
                const uid = activeUser.id;
                const linkTasks = Array.from(uniqueCleanPhones).map(clean =>
                    window.apiClient.post('/api/link-orders', {
                        userId: uid,
                        phone: clean
                    }, { timeout: 8000, dedupe: true })
                );

                const settleHandler = typeof Promise.allSettled === 'function'
                    ? Promise.allSettled(linkTasks)
                    : Promise.all(linkTasks.map(p => p.catch(() => null)));

                settleHandler.then(async (results) => {
                    const currentActiveUser = (typeof window !== 'undefined' && window.currentUser) || (typeof currentUser !== 'undefined' ? currentUser : null);
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
                                try { if (store) store.setJSON('nisha_cached_orders', sortedOrders); } catch {}
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
            setOrdersData(nextOrders);
            if (nextOrders.length > 0) {
                try { if (store) store.setJSON('nisha_cached_orders', nextOrders); } catch {}
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
                const errPhoneMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.err_phone', { defaultValue: 'Введите корректный номер телефона!' }) : 'Введите корректный номер телефона!';
                toastFn(errPhoneMsg, 'error');
            }
            const errNoPhoneMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.err_no_phone', { defaultValue: '[ НОМЕР НЕ ВВЕДЕН ]' }) : '[ НОМЕР НЕ ВВЕДЕН ]';
            listArea.innerHTML = `<div style="text-align:center; color:#555; font-family: monospace;">${errNoPhoneMsg}</div>`;
            return;
        }

        const { data: vResult } = await sb.rpc('check_otp_verified', { p_phone: phone });
        const otpCheck = vResult ? [{ is_verified: true }] : [];
        if (!otpCheck || otpCheck.length === 0 || !otpCheck.at(0).is_verified) {
            const deniedOtpMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.access_denied_otp', { defaultValue: '[ ДОСТУП ЗАПРЕЩЕН ]<br><br>Сначала подтвердите, что это ваш номер.' }) : '[ ДОСТУП ЗАПРЕЩЕН ]<br><br>Сначала подтвердите, что это ваш номер.';
            const verifyBotMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.verify_bot_btn', { defaultValue: 'ПОДТВЕРДИТЬ НОМЕР В БОТЕ' }) : 'ПОДТВЕРДИТЬ НОМЕР В БОТЕ';
            listArea.innerHTML = `<div style="text-align:center; color:var(--accent-red); font-family: monospace; padding: 20px;">${deniedOtpMsg}</div>
            <button class="cart-checkout-btn btn-target" style="margin: 0 auto; display: block;" data-action="verify-orders-phone" data-phone="${escAttr(phone)}">${verifyBotMsg}</button>`;
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
        const safeFetchErr = escHtml(fetchError.message);
        listArea.innerHTML = `<div style="color:red; text-align:center;">[ ОШИБКА: ${safeFetchErr} ]</div>`;
        return;
    }

    if (!latestOrders || latestOrders.length === 0) {
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
