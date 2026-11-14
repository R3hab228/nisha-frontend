// ==========================================
// NISHA UI WINDOWS & MODALS (Оконная система Win95)
// ==========================================

import { invokeAction, registerActions } from '../core/action-registry.js';
import { getRuntimeOpenedItem } from '../core/runtime-env.js';
import { isPopoverOpenSafe } from '../core/helpers-pwa-browser.js';
import { showConfirmTerminalModal } from '../core/helpers-toasts-modals.js';
import {
    attachMobileSwipeToWindow,
    attachModalOverlayInteractions,
    initMobileSwipe,
    ensureFieldVisibleInModal,
    initMobileKeyboardViewport
} from './windows-mobile-viewport.js';

export {
    attachMobileSwipeToWindow,
    attachModalOverlayInteractions,
    initMobileSwipe,
    ensureFieldVisibleInModal,
    initMobileKeyboardViewport
};

// Быстрая проверка видимости DOM-элемента через inline-стили и нативный Element.checkVisibility()
function isElementVisible(el) {
    if (!el) return false;
    if (el.style) {
        if (el.style.display === 'none' || el.style.visibility === 'hidden' || el.style.opacity === '0') {
            return false;
        }
        if (el.style.display === 'flex' || el.style.display === 'block') {
            return true;
        }
    }
    if (typeof el.checkVisibility === 'function') {
        return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    const comp = window.getComputedStyle(el);
    return comp.display !== 'none' && comp.visibility !== 'hidden' && comp.opacity !== '0';
}
window.isElementVisible = isElementVisible;
if (typeof globalThis !== 'undefined') globalThis.isElementVisible = isElementVisible;

// 1. Проверка: находится ли пользователь СТРОГО в обычной ленте товаров (каталоге) без открытых окон и карточек
function isUserInProductFeed() {
    try {
        // 1. Проверяем URL: если открыта прямая ссылка на вещь (?item=...) или модальные действия (?action=...)
        if (typeof window !== 'undefined' && window.location) {
            const params = new URLSearchParams(window.location.search);
            const action = params.get('action');
            if (params.has('item') || action === 'cart' || action === 'reviews') {
                return false;
            }
        }

        // 2. СТРОГАЯ проверка карточки товара (productModal)
        const pModal = document.getElementById('productModal');
        if (isElementVisible(pModal)) return false;
        if (getRuntimeOpenedItem()) {
            return false;
        }

        // 3. Проверяем все модальные окна сайта (.modal-overlay)
        const overlays = document.querySelectorAll('.modal-overlay');
        for (const m of overlays) {
            if (isElementVisible(m)) {
                return false;
            }
        }

        // 3.1. Проверяем мобильные фильтры: не накладываем броадкаст поверх открытых фильтров
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active-mobile')) {
            return false;
        }

        // 4. Проверяем блокировку скролла страницы (включается только при открытии любого модального окна)
        if (document.body && document.body.style && document.body.style.overflow === 'hidden') {
            return false;
        }

        // 5. Проверяем терминальные окна (рассылки, алерты, confirm), чтобы не спамить поверх других окон
        if (document.querySelector('.terminal-modal-overlay')) {
            return false;
        }

        // 6. Проверяем полноэкранный зум фото (PhotoSwipe)
        if (document.querySelector('.pswp--open') || document.querySelector('.pswp.pswp--visible')) {
            return false;
        }

        // 7. Проверяем интерактивный онбординг-тур (Driver.js)
        if (document.querySelector('.driver-popover') || (document.body && document.body.classList.contains('driver-active'))) {
            return false;
        }

        // 8. Проверяем экран успешного заказа
        const successOverlay = document.getElementById('orderSuccessOverlay');
        if (isElementVisible(successOverlay)) {
            return false;
        }

        // 9. Проверяем SweetAlert
        if (document.querySelector('.swal2-container')) {
            return false;
        }

        // 10. Проверяем, что каталог товаров загружен и отображен на экране
        const feed = document.getElementById('itemsGrid');
        if (!feed || feed.children.length === 0) {
            return false;
        }

        return true;
    } catch (e) {
        console.warn('[feed check error]', e);
        return false;
    }
}

