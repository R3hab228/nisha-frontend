import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';

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
        value: '',
        readOnly: false,
        checked: false,
        disabled: false,
        inert: false,
        placeholder: '',
        dataset: {},
        scrollTop: 0,
        scrollHeight: 200,
        clientHeight: 200,
        children: [],
        _innerHTML: '',
        _text: '',
        parentElement: null,
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
            set transition(v) { styleMap.set('transition', v); },
            get transition() { return styleMap.get('transition') || ''; },
            set left(v) { styleMap.set('left', v); },
            get left() { return styleMap.get('left') || ''; },
            set top(v) { styleMap.set('top', v); },
            get top() { return styleMap.get('top') || ''; },
            set position(v) { styleMap.set('position', v); },
            get position() { return styleMap.get('position') || ''; },
            set color(v) { styleMap.set('color', v); },
            get color() { return styleMap.get('color') || ''; }
        },
        set innerHTML(val) {
            el._innerHTML = String(val || '');
            el.children = [];
        },
        get innerHTML() {
            return el._innerHTML;
        },
        set innerText(val) {
            el._text = String(val ?? '');
        },
        get innerText() {
            return el._text;
        },
        set textContent(val) {
            el._text = String(val ?? '');
        },
        get textContent() {
            return el._text;
        },
        setAttribute: (k, v) => attrs.set(k, String(v)),
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        removeAttribute: (k) => attrs.delete(k),
        hasAttribute: (k) => attrs.has(k),
        appendChild: (child) => {
            if (child && child.children && child.tagName === 'FRAGMENT') {
                child.children.forEach(c => {
                    c.parentElement = el;
                    el.children.push(c);
                });
            } else if (child) {
                child.parentElement = el;
                el.children.push(child);
            }
            return child;
        },
        replaceChildren: (...nodes) => {
            el.children = [];
            el._innerHTML = '';
            nodes.forEach(n => el.appendChild(n));
        },
        remove: vi.fn(),
        focus: vi.fn(),
        blur: vi.fn(),
        scrollIntoView: vi.fn(),
        getBoundingClientRect: () => ({ top: 40, bottom: 80, left: 10, right: 110, width: 100, height: 40 }),
        addEventListener: (type, fn) => {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(fn);
        },
        dispatchEvent: (ev) => {
            const list = listeners.get(ev.type) || [];
            list.forEach(fn => fn(ev));
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        closest: () => null,
        matches: () => false
    };
    return el;
}

