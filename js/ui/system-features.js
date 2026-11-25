// ==========================================
// NISHA SYSTEM FEATURES (Broadcasts, Rules, Hit Counter, Easter Egg, Shortcuts)
// ==========================================

// === SPECULATION RULES API SUPPORT (Instant 0ms Prerender/Prefetch) ===
export function isSpeculationRulesSupported() {
    return typeof HTMLScriptElement !== 'undefined' &&
           typeof HTMLScriptElement.supports === 'function' &&
           HTMLScriptElement.supports('speculationrules');
}

import {
    storage,
    openModal,
    executeCloseModal,
    isUserInProductFeed,
    showTerminalModal,
    showToast,
    apiClient,
    applyFilters,
    getActiveCart,
    syncCartToServer,
    updateCartUI,
    generateShortId,
    initAnalytics,
    track,
    startOnboardingTour,
    getGraphemeCount,
    invokeAction,
    registerActions
} from '../../src/modules/index.js';
import { tSafe } from '../core/runtime-env.js';

let pendingBroadcastQueue = null;

function tryShowBroadcast(title, htmlText, btnText, callback, options = {}) {
    if (!htmlText || htmlText === 'null' || (typeof htmlText === 'string' && !htmlText.trim())) {
        if (callback) callback();
        return;
    }
    const resolvedOptions = {
        persistent: (options && typeof options.persistent === 'boolean')
            ? options.persistent
            : title === 'SYSTEM_BROADCAST.MSG'
    };
    const inFeed = isUserInProductFeed();
    if (inFeed) {
        invokeAction('playNotifySound', { kind: 'broadcast' });
        showTerminalModal(title, htmlText, btnText, callback, resolvedOptions);
        pendingBroadcastQueue = null;
    } else {
        pendingBroadcastQueue = { title, htmlText, btnText, callback, options: resolvedOptions };
    }
}
window.tryShowBroadcast = tryShowBroadcast;

function checkPendingBroadcast() {
    if (!pendingBroadcastQueue) return;
    setTimeout(() => {
        const inFeed = isUserInProductFeed();
        if (pendingBroadcastQueue && inFeed) {
            const { title, htmlText, btnText, callback, options } = pendingBroadcastQueue;
            pendingBroadcastQueue = null;
            if (htmlText && htmlText !== 'null' && (typeof htmlText !== 'string' || htmlText.trim())) {
                invokeAction('playNotifySound', { kind: 'broadcast' });
                showTerminalModal(title, htmlText, btnText, callback, options || { persistent: title === 'SYSTEM_BROADCAST.MSG' });
            } else if (callback) {
                callback();
            }
        }
    }, 200);
}

let _pendingBroadcastIntervalId = null;

function runPendingNotificationsTick() {
    if (document.hidden) return;
    const inFeed = isUserInProductFeed();
    if (pendingBroadcastQueue && inFeed) {
        checkPendingBroadcast();
    }
    if (typeof checkPendingBargainNotification === 'function' && inFeed && (window.pendingBargainNotification || (window.pendingBargainNotifications && window.pendingBargainNotifications.length > 0))) {
        checkPendingBargainNotification();
    }
}

function startPendingBroadcastPolling() {
    if (_pendingBroadcastIntervalId || document.hidden) return;
    _pendingBroadcastIntervalId = setInterval(runPendingNotificationsTick, 1500);
}

function stopPendingBroadcastPolling() {
    if (_pendingBroadcastIntervalId) {
        clearInterval(_pendingBroadcastIntervalId);
        _pendingBroadcastIntervalId = null;
    }
}

startPendingBroadcastPolling();

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopPendingBroadcastPolling();
    } else {
        runPendingNotificationsTick();
        startPendingBroadcastPolling();
    }
});

