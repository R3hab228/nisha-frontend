import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
        }
    };
}

function createFakeElement(tagName = 'div') {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
        tagName: tagName.toUpperCase(),
        id: '',
        _className: '',
        _classList: createClassList(),
        get classList() {
            return this._classList;
        },
        set className(val) {
            this._className = String(val || '');
            this._classList = createClassList(this._className.split(/\s+/).filter(Boolean));
        },
        get className() {
            return this._className || '';
        },
        style: {},
        dataset: {},
        children: [],
        parentElement: null,
        get parentNode() {
            return this.parentElement;
        },
        _innerHTML: '',
        _textContent: '',
        get innerHTML() {
            return this._innerHTML;
        },
        set innerHTML(val) {
            this._innerHTML = String(val || '');
        },
        get textContent() {
            return this._textContent || this._innerHTML.replace(/<[^>]*>/g, '');
        },
        set textContent(val) {
            this._textContent = String(val || '');
        },
        appendChild(child) {
            child.parentElement = this;
            this.children.push(child);
            return child;
        },
        remove() {
            if (this.parentElement && Array.isArray(this.parentElement.children)) {
                this.parentElement.children = this.parentElement.children.filter(c => c !== this);
            }
            this.parentElement = null;
        },
        get firstElementChild() {
            return this.children[0] || null;
        },
        setAttribute(k, v) {
            attrs.set(k, String(v));
        },
        getAttribute(k) {
            return attrs.has(k) ? attrs.get(k) : null;
        },
        hasAttribute(k) {
            return attrs.has(k);
        },
        removeAttribute(k) {
            attrs.delete(k);
        },
        addEventListener(ev, fn) {
            if (!listeners.has(ev)) listeners.set(ev, []);
            listeners.get(ev).push(fn);
        },
        dispatchEvent(evt) {
            const list = listeners.get(evt?.type || evt) || [];
            list.forEach(fn => fn(evt));
            return true;
        },
        click() {
            this.dispatchEvent({ type: 'click', target: this });
        },
        closest(selector) {
            let cur = this;
            while (cur) {
                for (const part of selector.split(',').map(s => s.trim())) {
                    if (part === '[data-action]' && cur.hasAttribute('data-action')) return cur;
                    if (part === '#toastContainer' && cur.id === 'toastContainer') return cur;
                    if (part.startsWith('.') && cur.classList.contains(part.slice(1))) return cur;
                }
                cur = cur.parentElement;
            }
            return null;
        },
        querySelector(selector) {
            if (selector === 'button') return this.children.find(c => c.tagName === 'BUTTON') || null;
            if (selector === '.confirm-yes') {
                return { addEventListener: (ev, cb) => { if (ev === 'click') this._onConfirmYes = cb; }, click: () => this._onConfirmYes?.() };
            }
            if (selector === '.confirm-no') {
                return { addEventListener: (ev, cb) => { if (ev === 'click') this._onConfirmNo = cb; }, click: () => this._onConfirmNo?.() };
            }
            return null;
        },
        querySelectorAll(selector) {
            const cls = selector.startsWith('.') ? selector.slice(1) : null;
            const res = [];
            const walk = (node) => {
                for (const child of node.children) {
                    if (cls && child.classList.contains(cls)) res.push(child);
                    walk(child);
                }
            };
            walk(this);
            return res;
        }
    };
    return el;
}

function setupMockEnv() {
    const body = createFakeElement('body');
    const documentElement = createFakeElement('html');
    const docListeners = new Map();
    const doc = {
        readyState: 'complete',
        documentElement,
        body,
        createElement: (tag) => createFakeElement(tag),
        getElementById: (id) => {
            const walk = (node) => {
                for (const child of node.children) {
                    if (child.id === id) return child;
                    const found = walk(child);
                    if (found) return found;
                }
                return null;
            };
            return walk(body);
        },
        querySelector: (sel) => body.querySelector(sel),
        querySelectorAll: (sel) => body.querySelectorAll(sel),
        addEventListener: (ev, fn) => {
            if (!docListeners.has(ev)) docListeners.set(ev, []);
            docListeners.get(ev).push(fn);
        }
    };
    globalThis.document = doc;
    globalThis.window = {
        location: { origin: 'https://www.nisha-store.shop', href: 'https://www.nisha-store.shop/' },
        innerWidth: 1280,
        scrollTo: vi.fn(),
        matchMedia: vi.fn(() => ({ matches: false }))
    };
    return { doc, body, documentElement };
}

