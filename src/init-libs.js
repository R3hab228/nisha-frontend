// ==========================================
// NISHA STORE - CORE LIBRARIES INITIALIZATION
// Runs before any application scripts
// ==========================================
import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'dompurify';
import IMask from 'imask';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Bind to window for backwards compatibility with legacy inline scripts and global calls
window.supabase = { createClient };
window.createClient = createClient;
window.DOMPurify = DOMPurify;
window.IMask = IMask;
window.i18next = i18next;
window.i18nextBrowserLanguageDetector = LanguageDetector;

// Bind to globalThis for global identifier lookups
if (typeof globalThis !== 'undefined') {
    globalThis.supabase = window.supabase;
    globalThis.createClient = createClient;
    globalThis.DOMPurify = DOMPurify;
    globalThis.IMask = IMask;
    globalThis.i18next = i18next;
    globalThis.i18nextBrowserLanguageDetector = LanguageDetector;
}
