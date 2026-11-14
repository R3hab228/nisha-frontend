// ==========================================
// NISHA DROP MODULE (Lazy Chunk Orchestrator: DROP_ITEM.EXE)
// ==========================================

import { registerActions } from '../core/action-registry.js';

if (typeof document !== 'undefined') {
    import('../../css/lazy-drop-modal.css').catch(() => {});
}
import { initProposalNameGuard, sanitizeProposalNameField } from './drop-state.js';
import {
    confirmPropBargainInput,
    hidePropBargainInput,
    openPropBargainInput,
    resetPropBargainState,
    returnToDesiredPriceMode,
    showBargainSavedToast
} from './drop-bargain.js';
import {
    compressImage,
    handleNewProposalFiles,
    openProposalPhotoByIndex,
    removeProposalFile,
    renderProposalPreviews
} from './drop-images.js';
import {
    initProposalListeners,
    openProposeModal,
    resetProposalForm,
    submitProposal
} from './drop-submit.js';

export * from './drop-state.js';
export * from './drop-bargain.js';
export * from './drop-images.js';
export * from './drop-submit.js';

const DROP_EXPORTS = {
    sanitizeProposalNameField,
    openProposeModal,
    compressImage,
    resetProposalForm,
    openPropBargainInput,
    confirmPropBargainInput,
    showBargainSavedToast,
    hidePropBargainInput,
    returnToDesiredPriceMode,
    resetPropBargainState,
    handleNewProposalFiles,
    openProposalPhotoByIndex,
    removeProposalFile,
    renderProposalPreviews,
    submitProposal
};

Object.entries(DROP_EXPORTS).forEach(([name, fn]) => {
    if (typeof window !== 'undefined') window[name] = fn;
    if (typeof globalThis !== 'undefined') globalThis[name] = fn;
});

initProposalNameGuard();

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProposalListeners);
    } else {
        initProposalListeners();
    }
}

registerActions(DROP_EXPORTS);