const {
    barrel,
    coreUtils,
    securityMedia,
    storageIdb,
    searchAddress,
    toastsModals,
    pwaBrowser,
    delegation
} = await (async () => {
    setupMockEnv();
    const barrelMod = await import('../js/core/helpers.js');
    const coreUtilsMod = await import('../js/core/helpers-core-utils.js');
    const securityMediaMod = await import('../js/core/helpers-security-media.js');
    const storageIdbMod = await import('../js/core/helpers-storage-idb.js');
    const searchAddressMod = await import('../js/core/helpers-search-address.js');
    const toastsModalsMod = await import('../js/core/helpers-toasts-modals.js');
    const pwaBrowserMod = await import('../js/core/helpers-pwa-browser.js');
    const delegationMod = await import('../js/core/helpers-delegation.js');
    return {
        barrel: barrelMod,
        coreUtils: coreUtilsMod,
        securityMedia: securityMediaMod,
        storageIdb: storageIdbMod,
        searchAddress: searchAddressMod,
        toastsModals: toastsModalsMod,
        pwaBrowser: pwaBrowserMod,
        delegation: delegationMod
    };
})();

describe('Modular Core Helpers Deep Suite (js/core/helpers*.js)', () => {
    let origNavDesc;

    beforeEach(() => {
        setupMockEnv();
        globalThis.window.storage = storageIdb.storage;
        origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        if (origNavDesc) {
            Object.defineProperty(globalThis, 'navigator', origNavDesc);
        }
    });

    it('1. maintains strict acyclic module DAG and full barrel re-export parity', () => {
        const modules = [
            'helpers.js',
            'helpers-core-utils.js',
            'helpers-security-media.js',
            'helpers-storage-idb.js',
            'helpers-search-address.js',
            'helpers-toasts-modals.js',
            'helpers-pwa-browser.js',
            'helpers-delegation.js'
        ];

        const graph = new Map();
        for (const file of modules) {
            const code = readFileSync(resolve(__dirname, '../js/core', file), 'utf8');
            const deps = [...code.matchAll(/(?:import|export\s+\*\s+from)\s+['"]\.\/(helpers[^'"]+)['"]/g)].map(m => m[1]);
            graph.set(file, [...new Set(deps)]);
        }

        const visiting = new Set();
        const visited = new Set();
        function hasCycle(node) {
            if (visiting.has(node)) return true;
            if (visited.has(node)) return false;
            visiting.add(node);
            for (const dep of (graph.get(node) || [])) {
                if (hasCycle(dep)) return true;
            }
            visiting.delete(node);
            visited.add(node);
            return false;
        }
        for (const mod of modules) {
            expect(hasCycle(mod)).toBe(false);
        }

        const submodules = [coreUtils, securityMedia, storageIdb, searchAddress, toastsModals, pwaBrowser, delegation];
        for (const sub of submodules) {
            for (const key of Object.keys(sub)) {
                expect(barrel[key]).toBeDefined();
            }
        }
    });

    it('2. helpers-core-utils.js handles URL/UTF-16 surrogates, grapheme clusters, AbortSignal, math, sets & formatting', async () => {
        const broken = 'hello\uD800world';
        expect(coreUtils.isWellFormed(broken)).toBe(false);
        expect(coreUtils.toWellFormed(broken)).toBe('hello\uFFFDworld');
        expect(() => encodeURIComponent(broken)).toThrow();
        expect(coreUtils.safeEncodeURIComponent(broken)).toBe(encodeURIComponent('hello\uFFFDworld'));
        expect(coreUtils.canParseURL('https://www.nisha-store.shop/item?id=1')).toBe(true);
        expect(coreUtils.canParseURL('/catalog', 'https://www.nisha-store.shop')).toBe(true);
        expect(coreUtils.canParseURL('://bad url')).toBe(false);

        const emojiText = '🇺🇦👨‍👩‍👧‍👦🔥';
        expect(coreUtils.getGraphemeCount(emojiText)).toBe(3);
        expect(coreUtils.safeTruncateText(emojiText, 2, '...')).toBe('🇺🇦👨‍👩‍👧‍👦...');

        const c1 = new AbortController();
        const c2 = new AbortController();
        const combined = coreUtils.combineAbortSignals([c1.signal, null, c2.signal]);
        expect(combined.aborted).toBe(false);
        c2.abort('stop');
        expect(combined.aborted).toBe(true);
        await expect(coreUtils.sleep(50, combined)).rejects.toBe('stop');

        expect(coreUtils.clamp(150, 10, 100)).toBe(100);
        expect(coreUtils.clamp(-5, 100, 10)).toBe(10);
        expect(coreUtils.generateShortId(12)).toHaveLength(12);

        const sA = new Set([1, 2, 3]);
        const sB = new Set([2, 3, 4]);
        expect([...coreUtils.setDifference(sA, sB)]).toEqual([1]);
        expect([...coreUtils.setIntersection(sA, sB)]).toEqual([2, 3]);
        expect([...coreUtils.setUnion(sA, sB)]).toEqual([1, 2, 3, 4]);
        expect(coreUtils.setIsSubsetOf(new Set([1, 2]), sA)).toBe(true);
        expect(coreUtils.setIsSubsetOf(sA, sB)).toBe(false);

        const fnObj = { a: 1, fn: () => 'ok' };
        const cloned = coreUtils.deepClone(fnObj);
        expect(cloned).not.toBe(fnObj);
        expect(cloned.a).toBe(1);
        expect(typeof cloned.fn).toBe('function');

        storageIdb.storage.set('nisha_lang', 'en');
        expect(coreUtils.getCurrency()).toBe('UAH');
        expect(coreUtils.formatPrice(2499.6)).toBe('2,500\u00A0UAH');
        storageIdb.storage.set('nisha_lang', 'ua');
        expect(coreUtils.getCurrency()).toBe('грн');
        expect(coreUtils.formatPrice('1200 грн')).toBe('1,200\u00A0грн');
    });

    it('3. helpers-security-media.js rewrites CDN URLs, blocks dangerous protocols & escapes XSS vectors', () => {
        const supaImg = 'https://nmpuefxqtkhvtltdvllz.supabase.co/storage/v1/object/public/items-images/item_123.jpg';
        expect(securityMedia.toCDN(supaImg)).toBe('https://cdn.nisha-store.shop/storage/v1/object/public/items-images/item_123.jpg');
        expect(securityMedia.toCDN(supaImg, { width: 320, quality: 80, format: 'webp' }))
            .toBe('https://cdn.nisha-store.shop/storage/v1/object/public/items-images/thumb_item_123.jpg?w=320&q=80&fmt=webp');
        expect(securityMedia.toCDN('https://cdn.nisha-store.shop/video.mp4', { width: 320 })).toBe('https://cdn.nisha-store.shop/video.mp4');

        const srcSet = securityMedia.getImageSrcSet(supaImg, [320, 768]);
        expect(srcSet).toContain('thumb_item_123.jpg?w=320&q=85&fmt=webp 320w');
        expect(srcSet).toContain('/items-images/item_123.jpg?w=768&q=85&fmt=webp 768w');

        expect(securityMedia.sanitizeHtmlMediaUrl('javascript:alert(1)')).toBeNull();
        expect(securityMedia.isSafeMediaUrl('javascript:alert(1)')).toBe(false);
        expect(securityMedia.sanitizeHtmlMediaUrl('https://cdn.nisha-store.shop/a.webp')).toBe('https://cdn.nisha-store.shop/a.webp');
        expect(securityMedia.sanitizeHtmlMediaUrl('/assets/logo.png')).toContain('/assets/logo.png');
        expect(securityMedia.escapeJsString("foo'bar\n<script>")).toBe("foo\\'bar\\n\\x3cscript\\x3e");
    });

    it('4. helpers-storage-idb.js handles quota cleanup, memory fallback & IndexedDB CRUD/cleanup', async () => {
        const backing = new Map();
        backing.set('nisha_history', JSON.stringify(Array.from({ length: 45 }, (_, i) => i)));
        backing.set('nisha_seen_items', JSON.stringify(Array.from({ length: 250 }, (_, i) => i)));
        backing.set('nisha_search_history', JSON.stringify(Array.from({ length: 25 }, (_, i) => `q${i}`)));

        let throwOnce = true;
        const mockLocal = {
            getItem: (k) => (backing.has(k) ? backing.get(k) : null),
            setItem: (k, v) => {
                if (k === 'big_key' && throwOnce) {
                    throwOnce = false;
                    throw new Error('QuotaExceededError');
                }
                backing.set(k, String(v));
            },
            removeItem: (k) => backing.delete(k),
            clear: () => backing.clear()
        };

        window.localStorage = mockLocal;
        const ok = storageIdb.storage.setJSON('big_key', { ok: true });
        expect(ok).toBe(true);
        expect(JSON.parse(backing.get('nisha_history')).length).toBe(30);
        expect(JSON.parse(backing.get('nisha_seen_items')).length).toBe(200);
        expect(JSON.parse(backing.get('nisha_search_history')).length).toBe(15);

        mockLocal.setItem = () => { throw new Error('SecurityError'); };
        expect(storageIdb.storage.set('fallback_only', 'yes')).toBe(false);
        expect(storageIdb.storage.get('fallback_only')).toBe('yes');
        expect(storageIdb.storage.has('fallback_only')).toBe(true);
        storageIdb.storage.remove('fallback_only');
        expect(storageIdb.storage.get('fallback_only', 'missing')).toBe('missing');

        const idbData = new Map([['np_city_1', 'Kyiv'], ['np_wh_2', 'Branch 2'], ['user_pref', 'dark']]);
        const mockDB = {
            objectStoreNames: { contains: () => true },
            createObjectStore: vi.fn(),
            close: vi.fn(),
            transaction: () => {
                const tx = { oncomplete: null, onerror: null, onabort: null };
                queueMicrotask(() => tx.oncomplete && tx.oncomplete());
                return {
                    set oncomplete(fn) { tx.oncomplete = fn; },
                    get oncomplete() { return tx.oncomplete; },
                    set onerror(fn) { tx.onerror = fn; },
                    set onabort(fn) { tx.onabort = fn; },
                    objectStore: () => ({
                        get: (k) => {
                            const req = { result: idbData.get(k), onsuccess: null };
                            queueMicrotask(() => req.onsuccess && req.onsuccess());
                            return req;
                        },
                        put: (v, k) => idbData.set(k, v),
                        delete: (k) => idbData.delete(k),
                        getAllKeys: () => {
                            const req = { result: [...idbData.keys()], onsuccess: null };
                            queueMicrotask(() => req.onsuccess && req.onsuccess());
                            return req;
                        },
                        openCursor: () => {
                            const entries = [...idbData.keys()];
                            let idx = 0;
                            const req = { onsuccess: null };
                            const next = () => {
                                if (idx < entries.length) {
                                    const key = entries[idx++];
                                    req.onsuccess?.({
                                        target: {
                                            result: {
                                                key,
                                                delete: () => idbData.delete(key),
                                                continue: next
                                            }
                                        }
                                    });
                                } else {
                                    req.onsuccess?.({ target: { result: null } });
                                }
                            };
                            queueMicrotask(next);
                            return req;
                        }
                    })
                };
            }
        };
        window.indexedDB = {
            open: () => {
                const req = { result: mockDB, onsuccess: null, onupgradeneeded: null, onerror: null };
                queueMicrotask(() => req.onsuccess && req.onsuccess());
                return req;
            }
        };

        expect(await storageIdb.idbGet('np_city_1')).toBe('Kyiv');
        expect(await storageIdb.idbSet('custom_k', 42)).toBe(true);
        expect(idbData.get('custom_k')).toBe(42);
        expect(await storageIdb.idbGetAllKeys()).toContain('custom_k');
        expect(await storageIdb.idbDel('custom_k')).toBe(true);
        expect(idbData.has('custom_k')).toBe(false);
        expect(await storageIdb.idbClearNP()).toBe(true);
        expect(idbData.has('np_city_1')).toBe(false);
        expect(idbData.get('user_pref')).toBe('dark');
    });

    it('5. helpers-search-address.js expands synonyms, matches price queries & normalizes addresses/names', () => {
        expect(searchAddress.transliterateCyrillic('найк')).toBe('nayk');
        const expanded = searchAddress.expandSearchQuery('#худи кархарт&');
        expect(expanded).toContain('худи кархарт');
        expect(expanded).toContain('hoodie carhartt');
        expect(expanded).toContain('khudi karkhart');

        expect(searchAddress.parsePriceSearchQuery('500-800 грн')).toEqual({ type: 'range', min: 500, max: 800, price: 500 });
        expect(searchAddress.parsePriceSearchQuery('до 1200')).toEqual({ type: 'max', max: 1200, price: 1200 });
        expect(searchAddress.parsePriceSearchQuery('від 700')).toEqual({ type: 'min', min: 700, price: 700 });
        expect(searchAddress.parsePriceSearchQuery('950 ₴')).toEqual({ type: 'exact', price: 950 });
        expect(searchAddress.parsePriceSearchQuery('carhartt')).toBeNull();

        expect(searchAddress.itemMatchesPrice({ price: 800, old_price: 950 }, { type: 'exact', price: 950 })).toBe(true);
        expect(searchAddress.itemMatchesPrice({ price: '1 200 грн' }, { type: 'range', min: 1000, max: 1500 })).toBe(true);
        expect(searchAddress.itemMatchesPrice({ price: 600 }, { type: 'min', min: 700 })).toBe(false);

        expect(searchAddress.parseDeliveryAddress('м. Львів, Львівська обл., Відділення №15'))
            .toEqual({ city: 'м. Львів, Львівська обл.', branch: 'Відділення №15' });

        expect(searchAddress.formatFullNameWords('іван-петро мельник123')).toBe('Іван-Петро Мельник');
        expect(searchAddress.normalizeFullNameOnBlur('  ІВАНОВ   олексій-БОГДАН  ')).toBe('Іванов Олексій-Богдан');

        const inputListeners = {};
        const mockInput = {
            value: 'марія коваленко',
            selectionStart: 5,
            selectionEnd: 5,
            setSelectionRange: vi.fn(),
            addEventListener: (ev, cb) => { inputListeners[ev] = cb; }
        };
        searchAddress.attachFullNameAutoCapitalize(mockInput);
        inputListeners.input();
        expect(mockInput.value).toBe('Марія Коваленко');
        mockInput.value = '  МАРІЯ  коваленко ';
        inputListeners.blur();
        expect(mockInput.value).toBe('Марія Коваленко');
    });

    it('6. helpers-toasts-modals.js manages toast lifecycle, deduplication, batching, busy buttons & confirm modals', async () => {
        vi.useFakeTimers();

        const container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);

        const clickCb = vi.fn();
        toastsModals.showToast('Added item', 'success', 'https://cdn.nisha-store.shop/a.jpg', clickCb);
        toastsModals.showToast('Added item', 'success');
        expect(container.children).toHaveLength(1);

        const toastEl = container.firstElementChild;
        expect(toastEl.getAttribute('role')).toBe('status');

        vi.advanceTimersByTime(1500);
        toastEl.dispatchEvent({ type: 'mouseenter' });
        vi.advanceTimersByTime(2000);
        expect(toastEl.classList.contains('toast-paused')).toBe(true);
        expect(toastEl.classList.contains('toast-leaving')).toBe(false);

        toastEl.dispatchEvent({ type: 'mouseleave' });
        vi.advanceTimersByTime(1000);
        expect(toastEl.classList.contains('toast-leaving')).toBe(true);
        vi.advanceTimersByTime(300);
        expect(container.children).toHaveLength(0);

        toastsModals.showFavoriteToast({ brand: 'Nike', name: 'TN Cap' }, true, 'https://cdn.nisha-store.shop/1.jpg');
        toastsModals.showFavoriteToast({ brand: 'Stussy', name: 'Hoodie' }, false);
        const favToasts = container.children.filter(c => c.classList.contains('toast-fav-item'));
        expect(favToasts).toHaveLength(1);
        expect(favToasts[0].innerHTML).toContain('Stussy Hoodie');

        favToasts[0].onclick({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(toastsModals.isToastClickShielded()).toBe(true);
        vi.advanceTimersByTime(300);

        toastsModals.enqueueNewItemToast([
            { id: 'n1', brand: 'Nike', name: 'Jacket' },
            { id: 'n1', brand: 'Nike', name: 'Jacket' },
            { id: 'n2', brand: 'Carhartt', name: 'Beanie' }
        ]);
        vi.advanceTimersByTime(360);
        const newToast = container.children.find(c => c.classList.contains('toast-new-item'));
        expect(newToast?.innerHTML).toContain('2');

        const btn = document.createElement('button');
        btn.innerHTML = '<span>Send</span>';
        let innerRuns = 0;
        let rejectInner;
        const firstPromise = toastsModals.withButtonBusy(btn, () => new Promise((_, rej) => {
            innerRuns++;
            rejectInner = rej;
        }), 'Loading...');
        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute('aria-busy')).toBe('true');
        expect(btn.textContent).toBe('Loading...');

        const ignored = await toastsModals.withButtonBusy(btn, () => { innerRuns++; });
        expect(ignored).toBeUndefined();
        expect(innerRuns).toBe(1);

        rejectInner(new Error('boom'));
        await expect(firstPromise).rejects.toThrow('boom');
        expect(btn.disabled).toBe(false);
        expect(btn.getAttribute('aria-busy')).toBeNull();
        expect(btn.innerHTML).toBe('<span>Send</span>');

        const onConfirm = vi.fn();
        toastsModals.showConfirmTerminalModal('CONFIRM?', '<p>Sure?</p>', 'YES', 'NO', onConfirm);
        const confirmOverlay = document.querySelectorAll('.confirm-modal-overlay')[0];
        expect(confirmOverlay).toBeTruthy();
        confirmOverlay.querySelector('.confirm-yes').click();
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('7. helpers-pwa-browser.js handles Save-Data listener, Badging, Popover API, Clipboard/Share & View Transitions', async () => {
        const listeners = {};
        const mockConn = {
            saveData: true,
            effectiveType: '4g',
            addEventListener: (ev, cb) => { listeners[ev] = cb; }
        };
        const setAppBadge = vi.fn().mockResolvedValue(undefined);
        const clearAppBadge = vi.fn().mockResolvedValue(undefined);
        const shareMock = vi.fn().mockRejectedValue(Object.assign(new Error('canceled'), { name: 'AbortError' }));
        const writeTextMock = vi.fn().mockResolvedValue(undefined);

        Object.defineProperty(globalThis, 'navigator', {
            value: {
                connection: mockConn,
                setAppBadge,
                clearAppBadge,
                share: shareMock,
                clipboard: { writeText: writeTextMock }
            },
            configurable: true
        });

        pwaBrowser.initNetworkAwareRendering();
        expect(document.documentElement.classList.contains('save-data-active')).toBe(true);
        expect(document.documentElement.getAttribute('data-save-data')).toBe('true');

        mockConn.saveData = false;
        listeners.change();
        expect(document.documentElement.classList.contains('save-data-active')).toBe(false);
        expect(document.documentElement.hasAttribute('data-save-data')).toBe(false);

        window.cart = [{ id: 1 }, { id: 2 }];
        expect(pwaBrowser.isAppBadgingSupported()).toBe(true);
        expect(await pwaBrowser.updateAppBadge()).toBe(true);
        expect(setAppBadge).toHaveBeenCalledWith(2);
        expect(await pwaBrowser.updateAppBadge(0)).toBe(true);
        expect(clearAppBadge).toHaveBeenCalled();

        let popoverOpen = false;
        const popEl = {
            hasAttribute: (a) => a === 'popover',
            matches: () => popoverOpen,
            showPopover: vi.fn(() => { popoverOpen = true; }),
            hidePopover: vi.fn(() => { popoverOpen = false; }),
            togglePopover: vi.fn((force) => {
                popoverOpen = typeof force === 'boolean' ? force : !popoverOpen;
                return popoverOpen;
            })
        };
        expect(pwaBrowser.showPopoverSafe(popEl)).toBe(true);
        expect(pwaBrowser.isPopoverOpenSafe(popEl)).toBe(true);
        expect(pwaBrowser.togglePopoverSafe(popEl, false)).toBe(false);
        expect(pwaBrowser.showPopoverSafe(popEl)).toBe(true);
        expect(pwaBrowser.hidePopoverSafe(popEl)).toBe(true);

        expect(await pwaBrowser.shareContent({ title: 'Test', url: 'https://nisha-store.shop' })).toBe(false);

        shareMock.mockRejectedValueOnce(new Error('NotAllowedError'));
        expect(await pwaBrowser.shareContent({ url: 'https://nisha-store.shop/item/1' })).toBe(true);
        expect(writeTextMock).toHaveBeenCalledWith('https://nisha-store.shop/item/1');

        vi.spyOn(console, 'error').mockImplementation(() => {});
        const badRes = pwaBrowser.safeViewTransition(() => { throw new Error('render_fail'); });
        await expect(badRes.finished).rejects.toThrow('render_fail');
        await expect(badRes.updateCallbackDone).rejects.toThrow('render_fail');
    });

    it('8. helpers-delegation.js enforces click shields, dispatches data-action & handles media retries safely', () => {
        window.openProductModalById = vi.fn();
        window.submitOrder = vi.fn();

        const openModal = document.createElement('div');
        openModal.className = 'modal-overlay';
        openModal.style.display = 'flex';
        const outsideBtn = document.createElement('button');
        outsideBtn.setAttribute('data-action', 'open-product');
        outsideBtn.setAttribute('data-id', 'item-7');
        document.body.appendChild(openModal);
        document.body.appendChild(outsideBtn);

        const blockedEvt = {
            target: outsideBtn,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            stopImmediatePropagation: vi.fn()
        };
        delegation.handleDelegatedAction(blockedEvt);
        expect(blockedEvt.preventDefault).toHaveBeenCalled();
        expect(blockedEvt.stopPropagation).toHaveBeenCalled();
        expect(window.openProductModalById).not.toHaveBeenCalled();

        openModal.remove();
        outsideBtn.remove();

        const link = document.createElement('a');
        link.setAttribute('data-action', 'submit-order');
        document.body.appendChild(link);
        const linkEvt = { target: link, preventDefault: vi.fn() };
        delegation.handleDelegatedAction(linkEvt);
        expect(linkEvt.preventDefault).toHaveBeenCalled();
        expect(window.submitOrder).toHaveBeenCalledTimes(1);
        link.remove();

        const badImg = document.createElement('img');
        badImg.className = 'card-slide-img';
        badImg.dataset.fallbackSrc = 'javascript:alert(1)';
        const wrap1 = document.createElement('div');
        wrap1.className = 'img-8bit-loading';
        wrap1.appendChild(badImg);
        delegation.handleDelegatedMediaError({ target: badImg });
        expect(badImg.outerHTML).toContain('NO SIGNAL');

        const goodImg = document.createElement('img');
        goodImg.className = 'card-slide-img';
        goodImg.src = 'https://cdn.nisha-store.shop/broken.webp';
        goodImg.dataset.fallbackSrc = 'https://nmpuefxqtkhvtltdvllz.supabase.co/storage/v1/object/public/fallback.jpg';
        delegation.handleDelegatedMediaError({ target: goodImg });
        expect(goodImg.dataset.fb).toBe('1');
        expect(goodImg.src).toContain('fallback.jpg');
    });
});
