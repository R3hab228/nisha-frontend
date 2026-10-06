console.log(`
      _   _ _____  _____ _    _          
     | \\ | |_   _|/ ____| |  | |   /\\    
     |  \\| | | | | (___ | |__| |  /  \\   
     | . \` | | |  \\___ \\|  __  | / /\\ \\  
     | |\\  |_| |_ ____) | |  | |/ ____ \\ 
     |_| \\_|_____|_____/|_|  |_/_/    \\_\\
                                         
    LOOKING AT THE SOURCE CODE? 
`);


function toggleLangDropdown(event) {
    event.stopPropagation();
    document.getElementById('langDropdown').classList.toggle('show');
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('langDropdown');
    if (dropdown && !e.target.closest('.lang-switcher-wrapper')) {
        dropdown.classList.remove('show');
    }
});

function changeLanguage(lng) {
    if (typeof i18next !== 'undefined') {
        i18next.changeLanguage(lng).then(() => {
            // ЖЕЛЕЗОБЕТОННОЕ сохранение:
            localStorage.setItem('nisha_lang', lng); 
            // Сохраняем языковой флаг для плагина i18next
            localStorage.setItem('i18nextLng', lng); 
            
            updateContentLanguage();
            
            // Мгновенно перерисовываем вообще ВСЕ цены и тексты на сайте
            applyFilters(); 
            if (typeof renderCartItems === 'function') renderCartItems();
            if (typeof updateCartUI === 'function') updateCartUI();
            if (typeof renderHistory === 'function') renderHistory();
            
            const msg = i18next.t('messages.lang_changed') + ' [' + lng.toUpperCase() + ']';
            showToast(msg, 'success');

            
            // Если мобильное меню открыто/закрыто — переводим кнопку фильтров
            const sidebar = document.querySelector('.sidebar');
            const btn = document.getElementById('mobileFilterBtn');
            if (btn && sidebar) {
                if (sidebar.classList.contains('active-mobile')) {
                    btn.innerText = i18next.t('mobile.hide_filters', { defaultValue: '[-] СКРЫТЬ ФИЛЬТРЫ' });
                } else {
                    btn.innerText = i18next.t('mobile.show_filters', { defaultValue: '[+] ПОКАЗАТЬ ФИЛЬТРЫ' });
                }
            }
            
            if (currentUser && _supabase) {
                _supabase.from('profiles').update({ language: lng }).eq('id', currentUser.id).then();
            }
        });
    }
}


// === АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ САЙТА (БЕЗ КЭША) ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('[PWA] SW зарегистрирован');
            
            // Принудительно проверяем обновления при каждом заходе
            registration.update();

            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[PWA] Найдено обновление!');
                        showTerminalModal(
                            'SYSTEM_UPDATE.EXE', 
                            'Выпущена новая версия сайта (исправление багов, новые фичи).<br><br>Рекомендуем обновить страницу.', 
                            '[ ОБНОВИТЬ СЕЙЧАС ]', 
                            () => {
                                caches.keys().then(names => {
                                    for (let name of names) caches.delete(name);
// WEB PUSH ПОДПИСКА
                                }).then(() => {
                                    window.location.reload(true);
                                });
                            }
                        );
                    }
                };
            };
        }).catch(err => console.log('[PWA] Ошибка SW: ', err));
    });
}
if (typeof Sentry !== 'undefined') {
    Sentry.init({
        dsn: "https://13d63555c1c64605be8f9659af548581@o4511428929323008.ingest.de.sentry.io/4511428931682384", 
        release: "nisha-store@1.0.0",
        environment: "production",
        tracesSampleRate: 1.0, 
    });
    console.log('[ SENTRY ] СИСТЕМА МОНИТОРИНГА АКТИВНА.');
}
// Переменные для анимации поиска
let searchTypewriterInterval = null;
let currentSearchLang = 'ru';

function updateContentLanguage() {
    // Переводим обычный текст
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerHTML = i18next.t(key);
    });
    
    // Переводим Placeholder'ы инпутов
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        el.placeholder = i18next.t(key);
    });

    // Запускаем печатную машинку поиска
    currentSearchLang = i18next.language || 'ru';
    startSearchTypewriter();
}

function startSearchTypewriter() {
    const searchInput = document.getElementById('mainSearch');
    if (!searchInput) return;

    if (searchTypewriterInterval) clearTimeout(searchTypewriterInterval);
    if (window.searchCursorBlinkInterval) clearInterval(window.searchCursorBlinkInterval);

    const translatedWords = {
        'ua': ['Пошук речей...'],
        'ru': ['Поиск вещи...'],
        'en': ['Search items...']
    };
    
    const words = translatedWords[currentSearchLang] || translatedWords['ru'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let showCursor = true;

    function typeLoop() {
        if (!document.getElementById('mainSearch')) return;
        
        if (document.activeElement === searchInput || searchInput.value.length > 0) {
            searchInput.placeholder = words[wordIndex];
            searchTypewriterInterval = setTimeout(typeLoop, 500);
            return;
        }

        const currentWord = words[wordIndex];

        if (isDeleting) {
            charIndex--;
            searchInput.placeholder = currentWord.substring(0, charIndex) + '|';
            if (charIndex === 0) {
                isDeleting = false;
                wordIndex = (wordIndex + 1) % words.length;
                searchTypewriterInterval = setTimeout(typeLoop, 500);
                return;
            }
            searchTypewriterInterval = setTimeout(typeLoop, 50);
        } else {
            charIndex++;
            searchInput.placeholder = currentWord.substring(0, charIndex) + '|';
            
            if (charIndex === currentWord.length) {
                isDeleting = true;
                let blinkCount = 0;
                const maxBlinks = 4; // 4 * 0.6с = 2.4 секунды паузы перед удалением
                
                window.searchCursorBlinkInterval = setInterval(() => {
                    if (document.activeElement === searchInput || searchInput.value.length > 0) {
                        searchInput.placeholder = currentWord;
                        return;
                    }
                    showCursor = !showCursor;
                    searchInput.placeholder = currentWord + (showCursor ? '|' : '');
                    blinkCount++;
                    
                    if (blinkCount >= maxBlinks) {
                        clearInterval(window.searchCursorBlinkInterval);
                        showCursor = true;
                        searchTypewriterInterval = setTimeout(typeLoop, 50);
                    }
                }, 600);
                return;
            }
            searchTypewriterInterval = setTimeout(typeLoop, 100);
        }
    }

    typeLoop();
}
// ==========================================
// БЕЗОПАСНЫЙ ПЛАВНЫЙ СКРОЛЛ (ТОЛЬКО ДЛЯ ПК)
// ==========================================
let lenis;

if (window.innerWidth > 900) {
    lenis = new Lenis({
        lerp: 0.1, 
        wheelMultiplier: 1, 
        smoothWheel: true
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
}

// Железобетонные функции остановки и запуска
window.stopLenis = function() {
    if (typeof lenis !== 'undefined' && lenis) {
        // Вызываем оригинальный метод библиотеки, чтобы избежать рекурсии
        Object.getPrototypeOf(lenis).stop.call(lenis); 
    }
};

window.startLenis = function() {
    if (typeof lenis !== 'undefined' && lenis) {
        Object.getPrototypeOf(lenis).start.call(lenis); 
    }
};

// Открытие нового модального окна профиля
function openProfileModal() {
    if (typeof lenis !== 'undefined') window.stopLenis();
    document.getElementById('profileModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// --- УМНЫЕ ПЛАВАЮЩИЕ КНОПКИ (ПРЕДЛОЖКА И ФИЛЬТРЫ) ---
let fabScrollTimeout;
let lastScrollY = window.scrollY || document.documentElement.scrollTop;

let scrollTicking = false;
window.addEventListener('scroll', () => {
    if (document.body.classList.contains('search-lock')) return;

    if (!scrollTicking) {
        window.requestAnimationFrame(() => {
            const fab = document.querySelector('.fab-propose');
            const filterBtn = document.getElementById('mobileFilterBtn');
            const currentScrollY = window.scrollY || document.documentElement.scrollTop;
            
            if (Math.abs(currentScrollY - lastScrollY) > 10) {
                if (currentScrollY > lastScrollY && currentScrollY > 150) {
                    // Прокрутка вниз - скрываем элементы
                    if (fab && !fab.classList.contains('cart-active')) fab.classList.add('hidden-scroll');
                    if (filterBtn && window.innerWidth <= 900) filterBtn.classList.add('hidden-scroll');
                } else {
                    // Прокрутка вверх - возвращаем элементы
                    if (fab) fab.classList.remove('hidden-scroll');
                    if (filterBtn) filterBtn.classList.remove('hidden-scroll');
                }
                lastScrollY = currentScrollY;
            }

            // Возвращаем UI, если скролл остановился (на 800мс)
            clearTimeout(fabScrollTimeout);
            fabScrollTimeout = setTimeout(() => {
                if (fab) fab.classList.remove('hidden-scroll');
                if (filterBtn) filterBtn.classList.remove('hidden-scroll');
            }, 800);

            scrollTicking = false;
        });
        scrollTicking = true;
    }
}, { passive: true });


// allItems, currentCategory, currentBrand, showingOnlyFavs initialized in js/catalog/catalog.js
let currentUser = null;
let userProfile = null;
let favorites = [];
// cart initialized in js/cart/cart.js
let currentOpenedItem = null;
let isHacked = false; 
window.isHacked = false; 
let _supabase = null;
let clientFingerprint = "guest_" + Date.now(); 
let orderStatusChannel = null; // Канал заказов
let qaUpdatesChannel = null; // Канал вопросов


let envData = (typeof window.ENV !== 'undefined') ? window.ENV : ((typeof CONFIG !== 'undefined') ? CONFIG : {});
let rawUrl = envData.SUPABASE_URL || '';
let rawAnonKey = envData.SUPABASE_ANON_KEY || '';

const SUPABASE_URL = rawUrl.replace(/[^\x20-\x7E]/g, '').trim();
const SUPABASE_ANON_KEY = rawAnonKey.replace(/[^\x20-\x7E]/g, '').trim();


if (!SUPABASE_ANON_KEY) {
    console.error("ОШИБКА: Ключ Supabase пустой. База данных недоступна.");
    setTimeout(() => showToast('Критическая ошибка: Нет связи с БД', 'error'), 2000);
} else {
    const { createClient } = supabase;
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
}
window.clientFingerprint = clientFingerprint;
// ==========================================
// СИСТЕМА ВЕЧНОЙ СЕССИИ (JWT REFRESH)
// ==========================================
if (_supabase) {
    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
            console.log('[AUTH] Токен безопасности успешно продлен (Refresh Token).');
            currentUser = session.user;
            window.currentUser = currentUser;
        } else if (event === 'SIGNED_OUT') {
            console.log('[AUTH] Выполнен выход из аккаунта.');
            currentUser = null;
            window.currentUser = null;
            userProfile = null;
            favorites = [];
            renderProfilePhone('');
            renderProfileTg('');
            if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
            updateFavBadge();
            // Скрываем профиль, показываем логин
            const loginForm = document.getElementById('loginForm');
            const profileForm = document.getElementById('profileForm');
            if (loginForm) loginForm.style.display = 'flex';
            if (profileForm) profileForm.style.display = 'none';
            // Мобилка
            const mLog = document.getElementById('modalLoginForm');
            const mProf = document.getElementById('modalProfileForm');
            if (mLog) mLog.style.display = 'flex';
            if (mProf) mProf.style.display = 'none';
        } else if (event === 'SIGNED_IN') {
            // Если юзер вошел в соседней вкладке, текущая тоже должна обновиться
            if (!currentUser) await checkSession();
        }
    });
}



// isUserInProductFeed вынесена в js/ui/windows.js

let pendingBroadcastQueue = null;

function tryShowBroadcast(title, htmlText, btnText, callback) {
    if (isUserInProductFeed()) {
        showTerminalModal(title, htmlText, btnText, callback);
        pendingBroadcastQueue = null;
    } else {
        // Если юзер в модалке (заказ, товар, профиль и т.д.) — ставим рассылку в очередь
        pendingBroadcastQueue = { title, htmlText, btnText, callback };
    }
}
window.tryShowBroadcast = tryShowBroadcast;

function checkPendingBroadcast() {
    if (!pendingBroadcastQueue) return;
    setTimeout(() => {
        if (pendingBroadcastQueue && isUserInProductFeed()) {
            const { title, htmlText, btnText, callback } = pendingBroadcastQueue;
            pendingBroadcastQueue = null;
            showTerminalModal(title, htmlText, btnText, callback);
        }
    }, 350);
}
window.checkPendingBroadcast = checkPendingBroadcast;

// Фоновый таймер: как только юзер вернулся в ленту товаров — показываем отложенный броадкаст
setInterval(() => {
    if (pendingBroadcastQueue && isUserInProductFeed()) {
        checkPendingBroadcast();
    }
}, 1500);

function checkRules() {
    if (!localStorage.getItem('nisha_rules_accepted')) {
        const modal = document.getElementById('rulesModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
}

function showRulesModal() { 
    const modal = document.getElementById('rulesModal');
    if (modal) {
        modal.style.display = 'flex'; 
    }
}

function acceptRules() {
    localStorage.setItem('nisha_rules_accepted', 'true');
    const modal = document.getElementById('rulesModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    if (typeof lenis !== 'undefined') window.startLenis(); 
    showToast(i18next.t('messages.rules_accepted'), 'success');
    
    // Запускаем тур сразу после закрытия окна правил
    setTimeout(startOnboardingTour, 400); 
}
window.onload = async () => {
    document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();

    try {
        try {
            // --- УМНЫЙ ДОЖИМ КОРЗИНЫ (Срабатывает при возвращении на сайт) ---
            if (cart.length > 0) {
                let lastTime = localStorage.getItem('nisha_cart_time');
                // Проверяем: если прошел 1 час И мы еще не напоминали
                if (lastTime && (Date.now() - parseInt(lastTime)) > 3600000 && !localStorage.getItem('nisha_cart_reminded')) {
                    setTimeout(() => {
                        showTerminalModal(
                            'SYSTEM_ALERT.LOG',
                            'Мы заметили, что вы не завершили заказ. Редкие вещи забирают быстро!<br><br><b style="color:var(--accent-yellow);">Используйте промокод COMEBACK5 для скидки 5%!</b>',
                            '[ ПРОДОЛЖИТЬ ПОКУПКИ ]', null
                        );
                        localStorage.setItem('nisha_cart_reminded', 'true');
                    }, 2000);
                }
            }

            // Дожим через системный PUSH + Фоновое обновление при возвращении из других приложух
            let cartAbandonTimeout;
            document.addEventListener("visibilitychange", async () => {
                if (document.hidden) {
                    if (cart.length > 0) {
                        cartAbandonTimeout = setTimeout(() => {
                            if ('serviceWorker' in navigator && Notification.permission === 'granted') {
                                navigator.serviceWorker.ready.then(reg => {
                                    reg.showNotification("NISHA STORE", {
                                        body: "Твои товары все еще ждут в корзине! Оформи, пока их не забрали.",
                                        icon: '/icon-192.png',
                                        badge: '/badge.png',
                                        vibrate: [200, 100, 200],
                                        data: { url: '/' }
                                    });
                                });
                            }
                        }, 10 * 60 * 1000);
                    }
                } else {
                    if (cartAbandonTimeout) clearTimeout(cartAbandonTimeout);
                    if (_supabase) {
                        await checkSession();
                        if (allItems.length > 0) {
                            loadAllItems(); 
                        }
                    }
                }
            });

            if (typeof i18next !== 'undefined') {
                let savedLng = localStorage.getItem('nisha_lang');
                let savedFlag = localStorage.getItem('nisha_flag');
                
                if (!savedLng) {
                    const browserLang = navigator.language || navigator.userLanguage;
                    if (browserLang.toLowerCase().includes('ru')) {
                        savedLng = 'ru'; savedFlag = '🇷🇺';
                    } else if (browserLang.toLowerCase().includes('en')) {
                        savedLng = 'en'; savedFlag = '🇬🇧';
                    } else {
                        savedLng = 'ua'; savedFlag = '🇺🇦';
                    }
                    localStorage.setItem('nisha_lang', savedLng);
                    localStorage.setItem('nisha_flag', savedFlag);
                }
                
                if (typeof i18nextBrowserLanguageDetector !== 'undefined') {
                    i18next.use(i18nextBrowserLanguageDetector);
                }

                // Загружаем словари из отдельного файла
                const locRes = await fetch('/locales.json');
                const localesData = await locRes.json();

                await i18next.init({
                    resources: localesData,
                    lng: savedLng, 
                    fallbackLng: 'ru',
                    debug: false
                });
                
                updateContentLanguage();
                const flagEl = document.getElementById('currentFlag');
                if (flagEl) flagEl.innerText = savedFlag;
            }
        } catch (langErr) {
            console.warn("[ ЯЗЫКИ ] Ошибка загрузки словарей:", langErr);
        }


        const phoneInput = document.getElementById('orderPhone');
        const searchPhoneInput = document.getElementById('ordersSearchPhone');
        if (phoneInput && typeof IMask !== 'undefined') {
            const phoneMask = IMask(phoneInput, { mask: '+{380} (00) 000-00-00' });
            phoneMask.on('accept', () => checkPhoneAuth());
        }
        if (searchPhoneInput && typeof IMask !== 'undefined') {
            IMask(searchPhoneInput, { mask: '+{380} (00) 000-00-00' });
        }

        
       if (typeof autoAnimate === 'function') {
            autoAnimate(document.getElementById('historyGrid'));
            // Убрали ordersListArea, теперь мы анимируем его сами через CSS
        }

        checkRules();
        updateCartUI(); 
        
        
        // win95-pixel-hourglass rendered natively via SVG








        
        if (_supabase) {
            await checkSession();
            const urlParams = new URLSearchParams(window.location.search);
            
            // Восстанавливаем вкладку "Избранное"
            if (sessionStorage.getItem('nisha_showing_favs') === 'true') {
                showingOnlyFavs = true;
                const favNav = document.getElementById('favNav');
                if (favNav) favNav.style.color = '#fff';
            }

            // --- ФИКС: ИДЕАЛЬНОЕ ВОССТАНОВЛЕНИЕ КАТЕГОРИИ И UI ---
            const savedCat = urlParams.get('cat') || sessionStorage.getItem('nisha_last_category');
            
            // 1. Очищаем все выделения в меню категорий
            const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
            catLinks.forEach(el => el.classList.remove('active-filter'));

            if (savedCat) {
                currentCategory = savedCat;
                
                // 2. Ищем ссылку, внутри onclick которой есть наша сохраненная категория, и красим её
                catLinks.forEach(link => {
                    const onclickText = link.getAttribute('onclick') || '';
                    if (onclickText.includes(`'${currentCategory}'`)) {
                        link.classList.add('active-filter');
                    }
                });
            } else {
                // Если ничего не сохранено - выделяем "Все вещи"
                const firstLink = document.querySelector('.sidebar .filter-list:first-of-type a');
                if (firstLink) firstLink.classList.add('active-filter');
            }

            // --- НОВОЕ: ВОССТАНОВЛЕНИЕ ПОИСКОВОГО ЗАПРОСА В UI ---
            const savedQuery = urlParams.get('q');
            if (savedQuery) {
                const sInput = document.getElementById('mainSearch');
                if (sInput) {
                    sInput.value = savedQuery;
                    // Показываем крестик для сброса поиска
                    const clearBtn = document.getElementById('clearSearchBtn');
                    if (clearBtn) clearBtn.style.display = 'block';
                }
            }

            await loadAllItems();

         // --- ПРОВЕРКА РАССЫЛОК ОТ АДМИНА (УМНАЯ) ---
            setTimeout(async () => {
                try {
                    const { data: broadcasts } = await _supabase.from('site_broadcasts').select('*').order('created_at', { ascending: false }).limit(1);
                    
                    if (broadcasts && broadcasts.length > 0) {
                        const bData = broadcasts[0];
                        
                        const localSeenId = localStorage.getItem('nisha_last_broadcast');
                        const dbSeenId = userProfile ? userProfile.last_broadcast_id : null;
                        const hasSeen = (localSeenId === bData.id) || (dbSeenId === bData.id);

                        if (!hasSeen) {
                            let broadcastContent = ''; // Переименовали переменную для 100% безопасности
                            if (bData.image_url) {
                                broadcastContent += `<img src="${bData.image_url}" style="width:100%; max-height:200px; object-fit:cover; border-radius:4px; border:1px solid #333; margin-bottom:15px;">`;
                            }
                            if (bData.message_text) {
                                broadcastContent += `<div style="font-size:14px; line-height:1.5;">${bData.message_text.replace(/\n/g, '<br>')}</div>`;
                            }

                            const markAsSeen = () => {
                                localStorage.setItem('nisha_last_broadcast', bData.id);
                                if (currentUser && _supabase) {
                                    _supabase.from('profiles').update({ last_broadcast_id: bData.id }).eq('id', currentUser.id).then();
                                }
                            };

                            if (localStorage.getItem('nisha_tour_done')) {
                                tryShowBroadcast('SYSTEM_BROADCAST.MSG', broadcastContent, '[ ЗАКРЫТЬ ]', markAsSeen);
                            } else {
                                window.pendingBroadcastHtml = broadcastContent;
                                window.pendingBroadcastId = bData.id;
                            }
                        }
                    }
                } catch(e) { console.warn("Ошибка загрузки рассылки", e); }
            }, 3000);

            const openItemId = urlParams.get('item');
            if (openItemId) {
                setTimeout(() => openProductModalById(openItemId), 500);
            }
            
           // --- НОВОЕ: РАССЫЛКА В РЕАЛЬНОМ ВРЕМЕНИ ДЛЯ ТЕХ, КТО УЖЕ НА САЙТЕ ---
            _supabase.channel('public:site_broadcasts')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_broadcasts' }, payload => {
                    const bData = payload.new;
                    let bHtml = '';
                    if (bData.image_url) {
                        bHtml += `<img src="${bData.image_url}" style="width:100%; max-height:200px; object-fit:cover; border-radius:4px; border:1px solid #333; margin-bottom:15px;">`;
                    }
                    if (bData.message_text) {
                        bHtml += `<div style="font-size:14px; line-height:1.5;">${bData.message_text.replace(/\n/g, '<br>')}</div>`;
                    }

                    // Сразу показываем рассылку поверх всего, даже если страница не обновлялась
                    tryShowBroadcast('SYSTEM_BROADCAST.MSG', bHtml, '[ ЗАКРЫТЬ ]', () => {
                        localStorage.setItem('nisha_last_broadcast', bData.id);
                    });
                })
                .subscribe();

         _supabase.channel('public:items')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, payload => {
                    // ЕСЛИ ДОБАВИЛИ НОВУЮ ВЕЩЬ ЧЕРЕЗ БОТА
                    if (payload.eventType === 'INSERT') {
                        allItems.unshift(payload.new); // Добавляем в начало массива
                        showToast(`🆕 Новая вещь на сайте: ${payload.new.name}`, 'success');
                        applyFilters(); // Плавно перерисовываем сетку
                    } 
                    // ЕСЛИ АДМИН УДАЛИЛ ВЕЩЬ
                    else if (payload.eventType === 'DELETE') {
                        allItems = allItems.filter(i => i.id !== payload.old.id);
                        applyFilters();
                    }
                    // ЕСЛИ ВЕЩЬ КУПИЛИ ИЛИ ОБНОВИЛИ
                    else if (payload.eventType === 'UPDATE') {
                        const updatedItem = payload.new;
                        const index = allItems.findIndex(i => i.id === updatedItem.id);
                        let needsGridUpdate = false;
                        if (index !== -1) {
                            const oldItem = allItems[index];
                            
                            // Проверка: упала ли цена / появилась ли скидка
                            const priceDropped = (!oldItem.is_sale && updatedItem.is_sale) || (oldItem.price > updatedItem.price);
                            const imgUrl = (updatedItem.thumbnails && updatedItem.thumbnails.length > 0) ? updatedItem.thumbnails[0] : ((updatedItem.images && updatedItem.images.length > 0) ? updatedItem.images[0] : null);

                            needsGridUpdate = oldItem.is_top !== updatedItem.is_top || 
                                              oldItem.top_until !== updatedItem.top_until || 
                                              oldItem.status !== updatedItem.status ||
                            Object.assign(allItems[index], updatedItem);
                            
                            if (priceDropped && updatedItem.status === 'available') {
                                showToast('🔥 СКИДКА!!!', 'success', imgUrl);
                            }

                            if (updatedItem.status === 'available') {
                                const cartIdx = cart.findIndex(c => c.id === updatedItem.id);
                                if (cartIdx !== -1) {
                                    cart.splice(cartIdx, 1);
                                    localStorage.setItem('nisha_cart', JSON.stringify(cart));
                                    syncCartToServer();
                                    updateCartUI();
                                    showToast(`Бронь истекла. ${updatedItem.name} снова в наличии.`, 'error');
                                }
                            }
                            
                            // СИНХРОННОЕ ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ КАРТОЧКИ БЕЗ ПЕРЕЗАГРУЗКИ ГРИДА
                            if (typeof updateCardDOM === 'function') {
                                updateCardDOM(allItems[index]);
                            }
                            
                            if (currentOpenedItem && currentOpenedItem.id === updatedItem.id) {
                                if (updatedItem.status === 'sold') {
                                    const cartBtn = document.getElementById('modalCartBtn');
                                    const waitBtn = document.getElementById('modalWaitlistBtn');
                                    if(cartBtn) cartBtn.style.display = 'none';
                                    if(waitBtn) waitBtn.style.display = 'block';
                                }
                            }
                        }
                    }
                })
                .subscribe();
        } else {
            document.getElementById('itemsGrid').innerHTML = `<div style="color:red; padding:20px; text-align:center;">[ БД НЕ ПОДКЛЮЧЕНА ]</div>`;
        }
        
       // 🚀 СОВРЕМЕННЫЙ ИНТЕЛЛЕКТУАЛЬНЫЙ СКРОЛЛ (Как в Instagram)
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                if (renderedCount < filteredItems.length && window.innerWidth <= 900) {
                    const scrollTrigger = document.getElementById('loadingTrigger');
                    if (scrollTrigger) {
                        scrollTrigger.style.display = 'block';
                        scrollTrigger.innerHTML = '<span style="animation: pulse 1s infinite; color: var(--accent-green);">[ ЗАГРУЗКА АРХИВА... ]</span>';
                    }
                    setTimeout(() => {
                        renderNextBatch();
                    }, 300);
                }
            }
        }, { rootMargin: "600px", threshold: 0.1 }); 
        
        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) observer.observe(scrollTrigger);

        renderHistory();
        initHitCounter();
        
        if (currentUser && currentUser.phone) {
            document.getElementById('ordersSearchPhone').value = currentUser.phone;
        }

       // Если правила уже были приняты ранее, но тур не пройден — запускаем
        if (localStorage.getItem('nisha_rules_accepted')) {
            startOnboardingTour();
        }

        // ==============================================================
        // --- СИСТЕМА ЛИЧНЫХ ОТВЕТОВ ОТ ПОДДЕРЖКИ (js/chat/chat.js) ---
        // ==============================================================
        if (typeof initSupportRepliesSystem === 'function') {
            setTimeout(initSupportRepliesSystem, 3000);
        }

    } catch (err) {
       
        console.error("ОШИБКА ИНИЦИАЛИЗАЦИИ ПРИЛОЖЕНИЯ:", err);
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            grid.innerHTML = `<div style="color:red; text-align:center; padding:40px; grid-column:1/-1;">[ СИСТЕМНАЯ ОШИБКА: ${err.message} ]</div>`;
        }
    }
};


