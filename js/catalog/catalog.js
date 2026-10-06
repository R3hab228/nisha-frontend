// ==========================================
// NISHA CATALOG & FILTERS MODULE
// ==========================================

// Инициализация глобального состояния каталога
if (!window.allItems) window.allItems = [];
if (!window.filteredItems) window.filteredItems = [];
window.renderedCount = 0;
window.currentPage = 1;
window.currentCategory = '';
window.currentBrand = '';
window.showingOnlyFavs = false;

let itemsPageSize = window.innerWidth <= 900 ? 12 : 15;
let applyFiltersTimeout = null;
let changePageTimeout = null;
let priceTimeout = null;

// Запрещаем браузеру восстанавливать скролл при перезагрузке страницы
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Глобальный перехватчик URL для CDN
window.toCDN = function(url) {
    if (typeof url === 'string' && url.includes('nmpuefxqtkhvtltdvllz.supabase.co')) {
        return url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://nisha-cdn.mtyagniryadno.workers.dev');
    }
    return url || '';
};

// Оптимизированный URL картинки (превью / оригинал)
function getOptimizedImageUrl(item, wantsThumb = false) {
    if (!item || typeof item !== 'object') return '';
    const isValid = (url) => typeof url === 'string' && url.trim().length > 10;

    let resultUrl = '';

    if (wantsThumb && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
        if (isValid(item.thumbnails[0])) resultUrl = item.thumbnails[0];
    }

    if (!resultUrl && Array.isArray(item.images) && item.images.length > 0) {
        if (isValid(item.images[0])) resultUrl = item.images[0];
    }

    return window.toCDN(resultUrl);
}
window.getOptimizedImageUrl = getOptimizedImageUrl;

// ОПТИМИЗАЦИЯ PREFETCH: предзагрузка картинок высокого качества в память браузера
window.prefetchItemImages = function(id) {
    if (!window._prefetchedItems) window._prefetchedItems = new Set();
    if (window._prefetchedItems.has(id)) return;
    
    window._prefetchedItems.add(id);
    const item = window.allItems.find(i => i.id === id);
    if (item && item.images) {
        item.images.slice(0, 2).forEach(url => {
            const img = new Image();
            img.src = window.toCDN ? window.toCDN(url) : url;
        });
    }
};

// Загрузка всех товаров из БД и кэша
async function loadAllItems() {
    const grid = document.getElementById('itemsGrid');
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    
    // 1. МГНОВЕННАЯ ЗАГРУЗКА (Из кэша)
    const cachedData = localStorage.getItem('nisha_cached_db');
    if (cachedData && window.allItems.length === 0) {
        try {
            window.allItems = JSON.parse(cachedData);
            applyFilters(); 
        } catch(e) { console.error("Ошибка кэша"); }
    }

    if (!sb) return;

    // 2. ФОНОВЫЙ ЗАПРОС К БД (Снимаем лимит, берем 1000 товаров)
    const { data, error } = await sb.from('items')
        .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, is_drop')
        .limit(1000)
        .order('created_at', { ascending: false });
    
    if (error) { 
        if (window.allItems.length === 0 && grid) grid.innerHTML = `<div style="color:red; padding:20px; grid-column: 1/-1;">[ ОШИБКА БД: ${error.message} ]</div>`;
        return; 
    }
    
    // Сравниваем изменения
    const isChanged = (JSON.stringify(data) !== JSON.stringify(window.allItems)) || (data.length !== window.allItems.length);
    window.allItems = data; 
    localStorage.setItem('nisha_cached_db', JSON.stringify(data)); 
    
    // 3. ИСТОРИЯ ПРОСМОТРОВ
    const profile = (typeof userProfile !== 'undefined') ? userProfile : (window.userProfile || null);
    if (profile && profile.viewed_history && profile.viewed_history.length > 0) {
        let dbHistory = [];
        profile.viewed_history.forEach(uuid => {
            const histItem = window.allItems.find(i => i.id === uuid);
            if (histItem) {
                const img = (histItem.images && histItem.images.length > 0) ? histItem.images[0] : '';
                dbHistory.push({ id: histItem.id, name: histItem.name, price: histItem.price, img: img });
            }
        });
        localStorage.setItem('nisha_history', JSON.stringify(dbHistory));
        if (typeof renderHistory === 'function') renderHistory();
    }

    // 4. СИНХРОНИЗАЦИЯ КОРЗИНЫ
    let userCart = (typeof cart !== 'undefined') ? cart : (window.cart || JSON.parse(localStorage.getItem('nisha_cart') || '[]'));
    const validCart = userCart.filter(cItem => window.allItems.some(dbItem => dbItem.id === cItem.id));
    if (validCart.length !== userCart.length) {
        if (typeof cart !== 'undefined') cart = validCart;
        window.cart = validCart;
        localStorage.setItem('nisha_cart', JSON.stringify(validCart));
        if (typeof updateCartUI === 'function') updateCartUI();
    }

    // 5. ПЕРЕРИСОВКА (Если данные реально обновились)
    if (!cachedData || isChanged) {
        applyFilters(); 
    }
    
    // 6. ФОНОВАЯ ПРОВЕРКА (Обход кеша CDN) - актуальные статусы TOP/SOLD
    syncCriticalStatuses();
}
window.loadAllItems = loadAllItems;

