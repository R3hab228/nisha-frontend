// ==========================================
// NISHA STORE - CORE LIBRARIES INITIALIZATION
// Runs before any application scripts
// ==========================================
import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'dompurify';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// --- LAZY IMASK LOADER & TRANSPARENT STUB ---
let _imaskPromise = null;
export async function loadIMask() {
    if (typeof window !== 'undefined' && window.IMask && !window.IMask._isStub) {
        return window.IMask;
    }
    if (!_imaskPromise) {
        _imaskPromise = import('imask').then(m => {
            const IMaskLib = m.default || m;
            if (typeof window !== 'undefined') window.IMask = IMaskLib;
            if (typeof globalThis !== 'undefined') globalThis.IMask = IMaskLib;
            return IMaskLib;
        }).catch(err => {
            _imaskPromise = null;
            console.error('[IMask] Lazy load failed:', err);
            return null;
        });
    }
    return _imaskPromise;
}

function imaskStub(el, opts) {
    let realInstance = null;
    let pendingValue = el ? el.value : '';
    let pendingUnmaskedValue = el ? el.value : '';
    let pendingOptions = null;
    let destroyed = false;
    const queuedListeners = [];

    const fakeInstance = {
        _isStub: true,
        get value() {
            return realInstance ? realInstance.value : pendingValue;
        },
        set value(val) {
            pendingValue = String(val ?? '');
            if (realInstance) {
                try { realInstance.value = pendingValue; } catch {}
            } else if (el) {
                el.value = pendingValue;
            }
        },
        get unmaskedValue() {
            if (realInstance) return realInstance.unmaskedValue;
            return el ? String(el.value || '').replace(/\D/g, '') : pendingUnmaskedValue;
        },
        set unmaskedValue(val) {
            pendingUnmaskedValue = String(val ?? '');
            if (realInstance) {
                try { realInstance.unmaskedValue = pendingUnmaskedValue; } catch {}
            }
        },
        destroy: () => {
            destroyed = true;
            queuedListeners.length = 0;
            if (realInstance && typeof realInstance.destroy === 'function') {
                realInstance.destroy();
            }
        },
        updateOptions: (nextOpts) => {
            pendingOptions = nextOpts;
            if (realInstance && typeof realInstance.updateOptions === 'function') {
                realInstance.updateOptions(nextOpts);
            }
        },
        updateValue: () => {
            if (realInstance && typeof realInstance.updateValue === 'function') {
                realInstance.updateValue();
            }
        },
        on: (evt, fn) => {
            if (realInstance && typeof realInstance.on === 'function') {
                realInstance.on(evt, fn);
            } else if (typeof fn === 'function') {
                queuedListeners.push([evt, fn]);
            }
            return fakeInstance;
        },
        off: (evt, fn) => {
            if (realInstance && typeof realInstance.off === 'function') {
                realInstance.off(evt, fn);
            } else {
                for (let i = queuedListeners.length - 1; i >= 0; i -= 1) {
                    if (queuedListeners[i][0] === evt && (!fn || queuedListeners[i][1] === fn)) {
                        queuedListeners.splice(i, 1);
                    }
                }
            }
            return fakeInstance;
        }
    };

    loadIMask().then(realIMask => {
        if (destroyed || !realIMask || !el) return;
        const real = realIMask(el, pendingOptions || opts);
        realInstance = real;
        fakeInstance._isStub = false;
        if (pendingValue && pendingValue !== (el ? el.value : '')) {
            try { real.value = pendingValue; } catch {}
        }
        while (queuedListeners.length > 0) {
            const [evt, fn] = queuedListeners.shift();
            try { real.on(evt, fn); } catch {}
        }
        el._imask = real;
    });
    return fakeInstance;
}
imaskStub._isStub = true;

// Bind to window for backwards compatibility with legacy inline scripts and global calls
if (typeof window !== 'undefined') {
    window.supabase = { createClient };
    window.createClient = createClient;
    window.DOMPurify = DOMPurify;
    window.IMask = imaskStub;
    window.loadIMask = loadIMask;
    window.i18next = i18next;
    window.i18nextBrowserLanguageDetector = LanguageDetector;
}

// Bind to globalThis for global identifier lookups
if (typeof globalThis !== 'undefined') {
    globalThis.supabase = { createClient };
    globalThis.createClient = createClient;
    globalThis.DOMPurify = DOMPurify;
    globalThis.IMask = imaskStub;
    globalThis.loadIMask = loadIMask;
    globalThis.i18next = i18next;
    globalThis.i18nextBrowserLanguageDetector = LanguageDetector;
}
