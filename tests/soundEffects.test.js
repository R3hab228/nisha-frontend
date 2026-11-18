import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Adaptive Windows 98 NOTIFY Sound Effects Engine', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('ships normalized public/sounds/notify.mp3 asset under 35 KB', () => {
        const assetPath = resolve(process.cwd(), 'public/sounds/notify.mp3');
        expect(existsSync(assetPath)).toBe(true);
        const size = statSync(assetPath).size;
        expect(size).toBeGreaterThan(5000);
        expect(size).toBeLessThan(35000);
    });

    it('computeBufferRms and computeAdaptiveOutputGain balance quiet/loud buffers and mobile/desktop speakers', async () => {
        vi.stubGlobal('window', {
            matchMedia: vi.fn(() => ({ matches: false }))
        });
        vi.stubGlobal('navigator', { maxTouchPoints: 0 });
        vi.stubGlobal('document', { hidden: false });

        const { computeBufferRms, computeAdaptiveOutputGain } = await import('../js/core/sound-effects.js');

        const quietBuffer = {
            numberOfChannels: 1,
            length: 100,
            getChannelData: () => new Float32Array(100).fill(0.05)
        };
        const loudBuffer = {
            numberOfChannels: 1,
            length: 100,
            getChannelData: () => new Float32Array(100).fill(0.45)
        };

        expect(computeBufferRms(quietBuffer)).toBeCloseTo(0.05, 3);
        expect(computeBufferRms(loudBuffer)).toBeCloseTo(0.45, 3);

        const quietGain = computeAdaptiveOutputGain({ kind: 'toast', bufferRms: 0.05 });
        const loudGain = computeAdaptiveOutputGain({ kind: 'toast', bufferRms: 0.45 });
        expect(quietGain).toBeGreaterThan(loudGain);
        expect(quietGain).toBeLessThanOrEqual(0.52);
        expect(loudGain).toBeGreaterThanOrEqual(0.06);

        const broadcastGain = computeAdaptiveOutputGain({ kind: 'broadcast', bufferRms: 0.125 });
        const toastGain = computeAdaptiveOutputGain({ kind: 'toast', bufferRms: 0.125 });
        expect(broadcastGain).toBeGreaterThan(toastGain);

        vi.stubGlobal('window', {
            matchMedia: vi.fn(() => ({ matches: true }))
        });
        vi.stubGlobal('navigator', { maxTouchPoints: 5 });
        const mobileToastGain = computeAdaptiveOutputGain({ kind: 'toast', bufferRms: 0.125 });
        expect(mobileToastGain).toBeGreaterThan(toastGain);
    });

    it('playNotifySound runs mastering chain, enforces cooldown, and respects setSoundEnabled/hidden state', async () => {
        const listeners = {};
        const connectSpy = vi.fn();
        const startSpy = vi.fn();
        const setValueSpy = vi.fn();

        const fakeNode = () => ({
            type: '',
            frequency: { setValueAtTime: setValueSpy },
            gain: { setValueAtTime: setValueSpy },
            threshold: { setValueAtTime: setValueSpy },
            knee: { setValueAtTime: setValueSpy },
            ratio: { setValueAtTime: setValueSpy },
            attack: { setValueAtTime: setValueSpy },
            release: { setValueAtTime: setValueSpy },
            connect: connectSpy
        });

        const fakeBuffer = {
            numberOfChannels: 1,
            length: 64,
            getChannelData: () => new Float32Array(64).fill(0.125)
        };

        class FakeAudioContext {
            constructor() {
                this.state = 'running';
                this.currentTime = 0;
                this.destination = { _dest: true };
            }
            resume = vi.fn(async () => {});
            decodeAudioData = vi.fn(async () => fakeBuffer);
            createBufferSource = vi.fn(() => ({ buffer: null, connect: connectSpy, start: startSpy }));
            createGain = vi.fn(() => fakeNode());
            createBiquadFilter = vi.fn(() => fakeNode());
            createDynamicsCompressor = vi.fn(() => fakeNode());
        }

        const storageData = new Map();
        vi.stubGlobal('window', {
            AudioContext: FakeAudioContext,
            matchMedia: vi.fn(() => ({ matches: false })),
            storage: {
                get: (k, d) => (storageData.has(k) ? storageData.get(k) : d),
                set: (k, v) => storageData.set(k, String(v))
            }
        });
        vi.stubGlobal('navigator', { maxTouchPoints: 0 });
        vi.stubGlobal('document', {
            hidden: false,
            addEventListener: (ev, fn) => { listeners[ev] = fn; }
        });
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(16)
        })));

        const mod = await import('../js/core/sound-effects.js');
        mod.resetSoundEffectsTestState();

        const first = await mod.playNotifySound({ kind: 'toast' });
        expect(first).toBe(true);
        expect(startSpy).toHaveBeenCalledTimes(1);
        expect(connectSpy).toHaveBeenCalled();

        // Cooldown prevents rapid spam stacking
        const immediateSecond = await mod.playNotifySound({ kind: 'toast' });
        expect(immediateSecond).toBe(false);
        expect(startSpy).toHaveBeenCalledTimes(1);

        // User mute disables playback
        mod.setSoundEnabled(false);
        expect(mod.isSoundEnabled()).toBe(false);
        const mutedPlay = await mod.playNotifySound({ kind: 'broadcast' });
        expect(mutedPlay).toBe(false);

        // Hidden tab skips playback
        mod.setSoundEnabled(true);
        vi.stubGlobal('document', {
            hidden: true,
            addEventListener: (ev, fn) => { listeners[ev] = fn; }
        });
        const hiddenPlay = await mod.playNotifySound({ kind: 'broadcast' });
        expect(hiddenPlay).toBe(false);
    });
});
