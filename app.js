console.log(`
      _   _ _____  _____ _    _          
     | \\ | |_   _|/ ____| |  | |   /\\    
     |  \\| | | | | (___ | |__| |  /  \\   
     | . \` | | |  \\___ \\|  __  | / /\\ \\  
     | |\\  |_| |_ ____) | |  | |/ ____ \\ 
     |_| \\_|_____|_____/|_|  |_/_/    \\_\\
                                         
    LOOKING AT THE SOURCE CODE? 
`);

function updateContentLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = i18next.t(key);
    });
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) searchInput.placeholder = i18next.t('search.placeholder');
}

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
            // ЖЕСТКО сохраняем язык перед перерисовкой, чтобы UAH сработало
            localStorage.setItem('nisha_lang', lng); 
            
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
                        console.log('[PWA] Найдено обновление! Тихо чистим кэш...');
                        // Без вопросов чистим кэш и моментально перезагружаем страницу
                        caches.keys().then(names => {
                            for (let name of names) caches.delete(name);
                        }).then(() => {
                            window.location.reload(true);
                        });
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

    // Запускаем печатную машинку для поиска
    currentSearchLang = i18next.language || 'ru';
    startSearchTypewriter();
}

function startSearchTypewriter() {
    const searchInput = document.getElementById('mainSearch');
    if (!searchInput) return;

    if (searchTypewriterInterval) clearInterval(searchTypewriterInterval);

    // Словари для анимации (Только один текст "Поиск вещи...")
    const prefixes = {
        'ua': '',
        'ru': '',
        'en': ''
    };
    
    // Переводы фразы "Поиск вещи..."
    const translatedWords = {
        'ua': ['Пошук речі...'],
        'ru': ['Поиск вещи...'],
        'en': ['Search items...']
    };
    
    const words = translatedWords[currentSearchLang] || translatedWords['ru'];
    const prefix = ''; // Префикс больше не нужен
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    searchTypewriterInterval = setInterval(() => {
        // Если фокус в инпуте или юзер что-то написал - останавливаем анимацию
        if (document.activeElement === searchInput || searchInput.value.length > 0) {
            searchInput.placeholder = prefix + '...';
            return;
        }

        const currentWord = words[wordIndex];

        if (isDeleting) {
            charIndex--;
        } else {
            charIndex++;
        }

        searchInput.placeholder = prefix + currentWord.substring(0, charIndex) + '|';

        // Логика паузы и переключения слов
        if (!isDeleting && charIndex === currentWord.length) {
            isDeleting = true;
            clearInterval(searchTypewriterInterval);
            setTimeout(startSearchTypewriter, 1500); // Пауза в конце слова
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
        }
    }, 100); // Скорость печати
}


function changeLanguage(lng) {
    if (typeof i18next !== 'undefined') {
        i18next.changeLanguage(lng).then(() => {
            updateContentLanguage();
            const msg = i18next.t('messages.lang_changed') + ' [' + lng.toUpperCase() + ']';
            showToast(msg, 'success');
            
            // --- СИНХРОНИЗАЦИЯ ЯЗЫКА С БАЗОЙ ---
            if (currentUser && _supabase) {
                _supabase.from('profiles').update({ language: lng }).eq('id', currentUser.id).then();
            }
        });
    }
}
const lenis = new Lenis({
    lerp: 0.1, 
    wheelMultiplier: 1, 
    smoothWheel: true,
    smoothTouch: false, 
    syncTouch: false    // <--- СТАВИМ FALSE! Это уберет "тугость" и дребезжание на телефонах
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Открытие нового модального окна профиля
function openProfileModal() {
    if (typeof lenis !== 'undefined') lenis.stop();
    document.getElementById('profileModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Умная кнопка [+] Предложки (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
let fabTimeout;
let lastScrollY = window.scrollY;
let isTicking = false; // Защита от перегрузки процессора при скролле

window.addEventListener('scroll', () => {
    if (!isTicking) {
        window.requestAnimationFrame(() => {
            const fab = document.querySelector('.fab-propose');
            if (fab && !fab.classList.contains('cart-active')) {
                const currentScrollY = window.scrollY;
                
                // Если скроллим вниз
                if (currentScrollY > lastScrollY && currentScrollY > 50) {
                    fab.classList.add('hidden-scroll');
                    clearTimeout(fabTimeout);
                } else {
                    // Скроллим вверх
                    fab.classList.remove('hidden-scroll');
                }
                
                lastScrollY = currentScrollY;

                // Возвращаем кнопку при остановке скролла
                clearTimeout(fabTimeout);
                fabTimeout = setTimeout(() => {
                    fab.classList.remove('hidden-scroll');
                }, 400);
            }
            isTicking = false;
        });
        isTicking = true;
    }
}, { passive: true });


let allItems = []; 
// Умное определение валюты (жестко читаем из памяти)
function getCurrency() {
    const lang = localStorage.getItem('nisha_lang') || 'ru';
    return lang === 'en' ? 'UAH' : 'грн';
}
let currentUser = null;
let userProfile = null;
let favorites = [];
let cart = JSON.parse(localStorage.getItem('nisha_cart') || '[]');
let currentCategory = '';
let currentBrand = '';
let showingOnlyFavs = false;
let currentOpenedItem = null;
let isHacked = false; 
let _supabase = null;
let clientFingerprint = "guest_" + Date.now(); 

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
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function showToast(message, type = 'success', imgUrl = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Если передали картинку — добавляем её слева от текста
    let html = '';
    if (imgUrl) {
        html += `<div style="width: 35px; height: 35px; background-image: url('${imgUrl}'); background-size: cover; background-position: center; border-radius: 4px; border: 1px solid #444; flex-shrink: 0;"></div>`;
    }
    html += `<div>${message}</div>`;
    
    toast.innerHTML = html;
    container.appendChild(toast);
    
    // 2500 миллисекунд (2.5 секунды) + 500мс на саму анимацию затухания
    setTimeout(() => { 
        if(container.contains(toast)) container.removeChild(toast); 
    }, 3000);
}

// --- КРУТЫЕ ТЕРМИНАЛЬНЫЕ ОКНА ДЛЯ УВЕДОМЛЕНИЙ ---
function showTerminalModal(title, htmlText, btnText, callback) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(5px); z-index: 10000; display: flex; justify-content: center; align-items: center; flex-direction: column;";
    
    overlay.innerHTML = `
        <div class="success-terminal-box">
            <div class="success-title typewriter">${title}</div>
            <div class="success-divider"></div>
            <div class="success-text" style="margin-bottom: 20px; color: #ddd; text-align: left;">${htmlText}</div>
            <button class="cart-checkout-btn btn-target" style="width: 100%; padding: 15px;">${btnText}</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const btn = overlay.querySelector('button');
    btn.addEventListener('click', () => {
        overlay.remove();
        if (callback) callback();
    });
}

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
    if (typeof lenis !== 'undefined') lenis.start(); 
    showToast(i18next.t('messages.rules_accepted'), 'success');
    
    // Запускаем тур сразу после закрытия окна правил
    setTimeout(startOnboardingTour, 400); 
}
window.onload = async () => {
     document.body.classList.remove('search-lock');
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
            document.addEventListener("visibilitychange", async () => {
                if (document.hidden) {
                    // Юзер свернул сайт (ушел в TikTok)
                    if (cart.length > 0 && typeof Push !== 'undefined') {
                        Push.create("NISHA STORE", {
                            body: "Ваша корзина ждет! Оформляйте, пока не забрали.",
                            icon: '/icon.ico',
                            timeout: 5000,
                            onClick: function () { window.focus(); this.close(); }
                        });
                    }
                } else {
                    // ЮЗЕР ВЕРНУЛСЯ НА САЙТ!
                    if (_supabase) {
                        // ЖЕСТКОЕ ВОССТАНОВЛЕНИЕ СЕССИИ (чтобы не разлогинивало после глубокого сна браузера)
                        await checkSession();
                        
                        // Только после проверки сессии тихо обновляем базу товаров
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
        
        
        if (typeof lottie !== 'undefined' && document.getElementById('lottie-box')) {
            lottie.loadAnimation({
                container: document.getElementById('lottie-box'),
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: 'https://lottie.host/80c43ca5-5dc1-477c-ab0f-b47209e9db6b/rY8Vz5P1t8.json' 
            });
        }
        
        if (_supabase) {
            await checkSession();
            const urlParams = new URLSearchParams(window.location.search);
            
            // Восстанавливаем вкладку "Избранное"
            if (sessionStorage.getItem('nisha_showing_favs') === 'true') {
                showingOnlyFavs = true;
                const favNav = document.getElementById('favNav');
                if (favNav) favNav.style.color = '#fff';
            }

            // Восстанавливаем категорию (из URL или из сохраненной памяти)
            const savedCat = urlParams.get('cat') || sessionStorage.getItem('nisha_last_category');
            if (savedCat) {
                currentCategory = savedCat;
                const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
                
                // Очищаем старые выделения
                catLinks.forEach(el => el.classList.remove('active-filter'));
                
                // Находим нужную ссылку и выделяем
                catLinks.forEach(link => {
                    // Используем атрибут data-i18n, чтобы не зависеть от языка и символов [>]
                    // Извлекаем текст из onclick атрибута: setCategoryFilter('Штаны и Джинсы', this)
                    const onclickText = link.getAttribute('onclick') || '';
                    if (onclickText.includes(`'${currentCategory}'`)) {
                        link.classList.add('active-filter');
                    }
                });
            } else {
                // Если ничего не сохранено - выделяем первую ссылку ("Все вещи")
                const firstLink = document.querySelector('.sidebar .filter-list:first-of-type a');
                if (firstLink) firstLink.classList.add('active-filter');
            }

            if (urlParams.has('q')) {
                const sInput = document.getElementById('mainSearch');
                if (sInput) sInput.value = urlParams.get('q');
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
                                showTerminalModal('SYSTEM_BROADCAST.MSG', broadcastContent, '[ ЗАКРЫТЬ ]', markAsSeen);
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
                    showTerminalModal('SYSTEM_BROADCAST.MSG', bHtml, '[ ЗАКРЫТЬ ]', () => {
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
                        if (index !== -1) {
                            allItems[index] = updatedItem;
                            // АВТО-УДАЛЕНИЕ ИЗ КОРЗИНЫ: Если вещь стала available (cron-job снял бронь 15 минут)
                        if (updatedItem.status === 'available') {
                            const cartIdx = cart.findIndex(c => c.id === updatedItem.id);
                            if (cartIdx !== -1) {
                                cart.splice(cartIdx, 1);
                                localStorage.setItem('nisha_cart', JSON.stringify(cart));
                                syncCartToServer();
                                updateCartUI();
                                showToast(`Время брони (15 мин) вышло. ${updatedItem.name} удалена из корзины.`, 'error');
                            }
                        }
                        }
                        
                        const card = document.querySelector(`.item-card[data-id="${updatedItem.id}"]`);
                        if (card) {
                            const oldBadges = card.querySelectorAll('.sold-badge, .reserved-badge');
                            oldBadges.forEach(b => b.remove());
                            card.classList.remove('sold-out', 'reserved-item');

                            if (updatedItem.status === 'sold') {
                                card.classList.add('sold-out');
                                card.insertAdjacentHTML('afterbegin', '<div class="sold-badge">SOLD</div>');
                                showToast(`Только что забрали: ${updatedItem.name}`, 'error');
                            } else if (updatedItem.status === 'reserved') {
                                card.classList.add('reserved-item');
                                card.insertAdjacentHTML('afterbegin', '<div class="reserved-badge">RESERVED</div>');
                            }
                            
                            if (currentOpenedItem && currentOpenedItem.id === updatedItem.id && updatedItem.status === 'sold') {
                                const cartBtn = document.getElementById('modalCartBtn');
                                const waitBtn = document.getElementById('modalWaitlistBtn');
                                if(cartBtn) cartBtn.style.display = 'none';
                                if(waitBtn) waitBtn.style.display = 'block';
                            }
                        }
                    }
                })
                .subscribe();
        } else {
            document.getElementById('itemsGrid').innerHTML = `<div style="color:red; padding:20px; text-align:center;">[ БД НЕ ПОДКЛЮЧЕНА ]</div>`;
        }
        
       // --- БЕСКОНЕЧНАЯ ПРОКРУТКА (Infinite Scroll) ---
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                // Если доскроллили до триггера и есть еще товары — рендерим следующую пачку
                if (renderedCount < filteredItems.length) {
                    renderNextBatch();
                }
            }
        }, { rootMargin: "300px" }); 
        
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

    } catch (err) {
       
        console.error("ОШИБКА ИНИЦИАЛИЗАЦИИ ПРИЛОЖЕНИЯ:", err);
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            grid.innerHTML = `<div style="color:red; text-align:center; padding:40px; grid-column:1/-1;">[ СИСТЕМНАЯ ОШИБКА: ${err.message} ]</div>`;
        }
    }
};

// Идеально плавное закрытие по крестику
function closeModal(id) { 
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const win = modal.querySelector('.modal-window');
    
    if (win) {
        win.style.animation = 'none';
        win.offsetHeight; 

        win.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease';
        if (window.innerWidth > 900) {
            win.style.transform = 'scale(0.95) translateY(20px)'; 
        } else {
            win.style.transform = 'translateY(100vh)'; 
        }
        win.style.opacity = '0';
    }

    modal.style.transition = 'background-color 0.3s ease, opacity 0.3s ease';
    modal.style.backgroundColor = 'transparent';
    modal.style.opacity = '0';
    
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; 
        if (typeof lenis !== 'undefined') lenis.start(); 
        
        if (win) {
            win.style.transform = '';
            win.style.opacity = '';
            win.style.transition = '';
            win.style.animation = ''; // <--- ВОТ ТУТ МЫ ВОЗВРАЩАЕМ АНИМАЦИЮ
        }
        modal.style.opacity = '';
        modal.style.transition = '';
        modal.style.backgroundColor = '';
        
        if (id === 'productModal') renderHistory(); 
    }, 300);
}

async function openReviewsModal() { 
    const modal = document.getElementById('reviewsModal');
    modal.style.display = 'flex'; 
    document.body.style.overflow = 'hidden'; 
    if (typeof lenis !== 'undefined') lenis.stop(); 
    
    const container = document.getElementById('reviewsContainerList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; color: var(--accent-green); font-family: var(--font-mono); padding: 40px 20px;">[ ЗАГРУЗКА ОТЗЫВОВ... ]</div>';
    
    const { data, error } = await _supabase.from('reviews').select('*').eq('is_published', true).order('created_at', { ascending: false });
    
    if (error || !data || data.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #555; font-family: var(--font-mono); padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a;">[ ${i18next.t('reviews_modal.empty_reviews', { defaultValue: 'В ДАННЫЙ МОМЕНТ ОТЗЫВЫ ОТСУТСТВУЮТ' })} ]</div>`;
        return;
    }
    
    let html = '';
    data.forEach(rev => {
        const date = new Date(rev.created_at).toLocaleDateString('ru-RU');
        
        // Если есть картинка - рисуем красивый квадрат справа. Делаем кликабельным, если есть item_id
        const cursorStyle = rev.item_id ? 'cursor: pointer;' : '';
        const clickAction = rev.item_id ? `onclick="openProductModalById('${rev.item_id}')"` : '';
        
        const imgHtml = rev.item_image ? `<div ${clickAction} style="width: 45px; height: 45px; border-radius: 4px; border: 1px solid #333; background-image: url('${rev.item_image}'); background-size: cover; background-position: center; flex-shrink: 0; box-shadow: 0 0 10px rgba(0,255,0,0.1); ${cursorStyle}"></div>` : '';
        
        html += `
        <div class="review-card-ui">
            <div class="review-head" style="align-items: flex-start; justify-content: space-between; display: flex;">
                <div style="display: flex; flex-direction: column;">
                    <span class="review-name" style="color: #fff; font-weight: bold; font-family: var(--font-main); font-size: 14px;">@${rev.user_name}</span>
                    <div class="review-date" style="text-align: left; margin-top: 4px; color: #555; font-size: 11px; font-family: var(--font-mono);">${date}</div>
                </div>
                ${imgHtml}
            </div>
            <div class="review-text-body" style="margin-top: 10px; color: #ccc; font-size: 13px; line-height: 1.5; font-style: italic;">${rev.text}</div>
        </div>`;
    });
    
    container.innerHTML = html;
}


document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
        if (this.id === 'rulesModal') return; 
        if (e.target === this) { 
            closeModal(this.id); 
        }
    });
});


