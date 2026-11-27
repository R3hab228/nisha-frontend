// @ts-check
import { describe, it, expect } from 'vitest';
import {
    escapeRegExp,
    isErrorLike,
    promiseTry,
    base64ToBytes,
    bytesToBase64
} from '../js/core/helpers-core-utils.js';

describe('ES2025 Native Utility Upgrades (with cross-browser fallbacks)', () => {
    it('escapeRegExp escapes all regex metacharacters cleanly (native RegExp.escape + fallback)', () => {
        const raw = 'Stone Island (L) [2000-3500₴]? + * . ^ $ | \\';
        const escaped = escapeRegExp(raw);
        const re = new RegExp(escaped);
        expect(re.test(raw)).toBe(true);
        expect(re.test('Stone Island XL')).toBe(false);
        expect(escapeRegExp('')).toBe('');
    });

    it('isErrorLike reliably detects Error instances and rejects plain objects/primitives', () => {
        expect(isErrorLike(new Error('boom'))).toBe(true);
        expect(isErrorLike(new TypeError('bad type'))).toBe(true);
        expect(isErrorLike({ message: 'fake error' })).toBe(false);
        expect(isErrorLike('error string')).toBe(false);
        expect(isErrorLike(null)).toBe(false);
        expect(isErrorLike(undefined)).toBe(false);
    });

    it('promiseTry wraps both synchronous throws and async rejections into rejected promises', async () => {
        const syncOk = await promiseTry((a, b) => a + b, 2, 3);
        expect(syncOk).toBe(5);

        const asyncOk = await promiseTry(async (x) => x * 10, 4);
        expect(asyncOk).toBe(40);

        await expect(
            promiseTry(() => {
                throw new Error('sync crash');
            })
        ).rejects.toThrow('sync crash');

        await expect(
            promiseTry(async () => {
                throw new Error('async crash');
            })
        ).rejects.toThrow('async crash');
    });

    it('base64ToBytes and bytesToBase64 round-trip standard and base64url payloads cleanly', () => {
        const sample = new Uint8Array([0, 1, 2, 127, 128, 254, 255, 42, 99]);

        const stdB64 = bytesToBase64(sample);
        expect(stdB64.length).toBeGreaterThan(0);
        const decodedStd = base64ToBytes(stdB64);
        expect(decodedStd).toBeInstanceOf(Uint8Array);
        expect(Array.from(decodedStd || [])).toEqual(Array.from(sample));

        const urlB64 = bytesToBase64(sample, { alphabet: 'base64url', omitPadding: true });
        expect(urlB64).not.toContain('+');
        expect(urlB64).not.toContain('/');
        expect(urlB64).not.toContain('=');
        const decodedUrl = base64ToBytes(urlB64, { alphabet: 'base64url' });
        expect(Array.from(decodedUrl || [])).toEqual(Array.from(sample));

        expect(base64ToBytes('!!!invalid-base64!!!')).toBeNull();
    });
});
