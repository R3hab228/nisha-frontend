import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readProjectCss } from './helpers/readProjectCss.js';
import { readOrdersSource } from './helpers/readOrdersSource.js';
import {
    normalizeTtnDigits,
    isTrackableNpTtn,
    getFallbackTrackingState,
    resolveTrackingDisplayState,
    buildDeliveryTruckSvg,
    buildOrderTrackingBarHtml,
    hydrateVisibleOrderTracking,
    refreshOrderTracking,
    clearTrackingCacheForTests
} from '../js/orders/orders-tracking.js';
import '../js/orders/orders.js';
import { hasAction, resolveAction } from '../js/core/action-registry.js';

function createTrackerDomMock({ ttn = '20483289403202', orderStatus = 'Отправлен' } = {}) {
    const attrs = new Map([
        ['data-np-tracker-ttn', ttn],
        ['data-order-status', orderStatus],
        ['data-stage', 'created'],
        ['data-moving', 'false']
    ]);
    const styleProps = new Map();
    const statusTextEl = { textContent: '' };
    const stageAttrs = new Map();
    const stageEl = {
        setAttribute: (k, v) => stageAttrs.set(k, String(v)),
        getAttribute: (k) => stageAttrs.get(k) || null
    };
    let routeEl = null;
    const rightEl = {
        querySelector: (sel) => (sel === '.np-track-route' ? routeEl : null),
        prepend: (node) => { routeEl = node; }
    };
    const dotNodes = [0, 1, 2, 3].map(() => {
        const classes = new Set(['np-track-dot']);
        return {
            classList: {
                toggle: (cls, force) => (force ? classes.add(cls) : classes.delete(cls)),
                contains: (cls) => classes.has(cls)
            }
        };
    });
    const railEl = {
        querySelectorAll: (sel) => (sel === '.np-track-dot' ? dotNodes : [])
    };
    const stepsEl = { innerHTML: '' };
    let subEl = null;

    const trackerEl = {
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        setAttribute: (k, v) => attrs.set(k, String(v)),
        style: {
            setProperty: (k, v) => styleProps.set(k, String(v)),
            getPropertyValue: (k) => styleProps.get(k) || ''
        },
        querySelector: (sel) => {
            if (sel === '.np-track-status-text') return statusTextEl;
            if (sel === '.np-track-stage') return stageEl;
            if (sel === '.np-track-right') return rightEl;
            if (sel === '.np-track-rail') return railEl;
            if (sel === '.np-track-steps') return stepsEl;
            if (sel === '.np-track-sub') return subEl;
            return null;
        },
        appendChild: (node) => { subEl = node; },
        _getRouteEl: () => routeEl,
        _getSubEl: () => subEl,
        _dotNodes: dotNodes,
        _statusTextEl: statusTextEl,
        _stageEl: stageEl,
        _stepsEl: stepsEl
    };

    const docMock = {
        querySelectorAll: (sel) => (sel === '.np-tracker[data-np-tracker-ttn]' ? [trackerEl] : []),
        createElement: (tag) => {
            const elAttrs = new Map();
            return {
                tagName: tag.toUpperCase(),
                className: '',
                textContent: '',
                innerHTML: '',
                setAttribute: (k, v) => elAttrs.set(k, String(v)),
                getAttribute: (k) => elAttrs.get(k) || null,
                remove: () => {
                    if (routeEl && routeEl === this) routeEl = null;
                }
            };
        }
    };

    return { trackerEl, docMock };
}