document.querySelectorAll('.modal-window, .orders-container').forEach(el => {
    el.setAttribute('data-lenis-prevent', 'true');
});

async function checkSession() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        
        if (session) {
            currentUser = session.user;
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
            
           // --- УВЕДОМЛЕНИЯ О СТАТУСЕ ЗАКАЗА В РЕАЛЬНОМ ВРЕМЕНИ ---
            _supabase.channel('order-status-updates')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'orders',
                    filter: `user_id=eq.${currentUser.id}` 
                }, payload => {
                    const newStatus = payload.new.status;
                    if (newStatus !== payload.old.status) {
                        // Показываем зеленый ТОСТ сверху
                        showToast(`Заказ #${payload.new.id.split('-')[0].toUpperCase()}: ${newStatus.toUpperCase()}`, 'success');
                        
                        // И показываем большое окно
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

            await loadFavorites();
           
            
          // --- УМНОЕ ВОССТАНОВЛЕНИЕ БРОШЕННОЙ КОРЗИНЫ ---
            if (userProfile && userProfile.cart && userProfile.cart.length > 0) {
                const dbCart = userProfile.cart;
                
                // Если текущая локальная корзина пуста — просто берем из БД
                if (cart.length === 0) {
                    cart = dbCart;
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
            userProfile = null;
            favorites = [];
            
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

function openProfileModal() {
    if (typeof lenis !== 'undefined') lenis.stop();
    document.getElementById('profileModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

async function logout() {
    await _supabase.auth.signOut();
    showToast(i18next.t('messages.logout'), 'success');
    
    
    showingOnlyFavs = false; 
    if(document.getElementById('favNav')) document.getElementById('favNav').style.color = 'var(--accent-yellow)';
    
    await checkSession();
    applyFilters(); 
}


let renderedCount = 0;
let filteredItems = [];

// Было
function getOptimizedImageUrl(item, wantsThumb = false) {
    if (!item) return '';
    if (wantsThumb && item.thumbnails && item.thumbnails.length > 0) {
        return item.thumbnails[0];
    }
    return (item.images && item.images.length > 0) ? item.images[0] : '';
}

// СТАЛО: Заменяем домен Supabase на наш локальный прокси
function getOptimizedImageUrl(item, wantsThumb = false) {
    if (!item) return '';
    
    let url = '';
    if (wantsThumb && item.thumbnails && item.thumbnails.length > 0) {
        url = item.thumbnails[0];
    } else {
        url = (item.images && item.images.length > 0) ? item.images[0] : '';
    }
    
    // Подменяем прямой линк на наш CDN-роут
    if (url && url.includes('supabase.co')) {
        return url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co/storage/v1/object/public/items-images', '/cdn-images');
    }
    return url;
}

async function loadAllItems() {
    const grid = document.getElementById('itemsGrid');
    
    // 1. МГНОВЕННАЯ ЗАГРУЗКА (Достаем базу из кэша телефона, если она там есть)
    const cachedData = localStorage.getItem('nisha_cached_db');
    if (cachedData && allItems.length === 0) {
        try {
            allItems = JSON.parse(cachedData);
            applyFilters(); // Отрисовываем сетку за 0.1 сек, юзер ничего не ждет!
        } catch(e) { console.error("Ошибка чтения кэша"); }
    }

    // Если кэша нет (юзер зашел первый раз), оставляем крутиться Win95 Loader из HTML
    
    // 2. ФОНОВЫЙ ЗАПРОС К БД (Тихо проверяем, есть ли новые вещи)
    const { data, error } = await _supabase.from('items').select('*').order('created_at', { ascending: false });
    
    if (error) { 
        if (allItems.length === 0 && grid) grid.innerHTML = `<div style="color:red; padding:20px; grid-column: 1/-1;">[ ОШИБКА БД: ${error.message} ]</div>`;
        return; 
    }
    
    // Проверяем, изменились ли данные по сравнению с кэшем
    const isChanged = JSON.stringify(data) !== JSON.stringify(allItems);
    
    allItems = data;
    localStorage.setItem('nisha_cached_db', JSON.stringify(data)); // Сохраняем свежую базу в память
    
    // --- СИНХРОНИЗАЦИЯ ИСТОРИИ ПРОСМОТРОВ ИЗ БД ---
    if (userProfile && userProfile.viewed_history && userProfile.viewed_history.length > 0) {
        let dbHistory = [];
        userProfile.viewed_history.forEach(uuid => {
            const histItem = allItems.find(i => i.id === uuid);
            if (histItem) {
                const img = (histItem.images && histItem.images.length > 0) ? histItem.images[0] : '';
                dbHistory.push({ id: histItem.id, name: histItem.name, price: histItem.price, img: img });
            }
        });
        if (dbHistory.length > 0) {
            localStorage.setItem('nisha_history', JSON.stringify(dbHistory));
        }
    }

    // ФИКС КОРЗИНЫ: Если товар удалили из БД, тихо убираем его из локальной корзины юзера
    const validCart = cart.filter(cItem => allItems.some(dbItem => dbItem.id === cItem.id));
    if (validCart.length !== cart.length) {
        cart = validCart;
        localStorage.setItem('nisha_cart', JSON.stringify(cart));
        updateCartUI();
    }

    // 3. ПЕРЕРИСОВКА: Делаем ее ТОЛЬКО если это первый заход, ИЛИ если данные реально поменялись (чтобы экран не моргал просто так)
    if (!cachedData || isChanged) {
        applyFilters();
    }
}

// --- ОБНОВЛЕНИЕ КРАСНЫХ СЧЕТЧИКОВ В БОКОВОМ МЕНЮ ---
function updateSidebarCounters() {
    // Считаем категории (только доступные товары)
    const availableItemsAll = allItems.filter(i => i.status === 'available');
    const catCounts = { 'Все вещи': availableItemsAll.length };
    availableItemsAll.forEach(item => {
        if (!item) return;
        const c = item.category || 'Без категории';
        catCounts[c] = (catCounts[c] || 0) + 1;
    });

    // Обновляем HTML категорий
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(link => {
        // Убираем старый счетчик (если был)
        let baseText = link.innerHTML.split('<span')[0].trim();
        
        // Определяем, какая это категория
        let catName = '';
        if (baseText.includes('Все вещи')) catName = 'Все вещи';
        else if (baseText.includes('Верхняя одежда')) catName = 'Верхняя одежда';
        else if (baseText.includes('Кофты и Свитера')) catName = 'Кофты и Свитера';
        else if (baseText.includes('Штаны и Джинсы')) catName = 'Штаны и Джинсы';
        else if (baseText.includes('Обувь')) catName = 'Обувь';
        else if (baseText.includes('Аксессуары')) catName = 'Аксессуары';

        const count = catCounts[catName] || 0;
        
        // Рисуем стильный красный счетчик (скрываем, если 0)
        if (count > 0) {
            link.innerHTML = `${baseText} <span style="color:#ff3333; font-weight:bold; font-family:var(--font-mono); font-size:11px;">(${count})</span>`;
        } else {
            link.innerHTML = baseText;
        }
    });

    // Считаем размеры (только для ТЕКУЩЕЙ выбранной категории и ТОЛЬКО ДОСТУПНЫЕ)
    const sizeCounts = {};
    allItems.forEach(item => {
        if (!item || item.status !== 'available') return;
        if (currentCategory !== '' && item.category !== currentCategory) return; // Умный подсчет
        const s = item.size || '-';
        sizeCounts[s] = (sizeCounts[s] || 0) + 1;
    });

    // Обновляем HTML размеров
    document.querySelectorAll('.size-cb').forEach(cb => {
        const labelSpan = cb.nextElementSibling;
        let baseText = labelSpan.innerHTML.split('<span')[0].trim();
        const sizeVal = cb.value;
        const count = sizeCounts[sizeVal] || 0;

        if (count > 0) {
            labelSpan.innerHTML = `${baseText} <span style="color:#ff3333; font-weight:bold; font-family:var(--font-mono); font-size:11px;">(${count})</span>`;
            cb.parentElement.style.opacity = '1';
            cb.disabled = false;
        } else {
            labelSpan.innerHTML = baseText;
            cb.parentElement.style.opacity = '0.4'; // Делаем полупрозрачным, если размера нет
            cb.disabled = true; // Блокируем галочку
            cb.checked = false; // Снимаем галочку, если была
        }
    });
}
let itemsPageSize = 12; 
function applyFilters() {
    const grid = document.getElementById('itemsGrid');
    
    
    if (grid) grid.classList.add('fade-out');

    setTimeout(() => {
        try {
            const searchInput = document.getElementById('mainSearch');
            const searchTerm = searchInput ? searchInput.value.trim() : '';
            const checkedSizes = Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => cb.value);
            
            // Читаем нашу новую галочку
            const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
            
            let sortedItems = [...allItems];
            
            const sortCheap = document.getElementById('sort-cheap');
            if (sortCheap && sortCheap.classList.contains('active-sort')) {
                // Оставляем ТОЛЬКО те товары, цена которых 500 грн или ниже
                sortedItems = sortedItems.filter(item => {
                    let price = Number(item.price) || 0;
                    let finalPrice = isHacked ? price * 0.9 : price;
                    return finalPrice <= 500;
                });
                
                // На всякий случай сортируем их от самых дешевых к 500
                sortedItems.sort((a, b) => {
                    let pA = Number(a.price) || 0;
                    let pB = Number(b.price) || 0;
                    return (isHacked ? pA * 0.9 : pA) - (isHacked ? pB * 0.9 : pB);
                });
            }

            if (searchTerm !== '' && typeof Fuse !== 'undefined') {
                // Жесткая очистка: убираем решетку и переводим в нижний регистр для точного совпадения
                const cleanSearchTerm = searchTerm.replace(/#/g, '').trim().toLowerCase();
                
                const fuseOptions = {
                    includeScore: true, 
                    threshold: 0.4, // Сделали чуть мягче, чтобы прощал опечатки в брендах
                    ignoreLocation: true,
                    useExtendedSearch: true, 
                    keys: [
                        { name: 'tags', weight: 1.0 }, 
                        { name: 'brand', weight: 0.8 }, // Повысили приоритет бренда
                        { name: 'name', weight: 0.8 }, 
                        { name: 'size', weight: 0.8 },  // ДОБАВИЛИ ПОИСК ПО РАЗМЕРУ
                        { name: 'category', weight: 0.2 }
                    ]
                };
                const fuse = new Fuse(sortedItems, fuseOptions);
                const fuseResults = fuse.search(cleanSearchTerm);
                sortedItems = fuseResults.map(result => result.item);
            }

            const minInput = document.getElementById('priceMin');
            const maxInput = document.getElementById('priceMax');
            const minPrice = minInput ? parseInt(minInput.value) : 0;
            const maxPrice = maxInput ? parseInt(maxInput.value) : 15000;

            filteredItems = sortedItems.filter(item => {
                if (!item) return false;
                const itemCategory = item.category || '';
                const itemBrand = item.brand ? item.brand.toLowerCase() : '';
                const itemSize = item.size || '';
                const searchBrand = currentBrand ? currentBrand.toLowerCase() : '';
                
                const matchesCategory = currentCategory === '' || itemCategory === currentCategory;
                const matchesBrand = searchBrand === '' || itemBrand.includes(searchBrand);
                const matchesSize = checkedSizes.length === 0 || checkedSizes.includes(itemSize);
                const isFav = favorites.includes(item.id);
                const matchesFav = !showingOnlyFavs || isFav;
                
                const itemFinalPrice = isHacked ? Math.floor((Number(item.price)||0) * 0.9) : (Number(item.price)||0);
                const matchesPrice = itemFinalPrice >= minPrice && itemFinalPrice <= maxPrice;
                
                // Проверяем: если галочка нажата, оставляем ТОЛЬКО 'available'
                const matchesAvailability = !hideUnavailable || item.status === 'available';
                
                return matchesCategory && matchesBrand && matchesSize && matchesFav && matchesPrice && matchesAvailability;
            });
            
            if (grid) grid.innerHTML = ''; 
            renderedCount = 0; // Сброс для телефона
            window.currentPage = 1; // Сброс для ПК
            window.currentPage = 1; // Сбрасываем на первую страницу при любом поиске 
            
            const countEl = document.getElementById('itemCount');
            if (countEl) {
                // Считаем только доступные вещи (исключаем проданные и забронированные)
                const availableItems = filteredItems.filter(item => item.status === 'available');
                countEl.innerText = availableItems.length;
            }

            if (filteredItems.length === 0) {
                if (grid) grid.innerHTML = `<div style="color: #666; font-family: monospace; padding: 30px; grid-column: 1/-1; text-align:center;">[ ТОВАРОВ НЕ НАЙДЕНО ]</div>`;
                const trigger = document.getElementById('loadingTrigger');
                if(trigger) trigger.innerText = '';
            } else {
                renderNextBatch(); 
            }
            // Сохраняем состояние в URL (без перезагрузки)
            const url = new URL(window.location);
            if (currentCategory) url.searchParams.set('cat', currentCategory);
            else url.searchParams.delete('cat');
            if (searchTerm) url.searchParams.set('q', searchTerm);
            else url.searchParams.delete('q');
            window.history.replaceState(null, '', url);

            // === ОБНОВЛЯЕМ ЦИФРЫ В САЙДБАРЕ ===
            updateSidebarCounters();
            
           if (grid) {
                // Небольшая задержка, чтобы браузер успел отрисовать карточки без фризов
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        grid.classList.remove('fade-out');
                    });
                }, 50);
            }
        } catch (err) {
            console.error("ОШИБКА ФИЛЬТРАЦИИ:", err);
            if (grid) grid.innerHTML = `<div style="color:red; grid-column:1/-1; padding:20px; text-align:center;">[ ОШИБКА РЕНДЕРА: ${err.message} ]</div>`;
            if (grid) grid.classList.remove('fade-out');
        }
    }, 300); 
}
// --- УМНЫЙ ПЛЕЕР ДЛЯ ВИДЕО В СЕТКЕ (БЕРЕЖЕТ БАТАРЕЮ) ---
const gridVideoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
            // Видео появилось на экране — запускаем
            video.play().catch(() => {}); 
        } else {
            // Видео ушло за экран — жесткая пауза (Экономия батареи и ОЗУ)
            video.pause(); 
        }
    });
}, { rootMargin: "50px" }); // Начинает грузить чуть заранее
window.currentPage = 1;

