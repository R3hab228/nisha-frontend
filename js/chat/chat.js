
// --- СИСТЕМА ЗАПОМИНАНИЯ ПОКАЗАННЫХ ОФФЕРОВ (ЧТОБЫ НЕ НАДОЕДАТЬ ПОЛЬЗОВАТЕЛЮ) ---
const BARGAIN_SEEN_STORAGE_KEY = 'nisha_shown_bargain_popups';
const SUPPORT_REPLY_SEEN_STORAGE_KEY = 'nisha_seen_support_reply_ids';

function hasSeenBargainPopup(key) {
    if (!key) return false;
    try {
        const raw = localStorage.getItem(BARGAIN_SEEN_STORAGE_KEY);
        if (!raw) return false;
        const list = JSON.parse(raw);
        return Array.isArray(list) && list.includes(String(key));
    } catch (e) {
        return false;
    }
}

function markBargainPopupAsSeen(key) {
    if (!key) return;
    try {
        const raw = localStorage.getItem(BARGAIN_SEEN_STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (!list.includes(String(key))) {
            list.push(String(key));
            if (list.length > 100) list.shift();
            localStorage.setItem(BARGAIN_SEEN_STORAGE_KEY, JSON.stringify(list));
        }
    } catch (e) {}
}

function isSupportReplySeen(id) {
    if (!id) return false;
    window._shownSupportReplyIds = window._shownSupportReplyIds || new Set();
    if (window._shownSupportReplyIds.has(String(id))) return true;
    try {
        const raw = localStorage.getItem(SUPPORT_REPLY_SEEN_STORAGE_KEY);
        if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.includes(String(id))) return true;
        }
    } catch (e) {}
    return false;
}

