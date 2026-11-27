// @ts-check
// ==========================================
// NISHA UI — MOBILE BACK GESTURE & OVERLAY HISTORY STACK
// ==========================================
// Intercepts Android/Chrome/PWA edge-swipe & hardware Back button via History API
// so closing PhotoSwipe zoom, modals, cart drawer, mobile filters, or search
// smoothly dismisses the topmost overlay instead of exiting the PWA.

/** @type {Array<{ key: string, type: string, id: string, onBackClose: Function }>} */
const _backStack = [];
let _pushedDepth = 0;
let _ignorePopstateCount = 0;
let _ignoreResetGen = 0;
/** @type {ReturnType<typeof setTimeout> | null} */
let _ignoreResetTimer = null;
let _reconcilePending = false;
let _reconcileGen = 0;
let _popstateListenerBound = false;

function hasUsableHistoryApi() {
    return (
        typeof window !== 'undefined' &&
        window.history &&
        typeof window.history.pushState === 'function' &&
        typeof window.history.go === 'function'
    );
}

function clearIgnoreResetTimer() {
    if (_ignoreResetTimer !== null) {
        clearTimeout(_ignoreResetTimer);
        _ignoreResetTimer = null;
    }
}

function scheduleIgnoreResetFallback() {
    const gen = ++_ignoreResetGen;
    clearIgnoreResetTimer();
    _ignoreResetTimer = setTimeout(() => {
        if (gen !== _ignoreResetGen) return;
        _ignoreResetTimer = null;
        _ignorePopstateCount = 0;
    }, 500);
}

function cancelReconcileTimer() {
    _reconcileGen += 1;
    _reconcilePending = false;
}

/** @param {number} targetDepth */
function pushSyntheticHistoryEntry(targetDepth) {
    if (!hasUsableHistoryApi()) return false;
    try {
        const curState = (window.history.state && typeof window.history.state === 'object')
            ? window.history.state
            : {};
        const href = (window.location && window.location.href) ? window.location.href : '';
        window.history.pushState({ ...curState, nishaLayerDepth: targetDepth }, '', href);
        return true;
    } catch {
        return false;
    }
}

function scheduleHistoryPopReconcile() {
    if (_reconcilePending) return;
    _reconcilePending = true;
    const gen = ++_reconcileGen;
    queueMicrotask(() => {
        if (gen !== _reconcileGen) return;
        _reconcilePending = false;
        if (_pushedDepth > _backStack.length && hasUsableHistoryApi()) {
            const delta = _backStack.length - _pushedDepth; // negative integer
            _pushedDepth = _backStack.length;
            _ignorePopstateCount += 1;
            scheduleIgnoreResetFallback();
            try {
                if (delta === -1 && typeof window.history.back === 'function') {
                    window.history.back();
                } else {
                    window.history.go(delta);
                }
            } catch {
                _ignorePopstateCount = Math.max(0, _ignorePopstateCount - 1);
            }
        }
    });
}

export function initBackGestureNavigation() {
    if (_popstateListenerBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
        return;
    }
    _popstateListenerBound = true;
    window.addEventListener('popstate', handleBackPopstate);
}

/**
 * Registers an open overlay/drawer onto the LIFO back-gesture stack
 * and pushes a synthetic history state if needed.
 * @param {{ key: string, type: string, id?: string, onBackClose: Function }} entry
 */
export function pushBackLayer(entry) {
    if (!entry || !entry.key || typeof entry.onBackClose !== 'function') return;
    initBackGestureNavigation();
    cancelReconcileTimer();

    const existingIdx = _backStack.findIndex(item => item.key === entry.key);
    if (existingIdx !== -1) {
        _backStack.splice(existingIdx, 1);
    }
    _backStack.push({
        key: String(entry.key),
        type: String(entry.type || 'modal'),
        id: String(entry.id || entry.key),
        onBackClose: entry.onBackClose
    });

    while (_pushedDepth < _backStack.length) {
        if (!pushSyntheticHistoryEntry(_pushedDepth + 1)) break;
        _pushedDepth += 1;
    }
}

