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
    getNovaPoshtaTrackingUrl
} from '../js/orders/orders-state.js';
import {
    updateOrderTabCounters,
    switchOrderTab,
    renderFilteredOrders
} from '../js/orders/orders-render.js';
import '../js/orders/orders.js';

describe('Modular Orders Suite (js/orders/orders-*.js)', () => {
    const store = globalThis.store;

    beforeEach(() => {
        globalThis.window = globalThis.window || globalThis;
        window.store = store;
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
});