// closeModal и executeCloseModal вынесены в js/ui/windows.js

// openReviewsModal and openReviewImage moved to js/reviews/reviews.js

async function checkSession() {
    try {
        // Жесткая проверка юзера на сервере, а не в кэше
        const { data: { user }, error: userError } = await _supabase.auth.getUser();
        
        if (user && !userError) {
            currentUser = user;
            window.currentUser = currentUser;
            const { data: profiles, error } = await _supabase.from('profiles').select('*').eq('id', currentUser.id).limit(1);
           if (!error && profiles && profiles.length > 0) { 
                userProfile = profiles[0]; 
                
                // --- СИНХРОНИЗАЦИЯ ЯЗЫКА ИЗ БД В БРАУЗЕР ---
                if (userProfile.language) {
                    const currentLang = localStorage.getItem('nisha_lang') || 'ru';
                    if (userProfile.language !== currentLang) {
                        localStorage.setItem('nisha_lang', userProfile.language);
                        const newFlag = userProfile.language === 'ru' ? '🇷🇺' : (userProfile.language === 'en' ? '🇬🇧' : '🇺🇦');
                        localStorage.setItem('nisha_flag', newFlag);
                        if (typeof i18next !== 'undefined') {
                            i18next.changeLanguage(userProfile.language).then(() => {
                                updateContentLanguage();
                                const footLang = document.getElementById('currentLangLabelFooter');
                                if (footLang) footLang.innerText = '[' + userProfile.language.toUpperCase() + '] ▼';
                            });
                        }
                    }
                }
            }

            // УМНАЯ ЛОГИКА ИМЕНИ:
            // Если в БД записалось дефолтное 'User' (или пусто), то жестко берем имя из Google
            let uName = userProfile?.username;
            if (!uName || uName === 'User') {
                uName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
            }
            const uEmail = currentUser.email;

            // БЕЗОПАСНО Обновляем ПК (Сайдбар)
            const loginForm = document.getElementById('loginForm');
            const profileForm = document.getElementById('profileForm');
            if (loginForm) loginForm.style.display = 'none';
            if (profileForm) profileForm.style.display = 'flex';
            
            if(document.getElementById('profileName')) document.getElementById('profileName').innerText = uName;
            if(document.getElementById('profileEmail')) document.getElementById('profileEmail').innerText = uEmail; // ДОБАВИЛИ E-MAIL ДЛЯ ПК

            // БЕЗОПАСНО Обновляем Мобилку (Модалка)
            const mLog = document.getElementById('modalLoginForm');
            const mProf = document.getElementById('modalProfileForm');
            if (mLog) mLog.style.display = 'none';
            if (mProf) mProf.style.display = 'block';
            
            if(document.getElementById('modalProfileName')) document.getElementById('modalProfileName').innerText = uName;
            if(document.getElementById('modalProfileEmail')) document.getElementById('modalProfileEmail').innerText = uEmail;
            const uPhone = (userProfile?.phone || '').trim();
            renderProfilePhone(uPhone);
            const uTg = (userProfile?.tg || '').trim();
            renderProfileTg(uTg);
            if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
            if (localStorage.getItem('nisha_pending_otp_phone') && typeof checkPendingPhoneVerification === 'function') {
                checkPendingPhoneVerification();
                if (localStorage.getItem('nisha_pending_otp_phone') && !window.profileOtpPollInterval) {
                    window.profileOtpPollInterval = setInterval(() => {
                        checkPendingPhoneVerification();
                    }, 2000);
                }
            }
            if (localStorage.getItem('nisha_pending_otp_tg') && typeof checkPendingTgVerification === 'function') {
                checkPendingTgVerification();
                if (localStorage.getItem('nisha_pending_otp_tg') && !window.profileTgPollInterval) {
                    window.profileTgPollInterval = setInterval(() => {
                        checkPendingTgVerification();
                    }, 2000);
                }
            }
            // --- ПРИВЯЗКА ПУШЕЙ К ПРОФИЛЮ ---
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    if (typeof subscribeUserToPush === 'function') {
                        subscribeUserToPush(reg, true); // silent = true
                    }
                });
            }
            
           // --- УВЕДОМЛЕНИЯ О СТАТУСЕ ЗАКАЗА В РЕАЛЬНОМ ВРЕМЕНИ ---
            if (orderStatusChannel) _supabase.removeChannel(orderStatusChannel);
            orderStatusChannel = _supabase.channel('order-status-updates')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'orders',
                    filter: `user_id=eq.${currentUser.id}` 
                }, payload => {
                    const newStatus = payload.new.status;
                    if (newStatus !== payload.old.status) {
                        showToast(`Заказ #${payload.new.id.split('-')[0].toUpperCase()}: ${newStatus.toUpperCase()}`, 'success');
                        
                        showTerminalModal(
                            'SYSTEM_NOTIFICATION.LOG',
                            `ВНИМАНИЕ! Статус вашего заказа изменился.<br><br>` +
                            `Заказ: #${payload.new.id.split('-')[0].toUpperCase()}<br>` +
                            `Новый статус: <b style="color:var(--accent-green);">${newStatus.toUpperCase()}</b>`,
                            '[ ПОСМОТРЕТЬ ]',
                            () => openOrdersModal()
                        );
                    }
                })
                .subscribe();

           // --- УВЕДОМЛЕНИЯ ОБ ОТВЕТАХ НА ВОПРОСЫ ---
            if (qaUpdatesChannel) _supabase.removeChannel(qaUpdatesChannel);
            qaUpdatesChannel = _supabase.channel('qa-updates')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'item_questions',
                    filter: `user_id=eq.${currentUser.id}` 
                }, payload => {
                    if (payload.new.answer && !payload.old.answer) {
                        const msg = i18next.t('messages.qa_answered', {defaultValue: 'Вам ответили на вопрос!'});
                        showToast(msg, 'success');
                    }
                })
                .subscribe();

            await loadFavorites();
           
            
          // --- УМНОЕ ВОССТАНОВЛЕНИЕ БРОШЕННОЙ КОРЗИНЫ ---
            if (userProfile && userProfile.cart && userProfile.cart.length > 0) {
                const dbCart = userProfile.cart;
                
                // Если текущая локальная корзина пуста — просто берем из БД
                if (cart.length === 0) {
                    cart = dbCart;
                    window.cart = cart;
                    showToast('Корзина восстановлена', 'success');
                } else {
                    // Если локально что-то есть, объединяем обе корзины без дубликатов
                    let mergedCart = [...cart];
                    let addedCount = 0;
                    
                    dbCart.forEach(dbItem => {
                        if (!mergedCart.some(localItem => localItem.id === dbItem.id)) {
                            mergedCart.push(dbItem);
                            addedCount++;
                        }
                    });
                    
                    cart = mergedCart;
                    window.cart = cart;
                    if (addedCount > 0) showToast('Корзины синхронизированы', 'success');
                }
                
                // Сохраняем объединенный результат локально и отправляем обратно в БД
                localStorage.setItem('nisha_cart', JSON.stringify(cart));
                await syncCartToServer();
            } else {
                // Если в БД пусто, но юзер накидал вещей гостем — отправляем их в базу
                if (cart.length > 0) {
                    await syncCartToServer();
                }
            }
            updateCartUI();
        } else {
            currentUser = null;
            window.currentUser = null;
            userProfile = null;
            favorites = [];
            renderProfilePhone('');
            renderProfileTg('');
            if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
            
            // БЕЗОПАСНО ПК
            const loginForm = document.getElementById('loginForm');
            const profileForm = document.getElementById('profileForm');
            if (loginForm) loginForm.style.display = 'flex';
            if (profileForm) profileForm.style.display = 'none';
            
            // БЕЗОПАСНО Мобилка
            const mLog = document.getElementById('modalLoginForm');
            const mProf = document.getElementById('modalProfileForm');
            if (mLog) mLog.style.display = 'flex';
            if (mProf) mProf.style.display = 'none';
            
            updateFavBadge();
        }
    } catch (err) { console.error("Ошибка в checkSession:", err); }
}


// ==========================================
// WIN95 HOURGLASS ICON (RETRO PIXEL ART)
// ==========================================
const WIN95_HOURGLASS_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAYCAYAAAAlBadpAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAB6SURBVDhPzY1RDoAwCEO5/6U1ksAGax2oHzZBse1DOV5I9CHSngWuiMKdcdgOVDT3rs3/XtHU0+0H8O5A6gwYhEEgc/j2APCUmWF4gIGfwqyMvACzkgtkAwbhotSJcNbG47B9M5/CGUSZwcGsvnU3ozsLXBGFO+PwU53EDRInk3MqPwAAAABJRU5ErkJggg==";

