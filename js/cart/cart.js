// ==========================================
// NISHA CART, CHECKOUT & DELIVERY MODULE
// ==========================================

// Глобальное состояние корзины
if (!window.cart) {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    window.cart = store ? store.getJSON('nisha_cart', []) : [];
}
let cart = window.cart;

window.currentPromoDiscount = 0;
window.appliedPromoCode = '';
let currentPromoDiscount = 0;
let appliedPromoCode = '';

window.selectedCityRef = '';
window.selectedBranchRef = '';
let selectedCityRef = '';
let selectedBranchRef = '';

let citySearchTimeout = null;
let branchSearchTimeout = null;
let cachedBranches = [];
const npBranchCache = {};

// Кэш отделений Новой Почты (In-Memory + IndexedDB + sessionStorage)
const NP_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа актуальности отделений

async function getNPStorageAsync(key) {
    // 1. Проверяем IndexedDB (без лимита в 5MB)
    if (typeof window.idbGet === 'function') {
        try {
            const entry = await window.idbGet('np_' + key);
            if (entry && entry.ts && (Date.now() - entry.ts < NP_CACHE_TTL_MS) && entry.data) {
                return entry.data;
            }
        } catch (e) {}
    }
    // 2. Fallback к safe session storage
    return getNPStorage(key);
}

function getNPStorage(key) {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (store && store.session) {
        return store.session.getJSON('nisha_np_' + key, null);
    }
    try {
        if (typeof sessionStorage !== 'undefined') {
            const raw = sessionStorage.getItem('nisha_np_' + key);
            return raw ? JSON.parse(raw) : null;
        }
    } catch(e) {}
    return null;
}

function setNPStorage(key, val) {
    if (!val || typeof val !== 'object') return;
    // 1. Надежное сохранение в IndexedDB (поддерживает Киев и мегаполисы > 1500 отделений, а также объекты поиска городов)
    if (typeof window.idbSet === 'function') {
        window.idbSet('np_' + key, { ts: Date.now(), data: val }).catch(() => {});
    }
    // 2. Сохранение в safe session storage (если помещается)
    if (!Array.isArray(val) || val.length <= 1500) {
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        if (store && store.session) {
            store.session.setJSON('nisha_np_' + key, val);
            return;
        }
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('nisha_np_' + key, JSON.stringify(val));
            }
        } catch(e) {}
    }
}

let cartSwipeStartX = 0;
let cartSwipeCurrentX = 0;

// Защита от мульти-кликов (Throttle / Spam protection)
let lastCartActionTime = 0;
let isCheckoutOpening = false;
let isOrderSubmitting = false;
// Флаг оформления заказа виден другим модулям (например, баннеру обновления Service Worker)
try {
    Object.defineProperty(window, 'isOrderSubmitting', { get: () => isOrderSubmitting, configurable: true });
} catch (e) {}

// Защита от двойного удаления одного и того же товара (двойной клик / свайп + крестик)
const removingCartIds = new Set();

