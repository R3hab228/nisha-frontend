// ==========================================
// NISHA PRODUCT MODAL, GALLERY & Q&A MODULE
// ==========================================

// Глобальное состояние открытого товара и слайдера
if (typeof window.currentOpenedItem === 'undefined') window.currentOpenedItem = null;
let currentOpenedItem = window.currentOpenedItem;

let currentSlide = 0;

const toCDN = (u, opts) => (typeof window.toCDN === 'function' ? window.toCDN(u, opts) : (u || ''));

// Безопасные геттеры зависимостей
function getFavs() {
    return window.favorites || (typeof favorites !== 'undefined' ? favorites : []);
}

function getUser() {
    return window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
}

function getFingerprint() {
    return window.clientFingerprint || (typeof clientFingerprint !== 'undefined' ? clientFingerprint : 'guest_' + Date.now());
}

// Профессиональный алгоритм многофакторного скоринга похожих вещей
function computeItemSimilarity(source, target) {
    if (!source || !target) return 0;
    let score = 0;

    // 1. Совпадение категории (Базовый приоритет: +50 баллов)
    const srcCat = (source.category || '').toLowerCase().trim();
    const tgtCat = (target.category || '').toLowerCase().trim();
    if (srcCat && tgtCat && srcCat === tgtCat) {
        score += 50;
    }

    // 2. Совпадение бренда (+40 баллов)
    const srcBrand = (source.brand || '').toLowerCase().trim();
    const tgtBrand = (target.brand || '').toLowerCase().trim();
    if (srcBrand && tgtBrand && srcBrand === tgtBrand) {
        score += 40;
    }

    // 3. Совпадение размера вещи (+35 баллов за точный, +20 за совместимый)
    const srcSize = (source.size || '').toLowerCase().replace(/[\s\-_]/g, '');
    const tgtSize = (target.size || '').toLowerCase().replace(/[\s\-_]/g, '');
    if (srcSize && tgtSize) {
        if (srcSize === tgtSize) {
            score += 35;
        } else if (srcSize.includes(tgtSize) || tgtSize.includes(srcSize)) {
            score += 20;
        }
    }

    // 4. Доступность для покупки (+30 за available, +5 за reserved)
    if (target.status === 'available') {
        score += 30;
    } else if (target.status === 'reserved') {
        score += 5;
    }

    // 5. Близость бюджета/цены (до +20 баллов)
    const p1 = Number(source.price) || 0;
    const p2 = Number(target.price) || 0;
    if (p1 > 0 && p2 > 0) {
        const diffRatio = Math.abs(p1 - p2) / p1;
        if (diffRatio <= 0.15) {
            score += 20;
        } else if (diffRatio <= 0.35) {
            score += 12;
        } else if (diffRatio <= 0.60) {
            score += 6;
        }
    }

    // 6. Совпадение стилевых тегов (до +20 баллов)
    const srcTags = Array.isArray(source.tags) ? source.tags.map(t => String(t).toLowerCase().trim()) : [];
    const tgtTags = Array.isArray(target.tags) ? target.tags.map(t => String(t).toLowerCase().trim()) : [];
    if (srcTags.length > 0 && tgtTags.length > 0) {
        let tagMatches = 0;
        srcTags.forEach(t => {
            if (tgtTags.includes(t)) tagMatches++;
        });
        score += Math.min(20, tagMatches * 10);
    }

    // 7. Свежесть / Скидка
    if (target.is_top) score += 5;
    if (target.is_sale) score += 5;

    // 8. Легкий естественный джиттер (0 - 8 баллов) для разнообразия выдачи
    score += Math.random() * 8;

    return score;
}
window.computeItemSimilarity = computeItemSimilarity;

// Умная предзагрузка следующего фото при наведении на стрелку слайдера
function preloadSlide(step) {
    const active = window.currentOpenedItem;
    if (!active || !active.images || active.images.length <= 1) return;
    const targetIndex = (currentSlide + step + active.images.length) % active.images.length;
    const url = toCDN(active.images[targetIndex]);
    if (url && !url.endsWith('.mp4')) {
        const img = new Image();
        img.src = url;
    }
}
window.preloadSlide = preloadSlide;

// ========================================== 
// УМНЫЙ УПРЕЖДАЮЩИЙ PRELOAD МОДАЛКИ ТОВАРА (SMART PRE-WARM)
// ========================================== 
const _prewarmedItemDetails = new Map();
const _prewarmedImagesSet = new Set();
let _prewarmDebounceTimer = null;
let _prewarmPendingId = null;

window._prewarmedItemDetails = _prewarmedItemDetails;
window._prewarmedImagesSet = _prewarmedImagesSet;

function isDataSaverActive() {
    try {
        if (typeof navigator !== "undefined" && navigator.connection) {
            const conn = navigator.connection;
            if (conn.saveData === true) return true;
            if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return true;
        }
    } catch (_) {}
    return false;
}

function prewarmItemDetails(itemId) {
    if (!itemId) return Promise.resolve(null);
    const key = String(itemId);
    if (_prewarmedItemDetails.has(key)) {
        return _prewarmedItemDetails.get(key);
    }

    if (_prewarmedItemDetails.size >= 50) {
        const firstKey = _prewarmedItemDetails.keys().next().value;
        _prewarmedItemDetails.delete(firstKey);
    }

    const fetchPromise = (async () => {
        try {
            const sb = typeof getSupabase === "function" ? getSupabase() : (window.supabaseClient || null);
            if (!sb) return null;
            let { data, error: itemErr } = await sb.from("items")
                .select("id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable, is_bargain, min_bargain_price")
                .eq("id", itemId)
                .limit(1);
            if (itemErr && (itemErr.message?.includes('is_bargain') || itemErr.message?.includes('min_bargain_price') || itemErr.code === '42703' || itemErr.code === 'PGRST204')) {
                const retryRes = await sb.from("items")
                    .select("id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable")
                    .eq("id", itemId)
                    .limit(1);
                data = retryRes.data;
            }
            if (data && data.length > 0) return data.at(0);
            let { data: archData } = await sb.from("archived_items")
                .select("id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable")
                .eq("id", itemId)
                .limit(1);
            if (archData && archData.length > 0) return archData.at(0);
            return null;
        } catch (_) {
            return null;
        }
    })();

    _prewarmedItemDetails.set(key, fetchPromise);
    return fetchPromise;
}

function prewarmProductModal(id, immediate = false) {
    if (!id) return;
    const itemIdStr = String(id);

    const executePrewarm = () => {
        const catalog = (typeof getCatalog === "function") ? getCatalog() : (window.allItems || []);
        const item = catalog.find(i => String(i.id) === itemIdStr);

        // 1. Предзагрузка полных данных из БД (замеры, описание, теги)
        prewarmItemDetails(id);

        // 2. Фоновый прогрев PhotoSwipe в idle-время
        if (typeof ensurePhotoSwipe === "function") {
            if (typeof window.requestIdleCallback === "function") {
                window.requestIdleCallback(() => ensurePhotoSwipe().catch(() => {}), { timeout: 300 });
            } else {
                setTimeout(() => ensurePhotoSwipe().catch(() => {}), 40);
            }
        }

        // 3. Предзагрузка первых двух полноразмерных фото в кэш браузера (если не Save-Data)
        if (item && !isDataSaverActive()) {
            const mediaList = (Array.isArray(item.images) && item.images.length > 0)
                ? item.images
                : (Array.isArray(item.thumbnails) ? item.thumbnails : []);

            mediaList.slice(0, 2).forEach(url => {
                if (url && typeof url === "string" && !url.endsWith(".mp4")) {
                    const cdnUrl = typeof toCDN === "function" ? toCDN(url) : url;
                    if (!_prewarmedImagesSet.has(cdnUrl)) {
                        _prewarmedImagesSet.add(cdnUrl);
                        if (_prewarmedImagesSet.size > 100) {
                            const first = _prewarmedImagesSet.values().next().value;
                            _prewarmedImagesSet.delete(first);
                        }
                        const img = new Image();
                        img.decoding = "async";
                        img.src = cdnUrl;
                    }
                }
            });
        }
    };

    if (immediate) {
        executePrewarm();
        return;
    }

    clearTimeout(_prewarmDebounceTimer);
    _prewarmPendingId = itemIdStr;
    _prewarmDebounceTimer = setTimeout(() => {
        _prewarmPendingId = null;
        executePrewarm();
    }, 80);
}

function cancelPrewarmProductModal(id) {
    if (_prewarmPendingId && String(_prewarmPendingId) === String(id)) {
        clearTimeout(_prewarmDebounceTimer);
        _prewarmPendingId = null;
    }
}

window.prewarmProductModal = prewarmProductModal;
window.cancelPrewarmProductModal = cancelPrewarmProductModal;
window.prewarmItemDetails = prewarmItemDetails;

// ==========================================
// 1. ОТКРЫТИЕ КАРТОЧКИ ТОВАРА (MODAL)
// ==========================================

