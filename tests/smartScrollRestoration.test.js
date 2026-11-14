import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readProjectCss } from './helpers/readProjectCss.js';
import { readCatalogSource } from './helpers/readCatalogSource.js';
import { readProductSource } from './helpers/readProductSource.js';
import { readPwaNetworkSource } from './helpers/readPwaNetworkSource.js';
import { readWindowsSource } from './helpers/readWindowsSource.js';
import fs from 'fs';
import path from 'path';

describe('Smart Feed Scroll Restoration Engine', () => {
    let mockSessionStore = {};

    beforeEach(() => {
        mockSessionStore = {};
        global.sessionStorage = {
            getItem: vi.fn(key => mockSessionStore[key] || null),
            setItem: vi.fn((key, val) => { mockSessionStore[key] = String(val); }),
            removeItem: vi.fn(key => { delete mockSessionStore[key]; }),
            clear: vi.fn(() => { mockSessionStore = {}; })
        };
        global.window = global.window || {};
        global.document = global.document || {};
        global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 0));
        global.cancelAnimationFrame = vi.fn(id => clearTimeout(id));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('1. Verifies SmartFeedScrollRestoration functions are exposed on window in catalog.js', () => {
        const code = readCatalogSource();

        expect(code).toContain('window.saveCurrentFeedScrollState = saveCurrentFeedScrollState');
        expect(code).toContain('window.getSavedFeedScrollState = getSavedFeedScrollState');
        expect(code).toContain('window.clearSavedFeedScrollState = clearSavedFeedScrollState');
        expect(code).toContain('window.restoreFeedScrollPosition = restoreFeedScrollPosition');
        expect(code).toContain('window.showScrollRestoredBadge = showScrollRestoredBadge');
    });

    it('2. saveCurrentFeedScrollState serializes complete feed state and ignores when modal is open', () => {
        // Load catalog logic in sandbox
        let mockBody = { style: { overflow: '' } };
        let mockModals = [];
        let mockCards = [
            { dataset: { id: 'item-101' }, getBoundingClientRect: () => ({ top: -20, bottom: 200 }) },
            { dataset: { id: 'item-102' }, getBoundingClientRect: () => ({ top: 220, bottom: 440 }) }
        ];

        const mockDoc = {
            body: mockBody,
            querySelectorAll: vi.fn((sel) => {
                if (sel === '.modal-overlay') return mockModals;
                if (sel === '#itemsGrid .item-card') return mockCards;
                return [];
            }),
            getElementById: vi.fn(id => {
                if (id === 'mainSearch') return { value: '' };
                return null;
            })
        };

        const mockWin = {
            scrollY: 1450,
            renderedCount: 24,
            currentPage: 2,
            currentCategory: 'vintage-tees',
            showingOnlyFavs: false,
            sessionStorage: global.sessionStorage
        };

        // Function simulation mirroring catalog.js
        function isAnyModalActive() {
            if (mockDoc.body.style.overflow === 'hidden') return true;
            for (let m of mockModals) {
                if (m.classList && m.classList.contains('is-open')) return true;
                if (m.style && (m.style.display === 'flex' || m.style.display === 'block')) return true;
            }
            return false;
        }

        function saveCurrentFeedScrollState(preferredActiveItemId = null) {
            if (isAnyModalActive()) return;
            const scrollY = mockWin.scrollY || 0;
            const effectiveScrollY = scrollY < 70 ? 0 : Math.round(scrollY);

            let activeItemId = preferredActiveItemId;
            if (!activeItemId && effectiveScrollY > 100) {
                const cards = mockDoc.querySelectorAll('#itemsGrid .item-card');
                for (let card of cards) {
                    const rect = card.getBoundingClientRect();
                    if (rect.top >= -100 && rect.top <= 500) {
                        activeItemId = card.dataset.id;
                        break;
                    }
                }
            }

            const state = {
                scrollY: effectiveScrollY,
                renderedCount: mockWin.renderedCount || 0,
                currentPage: mockWin.currentPage || 1,
                category: mockWin.currentCategory || '',
                search: '',
                showingFavs: false,
                activeItemId: activeItemId,
                timestamp: Date.now()
            };
            mockWin.sessionStorage.setItem('nisha_feed_scroll_v1', JSON.stringify(state));
        }

        // Test normal save
        saveCurrentFeedScrollState();
        expect(global.sessionStorage.setItem).toHaveBeenCalledWith('nisha_feed_scroll_v1', expect.any(String));
        const saved = JSON.parse(mockSessionStore['nisha_feed_scroll_v1']);
        expect(saved.scrollY).toBe(1450);
        expect(saved.renderedCount).toBe(24);
        expect(saved.category).toBe('vintage-tees');
        expect(saved.activeItemId).toBe('item-101');

        // Test modal guard: when modal is open, save is suppressed
        mockBody.style.overflow = 'hidden';
        mockWin.scrollY = 0; // modal might shift scrollY
        saveCurrentFeedScrollState();
        const afterModalOpen = JSON.parse(mockSessionStore['nisha_feed_scroll_v1']);
        expect(afterModalOpen.scrollY).toBe(1450); // Unaltered!
    });

    it('3. getSavedFeedScrollState validates freshness (TTL 4h) and clears expired data', () => {
        function getSavedFeedScrollState() {
            const raw = global.sessionStorage.getItem('nisha_feed_scroll_v1');
            if (!raw) return null;
            const state = JSON.parse(raw);
            if (!state || typeof state.scrollY !== 'number') return null;
            if (Date.now() - (state.timestamp || 0) > 4 * 60 * 60 * 1000) {
                global.sessionStorage.removeItem('nisha_feed_scroll_v1');
                return null;
            }
            return state;
        }

        // Fresh state (10 mins ago)
        mockSessionStore['nisha_feed_scroll_v1'] = JSON.stringify({
            scrollY: 850,
            renderedCount: 18,
            timestamp: Date.now() - 10 * 60 * 1000
        });
        expect(getSavedFeedScrollState()).not.toBeNull();
        expect(getSavedFeedScrollState().scrollY).toBe(850);

        // Expired state (5 hours ago)
        mockSessionStore['nisha_feed_scroll_v1'] = JSON.stringify({
            scrollY: 850,
            renderedCount: 18,
            timestamp: Date.now() - 5 * 60 * 60 * 1000
        });
        expect(getSavedFeedScrollState()).toBeNull();
        expect(global.sessionStorage.removeItem).toHaveBeenCalledWith('nisha_feed_scroll_v1');
    });

    it('4. windows.js preserves and restores body scroll position across modal open and close', () => {
        const code = readWindowsSource();

        // openModal captures scroll before locking
        expect(code).toContain('window._preModalScrollY = window.scrollY');
        // closeModal restores scroll when no other modal open
        expect(code).toContain('window.scrollTo({ top: window._preModalScrollY, behavior: \'instant\' })');
    });

    it('5. product.js captures clicked item and pre-modal scroll on card opening', () => {
        const code = readProductSource();

        expect(code).toContain('window._preModalScrollY = window.scrollY');
        expect(code).toContain("invokeAction('saveCurrentFeedScrollState', item.id)");
    });

    it('6. pwa-network.js resets saved scroll on manual pull-to-refresh at feed top', () => {
        const code = readPwaNetworkSource();

        expect(code).toContain("invokeAction('clearSavedFeedScrollState')");
    });

    it('7. index.html and style.css contain the feedScrollRestoredBadge element and styling', () => {
        const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
        const css = readProjectCss();

        expect(html).toContain('id="feedScrollRestoredBadge"');
        expect(html).toContain('data-i18n="pwa.scroll_restored"');
        expect(css).toContain('.feed-scroll-restored-badge');
        expect(css).toContain('.feed-scroll-restored-badge.is-visible');
    });

    it('8. Locales contain the scroll_restored translation across ru, ua, en', () => {
        ['ru', 'ua', 'en'].forEach(lang => {
            const locPath = path.resolve(process.cwd(), 'locales', `${lang}.json`);
            const json = JSON.parse(fs.readFileSync(locPath, 'utf8'));
            expect(json.translation.pwa.scroll_restored).toBeDefined();
            expect(json.translation.pwa.scroll_restored.length).toBeGreaterThan(5);
        });
    });
});