/**
 * Removes an overlay closed via UI controls (`X`, backdrop, Escape, swipe-down)
 * and rolls back its synthetic history slot cleanly on the next tick.
 * @param {string} key
 */
export function removeBackLayerFromUI(key) {
    if (!key) return;
    const idx = _backStack.findIndex(item => item.key === key);
    if (idx === -1) return;
    _backStack.splice(idx, 1);
    if (_pushedDepth > _backStack.length) {
        scheduleHistoryPopReconcile();
    }
}

/**
 * Handles browser `popstate` events triggered by mobile edge-swipe or Back button.
 * @param {PopStateEvent} [event]
 */
export function handleBackPopstate(event) {
    if (_ignorePopstateCount > 0) {
        _ignorePopstateCount -= 1;
        if (_ignorePopstateCount === 0) {
            _ignoreResetGen += 1;
            clearIgnoreResetTimer();
        }
        return;
    }

    // Защита от отложенного popstate после закрытия верхнего оверлея кнопкой X (например, PhotoSwipe):
    // если глубина history.state уже совпадает с текущей глубиной стека (или выше), это наш собственный rollback.
    const stateObj = (event && event.state && typeof event.state === 'object')
        ? event.state
        : ((typeof window !== 'undefined' && window.history && window.history.state && typeof window.history.state === 'object')
            ? window.history.state
            : null);
    if (stateObj && typeof stateObj.nishaLayerDepth === 'number' && stateObj.nishaLayerDepth >= _backStack.length) {
        _pushedDepth = Math.min(_pushedDepth, stateObj.nishaLayerDepth);
        return;
    }

    _pushedDepth = Math.max(0, _pushedDepth - 1);

    if (_backStack.length === 0) return;
    const top = _backStack.pop();
    if (!top || typeof top.onBackClose !== 'function') return;

    try {
        top.onBackClose();
    } catch (err) {
        console.warn('[BackGesture] Layer close handler error:', err);
    }
}

/**
 * Attaches PhotoSwipe lightbox lifecycle hooks so edge-swipe / Back closes zoomed photos smoothly.
 * @param {any} lightbox - PhotoSwipeLightbox instance
 */
export function bindPhotoSwipeBackGesture(lightbox) {
    if (!lightbox || typeof lightbox.on !== 'function' || lightbox._nishaBackBound) return;
    lightbox._nishaBackBound = true;

    const layerKey = 'pswp:active';
    const closeHandler = () => {
        if (lightbox.pswp && typeof lightbox.pswp.close === 'function') {
            lightbox._nishaClosedByBack = true;
            lightbox.pswp.close();
        }
    };

    lightbox.on('afterInit', () => {
        lightbox._nishaClosedByBack = false;
        pushBackLayer({
            key: layerKey,
            type: 'pswp',
            id: 'active',
            onBackClose: closeHandler
        });
    });

    lightbox.on('close', () => {
        if (typeof window !== 'undefined') {
            window._nishaPswpClosedAt = Date.now();
        }
        if (!lightbox._nishaClosedByBack) {
            removeBackLayerFromUI(layerKey);
        }
        lightbox._nishaClosedByBack = false;
    });
}

/**
 * Checks current stack snapshot (for diagnostics and unit tests).
 * @returns {string[]}
 */
export function getActiveBackLayerKeys() {
    return _backStack.map(item => item.key);
}

/**
 * Resets internal stack/depth state (for tests only).
 */
export function _resetBackGestureStateForTests() {
    _backStack.length = 0;
    _pushedDepth = 0;
    _ignorePopstateCount = 0;
    _ignoreResetGen += 1;
    clearIgnoreResetTimer();
    cancelReconcileTimer();
}

initBackGestureNavigation();
