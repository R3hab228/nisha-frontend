// ==========================================
// NISHA CORE HELPERS: GLOBAL EVENT DELEGATION & FORM LISTENERS
// Handles [data-action], [data-hover-action], media load/error/canplay, scroll & inputs
// Uses ActionRegistry (`Map`) instead of direct `window.*` coupling.
// ==========================================

import { invokeAction, invokeCompatAction, registerActions } from './action-registry.js';
import { sanitizeHtmlMediaUrl } from './helpers-security-media.js';
import { storage } from './helpers-storage-idb.js';
import { isToastClickShielded, showToast } from './helpers-toasts-modals.js';

function hasActiveModalShield(actionEl) {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return false;
    const hasActiveModal = Array.from(document.querySelectorAll('.modal-overlay')).some(m => {
        if (!m) return false;
        if (m.classList && typeof m.classList.contains === 'function' && m.classList.contains('closing')) return true;
        const disp = m.style ? (m.style.display || '') : '';
        return disp === 'flex' || disp === 'block';
    });
    const successOverlay = typeof document.getElementById === 'function' ? document.getElementById('orderSuccessOverlay') : null;
    const isSuccessActive = successOverlay && (successOverlay.style ? (successOverlay.style.display === 'flex' || successOverlay.style.display === 'block') : false);
    const emailPrompt = typeof document.getElementById === 'function' ? document.getElementById('emailPromptOverlay') : null;
    const isEmailPromptActive = emailPrompt && (emailPrompt.style ? (emailPrompt.style.display === 'flex' || emailPrompt.style.display === 'block') : false);
    const isShieldActive = isSuccessActive || isEmailPromptActive;
    if (!hasActiveModal && !isShieldActive) return false;
    const parentModal = actionEl.closest('.modal-overlay');
    return !parentModal || (parentModal.classList && typeof parentModal.classList.contains === 'function' && parentModal.classList.contains('closing')) || isShieldActive;
}

const SIMPLE_ACTION_MAP = {
    'dismiss-net-error': 'dismissNetError',
    'toggle-question-form': 'toggleQuestionForm',
    'submit-proposal': 'submitProposal',
    'submit-manual-review': 'submitManualReview',
    'skip-auto-review': 'skipAutoReview',
    'submit-auto-review': 'submitAutoReview',
    'submit-support-ticket': 'submitSupportTicket',
    'reset-to-main': 'resetToMain',
    'filter-favorites': 'filterFavorites',
    'open-reviews': 'openReviewsModal',
    'open-orders': 'openOrdersModal',
    'open-profile': 'openProfileModal',
    'clear-search-input': 'clearSearchInput',
    'login-with-google': 'loginWithGoogle',
    'toggle-mobile-sidebar': 'toggleMobileSidebar',
    'toggle-history': 'toggleHistory',
    'open-checkout': 'openCheckoutModal',
    'show-rules': 'showRulesModal',
    'open-support-modal': 'openSupportModalWindow',
    'accept-rules': 'acceptRules',
    'add-to-cart-from-modal': 'addToCartFromModal',
    'cancel-offer-price': 'hideInlineOfferPriceInput',
    'toggle-prop-bargain': 'openPropBargainInput',
    'confirm-prop-bargain': 'confirmPropBargainInput',
    'cancel-prop-bargain': 'hidePropBargainInput',
    'submit-inline-bargain': 'submitInlineBargainOffer',
    'share-item': 'shareItem',
    'generate-and-send-otp': 'generateAndSendOTP',
    'toggle-payment-dropdown': 'togglePaymentDropdown',
    'apply-promo-code': 'applyPromoCode',
    'submit-order': 'submitOrder',
    'fetch-my-orders': 'fetchMyOrders',
    'open-propose-modal': 'openProposeModal'
};

/**
 * Global capture-phase click dispatcher for `[data-action]` triggers.
 * @param {Event} e
 */
