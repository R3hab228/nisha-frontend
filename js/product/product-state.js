// ==========================================
// NISHA PRODUCT SHARED STATE, SEO, PRE-WARM & SCORING MODULE
// ==========================================

/** Shared mutable product modal state synchronized with window globals. */
export const productState = {
    currentOpenedItem: (typeof window !== 'undefined' && window.currentOpenedItem) || null,
    currentSlide: (typeof window !== 'undefined' && typeof window.currentSlide === 'number') ? window.currentSlide : 0,
    isSubmittingBargainOffer: false
};

if (typeof window !== 'undefined' && typeof window.currentOpenedItem === 'undefined') {
    window.currentOpenedItem = null;
}

/**
 * Returns the currently active product item from window or shared state.
 * @returns {object|null}
 */
export function getActiveOpenedItem() {
    if (typeof window !== 'undefined' && window.currentOpenedItem) {
        return window.currentOpenedItem;
    }
    return productState.currentOpenedItem;
}

/**
 * Sets the active product item in both shared state and window global.
 * @param {object|null} item
 */
export function setActiveOpenedItem(item) {
    productState.currentOpenedItem = item || null;
    if (typeof window !== 'undefined') {
        window.currentOpenedItem = item || null;
    }
}

/**
 * Returns active slider slide index.
 * @returns {number}
 */
export function getActiveSlideIndex() {
    if (typeof window !== 'undefined' && typeof window.currentSlide === 'number') {
        return window.currentSlide;
    }
    return productState.currentSlide;
}

/**
 * Sets active slider slide index in both shared state and window global.
 * @param {number} index
 */
export function setActiveSlideIndex(index) {
    productState.currentSlide = index;
    if (typeof window !== 'undefined') {
        window.currentSlide = index;
    }
}

/**
 * Resolves CDN image URL via global toCDN helper when available.
 * @param {string} u
 * @param {object} [opts]
 * @returns {string}
 */
export function toCDN(u, opts) {
    return (typeof window !== 'undefined' && typeof window.toCDN === 'function') ? window.toCDN(u, opts) : (u || '');
}

/**
 * Returns current favorites list.
 * @returns {any[]}
 */
export function getFavs() {
    return (typeof window !== 'undefined' && window.favorites) || (typeof favorites !== 'undefined' ? favorites : []);
}

/**
 * Returns authenticated user or null.
 * @returns {object|null}
 */
export function getUser() {
    return (typeof window !== 'undefined' && window.currentUser) || (typeof currentUser !== 'undefined' ? currentUser : null);
}

/**
 * Returns client fingerprint identifier.
 * @returns {string}
 */
export function getFingerprint() {
    return (typeof window !== 'undefined' && window.clientFingerprint) || (typeof clientFingerprint !== 'undefined' ? clientFingerprint : 'guest_' + Date.now());
}

/**
 * Returns Supabase client if available.
 * @returns {object|null}
 */
export function getSupabaseClient() {
    if (typeof getSupabase === 'function') return getSupabase();
    if (typeof window !== 'undefined' && typeof window.getSupabase === 'function') return window.getSupabase();
    return (typeof window !== 'undefined' && window.supabaseClient) || null;
}

/**
 * Returns in-memory catalog array.
 * @returns {object[]}
 */
export function getCatalogItems() {
    if (typeof getCatalog === 'function') return getCatalog();
    if (typeof window !== 'undefined' && typeof window.getCatalog === 'function') return window.getCatalog();
    return (typeof window !== 'undefined' && window.allItems) || [];
}

/**
 * Returns persistent storage wrapper if present.
 * @returns {object|null}
 */
export function getStore() {
    return (typeof window !== 'undefined' && window.storage) || (typeof storage !== 'undefined' ? storage : null);
}

/**
 * Returns current active cart array safely.
 * @returns {object[]}
 */
export function getActiveCartSafe() {
    if (typeof window !== 'undefined' && typeof window.getActiveCart === 'function') {
        return window.getActiveCart();
    }
    if (typeof getActiveCart === 'function') {
        return getActiveCart();
    }
    if (typeof window !== 'undefined' && window.store && typeof window.store.get === 'function') {
        return window.store.get('cart') || [];
    }
    return (typeof window !== 'undefined' && window.cart) || [];
}

