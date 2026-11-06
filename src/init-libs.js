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
    const fakeInstance = {
        value: el ? el.value : '',
        unmaskedValue: el ? el.value : '',
        destroy: () => {},
        updateOptions: () => {},
        on: () => {},
        off: () => {}
    };
    loadIMask().then(realIMask => {
        if (realIMask && el) {
            const real = realIMask(el, opts);
            Object.assign(fakeInstance, real);
            el._imask = real;
        }
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
