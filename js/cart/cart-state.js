// ==========================================
// NISHA CART — SHARED STATE, LOCKS & HELPERS
// ==========================================

const getInitialStorage = () => (typeof window !== 'undefined' && window.storage)
    || (typeof storage !== 'undefined' ? storage : null);

if (typeof window !== 'undefined') {
    if (!window.cart) {
        const store = getInitialStorage();
        window.cart = store ? store.getJSON('nisha_cart', []) : [];
    }
    window.currentPromoDiscount = window.currentPromoDiscount || 0;
    window.appliedPromoCode = window.appliedPromoCode || '';
    window.selectedCityRef = window.selectedCityRef || '';
    window.selectedBranchRef = window.selectedBranchRef || '';
}

export const cartState = {
    cart: (typeof window !== 'undefined' && window.cart) ? window.cart : [],
    currentPromoDiscount: 0,
    appliedPromoCode: '',
    selectedCityRef: '',
    selectedBranchRef: '',
    citySearchTimeout: null,
    branchSearchTimeout: null,
    cachedBranches: [],
    npBranchCache: {},
    npBranchCacheComplete: {},
    cartSwipeStartX: 0,
    cartSwipeCurrentX: 0,
    lastCartActionTime: 0,
    isCheckoutOpening: false,
    isOrderSubmitting: false,
    removingCartIds: new Set()
};

// Флаг оформления заказа виден другим модулям (например, баннеру обновления Service Worker)
if (typeof window !== 'undefined') {
    try {
        Object.defineProperty(window, 'isOrderSubmitting', {
            get: () => cartState.isOrderSubmitting,
            configurable: true
        });
    } catch {}
}

/**
 * Устанавливает реф выбранного города и синхронизирует `window.selectedCityRef`.
 * @param {string} ref
 */
export function setSelectedCityRefState(ref) {
    const val = ref || '';
    cartState.selectedCityRef = val;
    if (typeof window !== 'undefined') window.selectedCityRef = val;
}

/**
 * Устанавливает реф выбранного отделения и синхронизирует `window.selectedBranchRef`.
 * @param {string} ref
 */
export function setSelectedBranchRefState(ref) {
    const val = ref || '';
    cartState.selectedBranchRef = val;
    if (typeof window !== 'undefined') window.selectedBranchRef = val;
}

/**
 * Экранирует HTML-спецсимволы для безопасного рендера строк корзины.
 * @param {any} value
 * @returns {string}
 */
