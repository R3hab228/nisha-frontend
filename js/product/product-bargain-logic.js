// ==========================================
// NISHA PRODUCT BARGAIN — VALIDATION, RATE LIMIT & PAYLOAD HELPERS
// ==========================================

import {
    getFingerprint,
    getStore,
    getUser,
    parseItemBargainInfo,
    applyOfferButtonState
} from './product-state.js';
import { getRuntimeSiteLang, tSafe } from '../core/runtime-env.js';
import { setPendingBargain } from '../core/bargain-storage.js';
import { getActiveCurrencyCode, convertFromUah, convertToUah } from '../core/currency.js';

const BARGAIN_RATE_LIMIT_STORAGE_KEY = 'nisha_bargain_offers_history';
const BARGAIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const BARGAIN_RATE_LIMIT_MAX = 2;

/**
 * Determines the best contact handle for bargain follow-ups (Telegram -> Phone -> Email).
 * @returns {string}
 */
export function getBestBuyerContact() {
    // 1. Telegram username из Telegram WebApp
    try {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (tgUser && tgUser.username) {
            return '@' + tgUser.username.replace(/^@/, '');
        }
    } catch {}

    // 2. Telegram username из профиля / хранилища
    try {
        const profile = (typeof window !== 'undefined' && window.userProfile) || null;
        const currentUser = getUser();
        const tgCandidate = (profile && (profile.tg || profile.telegram || profile.username)) ||
                            (currentUser && currentUser.user_metadata && (currentUser.user_metadata.telegram || currentUser.user_metadata.tg || currentUser.user_metadata.user_name)) ||
                            localStorage.getItem('nisha_last_tg') ||
                            localStorage.getItem('user_tg');
        if (tgCandidate && typeof tgCandidate === 'string' && tgCandidate.trim()) {
            const cleanTg = tgCandidate.trim().replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '');
            if (cleanTg && !cleanTg.includes('@')) return '@' + cleanTg;
        }
    } catch {}

    // 3. Номер телефона
    try {
        const profile = (typeof window !== 'undefined' && window.userProfile) || null;
        const currentUser = getUser();
        const store = getStore();
        const phoneCandidate = (profile && profile.phone) ||
                               (currentUser && (currentUser.phone || (currentUser.user_metadata && currentUser.user_metadata.phone))) ||
                               (store && store.get && (store.get('nisha_last_phone') || store.get('user_phone'))) ||
                               localStorage.getItem('nisha_last_phone') ||
                               localStorage.getItem('user_phone');
        if (phoneCandidate && typeof phoneCandidate === 'string' && phoneCandidate.trim()) {
            return phoneCandidate.trim();
        }
    } catch {}

    // 4. Email fallback
    try {
        const currentUser = getUser();
        if (currentUser && currentUser.email) return currentUser.email.trim();
        const lastEmail = localStorage.getItem('nisha_last_email');
        if (lastEmail) return lastEmail.trim();
    } catch {}

    return '';
}

/**
 * Checks client-side bargain rate limit (max 2 offers per 10 minutes).
 * @returns {{ allowed: boolean, remainingMin?: number }}
 */
export function checkClientBargainRateLimit() {
    try {
        const raw = localStorage.getItem(BARGAIN_RATE_LIMIT_STORAGE_KEY);
        if (!raw) return { allowed: true };
        const history = JSON.parse(raw);
        if (!Array.isArray(history)) return { allowed: true };

        const now = Date.now();
        const validTimestamps = history.filter(ts => typeof ts === 'number' && (now - ts) < BARGAIN_RATE_LIMIT_WINDOW_MS);
        if (validTimestamps.length >= BARGAIN_RATE_LIMIT_MAX) {
            const oldest = Math.min(...validTimestamps);
            const remainingMs = Math.max(0, BARGAIN_RATE_LIMIT_WINDOW_MS - (now - oldest));
            const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
            return { allowed: false, remainingMin };
        }
        return { allowed: true };
    } catch {
        return { allowed: true };
    }
}

/**
 * Records a new bargain submission timestamp in localStorage for client-side rate limiting.
 */
export function recordClientBargainOffer() {
    try {
        const raw = localStorage.getItem(BARGAIN_RATE_LIMIT_STORAGE_KEY);
        const history = raw ? JSON.parse(raw) : [];
        const now = Date.now();
        const validTimestamps = Array.isArray(history)
            ? history.filter(ts => typeof ts === 'number' && (now - ts) < BARGAIN_RATE_LIMIT_WINDOW_MS)
            : [];
        validTimestamps.push(now);
        localStorage.setItem(BARGAIN_RATE_LIMIT_STORAGE_KEY, JSON.stringify(validTimestamps));
    } catch {}
}

/**
 * Shared validation for both modal and inline bargain submissions.
 * Accepts input in the active display currency (`UAH` | `USD` | `EUR`) and returns normalized `offeredPriceUah`.
 * @param {object} activeItem
 * @param {number} offeredPrice
 * @returns {{ ok: boolean, offeredPriceUah?: number, message?: string, focusInput?: boolean }}
 */