async function openProductModalById(itemId) {
    if (typeof window.hideItemMeasurementsTooltip === 'function') window.hideItemMeasurementsTooltip();
    const catalog = getCatalog();
    let item = catalog.find(i => String(i.id) === String(itemId));

    const key = String(itemId);
    const prewarmedPromise = (typeof window._prewarmedItemDetails !== 'undefined' && window._prewarmedItemDetails)
        ? window._prewarmedItemDetails.get(key)
        : null;

    const onFullItemLoaded = (fullItem) => {
        if (!fullItem) return;
        const active = window.currentOpenedItem || currentOpenedItem;
        if (active && String(active.id) === String(fullItem.id)) {
            const hadNoImages = (!active.images || active.images.length === 0) && (!active.thumbnails || active.thumbnails.length === 0);
            const hasFullImages = (fullItem.images && fullItem.images.length > 0) || (fullItem.thumbnails && fullItem.thumbnails.length > 0);
            const hadBargain = Boolean(active.is_bargain || active.min_bargain_price || (typeof active.description === 'string' && /\[ТОРГ:?\s*(?:(?:від|от)\s*)?(\d+)/i.test(active.description)));
            const nowHasBargain = Boolean(fullItem.is_bargain || fullItem.min_bargain_price || (typeof fullItem.description === 'string' && /\[ТОРГ:?\s*(?:(?:від|от)\s*)?(\d+)/i.test(fullItem.description)));
            
            currentOpenedItem = { ...active, ...fullItem };
            window.currentOpenedItem = currentOpenedItem;
            if (Array.isArray(window.allItems)) {
                const idx = window.allItems.findIndex(it => it && String(it.id) === String(fullItem.id));
                if (idx !== -1) window.allItems[idx] = { ...window.allItems[idx], ...fullItem };
            }

            if (hadNoImages && hasFullImages) {
                if (typeof closeModal === 'function') {
                    const om = document.getElementById('ordersModal');
                    if (om && (om.style.display === 'flex' || om.style.display === 'block')) closeModal('ordersModal');
                    const rm = document.getElementById('reviewsModal');
                    if (rm && (rm.style.display === 'flex' || rm.style.display === 'block')) closeModal('reviewsModal');
                }
                openProductModal(currentOpenedItem);
                return;
            }
            if (hadBargain !== nowHasBargain) {
                const offerWrapper = document.getElementById('offerPriceWrapper');
                const offerPriceBtn = document.getElementById('modalOfferPriceBtn');
                if (offerWrapper) offerWrapper.style.display = nowHasBargain ? 'block' : 'none';
                if (offerPriceBtn) offerPriceBtn.style.display = nowHasBargain ? 'block' : 'none';
            }

            if (fullItem.description) {
                const cleanFullDesc = String(fullItem.description).replace(/\s*\[ТОРГ:?[^\]]*\]/gi, '').trim();
                const descText = cleanFullDesc ? cleanFullDesc.replaceAll('\n', '<br>') : '<span style="color:#666;">[ Описание отсутствует ]</span>';
                const descContainer = document.querySelector('.modal-desc');
                if (descContainer) {
                    const sizeTitle = typeof i18next !== 'undefined' ? i18next.t('product.size') : 'РАЗМЕР';
                    const brandTitle = typeof i18next !== 'undefined' ? i18next.t('product.brand') : 'БРЕНД';
                    const qaMarker = '<!-- Блок Вопросов и Ответов (Q&A) -->';
                    const qaIndex = descContainer.innerHTML.includes(qaMarker) 
                        ? descContainer.innerHTML.indexOf(qaMarker) 
                        : descContainer.innerHTML.indexOf('<div id="qaWrapper"');
                    const qaPart = qaIndex !== -1 ? descContainer.innerHTML.substring(qaIndex) : '';
                    const escHtml = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s => String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
                    descContainer.innerHTML = `
                        <div style="margin-bottom: 5px;">
                            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${sizeTitle}</span></strong> 
                            <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${escHtml(fullItem.size)}</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${brandTitle}</span></strong> 
                            <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${escHtml(fullItem.brand)}</span>
                        </div>
                        <div style="color: #aaa; font-size: 13px;">${typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(descText) : escHtml(descText)}</div>
                    ` + qaPart;
                }
            }
        }
    };

    // 1. МГНОВЕННО открываем модалку (0 мс задержки), если товар есть в памяти каталога
    if (item) {
        const cardInGrid = document.querySelector(`.item-card[data-id="${itemId}"]`);
        if (cardInGrid) cardInGrid.classList.remove('unseen-pulse');

        if (window._seenItemsSet) {
            window._seenItemsSet.add(String(itemId));
        }
        setTimeout(() => {
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            let seenItemsIds = store ? store.getJSON('nisha_seen_items', []) : [];
            if (!seenItemsIds.includes(itemId)) {
                seenItemsIds.push(itemId);
                if (seenItemsIds.length > 200) seenItemsIds = seenItemsIds.slice(-200); 
                if (store) store.setJSON('nisha_seen_items', seenItemsIds);
            }
        }, 0);

        if (typeof closeModal === 'function') {
            const om = document.getElementById('ordersModal');
            if (om && (om.style.display === 'flex' || om.style.display === 'block')) closeModal('ordersModal'); 
            const rm = document.getElementById('reviewsModal');
            if (rm && (rm.style.display === 'flex' || rm.style.display === 'block')) closeModal('reviewsModal'); 
        }
        openProductModal(item); 
    }

    // 2. В ФОНЕ подтягиваем полные данные (описание, замеры) без блокировки UI
    if (prewarmedPromise) {
        prewarmedPromise.then(onFullItemLoaded).catch(() => {});
    } else {
        const sb = getSupabase();
        if (sb) {
            (async () => {
                try {
                    let { data, error: itemErr } = await sb.from('items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable, is_bargain, min_bargain_price').eq('id', itemId).limit(1);
                    if (itemErr && (itemErr.message?.includes('is_bargain') || itemErr.message?.includes('min_bargain_price') || itemErr.code === '42703' || itemErr.code === 'PGRST204')) {
                        const retryRes = await sb.from('items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable').eq('id', itemId).limit(1);
                        data = retryRes.data;
                    }
                    let full = null;
                    if (data && data.length > 0) {
                        full = data.at(0);
                    } else {
                        let { data: archData } = await sb.from('archived_items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable').eq('id', itemId).limit(1);
                        if (archData && archData.length > 0) full = archData.at(0);
                    }
                    if (!item && full) {
                        if (typeof closeModal === 'function') {
                            const om = document.getElementById('ordersModal');
                            if (om && (om.style.display === 'flex' || om.style.display === 'block')) closeModal('ordersModal');
                            const rm = document.getElementById('reviewsModal');
                            if (rm && (rm.style.display === 'flex' || rm.style.display === 'block')) closeModal('reviewsModal');
                        }
                        openProductModal(full);
                        return;
                    }
                    if (full) onFullItemLoaded(full);
                } catch(e) { console.error("Ошибка сети:", e); }
            })();
        }
    }
}
window.openProductModalById = openProductModalById;

function openProductModal(item) {
    currentOpenedItem = item;
    window.currentOpenedItem = item;

    if (item && item.id) {
        document.querySelectorAll(`.item-card[data-id="${item.id}"]`).forEach(c => c.classList.remove('unseen-pulse'));
        if (window._seenItemsSet) window._seenItemsSet.add(String(item.id));
    }
    
    // Мгновенный прогрев PhotoSwipe в фоне для открытия зума за 0 мс
    if (typeof ensurePhotoSwipe === 'function') ensurePhotoSwipe();

    if (typeof window.stopLenis === 'function') window.stopLenis();
    else if (typeof lenis !== 'undefined') lenis.stop();
    
    document.title = `NISHA | ${item.brand} - ${item.name}`;

    const titleEl = document.getElementById('modalItemTitle');
    if (titleEl) titleEl.innerText = item.name;
    
    if (window.analytics && typeof window.analytics.trackProductView === 'function') {
        window.analytics.trackProductView(item);
    } else if (window.ttq) {
        ttq.track('ViewContent', {
            content_id: item.id,
            content_name: item.name,
            value: item.price,
            currency: 'UAH'
        });
    }

    // Красим звездочку в модалке, если товар уже в избранном
    const modalStar = document.getElementById('modalFavStar');
    const favs = getFavs();
    if (modalStar) {
        modalStar.classList.toggle('active', favs.includes(item.id));
    }

    const isHackedActive = window.isHacked || (typeof isHacked !== 'undefined' && isHacked);
    let finalPrice = isHackedActive ? Math.floor(item.price * 0.9) : item.price;
    const priceEl = document.getElementById('modalItemPrice');
    if (priceEl) priceEl.innerText = (typeof formatPrice === 'function') ? formatPrice(finalPrice) : (finalPrice + ' ' + (typeof getCurrency === 'function' ? getCurrency() : 'грн'));

    // Если у текущего покупателя есть персональная согласованная цена (Торг)
    try {
        const savedBargain = sessionStorage.getItem('accepted_bargain_' + item.id) || localStorage.getItem('accepted_bargain_' + item.id);
        if (savedBargain) {
            const parsedBargain = JSON.parse(savedBargain);
            if (parsedBargain && parsedBargain.acceptedPrice && priceEl) {
                const cur = (typeof getCurrency === 'function' ? getCurrency() : 'грн').trim();
                priceEl.innerHTML = `<span style="text-decoration: line-through; color: #777; font-size: 0.75em; margin-right: 8px;">${parsedBargain.originalPrice || item.price} ${cur}</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${parsedBargain.acceptedPrice} ${cur}</span>`;
            }
        }
    } catch (e) {}
    
    const sizeDescEl = document.getElementById('modalItemSizeDesc');
    if (sizeDescEl) sizeDescEl.innerText = item.size;
    
    const brandEl = document.getElementById('modalItemBrand');
    if (brandEl) brandEl.innerText = item.brand;
    
    const condStr = item.condition || '9 / 10';
    const condMatch = condStr.match(/(\d+)/);
    
    let condNum = 9;
    if (condMatch && condMatch[1]) condNum = Number.parseInt(condMatch[1], 10);
    
    const condFill = document.getElementById('modalCondFill');
    if (condFill) condFill.style.width = (condNum * 10) + '%';
    
    const condText = document.getElementById('modalItemCond');
    if (condText) condText.innerText = condStr;

    if (condFill && condText) {
        if (condNum <= 3) {
            condFill.style.backgroundColor = 'var(--accent-red)';
            condText.style.color = 'var(--accent-red)';
        } else if (condNum <= 6) {
            condFill.style.backgroundColor = '#ff9900';
            condText.style.color = '#ff9900';
        } else if (condNum <= 8) {
            condFill.style.backgroundColor = 'var(--accent-yellow)';
            condText.style.color = 'var(--accent-yellow)';
        } else {
            condFill.style.backgroundColor = 'var(--accent-green)';
            condText.style.color = 'var(--accent-green)';
        }
    }

    // Рендер хэштегов
    const tagsContainer = document.getElementById('modalItemTags');
    if (tagsContainer) {
        if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
            tagsContainer.innerHTML = item.tags.slice(0, 3).map(t => `<span style="color: #fff; margin-right: 12px; letter-spacing: 0.5px;">#${typeof window.escapeHtml === 'function' ? window.escapeHtml(t) : t}</span>`).join('');
            tagsContainer.style.display = 'block';
        } else {
            tagsContainer.style.display = 'none';
            if (typeof tagsContainer.replaceChildren === 'function') tagsContainer.replaceChildren();
            else tagsContainer.innerHTML = '';
        }
    }

    const defaultDesc = "Оригинал. Любые проверки. Отличное состояние. Дополнительные замеры по запросу в ЛС.";
    const rawDesc = item.description ? String(item.description) : defaultDesc;
    const cleanDesc = rawDesc.replace(/\s*\[ТОРГ:?[^\]]*\]/gi, '').trim();
    const descText = (cleanDesc || defaultDesc).replaceAll('\r', '').replaceAll('\n', '<br>');
    const escHtml = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s => String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
    const safeDescHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(descText) : escHtml(descText);
    const descBlock = document.querySelector('.modal-desc');
    if (descBlock) {
        descBlock.innerHTML = `
            <div style="margin-bottom: 5px;">
                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${typeof i18next !== 'undefined' ? i18next.t('product.size') : 'РАЗМЕР'}</span></strong> 
                <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${escHtml(item.size)}</span>
            </div>
            <div style="margin-bottom: 15px;">
                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${typeof i18next !== 'undefined' ? i18next.t('product.brand') : 'БРЕНД'}</span></strong> 
                <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${escHtml(item.brand)}</span>
            </div>
            <div style="color: #aaa; font-size: 13px;">${safeDescHtml}</div>
            
            <!-- БЛОК ВОПРОСОВ И ОТВЕТОВ (АККОРДЕОН) -->
            <div id="qaWrapper" class="qa-wrapper">
                <h4 class="qa-title" data-action="toggle-qa-section">
                    <span data-i18n="product.qa_title">${typeof i18next !== 'undefined' ? i18next.t('product.qa_title', {defaultValue: 'Q&A: Вопросы покупателей'}) : 'Q&A: Вопросы покупателей'}</span>
                    <span class="qa-arrow" style="transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1); color: var(--accent-green); display: inline-block;">▼</span>
                </h4>
                <div id="qaCollapseWrapper" class="qa-collapse-wrapper">
                    <div id="qaList" class="qa-content"></div>
                </div>
            </div>

            <!-- КНОПКА ЗАДАТЬ ВОПРОС -->
            <div style="margin-top: 15px; text-align: right;">
                <button data-action="toggle-question-form" class="ask-question-btn" data-i18n="product.ask_btn">${typeof i18next !== 'undefined' ? i18next.t('product.ask_btn', {defaultValue: 'Задать вопрос?'}) : 'Задать вопрос?'}</button>
            </div>
            <div id="questionFormContainer" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; margin-top: 5px;">
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <input type="text" id="questionInput" class="form-input" maxlength="100" placeholder="Ваш вопрос..." data-i18n-ph="product.ask_ph" style="font-size: 12px; padding: 8px;">
                    <button class="search-btn btn-target" data-action="submit-question" data-id="${typeof window.escapeAttr === 'function' ? window.escapeAttr(item.id) : item.id}" style="padding: 8px 15px; font-size: 12px;" data-i18n="product.ask_send">${typeof i18next !== 'undefined' ? i18next.t('product.ask_send', {defaultValue: 'ОТПРАВИТЬ'}) : 'ОТПРАВИТЬ'}</button>
                </div>
            </div>
        `;
    }

    // Защищенные просмотры товара (Anti-Spam)
    const viewCount = document.getElementById('modalItemViews');
    const sb = getSupabase();
    if (viewCount) {
        viewCount.innerText = item.views_count || 0;
        
        if (sb) {
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            let viewedItems = store ? store.getJSON('nisha_added_views', []) : [];
            
            if (!viewedItems.includes(item.id)) {
                let visitorId = getFingerprint();
                if (!visitorId || visitorId.startsWith('guest_')) {
                    visitorId = (store ? store.get('nisha_visitor_id') : null) || ('user_' + (typeof window.generateShortId === 'function' ? window.generateShortId(9) : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().replaceAll('-', '').slice(0, 9) : Date.now().toString(36))));
                }
                const currentUser = getUser();
                const viewerId = currentUser ? currentUser.id : visitorId;
                
                sb.rpc('increment_item_views', { 
                    p_item_uuid: item.id, 
                    p_viewer_id: viewerId 
                }).then(({ data, error }) => {
                    if (!error && data !== null) {
                        viewCount.innerText = data; 
                        item.views_count = data; 
                        if (Array.isArray(window.allItems)) {
                            const catItem = window.allItems.find(i => i && String(i.id) === String(item.id));
                            if (catItem) catItem.views_count = data;
                        }
                        if (typeof window.updateCardDOM === 'function') {
                            window.updateCardDOM(item);
                        }
                        viewedItems.push(item.id);
                        if (store) store.setJSON('nisha_added_views', viewedItems);
                    }
                });
            }
        }
    }

    const cartBtn = document.getElementById('modalCartBtn');
    if (cartBtn) {
        if (item.status === 'sold') {
            cartBtn.style.display = 'none';
        } else {
            cartBtn.style.display = 'block';
            const userCart = (typeof window.getActiveCart === 'function')
                ? window.getActiveCart()
                : ((typeof getActiveCart === 'function')
                    ? getActiveCart()
                    : ((window.store && typeof window.store.get === 'function')
                        ? (window.store.get('cart') || [])
                        : (window.cart || [])));
            const isInCart = userCart.some(i => i && String(i.id) === String(item.id));
            const inCartText = (typeof i18next !== 'undefined') ? i18next.t('product.in_cart', { defaultValue: 'В КОРЗИНЕ' }) : 'В КОРЗИНЕ';
            const addToCartText = (typeof i18next !== 'undefined') ? i18next.t('product.add_to_cart', { defaultValue: 'В КОРЗИНУ' }) : 'В КОРЗИНУ';
            cartBtn.innerText = isInCart ? inCartText : addToCartText;
        }
    }

    const offerWrapper = document.getElementById('offerPriceWrapper');
    const offerPriceBtn = document.getElementById('modalOfferPriceBtn');
    const offerInputRow = document.getElementById('offerPriceInputRow');
    const inlineInput = document.getElementById('inlineBargainPriceInput');

    if (offerWrapper || offerPriceBtn) {
        const descMatch = item && (typeof item.description === 'string') && item.description.match(/\[ТОРГ:?\s*(?:(?:від|от)\s*)?(\d+)/i);
        const itemMinBargain = item ? (item.min_bargain_price || (descMatch ? Number.parseInt(descMatch[1], 10) : null)) : null;
        const hasBargain = Boolean(item && (item.is_bargain || itemMinBargain || (typeof item.description === 'string' && /\[ТОРГ/i.test(item.description))));

        if (item && item.status === 'sold') {
            if (offerWrapper) offerWrapper.style.display = 'none';
            if (offerPriceBtn) offerPriceBtn.style.display = 'none';
            if (offerInputRow) offerInputRow.style.display = 'none';
        } else if (!hasBargain) {
            if (offerWrapper) offerWrapper.style.display = 'none';
            if (offerPriceBtn) offerPriceBtn.style.display = 'none';
            if (offerInputRow) offerInputRow.style.display = 'none';
        } else {
            if (offerWrapper) offerWrapper.style.display = 'block';
            let isAcceptedBargain = false;
            let isDeclinedBargain = false;
            let isPendingBargain = false;
            try {
                const sId = String(item.id);
                if (sessionStorage.getItem('declined_bargain_' + sId) || localStorage.getItem('declined_bargain_' + sId)) {
                    isDeclinedBargain = true;
                } else {
                    const savedAcc = sessionStorage.getItem('accepted_bargain_' + sId) || localStorage.getItem('accepted_bargain_' + sId);
                    if (savedAcc) {
                        const parsed = JSON.parse(savedAcc);
                        if (parsed && parsed.acceptedPrice) isAcceptedBargain = true;
                    }
                    if (!isAcceptedBargain) {
                        const savedPend = sessionStorage.getItem('pending_bargain_' + sId) || localStorage.getItem('pending_bargain_' + sId);
                        if (savedPend) {
                            const parsedPend = JSON.parse(savedPend);
                            if (parsedPend && (Date.now() - (parsedPend.timestamp || 0) < 24 * 60 * 60 * 1000)) {
                                isPendingBargain = true;
                            } else {
                                sessionStorage.removeItem('pending_bargain_' + sId);
                                localStorage.removeItem('pending_bargain_' + sId);
                            }
                        }
                    }
                }
            } catch (e) {}

            if (offerPriceBtn) {
                offerPriceBtn.style.display = 'flex';
                offerPriceBtn.style.opacity = '1';
                offerPriceBtn.style.transform = 'translateY(0)';
                if (isDeclinedBargain) {
                    const declinedText = (typeof i18next !== 'undefined') ? i18next.t('product.offer_declined_btn', { defaultValue: 'ПРОПОЗИЦІЮ ВІДХИЛЕНО' }) : 'ПРОПОЗИЦІЮ ВІДХИЛЕНО';
                    offerPriceBtn.innerText = declinedText;
                    offerPriceBtn.style.borderColor = 'var(--accent-red, #ff3333)';
                    offerPriceBtn.style.color = 'var(--accent-red, #ff3333)';
                    offerPriceBtn.style.pointerEvents = 'none';
                    offerPriceBtn.style.cursor = 'default';
                    offerPriceBtn.style.boxShadow = 'none';
                    offerPriceBtn.disabled = true;
                } else if (isAcceptedBargain) {
                    const acceptedText = (typeof i18next !== 'undefined') ? i18next.t('product.offer_accepted_btn', { defaultValue: 'ПРОПОЗИЦІЮ ПРИЙНЯТО ✓' }) : 'ПРОПОЗИЦІЮ ПРИЙНЯТО ✓';
                    offerPriceBtn.innerText = acceptedText;
                    offerPriceBtn.style.borderColor = 'var(--accent-yellow, #ffd700)';
                    offerPriceBtn.style.color = 'var(--accent-yellow, #ffd700)';
                    offerPriceBtn.style.pointerEvents = 'none';
                    offerPriceBtn.style.cursor = 'default';
                    offerPriceBtn.style.boxShadow = 'none';
                    offerPriceBtn.disabled = true;
                } else if (isPendingBargain) {
                    const pendingText = (typeof i18next !== 'undefined') ? i18next.t('product.offer_pending', { defaultValue: '[ ПРОПОЗИЦІЮ НАДІСЛАНО ✓ ]' }) : '[ ПРОПОЗИЦІЮ НАДІСЛАНО ✓ ]';
                    offerPriceBtn.innerText = pendingText;
                    offerPriceBtn.style.borderColor = 'var(--accent-green, #00ff66)';
                    offerPriceBtn.style.color = 'var(--accent-green, #00ff66)';
                    offerPriceBtn.style.pointerEvents = 'none';
                    offerPriceBtn.style.cursor = 'default';
                    offerPriceBtn.style.boxShadow = 'none';
                    offerPriceBtn.disabled = true;
                } else {
                    const offerText = (typeof i18next !== 'undefined') ? i18next.t('product.offer_price', { defaultValue: '[ ЗАПРОПОНУВАТИ СВОЮ ЦІНУ ]' }) : '[ ЗАПРОПОНУВАТИ СВОЮ ЦІНУ ]';
                    offerPriceBtn.innerText = offerText;
                    offerPriceBtn.style.borderColor = '#333';
                    offerPriceBtn.style.color = 'var(--accent-green, #00ff66)';
                    offerPriceBtn.style.pointerEvents = 'auto';
                    offerPriceBtn.style.cursor = 'pointer';
                    offerPriceBtn.style.boxShadow = 'none';
                    offerPriceBtn.disabled = false;
                }
            }
            if (offerInputRow) {
                offerInputRow.style.display = 'none';
                offerInputRow.classList.remove('visible');
                offerInputRow.style.opacity = '0';
                offerInputRow.style.transform = 'translateY(4px)';
            }
            if (inlineInput) inlineInput.value = '';
        }
    }

    currentSlide = 0;
    window.currentSlide = 0;
    const wrapper = document.getElementById('sliderWrapper');
    const thumbs = document.getElementById('modalThumbnails');
    if (wrapper) {
        if (wrapper.style) {
            wrapper.style.transition = 'none';
            wrapper.style.transform = 'translateX(0%)';
        }
        if (typeof wrapper.replaceChildren === 'function') wrapper.replaceChildren();
        else wrapper.innerHTML = '';
    }
    if (thumbs) {
        if (typeof thumbs.replaceChildren === 'function') thumbs.replaceChildren();
        else thumbs.innerHTML = '';
    }
    
    const mediaList = (Array.isArray(item.images) && item.images.length > 0)
        ? item.images
        : ((Array.isArray(item.thumbnails) && item.thumbnails.length > 0) ? item.thumbnails : []);

    const totalMedia = mediaList.length;
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
    if (wrapper && thumbs) {
        if (mediaList.length > 0) {
            let slidesHtml = '';
            let thumbsHtml = '';
            mediaList.forEach((url, index) => {
                const cdnUrl = toCDN(url);
                const isVideo = typeof cdnUrl === 'string' && cdnUrl.endsWith('.mp4');
                let currentThumb = (item.thumbnails && item.thumbnails[index]) ? toCDN(item.thumbnails[index], { isThumb: true }) : toCDN(url, { isThumb: true });
                
                if (isVideo && (!item.thumbnails || !item.thumbnails[index])) {
                    currentThumb = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23000'/%3E%3Cpolygon points='40,30 70,50 40,70' fill='%2300ff00'/%3E%3Ctext x='50' y='88' font-family='monospace' font-size='11' font-weight='bold' fill='%2300ff00' text-anchor='middle'%3EVIDEO%3C/text%3E%3C/svg%3E";
                }
                
                if (isVideo) {
                    slidesHtml += `
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

                            >
                                <source src="${cdnUrl}#t=0.001" type="video/mp4">
                            </video>
                        </div>`;
                } else {
                    const isFirst = (index === 0);
                    const isSecond = (index === 1);
                    const loadAttr = isFirst ? 'fetchpriority="high" loading="eager"' : (isSecond ? 'loading="eager"' : 'loading="lazy"');
                    slidesHtml += `
                        <a href="${cdnUrl}" data-pswp-width="1000" data-pswp-height="1000" target="_blank" class="slide" style="display:flex; align-items:center; justify-content:center; box-sizing:border-box; background:#000;">
                            <img class="modal-slide-img" src="${cdnUrl}" ${loadAttr} style="width:100%; height:100%; object-fit:contain; opacity:${isFirst ? '1' : '0'}; transition:opacity 0.2s ease-in-out;" 
                            >
                        </a>`;
                }
                
                thumbsHtml += `<div class="thumb" style="background-image:url('${currentThumb}'); position:relative;" data-action="set-slide" data-index="${index}">${isVideo ? '<span style="position:absolute; font-size:24px; color:#fff; text-shadow:0 0 5px #000; left:50%; top:50%; transform:translate(-50%, -50%);">▶</span>' : ''}</div>`;
            });
            wrapper.innerHTML = slidesHtml;
            wrapper.querySelectorAll('img.modal-slide-img').forEach(img => {
                if (img.complete && img.naturalWidth > 0 && img.style.opacity !== '1') {
                    img.style.opacity = '1';
                    if (img.parentElement) {
                        img.parentElement.setAttribute('data-pswp-width', img.naturalWidth);
                        img.parentElement.setAttribute('data-pswp-height', img.naturalHeight);
                        img.parentElement.classList.remove('skeleton');
                    }
                }
            });
            thumbs.innerHTML = thumbsHtml;
        } else {
            const noPhotoText = typeof i18next !== 'undefined' ? i18next.t('product.no_photo', { defaultValue: 'НЕТ ФОТО' }) : 'НЕТ ФОТО';
    wrapper.innerHTML = `<a class="slide" style="background:#111; pointer-events:none;">${noPhotoText}</a>`;
        }
    }

    setSlide(0, false);

    // Мгновенная предзагрузка первых слайдов для бесшовного свайпа и зума без задержек
    if (mediaList.length > 0) {
        mediaList.slice(0, 3).forEach((url, i) => {
            const cdnUrl = toCDN(url);
            if (typeof cdnUrl === 'string' && !cdnUrl.endsWith('.mp4')) {
                const preImg = new Image();
                preImg.decoding = 'async';
                preImg.fetchPriority = (i === 0) ? 'high' : 'auto';
                preImg.src = cdnUrl;
            }
        });
    }

    setTimeout(() => {
        const modalVideos = document.querySelectorAll('#sliderWrapper video.modal-video-player');
        modalVideos.forEach(vid => {
            let playPromise = vid.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    console.log("Ожидание клика (политика браузера)");
                });
            }
        });
    }, 100);

    if (typeof ensurePhotoSwipe === 'function') {
        ensurePhotoSwipe().catch(() => {});
    }

    if (wrapper && !wrapper._pswpClickBound) {
        wrapper._pswpClickBound = true;
        wrapper.addEventListener('click', (e) => {
            const slide = e.target.closest('a.slide');
            if (!slide || !wrapper.contains(slide)) return;
            // Не перехватываем клики по кнопкам управления (звук видео и т.д.)
            if (e.target.closest('button, [data-action], video')) return;
            // Если пользователь делал свайп — не открываем PhotoSwipe ошибочно
            if (window._isSliderSwiping) return;

            e.preventDefault();
            e.stopPropagation();
            if (typeof openProductPhotoZoom === 'function') {
                openProductPhotoZoom(slide);
            }
        });
    }

    // Рендер похожих товаров
    const simCont = document.getElementById('similarItemsContainer');
    const simContDesktop = document.getElementById('similarItemsContainerDesktop');
    if (simCont || simContDesktop) {
        if (simCont) {
            if (typeof simCont.replaceChildren === 'function') simCont.replaceChildren();
            else simCont.innerHTML = '';
        }
        if (simContDesktop) {
            if (typeof simContDesktop.replaceChildren === 'function') simContDesktop.replaceChildren();
            else simContDesktop.innerHTML = '';
        }

        const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
        const catalog = getCatalog();
        
        let candidates = catalog.filter(i => {
            if (i.id === item.id) return false;
            if (hideUnavailable && i.status !== 'available') return false;
            return true;
        });

        // Профессиональное ранжирование по многофакторному весу
        const scoredCandidates = candidates.map(c => ({
            item: c,
            score: computeItemSimilarity(item, c)
        }));

        const sortScoreFn = (a, b) => b.score - a.score;
        const sortedCandidates = (typeof window.toSorted === 'function')
            ? window.toSorted(scoredCandidates, sortScoreFn)
            : (scoredCandidates.toSorted ? scoredCandidates.toSorted(sortScoreFn) : [...scoredCandidates].sort(sortScoreFn));

        const similar = sortedCandidates.slice(0, 6).map(c => c.item);
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        let seenItemsIds = store ? store.getJSON('nisha_seen_items', []) : [];
            
        if (similar.length > 0) {
            let cardsHTML = '';
            similar.forEach(s => {
                const sImg = getOptimizedImg(s, true); 
                let miniBadgeHTML = '';
                const hasSale = s.is_sale;
                const hasHot = (s.views_count || 0) >= 25;
                const isTop = s.is_top === true && s.top_until && Date.parse(s.top_until) > Date.now();

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

                const curr = typeof getCurrency === 'function' ? getCurrency() : 'грн';
                const formattedSimilarPrice = (typeof formatPrice === 'function') ? formatPrice(s.price) : `${s.price} ${curr}`;
                let miniPriceHTML = formattedSimilarPrice;
                if (s.is_sale && s.old_price) {
                    const formattedOld = (typeof formatPrice === 'function') ? formatPrice(s.old_price, { numberOnly: true }) : s.old_price;
                    miniPriceHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 9px; margin-right: 4px;">${formattedOld}</span><span style="color: var(--accent-green);">${formattedSimilarPrice}</span>`;
                }
                try {
                    const rawSimBargain = sessionStorage.getItem('accepted_bargain_' + s.id) || localStorage.getItem('accepted_bargain_' + s.id);
                    if (rawSimBargain && s.status === 'available') {
                        const simBargain = JSON.parse(rawSimBargain);
                        if (simBargain && simBargain.acceptedPrice) {
                            const origSimPrice = simBargain.originalPrice || s.price;
                            miniPriceHTML = `<span style="color: #777; text-decoration: line-through; font-size: 9px; margin-right: 4px;">${origSimPrice} ${curr}</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${simBargain.acceptedPrice} ${curr}</span>`;
                        }
                    }
                } catch (e) {}

                const isUnseen = !seenItemsIds.includes(s.id) && s.status === 'available';
                const unseenClass = isUnseen ? 'is-unseen' : '';

                let statusOverlayHTML = '';
                let imageFilter = '';

                if (s.status === 'sold') {
                    statusOverlayHTML = `<div class="sold-badge" style="font-size: 14px !important; letter-spacing: 2px !important; padding: 2px 8px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">SOLD</div>`;
                    imageFilter = 'filter: grayscale(80%) brightness(0.5);'; 
                    miniPriceHTML = `<span style="color:#888; text-decoration:line-through;">${s.price} ${curr}</span>`;
                } else if (s.status === 'reserved') {
                    statusOverlayHTML = `<div class="reserved-badge" style="font-size: 11px !important; letter-spacing: 1px !important; padding: 2px 4px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">RESERVED</div>`;
                    imageFilter = 'filter: brightness(0.6);'; 
                }

                let imageBlockHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#555; font-family:var(--font-mono); font-size:10px;">NO FOTO</div>`;
                
                if (sImg) {
                    if (sImg.endsWith('.mp4')) {
                        imageBlockHTML = `<video src="${sImg}#t=0.001" style="width:100%; height:100%; object-fit:cover; pointer-events:none; ${imageFilter} transition: 0.3s;" preload="metadata"></video>`;
                    } else {
                        imageBlockHTML = `<img class="similar-slide-img" src="${sImg}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block; ${imageFilter} transition: 0.3s;">`;
                    }
                }

                cardsHTML += `
                    <div class="similar-item-card ${unseenClass}" 
                         data-action="open-product" data-hover-action="similar-item-tooltip" data-id="${typeof window.escapeAttr==='function'?window.escapeAttr(s.id):s.id}"
                         data-tooltip-move="1"
                         data-tooltip-leave="1"
                         role="button">
                        <div class="similar-card-img-wrap">
                            ${miniBadgeHTML}
                            ${statusOverlayHTML}
                            ${imageBlockHTML}
                        </div>
                        <div class="similar-card-price">${miniPriceHTML}</div>
                    </div>`;
            });
            if (simCont) simCont.innerHTML = cardsHTML;
            if (simContDesktop) simContDesktop.innerHTML = cardsHTML;

            if (window.gridVideoObserver) {
                document.querySelectorAll('.similar-card-img-wrap video').forEach(v => {
                    window.gridVideoObserver.observe(v);
                });
            }
        } else {
            const noItemsText = (typeof i18next !== 'undefined') ? i18next.t('product.no_similar', {defaultValue: 'Похожих товаров пока нет.'}) : 'Похожих товаров пока нет.';
            const emptyHTML = `<div style="color:#555; font-size:12px; font-family: var(--font-mono);">${noItemsText}</div>`;
            if (simCont) simCont.innerHTML = emptyHTML;
            if (simContDesktop) simContDesktop.innerHTML = emptyHTML;
        }
    }

    // Динамические бейджи гарантий и возврата
    const badgesContainer = document.querySelector('.trust-badges');
    if (badgesContainer) {
        const isDropItem = item.is_drop === true || (item.tags && item.tags.map(t => t.toLowerCase()).includes('drop'));
        const isReturnable = item.is_returnable === true; 
        
        let refundBadgeHTML = '';
        
        if (isDropItem) {
            const alertSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
            refundBadgeHTML = `
                <div class="badge-item danger-badge" data-action="show-badge-info" data-badge="drop">
                    <span class="badge-icon">${alertSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_drop">${typeof i18next !== 'undefined' ? i18next.t('product.badge_drop') : 'DROP ITEM'}</span>
                </div>`;
        } else if (isReturnable) {
            const returnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
            refundBadgeHTML = `
                <div class="badge-item" data-action="show-badge-info" data-badge="refund_yes">
                    <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${returnSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_refund">${typeof i18next !== 'undefined' ? i18next.t('product.badge_refund') : 'ВОЗВРАТ 14 ДНЕЙ'}</span>
                </div>`;
        } else {
            const noReturnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
            refundBadgeHTML = `
                <div class="badge-item" data-action="show-badge-info" data-badge="refund_no">
                    <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${noReturnSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_norefund">${typeof i18next !== 'undefined' ? i18next.t('product.badge_norefund') : 'БЕЗ ВОЗВРАТА'}</span>
                </div>`;
        }

        const secureSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`;

        const descMatch = (typeof item.description === 'string') && item.description.match(/\[ТОРГ:?\s*(?:(?:від|от)\s*)?(\d+)/i);
        const itemMinBargain = item.min_bargain_price || (descMatch ? Number.parseInt(descMatch[1], 10) : null);
        const hasBargain = Boolean(item.is_bargain || itemMinBargain || (typeof item.description === 'string' && /\[ТОРГ/i.test(item.description)));

        let deliveryOrBargainBadgeHTML = '';
        if (hasBargain) {
            const gavelSvg = `<svg width="18" height="18" viewBox="30 30 205 170" fill="var(--accent-green, #00ff66)" stroke="none" aria-hidden="true"><path d="M128 37 L135 38 L170 67 L177 74 L177 81 L173 84 L165 82 L129 52 L124 47 L124 41 L127 38 Z M124 54 L126 54 L162 84 L162 86 L126 129 L123 132 L120 130 L85 101 L123 55 Z M77 101 L83 104 L118 133 L124 140 L123 146 L118 149 L112 147 L77 118 L70 110 L71 104 L76 102 Z M149 107 L222 163 L227 169 L226 176 L221 180 L216 180 L208 174 L143 115 L148 108 Z M55 167 H133 C136 167 138 169 138 172 V174 C138 175.5 140 176.5 142 176.5 H145 C148.5 176.5 151 179 151 182.5 V188.5 C151 192 148.5 194.5 145 194.5 H43 C39.5 194.5 37 192 37 188.5 V182.5 C37 179 39.5 176.5 43 176.5 H46 C48 176.5 50 175.5 50 174 V172 C50 169 52 167 55 167 Z" /></svg>`;
            const curLang = (typeof i18next !== 'undefined' && i18next.language) ? i18next.language : 'ru';
            const fallbackBargainText = (curLang.startsWith('ua') || curLang.startsWith('uk')) ? 'Є ТОРГ' : (curLang.startsWith('en') ? 'BARGAIN' : 'ЕСТЬ ТОРГ');
            let bargainText = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
                ? i18next.t('product.badge_bargain', { defaultValue: fallbackBargainText })
                : fallbackBargainText;
            if (!bargainText || bargainText === 'product.badge_bargain') {
                bargainText = fallbackBargainText;
            }
            if (itemMinBargain) {
                if (curLang.startsWith('ua') || curLang.startsWith('uk')) {
                    bargainText = `ВІД ${itemMinBargain} ГРН`;
                } else if (curLang.startsWith('en')) {
                    bargainText = `FROM ${itemMinBargain} UAH`;
                } else {
                    bargainText = `ОТ ${itemMinBargain} ГРН`;
                }
            }
            const badgeI18nAttr = itemMinBargain ? `data-min-bargain="${itemMinBargain}"` : 'data-i18n="product.badge_bargain"';
            deliveryOrBargainBadgeHTML = `
                <div class="badge-item" data-action="show-badge-info" data-badge="bargain">
                    <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${gavelSvg}</span>
                    <span class="badge-text" ${badgeI18nAttr}>${bargainText}</span>
                </div>`;
        } else {
            deliveryOrBargainBadgeHTML = `
                <div class="badge-item" data-action="show-badge-info" data-badge="fast">
                    <span class="badge-icon">24H</span> 
                    <span class="badge-text" data-i18n="product.badge_fast">${typeof i18next !== 'undefined' ? i18next.t('product.badge_fast') : 'БЫСТРАЯ ОТПРАВКА'}</span>
                </div>`;
        }

        badgesContainer.innerHTML = `
            <div class="badge-item" data-action="show-badge-info" data-badge="secure">
                <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${secureSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_orig">${typeof i18next !== 'undefined' ? i18next.t('product.badge_orig') : '100% ОРИГИНАЛ'}</span>
            </div>
            ${deliveryOrBargainBadgeHTML}
            ${refundBadgeHTML}
        `;
    }

    const modalEl = document.getElementById('productModal');
    const isAlreadyOpen = Boolean(
        modalEl &&
        !modalEl.classList.contains('closing') &&
        (modalEl.classList.contains('is-open') || modalEl.style.display === 'flex')
    );

    if (!isAlreadyOpen) {
        if (item && item.id && typeof window.saveCurrentFeedScrollState === 'function') {
            window.saveCurrentFeedScrollState(item.id);
        }
        if (typeof openModal === 'function') {
            openModal('productModal');
        } else if (modalEl) {
            modalEl.inert = false;
            modalEl.removeAttribute('inert');
            modalEl.classList.remove('closing');
            modalEl.style.pointerEvents = '';
            modalEl.setAttribute('aria-hidden', 'false');
            const win = modalEl.querySelector('.modal-window');
            if (win) {
                win.style.pointerEvents = '';
                win.style.transform = '';
                win.style.opacity = '';
                win.style.transition = '';
                win.style.animation = '';
            }
            modalEl.style.display = 'flex';
            if (!document.body.style.overflow || document.body.style.overflow !== 'hidden') {
                window._preModalScrollY = window.scrollY || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
            }
            document.body.style.overflow = 'hidden';
        }
    } else {
        if (modalEl) modalEl.style.pointerEvents = '';
        const win = modalEl ? modalEl.querySelector('.modal-window') : null;
        if (win) win.style.pointerEvents = '';
        if (typeof triggerModalTypewriter === 'function') {
            triggerModalTypewriter(modalEl);
        }
    }

    addToHistory(item);

    const modalWin = document.querySelector('#productModal .modal-window');
    if (modalWin) {
        modalWin.style.pointerEvents = '';
        if (typeof modalWin.setAttribute === 'function') modalWin.setAttribute('data-lenis-prevent', 'true');
        if (isAlreadyOpen && modalWin.scrollTop > 20) {
            if (typeof modalWin.scrollTo === 'function') {
                try {
                    modalWin.scrollTo({ top: 0, behavior: 'smooth' });
                } catch (_) {
                    modalWin.scrollTop = 0;
                }
            } else {
                modalWin.scrollTop = 0;
            }
        } else {
            modalWin.scrollTop = 0;
            requestAnimationFrame(() => {
                const mWin = document.querySelector('#productModal .modal-window');
                if (mWin && mWin.scrollTop > 0) {
                    mWin.scrollTop = 0;
                }
            });
        }
    }

    // Умная очистка URL от ?item=...
    const url = new URL(window.location);
    if (url.searchParams.has('item')) {
        url.searchParams.delete('item');
        window.history.replaceState(null, '', url.pathname + url.search);
    }
    
    // Загружаем вопросы
    if (sb) loadItemQuestions(item.id);

    // SEO JSON-LD разметка
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
        "image": (item.images && item.images.length > 0) ? item.images.at(0) : "",
        "description": cleanDesc || item.name,
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

    // Динамические OpenGraph теги
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
    window.setMetaTag = setMetaTag;

    let statusPrefix = item.status === 'sold' ? '🔴 SOLD | ' : (item.status === 'reserved' ? '🟡 RESERVED | ' : '🟢 ');
    let ogTitle = `${statusPrefix}NISHA: ${item.brand} - ${item.name}`;
    const formattedOgPrice = (typeof formatPrice === 'function') ? formatPrice(item.price) : `${item.price} грн.`;
    let ogDesc = `Размер: ${item.size} | Цена: ${formattedOgPrice} ${cleanDesc ? cleanDesc.slice(0, 150) : ''}`;
    let ogImage = (item.images && item.images.length > 0) ? item.images.at(0) : 'https://www.nisha-store.shop/icon-512.png';
    let ogUrl = `https://www.nisha-store.shop/?item=${encodeURIComponent(item.id)}`;

    setMetaTag('og:title', ogTitle);
    setMetaTag('og:description', ogDesc);
    setMetaTag('og:image', ogImage);
    setMetaTag('og:image:secure_url', ogImage);
    setMetaTag('og:image:width', '800');
    setMetaTag('og:image:height', '800');
    setMetaTag('og:url', ogUrl);
    setMetaTag('og:type', 'product');
    setMetaTag('twitter:title', ogTitle);
    setMetaTag('twitter:description', ogDesc);
    setMetaTag('twitter:image', ogImage);
    setMetaTag('twitter:url', ogUrl);
    setMetaTag('twitter:card', 'summary_large_image');
}
window.openProductModal = openProductModal;

function resetOpenGraphTags() {
    if (typeof window.setMetaTag !== 'function') return;
    window.setMetaTag('og:title', 'NISHA | Underground Store');
    window.setMetaTag('og:description', 'NISHA — винтажная одежда, обувь и аксессуары. Доставка Новой Почтой по всей Украине.');
    window.setMetaTag('og:image', 'https://www.nisha-store.shop/og-image.png');
    window.setMetaTag('og:image:secure_url', 'https://www.nisha-store.shop/og-image.png');
    window.setMetaTag('og:image:width', '1200');
    window.setMetaTag('og:image:height', '630');
    window.setMetaTag('og:url', 'https://www.nisha-store.shop/');
    window.setMetaTag('og:type', 'website');
    window.setMetaTag('twitter:title', 'NISHA | Underground Store');
    window.setMetaTag('twitter:description', 'NISHA — винтажная одежда, обувь и аксессуары. Доставка Новой Почтой по всей Украине.');
    window.setMetaTag('twitter:image', 'https://www.nisha-store.shop/og-image.png');
    window.setMetaTag('twitter:url', 'https://www.nisha-store.shop/');
    const schemaScript = document.getElementById('seo-schema');
    if (schemaScript) schemaScript.remove();
}
window.resetOpenGraphTags = resetOpenGraphTags;

// ==========================================
// 2. СЛАЙДЕР ФОТОГРАФИЙ И СВАЙП
// ==========================================

function moveSlide(step) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    currentSlide = (currentSlide + step + slides.length) % slides.length;
    updateSlider();
}
window.moveSlide = moveSlide;