describe('Nova Poshta Live SVG Truck Tracking Bar', () => {
    const prevDoc = globalThis.document;
    const prevApiClient = globalThis.window?.apiClient;

    beforeEach(() => {
        clearTrackingCacheForTests();
        globalThis.window = globalThis.window || globalThis;
    });

    afterEach(() => {
        clearTrackingCacheForTests();
        vi.restoreAllMocks();
        globalThis.document = prevDoc;
        if (globalThis.window) {
            if (prevApiClient !== undefined) globalThis.window.apiClient = prevApiClient;
            else delete globalThis.window.apiClient;
        }
    });

    it('normalizes TTN digits and validates trackable 11-14 digit numbers', () => {
        expect(normalizeTtnDigits('2048 3289-4032 02')).toBe('20483289403202');
        expect(isTrackableNpTtn('2048 3289 4032 02')).toBe(true);
        expect(isTrackableNpTtn('59000123456789')).toBe(true);
        expect(isTrackableNpTtn('12345')).toBe(false);
        expect(isTrackableNpTtn('')).toBe(false);
    });

    it('derives immediate fallback states from order status before live API completes', () => {
        expect(getFallbackTrackingState('В обработке')).toMatchObject({ stage: 'created', stepIndex: 0, roadPercent: 6, isMoving: false });
        expect(getFallbackTrackingState('Принят')).toMatchObject({ stage: 'created', stepIndex: 0, roadPercent: 6, isMoving: false });
        expect(getFallbackTrackingState('Отправлен')).toMatchObject({ stage: 'in_transit', stepIndex: 1, roadPercent: 42, isMoving: true });
        expect(getFallbackTrackingState('Завершен')).toMatchObject({ stage: 'delivered', stepIndex: 3, roadPercent: 100, isFinal: true });
        expect(getFallbackTrackingState('Возврат')).toMatchObject({ stage: 'returned', stepIndex: 3, roadPercent: 100, isReturning: true, isFinal: true });
    });

    it('resolves live Nova Poshta stage, postomat step label, route, and short dates cleanly', () => {
        const transit = resolveTrackingDisplayState('20483289403202', 'Отправлен', {
            stage: 'in_transit',
            progress: 74,
            status: 'У місті Одеса',
            citySender: 'Київ',
            cityRecipient: 'Одеса',
            scheduledDeliveryDate: '25-11-2026 18:00:00'
        });
        expect(transit.stage).toBe('in_transit');
        expect(transit.roadPercent).toBe(56);
        expect(transit.stepIndex).toBe(1);
        expect(transit.isMoving).toBe(true);
        expect(transit.routeText).toBe('Київ ➔ Одеса');
        expect(transit.dateText).toContain('25.11');

        const arrivedPostomat = resolveTrackingDisplayState('20483289403202', 'Отправлен', {
            stage: 'arrived',
            progress: 88,
            isPostomat: true,
            status: 'Прибув у поштомат',
            citySender: 'Київ',
            cityRecipient: 'Київ'
        });
        expect(arrivedPostomat.stage).toBe('arrived');
        expect(arrivedPostomat.roadPercent).toBe(66.666);
        expect(arrivedPostomat.stepIndex).toBe(2);
        expect(arrivedPostomat.isPostomat).toBe(true);
        expect(arrivedPostomat.isMoving).toBe(false);
        expect(arrivedPostomat.routeText).toBe('Київ');
    });

    it('renders detailed SVG delivery truck, 4 checkpoints, progressbar ARIA, and escapes XSS', () => {
        const svg = buildDeliveryTruckSvg();
        expect(svg).toContain('class="np-truck-svg"');
        expect(svg).toContain('class="np-truck-wheel np-truck-wheel-rear"');
        expect(svg).toContain('class="np-truck-wheel np-truck-wheel-front"');
        expect(svg).toContain('class="np-truck-speed-lines"');

        const html = buildOrderTrackingBarHtml('20483289403202', 'Отправлен');
        expect(html).toContain('data-np-tracker-ttn="20483289403202"');
        expect(html).toContain('data-moving="true"');
        expect(html).toContain('role="progressbar"');
        expect(html).toContain('class="np-track-truck"');
        expect(html).toContain('data-action="refresh-ttn-track"');
        expect((html.match(/class="np-track-dot/g) || [])).toHaveLength(4);
        expect((html.match(/class="np-step-label/g) || [])).toHaveLength(4);

        const safePending = buildOrderTrackingBarHtml('', '"><img src=x onerror=alert(1)>');
        expect(safePending).not.toContain('<img');
        expect(safePending).not.toContain('data-action="refresh-ttn-track"');
    });

    it('batches visible TTNs via /api/np-track, updates truck DOM in place, and supports manual refresh', async () => {
        const { trackerEl, docMock } = createTrackerDomMock({
            ttn: '20483289403202',
            orderStatus: 'Принят'
        });
        globalThis.document = docMock;

        const postMock = vi.fn().mockResolvedValueOnce({
            success: true,
            tracking: {
                '20483289403202': {
                    number: '20483289403202',
                    stage: 'arrived',
                    progress: 88,
                    isPostomat: false,
                    status: 'Прибув у відділення №12',
                    citySender: 'Київ',
                    cityRecipient: 'Львів',
                    scheduledDeliveryDate: '26-11-2026'
                }
            }
        });
        window.apiClient = { post: postMock };

        await hydrateVisibleOrderTracking();

        expect(postMock).toHaveBeenCalledTimes(1);
        expect(postMock).toHaveBeenCalledWith(
            '/api/np-track',
            { ttns: ['20483289403202'], refresh: false },
            { timeout: 9000, dedupe: true }
        );
        expect(trackerEl.getAttribute('data-stage')).toBe('arrived');
        expect(trackerEl.getAttribute('data-moving')).toBe('false');
        expect(trackerEl.style.getPropertyValue('--np-progress')).toBe('66.666%');
        expect(trackerEl._statusTextEl.textContent).toBe('Прибув у відділення №12');
        expect(trackerEl._getRouteEl()?.textContent).toBe('Київ ➔ Львів');
        expect(trackerEl._dotNodes[2].classList.contains('is-current')).toBe(true);
        expect(trackerEl._dotNodes[1].classList.contains('is-done')).toBe(true);

        // Subsequent hydration within client TTL uses cache and avoids duplicate network calls
        await hydrateVisibleOrderTracking();
        expect(postMock).toHaveBeenCalledTimes(1);

        // Manual refresh within 15s cooldown also respects rate limit cleanly
        await refreshOrderTracking('20483289403202', null);
        expect(postMock).toHaveBeenCalledTimes(1);
    });

    it('registers refreshOrderTracking in ActionRegistry, lazy-orders CSS, and delegation', () => {
        expect(hasAction('refreshOrderTracking')).toBe(true);
        expect(typeof resolveAction('refreshOrderTracking')).toBe('function');

        const ordersSrc = readOrdersSource();
        const cssSrc = readProjectCss();
        expect(ordersSrc).toContain('buildOrderTrackingBarHtml');
        expect(ordersSrc).toContain('hydrateVisibleOrderTracking');
        expect(cssSrc).toContain('.np-tracker');
        expect(cssSrc).toContain('.np-track-truck');
        expect(cssSrc).toContain('@keyframes npWheelSpin');
    });
});
