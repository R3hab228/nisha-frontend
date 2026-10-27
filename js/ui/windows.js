// ==========================================
// NISHA UI WINDOWS & MODALS (Оконная система Win95)
// ==========================================

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
        if (window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' && currentOpenedItem)) {
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
window.isUserInProductFeed = isUserInProductFeed;

// 2. Универсальное открытие модального окна
function openModal(id) {
    if (typeof lenis !== 'undefined' && window.stopLenis) window.stopLenis();
    const modal = document.getElementById(id);
    if (!modal) return;
    if (typeof document !== 'undefined' && document.activeElement) {
        modal._returnFocusElement = document.activeElement;
    }
    if (modal._closeTimer) {
        clearTimeout(modal._closeTimer);
        modal._closeTimer = null;
    }
    modal.inert = false;
    modal.removeAttribute('inert');
    modal.classList.remove('closing');
    modal.style.pointerEvents = '';
    modal.setAttribute('aria-hidden', 'false');
    const win = modal.querySelector('.modal-window');
    if (win) {
        win.style.transform = '';
        win.style.opacity = '';
        win.style.transition = '';
        win.style.animation = '';
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
window.openModal = openModal;

// 3. Закрытие модального окна по крестику (с защитой данных)
function closeModal(id, e) { 
    const evt = e || (typeof window !== 'undefined' && window.event);
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
        
        const autoTg = (typeof getUserTg === 'function' ? getUserTg() : '').trim();
        const autoPhone = (typeof getUserPhone === 'function' ? getUserPhone() : '').trim();
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
            if (typeof showConfirmTerminalModal === 'function') {
                showConfirmTerminalModal(
                    'WARNING_DATA_LOSS.SYS', 
                    'У вас есть несохраненные данные. Если вы закроете окно, форма полностью очистится.', 
                    '[ ЗАКРЫТЬ ]', 
                    '[ ОТМЕНА ]', 
                    () => { 
                        if (typeof resetProposalForm === 'function') resetProposalForm(); 
                        executeCloseModal(id, evt); 
                    }
                );
                return;
            }
        }
    }
    executeCloseModal(id, evt); // Если защищать не нужно — просто закрываем
}
window.closeModal = closeModal;

// 4. Исполнение плавного закрытия окна с анимацией
function executeCloseModal(id, e) {
    const evt = e || (typeof window !== 'undefined' && window.event);
    if (evt) {
        if (typeof evt.preventDefault === 'function') evt.preventDefault();
        if (typeof evt.stopPropagation === 'function') evt.stopPropagation();
        if (typeof evt.stopImmediatePropagation === 'function') evt.stopImmediatePropagation();
    }
    if (id === 'checkoutModal' && window.otpPollInterval) clearInterval(window.otpPollInterval);
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
        document.body.style.overflow = 'auto';
        if (typeof lenis !== 'undefined' && window.startLenis) window.startLenis();
    }

    // Мгновенная пауза любых видео в закрывающемся окне
    const modalVideos = modal.querySelectorAll('video');
    modalVideos.forEach(v => {
        try { v.pause(); } catch(e) {}
    });

    if (id === 'productModal') {
        document.title = 'NISHA | Underground Store';
        window.currentOpenedItem = null;
        if (typeof currentOpenedItem !== 'undefined') currentOpenedItem = null;
        if (typeof window.resetOpenGraphTags === 'function') window.resetOpenGraphTags();
        try {
            const u = new URL(window.location);
            if (u.searchParams.has('item')) {
                u.searchParams.delete('item');
                window.history.replaceState(null, '', u.pathname + u.search);
            }
        } catch (e) {}
    }

    // Снимаем фокус с дочерних элементов закрывающегося окна перед aria-hidden=true (WAI-ARIA compliance)
    if (typeof document !== 'undefined' && document.activeElement && modal.contains(document.activeElement)) {
        try { document.activeElement.blur(); } catch (e) {}
    }

    modal.classList.add('closing');
    modal.setAttribute('aria-hidden', 'true');
    if (modal._closeTimer) clearTimeout(modal._closeTimer);

    modal._closeTimer = setTimeout(() => {
        modal._closeTimer = null;
        if (!modal.classList.contains('closing')) return;
        modal.style.display = 'none';
        modal.classList.remove('closing');
        modal.style.pointerEvents = '';
        modal.inert = true;
        modal.setAttribute('inert', '');

        const win = modal.querySelector('.modal-window');
        if (win) {
            win.style.transform = '';
            win.style.opacity = '';
            win.style.transition = '';
            win.style.animation = '';
        }
        modal.style.opacity = '';
        modal.style.transition = '';
        modal.style.backgroundColor = '';

        if (modal._returnFocusElement && typeof modal._returnFocusElement.focus === 'function') {
            try { modal._returnFocusElement.focus(); } catch (e) {}
            modal._returnFocusElement = null;
        }

        if (id === 'checkoutModal' && window.otpPollInterval) {
            clearInterval(window.otpPollInterval);
            window.otpPollInterval = null;
        }

        if (!hasOtherOpenModal()) {
            document.body.style.overflow = 'auto';
            if (typeof lenis !== 'undefined' && window.startLenis) window.startLenis();
        }

        // Фоновые задачи (история и рассылки) запускаем безопасно в idle-потоке без фризов UI
        const deferBackgroundTasks = () => {
            if (id === 'productModal' && typeof renderHistory === 'function') {
                renderHistory();
            }
            if (typeof checkPendingBroadcast === 'function') {
                checkPendingBroadcast();
            }
        };

        if ('requestIdleCallback' in window) {
            requestIdleCallback(deferBackgroundTasks, { timeout: 1500 });
        } else {
            setTimeout(deferBackgroundTasks, 300);
        }
    }, 290);
}
window.executeCloseModal = executeCloseModal;