// === RULES MODAL ===
const RULES_CONTENT_HTML = `
<p style="color:var(--accent-yellow);font-family:var(--font-mono);font-size:16px;font-weight:700;margin-top:0" data-i18n="rules.title">ВНИМАНИЕ! ПЕРЕД ИСПОЛЬЗОВАНИЕМ САЙТА ОЗНАКОМЬТЕСЬ С ПРАВИЛАМИ.</p>
<h3 data-i18n="rules.h1" style="color:var(--accent-green);font-family:var(--font-mono);border-bottom:1px solid #333;padding-bottom:10px;margin-top:25px">[ 1. ОБЩИЕ ПОЛОЖЕНИЯ ]</h3>
<ul style="padding-left:20px">
<li data-i18n="rules.p1_1" style="margin-bottom:10px">Сервис NISHA является комиссионной онлайн-витриной и гарантом безопасных расчетов между сторонами. Оформление заказа означает согласие с данными Правилами.</li>
<li data-i18n="rules.p1_2" style="margin-bottom:10px">Бейдж «Безопасная сделка» гарантирует: вы не рискуете всей суммой и оплачиваете остаток стоимости вещи наложенным платежом только после личного осмотра и примерки на почте.</li>
<li data-i18n="rules.p1_3" style="margin-bottom:10px">В каталоге представлены как архивные вещи магазина, так и вещи независимых продавцов (Creators). Все товары являются винтажными (б/у) и продаются в состоянии «как есть». Особенности естественного износа браком не считаются.</li>
</ul>
<h3 data-i18n="rules.h2" style="color:var(--accent-green);font-family:var(--font-mono);border-bottom:1px solid #333;padding-bottom:10px;margin-top:25px">[ 2. ОФОРМЛЕНИЕ ЗАКАЗА И БРОНЬ ]</h3>
<ul style="padding-left:20px">
<li data-i18n="rules.p2_1" style="margin-bottom:10px">После оформления заказ получает статус <b>RESERVED</b> ровно на <b>2 часа</b> для внесения аванса или оплаты.</li>
<li data-i18n="rules.p2_2" style="margin-bottom:10px">Если аванс <b>200 грн</b> (или полная оплата) не поступили за 2 часа, бронь аннулируется автоматически, а товар возвращается в свободную продажу.</li>
<li data-i18n="rules.p2_3" style="margin-bottom:10px">Администрация оставляет за собой право отменить заказ при отсутствии связи с покупателем или подозрении на спам/фрод.</li>
</ul>
<h3 data-i18n="rules.h3" style="color:var(--accent-green);font-family:var(--font-mono);border-bottom:1px solid #333;padding-bottom:10px;margin-top:25px">[ 3. ОПЛАТА И ДОСТАВКА ]</h3>
<ul style="padding-left:20px">
<li data-i18n="rules.p3_1" style="margin-bottom:10px">Доставка заказов осуществляется только «Новой Почтой» за счет покупателя.</li>
<li data-i18n="rules.p3_2" style="margin-bottom:10px">Доступно 2 формата оплаты:<br>1. <b>Наложенный платеж с авансом 200 грн:</b> аванс вносится при заказе, а остаток суммы оплачивается на почте строго после осмотра вещи.<br>2. <b>100% предоплата:</b> по желанию клиента (чтобы не переплачивать комиссию почты за перевод денег).</li>
<li data-i18n="rules.p3_3" style="margin-bottom:10px">Аванс <b>200 грн</b> не возвращается в случае отказа от посылки, неявки на почту или отмены заказа после отправки, так как является фиксированной компенсацией услуг доставки в обе стороны.</li>
<li data-i18n="rules.p3_4" style="margin-bottom:10px">Отправка осуществляется в день внесения аванса/оплаты (до 16:00) либо на следующий рабочий день.</li>
</ul>
<h3 data-i18n="rules.h4" style="color:var(--accent-red);font-family:var(--font-mono);border-bottom:1px solid #333;padding-bottom:10px;margin-top:25px">[ 4. ГАРАНТИИ И УСЛОВИЯ ВОЗВРАТА (ВАЖНО!) ]</h3>
<ul style="padding-left:20px">
<li data-i18n="rules.p4_1" style="margin-bottom:10px"><b>Осмотр на почте обязателен.</b> Оплата наложенного платежа и забор посылки подтверждают, что вещь проверена на соответствие замерам, описанию, и претензии отсутствуют.</li>
<li data-i18n="rules.p4_2" style="margin-bottom:10px"><span style="color:var(--accent-red);font-weight:700">ТОВАРЫ «БЕЗ ВОЗВРАТА» И «ПРЕДЛОЖКА»:</span> комиссионные сделки между физлицами. После оплаты наложенного платежа и выноса посылки с почты возврат и обмен невозможен ни при каких условиях, так как деньги выплачиваются владельцу вещи.</li>
<li data-i18n="rules.p4_3" style="margin-bottom:10px"><span style="color:var(--accent-green);font-weight:700">ТОВАРЫ С БЕЙДЖЕМ «ВОЗВРАТ 14 ДНЕЙ»:</span> возврат архивных вещей магазина возможен в течение 14 дней строго при наличии бирок магазина и без следов носки. Доставку оплачивает покупатель.</li>
</ul>
<h3 data-i18n="rules.h5" style="color:var(--accent-green);font-family:var(--font-mono);border-bottom:1px solid #333;padding-bottom:10px;margin-top:25px">[ 5. ПРАВИЛА ДЛЯ ПРОДАВЦОВ (DROP_ITEM) ]</h3>
<ul style="padding-left:20px">
<li data-i18n="rules.p5_1" style="margin-bottom:10px"><b>Указание точных замеров обязательно:</b> в поле размера/описания продавец обязан сразу указать ключевые параметры вещи (длина, ширина в груди/талии и т.д.).</li>
<li data-i18n="rules.p5_2" style="margin-bottom:10px">Фразы «замеры в ЛС», любые ссылки на соцсети и сторонние контакты строго запрещены. Заявки без замеров или с нарушениями отклоняются без предупреждения.</li>
<li data-i18n="rules.p5_3" style="margin-bottom:10px">Комиссия платформы — <b>8%</b> от продажи (мин. 30 грн, макс. 400 грн за единицу). Все расчеты ведутся строго через реквизиты NISHA.</li>
<li data-i18n="rules.p5_4" style="margin-bottom:10px">Выплата продавцу переводится на карту в течение <b>24 часов</b> после того, как покупатель осмотрел и забрал посылку на почте.</li>
<li data-i18n="rules.p5_5" style="margin-bottom:10px">В случае отправки подделки (реплики) или сокрытия дефектов продавец обязан полностью оплатить доставку в обе стороны, иначе получает вечный бан (BANNED).</li>
</ul>`;

