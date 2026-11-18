// ==========================================
// NISHA SOUND EFFECTS ENGINE (WIN98 FULL PACK + ADAPTIVE MASTERING)
// ==========================================

import { registerActions } from './action-registry.js';
import { getRuntimeStorage } from './runtime-env.js';

const SFX_STORAGE_KEY = 'nisha_sfx_enabled';
const TARGET_BUFFER_RMS = 0.125; // ~ -18 dBFS target loudness
const PENDING_TTL_MS = 4000;

export const SOUND_PROFILES = Object.freeze({
    start: {
        url: '/sounds/start.mp3',
        baseDesktop: 0.14,
        baseMobile: 0.19,
        priority: 1,
        cooldownMs: 140,
        targetRms: 0.085,
        lockLowerMs: 0
    },
    ding: {
        url: '/sounds/ding.mp3',
        baseDesktop: 0.24,
        baseMobile: 0.30,
        priority: 2,
        cooldownMs: 320,
        targetRms: 0.125,
        lockLowerMs: 450
    },
    recycle: {
        url: '/sounds/recycle.mp3',
        baseDesktop: 0.25,
        baseMobile: 0.32,
        priority: 2,
        cooldownMs: 350,
        targetRms: 0.11,
        lockLowerMs: 450
    },
    notify: {
        url: '/sounds/notify.mp3',
        baseDesktop: 0.25,
        baseMobile: 0.31,
        priority: 1,
        cooldownMs: 450,
        targetRms: 0.125,
        lockLowerMs: 0
    },
    chimes: {
        url: '/sounds/chimes.mp3',
        baseDesktop: 0.28,
        baseMobile: 0.35,
        priority: 3,
        cooldownMs: 650,
        targetRms: 0.12,
        lockLowerMs: 950
    },
    chord: {
        url: '/sounds/chord.mp3',
        baseDesktop: 0.23,
        baseMobile: 0.29,
        priority: 3,
        cooldownMs: 500,
        targetRms: 0.12,
        lockLowerMs: 750
    },
    tada: {
        url: '/sounds/tada.mp3',
        baseDesktop: 0.32,
        baseMobile: 0.39,
        priority: 4,
        cooldownMs: 1200,
        targetRms: 0.13,
        lockLowerMs: 1450
    }
});

let _audioCtx = null;
const _bufferCache = new Map();
const _bufferPromises = new Map();
const _lastPlayedBySound = new Map();
let _unlockListenersBound = false;
let _warmupStarted = false;
let _higherPriorityLock = { priority: 0, until: 0 };
let _pendingPlay = null;

/**
 * Resolves sound profile safely, falling back to `notify`.
 * @param {string} name
 * @returns {{ key: string, url: string, baseDesktop: number, baseMobile: number, priority: number, cooldownMs: number, targetRms: number, lockLowerMs: number }}
 */
function resolveSoundProfile(name) {
    const key = String(name || 'notify').toLowerCase();
    const prof = Object.hasOwn(SOUND_PROFILES, key) ? SOUND_PROFILES[key] : SOUND_PROFILES.notify;
    return { key: Object.hasOwn(SOUND_PROFILES, key) ? key : 'notify', ...prof };
}

/**
 * Checks whether sound effects are enabled by user preference.
 * Defaults to enabled unless explicitly disabled via storage key `nisha_sfx_enabled = "0"`.
 * @returns {boolean}
 */
export function isSoundEnabled() {
    const store = getRuntimeStorage();
    if (store && typeof store.get === 'function') {
        return store.get(SFX_STORAGE_KEY, '1') !== '0';
    }
    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(SFX_STORAGE_KEY) !== '0';
        }
    } catch {}
    return true;
}

/**
 * Persists user sound effect preference (`nisha_sfx_enabled`).
 * @param {boolean} enabled
 * @returns {boolean}
 */
