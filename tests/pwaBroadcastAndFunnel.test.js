import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function createMemoryStorage() {
    const map = new Map();
    return {
        get: (k) => (map.has(k) ? map.get(k) : null),
        set: (k, v) => map.set(k, String(v)),
        remove: (k) => map.delete(k)
    };
}

describe('Post-Order PWA Broadcast & Analytics Funnel', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function setupDomEnv({ standalone = false, iosStandalone = false, relatedApps = [], userAgent = 'Mozilla/5.0' } = {}) {
        const listeners = new Map();
        const appended = [];
        const store = createMemoryStorage();
        const installBtn = { style: { display: 'none' }, addEventListener: vi.fn() };

        const fakeDoc = {
            hidden: false,
            referrer: '',
            title: '',
            addEventListener: vi.fn(),
            getElementById: (id) => (id === 'installAppBtn' ? installBtn : null),
            querySelectorAll: () => [],
            createElement: () => ({
                className: '',
                style: { cssText: '' },
                innerHTML: '',
                remove: vi.fn(),
                querySelector: () => ({ addEventListener: vi.fn() }),
                addEventListener: vi.fn()
            }),
            body: {
                appendChild: (node) => appended.push(node)
            }
        };

        const fakeNav = {
            userAgent,
            standalone: iosStandalone,
            getInstalledRelatedApps: vi.fn(async () => relatedApps)
        };

        const fakeWin = {
            storage: store,
            navigator: fakeNav,
            matchMedia: (q) => ({ matches: standalone && q.includes('standalone') }),
            addEventListener: (ev, cb) => {
                if (!listeners.has(ev)) listeners.set(ev, []);
                listeners.get(ev).push(cb);
            },
            dispatch: (ev, payload) => {
                (listeners.get(ev) || []).forEach((cb) => cb(payload));
            }
        };

        vi.stubGlobal('window', fakeWin);
        vi.stubGlobal('document', fakeDoc);
        vi.stubGlobal('navigator', fakeNav);

        return { fakeWin, fakeDoc, fakeNav, store, appended, installBtn };
    }

    it('detects installed PWA via standalone display-mode, iOS standalone, and storage flag', async () => {
        const env1 = setupDomEnv({ standalone: true });
        const mod1 = await import('../js/core/pwa-lifecycle.js');
        expect(mod1.isPwaAlreadyInstalled()).toBe(true);

        vi.resetModules();
        setupDomEnv({ iosStandalone: true });
        const mod2 = await import('../js/core/pwa-lifecycle.js');
        expect(mod2.isPwaAlreadyInstalled()).toBe(true);

        vi.resetModules();
        const env3 = setupDomEnv();
        env3.store.set('nisha_pwa_installed', '1');
        const mod3 = await import('../js/core/pwa-lifecycle.js');
        expect(mod3.isPwaAlreadyInstalled()).toBe(true);
        expect(env1).toBeTruthy();
    });

    it('never shows post-order PWA broadcast when PWA is already installed (standalone or related apps)', async () => {
        const env = setupDomEnv({ relatedApps: [{ id: 'nisha-store' }] });
        const mod = await import('../js/core/pwa-lifecycle.js');
        mod.initPwaLifecycle();

        env.fakeWin.dispatch('beforeinstallprompt', { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) });
        const shown = await mod.maybeShowPostOrderPwaBroadcast();

        expect(shown).toBe(false);
        expect(env.appended.length).toBe(0);
    });

    it('shows broadcast-styled PWA modal after order when not installed and prompt is available', async () => {
        const env = setupDomEnv();
        const mod = await import('../js/core/pwa-lifecycle.js');
        mod.initPwaLifecycle();

        env.fakeWin.dispatch('beforeinstallprompt', { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) });
        const shown = await mod.maybeShowPostOrderPwaBroadcast();

        expect(shown).toBe(true);
        expect(env.appended.length).toBe(1);
        expect(env.appended[0].className).toContain('pwa-broadcast-overlay');

        // Respects cooldown once dismissed
        env.store.set('nisha_pwa_broadcast_dismissed_at', String(Date.now()));
        const shownAgain = await mod.maybeShowPostOrderPwaBroadcast();
        expect(shownAgain).toBe(false);
    });

    it('tracks Delivery Selected and Checkout Attempt funnel events', async () => {
        const plausibleSpy = vi.fn();
        vi.stubGlobal('window', {
            plausible: plausibleSpy,
            location: { hostname: 'www.nisha-store.shop' }
        });
        vi.stubGlobal('document', {
            addEventListener: vi.fn(),
            querySelector: () => null
        });

        await import('../js/core/analytics.js');
        globalThis.window.analytics.trackDeliverySelected({ city: 'Київ', branch: 'Відділення №1', branchRef: 'ref-1' });
        globalThis.window.analytics.trackCheckoutAttempt({ stage: 'validation_failed', reason: 'missing_branch', itemsCount: 2 });

        expect(plausibleSpy).toHaveBeenCalledWith('Delivery Selected', {
            props: { city: 'Київ', branch: 'Відділення №1', branch_ref: 'ref-1' }
        });
        expect(plausibleSpy).toHaveBeenCalledWith('Checkout Attempt', {
            props: { stage: 'validation_failed', reason: 'missing_branch', items_count: 2 }
        });
    });
});
