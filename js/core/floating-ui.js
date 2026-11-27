// @ts-check
// ==========================================
// NISHA CORE — SMART VIEWPORT-AWARE POSITIONING (@floating-ui/dom)
// Позиционирует тултипы и выпадающие меню с автопереворотом (flip) и сдвигом (shift)
// строго без изменения размеров, отступов и визуального стиля самих окон.
// ==========================================

import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';
import { registerActions } from './action-registry.js';

/** @type {WeakMap<HTMLElement, () => void>} */
const _activeCleanups = new WeakMap();

/** @type {WeakMap<HTMLElement, number>} */
const _cursorTokens = new WeakMap();

/** @type {WeakMap<HTMLElement, Record<string, string>>} */
const _savedInlineStyles = new WeakMap();

const SAVED_STYLE_KEYS = /** @type {const} */ ([
    'top',
    'bottom',
    'left',
    'right',
    'marginTop',
    'marginBottom'
]);

/**
 * Создаёт виртуальный якорь для @floating-ui/dom в координатах курсора (clientX, clientY).
 * @param {number} clientX
 * @param {number} clientY
 */
function createCursorVirtualElement(clientX, clientY) {
    return {
        getBoundingClientRect() {
            return {
                width: 0,
                height: 0,
                x: clientX,
                y: clientY,
                top: clientY,
                left: clientX,
                right: clientX,
                bottom: clientY
            };
        }
    };
}

/**
 * Синхронный fallback-расчёт позиции у курсора (для мгновенного первого кадра и сред без layout вроде JSDOM).
 * @param {HTMLElement} floatingEl
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} flipPadding
 * @param {number} shiftPadding
 */
function applySyncCursorPosition(floatingEl, clientX, clientY, offsetX, offsetY, flipPadding, shiftPadding) {
    const winW = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    const winH = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const w = floatingEl.offsetWidth || 190;
    const h = floatingEl.offsetHeight || 120;

    let x = clientX + offsetX;
    let y = clientY + offsetY;

    if (x + w > winW - flipPadding) {
        x = clientX - w - offsetX;
    }
    if (y + h > winH - flipPadding) {
        y = clientY - h - offsetY;
    }
    if (x < shiftPadding) x = shiftPadding;
    if (y < shiftPadding) y = shiftPadding;

    floatingEl.style.left = `${Math.round(x)}px`;
    floatingEl.style.top = `${Math.round(y)}px`;
}

/**
 * Отменяет любые ожидающие асинхронные расчёты позиции у курсора (вызывается при скрытии тултипа).
 * @param {HTMLElement | null | undefined} floatingEl
 */
export function cancelCursorPosition(floatingEl) {
    if (!floatingEl) return;
    _cursorTokens.set(floatingEl, (_cursorTokens.get(floatingEl) || 0) + 1);
}

/**
 * Позиционирует fixed-тултип (например `#measurementsTooltip`) у курсора с помощью `@floating-ui/dom`.
 * Никогда не меняет ширину/высоту/масштаб тултипа — только `left` и `top`.
 * @param {HTMLElement | null} floatingEl
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ offsetX?: number, offsetY?: number, flipPadding?: number, shiftPadding?: number }} [options={}]
 * @returns {Promise<{ x: number, y: number, placement: string } | null>}
 */
export async function positionAtCursor(floatingEl, clientX, clientY, options = {}) {
    if (!floatingEl || !floatingEl.style) return null;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

    const offsetX = Number.isFinite(options.offsetX) ? Number(options.offsetX) : 16;
    const offsetY = Number.isFinite(options.offsetY) ? Number(options.offsetY) : 16;
    const flipPadding = Number.isFinite(options.flipPadding) ? Number(options.flipPadding) : 12;
    const shiftPadding = Number.isFinite(options.shiftPadding) ? Number(options.shiftPadding) : 10;

    // 1. Мгновенное синхронное позиционирование, чтобы тултип не прыгал из (-9999, -9999)
    applySyncCursorPosition(floatingEl, clientX, clientY, offsetX, offsetY, flipPadding, shiftPadding);

    // 2. Уточнение через @floating-ui/dom (если есть реальный DOM layout)
    if (typeof floatingEl.getBoundingClientRect !== 'function') {
        return null;
    }

    const token = (_cursorTokens.get(floatingEl) || 0) + 1;
    _cursorTokens.set(floatingEl, token);

    try {
        const virtualRef = createCursorVirtualElement(clientX, clientY);
        const result = await computePosition(virtualRef, floatingEl, {
            strategy: 'fixed',
            placement: 'bottom-start',
            middleware: [
                offset({ mainAxis: offsetY, crossAxis: offsetX }),
                flip({
                    padding: flipPadding,
                    fallbackAxisSideDirection: 'start'
                }),
                shift({ padding: shiftPadding })
            ]
        });

        // Игнорируем устаревший асинхронный расчёт, если курсор уже сдвинулся или тултип скрывается
        const isHidden = floatingEl.style.display === 'none' ||
            (floatingEl.classList && !floatingEl.classList.contains('visible'));
        if (_cursorTokens.get(floatingEl) !== token || isHidden) {
            return null;
        }

        if (Number.isFinite(result.x) && Number.isFinite(result.y)) {
            const rect = floatingEl.getBoundingClientRect();
            // В тестовых средах без layout (width=0 & height=0) оставляем синхронный fallback
            if (rect && (rect.width > 0 || rect.height > 0)) {
                floatingEl.style.left = `${Math.round(result.x)}px`;
                floatingEl.style.top = `${Math.round(result.y)}px`;
            }
            if (floatingEl.dataset) {
                floatingEl.dataset.floatingPlacement = result.placement;
            }
            return { x: result.x, y: result.y, placement: result.placement };
        }
    } catch {}

    return null;
}

