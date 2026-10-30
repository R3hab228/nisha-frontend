// ==========================================
// NISHA STORE - MODULAR PROPOSAL / CONSIGNMENT FACADE
// Safe, typed ES module exports for community item proposals
// ==========================================

/**
 * Returns currently uploaded proposal files array
 * @returns {any[]}
 */
export function getCurrentProposalFiles() {
    if (typeof window !== 'undefined' && Array.isArray(window.currentProposalFiles)) {
        return window.currentProposalFiles;
    }
    return [];
}

/**
 * Opens consignment proposal modal dialog
 */
export function openProposeModal() {
    if (typeof window !== 'undefined' && typeof window.openProposeModal === 'function') {
        return window.openProposeModal();
    }
}

/**
 * Compresses input image file via HTML5 Canvas
 * @param {File|Blob} file
 * @param {number} [maxWidth=1400]
 * @param {number} [maxHeight=1400]
 * @param {number} [quality=0.82]
 * @returns {Promise<Blob>}
 */
export async function compressImage(file, maxWidth = 1400, maxHeight = 1400, quality = 0.82) {
    if (typeof window !== 'undefined' && typeof window.compressImage === 'function') {
        return window.compressImage(file, maxWidth, maxHeight, quality);
    }
    return file;
}

/**
 * Resets proposal form fields and uploaded photos
 */
export function resetProposalForm() {
    if (typeof window !== 'undefined' && typeof window.resetProposalForm === 'function') {
        return window.resetProposalForm();
    }
}

/**
 * Handles newly selected or dropped files
 * @param {FileList|File[]} files
 * @returns {Promise<void>}
 */
export async function handleNewProposalFiles(files) {
    if (typeof window !== 'undefined' && typeof window.handleNewProposalFiles === 'function') {
        return window.handleNewProposalFiles(files);
    }
}

/**
 * Opens proposal image in lightbox viewer
 * @param {number} index
 * @param {HTMLElement} [targetEl]
 */
export function openProposalPhotoByIndex(index, targetEl) {
    if (typeof window !== 'undefined' && typeof window.openProposalPhotoByIndex === 'function') {
        return window.openProposalPhotoByIndex(index, targetEl);
    }
}

/**
 * Removes file from proposal uploads list by index
 * @param {number} index
 */
export function removeProposalFile(index) {
    if (typeof window !== 'undefined' && typeof window.removeProposalFile === 'function') {
        return window.removeProposalFile(index);
    }
}

/**
 * Re-renders proposal image preview thumbnails grid
 */
export function renderProposalPreviews() {
    if (typeof window !== 'undefined' && typeof window.renderProposalPreviews === 'function') {
        return window.renderProposalPreviews();
    }
}

/**
 * Submits item proposal form to backend API
 * @returns {Promise<any>}
 */
export async function submitProposal() {
    if (typeof window !== 'undefined' && typeof window.submitProposal === 'function') {
        return window.submitProposal();
    }
}