window.currentPage = 1;

window.changePage = function(step) {
    window.currentPage += step;
    const grid = document.getElementById('itemsGrid');
    
    if (grid) {
        grid.style.opacity = '0';
        grid.style.transform = 'translateY(10px)';
    }

    setTimeout(() => {
        renderNextBatch(); 
        
        const sortingEl = document.querySelector('.sorting');
        if (sortingEl) {
            const y = sortingEl.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
        
        if (grid) {
            grid.style.opacity = '1';
            grid.style.transform = 'translateY(0)';
        }
    }, 300);
};

window.currentPage = 1;

window.changePage = function(step) {
    window.currentPage += step;
    const grid = document.getElementById('itemsGrid');
    
    if (grid) {
        grid.style.opacity = '0';
        grid.style.transform = 'translateY(10px)';
    }

    setTimeout(() => {
        renderNextBatch(); 
        
        const sortingEl = document.querySelector('.sorting');
        if (sortingEl) {
            const y = sortingEl.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
        
        if (grid) {
            grid.style.opacity = '1';
            grid.style.transform = 'translateY(0)';
        }
    }, 300);
};

function renderNextBatch() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;
    
    // ПРОВЕРЯЕМ УСТРОЙСТВО
    const isMobile = window.innerWidth <= 900;
    
    // Удаляем старую плашку пагинации, если она была
    let oldPagination = document.getElementById('mainPagination');
    if (oldPagination) oldPagination.remove();

    let startIndex = 0;
    let endIndex = 0;

    if (isMobile) {
        // --- НА МОБИЛКЕ: ГРУЗИМ ВСЕ ТОВАРЫ СРАЗУ ---
        if (renderedCount === 0) grid.innerHTML = ''; 
        startIndex = renderedCount;
        endIndex = filteredItems.length; 
    } else {
        // --- НА ПК: СТРОГАЯ ПАГИНАЦИЯ ПО 12 ШТУК ---
        grid.innerHTML = ''; 
        startIndex = (window.currentPage - 1) * itemsPageSize; 
        endIndex = Math.min(startIndex + itemsPageSize, filteredItems.length);
    }
    
    // Защита от дублей
    if (startIndex >= endIndex) return;
    
    let seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
    
    for (let i = startIndex; i < endIndex; i++) {
        try {
            const item = filteredItems[i];
            if (!item) continue;
            
            let badgeHTML = '';
            if (item.status === 'sold') {
                badgeHTML = '<div class="sold-badge">SOLD</div>';
            } else if (item.status === 'reserved') {
                badgeHTML = '<div class="reserved-badge">RESERVED</div>';
            } else {
                const hasSale = item.is_sale;
                const hasHot = (item.views_count || 0) >= 25;

                if (hasSale || hasHot) {
                    badgeHTML = `<div class="system-status-bar">`;
                    if (hasSale) badgeHTML += `<span class="status-item status-sale">% SALE</span>`;
                    if (hasSale && hasHot) badgeHTML += `<div class="status-divider"></div>`;
                    if (hasHot) {
                        const chartSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
                        badgeHTML += `<span class="status-item status-hot">${chartSvg} HOT</span>`;
                    }
                    badgeHTML += `</div>`;
                }
            }

            const thumbsArray = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails : (item.images && item.images.length > 0 ? item.images : []);
            let slidesStr = '';
            let dotsStr = '';

            thumbsArray.forEach((thumbUrl, idx) => {
                const isVid = item.images && item.images[idx] && item.images[idx].endsWith('.mp4');
                if (isVid) {
                    slidesStr += `<div class="card-slide" style="background: #0a0a0a;"><video class="grid-lazy-video" src="${item.images[idx]}#t=0.001" muted loop playsinline preload="metadata" style="width:100%; height:100%; object-fit:cover; pointer-events:none;"></video></div>`;
                } else {
                    slidesStr += `<div class="card-slide" style="background-image: url('${thumbUrl}');"></div>`;
                }
                dotsStr += `<div class="card-dot ${idx === 0 ? 'active' : ''}"></div>`;
            });

            const starClass = favorites.includes(item.id) ? 'fav-star active' : 'fav-star';
            const isUnseen = !seenItemsIds.includes(item.id) && item.status === 'available';
            const pulseClass = isUnseen ? 'unseen-pulse' : '';

            const card = document.createElement('div');
            card.className = `item-card ${item.status !== 'available' ? 'sold-out' : ''} ${pulseClass}`;
            card.setAttribute('data-id', item.id);
            
            let priceHTML = '';
            const curr = getCurrency();
            if (item.is_sale && item.old_price) {
                priceHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 14px; margin-right: 8px;">${item.old_price} ${curr}</span><span style="color: var(--accent-green);">${item.price} ${curr}</span>`;
            } else {
                priceHTML = `<span style="color: var(--accent-green);">${item.price} ${curr}</span>`;
            }

            let controlsHTML = '';
            if (thumbsArray.length > 1) {
                controlsHTML = `
                    <div class="grid-slider-btn prev" onclick="scrollGridSlider(event, '${item.id}', -1)">&#10094;</div>
                    <div class="grid-slider-btn next" onclick="scrollGridSlider(event, '${item.id}', 1)">&#10095;</div>
                    <div class="card-dots-container" id="dots-${item.id}">${dotsStr}</div>
                `;
            }

            card.innerHTML = `
                ${badgeHTML}
                <div class="${starClass}" onclick="toggleFav(event, '${item.id}')">★</div>
                <div class="card-slider-wrapper">
                    <div class="card-slider-container" id="slider-${item.id}" onscroll="updateCardDots(this, '${item.id}')">
                        ${slidesStr}
                    </div>
                    ${controlsHTML}
                </div>
                <div class="item-info" onclick="openProductModalById('${item.id}')">
                    <h3 class="item-title">${item.name}</h3>
                    <div class="item-price">${priceHTML}</div>
                    <div class="item-size"><span data-i18n="grid.size_prefix">${i18next.t('grid.size_prefix')}</span>${item.size}</div>
                    <div class="item-footer"><span>${item.brand}</span><span>${item.condition}</span></div>
                </div>
<button class="grid-cart-btn" data-i18n="product.add_to_cart" style="${item.status === 'sold' ? 'display:none;' : ''}" onclick="addToCartWithAnimation('${item.id}', this, event)">${i18next.t('product.add_to_cart')}</button>
            `;

            const sliderWrapper = card.querySelector('.card-slider-wrapper');
            let isDraggingSlider = false;
            let startX = 0; let startY = 0;
            
            sliderWrapper.addEventListener('touchstart', (e) => { 
                isDraggingSlider = false; 
                startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            }, {passive: true});
            
            sliderWrapper.addEventListener('touchmove', (e) => { 
                if(Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10) isDraggingSlider = true;
            }, {passive: true});
            
            sliderWrapper.addEventListener('click', (e) => {
                if (isDraggingSlider) { e.preventDefault(); e.stopPropagation(); } 
                else { openProductModalById(item.id); }
            });

            grid.appendChild(card);
            const vids = card.querySelectorAll('.grid-lazy-video');
            vids.forEach(v => gridVideoObserver.observe(v));

        } catch (err) { console.error(err); }
    }

    // --- ФИНАЛИЗАЦИЯ И СТРАХОВКА ---
    if (isMobile) {
        renderedCount = endIndex;
    } else {
        // ЖЕСТКАЯ ЗАЩИТА: На ПК говорим старому "скроллеру", что загружено всё, чтобы он не вмешивался.
        renderedCount = filteredItems.length; 
        
        // Рисуем панель пагинации
        const totalPages = Math.ceil(filteredItems.length / itemsPageSize);
        if (totalPages > 1) {
            const paginationWrap = document.createElement('div');
            paginationWrap.id = 'mainPagination';
            paginationWrap.className = 'pagination-wrapper';
            
            const prevDisabled = window.currentPage === 1 ? 'disabled' : '';
            const nextDisabled = window.currentPage === totalPages ? 'disabled' : '';

            paginationWrap.innerHTML = `
                <button class="page-arrow" onclick="changePage(-1)" ${prevDisabled}>&#10094;</button>
                <div class="page-numbers">[ СТРАНИЦА <span style="color:var(--accent-green); font-weight:bold;">${window.currentPage}</span> ИЗ ${totalPages} ]</div>
                <button class="page-arrow" onclick="changePage(1)" ${nextDisabled}>&#10095;</button>
            `;
            grid.parentNode.insertBefore(paginationWrap, grid.nextSibling);
        }
    }
}

function startOnboardingTour() {
    // ЖЕСТКАЯ ЗАЩИТА: Не запускаем тур, если есть хоть одно открытое модальное окно,
    // или если мы не в самом верху ленты, или если тур уже пройден.
    
    // Проверяем, есть ли элементы со стилем display: flex (значит они открыты)
    const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some(el => {
        return window.getComputedStyle(el).display === 'flex';
    });
    
    if (!localStorage.getItem('nisha_rules_accepted') || 
        localStorage.getItem('nisha_tour_done') || 
        anyModalOpen || 
        typeof window.driver === 'undefined') return;
        
    setTimeout(() => {
        // Двойная проверка через 800мс (вдруг окно только-только начало открываться)
        const checkAgain = Array.from(document.querySelectorAll('.modal-overlay')).some(el => {
            return window.getComputedStyle(el).display === 'flex';
        });
        if (checkAgain) return;
        const isMobile = window.innerWidth <= 900;
        const firstStar = document.querySelector('.item-card .fav-star');
        const firstCartBtn = document.querySelector('.item-card .grid-cart-btn');

        let activeSteps = [];
        activeSteps.push({ element: '.search-wrapper', popover: { title: i18next.t('tour.search_title'), description: i18next.t('tour.search_desc') } });

        if (isMobile) {
            activeSteps.push(
                { element: '.mobile-profile-link', popover: { title: i18next.t('tour.prof_title'), description: i18next.t('tour.prof_desc') } },
                { element: '#mobileFilterBtn', popover: { title: i18next.t('tour.filt_title'), description: i18next.t('tour.filt_desc') } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: i18next.t('tour.star_title'), description: i18next.t('tour.star_desc') } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: i18next.t('tour.cartbtn_title'), description: i18next.t('tour.cartbtn_desc') } });
            activeSteps.push({ element: '.fab-propose', popover: { title: i18next.t('tour.prop_title'), description: i18next.t('tour.prop_desc') } });
            activeSteps.push({ element: '#cartInfoWrapper', popover: { title: i18next.t('tour.cart_title'), description: i18next.t('tour.cart_desc') } });
        } else {
            activeSteps.push(
                { element: '#authBox', popover: { title: i18next.t('tour.prof_title'), description: i18next.t('tour.prof_desc') } },
                { element: '.sidebar', popover: { title: i18next.t('tour.filt_title'), description: i18next.t('tour.filt_desc') } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: i18next.t('tour.star_title'), description: i18next.t('tour.star_desc') } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: i18next.t('tour.cartbtn_title'), description: i18next.t('tour.cartbtn_desc') } });
            activeSteps.push({ element: '.fab-propose', popover: { title: i18next.t('tour.prop_title'), description: i18next.t('tour.prop_desc') } });
        }

        const driverObj = window.driver.js.driver({
            showProgress: true,
            nextBtnText: i18next.t('tour.next'),
            prevBtnText: i18next.t('tour.prev'),
            doneBtnText: i18next.t('tour.done'),
            steps: activeSteps,
            onDestroyStarted: () => {
                localStorage.setItem('nisha_tour_done', 'true');
                driverObj.destroy();
                
                // ТУР ЗАКОНЧЕН. Проверяем, не ждет ли нас скрытая рассылка?
                if (window.pendingBroadcastHtml) {
                    setTimeout(() => {
                        showTerminalModal('SYSTEM_BROADCAST.MSG', window.pendingBroadcastHtml, '[ ЗАКРЫТЬ ]', () => {
                            localStorage.setItem('nisha_last_broadcast', window.pendingBroadcastId);
                        });
                        window.pendingBroadcastHtml = null; // Очищаем память
                    }, 600); // Ждем полсекунды после тура, чтобы было красиво
                }
            }
        });
        driverObj.drive();
    }, 800);
}

// Функция добавления в корзину прямо с главной страницы
async function addToCartById(itemId) {
    // --- ПРОВЕРКА НА ГОСТЯ ---
    if (!currentUser) {
        showToast(i18next.t('messages.cart_error_auth'), 'error');
        openProfileModal(); // Автоматически открываем окно входа!
        
        // Если это ПК (нет модалки), то подсвечиваем левое меню
        if (window.innerWidth > 900) {
            const authBox = document.getElementById('authBox');
            if(authBox) {
                authBox.style.boxShadow = "0 0 20px var(--accent-red)";
                setTimeout(() => authBox.style.boxShadow = "none", 2000);
            }
        }
        return;
    }

    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    if (cart.some(i => i.id === item.id)) { 
        showToast(i18next.t('messages.cart_exist'), 'error');
        return; 
    }

    let cartItem = { ...item };
    if (isHacked) {
        cartItem.price = Math.floor(cartItem.price * 0.9);
    }
    cart.push(cartItem);
    
    localStorage.setItem('nisha_cart', JSON.stringify(cart));
    await syncCartToServer();
    // В самом конце функции addToCartById(itemId) перед updateCartUI() добавь:
localStorage.setItem('nisha_cart_time', Date.now());
localStorage.removeItem('nisha_cart_reminded');
    updateCartUI();
    showToast(i18next.t('messages.cart_add'), 'success', getOptimizedImageUrl(item, true));
}

// Изменено для создания DOM элементов вручную (чтобы работал AutoAnimate и Tilt.js)

function sortItems(type) {
    document.getElementById('sort-new').classList.remove('active-sort');
    document.getElementById('sort-cheap').classList.remove('active-sort');
    document.getElementById('sort-' + type).classList.add('active-sort');
    
    // Эффект мигания счетчика
    const countEl = document.getElementById('itemCount');
    if (countEl) {
        countEl.style.opacity = '0';
        setTimeout(() => { countEl.style.opacity = '1'; }, 200);
    }
    
    applyFilters();
}

function setCategoryFilter(cat, element) { 
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(el => el.classList.remove('active-filter'));
    if (element) {
        element.classList.add('active-filter');
    }
    currentCategory = cat; 
    
    
    sessionStorage.setItem('nisha_last_category', cat);
    
    applyFilters(); 
}
// --- АНИМАЦИЯ ПОЛЕТА В КОРЗИНУ ---
function addToCartWithAnimation(itemId, btnElement, event) {
    if (event) event.stopPropagation(); 
    
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    
    // Добавляем в корзину (логика)
    addToCartById(itemId);
    
    const cartIcon = document.getElementById('cartInfoWrapper');
    if (!cartIcon) return; // Убрали багнутую проверку на картинки!

    const btnRect = btnElement.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();

    const flyingImg = document.createElement('div');
    flyingImg.className = 'flying-item';

    // Если фото есть - ставим его. Если нет - ставим темный фон.
   if (item.images && item.images.length > 0) {
        flyingImg.style.backgroundImage = `url('${getOptimizedImageUrl(item, true)}')`;
    } else {
        flyingImg.style.backgroundColor = '#111';
    }

    // Стартовая позиция (ровно над кнопкой)
    flyingImg.style.left = `${btnRect.left + (btnRect.width/2) - 30}px`;
    flyingImg.style.top = `${btnRect.top - 30}px`;
    
    document.body.appendChild(flyingImg);

    // Гарантируем, что браузер сначала отрисует стартовую позицию, а только потом начнет двигать
    requestAnimationFrame(() => {
        setTimeout(() => {
            // Конечная позиция (всегда в левый нижний угол экрана, куда приедет корзина)
            flyingImg.style.left = `20px`;
            flyingImg.style.top = `${window.innerHeight - 60}px`;
            
            // Добавили эффект вращения в полете (rotate(360deg))
            flyingImg.style.transform = 'scale(0.1) rotate(360deg)';
            flyingImg.style.opacity = '0.3';
        }, 10); 
    });

    // Удаляем элемент, когда анимация закончится (0.85s = 850ms)
    setTimeout(() => flyingImg.remove(), 850);
}