function getWin95HourglassHtml(height = 14) {
    return `<svg class="win95-pixel-hourglass" style="height:${height}px;width:auto" viewBox="0 0 15 24" shape-rendering="crispEdges">
<path fill="#fff" d="M3,4 H12 V8 H11 V9 H10 V10 H9 V11 H8 V13 H9 V14 H10 V15 H11 V16 H12 V20 H3 V16 H4 V15 H5 V14 H6 V13 H7 V11 H6 V10 H5 V9 H4 V8 H3 Z" />
<rect x="3" y="2" width="9" height="1" fill="#fff" />
<rect x="3" y="21" width="9" height="1" fill="#fff" />
<g class="hg-top-1"><rect x="3" y="4" width="9" height="1" fill="#000" /></g>
<g class="hg-top-2"><rect x="3" y="5" width="9" height="1" fill="#000" /></g>
<g class="hg-top-3"><rect x="3" y="6" width="9" height="1" fill="#000" /></g>
<g class="hg-top-4"><rect x="4" y="7" width="7" height="1" fill="#000" /></g>
<g class="hg-top-5"><rect x="5" y="8" width="5" height="1" fill="#000" /></g>
<g class="hg-top-6"><rect x="6" y="9" width="3" height="1" fill="#000" /><rect x="7" y="10" width="1" height="1" fill="#000" /></g>
<g class="hg-stream"><rect class="hg-drop-1" x="7" y="11" width="1" height="1" fill="#000" /><rect class="hg-drop-2" x="7" y="13" width="1" height="1" fill="#000" /></g>
<g class="hg-bot-1"><rect x="3" y="19" width="9" height="1" fill="#000" /></g>
<g class="hg-bot-2"><rect x="3" y="18" width="9" height="1" fill="#000" /></g>
<g class="hg-bot-3"><rect x="4" y="17" width="7" height="1" fill="#000" /></g>
<g class="hg-bot-4"><rect x="5" y="16" width="5" height="1" fill="#000" /></g>
<g class="hg-bot-5"><rect x="6" y="15" width="3" height="1" fill="#000" /></g>
<g class="hg-bot-6"><rect x="7" y="14" width="1" height="1" fill="#000" /></g>
<rect x="1" y="1" width="13" height="1" fill="#000" />
<rect x="1" y="2" width="2" height="1" fill="#000" />
<rect x="12" y="2" width="2" height="1" fill="#000" />
<rect x="1" y="3" width="13" height="1" fill="#000" />
<rect x="2" y="4" width="1" height="4" fill="#000" />
<rect x="12" y="4" width="1" height="4" fill="#000" />
<rect x="2" y="8" width="2" height="1" fill="#000" />
<rect x="11" y="8" width="2" height="1" fill="#000" />
<rect x="3" y="9" width="2" height="1" fill="#000" />
<rect x="10" y="9" width="2" height="1" fill="#000" />
<rect x="4" y="10" width="2" height="1" fill="#000" />
<rect x="9" y="10" width="2" height="1" fill="#000" />
<rect x="5" y="11" width="2" height="2" fill="#000" />
<rect x="8" y="11" width="2" height="2" fill="#000" />
<rect x="4" y="13" width="2" height="1" fill="#000" />
<rect x="9" y="13" width="2" height="1" fill="#000" />
<rect x="3" y="14" width="2" height="1" fill="#000" />
<rect x="10" y="14" width="2" height="1" fill="#000" />
<rect x="2" y="15" width="2" height="1" fill="#000" />
<rect x="11" y="15" width="2" height="1" fill="#000" />
<rect x="2" y="16" width="1" height="4" fill="#000" />
<rect x="12" y="16" width="1" height="4" fill="#000" />
<rect x="1" y="20" width="13" height="1" fill="#000" />
<rect x="1" y="21" width="2" height="1" fill="#000" />
<rect x="12" y="21" width="2" height="1" fill="#000" />
<rect x="1" y="22" width="13" height="1" fill="#000" />
</svg>`;
}
window.getWin95HourglassHtml = getWin95HourglassHtml;

// ==========================================
// НОМЕР ТЕЛЕФОНА В ПРОФИЛЕ
// ==========================================
// НОМЕР ТЕЛЕФОНА В ПРОФИЛЕ (WIN95 СТИЛЬ)
// ==========================================
function renderProfilePhone(phone) {
    const hasPhone = Boolean(phone && phone.trim().length > 0);
    const delBtnHtml = (isModal) => `<button onclick="removeProfilePhone(${isModal})" title="Удалить номер" class="win95-check-btn" style="background:#2a2a2a;border:2px outset #777;color:#ff5555;font-family:var(--font-mono);font-size:10px;padding:1px 5px;cursor:pointer;line-height:1;box-shadow:1px 1px 0 #000;margin-left:auto">✕</button>`;
    
    // 1. Сайдбар (ПК)
    const pPhone = document.getElementById('profilePhone');
    const pBtn = document.getElementById('profileAddPhoneBtn');
    const pWrap = document.getElementById('profilePhoneInputWrap');
    if (pPhone && pBtn) {
        if (hasPhone) {
            pPhone.innerHTML = `<span style="word-break:break-all">${phone}</span>${delBtnHtml(false)}`;
            pPhone.style.display = 'flex';
            pPhone.style.alignItems = 'center';
            pPhone.style.justifyContent = 'space-between';
            pBtn.style.display = 'none';
        } else {
            pPhone.innerHTML = '';
            pPhone.style.display = 'none';
            pBtn.style.display = 'inline-block';
        }
        if (pWrap) pWrap.style.display = 'none';
    }

    // 2. Модалка (Мобилка)
    const mPhone = document.getElementById('modalProfilePhone');
    const mBtn = document.getElementById('modalProfileAddPhoneBtn');
    const mWrap = document.getElementById('modalProfilePhoneInputWrap');
    if (mPhone && mBtn) {
        if (hasPhone) {
            mPhone.innerHTML = `<span style="word-break:break-all">${phone}</span>${delBtnHtml(true)}`;
            mPhone.style.display = 'flex';
            mPhone.style.alignItems = 'center';
            mPhone.style.justifyContent = 'space-between';
            mBtn.style.display = 'none';
        } else {
            mPhone.innerHTML = '';
            mPhone.style.display = 'none';
            mBtn.style.display = 'inline-block';
        }
        if (mWrap) mWrap.style.display = 'none';
    }

    const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn');
    saveBtns.forEach(b => {
        b.disabled = false;
        b.innerText = '✓';
    });
}
window.renderProfilePhone = renderProfilePhone;

window.removeProfilePhone = async function(isModal = false) {
    if (!currentUser) return;
    try {
        await _supabase.from('profiles').update({ phone: null }).eq('id', currentUser.id);
        try { await _supabase.auth.updateUser({ data: { phone: null } }); } catch(e) {}
    } catch(err) {
        console.error('Ошибка удаления телефона:', err);
    }

    if (userProfile) userProfile.phone = null;
    localStorage.removeItem('nisha_last_phone');
    localStorage.removeItem('nisha_pending_otp_phone');
    localStorage.removeItem('nisha_pending_otp_phone_time');

    renderProfilePhone('');
    showToast('Номер телефона удален!', 'info');
    updateProposeAndCheckoutFields();
};

window.showPhoneInput = function(isModal = false) {
    const btn = document.getElementById(isModal ? 'modalProfileAddPhoneBtn' : 'profileAddPhoneBtn');
    const wrap = document.getElementById(isModal ? 'modalProfilePhoneInputWrap' : 'profilePhoneInputWrap');
    const input = document.getElementById(isModal ? 'modalProfilePhoneInput' : 'profilePhoneInput');
    const saveBtn = document.querySelector(isModal ? '#modalProfilePhoneInputWrap .win95-save-btn' : '#profilePhoneInputWrap .win95-save-btn');
    if (saveBtn && localStorage.getItem('nisha_pending_otp_phone')) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getWin95HourglassHtml(14);
    } else if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = '✓';
    }

    if (btn) btn.style.display = 'none';
    if (wrap) wrap.style.display = 'flex';
    if (input) {
        if (typeof IMask !== 'undefined' && !input._imask) {
            input._imask = IMask(input, { mask: '+{380} (00) 000-00-00' });
        }
        input.focus();
        input.onkeydown = (e) => {
            if (e.key === 'Enter') savePhoneFromInput(isModal);
            if (e.key === 'Escape') hidePhoneInput(isModal);
        };
    }
};

window.hidePhoneInput = function(isModal = false) {
    if (window.profileOtpPollInterval) {
        clearInterval(window.profileOtpPollInterval);
        window.profileOtpPollInterval = null;
    }
    window.pendingOtpPhone = null;
    localStorage.removeItem('nisha_pending_otp_phone');
    localStorage.removeItem('nisha_pending_otp_phone_time');
    const btn = document.getElementById(isModal ? 'modalProfileAddPhoneBtn' : 'profileAddPhoneBtn');
    const wrap = document.getElementById(isModal ? 'modalProfilePhoneInputWrap' : 'profilePhoneInputWrap');
    const input = document.getElementById(isModal ? 'modalProfilePhoneInput' : 'profilePhoneInput');

    if (wrap) wrap.style.display = 'none';
    if (btn) btn.style.display = 'inline-block';
    if (input && input._imask) {
        input._imask.value = '';
    } else if (input) {
        input.value = '';
    }
    const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn'); saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; }); //




};

let isCheckingPhoneOtp = false;
let isPhoneOtpCompleted = false;
let isCheckingTgOtp = false;
let isTgOtpCompleted = false;

async function checkPendingPhoneVerification() {
    if (isCheckingPhoneOtp || isPhoneOtpCompleted) return;
    const pendingPhone = window.pendingOtpPhone || localStorage.getItem('nisha_pending_otp_phone');
    if (!pendingPhone) return;

    const phoneStartTime = parseInt(localStorage.getItem('nisha_pending_otp_phone_time') || '0', 10);
    if (phoneStartTime && (Date.now() - phoneStartTime > 120000)) {
        if (window.profileOtpPollInterval) {
            clearInterval(window.profileOtpPollInterval);
            window.profileOtpPollInterval = null;
        }
        window.pendingOtpPhone = null;
        localStorage.removeItem('nisha_pending_otp_phone');
        localStorage.removeItem('nisha_pending_otp_phone_time');
        const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn');
        saveBtns.forEach(b => { b.disabled = false; b.innerText = '\u2713'; });
        showToast('\u0412\u0440\u0435\u043C\u044F \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u043E\u043C\u0435\u0440\u0430 \u0438\u0441\u0442\u0435\u043A\u043B\u043E', 'error');
        return;
    }

    isCheckingPhoneOtp = true;
    try {
        if (currentUser) {
        try {
            const { data: isAvail } = await _supabase.rpc('check_contact_available', {
                p_type: 'phone',
                p_val: pendingPhone,
                p_user_id: currentUser.id
            });
            if (isAvail === false) {
                if (window.profileOtpPollInterval) {
                    clearInterval(window.profileOtpPollInterval);
                    window.profileOtpPollInterval = null;
                }
                window.pendingOtpPhone = null;
                localStorage.removeItem('nisha_pending_otp_phone');
                localStorage.removeItem('nisha_pending_otp_phone_time');
                showToast('\u041D\u043E\u043C\u0435\u0440 \u0443\u0436\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435!', 'error');
                const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn');
                saveBtns.forEach(b => { b.disabled = false; b.innerText = '\u2713'; });
                return;
            }
        } catch(e) {}
    }

    try {
        const { data: isVerified } = await _supabase.rpc('check_otp_verified', { p_phone: pendingPhone });
        if (isVerified) {
            isPhoneOtpCompleted = true;
            if (window.profileOtpPollInterval) {
                clearInterval(window.profileOtpPollInterval);
                window.profileOtpPollInterval = null;
            }
            window.pendingOtpPhone = null;
            localStorage.removeItem('nisha_pending_otp_phone');
            localStorage.removeItem('nisha_pending_otp_phone_time');

            if (currentUser) {
                try {
                    let hasLinkedTg = false;
                    const { data: profData, error: profErr } = await _supabase
                        .from('profiles')
                        .select('phone, tg')
                        .eq('id', currentUser.id)
                        .single();

                    if (!profErr && profData) {
                        if (!userProfile) userProfile = {};
                        const confirmedPhone = profData.phone || pendingPhone;
                        userProfile.phone = confirmedPhone;
                        localStorage.setItem('nisha_last_phone', confirmedPhone);
                        renderProfilePhone(confirmedPhone);

                        if (profData.tg) {
                            userProfile.tg = profData.tg;
                            localStorage.setItem('nisha_last_tg', profData.tg);
                            renderProfileTg(profData.tg);
                            hasLinkedTg = true;

                            if (window.profileTgPollInterval) {
                                clearInterval(window.profileTgPollInterval);
                                window.profileTgPollInterval = null;
                            }
                            window.pendingOtpTg = null;
                            localStorage.removeItem('nisha_pending_otp_tg');
                            localStorage.removeItem('nisha_pending_otp_tg_time');
                        }

                        if (!profData.phone) {
                            await _supabase.from('profiles').update({ phone: pendingPhone }).eq('id', currentUser.id);
                        }
                    } else {
                        const { error: updErr } = await _supabase.from('profiles').update({ phone: pendingPhone }).eq('id', currentUser.id);
                        if (updErr && (updErr.code === '23505' || updErr.message?.includes('duplicate'))) {
                            const saveBtns = document.querySelectorAll('#profilePhoneInputWrap .win95-save-btn, #modalProfilePhoneInputWrap .win95-save-btn'); saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; }); showToast('\u042D\u0442\u043E\u0442 \u043D\u043E\u043C\u0435\u0440 \u0443\u0436\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435!', 'error');
                            return;
                        }
                        if (!userProfile) userProfile = {};
                        userProfile.phone = pendingPhone;
                        localStorage.setItem('nisha_last_phone', pendingPhone);
                        renderProfilePhone(pendingPhone);
                    }
                    window._hasLinkedTgOnPhoneVerify = hasLinkedTg;
                    // updErr already handled inside else



                    await _supabase.auth.updateUser({ data: { phone: pendingPhone } });
                } catch(e) {}
            }

            if (!currentUser) { if (!userProfile) userProfile = {};
            userProfile.phone = pendingPhone;
            localStorage.setItem('nisha_last_phone', pendingPhone);

            renderProfilePhone(pendingPhone); }
            const msg = window._hasLinkedTgOnPhoneVerify
                ? '\u041D\u043E\u043C\u0435\u0440 \u0438 Telegram \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B!'
                : (typeof i18next !== 'undefined' ? i18next.t('messages.phone_verified', { defaultValue: '\u041D\u043E\u043C\u0435\u0440 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D!' }) : '\u041D\u043E\u043C\u0435\u0440 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D!');
            delete window._hasLinkedTgOnPhoneVerify;
            showToast(msg, 'success');
            updateProposeAndCheckoutFields();
        }
    } catch(err) {
        console.error('Ошибка проверки OTP в фоне:', err);
    }
    } finally {
        isCheckingPhoneOtp = false;
    }
}
window.checkPendingPhoneVerification = checkPendingPhoneVerification;

async function checkPendingTgVerification() {
    if (isCheckingTgOtp || isTgOtpCompleted) return;
    const pendingTg = window.pendingOtpTg || localStorage.getItem('nisha_pending_otp_tg');
    if (!pendingTg) return;

    const tgStartTime = parseInt(localStorage.getItem('nisha_pending_otp_tg_time') || '0', 10);
    if (tgStartTime && (Date.now() - tgStartTime > 120000)) {
        if (window.profileTgPollInterval) {
            clearInterval(window.profileTgPollInterval);
            window.profileTgPollInterval = null;
        }
        window.pendingOtpTg = null;
        localStorage.removeItem('nisha_pending_otp_tg');
        localStorage.removeItem('nisha_pending_otp_tg_time');
        const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn');
        saveBtns.forEach(b => { b.disabled = false; b.innerText = '\u2713'; });
        showToast('\u0412\u0440\u0435\u043C\u044F \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F Telegram \u0438\u0441\u0442\u0435\u043A\u043B\u043E', 'error');
        return;
    }

    const cleanUser = pendingTg.replace(/^@+/, '').trim().toLowerCase();
    if (!cleanUser) return;

    isCheckingTgOtp = true;
    try {
        if (currentUser) {
        try {
            const { data: isAvail } = await _supabase.rpc('check_contact_available', {
                p_type: 'tg',
                p_val: cleanUser,
                p_user_id: currentUser.id
            });
            if (isAvail === false) {
                if (window.profileTgPollInterval) {
                    clearInterval(window.profileTgPollInterval);
                    window.profileTgPollInterval = null;
                }
                window.pendingOtpTg = null;
                localStorage.removeItem('nisha_pending_otp_tg');
                localStorage.removeItem('nisha_pending_otp_tg_time');
                showToast('\u042D\u0442\u043E\u0442 Telegram \u0443\u0436\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435!', 'error');
                const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn');
                saveBtns.forEach(b => { b.disabled = false; b.innerText = '\u2713'; });
                return;
            }
        } catch(e) {}
    }

    try {
        const { data: isVerified } = await _supabase.rpc('check_otp_verified', { p_phone: `tg_${cleanUser}` });
        if (isVerified) {
            isTgOtpCompleted = true;
            if (window.profileTgPollInterval) {
                clearInterval(window.profileTgPollInterval);
                window.profileTgPollInterval = null;
            }
            window.pendingOtpTg = null;
            localStorage.removeItem('nisha_pending_otp_tg');
            localStorage.removeItem('nisha_pending_otp_tg_time');

            const formattedTg = '@' + pendingTg.replace(/^@+/, '').trim();

            if (currentUser) {
                try {
                    const { error: updErr } = await _supabase.from('profiles').update({ tg: formattedTg }).eq('id', currentUser.id);
                    if (updErr && (updErr.code === '23505' || updErr.message?.includes('duplicate'))) {
                        const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn'); saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; }); showToast('\u042D\u0442\u043E\u0442 Telegram \u0443\u0436\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435!', 'error');
                        return;
                    }
                    await _supabase.auth.updateUser({ data: { tg: formattedTg } });
                } catch(e) {}
            }

            if (!userProfile) userProfile = {};
            userProfile.tg = formattedTg;
            localStorage.setItem('nisha_last_tg', formattedTg);

            renderProfileTg(formattedTg);
            const msg = typeof i18next !== 'undefined' ? i18next.t('messages.tg_verified', { defaultValue: 'Telegram подтвержден!' }) : 'Telegram подтвержден!';
            showToast(msg, 'success');
            updateProposeAndCheckoutFields();
        }
    } catch(err) {
        console.error('Ошибка проверки TG OTP в фоне:', err);
    }
    } finally {
        isCheckingTgOtp = false;
    }
}
window.checkPendingTgVerification = checkPendingTgVerification;

window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (window.pendingOtpPhone || localStorage.getItem('nisha_pending_otp_phone')) {
            checkPendingPhoneVerification();
        }
        if (window.pendingOtpTg || localStorage.getItem('nisha_pending_otp_tg')) {
            checkPendingTgVerification();
        }
    }
});
window.addEventListener('focus', () => {
    if (window.pendingOtpPhone || localStorage.getItem('nisha_pending_otp_phone')) {
        checkPendingPhoneVerification();
    }
    if (window.pendingOtpTg || localStorage.getItem('nisha_pending_otp_tg')) {
        checkPendingTgVerification();
    }
});

// getUserPhone, getUserTg, updateProposeAndCheckoutFields вынесены в js/auth/auth.js

let lastPhoneSendTimestamp = 0;
let lastTgSendTimestamp = 0;

