// ==========================================
// NISHA CATALOG — БЕЙДЖИ ИНФО, БРОАДКАСТ И ОНБОРДИНГ-ТУР
// ==========================================

import { getCatalogStore } from './catalog-state.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeOpenedItem } from '../core/runtime-env.js';

/**
 * Показывает информационную терминальную модалку по клику на бейдж товара.
 * @param {'secure'|'fast'|'bargain'|'refund_no'|'refund_yes'|'drop'} type
 */
export function showBadgeInfo(type) {
    let title = '';
    let text = '';
    const activeItem = getRuntimeOpenedItem();

    if (type === 'secure') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.secure_title', { defaultValue: 'SECURE_PAYMENT.EXE' }) : 'SECURE_PAYMENT.EXE';
        const isReturnable = activeItem && activeItem.is_returnable === true;
        const isDropItem = activeItem && (activeItem.is_drop === true || (activeItem.tags && activeItem.tags.map(t => t.toLowerCase()).includes('drop')));

        if (!isReturnable || isDropItem) {
            const defaultSecureText = 'NISHA выступает гарантом сделки. Вы не рискуете всей суммой.<br><br>Примеряйте вещь на почте: при наложке вы можете отказаться от покупки прямо в отделении.<br><br>После забора посылки домой возврат или обмен невозможен.';
            text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.secure_no_return_text', { defaultValue: defaultSecureText }) : defaultSecureText;
        } else {
            text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.secure_return_text', { defaultValue: 'NISHA выступает гарантом сделки. Ваши деньги надежно защищены.<br><br>Вы можете примерить вещь на почте. Даже если вы забрали её домой, на данный товар действует <b style="color:var(--accent-green);">гарантия возврата и обмена в течение 14 дней</b>.<br><br><i>Обязательное условие возврата: сохранение товарного вида и отсутствие следов носки.</i>' }) : 'NISHA выступает гарантом сделки. Ваши деньги надежно защищены.<br><br>Вы можете примерить вещь на почте. Даже если вы забрали её домой, на данный товар действует <b style="color:var(--accent-green);">гарантия возврата и обмена в течение 14 дней</b>.<br><br><i>Обязательное условие возврата: сохранение товарного вида и отсутствие следов носки.</i>';
        }
    } else if (type === 'fast') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.fast_title', { defaultValue: 'FAST_SHIPPING.SYS' }) : 'FAST_SHIPPING.SYS';
        text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.fast_text', { defaultValue: 'Отправка заказа осуществляется в день оплаты (при подтверждении до 16:00) или на следующий рабочий день.' }) : 'Отправка заказа осуществляется в день оплаты (при подтверждении до 16:00) или на следующий рабочий день.';
    } else if (type === 'bargain') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.bargain_title', { defaultValue: 'BARGAIN_AVAILABLE.SYS' }) : 'BARGAIN_AVAILABLE.SYS';
        const descMatch = activeItem && typeof activeItem.description === 'string' && activeItem.description.match(/\[ТОРГ:?\s*(?:(?:від|от)\s*)?(\d+)/i);
        const minVal = activeItem?.min_bargain_price || (descMatch ? descMatch[1] : null);
        const minText = minVal ? `<br><br>Мінімальна ціна для торгу: <b style="color:var(--accent-green);">${minVal} грн</b>` : '';
        const baseBargainText = (typeof i18next !== 'undefined')
            ? i18next.t('badge_info.bargain_text', { defaultValue: 'Продавець увімкнув можливість торгу для цієї речі. Ви можете запропонувати свою суму за допомогою кнопки <b>«ЗАПРОПОНУВАТИ СВОЮ ЦІНУ»</b>.' })
            : 'Продавець увімкнув можливість торгу для цієї речі. Ви можете запропонувати свою суму за допомогою кнопки <b>«ЗАПРОПОНУВАТИ СВОЮ ЦІНУ»</b>.';
        text = baseBargainText + minText;
    } else if (type === 'refund_no') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.refund_no_title', { defaultValue: 'NO_RETURN_POLICY.LOG' }) : 'NO_RETURN_POLICY.LOG';
        text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.refund_no_text', { defaultValue: '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ ТОВАР НЕ ПОДЛЕЖИТ ВОЗВРАТУ ]</span><br><br>Мы настоятельно просим вас внимательно изучать фото, замеры и описание перед оформлением заказа.<br><br><b style="color:var(--accent-red);">Данная вещь не подлежит возврату или обмену ни при каких условиях.</b>' }) : '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ ТОВАР НЕ ПОДЛЕЖИТ ВОЗВРАТУ ]</span><br><br>Мы настоятельно просим вас внимательно изучать фото, замеры и описание перед оформлением заказа.<br><br><b style="color:var(--accent-red);">Данная вещь не подлежит возврату или обмену ни при каких условиях.</b>';
    } else if (type === 'refund_yes') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.refund_yes_title', { defaultValue: 'RETURN_POLICY.SYS' }) : 'RETURN_POLICY.SYS';
        text = (typeof i18next !== 'undefined') ? i18next.t('badge_info.refund_yes_text', { defaultValue: '<span style="color:var(--accent-green); font-weight:bold; font-size:16px;">[ ДОСТУПЕН ВОЗВРАТ ]</span><br><br>Данный товар подлежит возврату и обмену в течение <b>14 дней</b> с момента покупки, согласно законодательству Украины.<br><br><i>Условие возврата: сохранение товарного вида, всех бирок и отсутствие следов носки.</i>' }) : '<span style="color:var(--accent-green); font-weight:bold; font-size:16px;">[ ДОСТУПЕН ВОЗВРАТ ]</span><br><br>Данный товар подлежит возврату и обмену в течение <b>14 дней</b> с момента покупки, согласно законодательству Украины.<br><br><i>Условие возврата: сохранение товарного вида, всех бирок и отсутствие следов носки.</i>';
    } else if (type === 'drop') {
        title = (typeof i18next !== 'undefined') ? i18next.t('badge_info.drop_title', { defaultValue: 'WARNING: DROP_ITEM' }) : 'WARNING: DROP_ITEM';
        const defaultDropText = '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ ВНИМАНИЕ ]</span><br><span style="color:#fff;">Вещь от стороннего продавца. NISHA — гарант сделки.</span><br><br>Осмотр и примерка — строго на «Новой Почте» (при наложке остаток оплачивается после проверки).<br><br>После забора посылки возврат невозможен: сделка считается закрытой, а деньги сразу переводятся владельцу.';
        text = (typeof i18next !== 'undefined') ? (i18next.t('badge_info.drop_desc') || i18next.t('badge_info.drop_text') || defaultDropText) : defaultDropText;
    }

    const btnText = (typeof i18next !== 'undefined') ? i18next.t('badge_info.btn_understood', { defaultValue: '[ ПОНЯТНО ]' }) : '[ ПОНЯТНО ]';
    if (typeof showTerminalModal === 'function') {
        showTerminalModal(title, text, btnText, null);
    }
}

