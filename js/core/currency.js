// @ts-check
// ==========================================
// NISHA CURRENCY & LIVE FX ENGINE (UAH / USD / EUR)
// ==========================================

import { emitAppEvent, hasAction, invokeAction, registerActions } from './action-registry.js';
import { getRuntimeOpenedItem, getRuntimeStorage } from './runtime-env.js';

export const CURRENCY_STORAGE_KEY = 'nisha_currency';
export const FX_RATES_STORAGE_KEY = 'nisha_fx_rates_v1';
export const CURRENCY_ORDER = /** @type {const} */ (['UAH', 'USD', 'EUR']);
const FX_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов
const FX_FETCH_TIMEOUT_MS = 5000;

const USD_MIN_RATE = 20;
const USD_MAX_RATE = 120;
const EUR_MIN_RATE = 20;
const EUR_MAX_RATE = 140;

export const CURRENCY_SYMBOLS = Object.freeze({
    UAH: '₴',
    USD: '$',
    EUR: '€'
});

const DEFAULT_FX_RATES = Object.freeze({
    UAH: 1,
    USD: 41.5,
    EUR: 45.0
});

/** @typedef {'UAH' | 'USD' | 'EUR'} CurrencyCode */

/** @type {{ UAH: 1, USD: number, EUR: number }} */
let _activeRates = { ...DEFAULT_FX_RATES };
let _ratesUpdatedAt = 0;
let _ratesSource = 'default';
/** @type {Promise<boolean> | null} */
let _inFlightRatesFetch = null;
/** @type {number | null} */
let _pendingPriceRefreshRaf = null;
let _storageSyncBound = false;

/**
 * Нормализует код валюты в строго допустимый набор (`UAH` | `USD` | `EUR`).
 * @param {unknown} raw
 * @returns {CurrencyCode}
 */
export function normalizeCurrencyCode(raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (code === 'USD' || code === '$') return 'USD';
    if (code === 'EUR' || code === '€') return 'EUR';
    return 'UAH';
}

/**
 * Валидирует пару курсов USD/EUR (UAH за 1 единицу валюты) по безопасным границам.
 * @param {unknown} rawUsd
 * @param {unknown} rawEur
 * @returns {{ UAH: 1, USD: number, EUR: number } | null}
 */
export function validateFxRatesPair(rawUsd, rawEur) {
    const usd = Number(rawUsd);
    const eur = Number(rawEur);
    if (!Number.isFinite(usd) || !Number.isFinite(eur)) return null;
    if (usd < USD_MIN_RATE || usd > USD_MAX_RATE) return null;
    if (eur < EUR_MIN_RATE || eur > EUR_MAX_RATE) return null;
    return {
        UAH: 1,
        USD: Number(usd.toFixed(4)),
        EUR: Number(eur.toFixed(4))
    };
}

