import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

function createClassList(initial = []) {
    const set = new Set(initial);
    return {
        add: (...names) => names.forEach(n => n && set.add(n)),
        remove: (...names) => names.forEach(n => n && set.delete(n)),
        contains: (name) => set.has(name),
        toggle: (name, force) => {
            const shouldAdd = typeof force === 'boolean' ? force : !set.has(name);
            if (shouldAdd) set.add(name);
            else set.delete(name);
            return shouldAdd;
        },
        toString: () => Array.from(set).join(' ')
    };
}

function createFakeEl(tagName = 'div') {
    const listeners = new Map();
    const attrs = new Map();
    const styleMap = new Map();
    const el = {
        tagName: tagName.toUpperCase(),
        id: '',
        type: '',
        value: '',
        href: '',
        src: '',
        alt: '',
        innerText: '',
        textContent: '',
        _innerHTML: '',
        checked: false,
        disabled: false,
        inert: false,
        placeholder: '',
        scrollTop: 0,
        offsetWidth: 100,
        complete: false,
        naturalWidth: 0,
        naturalHeight: 0,
        dataset: {},
        parentElement: null,
        children: [],
        _queryResults: new Map(),
        classList: createClassList(),
        style: {
            setProperty: (k, v) => styleMap.set(k, String(v)),
            removeProperty: (k) => styleMap.delete(k),
            getPropertyValue: (k) => styleMap.get(k) || '',
            set display(v) { styleMap.set('display', v); },
            get display() { return styleMap.get('display') || ''; },
            set opacity(v) { styleMap.set('opacity', String(v)); },
            get opacity() { return styleMap.get('opacity') || ''; },
            set visibility(v) { styleMap.set('visibility', v); },
            get visibility() { return styleMap.get('visibility') || ''; },
            set transform(v) { styleMap.set('transform', v); },
            get transform() { return styleMap.get('transform') || ''; },
            set pointerEvents(v) { styleMap.set('pointer-events', v); },
            get pointerEvents() { return styleMap.get('pointer-events') || ''; },
            set overflow(v) { styleMap.set('overflow', v); },
            get overflow() { return styleMap.get('overflow') || ''; },
            set width(v) { styleMap.set('width', v); },
            get width() { return styleMap.get('width') || ''; },
            set maxHeight(v) { styleMap.set('maxHeight', v); },
            get maxHeight() { return styleMap.get('maxHeight') || ''; },
            set transition(v) { styleMap.set('transition', v); },
            get transition() { return styleMap.get('transition') || ''; },
            set animation(v) { styleMap.set('animation', v); },
            get animation() { return styleMap.get('animation') || ''; },
            set backgroundColor(v) { styleMap.set('backgroundColor', v); },
            get backgroundColor() { return styleMap.get('backgroundColor') || ''; },
            set borderColor(v) { styleMap.set('borderColor', v); },
            get borderColor() { return styleMap.get('borderColor') || ''; },
            set color(v) { styleMap.set('color', v); },
            get color() { return styleMap.get('color') || ''; },
            set cursor(v) { styleMap.set('cursor', v); },
            get cursor() { return styleMap.get('cursor') || ''; },
            set boxShadow(v) { styleMap.set('boxShadow', v); },
            get boxShadow() { return styleMap.get('boxShadow') || ''; }
        },
        set innerHTML(v) { el._innerHTML = String(v); },
        get innerHTML() { return el._innerHTML; },
        addEventListener: (ev, fn) => {
            if (!listeners.has(ev)) listeners.set(ev, []);
            listeners.get(ev).push(fn);
        },
        dispatchEvent: (ev) => {
            const list = listeners.get(ev.type) || [];
            list.forEach(fn => fn(ev));
        },
        setAttribute: (k, v) => {
            attrs.set(k, String(v));
            if (k === 'id') el.id = String(v);
        },
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        hasAttribute: (k) => attrs.has(k),
        removeAttribute: (k) => attrs.delete(k),
        closest: (sel) => {
            if (sel === '.slide' || sel === 'a.slide') return el.classList.contains('slide') ? el : null;
            if (sel === '.modal-window') return el.classList.contains('modal-window') ? el : null;
            return null;
        },
        querySelector: (sel) => el._queryResults.get(sel) || null,
        querySelectorAll: (sel) => el._queryResults.get(sel) || [],
        appendChild: (child) => {
            child.parentElement = el;
            el.children.push(child);
            return child;
        },
        replaceChildren: () => {
            el.children = [];
            el._innerHTML = '';
        },
        remove: vi.fn(),
        focus: vi.fn(),
        blur: vi.fn(),
        play: vi.fn(() => Promise.resolve()),
        pause: vi.fn(),
        scrollTo: vi.fn()
    };
    return el;
}