function setSlide(index, animated = true) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    currentSlide = index;
    window.currentSlide = currentSlide;
    updateSlider(animated);

    // Предзагружаем следующее фото для непрерывного мгновенного свайпа
    const active = window.currentOpenedItem;
    if (active && active.images && active.images[index + 1]) {
        const nextUrl = toCDN(active.images[index + 1]);
        if (!nextUrl.endsWith('.mp4')) {
            const preImg = new Image();
            preImg.src = nextUrl;
        }
    }
}
window.setSlide = setSlide;

function updateSlider(animated = true) {
    const sliderWrapper = document.getElementById('sliderWrapper');
    if (!sliderWrapper) return;

    if (!animated && sliderWrapper.style) {
        sliderWrapper.style.transition = 'none';
    } else if (sliderWrapper.style) {
        sliderWrapper.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    }

    sliderWrapper.style.transform = `translateX(-${currentSlide * 100}%)`;

    if (!animated) {
        requestAnimationFrame(() => {
            if (sliderWrapper && sliderWrapper.style) {
                sliderWrapper.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            }
        });
    }
    
    const counter = document.getElementById('photoCounter');
    const total = document.querySelectorAll('.slide').length;
    
    if (counter) {
        counter.innerText = `${currentSlide + 1} / ${total}`;
    }

    const thumbs = document.querySelectorAll('.thumb');
    thumbs.forEach((t, i) => { 
        t.classList.toggle('active-thumb', i === currentSlide); 
    });

    // Умная пауза скрытых видео: воспроизводим только активный слайд
    const allSlides = Array.from(document.querySelectorAll('#sliderWrapper .slide'));
    allSlides.forEach((slide, idx) => {
        const vid = slide.querySelector('video.modal-video-player');
        if (vid) {
            if (idx === currentSlide) {
                vid.play().catch(() => {});
            } else {
                vid.pause();
            }
        }
    });
}
window.updateSlider = updateSlider;