export function handleDelegatedAction(e) {
    if (!e || !e.target || typeof e.target.closest !== 'function') return;
    const actionEl = e.target.closest('[data-action]');
    const toastEl = e.target.closest('#toastContainer, .toast');
    // Allow toast.onclick to receive clicks inside toast container directly
    if (toastEl && toastEl !== actionEl) {
        return;
    }
    if (isToastClickShielded()) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        return;
    }
    if (!actionEl) return;
    if (actionEl.disabled || (typeof actionEl.hasAttribute === 'function' && actionEl.hasAttribute('disabled'))) return;
    if (actionEl.tagName === 'A' && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }

    // Ghost-click / click bleed-through protection while overlays or closing modals are active
    if (hasActiveModalShield(actionEl)) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        return;
    }

    const action = actionEl.getAttribute('data-action');
    if (Object.hasOwn(SIMPLE_ACTION_MAP, action)) {
        invokeCompatAction(action, SIMPLE_ACTION_MAP[action]);
        return;
    }

    switch (action) {
        case 'open-product': {
            const id = actionEl.getAttribute('data-id');
            if (id) invokeCompatAction('open-product', 'openProductModalById', id);
            break;
        }
        case 'scroll-grid-slider': {
            const id = actionEl.getAttribute('data-id');
            const dir = Number.parseInt(actionEl.getAttribute('data-dir'), 10) || 1;
            if (id) invokeCompatAction('scroll-grid-slider', 'scrollGridSlider', e, id, dir);
            break;
        }
        case 'toggle-fav': {
            const id = actionEl.getAttribute('data-id');
            if (id) invokeCompatAction('toggle-fav', 'toggleFav', e, id);
            break;
        }
        case 'add-to-cart': {
            const id = actionEl.getAttribute('data-id');
            if (id) invokeCompatAction('add-to-cart', 'addToCartWithAnimation', id, actionEl, e);
            break;
        }
        case 'change-page': {
            const dir = Number.parseInt(actionEl.getAttribute('data-dir'), 10);
            if (!Number.isNaN(dir)) invokeCompatAction('change-page', 'changePage', dir);
            break;
        }
        case 'remove-from-cart': {
            const idx = Number.parseInt(actionEl.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx)) {
                const rowEl = typeof actionEl.closest === 'function' ? actionEl.closest('.cart-item-row') : null;
                invokeCompatAction('remove-from-cart', 'removeFromCart', idx, e, rowEl);
            }
            break;
        }
        case 'clear-search-history': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            storage.remove('nisha_search_history');
            invokeAction('closeSearch');
            break;
        }
        case 'apply-search-history': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const term = actionEl.getAttribute('data-term') || '';
            const input = typeof document !== 'undefined' ? document.getElementById('mainSearch') : null;
            if (input) input.value = term;
            invokeAction('handleLiveSearch');
            break;
        }
        case 'select-live-search-item': {
            const id = actionEl.getAttribute('data-id');
            if (id) invokeCompatAction('open-product', 'openProductModalById', id);
            invokeAction('closeSearch');
            break;
        }
        case 'toggle-qa-section': {
            invokeCompatAction('toggle-qa-section', 'toggleQASection', actionEl);
            break;
        }
        case 'submit-question': {
            const id = actionEl.getAttribute('data-id');
            if (id) invokeCompatAction('submit-question', 'submitQuestion', id);
            break;
        }
        case 'set-slide': {
            const idx = Number.parseInt(actionEl.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx)) invokeCompatAction('set-slide', 'setSlide', idx);
            break;
        }
        case 'show-badge-info': {
            const badge = actionEl.getAttribute('data-badge');
            if (badge) invokeCompatAction('show-badge-info', 'showBadgeInfo', badge);
            break;
        }
        case 'remove-history-item': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const id = actionEl.getAttribute('data-id');
            if (id) invokeCompatAction('remove-history-item', 'removeHistoryItem', e, id);
            break;
        }
        case 'remove-profile-phone': {
            const isModal = actionEl.getAttribute('data-modal') === '1';
            invokeCompatAction('remove-profile-phone', 'removeProfilePhone', isModal);
            break;
        }
        case 'remove-profile-tg': {
            const isModal = actionEl.getAttribute('data-modal') === '1';
            invokeCompatAction('remove-profile-tg', 'removeProfileTg', isModal);
            break;
        }
        case 'toggle-profile-delivery': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const isModal = actionEl.getAttribute('data-modal') === '1';
            invokeCompatAction('toggle-profile-delivery', 'toggleProfileDeliveryAccordion', isModal, actionEl);
            break;
        }
        case 'save-profile-delivery': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const isModal = actionEl.getAttribute('data-modal') === '1';
            invokeCompatAction('save-profile-delivery', 'saveProfileDeliveryFromForm', isModal, actionEl);
            break;
        }
        case 'verify-orders-phone': {
            const phone = actionEl.getAttribute('data-phone') || '';
            const orderPhoneEl = typeof document !== 'undefined' ? document.getElementById('orderPhone') : null;
            if (orderPhoneEl) orderPhoneEl.value = phone;
            invokeCompatAction('generate-and-send-otp', 'generateAndSendOTP');
            break;
        }
        case 'copy-ttn': {
            const ttn = actionEl.getAttribute('data-ttn');
            if (ttn) invokeCompatAction('copy-ttn', 'copyTTN', ttn, actionEl);
            break;
        }
        case 'prompt-order-review': {
            invokeAction('closeModal', 'ordersModal');
            invokeCompatAction(
                'prompt-order-review',
                'promptOrderReview',
                actionEl.getAttribute('data-order-id') || '',
                actionEl.getAttribute('data-item-name') || '',
                actionEl.getAttribute('data-item-img') || '',
                actionEl.getAttribute('data-item-id') || ''
            );
            break;
        }
        case 'open-review-image': {
            const img = actionEl.getAttribute('data-img');
            if (img) invokeCompatAction('open-review-image', 'openReviewImage', img);
            break;
        }
        case 'close-modal': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
            const modalId = actionEl.getAttribute('data-modal-id');
            if (modalId) invokeCompatAction('close-modal', 'closeModal', modalId, e);
            break;
        }
        case 'delete-proposal-photo': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
            const idx = Number.parseInt(actionEl.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx)) invokeCompatAction('delete-proposal-photo', 'removeProposalFile', idx, actionEl);
            break;
        }
        case 'preview-proposal-photo': {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
            const idx = Number.parseInt(actionEl.getAttribute('data-index'), 10);
            if (!Number.isNaN(idx)) invokeCompatAction('preview-proposal-photo', 'openProposalPhotoByIndex', idx, actionEl);
            break;
        }
        case 'trigger-prop-files': {
            if (e.target && typeof e.target.closest === 'function') {
                if (e.target.closest('.preview-img') || e.target.closest('.preview-del-btn') || e.target.closest('[data-action="delete-proposal-photo"]') || e.target.closest('[data-action="preview-proposal-photo"]')) {
                    break;
                }
            }
            const filesCount = (globalThis.currentProposalFiles && globalThis.currentProposalFiles.length) || 0;
            if (filesCount >= 5) {
                if (typeof showToast === 'function') {
                    showToast(typeof i18next !== 'undefined' ? i18next.t('messages.prop_max_files', { defaultValue: 'Максимум 5 фото/видео!' }) : 'Максимум 5 фото/видео!', 'error');
                }
                break;
            }
            const filesEl = typeof document !== 'undefined' ? document.getElementById('propFiles') : null;
            if (filesEl && typeof filesEl.click === 'function') filesEl.click();
            break;
        }
        case 'close-order-success': {
            const overlay = typeof document !== 'undefined' ? document.getElementById('orderSuccessOverlay') : null;
            if (overlay) overlay.style.display = 'none';
            break;
        }
        case 'email-prompt-backdrop': {
            if (e.target === actionEl) invokeCompatAction('confirm-email-prompt', 'confirmEmailPrompt', false);
            break;
        }
        case 'confirm-email-prompt': {
            const isYes = actionEl.getAttribute('data-confirm') === 'true';
            invokeCompatAction('confirm-email-prompt', 'confirmEmailPrompt', isYes);
            break;
        }
        case 'navigate-home': {
            if (typeof window !== 'undefined' && window.location) window.location.href = '/';
            break;
        }
        case 'submit-main-search': {
            const input = typeof document !== 'undefined' ? document.getElementById('mainSearch') : null;
            const val = input ? input.value.trim() : '';
            invokeAction('saveRecentSearch', val);
            invokeAction('applyFilters');
            invokeAction('closeSearch');
            break;
        }
        case 'set-category-filter': {
            const cat = actionEl.getAttribute('data-category') || '';
            invokeCompatAction('set-category-filter', 'setCategoryFilter', cat, actionEl);
            break;
        }
        case 'toggle-password-visibility': {
            const inputId = actionEl.getAttribute('data-input-id');
            if (inputId) invokeCompatAction('toggle-password-visibility', 'togglePasswordVisibility', inputId, actionEl);
            break;
        }
        case 'handle-auth': {
            const mode = actionEl.getAttribute('data-auth-mode') || 'login';
            const isModal = actionEl.getAttribute('data-is-modal') === 'true';
            invokeCompatAction('handle-auth', 'handleAuth', mode, isModal);
            break;
        }
        case 'toggle-reg-mode': {
            const isModal = actionEl.getAttribute('data-is-modal') === 'true';
            invokeCompatAction('toggle-reg-mode', 'toggleRegMode', isModal);
            break;
        }
        case 'forgot-password': {
            const isModal = actionEl.getAttribute('data-is-modal') === 'true';
            invokeCompatAction('forgot-password', 'handleForgotPassword', isModal);
            break;
        }
        case 'show-phone-input': {
            const isModal = actionEl.getAttribute('data-is-modal') === 'true';
            invokeCompatAction('show-phone-input', 'showPhoneInput', isModal);
            break;
        }
        case 'save-phone-input': {
            const isModal = actionEl.getAttribute('data-is-modal') === 'true';
            invokeCompatAction('save-phone-input', 'savePhoneFromInput', isModal);
            break;
        }
        case 'hide-phone-input': {
            const isModal = actionEl.getAttribute('data-is-modal') === 'true';
            invokeCompatAction('hide-phone-input', 'hidePhoneInput', isModal);
            break;
        }
        case 'show-tg-input': {
            const isModal = actionEl.getAttribute('data-is-modal') === 'true';
            invokeCompatAction('show-tg-input', 'showTgInput', isModal);
            break;
        }
        case 'save-tg-input': {
            const isModal = actionEl.getAttribute('data-is-modal') === 'true';
            invokeCompatAction('save-tg-input', 'saveTgFromInput', isModal);
            break;
        }
        case 'hide-tg-input': {
            const isModal = actionEl.getAttribute('data-is-modal') === 'true';
            invokeCompatAction('hide-tg-input', 'hideTgInput', isModal);
            break;
        }
        case 'logout': {
            const closeTargetModal = actionEl.getAttribute('data-close-modal');
            invokeCompatAction('logout', 'logout');
            if (closeTargetModal) invokeAction('closeModal', closeTargetModal);
            break;
        }
        case 'sort-items': {
            const sort = actionEl.getAttribute('data-sort') || 'new';
            invokeCompatAction('sort-items', 'sortItems', sort);
            break;
        }
        case 'toggle-cart-dropdown': {
            invokeCompatAction('toggle-cart-dropdown', 'toggleCartDropdown', e);
            break;
        }
        case 'close-cart-dropdown': {
            invokeCompatAction('close-cart-dropdown', 'closeCartDropdown', e);
            break;
        }
        case 'toggle-footer-lang': {
            const wrapper = typeof document !== 'undefined' ? document.getElementById('footerLangWrapper') : null;
            if (wrapper) wrapper.classList.toggle('active');
            break;
        }
        case 'set-lang': {
            const lang = actionEl.getAttribute('data-lang');
            if (lang) invokeCompatAction('set-lang', 'setLang', lang);
            break;
        }
        case 'move-slide': {
            const dir = Number.parseInt(actionEl.getAttribute('data-dir'), 10) || 1;
            invokeCompatAction('move-slide', 'moveSlide', dir);
            break;
        }
        case 'toggle-fav-from-modal': {
            invokeCompatAction('toggle-fav-from-modal', 'toggleFavFromModal', e);
            break;
        }
        case 'toggle-accordion': {
            invokeCompatAction('toggle-accordion', 'toggleAccordion', actionEl);
            break;
        }
        case 'open-offer-price': {
            const handled = invokeCompatAction('open-offer-price', 'showInlineOfferPriceInput');
            if (handled === undefined) {
                invokeAction('openOfferPriceModal');
            }
            break;
        }
        case 'clear-np-city': {
            invokeCompatAction('clear-np-city', 'clearNPCityInput', e);
            break;
        }
        case 'clear-np-branch': {
            invokeCompatAction('clear-np-branch', 'clearNPBranchInput', e);
            break;
        }
        case 'select-payment-method': {
            const method = actionEl.getAttribute('data-payment-method') || '';
            const text = actionEl.innerText || method;
            invokeCompatAction('select-payment-method', 'selectPaymentMethod', method, text);
            break;
        }
        case 'switch-order-tab': {
            const tab = actionEl.getAttribute('data-tab') || 'accepted';
            invokeCompatAction('switch-order-tab', 'switchOrderTab', tab);
            break;
        }
        case 'scroll-reviews': {
            const dir = Number.parseInt(actionEl.getAttribute('data-dir'), 10) || 1;
            invokeCompatAction('scroll-reviews', 'scrollReviews', dir);
            break;
        }
    }
}
if (typeof window !== 'undefined') window.handleDelegatedAction = handleDelegatedAction;