// --- КРЕСТИК В ПОИСКЕ ---
function clearSearchInput() {
    const input = document.getElementById('mainSearch');
    if (input) input.value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    document.getElementById('liveSearchDropdown').style.display = 'none';
    applyFilters();
}

// Добавляем слушатель, чтобы крестик появлялся при вводе
const mainSearchInput = document.getElementById('mainSearch');
if (mainSearchInput) {
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
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!currentUser) { 
        showToast(i18next.t('messages.cart_error_auth'), 'error'); 
        return; 
    }

    // Блокируем спам кликами на 300мс (чтобы не ломался массив)
    if (isToggling) return;
    isToggling = true;
    setTimeout(() => { isToggling = false; }, 300);

    // 1. Узнаем статус И жестко обновляем локальный массив
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

// ==========================================
// 8. КОРЗИНА И СИНХРОНИЗАЦИЯ
// ==========================================
async function syncCartToServer() {
    if (!currentUser) return;
    await _supabase.from('profiles').update({ cart: cart }).eq('id', currentUser.id);
}

async function addToCartFromModal() {
    if (!currentOpenedItem) return;
    
    if (cart.some(i => i.id === currentOpenedItem.id)) { 
        showToast(i18next.t('messages.cart_exist'), 'error');
        return; 
    }
    
    let cartItem = { ...currentOpenedItem };
    if (isHacked) {
        cartItem.price = Math.floor(cartItem.price * 0.9);
    }
    cart.push(cartItem);
    
    localStorage.setItem('nisha_cart', JSON.stringify(cart));
    await syncCartToServer();
    
    updateCartUI();
    closeModal('productModal');
    showToast(i18next.t('messages.cart_add'), 'success')
}

function updateCartUI() {
    const p = document.getElementById('cartPanel');
    if (!p) return; 
    
    if (cart.length === 0) { 
        p.classList.remove('show'); // Плавно уезжает вниз
        return; 
    }
    
    p.classList.add('show'); // Плавно выезжает вверх
    document.getElementById('cartCount').innerText = cart.length;
    let total = cart.reduce((sum, item) => sum + item.price, 0);
    if (currentPromoDiscount > 0) {
        total = Math.floor(total - (total * currentPromoDiscount));
    }
    document.getElementById('cartTotal').innerText = total + ' ' + getCurrency();
    
    if (typeof renderCartItems === 'function') renderCartItems(); 
}

// ==========================================
// 9. ИНТЕГРАЦИЯ НОВОЙ ПОЧТЫ (NOVA POSHTA)
// ==========================================

let citySearchTimeout = null;
let selectedCityRef = '';
let selectedBranchRef = '';
let cachedBranches = []; 

function debouncedNPCitySearch(query) {
    if (citySearchTimeout) clearTimeout(citySearchTimeout);
    
    document.getElementById('orderBranch').value = ''; 
    document.getElementById('orderBranch').readOnly = true;
    selectedCityRef = '';
    selectedBranchRef = '';
    cachedBranches = [];
    
    const dropdown = document.getElementById('cityDropdown');

    if(query.length < 2) { 
        dropdown.style.display = 'none'; 
        return; 
    }
    
    citySearchTimeout = setTimeout(() => { 
        searchNPCity(query); 
    }, 500);
}

// --- ПОИСК ГОРОДА ---
async function searchNPCity(query) {
    try {
        const res = await fetch('https://nisha-api.onrender.com/api/np-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                modelName: 'Address', 
                calledMethod: 'searchSettlements', 
                methodProperties: { CityName: query, Limit: "10" } 
            })
        });
        const data = await res.json();
        const dropdown = document.getElementById('cityDropdown');
        dropdown.innerHTML = '';
        
        if(data.success && data.data[0] && data.data[0].Addresses.length > 0) {
            data.data[0].Addresses.forEach(city => {
                const div = document.createElement('div');
                div.innerText = city.Present;
                
                div.onmousedown = (e) => {
                    e.preventDefault();
                    document.getElementById('orderCity').value = city.Present;
                    selectedCityRef = city.DeliveryCity || city.Ref; 
                    dropdown.style.display = 'none';
                    
                    const branchInput = document.getElementById('orderBranch');
                    branchInput.readOnly = false;
                    branchInput.value = '';
                    branchInput.placeholder = "Загрузка отделений...";
                    
                    cachedBranches = []; 
                    loadNPBranches();
                };
                dropdown.appendChild(div);
            });
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    } catch(e) { 
        console.error("Ошибка поиска города НП", e); 
        document.getElementById('cityDropdown').style.display = 'none';
        showToast(i18next.t('np.city_err'), 'error');
    }
}

// --- УМНЫЙ ПОИСК ОТДЕЛЕНИЙ (Через API Новой Почты в реальном времени) ---
let branchSearchTimeout = null;

// Эта функция срабатывает каждый раз, когда ты печатаешь в поле "Отделение"
function filterNPBranches(query) {
    const dropdown = document.getElementById('branchDropdown');
    
    // Если начали печатать, показываем статус загрузки
    if (query.length > 0) {
        dropdown.innerHTML = '<div style="color:#aaa; padding:12px; font-style: italic;">Шукаємо відділення в базі НП...</div>';
        dropdown.style.display = 'block';
    }

    if (branchSearchTimeout) clearTimeout(branchSearchTimeout);
    
    // Ждем 400мс, чтобы не спамить запросами на каждую букву
    branchSearchTimeout = setTimeout(() => {
        loadNPBranches(query);
    }, 400);
}

// Запрос в интернет к базе Новой Почты
async function loadNPBranches(searchString = "") {
    // ВСТАВИТЬ ЭТУ СТРОЧКУ ЗАЩИТЫ:
    if (typeof searchString !== 'string') searchString = ""; 

    if(!selectedCityRef) return;
    if(!selectedCityRef) return;
    
    const input = document.getElementById('orderBranch');
    const dropdown = document.getElementById('branchDropdown');

    try {
        // Формируем запрос
        const reqBody = {
            modelName: 'Address', 
            calledMethod: 'getWarehouses', 
            methodProperties: { 
                CityRef: selectedCityRef, 
                Limit: "50" // 50 штук за глаза хватает для автодополнения
            } 
        };

        // Если юзер ввел текст (например "245" или "Поштомат"), передаем это Новой Почте!
        if (searchString.trim() !== "") {
            reqBody.methodProperties.FindByString = searchString.trim();
        }

        const res = await fetch('https://nisha-api.onrender.com/api/np-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
        });

        if (!res.ok) throw new Error("Сетевая ошибка HTTP " + res.status);

        const data = await res.json();
        
        if(data.success && Array.isArray(data.data) && data.data.length > 0) {
            renderBranches(data.data);
        } else {
            dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">${i18next.t('np.branch_empty')}</div>`;
            dropdown.style.display = 'block';
        }
   } catch(e) { 
        console.error("Сбой загрузки отделений НП:", e); 
        dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">${i18next.t('np.branch_err')}</div>`;
        dropdown.style.display = 'block';
    }
}

// Отрисовка списка
function renderBranches(branches) {
    const dropdown = document.getElementById('branchDropdown');
    dropdown.innerHTML = '';
    
    if(branches.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    // ВАЖНО: Выключаем перехват скролла библиотекой Lenis для этого списка!
    dropdown.setAttribute('data-lenis-prevent', 'true');

    for (let i = 0; i < branches.length; i++) {
        const branch = branches[i];
        const isPostomat = branch.Description.includes("Поштомат") || branch.Description.includes("Почтомат");
        const div = document.createElement('div');
        
        div.innerHTML = isPostomat ? `📦 <span style="color:#00aaff">${branch.Description}</span>` : branch.Description;

        div.onmousedown = (e) => {
            e.preventDefault(); 
            document.getElementById('orderBranch').value = branch.Description;
            selectedBranchRef = branch.Ref;
            dropdown.style.display = 'none';
            calculateDeliveryCost(); 
        };
        dropdown.appendChild(div);
    }
    
    dropdown.style.display = 'block';
}

// --- РАСЧЕТ СТОИМОСТИ ДОСТАВКИ ---
async function calculateDeliveryCost() {
    if(!selectedCityRef || cart.length === 0) return;
    
    document.getElementById('deliveryCostInfo').style.display = 'block';
    document.getElementById('calcCostVal').innerText = "Рассчитываем...";
    
    const totalCost = cart.reduce((sum, item) => sum + item.price, 0);
    
    try {
        // ЗАПРАШИВАЕМ ГОТОВУЮ ЦЕНУ У НАШЕГО СЕРВЕРА
        const res = await fetch('https://nisha-api.onrender.com/api/calc-delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cityRef: selectedCityRef, cartTotal: totalCost })
        });
        const data = await res.json();
        
        if(data.success) {
            document.getElementById('calcCostVal').innerText = data.cost + " грн";
        } else {
            document.getElementById('calcCostVal').innerText = "По тарифам НП";
        }
    } catch(e) { 
        console.error("Ошибка расчета НП", e);
        document.getElementById('calcCostVal').innerText = "По тарифам НП";
    }
}

// ==========================================
// ЛОГИКА ВСПЛЫВАЮЩЕЙ КОРЗИНЫ
// ==========================================

function toggleCartDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('cartDropdown');
    const fab = document.querySelector('.fab-propose');
    if (dropdown) {
        dropdown.classList.toggle('active');
        // Прячем или показываем кнопку [+] в зависимости от статуса корзины
        if (fab) {
            if (dropdown.classList.contains('active')) {
                fab.style.opacity = '0';
                fab.style.pointerEvents = 'none';
            } else {
                fab.style.opacity = '1';
                fab.style.pointerEvents = 'auto';
            }
        }
    }
}
function renderCartItems() {
    const list = document.getElementById('cartDropdownList');
    if (!list) return;
    list.innerHTML = '';
    
    if (cart.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a; margin: 10px;">
                <div style="font-size: 30px; margin-bottom: 15px;">🛒</div>
                <div style="color:var(--accent-red); font-family: var(--font-mono); font-weight:bold; margin-bottom: 10px;">${i18next.t('cart.empty_title')}</div>
                <div style="color:#888; font-size: 12px; line-height: 1.5;">${i18next.t('cart.empty_desc')}</div>
            </div>`;
        return;
    }

    list.innerHTML = `
        <div style="padding: 8px 10px; margin-bottom: 15px; border-bottom: 1px solid #222; text-align: center;">
            <span style="color: #666; font-size: 11px; font-family: var(--font-main);">
                ⚠️ Товары не забронированы и могут быть куплены кем-то другим до момента оплаты.
            </span>
        </div>
    `;

   cart.forEach((item, index) => {
        const imgUrl = getOptimizedImageUrl(item, true);
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        
        row.innerHTML = `
            <div class="swipe-background">
                <svg class="trash-icon" viewBox="0 0 24 24">
                    <!-- Крышка корзины -->
                    <path class="trash-lid" d="M3 6h18 M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    <!-- База корзины -->
                    <path class="trash-base" d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6 M10 11v6 M14 11v6"></path>
                </svg>
            </div>
            <div class="swipe-surface" 
                 data-index="${index}"
                 ontouchstart="handleSwipeStart(event)" 
                 ontouchmove="handleSwipeMove(event)" 
                 ontouchend="handleSwipeEnd(event)">
                <div class="cart-item-img" style="background-image: url('${imgUrl}')"></div>
                <div class="cart-item-info">
                    <div class="cart-item-name" title="${item.name}">${item.name}</div>
                    <div class="cart-item-size">${i18next.t('grid.size_prefix')}${item.size}</div>
                </div>
                <div class="cart-item-price-wrapper">
                    <div class="cart-item-price">${item.price} ${getCurrency()}</div>
                    <div class="cart-item-remove hide-on-mobile" onclick="removeFromCart(${index}, event, this.closest('.cart-item-row'))">×</div>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
}

async function removeFromCart(index, event, rowElement) {
    if (event) event.stopPropagation(); 
    
    // Сохраняем данные удаляемого товара для уведомления
    const removedItem = cart[index];
    const imgUrl = getOptimizedImageUrl(removedItem, true);

    const executeRemoval = async () => {
        // Раньше мы тут снимали бронь, теперь это не нужно, так как товар и не был забронирован
        
        cart.splice(index, 1);
        localStorage.setItem('nisha_cart', JSON.stringify(cart));
        await syncCartToServer();
        updateCartUI(); 
        showToast(`${i18next.t('messages.cart_delete')}${removedItem.name}`, 'error', imgUrl);
        
        if (cart.length === 0) {
            const dropdown = document.getElementById('cartDropdown');
            if (dropdown) dropdown.classList.remove('active');
        }
    };

    // Если передан элемент строки — сначала плавно скрываем его, потом удаляем
    if (rowElement) {
        rowElement.classList.add('removing');
        setTimeout(executeRemoval, 300); // Ждем 0.3 сек пока закончится анимация CSS
    } else {
        await executeRemoval();
    }
}

function updateCartUI() {
    const p = document.getElementById('cartPanel');
    const fab = document.querySelector('.fab-propose');
    if (!p) return; 
    
    if (cart.length === 0) { 
        p.classList.remove('show'); 
        if(fab) fab.classList.remove('cart-active'); // Опускаем кнопку вниз
        return; 
    }
    
    p.classList.add('show'); 
    if(fab) fab.classList.add('cart-active'); // Поднимаем кнопку над корзиной
    
    document.getElementById('cartCount').innerText = cart.length;
    let total = cart.reduce((sum, item) => sum + item.price, 0);
    
    // Применяем скидку по промокоду, если она есть
    if (typeof currentPromoDiscount !== 'undefined' && currentPromoDiscount > 0) {
        const savedMoney = Math.floor(total * currentPromoDiscount);
        total = total - savedMoney;
        
        // Динамически обновляем надпись экономии в модалке заказа
        const msg = document.getElementById('promoMessage');
        if (msg && appliedPromoCode) {
            msg.innerHTML = `<span style="color: var(--accent-green);">[✔] Код активирован! Скидка ${currentPromoDiscount * 100}%<br><span style="font-size: 13px;">Ви зекономили: <b>${savedMoney} грн</b></span></span>`;
        }
    }
    document.getElementById('cartTotal').innerText = total + ' грн';
    
    // Вызываем отрисовку внутреннего списка (если она объявлена)
    if (typeof renderCartItems === 'function') renderCartItems();
}


function closeCartDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('cartDropdown');
    const fab = document.querySelector('.fab-propose');
    if (dropdown) dropdown.classList.remove('active');
    if (fab) {
        fab.style.opacity = '1';
        fab.style.pointerEvents = 'auto';
    }
}

