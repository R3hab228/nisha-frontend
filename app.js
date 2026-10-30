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
// 1. БЕЗОПАСНЫЙ ПЛАВНЫЙ СКРОЛЛ (ТОЛЬКО ДЛЯ ПК — ЛЕНИВАЯ ЗАГРУЗКА LENIS)
// ==========================================
let lenis;

function initDesktopLenis(LenisClass) {
    if (!LenisClass || lenis || window.innerWidth <= 900) return;
    lenis = new LenisClass({
        lerp: 0.14, 
        wheelMultiplier: 1.25, 
        smoothWheel: true
    });
    window.lenis = lenis;

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
}

if (window.innerWidth > 900) {
    const LenisClass = window.Lenis || (typeof Lenis !== 'undefined' ? Lenis : null);
    if (LenisClass) {
        initDesktopLenis(LenisClass);
    } else {
        import('lenis').then((mod) => {
            const LoadedLenis = mod.default || mod.Lenis || mod;
            window.Lenis = LoadedLenis;
            if (typeof globalThis !== 'undefined') globalThis.Lenis = LoadedLenis;
            initDesktopLenis(LoadedLenis);
        }).catch(() => {});
    }
}

window.stopLenis = function() {
    if (typeof lenis !== 'undefined' && lenis) {
        Object.getPrototypeOf(lenis).stop.call(lenis); 
    }
};

window.startLenis = function() {
    if (typeof lenis !== 'undefined' && lenis) {
        Object.getPrototypeOf(lenis).start.call(lenis); 
    }
};

// ==========================================
// 2. УМНЫЕ ПЛАВАЮЩИЕ КНОПКИ (ПРЕДЛОЖКА И ФИЛЬТРЫ)
// ==========================================
let fabScrollTimeout;
let lastScrollY = window.scrollY || document.documentElement.scrollTop;
let scrollTicking = false;
let fabEl = null;

window.addEventListener('scroll', () => {
    if (document.body.classList.contains('search-lock')) return;

    if (!scrollTicking) {
        window.requestAnimationFrame(() => {
            if (!fabEl) fabEl = document.querySelector('.fab-propose');
            const currentScrollY = window.scrollY || document.documentElement.scrollTop;
            
            if (Math.abs(currentScrollY - lastScrollY) > 12) {
                const isScrollingDown = currentScrollY > lastScrollY && currentScrollY > 150;
                if (isScrollingDown) {
                    if (fabEl && !fabEl.classList.contains('cart-active') && !fabEl.classList.contains('hidden-scroll')) {
                        fabEl.classList.add('hidden-scroll');
                    }
                } else {
                    if (fabEl && fabEl.classList.contains('hidden-scroll')) {
                        fabEl.classList.remove('hidden-scroll');
                    }
                }
                lastScrollY = currentScrollY;

                clearTimeout(fabScrollTimeout);
                fabScrollTimeout = setTimeout(() => {
                    if (fabEl && fabEl.classList.contains('hidden-scroll')) {
                        fabEl.classList.remove('hidden-scroll');
                    }
                }, 800);
            }

            scrollTicking = false;
        });
        scrollTicking = true;
    }
}, { passive: true });

// ==========================================
// 3. ИНИЦИАЛИЗАЦИЯ КЛИЕНТА SUPABASE
// ==========================================
window.isHacked = false;
let _supabase = null;
let clientFingerprint = (storage && typeof storage.get === 'function') ? storage.get('nisha_visitor_id') : null;
if (!clientFingerprint) {
    clientFingerprint = "guest_" + Date.now();
}
window.clientFingerprint = clientFingerprint;
if (typeof globalThis !== 'undefined') {
    globalThis.isHacked = false;
    globalThis.clientFingerprint = clientFingerprint;
}

const envData = (typeof window.ENV !== 'undefined') ? window.ENV : ((typeof CONFIG !== 'undefined') ? CONFIG : {});
const rawUrl = envData.SUPABASE_URL || '';
const rawAnonKey = envData.SUPABASE_ANON_KEY || '';

const SUPABASE_URL = rawUrl.replace(/[^\x20-\x7E]/g, '').trim();
const SUPABASE_ANON_KEY = rawAnonKey.replace(/[^\x20-\x7E]/g, '').trim();

