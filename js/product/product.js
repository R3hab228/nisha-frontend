// ==========================================
// NISHA PRODUCT MODAL, GALLERY & Q&A MODULE
// ==========================================

// Глобальное состояние открытого товара и слайдера
if (typeof window.currentOpenedItem === 'undefined') window.currentOpenedItem = null;
var currentOpenedItem = window.currentOpenedItem;

let currentSlide = 0;
let totalSlides = 0;

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
    const toCDN = window.toCDN || ((u) => u);
    const url = toCDN(active.images[targetIndex]);
    if (url && !url.endsWith('.mp4')) {
        const img = new Image();
        img.src = url;
    }
}
window.preloadSlide = preloadSlide;

// ==========================================
// 1. ОТКРЫТИЕ КАРТОЧКИ ТОВАРА (MODAL)
// ==========================================

async function openProductModalById(itemId) {
    if (typeof window.hideItemMeasurementsTooltip === 'function') window.hideItemMeasurementsTooltip();
    const catalog = getCatalog();
    let item = catalog.find(i => i.id === itemId);
    
    // МГНОВЕННО открываем модалку, если товар есть в кэше
    if (item) {
        const cardInGrid = document.querySelector(`.item-card[data-id="${itemId}"]`);
        if (cardInGrid) cardInGrid.classList.remove('unseen-pulse');

        if (window._seenItemsSet) {
            window._seenItemsSet.add(String(itemId));
        }
        let seenItemsIds = window.storage ? window.storage.getJSON('nisha_seen_items', []) : JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
        if (!seenItemsIds.includes(itemId)) {
            seenItemsIds.push(itemId);
            if (seenItemsIds.length > 200) seenItemsIds = seenItemsIds.slice(-200); 
            localStorage.setItem('nisha_seen_items', JSON.stringify(seenItemsIds));
        }

        if (typeof closeModal === 'function') {
            const om = document.getElementById('ordersModal');
            if (om && (om.style.display === 'flex' || om.style.display === 'block')) closeModal('ordersModal'); 
            const rm = document.getElementById('reviewsModal');
            if (rm && (rm.style.display === 'flex' || rm.style.display === 'block')) closeModal('reviewsModal'); 
        }
        openProductModal(item); 
    }
    
    // В ФОНЕ подгружаем полное описание и замеры
    const sb = getSupabase();
    if (sb) {
        try {
            let { data } = await sb.from('items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable').eq('id', itemId).limit(1);
            let fullItem = null;
            if (data && data.length > 0) {
                fullItem = data[0];
            } else {
                let { data: archData } = await sb.from('archived_items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable').eq('id', itemId).limit(1);
                if (archData && archData.length > 0) fullItem = archData[0];
            }
            
            // Если товара не было в кэше вообще (переход по прямой ссылке), открываем сейчас
            if (!item && fullItem) {
                if (typeof closeModal === 'function') { const om = document.getElementById('ordersModal'); if (om && (om.style.display === 'flex' || om.style.display === 'block')) closeModal('ordersModal'); const rm = document.getElementById('reviewsModal'); if (rm && (rm.style.display === 'flex' || rm.style.display === 'block')) closeModal('reviewsModal'); } openProductModal(fullItem);
                return;
            }
            
            // Если модалка открыта и мы догрузили описание/фото
            const active = window.currentOpenedItem || currentOpenedItem;
            if (fullItem && active && active.id === fullItem.id) {
                const hadNoImages = (!active.images || active.images.length === 0) && (!active.thumbnails || active.thumbnails.length === 0);
                const hasFullImages = (fullItem.images && fullItem.images.length > 0) || (fullItem.thumbnails && fullItem.thumbnails.length > 0);
                
                currentOpenedItem = fullItem;
                window.currentOpenedItem = fullItem;

                if (hadNoImages && hasFullImages) {
                    if (typeof closeModal === 'function') { const om = document.getElementById('ordersModal'); if (om && (om.style.display === 'flex' || om.style.display === 'block')) closeModal('ordersModal'); const rm = document.getElementById('reviewsModal'); if (rm && (rm.style.display === 'flex' || rm.style.display === 'block')) closeModal('reviewsModal'); } openProductModal(fullItem);
                    return;
                }

                if (fullItem.description) {
                    const descText = fullItem.description ? fullItem.description.replace(/\n/g, '<br>') : `<span style="color:#666;">[ Описание отсутствует ]</span>`;
                    const descContainer = document.querySelector('.modal-desc');
                    if (descContainer) {
                        const sizeTitle = typeof i18next !== 'undefined' ? i18next.t('product.size') : 'РАЗМЕР';
                        const brandTitle = typeof i18next !== 'undefined' ? i18next.t('product.brand') : 'БРЕНД';
                        const qaIndex = descContainer.innerHTML.indexOf('<!-- Блок Вопросов и Ответов (Q&A) -->') !== -1 ? descContainer.innerHTML.indexOf('<!-- Блок Вопросов и Ответов (Q&A) -->') : descContainer.innerHTML.indexOf('<div id="qaWrapper"');
                        const qaPart = qaIndex !== -1 ? descContainer.innerHTML.substring(qaIndex) : '';
                        descContainer.innerHTML = `
                            <div style="margin-bottom: 5px;">
                                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${sizeTitle}</span></strong> 
                                <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${fullItem.size}</span>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${brandTitle}</span></strong> 
                                <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${fullItem.brand}</span>
                            </div>
                            <div style="color: #aaa; font-size: 13px;">${typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(descText) : (typeof window.escapeHtml === 'function' ? window.escapeHtml(descText) : descText)}</div>
                        ` + qaPart;
                    }
                }
            }
        } catch(e) { console.error("Ошибка сети:", e); }
    } else if (!item) {
        showToast('Товар не найден', 'error'); 
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
        if (favs.includes(item.id)) {
            modalStar.classList.add('active');
        } else {
            modalStar.classList.remove('active');
        }
    }

    const isHackedActive = window.isHacked || (typeof isHacked !== 'undefined' && isHacked);
    let finalPrice = isHackedActive ? Math.floor(item.price * 0.9) : item.price;
    const priceEl = document.getElementById('modalItemPrice');
    if (priceEl) priceEl.innerText = finalPrice + ' ' + (typeof getCurrency === 'function' ? getCurrency() : 'грн');
    
    const sizeDescEl = document.getElementById('modalItemSizeDesc');
    if (sizeDescEl) sizeDescEl.innerText = item.size;
    
    const brandEl = document.getElementById('modalItemBrand');
    if (brandEl) brandEl.innerText = item.brand;
    
    const condStr = item.condition || '9 / 10';
    const condMatch = condStr.match(/(\d+)/);
    
    let condNum = 9;
    if (condMatch && condMatch[1]) condNum = parseInt(condMatch[1]);
    
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
            tagsContainer.innerHTML = '';
        }
    }

    const descText = item.description ? item.description : "Оригинал. Любые проверки. Отличное состояние. Дополнительные замеры по запросу в ЛС.";
    const descBlock = document.querySelector('.modal-desc');
    if (descBlock) {
        descBlock.innerHTML = `
            <div style="margin-bottom: 5px;">
                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${typeof i18next !== 'undefined' ? i18next.t('product.size') : 'РАЗМЕР'}</span></strong> 
                <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${item.size}</span>
            </div>
            <div style="margin-bottom: 15px;">
                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${typeof i18next !== 'undefined' ? i18next.t('product.brand') : 'БРЕНД'}</span></strong> 
                <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${item.brand}</span>
            </div>
            <div style="color: #aaa; font-size: 13px;">${descText}</div>
            
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
            let viewedItems = (window.storage && typeof window.storage.getJSON === 'function')
                ? window.storage.getJSON('nisha_added_views', [])
                : JSON.parse(localStorage.getItem('nisha_added_views') || '[]');
            
            if (!viewedItems.includes(item.id)) {
                let visitorId = getFingerprint();
                if (!visitorId || visitorId.startsWith('guest_')) {
                    visitorId = localStorage.getItem('nisha_visitor_id') || ('user_' + (typeof window.generateShortId === 'function' ? window.generateShortId(9) : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().replace(/-/g, '').slice(0, 9) : Date.now().toString(36))));
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
                        if (window.storage && typeof window.storage.setJSON === 'function') {
                            window.storage.setJSON('nisha_added_views', viewedItems);
                        } else {
                            localStorage.setItem('nisha_added_views', JSON.stringify(viewedItems));
                        }
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
            const userCart = window.cart || [];
            const isInCart = userCart.some(i => i.id === item.id);
            cartBtn.innerText = isInCart ? '[ В КОРЗИНЕ ]' : (typeof i18next !== 'undefined' ? i18next.t('product.add_to_cart') : 'В КОРЗИНУ');
        }
    }

    const wrapper = document.getElementById('sliderWrapper');
    const thumbs = document.getElementById('modalThumbnails');
    if (wrapper) wrapper.innerHTML = ''; 
    if (thumbs) thumbs.innerHTML = '';
    
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
            const toCDN = window.toCDN || ((u) => u);
            let slidesHtml = '';
            let thumbsHtml = '';
            mediaList.forEach((url, index) => {
                const cdnUrl = toCDN(url);
                const isVideo = typeof cdnUrl === 'string' && cdnUrl.endsWith('.mp4');
                let currentThumb = (item.thumbnails && item.thumbnails[index]) ? toCDN(item.thumbnails[index]) : cdnUrl;
                
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
                        <a href="${cdnUrl}" data-pswp-width="1000" data-pswp-height="1000" target="_blank" class="slide skeleton" style="background-image:none; display:flex; align-items:center; justify-content:center; border: 1px solid #222;">
                            <img class="modal-slide-img" src="${cdnUrl}" ${loadAttr} style="width:100%; height:100%; object-fit:contain; opacity:0; transition:opacity 0.25s ease-in-out;" 
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
                        img.parentElement.style.border = 'none';
                    }
                }
            });
            thumbs.innerHTML = thumbsHtml;
        } else {
            wrapper.innerHTML = `<a class="slide" style="background:#111; pointer-events:none;">НЕТ ФОТО</a>`;
        }
    }

    setSlide(0);

    // Мгновенная предзагрузка первых слайдов для бесшовного свайпа и зума без задержек
    if (mediaList.length > 0) {
        const toCDN = window.toCDN || ((u) => u);
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
        ensurePhotoSwipe().then(() => {
            if (window.pswpLightbox) {
                try { window.pswpLightbox.init(); } catch (e) {} 
            }
        });
    } else if (window.pswpLightbox) {
        try { window.pswpLightbox.init(); } catch (e) {} 
    }

    if (wrapper && !wrapper._pswpClickBound) {
        wrapper._pswpClickBound = true;
        wrapper.addEventListener('click', async (e) => {
            const slide = e.target.closest('a.slide');
            if (!slide) return;
            if (!window.pswpLightbox) {
                e.preventDefault();
                if (typeof ensurePhotoSwipe === 'function') {
                    await ensurePhotoSwipe();
                }
                if (window.pswpLightbox) {
                    const slides = Array.from(wrapper.querySelectorAll('a.slide'));
                    const idx = slides.indexOf(slide);
                    if (idx >= 0) window.pswpLightbox.loadAndOpen(idx);
                }
            }
        });
    }

    // Рендер похожих товаров
    const simCont = document.getElementById('similarItemsContainer');
    const simContDesktop = document.getElementById('similarItemsContainerDesktop');
    if (simCont || simContDesktop) {
        if (simCont) simCont.innerHTML = '';
        if (simContDesktop) simContDesktop.innerHTML = '';

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

        scoredCandidates.sort((a, b) => b.score - a.score);

        const similar = scoredCandidates.slice(0, 6).map(c => c.item);
        let seenItemsIds = window.storage ? window.storage.getJSON('nisha_seen_items', []) : JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
            
        if (similar.length > 0) {
            let cardsHTML = '';
            similar.forEach(s => {
                const sImg = getOptimizedImg(s, true); 
                let miniBadgeHTML = '';
                const hasSale = s.is_sale;
                const hasHot = (s.views_count || 0) >= 25;
                const isTop = s.is_top === true && s.top_until && new Date(s.top_until).getTime() > Date.now();

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
                let miniPriceHTML = `${s.price} ${curr}`;
                if (s.is_sale && s.old_price) {
                    miniPriceHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 9px; margin-right: 4px;">${s.old_price}</span><span style="color: var(--accent-green);">${s.price} ${curr}</span>`;
                }

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

        const secureSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;

        badgesContainer.innerHTML = `
            <div class="badge-item" data-action="show-badge-info" data-badge="secure">
                <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${secureSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_orig">${typeof i18next !== 'undefined' ? i18next.t('product.badge_orig') : '100% ОРИГИНАЛ'}</span>
            </div>
            <div class="badge-item" data-action="show-badge-info" data-badge="fast">
                <span class="badge-icon">24H</span> 
                <span class="badge-text" data-i18n="product.badge_fast">${typeof i18next !== 'undefined' ? i18next.t('product.badge_fast') : 'БЫСТРАЯ ОТПРАВКА'}</span>
            </div>
            ${refundBadgeHTML}
        `;
    }

    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.remove('closing');
        modal.style.pointerEvents = '';
        const win = modal.querySelector('.modal-window');
        if (win) {
            win.style.transform = '';
            win.style.opacity = '';
            win.style.transition = '';
            win.style.animation = '';
        }
        modal.style.display = 'flex';
    }
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
    let ogDesc = `Размер: ${item.size} | Цена: ${item.price} грн. ${item.description ? item.description.slice(0, 150) : ''}`;
    let ogImage = (item.images && item.images.length > 0) ? item.images[0] : 'https://www.nisha-store.shop/icon-512.png';
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
    window.setMetaTag('og:image', 'https://www.nisha-store.shop/icon-512.png');
    window.setMetaTag('og:image:secure_url', 'https://www.nisha-store.shop/icon-512.png');
    window.setMetaTag('og:image:width', '512');
    window.setMetaTag('og:image:height', '512');
    window.setMetaTag('og:url', 'https://www.nisha-store.shop/');
    window.setMetaTag('og:type', 'website');
    window.setMetaTag('twitter:title', 'NISHA | Underground Store');
    window.setMetaTag('twitter:description', 'NISHA — винтажная одежда, обувь и аксессуары. Доставка Новой Почтой по всей Украине.');
    window.setMetaTag('twitter:image', 'https://www.nisha-store.shop/icon-512.png');
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