function escCartHtml(value) {
    return String(value == null ? '' : value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function parseCartPrice(price) {
    return Number.parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
}

// Полный сброс примененного промокода (после заказа / при пустой корзине)
function resetPromoState() {
    currentPromoDiscount = 0;
    window.currentPromoDiscount = 0;
    appliedPromoCode = '';
    window.appliedPromoCode = '';
    window.currentPromoFixed = null;
    const promoInput = document.getElementById('promoInput');
    if (promoInput) promoInput.value = '';
    const promoMsg = document.getElementById('promoMessage');
    if (promoMsg) {
        if (typeof promoMsg.replaceChildren === 'function') promoMsg.replaceChildren();
        else promoMsg.innerHTML = '';
    }
}

// Вспомогательные безопасные геттеры
function getActiveCart() {
    if (window.store && typeof window.store.get === 'function') {
        return window.store.get('cart') || [];
    }
    return window.cart || cart || [];
}
window.getActiveCart = getActiveCart;

function setActiveCart(newCart) {
    window.cart = newCart;
    cart = newCart;
    if (window.store && typeof window.store.set === 'function') {
        window.store.set('cart', newCart);
    } else {
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        if (store) store.setJSON('nisha_cart', newCart);
    }
}
window.setActiveCart = setActiveCart;

function getCurrentUser() {
    return window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
}

function getSupabaseClient() {
    return window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
}

// ==========================================
// 1. ДОБАВЛЕНИЕ В КОРЗИНУ
// ==========================================

// Добавление в корзину прямо с главной страницы (доступно и гостям, и авторизованным)
async function addToCartById(itemId) {

    const catalog = window.allItems || (typeof allItems !== 'undefined' ? allItems : []);
    const item = catalog.find(i => i.id === itemId);
    if (!item) return;

    let currentCart = getActiveCart();
    if (currentCart.some(i => i.id === item.id)) { 
        showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_exist') : 'Уже в корзине!', 'error');
        return; 
    }

    let cartItem = (typeof deepClone === 'function')
        ? deepClone(item)
        : ((typeof structuredClone === 'function') ? structuredClone(item) : { ...item });
    const hacked = window.isHacked || (typeof isHacked !== 'undefined' && isHacked);
    if (hacked) {
        cartItem.price = Math.floor(cartItem.price * 0.9);
    }
    currentCart.push(cartItem);
    setActiveCart(currentCart);
    
    if (window.analytics && typeof window.analytics.trackAddToCart === 'function') {
        window.analytics.trackAddToCart(cartItem);
    } else if (window.ttq) {
        ttq.track('AddToCart', {
            contents: [{ content_id: cartItem.id, content_name: cartItem.name }],
            value: cartItem.price,
            currency: 'UAH'
        });
    }
    
    updateCartUI();
    showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_add') : 'Добавлено в корзину!', 'success', getOptimizedImg(item));
    await syncCartToServer();
}
window.addToCartById = addToCartById;

// Анимация полета товара в корзину
function addToCartWithAnimation(itemId, btnElement, event) {
    if (event) event.stopPropagation(); 
    
    const now = Date.now();
    if (now - lastCartActionTime < 350) return;
    lastCartActionTime = now;

    const catalog = window.allItems || (typeof allItems !== 'undefined' ? allItems : []);
    const item = catalog.find(i => i.id === itemId);
    if (!item) return;

    // ВАЖНО: Добавляем в корзину (доступно гостям и авторизованным)
    addToCartById(itemId);
    
    // БЕЗОПАСНАЯ ВИБРАЦИЯ И ПРОГРЕВ СЕРВЕРА
    if (typeof triggerHaptic === 'function') triggerHaptic('success');
    if (typeof window.warmupBackendServer === 'function') window.warmupBackendServer();
    
    const cartIcon = document.getElementById('cartInfoWrapper');
    if (!cartIcon) return; 

    const btnRect = btnElement.getBoundingClientRect();

    const flyingImg = document.createElement('div');
    flyingImg.className = 'flying-item';

    // Если фото есть - ставим его. Если нет - ставим темный фон.
    if (item.images && item.images.length > 0) {
        flyingImg.style.backgroundImage = `url('${getOptimizedImg(item)}')`;
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
window.addToCartWithAnimation = addToCartWithAnimation;

// Синхронизация корзины с сервером
async function syncCartToServer() {
    const user = getCurrentUser();
    const sb = getSupabaseClient();
    if (!user || !sb) return;
    await sb.from('profiles').update({ cart: getActiveCart() }).eq('id', user.id);
}
window.syncCartToServer = syncCartToServer;

// Добавление в корзину из модального окна товара (доступно и гостям, и авторизованным)
async function addToCartFromModal() {
    const now = Date.now();
    if (now - lastCartActionTime < 350) return;
    lastCartActionTime = now;

    const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    if (!activeItem) return;
    
    let currentCart = getActiveCart();
    if (currentCart.some(i => i.id === activeItem.id)) { 
        showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_exist') : 'Уже в корзине!', 'error');
        return; 
    }
    
    let cartItem = (typeof deepClone === 'function')
        ? deepClone(activeItem)
        : ((typeof structuredClone === 'function') ? structuredClone(activeItem) : { ...activeItem });
    const hacked = window.isHacked || (typeof isHacked !== 'undefined' && isHacked);
    if (hacked) {
        cartItem.price = Math.floor(cartItem.price * 0.9);
    }
    currentCart.push(cartItem);
    setActiveCart(currentCart);
    updateCartUI();
    if (typeof closeModal === 'function') closeModal('productModal');
    showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_add') : 'Добавлено в корзину!', 'success');
    if (typeof window.warmupBackendServer === 'function') window.warmupBackendServer();
    await syncCartToServer();
}
window.addToCartFromModal = addToCartFromModal;

// Обновление интерфейса корзины (плавающая панель, бейдж, сумма)
function updateCartUI() {
    const p = document.getElementById('cartPanel');
    const fab = document.querySelector('.fab-propose');
    if (!p) return; 
    
    const currentCart = getActiveCart();
    if (currentCart.length === 0) { 
        p.classList.remove('show'); 
        if(fab) {
            fab.classList.remove('cart-active'); 
            fab.classList.remove('hidden-scroll'); 
            fab.style.display = 'flex'; 
            fab.style.opacity = '1';
            fab.style.pointerEvents = 'auto';
        }
        // Пустая корзина: сбрасываем промокод и перерисовываем список (иначе остаются "призраки" старых товаров)
        if (window.currentPromoDiscount || window.appliedPromoCode) resetPromoState();
        if (typeof renderCartItems === 'function') renderCartItems();
        return; 
    }
    
    p.classList.add('show'); 
    if(fab) fab.classList.add('cart-active'); 
    
    document.getElementById('cartCount').innerText = currentCart.length;
    let total = currentCart.reduce((sum, item) => sum + parseCartPrice(item.price), 0);
    
    // Применяем скидку по промокоду, если она есть
    const promoDiscount = window.currentPromoDiscount || currentPromoDiscount || 0;
    const promoCode = window.appliedPromoCode || appliedPromoCode || '';
    if (promoDiscount > 0) {
        const fixedAmt = Number(window.currentPromoFixed) || 0;
        // Фиксированная скидка не должна "плыть" при изменении состава корзины; итог не может быть <= 0
        const savedMoney = fixedAmt > 0
            ? Math.min(fixedAmt, Math.max(0, total - 1))
            : Math.floor(total * promoDiscount);
        total = total - savedMoney;
        
        const msg = document.getElementById('promoMessage');
        if (msg && promoCode) {
            const formattedSaved = (typeof formatPrice === 'function') ? formatPrice(savedMoney) : `${savedMoney} ${getCurrency()}`;
            const discDisplay = fixedAmt > 0 ? (typeof formatPrice === 'function' ? `-${formatPrice(fixedAmt)}` : `-${fixedAmt} ${getCurrency()}`) : `${Math.round(promoDiscount * 100)}%`;
            msg.innerHTML = `<span style="color: var(--accent-green);">[✔] Код активирован! Скидка ${discDisplay}<br><span style="font-size: 13px;">Вы сэкономили: <b>${formattedSaved}</b></span></span>`;
        }
    }
    
    document.getElementById('cartTotal').innerText = (typeof formatPrice === 'function') ? formatPrice(total) : (total + ' ' + getCurrency());
    
    if (typeof renderCartItems === 'function') renderCartItems();
}
window.updateCartUI = updateCartUI;

// ==========================================
// 2. ИНТЕГРАЦИЯ НОВОЙ ПОЧТЫ (NOVA POSHTA)
// ==========================================

function debouncedNPCitySearch(query) {
    if (citySearchTimeout) clearTimeout(citySearchTimeout);
    if (typeof closePaymentDropdown === 'function') closePaymentDropdown();
    const bd = document.getElementById('branchDropdown');
    if (bd) bd.style.display = 'none';
    
    const branchEl = document.getElementById('orderBranch');
    if (branchEl) {
        branchEl.value = ''; 
        branchEl.readOnly = true;
    }
    selectedCityRef = '';
    window.selectedCityRef = '';
    selectedBranchRef = '';
    window.selectedBranchRef = '';
    window.selectedSettlementRef = '';
    cachedBranches = [];
    
    const dropdown = document.getElementById('cityDropdown');

    if (query.length < 2) { 
        if (dropdown) dropdown.style.display = 'none'; 
        return; 
    }
    
    citySearchTimeout = setTimeout(() => { 
        searchNPCity(query); 
    }, 500);
}
window.debouncedNPCitySearch = debouncedNPCitySearch;

function renderCitySearchResults(data) {
    const dropdown = document.getElementById('cityDropdown');
    if (!dropdown) return;
    if (typeof dropdown.replaceChildren === 'function') dropdown.replaceChildren();
    else dropdown.innerHTML = '';
    
    if (data.success && data.data[0] && data.data[0].Addresses.length > 0) {
        data.data[0].Addresses.forEach(city => {
            const div = document.createElement('div');
            div.className = 'city-item';
            div.innerText = city.Present;
            
            const selectCityItem = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                document.getElementById('orderCity').value = city.Present;
                selectedCityRef = city.DeliveryCity || city.Ref; 
                window.selectedCityRef = selectedCityRef;
                window.selectedSettlementRef = city.Ref || '';
                dropdown.style.display = 'none';
                
                const branchInput = document.getElementById('orderBranch');
                if (branchInput) {
                    branchInput.readOnly = false;
                    branchInput.value = '';
                    branchInput.placeholder = typeof i18next !== 'undefined' ? i18next.t('checkout.branch_placeholder', { defaultValue: 'Выберите отделение...' }) : 'Выберите отделение...';
                }
                
                cachedBranches = []; 
                loadNPBranches("", false);
                if (typeof saveCheckoutDraft === 'function') saveCheckoutDraft();
            };
            div.onmousedown = selectCityItem;
            div.onclick = selectCityItem;
            div._selectItem = selectCityItem;
            dropdown.appendChild(div);
        });
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

// Поиск города (с sessionStorage кэшированием)
async function searchNPCity(query) {
    const normKey = 'city_' + query.trim().toLowerCase();
    const cached = getNPStorage(normKey);
    if (cached) {
        renderCitySearchResults(cached);
        return;
    }

    try {
        const data = await window.apiClient.post('/api/np-proxy', {
            modelName: 'Address',
            calledMethod: 'searchSettlements',
            methodProperties: { CityName: query, Limit: "10" }
        }, { timeout: 10000, retries: 1, dedupe: true });

        if (data && data.success) {
            setNPStorage(normKey, data);
        }
        renderCitySearchResults(data || { success: false });
    } catch(e) { 
        console.error("Ошибка поиска города НП", e); 
        document.getElementById('cityDropdown').style.display = 'none';
        showToast(typeof i18next !== 'undefined' ? i18next.t('np.city_err') : 'Ошибка поиска города', 'error');
    }
}
window.searchNPCity = searchNPCity;

// Умный поиск отделений
function filterNPBranches(query) {
    if (typeof closePaymentDropdown === 'function') closePaymentDropdown();
    const cd = document.getElementById('cityDropdown');
    if (cd) cd.style.display = 'none';

    // Инвалидируем выбранный ранее ref, если пользователь начал вводить новое значение
    selectedBranchRef = '';
    window.selectedBranchRef = '';

    const dropdown = document.getElementById('branchDropdown');
    if (!dropdown) return;

    const cityRef = window.selectedCityRef || selectedCityRef;
    const q = (query || '').trim().toLowerCase();

    // Мгновенный поиск из кэша памяти (0 мс задержки без лагов)
    const baseList = (cityRef && npBranchCache[cityRef + "_"]) || cachedBranches || [];
    if (baseList && baseList.length > 0) {
        if (branchSearchTimeout) clearTimeout(branchSearchTimeout);
        if (!q) {
            renderBranches(baseList);
        } else {
            const numMatch = q.match(/\d+/);
            const num = numMatch ? numMatch[0] : null;
            const matches = baseList.filter(b => {
                const desc = (b.Description || '').toLowerCase();
                if (num && desc.includes(num)) return true;
                return desc.includes(q);
            });
            renderBranches(matches);
        }
        dropdown.style.display = 'block';
        return;
    }

    if (query.length > 0) {
        dropdown.innerHTML = '<div style="color:#aaa; padding:12px; font-style: italic;">Шукаємо відділення в базі НП...</div>';
        dropdown.style.display = 'block';
    }

    if (branchSearchTimeout) clearTimeout(branchSearchTimeout);
    
    branchSearchTimeout = setTimeout(() => {
        loadNPBranches(query, true);
    }, 300);
}
window.filterNPBranches = filterNPBranches;

// Запрос к прокси Новой Почты (общий помощник)
async function npProxyRequest(methodProperties, calledMethod) {
    return window.apiClient.post('/api/np-proxy', {
        modelName: 'Address',
        calledMethod: calledMethod,
        methodProperties: methodProperties
    }, { timeout: 10000, throwOnHttpError: true, dedupe: true });
}

// Страница отделений: при лимите запросов (429) или сбое сети — короткая пауза и повтор
async function npFetchPage(props) {
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            return await npProxyRequest(props, 'getWarehouses');
        } catch (e) {
            lastErr = e;
            await new Promise(r => setTimeout(r, e && e.status === 429 ? 3000 : 1200));
        }
    }
    throw lastErr;
}

// Минимальный вид отделения для кэша (экономит память и sessionStorage)
function slimBranches(list) {
    return list.map(b => ({ Ref: b.Ref, Description: b.Description || '', TypeOfWarehouse: b.TypeOfWarehouse || '' }));
}

// Если город вписан руками (или восстановлен из черновика) и не выбран из списка —
// находим его в базе НП сами, чтобы отделения всё равно загрузились
async function ensureCityRef() {
    const existing = window.selectedCityRef || selectedCityRef;
    if (existing) return existing;

    const cityInput = document.getElementById('orderCity');
    const typed = cityInput ? cityInput.value.trim() : '';
    if (typed.length < 2) return '';

    try {
        const cleanTyped = typed.replace(/^(м\.|с\.|смт\.?|с-ще\.?|місто|село|г\.|гор\.|город)\s*/i, '').split(',')[0].trim();
        const data = await npProxyRequest({ CityName: cleanTyped || typed, Limit: "10" }, 'searchSettlements');
        const addrs = (data && data.success && data.data && data.data[0] && data.data[0].Addresses) || [];
        if (addrs.length === 0) return '';

        const norm = (str) => String(str || '').toLowerCase()
            .replaceAll(/[’`ʼ]/g, "'")
            .replace(/^(м\.|с\.|смт\.?|с-ще\.?|місто|село|г\.|гор\.|город)\s*/i, '')
            .split(',')[0].trim();
        const wanted = norm(typed);
        const pick = addrs.find(a => norm(a.Present) === wanted || norm(a.MainDescription) === wanted) || (addrs.length === 1 ? addrs[0] : null);

        if (!pick) {
            // Несколько одноимённых населённых пунктов — пусть клиент выберет сам
            renderCitySearchResults(data);
            return '';
        }

        selectedCityRef = pick.DeliveryCity || pick.Ref;
        window.selectedCityRef = selectedCityRef;
        window.selectedSettlementRef = pick.Ref || '';
        if (cityInput) cityInput.value = pick.Present;
        const branchInput = document.getElementById('orderBranch');
        if (branchInput) branchInput.readOnly = false;
        if (typeof saveCheckoutDraft === 'function') saveCheckoutDraft();
        return selectedCityRef;
    } catch (e) {
        console.error("Не удалось определить город НП:", e);
        return '';
    }
}
window.ensureCityRef = ensureCityRef;

// Запрос ВСЕХ отделений и почтоматов города (постранично, с памятью и sessionStorage)
let _branchLoadToken = 0;
async function loadNPBranches(searchString = "", showDropdown = false) {
    if (typeof closePaymentDropdown === 'function') closePaymentDropdown();
    const cd = document.getElementById('cityDropdown');
    if (cd) cd.style.display = 'none';

    if (typeof searchString !== 'string') searchString = "";

    const input = document.getElementById('orderBranch');
    const dropdown = document.getElementById('branchDropdown');
    if (!dropdown) return;

    let cityRef = window.selectedCityRef || selectedCityRef;
    if (!cityRef) {
        cityRef = await ensureCityRef();
        if (!cityRef) {
            const cityInput = document.getElementById('orderCity');
            if (input && (!cityInput || !cityInput.value.trim())) {
                input.placeholder = "Сначала выберите город";
            }
            return;
        }
        if (input) input.readOnly = false;
    }

    const search = searchString.trim();
    const cacheKey = cityRef + "_" + search;

    if (npBranchCache[cacheKey]) {
        if (showDropdown) {
            renderBranches(npBranchCache[cacheKey]);
        }
        return;
    }

    const cachedBranches = await getNPStorageAsync('branchall_' + cacheKey);
    if (cachedBranches && cachedBranches.length > 0) {
        npBranchCache[cacheKey] = cachedBranches;
        if (showDropdown) {
            renderBranches(cachedBranches);
        }
        return;
    }

    const myToken = ++_branchLoadToken;
    if (showDropdown) {
        dropdown.innerHTML = '<div style="color:#aaa; padding:12px; font-style: italic;">Завантаження відділень...</div>';
        dropdown.style.display = 'block';
    }

    try {
        const PAGE_SIZE = 500;
        const MAX_PAGES = 20;
        let refProp = 'CityRef';
        let refVal = cityRef;
        let all = [];

        let loopError = null;
        try {
            for (let page = 1; page <= MAX_PAGES; page++) {
                const buildProps = () => {
                    const p = { Limit: String(PAGE_SIZE), Page: String(page) };
                    p[refProp] = refVal;
                    if (search) p.FindByString = search;
                    return p;
                };

                let data = await npFetchPage(buildProps());
                if (myToken !== _branchLoadToken) return; // клиент уже сменил город/запрос

                let chunk = (data && data.success && Array.isArray(data.data)) ? data.data : [];

                // Запасной вариант для сёл: некоторые населённые пункты ищутся только по SettlementRef
                if (page === 1 && chunk.length === 0 && !search && window.selectedSettlementRef && refProp === 'CityRef') {
                    refProp = 'SettlementRef';
                    refVal = window.selectedSettlementRef;
                    data = await npFetchPage(buildProps());
                    if (myToken !== _branchLoadToken) return;
                    chunk = (data && data.success && Array.isArray(data.data)) ? data.data : [];
                }

                if (chunk.length === 0) break;

                all.push(...slimBranches(chunk));
                if (showDropdown && (page === 1 || all.length <= 50)) {
                    renderBranches(all);
                }

                const total = data && data.info && data.info.totalCount;
                if (chunk.length < PAGE_SIZE || (total && all.length >= total)) break;
            }
        } catch (err) {
            if (myToken !== _branchLoadToken) return;
            loopError = err;
        }
        if (loopError && all.length === 0) throw loopError;

        if (myToken !== _branchLoadToken) return;

        if (all.length > 0) {
            if (input && !input.value) input.placeholder = typeof i18next !== 'undefined' ? i18next.t('checkout.branch_placeholder', { defaultValue: 'Выберите отделение...' }) : 'Выберите отделение...';
            if (!loopError) { // неполный список в кэш не кладём
                npBranchCache[cacheKey] = all;
                if (all.length <= 1500) setNPStorage('branchall_' + cacheKey, all);
            }
            if (showDropdown) {
                renderBranches(all);
            }
        } else {
            if (input && !input.value) input.placeholder = typeof i18next !== 'undefined' ? i18next.t('np.branch_empty', { defaultValue: 'Отделения не найдены' }) : 'Отделения не найдены';
            if (showDropdown) {
                dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">${typeof i18next !== 'undefined' ? i18next.t('np.branch_empty') : 'Отделения не найдены'}</div>`;
                dropdown.style.display = 'block';
            }
        }
    } catch(e) {
        if (myToken !== _branchLoadToken) return;
        console.error("Сбой загрузки отделений НП:", e);
        if (input && !input.value) input.placeholder = typeof i18next !== 'undefined' ? i18next.t('np.branch_err', { defaultValue: 'Ошибка загрузки отделений' }) : 'Ошибка загрузки отделений';
        if (showDropdown) {
            dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">${typeof i18next !== 'undefined' ? i18next.t('np.branch_err') : 'Ошибка загрузки отделений'}</div>`;
            dropdown.style.display = 'block';
        }
    }
}
window.loadNPBranches = loadNPBranches;

// Отрисовка списка отделений с оптимизацией DOM (лимит 50 элементов, 0 мс фризов)
const MAX_RENDERED_BRANCHES = 50;
function renderBranches(branches) {
    const dropdown = document.getElementById('branchDropdown');
    if (!dropdown) return;

    if (typeof dropdown.replaceChildren === 'function') dropdown.replaceChildren();
    else dropdown.innerHTML = '';

    if (!Array.isArray(branches) || branches.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    dropdown.setAttribute('data-lenis-prevent', 'true');

    const fragment = document.createDocumentFragment();
    const count = Math.min(branches.length, MAX_RENDERED_BRANCHES);

    for (let i = 0; i < count; i++) {
        const branch = branches[i];
        const desc = String(branch.Description || '');
        const isPostomat = desc.includes("Поштомат") || desc.includes("Почтомат") || branch.TypeOfWarehouse === 'f9316480-5f2d-425d-bc2c-ac7cd29decf0';
        const div = document.createElement('div');
        div.className = 'branch-item';
        div.setAttribute('data-branch-ref', branch.Ref);
        div.setAttribute('data-branch-desc', desc);

        if (isPostomat) {
            div.appendChild(document.createTextNode('📦 '));
            const span = document.createElement('span');
            span.style.color = '#00aaff';
            span.textContent = desc;
            div.appendChild(span);
        } else {
            div.textContent = desc;
        }

        const selectBranchItem = (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault(); 
            const branchEl = document.getElementById('orderBranch');
            if (branchEl) {
                branchEl.value = desc;
                branchEl.classList.remove('input-field-error');
            }
            selectedBranchRef = branch.Ref;
            window.selectedBranchRef = selectedBranchRef;
            dropdown.style.display = 'none';
            calculateDeliveryCost(); 
            if (typeof saveCheckoutDraft === 'function') saveCheckoutDraft();
        };
        div.onmousedown = selectBranchItem;
        div.onclick = selectBranchItem;
        div._selectItem = selectBranchItem;
        fragment.appendChild(div);
    }

    if (branches.length > MAX_RENDERED_BRANCHES) {
        const notice = document.createElement('div');
        notice.setAttribute('data-msg', 'true');
        notice.style.cssText = 'padding:10px 14px; color:#888; font-size:11px; text-align:center; font-style:italic; border-top:1px dashed #333; pointer-events:none;';
        notice.textContent = `Показано ${MAX_RENDERED_BRANCHES} из ${branches.length}. Введите номер или улицу для уточнения...`;
        fragment.appendChild(notice);
    }

    dropdown.appendChild(fragment);
    dropdown.style.display = 'block';
}
window.renderBranches = renderBranches;

// Расчет стоимости доставки
async function calculateDeliveryCost() {
    const cityRef = window.selectedCityRef || selectedCityRef;
    const currentCart = getActiveCart();
    if (!cityRef || currentCart.length === 0) return;
    
    document.getElementById('deliveryCostInfo').style.display = 'block';
    document.getElementById('calcCostVal').innerText = "Рассчитываем...";
    
    const totalCost = currentCart.reduce((sum, item) => sum + parseCartPrice(item.price), 0);

    try {
        const data = await window.apiClient.post('/api/calc-delivery', {
            cityRef: cityRef,
            cartTotal: totalCost
        }, { timeout: 10000, retries: 1, dedupe: true });

        if (data && data.success) {
            document.getElementById('calcCostVal').innerText = data.cost + " грн";
        } else {
            document.getElementById('calcCostVal').innerText = "По тарифам НП";
        }
    } catch(e) { 
        console.error("Ошибка расчета НП", e);
        document.getElementById('calcCostVal').innerText = "По тарифам НП";
    }
}
window.calculateDeliveryCost = calculateDeliveryCost;

// ==========================================
// 3. ВСПЛЫВАЮЩАЯ КОРЗИНА И СВАЙП-УДАЛЕНИЕ
// ==========================================

async function checkCartItemsAvailability() {
    try {
        const currentCart = getActiveCart();
        if (!currentCart || currentCart.length === 0) return;
        const itemIds = currentCart.map(i => i && (i.id || i)).filter(Boolean);
        const sb = getSupabaseClient();
        if (!sb || itemIds.length === 0) return;

        const { data: dbItems, error } = await sb.from('items').select('id, name, status').in('id', itemIds);
        if (dbItems && !error) {
            let hasChanges = false;
            let soldNames = [];
            currentCart.forEach(cartItem => {
                const dbItem = dbItems.find(i => i.id === cartItem.id);
                const isSold = !dbItem || dbItem.status === 'sold';
                if (cartItem._isSold !== isSold) {
                    cartItem._isSold = isSold;
                    hasChanges = true;
                }
                if (isSold) {
                    soldNames.push(cartItem.name || 'Товар');
                }
            });

            if (hasChanges) {
                renderCartItems();
            }

            if (soldNames.length > 0) {
                const soldMsg = typeof i18next !== 'undefined'
                    ? i18next.t('messages.item_sold', { defaultValue: 'Товар уже куплен' })
                    : 'Товар уже куплен';
                showToast(`⚠️ ${soldMsg}: ${soldNames[0]}`, 'error');
            }
        }
    } catch (e) {
        console.warn('[CART] Ошибка проверки наличия:', e);
    }
}
window.checkCartItemsAvailability = checkCartItemsAvailability;

function toggleCartDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('cartDropdown');
    const fab = document.querySelector('.fab-propose');
    if (dropdown) {
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            checkCartItemsAvailability();
        }
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
window.toggleCartDropdown = toggleCartDropdown;

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
window.closeCartDropdown = closeCartDropdown;

function renderCartItems() {
    const list = document.getElementById('cartDropdownList');
    if (!list) return;
    if (typeof list.replaceChildren === 'function') list.replaceChildren();
    else list.innerHTML = '';
    
    const currentCart = getActiveCart();
    if (currentCart.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a; margin: 10px;">
                <div style="font-size: 30px; margin-bottom: 15px;">🛒</div>
                <div style="color:var(--accent-red); font-family: var(--font-mono); font-weight:bold; margin-bottom: 10px;">${typeof i18next !== 'undefined' ? i18next.t('cart.empty_title') : 'КОРЗИНА ПУСТА'}</div>
                <div style="color:#888; font-size: 12px; line-height: 1.5;">${typeof i18next !== 'undefined' ? i18next.t('cart.empty_desc') : 'Выберите понравившиеся вещи в каталоге'}</div>
            </div>`;
        return;
    }

    list.innerHTML = `
        <div style="padding: 10px; margin-bottom: 10px; border-bottom: 1px dashed #333; display: flex; flex-direction: column; gap: 10px;">
            <div style="color: #666; font-size: 10px; font-family: var(--font-main); text-align: center; margin-top: 5px;">
                ${typeof i18next !== 'undefined' ? i18next.t('cart.warning', {defaultValue: 'Вещи не бронируются и могут быть куплены кем-то другим в любой момент.'}) : 'Вещи не бронируются и могут быть куплены кем-то другим в любой момент.'}
            </div>
        </div>
    `;

    currentCart.forEach((item, index) => {
        const imgUrl = getOptimizedImg(item);
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        const isSold = !!item._isSold;
        const soldBadgeHtml = isSold
            ? `<div class="cart-sold-badge" style="color: #ff4444; font-size: 11px; font-weight: bold; margin-top: 3px; font-family: var(--font-mono); display: flex; align-items: center; gap: 4px;">⚠️ <span>${typeof i18next !== 'undefined' ? i18next.t('messages.item_sold', { defaultValue: 'Товар уже куплен' }) : 'Товар уже куплен'}</span></div>`
            : '';
        const rowStyle = isSold ? 'opacity: 0.8; border-left: 3px solid #ff4444;' : '';
        
        row.innerHTML = `
            <div class="swipe-background">
                <svg class="trash-icon" viewBox="0 0 24 24">
                    <path class="trash-lid" d="M3 6h18 M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    <path class="trash-base" d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6 M10 11v6 M14 11v6"></path>
                </svg>
            </div>
            <div class="swipe-surface" 
                 data-index="${index}"
                 style="${rowStyle}"
                 ontouchstart="handleSwipeStart(event)" 
                 ontouchmove="handleSwipeMove(event)" 
                 ontouchend="handleSwipeEnd(event)">
                <div class="cart-item-img" style="background-image: url('${imgUrl}')"></div>
                <div class="cart-item-info">
                    <div class="cart-item-name" title="${escCartHtml(item.name)}">${escCartHtml(item.name)}</div>
                    <div class="cart-item-size">${typeof i18next !== 'undefined' ? i18next.t('grid.size_prefix') : 'Размер: '}${escCartHtml(item.size)}</div>
                    ${soldBadgeHtml}
                </div>
                <div class="cart-item-price-wrapper">
                    <div class="cart-item-price">${typeof formatPrice === 'function' ? formatPrice(item.price) : `${item.price} ${getCurrency()}`}</div>
                    <div class="cart-item-remove hide-on-mobile" data-action="remove-from-cart" data-index="${index}">×</div>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
}
window.renderCartItems = renderCartItems;

async function removeFromCart(index, event, rowElement) {
    if (event) event.stopPropagation(); 
    
    const startCart = getActiveCart();
    const removedItem = startCart[index];
    if (!removedItem) return;

    const removedId = removedItem.id;
    // Повторный клик/свайп по тому же товару, пока идет анимация удаления, игнорируем
    if (removingCartIds.has(removedId)) return;
    removingCartIds.add(removedId);
    
    const imgUrl = getOptimizedImg(removedItem);

    const executeRemoval = async () => {
        try {
            // Индексы могли сместиться — ищем товар по id в актуальной корзине
            const liveCart = getActiveCart();
            const liveIndex = liveCart.findIndex(i => i && i.id === removedId);
            if (liveIndex === -1) return;

            liveCart.splice(liveIndex, 1);
            setActiveCart(liveCart);
            updateCartUI(); 
            showToast(`${typeof i18next !== 'undefined' ? i18next.t('messages.cart_delete') : 'Удалено: '}${removedItem.name}`, 'error', imgUrl);
            
            if (liveCart.length === 0) {
                const dropdown = document.getElementById('cartDropdown');
                if (dropdown) dropdown.classList.remove('active');
            }
            await syncCartToServer();
        } finally {
            removingCartIds.delete(removedId);
        }
    };

    if (rowElement) {
        rowElement.classList.add('removing');
        setTimeout(executeRemoval, 300); 
    } else {
        await executeRemoval();
    }
}
window.removeFromCart = removeFromCart;

// --- ИНТЕРАКТИВНЫЙ СВАЙП ДЛЯ КОРЗИНЫ (ВЫБРОСИТЬ ТОВАР) ---
window.handleSwipeStart = function(e) {
    cartSwipeStartX = e.touches[0].clientX;
    e.currentTarget.style.transition = 'none'; 
};

window.handleSwipeMove = function(e) {
    cartSwipeCurrentX = e.touches[0].clientX;
    let diff = cartSwipeStartX - cartSwipeCurrentX;
    
    if (diff > 0) {
        let moveX = diff > 200 ? 200 + (diff - 200) * 0.2 : diff;
        e.currentTarget.style.transform = `translateX(-${moveX}px)`;
        
        let surfaceOpacity = Math.max(0.2, 1 - (moveX / 200));
        e.currentTarget.style.opacity = surfaceOpacity;

        const parentRow = e.currentTarget.closest('.cart-item-row');
        const trashIcon = parentRow ? parentRow.querySelector('.trash-icon') : null;
        const trashLid = parentRow ? parentRow.querySelector('.trash-lid') : null;
        
        if (trashIcon && trashLid) {
            let bgOpacity = Math.min(1, moveX / 80); 
            trashIcon.style.opacity = bgOpacity;

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
    const itemIndex = Number.parseInt(rowSurface.getAttribute('data-index'), 10);
    
    rowSurface.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    
    if (diff > 120) {
        if (typeof triggerHaptic === 'function') triggerHaptic('heavy');
        rowSurface.style.transform = `translateX(-150%)`;
        rowSurface.style.opacity = '0';
        
        setTimeout(() => {
            removeFromCart(itemIndex, null, parentRow);
        }, 200);
    } else {
        rowSurface.style.transform = `translateX(0px)`;
        rowSurface.style.opacity = '1';
        
        if (parentRow) {
            const trashIcon = parentRow.querySelector('.trash-icon');
            const trashLid = parentRow.querySelector('.trash-lid');
            if (trashIcon) trashIcon.style.opacity = '0';
            if (trashLid) trashLid.style.transform = `rotate(0deg)`;
        }
    }
    
    cartSwipeStartX = 0;
    cartSwipeCurrentX = 0;
};

// Единый обработчик кликов и тапов вне выпадающих меню (города, отделения, оплата, корзина, язык)
function handleDropdownsOutsideClick(e) {
    if (!e.target.closest('#orderCity') && !e.target.closest('#cityDropdown')) {
        const cd = document.getElementById('cityDropdown');
        if (cd) cd.style.display = 'none';
    }
    if (!e.target.closest('#orderBranch') && !e.target.closest('#branchDropdown')) {
        const bd = document.getElementById('branchDropdown');
        if (bd) bd.style.display = 'none';
    }
    if (!e.target.closest('#paymentDisplay') && !e.target.closest('#paymentDropdown')) {
        if (typeof closePaymentDropdown === 'function') closePaymentDropdown();
    }
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
    if (!e.target.closest('#footerLangWrapper')) {
        const langWrap = document.getElementById('footerLangWrapper');
        if (langWrap) langWrap.classList.remove('active');
    }
}
document.addEventListener('mousedown', handleDropdownsOutsideClick);
document.addEventListener('touchstart', handleDropdownsOutsideClick, { passive: true });

// ==========================================
// 4. ОФОРМЛЕНИЕ ЗАКАЗА (CHECKOUT)
// ==========================================

// --- АВТОСОХРАНЕНИЕ И ВОССТАНОВЛЕНИЕ ЧЕРНОВИКА ЗАКАЗА (DRAFT) ---
function saveCheckoutDraft() {
    try {
        const draft = {
            name: document.getElementById('orderName')?.value || '',
            phone: document.getElementById('orderPhone')?.value || '',
            city: document.getElementById('orderCity')?.value || '',
            branch: document.getElementById('orderBranch')?.value || '',
            cityRef: window.selectedCityRef || selectedCityRef || '',
            branchRef: window.selectedBranchRef || selectedBranchRef || '',
            paymentMethod: document.getElementById('orderPaymentMethod')?.value || '',
            paymentSelectedText: document.getElementById('paymentSelectedText')?.innerText || ''
        };
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        if (store && store.session) {
            store.session.setJSON('nisha_checkout_draft', draft);
        } else {
            try {
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('nisha_checkout_draft', JSON.stringify(draft));
                }
            } catch (e) {}
        }
    } catch(e) {}
}
window.saveCheckoutDraft = saveCheckoutDraft;

function restoreCheckoutDraft() {
    try {
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        let draft = null;
        if (store && store.session) {
            draft = store.session.getJSON('nisha_checkout_draft', null);
        } else {
            try {
                if (typeof sessionStorage !== 'undefined') {
                    const raw = sessionStorage.getItem('nisha_checkout_draft');
                    draft = raw ? JSON.parse(raw) : null;
                }
            } catch (e) {
                draft = null;
            }
        }
        if (!draft || typeof draft !== 'object') return false;

        let hasRestored = false;
        const nameEl = document.getElementById('orderName');
        const phoneEl = document.getElementById('orderPhone');
        const cityEl = document.getElementById('orderCity');
        const branchEl = document.getElementById('orderBranch');

        if (nameEl && draft.name) { nameEl.value = draft.name; hasRestored = true; }
        if (phoneEl && draft.phone) { phoneEl.value = draft.phone; hasRestored = true; }
        if (cityEl && draft.city) { cityEl.value = draft.city; hasRestored = true; }
        if (branchEl && draft.branch) { branchEl.value = draft.branch; hasRestored = true; }

        if (draft.paymentMethod && document.getElementById('orderPaymentMethod')) {
            const rawDraftPm = String(draft.paymentMethod).toLowerCase();
            const isCod = rawDraftPm.includes('200') || rawDraftPm.includes('налож') || rawDraftPm.includes('наклад') || rawDraftPm.includes('delivery') || rawDraftPm.includes('cod');
            document.getElementById('orderPaymentMethod').value = isCod ? 'Наложка (предоплата 200грн)' : 'Полная предоплата';
            const txtEl = document.getElementById('paymentSelectedText');
            if (txtEl) {
                txtEl.setAttribute('data-i18n', isCod ? 'checkout.payment_cod' : 'checkout.payment_full');
                txtEl.innerText = typeof i18next !== 'undefined' ? i18next.t(isCod ? 'checkout.payment_cod' : 'checkout.payment_full') : (draft.paymentSelectedText || document.getElementById('orderPaymentMethod').value);
            }
        } else if (draft.paymentSelectedText && document.getElementById('paymentSelectedText')) {
            document.getElementById('paymentSelectedText').innerText = draft.paymentSelectedText;
        }

        if (draft.cityRef) {
            selectedCityRef = draft.cityRef;
            window.selectedCityRef = draft.cityRef;
        }
        if (draft.branchRef) {
            selectedBranchRef = draft.branchRef;
            window.selectedBranchRef = draft.branchRef;
        }
        return hasRestored;
    } catch(e) { return false; }
}
window.restoreCheckoutDraft = restoreCheckoutDraft;

function clearCheckoutDraft() {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (store && store.session) {
        store.session.remove('nisha_checkout_draft');
    }
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('nisha_checkout_draft');
        }
    } catch(e) {}
}
window.clearCheckoutDraft = clearCheckoutDraft;

async function openCheckoutModal() { 
    if (isCheckoutOpening) return;
    const btn = document.querySelector('.cart-panel .cart-checkout-btn');
    if (!btn) return; 
    
    isCheckoutOpening = true;
    const originalText = btn.innerText;
    btn.innerText = "[ ПРОВЕРКА НАЛИЧИЯ... ]";
    btn.style.pointerEvents = "none";

    try {
        let currentCart = getActiveCart();
        const itemIds = currentCart.map(i => i.id);
        const sb = getSupabaseClient();
        
        let hasSoldItems = false;
        if (sb && itemIds.length > 0) {
            const { data: dbItems, error } = await sb.from('items').select('id, name, status').in('id', itemIds);

            if (dbItems && !error) {
                currentCart = currentCart.filter(cartItem => {
                    const dbItem = dbItems.find(i => i.id === cartItem.id);
                    if (!dbItem || dbItem.status === 'sold') {
                        showToast(`Товар "${cartItem.name}" уже кто-то купил! 😢`, 'error');
                        hasSoldItems = true;
                        return false; 
                    }
                    return true;
                });
            }
        }

        if (hasSoldItems) {
            setActiveCart(currentCart);
            await syncCartToServer();
            updateCartUI();
            btn.innerText = originalText;
            btn.style.pointerEvents = "auto";
            if (currentCart.length === 0) closeCartDropdown();
            return; 
        }

        btn.innerText = originalText;
        btn.style.pointerEvents = "auto";

        if (typeof window.stopLenis === 'function') window.stopLenis();
        else if (typeof lenis !== 'undefined') lenis.stop();
        
        if (typeof openModal === 'function') {
            openModal('checkoutModal');
        } else {
            const checkoutModal = document.getElementById('checkoutModal');
            if (checkoutModal) {
                checkoutModal.inert = false;
                checkoutModal.removeAttribute('inert');
                checkoutModal.setAttribute('aria-hidden', 'false');
                checkoutModal.style.display = 'flex';
            }
            document.body.style.overflow = 'hidden';
        }
        if (window.analytics && typeof window.analytics.trackCheckoutStart === 'function') {
            window.analytics.trackCheckoutStart(currentCart);
        }
        if (typeof window.warmupBackendServer === 'function') window.warmupBackendServer(true);
        if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
        if (typeof initTurnstileWidgets === 'function') setTimeout(initTurnstileWidgets, 100);
        
        // АВТО-ЗАПОЛНЕНИЕ И СОХРАНЕНИЕ ДАННЫХ КЛИЕНТА
        const orderNameEl = document.getElementById('orderName');
        if (orderNameEl) {
            if (typeof window.attachFullNameAutoCapitalize === 'function') {
                window.attachFullNameAutoCapitalize(orderNameEl);
            } else if (!orderNameEl._lettersOnlyBound) {
                orderNameEl._lettersOnlyBound = true;
                orderNameEl.addEventListener('input', function() {
                    this.value = this.value.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '');
                });
            }
        }

        ['orderName', 'orderPhone', 'orderCity', 'orderBranch'].forEach(fieldId => {
            const el = document.getElementById(fieldId);
            if (el && !el._draftBound) {
                el._draftBound = true;
                el.addEventListener('input', saveCheckoutDraft);
            }
        });

        // 1. Проверяем черновик текущей сессии
        const draftRestored = restoreCheckoutDraft();
        if (!draftRestored) {
            // 2. Если черновика нет, подтягиваем последние сохраненные данные
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            const saved = store ? store.getJSON('nisha_checkout_data', null) : null;
            if (saved && typeof saved === 'object') {
                try {
                    if (document.getElementById('orderName')) document.getElementById('orderName').value = saved.name || '';
                    if (document.getElementById('orderPhone')) document.getElementById('orderPhone').value = saved.phone || '';
                    if (document.getElementById('orderCity')) document.getElementById('orderCity').value = saved.city || '';
                    if (document.getElementById('orderBranch')) {
                        document.getElementById('orderBranch').value = saved.branch || '';
                        if (saved.city) {
                            document.getElementById('orderBranch').readOnly = false;
                        }
                    }
                    
                    selectedCityRef = saved.cityRef || '';
                    window.selectedCityRef = selectedCityRef;
                    selectedBranchRef = saved.branchRef || '';
                    window.selectedBranchRef = selectedBranchRef;

                    if (saved.city && !selectedCityRef) {
                        ensureCityRef().catch(() => {});
                    }
                } catch(e) { autoDetectCity(); }
            } else {
                autoDetectCity(); 
            }
        }

        // 3. Подтягиваем сохраненные в профиле данные доставки (ФИО и Адрес)
        const activeProfile = window.userProfile || (typeof userProfile !== 'undefined' ? userProfile : null);
        const deliveryStore = window.storage || (typeof storage !== 'undefined' ? storage : null);
        const cachedDelivery = deliveryStore ? deliveryStore.getJSON('nisha_profile_delivery', null) : null;
        const profileFullName = activeProfile?.full_name || cachedDelivery?.full_name || '';
        const profileAddress = activeProfile?.delivery_address || cachedDelivery?.delivery_address || '';

        const nameInput = document.getElementById('orderName');
        if (nameInput && !nameInput.value.trim() && profileFullName) {
            nameInput.value = profileFullName;
        }

        const cityInput = document.getElementById('orderCity');
        const branchInput = document.getElementById('orderBranch');
        if (cityInput && !cityInput.value.trim() && profileAddress) {
            let pCity = '';
            let pBranch = '';
            if (profileAddress.includes(',')) {
                const parts = profileAddress.split(',');
                pCity = parts[0] ? parts[0].trim() : '';
                pBranch = parts.slice(1).join(',').trim();
            } else {
                pCity = profileAddress.trim();
            }

            if (pCity) {
                cityInput.value = pCity;
                if (branchInput) {
                    branchInput.readOnly = false;
                    if (pBranch && !branchInput.value.trim()) {
                        branchInput.value = pBranch;
                    }
                }
                ensureCityRef().then(ref => {
                    if (ref && branchInput && !branchInput.value.trim()) {
                        loadNPBranches("", false);
                    }
                }).catch(() => {});
            }
        }

        if (branchInput && !branchInput._unlockBound) {
            branchInput._unlockBound = true;
            const unlockAndLoad = (e) => {
                const cVal = document.getElementById('orderCity')?.value.trim();
                if (cVal && cVal.length >= 2) {
                    branchInput.readOnly = false;
                    loadNPBranches("", true);
                }
            };
            branchInput.addEventListener('click', unlockAndLoad);
            branchInput.addEventListener('touchstart', unlockAndLoad, { passive: true });
        }

        if (branchInput && !branchInput._enterBound) {
            branchInput._enterBound = true;
            branchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    const bd = document.getElementById('branchDropdown');
                    if (bd) {
                        const firstItem = bd.querySelector('.branch-item, div[data-branch-ref]');
                        if (firstItem && !window.selectedBranchRef) {
                            if (typeof firstItem._selectItem === 'function') {
                                firstItem._selectItem();
                            } else if (typeof firstItem.click === 'function') {
                                firstItem.click();
                            }
                        }
                        bd.style.display = 'none';
                    }
                    branchInput.blur();
                }
            });
        }

        if (cityInput && !cityInput._enterBound) {
            cityInput._enterBound = true;
            cityInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault();
                    const cd = document.getElementById('cityDropdown');
                    if (cd) {
                        const firstCity = cd.querySelector('.city-item, div');
                        if (firstCity && !window.selectedCityRef) {
                            if (typeof firstCity._selectItem === 'function') {
                                firstCity._selectItem();
                            } else if (typeof firstCity.click === 'function') {
                                firstCity.click();
                            }
                        }
                        cd.style.display = 'none';
                    }
                    cityInput.blur();
                }
            });
        }

        // Показываем чекбокс "Запомнить этот адрес в профиле" только для авторизованных
        const saveWrap = document.getElementById('saveDeliveryToProfileWrap');
        const isAuth = !!(window.currentUser || (typeof currentUser !== 'undefined' && currentUser));
        if (saveWrap) {
            saveWrap.style.display = isAuth ? 'flex' : 'none';
        }

        if (document.getElementById('orderPhone')?.value && typeof checkPhoneAuth === 'function') {
            checkPhoneAuth();
        }
        
        if (selectedCityRef && selectedBranchRef && getActiveCart().length > 0) {
            calculateDeliveryCost();
        }
    } finally {
        setTimeout(() => { isCheckoutOpening = false; }, 400);
    }
}
window.openCheckoutModal = openCheckoutModal;

