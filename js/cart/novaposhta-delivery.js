// ==========================================
// NISHA NOVA POSHTA — CITY/BRANCH SEARCH, AUTODETECT & DROPDOWNS
// ==========================================

import { slimBranches, getNPStorageAsync, setNPStorage } from './npCacheStorage.js';
import {
    cartState,
    setSelectedCityRefState,
    setSelectedBranchRefState
} from './cart-state.js';
import {
    _npNorm,
    _npStripPrefix,
    updateNPClearButtons,
    bindTouchTapSelect,
    bindDropdownScrollDismissKeyboard,
    scrollNPFieldIntoModalView,
    extractBranchNumber,
    parseNPBranchQuery,
    filterAndSortBranches,
    npProxyRequest,
    npFetchPage,
    hideNPDropdowns,
    calculateDeliveryCost
} from './novaposhta-helpers.js';
import { invokeAction, registerActions } from '../core/action-registry.js';

let _branchLoadToken = 0;
let _ensureBranchInFlight = null;
let _ensureCityInFlight = null;

/**
 * Очищает выбранный город и сбрасывает зависимое поле отделения.
 * @param {Event} [e]
 */
export function clearNPCityInput(e) {
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    const cityEl = document.getElementById('orderCity');
    const branchEl = document.getElementById('orderBranch');
    const cd = document.getElementById('cityDropdown');
    const bd = document.getElementById('branchDropdown');
    if (cityEl) {
        cityEl.value = '';
        if (typeof cityEl.focus === 'function') cityEl.focus();
    }
    if (branchEl) {
        branchEl.value = '';
        branchEl.readOnly = true;
    }
    if (cd) cd.style.display = 'none';
    if (bd) bd.style.display = 'none';
    setSelectedCityRefState('');
    setSelectedBranchRefState('');
    if (typeof window !== 'undefined') window.selectedSettlementRef = '';
    cartState.cachedBranches = [];
    updateNPClearButtons();
    invokeAction('saveCheckoutDraft');
}

/**
 * Очищает выбранное отделение и открывает список отделений города.
 * @param {Event} [e]
 */
export function clearNPBranchInput(e) {
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    ++_branchLoadToken;
    if (cartState.branchSearchTimeout) clearTimeout(cartState.branchSearchTimeout);
    const branchEl = document.getElementById('orderBranch');
    setSelectedBranchRefState('');
    if (branchEl) {
        branchEl.value = '';
        branchEl.readOnly = false;
        if (typeof branchEl.focus === 'function') branchEl.focus();
    }
    updateNPClearButtons();
    loadNPBranches('', true);
    invokeAction('saveCheckoutDraft');
}

/**
 * Дебаунс-поиск города при вводе пользователем.
 * @param {string} query
 */
export function debouncedNPCitySearch(query) {
    if (cartState.citySearchTimeout) clearTimeout(cartState.citySearchTimeout);
    invokeAction('closePaymentDropdown');
    const bd = document.getElementById('branchDropdown');
    if (bd) bd.style.display = 'none';

    const branchEl = document.getElementById('orderBranch');
    if (branchEl) {
        branchEl.value = '';
        branchEl.readOnly = true;
    }
    setSelectedCityRefState('');
    setSelectedBranchRefState('');
    if (typeof window !== 'undefined') window.selectedSettlementRef = '';
    cartState.cachedBranches = [];
    updateNPClearButtons();

    const dropdown = document.getElementById('cityDropdown');

    if (query.length < 2) {
        if (dropdown) dropdown.style.display = 'none';
        return;
    }

    cartState.citySearchTimeout = setTimeout(() => {
        searchNPCity(query);
    }, 300);
}

/**
 * Отрисовывает выпадающий список найденных населённых пунктов Новой Почты.
 * @param {any} data
 */
