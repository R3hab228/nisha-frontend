// @ts-check
// ==========================================
// NISHA STORE - MAIN APPLICATION ORCHESTRATOR
// ==========================================

import {
    store,
    storage,
    apiClient,
    openCart,
    openReviewsModal,
    openProductModalById,
    applyFilters,
    loadAllItems,
    renderNextBatch,
    startOnboardingTour,
    handleNetworkOffline
} from './src/modules/index.js';
import { hasAction, invokeAction, registerActions } from './js/core/action-registry.js';
import { getRuntimeUser } from './js/core/runtime-env.js';
import {
    initDesktopLenisController,
    initFabScrollBehavior,
    initSupabaseRuntime,
    initPhoneInputMasks,
    scheduleHistoryAutoAnimate
} from './js/core/app-runtime.js';
import { createSiteBroadcastController } from './js/core/app-broadcast.js';

console.log(`
      _   _ _____  _____ _    _          
     | \\ | |_   _|/ ____| |  | |   /\\    
     |  \\| | | | | (___ | |__| |  /  \\   
     | . \` | | |  \\___ \\|  __  | / /\\ \\  
     | |\\  |_| |_ ____) | |  | |/ ____ \\ 
     |_| \\_|_____|_____/|_|  |_/_/    \\_\\
                                         
    LOOKING AT THE SOURCE CODE? 
`);

// ==========================================
// 1–3. RUNTIME: LENIS, FAB SCROLL, SUPABASE
// ==========================================
const { stopLenis, startLenis } = initDesktopLenisController();
initFabScrollBehavior();
const _supabase = initSupabaseRuntime(storage);

const broadcastCtrl = createSiteBroadcastController({
    getSupabase: () => _supabase,
    storage,
    store
});

// ==========================================
// 4. СБРОС НА ГЛАВНУЮ СТРАНИЦУ
// ==========================================
function resetToMain() {
    window.scrollTo(0, 0);

    window.currentCategory = '';
    window.currentBrand = '';
    window.showingOnlyFavs = false;
    try {
        sessionStorage.removeItem('nisha_showing_favs');
        sessionStorage.setItem('nisha_last_category', '');
    } catch {}
    if (store && store.session) {
        store.session.remove('nisha_showing_favs');
        store.session.set('nisha_last_category', '');
    }

    const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('mainSearch'));
    if (searchInput) searchInput.value = '';
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';

    document.querySelectorAll('.size-cb').forEach((cb) => {
        /** @type {HTMLInputElement} */ (cb).checked = false;
    });
    ['onlySaleCb', 'onlyBargainCb', 'hideUnavailableCb'].forEach((id) => {
        const cb = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
        if (cb) cb.checked = false;
    });

    const minInput = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMin'));
    const maxInput = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMax'));
    const minDefault = minInput ? (Number.parseInt(minInput.min, 10) || 0) : 0;
    const maxDefault = maxInput ? (Number.parseInt(maxInput.max, 10) || 15000) : 15000;
    if (minInput) minInput.value = String(minDefault);
    if (maxInput) maxInput.value = String(maxDefault);
    const minLabel = document.getElementById('priceMinVal');
    const maxLabel = document.getElementById('priceMaxVal');
    if (minLabel) minLabel.textContent = String(minDefault);
    if (maxLabel) maxLabel.textContent = String(maxDefault);
    invokeAction('syncPriceFilterCurrencyUI');
    const rangeFill = document.getElementById('rangeFill');
    if (rangeFill) {
        rangeFill.style.left = '0%';
        rangeFill.style.right = '0%';
    }

    const favNav = document.getElementById('favNav');
    if (favNav) favNav.style.color = 'var(--accent-yellow)';

    const sortNew = document.getElementById('sort-new');
    const sortCheap = document.getElementById('sort-cheap');
    if (sortNew) sortNew.classList.add('active-sort');
    if (sortCheap) sortCheap.classList.remove('active-sort');

    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach((el) => el.classList.remove('active-filter'));
    const allItemsLink = document.querySelector('.sidebar .filter-list:first-of-type a');
    if (allItemsLink) allItemsLink.classList.add('active-filter');

    applyFilters();
}
window.resetToMain = resetToMain;