window.savePhoneFromInput = async function(isModal = false) {
    if (!currentUser) {
        showToast('Сначала авторизуйтесь!', 'error');
        return;
    }

    const now = Date.now();
    const phoneCooldownRemaining = Math.ceil((10000 - (now - lastPhoneSendTimestamp)) / 1000);
    if (phoneCooldownRemaining > 0) {
        showToast(`\u041F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435 ${phoneCooldownRemaining} \u0441\u0435\u043A \u043F\u0435\u0440\u0435\u0434 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0439 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u043E\u0439!`, 'info');
        return;
    }

    const input = document.getElementById(isModal ? 'modalProfilePhoneInput' : 'profilePhoneInput');
    if (!input) return;

    const rawVal = input.value.trim();
    let clean = rawVal.replace(/[^\d+]/g, '');
    if (!clean.startsWith('+') && clean.startsWith('380')) clean = '+' + clean;
    if (!clean.startsWith('+') && clean.length === 10) clean = '+38' + clean;

    const digitsOnly = clean.replace(/[^\d]/g, '');
    if (digitsOnly.length < 10) {
        showToast('Введите корректный номер (минимум 10 цифр)!', 'error');
        input.focus();
        return;
    }

    // Проверяем Черный Список
    try {
        const { data: blacklisted } = await _supabase.from('blacklist').select('phone').eq('phone', clean).limit(1);
        if (blacklisted && blacklisted.length > 0) {
            showToast('[!] ОШИБКА БЕЗОПАСНОСТИ: ВАШ НОМЕР ЗАБЛОКИРОВАН', 'error');
            return;
        }
    } catch(e) {}

    // Проверяем, не привязан ли этот номер к другому аккаунту
    try {
        const { data: isAvail, error: rpcErr } = await _supabase.rpc('check_contact_available', {
            p_type: 'phone',
            p_val: clean,
            p_user_id: currentUser.id
        });
        if (!rpcErr && isAvail === false) {
            showToast('\u041D\u043E\u043C\u0435\u0440 \u0443\u0436\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435!', 'error');
            input.focus();
            return;
        }
    } catch(e) {}
    try {
        const { data: existingPhone } = await _supabase
            .from('profiles')
            .select('id')
            .eq('phone', clean)
            .neq('id', currentUser.id)
            .limit(1);

        if (existingPhone && existingPhone.length > 0) {
            showToast('Этот номер уже привязан к другому аккаунту!', 'error');
            input.focus();
            return;
        }
    } catch(e) {}

    // Если не подтвержден — генерируем OTP и отправляем в бота для подтверждения
    lastPhoneSendTimestamp = Date.now();
    isPhoneOtpCompleted = false;
    const saveBtn = document.querySelector(isModal ? '#modalProfilePhoneInputWrap .win95-save-btn' : '#profilePhoneInputWrap .win95-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getWin95HourglassHtml(14);
    }

    try {
        const { error: otpError } = await _supabase.rpc('generate_secure_otp', { p_phone: clean });
        if (otpError) {
            console.error('OTP generate error:', otpError);
            showToast('Ошибка сервера при генерации кода', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = '✓';
            }
            return;
        }
    } catch(e) {
        console.error('OTP RPC error:', e);
    }

    window.pendingOtpPhone = clean;
    localStorage.setItem('nisha_pending_otp_phone', clean);
    localStorage.setItem('nisha_pending_otp_phone_time', Date.now().toString());

    const payloadPhone = clean.replace('+', '');
    const userPrefix = (typeof currentUser !== 'undefined' && currentUser && currentUser.id) ? `${currentUser.id}_` : '';
    const tgLink = `https://t.me/nisha_store1_bot?start=otp_${userPrefix}${payloadPhone}`;

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    if (isMobile) {
        window.location.href = tgLink;
    } else {
        const win = window.open(tgLink, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = tgLink;
        }
    }

    showToast('Перейдите в бота и нажмите СТАРТ для подтверждения номера...', 'info');

    if (window.profileOtpPollInterval) clearInterval(window.profileOtpPollInterval);
    window.profileOtpPollInterval = setInterval(() => {
        checkPendingPhoneVerification();
    }, 2000);
};

// ==========================================
// TELEGRAM В ПРОФИЛЕ (WIN95 СТИЛЬ)
// ==========================================
function renderProfileTg(tg) {
    const hasTg = Boolean(tg && tg.trim().length > 0 && tg.trim() !== '@');
    
    const formattedTg = hasTg ? (tg.startsWith('@') ? tg : '@' + tg) : '';
    const delBtnHtml = (isModal) => `<button onclick="removeProfileTg(${isModal})" title="Удалить Telegram" class="win95-check-btn" style="background:#2a2a2a;border:2px outset #777;color:#ff5555;font-family:var(--font-mono);font-size:10px;padding:1px 5px;cursor:pointer;line-height:1;box-shadow:1px 1px 0 #000;margin-left:auto">✕</button>`;
    
    // 1. Сайдбар (ПК)
    const pTg = document.getElementById('profileTg');
    const pBtn = document.getElementById('profileAddTgBtn');
    const pWrap = document.getElementById('profileTgInputWrap');
    if (pTg && pBtn) {
        if (hasTg) {
            pTg.innerHTML = `<span style="word-break:break-all">${formattedTg}</span>${delBtnHtml(false)}`;
            pTg.style.display = 'flex';
            pTg.style.alignItems = 'center';
            pTg.style.justifyContent = 'space-between';
            pBtn.style.display = 'none';
        } else {
            pTg.innerHTML = '';
            pTg.style.display = 'none';
            pBtn.style.display = 'inline-block';
        }
        if (pWrap) pWrap.style.display = 'none';
    }

    // 2. Модалка (Мобилка)
    const mTg = document.getElementById('modalProfileTg');
    const mBtn = document.getElementById('modalProfileAddTgBtn');
    const mWrap = document.getElementById('modalProfileTgInputWrap');
    if (mTg && mBtn) {
        if (hasTg) {
            mTg.innerHTML = `<span style="word-break:break-all">${formattedTg}</span>${delBtnHtml(true)}`;
            mTg.style.display = 'flex';
            mTg.style.alignItems = 'center';
            mTg.style.justifyContent = 'space-between';
            mBtn.style.display = 'none';
        } else {
            mTg.innerHTML = '';
            mTg.style.display = 'none';
            mBtn.style.display = 'inline-block';
        }
        if (mWrap) mWrap.style.display = 'none';
    }

    const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn');
    saveBtns.forEach(b => {
        b.disabled = false;
        b.innerText = '✓';
    });
}
window.renderProfileTg = renderProfileTg;

window.removeProfileTg = async function(isModal = false) {
    if (!currentUser) return;
    try {
        await _supabase.from('profiles').update({ tg: null }).eq('id', currentUser.id);
        try { await _supabase.auth.updateUser({ data: { tg: null } }); } catch(e) {}
    } catch(err) {
        console.error('Ошибка удаления Telegram:', err);
    }

    if (userProfile) userProfile.tg = null;
    localStorage.removeItem('nisha_last_tg');
    localStorage.removeItem('nisha_pending_otp_tg');
    localStorage.removeItem('nisha_pending_otp_tg_time');

    renderProfileTg('');
    showToast('Telegram удален!', 'info');
    updateProposeAndCheckoutFields();
};

window.showTgInput = function(isModal = false) {
    const btn = document.getElementById(isModal ? 'modalProfileAddTgBtn' : 'profileAddTgBtn');
    const wrap = document.getElementById(isModal ? 'modalProfileTgInputWrap' : 'profileTgInputWrap');
    const input = document.getElementById(isModal ? 'modalProfileTgInput' : 'profileTgInput');
    const saveBtn = document.querySelector(isModal ? '#modalProfileTgInputWrap .win95-save-btn' : '#profileTgInputWrap .win95-save-btn');
    if (saveBtn && localStorage.getItem('nisha_pending_otp_tg')) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getWin95HourglassHtml(14);
    } else if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = '✓';
    }

    if (btn) btn.style.display = 'none';
    if (wrap) wrap.style.display = 'flex';
    if (input) {
        if (!input.value || !input.value.trim() || input.value === '@') {
            input.value = '@';
        } else if (!input.value.startsWith('@')) {
            input.value = '@' + input.value.trim().replace(/^@+/, '');
        }
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);

        input.oninput = () => {
            let val = input.value;
            val = val.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, '@');
            val = val.replace(/[^a-zA-Z0-9_@]/g, '');
            if (!val.startsWith('@')) {
                val = '@' + val.replace(/@/g, '');
            } else {
                val = '@' + val.slice(1).replace(/@/g, '');
            }
            input.value = val;
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') saveTgFromInput(isModal);
            if (e.key === 'Escape') hideTgInput(isModal);
        };
    }
};

window.hideTgInput = function(isModal = false) {
    if (window.profileTgPollInterval) {
        clearInterval(window.profileTgPollInterval);
        window.profileTgPollInterval = null;
    }
    window.pendingOtpTg = null;
    localStorage.removeItem('nisha_pending_otp_tg');
    localStorage.removeItem('nisha_pending_otp_tg_time');

    const btn = document.getElementById(isModal ? 'modalProfileAddTgBtn' : 'profileAddTgBtn');
    const wrap = document.getElementById(isModal ? 'modalProfileTgInputWrap' : 'profileTgInputWrap');
    const input = document.getElementById(isModal ? 'modalProfileTgInput' : 'profileTgInput');

    if (wrap) wrap.style.display = 'none';
    if (btn) btn.style.display = 'inline-block';
    if (input) {
        input.value = '';
    }
    const saveBtns = document.querySelectorAll('#profileTgInputWrap .win95-save-btn, #modalProfileTgInputWrap .win95-save-btn'); saveBtns.forEach(b => { b.disabled = false; b.innerText = '✓'; }); //




};

window.saveTgFromInput = async function(isModal = false) {
    if (!currentUser) {
        showToast('Сначала авторизуйтесь!', 'error');
        return;
    }

    const now = Date.now();
    const tgCooldownRemaining = Math.ceil((10000 - (now - lastTgSendTimestamp)) / 1000);
    if (tgCooldownRemaining > 0) {
        showToast(`\u041F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435 ${tgCooldownRemaining} \u0441\u0435\u043A \u043F\u0435\u0440\u0435\u0434 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0439 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u043E\u0439!`, 'info');
        return;
    }

    const input = document.getElementById(isModal ? 'modalProfileTgInput' : 'profileTgInput');
    if (!input) return;

    let rawVal = input.value.trim();
    rawVal = rawVal.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, '@');
    let cleanUser = rawVal.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');

    if (cleanUser.length < 2) {
        showToast('Введите корректный Telegram username!', 'error');
        input.focus();
        return;
    }

    const clean = '@' + cleanUser;
    const cleanLower = cleanUser.toLowerCase();

    // Проверяем, не привязан ли этот Telegram к другому аккаунту
    try {
        const { data: isAvail, error: rpcErr } = await _supabase.rpc('check_contact_available', {
            p_type: 'tg',
            p_val: cleanUser,
            p_user_id: currentUser.id
        });
        if (!rpcErr && isAvail === false) {
            showToast('\u042D\u0442\u043E\u0442 Telegram \u0443\u0436\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435!', 'error');
            input.focus();
            return;
        }
    } catch(e) {}
    try {
        const { data: existingTg } = await _supabase
            .from('profiles')
            .select('id')
            .ilike('tg', clean)
            .neq('id', currentUser.id)
            .limit(1);

        if (existingTg && existingTg.length > 0) {
            showToast('Этот Telegram уже привязан к другому аккаунту!', 'error');
            input.focus();
            return;
        }
    } catch(e) {}

    // Генерируем запись в otp_codes с префиксом tg_
    lastTgSendTimestamp = Date.now();
    isTgOtpCompleted = false;
    const saveBtn = document.querySelector(isModal ? '#modalProfileTgInputWrap .win95-save-btn' : '#profileTgInputWrap .win95-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = getWin95HourglassHtml(14);
    }

    try {
        const { error: otpError } = await _supabase.rpc('generate_secure_otp', { p_phone: `tg_${cleanLower}` });
        if (otpError) {
            console.error('OTP generate error for tg:', otpError);
            showToast('Ошибка сервера при генерации кода', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = '✓';
            }
            return;
        }
    } catch(e) {
        console.error('OTP RPC error for tg:', e);
    }

    window.pendingOtpTg = clean;
    localStorage.setItem('nisha_pending_otp_tg', clean);
    localStorage.setItem('nisha_pending_otp_tg_time', Date.now().toString());

    const tgLink = `https://t.me/nisha_store1_bot?start=tg_${currentUser.id}_${cleanLower}`;

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    if (isMobile) {
        window.location.href = tgLink;
    } else {
        const win = window.open(tgLink, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = tgLink;
        }
    }

    showToast('Перейдите в бота и нажмите СТАРТ для подтверждения Telegram...', 'info');

    if (window.profileTgPollInterval) clearInterval(window.profileTgPollInterval);
    window.profileTgPollInterval = setInterval(() => {
        checkPendingTgVerification();
    }, 2000);
};

let isRegMode = false;
function toggleRegMode(isModal = false) {
    isRegMode = !isRegMode;
    const p = isModal ? 'modal' : '';
    const a = isModal ? 'modalAuth' : 'auth';

    const btnLogin = document.getElementById(p ? 'modalBtnLogin' : 'btnLogin');
    const btnShowReg = document.getElementById(p ? 'modalBtnShowReg' : 'btnShowReg');
    const btnRegister = document.getElementById(p ? 'modalBtnRegister' : 'btnRegister');
    const btnBackLogin = document.getElementById(p ? 'modalBtnBackLogin' : 'btnBackLogin');
    const authUsername = document.getElementById(a + 'Username');

    if (isRegMode) {
        btnLogin.style.display = 'none';
        btnShowReg.style.display = 'none';
        btnRegister.style.display = 'block';
        btnBackLogin.style.display = 'block';
        authUsername.style.display = 'block';
    } else {
        btnLogin.style.display = 'block';
        btnShowReg.style.display = 'block';
        btnRegister.style.display = 'none';
        btnBackLogin.style.display = 'none';
        authUsername.style.display = 'none';
    }
}

async function handleAuth(action, isModal = false) {
    const p = isModal ? 'modalAuth' : 'auth';
    const email = document.getElementById(p + 'Email').value.trim();
    const password = document.getElementById(p + 'Pass').value.trim();
    const username = document.getElementById(p + 'Username').value.trim();

    if (!email || !password) { showToast('Введите Email и пароль!', 'error'); return; }

    let result;
    if (action === 'register') {
        if (!username) { showToast('Для регистрации нужен никнейм!', 'error'); return; }
        result = await _supabase.auth.signUp({ email, password, options: { data: { username: username } } });
        if (!result.error) showToast('Регистрация успешна! Проверьте почту.', 'success');
    } else {
        result = await _supabase.auth.signInWithPassword({ email, password });
        if (!result.error) showToast(i18next.t('messages.login_success'), 'success');
    }

    if (result.error) { showToast(result.error.message, 'error'); } 
    else { await checkSession(); if(isModal) closeModal('profileModal'); }
}


async function logout() {
    await _supabase.auth.signOut();
    showToast(i18next.t('messages.logout'), 'success');
    
    
    showingOnlyFavs = false; 
    if(document.getElementById('favNav')) document.getElementById('favNav').style.color = 'var(--accent-yellow)';
    
    await checkSession();
    applyFilters(); 
}


// Catalog data loaders, CDN image helpers, filters, renderNextBatch and tours moved to js/catalog/catalog.js

// addToCartById and addToCartWithAnimation moved to js/cart/cart.js

// clearSearchInput moved to js/catalog/catalog.js


// Добавляем слушатель, чтобы крестик появлялся при вводе
const mainSearchInput = document.getElementById('mainSearch');
if (mainSearchInput) {
    mainSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveRecentSearch(this.value.trim());
            applyFilters();
            closeSearch();
        }
    });
    mainSearchInput.addEventListener('input', function() {
        document.getElementById('clearSearchBtn').style.display = this.value.length > 0 ? 'block' : 'none';
    });
    
    // Останавливаем анимацию при фокусе
    mainSearchInput.addEventListener('focus', () => {
        mainSearchInput.placeholder = i18next.t('search.placeholder') || 'Поиск...';
    });
    // Возвращаем при потере фокуса
    mainSearchInput.addEventListener('blur', () => {
        if (mainSearchInput.value.length === 0) startSearchTypewriter();
    });
}

// ==========================================
// 7. ИЗБРАННОЕ (ЛАЙКИ)
// ==========================================
async function loadFavorites() {
    if (!currentUser) return;
    const { data, error } = await _supabase.from('favorites').select('item_id').eq('user_id', currentUser.id);
    if (data && !error) {
        favorites = data.map(f => f.item_id);
        if(document.getElementById('profileLikesCount')) {
            document.getElementById('profileLikesCount').innerText = favorites.length;
        }
        if(document.getElementById('modalProfileLikesCount')) {
            document.getElementById('modalProfileLikesCount').innerText = favorites.length;
        }
    }
    updateFavBadge();
}

let isToggling = false; // Защита от двойного клика на телефоне

async function toggleFav(event, itemId) {
    window.triggerVibration(150);
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!currentUser) { 
        showToast(i18next.t('messages.cart_error_auth'), 'error'); 
        return; 
    }

    if (isToggling) return;
    isToggling = true;
    setTimeout(() => { isToggling = false; }, 300);

    // ВЫЗЫВАЕМ ВИБРАЦИЮ
    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    const isFav = favorites.includes(itemId);

    if (isFav) {
        favorites = favorites.filter(id => id !== itemId);
    } else {
        favorites.push(itemId);
    }

    // 2. ЖЕСТКО ищем нужную звезду в сетке по ID и меняем класс + СРАЗУ КРАСИМ
    const gridStar = document.querySelector(`.item-card[data-id="${itemId}"] .fav-star`);
    if (gridStar) {
        if (isFav) {
            gridStar.classList.remove('active');
            gridStar.style.color = '#444'; // Принудительно серый
        } else {
            gridStar.classList.add('active');
            gridStar.style.color = 'var(--accent-red)'; // Принудительно красный
        }
    }

    // ЖЕСТКО ищем звезду в модалке (если открыт этот товар)
    if (currentOpenedItem && currentOpenedItem.id === itemId) {
        const modalStar = document.getElementById('modalFavStar');
        if (modalStar) {
            if (isFav) {
                modalStar.classList.remove('active');
                modalStar.style.color = '#444';
            } else {
                modalStar.classList.add('active');
                modalStar.style.color = 'var(--accent-red)';
            }
        }
    }

    // Обновляем счетчики мгновенно
    const profileLikes = document.getElementById('profileLikesCount');
    if (profileLikes) profileLikes.innerText = favorites.length;
    const modalProfileLikes = document.getElementById('modalProfileLikesCount');
    if (modalProfileLikes) modalProfileLikes.innerText = favorites.length;
    updateFavBadge();

    // 3. Тихо отправляем в базу и выводим красивое уведомление с фото
    const itemObj = allItems.find(i => i.id === itemId);
    const imgUrl = itemObj ? getOptimizedImageUrl(itemObj, true) : null;

    try {
        if (isFav) {
            await _supabase.from('favorites').delete().match({ user_id: currentUser.id, item_id: itemId });
            showToast(i18next.t('messages.fav_remove'), 'success', imgUrl);
        } else {
            await _supabase.from('favorites').insert([{ user_id: currentUser.id, item_id: itemId }]);
            showToast(i18next.t('messages.fav_add'), 'success', imgUrl);
        }
    } catch (err) {
        console.error("Ошибка лайка:", err);
    }
}

function updateFavBadge() { 
    const badge = document.getElementById('favCountBadge');
    if (badge) badge.innerText = `[${favorites.length}]`; 
}

function filterFavorites() { 
    if(!currentUser) { 
        showToast(i18next.t('messages.cart_error_auth'), 'error'); 
        return; 
    }
    showingOnlyFavs = !showingOnlyFavs; 
    sessionStorage.setItem('nisha_showing_favs', showingOnlyFavs); // Запоминаем
    document.getElementById('favNav').style.color = showingOnlyFavs ? '#fff' : 'var(--accent-yellow)'; 
    applyFilters(); 
}

