console.log(`
      _   _ _____  _____ _    _          
     | \\ | |_   _|/ ____| |  | |   /\\    
     |  \\| | | | | (___ | |__| |  /  \\   
     | . \` | | |  \\___ \\|  __  | / /\\ \\  
     | |\\  |_| |_ ____) | |  | |/ ____ \\ 
     |_| \\_|_____|_____/|_|  |_/_/    \\_\\
                                         
    LOOKING AT THE SOURCE CODE? 
`);
const i18nResources = {
    ua: {
        translation: {
            "nav": { "home": "ГОЛОВНА", "favorites": "ОБРАНЕ", "reviews": "ВІДГУКИ", "orders": "МОЇ ЗАМОВЛЕННЯ" },
            "search": { "placeholder": "Пошук речі (наприклад: Arcteryx, Gore-Tex)...", "btn": "ШУКАТИ" },
            "sidebar": {
                "categories": "КАТЕГОРІЇ", "all": "[>] Всі речі", "outerwear": "[>] Верхній одяг", "sweaters": "[>] Кофти та Светри", 
                "pants": "[>] Штани та Джинси", "shoes": "[>] Взуття", "accs": "[>] Аксесуари",
                "sizes_title": "РОЗМІРИ ТА ЦІНА", "from": "ВІД", "to": "ДО", "uah": "грн",
                "size_s": "Розмір S", "size_m": "Розмір M", "size_l": "Розмір L", "size_xl": "Розмір XL / XXL",
                "shoes_1": "Взуття (40 - 42)", "shoes_2": "Взуття (43 - 46)",
                "auth_title": "ПРОФІЛЬ / ВХІД", "login": "УВІЙТИ", "reg": "РЕЄСТРАЦІЯ", "create": "СТВОРИТИ АКАУНТ", "logout": "ВИЙТИ"
            },
            "sort": { "found": "Знайдено речей:", "sorting": "Сортування:", "new": "Нові", "cheap": "Дешеві" },
            "cart": { "checkout": "ОФОРМИТИ ЗАМОВЛЕННЯ", "in_cart": "У КОШИКУ:", "items_total": "РЕЧЕЙ | РАЗОМ:", "empty": "[ КОШИК ПОРОЖНІЙ ]", "title": "[ ВАШІ ПОКУПКИ ]" },
            "mobile": { "show_filters": "[+] ПОКАЗАТИ ФІЛЬТРИ", "hide_filters": "[-] ПРИХОВАТИ ФІЛЬТРИ" },
            "product": {
                "views": "👁 ПЕРЕГЛЯДІВ:", "condition": "СТАН РЕЧІ:", "size": "РОЗМІР:", "brand": "БРЕНД:",
                "add_to_cart": "У КОШИК", "notify": "ПОВІДОМИТИ ПРО НАЯВНІСТЬ",
                "badge_orig": "ПРОЙШЛО ЛЕГІТ-ЧЕК", "badge_fast": "ШВИДКА ВІДПРАВКА", "badge_refund": "ПОВЕРНЕННЯ 14 ДНІВ",
                "similar": "[ СХОЖІ РЕЧІ ]", "delivery": "Доставка та оплата", "delivery_text": "Відправка Новою Поштою. Працюємо по повній передоплаті або накладеним платежем з передоплатою 200 грн. Повернення протягом 14 днів.",
                "measure": "Як ми робимо заміри?", "measure_text": "Всі заміри знімаються з речі на рівній поверхні. Похибка може становити 1-2 см."
            },
            "checkout": {
                "desc": "Заповніть дані для відправки. Бронь 2 години.", "name": "ПІБ Одержувача:", "phone": "Телефон (ОБОВ'ЯЗКОВО):",
                "btn_otp": "Підтвердити", "otp_status": "Спочатку підтвердіть номер для замовлення!",
                "city": "Місто (Нова Пошта):", "branch": "Відділення або Поштомат:", "calc": "Орієнтовна вартість доставки:",
                "btn_submit": "ПІДТВЕРДИТИ ЗАМОВЛЕННЯ"
            },
            "orders_modal": {
                "desc": "Введіть номер телефону, вказаний при замовленні, щоб відстежити статус.", "btn": "ЗНАЙТИ",
                "empty": "[ ІСТОРІЯ ЗАМОВЛЕНЬ ПОРОЖНЯ ]", "loading": "Очікування даних..."
            },
            "footer": { "visitors": "ВІДВІДУВАЧІ:", "install": "⬇ ВСТАНОВИТИ ДОДАТОК" },
            "marquee": "NISHA МАЙДАНЧИК ДЛЯ ПРОДАЖУ ВІНТАЖНИХ КРУТИХ РЕЧЕЙ ТА ДЛЯ КРЕАТОРІВ. вдалих покупок!",
            "messages": {
                "login_success": "Успішний вхід!", "logout": "Ви вийшли з системи", "reg_success": "Реєстрація успішна! Перевірте пошту.",
                "fav_add": "Додано до обраного", "fav_remove": "Видалено з обраного", "cart_add": "Річ додана до кошика!", "cart_exist": "Річ вже у кошику!"
            },
            "grid": { "size_prefix": "Розмір: ", "end_list": "[ КІНЕЦЬ СПИСКУ ]", "scroll_more": "Гортайте вниз для завантаження...", "no_photo": "НЕМА ФОТО" },
            "history": { "title": "HISTORY.LOG // ВИ НЕЩОДАВНО ДИВИЛИСЯ:" }
        }
    },
    ru: {
        translation: {
            "nav": { "home": "ГЛАВНАЯ", "favorites": "ИЗБРАННОЕ", "reviews": "ОТЗЫВЫ", "orders": "МОИ ЗАКАЗЫ" },
            "search": { "placeholder": "Поиск вещи (например: Arcteryx, Gore-Tex)...", "btn": "ИСКАТЬ" },
            "sidebar": {
                "categories": "КАТЕГОРИИ", "all": "[>] Все вещи", "outerwear": "[>] Верхняя одежда", "sweaters": "[>] Кофты и Свитера", 
                "pants": "[>] Штаны и Джинсы", "shoes": "[>] Обувь", "accs": "[>] Аксессуары",
                "sizes_title": "РАЗМЕРЫ И ЦЕНА", "from": "ОТ", "to": "ДО", "uah": "грн",
                "size_s": "Размер S", "size_m": "Размер M", "size_l": "Размер L", "size_xl": "Размер XL / XXL",
                "shoes_1": "Обувь (40 - 42)", "shoes_2": "Обувь (43 - 46)",
                "auth_title": "ПРОФИЛЬ / ВХОД", "login": "ВОЙТИ", "reg": "РЕГИСТРАЦИЯ", "create": "СОЗДАТЬ АККАУНТ", "logout": "ВЫЙТИ"
            },
            "sort": { "found": "Найдено вещей:", "sorting": "Сортировка:", "new": "Новые", "cheap": "Дешевые" },
            "cart": { "checkout": "ОФОРМИТЬ ЗАКАЗ", "in_cart": "В КОРЗИНЕ:", "items_total": "ВЕЩЕЙ | ИТОГО:", "empty": "[ КОРЗИНА ПУСТА ]", "title": "[ ВАШИ ПОКУПКИ ]" },
            "mobile": { "show_filters": "[+] ПОКАЗАТЬ ФИЛЬТРЫ", "hide_filters": "[-] СКРЫТЬ ФИЛЬТРЫ" },
            "product": {
                "views": "👁 ПРОСМОТРОВ:", "condition": "СОСТОЯНИЕ ВЕЩИ:", "size": "РАЗМЕР:", "brand": "БРЕНД:",
                "add_to_cart": "В КОРЗИНУ", "notify": "УВЕДОМИТЬ О ПОЯВЛЕНИИ",
                "badge_orig": "ПРОШЛО ЛЕГИТ-ЧЕК", "badge_fast": "БЫСТРАЯ ОТПРАВКА", "badge_refund": "ВОЗВРАТ 14 ДНЕЙ",
                "similar": "[ ПОХОЖИЕ ВЕЩИ ]", "delivery": "Доставка и оплата", "delivery_text": "Отправка Новой Почтой. Работаем по полной предоплате или наложенным платежом по минимальной предоплате 200 грн. Возможен возврат в течение 14 дней.",
                "measure": "Как мы делаем замеры?", "measure_text": "Все замеры снимаются с вещи, лежащей на ровной поверхности. Погрешность может составлять 1-2 см."
            },
            "checkout": {
                "desc": "Заполните данные для отправки. Бронь 2 часа.", "name": "ФИО Получателя:", "phone": "Телефон (ОБЯЗАТЕЛЬНО):",
                "btn_otp": "Подтвердить", "otp_status": "Сначала подтвердите номер для заказа!",
                "city": "Город (Новая Почта):", "branch": "Отделение или Почтомат:", "calc": "Ориентировочная стоимость доставки:",
                "btn_submit": "ПОДТВЕРДИТЬ ЗАКАЗ"
            },
            "orders_modal": {
                "desc": "Введите номер телефона, указанный при заказе, чтобы отследить статус.", "btn": "НАЙТИ",
                "empty": "[ ИСТОРИЯ ЗАКАЗОВ ПУСТА ]", "loading": "Ожидание данных..."
            },
            "footer": { "visitors": "VISITORS:", "install": "⬇ УСТАНОВИТЬ ПРИЛОЖЕНИЕ" },
            "marquee": "NISHA ПЛОЩАДКА ДЛЯ ПРОДАЖИ ВИНТАЖНЫХ КРУТЫХ ВЕЩЕЙ И ДЛЯ КРЕЙТОРОВ. хороших покупок!",
            "messages": {
                "login_success": "Успешный вход!", "logout": "Вы вышли из системы", "reg_success": "Регистрация успешна! Проверьте почту.",
                "fav_add": "Добавлено в избранное", "fav_remove": "Удалено из избранного", "cart_add": "Вещь добавлена в корзину!", "cart_exist": "Вещь уже в корзине!"
            },
            "grid": { "size_prefix": "Размер: ", "end_list": "[ КОНЕЦ СПИСКА ]", "scroll_more": "Скролльте вниз для загрузки...", "no_photo": "НЕТ ФОТО" },
            "history": { "title": "HISTORY.LOG // ВЫ НЕДАВНО СМОТРЕЛИ:" }
        }
    },
    en: {
        translation: {
            "nav": { "home": "HOME", "favorites": "FAVORITES", "reviews": "REVIEWS", "orders": "MY ORDERS" },
            "search": { "placeholder": "Search items (e.g., Arcteryx, Gore-Tex)...", "btn": "SEARCH" },
            "sidebar": {
                "categories": "CATEGORIES", "all": "[>] All items", "outerwear": "[>] Outerwear", "sweaters": "[>] Sweaters & Hoodies", 
                "pants": "[>] Pants & Jeans", "shoes": "[>] Shoes", "accs": "[>] Accessories",
                "sizes_title": "SIZES & PRICE", "from": "FROM", "to": "TO", "uah": "UAH",
                "size_s": "Size S", "size_m": "Size M", "size_l": "Size L", "size_xl": "Size XL / XXL",
                "shoes_1": "Shoes (40 - 42)", "shoes_2": "Shoes (43 - 46)",
                "auth_title": "PROFILE / LOGIN", "login": "LOGIN", "reg": "REGISTER", "create": "CREATE ACCOUNT", "logout": "LOGOUT"
            },
            "sort": { "found": "Items found:", "sorting": "Sort by:", "new": "Newest", "cheap": "Cheapest" },
            "cart": { "checkout": "CHECKOUT", "in_cart": "IN CART:", "items_total": "ITEMS | TOTAL:", "empty": "[ CART IS EMPTY ]", "title": "[ YOUR PURCHASES ]" },
            "mobile": { "show_filters": "[+] SHOW FILTERS", "hide_filters": "[-] HIDE FILTERS" },
            "product": {
                "views": "👁 VIEWS:", "condition": "CONDITION:", "size": "SIZE:", "brand": "BRAND:",
                "add_to_cart": "ADD TO CART", "notify": "NOTIFY ME",
                "badge_orig": "VERIFIED AUTHENTIC", "badge_fast": "FAST SHIPPING", "badge_refund": "14-DAY RETURNS",
                "similar": "[ SIMILAR ITEMS ]", "delivery": "Shipping & Payment", "delivery_text": "Worldwide shipping available. Full prepayment or cash on delivery. Returns accepted within 14 days.",
                "measure": "How do we measure?", "measure_text": "All measurements are taken with the item laying flat. Please allow a 1-2 cm margin of error."
            },
            "checkout": {
                "desc": "Fill in shipping details. Reservation holds for 2 hours.", "name": "Full Name:", "phone": "Phone (REQUIRED):",
                "btn_otp": "Verify", "otp_status": "Please verify your phone number first!",
                "city": "City (Nova Poshta):", "branch": "Branch or Postomat:", "calc": "Estimated delivery cost:",
                "btn_submit": "CONFIRM ORDER"
            },
            "orders_modal": {
                "desc": "Enter the phone number used for the order to track its status.", "btn": "SEARCH",
                "empty": "[ ORDER HISTORY IS EMPTY ]", "loading": "Waiting for data..."
            },
            "footer": { "visitors": "VISITORS:", "install": "⬇ INSTALL APP" },
            "marquee": "NISHA MARKETPLACE FOR VINTAGE COOL ITEMS AND CREATORS. happy shopping!",
            "messages": {
                "login_success": "Login successful!", "logout": "You have logged out", "reg_success": "Registration successful! Check your email.",
                "fav_add": "Added to favorites", "fav_remove": "Removed from favorites", "cart_add": "Item added to cart!", "cart_exist": "Item is already in the cart!"
            },
            "grid": { "size_prefix": "Size: ", "end_list": "[ END OF LIST ]", "scroll_more": "Scroll down to load...", "no_photo": "NO PHOTO" },
            "history": { "title": "HISTORY.LOG // RECENTLY VIEWED:" }
        }
    }
};
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
const UPDATE_REASON = "Фикс отображения профиля на ПК и мобильном окне";

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
function updateContentLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = i18next.t(key);
    });

    const searchInput = document.getElementById('mainSearch');
    if (searchInput) {
        searchInput.placeholder = i18next.t('search.placeholder');
    }
}