// ==========================================
// 2.1. ПОЛНОЭКРАННЫЙ ЗУМ ФОТО ТОВАРА (PHOTOSWIPE)
// ==========================================

async function openProductPhotoZoom(targetSlideOrIndex) {
    if (typeof ensurePhotoSwipe === 'function') {
        await ensurePhotoSwipe();
    }
    if (!window.PhotoSwipeLightbox) return;

    const wrapper = document.getElementById('sliderWrapper');
    if (!wrapper) return;

    // Ищем только фото-слайды (ссылки), исключая видео-слайды
    const imageSlides = Array.from(wrapper.querySelectorAll('a.slide'));
    if (imageSlides.length === 0) return;

    let targetIndex = 0;
    if (typeof targetSlideOrIndex === 'number') {
        targetIndex = Math.max(0, Math.min(targetSlideOrIndex, imageSlides.length - 1));
    } else if (targetSlideOrIndex && typeof targetSlideOrIndex.closest === 'function') {
        const slideEl = targetSlideOrIndex.closest('a.slide');
        const foundIdx = imageSlides.indexOf(slideEl);
        if (foundIdx >= 0) targetIndex = foundIdx;
    } else {
        const allSlides = Array.from(wrapper.querySelectorAll('.slide'));
        const activeSlide = allSlides.at(window.currentSlide || 0);
        const foundIdx = imageSlides.indexOf(activeSlide);
        if (foundIdx >= 0) targetIndex = foundIdx;
    }

    // Собираем динамический dataSource с актуальными naturalWidth/Height и msrc
    const items = imageSlides.map(slide => {
        const img = slide.querySelector('img');
        const parsedW = Number.parseInt(slide.getAttribute('data-pswp-width') || (img && img.naturalWidth) || 0, 10);
        const parsedH = Number.parseInt(slide.getAttribute('data-pswp-height') || (img && img.naturalHeight) || 0, 10);
        const src = slide.href || slide.getAttribute('data-pswp-src') || (img && img.src);
        const msrc = (img && (img.currentSrc || img.src)) || src;
        return {
            src,
            msrc,
            width: parsedW > 0 ? parsedW : 1200,
            height: parsedH > 0 ? parsedH : 1200,
            element: slide
        };
    });

    // Сбрасываем CSS-зум со слайдов перед открытием модального просмотрщика
    imageSlides.forEach(s => s.classList.remove('zoomed-in'));

    if (window.pswpLightbox) {
        try { window.pswpLightbox.destroy(); } catch (err) {}
        window.pswpLightbox = null;
    }

    const lightbox = new window.PhotoSwipeLightbox({
        dataSource: items,
        showHideAnimationType: 'fade',
        zoomAnimationDuration: 200,
        bgOpacity: 0.9,
        closeOnVerticalDrag: true,
        wheelToZoom: true,
        pswpModule: window.PhotoSwipe || (() => import('photoswipe'))
    });

    const syncSliderIndex = () => {
        const currPswpIndex = lightbox.pswp && lightbox.pswp.currIndex;
        if (typeof currPswpIndex === 'number' && items[currPswpIndex] && items[currPswpIndex].element) {
            const allSlides = Array.from(wrapper.querySelectorAll('.slide'));
            const fullSliderIdx = allSlides.indexOf(items[currPswpIndex].element);
            if (fullSliderIdx >= 0 && typeof window.setSlide === 'function' && window.currentSlide !== fullSliderIdx) {
                window.setSlide(fullSliderIdx);
            }
        }
    };

    lightbox.on('change', syncSliderIndex);
    lightbox.on('close', syncSliderIndex);

    window.pswpLightbox = lightbox;
    lightbox.init();
    lightbox.loadAndOpen(targetIndex);
}
window.openProductPhotoZoom = openProductPhotoZoom;