export function renderCitySearchResults(data) {
    const dropdown = document.getElementById('cityDropdown');
    if (!dropdown) return;
    if (typeof dropdown.replaceChildren === 'function') dropdown.replaceChildren();
    else dropdown.innerHTML = '';

    if (typeof dropdown.setAttribute === 'function') dropdown.setAttribute('data-lenis-prevent', 'true');
    bindDropdownScrollDismissKeyboard(dropdown, 'orderCity');

    if (data && data.success && Array.isArray(data.data) && data.data[0] && Array.isArray(data.data[0].Addresses) && data.data[0].Addresses.length > 0) {
        data.data[0].Addresses.forEach(city => {
            const div = document.createElement('div');
            div.className = 'city-item';
            div.innerText = city.Present;

            let selectedOnce = false;
            const selectCityItem = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                if (selectedOnce) return;
                selectedOnce = true;
                setTimeout(() => { selectedOnce = false; }, 300);

                const cityEl = document.getElementById('orderCity');
                if (cityEl) {
                    cityEl.value = city.Present;
                    cityEl.classList.remove('input-field-error');
                    if (typeof cityEl.blur === 'function') cityEl.blur();
                }
                setSelectedCityRefState(city.DeliveryCity || city.Ref);
                if (typeof window !== 'undefined') window.selectedSettlementRef = city.Ref || '';
                setSelectedBranchRefState('');
                dropdown.style.display = 'none';

                const branchInput = document.getElementById('orderBranch');
                if (branchInput) {
                    branchInput.readOnly = false;
                    branchInput.value = '';
                    branchInput.placeholder = typeof i18next !== 'undefined' ? i18next.t('checkout.branch_placeholder', { defaultValue: 'Выберите отделение...' }) : 'Выберите отделение...';
                }

                cartState.cachedBranches = [];
                updateNPClearButtons();
                loadNPBranches('', false);
                invokeAction('saveCheckoutDraft');
            };
            div.onmousedown = selectCityItem;
            div.onclick = selectCityItem;
            div._selectItem = selectCityItem;
            bindTouchTapSelect(div, selectCityItem);
            dropdown.appendChild(div);
        });
        dropdown.style.display = 'block';
        const cityEl = document.getElementById('orderCity');
        if (cityEl && document.activeElement === cityEl) scrollNPFieldIntoModalView(cityEl);
    } else {
        dropdown.style.display = 'none';
    }
}

/**
 * Поиск города с L1+IndexedDB кэшированием.
 * @param {string} query
 * @returns {Promise<void>}
 */
export async function searchNPCity(query) {
    const normKey = 'city_' + query.trim().toLowerCase();
    const cached = await getNPStorageAsync(normKey);
    if (cached) {
        renderCitySearchResults(cached);
        return;
    }

    try {
        const data = await window.apiClient.post('/api/np-proxy', {
            modelName: 'Address',
            calledMethod: 'searchSettlements',
            methodProperties: { CityName: query, Limit: '10' }
        }, { timeout: 10000, retries: 1, dedupe: true });

        if (data && data.success) {
            setNPStorage(normKey, data);
        }
        renderCitySearchResults(data || { success: false });
    } catch (e) {
        console.error('Ошибка поиска города НП', e);
        const cd = document.getElementById('cityDropdown');
        if (cd) cd.style.display = 'none';
        showToast(typeof i18next !== 'undefined' ? i18next.t('np.city_err') : 'Ошибка поиска города', 'error');
    }
}

/**
 * Мгновенный поиск отделений/почтоматов из памяти или дозапрос к НП.
 * @param {string} query
 */
