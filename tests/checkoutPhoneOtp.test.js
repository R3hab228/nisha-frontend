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
    get(key, def = '') {
        return this._map.has(key) ? this._map.get(key) : def;
    }
    set(key, val) {
        this._map.set(key, String(val));
    }
}

describe('Checkout Phone OTP Verification & Win95 Success Button State', () => {
    let elements = {};

    beforeAll(async () => {
        globalThis.Storage = MockStorage;
        globalThis.localStorage = new MockStorage();
        globalThis.storage = new MockStorage();
        globalThis.window = globalThis.window || globalThis;
        globalThis.window.storage = globalThis.storage;
        globalThis.window.location = { hostname: 'localhost', protocol: 'http:', origin: 'http://localhost' };

        if (typeof globalThis.window.addEventListener !== 'function') {
            globalThis.window.addEventListener = vi.fn();
        }

        globalThis.i18next = {
            t: vi.fn((key, opts) => {
                if (key === 'checkout.btn_otp') return 'Подтвердить';
                if (key === 'checkout.btn_otp_success') return 'УСПЕХ ✓';
                return opts?.defaultValue || key;
            })
        };

        elements = {
            orderPhone: {
                id: 'orderPhone',
                value: '',
                classList: {
                    _classes: new Set(),
                    add(c) { this._classes.add(c); },
                    remove(c) { this._classes.delete(c); },
                    contains(c) { return this._classes.has(c); }
                },
                dataset: {}
            },
            btnGetOtp: {
                id: 'btnGetOtp',
                disabled: false,
                innerText: 'Подтвердить',
                innerHTML: 'Подтвердить',
                style: {},
                classList: {
                    _classes: new Set(['search-btn']),
                    add(c) { this._classes.add(c); },
                    remove(c) { this._classes.delete(c); },
                    contains(c) { return this._classes.has(c); }
                },
                setAttribute: vi.fn((k, v) => { elements.btnGetOtp[k] = v; })
            },
            btnSubmitOrder: {
                id: 'btnSubmitOrder',
                style: {}
            },
            otpStatus: {
                id: 'otpStatus',
                style: {}
            },
            checkoutPhoneWrapper: {
                id: 'checkoutPhoneWrapper',
                style: {}
            },
            propContactWrapper: {
                id: 'propContactWrapper',
                style: {}
            },
            propContact: {
                id: 'propContact',
                value: ''
            }
        };

        globalThis.document = {
            getElementById: vi.fn((id) => elements[id] || null),
            querySelector: vi.fn((sel) => null),
            querySelectorAll: vi.fn(() => []),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };

        await import('../js/core/store.js');
        await import('../js/auth/auth.js');
    });

    beforeEach(() => {
        globalThis.localStorage.clear();
        globalThis.storage.clear();
        window.userProfile = null;
        window.currentUser = null;
        window.otpVerified = false;

        elements.orderPhone.value = '';
        elements.orderPhone.classList._classes.clear();
        elements.orderPhone.dataset = {};

        elements.btnGetOtp.disabled = false;
        elements.btnGetOtp.innerText = 'Подтвердить';
        elements.btnGetOtp.innerHTML = 'Подтвердить';
        elements.btnGetOtp.style = {};
        elements.btnGetOtp.classList._classes = new Set(['search-btn']);

        elements.btnSubmitOrder.style = {};
        elements.otpStatus.style = {};
        elements.checkoutPhoneWrapper.style = {};
        elements.propContactWrapper.style = {};
        elements.propContact.value = '';
    });

    it('matches phone numbers correctly regardless of format (+380, 0xx, spaces, dashes)', () => {
        const { isPhoneMatchingVerified } = window;
        expect(typeof isPhoneMatchingVerified).toBe('function');

        expect(isPhoneMatchingVerified('+380 (99) 123-45-67', '0991234567')).toBe(true);
        expect(isPhoneMatchingVerified('+380991234567', '0991234567')).toBe(true);
        expect(isPhoneMatchingVerified('+380991234567', '+380991234567')).toBe(true);
        expect(isPhoneMatchingVerified('0991234567', '0991234567')).toBe(true);
        expect(isPhoneMatchingVerified('+380 (50) 111-22-33', '0991234567')).toBe(false);
        expect(isPhoneMatchingVerified('', '0991234567')).toBe(false);
        expect(isPhoneMatchingVerified('+380991234567', null)).toBe(false);
    });

    it('resolves getUserPhone from userProfile, currentUser metadata, and storage', () => {
        const { getUserPhone } = window;

        // 1. Из storage
        globalThis.storage.set('nisha_last_phone', '+380501112233');
        expect(getUserPhone()).toBe('+380501112233');

        // 2. Из window.userProfile (перекрывает гостевой storage)
        window.userProfile = { phone: '+380991234567' };
        expect(getUserPhone()).toBe('+380991234567');

        // 3. Из currentUser metadata
        window.userProfile = null;
        window.currentUser = { user_metadata: { phone: '+380679998877' } };
        expect(getUserPhone()).toBe('+380679998877');
    });

    it('setOtpButtonSuccess sets the button into disabled Win95 success state with gray border and green text', () => {
        const { setOtpButtonSuccess } = window;
        const btn = elements.btnGetOtp;

        setOtpButtonSuccess(btn);

        expect(btn.classList.contains('btn-otp-success')).toBe(true);
        expect(btn.disabled).toBe(true);
        expect(btn.style.pointerEvents).toBe('none');
        expect(btn.style.cursor).toBe('default');
        expect(btn.style.background).toBe('#141414');
        expect(btn.style.borderColor).toBe('#777');
        expect(btn.innerHTML).toContain('УСПЕХ ✓');
        expect(btn['data-i18n']).toBe('checkout.btn_otp_success');
    });

    it('setOtpButtonDefault restores the active default button state', () => {
        const { setOtpButtonSuccess, setOtpButtonDefault } = window;
        const btn = elements.btnGetOtp;

        setOtpButtonSuccess(btn);
        expect(btn.classList.contains('btn-otp-success')).toBe(true);

        setOtpButtonDefault(btn);
        expect(btn.classList.contains('btn-otp-success')).toBe(false);
        expect(btn.disabled).toBe(false);
        expect(btn.style.pointerEvents).toBe('auto');
        expect(btn.innerText).toBe('Подтвердить');
        expect(btn['data-i18n']).toBe('checkout.btn_otp');
    });

    it('checkPhoneAuth recognizes profile-verified phone and renders success button without requiring OTP', async () => {
        const { checkPhoneAuth } = window;
        window.userProfile = { phone: '0991234567' };
        elements.orderPhone.value = '+380 (99) 123-45-67';

        await checkPhoneAuth();

        expect(window.otpVerified).toBe(true);
        expect(elements.btnSubmitOrder.style.opacity).toBe('1');
        expect(elements.btnSubmitOrder.style.pointerEvents).toBe('auto');
        expect(elements.otpStatus.style.display).toBe('none');
        expect(elements.orderPhone.classList.contains('input-valid')).toBe(true);
        expect(elements.btnGetOtp.classList.contains('btn-otp-success')).toBe(true);
        expect(elements.btnGetOtp.disabled).toBe(true);
    });

    it('checkPhoneAuth blocks submission when entered phone does not match verified profile phone', async () => {
        const { checkPhoneAuth } = window;
        window.userProfile = { phone: '0991234567' };
        elements.orderPhone.value = '+380 (50) 999-88-77';

        await checkPhoneAuth();

        expect(window.otpVerified).toBe(false);
        expect(elements.btnSubmitOrder.style.opacity).toBe('0.5');
        expect(elements.btnSubmitOrder.style.pointerEvents).toBe('none');
        expect(elements.btnGetOtp.classList.contains('btn-otp-success')).toBe(false);
        expect(elements.btnGetOtp.disabled).toBe(false);
    });

    it('updateProposeAndCheckoutFields autofills phone, keeps wrapper visible, and puts button into success state', () => {
        const { updateProposeAndCheckoutFields } = window;
        window.userProfile = { phone: '+380991234567', tg: '@testuser' };
        window.currentUser = { id: 'usr_1' };

        updateProposeAndCheckoutFields();

        expect(elements.checkoutPhoneWrapper.style.display).toBe('flex');
        expect(elements.orderPhone.value).toBe('+380991234567');
        expect(window.otpVerified).toBe(true);
        expect(elements.btnSubmitOrder.style.opacity).toBe('1');
        expect(elements.btnSubmitOrder.style.pointerEvents).toBe('auto');
        expect(elements.btnGetOtp.classList.contains('btn-otp-success')).toBe(true);
        expect(elements.btnGetOtp.disabled).toBe(true);
    });
});
