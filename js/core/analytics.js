/**
 * NISHA Underground Telemetry Beacon
 * Ultra-lightweight, non-blocking telemetry engine.
 * Zero lag, zero dependencies, silent fail-safe.
 */
(function() {
    'use strict';

    const API_ENDPOINT = 'https://nisha-api.onrender.com/api/telemetry';

    // Получение или создание анонимного ID сессии
    let clientId = '';
    try {
        clientId = localStorage.getItem('_ns_aid');
        if (!clientId) {
            clientId = 'c_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
            localStorage.setItem('_ns_aid', clientId);
        }
    } catch(e) {
        clientId = 'c_' + Math.random().toString(36).substring(2, 10);
    }

    // Безопасная отправка данных без блокировки UI
    function send(payload) {
        try {
            const data = JSON.stringify({ ...payload, clientId, ts: Date.now() });
            if (navigator.sendBeacon) {
                const blob = new Blob([data], { type: 'application/json' });
                navigator.sendBeacon(API_ENDPOINT, blob);
            } else {
                fetch(API_ENDPOINT, {
                    method: 'POST',
                    body: data,
                    headers: { 'Content-Type': 'application/json' },
                    keepalive: true,
                    mode: 'cors'
                }).catch(() => {});
            }
        } catch(e) {}
    }

    // Состояние открытого товара для подсчета удержания
    let currentOpenItem = null;
    let itemOpenTime = 0;
    let searchDebounceTimer = null;
    let lastLoggedSearch = '';

    const NishaAnalytics = {
        // Просмотр страницы
        trackPageView: function() {
            send({
                type: 'page_view',
                ref: document.referrer || 'direct',
                url: window.location.pathname
            });
        },

        // Открытие карточки товара
        trackItemOpen: function(itemId) {
            if (!itemId) return;
            // Если предыдущий товар был открыт, фиксируем его закрытие
            if (currentOpenItem && currentOpenItem !== itemId) {
                this.trackItemClose(currentOpenItem);
            }
            currentOpenItem = String(itemId);
            itemOpenTime = Date.now();
        },

        // Закрытие карточки товара (удержание в секундах)
        trackItemClose: function(itemId) {
            if (!currentOpenItem) return;
            const targetId = itemId || currentOpenItem;
            if (String(targetId) === String(currentOpenItem) && itemOpenTime > 0) {
                const dwellSec = Math.round((Date.now() - itemOpenTime) / 1000);
                // Фильтруем случайные клики (< 2 сек) и зависшие вкладки (> 10 мин)
                if (dwellSec >= 2 && dwellSec <= 600) {
                    send({
                        type: 'item_dwell',
                        itemId: String(currentOpenItem),
                        dwellSec: dwellSec
                    });
                }
            }
            currentOpenItem = null;
            itemOpenTime = 0;
        },

        // Поиск (с дебаунсом 1.5 сек, чтобы не слать каждый символ)
        trackSearch: function(query, count) {
            const q = String(query || '').trim().toLowerCase();
            if (q.length < 2) return;
            if (q === lastLoggedSearch) return;

            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                lastLoggedSearch = q;
                send({
                    type: 'search',
                    query: q,
                    count: typeof count === 'number' ? count : 0
                });
            }, 1500);
        },

        // Репост или шеринг айтема
        trackShare: function(platform, itemId) {
            send({
                type: 'item_share',
                platform: platform || 'copy_link',
                itemId: itemId || null
            });
        },

        // Добавление в корзину
        trackCartAdd: function(itemId) {
            send({
                type: 'cart_add',
                itemId: itemId || null
            });
        }
    };

    window.NishaAnalytics = NishaAnalytics;

    // Автоматическая отправка первого входа после загрузки документа
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(NishaAnalytics.trackPageView, 800);
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(NishaAnalytics.trackPageView, 800);
        });
    }

    // Сохранение удержания при уходе со страницы или смене вкладки
    window.addEventListener('pagehide', () => {
        if (currentOpenItem) NishaAnalytics.trackItemClose(currentOpenItem);
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && currentOpenItem) {
            NishaAnalytics.trackItemClose(currentOpenItem);
        }
    });
})();
