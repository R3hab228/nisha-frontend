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