function initSliderSwipe() {
    const sliderContainer = document.getElementById('sliderContainer');
    if (!sliderContainer) return;
    if (sliderContainer._swipeBound) return;
    sliderContainer._swipeBound = true;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    // Блокируем контекстное меню и случайное перетаскивание при долгом зажатии пальца
    sliderContainer.addEventListener('contextmenu', (e) => e.preventDefault());
    sliderContainer.addEventListener('dragstart', (e) => e.preventDefault());

    sliderContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchEndX = touchStartX;
        touchEndY = touchStartY;
        window._isSliderSwiping = false;
    }, { passive: true });

    sliderContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) return;
        touchEndX = e.touches[0].clientX;
        touchEndY = e.touches[0].clientY;
        const diffX = Math.abs(touchEndX - touchStartX);
        const diffY = Math.abs(touchEndY - touchStartY);

        if (diffX > 10) {
            window._isSliderSwiping = true;
        }

        // Если свайп идет по горизонтали — блокируем вертикальный скролл страницы
        if (diffX > 10 && diffX > diffY) {
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });

    sliderContainer.addEventListener('touchend', (e) => {
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;

        // Четкий горизонтальный свайп (порог 40px и преобладание горизонтали над вертикалью в 1.3 раза)
        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
            const slides = document.querySelectorAll('.slide');
            if (slides.length > 1) {
                if (diffX > 0) {
                    // Свайп влево -> следующее фото строго на 1 шаг
                    if (currentSlide < slides.length - 1) {
                        if (typeof triggerHaptic === 'function') triggerHaptic('light');
                        setSlide(currentSlide + 1);
                    }
                } else {
                    // Свайп вправо -> предыдущее фото строго на 1 шаг
                    if (currentSlide > 0) {
                        if (typeof triggerHaptic === 'function') triggerHaptic('light');
                        setSlide(currentSlide - 1);
                    }
                }
            }
        }

        setTimeout(() => {
            window._isSliderSwiping = false;
        }, 120);
    }, { passive: true });
}
window.initSliderSwipe = initSliderSwipe;

// ==========================================
// 3. ПОДЕЛИТЬСЯ ТОВАРОМ (SHARE)
// ==========================================

function shareItem() {
    const active = window.currentOpenedItem || currentOpenedItem;
    if (!active) return;
    
    const shareUrl = `https://www.nisha-store.shop/share/${active.id}`;
    const shareTitle = `NISHA | ${active.brand} - ${active.name}`;
    const shareText = `Зацени: ${active.brand} (${active.size}).`;

    const successMsg = typeof i18next !== 'undefined' ? i18next.t('messages.link_copied', {defaultValue: 'Ссылка скопирована!'}) : 'Ссылка скопирована!';

    if (typeof window.shareContent === 'function') {
        window.shareContent({
            title: shareTitle,
            text: shareText,
            url: shareUrl,
            fallbackMsg: successMsg
        });
    } else if (typeof window.copyToClipboard === 'function') {
        window.copyToClipboard(shareUrl, successMsg);
    }
}
window.shareItem = shareItem;

// ==========================================
// 4. ИСТОРИЯ ПРОСМОТРОВ (VIEWING HISTORY)
// ==========================================

function addToHistory(item) {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    let hist = store ? store.getJSON('nisha_history', []) : [];
    hist = hist.filter(i => i.id !== item.id);
    const img = getOptimizedImg(item, true) || ((item.images && item.images.length > 0) ? item.images.at(0) : '');
    
    hist.unshift({ 
        id: item.id, 
        name: item.name, 
        price: item.price, 
        old_price: item.old_price, 
        is_sale: item.is_sale, 
        img: img 
    });
    
    if (hist.length > 30) hist = hist.slice(0, 30); 
    
    if (store) store.setJSON('nisha_history', hist);
    renderHistory();
}
window.addToHistory = addToHistory;

function renderHistory() {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    let hist = store ? store.getJSON('nisha_history', []) : [];
    const container = document.getElementById('historyGrid');
    const section = document.getElementById('historySection');
    
    if(!container || !section) return;

    const catalog = getCatalog();
    if (catalog.length > 0) {
        const validHist = hist.filter(h => catalog.some(dbItem => dbItem.id === h.id));
        if (validHist.length !== hist.length) {
            hist = validHist;
            if (store) store.setJSON('nisha_history', hist);
        }
    }
    
    if(hist.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    if (typeof container.replaceChildren === 'function') container.replaceChildren();
    else container.innerHTML = '';
    
    const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
    const fragment = document.createDocumentFragment();
    const cardsForTilt = [];

    hist.forEach(h => {
        const realItem = catalog.find(i => i.id === h.id);
        const currentStatus = realItem ? realItem.status : 'available';

        if (hideUnavailable && currentStatus !== 'available') return;

        const optImg = realItem ? (getOptimizedImg(realItem, true) || toCDN(h.img)) : toCDN(h.img);
        const isVideo = optImg && optImg.endsWith('.mp4');
        const livePrice = realItem ? realItem.price : h.price;
        const liveOldPrice = realItem ? realItem.old_price : h.old_price;
        const liveIsSale = realItem ? !!realItem.is_sale : !!h.is_sale;
        const liveName = realItem && realItem.name ? realItem.name : h.name;
        const liveIsTop = !!(realItem && realItem.is_top === true && realItem.top_until && Date.parse(realItem.top_until) > Date.now());
        const liveIsHot = !!(realItem && (realItem.views_count || 0) >= 25);
        
        let finalPriceHTML = '';
        const curr = typeof getCurrency === 'function' ? getCurrency() : 'грн';
        const formattedHistoryPrice = (typeof formatPrice === 'function') ? formatPrice(livePrice) : `${livePrice} ${curr}`;
        if (liveIsSale && liveOldPrice) {
            const formattedOld = (typeof formatPrice === 'function') ? formatPrice(liveOldPrice) : `${liveOldPrice} ${curr}`;
            finalPriceHTML = `<span style="color:#4a704a; text-decoration:line-through; font-size:10px; margin-right:4px;">${formattedOld}</span>${formattedHistoryPrice}`;
        } else {
            finalPriceHTML = formattedHistoryPrice;
        }

        let statusOverlayHTML = '';
        let imageFilter = '';

        if (currentStatus === 'sold') {
            statusOverlayHTML = `<div class="sold-badge" style="font-size: 16px !important; letter-spacing: 2px !important; padding: 2px 10px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">SOLD</div>`;
            imageFilter = 'filter: grayscale(80%) brightness(0.5);'; 
        } else if (currentStatus === 'reserved') {
            statusOverlayHTML = `<div class="reserved-badge" style="font-size: 14px !important; letter-spacing: 1px !important; padding: 2px 5px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">RESERVED</div>`;
            imageFilter = 'filter: brightness(0.6);';
        }

        const card = document.createElement('div');
        card.className = `history-card`;
        card.setAttribute('data-action', 'open-product');
        card.setAttribute('data-id', h.id);
        
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
        if ((liveIsTop || liveIsSale || liveIsHot) && currentStatus === 'available') {
            const parts = [];
            const starSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-top:-1px; flex-shrink:0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            const chartSvg = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-top:-1px; flex-shrink:0;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
            if (liveIsTop) parts.push(`<span style="color: #cc00ff; display: inline-flex; align-items: center; gap: 2px;">${starSvg} TOP</span>`);
            if (liveIsSale) parts.push(`<span style="color: #cc0000; display: inline-flex; align-items: center;">% SALE</span>`);
            if (liveIsHot) parts.push(`<span style="color: #0044cc; display: inline-flex; align-items: center; gap: 2px;">${chartSvg} HOT</span>`);
            miniBadgeHTML = `<div class="system-status-bar history-status-bar" style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; display: flex; align-items: center; gap: 4px; padding: 1.5px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none; line-height: 1; transform: translateZ(25px);">${parts.join('<div style="width:1px;height:8px;background:#888;flex-shrink:0;"></div>')}</div>`;
        }

        card.innerHTML = `
            <div class="history-img" style="position: relative; overflow: hidden; padding: 0; background: #111;">
                ${mediaHTML}
                ${miniBadgeHTML}
                ${statusOverlayHTML}
                <button type="button" class="close-btn history-item-remove" data-action="remove-history-item" data-id="${typeof window.escapeAttr==='function'?window.escapeAttr(h.id):h.id}" title="${typeof i18next !== 'undefined' ? i18next.t('history.remove_item', { defaultValue: 'Удалить' }) : 'Удалить'}" aria-label="${typeof i18next !== 'undefined' ? i18next.t('history.remove_item', { defaultValue: 'Удалить' }) : 'Удалить'}" style="z-index: 20;">X</button>
            </div>
            <div class="history-info">
                <div class="history-name" title="${typeof window.escapeAttr==='function'?window.escapeAttr(liveName):liveName}" style="${currentStatus !== 'available' ? 'color:#888; text-decoration:line-through;' : ''}">${typeof window.escapeHtml==='function'?window.escapeHtml(liveName):liveName}</div>
                <div class="history-price">${finalPriceHTML}</div>
            </div>`;
            
        fragment.appendChild(card);

        if (window.innerWidth > 900) {
            cardsForTilt.push(card);
        }
    });

    container.appendChild(fragment);

    if (cardsForTilt.length > 0) {
        const TiltLib = (typeof window !== 'undefined' && window.VanillaTilt) || (typeof VanillaTilt !== 'undefined' ? VanillaTilt : null);
        if (TiltLib && typeof TiltLib.init === 'function') {
            TiltLib.init(cardsForTilt, { max: 15, speed: 300, scale: 1.05 });
        } else {
            import('vanilla-tilt').then((mod) => {
                const Tilt = mod.default || mod;
                if (Tilt && typeof Tilt.init === 'function') {
                    window.VanillaTilt = Tilt;
                    Tilt.init(cardsForTilt, { max: 15, speed: 300, scale: 1.05 });
                }
            }).catch(() => {
                if (typeof loadExternalScript === 'function') {
                    loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.1/vanilla-tilt.min.js').then(() => {
                        if (typeof VanillaTilt !== 'undefined') {
                            VanillaTilt.init(cardsForTilt, { max: 15, speed: 300, scale: 1.05 });
                        }
                    }).catch(() => {});
                }
            });
        }
    }

    const currentUser = getUser();
    const sb = getSupabase();
    if (currentUser && sb) {
        sb.from('profiles').update({ viewed_history: hist.map(h => h.id) }).eq('id', currentUser.id).then();
    }
}
window.renderHistory = renderHistory;

