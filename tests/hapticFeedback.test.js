import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerHaptic } from '../js/core/helpers-pwa-browser.js';

describe('Haptic Feedback System (Telegram WebApp + Android Vibration + iOS 17.4+ Switch Taptic)', () => {
    const origWindow = globalThis.window;
    const origDocument = globalThis.document;
    const origNavigator = globalThis.navigator;

    function stubNavigator(val) {
        Object.defineProperty(globalThis, 'navigator', {
            value: val,
            writable: true,
            configurable: true
        });
    }

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        globalThis.window = origWindow;
        globalThis.document = origDocument;
        stubNavigator(origNavigator);
    });

    it('routes selection, impact, and warning/success/error notifications to Telegram WebApp HapticFeedback', () => {
        const impactOccurred = vi.fn();
        const notificationOccurred = vi.fn();
        const selectionChanged = vi.fn();

        globalThis.window = {
            innerWidth: 390,
            Telegram: {
                WebApp: {
                    HapticFeedback: { impactOccurred, notificationOccurred, selectionChanged }
                }
            }
        };

        triggerHaptic('selection');
        expect(selectionChanged).toHaveBeenCalledTimes(1);

        triggerHaptic('light');
        triggerHaptic('medium');
        triggerHaptic('heavy');
        expect(impactOccurred).toHaveBeenNthCalledWith(1, 'light');
        expect(impactOccurred).toHaveBeenNthCalledWith(2, 'medium');
        expect(impactOccurred).toHaveBeenNthCalledWith(3, 'heavy');

        triggerHaptic('success');
        triggerHaptic('warning');
        triggerHaptic('error');
        expect(notificationOccurred).toHaveBeenNthCalledWith(1, 'success');
        expect(notificationOccurred).toHaveBeenNthCalledWith(2, 'warning');
        expect(notificationOccurred).toHaveBeenNthCalledWith(3, 'error');
    });

    it('triggers Android Vibration API patterns on mobile and stays silent on desktop (>900px)', () => {
        const vibrate = vi.fn();
        stubNavigator({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', vibrate });
        globalThis.window = { innerWidth: 412 };

        triggerHaptic('selection');
        triggerHaptic('light');
        triggerHaptic('medium');
        triggerHaptic('heavy');
        triggerHaptic('success');
        triggerHaptic('warning');
        triggerHaptic('error');

        expect(vibrate).toHaveBeenNthCalledWith(1, 10);
        expect(vibrate).toHaveBeenNthCalledWith(2, 25);
        expect(vibrate).toHaveBeenNthCalledWith(3, 40);
        expect(vibrate).toHaveBeenNthCalledWith(4, 70);
        expect(vibrate).toHaveBeenNthCalledWith(5, [20, 60, 20]);
        expect(vibrate).toHaveBeenNthCalledWith(6, [25, 45, 25]);
        expect(vibrate).toHaveBeenNthCalledWith(7, [30, 50, 30, 50, 30]);

        vibrate.mockClear();
        globalThis.window.innerWidth = 1280;
        triggerHaptic('light');
        expect(vibrate).not.toHaveBeenCalled();
    });

    it('uses hidden <input type="checkbox" switch> + <label> for iOS 17.4+ Safari Taptic Engine with isolated click propagation', () => {
        stubNavigator({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
            platform: 'iPhone',
            maxTouchPoints: 5
        });
        globalThis.window = { innerWidth: 390 };

        const appended = [];
        const listeners = new Map();
        const labelClickSpy = vi.fn();

        const makeEl = (tag) => {
            const attrs = new Map();
            const el = {
                tagName: tag.toUpperCase(),
                id: '',
                type: '',
                tabIndex: 0,
                style: { cssText: '' },
                isConnected: true,
                setAttribute: (k, v) => attrs.set(k, v),
                getAttribute: (k) => attrs.get(k),
                addEventListener: (evt, fn) => {
                    const list = listeners.get(tag) || [];
                    list.push({ evt, fn });
                    listeners.set(tag, list);
                },
                click: tag === 'label' ? labelClickSpy : vi.fn()
            };
            return el;
        };

        globalThis.document = {
            body: { appendChild: (el) => appended.push(el) },
            createElement: (tag) => makeEl(tag),
            getElementById: (id) => appended.find(el => el.id === id) || null
        };

        // 1. Light tap creates hidden switch input + label and clicks label once
        triggerHaptic('light');
        expect(appended).toHaveLength(2);
        const [switchInput, switchLabel] = appended;
        expect(switchInput.type).toBe('checkbox');
        expect(switchInput.getAttribute('switch')).toBe('');
        expect(switchInput.getAttribute('aria-hidden')).toBe('true');
        expect(switchInput.tabIndex).toBe(-1);
        expect(switchLabel.getAttribute('for')).toBe('nishaHapticSwitch');
        expect(labelClickSpy).toHaveBeenCalledTimes(1);

        // 2. Click listener isolates propagation so delegation/modals are unaffected
        const fakeEvt = { stopPropagation: vi.fn() };
        const labelClickHandler = (listeners.get('label') || []).find(l => l.evt === 'click');
        expect(labelClickHandler).toBeDefined();
        labelClickHandler.fn(fakeEvt);
        expect(fakeEvt.stopPropagation).toHaveBeenCalledTimes(1);

        // 3. Success notification fires double pulse (immediate + 75ms)
        labelClickSpy.mockClear();
        vi.advanceTimersByTime(100);
        triggerHaptic('success');
        expect(labelClickSpy).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(80);
        expect(labelClickSpy).toHaveBeenCalledTimes(2);
    });
});