/**
 * Handles delegated capture-phase media `load` events for product and catalog images.
 * @param {Event} e
 */
export function handleDelegatedMediaLoad(e) {
    const target = e && e.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('card-slide-img')) {
        target.style.opacity = '1';
        if (target.parentElement) {
            target.parentElement.classList.remove('img-8bit-loading');
            target.parentElement.classList.add('img-8bit-loaded');
        }
    } else if (target.classList.contains('modal-slide-img')) {
        target.style.opacity = '1';
        if (target.parentElement) {
            if (target.naturalWidth) target.parentElement.setAttribute('data-pswp-width', target.naturalWidth);
            if (target.naturalHeight) target.parentElement.setAttribute('data-pswp-height', target.naturalHeight);
            target.parentElement.classList.remove('skeleton');
            target.parentElement.style.backgroundImage = 'none';
        }
    }
}
if (typeof window !== 'undefined') window.handleDelegatedMediaLoad = handleDelegatedMediaLoad;

/**
 * Handles delegated media `error` events with fallback URL retry and graceful error placeholders.
 * @param {Event} e
 */
export function handleDelegatedMediaError(e) {
    const target = e && e.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('card-slide-img')) {
        const ds = target.dataset || {};
        const fallbackSrc = ds.fallbackSrc || (typeof target.getAttribute === 'function' ? target.getAttribute('data-fallback-src') : '');
        const hasTriedFb = ds.fb || (typeof target.getAttribute === 'function' ? target.getAttribute('data-fb') : '');
        const currentSrc = target.src || (typeof target.getAttribute === 'function' ? target.getAttribute('src') : '');
        const safeFbSrc = sanitizeHtmlMediaUrl(fallbackSrc);
        if (!hasTriedFb && safeFbSrc && safeFbSrc !== currentSrc) {
            if (target.dataset) target.dataset.fb = '1';
            if (typeof target.setAttribute === 'function') target.setAttribute('data-fb', '1');
            target.src = safeFbSrc;
            return;
        }
        if (target.parentElement) {
            target.parentElement.classList.remove('img-8bit-loading');
        }
        target.outerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:red;font-size:10px;font-family:monospace;">NO SIGNAL</div>';
    } else if (target.classList.contains('similar-slide-img')) {
        target.style.display = 'none';
        if (target.parentElement) {
            target.parentElement.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;font-family:var(--font-mono);">ERROR</div>';
        }
    } else if (target.classList.contains('modal-slide-img')) {
        target.style.display = 'none';
        if (target.parentElement) {
            target.parentElement.classList.remove('skeleton');
            target.parentElement.style.border = '1px solid #333';
            target.parentElement.style.backgroundImage = 'none';
            target.parentElement.innerHTML = '<div style="width:100%;height:100%;min-height:260px;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px;font-family:var(--font-mono);">[ ОШИБКА ЗАГРУЗКИ ФОТО ]</div>';
        }
    }
}
if (typeof window !== 'undefined') window.handleDelegatedMediaError = handleDelegatedMediaError;

