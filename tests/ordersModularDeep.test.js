import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
    globalThis.window = globalThis.window || globalThis;
    if (typeof globalThis.window.addEventListener !== 'function') {
        globalThis.window.addEventListener = () => {};
    }
    if (typeof globalThis.localStorage === 'undefined') {
        const mem = new Map();
        globalThis.localStorage = {
            getItem: k => (mem.has(k) ? mem.get(k) : null),
            setItem: (k, v) => mem.set(k, String(v)),
            removeItem: k => mem.delete(k),
            clear: () => mem.clear()
        };
    }
});

import '../js/core/store.js';
import { hasAction, resolveAction } from '../js/core/action-registry.js';
import {
    getOrdersData,
    setOrdersData,
    getCurrentOrderTab,
    setCurrentOrderTab,
    getOrderTabBucket,
    formatOrderStatus,
    encodeNovaPoshtaTtn,
    getNovaPoshtaTrackingUrl,
    clearOrderSelection,
    getSelectedOrderIds,
    isOrderSelected,
    toggleOrderSelection,
    getHiddenOrderIds,
    hideOrderIds,
    mergeRemoteHiddenOrderIds
} from '../js/orders/orders-state.js';
import { fetchMyOrders } from '../js/orders/orders-fetch.js';
import {
    updateOrderTabCounters,
    switchOrderTab,
    renderFilteredOrders,
    bindOrdersLongPressSelection,
    deleteSelectedOrders
} from '../js/orders/orders-render.js';
import '../js/orders/orders.js';

