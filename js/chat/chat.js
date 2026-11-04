
// --- МОДАЛЬНОЕ ОКНО ПРИНЯТОГО ТОРГА С ПРЯМЫМ ДОБАВЛЕНИЕМ В КОРЗИНУ ---
function showBargainAcceptedModal(bargainData, onDismiss) {
    if (!bargainData) return;
    document.querySelectorAll('.bargain-broadcast-overlay').forEach(el => el.remove());

    const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;
    const escHtml = (s) => String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

    const titleText = t('product.offer_accepted_title', 'ВАША ЦІНА ПРИЙНЯТА!');
    const descText = t('product.offer_accepted_text', 'Продавець погодився на вашу ціну! Натисніть кнопку нижче, щоб додати річ у кошик за узгодженою ціною.');
    const buyBtnText = t('product.offer_buy_btn', '[ В КОШИК ЗА УЗГОДЖЕНОЮ ЦІНОЮ ]');

    const overlay = document.createElement('div');
    overlay.className = 'bargain-broadcast-overlay';
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 10001; display: flex; justify-content: center; align-items: center; padding: 16px; box-sizing: border-box;";

    const safeName = escHtml(bargainData.itemName || 'Товар');
    const safeImg = bargainData.itemImage ? escHtml(bargainData.itemImage) : '';
    const oldPrice = bargainData.originalPrice || '';
    const newPrice = bargainData.acceptedPrice || '';

    overlay.innerHTML = `
        <div class="success-terminal-box" style="max-width: 440px; width: 100%; border: 1px solid var(--accent-green, #00ff66); box-shadow: 0 0 25px rgba(0, 255, 102, 0.15); background: #0a0a0a; padding: 22px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--accent-green, #00ff66); letter-spacing: 0.5px;">🤝 ${titleText}</div>
                <button class="close-bargain-x-btn" style="background: none; border: none; color: #888; font-family: var(--font-mono); font-size: 16px; cursor: pointer; padding: 4px 8px;">✕</button>
            </div>
            <div class="success-divider" style="height: 1px; background: #222; margin-bottom: 16px;"></div>
            
            <div style="display: flex; gap: 14px; align-items: center; background: #121212; padding: 12px; border: 1px solid #262626; margin-bottom: 14px;">
                ${safeImg ? `<img src="${safeImg}" alt="${safeName}" style="width: 64px; height: 64px; object-fit: cover; border: 1px solid #333; flex-shrink: 0;">` : ''}
                <div style="flex: 1; min-width: 0;">
                    <div style="font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px;">${safeName}</div>
                    <div style="font-family: var(--font-mono); font-size: 13px;">
                        ${oldPrice ? `<span style="text-decoration: line-through; color: #777; margin-right: 8px;">${oldPrice} грн</span>` : ''}
                        <span style="color: var(--accent-green, #00ff66); font-weight: 700; font-size: 15px;">${newPrice} грн</span>
                    </div>
                </div>
            </div>

            <p style="font-size: 12px; color: #aaa; line-height: 1.5; margin: 0 0 18px 0; font-family: var(--font-main, sans-serif);">${descText}</p>

            <button class="cart-checkout-btn btn-target bargain-add-cart-btn" style="width: 100%; padding: 15px; font-size: 13px; font-weight: 700; background: var(--accent-yellow, #ffd700); color: #000; border: none; font-family: var(--font-mono); cursor: pointer; letter-spacing: 0.5px; transition: transform 0.15s ease;">
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
    };

    const addBtn = overlay.querySelector('.bargain-add-cart-btn');
    const closeXBtn = overlay.querySelector('.close-bargain-x-btn');

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

function handleIncomingSupportReply(r, sbClient) {
    if (!r) return;
    window._shownSupportReplyIds = window._shownSupportReplyIds || new Set();
    if (r.id && window._shownSupportReplyIds.has(r.id)) return;
    if (r.id) window._shownSupportReplyIds.add(r.id);

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
        showBargainAcceptedModal(parsed, markAsRead);
        return;
    }

    if (parsed && parsed.type === 'BARGAIN_DECLINED') {
        const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;
        const declMsg = t('product.offer_declined_toast', 'Продавець відхилив пропозицію ціни на товар.');
        if (typeof showToast === 'function') showToast(declMsg, 'info');
        markAsRead();
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
        if (!activeSb || !activeFp) return;

        activeSb.from('support_replies')
            .select('id, answer_text')
            .eq('client_id', activeFp)
            .eq('is_read', false)
            .then(({ data: replies, error: replErr }) => {
                if (replErr) return;
                if (replies && replies.length > 0) {
                    console.log(`[СИСТЕМА ОТВЕТОВ] Найдено ${replies.length} новых сообщений!`);
                    window._shownSupportReplyIds = window._shownSupportReplyIds || new Set();
                    replies.forEach(r => handleIncomingSupportReply(r, activeSb));
                }
            });
    }
    window.checkUnreadSupportReplies = checkUnreadSupportReplies;

    try {
        // 1. Проверяем пропущенные сообщения (Offline)
        checkUnreadSupportReplies();

        // Проверяем при возвращении пользователя во вкладку
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkUnreadSupportReplies();
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
