// ==========================================
// NISHA CHAT & SUPPORT MODULE (SUPPORT_TICKET.EXE & Realtime)
// ==========================================

// 1. Открытие модального окна поддержки
function openSupportModalWindow() {
    if (typeof lenis !== 'undefined' && window.stopLenis) window.stopLenis();
    const input = document.getElementById('supportInput');
    if (input) input.value = ''; // Очищаем поле при открытии
    
    const modal = document.getElementById('supportModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}
window.openSupportModalWindow = openSupportModalWindow;

// 2. Быстрая отправка тикета поддержки в фоне
async function submitSupportTicket() {
    const input = document.getElementById('supportInput');
    const btn = document.getElementById('btnSubmitSupport');
    if (!input || !btn) return;

    const message = input.value.trim();

    if (message.length < 5) {
        showToast('Опиши проблему подробнее (минимум 5 символов)', 'error');
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        return;
    }

    btn.style.pointerEvents = 'none';
    btn.innerText = '[ ОТПРАВКА... ]';

    const safeText = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(message) : message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    const activeUser = (typeof currentUser !== 'undefined') ? currentUser : (window.currentUser || null);
    const userContact = activeUser ? (activeUser.email || activeUser.phone || 'Аноним') : 'Гость';
    const activeFingerprint = (typeof clientFingerprint !== 'undefined' && clientFingerprint) 
        ? clientFingerprint 
        : (window.clientFingerprint || 'guest_' + Date.now());

    // Отправляем запрос на сервер в фоне
    fetch('https://nisha-api.onrender.com/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contact: userContact, 
            message: safeText, 
            clientId: activeFingerprint 
        })
    }).catch(e => console.log('Фоновая отправка в саппорт не удалась: ', e));

    // Моментальный отклик интерфейса
    if (typeof triggerHaptic === 'function') triggerHaptic('success');
    showToast('Сообщение успешно доставлено админу!', 'success');
    
    if (typeof closeModal === 'function') {
        closeModal('supportModal');
    } else if (typeof executeCloseModal === 'function') {
        executeCloseModal('supportModal');
    }

    // Возвращаем кнопку в исходное состояние
    setTimeout(() => {
        btn.style.pointerEvents = 'auto';
        btn.innerText = 'ОТПРАВИТЬ СИГНАЛ';
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

    try {
        // 1. Проверяем пропущенные сообщения (Offline)
        sb.from('support_replies')
            .select('*')
            .eq('client_id', fingerprint)
            .eq('is_read', false)
            .then(({ data: replies, error: replErr }) => {
                if (replErr) console.error('[СИСТЕМА ОТВЕТОВ] Ошибка БД:', replErr.message);

                if (replies && replies.length > 0) {
                    console.log(`[СИСТЕМА ОТВЕТОВ] Найдено ${replies.length} новых сообщений!`);
                    replies.forEach(r => {
                        showTerminalModal('INCOMING_MESSAGE.SYS', `<b>Ответ от Поддержки:</b><br><br>${r.answer_text}`, '[ ПРОЧИТАНО ]', () => {
                            sb.from('support_replies').update({ is_read: true }).eq('id', r.id).then();
                        });
                    });
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
                const r = payload.new;
                showTerminalModal('INCOMING_MESSAGE.SYS', `<b>Ответ от Поддержки:</b><br><br>${r.answer_text}`, '[ ПРОЧИТАНО ]', () => {
                    sb.from('support_replies').update({ is_read: true }).eq('id', r.id).then();
                });
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

// Автозапуск системы ответов через 3 секунды после старта
window.addEventListener('load', () => {
    setTimeout(initSupportRepliesSystem, 3000);
});