/**
 * Handles delegated `canplay` events for lazy-loaded grid and modal videos.
 * @param {Event} e
 */
export function handleDelegatedMediaCanPlay(e) {
    const target = e && e.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('grid-lazy-video')) {
        target.style.opacity = '1';
        if (target.parentElement) {
            target.parentElement.classList.remove('img-8bit-loading');
            target.parentElement.classList.add('img-8bit-loaded');
        }
    } else if (target.classList.contains('modal-video-player')) {
        target.style.opacity = '1';
        if (target.parentElement) {
            target.parentElement.classList.remove('img-8bit-loading');
        }
    }
}
if (typeof window !== 'undefined') window.handleDelegatedMediaCanPlay = handleDelegatedMediaCanPlay;

/**
 * Synchronizes catalog card carousel dots on delegated capture-phase scroll events.
 * @param {Event} e
 */
export function handleDelegatedScroll(e) {
    const target = e && e.target;
    if (!target || !target.classList) return;

    if (target.classList.contains('card-slider-container')) {
        const itemId = (typeof target.getAttribute === 'function' && target.getAttribute('data-item-id'))
            || (target.id && target.id.startsWith('slider-') ? target.id.slice(7) : '');
        if (itemId) invokeAction('updateCardDots', target, itemId);
    }
}
if (typeof window !== 'undefined') window.handleDelegatedScroll = handleDelegatedScroll;