/**
 * Безопасный показ отложенного системного броадкаста.
 */
export function flushPendingBroadcast() {
    if (!window.pendingBroadcastHtml || typeof tryShowBroadcast !== 'function') return;
    const bHtml = window.pendingBroadcastHtml;
    const bId = window.pendingBroadcastId;
    window.pendingBroadcastHtml = null;
    window.pendingBroadcastId = null;

    if (!bHtml || bHtml === 'null' || (typeof bHtml === 'string' && !bHtml.trim())) return;

    setTimeout(() => {
        const closeBtnText = (typeof i18next !== 'undefined' && i18next.t('propose.btn_close')) || '[ ЗАКРЫТЬ ]';
        tryShowBroadcast('SYSTEM_BROADCAST.MSG', bHtml, closeBtnText, () => {
            if (bId && window.storage) window.storage.set('nisha_last_broadcast', bId);
        });
    }, 3000);
}

/**
 * Запускает интерактивный онбординг-тур (Driver.js) для новых пользователей.
 * @returns {Promise<void>}
 */
export async function startOnboardingTour() {
    const store = getCatalogStore();
    if (!store || !store.get('nisha_rules_accepted') || store.get('nisha_tour_done')) return;

    const initScroll = window.scrollY || document.documentElement.scrollTop || 0;
    if (initScroll > 30) {
        store.set('nisha_tour_done', 'true');
        flushPendingBroadcast();
        return;
    }

    if (typeof window.driver === 'undefined') {
        try {
            const [driverMod] = await Promise.all([
                import('driver.js'),
                import('driver.js/dist/driver.css')
            ]);
            const driverFn = driverMod.driver || driverMod.default || driverMod;
            window.driver = { js: { driver: driverFn } };
            startOnboardingTour();
        } catch (err) {
            console.warn('[Driver.js] Local load failed, falling back to CDN:', err);
            if (hasAction('loadExternalStyle')) invokeAction('loadExternalStyle', 'https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.css');
            if (typeof loadExternalScript === 'function') {
                loadExternalScript('https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.js.iife.js').then(() => {
                    startOnboardingTour();
                }).catch(() => {});
            }
        }
        return;
    }

    const checkAndRun = setInterval(() => {
        const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some(el => {
            return hasAction('isElementVisible')
                ? invokeAction('isElementVisible', el)
                : window.getComputedStyle(el).display === 'flex';
        });

        const toastContainer = document.getElementById('toastContainer');
        const anyToastVisible = toastContainer && toastContainer.children.length > 0;

        if (anyModalOpen || anyToastVisible) return;

        const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        if (currentScrollY > 30) {
            clearInterval(checkAndRun);
            store.set('nisha_tour_done', 'true');
            flushPendingBroadcast();
            return;
        }

        clearInterval(checkAndRun);
        const isMobile = window.innerWidth <= 900;
        const firstStar = document.querySelector('.item-card .fav-star');
        const firstCartBtn = document.querySelector('.item-card .grid-cart-btn');

        const activeSteps = [];
        activeSteps.push({ element: '.search-wrapper', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.search_title') : 'ПОИСК', description: typeof i18next !== 'undefined' ? i18next.t('tour.search_desc') : 'Поиск по вещам' } });

        if (isMobile) {
            activeSteps.push(
                { element: '.mobile-profile-link', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prof_title') : 'ПРОФИЛЬ', description: typeof i18next !== 'undefined' ? i18next.t('tour.prof_desc') : 'Личный кабинет' } },
                { element: '#mobileFilterBtn', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.filt_title') : 'ФИЛЬТРЫ', description: typeof i18next !== 'undefined' ? i18next.t('tour.filt_desc') : 'Фильтры каталога' } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.star_title') : 'ИЗБРАННОЕ', description: typeof i18next !== 'undefined' ? i18next.t('tour.star_desc') : 'Сохраняйте вещи' } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_title') : 'КОРЗИНА', description: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_desc') : 'Добавление в заказ' } });
            activeSteps.push({ element: '.fab-propose', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prop_title') : 'ПРЕДЛОЖКА', description: typeof i18next !== 'undefined' ? i18next.t('tour.prop_desc') : 'Продать свою вещь' } });
            activeSteps.push({ element: '#cartInfoWrapper', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.cart_title') : 'КОРЗИНА', description: typeof i18next !== 'undefined' ? i18next.t('tour.cart_desc') : 'Ваши покупки' } });
        } else {
            activeSteps.push(
                { element: '#authBox', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prof_title') : 'ПРОФИЛЬ', description: typeof i18next !== 'undefined' ? i18next.t('tour.prof_desc') : 'Авторизация' } },
                { element: '.sidebar', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.filt_title') : 'ФИЛЬТРЫ', description: typeof i18next !== 'undefined' ? i18next.t('tour.filt_desc') : 'Фильтры каталога' } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.star_title') : 'ИЗБРАННОЕ', description: typeof i18next !== 'undefined' ? i18next.t('tour.star_desc') : 'Сохраняйте вещи' } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_title') : 'КОРЗИНА', description: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_desc') : 'Добавление в заказ' } });
            activeSteps.push({ element: '.fab-propose', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prop_title') : 'ПРЕДЛОЖКА', description: typeof i18next !== 'undefined' ? i18next.t('tour.prop_desc') : 'Продать свою вещь' } });
        }

        const driverFn = (window.driver && window.driver.js && window.driver.js.driver) || (window.driver && window.driver.driver) || (typeof window.driver === 'function' ? window.driver : null);
        if (!driverFn) return;

        const driverObj = driverFn({
            showProgress: true,
            overlayColor: 'transparent',
            overlayOpacity: 0,
            nextBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.next') : 'Далее',
            prevBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.prev') : 'Назад',
            doneBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.done') : 'Готово',
            steps: activeSteps,
            onDestroyStarted: () => {
                store.set('nisha_tour_done', 'true');
                driverObj.destroy();
                window._activeDriverTour = null;
                flushPendingBroadcast();
            }
        });
        window._activeDriverTour = driverObj;
        driverObj.drive();
    }, 500);
}

registerActions({
    showBadgeInfo,
    flushPendingBroadcast,
    startOnboardingTour
});

if (typeof window !== 'undefined') {
    // Защита: если юзер при входе сразу начинает скроллить страницу — не показываем подсказки онбординга
    const _tourStore = getCatalogStore();
    if (!_tourStore || !_tourStore.get('nisha_tour_done')) {
        const tourScrollCtrl = new AbortController();
        const onEarlyTourScroll = function() {
            const y = window.scrollY || document.documentElement.scrollTop || 0;
            if (y > 30) {
                tourScrollCtrl.abort();
                const s = getCatalogStore();
                if (s && !s.get('nisha_tour_done')) {
                    s.set('nisha_tour_done', 'true');
                    if (window._activeDriverTour) {
                        try { window._activeDriverTour.destroy(); } catch {}
                        window._activeDriverTour = null;
                    }
                    flushPendingBroadcast();
                }
            }
        };
        window.addEventListener('scroll', onEarlyTourScroll, { passive: true, signal: tourScrollCtrl.signal });
    }
}
