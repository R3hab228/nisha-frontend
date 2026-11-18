// ==========================================
// NISHA SOUND EFFECTS ENGINE (ADAPTIVE MASTERING & PLAYBACK)
// ==========================================

import { registerActions } from './action-registry.js';
import { getRuntimeStorage } from './runtime-env.js';

const NOTIFY_SOUND_URL = '/sounds/notify.mp3';
const SFX_STORAGE_KEY = 'nisha_sfx_enabled';
const TARGET_BUFFER_RMS = 0.125; // ~ -18 dBFS target loudness
const PLAY_COOLDOWN_MS = 450;
const PENDING_TTL_MS = 4000;

let _audioCtx = null;
let _notifyBuffer = null;
let _bufferPromise = null;
let _unlockListenersBound = false;
let _lastPlayedAt = 0;
let _pendingPlay = null;

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
 * Computes comfortable, non-harsh gain calibrated by device profile, notification kind,
 * buffer RMS loudness, and network/battery constraints.
 * Note: browsers cannot read OS hardware volume sliders, so we combine RMS normalization
 * with a Web Audio DynamicsCompressor limiter to keep small speakers audible and loud speakers safe.
 * @param {{ kind?: 'toast'|'broadcast', bufferRms?: number }} [opts={}]
 * @returns {number}
 */
export function computeAdaptiveOutputGain({ kind = 'toast', bufferRms = TARGET_BUFFER_RMS } = {}) {
    let baseGain = kind === 'broadcast' ? 0.34 : 0.25;

    if (typeof window !== 'undefined') {
        const isCoarsePointer = Boolean(
            window.matchMedia &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(pointer: coarse)').matches
        );
        const isTouchDevice = isCoarsePointer || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0);
        if (isTouchDevice) {
            // Mobile phone speakers have smaller drivers than desktop speakers/headphones
            baseGain *= 1.24;
        }
    }

    if (typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData) {
        baseGain *= 0.9;
    }

    const safeRms = Math.max(0.02, Math.min(0.5, Number(bufferRms) || TARGET_BUFFER_RMS));
    const rmsCompensation = Math.max(0.55, Math.min(1.65, TARGET_BUFFER_RMS / safeRms));
    const finalGain = baseGain * rmsCompensation;

    return Math.max(0.06, Math.min(0.52, Number(finalGain.toFixed(3))));
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

async function loadNotifyBuffer(ctx) {
    if (_notifyBuffer) return _notifyBuffer;
    if (_bufferPromise) return _bufferPromise;
    if (!ctx || typeof fetch !== 'function' || typeof ctx.decodeAudioData !== 'function') return null;

    _bufferPromise = fetch(NOTIFY_SOUND_URL, { cache: 'force-cache' })
        .then((res) => (res && res.ok ? res.arrayBuffer() : null))
        .then((arr) => (arr ? ctx.decodeAudioData(arr) : null))
        .then((decoded) => {
            if (decoded) _notifyBuffer = decoded;
            return decoded || null;
        })
        .catch(() => null)
        .finally(() => {
            _bufferPromise = null;
        });

    return _bufferPromise;
}

function playBufferWithMastering(ctx, buffer, kind) {
    if (!ctx || !buffer || typeof ctx.createBufferSource !== 'function') return false;
    try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = ctx.createGain();
        const rms = computeBufferRms(buffer);
        const targetGain = computeAdaptiveOutputGain({ kind, bufferRms: rms });
        gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);

        let chainTail = source;

        if (typeof ctx.createBiquadFilter === 'function') {
            const highpass = ctx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.setValueAtTime(110, ctx.currentTime);

            const presenceSoftener = ctx.createBiquadFilter();
            presenceSoftener.type = 'highshelf';
            presenceSoftener.frequency.setValueAtTime(6800, ctx.currentTime);
            presenceSoftener.gain.setValueAtTime(-2.5, ctx.currentTime);

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

function playFallbackHtmlAudio(kind) {
    if (typeof Audio !== 'function') return false;
    try {
        const audio = new Audio(NOTIFY_SOUND_URL);
        audio.volume = computeAdaptiveOutputGain({ kind, bufferRms: TARGET_BUFFER_RMS });
        const playRes = audio.play();
        if (playRes && typeof playRes.catch === 'function') {
            playRes.catch(() => {});
        }
        return true;
    } catch {
        return false;
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

        // Pre-warm decoded buffer on first gesture for zero-latency future toasts
        loadNotifyBuffer(ctx).then((buf) => {
            if (_pendingPlay && buf && ctx.state === 'running') {
                const pending = _pendingPlay;
                _pendingPlay = null;
                if (Date.now() - pending.queuedAt <= PENDING_TTL_MS) {
                    _lastPlayedAt = Date.now();
                    playBufferWithMastering(ctx, buf, pending.kind);
                }
            }
        }).catch(() => {});
    };

    const opts = { capture: true, passive: true };
    document.addEventListener('pointerdown', unlockHandler, opts);
    document.addEventListener('keydown', unlockHandler, opts);
}

/**
 * Plays the Windows 98 NOTIFY sound effect with adaptive leveling, compression limiter,
 * anti-spam cooldown, and autoplay-gesture deferral.
 * @param {{ kind?: 'toast'|'broadcast' }} [options={}]
 * @returns {Promise<boolean>}
 */
export async function playNotifySound({ kind = 'toast' } = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    if (document.hidden || !isSoundEnabled()) return false;

    const now = Date.now();
    if (now - _lastPlayedAt < PLAY_COOLDOWN_MS) return false;

    bindAudioUnlockListeners();

    const ctx = getOrCreateAudioContext();
    if (!ctx) {
        _lastPlayedAt = now;
        return playFallbackHtmlAudio(kind);
    }

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try {
            await ctx.resume();
        } catch {}
    }

    if (ctx.state !== 'running') {
        _pendingPlay = { kind, queuedAt: now };
        loadNotifyBuffer(ctx).catch(() => {});
        return false;
    }

    const buffer = await loadNotifyBuffer(ctx);
    if (!buffer) {
        _lastPlayedAt = Date.now();
        return playFallbackHtmlAudio(kind);
    }

    _lastPlayedAt = Date.now();
    return playBufferWithMastering(ctx, buffer, kind);
}

/**
 * Resets internal audio state (for deterministic unit testing).
 */
export function resetSoundEffectsTestState() {
    _audioCtx = null;
    _notifyBuffer = null;
    _bufferPromise = null;
    _unlockListenersBound = false;
    _lastPlayedAt = 0;
    _pendingPlay = null;
}

if (typeof document !== 'undefined') {
    bindAudioUnlockListeners();
}

if (typeof window !== 'undefined') {
    window.playNotifySound = playNotifySound;
}

registerActions({
    playNotifySound,
    isSoundEnabled,
    setSoundEnabled
});
