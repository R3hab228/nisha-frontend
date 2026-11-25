import { describe, it, expect, beforeEach } from 'vitest';
import { rgbaToThumbHash } from 'thumbhash';
import { decodeThumbHashToDataUrl, clearThumbHashCache } from '../js/catalog/thumbhash-preview.js';

function makeSampleThumbHashBase64() {
    const w = 16;
    const h = 16;
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i += 1) {
        rgba[i * 4] = 32;
        rgba[i * 4 + 1] = 160;
        rgba[i * 4 + 2] = 96;
        rgba[i * 4 + 3] = 255;
    }
    const hash = rgbaToThumbHash(w, h, rgba);
    return Buffer.from(hash).toString('base64');
}

describe('thumbhash-preview', () => {
    beforeEach(() => {
        clearThumbHashCache();
    });

    it('decodes a valid base64 ThumbHash into a PNG data URL and caches it', () => {
        const b64 = makeSampleThumbHashBase64();
        const first = decodeThumbHashToDataUrl(b64);
        const second = decodeThumbHashToDataUrl(b64);

        expect(first.startsWith('data:image/png;base64,')).toBe(true);
        expect(second).toBe(first);
    });

    it('returns empty string for invalid, empty, or oversized inputs', () => {
        expect(decodeThumbHashToDataUrl('')).toBe('');
        expect(decodeThumbHashToDataUrl(null)).toBe('');
        expect(decodeThumbHashToDataUrl(undefined)).toBe('');
        expect(decodeThumbHashToDataUrl('short')).toBe('');
        expect(decodeThumbHashToDataUrl('A'.repeat(200))).toBe('');
        expect(decodeThumbHashToDataUrl('!!!not-valid-base64!!!')).toBe('');
    });
});
