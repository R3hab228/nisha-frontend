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

function changeLanguage(lng, flag) {
    if (typeof i18next !== 'undefined') {
        i18next.changeLanguage(lng).then(() => {
            updateContentLanguage();
            document.getElementById('currentFlag').innerText = flag;
            document.getElementById('langDropdown').classList.remove('show');
            localStorage.setItem('nisha_lang', lng);
            localStorage.setItem('nisha_flag', flag);
        });
    }
}


// === НАСТРОЙКИ ОБНОВЛЕНИЯ САЙТА ===
const UPDATE_REASON = "Запрет добавления в корзину без регистрации + фикс обучения";

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('[PWA] SW зарегистрирован');
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showTerminalModal(
                            'SYSTEM_UPDATE.EXE',
                            `Вышла новая версия сайта.<br><br><span style="color:var(--accent-yellow); font-family: monospace;">Причина: (${UPDATE_REASON})</span><br><br>Нажмите кнопку ниже, чтобы очистить кэш и применить исправления.`,
                            '[ ОБНОВИТЬ СЕЙЧАС ]',
                            () => {
                                caches.keys().then(names => {
                                    for (let name of names) caches.delete(name);
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
    lerp: 0.1, // lerp вместо duration работает плавнее на 60hz и 120hz экранах
    wheelMultiplier: 1, 
    smoothWheel: true,
    smoothTouch: false, // На телефонах оставляем нативный скролл (он идеален)
    syncTouch: true     // Синхронизируем мобильный скролл с анимациями
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

// Умная кнопка [+] Предложки (Работает везде, даже на телефоне)
let fabTimeout;
let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
    const fab = document.querySelector('.fab-propose');
    if (!fab || fab.classList.contains('cart-active')) return;

    const currentScrollY = window.scrollY;
    
    // Если скроллим вниз (и проскроллили больше 10px для защиты от случайных дерганий)
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
}, { passive: true });


let allItems = []; 
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
    
    setTimeout(() => { 
        if(container.contains(toast)) container.removeChild(toast); 
    }, 3500);
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
            document.body.style.overflow = 'hidden';
            if (typeof lenis !== 'undefined') lenis.stop(); 
        }
    }
}

