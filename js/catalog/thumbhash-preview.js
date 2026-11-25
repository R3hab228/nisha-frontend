// @ts-check
// ==========================================
// NISHA CATALOG — МГНОВЕННОЕ THUMBHASH COLOR-BLUR ПРЕВЬЮ
// ==========================================

import { thumbHashToDataURL } from 'thumbhash';

const MAX_THUMBHASH_CACHE = 400;
/** @type {Map<string, string>} */
const thumbHashCache = new Map();

/**
 * Безопасно декодирует base64-строку в Uint8Array (браузер + Node/Vitest).
 * @param {string} base64
 * @returns {Uint8Array|null}
 */
function base64ToBytes(base64) {
    try {
        if (typeof globalThis.atob === 'function') {
            const binary = globalThis.atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        }
    } catch {
        return null;
    }
    return null;
}

/**
 * Декодирует компактный base64 ThumbHash в data:image/png;base64,... URL для мгновенного blur-фона карточки.
 * Кэширует результат в памяти, при любой ошибке возвращает пустую строку.
 * @param {unknown} hashBase64
 * @returns {string}
 */
export function decodeThumbHashToDataUrl(hashBase64) {
    if (typeof hashBase64 !== 'string') return '';
    const trimmed = hashBase64.trim();
    if (trimmed.length < 8 || trimmed.length > 128) return '';

    const cached = thumbHashCache.get(trimmed);
    if (cached !== undefined) return cached;

    const bytes = base64ToBytes(trimmed);
    if (!bytes || bytes.length < 5) return '';

    try {
        const dataUrl = thumbHashToDataURL(bytes);
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
            return '';
        }
        if (thumbHashCache.size >= MAX_THUMBHASH_CACHE) {
            const oldestKey = thumbHashCache.keys().next().value;
            if (oldestKey !== undefined) thumbHashCache.delete(oldestKey);
        }
        thumbHashCache.set(trimmed, dataUrl);
        return dataUrl;
    } catch {
        return '';
    }
}

/**
 * Очищает кэш декодированных превью (для тестов).
 */
export function clearThumbHashCache() {
    thumbHashCache.clear();
}