export function escCartHtml(value) {
    return String(value == null ? '' : value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Извлекает целочисленную цену товара.
 * @param {number|string} price
 * @returns {number}
 */
export function parseCartPrice(price) {
    return Number.parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
}

/**
 * Полностью сбрасывает применённый промокод (после заказа / при пустой корзине).
 */
export function resetPromoState() {
    cartState.currentPromoDiscount = 0;
    cartState.appliedPromoCode = '';
    if (typeof window !== 'undefined') {
        window.currentPromoDiscount = 0;
        window.appliedPromoCode = '';
        window.currentPromoFixed = null;
    }
    const promoInput = document.getElementById('promoInput');
    if (promoInput) promoInput.value = '';
    const promoMsg = document.getElementById('promoMessage');
    if (promoMsg) {
        if (typeof promoMsg.replaceChildren === 'function') promoMsg.replaceChildren();
        else promoMsg.innerHTML = '';
    }
}

/**
 * Рендерит минималистичное уведомление статуса промокода (без свечений).
 * @param {object} [options]
 * @returns {string}
 */
export function renderPromoCodeNotice(options = {}) {
    const { isError, isWarning, message, percent, savedMoney, isFixed } = options;
    const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;
    const escapeSafe = (s) => String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

    if (isError) {
        const errorText = escapeSafe(message || t('checkout.promo_invalid', 'Неверный промокод'));
        return `<div class="promo-notice promo-notice-error"><div class="promo-notice-header"><span class="promo-notice-icon">[!]</span><span class="promo-notice-title">${errorText}</span></div></div>`;
    }

    if (isWarning) {
        const warningText = escapeSafe(message || t('checkout.promo_warming', 'Сервер запускается, нажмите «Применить» ещё раз'));
        return `<div class="promo-notice promo-notice-warning"><div class="promo-notice-header"><span class="promo-notice-icon">[!]</span><span class="promo-notice-title">${warningText}</span></div></div>`;
    }

    const curSuffix = (typeof getCurrency === 'function') ? getCurrency() : ((typeof i18next !== 'undefined' && i18next.language === 'en') ? 'UAH' : 'грн');
    const safeSaved = Number(savedMoney) || 0;
    const formattedSaved = (typeof formatPrice === 'function') ? formatPrice(safeSaved) : `${safeSaved} ${curSuffix}`;
    const codeAppliedText = t('checkout.promo_applied', 'Код активовано');
    const discountLabel = t('checkout.promo_order_discount', 'Знижка на замовлення:');

    let headerHtml = '';
    let detailHtml = '';

    if (isFixed) {
        headerHtml = `<span class="promo-notice-icon">[✓]</span><span class="promo-notice-title">${codeAppliedText}</span>`;
        detailHtml = `<div class="promo-notice-savings">${discountLabel} <span class="promo-notice-val">-${formattedSaved}</span></div>`;
    } else {
        const safePercent = Number(percent) || 0;
        const pctDisplay = safePercent > 0 ? `-${safePercent}%` : '';
        headerHtml = `<span class="promo-notice-icon">[✓]</span><span class="promo-notice-title">${codeAppliedText}${pctDisplay ? `: <span class="promo-notice-pct">${pctDisplay}</span>` : ''}</span>`;
        detailHtml = `<div class="promo-notice-savings">${discountLabel} <span class="promo-notice-val">-${formattedSaved}</span></div>`;
    }

    return `<div class="promo-notice promo-notice-success"><div class="promo-notice-header">${headerHtml}</div>${detailHtml}</div>`;
}

/**
 * Очищает inline-стили cartDropdown (чтобы не блокировать CSS :hover на ПК).
 * @param {HTMLElement|null} el
 */
export function clearDropdownInlineStyles(el) {
    if (!el || !el.style) return;
    el.style.removeProperty('display');
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
    el.style.removeProperty('transform');
}

/**
 * Возвращает актуальный массив товаров корзины.
 * @returns {any[]}
 */
export function getActiveCart() {
    if (typeof window !== 'undefined' && window.store && typeof window.store.get === 'function') {
        return window.store.get('cart') || [];
    }
    return (typeof window !== 'undefined' ? window.cart : null) || cartState.cart || [];
}

/**
 * Сохраняет массив товаров корзины и обновляет реактивное хранилище.
 * @param {any[]} newCart
 */
export function setActiveCart(newCart) {
    cartState.cart = newCart;
    if (typeof window !== 'undefined') {
        window.cart = newCart;
        if (window.store && typeof window.store.set === 'function') {
            window.store.set('cart', newCart);
        } else {
            const store = getInitialStorage();
            if (store) store.setJSON('nisha_cart', newCart);
        }
    }
}

/**
 * Возвращает текущего пользователя Supabase или `null`.
 * @returns {any}
 */
export function getCurrentUser() {
    return (typeof window !== 'undefined' && window.currentUser) || (typeof currentUser !== 'undefined' ? currentUser : null);
}

/**
 * Возвращает клиент Supabase или `null`.
 * @returns {any}
 */
export function getSupabaseClient() {
    return (typeof window !== 'undefined' && window._supabase) || (typeof _supabase !== 'undefined' ? _supabase : null);
}

/**
 * Координатор безопасных мутаций корзины через Web Locks API (PWA и мультивкладочность).
 * @template T
 * @param {() => Promise<T>|T} fn
 * @returns {Promise<T>}
 */
export async function withCartLock(fn) {
    if (typeof window !== 'undefined' && typeof window.withWebLock === 'function') {
        return await window.withWebLock('nisha_cart_lock', fn);
    }
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        try {
            return await navigator.locks.request('nisha_cart_lock', fn);
        } catch (_) {
            return await fn();
        }
    }
    return await fn();
}

/**
 * Координатор безопасного оформления заказа через Web Locks API.
 * @template T
 * @param {() => Promise<T>|T} fn
 * @returns {Promise<T>}
 */
export async function withCheckoutLock(fn) {
    if (typeof window !== 'undefined' && typeof window.withWebLock === 'function') {
        return await window.withWebLock('nisha_checkout_lock', fn);
    }
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        try {
            return await navigator.locks.request('nisha_checkout_lock', fn);
        } catch (_) {
            return await fn();
        }
    }
    return await fn();
}

if (typeof window !== 'undefined') {
    window.getActiveCart = getActiveCart;
    window.setActiveCart = setActiveCart;
    window.withCartLock = withCartLock;
    window.withCheckoutLock = withCheckoutLock;
    window.renderPromoCodeNotice = renderPromoCodeNotice;
    window.clearDropdownInlineStyles = clearDropdownInlineStyles;
}
