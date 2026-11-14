import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseDeliveryAddress } from '../src/modules/helpers.js';
import { readCartSource } from './helpers/readCartSource.js';
import { readProfileSource } from './helpers/readProfileSource.js';

describe('Checkout Profile Delivery Autofill & Ref Resolution', () => {
    let cartCode;
    let profileCode;

    beforeEach(() => {
        cartCode = readCartSource();
        profileCode = readProfileSource();
    });

    it('defines ensureBranchRef and exposes it on window', () => {
        expect(cartCode).toContain('async function ensureBranchRef(branchText)');
        expect(cartCode).toContain('window.ensureBranchRef = ensureBranchRef;');
    });

    it('resolves cityRef and branchRef dynamically on submitOrder when autofilled from profile', () => {
        expect(cartCode).toContain('await ensureCityRef()');
        expect(cartCode).toContain('await ensureBranchRef(branch)');
        expect(cartCode).toContain('city_auto_');
        expect(cartCode).toContain('branch_auto_');
    });

    it('resolves cityRef and branchRef dynamically in confirmEmailPrompt and executeOrderFinal', () => {
        expect(cartCode).toContain('function confirmEmailPrompt');
        expect(cartCode).toContain('function executeOrderFinal');
        // Both routines include dynamic ref resolution before strict check
        const confirmEmailPart = cartCode.slice(cartCode.indexOf('async function confirmEmailPrompt'), cartCode.indexOf('window.confirmEmailPrompt'));
        expect(confirmEmailPart).toContain('await ensureCityRef()');
        expect(confirmEmailPart).toContain('await ensureBranchRef(branch)');

        const execFinalPart = cartCode.slice(cartCode.indexOf('async function executeOrderFinal'), cartCode.indexOf('// 1. ОСНОВНОЙ ПУТЬ'));
        expect(execFinalPart).toContain('await ensureCityRef()');
        expect(execFinalPart).toContain('await ensureBranchRef(branch)');
    });

    it('restores profile delivery refs in openCheckoutModal from nisha_profile_delivery_refs or activeProfile', () => {
        expect(cartCode).toContain('nisha_profile_delivery_refs');
        expect(cartCode).toContain('activeProfile?.delivery_city_ref');
        expect(cartCode).toContain('activeProfile?.delivery_branch_ref');
    });

    it('stores refs in nisha_profile_delivery_refs without mutating nisha_profile_delivery schema', () => {
        expect(profileCode).toContain('nisha_profile_delivery_refs');
        expect(profileCode).toContain('profileSelectedBranchRef');
    });

    describe('parseDeliveryAddress with Cyrillic boundaries and region handling', () => {
        const parseFn = parseDeliveryAddress;

        it('parses city and branch with Cyrillic markers followed by space, number or colon', () => {
            const r1 = parseFn('м. Київ, Київська обл., Відділення №1: вул. Пирогівський шлях, 135');
            expect(r1.city).toBe('м. Київ, Київська обл.');
            expect(r1.branch).toBe('Відділення №1: вул. Пирогівський шлях, 135');

            const r2 = parseFn('м. Одеса, Поштомат №12345: просп. Шевченка, 1');
            expect(r2.city).toBe('м. Одеса');
            expect(r2.branch).toBe('Поштомат №12345: просп. Шевченка, 1');

            const r3 = parseFn('м. Львів, Нова Пошта №5');
            expect(r3.city).toBe('м. Львів');
            expect(r3.branch).toBe('Нова Пошта №5');

            const r4 = parseFn('м. Харків, пункт видачі 10');
            expect(r4.city).toBe('м. Харків');
            expect(r4.branch).toBe('пункт видачі 10');

            const r5 = parseFn('м. Дніпро, отделение 22');
            expect(r5.city).toBe('м. Дніпро');
            expect(r5.branch).toBe('отделение 22');
        });

        it('does not treat region (обл/район) as branch when branch is absent', () => {
            const r1 = parseFn('м. Київ, Київська обл.');
            expect(r1.city).toBe('м. Київ, Київська обл.');
            expect(r1.branch).toBe('');

            const r2 = parseFn('с. Петропавлівська Борщагівка, Бучанський р-н, Київська обл.');
            expect(r2.city).toBe('с. Петропавлівська Борщагівка, Бучанський р-н, Київська обл.');
            expect(r2.branch).toBe('');
        });

        it('handles multi-level settlements with oblast and branch', () => {
            const r = parseFn('с. Софіївська Борщагівка, Бучанський р-н, Київська обл., Відділення №1');
            expect(r.city).toBe('с. Софіївська Борщагівка, Бучанський р-н, Київська обл.');
            expect(r.branch).toBe('Відділення №1');
        });
    });

    describe('openCheckoutModal branch autofill resiliency', () => {
        it('autofills branch from profile when branch input is empty even if city is already filled', () => {
            expect(cartCode).toContain('if (branchInput && !branchInput.value.trim())');
            expect(cartCode).toContain('if (pBranch)');
            expect(cartCode).toContain('branchInput.value = pBranch');
            expect(cartCode).toContain('branchInput.readOnly = false');
        });

        it('extracts profile branch from DOM elements or activeProfile as fallback', () => {
            expect(cartCode).toContain('profileDeliveryBranch');
            expect(cartCode).toContain('modalProfileDeliveryBranch');
            expect(cartCode).toContain('activeProfile?.delivery_branch');
        });
    });
});
