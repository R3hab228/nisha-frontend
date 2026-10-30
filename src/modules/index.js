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

// Default export grouping core services for convenience
import store from './store.js';
import apiClient from './apiClient.js';
import * as helpers from './helpers.js';
import * as windows from './windows.js';
import * as i18n from './i18n.js';
import * as telemetry from './telemetry.js';
import * as catalog from './catalog.js';
import * as cart from './cart.js';

export default {
    store,
    apiClient,
    helpers,
    windows,
    i18n,
    telemetry,
    catalog,
    cart
};