/**
 * Registers global document-level event delegation once (click, media load/error/canplay, scroll, hover & touch).
 */
export function initActionDelegation() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    if (document._nishaActionDelegationBound) return;
    document._nishaActionDelegationBound = true;

    document.addEventListener('click', handleDelegatedAction, true);
    document.addEventListener('load', handleDelegatedMediaLoad, true);
    document.addEventListener('error', handleDelegatedMediaError, true);
    document.addEventListener('canplay', handleDelegatedMediaCanPlay, true);
    document.addEventListener('scroll', handleDelegatedScroll, { capture: true, passive: true });

    document.addEventListener('touchstart', (e) => {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const trigger = e.target.closest('.live-search-item, [data-action="open-product"]');
        if (trigger) {
            const id = trigger.getAttribute('data-id');
            if (id) invokeAction('prewarmProductModal', id, true);
        }
    }, { passive: true });

    document.addEventListener('mouseover', (e) => {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const trigger = e.target.closest('.live-search-item, [data-action="open-product"]');
        if (trigger) {
            const id = trigger.getAttribute('data-id');
            if (id) invokeAction('prewarmProductModal', id);
        }
        const hoverEl = e.target.closest('[data-hover-action]');
        if (!hoverEl) return;
        if (e.relatedTarget && typeof hoverEl.contains === 'function' && hoverEl.contains(e.relatedTarget)) return;

        const hoverAction = hoverEl.getAttribute('data-hover-action');
        if (hoverAction === 'preload-grid-slide') {
            const id = hoverEl.getAttribute('data-id');
            const dir = Number.parseInt(hoverEl.getAttribute('data-dir'), 10) || 1;
            if (id) invokeCompatAction('preload-grid-slide', 'preloadGridSlide', e, id, dir);
        } else if (hoverAction === 'preload-slide') {
            const dir = Number.parseInt(hoverEl.getAttribute('data-dir'), 10) || 1;
            invokeCompatAction('preload-slide', 'preloadSlide', dir);
        } else if (hoverAction === 'similar-item-tooltip') {
            const id = hoverEl.getAttribute('data-id');
            if (id) invokeCompatAction('similar-item-tooltip', 'showItemMeasurementsTooltip', id, e);
        } else if (hoverAction === 'review-link-hover') {
            hoverEl.style.textDecoration = 'underline';
            hoverEl.style.color = '#fff';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const hoverEl = e.target.closest('[data-hover-action="similar-item-tooltip"]');
        if (hoverEl) invokeAction('moveItemMeasurementsTooltip', e);
    });

    document.addEventListener('mouseout', (e) => {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const hoverEl = e.target.closest('[data-hover-action]');
        if (!hoverEl) return;
        if (e.relatedTarget && typeof hoverEl.contains === 'function' && hoverEl.contains(e.relatedTarget)) return;

        const hoverAction = hoverEl.getAttribute('data-hover-action');
        if (hoverAction === 'similar-item-tooltip') {
            invokeAction('hideItemMeasurementsTooltip');
        } else if (hoverAction === 'review-link-hover') {
            hoverEl.style.textDecoration = 'none';
            hoverEl.style.color = 'var(--accent-green)';
        }
    });
}

