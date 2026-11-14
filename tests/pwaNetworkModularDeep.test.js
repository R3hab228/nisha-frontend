import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createClassList(initial = []) {
    const set = new Set(initial);
    return {
        add: (...names) => names.forEach(n => n && set.add(n)),
        remove: (...names) => names.forEach(n => n && set.delete(n)),
        contains: (name) => set.has(name),
        toggle: (name, force) => {
            const next = typeof force === 'boolean' ? force : !set.has(name);
            if (next) set.add(name);
            else set.delete(name);
            return next;
        }
    };
}

function createFakeEl(id = '', tag = 'div') {
    const listeners = new Map();
    const attrs = new Map();
    const styleMap = new Map();
    const el = {
        id,
        tagName: tag.toUpperCase(),
        innerText: '',
        textContent: '',
        _innerHTML: '',
        children: [],
        scrollHeight: 100,
        clientHeight: 100,
        parentElement: null,
        classList: createClassList(),
        style: {
            cssText: '',
            set display(v) { styleMap.set('display', v); },
            get display() { return styleMap.get('display') || ''; },
            set color(v) { styleMap.set('color', v); },
            get color() { return styleMap.get('color') || ''; },
            set transition(v) { styleMap.set('transition', v); },
            get transition() { return styleMap.get('transition') || ''; },
            set transform(v) { styleMap.set('transform', v); },
            get transform() { return styleMap.get('transform') || ''; },
            set opacity(v) { styleMap.set('opacity', String(v)); },
            get opacity() { return styleMap.get('opacity') || ''; }
        },
        set innerHTML(v) { el._innerHTML = String(v); },
        get innerHTML() { return el._innerHTML; },
        setAttribute: (k, v) => attrs.set(k, String(v)),
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        hasAttribute: (k) => attrs.has(k),
        addEventListener: (ev, fn) => {
            if (!listeners.has(ev)) listeners.set(ev, []);
            listeners.get(ev).push(fn);
        },
        dispatchEvent: async (ev) => {
            for (const fn of (listeners.get(ev.type || ev) || [])) {
                await fn(ev);
            }
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        before: vi.fn(),
        closest: () => null
    };
    return el;
}

describe('Modular PWA, Telemetry, Lifecycle, Push & Pull-to-Refresh Deep Suite (js/core/pwa-*.js)', () => {
    let elements;
    let storeMap;
    let sessionMap;
    let winListeners;
    let docListeners;
    let origWin;
    let origDoc;
    let origNav;
    let origNotif;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();

        origWin = globalThis.window;
        origDoc = globalThis.document;
        origNav = globalThis.navigator;
        origNotif = globalThis.Notification;

        elements = new Map();
        const getEl = (id) => {
            if (!elements.has(id)) elements.set(id, createFakeEl(id));
            return elements.get(id);
        };

        storeMap = new Map();
        sessionMap = new Map();
        winListeners = new Map();
        docListeners = new Map();

        globalThis.document = {
            readyState: 'complete',
            hidden: false,
            title: 'NISHA | Underground Store',
            referrer: '',
            cookie: '',
            activeElement: null,
            documentElement: { classList: createClassList(), scrollTop: 0 },
            body: {
                classList: createClassList(),
                scrollTop: 0,
                prepend: vi.fn(),
                appendChild: vi.fn()
            },
            getElementById: (id) => (elements.has(id) ? elements.get(id) : null),
            querySelector: vi.fn(() => null),
            querySelectorAll: vi.fn(() => []),
            createElement: (tag) => {
                const created = createFakeEl('', tag);
                created.querySelector = (sel) => {
                    if (sel === '.pwa-pull-arrow') return getEl('__pullArrow');
                    if (sel === '.pwa-pull-text') return getEl('pwaPullLabel');
                    if (sel === '#win95-error-msg') return getEl('win95-error-msg');
                    return null;
                };
                return created;
            },
            addEventListener: (ev, fn) => {
                if (!docListeners.has(ev)) docListeners.set(ev, []);
                docListeners.get(ev).push(fn);
            }
        };

        globalThis.window = globalThis;
        globalThis.addEventListener = (ev, fn) => {
            if (!winListeners.has(ev)) winListeners.set(ev, []);
            winListeners.get(ev).push(fn);
        };
        globalThis.location = {
            hostname: 'www.nisha-store.shop',
            origin: 'https://www.nisha-store.shop',
            pathname: '/catalog',
            search: '?sort=new',
            hash: '',
            href: 'https://www.nisha-store.shop/catalog',
            reload: vi.fn()
        };
        globalThis.scrollY = 0;
        globalThis.scrollTo = vi.fn();
        globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
        globalThis.matchMedia = vi.fn(() => ({ matches: false }));
        globalThis.storage = {
            get: (k, fb = null) => (storeMap.has(k) ? storeMap.get(k) : fb),
            set: (k, v) => storeMap.set(k, String(v)),
            session: {
                get: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null),
                set: (k, v) => sessionMap.set(k, String(v))
            }
        };
        globalThis.store = {
            get: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
            set: (k, v) => storeMap.set(k, v)
        };
        globalThis.apiClient = {
            post: vi.fn(async () => ({ ok: true })),
            get: vi.fn(async () => ({ publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8' }))
        };

        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0',
                standalone: false,
                vibrate: vi.fn()
            }
        });

        delete globalThis._sentryActive;
        delete globalThis.Sentry;
        delete globalThis.loadExternalScript;
        delete globalThis.checkSession;
        delete globalThis.loadAllItems;
        delete globalThis.updateCartUI;
        delete globalThis.triggerHaptic;
        delete globalThis.clearSavedFeedScrollState;
        delete globalThis.Notification;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        globalThis.window = origWin;
        globalThis.document = origDoc;
        if (origNav) {
            Object.defineProperty(globalThis, 'navigator', { configurable: true, value: origNav });
        }
        globalThis.Notification = origNotif;
    });

    it('1. maintains an acyclic ES module DAG and exports unified API via pwa-network.js barrel', async () => {
        const files = [
            'pwa-network.js',
            'pwa-sw-versioning.js',
            'pwa-telemetry.js',
            'pwa-lifecycle.js',
            'pwa-push.js',
            'pwa-pull-refresh.js'
        ];
        const graph = new Map();
        for (const f of files) {
            const code = readFileSync(resolve(ROOT_DIR, 'js/core', f), 'utf8');
            const deps = [];
            const re = /(?:import|export\s+\*)\s+(?:[\s\S]*?\s+from\s+)?['"]\.\/([^'"]+)['"]/g;
            let m;
            while ((m = re.exec(code)) !== null) deps.push(m[1]);
            graph.set(f, deps);
        }

        const visiting = new Set();
        const visited = new Set();
        const dfs = (node) => {
            expect(visiting.has(node)).toBe(false);
            if (visited.has(node)) return;
            visiting.add(node);
            for (const dep of graph.get(node) || []) dfs(dep);
            visiting.delete(node);
            visited.add(node);
        };
        files.forEach(dfs);

        const mod = await import('../js/core/pwa-network.js');
        [
            'APP_BUILD_ID', 'APP_SW_VERSION', 'SW_SCRIPT_URL', 'queryServiceWorkerVersion',
            'evaluateClientErrorSeverity', 'sendTelegramErrorAlert', 'captureError', 'sanitizeContext',
            'isIgnoredError', 'initSentryDeferred', 'handleNetworkOffline', 'handleNetworkOnline',
            'dismissNetError', 'isPwaStandalone', 'checkIsPwaInstalled', 'syncNotificationPermission',
            'subscribeUserToPush', 'initPwaPullToRefresh', 'initPwaNetworkModule'
        ].forEach(sym => expect(mod[sym]).toBeDefined());

        expect(typeof globalThis.captureError).toBe('function');
        expect(typeof globalThis.handleNetworkOffline).toBe('function');
        expect(typeof globalThis.subscribeUserToPush).toBe('function');
        expect(typeof globalThis.initPwaPullToRefresh).toBe('function');
    });

    it('2. pwa-sw-versioning.js resolves worker version via MessageChannel and handles unresponsive timeout', async () => {
        const { queryServiceWorkerVersion, APP_SW_VERSION, SW_SCRIPT_URL } = await import('../js/core/pwa-sw-versioning.js');

        expect(APP_SW_VERSION).toMatch(/^nisha-cache-/);
        expect(SW_SCRIPT_URL).toContain('/sw.js?b=');

        // Silent/unresponsive worker times out cleanly after 1200ms -> null
        const silentWorker = { postMessage: vi.fn() };
        const timeoutPromise = queryServiceWorkerVersion(silentWorker);
        await vi.advanceTimersByTimeAsync(1250);
        expect(await timeoutPromise).toBeNull();

        // Responsive worker replies via port2
        const liveWorker = {
            postMessage: vi.fn((_msg, ports) => {
                ports[0].postMessage({ version: 'nisha-cache-build-999' });
            })
        };
        expect(await queryServiceWorkerVersion(liveWorker)).toBe('nisha-cache-build-999');
    });

    it('3. pwa-telemetry.js sanitizes secrets, scores severity, deduplicates alerts & falls back Sentry CDN', async () => {
        const telemetry = await import('../js/core/pwa-telemetry.js');
        telemetry.resetTelemetryTestState();
        telemetry.initTelemetry();

        // Redaction
        const sanitized = telemetry.sanitizeContext({ password: '123', nested: { authToken: 'xyz', step: 2 } });
        expect(sanitized.password).toBe('[REDACTED]');
        expect(sanitized.nested.authToken).toBe('[REDACTED]');
        expect(sanitized.nested.step).toBe(2);

        // Severity rules
        expect(telemetry.evaluateClientErrorSeverity({ message: 'submit_order failed' }).score).toBe(10);
        expect(telemetry.evaluateClientErrorSeverity({ message: 'handle_auth crashed' }).score).toBe(8);
        expect(telemetry.evaluateClientErrorSeverity({ message: 'Failed to fetch' }).score).toBe(3);

        // Deduplication + max 5 alerts per session
        for (let i = 0; i < 7; i++) {
            telemetry.sendTelegramErrorAlert(new Error(`Unique crash #${i}`), { token: 'secret-tok', filename: 'https://www.nisha-store.shop/assets/app.js' });
            telemetry.sendTelegramErrorAlert(new Error(`Unique crash #${i}`), { token: 'secret-tok', filename: 'https://www.nisha-store.shop/assets/app.js' });
        }
        expect(globalThis.apiClient.post).toHaveBeenCalledTimes(5);
        expect(globalThis.apiClient.post.mock.calls[0][1].message).toContain('[NISHA CLIENT ERROR ALERT]');

        // Deferred Sentry loads jsDelivr fallback when primary CDN fails
        globalThis.Sentry = { init: vi.fn(), captureException: vi.fn(), captureMessage: vi.fn() };
        const origSentry = globalThis.Sentry;
        delete globalThis.Sentry;
        globalThis.loadExternalScript = vi.fn()
            .mockRejectedValueOnce(new Error('adblock blocked sentry-cdn'))
            .mockImplementationOnce(async () => { globalThis.Sentry = origSentry; });

        telemetry.recordEarlySentryError({ error: new Error('Early boot boom'), filename: 'app.js' });
        await vi.advanceTimersByTimeAsync(20);

        expect(globalThis.loadExternalScript).toHaveBeenNthCalledWith(1, 'https://browser.sentry-cdn.com/8.38.0/bundle.min.js');
        expect(globalThis.loadExternalScript).toHaveBeenNthCalledWith(2, 'https://cdn.jsdelivr.net/npm/@sentry/browser@8.38.0/bundle.min.js');
        expect(origSentry.init).toHaveBeenCalledTimes(1);
        expect(origSentry.captureException).toHaveBeenCalledTimes(1);
    });

    it('4. pwa-lifecycle.js handles bfcache pageshow/pagehide, visibilitychange, Win95 offline/online & battery mode', async () => {
        const gridEl = createFakeEl('itemsGrid');
        gridEl.querySelectorAll = () => [];
        gridEl.parentElement = { id: 'main' };
        elements.set('itemsGrid', gridEl);
        const spinnerEl = createFakeEl('loadingSpinner');
        spinnerEl.style.display = 'flex';
        elements.set('loadingSpinner', spinnerEl);

        let netErrorCreated = null;
        gridEl.before = vi.fn((node) => {
            netErrorCreated = node;
            elements.set(node.id, node);
        });

        let batteryRef;
        const batteryListeners = {};
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                userAgent: 'Chrome',
                getBattery: vi.fn(async () => {
                    batteryRef = {
                        charging: false,
                        level: 0.15,
                        addEventListener: (ev, cb) => { batteryListeners[ev] = cb; }
                    };
                    return batteryRef;
                })
            }
        });

        globalThis.updateCartUI = vi.fn();
        globalThis.initCatalogRealtimeSubscription = vi.fn();
        globalThis.syncCriticalStatuses = vi.fn();
        globalThis.loadAllItems = vi.fn();
        globalThis.checkSession = vi.fn();
        globalThis._supabase = {};

        const lifecycle = await import('../js/core/pwa-lifecycle.js');
        lifecycle.initPwaLifecycle();
        await vi.advanceTimersByTimeAsync(10);

        // Battery low-power-mode toggled
        expect(document.documentElement.classList.contains('low-power-mode')).toBe(true);
        batteryRef.charging = true;
        batteryListeners.chargingchange();
        expect(document.documentElement.classList.contains('low-power-mode')).toBe(false);

        // BFCache pageshow restores counters & syncs realtime
        for (const fn of (winListeners.get('pageshow') || [])) {
            await fn({ persisted: true });
        }
        expect(spinnerEl.style.display).toBe('none');
        expect(globalThis.updateCartUI).toHaveBeenCalled();
        expect(globalThis.initCatalogRealtimeSubscription).toHaveBeenCalled();
        expect(globalThis.syncCriticalStatuses).toHaveBeenCalled();

        // Visibility change toggles Zzz title and restores item title
        globalThis.document.hidden = true;
        for (const fn of (docListeners.get('visibilitychange') || [])) await fn();
        expect(document.title).toBe('Zzz... | NISHA');

        globalThis.document.hidden = false;
        globalThis.currentOpenedItem = { brand: 'STONE ISLAND', name: 'Overshirt' };
        for (const fn of (docListeners.get('visibilitychange') || [])) await fn();
        expect(document.title).toBe('NISHA | STONE ISLAND - Overshirt');

        // Offline shows Win95 Error_NISHA.exe, Online restores grid
        lifecycle.handleNetworkOffline();
        await vi.advanceTimersByTimeAsync(300);
        expect(netErrorCreated).not.toBeNull();
        expect(netErrorCreated.style.display).toBe('flex');
        expect(gridEl.style.display).toBe('none');

        lifecycle.handleNetworkOnline();
        await vi.advanceTimersByTimeAsync(1200);
        expect(netErrorCreated.style.display).toBe('none');
        expect(gridEl.style.display).toBe('');
        expect(globalThis.loadAllItems).toHaveBeenCalled();
    });

    it('5. pwa-push.js enforces browser-vs-PWA deduplication, vercel unsubscribe & standalone push subscription', async () => {
        const push = await import('../js/core/pwa-push.js');
        push.resetPushPromptTestState();

        globalThis.Notification = {
            permission: 'granted',
            requestPermission: vi.fn(async () => 'granted')
        };

        // Case A: regular browser when PWA is already installed -> unsubscribes browser
        const mockUnsub = vi.fn(async () => true);
        const existingSub = { endpoint: 'https://push.example/old-browser-sub', unsubscribe: mockUnsub };
        const regBrowser = {
            pushManager: {
                getSubscription: vi.fn(async () => existingSub),
                subscribe: vi.fn()
            }
        };
        storeMap.set('isPwaInstalled', true);
        await push.subscribeUserToPush(regBrowser, false);
        expect(globalThis.apiClient.post).toHaveBeenCalledWith('/api/unsubscribe', { endpoint: existingSub.endpoint });
        expect(mockUnsub).toHaveBeenCalled();
        expect(regBrowser.pushManager.subscribe).not.toHaveBeenCalled();

        // Case B: standalone PWA -> marks installed and subscribes with clientType 'pwa'
        globalThis.apiClient.post.mockClear();
        globalThis.matchMedia = vi.fn((q) => ({ matches: q === '(display-mode: standalone)' }));
        const newSub = { endpoint: 'https://push.example/pwa-sub' };
        const regPwa = {
            pushManager: {
                getSubscription: vi.fn(async () => null),
                subscribe: vi.fn(async () => newSub)
            }
        };
        await push.subscribeUserToPush(regPwa, false);
        expect(document.documentElement.classList.contains('pwa-standalone')).toBe(true);
        expect(globalThis.apiClient.get).toHaveBeenCalledWith('/api/vapid-key', expect.any(Object));
        expect(globalThis.apiClient.post).toHaveBeenCalledWith('/api/subscribe', expect.objectContaining({
            subscription: newSub,
            clientType: 'pwa',
            isPwa: true
        }), expect.any(Object));
    });

    it('6. pwa-pull-refresh.js initializes standalone capsule, filters scrollable targets & triggers feed refresh', async () => {
        const { initPwaPullToRefresh } = await import('../js/core/pwa-pull-refresh.js');

        globalThis.isPwaStandalone = () => true;
        globalThis.clearSavedFeedScrollState = vi.fn();
        globalThis.loadAllItems = vi.fn(async () => {});
        globalThis.triggerHaptic = vi.fn();

        initPwaPullToRefresh();
        expect(document.body.prepend).toHaveBeenCalled();
        expect(globalThis.__pwaPullRefresh).toBeDefined();

        expect(globalThis.__pwaPullRefresh.isEligibleForPull()).toBe(true);
        expect(globalThis.__pwaPullRefresh.isRestrictedOrScrollableTarget({
            closest: (sel) => sel.includes('input')
        })).toBe(true);

        const refreshPromise = globalThis.__pwaPullRefresh.triggerRefresh();
        await vi.advanceTimersByTimeAsync(600);
        await refreshPromise;

        expect(globalThis.clearSavedFeedScrollState).toHaveBeenCalled();
        expect(globalThis.loadAllItems).toHaveBeenCalled();
        expect(globalThis.triggerHaptic).toHaveBeenCalledWith('success');
    });
});
