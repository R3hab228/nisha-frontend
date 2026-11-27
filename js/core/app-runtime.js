// @ts-check
// ==========================================
// NISHA CORE — APPLICATION RUNTIME CONTROLLERS
// Плавный скролл Lenis (desktop), FAB-скролл, инициализация клиента Supabase,
// телефонные маски IMask и отложенный @formkit/auto-animate.
// ==========================================

import { emitAppEvent, invokeAction } from './action-registry.js';

/**
 * Инициализирует плавный скролл Lenis только для десктопа (>900px).
 * @returns {{ stopLenis: () => void, startLenis: () => void }}
 */
export function initDesktopLenisController() {
    /** @type {any} */
    let lenis = null;

    /** @param {any} LenisClass */
    function initDesktopLenis(LenisClass) {
        if (!LenisClass || lenis || window.innerWidth <= 900) return;
        lenis = new LenisClass({
            lerp: 0.14,
            wheelMultiplier: 1.25,
            smoothWheel: true
        });
        window.lenis = lenis;

        /** @param {number} time */
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }

    if (typeof window !== 'undefined' && window.innerWidth > 900) {
        const g = /** @type {any} */ (globalThis);
        const LenisClass = window.Lenis || (typeof g.Lenis !== 'undefined' ? g.Lenis : null);
        if (LenisClass) {
            initDesktopLenis(LenisClass);
        } else {
            import('lenis').then((mod) => {
                const LoadedLenis = mod.default || /** @type {any} */ (mod).Lenis || mod;
                window.Lenis = LoadedLenis;
                g.Lenis = LoadedLenis;
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

    return { stopLenis, startLenis };
}

/**
 * Скрывает/возвращает плавающую кнопку предложки (.fab-propose) при скролле.
 */
export function initFabScrollBehavior() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let fabScrollTimeout;
    let lastScrollY = window.scrollY || document.documentElement.scrollTop;
    let scrollTicking = false;
    /** @type {Element | null} */
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
}

/**
 * Инициализирует Supabase клиент с CDN-роутингом для каталога и таймаутами fetch.
 * @param {any} storage
 * @returns {any}
 */
export function initSupabaseRuntime(storage) {
    const g = /** @type {any} */ (globalThis);
    window.isHacked = false;
    let _supabase = null;
    let clientFingerprint = (storage && typeof storage.get === 'function') ? storage.get('nisha_visitor_id') : null;
    if (!clientFingerprint) {
        clientFingerprint = 'guest_' + Date.now();
    }
    window.clientFingerprint = clientFingerprint;
    g.isHacked = false;
    g.clientFingerprint = clientFingerprint;

    const envData = (typeof window.ENV !== 'undefined') ? window.ENV : ((typeof g.CONFIG !== 'undefined') ? g.CONFIG : {});
    const rawUrl = envData.SUPABASE_URL || '';
    const rawAnonKey = envData.SUPABASE_ANON_KEY || '';

    const SUPABASE_URL = rawUrl.replace(/[^\x20-\x7E]/g, '').trim();
    const SUPABASE_ANON_KEY = rawAnonKey.replace(/[^\x20-\x7E]/g, '').trim();

    if (!SUPABASE_ANON_KEY) {
        console.error('ОШИБКА: Ключ Supabase пустой. База данных недоступна.');
        setTimeout(() => {
            if (typeof window.showToast === 'function') window.showToast('Критическая ошибка: Нет связи с БД', 'error');
        }, 2000);
        return null;
    }

    const clientCreator = (typeof window.createClient === 'function')
        ? window.createClient
        : ((window.supabase && typeof window.supabase.createClient === 'function')
            ? window.supabase.createClient
            : ((typeof g.supabase !== 'undefined' && g.supabase && typeof g.supabase.createClient === 'function')
                ? g.supabase.createClient
                : (typeof g.createClient === 'function' ? g.createClient : null)));

    if (!clientCreator) {
        console.error('ОШИБКА: createClient не найден. База данных недоступна.');
        return null;
    }

    /**
     * @param {RequestInfo | URL} targetUrl
     * @param {RequestInit | undefined} opts
     * @param {number} ms
     */
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
        auth: {
            flowType: 'pkce',
            detectSessionInUrl: true,
            persistSession: true,
            autoRefreshToken: true
        },
        global: {
            fetch: (/** @type {any} */ url, /** @type {any} */ options) => {
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
    g._supabase = _supabase;
    invokeAction('initAuthListener');
    emitAppEvent('nisha:runtime-ready', { hasSupabase: true });
    return _supabase;
}

/**
 * Подключает IMask для полей телефона в чекауте и поиске заказов.
 */
export function initPhoneInputMasks() {
    const IMaskLib = (typeof window !== 'undefined' && window.IMask) || /** @type {any} */ (globalThis).IMask;
    if (typeof IMaskLib !== 'function') return;

    const phoneInput = /** @type {any} */ (document.getElementById('orderPhone'));
    const searchPhoneInput = document.getElementById('ordersSearchPhone');

    if (phoneInput) {
        const phoneMask = IMaskLib(phoneInput, { mask: '+{380} (00) 000-00-00' });
        phoneInput._nishaPhoneMask = phoneMask;
        if (phoneInput.value && typeof window.formatPhoneInput === 'function') {
            window.formatPhoneInput(phoneInput);
        }

        const validatePhoneVisual = () => {
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
        };

        phoneMask.on('accept', () => {
            if (!phoneInput._syncingMaskValue) {
                phoneInput.dataset.userTyped = '1';
            }
            validatePhoneVisual();
            if (!phoneInput._syncingMaskValue && typeof window.checkPhoneAuth === 'function') {
                window.checkPhoneAuth();
            }
        });
        phoneInput.addEventListener('blur', validatePhoneVisual);
        phoneInput.addEventListener('focus', validatePhoneVisual);
    }

    if (searchPhoneInput) {
        IMaskLib(searchPhoneInput, { mask: '+{380} (00) 000-00-00' });
    }
}

/**
 * Отложенно подключает @formkit/auto-animate к сетке истории просмотров.
 */
export function scheduleHistoryAutoAnimate() {
    const initAutoAnimate = async () => {
        const hGrid = document.getElementById('historyGrid');
        if (!hGrid) return;
        const g = /** @type {any} */ (globalThis);
        const animFn = (typeof window !== 'undefined' && window.autoAnimate) || (typeof g.autoAnimate === 'function' ? g.autoAnimate : null);
        if (animFn) {
            animFn(hGrid);
        } else {
            try {
                const mod = await import('@formkit/auto-animate');
                const fn = mod.default || /** @type {any} */ (mod).autoAnimate || mod;
                if (typeof fn === 'function') {
                    window.autoAnimate = fn;
                    fn(hGrid);
                }
            } catch {
                try {
                    const fallbackUrl = 'https://cdn.jsdelivr.net/npm/@formkit/auto-animate@0.8.2/index.min.js';
                    const fallbackMod = await import(/* @vite-ignore */ fallbackUrl);
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
}