// ЕДИНЫЙ ОБРАБОТЧИК КЛИКОВ ДЛЯ ЗАКРЫТИЯ ВСЕХ ВЫПАДАЮЩИХ СПИСКОВ
document.addEventListener('mousedown', (e) => {
    // Закрытие списка городов
    if (!e.target.closest('#orderCity') && !e.target.closest('#cityDropdown')) {
        const cd = document.getElementById('cityDropdown');
        if (cd) cd.style.display = 'none';
    }
    // Закрытие списка отделений
    if (!e.target.closest('#orderBranch') && !e.target.closest('#branchDropdown')) {
        const bd = document.getElementById('branchDropdown');
        if (bd) bd.style.display = 'none';
    }
    // Закрытие корзины (мобильная версия)
    if (!e.target.closest('#cartInfoWrapper')) {
        const cartDrop = document.getElementById('cartDropdown');
        if (cartDrop && cartDrop.classList.contains('active')) {
            cartDrop.classList.remove('active');
            const fab = document.querySelector('.fab-propose');
            if (fab) {
                fab.style.opacity = '1';
                fab.style.pointerEvents = 'auto';
            }
        }
    }
    // ЗАКРЫТИЕ ПЕРЕКЛЮЧАТЕЛЯ ЯЗЫКОВ
    if (!e.target.closest('#footerLangWrapper')) {
        const langWrap = document.getElementById('footerLangWrapper');
        if (langWrap) langWrap.classList.remove('active');
    }
});

// ==========================================
// 10. ОФОРМЛЕНИЕ ЗАКАЗА (OTP + ANTI-SPAM)
// ==========================================
let otpVerified = false;
let otpInterval = null;

async function checkPhoneAuth() {
    const btnSubmit = document.getElementById('btnSubmitOrder');
    const btnOtp = document.getElementById('btnGetOtp');
    const statusOtp = document.getElementById('otpStatus');
    const rawPhone = document.getElementById('orderPhone').value;
    const cleanPhone = rawPhone.replace(/[^\d+]/g, ''); 

    // Блокируем кнопку заказа по умолчанию
    otpVerified = false;
    btnSubmit.style.opacity = "0.5";
    btnSubmit.style.pointerEvents = "none";

    // Если номер короткий - просто показываем кнопку подтверждения
    if (!cleanPhone || cleanPhone.length < 10) {
        if(btnOtp) {
            btnOtp.style.display = "block";
            btnOtp.disabled = false;
            btnOtp.innerHTML = "Подтвердить";
            btnOtp.style.background = "var(--text-main)";
            btnOtp.style.borderColor = "#eee";
            btnOtp.style.opacity = "1";
        }
        if(statusOtp) statusOtp.style.display = "block";
        return;
    }

    // Если номер введен - ТИХО спрашиваем у базы: "Этот номер уже подтверждали?"
    if (_supabase) {
        const { data: existCode } = await _supabase.from('otp_codes').select('is_verified').eq('phone', cleanPhone).limit(1);
        
        if (existCode && existCode.length > 0 && existCode[0].is_verified) {
            // Номер УЖЕ подтвержден! Зеленый свет.
            otpVerified = true;
            btnSubmit.style.opacity = "1";
            btnSubmit.style.pointerEvents = "auto";
            
            if(statusOtp) statusOtp.style.display = "none";
            if(btnOtp) {
                btnOtp.style.display = "block";
                btnOtp.disabled = true; 
                btnOtp.innerHTML = "<span style='color:var(--accent-green); font-weight:bold;'>УСПЕХ!</span>";
                btnOtp.style.background = "var(--text-main)";
                btnOtp.style.borderColor = "var(--accent-green)";
                btnOtp.style.opacity = "1";
            }
        } else {
            // Номер есть, но еще НЕ подтвержден. Ждем нажатия.
            if(btnOtp) {
                btnOtp.style.display = "block";
                btnOtp.disabled = false;
                btnOtp.innerHTML = "Подтвердить";
                btnOtp.style.background = "var(--text-main)";
                btnOtp.style.borderColor = "#eee";
                btnOtp.style.opacity = "1";
            }
            if(statusOtp) statusOtp.style.display = "block";
        }
    }
}

let otpRealtimeChannel = null;

async function generateAndSendOTP() {
    const rawPhone = document.getElementById('orderPhone').value;
    const cleanPhone = rawPhone.replace(/[^\d+]/g, ''); 
    
    if(!cleanPhone || cleanPhone.length < 10) {
        showToast('Введите корректный номер телефона!', 'error');
        return;
    }

    const btnOtp = document.getElementById('btnGetOtp');
    if (btnOtp.disabled) return; // Если уже зеленый - ничего не делаем
    
    // Блокируем кнопку от двойных нажатий
    btnOtp.disabled = true;
    btnOtp.innerText = "Связь с БД...";
    btnOtp.style.opacity = "0.5";

    // 1. Проверяем Черный Список
    const { data: blacklisted } = await _supabase.from('blacklist').select('phone').eq('phone', cleanPhone).limit(1);
    if (blacklisted && blacklisted.length > 0) {
        document.getElementById('otpStatus').innerHTML = "<span style='color:red; font-weight:bold;'>[!] ОШИБКА БЕЗОПАСНОСТИ. ВАШ НОМЕР ЗАБЛОКИРОВАН.</span>";
        showToast('Доступ запрещен', 'error');
        btnOtp.innerText = "Подтвердить";
        return; 
    }
    
    // 2. Снова проверяем, вдруг он уже подтвержден (двойная страховка)
    const { data: existCode } = await _supabase.from('otp_codes').select('is_verified').eq('phone', cleanPhone).limit(1);
    if (existCode && existCode.length > 0 && existCode[0].is_verified) {
        checkPhoneAuth(); // Просто вызываем UI-обновление
        return; 
    }

    // 3. Запускаем Таймер ожидания (60 секунд)
    let timer = 60;
    btnOtp.innerText = `Ждите ${timer}с`;
    if (otpInterval) clearInterval(otpInterval);
    
    otpInterval = setInterval(() => {
        timer--;
        btnOtp.innerText = `Ждите ${timer}с`;
        if (timer <= 0) {
            clearInterval(otpInterval);
            btnOtp.disabled = false;
            btnOtp.innerText = "Подтвердить";
            btnOtp.style.opacity = "1";
        }
    }, 1000);

    // 4. Генерируем код в базе
    const { error } = await _supabase.rpc('generate_secure_otp', { p_phone: cleanPhone });
    
    if (error) {
        showToast('Ошибка сервера', 'error');
        clearInterval(otpInterval);
        btnOtp.disabled = false;
        btnOtp.innerText = "Подтвердить";
        return;
    }
    
    // 5. Открываем бота
    const payloadPhone = cleanPhone.replace('+', '');
    const tgLink = `https://t.me/nisha_store1_bot?start=otp_${payloadPhone}`;
    
    if (/android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase())) {
        window.location.href = tgLink;
    } else {
        window.open(tgLink, '_blank');
    }
    
    document.getElementById('otpStatus').innerHTML = "Перейдите в бота и нажмите 'СТАРТ' для подтверждения... <span style='color:var(--accent-yellow)'>⏳</span>";
    
    // 6. Слушаем подтверждение в реальном времени
    if (otpRealtimeChannel) _supabase.removeChannel(otpRealtimeChannel);

    otpRealtimeChannel = _supabase.channel('custom-otp-channel')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'otp_codes',
            filter: `phone=eq.${cleanPhone}` 
        }, payload => {
            if (payload.new.is_verified) {
                // Если бот подтвердил номер — жестко убиваем таймер и красим кнопку
                let id = window.setTimeout(function() {}, 0);
                while (id--) { window.clearTimeout(id); }
                
                checkPhoneAuth(); // Обновит UI на успешный
                _supabase.removeChannel(otpRealtimeChannel); 
            }
        })
        .subscribe();
}

async function openCheckoutModal() { 
    // 1. Находим ИМЕННО кнопку "ОФОРМИТЬ ЗАКАЗ" внизу панели корзины
    const btn = document.querySelector('.cart-panel .cart-checkout-btn');
    if (!btn) return; // Защита от ошибок, если кнопка не найдена
    
    // Сохраняем оригинальный текст и блокируем кнопку
    const originalText = btn.innerText;
    btn.innerText = "[ ПРОВЕРКА НАЛИЧИЯ... ]";
    btn.style.pointerEvents = "none";

    // 2. БЫСТРАЯ ПРОВЕРКА: А вдруг товар уже купили, пока он лежал в корзине?
    const itemIds = cart.map(i => i.id);
    const { data: dbItems, error } = await _supabase.from('items').select('id, name, status').in('id', itemIds);

    let hasSoldItems = false;
    if (dbItems && !error) {
        // Фильтруем корзину, оставляя только доступные товары (и забронированные тобой)
        cart = cart.filter(cartItem => {
            const dbItem = dbItems.find(i => i.id === cartItem.id);
            // Если товара нет в БД или его статус 'sold' — удаляем из корзины
            if (!dbItem || dbItem.status === 'sold') {
                showToast(`Товар "${cartItem.name}" уже кто-то купил! 😢`, 'error');
                hasSoldItems = true;
                return false; 
            }
            return true;
        });
    }

    if (hasSoldItems) {
        // Если что-то удалилось, обновляем корзину и отменяем открытие окна
        localStorage.setItem('nisha_cart', JSON.stringify(cart));
        await syncCartToServer();
        updateCartUI();
        btn.innerText = originalText;
        btn.style.pointerEvents = "auto";
        if (cart.length === 0) closeCartDropdown();
        return; 
    }

    // Если всё на месте - открываем окно оформления
    btn.innerText = originalText;
    btn.style.pointerEvents = "auto";

    if (typeof lenis !== 'undefined') lenis.stop();
    document.getElementById('checkoutModal').style.display = 'flex'; 
    document.body.style.overflow = 'hidden';
    checkPhoneAuth();
    
    // ЗАПУСКАЕМ АВТООПРЕДЕЛЕНИЕ ГОРОДА
    autoDetectCity();
}

async function submitOrder() {
    const botTrap = document.getElementById('botTrap');
    if (botTrap && botTrap.value !== "") return;

    if (!otpVerified) {
        showToast('Подтвердите номер телефона!', 'error');
        return;
    }

    // БЕЗОПАСНАЯ ОЧИСТКА ДАННЫХ ОТ XSS-АТАК
    const rawName = document.getElementById('orderName').value.trim();
    const rawCity = document.getElementById('orderCity').value.trim();
    const rawBranch = document.getElementById('orderBranch').value.trim();
    
    const name = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawName) : rawName;
    const city = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawCity) : rawCity;
    const branch = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawBranch) : rawBranch;

    const phoneRaw = document.getElementById('orderPhone').value;
    const phone = phoneRaw.replace(/[^\d+]/g, '');

    if(!name || !phone || !city || !branch) { 
        showToast(i18next.t('messages.req_fields'), 'error'); 
        return; 
    }

    // НОВАЯ ЖЕСТКАЯ ВАЛИДАЦИЯ НОВОЙ ПОЧТЫ
    if (!selectedCityRef || !selectedBranchRef) {
        showToast('Выберите Город и Отделение строго из выпадающего списка!', 'error');
        return;
    }

    // ПРОВЕРЯЕМ, ЗАПОМНИЛ ЛИ САЙТ ВЫБОР ЮЗЕРА РАНЕЕ
    const savedEmailPreference = localStorage.getItem('nisha_email_preference');
    
    if (savedEmailPreference === 'skipped') {
        return await executeOrderFinal('');
    }
    if (savedEmailPreference && savedEmailPreference.includes('@')) {
        return await executeOrderFinal(savedEmailPreference);
    }

    if (currentUser && currentUser.email) {
        localStorage.setItem('nisha_email_preference', currentUser.email);
        return await executeOrderFinal(currentUser.email);
    }

    // Если это ГОСТЬ (не вошел в аккаунт) и делает заказ впервые — тогда спрашиваем
    const prompt = document.getElementById('emailPromptOverlay');
    const emailInput = document.getElementById('promptEmailInput');
    emailInput.value = '';
    prompt.style.display = 'flex';
}

async function confirmEmailPrompt(wantsEmail) {
    const prompt = document.getElementById('emailPromptOverlay');
    const emailInput = document.getElementById('promptEmailInput');
    let finalEmail = '';

    if (wantsEmail) {
        finalEmail = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(finalEmail)) {
            showToast('Введите корректный E-mail!', 'error');
            return; 
        }
        // Запоминаем Email навсегда
        localStorage.setItem('nisha_email_preference', finalEmail);
    } else {
        // Запоминаем, что юзер отказался
        localStorage.setItem('nisha_email_preference', 'skipped');
    }

    prompt.style.display = 'none'; 
    await executeOrderFinal(finalEmail); 
}

async function executeOrderFinal(emailToSave) {
    const btnSubmit = document.getElementById('btnSubmitOrder');
    
    // --- КРУТОЙ ПРОГРЕСС-БАР ЗАГРУЗКИ ---
    btnSubmit.style.pointerEvents = "none";
    btnSubmit.style.position = "relative";
    btnSubmit.style.overflow = "hidden";
    btnSubmit.style.color = "#000";
    btnSubmit.innerHTML = `
        <span style="position: relative; z-index: 2;">[ ОБРАБОТКА ДАННЫХ... ]</span>
        <div id="btnProgressBar" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: #fff; z-index: 1; transition: width 3s cubic-bezier(0.1, 0.7, 1.0, 0.1);"></div>
    `;
    
    // Запускаем фейковую анимацию до 90% (остальные 10% заполнятся, когда БД ответит)
    setTimeout(() => {
        const bar = document.getElementById('btnProgressBar');
        if(bar) bar.style.width = "90%";
    }, 50);
    // ------------------------------------

    const name = document.getElementById('orderName').value.trim();
    const phoneRaw = document.getElementById('orderPhone').value;
    const phone = phoneRaw.replace(/[^\d+]/g, '');
    const city = document.getElementById('orderCity').value.trim();
    const branch = document.getElementById('orderBranch').value.trim();

    const orderItemIds = cart.map(i => i.id);

    try {
        // ВАЖНО: передаем p_email в базу!
        const { data: orderId, error: orderError } = await _supabase.rpc('create_secure_order', {
            p_user_id: currentUser ? currentUser.id : null,
            p_name: name,
            p_phone: phone,
            p_email: emailToSave,
            p_tg: '',
            p_city: city,
            p_branch: branch,
            p_city_ref: selectedCityRef || '',
            p_branch_ref: selectedBranchRef || '',
            p_item_ids: orderItemIds,
            p_promocode: appliedPromoCode || null
        });

        if (orderError) throw orderError; 

        // УСПЕШНЫЙ ЗАКАЗ
        localStorage.setItem('nisha_last_phone', phone);
        localStorage.setItem('nisha_last_order', Date.now());

        cart = [];
        localStorage.setItem('nisha_cart', JSON.stringify([]));
        await syncCartToServer();
        
        updateCartUI();
        
        // Добиваем прогресс-бар до 100% перед закрытием
        const bar = document.getElementById('btnProgressBar');
        if(bar) {
            bar.style.transition = "width 0.2s ease";
            bar.style.width = "100%";
        }

        setTimeout(() => {
            closeModal('checkoutModal');
            // Возвращаем кнопку в норму
            btnSubmit.innerHTML = i18next.t('checkout.btn_submit');
            
            // Показываем терминал успешного заказа
            const overlay = document.getElementById('orderSuccessOverlay');
            overlay.style.display = 'flex';
            
            setTimeout(() => { 
                overlay.style.display = 'none'; 
                loadAllItems(); 
                btnSubmit.style.pointerEvents = "auto";
                btnSubmit.style.opacity = "1";
            }, 3500);
        }, 300); // Ждем треть секунды, чтобы юзер увидел 100%
        
        setTimeout(() => { 
            overlay.style.display = 'none'; 
            loadAllItems(); 
            btnSubmit.innerText = "ПОДТВЕРДИТЬ ЗАКАЗ";
            btnSubmit.style.pointerEvents = "auto";
            btnSubmit.style.opacity = "1";
        }, 3500);

    } catch (err) {
        showToast('Ошибка при оформлении: ' + err.message, 'error');
        btnSubmit.innerHTML = i18next.t('checkout.btn_submit');
        btnSubmit.style.pointerEvents = "auto";
        btnSubmit.style.opacity = "1";
        loadAllItems(); 
    }
}

