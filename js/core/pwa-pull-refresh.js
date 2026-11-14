// ==========================================
// NISHA PWA STANDALONE PULL-TO-REFRESH MODULE
// ==========================================

/**
 * Resolves localized pull-to-refresh labels with offline fallback.
 * @param {'refresh'|'refreshing'} key
 * @returns {string}
 */
function getPwaPullText(key) {
    if (typeof i18next !== 'undefined' && typeof i18next.t === 'function') {
        const val = i18next.t('pwa.' + key);
        if (val && val !== 'pwa.' + key) return val;
    }
    const currentLang = (typeof window !== 'undefined' && window.storage
        ? window.storage.get('nisha_lang')
        : (typeof localStorage !== 'undefined' ? localStorage.getItem('nisha_lang') : 'ua')) || 'ua';
    if (key === 'refreshing') {
        if (currentLang === 'ua') return 'ОНОВЛЕННЯ...';
        if (currentLang === 'en') return 'REFRESHING...';
        return 'ОБНОВЛЕНИЕ...';
    }
    if (currentLang === 'ua') return 'ОНОВИТИ';
    if (currentLang === 'en') return 'REFRESH';
    return 'ОБНОВИТЬ';
}

/**
 * Creates or returns the pull-to-refresh terminal capsule container and child controls.
 * @returns {{container: HTMLElement|null, arrowIcon: Element|null, label: HTMLElement|null}}
 */
function ensurePullRefreshDom() {
    let container = document.getElementById('pwaPullRefresh');
    let arrowIcon = container && typeof container.querySelector === 'function' ? container.querySelector('.pwa-pull-arrow') : null;
    let label = document.getElementById('pwaPullLabel') || (container && typeof container.querySelector === 'function' ? container.querySelector('.pwa-pull-text') : null);

    if (!container && document.body) {
        container = document.createElement('div');
        container.id = 'pwaPullRefresh';
        container.className = 'pwa-pull-refresh';
        container.setAttribute('aria-hidden', 'true');
        container.innerHTML = `
            <div class="pwa-pull-capsule pwa-pull-terminal-box">
                <span class="pwa-pull-bracket">[</span>
                <svg class="pwa-pull-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.9 1 6.5 2.6L21 8"/>
                    <polyline points="21 3 21 8 16 8"/>
                </svg>
                <span id="pwaPullLabel" class="pwa-pull-text" data-i18n="pwa.refresh">ОБНОВИТЬ</span>
                <span class="pwa-pull-cursor"></span>
                <span class="pwa-pull-bracket">]</span>
            </div>
        `;
        if (typeof document.body.prepend === 'function') {
            document.body.prepend(container);
        } else if (typeof document.body.insertBefore === 'function') {
            document.body.insertBefore(container, document.body.firstChild);
        } else if (typeof document.body.appendChild === 'function') {
            document.body.appendChild(container);
        }
        arrowIcon = typeof container.querySelector === 'function' ? container.querySelector('.pwa-pull-arrow') : null;
        label = document.getElementById('pwaPullLabel');
    }

    return { container, arrowIcon, label };
}

/**
 * Checks if touch target belongs to an input, modal, dropdown, or nested scrollable container.
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
function isRestrictedOrScrollableTarget(target) {
    if (!target) return false;

    if (target.closest && target.closest([
        'input', 'textarea', 'select', 'button',
        '.card-slider', '.stories-container',
        '.modal', '.modal-window', '.modal-overlay',
        '.pswp', '.lightbox-overlay',
        '.no-pull', '[data-no-pull]',
        '#liveSearchDropdown', '.live-search-dropdown', '.search-wrapper',
        '.live-search-item', '.search-history-item',
        '.profile-np-dropdown', '.cart-np-dropdown', '.np-dropdown',
        '[data-lenis-prevent]'
    ].join(', '))) {
        return true;
    }

    let node = target;
    while (node && node !== document.body && node !== document.documentElement) {
        if (node.hasAttribute && (node.hasAttribute('data-lenis-prevent') || node.hasAttribute('data-no-pull') || (node.classList && node.classList.contains && node.classList.contains('no-pull')))) {
            return true;
        }
        try {
            if (window.getComputedStyle) {
                const style = window.getComputedStyle(node);
                const oy = style ? style.overflowY : '';
                if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 2) {
                    return true;
                }
            }
        } catch {}
        node = node.parentElement;
    }

    return false;
}

/**
 * Initializes standalone PWA pull-to-refresh gesture with rotating terminal arrow indicator.
 */