function toggleHistory() {
    const grid = document.getElementById('historyGrid');
    const arrow = document.getElementById('historyArrow');
    if (!grid) return;
    
    grid.classList.toggle('collapsed');
    
    if (arrow) {
        if (grid.classList.contains('collapsed')) {
            arrow.style.transform = 'rotate(-90deg)';
        } else {
            arrow.style.transform = 'rotate(0deg)';
        }
    }
}
window.toggleHistory = toggleHistory;

function removeHistoryItem(event, itemId) {
    if (event) event.stopPropagation(); 
    
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    let hist = store ? store.getJSON('nisha_history', []) : [];
    hist = hist.filter(item => item.id !== itemId);
    if (store) store.setJSON('nisha_history', hist);
    
    const currentUser = getUser();
    const sb = getSupabase();
    if (currentUser && sb) {
        sb.from('profiles').update({ 
            viewed_history: hist.map(h => h.id) 
        }).eq('id', currentUser.id).then();
    }
    
    renderHistory(); 
}
window.removeHistoryItem = removeHistoryItem;

// ==========================================
// 5. ВОПРОСЫ И ОТВЕТЫ (Q&A SYSTEM)
// ==========================================

function toggleQuestionForm() {
    const container = document.getElementById('questionFormContainer');
    if (!container) return;
    
    if (container.style.maxHeight === '0px' || container.style.maxHeight === '') {
        container.style.maxHeight = '100px';
        setTimeout(() => {
            const input = document.getElementById('questionInput');
            if (input) input.focus();
        }, 100);
    } else {
        container.style.maxHeight = '0px';
    }
}
window.toggleQuestionForm = toggleQuestionForm;

async function submitQuestion(itemId) {
    const currentUser = getUser();
    if (!currentUser) {
        const authMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_err_auth')) || 'Для отправки вопроса нужно войти в аккаунт!';
        showToast(authMsg, 'error');
        if (typeof openProfileModal === 'function') openProfileModal();
        return;
    }

    const input = document.getElementById('questionInput');
    if (!input) return;
    let text = input.value.trim();
    if (text.length < 5) {
        const shortMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_err_short')) || 'Вопрос слишком короткий!';
        showToast(shortMsg, 'error');
        return;
    }
    if (text.length > 100) {
        text = text.slice(0, 100);
    }

    const today = new Date().toISOString().slice(0, 10);
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    let questionData = store ? store.getJSON('nisha_questions', { date: '', count: 0 }) : { date: '', count: 0 };
    
    if (questionData.date !== today) questionData = { date: today, count: 0 };
    if (questionData.count >= 2) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const limitMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_err_limit')) || 'Лимит: 2 вопроса в день.';
        return showToast(limitMsg, 'error');
    }

    let itemName = "Товар";
    const active = window.currentOpenedItem || currentOpenedItem;
    if (active && active.id === itemId) {
        itemName = active.name;
    }

    try {
        const data = await window.apiClient.post('/api/question', {
            userId: currentUser.id,
            email: currentUser.email || 'Неизвестно',
            itemId: itemId,
            itemName: itemName,
            questionText: text
        }, { timeout: 12000, retries: 1 });

        if (data && data.success) {
            questionData.count += 1;
            if (store) store.setJSON('nisha_questions', questionData);
            input.value = '';
            toggleQuestionForm(); 
            const sentMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_success')) || 'Вопрос отправлен!';
            showToast(sentMsg, 'success');
        } else {
            const sendErrMsg = (typeof i18next !== 'undefined' && i18next.t('product.qa_err_send')) || 'Ошибка при отправке вопроса.';
            showToast(sendErrMsg, 'error');
        }
    } catch (err) {
        const connErrMsg = (typeof i18next !== 'undefined' && i18next.t('propose.err_network')) || 'Ошибка соединения с сервером.';
        showToast(connErrMsg, 'error');
    }
}
window.submitQuestion = submitQuestion;

async function loadItemQuestions(itemId) {
    const sb = getSupabase();
    if (!sb) return;
    
    const { data } = await sb.from('item_questions').select('question, answer, user_name, created_at').eq('item_id', itemId).order('created_at', { ascending: true });
    
    const wrapper = document.getElementById('qaWrapper');
    const list = document.getElementById('qaList');
    
    if (data && data.length > 0 && wrapper && list) {
        wrapper.style.display = 'block';
        if (typeof list.replaceChildren === 'function') list.replaceChildren();
        else list.innerHTML = '';
        let listHtml = '';
        data.forEach(q => {
            const sanitize = (typeof window.sanitizeText === 'function') ? window.sanitizeText : (s) => String(s || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
            const safeQ = sanitize(q.question);
            const safeA = q.answer ? sanitize(q.answer) : null;
            const safeU = sanitize(q.user_name);

            let answerHtml = safeA ? `<div style="color: var(--accent-green); font-size: 12px; font-weight: bold; margin-top: 4px;">↳ NISHA: ${safeA}</div>` : '';
            listHtml += `
                <div style="border-left: 2px solid #333; padding-left: 10px; margin-bottom: 12px; font-family: var(--font-main);">
                    <span style="color:#888; font-size:11px; font-family:var(--font-mono);">@${safeU}:</span>
                    <div style="color:#ddd; font-size:13px; margin-top:2px;">${safeQ}</div>
                    ${answerHtml}
                </div>`;
        });
        list.innerHTML = listHtml;
    } else if (wrapper) {
        wrapper.style.display = 'none';
    }
}
window.loadItemQuestions = loadItemQuestions;

// ==========================================
// 6. ДОПОЛНИТЕЛЬНЫЕ ЭЛЕМЕНТЫ МОДАЛКИ (ИЗБРАННОЕ, АККОРДЕОНЫ)
// ==========================================

async function toggleFavFromModal(event) {
    const active = window.currentOpenedItem || currentOpenedItem;
    if (!active) return;
    
    // Снимаем фокус с телефона, чтобы не залипало
    const modalStar = document.getElementById('modalFavStar');
    if (modalStar) modalStar.blur();

    // Вызываем главную функцию избранного
    if (typeof window.toggleFav === 'function') {
        await window.toggleFav(event, active.id);
    } else if (typeof toggleFav === 'function') {
        await toggleFav(event, active.id);
    }
}
window.toggleFavFromModal = toggleFavFromModal;

function toggleAccordion(element) {
    if (!element) return;
    const parent = element.parentElement; // Получаем блок .custom-details
    if (!parent) return;
    const isOpen = parent.classList.contains('open');
    
    document.querySelectorAll('.custom-details').forEach(el => el.classList.remove('open'));
    
    if (!isOpen) {
        parent.classList.add('open');
    }
}
window.toggleAccordion = toggleAccordion;

function toggleQASection(btn) {
    const wrap = document.getElementById('qaCollapseWrapper');
    const list = document.getElementById('qaList');
    let isCollapsed = false;
    if (wrap) {
        isCollapsed = wrap.classList.toggle('collapsed');
    } else if (list) {
        isCollapsed = list.classList.toggle('collapsed');
    }
    const arrow = btn ? btn.querySelector('.qa-arrow') : document.querySelector('#qaWrapper .qa-arrow');
    if (arrow) {
        arrow.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
}
window.toggleQASection = toggleQASection;

// Подписка на обновление вопросов в реальном времени
function initProductQASubscription() {
    if (window._productQaSubInitialized) return;
    const sb = typeof getSupabase === 'function' ? getSupabase() : (typeof window !== 'undefined' && typeof window.getSupabase === 'function' ? window.getSupabase() : null);
    if (sb && typeof sb.channel === 'function') {
        window._productQaSubInitialized = true;
        sb.channel('public-qa-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'item_questions' }, payload => {
                const active = window.currentOpenedItem || currentOpenedItem;
                if (active && payload.new && payload.new.item_id === active.id) {
                    window.loadItemQuestions(active.id);
                }
            })
            .subscribe();
    }
}
window.initProductQASubscription = initProductQASubscription;


// Автоматическая инициализация слайдера и Q&A подписки при загрузке документа
function initProductModule() {
    initSliderSwipe();
    initProductQASubscription();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductModule);
} else {
    initProductModule();
}


// ==========================================
// СИСТЕМА ТОРГА (ПРЕДЛОЖЕНИЕ СВОЕЙ ЦЕНЫ)
// ==========================================
// --- ОПРЕДЕЛЕНИЕ ЛУЧШЕГО КОНТАКТА ПОКУПАТЕЛЯ ДЛЯ ТОРГА (TELEGRAM -> ТЕЛЕФОН -> EMAIL) ---
function getBestBuyerContact() {
    // 1. Telegram username из Telegram WebApp (если сайт открыт в боте)
    try {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (tgUser && tgUser.username) {
            return '@' + tgUser.username.replace(/^@/, '');
        }
    } catch (e) {}

    // 2. Telegram username из профиля / хранилища
    try {
        const profile = window.userProfile || null;
        const currentUser = (typeof getUser === 'function') ? getUser() : (window.currentUser || null);
        const tgCandidate = (profile && (profile.tg || profile.telegram || profile.username)) ||
                            (currentUser && currentUser.user_metadata && (currentUser.user_metadata.telegram || currentUser.user_metadata.tg || currentUser.user_metadata.user_name)) ||
                            localStorage.getItem('nisha_last_tg') ||
                            localStorage.getItem('user_tg');
        if (tgCandidate && typeof tgCandidate === 'string' && tgCandidate.trim()) {
            const cleanTg = tgCandidate.trim().replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '');
            if (cleanTg && !cleanTg.includes('@')) return '@' + cleanTg;
        }
    } catch (e) {}

    // 3. Номер телефона (из профиля или последнего заказа/чекаута)
    try {
        const profile = window.userProfile || null;
        const currentUser = (typeof getUser === 'function') ? getUser() : (window.currentUser || null);
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        const phoneCandidate = (profile && profile.phone) ||
                               (currentUser && (currentUser.phone || (currentUser.user_metadata && currentUser.user_metadata.phone))) ||
                               (store && store.get && (store.get('nisha_last_phone') || store.get('user_phone'))) ||
                               localStorage.getItem('nisha_last_phone') ||
                               localStorage.getItem('user_phone');
        if (phoneCandidate && typeof phoneCandidate === 'string' && phoneCandidate.trim()) {
            return phoneCandidate.trim();
        }
    } catch (e) {}

    // 4. Только если нет ни Telegram, ни телефона — email
    try {
        const currentUser = (typeof getUser === 'function') ? getUser() : (window.currentUser || null);
        if (currentUser && currentUser.email) return currentUser.email.trim();
        const lastEmail = localStorage.getItem('nisha_last_email');
        if (lastEmail) return lastEmail.trim();
    } catch (e) {}

    return '';
}
window.getBestBuyerContact = getBestBuyerContact;


