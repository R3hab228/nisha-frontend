// ==========================================
// NISHA DROP STATE & NAME AUTOFILL SANITIZER
// ==========================================

import { getRuntimeProfile, getRuntimeStorage } from '../core/runtime-env.js';

function getReactiveStore() {
    if (typeof window !== 'undefined' && window.store && typeof window.store.get === 'function' && typeof window.store.set === 'function') {
        return window.store;
    }
    if (typeof globalThis !== 'undefined' && globalThis.store && typeof globalThis.store.get === 'function' && typeof globalThis.store.set === 'function') {
        return globalThis.store;
    }
    return null;
}

// Локальный fallback массива файлов предложки: объекты { file, url }
let _proposalFiles = [];

export function getProposalFiles() {
    const s = getReactiveStore();
    if (s) {
        const list = s.get('currentProposalFiles');
        if (Array.isArray(list)) return list;
    }
    if (typeof window !== 'undefined' && Array.isArray(window.currentProposalFiles)) {
        return window.currentProposalFiles;
    }
    return _proposalFiles;
}

export function setProposalFiles(files) {
    const safeList = Array.isArray(files) ? files : [];
    _proposalFiles = safeList;
    const s = getReactiveStore();
    if (s) {
        s.set('currentProposalFiles', safeList);
    } else if (typeof window !== 'undefined') {
        window.currentProposalFiles = safeList;
    }
}

if (typeof window !== 'undefined' && !Array.isArray(window.currentProposalFiles)) {
    setProposalFiles([]);
}

export function getStorage() {
    return getRuntimeStorage();
}

// Защита поля «Название вещи» от автозаполнения браузером ФИО покупателя (Chrome Autofill принимает поле за «имя»)
export function sanitizeProposalNameField() {
    const el = document.getElementById('propName');
    if (!el || el.dataset.userTyped === '1') return;
    const val = (el.value || '').trim();
    if (!val) return;

    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const store = getStorage();
    let cachedDelivery = null;
    try { cachedDelivery = store ? store.getJSON('nisha_profile_delivery', null) : null; } catch {}
    const prof = getRuntimeProfile();

    const knownNames = [
        prof?.full_name,
        prof?.username,
        cachedDelivery?.full_name,
        document.getElementById('orderName')?.value,
        document.getElementById('profileDeliveryFullName')?.value,
        document.getElementById('modalProfileDeliveryFullName')?.value
    ].map(norm).filter(Boolean);

    if (knownNames.includes(norm(val))) {
        el.value = '';
    }
}

let _nameGuardsBound = false;
export function initProposalNameGuard() {
    if (_nameGuardsBound || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    _nameGuardsBound = true;

    ['keydown', 'paste', 'compositionstart'].forEach(evtName => {
        document.addEventListener(evtName, (e) => {
            if (e.target && e.target.id === 'propName') e.target.dataset.userTyped = '1';
        }, true);
    });
    ['input', 'change', 'focusin'].forEach(evtName => {
        document.addEventListener(evtName, (e) => {
            if (e.target && e.target.id === 'propName') sanitizeProposalNameField();
        }, true);
    });
}

const DIRECT_DM_REDIRECT_RE = new RegExp(
    '(?:^|[^\\p{L}\\d])(?:' +
        '(?:[ву]\\s*(?:л\\.?\\s*с\\.?|п\\.?\\s*п\\.?|д\\.?\\s*м\\.?|п\\.?\\s*м\\.?|личк[уеаи]|личн(?:ы[хе]|ом|ую)|особист(?:[іих]|ому|ій)|приват(?:н[іи]х?|і)?|д[иі]рект[еі]?|пм|лс|пп))' +
        '|' +
        '(?:(?:in|via|on|to)\\s+(?:my\\s+)?(?:dms?|pms?|direct\\s+messages?|private\\s+messages?))' +
        '|' +
        '(?:(?:dm|pm|msg|message|text|hit\\s+me\\s+up|hmu|reach\\s+out)(?:\\s+me)?\\s+(?:for|about|re:?|regarding)\\b)' +
        '|' +
        '(?:(?:on|upon)\\s+request\\b)' +
        '|' +
        '(?:по\\s+(?:запросу|требованию)|за\\s+(?:запитом|вимогою))' +
        '|' +
        '(?:\\b(?:v|u)\\s*(?:ls|pp|lichk[uae]|privat|direkt)\\b)' +
    ')(?=[^\\p{L}\\d]|$)',
    'iu'
);

const MEASURE_WORD_RE = /(?:^|[^\p{L}])(?:замер\p{L}*|замір\p{L}*|промер\p{L}*|промір\p{L}*|обмер\p{L}*|обмір\p{L}*|zamer\p{L}*|zamir\p{L}*|measure\p{L}*|sizing|dimensions)(?=[^\p{L}]|$)/iu;
const DODGE_ACTION_RE = /(?:^|[^\p{L}])(?:лс|л\.?\s*с\.?|пп|п\.?\s*п\.?|личк\p{L}*|личн\p{L}*|особист\p{L}*|приват\p{L}*|д[иі]рект\p{L}*|тг|tg|телег\p{L}*|telegram|скин\p{L}*|кин\p{L}*|сброш\p{L}*|відправ\p{L}*|отправ\p{L}*|пришл\p{L}*|надішл\p{L}*|уточн\p{L}*|спраш\p{L}*|спрос\p{L}*|питай\p{L}*|запит\p{L}*|пиш\p{L}*|напиш\p{L}*|ask|request|send|inquire|enquire|dm|pm|message|text)(?=[^\p{L}]|$)/iu;

/**
 * Checks whether a seller proposal tries to redirect buyers to DM/PM/chat
 * instead of writing item measurements directly in the description (RU / UA / EN).
 * @param {string} text
 * @returns {boolean}
 */
export function hasPrivateMeasurementsDodge(text) {
    const raw = String(text || '').trim();
    if (!raw) return false;

    const normalized = raw
        .toLowerCase()
        .replaceAll(/[’`ʼ]/g, "'")
        .replaceAll(/\s+/g, ' ');

    if (DIRECT_DM_REDIRECT_RE.test(normalized)) return true;

    const clauses = normalized.split(/[\n.!?;]+/);
    return clauses.some(clause => MEASURE_WORD_RE.test(clause) && DODGE_ACTION_RE.test(clause));
}
