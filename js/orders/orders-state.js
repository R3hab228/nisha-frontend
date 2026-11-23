// ==========================================
// NISHA ORDERS STATE, FORMATTERS & TRACKING HELPERS
// ==========================================

import { resolveAction } from '../core/action-registry.js';
import { getRuntimeSiteLang, getRuntimeStorage, getRuntimeUser } from '../core/runtime-env.js';

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

const HIDDEN_ORDERS_STORAGE_KEY = 'nisha_hidden_orders_v1';

function getHiddenOrdersStorageKey() {
    const activeUser = getRuntimeUser();
    const uid = activeUser && activeUser.id ? String(activeUser.id).trim() : '';
    return uid ? `nisha_hidden_orders_${uid}` : HIDDEN_ORDERS_STORAGE_KEY;
}

function normalizeOrderIdList(list) {
    if (!Array.isArray(list) || list.length === 0) return [];
    const seen = new Set();
    for (const rawId of list) {
        const clean = rawId === undefined || rawId === null ? '' : String(rawId).trim();
        if (clean) seen.add(clean);
    }
    return Array.from(seen).slice(-200);
}

function syncActiveUserHiddenMetadata(mergedIds) {
    const activeUser = getRuntimeUser();
    if (!activeUser || typeof activeUser !== 'object') return;
    if (!activeUser.user_metadata || typeof activeUser.user_metadata !== 'object') {
        activeUser.user_metadata = {};
    }
    activeUser.user_metadata.hidden_order_ids = mergedIds;
}

function readOrderJsonStorage(key, fallback) {
    const store = getRuntimeStorage();
    if (store && typeof store.getJSON === 'function') {
        return store.getJSON(key, fallback);
    }
    if (typeof localStorage !== 'undefined') {
        try {
            const raw = localStorage.getItem(key);
            if (raw !== null) return JSON.parse(raw);
        } catch {}
    }
    return fallback;
}

function writeOrderJsonStorage(key, value) {
    const store = getRuntimeStorage();
    if (store && typeof store.setJSON === 'function') {
        store.setJSON(key, value);
        return;
    }
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {}
    }
}

export function getHiddenOrderIds() {
    const localList = readOrderJsonStorage(getHiddenOrdersStorageKey(), []);
    const activeUser = getRuntimeUser();
    const remoteList = activeUser?.user_metadata?.hidden_order_ids;
    return new Set([
        ...normalizeOrderIdList(localList),
        ...normalizeOrderIdList(remoteList)
    ]);
}

function mergeAndPersistHiddenOrderIds(ids) {
    const incoming = normalizeOrderIdList(ids);
    if (incoming.length === 0) return { changed: false, merged: Array.from(getHiddenOrderIds()) };
    const existingSet = getHiddenOrderIds();
    const changed = incoming.some((id) => !existingSet.has(id));
    const merged = normalizeOrderIdList([...existingSet, ...incoming]);
    writeOrderJsonStorage(getHiddenOrdersStorageKey(), merged);
    syncActiveUserHiddenMetadata(merged);
    return { changed, merged };
}

export function hideOrderIds(ids) {
    mergeAndPersistHiddenOrderIds(ids);
}

export function mergeRemoteHiddenOrderIds(ids) {
    return mergeAndPersistHiddenOrderIds(ids).changed;
}

export function pruneCachedOrdersByIds(ids) {
    const selectedSet = new Set(Array.isArray(ids) ? ids.map(String) : []);
    if (selectedSet.size === 0) return;
    const cached = readOrderJsonStorage('nisha_cached_orders', null);
    if (Array.isArray(cached) && cached.length > 0) {
        writeOrderJsonStorage('nisha_cached_orders', cached.filter(o => o && !selectedSet.has(String(o.id))));
    }
}