function normalizeOrderPhone(raw) {
    if (!raw) return '';
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length === 10 && digits.startsWith('0')) {
        return '+38' + digits;
    } else if (digits.length === 9) {
        return '+380' + digits;
    } else if (digits.length === 12 && digits.startsWith('380')) {
        return '+' + digits;
    }
    return raw.replace(/[^\d+]/g, '');
}
window.normalizeOrderPhone = normalizeOrderPhone;

async function submitOrder() {
    if (isOrderSubmitting) return;
    if (typeof window.triggerVibration === 'function') window.triggerVibration(150);
    const botTrap = document.getElementById('botTrap');
    if (botTrap && botTrap.value !== "") return;
    
    if (typeof getUserPhone === 'function') {
        const uPhone = getUserPhone();
        if (uPhone) {
            const ordPhone = document.getElementById('orderPhone');
            if (ordPhone) ordPhone.value = uPhone;
            window.otpVerified = true;
        }
    }

    const isVerified = window.otpVerified || (typeof otpVerified !== 'undefined' && otpVerified);
    if (!isVerified) {
        showToast('Подтвердите номер телефона!', 'error');
        return;
    }

    const rawName = document.getElementById('orderName').value.trim();
    const cleanLettersName = rawName.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '').trim();
    const rawCity = document.getElementById('orderCity').value.trim();
    const rawBranch = document.getElementById('orderBranch').value.trim();
    
    const sanitize = (typeof window.sanitizeText === 'function') ? window.sanitizeText : (s) => String(s || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const name = sanitize(cleanLettersName);
    const city = sanitize(rawCity);
    const branch = sanitize(rawBranch);

    const phoneRaw = document.getElementById('orderPhone').value;
    const phone = normalizeOrderPhone(phoneRaw);

    function highlightFieldError(inputEl) {
        if (!inputEl) return;
        inputEl.classList.add('input-field-error');
        try {
            inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch(e) {}
        try {
            inputEl.focus();
        } catch(e) {}
        if (inputEl._clearErrorCtrl) {
            try { inputEl._clearErrorCtrl.abort(); } catch(e) {}
        }
        const clearCtrl = new AbortController();
        inputEl._clearErrorCtrl = clearCtrl;
        const onClear = () => {
            inputEl.classList.remove('input-field-error');
            clearCtrl.abort();
            inputEl._clearErrorCtrl = null;
        };
        inputEl.addEventListener('input', onClear, { signal: clearCtrl.signal });
        inputEl.addEventListener('change', onClear, { signal: clearCtrl.signal });
    }

    const nameInput = document.getElementById('orderName');
    const phoneInput = document.getElementById('orderPhone');
    const cityInput = document.getElementById('orderCity');
    const branchInput = document.getElementById('orderBranch');

    if (!name || name.length < 2) { 
        highlightFieldError(nameInput);
        showToast(typeof i18next !== 'undefined' ? i18next.t('messages.req_fields') : 'Введите ваше имя (от 2 букв)!', 'error'); 
        return; 
    }

    const phoneDigits = phone.replace(/[^\d]/g, '');
    const isValidUAPhone = phoneDigits.length === 12 && phoneDigits.startsWith('380');
    if (!phone || !isValidUAPhone) {
        highlightFieldError(phoneInput);
        showToast(typeof i18next !== 'undefined' ? i18next.t('messages.valid_phone', { defaultValue: 'Введите полный номер телефона (+380...)!' }) : 'Введите полный номер телефона (+380...)!', 'error');
        return;
    }

    const cityRef = window.selectedCityRef || selectedCityRef;
    if (!city || !cityRef) {
        highlightFieldError(cityInput);
        showToast('Выберите Город строго из выпадающего списка!', 'error');
        return;
    }

    const branchRef = window.selectedBranchRef || selectedBranchRef;
    if (!branch || !branchRef) {
        highlightFieldError(branchInput);
        showToast('Выберите Отделение или Поштомат из выпадающего списка!', 'error');
        return;
    }

    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    const savedEmailPreference = store ? store.get('nisha_email_preference') : null;
    
    if (savedEmailPreference === 'skipped') {
        return await executeOrderFinal('');
    }
    if (savedEmailPreference && savedEmailPreference.includes('@')) {
        return await executeOrderFinal(savedEmailPreference);
    }

    const user = getCurrentUser();
    if (user && user.email) {
        if (store) store.set('nisha_email_preference', user.email);
        return await executeOrderFinal(user.email);
    }

    const prompt = document.getElementById('emailPromptOverlay');
    const emailInput = document.getElementById('promptEmailInput');
    if (prompt && emailInput) {
        emailInput.value = '';
        prompt.style.display = 'flex';
    } else {
        await executeOrderFinal('');
    }
}
window.submitOrder = submitOrder;

async function confirmEmailPrompt(wantsEmail) {
    if (isOrderSubmitting) return;

    const branch = document.getElementById('orderBranch')?.value.trim();
    const branchRef = window.selectedBranchRef || selectedBranchRef;
    const city = document.getElementById('orderCity')?.value.trim();
    const cityRef = window.selectedCityRef || selectedCityRef;

    if (!city || !cityRef) {
        const prompt = document.getElementById('emailPromptOverlay');
        if (prompt) prompt.style.display = 'none';
        const cityInput = document.getElementById('orderCity');
        if (typeof highlightFieldError === 'function') highlightFieldError(cityInput);
        showToast('Выберите Город строго из выпадающего списка!', 'error');
        return;
    }

    if (!branch || !branchRef) {
        const prompt = document.getElementById('emailPromptOverlay');
        if (prompt) prompt.style.display = 'none';
        const branchInput = document.getElementById('orderBranch');
        if (typeof highlightFieldError === 'function') highlightFieldError(branchInput);
        showToast('Выберите Отделение или Поштомат из выпадающего списка!', 'error');
        return;
    }

    const prompt = document.getElementById('emailPromptOverlay');
    const emailInput = document.getElementById('promptEmailInput');
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    let finalEmail = '';

    if (wantsEmail) {
        finalEmail = emailInput ? emailInput.value.trim() : '';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(finalEmail)) {
            showToast('Введите корректный E-mail!', 'error');
            return; 
        }
        if (store) store.set('nisha_email_preference', finalEmail);
    } else {
        if (store) store.set('nisha_email_preference', 'skipped');
    }

    if (prompt) prompt.style.display = 'none'; 
    await executeOrderFinal(finalEmail); 
}
window.confirmEmailPrompt = confirmEmailPrompt;