// Реестр функций ленивой гидратации модальных окон
const _modalInitializers = new Map();
function registerModalInitializer(id, initFn) {
    if (typeof initFn === 'function') {
        _modalInitializers.set(id, initFn);
    }
}

function triggerModalInitializer(id) {
    const fn = _modalInitializers.get(id);
    if (typeof fn === 'function') {
        _modalInitializers.delete(id); // Выполняем ровно 1 раз при первом открытии
        try { fn(); } catch(e) { console.warn('[ModalInit] Lazy init error:', id, e); }
    }
}

// Перезапуск анимации печатной машинки заголовка с мигающим квадратным курсором (1-в-1 как в ITEM_INFO.EXE)
function triggerModalTypewriter(modalOrId) {
    if (!modalOrId) return;
    const modal = typeof modalOrId === 'string'
        ? (typeof document !== 'undefined' && document.getElementById ? document.getElementById(modalOrId) : null)
        : modalOrId;
    if (!modal) return;

    const twElements = [];
    if (modal.classList && typeof modal.classList.contains === 'function' && modal.classList.contains('typewriter')) {
        twElements.push(modal);
    } else if (typeof modal.querySelectorAll === 'function') {
        try {
            modal.querySelectorAll('.typewriter').forEach(el => twElements.push(el));
        } catch {}
    } else if (typeof modal.querySelector === 'function') {
        try {
            const single = modal.querySelector('.typewriter');
            if (single) twElements.push(single);
        } catch {}
    }

    twElements.forEach(tw => {
        if (!tw || !tw.style) return;
        tw.style.animation = 'none';
        void tw.offsetHeight; // форсируем перерасчет стилей для перезапуска CSS-анимации
        tw.style.animation = '';
    });
}
window.triggerModalTypewriter = triggerModalTypewriter;

// 2. Универсальное открытие модального окна (с ленивой инициализацией)
function openModal(id) {
    invokeAction('stopLenis');
    const modal = document.getElementById(id);
    if (!modal) return;

    // Ленивая привязка интерактивных слушателей и жестов к открываемому окну
    if (typeof attachModalOverlayInteractions === 'function') {
        attachModalOverlayInteractions(modal);
    }

    // Ленивая гидратация содержимого окна при первом открытии
    triggerModalInitializer(id);

    if (typeof document !== 'undefined' && document.activeElement) {
        modal._returnFocusElement = document.activeElement;
    }
    if (modal._closeTimer) {
        clearTimeout(modal._closeTimer);
        modal._closeTimer = null;
    }
    modal.inert = false;
    modal.removeAttribute('inert');
    if (modal.classList && typeof modal.classList.remove === 'function') {
        modal.classList.remove('closing');
    }
    if (modal.classList && typeof modal.classList.add === 'function') {
        modal.classList.add('is-open');
    }
    modal.style.pointerEvents = '';
    modal.setAttribute('aria-hidden', 'false');
    const win = modal.querySelector ? modal.querySelector('.modal-window') : null;
    if (win) {
        win.style.pointerEvents = '';
        win.scrollTop = 0;
        win.style.transform = '';
        win.style.opacity = '';
        win.style.transition = '';
        win.style.animation = '';
    }
    if (!document.body.style.overflow || document.body.style.overflow !== 'hidden') {
        window._preModalScrollY = window.scrollY || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
    }
    modal.style.display = 'flex';
    if (win) win.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    triggerModalTypewriter(modal);
}
window.openModal = openModal;

