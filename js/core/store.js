// ==========================================
// NISHA STORE - UNIFIED REACTIVE STATE STORE
// Centralized Reactive State Engine with Safe Storage Persistence
// ==========================================

(function() {
    'use strict';

    // 1. СХЕМЫ ВСЕХ СВОЙСТВ СОСТОЯНИЯ С АВТОМАТИЧЕСКИМ МАППИНГОМ НА LOCALSTORAGE
    const SCHEMAS = {
        // Корзина и чекаут
        cart: { storageKey: 'nisha_cart', default: () => [], type: 'json' },
        cartTime: { storageKey: 'nisha_cart_time', default: 0, type: 'number' },
        cartReminded: { storageKey: 'nisha_cart_reminded', default: false, type: 'boolean' },
        cartPushSentTime: { storageKey: 'nisha_cart_push_sent_time', default: 0, type: 'number' },
        checkoutData: { storageKey: 'nisha_checkout_data', default: () => ({}), type: 'json' },
        lastOrder: { storageKey: 'nisha_last_order', default: null, type: 'json' },

        // Авторизация и контакты
        lastPhone: { storageKey: 'nisha_last_phone', default: '', type: 'string' },
        lastTg: { storageKey: 'nisha_last_tg', default: '', type: 'string' },
        pendingOtpPhone: { storageKey: 'nisha_pending_otp_phone', default: '', type: 'string' },
        pendingOtpPhoneTime: { storageKey: 'nisha_pending_otp_phone_time', default: 0, type: 'number' },
        pendingOtpTg: { storageKey: 'nisha_pending_otp_tg', default: '', type: 'string' },
        pendingOtpTgTime: { storageKey: 'nisha_pending_otp_tg_time', default: 0, type: 'number' },
        emailPreference: { storageKey: 'nisha_email_preference', default: '', type: 'string' },

        // Заказы и отзывы
        cachedOrders: { storageKey: 'nisha_cached_orders', default: () => [], type: 'json' },
        reviewedOrders: { storageKey: 'nisha_reviewed_orders', default: () => [], type: 'json' },
        dismissedReviews: { storageKey: 'nisha_dismissed_reviews', default: () => [], type: 'json' },

        // История, просмотры и вопросы
        history: { storageKey: 'nisha_history', default: () => [], type: 'json' },
        seenItems: { storageKey: 'nisha_seen_items', default: () => [], type: 'json' },
        searchHistory: { storageKey: 'nisha_search_history', default: () => [], type: 'json' },
        recentSearches: { storageKey: 'nisha_recent_searches', default: () => [], type: 'json' },
        addedViews: { storageKey: 'nisha_added_views', default: () => [], type: 'json' },
        questions: { storageKey: 'nisha_questions', default: () => ({ date: '', count: 0 }), type: 'json' },
        cachedDb: { storageKey: 'nisha_cached_db', default: null, type: 'json' },

        // Настройки сайта и правила
        lang: { storageKey: 'nisha_lang', default: 'ru', type: 'string' },
        flag: { storageKey: 'nisha_flag', default: '🇷🇺', type: 'string' },
        rulesAccepted: { storageKey: 'nisha_rules_accepted', default: false, type: 'boolean' },
        tourDone: { storageKey: 'nisha_tour_done', default: false, type: 'boolean' },
        lastBroadcast: { storageKey: 'nisha_last_broadcast', default: '', type: 'string' },
        visitorId: { storageKey: 'nisha_visitor_id', default: '', type: 'string' },
        lastVisitDate: { storageKey: 'nisha_last_visit_date', default: '', type: 'string' },
        lastHitCount: { storageKey: 'nisha_last_hit_count', default: 0, type: 'number' },

        // Оперативное состояние в памяти (runtime only, без localStorage)
        currentUser: { default: null, type: 'raw' },
        userProfile: { default: null, type: 'raw' },
        favorites: { default: () => [], type: 'raw' },
        allItems: { default: () => [], type: 'raw' },
        filteredItems: { default: () => [], type: 'raw' },
        currentCategory: { default: '', type: 'string' },
        searchQuery: { default: '', type: 'string' },
        showingFavs: { default: false, type: 'boolean' },
        currentPromoDiscount: { default: 0, type: 'number' },
        appliedPromoCode: { default: '', type: 'string' }
    };

    // Карта обратного маппинга: storageKey -> stateKey
    const storageKeyToStateKey = new Map();
    Object.entries(SCHEMAS).forEach(([k, s]) => {
        if (s.storageKey) storageKeyToStateKey.set(s.storageKey, k);
    });

    // 2. БЕЗОПАСНЫЕ СЕРИАЛИЗАТОРЫ И ДЕСЕРИАЛИЗАТОРЫ
    function deserializeValue(raw, schema) {
        if (raw === null || raw === undefined) {
            return typeof schema.default === 'function' ? schema.default() : schema.default;
        }
        switch (schema.type) {
            case 'json':
                try {
                    return JSON.parse(raw);
                } catch (e) {
                    return typeof schema.default === 'function' ? schema.default() : schema.default;
                }
            case 'number': {
                const num = Number(raw);
                return isNaN(num) ? (typeof schema.default === 'function' ? schema.default() : schema.default) : num;
            }
            case 'boolean':
                return raw === 'true' || raw === '1' || raw === true;
            case 'string':
                return String(raw);
            default:
                return raw;
        }
    }

    function serializeValue(val, schema) {
        if (val === null || val === undefined) return null;
        switch (schema.type) {
            case 'json':
                try {
                    return JSON.stringify(val);
                } catch (e) {
                    return null;
                }
            case 'boolean':
                return val ? 'true' : 'false';
            default:
                return String(val);
        }
    }

    // 3. БЕЗОПАСНАЯ РАБОТА С ХРАНИЛИЩЕМ (С ЗАЩИТОЙ ОТ QUOTA EXCEEDED И PRIVACY MODE)
    let isInternalStorageSync = false;

    function safeStorageSet(storageKey, stringVal) {
        try {
            isInternalStorageSync = true;
            localStorage.setItem(storageKey, stringVal);
        } catch (err) {
            console.warn(`[Store] Не удалось записать ${storageKey} в localStorage:`, err);
            if (typeof window.cleanStorageLimits === 'function') {
                try { window.cleanStorageLimits(); } catch (e) {}
            }
        } finally {
            isInternalStorageSync = false;
        }
    }

    function safeStorageRemove(storageKey) {
        try {
            isInternalStorageSync = true;
            localStorage.removeItem(storageKey);
        } catch (err) {
            console.warn(`[Store] Не удалось удалить ${storageKey} из localStorage:`, err);
        } finally {
            isInternalStorageSync = false;
        }
    }

    // 4. КЛАСС РЕАКТИВНОГО ХРАНИЛИЩА (REACTIVE STATE STORE)
    class ReactiveStore {
        constructor() {
            this._state = Object.create(null);
            this._listeners = new Map(); // key -> Set<callback>
            this._globalListeners = new Set(); // Set<callback>
            this._batchQueue = null; // null | Set<key>
            this._initFromStorage();
        }

        // Инициализация начального состояния из localStorage
        _initFromStorage() {
            Object.entries(SCHEMAS).forEach(([key, schema]) => {
                if (schema.storageKey) {
                    let raw = null;
                    try {
                        raw = localStorage.getItem(schema.storageKey);
                    } catch (e) {}
                    this._state[key] = deserializeValue(raw, schema);
                } else {
                    this._state[key] = typeof schema.default === 'function' ? schema.default() : schema.default;
                }
            });
        }

        // Получить значение из памяти (0ms, без JSON.parse)
        get(key) {
            return this._state[key];
        }

        // Установить значение с реактивным оповещением и сохранением в storage
        set(key, value, options = {}) {
            const oldValue = this._state[key];
            if (oldValue === value && typeof value !== 'object') {
                return;
            }

            this._state[key] = value;
            const schema = SCHEMAS[key];

            // Сохранение в localStorage, если ключ персистентный
            if (schema && schema.storageKey && options.save !== false) {
                if (value === null || value === undefined) {
                    safeStorageRemove(schema.storageKey);
                } else {
                    const serialized = serializeValue(value, schema);
                    if (serialized !== null) {
                        safeStorageSet(schema.storageKey, serialized);
                    }
                }
            }

            // Оповещение подписчиков
            if (!options.silent) {
                if (this._batchQueue !== null) {
                    this._batchQueue.add(key);
                } else {
                    this._notify(key, value, oldValue);
                }
            }
        }

        // Функциональное обновление
        update(key, updaterFn, options = {}) {
            if (typeof updaterFn !== 'function') return;
            const current = this.get(key);
            const next = updaterFn(current);
            this.set(key, next, options);
        }

        // Внутреннее оповещение слушателей
        _notify(key, newValue, oldValue) {
            const listeners = this._listeners.get(key);
            if (listeners && listeners.size > 0) {
                listeners.forEach(fn => {
                    try {
                        fn(newValue, oldValue, key);
                    } catch (err) {
                        console.error(`[Store] Ошибка в подписчике ключа "${key}":`, err);
                    }
                });
            }

            if (this._globalListeners.size > 0) {
                const mutation = { key, value: newValue, oldValue };
                this._globalListeners.forEach(fn => {
                    try {
                        fn(mutation);
                    } catch (err) {
                        console.error(`[Store] Ошибка в глобальном подписчике стора:`, err);
                    }
                });
            }
        }

        // Пакетное обновление нескольких ключей (оповещения вызываются один раз в конце)
        batch(callback) {
            if (typeof callback !== 'function') return;
            if (this._batchQueue !== null) {
                // Уже внутри батча
                callback();
                return;
            }
            this._batchQueue = new Set();
            try {
                callback();
            } finally {
                const queuedKeys = this._batchQueue;
                this._batchQueue = null;
                queuedKeys.forEach(k => this._notify(k, this._state[k]));
            }
        }

        // Подписка на изменение ключа или всех изменений
        subscribe(keyOrFn, maybeFn) {
            if (typeof keyOrFn === 'function') {
                this._globalListeners.add(keyOrFn);
                return () => this._globalListeners.delete(keyOrFn);
            }
            const key = keyOrFn;
            const fn = maybeFn;
            if (typeof fn !== 'function') return () => {};

            if (!this._listeners.has(key)) {
                this._listeners.set(key, new Set());
            }
            const set = this._listeners.get(key);
            set.add(fn);

            return () => {
                set.delete(fn);
                if (set.size === 0) this._listeners.delete(key);
            };
        }

        // Одноразовая подписка
        subscribeOnce(key, fn) {
            if (typeof fn !== 'function') return () => {};
            const unsubscribe = this.subscribe(key, (newVal, oldVal, k) => {
                unsubscribe();
                fn(newVal, oldVal, k);
            });
            return unsubscribe;
        }

        // Синхронизация при внешнем изменении storage (из другой вкладки или легаси кода)
        _syncFromExternalStorage(stateKey, rawValue) {
            const schema = SCHEMAS[stateKey];
            if (!schema) return;
            const parsed = deserializeValue(rawValue, schema);
            this.set(stateKey, parsed, { save: false });
        }

        // 5. УДОБНЫЕ ХЕЛПЕРЫ ДЛЯ КОРЗИНЫ
        addToCart(item) {
            if (!item || !item.id) return false;
            const currentCart = Array.isArray(this._state.cart) ? this._state.cart : [];
            if (!currentCart.some(c => c.id === item.id)) {
                const newCart = [...currentCart, item];
                this.batch(() => {
                    this.set('cart', newCart);
                    this.set('cartTime', Date.now());
                    this.set('cartReminded', false);
                });
                return true;
            }
            return false;
        }

        removeFromCart(itemId) {
            const currentCart = Array.isArray(this._state.cart) ? this._state.cart : [];
            const newCart = currentCart.filter(c => c.id !== itemId);
            if (newCart.length !== currentCart.length) {
                this.set('cart', newCart);
                return true;
            }
            return false;
        }

        clearCart() {
            this.batch(() => {
                this.set('cart', []);
                this.set('cartTime', 0);
                this.set('cartReminded', false);
            });
        }

        isInCart(itemId) {
            const currentCart = Array.isArray(this._state.cart) ? this._state.cart : [];
            return currentCart.some(c => c.id === itemId);
        }

        // 6. УДОБНЫЕ ХЕЛПЕРЫ ДЛЯ ИЗБРАННОГО
        isFavorite(itemId) {
            const favs = Array.isArray(this._state.favorites) ? this._state.favorites : [];
            return favs.includes(itemId);
        }

        toggleFavorite(itemId) {
            const favs = Array.isArray(this._state.favorites) ? this._state.favorites : [];
            const exists = favs.includes(itemId);
            const newFavs = exists ? favs.filter(id => id !== itemId) : [...favs, itemId];
            this.set('favorites', newFavs);
            return !exists;
        }

        // 7. УДОБНЫЕ ХЕЛПЕРЫ ДЛЯ ИСТОРИИ ПРОСМОТРОВ
        addHistory(item) {
            if (!item || !item.id) return;
            let hist = Array.isArray(this._state.history) ? [...this._state.history] : [];
            hist = hist.filter(h => h.id !== item.id);
            const img = (Array.isArray(item.images) && item.images.length > 0) ? item.images[0] : (item.img || '');
            hist.unshift({ id: item.id, name: item.name, price: item.price, img: img });
            if (hist.length > 30) hist = hist.slice(0, 30);
            this.set('history', hist);
        }

        // 8. ХЕЛПЕРЫ ДЛЯ ОТЗЫВОВ
        isReviewed(orderId) {
            const rev = Array.isArray(this._state.reviewedOrders) ? this._state.reviewedOrders : [];
            return rev.includes(orderId);
        }

        markReviewed(orderId) {
            const rev = Array.isArray(this._state.reviewedOrders) ? this._state.reviewedOrders : [];
            if (!rev.includes(orderId)) {
                this.set('reviewedOrders', [...rev, orderId]);
            }
        }

        isDismissed(orderId) {
            const dis = Array.isArray(this._state.dismissedReviews) ? this._state.dismissedReviews : [];
            return dis.includes(orderId);
        }

        dismissReview(orderId) {
            const dis = Array.isArray(this._state.dismissedReviews) ? this._state.dismissedReviews : [];
            if (!dis.includes(orderId)) {
                this.set('dismissedReviews', [...dis, orderId]);
            }
        }
    }

    // Создаем единственный экземпляр стора
    const storeInstance = new ReactiveStore();

    // Оборачиваем в Proxy для естественного обращения `store.cart`, `store.cart = [...]`
    const store = new Proxy(storeInstance, {
        get(target, prop, receiver) {
            if (prop in target) {
                const val = target[prop];
                return typeof val === 'function' ? val.bind(target) : val;
            }
            if (prop in target._state) {
                return target.get(prop);
            }
            // Алиасы
            if (prop === 'user') return target.get('currentUser');
            if (prop === 'profile') return target.get('userProfile');
            if (prop === 'cartCount') return (target.get('cart') || []).length;
            if (prop === 'cartTotal') {
                const c = target.get('cart') || [];
                return c.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
            }
            return undefined;
        },
        set(target, prop, value, receiver) {
            if (prop in target && !prop.startsWith('_')) {
                target[prop] = value;
                return true;
            }
            // Алиасы
            if (prop === 'user') { target.set('currentUser', value); return true; }
            if (prop === 'profile') { target.set('userProfile', value); return true; }

            target.set(prop, value);
            return true;
        }
    });

    // 9. БЕСШОВНЫЙ ПЕРЕХВАТЧИК LEGACY STORAGE (ГАРАНТИЯ 100% ОБРАТНОЙ СОВМЕСТИМОСТИ)
    // Любой старый код, который продолжает вызывать localStorage.setItem('nisha_cart', ...),
    // автоматически синхронизируется со стором и вызывает реактивные обновления без переписывания!
    if (typeof Storage !== 'undefined' && Storage.prototype) {
        const nativeSetItem = Storage.prototype.setItem;
        const nativeRemoveItem = Storage.prototype.removeItem;

        Storage.prototype.setItem = function(key, val) {
            nativeSetItem.call(this, key, val);
            if (!isInternalStorageSync && this === localStorage && storageKeyToStateKey.has(key)) {
                const stateKey = storageKeyToStateKey.get(key);
                storeInstance._syncFromExternalStorage(stateKey, val);
            }
        };

        Storage.prototype.removeItem = function(key) {
            nativeRemoveItem.call(this, key);
            if (!isInternalStorageSync && this === localStorage && storageKeyToStateKey.has(key)) {
                const stateKey = storageKeyToStateKey.get(key);
                storeInstance._syncFromExternalStorage(stateKey, null);
            }
        };
    }

    // 10. КРОСС-ВКЛАДОЧНАЯ СИНХРОНИЗАЦИЯ (STORAGE EVENT)
    window.addEventListener('storage', (e) => {
        if (e.storageArea !== localStorage || !e.key) return;
        if (storageKeyToStateKey.has(e.key)) {
            const stateKey = storageKeyToStateKey.get(e.key);
            storeInstance._syncFromExternalStorage(stateKey, e.newValue);
        }
    });

    // 11. АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ С ГЛОБАЛЬНЫМИ ПЕРЕМЕННЫМИ ПРИЛОЖЕНИЯ
    window.cart = store.get('cart');

    // Реактивное обновление window.cart и UI при любых изменениях корзины
    store.subscribe('cart', (newCart) => {
        window.cart = newCart;
        if (typeof window.updateCartUI === 'function') {
            window.updateCartUI();
        }
    });

    // Реактивное обновление избранного
    store.subscribe('favorites', (newFavs) => {
        window.favorites = newFavs;
        if (typeof window.updateFavUI === 'function') {
            window.updateFavUI();
        }
    });

    // Реактивное обновление истории
    store.subscribe('history', () => {
        if (typeof window.renderHistory === 'function') {
            window.renderHistory();
        }
    });

    // Экспорт в глобальную область видимости
    window.store = store;
    window.appStore = store;
    if (typeof globalThis !== 'undefined') {
        globalThis.store = store;
        globalThis.appStore = store;
    }

})();