export function filterNPBranches(query) {
    invokeAction('closePaymentDropdown');
    const cd = document.getElementById('cityDropdown');
    if (cd) cd.style.display = 'none';

    ++_branchLoadToken;
    if (cartState.branchSearchTimeout) clearTimeout(cartState.branchSearchTimeout);

    setSelectedBranchRefState('');
    updateNPClearButtons();

    const dropdown = document.getElementById('branchDropdown');
    if (!dropdown) return;

    const cityRef = (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef;
    const q = (query || '').trim();

    const baseList = (cityRef && cartState.npBranchCache[cityRef + '_']) || cartState.cachedBranches || [];
    const isComplete = Boolean(cityRef && cartState.npBranchCacheComplete[cityRef]);

    if (!q) {
        if (baseList && baseList.length > 0) {
            renderBranches(baseList);
            dropdown.style.display = 'block';
            return;
        }
        loadNPBranches('', true);
        return;
    }

    if (baseList && baseList.length > 0) {
        const matches = filterAndSortBranches(baseList, q);
        if (matches.length > 0) {
            renderBranches(matches);
            dropdown.style.display = 'block';
            const hasExactNumberMatch = matches.some(b => extractBranchNumber(b) === parseNPBranchQuery(q).number);
            if (isComplete || (hasExactNumberMatch && matches.length >= 2)) {
                return;
            }
        }
    }

    if (!baseList || baseList.length === 0 || dropdown.children.length === 0 || dropdown.style.display === 'none') {
        const searchingLabel = typeof i18next !== 'undefined'
            ? i18next.t('np.searching', { defaultValue: 'Ищем отделение в базе Новой Почты...' })
            : 'Ищем отделение в базе Новой Почты...';
        dropdown.innerHTML = `<div style="color:#aaa; padding:12px; font-style: italic;">${searchingLabel}</div>`;
        dropdown.style.display = 'block';
    }

    cartState.branchSearchTimeout = setTimeout(() => {
        loadNPBranches(q, true);
    }, 180);
}

/**
 * Сопоставляет и устанавливает Ref отделения по названию из памяти.
 * @param {string} branchText
 * @returns {boolean}
 */
export function matchAndSetBranchRef(branchText) {
    if (!branchText) return false;
    const cityRef = (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef;
    const branches = (cityRef && cartState.npBranchCache[cityRef + '_']) || cartState.cachedBranches || [];
    if (!branches || branches.length === 0) return false;

    const norm = (str) => String(str || '').toLowerCase().replace(/[^a-zа-яёіїєґ0-9]/gi, '');
    const wanted = norm(branchText);
    const numMatch = branchText.match(/\d+/);
    const wantedNum = numMatch ? numMatch.at(0) : null;
    const isPostomat = /поштомат|почтомат|postomat/i.test(branchText);

    let match = branches.find(b => norm(b.Description) === wanted);
    if (!match && wantedNum) {
        match = branches.find(b => {
            const bDesc = b.Description || '';
            const bNum = extractBranchNumber(b) || (bDesc.match(/\d+/) || [])[0];
            const bIsPost = /поштомат|почтомат|postomat/i.test(bDesc);
            return bNum === wantedNum && (isPostomat === bIsPost);
        });
    }
    if (!match && wantedNum) {
        match = branches.find(b => {
            const bDesc = b.Description || '';
            const bNum = extractBranchNumber(b) || (bDesc.match(/\d+/) || [])[0];
            return bNum === wantedNum;
        });
    }
    if (!match) return false;

    const branchEl = document.getElementById('orderBranch');
    if (branchEl && branchEl.value.trim() !== String(branchText).trim()) return false;
    if (branchEl) branchEl.value = match.Description;
    setSelectedBranchRefState(match.Ref);
    updateNPClearButtons();
    calculateDeliveryCost();
    invokeAction('saveCheckoutDraft');
    return true;
}

/**
 * Целевой поиск и гарантированная установка Ref отделения/почтомата.
 * @param {string} branchText
 * @returns {Promise<string>}
 */
export async function ensureBranchRef(branchText) {
    const existing = (typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef;
    if (existing) return existing;

    const branchInput = document.getElementById('orderBranch');
    const typed = (branchText || (branchInput ? branchInput.value : '')).trim();
    if (typed.length < 2) return '';

    let cityRef = (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef;
    if (!cityRef) {
        try {
            cityRef = await ensureCityRef();
        } catch {}
    }
    if (!cityRef) return '';

    if (matchAndSetBranchRef(typed)) {
        return (typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef;
    }

    const norm = (str) => String(str || '').toLowerCase().replace(/[^a-zа-яёіїєґ0-9]/gi, '');
    const wanted = norm(typed);
    const numMatch = typed.match(/\d+/);
    const wantedNum = numMatch ? numMatch.at(0) : null;
    const isPostomat = /поштомат|почтомат|postomat/i.test(typed);

    const cacheKeys = Object.keys(cartState.npBranchCache).filter(k => k.startsWith(cityRef + '_'));
    for (const ck of cacheKeys) {
        const list = cartState.npBranchCache[ck];
        if (Array.isArray(list) && list.length > 0) {
            let m = list.find(b => norm(b.Description) === wanted);
            if (!m && wantedNum) {
                m = list.find(b => {
                    const bDesc = b.Description || '';
                    const bNum = extractBranchNumber(b) || (bDesc.match(/\d+/) || [])[0];
                    const bIsPost = /поштомат|почтомат|postomat/i.test(bDesc);
                    return bNum === wantedNum && (isPostomat === bIsPost);
                });
            }
            if (!m && wantedNum) {
                m = list.find(b => {
                    const bDesc = b.Description || '';
                    const bNum = extractBranchNumber(b) || (bDesc.match(/\d+/) || [])[0];
                    return bNum === wantedNum;
                });
            }
            if (m) {
                setSelectedBranchRefState(m.Ref);
                if (branchInput && !branchInput.value.trim()) branchInput.value = m.Description;
                updateNPClearButtons();
                calculateDeliveryCost();
                invokeAction('saveCheckoutDraft');
                return m.Ref;
            }
        }
    }

    const flightKey = `${cityRef}_targeted_${typed.toLowerCase()}`;
    if (_ensureBranchInFlight && _ensureBranchInFlight.key === flightKey) {
        return await _ensureBranchInFlight.promise;
    }

    const run = (async () => {
        try {
            const parsed = parseNPBranchQuery(typed);
            const searchTarget = (parsed && parsed.apiSearch) ? parsed.apiSearch : typed;
            const props = { CityRef: cityRef, Limit: '50' };
            if (searchTarget) props.FindByString = searchTarget;
            else if (wantedNum) props.WarehouseId = wantedNum;

            const data = await npProxyRequest(props, 'getWarehouses');

            let branches = (data && data.success && Array.isArray(data.data)) ? data.data : [];
            if (branches.length === 0 && wantedNum && props.FindByString !== wantedNum) {
                const fbProps = { CityRef: cityRef, Limit: '50', FindByString: wantedNum };
                const fbData = await npProxyRequest(fbProps, 'getWarehouses');
                branches = (fbData && fbData.success && Array.isArray(fbData.data)) ? fbData.data : [];
            }

            if (branches.length === 0) return '';

            const slimmed = slimBranches(branches);
            if (!cartState.npBranchCache[cityRef + '_']) cartState.npBranchCache[cityRef + '_'] = [];
            slimmed.forEach(sb => {
                if (!cartState.npBranchCache[cityRef + '_'].some(b => b.Ref === sb.Ref)) {
                    cartState.npBranchCache[cityRef + '_'].push(sb);
                }
            });

            let pick = null;
            if (wantedNum) {
                pick = slimmed.find(b => {
                    const bDesc = b.Description || '';
                    const bNum = extractBranchNumber(b) || (bDesc.match(/\d+/) || [])[0];
                    const bIsPost = /поштомат|почтомат|postomat/i.test(bDesc);
                    return bNum === wantedNum && (isPostomat === bIsPost);
                });
                if (!pick) {
                    pick = slimmed.find(b => {
                        const bDesc = b.Description || '';
                        const bNum = extractBranchNumber(b) || (bDesc.match(/\d+/) || [])[0];
                        return bNum === wantedNum;
                    });
                }
            }
            if (!pick) {
                pick = slimmed.find(b => norm(b.Description) === wanted) || slimmed.at(0);
            }

            if (pick) {
                setSelectedBranchRefState(pick.Ref);
                if (branchInput && !branchInput.value.trim()) {
                    branchInput.value = pick.Description;
                }
                updateNPClearButtons();
                calculateDeliveryCost();
                invokeAction('saveCheckoutDraft');
                return pick.Ref;
            }
            return '';
        } catch (e) {
            console.warn('ensureBranchRef error:', e);
            return '';
        }
    })();

    _ensureBranchInFlight = { key: flightKey, promise: run };
    try {
        return await run;
    } finally {
        if (_ensureBranchInFlight && _ensureBranchInFlight.key === flightKey) _ensureBranchInFlight = null;
    }
}

/**
 * Автоматически находит Ref города в базе Новой Почты по введённому названию.
 * @param {{ interactive?: boolean }} [opts={}]
 * @returns {Promise<string>}
 */
export async function ensureCityRef(opts = {}) {
    const interactive = !!(opts && opts.interactive);
    const existing = (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef;
    if (existing) return existing;

    const cityInput = document.getElementById('orderCity');
    const typed = cityInput ? cityInput.value.trim() : '';
    if (typed.length < 2) return '';

    if (_ensureCityInFlight && _ensureCityInFlight.typed === typed) {
        const ref = await _ensureCityInFlight.promise;
        if (ref || !interactive) return ref;
    }

    const run = (async () => {
        try {
            const cleanTyped = typed.replace(/^(м\.|с\.|смт\.?|с-ще\.?|місто|село|г\.|гор\.|город)\s*/i, '').split(',').at(0).trim();
            const data = await npProxyRequest({ CityName: cleanTyped || typed, Limit: '10' }, 'searchSettlements');
            const addrs = (data && data.success && data.data && data.data.at(0) && data.data.at(0).Addresses) || [];
            if (addrs.length === 0) return '';

            const currentTyped = cityInput ? cityInput.value.trim() : '';
            if (currentTyped !== typed) return '';
            if ((typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef) {
                return (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef;
            }

            const wantedFull = _npNorm(typed);
            const wantedName = _npStripPrefix(typed.split(',').at(0));
            const regionToken = _npNorm(typed.split(',').slice(1).join(',')).split(',').at(0).trim();
            const pick =
                addrs.find(a => _npNorm(a.Present) === wantedFull) ||
                addrs.find(a => _npStripPrefix(String(a.Present || '').split(',').at(0)) === wantedName && (!regionToken || _npNorm(a.Present).includes(regionToken))) ||
                addrs.find(a => _npStripPrefix(a.MainDescription) === wantedName && !regionToken) ||
                (addrs.length === 1 ? addrs.at(0) : null);

            const fallbackPick = (!pick && !interactive && addrs.length > 0)
                ? (addrs.find(a => _npNorm(a.MainDescription).includes(wantedName) || _npNorm(a.Present).includes(wantedName)) || addrs.at(0))
                : null;
            const resolvedPick = pick || fallbackPick;

            if (!resolvedPick) {
                if (interactive) renderCitySearchResults(data);
                return '';
            }

            const cityRefVal = resolvedPick.DeliveryCity || resolvedPick.Ref;
            setSelectedCityRefState(cityRefVal);
            if (typeof window !== 'undefined') window.selectedSettlementRef = resolvedPick.Ref || '';
            if (cityInput && resolvedPick.Present) cityInput.value = resolvedPick.Present;
            const branchInput = document.getElementById('orderBranch');
            if (branchInput) branchInput.readOnly = false;
            updateNPClearButtons();
            if (!interactive) hideNPDropdowns();
            invokeAction('saveCheckoutDraft');
            return cityRefVal;
        } catch (e) {
            console.error('Не удалось определить город НП:', e);
            return '';
        }
    })();

    _ensureCityInFlight = { typed, promise: run };
    try {
        return await run;
    } finally {
        if (_ensureCityInFlight && _ensureCityInFlight.promise === run) _ensureCityInFlight = null;
    }
}

/**
 * Запрашивает отделения и почтоматы города (с кэшированием и защитой от гонок).
 * @param {string} [searchString='']
 * @param {boolean} [showDropdown=false]
 * @returns {Promise<void>}
 */
export async function loadNPBranches(searchString = '', showDropdown = false) {
    invokeAction('closePaymentDropdown');
    const cd = document.getElementById('cityDropdown');
    if (cd) cd.style.display = 'none';

    if (typeof searchString !== 'string') searchString = '';

    const input = document.getElementById('orderBranch');
    const dropdown = document.getElementById('branchDropdown');
    if (!dropdown) return;

    if (showDropdown && !searchString.trim() && input && input.value && input.value.trim() && !((typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef)) {
        searchString = input.value.trim();
    }

    if (showDropdown && input && document.activeElement === input) {
        scrollNPFieldIntoModalView(input);
    }

    let cityRef = (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef;
    if (!cityRef) {
        cityRef = await ensureCityRef({ interactive: showDropdown });
        if (!cityRef) {
            const cityInput = document.getElementById('orderCity');
            if (input && (!cityInput || !cityInput.value.trim())) {
                input.placeholder = typeof i18next !== 'undefined' ? i18next.t('checkout.choose_city_first', { defaultValue: 'Сначала выберите город' }) : 'Сначала выберите город';
            }
            return;
        }
        if (input) input.readOnly = false;
    }

    const search = searchString.trim();
    const parsedQuery = parseNPBranchQuery(search);
    const cacheKey = cityRef + '_' + search.toLowerCase();

    const hasCachedKey = Object.hasOwn(cartState.npBranchCache, cacheKey);
    if (hasCachedKey && cartState.npBranchCache[cacheKey] && cartState.npBranchCache[cacheKey].length > 0) {
        if (showDropdown) {
            const listToRender = search ? filterAndSortBranches(cartState.npBranchCache[cacheKey], search) : cartState.npBranchCache[cacheKey];
            renderBranches(listToRender);
        }
        return;
    }

    const storedBranches = await getNPStorageAsync('branchall_' + cacheKey);
    if (storedBranches && storedBranches.length > 0) {
        cartState.npBranchCache[cacheKey] = storedBranches;
        if (showDropdown) {
            const listToRender = search ? filterAndSortBranches(storedBranches, search) : storedBranches;
            renderBranches(listToRender);
        }
        return;
    }

    const myToken = ++_branchLoadToken;
    if (showDropdown) {
        const loadBranchText = typeof i18next !== 'undefined' ? i18next.t('checkout.loading_branches', { defaultValue: 'Завантаження відділень...' }) : 'Завантаження відділень...';
        dropdown.innerHTML = `<div style="color:#aaa; padding:12px; font-style: italic;">${loadBranchText}</div>`;
        dropdown.style.display = 'block';
    }

    try {
        const PAGE_SIZE = search ? 150 : 500;
        const MAX_PAGES = search ? 1 : 3;
        let refProp = 'CityRef';
        let refVal = cityRef;
        const all = [];

        let loopError = null;
        let isCityFullyLoaded = false;
        try {
            for (let page = 1; page <= MAX_PAGES; page++) {
                const buildProps = (findStr) => {
                    const p = { Limit: String(PAGE_SIZE), Page: String(page) };
                    p[refProp] = refVal;
                    if (findStr) p.FindByString = findStr;
                    return p;
                };

                const findTarget = search ? (parsedQuery.apiSearch || search) : '';
                let data = await npFetchPage(buildProps(findTarget));
                if (myToken !== _branchLoadToken) return;

                let chunk = (data && data.success && Array.isArray(data.data)) ? data.data : [];

                if (page === 1 && chunk.length === 0 && search && findTarget !== search) {
                    data = await npFetchPage(buildProps(search));
                    if (myToken !== _branchLoadToken) return;
                    chunk = (data && data.success && Array.isArray(data.data)) ? data.data : [];
                }

                if (page === 1 && chunk.length === 0 && typeof window !== 'undefined' && window.selectedSettlementRef && refProp === 'CityRef') {
                    refProp = 'SettlementRef';
                    refVal = window.selectedSettlementRef;
                    data = await npFetchPage(buildProps(findTarget));
                    if (myToken !== _branchLoadToken) return;
                    chunk = (data && data.success && Array.isArray(data.data)) ? data.data : [];
                }

                if (chunk.length === 0) {
                    if (page > 1) isCityFullyLoaded = true;
                    break;
                }

                all.push(...slimBranches(chunk));

                if (!search) {
                    cartState.npBranchCache[cityRef + '_'] = all.slice();
                    cartState.cachedBranches = all.slice();
                }

                const total = data && data.info && data.info.totalCount;
                if (chunk.length < PAGE_SIZE || (total && all.length >= total)) {
                    if (!search) isCityFullyLoaded = true;
                    break;
                }

                if (!search && total && total > 1500) {
                    isCityFullyLoaded = false;
                    break;
                }
            }
        } catch (err) {
            if (myToken !== _branchLoadToken) return;
            loopError = err;
        }
        if (loopError && all.length === 0) throw loopError;

        if (myToken !== _branchLoadToken) return;

        let finalBranches = all;
        if (search) {
            const baseList = cartState.npBranchCache[cityRef + '_'] || [];
            if (baseList.length > 0) {
                const seenRefs = new Set(all.map(b => b.Ref));
                const combined = [...all];
                for (let i = 0; i < baseList.length; i++) {
                    if (!seenRefs.has(baseList[i].Ref)) {
                        combined.push(baseList[i]);
                    }
                }
                finalBranches = filterAndSortBranches(combined, search);
            } else {
                finalBranches = filterAndSortBranches(all, search);
            }
        } else if (input && input.value && input.value.trim() && !((typeof window !== 'undefined' && window.selectedBranchRef) || cartState.selectedBranchRef)) {
            finalBranches = filterAndSortBranches(all, input.value.trim());
        }

        if (finalBranches.length > 0) {
            if (input && !input.value) input.placeholder = typeof i18next !== 'undefined' ? i18next.t('checkout.branch_placeholder', { defaultValue: 'Выберите отделение...' }) : 'Выберите отделение...';
            if (!loopError) {
                cartState.npBranchCache[cacheKey] = finalBranches;
                if (!search) {
                    cartState.npBranchCacheComplete[cityRef] = isCityFullyLoaded;
                }
                setNPStorage('branchall_' + cacheKey, finalBranches);
            }
            if (showDropdown) {
                renderBranches(finalBranches);
            }
        } else {
            const emptyLabel = typeof i18next !== 'undefined'
                ? i18next.t('np.branch_empty', { defaultValue: 'Не найдено' })
                : 'Не найдено';
            if (input && !input.value) input.placeholder = emptyLabel;
            if (showDropdown) {
                dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">[ ${emptyLabel} ]</div>`;
                dropdown.style.display = 'block';
            }
        }
    } catch (e) {
        if (myToken !== _branchLoadToken) return;
        console.error('Сбой загрузки отделений НП:', e);
        const errLabel = typeof i18next !== 'undefined'
            ? i18next.t('np.branch_err', { defaultValue: 'Ошибка загрузки отделений' })
            : 'Ошибка загрузки отделений';
        if (input && !input.value) input.placeholder = errLabel;
        if (showDropdown) {
            dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">[ ${errLabel} ]</div>`;
            dropdown.style.display = 'block';
        }
    }
}

const MAX_RENDERED_BRANCHES = 50;

/**
 * Отрисовывает список отделений/почтоматов с лимитом 50 элементов.
 * @param {object[]} branches
 */
export function renderBranches(branches) {
    const dropdown = document.getElementById('branchDropdown');
    if (!dropdown) return;

    if (typeof dropdown.replaceChildren === 'function') dropdown.replaceChildren();
    else dropdown.innerHTML = '';

    if (!Array.isArray(branches) || branches.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    if (typeof dropdown.setAttribute === 'function') dropdown.setAttribute('data-lenis-prevent', 'true');
    bindDropdownScrollDismissKeyboard(dropdown, 'orderBranch');

    const fragment = document.createDocumentFragment();
    const count = Math.min(branches.length, MAX_RENDERED_BRANCHES);

    for (let i = 0; i < count; i++) {
        const branch = branches[i];
        const desc = String(branch.Description || '');
        const isPostomat = desc.includes('Поштомат') || desc.includes('Почтомат') || branch.TypeOfWarehouse === 'f9316480-5f2d-425d-bc2c-ac7cd29decf0';
        const div = document.createElement('div');
        div.className = 'branch-item';
        div.setAttribute('data-branch-ref', branch.Ref);
        div.setAttribute('data-branch-desc', desc);

        if (isPostomat) {
            div.appendChild(document.createTextNode('📦 '));
            const span = document.createElement('span');
            span.style.color = '#00aaff';
            span.textContent = desc;
            div.appendChild(span);
        } else {
            div.textContent = desc;
        }

        let selectedOnce = false;
        const selectBranchItem = (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            if (selectedOnce) return;
            selectedOnce = true;
            setTimeout(() => { selectedOnce = false; }, 300);

            const branchEl = document.getElementById('orderBranch');
            if (branchEl) {
                branchEl.value = desc;
                branchEl.classList.remove('input-field-error');
                if (typeof branchEl.blur === 'function') branchEl.blur();
            }
            setSelectedBranchRefState(branch.Ref);
            dropdown.style.display = 'none';
            updateNPClearButtons();
            calculateDeliveryCost();
            invokeAction('saveCheckoutDraft');
        };
        div.onmousedown = selectBranchItem;
        div.onclick = selectBranchItem;
        div._selectItem = selectBranchItem;
        bindTouchTapSelect(div, selectBranchItem);
        fragment.appendChild(div);
    }

    if (branches.length > MAX_RENDERED_BRANCHES) {
        const notice = document.createElement('div');
        notice.setAttribute('data-msg', 'true');
        notice.style.cssText = 'padding:10px 14px; color:#888; font-size:11px; text-align:center; font-style:italic; border-top:1px dashed #333; pointer-events:none;';
        notice.textContent = `Показано ${MAX_RENDERED_BRANCHES} из ${branches.length}. Введите номер или улицу для уточнения...`;
        fragment.appendChild(notice);
    }

    dropdown.appendChild(fragment);
    dropdown.style.display = 'block';
}

/**
 * Тихое GeoIP-автоопределение города пользователя (без выпадающих списков).
 * @returns {Promise<void>}
 */
export async function autoDetectCity() {
    const cityInput = document.getElementById('orderCity');
    const branchInput = document.getElementById('orderBranch');

    if (!cityInput || cityInput.value.trim() !== '') return;

    const originalPlaceholder = cityInput.placeholder;
    cityInput.placeholder = typeof i18next !== 'undefined' ? i18next.t('checkout.geo_searching', { defaultValue: 'Поиск спутников...' }) : 'Поиск спутников...';

    try {
        let data = null;
        if (window.apiClient && typeof window.apiClient.get === 'function') {
            try {
                const edgeGeo = await window.apiClient.get('/api/geo', { timeout: 2500, retries: 0, dedupe: true });
                if (edgeGeo && edgeGeo.success && edgeGeo.city) {
                    data = edgeGeo;
                }
            } catch {}
        }
        if (!data) {
            const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(4000) : undefined });
            data = await res.json();
        }

        if (data && data.country_code === 'UA' && data.city) {
            const enToUaCities = {
                'Kyiv': 'Київ', 'Kiev': 'Київ', 'Kharkiv': 'Харків', 'Kharkov': 'Харків',
                'Odesa': 'Одеса', 'Odessa': 'Одеса', 'Dnipro': 'Дніпро', 'Dnipropetrovsk': 'Дніпро',
                'Donetsk': 'Донецьк', 'Zaporizhzhia': 'Запоріжжя', 'Zaporozhye': 'Запоріжжя',
                'Lviv': 'Львів', 'Lvov': 'Львів', 'Kryvyi Rih': 'Кривий Ріг', 'Krivoy Rog': 'Кривий Ріг',
                'Mykolaiv': 'Миколаїв', 'Nikolaev': 'Миколаїв', 'Mariupol': 'Маріуполь',
                'Luhansk': 'Луганськ', 'Lugansk': 'Луганськ', 'Vinnytsia': 'Вінниця', 'Vinnitsa': 'Вінниця',
                'Makiivka': 'Макіївка', 'Makeyevka': 'Макіївка', 'Simferopol': 'Сімферополь',
                'Chernihiv': 'Чернігів', 'Chernigov': 'Чернігів', 'Kherson': 'Херсон',
                'Poltava': 'Полтава', 'Khmelnytskyi': 'Хмельницький', 'Khmelnytskyy': 'Хмельницький',
                'Cherkasy': 'Черкаси', 'Cherkassy': 'Черкаси', 'Chernivtsi': 'Чернівці', 'Chernovtsy': 'Чернівці',
                'Zhytomyr': 'Житомир', 'Zhitomir': 'Житомир', 'Sumy': 'Суми',
                'Rivne': 'Рівне', 'Rovno': 'Рівне', 'Horlivka': 'Горлівка', 'Gorlovka': 'Горлівка',
                'Ivano-Frankivsk': 'Івано-Франківськ', 'Ivano-Frankovsk': 'Івано-Франківськ',
                'Kamianske': 'Кам\'янське', 'Dniprodzerzhynsk': 'Кам\'янське', 'Kropyvnytskyi': 'Кропивницький', 'Kirovohrad': 'Кропивницький',
                'Ternopil': 'Тернопіль', 'Ternopol': 'Тернопіль', 'Kremenchuk': 'Кременчук', 'Kremenchug': 'Кременчук',
                'Lutsk': 'Луцьк', 'Bila Tserkva': 'Біла Церква', 'Belaya Tserkov': 'Біла Церква',
                'Kramatorsk': 'Краматорськ', 'Melitopol': 'Мелітополь', 'Uzhhorod': 'Ужгород', 'Uzhgorod': 'Ужгород',
                'Brovary': 'Бровари', 'Berdiansk': 'Бердянськ', 'Berdyansk': 'Бердянськ',
                'Pavlohrad': 'Павлоград', 'Pavlograd': 'Павлоград', 'Sievierodonetsk': 'Сєвєродонецьк', 'Severodonetsk': 'Сєвєродонецьк',
                'Kamianets-Podilskyi': 'Кам\'янець-Подільський', 'Kamenets-Podolskiy': 'Кам\'янець-Подільський'
            };
            let detectedCity = (typeof hasOwn === 'function' ? hasOwn(enToUaCities, data.city) : Object.hasOwn(enToUaCities, data.city))
                ? enToUaCities[data.city]
                : data.city;
            if (detectedCity === data.city && data.latitude && data.longitude) {
                try {
                    const nomUrl = new URL('https://nominatim.openstreetmap.org/reverse');
                    nomUrl.search = new URLSearchParams({
                        lat: String(data.latitude),
                        lon: String(data.longitude),
                        format: 'json',
                        'accept-language': 'uk'
                    }).toString();
                    const nomRes = await fetch(nomUrl.toString(), { signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(4000) : undefined });
                    const nomData = await nomRes.json();
                    if (nomData && nomData.address) {
                        detectedCity = nomData.address.city || nomData.address.town || nomData.address.village || detectedCity;
                    }
                } catch {}
            }

            const npData = await window.apiClient.post('/api/np-proxy', {
                modelName: 'Address',
                calledMethod: 'searchSettlements',
                methodProperties: { CityName: detectedCity, Limit: '1' }
            }, { timeout: 8000, retries: 1, dedupe: true });

            if (cityInput.value.trim() !== '' || (typeof window !== 'undefined' && window.selectedCityRef) || cartState.selectedCityRef) {
                cityInput.placeholder = originalPlaceholder;
                return;
            }

            if (npData && npData.success && npData.data && npData.data.at(0) && npData.data.at(0).Addresses.length > 0) {
                const cityObj = npData.data.at(0).Addresses.at(0);
                cityInput.value = cityObj.Present;
                cityInput.placeholder = originalPlaceholder;
                setSelectedCityRefState(cityObj.DeliveryCity || cityObj.Ref);
                if (typeof window !== 'undefined') window.selectedSettlementRef = cityObj.Ref || '';

                if (branchInput) {
                    branchInput.readOnly = false;
                    branchInput.placeholder = typeof i18next !== 'undefined' ? i18next.t('checkout.branch_placeholder', { defaultValue: 'Выберите отделение...' }) : 'Выберите отделение...';
                }
                loadNPBranches('', false);
                hideNPDropdowns();

                const locPrefix = typeof i18next !== 'undefined' ? i18next.t('checkout.location_prefix', { defaultValue: 'Локация: ' }) : 'Локация: ';
                showToast(`[GEO] ${locPrefix}${cityObj.MainDescription}`, 'success');
            } else {
                cityInput.value = detectedCity;
                cityInput.placeholder = originalPlaceholder;
                ensureCityRef().then(() => hideNPDropdowns()).catch(() => {});
            }
        } else {
            cityInput.placeholder = originalPlaceholder;
        }
    } catch (err) {
        console.error('Ошибка GeoIP:', err);
        cityInput.placeholder = originalPlaceholder;
    }
}

registerActions({
    clearNPCityInput,
    clearNPBranchInput,
    debouncedNPCitySearch,
    searchNPCity,
    filterNPBranches,
    matchAndSetBranchRef,
    ensureBranchRef,
    ensureCityRef,
    loadNPBranches,
    renderBranches,
    autoDetectCity
});

if (typeof window !== 'undefined') {
    window.clearNPCityInput = clearNPCityInput;
    window.clearNPBranchInput = clearNPBranchInput;
    window.debouncedNPCitySearch = debouncedNPCitySearch;
    window.searchNPCity = searchNPCity;
    window.filterNPBranches = filterNPBranches;
    window.matchAndSetBranchRef = matchAndSetBranchRef;
    window.ensureBranchRef = ensureBranchRef;
    window.ensureCityRef = ensureCityRef;
    window.loadNPBranches = loadNPBranches;
    window.renderBranches = renderBranches;
    window.autoDetectCity = autoDetectCity;
}