// ==========================================
// 11. МОИ ЗАКАЗЫ (ИСТОРИЯ И JSBARCODE)
// ==========================================
   function openOrdersModal() {

    document.getElementById('ordersModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (typeof lenis !== 'undefined') lenis.stop(); 
    
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

        const { data: otpCheck } = await _supabase.from('otp_codes').select('is_verified').eq('phone', phone).limit(1);
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
    
    renderFilteredOrders();
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
                const imgStyle = item.image ? `background-image: url('${item.image}');` : '';
                itemsHtml += `
                    <div class="order-item-row" onclick="openProductModalById('${item.id}')" title="Открыть карточку товара">
                        <div class="order-item-img" style="${imgStyle}">${item.image ? '' : 'NO IMG'}</div>
                        <div class="order-item-details">
                            <div class="order-item-name">${item.name}</div>
                            <div class="order-item-meta"><span>Размер: ${item.size}</span><span class="order-item-price">${item.currentPrice} грн</span></div>
                        </div>
                    </div>`;
            });
        }

        const ttnHtml = order.tracking_number 
            ? `<div class="order-ttn">ТТН: <span style="color:var(--accent-green); font-weight:bold;">${order.tracking_number}</span>
                 <div style="background:#fff; text-align:center; padding: 10px; margin-top: 10px; border-radius:4px;">
                     <svg class="barcode-svg" data-ttn="${order.tracking_number}"></svg>
                 </div>
               </div>` 
            : `<div class="order-ttn" style="color:#777;">ТТН: Ожидается генерация...</div>`;

        // --- ЛОГИКА КНОПКИ ОТЗЫВА ---
        let reviewBtnHtml = '';
        if (order.status.toLowerCase() === 'завершен') {
            let reviewedOrders = JSON.parse(localStorage.getItem('nisha_reviewed_orders') || '[]');
            
            if (!reviewedOrders.includes(order.id) && order.items && order.items.length > 0) {
                const firstItem = order.items[0];
                const safeName = firstItem.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const msgIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; position: relative; top: 2px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
                
                reviewBtnHtml = `
                    <div style="margin-top: 10px; cursor: pointer; color: var(--accent-green); font-size: 12px; font-family: var(--font-main); text-align: center; transition: 0.2s;" 
                         onclick="closeModal('ordersModal'); promptOrderReview('${order.id}', '${safeName}', '${firstItem.image}', '${firstItem.id}')" 
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
function openProductModalById(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (item) { 
        // 1. Снимаем красное мерцание визуально (сразу)
        const cardInGrid = document.querySelector(`.item-card[data-id="${itemId}"]`);
        if (cardInGrid) cardInGrid.classList.remove('unseen-pulse');

        // 2. НАВСЕГДА ЗАПОМИНАЕМ, ЧТО ЮЗЕР ЭТО ВИДЕЛ
        let seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
        if (!seenItemsIds.includes(itemId)) {
            seenItemsIds.push(itemId);
            // Храним до 500 просмотренных ID (чтобы не забивать память телефона, 500 ID весят пару килобайт)
            if (seenItemsIds.length > 500) seenItemsIds.shift(); 
            localStorage.setItem('nisha_seen_items', JSON.stringify(seenItemsIds));
        }

        closeModal('ordersModal'); 
        closeModal('reviewsModal'); 
        openProductModal(item); 
    } else { 
        showToast('Товар больше не доступен в базе', 'error'); 
    }
}

function openProductModal(item) {
    currentOpenedItem = item;
    if (typeof lenis !== 'undefined') lenis.stop();
    
    document.getElementById('modalItemTitle').innerText = item.name;
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
    `;
   // ЗАЩИЩЕННЫЕ ПРОСМОТРЫ (ANTI-SPAM)
    const viewCount = document.getElementById('modalItemViews');
    if(viewCount) {
        viewCount.innerText = item.views_count || 0;
        
        if (_supabase) {
            // Используем ID юзера (если вошел) или уникальный отпечаток железа
            const viewerId = currentUser ? currentUser.id : clientFingerprint;
            
            _supabase.rpc('increment_item_views', { 
                p_item_uuid: item.id, 
                p_viewer_id: viewerId 
            }).then(({ data, error }) => {
                if (!error && data !== null) {
                    viewCount.innerText = data;
                    item.views_count = data; // Обновляем локально, чтобы не отставало
                }
            });
        }
    }

    const cartBtn = document.getElementById('modalCartBtn');
    const waitBtn = document.getElementById('modalWaitlistBtn');
    
    if (item.status === 'sold') {
        if(cartBtn) cartBtn.style.display = 'none';
        if(waitBtn) waitBtn.style.display = 'block';
    } else {
        if(cartBtn) cartBtn.style.display = 'block';
        if(waitBtn) waitBtn.style.display = 'none';
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
            const isVideo = url.endsWith('.mp4');
            const currentThumb = (item.thumbnails && item.thumbnails[index]) ? item.thumbnails[index] : (isVideo ? 'https://via.placeholder.com/400x400.png?text=VIDEO&bg=000000&color=00ff00' : url);
            
            if (isVideo) {
                // ХАК #t=0.001 ЗАСТАВЛЯЕТ ЛЮБОЙ ТЕЛЕФОН ПОКАЗАТЬ ПЕРВЫЙ КАДР!
                wrapper.innerHTML += `
                    <div class="slide" style="background:#000; display:flex; justify-content:center; align-items:center;">
                        <video 
                            class="modal-video-player"
                            autoplay="autoplay" 
                            muted="muted" 
                            loop="loop" 
                            playsinline="playsinline" 
                            webkit-playsinline="webkit-playsinline" 
                            preload="metadata"
                            controls 
                            style="width:100%; height:100%; max-height:400px; object-fit:contain;"
                        >
                            <source src="${url}#t=0.001" type="video/mp4">
                        </video>
                    </div>`;
            } else {
                wrapper.innerHTML += `<a href="${url}" data-pswp-width="1200" data-pswp-height="1600" target="_blank" class="slide" style="background-image:url('${url}');"></a>`;
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
        
        let similar = allItems.filter(i => i.id !== item.id && (i.category === item.category || i.brand === item.brand));
        
        if (similar.length < 4) {
            const priceMargin = item.price * 0.3;
            const extra = allItems.filter(i => i.id !== item.id && !similar.includes(i) && i.price >= item.price - priceMargin && i.price <= item.price + priceMargin);
            similar = [...similar, ...extra];
        }
        
        similar = similar.sort(() => 0.5 - Math.random()).slice(0, 4);
        
        // Достаем историю просмотров, чтобы проверить, видел ли юзер эти похожие вещи
        let seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
            
        if(similar.length > 0) {
            similar.forEach(s => {
                const sImg = getOptimizedImageUrl(s, true); 
                
                // --- МИНИ-БЕЙДЖИ ДЛЯ ПОХОЖИХ ТОВАРОВ ---
                let miniBadgeHTML = '';
                const hasSale = s.is_sale;
                const hasHot = (s.views_count || 0) >= 25;

                if (hasSale || hasHot) {
                    miniBadgeHTML = `<div style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; display: flex; align-items: center; gap: 4px; padding: 1px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none;">`;
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

                // --- НОВОЕ: ПУЛЬСАЦИЯ ДЛЯ НОВЫХ ПОХОЖИХ ВЕЩЕЙ ---
                const isUnseen = !seenItemsIds.includes(s.id) && s.status === 'available';
                const pulseAnim = isUnseen ? 'animation: unseenPulseAnim 2s infinite alternate;' : '';
                const baseBorder = isUnseen ? 'var(--accent-red)' : '#333';

                simCont.innerHTML += `
                    <div style="min-width: 120px; cursor: pointer; border: 1px solid ${baseBorder}; background: #000; transition: 0.2s; ${pulseAnim}" 
                         onmouseover="this.style.borderColor='var(--accent-green)'" 
                         onmouseout="this.style.borderColor='${baseBorder}'" 
                         onclick="openProductModalById('${s.id}')">
                        <div style="position: relative; height: 100px; background-image:url('${sImg}'); background-size: cover; background-position: center;">
                            ${miniBadgeHTML}
                        </div>
                        <div style="padding: 8px; font-size: 11px; color: #fff; font-family: var(--font-mono); text-align: center;">${miniPriceHTML}</div>
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

    // НОВЫЙ КОД: Плавный скролл модалки на самый верх
    const modalWin = document.querySelector('#productModal .modal-window');
    if (modalWin) {
        modalWin.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
// 13. ПОДПИСКА НА ПОЯВЛЕНИЕ (WAITLIST)
// ==========================================
async function openWaitlist() {
    if(!currentOpenedItem) return;
    
    const { value: phoneOrTg } = await Swal.fire({
        title: 'WAITLIST.EXE',
        text: 'Введите ваш Telegram (@username) или номер телефона:',
        input: 'text',
        background: '#111',
        color: '#fff',
        inputPlaceholder: '@username или +380...',
        showCancelButton: true,
        confirmButtonColor: 'var(--accent-green)',
        cancelButtonColor: '#333',
        confirmButtonText: '<span style="color:#000; font-weight:bold; font-family:monospace;">ПОДПИСАТЬСЯ</span>',
        cancelButtonText: '<span style="color:#fff; font-family:monospace;">ОТМЕНА</span>',
        customClass: { title: 'typewriter', popup: 'modal-window', input: 'form-input' }
    });
    
    if(phoneOrTg && phoneOrTg.trim() !== "") {
        const res = await fetch('https://nisha-api.onrender.com/api/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: currentOpenedItem.id, phone: phoneOrTg.trim() })
        });
        const data = await res.json();
        
        if (!data.success) {
            Swal.fire({ icon: 'error', title: 'ОШИБКА', text: data.message || 'Ошибка подписки', background: '#111', color: '#fff', confirmButtonColor: '#333' });
        } else {
            Swal.fire({ icon: 'success', title: 'УСПЕШНО', text: 'Мы сообщим вам о появлении!', background: '#111', color: '#fff', confirmButtonColor: '#333' });
            
            // Push.js: Запрашиваем права и кидаем тестовое уведомление
            if (typeof Push !== 'undefined') {
                Push.create("NISHA STORE", {
                    body: `Вы подписались на уведомления о: ${currentOpenedItem.name}`,
                    icon: '/icon.ico', // Твоя иконка
                    timeout: 5000,
                    onClick: function () {
                        window.focus();
                        this.close();
                    }
                });
            }
        }
    }
}

// ==========================================
// 14. ИСТОРИЯ ПРОСМОТРОВ (HISTORY LOG)
// ==========================================
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
    
    hist.forEach(h => {
        const optImg = h.img;
        const isVideo = optImg && optImg.endsWith('.mp4');
        
        // --- ЛОГИКА ЦЕНЫ СО СКИДКОЙ ДЛЯ ИСТОРИИ ---
        let finalPriceHTML = '';
        const curr = getCurrency();
        if (h.is_sale && h.old_price) {
            finalPriceHTML = `<span style="color:#4a704a; text-decoration:line-through; font-size:10px; margin-right:4px;">${h.old_price}</span>${h.price} ${curr}`;
        } else {
            finalPriceHTML = `${h.price} ${curr}`;
        }

        const card = document.createElement('div');
        card.className = 'history-card';
        card.onclick = () => openProductModalById(h.id);
        
        // Готовим надежный HTML для медиа-блока
        let mediaHTML = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#555;">NO FOTO</div>';
        
        if (optImg) {
            if (isVideo) {
                // Видео: вытягиваем первый кадр через #t=0.001
                mediaHTML = `
                    <video 
                        src="${optImg}#t=0.001" 
                        muted 
                        playsinline 
                        webkit-playsinline 
                        preload="metadata"
                        style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;"
                    ></video>
                    <div style="position:absolute; z-index:5; top:4px; left:4px; background:rgba(0,0,0,0.8); padding:2px 4px; border-radius:2px; color:var(--accent-green); font-size:8px; font-family:var(--font-mono); border: 1px solid #333; pointer-events: none;">▶ VIDEO</div>
                `;
            } else {
                // Картинка
                mediaHTML = `<div style="width:100%; height:100%; background-image:url('${optImg}'); background-size:cover; background-position:center;"></div>`;
            }
        }
        
        // --- МИНИ-БЕЙДЖИ ДЛЯ ИСТОРИИ ---
        let miniBadgeHTML = '';
        if (h.is_sale) {
            miniBadgeHTML = `<div style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; padding: 1px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none; color: #cc0000;">% SALE</div>`;
        }

        card.innerHTML = `
            <div class="history-img" style="position: relative; overflow: hidden; padding: 0;">
                <div class="history-item-remove" onclick="removeHistoryItem(event, '${h.id}')" title="Удалить">X</div>
                ${mediaHTML}
                ${miniBadgeHTML}
            </div>
            <div class="history-info">
                <div class="history-name" title="${h.name}">${h.name}</div>
                <div class="history-price">${finalPriceHTML}</div>
            </div>`;
            
        container.appendChild(card);

        if (typeof VanillaTilt !== 'undefined' && window.innerWidth > 900) {
            VanillaTilt.init(card, { max: 15, speed: 300, scale: 1.05 });
        }
    });

    // СИНХРОНИЗАЦИЯ С БД (если юзер вошел в аккаунт)
    if (currentUser && _supabase) {
        _supabase.from('profiles').update({ 
            viewed_history: hist.map(h => h.id) 
        }).eq('id', currentUser.id).then();
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
// 16. СЧЕТЧИК ПОСЕТИТЕЛЕЙ (УНИКАЛЬНЫЕ ЗА ДЕНЬ)
// ==========================================

async function initHitCounter() {
    const counterEl = document.getElementById('hitCounterValue');
    if (!counterEl) return;

    let visitorId = "unknown";
    if (typeof FingerprintJS !== 'undefined') {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        visitorId = result.visitorId;
        clientFingerprint = visitorId;
    }

    const today = new Date().toLocaleDateString('en-CA'); 
    const lastVisitData = JSON.parse(localStorage.getItem('nisha_visit_data') || '{}');
    
    // Записываем локально, чтобы не дергать сервер при каждом обновлении страницы
    if (lastVisitData.date !== today || lastVisitData.id !== visitorId) {
        localStorage.setItem('nisha_visit_data', JSON.stringify({ date: today, id: visitorId }));
    }

    try {
        // Бэкенд всё сделает сам
        const res = await fetch('https://nisha-api.onrender.com/api/hit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorId: visitorId, date: today })
        });
        const data = await res.json();
        
        if (data.success && data.count) {
            const strCount = data.count.toString().padStart(5, '0');
            counterEl.innerText = strCount.split('').join(' ');
        }
    } catch (err) {
        console.error("Ошибка счетчика:", err);
    }
}
// ==========================================
// 17. UI ФИЛЬТРОВ И МОБИЛЬНОЕ МЕНЮ
// ==========================================
let priceTimeout;
function updatePriceUI() {
    let minInput = document.getElementById('priceMin');
    let maxInput = document.getElementById('priceMax');
    let minVal = parseInt(minInput.value);
    let maxVal = parseInt(maxInput.value);

    // Защита, чтобы ползунки не заходили друг за друга
    if (minVal >= maxVal) {
        if (event.target.id === 'priceMin') { minInput.value = maxVal - 100; minVal = maxVal - 100; }
        else { maxInput.value = minVal + 100; maxVal = minVal + 100; }
    }

    document.getElementById('priceMinVal').innerText = minVal;
    document.getElementById('priceMaxVal').innerText = maxVal;

    // Рисуем зеленую полоску между ползунками
    const percentMin = (minVal / 15000) * 100;
    const percentMax = (maxVal / 15000) * 100;
    document.getElementById('rangeFill').style.left = percentMin + '%';
    document.getElementById('rangeFill').style.right = (100 - percentMax) + '%';

    // Применяем фильтр с задержкой (чтобы не лагало при дергании ползунка)
    clearTimeout(priceTimeout);
    priceTimeout = setTimeout(() => { applyFilters(); }, 300);
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const btn = document.getElementById('mobileFilterBtn');
    const fab = document.querySelector('.fab-propose'); 
    
    sidebar.classList.toggle('active-mobile');
    
    const hideText = i18next.t('mobile.hide_filters', { defaultValue: '[-] СКРЫТЬ ФИЛЬТРЫ' });
    const showText = i18next.t('mobile.show_filters', { defaultValue: '[+] ПОКАЗАТЬ ФИЛЬТРЫ' });

    if (sidebar.classList.contains('active-mobile')) {
        btn.innerText = hideText;
        btn.style.borderColor = 'var(--accent-red)';
        btn.style.color = 'var(--accent-red)';
        btn.style.background = '#111'; 
        
        btn.style.position = 'fixed';
        btn.style.top = '0';
        btn.style.left = '0';
        btn.style.width = '100%';
        btn.style.zIndex = '1000'; 
        
        const btnHeight = btn.offsetHeight || 50; 
        
        sidebar.style.position = 'fixed';
        sidebar.style.top = btnHeight + 'px';
        sidebar.style.left = '0';
        sidebar.style.width = '100%';
        sidebar.style.zIndex = '999';
        
        sidebar.style.maxHeight = `calc(100vh - ${btnHeight}px)`; 
        sidebar.style.overflowY = 'auto'; 
        sidebar.style.boxShadow = '0 20px 40px rgba(0,0,0,0.9)';
        
        document.body.classList.add('search-lock'); 
        if (typeof lenis !== 'undefined') lenis.stop(); 
        
        if (fab) fab.style.display = 'none';
        
    } else {
        // --- МАГИЯ ЗДЕСЬ ---
        // Мгновенно кидаем скролл в 0 ДО ТОГО, как разблокируем страницу. 
        // Браузер забудет, что ты был далеко внизу, и баг с дерганьем исчезнет!
        window.scrollTo(0, 0);
        
        btn.innerText = showText;
        btn.style.borderColor = '#444';
        btn.style.color = 'var(--accent-green)';
        btn.style.background = '#050505'; 
        
        btn.style.position = 'sticky';
        btn.style.zIndex = '100';
        
        sidebar.style.position = '';
        sidebar.style.top = '';
        sidebar.style.left = '';
        sidebar.style.width = '';
        sidebar.style.zIndex = '';
        sidebar.style.maxHeight = '';
        sidebar.style.overflowY = '';
        sidebar.style.boxShadow = '';
        
        document.body.classList.remove('search-lock');
        if (typeof lenis !== 'undefined') lenis.start();
        
        if (fab) fab.style.display = 'flex';
    }
}
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

    let html = `<div class="search-history-title">🕒 НЕДАВНИЕ ЗАПРОСЫ <span class="search-history-clear" onclick="localStorage.removeItem('nisha_search_history'); document.getElementById('liveSearchDropdown').style.display='none'; event.stopPropagation();">[ ОЧИСТИТЬ ]</span></div>`;
    history.forEach(term => {
        html += `<div class="search-history-item" onclick="document.getElementById('mainSearch').value='${term}'; handleLiveSearch();">
                    <span>> ${term}</span>
                 </div>`;
    });
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
    document.body.classList.add('search-lock');
}

function handleLiveSearch() {
    clearTimeout(searchDebounce);
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchInput = document.getElementById('mainSearch');
    const searchTerm = searchInput.value.trim();

    // Если поле пустое, показываем историю
    if (searchTerm.length === 0) {
        showSearchHistory();
        applyFilters();
        return;
    }

    if (searchTerm.length < 2) {
        closeSearch();
        applyFilters();
        return;
    }

    if (searchTerm.length < 2) {
        closeSearch();
        applyFilters();
        return;
    }

    searchDebounce = setTimeout(() => {
        // УЛУЧШЕННЫЙ ПОИСК ЧЕРЕЗ FUSE.JS (СИНХРОННО С ГЛАВНОЙ ЛЕНТОЙ)
        const cleanSearchTerm = searchTerm.replace(/#/g, '').trim().toLowerCase();
        const fuseOptions = {
            includeScore: true, 
            threshold: 0.4, 
            ignoreLocation: true,
            useExtendedSearch: true, 
            keys: [
                { name: 'tags', weight: 1.0 }, 
                { name: 'brand', weight: 0.8 }, 
                { name: 'name', weight: 0.8 }, 
                { name: 'size', weight: 0.8 } // ДОБАВИЛИ РАЗМЕР В ЖИВОЙ ПОИСК
            ]
        };
        const fuse = new Fuse(allItems, fuseOptions);
        const results = fuse.search(cleanSearchTerm).slice(0, 8); // Берем топ 8 совпадений, чтобы было удобнее

        dropdown.innerHTML = '';
        if (results.length > 0) {
            document.body.classList.add('search-lock');
            
            results.forEach(result => {
                const item = result.item;
                const img = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails[0] : (item.images[0] || '');
                dropdown.innerHTML += `
                    <div class="live-search-item" onclick="openProductModalById('${item.id}'); closeSearch();">
                        <div class="live-search-img" style="background-image: url('${img}')"></div>
                        <div class="live-search-info">
                            <span class="live-search-title">${item.name}</span>
                            <span class="live-search-price">${item.price} грн</span>
                        </div>
                    </div>`;
            });
            dropdown.style.display = 'block';

            // ЭТА ЧАСТЬ ПРЯЧЕТ КЛАВИАТУРУ ПРИ СКРОЛЛЕ РЕЗУЛЬТАТОВ
            dropdown.ongetscroll = () => {}; // Сброс старых событий
            dropdown.addEventListener('touchstart', () => {
                // Если коснулись списка — убираем фокус с инпута, чтобы спрятать клавиатуру
                if (document.activeElement === searchInput) {
                    searchInput.blur();
                }
            }, {passive: true});

        } else {
            dropdown.innerHTML = '<div style="padding: 20px; color: #666; font-family: monospace; text-align: center;">[ СОВПАДЕНИЙ НЕТ ]</div>';
            dropdown.style.display = 'block';
            document.body.classList.remove('search-lock');
        }
        applyFilters();
    }, 300);
}

function closeSearch() {
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchInput = document.getElementById('mainSearch');
    if (dropdown) dropdown.style.display = 'none';
    document.body.classList.remove('search-lock');
    if (searchInput) searchInput.blur(); // Принудительно прячем клавиатуру
}
// Добавим вспомогательную функцию для чистого закрытия
function closeSearch() {
    const dropdown = document.getElementById('liveSearchDropdown');
    if (dropdown) dropdown.style.display = 'none';
    document.body.classList.remove('search-lock');
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
function shareItem() {
    if (!currentOpenedItem) return;
    
    // Прямая ссылка на твой новый домен
    const shareUrl = `https://www.nisha-store.shop/share/${currentOpenedItem.id}`;
    
    const shareData = {
        title: `NISHA | ${currentOpenedItem.name}`,
        text: `Зацени какую вещь нашел: ${currentOpenedItem.brand} (${currentOpenedItem.size}).`,
        url: shareUrl 
    };

    // Если это телефон — открываем нативное меню "Поделиться"
    if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
        navigator.share(shareData).catch(err => console.log('Шеринг отменен'));
    } else {
        // Если это ПК (или браузер не поддерживает share) — просто копируем ссылку
        navigator.clipboard.writeText(shareUrl)
            .then(() => showToast(i18next.t('messages.link_copied'), 'success'))
            .catch(() => showToast(i18next.t('messages.copy_error'), 'error'));
    }
}
let currentPromoDiscount = 0; 
let appliedPromoCode = '';

async function applyPromoCode() {
    const input = document.getElementById('promoInput').value.trim().toUpperCase();
    const msg = document.getElementById('promoMessage');
    const btn = document.querySelector('.promo-wrapper button');

    if (!input) return;

    btn.innerText = '...';
    
    // Считаем общую сумму ДО скидки
    const originalTotal = cart.reduce((sum, item) => sum + item.price, 0);

    try {
        // Отправляем запрос на наш Бэкенд
        const res = await fetch('https://nisha-api.onrender.com/api/check-promo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: input, cartTotal: originalTotal })
        });
        
        const data = await res.json();

        // Достаем актуальный язык, чтобы переводы не зависали
        const currentLang = localStorage.getItem('nisha_lang') || 'ru';
        
        // Меняем язык i18next ПЕРЕД получением перевода (страховка)
        if (i18next.language !== currentLang) {
            await i18next.changeLanguage(currentLang);
        }

        const savedText = i18next.t('checkout.saved');
        const successText = i18next.t('checkout.promo_success');
        const limitErrorText = i18next.t('checkout.promo_limit');
        const invalidErrorText = i18next.t('checkout.promo_invalid');
        const serverErrorText = i18next.t('checkout.promo_error');

        if (data.success) {
            currentPromoDiscount = data.discount_percent;
            appliedPromoCode = input;
            
            msg.innerHTML = `<span style="color: var(--accent-green);">[✔] ${successText} ${data.discount_percent * 100}%<br><span style="font-size: 13px;">${savedText}: <b>${data.saved_money} грн</b></span></span>`;
        } else {
            currentPromoDiscount = 0;
            appliedPromoCode = '';
            
            let errorMsg = invalidErrorText;
            if (data.message && data.message.includes('Лимит')) {
                errorMsg = limitErrorText;
            }
            msg.innerHTML = `<span style="color: var(--accent-red);">[!] ${errorMsg}</span>`;
        }
    } catch (err) {
        msg.innerHTML = `<span style="color: var(--accent-red);">[!] ${i18next.t('checkout.promo_error')}</span>`;
    }
    
    btn.innerText = i18next.t('checkout.apply');
    updateCartUI();
}
// --- ИНТЕРАКТИВНЫЙ СВАЙП ДЛЯ КОРЗИНЫ (ВЫБРОСИТЬ ТОВАР) ---
let cartSwipeStartX = 0;
let cartSwipeCurrentX = 0;

window.handleSwipeStart = function(e) {
    cartSwipeStartX = e.touches[0].clientX;
    e.currentTarget.style.transition = 'none'; // Отключаем плавность, чтобы товар "прилип" к пальцу
};

window.handleSwipeMove = function(e) {
    cartSwipeCurrentX = e.touches[0].clientX;
    let diff = cartSwipeStartX - cartSwipeCurrentX;
    
    if (diff > 0) {
        let moveX = diff > 200 ? 200 + (diff - 200) * 0.2 : diff;
        e.currentTarget.style.transform = `translateX(-${moveX}px)`;
        
        let surfaceOpacity = Math.max(0.2, 1 - (moveX / 200));
        e.currentTarget.style.opacity = surfaceOpacity;

        // --- МАГИЯ КОРЗИНЫ ---
        const parentRow = e.currentTarget.closest('.cart-item-row');
        const trashIcon = parentRow.querySelector('.trash-icon');
        const trashLid = parentRow.querySelector('.trash-lid');
        
        if (trashIcon && trashLid) {
            // 1. Иконка плавно появляется из темноты
            let bgOpacity = Math.min(1, moveX / 80); 
            trashIcon.style.opacity = bgOpacity;

            // 2. Крышка приоткрывается (до 45 градусов), если потянули дальше 50px
            if (moveX > 50) {
                let openAngle = Math.min(45, (moveX - 50) * 0.6);
                trashLid.style.transform = `rotate(${openAngle}deg)`;
            } else {
                trashLid.style.transform = `rotate(0deg)`;
            }
        }
    }
};

window.handleSwipeEnd = function(e) {
    let diff = cartSwipeStartX - cartSwipeCurrentX;
    const rowSurface = e.currentTarget;
    const parentRow = rowSurface.closest('.cart-item-row');
    const itemIndex = parseInt(rowSurface.getAttribute('data-index'));
    
    // Возвращаем плавную анимацию
    rowSurface.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    
    // Если протащили больше 120 пикселей — УДАЛЯЕМ
    if (diff > 120) {
        // Товар "улетает" за левый край экрана
        rowSurface.style.transform = `translateX(-150%)`;
        rowSurface.style.opacity = '0';
        
        // Ждем 200мс, пока проиграет анимация, и окончательно удаляем из базы
        setTimeout(() => {
            removeFromCart(itemIndex, null, parentRow);
        }, 200);
    } else {
        // Если не дотянули — возвращаем карточку на место
        rowSurface.style.transform = `translateX(0px)`;
        rowSurface.style.opacity = '1';
        
        // Прячем иконку и захлопываем крышку
        const trashIcon = parentRow.querySelector('.trash-icon');
        const trashLid = parentRow.querySelector('.trash-lid');
        if (trashIcon) trashIcon.style.opacity = '0';
        if (trashLid) trashLid.style.transform = `rotate(0deg)`;
    }
    
    // Сбрасываем переменные
    cartSwipeStartX = 0;
    cartSwipeCurrentX = 0;
};
// ==========================================
// 18. ZERO-LAG СВАЙП КАРТОЧКИ (ИДЕАЛЬНОЕ СЛЕДОВАНИЕ ЗА ПАЛЬЦЕМ)
// ==========================================
function initMobileSwipe() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        const modalWin = overlay.querySelector('.modal-window');
        if (!modalWin) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        let canDrag = false;

        modalWin.addEventListener('touchstart', (e) => {
                if (window.innerWidth > 900) return;
                
                // ЗАЩИТА: Отключаем свайп окна, если юзер листает внутренние списки (правила, заказы, отзывы)
                if (e.target.closest('.modal-gallery') || e.target.closest('.pswp') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('.rules-content') || e.target.closest('.orders-container') || e.target.closest('#reviewsContainerList')) {
                    canDrag = false;
                    return;
                }

                startY = e.touches[0].clientY;
            canDrag = (modalWin.scrollTop <= 0); 
            isDragging = false;

            modalWin.style.transition = 'none';
            overlay.style.transition = 'none';
        }, { passive: true });

        modalWin.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 900 || !canDrag) return;

            currentY = e.touches[0].clientY;
            const diffY = currentY - startY;

            if (diffY > 0) {
                isDragging = true;
                if (e.cancelable) e.preventDefault(); 
                
                // Используем requestAnimationFrame для мгновенной реакции экрана (без задержек)
                requestAnimationFrame(() => {
                    modalWin.style.transform = `translateY(${diffY}px)`;
                    let opacity = 1 - (diffY / window.innerHeight);
                    overlay.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(0, opacity * 0.95)})`;
                });
            } else {
                isDragging = false;
                modalWin.style.transform = `translateY(0px)`;
            }
        }, { passive: false });

        modalWin.addEventListener('touchend', (e) => {
            if (window.innerWidth > 900) return;
            
            if (isDragging) {
                const diffY = currentY - startY;
                isDragging = false;
                canDrag = false;
                
                if (diffY > 150) { 
                    closeModal(overlay.id);
                } else {
                    modalWin.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    overlay.style.transition = 'background-color 0.3s ease';
                    modalWin.style.transform = `translateY(0px)`;
                    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
                }
            }
        });
    });
}
// ==========================================
// ПОЛНАЯ ЛОГИКА ПРЕДЛОЖКИ ТОВАРОВ (DROP_ITEM.EXE)
// ==========================================

// 1. Открытие модального окна предложки
function openProposeModal() {
    if (typeof lenis !== 'undefined') lenis.stop();
    const modal = document.getElementById('proposeModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// 2. Сжатие фото (уменьшает вес в 20 раз, чтобы грузилось мгновенно)
async function compressImage(file) {
    if (file.type === 'video/mp4') return file;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1200;
                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.7);
            };
        };
    });
}

// 3. Полная очистка формы (вызывать после успеха)
function resetProposalForm() {
    const fields = ['propBrand', 'propSize', 'propCond', 'propContact'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const fileInput = document.getElementById('propFiles');
    if (fileInput) fileInput.value = '';
    const container = document.getElementById('propPreviewContainer');
    if (container) container.innerHTML = '';
    const placeholder = document.getElementById('propPlaceholder');
    if (placeholder) placeholder.style.display = 'block';
}

// 4. Логика предпросмотра выбранных фото (срабатывает при выборе файлов)
document.getElementById('propFiles')?.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    const container = document.getElementById('propPreviewContainer');
    const placeholder = document.getElementById('propPlaceholder');

    if (files.length > 5) {
        showToast('Максимум 5 фото!', 'error');
        this.value = '';
        container.innerHTML = '';
        placeholder.style.display = 'block';
        return;
    }

    container.innerHTML = '';
    if (files.length > 0) {
        if (placeholder) placeholder.style.display = 'none';
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = document.createElement('div');
                img.className = 'preview-img';
                img.style.backgroundImage = `url('${event.target.result}')`;
                container.appendChild(img);
            }
            reader.readAsDataURL(file);
        });
    } else {
        if (placeholder) placeholder.style.display = 'block';
    }
});

// 5. Главная функция отправки данных на сервер
// Вспомогательная функция (конвертирует фото в текст для передачи на сервер)
const fileToBase64 = file => new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
});

async function submitProposal() {
    const btn = document.getElementById('btnSubmitProp');
    const fileInput = document.getElementById('propFiles');
    if (!fileInput || !fileInput.files) return;

    const files = fileInput.files;
    const brand = document.getElementById('propBrand').value.trim();
    const size = document.getElementById('propSize').value.trim();
    const cond = parseInt(document.getElementById('propCond').value);
    const contact = document.getElementById('propContact').value.trim();

    if (!files.length || !brand || !size || isNaN(cond) || !contact) {
        showToast('Заполните все поля и прикрепите фото!', 'error');
        return;
    }

    if (cond < 1 || cond > 10) {
        showToast('Оценка состояния от 1 до 10!', 'error');
        return;
    }

    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.7';

    try {
        // ЭТАП 1: РЕАЛЬНЫЙ ПРОГРЕСС СЖАТИЯ
        let compressedFiles = [];
        for (let i = 0; i < files.length; i++) {
            btn.innerText = `[ СЖАТИЕ ФОТО: ${i + 1}/${files.length} ]`;
            const compressed = await compressImage(files[i]);
            compressedFiles.push(compressed);
        }

        // ЭТАП 2: КОНВЕРТАЦИЯ В ТЕКСТ (Занимает миллисекунды)
        btn.innerText = '[ ПОДГОТОВКА ПАКЕТА... ]';
        const base64Images = await Promise.all(compressedFiles.map(f => fileToBase64(f)));

        // ЭТАП 3: ОТПРАВКА НА СЕРВЕР (Ожидание ответа)
        btn.innerText = '[ ПЕРЕДАЧА НА СЕРВЕР... ]';
        
        const res = await fetch('https://nisha-api.onrender.com/api/propose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                brand: brand,
                measurements: size,
                condition: cond,
                contact: contact,
                imagesBase64: base64Images
            })
        });
        
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        // ФИНАЛ: ЗАКРЫТИЕ
        closeModal('proposeModal');
        setTimeout(() => {
            showTerminalModal('SYSTEM_OK.LOG', 'Ваша заявка принята сервером.', '[ ПРИНЯТО ]', null);
            resetProposalForm();
            btn.innerText = '[ ОТПРАВИТЬ ЗАЯВКУ ]';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        }, 400);

    } catch (err) {
        console.error(err);
        showToast('Сбой сервера: ' + err.message, 'error');
        btn.innerText = '[ ПОВТОРИТЬ ПОПЫТКУ ]';
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
    }
}



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
// --- ЛОГИКА ДЛЯ ТОЧЕК В КАРТОЧКАХ ---
window.updateCardDots = function(container, itemId) {
    // Используем ширину контейнера для вычисления индекса
    const index = Math.round(container.scrollLeft / container.offsetWidth);
    const dotsContainer = document.getElementById(`dots-${itemId}`);
    if (dotsContainer) {
        const dots = dotsContainer.querySelectorAll('.card-dot');
        dots.forEach((dot, i) => {
            if (i === index) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }
};

// ==========================================
// ИНФОРМАЦИОННЫЕ ОКНА ДЛЯ БЕЙДЖЕЙ ТОВАРОВ
// ==========================================
window.showBadgeInfo = function(type) {
    let title = '';
    let text = '';

    if (type === 'secure') {
        title = 'SECURE_PAYMENT.EXE';
        
        // Узнаем, можно ли вернуть текущий товар
        const isReturnable = currentOpenedItem && currentOpenedItem.is_returnable === true;
        const isDropItem = currentOpenedItem && (currentOpenedItem.is_drop === true || (currentOpenedItem.tags && currentOpenedItem.tags.map(t => t.toLowerCase()).includes('drop')));

        if (!isReturnable || isDropItem) {
            // Текст для вещей БЕЗ ВОЗВРАТА (Жесткий)
            text = 'NISHA выступает гарантом сделки. Ваши деньги надежно защищены.<br><br>Данная вещь продается <b style="color:var(--accent-red);">без права на возврат или обмен ни при каких условиях</b>.<br><br>Мы настоятельно просим вас внимательно изучать фото, замеры и описание перед оформлением заказа.';
        } else {
            // Текст для вещей С ВОЗВРАТОМ
            text = 'NISHA выступает гарантом сделки. Ваши деньги надежно защищены.<br><br>Вы можете примерить вещь на почте. Даже если вы забрали её домой, на данный товар действует <b style="color:var(--accent-green);">гарантия возврата и обмена в течение 14 дней</b>.<br><br><i>Обязательное условие возврата: сохранение товарного вида и отсутствие следов носки.</i>';
        }
    } else if (type === 'fast') {
        title = 'FAST_SHIPPING.SYS';
        text = 'Отправка заказа осуществляется в день оплаты (при подтверждении до 16:00) или на следующий рабочий день.';
    } else if (type === 'refund_no') {
        title = 'NO_RETURN_POLICY.LOG';
        text = '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ ТОВАР НЕ ПОДЛЕЖИТ ВОЗВРАТУ ]</span><br><br>Мы настоятельно просим вас внимательно изучать фото, замеры и описание перед оформлением заказа.<br><br><b style="color:var(--accent-red);">Данная вещь не подлежит возврату или обмену ни при каких условиях.</b>';
    } else if (type === 'refund_yes') {
        title = 'RETURN_POLICY.SYS';
        text = '<span style="color:var(--accent-green); font-weight:bold; font-size:16px;">[ ДОСТУПЕН ВОЗВРАТ ]</span><br><br>Данный товар подлежит возврату и обмену в течение <b>14 дней</b> с момента покупки, согласно законодательству Украины.<br><br><i>Условие возврата: сохранение товарного вида, всех бирок и отсутствие следов носки.</i>';
    } else if (type === 'drop') {
        title = 'WARNING: DROP_ITEM';
        text = '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ ВНИМАНИЕ ]</span><br><span style="color:#fff;">Эта вещь загружена сторонним продавцом (Creator).</span><br><br>Обязательно проводите полный осмотр вещи на отделении Новой Почты. <b style="color:var(--accent-red);">Если вы забрали посылку домой — возврат или обмен НЕВОЗМОЖЕН</b>, так как деньги сразу переводятся владельцу вещи.';
    }
    
    showTerminalModal(title, text, '[ ПОНЯТНО ]', null);
};
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
// ==========================================
// АВТООПРЕДЕЛЕНИЕ ГОРОДА ПО IP (GEO IP)
// ==========================================
async function autoDetectCity() {
    const cityInput = document.getElementById('orderCity');
    
    // Если поле уже заполнено (например, юзер закрыл и открыл окно), не трогаем его
    if (!cityInput || cityInput.value.trim() !== '') return;

    const originalPlaceholder = cityInput.placeholder;
    cityInput.placeholder = "Поиск спутников..."; // Терминальный вайб

    try {
        // Бесплатный и надежный API без лимитов
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await res.json();

        // Проверяем, что человек из Украины и город определился
        if (data.country_code === 'UA' && data.city) {
            const detectedCity = data.city;
            
            // Вписываем английское название (Новая Почта умеет его переводить в укр)
            cityInput.value = detectedCity;
            
            showToast(`[GEO] Город определен: ${detectedCity}`, 'success');

            // Имитируем, что юзер сам напечатал город, чтобы вылез список Новой Почты
            searchNPCity(detectedCity);
        } else {
            cityInput.placeholder = originalPlaceholder;
        }
    } catch (err) {
        console.error("Ошибка GeoIP:", err);
        cityInput.placeholder = originalPlaceholder;
    }
}
// ==========================================
// УМНЫЙ СБОР ОТЗЫВОВ ЗА ПОЛУЧЕННЫЕ ПОСЫЛКИ
// ==========================================
window.promptOrderReview = function(orderId, itemName, itemImage, itemId) {
    document.getElementById('autoReviewOrderId').value = orderId;
    document.getElementById('autoReviewItemImage').value = itemImage || '';
    document.getElementById('autoReviewItemId').value = itemId || ''; // Сохраняем ID товара
    document.getElementById('autoReviewName').innerText = itemName;
    document.getElementById('autoReviewImg').style.backgroundImage = `url('${itemImage}')`;
    document.getElementById('autoReviewInput').value = ''; 

    if (typeof lenis !== 'undefined') lenis.stop();
    document.getElementById('autoReviewModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.submitAutoReview = async function() {
    const text = document.getElementById('autoReviewInput').value.trim();
    const orderId = document.getElementById('autoReviewOrderId').value;
    const itemImage = document.getElementById('autoReviewItemImage').value;
    const itemId = document.getElementById('autoReviewItemId').value;

    if (text.length < 3) {
        showToast('Текст слишком короткий!', 'error');
        return;
    }

    let uName = userProfile?.username;
    if (!uName || uName === 'User') {
        uName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
    }
    
    // Пишем в БД отзыв вместе с ID заказа, фоткой и ID ТОВАРА
    const { error } = await _supabase.from('reviews').insert([{ 
        user_name: uName, 
        text: text, 
        rating: 5,
        order_id: orderId,
        item_image: itemImage !== '' ? itemImage : null,
        item_id: itemId !== '' ? itemId : null
    }]);
    
    if (!error) {
        showToast('Отзыв опубликован! Спасибо.', 'success');
        let reviewedOrders = JSON.parse(localStorage.getItem('nisha_reviewed_orders') || '[]');
        reviewedOrders.push(orderId);
        localStorage.setItem('nisha_reviewed_orders', JSON.stringify(reviewedOrders));
        closeModal('autoReviewModal');
    } else {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

window.skipAutoReview = function() {
    const orderId = document.getElementById('autoReviewOrderId').value;
    let dismissedOrders = JSON.parse(localStorage.getItem('nisha_dismissed_reviews') || '[]');
    dismissedOrders.push(orderId); 
    localStorage.setItem('nisha_dismissed_reviews', JSON.stringify(dismissedOrders));
    closeModal('autoReviewModal');
};

// ==========================================
// ЛОГИКА НАПИСАНИЯ ОТЗЫВА НА САЙТЕ (КНОПКА ИЗ СПИСКА)
// ==========================================
window.writeReviewOnSite = function() {
    if (!currentUser) {
        showToast(i18next.t('messages.cart_error_auth', {defaultValue: 'Сначала войдите в систему!'}), 'error');
        closeModal('reviewsModal');
        openProfileModal();
        return;
    }

    document.getElementById('manualReviewInput').value = ''; // Очищаем поле
    closeModal('reviewsModal'); // Прячем список отзывов
    
    setTimeout(() => {
        if (typeof lenis !== 'undefined') lenis.stop();
        document.getElementById('writeReviewModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }, 300); // Открываем форму отзыва плавно
};

window.submitManualReview = async function() {
    const text = document.getElementById('manualReviewInput').value.trim();
    
    if (text.length < 3) {
        showToast('Текст слишком короткий!', 'error');
        return;
    }

    const btn = document.querySelector('#writeReviewModal .cart-checkout-btn');
    btn.style.pointerEvents = 'none';
    btn.innerText = '...';

    const uName = userProfile?.username || currentUser.email.split('@')[0];
    
    const { error } = await _supabase.from('reviews').insert([{ user_name: uName, text: text, rating: 5 }]);

    btn.style.pointerEvents = 'auto';
    btn.innerText = 'ОТПРАВИТЬ';

    if (error) {
        showToast('Ошибка при отправке: ' + error.message, 'error');
    } else {
        showToast('Отзыв успешно опубликован!', 'success');
        closeModal('writeReviewModal');
        
        // Магия: ждем пока закроется окно, и заново открываем СПИСОК ОТЗЫВОВ (он скачает свежую базу с твоим отзывом!)
        setTimeout(() => {
            openReviewsModal();
        }, 400);
    }
};
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
// ==========================================
// ЛОГИКА СТРЕЛОЧЕК В ЛЕНТЕ НА ПК
// ==========================================
window.scrollGridSlider = function(event, itemId, direction) {
    // Останавливаем клик, чтобы не открылась карточка товара
    event.stopPropagation();
    
    const slider = document.getElementById(`slider-${itemId}`);
    if (!slider) return;

    // Ширина одной фотографии
    const slideWidth = slider.offsetWidth;
    
    // Скроллим на одну фотку влево (-1) или вправо (1)
    slider.scrollBy({
        left: slideWidth * direction,
        behavior: 'smooth'
    });
};

// Запускаем инициализацию после загрузки
document.addEventListener('DOMContentLoaded', () => {
    initSliderSwipe();
    initMobileSwipe();
    
});