export function setOrdersData(nextList) {
    const hiddenSet = getHiddenOrderIds();
    const rawList = Array.isArray(nextList) ? nextList : [];
    const safeList = hiddenSet.size > 0
        ? rawList.filter(o => o && !hiddenSet.has(String(o.id)))
        : rawList;
    if (selectedOrderIds.size > 0) {
        const visibleIds = new Set(safeList.map(o => String(o?.id)));
        for (const selId of selectedOrderIds) {
            if (!visibleIds.has(selId)) selectedOrderIds.delete(selId);
        }
    }
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
    return getRuntimeStorage();
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
    return fn
        ? fn(v)
        : String(v || '')
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
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

const ORDER_STATUS_FALLBACKS = Object.freeze({
    status_cancelled: { ua: 'СКАСОВАНО', ru: 'ОТМЕНЕН', en: 'CANCELLED' },
    status_completed: { ua: 'ЗАВЕРШЕНО', ru: 'ЗАВЕРШЕН', en: 'COMPLETED' },
    status_shipped: { ua: 'ВІДПРАВЛЕНО', ru: 'ОТПРАВЛЕН', en: 'SHIPPED' },
    status_paid: { ua: 'ОПЛАЧЕНО', ru: 'ОПЛАЧЕН', en: 'PAID' },
    status_accepted: { ua: 'ПРИЙНЯТО', ru: 'ПРИНЯТ', en: 'ACCEPTED' },
    status_processing: { ua: 'В ОБРОБЦІ', ru: 'В ОБРАБОТКЕ', en: 'PROCESSING' }
});

// Локализация статусов заказов для всех поддерживаемых языков (RU, UA, EN)
export function formatOrderStatus(rawStatus) {
    if (!rawStatus) return '';
    const s = String(rawStatus).trim().toLowerCase();
    const lang = getRuntimeSiteLang();
    const tr = (statusKey) => {
        const map = ORDER_STATUS_FALLBACKS[statusKey] || {};
        const def = map[lang] || map.ua || '';
        const text = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
            ? i18next.t(`orders_modal.${statusKey}`, { defaultValue: def })
            : def;
        return String(text || def).toUpperCase();
    };

    if (s.includes('отмен') || s.includes('скас') || s.includes('cancel') || s.includes('возврат') || s.includes('поверн')) {
        return tr('status_cancelled');
    }
    if (s.includes('заверш') || s.includes('выполнен') || s.includes('получен') || s.includes('доставлен') || s.includes('complet') || s.includes('deliver')) {
        return tr('status_completed');
    }
    if (s.includes('отправ') || s.includes('відправ') || s.includes('ship')) {
        return tr('status_shipped');
    }
    if (s.includes('оплач') || s.includes('paid')) {
        return tr('status_paid');
    }
    if (s.includes('принят') || s.includes('прийнят') || s.includes('accept')) {
        return tr('status_accepted');
    }
    if (s.includes('обработ') || s.includes('оброб') || s.includes('process') || s.includes('нов')) {
        return tr('status_processing');
    }

    return String(rawStatus).toUpperCase();
}

// Вспомогательная группировка заказов по статусам для вкладок (через Object.groupBy)
export function getOrderTabBucket(order) {
    const s = (order?.status || '').toLowerCase();
    if (
        s.includes('принят') || s.includes('прийнят') || s.includes('accept') ||
        s.includes('оплачен') || s.includes('оплач') || s.includes('paid') ||
        s.includes('обработ') || s.includes('оброб') || s.includes('processing') || s.includes('новый') || s.includes('нов')
    ) {
        return 'accepted';
    }
    if (s.includes('отправлен') || s.includes('відправ') || s.includes('ship') || s.includes('завершен') || s.includes('complet')) {
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

const selectedOrderIds = new Set();

export function getSelectedOrderIds() {
    return Array.from(selectedOrderIds);
}

export function isOrderSelected(orderId) {
    if (orderId === undefined || orderId === null || orderId === '') return false;
    return selectedOrderIds.has(String(orderId));
}

export function hasSelectedOrders() {
    return selectedOrderIds.size > 0;
}

export function toggleOrderSelection(orderId, force) {
    if (orderId === undefined || orderId === null || orderId === '') return false;
    const key = String(orderId);
    const shouldSelect = typeof force === 'boolean' ? force : !selectedOrderIds.has(key);
    if (shouldSelect) {
        selectedOrderIds.add(key);
    } else {
        selectedOrderIds.delete(key);
    }
    return shouldSelect;
}

export function clearOrderSelection() {
    selectedOrderIds.clear();
}