// Cart synchronization, Nova Poshta, checkout and order submission moved to js/cart/cart.js

// ==========================================
// 11. МОИ ЗАКАЗЫ (ИСТОРИЯ И JSBARCODE)
// ==========================================
   function openOrdersModal() {

    document.getElementById('ordersModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (typeof lenis !== 'undefined') window.stopLenis(); 
    
    const guestInputGroup = document.getElementById('guestOrderInputGroup');
    const guestText = document.getElementById('guestOrderText');
    const listArea = document.getElementById('ordersListArea');

    if (currentUser) {
        if(guestInputGroup) guestInputGroup.style.display = 'none';
        
        // Умное получение никнейма (спасает от заглушки "User")
        let dName = userProfile?.username;
        if (!dName || dName === 'User') {
            dName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
        }
        
        if(guestText) guestText.innerHTML = `${i18next.t('orders_modal.access_granted', {defaultValue: 'Доступ разрешен'})}: <span style="color:var(--accent-green); font-weight:bold;">@${dName}</span>`;
        fetchMyOrders();
    } else {
        if(guestInputGroup) guestInputGroup.style.display = 'flex';
        if(guestText) guestText.innerHTML = 'Введите номер телефона, указанный при заказе, чтобы отследить статус:';
        if(listArea) listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace; padding: 30px;">Введите номер телефона для поиска...</div>';

        const lastPhone = localStorage.getItem('nisha_last_phone');
        const phoneInput = document.getElementById('ordersSearchPhone');
        if (lastPhone && phoneInput && !phoneInput.value) {
            phoneInput.value = lastPhone;
        }
        if (phoneInput && phoneInput.value) {
            fetchMyOrders();
        }
    }
}

// Глобальные переменные для фильтрации заказов
let globalOrdersData = [];
let currentOrderTab = 'accepted'; // accepted, shipped, cancelled

async function fetchMyOrders() {
    const listArea = document.getElementById('ordersListArea');
    const tabsContainer = document.getElementById('ordersTabs');
    if(!listArea) return;
    
    listArea.innerHTML = '<div style="text-align:center; color:#aaa; font-family: monospace;">[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]</div>';
    tabsContainer.style.display = 'none'; // Прячем табы на время загрузки

    let fetchError = null;

    if (currentUser) {
        const { data, error } = await _supabase.from('orders').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        globalOrdersData = data || []; 
        fetchError = error;
    } else {
        const phoneInput = document.getElementById('ordersSearchPhone');
        const phone = phoneInput ? phoneInput.value.replace(/[^\d+]/g, '') : '';
        if (!phone || phone.length < 10) { 
            showToast('Введите корректный номер телефона!', 'error'); 
            listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace;">[ НОМЕР НЕ ВВЕДЕН ]</div>';
            return; 
        }

        const { data: vResult } = await _supabase.rpc('check_otp_verified', { p_phone: phone });
        const otpCheck = vResult ? [{is_verified: true}] : [];
        if (!otpCheck || otpCheck.length === 0 || !otpCheck[0].is_verified) {
            listArea.innerHTML = `<div style="text-align:center; color:var(--accent-red); font-family: monospace; padding: 20px;">[ ДОСТУП ЗАПРЕЩЕН ]<br><br>Сначала подтвердите, что это ваш номер.</div>
            <button class="cart-checkout-btn btn-target" style="margin: 0 auto; display: block;" onclick="document.getElementById('orderPhone').value='${phone}'; generateAndSendOTP();">ПОДТВЕРДИТЬ НОМЕР В БОТЕ</button>`;
            return;
        }

        const { data, error } = await _supabase.rpc('get_orders_by_phone', { search_phone: phone });
        globalOrdersData = data || []; 
        fetchError = error;
    }

    if (fetchError) { 
        listArea.innerHTML = `<div style="color:red; text-align:center;">[ ОШИБКА: ${fetchError.message} ]</div>`; 
        return; 
    }

    if (globalOrdersData.length === 0) { 
        listArea.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a;">
                <div style="font-size: 30px; margin-bottom: 15px;">📦</div>
                <div style="color:var(--accent-red); font-family: var(--font-mono); font-weight:bold; margin-bottom: 10px;">${i18next.t('orders_modal.empty_title')}</div>
                <div style="color:#888; font-size: 13px; line-height: 1.5;">${i18next.t('orders_modal.empty_desc')}</div>
            </div>`; 
        return; 
    }

    // Если данные есть, показываем табы и рендерим
    tabsContainer.style.display = 'flex';
    
    // Сбрасываем таб на "Принятые" при новом поиске
    currentOrderTab = 'accepted';
    document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.order-tab.tab-yellow').classList.add('active');
    
    ensureOrderImagesLoaded();
    renderFilteredOrders();
}

window.orderItemsImageCache = window.orderItemsImageCache || {};

function getOrderItemImage(item) {
    if (!item) return '';

    // 1. Прямые строковые свойства объекта item
    if (item.image && typeof item.image === 'string' && item.image.trim().length > 5) {
        return window.toCDN ? window.toCDN(item.image) : item.image;
    }
    for (const key of ['img', 'thumbnail', 'photo', 'picture']) {
        if (item[key] && typeof item[key] === 'string' && item[key].trim().length > 5) {
            return window.toCDN ? window.toCDN(item[key]) : item[key];
        }
    }

    // 2. Прямые массивы картинок объекта item
    if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0 && typeof item.thumbnails[0] === 'string' && item.thumbnails[0].trim().length > 5) {
        return window.toCDN ? window.toCDN(item.thumbnails[0]) : item.thumbnails[0];
    }
    if (Array.isArray(item.images) && item.images.length > 0 && typeof item.images[0] === 'string' && item.images[0].trim().length > 5) {
        return window.toCDN ? window.toCDN(item.images[0]) : item.images[0];
    }

    // 3. Кэш уже подгруженных картинок заказов
    if (item.id && window.orderItemsImageCache[item.id]) {
        return window.orderItemsImageCache[item.id];
    }

    // 4. Поиск в глобальном каталоге allItems (по ID или названию)
    if (typeof allItems !== 'undefined' && Array.isArray(allItems)) {
        const catalogItem = allItems.find(p => (item.id && p && p.id === item.id) || (item.name && p && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()));
        if (catalogItem) {
            let foundUrl = '';
            if (typeof getOptimizedImageUrl === 'function') {
                foundUrl = getOptimizedImageUrl(catalogItem, true);
            }
            if (!foundUrl && Array.isArray(catalogItem.thumbnails) && catalogItem.thumbnails.length > 0) {
                foundUrl = catalogItem.thumbnails[0];
            }
            if (!foundUrl && Array.isArray(catalogItem.images) && catalogItem.images.length > 0) {
                foundUrl = catalogItem.images[0];
            }
            if (foundUrl) {
                const cdnUrl = window.toCDN ? window.toCDN(foundUrl) : foundUrl;
                if (item.id) window.orderItemsImageCache[item.id] = cdnUrl;
                return cdnUrl;
            }
        }
    }

    return '';
}

async function ensureOrderImagesLoaded() {
    if (!globalOrdersData || !Array.isArray(globalOrdersData)) return;
    const missingIds = [];
    globalOrdersData.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                if (item && item.id && !getOrderItemImage(item)) {
                    if (!missingIds.includes(item.id)) missingIds.push(item.id);
                }
            });
        }
    });

    if (missingIds.length === 0) return;

    try {
        if (typeof _supabase !== 'undefined') {
            const { data } = await _supabase.from('items').select('id, thumbnails, images').in('id', missingIds);
            if (data && data.length > 0) {
                data.forEach(di => {
                    const imgUrl = (di.thumbnails && di.thumbnails.length > 0) ? di.thumbnails[0] : (di.images && di.images.length > 0 ? di.images[0] : '');
                    if (imgUrl) {
                        window.orderItemsImageCache[di.id] = window.toCDN ? window.toCDN(imgUrl) : imgUrl;
                    }
                });
            }

            const stillMissing = missingIds.filter(id => !window.orderItemsImageCache[id]);
            if (stillMissing.length > 0) {
                const { data: archData } = await _supabase.from('archived_items').select('id, thumbnails, images').in('id', stillMissing);
                if (archData && archData.length > 0) {
                    archData.forEach(di => {
                        const imgUrl = (di.thumbnails && di.thumbnails.length > 0) ? di.thumbnails[0] : (di.images && di.images.length > 0 ? di.images[0] : '');
                        if (imgUrl) {
                            window.orderItemsImageCache[di.id] = window.toCDN ? window.toCDN(imgUrl) : imgUrl;
                        }
                    });
                }
            }

            // Динамически подставляем картинку во все отрендеренные элементы, где было NO IMG
            document.querySelectorAll('.order-item-img[data-item-id]').forEach(el => {
                const itId = el.getAttribute('data-item-id');
                const resolved = getOrderItemImage({ id: itId });
                if (resolved) {
                    el.style.backgroundImage = `url('${resolved}')`;
                    el.innerText = '';
                }
            });
        }
    } catch (e) {
        console.warn('Could not batch fetch missing order images:', e);
    }
}

window.switchOrderTab = function(tabName) {
    if (currentOrderTab === tabName) return; // Не рендерим, если нажали на тот же таб
    currentOrderTab = tabName;
    
    // Обновляем классы активности
    document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
    if (tabName === 'accepted') document.querySelector('.order-tab.tab-yellow').classList.add('active');
    if (tabName === 'shipped') document.querySelector('.order-tab.tab-blue').classList.add('active');
    if (tabName === 'cancelled') document.querySelector('.order-tab.tab-red').classList.add('active');
    
    renderFilteredOrders();
};

function renderFilteredOrders() {
    const listArea = document.getElementById('ordersListArea');
    listArea.innerHTML = ''; // Очищаем (Auto-animate сделает плавное исчезновение/появление)

    // Фильтруем локально
    const filteredData = globalOrdersData.filter(order => {
        const s = order.status.toLowerCase();
        if (currentOrderTab === 'accepted') return s.includes('принят') || s.includes('оплачен');
        if (currentOrderTab === 'shipped') return s.includes('отправлен') || s.includes('завершен');
        if (currentOrderTab === 'cancelled') return s.includes('отменен') || s.includes('возврат');
        return false;
    });

    if (filteredData.length === 0) {
        let emptyMsg = currentOrderTab === 'accepted' ? 'Нет активных заказов.' : 
                       currentOrderTab === 'shipped' ? 'Нет отправленных посылок.' : 'Нет отмененных заказов.';
        listArea.innerHTML = `<div style="text-align:center; color:#666; font-family: monospace; padding: 30px;">[ ${emptyMsg} ]</div>`;
        return;
    }

    // Рендерим отфильтрованные карточки
    filteredData.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
        let itemsHtml = '';
        if (order.items && Array.isArray(order.items)) {
           order.items.forEach(item => {
                const itemImg = getOrderItemImage(item);
                const imgStyle = itemImg ? `background-image: url('${itemImg}');` : '';
                itemsHtml += `
                    <div class="order-item-row" onclick="openProductModalById('${item.id}')" title="Открыть карточку товара">
                        <div class="order-item-img" data-item-id="${item.id}" style="${imgStyle}">${itemImg ? '' : 'NO IMG'}</div>
                        <div class="order-item-details">
                            <div class="order-item-name">${item.name}</div>
                            <div class="order-item-meta"><span>Размер: ${item.size}</span><span class="order-item-price">${item.currentPrice} грн</span></div>
                        </div>
                    </div>`;
            });
        }

        let ttnHtml = "";
        if (order.status.toUpperCase() !== "ОТМЕНЕН") {
            ttnHtml = order.tracking_number
                ? `<div class="order-ttn">ТТН: <span style="color:var(--accent-green); font-weight:bold;">${order.tracking_number}</span>
                     <div style="background:#fff; text-align:center; padding: 10px; margin-top: 10px; border-radius:4px;">
                         <svg class="barcode-svg" data-ttn="${order.tracking_number}"></svg>
                     </div>
                   </div>`
                : `<div class="order-ttn" style="color:#777;">ТТН: Ожидается генерация...</div>`;
        }

        // --- ЛОГИКА КНОПКИ ОТЗЫВА ---
        let reviewBtnHtml = '';
        if (order.status.toLowerCase() === 'завершен') {
            let reviewedOrders = JSON.parse(localStorage.getItem('nisha_reviewed_orders') || '[]');
            
            if (!reviewedOrders.includes(order.id) && order.items && order.items.length > 0) {
                const firstItem = order.items[0];
                const firstItemImg = getOrderItemImage(firstItem);
                const safeName = firstItem.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const msgIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; position: relative; top: 2px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
                
                reviewBtnHtml = `
                    <div style="margin-top: 10px; cursor: pointer; color: var(--accent-green); font-size: 12px; font-family: var(--font-main); text-align: center; transition: 0.2s;" 
                         onclick="closeModal('ordersModal'); promptOrderReview('${order.id}', '${safeName}', '${firstItemImg}', '${firstItem.id}')" 
                         onmouseover="this.style.textDecoration='underline'; this.style.color='#fff';" 
                         onmouseout="this.style.textDecoration='none'; this.style.color='var(--accent-green)';">
                        ${msgIcon} Оставить отзыв
                    </div>
                `;
            } else if (reviewedOrders.includes(order.id)) {
                // Если отзыв уже оставлен — показываем серый текст (некликабельный)
                reviewBtnHtml = `
                    <div style="margin-top: 10px; color: #555; font-size: 12px; font-family: var(--font-mono); text-align: center; pointer-events: none;">
                        [✔] ОТЗЫВ ОСТАВЛЕН
                    </div>
                `;
            }
        }

        // --- ВСТАВЛЯЕМ КНОПКУ ОТЗЫВА В КАРТОЧКУ ---
        listArea.innerHTML += `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-id">ЗАКАЗ #${order.id.split('-')[0].toUpperCase()} <span style="color:#666; font-weight:normal;">(${date})</span></span>
                    <span class="order-status status-${order.status}">${order.status.toUpperCase()}</span>
                </div>
                <div class="order-items-list">${itemsHtml}</div>
                ${reviewBtnHtml}
                <div class="order-footer">${ttnHtml}<div class="order-total">ИТОГО: ${order.total_sum} грн</div></div>
            </div>`;
    });

    // Догружаем недостающие изображения в фоне
    ensureOrderImagesLoaded();

    // Перерисовываем штрихкоды
    if (typeof JsBarcode !== 'undefined') {
        document.querySelectorAll('.barcode-svg').forEach(svg => {
            const ttn = svg.getAttribute('data-ttn');
            if (ttn) {
                JsBarcode(svg, ttn, { format: "CODE128", lineColor: "#000", background: "transparent", width: 1.5, height: 50, displayValue: false });
            }
        });
    }
}
// ==========================================
// 12. МОДАЛКА ТОВАРА & ПОХОЖИЕ ТОВАРЫ & PHOTOSWIPE
// ==========================================
async function openProductModalById(itemId) {
    let item = allItems.find(i => i.id === itemId);
    
    // МГНОВЕННО открываем модалку, если товар есть в кэше
    if (item) {
        const cardInGrid = document.querySelector(`.item-card[data-id="${itemId}"]`);
        if (cardInGrid) cardInGrid.classList.remove('unseen-pulse');

        let seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
        if (!seenItemsIds.includes(itemId)) {
            seenItemsIds.push(itemId);
            if (seenItemsIds.length > 500) seenItemsIds.shift(); 
            localStorage.setItem('nisha_seen_items', JSON.stringify(seenItemsIds));
        }

        closeModal('ordersModal'); 
        closeModal('reviewsModal'); 
        openProductModal(item); 
    }
    
    // В ФОНЕ подгружаем полное описание и замеры
    if (typeof _supabase !== 'undefined') {
        try {
            let { data } = await _supabase.from('items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop').eq('id', itemId).limit(1);
            let fullItem = null;
            if (data && data.length > 0) {
                fullItem = data[0];
            } else {
                let { data: archData } = await _supabase.from('archived_items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop').eq('id', itemId).limit(1);
                if (archData && archData.length > 0) fullItem = archData[0];
            }
            
            // Если товара не было в кэше вообще (переход по прямой ссылке), открываем сейчас
            if (!item && fullItem) {
                openProductModal(fullItem);
                return;
            }
            
            // Если модалка открыта и мы догрузили описание - просто вставляем текст
            if (fullItem && currentOpenedItem && currentOpenedItem.id === fullItem.id) {
                currentOpenedItem = fullItem;
                window.currentOpenedItem = fullItem;
                if (fullItem.description) {
                    const descText = fullItem.description ? fullItem.description.replace(/\n/g, '<br>') : `<span style="color:#666;">[ Описание отсутствует ]</span>`;
                    const descContainer = document.querySelector('.modal-desc');
                    if (descContainer) {
                        // Обновляем текст описания, не трогая Q&A
                        descContainer.innerHTML = `
                            <div style="margin-bottom: 5px;">
                                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${i18next.t('product.size')}</span></strong> 
                                <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${fullItem.size}</span>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${i18next.t('product.brand')}</span></strong> 
                                <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${fullItem.brand}</span>
                            </div>
                            <div style="color: #aaa; font-size: 13px;">${descText}</div>
                        ` + (descContainer.innerHTML.substring(descContainer.innerHTML.indexOf('<!-- Блок Вопросов и Ответов (Q&A) -->') !== -1 ? descContainer.innerHTML.indexOf('<!-- Блок Вопросов и Ответов (Q&A) -->') : descContainer.innerHTML.indexOf('<div id="qaWrapper"')));
                    }
                }
            }
        } catch(e) { console.error("Ошибка сети:", e); }
    } else if (!item) {
        showToast('Товар не найден', 'error'); 
    }
}

function openProductModal(item) {
    currentOpenedItem = item;
    window.currentOpenedItem = item;
    if (typeof lenis !== 'undefined') window.stopLenis();
    document.title = `NISHA | ${item.brand} - ${item.name}`;
    

    document.getElementById('modalItemTitle').innerText = item.name;
    
    if (window.ttq) {
        ttq.track('ViewContent', {
            content_id: item.id,
            content_name: item.name,
            value: item.price,
            currency: 'UAH'
        });
    }
    // Красим звездочку в модалке, если товар уже в избранном
    const modalStar = document.getElementById('modalFavStar');
    if (modalStar) {
        if (favorites.includes(item.id)) {
            modalStar.classList.add('active');
        } else {
            modalStar.classList.remove('active');
        }
    }
    let finalPrice = isHacked ? Math.floor(item.price * 0.9) : item.price;
    document.getElementById('modalItemPrice').innerText = finalPrice + ' ' + getCurrency();
    document.getElementById('modalItemSizeDesc').innerText = item.size;
    document.getElementById('modalItemBrand').innerText = item.brand;
    
    const condStr = item.condition || '9 / 10';
    const condMatch = condStr.match(/(\d+)/);
    
    // Получаем саму оценку (по умолчанию 9)
    let condNum = 9;
    if (condMatch && condMatch[1]) condNum = parseInt(condMatch[1]);
    
    // Устанавливаем ширину полоски в процентах
    const condFill = document.getElementById('modalCondFill');
    condFill.style.width = (condNum * 10) + '%';
    
    // Получаем элемент текста "9 / 10"
    const condText = document.getElementById('modalItemCond');
    condText.innerText = condStr;

    // Умная раскраска в зависимости от оценки
    if (condNum <= 3) {
        condFill.style.backgroundColor = 'var(--accent-red)';
        condText.style.color = 'var(--accent-red)';
    } else if (condNum <= 6) {
        condFill.style.backgroundColor = '#ff9900'; // Оранжевый
        condText.style.color = '#ff9900';
    } else if (condNum <= 8) {
        condFill.style.backgroundColor = 'var(--accent-yellow)';
        condText.style.color = 'var(--accent-yellow)';
    } else {
        condFill.style.backgroundColor = 'var(--accent-green)';
        condText.style.color = 'var(--accent-green)';
    }

    // --- РЕНДЕР ХЭШТЕГОВ ---
    const tagsContainer = document.getElementById('modalItemTags');
    if (tagsContainer) {
        if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
            
            tagsContainer.innerHTML = item.tags.slice(0, 3).map(t => `<span style="color: #fff; margin-right: 12px; letter-spacing: 0.5px;">#${t}</span>`).join('');
            tagsContainer.style.display = 'block';
        } else {
            tagsContainer.style.display = 'none';
            tagsContainer.innerHTML = '';
        }
    }

    const descText = item.description ? item.description : "Оригинал. Любые проверки. Отличное состояние. Дополнительные замеры по запросу в ЛС.";
   
    document.querySelector('.modal-desc').innerHTML = `
        <div style="margin-bottom: 5px;">
            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${i18next.t('product.size')}</span></strong> 
            <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${item.size}</span>
        </div>
        <div style="margin-bottom: 15px;">
            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${i18next.t('product.brand')}</span></strong> 
            <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${item.brand}</span>
        </div>
        <div style="color: #aaa; font-size: 13px;">${descText}</div>
        
        <!-- БЛОК ВОПРОСОВ И ОТВЕТОВ (АККОРДЕОН) -->
        <div id="qaWrapper" class="qa-wrapper">
            <h4 class="qa-title" onclick="document.getElementById('qaList').classList.toggle('collapsed'); this.querySelector('.qa-arrow').style.transform = document.getElementById('qaList').classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';">
                <span data-i18n="product.qa_title">${i18next.t('product.qa_title', {defaultValue: 'Q&A: Вопросы покупателей'})}</span>
                <span class="qa-arrow" style="transition: transform 0.2s; color: var(--accent-green); display: inline-block;">▼</span>
            </h4>
            <div id="qaList" class="qa-content"></div>
        </div>

        <!-- КНОПКА ЗАДАТЬ ВОПРОС -->
        <div style="margin-top: 15px; text-align: right;">
            <button onclick="toggleQuestionForm()" style="background: transparent; border: none; color: var(--accent-green); font-family: var(--font-mono); font-weight: bold; cursor: pointer; padding: 0; font-size: 13px; text-decoration: underline;" data-i18n="product.ask_btn">${i18next.t('product.ask_btn', {defaultValue: 'Задать вопрос?'})}</button>
        </div>
        <div id="questionFormContainer" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; margin-top: 5px;">
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <input type="text" id="questionInput" class="form-input" placeholder="Ваш вопрос..." data-i18n-ph="product.ask_ph" style="font-size: 12px; padding: 8px;">
                <!-- Передаем только ID, а имя найдем внутри JS -->
                <button class="search-btn btn-target" onclick="submitQuestion('${item.id}')" style="padding: 8px 15px; font-size: 12px;" data-i18n="product.ask_send">${i18next.t('product.ask_send', {defaultValue: 'ОТПРАВИТЬ'})}</button>
            </div>
        </div>
    `;
   // --- ЗАЩИЩЕННЫЕ ПРОСМОТРЫ ТОВАРА (ЖЕЛЕЗОБЕТОННЫЙ ANTI-SPAM) ---
    const viewCount = document.getElementById('modalItemViews');
    if (viewCount) {
        viewCount.innerText = item.views_count || 0; // Сразу показываем то, что есть в кэше
        
        if (_supabase) {
            // Достаем массив тех товаров, которым мы УЖЕ прибавили просмотр
            let viewedItems = JSON.parse(localStorage.getItem('nisha_added_views') || '[]');
            
            // Если мы ЕЩЕ НЕ смотрели этот товар -> прибавляем +1 на сервере
            if (!viewedItems.includes(item.id)) {
                // Генерируем уникальный ID клиента, если его нет
                if (!clientFingerprint || clientFingerprint.startsWith('guest_')) {
                    clientFingerprint = localStorage.getItem('nisha_visitor_id') || 'user_' + Math.random().toString(36).substr(2, 9);
                }
                const viewerId = currentUser ? currentUser.id : clientFingerprint;
                
                _supabase.rpc('increment_item_views', { 
                    p_item_uuid: item.id, 
                    p_viewer_id: viewerId 
                }).then(({ data, error }) => {
                    if (!error && data !== null) {
                        viewCount.innerText = data; // Показываем новую цифру
                        item.views_count = data; // Сохраняем в память массива
                        
                        // Запоминаем, что мы уже накрутили +1 этому товару
                        viewedItems.push(item.id);
                        localStorage.setItem('nisha_added_views', JSON.stringify(viewedItems));
                    }
                });
            } else {
                // Если мы УЖЕ смотрели его раньше, просто запрашиваем актуальную цифру (без накрутки)
                _supabase.from('items').select('views_count').eq('id', item.id).limit(1).then(({ data, error }) => {
                    if (!error && data && data.length > 0) {
                        viewCount.innerText = data[0].views_count || 0;
                        item.views_count = data[0].views_count || 0;
                    }
                });
            }
        }
    }

    const cartBtn = document.getElementById('modalCartBtn');
    
    if (item.status === 'sold') {
        if(cartBtn) cartBtn.style.display = 'none';
    } else {
        if(cartBtn) cartBtn.style.display = 'block';
    }

    const wrapper = document.getElementById('sliderWrapper');
    const thumbs = document.getElementById('modalThumbnails');
    wrapper.innerHTML = ''; 
    thumbs.innerHTML = '';
    
    
   // Поддержка ФОТО и ВИДЕО (.mp4)
   // Скрываем стрелочки, если слайд только один
    const totalMedia = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails.length : (item.images ? item.images.length : 0);
    const prevBtn = document.querySelector('.slider-btn.prev');
    const nextBtn = document.querySelector('.slider-btn.next');
    
    if (totalMedia <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    } else {
        if (prevBtn) prevBtn.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'block';
    }

   // Поддержка ФОТО и ВИДЕО (.mp4)
    if (item.images && item.images.length > 0) {
        item.images.forEach((url, index) => {
            const cdnUrl = window.toCDN(url);
            const isVideo = cdnUrl.endsWith('.mp4');
            let currentThumb = (item.thumbnails && item.thumbnails[index]) ? window.toCDN(item.thumbnails[index]) : cdnUrl;
            
            if (isVideo && (!item.thumbnails || !item.thumbnails[index])) {
                currentThumb = 'https://via.placeholder.com/400x400.png?text=VIDEO&bg=000000&color=00ff00';
            }
            
            if (isVideo) {
                wrapper.innerHTML += `
                    <div class="slide img-8bit-loading" style="background:#000; display:flex; justify-content:center; align-items:center;">
                        <video 
                            class="modal-video-player"
                            autoplay="autoplay" 
                            muted="muted" 
                            loop="loop" 
                            playsinline="playsinline" 
                            webkit-playsinline="webkit-playsinline" 
                            preload="metadata"
                            controls 
                            style="width:100%; height:100%; max-height:400px; object-fit:contain; opacity:0;"
                            oncanplay="this.style.opacity='1'; this.parentElement.classList.remove('img-8bit-loading');"
                        >
                            <source src="${url}#t=0.001" type="video/mp4">
                        </video>
                    </div>`;
            } else {
                // ДОБАВЛЯЕМ SKELETON: Пока фото грузится - слайдер красиво переливается
                wrapper.innerHTML += `
                    <a href="${url}" data-pswp-width="1000" data-pswp-height="1000" target="_blank" class="slide skeleton" style="background-image:none; display:flex; align-items:center; justify-content:center; border: 1px solid #222;">
                        <img src="${url}" loading="lazy" style="width:100%; height:100%; object-fit:contain; opacity:0; transition:opacity 0.4s ease-in-out;" 
                        onload="this.style.opacity='1'; this.parentElement.setAttribute('data-pswp-width', this.naturalWidth); this.parentElement.setAttribute('data-pswp-height', this.naturalHeight); this.parentElement.classList.remove('skeleton'); this.parentElement.style.border='none';">
                    </a>`;
            }
            
            thumbs.innerHTML += `<div class="thumb" style="background-image:url('${currentThumb}'); position:relative;" onclick="setSlide(${index})">${isVideo ? '<span style="position:absolute; font-size:24px; color:#fff; text-shadow:0 0 5px #000; left:50%; top:50%; transform:translate(-50%, -50%);">▶</span>' : ''}</div>`;
        });
    } else {
        wrapper.innerHTML = `<a class="slide" style="background:#111; pointer-events:none;">НЕТ ФОТО</a>`;
    }

    setSlide(0);

    // Дополнительный пинок для запуска плеера
    setTimeout(() => {
        const modalVideos = document.querySelectorAll('#sliderWrapper video.modal-video-player');
        modalVideos.forEach(vid => {
            let playPromise = vid.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Если браузер заблокировал автоплей, он хотя бы покажет первый кадр благодаря хаку #t=0.001
                    console.log("Ожидание клика (политика браузера)");
                });
            }
        });
    }, 100);

    // Перезапуск PhotoSwipe после вставки новых картинок
    if (window.pswpLightbox) {
        try { window.pswpLightbox.init(); } catch (e) {} 
    }

    const simCont = document.getElementById('similarItemsContainer');
    if (simCont) {
        simCont.innerHTML = '';
        
        // Считываем состояние галочки "Скрыть проданное"
        const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
        
        // Фильтруем похожие товары (учитывая статус, если надо)
        let similar = allItems.filter(i => {
            if (i.id === item.id) return false; // Саму открытую вещь не показываем
            if (hideUnavailable && i.status !== 'available') return false; // Прячем проданное, если стоит галочка
            return (i.category === item.category || i.brand === item.brand);
        });
        
        if (similar.length < 4) {
            const priceMargin = item.price * 0.3;
            const extra = allItems.filter(i => {
                if (i.id === item.id || similar.includes(i)) return false;
                if (hideUnavailable && i.status !== 'available') return false; // Прячем проданное, если стоит галочка
                return i.price >= item.price - priceMargin && i.price <= item.price + priceMargin;
            });
            similar = [...similar, ...extra];
        }
        
        similar = similar.sort(() => 0.5 - Math.random()).slice(0, 4);
        
        // Достаем историю просмотров, чтобы проверить, видел ли юзер эти похожие вещи
        let seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
            
       if(similar.length > 0) {
            similar.forEach(s => {
                const sImg = getOptimizedImageUrl(s, true); 
                
                // 1. МИНИ-БЕЙДЖИ (% SALE / HOT) - остаются в левом верхнем углу
                let miniBadgeHTML = '';
                const hasSale = s.is_sale;
                const hasHot = (s.views_count || 0) >= 25;
                const isTop = s.is_top === true && s.top_until && new Date(s.top_until).getTime() > Date.now();

                // Бейджи SALE, HOT, TOP (только 'available')
                if ((hasSale || hasHot || isTop) && s.status === 'available') {
                    miniBadgeHTML = `<div style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; display: flex; align-items: center; gap: 4px; padding: 1px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none;">`;
                    if (isTop) {
                        miniBadgeHTML += `<span style="color: #cc00ff;"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: -1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> TOP</span>`;
                    }
                    if (isTop && (hasSale || hasHot)) miniBadgeHTML += `<div style="width: 1px; height: 8px; background: #888;"></div>`;
                    if (hasSale) miniBadgeHTML += `<span style="color: #cc0000;">% SALE</span>`;
                    if (hasSale && hasHot) miniBadgeHTML += `<div style="width: 1px; height: 8px; background: #888;"></div>`;
                    if (hasHot) {
                        miniBadgeHTML += `<span style="color: #0044cc;"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: -1px;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg> HOT</span>`;
                    }
                    miniBadgeHTML += `</div>`;
                }

                const curr = getCurrency();
                let miniPriceHTML = `${s.price} ${curr}`;
                if (s.is_sale && s.old_price) {
                    miniPriceHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 9px; margin-right: 4px;">${s.old_price}</span><span style="color: var(--accent-green);">${s.price} ${curr}</span>`;
                }

                const isUnseen = !seenItemsIds.includes(s.id) && s.status === 'available';
                const pulseAnim = isUnseen ? 'animation: unseenPulseAnim 2s infinite alternate;' : '';
                const baseBorder = isUnseen ? 'var(--accent-red)' : '#333';

                // 2. ЛОГИКА ОТОБРАЖЕНИЯ SOLD / RESERVED
                let statusOverlayHTML = '';
                let imageFilter = '';

                if (s.status === 'sold') {
                    // Плашка SOLD (по центру, чуть уменьшена для мини-карточек)
                    statusOverlayHTML = `<div class="sold-badge" style="font-size: 14px !important; letter-spacing: 2px !important; padding: 2px 8px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">SOLD</div>`;
                    imageFilter = 'filter: grayscale(80%) brightness(0.5);'; 
                    // Перечеркиваем цену, если вещь продана
                    miniPriceHTML = `<span style="color:#888; text-decoration:line-through;">${s.price} ${curr}</span>`;
                } else if (s.status === 'reserved') {
                    // Плашка RESERVED
                    statusOverlayHTML = `<div class="reserved-badge" style="font-size: 11px !important; letter-spacing: 1px !important; padding: 2px 4px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">RESERVED</div>`;
                    imageFilter = 'filter: brightness(0.6);'; 
                }

                // 3. СБОРКА КАРТИНКИ ИЛИ ВИДЕО (Надежная загрузка)
                let imageBlockHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#555; font-family:var(--font-mono); font-size:10px;">NO FOTO</div>`;
                
                if (sImg) {
                    if (sImg.endsWith('.mp4')) {
                        imageBlockHTML = `<video src="${sImg}#t=0.001" style="width:100%; height:100%; object-fit:cover; pointer-events:none; ${imageFilter} transition: 0.3s;" preload="metadata"></video>`;
                    } else {
                        // Используем реальный тег <img> с обработчиком ошибок (onerror) и накладываем фильтр, если вещь продана
                        imageBlockHTML = `<img src="${sImg}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block; ${imageFilter} transition: 0.3s;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;font-family:var(--font-mono);\\'>ERROR</div>';">`;
                    }
                }

                // 4. ФИНАЛЬНЫЙ РЕНДЕР КАРТОЧКИ
                simCont.innerHTML += `
                    <div style="min-width: 120px; cursor: pointer; border: 1px solid ${baseBorder}; background: #000; transition: 0.2s; ${pulseAnim} display:flex; flex-direction:column;" 
                         onmouseover="this.style.borderColor='var(--accent-green)'" 
                         onmouseout="this.style.borderColor='${baseBorder}'" 
                         onclick="openProductModalById('${s.id}')">
                        <div style="position: relative; height: 100px; width: 100%; overflow: hidden; background: #111;">
                            ${miniBadgeHTML}
                            ${statusOverlayHTML}
                            ${imageBlockHTML}
                        </div>
                        <div style="padding: 8px; font-size: 11px; color: #fff; font-family: var(--font-mono); text-align: center; margin-top: auto;">${miniPriceHTML}</div>
                    </div>`;
            });
        } else {
            simCont.innerHTML = '<div style="color:#555; font-size:12px; font-family: var(--font-mono);">Похожих товаров пока нет.</div>';
        }
    }
   // --- ДИНАМИЧЕСКИЕ БЕЙДЖИ И ПРОВЕРКА НА ПРЕДЛОЖКУ ---
    const badgesContainer = document.querySelector('.trust-badges');
    if (badgesContainer) {
        const isDropItem = item.is_drop === true || (item.tags && item.tags.map(t => t.toLowerCase()).includes('drop'));
        const isReturnable = item.is_returnable === true; 
        
        let refundBadgeHTML = '';
        
        if (isDropItem) {
            const alertSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
            refundBadgeHTML = `
                <div class="badge-item danger-badge" onclick="showBadgeInfo('drop')">
                    <span class="badge-icon">${alertSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_drop">${i18next.t('product.badge_drop')}</span>
                </div>`;
        } else if (isReturnable) {
            const returnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
            refundBadgeHTML = `
                <div class="badge-item" onclick="showBadgeInfo('refund_yes')">
                    <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${returnSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_refund">${i18next.t('product.badge_refund')}</span>
                </div>`;
        } else {
            const noReturnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
            refundBadgeHTML = `
                <div class="badge-item" onclick="showBadgeInfo('refund_no')">
                    <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${noReturnSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_norefund">${i18next.t('product.badge_norefund')}</span>
                </div>`;
        }

        const secureSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;

        badgesContainer.innerHTML = `
            <div class="badge-item" onclick="showBadgeInfo('secure')">
                <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${secureSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_orig">${i18next.t('product.badge_orig')}</span>
            </div>
            <div class="badge-item" onclick="showBadgeInfo('fast')">
                <span class="badge-icon">24H</span> 
                <span class="badge-text" data-i18n="product.badge_fast">${i18next.t('product.badge_fast')}</span>
            </div>
            ${refundBadgeHTML}
        `;
    }

    document.getElementById('productModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const tw = document.getElementById('modalTypewriterTitle');
    if(tw) {
        tw.style.animation = 'none'; 
        tw.offsetHeight; 
        tw.style.animation = null;
    }

    addToHistory(item);

    const modalWin = document.querySelector('#productModal .modal-window');
    if (modalWin) {
        modalWin.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- УМНАЯ ОЧИСТКА URL ---
    // Если мы перешли по ссылке на этот товар, стираем ?item=... из адресной строки,
    // чтобы при следующем обновлении страницы окно не вылезло снова.
    const url = new URL(window.location);
    if (url.searchParams.has('item')) {
        url.searchParams.delete('item');
        window.history.replaceState(null, '', url.pathname + url.search);
    }
    // Загружаем вопросы и рендерим
    if (_supabase) window.loadItemQuestions(item.id);

    // === SEO JSON-LD РАЗМЕТКА ДЛЯ GOOGLE ===
    let schemaScript = document.getElementById('seo-schema');
    if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'seo-schema';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
    }
    const schemaData = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": item.name,
        "image": (item.images && item.images.length > 0) ? item.images[0] : "",
        "description": item.description || item.name,
        "brand": { "@type": "Brand", "name": item.brand },
        "offers": {
            "@type": "Offer",
            "url": window.location.href,
            "priceCurrency": "UAH",
            "price": item.price,
            "availability": item.status === 'available' ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "itemCondition": "https://schema.org/UsedCondition"
        }
    };
    schemaScript.innerText = JSON.stringify(schemaData);

    // ==============================================================
    // ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ ТЕГОВ ДЛЯ TELEGRAM И ДРУГИХ МЕССЕНДЖЕРОВ
    // ==============================================================
    const setMetaTag = (property, content) => {
        let tag = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            if (property.startsWith('og:')) tag.setAttribute('property', property);
            else tag.setAttribute('name', property);
            document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
    };

    let statusPrefix = item.status === 'sold' ? '🔴 SOLD | ' : (item.status === 'reserved' ? '🟡 RESERVED | ' : '🟢 ');
    let ogTitle = `${statusPrefix}NISHA: ${item.brand} - ${item.name}`;
    let ogDesc = `Размер: ${item.size} | Цена: ${item.price} грн`;
    let ogImage = (item.images && item.images.length > 0) ? item.images[0] : 'https://i.ibb.co/3s6HhXz/icon.ico';

    setMetaTag('og:title', ogTitle);
    setMetaTag('og:description', ogDesc);
    setMetaTag('og:image', ogImage);
    setMetaTag('twitter:title', ogTitle);
    setMetaTag('twitter:description', ogDesc);
    setMetaTag('twitter:image', ogImage);
}