describe('Modular Orders Suite (js/orders/orders-*.js)', () => {
    const store = globalThis.store;

    beforeEach(() => {
        globalThis.window = globalThis.window || globalThis;
        window.store = store;
        window.currentSiteLang = 'ua';
        delete window.i18next;
        globalThis.i18next = undefined;
        store.set('globalOrdersData', []);
        store.set('currentOrderTab', 'accepted');
        window.JsBarcode = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.JsBarcode;
        delete globalThis.document;
    });

    it('1. Registers all order actions into ActionRegistry and exposes them cleanly', () => {
        [
            'openOrdersModal',
            'formatOrderDate',
            'formatOrderStatus',
            'getOrderTabBucket',
            'updateOrderTabCounters',
            'fetchMyOrders',
            'getOrderItemImage',
            'ensureOrderImagesLoaded',
            'encodeNovaPoshtaTtn',
            'getNovaPoshtaTrackingUrl',
            'switchOrderTab',
            'bindOrdersTabSwipe',
            'copyTTN',
            'renderFilteredOrders'
        ].forEach(name => {
            expect(hasAction(name)).toBe(true);
            expect(typeof resolveAction(name)).toBe('function');
        });
    });

    it('2. Synchronizes globalOrdersData and currentOrderTab bi-directionally with reactive store', () => {
        const sample = [{ id: '101-abc', status: 'ОТПРАВЛЕН', tracking_number: '20483289403202' }];
        setOrdersData(sample);
        expect(store.get('globalOrdersData')).toEqual(sample);
        expect(window.globalOrdersData).toEqual(sample);
        expect(getOrdersData()).toEqual(sample);

        setCurrentOrderTab('shipped');
        expect(store.get('currentOrderTab')).toBe('shipped');
        expect(window.currentOrderTab).toBe('shipped');
        expect(getCurrentOrderTab()).toBe('shipped');

        window.currentOrderTab = 'cancelled';
        expect(store.get('currentOrderTab')).toBe('cancelled');
        expect(getCurrentOrderTab()).toBe('cancelled');
    });

    it('3. Groups orders into accepted, shipped, and cancelled buckets and encodes Nova Poshta TTN', () => {
        expect(getOrderTabBucket({ status: 'В ОБРАБОТКЕ', tracking_number: '' })).toBe('accepted');
        expect(getOrderTabBucket({ status: 'ОПЛАЧЕН', tracking_number: '' })).toBe('accepted');
        expect(getOrderTabBucket({ status: 'ОТПРАВЛЕН', tracking_number: '' })).toBe('shipped');
        expect(getOrderTabBucket({ status: 'ЗАВЕРШЕН', tracking_number: '20450123456789' })).toBe('shipped');
        expect(getOrderTabBucket({ status: 'ОТМЕНЕН', tracking_number: '20450123456789' })).toBe('cancelled');

        expect(encodeNovaPoshtaTtn('20483289403202')).toBe('IDMyMDM0kDOyMDO0AjM');
        expect(getNovaPoshtaTrackingUrl('20483289403202')).toBe('https://tracking.novaposhta.ua/#/uk/IDMyMDM0kDOyMDO0AjM');
        expect(getNovaPoshtaTrackingUrl('20483289403202', 'ru')).toBe('https://tracking.novaposhta.ua/#/ru/IDMyMDM0kDOyMDO0AjM');
        expect(formatOrderStatus('ОТМЕНЕН')).toBeTruthy();
    });

    it('4. Renders many order cards in a single batched listArea.innerHTML write (zero += loop)', () => {
        let writeCount = 0;
        let currentHtml = '';
        const listArea = {
            replaceChildren: vi.fn(() => { currentHtml = ''; }),
            get innerHTML() { return currentHtml; },
            set innerHTML(val) {
                writeCount += 1;
                currentHtml = String(val);
            }
        };

        const tabButtons = ['yellow', 'blue', 'red'].map(name => {
            const set = new Set();
            return {
                id: `tabBtn_${name}`,
                innerHTML: '',
                removeAttribute: vi.fn(),
                classList: {
                    add: c => set.add(c),
                    remove: c => set.delete(c),
                    toggle: (c, force) => {
                        const on = typeof force === 'boolean' ? force : !set.has(c);
                        if (on) set.add(c);
                        else set.delete(c);
                        return on;
                    },
                    contains: c => set.has(c)
                }
            };
        });

        globalThis.document = {
            getElementById: (id) => (id === 'ordersListArea' ? listArea : null),
            querySelector: (sel) => {
                if (sel === '.order-tab.tab-yellow') return tabButtons[0];
                if (sel === '.order-tab.tab-blue') return tabButtons[1];
                if (sel === '.order-tab.tab-red') return tabButtons[2];
                return null;
            },
            querySelectorAll: () => []
        };

        const orders = Array.from({ length: 15 }, (_, idx) => ({
            id: `500${idx}-uuid`,
            created_at: '2026-11-10T10:00:00.000Z',
            status: 'В ОБРАБОТКЕ',
            total_sum: 1200 + idx,
            items: [{ id: idx + 1, name: `<img src=x>Item #${idx}`, size: 'L', price: 1200 }]
        }));

        setOrdersData(orders);
        switchOrderTab('accepted');
        renderFilteredOrders();

        // Single batched DOM assignment for all 15 cards (instead of 15 += appends)
        expect(writeCount).toBeLessThanOrEqual(2);
        expect(currentHtml).toContain('&lt;img src=x&gt;Item #0');
        expect(currentHtml).toContain('Item #14');
        expect(currentHtml).not.toContain('<img src=x>');

        updateOrderTabCounters();
        expect(tabButtons[0].innerHTML).toContain('(15)');
        expect(tabButtons[1].innerHTML).toContain('(0)');
        expect(tabButtons[0].classList.contains('active')).toBe(true);
    });

    it('5. Supports long-press pointer gesture for green-circle selection across accepted, shipped & cancelled tabs', async () => {
        vi.useFakeTimers();
        clearOrderSelection();

        const listeners = {};
        const createCardMock = (orderId) => {
            const cls = new Set();
            const attrs = { 'data-order-id': orderId };
            const card = {
                dataset: { orderId },
                classList: {
                    add: (c) => cls.add(c),
                    remove: (c) => cls.delete(c),
                    toggle: (c, force) => (force === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : (force ? cls.add(c) : cls.delete(c))),
                    contains: (c) => cls.has(c)
                },
                getAttribute: (k) => attrs[k] ?? null,
                setAttribute: (k, v) => { attrs[k] = String(v); }
            };
            card.closest = (sel) => (sel === '.order-card' ? card : null);
            return card;
        };

        const card1 = createCardMock('ord-acc-1');
        const card2 = createCardMock('ord-ship-2');
        const listArea = {
            dataset: {},
            innerHTML: '',
            style: {},
            addEventListener: (type, fn) => {
                if (!listeners[type]) listeners[type] = [];
                listeners[type].push(fn);
            },
            dispatchEvent: (ev) => {
                for (const fn of (listeners[ev.type] || [])) fn(ev);
            }
        };

        const deleteBtn = {
            hidden: true,
            attrs: {},
            classes: new Set(),
            classList: {
                toggle: (c, f) => (f ? deleteBtn.classes.add(c) : deleteBtn.classes.delete(c)),
                contains: (c) => deleteBtn.classes.has(c)
            },
            setAttribute: (k, v) => { deleteBtn.attrs[k] = v; }
        };
        const deleteCountEl = { textContent: '0' };

        globalThis.document = {
            getElementById: (id) => {
                if (id === 'ordersListArea') return listArea;
                if (id === 'ordersDeleteSelectedBtn') return deleteBtn;
                if (id === 'ordersDeleteCount') return deleteCountEl;
                return null;
            },
            querySelector: () => null,
            querySelectorAll: () => []
        };

        try {
            // Render accepted, shipped, and cancelled orders -> verify green corner markup present
            setOrdersData([
                { id: 'ord-acc-1', status: 'Принят', total_sum: 1000, created_at: '2026-11-10T10:00:00Z', items: [] },
                { id: 'ord-ship-2', status: 'Отправлен', total_sum: 2000, created_at: '2026-11-10T10:00:00Z', items: [] },
                { id: 'ord-can-3', status: 'Отменен', total_sum: 3000, created_at: '2026-11-10T10:00:00Z', items: [] }
            ]);
            for (const tab of ['accepted', 'shipped', 'cancelled']) {
                setCurrentOrderTab(tab);
                renderFilteredOrders();
                expect(listArea.innerHTML).toContain('order-select-corner');
            }

            setCurrentOrderTab('accepted');
            bindOrdersLongPressSelection();

            // 1. Movement > 10px cancels long press (scroll protection)
            const scrollTarget = { closest: () => card1 };
            listArea.dispatchEvent({ type: 'pointerdown', pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 50, clientY: 50, target: scrollTarget });
            listArea.dispatchEvent({ type: 'pointermove', pointerId: 1, clientX: 50, clientY: 75 });
            await vi.advanceTimersByTimeAsync(500);
            expect(isOrderSelected('ord-acc-1')).toBe(false);

            // 1b. Android Chrome contextmenu during hold (~400ms) is prevented before timer fires
            const ctxPrevent = vi.fn();
            listArea.dispatchEvent({ type: 'pointerdown', pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 50, clientY: 50, target: scrollTarget });
            listArea.dispatchEvent({ type: 'contextmenu', target: scrollTarget, preventDefault: ctxPrevent });
            expect(ctxPrevent).toHaveBeenCalled();
            listArea.dispatchEvent({ type: 'pointercancel', pointerId: 9 });

            // 2. Holding 450ms activates bottom-left green corner and shows delete trash button
            listArea.dispatchEvent({ type: 'pointerdown', pointerId: 2, pointerType: 'touch', isPrimary: true, clientX: 50, clientY: 50, target: scrollTarget });
            await vi.advanceTimersByTimeAsync(460);
            expect(isOrderSelected('ord-acc-1')).toBe(true);
            expect(card1.classList.contains('is-selected')).toBe(true);
            expect(deleteBtn.hidden).toBe(false);
            expect(deleteBtn.classList.contains('is-visible')).toBe(true);
            expect(deleteCountEl.textContent).toBe('1');

            // 3. Follow-up synthetic click from finger release is suppressed
            const preventDefaultSpy = vi.fn();
            const stopPropSpy = vi.fn();
            listArea.dispatchEvent({ type: 'click', target: scrollTarget, preventDefault: preventDefaultSpy, stopPropagation: stopPropSpy });
            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(isOrderSelected('ord-acc-1')).toBe(true);

            // 4. Subsequent tap toggles another card while in selection mode
            await vi.advanceTimersByTimeAsync(600);
            const card2Target = { closest: () => card2 };
            listArea.dispatchEvent({ type: 'click', target: card2Target, preventDefault: vi.fn(), stopPropagation: vi.fn() });
            expect(getSelectedOrderIds()).toEqual(['ord-acc-1', 'ord-ship-2']);
            expect(deleteCountEl.textContent).toBe('2');

            // 5. Clicking trash button hides selected orders, prunes cached orders, and resets toolbar
            localStorage.setItem('nisha_cached_orders', JSON.stringify([
                { id: 'ord-acc-1' },
                { id: 'ord-ship-2' },
                { id: 'ord-can-3' }
            ]));
            deleteSelectedOrders();
            expect(getSelectedOrderIds()).toEqual([]);
            expect(deleteBtn.hidden).toBe(true);
            expect(getOrdersData().map(o => o.id)).toEqual(['ord-can-3']);
            expect(JSON.parse(localStorage.getItem('nisha_cached_orders')).map(o => o.id)).toEqual(['ord-can-3']);

            // 6. Re-fetching orders afterwards keeps deleted orders hidden
            setOrdersData([{ id: 'ord-acc-1' }, { id: 'ord-can-3' }]);
            expect(getOrdersData().map(o => o.id)).toEqual(['ord-can-3']);
        } finally {
            clearOrderSelection();
            localStorage.removeItem('nisha_hidden_orders_v1');
            localStorage.removeItem('nisha_cached_orders');
            vi.useRealTimers();
        }
    });

    it('6. Cross-device soft-hide sync isolates storage per user, hydrates user_metadata, calls /api/orders/hide, and reconciles GET /api/orders/hidden', async () => {
        const prevDoc = globalThis.document;
        const prevUser = window.currentUser;
        const prevApiClient = window.apiClient;
        const prevSupabase = window.supabaseClient;
        const prevStoreUser = store.get('currentUser');

        const listArea = { innerHTML: '', dataset: {}, addEventListener: () => {} };
        const tabsContainer = { style: { display: 'none' } };
        const countEl = { textContent: '0' };
        const elements = {
            ordersListArea: listArea,
            ordersTabsContainer: tabsContainer,
            ordersDeleteSelectedBtn: { hidden: true, style: {}, classList: { toggle: () => {} }, setAttribute: () => {} },
            ordersDeleteCount: { textContent: '0' },
            tabCountAccepted: countEl,
            tabCountShipped: { textContent: '0' },
            tabCountCancelled: { textContent: '0' }
        };
        globalThis.document = {
            getElementById: (id) => elements[id] || null,
            querySelector: () => null,
            querySelectorAll: () => []
        };

        try {
            // 1. Per-user key isolation & user_metadata hydration
            const userA = { id: 'uid-alpha', user_metadata: { hidden_order_ids: ['ord-meta-1'] } };
            window.currentUser = userA;
            store.set('currentUser', userA);
            hideOrderIds(['ord-a-1']);

            expect(getHiddenOrderIds().has('ord-meta-1')).toBe(true);
            expect(getHiddenOrderIds().has('ord-a-1')).toBe(true);
            expect(JSON.parse(localStorage.getItem('nisha_hidden_orders_uid-alpha'))).toEqual(['ord-meta-1', 'ord-a-1']);

            const userB = { id: 'uid-beta', user_metadata: { hidden_order_ids: ['ord-b-meta'] } };
            window.currentUser = userB;
            store.set('currentUser', userB);
            expect(getHiddenOrderIds().has('ord-a-1')).toBe(false);
            expect(getHiddenOrderIds().has('ord-b-meta')).toBe(true);

            // Switch back to User A and verify orders from User B are not leaked
            window.currentUser = userA;
            store.set('currentUser', userA);
            setOrdersData([
                { id: 'ord-meta-1', status: 'Принят' },
                { id: 'ord-a-1', status: 'Принят' },
                { id: 'ord-keep-1', status: 'Принят' },
                { id: 'ord-remote-new', status: 'Принят' }
            ]);
            expect(getOrdersData().map(o => o.id)).toEqual(['ord-keep-1', 'ord-remote-new']);

            // 2. deleteSelectedOrders sends background POST /api/orders/hide & merges result (and tolerates network error)
            const postMock = vi.fn().mockResolvedValueOnce({
                success: true,
                hiddenOrderIds: ['ord-meta-1', 'ord-a-1', 'ord-keep-1', 'ord-from-other-tab']
            });
            window.apiClient = { post: postMock, get: vi.fn() };
            toggleOrderSelection('ord-keep-1', true);
            deleteSelectedOrders();

            expect(postMock).toHaveBeenCalledWith('/api/orders/hide', { orderIds: ['ord-keep-1'] }, { timeout: 8000 });
            await Promise.resolve();
            await Promise.resolve();
            expect(getHiddenOrderIds().has('ord-from-other-tab')).toBe(true);
            expect(userA.user_metadata.hidden_order_ids).toContain('ord-from-other-tab');

            // Offline tolerance: rejected POST never throws
            window.apiClient.post = vi.fn().mockRejectedValueOnce(new Error('Offline'));
            setOrdersData([{ id: 'ord-offline-1', status: 'Принят' }]);
            toggleOrderSelection('ord-offline-1', true);
            expect(() => deleteSelectedOrders()).not.toThrow();
            expect(getOrdersData()).toEqual([]);

            // 3. fetchMyOrders ignores foreign-user cache, hydrates user_metadata, reconciles GET /api/orders/hidden, and prunes stale selection
            const userC = { id: 'uid-gamma', user_metadata: { hidden_order_ids: ['ord-c-hidden'] } };
            window.currentUser = userC;
            store.set('currentUser', userC);
            localStorage.setItem('nisha_cached_orders', JSON.stringify([
                { id: 'ord-foreign-user', user_id: 'uid-other', status: 'Принят', created_at: '2026-11-20T11:00:00.000Z', items: [] }
            ]));

            const makeOrderQuery = (rows) => {
                const q = {
                    select: () => q,
                    eq: () => q,
                    in: () => q,
                    is: () => q,
                    limit: () => q,
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    order: () => Promise.resolve({ data: rows, error: null })
                };
                return q;
            };
            window.supabaseClient = {
                from: () => makeOrderQuery([
                    { id: 'ord-c-hidden', user_id: 'uid-gamma', status: 'Принят', created_at: '2026-11-20T10:00:00.000Z', items: [] },
                    { id: 'ord-c-remote-hidden', user_id: 'uid-gamma', status: 'Принят', created_at: '2026-11-20T09:00:00.000Z', items: [] },
                    { id: 'ord-c-visible', user_id: 'uid-gamma', status: 'Принят', created_at: '2026-11-20T08:00:00.000Z', items: [] }
                ])
            };
            let resolveRemoteHidden;
            const remoteHiddenPromise = new Promise((resolve) => { resolveRemoteHidden = resolve; });
            window.apiClient = {
                get: vi.fn().mockReturnValue(remoteHiddenPromise)
            };

            await fetchMyOrders();
            expect(getOrdersData().map(o => o.id)).toEqual(['ord-c-remote-hidden', 'ord-c-visible']);
            toggleOrderSelection('ord-c-remote-hidden', true);
            expect(getSelectedOrderIds()).toEqual(['ord-c-remote-hidden']);

            expect(window.apiClient.get).toHaveBeenCalledWith('/api/orders/hidden', { timeout: 6000 });
            resolveRemoteHidden({
                success: true,
                hiddenOrderIds: ['ord-c-hidden', 'ord-c-remote-hidden']
            });
            await Promise.resolve();
            await Promise.resolve();

            expect(getOrdersData().map(o => o.id)).toEqual(['ord-c-visible']);
            expect(getSelectedOrderIds()).toEqual([]);
            expect(elements.ordersDeleteCount.textContent).toBe('0');
            expect(mergeRemoteHiddenOrderIds(['ord-c-remote-hidden'])).toBe(false);
            expect(JSON.parse(localStorage.getItem('nisha_hidden_orders_uid-gamma'))).toEqual([
                'ord-c-hidden',
                'ord-c-remote-hidden'
            ]);
        } finally {
            clearOrderSelection();
            globalThis.document = prevDoc;
            window.currentUser = prevUser;
            store.set('currentUser', prevStoreUser ?? null);
            window.apiClient = prevApiClient;
            window.supabaseClient = prevSupabase;
            localStorage.removeItem('nisha_hidden_orders_uid-alpha');
            localStorage.removeItem('nisha_hidden_orders_uid-beta');
            localStorage.removeItem('nisha_hidden_orders_uid-gamma');
            localStorage.removeItem('nisha_hidden_orders_v1');
            localStorage.removeItem('nisha_cached_orders');
        }
    });
});
