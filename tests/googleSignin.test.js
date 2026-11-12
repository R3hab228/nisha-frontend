import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Google OAuth & Authentication Recovery (Supabase)', () => {
    let mockSupabase;
    let mockToast;
    let mockAlert;
    let mockCheckSession;

    beforeEach(async () => {
        mockToast = vi.fn();
        mockAlert = vi.fn();
        mockCheckSession = vi.fn().mockResolvedValue();

        mockSupabase = {
            auth: {
                signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: 'https://placeholder.supabase.co/auth/v1/authorize' }, error: null }),
                signInWithPassword: vi.fn(),
                signUp: vi.fn(),
                signOut: vi.fn().mockResolvedValue({ error: null }),
                resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
                onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
                getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
            },
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({ data: [], error: null })
                    })
                })
            })
        };

        globalThis.window = globalThis;
        globalThis.location = { origin: 'https://www.nisha-store.shop' };
        globalThis.getSupabase = () => mockSupabase;
        globalThis.showToast = mockToast;
        globalThis.alert = mockAlert;
        globalThis.checkSession = mockCheckSession;
        globalThis.closeModal = vi.fn();
        globalThis.document = {
            readyState: 'complete',
            getElementById: vi.fn().mockReturnValue(null),
            querySelectorAll: vi.fn().mockReturnValue([]),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            body: { style: {} }
        };
        globalThis.addEventListener = vi.fn();
        globalThis.removeEventListener = vi.fn();

        vi.resetModules();
        await import('../js/profile/profile.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loginWithGoogle triggers Supabase signInWithOAuth with provider=google and select_account query param', async () => {
        expect(typeof globalThis.loginWithGoogle).toBe('function');
        await globalThis.loginWithGoogle();

        expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledTimes(1);
        const callArgs = mockSupabase.auth.signInWithOAuth.mock.calls[0][0];
        expect(callArgs.provider).toBe('google');
        expect(callArgs.options.redirectTo).toBe('https://www.nisha-store.shop');
        expect(callArgs.options.queryParams.prompt).toBe('select_account');
        expect(callArgs.options.queryParams.access_type).toBe('offline');
    });

    it('loginWithGoogle warns in-app browsers (Instagram, TikTok) before OAuth', async () => {
        if (!globalThis.navigator) globalThis.navigator = {};
        Object.defineProperty(globalThis.navigator, 'userAgent', {
            value: 'Mozilla/5.0 Instagram 123.0.0 Android',
            configurable: true
        });

        await globalThis.loginWithGoogle();
        expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('Safari или Chrome'));
        expect(mockSupabase.auth.signInWithOAuth).not.toHaveBeenCalled();
    });

    it('handleAuth translates "Invalid login credentials" to helpful localized text pointing to Google login', async () => {
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
            data: null,
            error: { message: 'Invalid login credentials' }
        });

        globalThis.document.getElementById = vi.fn((id) => {
            if (id === 'authEmail') return { value: 'neos11221@gmail.com' };
            if (id === 'authPass') return { value: 'secretpass' };
            return null;
        });

        await globalThis.handleAuth('login', false);

        expect(mockToast).toHaveBeenCalledTimes(1);
        const toastMsg = mockToast.mock.calls[0][0];
        expect(toastMsg).toContain('Неверный email или пароль');
        expect(toastMsg).toContain('GOOGLE ID');
        expect(mockToast.mock.calls[0][1]).toBe('error');
    });

    it('sidebar.forgot_password and sidebar.google_id are translated across RU, UA, and EN dictionaries', () => {
        const ru = JSON.parse(readFileSync(resolve(process.cwd(), 'locales/ru.json'), 'utf8'));
        const ua = JSON.parse(readFileSync(resolve(process.cwd(), 'locales/ua.json'), 'utf8'));
        const en = JSON.parse(readFileSync(resolve(process.cwd(), 'locales/en.json'), 'utf8'));

        const ruSidebar = (ru.translation || ru).sidebar;
        const uaSidebar = (ua.translation || ua).sidebar;
        const enSidebar = (en.translation || en).sidebar;

        expect(ruSidebar.forgot_password).toBe('Забыли пароль?');
        expect(uaSidebar.forgot_password).toBe('Забули пароль?');
        expect(enSidebar.forgot_password).toBe('Forgot password?');

        expect(ruSidebar.google_id).toBe('GOOGLE ID');
        expect(uaSidebar.google_id).toBe('GOOGLE ID');
        expect(enSidebar.google_id).toBe('GOOGLE ID');

        expect(ruSidebar.google_login).toBe('ВОЙТИ ЧЕРЕЗ GOOGLE');
        expect(uaSidebar.google_login).toBe('УВІЙТИ ЧЕРЕЗ GOOGLE');
        expect(enSidebar.google_login).toBe('SIGN IN WITH GOOGLE');
    });

    it('handleForgotPassword triggers resetPasswordForEmail with origin redirect', async () => {
        globalThis.document.getElementById = vi.fn((id) => {
            if (id === 'authEmail') return { value: 'user@example.com' };
            return null;
        });

        await globalThis.handleForgotPassword(false);

        expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
            'user@example.com',
            expect.objectContaining({ redirectTo: 'https://www.nisha-store.shop' })
        );
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('Письмо для сброса пароля отправлено'), 'success');
    });

    it('handleForgotPassword exits cleanly without toast when prompt is cancelled', async () => {
        globalThis.document.getElementById = vi.fn().mockReturnValue(null);
        globalThis.prompt = vi.fn().mockReturnValue(null);

        await globalThis.handleForgotPassword(false);

        expect(globalThis.prompt).toHaveBeenCalledTimes(1);
        expect(mockSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
        expect(mockToast).not.toHaveBeenCalled();
    });

    it('handleForgotPassword validates email format before calling Supabase', async () => {
        globalThis.document.getElementById = vi.fn((id) => {
            if (id === 'authEmail') return { value: 'not-an-email' };
            return null;
        });

        await globalThis.handleForgotPassword(false);

        expect(mockSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith('Некорректный формат Email', 'error');
    });

    it('index.html contains no invisible overlay elements or data-google-signin blocks on Google buttons', () => {
        const indexPath = resolve(process.cwd(), 'index.html');
        const indexHtml = readFileSync(indexPath, 'utf8');

        expect(indexHtml).not.toContain('data-google-signin');
        expect(indexHtml).not.toContain('g-signin-overlay');
        expect(indexHtml).toMatch(/data-action=["']?login-with-google["']?/);
        expect(indexHtml).toMatch(/data-action=["']?forgot-password["']?/);
        expect(indexHtml).toMatch(/id=btnBackLogin[^>]*data-i18n=sidebar\.back/);
    });

    it('handleAuth register supplies display_name, username, full_name, and name in auth.signUp options.data', async () => {
        mockSupabase.auth.signUp.mockResolvedValue({
            data: { user: { id: 'usr-123', email: 'vibe@test.com' } },
            error: null
        });

        globalThis.document.getElementById = vi.fn((id) => {
            if (id === 'authEmail') return { value: 'vibe@test.com' };
            if (id === 'authPass') return { value: 'securepassword123' };
            if (id === 'authUsername') return { value: 'VibeLord' };
            return null;
        });

        await globalThis.handleAuth('register', false);

        expect(mockSupabase.auth.signUp).toHaveBeenCalledTimes(1);
        const [signUpPayload] = mockSupabase.auth.signUp.mock.calls[0];
        expect(signUpPayload.email).toBe('vibe@test.com');
        expect(signUpPayload.password).toBe('securepassword123');
        expect(signUpPayload.options.data).toEqual({
            username: 'VibeLord',
            display_name: 'VibeLord',
            full_name: 'VibeLord',
            name: 'VibeLord'
        });
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('Регистрация успешна'), 'success');
    });

    it('checkSession synchronizes display_name to user metadata and profiles when nickname exists', async () => {
        const mockUpdateUser = vi.fn().mockResolvedValue({ error: null });
        mockSupabase.auth.updateUser = mockUpdateUser;

        const mockProfileUpdate = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                then: vi.fn().mockReturnValue({ catch: vi.fn() })
            })
        });

        mockSupabase.from = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                        data: [{ id: 'usr-456', username: 'VintageFan' }],
                        error: null
                    })
                })
            }),
            update: mockProfileUpdate
        });

        mockSupabase.auth.getUser.mockResolvedValue({
            data: {
                user: {
                    id: 'usr-456',
                    email: 'vintage@test.com',
                    user_metadata: {} // missing display_name
                }
            },
            error: null
        });

        await globalThis.checkSession();

        expect(mockUpdateUser).toHaveBeenCalledWith({
            data: expect.objectContaining({
                display_name: 'VintageFan',
                username: 'VintageFan'
            })
        });
    });
});
