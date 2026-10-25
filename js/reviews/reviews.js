// ==========================================
// NISHA REVIEWS MODULE (REVIEWS.TXT / EXE)
// ==========================================

const toCDN = (u) => (typeof window.toCDN === 'function' ? window.toCDN(u) : (u || ''));

// Глобальная функция для открытия 1 картинки в PhotoSwipe
async function openReviewImage(url) {
    if (typeof ensurePhotoSwipe === 'function') {
        await ensurePhotoSwipe();
    }
    if (!window.PhotoSwipeLightbox) return;
    const cdnUrl = toCDN(url);
    const lightbox = new window.PhotoSwipeLightbox({
        dataSource: [{ src: cdnUrl, width: 1000, height: 1000 }],
        pswpModule: window.PhotoSwipe || (() => import('photoswipe'))
    });
    lightbox.init();
    lightbox.loadAndOpen(0);
}
window.openReviewImage = openReviewImage;

// Оперативный кэш отзывов (TTL: 3 минуты) для мгновенного повторного открытия
let reviewsCache = {
    data: null,
    timestamp: 0
};
const REVIEWS_CACHE_TTL = 3 * 60 * 1000;
const reviewDateFormatter = new Intl.DateTimeFormat('ru-RU');

// Открытие модального окна со списком отзывов
async function openReviewsModal() { 
    if (typeof openModal === 'function') {
        openModal('reviewsModal');
    } else {
        const modal = document.getElementById('reviewsModal');
        if (modal) {
            modal.inert = false;
            modal.removeAttribute('inert');
            modal.setAttribute('aria-hidden', 'false');
            modal.style.display = 'flex'; 
        }
        document.body.style.overflow = 'hidden'; 
    }
    
    const container = document.getElementById('reviewsContainerList');
    if (!container) return;

    const renderReviewsData = (data) => {
        container.classList.remove('is-loading');
        if (!data || data.length === 0) {
            container.classList.add('is-empty');
            const emptyMsg = (typeof i18next !== 'undefined') 
                ? i18next.t('reviews_modal.empty_reviews', { defaultValue: 'В ДАННЫЙ МОМЕНТ ОТЗЫВЫ ОТСУТСТВУЮТ' }) 
                : 'В ДАННЫЙ МОМЕНТ ОТЗЫВЫ ОТСУТСТВУЮТ';
            container.innerHTML = `<div class="reviews-empty-box">[ ${emptyMsg} ]</div>`;
            return;
        }
        container.classList.remove('is-empty');
        
        let html = ''; 
        data.forEach(rev => {
            const revDate = new Date(rev.created_at);
            const date = !Number.isNaN(revDate.getTime()) ? reviewDateFormatter.format(revDate) : '';
            const safeText = (typeof window.sanitizeText === 'function') ? window.sanitizeText(rev.text) : (rev.text || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
            const safeName = (typeof window.sanitizeText === 'function') ? window.sanitizeText(rev.user_name) : (rev.user_name || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
            
            const revImg = rev.item_image ? toCDN(rev.item_image) : '';
            const safeRevImg = typeof window.escapeHtml === 'function' ? window.escapeHtml(revImg) : revImg.replaceAll('"', '&quot;');
            const clickAction = revImg ? `data-action="open-review-image" data-img="${safeRevImg}"` : '';
            const imgHtml = revImg ? `<div ${clickAction} style="width: 45px; height: 45px; border-radius: 4px; border: 1px solid #333; background-image: url('${safeRevImg}'); background-size: cover; background-position: center; flex-shrink: 0; box-shadow: 0 0 10px rgba(0,255,0,0.1); cursor: zoom-in;" title="Увеличить фото"></div>` : '';
            
            const productLinkStyle = rev.item_id ? `cursor: pointer; text-decoration: underline; text-decoration-style: dashed;` : '';
            const safeItemIdAttr = typeof window.escapeAttr === 'function' ? window.escapeAttr(rev.item_id) : String(rev.item_id || '').replaceAll('"', '&quot;');
            const productLinkAction = rev.item_id ? `data-action="open-product" data-id="${safeItemIdAttr}" title="Открыть товар"` : '';

            html += `
            <div class="review-card-ui">
                <div class="review-head" style="align-items: flex-start; justify-content: space-between; display: flex;">
                    <div style="display: flex; flex-direction: column;">
                        <span class="review-name" ${productLinkAction} style="color: #fff; font-weight: bold; font-family: var(--font-main); font-size: 14px; ${productLinkStyle}">@${safeName}</span>
                        <div class="review-date" style="text-align: left; margin-top: 4px; color: #555; font-size: 11px; font-family: var(--font-mono);">${date}</div>
                    </div>
                    ${imgHtml}
                </div>
                <div class="review-text-body" style="margin-top: 10px; color: #ccc; font-size: 13px; line-height: 1.5; font-style: italic;">${safeText}</div>
            </div>`;
        });
        container.innerHTML = html;
        equalizeReviewCardHeights();
    };

    // Если кэш свежий — рендерим мгновенно с нулевой задержкой
    if (reviewsCache.data && (Date.now() - reviewsCache.timestamp < REVIEWS_CACHE_TTL)) {
        renderReviewsData(reviewsCache.data);
        return;
    }
    
    container.classList.add('is-loading');
    container.classList.remove('is-empty');

    const loadingText = (typeof i18next !== 'undefined') 
        ? i18next.t('reviews_modal.loading', { defaultValue: 'ЗАГРУЗКА ОТЗЫВОВ' }) 
        : 'ЗАГРУЗКА ОТЗЫВОВ';

    container.innerHTML = `
        <div class="reviews-loading-box">
            [ <span class="reviews-loading-text">${loadingText}</span><span class="loading-dots-seq"><span class="dot d1">.</span><span class="dot d2">.</span><span class="dot d3">.</span></span> ]
        </div>
    `;
    
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    let data = null;
    let error = null;

    if (sb) {
        try {
            const sbRes = await sb.from('reviews').select('created_at, text, user_name, item_image, item_id').eq('is_published', true).order('created_at', { ascending: false });
            data = sbRes.data;
            error = sbRes.error;
        } catch (e) {
            error = e;
        }
    }

    // Если прямого Supabase нет или запрос вернул ошибку, фолбэчим на бэкенд
    if ((error || !data) && window.apiClient && typeof window.apiClient.get === 'function') {
        try {
            const apiRes = await window.apiClient.get('/api/reviews', { timeout: 8000 });
            if (apiRes && apiRes.success && Array.isArray(apiRes.reviews)) {
                data = apiRes.reviews;
                error = null;
            }
        } catch (apiErr) {
            console.warn('[REVIEWS] Backend reviews fallback error:', apiErr.message);
        }
    }

    if (error || !data) {
        if (!sb && (!window.apiClient || typeof window.apiClient.get !== 'function')) {
            container.classList.remove('is-loading');
            container.classList.add('is-empty');
            container.innerHTML = '<div class="reviews-empty-box" style="color: var(--accent-red); border-color: rgba(255,0,0,0.3);">[ ОШИБКА ПОДКЛЮЧЕНИЯ К БАЗЕ ]</div>';
            return;
        }
        renderReviewsData([]);
        return;
    }

    reviewsCache.data = data;
    reviewsCache.timestamp = Date.now();
    renderReviewsData(data);
}
window.openReviewsModal = openReviewsModal;

// Прокрутка слайдера отзывов стрелками
function scrollReviews(direction) {
    const slider = document.getElementById('reviewsContainerList');
    if (!slider) return;
    const card = slider.querySelector('.review-card-ui');
    if (!card) return;
    const colWidth = card.offsetWidth + 15;
    const scrollAmount = window.innerWidth > 900 ? (colWidth * 2) : colWidth;
    slider.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
}
window.scrollReviews = scrollReviews;

// Автоматическое выравнивание высоты всех отзывов пиксель-в-пиксель
function equalizeReviewCardHeights() {
    requestAnimationFrame(() => {
        const slider = document.getElementById('reviewsContainerList');
        if (!slider) return;
        const cards = slider.querySelectorAll('.review-card-ui');
        if (!cards.length) return;

        // 1. Сбрасываем фиксированную высоту
        cards.forEach(c => {
            c.style.height = 'auto';
        });

        // 2. Находим максимальную естественную высоту среди всех отзывов
        let maxHeight = 0;
        cards.forEach(c => {
            const h = c.offsetHeight;
            if (h > maxHeight) maxHeight = h;
        });

        // Базовый аккуратный минимум для коротких текстов
        if (maxHeight < 140) maxHeight = 140;

        // 3. Задаем ВСЕМ карточкам единую одинаковую высоту пиксель в пиксель
        cards.forEach(c => {
            c.style.height = `${maxHeight}px`;
        });
    });
}
window.equalizeReviewCardHeights = equalizeReviewCardHeights;

let resizeReviewCardRaf = null;
window.addEventListener('resize', () => {
    if (resizeReviewCardRaf) return;
    resizeReviewCardRaf = window.requestAnimationFrame(() => {
        resizeReviewCardRaf = null;
        const modal = document.getElementById('reviewsModal');
        if (modal && (typeof window.isElementVisible === 'function' ? window.isElementVisible(modal) : window.getComputedStyle(modal).display === 'flex')) {
            equalizeReviewCardHeights();
        }
    });
}, { passive: true });

// Умный сбор отзывов за полученные посылки
function promptOrderReview(orderId, itemName, itemImage, itemId) {
    if (orderId) {
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        const reviewedOrders = store ? store.getJSON('nisha_reviewed_orders', []) : [];
        if (Array.isArray(reviewedOrders) && reviewedOrders.includes(orderId)) {
            showToast('Отзыв по этому заказу уже оставлен.', 'info');
            return;
        }
    }

    const orderInput = document.getElementById('autoReviewOrderId');
    if (orderInput) orderInput.value = orderId;

    let resolvedImg = itemImage || '';
    if (!resolvedImg && itemId && typeof getOrderItemImage === 'function') {
        resolvedImg = getOrderItemImage({ id: itemId }) || '';
    }

    const itemImgInput = document.getElementById('autoReviewItemImage');
    if (itemImgInput) itemImgInput.value = resolvedImg;

    const itemIdInput = document.getElementById('autoReviewItemId');
    if (itemIdInput) itemIdInput.value = itemId || '';

    const nameEl = document.getElementById('autoReviewName');
    if (nameEl) nameEl.innerText = itemName;

    const previewEl = document.getElementById('autoReviewImg');
    if (previewEl) previewEl.style.backgroundImage = resolvedImg ? `url('${resolvedImg}')` : 'none';

    const inputEl = document.getElementById('autoReviewInput');
    if (inputEl) inputEl.value = ''; 

    if (typeof openModal === 'function') {
        openModal('autoReviewModal');
    } else {
        const autoModal = document.getElementById('autoReviewModal');
        if (autoModal) {
            autoModal.inert = false;
            autoModal.removeAttribute('inert');
            autoModal.setAttribute('aria-hidden', 'false');
            autoModal.style.display = 'flex';
        }
        document.body.style.overflow = 'hidden';
    }
}
window.promptOrderReview = promptOrderReview;

// Защищенная отправка отзыва (сначала бэкенд API с service_role и обходом RLS, затем фолбэк на Supabase)
async function sendReviewPayload(payload) {
    // 1. Приоритетный защищенный канал через бэкенд API (service_role, обход RLS, валидация, Telegram-уведомление)
    if (window.apiClient && typeof window.apiClient.post === 'function') {
        try {
            const apiRes = await window.apiClient.post('/api/reviews', payload, { timeout: 12000, retries: 1 });
            if (apiRes && apiRes.success) {
                return { success: true, data: apiRes.data };
            }
            if (apiRes && apiRes.message) {
                return { success: false, error: new Error(apiRes.message) };
            }
        } catch (apiErr) {
            console.warn('[REVIEWS] Backend API error, attempting direct Supabase fallback:', apiErr.message);
            // Если клиент получил явную ошибку валидации от бэкенда (400), возвращаем ее
            if (apiErr.status === 400 || (apiErr.message && apiErr.message.includes('короткий'))) {
                return { success: false, error: apiErr };
            }
        }
    }

    // 2. Фолбэк на прямой Supabase инсерт
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!sb) {
        return { success: false, error: new Error('База данных временно недоступна') };
    }

    const activeUser = (typeof currentUser !== 'undefined') ? currentUser : (window.currentUser || null);
    const directPayload = {
        user_name: payload.user_name || payload.userName || 'User',
        text: payload.text,
        rating: payload.rating || 5,
        is_published: true
    };
    if (payload.order_id || payload.orderId) directPayload.order_id = payload.order_id || payload.orderId;
    if (payload.item_id || payload.itemId) directPayload.item_id = payload.item_id || payload.itemId;
    if (payload.item_image || payload.itemImage) directPayload.item_image = payload.item_image || payload.itemImage;
    if (activeUser && activeUser.id) directPayload.user_id = activeUser.id;

    let res = await sb.from('reviews').insert([directPayload]).select();
    if (res.error) {
        // Если ошибка отсутствия колонки user_id в схеме, повторяем без нее
        if (directPayload.user_id && res.error.message && res.error.message.includes('column')) {
            delete directPayload.user_id;
            res = await sb.from('reviews').insert([directPayload]).select();
        }
    }

    if (res.error) {
        return { success: false, error: res.error };
    }
    return { success: true, data: res.data };
}
window.sendReviewPayload = sendReviewPayload;

// Отправка авто-отзыва по заказу
async function submitAutoReview() {
    if (window._isSubmittingAutoReview) return;
    const inputEl = document.getElementById('autoReviewInput');
    const text = inputEl ? inputEl.value.trim() : '';
    const orderId = document.getElementById('autoReviewOrderId')?.value;
    const itemImage = document.getElementById('autoReviewItemImage')?.value;
    const itemId = document.getElementById('autoReviewItemId')?.value;

    if (orderId) {
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        const reviewedOrders = store ? store.getJSON('nisha_reviewed_orders', []) : [];
        if (Array.isArray(reviewedOrders) && reviewedOrders.includes(orderId)) {
            showToast('Отзыв по этому заказу уже оставлен.', 'info');
            closeModal('autoReviewModal');
            return;
        }
    }

    if (text.length < 3) {
        showToast('Текст слишком короткий!', 'error');
        return;
    }

    const profile = (typeof userProfile !== 'undefined') ? userProfile : (window.userProfile || null);
    const activeUser = (typeof currentUser !== 'undefined') ? currentUser : (window.currentUser || null);
    let uName = profile?.username;
    if (!uName || uName === 'User') {
        uName = activeUser?.user_metadata?.full_name || activeUser?.user_metadata?.name || activeUser?.email?.split('@')[0] || 'User';
    }

    window._isSubmittingAutoReview = true;
    try {
        const payload = {
            user_name: uName,
            text: text,
            rating: 5,
            order_id: orderId || null,
            item_image: (itemImage && itemImage !== '') ? itemImage : null,
            item_id: (itemId && itemId !== '') ? itemId : null,
            user_id: activeUser?.id || null
        };

        const result = await sendReviewPayload(payload);

        if (result.success) {
            window._myLastReviewText = text;
            reviewsCache.data = null;
            reviewsCache.timestamp = 0;
            showToast('Отзыв опубликован! Спасибо.', 'success');
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            let reviewedOrders = store ? store.getJSON('nisha_reviewed_orders', []) : [];
            if (!Array.isArray(reviewedOrders)) reviewedOrders = [];
            if (orderId && !reviewedOrders.includes(orderId)) {
                reviewedOrders.push(orderId);
            }
            if (store) store.setJSON('nisha_reviewed_orders', reviewedOrders);
            closeModal('autoReviewModal');
            if (typeof renderFilteredOrders === 'function') {
                renderFilteredOrders();
            }
        } else {
            const errDetail = result.error ? (result.error.message || String(result.error)) : 'Не удалось сохранить отзыв';
            showToast('Ошибка при отправке: ' + errDetail, 'error');
        }
    } finally {
        window._isSubmittingAutoReview = false;
    }
}
window.submitAutoReview = submitAutoReview;

// Пропуск авто-отзыва ("Позже")
function skipAutoReview() {
    const orderId = document.getElementById('autoReviewOrderId')?.value;
    if (orderId) {
        try {
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            let dismissedOrders = store ? store.getJSON('nisha_dismissed_reviews', []) : [];
            if (!Array.isArray(dismissedOrders)) dismissedOrders = [];
            if (!dismissedOrders.includes(orderId)) dismissedOrders.push(orderId);
            if (store) store.setJSON('nisha_dismissed_reviews', dismissedOrders);
        } catch(e) {}
    }
    closeModal('autoReviewModal');
}
window.skipAutoReview = skipAutoReview;

// Логика написания отзыва на сайте (кнопка из списка)
function writeReviewOnSite() {
    const activeUser = (typeof currentUser !== 'undefined') ? currentUser : (window.currentUser || null);
    if (!activeUser) {
        const authMsg = (typeof i18next !== 'undefined') 
            ? i18next.t('messages.cart_error_auth', { defaultValue: 'Сначала войдите в систему!' }) 
            : 'Сначала войдите в систему!';
        showToast(authMsg, 'error');
        closeModal('reviewsModal');
        if (typeof openProfileModal === 'function') {
            openProfileModal();
        }
        return;
    }

    const inputEl = document.getElementById('manualReviewInput');
    if (inputEl) inputEl.value = '';
    closeModal('reviewsModal');
    
    setTimeout(() => {
        if (typeof openModal === 'function') {
            openModal('writeReviewModal');
        } else {
            const writeModal = document.getElementById('writeReviewModal');
            if (writeModal) {
                writeModal.inert = false;
                writeModal.removeAttribute('inert');
                writeModal.setAttribute('aria-hidden', 'false');
                writeModal.style.display = 'flex';
            }
            document.body.style.overflow = 'hidden';
        }
    }, 300);
}
window.writeReviewOnSite = writeReviewOnSite;

// Отправка ручного отзыва
async function submitManualReview() {
    const inputEl = document.getElementById('manualReviewInput');
    const text = inputEl ? inputEl.value.trim() : '';
    
    if (text.length < 3) {
        showToast('Текст слишком короткий!', 'error');
        return;
    }

    const btn = document.querySelector('#writeReviewModal .cart-checkout-btn');
    if (btn) {
        btn.style.pointerEvents = 'none';
        btn.innerText = '...';
    }

    const profile = (typeof userProfile !== 'undefined') ? userProfile : (window.userProfile || null);
    const activeUser = (typeof currentUser !== 'undefined') ? currentUser : (window.currentUser || null);
    const uName = profile?.username || activeUser?.email?.split('@')[0] || 'User';

    try {
        const payload = {
            user_name: uName,
            text: text,
            rating: 5,
            user_id: activeUser?.id || null
        };

        const result = await sendReviewPayload(payload);

        if (result.success) {
            window._myLastReviewText = text;
            reviewsCache.data = null;
            reviewsCache.timestamp = 0;
            showToast('Отзыв успешно опубликован!', 'success');
            closeModal('writeReviewModal');
            
            // Переоткрываем список отзывов, чтобы отобразился свежий отзыв
            setTimeout(() => {
                openReviewsModal();
            }, 400);
        } else {
            const errDetail = result.error ? (result.error.message || String(result.error)) : 'Не удалось сохранить отзыв';
            showToast('Ошибка при отправке: ' + errDetail, 'error');
        }
    } finally {
        if (btn) {
            btn.style.pointerEvents = 'auto';
            btn.innerText = 'ОТПРАВИТЬ';
        }
    }
}
window.submitManualReview = submitManualReview;

// ==========================================
// REALTIME ПУШ-УВЕДОМЛЕНИЯ О НОВЫХ ОТЗЫВАХ
// ==========================================
let _reviewsRealtimeChannel = null;

function initReviewsRealtime(sb) {
    if (!sb) sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!sb) return;
    if (_reviewsRealtimeChannel) return;

    try {
        _reviewsRealtimeChannel = sb.channel('public:reviews')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, (payload) => {
                if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;
                const rev = payload.new;
                if (!rev) return;

                // Проверяем статус публикации: если явно false, не показываем
                if (rev.is_published === false) return;
                if (payload.eventType === 'UPDATE' && payload.old && payload.old.is_published === true) {
                    return; // Не спамим при редактировании уже опубликованного отзыва
                }

                // Инвалидируем оперативный кэш
                reviewsCache.data = null;
                reviewsCache.timestamp = 0;

                // Если модальное окно отзывов сейчас открыто — мгновенно обновляем список
                const modal = document.getElementById('reviewsModal');
                if (modal && (typeof window.isElementVisible === 'function' ? window.isElementVisible(modal) : window.getComputedStyle(modal).display === 'flex')) {
                    openReviewsModal();
                }

                // Защита от дублей уведомлений
                window._notifiedReviewIds = window._notifiedReviewIds || new Set();
                if (rev.id && window._notifiedReviewIds.has(rev.id)) return;
                if (rev.id) window._notifiedReviewIds.add(rev.id);

                // Если отзыв только что отправил текущий пользователь — он уже видел тост об успехе
                if (window._myLastReviewText && rev.text && window._myLastReviewText.trim() === rev.text.trim()) {
                    window._myLastReviewText = null;
                    return;
                }

                // Форматируем имя и текст
                const rawName = (rev.user_name || '').trim();
                const author = rawName ? (rawName.startsWith('@') ? rawName : '@' + rawName) : 'Покупатель';
                const cleanText = (rev.text || '').replace(/\s+/g, ' ').trim();
                const snippet = cleanText.length > 55 ? cleanText.slice(0, 52) + '...' : cleanText;
                const toastMsg = `⭐ Новый отзыв от ${author}: "${snippet}"`;

                // 1. Интерактивный пуш-тост на сайте с кликом для открытия модалки
                if (typeof showToast === 'function') {
                    const revImgCdn = (rev.item_image && typeof window.toCDN === 'function') ? window.toCDN(rev.item_image) : (rev.item_image || null);
                    showToast(toastMsg, 'success', revImgCdn, () => {
                        openReviewsModal();
                    });
                }

                if (typeof triggerHaptic === 'function') {
                    triggerHaptic('light');
                }

                // 2. Системный Web Push / Notification через Service Worker (для фона/блокировки экрана)
                const isPwa = typeof window.isPwaStandalone === 'function' ? window.isPwaStandalone() : false;
                const pwaInstalled = isPwa || (typeof window.checkIsPwaInstalled === 'function' ? window.checkIsPwaInstalled() : false);
                const canShowSysNotification = isPwa || !pwaInstalled;

                if (canShowSysNotification && 'serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
                    navigator.serviceWorker.ready.then(reg => {
                        const origin = (typeof window !== 'undefined' && window.location && window.location.origin)
                            ? window.location.origin
                            : 'https://www.nisha-store.shop';
                        const notifBadge = `${origin}/badge.png`;
                        const notifIcon = (rev.item_image && rev.item_image.trim())
                            ? ((typeof window.toCDN === 'function') ? window.toCDN(rev.item_image) : rev.item_image)
                            : `${origin}/icon-192.png`;

                        reg.showNotification('NISHA STORE | Новый отзыв ⭐', {
                            body: `${author}: "${snippet}"`,
                            icon: notifIcon,
                            badge: notifBadge,
                            tag: 'nisha-review-' + (rev.id || Date.now()),
                            renotify: true,
                            data: { url: 'https://www.nisha-store.shop/?action=reviews' }
                        });
                    }).catch(() => {});
                }
            })
            .subscribe();
    } catch(e) {
        console.warn('Realtime reviews init error:', e);
    }
}
window.initReviewsRealtime = initReviewsRealtime;

if (typeof window !== 'undefined' && window._supabase) {
    initReviewsRealtime(window._supabase);
}