function ensureRulesContentRendered() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const bodyEl = document.getElementById('rulesContentBody') || document.querySelector('#rulesModal .rules-content');
    if (!bodyEl) return;
    if (bodyEl.dataset && bodyEl.dataset.rulesHydrated === '1') return;
    if (!bodyEl.innerHTML || !bodyEl.innerHTML.trim()) {
        bodyEl.innerHTML = RULES_CONTENT_HTML;
    }
    if (bodyEl.dataset) bodyEl.dataset.rulesHydrated = '1';
    invokeAction('updateContentLanguage');
}

function checkRules() {
    if (!storage || !storage.get('nisha_rules_accepted')) {
        setTimeout(() => {
            if (!storage || !storage.get('nisha_rules_accepted')) {
                showRulesModal();
            }
        }, 550);
    }
}

function showRulesModal() {
    ensureRulesContentRendered();
    openModal('rulesModal');
}

const LEGAL_DOC_SPECS = {
    shipping: {
        windowTitle: 'SHIPPING_PAYMENT.TXT',
        titleColor: 'var(--accent-green)',
        sections: [
            { h: 'h1', items: ['p1_1', 'p1_2', 'p1_3', 'p1_4'] },
            { h: 'h2', items: ['p2_1', 'p2_2', 'p2_3'] },
            { h: 'h3', items: ['p3_1', 'p3_2'] },
            { h: 'h4', items: ['p4_1', 'p4_2'] }
        ]
    },
    return: {
        windowTitle: 'RETURN_POLICY.TXT',
        titleColor: 'var(--accent-red)',
        sections: [
            { h: 'h1', items: ['p1_1', 'p1_2'] },
            { h: 'h2', items: ['p2_1', 'p2_2', 'p2_3'] },
            { h: 'h3', items: ['p3_1', 'p3_2'], headingColor: 'var(--accent-red)' },
            { h: 'h4', items: ['p4_1', 'p4_2'] }
        ]
    },
    privacy: {
        windowTitle: 'PRIVACY_POLICY.TXT',
        titleColor: 'var(--accent-green)',
        sections: [
            { h: 'h1', items: ['p1_1', 'p1_2'] },
            { h: 'h2', items: ['p2_1', 'p2_2', 'p2_3'] },
            { h: 'h3', items: ['p3_1', 'p3_2'] },
            { h: 'h4', items: ['p4_1', 'p4_2'] }
        ]
    }
};

