import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createClassList(initial = []) {
    const set = new Set(initial);
    return {
        add: (...names) => names.forEach(n => n && set.add(n)),
        remove: (...names) => names.forEach(n => n && set.delete(n)),
        contains: (name) => set.has(name),
        toggle: (name, force) => {
            const next = typeof force === 'boolean' ? force : !set.has(name);
            if (next) set.add(name);
            else set.delete(name);
            return next;
        }
    };
}

function createFakeEl(id = '', tag = 'div') {
    const listeners = new Map();
    const attrs = new Map();
    const styleMap = new Map();
    const el = {
        id,
        tagName: tag.toUpperCase(),
        type: 'text',
        value: '',
        innerText: '',
        textContent: '',
        _innerHTML: '',
        disabled: false,
        readOnly: false,
        inert: false,
        dataset: {},
        children: [],
        classList: createClassList(),
        style: {
            set display(v) { styleMap.set('display', v); },
            get display() { return styleMap.get('display') || ''; },
            set color(v) { styleMap.set('color', v); },
            get color() { return styleMap.get('color') || ''; },
            set opacity(v) { styleMap.set('opacity', String(v)); },
            get opacity() { return styleMap.get('opacity') || ''; },
            set overflow(v) { styleMap.set('overflow', v); },
            get overflow() { return styleMap.get('overflow') || ''; }
        },
        set innerHTML(v) { el._innerHTML = String(v); },
        get innerHTML() { return el._innerHTML; },
        addEventListener: (ev, fn) => {
            if (!listeners.has(ev)) listeners.set(ev, []);
            listeners.get(ev).push(fn);
        },
        dispatchEvent: (ev) => {
            (listeners.get(ev.type) || []).forEach(fn => fn(ev));
        },
        setAttribute: (k, v) => attrs.set(k, String(v)),
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        hasAttribute: (k) => attrs.has(k),
        removeAttribute: (k) => attrs.delete(k),
        appendChild: (child) => {
            if (child && child.tagName === 'FRAGMENT' && Array.isArray(child.children)) {
                el.children.push(...child.children);
                child.children = [];
                return child;
            }
            el.children.push(child);
            return child;
        },
        replaceChildren: () => { el._innerHTML = ''; el.children = []; },
        querySelector: () => null,
        focus: vi.fn(),
        blur: vi.fn(),
        setSelectionRange: vi.fn()
    };
    return el;
}