export function validateBargainSubmission(activeItem, offeredPrice) {
    const rateCheck = checkClientBargainRateLimit();
    if (!rateCheck.allowed) {
        return {
            ok: false,
            message: tSafe('product.offer_rate_limit', 'Максимум 2 пропозиції за 10 хвилин. Будь ласка, зачекайте ще {{min}} хв.', { min: rateCheck.remainingMin })
                .replace('{{min}}', String(rateCheck.remainingMin))
        };
    }

    const currentPriceUah = Number(activeItem.price) || 0;
    const activeCode = getActiveCurrencyCode();
    const isForeignCurrency = activeCode !== 'UAH';

    if (!offeredPrice || Number.isNaN(offeredPrice) || offeredPrice <= 0) {
        return {
            ok: false,
            focusInput: true,
            message: tSafe('product.offer_enter_price', 'Вкажіть ціну!')
        };
    }

    const { hasBargain, itemMinBargain } = parseItemBargainInfo(activeItem);
    const minFloorUah = 100;
    const effectiveMinUah = itemMinBargain ? Math.max(minFloorUah, itemMinBargain) : minFloorUah;

    const formatMinErrorMsg = (uahVal) => {
        const g = /** @type {any} */ (globalThis);
        const formatted = typeof g.formatPrice === 'function' ? g.formatPrice(uahVal) : `${uahVal} грн`;
        const lang = getRuntimeSiteLang();
        if (lang === 'ru') return `Минимальная цена предложения: ${formatted}!`;
        if (lang === 'en') return `Minimum offer price: ${formatted}!`;
        return `Мінімальна ціна для пропозиції: ${formatted}!`;
    };

    if (!isForeignCurrency) {
        if (offeredPrice < minFloorUah || offeredPrice >= currentPriceUah) {
            return {
                ok: false,
                focusInput: true,
                message: (offeredPrice > 0 && offeredPrice < minFloorUah)
                    ? tSafe('product.offer_min_100', 'Мінімальна ціна для пропозиції: 100 грн!')
                    : tSafe('product.offer_invalid_price', 'Будь ласка, вкажіть реальну ціну нижче поточної!')
            };
        }
        if (!hasBargain) {
            return { ok: false, message: tSafe('product.offer_disabled', 'Для цього товару торг не передбачено!') };
        }
        if (itemMinBargain && offeredPrice < itemMinBargain) {
            return {
                ok: false,
                focusInput: true,
                message: tSafe('product.offer_below_min', 'Мінімальна ціна для пропозиції: {{min}} грн!', { min: itemMinBargain })
                    .replace('{{min}}', String(itemMinBargain))
            };
        }
        return { ok: true, offeredPriceUah: Math.round(offeredPrice) };
    }

    // Мультивалютная валидация (USD / EUR): сверяем с отображаемыми порогами и конвертируем в UAH для сервера
    const currentDisplay = convertFromUah(currentPriceUah, activeCode);
    const minFloorDisplay = Math.min(convertFromUah(minFloorUah, activeCode), Math.max(1, currentDisplay - 1));
    const effectiveMinDisplay = Math.min(convertFromUah(effectiveMinUah, activeCode), Math.max(1, currentDisplay - 1));

    if (offeredPrice < minFloorDisplay || offeredPrice >= currentDisplay) {
        return {
            ok: false,
            focusInput: true,
            message: (offeredPrice > 0 && offeredPrice < minFloorDisplay)
                ? formatMinErrorMsg(minFloorUah)
                : tSafe('product.offer_invalid_price', 'Будь ласка, вкажіть реальну ціну нижче поточної!')
        };
    }

    if (!hasBargain) {
        return { ok: false, message: tSafe('product.offer_disabled', 'Для цього товару торг не передбачено!') };
    }

    if (itemMinBargain && offeredPrice < effectiveMinDisplay) {
        return {
            ok: false,
            focusInput: true,
            message: formatMinErrorMsg(itemMinBargain)
        };
    }

    const rawUah = convertToUah(offeredPrice, activeCode);
    const maxAllowedUah = Math.max(effectiveMinUah, currentPriceUah - 1);
    const safeOfferedUah = Math.min(maxAllowedUah, Math.max(effectiveMinUah, rawUah));

    return { ok: true, offeredPriceUah: safeOfferedUah };
}

/**
 * Builds canonical `/api/bargain` request payload.
 * @param {object} activeItem
 * @param {number} offeredPrice
 * @param {string} contact
 * @returns {object}
 */
export function buildBargainPayload(activeItem, offeredPrice, contact) {
    const fingerprint = getFingerprint();
    const firstImg = (Array.isArray(activeItem.images) && activeItem.images[0]) ||
                     (Array.isArray(activeItem.thumbnails) && activeItem.thumbnails[0]) ||
                     (typeof getOptimizedImg === 'function' ? getOptimizedImg(activeItem) : '') || '';
    const currentUid = (typeof window !== 'undefined' && window.currentUser && window.currentUser.id)
        ? String(window.currentUser.id)
        : null;

    return {
        itemId: String(activeItem.id),
        itemName: activeItem.name || '',
        itemImage: firstImg,
        currentPrice: Number(activeItem.price) || 0,
        offeredPrice,
        contact,
        clientId: String(fingerprint),
        userId: currentUid,
        lang: getRuntimeSiteLang()
    };
}

/**
 * Persists a newly submitted pending bargain state locally and updates `#modalOfferPriceBtn`.
 * @param {string|number} itemId
 * @param {number} offeredPrice
 */
export function markPendingBargainLocally(itemId, offeredPrice) {
    setPendingBargain(itemId, { itemId: String(itemId), offeredPrice, timestamp: Date.now() });
    applyOfferButtonState(document.getElementById('modalOfferPriceBtn'), 'pending');
}

/**
 * Formats safe user-facing bargain error message.
 * @param {Error|any} err
 * @returns {string}
 */
export function resolveBargainErrorMessage(err) {
    const serverMsg = err?.response?.data?.message || err?.data?.message || err?.message;
    const isSafeServerMsg = serverMsg && typeof serverMsg === 'string'
        && !serverMsg.includes('status code')
        && !serverMsg.includes('fetch')
        && !serverMsg.includes('Network');
    return isSafeServerMsg ? serverMsg : tSafe('propose.err_network', 'Помилка зв\'язку з сервером.');
}