function showRulesModal() { 
    const modal = document.getElementById('rulesModal');
    if (modal) {
        modal.style.display = 'flex'; 
        document.body.style.overflow = 'hidden'; 
        if (typeof lenis !== 'undefined') lenis.stop(); 
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
            document.addEventListener("visibilitychange", () => {
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
                    // Тихо скачиваем свежую базу в фоне (без лоадеров), чтобы актуализировать плашки SOLD
                    if (_supabase && allItems.length > 0) {
                        loadAllItems(); 
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
            autoAnimate(document.getElementById('ordersListArea'));
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
        container.innerHTML = '<div style="text-align: center; color: #555; font-family: var(--font-mono); padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a;">[ В ДАННЫЙ МОМЕНТ ОТЗЫВЫ ОТСУТСТВУЮТ ]</div>';
        return;
    }
    
    let html = '';
    data.forEach(rev => {
        const date = new Date(rev.created_at).toLocaleDateString('ru-RU');
        html += `
        <div class="review-card-ui">
            <div class="review-head">
                <span class="review-name">@${rev.user_name}</span>
                <span class="review-rating">${'★'.repeat(rev.rating)}</span>
            </div>
            <div class="review-text-body">${rev.text}</div>
            <div class="review-date">${date}</div>
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

            // Берем имя из профиля БД, если его нет — из метаданных Google, если и там нет — ставим Email или Гость
            const uName = userProfile?.username || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
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
            
          // ЧИСТАЯ ЗАГРУЗКА КОРЗИНЫ АВТОРИЗОВАННОГО ПОЛЬЗОВАТЕЛЯ
            if (userProfile && userProfile.cart && userProfile.cart.length > 0) {
                cart = userProfile.cart; 
                localStorage.setItem('nisha_cart', JSON.stringify(cart));
            } else {
                // Если корзина в БД пуста, но юзер что-то накликал как гость - сохраняем это в БД
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

function getOptimizedImageUrl(item, wantsThumb = false) {
    if (!item) return '';
    if (wantsThumb && item.thumbnails && item.thumbnails.length > 0) {
        return item.thumbnails[0];
    }
    return (item.images && item.images.length > 0) ? item.images[0] : '';
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
                // Очищаем поисковый запрос от решетки, если юзер ввел "#nike"
                const cleanSearchTerm = searchTerm.replace(/#/g, '').trim();
                
                const fuseOptions = {
                    includeScore: true, 
                    threshold: 0.3, // Сделали поиск более строгим, чтобы не выдавал мусор
                    ignoreLocation: true, // Ищет слово в любом месте строки
                    keys: [
                        { name: 'name', weight: 0.6 }, 
                        { name: 'brand', weight: 0.5 }, 
                        { name: 'tags', weight: 0.8 }, // Теги имеют самый высокий приоритет!
                        { name: 'category', weight: 0.3 }
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
                
                return matchesCategory && matchesBrand && matchesSize && matchesFav && matchesPrice;
            });
            
            if (grid) grid.innerHTML = ''; 
            renderedCount = 0; 
            
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
function renderNextBatch() {
    const batchSize = 12;
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;
    
    const end = Math.min(renderedCount + batchSize, filteredItems.length);
    
    for (let i = renderedCount; i < end; i++) {
        try {
            const item = filteredItems[i];
            if (!item) continue;
            
            let badgeHTML = '';
            let extraClasses = '';
            
            if (item.status === 'sold') { 
                extraClasses = 'sold-out'; 
                badgeHTML = '<div class="sold-badge">SOLD</div>'; 
            } else if (item.status === 'reserved') { 
                extraClasses = 'reserved-item'; 
                badgeHTML = '<div class="reserved-badge">RESERVED</div>'; 
            } else {
                // Если товар свободен, проверяем скидку и популярность
                let saleHTML = (item.is_sale && item.old_price && !isHacked) ? '<div class="sale-badge-card">% SALE</div>' : '';
                
                // ЛОГИКА HOT: Если у вещи 15 или больше просмотров
                let hotHTML = '';
                const viewCount = item.views_count || 0;
                if (viewCount >= 15) {
                    // Используем currentColor, чтобы иконка автоматически покрасилась в синий цвет текста
                    const chartSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
                    hotHTML = `<div class="hot-badge-card" title="Эту вещь часто смотрят">${chartSvg} HOT</div>`;
                }

                // Объединяем бейджи в один контейнер
                if (saleHTML || hotHTML) {
                    badgeHTML = `<div class="badges-container">${saleHTML}${hotHTML}</div>`;
                }
            }

            // ВАЖНО: Определяем картинку и видео ровно один раз!
            const optImg = getOptimizedImageUrl(item, false);
            const isVideo = item.images && item.images.length > 0 && item.images[0].endsWith('.mp4');
            
            let itemPrice = Number(item.price) || 0;
            let finalPrice = isHacked ? Math.floor(itemPrice * 0.9) : itemPrice;
            let priceHTML = isHacked 
                ? `<span class="old-price">${itemPrice} грн</span> ${finalPrice} грн<span class="hacked-price-tag">[HACKED]</span>` 
                : (item.old_price ? `<span class="old-price">${item.old_price} грн</span> ${finalPrice} грн` : `${finalPrice} грн`);

            const starClass = favorites.includes(item.id) ? 'fav-star active' : 'fav-star';

            const card = document.createElement('div');
            card.className = `item-card ${extraClasses}`;
            card.setAttribute('data-id', item.id);
            
            const safeName = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(item.name || 'Без названия') : (item.name || 'Без названия');
            const safeBrand = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(item.brand || 'No brand') : (item.brand || 'No brand');
            const safeSize = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(item.size || '-') : (item.size || '-');

          // ГОТОВИМ БЛОК ФОТО/ВИДЕО
            let mediaHTML = '';
            if (isVideo) {
                const videoUrl = item.images[0];
                mediaHTML = `
                    <div class="mock-image" id="img-${item.id}" style="position: relative; overflow: hidden; padding: 0; background: #0a0a0a;">
                        <!-- Перенесли плашку VIDEO в ЛЕВЫЙ НИЖНИЙ УГОЛ (bottom: 8px), чтобы не перекрывала бейджики -->
                        <div style="position:absolute; z-index:5; bottom:8px; left:8px; background:rgba(0,0,0,0.8); padding:4px 8px; border-radius:3px; color:var(--accent-green); font-size:10px; font-family:var(--font-mono); border: 1px solid #333; pointer-events: none;">▶ VIDEO</div>
                        <video 
                            class="grid-lazy-video"
                            src="${videoUrl}#t=0,3" 
                            muted 
                            loop 
                            playsinline 
                            webkit-playsinline
                            preload="metadata"
                            style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;"
                        ></video>
                    </div>`;
            } else {
                mediaHTML = `<div class="mock-image skeleton" id="img-${item.id}" style="position: relative; overflow: hidden;"></div>`;
            }
            
            card.innerHTML = `
                ${badgeHTML}
                <div class="${starClass}">★</div>
                <div class="card-clickable-area" style="display:flex; flex-direction:column; flex-grow:1;">
                    ${mediaHTML}
                    <div class="item-info">
                        <h3 class="item-title">${safeName}</h3>
                        <div class="item-price">${priceHTML}</div>
                        <div class="item-size"><span data-i18n="grid.size_prefix">${i18next.t('grid.size_prefix')}</span>${safeSize}</div>
                        <div class="item-footer"><span>${safeBrand}</span><span>${item.condition || '9/10'}</span></div>
                    </div>
                    <button class="grid-cart-btn" style="${item.status === 'sold' ? 'display:none;' : ''}" data-i18n="product.add_to_cart">${i18next.t('product.add_to_cart')}</button>
                </div>
            `;

            // ЗАГРУЗКА ТОЛЬКО ДЛЯ ФОТО (Ленивая и асинхронная)
            if (!isVideo && optImg) {
                const imgLoader = new Image();
                imgLoader.decoding = "async"; // Асинхронная декодировка (не тормозит UI)
                imgLoader.onload = () => {
                    const imgDiv = card.querySelector(`#img-${item.id}`);
                    if (imgDiv) {
                        imgDiv.classList.remove('skeleton');
                        imgDiv.style.backgroundImage = `url('${optImg}')`;
                    }
                };
                imgLoader.onerror = () => {
                    const imgDiv = card.querySelector(`#img-${item.id}`);
                    if (imgDiv) {
                        imgDiv.classList.remove('skeleton');
                        imgDiv.innerText = i18next.t('grid.no_photo');
                    }
                };
                imgLoader.src = optImg;
            }
            // Нажатие на звездочку
            card.querySelector('.fav-star').addEventListener('click', (e) => toggleFav(e, item.id));
            
            // Нажатие на карточку (открывает модалку)
            card.querySelector('.card-clickable-area').addEventListener('click', (e) => {
                if (e.target.closest('.grid-cart-btn')) return; 
                openProductModal(item);
            });

            // Нажатие СТРОГО на кнопку "В корзину"
            const cartBtn = card.querySelector('.grid-cart-btn');
            if (cartBtn) {
                cartBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation(); 
                    addToCartWithAnimation(item.id, cartBtn, e);
                });
            }

           grid.appendChild(card);

            // Если это видео - отдаем его нашему умному наблюдателю!
            if (isVideo) {
                const vidNode = card.querySelector('.grid-lazy-video');
                if (vidNode) gridVideoObserver.observe(vidNode);
            }

            const oldPriceEl = card.querySelector('.old-price');
            if (oldPriceEl && typeof RoughNotation !== 'undefined') {
                setTimeout(() => RoughNotation.annotate(oldPriceEl, { type: 'strike-through', color: '#ff0000', strokeWidth: 3 }).show(), 300);
            }
            
            // ОПТИМИЗАЦИЯ VanillaTilt
            if (typeof VanillaTilt !== 'undefined' && window.innerWidth > 900) {
                VanillaTilt.init(card, { 
                    max: 3, speed: 2000, glare: false, scale: 1.0, 
                    "mouse-event-element": card 
                });
            }
        } catch (cardErr) {
            console.error("Ошибка при отрисовке карточки:", cardErr);
        }
    }
    renderedCount = end;
    
    const trigger = document.getElementById('loadingTrigger');
    if (trigger) {
        trigger.innerText = (renderedCount >= filteredItems.length) ? i18next.t('grid.end_list') : i18next.t('grid.scroll_more');
    }

    setTimeout(() => {
        if (trigger && renderedCount < filteredItems.length) {
            const rect = trigger.getBoundingClientRect();
            // Если триггер находится в пределах видимости экрана
            if (rect.top < window.innerHeight + 300) {
                renderNextBatch(); // Вызываем саму себя (рекурсия), пока не появится скролл
            }
        }

        }, 100);
}

