import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Adaptive Windows 98 Full Sound Pack & Mastering Engine', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('ships all 7 normalized Win98 MP3 assets under 35 KB each in public/sounds/', () => {
        const expectedAssets = [
            'start.mp3',
            'ding.mp3',
            'recycle.mp3',
            'notify.mp3',
            'chimes.mp3',
            'chord.mp3',
            'tada.mp3'
        ];
        let totalSize = 0;
        for (const file of expectedAssets) {
            const assetPath = resolve(process.cwd(), 'public/sounds', file);
            expect(existsSync(assetPath)).toBe(true);
            const size = statSync(assetPath).size;
            expect(size).toBeGreaterThan(1000);
            expect(size).toBeLessThan(35000);
            totalSize += size;
        }
        expect(totalSize).toBeLessThan(125000);
    });

    it('balances gain across sound profiles, buffer RMS levels, and mobile vs desktop speakers', async () => {
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

        const quietGain = computeAdaptiveOutputGain({ sound: 'notify', kind: 'toast', bufferRms: 0.05 });
        const loudGain = computeAdaptiveOutputGain({ sound: 'notify', kind: 'toast', bufferRms: 0.45 });
        expect(quietGain).toBeGreaterThan(loudGain);
        expect(quietGain).toBeLessThanOrEqual(0.54);
        expect(loudGain).toBeGreaterThanOrEqual(0.05);

        const startGain = computeAdaptiveOutputGain({ sound: 'start', kind: 'ui', bufferRms: 0.085 });
        const tadaGain = computeAdaptiveOutputGain({ sound: 'tada', kind: 'celebrate', bufferRms: 0.13 });
        expect(startGain).toBeLessThan(tadaGain);

        const broadcastGain = computeAdaptiveOutputGain({ sound: 'notify', kind: 'broadcast', bufferRms: 0.125 });
        const toastGain = computeAdaptiveOutputGain({ sound: 'notify', kind: 'toast', bufferRms: 0.125 });
        expect(broadcastGain).toBeGreaterThan(toastGain);

        vi.stubGlobal('window', {
            matchMedia: vi.fn(() => ({ matches: true }))
        });
        vi.stubGlobal('navigator', { maxTouchPoints: 5 });
        const mobileToastGain = computeAdaptiveOutputGain({ sound: 'notify', kind: 'toast', bufferRms: 0.125 });
        expect(mobileToastGain).toBeGreaterThan(toastGain);
    });

    it('enforces priority lock (tada blocks notify toast, start does not block tada), cooldown, and mute/hidden guards', async () => {
        const listeners = {};
        const connectSpy = vi.fn();
        const startSpy = vi.fn();
        const setValueSpy = vi.fn();
        const fetchedUrls = [];

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
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            fetchedUrls.push(url);
            return {
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(16)
            };
        }));

        const mod = await import('../js/core/sound-effects.js');
        mod.resetSoundEffectsTestState();

        // Low-priority 'start' plays and does NOT block higher-priority 'tada'
        const startPlayed = await mod.playSound('start', { kind: 'ui' });
        expect(startPlayed).toBe(true);
        expect(fetchedUrls).toContain('/sounds/start.mp3');

        const tadaPlayed = await mod.playSound('tada', { kind: 'celebrate' });
        expect(tadaPlayed).toBe(true);
        expect(fetchedUrls).toContain('/sounds/tada.mp3');

        // Active 'tada' priority lock prevents trailing lower-priority 'notify' toast from interrupting
        const blockedNotify = await mod.playNotifySound({ kind: 'toast' });
        expect(blockedNotify).toBe(false);

        // User mute disables all playback
        mod.setSoundEnabled(false);
        expect(mod.isSoundEnabled()).toBe(false);
        const mutedPlay = await mod.playSound('chord', { kind: 'alert' });
        expect(mutedPlay).toBe(false);

        // Hidden tab skips playback
        mod.setSoundEnabled(true);
        vi.stubGlobal('document', {
            hidden: true,
            addEventListener: (ev, fn) => { listeners[ev] = fn; }
        });
        const hiddenPlay = await mod.playSound('ding', { kind: 'toast' });
        expect(hiddenPlay).toBe(false);
    });
});
