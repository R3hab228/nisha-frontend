// ==========================================
// NISHA MY ORDERS MODULE (Lazy Chunk: MY_ORDERS.EXE & JSBARCODE)
// ==========================================

if (typeof window.globalOrdersData === 'undefined') window.globalOrdersData = [];
if (typeof window.currentOrderTab === 'undefined') window.currentOrderTab = 'accepted'; // accepted, shipped, cancelled
if (typeof window.orderItemsImageCache === 'undefined') window.orderItemsImageCache = {};

const toCDN = (u) => (typeof window.toCDN === 'function' ? window.toCDN(u) : (u || ''));
const orderDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });

function openOrdersModal() {
    const modal = document.getElementById('ordersModal');
    if (modal) modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (typeof window.stopLenis === 'function') window.stopLenis();
    else if (typeof lenis !== 'undefined') lenis.stop();
    
    const guestInputGroup = document.getElementById('guestOrderInputGroup');
    const guestText = document.getElementById('guestOrderText');
    const listArea = document.getElementById('ordersListArea');

    const activeUser = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
    const activeProfile = window.userProfile || (typeof userProfile !== 'undefined' ? userProfile : null);

    if (activeUser) {
        if (guestInputGroup) guestInputGroup.style.display = 'none';
        
        let dName = activeProfile?.username;
        if (!dName || dName === 'User') {
            dName = activeUser.user_metadata?.full_name || activeUser.user_metadata?.name || activeUser.email.split('@')[0];
        }
        
        const grantedMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.access_granted', {defaultValue: 'Доступ разрешен'}) : 'Доступ разрешен';
        if (guestText) guestText.innerHTML = `${grantedMsg}: <span style="color:var(--accent-green); font-weight:bold;">@${dName}</span>`;
        updateOrderTabCounters();
        fetchMyOrders();
    } else {
        if (guestInputGroup) guestInputGroup.style.display = 'flex';
        if (guestText) guestText.innerHTML = 'Введите номер телефона, указанный при заказе, чтобы отследить статус:';
        if (listArea) listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace; padding: 30px;">Введите номер телефона для поиска...</div>';
        updateOrderTabCounters();

        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        const lastPhone = store ? store.get('nisha_last_phone') : null;
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
if (typeof globalThis !== 'undefined') globalThis.openOrdersModal = openOrdersModal;

// Вспомогательная группировка заказов по статусам для вкладок (через Object.groupBy)
function getOrderTabBucket(order) {
    const s = (order?.status || '').toLowerCase();
    if (s.includes('принят') || s.includes('оплачен') || s.includes('обработке') || s.includes('processing') || s.includes('новый')) {
        return 'accepted';
    }
    if (s.includes('отправлен') || s.includes('завершен')) {
        return 'shipped';
    }
    if (s.includes('отменен') || s.includes('возврат')) {
        return 'cancelled';
    }
    return 'other';
}
window.getOrderTabBucket = getOrderTabBucket;

// Обновление счетчиков на вкладках заказов и авто-выбор активной вкладки
function updateOrderTabCounters() {
    const ordersList = Array.isArray(window.globalOrdersData) ? window.globalOrdersData : [];
    const grouped = (typeof Object.groupBy === 'function')
        ? Object.groupBy(ordersList, getOrderTabBucket)
        : ordersList.reduce((acc, o) => {
            const b = getOrderTabBucket(o);
            (acc[b] = acc[b] || []).push(o);
            return acc;
        }, {});

    const acceptedCount = grouped.accepted ? grouped.accepted.length : 0;
    const shippedCount = grouped.shipped ? grouped.shipped.length : 0;
    const cancelledCount = grouped.cancelled ? grouped.cancelled.length : 0;

    const tabYellow = document.querySelector('.order-tab.tab-yellow');
    const tabBlue = document.querySelector('.order-tab.tab-blue');
    const tabRed = document.querySelector('.order-tab.tab-red');

    const txtAccepted = typeof i18next !== 'undefined' ? i18next.t('orders_modal.tab_accepted', {defaultValue: 'ПРИНЯТЫЕ'}) : 'ПРИНЯТЫЕ';
    const txtShipped = typeof i18next !== 'undefined' ? i18next.t('orders_modal.tab_shipped', {defaultValue: 'ОТПРАВЛЕННЫЕ'}) : 'ОТПРАВЛЕННЫЕ';
    const txtCancelled = typeof i18next !== 'undefined' ? i18next.t('orders_modal.tab_cancelled', {defaultValue: 'ОТМЕНЕННЫЕ'}) : 'ОТМЕНЕННЫЕ';

    if (tabYellow) {
        tabYellow.removeAttribute('data-i18n');
        tabYellow.innerHTML = `<span data-i18n="orders_modal.tab_accepted">${txtAccepted}</span> <span id="orderTabCountAccepted">(${acceptedCount})</span>`;
    }
    if (tabBlue) {
        tabBlue.removeAttribute('data-i18n');
        tabBlue.innerHTML = `<span data-i18n="orders_modal.tab_shipped">${txtShipped}</span> <span id="orderTabCountShipped">(${shippedCount})</span>`;
    }
    if (tabRed) {
        tabRed.removeAttribute('data-i18n');
        tabRed.innerHTML = `<span data-i18n="orders_modal.tab_cancelled">${txtCancelled}</span> <span id="orderTabCountCancelled">(${cancelledCount})</span>`;
    }

    // Умный выбор: если активных 0, а завершенных/отправленных > 0 — автоматически переключаем на них!
    if (acceptedCount === 0 && shippedCount > 0 && window.currentOrderTab === 'accepted') {
        window.currentOrderTab = 'shipped';
    } else if (!window.currentOrderTab || (window.currentOrderTab !== 'shipped' && window.currentOrderTab !== 'cancelled')) {
        window.currentOrderTab = 'accepted';
    }

    const currentTab = window.currentOrderTab;
    if (tabYellow) tabYellow.classList.toggle('active', currentTab === 'accepted');
    if (tabBlue) tabBlue.classList.toggle('active', currentTab === 'shipped');
    if (tabRed) tabRed.classList.toggle('active', currentTab === 'cancelled');
}
window.updateOrderTabCounters = updateOrderTabCounters;
if (typeof globalThis !== 'undefined') globalThis.updateOrderTabCounters = updateOrderTabCounters;

async function fetchMyOrders() {
    const listArea = document.getElementById('ordersListArea');
    const tabsContainer = document.getElementById('ordersTabs');
    if (!listArea) return;
    
    // 1. Мгновенно отображаем локально сохраненные заказы, если сетка пуста
    if (!window.globalOrdersData || window.globalOrdersData.length === 0) {
        const cached = window.storage ? window.storage.getJSON('nisha_cached_orders', []) : [];
        if (Array.isArray(cached) && cached.length > 0) {
            window.globalOrdersData = cached;
            if (tabsContainer) tabsContainer.style.display = 'flex';
            updateOrderTabCounters();
            renderFilteredOrders();
        }
    }

    if (!window.globalOrdersData || window.globalOrdersData.length === 0) {
        listArea.innerHTML = '<div style="text-align:center; color:#aaa; font-family: monospace;">[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]</div>';
        if (tabsContainer) tabsContainer.style.display = 'none';
    }

    let fetchError = null;
    const sb = typeof getSupabase === 'function' ? getSupabase() : (window.supabaseClient || null);
    if (!sb) return;

    const activeUser = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
    const activeProfile = window.userProfile || (typeof userProfile !== 'undefined' ? userProfile : null);

    if (activeUser) {
        try {
            const candidatePhones = new Set();
            if (activeProfile?.phone) candidatePhones.add(activeProfile.phone);
            if (activeUser?.phone) candidatePhones.add(activeUser.phone);
            if (activeUser?.user_metadata?.phone) candidatePhones.add(activeUser.user_metadata.phone);
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
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

            // 1. Запрашиваем заказы, привязанные к ID текущего аккаунта (мгновенно из Supabase)
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

            // 2. Дополнительно ищем заказы по всем номерам телефона клиента (в форматах 380... и 0...)
            const queriedSearchPhones = new Set();
            const uniqueCleanPhones = new Set();
            for (const rawP of candidatePhones) {
                const clean = String(rawP).replace(/[^\d]/g, '');
                if (clean.length >= 9) {
                    uniqueCleanPhones.add(clean);
                    const last9 = clean.slice(-9);
                    const variants = ['380' + last9, '0' + last9, clean];
                    for (const v of variants) {
                        if (queriedSearchPhones.has(v)) continue;
                        queriedSearchPhones.add(v);
                        try {
                            const { data: phoneOrders } = await sb.rpc('get_orders_by_phone', { search_phone: v });
                            if (Array.isArray(phoneOrders) && phoneOrders.length > 0) {
                                for (const po of phoneOrders) {
                                    if (po && po.id && !orderMap.has(po.id)) {
                                        orderMap.set(po.id, po);
                                    }
                                }
                            }
                        } catch (rpcErr) {}
                    }
                }
            }

            // Сохраняем также локально закэшированные заказы с этого устройства, если они еще не попали в выборку
            if (Array.isArray(cachedLocal)) {
                cachedLocal.forEach(co => {
                    if (co && co.id && !orderMap.has(co.id)) {
                        orderMap.set(co.id, co);
                    }
                });
            }

            // 3. Неблокирующая фоновая привязка гостевых заказов к user_id на сервере (без зависания на холодном старте Render)
            if (uniqueCleanPhones.size > 0 && window.apiClient) {
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
                    const currentActiveUser = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
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
                                window.globalOrdersData = (typeof window.toSorted === 'function')
                                    ? window.toSorted(orderValues, (a, b) => new Date(b.created_at) - new Date(a.created_at))
                                    : (typeof orderValues.toSorted === 'function'
                                        ? orderValues.toSorted((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                        : [...orderValues].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
                                try { if (window.storage) window.storage.setJSON('nisha_cached_orders', window.globalOrdersData); } catch(e) {}
                                updateOrderTabCounters();
                                ensureOrderImagesLoaded();
                                renderFilteredOrders();
                            }
                        }
                    }
                }).catch(() => {});
            }

            const initialOrderValues = Array.from(orderMap.values());
            window.globalOrdersData = (typeof window.toSorted === 'function')
                ? window.toSorted(initialOrderValues, (a, b) => new Date(b.created_at) - new Date(a.created_at))
                : (typeof initialOrderValues.toSorted === 'function'
                    ? initialOrderValues.toSorted((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    : [...initialOrderValues].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
            if (window.globalOrdersData.length > 0) {
                try { if (window.storage) window.storage.setJSON('nisha_cached_orders', window.globalOrdersData); } catch(e) {}
            }
        } catch (e) {
            fetchError = e;
        }
    } else {
        const phoneInput = document.getElementById('ordersSearchPhone');
        const phone = phoneInput ? phoneInput.value.replace(/[^\d+]/g, '') : '';
        if (!phone || phone.length < 10) { 
            if (typeof showToast === 'function') showToast('Введите корректный номер телефона!', 'error'); 
            listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace;">[ НОМЕР НЕ ВВЕДЕН ]</div>';
            return; 
        }

        const { data: vResult } = await sb.rpc('check_otp_verified', { p_phone: phone });
        const otpCheck = vResult ? [{is_verified: true}] : [];
        if (!otpCheck || otpCheck.length === 0 || !otpCheck[0].is_verified) {
            listArea.innerHTML = `<div style="text-align:center; color:var(--accent-red); font-family: monospace; padding: 20px;">[ ДОСТУП ЗАПРЕЩЕН ]<br><br>Сначала подтвердите, что это ваш номер.</div>
            <button class="cart-checkout-btn btn-target" style="margin: 0 auto; display: block;" data-action="verify-orders-phone" data-phone="${typeof window.escapeAttr === 'function' ? window.escapeAttr(phone) : phone}">ПОДТВЕРДИТЬ НОМЕР В БОТЕ</button>`;
            return; 
        }

        const cleanPhone = phone.replace(/[^\d]/g, '');
        const { data, error } = await sb.rpc('get_orders_by_phone', { search_phone: cleanPhone });
        window.globalOrdersData = data || []; 
        fetchError = error;

        if (window.globalOrdersData.length > 0) {
            try { if (window.storage) window.storage.setJSON('nisha_cached_orders', window.globalOrdersData); } catch(e) {}
        }
    }

    if (fetchError && (!window.globalOrdersData || window.globalOrdersData.length === 0)) { 
        listArea.innerHTML = `<div style="color:red; text-align:center;">[ ОШИБКА: ${fetchError.message} ]</div>`; 
        return; 
    }

    if (!window.globalOrdersData || window.globalOrdersData.length === 0) { 
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
    
    updateOrderTabCounters();
    ensureOrderImagesLoaded();
    renderFilteredOrders();

    // Синхронизация статуса отзывов из БД: если отзыв уже был оставлен, он окончательно блокируется
    if (Array.isArray(window.globalOrdersData) && window.globalOrdersData.length > 0 && sb) {
        const completedIds = window.globalOrdersData.filter(o => (o.status || '').toLowerCase() === 'завершен').map(o => o.id);
        if (completedIds.length > 0) {
            sb.from('reviews').select('order_id').in('order_id', completedIds).then(({ data: revs }) => {
                if (Array.isArray(revs) && revs.length > 0) {
                    let rOrders = window.storage ? window.storage.getJSON('nisha_reviewed_orders', []) : [];
                    if (!Array.isArray(rOrders)) rOrders = [];
                    let hasNew = false;
                    revs.forEach(r => {
                        if (r.order_id && !rOrders.includes(r.order_id)) {
                            rOrders.push(r.order_id);
                            hasNew = true;
                        }
                    });
                    if (hasNew) {
                        if (window.storage) window.storage.setJSON('nisha_reviewed_orders', rOrders);
                        renderFilteredOrders();
                    }
                }
            }).catch(() => {});
        }
    }
}
window.fetchMyOrders = fetchMyOrders;
if (typeof globalThis !== 'undefined') globalThis.fetchMyOrders = fetchMyOrders;

function getOrderItemImage(item) {
    if (!item) return '';

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
    if (item.id && window.orderItemsImageCache && window.orderItemsImageCache[item.id]) {
        return window.orderItemsImageCache[item.id];
    }

    // 4. Поиск в каталоге
    const catalog = typeof getCatalog === 'function' ? getCatalog() : (window.catalog || []);
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
                if (item.id && window.orderItemsImageCache) window.orderItemsImageCache[item.id] = cdnUrl;
                return cdnUrl;
            }
        }
    }

    return '';
}
window.getOrderItemImage = getOrderItemImage;
if (typeof globalThis !== 'undefined') globalThis.getOrderItemImage = getOrderItemImage;

async function ensureOrderImagesLoaded() {
    if (!window.globalOrdersData || !Array.isArray(window.globalOrdersData)) return;
    const missingIds = [];
    window.globalOrdersData.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                if (item && item.id && !getOrderItemImage(item)) {
                    if (!missingIds.includes(item.id)) missingIds.push(item.id);
                }
            });
        }
    });

    if (missingIds.length === 0) return;

    const sb = typeof getSupabase === 'function' ? getSupabase() : (window.supabaseClient || null);
    if (!sb) return;

    try {
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
if (typeof globalThis !== 'undefined') globalThis.ensureOrderImagesLoaded = ensureOrderImagesLoaded;

function switchOrderTab(tabName) {
    if (window.currentOrderTab === tabName) return;
    window.currentOrderTab = tabName;
    
    const tabYellow = document.querySelector('.order-tab.tab-yellow');
    const tabBlue = document.querySelector('.order-tab.tab-blue');
    const tabRed = document.querySelector('.order-tab.tab-red');
    if (tabYellow) tabYellow.classList.toggle('active', tabName === 'accepted');
    if (tabBlue) tabBlue.classList.toggle('active', tabName === 'shipped');
    if (tabRed) tabRed.classList.toggle('active', tabName === 'cancelled');
    
    renderFilteredOrders();
}
window.switchOrderTab = switchOrderTab;
if (typeof globalThis !== 'undefined') globalThis.switchOrderTab = switchOrderTab;

function copyTTN(ttn, el) {
    if (!ttn) return;
    const cleanTtn = String(ttn).trim();
    const successMsg = 'ТТН скопирован: ' + cleanTtn;

    const animateCopiedIcon = () => {
        if (typeof triggerHaptic === 'function') triggerHaptic('success');
        if (el) {
            const icon = el.querySelector('.ttn-copy-icon');
            if (icon) {
                icon.style.transform = 'scale(1.25)';
                icon.style.stroke = '#fff';
                setTimeout(() => {
                    icon.style.transform = 'scale(1)';
                    icon.style.stroke = 'var(--accent-green)';
                }, 250);
            }
        }
    };

    if (typeof window.copyToClipboard === 'function') {
        window.copyToClipboard(cleanTtn, successMsg).then(ok => {
            if (ok) animateCopiedIcon();
        });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(cleanTtn).then(() => {
            if (typeof showToast === 'function') showToast(successMsg, 'success');
            animateCopiedIcon();
        }).catch(() => {});
    }
}
window.copyTTN = copyTTN;
if (typeof globalThis !== 'undefined') globalThis.copyTTN = copyTTN;

function renderFilteredOrders() {
    const listArea = document.getElementById('ordersListArea');
    if (!listArea) return;
    if (typeof listArea.replaceChildren === 'function') listArea.replaceChildren();
    else listArea.innerHTML = '';

    const ordersList = Array.isArray(window.globalOrdersData) ? window.globalOrdersData : [];
    const activeTab = window.currentOrderTab || 'accepted';

    const grouped = (typeof Object.groupBy === 'function')
        ? Object.groupBy(ordersList, getOrderTabBucket)
        : ordersList.reduce((acc, o) => {
            const b = getOrderTabBucket(o);
            (acc[b] = acc[b] || []).push(o);
            return acc;
        }, {});

    const filteredData = grouped[activeTab] || [];

    if (filteredData.length === 0) {
        let emptyMsg = activeTab === 'accepted' ? 'Нет активных заказов.' : 
                       activeTab === 'shipped' ? 'Нет отправленных посылок.' : 'Нет отмененных заказов.';
        listArea.innerHTML = `<div style="text-align:center; color:#666; font-family: monospace; padding: 30px;">[ ${emptyMsg} ]</div>`;
        return;
    }

    filteredData.forEach(order => {
        const orderDate = new Date(order.created_at);
        const date = !Number.isNaN(orderDate.getTime()) ? orderDateFormatter.format(orderDate) : '';
        let itemsHtml = '';
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const itemImg = getOrderItemImage(item);
                const safeImgUrl = typeof window.escapeHtml === 'function' ? window.escapeHtml(itemImg) : (itemImg || '').replaceAll('"', '&quot;');
                const imgStyle = itemImg ? `background-image: url('${safeImgUrl}');` : '';
                const itemPrice = item.currentPrice !== undefined ? item.currentPrice : (item.price || 0);
                itemsHtml += `
                    <div class="order-item-row" data-action="open-product" data-id="${typeof window.escapeAttr === 'function' ? window.escapeAttr(item.id) : item.id}" title="Открыть карточку товара">
                        <div class="order-item-img" data-item-id="${typeof window.escapeAttr === 'function' ? window.escapeAttr(item.id) : item.id}" style="${imgStyle}">${itemImg ? '' : 'NO IMG'}</div>
                        <div class="order-item-details">
                            <div class="order-item-name">${typeof window.escapeHtml === 'function' ? window.escapeHtml(item.name || 'Товар') : item.name}</div>
                            <div class="order-item-meta"><span>Размер: ${typeof window.escapeHtml === 'function' ? window.escapeHtml(item.size || '—') : (item.size || '—')}</span><span class="order-item-price">${typeof window.formatPrice === 'function' ? window.formatPrice(itemPrice) : (itemPrice + ' грн')}</span></div>
                        </div>
                    </div>`;
            });
        }

        let ttnHtml = "";
        if ((order.status || '').toUpperCase() !== "ОТМЕНЕН") {
            ttnHtml = order.tracking_number
                ? `<div class="order-ttn" style="margin-top: 8px;">
                     <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
                         <span style="font-family: var(--font-mono); font-size: 13px; color: #aaa;">ТТН:</span>
                         <div style="display: flex; align-items: center; gap: 8px;">
                             <div class="ttn-copy-btn" data-action="copy-ttn" data-ttn="${typeof window.escapeAttr==='function'?window.escapeAttr(order.tracking_number):order.tracking_number}" title="Нажмите, чтобы скопировать номер ТТН" style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer; padding: 2px 6px; border-radius: 4px; background: rgba(0, 255, 0, 0.05); border: 1px dashed rgba(0, 255, 0, 0.3); transition: all 0.2s ease;">
                                 <svg class="ttn-copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; vertical-align: middle; transition: transform 0.2s ease, stroke 0.2s ease;">
                                     <rect x="2" y="2" width="13" height="13" rx="3.5"></rect>
                                     <path d="M7.5 7.5h8.5a3.5 3.5 0 0 1 3.5 3.5v8.5a3.5 3.5 0 0 1-3.5 3.5H7.5a3.5 3.5 0 0 1-3.5-3.5"></path>
                                 </svg>
                                 <span style="color:var(--accent-green); font-weight:bold; font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.5px; user-select: all;">${typeof window.escapeHtml==='function'?window.escapeHtml(order.tracking_number):order.tracking_number}</span>
                             </div>
                             <a href="https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(order.tracking_number)}" target="_blank" rel="noopener noreferrer" title="Отследить на Новой Почте" style="display: inline-flex; align-items: center; gap: 4px; color: var(--accent-green); text-decoration: none; font-size: 11px; font-family: var(--font-mono); padding: 3px 6px; border: 1px solid rgba(0, 255, 0, 0.3); border-radius: 4px; background: rgba(0, 255, 0, 0.05); transition: 0.2s;">
                                 <span>ТРЕК</span>
                                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                             </a>
                         </div>
                     </div>
                     <div style="background:#fff; text-align:center; padding: 10px; margin-top: 6px; border-radius:4px;">
                         <svg class="barcode-svg" data-ttn="${typeof window.escapeAttr==='function'?window.escapeAttr(order.tracking_number):order.tracking_number}"></svg>
                     </div>
                   </div>`
                : `<div class="order-ttn" style="color:#777;">ТТН: Ожидается генерация...</div>`;
        }

        // Кнопка отзыва для завершенных заказов
        let reviewBtnHtml = '';
        if ((order.status || '').toLowerCase() === 'завершен') {
            let reviewedOrders = window.storage ? window.storage.getJSON('nisha_reviewed_orders', []) : [];
            if (!Array.isArray(reviewedOrders)) reviewedOrders = [];

            if (order.items && order.items.length > 0) {
                const firstItem = order.items[0];
                const firstItemImg = getOrderItemImage(firstItem);
                const safeName = String(firstItem.name || '');
                const msgIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; position: relative; top: 2px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
                
                if (!reviewedOrders.includes(order.id)) {
                    reviewBtnHtml = `
                        <div style="margin-top: 10px; cursor: pointer; color: var(--accent-green); font-size: 12px; font-family: var(--font-main); text-align: center; transition: 0.2s;" 
                             data-action="prompt-order-review" data-hover-action="review-link-hover" data-order-id="${typeof window.escapeAttr==='function'?window.escapeAttr(order.id):order.id}" data-item-name="${typeof window.escapeAttr==='function'?window.escapeAttr(safeName):safeName}" data-item-img="${typeof window.escapeAttr==='function'?window.escapeAttr(firstItemImg):firstItemImg}" data-item-id="${typeof window.escapeAttr==='function'?window.escapeAttr(firstItem.id):firstItem.id}"
                             role="button"
                             tabindex="0">
                            ${msgIcon} Оставить отзыв
                        </div>
                    `;
                } else {
                    reviewBtnHtml = `
                        <div style="margin-top: 10px; color: #666; font-size: 12px; font-family: var(--font-mono); text-align: center; user-select: none; cursor: default;">
                            [✔] ОТЗЫВ ОСТАВЛЕН
                        </div>
                    `;
                }
            }
        }

        const statusSlug = (order.status || '').toLowerCase().replace(/[\s_]+/g, '-');

        listArea.innerHTML += `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-id">ЗАКАЗ #${order.id.split('-')[0].toUpperCase()} <span style="color:#666; font-weight:normal;">(${date})</span></span>
                    <span class="order-status status-${typeof window.escapeAttr==='function'?window.escapeAttr(statusSlug):statusSlug}">${typeof window.escapeHtml==='function'?window.escapeHtml((order.status || '').toUpperCase()):(order.status || '').toUpperCase()}</span>
                </div>
                <div class="order-items-list">${itemsHtml}</div>
                ${reviewBtnHtml}
                <div class="order-footer">${ttnHtml}<div class="order-total">ИТОГО: ${order.total_sum} грн</div></div>
            </div>`;
    });

    ensureOrderImagesLoaded();

    // Отрисовка штрихкодов JsBarcode (с поддержкой Lazy Load)
    const drawBarcodes = () => {
        const barcodeFn = (typeof window !== 'undefined' && window.JsBarcode) || (typeof JsBarcode !== 'undefined' ? JsBarcode : null);
        if (!barcodeFn) return;
        document.querySelectorAll('.barcode-svg').forEach(svg => {
            const ttn = svg.getAttribute('data-ttn');
            if (ttn) {
                try {
                    barcodeFn(svg, ttn, { format: "CODE128", lineColor: "#000", background: "transparent", width: 1.5, height: 50, displayValue: false });
                } catch(e) {}
            }
        });
    };

    if (typeof window.JsBarcode !== 'undefined' || typeof JsBarcode !== 'undefined') {
        drawBarcodes();
    } else if (document.querySelector('.barcode-svg')) {
        import('jsbarcode').then(mod => {
            window.JsBarcode = mod.default || mod;
            drawBarcodes();
        }).catch(err => {
            console.warn('[JsBarcode] Local load failed, falling back to CDN:', err);
            if (typeof loadExternalScript === 'function') {
                loadExternalScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js').then(drawBarcodes).catch(() => {});
            }
        });
    }
}
window.renderFilteredOrders = renderFilteredOrders;
if (typeof globalThis !== 'undefined') globalThis.renderFilteredOrders = renderFilteredOrders;

if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    try { updateOrderTabCounters(); } catch (e) {}
}
