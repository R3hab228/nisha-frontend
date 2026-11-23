// ==========================================
// NISHA NOVA POSHTA LIVE ORDER TRACKING BAR
// ==========================================

import { resolveAction } from '../core/action-registry.js';
import { getRuntimeSiteLang } from '../core/runtime-env.js';
import { escAttr, escHtml } from './orders-state.js';

const TRACK_CLIENT_TTL_MS = 5 * 60 * 1000;
const TRACK_REFRESH_COOLDOWN_MS = 15 * 1000;
const VALID_TTN_REGEX = /^\d{11,14}$/;

const trackingCache = new Map();
const inFlightTrackBatches = new Map();

const TRACK_I18N_FALLBACKS = Object.freeze({
    ua: {
        track_step_created: 'Оформлено',
        track_step_transit: 'В дорозі',
        track_step_arrived: 'У відділенні',
        track_step_postomat: 'У поштоматі',
        track_step_delivered: 'Отримано',
        track_step_returned: 'Повернення',
        track_status_created: 'Очікує передачі НП',
        track_status_transit: 'Посилка прямує до вас',
        track_status_arrived: 'Прибула, чекає отримання',
        track_status_delivered: 'Посилку успішно отримано',
        track_status_returned: 'Оформлено повернення',
        track_status_checking: 'Оновлення статусу НП...',
        track_eta_prefix: 'Орієнтовно:',
        track_delivered_prefix: 'Отримано:',
        track_refresh_title: 'Оновити статус доставки'
    },
    ru: {
        track_step_created: 'Оформлен',
        track_step_transit: 'В пути',
        track_step_arrived: 'В отделении',
        track_step_postomat: 'В почтомате',
        track_step_delivered: 'Получена',
        track_step_returned: 'Возврат',
        track_status_created: 'Ожидает передачи НП',
        track_status_transit: 'Посылка в пути',
        track_status_arrived: 'Прибыла, ждёт получения',
        track_status_delivered: 'Посылка успешно получена',
        track_status_returned: 'Оформлен возврат',
        track_status_checking: 'Обновление статуса НП...',
        track_eta_prefix: 'Ожидаемо:',
        track_delivered_prefix: 'Получена:',
        track_refresh_title: 'Обновить статус доставки'
    },
    en: {
        track_step_created: 'Created',
        track_step_transit: 'In transit',
        track_step_arrived: 'At branch',
        track_step_postomat: 'At locker',
        track_step_delivered: 'Delivered',
        track_step_returned: 'Returned',
        track_status_created: 'Awaiting dispatch',
        track_status_transit: 'Parcel on the way',
        track_status_arrived: 'Ready for pickup',
        track_status_delivered: 'Parcel delivered',
        track_status_returned: 'Return initiated',
        track_status_checking: 'Checking live status...',
        track_eta_prefix: 'Est. arrival:',
        track_delivered_prefix: 'Delivered:',
        track_refresh_title: 'Refresh delivery status'
    }
});

function trTrack(key) {
    const lang = getRuntimeSiteLang();
    const map = TRACK_I18N_FALLBACKS[lang] || TRACK_I18N_FALLBACKS.ua;
    const def = map[key] || TRACK_I18N_FALLBACKS.ua[key] || '';
    if (typeof i18next !== 'undefined' && typeof i18next.t === 'function') {
        return i18next.t(`orders_modal.${key}`, { defaultValue: def });
    }
    return def;
}

export function normalizeTtnDigits(raw) {
    return String(raw || '').replace(/[^\d]/g, '');
}

export function isTrackableNpTtn(raw) {
    return VALID_TTN_REGEX.test(normalizeTtnDigits(raw));
}

/**
 * Преобразует процент прогресса этапа (0..100 от бэкенда/fallback)
 * в координаты на 4-точечной линейке (0%, 33.333%, 66.666%, 100%).
 */