export function setSoundEnabled(enabled) {
    const val = enabled ? '1' : '0';
    const store = getRuntimeStorage();
    if (store && typeof store.set === 'function') {
        store.set(SFX_STORAGE_KEY, val);
    } else {
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(SFX_STORAGE_KEY, val);
        } catch {}
    }
    if (!enabled) _pendingPlay = null;
    return Boolean(enabled);
}

/**
 * Computes root-mean-square loudness across decoded AudioBuffer channels.
 * @param {AudioBuffer|null} buffer
 * @returns {number}
 */
export function computeBufferRms(buffer) {
    if (!buffer || typeof buffer.getChannelData !== 'function' || !buffer.numberOfChannels || !buffer.length) {
        return TARGET_BUFFER_RMS;
    }
    const channels = Math.min(2, buffer.numberOfChannels);
    const step = Math.max(1, Math.floor(buffer.length / 4096));
    let sumSq = 0;
    let count = 0;

    for (let ch = 0; ch < channels; ch++) {
        const data = buffer.getChannelData(ch);
        if (!data || !data.length) continue;
        for (let i = 0; i < data.length; i += step) {
            const sample = data[i];
            sumSq += sample * sample;
            count += 1;
        }
    }
    if (!count) return TARGET_BUFFER_RMS;
    const rms = Math.sqrt(sumSq / count);
    return Number.isFinite(rms) && rms > 0.001 ? rms : TARGET_BUFFER_RMS;
}

/**
 * Computes comfortable, non-harsh gain calibrated by sound profile, device speaker profile,
 * buffer RMS loudness, and network/battery constraints.
 * Note: browsers cannot read OS hardware volume sliders, so we combine per-sound RMS normalization
 * with a Web Audio DynamicsCompressor limiter to keep small phone speakers audible and loud speakers safe.
 * @param {{ sound?: string, kind?: 'toast'|'broadcast'|'alert'|'success'|'celebrate'|'ui', bufferRms?: number }} [opts={}]
 * @returns {number}
 */
export function computeAdaptiveOutputGain({ sound = 'notify', kind = 'toast', bufferRms } = {}) {
    const prof = resolveSoundProfile(sound);
    let isMobileSpeaker = false;

    if (typeof window !== 'undefined') {
        const isCoarsePointer = Boolean(
            window.matchMedia &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(pointer: coarse)').matches
        );
        isMobileSpeaker = isCoarsePointer || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0);
    }

    let baseGain = isMobileSpeaker ? prof.baseMobile : prof.baseDesktop;
    if (prof.key === 'notify' && kind === 'broadcast') {
        baseGain = isMobileSpeaker ? 0.40 : 0.34;
    }

    if (typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData) {
        baseGain *= 0.9;
    }

    const targetRms = prof.targetRms || TARGET_BUFFER_RMS;
    const safeRms = Math.max(0.02, Math.min(0.5, Number(bufferRms) || targetRms));
    const rmsCompensation = Math.max(0.55, Math.min(1.65, targetRms / safeRms));
    const finalGain = baseGain * rmsCompensation;

    return Math.max(0.05, Math.min(0.54, Number(finalGain.toFixed(3))));
}

function getOrCreateAudioContext() {
    if (typeof window === 'undefined') return null;
    if (_audioCtx) return _audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (typeof Ctx !== 'function') return null;
    try {
        _audioCtx = new Ctx();
    } catch {
        _audioCtx = null;
    }
    return _audioCtx;
}

async function loadSoundBuffer(ctx, soundName) {
    const prof = resolveSoundProfile(soundName);
    if (_bufferCache.has(prof.key)) return _bufferCache.get(prof.key);
    if (_bufferPromises.has(prof.key)) return _bufferPromises.get(prof.key);
    if (!ctx || typeof fetch !== 'function' || typeof ctx.decodeAudioData !== 'function') return null;

    const promise = fetch(prof.url, { cache: 'force-cache' })
        .then((res) => (res && res.ok ? res.arrayBuffer() : null))
        .then((arr) => (arr ? ctx.decodeAudioData(arr) : null))
        .then((decoded) => {
            if (decoded) _bufferCache.set(prof.key, decoded);
            return decoded || null;
        })
        .catch(() => null)
        .finally(() => {
            _bufferPromises.delete(prof.key);
        });

    _bufferPromises.set(prof.key, promise);
    return promise;
}

