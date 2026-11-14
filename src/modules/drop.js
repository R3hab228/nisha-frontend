// ==========================================
// NISHA STORE - MODULAR PROPOSAL / CONSIGNMENT FACADE
// Safe, typed ES module exports for community item proposals
// ==========================================

import { callAction, callAsyncAction } from './_facade.js';
import { getStore } from './store.js';

/**
 * Returns currently uploaded proposal files array
 * @returns {any[]}
 */
export function getCurrentProposalFiles() {
    const s = getStore();
    if (s && Array.isArray(s.currentProposalFiles)) {
        return s.currentProposalFiles;
    }
    if (typeof window !== 'undefined' && Array.isArray(window.currentProposalFiles)) {
        return window.currentProposalFiles;
    }
    return [];
}

/**
 * Opens consignment proposal modal dialog
 */
export function openProposeModal() {
    return callAction('openProposeModal');
}

/**
 * Compresses input image file via HTML5 Canvas
 * @param {File|Blob} file
 * @param {number} [maxWidth=1400]
 * @param {number} [maxHeight=1400]
 * @param {number} [quality=0.82]
 * @returns {Promise<Blob>}
 */
export function compressImage(file, maxWidth = 1400, maxHeight = 1400, quality = 0.82) {
    return callAsyncAction('compressImage', [file, maxWidth, maxHeight, quality], (f) => f);
}

/**
 * Resets proposal form fields and uploaded photos
 */
export function resetProposalForm() {
    return callAction('resetProposalForm');
}

/**
 * Handles newly selected or dropped files
 * @param {FileList|File[]} files
 * @returns {Promise<void>}
 */
export function handleNewProposalFiles(files) {
    return callAsyncAction('handleNewProposalFiles', [files]);
}

/**
 * Opens proposal image in lightbox viewer
 * @param {number} index
 * @param {HTMLElement} [targetEl]
 */
export function openProposalPhotoByIndex(index, targetEl) {
    return callAction('openProposalPhotoByIndex', [index, targetEl]);
}

/**
 * Removes file from proposal uploads list by index
 * @param {number} index
 */
export function removeProposalFile(index) {
    return callAction('removeProposalFile', [index]);
}

/**
 * Re-renders proposal image preview thumbnails grid
 */
export function renderProposalPreviews() {
    return callAction('renderProposalPreviews');
}

/**
 * Submits item proposal form to backend API
 * @returns {Promise<any>}
 */
export function submitProposal() {
    return callAsyncAction('submitProposal');
}

/**
 * Toggles and opens consignment proposal bargain min bid input
 */
export function openPropBargainInput() {
    return callAction('openPropBargainInput');
}

/**
 * Confirms proposal bargain minimum price
 */
export function confirmPropBargainInput() {
    return callAction('confirmPropBargainInput');
}

/**
 * Hides proposal bargain input and restores regular price input
 * @param {boolean} [silent=false]
 */
export function hidePropBargainInput(silent = false) {
    return callAction('hidePropBargainInput', [silent]);
}

/**
 * Cleanly resets proposal bargain state ensuring [ ТОРГ ] toggle button is visible
 */
export function resetPropBargainState() {
    return callAction('resetPropBargainState');
}