// ==========================================
// 5. ИНИЦИАЛИЗАЦИЯ СЛОВАРЕЙ ЛОКАЛИЗАЦИИ (i18next)
// ==========================================
async function initAppLanguage() {
    try {
        const i18n = window.i18next;
        if (typeof i18n === 'undefined') return;

        let savedLng = (storage && typeof storage.get === 'function') ? storage.get('nisha_lang') : null;
        let savedFlag = (storage && typeof storage.get === 'function') ? storage.get('nisha_flag') : null;

        if (!savedLng) {
            const browserLang = (navigator.language || /** @type {any} */ (navigator).userLanguage || '').toLowerCase();
            if (browserLang.startsWith('en')) {
                savedLng = 'en'; savedFlag = '🇬🇧';
            } else if (browserLang.startsWith('ru')) {
                savedLng = 'ru'; savedFlag = '🇷🇺';
            } else {
                savedLng = 'ua'; savedFlag = '🇺🇦';
            }
            if (storage && typeof storage.set === 'function') {
                storage.set('nisha_lang', savedLng);
                storage.set('nisha_flag', savedFlag);
            }
        } else if (!savedFlag) {
            savedFlag = savedLng === 'ru' ? '🇷🇺' : (savedLng === 'en' ? '🇬🇧' : '🇺🇦');
            if (storage && typeof storage.set === 'function') {
                storage.set('nisha_flag', savedFlag);
            }
        }

        if (typeof window.i18nextBrowserLanguageDetector !== 'undefined') {
            i18n.use(window.i18nextBrowserLanguageDetector);
        }

        /** @type {Record<string, any>} */
        let langResources = {};
        let loadSuccess = false;
        try {
            const early = typeof window !== 'undefined' ? window.__nishaEarlyLocaleFetch : null;
            let singleData = null;
            if (early && early.lang === savedLng && early.promise) {
                singleData = await early.promise;
            }
            if (!singleData) {
                const locRes = await fetch(`/locales/${savedLng}.json`);
                if (locRes.ok) {
                    singleData = await locRes.json();
                }
            }
            if (singleData) {
                langResources[savedLng] = singleData.translation ? singleData : { translation: singleData };
                loadSuccess = true;
            }
        } catch {}

        if (!loadSuccess) {
            try {
                const fallbackRes = await fetch('/locales.json');
                langResources = await fallbackRes.json();
            } catch (fbErr) {
                console.error('[ ЯЗЫКИ ] Ошибка загрузки fallback словарей:', fbErr);
            }
        }

        await i18n.init({
            resources: langResources,
            lng: savedLng,
            fallbackLng: loadSuccess ? savedLng : ['ua', 'ru'],
            debug: false
        });

        if (typeof i18n.on === 'function') {
            i18n.on('languageChanged', (/** @type {string} */ lng) => {
                const norm = (typeof window.normalizeSiteLang === 'function') ? window.normalizeSiteLang(lng) : (lng || 'ua');
                if (typeof window.updateFooterLanguageUI === 'function') {
                    window.updateFooterLanguageUI(norm);
                }
            });
        }

        const effectiveLang = (typeof window.normalizeSiteLang === 'function')
            ? window.normalizeSiteLang(i18n.language || savedLng)
            : (savedLng || 'ua');

        if (storage && typeof storage.set === 'function') {
            storage.set('nisha_lang', effectiveLang);
            const effectiveEmoji = effectiveLang === 'ru' ? '🇷🇺' : (effectiveLang === 'en' ? '🇬🇧' : '🇺🇦');
            storage.set('nisha_flag', effectiveEmoji);
        }

        if (typeof window.updateContentLanguage === 'function') window.updateContentLanguage();
        if (typeof window.updateFooterLanguageUI === 'function') window.updateFooterLanguageUI(effectiveLang);
        if (typeof window.updateCartUI === 'function') window.updateCartUI();
        if (typeof window.renderCartItems === 'function') window.renderCartItems();
        document.documentElement.lang = (effectiveLang === 'ua' ? 'uk' : effectiveLang);
    } catch (langErr) {
        console.warn('[ ЯЗЫКИ ] Ошибка загрузки словарей:', langErr);
    }
}