function changeLanguage(lng) {
    if (typeof i18next !== 'undefined') {
        i18next.changeLanguage(lng).then(() => {
            updateContentLanguage();
            showToast(`Язык изменен / Мова змінена [${lng.toUpperCase()}]`, 'success');
        });
    }
}
const lenis = new Lenis({
    duration: 1.0, 
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    smoothTouch: false,
    touchMultiplier: 2,
    wheelMultiplier: 0.8, 
    normalizeWheel: true
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

// Прячем кнопку [+] когда листаем вниз
lenis.on('scroll', (e) => {
    const fab = document.querySelector('.fab-propose');
    if (!fab) return;
    
    // e.velocity > 1 означает, что мы активно скроллим ВНИЗ
    if (e.velocity > 1) {
        fab.classList.add('hidden-scroll');
    } 
    // e.velocity < -1 (вверх) или 0 (остановка)
    else if (e.velocity < -1 || e.velocity === 0) {
        fab.classList.remove('hidden-scroll');
    }
});


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

let envData = (typeof window.ENV !== 'undefined') ? window.ENV : ((typeof CONFIG !== 'undefined') ? CONFIG : {});
let rawUrl = envData.SUPABASE_URL || '';
let rawAnonKey = envData.SUPABASE_ANON_KEY || '';
let rawNpKey = envData.NP_API_KEY || '';

const SUPABASE_URL = rawUrl.replace(/[^\x20-\x7E]/g, '').trim();
const SUPABASE_ANON_KEY = rawAnonKey.replace(/[^\x20-\x7E]/g, '').trim();
const NP_API_KEY = rawNpKey.replace(/[^\x20-\x7E]/g, '').trim();

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
    showToast('Правила приняты. Добро пожаловать!', 'success');
}
window.onload = async () => {
    try {
        try {
            // АВТО-ДОЖИМ БРОШЕННОЙ КОРЗИНЫ
        setTimeout(() => {
            if (cart.length > 0) {
                let lastTime = localStorage.getItem('nisha_cart_time');
                if (lastTime && (Date.now() - parseInt(lastTime)) > 3600000) {
                    if (!localStorage.getItem('nisha_cart_reminded')) {
                        // НОВОЕ КРУТОЕ ОКНО КОРЗИНЫ
                        showTerminalModal(
                            'SYSTEM_ALERT.LOG',
                            'Мы заметили, что вы не завершили заказ. Товары могут забрать в любой момент!<br><br><b style="color:var(--accent-yellow);">Используйте промокод COMEBACK5 для скидки 5%!</b>',
                            '[ ПРОДОЛЖИТЬ ПОКУПКИ ]',
                            null
                        );
                        localStorage.setItem('nisha_cart_reminded', 'true');
                    }
                }
            }
        }, 3000);

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

                await i18next.init({
                    resources: i18nResources,
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
            if (urlParams.has('cat')) {
                currentCategory = urlParams.get('cat')
                document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(el => el.classList.remove('active-filter'));
                const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
                catLinks.forEach(link => {
                    if (link.innerText.includes(currentCategory)) link.classList.add('active-filter');
                });
            }
            if (urlParams.has('q')) {
                const sInput = document.getElementById('mainSearch');
                if (sInput) sInput.value = urlParams.get('q');
            }

            await loadAllItems(); 

            const openItemId = urlParams.get('item');
            if (openItemId) {
                setTimeout(() => openProductModalById(openItemId), 500);
            }
            
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
        
        renderHistory();
        initHitCounter();
        
        if (currentUser && currentUser.phone) {
            document.getElementById('ordersSearchPhone').value = currentUser.phone;
        }

    } catch (err) {
       
        console.error("ОШИБКА ИНИЦИАЛИЗАЦИИ ПРИЛОЖЕНИЯ:", err);
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            grid.innerHTML = `<div style="color:red; text-align:center; padding:40px; grid-column:1/-1;">[ СИСТЕМНАЯ ОШИБКА: ${err.message} ]</div>`;
        }
    }
};

function closeModal(id) { 
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const win = modal.querySelector('.modal-window');
    
    // Если это модалка товара, делаем красивый свайп вниз
    if (win && id === 'productModal') {
        win.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease';
        win.style.transform = 'translateY(100vh)';
        win.style.opacity = '0';
        
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto'; 
            if (typeof lenis !== 'undefined') lenis.start(); 
            
            // Возвращаем стили на место для следующего открытия
            win.style.transform = '';
            win.style.opacity = '';
            win.style.transition = '';
        }, 300);
    } else {
        // Обычное закрытие для остальных окон (Правила, Корзина)
        modal.style.display = 'none'; 
        document.body.style.overflow = 'auto'; 
        if (typeof lenis !== 'undefined') lenis.start(); 
    }
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
            this.style.display = 'none'; 
            document.body.style.overflow = 'auto'; 
            if (typeof lenis !== 'undefined') lenis.start(); 
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
            if (!error && profiles && profiles.length > 0) { userProfile = profiles[0]; }

            const uName = (userProfile && userProfile.username) ? userProfile.username : currentUser.email;

            // Обновляем ПК (Сайдбар)
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('profileForm').style.display = 'flex';
            document.getElementById('profileName').innerText = uName;

            // Обновляем Мобилку (Модалка)
            const mLog = document.getElementById('modalLoginForm');
            if (mLog) {
                mLog.style.display = 'none';
                document.getElementById('modalProfileForm').style.display = 'block';
                document.getElementById('modalProfileName').innerText = uName;
            }
            
            await loadFavorites();
            
            if (userProfile && userProfile.cart && userProfile.cart.length > 0) {
                cart = userProfile.cart; 
                localStorage.setItem('nisha_cart', JSON.stringify(cart));
                updateCartUI();
            } else if (cart.length > 0) {
                await syncCartToServer(); 
            }
        } else {
            currentUser = null;
            userProfile = null;
            favorites = [];
            // ПК
            document.getElementById('loginForm').style.display = 'flex';
            document.getElementById('profileForm').style.display = 'none';
            // Мобилка
            const mLog = document.getElementById('modalLoginForm');
            if (mLog) {
                mLog.style.display = 'block';
                document.getElementById('modalProfileForm').style.display = 'none';
            }
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
    document.getElementById('itemsGrid').innerHTML = `<div style="color: #666; font-family: monospace; padding: 30px; text-align:center; grid-column: 1/-1;">[ ЗАГРУЗКА БАЗЫ ДАННЫХ... ]</div>`;
    
    const { data, error } = await _supabase.from('items').select('*').order('created_at', { ascending: false });
    
    if (error) { 
        document.getElementById('itemsGrid').innerHTML = `<div style="color:red; padding:20px; grid-column: 1/-1;">[ ОШИБКА БД: ${error.message} ]</div>`;
        return; 
    }
    
    allItems = data;
    applyFilters();
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
                const fuseOptions = {
                    includeScore: true, threshold: 0.4, 
                    keys: [{ name: 'name', weight: 0.7 }, { name: 'brand', weight: 0.5 }, { name: 'category', weight: 0.3 }]
                };
                const fuse = new Fuse(sortedItems, fuseOptions);
                const fuseResults = fuse.search(searchTerm);
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
            if (countEl) countEl.innerText = filteredItems.length;

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

            
            if (grid) {
                requestAnimationFrame(() => {
                    grid.classList.remove('fade-out');
                });
            }
        } catch (err) {
            console.error("ОШИБКА ФИЛЬТРАЦИИ:", err);
            if (grid) grid.innerHTML = `<div style="color:red; grid-column:1/-1; padding:20px; text-align:center;">[ ОШИБКА РЕНДЕРА: ${err.message} ]</div>`;
            if (grid) grid.classList.remove('fade-out');
        }
    }, 300); 
}

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
            } else if (item.is_sale && item.old_price && !isHacked) { 
                badgeHTML = '<div class="sale-badge-card">SALE</div>'; 
            }

          const optImg = getOptimizedImageUrl(item, false); // Для сетки берем нормальное фото
            
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

            card.innerHTML = `
                ${badgeHTML}
                <div class="${starClass}">★</div>
                <div class="card-clickable-area" style="display:flex; flex-direction:column; flex-grow:1;">
                    <!-- ДОБАВЛЕН КЛАСС skeleton и ID для плавной загрузки -->
                    <div class="mock-image skeleton" id="img-${item.id}"></div>
                    
                    <div class="item-info">
                        <h3 class="item-title">${safeName}</h3>
                        <div class="item-price">${priceHTML}</div>
                       <div class="item-size">${i18next.t('grid.size_prefix')}${safeSize}</div>
                    <div class="item-footer"><span>${safeBrand}</span><span>${item.condition || '9/10'}</span></div>
                    <button class="grid-cart-btn" onclick="addToCartWithAnimation('${item.id}', this, event)" style="${item.status === 'sold' ? 'display:none;' : ''}">${i18next.t('product.add_to_cart')}</button>
                </div>
            `;

            
            if (optImg) {
                const imgLoader = new Image();
                imgLoader.src = optImg;
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
                        imgDiv.innerText = 'NO PHOTO';
                    }
                };
            } else {
                const imgDiv = card.querySelector(`#img-${item.id}`);
                if(imgDiv) {
                    imgDiv.classList.remove('skeleton');
                    imgDiv.innerText = 'NO PHOTO';
                }
            }

            card.querySelector('.fav-star').addEventListener('click', (e) => toggleFav(e, item.id));
            
            card.querySelector('.card-clickable-area').addEventListener('click', (e) => {
               
                if (e.target.closest('.grid-cart-btn')) return; 
                
                
                openProductModal(item);
            });

            grid.appendChild(card);

            const oldPriceEl = card.querySelector('.old-price');
            if (oldPriceEl && typeof RoughNotation !== 'undefined') {
                setTimeout(() => RoughNotation.annotate(oldPriceEl, { type: 'strike-through', color: '#ff0000', strokeWidth: 3 }).show(), 300);
            }
            const saleBadgeEl = card.querySelector('.sale-badge-card');
            if (saleBadgeEl && typeof RoughNotation !== 'undefined') {
                setTimeout(() => RoughNotation.annotate(saleBadgeEl, { type: 'box', color: '#ffcc00', strokeWidth: 2 }).show(), 500);
            }
            if (typeof VanillaTilt !== 'undefined' && window.innerWidth > 900) {
                VanillaTilt.init(card, { max: 5, speed: 1000, glare: false, scale: 1.01 });
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
}

