// ==========================================
// NISHA REVIEWS MODULE (REVIEWS.TXT / EXE)
// ==========================================

// Глобальная функция для открытия 1 картинки в PhotoSwipe
function openReviewImage(url) {
    if (!window.PhotoSwipeLightbox) return;
    const lightbox = new window.PhotoSwipeLightbox({
        dataSource: [{ src: url, width: 1000, height: 1000 }],
        pswpModule: () => import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/photoswipe.esm.min.js')
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

// Открытие модального окна со списком отзывов
async function openReviewsModal() { 
    const modal = document.getElementById('reviewsModal');
    if (modal) modal.style.display = 'flex'; 
    document.body.style.overflow = 'hidden'; 
    if (typeof lenis !== 'undefined' && typeof window.stopLenis === 'function') {
        window.stopLenis(); 
    }
    
    const container = document.getElementById('reviewsContainerList');
    if (!container) return;

    const renderReviewsData = (data) => {
        if (!data || data.length === 0) {
            const emptyMsg = (typeof i18next !== 'undefined') 
                ? i18next.t('reviews_modal.empty_reviews', { defaultValue: 'В ДАННЫЙ МОМЕНТ ОТЗЫВЫ ОТСУТСТВУЮТ' }) 
                : 'В ДАННЫЙ МОМЕНТ ОТЗЫВЫ ОТСУТСТВУЮТ';
            container.innerHTML = `<div style="text-align: center; color: #555; font-family: var(--font-mono); padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a;">[ ${emptyMsg} ]</div>`;
            return;
        }
        
        let html = ''; 
        data.forEach(rev => {
            const date = new Date(rev.created_at).toLocaleDateString('ru-RU');
            const safeText = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rev.text) : (rev.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeName = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rev.user_name) : (rev.user_name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            const clickAction = rev.item_image ? `onclick="openReviewImage('${rev.item_image}')"` : '';
            const imgHtml = rev.item_image ? `<div ${clickAction} style="width: 45px; height: 45px; border-radius: 4px; border: 1px solid #333; background-image: url('${rev.item_image}'); background-size: cover; background-position: center; flex-shrink: 0; box-shadow: 0 0 10px rgba(0,255,0,0.1); cursor: zoom-in;" title="Увеличить фото"></div>` : '';
            
            const productLinkStyle = rev.item_id ? `cursor: pointer; text-decoration: underline; text-decoration-style: dashed;` : '';
            const productLinkAction = rev.item_id ? `onclick="openProductModalById('${rev.item_id}')" title="Открыть товар"` : '';

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
    
    container.innerHTML = '<div style="text-align: center; color: var(--accent-green); font-family: var(--font-mono); padding: 40px 20px;">[ ЗАГРУЗКА ОТЗЫВОВ... ]</div>';
    
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!sb) {
        container.innerHTML = '<div style="text-align: center; color: #555; font-family: var(--font-mono); padding: 40px 20px;">[ ОШИБКА ПОДКЛЮЧЕНИЯ К БАЗЕ ]</div>';
        return;
    }

    const { data, error } = await sb.from('reviews').select('*').eq('is_published', true).order('created_at', { ascending: false });
    
    if (error || !data) {
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

window.addEventListener('resize', () => {
    const modal = document.getElementById('reviewsModal');
    if (modal && window.getComputedStyle(modal).display === 'flex') {
        equalizeReviewCardHeights();
    }
});

// Умный сбор отзывов за полученные посылки
function promptOrderReview(orderId, itemName, itemImage, itemId) {
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

    if (typeof lenis !== 'undefined' && typeof window.stopLenis === 'function') {
        window.stopLenis();
    }
    const autoModal = document.getElementById('autoReviewModal');
    if (autoModal) autoModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
window.promptOrderReview = promptOrderReview;

// Отправка авто-отзыва по заказу
async function submitAutoReview() {
    const inputEl = document.getElementById('autoReviewInput');
    const text = inputEl ? inputEl.value.trim() : '';
    const orderId = document.getElementById('autoReviewOrderId')?.value;
    const itemImage = document.getElementById('autoReviewItemImage')?.value;
    const itemId = document.getElementById('autoReviewItemId')?.value;

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
    
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!sb) return;

    // Пишем в БД отзыв вместе с ID заказа, фоткой и ID ТОВАРА
    const { error } = await sb.from('reviews').insert([{ 
        user_name: uName, 
        text: text, 
        rating: 5,
        order_id: orderId,
        item_image: (itemImage && itemImage !== '') ? itemImage : null,
        item_id: (itemId && itemId !== '') ? itemId : null
    }]);
    
    if (!error) {
        reviewsCache.data = null;
        reviewsCache.timestamp = 0;
        showToast('Отзыв опубликован! Спасибо.', 'success');
        let reviewedOrders = JSON.parse(localStorage.getItem('nisha_reviewed_orders') || '[]');
        reviewedOrders.push(orderId);
        localStorage.setItem('nisha_reviewed_orders', JSON.stringify(reviewedOrders));
        closeModal('autoReviewModal');
    } else {
        showToast('Ошибка: ' + error.message, 'error');
    }
}
window.submitAutoReview = submitAutoReview;

// Пропуск авто-отзыва ("Позже")
function skipAutoReview() {
    const orderId = document.getElementById('autoReviewOrderId')?.value;
    if (orderId) {
        let dismissedOrders = JSON.parse(localStorage.getItem('nisha_dismissed_reviews') || '[]');
        dismissedOrders.push(orderId); 
        localStorage.setItem('nisha_dismissed_reviews', JSON.stringify(dismissedOrders));
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
        if (typeof lenis !== 'undefined' && typeof window.stopLenis === 'function') {
            window.stopLenis();
        }
        const writeModal = document.getElementById('writeReviewModal');
        if (writeModal) writeModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
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
    
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!sb) {
        if (btn) {
            btn.style.pointerEvents = 'auto';
            btn.innerText = 'ОТПРАВИТЬ';
        }
        return;
    }

    const { error } = await sb.from('reviews').insert([{ user_name: uName, text: text, rating: 5 }]);

    if (btn) {
        btn.style.pointerEvents = 'auto';
        btn.innerText = 'ОТПРАВИТЬ';
    }

    if (error) {
        showToast('Ошибка при отправке: ' + error.message, 'error');
    } else {
        reviewsCache.data = null;
        reviewsCache.timestamp = 0;
        showToast('Отзыв успешно опубликован!', 'success');
        closeModal('writeReviewModal');
        
        // Переоткрываем список отзывов, чтобы отобразился свежий отзыв
        setTimeout(() => {
            openReviewsModal();
        }, 400);
    }
}
window.submitManualReview = submitManualReview;
