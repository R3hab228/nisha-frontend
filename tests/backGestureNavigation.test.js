import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    _resetBackGestureStateForTests,
    bindPhotoSwipeBackGesture,
    getActiveBackLayerKeys,
    handleBackPopstate,
    pushBackLayer,
    removeBackLayerFromUI
} from '../js/ui/back-gesture.js';

describe('Mobile Back Gesture & Overlay History Stack (js/ui/back-gesture.js)', () => {
    let pushStateSpy;
    let backSpy;
    let goSpy;

    beforeEach(() => {
        _resetBackGestureStateForTests();
        pushStateSpy = vi.fn();
        backSpy = vi.fn();
        goSpy = vi.fn();
        vi.stubGlobal('window', {
            location: { href: 'https://www.nisha-store.shop/' },
            history: {
                state: null,
                pushState: pushStateSpy,
                back: backSpy,
                go: goSpy
            },
            addEventListener: vi.fn()
        });
    });

    afterEach(() => {
        _resetBackGestureStateForTests();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('closes PhotoSwipe first, then modal on consecutive back gestures (LIFO)', () => {
        const closeModalSpy = vi.fn();
        const closePswpSpy = vi.fn();
        const listeners = new Map();
        const fakeLightbox = {
            pswp: { close: closePswpSpy },
            on: (evt, cb) => listeners.set(evt, cb)
        };

        pushBackLayer({ key: 'modal:productModal', type: 'modal', id: 'productModal', onBackClose: closeModalSpy });
        bindPhotoSwipeBackGesture(fakeLightbox);
        listeners.get('afterInit')();

        expect(pushStateSpy).toHaveBeenCalledTimes(2);
        expect(getActiveBackLayerKeys()).toEqual(['modal:productModal', 'pswp:active']);

        // Edge swipe 1: closes PhotoSwipe zoom, leaves product modal open
        handleBackPopstate();
        expect(closePswpSpy).toHaveBeenCalledTimes(1);
        expect(closeModalSpy).not.toHaveBeenCalled();
        expect(getActiveBackLayerKeys()).toEqual(['modal:productModal']);

        listeners.get('close')();
        expect(backSpy).not.toHaveBeenCalled();

        // Edge swipe 2: closes product modal back to catalog
        handleBackPopstate();
        expect(closeModalSpy).toHaveBeenCalledTimes(1);
        expect(getActiveBackLayerKeys()).toEqual([]);
    });

    it('cancels redundant history.back when switching overlays in the same tick (cart -> checkout)', async () => {
        pushBackLayer({ key: 'cart:main', type: 'cart', id: 'main', onBackClose: vi.fn() });
        expect(pushStateSpy).toHaveBeenCalledTimes(1);

        // User taps Checkout inside cart: cart closes, checkout opens synchronously
        removeBackLayerFromUI('cart:main');
        pushBackLayer({ key: 'modal:checkoutModal', type: 'modal', id: 'checkoutModal', onBackClose: vi.fn() });

        await Promise.resolve();
        expect(backSpy).not.toHaveBeenCalled();
        expect(goSpy).not.toHaveBeenCalled();
        expect(getActiveBackLayerKeys()).toEqual(['modal:checkoutModal']);

        // Manual UI close via X button rolls back the single synthetic history step
        removeBackLayerFromUI('modal:checkoutModal');
        await Promise.resolve();
        expect(backSpy).toHaveBeenCalledTimes(1);

        // Synthetic popstate fired by history.back() is safely ignored without closing remaining layers
        expect(() => handleBackPopstate()).not.toThrow();
        expect(getActiveBackLayerKeys()).toEqual([]);
    });
});
