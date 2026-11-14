// ==========================================
// NISHA PRODUCT MODAL, GALLERY & Q&A ENTRYPOINT
// Modular ES barrel re-exporting all product submodules.
// ==========================================

import { initSliderSwipe } from './product-gallery.js';
import { initProductQASubscription } from './product-qa.js';
import { bindBargainKeyboardShortcuts } from './product-bargain.js';

export * from './product-state.js';
export * from './product-gallery.js';
export * from './product-history.js';
export * from './product-qa.js';
export * from './product-bargain.js';
export * from './product-modal.js';

/**
 * Initializes swipe gestures, realtime Q&A channel, and inline bargain keyboard shortcuts.
 */
export function initProductModule() {
    initSliderSwipe();
    initProductQASubscription();
    bindBargainKeyboardShortcuts();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProductModule);
    } else {
        initProductModule();
    }
}
