import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Checkout Profile Delivery Autofill & Ref Resolution', () => {
    let cartCode;
    let profileCode;

    beforeEach(() => {
        cartCode = readFileSync(resolve(__dirname, '../js/cart/cart.js'), 'utf-8');
        profileCode = readFileSync(resolve(__dirname, '../js/profile/profile.js'), 'utf-8');
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
});