async function executeOrderFinal(emailToSave) {
    if (isOrderSubmitting) return;
    isOrderSubmitting = true;
    const btnSubmit = document.getElementById('btnSubmitOrder');
    if (!btnSubmit) {
        isOrderSubmitting = false;
        return;
    }

    function resetSubmitButton() {
        if (!btnSubmit) return;
        btnSubmit.style.pointerEvents = "auto";
        btnSubmit.style.position = "";
        btnSubmit.style.overflow = "";
        btnSubmit.style.color = "";
        btnSubmit.innerHTML = typeof i18next !== 'undefined' ? i18next.t('checkout.btn_submit', { defaultValue: 'ПОДТВЕРДИТЬ ЗАКАЗ' }) : 'ПОДТВЕРДИТЬ ЗАКАЗ';
    }
    
    btnSubmit.style.pointerEvents = "none";
    btnSubmit.style.position = "relative";
    btnSubmit.style.overflow = "hidden";
    btnSubmit.style.color = "#000";
    btnSubmit.innerHTML = `
        <span style="position: relative; z-index: 2;">[ ОБРАБОТКА ДАННЫХ... ]</span>
        <div id="btnProgressBar" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: #fff; z-index: 1; transition: width 3s cubic-bezier(0.1, 0.7, 1.0, 0.1);"></div>
    `;
    
    setTimeout(() => {
        const bar = document.getElementById('btnProgressBar');
        if(bar) bar.style.width = "90%";
    }, 50);

    const rawName = document.getElementById('orderName').value.trim();
    const name = rawName.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '').trim();
    const phoneRaw = document.getElementById('orderPhone').value;
    const phone = normalizeOrderPhone(phoneRaw);
    const city = document.getElementById('orderCity').value.trim();
    const branch = document.getElementById('orderBranch').value.trim();
    const rawPaymentVal = document.getElementById('orderPaymentMethod') ? document.getElementById('orderPaymentMethod').value : '';
    const lowerPmVal = String(rawPaymentVal || '').toLowerCase();
    const paymentMethod = (lowerPmVal.includes('200') || lowerPmVal.includes('налож') || lowerPmVal.includes('наклад') || lowerPmVal.includes('delivery') || lowerPmVal.includes('cod'))
        ? 'Наложка (предоплата 200грн)'
        : 'Полная предоплата';
    const nameWithPayment = paymentMethod ? name + ' [' + paymentMethod + ']' : name;

    const currentCart = getActiveCart();
    const orderItemIds = currentCart.map(i => i.id);
    const cityRef = window.selectedCityRef || selectedCityRef;
    const branchRef = window.selectedBranchRef || selectedBranchRef;

    // СТРОГАЯ ЗАЩИТА: заказ не может быть оформлен без города или отделения Новой Почты
    if (!city || !cityRef) {
        isOrderSubmitting = false;
        resetSubmitButton();
        const cityInput = document.getElementById('orderCity');
        if (typeof highlightFieldError === 'function') highlightFieldError(cityInput);
        showToast('Выберите Город строго из выпадающего списка!', 'error');
        return;
    }
    if (!branch || !branchRef) {
        isOrderSubmitting = false;
        resetSubmitButton();
        const branchInput = document.getElementById('orderBranch');
        if (typeof highlightFieldError === 'function') highlightFieldError(branchInput);
        showToast('Выберите Отделение или Поштомат из выпадающего списка!', 'error');
        return;
    }

    const checkoutData = {
        name: name,
        phone: phoneRaw,
        city: city,
        branch: branch,
        cityRef: cityRef,
        branchRef: branchRef
    };
    if (window.storage && typeof window.storage.setJSON === 'function') {
        window.storage.setJSON('nisha_checkout_data', checkoutData);
    }

    try {
        const user = getCurrentUser();
        const sb = getSupabaseClient();
        const activePromo = window.appliedPromoCode || appliedPromoCode || null;
        const idempotencyKey = window.apiClient.generateIdempotencyKey('order');

        let orderId = null;
        let finalTotalSum = currentCart.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
        let finalOrderItems = currentCart.map(i => {
            const clone = (typeof deepClone === 'function')
                ? deepClone(i)
                : ((typeof structuredClone === 'function') ? structuredClone(i) : { ...i });
            clone.currentPrice = clone.currentPrice !== undefined ? clone.currentPrice : clone.price;
            return clone;
        });
        let createdAtIso = new Date().toISOString();
        let handledViaAtomicServer = false;
        const saveDeliveryCheckbox = document.getElementById('saveDeliveryToProfileCheckbox');
        const shouldSaveToProfile = !!(user && (!saveDeliveryCheckbox || saveDeliveryCheckbox.checked));

        // 1. ОСНОВНОЙ ПУТЬ: Атомарное оформление через защищенный сервер (/api/create-order)
        try {
            const serverOrderRes = await window.apiClient.post('/api/create-order', {
                userId: user ? user.id : null,
                name: name,
                phone: phone,
                email: emailToSave,
                tg: '',
                city: city,
                branch: branch,
                cityRef: cityRef || '',
                branchRef: branchRef || '',
                itemIds: orderItemIds,
                promocode: activePromo,
                paymentMethod: paymentMethod,
                saveToProfile: shouldSaveToProfile
            }, {
                idempotencyKey: idempotencyKey,
                timeout: 15000,
                retries: 1
            });

            if (serverOrderRes && serverOrderRes.success && serverOrderRes.orderId) {
                orderId = serverOrderRes.orderId;
                if (serverOrderRes.totalSum) finalTotalSum = Number(serverOrderRes.totalSum);
                if (Array.isArray(serverOrderRes.items) && serverOrderRes.items.length > 0) {
                    finalOrderItems = serverOrderRes.items;
                }
                if (serverOrderRes.createdAt) createdAtIso = serverOrderRes.createdAt;
                handledViaAtomicServer = true;
            } else if (serverOrderRes && !serverOrderRes.success) {
                // Если товар уже куплен или забронирован другим покупателем (409 ITEM_UNAVAILABLE)
                if (serverOrderRes.code === 'ITEM_UNAVAILABLE') {
                    const unavailIds = new Set((serverOrderRes.unavailableItems || []).map(u => String(u.id)));
                    const updatedCart = unavailIds.size > 0
                        ? currentCart.filter(ci => !unavailIds.has(String(ci.id)))
                        : currentCart;
                    setActiveCart(updatedCart);
                    await syncCartToServer();
                    updateCartUI();
                    if (updatedCart.length === 0 && typeof closeModal === 'function') {
                        closeModal('checkoutModal');
                    }
                    throw new Error(serverOrderRes.message || 'Один из товаров уже куплен другим покупателем!');
                }
                if (serverOrderRes._status && serverOrderRes._status >= 400 && serverOrderRes._status < 500 && serverOrderRes._status !== 404) {
                    throw new Error(serverOrderRes.message || 'Ошибка проверки данных заказа');
                }
            }
        } catch (serverErr) {
            // Если это бизнес-ошибка (например, ошибка валидации полей, товар уже куплен или телефон в ЧС) — показываем ошибку и НЕ делаем слепой RPC-фоллбэк!
            const errMsg = serverErr && serverErr.message ? String(serverErr.message) : '';
            if (
                errMsg.includes('уже кто-то купил') ||
                errMsg.includes('уже куплен') ||
                errMsg.includes('оформляется другим') ||
                errMsg.includes('Доступ запрещен') ||
                errMsg.includes('отделение') ||
                errMsg.includes('город') ||
                errMsg.includes('имя') ||
                errMsg.includes('телефон') ||
                errMsg.includes('проверки данных') ||
                errMsg.includes('Validation')
            ) {
                isOrderSubmitting = false;
                resetSubmitButton();
                showToast(errMsg, 'error');
                return;
            }
            console.warn('[ЗАКАЗ] Серверный /api/create-order недоступен, используем прямой RPC фоллбэк:', serverErr.message);
        }

        // 2. РЕЗЕРВНЫЙ ПУТЬ (если сервер Render перезагружается): Прямой транзакционный RPC в Supabase
        if (!handledViaAtomicServer) {
            if (!sb) throw new Error('База данных недоступна');

            if (!city || !branch || !cityRef || !branchRef) {
                isOrderSubmitting = false;
                resetSubmitButton();
                showToast('Выберите Город и Отделение строго из выпадающего списка!', 'error');
                return;
            }

            let rpcParams = {
                p_user_id: user ? user.id : null,
                p_name: name,
                p_phone: phone,
                p_email: emailToSave,
                p_tg: '',
                p_city: city,
                p_branch: branch,
                p_city_ref: cityRef || '',
                p_branch_ref: branchRef || '',
                p_item_ids: orderItemIds,
                p_promocode: activePromo,
                p_payment_method: paymentMethod
            };

            // Сначала пробуем атомарную SQL-функцию create_atomic_order
            const atomicRpc = await sb.rpc('create_atomic_order', rpcParams);
            if (!atomicRpc.error && atomicRpc.data && atomicRpc.data.order_id) {
                orderId = atomicRpc.data.order_id;
                if (atomicRpc.data.total_sum) finalTotalSum = Number(atomicRpc.data.total_sum);
                if (Array.isArray(atomicRpc.data.items) && atomicRpc.data.items.length > 0) {
                    finalOrderItems = atomicRpc.data.items;
                }
            } else {
                // Фоллбэк к классической create_secure_order
                let { data: fbOrderId, error: orderError } = await sb.rpc('create_secure_order', rpcParams);

                if (orderError && (orderError.message.includes('p_payment_method') || orderError.message.includes('create_secure_order') || orderError.code === 'PGRST202')) {
                    console.warn('[ЗАКАЗ] Используем обратную совместимость create_secure_order:', orderError.message);
                    delete rpcParams.p_payment_method;
                    rpcParams.p_name = nameWithPayment;
                    const fallbackRes = await sb.rpc('create_secure_order', rpcParams);
                    fbOrderId = fallbackRes.data;
                    orderError = fallbackRes.error;
                }

                if (orderError) throw orderError;
                orderId = fbOrderId;

                try {
                    await sb.from('orders').update({ status: 'В обработке', payment_method: paymentMethod }).eq('id', orderId);
                } catch (stErr) {}
            }
        }

        if (window.analytics && typeof window.analytics.trackPurchase === 'function') {
            window.analytics.trackPurchase({
                orderId,
                items: currentCart,
                value: finalTotalSum,
                paymentMethod
            });
        } else if (window.ttq) {
            ttq.track('CompletePayment', {
                contents: currentCart.map(i => ({ content_id: i.id, content_name: i.name })),
                value: finalTotalSum,
                currency: 'UAH'
            });
        }

        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        if (store) {
            store.set('nisha_last_phone', phone);
            store.set('nisha_last_order', Date.now());
        }

        if (user && user.id && phone) {
            if (!handledViaAtomicServer) {
                window.apiClient.post('/api/link-orders', { userId: user.id, phone: phone }, { timeout: 8000 }).catch(() => {});
            }

            if (typeof window.userProfile === 'object' && window.userProfile && !window.userProfile.phone && sb) {
                window.userProfile.phone = phone;
                sb.from('profiles').update({ phone: phone }).eq('id', user.id).then(() => {
                    if (typeof window.renderProfilePhone === 'function') window.renderProfilePhone(phone);
                }).catch(() => {});
            }

            if (shouldSaveToProfile) {
                const combinedAddress = city && branch ? `${city}, ${branch}` : (city || branch);
                if (typeof window.saveDeliveryToProfile === 'function') {
                    window.saveDeliveryToProfile(name, combinedAddress);
                }
            }
        }

        try {
            let cached = store ? store.getJSON('nisha_cached_orders', []) : [];
            if (!Array.isArray(cached)) cached = [];
            const newOrderObj = {
                id: orderId,
                name: name,
                phone: phone,
                city: city,
                branch: branch,
                status: 'В обработке',
                total_sum: finalTotalSum,
                items: finalOrderItems,
                created_at: createdAtIso
            };
            cached = [newOrderObj, ...cached.filter(c => c && c.id !== orderId)];
            if (store) store.setJSON('nisha_cached_orders', cached);
        } catch (e) {}

        if (Array.isArray(window.allItems) && Array.isArray(finalOrderItems)) {
            finalOrderItems.forEach(ordered => {
                const catItem = window.allItems.find(i => i && String(i.id) === String(ordered.id));
                if (catItem) {
                    catItem.status = 'reserved';
                    if (typeof window.updateCardDOM === 'function') window.updateCardDOM(catItem);
                }
            });
            if (typeof window.updateSidebarCounters === 'function') window.updateSidebarCounters();
            if (typeof renderHistory === 'function') renderHistory();
        }

        setActiveCart([]);
        clearCheckoutDraft();
        resetPromoState();
        if (!handledViaAtomicServer) {
            await syncCartToServer();
        }
        updateCartUI();
        
        const bar = document.getElementById('btnProgressBar');
        if(bar) {
            bar.style.transition = "width 0.2s ease";
            bar.style.width = "100%";
        }

        setTimeout(() => {
            if (typeof closeModal === 'function') closeModal('checkoutModal');
            btnSubmit.innerHTML = typeof i18next !== 'undefined' ? i18next.t('checkout.btn_submit') : 'ПОДТВЕРДИТЬ ЗАКАЗ';
            
            const overlay = document.getElementById('orderSuccessOverlay');
            if (overlay) overlay.style.display = 'flex';
            
            setTimeout(() => { 
                if (overlay) overlay.style.display = 'none'; 
                if (typeof window.loadAllItems === 'function') window.loadAllItems();
                btnSubmit.style.pointerEvents = "auto";
                btnSubmit.style.opacity = "1";
                isOrderSubmitting = false;
            }, 3500);
        }, 300);

    } catch (err) {
        isOrderSubmitting = false;
        if (typeof window.captureError === 'function') {
            window.captureError(err, { action: 'checkout_order_failed', city: city });
        }
        showToast('Ошибка при оформлении: ' + err.message, 'error');
        btnSubmit.innerHTML = typeof i18next !== 'undefined' ? i18next.t('checkout.btn_submit') : 'ПОДТВЕРДИТЬ ЗАКАЗ';
        btnSubmit.style.pointerEvents = "auto";
        btnSubmit.style.opacity = "1";
        if (typeof window.loadAllItems === 'function') window.loadAllItems();
    }
}
window.executeOrderFinal = executeOrderFinal;