// СИНХРОНИЗАЦИЯ КРИТИЧЕСКИХ СТАТУСОВ (TOP, RESERVED, SOLD) в обход CDN
async function syncCriticalStatuses() {
    const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!sb) return;
    try {
        const { data } = await sb.from('items').select('id, is_top, top_until, status');
        
        if (data) {
            let changed = false;
            
            // 1. Очистка от удаленных из БД товаров
            const validIds = new Set(data.map(d => d.id));
            const originalLength = window.allItems.length;
            window.allItems = window.allItems.filter(i => validIds.has(i.id));
            if (window.allItems.length !== originalLength) changed = true;
            
            // 2. Синхронизация статусов
            const dataMap = new Map();
            data.forEach(d => dataMap.set(d.id, d));
            
            window.allItems.forEach(old => {
                const fresh = dataMap.get(old.id);
                if (fresh) {
                    if (old.is_top !== fresh.is_top || old.top_until !== fresh.top_until || old.status !== fresh.status) {
                        old.is_top = fresh.is_top;
                        old.top_until = fresh.top_until;
                        old.status = fresh.status;
                        changed = true;
                    }
                }
            });

            // 3. Подгрузка самых свежих товаров
            const { data: latestItems } = await sb.from('items')
                .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, is_drop')
                .order('created_at', { ascending: false })
                .limit(5);

            if (latestItems) {
                let latestAdded = false;
                latestItems.forEach(newItem => {
                    if (!window.allItems.find(i => i.id === newItem.id)) {
                        window.allItems.unshift(newItem);
                        latestAdded = true;
                        changed = true;
                    }
                });
                if (latestAdded) {
                    window.allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                }
            }
            
            if (changed) applyFilters();
        }
    } catch(e) { console.error("Sync error:", e); }
}
window.syncCriticalStatuses = syncCriticalStatuses;

// Умное соответствие размеров (обувь и одежда)
function itemMatchesSizeFilter(itemOrSize, filterVal) {
    if (!itemOrSize || !filterVal) return false;
    let sizeStr = '';
    let category = '';
    if (typeof itemOrSize === 'object') {
        sizeStr = itemOrSize.size ? String(itemOrSize.size).trim() : '';
        category = itemOrSize.category ? String(itemOrSize.category).trim() : '';
    } else {
        sizeStr = String(itemOrSize).trim();
    }
    if (!sizeStr) return false;
    const upperSize = sizeStr.toUpperCase();
    const fVal = String(filterVal).trim().toUpperCase();

    // 1. Обувь (40 - 42) и Обувь (43 - 46)
    const isShoesFilter1 = (fVal === '42' || fVal === '40-42' || fVal === '40 - 42');
    const isShoesFilter2 = (fVal === '44' || fVal === '43-46' || fVal === '43 - 46');

    if (isShoesFilter1 || isShoesFilter2) {
        if (category && category !== 'Обувь') return false;

        if (isShoesFilter1) {
            if (upperSize.includes('40 - 42') || upperSize.includes('40-42')) return true;
            const numMatch = upperSize.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
                const n = parseFloat(numMatch[1].replace(',', '.'));
                if (n >= 35 && n <= 42.5) return true;
            }
            return false;
        }

        if (isShoesFilter2) {
            if (upperSize.includes('43 - 46') || upperSize.includes('43-46')) return true;
            const numMatch = upperSize.match(/(\d+(?:[.,]\d+)?)/);
            if (numMatch) {
                const n = parseFloat(numMatch[1].replace(',', '.'));
                if (n >= 42.8 && n <= 50) return true;
            }
            return false;
        }
    }

    if (category === 'Обувь') {
        return false;
    }

    // 2. Размер S
    if (fVal === 'S') {
        return (upperSize === 'S' || upperSize === 'XS' || upperSize === 'С' ||
            upperSize.startsWith('S-') || upperSize.startsWith('S -') || 
            upperSize.startsWith('S/') || upperSize.startsWith('S ') || 
            upperSize.startsWith('S(') || upperSize.includes('(S)') ||
            upperSize.includes('S M L'));
    }

    // 3. Размер M
    if (fVal === 'M') {
        return (upperSize === 'M' || upperSize === 'М' || 
            upperSize.startsWith('M-') || upperSize.startsWith('M -') || 
            upperSize.startsWith('M/') || upperSize.startsWith('M ') || 
            upperSize.startsWith('M(') || upperSize.startsWith('М ') || 
            upperSize.startsWith('М(') || upperSize.includes('S M L'));
    }

    // 4. Размер L
    if (fVal === 'L') {
        if (upperSize.includes('XL') || upperSize.includes('ХЛ') || 
            upperSize.includes('XXL') || upperSize.includes('ХХЛ')) {
            return false;
        }
        return (upperSize === 'L' || upperSize === 'Л' || 
            upperSize.startsWith('L ') || upperSize.startsWith('L(') || 
            upperSize.startsWith('Л ') || upperSize.startsWith('Л(') ||
            upperSize.includes('S M L'));
    }

    // 5. Размер XL / XXL
    if (fVal === 'XL' || fVal === 'XL / XXL') {
        return (upperSize.includes('XL') || upperSize.includes('XXL') || 
            upperSize.includes('ХЛ') || upperSize.includes('ХХЛ') || 
            upperSize.includes('3XL') || upperSize.includes('XXXL'));
    }

    return upperSize === fVal;
}
window.itemMatchesSizeFilter = itemMatchesSizeFilter;

