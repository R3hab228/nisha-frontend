// ==========================================
// NISHA CART — MUTATIONS & SERVER SYNC
// ==========================================

import {
    cartState,
    clearDropdownInlineStyles,
    getActiveCart,
    setActiveCart,
    getCurrentUser,
    getSupabaseClient,
    withCartLock
} from './cart-state.js';
import { updateCartUI, closeCartDropdown } from './cart-ui.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';

/**
 * Синхронизирует корзину с сервером и сервисом брошенных корзин (Abandoned Cart Recovery).
 * @returns {Promise<void>}
 */
export async function syncCartToServer() {
    const user = getCurrentUser();
    const sb = getSupabaseClient();
    const activeCart = getActiveCart();

    if (user && sb) {
        sb.from('profiles').update({ cart: activeCart }).eq('id', user.id).then().catch(() => {});
    }

    if (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.post === 'function') {
        const fp = (typeof clientFingerprint !== 'undefined' && clientFingerprint)
            ? clientFingerprint
            : (window.clientFingerprint || (window.store && window.store.get ? window.store.get('clientFingerprint') : null));

        window.apiClient.post('/api/cart/sync', {
            cart: activeCart,
            userId: user ? user.id : null,
            deviceId: fp || null
        }, { timeout: 6000, dedupe: true }).catch(() => {});
    }
}

/**
 * Добавляет товар в корзину по ID (с поддержкой согласованной ставки торга и скидки hacked).
 * @param {string|number} itemId
 * @param {number|string|null} [customPriceOrSize=null]
 * @param {object} [options={}]
 * @returns {Promise<void>}
 */
export async function addToCartById(itemId, customPriceOrSize = null, options = {}) {
    return await withCartLock(async () => {
        let customPrice = null;
        if (typeof customPriceOrSize === 'number') {
            customPrice = customPriceOrSize;
        } else if (typeof customPriceOrSize === 'string' && !Number.isNaN(Number(customPriceOrSize)) && customPriceOrSize.trim() !== '') {
            customPrice = Number(customPriceOrSize);
        } else if (options && (options.price || options.customPrice)) {
            customPrice = Number(options.price || options.customPrice);
        }

        if (customPrice === null) {
            try {
                const rawBargain = sessionStorage.getItem('accepted_bargain_' + itemId) || localStorage.getItem('accepted_bargain_' + itemId);
                if (rawBargain) {
                    const parsedBargain = JSON.parse(rawBargain);
                    if (parsedBargain && parsedBargain.acceptedPrice) {
                        customPrice = Number(parsedBargain.acceptedPrice);
                    }
                }
            } catch {}
        }

        const catalog = (typeof window !== 'undefined' && window.allItems) || (typeof allItems !== 'undefined' ? allItems : []);
        const item = catalog.find(i => String(i.id) === String(itemId));
        if (!item) return;

        const currentCart = getActiveCart();
        const existingIndex = currentCart.findIndex(i => String(i.id) === String(item.id));
        if (existingIndex !== -1) {
            if (customPrice !== null && !Number.isNaN(customPrice) && customPrice > 0 && (customPriceOrSize !== null || Number(currentCart[existingIndex].price) !== Math.round(Number(customPrice)))) {
                currentCart[existingIndex].price = Math.round(Number(customPrice));
                currentCart[existingIndex].bargainPrice = Math.round(Number(customPrice));
                setActiveCart(currentCart);
                updateCartUI();
                syncCartToServer();
                const updateMsg = (typeof i18next !== 'undefined' && i18next.t('product.offer_cart_updated')) || 'Цену в корзине обновлено по согласованной ставке!';
                showToast(updateMsg, 'success');
                return;
            }
            showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_exist') : 'Уже в корзине!', 'error');
            return;
        }

        const cartItem = (typeof deepClone === 'function')
            ? deepClone(item)
            : ((typeof structuredClone === 'function') ? structuredClone(item) : { ...item });

        if (customPrice !== null && !Number.isNaN(customPrice) && customPrice > 0) {
            cartItem.price = Math.round(Number(customPrice));
            cartItem.bargainPrice = Math.round(Number(customPrice));
        } else {
            const hacked = (typeof window !== 'undefined' && window.isHacked) || (typeof isHacked !== 'undefined' && isHacked);
            if (hacked) {
                cartItem.price = Math.floor(cartItem.price * 0.9);
            }
        }
        currentCart.push(cartItem);
        setActiveCart(currentCart);

        if (typeof window !== 'undefined' && window.analytics && typeof window.analytics.trackAddToCart === 'function') {
            window.analytics.trackAddToCart(cartItem);
        } else if (typeof window !== 'undefined' && window.ttq) {
            ttq.track('AddToCart', {
                contents: [{ content_id: cartItem.id, content_name: cartItem.name }],
                value: cartItem.price,
                currency: 'UAH'
            });
        }

        updateCartUI();
        if (hasAction('showCartToast')) {
            invokeAction('showCartToast', item, true, getOptimizedImg(item));
        } else {
            showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_add') : 'Добавлено в корзину!', 'success', getOptimizedImg(item));
        }
        await syncCartToServer();
    });
}