/** @param {string} key */
function readStoredItem(key) {
    const store = getRuntimeStorage();
    if (store && typeof store.get === 'function') {
        return store.get(key, null);
    }
    try {
        if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch {}
    return null;
}

/** @param {string} key @param {string} value */
function writeStoredItem(key, value) {
    const store = getRuntimeStorage();
    if (store && typeof store.set === 'function') {
        store.set(key, value);
        return;
    }
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {}
}

/**
 * Загружает кэшированные курсы из localStorage, если они валидны.
 */
function hydrateCachedRatesFromStorage() {
    try {
        const raw = readStoredItem(FX_RATES_STORAGE_KEY);
        if (!raw) return;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') return;
        const valid = validateFxRatesPair(parsed.rates?.USD, parsed.rates?.EUR);
        if (!valid) return;
        _activeRates = valid;
        _ratesUpdatedAt = Number(parsed.fetchedAt) || 0;
        _ratesSource = typeof parsed.source === 'string' ? parsed.source : 'cache';
    } catch {}
}
hydrateCachedRatesFromStorage();

/**
 * Возвращает текущую выбранную валюту пользователя (`UAH` | `USD` | `EUR`).
 * @returns {CurrencyCode}
 */
export function getActiveCurrencyCode() {
    return normalizeCurrencyCode(readStoredItem(CURRENCY_STORAGE_KEY));
}

/**
 * Возвращает символ валюты для кнопки-переключателя (`₴` | `$` | `€`).
 * @param {CurrencyCode} [code]
 * @returns {'₴' | '$' | '€'}
 */
export function getCurrencySymbol(code = getActiveCurrencyCode()) {
    const norm = normalizeCurrencyCode(code);
    return CURRENCY_SYMBOLS[norm];
}

/**
 * Возвращает текущие активные курсы обмена (UAH за 1 единицу).
 * @returns {{ rates: { UAH: 1, USD: number, EUR: number }, updatedAt: number, source: string }}
 */
export function getExchangeRatesState() {
    return {
        rates: { ..._activeRates },
        updatedAt: _ratesUpdatedAt,
        source: _ratesSource
    };
}

/**
 * Устанавливает курсы обмена вручную (валидируется границами).
 * @param {{ USD?: number, EUR?: number }} ratesObj
 * @param {string} [source='live']
 * @returns {boolean}
 */
export function applyExchangeRates(ratesObj, source = 'live') {
    if (!ratesObj || typeof ratesObj !== 'object') return false;
    const valid = validateFxRatesPair(ratesObj.USD, ratesObj.EUR);
    if (!valid) return false;

    const changed = valid.USD !== _activeRates.USD || valid.EUR !== _activeRates.EUR;
    _activeRates = valid;
    _ratesUpdatedAt = Date.now();
    _ratesSource = source;

    try {
        writeStoredItem(FX_RATES_STORAGE_KEY, JSON.stringify({
            rates: valid,
            fetchedAt: _ratesUpdatedAt,
            source
        }));
    } catch {}

    return changed;
}

/**
 * Конвертирует сумму из UAH в целевую валюту с чистым округлением.
 * @param {number} amountUah
 * @param {CurrencyCode} [targetCode]
 * @returns {number}
 */
export function convertFromUah(amountUah, targetCode = getActiveCurrencyCode()) {
    const num = Number(amountUah);
    if (!Number.isFinite(num) || num === 0) return 0;
    const code = normalizeCurrencyCode(targetCode);
    if (code === 'UAH') return Math.round(num);

    const rate = _activeRates[code];
    if (!Number.isFinite(rate) || rate <= 0) return Math.round(num);
    const converted = num / rate;
    if (num > 0) return Math.max(1, Math.round(converted));
    return Math.min(-1, Math.round(converted));
}

/**
 * Загружает свежие реальные курсы валют с бэкенда (`/api/exchange-rates`).
 * Безопасно: соблюдает CSP, кэширует на 6ч, дедуплицирует параллельные запросы и никогда не бросает исключений.
 * @param {{ force?: boolean }} [options={}]
 * @returns {Promise<boolean>}
 */
export async function fetchLiveExchangeRates(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();
    if (!force && _ratesUpdatedAt > 0 && (now - _ratesUpdatedAt) < FX_CACHE_TTL_MS) {
        return false;
    }
    if (_inFlightRatesFetch && !force) {
        return _inFlightRatesFetch;
    }

    const task = (async () => {
        try {
            let data = null;
            const g = /** @type {any} */ (globalThis);
            const api = (typeof window !== 'undefined' && window.apiClient) || g.apiClient;
            if (api && typeof api.get === 'function') {
                data = await api.get('/api/exchange-rates', { timeout: FX_FETCH_TIMEOUT_MS, retries: 1 });
            } else if (typeof fetch === 'function') {
                const baseUrl = (typeof window !== 'undefined' && window.ENV && window.ENV.API_BASE_URL)
                    || (typeof window !== 'undefined' && window.BACKEND_URL)
                    || 'https://nisha-api.onrender.com';
                const signal = (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function')
                    ? AbortSignal.timeout(FX_FETCH_TIMEOUT_MS)
                    : undefined;
                const res = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/api/exchange-rates`, { signal });
                if (res && res.ok) {
                    data = await res.json();
                }
            }

            if (data && data.rates) {
                const changed = applyExchangeRates(data.rates, data.source || 'api');
                if (changed && getActiveCurrencyCode() !== 'UAH') {
                    scheduleLivePricesRefresh();
                }
                syncCurrencyToggleUI(false);
                return changed;
            }
        } catch {}
        return false;
    })().finally(() => {
        if (_inFlightRatesFetch === task) {
            _inFlightRatesFetch = null;
        }
    });

    _inFlightRatesFetch = task;
    return task;
}

/**
 * Обновляет отображение меток ценового слайдера в сайдбаре без сброса его UAH-значения.
 */
export function syncPriceFilterCurrencyUI() {
    if (typeof document === 'undefined') return;
    const minInput = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMin'));
    const maxInput = /** @type {HTMLInputElement | null} */ (document.getElementById('priceMax'));
    const minLabel = document.getElementById('priceMinVal');
    const maxLabel = document.getElementById('priceMaxVal');
    const unitEl = document.getElementById('priceCurrencyUnit');
    const g = /** @type {any} */ (globalThis);

    if (minInput && minLabel) {
        const rawMin = Number.parseInt(minInput.value, 10) || 0;
        minLabel.textContent = typeof g.formatPrice === 'function'
            ? g.formatPrice(rawMin, { numberOnly: true })
            : String(convertFromUah(rawMin));
    }
    if (maxInput && maxLabel) {
        const rawMax = Number.parseInt(maxInput.value, 10) || 15000;
        maxLabel.textContent = typeof g.formatPrice === 'function'
            ? g.formatPrice(rawMax, { numberOnly: true })
            : String(convertFromUah(rawMax));
    }
    if (unitEl) {
        const code = getActiveCurrencyCode();
        if (code === 'UAH') {
            const lang = String(readStoredItem('nisha_lang') || 'ua').slice(0, 2).toLowerCase();
            unitEl.textContent = lang === 'en' ? 'UAH' : 'грн';
        } else {
            unitEl.textContent = getCurrencySymbol(code);
        }
    }
}

/**
 * Мгновенно (без пересоздания сетки, без мигания фото и без скачков скролла)
 * обновляет все цены на экране при переключении валюты или приходе свежего курса.
 */
export function refreshAllPricesInDOM() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    // 1. Точечное обновление цен на всех отрендеренных карточках каталога
    if (hasAction('refreshCatalogCardPrices')) {
        invokeAction('refreshCatalogCardPrices');
    }

    // 2. Обновление открытой модалки товара (если открыта)
    const activeItem = getRuntimeOpenedItem();
    const productModal = document.getElementById('productModal');
    const isProductOpen = Boolean(
        activeItem &&
        productModal &&
        productModal.style &&
        (productModal.style.display === 'flex' || productModal.style.display === 'block')
    );
    if (isProductOpen && hasAction('refreshOpenedProductModalPrices')) {
        invokeAction('refreshOpenedProductModalPrices', activeItem);
    }

    // 3. Ползунок цены в сайдбаре и чипсы активных фильтров
    syncPriceFilterCurrencyUI();
    if (hasAction('renderActiveFilterChips')) {
        invokeAction('renderActiveFilterChips');
    }

    // 4. Корзина, итог, промокод и полоска бесплатной доставки
    if (hasAction('updateCartUI')) {
        invokeAction('updateCartUI');
    }

    // 5. История просмотров и похожие товары
    if (hasAction('renderHistory')) {
        invokeAction('renderHistory');
    }
    if (isProductOpen && activeItem && hasAction('renderSimilarItems')) {
        invokeAction('renderSimilarItems', activeItem);
    }

    // 6. Модалка заказов (если открыта)
    const ordersModal = document.getElementById('ordersModal');
    if (ordersModal && ordersModal.style && ordersModal.style.display === 'flex' && hasAction('renderFilteredOrders')) {
        invokeAction('renderFilteredOrders');
    }

    // 7. Инвалидация мемо-кэша живого поиска (чтобы цены в подсказках пересчитались)
    if (hasAction('invalidateLiveSearchFuse')) {
        invokeAction('invalidateLiveSearchFuse');
    }

    emitAppEvent('nisha:currency-changed', {
        currency: getActiveCurrencyCode(),
        rates: { ..._activeRates }
    });
}

/**
 * Коалесцирует множественные переключения в один `requestAnimationFrame` (0 фризов).
 */
export function scheduleLivePricesRefresh() {
    if (typeof requestAnimationFrame !== 'function') {
        refreshAllPricesInDOM();
        return;
    }
    if (_pendingPriceRefreshRaf !== null) return;
    _pendingPriceRefreshRaf = requestAnimationFrame(() => {
        _pendingPriceRefreshRaf = null;
        refreshAllPricesInDOM();
    });
}

/**
 * Синхронизирует кнопки выбора валюты в сайдбаре и модалке профиля.
 * @param {boolean} [animate=false]
 */
export function syncCurrencyToggleUI(animate = false) {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const code = getActiveCurrencyCode();
    const symbol = getCurrencySymbol(code);
    const rateHint = code === 'UAH'
        ? 'UAH (₴)'
        : `${code} (${symbol}) · 1 ${symbol} ≈ ${_activeRates[code].toFixed(2)} ₴`;

    ['profileCurrencyToggleBtn', 'modalProfileCurrencyToggleBtn'].forEach((btnId) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (btn.classList) {
            btn.classList.toggle('is-uah', code === 'UAH');
            btn.classList.toggle('is-usd', code === 'USD');
            btn.classList.toggle('is-eur', code === 'EUR');
            if (animate) {
                btn.classList.remove('is-switching');
                void btn.offsetWidth;
                btn.classList.add('is-switching');
                setTimeout(() => btn.classList && btn.classList.remove('is-switching'), 300);
            }
        }
        if (typeof btn.setAttribute === 'function') {
            btn.setAttribute('data-currency', code);
            btn.setAttribute('aria-label', rateHint);
            btn.setAttribute('title', rateHint);
        }
        const glyphEl = typeof btn.querySelector === 'function' ? btn.querySelector('.currency-glyph') : null;
        if (glyphEl) {
            glyphEl.textContent = symbol;
        } else {
            const stateEl = typeof btn.querySelector === 'function' ? btn.querySelector('.profile-currency-state') : null;
            if (stateEl) stateEl.textContent = symbol;
        }
    });
}

/**
 * Устанавливает валюту, сохраняет её и мгновенно обновляет UI.
 * @param {CurrencyCode} nextCode
 * @param {{ silent?: boolean, animate?: boolean }} [options={}]
 * @returns {CurrencyCode}
 */
export function setCurrencyCode(nextCode, options = {}) {
    const normalized = normalizeCurrencyCode(nextCode);
    writeStoredItem(CURRENCY_STORAGE_KEY, normalized);
    syncCurrencyToggleUI(Boolean(options.animate));

    if (normalized !== 'UAH') {
        fetchLiveExchangeRates().catch(() => {});
    }

    scheduleLivePricesRefresh();

    if (!options.silent && hasAction('showCurrencyToast')) {
        const rate = normalized === 'UAH' ? 1 : _activeRates[normalized];
        invokeAction('showCurrencyToast', normalized, getCurrencySymbol(normalized), rate);
    }

    return normalized;
}

/**
 * Циклически переключает валюту по клику: `UAH (₴) → USD ($) → EUR (€) → UAH (₴)`.
 * @returns {CurrencyCode}
 */
export function cycleCurrency() {
    const current = getActiveCurrencyCode();
    const idx = CURRENCY_ORDER.indexOf(current);
    const next = CURRENCY_ORDER[(idx + 1) % CURRENCY_ORDER.length];
    invokeAction('playSound', 'menu', { kind: 'ui' });
    return setCurrencyCode(next, { animate: true, silent: false });
}

/**
 * Сброс внутреннего состояния (только для юнит-тестов).
 */
export function _resetCurrencyTestState() {
    _activeRates = { ...DEFAULT_FX_RATES };
    _ratesUpdatedAt = 0;
    _ratesSource = 'default';
    _inFlightRatesFetch = null;
    if (_pendingPriceRefreshRaf !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(_pendingPriceRefreshRaf);
    }
    _pendingPriceRefreshRaf = null;
}

// Авто-инициализация UI, фонового обновления курсов и кросс-вкладочной синхронизации
if (typeof document !== 'undefined') {
    const bootCurrencyUI = () => {
        syncCurrencyToggleUI(false);
        syncPriceFilterCurrencyUI();
        const needsEarlyRates = getActiveCurrencyCode() !== 'UAH';
        if (needsEarlyRates) {
            fetchLiveExchangeRates().catch(() => {});
        } else if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            window.requestIdleCallback(() => { fetchLiveExchangeRates().catch(() => {}); }, { timeout: 4000 });
        } else if (typeof setTimeout === 'function') {
            setTimeout(() => { fetchLiveExchangeRates().catch(() => {}); }, 2000);
        }
    };

    if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', bootCurrencyUI);
    } else {
        bootCurrencyUI();
    }
}

if (typeof window !== 'undefined' && !_storageSyncBound && typeof window.addEventListener === 'function') {
    _storageSyncBound = true;
    window.addEventListener('storage', (ev) => {
        if (!ev) return;
        if (ev.key === FX_RATES_STORAGE_KEY) {
            hydrateCachedRatesFromStorage();
            syncCurrencyToggleUI(false);
            if (getActiveCurrencyCode() !== 'UAH') scheduleLivePricesRefresh();
        } else if (ev.key === CURRENCY_STORAGE_KEY) {
            syncCurrencyToggleUI(false);
            scheduleLivePricesRefresh();
        }
    });
}

if (typeof window !== 'undefined') {
    window.getActiveCurrencyCode = getActiveCurrencyCode;
    window.getCurrencySymbol = getCurrencySymbol;
    window.setCurrencyCode = setCurrencyCode;
    window.cycleCurrency = cycleCurrency;
    window.syncCurrencyToggleUI = syncCurrencyToggleUI;
    window.syncPriceFilterCurrencyUI = syncPriceFilterCurrencyUI;
    window.refreshAllPricesInDOM = refreshAllPricesInDOM;
    window.fetchLiveExchangeRates = fetchLiveExchangeRates;
}

registerActions({
    getActiveCurrencyCode,
    getCurrencySymbol,
    getExchangeRatesState,
    convertFromUah,
    setCurrencyCode,
    cycleCurrency,
    syncCurrencyToggleUI,
    syncPriceFilterCurrencyUI,
    refreshAllPricesInDOM,
    fetchLiveExchangeRates
});
