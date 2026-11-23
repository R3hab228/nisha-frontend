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
import { emitAppEvent, hasAction, invokeAction, registerActions } from './js/core/action-registry.js';
import { getRuntimeUser } from './js/core/runtime-env.js';

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

function stopLenis() {
    if (lenis) {
        Object.getPrototypeOf(lenis).stop.call(lenis); 
    }
}

function startLenis() {
    if (lenis) {
        Object.getPrototypeOf(lenis).start.call(lenis); 
    }
}

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
        const fetchWithTimeout = (targetUrl, opts, ms) => {
            if (opts && opts.signal) {
                return fetch(targetUrl, opts);
            }
            if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
                return fetch(targetUrl, { ...(opts || {}), signal: AbortSignal.timeout(ms) });
            }
            return fetch(targetUrl, opts);
        };

        _supabase = clientCreator(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                fetch: (url, options) => {
                    // Используем CDN ТОЛЬКО для главного списка товаров (limit=1000). Точечные запросы идут напрямую!
                    if (typeof url === 'string' && url.includes('/rest/v1/items') && url.includes('limit=1000') && !url.includes('id=eq.') && (!options || options.method === 'GET' || !options.method)) {
                        const cdnUrl = url.replace('nmpuefxqtkhvtltdvllz.supabase.co', 'cdn.nisha-store.shop');
                        return fetchWithTimeout(cdnUrl, options, 4500)
                            .then((res) => (res && res.ok ? res : fetchWithTimeout(url, options, 12000)))
                            .catch(() => fetchWithTimeout(url, options, 12000));
                    }
                    return fetchWithTimeout(url, options, 15000);
                }
            }
        });
        window._supabase = _supabase;
        if (typeof globalThis !== 'undefined') globalThis._supabase = _supabase;
        invokeAction('initAuthListener');
        emitAppEvent('nisha:runtime-ready', { hasSupabase: true });
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
    try {
        sessionStorage.removeItem('nisha_showing_favs');
        sessionStorage.setItem('nisha_last_category', '');
    } catch {}
    if (store && store.session) {
        store.session.remove('nisha_showing_favs');
        store.session.set('nisha_last_category', '');
    }
    
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) searchInput.value = '';
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    
    document.querySelectorAll('.size-cb').forEach(cb => cb.checked = false);
    ['onlySaleCb', 'onlyBargainCb', 'hideUnavailableCb'].forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = false;
    });

    const minInput = document.getElementById('priceMin');
    const maxInput = document.getElementById('priceMax');
    const minDefault = minInput ? (Number.parseInt(minInput.min, 10) || 0) : 0;
    const maxDefault = maxInput ? (Number.parseInt(maxInput.max, 10) || 15000) : 15000;
    if (minInput) minInput.value = String(minDefault);
    if (maxInput) maxInput.value = String(maxDefault);
    const minLabel = document.getElementById('priceMinVal');
    const maxLabel = document.getElementById('priceMaxVal');
    if (minLabel) minLabel.textContent = String(minDefault);
    if (maxLabel) maxLabel.textContent = String(maxDefault);
    const rangeFill = document.getElementById('rangeFill');
    if (rangeFill) {
        rangeFill.style.left = '0%';
        rangeFill.style.right = '0%';
    }
    
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

        // 1. Восстанавливаем фильтры, категорию и поисковый запрос
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

        let showingFavs = false;
        let savedCat = urlParams.get('cat') || null;
        try {
            showingFavs = sessionStorage.getItem('nisha_showing_favs') === 'true';
            if (!savedCat) savedCat = sessionStorage.getItem('nisha_last_category');
        } catch {}

        if (showingFavs) {
            window.showingOnlyFavs = true;
            const favNav = document.getElementById('favNav');
            if (favNav) favNav.style.color = '#fff';
        }
        const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
        catLinks.forEach(el => el.classList.remove('active-filter'));

        if (savedCat) {
            window.currentCategory = savedCat;
            catLinks.forEach(link => {
                const dataCat = link.getAttribute('data-category');
                const onclickText = link.getAttribute('onclick') || '';
                if (dataCat === savedCat || onclickText.includes(`'${savedCat}'`)) {
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

        const bargainParam = urlParams.get('bargain');
        if (bargainParam === '1' || bargainParam === 'true') {
            const bargainCb = document.getElementById('onlyBargainCb');
            if (bargainCb) bargainCb.checked = true;
        }

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
        const sessionPromise = (_supabase && typeof checkSession === 'function') ? checkSession() : Promise.resolve();

        const langPromise = (async () => {
            try {
                if (typeof i18next !== 'undefined') {
                    let savedLng = (storage && typeof storage.get === 'function') ? storage.get('nisha_lang') : null;
                    let savedFlag = (storage && typeof storage.get === 'function') ? storage.get('nisha_flag') : null;
                    
                    if (!savedLng) {
                        const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
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
                    
                    if (typeof i18nextBrowserLanguageDetector !== 'undefined') {
                        i18next.use(i18nextBrowserLanguageDetector);
                    }

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
                            console.error("[ ЯЗЫКИ ] Ошибка загрузки fallback словарей:", fbErr);
                        }
                    }

                    await i18next.init({
                        resources: langResources,
                        lng: savedLng, 
                        fallbackLng: loadSuccess ? savedLng : ['ua', 'ru'],
                        debug: false
                    });
                    
                    if (typeof i18next.on === 'function') {
                        i18next.on('languageChanged', (lng) => {
                            const norm = (typeof normalizeSiteLang === 'function') ? normalizeSiteLang(lng) : (lng || 'ua');
                            if (typeof updateFooterLanguageUI === 'function') {
                                updateFooterLanguageUI(norm);
                            }
                        });
                    }

                    const effectiveLang = (typeof normalizeSiteLang === 'function')
                        ? normalizeSiteLang(i18next.language || savedLng)
                        : (savedLng || 'ua');

                    if (storage && typeof storage.set === 'function') {
                        storage.set('nisha_lang', effectiveLang);
                        const effectiveEmoji = effectiveLang === 'ru' ? '🇷🇺' : (effectiveLang === 'en' ? '🇬🇧' : '🇺🇦');
                        storage.set('nisha_flag', effectiveEmoji);
                    }

                    if (typeof updateContentLanguage === 'function') updateContentLanguage();
                    if (typeof updateFooterLanguageUI === 'function') updateFooterLanguageUI(effectiveLang);
                    if (typeof updateCartUI === 'function') updateCartUI();
                    if (typeof renderCartItems === 'function') renderCartItems();
                    document.documentElement.lang = (effectiveLang === 'ua' ? 'uk' : effectiveLang);
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
                if (window.otpVerified && btnOtp && btnOtp.classList.contains('btn-otp-success')) {
                    phoneInput.classList.add('input-valid');
                    phoneInput.classList.remove('input-invalid');
                    return;
                }
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
                phoneInput.dataset.userTyped = '1';
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
                    } catch {}
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

        // Надежная синхронизация отображения Избранного после завершения загрузки каталога и сессии
        if (window.showingOnlyFavs) {
            const activeUser = getRuntimeUser();
            const favNav = document.getElementById('favNav');
            if (!activeUser) {
                window.showingOnlyFavs = false;
                try { sessionStorage.removeItem('nisha_showing_favs'); } catch {}
                if (favNav) favNav.style.color = 'var(--accent-yellow)';
                const authMsg = (typeof i18next !== 'undefined') ? i18next.t('messages.cart_error_auth') : 'Пожалуйста, войдите в аккаунт';
                if (typeof showToast === 'function') showToast(authMsg, 'error');
                if (typeof applyFilters === 'function') applyFilters(true);
            } else {
                if (favNav) favNav.style.color = '#fff';
                if (typeof applyFilters === 'function') applyFilters(true);
            }
        }

        const resolveBroadcastImageUrls = (rawUrl) => {
            if (!rawUrl || typeof rawUrl !== 'string') return { primary: '', fallback: '' };
            const trimmed = rawUrl.trim();
            if (!/^https?:\/\//i.test(trimmed)) return { primary: '', fallback: '' };
            const cdnUrl = typeof window.toCDN === 'function' ? window.toCDN(trimmed) : trimmed;
            const safePrimary = /^https?:\/\//i.test(cdnUrl) ? cdnUrl.replaceAll('"', '&quot;') : '';
            const safeFallback = trimmed !== cdnUrl ? trimmed.replaceAll('"', '&quot;') : '';
            return { primary: safePrimary, fallback: safeFallback };
        };

        const resolveBroadcastImageList = (bData) => {
            if (!bData) return [];
            const rawList = Array.isArray(bData.image_urls) && bData.image_urls.length > 0
                ? bData.image_urls
                : (bData.image_url ? [bData.image_url] : []);
            const seen = new Set();
            const result = [];
            for (const rawUrl of rawList) {
                if (result.length >= 3) break;
                const pair = resolveBroadcastImageUrls(rawUrl);
                const key = pair.primary || pair.fallback;
                if (!key || seen.has(key)) continue;
                seen.add(key);
                result.push(pair);
            }
            return result;
        };

        const preloadImageWithTimeout = (url, timeoutMs = 1600) => {
            if (!url || typeof Image === 'undefined') return Promise.resolve({ ok: false, width: 0, height: 0 });
            return new Promise((resolve) => {
                let settled = false;
                const done = (ok, width = 0, height = 0) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve({ ok, width, height });
                };
                const timer = setTimeout(() => done(false), timeoutMs);
                const img = new Image();
                img.decoding = 'async';
                img.onload = () => {
                    const w = Number(img.naturalWidth) || 0;
                    const h = Number(img.naturalHeight) || 0;
                    if (typeof img.decode === 'function') {
                        img.decode().catch(() => {}).finally(() => done(true, w, h));
                    } else {
                        done(true, w, h);
                    }
                };
                img.onerror = () => done(false);
                img.src = url;
            });
        };

        const buildBroadcastContent = (bData, resolvedImages = []) => {
            if (!bData) return '';
            const hasValidText = bData.message_text && typeof bData.message_text === 'string' && bData.message_text.trim() && bData.message_text.trim() !== 'null';
            const imgs = Array.isArray(resolvedImages) && resolvedImages.length > 0
                ? resolvedImages
                : resolveBroadcastImageList(bData).map(p => ({ src: p.primary || p.fallback, width: 1200, height: 1200 }));
            const validImgs = imgs.filter(it => it && it.src).slice(0, 3);
            if (!hasValidText && validImgs.length === 0) return '';

            let html = '';
            if (validImgs.length > 0) {
                const zoomSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>';
                const tilesHtml = validImgs.map((it, idx) => {
                    const w = it.width > 0 ? it.width : 1200;
                    const h = it.height > 0 ? it.height : 1200;
                    return `<a href="${it.src}" class="broadcast-media-item" data-pswp-index="${idx}" data-pswp-width="${w}" data-pswp-height="${h}" target="_blank" rel="noopener"><img src="${it.src}" alt="" decoding="async"><span class="broadcast-media-zoom-hint">${zoomSvg}</span></a>`;
                }).join('');
                html += `<div class="broadcast-media-grid" data-count="${validImgs.length}">${tilesHtml}</div>`;
            }
            if (hasValidText) {
                const escFn = hasAction('escapeHtml')
                    ? (s) => invokeAction('escapeHtml', s)
                    : (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
                html += `<div style="font-size:14px; line-height:1.5;">${escFn(bData.message_text).replaceAll('\n', '<br>')}</div>`;
            }
            return html;
        };

        const createMarkBroadcastSeen = (bId) => () => {
            if (!bId) return;
            if (storage && typeof storage.set === 'function') storage.set('nisha_last_broadcast', bId);
            const activeUser = store.user;
            if (activeUser && _supabase) {
                _supabase.from('profiles').update({ last_broadcast_id: bId }).eq('id', activeUser.id).then();
            }
        };

        const _dispatchedBroadcastIds = new Set();

        const dispatchSiteBroadcast = async (bData, { respectOnboardingTour = false } = {}) => {
            if (!bData || !bData.id || _dispatchedBroadcastIds.has(bData.id)) return;
            _dispatchedBroadcastIds.add(bData.id);

            const imagePairs = resolveBroadcastImageList(bData);
            const resolvedImages = await Promise.all(imagePairs.map(async (pair) => {
                if (pair.primary) {
                    const primaryRes = await preloadImageWithTimeout(pair.primary, 1600);
                    if (primaryRes.ok) {
                        return { src: pair.primary, width: primaryRes.width || 1200, height: primaryRes.height || 1200 };
                    }
                    if (pair.fallback) {
                        const fallbackRes = await preloadImageWithTimeout(pair.fallback, 1400);
                        if (fallbackRes.ok) {
                            return { src: pair.fallback, width: fallbackRes.width || 1200, height: fallbackRes.height || 1200 };
                        }
                    }
                }
                return { src: pair.primary || pair.fallback, width: 1200, height: 1200 };
            }));

            const broadcastContent = buildBroadcastContent(bData, resolvedImages);
            const markAsSeen = createMarkBroadcastSeen(bData.id);
            if (!broadcastContent) {
                markAsSeen();
                return;
            }
            const showBroadcastFn = (typeof window.tryShowBroadcast === 'function')
                ? window.tryShowBroadcast
                : (typeof tryShowBroadcast === 'function' ? tryShowBroadcast : (hasAction('tryShowBroadcast') ? (...args) => invokeAction('tryShowBroadcast', ...args) : null));
            const okBtnLabel = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
                ? i18next.t('badge_info.btn_understood', { defaultValue: '[ ПОНЯТНО ]' })
                : '[ ПОНЯТНО ]';
            const tourDone = !respectOnboardingTour || Boolean(store && store.get('nisha_tour_done'));
            if (tourDone && showBroadcastFn) {
                showBroadcastFn('SYSTEM_BROADCAST.MSG', broadcastContent, okBtnLabel, markAsSeen, { persistent: true });
            } else {
                window.pendingBroadcastHtml = broadcastContent;
                window.pendingBroadcastId = bData.id;
                window.pendingBroadcastMarkSeen = markAsSeen;
            }
        };

        let _lastBroadcastCheckAt = 0;
        let _isCheckingBroadcast = false;
        const checkLatestSiteBroadcast = async ({ force = false, respectOnboardingTour = false } = {}) => {
            if (!_supabase || _isCheckingBroadcast) return;
            const now = Date.now();
            if (!force && (now - _lastBroadcastCheckAt) < 10000) return;
            _lastBroadcastCheckAt = now;
            _isCheckingBroadcast = true;
            try {
                const { data: broadcasts, error: broadcastErr } = await _supabase
                    .from('site_broadcasts')
                    .select('id, message_text, image_url, image_urls')
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (broadcastErr) {
                    console.warn('Ошибка загрузки рассылки', broadcastErr);
                    return;
                }

                if (broadcasts && broadcasts.length > 0) {
                    const bData = broadcasts.at(0);
                    const localSeenId = (storage && typeof storage.get === 'function') ? storage.get('nisha_last_broadcast') : null;
                    const profile = store.profile;
                    const dbSeenId = profile ? profile.last_broadcast_id : null;
                    const hasSeen = (localSeenId === bData.id) || (dbSeenId === bData.id);

                    if (!hasSeen) {
                        await dispatchSiteBroadcast(bData, { respectOnboardingTour });
                    }
                }
            } catch (e) {
                console.warn('Ошибка загрузки рассылки', e);
            } finally {
                _isCheckingBroadcast = false;
            }
        };

        // Первичная проверка рассылок и обновление при возврате на вкладку (если Realtime в фоне уснул)
        setTimeout(() => {
            checkLatestSiteBroadcast({ force: true, respectOnboardingTour: true });
        }, 1200);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkLatestSiteBroadcast({ respectOnboardingTour: false });
            }
        });
        window.addEventListener('pageshow', (ev) => {
            if (ev && ev.persisted) {
                checkLatestSiteBroadcast({ force: true, respectOnboardingTour: false });
            }
        });

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

        const openItemId = urlParams.get('item');
        if (openItemId) {
            setTimeout(() => openProductModalById(openItemId), 500);
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
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_broadcasts' }, payload => {
                    const bData = payload.new;
                    if (!bData) return;
                    dispatchSiteBroadcast(bData, { respectOnboardingTour: false });
                })
                .subscribe();

            // Единая подписка на обновления каталога в реальном времени из catalog.js
            invokeAction('initCatalogRealtimeSubscription');

            invokeAction('initReviewsRealtime', _supabase);
        }
        
        // Интеллектуальный скролл каталога для мобильных устройств
        let isBatchLoading = false;
        const observer = new IntersectionObserver((entries) => {
            if (entries.at(0).isIntersecting && !isBatchLoading) {
                if (window.renderedCount < (window.filteredItems ? window.filteredItems.length : 0) && window.innerWidth <= 900) {
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
        }, { rootMargin: "700px", threshold: 0.01 }); 
        
        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) observer.observe(scrollTrigger);

        const savedHistory = storage ? storage.getJSON('nisha_view_history', []) : [];
        if (Array.isArray(savedHistory) && savedHistory.length > 0 && typeof renderHistory === 'function') {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                window.requestIdleCallback(() => renderHistory(), { timeout: 2500 });
            } else {
                setTimeout(() => renderHistory(), 600);
            }
        }
        invokeAction('initHitCounter');
        if (typeof updateSidebarCounters === 'function') updateSidebarCounters();
        invokeAction('renderActiveFilterChips');
        invokeAction('initLeaderElection');
        invokeAction('updateAppBadge');
        
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.__nishaAppBooted = true;
        initApp();
    });
} else {
    window.__nishaAppBooted = true;
    initApp();
}
