// ==========================================
// NISHA NOVA POSHTA — HELPERS, PARSING, RANKING & DELIVERY COST
// ==========================================

import {
    cartState,
    parseCartPrice,
    getActiveCart,
    setSelectedCityRefState,
    setSelectedBranchRefState
} from './cart-state.js';
import { hasAction, invokeAction, registerActions } from '../core/action-registry.js';

/**
 * Нормализует название населённого пункта для сравнения.
 * @param {string} str
 * @returns {string}
 */
export const _npNorm = (str) => String(str || '').toLowerCase()
    .replaceAll(/[’`ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Удаляет префиксы населённого пункта (`м.`, `с.`, `смт.` и т.п.).
 * @param {string} str
 * @returns {string}
 */
export const _npStripPrefix = (str) => _npNorm(str)
    .replace(/^(м\.|с\.|смт\.?|с-ще\.?|місто|село|г\.|гор\.|город)\s*/i, '')
    .trim();

/**
 * Обновляет видимость кнопок очистки (✕) для полей города и отделения.
 */
export function updateNPClearButtons() {
    const cityEl = document.getElementById('orderCity');
    const branchEl = document.getElementById('orderBranch');
    const clearCityBtn = document.getElementById('clearOrderCityBtn');
    const clearBranchBtn = document.getElementById('clearOrderBranchBtn');
    if (clearCityBtn && cityEl) {
        clearCityBtn.style.display = (cityEl.value && cityEl.value.trim().length > 0) ? 'flex' : 'none';
    }
    if (clearBranchBtn && branchEl) {
        clearBranchBtn.style.display = (branchEl.value && branchEl.value.trim().length > 0) ? 'flex' : 'none';
    }
}

/**
 * Надёжный выбор элемента из выпадающего списка на любых тач-устройствах (0 мс задержки).
 * @param {HTMLElement} el
 * @param {(ev: Event) => void} handler
 */
export function bindTouchTapSelect(el, handler) {
    if (!el || typeof el.addEventListener !== 'function') return;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let startTime = 0;

    const onStart = (cx, cy) => {
        startX = cx;
        startY = cy;
        moved = false;
        startTime = Date.now();
    };

    const onMove = (cx, cy) => {
        if (Math.hypot(cx - startX, cy - startY) > 24) {
            moved = true;
        }
    };

    const onEnd = (ev) => {
        const duration = Date.now() - startTime;
        if (!moved && duration < 800) {
            if (ev.cancelable && typeof ev.preventDefault === 'function') ev.preventDefault();
            if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
            handler(ev);
        }
    };

    if (typeof window !== 'undefined' && 'PointerEvent' in window) {
        el.addEventListener('pointerdown', (ev) => {
            if (ev.pointerType === 'touch' || ev.pointerType === 'pen') {
                onStart(ev.clientX, ev.clientY);
            }
        }, { passive: true });
        el.addEventListener('pointermove', (ev) => {
            if (ev.pointerType === 'touch' || ev.pointerType === 'pen') {
                onMove(ev.clientX, ev.clientY);
            }
        }, { passive: true });
        el.addEventListener('pointerup', (ev) => {
            if (ev.pointerType === 'touch' || ev.pointerType === 'pen') {
                onEnd(ev);
            }
        }, { passive: false });
    } else {
        el.addEventListener('touchstart', (ev) => {
            const t = ev.touches && ev.touches[0];
            if (t) onStart(t.clientX, t.clientY);
        }, { passive: true });
        el.addEventListener('touchmove', (ev) => {
            const t = ev.touches && ev.touches[0];
            if (t) onMove(t.clientX, t.clientY);
        }, { passive: true });
        el.addEventListener('touchend', (ev) => {
            onEnd(ev);
        }, { passive: false });
    }
}

/**
 * Автоматически скрывает мобильную клавиатуру при осознанном скролле выпадающего списка.
 * @param {HTMLElement} dropdown
 * @param {string} inputId
 */
export function bindDropdownScrollDismissKeyboard(dropdown, inputId) {
    if (!dropdown || dropdown._scrollDismissBound || typeof dropdown.addEventListener !== 'function') return;
    dropdown._scrollDismissBound = true;
    let startY = 0;
    let startX = 0;
    let isDismissing = false;
    dropdown.addEventListener('touchstart', (e) => {
        const t = e.touches && e.touches[0];
        if (t) {
            startY = t.clientY;
            startX = t.clientX;
            isDismissing = false;
        }
    }, { passive: true });
    dropdown.addEventListener('touchmove', (e) => {
        if (isDismissing) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        const diffY = Math.abs(t.clientY - startY);
        const diffX = Math.abs(t.clientX - startX);
        if (diffY > 24 && diffY > diffX) {
            const inp = document.getElementById(inputId);
            if (inp && document.activeElement === inp && typeof inp.blur === 'function') {
                isDismissing = true;
                requestAnimationFrame(() => {
                    inp.blur();
                });
            }
        }
    }, { passive: true });
    dropdown.addEventListener('touchend', () => {
        isDismissing = false;
    }, { passive: true });
    dropdown.addEventListener('touchcancel', () => {
        isDismissing = false;
    }, { passive: true });
}

/**
 * Безопасная центровка активного поля ввода (Город / Отделение) в видимую зону модалки.
 * @param {HTMLElement|null} inputEl
 */
export function scrollNPFieldIntoModalView(inputEl) {
    if (!inputEl || typeof window === 'undefined' || window.innerWidth > 900) return;
    try {
        if (typeof inputEl.scrollIntoView === 'function') {
            inputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } catch {}
}

/**
 * Извлекает реальный номер отделения или почтомата (после №), игнорируя вес и номер дома.
 * @param {object} branch
 * @returns {string}
 */
export function extractBranchNumber(branch) {
    if (!branch) return '';
    if (branch.Number) return String(branch.Number).trim().toLowerCase();
    const desc = String(branch.Description || '');
    const m = desc.match(/№\s*(\d+[а-яa-zіїєґ]?)/i);
    if (m) return m[1].toLowerCase();
    const head = desc.split(':').at(0).replace(/\([^)]*\)/g, '');
    const hm = head.match(/\b(\d+)\b/);
    return hm ? hm[1].toLowerCase() : '';
}

/**
 * Определяет, является ли точка Новой Почты почтоматом.
 * @param {object} branch
 * @returns {boolean}
 */
export function isPostomatBranch(branch) {
    if (!branch) return false;
    const desc = String(branch.Description || '');
    return desc.includes('Поштомат') || desc.includes('Почтомат') || branch.TypeOfWarehouse === 'f9316480-5f2d-425d-bc2c-ac7cd29decf0';
}

/**
 * Разбор пользовательского запроса для поиска отделения/почтомата по цифре или улице.
 * @param {string} rawQuery
 * @returns {{ raw: string, lower: string, stripped: string, number: string, isPureNumber: boolean, wantsPostomat: boolean, wantsBranch: boolean, apiSearch: string }}
 */
export function parseNPBranchQuery(rawQuery) {
    const raw = String(rawQuery || '').trim();
    const lower = raw.toLowerCase().replaceAll(/[’`ʼ]/g, "'");
    if (!lower) {
        return { raw: '', lower: '', stripped: '', number: '', isPureNumber: false, wantsPostomat: false, wantsBranch: false, apiSearch: '' };
    }

    const wantsPostomat = /поштомат|почтомат|postomat/i.test(lower);
    const wantsBranch = /відділення|отделение|відд\.?(?:\s|$)|отд\.?(?:\s|$)|склад|пункт/i.test(lower);

    const stripped = lower
        .replace(/^(відділення|отделение|відд\.?|отд\.?|поштомат|почтомат|postomat|нова\s*пошта|новая\s*почта|склад|пункт)\s*/gi, '')
        .replace(/^[№#]\s*/, '')
        .trim();

    const pureNumMatch = stripped.match(/^(\d+[а-яa-zіїєґ]?)$/i);
    const anyNumMatch = lower.match(/(?:№|#|\b)(\d+)\b/);
    const number = pureNumMatch ? pureNumMatch[1].toLowerCase() : (anyNumMatch ? anyNumMatch[1].toLowerCase() : '');
    const isPureNumber = Boolean(pureNumMatch);

    let apiSearch = raw;
    if (isPureNumber && number) {
        apiSearch = '№' + number;
    } else if (wantsPostomat && !stripped) {
        apiSearch = 'Поштомат';
    } else if (wantsBranch && !stripped) {
        apiSearch = 'Відділення';
    } else {
        apiSearch = raw
            .replace(/почтомат/gi, 'Поштомат')
            .replace(/отделение|отд\.?/gi, 'Відділення')
            .replace(/ул\./gi, 'вул.');
    }

    return { raw, lower, stripped, number, isPureNumber, wantsPostomat, wantsBranch, apiSearch };
}

/**
 * Умная фильтрация и ранжирование отделений/почтоматов.
 * @param {object[]} list
 * @param {string} rawQuery
 * @returns {object[]}
 */
export function filterAndSortBranches(list, rawQuery) {
    if (!Array.isArray(list) || list.length === 0) return [];
    const parsed = parseNPBranchQuery(rawQuery);
    if (!parsed.lower) return list;

    const scored = [];
    for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const desc = String(b.Description || '');
        const descLower = desc.toLowerCase().replaceAll(/[’`ʼ]/g, "'");
        const isPost = isPostomatBranch(b);

        if (parsed.wantsPostomat && !parsed.wantsBranch && !isPost) continue;
        if (parsed.wantsBranch && !parsed.wantsPostomat && isPost) continue;

        const bNum = extractBranchNumber(b);
        let score = 0;

        if (parsed.isPureNumber && parsed.number) {
            const wanted = parsed.number;
            if (bNum === wanted) {
                score = 1000;
            } else if (bNum && bNum.startsWith(wanted)) {
                score = 700 - Math.min(200, (bNum.length - wanted.length) * 20);
            } else if (bNum && bNum.includes(wanted)) {
                score = 400;
            } else {
                const addrPart = (descLower.split(':').at(1) || '').replace(/\([^)]*\)/g, '');
                if (addrPart.includes(wanted)) {
                    score = 100;
                }
            }
        } else {
            const searchTarget = parsed.stripped || parsed.lower;
            if (!searchTarget) {
                score = 500;
            } else if (parsed.number && bNum === parsed.number && descLower.includes(searchTarget)) {
                score = 1000;
            } else if (descLower.includes(searchTarget)) {
                score = (parsed.number && bNum === parsed.number) ? 950 : 600;
            } else {
                const words = searchTarget.split(/\s+/).filter(Boolean);
                if (words.length > 1 && words.every(w => descLower.includes(w))) {
                    score = 550;
                }
            }
        }

        if (score > 0) {
            scored.push({ branch: b, score, numVal: Number.parseInt(bNum, 10) || 999999, idx: i });
        }
    }

    const sortBranchesFn = (a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.numVal !== b.numVal) return a.numVal - b.numVal;
        return a.idx - b.idx;
    };

    const sortedScored = hasAction('toSorted')
        ? invokeAction('toSorted', scored, sortBranchesFn)
        : (typeof scored.toSorted === 'function'
            ? scored.toSorted(sortBranchesFn)
            : [...scored].sort(sortBranchesFn));

    return sortedScored.map(s => s.branch);
}

/**
 * Выполняет запрос к прокси Новой Почты.
 * @param {object} methodProperties
 * @param {string} calledMethod
 * @returns {Promise<any>}
 */
export async function npProxyRequest(methodProperties, calledMethod) {
    return window.apiClient.post('/api/np-proxy', {
        modelName: 'Address',
        calledMethod: calledMethod,
        methodProperties: methodProperties
    }, { timeout: 10000, throwOnHttpError: true, dedupe: true });
}

/**
 * Запрашивает страницу отделений с автоматическим повтором при 429/сбоях.
 * @param {object} props
 * @returns {Promise<any>}
 */
export async function npFetchPage(props) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await npProxyRequest(props, 'getWarehouses');
        } catch (e) {
            lastErr = e;
            await sleep(e && e.status === 429 ? 1500 : 800);
        }
    }
    throw lastErr;
}

/**
 * Скрывает выпадающие списки города и отделения.
 */
export function hideNPDropdowns() {
    ['cityDropdown', 'branchDropdown'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

/**
 * Сбрасывает адресное состояние оформления заказа (после изменения адреса в профиле).
 */
export function resetCheckoutAddressState() {
    setSelectedCityRefState('');
    setSelectedBranchRefState('');
    if (typeof window !== 'undefined') window.selectedSettlementRef = '';
    cartState.cachedBranches = [];
    const cityEl = document.getElementById('orderCity');
    const branchEl = document.getElementById('orderBranch');
    if (cityEl) cityEl.value = '';
    if (branchEl) branchEl.value = '';
    updateNPClearButtons();
    hideNPDropdowns();
}

/**
 * Рассчитывает примерную стоимость доставки Новой Почтой.
 * @returns {Promise<void>}
 */
export async function calculateDeliveryCost() {
    const cityRef = (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef;
    const currentCart = getActiveCart();
    if (!cityRef || currentCart.length === 0) return;

    const costInfo = document.getElementById('deliveryCostInfo');
    const costVal = document.getElementById('calcCostVal');
    if (costInfo) costInfo.style.display = 'block';
    if (costVal) costVal.innerText = typeof i18next !== 'undefined' ? i18next.t('checkout.calc_pending', { defaultValue: 'Рассчитываем...' }) : 'Рассчитываем...';

    const totalCost = currentCart.reduce((sum, item) => sum + parseCartPrice(item.price), 0);

    try {
        const data = await window.apiClient.post('/api/calc-delivery', {
            cityRef: cityRef,
            cartTotal: totalCost
        }, { timeout: 10000, retries: 1, dedupe: true });

        if (data && data.success) {
            const uahText = (typeof i18next !== 'undefined' && i18next.language === 'en') ? 'UAH' : 'грн';
            if (costVal) costVal.innerText = data.cost + ' ' + uahText;
        } else {
            if (costVal) costVal.innerText = typeof i18next !== 'undefined' ? i18next.t('checkout.np_rates', { defaultValue: 'По тарифам НП' }) : 'По тарифам НП';
        }
    } catch (e) {
        console.error('Ошибка расчета НП', e);
        if (costVal) costVal.innerText = typeof i18next !== 'undefined' ? i18next.t('checkout.np_rates', { defaultValue: 'По тарифам НП' }) : 'По тарифам НП';
    }
}

registerActions({
    updateNPClearButtons,
    bindTouchTapSelect,
    bindDropdownScrollDismissKeyboard,
    scrollNPFieldIntoModalView,
    extractBranchNumber,
    parseNPBranchQuery,
    filterAndSortBranches,
    hideNPDropdowns,
    resetCheckoutAddressState,
    calculateDeliveryCost
});

if (typeof window !== 'undefined') {
    window.updateNPClearButtons = updateNPClearButtons;
    window.bindTouchTapSelect = bindTouchTapSelect;
    window.bindDropdownScrollDismissKeyboard = bindDropdownScrollDismissKeyboard;
    window.scrollNPFieldIntoModalView = scrollNPFieldIntoModalView;
    window.extractBranchNumber = extractBranchNumber;
    window.parseNPBranchQuery = parseNPBranchQuery;
    window.filterAndSortBranches = filterAndSortBranches;
    window.hideNPDropdowns = hideNPDropdowns;
    window.resetCheckoutAddressState = resetCheckoutAddressState;
    window.calculateDeliveryCost = calculateDeliveryCost;
}
