// ==========================================
// NISHA UI — МОБИЛЬНЫЕ ЖЕСТЫ (SWIPE-TO-DISMISS) И АДАПТАЦИЯ ПОД КЛАВИАТУРУ
// ==========================================

import { invokeAction } from '../core/action-registry.js';

/**
 * Привязывает плавный свайп вниз для закрытия модального окна на мобильных устройствах.
 * @param {HTMLElement} overlay
 */
export function attachMobileSwipeToWindow(overlay) {
    if (!overlay) return;
    const modalWin = overlay.querySelector ? overlay.querySelector('.modal-window') : null;
    if (!modalWin || modalWin._swipeBound) return;
    modalWin._swipeBound = true;

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;
    let isDragging = false;
    let canDrag = false;
    let isGalleryTouch = false;
    let isHeaderTouch = false;

    modalWin.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 900) return;
        if (e.touches && e.touches.length > 1) return;
        if (overlay.classList && overlay.classList.contains('closing')) return;

        // ЗАЩИТА: Отключаем свайп окна при зуме в PhotoSwipe, вводе текста, открытых выпадающих списках НП или открытой клавиатуре
        if ((document.body && document.body.classList && document.body.classList.contains('sort-lock')) ||
            (document.documentElement && document.documentElement.classList && document.documentElement.classList.contains('keyboard-open')) ||
            (e.target && e.target.closest && (
                e.target.closest('.preview-container') ||
                e.target.closest('.pswp') ||
                e.target.closest('.close-btn') ||
                e.target.closest('button') ||
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                e.target.closest('.custom-dropdown') ||
                e.target.closest('#branchDropdown') ||
                e.target.closest('#cityDropdown') ||
                e.target.closest('#paymentDropdown') ||
                e.target.closest('.profile-np-dropdown') ||
                e.target.closest('.branch-item') ||
                e.target.closest('.city-item') ||
                e.target.closest('.np-clear-btn') ||
                e.target.closest('.rules-content') ||
                e.target.closest('.orders-container') ||
                e.target.closest('#reviewsContainerList')
            ))) {
            canDrag = false;
            return;
        }

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = startX;
        currentY = startY;
        lastY = startY;
        lastTime = Date.now();
        velocityY = 0;

        isHeaderTouch = Boolean(e.target && e.target.closest && e.target.closest('.modal-header'));
        isGalleryTouch = Boolean(e.target && e.target.closest && e.target.closest('.modal-gallery'));
        canDrag = isHeaderTouch || (modalWin.scrollTop <= 0);
        isDragging = false;

        // Снимаем forwards-анимацию открытия, чтобы transform следовал за пальцем 1-в-1 без рывков
        modalWin.style.animation = 'none';
        modalWin.style.transition = 'none';
        overlay.style.transition = 'none';
    }, { passive: true });

    modalWin.addEventListener('touchmove', (e) => {
        if (window.innerWidth > 900 || !canDrag) return;
        if (e.touches && e.touches.length > 1) return;

        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
        const now = Date.now();
        const dt = now - lastTime;
        if (dt > 0) {
            velocityY = (currentY - lastY) / dt;
            lastY = currentY;
            lastTime = now;
        }

        const diffX = Math.abs(currentX - startX);
        const diffY = currentY - startY;

        // Если касание началось на галерее и жест горизонтальный — отдаем управление слайдеру фото
        if (!isDragging && isGalleryTouch && diffX > Math.max(6, Math.abs(diffY))) {
            canDrag = false;
            modalWin.style.transform = '';
            return;
        }

        // Если пользователь скроллит карточку вниз (палец идет вверх) или окно уже прокручено не за шапку — не мешаем нативному скроллу
        if (!isDragging && !isHeaderTouch && (diffY < -4 || modalWin.scrollTop > 0)) {
            canDrag = false;
            return;
        }

        // Плавное 1:1 перетягивание шторки за пальцем
        const startThreshold = isHeaderTouch ? 4 : 6;
        if (!isDragging && diffY > startThreshold && diffY > diffX * 1.1) {
            isDragging = true;
        }

        if (isDragging) {
            if (e.cancelable && typeof e.preventDefault === 'function') e.preventDefault();
            const dragY = Math.max(0, diffY);
            modalWin.style.transform = `translate3d(0, ${dragY}px, 0)`;
            const progress = Math.min(1, dragY / Math.max(260, window.innerHeight * 0.55));
            overlay.style.backgroundColor = `rgba(0, 0, 0, ${(0.85 * (1 - progress * 0.8)).toFixed(3)})`;
        }
    }, { passive: false });

    const handleTouchFinish = () => {
        if (window.innerWidth > 900) return;
        if (!isDragging) {
            canDrag = false;
            return;
        }

        const diffY = Math.max(0, currentY - startY);
        const shouldClose = diffY > 95 || (diffY > 36 && velocityY > 0.45);
        isDragging = false;
        canDrag = false;

        if (shouldClose) {
            if (typeof triggerHaptic === 'function') triggerHaptic('light');
            modalWin.style.animation = 'none';
            modalWin.style.transition = 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)';
            modalWin.style.transform = 'translate3d(0, 100%, 0)';
            overlay.style.animation = 'none';
            overlay.style.transition = 'opacity 0.18s ease';
            overlay.style.opacity = '0';
            overlay._swipeClosing = true;
            invokeAction('closeModal', overlay.id);
        } else {
            modalWin.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';
            overlay.style.transition = 'background-color 0.22s ease';
            modalWin.style.transform = 'translate3d(0, 0, 0)';
            overlay.style.backgroundColor = '';
        }
    };

    modalWin.addEventListener('touchend', handleTouchFinish, { passive: true });
    modalWin.addEventListener('touchcancel', handleTouchFinish, { passive: true });
}

