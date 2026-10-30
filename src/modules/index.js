// ==========================================
// NISHA STORE - UNIFIED ES MODULES BARREL
// Modern modular architecture facade for core frontend services
// ==========================================

export * from './store.js';
export * from './apiClient.js';
export * from './helpers.js';
export * from './windows.js';
export * from './i18n.js';
export * from './telemetry.js';
export * from './catalog.js';
export * from './cart.js';
export * from './product.js';
export * from './analytics.js';
export * from './reviews.js';
export * from './orders.js';
export * from './drop.js';
export * from './profile.js';

// Default export grouping core services for convenience
import store from './store.js';
import apiClient from './apiClient.js';
import * as helpers from './helpers.js';
import * as windows from './windows.js';
import * as i18n from './i18n.js';
import * as telemetry from './telemetry.js';
import * as catalog from './catalog.js';
import * as cart from './cart.js';
import * as product from './product.js';
import * as analytics from './analytics.js';
import * as reviews from './reviews.js';
import * as orders from './orders.js';
import * as drop from './drop.js';
import * as profile from './profile.js';

export default {
    store,
    apiClient,
    helpers,
    windows,
    i18n,
    telemetry,
    catalog,
    cart,
    product,
    analytics,
    reviews,
    orders,
    drop,
    profile
};