/**
 * Escapes HTML special characters.
 * @param {any} s
 * @returns {string}
 */
export function getEscHtml(s) {
    if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function') return window.escapeHtml(s);
    return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Escapes HTML attribute special characters.
 * @param {any} s
 * @returns {string}
 */
export function getEscAttr(s) {
    if (typeof window !== 'undefined' && typeof window.escapeAttr === 'function') return window.escapeAttr(s);
    return String(s ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Extracts bargain eligibility and minimum accepted price from an item.
 * @param {object|null} item
 * @returns {{ hasBargain: boolean, itemMinBargain: number|null }}
 */
export function parseItemBargainInfo(item) {
    if (!item) return { hasBargain: false, itemMinBargain: null };
    const descMatch = (typeof item.description === 'string') && item.description.match(/\[ТОРГ:?\s*(?:(?:від|от)\s*)?(\d+)/i);
    const itemMinBargain = item.min_bargain_price || (descMatch ? Number.parseInt(descMatch[1], 10) : null);
    const hasBargain = Boolean(item.is_bargain || itemMinBargain || (typeof item.description === 'string' && /\[ТОРГ/i.test(item.description)));
    return { hasBargain, itemMinBargain };
}

/**
 * Reads persisted bargain offer state (declined, accepted, or valid 24h pending) for an item.
 * @param {string|number} itemId
 * @returns {{ isAcceptedBargain: boolean, isDeclinedBargain: boolean, isPendingBargain: boolean, acceptedData: object|null }}
 */
export function getBargainOfferState(itemId) {
    let isAcceptedBargain = false;
    let isDeclinedBargain = false;
    let isPendingBargain = false;
    let acceptedData = null;

    try {
        const sId = String(itemId);
        if (sessionStorage.getItem('declined_bargain_' + sId) || localStorage.getItem('declined_bargain_' + sId)) {
            isDeclinedBargain = true;
        } else {
            const savedAcc = sessionStorage.getItem('accepted_bargain_' + sId) || localStorage.getItem('accepted_bargain_' + sId);
            if (savedAcc) {
                const parsed = JSON.parse(savedAcc);
                if (parsed && parsed.acceptedPrice) {
                    isAcceptedBargain = true;
                    acceptedData = parsed;
                }
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
    } catch {}

    return { isAcceptedBargain, isDeclinedBargain, isPendingBargain, acceptedData };
}

/**
 * Updates #modalOfferPriceBtn visual state uniformly.
 * @param {HTMLElement|null} offerPriceBtn
 * @param {'declined'|'accepted'|'pending'|'default'} state
 * @param {string} [labelOverride]
 */
export function applyOfferButtonState(offerPriceBtn, state, labelOverride) {
    if (!offerPriceBtn) return;
    const t = (key, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
        ? i18next.t(key, { defaultValue: def })
        : def;

    if (state === 'declined') {
        offerPriceBtn.innerText = labelOverride || t('product.offer_declined_btn', 'ПРОПОЗИЦІЮ ВІДХИЛЕНО');
        offerPriceBtn.style.borderColor = 'var(--accent-red, #ff3333)';
        offerPriceBtn.style.color = 'var(--accent-red, #ff3333)';
        offerPriceBtn.style.pointerEvents = 'none';
        offerPriceBtn.style.cursor = 'default';
        offerPriceBtn.style.boxShadow = 'none';
        offerPriceBtn.disabled = true;
        return;
    }
    if (state === 'accepted') {
        offerPriceBtn.innerText = labelOverride || t('product.offer_accepted_btn', 'ПРОПОЗИЦІЮ ПРИЙНЯТО ✓');
        offerPriceBtn.style.borderColor = 'var(--accent-yellow, #ffd700)';
        offerPriceBtn.style.color = 'var(--accent-yellow, #ffd700)';
        offerPriceBtn.style.pointerEvents = 'none';
        offerPriceBtn.style.cursor = 'default';
        offerPriceBtn.style.boxShadow = 'none';
        offerPriceBtn.disabled = true;
        return;
    }
    if (state === 'pending') {
        offerPriceBtn.innerText = labelOverride || t('product.offer_pending', '[ ПРОПОЗИЦІЮ НАДІСЛАНО ✓ ]');
        offerPriceBtn.style.borderColor = 'var(--accent-green, #00ff66)';
        offerPriceBtn.style.color = 'var(--accent-green, #00ff66)';
        offerPriceBtn.style.pointerEvents = 'none';
        offerPriceBtn.style.cursor = 'default';
        offerPriceBtn.style.boxShadow = 'none';
        offerPriceBtn.disabled = true;
        return;
    }

    offerPriceBtn.innerText = labelOverride || t('product.offer_price', '[ ЗАПРОПОНУВАТИ СВОЮ ЦІНУ ]');
    offerPriceBtn.style.borderColor = '#333';
    offerPriceBtn.style.color = 'var(--accent-green, #00ff66)';
    offerPriceBtn.style.pointerEvents = 'auto';
    offerPriceBtn.style.cursor = 'pointer';
    offerPriceBtn.style.boxShadow = 'none';
    offerPriceBtn.disabled = false;
}

/**
 * Computes multi-factor similarity score between two catalog items.
 * @param {object} source
 * @param {object} target
 * @returns {number}
 */
export function computeItemSimilarity(source, target) {
    if (!source || !target) return 0;
    let score = 0;

    // 1. Совпадение категории (+50)
    const srcCat = (source.category || '').toLowerCase().trim();
    const tgtCat = (target.category || '').toLowerCase().trim();
    if (srcCat && tgtCat && srcCat === tgtCat) score += 50;

    // 2. Совпадение бренда (+40)
    const srcBrand = (source.brand || '').toLowerCase().trim();
    const tgtBrand = (target.brand || '').toLowerCase().trim();
    if (srcBrand && tgtBrand && srcBrand === tgtBrand) score += 40;

    // 3. Совпадение размера (+35 за точный, +20 за совместимый)
    const srcSize = (source.size || '').toLowerCase().replace(/[\s\-_]/g, '');
    const tgtSize = (target.size || '').toLowerCase().replace(/[\s\-_]/g, '');
    if (srcSize && tgtSize) {
        if (srcSize === tgtSize) score += 35;
        else if (srcSize.includes(tgtSize) || tgtSize.includes(srcSize)) score += 20;
    }

    // 4. Доступность
    if (target.status === 'available') score += 30;
    else if (target.status === 'reserved') score += 5;

    // 5. Близость цены (до +20)
    const p1 = Number(source.price) || 0;
    const p2 = Number(target.price) || 0;
    if (p1 > 0 && p2 > 0) {
        const diffRatio = Math.abs(p1 - p2) / p1;
        if (diffRatio <= 0.15) score += 20;
        else if (diffRatio <= 0.35) score += 12;
        else if (diffRatio <= 0.60) score += 6;
    }

    // 6. Теги (до +20)
    const srcTags = Array.isArray(source.tags) ? source.tags.map(t => String(t).toLowerCase().trim()) : [];
    const tgtTags = Array.isArray(target.tags) ? target.tags.map(t => String(t).toLowerCase().trim()) : [];
    if (srcTags.length > 0 && tgtTags.length > 0) {
        let tagMatches = 0;
        srcTags.forEach(t => {
            if (tgtTags.includes(t)) tagMatches++;
        });
        score += Math.min(20, tagMatches * 10);
    }

    // 7. Свежесть / Скидка + естественный джиттер
    if (target.is_top) score += 5;
    if (target.is_sale) score += 5;
    score += Math.random() * 8;

    return score;
}

// ==========================================
// УМНЫЙ УПРЕЖДАЮЩИЙ PRELOAD МОДАЛКИ ТОВАРА (SMART PRE-WARM)
// ==========================================
export const _prewarmedItemDetails = new Map();
export const _prewarmedImagesSet = new Set();
let _prewarmDebounceTimer = null;
let _prewarmPendingId = null;

/**
 * Checks whether browser Save-Data or slow connection mode is active.
 * @returns {boolean}
 */
export function isDataSaverActive() {
    if (typeof window !== 'undefined' && typeof window.isSaveDataMode === 'function') {
        return window.isSaveDataMode();
    }
    try {
        if (typeof navigator !== 'undefined' && navigator.connection) {
            const conn = navigator.connection;
            if (conn.saveData === true) return true;
            if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return true;
        }
    } catch {}
    return false;
}

/**
 * Fetches full product details from Supabase `items` or `archived_items` with legacy column fallback.
 * @param {string|number} itemId
 * @returns {Promise<object|null>}
 */
export async function fetchFullItemFromDb(itemId) {
    const sb = getSupabaseClient();
    if (!sb) return null;

    let { data, error: itemErr } = await sb.from('items')
        .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable, is_bargain, min_bargain_price')
        .eq('id', itemId)
        .limit(1);

    if (itemErr && (itemErr.message?.includes('is_bargain') || itemErr.message?.includes('min_bargain_price') || itemErr.code === '42703' || itemErr.code === 'PGRST204')) {
        const retryRes = await sb.from('items')
            .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable')
            .eq('id', itemId)
            .limit(1);
        data = retryRes.data;
    }

    if (data && data.length > 0) return data.at(0);

    const { data: archData } = await sb.from('archived_items')
        .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, description, is_drop, tags, is_returnable')
        .eq('id', itemId)
        .limit(1);

    if (archData && archData.length > 0) return archData.at(0);
    return null;
}

/**
 * Speculatively fetches and caches full item details in LRU-capped map.
 * @param {string|number} itemId
 * @returns {Promise<object|null>}
 */
export function prewarmItemDetails(itemId) {
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
            return await fetchFullItemFromDb(itemId);
        } catch (_) {
            return null;
        }
    })();

    _prewarmedItemDetails.set(key, fetchPromise);
    return fetchPromise;
}

/**
 * Speculatively pre-warms product modal data, PhotoSwipe, and primary images.
 * @param {string|number} id
 * @param {boolean} [immediate=false]
 */
export function prewarmProductModal(id, immediate = false) {
    if (!id) return;
    const itemIdStr = String(id);

    const executePrewarm = () => {
        const catalog = getCatalogItems();
        const item = catalog.find(i => String(i.id) === itemIdStr);

        // 1. Предзагрузка полных данных из БД
        prewarmItemDetails(id);

        // 2. Фоновый прогрев PhotoSwipe в idle-время
        if (typeof ensurePhotoSwipe === 'function') {
            if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
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
                if (url && typeof url === 'string' && !url.endsWith('.mp4')) {
                    const cdnUrl = typeof toCDN === 'function' ? toCDN(url) : url;
                    if (!_prewarmedImagesSet.has(cdnUrl)) {
                        _prewarmedImagesSet.add(cdnUrl);
                        if (_prewarmedImagesSet.size > 100) {
                            const first = _prewarmedImagesSet.values().next().value;
                            _prewarmedImagesSet.delete(first);
                        }
                        const img = new Image();
                        img.decoding = 'async';
                        img.fetchPriority = 'high';
                        img.src = cdnUrl;
                        if (typeof img.decode === "function") img.decode().catch(() => {});
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

/**
 * Cancels pending debounced pre-warm when pointer leaves product card.
 * @param {string|number} id
 */
export function cancelPrewarmProductModal(id) {
    if (_prewarmPendingId && String(_prewarmPendingId) === String(id)) {
        clearTimeout(_prewarmDebounceTimer);
        _prewarmPendingId = null;
    }
}

/**
 * Updates or creates an OpenGraph / Twitter meta tag.
 * @param {string} property
 * @param {string} content
 */
export function setMetaTag(property, content) {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    let tag = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
    if (!tag && document.head && typeof document.createElement === 'function' && typeof document.head.appendChild === 'function') {
        tag = document.createElement('meta');
        if (property.startsWith('og:')) tag.setAttribute('property', property);
        else tag.setAttribute('name', property);
        document.head.appendChild(tag);
    }
    if (tag && typeof tag.setAttribute === 'function') {
        tag.setAttribute('content', content);
    }
}

/**
 * Updates JSON-LD schema.org Product script and OpenGraph / Twitter meta tags for opened item.
 * @param {object} item
 * @param {string} cleanDesc
 */
export function updateProductSeoAndOg(item, cleanDesc) {
    if (typeof document === 'undefined') return;
    let schemaScript = typeof document.getElementById === 'function' ? document.getElementById('seo-schema') : null;
    if (!schemaScript && document.head && typeof document.createElement === 'function' && typeof document.head.appendChild === 'function') {
        schemaScript = document.createElement('script');
        schemaScript.id = 'seo-schema';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
    }
    const schemaData = {
        "@context": "https://schema.org",
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
    if (schemaScript) schemaScript.textContent = JSON.stringify(schemaData);

    const statusPrefix = item.status === 'sold' ? '🔴 SOLD | ' : (item.status === 'reserved' ? '🟡 RESERVED | ' : '🟢 ');
    const ogTitle = `${statusPrefix}NISHA: ${item.brand} - ${item.name}`;
    const formattedOgPrice = (typeof formatPrice === 'function') ? formatPrice(item.price) : `${item.price} грн.`;
    const truncatedDesc = cleanDesc
        ? ((typeof window !== 'undefined' && typeof window.safeTruncateText === 'function') ? window.safeTruncateText(cleanDesc, 150) : cleanDesc.slice(0, 150))
        : '';
    const ogDesc = `Размер: ${item.size} | Цена: ${formattedOgPrice} ${truncatedDesc}`;
    const ogImage = (item.images && item.images.length > 0) ? item.images.at(0) : 'https://www.nisha-store.shop/icon-512.png';
    const safeItemId = (typeof window !== 'undefined' && typeof window.safeEncodeURIComponent === 'function')
        ? window.safeEncodeURIComponent(item.id)
        : encodeURIComponent(item.id);
    const ogUrl = `https://www.nisha-store.shop/?item=${safeItemId}`;

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

/**
 * Resets OpenGraph tags and removes dynamic Product JSON-LD script when closing modal.
 */
export function resetOpenGraphTags() {
    const updater = (typeof window !== 'undefined' && typeof window.setMetaTag === 'function') ? window.setMetaTag : setMetaTag;
    updater('og:title', 'NISHA | Underground Store');
    updater('og:description', 'NISHA — винтажная одежда, обувь и аксессуары. Доставка Новой Почтой по всей Украине.');
    updater('og:image', 'https://www.nisha-store.shop/og-image.png');
    updater('og:image:secure_url', 'https://www.nisha-store.shop/og-image.png');
    updater('og:image:width', '1200');
    updater('og:image:height', '630');
    updater('og:url', 'https://www.nisha-store.shop/');
    updater('og:type', 'website');
    updater('twitter:title', 'NISHA | Underground Store');
    updater('twitter:description', 'NISHA — винтажная одежда, обувь и аксессуары. Доставка Новой Почтой по всей Украине.');
    updater('twitter:image', 'https://www.nisha-store.shop/og-image.png');
    updater('twitter:url', 'https://www.nisha-store.shop/');
    const schemaScript = typeof document !== 'undefined' && typeof document.getElementById === 'function'
        ? document.getElementById('seo-schema')
        : null;
    if (schemaScript && typeof schemaScript.remove === 'function') schemaScript.remove();
}

if (typeof window !== 'undefined') {
    window.computeItemSimilarity = computeItemSimilarity;
    window._prewarmedItemDetails = _prewarmedItemDetails;
    window._prewarmedImagesSet = _prewarmedImagesSet;
    window.prewarmProductModal = prewarmProductModal;
    window.cancelPrewarmProductModal = cancelPrewarmProductModal;
    window.prewarmItemDetails = prewarmItemDetails;
    window.setMetaTag = setMetaTag;
    window.resetOpenGraphTags = resetOpenGraphTags;
}