function setSlide(index) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    currentSlide = index;
    updateSlider();

    // Предзагружаем следующее фото для непрерывного мгновенного свайпа
    const active = window.currentOpenedItem;
    if (active && active.images && active.images[index + 1]) {
        const toCDN = window.toCDN || ((u) => u);
        const nextUrl = toCDN(active.images[index + 1]);
        if (!nextUrl.endsWith('.mp4')) {
            const preImg = new Image();
            preImg.src = nextUrl;
        }
    }
}
window.setSlide = setSlide;

function updateSlider() {
    const sliderWrapper = document.getElementById('sliderWrapper');
    if (!sliderWrapper) return;

    sliderWrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    const counter = document.getElementById('photoCounter');
    const total = document.querySelectorAll('.slide').length;
    
    if (counter) {
        counter.innerText = `${currentSlide + 1} / ${total}`;
    }

    const thumbs = document.querySelectorAll('.thumb');
    thumbs.forEach((t, i) => { 
        if(i === currentSlide) t.classList.add('active-thumb'); 
        else t.classList.remove('active-thumb'); 
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

function initSliderSwipe() {
    const sliderContainer = document.getElementById('sliderContainer');
    if (!sliderContainer) return;
    if (sliderContainer._swipeBound) return;
    sliderContainer._swipeBound = true;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let lastTapTime = 0;

    sliderContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchEndX = touchStartX;
        touchEndY = touchStartY;

        const currentTime = Date.now();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0) {
            const slides = document.querySelectorAll('.slide');
            if (slides[currentSlide]) {
                slides[currentSlide].classList.toggle('zoomed-in');
            }
            if (e.cancelable) e.preventDefault();
        }
        lastTapTime = currentTime;

    }, { passive: true });

    sliderContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) return;
        touchEndX = e.touches[0].clientX;
        touchEndY = e.touches[0].clientY;
        const diffX = Math.abs(touchEndX - touchStartX);
        const diffY = Math.abs(touchEndY - touchStartY);

        // Если свайп идет по горизонтали — блокируем вертикальный скролл страницы
        if (diffX > 10 && diffX > diffY) {
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });

    sliderContainer.addEventListener('touchend', (e) => {
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;
        
        const currentSlideEl = document.querySelectorAll('.slide')[currentSlide];
        const isZoomed = currentSlideEl && currentSlideEl.classList.contains('zoomed-in');

        // Четкий горизонтальный свайп (порог 40px и преобладание горизонтали над вертикалью в 1.3 раза)
        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.3 && !isZoomed) {
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
    const errorMsg = typeof i18next !== 'undefined' ? i18next.t('messages.copy_error', {defaultValue: 'Ошибка копирования'}) : 'Ошибка копирования';

    if (navigator.share) {
        navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
        }).catch(() => {
            console.log('Шеринг отменен пользователем');
        });
    } else if (typeof window.copyToClipboard === 'function') {
        window.copyToClipboard(shareUrl, successMsg, errorMsg);
    } else if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(shareUrl)
            .then(() => showToast(successMsg, 'success'))
            .catch(() => showToast(errorMsg, 'error'));
    } else {
        showToast(errorMsg, 'error');
    }
}
window.shareItem = shareItem;

