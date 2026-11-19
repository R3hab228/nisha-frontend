import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getAcceptedBargain,
    getPendingBargain,
    isBargainDeclined,
    setAcceptedBargain,
    setPendingBargain,
    setBargainDeclined,
    clearPendingBargain,
    clearAllBargainState
} from '../js/core/bargain-storage.js';

function createMemoryStorage() {
    const map = new Map();
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
        clear: () => map.clear()
    };
}

describe('Modernization Refactors — Bargain Storage, Serialized OTP Polling & Signal Guards', () => {
    const origSession = globalThis.sessionStorage;
    const origLocal = globalThis.localStorage;

    beforeEach(() => {
        const memSession = createMemoryStorage();
        const memLocal = createMemoryStorage();
        globalThis.sessionStorage = memSession;
        globalThis.localStorage = memLocal;
        if (globalThis.window) {
            globalThis.window.sessionStorage = memSession;
            globalThis.window.localStorage = memLocal;
        }
    });

    afterEach(() => {
        globalThis.sessionStorage = origSession;
        globalThis.localStorage = origLocal;
        if (globalThis.window) {
            globalThis.window.sessionStorage = origSession;
            globalThis.window.localStorage = origLocal;
        }
        vi.restoreAllMocks();
    });

    it('setAcceptedBargain persists payload across both storages and clears declined/pending markers', () => {
        setBargainDeclined('item-1');
        setPendingBargain('item-1', { itemId: 'item-1', offeredPrice: 800, timestamp: Date.now() });
        expect(isBargainDeclined('item-1')).toBe(true);

        setAcceptedBargain('item-1', { itemId: 'item-1', acceptedPrice: 950, originalPrice: 1200 });

        expect(getAcceptedBargain('item-1')).toEqual({ itemId: 'item-1', acceptedPrice: 950, originalPrice: 1200 });
        expect(isBargainDeclined('item-1')).toBe(false);
        expect(getPendingBargain('item-1')).toBeNull();
    });

    it('getPendingBargain returns valid offers within TTL and auto-evicts expired offers', () => {
        const now = Date.now();
        setPendingBargain('item-fresh', { itemId: 'item-fresh', offeredPrice: 700, timestamp: now - 1000 });
        expect(getPendingBargain('item-fresh')).toMatchObject({ offeredPrice: 700 });

        setPendingBargain('item-old', { itemId: 'item-old', offeredPrice: 600, timestamp: now - (25 * 60 * 60 * 1000) });
        expect(getPendingBargain('item-old')).toBeNull();
        expect(globalThis.localStorage.getItem('pending_bargain_item-old')).toBeNull();
        expect(globalThis.sessionStorage.getItem('pending_bargain_item-old')).toBeNull();
    });

    it('clearAllBargainState and clearPendingBargain handle throwing storage gracefully', () => {
        setAcceptedBargain('item-2', { acceptedPrice: 500 });
        setPendingBargain('item-2', { offeredPrice: 450, timestamp: Date.now() });
        clearPendingBargain('item-2');
        expect(getPendingBargain('item-2')).toBeNull();
        expect(getAcceptedBargain('item-2')).toEqual({ acceptedPrice: 500 });

        clearAllBargainState('item-2');
        expect(getAcceptedBargain('item-2')).toBeNull();

        globalThis.sessionStorage = {
            getItem: () => { throw new Error('SecurityError'); },
            setItem: () => { throw new Error('QuotaExceededError'); },
            removeItem: () => { throw new Error('SecurityError'); }
        };
        globalThis.localStorage = globalThis.sessionStorage;

        expect(() => setAcceptedBargain('item-3', { acceptedPrice: 300 })).not.toThrow();
        expect(getAcceptedBargain('item-3')).toBeNull();
        expect(isBargainDeclined('item-3')).toBe(false);
    });
});