// Обновление красных счетчиков категорий и размеров в боковом меню
function updateSidebarCounters() {
    const curCat = window.currentCategory || '';
    const availableItemsAll = window.allItems.filter(i => i.status === 'available');
    const catCounts = { 'Все вещи': availableItemsAll.length };
    
    availableItemsAll.forEach(item => {
        if (!item) return;
        const c = item.category || 'Без категории';
        catCounts[c] = (catCounts[c] || 0) + 1;
    });

    // 1. Категории
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(link => {
        let baseText = link.innerHTML.split('<span')[0].trim();
        let catName = '';
        if (baseText.includes('Все вещи')) catName = 'Все вещи';
        else if (baseText.includes('Верхняя одежда')) catName = 'Верхняя одежда';
        else if (baseText.includes('Кофты и Свитера')) catName = 'Кофты и Свитера';
        else if (baseText.includes('Штаны и Джинсы')) catName = 'Штаны и Джинсы';
        else if (baseText.includes('Обувь')) catName = 'Обувь';
        else if (baseText.includes('Аксессуары')) catName = 'Аксессуары';

        const count = catCounts[catName] || 0;
        if (count > 0) {
            link.innerHTML = `${baseText} <span style="color:#ff3333; font-weight:bold; font-family:var(--font-mono); font-size:11px;">(${count})</span>`;
        } else {
            link.innerHTML = baseText;
        }

        link.classList.remove('active-filter');
        if (curCat !== '' && catName === curCat) {
            link.classList.add('active-filter');
        } else if (curCat === '' && catName === 'Все вещи') {
            link.classList.add('active-filter');
        }
    });

    // 2. Размеры (только для текущей категории)
    const availableCategoryItems = window.allItems.filter(item => {
        if (!item || item.status !== 'available') return false;
        if (curCat !== '' && item.category !== curCat) return false;
        return true;
    });

    document.querySelectorAll('.size-cb').forEach(cb => {
        const labelSpan = cb.nextElementSibling;
        let baseText = labelSpan.innerHTML.split('<span')[0].trim();
        const sizeVal = cb.value;
        const count = availableCategoryItems.filter(item => itemMatchesSizeFilter(item, sizeVal)).length;

        if (count > 0) {
            labelSpan.innerHTML = `${baseText} <span style="color:#ff3333; font-weight:bold; font-family:var(--font-mono); font-size:11px;">(${count})</span>`;
            cb.parentElement.style.opacity = '1';
            cb.disabled = false;
        } else {
            labelSpan.innerHTML = baseText;
            cb.parentElement.style.opacity = '0.4';
            cb.disabled = true;
            cb.checked = false;
        }
    });
}
window.updateSidebarCounters = updateSidebarCounters;