/**
 * Снимает активное `autoUpdate`-позиционирование и возвращает исходные inline-стили элемента.
 * @param {HTMLElement | null | undefined} floatingEl
 */
export function detachFloatingPopover(floatingEl) {
    if (!floatingEl) return;

    const cleanup = _activeCleanups.get(floatingEl);
    if (typeof cleanup === 'function') {
        try { cleanup(); } catch {}
        _activeCleanups.delete(floatingEl);
    }

    const saved = _savedInlineStyles.get(floatingEl);
    if (saved && floatingEl.style) {
        SAVED_STYLE_KEYS.forEach((prop) => {
            floatingEl.style[prop] = saved[prop] || '';
        });
        _savedInlineStyles.delete(floatingEl);
    }

    if (floatingEl.dataset && 'floatingPlacement' in floatingEl.dataset) {
        delete floatingEl.dataset.floatingPlacement;
    }
}

/**
 * Подключает `@floating-ui/dom` (`computePosition` + `autoUpdate`) к выпадающему меню/поповеру.
 * Автоматически переворачивает (`flip`) и сдвигает (`shift`) элемент внутри границ экрана/модалки,
 * не изменяя его ширину, высоту и CSS-оформление.
 * При `verticalOnly: true` меняются только `top`/`bottom` — `left`/`right` и ширина (`left: 0; right: 0`) остаются на 100% нетронутыми.
 * @param {HTMLElement | null | undefined} referenceEl
 * @param {HTMLElement | null | undefined} floatingEl
 * @param {{
 *   placement?: import('@floating-ui/dom').Placement,
 *   strategy?: 'absolute' | 'fixed',
 *   offsetPx?: number,
 *   padding?: number,
 *   boundary?: Element | Element[],
 *   verticalOnly?: boolean
 * }} [options={}]
 * @returns {() => void}
 */
export function attachFloatingPopover(referenceEl, floatingEl, options = {}) {
    if (!referenceEl || !floatingEl || !floatingEl.style) {
        return () => {};
    }

    detachFloatingPopover(floatingEl);

    // Сохраняем исходные inline-стили для чистого восстановления при закрытии
    /** @type {Record<string, string>} */
    const snapshot = {};
    SAVED_STYLE_KEYS.forEach((prop) => {
        snapshot[prop] = floatingEl.style[prop] || '';
    });
    _savedInlineStyles.set(floatingEl, snapshot);

    const placement = options.placement || 'bottom-start';
    const strategy = options.strategy || 'absolute';
    const offsetPx = Number.isFinite(options.offsetPx) ? Number(options.offsetPx) : 4;
    const padding = Number.isFinite(options.padding) ? Number(options.padding) : 8;
    const boundary = options.boundary;
    const verticalOnly = Boolean(options.verticalOnly);

    let disposed = false;

    const update = () => {
        if (disposed || !referenceEl.isConnected || !floatingEl.isConnected) return;
        const middleware = [
            offset(offsetPx),
            flip({ padding, ...(boundary ? { boundary } : {}) }),
            ...(verticalOnly ? [] : [shift({ padding, ...(boundary ? { boundary } : {}) })])
        ];

        computePosition(referenceEl, floatingEl, {
            strategy,
            placement,
            middleware
        }).then((res) => {
            if (disposed || !floatingEl.style) return;
            const refRect = typeof referenceEl.getBoundingClientRect === 'function'
                ? referenceEl.getBoundingClientRect()
                : null;
            // В моках без реального DOM layout (0x0) оставляем штатный CSS
            if (!refRect || (refRect.width === 0 && refRect.height === 0)) return;

            if (Number.isFinite(res.x) && Number.isFinite(res.y)) {
                floatingEl.style.top = `${Math.round(res.y)}px`;
                floatingEl.style.bottom = 'auto';
                floatingEl.style.marginTop = '0';
                floatingEl.style.marginBottom = '0';
                if (!verticalOnly) {
                    floatingEl.style.left = `${Math.round(res.x)}px`;
                    floatingEl.style.right = 'auto';
                }
                if (floatingEl.dataset) {
                    floatingEl.dataset.floatingPlacement = res.placement;
                }
            }
        }).catch(() => {});
    };

    let stopAutoUpdate = () => {};
    try {
        if (typeof ResizeObserver === 'function' && typeof window !== 'undefined') {
            stopAutoUpdate = autoUpdate(referenceEl, floatingEl, update, {
                ancestorScroll: true,
                ancestorResize: true,
                elementResize: true
            });
        } else {
            update();
        }
    } catch {
        update();
    }

    const cleanup = () => {
        disposed = true;
        try { stopAutoUpdate(); } catch {}
    };
    _activeCleanups.set(floatingEl, cleanup);

    return () => detachFloatingPopover(floatingEl);
}

if (typeof window !== 'undefined') {
    window.positionAtCursor = positionAtCursor;
    window.cancelCursorPosition = cancelCursorPosition;
    window.attachFloatingPopover = attachFloatingPopover;
    window.detachFloatingPopover = detachFloatingPopover;
}

registerActions({
    positionAtCursor,
    cancelCursorPosition,
    attachFloatingPopover,
    detachFloatingPopover
});
