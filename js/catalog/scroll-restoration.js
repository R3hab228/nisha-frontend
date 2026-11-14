// ==========================================
// NISHA CATALOG — SMART FEED SCROLL RESTORATION ENGINE
// ==========================================

const FEED_SCROLL_STORAGE_KEY = 'nisha_feed_scroll_v1';
let _saveScrollRafId = null;
let _saveScrollTimeout = null;
let _scrollRestoredBadgeTimeout = null;

/**
 * Проверяет, открыта ли в данный момент любая модалка.
 * @returns {boolean}
 */
export function isAnyModalActive() {
    if (typeof document === 'undefined') return false;
    if (document.body && document.body.style && document.body.style.overflow === 'hidden') return true;
    const modals = document.querySelectorAll('.modal-overlay');
    for (let i = 0; i < modals.length; i++) {
        const m = modals[i];
        if (m.classList.contains('closing')) continue;
        if (m.classList.contains('is-open') || m.style.display === 'flex' || m.style.display === 'block') {
            return true;
        }
    }
    return false;
}

/**
 * Сохраняет текущую позицию скролла ленты и активную карточку в `sessionStorage`.
 * @param {string|null} [preferredActiveItemId=null]
 */
export function saveCurrentFeedScrollState(preferredActiveItemId = null) {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
    if (isAnyModalActive()) return;

    const scrollY = window.scrollY || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
    const effectiveScrollY = scrollY < 70 ? 0 : Math.round(scrollY);

    let activeItemId = preferredActiveItemId;
    if (!activeItemId && effectiveScrollY > 100 && typeof document !== 'undefined') {
        const cards = document.querySelectorAll('#itemsGrid .item-card');
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const rect = card.getBoundingClientRect();
            if (rect.top >= -100 && rect.top <= window.innerHeight * 0.5) {
                activeItemId = card.dataset.id || null;
                break;
            }
        }
    }

    const searchEl = typeof document !== 'undefined' ? document.getElementById('mainSearch') : null;
    const state = {
        scrollY: effectiveScrollY,
        renderedCount: window.renderedCount || 0,
        currentPage: window.currentPage || 1,
        category: window.currentCategory || '',
        search: (searchEl && searchEl.value ? searchEl.value.trim().toLowerCase() : ''),
        showingFavs: Boolean(window.showingOnlyFavs),
        activeItemId: activeItemId,
        timestamp: Date.now()
    };

    try {
        sessionStorage.setItem(FEED_SCROLL_STORAGE_KEY, JSON.stringify(state));
    } catch {}
}

/**
 * Отложенно планирует сохранение позиции скролла после стабилизации кадра.
 */
export function scheduleFeedScrollSave() {
    if (_saveScrollRafId) cancelAnimationFrame(_saveScrollRafId);
    _saveScrollRafId = requestAnimationFrame(() => {
        _saveScrollRafId = null;
        clearTimeout(_saveScrollTimeout);
        _saveScrollTimeout = setTimeout(() => {
            saveCurrentFeedScrollState();
        }, 120);
    });
}

/**
 * Возвращает сохранённое состояние скролла ленты, если оно ещё не устарело (TTL 4 часа).
 * @returns {object|null}
 */
export function getSavedFeedScrollState() {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(FEED_SCROLL_STORAGE_KEY);
        if (!raw) return null;
        const state = JSON.parse(raw);
        if (!state || typeof state.scrollY !== 'number') return null;
        if (Date.now() - (state.timestamp || 0) > 4 * 60 * 60 * 1000) {
            sessionStorage.removeItem(FEED_SCROLL_STORAGE_KEY);
            return null;
        }
        return state;
    } catch {
        return null;
    }
}

/**
 * Удаляет сохранённую позицию скролла ленты из `sessionStorage`.
 */
export function clearSavedFeedScrollState() {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.removeItem(FEED_SCROLL_STORAGE_KEY);
    } catch {}
}

/**
 * Показывает бейдж «Позиция восстановлена» на короткое время после возврата в ленту.
 */
export function showScrollRestoredBadge() {
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('feedScrollRestoredBadge');
    if (!badge) return;

    if (_scrollRestoredBadgeTimeout) clearTimeout(_scrollRestoredBadgeTimeout);
    badge.classList.add('is-visible');

    const onScrollHide = () => {
        badge.classList.remove('is-visible');
        window.removeEventListener('scroll', onScrollHide);
    };
    window.addEventListener('scroll', onScrollHide, { passive: true, once: true });

    _scrollRestoredBadgeTimeout = setTimeout(() => {
        badge.classList.remove('is-visible');
        window.removeEventListener('scroll', onScrollHide);
    }, 2200);
}

/**
 * Восстанавливает сохранённую позицию скролла с поправкой на актуальную карточку в DOM.
 * @param {object} state
 */
export function restoreFeedScrollPosition(state) {
    if (!state || typeof state.scrollY !== 'number' || state.scrollY <= 0) return;

    const targetY = state.scrollY;
    const activeItemId = state.activeItemId;

    requestAnimationFrame(() => {
        let exactY = targetY;
        if (activeItemId && typeof document !== 'undefined') {
            const cardEl = document.querySelector(`#itemsGrid .item-card[data-id="${activeItemId}"]`);
            if (cardEl) {
                const cardTop = cardEl.offsetTop;
                if (cardTop > 0 && Math.abs(cardTop - targetY) < 500) {
                    exactY = cardTop;
                }
            }
        }

        window.scrollTo({ top: exactY, behavior: 'instant' });
        if (typeof window.lenis !== 'undefined' && window.lenis && typeof window.lenis.scrollTo === 'function') {
            window.lenis.scrollTo(exactY, { immediate: true });
        }

        setTimeout(() => {
            const currentY = window.scrollY || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
            if (Math.abs(currentY - exactY) > 80) {
                window.scrollTo({ top: exactY, behavior: 'instant' });
                if (typeof window.lenis !== 'undefined' && window.lenis && typeof window.lenis.scrollTo === 'function') {
                    window.lenis.scrollTo(exactY, { immediate: true });
                }
            }
            showScrollRestoredBadge();
        }, 80);
    });
}

if (typeof window !== 'undefined') {
    window.saveCurrentFeedScrollState = saveCurrentFeedScrollState;
    window.getSavedFeedScrollState = getSavedFeedScrollState;
    window.clearSavedFeedScrollState = clearSavedFeedScrollState;
    window.restoreFeedScrollPosition = restoreFeedScrollPosition;
    window.showScrollRestoredBadge = showScrollRestoredBadge;
    window.addEventListener('scroll', scheduleFeedScrollSave, { passive: true });
}
