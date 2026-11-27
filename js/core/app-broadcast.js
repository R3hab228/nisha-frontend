// @ts-check
// ==========================================
// NISHA CORE — SITE BROADCASTS CONTROLLER
// Загрузка, предзагрузка медиа и показ системных рассылок (site_broadcasts).
// ==========================================

import { hasAction, invokeAction } from './action-registry.js';

/**
 * @param {any} rawUrl
 */
function resolveBroadcastImageUrls(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return { primary: '', fallback: '' };
    const trimmed = rawUrl.trim();
    if (!/^https?:\/\//i.test(trimmed)) return { primary: '', fallback: '' };
    const cdnUrl = typeof window.toCDN === 'function' ? window.toCDN(trimmed) : trimmed;
    const escBroadcastAttr = (/** @type {string} */ u) => String(u)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    const safePrimary = /^https?:\/\//i.test(cdnUrl) ? escBroadcastAttr(cdnUrl) : '';
    const safeFallback = trimmed !== cdnUrl ? escBroadcastAttr(trimmed) : '';
    return { primary: safePrimary, fallback: safeFallback };
}

/**
 * @param {any} bData
 */
function resolveBroadcastImageList(bData) {
    if (!bData) return [];
    const rawList = Array.isArray(bData.image_urls) && bData.image_urls.length > 0
        ? bData.image_urls
        : (bData.image_url ? [bData.image_url] : []);
    const seen = new Set();
    const result = [];
    for (const rawUrl of rawList) {
        if (result.length >= 3) break;
        const pair = resolveBroadcastImageUrls(rawUrl);
        const key = pair.primary || pair.fallback;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(pair);
    }
    return result;
}

/**
 * @param {string} url
 * @param {number} [timeoutMs=1600]
 */
function preloadImageWithTimeout(url, timeoutMs = 1600) {
    if (!url || typeof Image === 'undefined') return Promise.resolve({ ok: false, width: 0, height: 0 });
    return new Promise((resolve) => {
        let settled = false;
        const done = (/** @type {boolean} */ ok, width = 0, height = 0) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ ok, width, height });
        };
        const timer = setTimeout(() => done(false), timeoutMs);
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            const w = Number(img.naturalWidth) || 0;
            const h = Number(img.naturalHeight) || 0;
            if (typeof img.decode === 'function') {
                img.decode().catch(() => {}).finally(() => done(true, w, h));
            } else {
                done(true, w, h);
            }
        };
        img.onerror = () => done(false);
        img.src = url;
    });
}

/**
 * @param {any} bData
 * @param {Array<{ src: string, width: number, height: number }>} [resolvedImages=[]]
 */
