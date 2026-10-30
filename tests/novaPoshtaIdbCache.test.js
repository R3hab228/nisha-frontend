import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

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
    get length() {
        return this._map.size;
    }
    key(index) {
        return Array.from(this._map.keys())[index] || null;
    }
    get(key, def = '') {
        return this._map.has(key) ? this._map.get(key) : def;
    }
    set(key, val) {
        this._map.set(key, String(val));
    }
    getJSON(key, def = null) {
        try {
            const raw = this.getItem(key);
            return raw ? JSON.parse(raw) : def;
        } catch (_) {
            return def;
        }
    }
    setJSON(key, val) {
        this.setItem(key, JSON.stringify(val));
    }
}

describe('Nova Poshta Multi-Tier IndexedDB & In-Memory Cache', () => {
    let mockIdbMap = new Map();

    beforeAll(async () => {
        globalThis.Storage = MockStorage;
        globalThis.localStorage = new MockStorage();
        globalThis.sessionStorage = new MockStorage();
        globalThis.storage = {
            session: new MockStorage(),
            get: (k, d) => globalThis.localStorage.get(k, d),
            set: (k, v) => globalThis.localStorage.set(k, v)
        };
        globalThis.window = globalThis.window || globalThis;
        if (typeof globalThis.window.addEventListener !== 'function') {
            globalThis.window.addEventListener = vi.fn();
        }
        globalThis.window.storage = globalThis.storage;
        globalThis.window.location = { hostname: 'localhost', protocol: 'http:', origin: 'http://localhost' };

        // Mock IndexedDB API
        mockIdbMap = new Map();
        globalThis.window.idbGet = vi.fn(async (k) => mockIdbMap.has(k) ? mockIdbMap.get(k) : null);
        globalThis.window.idbSet = vi.fn(async (k, v) => { mockIdbMap.set(k, v); return true; });
        globalThis.window.idbDel = vi.fn(async (k) => { mockIdbMap.delete(k); return true; });

        // Mock DOM elements
        const elements = {
            cityDropdown: { style: { display: 'none' }, replaceChildren: vi.fn(), appendChild: vi.fn(), setAttribute: vi.fn() },
            branchDropdown: { style: { display: 'none' }, replaceChildren: vi.fn(), appendChild: vi.fn(), setAttribute: vi.fn() },
            orderCity: { value: '' },
            orderBranch: { value: '' }
        };

        globalThis.document = {
            getElementById: vi.fn((id) => elements[id] || null),
            querySelector: vi.fn(() => null),
            querySelectorAll: vi.fn(() => []),
            createElement: vi.fn(() => ({ className: '', innerText: '', style: {} })),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };

        globalThis.apiClient = {
            post: vi.fn()
        };
        globalThis.window.apiClient = globalThis.apiClient;

        await import('../js/core/store.js');
        await import('../js/cart/cart.js');
    });

    beforeEach(() => {
        mockIdbMap.clear();
        globalThis.sessionStorage.clear();
        globalThis.storage.session.clear();
        if (typeof window.clearNPCache === 'function') {
            window.clearNPCache();
        }
        vi.clearAllMocks();
    });

    it('slimBranches compresses verbose Nova Poshta API warehouse objects', () => {
        const { slimBranches } = window;
        expect(typeof slimBranches).toBe('function');

        const rawList = [
            {
                Ref: 'ref_1',
                Description: 'Відділення №1: вул. Хрещатик, 1',
                TypeOfWarehouse: '9a68df70-0267-42a8-bb5c-37f427e36ee4',
                Number: 1,
                CityRef: 'city_kyiv',
                PostFinance: '1',
                BicycleParking: '0',
                POSTerminal: '1',
                WarehouseStatus: 'Working'
            },
            {
                Ref: 'ref_2',
                Description: 'Поштомат №1500: просп. Перемоги, 25',
                TypeOfWarehouse: 'f9316480-5f2d-425d-bc2c-ac7cd29decf0',
                Number: '1500',
                CityRef: 'city_kyiv'
            }
        ];

        const slimmed = slimBranches(rawList);
        expect(slimmed.length).toBe(2);
        expect(slimmed[0]).toEqual({
            Ref: 'ref_1',
            Description: 'Відділення №1: вул. Хрещатик, 1',
            TypeOfWarehouse: '9a68df70-0267-42a8-bb5c-37f427e36ee4',
            Number: '1'
        });
        expect(slimmed[0].CityRef).toBeUndefined();
        expect(slimmed[0].PostFinance).toBeUndefined();
    });

    it('setNPStorage saves to In-Memory, IndexedDB and slims branch arrays', async () => {
        const { setNPStorage, getNPStorageAsync } = window;

        const testBranches = [
            { Ref: 'b1', Description: 'Відділення №1', Number: 1, TypeOfWarehouse: 'wh', ExtraUnused: 123 },
            { Ref: 'b2', Description: 'Відділення №2', Number: 2, TypeOfWarehouse: 'wh', ExtraUnused: 456 }
        ];

        setNPStorage('branchall_kyiv_test', testBranches);

        expect(window.idbSet).toHaveBeenCalledWith(
            'np_branchall_kyiv_test',
            expect.objectContaining({
                ts: expect.any(Number),
                data: [
                    { Ref: 'b1', Description: 'Відділення №1', Number: '1', TypeOfWarehouse: 'wh' },
                    { Ref: 'b2', Description: 'Відділення №2', Number: '2', TypeOfWarehouse: 'wh' }
                ]
            })
        );

        // Immediate read from In-Memory (0ms)
        const readMem = await getNPStorageAsync('branchall_kyiv_test');
        expect(readMem).toEqual([
            { Ref: 'b1', Description: 'Відділення №1', Number: '1', TypeOfWarehouse: 'wh' },
            { Ref: 'b2', Description: 'Відділення №2', Number: '2', TypeOfWarehouse: 'wh' }
        ]);
    });

    it('getNPStorageAsync fetches from IndexedDB when memory is cleared and populates memory cache', async () => {
        const { setNPStorage, getNPStorageAsync } = window;

        const cityData = { success: true, data: [{ MainDescription: 'Київ', DeliveryCity: 'ref_kyiv' }] };
        setNPStorage('city_kyiv', cityData);

        // Clear in-memory cache to simulate fresh browser session/tab
        await window.clearNPCache();

        // Read through getNPStorageAsync
        const result = await getNPStorageAsync('city_kyiv');
        expect(result).toEqual(cityData);
        expect(window.idbGet).toHaveBeenCalledWith('np_city_kyiv');

        // Subsequent read should hit In-Memory L1 without calling idbGet again
        window.idbGet.mockClear();
        const memoryResult = await getNPStorageAsync('city_kyiv');
        expect(memoryResult).toEqual(cityData);
        expect(window.idbGet).not.toHaveBeenCalled();
    });

    it('getNPStorageAsync prunes expired items using TTL and deletes them from IndexedDB', async () => {
        const { getNPStorageAsync } = window;

        // Save expired item (older than 24h)
        const expiredTs = Date.now() - (25 * 60 * 60 * 1000);
        mockIdbMap.set('np_branchall_expired', {
            ts: expiredTs,
            ttl: 24 * 60 * 60 * 1000,
            data: [{ Ref: 'old_ref', Description: 'Старе відділення' }]
        });

        const result = await getNPStorageAsync('branchall_expired');
        expect(result).toBeNull();
        expect(window.idbDel).toHaveBeenCalledWith('np_branchall_expired');
    });

    it('does not pollute sessionStorage with large branch arrays (>200 items), protecting 5MB limit', () => {
        const { setNPStorage } = window;

        const largeBranchList = Array.from({ length: 500 }, (_, i) => ({
            Ref: `ref_${i}`,
            Description: `Відділення №${i}`,
            Number: String(i),
            TypeOfWarehouse: 'wh'
        }));

        setNPStorage('branchall_huge_city', largeBranchList);

        // Saved to IndexedDB
        expect(window.idbSet).toHaveBeenCalledWith('np_branchall_huge_city', expect.any(Object));

        // NOT saved to sessionStorage
        expect(globalThis.sessionStorage.getItem('nisha_np_branchall_huge_city')).toBeNull();
        expect(globalThis.storage.session.getJSON('nisha_np_branchall_huge_city', null)).toBeNull();
    });

    it('searchNPCity uses getNPStorageAsync to return cached results from IndexedDB without API call', async () => {
        const { searchNPCity, setNPStorage } = window;

        const cachedKyiv = {
            success: true,
            data: [{ Addresses: [{ Present: 'м. Київ, Київська обл.', DeliveryCity: '8d5a980d-391c-11dd-90d9-001a92567626' }] }]
        };
        setNPStorage('city_київ', cachedKyiv);

        await searchNPCity('київ');

        // Should NOT call external API since it was resolved from IndexedDB/Memory
        expect(globalThis.apiClient.post).not.toHaveBeenCalled();
    });

    it('getNPStorage checks TTL and returns null when in-memory entry is expired', () => {
        const { setNPStorage, getNPStorage } = window;

        setNPStorage('branchall_exp_sync', [{ Ref: 'r1', Description: 'D1' }], -1000); // negative TTL = already expired
        const res = getNPStorage('branchall_exp_sync');
        expect(res).toBeNull();
    });

    it('trims in-memory cache to prevent memory leaks when inserting over 150 items', () => {
        const { setNPStorage, getNPStorage } = window;

        for (let i = 0; i < 160; i++) {
            setNPStorage(`key_${i}`, { data: i });
        }

        // Oldest item key_0 should have been evicted by FIFO trim
        expect(getNPStorage('key_0')).toBeNull();
        // Recent item key_159 should be in memory
        expect(getNPStorage('key_159')).toEqual({ data: 159 });
    });

    it('exports NP storage functions from modular facade (src/modules/cart.js)', async () => {
        const cartMod = await import('../src/modules/cart.js');
        expect(typeof cartMod.getNPStorageAsync).toBe('function');
        expect(typeof cartMod.getNPStorage).toBe('function');
        expect(typeof cartMod.setNPStorage).toBe('function');
        expect(typeof cartMod.clearNPCache).toBe('function');
        expect(typeof cartMod.slimBranches).toBe('function');
    });
});