/**
 * Binds input/submit/change handlers to search, filter checkboxes, Nova Poshta checkout fields & proposal counter.
 */
export function bindFormAndFilterListeners() {
    if (typeof document === 'undefined' || document._nishaFormFiltersBound) return;
    document._nishaFormFiltersBound = true;

    const searchForm = typeof document.getElementById === 'function' ? document.getElementById('mainSearch')?.closest('form') : null;
    if (searchForm) {
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const searchEl = document.getElementById('mainSearch');
            if (searchEl) invokeAction('saveRecentSearch', searchEl.value.trim());
            invokeAction('applyFilters');
            invokeAction('closeSearch');
        });
    }

    const mainSearch = typeof document.getElementById === 'function' ? document.getElementById('mainSearch') : null;
    if (mainSearch) {
        mainSearch.addEventListener('input', () => {
            invokeAction('handleLiveSearch');
        });
    }

    const priceMin = typeof document.getElementById === 'function' ? document.getElementById('priceMin') : null;
    const priceMax = typeof document.getElementById === 'function' ? document.getElementById('priceMax') : null;
    [priceMin, priceMax].forEach(el => {
        if (el) {
            el.addEventListener('input', () => {
                invokeAction('updatePriceUI');
            });
        }
    });

    if (typeof document.addEventListener === 'function') {
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (!target) return;
            if ((target.classList && target.classList.contains('size-cb')) ||
                target.id === 'onlySaleCb' ||
                target.id === 'hideUnavailableCb') {
                invokeAction('triggerFilterTransition');
            }
        });
    }

    const orderCity = typeof document.getElementById === 'function' ? document.getElementById('orderCity') : null;
    if (orderCity) {
        orderCity.addEventListener('input', () => {
            invokeAction('debouncedNPCitySearch', orderCity.value);
        });
    }

    const orderBranch = typeof document.getElementById === 'function' ? document.getElementById('orderBranch') : null;
    if (orderBranch) {
        orderBranch.addEventListener('focus', () => {
            invokeAction('loadNPBranches', '', true);
        });
        orderBranch.addEventListener('input', () => {
            invokeAction('filterNPBranches', orderBranch.value);
        });
    }

    const propDesc = typeof document.getElementById === 'function' ? document.getElementById('propDesc') : null;
    if (propDesc) {
        propDesc.addEventListener('input', () => {
            invokeAction('updateCharCount', propDesc);
        });
    }
}

registerActions({
    handleDelegatedAction,
    handleDelegatedMediaLoad,
    handleDelegatedMediaError,
    handleDelegatedMediaCanPlay,
    handleDelegatedScroll,
    initActionDelegation,
    bindFormAndFilterListeners
});
