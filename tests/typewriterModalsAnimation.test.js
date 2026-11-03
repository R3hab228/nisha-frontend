import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { triggerModalTypewriter, openModal } from '../src/modules/windows.js';

describe('Typewriter Animation with Blinking Block Cursor Across All Modals', () => {
    let mockElement;
    let mockTypewriter;

    beforeEach(() => {
        mockTypewriter = {
            classList: {
                contains: vi.fn(cls => cls === 'typewriter')
            },
            style: {
                animation: ''
            },
            offsetHeight: 24
        };

        mockElement = {
            id: 'testModal',
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                contains: vi.fn(() => false)
            },
            style: {
                display: 'none'
            },
            querySelectorAll: vi.fn(selector => selector === '.typewriter' ? [mockTypewriter] : []),
            querySelector: vi.fn(selector => selector === '.typewriter' ? mockTypewriter : null)
        };

        globalThis.document = {
            getElementById: vi.fn(id => (id === 'testModal' ? mockElement : null)),
            body: { style: {} }
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('triggerModalTypewriter restarts typewriter animation on target element', () => {
        triggerModalTypewriter(mockElement);
        expect(mockTypewriter.style.animation).toBe('');
    });

    it('triggerModalTypewriter works when passed an element ID string', () => {
        triggerModalTypewriter('testModal');
        expect(globalThis.document.getElementById).toHaveBeenCalledWith('testModal');
        expect(mockTypewriter.style.animation).toBe('');
    });

    it('triggerModalTypewriter works when element itself has typewriter class', () => {
        const directTw = {
            classList: {
                contains: vi.fn(cls => cls === 'typewriter')
            },
            style: { animation: 'existing' },
            offsetHeight: 20
        };
        triggerModalTypewriter(directTw);
        expect(directTw.style.animation).toBe('');
    });

    it('triggerModalTypewriter handles null, undefined, and non-existent elements safely without throwing', () => {
        expect(() => triggerModalTypewriter(null)).not.toThrow();
        expect(() => triggerModalTypewriter(undefined)).not.toThrow();
        expect(() => triggerModalTypewriter('nonExistentId')).not.toThrow();
    });

    it('openModal automatically invokes typewriter reset on opened modal', () => {
        openModal('testModal');
        expect(mockElement.style.display).toBe('flex');
        expect(mockTypewriter.style.animation).toBe('');
    });

    it('verifies index.html has no animation:none disabling typewriter on modal headers', () => {
        const indexPath = path.resolve(__dirname, '../index.html');
        const html = fs.readFileSync(indexPath, 'utf8');

        // All target modals must have typewriter titles
        const requiredTypewriterTitles = [
            'ITEM_INFO.EXE',
            'SECURE_CHECKOUT.EXE',
            'MY_ORDERS.DB',
            'REVIEWS.TXT',
            'PROFILE/LOGIN.EXE',
            'DROP_ITEM.EXE',
            'NEW_REVIEW.EXE',
            'DELIVERY_SUCCESS.LOG',
            'SUPPORT_TICKET.EXE',
            'USER_AGREEMENT.TXT'
        ];

        for (const title of requiredTypewriterTitles) {
            expect(html).toContain(title);
            // Verify there is no animation:none on the modal title line containing this title
            const line = html.split('\n').find(l => l.includes(title));
            expect(line).toBeDefined();
            expect(line).not.toMatch(/style=[^>]*animation:\s*none/i);
            expect(line).toContain('typewriter');
        }
    });
});