/**
 * Добавляет товар в корзину с анимацией полёта миниатюры в корзину.
 * @param {string|number} itemId
 * @param {HTMLElement} btnElement
 * @param {Event} [event]
 */
export function addToCartWithAnimation(itemId, btnElement, event) {
    if (event) event.stopPropagation();

    const now = Date.now();
    if (now - cartState.lastCartActionTime < 350) return;
    cartState.lastCartActionTime = now;

    const catalog = (typeof window !== 'undefined' && window.allItems) || (typeof allItems !== 'undefined' ? allItems : []);
    const item = catalog.find(i => i.id === itemId);
    if (!item) return;

    addToCartById(itemId);

    if (typeof triggerHaptic === 'function') triggerHaptic('success');
    if (hasAction('warmupBackendServer')) invokeAction('warmupBackendServer');

    const cartIcon = document.getElementById('cartInfoWrapper');
    if (!cartIcon || !btnElement) return;

    const btnRect = btnElement.getBoundingClientRect();
    const flyingImg = document.createElement('div');
    flyingImg.className = 'flying-item';

    if (item.images && item.images.length > 0) {
        flyingImg.style.backgroundImage = `url('${getOptimizedImg(item)}')`;
    } else {
        flyingImg.style.backgroundColor = '#111';
    }

    flyingImg.style.left = `${btnRect.left + (btnRect.width / 2) - 30}px`;
    flyingImg.style.top = `${btnRect.top - 30}px`;

    document.body.appendChild(flyingImg);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            flyingImg.style.left = '20px';
            flyingImg.style.top = `${window.innerHeight - 60}px`;
            flyingImg.style.transform = 'scale(0.1) rotate(360deg)';
            flyingImg.style.opacity = '0.3';
        });
    });

    setTimeout(() => flyingImg.remove(), 850);
}

/**
 * Добавляет открытый в модалке товар в корзину.
 * @returns {Promise<void>}
 */
