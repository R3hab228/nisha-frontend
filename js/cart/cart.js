// ==========================================
// NISHA CART, CHECKOUT & DELIVERY MODULE
// ==========================================

// Глобальное состояние корзины
if (!window.cart) {
    try {
        window.cart = JSON.parse(localStorage.getItem('nisha_cart') || '[]');
    } catch (e) {
        window.cart = [];
    }
}
var cart = window.cart;

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

function getNPStorage(key) {
    try {
        const raw = sessionStorage.getItem('nisha_np_' + key);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

function setNPStorage(key, val) {
    try {
        sessionStorage.setItem('nisha_np_' + key, JSON.stringify(val));
    } catch(e) {}
}

let cartSwipeStartX = 0;
let cartSwipeCurrentX = 0;

// Защита от мульти-кликов (Throttle / Spam protection)
let lastCartActionTime = 0;
let isCheckoutOpening = false;
let isOrderSubmitting = false;

// Вспомогательные безопасные геттеры
function getActiveCart() {
    return window.cart || cart || [];
}

function setActiveCart(newCart) {
    window.cart = newCart;
    cart = newCart;
    localStorage.setItem('nisha_cart', JSON.stringify(newCart));
    if (!newCart || newCart.length === 0) {
        localStorage.removeItem('nisha_cart_push_sent_time');
    }
}

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

    let cartItem = { ...item };
    const hacked = window.isHacked || (typeof isHacked !== 'undefined' && isHacked);
    if (hacked) {
        cartItem.price = Math.floor(cartItem.price * 0.9);
    }
    currentCart.push(cartItem);
    setActiveCart(currentCart);
    
    if (window.ttq) {
        ttq.track('AddToCart', {
            contents: [{ content_id: cartItem.id, content_name: cartItem.name }],
            value: cartItem.price,
            currency: 'UAH'
        });
    }
    
    await syncCartToServer();
    
    localStorage.setItem('nisha_cart_time', Date.now());
    localStorage.removeItem('nisha_cart_reminded');
    updateCartUI();
    showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_add') : 'Добавлено в корзину!', 'success', getOptimizedImg(item));
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
    
    // БЕЗОПАСНАЯ ВИБРАЦИЯ
    if (typeof triggerHaptic === 'function') triggerHaptic('success');
    
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
    
    let cartItem = { ...activeItem };
    const hacked = window.isHacked || (typeof isHacked !== 'undefined' && isHacked);
    if (hacked) {
        cartItem.price = Math.floor(cartItem.price * 0.9);
    }
    currentCart.push(cartItem);
    setActiveCart(currentCart);
    await syncCartToServer();
    
    updateCartUI();
    if (typeof closeModal === 'function') closeModal('productModal');
    showToast(typeof i18next !== 'undefined' ? i18next.t('messages.cart_add') : 'Добавлено в корзину!', 'success');
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
        return; 
    }
    
    p.classList.add('show'); 
    if(fab) fab.classList.add('cart-active'); 
    
    document.getElementById('cartCount').innerText = currentCart.length;
    let total = currentCart.reduce((sum, item) => sum + (parseInt(String(item.price).replace(/[^\d]/g, ''), 10) || 0), 0);
    
    // Применяем скидку по промокоду, если она есть
    const promoDiscount = window.currentPromoDiscount || currentPromoDiscount || 0;
    const promoCode = window.appliedPromoCode || appliedPromoCode || '';
    if (promoDiscount > 0) {
        const savedMoney = Math.floor(total * promoDiscount);
        total = total - savedMoney;
        
        const msg = document.getElementById('promoMessage');
        if (msg && promoCode) {
            msg.innerHTML = `<span style="color: var(--accent-green);">[✔] Код активирован! Скидка ${promoDiscount * 100}%<br><span style="font-size: 13px;">Вы сэкономили: <b>${savedMoney} ${getCurrency()}</b></span></span>`;
        }
    }
    
    document.getElementById('cartTotal').innerText = total + ' ' + getCurrency();
    
    if (typeof renderCartItems === 'function') renderCartItems();
}
window.updateCartUI = updateCartUI;

// ==========================================
// 2. ИНТЕГРАЦИЯ НОВОЙ ПОЧТЫ (NOVA POSHTA)
// ==========================================

