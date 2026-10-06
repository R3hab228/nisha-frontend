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
window.toggleLangDropdown = toggleLangDropdown;

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
window.changeLanguage = changeLanguage;


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
window.updateContentLanguage = updateContentLanguage;

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
window.startSearchTypewriter = startSearchTypewriter;
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
// openProfileModal moved to js/profile/profile.js

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
// currentUser, userProfile, favorites initialized in js/profile/profile.js
// currentOpenedItem initialized in js/product/product.js
let isHacked = false; 
window.isHacked = false; 
let _supabase = null;
let clientFingerprint = "guest_" + Date.now();
// orderStatusChannel and qaUpdatesChannel moved to js/profile/profile.js


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
    if (typeof window.initAuthListener === 'function') window.initAuthListener();
}
window.clientFingerprint = clientFingerprint;
// onAuthStateChange and session refresh moved to js/profile/profile.js



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

let appInitialized = false;
async function initApp() {
    if (appInitialized) return;
    appInitialized = true;
    document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();

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

        // 1. Восстанавливаем фильтры, категорию и поисковый запрос (синхронно, 0мс)
        const urlParams = new URLSearchParams(window.location.search);
        
        // Восстанавливаем вкладку "Избранное"
        if (sessionStorage.getItem('nisha_showing_favs') === 'true') {
            showingOnlyFavs = true;
            const favNav = document.getElementById('favNav');
            if (favNav) favNav.style.color = '#fff';
        }

        // --- ВОССТАНОВЛЕНИЕ КАТЕГОРИИ И UI ---
        const savedCat = urlParams.get('cat') || sessionStorage.getItem('nisha_last_category');
        const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
        catLinks.forEach(el => el.classList.remove('active-filter'));

        if (savedCat) {
            currentCategory = savedCat;
            catLinks.forEach(link => {
                const onclickText = link.getAttribute('onclick') || '';
                if (onclickText.includes(`'${currentCategory}'`)) {
                    link.classList.add('active-filter');
                }
            });
        } else {
            const firstLink = document.querySelector('.sidebar .filter-list:first-of-type a');
            if (firstLink) firstLink.classList.add('active-filter');
        }

        // --- ВОССТАНОВЛЕНИЕ ПОИСКОВОГО ЗАПРОСА В UI ---
        const savedQuery = urlParams.get('q');
        if (savedQuery) {
            const sInput = document.getElementById('mainSearch');
            if (sInput) {
                sInput.value = savedQuery;
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'block';
            }
        }

        // 2. МГНОВЕННЫЙ ЗАПУСК КАТАЛОГА (из кэша отображается за 10мс, параллельно запрашивается БД)
        const itemsPromise = (typeof loadAllItems === 'function') ? loadAllItems() : Promise.resolve();

        // 3. ПАРАЛЛЕЛЬНО: Проверка сессии
        const sessionPromise = (_supabase && typeof checkSession === 'function') ? checkSession() : Promise.resolve();

        // 4. ПАРАЛЛЕЛЬНО: Загрузка словарей локализации
        const langPromise = (async () => {
            try {
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
        })();

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
        }

        checkRules();
        updateCartUI(); 

        await Promise.all([itemsPromise, sessionPromise, langPromise]);

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

        // initSupportRepliesSystem автозапускается внутри js/chat/chat.js

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
window.addEventListener('load', initApp);


// closeModal и executeCloseModal вынесены в js/ui/windows.js

// openReviewsModal and openReviewImage moved to js/reviews/reviews.js

// checkSession, phone/tg verification, and auth functions moved to js/profile/profile.js



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

// Favorites and orders functions moved to js/profile/profile.js

// openProductModalById, openProductModal, slider, and history functions moved to js/product/product.js

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
window.triggerEasterEgg = triggerEasterEgg;
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
window.initHitCounter = initHitCounter;
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
window.saveRecentSearch = saveRecentSearch;
window.showSearchHistory = showSearchHistory;
window.handleLiveSearch = handleLiveSearch;
window.closeSearch = closeSearch;


document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        closeSearch(); // Используем нашу новую функцию
    }
});
// toggleFavFromModal, toggleAccordion, toggleHistory moved to js/product/product.js
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
window.resetToMain = resetToMain;
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
// shareItem and initSliderSwipe moved to js/product/product.js


// loginWithGoogle and togglePasswordVisibility moved to js/profile/profile.js

// autoDetectCity moved to js/cart/cart.js
// Reviews submission and prompt functions moved to js/reviews/reviews.js

// removeHistoryItem and Q&A functions moved to js/product/product.js
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
// УМНАЯ ВКЛАДКА (ВОЗВРАТ КЛИЕНТА, ПУШ, СИНХРОНИЗАЦИЯ)
// ==========================================
let cartAbandonTimeout;
document.addEventListener("visibilitychange", async () => {
    const userCart = (typeof cart !== 'undefined') ? cart : (window.cart || []);
    if (document.hidden) {
        // Юзер свернул браузер или ушел на другую вкладку
        if (userCart.length > 0) {
            document.title = `(${userCart.length}) 🛒 Ждем тебя | NISHA`;
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
        } else {
            document.title = `Zzz... | NISHA`;
        }
    } else {
        // Юзер вернулся обратно на наш сайт
        if (cartAbandonTimeout) clearTimeout(cartAbandonTimeout);
        const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
        if (activeItem) {
            document.title = `NISHA | ${activeItem.brand} - ${activeItem.name}`;
        } else {
            document.title = 'NISHA | Underground Store';
        }
        if (_supabase) {
            await checkSession();
            if (window.allItems && window.allItems.length > 0) {
                loadAllItems(); 
            }
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
window.updateCharCount = updateCharCount;

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




// initMobileSwipe инициализируется внутри js/ui/windows.js

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
window.subscribeUserToPush = subscribeUserToPush;

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







