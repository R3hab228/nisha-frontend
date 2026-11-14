// ==========================================
// NISHA CART, CHECKOUT & DELIVERY MODULE (MODULAR ENTRYPOINT)
// Порядок импортов строго сохраняет порядок инициализации и side-effects.
// ==========================================

import { initCartHoverDesktop, initCartScrollIsolation } from './cart-ui.js';
import { initPaymentPopoverSync } from './checkout-form.js';

export * from './npCacheStorage.js';
export * from './cart-state.js';
export * from './cart-ui.js';
export * from './cart-operations.js';
export * from './novaposhta-helpers.js';
export * from './novaposhta-delivery.js';
export * from './checkout-form.js';
export * from './checkout-submit.js';

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initCartHoverDesktop();
            initCartScrollIsolation();
            initPaymentPopoverSync();
        });
    } else {
        initCartHoverDesktop();
        initCartScrollIsolation();
        initPaymentPopoverSync();
    }
}