// 5. Мобильный жест: свайп окна вниз для закрытия
function initMobileSwipe() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        const modalWin = overlay.querySelector('.modal-window');
        if (!modalWin || modalWin._swipeBound) return;
        modalWin._swipeBound = true;

        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;
        let isDragging = false;
        let canDrag = false;
        let isGalleryTouch = false;

        modalWin.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 900) return;
            if (e.touches.length > 1) return;
            
            // ЗАЩИТА: Отключаем свайп окна при зуме в PhotoSwipe, вводе текста или специальных областях
            if (document.body.classList.contains('sort-lock') || 
                e.target.closest('.preview-container') || 
                e.target.closest('.pswp') || 
                e.target.closest('.close-btn') || 
                e.target.closest('button') || 
                e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.closest('.rules-content') || 
                e.target.closest('.orders-container') || 
                e.target.closest('#reviewsContainerList')) {
                canDrag = false;
                return;
            }

            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = startX;
            currentY = startY;

            isGalleryTouch = !!e.target.closest('.modal-gallery');
            canDrag = (modalWin.scrollTop <= 0); 
            isDragging = false;

            modalWin.style.transition = 'none';
            overlay.style.transition = 'none';
        }, { passive: true });

        modalWin.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 900 || !canDrag) return;
            if (e.touches.length > 1) return;

            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
            const diffX = Math.abs(currentX - startX);
            const diffY = currentY - startY;

            // Если касание началось на галерее и жест горизонтальный — отдаем управление слайдеру фото
            if (isGalleryTouch && diffX > diffY) {
                canDrag = false;
                isDragging = false;
                modalWin.style.transform = 'translateY(0px)';
                return;
            }

            // Плавное перетягивание шторки вниз
            if (diffY > 8) {
                isDragging = true;
                if (e.cancelable) e.preventDefault(); 
                
                requestAnimationFrame(() => {
                    if (!isDragging) return;
                    modalWin.style.transform = `translateY(${diffY}px)`;
                    let opacity = 1 - (diffY / (window.innerHeight * 0.7));
                    overlay.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(0.15, opacity * 0.95)})`;
                });
            } else if (diffY <= 0) {
                isDragging = false;
                modalWin.style.transform = `translateY(0px)`;
            }
        }, { passive: false });

        const handleTouchFinish = () => {
            if (window.innerWidth > 900) return;
            
            if (isDragging) {
                const diffY = currentY - startY;
                isDragging = false;
                canDrag = false;
                
                // Естественный порог 80px (или быстрый свайп) вместо жестких 150px
                if (diffY > 80) { 
                    if (typeof triggerHaptic === 'function') triggerHaptic('light');
                    closeModal(overlay.id);
                } else {
                    modalWin.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    overlay.style.transition = 'background-color 0.25s ease';
                    modalWin.style.transform = `translateY(0px)`;
                    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
                }
            }
        };

        modalWin.addEventListener('touchend', handleTouchFinish, { passive: true });
        modalWin.addEventListener('touchcancel', handleTouchFinish, { passive: true });
    });
}
window.initMobileSwipe = initMobileSwipe;

// 6. Инициализация клика по фону и защиты скролла
function initWindowOverlayListeners() {
    // Закрытие по клику на темный фон оверлея
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        if (!overlay._overlayBound) {
            overlay._overlayBound = true;
            overlay.addEventListener('click', function(e) {
                if (this.classList.contains('closing')) {
                    if (typeof e.preventDefault === 'function') e.preventDefault();
                    if (typeof e.stopPropagation === 'function') e.stopPropagation();
                    return;
                }
                if (this.id === 'rulesModal') return; 
                if (e.target === this) { 
                    closeModal(this.id, e); 
                }
            });
        }
    });

    // Предотвращение скролла Lenis внутри модальных окон
    document.querySelectorAll('.modal-window, .orders-container').forEach(el => {
        el.setAttribute('data-lenis-prevent', 'true');
    });

    // Подключение мобильного свайпа
    initMobileSwipe();
}

// 7. Универсальное закрытие окон и оверлеев по клавише Escape
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
        if (dropdown && dropdown.style.display === 'block') {
            if (typeof closeSearch === 'function') closeSearch();
            if (searchInput) searchInput.blur();
        }
    }
});

// Автозапуск при готовности DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWindowOverlayListeners);
} else {
    initWindowOverlayListeners();
}