// Основная функция фильтрации каталога
function applyFilters() {
    const grid = document.getElementById('itemsGrid');
    if (grid) grid.classList.add('fade-out');

    clearTimeout(applyFiltersTimeout);
    applyFiltersTimeout = setTimeout(() => {
        try {
            const searchInput = document.getElementById('mainSearch');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const checkedSizes = Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => cb.value);
            const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
            
            const minInput = document.getElementById('priceMin');
            const maxInput = document.getElementById('priceMax');
            const minPrice = minInput ? parseInt(minInput.value) : 0;
            const maxPrice = maxInput ? parseInt(maxInput.value) : 15000;

            const getSafePrice = (price) => parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
            const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
            const hacked = (typeof isHacked !== 'undefined') ? isHacked : (window.isHacked || false);
            const curCat = window.currentCategory || '';
            const curBrand = window.currentBrand || '';
            const onlyFavs = window.showingOnlyFavs || false;

            // 1. Фильтрация
            window.filteredItems = window.allItems.filter(item => {
                if (!item) return false;
                
                const isFav = userFavs.includes(item.id);
                const matchesAvailability = !hideUnavailable || item.status === 'available';
                
                if (onlyFavs) {
                    return isFav && matchesAvailability;
                }

                const itemCategory = item.category || '';
                const itemBrand = item.brand ? item.brand.toLowerCase() : '';
                const searchBrand = curBrand ? curBrand.toLowerCase() : '';
                
                const matchesCategory = curCat === '' || itemCategory === curCat;
                const matchesBrand = searchBrand === '' || itemBrand.includes(searchBrand);
                const matchesSize = checkedSizes.length === 0 || checkedSizes.some(sz => itemMatchesSizeFilter(item, sz));
                
                const itemFinalPrice = hacked ? Math.floor(getSafePrice(item.price) * 0.9) : getSafePrice(item.price);
                const matchesPrice = itemFinalPrice >= minPrice && itemFinalPrice <= maxPrice;
                
                return matchesCategory && matchesBrand && matchesSize && matchesPrice && matchesAvailability;
            });

            // 2. Умный поиск Fuse.js
            if (searchTerm !== '' && typeof Fuse !== 'undefined' && !onlyFavs && curCat === '') {
                const cleanSearchTerm = searchTerm.replace(/#/g, '').trim();
                const fuseOptions = {
                    includeScore: true, threshold: 0.4, ignoreLocation: true, useExtendedSearch: true, 
                    keys: [{ name: 'tags', weight: 1.0 }, { name: 'brand', weight: 0.8 }, { name: 'name', weight: 0.8 }, { name: 'size', weight: 0.8 }, { name: 'category', weight: 0.2 }]
                };
                const fuse = new Fuse(window.filteredItems, fuseOptions);
                window.filteredItems = fuse.search(cleanSearchTerm).map(result => result.item);
            }

            // 3. Сортировка
            const now = Date.now();
            const isItemTop = (item) => item.is_top === true && item.top_until && new Date(item.top_until).getTime() > now;
            const sortCheap = document.getElementById('sort-cheap');

            if (sortCheap && sortCheap.classList.contains('active-sort')) {
                window.filteredItems.sort((a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return getSafePrice(a.price) - getSafePrice(b.price);
                });
            } else {
                window.filteredItems.sort((a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                });
            }
            
            // СБРОС И РЕНДЕР
            if (grid) grid.innerHTML = ''; 
            window.renderedCount = 0; 
            window.currentPage = 1; 
            
            const scrollTrigger = document.getElementById('loadingTrigger');
            if (scrollTrigger && window.innerWidth <= 900) {
                scrollTrigger.style.display = 'block';
                scrollTrigger.innerHTML = '';
            }
            
            const countEl = document.getElementById('itemCount');
            if (countEl) {
                countEl.innerText = window.filteredItems.length;
            }

            if (window.filteredItems.length === 0) {
                if (grid) grid.innerHTML = `<div style="color: #666; font-family: monospace; padding: 30px; grid-column: 1/-1; text-align:center;">[ ТОВАРОВ НЕ НАЙДЕНО ]</div>`;
            } else {
                renderNextBatch(); 
            }

            // Обновляем URL параметры
            const url = new URL(window.location);
            if (curCat) url.searchParams.set('cat', curCat); else url.searchParams.delete('cat');
            if (searchTerm) url.searchParams.set('q', searchTerm); else url.searchParams.delete('q');
            window.history.replaceState(null, '', url);

            // Подсветка активной категории
            const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
            catLinks.forEach(el => el.classList.remove('active-filter'));
            
            if (curCat) {
                catLinks.forEach(link => {
                    const onclickText = link.getAttribute('onclick') || '';
                    if (onclickText.includes(`'${curCat}'`)) {
                        link.classList.add('active-filter');
                    }
                });
            } else {
                const firstLink = document.querySelector('.sidebar .filter-list:first-of-type a');
                if (firstLink) firstLink.classList.add('active-filter');
            }

            updateSidebarCounters();
            
            if (grid) {
                requestAnimationFrame(() => {
                    setTimeout(() => grid.classList.remove('fade-out'), 50);
                });
            }
        } catch (err) {
            console.error("ОШИБКА ФИЛЬТРАЦИИ:", err);
            if (grid) {
                grid.innerHTML = `<div style="color:red; grid-column:1/-1; padding:20px; text-align:center;">[ ОШИБКА РЕНДЕРА: ${err.message} ]</div>`;
                grid.classList.remove('fade-out');
            }
        }
    }, 300); 
}
window.applyFilters = applyFilters;

// Умный плеер для видео в сетке (IntersectionObserver)
const gridVideoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
            video.play().catch(() => {}); 
        } else {
            video.pause(); 
        }
    });
}, { rootMargin: "50px" });
window.gridVideoObserver = gridVideoObserver;