let currentSlide = 0;
let totalSlides = 0; // Добавили переменную

function moveSlide(step) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    currentSlide = (currentSlide + step + slides.length) % slides.length;
    updateSlider();
}

function setSlide(index) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    currentSlide = index;
    updateSlider();
}

function updateSlider() {
    const sliderWrapper = document.getElementById('sliderWrapper');
    if (!sliderWrapper) return; // Тут return легален, он внутри функции

    sliderWrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    const counter = document.getElementById('photoCounter');
    const totalSlides = document.querySelectorAll('.slide').length;
    
    if (counter) {
        counter.innerText = `${currentSlide + 1} / ${totalSlides}`;
    }

    const thumbs = document.querySelectorAll('.thumb');
    thumbs.forEach((t, i) => { 
        if(i === currentSlide) t.classList.add('active-thumb'); 
        else t.classList.remove('active-thumb'); 
    });
}

// ==========================================
// 14. ИСТОРИЯ ПРОСМОТРОВ (HISTORY LOG)
// ==========================================
function addToHistory(item) {
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    hist = hist.filter(i => i.id !== item.id);
    const img = (item.images && item.images.length > 0) ? item.images[0] : '';
    
    // ДОБАВИЛИ is_sale и old_price для правильного отображения скидок
    hist.unshift({ 
        id: item.id, 
        name: item.name, 
        price: item.price, 
        old_price: item.old_price, 
        is_sale: item.is_sale, 
        img: img 
    });
    
    if(hist.length > 8) hist.pop(); 
    
    localStorage.setItem('nisha_history', JSON.stringify(hist));
    renderHistory();
}

