// ==========================================
// NISHA UI WINDOWS & MODALS (Оконная система Win95)
// ==========================================

// 1. Проверка: находится ли пользователь в обычной ленте товаров (без открытых окон)
function isUserInProductFeed() {
    // 1. Проверяем, открыто ли хоть одно модальное окно на сайте
    const overlays = document.querySelectorAll('.modal-overlay');
    for (let m of overlays) {
        if (m.style.display === 'flex' || m.style.display === 'block') {
            return false;
        }
        const comp = window.getComputedStyle(m);
        if (comp.display !== 'none' && comp.visibility !== 'hidden' && comp.opacity !== '0') {
            return false;
        }
    }
    // 2. Проверяем оверлей успешного заказа
    const successOverlay = document.getElementById('orderSuccessOverlay');
    if (successOverlay && window.getComputedStyle(successOverlay).display !== 'none') {
        return false;
    }
    // 3. Проверяем SweetAlert
    if (document.querySelector('.swal2-container')) {
        return false;
    }
    return true;
}
window.isUserInProductFeed = isUserInProductFeed;

// 2. Универсальное открытие модального окна
function openModal(id) {
    if (typeof lenis !== 'undefined' && window.stopLenis) window.stopLenis();
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
window.openModal = openModal;

// 3. Закрытие модального окна по крестику (с защитой данных)
function closeModal(id) { 
    if (id === 'proposeModal') {
        const files = (window.currentProposalFiles && window.currentProposalFiles.length) || document.getElementById('propFiles')?.files?.length || 0;
        const brand = document.getElementById('propBrand')?.value.trim() || '';
        const size = document.getElementById('propSize')?.value.trim() || '';
        const contact = document.getElementById('propContact')?.value.trim() || '';
        
        // Если юзер ввел хоть что-то — вызываем терминал подтверждения
        if (files > 0 || brand !== '' || size !== '' || contact !== '') {
            if (typeof showConfirmTerminalModal === 'function') {
                showConfirmTerminalModal(
                    'WARNING_DATA_LOSS.SYS', 
                    'У вас есть несохраненные данные. Если вы закроете окно, форма полностью очистится.', 
                    '[ ЗАКРЫТЬ ]', 
                    '[ ОТМЕНА ]', 
                    () => { 
                        if (typeof resetProposalForm === 'function') resetProposalForm(); 
                        executeCloseModal(id); 
                    }
                );
                return;
            }
        }
    }
    executeCloseModal(id); // Если защищать не нужно — просто закрываем
}
window.closeModal = closeModal;

// 4. Исполнение плавного закрытия окна с анимацией
function executeCloseModal(id) {
    if (id === 'checkoutModal' && window.otpPollInterval) clearInterval(window.otpPollInterval);
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const win = modal.querySelector('.modal-window');
    
    if (win) {
        win.style.animation = 'none';
        win.offsetHeight; 
        win.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease';
        if (window.innerWidth > 900) { 
            win.style.transform = 'scale(0.95) translateY(20px)'; 
        } else { 
            win.style.transform = 'translateY(100vh)'; 
        }
        win.style.opacity = '0';
    }

    modal.style.transition = 'background-color 0.3s ease, opacity 0.3s ease';
    modal.style.backgroundColor = 'transparent';
    modal.style.opacity = '0';
    
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; 
        if (typeof lenis !== 'undefined' && window.startLenis) window.startLenis(); 
        
        if (win) { 
            win.style.transform = ''; 
            win.style.opacity = ''; 
            win.style.transition = ''; 
            win.style.animation = ''; 
        }
        modal.style.opacity = ''; 
        modal.style.transition = ''; 
        modal.style.backgroundColor = '';
        
        if (id === 'productModal') { 
            document.title = 'NISHA | Underground Store'; 
            if (typeof renderHistory === 'function') renderHistory(); 
        }
        if (typeof checkPendingBroadcast === 'function') checkPendingBroadcast();
    }, 300);
}
window.executeCloseModal = executeCloseModal;

// 5. Мобильный жест: свайп окна вниз для закрытия
function initMobileSwipe() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        const modalWin = overlay.querySelector('.modal-window');
        if (!modalWin || modalWin._swipeBound) return;
        modalWin._swipeBound = true;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        let canDrag = false;

        modalWin.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 900) return;
            
            // ЗАЩИТА: Отключаем свайп окна при скролле списков, перетаскивании фото или вводе текста
            if (document.body.classList.contains('sort-lock') || 
                e.target.closest('.preview-container') || 
                e.target.closest('.modal-gallery') || 
                e.target.closest('.pswp') || 
                e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.closest('.rules-content') || 
                e.target.closest('.orders-container') || 
                e.target.closest('#reviewsContainerList')) {
                canDrag = false;
                return;
            }

            startY = e.touches[0].clientY;
            canDrag = (modalWin.scrollTop <= 0); 
            isDragging = false;

            modalWin.style.transition = 'none';
            overlay.style.transition = 'none';
        }, { passive: true });

        modalWin.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 900 || !canDrag) return;

            currentY = e.touches[0].clientY;
            const diffY = currentY - startY;

            if (diffY > 0) {
                isDragging = true;
                if (e.cancelable) e.preventDefault(); 
                
                requestAnimationFrame(() => {
                    modalWin.style.transform = `translateY(${diffY}px)`;
                    let opacity = 1 - (diffY / window.innerHeight);
                    overlay.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(0, opacity * 0.95)})`;
                });
            } else {
                isDragging = false;
                modalWin.style.transform = `translateY(0px)`;
            }
        }, { passive: false });

        modalWin.addEventListener('touchend', () => {
            if (window.innerWidth > 900) return;
            
            if (isDragging) {
                const diffY = currentY - startY;
                isDragging = false;
                canDrag = false;
                
                if (diffY > 150) { 
                    closeModal(overlay.id);
                } else {
                    modalWin.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    overlay.style.transition = 'background-color 0.3s ease';
                    modalWin.style.transform = `translateY(0px)`;
                    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
                }
            }
        });
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
                if (this.id === 'rulesModal') return; 
                if (e.target === this) { 
                    closeModal(this.id); 
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

// 7. Закрытие окон по клавише Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const activeModals = Array.from(document.querySelectorAll('.modal-overlay')).filter(m => {
            const style = window.getComputedStyle(m);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });
        if (activeModals.length > 0) {
            const topModal = activeModals[activeModals.length - 1];
            if (topModal.id !== 'rulesModal') {
                closeModal(topModal.id);
            }
        }
    }
});

// Автозапуск при готовности DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWindowOverlayListeners);
} else {
    initWindowOverlayListeners();
}