// --- ОТДЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ТУРА (ВЫЗЫВАЕТСЯ СРАЗУ ПОСЛЕ ПРАВИЛ) ---
function startOnboardingTour() {
    if (!localStorage.getItem('nisha_rules_accepted') || localStorage.getItem('nisha_tour_done') || typeof window.driver === 'undefined') return;

    // Ждем секунду, чтобы сайт 100% прогрузился и сетка товаров встала на места
    setTimeout(() => {
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
    document.getElementById('cartTotal').innerText = total + ' грн';
    
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
        const res = await fetch('https://nisha-api.onrender.com/api/np-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                modelName: 'InternetDocument', 
                calledMethod: 'getDocumentPrice', 
                methodProperties: { 
                    CitySender: "8d5a980d-391c-11dd-90d9-001a92567626", // Ref Киева (как отправителя)
                    CityRecipient: selectedCityRef,
                    Weight: "1",
                    ServiceType: "WarehouseWarehouse",
                    Cost: totalCost.toString()
                } 
            })
        });
        const responseData = await res.json();
        
        if(responseData.success && responseData.data.length > 0) {
            document.getElementById('calcCostVal').innerText = responseData.data[0].Cost + " грн";
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

    // Предупреждение о том, что товары не забронированы (Спокойный дизайн)
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
            <div class="swipe-background" onclick="removeFromCart(${index}, event, this.closest('.cart-item-row'))">УДАЛИТЬ</div>
            <div class="swipe-surface" 
                 ontouchstart="handleSwipeStart(event)" 
                 ontouchmove="handleSwipeMove(event)" 
                 ontouchend="handleSwipeEnd(event)">
                <div class="cart-item-img" style="background-image: url('${imgUrl}')"></div>
                <div class="cart-item-info">
                    <div class="cart-item-name" title="${item.name}">${item.name}</div>
                    <div class="cart-item-size">${i18next.t('grid.size_prefix')}${item.size}</div>
                </div>
                <div class="cart-item-price-wrapper">
                    <div class="cart-item-price">${item.price} грн</div>
                    <div class="cart-item-remove hide-on-mobile" onclick="removeFromCart(${index}, event, this.closest('.cart-item-row'))" title="Удалить">×</div>
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

function checkPhoneAuth() {
    const btnSubmit = document.getElementById('btnSubmitOrder');
    const btnOtp = document.getElementById('btnGetOtp');
    const statusOtp = document.getElementById('otpStatus');
    
    if (currentUser) {
        otpVerified = true;
        btnSubmit.style.opacity = "1";
        btnSubmit.style.pointerEvents = "auto";
        if(btnOtp) btnOtp.style.display = "none";
        if(statusOtp) statusOtp.style.display = "none";
    } else {
        otpVerified = false;
        btnSubmit.style.opacity = "0.5";
        btnSubmit.style.pointerEvents = "none";
        if(btnOtp) btnOtp.style.display = "block";
        if(statusOtp) statusOtp.style.display = "block";
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

    const { data: blacklisted } = await _supabase.from('blacklist').select('phone').eq('phone', cleanPhone).limit(1);
    
   const btnOtp = document.getElementById('btnGetOtp');
    if (btnOtp.disabled) return; 
    
    // 1. СНАЧАЛА ПРОВЕРЯЕМ БАЗУ: ВДРУГ НОМЕР УЖЕ ПОДТВЕРЖДЕН?
    const { data: existCode } = await _supabase.from('otp_codes').select('is_verified').eq('phone', cleanPhone).limit(1);
    if (existCode && existCode.length > 0 && existCode[0].is_verified) {
        otpVerified = true;
        document.getElementById('otpStatus').innerHTML = "<span style='color:var(--accent-green); font-weight:bold;'>[✔] Этот номер уже есть в базе и подтвержден!</span>";
        
        btnOtp.disabled = true; 
        btnOtp.innerHTML = "<span style='color:var(--accent-green); font-weight:bold;'>УСПЕХ!</span>";
        btnOtp.style.background = "var(--text-main)"; // Оставляем стандартный серый фон
        btnOtp.style.borderColor = "var(--accent-green)"; // Даем зеленую рамку
        btnOtp.style.opacity = "1";
        btnOtp.style.display = "block";
        
        const btnSubmit = document.getElementById('btnSubmitOrder');
        btnSubmit.style.opacity = "1";
        btnSubmit.style.pointerEvents = "auto";
        return; // Останавливаем выполнение, код слать не нужно
    }

    // 2. ПРОВЕРКА НА БОТА (reCAPTCHA v3)
    btnOtp.innerText = "Проверка...";
    const isHuman = await verifyCaptchaAction('request_otp');
    if (!isHuman) {
        btnOtp.innerText = "Подтвердить";
        return; 
    }

    if (blacklisted && blacklisted.length > 0) {
        document.getElementById('otpStatus').innerHTML = "<span style='color:red; font-weight:bold;'>[!] ОШИБКА БЕЗОПАСНОСТИ. ВАШ НОМЕР ЗАБЛОКИРОВАН.</span>";
        showToast('Доступ запрещен', 'error');
        btnOtp.innerText = "Подтвердить";
        return; 
    }
    
    btnOtp.disabled = true;
    let timer = 60;
    btnOtp.innerText = `Ждите ${timer}с`;
    btnOtp.style.opacity = "0.5";
    
    // Очищаем старый таймер, если он был
    if (otpInterval) clearInterval(otpInterval);
    
    // Сохраняем в глобальную переменную, чтобы можно было убить снаружи
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

    // ВЫЗЫВАЕМ БЕЗОПАСНУЮ ГЕНЕРАЦИЮ НА СЕРВЕРЕ (Хакер не видит код)
    const { error } = await _supabase.rpc('generate_secure_otp', { p_phone: cleanPhone });
    
    if (error) {
        showToast('Ошибка сервера', 'error');
        return;
    }
    
    const payloadPhone = cleanPhone.replace('+', '');
    const tgLink = `https://t.me/nisha_store1_bot?start=otp_${payloadPhone}`;
    
    
    if (/android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase())) {
        window.location.href = tgLink;
    } else {
        window.open(tgLink, '_blank');
    }
    
    document.getElementById('otpStatus').innerHTML = "Перейдите в бота и нажмите 'СТАРТ' для подтверждения... <span style='color:var(--accent-yellow)'>⏳</span>";
    
    // ОТКЛЮЧАЕМ СТАРУЮ ПОДПИСКУ, ЕСЛИ ОНА БЫЛА
    if (otpRealtimeChannel) _supabase.removeChannel(otpRealtimeChannel);

    // СЛУШАЕМ БАЗУ ЧЕРЕЗ REALTIME (БЕЗ НАГРУЗКИ ТАЙМЕРАМИ)
    otpRealtimeChannel = _supabase.channel('custom-otp-channel')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'otp_codes',
            filter: `phone=eq.${cleanPhone}` // Слушаем только свой номер!
        }, payload => {
            if (payload.new.is_verified) {
                otpVerified = true;
                document.getElementById('otpStatus').innerHTML = "<span style='color:var(--accent-green); font-weight:bold;'>[✔] Номер подтвержден! Можно завершать заказ.</span>";
                
                const btnSubmit = document.getElementById('btnSubmitOrder');
                btnSubmit.style.opacity = "1";
                btnSubmit.style.pointerEvents = "auto";
                
                // === ЖЕСТКО УБИВАЕМ ТАЙМЕР И ОБНОВЛЯЕМ КНОПКУ ===
                let id = window.setTimeout(function() {}, 0);
                while (id--) { window.clearTimeout(id); }

                const btnOtp = document.getElementById('btnGetOtp');
                if (btnOtp) {
                    btnOtp.disabled = true; 
                    btnOtp.innerHTML = "<span style='color:var(--accent-green); font-weight:bold;'>УСПЕХ!</span>";
                    btnOtp.style.background = "var(--text-main)"; // Серый фон
                    btnOtp.style.borderColor = "var(--accent-green)"; // Зеленая рамка
                    btnOtp.style.opacity = "1";
                    btnOtp.style.display = "block";
                }
                
                _supabase.removeChannel(otpRealtimeChannel); // Отключаемся, дело сделано
            }
        })
        .subscribe();
}