// ==========================================
// 4. ИСТОРИЯ ПРОСМОТРОВ (VIEWING HISTORY)
// ==========================================

function addToHistory(item) {
    let hist = window.storage ? window.storage.getJSON('nisha_history', []) : JSON.parse(localStorage.getItem('nisha_history') || '[]');
    hist = hist.filter(i => i.id !== item.id);
    const img = getOptimizedImg(item, true) || ((item.images && item.images.length > 0) ? item.images[0] : '');
    
    hist.unshift({ 
        id: item.id, 
        name: item.name, 
        price: item.price, 
        old_price: item.old_price, 
        is_sale: item.is_sale, 
        img: img 
    });
    
    if (hist.length > 30) hist = hist.slice(0, 30); 
    
    if (window.storage) window.storage.setJSON('nisha_history', hist); else localStorage.setItem('nisha_history', JSON.stringify(hist));
    renderHistory();
}
window.addToHistory = addToHistory;

function renderHistory() {
    let hist = window.storage ? window.storage.getJSON('nisha_history', []) : JSON.parse(localStorage.getItem('nisha_history') || '[]');
    const container = document.getElementById('historyGrid');
    const section = document.getElementById('historySection');
    
    if(!container || !section) return;

    const catalog = getCatalog();
    if (catalog.length > 0) {
        const validHist = hist.filter(h => catalog.some(dbItem => dbItem.id === h.id));
        if (validHist.length !== hist.length) {
            hist = validHist;
            if (window.storage) window.storage.setJSON('nisha_history', hist); else localStorage.setItem('nisha_history', JSON.stringify(hist));
        }
    }
    
    if(hist.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    container.innerHTML = '';
    
    const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
    const fragment = document.createDocumentFragment();
    const cardsForTilt = [];
    const toCDN = window.toCDN || ((u) => u);

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
        const liveIsTop = !!(realItem && realItem.is_top === true && realItem.top_until && new Date(realItem.top_until).getTime() > Date.now());
        const liveIsHot = !!(realItem && (realItem.views_count || 0) >= 25);
        
        let finalPriceHTML = '';
        const curr = typeof getCurrency === 'function' ? getCurrency() : 'грн';
        if (liveIsSale && liveOldPrice) {
            finalPriceHTML = `<span style="color:#4a704a; text-decoration:line-through; font-size:10px; margin-right:4px;">${liveOldPrice}</span>${livePrice} ${curr}`;
        } else {
            finalPriceHTML = `${livePrice} ${curr}`;
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
            if (liveIsTop) parts.push(`<span style="color: #cc00ff;">★ TOP</span>`);
            if (liveIsSale) parts.push(`<span style="color: #cc0000;">% SALE</span>`);
            if (liveIsHot) parts.push(`<span style="color: #0044cc;">HOT</span>`);
            miniBadgeHTML = `<div style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; display: flex; align-items: center; gap: 4px; padding: 1px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none;">${parts.join('<div style="width:1px;height:8px;background:#888;"></div>')}</div>`;
        }

        card.innerHTML = `
            <div class="history-img" style="position: relative; overflow: hidden; padding: 0; background: #111;">
                ${mediaHTML}
                ${miniBadgeHTML}
                ${statusOverlayHTML}
                <div class="history-item-remove" data-action="remove-history-item" data-id="${typeof window.escapeAttr==='function'?window.escapeAttr(h.id):h.id}" title="Удалить" style="z-index: 20;">X</div>
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
    
    let hist = window.storage ? window.storage.getJSON('nisha_history', []) : JSON.parse(localStorage.getItem('nisha_history') || '[]');
    hist = hist.filter(item => item.id !== itemId);
    if (window.storage) window.storage.setJSON('nisha_history', hist); else localStorage.setItem('nisha_history', JSON.stringify(hist));
    
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
        showToast('Для отправки вопроса нужно войти в аккаунт!', 'error');
        if (typeof openProfileModal === 'function') openProfileModal();
        return;
    }

    const input = document.getElementById('questionInput');
    if (!input) return;
    let text = input.value.trim();
    if (text.length < 5) {
        showToast('Вопрос слишком короткий!', 'error');
        return;
    }
    if (text.length > 100) {
        text = text.slice(0, 100);
    }

    const today = new Date().toLocaleDateString('en-CA');
    let questionData = { date: '', count: 0 };
    try {
        questionData = JSON.parse(localStorage.getItem('nisha_questions') || '{"date":"","count":0}');
    } catch(e) {}
    
    if (questionData.date !== today) questionData = { date: today, count: 0 };
    if (questionData.count >= 2) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        return showToast('Лимит: 2 вопроса в день.', 'error');
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
            localStorage.setItem('nisha_questions', JSON.stringify(questionData));
            input.value = '';
            toggleQuestionForm(); 
            showToast('Вопрос отправлен!', 'success');
        } else {
            showToast('Ошибка при отправке вопроса.', 'error');
        }
    } catch (err) {
        showToast('Ошибка соединения с сервером.', 'error');
    }
}
window.submitQuestion = submitQuestion;

async function loadItemQuestions(itemId) {
    const sb = getSupabase();
    if (!sb) return;
    
    const { data, error } = await sb.from('item_questions').select('question, answer, user_name, created_at').eq('item_id', itemId).order('created_at', { ascending: true });
    
    const wrapper = document.getElementById('qaWrapper');
    const list = document.getElementById('qaList');
    
    if (data && data.length > 0 && wrapper && list) {
        wrapper.style.display = 'block';
        list.innerHTML = '';
        data.forEach(q => {
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

// ==========================================
// МОДУЛЬ ВИЗУАЛЬНОЙ СХЕМЫ ЗАМЕРОВ (HUD MODAL)
// ==========================================

function detectItemClothingType(item) {
    if (!item) return 'top';
    const cat = String(item.category || '').toLowerCase();
    const name = String(item.name || '').toLowerCase();
    const combined = `${cat} ${name}`;

    if (cat === 'обувь' || /кроссовк|кед|ботин|туфл|shoes|sneakers|boots|сланц|лофер/i.test(combined)) {
        return 'shoes';
    }
    if (cat.includes('штаны') || cat.includes('джинсы') || /штаны|джинсы|брюки|шорты|pants|jeans|shorts|trousers|джоггеры|джогери/i.test(combined)) {
        return 'bottom';
    }
    return 'top';
}
window.detectItemClothingType = detectItemClothingType;

function parseItemMeasurementParams(item) {
    if (!item) return {};
    const rawText = ((item.description || '') + ' ' + (item.size || ''));
    // Нормализация десятичных запятых (27,5 -> 27.5) без повреждения пунктуации
    const text = rawText.replace(/(\d+),(\d+)/g, '$1.$2');
    const params = {};

    const extract = (regex) => {
        const m = text.match(regex);
        return m ? parseFloat(m[1]) : null;
    };

    // Shoulders (плечи, плечі, ширина плеч)
    params.shoulders = extract(/(?:плеч[иіея]|ширин[аы]\s*плеч)[^\d\n\r]{0,25}?(\d+(?:\.\d+)?)/i);
    // Chest / Pit-to-pit (полуобхват груди, ПОГ, подмышки, підмишки, пахи)
    params.chest = extract(/(?:полуобхват\s+груд[еиейяі]|пог|груд[иіеяь]|підмишк[иае]|подмышк[иае]|пахи|подмыхи|ширин[аы]\s*(?:в\s*грудях|между\s*подмышками)?)[^\d\n\r]{0,25}?(\d+(?:\.\d+)?)/i);
    // Length for tops (длина по спине, довжина по спині, длина изделия) - negative lookahead for штанин/рукав
    params.length = extract(/(?:довжина\s*(?:по\s*спин[іе]|спин[иы]|виробу|изделия)?|длина\s*(?:по\s*спин[еі]|спин[ыи]|изделия)?)(?!\s*(?:штанин|рукав))[^\d\n\r]{0,25}?(\d+(?:\.\d+)?)/i);
    // Sleeve (рукав, длина рукава от плеча)
    params.sleeve = extract(/(?:довжина\s*рукав[аеу]?|длина\s*рукав[аеу]?|рукав(?:\s*(?:від|от)?\s*плеч[аея])?)[^\d\n\r]{0,25}?(\d+(?:\.\d+)?)/i);
    // Waist (пояс, талия, пот)
    params.waist = extract(/(?:пояс|тал[иі][яеєїі]|пот|полуобхват\s*пояс[ау]|напівобхват\s*пояс[ау])[^\d\n\r]{0,25}?(\d+(?:\.\d+)?)/i);
    // Pants outseam length (длина штанины, длина)
    params.pantsLength = extract(/(?:довжина\s*штанин[иы]|длина\s*штанины|загальна\s*довжина|общая\s*длина)[^\d\n\r]{0,25}?(\d+(?:\.\d+)?)/i);
    // Inseam (шаговый шов, кроковий)
    params.inseam = extract(/(?:кроков(?:ий)?(?:\s*шов)?|шагов(?:ый)?(?:\s*шов)?|внутр[іе]шн(?:ій)?\s*шов)[^\d\n\r]{0,25}?(\d+(?:\.\d+)?)/i);
    // Leg opening (выход штанины, вихід)
    params.legOpening = extract(/(?:вихід|выход|низ\s*штанин[ыи])[^\d\n\r]{0,25}?(\d+(?:\.\d+)?)/i);
    // Insole (стелька, устілка)
    params.insole = extract(/(?:устілк[аи]|стельк[аи]|довжина\s*устілки|длина\s*стельки)[^\d\n\r]{0,25}?(\d+(?:\.\d+)?)/i);

    const type = detectItemClothingType(item);
    if (type === 'bottom' && !params.pantsLength && params.length) {
        params.pantsLength = params.length;
    }

    return params;
}
window.parseItemMeasurementParams = parseItemMeasurementParams;

function generateMeasurementSchemeSvg(type, params, lang) {
    params = params || {};
    const markerId = 'arrowG_' + Math.random().toString(36).substring(2, 8);
    const pShoulders = params.shoulders ? `${params.shoulders} см` : '—';
    const pChest = params.chest ? `${params.chest} см` : '—';
    const pLength = params.length ? `${params.length} см` : '—';
    const pSleeve = params.sleeve ? `${params.sleeve} см` : '—';
    const pWaist = params.waist ? `${params.waist} см` : '—';
    const pPantsLen = params.pantsLength ? `${params.pantsLength} см` : '—';
    const pInseam = params.inseam ? `${params.inseam} см` : '—';
    const pLegOpen = params.legOpening ? `${params.legOpening} см` : '—';
    const pInsole = params.insole ? `${params.insole} см` : '—';

    const isUa = lang === 'ua' || lang === 'uk';
    const isEn = lang === 'en';

    if (type === 'shoes') {
        const lblInsole = isEn ? 'INSOLE' : (isUa ? 'УСТІЛКА' : 'СТЕЛЬКА');
        return `
        <svg viewBox="0 0 320 180" width="100%" height="auto" style="display:block;margin:0 auto;filter:drop-shadow(0 0 10px rgba(0,255,102,0.15));" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <marker id="${markerId}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#00ff66"/>
                </marker>
            </defs>
            <path d="M 45 130 C 50 115 65 95 90 95 C 105 95 115 105 125 110 L 170 85 C 185 75 205 95 215 105 L 245 108 C 265 110 275 125 275 135 L 270 142 L 45 142 Z" 
                  fill="rgba(0, 255, 102, 0.04)" stroke="#00ff66" stroke-width="1.6" stroke-dasharray="4 3"/>
            <path d="M 40 142 L 275 142 L 272 152 L 42 152 Z" fill="#000" stroke="#00ff66" stroke-width="1.4" stroke-dasharray="3 2"/>
            <path d="M 130 110 L 175 88" stroke="#00ff66" stroke-width="1.2" stroke-dasharray="2 2" opacity="0.6"/>
            <line x1="45" y1="164" x2="272" y2="164" stroke="#00ff41" stroke-width="1.8" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>
            <line x1="45" y1="145" x2="45" y2="170" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/>
            <line x1="272" y1="145" x2="272" y2="170" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/>
            <g transform="translate(160, 164)">
                <rect x="-65" y="-10" width="130" height="20" fill="#050505" stroke="#00ff66" stroke-width="1" rx="3"/>
                <text x="0" y="4" fill="#00ff66" font-family="'JetBrains Mono', Courier, monospace" font-size="11" font-weight="bold" text-anchor="middle">
                    [A] ${lblInsole}: ${pInsole}
                </text>
            </g>
        </svg>`;
    }

    if (type === 'bottom') {
        const lblWaist = isEn ? 'WAIST' : (isUa ? 'ПОЯС' : 'ПОЯС');
        const lblLen = isEn ? 'LENGTH' : (isUa ? 'ДОВЖИНА' : 'ДЛИНА');
        const lblInseam = isEn ? 'INSEAM' : (isUa ? 'КРОКОВИЙ' : 'ШАГОВЫЙ');
        const lblExit = isEn ? 'CUFF' : (isUa ? 'ВИХІД' : 'ВЫХОД');

        return `
        <svg viewBox="0 0 320 300" width="100%" height="auto" style="display:block;margin:0 auto;filter:drop-shadow(0 0 10px rgba(0,255,102,0.15));" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <marker id="${markerId}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#00ff66"/>
                </marker>
            </defs>
            <path d="M 112 45 L 208 45 L 214 90 C 212 140 206 200 200 260 L 168 260 L 160 115 L 152 260 L 120 260 C 114 200 108 140 106 90 Z" 
                  fill="rgba(0, 255, 102, 0.04)" stroke="#00ff66" stroke-width="1.6" stroke-dasharray="4 3"/>
            <line x1="112" y1="55" x2="208" y2="55" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/>
            <line x1="160" y1="55" x2="160" y2="105" stroke="#00ff66" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.6"/>

            <line x1="112" y1="35" x2="208" y2="35" stroke="#00ff41" stroke-width="1.6" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>
            <line x1="112" y1="28" x2="112" y2="48" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
            <line x1="208" y1="28" x2="208" y2="48" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
            <g transform="translate(160, 35)">
                <rect x="-56" y="-9" width="112" height="18" fill="#050505" stroke="#00ff66" stroke-width="1" rx="3"/>
                <text x="0" y="4" fill="#00ff66" font-family="'JetBrains Mono', Courier, monospace" font-size="10" font-weight="bold" text-anchor="middle">
                    [A] ${lblWaist}: ${pWaist}
                </text>
            </g>

            <line x1="92" y1="45" x2="92" y2="260" stroke="#00ff41" stroke-width="1.6" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>
            <line x1="85" y1="45" x2="108" y2="45" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
            <line x1="85" y1="260" x2="116" y2="260" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
            <g transform="translate(50, 150)">
                <rect x="-46" y="-10" width="92" height="20" fill="#050505" stroke="#00ff66" stroke-width="1" rx="3"/>
                <text x="0" y="4" fill="#00ff66" font-family="'JetBrains Mono', Courier, monospace" font-size="10" font-weight="bold" text-anchor="middle">
                    [B] ${lblLen}: ${pPantsLen}
                </text>
            </g>

            <line x1="160" y1="125" x2="160" y2="260" stroke="#00ff41" stroke-width="1.6" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>
            <line x1="154" y1="260" x2="166" y2="260" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
            <g transform="translate(160, 180)">
                <rect x="-56" y="-9" width="112" height="18" fill="#050505" stroke="#00ff66" stroke-width="1" rx="3"/>
                <text x="0" y="4" fill="#00ff66" font-family="'JetBrains Mono', Courier, monospace" font-size="10" font-weight="bold" text-anchor="middle">
                    [C] ${lblInseam}: ${pInseam}
                </text>
            </g>

            <line x1="120" y1="275" x2="152" y2="275" stroke="#00ff41" stroke-width="1.6" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>
            <line x1="120" y1="262" x2="120" y2="282" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
            <line x1="152" y1="262" x2="152" y2="282" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
            <g transform="translate(136, 290)">
                <rect x="-50" y="-8" width="100" height="16" fill="#050505" stroke="#00ff66" stroke-width="1" rx="3"/>
                <text x="0" y="4" fill="#00ff66" font-family="'JetBrains Mono', Courier, monospace" font-size="9" font-weight="bold" text-anchor="middle">
                    [D] ${lblExit}: ${pLegOpen}
                </text>
            </g>
        </svg>`;
    }

    // Default: Tops / Upper body cyber silhouette
    const lblSh = isEn ? 'SHOULDERS' : (isUa ? 'ПЛЕЧІ' : 'ПЛЕЧИ');
    const lblCh = isEn ? 'PIT-TO-PIT' : 'ПОГ';
    const lblLen = isEn ? 'LENGTH' : (isUa ? 'ДОВЖИНА' : 'ДЛИНА');
    const lblSl = isEn ? 'SLEEVE' : (isUa ? 'РУКАВ' : 'РУКАВ');

    return `
    <svg viewBox="0 0 320 300" width="100%" height="auto" style="display:block;margin:0 auto;filter:drop-shadow(0 0 10px rgba(0,255,102,0.15));" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <marker id="${markerId}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#00ff66"/>
            </marker>
        </defs>

        <!-- Cyber Human Figure Outline -->
        <ellipse cx="160" cy="34" rx="14" ry="17" fill="rgba(0, 255, 102, 0.04)" stroke="#00ff66" stroke-width="1.5" stroke-dasharray="4 3"/>
        <line x1="152" y1="34" x2="168" y2="34" stroke="#00ff66" stroke-width="1.2" opacity="0.6"/>

        <path d="M 154 50 L 154 58 L 105 74 L 78 185 L 96 190 L 118 128 L 124 215 L 196 215 L 202 128 L 224 190 L 242 185 L 215 74 L 166 58 L 166 50 Z" 
              fill="rgba(0, 255, 102, 0.05)" stroke="#00ff66" stroke-width="1.6" stroke-dasharray="4 3"/>

        <path d="M 124 215 L 126 270 M 196 215 L 194 270 M 160 232 L 148 270 M 160 232 L 172 270" 
              stroke="#00ff66" stroke-width="1" stroke-dasharray="2 3" opacity="0.3"/>
        <line x1="160" y1="58" x2="160" y2="215" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 3" opacity="0.2"/>

        <!-- [A] Shoulders Dimension Arrow -->
        <line x1="105" y1="62" x2="215" y2="62" stroke="#00ff41" stroke-width="1.6" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>
        <line x1="105" y1="56" x2="105" y2="76" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
        <line x1="215" y1="56" x2="215" y2="76" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
        <g transform="translate(160, 62)">
            <rect x="-56" y="-9" width="112" height="18" fill="#050505" stroke="#00ff66" stroke-width="1" rx="3"/>
            <text x="0" y="4" fill="#00ff66" font-family="'JetBrains Mono', Courier, monospace" font-size="10" font-weight="bold" text-anchor="middle">
                [A] ${lblSh}: ${pShoulders}
            </text>
        </g>

        <!-- [B] Chest / Pit-to-Pit Dimension Arrow -->
        <line x1="118" y1="128" x2="202" y2="128" stroke="#00ff41" stroke-width="1.6" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>
        <line x1="118" y1="120" x2="118" y2="136" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
        <line x1="202" y1="120" x2="202" y2="136" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
        <g transform="translate(160, 128)">
            <rect x="-48" y="-9" width="96" height="18" fill="#050505" stroke="#00ff66" stroke-width="1" rx="3"/>
            <text x="0" y="4" fill="#00ff66" font-family="'JetBrains Mono', Courier, monospace" font-size="10" font-weight="bold" text-anchor="middle">
                [B] ${lblCh}: ${pChest}
            </text>
        </g>

        <!-- [C] Length Dimension Arrow -->
        <line x1="218" y1="58" x2="218" y2="215" stroke="#00ff41" stroke-width="1.6" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>
        <line x1="212" y1="58" x2="226" y2="58" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
        <line x1="212" y1="215" x2="226" y2="215" stroke="#00ff66" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
        <g transform="translate(268, 140)">
            <rect x="-48" y="-9" width="96" height="18" fill="#050505" stroke="#00ff66" stroke-width="1" rx="3"/>
            <text x="0" y="4" fill="#00ff66" font-family="'JetBrains Mono', Courier, monospace" font-size="10" font-weight="bold" text-anchor="middle">
                [C] ${lblLen}: ${pLength}
            </text>
        </g>

        <!-- [D] Sleeve Dimension Arrow -->
        <line x1="98" y1="78" x2="72" y2="185" stroke="#00ff41" stroke-width="1.6" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>
        <g transform="translate(52, 140)">
            <rect x="-48" y="-9" width="96" height="18" fill="#050505" stroke="#00ff66" stroke-width="1" rx="3"/>
            <text x="0" y="4" fill="#00ff66" font-family="'JetBrains Mono', Courier, monospace" font-size="10" font-weight="bold" text-anchor="middle">
                [D] ${lblSl}: ${pSleeve}
            </text>
        </g>
    </svg>`;
}
window.generateMeasurementSchemeSvg = generateMeasurementSchemeSvg;

function showMeasurementSchemeModal(targetItem) {
    const item = targetItem || window.currentOpenedItem || (typeof currentOpenedItem !== 'undefined' ? currentOpenedItem : null);
    const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('nisha_lang') : 'ru';
    const lang = (typeof getCurrentSiteLang === 'function' ? getCurrentSiteLang() : (storedLang || 'ru')).toLowerCase();
    const isUa = lang === 'ua' || lang === 'uk';
    const isEn = lang === 'en';

    const type = detectItemClothingType(item);
    const params = parseItemMeasurementParams(item);

    const title = isEn ? '// MEASUREMENT GUIDE' : (isUa ? '// СХЕМА ЗАМІРІВ' : '// СХЕМА ЗАМЕРОВ');
    const btnText = isEn ? '[ UNDERSTOOD ]' : (isUa ? '[ ЗРОЗУМІЛО ]' : '[ ПОНЯТНО ]');

    const itemTitle = item ? `${item.brand || ''} ${item.name || ''}`.trim() : '';
    const itemSize = item && item.size ? item.size : null;

    const svgHtml = generateMeasurementSchemeSvg(type, params, isUa ? 'ua' : (isEn ? 'en' : 'ru'));

    let rows = [];
    if (type === 'shoes') {
        const lblA = isEn ? 'Insole length' : (isUa ? 'Довжина устілки' : 'Длина стельки');
        const descA = isEn ? 'heel to toe' : (isUa ? 'від п\'яти до носка' : 'от пятки до носка');
        rows.push({ code: 'A', label: lblA, desc: descA, val: params.insole });
    } else if (type === 'bottom') {
        rows.push({
            code: 'A',
            label: isEn ? 'Waist' : (isUa ? 'Пояс' : 'Пояс'),
            desc: isEn ? 'flat waistband width' : (isUa ? 'напівобхват пояса' : 'полуобхват пояса'),
            val: params.waist
        });
        rows.push({
            code: 'B',
            label: isEn ? 'Outseam length' : (isUa ? 'Довжина' : 'Длина'),
            desc: isEn ? 'outer side seam' : (isUa ? 'по зовнішньому боковому шву' : 'по внешнему боковому шву'),
            val: params.pantsLength
        });
        rows.push({
            code: 'C',
            label: isEn ? 'Inseam' : (isUa ? 'Кроковий шов' : 'Шаговый шов'),
            desc: isEn ? 'crotch to hem seam' : (isUa ? 'по внутрішньому шву' : 'по внутреннему шву от паха'),
            val: params.inseam
        });
        rows.push({
            code: 'D',
            label: isEn ? 'Leg opening' : (isUa ? 'Вихід' : 'Выход'),
            desc: isEn ? 'cuff width (flat)' : (isUa ? 'ширина штанини внизу' : 'ширина штанины внизу'),
            val: params.legOpening
        });
    } else {
        rows.push({
            code: 'A',
            label: isEn ? 'Shoulders' : (isUa ? 'Плечі' : 'Плечи'),
            desc: isEn ? 'shoulder seam to seam' : (isUa ? 'від шва до шва' : 'от шва до шва'),
            val: params.shoulders
        });
        rows.push({
            code: 'B',
            label: isEn ? 'Pit-to-pit (Chest)' : (isUa ? 'ПОГ (Груди)' : 'ПОГ (Грудь)'),
            desc: isEn ? 'half-width between underarms' : (isUa ? 'напівобхват між пахвами' : 'полуобхват подмышками'),
            val: params.chest
        });
        rows.push({
            code: 'C',
            label: isEn ? 'Back length' : (isUa ? 'Довжина' : 'Длина'),
            desc: isEn ? 'from collar to hem' : (isUa ? 'по спині від коміра' : 'по спине от воротника'),
            val: params.length
        });
        rows.push({
            code: 'D',
            label: isEn ? 'Sleeve length' : (isUa ? 'Рукав' : 'Рукав'),
            desc: isEn ? 'shoulder seam to cuff' : (isUa ? 'від шва плеча до манжета' : 'от шва плеча до манжета'),
            val: params.sleeve
        });
    }

    const note = isEn
        ? '* All measurements are taken flat without stretching the fabric.'
        : (isUa
            ? '* Всі виміри зняті у розкладеному вигляді без розтягування тканини.'
            : '* Все замеры сняты в разложенном виде без растяжения ткани.');

    const notSpecifiedText = isEn ? 'n/a' : (isUa ? 'не вказано' : 'не указано');

    const rowsHtml = rows.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px dashed #222;font-size:11px;">
            <div style="text-align:left;">
                <span style="color:#00ff66;font-weight:bold;margin-right:4px;">[${r.code}]</span>
                <span style="color:#ddd;font-weight:600;">${r.label}</span>
                <span style="color:#666;font-size:10px;margin-left:4px;">(${r.desc})</span>
            </div>
            <div style="font-family:var(--font-mono, monospace);font-weight:bold;color:${r.val ? '#00ff66' : '#555'};white-space:nowrap;margin-left:8px;">
                ${r.val ? `${r.val} см` : `[ ${notSpecifiedText} ]`}
            </div>
        </div>
    `).join('');

    let headerHtml = '';
    if (itemTitle) {
        headerHtml = `
            <div style="margin-bottom:12px;padding:6px 10px;background:#0d0d0d;border:1px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;font-size:11px;font-family:var(--font-mono, monospace);">
                <div style="color:#00ff66;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;">
                    > ${typeof window.escapeHtml === 'function' ? window.escapeHtml(itemTitle) : itemTitle}
                </div>
                ${itemSize ? `<span style="background:rgba(0,255,102,0.12);color:#00ff66;padding:2px 6px;border:1px solid #00ff66;font-size:10px;font-weight:bold;">${typeof window.escapeHtml === 'function' ? window.escapeHtml(itemSize) : itemSize}</span>` : ''}
            </div>
        `;
    }

    const htmlContent = `
        <div class="measurement-scheme-modal-content" style="max-width:100%;box-sizing:border-box;">
            ${headerHtml}
            <div style="background:#050505;border:1px solid #1e1e1e;border-radius:4px;padding:8px;margin-bottom:12px;position:relative;">
                ${svgHtml}
            </div>
            <div style="background:#080808;border:1px solid #1e1e1e;padding:6px 10px;border-radius:4px;">
                ${rowsHtml}
            </div>
            <div style="margin-top:10px;color:#777;font-size:10px;font-family:var(--font-mono, monospace);text-align:center;">
                ${note}
            </div>
        </div>
    `;

    if (typeof window.showTerminalModal === 'function') {
        window.showTerminalModal(title, htmlContent, btnText);
    }
}
window.showMeasurementSchemeModal = showMeasurementSchemeModal;

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