// 3. Закрытие модального окна по крестику (с защитой данных)
function closeModal(id, e) { 
    const evt = e || (typeof window !== 'undefined' ? window.event : null);
    if (evt) {
        if (typeof evt.preventDefault === 'function') evt.preventDefault();
        if (typeof evt.stopPropagation === 'function') evt.stopPropagation();
        if (typeof evt.stopImmediatePropagation === 'function') evt.stopImmediatePropagation();
    }
    if (id === 'proposeModal') {
        const filesCount = (window.currentProposalFiles && window.currentProposalFiles.length) || document.getElementById('propFiles')?.files?.length || 0;
        const name = document.getElementById('propName')?.value.trim() || '';
        const brand = document.getElementById('propBrand')?.value.trim() || '';
        const size = document.getElementById('propSize')?.value.trim() || '';
        const desc = document.getElementById('propDesc')?.value.trim() || '';
        const cond = document.getElementById('propCond')?.value.trim() || '';
        const price = document.getElementById('propPrice')?.value.trim() || '';
        
        // Проверяем контакты: если поле скрыто (автоподстановка для профиля) или значение совпадает с данными профиля — не считаем ручным вводом
        const contactWrap = document.getElementById('propContactWrapper');
        const isContactVisible = isElementVisible(contactWrap);
        const contactVal = document.getElementById('propContact')?.value.trim() || '';
        
        const autoTg = String(invokeAction('getUserTg') || '').trim();
        const autoPhone = String(invokeAction('getUserPhone') || '').trim();
        const autoBoth = (autoTg && autoPhone) ? `${autoTg} | ${autoPhone}` : '';
        
        const isAutoContact = !isContactVisible || 
                              contactVal === '' || 
                              contactVal === autoBoth || 
                              (autoTg && contactVal === autoTg) || 
                              (autoPhone && contactVal === autoPhone) ||
                              (window._lastProposalContact && contactVal === window._lastProposalContact);
                              
        const hasCustomContact = isContactVisible && !isAutoContact;
        const hasUnsavedData = filesCount > 0 || name !== '' || brand !== '' || size !== '' || desc !== '' || cond !== '' || price !== '' || hasCustomContact;
        
        // Если юзер ввел реальные данные — вызываем терминал подтверждения
        if (hasUnsavedData) {
            const title = (typeof i18next !== 'undefined' && i18next.t('propose.warning_loss_title', { defaultValue: 'WARNING_DATA_LOSS.SYS' })) || 'WARNING_DATA_LOSS.SYS';
            const text = (typeof i18next !== 'undefined' && i18next.t('propose.warning_loss_text', { defaultValue: 'У вас есть несохраненные данные. Если вы закроете окно, форма полностью очистится.' })) || 'У вас есть несохраненные данные. Если вы закроете окно, форма полностью очистится.';
            const closeBtn = (typeof i18next !== 'undefined' && i18next.t('propose.btn_close', { defaultValue: '[ ЗАКРЫТЬ ]' })) || '[ ЗАКРЫТЬ ]';
            const cancelBtn = (typeof i18next !== 'undefined' && i18next.t('propose.btn_cancel', { defaultValue: '[ ОТМЕНА ]' })) || '[ ОТМЕНА ]';
            showConfirmTerminalModal(
                title, 
                text, 
                closeBtn, 
                cancelBtn, 
                () => { 
                    invokeAction('resetProposalForm');
                    executeCloseModal(id, evt); 
                }
            );
            return;
        }
    }
    executeCloseModal(id, evt); // Если защищать не нужно — просто закрываем
}
window.closeModal = closeModal;

