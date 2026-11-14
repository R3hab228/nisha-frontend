import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    appEvents,
    emitAppEvent,
    onAppEvent,
    onceAppEvent,
    registerAction,
    registerActions,
    unregisterAction,
    hasAction,
    listRegisteredActions,
    resolveAction,
    invokeAction,
    invokeCompatAction
} from '../js/core/action-registry.js';

describe('Core ActionRegistry & EventBus', () => {
    const createdActions = [];
    const createdGlobals = [];

    function trackAction(name) {
        createdActions.push(name);
    }

    function trackGlobal(name) {
        createdGlobals.push(name);
    }

    beforeEach(() => {
        globalThis.window = globalThis.window || globalThis;
        while (createdActions.length > 0) {
            unregisterAction(createdActions.pop());
        }
        while (createdGlobals.length > 0) {
            const key = createdGlobals.pop();
            delete window[key];
            delete globalThis[key];
        }
    });

    it('registers, detects, lists, invokes, and unregisters ES actions', () => {
        const handler = vi.fn((a, b) => a + b);
        trackAction('__testAddAction');
        registerAction('__testAddAction', handler);

        expect(hasAction('__testAddAction')).toBe(true);
        expect(listRegisteredActions()).toContain('__testAddAction');
        expect(invokeAction('__testAddAction', 2, 3)).toBe(5);
        expect(handler).toHaveBeenCalledWith(2, 3);

        unregisterAction('__testAddAction');
        expect(hasAction('__testAddAction')).toBe(false);
        expect(invokeAction('__testAddAction', 2, 3)).toBeUndefined();
    });

    it('batch-registers actions with registerActions', () => {
        const fnA = vi.fn(() => 'A');
        const fnB = vi.fn(() => 'B');
        trackAction('__testBatchA');
        trackAction('__testBatchB');

        registerActions({
            __testBatchA: fnA,
            __testBatchB: fnB,
            __ignoredNotFn: 'not-a-function'
        });

        expect(invokeAction('__testBatchA')).toBe('A');
        expect(invokeAction('__testBatchB')).toBe('B');
        expect(hasAction('__ignoredNotFn')).toBe(false);
    });

    it('prefers real ES handlers over _isNishaLazyStub proxies', () => {
        const lazyStub = vi.fn(() => 'lazy');
        lazyStub._isNishaLazyStub = true;

        const realHandler = vi.fn(() => 'real');

        trackAction('__testLazyOverride');
        trackGlobal('__testLazyOverride');

        window.__testLazyOverride = lazyStub;
        registerAction('__testLazyOverride', lazyStub, { isLazyStub: true });
        expect(invokeAction('__testLazyOverride')).toBe('lazy');

        // Real module finishes loading and registers real handler
        registerAction('__testLazyOverride', realHandler);
        expect(resolveAction('__testLazyOverride')).toBe(realHandler);
        expect(invokeAction('__testLazyOverride')).toBe('real');

        // A later lazy stub registration must not overwrite the real handler
        registerAction('__testLazyOverride', lazyStub, { isLazyStub: true });
        expect(resolveAction('__testLazyOverride')).toBe(realHandler);
    });

    it('honors explicit window spy/mock overrides in tests', () => {
        const realHandler = vi.fn(() => 'prod');
        const spyMock = vi.fn(() => 'mocked');

        trackAction('__testMockOverride');
        trackGlobal('__testMockOverride');

        registerAction('__testMockOverride', realHandler);
        expect(invokeAction('__testMockOverride')).toBe('prod');
        realHandler.mockClear();

        window.__testMockOverride = spyMock;
        expect(resolveAction('__testMockOverride')).toBe(spyMock);
        expect(invokeAction('__testMockOverride', 'arg1')).toBe('mocked');
        expect(spyMock).toHaveBeenCalledWith('arg1');
        expect(realHandler).not.toHaveBeenCalled();
    });

    it('supports invokeCompatAction fallback to compatGlobalName', () => {
        const compatFn = vi.fn((x) => x * 2);
        trackGlobal('__testCompatOnly');
        window.__testCompatOnly = compatFn;

        expect(hasAction('__missingPrimaryAction')).toBe(false);
        expect(invokeCompatAction('__missingPrimaryAction', '__testCompatOnly', 7)).toBe(14);
        expect(compatFn).toHaveBeenCalledWith(7);
    });

    it('dispatches and unsubscribes typed CustomEvents on appEvents', () => {
        expect(appEvents).toBeDefined();
        const received = [];
        const off = onAppEvent('nisha:test-event', (e) => {
            received.push(e.detail);
        });

        emitAppEvent('nisha:test-event', { ok: 1 });
        emitAppEvent('nisha:test-event', { ok: 2 });
        off();
        emitAppEvent('nisha:test-event', { ok: 3 });

        expect(received).toEqual([{ ok: 1 }, { ok: 2 }]);

        const onceReceived = [];
        onceAppEvent('nisha:test-once', (e) => onceReceived.push(e.detail));
        emitAppEvent('nisha:test-once', 'first');
        emitAppEvent('nisha:test-once', 'second');
        expect(onceReceived).toEqual(['first']);
    });
});