function mapStageToRoadPercent(stage, backendProgress) {
    switch (stage) {
        case 'created':
        case 'not_found':
        case 'pending':
            return 6;
        case 'in_transit': {
            const num = Number(backendProgress);
            if (Number.isFinite(num)) {
                if (num <= 40) return 26;
                if (num >= 70) return 56;
            }
            return 42;
        }
        case 'arrived':
            return 66.666;
        case 'delivered':
        case 'returned':
            return 100;
        default:
            return 42;
    }
}

export function getFallbackTrackingState(orderStatus) {
    const s = String(orderStatus || '').trim().toLowerCase();
    if (s.includes('возврат') || s.includes('поверн') || s.includes('return')) {
        return {
            stage: 'returned',
            roadPercent: 100,
            stepIndex: 3,
            isReturning: true,
            isMoving: false,
            isFinal: true
        };
    }
    if (s.includes('заверш') || s.includes('получен') || s.includes('доставлен') || s.includes('complet') || s.includes('deliver')) {
        return {
            stage: 'delivered',
            roadPercent: 100,
            stepIndex: 3,
            isReturning: false,
            isMoving: false,
            isFinal: true
        };
    }
    if (s.includes('відділ') || s.includes('отдел') || s.includes('пошт') || s.includes('почт') || s.includes('arriv')) {
        return {
            stage: 'arrived',
            roadPercent: 66.666,
            stepIndex: 2,
            isReturning: false,
            isMoving: false,
            isFinal: false
        };
    }
    if (s.includes('отправ') || s.includes('відправ') || s.includes('ship') || s.includes('дороз') || s.includes('пути')) {
        return {
            stage: 'in_transit',
            roadPercent: 42,
            stepIndex: 1,
            isReturning: false,
            isMoving: true,
            isFinal: false
        };
    }
    return {
        stage: 'created',
        roadPercent: 6,
        stepIndex: 0,
        isReturning: false,
        isMoving: false,
        isFinal: false
    };
}

