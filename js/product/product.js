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

// ==========================================
// 1. ОТКРЫТИЕ КАРТОЧКИ ТОВАРА (MODAL)
// ==========================================

async function openProductModalById(itemId) {
    const catalog = getCatalog();
    let item = catalog.find(i => i.id === itemId);
    
    // МГНОВЕННО открываем модалку, если товар есть в кэше
    if (item) {
        const cardInGrid = document.querySelector(`.item-card[data-id="${itemId}"]`);
        if (cardInGrid) cardInGrid.classList.remove('unseen-pulse');

        let seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
        if (!seenItemsIds.includes(itemId)) {
            seenItemsIds.push(itemId);
            if (seenItemsIds.length > 200) seenItemsIds = seenItemsIds.slice(-200); 
            localStorage.setItem('nisha_seen_items', JSON.stringify(seenItemsIds));
        }

        if (typeof closeModal === 'function') {
            closeModal('ordersModal'); 
            closeModal('reviewsModal'); 
        }
        openProductModal(item); 
    }
    
    // В ФОНЕ подгружаем полное описание и замеры
    const sb = getSupabase();
    if (sb) {
        try {
            let { data } = await sb.from('items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop').eq('id', itemId).limit(1);
            let fullItem = null;
            if (data && data.length > 0) {
                fullItem = data[0];
            } else {
                let { data: archData } = await sb.from('archived_items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop').eq('id', itemId).limit(1);
                if (archData && archData.length > 0) fullItem = archData[0];
            }
            
            // Если товара не было в кэше вообще (переход по прямой ссылке), открываем сейчас
            if (!item && fullItem) {
                openProductModal(fullItem);
                return;
            }
            
            // Если модалка открыта и мы догрузили описание - просто вставляем текст
            const active = window.currentOpenedItem || currentOpenedItem;
            if (fullItem && active && active.id === fullItem.id) {
                currentOpenedItem = fullItem;
                window.currentOpenedItem = fullItem;
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
                            <div style="color: #aaa; font-size: 13px;">${descText}</div>
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
    
    if (typeof window.stopLenis === 'function') window.stopLenis();
    else if (typeof lenis !== 'undefined') lenis.stop();
    
    document.title = `NISHA | ${item.brand} - ${item.name}`;

    const titleEl = document.getElementById('modalItemTitle');
    if (titleEl) titleEl.innerText = item.name;
    
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
            tagsContainer.innerHTML = item.tags.slice(0, 3).map(t => `<span style="color: #fff; margin-right: 12px; letter-spacing: 0.5px;">#${t}</span>`).join('');
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
                <h4 class="qa-title" onclick="document.getElementById('qaList').classList.toggle('collapsed'); this.querySelector('.qa-arrow').style.transform = document.getElementById('qaList').classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';">
                    <span data-i18n="product.qa_title">${typeof i18next !== 'undefined' ? i18next.t('product.qa_title', {defaultValue: 'Q&A: Вопросы покупателей'}) : 'Q&A: Вопросы покупателей'}</span>
                    <span class="qa-arrow" style="transition: transform 0.2s; color: var(--accent-green); display: inline-block;">▼</span>
                </h4>
                <div id="qaList" class="qa-content"></div>
            </div>

            <!-- КНОПКА ЗАДАТЬ ВОПРОС -->
            <div style="margin-top: 15px; text-align: right;">
                <button onclick="toggleQuestionForm()" style="background: transparent; border: none; color: var(--accent-green); font-family: var(--font-mono); font-weight: bold; cursor: pointer; padding: 0; font-size: 13px; text-decoration: underline;" data-i18n="product.ask_btn">${typeof i18next !== 'undefined' ? i18next.t('product.ask_btn', {defaultValue: 'Задать вопрос?'}) : 'Задать вопрос?'}</button>
            </div>
            <div id="questionFormContainer" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; margin-top: 5px;">
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <input type="text" id="questionInput" class="form-input" maxlength="100" placeholder="Ваш вопрос..." data-i18n-ph="product.ask_ph" style="font-size: 12px; padding: 8px;">
                    <button class="search-btn btn-target" onclick="submitQuestion('${item.id}')" style="padding: 8px 15px; font-size: 12px;" data-i18n="product.ask_send">${typeof i18next !== 'undefined' ? i18next.t('product.ask_send', {defaultValue: 'ОТПРАВИТЬ'}) : 'ОТПРАВИТЬ'}</button>
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
            let viewedItems = JSON.parse(localStorage.getItem('nisha_added_views') || '[]');
            
            if (!viewedItems.includes(item.id)) {
                let visitorId = getFingerprint();
                if (!visitorId || visitorId.startsWith('guest_')) {
                    visitorId = localStorage.getItem('nisha_visitor_id') || 'user_' + Math.random().toString(36).substr(2, 9);
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
                        viewedItems.push(item.id);
                        localStorage.setItem('nisha_added_views', JSON.stringify(viewedItems));
                    }
                });
            } else {
                sb.from('items').select('views_count').eq('id', item.id).limit(1).then(({ data, error }) => {
                    if (!error && data && data.length > 0) {
                        viewCount.innerText = data[0].views_count || 0;
                        item.views_count = data[0].views_count || 0;
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
    if (wrapper && thumbs) {
        if (item.images && item.images.length > 0) {
            item.images.forEach((url, index) => {
                const toCDN = window.toCDN || ((u) => u);
                const cdnUrl = toCDN(url);
                const isVideo = cdnUrl.endsWith('.mp4');
                let currentThumb = (item.thumbnails && item.thumbnails[index]) ? toCDN(item.thumbnails[index]) : cdnUrl;
                
                if (isVideo && (!item.thumbnails || !item.thumbnails[index])) {
                    currentThumb = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23000'/%3E%3Cpolygon points='40,30 70,50 40,70' fill='%2300ff00'/%3E%3Ctext x='50' y='88' font-family='monospace' font-size='11' font-weight='bold' fill='%2300ff00' text-anchor='middle'%3EVIDEO%3C/text%3E%3C/svg%3E";
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
                    const isFirst = (index === 0);
                    const loadAttr = isFirst ? 'fetchpriority="high" loading="eager"' : 'loading="lazy"';
                    wrapper.innerHTML += `
                        <a href="${cdnUrl}" data-pswp-width="1000" data-pswp-height="1000" target="_blank" class="slide skeleton" style="background-image:none; display:flex; align-items:center; justify-content:center; border: 1px solid #222;">
                            <img src="${cdnUrl}" ${loadAttr} style="width:100%; height:100%; object-fit:contain; opacity:0; transition:opacity 0.25s ease-in-out;" 
                            onload="this.style.opacity='1'; this.parentElement.setAttribute('data-pswp-width', this.naturalWidth); this.parentElement.setAttribute('data-pswp-height', this.naturalHeight); this.parentElement.classList.remove('skeleton'); this.parentElement.style.border='none';">
                        </a>`;
                }
                
                thumbs.innerHTML += `<div class="thumb" style="background-image:url('${currentThumb}'); position:relative;" onclick="setSlide(${index})">${isVideo ? '<span style="position:absolute; font-size:24px; color:#fff; text-shadow:0 0 5px #000; left:50%; top:50%; transform:translate(-50%, -50%);">▶</span>' : ''}</div>`;
            });
        } else {
            wrapper.innerHTML = `<a class="slide" style="background:#111; pointer-events:none;">НЕТ ФОТО</a>`;
        }
    }

    setSlide(0);

    // Мгновенная предзагрузка второй фотографии для моментального свайпа
    if (item.images && item.images.length > 1) {
        const toCDN = window.toCDN || ((u) => u);
        const nextImgUrl = toCDN(item.images[1]);
        if (!nextImgUrl.endsWith('.mp4')) {
            const preImg = new Image();
            preImg.src = nextImgUrl;
        }
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

    if (window.pswpLightbox) {
        try { window.pswpLightbox.init(); } catch (e) {} 
    }

    // Рендер похожих товаров
    const simCont = document.getElementById('similarItemsContainer');
    const simContDesktop = document.getElementById('similarItemsContainerDesktop');
    if (simCont || simContDesktop) {
        if (simCont) simCont.innerHTML = '';
        if (simContDesktop) simContDesktop.innerHTML = '';

        const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
        const catalog = getCatalog();
        
        let similar = catalog.filter(i => {
            if (i.id === item.id) return false;
            if (hideUnavailable && i.status !== 'available') return false;
            return (i.category === item.category || i.brand === item.brand);
        });
        
        if (similar.length < 6) {
            const priceMargin = item.price * 0.3;
            const extra = catalog.filter(i => {
                if (i.id === item.id || similar.includes(i)) return false;
                if (hideUnavailable && i.status !== 'available') return false;
                return i.price >= item.price - priceMargin && i.price <= item.price + priceMargin;
            });
            similar = [...similar, ...extra];
        }

        if (similar.length < 6) {
            const fallbackExtra = catalog.filter(i => {
                if (i.id === item.id || similar.includes(i)) return false;
                if (hideUnavailable && i.status !== 'available') return false;
                return true;
            });
            similar = [...similar, ...fallbackExtra];
        }
        
        similar = similar.sort(() => 0.5 - Math.random()).slice(0, 6);
        let seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
            
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
                        imageBlockHTML = `<img src="${sImg}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block; ${imageFilter} transition: 0.3s;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;font-family:var(--font-mono);\\'>ERROR</div>';">`;
                    }
                }

                cardsHTML += `
                    <div class="similar-item-card ${unseenClass}" 
                         onclick="openProductModalById('${s.id}')">
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
                <div class="badge-item danger-badge" onclick="showBadgeInfo('drop')">
                    <span class="badge-icon">${alertSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_drop">${typeof i18next !== 'undefined' ? i18next.t('product.badge_drop') : 'DROP ITEM'}</span>
                </div>`;
        } else if (isReturnable) {
            const returnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
            refundBadgeHTML = `
                <div class="badge-item" onclick="showBadgeInfo('refund_yes')">
                    <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${returnSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_refund">${typeof i18next !== 'undefined' ? i18next.t('product.badge_refund') : 'ВОЗВРАТ 14 ДНЕЙ'}</span>
                </div>`;
        } else {
            const noReturnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
            refundBadgeHTML = `
                <div class="badge-item" onclick="showBadgeInfo('refund_no')">
                    <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${noReturnSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_norefund">${typeof i18next !== 'undefined' ? i18next.t('product.badge_norefund') : 'БЕЗ ВОЗВРАТА'}</span>
                </div>`;
        }

        const secureSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;

        badgesContainer.innerHTML = `
            <div class="badge-item" onclick="showBadgeInfo('secure')">
                <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${secureSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_orig">${typeof i18next !== 'undefined' ? i18next.t('product.badge_orig') : '100% ОРИГИНАЛ'}</span>
            </div>
            <div class="badge-item" onclick="showBadgeInfo('fast')">
                <span class="badge-icon">24H</span> 
                <span class="badge-text" data-i18n="product.badge_fast">${typeof i18next !== 'undefined' ? i18next.t('product.badge_fast') : 'БЫСТРАЯ ОТПРАВКА'}</span>
            </div>
            ${refundBadgeHTML}
        `;
    }

    const modal = document.getElementById('productModal');
    if (modal) modal.style.display = 'flex';
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
window.openProductModal = openProductModal;

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

        const currentTime = new Date().getTime();
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

    if (navigator.share) {
        navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
        }).catch(() => {
            console.log('Шеринг отменен пользователем');
        });
    } else {
        if (navigator.clipboard) {
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
}
window.shareItem = shareItem;

// ==========================================
// 4. ИСТОРИЯ ПРОСМОТРОВ (VIEWING HISTORY)
// ==========================================

function addToHistory(item) {
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    hist = hist.filter(i => i.id !== item.id);
    const img = (item.images && item.images.length > 0) ? item.images[0] : '';
    
    hist.unshift({ 
        id: item.id, 
        name: item.name, 
        price: item.price, 
        old_price: item.old_price, 
        is_sale: item.is_sale, 
        img: img 
    });
    
    if (hist.length > 30) hist = hist.slice(0, 30); 
    
    localStorage.setItem('nisha_history', JSON.stringify(hist));
    renderHistory();
}
window.addToHistory = addToHistory;

function renderHistory() {
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    const container = document.getElementById('historyGrid');
    const section = document.getElementById('historySection');
    
    if(!container || !section) return;

    const catalog = getCatalog();
    if (catalog.length > 0) {
        const validHist = hist.filter(h => catalog.some(dbItem => dbItem.id === h.id));
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
    
    const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;

    hist.forEach(h => {
        const realItem = catalog.find(i => i.id === h.id);
        const currentStatus = realItem ? realItem.status : 'available';

        if (hideUnavailable && currentStatus !== 'available') return;

        const optImg = h.img;
        const isVideo = optImg && optImg.endsWith('.mp4');
        
        let finalPriceHTML = '';
        const curr = typeof getCurrency === 'function' ? getCurrency() : 'грн';
        if (h.is_sale && h.old_price) {
            finalPriceHTML = `<span style="color:#4a704a; text-decoration:line-through; font-size:10px; margin-right:4px;">${h.old_price}</span>${h.price} ${curr}`;
        } else {
            finalPriceHTML = `${h.price} ${curr}`;
        }

        let statusOverlayHTML = '';
        let imageFilter = '';

        if (currentStatus === 'sold') {
            statusOverlayHTML = `<div class="sold-badge" style="font-size: 16px !important; letter-spacing: 2px !important; padding: 2px 10px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">SOLD</div>`;
            imageFilter = 'filter: grayscale(80%) brightness(0.5);'; 
        } else if (currentStatus === 'reserved') {
            statusOverlayHTML = `<div class="reserved-badge" style="font-size: 14px !important; letter-spacing: 1px !important; padding: 2px 5px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">RESERVED</div>`;
        }

        const card = document.createElement('div');
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
    
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    hist = hist.filter(item => item.id !== itemId);
    localStorage.setItem('nisha_history', JSON.stringify(hist));
    
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
    let questionData = JSON.parse(localStorage.getItem('nisha_questions') || '{"date":"","count":0}');
    
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
    
    const { data, error } = await sb.from('item_questions').select('*').eq('item_id', itemId).order('created_at', { ascending: true });
    
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

// Подписка на обновление вопросов в реальном времени
function initProductQASubscription() {
    const sb = getSupabase();
    if (sb) {
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

