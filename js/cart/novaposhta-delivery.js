// ==========================================
// NISHA NOVA POSHTA — CITY/BRANCH SEARCH, AUTODETECT & DROPDOWNS
// ==========================================

import { slimBranches, getNPStorageAsync, setNPStorage } from './npCacheStorage.js';
import {
    cartState,
    setSelectedBranchRefState
} from './cart-state.js';
import {
    updateNPClearButtons,
    bindTouchTapSelect,
    bindDropdownScrollDismissKeyboard,
    scrollNPFieldIntoModalView,
    extractBranchNumber,
    parseNPBranchQuery,
    filterAndSortBranches,
    npProxyRequest,
    npFetchPage,
    calculateDeliveryCost
} from './novaposhta-helpers.js';
import {
    clearNPCityInput,
    debouncedNPCitySearch,
    renderCitySearchResults,
    searchNPCity,
    ensureCityRef,
    autoDetectCity
} from './novaposhta-city-detect.js';
import { invokeAction, registerActions } from '../core/action-registry.js';

export {
    clearNPCityInput,
    debouncedNPCitySearch,
    renderCitySearchResults,
    searchNPCity,
    ensureCityRef,
    autoDetectCity
};

let _branchLoadToken = 0;
let _ensureBranchInFlight = null;

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
    window.ensureBranchRef = ensureBranchRef;
}