function warmUpCoreSounds(ctx) {
    if (_warmupStarted || !ctx || typeof setTimeout !== 'function') return;
    if (typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData) return;
    _warmupStarted = true;

    const order = ['start', 'ding', 'notify', 'recycle', 'chord', 'chimes', 'tada'];
    order.forEach((key, idx) => {
        setTimeout(() => {
            if (ctx.state === 'running') {
                loadSoundBuffer(ctx, key).catch(() => {});
            }
        }, idx * 140);
    });
}

function playBufferWithMastering(ctx, buffer, soundName, kind) {
    if (!ctx || !buffer || typeof ctx.createBufferSource !== 'function') return false;
    try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = ctx.createGain();
        const rms = computeBufferRms(buffer);
        const targetGain = computeAdaptiveOutputGain({ sound: soundName, kind, bufferRms: rms });
        gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);

        let chainTail = source;

        if (typeof ctx.createBiquadFilter === 'function') {
            const highpass = ctx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.setValueAtTime(110, ctx.currentTime);

            const presenceSoftener = ctx.createBiquadFilter();
            presenceSoftener.type = 'highshelf';
            presenceSoftener.frequency.setValueAtTime(6800, ctx.currentTime);
            presenceSoftener.gain.setValueAtTime(soundName === 'start' ? -3.5 : -2.5, ctx.currentTime);

            chainTail.connect(highpass);
            highpass.connect(presenceSoftener);
            chainTail = presenceSoftener;
        }

        if (typeof ctx.createDynamicsCompressor === 'function') {
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-24, ctx.currentTime);
            compressor.knee.setValueAtTime(18, ctx.currentTime);
            compressor.ratio.setValueAtTime(5, ctx.currentTime);
            compressor.attack.setValueAtTime(0.003, ctx.currentTime);
            compressor.release.setValueAtTime(0.2, ctx.currentTime);

            chainTail.connect(compressor);
            chainTail = compressor;
        }

        chainTail.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        return true;
    } catch {
        return false;
    }
}

function playFallbackHtmlAudio(soundName, kind) {
    if (typeof Audio !== 'function') return false;
    const prof = resolveSoundProfile(soundName);
    try {
        const audio = new Audio(prof.url);
        audio.volume = computeAdaptiveOutputGain({ sound: prof.key, kind, bufferRms: prof.targetRms });
        const playRes = audio.play();
        if (playRes && typeof playRes.catch === 'function') {
            playRes.catch(() => {});
        }
        return true;
    } catch {
        return false;
    }
}

function resolveEffectivePriority(profile, kind) {
    if (profile.key === 'notify' && kind === 'broadcast') return 3;
    return profile.priority;
}

function markPlaybackTimestamps(profile, kind, now) {
    _lastPlayedBySound.set(profile.key, now);
    const effectivePriority = resolveEffectivePriority(profile, kind);
    const lockMs = (profile.key === 'notify' && kind === 'broadcast') ? 950 : profile.lockLowerMs;
    if (lockMs > 0) {
        const lockUntil = now + lockMs;
        if (effectivePriority >= _higherPriorityLock.priority || now >= _higherPriorityLock.until) {
            _higherPriorityLock = { priority: effectivePriority, until: lockUntil };
        }
    }
}

