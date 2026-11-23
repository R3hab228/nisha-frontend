// ==========================================
// NISHA CART CORE (EAGER LIGHTWEIGHT ENTRYPOINT)
// Содержит только бейдж, дропдаун корзины и операции add/remove.
// Тяжёлые модули чекаута и Новой Почты вынесены в lazy chunk `checkout-bundle.js`.
// ==========================================

import { initCartHoverDesktop, initCartScrollIsolation } from './cart-ui.js';

export * from './cart-state.js';
export * from './cart-ui.js';
export * from './cart-operations.js';

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initCartHoverDesktop();
            initCartScrollIsolation();
        });
    } else {
        initCartHoverDesktop();
        initCartScrollIsolation();
    }
}