export async function addToCartFromModal() {
    return await withCartLock(async () => {
        const now = Date.now();
        if (now - cartState.lastCartActionTime < 350) return;
        cartState.lastCartActionTime = now;

        const activeItem = (typeof window !== 'undefined' && window.currentOpenedItem) || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
        if (!activeItem) return;

        const currentCart = getActiveCart();
        const existingIndex = currentCart.findIndex(i => String(i.id) === String(activeItem.id));

        let parsedBargain = null;
        try {
            const rawBargain = sessionStorage.getItem('accepted_bargain_' + activeItem.id) || localStorage.getItem('accepted_bargain_' + activeItem.id);
            if (rawBargain) {
                parsedBargain = JSON.parse(rawBargain);
            }
        } catch {}

        if (existingIndex !== -1) {
            if (parsedBargain && parsedBargain.acceptedPrice && currentCart[existingIndex].price !== Number(parsedBargain.acceptedPrice)) {
                currentCart[existingIndex].price = Number(parsedBargain.acceptedPrice);
                currentCart[existingIndex].bargainPrice = Number(parsedBargain.acceptedPrice);
                setActiveCart(currentCart);
                updateCartUI();
                if (typeof closeModal === 'function') closeModal('productModal');
                const updateMsg = (typeof i18next !== 'undefined' && i18next.t('product.offer_cart_updated')) || 'Цену в корзине обновлено по согласованной ставке!';
                showToast(updateMsg, 'success');
                syncCartToServer();
                return;
            }
            showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_exist') : 'Уже в корзине!', 'error');
            return;
        }

        const cartItem = (typeof deepClone === 'function')
            ? deepClone(activeItem)
            : ((typeof structuredClone === 'function') ? structuredClone(activeItem) : { ...activeItem });
        const hacked = (typeof window !== 'undefined' && window.isHacked) || (typeof isHacked !== 'undefined' && isHacked);
        if (hacked) {
            cartItem.price = Math.floor(cartItem.price * 0.9);
        }
        if (parsedBargain && parsedBargain.acceptedPrice) {
            cartItem.price = Number(parsedBargain.acceptedPrice);
            cartItem.bargainPrice = Number(parsedBargain.acceptedPrice);
        }
        currentCart.push(cartItem);
        setActiveCart(currentCart);
        updateCartUI();
        if (typeof closeModal === 'function') closeModal('productModal');
        if (hasAction('showCartToast')) {
            invokeAction('showCartToast', cartItem, true, getOptimizedImg(cartItem));
        } else {
            showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_add') : 'Добавлено в корзину!', 'success');
        }
        if (hasAction('warmupBackendServer')) invokeAction('warmupBackendServer');
        await syncCartToServer();
    });
}

/**
 * Удаляет товар из корзины (защищено от двойного клика/свайпа по ID и блокировкой Web Locks).
 * @param {number} index
 * @param {Event} [event]
 * @param {HTMLElement} [rowElement]
 * @returns {Promise<void>}
 */
export async function removeFromCart(index, event, rowElement) {
    if (event) event.stopPropagation();

    const startCart = getActiveCart();
    const removedItem = startCart[index];
    if (!removedItem) return;

    const removedId = removedItem.id;
    const removingCartIds = cartState.removingCartIds;
    if (removingCartIds.has(removedId)) return;
    removingCartIds.add(removedId);

    const imgUrl = getOptimizedImg(removedItem);

    const executeRemoval = async () => {
        try {
            const liveCart = getActiveCart();
            const liveIndex = liveCart.findIndex(i => i && i.id === removedId);
            if (liveIndex === -1) return;

            liveCart.splice(liveIndex, 1);
            setActiveCart(liveCart);
            if (liveCart.length === 0) {
                const dropdown = document.getElementById('cartDropdown');
                const panel = document.getElementById('cartPanel');
                if (dropdown) {
                    dropdown.classList.remove('active');
                    clearDropdownInlineStyles(dropdown);
                }
                if (panel) {
                    panel.classList.remove('show', 'dropdown-open');
                }
                closeCartDropdown();
            }
            updateCartUI();
            if (hasAction('showCartToast')) {
                invokeAction('showCartToast', removedItem, false, imgUrl);
            } else {
                showToast(`${typeof i18next !== 'undefined' ? i18next.t('messages.cart_delete') : 'Удалено: '}${removedItem.name}`, 'error', imgUrl);
            }
            await syncCartToServer();
        } finally {
            removingCartIds.delete(removedId);
        }
    };

    const lockedRemoval = () => withCartLock(executeRemoval);
    if (rowElement) {
        rowElement.classList.add('removing');
        setTimeout(lockedRemoval, 300);
    } else {
        await lockedRemoval();
    }
}

registerActions({
    syncCartToServer,
    addToCartById,
    addToCartWithAnimation,
    addToCartFromModal,
    removeFromCart
});

if (typeof window !== 'undefined') {
    window.syncCartToServer = syncCartToServer;
    window.addToCartById = addToCartById;
    window.addToCartWithAnimation = addToCartWithAnimation;
    window.removeFromCart = removeFromCart;
}