describe('Modular Profile, Auth, Contacts, Delivery & Favorites Deep Suite (js/profile/*.js)', () => {
    let elements;
    let storeMap;
    let sessionMap;
    let storageMock;
    let mockToast;
    let mockSupabase;
    let origDoc;
    let origWin;
    let origStorage;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.resetModules();

        origDoc = globalThis.document;
        origWin = globalThis.window;
        origStorage = globalThis.storage;

        elements = new Map();
        const getEl = (id) => {
            if (!elements.has(id)) elements.set(id, createFakeEl(id));
            return elements.get(id);
        };

        storeMap = new Map();
        sessionMap = new Map();
        storageMock = {
            get: (k, fb = null) => (storeMap.has(k) ? storeMap.get(k) : fb),
            set: (k, v) => storeMap.set(k, String(v)),
            remove: (k) => storeMap.delete(k),
            getJSON: (k, fb = null) => (storeMap.has(k) ? JSON.parse(storeMap.get(k)) : fb),
            setJSON: (k, v) => storeMap.set(k, JSON.stringify(v)),
            session: {
                getJSON: (k, fb = null) => (sessionMap.has(k) ? JSON.parse(sessionMap.get(k)) : fb),
                setJSON: (k, v) => sessionMap.set(k, JSON.stringify(v)),
                set: (k, v) => sessionMap.set(k, String(v))
            }
        };

        mockToast = vi.fn();

        const queryChain = {
            select: vi.fn(() => queryChain),
            eq: vi.fn(() => queryChain),
            neq: vi.fn(() => queryChain),
            ilike: vi.fn(() => queryChain),
            limit: vi.fn(async () => ({ data: [], error: null })),
            single: vi.fn(async () => ({ data: null, error: null })),
            update: vi.fn(() => ({ eq: vi.fn(async () => ({ data: null, error: null })) })),
            upsert: vi.fn(async () => ({ data: null, error: null })),
            insert: vi.fn(async () => ({ data: null, error: null })),
            delete: vi.fn(() => ({ match: vi.fn(async () => ({ data: null, error: null })) }))
        };

        mockSupabase = {
            auth: {
                getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
                signUp: vi.fn(async () => ({ data: { user: { id: 'u-1', email: 'a@b.co' } }, error: null })),
                signInWithPassword: vi.fn(async () => ({ data: { user: { id: 'u-1' } }, error: null })),
                signOut: vi.fn(async () => ({ error: null })),
                resetPasswordForEmail: vi.fn(async () => ({ error: null })),
                signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
                updateUser: vi.fn(async () => ({ data: {}, error: null })),
                onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
            },
            from: vi.fn(() => queryChain),
            rpc: vi.fn(async () => ({ data: null, error: null })),
            channel: vi.fn(() => {
                const ch = { on: vi.fn(() => ch), subscribe: vi.fn(() => ch) };
                return ch;
            }),
            removeChannel: vi.fn()
        };

        const docListeners = new Map();
        globalThis.document = {
            readyState: 'complete',
            activeElement: null,
            body: { style: {} },
            getElementById: (id) => getEl(id),
            querySelector: vi.fn(() => null),
            querySelectorAll: vi.fn(() => []),
            createElement: (tag) => createFakeEl('', tag),
            createDocumentFragment: () => createFakeEl('frag', 'fragment'),
            addEventListener: (ev, fn) => {
                if (!docListeners.has(ev)) docListeners.set(ev, []);
                docListeners.get(ev).push(fn);
            },
            _docListeners: docListeners,
            visibilityState: 'visible'
        };

        globalThis.window = globalThis;
        globalThis.storage = storageMock;
        globalThis.getSupabase = () => mockSupabase;
        globalThis.showToast = mockToast;
        globalThis.location = { origin: 'https://www.nisha-store.shop', href: 'https://www.nisha-store.shop/' };
        globalThis.open = vi.fn(() => ({ closed: false }));
        globalThis.scrollTo = vi.fn();
        globalThis.escapeHtml = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        globalThis.currentUser = undefined;
        globalThis.userProfile = undefined;
        globalThis.favorites = undefined;
        globalThis.isRegMode = undefined;
        globalThis.showingOnlyFavs = false;
        globalThis.cart = [];
        globalThis.allItems = [];
        globalThis.apiClient = { post: vi.fn(async () => ({ success: true, data: [] })) };
        globalThis.store = { set: vi.fn() };
        delete globalThis.i18next;
        delete globalThis.withWebLock;
        delete globalThis.getNPStorageAsync;
        delete globalThis.setNPStorage;
        delete globalThis.filterAndSortBranches;
        delete globalThis.showTerminalModal;
        delete globalThis.applyFilters;
        delete globalThis.updateCartUI;
        delete globalThis.syncCartToServer;
        delete globalThis.subscribeUserRealtime;
        delete globalThis.syncUserBargains;
        delete globalThis.checkUnreadSupportReplies;
        delete globalThis.clearCheckoutDraft;
        delete globalThis.resetCheckoutAddressState;
        delete globalThis.updateProposeAndCheckoutFields;
        delete globalThis.updateCardDOM;
        delete globalThis.removeSoldItemFromCart;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        globalThis.document = origDoc;
        globalThis.window = origWin;
        globalThis.storage = origStorage;
    });

    it('1. maintains an acyclic ES module DAG and re-exports full profile API via barrel', async () => {
        const files = [
            'profile.js',
            'profile-state.js',
            'profile-favorites.js',
            'profile-contacts.js',
            'profile-delivery.js',
            'profile-session.js',
            'profile-auth.js'
        ];
        const graph = new Map();
        for (const f of files) {
            const code = readFileSync(resolve(ROOT_DIR, 'js/profile', f), 'utf8');
            const deps = [];
            const re = /(?:import|export\s+\*)\s+(?:[\s\S]*?\s+from\s+)?['"]\.\/([^'"]+)['"]/g;
            let m;
            while ((m = re.exec(code)) !== null) {
                deps.push(m[1]);
            }
            graph.set(f, deps);
        }

        const visiting = new Set();
        const visited = new Set();
        const visit = (node) => {
            expect(visiting.has(node)).toBe(false);
            if (visited.has(node)) return;
            visiting.add(node);
            for (const dep of graph.get(node) || []) visit(dep);
            visiting.delete(node);
            visited.add(node);
        };
        files.forEach(visit);

        const mod = await import('../js/profile/profile.js');
        [
            'profileState', 'checkSession', 'openProfileModal', 'handleAuth', 'toggleRegMode',
            'handleForgotPassword', 'logout', 'loginWithGoogle', 'initAuthListener',
            'renderProfilePhone', 'renderProfileTg', 'showContactInput', 'saveContactFromInput',
            'checkPendingContactVerification', 'searchProfileNPCity', 'loadProfileBranches',
            'renderProfileDelivery', 'saveProfileDeliveryFromForm', 'loadFavorites', 'toggleFav',
            'filterFavorites', 'updateFavBadge'
        ].forEach(sym => {
            expect(mod[sym]).toBeDefined();
        });
        expect(typeof globalThis.checkSession).toBe('function');
        expect(typeof globalThis.toggleFav).toBe('function');
        expect(typeof globalThis.saveDeliveryToProfile).toBe('function');
    });

    it('2. profile-state.js synchronizes reactive window.* globals bidirectionally with profileState', async () => {
        storeMap.set('nisha_cached_favorites', JSON.stringify(['fav-cached-1']));
        const { profileState } = await import('../js/profile/profile-state.js');

        expect(profileState.favorites).toEqual(['fav-cached-1']);
        expect(window.favorites).toEqual(['fav-cached-1']);

        window.userProfile = { full_name: 'Test User', phone: '+380991112233' };
        expect(profileState.userProfile.full_name).toBe('Test User');

        profileState.currentUser = { id: 'uid-99', email: 'test@nisha.shop' };
        expect(window.currentUser.id).toBe('uid-99');

        profileState.isRegMode = true;
        expect(window.isRegMode).toBe(true);
    });

    it('3. profile-auth.js handles register upsert, forgot-password validation, logout cleanup & auth listener events', async () => {
        const { handleAuth, handleForgotPassword, logout, initAuthListener } = await import('../js/profile/profile-auth.js');
        const { profileState } = await import('../js/profile/profile-state.js');

        // Register requires nickname
        document.getElementById('authEmail').value = 'new@nisha.shop';
        document.getElementById('authPass').value = 'strongpass12';
        document.getElementById('authUsername').value = '';
        await handleAuth('register', false);
        expect(mockToast).toHaveBeenCalledWith('Для регистрации нужен никнейм!', 'error');

        // Valid register calls signUp + profiles.upsert
        document.getElementById('authUsername').value = 'ArchiveKing';
        const upsertMock = vi.fn(async () => ({ error: null }));
        mockSupabase.from.mockImplementation(() => ({
            select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }),
            upsert: upsertMock
        }));
        await handleAuth('register', false);
        expect(upsertMock).toHaveBeenCalledWith({ id: 'u-1', username: 'ArchiveKing' }, { onConflict: 'id' });

        // Auth error localization
        mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({ data: null, error: { message: 'Email not confirmed' } });
        await handleAuth('login', false);
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('Подтвердите email'), 'error');

        // Forgot password escapes HTML email
        document.getElementById('modalAuthEmail').value = 'user+tag@nisha.shop';
        await handleForgotPassword(true);
        expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user+tag@nisha.shop', {
            redirectTo: 'https://www.nisha-store.shop'
        });

        // Logout clears storage & SW api cache
        storeMap.set('nisha_last_phone', '+380671234567');
        storeMap.set('nisha_profile_delivery', '{"full_name":"X"}');
        globalThis.caches = { delete: vi.fn(async () => true) };
        globalThis.applyFilters = vi.fn();
        await logout();
        expect(storeMap.has('nisha_last_phone')).toBe(false);
        expect(storeMap.has('nisha_profile_delivery')).toBe(false);
        expect(globalThis.caches.delete).toHaveBeenCalledWith('nisha-api-v2');
        expect(globalThis.applyFilters).toHaveBeenCalled();

        // Auth listener handles TOKEN_REFRESHED and SIGNED_OUT
        let authCb = null;
        mockSupabase.auth.onAuthStateChange.mockImplementation((cb) => { authCb = cb; });
        initAuthListener();
        await authCb('TOKEN_REFRESHED', { user: { id: 'u-refreshed' } });
        expect(profileState.currentUser.id).toBe('u-refreshed');
        await authCb('SIGNED_OUT', null);
        expect(profileState.currentUser).toBeNull();
    });

    it('4. profile-contacts.js validates phone/TG, blocks blacklisted numbers, enforces 10s cooldown & resolves dual OTP', async () => {
        const contacts = await import('../js/profile/profile-contacts.js');
        const { profileState } = await import('../js/profile/profile-state.js');
        contacts.resetContactOtpTestFlags();
        profileState.currentUser = { id: 'user-otp-1' };

        // Blacklisted phone rejection
        const phoneInput = document.getElementById('profilePhoneInput');
        phoneInput.value = '0991112233';
        mockSupabase.from.mockImplementation((table) => {
            if (table === 'blacklist') {
                return { select: () => ({ eq: () => ({ limit: async () => ({ data: [{ phone: '+380991112233' }], error: null }) }) }) };
            }
            return { select: () => ({ neq: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }), ilike: () => ({ limit: async () => ({ data: [] }) }) }) }) };
        });
        await contacts.saveContactFromInput('phone', false);
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('ЗАБЛОКИРОВАН'), 'error');

        // Clean phone passes -> RPC generate_secure_otp + deep link + 10s cooldown
        mockSupabase.from.mockImplementation((table) => {
            if (table === 'blacklist') {
                return { select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) };
            }
            return {
                select: () => ({
                    eq: () => ({ single: async () => ({ data: { phone: '+380991112233', tg: '@linked_tg' }, error: null }) }),
                    neq: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }), ilike: () => ({ limit: async () => ({ data: [] }) }) })
                }),
                update: () => ({ eq: async () => ({ error: null }) })
            };
        });
        mockSupabase.rpc.mockImplementation(async (name) => {
            if (name === 'check_contact_available') return { data: true, error: null };
            if (name === 'generate_secure_otp') return { error: null };
            if (name === 'check_otp_verified') return { data: true, error: null };
            return { data: null, error: null };
        });

        await contacts.saveContactFromInput('phone', false);
        expect(globalThis.open).toHaveBeenCalledWith(
            expect.stringContaining('t.me/nisha_store1_bot?start=otp_user-otp-1_380991112233'),
            '_blank'
        );

        // Cooldown prevents immediate retry
        await contacts.saveContactFromInput('phone', false);
        expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('Подождите'), 'info');

        // Background OTP poll completes and detects linked Telegram too
        await contacts.checkPendingPhoneVerification();
        expect(profileState.userProfile.phone).toBe('+380991112233');
        expect(profileState.userProfile.tg).toBe('@linked_tg');
        expect(mockToast).toHaveBeenCalledWith('Номер и Telegram подтверждены!', 'success');

        // Verify Telegram normalization & removal
        contacts.showContactInput('tg', true);
        const mTgInput = document.getElementById('modalProfileTgInput');
        mTgInput.value = 'https://t.me/archive_drop';
        mTgInput.oninput();
        expect(mTgInput.value).toBe('@archive_drop');

        await contacts.removeProfileContact('tg');
        expect(profileState.userProfile.tg).toBeNull();
        expect(storeMap.has('nisha_last_tg')).toBe(false);
    });

    it('5. profile-delivery.js queries NP cities/branches, reuses branchall IDB cache, saves refs & clears checkout draft', async () => {
        const delivery = await import('../js/profile/profile-delivery.js');
        const { profileState } = await import('../js/profile/profile-state.js');
        profileState.currentUser = { id: 'u-deliv' };
        profileState.userProfile = {};

        globalThis.clearCheckoutDraft = vi.fn();
        globalThis.resetCheckoutAddressState = vi.fn();

        // Short city query hides dropdown
        await delivery.searchProfileNPCity(false, 'А');
        expect(document.getElementById('profileDeliveryCityDropdown').style.display).toBe('none');

        // NP proxy returns city -> click selects ref & loads branches from branchall cache
        globalThis.apiClient.post.mockResolvedValueOnce({
            success: true,
            data: [{
                Addresses: [{ Present: 'м. Львів', DeliveryCity: 'city-lviv-ref', Ref: 'city-lviv-ref' }]
            }]
        });
        globalThis.getNPStorageAsync = vi.fn(async (key) => {
            if (key === 'branchall_city-lviv-ref_') {
                return [
                    { Ref: 'br-1', Description: 'Відділення №1 (до 30 кг)', TypeOfWarehouse: 'std', Number: '1' },
                    { Ref: 'po-2', Description: 'Поштомат №205', TypeOfWarehouse: 'f9316480-5f2d-425d-bc2c-ac7cd29decf0', Number: '205' }
                ];
            }
            return null;
        });
        globalThis.filterAndSortBranches = vi.fn((list, q) => list.filter(b => b.Description.includes(q)));

        await delivery.searchProfileNPCity(false, 'Львів');
        const cityDrop = document.getElementById('profileDeliveryCityDropdown');
        expect(cityDrop.children.length).toBe(1);

        // Select city option -> auto-resolves branch list via branchall cache
        cityDrop.children[0].onclick({ preventDefault: vi.fn() });
        await vi.advanceTimersByTimeAsync(10);
        expect(delivery.profileSelectedCityRef.desktop).toBe('city-lviv-ref');

        const branchDrop = document.getElementById('profileDeliveryBranchDropdown');
        expect(branchDrop.children.length).toBe(2);
        expect(branchDrop.children[1].className).toBe('profile-np-item-postomat');

        // Select postomat & save delivery form
        branchDrop.children[1].onclick({ preventDefault: vi.fn() });
        document.getElementById('profileDeliveryFullName').value = 'Петренко Іван';
        await delivery.saveProfileDeliveryFromForm(false);

        expect(globalThis.clearCheckoutDraft).toHaveBeenCalled();
        expect(globalThis.resetCheckoutAddressState).toHaveBeenCalled();
        expect(storeMap.get('nisha_profile_delivery_refs')).toContain('po-2');
        expect(mockToast).toHaveBeenCalledWith('Данные доставки сохранены!', 'success');

        // Fast-forward lock timer -> enters read-only [ ИЗМЕНИТЬ ] state
        await vi.advanceTimersByTimeAsync(850);
        expect(document.getElementById('profileDeliveryFullName').readOnly).toBe(true);
        expect(document.getElementById('profileDeliverySaveBtn').innerText).toBe('[ ИЗМЕНИТЬ ]');
    });

    it('6. profile-session.js handles legacy schema fallback, cart merge, username healing & Realtime notifications', async () => {
        const session = await import('../js/profile/profile-session.js');
        const { profileState } = await import('../js/profile/profile-state.js');

        const authUpdateUser = vi.fn(async () => ({ error: null }));
        const profileUpdateEq = vi.fn(() => ({ then: () => ({ catch: () => {} }) }));
        let selectCalls = 0;

        mockSupabase.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: 'usr-sess', email: 'collector@nisha.shop', user_metadata: {} } },
            error: null
        });
        mockSupabase.auth.updateUser = authUpdateUser;

        mockSupabase.from.mockImplementation((table) => {
            if (table === 'favorites') {
                return { select: () => ({ eq: async () => ({ data: [{ item_id: 'item-a' }], error: null }) }) };
            }
            return {
                select: () => ({
                    eq: () => ({
                        limit: async () => {
                            selectCalls += 1;
                            if (selectCalls === 1) return { data: null, error: { message: 'column full_name missing' } };
                            return { data: [{ id: 'usr-sess', username: 'User', cart: [{ id: 'db-1', name: 'Jacket', _isSold: true }] }], error: null };
                        }
                    })
                }),
                update: () => ({ eq: profileUpdateEq })
            };
        });

        const listeners = {};
        mockSupabase.channel.mockImplementation((name) => {
            const ch = {
                on: (_evt, _cfg, cb) => { listeners[name] = cb; return ch; },
                subscribe: () => ch
            };
            return ch;
        });

        globalThis.cart = [{ id: 'local-1', name: 'Hoodie' }];
        globalThis.syncCartToServer = vi.fn(async () => {});
        globalThis.subscribeUserRealtime = vi.fn();
        globalThis.syncUserBargains = vi.fn();
        globalThis.showTerminalModal = vi.fn();
        globalThis.allItems = [{ id: 'db-1', name: 'Jacket', status: 'available' }];
        globalThis.updateCardDOM = vi.fn();
        globalThis.removeSoldItemFromCart = vi.fn();

        await session.checkSession();

        // Fallback query worked + username healed to 'collector' + cart merged & stripped _isSold
        expect(selectCalls).toBe(2);
        expect(profileState.userProfile.username).toBe('collector');
        expect(authUpdateUser).toHaveBeenCalledWith({
            data: expect.objectContaining({ display_name: 'collector', username: 'collector' })
        });
        expect(globalThis.cart.map(i => i.id)).toEqual(['local-1', 'db-1']);
        expect(globalThis.cart[1]._isSold).toBeUndefined();
        expect(globalThis.subscribeUserRealtime).toHaveBeenCalledWith('usr-sess');
        expect(globalThis.syncUserBargains).toHaveBeenCalled();

        // Realtime order completion & TTN triggers clean modals + catalog sold sync
        listeners['order-status-updates']({
            old: { status: 'Оформлен', tracking_number: '' },
            new: { id: 'abc123-def', status: 'Завершен', tracking_number: '204500001234', items: [{ id: 'db-1', name: 'Jacket' }] }
        });
        expect(globalThis.allItems[0].status).toBe('sold');
        expect(globalThis.showTerminalModal).toHaveBeenCalledWith(
            'ORDER_COMPLETED.LOG',
            expect.any(String),
            '[ ОСТАВИТЬ ОТЗЫВ ]',
            expect.any(Function)
        );
        expect(globalThis.showTerminalModal).toHaveBeenCalledWith(
            'TRACKING_NUMBER.LOG',
            expect.any(String),
            '[ ОТСЛЕДИТЬ ]',
            expect.any(Function)
        );

        // Realtime Q&A answer triggers QUESTION_ANSWERED.LOG
        listeners['qa-updates']({
            old: { answer: '' },
            new: { item_id: 'db-1', answer: 'Доступен в размере M' }
        });
        expect(globalThis.showTerminalModal).toHaveBeenCalledWith(
            'QUESTION_ANSWERED.LOG',
            expect.stringContaining('Доступен в размере M'),
            '[ ПОСМОТРЕТЬ ТОВАР ]',
            expect.any(Function)
        );
    });

    it('7. profile-favorites.js toggles favorites under double-click & Web Lock guards, updates DOM/analytics & filterFavorites', async () => {
        const favs = await import('../js/profile/profile-favorites.js');
        const { profileState } = await import('../js/profile/profile-state.js');

        const modalStar = document.getElementById('modalFavStar');
        globalThis.currentOpenedItem = { id: 'item-42', name: 'Archive Parka' };
        globalThis.allItems = [{ id: 'item-42', name: 'Archive Parka' }];
        globalThis.analytics = { trackFavorite: vi.fn() };
        globalThis.showFavoriteToast = vi.fn();
        globalThis.withWebLock = vi.fn(async (_lock, fn) => fn());
        globalThis.applyFilters = vi.fn();

        // Auth guard
        await favs.toggleFav(null, 'item-42');
        expect(mockToast).toHaveBeenCalledWith('Пожалуйста, войдите в аккаунт', 'error');

        // Signed in -> add favorite
        profileState.currentUser = { id: 'fav-user' };
        await favs.toggleFav({ preventDefault: vi.fn(), stopPropagation: vi.fn() }, 'item-42');
        expect(globalThis.withWebLock).toHaveBeenCalledWith('nisha_fav_lock', expect.any(Function));
        expect(profileState.favorites).toContain('item-42');
        expect(modalStar.classList.contains('active')).toBe(true);
        expect(globalThis.analytics.trackFavorite).toHaveBeenCalledWith('item-42', true);
        expect(globalThis.showFavoriteToast).toHaveBeenCalledWith(globalThis.allItems[0], true, null);
        expect(document.getElementById('favCountBadge').innerText).toBe('[1]');

        // Double-click inside 300ms window is suppressed
        await favs.toggleFav(null, 'item-42');
        expect(profileState.favorites).toEqual(['item-42']);

        // After 300ms cooldown -> remove favorite
        await vi.advanceTimersByTimeAsync(350);
        await favs.toggleFav(null, 'item-42');
        expect(profileState.favorites).toEqual([]);
        expect(globalThis.showFavoriteToast).toHaveBeenCalledWith(globalThis.allItems[0], false, null);

        // filterFavorites toggles showingOnlyFavs & triggers applyFilters
        favs.filterFavorites();
        expect(window.showingOnlyFavs).toBe(true);
        expect(document.getElementById('favNav').style.color).toBe('#fff');
        expect(globalThis.applyFilters).toHaveBeenCalledWith(false, false);
    });
});