export function resolveTrackingDisplayState(ttn, orderStatus, liveDoc = null) {
    const cleanTtn = normalizeTtnDigits(ttn);
    const cachedEntry = liveDoc || (cleanTtn ? trackingCache.get(cleanTtn)?.data : null) || null;
    const fallback = getFallbackTrackingState(orderStatus);

    if (!cachedEntry || !cachedEntry.stage) {
        const headlineMap = {
            created: trTrack('track_status_created'),
            in_transit: trTrack('track_status_transit'),
            arrived: trTrack('track_status_arrived'),
            delivered: trTrack('track_status_delivered'),
            returned: trTrack('track_status_returned')
        };
        return {
            ...fallback,
            hasLive: false,
            isPostomat: false,
            headline: headlineMap[fallback.stage] || trTrack('track_status_created'),
            liveDetail: '',
            routeText: '',
            dateText: ''
        };
    }

    let stage = cachedEntry.stage;
    // Если локально в Supabase заказ уже завершён, а кеш/НП ещё не обновился — доверяем финальному статусу заказа
    if (stage === 'not_found' || stage === 'pending') {
        stage = fallback.stage;
    }

    let stepIndex = 0;
    if (stage === 'in_transit') stepIndex = 1;
    else if (stage === 'arrived') stepIndex = 2;
    else if (stage === 'delivered' || stage === 'returned') stepIndex = 3;

    const headlineMap = {
        created: trTrack('track_status_created'),
        in_transit: trTrack('track_status_transit'),
        arrived: trTrack('track_status_arrived'),
        delivered: trTrack('track_status_delivered'),
        returned: trTrack('track_status_returned')
    };

    const routeParts = [cachedEntry.citySender, cachedEntry.cityRecipient].filter(Boolean);
    const routeText = routeParts.length === 2 && routeParts[0] !== routeParts[1]
        ? `${routeParts[0]} ➔ ${routeParts[1]}`
        : (routeParts[1] || routeParts[0] || '');

    const shortDate = (raw) => {
        const str = String(raw || '').trim();
        if (!str) return '';
        const match = str.match(/(\d{2})[-.](\d{2})[-.](\d{4})/);
        if (match) return `${match[1]}.${match[2]}`;
        const iso = str.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[3]}.${iso[2]}`;
        return str.split(' ')[0];
    };

    let dateText = '';
    if (stage === 'delivered' && cachedEntry.recipientDateTime) {
        dateText = `${trTrack('track_delivered_prefix')} ${shortDate(cachedEntry.recipientDateTime)}`;
    } else if (!cachedEntry.isFinal && cachedEntry.scheduledDeliveryDate) {
        dateText = `${trTrack('track_eta_prefix')} ${shortDate(cachedEntry.scheduledDeliveryDate)}`;
    }

    return {
        stage,
        roadPercent: mapStageToRoadPercent(stage, cachedEntry.progress),
        stepIndex,
        isReturning: Boolean(cachedEntry.isReturning || stage === 'returned'),
        isMoving: stage === 'in_transit',
        isFinal: Boolean(cachedEntry.isFinal || stage === 'delivered' || stage === 'returned'),
        isPostomat: Boolean(cachedEntry.isPostomat),
        hasLive: true,
        headline: cachedEntry.status || headlineMap[stage] || trTrack('track_status_created'),
        liveDetail: cachedEntry.status && cachedEntry.status !== headlineMap[stage] ? cachedEntry.status : '',
        routeText,
        dateText
    };
}

/**
 * Детализированный векторный SVG-грузовик службы доставки (адаптируется под цвет этапа и движение).
 */
export function buildDeliveryTruckSvg() {
    return `
        <svg class="np-truck-svg" viewBox="0 0 64 34" width="44" height="24" fill="none" aria-hidden="true">
            <g class="np-truck-speed-lines">
                <line x1="1" y1="11" x2="6" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.7" />
                <line x1="0" y1="15.5" x2="5" y2="15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.9" />
                <line x1="2" y1="20" x2="6" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />
            </g>
            <ellipse cx="34" cy="30.8" rx="22" ry="1.8" fill="rgba(0,0,0,0.65)" />
            <polygon class="np-truck-beam" points="58,18.5 64,15.5 64,23.5 58,21.5" fill="currentColor" opacity="0.22" />
            <g class="np-truck-chassis">
                <path d="M8 7C8 5.89543 8.89543 5 10 5H37C38.1046 5 39 5.89543 39 7V24H8V7Z" fill="#141816" stroke="currentColor" stroke-width="1.6" />
                <line x1="12" y1="10" x2="35" y2="10" stroke="currentColor" stroke-width="1" opacity="0.32" />
                <line x1="12" y1="14.5" x2="29" y2="14.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.75" />
                <line x1="12" y1="18.5" x2="23" y2="18.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5" />
                <rect x="31.5" y="13.5" width="4.2" height="5.2" rx="0.8" stroke="currentColor" stroke-width="1" opacity="0.55" />
                <path d="M39 10H48.2C49.6 10 50.9 10.65 51.75 11.75L56.5 17.8C57.15 18.62 57.5 19.63 57.5 20.68V24H39V10Z" fill="#181d1a" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                <path d="M41.5 12H47.6C48.5 12 49.4 12.45 50 13.25L53.2 17.4H41.5V12Z" fill="#09110d" stroke="currentColor" stroke-width="1.1" opacity="0.9" />
                <line x1="42.5" y1="13.2" x2="46.2" y2="16.2" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round" opacity="0.35" />
                <rect x="55" y="19" width="2.5" height="2.4" rx="0.7" fill="#fff6b3" />
                <line x1="7" y1="24" x2="58.5" y2="24" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </g>
            <g class="np-truck-wheel np-truck-wheel-rear" transform="translate(17 25.5)">
                <circle cx="0" cy="0" r="4.3" fill="#080808" stroke="currentColor" stroke-width="1.6" />
                <circle cx="0" cy="0" r="1.6" fill="currentColor" />
                <line x1="-2.2" y1="0" x2="2.2" y2="0" stroke="currentColor" stroke-width="0.9" opacity="0.7" />
                <line x1="0" y1="-2.2" x2="0" y2="2.2" stroke="currentColor" stroke-width="0.9" opacity="0.7" />
            </g>
            <g class="np-truck-wheel np-truck-wheel-front" transform="translate(49 25.5)">
                <circle cx="0" cy="0" r="4.3" fill="#080808" stroke="currentColor" stroke-width="1.6" />
                <circle cx="0" cy="0" r="1.6" fill="currentColor" />
                <line x1="-2.2" y1="0" x2="2.2" y2="0" stroke="currentColor" stroke-width="0.9" opacity="0.7" />
                <line x1="0" y1="-2.2" x2="0" y2="2.2" stroke="currentColor" stroke-width="0.9" opacity="0.7" />
            </g>
        </svg>
    `.trim();
}

function getStepLabels(state) {
    return [
        trTrack('track_step_created'),
        trTrack('track_step_transit'),
        state.isPostomat ? trTrack('track_step_postomat') : trTrack('track_step_arrived'),
        state.isReturning ? trTrack('track_step_returned') : trTrack('track_step_delivered')
    ];
}

function buildStepsHtml(state) {
    const labels = getStepLabels(state);
    return labels.map((label, idx) => {
        const isDone = idx < state.stepIndex || (state.isFinal && idx === state.stepIndex);
        const isActive = idx === state.stepIndex && !state.isFinal;
        const cls = [
            'np-step-label',
            isDone ? 'is-done' : '',
            isActive ? 'is-active' : '',
            state.isReturning && idx === 3 ? 'is-return' : ''
        ].filter(Boolean).join(' ');
        return `<span class="${cls}" data-step-index="${idx}">${escHtml(label)}</span>`;
    }).join('');
}

function buildDotsHtml(state) {
    const positions = ['0%', '33.333%', '66.666%', '100%'];
    return positions.map((pos, idx) => {
        const isDone = idx < state.stepIndex || (state.isFinal && idx === state.stepIndex);
        const isCurrent = idx === state.stepIndex;
        const cls = [
            'np-track-dot',
            isDone ? 'is-done' : '',
            isCurrent ? 'is-current' : '',
            state.isReturning && idx === 3 ? 'is-return' : ''
        ].filter(Boolean).join(' ');
        return `<span class="${cls}" style="left: ${pos};" data-dot-index="${idx}" aria-hidden="true"></span>`;
    }).join('');
}

/**
 * Рендерит HTML-разметку живой полосы трекинга с SVG-грузовиком внутри блока ТТН.
 */
export function buildOrderTrackingBarHtml(ttn, orderStatus) {
    const cleanTtn = normalizeTtnDigits(ttn);
    const state = resolveTrackingDisplayState(cleanTtn, orderStatus);
    const canLiveTrack = VALID_TTN_REGEX.test(cleanTtn);
    const roadPct = Math.max(0, Math.min(100, Number(state.roadPercent) || 6));
    const refreshTitle = escAttr(trTrack('track_refresh_title'));
    const routeHtml = state.routeText
        ? `<span class="np-track-route" title="${escAttr(state.routeText)}">${escHtml(state.routeText)}</span>`
        : '';
    const dateHtml = state.dateText
        ? `<span class="np-track-date">${escHtml(state.dateText)}</span>`
        : '';

    return `
        <div class="np-tracker"
             ${canLiveTrack ? `data-np-tracker-ttn="${escAttr(cleanTtn)}"` : ''}
             data-order-status="${escAttr(orderStatus || '')}"
             data-stage="${escAttr(state.stage)}"
             data-moving="${state.isMoving ? 'true' : 'false'}"
             style="--np-progress: ${roadPct}%;">
            <div class="np-track-meta">
                <div class="np-track-status-pill">
                    <span class="np-live-dot" aria-hidden="true"></span>
                    <span class="np-track-status-text">${escHtml(state.headline)}</span>
                </div>
                <div class="np-track-right">
                    ${routeHtml}
                    ${canLiveTrack ? `
                        <button type="button"
                                class="np-track-refresh-btn"
                                data-action="refresh-ttn-track"
                                data-ttn="${escAttr(cleanTtn)}"
                                title="${refreshTitle}"
                                aria-label="${refreshTitle}">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="np-track-stage" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(roadPct)}" aria-label="${escAttr(state.headline)}">
                <div class="np-track-rail-wrap">
                    <div class="np-track-rail">
                        <div class="np-track-fill"></div>
                        ${buildDotsHtml(state)}
                    </div>
                    <div class="np-track-truck" aria-hidden="true">
                        ${buildDeliveryTruckSvg()}
                    </div>
                </div>
            </div>
            <div class="np-track-steps">
                ${buildStepsHtml(state)}
            </div>
            ${dateHtml ? `<div class="np-track-sub">${dateHtml}</div>` : ''}
        </div>
    `.trim();
}

function applyTrackingStateToDom(trackerEl, ttn, liveDoc) {
    if (!trackerEl) return;
    const orderStatus = trackerEl.getAttribute('data-order-status') || '';
    const state = resolveTrackingDisplayState(ttn, orderStatus, liveDoc);
    const roadPct = Math.max(0, Math.min(100, Number(state.roadPercent) || 6));

    trackerEl.setAttribute('data-stage', state.stage);
    trackerEl.setAttribute('data-moving', state.isMoving ? 'true' : 'false');
    trackerEl.style.setProperty('--np-progress', `${roadPct}%`);

    const statusTextEl = trackerEl.querySelector('.np-track-status-text');
    if (statusTextEl) statusTextEl.textContent = state.headline;

    const stageEl = trackerEl.querySelector('.np-track-stage');
    if (stageEl) {
        stageEl.setAttribute('aria-valuenow', String(Math.round(roadPct)));
        stageEl.setAttribute('aria-label', state.headline);
    }

    const rightEl = trackerEl.querySelector('.np-track-right');
    if (rightEl) {
        let routeEl = rightEl.querySelector('.np-track-route');
        if (state.routeText) {
            if (!routeEl) {
                routeEl = document.createElement('span');
                routeEl.className = 'np-track-route';
                rightEl.prepend(routeEl);
            }
            routeEl.textContent = state.routeText;
            routeEl.setAttribute('title', state.routeText);
        } else if (routeEl) {
            routeEl.remove();
        }
    }

    const railEl = trackerEl.querySelector('.np-track-rail');
    if (railEl) {
        railEl.querySelectorAll('.np-track-dot').forEach((dotEl, idx) => {
            const isDone = idx < state.stepIndex || (state.isFinal && idx === state.stepIndex);
            const isCurrent = idx === state.stepIndex;
            dotEl.classList.toggle('is-done', isDone);
            dotEl.classList.toggle('is-current', isCurrent);
            dotEl.classList.toggle('is-return', Boolean(state.isReturning && idx === 3));
        });
    }

    const stepsEl = trackerEl.querySelector('.np-track-steps');
    if (stepsEl) {
        stepsEl.innerHTML = buildStepsHtml(state);
    }

    let subEl = trackerEl.querySelector('.np-track-sub');
    if (state.dateText) {
        if (!subEl) {
            subEl = document.createElement('div');
            subEl.className = 'np-track-sub';
            trackerEl.appendChild(subEl);
        }
        subEl.innerHTML = `<span class="np-track-date">${escHtml(state.dateText)}</span>`;
    } else if (subEl) {
        subEl.remove();
    }
}

async function postTrackBatch(ttns, refresh = false) {
    const payload = { ttns, refresh: Boolean(refresh) };
    const apiClient = (typeof window !== 'undefined' && window.apiClient && typeof window.apiClient.post === 'function')
        ? window.apiClient
        : null;
    if (apiClient) {
        return apiClient.post('/api/np-track', payload, { timeout: 9000, dedupe: !refresh });
    }
    if (typeof fetch !== 'function') return null;
    const baseUrl = (typeof window !== 'undefined' && ((window.ENV && window.ENV.API_BASE_URL) || window.BACKEND_URL)) || 'https://nisha-api.onrender.com';
    const cleanBase = String(baseUrl).replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/api/np-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    return res.json();
}

/**
 * Догружает актуальные статусы Новой Почты для всех видимых ТТН в модальном окне заказов
 * и плавно переводит SVG-грузовик к актуальному этапу.
 */
export async function hydrateVisibleOrderTracking(options = {}) {
    if (typeof document === 'undefined') return {};
    const trackerNodes = Array.from(document.querySelectorAll('.np-tracker[data-np-tracker-ttn]'));
    if (trackerNodes.length === 0) return {};

    const now = Date.now();
    const forceRefresh = Boolean(options.refresh);
    const filterTtns = Array.isArray(options.ttns) ? new Set(options.ttns.map(normalizeTtnDigits)) : null;

    const toFetch = [];
    const seen = new Set();

    for (const node of trackerNodes) {
        const ttn = normalizeTtnDigits(node.getAttribute('data-np-tracker-ttn'));
        if (!VALID_TTN_REGEX.test(ttn)) continue;
        if (filterTtns && !filterTtns.has(ttn)) continue;

        const cached = trackingCache.get(ttn);
        if (cached && cached.data) {
            const age = now - cached.timestamp;
            const skipCached = forceRefresh ? (age >= TRACK_REFRESH_COOLDOWN_MS && !cached.data.isFinal) : (age >= TRACK_CLIENT_TTL_MS);
            if (!skipCached) {
                applyTrackingStateToDom(node, ttn, cached.data);
                continue;
            }
        }

        if (!seen.has(ttn)) {
            seen.add(ttn);
            toFetch.push(ttn);
        }
    }

    if (toFetch.length === 0) return {};

    const batchKey = `${forceRefresh ? 'R:' : ''}${toFetch.slice().sort().join(',')}`;
    let reqPromise = inFlightTrackBatches.get(batchKey);
    if (!reqPromise) {
        reqPromise = postTrackBatch(toFetch, forceRefresh)
            .then((res) => {
                const map = res && res.tracking && typeof res.tracking === 'object' ? res.tracking : {};
                const ts = Date.now();
                for (const [k, doc] of Object.entries(map)) {
                    const cleanKey = normalizeTtnDigits(k);
                    if (cleanKey && doc) {
                        trackingCache.set(cleanKey, { timestamp: ts, data: doc });
                    }
                }
                return map;
            })
            .catch(() => ({}))
            .finally(() => {
                if (inFlightTrackBatches.get(batchKey) === reqPromise) {
                    inFlightTrackBatches.delete(batchKey);
                }
            });
        inFlightTrackBatches.set(batchKey, reqPromise);
    }

    const liveMap = await reqPromise;
    if (typeof document !== 'undefined') {
        const activeNodes = document.querySelectorAll('.np-tracker[data-np-tracker-ttn]');
        activeNodes.forEach((node) => {
            const ttn = normalizeTtnDigits(node.getAttribute('data-np-tracker-ttn'));
            if (liveMap[ttn]) {
                applyTrackingStateToDom(node, ttn, liveMap[ttn]);
            }
        });
    }
    return liveMap;
}

export async function refreshOrderTracking(ttn, btnEl) {
    const cleanTtn = normalizeTtnDigits(ttn);
    if (!VALID_TTN_REGEX.test(cleanTtn)) return;

    const hapticFn = resolveAction('triggerHaptic');
    if (hapticFn) hapticFn('light');

    if (btnEl && btnEl.classList) {
        btnEl.classList.add('is-spinning');
        btnEl.disabled = true;
    }
    try {
        await hydrateVisibleOrderTracking({ ttns: [cleanTtn], refresh: true });
    } finally {
        if (btnEl && btnEl.classList) {
            setTimeout(() => {
                btnEl.classList.remove('is-spinning');
                btnEl.disabled = false;
            }, 350);
        }
    }
}

export function clearTrackingCacheForTests() {
    trackingCache.clear();
    inFlightTrackBatches.clear();
}
