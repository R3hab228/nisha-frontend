import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// Создаем легкое браузерное окружение (window + Storage + localStorage) для тестирования store.js
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

let store;

beforeAll(async () => {
    globalThis.Storage = MockStorage;
    globalThis.localStorage = new MockStorage();
    globalThis.window = globalThis.window || globalThis;
    if (typeof globalThis.window.addEventListener !== 'function') {
        globalThis.window.addEventListener = vi.fn();
    }

    await import('../js/core/store.js');
    store = globalThis.store;
});

beforeEach(() => {
    globalThis.localStorage.clear();
    store.clearCart();
    store.set('favorites', []);
    store.set('history', []);
    store.set('reviewedOrders', []);
    store.set('dismissedReviews', []);
});

describe('ReactiveStore (js/core/store.js) — State, Cart, Favorites & Persistence', () => {
    it('initializes with default values and supports direct Proxy property access', () => {
        expect(store.cart).toEqual([]);
        expect(store.cartCount).toBe(0);
        expect(store.cartTotal).toBe(0);
        expect(store.lang).toBe('ru');
    });

    it('adds items to cart, prevents duplicates, and calculates cartCount & cartTotal', () => {
        const item1 = { id: 'it-1', name: 'Vintage Nike', price: 1200 };
        const item2 = { id: 'it-2', name: 'Carhartt Pants', price: 1800 };

        expect(store.addToCart(item1)).toBe(true);
        // Duplicate add should return false and not duplicate item
        expect(store.addToCart(item1)).toBe(false);
        expect(store.addToCart(item2)).toBe(true);

        expect(store.cartCount).toBe(2);
        expect(store.cartTotal).toBe(3000);
        expect(store.isInCart('it-1')).toBe(true);
        expect(store.isInCart('it-999')).toBe(false);

        // Verify persistence in localStorage
        const persisted = JSON.parse(globalThis.localStorage.getItem('nisha_cart'));
        expect(persisted).toHaveLength(2);
    });

    it('removes items from cart and clears cart completely', () => {
        store.addToCart({ id: 'it-1', name: 'Tee', price: 600 });
        store.addToCart({ id: 'it-2', name: 'Cap', price: 400 });

        expect(store.removeFromCart('it-1')).toBe(true);
        expect(store.removeFromCart('non-existent')).toBe(false);
        expect(store.cartCount).toBe(1);
        expect(store.cartTotal).toBe(400);

        store.clearCart();
        expect(store.cartCount).toBe(0);
        expect(store.get('cartTime')).toBe(0);
    });

    it('toggles favorites and checks favorite state accurately', () => {
        expect(store.isFavorite('fav-1')).toBe(false);

        const added = store.toggleFavorite('fav-1');
        expect(added).toBe(true);
        expect(store.isFavorite('fav-1')).toBe(true);

        const removed = store.toggleFavorite('fav-1');
        expect(removed).toBe(false);
        expect(store.isFavorite('fav-1')).toBe(false);
    });

    it('maintains history without duplicates and caps at 30 items', () => {
        for (let i = 1; i <= 35; i++) {
            store.addHistory({ id: `item-${i}`, name: `Item ${i}`, price: i * 100, images: [`img-${i}.webp`] });
        }
        expect(store.history).toHaveLength(30);
        expect(store.history[0].id).toBe('item-35');

        // Re-viewing an item moves it to the top without duplicating
        store.addHistory({ id: 'item-20', name: 'Item 20', price: 2000, images: ['img-20.webp'] });
        expect(store.history).toHaveLength(30);
        expect(store.history[0].id).toBe('item-20');
    });

    it('batches multiple state mutations and notifies subscribers once per key', () => {
        const cartSpy = vi.fn();
        const unsubscribe = store.subscribe('cart', cartSpy);

        store.batch(() => {
            store.set('cart', [{ id: '1', price: 100 }]);
            store.set('cart', [{ id: '1', price: 100 }, { id: '2', price: 200 }]);
        });

        expect(cartSpy).toHaveBeenCalledTimes(1);
        expect(cartSpy).toHaveBeenCalledWith([{ id: '1', price: 100 }, { id: '2', price: 200 }], undefined, 'cart');
        unsubscribe();
    });

    it('intercepts direct legacy localStorage.setItem calls and syncs state reactively', () => {
        const externalCart = [{ id: 'legacy-1', name: 'Legacy Hoodie', price: 950 }];
        globalThis.localStorage.setItem('nisha_cart', JSON.stringify(externalCart));

        expect(store.cart).toEqual(externalCart);
        expect(store.cartTotal).toBe(950);
    });
});