// Пагинация на ПК
window.changePage = function(step) {
    window.currentPage += step;
    const grid = document.getElementById('itemsGrid');
    
    if (grid) {
        grid.classList.add('fade-out');
    }

    clearTimeout(changePageTimeout);
    changePageTimeout = setTimeout(() => {
        renderNextBatch(); 
        
        const sortingEl = document.querySelector('.sorting');
        if (sortingEl) {
            const y = sortingEl.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
        
        if (grid) {
            requestAnimationFrame(() => {
                grid.classList.remove('fade-out');
            });
        }
    }, 300);
};

// Рендер следующей пачки товаров
function renderNextBatch() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;
    
    const isMobile = window.innerWidth <= 900;
    
    let oldPagination = document.getElementById('mainPagination');
    if (oldPagination) oldPagination.remove();

    let startIndex = 0;
    let endIndex = 0;
    const BATCH_SIZE = isMobile ? 12 : 15;
    itemsPageSize = BATCH_SIZE;

    if (isMobile) {
        if (window.renderedCount === 0) grid.innerHTML = ''; 
        startIndex = window.renderedCount;
        endIndex = Math.min(startIndex + BATCH_SIZE, window.filteredItems.length); 
    } else {
        grid.innerHTML = ''; 
        startIndex = (window.currentPage - 1) * BATCH_SIZE; 
        endIndex = Math.min(startIndex + BATCH_SIZE, window.filteredItems.length);
    }
    
    if (startIndex >= endIndex) return;
    
    let seenItemsIds = [];
    try {
        seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items')) || [];
        if (!Array.isArray(seenItemsIds)) seenItemsIds = [];
    } catch(e) { seenItemsIds = []; }
    
    const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
    const curr = (typeof getCurrency === 'function') ? getCurrency() : 'грн';

    for (let i = startIndex; i < endIndex; i++) {
        try {
            const item = window.filteredItems[i];
            if (!item) continue;
            
            let badgeHTML = '';
            if (item.status === 'sold') {
                badgeHTML = '<div class="sold-badge">SOLD</div>';
            } else if (item.status === 'reserved') {
                badgeHTML = '<div class="reserved-badge">RESERVED</div>';
            } else {
                const hasSale = item.is_sale;
                const hasHot = (item.views_count || 0) >= 25;
                const isTop = item.is_top === true && item.top_until && new Date(item.top_until).getTime() > Date.now();

                if (hasSale || hasHot || isTop) {
                    badgeHTML = `<div class="system-status-bar">`;
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
                }
            }

            const thumbsArray = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails : (item.images && item.images.length > 0 ? item.images : []);
            let slidesStr = '';
            let dotsStr = '';

            const loadAttr = (i < 4) ? 'fetchpriority="high"' : 'loading="lazy"';

            thumbsArray.forEach((thumbUrl, idx) => {
                const rawVidUrl = item.images && item.images[idx] ? item.images[idx] : '';
                const isVid = typeof rawVidUrl === 'string' && rawVidUrl.endsWith('.mp4');
                
                const cdnThumb = window.toCDN(thumbUrl);
                const cdnVidUrl = window.toCDN(rawVidUrl);

                if (isVid) {
                    slidesStr += `
                        <div class="card-slide img-8bit-loading" style="background: #0a0a0a;">
                            <video class="grid-lazy-video" src="${cdnVidUrl}#t=0.001" muted loop playsinline preload="metadata" style="width:100%; height:100%; object-fit:cover; pointer-events:none; opacity:0;" oncanplay="this.style.opacity='1'; this.parentElement.classList.remove('img-8bit-loading'); this.parentElement.classList.add('img-8bit-loaded');"></video>
                        </div>`;
                } else {
                    slidesStr += `
                        <div class="card-slide img-8bit-loading" style="background-image: none;">
                           <img src="${cdnThumb}" ${loadAttr} style="position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none;" 
onload="this.parentElement.style.backgroundImage='url(\\''+this.src+'\\')'; this.parentElement.classList.remove('img-8bit-loading'); this.parentElement.classList.add('img-8bit-loaded');" 
onerror="this.parentElement.classList.remove('img-8bit-loading'); this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:red;font-size:10px;font-family:monospace;\\'>NO SIGNAL</div>';">
                        </div>`;
                }
                dotsStr += `<div class="card-dot ${idx === 0 ? 'active' : ''}"></div>`;
            });

            const starClass = userFavs.includes(item.id) ? 'fav-star active' : 'fav-star';
            const isUnseen = !seenItemsIds.includes(item.id) && item.status === 'available';
            const pulseClass = isUnseen ? 'unseen-pulse' : '';

            const card = document.createElement('div');
            card.className = `item-card ${item.status !== 'available' ? 'sold-out' : ''} ${pulseClass}`;
            card.setAttribute('data-id', item.id);
            
            card.setAttribute('onmouseenter', `window.prefetchItemImages('${item.id}')`);
            card.setAttribute('ontouchstart', `window.prefetchItemImages('${item.id}')`);
            
            let priceHTML = '';
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

            const sizePrefix = (typeof i18next !== 'undefined') ? i18next.t('grid.size_prefix', { defaultValue: 'Размер: ' }) : 'Размер: ';
            const addToCartText = (typeof i18next !== 'undefined') ? i18next.t('product.add_to_cart', { defaultValue: 'В КОРЗИНУ' }) : 'В КОРЗИНУ';

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
                    <div class="item-size"><span data-i18n="grid.size_prefix">${sizePrefix}</span>${item.size}</div>
                    <div class="item-footer"><span>${item.brand}</span><span>${item.condition}</span></div>
                </div>
                <button class="grid-cart-btn" data-i18n="product.add_to_cart" style="${item.status === 'sold' ? 'display:none;' : ''}" onclick="addToCartWithAnimation('${item.id}', this, event)">${addToCartText}</button>
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
            
            let clickTimer = null;
            
            sliderWrapper.addEventListener('touchstart', () => {
                if(!isDraggingSlider) sliderWrapper.style.transform = 'scale(0.98)';
            }, {passive: true});
            
            sliderWrapper.addEventListener('touchend', () => {
                sliderWrapper.style.transform = 'scale(1)';
            }, {passive: true});

            sliderWrapper.addEventListener('click', (e) => {
                if (isDraggingSlider) { e.preventDefault(); e.stopPropagation(); return; } 
                
                if (clickTimer === null) {
                    clickTimer = setTimeout(() => {
                        clickTimer = null;
                        if (typeof openProductModalById === 'function') openProductModalById(item.id); 
                    }, 180);
                } else {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                    handleDoubleTapLike(e, item.id, sliderWrapper); 
                }
            });

            grid.appendChild(card);
            const vids = card.querySelectorAll('.grid-lazy-video');
            vids.forEach(v => gridVideoObserver.observe(v));

        } catch (err) { console.error(err); }
    }

    if (isMobile) {
        window.renderedCount = endIndex;
        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) {
            if (window.renderedCount >= window.filteredItems.length) {
                scrollTrigger.style.display = 'none';
            } else {
                scrollTrigger.innerHTML = '';
            }
        }
    } else {
        window.renderedCount = window.filteredItems.length; 
        
        const totalPages = Math.ceil(window.filteredItems.length / itemsPageSize);
        if (totalPages >= 1) {
            const paginationWrap = document.createElement('div');
            paginationWrap.id = 'mainPagination';
            paginationWrap.className = 'pagination-wrapper';
            paginationWrap.style.position = 'relative';
            paginationWrap.style.width = '100%';
            paginationWrap.style.marginTop = '40px';
            paginationWrap.style.display = 'flex';
            paginationWrap.style.justifyContent = 'center';
            paginationWrap.style.gridColumn = '1 / -1'; 
            
            const prevDisabled = window.currentPage === 1 ? 'disabled' : '';
            const nextDisabled = window.currentPage === totalPages ? 'disabled' : '';

            paginationWrap.innerHTML = `
                <button class="page-arrow" onclick="changePage(-1)" ${prevDisabled}>&#10094;</button>
                <div class="page-numbers">[ СТРАНИЦА <span style="color:var(--accent-green); font-weight:bold;">${window.currentPage}</span> ИЗ ${totalPages} ]</div>
                <button class="page-arrow" onclick="changePage(1)" ${nextDisabled}>&#10095;</button>
            `;
            
            grid.style.paddingBottom = '0px';
            grid.appendChild(paginationWrap);
        }
    }
}
window.renderNextBatch = renderNextBatch;