// ==========================================
// 14. ИСТОРИЯ ПРОСМОТРОВ (HISTORY LOG)
// ==========================================
function renderHistory() {
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    const container = document.getElementById('historyGrid');
    const section = document.getElementById('historySection');
    
    if(!container || !section) return;

    if (allItems.length > 0) {
        const validHist = hist.filter(h => allItems.some(dbItem => dbItem.id === h.id));
        if (validHist.length !== hist.length) {
            hist = validHist;
            localStorage.setItem('nisha_history', JSON.stringify(hist));
        }
    }
    
    if(hist.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    container.innerHTML = '';
    
    // Считываем состояние галочки "Скрыть проданное"
    const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;

    hist.forEach(h => {
        // --- УЗНАЕМ РЕАЛЬНЫЙ СТАТУС ВЕЩИ ИЗ БАЗЫ ---
        const realItem = allItems.find(i => i.id === h.id);
        const currentStatus = realItem ? realItem.status : 'available';

        // --- ФИКС: Прячем из истории, если нажата галочка "Скрыть проданное" ---
        if (hideUnavailable && currentStatus !== 'available') return; // Просто пропускаем этот товар!

        const optImg = h.img;
        const isVideo = optImg && optImg.endsWith('.mp4');
        
        let finalPriceHTML = '';
        const curr = getCurrency();
        if (h.is_sale && h.old_price) {
            finalPriceHTML = `<span style="color:#4a704a; text-decoration:line-through; font-size:10px; margin-right:4px;">${h.old_price}</span>${h.price} ${curr}`;
        } else {
            finalPriceHTML = `${h.price} ${curr}`;
        }

        // --- ЛОГИКА ОТОБРАЖЕНИЯ SOLD / RESERVED ---
        let statusOverlayHTML = '';
        let imageFilter = '';

        if (currentStatus === 'sold') {
            // Убрали translateZ и скорректировали позицию, чтобы было ровно по центру
            statusOverlayHTML = `<div class="sold-badge" style="font-size: 16px !important; letter-spacing: 2px !important; padding: 2px 10px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">SOLD</div>`;
            imageFilter = 'filter: grayscale(80%) brightness(0.5);'; 
        } else if (currentStatus === 'reserved') {
            statusOverlayHTML = `<div class="reserved-badge" style="font-size: 14px !important; letter-spacing: 1px !important; padding: 2px 5px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">RESERVED</div>`;
        }

        const card = document.createElement('div');
        // Убрали класс sold-out с самой карточки, чтобы крестик и цена оставались яркими!
        card.className = `history-card`;
        card.onclick = () => openProductModalById(h.id);
        
        let mediaHTML = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#555;">NO FOTO</div>';
        
        if (optImg) {
            if (isVideo) {
                mediaHTML = `
                    <video src="${optImg}#t=0.001" muted playsinline webkit-playsinline preload="metadata" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; ${imageFilter} transition: 0.3s;"></video>
                    <div style="position:absolute; z-index:5; top:4px; left:4px; background:rgba(0,0,0,0.8); padding:2px 4px; border-radius:2px; color:var(--accent-green); font-size:8px; font-family:var(--font-mono); border: 1px solid #333; pointer-events: none;">▶ VIDEO</div>
                `;
            } else {
                mediaHTML = `<div style="width:100%; height:100%; background-image:url('${optImg}'); background-size:cover; background-position:center; ${imageFilter} transition: 0.3s;"></div>`;
            }
        }
        
        let miniBadgeHTML = '';
        if (h.is_sale && currentStatus === 'available') {
            miniBadgeHTML = `<div style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; padding: 1px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none; color: #cc0000;">% SALE</div>`;
        }

        card.innerHTML = `
            <div class="history-img" style="position: relative; overflow: hidden; padding: 0; background: #111;">
                ${mediaHTML}
                ${miniBadgeHTML}
                ${statusOverlayHTML}
                <!-- Крестик вынесен ПОВЕРХ всего и не попадает под фильтры! -->
                <div class="history-item-remove" onclick="removeHistoryItem(event, '${h.id}')" title="Удалить" style="z-index: 20;">X</div>
            </div>
            <div class="history-info">
                <div class="history-name" title="${h.name}" style="${currentStatus !== 'available' ? 'color:#888; text-decoration:line-through;' : ''}">${h.name}</div>
                <div class="history-price">${finalPriceHTML}</div>
            </div>`;
            
        container.appendChild(card);

        if (typeof VanillaTilt !== 'undefined' && window.innerWidth > 900) {
            VanillaTilt.init(card, { max: 15, speed: 300, scale: 1.05 });
        }
    });

    if (currentUser && _supabase) {
        _supabase.from('profiles').update({ viewed_history: hist.map(h => h.id) }).eq('id', currentUser.id).then();
    }
}

function triggerEasterEgg() {
    isHacked = true;
    const overlay = document.getElementById('glitchOverlay');
    
    if (overlay) {
        document.getElementById('glitchMessage').innerHTML = "SYSTEM OVERRIDE<br>[ ACCESS GRANTED ]<br><span style='font-size: 20px; color:#fff; font-family: Tahoma;'>Секретная скидка -10% активирована</span>";
        overlay.style.display = 'flex';
        
        setTimeout(() => { 
            overlay.style.display = 'none'; 
        }, 2500);
    }
    
    applyFilters(); 
    
    cart.forEach(item => { 
        item.price = Math.floor(item.price * 0.9); 
    });
    localStorage.setItem('nisha_cart', JSON.stringify(cart));
    syncCartToServer();
    updateCartUI();
}
// ==========================================
// 16. СЧЕТЧИК ПОСЕТИТЕЛЕЙ (ЖЕЛЕЗОБЕТОННЫЕ УНИКАЛЬНЫЕ ЗА ДЕНЬ)
// ==========================================
async function initHitCounter() {
    const counterEl = document.getElementById('hitCounterValue');
    if (!counterEl) return;

    try {
        // 1. Добываем уникальный ID устройства
        let visitorId = localStorage.getItem('nisha_visitor_id');
        if (!visitorId) {
            visitorId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('nisha_visitor_id', visitorId);
        }
        clientFingerprint = visitorId; // Для защиты просмотров в карточке товара

        // 2. Узнаем сегодняшнюю дату
        const todayDate = new Date().toLocaleDateString('en-CA'); // Формат YYYY-MM-DD
        const lastVisitDate = localStorage.getItem('nisha_last_visit_date');

        // 3. СРАЗУ показываем последнюю известную цифру из памяти (чтобы не было нулей при старте)
        const cachedCount = localStorage.getItem('nisha_last_hit_count') || '0';
        counterEl.innerText = String(cachedCount).padStart(5, '0').split('').join(' ');

        // 4. Проверяем, был ли юзер ТУТ СЕГОДНЯ
        const isNewVisitToday = (lastVisitDate !== todayDate);

        // 5. Отправляем запрос на сервер
        const res = await fetch('https://nisha-api.onrender.com/api/hit', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({ 
                date: todayDate,
                countAsNew: isNewVisitToday
            })
        });
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const data = await res.json();
        
        if (data && data.success && data.count !== undefined) {
            // Если это был новый визит — запоминаем
            if (isNewVisitToday) {
                localStorage.setItem('nisha_last_visit_date', todayDate);
            }
            
            // Сохраняем актуальную цифру для следующих заходов
            localStorage.setItem('nisha_last_hit_count', data.count);
            
            // Выводим с пробелами
            const strCount = data.count.toString().padStart(5, '0');
            counterEl.innerText = strCount.split('').join(' ');
        }
    } catch (err) {
        console.error("Счетчик работает в оффлайн-режиме (Сервер спит):", err.message);
        // ВАЖНО: Мы больше не ставим тут '0 0 0 0 0'! 
        // Юзер просто продолжит видеть старую цифру из кэша (шаг 3), пока сервер не проснется.
    }
}
// updatePriceUI and toggleMobileSidebar moved to js/catalog/catalog.js

// Задержка поиска, чтобы не лагало при быстром вводе текста
let searchDebounce;
// Функция сохранения истории поиска
function saveRecentSearch(term) {
    if (!term || term.length < 2) return;
    let history = JSON.parse(localStorage.getItem('nisha_search_history') || '[]');
    history = history.filter(t => t.toLowerCase() !== term.toLowerCase());
    history.unshift(term);
    if (history.length > 5) history.pop(); // Храним только 5 последних
    localStorage.setItem('nisha_search_history', JSON.stringify(history));
}

// Отображение истории поиска
function showSearchHistory() {
    const dropdown = document.getElementById('liveSearchDropdown');
    let history = JSON.parse(localStorage.getItem('nisha_search_history') || '[]');
    if (history.length === 0) return;

    let html = `<div class="search-history-title">🕒 НЕДАВНИЕ ЗАПРОСЫ <span class="search-history-clear" onclick="localStorage.removeItem('nisha_search_history'); closeSearch(); event.stopPropagation();">[ ОЧИСТИТЬ ]</span></div>`;
    history.forEach(term => {
        const safeTerm = term.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        html += `<div class="search-history-item" onclick="document.getElementById('mainSearch').value='${safeTerm}'; handleLiveSearch();">
                    <span>> ${safeTerm}</span>
                 </div>`;
    });
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
    document.body.classList.add('search-lock'); if (typeof window.stopLenis === 'function') window.stopLenis();
}

function handleLiveSearch() {
    clearTimeout(searchDebounce);
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchInput = document.getElementById('mainSearch');
    const searchTerm = searchInput.value.trim();

    // Если поле пустое, показываем историю (ленту НЕ трогаем)
    if (searchTerm.length === 0) {
        showSearchHistory();
        return; 
    }

    if (searchTerm.length < 2) {
        // ФИКС: Просто прячем подсказки, но НЕ УБИВАЕМ фокус клавиатуры!
        if (dropdown) dropdown.style.display = 'none';
        document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();
        return; 
    }

    searchDebounce = setTimeout(() => {
        // УЛУЧШЕННЫЙ ПОИСК ЧЕРЕЗ FUSE.JS ДЛЯ ВЫПАДАЮЩЕГО СПИСКА
        const cleanSearchTerm = searchTerm.replace(/#/g, '').trim().toLowerCase();
        const fuseOptions = {
            includeScore: true, 
            includeMatches: true, 
            threshold: 0.4, ignoreLocation: true, useExtendedSearch: true, 
            keys: [
                { name: 'tags', weight: 1.0 }, { name: 'brand', weight: 0.8 }, 
                { name: 'name', weight: 0.8 }, { name: 'size', weight: 0.8 }
            ]
        };
        const fuse = new Fuse(allItems, fuseOptions);
        const results = fuse.search(cleanSearchTerm).slice(0, 8); 

        dropdown.innerHTML = '';
        if (results.length > 0) {
            document.body.classList.add('search-lock'); if (typeof window.stopLenis === 'function') window.stopLenis();
            
            results.forEach(result => {
                const item = result.item;
                const img = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails[0] : (item.images[0] || '');
                
                // Подсветка совпадений зеленым цветом
                let highlightedName = item.name;
                if (result.matches) {
                    const nameMatch = result.matches.find(m => m.key === 'name');
                    if (nameMatch) {
                        let tempName = '';
                        let lastIdx = 0;
                        nameMatch.indices.forEach(([start, end]) => {
                            tempName += item.name.substring(lastIdx, start);
                            tempName += `<span style="color: var(--accent-green); background: rgba(0,255,0,0.1);">${item.name.substring(start, end + 1)}</span>`;
                            lastIdx = end + 1;
                        });
                        tempName += item.name.substring(lastIdx);
                        highlightedName = tempName;
                    }
                }

                dropdown.innerHTML += `
                    <div class="live-search-item" onclick="openProductModalById('${item.id}'); closeSearch();">
                        <div class="live-search-img" style="background-image: url('${img}')"></div>
                        <div class="live-search-info">
                            <span class="live-search-title">${highlightedName}</span>
                            <span class="live-search-price">${item.price} грн</span>
                        </div>
                    </div>`;
            });
            dropdown.style.display = 'block';

            dropdown.ongetscroll = () => {}; 
            dropdown.addEventListener('touchstart', () => {
                if (document.activeElement === searchInput) searchInput.blur();
            }, {passive: true});

        } else {
            dropdown.innerHTML = '<div style="padding: 20px; color: #666; font-family: monospace; text-align: center;">[ СОВПАДЕНИЙ НЕТ ]</div>';
            dropdown.style.display = 'block';
            document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();
        }
        
        // ВАЖНО: Мы удалили отсюда applyFilters()!
        // Теперь лента не будет прыгать во время набора текста.
    }, 300);
}

function closeSearch() {
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchInput = document.getElementById('mainSearch');
    if (dropdown) dropdown.style.display = 'none';
    document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();
    if (searchInput) searchInput.blur(); // Принудительно прячем клавиатуру
}


document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        closeSearch(); // Используем нашу новую функцию
    }
});
async function toggleFavFromModal(event) {
    if (!currentOpenedItem) return;
    
    // Снимаем фокус с телефона, чтобы не залипало
    const modalStar = document.getElementById('modalFavStar');
    if (modalStar) modalStar.blur();

    // Просто вызываем главную защищенную функцию
    await toggleFav(event, currentOpenedItem.id);
}
// ==========================================
// ПЛАВНЫЕ АККОРДЕОНЫ (В МОДАЛКЕ ТОВАРА)
// ==========================================
function toggleAccordion(element) {
    const parent = element.parentElement; // Получаем блок .custom-details
    const isOpen = parent.classList.contains('open');
    
    // (Опционально) Закрываем другие открытые вкладки, если хочешь, чтобы открытой была только одна
    document.querySelectorAll('.custom-details').forEach(el => el.classList.remove('open'));
    
    // Если кликнули по закрытой - открываем её
    if (!isOpen) {
        parent.classList.add('open');
    }
}
// ==========================================
// СКРЫТИЕ/ПОКАЗ ИСТОРИИ ПРОСМОТРОВ (ПЛАВНО)
// ==========================================
function toggleHistory() {
    const grid = document.getElementById('historyGrid');
    const arrow = document.getElementById('historyArrow');
    
    // Вместо жесткого display: none, просто добавляем/убираем класс
    grid.classList.toggle('collapsed');
    
    if (grid.classList.contains('collapsed')) {
        arrow.style.transform = 'rotate(-90deg)'; // Стрелка влево (закрыто)
    } else {
        arrow.style.transform = 'rotate(0deg)';   // Стрелка вниз (открыто)
    }
}
// ==========================================
// СБРОС НА ГЛАВНУЮ СТРАНИЦУ (ФИКС ИЗБРАННОГО)
// ==========================================
function resetToMain() {
    // 1. Скроллим наверх
    window.scrollTo(0,0);
    
    // 2. Сбрасываем глобальные переменные
    currentCategory = '';
    currentBrand = '';
    showingOnlyFavs = false; // ВЫКЛЮЧАЕМ РЕЖИМ ИЗБРАННОГО
    
    // 3. Очищаем строку поиска
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) searchInput.value = '';
    
    // 4. Снимаем галочки с размеров
    document.querySelectorAll('.size-cb').forEach(cb => cb.checked = false);
    
    // 5. Возвращаем кнопке "ИЗБРАННОЕ" желтый цвет (выключаем белый)
    const favNav = document.getElementById('favNav');
    if (favNav) favNav.style.color = 'var(--accent-yellow)';
    
    // 6. Визуально переключаем активную категорию в сайдбаре на "Все вещи"
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(el => el.classList.remove('active-filter'));
    const allItemsLink = document.querySelector('.sidebar .filter-list:first-of-type a');
    if (allItemsLink) allItemsLink.classList.add('active-filter');

    // 7. Применяем фильтры (перерисовываем сетку)
    applyFilters();
}
// ==========================================
// PWA INSTALL BUTTON LOGIC
// ==========================================
let deferredPrompt;
const installBtn = document.getElementById('installAppBtn');

// Браузер сам решает, когда показать предложение установки. Мы его перехватываем.
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Останавливаем стандартное всплывающее окно браузера
    deferredPrompt = e; // Сохраняем событие
    if(installBtn) installBtn.style.display = 'block'; // Показываем нашу зеленую кнопку
});