// ==========================================
// 5. GEO IP АВТООПРЕДЕЛЕНИЕ ГОРОДА
// ==========================================

async function autoDetectCity() {
    const cityInput = document.getElementById('orderCity');
    const branchInput = document.getElementById('orderBranch');
    
    if (!cityInput || cityInput.value.trim() !== '') return;

    const originalPlaceholder = cityInput.placeholder;
    cityInput.placeholder = "Поиск спутников..."; 

    try {
        let data = null;
        if (window.apiClient && typeof window.apiClient.get === 'function') {
            try {
                const edgeGeo = await window.apiClient.get('/api/geo', { timeout: 2500, retries: 0, dedupe: true });
                if (edgeGeo && edgeGeo.success && edgeGeo.city) {
                    data = edgeGeo;
                }
            } catch (edgeErr) {}
        }
        if (!data) {
            const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(4000) : undefined });
            data = await res.json();
        }

        if (data && data.country_code === 'UA' && data.city) {
            const enToUaCities = {
                'Kyiv': 'Київ', 'Kiev': 'Київ', 'Kharkiv': 'Харків', 'Kharkov': 'Харків',
                'Odesa': 'Одеса', 'Odessa': 'Одеса', 'Dnipro': 'Дніпро', 'Dnipropetrovsk': 'Дніпро',
                'Donetsk': 'Донецьк', 'Zaporizhzhia': 'Запоріжжя', 'Zaporozhye': 'Запоріжжя',
                'Lviv': 'Львів', 'Lvov': 'Львів', 'Kryvyi Rih': 'Кривий Ріг', 'Krivoy Rog': 'Кривий Ріг',
                'Mykolaiv': 'Миколаїв', 'Nikolaev': 'Миколаїв', 'Mariupol': 'Маріуполь',
                'Luhansk': 'Луганськ', 'Lugansk': 'Луганськ', 'Vinnytsia': 'Вінниця', 'Vinnitsa': 'Вінниця',
                'Makiivka': 'Макіївка', 'Makeyevka': 'Макіївка', 'Simferopol': 'Сімферополь',
                'Chernihiv': 'Чернігів', 'Chernigov': 'Чернігів', 'Kherson': 'Херсон',
                'Poltava': 'Полтава', 'Khmelnytskyi': 'Хмельницький', 'Khmelnytskyy': 'Хмельницький',
                'Cherkasy': 'Черкаси', 'Cherkassy': 'Черкаси', 'Chernivtsi': 'Чернівці', 'Chernovtsy': 'Чернівці',
                'Zhytomyr': 'Житомир', 'Zhitomir': 'Житомир', 'Sumy': 'Суми',
                'Rivne': 'Рівне', 'Rovno': 'Рівне', 'Horlivka': 'Горлівка', 'Gorlovka': 'Горлівка',
                'Ivano-Frankivsk': 'Івано-Франківськ', 'Ivano-Frankovsk': 'Івано-Франківськ',
                'Kamianske': 'Кам\'янське', 'Dniprodzerzhynsk': 'Кам\'янське', 'Kropyvnytskyi': 'Кропивницький', 'Kirovohrad': 'Кропивницький',
                'Ternopil': 'Тернопіль', 'Ternopol': 'Тернопіль', 'Kremenchuk': 'Кременчук', 'Kremenchug': 'Кременчук',
                'Lutsk': 'Луцьк', 'Bila Tserkva': 'Біла Церква', 'Belaya Tserkov': 'Біла Церква',
                'Kramatorsk': 'Краматорськ', 'Melitopol': 'Мелітополь', 'Uzhhorod': 'Ужгород', 'Uzhgorod': 'Ужгород',
                'Brovary': 'Бровари', 'Berdiansk': 'Бердянськ', 'Berdyansk': 'Бердянськ',
                'Pavlohrad': 'Павлоград', 'Pavlograd': 'Павлоград', 'Sievierodonetsk': 'Сєвєродонецьк', 'Severodonetsk': 'Сєвєродонецьк',
                'Kamianets-Podilskyi': 'Кам\'янець-Подільський', 'Kamenets-Podolskiy': 'Кам\'янець-Подільський'
            };
            let detectedCity = enToUaCities[data.city] || data.city;
            if (detectedCity === data.city && data.latitude && data.longitude) {
                try {
                    const nomUrl = new URL('https://nominatim.openstreetmap.org/reverse');
                    nomUrl.search = new URLSearchParams({
                        lat: String(data.latitude),
                        lon: String(data.longitude),
                        format: 'json',
                        'accept-language': 'uk'
                    }).toString();
                    const nomRes = await fetch(nomUrl.toString(), { signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(4000) : undefined });
                    const nomData = await nomRes.json();
                    if (nomData && nomData.address) {
                        detectedCity = nomData.address.city || nomData.address.town || nomData.address.village || detectedCity;
                    }
                } catch(e) {}
            }
            
            const npData = await window.apiClient.post('/api/np-proxy', {
                modelName: 'Address',
                calledMethod: 'searchSettlements',
                methodProperties: { CityName: detectedCity, Limit: "1" }
            }, { timeout: 8000, retries: 1, dedupe: true });

            if (npData && npData.success && npData.data && npData.data[0] && npData.data[0].Addresses.length > 0) {
                const cityObj = npData.data[0].Addresses[0];
                cityInput.value = cityObj.Present; 
                selectedCityRef = cityObj.DeliveryCity || cityObj.Ref; 
                window.selectedCityRef = selectedCityRef;
                window.selectedSettlementRef = cityObj.Ref || '';
                
                if (branchInput) {
                    branchInput.readOnly = false;
                    branchInput.placeholder = typeof i18next !== 'undefined' ? i18next.t('checkout.branch_placeholder', { defaultValue: 'Выберите отделение...' }) : 'Выберите отделение...';
                }
                loadNPBranches("", false);
                
                showToast(`[GEO] Локация: ${cityObj.MainDescription}`, 'success');
            } else {
                cityInput.value = detectedCity; 
                searchNPCity(detectedCity);
            }
        } else {
            cityInput.placeholder = originalPlaceholder;
        }
    } catch (err) {
        console.error("Ошибка GeoIP:", err);
        cityInput.placeholder = originalPlaceholder;
    }
}
window.autoDetectCity = autoDetectCity;