if (!SUPABASE_ANON_KEY) {
    console.error("ОШИБКА: Ключ Supabase пустой. База данных недоступна.");
    setTimeout(() => {
        if (typeof showToast === 'function') showToast('Критическая ошибка: Нет связи с БД', 'error');
    }, 2000);
} else {
    const clientCreator = (typeof window.createClient === 'function')
        ? window.createClient
        : ((window.supabase && typeof window.supabase.createClient === 'function')
            ? window.supabase.createClient
            : ((typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function')
                ? supabase.createClient
                : (typeof createClient === 'function' ? createClient : null)));

    if (!clientCreator) {
        console.error("ОШИБКА: createClient не найден. База данных недоступна.");
    } else {
        _supabase = clientCreator(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                fetch: (url, options) => {
                    // Используем CDN ТОЛЬКО для главного списка товаров (limit=1000). Точечные запросы идут напрямую!
                    if (typeof url === 'string' && url.includes('/rest/v1/items') && url.includes('limit=1000') && !url.includes('id=eq.') && (!options || options.method === 'GET' || !options.method)) {
                        url = url.replace('nmpuefxqtkhvtltdvllz.supabase.co', 'nisha-cdn.mtyagniryadno.workers.dev');
                    }
                    return fetch(url, options);
                }
            }
        });
        window._supabase = _supabase;
        if (typeof globalThis !== 'undefined') globalThis._supabase = _supabase;
        if (typeof window.initAuthListener === 'function') window.initAuthListener();
    }
}

// ==========================================
// 4. СБРОС НА ГЛАВНУЮ СТРАНИЦУ
// ==========================================
function resetToMain() {
    window.scrollTo(0, 0);
    
    window.currentCategory = '';
    window.currentBrand = '';
    window.showingOnlyFavs = false;
    
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) searchInput.value = '';
    
    document.querySelectorAll('.size-cb').forEach(cb => cb.checked = false);
    const saleCb = document.getElementById('onlySaleCb');
    if (saleCb) saleCb.checked = false;
    
    const favNav = document.getElementById('favNav');
    if (favNav) favNav.style.color = 'var(--accent-yellow)';
    
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(el => el.classList.remove('active-filter'));
    const allItemsLink = document.querySelector('.sidebar .filter-list:first-of-type a');
    if (allItemsLink) allItemsLink.classList.add('active-filter');

    applyFilters();
}
window.resetToMain = resetToMain;