// ==========================================
// 6. ГЛАВНЫЙ ОРКЕСТРАТОР ПРИЛОЖЕНИЯ (initApp)
// ==========================================
let appInitialized = false;
async function initApp() {
    if (appInitialized) return;
    appInitialized = true;
    document.body.classList.remove('search-lock');
    startLenis();
    invokeAction('cleanStorageLimits');

    if (!navigator.onLine) {
        setTimeout(handleNetworkOffline, 100);
    }

    try {
        try {
            if (storage && typeof storage.remove === 'function') {
                storage.remove('nisha_cart_time');
                storage.remove('nisha_cart_reminded');
                storage.remove('nisha_cart_push_sent_time');
            }
        } catch {}

        // 1. Восстанавливаем фильтры, категорию, бренд, размеры, цену, сортировку и поисковый запрос из URL
        const urlParams = new URLSearchParams(window.location.search);
        const quickAction = urlParams.get('action');
        if (quickAction === 'cart') {
            setTimeout(() => {
                openCart();
            }, 150);
        } else if (quickAction === 'fav') {
            window.showingOnlyFavs = true;
            try { sessionStorage.setItem('nisha_showing_favs', 'true'); } catch {}
            const favNav = document.getElementById('favNav');
            if (favNav) favNav.style.color = '#fff';
        } else if (quickAction === 'reviews' || urlParams.get('open') === 'reviews') {
            setTimeout(() => { openReviewsModal(); }, 250);
        }

        invokeAction('hydrateCatalogFiltersFromUrl', urlParams);

        // 2. Мгновенный запуск каталога, сессии и словарей локализации параллельно
        const itemsPromise = loadAllItems();
        setTimeout(() => {
            try {
                const grid = document.getElementById('itemsGrid');
                const stillSkeleton = Boolean(grid && grid.querySelector('.skeleton-card'));
                if (stillSkeleton && (!Array.isArray(window.allItems) || window.allItems.length === 0)) {
                    console.warn('[КАТАЛОГ] Watchdog: каталог не отрисовался за 6.5с, запускаем повторную загрузку...');
                    loadAllItems();
                }
            } catch {}
        }, 6500);
        const sessionPromise = (_supabase && typeof window.checkSession === 'function') ? window.checkSession() : Promise.resolve();
        const langPromise = initAppLanguage();

        initPhoneInputMasks();
        scheduleHistoryAutoAnimate();

        if (typeof window.checkRules === 'function') window.checkRules();
        if (typeof window.updateCartUI === 'function') window.updateCartUI();

        await Promise.all([itemsPromise, sessionPromise, langPromise]);

        // Надежная синхронизация отображения Избранного после завершения загрузки каталога и сессии
        if (window.showingOnlyFavs) {
            const activeUser = getRuntimeUser();
            const favNav = document.getElementById('favNav');
            if (!activeUser) {
                window.showingOnlyFavs = false;
                try { sessionStorage.removeItem('nisha_showing_favs'); } catch {}
                if (favNav) favNav.style.color = 'var(--accent-yellow)';
                const authMsg = (typeof window.i18next !== 'undefined') ? window.i18next.t('messages.cart_error_auth') : 'Пожалуйста, войдите в аккаунт';
                if (typeof window.showToast === 'function') window.showToast(authMsg, 'error');
                if (typeof applyFilters === 'function') applyFilters(true);
            } else {
                if (favNav) favNav.style.color = '#fff';
                if (typeof applyFilters === 'function') applyFilters(true);
            }
        }

        // Первичная проверка рассылок и обновление при возврате на вкладку (если Realtime в фоне уснул)
        broadcastCtrl.bindBroadcastLifecycle();

        // Запускаем счетчик посетителей сразу (не дожидаясь конца всех await в initApp)
        invokeAction('initHitCounter');

        // Тихий фоновый прогрев бэкенда
        const pingBackend = () => {
            try {
                if (apiClient && typeof apiClient.ping === 'function') apiClient.ping();
            } catch {}
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => setTimeout(pingBackend, 2500));
        } else {
            setTimeout(pingBackend, 3500);
        }

        let openItemId = urlParams.get('item');
        if (!openItemId && typeof window !== 'undefined' && window.location && typeof window.location.pathname === 'string') {
            const sharePathMatch = window.location.pathname.match(/^\/share\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (sharePathMatch && sharePathMatch[1]) {
                openItemId = sharePathMatch[1];
                try {
                    window.history.replaceState(null, '', '/?item=' + encodeURIComponent(openItemId));
                } catch {}
            }
        }
        if (openItemId) {
            openProductModalById(openItemId);
        }

        const openAction = urlParams.get('action');
        if (openAction === 'orders') {
            setTimeout(() => {
                invokeAction('openOrdersModal');
            }, 500);
        } else if (openAction === 'reviews') {
            setTimeout(() => {
                openReviewsModal();
            }, 500);
        } else if (openAction === 'review') {
            const orderId = urlParams.get('orderId');
            setTimeout(() => {
                if (hasAction('promptOrderReview')) {
                    invokeAction('promptOrderReview', orderId || '');
                } else {
                    openReviewsModal();
                }
            }, 600);
        }

        if (_supabase) {
            _supabase.channel('public:site_broadcasts')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_broadcasts' }, (/** @type {any} */ payload) => {
                    const bData = payload.new;
                    if (!bData) return;
                    broadcastCtrl.dispatchSiteBroadcast(bData, { respectOnboardingTour: false });
                })
                .subscribe();

            // Единая подписка на обновления каталога в реальном времени из catalog.js
            invokeAction('initCatalogRealtimeSubscription');
            invokeAction('initReviewsRealtime', _supabase);
        }

        // Интеллектуальный скролл каталога для мобильных устройств
        let isBatchLoading = false;
        const observer = new IntersectionObserver((entries) => {
            if (entries.at(0)?.isIntersecting && !isBatchLoading) {
                if ((window.renderedCount || 0) < (window.filteredItems ? window.filteredItems.length : 0) && window.innerWidth <= 900) {
                    isBatchLoading = true;
                    requestAnimationFrame(async () => {
                        try {
                            await renderNextBatch();
                        } finally {
                            isBatchLoading = false;
                        }
                    });
                }
            }
        }, { rootMargin: '700px', threshold: 0.01 });

        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) observer.observe(scrollTrigger);

        const savedHistory = storage ? storage.getJSON('nisha_view_history', []) : [];
        if (Array.isArray(savedHistory) && savedHistory.length > 0 && typeof window.renderHistory === 'function') {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                window.requestIdleCallback(() => window.renderHistory(), { timeout: 2500 });
            } else {
                setTimeout(() => window.renderHistory(), 600);
            }
        }
        invokeAction('initHitCounter');
        if (typeof window.updateSidebarCounters === 'function') window.updateSidebarCounters();
        invokeAction('renderActiveFilterChips');
        invokeAction('initLeaderElection');
        invokeAction('updateAppBadge');

        const activeUser = store.user;
        if (activeUser && activeUser.phone) {
            const ordSearchEl = /** @type {HTMLInputElement | null} */ (document.getElementById('ordersSearchPhone'));
            if (ordSearchEl) ordSearchEl.value = activeUser.phone;
        }

        if (storage && storage.get('nisha_rules_accepted')) {
            startOnboardingTour();
        }
    } catch (/** @type {any} */ err) {
        console.error('ОШИБКА ИНИЦИАЛИЗАЦИИ ПРИЛОЖЕНИЯ:', err);
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            const errBox = document.createElement('div');
            errBox.style.cssText = 'color:red; text-align:center; padding:40px; grid-column:1/-1;';
            errBox.textContent = `[ СИСТЕМНАЯ ОШИБКА: ${err?.message || 'Unknown error'} ]`;
            if (typeof grid.replaceChildren === 'function') grid.replaceChildren(errBox);
            else {
                grid.innerHTML = '';
                grid.appendChild(errBox);
            }
        }
    }
}

registerActions({
    stopLenis,
    startLenis,
    resetToMain
});

function markAppBooted() {
    window.__nishaAppBooted = true;
    try {
        sessionStorage.removeItem('nisha_chunk_reload_count');
        sessionStorage.removeItem('nisha_chunk_reload_at');
    } catch {}
    const recoveryBanner = document.getElementById('nishaBootRecoveryBanner');
    if (recoveryBanner) recoveryBanner.remove();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        markAppBooted();
        initApp();
    });
} else {
    markAppBooted();
    initApp();
}