// Функция добавления в корзину прямо с главной страницы
async function addToCartById(itemId) {
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
    showToast('Товар добавлен в корзину!', 'success', getOptimizedImageUrl(item, true));
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
    element.classList.add('active-filter');
    currentCategory = cat; 
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
document.getElementById('mainSearch').addEventListener('input', function() {
    document.getElementById('clearSearchBtn').style.display = this.value.length > 0 ? 'block' : 'none';
});

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
        showToast('Сначала войдите в систему или создайте профиль!', 'error'); 
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
    document.getElementById('favCountBadge').innerText = `[${favorites.length}]`; 
}

function filterFavorites() { 
    if(!currentUser) { 
        showToast('Доступно только авторизованным', 'error'); 
        return; 
    }
    showingOnlyFavs = !showingOnlyFavs; 
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
        const res = await fetch('https://nisha-api.onrender.com', {
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
                    
                    // ВАЖНО: Новая Почта требует именно DeliveryCity для поиска отделений!
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
        showToast('Ошибка связи с сервером доставки. Повторите попытку.', 'error');
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
            dropdown.innerHTML = '<div style="color:#ff6666; padding:12px;">За цим запитом відділень не знайдено</div>';
            dropdown.style.display = 'block';
        }
   } catch(e) { 
        console.error("Сбой загрузки отделений НП:", e); 
        input.placeholder = "Ошибка сети: введите адрес вручную"; 
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
    if (dropdown) dropdown.classList.toggle('active');
}
function renderCartItems() {
    const list = document.getElementById('cartDropdownList');
    if (!list) return;
    list.innerHTML = '';
    
    if (cart.length === 0) {
        list.innerHTML = '<div style="color:#555; text-align:center; padding: 30px; font-family: monospace;">[ КОРЗИНА ПУСТА ]</div>';
        return;
    }

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

    // Функция финального удаления из БД и обновления UI
    const executeRemoval = async () => {
        cart.splice(index, 1);
        localStorage.setItem('nisha_cart', JSON.stringify(cart));
        await syncCartToServer();
        updateCartUI(); 
        showToast(`Удалено: ${removedItem.name}`, 'error', imgUrl);
        
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
    if (!p) return; 
    
    if (cart.length === 0) { 
        p.classList.remove('show'); 
        return; 
    }
    
    p.classList.add('show'); 
    document.getElementById('cartCount').innerText = cart.length;
    let total = cart.reduce((sum, item) => sum + item.price, 0);
    // Применяем скидку по промокоду, если она есть
    if (typeof currentPromoDiscount !== 'undefined' && currentPromoDiscount > 0) {
        total = Math.floor(total - (total * currentPromoDiscount));
    }
    document.getElementById('cartTotal').innerText = total + ' грн';
    
    // Вызываем отрисовку внутреннего списка (если она объявлена)
    if (typeof renderCartItems === 'function') renderCartItems();
}


function closeCartDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('cartDropdown');
    if (dropdown) dropdown.classList.remove('active');
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
        if (cartDrop) cartDrop.classList.remove('active');
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
    if (blacklisted && blacklisted.length > 0) {
        document.getElementById('otpStatus').innerHTML = "<span style='color:red; font-weight:bold;'>[!] ОШИБКА БЕЗОПАСНОСТИ. ВАШ НОМЕР ЗАБЛОКИРОВАН.</span>";
        showToast('Доступ запрещен', 'error');
        return; 
    }
    
    const btnOtp = document.getElementById('btnGetOtp');
    if (btnOtp.disabled) return; 
    
    btnOtp.disabled = true;
    let timer = 60;
    btnOtp.innerText = `Ждите ${timer}с`;
    btnOtp.style.opacity = "0.5";
    
    const interval = setInterval(() => {
        timer--;
        btnOtp.innerText = `Ждите ${timer}с`;
        if (timer <= 0) {
            clearInterval(interval);
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
    window.open(`https://t.me/nisha_store1_bot?start=otp_${payloadPhone}`, '_blank');
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
                document.getElementById('btnGetOtp').style.display = "none";
                
                _supabase.removeChannel(otpRealtimeChannel); // Отключаемся, дело сделано
            }
        })
        .subscribe();
}

function openCheckoutModal() { 

    if (typeof lenis !== 'undefined') lenis.stop();
    document.getElementById('checkoutModal').style.display = 'flex'; 
    document.body.style.overflow = 'hidden';
    checkPhoneAuth();
}

async function submitOrder() {
    const btnSubmit = document.getElementById('btnSubmitOrder');
    
    // БЛОКИРУЕМ КНОПКУ, ЧТОБЫ НЕ НАЖАЛИ ДВАЖДЫ
    btnSubmit.innerText = "[ ОБРАБОТКА... ]";
    btnSubmit.style.pointerEvents = "none";
    btnSubmit.style.opacity = "0.5";

    const botTrap = document.getElementById('botTrap');
    if (botTrap && botTrap.value !== "") return;

    if (!otpVerified) {
        showToast('Подтвердите номер телефона!', 'error');
        btnSubmit.innerText = "ПОДТВЕРДИТЬ ЗАКАЗ";
        btnSubmit.style.pointerEvents = "auto";
        btnSubmit.style.opacity = "1";
        return;
    }

    const name = document.getElementById('orderName').value.trim();
    const phoneRaw = document.getElementById('orderPhone').value;
    const phone = phoneRaw.replace(/[^\d+]/g, '');
    const city = document.getElementById('orderCity').value.trim();
    const branch = document.getElementById('orderBranch').value.trim();

    if(!name || !phone || !city || !branch) { 
        showToast('Заполните все обязательные поля!', 'error'); 
        btnSubmit.innerText = "ПОДТВЕРДИТЬ ЗАКАЗ";
        btnSubmit.style.pointerEvents = "auto";
        btnSubmit.style.opacity = "1";
        return; 
    }

    // Собираем ТОЛЬКО ID товаров. Цену и всё остальное БД возьмет сама!
    const orderItemIds = cart.map(i => i.id);

    try {
        // Вызываем нашу безопасную функцию, передавая промокод!
        const { data: orderId, error: orderError } = await _supabase.rpc('create_secure_order', {
            p_user_id: currentUser ? currentUser.id : null,
            p_name: name,
            p_phone: phone,
            p_tg: '',
            p_city: city,
            p_branch: branch,
            p_city_ref: selectedCityRef || '',
            p_branch_ref: selectedBranchRef || '',
            p_item_ids: orderItemIds,
            p_promocode: appliedPromoCode || null
        });

        if (orderError) { 
            throw orderError; 
        }

        // УСПЕШНЫЙ ЗАКАЗ
        localStorage.setItem('nisha_last_phone', phone);
        localStorage.setItem('nisha_last_order', Date.now());

        cart = [];
        localStorage.setItem('nisha_cart', JSON.stringify([]));
        await syncCartToServer();
        
        updateCartUI();
        closeModal('checkoutModal');
        
        // Показываем новое стильное окно
        const overlay = document.getElementById('orderSuccessOverlay');
        overlay.style.display = 'flex';
        
        // Закрываем окно через 3.5 секунды и возвращаем всё в норму
        setTimeout(() => { 
            overlay.style.display = 'none'; 
            loadAllItems(); 
            btnSubmit.innerText = "ПОДТВЕРДИТЬ ЗАКАЗ";
            btnSubmit.style.pointerEvents = "auto";
            btnSubmit.style.opacity = "1";
        }, 3500);

    } catch (err) {
        // ОШИБКА (например, кто-то успел купить товар на секунду раньше)
        showToast('Ошибка при оформлении: ' + err.message, 'error');
        btnSubmit.innerText = "ПОДТВЕРДИТЬ ЗАКАЗ";
        btnSubmit.style.pointerEvents = "auto";
        btnSubmit.style.opacity = "1";
        loadAllItems(); // Перезагружаем витрину, чтобы показать актуальные статусы
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
        listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace; padding: 30px;">[ ИСТОРИЯ ЗАКАЗОВ ПУСТА ]</div>'; 
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
    document.getElementById('modalItemCond').innerText = condStr;
    const condMatch = condStr.match(/(\d+)/);
    let condPercent = 90;
    if(condMatch && condMatch[1]) condPercent = parseInt(condMatch[1]) * 10;
    document.getElementById('modalCondFill').style.width = condPercent + '%';
    // Найди эту строку (или добавь её, если нет):
    const descText = item.description ? item.description : "Оригинал. Любые проверки. Отличное состояние. Дополнительные замеры по запросу в ЛС.";
   
    document.querySelector('.modal-desc').innerHTML = `
        <strong style="color: var(--accent-green);">РАЗМЕР: <span id="modalItemSizeDesc">${item.size}</span></strong><br>
        <strong>БРЕНД:</strong> <span id="modalItemBrand">${item.brand}</span><br><br>
        ${descText}
    `;
    // НАСТОЯЩИЕ ПРОСМОТРЫ (1 юзер = 1 просмотр)
    const viewCount = document.getElementById('modalItemViews');
    if(viewCount) {
        let viewedItems = JSON.parse(localStorage.getItem('nisha_viewed') || '[]');
        let currentViews = item.views_count || 0;

        // Если юзер еще не смотрел этот товар
        if (!viewedItems.includes(item.id)) {
            currentViews += 1; // Визуально добавляем +1
            viewedItems.push(item.id);
            localStorage.setItem('nisha_viewed', JSON.stringify(viewedItems));
            
            // Отправляем в базу данных +1 тихо в фоне
            if (_supabase) {
                _supabase.rpc('increment_item_views', { item_uuid: item.id }).then();
            }
        }
        viewCount.innerText = currentViews;
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
    
    // Адаптация под PhotoSwipe: используем <a> теги вместо <div> для слайдов
    if (item.images && item.images.length > 0) {
        item.images.forEach((imgUrl, index) => {
            // Берем миниатюру по индексу, если она есть, иначе берем оригинал
            const currentThumb = (item.thumbnails && item.thumbnails[index]) ? item.thumbnails[index] : imgUrl;
            
            // PhotoSwipe: для полноэкранного просмотра используем оригинал
            wrapper.innerHTML += `<a href="${imgUrl}" data-pswp-width="1200" data-pswp-height="1600" target="_blank" class="slide" style="background-image:url('${imgUrl}');"></a>`;
            // Для нижнего меню миниатюр используем сжатую версию
            thumbs.innerHTML += `<div class="thumb" style="background-image:url('${currentThumb}');" onclick="setSlide(${index})"></div>`;
        });
    } else {
        wrapper.innerHTML = `<a class="slide" style="background:#111; pointer-events:none;">НЕТ ФОТО</a>`;
    }

    setSlide(0);

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
                    icon: '/favicon.ico', // Твоя иконка
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
        // В истории мы сохраняли URL, просто оставляем его
        const optImg = h.img;
        
        const card = document.createElement('div');
        card.className = 'history-card';
        
        // ИСПРАВЛЕНИЕ: Теперь любой клик по истории 100% открывает модалку сразу
        card.onclick = () => openProductModalById(h.id);
        
        // Убрали zoomable-img, чтобы не срабатывало увеличение фотки
        card.innerHTML = `
            <div class="history-img">
                ${h.img ? `<img class="lozad" data-src="${optImg}" style="width:100%; height:100%; object-fit:cover;">` : 'NO FOTO'}
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

    if (typeof lozad !== 'undefined') {
        lozad('.lozad').observe();
    }
    // СИНХРОНИЗАЦИЯ С БД (если юзер вошел в аккаунт)
    if (currentUser && _supabase) {
        // Чтобы не спамить базу каждым кликом, отправляем без await
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
        const fuseOptions = {
            includeScore: true, threshold: 0.4, 
            keys: [{ name: 'name', weight: 0.7 }, { name: 'brand', weight: 0.5 }]
        };
        const fuse = new Fuse(allItems, fuseOptions);
        const results = fuse.search(searchTerm).slice(0, 5); // Берем топ 5 совпадений

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
    
    // Прямая ссылка на твой сайт с открытием этого товара
    const shareUrl = `${window.location.origin}/?item=${currentOpenedItem.id}`;
    
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
            .then(() => showToast('Ссылка скопирована в буфер обмена!', 'success'))
            .catch(() => showToast('Ошибка копирования', 'error'));
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
    
    // Ищем промокод в Базе Данных
    const { data, error } = await _supabase
        .from('promo_codes')
        .select('discount_percent, is_active')
        .eq('code', input)
        .limit(1);

    if (data && data.length > 0 && data[0].is_active) {
        currentPromoDiscount = data[0].discount_percent;
        appliedPromoCode = input;
        msg.innerHTML = `<span style="color: var(--accent-green);">[✔] Промокод активирован! Скидка ${currentPromoDiscount * 100}%</span>`;
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
/// ==========================================
// 18. ZERO-LAG СВАЙП КАРТОЧКИ (IOS STYLE - БЛОКИРОВКА БРАУЗЕРА)
// ==========================================
function initMobileSwipe() {
    const modalWin = document.querySelector('#productModal .modal-window');
    const overlay = document.querySelector('#productModal');
    
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let startScrollTop = 0;

    if (!modalWin || !overlay) return;

    modalWin.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 900) return;
        // Не мешаем листать фотки в слайдере (вправо/влево)
        if (e.target.closest('.slider-btn') || e.target.closest('.pswp')) return;

        startY = e.touches[0].clientY;
        startScrollTop = modalWin.scrollTop;
        isDragging = false;
        
        modalWin.style.transition = 'none';
        overlay.style.transition = 'none';
    }, { passive: false }); // ВАЖНО: false позволяет блокировать браузер

    modalWin.addEventListener('touchmove', (e) => {
        if (window.innerWidth > 900) return;
        
        currentY = e.touches[0].clientY;
        const diffY = currentY - startY;

        // Если мы в самом верху карточки и тянем вниз
        if (startScrollTop <= 3 && diffY > 0) {
            isDragging = true;
            e.preventDefault(); // ПОЛНОСТЬЮ ОТКЛЮЧАЕТ СОПРОТИВЛЕНИЕ ТЕЛЕФОНА
            
            modalWin.style.transform = `translateY(${diffY}px)`;
            let opacity = 1 - (diffY / 400);
            overlay.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(0, opacity * 0.85)})`;
        }
    }, { passive: false });

    modalWin.addEventListener('touchend', (e) => {
        if (window.innerWidth > 900 || !isDragging) return;
        
        const diffY = currentY - startY;
        isDragging = false;
        
        modalWin.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
        overlay.style.transition = 'background-color 0.25s ease';
        
        if (diffY > 100) { 
            modalWin.style.transform = `translateY(100vh)`; 
            overlay.style.backgroundColor = `rgba(0, 0, 0, 0)`; 
            
            setTimeout(() => {
                closeModal('productModal');
                modalWin.style.transform = '';
                overlay.style.backgroundColor = '';
            }, 250);
        } else {
            modalWin.style.transform = `translateY(0)`;
            overlay.style.backgroundColor = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initMobileSwipe();
});
// ==========================================
// ЛОГИКА ПРЕДЛОЖКИ ТОВАРОВ (CREATORS)
// ==========================================
function openProposeModal() {
    if (typeof lenis !== 'undefined') lenis.stop();
    document.getElementById('proposeModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Показываем количество выбранных фото
document.getElementById('propFiles')?.addEventListener('change', function(e) {
    const files = e.target.files;
    const status = document.getElementById('propFileStatus');
    if (files.length > 5) {
        status.innerHTML = `<span style="color:red;">Максимум 5 фото! Вы выбрали ${files.length}.</span>`;
        this.value = ''; // Сбрасываем выбор
    } else {
        status.innerHTML = `Выбрано фото: ${files.length} шт.`;
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
        
        // Грузим фотки в Supabase напрямую с сайта
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileExt = file.name.split('.').pop();
            const fileName = `prop_${Date.now()}_${Math.floor(Math.random()*1000)}.${fileExt}`;
            
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
        showTerminalModal('DATA_UPLOADED.LOG', 'Ваша заявка успешно отправлена на сервер. Админ рассмотрит ее и свяжется с вами.', '[ ЗАКРЫТЬ ]', null);

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
