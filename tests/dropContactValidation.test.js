// @ts-check
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    validateProposalPhone,
    extractTelegramUsername,
    validateProposalContactSync,
    checkTelegramUsernameRemote,
    scheduleBackgroundTelegramCheck,
    verifyProposalContactBeforeSubmit,
    getCachedTelegramUsernameStatus,
    resetProposalContactValidationState
} from '../js/drop/drop-contact-validation.js';

describe('drop-contact-validation (phone & Telegram non-blocking checks)', () => {
    /** @type {any} */
    const g = globalThis;
    let origApiClient;

    beforeEach(() => {
        origApiClient = g.apiClient;
        resetProposalContactValidationState({ clearCache: true });
    });

    afterEach(() => {
        g.apiClient = origApiClient;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('validates Ukrainian and international phone numbers and rejects fake/invalid phones', () => {
        expect(validateProposalPhone('+380971234567')).toEqual({ valid: true, normalized: '+380971234567' });
        expect(validateProposalPhone('+38 (097) 123-45-67')).toEqual({ valid: true, normalized: '+380971234567' });
        expect(validateProposalPhone('0971234567')).toEqual({ valid: true, normalized: '+380971234567' });
        expect(validateProposalPhone('380631234567')).toEqual({ valid: true, normalized: '+380631234567' });
        expect(validateProposalPhone('80501234567')).toEqual({ valid: true, normalized: '+380501234567' });
        expect(validateProposalPhone('+48 512 345 678')).toEqual({ valid: true, normalized: '+48512345678' });
        expect(validateProposalPhone('+1 212 555 0199')).toEqual({ valid: true, normalized: '+12125550199' });
        // iOS / Android Contacts copy-paste with bidi marks, NBSP and en-dash
        expect(validateProposalPhone('\u202A+380\u00A097\u2013123\u201345\u201367\u202C')).toEqual({
            valid: true,
            normalized: '+380971234567'
        });

        // Invalid lengths, operator prefixes, fake repeated digits, garbage
        expect(validateProposalPhone('+380971234')).toEqual({ valid: false, normalized: '' });
        expect(validateProposalPhone('+38097123456789')).toEqual({ valid: false, normalized: '' });
        expect(validateProposalPhone('0101234567')).toEqual({ valid: false, normalized: '' }); // invalid UA prefix 01x
        expect(validateProposalPhone('+380970000000')).toEqual({ valid: false, normalized: '' }); // repeated tail
        expect(validateProposalPhone('0991111111')).toEqual({ valid: false, normalized: '' }); // repeated tail
        expect(validateProposalPhone('1234567')).toEqual({ valid: false, normalized: '' });
        expect(validateProposalPhone('097abc1234')).toEqual({ valid: false, normalized: '' });
        expect(validateProposalPhone('++380971234567')).toEqual({ valid: false, normalized: '' });
    });

    it('extracts and validates Telegram @username and t.me links', () => {
        expect(extractTelegramUsername('@durov')).toEqual({ valid: true, username: 'durov' });
        expect(extractTelegramUsername('@Stor1k')).toEqual({ valid: true, username: 'Stor1k' });
        expect(extractTelegramUsername('https://t.me/nisha_store/')).toEqual({ valid: true, username: 'nisha_store' });
        expect(extractTelegramUsername('https://t.me/durov?start=1')).toEqual({ valid: true, username: 'durov' });
        expect(extractTelegramUsername('t.me/archive_drop')).toEqual({ valid: true, username: 'archive_drop' });
        expect(extractTelegramUsername('valid_user99')).toEqual({ valid: true, username: 'valid_user99' });

        expect(extractTelegramUsername('@ab')).toEqual({ valid: false, username: '' }); // <5 chars
        expect(extractTelegramUsername('@12345')).toEqual({ valid: false, username: '' }); // starts with digit
        expect(extractTelegramUsername('@bad__nick')).toEqual({ valid: false, username: '' }); // double _
        expect(extractTelegramUsername('@bad_nick_')).toEqual({ valid: false, username: '' }); // trailing _
        expect(extractTelegramUsername('@иван_тг')).toEqual({ valid: false, username: '' }); // cyrillic
        expect(extractTelegramUsername('@my nick')).toEqual({ valid: false, username: '' }); // space
    });

    it('validates single contact only (either phone OR Telegram) and rejects two contacts at once', () => {
        expect(validateProposalContactSync('+380971234567')).toMatchObject({
            ok: true,
            kind: 'phone',
            phone: '+380971234567',
            tgUsername: ''
        });
        expect(validateProposalContactSync('@durov')).toMatchObject({
            ok: true,
            kind: 'telegram',
            tgUsername: 'durov',
            phone: ''
        });
        expect(validateProposalContactSync('тг: @durov')).toMatchObject({
            ok: true,
            kind: 'telegram',
            tgUsername: 'durov'
        });
        expect(validateProposalContactSync('тел: +380 97 123 45 67')).toMatchObject({
            ok: true,
            kind: 'phone',
            phone: '+380971234567'
        });

        // Two contacts at once MUST be rejected with dedicated errorKey
        expect(validateProposalContactSync('@sand0ra420 | +380973115592')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_contact_single_only'
        });
        expect(validateProposalContactSync('@durov +380971234567')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_contact_single_only'
        });
        expect(validateProposalContactSync('+380971234567 @durov')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_contact_single_only'
        });
        expect(validateProposalContactSync('@durov, +380971234567')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_contact_single_only'
        });
        expect(validateProposalContactSync('@user1 @user2')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_contact_single_only'
        });
        expect(validateProposalContactSync('+380971234567 +380631234567')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_contact_single_only'
        });
        expect(validateProposalContactSync('0971234567 0631234567')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_contact_single_only'
        });

        expect(validateProposalContactSync('+38097123')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_phone_invalid'
        });
        expect(validateProposalContactSync('@abc')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_tg_format'
        });
        expect(validateProposalContactSync('напиши в инсту')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_contact_invalid'
        });
        expect(validateProposalContactSync('')).toMatchObject({
            ok: false,
            errorKey: 'propose.err_fill_all'
        });
    });

    it('rejects non-existent @Stor1k via remote API and caches the verdict', async () => {
        const postMock = vi.fn().mockResolvedValue({
            success: true,
            username: 'Stor1k',
            validFormat: true,
            exists: false,
            verified: true
        });
        g.apiClient = { post: postMock };

        const res1 = await verifyProposalContactBeforeSubmit('@Stor1k');
        expect(res1).toEqual({
            ok: false,
            errorKey: 'propose.err_tg_not_found',
            tgUsername: 'Stor1k',
            phone: ''
        });
        expect(postMock).toHaveBeenCalledTimes(1);

        // Cached: second call hits cache (0 network calls)
        expect(getCachedTelegramUsernameStatus('stor1k')?.exists).toBe(false);
        const res2 = await verifyProposalContactBeforeSubmit('@Stor1k');
        expect(res2.ok).toBe(false);
        expect(postMock).toHaveBeenCalledTimes(1);
    });

    it('allows existing Telegram username and skips remote call for phone-only contact', async () => {
        const postMock = vi.fn().mockResolvedValue({
            success: true,
            username: 'durov',
            validFormat: true,
            exists: true,
            verified: true
        });
        g.apiClient = { post: postMock };

        const phoneOnly = await verifyProposalContactBeforeSubmit('+380971234567');
        expect(phoneOnly.ok).toBe(true);
        expect(postMock).not.toHaveBeenCalled();

        const tgRes = await verifyProposalContactBeforeSubmit('@durov');
        expect(tgRes.ok).toBe(true);
        expect(postMock).toHaveBeenCalledTimes(1);
    });

    it('fails open on network error / timeout so proposals are never blocked by t.me outage', async () => {
        const postMock = vi.fn().mockRejectedValue(new Error('TimeoutError'));
        g.apiClient = { post: postMock };

        const res = await verifyProposalContactBeforeSubmit('@some_valid_user');
        expect(res.ok).toBe(true);
        expect(getCachedTelegramUsernameStatus('some_valid_user')).toBeNull();
    });

    it('debounces background checks and cancels stale requests without blocking UI', async () => {
        vi.useFakeTimers();
        const postMock = vi.fn().mockResolvedValue({
            success: true,
            username: 'final_nick',
            validFormat: true,
            exists: false,
            verified: true
        });
        g.apiClient = { post: postMock };

        const onResult = vi.fn();
        scheduleBackgroundTelegramCheck('@first_nick', { delayMs: 400, onResult });
        vi.advanceTimersByTime(200);
        scheduleBackgroundTelegramCheck('@final_nick', { delayMs: 400, onResult });
        await vi.advanceTimersByTimeAsync(450);

        expect(postMock).toHaveBeenCalledTimes(1);
        expect(postMock.mock.calls[0][1]).toEqual({ username: 'final_nick' });
        expect(onResult).toHaveBeenCalledTimes(1);
        expect(onResult.mock.calls[0][0].exists).toBe(false);
    });

    it('deduplicates concurrent in-flight remote checks for the same username', async () => {
        let resolveReq;
        const postMock = vi.fn().mockImplementation(() => new Promise((r) => { resolveReq = r; }));
        g.apiClient = { post: postMock };

        const p1 = checkTelegramUsernameRemote('@same_user');
        const p2 = checkTelegramUsernameRemote('@SAME_USER');
        expect(postMock).toHaveBeenCalledTimes(1);

        resolveReq({ success: true, username: 'same_user', validFormat: true, exists: true, verified: true });
        const [r1, r2] = await Promise.all([p1, p2]);
        expect(r1.exists).toBe(true);
        expect(r2.exists).toBe(true);
    });
});