// 4. Исполнение плавного закрытия окна с анимацией
function executeCloseModal(id, e) {
    const evt = e || (typeof window !== 'undefined' ? window.event : null);
    if (evt) {
        if (typeof evt.preventDefault === 'function') evt.preventDefault();
        if (typeof evt.stopPropagation === 'function') evt.stopPropagation();
        if (typeof evt.stopImmediatePropagation === 'function') evt.stopImmediatePropagation();
    }
    if (id === 'checkoutModal' && window.otpPollInterval) clearInterval(window.otpPollInterval);
    if (id === 'proposeModal') {
        invokeAction('resetPropBargainState');
    }
    const modal = document.getElementById(id);
    if (!modal) return;

    // Если окно уже в процессе закрытия или скрыто — выходим
    if (modal.classList.contains('closing')) return;
    if (modal.style.display === 'none' && !modal.style.opacity) return;

    // Мгновенная разблокировка скролла (только если нет других открытых модальных окон)
    const hasOtherOpenModal = () => Array.from(document.querySelectorAll('.modal-overlay')).some(m => {
        if (m === modal || m.classList.contains('closing')) return false;
        return m.style.display === 'flex' || m.style.display === 'block';
    });
    if (!hasOtherOpenModal()) {
        document.body.style.overflow = '';
        if (document.documentElement && document.documentElement.style) document.documentElement.style.overflow = '';
        if (typeof window._preModalScrollY === 'number') {
            const curY = window.scrollY || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
            if (Math.abs(curY - window._preModalScrollY) > 5) {
                window.scrollTo({ top: window._preModalScrollY, behavior: 'instant' });
            }
            window._preModalScrollY = null;
        }
        invokeAction('startLenis');
    }

    // Мгновенная пауза любых видео в закрывающемся окне
    const modalVideos = modal.querySelectorAll('video');
    modalVideos.forEach(v => {
        try { v.pause(); } catch {}
    });

    if (id === 'productModal') {
        document.title = 'NISHA | Underground Store';
        window.currentOpenedItem = null;
        window.currentSlide = 0;
        const sw = document.getElementById('sliderWrapper');
        if (sw && sw.style) {
            sw.style.transition = 'none';
            sw.style.transform = 'translateX(0%)';
        }
        const mWin = document.querySelector('#productModal .modal-window');
        if (mWin) {
            mWin.scrollTop = 0;
        }
        invokeAction('resetOpenGraphTags');
        try {
            const u = new URL(window.location);
            if (u.searchParams.has('item')) {
                u.searchParams.delete('item');
                window.history.replaceState(null, '', u.pathname + u.search);
            }
        } catch {}
    }

    // Снимаем фокус с дочерних элементов закрывающегося окна перед aria-hidden=true (WAI-ARIA compliance)
    if (typeof document !== 'undefined' && document.activeElement && modal.contains(document.activeElement)) {
        try { document.activeElement.blur(); } catch {}
    }

    const isSwipeClosing = Boolean(modal._swipeClosing);
    if (modal.classList && typeof modal.classList.remove === 'function') {
        modal.classList.remove('is-open');
    }
    modal.classList.add('closing');
    if (isSwipeClosing) modal.classList.add('swipe-closing');
    modal.style.pointerEvents = 'none';
    modal.setAttribute('aria-hidden', 'true');
    const winClosing = modal.querySelector('.modal-window');
    if (winClosing) {
        winClosing.style.pointerEvents = '';
        if (!isSwipeClosing) {
            winClosing.style.transform = '';
            winClosing.style.transition = '';
        }
    }
    if (id === 'checkoutModal') {
        invokeAction('hideNPDropdowns');
        invokeAction('closePaymentDropdown');
    }
    if (modal._closeTimer) clearTimeout(modal._closeTimer);

    modal._closeTimer = setTimeout(() => {
        modal._closeTimer = null;
        if (!modal.classList.contains('closing')) return;
        modal.style.transition = 'none';
        modal.style.animation = 'none';
        modal.style.display = 'none';
        modal.classList.remove('closing', 'swipe-closing');
        modal._swipeClosing = false;
        modal.style.pointerEvents = '';
        modal.inert = true;
        modal.setAttribute('inert', '');

        const win = modal.querySelector('.modal-window');
        if (win) {
            win.style.pointerEvents = '';
            win.style.transform = '';
            win.style.opacity = '';
            win.style.transition = '';
            win.style.animation = '';
        }
        modal.style.opacity = '';
        modal.style.transition = '';
        modal.style.animation = '';
        modal.style.backgroundColor = '';

        if (modal._returnFocusElement && typeof modal._returnFocusElement.focus === 'function') {
            try { modal._returnFocusElement.focus({ preventScroll: true }); } catch {}
            modal._returnFocusElement = null;
        }

        if (id === 'checkoutModal' && window.otpPollInterval) {
            clearInterval(window.otpPollInterval);
            window.otpPollInterval = null;
        }

        if (!hasOtherOpenModal()) {
            document.body.style.overflow = '';
            if (document.documentElement && document.documentElement.style) document.documentElement.style.overflow = '';
        }

        // Фоновые задачи (история и рассылки) запускаем безопасно в idle-потоке без фризов UI
        const deferBackgroundTasks = () => {
            if (id === 'productModal' && typeof renderHistory === 'function') {
                renderHistory();
            }
            invokeAction('checkPendingBroadcast');
            if (typeof checkPendingBargainNotification === 'function') {
                checkPendingBargainNotification();
            }
        };

        if ('requestIdleCallback' in window) {
            requestIdleCallback(deferBackgroundTasks, { timeout: 1500 });
        } else {
            setTimeout(deferBackgroundTasks, 500);
        }
    }, 190);
}
window.executeCloseModal = executeCloseModal;