/**
 * Ленивая привязка интерактивных слушателей и жестов к модальному окну при первом открытии.
 * @param {HTMLElement} overlay
 */
export function attachModalOverlayInteractions(overlay) {
    if (!overlay || overlay._interactionsAttached) return;
    overlay._interactionsAttached = true;

    // Закрытие по клику на темный фон оверлея
    if (typeof overlay.addEventListener === 'function') {
        overlay.addEventListener('click', function(e) {
            if (this.classList && typeof this.classList.contains === 'function' && this.classList.contains('closing')) {
                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
                return;
            }
            if (this.id === 'rulesModal') return;
            if (e.target === this) {
                invokeAction('closeModal', this.id, e);
            }
        });
    }

    // Предотвращение скролла Lenis внутри открытого модального окна
    const modalWin = overlay.querySelector ? overlay.querySelector('.modal-window') : null;
    if (modalWin && typeof modalWin.setAttribute === 'function') {
        modalWin.setAttribute('data-lenis-prevent', 'true');
    }

    // Подключение мобильного свайпа
    attachMobileSwipeToWindow(overlay);
}

/**
 * Подключает мобильный свайп-закрытие ко всем оверлеям в DOM.
 */
export function initMobileSwipe() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    document.querySelectorAll('.modal-overlay').forEach(attachMobileSwipeToWindow);
}

/**
 * Плавно удерживает сфокусированное поле в видимой области модалки при открытой клавиатуре.
 * @param {HTMLElement} targetEl
 */
export function ensureFieldVisibleInModal(targetEl) {
    if (!targetEl || typeof window === 'undefined' || window.innerWidth > 900) return;

    // Если это поле Новой Почты (город/отделение) — сохраняем совместимость с NP-скроллером
    if (targetEl.id === 'orderCity' || targetEl.id === 'orderBranch' || (targetEl.classList && targetEl.classList.contains('np-input'))) {
        invokeAction('scrollNPFieldIntoModalView', targetEl);
        return;
    }

    const scrollContainer = (targetEl.closest && (targetEl.closest('.form-layout') || targetEl.closest('.modal-window'))) || null;
    if (!scrollContainer) {
        try { targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
        return;
    }

    const cRect = scrollContainer.getBoundingClientRect();
    const elRect = targetEl.getBoundingClientRect();
    const topSafe = 56; // Высота липкой шапки .modal-header (48px) + безопасный отступ (8px)
    const botSafe = 24; // Безопасный отступ над клавиатурой

    const isAbove = elRect.top < (cRect.top + topSafe);
    const isBelow = elRect.bottom > (cRect.bottom - botSafe);

    // Скроллим ТОЛЬКО если поле действительно перекрыто шапкой или клавиатурой.
    if (isAbove) {
        const delta = (cRect.top + topSafe) - elRect.top;
        if (typeof scrollContainer.scrollTo === 'function') {
            scrollContainer.scrollTo({
                top: Math.max(0, scrollContainer.scrollTop - delta),
                behavior: 'smooth'
            });
        } else {
            scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - delta);
        }
    } else if (isBelow) {
        const delta = elRect.bottom - (cRect.bottom - botSafe);
        if (typeof scrollContainer.scrollTo === 'function') {
            scrollContainer.scrollTo({
                top: scrollContainer.scrollTop + delta,
                behavior: 'smooth'
            });
        } else {
            scrollContainer.scrollTop = scrollContainer.scrollTop + delta;
        }
    }
}
if (typeof window !== 'undefined') window.ensureFieldVisibleInModal = ensureFieldVisibleInModal;
if (typeof globalThis !== 'undefined') globalThis.ensureFieldVisibleInModal = ensureFieldVisibleInModal;