function buildLegalDocHtml(docKey) {
    const spec = LEGAL_DOC_SPECS[docKey];
    if (!spec) return '';
    const prefix = `legal_docs.${docKey}`;
    const sectionsHtml = spec.sections.map((sec) => {
        const hColor = sec.headingColor || 'var(--accent-green)';
        const itemsHtml = sec.items
            .map((pKey) => `<li data-i18n="${prefix}.${pKey}" style="margin-bottom:10px"></li>`)
            .join('');
        return `
<h3 data-i18n="${prefix}.${sec.h}" style="color:${hColor};font-family:var(--font-mono);border-bottom:1px solid #333;padding-bottom:10px;margin-top:25px"></h3>
<ul style="padding-left:20px">${itemsHtml}</ul>`;
    }).join('');

    return `<p style="color:var(--accent-yellow);font-family:var(--font-mono);font-size:16px;font-weight:700;margin-top:0" data-i18n="${prefix}.title"></p>${sectionsHtml}`;
}

function openLegalDocModal(docType) {
    const docKey = Object.hasOwn(LEGAL_DOC_SPECS, docType) ? docType : 'shipping';
    const spec = LEGAL_DOC_SPECS[docKey];
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

    const titleEl = document.getElementById('legalDocModalTitle');
    const bodyEl = document.getElementById('legalDocContentBody');
    if (titleEl) {
        titleEl.textContent = spec.windowTitle;
        titleEl.setAttribute('data-i18n', `legal_docs.${docKey}.window_title`);
        titleEl.style.color = spec.titleColor;
    }
    if (bodyEl) {
        bodyEl.innerHTML = buildLegalDocHtml(docKey);
        bodyEl.scrollTop = 0;
    }
    invokeAction('updateContentLanguage');
    openModal('legalDocModal');
}

function acceptRules() {
    if (storage) storage.set('nisha_rules_accepted', 'true');
    executeCloseModal('rulesModal');
    if (typeof i18next !== 'undefined') {
        showToast(i18next.t('messages.rules_accepted'), 'success');
    }
    
    setTimeout(() => {
        startOnboardingTour();
    }, 450); 
}

// === EASTER EGG ===
function triggerEasterEgg() {
    window.isHacked = true;
    const overlay = document.getElementById('glitchOverlay');
    
    if (overlay) {
        const msgEl = document.getElementById('glitchMessage');
        if (msgEl) {
            const secretMsg = tSafe('messages.secret_discount_applied', 'Секретная скидка -10% активирована');
            msgEl.innerHTML = `SYSTEM OVERRIDE<br>[ ACCESS GRANTED ]<br><span style='font-size: 20px; color:#fff; font-family: Tahoma;'>${secretMsg}</span>`;
        }
        overlay.style.display = 'flex';
        setTimeout(() => { 
            overlay.style.display = 'none'; 
        }, 2500);
    }
    
    applyFilters(); 
    
    const activeCart = getActiveCart();
    activeCart.forEach(item => { 
        item.price = Math.floor(item.price * 0.9); 
    });
    if (storage && typeof storage.setJSON === 'function') storage.setJSON('nisha_cart', activeCart);
    syncCartToServer();
    updateCartUI();
}

// === ПРИВАТНАЯ АНАЛИТИКА (PLAUSIBLE / POSTHOG) И ВИЗУАЛЬНЫЙ РЕТРО-СЧЕТЧИК WIN95 ===
let _hitCounterStarted = false;
async function initHitCounter() {
    if (_hitCounterStarted) return;
    _hitCounterStarted = true;
    initAnalytics();

    const counterEl = document.getElementById('hitCounterValue');

    try {
        let visitorId = storage ? storage.get('nisha_visitor_id') : null;
        if (!visitorId) {
            visitorId = 'user_' + generateShortId(9);
            if (storage) storage.set('nisha_visitor_id', visitorId);
        }
        window.clientFingerprint = visitorId;
        if (typeof globalThis !== 'undefined') globalThis.clientFingerprint = visitorId;

        const todayDate = new Date().toISOString().slice(0, 10);
        const lastVisitDate = storage ? storage.get('nisha_last_visit_date') : null;
        const isNewVisitToday = (lastVisitDate !== todayDate);

        if (isNewVisitToday) {
            track('Daily Unique Visit', { date: todayDate });
        }

        if (!counterEl) return;

        const cachedCount = (storage ? storage.get('nisha_last_hit_count', '0') : '0') || '0';
        if (Number(cachedCount) > 0) counterEl.textContent = String(cachedCount).padStart(5, '0').split('').join(' ');

        const data = await apiClient.post('/api/hit', {
            date: todayDate,
            countAsNew: isNewVisitToday
        }, { timeout: 5500, retries: 1, dedupe: true });

        if (data && data.success && data.count !== undefined) {
            if (isNewVisitToday && storage) {
                storage.set('nisha_last_visit_date', todayDate);
            }
            
            if (storage) {
                storage.set('nisha_last_hit_count', data.count);
            }
            
            const strCount = data.count.toString().padStart(5, '0');
            counterEl.textContent = strCount.split('').join(' ');
        }
    } catch (err) {
        console.warn("Счетчик работает в оффлайн-режиме (Сервер спит или нет сети):", err.message);
    }
}