function debouncedNPCitySearch(query) {
    if (citySearchTimeout) clearTimeout(citySearchTimeout);
    
    document.getElementById('orderBranch').value = ''; 
    document.getElementById('orderBranch').readOnly = true;
    selectedCityRef = '';
    window.selectedCityRef = '';
    selectedBranchRef = '';
    window.selectedBranchRef = '';
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
window.debouncedNPCitySearch = debouncedNPCitySearch;

function renderCitySearchResults(data) {
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
                window.selectedCityRef = selectedCityRef;
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
        if (data.success) {
            setNPStorage(normKey, data);
        }
        renderCitySearchResults(data);
    } catch(e) { 
        console.error("Ошибка поиска города НП", e); 
        document.getElementById('cityDropdown').style.display = 'none';
        showToast(typeof i18next !== 'undefined' ? i18next.t('np.city_err') : 'Ошибка поиска города', 'error');
    }
}
window.searchNPCity = searchNPCity;

// Умный поиск отделений
function filterNPBranches(query) {
    const dropdown = document.getElementById('branchDropdown');
    
    if (query.length > 0) {
        dropdown.innerHTML = '<div style="color:#aaa; padding:12px; font-style: italic;">Шукаємо відділення в базі НП...</div>';
        dropdown.style.display = 'block';
    }

    if (branchSearchTimeout) clearTimeout(branchSearchTimeout);
    
    branchSearchTimeout = setTimeout(() => {
        loadNPBranches(query);
    }, 400);
}
window.filterNPBranches = filterNPBranches;

// Запрос отделений из базы Новой Почты (с памятью и sessionStorage)
async function loadNPBranches(searchString = "") {
    if (typeof searchString !== 'string') searchString = ""; 
    const cityRef = window.selectedCityRef || selectedCityRef;
    if (!cityRef) return;
    
    const input = document.getElementById('orderBranch');
    const dropdown = document.getElementById('branchDropdown');

    const cacheKey = cityRef + "_" + searchString.trim();
    if (npBranchCache[cacheKey]) {
        renderBranches(npBranchCache[cacheKey]); 
        return;
    }

    const sessionBranches = getNPStorage('branch_' + cacheKey);
    if (sessionBranches) {
        npBranchCache[cacheKey] = sessionBranches;
        renderBranches(sessionBranches);
        return;
    }

    try {
        const reqBody = {
            modelName: 'Address', 
            calledMethod: 'getWarehouses', 
            methodProperties: { 
                CityRef: cityRef, 
                Limit: "50" 
            } 
        };

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
            npBranchCache[cacheKey] = data.data; 
            setNPStorage('branch_' + cacheKey, data.data);
            renderBranches(data.data);
        } else {
            dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">${typeof i18next !== 'undefined' ? i18next.t('np.branch_empty') : 'Отделения не найдены'}</div>`;
            dropdown.style.display = 'block';
        }
    } catch(e) { 
        console.error("Сбой загрузки отделений НП:", e); 
        dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">${typeof i18next !== 'undefined' ? i18next.t('np.branch_err') : 'Ошибка загрузки отделений'}</div>`;
        dropdown.style.display = 'block';
    }
}
window.loadNPBranches = loadNPBranches;

