import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

class MockStorage {
    constructor() {
        this._map = new Map();
    }
    getItem(key) {
        return this._map.has(key) ? this._map.get(key) : null;
    }
    setItem(key, val) {
        this._map.set(key, String(val));
    }
    removeItem(key) {
        this._map.delete(key);
    }
    clear() {
        this._map.clear();
    }
}

describe('Modern JS APIs (crypto.randomUUID, Object.groupBy, structuredClone)', () => {
    beforeAll(async () => {
        globalThis.Storage = MockStorage;
        globalThis.localStorage = new MockStorage();
        globalThis.window = globalThis.window || globalThis;
        if (typeof globalThis.window.addEventListener !== 'function') {
            globalThis.window.addEventListener = vi.fn();
        }
        globalThis.document = {
            getElementById: vi.fn(() => null),
            querySelector: vi.fn(() => null),
            querySelectorAll: vi.fn(() => []),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            createElement: vi.fn(() => ({
                style: {},
                classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
                setAttribute: vi.fn(),
                appendChild: vi.fn(),
                remove: vi.fn()
            }))
        };

        // Evaluate helpers, store, product, orders in window context
        const helpersCode = readFileSync(resolve(__dirname, '../js/core/helpers.js'), 'utf8');
        eval(helpersCode);

        await import('../js/core/store.js');

        const productCode = readFileSync(resolve(__dirname, '../js/product/product.js'), 'utf8');
        eval(productCode);

        const ordersCode = readFileSync(resolve(__dirname, '../js/orders/orders.js'), 'utf8');
        eval(ordersCode);
    });

    beforeEach(() => {
        globalThis.localStorage.clear();
        if (globalThis.store && typeof globalThis.store.clearCart === 'function') {
            globalThis.store.clearCart();
        }
    });

    describe('1. crypto.randomUUID() replacements', () => {
        it('generateShortId generates clean alphanumeric IDs without hyphens', () => {
            const id1 = window.generateShortId(8);
            const id2 = window.generateShortId(8);
            expect(typeof id1).toBe('string');
            expect(id1.length).toBe(8);
            expect(id1).not.toContain('-');
            expect(id1).not.toBe(id2);
        });

        it('generateMeasurementSchemeSvg uses crypto.randomUUID for unique SVG marker IDs', () => {
            const svg1 = window.generateMeasurementSchemeSvg('tshirt', { shoulders: 50, chest: 55, length: 70 }, 'ru');
            const svg2 = window.generateMeasurementSchemeSvg('tshirt', { shoulders: 50, chest: 55, length: 70 }, 'ru');
            
            const match1 = svg1.match(/id="(arrowG_[a-zA-Z0-9]+)"/);
            const match2 = svg2.match(/id="(arrowG_[a-zA-Z0-9]+)"/);
            
            expect(match1).not.toBeNull();
            expect(match2).not.toBeNull();
            expect(match1[1]).not.toBe(match2[1]);
        });
    });

    describe('2. Object.groupBy() grouping and fallbacks', () => {
        it('getOrderTabBucket correctly categorizes various order statuses', () => {
            expect(window.getOrderTabBucket({ status: 'Принят в обработку' })).toBe('accepted');
            expect(window.getOrderTabBucket({ status: 'Оплачен картой' })).toBe('accepted');
            expect(window.getOrderTabBucket({ status: 'В обработке' })).toBe('accepted');
            expect(window.getOrderTabBucket({ status: 'Отправлен' })).toBe('shipped');
            expect(window.getOrderTabBucket({ status: 'Завершен' })).toBe('shipped');
            expect(window.getOrderTabBucket({ status: 'Отменен покупателем' })).toBe('cancelled');
            expect(window.getOrderTabBucket({ status: 'Возврат товара' })).toBe('cancelled');
            expect(window.getOrderTabBucket({ status: 'Неизвестный статус' })).toBe('other');
        });

        it('Object.groupBy partitions orders into expected tab buckets', () => {
            const orders = [
                { id: '1', status: 'Принят' },
                { id: '2', status: 'Оплачен' },
                { id: '3', status: 'Отправлен' },
                { id: '4', status: 'Отменен' },
                { id: '5', status: 'В обработке' }
            ];

            const grouped = (typeof Object.groupBy === 'function')
                ? Object.groupBy(orders, window.getOrderTabBucket)
                : orders.reduce((acc, o) => {
                    const b = window.getOrderTabBucket(o);
                    (acc[b] = acc[b] || []).push(o);
                    return acc;
                }, {});

            expect(grouped.accepted).toHaveLength(3);
            expect(grouped.shipped).toHaveLength(1);
            expect(grouped.cancelled).toHaveLength(1);
            expect(grouped.accepted.map(o => o.id)).toEqual(['1', '2', '5']);
        });

        it('Object.groupBy handles catalog category counters accurately', () => {
            const catalog = [
                { id: 101, category: 'Худи' },
                { id: 102, category: 'Футболки' },
                { id: 103, category: 'Худи' },
                { id: 104, category: null }
            ];

            const grouped = (typeof Object.groupBy === 'function')
                ? Object.groupBy(catalog, item => item?.category || 'Без категории')
                : catalog.reduce((acc, item) => {
                    const c = item?.category || 'Без категории';
                    (acc[c] = acc[c] || []).push(item);
                    return acc;
                }, {});

            expect(grouped['Худи']).toHaveLength(2);
            expect(grouped['Футболки']).toHaveLength(1);
            expect(grouped['Без категории']).toHaveLength(1);
        });
    });

    describe('3. structuredClone() and deepClone() immutability', () => {
        it('deepClone clones nested objects and arrays without mutating source', () => {
            const original = {
                id: 'prod_1',
                name: 'Vintage Jacket',
                details: { size: 'L', color: 'Black', measurements: [52, 60, 72] },
                tags: ['outerwear', 'archive']
            };

            const clone = window.deepClone(original);
            expect(clone).toEqual(original);
            expect(clone).not.toBe(original);
            expect(clone.details).not.toBe(original.details);
            expect(clone.details.measurements).not.toBe(original.details.measurements);

            // Mutation test
            clone.details.size = 'M';
            clone.details.measurements.push(80);
            expect(original.details.size).toBe('L');
            expect(original.details.measurements).toHaveLength(3);
        });

        it('store.addToCart safely isolates stored item from outside reference mutations', () => {
            const sourceItem = {
                id: 'item-999',
                name: 'Cargo Pants',
                price: 1500,
                attributes: { color: 'Olive' }
            };

            const added = globalThis.store.addToCart(sourceItem);
            expect(added).toBe(true);

            // Mutate sourceItem after addition
            sourceItem.price = 9999;
            sourceItem.attributes.color = 'Red';

            const cart = globalThis.store.get('cart');
            expect(cart).toHaveLength(1);
            expect(cart[0].price).toBe(1500);
            expect(cart[0].attributes.color).toBe('Olive');
        });
    });
});
