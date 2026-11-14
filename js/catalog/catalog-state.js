// ==========================================
// NISHA CATALOG — SHARED STATE & CORE ACCESSORS
// ==========================================

import { getRuntimeStorage, getRuntimeSupabase } from '../core/runtime-env.js';

if (typeof window !== 'undefined') {
    if (!window.allItems) window.allItems = [];
    if (!window.filteredItems) window.filteredItems = [];
    window.renderedCount = 0;
    window.currentPage = 1;
    window.currentCategory = '';
    window.currentBrand = '';
    window.showingOnlyFavs = false;
}

// Запрещаем браузеру восстанавливать скролл при перезагрузке страницы
if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

/**
 * Возвращает хранилище приложения (`window.storage` или глобальный `storage`).
 * @returns {any}
 */
export function getCatalogStore() {
    return getRuntimeStorage();
}

/**
 * Возвращает инстанс клиента Supabase.
 * @returns {any}
 */
export function getSupabaseClient() {
    return getRuntimeSupabase();
}

/**
 * Возвращает нормализованный код языка сайта (`ua` | `ru` | `en`).
 * @returns {'ua'|'ru'|'en'}
 */
export function getCurrentSiteLang() {
    const store = getCatalogStore();
    let l = store ? (store.get('nisha_lang') || store.get('i18nextLng') || 'ua') : 'ua';
    l = String(l).substring(0, 2).toLowerCase();
    if (l === 'uk') l = 'ua';
    if (!['ru', 'ua', 'en'].includes(l)) l = 'ua';
    return l;
}