// --- КЛИЕНТСКИЙ RATE LIMIT ДЛЯ ТОРГА (МАКСИМУМ 2 ОФФЕРА В 10 МИНУТ) ---
const BARGAIN_RATE_LIMIT_STORAGE_KEY = 'nisha_bargain_offers_history';
const BARGAIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const BARGAIN_RATE_LIMIT_MAX = 2;

function checkClientBargainRateLimit() {
    try {
        const raw = localStorage.getItem(BARGAIN_RATE_LIMIT_STORAGE_KEY);
        if (!raw) return { allowed: true };
        const history = JSON.parse(raw);
        if (!Array.isArray(history)) return { allowed: true };

        const now = Date.now();
        const validTimestamps = history.filter(ts => typeof ts === 'number' && (now - ts) < BARGAIN_RATE_LIMIT_WINDOW_MS);
        if (validTimestamps.length >= BARGAIN_RATE_LIMIT_MAX) {
            const oldest = Math.min(...validTimestamps);
            const remainingMs = Math.max(0, BARGAIN_RATE_LIMIT_WINDOW_MS - (now - oldest));
            const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
            return { allowed: false, remainingMin };
        }
        return { allowed: true };
    } catch (e) {
        return { allowed: true };
    }
}

function recordClientBargainOffer() {
    try {
        const raw = localStorage.getItem(BARGAIN_RATE_LIMIT_STORAGE_KEY);
        const history = raw ? JSON.parse(raw) : [];
        const now = Date.now();
        const validTimestamps = Array.isArray(history)
            ? history.filter(ts => typeof ts === 'number' && (now - ts) < BARGAIN_RATE_LIMIT_WINDOW_MS)
            : [];
        validTimestamps.push(now);
        localStorage.setItem(BARGAIN_RATE_LIMIT_STORAGE_KEY, JSON.stringify(validTimestamps));
    } catch (e) {}
}
window.checkClientBargainRateLimit = checkClientBargainRateLimit;
window.recordClientBargainOffer = recordClientBargainOffer;

function openOfferPriceModal() {
    const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    if (!activeItem) return;

    const rateCheck = checkClientBargainRateLimit();
    if (!rateCheck.allowed) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const limitMsg = ((typeof i18next !== 'undefined' && i18next.t('product.offer_rate_limit')) || 'Максимум 2 пропозиції за 10 хвилин. Будь ласка, зачекайте ще {{min}} хв.').replace('{{min}}', rateCheck.remainingMin);
        return showToast(limitMsg, 'error');
    }

    const modal = document.getElementById('bargainModal');
    if (!modal) return;

    const thumbEl = document.getElementById('bargainItemThumb');
    const nameEl = document.getElementById('bargainItemName');
    const priceEl = document.getElementById('bargainItemPrice');
    const priceInput = document.getElementById('bargainPriceInput');
    const contactInput = document.getElementById('bargainContactInput');
    const submitBtn = document.getElementById('bargainSubmitBtn');

    const firstImg = (Array.isArray(activeItem.images) && activeItem.images[0]) ||
                     (Array.isArray(activeItem.thumbnails) && activeItem.thumbnails[0]) ||
                     (typeof getOptimizedImg === 'function' ? getOptimizedImg(activeItem) : '') || '';

    if (thumbEl) {
        thumbEl.src = firstImg;
        thumbEl.alt = activeItem.name || 'Товар';
    }
    if (nameEl) nameEl.innerText = activeItem.name || 'Товар';
    if (priceEl) priceEl.innerText = `${activeItem.price || 0} грн`;

    if (priceInput) {
        priceInput.value = '';
        const suggestedOffer = Math.max(1, Math.round((activeItem.price || 1000) * 0.85));
        priceInput.placeholder = String(suggestedOffer);
    }

    if (contactInput) {
        contactInput.value = getBestBuyerContact();
    }

    if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = (typeof i18next !== 'undefined' && i18next.t('product.offer_send_btn')) || '[ НАДІСЛАТИ ПРОПОЗИЦІЮ ]';
        submitBtn.innerText = btnText;
    }

    if (typeof openModal === 'function') {
        openModal('bargainModal');
    } else {
        modal.style.display = 'flex';
    }

    setTimeout(() => {
        if (priceInput) priceInput.focus();
    }, 150);
}
window.openOfferPriceModal = openOfferPriceModal;

let isSubmittingBargainOffer = false;

async function submitBargainOffer() {
    if (isSubmittingBargainOffer) return;
    const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    if (!activeItem) return;

    const priceInput = document.getElementById('bargainPriceInput');
    const contactInput = document.getElementById('bargainContactInput');
    const submitBtn = document.getElementById('bargainSubmitBtn');

    const offeredPrice = priceInput ? Number.parseInt(priceInput.value, 10) : 0;
    const currentPrice = Number(activeItem.price) || 0;

    const rateCheck = checkClientBargainRateLimit();
    if (!rateCheck.allowed) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const limitMsg = ((typeof i18next !== 'undefined' && i18next.t('product.offer_rate_limit')) || 'Максимум 2 пропозиції за 10 хвилин. Будь ласка, зачекайте ще {{min}} хв.').replace('{{min}}', rateCheck.remainingMin);
        return showToast(limitMsg, 'error');
    }

    if (!offeredPrice || Number.isNaN(offeredPrice) || offeredPrice < 100 || offeredPrice >= currentPrice) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const invalidMsg = (offeredPrice > 0 && offeredPrice < 100)
            ? ((typeof i18next !== 'undefined' && i18next.t('product.offer_min_100')) || 'Мінімальна ціна для пропозиції: 100 грн!')
            : ((typeof i18next !== 'undefined' && i18next.t('product.offer_invalid_price')) || 'Будь ласка, вкажіть реальну ціну нижче поточної!');
        return showToast(invalidMsg, 'error');
    }

    const descMatch = (typeof activeItem.description === 'string') && activeItem.description.match(/\[ТОРГ:?\s*(?:(?:від|от)\s*)?(\d+)/i);
    const itemMinBargain = activeItem.min_bargain_price || (descMatch ? Number.parseInt(descMatch[1], 10) : null);
    const hasBargain = Boolean(activeItem.is_bargain || itemMinBargain || (typeof activeItem.description === 'string' && /\[ТОРГ/i.test(activeItem.description)));
    if (!hasBargain) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const disabledMsg = ((typeof i18next !== 'undefined' && i18next.t('product.offer_disabled')) || 'Для цього товару торг не передбачено!');
        return showToast(disabledMsg, 'error');
    }
    if (itemMinBargain && offeredPrice < itemMinBargain) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const minMsg = ((typeof i18next !== 'undefined' && i18next.t('product.offer_below_min')) || 'Мінімальна ціна для пропозиції: {{min}} грн!').replace('{{min}}', itemMinBargain);
        return showToast(minMsg, 'error');
    }

    const contact = contactInput ? contactInput.value.trim() : '';
    const fingerprint = window.clientFingerprint || (typeof clientFingerprint !== 'undefined' ? clientFingerprint : ('guest_' + Date.now()));
    const firstImg = (Array.isArray(activeItem.images) && activeItem.images[0]) ||
                     (Array.isArray(activeItem.thumbnails) && activeItem.thumbnails[0]) ||
                     (typeof getOptimizedImg === 'function' ? getOptimizedImg(activeItem) : '') || '';

    isSubmittingBargainOffer = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="inline-btn-spinner" aria-hidden="true" style="margin-right:8px"></span>' + ((typeof i18next !== 'undefined' && i18next.t('product.offer_sending')) || '[ ВІДПРАВКА... ]');
    }

    try {
        const currentUid = (window.currentUser && window.currentUser.id) ? String(window.currentUser.id) : null;
        const payload = {
            itemId: String(activeItem.id),
            itemName: activeItem.name || '',
            itemImage: firstImg,
            currentPrice: currentPrice,
            offeredPrice: offeredPrice,
            contact: contact,
            clientId: String(fingerprint),
            userId: currentUid
        };

        let bargainResponse = null;
        if (window.apiClient && typeof window.apiClient.post === 'function') {
            bargainResponse = await window.apiClient.post('/api/bargain', payload, {
                timeout: 15000,
                retries: 0,
                throwOnHttpError: true
            });
        }
        if (bargainResponse && bargainResponse.success === false) {
            throw new Error(bargainResponse.message || 'Ошибка отправки предложения');
        }
        recordClientBargainOffer();
        try {
            const pData = { itemId: String(activeItem.id), offeredPrice: offeredPrice, timestamp: Date.now() };
            sessionStorage.setItem('pending_bargain_' + activeItem.id, JSON.stringify(pData));
            localStorage.setItem('pending_bargain_' + activeItem.id, JSON.stringify(pData));
        } catch (e) {}
        const modalBtn = document.getElementById('modalOfferPriceBtn');
        if (modalBtn) {
            const pendingText = (typeof i18next !== 'undefined') ? i18next.t('product.offer_pending', { defaultValue: '[ ПРОПОЗИЦІЮ НАДІСЛАНО ✓ ]' }) : '[ ПРОПОЗИЦІЮ НАДІСЛАНО ✓ ]';
            modalBtn.innerText = pendingText;
            modalBtn.style.borderColor = 'var(--accent-green, #00ff66)';
            modalBtn.style.color = 'var(--accent-green, #00ff66)';
            modalBtn.style.pointerEvents = 'none';
            modalBtn.style.cursor = 'default';
            modalBtn.disabled = true;
        }

        if (typeof triggerHaptic === 'function') triggerHaptic('success');
        const sentMsg = (typeof i18next !== 'undefined' && i18next.t('product.offer_sent_toast')) || 'Пропозицію надіслано! Очікуйте відповіді продавця.';
        showToast(sentMsg, 'success');

        if (typeof closeModal === 'function') {
            closeModal('bargainModal');
        } else {
            const m = document.getElementById('bargainModal');
            if (m) m.style.display = 'none';
        }
    } catch (err) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const serverMsg = err.response?.data?.message || err.data?.message || err.message;
        const isSafeServerMsg = serverMsg && typeof serverMsg === 'string' && !serverMsg.includes('status code') && !serverMsg.includes('fetch') && !serverMsg.includes('Network');
        const errMsg = isSafeServerMsg ? serverMsg : ((typeof i18next !== 'undefined' && i18next.t('propose.err_network')) || 'Помилка зв\'язку з сервером.');
        showToast(errMsg, 'error');
    } finally {
        isSubmittingBargainOffer = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = (typeof i18next !== 'undefined' && i18next.t('product.offer_send_btn')) || '[ НАДІСЛАТИ ПРОПОЗИЦІЮ ]';
        }
    }
}
window.submitBargainOffer = submitBargainOffer;


// ==========================================
// ИНЛАЙН СИСТЕМА ТОРГА (ПРЯМО В КАРТОЧКЕ)
// ==========================================
function showInlineOfferPriceInput() {
    const btn = document.getElementById('modalOfferPriceBtn');
    const row = document.getElementById('offerPriceInputRow');
    const input = document.getElementById('inlineBargainPriceInput');
    const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    if (!activeItem || !btn || !row || !input) return;

    try {
        const sId = String(activeItem.id);
        if (sessionStorage.getItem('declined_bargain_' + sId) || localStorage.getItem('declined_bargain_' + sId)) return;
        const saved = sessionStorage.getItem('accepted_bargain_' + sId) || localStorage.getItem('accepted_bargain_' + sId);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.acceptedPrice) return;
        }
        const pending = sessionStorage.getItem('pending_bargain_' + sId) || localStorage.getItem('pending_bargain_' + sId);
        if (pending) {
            const parsedPend = JSON.parse(pending);
            if (parsedPend && (Date.now() - (parsedPend.timestamp || 0) < 24 * 60 * 60 * 1000)) return;
        }
    } catch (e) {}

    const suggested = Math.max(1, Math.round((activeItem.price || 1000) * 0.85));
    const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;

    const rateCheck = checkClientBargainRateLimit();
    if (!rateCheck.allowed) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const limitMsg = t('product.offer_rate_limit', 'Максимум 2 пропозиції за 10 хвилин. Будь ласка, зачекайте ще {{min}} хв.').replace('{{min}}', rateCheck.remainingMin);
        showToast(limitMsg, 'error');
        return;
    }
    const phText = t('product.offer_your_price_ph', `Наприклад, ${suggested}`);
    input.placeholder = phText;
    input.value = '';

    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    btn.style.opacity = '0';
    btn.style.transform = 'translateY(-4px)';
    btn.style.pointerEvents = 'none';

    setTimeout(() => {
        btn.style.display = 'none';
        row.style.display = 'flex';
        row.style.opacity = '0';
        row.style.transform = 'translateY(4px)';
        void row.offsetWidth;
        row.classList.add('visible');
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
        input.focus();
    }, 110);
}
window.showInlineOfferPriceInput = showInlineOfferPriceInput;

function hideInlineOfferPriceInput() {
    const btn = document.getElementById('modalOfferPriceBtn');
    const row = document.getElementById('offerPriceInputRow');
    const input = document.getElementById('inlineBargainPriceInput');
    if (!btn || !row) return;

    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    row.classList.remove('visible');
    row.style.opacity = '0';
    row.style.transform = 'translateY(4px)';

    setTimeout(() => {
        row.style.display = 'none';
        btn.style.display = 'flex';
        btn.style.opacity = '0';
        btn.style.transform = 'translateY(-4px)';
        void btn.offsetWidth;
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
        btn.style.pointerEvents = btn.disabled ? 'none' : 'auto';
        if (input) input.value = '';
    }, 110);
}
window.hideInlineOfferPriceInput = hideInlineOfferPriceInput;