function bindAudioUnlockListeners() {
    if (_unlockListenersBound || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    _unlockListenersBound = true;

    const unlockHandler = async () => {
        const ctx = getOrCreateAudioContext();
        if (!ctx) return;

        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
            try {
                await ctx.resume();
            } catch {}
        }

        if (ctx.state === 'running') {
            warmUpCoreSounds(ctx);
        }

        if (_pendingPlay) {
            const pending = _pendingPlay;
            _pendingPlay = null;
            if (Date.now() - pending.queuedAt <= PENDING_TTL_MS && ctx.state === 'running') {
                const prof = resolveSoundProfile(pending.sound);
                const buf = await loadSoundBuffer(ctx, prof.key);
                if (buf) {
                    markPlaybackTimestamps(prof, pending.kind, Date.now());
                    playBufferWithMastering(ctx, buf, prof.key, pending.kind);
                }
            }
        }
    };

    const opts = { capture: true, passive: true };
    document.addEventListener('pointerdown', unlockHandler, opts);
    document.addEventListener('keydown', unlockHandler, opts);
}

/**
 * Plays any registered Win98 sound effect (`start`, `ding`, `recycle`, `notify`, `chimes`, `chord`, `tada`)
 * with adaptive RMS leveling, DynamicsCompressor limiting, priority lock, and autoplay deferral.
 * @param {'start'|'ding'|'recycle'|'notify'|'chimes'|'chord'|'tada'} [soundName='notify']
 * @param {{ kind?: 'toast'|'broadcast'|'alert'|'success'|'celebrate'|'ui' }} [options={}]
 * @returns {Promise<boolean>}
 */
export async function playSound(soundName = 'notify', { kind = 'toast' } = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    if (document.hidden || !isSoundEnabled()) return false;

    const prof = resolveSoundProfile(soundName);
    const effectivePriority = resolveEffectivePriority(prof, kind);
    const now = Date.now();

    if (now < _higherPriorityLock.until && effectivePriority < _higherPriorityLock.priority) {
        return false;
    }

    const lastSame = _lastPlayedBySound.get(prof.key) || 0;
    if (now - lastSame < prof.cooldownMs) return false;

    bindAudioUnlockListeners();

    const ctx = getOrCreateAudioContext();
    if (!ctx) {
        markPlaybackTimestamps(prof, kind, now);
        return playFallbackHtmlAudio(prof.key, kind);
    }

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try {
            await ctx.resume();
        } catch {}
    }

    if (ctx.state !== 'running') {
        if (!_pendingPlay || effectivePriority >= resolveEffectivePriority(resolveSoundProfile(_pendingPlay.sound), _pendingPlay.kind)) {
            _pendingPlay = { sound: prof.key, kind, queuedAt: now };
        }
        loadSoundBuffer(ctx, prof.key).catch(() => {});
        return false;
    }

    warmUpCoreSounds(ctx);

    const buffer = await loadSoundBuffer(ctx, prof.key);
    if (!buffer) {
        markPlaybackTimestamps(prof, kind, Date.now());
        return playFallbackHtmlAudio(prof.key, kind);
    }

    markPlaybackTimestamps(prof, kind, Date.now());
    return playBufferWithMastering(ctx, buffer, prof.key, kind);
}

/**
 * Plays the Windows 98 NOTIFY sound effect (convenience alias for `playSound('notify', options)`).
 * @param {{ kind?: 'toast'|'broadcast' }} [options={}]
 * @returns {Promise<boolean>}
 */
export function playNotifySound(options = {}) {
    return playSound('notify', options);
}

/**
 * Resets internal audio state (for deterministic unit testing).
 */
export function resetSoundEffectsTestState() {
    _audioCtx = null;
    _bufferCache.clear();
    _bufferPromises.clear();
    _lastPlayedBySound.clear();
    _unlockListenersBound = false;
    _warmupStarted = false;
    _higherPriorityLock = { priority: 0, until: 0 };
    _pendingPlay = null;
}

if (typeof document !== 'undefined') {
    bindAudioUnlockListeners();
}

if (typeof window !== 'undefined') {
    window.playSound = playSound;
    window.playNotifySound = playNotifySound;
}

registerActions({
    playSound,
    playNotifySound,
    isSoundEnabled,
    setSoundEnabled
});
