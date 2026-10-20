import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';

// Модуль — обычный браузерный скрипт (IIFE): подставляем минимальное окружение браузера
function setupBrowserEnv({ hostname = 'localhost', withGoogle = true, sbMock } = {}) {
    const g = globalThis;
    g.window = g;
    g.location = { hostname };
    g.document = {
        readyState: 'complete',
        querySelectorAll: () => [],
        getElementById: () => null,
        createElement: () => ({ style: {}, remove() {}, appendChild() {} }),
        head: { appendChild() {} }
    };
    g.showToast = vi.fn();
    g.checkSession = vi.fn().mockResolvedValue();
    g.closeModal = vi.fn();
    g.getSupabase = () => sbMock;
    g.alert = vi.fn();
    if (withGoogle) {
        g.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn(), prompt: vi.fn() } } };
    } else {
        delete g.google;
    }
}

async function loadModule() {
    vi.resetModules();
    await import('../js/auth/google-signin.js');
    return globalThis.NishaGoogleAuth;
}

describe('Google Sign-In (GIS ID Token)', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
        vi.useRealTimers();
        delete globalThis.NishaGoogleAuth;
        delete globalThis.loginWithGoogle;
    });

    it('initializes GIS with the correct client id and a hashed nonce, then signs into Supabase with the RAW nonce', async () => {
        const sb = { auth: { signInWithIdToken: vi.fn().mockResolvedValue({ error: null }), signInWithOAuth: vi.fn() } };
        setupBrowserEnv({ sbMock: sb });
        const api = await loadModule();

        expect(await api.ensureReady()).toBe(true);
        const cfg = globalThis.google.accounts.id.initialize.mock.calls[0][0];
        expect(cfg.client_id).toBe('150814094251-mjd3ol7383v54h7preolcnb19lbujhd8.apps.googleusercontent.com');
        expect(cfg.nonce).toMatch(/^[0-9a-f]{64}$/);

        await api.handleCredential({ credential: 'google.id.token' });

        expect(sb.auth.signInWithIdToken).toHaveBeenCalledTimes(1);
        const payload = sb.auth.signInWithIdToken.mock.calls[0][0];
        expect(payload.provider).toBe('google');
        expect(payload.token).toBe('google.id.token');
        // Google получает sha256(raw) в hex, Supabase — исходную строку
        expect(createHash('sha256').update(payload.nonce).digest('hex')).toBe(cfg.nonce);
        expect(globalThis.checkSession).toHaveBeenCalledTimes(1);
        expect(globalThis.showToast).toHaveBeenCalledWith(expect.any(String), 'success');
    });

    it('shows an error toast and does not refresh the session when Supabase rejects the token', async () => {
        const sb = { auth: { signInWithIdToken: vi.fn().mockResolvedValue({ error: { message: 'Unacceptable audience' } }), signInWithOAuth: vi.fn() } };
        setupBrowserEnv({ sbMock: sb });
        const api = await loadModule();
        await api.ensureReady();

        await api.handleCredential({ credential: 'bad.token' });

        expect(globalThis.checkSession).not.toHaveBeenCalled();
        expect(globalThis.showToast).toHaveBeenCalledWith(expect.stringContaining('Unacceptable audience'), 'error');
    });

    it('ignores empty credentials and prevents double sign-in', async () => {
        let resolveSignIn;
        const sb = { auth: { signInWithIdToken: vi.fn(() => new Promise(r => { resolveSignIn = r; })), signInWithOAuth: vi.fn() } };
        setupBrowserEnv({ sbMock: sb });
        const api = await loadModule();
        await api.ensureReady();

        await api.handleCredential({});
        await api.handleCredential(null);
        expect(sb.auth.signInWithIdToken).not.toHaveBeenCalled();

        const first = api.handleCredential({ credential: 't1' });
        await api.handleCredential({ credential: 't2' }); // игнорируется, пока идет первый вход
        resolveSignIn({ error: null });
        await first;
        expect(sb.auth.signInWithIdToken).toHaveBeenCalledTimes(1);
    });

    it('falls back to the old OAuth redirect when GIS is unavailable (adblock / offline)', async () => {
        const sb = { auth: { signInWithIdToken: vi.fn(), signInWithOAuth: vi.fn().mockResolvedValue({ error: null }) } };
        setupBrowserEnv({ sbMock: sb, withGoogle: false });
        await loadModule();

        await globalThis.loginWithGoogle();

        expect(sb.auth.signInWithOAuth).toHaveBeenCalledTimes(1);
        const arg = sb.auth.signInWithOAuth.mock.calls[0][0];
        expect(arg.provider).toBe('google');
        expect(arg.options.redirectTo).toBe('https://www.nisha-store.shop');
    });

    it('blocks Google login inside Instagram/TikTok in-app browsers with a hint', async () => {
        const sb = { auth: { signInWithIdToken: vi.fn(), signInWithOAuth: vi.fn() } };
        setupBrowserEnv({ sbMock: sb });
        const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
        Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 Instagram 300.0' }, configurable: true });
        try {
            await loadModule();
            await globalThis.loginWithGoogle();
            expect(globalThis.alert).toHaveBeenCalled();
            expect(sb.auth.signInWithOAuth).not.toHaveBeenCalled();
        } finally {
            if (original) Object.defineProperty(globalThis, 'navigator', original);
            else delete globalThis.navigator;
        }
    });
});