// ==========================================
// 6. ПРОМОКОДЫ
// ==========================================

async function applyPromoCode() {
    const input = document.getElementById('promoInput').value.trim().toUpperCase();
    const msg = document.getElementById('promoMessage');
    const btn = document.querySelector('.promo-wrapper button');

    if (!input) return;

    btn.innerText = '...';
    
    const currentCart = getActiveCart();
    const originalTotal = currentCart.reduce((sum, item) => sum + parseCartPrice(item.price), 0);

    try {
        const data = await window.apiClient.post('/api/check-promo', {
            code: input,
            cartTotal: originalTotal
        }, { timeout: 10000, retries: 1 });

        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        const currentLang = store ? store.get('nisha_lang', 'ru') : 'ru';
        if (typeof i18next !== 'undefined' && i18next.language !== currentLang) {
            await i18next.changeLanguage(currentLang);
        }

        const savedText = typeof i18next !== 'undefined' ? i18next.t('checkout.saved') : 'Сэкономлено';
        const successText = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_success') : 'Код активирован!';
        const limitErrorText = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_limit') : 'Лимит использований исчерпан';
        const invalidErrorText = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_invalid') : 'Неверный промокод';

        if (data && data.success) {
            currentPromoDiscount = data.discount_percent;
            window.currentPromoDiscount = currentPromoDiscount;
            appliedPromoCode = input;
            window.appliedPromoCode = appliedPromoCode;
            window.currentPromoFixed = data.is_fixed ? data.saved_money : null;
            
            const discDisplay = data.is_fixed ? `-${data.saved_money} грн` : `${Math.round(data.discount_percent * 100)}%`;
            msg.innerHTML = `<span style="color: var(--accent-green);">[✔] ${successText} ${discDisplay}<br><span style="font-size: 13px;">${savedText}: <b>${data.saved_money} грн</b></span></span>`;
        } else {
            currentPromoDiscount = 0;
            window.currentPromoDiscount = 0;
            appliedPromoCode = '';
            window.appliedPromoCode = '';
            window.currentPromoFixed = null;
            
            let errorMsg = invalidErrorText;
            if (data && data.message && data.message.includes('Лимит')) {
                errorMsg = limitErrorText;
            }
            msg.innerHTML = `<span style="color: var(--accent-red);">[!] ${errorMsg}</span>`;
        }
    } catch (err) {
        if (err && (err.name === 'AbortError' || err.isTimeout)) {
            msg.innerHTML = `<span style="color: var(--accent-yellow);">[!] Сервер запускается, нажмите «Применить» ещё раз</span>`;
        } else {
            msg.innerHTML = `<span style="color: var(--accent-red);">[!] ${typeof i18next !== 'undefined' ? i18next.t('checkout.promo_error') : 'Ошибка сервера'}</span>`;
        }
    }
    
    btn.innerText = typeof i18next !== 'undefined' ? i18next.t('checkout.apply') : 'ПРИМЕНИТЬ';
    updateCartUI();
}
window.applyPromoCode = applyPromoCode;
window.openCart = function() {
    const dropdown = document.getElementById('cartDropdown');
    if (dropdown && !dropdown.classList.contains('active') && typeof toggleCartDropdown === 'function') {
        toggleCartDropdown();
    }
};