export function initPwaPullToRefresh() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const { container, arrowIcon, label } = ensurePullRefreshDom();
    if (!container) return;

    let startY = 0;
    let startX = 0;
    let isPulling = false;
    let isRefreshing = false;
    let hapticDone = false;
    let touchActive = false;
    let currentPullDistance = 0;
    let resetTimeoutId = null;
    let refreshTimeoutId = null;
    const THRESHOLD = 60;
    const MAX_PULL = 85;

    function isEligibleForPull() {
        if (typeof window.isPwaStandalone === 'function') {
            if (!window.isPwaStandalone()) return false;
        } else if (document.documentElement && document.documentElement.classList && !document.documentElement.classList.contains('pwa-standalone')) {
            const isMediaStandalone = (typeof window.matchMedia === 'function') && (
                window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: fullscreen)').matches ||
                window.matchMedia('(display-mode: minimal-ui)').matches
            );
            if (!isMediaStandalone && (!navigator || !navigator.standalone)) return false;
        }

        if (isRefreshing) return false;

        const hasOpenOverlay = Boolean(
            document.querySelector && document.querySelector('.modal.active, .modal-overlay.active, .pswp--open, .lightbox-overlay.active, #orderSuccessOverlay[style*="display: block"], #orderSuccessOverlay[style*="display: flex"]')
        );
        if (hasOpenOverlay) return false;

        const liveSearchDropdown = document.getElementById ? document.getElementById('liveSearchDropdown') : null;
        const isLiveSearchOpen = Boolean(
            (document.body && document.body.classList && document.body.classList.contains && document.body.classList.contains('search-lock')) ||
            (liveSearchDropdown && (
                (typeof liveSearchDropdown.matches === 'function' && liveSearchDropdown.matches(':popover-open')) ||
                (typeof window.isPopoverOpenSafe === 'function' && window.isPopoverOpenSafe(liveSearchDropdown)) ||
                (liveSearchDropdown.style && liveSearchDropdown.style.display === 'block') ||
                (window.getComputedStyle && typeof window.getComputedStyle === 'function' && window.getComputedStyle(liveSearchDropdown) && window.getComputedStyle(liveSearchDropdown).display === 'block')
            ))
        );
        if (isLiveSearchOpen) return false;

        const activeEl = document.activeElement;
        if (activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.tagName === 'SELECT' ||
            activeEl.isContentEditable
        )) {
            return false;
        }

        const hasOpenDropdown = Boolean(
            document.querySelector && document.querySelector('.profile-np-dropdown[style*="display: block"], .cart-np-dropdown[style*="display: block"]')
        );
        if (hasOpenDropdown) return false;

        const top = window.scrollY || (document.documentElement ? document.documentElement.scrollTop : 0) || (document.body ? document.body.scrollTop : 0) || 0;
        return top <= 2;
    }

    function resetPull() {
        if (!container) return;
        container.classList.remove('is-ready', 'is-pulling');
        container.style.transition = 'transform 0.22s ease-out, opacity 0.2s ease-out';
        container.style.transform = 'translateY(-100%)';
        container.style.opacity = '0';
        if (arrowIcon) {
            arrowIcon.style.transition = 'transform 0.22s ease-out';
            arrowIcon.style.transform = 'rotate(0deg)';
        }
        currentPullDistance = 0;
        hapticDone = false;
        if (resetTimeoutId) clearTimeout(resetTimeoutId);
        resetTimeoutId = setTimeout(() => {
            if (!isRefreshing && container) {
                container.style.transition = '';
                if (arrowIcon) arrowIcon.style.transition = '';
            }
        }, 240);
    }

    async function triggerRefresh() {
        if (isRefreshing || !container) return;
        isRefreshing = true;
        if (typeof window.clearSavedFeedScrollState === 'function') {
            window.clearSavedFeedScrollState();
        }

        container.classList.remove('is-ready', 'is-pulling');
        container.classList.add('is-refreshing', 'pwa-pull-spinning');
        container.style.transition = 'transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.2s ease';
        container.style.transform = 'translateY(0%)';
        container.style.opacity = '1';

        if (label) {
            label.textContent = getPwaPullText('refreshing');
            label.setAttribute('data-i18n', 'pwa.refreshing');
        }
        if (arrowIcon) {
            arrowIcon.style.transition = '';
            arrowIcon.style.transform = '';
        }

        const minDelay = typeof sleep === 'function'
            ? sleep(550)
            : new Promise(resolve => setTimeout(resolve, 550));
        const refreshAction = (async () => {
            try {
                if (typeof window.loadAllItems === 'function') {
                    await window.loadAllItems();
                }
            } catch (err) {
                console.warn('[PWA] Ошибка обновления каталога:', err);
            }
        })();

        await Promise.all([refreshAction, minDelay]);

        if (typeof triggerHaptic === 'function') triggerHaptic('success');
        else if (navigator.vibrate) navigator.vibrate(16);

        container.style.transition = 'transform 0.26s ease-in, opacity 0.22s ease-in';
        container.style.transform = 'translateY(-100%)';
        container.style.opacity = '0';

        if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
        refreshTimeoutId = setTimeout(() => {
            if (!container) return;
            container.classList.remove('is-refreshing', 'pwa-pull-spinning');
            if (label) {
                label.textContent = getPwaPullText('refresh');
                label.setAttribute('data-i18n', 'pwa.refresh');
            }
            isRefreshing = false;
            currentPullDistance = 0;
            container.style.transition = '';
            if (arrowIcon) {
                arrowIcon.style.transition = '';
                arrowIcon.style.transform = 'rotate(0deg)';
            }
        }, 280);
    }

    window.addEventListener('touchstart', (e) => {
        if (!isEligibleForPull()) {
            touchActive = false;
            return;
        }

        const target = e.target;
        if (isRestrictedOrScrollableTarget(target)) {
            touchActive = false;
            return;
        }

        const touch = e.touches && e.touches[0];
        if (!touch) return;

        if (resetTimeoutId) {
            clearTimeout(resetTimeoutId);
            resetTimeoutId = null;
        }

        startY = touch.clientY;
        startX = touch.clientX;
        touchActive = true;
        isPulling = false;
        hapticDone = false;
        currentPullDistance = 0;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!touchActive || isRefreshing || !container) return;

        const target = e.target;
        if (isRestrictedOrScrollableTarget(target)) {
            touchActive = false;
            if (isPulling) resetPull();
            return;
        }

        const touch = e.touches && e.touches[0];
        if (!touch) return;

        const diffY = touch.clientY - startY;
        const diffX = touch.clientX - startX;

        if (!isPulling && Math.abs(diffX) > Math.abs(diffY)) {
            touchActive = false;
            return;
        }

        const top = window.scrollY || (document.documentElement ? document.documentElement.scrollTop : 0) || (document.body ? document.body.scrollTop : 0) || 0;
        if (top > 2 && !isPulling) {
            touchActive = false;
            return;
        }

        if (diffY > 6) {
            isPulling = true;
            if (e.cancelable) e.preventDefault();

            currentPullDistance = Math.min(MAX_PULL, (diffY - 6) * 0.45);
            const progress = Math.min(1, currentPullDistance / THRESHOLD);
            const yPercent = -100 + (progress * 100);

            container.classList.add('is-pulling');
            container.style.transition = 'none';
            container.style.transform = `translateY(${yPercent}%)`;
            container.style.opacity = String(Math.min(1, progress * 1.35));

            const deg = progress * 360;
            if (arrowIcon) {
                arrowIcon.style.transition = 'none';
                arrowIcon.style.transform = `rotate(${deg}deg)`;
            }

            const isReady = currentPullDistance >= THRESHOLD;
            if (isReady && !hapticDone) {
                container.classList.add('is-ready');
                if (typeof triggerHaptic === 'function') triggerHaptic('light');
                else if (navigator.vibrate) navigator.vibrate(12);
                hapticDone = true;
            } else if (!isReady && hapticDone) {
                container.classList.remove('is-ready');
                hapticDone = false;
            }
        }
    }, { passive: false });

    const handleTouchEnd = () => {
        if (!touchActive) return;
        touchActive = false;
        if (isPulling) {
            isPulling = false;
            if (currentPullDistance >= THRESHOLD && !isRefreshing) {
                triggerRefresh();
            } else {
                resetPull();
            }
        }
    };

    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    window.__pwaPullRefresh = {
        triggerRefresh,
        resetPull,
        isEligibleForPull,
        isRestrictedOrScrollableTarget,
        getPwaText: getPwaPullText
    };
}