// 6. Инициализация клика по фону и защиты скролла
function initWindowOverlayListeners() {
    // Предотвращение скролла Lenis внутри контейнеров
    if (typeof document !== 'undefined' && document.querySelectorAll) {
        document.querySelectorAll('.orders-container').forEach(el => {
            if (typeof el.setAttribute === 'function') el.setAttribute('data-lenis-prevent', 'true');
        });
    }

    // Подключение адаптации под мобильную клавиатуру
    initMobileKeyboardViewport();
}

// 7. Универсальное закрытие окон и оверлеев по клавише Escape
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // 1. Закрытие терминальных окон подтверждения или алертов
        const topTerm = Array.from(document.querySelectorAll('.confirm-modal-overlay, .terminal-modal-overlay, #confirmTerminalModal, #customTerminalAlert')).findLast(isElementVisible);
        if (topTerm) {
            topTerm.remove();
            return;
        }

        // 2. Оверлеи успеха или подсказки email
        const orderSuccess = document.getElementById('orderSuccessOverlay');
        if (isElementVisible(orderSuccess)) {
            orderSuccess.style.display = 'none';
            return;
        }
        const emailPrompt = document.getElementById('emailPromptOverlay');
        if (isElementVisible(emailPrompt)) {
            emailPrompt.style.display = 'none';
            return;
        }

        // 3. Закрываем активное модальное окно (.modal-overlay)
        const topModal = Array.from(document.querySelectorAll('.modal-overlay')).findLast(isElementVisible);
        if (topModal && topModal.id !== 'rulesModal') {
            closeModal(topModal.id);
            return;
        }

        // 4. Закрытие выпадающего списка живого поиска
        const dropdown = document.getElementById('liveSearchDropdown');
        const searchInput = document.getElementById('mainSearch');
        const isLiveSearchOpen = dropdown && (
            (typeof dropdown.matches === 'function' && dropdown.matches(':popover-open')) ||
            isPopoverOpenSafe(dropdown) ||
            dropdown.style.display === 'block'
        );
        if (isLiveSearchOpen) {
            invokeAction('closeSearch');
            if (searchInput) searchInput.blur();
        }
    }
});
}

registerActions({
    isElementVisible,
    isUserInProductFeed,
    registerModalInitializer,
    triggerModalTypewriter,
    openModal,
    closeModal,
    'close-modal': closeModal,
    executeCloseModal,
    attachModalOverlayInteractions,
    initMobileSwipe,
    ensureFieldVisibleInModal,
    initMobileKeyboardViewport
});

// Автозапуск при готовности DOM
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWindowOverlayListeners);
    } else {
        initWindowOverlayListeners();
    }
}