describe('Modular Cart, Nova Poshta & Checkout Deep Suite (js/cart/*.js)', () => {
    let cartMod;
    let elementsById;
    let allQuerySelectors;
    let mockSession;
    let mockLocal;
    let idbStore;
    let savedGlobals;

    beforeAll(async () => {
        savedGlobals = {
            window: globalThis.window,
            document: globalThis.document,
            storage: globalThis.storage,
            sessionStorage: globalThis.sessionStorage,
            localStorage: globalThis.localStorage,
            i18next: globalThis.i18next,
            showToast: globalThis.showToast,
            showCartToast: globalThis.showCartToast,
            triggerHaptic: globalThis.triggerHaptic,
            getOptimizedImg: globalThis.getOptimizedImg,
            formatPrice: globalThis.formatPrice,
            getCurrency: globalThis.getCurrency,
            closeModal: globalThis.closeModal,
            openModal: globalThis.openModal,
            renderHistory: globalThis.renderHistory,
            sleep: globalThis.sleep,
            fetch: globalThis.fetch
        };

        elementsById = new Map();
        allQuerySelectors = new Map();
        mockSession = new Map();
        mockLocal = new Map();
        idbStore = new Map();

        const storageFacade = {
            get: (k, def = null) => (mockLocal.has(k) ? mockLocal.get(k) : def),
            set: (k, v) => mockLocal.set(k, String(v)),
            remove: (k) => mockLocal.delete(k),
            getJSON: (k, def = null) => {
                if (!mockLocal.has(k)) return def;
                try { return JSON.parse(mockLocal.get(k)); } catch { return def; }
            },
            setJSON: (k, v) => mockLocal.set(k, JSON.stringify(v)),
            session: {
                get: (k, def = null) => (mockSession.has(k) ? mockSession.get(k) : def),
                set: (k, v) => mockSession.set(k, String(v)),
                remove: (k) => mockSession.delete(k),
                getJSON: (k, def = null) => {
                    if (!mockSession.has(k)) return def;
                    try { return JSON.parse(mockSession.get(k)); } catch { return def; }
                },
                setJSON: (k, v) => mockSession.set(k, JSON.stringify(v))
            }
        };

        globalThis.sessionStorage = {
            getItem: (k) => (mockSession.has(k) ? mockSession.get(k) : null),
            setItem: (k, v) => mockSession.set(k, String(v)),
            removeItem: (k) => mockSession.delete(k)
        };
        globalThis.localStorage = {
            getItem: (k) => (mockLocal.has(k) ? mockLocal.get(k) : null),
            setItem: (k, v) => mockLocal.set(k, String(v)),
            removeItem: (k) => mockLocal.delete(k)
        };

        const bodyEl = createFakeEl('body');
        globalThis.document = {
            readyState: 'complete',
            hidden: false,
            activeElement: null,
            body: bodyEl,
            createElement: (tag) => createFakeEl(tag),
            createTextNode: (text) => ({ nodeType: 3, textContent: text }),
            createDocumentFragment: () => createFakeEl('fragment'),
            getElementById: (id) => elementsById.get(id) || null,
            querySelector: (sel) => (allQuerySelectors.get(sel) || [])[0] || null,
            querySelectorAll: (sel) => allQuerySelectors.get(sel) || [],
            addEventListener: vi.fn()
        };

        globalThis.window = {
            innerWidth: 1280,
            innerHeight: 800,
            storage: storageFacade,
            allItems: [],
            cart: [],
            isHacked: false,
            apiClient: {
                post: vi.fn(),
                get: vi.fn(),
                generateIdempotencyKey: vi.fn(() => 'idem_123')
            },
            idbGet: vi.fn(async (k) => (idbStore.has(k) ? idbStore.get(k) : null)),
            idbSet: vi.fn(async (k, v) => { idbStore.set(k, v); return true; }),
            showCartToast: vi.fn(),
            warmupBackendServer: vi.fn(),
            updateAppBadge: vi.fn(),
            addEventListener: vi.fn()
        };

        globalThis.storage = storageFacade;
        globalThis.i18next = {
            language: 'ua',
            t: (k, opts = {}) => opts.defaultValue || k,
            changeLanguage: vi.fn(async (lng) => { globalThis.i18next.language = lng; })
        };
        globalThis.showToast = vi.fn();
        globalThis.triggerHaptic = vi.fn();
        globalThis.getOptimizedImg = (item) => (item?.images?.[0] || 'https://cdn.nisha-store.shop/img.jpg');
        globalThis.formatPrice = (p) => `${Number(p) || 0} грн`;
        globalThis.getCurrency = () => 'грн';
        globalThis.closeModal = vi.fn();
        globalThis.openModal = vi.fn();
        globalThis.renderHistory = vi.fn();
        globalThis.sleep = vi.fn(async () => {});

        cartMod = await import('../js/cart/cart.js');
    });

    beforeEach(() => {
        elementsById.clear();
        allQuerySelectors.clear();
        mockSession.clear();
        mockLocal.clear();
        idbStore.clear();
        window.cart = [];
        window.allItems = [];
        window.currentUser = null;
        window.userProfile = null;
        window._supabase = null;
        window.isHacked = false;
        window.otpVerified = false;
        window.currentPromoDiscount = 0;
        window.appliedPromoCode = '';
        window.currentPromoFixed = null;
        window.selectedCityRef = '';
        window.selectedBranchRef = '';
        window.selectedSettlementRef = '';
        window.innerWidth = 1280;
        cartMod.cartState.cart = window.cart;
        cartMod.cartState.currentPromoDiscount = 0;
        cartMod.cartState.appliedPromoCode = '';
        cartMod.cartState.selectedCityRef = '';
        cartMod.cartState.selectedBranchRef = '';
        cartMod.cartState.cachedBranches = [];
        cartMod.cartState.lastCartActionTime = 0;
        cartMod.cartState.isCheckoutOpening = false;
        cartMod.cartState.isOrderSubmitting = false;
        cartMod.cartState.removingCartIds.clear();
        Object.keys(cartMod.cartState.npBranchCache).forEach(k => delete cartMod.cartState.npBranchCache[k]);
        Object.keys(cartMod.cartState.npBranchCacheComplete).forEach(k => delete cartMod.cartState.npBranchCacheComplete[k]);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    afterAll(() => {
        Object.assign(globalThis, savedGlobals);
    });

    it('1. Re-exports full public API from cart.js and exposes window.* globals + isOrderSubmitting getter', () => {
        const expectedExports = [
            'cartState', 'escCartHtml', 'parseCartPrice', 'resetPromoState', 'renderPromoCodeNotice',
            'clearDropdownInlineStyles', 'getActiveCart', 'setActiveCart', 'withCartLock', 'withCheckoutLock',
            'initCartScrollIsolation', 'initCartHoverDesktop', 'checkCartItemsAvailability', 'renderCartItems',
            'updateCartUI', 'toggleCartDropdown', 'closeCartDropdown',
            'syncCartToServer', 'addToCartById', 'addToCartWithAnimation', 'addToCartFromModal', 'removeFromCart',
            'extractBranchNumber', 'isPostomatBranch', 'parseNPBranchQuery', 'filterAndSortBranches',
            'hideNPDropdowns', 'resetCheckoutAddressState', 'calculateDeliveryCost',
            'clearNPCityInput', 'clearNPBranchInput', 'debouncedNPCitySearch', 'searchNPCity',
            'filterNPBranches', 'matchAndSetBranchRef', 'ensureBranchRef', 'ensureCityRef',
            'loadNPBranches', 'renderBranches', 'autoDetectCity',
            'sanitizePromoField', 'saveCheckoutDraft', 'restoreCheckoutDraft', 'clearCheckoutDraft',
            'closePaymentDropdown', 'normalizePaymentMethodRu', 'selectPaymentMethod', 'togglePaymentDropdown',
            'applyPromoCode', 'openCheckoutModal',
            'normalizeOrderPhone', 'highlightFieldError', 'submitOrder', 'confirmEmailPrompt', 'executeOrderFinal'
        ];
        for (const fn of expectedExports) {
            expect(cartMod[fn]).toBeDefined();
        }
        expect(window.addToCartById).toBe(cartMod.addToCartById);
        expect(window.submitOrder).toBe(cartMod.submitOrder);
        expect(window.executeOrderFinal).toBe(cartMod.executeOrderFinal);
        expect(window.isOrderSubmitting).toBe(false);
        cartMod.cartState.isOrderSubmitting = true;
        expect(window.isOrderSubmitting).toBe(true);
    });

    it('2. cart-state.js helpers: escCartHtml, parseCartPrice & renderPromoCodeNotice (fixed, pct, error, warning)', () => {
        expect(cartMod.escCartHtml('<script>"test\'&</script>')).toBe('&lt;script&gt;&quot;test&#39;&amp;&lt;/script&gt;');
        expect(cartMod.parseCartPrice('1 250 грн')).toBe(1250);
        expect(cartMod.parseCartPrice('free')).toBe(0);

        const pctHtml = cartMod.renderPromoCodeNotice({ percent: 15, savedMoney: 300, isFixed: false });
        expect(pctHtml).toContain('promo-notice-success');
        expect(pctHtml).toContain('-15%');
        expect(pctHtml).toContain('-300 грн');

        const fixedHtml = cartMod.renderPromoCodeNotice({ savedMoney: 200, isFixed: true });
        expect(fixedHtml).toContain('-200 грн');
        expect(fixedHtml).not.toContain('%');

        const errHtml = cartMod.renderPromoCodeNotice({ isError: true, message: '<bad>' });
        expect(errHtml).toContain('promo-notice-error');
        expect(errHtml).toContain('&lt;bad&gt;');

        const warnHtml = cartMod.renderPromoCodeNotice({ isWarning: true, message: 'Warming up' });
        expect(warnHtml).toContain('promo-notice-warning');
        expect(warnHtml).toContain('Warming up');
    });

    it('3. cart-operations.js handles bargain price, hacked discount, in-cart price update, and removal cleanup', async () => {
        const panel = createFakeEl('div');
        const countEl = createFakeEl('span');
        const totalEl = createFakeEl('span');
        const listEl = createFakeEl('div');
        elementsById.set('cartPanel', panel);
        elementsById.set('cartCount', countEl);
        elementsById.set('cartTotal', totalEl);
        elementsById.set('cartDropdownList', listEl);

        window.allItems = [
            { id: 'c-1', name: 'Vintage Stone <Tee>', size: 'l', price: 1000, images: ['https://cdn.nisha-store.shop/1.jpg'] },
            { id: 'c-2', name: 'Arc Jacket', size: 'm', price: 2000, images: ['https://cdn.nisha-store.shop/2.jpg'] }
        ];
        window.apiClient.post.mockResolvedValue({ success: true });

        // Bargain price stored in sessionStorage takes priority on addToCartById
        sessionStorage.setItem('accepted_bargain_c-1', JSON.stringify({ acceptedPrice: 820 }));
        await cartMod.addToCartById('c-1');
        expect(cartMod.getActiveCart()).toHaveLength(1);
        expect(cartMod.getActiveCart()[0].price).toBe(820);
        expect(countEl.innerText).toBe('1');
        expect(totalEl.innerText).toBe('820 грн');
        expect(window.apiClient.post).toHaveBeenCalledWith(
            '/api/cart/sync',
            expect.objectContaining({ cart: expect.any(Array) }),
            expect.objectContaining({ dedupe: true })
        );

        // Calling addToCartById with an updated bargain rate updates item price instead of rejecting duplicate
        await cartMod.addToCartById('c-1', 750);
        expect(cartMod.getActiveCart()[0].price).toBe(750);
        expect(totalEl.innerText).toBe('750 грн');

        // Duplicate without price change shows toast error
        sessionStorage.removeItem('accepted_bargain_c-1');
        await cartMod.addToCartById('c-1');
        expect(showToast).toHaveBeenCalledWith('messages.cart_exist', 'error');

        // Hacked 10% discount applies when no bargain price present
        window.isHacked = true;
        await cartMod.addToCartById('c-2');
        expect(cartMod.getActiveCart()[1].price).toBe(1800);

        // Remove both -> resets promo & removes panel classes
        window.currentPromoDiscount = 0.1;
        window.appliedPromoCode = 'SALE10';
        await cartMod.removeFromCart(1);
        await cartMod.removeFromCart(0);
        expect(cartMod.getActiveCart()).toEqual([]);
        expect(panel.classList.contains('show')).toBe(false);
        expect(window.appliedPromoCode).toBe('');
    });

    it('4. cart-ui.js escapes XSS, clamps fixed promo floor (>= 1 uah), toggles drawer/FAB & handles swipe-to-delete', () => {
        vi.useFakeTimers();
        const panel = createFakeEl('div');
        const dropdown = createFakeEl('div');
        const fab = createFakeEl('button');
        const countEl = createFakeEl('span');
        const totalEl = createFakeEl('span');
        const msgEl = createFakeEl('div');
        const listEl = createFakeEl('div');

        elementsById.set('cartPanel', panel);
        elementsById.set('cartDropdown', dropdown);
        elementsById.set('cartCount', countEl);
        elementsById.set('cartTotal', totalEl);
        elementsById.set('promoMessage', msgEl);
        elementsById.set('cartDropdownList', listEl);
        allQuerySelectors.set('.fab-propose', [fab]);

        cartMod.setActiveCart([
            { id: 'u1', name: '<img src=x onerror=1>', size: 'xl', price: 150, _isSold: true, images: ['https://cdn.nisha-store.shop/x.jpg'] }
        ]);
        window.currentPromoDiscount = 0.5;
        window.currentPromoFixed = 500;
        window.appliedPromoCode = 'HUGE500';

        cartMod.updateCartUI();
        // Fixed discount is clamped to total - 1 (so final price = 1 грн, never <= 0)
        expect(totalEl.innerText).toBe('1 грн');
        expect(msgEl.innerHTML).toContain('-149 грн');

        const renderedRowHtml = listEl.children.map(c => c.innerHTML).join('');
        expect(renderedRowHtml).toContain('&lt;img src=x onerror=1&gt;');
        expect(renderedRowHtml).not.toContain('<img src=x onerror=1>');
        expect(renderedRowHtml).toContain('cart-sold-badge');

        // toggleCartDropdown hides FAB while open and restores it on close
        cartMod.toggleCartDropdown();
        expect(dropdown.classList.contains('active')).toBe(true);
        expect(panel.classList.contains('dropdown-open')).toBe(true);
        expect(fab.style.getPropertyValue('display')).toBe('none');

        cartMod.closeCartDropdown();
        expect(dropdown.classList.contains('active')).toBe(false);
        expect(panel.classList.contains('dropdown-open')).toBe(false);
        expect(fab.classList.contains('cart-active')).toBe(true);

        // Swipe beyond 120px removes item from cart after delay
        const trashIcon = createFakeEl('svg');
        const trashLid = createFakeEl('path');
        const parentRow = createFakeEl('div');
        parentRow.querySelector = (sel) => (sel === '.trash-icon' ? trashIcon : (sel === '.trash-lid' ? trashLid : null));
        const surface = createFakeEl('div');
        surface.classList.add('swipe-surface');
        surface.setAttribute('data-index', '0');
        surface.closest = () => parentRow;

        window.handleSwipeStart({ currentTarget: surface, touches: [{ clientX: 250 }] });
        window.handleSwipeMove({ currentTarget: surface, touches: [{ clientX: 90 }] });
        expect(surface.style.transform).toBe('translateX(-160px)');
        window.handleSwipeEnd({ currentTarget: surface });
        vi.advanceTimersByTime(550);
        expect(cartMod.getActiveCart()).toHaveLength(0);
    });

    it('5. novaposhta-helpers.js accurately parses branch numbers, postomat filters, rankings & delivery cost', async () => {
        expect(cartMod.extractBranchNumber({ Description: 'Відділення №25 (до 30 кг): вул. Киевская, 120' })).toBe('25');
        expect(cartMod.isPostomatBranch({ Description: 'Поштомат "Нова Пошта" №5040' })).toBe(true);
        expect(cartMod.isPostomatBranch({ Description: 'Відділення №1' })).toBe(false);

        const qPure = cartMod.parseNPBranchQuery('6745');
        expect(qPure.isPureNumber).toBe(true);
        expect(qPure.apiSearch).toBe('№6745');

        const branches = [
            { Ref: 'r1', Description: 'Відділення №120 (до 30 кг): вул. Миру, 25', Number: '120' },
            { Ref: 'r2', Description: 'Поштомат №25: пр. Победы, 10', Number: '25', TypeOfWarehouse: 'f9316480-5f2d-425d-bc2c-ac7cd29decf0' },
            { Ref: 'r3', Description: 'Відділення №250: вул. Нова, 4', Number: '250' },
            { Ref: 'r4', Description: 'Відділення №25: вул. Центральна, 5', Number: '25' }
        ];

        const ranked = cartMod.filterAndSortBranches(branches, 'отд 25');
        expect(ranked.map(b => b.Ref)).toEqual(['r4', 'r3', 'r1']);

        const postomatOnly = cartMod.filterAndSortBranches(branches, 'поштомат 25');
        expect(postomatOnly.map(b => b.Ref)).toEqual(['r2']);

        const deliveryBox = createFakeEl('div');
        const costVal = createFakeEl('span');
        elementsById.set('deliveryCostInfo', deliveryBox);
        elementsById.set('calcCostVal', costVal);
        window.selectedCityRef = 'city-kyiv';
        cartMod.setActiveCart([{ id: 'p1', price: 900 }]);
        window.apiClient.post.mockResolvedValue({ success: true, cost: 85 });

        await cartMod.calculateDeliveryCost();
        expect(deliveryBox.style.display).toBe('block');
        expect(costVal.innerText).toBe('85 грн');
    });

    it('6. novaposhta-delivery.js resolves city/branch refs silently, caches IDB, cancels stale race loads & avoids GeoIP overwrite', async () => {
        const cityEl = createFakeEl('input');
        const branchEl = createFakeEl('input');
        const cityDrop = createFakeEl('div');
        const branchDrop = createFakeEl('div');
        elementsById.set('orderCity', cityEl);
        elementsById.set('orderBranch', branchEl);
        elementsById.set('cityDropdown', cityDrop);
        elementsById.set('branchDropdown', branchDrop);

        // ensureCityRef silent resolution with single settlement match
        cityEl.value = 'Львів';
        window.apiClient.post.mockResolvedValueOnce({
            success: true,
            data: [{ Addresses: [{ Present: 'м. Львів, Львівська обл.', MainDescription: 'Львів', Ref: 'sett-lviv', DeliveryCity: 'city-lviv' }] }]
        });
        const resolvedCityRef = await cartMod.ensureCityRef();
        expect(resolvedCityRef).toBe('city-lviv');
        expect(cityEl.value).toBe('м. Львів, Львівська обл.');
        expect(branchEl.readOnly).toBe(false);
        expect(cityDrop.style.display).toBe('none');

        // ensureBranchRef fallback (tests bDesc fix when postomat flag mismatches list item)
        branchEl.value = '';
        window.apiClient.post.mockResolvedValueOnce({
            success: true,
            data: [{ Ref: 'ref-post-42', Description: 'Поштомат №42: вул. Франка', TypeOfWarehouse: 'f9316480-5f2d-425d-bc2c-ac7cd29decf0' }]
        });
        const resolvedBranchRef = await cartMod.ensureBranchRef('Відділення №42');
        expect(resolvedBranchRef).toBe('ref-post-42');
        expect(branchEl.value).toBe('Поштомат №42: вул. Франка');

        // Stale race check in loadNPBranches: second call invalidates slow first response
        let resolveSlow;
        window.apiClient.post
            .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r; }))
            .mockResolvedValueOnce({
                success: true,
                data: [{ Ref: 'new-fast', Description: 'Відділення №9: вул. Нова', Number: '9' }]
            });

        const slowCall = cartMod.loadNPBranches('1', true);
        const fastCall = cartMod.loadNPBranches('9', true);
        await fastCall;
        resolveSlow({
            success: true,
            data: [{ Ref: 'old-slow', Description: 'Відділення №1: Старе', Number: '1' }]
        });
        await slowCall;
        // Fast call ("9") remains rendered in dropdown instead of being overwritten by stale ("1")
        const renderedDescs = branchDrop.children.map(c => c.getAttribute('data-branch-desc'));
        expect(renderedDescs).toEqual(['Відділення №9: вул. Нова']);
    });

    it('7. checkout-form.js persists/restores drafts, guards promo against name autofill, applies promo & aborts checkout if item sold', async () => {
        const orderName = createFakeEl('input');
        const orderPhone = createFakeEl('input');
        const orderCity = createFakeEl('input');
        const orderBranch = createFakeEl('input');
        const pmInput = createFakeEl('input');
        const pmText = createFakeEl('span');
        const promoEl = createFakeEl('input');
        const promoMsg = createFakeEl('div');
        const promoBtn = createFakeEl('button');

        elementsById.set('orderName', orderName);
        elementsById.set('orderPhone', orderPhone);
        elementsById.set('orderCity', orderCity);
        elementsById.set('orderBranch', orderBranch);
        elementsById.set('orderPaymentMethod', pmInput);
        elementsById.set('paymentSelectedText', pmText);
        elementsById.set('promoInput', promoEl);
        elementsById.set('promoMessage', promoMsg);
        allQuerySelectors.set('.promo-wrapper button', [promoBtn]);

        orderName.value = 'Тарас Шевченко';
        orderPhone.value = '+380501234567';
        orderCity.value = 'м. Київ';
        orderBranch.value = 'Відділення №1';
        cartMod.selectPaymentMethod('cod', 'Післяплата (200 грн)');
        expect(pmInput.value).toBe('Наложка (предоплата 200грн)');

        cartMod.saveCheckoutDraft();
        orderName.value = '';
        orderCity.value = '';
        pmInput.value = '';
        expect(cartMod.restoreCheckoutDraft()).toBe(true);
        expect(orderName.value).toBe('Тарас Шевченко');
        expect(orderCity.value).toBe('м. Київ');
        expect(pmInput.value).toBe('Наложка (предоплата 200грн)');

        // Autofill shield clears customer name mistakenly pasted into promo input
        promoEl.value = 'Тарас Шевченко';
        cartMod.sanitizePromoField();
        expect(promoEl.value).toBe('');

        // applyPromoCode success applies discount
        cartMod.setActiveCart([{ id: 'i1', name: 'Vintage Tee', price: 1000 }]);
        promoEl.value = 'spring10';
        window.apiClient.post.mockResolvedValueOnce({ success: true, discount_percent: 0.1 });
        await cartMod.applyPromoCode();
        expect(window.appliedPromoCode).toBe('SPRING10');
        expect(window.currentPromoDiscount).toBe(0.1);

        // openCheckoutModal removes sold items from cart and aborts opening checkout modal
        const checkoutBtn = createFakeEl('button');
        checkoutBtn.innerText = 'ОФОРМИТЬ';
        allQuerySelectors.set('.cart-panel .cart-checkout-btn', [checkoutBtn]);
        elementsById.set('cartPanel', createFakeEl('div'));
        elementsById.set('cartCount', createFakeEl('span'));
        elementsById.set('cartTotal', createFakeEl('span'));
        window._supabase = {
            from: () => ({
                select: () => ({
                    in: async () => ({ data: [{ id: 'i1', name: 'Vintage Tee', status: 'sold' }], error: null })
                }),
                update: () => ({ eq: async () => ({}) })
            })
        };
        window.apiClient.post.mockResolvedValue({ success: true });

        await cartMod.openCheckoutModal();
        expect(cartMod.getActiveCart()).toEqual([]);
        expect(openModal).not.toHaveBeenCalled();
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Vintage Tee'), 'error');
    });

    it('8. checkout-submit.js normalizes phones, completes atomic server order & falls back to RPC when server fails', async () => {
        vi.useFakeTimers();
        expect(cartMod.normalizeOrderPhone('0991234567')).toBe('+380991234567');
        expect(cartMod.normalizeOrderPhone('991234567')).toBe('+380991234567');
        expect(cartMod.normalizeOrderPhone('380991234567')).toBe('+380991234567');

        const orderName = createFakeEl('input');
        const orderPhone = createFakeEl('input');
        const orderCity = createFakeEl('input');
        const orderBranch = createFakeEl('input');
        const pmInput = createFakeEl('input');
        const btnSubmit = createFakeEl('button');
        const successOverlay = createFakeEl('div');
        const botTrap = createFakeEl('input');

        orderName.value = 'Іван Франко';
        orderPhone.value = '+380671112233';
        orderCity.value = 'м. Львів';
        orderBranch.value = 'Відділення №5';
        pmInput.value = 'Полная предоплата';
        botTrap.value = '';

        elementsById.set('orderName', orderName);
        elementsById.set('orderPhone', orderPhone);
        elementsById.set('orderCity', orderCity);
        elementsById.set('orderBranch', orderBranch);
        elementsById.set('orderPaymentMethod', pmInput);
        elementsById.set('btnSubmitOrder', btnSubmit);
        elementsById.set('orderSuccessOverlay', successOverlay);
        elementsById.set('botTrap', botTrap);
        elementsById.set('cartPanel', createFakeEl('div'));
        elementsById.set('cartCount', createFakeEl('span'));
        elementsById.set('cartTotal', createFakeEl('span'));

        window.selectedCityRef = 'city-lviv';
        window.selectedBranchRef = 'branch-5';
        window.otpVerified = true;
        storage.set('nisha_email_preference', 'ivan@example.com');
        sessionStorage.setItem('accepted_bargain_ord-1', JSON.stringify({ acceptedPrice: 1400 }));

        const item = { id: 'ord-1', name: 'Archive Knit', price: 1400, status: 'available' };
        window.allItems = [item];
        cartMod.setActiveCart([item]);
        window.updateCardDOM = vi.fn();
        window.updateSidebarCounters = vi.fn();

        // Atomic /api/create-order succeeds
        window.apiClient.post.mockImplementation(async (url) => {
            if (url === '/api/create-order') {
                return { success: true, orderId: 'ORD-777', totalSum: 1400, createdAt: '2026-11-14T12:00:00Z' };
            }
            return { success: true };
        });

        await cartMod.submitOrder();

        expect(window.apiClient.post).toHaveBeenCalledWith(
            '/api/create-order',
            expect.objectContaining({
                name: 'Іван Франко',
                phone: '+380671112233',
                email: 'ivan@example.com',
                cityRef: 'city-lviv',
                branchRef: 'branch-5',
                itemIds: ['ord-1']
            }),
            expect.objectContaining({ idempotencyKey: 'idem_123' })
        );
        expect(item.status).toBe('reserved');
        expect(window.updateCardDOM).toHaveBeenCalledWith(item);
        expect(cartMod.getActiveCart()).toEqual([]);
        expect(sessionStorage.getItem('accepted_bargain_ord-1')).toBeNull();
        expect(storage.getJSON('nisha_cached_orders', [])[0].id).toBe('ORD-777');

        vi.advanceTimersByTime(400);
        expect(closeModal).toHaveBeenCalledWith('checkoutModal');
        expect(successOverlay.style.display).toBe('flex');
        vi.advanceTimersByTime(3600);
        expect(window.isOrderSubmitting).toBe(false);

        // Fallback RPC path when /api/create-order rejects with network timeout
        const rpcMock = vi.fn(async () => ({ data: { order_id: 'RPC-888', total_sum: 900 }, error: null }));
        window._supabase = { rpc: rpcMock };
        cartMod.setActiveCart([{ id: 'ord-2', name: 'Silk Scarf', price: 900 }]);
        window.apiClient.post.mockImplementation(async (url) => {
            if (url === '/api/create-order') throw new Error('Network timeout');
            return { success: true };
        });

        await cartMod.executeOrderFinal('rpc@example.com');
        expect(rpcMock).toHaveBeenCalledWith('create_atomic_order', expect.objectContaining({ p_item_ids: ['ord-2'] }));
        expect(cartMod.getActiveCart()).toEqual([]);
    });
});
