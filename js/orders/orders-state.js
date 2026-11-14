// ==========================================
// NISHA ORDERS STATE, FORMATTERS & TRACKING HELPERS
// ==========================================

import { resolveAction } from '../core/action-registry.js';

function getReactiveStore() {
    if (typeof window !== 'undefined' && window.store && typeof window.store.get === 'function' && typeof window.store.set === 'function') {
        return window.store;
    }
    if (typeof globalThis !== 'undefined' && globalThis.store && typeof globalThis.store.get === 'function' && typeof globalThis.store.set === 'function') {
        return globalThis.store;
    }
    return null;
}

export function getOrdersData() {
    const s = getReactiveStore();
    if (s) {
        const list = s.get('globalOrdersData');
        if (Array.isArray(list)) return list;
    }
    if (typeof window !== 'undefined' && Array.isArray(window.globalOrdersData)) {
        return window.globalOrdersData;
    }
    return [];
}

export function setOrdersData(nextList) {
    const safeList = Array.isArray(nextList) ? nextList : [];
    const s = getReactiveStore();
    if (s) {
        s.set('globalOrdersData', safeList);
    } else if (typeof window !== 'undefined') {
        window.globalOrdersData = safeList;
    }
}

export function getCurrentOrderTab() {
    const s = getReactiveStore();
    if (s) {
        const tab = s.get('currentOrderTab');
        if (tab) return tab;
    }
    if (typeof window !== 'undefined' && window.currentOrderTab) {
        return window.currentOrderTab;
    }
    return 'accepted';
}

export function setCurrentOrderTab(tab) {
    const nextTab = tab || 'accepted';
    const s = getReactiveStore();
    if (s) {
        s.set('currentOrderTab', nextTab);
    } else if (typeof window !== 'undefined') {
        window.currentOrderTab = nextTab;
    }
}

export function getOrderItemsImageCache() {
    if (typeof window !== 'undefined') {
        if (!window.orderItemsImageCache || typeof window.orderItemsImageCache !== 'object') {
            window.orderItemsImageCache = {};
        }
        return window.orderItemsImageCache;
    }
    return {};
}

// Инициализируем начальные значения в совместимом слое, если ещё не заданы
if (typeof window !== 'undefined') {
    if (typeof window.globalOrdersData === 'undefined') window.globalOrdersData = [];
    if (typeof window.currentOrderTab === 'undefined') window.currentOrderTab = 'accepted';
    if (typeof window.orderItemsImageCache === 'undefined') window.orderItemsImageCache = {};
}

export function getStorage() {
    if (typeof window !== 'undefined' && window.storage) return window.storage;
    if (typeof storage !== 'undefined') return storage;
    return null;
}

export function getSupabase() {
    if (typeof window !== 'undefined' && window.getSupabase && typeof window.getSupabase === 'function') {
        return window.getSupabase();
    }
    const fn = resolveAction('getSupabase');
    if (fn) {
        const res = fn();
        if (res) return res;
    }
    return (typeof window !== 'undefined' && (window.supabaseClient || window._supabase)) || null;
}

export const toCDN = (u) => {
    const fn = resolveAction('toCDN');
    return fn ? fn(u) : (u || '');
};

export const escHtml = (v) => {
    const fn = resolveAction('escapeHtml');
    return fn ? fn(v) : String(v || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
};

export const escAttr = (v) => {
    const fn = resolveAction('escapeAttr');
    return fn ? fn(v) : String(v || '').replaceAll('"', '&quot;');
};

export const fmtPrice = (v) => {
    const fn = resolveAction('formatPrice');
    if (fn) return fn(v);
    const curr = (typeof i18next !== 'undefined' && i18next.language === 'en') ? 'UAH' : 'грн';
    return `${v} ${curr}`;
};

export function formatOrderDate(rawDate) {
    const ms = typeof rawDate === 'number' ? rawDate : Date.parse(rawDate);
    if (!Number.isFinite(ms)) return '';
    const d = new Date(ms);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// Локализация статусов заказов для всех поддерживаемых языков (RU, UA, EN)
export function formatOrderStatus(rawStatus) {
    if (!rawStatus) return '';
    const s = String(rawStatus).trim().toLowerCase();
    const tr = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;

    if (s.includes('отмен') || s.includes('скас') || s.includes('cancel') || s.includes('возврат') || s.includes('поверн')) {
        return tr('orders_modal.status_cancelled', 'ОТМЕНЕН').toUpperCase();
    }
    if (s.includes('заверш') || s.includes('выполнен') || s.includes('получен') || s.includes('доставлен') || s.includes('complet') || s.includes('deliver')) {
        return tr('orders_modal.status_completed', 'ЗАВЕРШЕН').toUpperCase();
    }
    if (s.includes('отправ') || s.includes('відправ') || s.includes('ship')) {
        return tr('orders_modal.status_shipped', 'ОТПРАВЛЕН').toUpperCase();
    }
    if (s.includes('оплач') || s.includes('paid')) {
        return tr('orders_modal.status_paid', 'ОПЛАЧЕН').toUpperCase();
    }
    if (s.includes('принят') || s.includes('прийнят') || s.includes('accept')) {
        return tr('orders_modal.status_accepted', 'ПРИНЯТ').toUpperCase();
    }
    if (s.includes('обработ') || s.includes('оброб') || s.includes('process') || s.includes('нов')) {
        return tr('orders_modal.status_processing', 'В ОБРАБОТКЕ').toUpperCase();
    }

    return String(rawStatus).toUpperCase();
}

// Вспомогательная группировка заказов по статусам для вкладок (через Object.groupBy)
export function getOrderTabBucket(order) {
    const s = (order?.status || '').toLowerCase();
    if (s.includes('принят') || s.includes('оплачен') || s.includes('обработке') || s.includes('processing') || s.includes('новый')) {
        return 'accepted';
    }
    if (s.includes('отправлен') || s.includes('завершен')) {
        return 'shipped';
    }
    if (s.includes('отменен') || s.includes('возврат')) {
        return 'cancelled';
    }
    return 'other';
}

export function encodeNovaPoshtaTtn(ttn) {
    const clean = String(ttn || '').replace(/\D+/g, '');
    if (!clean) return '';
    try {
        const b64 = (typeof btoa === 'function' ? btoa(clean) : Buffer.from(clean).toString('base64')).replace(/=+$/, '');
        const chars = b64.split('');
        return (typeof chars.toReversed === 'function' ? chars.toReversed() : chars.reverse()).join('');
    } catch (_) {
        return clean;
    }
}

export function getNovaPoshtaTrackingUrl(ttn, lang) {
    const cleanTtn = String(ttn || '').trim();
    if (!cleanTtn) return 'https://tracking.novaposhta.ua/';
    const currentLang = lang || ((typeof i18next !== 'undefined' && i18next.language === 'ru') ? 'ru' : 'uk');
    const encFn = resolveAction('safeEncodeURIComponent');
    const encoded = encodeNovaPoshtaTtn(cleanTtn) || (encFn ? encFn(cleanTtn) : encodeURIComponent(cleanTtn));
    return `https://tracking.novaposhta.ua/#/${currentLang}/${encoded}`;
}
