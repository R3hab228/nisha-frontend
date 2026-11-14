import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
    globalThis.window = globalThis.window || globalThis;
    if (typeof globalThis.window.addEventListener !== 'function') {
        globalThis.window.addEventListener = () => {};
    }
    if (typeof globalThis.localStorage === 'undefined') {
        const mem = new Map();
        globalThis.localStorage = {
            getItem: k => (mem.has(k) ? mem.get(k) : null),
            setItem: (k, v) => mem.set(k, String(v)),
            removeItem: k => mem.delete(k),
            clear: () => mem.clear()
        };
    }
});

import '../js/core/store.js';
import { hasAction, resolveAction } from '../js/core/action-registry.js';
import {
    getProposalFiles,
    setProposalFiles,
    sanitizeProposalNameField
} from '../js/drop/drop-state.js';
import {
    openPropBargainInput,
    confirmPropBargainInput,
    hidePropBargainInput,
    resetPropBargainState
} from '../js/drop/drop-bargain.js';
import {
    removeProposalFile,
    renderProposalPreviews
} from '../js/drop/drop-images.js';
import '../js/drop/drop.js';

function createMockNode() {
    const attrs = new Map();
    const set = new Set();
    const children = [];
    return {
        className: '',
        innerHTML: '',
        innerText: '',
        textContent: '',
        value: '',
        placeholder: '',
        dataset: {},
        style: {},
        children,
        setAttribute: (k, v) => attrs.set(k, String(v)),
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        classList: {
            add: c => set.add(c),
            remove: c => set.delete(c),
            contains: c => set.has(c)
        },
        appendChild: (child) => children.push(child),
        replaceChildren: () => { children.length = 0; },
        addEventListener: vi.fn(),
        focus: vi.fn(),
        remove: vi.fn()
    };
}

describe('Modular Drop / Propose Suite (js/drop/drop-*.js)', () => {
    const store = globalThis.store;

    beforeEach(() => {
        globalThis.window = globalThis.window || globalThis;
        window.store = store;
        store.set('currentProposalFiles', []);
        setProposalFiles([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.document;
    });

    it('1. Registers all drop/proposal actions in ActionRegistry', () => {
        [
            'openProposeModal',
            'compressImage',
            'resetProposalForm',
            'handleNewProposalFiles',
            'renderProposalPreviews',
            'removeProposalFile',
            'openProposalPhotoByIndex',
            'submitProposal',
            'openPropBargainInput',
            'confirmPropBargainInput',
            'hidePropBargainInput',
            'resetPropBargainState',
            'sanitizeProposalNameField'
        ].forEach(name => {
            expect(hasAction(name)).toBe(true);
            expect(typeof resolveAction(name)).toBe('function');
        });
    });

    it('2. Synchronizes currentProposalFiles bi-directionally with reactive store', () => {
        const item = { file: { name: 'hoodie.webp', size: 12000 }, url: 'blob:1' };
        setProposalFiles([item]);
        expect(store.get('currentProposalFiles')).toHaveLength(1);
        expect(window.currentProposalFiles[0].url).toBe('blob:1');
        expect(getProposalFiles()[0].file.name).toBe('hoodie.webp');

        window.currentProposalFiles = [];
        expect(store.get('currentProposalFiles')).toEqual([]);
        expect(getProposalFiles()).toEqual([]);
    });

    it('3. Sanitizes autofilled buyer name in #propName without clearing user-typed names', () => {
        window.storage = {
            getJSON: (k) => (k === 'nisha_profile_delivery' ? { full_name: 'Иван Петренко' } : null)
        };
        const propName = {
            value: 'иван   петренко',
            dataset: {}
        };
        globalThis.document = {
            getElementById: (id) => (id === 'propName' ? propName : null)
        };

        sanitizeProposalNameField();
        expect(propName.value).toBe('');

        propName.value = 'Иван Петренко';
        propName.dataset.userTyped = '1';
        sanitizeProposalNameField();
        expect(propName.value).toBe('Иван Петренко');
        delete window.storage;
    });

    it('4. Renders proposal previews cleanly and removes items by index without leaving orphan nodes', () => {
        const container = createMockNode();
        const placeholder = createMockNode();
        globalThis.document = {
            body: createMockNode(),
            getElementById: (id) => {
                if (id === 'propPreviewContainer') return container;
                if (id === 'propPlaceholder') return placeholder;
                return null;
            },
            createElement: () => createMockNode()
        };

        setProposalFiles([
            { file: { name: '1.jpg', size: 10 }, url: 'https://cdn.example/1.jpg' },
            { file: { name: '2.jpg', size: 10 }, url: 'https://cdn.example/2.jpg' }
        ]);
        renderProposalPreviews();
        expect(container.children).toHaveLength(2);
        expect(container.children[0].style.backgroundImage).toContain('https://cdn.example/1.jpg');
        expect(container.children[1].style.backgroundImage).toContain('https://cdn.example/2.jpg');

        removeProposalFile(0);
        expect(getProposalFiles()).toHaveLength(1);
        expect(getProposalFiles()[0].url).toBe('https://cdn.example/2.jpg');
        expect(container.children).toHaveLength(1);
    });

    it('5. Validates min bargain price >= 100 UAH and toggles/resets bargain UI cleanly', () => {
        const els = {
            propPrice: createMockNode(),
            propPriceLabel: createMockNode(),
            propMinBargainBox: createMockNode(),
            propMinBargainPrice: createMockNode(),
            btnTogglePropBargain: createMockNode(),
            btnConfirmPropBargain: createMockNode()
        };
        els.propMinBargainBox.style.display = 'none';
        els.btnConfirmPropBargain.style.display = 'none';

        globalThis.document = {
            getElementById: (id) => els[id] || null
        };
        window.showToast = vi.fn();

        openPropBargainInput();
        expect(els.propMinBargainBox.style.display).toBe('flex');
        expect(els.btnConfirmPropBargain.style.display).toBe('flex');

        els.propMinBargainPrice.value = '50';
        confirmPropBargainInput();
        expect(window.showToast).toHaveBeenCalled();

        els.propMinBargainPrice.value = '350';
        confirmPropBargainInput();
        expect(els.propMinBargainPrice.value).toBe('350');
        expect(els.btnTogglePropBargain.classList.contains('active')).toBe(true);

        hidePropBargainInput(true);
        expect(els.propMinBargainPrice.value).toBe('');

        resetPropBargainState();
        expect(els.btnTogglePropBargain.classList.contains('active')).toBe(false);
        delete window.showToast;
    });
});
