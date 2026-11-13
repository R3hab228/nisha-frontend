// ==========================================
// NISHA MY ORDERS MODULE (Lazy Chunk: MY_ORDERS.EXE & JSBARCODE)
// ==========================================

if (typeof window.globalOrdersData === 'undefined') window.globalOrdersData = [];
if (typeof window.currentOrderTab === 'undefined') window.currentOrderTab = 'accepted'; // accepted, shipped, cancelled
if (typeof window.orderItemsImageCache === 'undefined') window.orderItemsImageCache = {};

const toCDN = (u) => (typeof window.toCDN === 'function' ? window.toCDN(u) : (u || ''));

function formatOrderDate(rawDate) {
    const ms = typeof rawDate === 'number' ? rawDate : Date.parse(rawDate);
    if (!Number.isFinite(ms)) return '';
    const d = new Date(ms);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function openOrdersModal() {
    if (typeof openModal === 'function') {
        openModal('ordersModal');
    } else {
        const modal = document.getElementById('ordersModal');
        if (modal) {
            modal.inert = false;
            modal.removeAttribute('inert');
            modal.setAttribute('aria-hidden', 'false');
            modal.classList.add('is-open');
            modal.style.display = 'flex';
        }
        document.body.style.overflow = 'hidden';
    }
    if (typeof triggerModalTypewriter === 'function') {
        triggerModalTypewriter('ordersModal');
    }

    if (typeof window.stopLenis === 'function') window.stopLenis();
    else if (typeof lenis !== 'undefined') lenis.stop();
    
    const guestInputGroup = document.getElementById('guestOrderInputGroup');
    const guestText = document.getElementById('guestOrderText');
    const listArea = document.getElementById('ordersListArea');

    const activeUser = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
    const activeProfile = window.userProfile || (typeof userProfile !== 'undefined' ? userProfile : null);
    bindOrdersTabSwipe();

    if (activeUser) {
        if (guestInputGroup) guestInputGroup.style.display = 'none';
        
        let dName = typeof getUserDisplayName === 'function'
            ? getUserDisplayName(activeUser, activeProfile)
            : (activeProfile?.username || activeUser.user_metadata?.display_name || activeUser.user_metadata?.username || activeUser.user_metadata?.full_name || activeUser.user_metadata?.name || activeUser.email.split('@').at(0));
        
        const grantedMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.access_granted', {defaultValue: 'Доступ разрешен'}) : 'Доступ разрешен';
        const safeDName = typeof window.escapeHtml === 'function' ? window.escapeHtml(dName) : String(dName || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        if (guestText) guestText.innerHTML = `${grantedMsg}: <span style="color:var(--accent-green); font-weight:bold;">@${safeDName}</span>`;
        updateOrderTabCounters();
        fetchMyOrders();
    } else {
        if (guestInputGroup) guestInputGroup.style.display = 'flex';
        const guestDescMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.guest_desc', {defaultValue: 'Введите номер телефона, указанный при заказе, чтобы отследить статус:'}) : 'Введите номер телефона, указанный при заказе, чтобы отследить статус:';
        const searchPlaceholderMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.search_placeholder', {defaultValue: 'Введите номер телефона для поиска...'}) : 'Введите номер телефона для поиска...';
        if (guestText) guestText.innerHTML = guestDescMsg;
        if (listArea) listArea.innerHTML = `<div style="text-align:center; color:#555; font-family: monospace; padding: 30px;">${searchPlaceholderMsg}</div>`;
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

// Локализация статусов заказов для всех поддерживаемых языков (RU, UA, EN)
function formatOrderStatus(rawStatus) {
    if (!rawStatus) return '';
    const s = String(rawStatus).trim().toLowerCase();
    const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;

    // 1. Отменен / Скасовано / Cancelled / Возврат
    if (s.includes('отмен') || s.includes('скас') || s.includes('cancel') || s.includes('возврат') || s.includes('поверн')) {
        return t('orders_modal.status_cancelled', 'ОТМЕНЕН').toUpperCase();
    }
    // 2. Завершен / Завершено / Completed / Получен / Доставлен
    if (s.includes('заверш') || s.includes('выполнен') || s.includes('получен') || s.includes('доставлен') || s.includes('complet') || s.includes('deliver')) {
        return t('orders_modal.status_completed', 'ЗАВЕРШЕН').toUpperCase();
    }
    // 3. Отправлен / Відправлено / Shipped
    if (s.includes('отправ') || s.includes('відправ') || s.includes('ship')) {
        return t('orders_modal.status_shipped', 'ОТПРАВЛЕН').toUpperCase();
    }
    // 4. Оплачен / Оплачено / Paid
    if (s.includes('оплач') || s.includes('paid')) {
        return t('orders_modal.status_paid', 'ОПЛАЧЕН').toUpperCase();
    }
    // 5. Принят / Прийнято / Accepted
    if (s.includes('принят') || s.includes('прийнят') || s.includes('accept')) {
        return t('orders_modal.status_accepted', 'ПРИНЯТ').toUpperCase();
    }
    // 6. В обработке / В обробці / In Processing / Новый
    if (s.includes('обработ') || s.includes('оброб') || s.includes('process') || s.includes('нов')) {
        return t('orders_modal.status_processing', 'В ОБРАБОТКЕ').toUpperCase();
    }

    return String(rawStatus).toUpperCase();
}
window.formatOrderStatus = formatOrderStatus;
if (typeof globalThis !== 'undefined') globalThis.formatOrderStatus = formatOrderStatus;
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
        const loadingDbMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.loading_db', {defaultValue: '[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]'}) : '[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]';
        listArea.innerHTML = `<div style="text-align:center; color:#aaa; font-family: monospace;">${loadingDbMsg}</div>`;
        if (tabsContainer) tabsContainer.style.display = 'none';
    }

    let fetchError = null;
    const sb = typeof getSupabase === 'function' ? getSupabase() : (window.supabaseClient || null);
    if (!sb) return;

    const activeUser = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
    const activeProfile = window.userProfile || (typeof userProfile !== 'undefined' ? userProfile : null);
    bindOrdersTabSwipe();

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

            // 2. Дополнительно ищем заказы по всем уникальным номерам телефона клиента параллельно (дедупликация по последним 9 цифрам)
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
                                const sortOrdersDesc = (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
                                window.globalOrdersData = (typeof window.toSorted === 'function')
                                    ? window.toSorted(orderValues, sortOrdersDesc)
                                    : (typeof orderValues.toSorted === 'function'
                                        ? orderValues.toSorted(sortOrdersDesc)
                                        : [...orderValues].sort(sortOrdersDesc));
                                try { if (window.storage) window.storage.setJSON('nisha_cached_orders', window.globalOrdersData); } catch {}
                                updateOrderTabCounters();
                                ensureOrderImagesLoaded();
                                renderFilteredOrders();
                            }
                        }
                    }
                }).catch(() => {});
            }

            const initialOrderValues = Array.from(orderMap.values());
            const sortOrdersDesc = (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
            window.globalOrdersData = (typeof window.toSorted === 'function')
                ? window.toSorted(initialOrderValues, sortOrdersDesc)
                : (typeof initialOrderValues.toSorted === 'function'
                    ? initialOrderValues.toSorted(sortOrdersDesc)
                    : [...initialOrderValues].sort(sortOrdersDesc));
            if (window.globalOrdersData.length > 0) {
                try { if (window.storage) window.storage.setJSON('nisha_cached_orders', window.globalOrdersData); } catch {}
            }
        } catch (e) {
            fetchError = e;
        }
    } else {
        const phoneInput = document.getElementById('ordersSearchPhone');
        const phone = phoneInput ? phoneInput.value.replace(/[^\d+]/g, '') : '';
        if (!phone || phone.length < 10) { 
            if (typeof showToast === 'function') {
                const errPhoneMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.err_phone', {defaultValue: 'Введите корректный номер телефона!'}) : 'Введите корректный номер телефона!';
                showToast(errPhoneMsg, 'error'); 
            }
            const errNoPhoneMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.err_no_phone', {defaultValue: '[ НОМЕР НЕ ВВЕДЕН ]'}) : '[ НОМЕР НЕ ВВЕДЕН ]';
            listArea.innerHTML = `<div style="text-align:center; color:#555; font-family: monospace;">${errNoPhoneMsg}</div>`;
            return; 
        }

        const { data: vResult } = await sb.rpc('check_otp_verified', { p_phone: phone });
        const otpCheck = vResult ? [{is_verified: true}] : [];
        if (!otpCheck || otpCheck.length === 0 || !otpCheck.at(0).is_verified) {
            const deniedOtpMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.access_denied_otp', {defaultValue: '[ ДОСТУП ЗАПРЕЩЕН ]<br><br>Сначала подтвердите, что это ваш номер.'}) : '[ ДОСТУП ЗАПРЕЩЕН ]<br><br>Сначала подтвердите, что это ваш номер.';
            const verifyBotMsg = typeof i18next !== 'undefined' ? i18next.t('orders_modal.verify_bot_btn', {defaultValue: 'ПОДТВЕРДИТЬ НОМЕР В БОТЕ'}) : 'ПОДТВЕРДИТЬ НОМЕР В БОТЕ';
            listArea.innerHTML = `<div style="text-align:center; color:var(--accent-red); font-family: monospace; padding: 20px;">${deniedOtpMsg}</div>
            <button class="cart-checkout-btn btn-target" style="margin: 0 auto; display: block;" data-action="verify-orders-phone" data-phone="${typeof window.escapeAttr === 'function' ? window.escapeAttr(phone) : phone}">${verifyBotMsg}</button>`;
            return; 
        }

        const cleanPhone = phone.replace(/[^\d]/g, '');
        const { data, error } = await sb.rpc('get_orders_by_phone', { search_phone: cleanPhone });
        window.globalOrdersData = data || []; 
        fetchError = error;

        if (window.globalOrdersData.length > 0) {
            try { if (window.storage) window.storage.setJSON('nisha_cached_orders', window.globalOrdersData); } catch {}
        }
    }

    if (fetchError && (!window.globalOrdersData || window.globalOrdersData.length === 0)) { 
        const safeFetchErr = typeof window.escapeHtml === 'function' ? window.escapeHtml(fetchError.message) : fetchError.message;
        listArea.innerHTML = `<div style="color:red; text-align:center;">[ ОШИБКА: ${safeFetchErr} ]</div>`; 
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
    if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0 && typeof item.thumbnails.at(0) === 'string' && item.thumbnails.at(0).trim().length > 5) {
        return toCDN(item.thumbnails.at(0));
    }
    if (Array.isArray(item.images) && item.images.length > 0 && typeof item.images.at(0) === 'string' && item.images.at(0).trim().length > 5) {
        return toCDN(item.images.at(0));
    }

    // 3. Кэш уже подгруженных картинок
    if (item.id && window.orderItemsImageCache && (typeof hasOwn === 'function' ? hasOwn(window.orderItemsImageCache, item.id) : Object.hasOwn(window.orderItemsImageCache, item.id))) {
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
                foundUrl = catalogItem.thumbnails.at(0);
            }
            if (!foundUrl && Array.isArray(catalogItem.images) && catalogItem.images.length > 0) {
                foundUrl = catalogItem.images.at(0);
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
                const imgUrl = (di.thumbnails && di.thumbnails.length > 0) ? di.thumbnails.at(0) : (di.images && di.images.length > 0 ? di.images.at(0) : '');
                if (imgUrl) {
                    window.orderItemsImageCache[di.id] = toCDN(imgUrl);
                }
            });
        }

        const stillMissing = missingIds.filter(id => !(typeof hasOwn === 'function' ? hasOwn(window.orderItemsImageCache, id) : Object.hasOwn(window.orderItemsImageCache, id)));
        if (stillMissing.length > 0) {
            const { data: archData } = await sb.from('archived_items').select('id, thumbnails, images').in('id', stillMissing);
            if (archData && archData.length > 0) {
                archData.forEach(di => {
                    const imgUrl = (di.thumbnails && di.thumbnails.length > 0) ? di.thumbnails.at(0) : (di.images && di.images.length > 0 ? di.images.at(0) : '');
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

function encodeNovaPoshtaTtn(ttn) {
    const clean = String(ttn || '').replace(/\D+/g, '');
    if (!clean) return '';
    try {
        const b64 = (typeof btoa === 'function' ? btoa(clean) : Buffer.from(clean).toString('base64')).replace(/=+$/, '');
        const chars = b64.split('');
        return (typeof chars.toReversed === 'function' ? chars.toReversed() : chars.reverse()).join('');
    } catch (_) {
        return clean;
    }
}
window.encodeNovaPoshtaTtn = encodeNovaPoshtaTtn;
if (typeof globalThis !== 'undefined') globalThis.encodeNovaPoshtaTtn = encodeNovaPoshtaTtn;

function getNovaPoshtaTrackingUrl(ttn, lang) {
    const cleanTtn = String(ttn || '').trim();
    if (!cleanTtn) return 'https://tracking.novaposhta.ua/';
    const currentLang = lang || ((typeof i18next !== 'undefined' && i18next.language === 'ru') ? 'ru' : 'uk');
    const encoded = encodeNovaPoshtaTtn(cleanTtn) || (typeof window.safeEncodeURIComponent === 'function' ? window.safeEncodeURIComponent(cleanTtn) : encodeURIComponent(cleanTtn));
    return `https://tracking.novaposhta.ua/#/${currentLang}/${encoded}`;
}
window.getNovaPoshtaTrackingUrl = getNovaPoshtaTrackingUrl;
if (typeof globalThis !== 'undefined') globalThis.getNovaPoshtaTrackingUrl = getNovaPoshtaTrackingUrl;

function switchOrderTab(tabName) {
    if (window.currentOrderTab === tabName) return;

    // Временно изолируем фоновые элементы каталога от View Transition,
    // чтобы браузер анимировал исключительно #ordersListArea внутри модального окна
    // и ни при каких условиях не захватывал карточки товаров/избранного в Top Layer поверх модалки
    const bgGrid = document.getElementById('itemsGrid');
    const prevGridVt = bgGrid ? bgGrid.style.viewTransitionName : '';
    if (bgGrid) bgGrid.style.setProperty('view-transition-name', 'none', 'important');

    const bgCards = document.querySelectorAll('#itemsGrid .item-card');
    const cardsToRestore = [];
    if (bgCards && bgCards.length > 0) {
        bgCards.forEach(card => {
            const vt = card.style.getPropertyValue('view-transition-name');
            const prio = card.style.getPropertyPriority('view-transition-name');
            if (vt && vt !== 'none') {
                cardsToRestore.push({ card, vt, prio });
                card.style.setProperty('view-transition-name', 'none', 'important');
            }
        });
    }

    const restoreBgTransitions = () => {
        if (bgGrid) {
            if (prevGridVt) bgGrid.style.setProperty('view-transition-name', prevGridVt);
            else bgGrid.style.removeProperty('view-transition-name');
        }
        cardsToRestore.forEach(({ card, vt, prio }) => {
            card.style.setProperty('view-transition-name', vt, prio);
        });
    };
    
    const updateDom = () => {
        window.currentOrderTab = tabName;
        
        const tabYellow = document.querySelector('.order-tab.tab-yellow');
        const tabBlue = document.querySelector('.order-tab.tab-blue');
        const tabRed = document.querySelector('.order-tab.tab-red');
        if (tabYellow) tabYellow.classList.toggle('active', tabName === 'accepted');
        if (tabBlue) tabBlue.classList.toggle('active', tabName === 'shipped');
        if (tabRed) tabRed.classList.toggle('active', tabName === 'cancelled');
        
        const listArea = document.getElementById('ordersListArea');
        if (listArea) listArea.scrollTop = 0;

        renderFilteredOrders();
    };

    let transitionResult;
    if (typeof safeViewTransition === 'function') {
        transitionResult = safeViewTransition(updateDom);
    } else if (typeof window !== 'undefined' && typeof window.safeViewTransition === 'function') {
        transitionResult = window.safeViewTransition(updateDom);
    } else {
        transitionResult = updateDom();
    }

    if (transitionResult && typeof transitionResult.finished?.finally === 'function') {
        transitionResult.finished.finally(restoreBgTransitions);
    } else if (transitionResult && typeof transitionResult.then === 'function') {
        transitionResult.finally(restoreBgTransitions);
    } else {
        restoreBgTransitions();
    }

    return transitionResult;
}
window.switchOrderTab = switchOrderTab;
if (typeof globalThis !== 'undefined') globalThis.switchOrderTab = switchOrderTab;

const ORDER_TAB_ORDER = ['accepted', 'shipped', 'cancelled'];

/**
 * Подключает плавный мобильный свайп влево/вправо для переключения вкладок
 * («Принятые» ↔ «Отправлены» ↔ «Отменены») с жёсткой блокировкой оси и защитой от случайных свайпов.
 */
function bindOrdersTabSwipe() {
    const listArea = document.getElementById('ordersListArea');
    if (!listArea || listArea.dataset.swipeBound === '1') return;
    listArea.dataset.swipeBound = '1';

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let lastDx = 0;
    let axis = null; // null | 'x' | 'y'
    let active = false;

    const resetVisual = (animate = true) => {
        if (!animate) {
            listArea.style.transition = 'none';
            listArea.style.transform = '';
            return;
        }
        listArea.style.transition = 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)';
        listArea.style.transform = 'translate3d(0, 0, 0)';
        const cleanup = () => {
            listArea.style.transition = '';
            listArea.style.transform = '';
        };
        listArea.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, 220);
    };

    listArea.addEventListener('touchstart', (e) => {
        active = false;
        axis = null;
        lastDx = 0;

        if (!e.touches || e.touches.length !== 1) return;
        const tabsEl = document.getElementById('ordersTabs');
        if (!tabsEl || tabsEl.style.display === 'none') return;

        const target = e.target;
        if (target && typeof target.closest === 'function' && target.closest('input, textarea, select')) return;

        const touch = e.touches[0];
        const vw = window.innerWidth || document.documentElement.clientWidth || 375;
        // Edge deadzone (20px) — не мешаем системному жесту "Назад" iOS/Android
        if (touch.clientX < 20 || touch.clientX > vw - 20) return;

        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        active = true;
        listArea.style.transition = 'none';
    }, { passive: true });

    listArea.addEventListener('touchmove', (e) => {
        if (!active || !e.touches || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (axis === null) {
            if (Math.hypot(dx, dy) < 12) return;
            // При вертикальном или диагональном скролле сразу блокируем ось Y до конца касания
            if (absDy >= absDx * 0.85) {
                axis = 'y';
                return;
            }
            if (absDx > absDy * 1.4 && absDx >= 14) {
                axis = 'x';
            } else {
                return;
            }
        }

        if (axis !== 'x') return;

        lastDx = dx;
        const currentIdx = ORDER_TAB_ORDER.indexOf(window.currentOrderTab || 'accepted');
        const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
        const canSwitch = nextIdx >= 0 && nextIdx < ORDER_TAB_ORDER.length;

        // Резиновый микро-сдвиг (100% GPU translate3d без перерисовок)
        const factor = canSwitch ? 0.22 : 0.08;
        const maxShift = canSwitch ? 28 : 10;
        const shift = Math.max(-maxShift, Math.min(maxShift, dx * factor));
        listArea.style.transform = `translate3d(${shift.toFixed(1)}px, 0, 0)`;
    }, { passive: true });

    const finishSwipe = (cancelled = false) => {
        if (!active) return;
        const wasHorizontal = axis === 'x';
        const dx = lastDx;
        const elapsed = Math.max(1, Date.now() - startTime);
        active = false;
        axis = null;
        lastDx = 0;

        if (!wasHorizontal || cancelled) {
            if (listArea.style.transform) resetVisual(true);
            else listArea.style.transition = '';
            return;
        }

        const absDx = Math.abs(dx);
        const velocity = absDx / elapsed; // px/ms
        const passed = absDx >= 56 || (absDx >= 34 && velocity >= 0.35 && elapsed < 320);

        if (passed) {
            const currentIdx = ORDER_TAB_ORDER.indexOf(window.currentOrderTab || 'accepted');
            const targetIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
            if (targetIdx >= 0 && targetIdx < ORDER_TAB_ORDER.length) {
                resetVisual(false);
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                    try { navigator.vibrate(10); } catch {}
                }
                switchOrderTab(ORDER_TAB_ORDER[targetIdx]);
                return;
            }
        }

        resetVisual(true);
    };

    listArea.addEventListener('touchend', () => finishSwipe(false), { passive: true });
    listArea.addEventListener('touchcancel', () => finishSwipe(true), { passive: true });
}
window.bindOrdersTabSwipe = bindOrdersTabSwipe;
if (typeof globalThis !== 'undefined') globalThis.bindOrdersTabSwipe = bindOrdersTabSwipe;

function copyTTN(ttn, el) {
    if (!ttn) return;
    const cleanTtn = String(ttn).trim();
    const ttnCopiedPrefix = typeof i18next !== 'undefined' ? i18next.t('orders_modal.ttn_copied', {defaultValue: 'ТТН скопирован: '}) : 'ТТН скопирован: ';
    const successMsg = ttnCopiedPrefix + cleanTtn;

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
        const emptyAccepted = typeof i18next !== 'undefined' ? i18next.t('orders_modal.empty_accepted', {defaultValue: 'Нет активных заказов.'}) : 'Нет активных заказов.';
        const emptyShipped = typeof i18next !== 'undefined' ? i18next.t('orders_modal.empty_shipped', {defaultValue: 'Нет отправленных посылок.'}) : 'Нет отправленных посылок.';
        const emptyCancelled = typeof i18next !== 'undefined' ? i18next.t('orders_modal.empty_cancelled', {defaultValue: 'Нет отмененных заказов.'}) : 'Нет отмененных заказов.';
        let emptyMsg = activeTab === 'accepted' ? emptyAccepted : 
                       activeTab === 'shipped' ? emptyShipped : emptyCancelled;
        listArea.innerHTML = `<div style="text-align:center; color:#666; font-family: monospace; padding: 30px;">[ ${emptyMsg} ]</div>`;
        return;
    }

    filteredData.forEach(order => {
        const orderDateMs = Date.parse(order.created_at);
        const date = formatOrderDate(orderDateMs);
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
            const rawTtns = String(order.tracking_number || '')
                .split(/[,;\n\r/]+/)
                .map(t => t.trim())
                .filter(Boolean);

            if (rawTtns.length > 0) {
                ttnHtml = rawTtns.map((ttn, idx) => {
                    const labelPrefix = rawTtns.length > 1
                        ? ((typeof i18next !== 'undefined' ? i18next.t('orders_modal.parcel_prefix', {defaultValue: 'Посылка'}) : 'Посылка') + ` #${idx + 1} ТТН:`)
                        : 'ТТН:';
                    const safeTtnAttr = typeof window.escapeAttr === 'function' ? window.escapeAttr(ttn) : ttn;
                    const safeTtnHtml = typeof window.escapeHtml === 'function' ? window.escapeHtml(ttn) : ttn;

                    const trackingLang = (typeof i18next !== 'undefined' && i18next.language === 'ru') ? 'ru' : 'uk';
                    const npTrackingUrl = typeof window.getNovaPoshtaTrackingUrl === 'function'
                        ? window.getNovaPoshtaTrackingUrl(ttn, trackingLang)
                        : (typeof getNovaPoshtaTrackingUrl === 'function'
                            ? getNovaPoshtaTrackingUrl(ttn, trackingLang)
                            : `https://tracking.novaposhta.ua/#/${trackingLang}/${typeof window.safeEncodeURIComponent === 'function' ? window.safeEncodeURIComponent(String(ttn || '').trim()) : encodeURIComponent(String(ttn || '').trim())}`);

                    return `<div class="order-ttn">
                             <div class="order-ttn-header">
                                 <span class="order-ttn-label">${labelPrefix}</span>
                                 <div class="order-ttn-actions">
                                     <div class="ttn-copy-btn" data-action="copy-ttn" data-ttn="${safeTtnAttr}" title="Нажмите, чтобы скопировать номер ТТН">
                                         <svg class="ttn-copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                             <rect x="2" y="2" width="13" height="13" rx="3.5"></rect>
                                             <path d="M7.5 7.5h8.5a3.5 3.5 0 0 1 3.5 3.5v8.5a3.5 3.5 0 0 1-3.5 3.5H7.5a3.5 3.5 0 0 1-3.5-3.5"></path>
                                         </svg>
                                         <span class="ttn-number">${safeTtnHtml}</span>
                                     </div>
                                     <a href="${npTrackingUrl}" target="_blank" rel="noopener noreferrer" class="ttn-track-link" title="Отследить на Новой Почте">
                                         <span>ТРЕК</span>
                                         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                     </a>
                                 </div>
                             </div>
                             <div class="order-ttn-barcode">
                                 <svg class="barcode-svg" data-ttn="${safeTtnAttr}"></svg>
                             </div>
                           </div>`;
                }).join('');
            } else {
                ttnHtml = `<div class="order-ttn order-ttn-pending"><span style="color:#777; font-size:12px; font-family:var(--font-mono);">${typeof i18next !== 'undefined' ? i18next.t('orders_modal.ttn_pending', {defaultValue: 'ТТН: Ожидается генерация...'}) : 'ТТН: Ожидается генерация...'}</span></div>`;
            }
        }

        // Кнопка отзыва для завершенных заказов
        let reviewBtnHtml = '';
        if ((order.status || '').toLowerCase() === 'завершен') {
            let reviewedOrders = window.storage ? window.storage.getJSON('nisha_reviewed_orders', []) : [];
            if (!Array.isArray(reviewedOrders)) reviewedOrders = [];

            if (order.items && order.items.length > 0) {
                const firstItem = order.items.at(0);
                const firstItemImg = getOrderItemImage(firstItem);
                const safeName = String(firstItem.name || '');
                const msgIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; position: relative; top: 2px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
                
                if (!reviewedOrders.includes(order.id)) {
                    reviewBtnHtml = `
                        <div style="margin-top: 10px; cursor: pointer; color: var(--accent-green); font-size: 12px; font-family: var(--font-main); text-align: center; transition: 0.2s;" 
                             data-action="prompt-order-review" data-hover-action="review-link-hover" data-order-id="${typeof window.escapeAttr==='function'?window.escapeAttr(order.id):order.id}" data-item-name="${typeof window.escapeAttr==='function'?window.escapeAttr(safeName):safeName}" data-item-img="${typeof window.escapeAttr==='function'?window.escapeAttr(firstItemImg):firstItemImg}" data-item-id="${typeof window.escapeAttr==='function'?window.escapeAttr(firstItem.id):firstItem.id}"
                             role="button"
                             tabindex="0">
                            ${msgIcon} ${typeof i18next !== 'undefined' ? i18next.t('orders_modal.leave_review', {defaultValue: 'Оставить отзыв'}) : 'Оставить отзыв'}
                        </div>
                    `;
                } else {
                    reviewBtnHtml = `
                        <div style="margin-top: 10px; color: #666; font-size: 12px; font-family: var(--font-mono); text-align: center; user-select: none; cursor: default;">
                            ${typeof i18next !== 'undefined' ? i18next.t('orders_modal.review_left', {defaultValue: '[✔] ОТЗЫВ ОСТАВЛЕН'}) : '[✔] ОТЗЫВ ОСТАВЛЕН'}
                        </div>
                    `;
                }
            }
        }

        const statusSlug = (order.status || '').toLowerCase().replace(/[\s_]+/g, '-');
        const ttnBlock = ttnHtml ? `<div class="order-ttns-wrapper">${ttnHtml}</div>` : '';
        const totalPrefix = typeof i18next !== 'undefined' ? i18next.t('orders_modal.total_prefix', {defaultValue: 'ИТОГО:'}) : 'ИТОГО:';
        const formattedTotal = typeof window.formatPrice === 'function' ? window.formatPrice(order.total_sum) : `${order.total_sum} ${(typeof i18next !== 'undefined' && i18next.language === 'en') ? 'UAH' : 'грн'}`;

        listArea.innerHTML += `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-id-wrap">
                        <span class="order-id">${typeof i18next !== 'undefined' ? i18next.t('orders_modal.order_prefix', {defaultValue: 'ЗАКАЗ #'}) : 'ЗАКАЗ #'}${order.id.split('-').at(0).toUpperCase()}</span>
                        ${date ? `<span class="order-date">${date}</span>` : ''}
                    </div>
                    ${(() => {
                        const fmtStatus = typeof window.formatOrderStatus === 'function' ? window.formatOrderStatus(order.status) : (order.status || '').toUpperCase();
                        return `<span class="order-status status-${typeof window.escapeAttr==='function'?window.escapeAttr(statusSlug):statusSlug}" data-raw-status="${typeof window.escapeAttr==='function'?window.escapeAttr(order.status || ''):order.status || ''}">${typeof window.escapeHtml==='function'?window.escapeHtml(fmtStatus):fmtStatus}</span>`;
                    })()}
                </div>
                <div class="order-items-list">${itemsHtml}</div>
                ${reviewBtnHtml}
                <div class="order-footer">
                    ${ttnBlock}
                    <div class="order-total-row">
                        <div class="order-total">${totalPrefix} ${formattedTotal}</div>
                    </div>
                </div>
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
                } catch {}
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
    try { updateOrderTabCounters(); } catch {}
}