function markSupportReplyAsSeen(id) {
    if (!id) return;
    window._shownSupportReplyIds = window._shownSupportReplyIds || new Set();
    window._shownSupportReplyIds.add(String(id));
    try {
        const raw = localStorage.getItem(SUPPORT_REPLY_SEEN_STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (!list.includes(String(id))) {
            list.push(String(id));
            if (list.length > 100) list.shift();
            localStorage.setItem(SUPPORT_REPLY_SEEN_STORAGE_KEY, JSON.stringify(list));
        }
    } catch (e) {}
}

// --- МОДАЛЬНОЕ ОКНО ПРИНЯТОГО ТОРГА С ПРЯМЫМ ДОБАВЛЕНИЕМ В КОРЗИНУ ---
function showBargainAcceptedModal(bargainData, onDismiss) {
    if (!bargainData) return;

    const offerKey = String(bargainData.bargainId || ('accepted_' + bargainData.itemId + '_' + bargainData.acceptedPrice));
    if (hasSeenBargainPopup(offerKey)) {
        if (typeof onDismiss === 'function') onDismiss();
        return;
    }

    const checkFeed = () => {
        if (typeof isUserInProductFeed === 'function') return isUserInProductFeed();
        if (typeof window.isUserInProductFeed === 'function') return window.isUserInProductFeed();
        return true;
    };

    if (!checkFeed()) {
        if (typeof queueBargainNotification === 'function') {
            queueBargainNotification('BARGAIN_ACCEPTED', bargainData, onDismiss);
        } else {
            window.pendingBargainNotification = { type: 'BARGAIN_ACCEPTED', data: bargainData, markAsRead: onDismiss };
        }
        return;
    }

    markBargainPopupAsSeen(offerKey);

    document.querySelectorAll('.bargain-broadcast-overlay, .terminal-modal-overlay').forEach(el => el.remove());

    const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;
    const escHtml = (s) => String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

    const titleText = t('product.offer_accepted_title', 'ВАША ЦІНА ПРИЙНЯТА!');
    const descText = t('product.offer_accepted_text', 'Ваша пропозиція прийнята на суму');
    const buyBtnText = t('product.offer_buy_btn', 'В КОШИК');
    const currencyText = (typeof getCurrency === 'function' ? getCurrency() : (typeof i18next !== 'undefined' ? i18next.t('currency', { defaultValue: 'грн' }) : 'грн')).trim();

    // 1. Сохраняем состояние принятого торга для текущего товара
    try {
        sessionStorage.setItem('accepted_bargain_' + bargainData.itemId, JSON.stringify(bargainData));
        localStorage.setItem('accepted_bargain_' + bargainData.itemId, JSON.stringify(bargainData));
        sessionStorage.removeItem('declined_bargain_' + bargainData.itemId);
        localStorage.removeItem('declined_bargain_' + bargainData.itemId);
        sessionStorage.removeItem('pending_bargain_' + bargainData.itemId);
        localStorage.removeItem('pending_bargain_' + bargainData.itemId);
    } catch (e) {}

    // 2. Обновляем кнопку предложения цены и цену на карточке товара, если открыт именно этот товар
    const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    if (activeItem && String(activeItem.id) === String(bargainData.itemId)) {
        const offerPriceBtn = document.getElementById('modalOfferPriceBtn');
        if (offerPriceBtn) {
            const acceptedBtnText = t('product.offer_accepted_btn', 'ПРОПОЗИЦІЮ ПРИЙНЯТО ✓');
            offerPriceBtn.innerText = acceptedBtnText;
            offerPriceBtn.style.borderColor = 'var(--accent-yellow, #ffd700)';
            offerPriceBtn.style.color = 'var(--accent-yellow, #ffd700)';
            offerPriceBtn.style.boxShadow = 'none';
            offerPriceBtn.style.pointerEvents = 'none';
            offerPriceBtn.style.cursor = 'default';
            offerPriceBtn.disabled = true;
        }
        const priceEl = document.getElementById('modalItemPrice') || document.getElementById('modalPrice');
        if (priceEl) {
            priceEl.innerHTML = `<span style="text-decoration: line-through; color: #777; font-size: 0.75em; margin-right: 8px;">${bargainData.originalPrice || activeItem.price} грн</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${bargainData.acceptedPrice} грн</span>`;
        }
    }

    // Реактивно обновляем карточку товара прямо в ленте каталога
    if (typeof window.updateCardDOM === 'function') {
        const all = window.allItems || (typeof allItems !== 'undefined' ? allItems : []);
        const match = all.find(i => String(i.id) === String(bargainData.itemId));
        if (match) window.updateCardDOM(match);
    }

    const overlay = document.createElement('div');
    overlay.className = 'bargain-broadcast-overlay terminal-modal-overlay';
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 10001; display: flex; justify-content: center; align-items: center; padding: 15px; box-sizing: border-box;";

    const safeName = escHtml(bargainData.itemName || 'Товар');
    const safeImg = bargainData.itemImage ? escHtml(bargainData.itemImage) : '';
    const newPrice = bargainData.acceptedPrice || '';

    overlay.innerHTML = `
        <div class="success-terminal-box" style="max-width: 420px; width: 90%; background: #0a0a0a; border: 1px solid #333; box-shadow: 0 15px 50px rgba(0, 0, 0, 0.85); padding: 30px 24px; text-align: center;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                <div class="success-title" style="color: var(--accent-green, #00ff66); font-family: var(--font-mono); font-size: 16px; font-weight: 700; margin: 0; letter-spacing: 0.5px; text-transform: uppercase;">${titleText}</div>
                <button class="close-bargain-x-btn" aria-label="Close" style="background: none; border: none; color: var(--accent-red, #ff3333); font-family: var(--font-mono); font-size: 18px; font-weight: bold; cursor: pointer; padding: 2px 6px; line-height: 1; transition: transform 0.15s ease, opacity 0.15s ease;">✕</button>
            </div>
            <div class="success-divider" style="margin-bottom: 18px;"></div>

            ${safeImg ? `
            <div style="display: flex; justify-content: center; margin-bottom: 14px;">
                <img src="${safeImg}" alt="${safeName}" class="bargain-broadcast-img" style="width: 140px; height: 140px; aspect-ratio: 1/1; object-fit: cover; border: 1px solid #333; cursor: pointer; display: block; transition: transform 0.15s ease, border-color 0.15s ease;">
            </div>
            ` : ''}

            <div style="font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">${safeName}</div>
            <div style="font-family: var(--font-main); font-size: 14px; color: #ddd; line-height: 1.6; margin-bottom: 22px;">
                ${descText}: <b style="color: var(--accent-green, #00ff66); font-size: 16px; font-family: var(--font-mono);"><span class="bargain-price-val">${newPrice}</span> ${currencyText}</b>
            </div>

            <button class="buy-tg-btn cart-add btn-target bargain-add-cart-btn" style="width: 100%; min-height: 52px; font-size: 16px; text-transform: uppercase; font-family: var(--font-main); font-weight: bold;">
                ${buyBtnText}
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
    if (typeof triggerHaptic === 'function') triggerHaptic('success');

    const modalCtrl = new AbortController();
    const closeOverlay = () => {
        modalCtrl.abort();
        overlay.remove();
        if (typeof onDismiss === 'function') onDismiss();
        setTimeout(() => {
            if (typeof checkPendingBargainNotification === 'function') {
                checkPendingBargainNotification();
            }
        }, 150);
    };

    const addBtn = overlay.querySelector('.bargain-add-cart-btn');
    const closeXBtn = overlay.querySelector('.close-bargain-x-btn');
    const imgEl = overlay.querySelector('.bargain-broadcast-img');

    if (imgEl) {
        imgEl.addEventListener('click', () => {
            closeOverlay();
            if (typeof window.openProductModalById === 'function') {
                window.openProductModalById(bargainData.itemId);
            } else if (typeof window.openProductModal === 'function') {
                const all = window.allItems || (typeof allItems !== 'undefined' ? allItems : []);
                const found = all.find(i => String(i.id) === String(bargainData.itemId));
                if (found) window.openProductModal(found);
            }
        }, { signal: modalCtrl.signal });
    }

    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            if (typeof triggerHaptic === 'function') triggerHaptic('success');
            if (typeof window.addToCartById === 'function') {
                await window.addToCartById(bargainData.itemId, bargainData.acceptedPrice);
            }
            if (typeof window.openCart === 'function') {
                window.openCart();
            }
            const addedToast = t('product.offer_added_toast', 'Товар додано в кошик за узгодженою ціною!');
            if (typeof showToast === 'function') showToast(addedToast, 'success');
            closeOverlay();
        }, { signal: modalCtrl.signal });
    }

    if (closeXBtn) {
        closeXBtn.addEventListener('mouseenter', () => { closeXBtn.style.opacity = '0.75'; closeXBtn.style.transform = 'scale(1.15)'; });
        closeXBtn.addEventListener('mouseleave', () => { closeXBtn.style.opacity = '1'; closeXBtn.style.transform = 'scale(1)'; });
        closeXBtn.addEventListener('click', closeOverlay, { signal: modalCtrl.signal });
    }
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay();
    }, { signal: modalCtrl.signal });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeOverlay();
    }, { signal: modalCtrl.signal });
}
window.showBargainAcceptedModal = showBargainAcceptedModal;

window.pendingBargainNotifications = window.pendingBargainNotifications || [];

function queueBargainNotification(type, data, markAsRead) {
    window.pendingBargainNotifications = window.pendingBargainNotifications || [];
    window.pendingBargainNotifications.push({ type, data, markAsRead });
    window.pendingBargainNotification = window.pendingBargainNotifications[0];
}
window.queueBargainNotification = queueBargainNotification;

function checkPendingBargainNotification() {
    if (!window.pendingBargainNotifications || window.pendingBargainNotifications.length === 0) {
        if (window.pendingBargainNotification) {
            window.pendingBargainNotifications = [window.pendingBargainNotification];
        } else {
            return;
        }
    }

    const checkFeed = () => {
        if (typeof isUserInProductFeed === 'function') return isUserInProductFeed();
        if (typeof window.isUserInProductFeed === 'function') return window.isUserInProductFeed();
        return true;
    };

    if (!checkFeed()) return;

    const notif = window.pendingBargainNotifications.shift();
    window.pendingBargainNotification = window.pendingBargainNotifications[0] || null;
    if (!notif) return;

    if (notif.type === 'BARGAIN_ACCEPTED') {
        const offerKey = String(notif.data.bargainId || ('accepted_' + notif.data.itemId + '_' + notif.data.acceptedPrice));
        if (hasSeenBargainPopup(offerKey)) {
            if (typeof notif.markAsRead === 'function') notif.markAsRead();
            setTimeout(checkPendingBargainNotification, 100);
            return;
        }
        showBargainAcceptedModal(notif.data, () => {
            if (typeof notif.markAsRead === 'function') notif.markAsRead();
            setTimeout(checkPendingBargainNotification, 200);
        });
    } else if (notif.type === 'BARGAIN_DECLINED') {
        const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;
        const declMsg = t('product.offer_declined_toast', 'Продавець відхилив пропозицію ціни на товар.');
        if (typeof showToast === 'function') showToast(declMsg, 'info');
        if (typeof notif.markAsRead === 'function') notif.markAsRead();
        if (window.pendingBargainNotifications.length > 0) {
            setTimeout(checkPendingBargainNotification, 200);
        }
    }
}
window.checkPendingBargainNotification = checkPendingBargainNotification;

function handleIncomingSupportReply(r, sbClient) {
    if (!r) return;
    if (r.id && isSupportReplySeen(r.id)) return;
    if (r.id) markSupportReplyAsSeen(r.id);

    const markAsRead = () => {
        if (r.id && sbClient) {
            sbClient.from('support_replies').update({ is_read: true }).eq('id', r.id).then();
        }
    };

    let parsed = null;
    if (typeof r.answer_text === 'string' && r.answer_text.trim().startsWith('{')) {
        try {
            parsed = JSON.parse(r.answer_text);
        } catch (e) {}
    }

    if (parsed && parsed.type === 'BARGAIN_ACCEPTED') {
        try {
            sessionStorage.setItem('accepted_bargain_' + parsed.itemId, JSON.stringify(parsed));
            localStorage.setItem('accepted_bargain_' + parsed.itemId, JSON.stringify(parsed));
            sessionStorage.removeItem('declined_bargain_' + parsed.itemId);
            localStorage.removeItem('declined_bargain_' + parsed.itemId);
            sessionStorage.removeItem('pending_bargain_' + parsed.itemId);
            localStorage.removeItem('pending_bargain_' + parsed.itemId);
        } catch (e) {}

        const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;

        const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
        if (activeItem && String(activeItem.id) === String(parsed.itemId)) {
            const offerPriceBtn = document.getElementById('modalOfferPriceBtn');
            if (offerPriceBtn) {
                const acceptedBtnText = t('product.offer_accepted_btn', 'ПРОПОЗИЦІЮ ПРИЙНЯТО ✓');
                offerPriceBtn.innerText = acceptedBtnText;
                offerPriceBtn.style.borderColor = 'var(--accent-yellow, #ffd700)';
                offerPriceBtn.style.color = 'var(--accent-yellow, #ffd700)';
                offerPriceBtn.style.boxShadow = 'none';
                offerPriceBtn.style.pointerEvents = 'none';
                offerPriceBtn.style.cursor = 'default';
                offerPriceBtn.disabled = true;
            }
            const priceEl = document.getElementById('modalItemPrice') || document.getElementById('modalPrice');
            if (priceEl) {
                priceEl.innerHTML = `<span style="text-decoration: line-through; color: #777; font-size: 0.75em; margin-right: 8px;">${parsed.originalPrice || activeItem.price} грн</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${parsed.acceptedPrice} грн</span>`;
            }
        }

        if (typeof window.updateCardDOM === 'function') {
            const all = window.allItems || (typeof allItems !== 'undefined' ? allItems : []);
            const match = all.find(i => i && String(i.id) === String(parsed.itemId));
            if (match) window.updateCardDOM(match);
        }

        try {
            const activeCart = (typeof window.getActiveCart === 'function') ? window.getActiveCart() : ((typeof getActiveCart === 'function') ? getActiveCart() : null);
            if (Array.isArray(activeCart)) {
                const cartItem = activeCart.find(ci => ci && String(ci.id) === String(parsed.itemId));
                if (cartItem && Number(cartItem.price) !== Number(parsed.acceptedPrice)) {
                    cartItem.originalPrice = Number(parsed.originalPrice || cartItem.originalPrice || cartItem.price);
                    cartItem.price = Number(parsed.acceptedPrice);
                    cartItem.bargainPrice = Number(parsed.acceptedPrice);
                    if (typeof window.setActiveCart === 'function') window.setActiveCart(activeCart);
                    else if (typeof setActiveCart === 'function') setActiveCart(activeCart);
                    if (typeof window.updateCartUI === 'function') window.updateCartUI();
                    else if (typeof updateCartUI === 'function') updateCartUI();
                }
            }
        } catch (e) {}

        const offerKey = String(parsed.bargainId || ('accepted_' + parsed.itemId + '_' + parsed.acceptedPrice));
        if (hasSeenBargainPopup(offerKey)) {
            markAsRead();
            return;
        }

        const checkFeed = () => {
            if (typeof isUserInProductFeed === 'function') return isUserInProductFeed();
            if (typeof window.isUserInProductFeed === 'function') return window.isUserInProductFeed();
            return true;
        };

        if (checkFeed()) {
            showBargainAcceptedModal(parsed, markAsRead);
        } else {
            queueBargainNotification('BARGAIN_ACCEPTED', parsed, markAsRead);
        }
        return;
    }

    if (parsed && parsed.type === 'BARGAIN_DECLINED') {
        try {
            sessionStorage.setItem('declined_bargain_' + parsed.itemId, 'true');
            localStorage.setItem('declined_bargain_' + parsed.itemId, 'true');
            sessionStorage.removeItem('accepted_bargain_' + parsed.itemId);
            localStorage.removeItem('accepted_bargain_' + parsed.itemId);
            sessionStorage.removeItem('pending_bargain_' + parsed.itemId);
            localStorage.removeItem('pending_bargain_' + parsed.itemId);
        } catch (e) {}

        const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;

        const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
        if (activeItem && String(activeItem.id) === String(parsed.itemId)) {
            const offerPriceBtn = document.getElementById('modalOfferPriceBtn');
            if (offerPriceBtn) {
                const declinedBtnText = t('product.offer_declined_btn', 'ПРОПОЗИЦІЮ ВІДХИЛЕНО');
                offerPriceBtn.innerText = declinedBtnText;
                offerPriceBtn.style.borderColor = 'var(--accent-red, #ff3333)';
                offerPriceBtn.style.color = 'var(--accent-red, #ff3333)';
                offerPriceBtn.style.boxShadow = 'none';
                offerPriceBtn.style.pointerEvents = 'none';
                offerPriceBtn.style.cursor = 'default';
                offerPriceBtn.disabled = true;
            }
        }

        const checkFeed = () => {
            if (typeof isUserInProductFeed === 'function') return isUserInProductFeed();
            if (typeof window.isUserInProductFeed === 'function') return window.isUserInProductFeed();
            return true;
        };

        if (checkFeed()) {
            const declMsg = t('product.offer_declined_toast', 'Продавець відхилив пропозицію ціни на товар.');
            if (typeof showToast === 'function') showToast(declMsg, 'info');
            markAsRead();
        } else {
            queueBargainNotification('BARGAIN_DECLINED', parsed, markAsRead);
        }
        return;
    }

    const safeAnswer = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(r.answer_text) : (typeof window.escapeHtml === 'function' ? window.escapeHtml(r.answer_text) : r.answer_text);
    const replyTitle = (typeof i18next !== 'undefined' && i18next.t('support.reply_title', { defaultValue: 'Ответ от Поддержки:' })) || 'Ответ от Поддержки:';
    const replyReadBtn = (typeof i18next !== 'undefined' && i18next.t('support.reply_btn_read', { defaultValue: '[ ПРОЧИТАНО ]' })) || '[ ПРОЧИТАНО ]';
    showTerminalModal('INCOMING_MESSAGE.SYS', `<b>${replyTitle}</b><br><br>${safeAnswer}`, replyReadBtn, markAsRead);
}

// ==========================================
// NISHA CHAT & SUPPORT MODULE (SUPPORT_TICKET.EXE & Realtime)
// ==========================================

// 1. Открытие модального окна поддержки
function openSupportModalWindow() {
    if (typeof lenis !== 'undefined' && window.stopLenis) window.stopLenis();
    const input = document.getElementById('supportInput');
    if (input) input.value = ''; // Очищаем поле при открытии
    
    if (typeof openModal === 'function') {
        openModal('supportModal');
        if (typeof triggerModalTypewriter === 'function') triggerModalTypewriter('supportModal');
    } else {
        const modal = document.getElementById('supportModal');
        if (modal) {
            modal.inert = false;
            modal.removeAttribute('inert');
            modal.setAttribute('aria-hidden', 'false');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
}
window.openSupportModalWindow = openSupportModalWindow;

// 2. Быстрая отправка тикета поддержки в фоне
async function submitSupportTicket() {
    const input = document.getElementById('supportInput');
    const btn = document.getElementById('btnSubmitSupport');
    if (!input || !btn) return;

    let message = input.value.trim();

    if (message.length < 5) {
        const minLenMsg = typeof i18next !== 'undefined' ? i18next.t('support.min_len', { defaultValue: 'Опиши проблему подробнее (минимум 5 символов)' }) : 'Опиши проблему подробнее (минимум 5 символов)';
        showToast(minLenMsg, 'error');
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        return;
    }
    if (message.length > 100) {
        message = message.slice(0, 100);
    }

    btn.style.pointerEvents = 'none';
    btn.innerText = (typeof i18next !== 'undefined' && i18next.t('support.sending', { defaultValue: '[ ОТПРАВКА... ]' })) || '[ ОТПРАВКА... ]';

    const safeText = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(message) : message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    const activeUser = (typeof currentUser !== 'undefined') ? currentUser : (window.currentUser || null);
    const userContact = activeUser ? (activeUser.email || activeUser.phone || 'Аноним') : 'Гость';
    const activeFingerprint = (typeof clientFingerprint !== 'undefined' && clientFingerprint) 
        ? clientFingerprint 
        : (window.clientFingerprint || 'guest_' + Date.now());

    // Отправляем запрос на сервер в фоне с авто-повтором при сбое сети
    window.apiClient.post('/api/support', {
        contact: userContact,
        message: safeText,
        clientId: activeFingerprint
    }, { timeout: 10000, retries: 2 }).catch(e => console.log('Фоновая отправка в саппорт не удалась: ', e));

    // Моментальный отклик интерфейса
    if (typeof triggerHaptic === 'function') triggerHaptic('success');
    const successMsg = typeof i18next !== 'undefined' ? i18next.t('support.success_sent', { defaultValue: 'Сообщение успешно доставлено админу!' }) : 'Сообщение успешно доставлено админу!';
    showToast(successMsg, 'success');
    
    if (typeof closeModal === 'function') {
        closeModal('supportModal');
    } else if (typeof executeCloseModal === 'function') {
        executeCloseModal('supportModal');
    }

    // Возвращаем кнопку в исходное состояние
    setTimeout(() => {
        btn.style.pointerEvents = 'auto';
        btn.innerText = typeof i18next !== 'undefined' ? i18next.t('support.submit', { defaultValue: 'ОТПРАВИТЬ СИГНАЛ' }) : 'ОТПРАВИТЬ СИГНАЛ';
        input.value = '';
    }, 500);
}
window.submitSupportTicket = submitSupportTicket;

// 3. Система личных ответов от поддержки (Realtime + Offline)
function initSupportRepliesSystem() {
    if (window._supportRepliesInitialized) return;
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    const fingerprint = window.clientFingerprint || (typeof clientFingerprint !== 'undefined' ? clientFingerprint : null);

    if (!sb || !fingerprint) {
        // Если Supabase или фингерпринт еще не готовы, пробуем повторить через 1 сек
        setTimeout(initSupportRepliesSystem, 1000);
        return;
    }
    window._supportRepliesInitialized = true;

    console.log('[СИСТЕМА ОТВЕТОВ] Инициализация... Мой ID:', fingerprint);

    function checkUnreadSupportReplies() {
        const activeSb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
        const activeFp = window.clientFingerprint || (typeof clientFingerprint !== 'undefined' ? clientFingerprint : null);
        const currentUid = (window.currentUser && window.currentUser.id) ? String(window.currentUser.id) : null;
        if (!activeSb || (!activeFp && !currentUid)) return;

        window._shownSupportReplyIds = window._shownSupportReplyIds || new Set();

        const processReplies = (replies) => {
            if (replies && replies.length > 0) {
                console.log(`[СИСТЕМА ОТВЕТОВ] Найдено ${replies.length} новых сообщений!`);
                replies.forEach(r => handleIncomingSupportReply(r, activeSb));
            }
        };

        if (activeFp) {
            activeSb.from('support_replies')
                .select('id, answer_text')
                .eq('client_id', activeFp)
                .eq('is_read', false)
                .then(({ data: replies, error: replErr }) => {
                    if (!replErr) processReplies(replies);
                });
        }

        if (currentUid) {
            activeSb.from('support_replies')
                .select('id, answer_text')
                .eq('client_id', `user_${currentUid}`)
                .eq('is_read', false)
                .then(({ data: userReplies, error: uErr }) => {
                    if (!uErr) processReplies(userReplies);
                });
        }
    }
    window.checkUnreadSupportReplies = checkUnreadSupportReplies;

    function subscribeUserRealtime(userId) {
        if (!userId || !sb) return;
        const channelName = `support-replies-user-${userId}`;
        if (window._userSupportChannel) {
            try { sb.removeChannel(window._userSupportChannel); } catch (e) {}
        }
        window._userSupportChannel = sb.channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'support_replies',
                filter: `client_id=eq.user_${userId}`
            }, payload => {
                console.log('[СИСТЕМА ОТВЕТОВ] Пришло новое сообщение (user) Online:', payload.new);
                handleIncomingSupportReply(payload.new, sb);
            })
            .subscribe();
    }
    window.subscribeUserRealtime = subscribeUserRealtime;

    try {
        // 1. Проверяем пропущенные сообщения (Offline)
        checkUnreadSupportReplies();

        // Проверяем при возвращении пользователя во вкладку
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkUnreadSupportReplies();
                if (typeof window.syncUserBargains === 'function') {
                    window.syncUserBargains();
                }
            }
        });

        // 2. Слушаем новые сообщения в реальном времени (Realtime Online)
        console.log('[СИСТЕМА ОТВЕТОВ] Подписка на Realtime включена.');
        sb.channel('support-replies-channel')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'support_replies', 
                filter: `client_id=eq.${fingerprint}` 
            }, payload => {
                console.log('[СИСТЕМА ОТВЕТОВ] Пришло новое сообщение Online:', payload.new);
                handleIncomingSupportReply(payload.new, sb);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[СИСТЕМА ОТВЕТОВ] Успешно подключен к каналу!');
                }
            });

        if (window.currentUser && window.currentUser.id) {
            subscribeUserRealtime(window.currentUser.id);
        }
    } catch(e) {
        console.error('[СИСТЕМА ОТВЕТОВ] Глобальная ошибка:', e);
    }
}
window.initSupportRepliesSystem = initSupportRepliesSystem;

// Автозапуск системы ответов после старта (с поддержкой ленивой подгрузки модуля)
if (document.readyState === 'complete') {
    setTimeout(initSupportRepliesSystem, 1500);
} else {
    window.addEventListener('load', () => {
        setTimeout(initSupportRepliesSystem, 3000);
    });
}