async function submitInlineBargainOffer() {
    if (isSubmittingBargainOffer) return;
    const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    if (!activeItem) return;

    const input = document.getElementById('inlineBargainPriceInput');
    const submitBtn = document.getElementById('inlineBargainSubmitBtn');
    if (!input || !submitBtn) return;

    const offeredPrice = Number.parseInt(input.value, 10);
    const currentPrice = Number(activeItem.price) || 0;

    const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;

    const rateCheck = checkClientBargainRateLimit();
    if (!rateCheck.allowed) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const limitMsg = t('product.offer_rate_limit', 'Максимум 2 пропозиції за 10 хвилин. Будь ласка, зачекайте ще {{min}} хв.').replace('{{min}}', rateCheck.remainingMin);
        showToast(limitMsg, 'error');
        return;
    }

    if (!offeredPrice || Number.isNaN(offeredPrice) || offeredPrice < 100 || offeredPrice >= currentPrice) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const invalidMsg = (offeredPrice > 0 && offeredPrice < 100)
            ? t('product.offer_min_100', 'Мінімальна ціна для пропозиції: 100 грн!')
            : t('product.offer_invalid_price', 'Будь ласка, вкажіть реальну ціну нижче поточної!');
        showToast(invalidMsg, 'error');
        input.focus();
        return;
    }

    const descMatch = (typeof activeItem.description === 'string') && activeItem.description.match(/\[ТОРГ:?\s*(?:(?:від|от)\s*)?(\d+)/i);
    const itemMinBargain = activeItem.min_bargain_price || (descMatch ? Number.parseInt(descMatch[1], 10) : null);
    const hasBargain = Boolean(activeItem.is_bargain || itemMinBargain || (typeof activeItem.description === 'string' && /\[ТОРГ/i.test(activeItem.description)));
    if (!hasBargain) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const disabledMsg = t('product.offer_disabled', 'Для цього товару торг не передбачено!');
        showToast(disabledMsg, 'error');
        return;
    }
    if (itemMinBargain && offeredPrice < itemMinBargain) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const minMsg = t('product.offer_below_min', 'Мінімальна ціна для пропозиції: {{min}} грн!').replace('{{min}}', itemMinBargain);
        showToast(minMsg, 'error');
        input.focus();
        return;
    }

    const fingerprint = window.clientFingerprint || (typeof clientFingerprint !== 'undefined' ? clientFingerprint : ('guest_' + Date.now()));
    const savedContact = getBestBuyerContact();

    const firstImg = (Array.isArray(activeItem.images) && activeItem.images[0]) ||
                     (Array.isArray(activeItem.thumbnails) && activeItem.thumbnails[0]) ||
                     (typeof getOptimizedImg === 'function' ? getOptimizedImg(activeItem) : '') || '';

    isSubmittingBargainOffer = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('sending');
    if (input) input.disabled = true;
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="inline-btn-spinner" aria-hidden="true"></span>';
    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    try {
        const currentUid = (window.currentUser && window.currentUser.id) ? String(window.currentUser.id) : null;
        const payload = {
            itemId: String(activeItem.id),
            itemName: activeItem.name || '',
            itemImage: firstImg,
            currentPrice: currentPrice,
            offeredPrice: offeredPrice,
            contact: savedContact,
            clientId: String(fingerprint),
            userId: currentUid
        };

        let bargainResponse = null;
        if (window.apiClient && typeof window.apiClient.post === 'function') {
            bargainResponse = await window.apiClient.post('/api/bargain', payload, {
                timeout: 15000,
                retries: 0,
                throwOnHttpError: true
            });
        }
        if (bargainResponse && bargainResponse.success === false) {
            throw new Error(bargainResponse.message || 'Ошибка отправки предложения');
        }
        recordClientBargainOffer();

        if (typeof triggerHaptic === 'function') triggerHaptic('success');

        // Плавная индикация успешной отправки с галочкой перед закрытием поля
        submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green, #00ff66)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        submitBtn.style.borderColor = 'var(--accent-green, #00ff66)';

        await new Promise(r => setTimeout(r, 220));

        const sentMsg = t('product.offer_sent_toast', 'Пропозицію надіслано! Очікуйте відповіді продавця.');
        showToast(sentMsg, 'success');

        hideInlineOfferPriceInput();
        try {
            const pData = { itemId: String(activeItem.id), offeredPrice: offeredPrice, timestamp: Date.now() };
            sessionStorage.setItem('pending_bargain_' + activeItem.id, JSON.stringify(pData));
            localStorage.setItem('pending_bargain_' + activeItem.id, JSON.stringify(pData));
        } catch (e) {}
        const btn = document.getElementById('modalOfferPriceBtn');
        if (btn) {
            btn.innerText = t('product.offer_pending', '[ ПРОПОЗИЦІЮ НАДІСЛАНО ✓ ]');
            btn.style.borderColor = 'var(--accent-green, #00ff66)';
            btn.style.color = 'var(--accent-green, #00ff66)';
            btn.style.pointerEvents = 'none';
            btn.style.cursor = 'default';
            btn.style.boxShadow = 'none';
            btn.disabled = true;
        }
    } catch (err) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const serverMsg = err.response?.data?.message || err.data?.message || err.message;
        const isSafeServerMsg = serverMsg && typeof serverMsg === 'string' && !serverMsg.includes('status code') && !serverMsg.includes('fetch') && !serverMsg.includes('Network');
        const errMsg = isSafeServerMsg ? serverMsg : t('propose.err_network', 'Помилка зв\'язку з сервером.');
        showToast(errMsg, 'error');
    } finally {
        isSubmittingBargainOffer = false;
        submitBtn.disabled = false;
        if (input) input.disabled = false;
        submitBtn.classList.remove('sending');
        submitBtn.innerHTML = originalBtnHtml;
        submitBtn.style.borderColor = '';
    }
}
window.submitInlineBargainOffer = submitInlineBargainOffer;

// Обработка Enter и Escape в инлайн-поле торга
document.addEventListener('keydown', (e) => {
    const input = document.getElementById('inlineBargainPriceInput');
    const row = document.getElementById('offerPriceInputRow');
    if (!row || row.style.display === 'none') return;

    if (e.key === 'Escape') {
        e.preventDefault();
        hideInlineOfferPriceInput();
    } else if (e.key === 'Enter' && (document.activeElement === input || e.target === input)) {
        e.preventDefault();
        submitInlineBargainOffer();
    }
});


// ==========================================
// КРОСС-ДЕВАЙС СИНХРОНИЗАЦИЯ ТОРГА (PC <-> MOBILE)
// ==========================================
async function syncUserBargains() {
    try {
        const fp = window.clientFingerprint || (typeof clientFingerprint !== 'undefined' ? clientFingerprint : '');
        const uid = (window.currentUser && window.currentUser.id) ? String(window.currentUser.id) : '';
        if (!fp && !uid) return;

        const params = new URLSearchParams();
        if (fp) params.append('clientId', fp);
        if (uid) params.append('userId', uid);

        let bargains = null;
        if (window.apiClient && typeof window.apiClient.get === 'function') {
            try {
                const res = await window.apiClient.get(`/api/bargains/active?${params.toString()}`);
                bargains = res?.data?.bargains || res?.bargains || [];
            } catch (apiErr) {
                // fallback to fetch if apiClient network error
            }
        }
        if (bargains === null) {
            try {
                const backendUrl = (window.apiClient && typeof window.apiClient.getBaseUrl === 'function')
                    ? window.apiClient.getBaseUrl()
                    : ((window.ENV && window.ENV.API_BASE_URL) || window.BACKEND_URL || 'https://nisha-api.onrender.com');
                const res = await fetch(`${backendUrl}/api/bargains/active?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    bargains = data?.bargains || [];
                }
            } catch (fErr) {}
        }

        if (Array.isArray(bargains) && bargains.length > 0) {
            const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;
            let cartUpdated = false;
            const activeCart = (typeof window.getActiveCart === 'function') ? window.getActiveCart() : ((typeof getActiveCart === 'function') ? getActiveCart() : null);

            bargains.forEach(b => {
                if (!b || !b.itemId) return;

                if (b.status === 'pending' || (!b.acceptedPrice && b.offeredPrice)) {
                    try {
                        const hasAccepted = localStorage.getItem('accepted_bargain_' + b.itemId) || sessionStorage.getItem('accepted_bargain_' + b.itemId);
                        const hasDeclined = localStorage.getItem('declined_bargain_' + b.itemId) || sessionStorage.getItem('declined_bargain_' + b.itemId);
                        if (!hasAccepted && !hasDeclined) {
                            const pData = {
                                itemId: String(b.itemId),
                                offeredPrice: b.offeredPrice,
                                timestamp: b.timestamp ? Date.parse(b.timestamp) || Date.now() : Date.now()
                            };
                            localStorage.setItem('pending_bargain_' + b.itemId, JSON.stringify(pData));
                            sessionStorage.setItem('pending_bargain_' + b.itemId, JSON.stringify(pData));
                        }
                    } catch (e) {}

                    const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
                    if (activeItem && String(activeItem.id) === String(b.itemId)) {
                        const offerBtn = document.getElementById('modalOfferPriceBtn');
                        if (offerBtn && !localStorage.getItem('accepted_bargain_' + b.itemId)) {
                            offerBtn.innerText = t('product.offer_pending', '[ ПРОПОЗИЦІЮ НАДІСЛАНО ✓ ]');
                            offerBtn.style.borderColor = 'var(--accent-green, #00ff66)';
                            offerBtn.style.color = 'var(--accent-green, #00ff66)';
                            offerBtn.style.pointerEvents = 'none';
                            offerBtn.style.cursor = 'default';
                            offerBtn.style.boxShadow = 'none';
                            offerBtn.disabled = true;
                        }
                    }
                    return;
                }

                if (!b.acceptedPrice) return;
                const payload = {
                    type: 'BARGAIN_ACCEPTED',
                    bargainId: b.bargainId,
                    itemId: b.itemId,
                    itemName: b.itemName,
                    itemImage: b.itemImage,
                    originalPrice: b.originalPrice,
                    acceptedPrice: b.acceptedPrice,
                    expiresAt: b.expiresAt,
                    seen_popup: Boolean(b.seen_popup)
                };
                if (b.seen_popup) {
                    const offerKey = String(b.bargainId || ('accepted_' + b.itemId + '_' + b.acceptedPrice));
                    if (typeof window.markBargainPopupAsSeen === 'function') {
                        window.markBargainPopupAsSeen(offerKey);
                    }
                }
                try {
                    localStorage.setItem('accepted_bargain_' + b.itemId, JSON.stringify(payload));
                    sessionStorage.setItem('accepted_bargain_' + b.itemId, JSON.stringify(payload));
                    localStorage.removeItem('declined_bargain_' + b.itemId);
                    sessionStorage.removeItem('declined_bargain_' + b.itemId);
                    localStorage.removeItem('pending_bargain_' + b.itemId);
                    sessionStorage.removeItem('pending_bargain_' + b.itemId);
                } catch (e) {}

                if (Array.isArray(activeCart)) {
                    const cartItem = activeCart.find(ci => ci && String(ci.id) === String(b.itemId));
                    if (cartItem && Number(cartItem.price) !== Number(b.acceptedPrice)) {
                        cartItem.originalPrice = Number(b.originalPrice || cartItem.originalPrice || cartItem.price);
                        cartItem.price = Number(b.acceptedPrice);
                        cartItem.bargainPrice = Number(b.acceptedPrice);
                        cartUpdated = true;
                    }
                }

                const activeItem = window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
                if (activeItem && String(activeItem.id) === String(b.itemId)) {
                    const offerBtn = document.getElementById('modalOfferPriceBtn');
                    if (offerBtn) {
                        offerBtn.innerText = t('product.offer_accepted_btn', 'ПРОПОЗИЦІЮ ПРИЙНЯТО ✓');
                        offerBtn.style.borderColor = 'var(--accent-yellow, #ffd700)';
                        offerBtn.style.color = 'var(--accent-yellow, #ffd700)';
                        offerBtn.style.pointerEvents = 'none';
                        offerBtn.style.cursor = 'default';
                        offerBtn.style.boxShadow = 'none';
                        offerBtn.disabled = true;
                    }
                    const priceEl = document.getElementById('modalItemPrice') || document.getElementById('modalPrice');
                    if (priceEl) {
                        const cur = (typeof getCurrency === 'function' ? getCurrency() : 'грн').trim();
                        priceEl.innerHTML = `<span style="text-decoration: line-through; color: #777; font-size: 0.75em; margin-right: 8px;">${b.originalPrice || activeItem.price} ${cur}</span><span style="color: var(--accent-yellow, #ffd700); font-weight: bold;">${b.acceptedPrice} ${cur}</span>`;
                    }
                }

                if (typeof window.updateCardDOM === 'function' && Array.isArray(window.allItems)) {
                    const found = window.allItems.find(it => String(it.id) === String(b.itemId));
                    if (found) window.updateCardDOM(found);
                }
            });

            if (cartUpdated && Array.isArray(activeCart)) {
                if (typeof window.setActiveCart === 'function') window.setActiveCart(activeCart);
                else if (typeof setActiveCart === 'function') setActiveCart(activeCart);
                if (typeof window.updateCartUI === 'function') window.updateCartUI();
                else if (typeof updateCartUI === 'function') updateCartUI();
            }
        }
    } catch (e) {
        console.warn('[SYNC BARGAINS] Error:', e);
    }
}
window.syncUserBargains = syncUserBargains;