// === ЖИВОЙ СЧЕТЧИК СИМВОЛОВ ДЛЯ ПРЕДЛОЖКИ ===
function updateCharCount(textarea) {
    const label = document.getElementById('descLabel');
    if (!label) return;
    
    const charCount = getGraphemeCount(textarea.value);
    const remaining = 250 - charCount;
    const originalText = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
        ? i18next.t('propose.desc_label', { defaultValue: 'ОПИСАНИЕ И ДЕФЕКТЫ (ДО 250 СИМВОЛОВ):' })
        : 'ОПИСАНИЕ И ДЕФЕКТЫ (ДО 250 СИМВОЛОВ):';
    
    label.textContent = originalText.replace('250', remaining);
    label.style.color = remaining <= 0 ? 'var(--accent-red)' : 'var(--accent-green)';
}

// === ГОРЯЧИЕ КЛАВИШИ И НАВИГАЦИЯ С КЛАВИАТУРЫ ===
let lastTextareaEnterTime = 0;
let lastTextareaTarget = null;

document.addEventListener('keydown', function(e) {
    const isCtrlK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK');
    const isSlash = (e.key === '/' || (e.code === 'Slash' && !e.shiftKey)) && !e.ctrlKey && !e.metaKey && !e.altKey;

    if (isCtrlK || isSlash) {
        const activeEl = document.activeElement;
        const tag = activeEl ? activeEl.tagName : '';
        const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (activeEl && activeEl.isContentEditable);

        if (!(isSlash && isEditing)) {
            const hasOpenModal = document.querySelector('.modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
            if (!hasOpenModal || isCtrlK) {
                const searchInput = document.getElementById('mainSearch');
                if (searchInput && activeEl !== searchInput) {
                    e.preventDefault();
                    if (hasOpenModal && typeof closeModal === 'function') {
                        if (hasOpenModal.id === 'productModal') closeModal('productModal');
                    }
                    invokeAction('playSound', 'menu', { kind: 'ui' }); searchInput.focus();
                    searchInput.select();
                    const rect = searchInput.getBoundingClientRect();
                    if (rect.top < 0 || rect.bottom > window.innerHeight) {
                        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
        }
    }

    if (e.key !== 'Enter') {
        lastTextareaEnterTime = 0;
        lastTextareaTarget = null;
    }

    if (e.key === 'Enter') {
        const activeEl = document.activeElement;
        if (!activeEl) return;

        if (activeEl.id === 'promoInput') {
            e.preventDefault();
            invokeAction('applyPromoCode');
            return;
        }

        if (activeEl.id === 'ordersSearchPhone') {
            e.preventDefault();
            invokeAction('fetchMyOrders');
            return;
        }

        // В многострочном поле (textarea): быстрый двойной Enter переводит фокус на следующее поле формы
        if (activeEl.tagName === 'TEXTAREA') {
            if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const now = Date.now();
                if (activeEl === lastTextareaTarget && (now - lastTextareaEnterTime) < 450) {
                    e.preventDefault();
                    lastTextareaEnterTime = 0;
                    lastTextareaTarget = null;

                    // Убираем перевод строки, вставленный первым нажатием Enter
                    const pos = typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : activeEl.value.length;
                    const val = activeEl.value;
                    if (pos > 0 && val.charAt(pos - 1) === '\n') {
                        activeEl.value = val.slice(0, pos - 1) + val.slice(pos);
                        const newPos = pos - 1;
                        try { activeEl.setSelectionRange(newPos, newPos); } catch {}
                    } else if (val.endsWith('\n')) {
                        activeEl.value = val.slice(0, -1);
                    }

                    try {
                        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
                    } catch {}
                    if (typeof updateCharCount === 'function') {
                        updateCharCount(activeEl);
                    }

                    const form = activeEl.closest('.form-layout') || activeEl.closest('.auth-fields') || activeEl.closest('.modal-window');
                    if (form) {
                        const isVisible = (el) => {
                            if (!el || el.disabled || el.type === 'hidden') return false;
                            if (el.style && el.style.display === 'none') return false;
                            if (el.closest && el.closest('[style*="display: none"]')) return false;
                            return true;
                        };
                        const focusables = Array.from(form.querySelectorAll('input, textarea, button')).filter(isVisible);
                        const currentIndex = focusables.indexOf(activeEl);
                        if (currentIndex > -1 && currentIndex < focusables.length - 1) {
                            const nextEl = focusables[currentIndex + 1];
                            nextEl.focus();
                            if (typeof nextEl.select === 'function' && nextEl.tagName === 'INPUT') {
                                try { nextEl.select(); } catch {}
                            }
                            if (typeof nextEl.scrollIntoView === 'function') {
                                const rect = nextEl.getBoundingClientRect();
                                if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                    nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }
                            }
                        }
                    }
                    return;
                } else {
                    lastTextareaEnterTime = now;
                    lastTextareaTarget = activeEl;
                    activeEl.addEventListener('blur', () => {
                        lastTextareaEnterTime = 0;
                        lastTextareaTarget = null;
                    }, { once: true });
                }
            } else {
                lastTextareaEnterTime = 0;
                lastTextareaTarget = null;
            }
            return;
        }

        if (activeEl.tagName === 'INPUT') {
            if (e.defaultPrevented) return;
            if (activeEl.id === 'propMinBargainPrice') {
                e.preventDefault();
                invokeAction('confirmPropBargainInput');
                return;
            }
            if (activeEl.id === 'inlineBargainPriceInput') {
                e.preventDefault();
                invokeAction('submitInlineBargainOffer');
                return;
            }
            if (activeEl.id === 'bargainPriceInput') {
                e.preventDefault();
                invokeAction('submitBargainOffer');
                return;
            }
            e.preventDefault();
            const form = activeEl.closest('.form-layout') || activeEl.closest('.auth-fields') || activeEl.closest('.modal-window');
            if (form) {
                const isVisible = (el) => {
                    if (!el || el.disabled || el.type === 'hidden') return false;
                    if (el.style && el.style.display === 'none') return false;
                    if (el.closest && (el.closest('[style*="display: none"]') || el.closest('[style*="display:none"]'))) return false;
                    if (el.id === 'btnTogglePropBargain' || el.id === 'btnCancelPropBargain' || el.id === 'btnConfirmPropBargain' || el.id === 'inlineBargainCancelBtn') return false;
                    return true;
                };
                const focusables = Array.from(form.querySelectorAll('input, textarea, button')).filter(isVisible);
                const currentIndex = focusables.indexOf(activeEl);
                if (currentIndex > -1 && currentIndex < focusables.length - 1) {
                    const nextEl = focusables[currentIndex + 1];
                    nextEl.focus();
                    if (typeof nextEl.select === 'function' && nextEl.tagName === 'INPUT') {
                        try { nextEl.select(); } catch {}
                    }
                    if (typeof nextEl.scrollIntoView === 'function') {
                        const rect = nextEl.getBoundingClientRect();
                        if (rect.top < 0 || rect.bottom > window.innerHeight) {
                            nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }
                }
            }
        }
    }

    const pModal = document.getElementById('productModal');
    if (pModal && (pModal.style.display === 'flex' || pModal.style.display === 'block')) {
        const activeTag = document.activeElement?.tagName;
        const isEditingField = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || Boolean(document.activeElement?.isContentEditable);
        const hasBlockingOverlay = Boolean(
            document.querySelector('.pswp--open, .terminal-modal-overlay') ||
            (() => {
                const bm = document.getElementById('bargainModal');
                return bm && (bm.style.display === 'flex' || bm.style.display === 'block');
            })()
        );
        if (!isEditingField && !hasBlockingOverlay) {
            if (e.key === 'ArrowLeft') invokeAction('moveSlide', -1);
            else if (e.key === 'ArrowRight') invokeAction('moveSlide', 1);
        }
    }
});

registerActions({
    tryShowBroadcast,
    checkPendingBroadcast,
    checkRules,
    showRulesModal,
    'show-rules': showRulesModal,
    openLegalDocModal,
    'open-legal-modal': openLegalDocModal,
    acceptRules,
    'accept-rules': acceptRules,
    triggerEasterEgg,
    initHitCounter,
    updateCharCount
});
if (typeof window !== 'undefined') {
    window.initHitCounter = initHitCounter;
    window.openLegalDocModal = openLegalDocModal;
}