describe('Modular Product, Gallery, History, Q&A & Bargain Deep Suite (js/product/*.js)', () => {
    let productMod;
    let elementsById;
    let querySelectors;
    let allQuerySelectors;
    let docListeners;
    let localMap;
    let sessionMap;
    let showToast;
    let openModal;
    let closeModal;
    let triggerHaptic;
    let mockImages;

    beforeAll(async () => {
        elementsById = new Map();
        querySelectors = new Map();
        allQuerySelectors = new Map();
        docListeners = new Map();
        localMap = new Map();
        sessionMap = new Map();
        mockImages = [];

        const makeStoreApi = (map) => ({
            getItem: (k) => (map.has(k) ? map.get(k) : null),
            setItem: (k, v) => map.set(String(k), String(v)),
            removeItem: (k) => map.delete(String(k)),
            clear: () => map.clear(),
            get length() { return map.size; },
            key: (i) => Array.from(map.keys())[i] || null
        });

        global.localStorage = makeStoreApi(localMap);
        global.sessionStorage = makeStoreApi(sessionMap);

        showToast = vi.fn();
        openModal = vi.fn();
        closeModal = vi.fn();
        triggerHaptic = vi.fn();

        global.showToast = showToast;
        global.openModal = openModal;
        global.closeModal = closeModal;
        global.triggerHaptic = triggerHaptic;
        global.formatPrice = (v, opts) => (opts?.numberOnly ? `${v}` : `${v} грн`);
        global.getCurrency = () => 'грн';
        global.normalizeSiteLang = (l) => (l === 'ru' || l === 'en' ? l : 'ua');
        global.DOMPurify = { sanitize: (s) => String(s || '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '') };
        global.Image = class MockImage {
            constructor() {
                this.decoding = '';
                this.fetchPriority = '';
                this._src = '';
                mockImages.push(this);
            }
            set src(v) { this._src = v; }
            get src() { return this._src; }
            decode() { return Promise.resolve(); }
        };

        global.window = global.window || global;
        Object.assign(global.window, {
            location: new URL('https://www.nisha-store.shop/?item=p-99'),
            history: { replaceState: vi.fn((_s, _t, u) => { global.window.location = new URL(u, 'https://www.nisha-store.shop'); }) },
            innerWidth: 1200,
            scrollY: 320,
            stopLenis: vi.fn(),
            showToast,
            openModal,
            closeModal,
            triggerHaptic,
            toCDN: (u, opts) => (u ? (opts?.isThumb ? `${u}?thumb=1` : u) : ''),
            escapeHtml: (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
            escapeAttr: (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'),
            sanitizeText: (s) => String(s ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
            safeTruncateText: (s, n) => String(s || '').slice(0, n),
            safeEncodeURIComponent: (s) => encodeURIComponent(String(s)),
            getOptimizedImg: (it, isThumb) => (isThumb ? it?.thumbnails?.[0] : it?.images?.[0]) || it?.images?.[0] || '',
            apiClient: { post: vi.fn(), get: vi.fn(), getBaseUrl: () => 'https://nisha-api.onrender.com' },
            storage: {
                get: (k, d = null) => (localMap.has(k) ? localMap.get(k) : d),
                getJSON: (k, d = null) => {
                    if (!localMap.has(k)) return d;
                    try { return JSON.parse(localMap.get(k)); } catch { return d; }
                },
                setJSON: (k, v) => localMap.set(k, JSON.stringify(v))
            },
            allItems: [],
            favorites: [],
            _seenItemsSet: new Set()
        });
        global.storage = global.window.storage;
        global.escapeHtml = global.window.escapeHtml;
        global.escapeAttr = global.window.escapeAttr;
        global.getOptimizedImg = global.window.getOptimizedImg;
        global.ensurePhotoSwipe = vi.fn(() => Promise.resolve());
        global.openProfileModal = vi.fn();
        global.i18next = {
            language: 'ru',
            t: vi.fn((key, opts) => (opts && opts.defaultValue) ? opts.defaultValue : key)
        };
        global.requestAnimationFrame = (cb) => { cb(); return 1; };

        const headEl = createFakeEl('head');
        const bodyEl = createFakeEl('body');
        global.document = {
            readyState: 'complete',
            title: 'NISHA',
            head: headEl,
            body: bodyEl,
            documentElement: { scrollTop: 0 },
            activeElement: null,
            createElement: (tag) => createFakeEl(tag),
            createDocumentFragment: () => {
                const children = [];
                return { children, appendChild: (c) => children.push(c) };
            },
            getElementById: (id) => elementsById.get(id) || null,
            querySelector: (sel) => querySelectors.get(sel) || null,
            querySelectorAll: (sel) => allQuerySelectors.get(sel) || [],
            addEventListener: (ev, fn) => {
                if (!docListeners.has(ev)) docListeners.set(ev, []);
                docListeners.get(ev).push(fn);
            }
        };

        productMod = await import('../js/product/product.js');
    });

    beforeEach(() => {
        elementsById.clear();
        querySelectors.clear();
        allQuerySelectors.clear();
        localMap.clear();
        sessionMap.clear();
        mockImages.length = 0;
        document.head.children = [];
        document.body.style.overflow = '';
        window.allItems = [];
        window.favorites = [];
        window.currentUser = null;
        window.userProfile = null;
        window.isHacked = false;
        window.Telegram = undefined;
        window.currentOpenedItem = null;
        window._prewarmedItemDetails.clear();
        window._prewarmedImagesSet.clear();
        window.apiClient.post.mockReset();
        window.apiClient.get.mockReset();
        showToast.mockReset();
        openModal.mockReset();
        closeModal.mockReset();
        triggerHaptic.mockReset();
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('1. Exports full public API from product.js and binds window.* globals cleanly', () => {
        const expected = [
            'computeItemSimilarity',
            'prewarmItemDetails',
            'prewarmProductModal',
            'cancelPrewarmProductModal',
            'setMetaTag',
            'updateProductSeoAndOg',
            'resetOpenGraphTags',
            'preloadSlide',
            'updateSlider',
            'moveSlide',
            'setSlide',
            'renderModalSlider',
            'openProductPhotoZoom',
            'initSliderSwipe',
            'shareItem',
            'renderSimilarItems',
            'addToHistory',
            'renderHistory',
            'toggleHistory',
            'removeHistoryItem',
            'toggleQuestionForm',
            'submitQuestion',
            'loadItemQuestions',
            'toggleAccordion',
            'toggleQASection',
            'initProductQASubscription',
            'getBestBuyerContact',
            'checkClientBargainRateLimit',
            'recordClientBargainOffer',
            'openOfferPriceModal',
            'submitBargainOffer',
            'showInlineOfferPriceInput',
            'hideInlineOfferPriceInput',
            'submitInlineBargainOffer',
            'syncUserBargains',
            'openProductModalById',
            'openProductModal',
            'toggleFavFromModal',
            'initProductModule'
        ];
        expected.forEach(fn => expect(typeof productMod[fn]).toBe('function'));
        expect(typeof window.openProductModal).toBe('function');
        expect(typeof window.openProductPhotoZoom).toBe('function');
        expect(typeof window.syncUserBargains).toBe('function');
        expect(typeof window.prewarmProductModal).toBe('function');
    });

    it('2. product-state.js scores similarity, pre-warms DB with column fallback, respects Save-Data & sets SEO JSON-LD', async () => {
        const src = { id: '1', category: 'Куртки', brand: 'Stone Island', size: 'L', price: 3000, tags: ['vintage', 'nylon'] };
        const closeMatch = { id: '2', category: 'Куртки', brand: 'Stone Island', size: 'L', price: 3200, status: 'available', tags: ['vintage'] };
        const weakMatch = { id: '3', category: 'Обувь', brand: 'Nike', size: '42', price: 800, status: 'sold', tags: ['sport'] };

        expect(productMod.computeItemSimilarity(src, closeMatch)).toBeGreaterThan(productMod.computeItemSimilarity(src, weakMatch) + 100);

        // Pre-warm handles legacy column fallback (error code 42703)
        let callIdx = 0;
        window.supabaseClient = {
            from: (table) => ({
                select: () => ({
                    eq: () => ({
                        limit: async () => {
                            callIdx++;
                            if (table === 'items' && callIdx === 1) {
                                return { data: null, error: { code: '42703', message: 'is_bargain does not exist' } };
                            }
                            return { data: [{ id: 'p-50', name: 'Arch Jacket', description: 'Warm shell' }], error: null };
                        }
                    })
                })
            })
        };

        window.allItems = [{ id: 'p-50', name: 'Arch Jacket', images: ['https://cdn/1.jpg', 'https://cdn/2.jpg', 'https://cdn/v.mp4'] }];
        window.isSaveDataMode = () => false;
        productMod.prewarmProductModal('p-50', true);

        const loaded = await window._prewarmedItemDetails.get('p-50');
        expect(loaded.description).toBe('Warm shell');
        expect(mockImages.map(i => i.src)).toEqual(['https://cdn/1.jpg', 'https://cdn/2.jpg']);

        // Save-Data skips image pre-decoding for another item
        window.isSaveDataMode = () => true;
        window.allItems.push({ id: 'p-51', images: ['https://cdn/3.jpg'] });
        productMod.prewarmProductModal('p-51', true);
        expect(mockImages.some(i => i.src === 'https://cdn/3.jpg')).toBe(false);

        // SEO JSON-LD & OpenGraph tags
        productMod.updateProductSeoAndOg({ id: 'p 50', name: 'Arch Jacket', brand: 'CP Company', size: 'M', price: 4500, status: 'available', images: ['https://cdn/1.jpg'] }, 'Cleaned desc');
        const seoEl = document.head.children.find(c => c.id === 'seo-schema');
        expect(seoEl).toBeDefined();
        const schema = JSON.parse(seoEl.textContent);
        expect(schema['@context']).toBe('https://schema.org');
        expect(schema['@type']).toBe('Product');
        expect(schema.offers.availability).toBe('https://schema.org/InStock');

        elementsById.set('seo-schema', seoEl);
        productMod.resetOpenGraphTags();
        expect(seoEl.remove).toHaveBeenCalled();
    });

    it('3. product-gallery.js renders slides/videos, handles touch swipes & initializes PhotoSwipe lightbox cleanly', async () => {
        const wrapper = createFakeEl('div');
        const thumbs = createFakeEl('div');
        const counter = createFakeEl('span');
        const prevBtn = createFakeEl('button');
        const nextBtn = createFakeEl('button');
        const sliderContainer = createFakeEl('div');

        elementsById.set('sliderWrapper', wrapper);
        elementsById.set('modalThumbnails', thumbs);
        elementsById.set('photoCounter', counter);
        elementsById.set('sliderContainer', sliderContainer);
        querySelectors.set('.slider-btn.prev', prevBtn);
        querySelectors.set('.slider-btn.next', nextBtn);

        const s1 = createFakeEl('a'); s1.classList.add('slide'); s1.href = 'https://cdn/1.jpg';
        const s2 = createFakeEl('div'); s2.classList.add('slide');
        const vid = createFakeEl('video');
        s2._queryResults.set('video.modal-video-player', vid);
        const s3 = createFakeEl('a'); s3.classList.add('slide'); s3.href = 'https://cdn/3.jpg';
        allQuerySelectors.set('.slide', [s1, s2, s3]);
        allQuerySelectors.set('#sliderWrapper .slide', [s1, s2, s3]);

        const th1 = createFakeEl('div'); const th2 = createFakeEl('div'); const th3 = createFakeEl('div');
        allQuerySelectors.set('.thumb', [th1, th2, th3]);

        const item = { id: 'g-1', images: ['https://cdn/1.jpg', 'https://cdn/2.mp4', 'https://cdn/3.jpg'] };
        productMod.setActiveOpenedItem(item);
        productMod.renderModalSlider(item);

        expect(wrapper.innerHTML).toContain('modal-video-player');
        expect(wrapper.innerHTML).toContain('fetchpriority="high" loading="eager"');
        expect(counter.innerText).toBe('1 / 3');
        expect(th1.classList.contains('active-thumb')).toBe(true);

        productMod.moveSlide(1);
        expect(counter.innerText).toBe('2 / 3');
        expect(vid.play).toHaveBeenCalled();
        expect(th2.classList.contains('active-thumb')).toBe(true);

        // Touch swipe next/prev
        productMod.setSlide(0, false);
        productMod.initSliderSwipe();
        sliderContainer.dispatchEvent({ type: 'touchstart', touches: [{ clientX: 250, clientY: 100 }] });
        sliderContainer.dispatchEvent({ type: 'touchmove', cancelable: true, preventDefault: vi.fn(), touches: [{ clientX: 140, clientY: 105 }] });
        sliderContainer.dispatchEvent({ type: 'touchend' });
        expect(window._isSliderSwiping).toBe(true);
        expect(counter.innerText).toBe('2 / 3');
        expect(vid.pause).toHaveBeenCalledTimes(2); // paused on initial renderModalSlider + setSlide(0, false)

        // PhotoSwipe ignores video slide in dataSource
        const imgInS1 = createFakeEl('img'); imgInS1.src = 'https://cdn/1.jpg'; imgInS1.naturalWidth = 1080; imgInS1.naturalHeight = 1440;
        const imgInS3 = createFakeEl('img'); imgInS3.src = 'https://cdn/3.jpg';
        s1._queryResults.set('img', imgInS1);
        s3._queryResults.set('img', imgInS3);
        wrapper._queryResults.set('a.slide', [s1, s3]);
        wrapper._queryResults.set('.slide', [s1, s2, s3]);

        const initSpy = vi.fn();
        const openSpy = vi.fn();
        window.PhotoSwipeLightbox = class FakeLightbox {
            constructor(opts) {
                this.opts = opts;
                this.handlers = {};
                this.pswp = { currIndex: 1 };
            }
            on(ev, fn) { this.handlers[ev] = fn; }
            init() { initSpy(this.opts.dataSource); }
            loadAndOpen(idx) { openSpy(idx); }
            destroy() {}
        };

        await productMod.openProductPhotoZoom(s3);
        expect(initSpy).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ src: 'https://cdn/1.jpg', width: 1080, height: 1440 }),
            expect.objectContaining({ src: 'https://cdn/3.jpg' })
        ]));
        expect(openSpy).toHaveBeenCalledWith(1);
    });

    it('4. product-history.js manages 30-item cap, similar items with bargain prices & localized share links', () => {
        const histGrid = createFakeEl('div');
        const histSec = createFakeEl('div');
        const simMob = createFakeEl('div');
        const simDesk = createFakeEl('div');
        elementsById.set('historyGrid', histGrid);
        elementsById.set('historySection', histSec);
        elementsById.set('similarItemsContainer', simMob);
        elementsById.set('similarItemsContainerDesktop', simDesk);

        const items = Array.from({ length: 32 }, (_, idx) => ({
            id: `h-${idx}`,
            name: `Item ${idx}`,
            brand: idx >= 30 ? 'Nike' : 'OtherBrand',
            category: idx >= 30 ? 'Outerwear' : 'OtherCat',
            size: 'M',
            price: 1000 + idx,
            status: 'available',
            views_count: idx === 0 ? 40 : 2,
            images: [`https://cdn/${idx}.jpg`]
        }));
        window.allItems = items;

        items.forEach(it => productMod.addToHistory(it));
        const storedHist = window.storage.getJSON('nisha_history', []);
        expect(storedHist).toHaveLength(30);
        expect(storedHist[0].id).toBe('h-31');

        const stopProp = vi.fn();
        productMod.removeHistoryItem({ stopPropagation: stopProp }, 'h-31');
        expect(stopProp).toHaveBeenCalled();
        expect(window.storage.getJSON('nisha_history', []).some(i => i.id === 'h-31')).toBe(false);

        // Similar items render accepted bargain highlight
        sessionStorage.setItem('accepted_bargain_h-30', JSON.stringify({ acceptedPrice: 777, originalPrice: 1030 }));
        productMod.renderSimilarItems(items[31]);
        expect(simDesk.innerHTML).toContain('777 грн');
        expect(simMob.innerHTML).toContain('similar-item-card');

        // Share localized prefix
        window.shareContent = vi.fn();
        window.currentSiteLang = 'en';
        productMod.setActiveOpenedItem({ id: 'h-5', brand: 'Prada', name: 'Nylon Cap', size: 'OS' });
        productMod.shareItem();
        expect(window.shareContent).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://www.nisha-store.shop/share/h-5?lang=en',
            title: 'NISHA | Prada - Nylon Cap'
        }));
    });

    it('5. product-qa.js enforces auth/length/daily rate limit, sanitizes Q&A output & handles Realtime updates', async () => {
        const qInput = createFakeEl('input');
        const qaWrap = createFakeEl('div');
        const qaList = createFakeEl('div');
        const formWrap = createFakeEl('div');
        elementsById.set('questionInput', qInput);
        elementsById.set('qaWrapper', qaWrap);
        elementsById.set('qaList', qaList);
        elementsById.set('questionFormContainer', formWrap);

        // Unauthenticated fails
        await productMod.submitQuestion('i-1');
        expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error');

        // Authenticated + too short
        window.currentUser = { id: 'u-1', email: 'buyer@nisha.shop' };
        qInput.value = 'hi';
        await productMod.submitQuestion('i-1');
        expect(window.apiClient.post).not.toHaveBeenCalled();

        // Valid question succeeds & increments daily quota
        qInput.value = 'Есть ли замеры рукава и плеч?';
        window.apiClient.post.mockResolvedValue({ success: true });
        await productMod.submitQuestion('i-1');
        expect(window.apiClient.post).toHaveBeenCalledWith(
            '/api/question',
            expect.objectContaining({ itemId: 'i-1', userId: 'u-1' }),
            expect.any(Object)
        );
        expect(window.storage.getJSON('nisha_questions').count).toBe(1);

        // Daily limit blocks 3rd question
        window.storage.setJSON('nisha_questions', { date: new Date().toISOString().slice(0, 10), count: 2 });
        qInput.value = 'А капюшон отстегивается?';
        window.apiClient.post.mockClear();
        await productMod.submitQuestion('i-1');
        expect(window.apiClient.post).not.toHaveBeenCalled();

        // loadItemQuestions escapes XSS
        window.supabaseClient = {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        order: async () => ({
                            data: [{ question: '<script>xss()</script>Length?', answer: '<b>68cm</b>', user_name: 'ali<e>' }]
                        })
                    })
                })
            })
        };
        await productMod.loadItemQuestions('i-1');
        expect(qaWrap.style.display).toBe('block');
        expect(qaList.innerHTML).not.toContain('<script>');
        expect(qaList.innerHTML).toContain('&lt;script&gt;');
    });

    it('6. product-bargain.js resolves contact priority, rate-limits, validates inline/modal offers & syncs cross-device state', async () => {
        // Priority: TG WebApp > Profile TG > Phone > Email
        localStorage.setItem('nisha_last_email', 'fallback@mail.com');
        expect(productMod.getBestBuyerContact()).toBe('fallback@mail.com');

        localStorage.setItem('nisha_last_phone', '+380991112233');
        expect(productMod.getBestBuyerContact()).toBe('+380991112233');

        window.userProfile = { telegram: 'https://t.me/taras_v' };
        expect(productMod.getBestBuyerContact()).toBe('@taras_v');

        window.Telegram = { WebApp: { initDataUnsafe: { user: { username: 'tg_live' } } } };
        expect(productMod.getBestBuyerContact()).toBe('@tg_live');

        // Setup inline offer UI + active item with min bargain 800
        vi.useFakeTimers();
        const activeItem = { id: 'b-1', name: 'Vintage Shell', price: 1200, is_bargain: true, description: 'Clean [ТОРГ: от 800]', images: ['https://cdn/b1.jpg'] };
        productMod.setActiveOpenedItem(activeItem);
        window.currentUser = { id: 'uid-99' };

        const modalBtn = createFakeEl('button');
        const inlineRow = createFakeEl('div');
        const inlineInput = createFakeEl('input');
        const inlineSubmitBtn = createFakeEl('button');
        const modalPriceEl = createFakeEl('div');
        elementsById.set('modalOfferPriceBtn', modalBtn);
        elementsById.set('offerPriceInputRow', inlineRow);
        elementsById.set('inlineBargainPriceInput', inlineInput);
        elementsById.set('inlineBargainSubmitBtn', inlineSubmitBtn);
        elementsById.set('modalItemPrice', modalPriceEl);

        // Below min_bargain_price rejected
        inlineInput.value = '600';
        await productMod.submitInlineBargainOffer();
        expect(window.apiClient.post).not.toHaveBeenCalled();
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('800'), 'error');

        // Valid inline offer submits, stores pending state & disables offer button
        inlineInput.value = '900';
        window.apiClient.post.mockResolvedValue({ success: true });
        const pendingPromise = productMod.submitInlineBargainOffer();
        await vi.advanceTimersByTimeAsync(400);
        await pendingPromise;

        expect(window.apiClient.post).toHaveBeenCalledWith(
            '/api/bargain',
            expect.objectContaining({ itemId: 'b-1', offeredPrice: 900, userId: 'uid-99' }),
            expect.any(Object)
        );
        expect(JSON.parse(localStorage.getItem('pending_bargain_b-1')).offeredPrice).toBe(900);
        expect(modalBtn.disabled).toBe(true);
        expect(modalBtn.style.pointerEvents).toBe('none');

        // Rate limit blocks after 2 recorded offers within 10 min
        productMod.recordClientBargainOffer();
        expect(productMod.checkClientBargainRateLimit().allowed).toBe(false);

        // Cross-device sync applies BARGAIN_ACCEPTED price to cart & UI
        const mockCart = [{ id: 'b-1', name: 'Vintage Shell', price: 1200 }];
        window.getActiveCart = () => mockCart;
        window.setActiveCart = vi.fn();
        window.updateCartUI = vi.fn();
        window.updateCardDOM = vi.fn();
        window.allItems = [activeItem];
        window.clientFingerprint = 'fp-123';
        window.apiClient.get.mockResolvedValue({
            bargains: [{
                bargainId: 'bg-9',
                itemId: 'b-1',
                originalPrice: 1200,
                acceptedPrice: 920
            }]
        });

        await productMod.syncUserBargains();
        expect(mockCart[0].price).toBe(920);
        expect(window.setActiveCart).toHaveBeenCalledWith(mockCart);
        expect(window.updateCartUI).toHaveBeenCalled();
        expect(modalPriceEl.innerHTML).toContain('920 грн');
    });

    it('7. product-modal.js opens instantly, strips [ТОРГ] tags, increments views RPC once & hydrates prewarmed details', async () => {
        const titleEl = createFakeEl('h2');
        const priceEl = createFakeEl('div');
        const condFill = createFakeEl('div');
        const condText = createFakeEl('span');
        const descBlock = createFakeEl('div');
        const pubWrap = createFakeEl('div');
        const pubEl = createFakeEl('span');
        const viewsEl = createFakeEl('span');
        const cartBtn = createFakeEl('button');
        const badges = createFakeEl('div');
        const modalEl = createFakeEl('div');
        const modalWin = createFakeEl('div');

        elementsById.set('modalItemTitle', titleEl);
        elementsById.set('modalItemPrice', priceEl);
        elementsById.set('modalCondFill', condFill);
        elementsById.set('modalItemCond', condText);
        elementsById.set('modalItemPublishedWrap', pubWrap);
        elementsById.set('modalItemPublished', pubEl);
        elementsById.set('modalItemViews', viewsEl);
        elementsById.set('modalCartBtn', cartBtn);
        elementsById.set('productModal', modalEl);
        querySelectors.set('.modal-desc', descBlock);
        querySelectors.set('.trust-badges', badges);
        querySelectors.set('#productModal .modal-window', modalWin);

        const rpcSpy = vi.fn(async () => ({ data: 42, error: null }));
        window.supabaseClient = {
            rpc: rpcSpy,
            from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) })
        };

        const item = {
            id: 'p-99',
            name: 'Nike ACG Anorak',
            brand: 'Nike',
            size: 'L',
            price: 2000,
            status: 'available',
            condition: '9 / 10',
            created_at: '2026-10-15T12:00:00Z',
            views_count: 10,
            description: 'Great jacket [ТОРГ: от 1600]',
            is_bargain: true,
            min_bargain_price: 1600,
            images: ['https://cdn/acg.jpg']
        };
        window.allItems = [item];
        window.getActiveCart = () => [{ id: 'p-99' }];
        window.saveCurrentFeedScrollState = vi.fn();

        // Prewarmed full description overrides summary asynchronously while preserving Q&A wrapper
        window._prewarmedItemDetails.set('p-99', Promise.resolve({
            id: 'p-99',
            brand: 'Nike',
            size: 'L',
            description: 'Full detailed measurements [ТОРГ: от 1600]\nChest 62cm'
        }));

        await productMod.openProductModalById('p-99');

        expect(titleEl.innerText).toBe('Nike ACG Anorak');
        expect(priceEl.innerText).toBe('2000 грн');
        expect(pubEl.textContent).toBe('15.10.2026');
        expect(cartBtn.innerText).toBe('В КОРЗИНЕ');
        expect(badges.innerHTML).toContain('1600');
        expect(window.saveCurrentFeedScrollState).toHaveBeenCalledWith('p-99');
        expect(openModal).toHaveBeenCalledWith('productModal');
        expect(window.location.search).toBe('');

        // Wait microtasks for RPC views increment + prewarm merge
        await Promise.resolve();
        await Promise.resolve();
        expect(rpcSpy).toHaveBeenCalledWith('increment_item_views', expect.objectContaining({ p_item_uuid: 'p-99' }));
        expect(viewsEl.innerText).toBe(42);
        expect(descBlock.innerHTML).toContain('Chest 62cm');
        expect(descBlock.innerHTML).not.toContain('[ТОРГ');
    });
});