async function openCheckoutModal() { 
    // 1. БЫСТРАЯ ПРОВЕРКА: А вдруг товар уже купили, пока он лежал в корзине?
    const btn = document.querySelector('.cart-checkout-btn');
    const originalText = btn.innerText;
    btn.innerText = "[ ПРОВЕРКА НАЛИЧИЯ... ]";
    btn.style.pointerEvents = "none";

    const itemIds = cart.map(i => i.id);
    const { data: dbItems, error } = await _supabase.from('items').select('id, name, status').in('id', itemIds);

    let hasSoldItems = false;
    if (dbItems && !error) {
        // Фильтруем корзину, оставляя только доступные товары
        cart = cart.filter(cartItem => {
            const dbItem = dbItems.find(i => i.id === cartItem.id);
            if (!dbItem || dbItem.status !== 'available') {
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
    
    // Если юзер уже нажимал "Пропустить" в прошлом заказе — сразу оформляем без Email
    if (savedEmailPreference === 'skipped') {
        return await executeOrderFinal('');
    }
    
    // Если юзер уже нажимал "ДА" и ввел Email — берем сохраненный Email
    if (savedEmailPreference && savedEmailPreference.includes('@')) {
        return await executeOrderFinal(savedEmailPreference);
    }

    // Если всё ок и юзер делает заказ впервые — открываем окно вопроса про Email
    const prompt = document.getElementById('emailPromptOverlay');
    const emailInput = document.getElementById('promptEmailInput');
    
    if (currentUser && currentUser.email) {
        emailInput.value = currentUser.email;
    } else {
        emailInput.value = '';
    }
    
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
        if(guestText) guestText.innerHTML = `ДОСТУП РАЗРЕШЕН. ПРОФИЛЬ: <span style="color:var(--accent-green); font-weight:bold;">${userProfile?.username || currentUser.email}</span>`;
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

async function fetchMyOrders() {
    const listArea = document.getElementById('ordersListArea');
    if(!listArea) return;
    listArea.innerHTML = '<div style="text-align:center; color:#aaa; font-family: monospace;">[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]</div>';

    let ordersData = [];
    let fetchError = null;

    if (currentUser) {
        const { data, error } = await _supabase.from('orders').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        ordersData = data; fetchError = error;
    } else {
        const phoneInput = document.getElementById('ordersSearchPhone');
        const phone = phoneInput ? phoneInput.value.replace(/[^\d+]/g, '') : '';
        if (!phone || phone.length < 10) { 
            showToast('Введите корректный номер телефона!', 'error'); 
            listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace;">[ НОМЕР НЕ ВВЕДЕН ]</div>';
            return; 
        }

        // ЗАЩИТА: Проверяем, подтверждал ли он этот номер через OTP в текущей сессии
        const { data: otpCheck } = await _supabase.from('otp_codes').select('is_verified').eq('phone', phone).limit(1);
        if (!otpCheck || otpCheck.length === 0 || !otpCheck[0].is_verified) {
            listArea.innerHTML = `<div style="text-align:center; color:var(--accent-red); font-family: monospace; padding: 20px;">[ ДОСТУП ЗАПРЕЩЕН ]<br><br>Сначала подтвердите, что это ваш номер.</div>
            <button class="cart-checkout-btn btn-target" style="margin: 0 auto; display: block;" onclick="document.getElementById('orderPhone').value='${phone}'; generateAndSendOTP();">ПОДТВЕРДИТЬ НОМЕР В БОТЕ</button>`;
            return;
        }

        const { data, error } = await _supabase.rpc('get_orders_by_phone', { search_phone: phone });
        ordersData = data; fetchError = error;
    }

    if (fetchError) { 
        listArea.innerHTML = `<div style="color:red; text-align:center;">[ ОШИБКА: ${fetchError.message} ]</div>`; 
        return; 
    }

    if (!ordersData || ordersData.length === 0) { 
        listArea.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a;">
                <div style="font-size: 30px; margin-bottom: 15px;">📦</div>
                <div style="color:var(--accent-red); font-family: var(--font-mono); font-weight:bold; margin-bottom: 10px;">${i18next.t('orders_modal.empty_title')}</div>
                <div style="color:#888; font-size: 13px; line-height: 1.5;">${i18next.t('orders_modal.empty_desc')}</div>
            </div>`; 
        return; 
    }

    listArea.innerHTML = '';
    ordersData.forEach(order => {
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

        listArea.innerHTML += `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-id">ЗАКАЗ #${order.id.split('-')[0].toUpperCase()} <span style="color:#666; font-weight:normal;">(${date})</span></span>
                    <span class="order-status status-${order.status}">${order.status.toUpperCase()}</span>
                </div>
                <div class="order-items-list">${itemsHtml}</div>
                <div class="order-footer">${ttnHtml}<div class="order-total">ИТОГО: ${order.total_sum} грн</div></div>
            </div>`;
    });

    // Генерация штрих-кодов через JsBarcode
    if (typeof JsBarcode !== 'undefined') {
        document.querySelectorAll('.barcode-svg').forEach(svg => {
            const ttn = svg.getAttribute('data-ttn');
            if (ttn) {
                JsBarcode(svg, ttn, {
                    format: "CODE128",
                    lineColor: "#000",
                    background: "transparent",
                    width: 1.5,
                    height: 50,
                    displayValue: false
                });
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
        closeModal('ordersModal'); 
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
    document.getElementById('modalItemPrice').innerText = finalPrice + ' грн';
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
            <strong style="color: #fff; font-family: var(--font-mono);">РАЗМЕР:</strong> 
            <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${item.size}</span>
        </div>
        <div style="margin-bottom: 15px;">
            <strong style="color: #fff; font-family: var(--font-mono);">БРЕНД:</strong> 
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
                // Сервер сам проверит, был ли уже просмотр от этого юзера/железа. 
                // Если не было — накинет +1 и вернет новую цифру.
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
        
        // НОВАЯ УМНАЯ ЛОГИКА РЕКОМЕНДАЦИЙ
        let similar = allItems.filter(i => i.id !== item.id && (i.category === item.category || i.brand === item.brand));
        
        // Если похожих брендов/категорий мало (меньше 4), добиваем товарами примерно той же цены (+- 30%)
        if (similar.length < 4) {
            const priceMargin = item.price * 0.3;
            const extra = allItems.filter(i => i.id !== item.id && !similar.includes(i) && i.price >= item.price - priceMargin && i.price <= item.price + priceMargin);
            similar = [...similar, ...extra];
        }
        
        // Берем ровно 4 штуки, случайным образом перемешанные (чтобы не показывалось одно и то же)
        similar = similar.sort(() => 0.5 - Math.random()).slice(0, 4);
            
        if(similar.length > 0) {
            similar.forEach(s => {
                const sImg = getOptimizedImageUrl(s, true); // Миниатюра для похожих
                simCont.innerHTML += `
                    <div style="min-width: 120px; cursor: pointer; border: 1px solid #333; background: #000; transition: 0.2s;" onmouseover="this.style.borderColor='var(--accent-green)'" onmouseout="this.style.borderColor='#333'" onclick="openProductModalById('${s.id}')">
                        <div style="height: 100px; background-image:url('${sImg}'); background-size: cover; background-position: center;"></div>
                        <div style="padding: 8px; font-size: 11px; color: #fff; font-family: var(--font-mono); text-align: center;">${s.price} грн</div>
                    </div>`;
            });
        } else {
            simCont.innerHTML = '<div style="color:#555; font-size:12px; font-family: var(--font-mono);">Похожих товаров пока нет.</div>';
        }
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
    document.getElementById('sliderWrapper').style.transform = `translateX(-${currentSlide * 100}%)`;
    
    // Обновляем счетчик
    const counter = document.getElementById('photoCounter');
    totalSlides = document.querySelectorAll('.slide').length;
    if (counter) counter.innerText = `[ ${currentSlide + 1} / ${totalSlides} ]`;

    // Обновляем миниатюры
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
        const { error } = await _supabase.from('waitlist').insert([{ 
            item_id: currentOpenedItem.id, 
            phone: phoneOrTg.trim() 
        }]);
        
        if (error) {
            Swal.fire({ icon: 'error', title: 'ОШИБКА', text: 'Вы уже подписаны на эту вещь!', background: '#111', color: '#fff', confirmButtonColor: '#333' });
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
function addToHistory(item) {
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    hist = hist.filter(i => i.id !== item.id);
    const img = (item.images && item.images.length > 0) ? item.images[0] : '';
    
    hist.unshift({ id: item.id, name: item.name, price: item.price, img: img });
    if(hist.length > 8) hist.pop(); 
    
    localStorage.setItem('nisha_history', JSON.stringify(hist));
    renderHistory();
}

// Изменено под создание DOM элементов для AutoAnimate и Tilt
// Изменено под создание DOM элементов для AutoAnimate, Tilt и поддержку ВИДЕО
// Изменено под создание DOM элементов для AutoAnimate, Tilt и жесткую загрузку медиа
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
        
        const card = document.createElement('div');
        card.className = 'history-card';
        card.onclick = () => openProductModalById(h.id);
        
        // Готовим надежный HTML для медиа-блока (Без lozad.js)
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
                // Картинка: надежный background-image
                mediaHTML = `<div style="width:100%; height:100%; background-image:url('${optImg}'); background-size:cover; background-position:center;"></div>`;
            }
        }
        
        card.innerHTML = `
            <div class="history-img" style="position: relative; overflow: hidden; padding: 0;">
                ${mediaHTML}
            </div>
            <div class="history-info">
                <div class="history-name" title="${h.name}">${h.name}</div>
                <div class="history-price">${h.price} грн</div>
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
    try {
        if (!_supabase) return;
        
        const counterEl = document.getElementById('hitCounterValue');
        if (!counterEl) return;

        // Генерируем уникальный отпечаток устройства через FingerprintJS
        let visitorId = "unknown";
        if (typeof FingerprintJS !== 'undefined') {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            visitorId = result.visitorId; // Уникальный хэш железа/браузера
            clientFingerprint = visitorId; // Запоминаем для анти-спама просмотров
        }

        const today = new Date().toLocaleDateString('en-CA'); 
        
        // Проверяем по LocalStorage с привязкой к ID железа
        const lastVisitData = JSON.parse(localStorage.getItem('nisha_visit_data') || '{}');

        // Если сегодня еще не заходили с этого устройства
        if (lastVisitData.date !== today || lastVisitData.id !== visitorId) {
            localStorage.setItem('nisha_visit_data', JSON.stringify({ date: today, id: visitorId }));
            
            // Записываем визит в базу
            await _supabase.rpc('increment_daily_visitor');
        }

        // Скачиваем актуальное число посещений
        const { data, error } = await _supabase
            .from('daily_visits')
            .select('visitor_count')
            .eq('visit_date', today)
            .limit(1);

        let count = 1;
        if (!error && data && data.length > 0) {
            count = data[0].visitor_count;
        }

        const strCount = count.toString().padStart(5, '0');
        counterEl.innerText = strCount.split('').join(' ');

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
    sidebar.classList.toggle('active-mobile');
    
    if (sidebar.classList.contains('active-mobile')) {
        btn.innerText = '[-] СКРЫТЬ ФИЛЬТРЫ';
        btn.style.borderColor = 'var(--accent-red)';
        btn.style.color = 'var(--accent-red)';
    } else {
        btn.innerText = '[+] ПОКАЗАТЬ ФИЛЬТРЫ';
        btn.style.borderColor = '#444';
        btn.style.color = 'var(--accent-green)';
    }
}
// Задержка поиска, чтобы не лагало при быстром вводе текста
let searchDebounce;
function handleLiveSearch() {
    clearTimeout(searchDebounce);
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchTerm = document.getElementById('mainSearch').value.trim();

    // НОВАЯ ФИШКА: Если юзер начал искать, выключаем режим "Только избранное"
    if (searchTerm.length > 0 && showingOnlyFavs) {
        showingOnlyFavs = false;
        const favNav = document.getElementById('favNav');
        if (favNav) favNav.style.color = 'var(--accent-yellow)';
    }

    if (searchTerm.length < 2) {
        dropdown.style.display = 'none';
        applyFilters(); // Обновляем основную сетку, если стерли текст
        return;
    }

    searchDebounce = setTimeout(() => {
        // Поиск через Fuse.js
        const cleanSearchTerm = searchTerm.replace(/#/g, '').trim();
        const fuseOptions = {
            includeScore: true, 
            threshold: 0.3, 
            ignoreLocation: true,
            keys: [
                { name: 'name', weight: 0.6 }, 
                { name: 'brand', weight: 0.5 },
                { name: 'tags', weight: 0.8 } // Поиск по тегам в живом поиске
            ]
        };
        const fuse = new Fuse(allItems, fuseOptions);
        const results = fuse.search(cleanSearchTerm).slice(0, 5); // Берем топ 5 совпадений

        dropdown.innerHTML = '';
        if (results.length > 0) {
            results.forEach(result => {
                const item = result.item;
                const img = getOptimizedImageUrl(item, true); // ПРАВИЛЬНЫЙ вызов функции картинок
                dropdown.innerHTML += `
                    <div class="live-search-item" onclick="openProductModalById('${item.id}'); document.getElementById('liveSearchDropdown').style.display='none';">
                        <div class="live-search-img" style="background-image: url('${img}')"></div>
                        <div class="live-search-info">
                            <span class="live-search-title">${item.name}</span>
                            <span class="live-search-price">${item.price} грн</span>
                        </div>
                    </div>`;
            });
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = '<div style="padding: 10px; color: #666; font-family: monospace; text-align: center;">[ СОВПАДЕНИЙ НЕТ ]</div>';
            dropdown.style.display = 'block';
        }
        
        applyFilters(); // Параллельно фильтруем фоновую сетку
    }, 300);
}

// Скрываем дропдаун при клике вне него
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        const dropdown = document.getElementById('liveSearchDropdown');
        if (dropdown) dropdown.style.display = 'none';
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
    const shareUrl = `https://https://nisha-store.shop/?item=${currentOpenedItem.id}`;
    
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
    
    // Ищем промокод в Базе Данных (С учетом лимитов)
    const { data, error } = await _supabase
        .from('promo_codes')
        .select('discount_percent, is_active, max_uses, current_uses')
        .eq('code', input)
        .limit(1);

    if (data && data.length > 0 && data[0].is_active) {
        const promo = data[0];
        
        // Проверяем лимит на фронтенде
        if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
            currentPromoDiscount = 0;
            appliedPromoCode = '';
            msg.innerHTML = `<span style="color: var(--accent-red);">[!] Лимит активаций этого кода исчерпан</span>`;
        } else {
            currentPromoDiscount = promo.discount_percent;
            appliedPromoCode = input;
            
            // Считаем экономию
            const originalTotal = cart.reduce((sum, item) => sum + item.price, 0);
            const savedMoney = Math.floor(originalTotal * currentPromoDiscount);
            
            msg.innerHTML = `<span style="color: var(--accent-green);">[✔] Код активирован! Скидка ${currentPromoDiscount * 100}%<br><span style="font-size: 13px;">Вы сэкономили: <b>${savedMoney} грн</b></span></span>`;
        }
    } else {
        currentPromoDiscount = 0;
        appliedPromoCode = '';
        msg.innerHTML = `<span style="color: var(--accent-red);">[!] Неверный или неактивный код</span>`;
    }
    
    btn.innerText = 'ПРИМЕНИТЬ';
    updateCartUI();
}
// --- ЛОГИКА СВАЙПА В КОРЗИНЕ (SWIPE TO DELETE) ---
let touchStartX = 0;
let touchCurrentX = 0;

function handleSwipeStart(e) {
    touchStartX = e.touches[0].clientX;
    e.currentTarget.style.transition = 'none'; // Убираем плавность при ведении пальцем
}

function handleSwipeMove(e) {
    touchCurrentX = e.touches[0].clientX;
    let diff = touchStartX - touchCurrentX;
    
    // Разрешаем тянуть только влево (до 80px)
    if (diff > 0 && diff < 100) {
        e.currentTarget.style.transform = `translateX(-${diff}px)`;
    }
}

function handleSwipeEnd(e) {
    let diff = touchStartX - touchCurrentX;
    e.currentTarget.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    
    // Если свайпнули больше чем на 50px - фиксируем открытую кнопку
    if (diff > 50) {
        e.currentTarget.style.transform = `translateX(-80px)`;
    } else {
        // Иначе возвращаем обратно
        e.currentTarget.style.transform = `translateX(0px)`;
    }
}
// ==========================================
// 18. УМНЫЙ СВАЙП (БЕЗ КОНФЛИКТА СО СКРОЛЛОМ)
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
            
            // Защита: не активируем свайп, если трогаем фото, кнопки или вводим текст
            if (e.target.closest('.modal-gallery') || e.target.closest('.pswp') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                canDrag = false;
                return;
            }

            startY = e.touches[0].clientY;
            
            // КЛЮЧЕВОЙ МОМЕНТ: свайп разрешен только если скролл окна на нуле (самый верх)
            canDrag = (modalWin.scrollTop <= 0); 
            isDragging = false;

            // Сбрасываем стили перед началом движения
            modalWin.style.transition = 'none';
            overlay.style.transition = 'none';
        }, { passive: true });

        modalWin.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 900 || !canDrag) return;

            currentY = e.touches[0].clientY;
            const diffY = currentY - startY;

            // Тянем окно вниз только если палец движется ВНИЗ и мы в топе списка
            if (diffY > 0) {
                isDragging = true;
                
                // Блокируем системный скролл браузера, чтобы окно не дергалось
                if (e.cancelable) e.preventDefault(); 
                
                // Сдвигаем окно в реальном времени за пальцем
                modalWin.style.transform = `translateY(${diffY}px)`;
                
                // Затемняем фон в зависимости от силы потяжки
                let opacity = 1 - (diffY / window.innerHeight);
                overlay.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(0, opacity * 0.95)})`;
            } else {
                // Если потянули ВВЕРХ — отключаем режим свайпа и даем работать обычному скроллу
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
                    // Если протащили достаточно далеко — закрываем
                    closeModal(overlay.id);
                } else {
                    // Если мало — возвращаем окно на место с анимацией
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
// ЛОГИКА ПРЕДЛОЖКИ ТОВАРОВ (CREATORS)
// ==========================================
function openProposeModal() {
    if (typeof lenis !== 'undefined') lenis.stop();
    document.getElementById('proposeModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Предпросмотр загружаемых фото в предложке
document.getElementById('propFiles')?.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    const container = document.getElementById('propPreviewContainer');
    const placeholder = document.getElementById('propPlaceholder');

    if (files.length > 5) {
        showToast('Максимум 5 фото!', 'error');
        this.value = ''; // Сбрасываем инпут
        container.innerHTML = '';
        placeholder.style.display = 'block';
        return;
    }

    container.innerHTML = ''; // Очищаем контейнер

    if (files.length > 0) {
        placeholder.style.display = 'none'; // Прячем текст "Нажмите чтобы выбрать"
        
        // Создаем миниатюрки
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('div');
                img.className = 'preview-img';
                img.style.backgroundImage = `url('${e.target.result}')`;
                container.appendChild(img);
            }
            reader.readAsDataURL(file);
        });
    } else {
        placeholder.style.display = 'block';
    }
});

async function submitProposal() {
    const btn = document.getElementById('btnSubmitProp');
    const files = document.getElementById('propFiles').files;
    const brand = document.getElementById('propBrand').value.trim();
    const size = document.getElementById('propSize').value.trim();
    const cond = parseInt(document.getElementById('propCond').value);
    const contact = document.getElementById('propContact').value.trim();

    if (!files.length || !brand || !size || isNaN(cond) || !contact) {
        showToast('Заполните все поля и прикрепите фото!', 'error');
        return;
    }
    if (cond < 1 || cond > 10) {
        showToast('Оценка должна быть от 1 до 10', 'error');
        return;
    }

    btn.innerText = '[ ЗАГРУЗКА ДАННЫХ... ]';
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.5';

    try {
        let imageUrls = [];
        
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileExt = file.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '');
            const randomString = Math.random().toString(36).substring(2, 15);
            const fileName = `prop_${Date.now()}_${randomString}.${fileExt}`;
            
            const { error: uploadError } = await _supabase.storage.from('proposals').upload(fileName, file);
            if (!uploadError) {
                const { data } = _supabase.storage.from('proposals').getPublicUrl(fileName);
                imageUrls.push(data.publicUrl);
            }
        }

        // Сохраняем заявку в БД (Бот ее подхватит)
        const { error: dbError } = await _supabase.from('proposals').insert([{
            brand: brand,
            measurements: size,
            condition: cond,
            contact: contact,
            images: imageUrls
        }]);

        if (dbError) throw dbError;

        closeModal('proposeModal');
        
        // Ждем пока окно плавно закроется, и только потом показываем Терминал успеха
        setTimeout(() => {
            showTerminalModal('DATA_UPLOADED.LOG', 'Ваша заявка успешно отправлена на сервер. Админ рассмотрит ее и свяжется с вами.', '[ ЗАКРЫТЬ ]', null);
        }, 300);

        // Очищаем форму
        document.getElementById('propFiles').value = '';
        document.getElementById('propFileStatus').innerText = '';
        document.getElementById('propBrand').value = '';
        document.getElementById('propSize').value = '';
        document.getElementById('propCond').value = '';
        document.getElementById('propContact').value = '';

    } catch (err) {
        console.error(err);
        showToast('Ошибка отправки: ' + err.message, 'error');
    } finally {
        btn.innerText = '[ ОТПРАВИТЬ ЗАЯВКУ ]';
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
    }
}
// ==========================================
// 19. СВАЙП ФОТОГРАФИЙ В МОДАЛКЕ ТОВАРА
// ==========================================
function initSliderSwipe() {
    const sliderContainer = document.getElementById('sliderContainer');
    const sliderWrapper = document.getElementById('sliderWrapper');
    
    if (!sliderContainer || !sliderWrapper) return;

    let touchStartX = 0;
    let touchEndX = 0;
    let isSwiping = false;

    sliderContainer.addEventListener('touchstart', (e) => {
        // Игнорируем свайпы двумя пальцами (это зум в PhotoSwipe)
        if (e.touches.length > 1) return;
        
        touchStartX = e.touches[0].clientX;
        isSwiping = true;
        
        // Отключаем плавность при касании, чтобы картинка прилипла к пальцу (если хочешь)
        // sliderWrapper.style.transition = 'none'; 
    }, { passive: true });

    sliderContainer.addEventListener('touchmove', (e) => {
        if (!isSwiping || e.touches.length > 1) return;
        
        // Предотвращаем случайный скролл страницы вниз, если свайпаем вбок
        const touchCurrentX = e.touches[0].clientX;
        const diffX = touchStartX - touchCurrentX;
        
        if (Math.abs(diffX) > 10) {
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });

    sliderContainer.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        
        touchEndX = e.changedTouches[0].clientX;
        isSwiping = false;
        
        // Возвращаем плавность
        // sliderWrapper.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        
        handleSwipeGesture();
    });

    function handleSwipeGesture() {
        const swipeDistance = touchStartX - touchEndX;
        const minSwipeDistance = 50; // Минимальная длина свайпа в пикселях

        if (swipeDistance > minSwipeDistance) {
            // Свайп влево (Следующее фото)
            moveSlide(1);
        } else if (swipeDistance < -minSwipeDistance) {
            // Свайп вправо (Предыдущее фото)
            moveSlide(-1);
        }
    }
}

// Запускаем слушатель свайпов после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    initSliderSwipe();
});

// Функция входа через Google
async function loginWithGoogle() {
    // Вычисляем текущий адрес сайта динамически, чтобы не было конфликта www / не-www
    const currentUrl = window.location.origin;

    const { data, error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: currentUrl,
            queryParams: {
                prompt: 'select_account' // Принудительно дает выбрать аккаунт (помогает на мобилках)
            }
        }
    });
    if (error) showToast('Ошибка Google Auth: ' + error.message, 'error');
}