if(installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt(); // Показываем системное окно установки
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('Пользователь установил PWA');
            installBtn.style.display = 'none'; // Прячем кнопку после установки
        }
        deferredPrompt = null;
    });
}
// ==========================================
// ПОДЕЛИТЬСЯ ТОВАРОМ (NATIVE SHARE)
// ==========================================
function shareItem() {
    if (!currentOpenedItem) return;
    
    // Возвращаем ссылку на основной домен (без красивых превью в Telegram)
    const shareUrl = `https://www.nisha-store.shop/share/${currentOpenedItem.id}`;
    const shareTitle = `NISHA | ${currentOpenedItem.brand} - ${currentOpenedItem.name}`;
    const shareText = `Зацени: ${currentOpenedItem.brand} (${currentOpenedItem.size}).`;

    if (navigator.share) {
        navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
        }).catch((err) => {
            console.log('Шеринг отменен пользователем');
        });
    } else {
        // Если это обычный ПК на Windows (копируем ссылку)
        navigator.clipboard.writeText(shareUrl)
            .then(() => {
                const msg = typeof i18next !== 'undefined' ? i18next.t('messages.link_copied', {defaultValue: 'Ссылка скопирована!'}) : 'Ссылка скопирована!';
                showToast(msg, 'success');
            })
            .catch(() => {
                const msg = typeof i18next !== 'undefined' ? i18next.t('messages.copy_error', {defaultValue: 'Ошибка копирования'}) : 'Ошибка копирования';
                showToast(msg, 'error');
            });
    }
}
// applyPromoCode and cart swipe functions moved to js/cart/cart.js
// initMobileSwipe вынесена в js/ui/windows.js
// ==========================================
// ЛОГИКА ПРЕДЛОЖКИ ТОВАРОВ (DROP_ITEM.EXE)
// Перенесена в js/drop/drop.js
// ==========================================




// 6. Свайп фотографий в модалке товара
function initSliderSwipe() {
    const sliderContainer = document.getElementById('sliderContainer');
    if (!sliderContainer) return;

    let touchStartX = 0;
    let touchEndX = 0;
    let lastTapTime = 0;

    sliderContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return;
        touchStartX = e.touches[0].clientX;

        // ЛОГИКА ДАБЛ-ТАПА (Двойное касание)
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0) {
            // Это двойной тап! Находим текущий слайд и увеличиваем его
            const slides = document.querySelectorAll('.slide');
            if (slides[currentSlide]) {
                slides[currentSlide].classList.toggle('zoomed-in');
            }
            e.preventDefault(); // Блокируем стандартный зум браузера
        }
        lastTapTime = currentTime;

    }, { passive: false });

    sliderContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        
        const currentSlideEl = document.querySelectorAll('.slide')[currentSlide];
        const isZoomed = currentSlideEl && currentSlideEl.classList.contains('zoomed-in');

        // Свайпаем только если фотка НЕ увеличена
        if (Math.abs(diff) > 50 && !isZoomed) {
            if (diff > 0) moveSlide(1);
            else moveSlide(-1);
        }
    }, { passive: true });
}

// 7. Функция входа через Google
async function loginWithGoogle() {
    const isInApp = /Instagram|FBAN|FBAV|TikTok/i.test(navigator.userAgent);
    if (isInApp) {
        alert("Для входа через Google открой сайт в обычном браузере (Safari или Chrome)");
        return;
    }
    const { data, error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'https://www.nisha-store.shop',
            queryParams: { prompt: 'select_account', access_type: 'offline' }
        }
    });
    if (error) showToast('Ошибка: ' + error.message, 'error');
}
// updateCardDots and showBadgeInfo moved to js/catalog/catalog.js

// ==========================================
// ЛОГИКА ГЛАЗИКА (ПОКАЗАТЬ/СКРЫТЬ ПАРОЛЬ)
// ==========================================
window.togglePasswordVisibility = function(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        iconElement.classList.add('visible'); // Глазик становится зеленым, линия исчезает
    } else {
        input.type = 'password';
        iconElement.classList.remove('visible'); // Глазик становится красным, линия появляется
    }
};
// autoDetectCity moved to js/cart/cart.js
// Reviews submission and prompt functions moved to js/reviews/reviews.js

// ==========================================
// ЛОГИКА УДАЛЕНИЯ ИЗ ИСТОРИИ ПРОСМОТРОВ
// ==========================================
window.removeHistoryItem = function(event, itemId) {
    // Останавливаем "проваливание" клика, чтобы не открылась карточка товара
    event.stopPropagation(); 
    
    // Получаем текущую историю
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    
    // Убираем товар с нужным ID
    hist = hist.filter(item => item.id !== itemId);
    
    // Сохраняем обратно в память телефона/ПК
    localStorage.setItem('nisha_history', JSON.stringify(hist));
    
    // Синхронизируем удаление с БД (если юзер вошел в аккаунт)
    if (currentUser && _supabase) {
        _supabase.from('profiles').update({ 
            viewed_history: hist.map(h => h.id) 
        }).eq('id', currentUser.id).then();
    }
    
    // Мгновенно перерисовываем блок истории (карточка исчезнет)
    renderHistory(); 
};
// scrollGridSlider moved to js/catalog/catalog.js


// ==========================================
// ЛОГИКА "ЗАДАТЬ ВОПРОС"
// ==========================================
window.toggleQuestionForm = function() {
    const container = document.getElementById('questionFormContainer');
    if (!container) return;
    
    if (container.style.maxHeight === '0px' || container.style.maxHeight === '') {
        container.style.maxHeight = '100px';
        setTimeout(() => document.getElementById('questionInput').focus(), 100);
    } else {
        container.style.maxHeight = '0px';
    }
};

window.submitQuestion = async function(itemId) {
    if (!currentUser) {
        showToast('Для отправки вопроса нужно войти в аккаунт!', 'error');
        openProfileModal();
        return;
    }

    const input = document.getElementById('questionInput');
    const text = input.value.trim();
    if (text.length < 5) {
        showToast('Вопрос слишком короткий!', 'error');
        return;
    }

    const today = new Date().toLocaleDateString('en-CA');
    let questionData = JSON.parse(localStorage.getItem('nisha_questions') || '{"date":"","count":0}');
    
    if (questionData.date !== today) questionData = { date: today, count: 0 };
    if (questionData.count >= 2) {
        triggerHaptic('error');
        return showToast('Лимит: 2 вопроса в день.', 'error');
    }

    // ДОСТАЕМ БЕЗОПАСНОЕ ИМЯ ТОВАРА ПРЯМО ИЗ ГЛОБАЛЬНОЙ ПЕРЕМЕННОЙ
    let itemName = "Товар";
    if (currentOpenedItem && currentOpenedItem.id === itemId) {
        itemName = currentOpenedItem.name;
    }

    try {
        const res = await fetch('https://nisha-api.onrender.com/api/question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: currentUser.id,
                email: currentUser.email || 'Неизвестно',
                itemId: itemId, 
                itemName: itemName, 
                questionText: text 
            })
        });

        const data = await res.json();
        
        if (data.success) {
            questionData.count += 1;
            localStorage.setItem('nisha_questions', JSON.stringify(questionData));
            input.value = '';
            window.toggleQuestionForm(); 
            showToast('Вопрос отправлен!', 'success');
        } else {
            showToast('Ошибка при отправке вопроса.', 'error');
        }
    } catch (err) {
        showToast('Ошибка соединения с сервером.', 'error');
    }
};
// ==========================================
// ЛОГИКА ОТОБРАЖЕНИЯ И ОБНОВЛЕНИЯ Q&A
// ==========================================
window.loadItemQuestions = async function(itemId) {
    const { data, error } = await _supabase.from('item_questions').select('*').eq('item_id', itemId).order('created_at', { ascending: true });
    
    const wrapper = document.getElementById('qaWrapper');
    const list = document.getElementById('qaList');
    
    if (data && data.length > 0 && wrapper && list) {
        wrapper.style.display = 'block';
        list.innerHTML = '';
        data.forEach(q => {
            // БЕЗОПАСНОСТЬ: Очищаем текст
            const safeQ = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(q.question) : q.question.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeA = q.answer ? (typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(q.answer) : q.answer.replace(/</g, '&lt;').replace(/>/g, '&gt;')) : null;
            const safeU = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(q.user_name) : q.user_name.replace(/</g, '&lt;').replace(/>/g, '&gt;');

            let answerHtml = safeA ? `<div style="color: var(--accent-green); font-size: 12px; font-weight: bold; margin-top: 4px;">↳ NISHA: ${safeA}</div>` : '';
            list.innerHTML += `
                <div style="border-left: 2px solid #333; padding-left: 10px; margin-bottom: 12px; font-family: var(--font-main);">
                    <span style="color:#888; font-size:11px; font-family:var(--font-mono);">@${safeU}:</span>
                    <div style="color:#ddd; font-size:13px; margin-top:2px;">${safeQ}</div>
                    ${answerHtml}
                </div>`;
        });
    } else if (wrapper) {
        wrapper.style.display = 'none'; // Прячем весь блок, если вопросов нет
    }
};

// Подписываемся на обновления в реальном времени (когда открыта карточка)
if (_supabase) {
    _supabase.channel('public-qa-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'item_questions' }, payload => {
            // Если сейчас открыта карточка товара и пришло обновление именно по этому товару
            if (currentOpenedItem && payload.new && payload.new.item_id === currentOpenedItem.id) {
                window.loadItemQuestions(currentOpenedItem.id); // Перерисовываем список вопросов наживую!
            }
        })
        .subscribe();
}
// ==========================================
// УМНАЯ ВКЛАДКА (ВОЗВРАТ КЛИЕНТА)
// ==========================================
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // Юзер ушел на другую вкладку
        if (cart.length > 0) {
            document.title = `(${cart.length}) 🛒 Ждем тебя | NISHA`;
        } else {
            document.title = `Zzz... | NISHA`;
        }
    } else {
        // Юзер вернулся
        if (currentOpenedItem) {
            document.title = `NISHA | ${currentOpenedItem.brand} - ${currentOpenedItem.name}`;
        } else {
            document.title = 'NISHA | Underground Store';
        }
    }
});
// ==========================================
// PULL-TO-REFRESH (КАК В НАТИВНЫХ ПРИЛОЖЕНИЯХ)
// ==========================================
let touchStartY = 0;
document.addEventListener('touchstart', e => {
    // Работает только если мы в самом верху страницы
    if (window.scrollY === 0) touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
    if (window.scrollY === 0 && touchStartY > 0) {
        let touchEndY = e.changedTouches[0].clientY;
        // Если потянули вниз больше чем на 150px
        if (touchEndY - touchStartY > 150) {
            triggerHaptic('medium'); // Вибрация
            showToast('ОБНОВЛЕНИЕ БАЗЫ ДАННЫХ...', 'success');
            loadAllItems(); // Перезагружаем товары из базы без перезагрузки страницы
        }
    }
    touchStartY = 0;
}, { passive: true });
// handleDoubleTapLike moved to js/catalog/catalog.js

// ==========================================
// ФОРМА ПОДДЕРЖКИ (SUPPORT_TICKET.EXE)
// Перенесена в js/chat/chat.js
// ==========================================
// ==========================================
// УМНАЯ ВКЛАДКА (ВОЗВРАТ КЛИЕНТА)
// ==========================================
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // Юзер свернул браузер или ушел на другую вкладку
        if (cart.length > 0) {
            // Если в корзине что-то есть, давим на психику
            document.title = `(${cart.length}) 🛒 Ждем тебя | NISHA`;
        } else {
            // Если корзина пустая, просто "засыпаем"
            document.title = `Zzz... | NISHA`;
        }
    } else {
        // Юзер вернулся обратно на наш сайт
        if (typeof currentOpenedItem !== 'undefined' && currentOpenedItem) {
            // Если у него открыта карточка товара
            document.title = `NISHA | ${currentOpenedItem.brand} - ${currentOpenedItem.name}`;
        } else {
            // Если он просто в ленте
            document.title = 'NISHA | Underground Store';
        }
    }
});

// --- ЖИВОЙ СЧЕТЧИК СИМВОЛОВ ДЛЯ ПРЕДЛОЖКИ (ОБРАТНЫЙ ОТСЧЕТ) ---
function updateCharCount(textarea) {
    const label = document.getElementById('descLabel');
    if (!label) return;
    
    // Считаем сколько осталось символов
    const remaining = 250 - textarea.value.length;
    
    // Берем оригинальный текст перевода (для любого языка)
    let originalText = i18next.t('propose.desc_label', { defaultValue: 'ОПИСАНИЕ И ДЕФЕКТЫ (ДО 250 СИМВОЛОВ):' });
    
    // Просто заменяем число 250 на остаток
    label.innerText = originalText.replace('250', remaining);
    
    // Красим в красный, если лимит исчерпан
    if (remaining <= 0) {
        label.style.color = 'var(--accent-red)';
    } else {
        label.style.color = 'var(--accent-green)';
    }
}

// ==========================================
// ПЕРЕХОД К СЛЕДУЮЩЕМУ ПОЛЮ ПО НАЖАТИЮ ENTER (ДЛЯ ПК)
// ==========================================
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const activeEl = document.activeElement;

        // Если мы печатаем в Textarea (например, в описании), Enter должен делать перенос строки. Не трогаем!
        if (activeEl.tagName === 'TEXTAREA') return;

        // Если фокус на обычном поле ввода (input)
        if (activeEl.tagName === 'INPUT') {
            e.preventDefault(); // Блокируем случайную отправку или перезагрузку страницы

            // Находим родительский блок формы, в которой мы сейчас находимся (Окно предложки, авторизация, корзина)
            const form = activeEl.closest('.form-layout') || activeEl.closest('.auth-fields');
            
            if (form) {
                // Собираем все видимые поля ввода и кнопки в этой форме по порядку
                const focusables = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([style*="display: none"]):not([disabled]), textarea, button:not([style*="display: none"]):not([disabled])'));
                
                const currentIndex = focusables.indexOf(activeEl);
                
                // Если мы нашли текущее поле и оно не последнее в списке — прыгаем на следующее!
                if (currentIndex > -1 && currentIndex < focusables.length - 1) {
                    focusables[currentIndex + 1].focus();
                }
            }
        }
    }

    if (window.innerWidth > 900) {
        const pModal = document.getElementById('productModal');
        if (pModal && pModal.style.display === 'flex') {
            if (e.key === 'Escape') {
                closeModal('productModal');
            } else if (e.key === 'ArrowLeft') {
                if (typeof moveSlide === 'function') moveSlide(-1);
            } else if (e.key === 'ArrowRight') {
                if (typeof moveSlide === 'function') moveSlide(1);
            }
        }
    }
});

// scrollReviews moved to js/reviews/reviews.js




document.addEventListener('DOMContentLoaded', () => {
    initSliderSwipe();
    initMobileSwipe();
});

// ==========================================
// WEB PUSH ПОДПИСКА
// ==========================================
let pushPrompted = false;
async function subscribeUserToPush(registration, silent = false) {
    try {
        if (Notification.permission === 'denied') return;
        
        let targetSub = await registration.pushManager.getSubscription();
        
        if (!targetSub) {
            if (silent) return;
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
            
            const res = await fetch('https://nisha-api.onrender.com/api/vapid-key');
            if (!res.ok) return;
            const { publicKey } = await res.json();
            
            const padding = '='.repeat((4 - publicKey.length % 4) % 4);
            const base64 = (publicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }

            targetSub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: outputArray
            });
        }
        
        if (targetSub) {
            const payload = {
                subscription: targetSub,
                userId: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : clientFingerprint
            };
            await fetch('https://nisha-api.onrender.com/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
    } catch(e) {
        console.error('Push error:', e);
    }
}

document.addEventListener('click', (e) => {
    if (pushPrompted) return;
    
    // 1. Игнорируем, если открыто любое модальное окно (Товар, Корзина, Оформление и тд)
    const isModalOpen = Array.from(document.querySelectorAll('[id$="Modal"], .modal-overlay, #cartSidebar')).some(m => {
        const style = window.getComputedStyle(m);
        return style.display === 'flex' || style.display === 'block' || m.classList.contains('active');
    });
    if (isModalOpen) return;
    
    // 2. Игнорируем клик по карточке товара (чтобы не перебивать открытие товара)
    if (e.target.closest('.item-card')) return;

    // 3. Игнорируем клики по нижнему навигатору/корзине
    if (e.target.closest('.bottom-nav, #cartBtn, #profileBtn')) return;

    // Если всё чисто — мы в ленте товаров, и клик был по безопасному элементу (фильтр, лого, фон)
    pushPrompted = true;
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            subscribeUserToPush(reg);
        });
    }
});
// ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ БЕЙДЖИКОВ НА КАРТОЧКЕ
window.updateCardDOM = function(item) {
    const cards = document.querySelectorAll(`.item-card[data-id="${item.id}"]`);
    cards.forEach(card => {
        // Очищаем старые бейджи статуса
        const oldBadges = card.querySelectorAll('.sold-badge, .reserved-badge, .system-status-bar');
        oldBadges.forEach(b => b.remove());
        card.classList.remove('sold-out', 'reserved-item');

        // Добавляем новые бейджи SOLD / RESERVED
        if (item.status === 'sold') {
            card.classList.add('sold-out');
            card.insertAdjacentHTML('afterbegin', '<div class="sold-badge">SOLD</div>');
        } else if (item.status === 'reserved') {
            card.classList.add('reserved-item');
            card.insertAdjacentHTML('afterbegin', '<div class="reserved-badge">RESERVED</div>');
        } else {
            // Для доступных товаров - генерируем систему SALE / HOT / TOP
            const hasSale = item.is_sale;
            const hasHot = (item.views_count || 0) >= 25;
            const isTop = item.is_top === true && item.top_until && new Date(item.top_until).getTime() > Date.now();

            if (hasSale || hasHot || isTop) {
                let badgeHTML = `<div class="system-status-bar">`;
                if (isTop) {
                    badgeHTML += `<span class="status-item status-top"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> TOP</span>`;
                }
                if (isTop && (hasSale || hasHot)) badgeHTML += `<div class="status-divider"></div>`;
                if (hasSale) badgeHTML += `<span class="status-item status-sale">% SALE</span>`;
                if (hasSale && hasHot) badgeHTML += `<div class="status-divider"></div>`;
                if (hasHot) {
                    const chartSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
                    badgeHTML += `<span class="status-item status-hot">${chartSvg} HOT</span>`;
                }
                badgeHTML += `</div>`;
                
                card.insertAdjacentHTML('afterbegin', badgeHTML);
            }
        }
        
        // Обновляем цену динамически
        const priceDiv = card.querySelector('.price-container');
        if (priceDiv) {
            const curr = getCurrency();
            if (item.is_sale && item.old_price) {
                priceDiv.innerHTML = `<span class="old-price">${item.old_price} ${curr}</span><span class="new-price">${item.price} ${curr}</span>`;
            } else {
                priceDiv.innerHTML = `${item.price} ${curr}`;
            }
        }
    });
};







