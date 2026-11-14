// ==========================================
// NISHA PROFILE FAVORITES / LIKES MODULE
// ==========================================

import {
    profileState,
    getSupabase,
    getStore,
    getCatalog,
    tProfile,
    notifyToast,
    getGlobalFn,
    bindWindowFn,
    syncProfileFavoritesCounters
} from './profile-state.js';

let isTogglingFav = false; // Защита от двойного клика

/**
 * Updates the header favorites badge count.
 */
export function updateFavBadge() {
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('favCountBadge');
    const favs = Array.isArray(profileState.favorites) ? profileState.favorites : [];
    if (badge) badge.innerText = `[${favs.length}]`;
}
bindWindowFn('updateFavBadge', updateFavBadge);

/**
 * Persists favorites to storage/reactive store and syncs profile counters + badge.
 * @param {any[]} nextFavs
 */
function persistFavoritesCache(nextFavs) {
    profileState.favorites = nextFavs;
    const store = getStore();
    if (store && typeof store.setJSON === 'function') {
        store.setJSON('nisha_cached_favorites', nextFavs);
    }
    syncProfileFavoritesCounters(nextFavs);
    updateFavBadge();
}

/**
 * Loads authenticated user's favorite item IDs from Supabase and syncs UI/filter state.
 */
export async function loadFavorites() {
    if (!profileState.currentUser) return;
    const sb = getSupabase();
    if (!sb) return;

    const { data, error } = await sb.from('favorites').select('item_id').eq('user_id', profileState.currentUser.id);
    if (data && !error) {
        const nextFavs = data.map(f => f.item_id);
        persistFavoritesCache(nextFavs);

        if (window.showingOnlyFavs && typeof applyFilters === 'function') {
            applyFilters();
        } else if (window.showingOnlyFavs) {
            getGlobalFn('applyFilters')?.();
        }
    } else {
        updateFavBadge();
    }
}
bindWindowFn('loadFavorites', loadFavorites);

/**
 * Executes single favorite toggle with 300ms double-click guard, DOM star sync, and Supabase mutation.
 * @param {string|number} itemId
 */
export async function executeToggleFav(itemId) {
    if (isTogglingFav) return;
    isTogglingFav = true;
    setTimeout(() => { isTogglingFav = false; }, 300);

    const hapticFn = getGlobalFn('triggerHaptic');
    if (hapticFn) hapticFn('light');

    const currentFavs = Array.isArray(profileState.favorites) ? profileState.favorites : [];
    const isFav = currentFavs.includes(itemId);
    const nextFavs = isFav ? currentFavs.filter(id => id !== itemId) : [...currentFavs, itemId];

    persistFavoritesCache(nextFavs);

    if (typeof window !== 'undefined' && window.analytics && typeof window.analytics.trackFavorite === 'function') {
        window.analytics.trackFavorite(itemId, !isFav);
    }

    if (typeof document !== 'undefined') {
        // Звезда в сетке товаров
        const gridStar = document.querySelector(`.item-card[data-id="${itemId}"] .fav-star`);
        if (gridStar) {
            gridStar.classList.toggle('active', !isFav);
            gridStar.style.color = !isFav ? 'var(--accent-red)' : '#444';
        }

        // Звезда в открытой модалке товара
        const opened = (typeof window !== 'undefined' && window.currentOpenedItem)
            || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
        if (opened && opened.id === itemId) {
            const modalStar = document.getElementById('modalFavStar');
            if (modalStar) {
                modalStar.classList.toggle('active', !isFav);
                modalStar.style.color = !isFav ? 'var(--accent-red)' : '#444';
            }
        }
    }

    // Синхронизация с БД и уведомление
    const catalog = getCatalog();
    const itemObj = catalog.find(i => i.id === itemId);
    let imgUrl = null;
    if (itemObj) {
        const imgFn = getGlobalFn('getOptimizedImageUrl');
        if (imgFn) imgUrl = imgFn(itemObj, true);
    }

    const sb = getSupabase();
    if (sb && profileState.currentUser) {
        try {
            if (isFav) {
                await sb.from('favorites').delete().match({ user_id: profileState.currentUser.id, item_id: itemId });
                const favToastDelFn = getGlobalFn('showFavoriteToast');
                if (favToastDelFn) {
                    favToastDelFn(itemObj, false, imgUrl);
                } else {
                    notifyToast(tProfile('messages.fav_remove', 'Удалено из избранного'), 'success', imgUrl);
                }
            } else {
                await sb.from('favorites').insert([{ user_id: profileState.currentUser.id, item_id: itemId }]);
                const favToastAddFn = getGlobalFn('showFavoriteToast');
                if (favToastAddFn) {
                    favToastAddFn(itemObj, true, imgUrl);
                } else {
                    notifyToast(tProfile('messages.fav_add', 'Добавлено в избранное'), 'success', imgUrl);
                }
            }
        } catch (err) {
            console.error('Ошибка лайка:', err);
        }
    }
}

/**
 * Handles favorite toggle button click under Web Lock protection when available.
 * @param {Event|null} event
 * @param {string|number} itemId
 */
export async function toggleFav(event, itemId) {
    getGlobalFn('triggerVibration')?.(150);
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!profileState.currentUser) {
        notifyToast(tProfile('messages.cart_error_auth', 'Пожалуйста, войдите в аккаунт'), 'error');
        return;
    }

    const lockFn = getGlobalFn('withWebLock');
    if (lockFn) {
        return await lockFn('nisha_fav_lock', async () => executeToggleFav(itemId));
    }
    return await executeToggleFav(itemId);
}
bindWindowFn('toggleFav', toggleFav);

/**
 * Toggles the catalog "only favorites" filter view.
 */
export function filterFavorites() {
    if (!profileState.currentUser) {
        notifyToast(tProfile('messages.cart_error_auth', 'Пожалуйста, войдите в аккаунт'), 'error');
        return;
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
    }
    const currentFavState = window.showingOnlyFavs || false;
    window.showingOnlyFavs = !currentFavState;
    const store = getStore();
    if (store && store.session) {
        store.session.set('nisha_showing_favs', window.showingOnlyFavs);
    } else {
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('nisha_showing_favs', window.showingOnlyFavs);
            }
        } catch {}
    }

    if (typeof document !== 'undefined') {
        const favNav = document.getElementById('favNav');
        if (favNav) favNav.style.color = window.showingOnlyFavs ? '#fff' : 'var(--accent-yellow)';
    }

    const applyFiltersFn = getGlobalFn('applyFilters');
    if (applyFiltersFn) {
        return applyFiltersFn(false, false);
    }
}
bindWindowFn('filterFavorites', filterFavorites);