function buildBroadcastContent(bData, resolvedImages = []) {
    if (!bData) return '';
    const hasValidText = bData.message_text && typeof bData.message_text === 'string' && bData.message_text.trim() && bData.message_text.trim() !== 'null';
    const imgs = Array.isArray(resolvedImages) && resolvedImages.length > 0
        ? resolvedImages
        : resolveBroadcastImageList(bData).map((p) => ({ src: p.primary || p.fallback, width: 1200, height: 1200 }));
    const validImgs = imgs.filter((it) => it && it.src).slice(0, 3);
    if (!hasValidText && validImgs.length === 0) return '';

    let html = '';
    if (validImgs.length > 0) {
        const zoomSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>';
        const tilesHtml = validImgs.map((it, idx) => {
            const w = it.width > 0 ? it.width : 1200;
            const h = it.height > 0 ? it.height : 1200;
            return `<a href="${it.src}" class="broadcast-media-item" data-pswp-index="${idx}" data-pswp-width="${w}" data-pswp-height="${h}" target="_blank" rel="noopener"><img src="${it.src}" alt="" decoding="async"><span class="broadcast-media-zoom-hint">${zoomSvg}</span></a>`;
        }).join('');
        html += `<div class="broadcast-media-grid" data-count="${validImgs.length}">${tilesHtml}</div>`;
    }
    if (hasValidText) {
        const escFn = hasAction('escapeHtml')
            ? (/** @type {string} */ s) => String(invokeAction('escapeHtml', s) ?? '')
            : (/** @type {string} */ s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
        html += `<div style="font-size:14px; line-height:1.5;">${escFn(bData.message_text).replaceAll('\n', '<br>')}</div>`;
    }
    return html;
}

/**
 * Создаёт контроллер системных рассылок с дедупликацией и фолбэком после возврата на вкладку.
 * @param {{ getSupabase: () => any, storage: any, store: any }} deps
 */
export function createSiteBroadcastController({ getSupabase, storage, store }) {
    const _dispatchedBroadcastIds = new Set();
    let _lastBroadcastCheckAt = 0;
    let _isCheckingBroadcast = false;

    /** @param {string} bId */
    const createMarkBroadcastSeen = (bId) => () => {
        if (!bId) return;
        if (storage && typeof storage.set === 'function') storage.set('nisha_last_broadcast', bId);
        const activeUser = store.user;
        const sb = getSupabase();
        if (activeUser && sb) {
            sb.from('profiles').update({ last_broadcast_id: bId }).eq('id', activeUser.id).then();
        }
    };

    /**
     * @param {any} bData
     * @param {{ respectOnboardingTour?: boolean }} [opts={}]
     */
    const dispatchSiteBroadcast = async (bData, { respectOnboardingTour = false } = {}) => {
        if (!bData || !bData.id || _dispatchedBroadcastIds.has(bData.id)) return;
        _dispatchedBroadcastIds.add(bData.id);

        const imagePairs = resolveBroadcastImageList(bData);
        const resolvedImages = await Promise.all(imagePairs.map(async (pair) => {
            if (pair.primary) {
                const primaryRes = await preloadImageWithTimeout(pair.primary, 1600);
                if (primaryRes.ok) {
                    return { src: pair.primary, width: primaryRes.width || 1200, height: primaryRes.height || 1200 };
                }
                if (pair.fallback) {
                    const fallbackRes = await preloadImageWithTimeout(pair.fallback, 1400);
                    if (fallbackRes.ok) {
                        return { src: pair.fallback, width: fallbackRes.width || 1200, height: fallbackRes.height || 1200 };
                    }
                }
            }
            return { src: pair.primary || pair.fallback, width: 1200, height: 1200 };
        }));

        const broadcastContent = buildBroadcastContent(bData, resolvedImages);
        const markAsSeen = createMarkBroadcastSeen(bData.id);
        if (!broadcastContent) {
            markAsSeen();
            return;
        }
        const g = /** @type {any} */ (globalThis);
        const showBroadcastFn = (typeof window.tryShowBroadcast === 'function')
            ? window.tryShowBroadcast
            : (typeof g.tryShowBroadcast === 'function' ? g.tryShowBroadcast : (hasAction('tryShowBroadcast') ? (/** @type {any[]} */ ...args) => invokeAction('tryShowBroadcast', ...args) : null));
        const okBtnLabel = (typeof window.i18next !== 'undefined' && typeof window.i18next.t === 'function')
            ? window.i18next.t('badge_info.btn_understood', { defaultValue: '[ ПОНЯТНО ]' })
            : '[ ПОНЯТНО ]';
        const tourDone = !respectOnboardingTour || Boolean(store && store.get('nisha_tour_done'));
        if (tourDone && showBroadcastFn) {
            showBroadcastFn('SYSTEM_BROADCAST.MSG', broadcastContent, okBtnLabel, markAsSeen, { persistent: true });
        } else {
            window.pendingBroadcastHtml = broadcastContent;
            window.pendingBroadcastId = bData.id;
            window.pendingBroadcastMarkSeen = markAsSeen;
        }
    };

    /**
     * @param {{ force?: boolean, respectOnboardingTour?: boolean }} [opts={}]
     */
    const checkLatestSiteBroadcast = async ({ force = false, respectOnboardingTour = false } = {}) => {
        const sb = getSupabase();
        if (!sb || _isCheckingBroadcast) return;
        const now = Date.now();
        if (!force && (now - _lastBroadcastCheckAt) < 10000) return;
        _lastBroadcastCheckAt = now;
        _isCheckingBroadcast = true;
        try {
            const { data: broadcasts, error: broadcastErr } = await sb
                .from('site_broadcasts')
                .select('id, message_text, image_url, image_urls')
                .order('created_at', { ascending: false })
                .limit(1);
            if (broadcastErr) {
                console.warn('Ошибка загрузки рассылки', broadcastErr);
                return;
            }

            if (broadcasts && broadcasts.length > 0) {
                const bData = broadcasts.at(0);
                const localSeenId = (storage && typeof storage.get === 'function') ? storage.get('nisha_last_broadcast') : null;
                const profile = store.profile;
                const dbSeenId = profile ? profile.last_broadcast_id : null;
                const hasSeen = (localSeenId === bData.id) || (dbSeenId === bData.id);

                if (!hasSeen) {
                    await dispatchSiteBroadcast(bData, { respectOnboardingTour });
                }
            }
        } catch (e) {
            console.warn('Ошибка загрузки рассылки', e);
        } finally {
            _isCheckingBroadcast = false;
        }
    };

    const bindBroadcastLifecycle = () => {
        setTimeout(() => {
            checkLatestSiteBroadcast({ force: true, respectOnboardingTour: true });
        }, 1200);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkLatestSiteBroadcast({ respectOnboardingTour: false });
            }
        });
        window.addEventListener('pageshow', (ev) => {
            if (ev && ev.persisted) {
                checkLatestSiteBroadcast({ force: true, respectOnboardingTour: false });
            }
        });
    };

    return {
        dispatchSiteBroadcast,
        checkLatestSiteBroadcast,
        bindBroadcastLifecycle
    };
}