// Отрисовка списка отделений
function renderBranches(branches) {
    const dropdown = document.getElementById('branchDropdown');
    dropdown.innerHTML = '';
    
    if(branches.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

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
            window.selectedBranchRef = selectedBranchRef;
            dropdown.style.display = 'none';
            calculateDeliveryCost(); 
        };
        dropdown.appendChild(div);
    }
    
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
    
    const getSafePrice = (price) => parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
    const totalCost = currentCart.reduce((sum, item) => sum + getSafePrice(item.price), 0);

    try {
        const res = await fetch('https://nisha-api.onrender.com/api/calc-delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cityRef: cityRef, cartTotal: totalCost })
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
    list.innerHTML = '';
    
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
                    <div class="cart-item-name" title="${item.name}">${item.name}</div>
                    <div class="cart-item-size">${typeof i18next !== 'undefined' ? i18next.t('grid.size_prefix') : 'Размер: '}${item.size}</div>
                    ${soldBadgeHtml}
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
window.renderCartItems = renderCartItems;

async function removeFromCart(index, event, rowElement) {
    if (event) event.stopPropagation(); 
    
    let currentCart = getActiveCart();
    const removedItem = currentCart[index];
    if (!removedItem) return;
    
    const imgUrl = getOptimizedImg(removedItem);

    const executeRemoval = async () => {
        currentCart.splice(index, 1);
        setActiveCart(currentCart);
        await syncCartToServer();
        updateCartUI(); 
        showToast(`${typeof i18next !== 'undefined' ? i18next.t('messages.cart_delete') : 'Удалено: '}${removedItem.name}`, 'error', imgUrl);
        
        if (currentCart.length === 0) {
            const dropdown = document.getElementById('cartDropdown');
            if (dropdown) dropdown.classList.remove('active');
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
    const itemIndex = parseInt(rowSurface.getAttribute('data-index'));
    
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

// Единый обработчик кликов вне выпадающих меню (города, отделения, корзина, язык)
document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#orderCity') && !e.target.closest('#cityDropdown')) {
        const cd = document.getElementById('cityDropdown');
        if (cd) cd.style.display = 'none';
    }
    if (!e.target.closest('#orderBranch') && !e.target.closest('#branchDropdown')) {
        const bd = document.getElementById('branchDropdown');
        if (bd) bd.style.display = 'none';
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
});

// ==========================================
// 4. ОФОРМЛЕНИЕ ЗАКАЗА (CHECKOUT)
// ==========================================

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
        
        document.getElementById('checkoutModal').style.display = 'flex'; 
        document.body.style.overflow = 'hidden';
        if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
        if (typeof initTurnstileWidgets === 'function') setTimeout(initTurnstileWidgets, 100);
        
        // АВТО-ЗАПОЛНЕНИЕ ДАННЫХ КЛИЕНТА
        const orderNameEl = document.getElementById('orderName');
        if (orderNameEl && !orderNameEl._lettersOnlyBound) {
            orderNameEl._lettersOnlyBound = true;
            orderNameEl.addEventListener('input', function() {
                this.value = this.value.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s\-'\u2019]/g, '');
            });
        }

        const savedDataRaw = localStorage.getItem('nisha_checkout_data');
        if (savedDataRaw) {
            try {
                const saved = JSON.parse(savedDataRaw);
                document.getElementById('orderName').value = saved.name || '';
                document.getElementById('orderPhone').value = saved.phone || '';
                document.getElementById('orderCity').value = saved.city || '';
                document.getElementById('orderBranch').value = saved.branch || '';
                
                selectedCityRef = saved.cityRef || '';
                window.selectedCityRef = selectedCityRef;
                selectedBranchRef = saved.branchRef || '';
                window.selectedBranchRef = selectedBranchRef;
                
                if (saved.phone && typeof checkPhoneAuth === 'function') checkPhoneAuth();
                
                if (selectedCityRef && selectedBranchRef && getActiveCart().length > 0) {
                    calculateDeliveryCost();
                }
            } catch(e) { autoDetectCity(); }
        } else {
            if (typeof checkPhoneAuth === 'function') checkPhoneAuth();
            autoDetectCity(); 
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
    
    const name = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(cleanLettersName) : cleanLettersName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const city = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawCity) : rawCity.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const branch = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawBranch) : rawBranch.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const phoneRaw = document.getElementById('orderPhone').value;
    const phone = normalizeOrderPhone(phoneRaw);

    if(!name || name.length < 2 || !phone || !city || !branch) { 
        showToast(typeof i18next !== 'undefined' ? i18next.t('messages.req_fields') : 'Заполните обязательные поля!', 'error'); 
        return; 
    }

    const cityRef = window.selectedCityRef || selectedCityRef;
    const branchRef = window.selectedBranchRef || selectedBranchRef;
    if (!cityRef || !branchRef) {
        showToast('Выберите Город и Отделение строго из выпадающего списка!', 'error');
        return;
    }

    const savedEmailPreference = localStorage.getItem('nisha_email_preference');
    
    if (savedEmailPreference === 'skipped') {
        return await executeOrderFinal('');
    }
    if (savedEmailPreference && savedEmailPreference.includes('@')) {
        return await executeOrderFinal(savedEmailPreference);
    }

    const user = getCurrentUser();
    if (user && user.email) {
        localStorage.setItem('nisha_email_preference', user.email);
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
    const prompt = document.getElementById('emailPromptOverlay');
    const emailInput = document.getElementById('promptEmailInput');
    let finalEmail = '';

    if (wantsEmail) {
        finalEmail = emailInput ? emailInput.value.trim() : '';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(finalEmail)) {
            showToast('Введите корректный E-mail!', 'error');
            return; 
        }
        localStorage.setItem('nisha_email_preference', finalEmail);
    } else {
        localStorage.setItem('nisha_email_preference', 'skipped');
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
    const paymentMethod = document.getElementById('orderPaymentMethod') ? document.getElementById('orderPaymentMethod').value : '';
    const nameWithPayment = paymentMethod ? name + ' [' + paymentMethod + ']' : name;

    const currentCart = getActiveCart();
    const orderItemIds = currentCart.map(i => i.id);
    const cityRef = window.selectedCityRef || selectedCityRef;
    const branchRef = window.selectedBranchRef || selectedBranchRef;

    const checkoutData = {
        name: name,
        phone: phoneRaw,
        city: city,
        branch: branch,
        cityRef: cityRef,
        branchRef: branchRef
    };
    localStorage.setItem('nisha_checkout_data', JSON.stringify(checkoutData));

    try {
        const user = getCurrentUser();
        const sb = getSupabaseClient();
        if (!sb) throw new Error('База данных недоступна');

        const { data: orderId, error: orderError } = await sb.rpc('create_secure_order', {
            p_user_id: user ? user.id : null,
            p_name: nameWithPayment,
            p_phone: phone,
            p_email: emailToSave,
            p_tg: '',
            p_city: city,
            p_branch: branch,
            p_city_ref: cityRef || '',
            p_branch_ref: branchRef || '',
            p_item_ids: orderItemIds,
            p_promocode: window.appliedPromoCode || appliedPromoCode || null
        });

        if (orderError) throw orderError; 

        if (window.ttq) {
            let totalValue = currentCart.reduce((sum, i) => sum + (i.price || 0), 0);
            ttq.track('CompletePayment', {
                contents: currentCart.map(i => ({ content_id: i.id, content_name: i.name })),
                value: totalValue,
                currency: 'UAH'
            });
        }

        localStorage.setItem('nisha_last_phone', phone);
        localStorage.setItem('nisha_last_order', Date.now());

        setActiveCart([]);
        await syncCartToServer();
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
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await res.json();

        if (data.country_code === 'UA' && data.city) {
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
                    const nomRes = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + data.latitude + '&lon=' + data.longitude + '&format=json&accept-language=uk');
                    const nomData = await nomRes.json();
                    if (nomData && nomData.address) {
                        detectedCity = nomData.address.city || nomData.address.town || nomData.address.village || detectedCity;
                    }
                } catch(e) {}
            }
            
            const npRes = await fetch('https://nisha-api.onrender.com/api/np-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    modelName: 'Address', calledMethod: 'searchSettlements', 
                    methodProperties: { CityName: detectedCity, Limit: "1" } 
                })
            });
            const npData = await npRes.json();

            if(npData.success && npData.data[0] && npData.data[0].Addresses.length > 0) {
                const cityObj = npData.data[0].Addresses[0];
                cityInput.value = cityObj.Present; 
                selectedCityRef = cityObj.DeliveryCity || cityObj.Ref; 
                window.selectedCityRef = selectedCityRef;
                
                if (branchInput) {
                    branchInput.readOnly = false;
                    branchInput.placeholder = "Выберите отделение...";
                }
                
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
    const originalTotal = currentCart.reduce((sum, item) => sum + item.price, 0);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 10000);

        const res = await fetch('https://nisha-api.onrender.com/api/check-promo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: input, cartTotal: originalTotal }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await res.json();

        const currentLang = localStorage.getItem('nisha_lang') || 'ru';
        if (typeof i18next !== 'undefined' && i18next.language !== currentLang) {
            await i18next.changeLanguage(currentLang);
        }

        const savedText = typeof i18next !== 'undefined' ? i18next.t('checkout.saved') : 'Сэкономлено';
        const successText = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_success') : 'Код активирован!';
        const limitErrorText = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_limit') : 'Лимит использований исчерпан';
        const invalidErrorText = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_invalid') : 'Неверный промокод';
        const serverErrorText = typeof i18next !== 'undefined' ? i18next.t('checkout.promo_error') : 'Ошибка промокода';

        if (data.success) {
            currentPromoDiscount = data.discount_percent;
            window.currentPromoDiscount = currentPromoDiscount;
            appliedPromoCode = input;
            window.appliedPromoCode = appliedPromoCode;
            
            msg.innerHTML = `<span style="color: var(--accent-green);">[✔] ${successText} ${data.discount_percent * 100}%<br><span style="font-size: 13px;">${savedText}: <b>${data.saved_money} грн</b></span></span>`;
        } else {
            currentPromoDiscount = 0;
            window.currentPromoDiscount = 0;
            appliedPromoCode = '';
            window.appliedPromoCode = '';
            
            let errorMsg = invalidErrorText;
            if (data.message && data.message.includes('Лимит')) {
                errorMsg = limitErrorText;
            }
            msg.innerHTML = `<span style="color: var(--accent-red);">[!] ${errorMsg}</span>`;
        }
    } catch (err) {
        if (err && err.name === 'AbortError') {
            msg.innerHTML = `<span style="color: var(--accent-yellow);">[!] Сервер запускается, нажмите «Применить» ещё раз</span>`;
        } else {
            msg.innerHTML = `<span style="color: var(--accent-red);">[!] ${typeof i18next !== 'undefined' ? i18next.t('checkout.promo_error') : 'Ошибка сервера'}</span>`;
        }
    }
    
    btn.innerText = typeof i18next !== 'undefined' ? i18next.t('checkout.apply') : 'ПРИМЕНИТЬ';
    updateCartUI();
}
window.applyPromoCode = applyPromoCode;