// Сортировка товаров
function sortItems(type) {
    const sortNew = document.getElementById('sort-new');
    const sortCheap = document.getElementById('sort-cheap');
    if (sortNew) sortNew.classList.remove('active-sort');
    if (sortCheap) sortCheap.classList.remove('active-sort');
    
    const targetSort = document.getElementById('sort-' + type);
    if (targetSort) targetSort.classList.add('active-sort');
    
    const countEl = document.getElementById('itemCount');
    if (countEl) {
        countEl.style.transition = '0.3s';
        countEl.style.opacity = '0.2';
        countEl.style.color = 'var(--accent-yellow)';
        setTimeout(() => { 
            countEl.style.opacity = '1'; 
            countEl.style.color = 'var(--accent-green)';
        }, 300);
    }
    
    applyFilters();
    
    setTimeout(() => {
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            const y = grid.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, 100);
}
window.sortItems = sortItems;

// Установка фильтра категории
function setCategoryFilter(cat, element) { 
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(el => el.classList.remove('active-filter'));
    if (element) {
        element.classList.add('active-filter');
    }
    window.currentCategory = cat; 
    sessionStorage.setItem('nisha_last_category', cat);
    applyFilters(); 
}
window.setCategoryFilter = setCategoryFilter;

// Очистка поиска крестиком
function clearSearchInput() {
    const input = document.getElementById('mainSearch');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    const liveDropdown = document.getElementById('liveSearchDropdown');
    if (liveDropdown) liveDropdown.style.display = 'none';
    document.body.classList.remove('search-lock'); 
    if (typeof window.startLenis === 'function') window.startLenis();
    applyFilters();
}
window.clearSearchInput = clearSearchInput;

// UI ценового диапазона
function updatePriceUI() {
    let minInput = document.getElementById('priceMin');
    let maxInput = document.getElementById('priceMax');
    if (!minInput || !maxInput) return;
    let minVal = parseInt(minInput.value);
    let maxVal = parseInt(maxInput.value);

    if (minVal >= maxVal) {
        if (window.event && window.event.target && window.event.target.id === 'priceMin') { 
            minInput.value = maxVal - 100; 
            minVal = maxVal - 100; 
        } else { 
            maxInput.value = minVal + 100; 
            maxVal = minVal + 100; 
        }
    }

    const minLabel = document.getElementById('priceMinVal');
    const maxLabel = document.getElementById('priceMaxVal');
    if (minLabel) minLabel.innerText = minVal;
    if (maxLabel) maxLabel.innerText = maxVal;

    const percentMin = (minVal / 15000) * 100;
    const percentMax = (maxVal / 15000) * 100;
    const rangeFill = document.getElementById('rangeFill');
    if (rangeFill) {
        rangeFill.style.left = percentMin + '%';
        rangeFill.style.right = (100 - percentMax) + '%';
    }

    clearTimeout(priceTimeout);
    priceTimeout = setTimeout(() => { applyFilters(); }, 300);
}
window.updatePriceUI = updatePriceUI;

// Переключение мобильного бокового меню фильтров
function toggleMobileSidebar() {
    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    const sidebar = document.querySelector('.sidebar');
    const btn = document.getElementById('mobileFilterBtn');
    const fab = document.querySelector('.fab-propose'); 
    if (!sidebar || !btn) return;
    
    sidebar.classList.toggle('active-mobile');
    
    const hideText = (typeof i18next !== 'undefined') ? i18next.t('mobile.hide_filters', { defaultValue: '[-] СКРЫТЬ ФИЛЬТРЫ' }) : '[-] СКРЫТЬ ФИЛЬТРЫ';
    const showText = (typeof i18next !== 'undefined') ? i18next.t('mobile.show_filters', { defaultValue: '[+] ПОКАЗАТЬ ФИЛЬТРЫ' }) : '[+] ПОКАЗАТЬ ФИЛЬТРЫ';

    if (sidebar.classList.contains('active-mobile')) {
        btn.innerText = hideText;
        btn.style.borderColor = 'var(--accent-red)';
        btn.style.color = 'var(--accent-red)';
        btn.style.background = '#111'; 
        if (fab) fab.style.display = 'none';
    } else {
        btn.innerText = showText;
        btn.style.borderColor = '#444';
        btn.style.color = 'var(--accent-green)';
        btn.style.background = '#050505'; 
        if (fab) fab.style.display = 'flex';
    }
}
window.toggleMobileSidebar = toggleMobileSidebar;

// Логика слайдера фото в карточке товара на ПК/моб
window.updateCardDots = function(container, itemId) {
    if (!container) return;
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

window.scrollGridSlider = function(event, itemId, direction) {
    if (event) event.stopPropagation();
    const slider = document.getElementById(`slider-${itemId}`);
    if (!slider) return;
    const slideWidth = slider.offsetWidth;
    slider.scrollBy({ left: slideWidth * direction, behavior: 'smooth' });
};

// Двойной тап для лайка
window.handleDoubleTapLike = async function(event, itemId, container) {
    if (typeof triggerVibration === 'function') triggerVibration(150);
    if (event) { event.preventDefault(); event.stopPropagation(); }

    if (container) {
        const star = document.createElement('div');
        star.className = 'double-tap-star-anim';
        star.innerText = '★'; 
        container.appendChild(star);
        setTimeout(() => star.remove(), 800);
    }
    
    if (typeof triggerHaptic === 'function') triggerHaptic('heavy');

    const userFavs = (typeof favorites !== 'undefined') ? favorites : (window.favorites || []);
    if (!userFavs.includes(itemId)) {
        if (typeof toggleFav === 'function') {
            await toggleFav(null, itemId);
        }
    }
};

// Информационные окна для бейджей товаров
window.showBadgeInfo = function(type) {
    let title = '';
    let text = '';
    const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);

    if (type === 'secure') {
        title = 'SECURE_PAYMENT.EXE';
        const isReturnable = activeItem && activeItem.is_returnable === true;
        const isDropItem = activeItem && (activeItem.is_drop === true || (activeItem.tags && activeItem.tags.map(t => t.toLowerCase()).includes('drop')));

        if (!isReturnable || isDropItem) {
            text = 'NISHA выступает гарантом сделки. Ваши деньги надежно защищены.<br><br>Данная вещь продается <b style="color:var(--accent-red);">без права на возврат или обмен ни при каких условиях</b>.<br><br>Мы настоятельно просим вас внимательно изучать фото, замеры и описание перед оформлением заказа.';
        } else {
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
    
    if (typeof showTerminalModal === 'function') {
        showTerminalModal(title, text, '[ ПОНЯТНО ]', null);
    }
};

// Тур онбординга
function startOnboardingTour() {
    if (!localStorage.getItem('nisha_rules_accepted') || 
        localStorage.getItem('nisha_tour_done') || 
        typeof window.driver === 'undefined') return;

    const checkAndRun = setInterval(() => {
        const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some(el => {
            return window.getComputedStyle(el).display === 'flex';
        });
        
        const toastContainer = document.getElementById('toastContainer');
        const anyToastVisible = toastContainer && toastContainer.children.length > 0;

        if (anyModalOpen || anyToastVisible) return;

        clearInterval(checkAndRun);
        const isMobile = window.innerWidth <= 900;
        const firstStar = document.querySelector('.item-card .fav-star');
        const firstCartBtn = document.querySelector('.item-card .grid-cart-btn');

        let activeSteps = [];
        activeSteps.push({ element: '.search-wrapper', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.search_title') : 'ПОИСК', description: typeof i18next !== 'undefined' ? i18next.t('tour.search_desc') : 'Поиск по вещам' } });

        if (isMobile) {
            activeSteps.push(
                { element: '.mobile-profile-link', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prof_title') : 'ПРОФИЛЬ', description: typeof i18next !== 'undefined' ? i18next.t('tour.prof_desc') : 'Личный кабинет' } },
                { element: '#mobileFilterBtn', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.filt_title') : 'ФИЛЬТРЫ', description: typeof i18next !== 'undefined' ? i18next.t('tour.filt_desc') : 'Фильтры каталога' } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.star_title') : 'ИЗБРАННОЕ', description: typeof i18next !== 'undefined' ? i18next.t('tour.star_desc') : 'Сохраняйте вещи' } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_title') : 'КОРЗИНА', description: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_desc') : 'Добавление в заказ' } });
            activeSteps.push({ element: '.fab-propose', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prop_title') : 'ПРЕДЛОЖКА', description: typeof i18next !== 'undefined' ? i18next.t('tour.prop_desc') : 'Продать свою вещь' } });
            activeSteps.push({ element: '#cartInfoWrapper', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.cart_title') : 'КОРЗИНА', description: typeof i18next !== 'undefined' ? i18next.t('tour.cart_desc') : 'Ваши покупки' } });
        } else {
            activeSteps.push(
                { element: '#authBox', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prof_title') : 'ПРОФИЛЬ', description: typeof i18next !== 'undefined' ? i18next.t('tour.prof_desc') : 'Авторизация' } },
                { element: '.sidebar', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.filt_title') : 'ФИЛЬТРЫ', description: typeof i18next !== 'undefined' ? i18next.t('tour.filt_desc') : 'Фильтры каталога' } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.star_title') : 'ИЗБРАННОЕ', description: typeof i18next !== 'undefined' ? i18next.t('tour.star_desc') : 'Сохраняйте вещи' } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_title') : 'КОРЗИНА', description: typeof i18next !== 'undefined' ? i18next.t('tour.cartbtn_desc') : 'Добавление в заказ' } });
            activeSteps.push({ element: '.fab-propose', popover: { title: typeof i18next !== 'undefined' ? i18next.t('tour.prop_title') : 'ПРЕДЛОЖКА', description: typeof i18next !== 'undefined' ? i18next.t('tour.prop_desc') : 'Продать свою вещь' } });
        }

        const driverObj = window.driver.js.driver({
            showProgress: true,
            nextBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.next') : 'Далее',
            prevBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.prev') : 'Назад',
            doneBtnText: typeof i18next !== 'undefined' ? i18next.t('tour.done') : 'Готово',
            steps: activeSteps,
            onDestroyStarted: () => {
                localStorage.setItem('nisha_tour_done', 'true');
                driverObj.destroy();
                
                if (window.pendingBroadcastHtml && typeof tryShowBroadcast === 'function') {
                    setTimeout(() => {
                        tryShowBroadcast('SYSTEM_BROADCAST.MSG', window.pendingBroadcastHtml, '[ ЗАКРЫТЬ ]', () => {
                            localStorage.setItem('nisha_last_broadcast', window.pendingBroadcastId);
                        });
                        window.pendingBroadcastHtml = null;
                    }, 600);
                }
            }
        });
        driverObj.drive();
    }, 500);
}
window.startOnboardingTour = startOnboardingTour;
