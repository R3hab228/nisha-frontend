import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function makeEl(id, initialDisplay = 'flex') {
    const listeners = {};
    const classes = new Set();
    return {
        id,
        dataset: {},
        style: {
            display: initialDisplay,
            transition: '',
            transform: '',
            setProperty: () => {},
            removeProperty: () => {},
            getPropertyValue: () => '',
            getPropertyPriority: () => ''
        },
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            toggle: (c, force) => {
                if (force === undefined) {
                    if (classes.has(c)) classes.delete(c);
                    else classes.add(c);
                } else if (force) {
                    classes.add(c);
                } else {
                    classes.delete(c);
                }
            },
            contains: (c) => classes.has(c)
        },
        scrollTop: 0,
        innerHTML: '',
        addEventListener: (type, fn) => {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(fn);
        },
        dispatchEvent: (ev) => {
            for (const fn of (listeners[ev.type] || [])) {
                fn(ev);
            }
        }
    };
}

function dispatchTouch(el, type, clientX, clientY) {
    el.dispatchEvent({
        type,
        touches: type === 'touchend' || type === 'touchcancel' ? [] : [{ clientX, clientY }],
        target: el
    });
}

describe('Orders Modal Mobile Tab Swipe', () => {
    let listArea;

    beforeEach(async () => {
        listArea = makeEl('ordersListArea', 'flex');
        const tabsEl = makeEl('ordersTabs', 'flex');
        const tabYellow = makeEl('tabYellow');
        const tabBlue = makeEl('tabBlue');
        const tabRed = makeEl('tabRed');

        globalThis.window = globalThis;
        globalThis.innerWidth = 390;
        globalThis.globalOrdersData = [];
        globalThis.currentOrderTab = 'accepted';
        globalThis.safeViewTransition = (fn) => fn();
        globalThis.renderFilteredOrders = () => {};

        globalThis.document = {
            documentElement: { clientWidth: 390 },
            getElementById: (id) => {
                if (id === 'ordersListArea') return listArea;
                if (id === 'ordersTabs') return tabsEl;
                return null;
            },
            querySelector: (sel) => {
                if (sel === '.order-tab.tab-yellow') return tabYellow;
                if (sel === '.order-tab.tab-blue') return tabBlue;
                if (sel === '.order-tab.tab-red') return tabRed;
                return null;
            },
            querySelectorAll: () => []
        };

        vi.resetModules();
        await import('../js/orders/orders.js');
        globalThis.bindOrdersTabSwipe();
    });

    it('switches to next tab on swipe left (accepted -> shipped -> cancelled) and previous on swipe right', () => {
        // Swipe left: accepted -> shipped
        dispatchTouch(listArea, 'touchstart', 260, 200);
        dispatchTouch(listArea, 'touchmove', 190, 204);
        dispatchTouch(listArea, 'touchend', 190, 204);
        expect(globalThis.currentOrderTab).toBe('shipped');

        // Swipe left: shipped -> cancelled
        dispatchTouch(listArea, 'touchstart', 260, 200);
        dispatchTouch(listArea, 'touchmove', 180, 202);
        dispatchTouch(listArea, 'touchend', 180, 202);
        expect(globalThis.currentOrderTab).toBe('cancelled');

        // Boundary swipe left at last tab stays on cancelled
        dispatchTouch(listArea, 'touchstart', 260, 200);
        dispatchTouch(listArea, 'touchmove', 180, 200);
        dispatchTouch(listArea, 'touchend', 180, 200);
        expect(globalThis.currentOrderTab).toBe('cancelled');

        // Swipe right: cancelled -> shipped
        dispatchTouch(listArea, 'touchstart', 120, 200);
        dispatchTouch(listArea, 'touchmove', 200, 204);
        dispatchTouch(listArea, 'touchend', 200, 204);
        expect(globalThis.currentOrderTab).toBe('shipped');
    });

    it('locks vertical scroll and ignores accidental horizontal drift after vertical movement', () => {
        dispatchTouch(listArea, 'touchstart', 200, 200);
        dispatchTouch(listArea, 'touchmove', 205, 230); // vertical scroll lock
        dispatchTouch(listArea, 'touchmove', 100, 260); // horizontal drift later
        dispatchTouch(listArea, 'touchend', 100, 260);

        expect(globalThis.currentOrderTab).toBe('accepted');
    });

    it('ignores edge-started swipes (< 20px) to avoid conflicting with OS back gesture', () => {
        dispatchTouch(listArea, 'touchstart', 10, 200);
        dispatchTouch(listArea, 'touchmove', 120, 202);
        dispatchTouch(listArea, 'touchend', 120, 202);

        expect(globalThis.currentOrderTab).toBe('accepted');
    });

    it('formats order date as DD.MM.YYYY and renders it under order-id in .order-id-wrap', async () => {
        const code = readFileSync(resolve(__dirname, '../js/orders/orders.js'), 'utf8');
        expect(code).toContain('<div class="order-id-wrap">');
        expect(code).toContain('<span class="order-date">${date}</span>');
        const date = new Date(2026, 10, 13, 12, 0, 0).toISOString();
        const { invokeAction } = await import('../js/core/action-registry.js');
        const res = invokeAction('formatOrderDate', date);
        expect(res).toBe('13.11.2026');
    });
});