// ==========================================
// 5. ГЛАВНЫЙ ОРКЕСТРАТОР ПРИЛОЖЕНИЯ (initApp)
// ==========================================
let appInitialized = false;
async function initApp() {
    if (appInitialized) return;
    appInitialized = true;
    document.body.classList.remove('search-lock'); 
    if (typeof window.startLenis === 'function') window.startLenis();
    if (typeof window.cleanStorageLimits === 'function') window.cleanStorageLimits();

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
        } catch (e) {}

        // 1. Восстанавливаем фильтры, категорию и поисковый запрос
        const urlParams = new URLSearchParams(window.location.search);
        const quickAction = urlParams.get('action');
        if (quickAction === 'cart') {
            setTimeout(() => {
                openCart();
            }, 150);
        } else if (quickAction === 'fav') {
            window.showingOnlyFavs = true;
            sessionStorage.setItem('nisha_showing_favs', 'true');
            const favNav = document.getElementById('favNav');
            if (favNav) favNav.style.color = '#fff';
            setTimeout(() => {
                if (typeof toggleFavFilter === 'function') toggleFavFilter(true);
                else applyFilters();
            }, 150);
        } else if (quickAction === 'reviews' || urlParams.get('open') === 'reviews') {
            setTimeout(() => { openReviewsModal(); }, 250);
        }

        if (sessionStorage.getItem('nisha_showing_favs') === 'true') {
            window.showingOnlyFavs = true;
            const favNav = document.getElementById('favNav');
            if (favNav) favNav.style.color = '#fff';
        }

        const savedCat = urlParams.get('cat') || sessionStorage.getItem('nisha_last_category');
        const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
        catLinks.forEach(el => el.classList.remove('active-filter'));

        if (savedCat) {
            window.currentCategory = savedCat;
            catLinks.forEach(link => {
                const onclickText = link.getAttribute('onclick') || '';
                if (onclickText.includes(`'${savedCat}'`)) {
                    link.classList.add('active-filter');
                }
            });
        } else {
            const firstLink = document.querySelector('.sidebar .filter-list:first-of-type a');
            if (firstLink) firstLink.classList.add('active-filter');
        }

        const savedQuery = urlParams.get('q') || urlParams.get('search');
        if (savedQuery) {
            const sInput = document.getElementById('mainSearch');
            if (sInput) {
                sInput.value = savedQuery;
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'block';
            }
        }

        const saleParam = urlParams.get('sale');
        if (saleParam === '1' || saleParam === 'true') {
            const saleCb = document.getElementById('onlySaleCb');
            if (saleCb) saleCb.checked = true;
        }

        // 2. Мгновенный запуск каталога, сессии и словарей локализации параллельно
        const itemsPromise = loadAllItems();
        const sessionPromise = (_supabase && typeof checkSession === 'function') ? checkSession() : Promise.resolve();

        const langPromise = (async () => {
            try {
                if (typeof i18next !== 'undefined') {
                    let savedLng = (storage && typeof storage.get === 'function') ? storage.get('nisha_lang') : null;
                    let savedFlag = (storage && typeof storage.get === 'function') ? storage.get('nisha_flag') : null;
                    
                    if (!savedLng) {
                        const browserLang = navigator.language || navigator.userLanguage || '';
                        if (browserLang.toLowerCase().includes('ru')) {
                            savedLng = 'ru'; savedFlag = '🇷🇺';
                        } else if (browserLang.toLowerCase().includes('en')) {
                            savedLng = 'en'; savedFlag = '🇬🇧';
                        } else {
                            savedLng = 'ua'; savedFlag = '🇺🇦';
                        }
                        if (storage && typeof storage.set === 'function') {
                            storage.set('nisha_lang', savedLng);
                            storage.set('nisha_flag', savedFlag);
                        }
                    }
                    
                    if (typeof i18nextBrowserLanguageDetector !== 'undefined') {
                        i18next.use(i18nextBrowserLanguageDetector);
                    }

                    let langResources = {};
                    let loadSuccess = false;
                    try {
                        const locRes = await fetch(`/locales/${savedLng}.json`);
                        if (locRes.ok) {
                            const singleData = await locRes.json();
                            langResources[savedLng] = singleData.translation ? singleData : { translation: singleData };
                            loadSuccess = true;
                        }
                    } catch (e) {}

                    if (!loadSuccess) {
                        try {
                            const fallbackRes = await fetch('/locales.json');
                            langResources = await fallbackRes.json();
                        } catch (fbErr) {
                            console.error("[ ЯЗЫКИ ] Ошибка загрузки fallback словарей:", fbErr);
                        }
                    }

                    await i18next.init({
                        resources: langResources,
                        lng: savedLng, 
                        fallbackLng: 'ru',
                        debug: false
                    });
                    
                    if (typeof updateContentLanguage === 'function') updateContentLanguage();
                    if (typeof updateCartUI === 'function') updateCartUI();
                    if (typeof renderCartItems === 'function') renderCartItems();
                    document.documentElement.lang = (savedLng === 'ua' ? 'uk' : (savedLng || 'ru'));
                    const flagEl = document.getElementById('currentFlag');
                    if (flagEl) flagEl.innerText = savedFlag;
                }
            } catch (langErr) {
                console.warn("[ ЯЗЫКИ ] Ошибка загрузки словарей:", langErr);
            }
        })();

        const phoneInput = document.getElementById('orderPhone');
        const searchPhoneInput = document.getElementById('ordersSearchPhone');
        if (phoneInput && typeof IMask !== 'undefined') {
            const phoneMask = IMask(phoneInput, { mask: '+{380} (00) 000-00-00' });
            
            function validatePhoneVisual() {
                const unmasked = phoneMask.unmaskedValue || '';
                const btnOtp = document.getElementById('btnGetOtp');
                if (!unmasked || unmasked.length <= 3) {
                    phoneInput.classList.remove('input-valid', 'input-invalid');
                    if (btnOtp && !window.otpVerified) {
                        btnOtp.style.opacity = '0.7';
                        btnOtp.style.borderColor = '#555';
                    }
                    return;
                }
                if (unmasked.length === 12) {
                    phoneInput.classList.add('input-valid');
                    phoneInput.classList.remove('input-invalid');
                    if (btnOtp && !window.otpVerified) {
                        btnOtp.style.opacity = '1';
                        btnOtp.style.borderColor = 'var(--accent-green)';
                    }
                } else {
                    phoneInput.classList.remove('input-valid');
                    phoneInput.classList.add('input-invalid');
                    if (btnOtp && !window.otpVerified) {
                        btnOtp.style.opacity = '0.6';
                        btnOtp.style.borderColor = '#555';
                    }
                }
            }

            phoneMask.on('accept', () => {
                validatePhoneVisual();
                if (typeof checkPhoneAuth === 'function') checkPhoneAuth();
            });
            phoneInput.addEventListener('blur', validatePhoneVisual);
            phoneInput.addEventListener('focus', validatePhoneVisual);
        }
        if (searchPhoneInput && typeof IMask !== 'undefined') {
            IMask(searchPhoneInput, { mask: '+{380} (00) 000-00-00' });
        }

        const initAutoAnimate = async () => {
            const hGrid = document.getElementById('historyGrid');
            if (!hGrid) return;
            const animFn = (typeof window !== 'undefined' && window.autoAnimate) || (typeof autoAnimate === 'function' ? autoAnimate : null);
            if (animFn) {
                animFn(hGrid);
            } else {
                try {
                    const mod = await import('@formkit/auto-animate');
                    const fn = mod.default || mod.autoAnimate || mod;
                    if (typeof fn === 'function') {
                        window.autoAnimate = fn;
                        fn(hGrid);
                    }
                } catch (e) {
                    try {
                        const fallbackMod = await import('https://cdn.jsdelivr.net/npm/@formkit/auto-animate@0.8.2/index.min.js');
                        if (fallbackMod && fallbackMod.default) {
                            window.autoAnimate = fallbackMod.default;
                            fallbackMod.default(hGrid);
                        }
                    } catch (err) {}
                }
            }
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(initAutoAnimate, { timeout: 3000 });
        } else {
            setTimeout(initAutoAnimate, 1500);
        }

        if (typeof checkRules === 'function') checkRules();
        if (typeof updateCartUI === 'function') updateCartUI(); 

        await Promise.all([itemsPromise, sessionPromise, langPromise]);

        // Проверка рассылок от админа
        setTimeout(async () => {
            try {
                if (!_supabase) return;
                const { data: broadcasts } = await _supabase.from('site_broadcasts').select('id, message_text, image_url').order('created_at', { ascending: false }).limit(1);
                
                if (broadcasts && broadcasts.length > 0) {
                    const bData = broadcasts[0];
                    const localSeenId = (storage && typeof storage.get === 'function') ? storage.get('nisha_last_broadcast') : null;
                    const profile = store.profile;
                    const dbSeenId = profile ? profile.last_broadcast_id : null;
                    const hasSeen = (localSeenId === bData.id) || (dbSeenId === bData.id);

                    if (!hasSeen) {
                        const hasValidText = bData.message_text && typeof bData.message_text === 'string' && bData.message_text.trim() && bData.message_text.trim() !== 'null';
                        const hasValidImg = bData.image_url && typeof bData.image_url === 'string' && bData.image_url.trim();

                        const markAsSeen = () => {
                            if (storage && typeof storage.set === 'function') storage.set('nisha_last_broadcast', bData.id);
                            const activeUser = store.user;
                            if (activeUser && _supabase) {
                                _supabase.from('profiles').update({ last_broadcast_id: bData.id }).eq('id', activeUser.id).then();
                            }
                        };

                        if (!hasValidText && !hasValidImg) {
                            markAsSeen();
                            return;
                        }

                        let broadcastContent = '';
                        if (hasValidImg) {
                            broadcastContent += `<img src="${bData.image_url}" style="width:100%; max-height:200px; object-fit:cover; border-radius:4px; border:1px solid #333; margin-bottom:15px;">`;
                        }
                        if (hasValidText) {
                            broadcastContent += `<div style="font-size:14px; line-height:1.5;">${bData.message_text.replaceAll('\n', '<br>')}</div>`;
                        }

                        if (store && store.get('nisha_tour_done') && typeof tryShowBroadcast === 'function') {
                            tryShowBroadcast('SYSTEM_BROADCAST.MSG', broadcastContent, '[ ЗАКРЫТЬ ]', markAsSeen);
                        } else {
                            window.pendingBroadcastHtml = broadcastContent;
                            window.pendingBroadcastId = bData.id;
                        }
                    }
                }
            } catch(e) { console.warn("Ошибка загрузки рассылки", e); }
        }, 3000);

        // Тихий фоновый прогрев бэкенда
        const pingBackend = () => {
            try {
                if (apiClient && typeof apiClient.ping === 'function') apiClient.ping();
            } catch(e) {}
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => setTimeout(pingBackend, 2500));
        } else {
            setTimeout(pingBackend, 3500);
        }

        const openItemId = urlParams.get('item');
        if (openItemId) {
            setTimeout(() => openProductModalById(openItemId), 500);
        }
        
        if (_supabase) {
            _supabase.channel('public:site_broadcasts')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_broadcasts' }, payload => {
                    const bData = payload.new;
                    if (!bData) return;
                    const hasValidText = bData.message_text && typeof bData.message_text === 'string' && bData.message_text.trim() && bData.message_text.trim() !== 'null';
                    const hasValidImg = bData.image_url && typeof bData.image_url === 'string' && bData.image_url.trim();
                    if (!hasValidText && !hasValidImg) return;

                    let bHtml = '';
                    if (hasValidImg) {
                        bHtml += `<img src="${bData.image_url}" style="width:100%; max-height:200px; object-fit:cover; border-radius:4px; border:1px solid #333; margin-bottom:15px;">`;
                    }
                    if (hasValidText) {
                        bHtml += `<div style="font-size:14px; line-height:1.5;">${bData.message_text.replaceAll('\n', '<br>')}</div>`;
                    }

                    if (typeof tryShowBroadcast === 'function') {
                        tryShowBroadcast('SYSTEM_BROADCAST.MSG', bHtml, '[ ЗАКРЫТЬ ]', () => {
                            if (storage && typeof storage.set === 'function') storage.set('nisha_last_broadcast', bData.id);
                        });
                    }
                })
                .subscribe();

            // Единая подписка на обновления каталога в реальном времени из catalog.js
            if (typeof window.initCatalogRealtimeSubscription === 'function') {
                window.initCatalogRealtimeSubscription();
            }

            if (typeof window.initReviewsRealtime === 'function') {
                window.initReviewsRealtime(_supabase);
            }
        }
        
        // Интеллектуальный скролл каталога для мобильных устройств
        let isBatchLoading = false;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isBatchLoading) {
                if (window.renderedCount < (window.filteredItems ? window.filteredItems.length : 0) && window.innerWidth <= 900) {
                    isBatchLoading = true;
                    requestAnimationFrame(() => {
                        renderNextBatch();
                        isBatchLoading = false;
                    });
                }
            }
        }, { rootMargin: "700px", threshold: 0.01 }); 
        
        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) observer.observe(scrollTrigger);

        if (typeof renderHistory === 'function') renderHistory();
        if (typeof initHitCounter === 'function') initHitCounter();
        if (typeof updateSidebarCounters === 'function') updateSidebarCounters();
        
        const activeUser = store.user;
        if (activeUser && activeUser.phone) {
            const ordSearchEl = document.getElementById('ordersSearchPhone');
            if (ordSearchEl) ordSearchEl.value = activeUser.phone;
        }

        if (storage && storage.get('nisha_rules_accepted')) {
            startOnboardingTour();
        }
    } catch (err) {
        console.error("ОШИБКА ИНИЦИАЛИЗАЦИИ ПРИЛОЖЕНИЯ:", err);
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            grid.innerHTML = `<div style="color:red; text-align:center; padding:40px; grid-column:1/-1;">[ СИСТЕМНАЯ ОШИБКА: ${err.message} ]</div>`;
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