let _mobileKbBound = false;

/**
 * Подключает адаптацию высоты модальных окон под VisualViewport / экранную клавиатуру.
 */
export function initMobileKeyboardViewport() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || _mobileKbBound) return;
    _mobileKbBound = true;

    const root = document.documentElement;
    let baselineHeight = window.innerHeight || 0;
    let scrollDebounceTimer = null;
    let vvRafPending = false;
    let lastVvHeight = null;
    let lastKeyboardOpen = null;

    const updateViewportMetrics = (source = '') => {
        if (window.innerWidth > 900) {
            if (root && root.classList) root.classList.remove('keyboard-open');
            return;
        }
        const vv = window.visualViewport;
        const currentH = vv ? vv.height : window.innerHeight;
        const _offsetTop = vv ? vv.offsetTop : 0;

        const activeEl = document.activeElement;
        const isInputFocused = Boolean(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'));
        if (!isInputFocused) {
            baselineHeight = currentH;
        } else if (currentH > baselineHeight) {
            baselineHeight = currentH;
        }
        const refHeight = Math.max(baselineHeight, window.innerHeight || 0);
        const kbDelta = refHeight - currentH;
        const isKeyboardOpen = kbDelta > 90 || (isInputFocused && kbDelta > 40);

        const roundedH = Math.round(currentH);
        if (roundedH !== lastVvHeight) {
            lastVvHeight = roundedH;
            if (root && root.style && typeof root.style.setProperty === 'function') {
                root.style.setProperty('--vv-height', `${roundedH}px`);
            }
        }
        if (isKeyboardOpen !== lastKeyboardOpen) {
            lastKeyboardOpen = isKeyboardOpen;
            if (root && root.classList) {
                root.classList.toggle('keyboard-open', isKeyboardOpen);
            }
        }

        // При скролле пальцем (source === 'scroll') НЕ вызываем авто-скролл, чтобы не блокировать и не дёргать пользователя
        if (isKeyboardOpen && activeEl && isInputFocused && source !== 'scroll') {
            if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
            scrollDebounceTimer = setTimeout(() => {
                scrollDebounceTimer = null;
                if (document.activeElement === activeEl) {
                    ensureFieldVisibleInModal(activeEl);
                }
            }, source === 'focusin' ? 120 : 60);
        }
    };

    const scheduleViewportMetrics = (source = '') => {
        if (source === 'scroll') {
            if (vvRafPending) return;
            vvRafPending = true;
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => {
                    vvRafPending = false;
                    updateViewportMetrics(source);
                });
            } else {
                vvRafPending = false;
                updateViewportMetrics(source);
            }
        } else {
            updateViewportMetrics(source);
        }
    };

    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
        window.visualViewport.addEventListener('resize', () => scheduleViewportMetrics('resize'));
        window.visualViewport.addEventListener('scroll', () => scheduleViewportMetrics('scroll'), { passive: true });
    }
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('resize', () => scheduleViewportMetrics('resize'));
    }

    if (typeof document.addEventListener === 'function') {
        document.addEventListener('focusin', (e) => {
            if (window.innerWidth > 900) return;
            const t = e && e.target;
            if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA')) return;
            updateViewportMetrics('focusin');
        });
        document.addEventListener('focusout', () => {
            if (window.innerWidth > 900) return;
            if (scrollDebounceTimer) {
                clearTimeout(scrollDebounceTimer);
                scrollDebounceTimer = null;
            }
            setTimeout(() => updateViewportMetrics('focusout'), 60);
            setTimeout(() => updateViewportMetrics('focusout'), 200);
            setTimeout(() => {
                const activeEl = document.activeElement;
                const stillFocused = Boolean(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'));
                if (!stillFocused && document.querySelectorAll) {
                    document.querySelectorAll('.modal-window.np-field-active').forEach(mw => {
                        if (mw.classList) mw.classList.remove('np-field-active');
                    });
                }
            }, 300);
        });
    }
}
