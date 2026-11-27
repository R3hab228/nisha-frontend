// @ts-check
// ==========================================
// NISHA CHECKOUT & NOVA POSHTA BUNDLE (LAZY-LOADED ON DEMAND)
// Подгружается через `lazy-loader.js` только при открытии оформления заказа.
// ==========================================

import { initPaymentPopoverSync } from './checkout-form.js';

export * from './npCacheStorage.js';
export * from './novaposhta-helpers.js';
export * from './novaposhta-delivery.js';
export * from './checkout-form.js';
export * from './checkout-submit.js';

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPaymentPopoverSync);
    } else {
        initPaymentPopoverSync();
    }
}
