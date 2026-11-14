// ==========================================
// NISHA CART — UI, DROPDOWN, SCROLL ISOLATION & SWIPE-TO-DELETE
// ==========================================

import {
    cartState,
    escCartHtml,
    parseCartPrice,
    resetPromoState,
    renderPromoCodeNotice,
    clearDropdownInlineStyles,
    getActiveCart,
    getSupabaseClient
} from './cart-state.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';

/**
 * Изоляция скролла списка корзины на ПК: скроллится только сам список корзины, а не весь сайт.
 */
export function initCartScrollIsolation() {
    if (typeof document === 'undefined') return;
    const dropdown = document.getElementById('cartDropdown');
    const list = document.getElementById('cartDropdownList');
    if (!dropdown && !list) return;

    [dropdown, list].forEach(el => {
        if (!el) return;
        if (typeof el.setAttribute === 'function') {
            el.setAttribute('data-lenis-prevent', 'true');
            el.setAttribute('data-no-pull', 'true');
        }
        if (el.classList && !el.classList.contains('lenis-prevent')) {
            el.classList.add('lenis-prevent', 'no-pull');
        }
    });

    if (list && !list._cartScrollIsoBound) {
        list._cartScrollIsoBound = true;
        list.addEventListener('wheel', (e) => {
            if (typeof window !== 'undefined' && window.innerWidth <= 900) return;
            const scrollTop = list.scrollTop;
            const scrollHeight = list.scrollHeight;
            const clientHeight = list.clientHeight;
            const deltaY = e.deltaY;

            if (scrollHeight > clientHeight) {
                const isAtTop = scrollTop <= 0 && deltaY < 0;
                const isAtBottom = (scrollTop + clientHeight >= scrollHeight - 1) && deltaY > 0;
                if (isAtTop || isAtBottom) {
                    e.preventDefault();
                }
            } else {
                e.preventDefault();
            }
            e.stopPropagation();
        }, { passive: false });
    }

    if (dropdown && !dropdown._cartScrollIsoBound) {
        dropdown._cartScrollIsoBound = true;
        dropdown.addEventListener('wheel', (e) => {
            if (typeof window !== 'undefined' && window.innerWidth <= 900) return;
            if (list && list.scrollHeight > list.clientHeight && !e.target.closest('#cartDropdownList')) {
                list.scrollTop += e.deltaY;
                e.preventDefault();
                e.stopPropagation();
            } else if (!e.target.closest('#cartDropdownList')) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
    }
}

/**
 * Гарантия обновления содержимого корзины при наведении курсора на ПК.
 */
export function initCartHoverDesktop() {
    initCartScrollIsolation();
    if (typeof document === 'undefined') return;
    const infoWrapper = document.getElementById('cartInfoWrapper');
    if (!infoWrapper || infoWrapper._cartHoverBound) return;
    infoWrapper._cartHoverBound = true;

    infoWrapper.addEventListener('mouseenter', () => {
        if (typeof window !== 'undefined' && window.innerWidth > 900) {
            const dropdown = document.getElementById('cartDropdown');
            if (dropdown) clearDropdownInlineStyles(dropdown);
            const currentCart = getActiveCart();
            if (currentCart && currentCart.length > 0) {
                renderCartItems();
            }
        }
    });
}

/**
 * Проверяет актуальный статус наличия товаров корзины в базе данных.
 * @returns {Promise<void>}
 */
export async function checkCartItemsAvailability() {
    try {
        const currentCart = getActiveCart();
        if (!currentCart || currentCart.length === 0) return;
        const itemIds = currentCart.map(i => i && (i.id || i)).filter(Boolean);
        const sb = getSupabaseClient();
        if (!sb || itemIds.length === 0) return;

        const { data: dbItems, error } = await sb.from('items').select('id, name, status').in('id', itemIds);
        if (dbItems && !error) {
            let hasChanges = false;
            const soldNames = [];
            currentCart.forEach(cartItem => {
                const cId = String(cartItem?.id || cartItem?.item_id || cartItem).trim();
                const dbItem = dbItems.find(i => String(i.id).trim() === cId);
                const isSold = Boolean(dbItem && dbItem.status === 'sold');
                if (cartItem._isSold !== isSold) {
                    cartItem._isSold = isSold;
                    hasChanges = true;
                }
                if (isSold) {
                    soldNames.push(cartItem.name || 'Товар');
                }
            });

            if (hasChanges) {
                renderCartItems();
            }

            if (soldNames.length > 0) {
                const soldMsg = typeof i18next !== 'undefined'
                    ? i18next.t('messages.item_sold', { defaultValue: 'Товар уже куплен' })
                    : 'Товар уже куплен';
                showToast(`⚠️ ${soldMsg}: ${soldNames.at(0)}`, 'error');
            }
        }
    } catch (e) {
        console.warn('[CART] Ошибка проверки наличия:', e);
    }
}

/**
 * Отрисовывает список товаров в выпадающей панели корзины с поддержкой свайпа.
 */
export function renderCartItems() {
    const list = document.getElementById('cartDropdownList');
    if (!list) return;
    if (typeof list.replaceChildren === 'function') list.replaceChildren();
    else list.innerHTML = '';

    const currentCart = getActiveCart();
    if (currentCart.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; border: 1px dashed #222; background: #000; margin: 15px 5px;">
                <div style="font-size: 30px; margin-bottom: 15px;">🛒</div>
                <div style="color:var(--accent-red); font-family: var(--font-mono); font-weight:bold; margin-bottom: 10px;" data-i18n="cart.empty_title">${typeof i18next !== 'undefined' ? i18next.t('cart.empty_title') : 'КОРЗИНА ПУСТА'}</div>
                <div style="color:#888; font-size: 12px; line-height: 1.5;" data-i18n="cart.empty_desc">${typeof i18next !== 'undefined' ? i18next.t('cart.empty_desc') : 'Выберите понравившиеся вещи в каталоге'}</div>
            </div>`;
        return;
    }

    list.innerHTML = `
        <div class="cart-warning-bar" style="padding: 10px 14px; margin-bottom: 10px; border-bottom: 1px dashed #333; background: #000; text-align: center;">
            <div style="color: var(--accent-red); font-size: 11px; line-height: 1.45; font-family: var(--font-main);" data-i18n="cart.warning">
                ${typeof i18next !== 'undefined' ? i18next.t('cart.warning', { defaultValue: 'Товары не забронированы и могут быть куплены кем-то другим до момента оплаты.' }) : 'Товары не забронированы и могут быть куплены кем-то другим до момента оплаты.'}
            </div>
        </div>
    `;

    currentCart.forEach((item, index) => {
        const imgUrl = getOptimizedImg(item);
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        const isSold = !!item._isSold;
        const soldBadgeHtml = isSold
            ? `<div class="cart-sold-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span>${typeof i18next !== 'undefined' ? i18next.t('messages.item_sold', { defaultValue: 'Товар уже куплен' }) : 'Товар уже куплен'}</span></div>`
            : '';
        const rowStyle = isSold ? 'opacity: 0.8; border-left: 3px solid #ff4444;' : '';
        const sizePrefix = typeof i18next !== 'undefined' ? i18next.t('grid.size_prefix', { defaultValue: 'Размер: ' }) : 'Размер: ';

        row.innerHTML = `
            <div class="swipe-background">
                <svg class="trash-icon" viewBox="0 0 24 24">
                    <path class="trash-lid" d="M3 6h18 M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    <path class="trash-base" d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6 M10 11v6 M14 11v6"></path>
                </svg>
            </div>
            <div class="swipe-surface" 
                 data-index="${index}"
                 style="${rowStyle}">
                <div class="cart-item-img" style="background-image: url('${imgUrl}')"></div>
                <div class="cart-item-info">
                    <div class="cart-item-name" title="${escCartHtml(item.name)}">${escCartHtml(item.name)}</div>
                    ${(() => {
                    const rawSize = String(item.size || '').trim();
                    const cleanSize = rawSize ? rawSize.toUpperCase() : '-';
                    return `<div class="cart-item-size"><span data-i18n="grid.size_prefix">${sizePrefix}</span><span class="size-val">${escCartHtml(cleanSize)}</span></div>`;
                })()}
                    ${soldBadgeHtml}
                </div>
                <div class="cart-item-price-wrapper">
                    <div class="cart-item-price">${typeof formatPrice === 'function' ? formatPrice(item.price) : `${item.price} ${getCurrency()}`}</div>
                    <div class="cart-item-remove hide-on-mobile" data-action="remove-from-cart" data-index="${index}">×</div>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
    if (!list._swipeDelegatedBound) {
        list._swipeDelegatedBound = true;
        list.addEventListener('touchstart', (e) => invokeAction('handleSwipeStart', e), { passive: true });
        list.addEventListener('touchmove', (e) => invokeAction('handleSwipeMove', e), { passive: true });
        list.addEventListener('touchend', (e) => invokeAction('handleSwipeEnd', e), { passive: true });
    }
}

/**
 * Обновляет интерфейс плавающей панели корзины (бейдж, итог, промокод).
 */
export function updateCartUI() {
    const p = document.getElementById('cartPanel');
    const fab = document.querySelector('.fab-propose');
    if (!p) return;

    const currentCart = getActiveCart();
    const dropdown = document.getElementById('cartDropdown');
    if (currentCart.length === 0) {
        p.classList.remove('show', 'dropdown-open');
        if (dropdown) {
            dropdown.classList.remove('active');
            clearDropdownInlineStyles(dropdown);
            if (hasAction('hidePopoverSafe')) invokeAction('hidePopoverSafe', dropdown);
            else if (typeof dropdown.hidePopover === 'function' && dropdown.matches && dropdown.matches(':popover-open')) { try { dropdown.hidePopover(); } catch {} }
        }
        if (fab) {
            fab.classList.remove('cart-active');
            fab.classList.remove('hidden-scroll');
            fab.style.removeProperty('display');
            fab.style.removeProperty('opacity');
            fab.style.removeProperty('pointer-events');
        }
        if (window.currentPromoDiscount || window.appliedPromoCode) resetPromoState();
        return;
    }

    p.classList.add('show');
    if (dropdown) {
        clearDropdownInlineStyles(dropdown);
    }
    initCartHoverDesktop();
    if (fab) fab.classList.add('cart-active');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', '#000a1a');
    if (window.Telegram && window.Telegram.WebApp) {
        if (typeof window.Telegram.WebApp.setBackgroundColor === 'function') window.Telegram.WebApp.setBackgroundColor('#000a1a');
        if (typeof window.Telegram.WebApp.setBottomBarColor === 'function') window.Telegram.WebApp.setBottomBarColor('#000a1a');
    }

    const countEl = document.getElementById('cartCount');
    if (countEl) countEl.innerText = currentCart.length;
    if (hasAction('updateAppBadge')) invokeAction('updateAppBadge', currentCart.length);
    let total = currentCart.reduce((sum, item) => sum + parseCartPrice(item.price), 0);

    const promoDiscount = window.currentPromoDiscount || cartState.currentPromoDiscount || 0;
    const promoCode = window.appliedPromoCode || cartState.appliedPromoCode || '';
    const msg = document.getElementById('promoMessage');
    if (promoDiscount > 0 && promoCode) {
        const fixedAmt = Number(window.currentPromoFixed) || 0;
        const savedMoney = fixedAmt > 0
            ? Math.min(fixedAmt, Math.max(0, total - 1))
            : Math.floor(total * promoDiscount);
        total = total - savedMoney;

        if (msg) {
            const isFixed = fixedAmt > 0;
            const percentVal = Math.round(promoDiscount * 100);
            msg.innerHTML = renderPromoCodeNotice({
                promoCode,
                percent: percentVal,
                savedMoney,
                isFixed
            });
        }
    } else if (!promoCode && msg && !msg.querySelector('.promo-notice-error, .promo-notice-warning')) {
        if (typeof msg.replaceChildren === 'function') msg.replaceChildren();
        else msg.innerHTML = '';
    }

    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.innerText = (typeof formatPrice === 'function') ? formatPrice(total) : (total + ' ' + getCurrency());

    renderCartItems();
}

/**
 * Переключает состояние выпадающей шторки корзины.
 * @param {Event} [e]
 */
export function toggleCartDropdown(e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const dropdown = document.getElementById('cartDropdown');
    if (dropdown) clearDropdownInlineStyles(dropdown);
    const panel = document.getElementById('cartPanel');
    const fab = document.querySelector('.fab-propose');
    if (dropdown) {
        dropdown.classList.toggle('active');
        const isActive = dropdown.classList.contains('active');
        if (panel) {
            if (isActive) panel.classList.add('dropdown-open');
            else panel.classList.remove('dropdown-open');
        }
        if (isActive) {
            if (typeof triggerModalTypewriter === 'function') triggerModalTypewriter(dropdown);
            checkCartItemsAvailability();
            renderCartItems();
        }
        if (fab) {
            if (isActive) {
                fab.style.setProperty('display', 'none', 'important');
                fab.style.setProperty('opacity', '0', 'important');
                fab.style.setProperty('pointer-events', 'none', 'important');
            } else {
                fab.style.removeProperty('display');
                fab.style.removeProperty('opacity');
                fab.style.removeProperty('pointer-events');
            }
        }
    }
}

/**
 * Закрывает выпадающую шторку корзины и восстанавливает FAB.
 * @param {Event} [e]
 */
export function closeCartDropdown(e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const dropdown = document.getElementById('cartDropdown');
    const panel = document.getElementById('cartPanel');
    const fab = document.querySelector('.fab-propose');
    if (dropdown) {
        dropdown.classList.remove('active');
        clearDropdownInlineStyles(dropdown);
    }
    if (panel) panel.classList.remove('dropdown-open');
    if (fab) {
        fab.style.removeProperty('display');
        fab.style.removeProperty('opacity');
        fab.style.removeProperty('pointer-events');
        const currentCart = getActiveCart();
        if (currentCart && currentCart.length > 0) {
            fab.classList.add('cart-active');
        } else {
            fab.classList.remove('cart-active');
        }
    }
}

/**
 * Определяет элемент поверхности свайпа для строки корзины.
 * @param {TouchEvent|Event} e
 * @returns {HTMLElement|null}
 */
export function resolveSwipeSurface(e) {
    if (!e) return null;
    if (e.currentTarget && e.currentTarget.classList && e.currentTarget.classList.contains('swipe-surface')) {
        return e.currentTarget;
    }
    return (e.target && typeof e.target.closest === 'function') ? e.target.closest('.swipe-surface') : null;
}

if (typeof window !== 'undefined') {
    window.initCartScrollIsolation = initCartScrollIsolation;
    window.initCartHoverDesktop = initCartHoverDesktop;
    window.checkCartItemsAvailability = checkCartItemsAvailability;
    window.renderCartItems = renderCartItems;
    window.updateCartUI = updateCartUI;
    window.toggleCartDropdown = toggleCartDropdown;
    window.closeCartDropdown = closeCartDropdown;

    let cartSwipeStartX = 0;
    let cartSwipeCurrentX = 0;

    window.handleSwipeStart = function(e) {
        const rowSurface = resolveSwipeSurface(e);
        if (!rowSurface || !e.touches || !e.touches[0]) return;
        cartSwipeStartX = e.touches[0].clientX;
        cartSwipeCurrentX = cartSwipeStartX;
        cartState.cartSwipeStartX = cartSwipeStartX;
        cartState.cartSwipeCurrentX = cartSwipeCurrentX;
        rowSurface.style.transition = 'none';
    };

    window.handleSwipeMove = function(e) {
        const rowSurface = resolveSwipeSurface(e);
        if (!rowSurface || !e.touches || !e.touches[0]) return;
        cartSwipeCurrentX = e.touches[0].clientX;
        cartState.cartSwipeCurrentX = cartSwipeCurrentX;
        const diff = cartSwipeStartX - cartSwipeCurrentX;

        if (diff > 0) {
            const moveX = diff > 200 ? 200 + (diff - 200) * 0.2 : diff;
            rowSurface.style.transform = `translateX(-${moveX}px)`;

            const surfaceOpacity = Math.max(0.2, 1 - (moveX / 200));
            rowSurface.style.opacity = surfaceOpacity;

            const parentRow = rowSurface.closest('.cart-item-row');
            const trashIcon = parentRow ? parentRow.querySelector('.trash-icon') : null;
            const trashLid = parentRow ? parentRow.querySelector('.trash-lid') : null;

            if (trashIcon && trashLid) {
                const bgOpacity = Math.min(1, moveX / 80);
                trashIcon.style.opacity = bgOpacity;

                if (moveX > 50) {
                    const openAngle = Math.min(45, (moveX - 50) * 0.6);
                    trashLid.style.transform = `rotate(${openAngle}deg)`;
                } else {
                    trashLid.style.transform = 'rotate(0deg)';
                }
            }
        }
    };

    window.handleSwipeEnd = function(e) {
        const rowSurface = resolveSwipeSurface(e);
        if (!rowSurface) return;
        const diff = cartSwipeStartX - cartSwipeCurrentX;
        const parentRow = rowSurface.closest('.cart-item-row');
        const itemIndex = Number.parseInt(rowSurface.getAttribute('data-index'), 10);

        rowSurface.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';

        if (diff > 120) {
            if (typeof triggerHaptic === 'function') triggerHaptic('heavy');
            rowSurface.style.transform = 'translateX(-150%)';
            rowSurface.style.opacity = '0';

            setTimeout(() => {
                invokeAction('removeFromCart', itemIndex, null, parentRow);
            }, 200);
        } else {
            rowSurface.style.transform = 'translateX(0px)';
            rowSurface.style.opacity = '1';

            if (parentRow) {
                const trashIcon = parentRow.querySelector('.trash-icon');
                const trashLid = parentRow.querySelector('.trash-lid');
                if (trashIcon) trashIcon.style.opacity = '0';
                if (trashLid) trashLid.style.transform = 'rotate(0deg)';
            }
        }

        cartSwipeStartX = 0;
        cartSwipeCurrentX = 0;
        cartState.cartSwipeStartX = 0;
        cartState.cartSwipeCurrentX = 0;
    };

    window.openCart = function() {
        const dropdown = document.getElementById('cartDropdown');
        const panel = document.getElementById('cartPanel');
        const fab = document.querySelector('.fab-propose');
        if (dropdown) {
            clearDropdownInlineStyles(dropdown);
            dropdown.classList.add('active');
            if (panel) panel.classList.add('dropdown-open');
            if (fab) {
                fab.style.setProperty('display', 'none', 'important');
                fab.style.setProperty('opacity', '0', 'important');
                fab.style.setProperty('pointer-events', 'none', 'important');
            }
            checkCartItemsAvailability();
            renderCartItems();
        }
    };

    registerActions({
        renderCartItems,
        updateCartUI,
        toggleCartDropdown,
        closeCartDropdown,
        handleSwipeStart: window.handleSwipeStart,
        handleSwipeMove: window.handleSwipeMove,
        handleSwipeEnd: window.handleSwipeEnd,
        openCart: window.openCart
    });
}
