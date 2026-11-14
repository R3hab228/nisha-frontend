// ==========================================
// NISHA PROFILE — NOVA POSHTA AUTOCOMPLETE & IDB CACHE MODULE
// ==========================================

import {
    getStore,
    tProfile,
    getGlobalFn,
    bindWindowFn
} from './profile-state.js';

export const profileSelectedCityRef = { desktop: '', modal: '' };
export const profileSelectedBranchRef = { desktop: '', modal: '' };

/**
 * Returns storage/ref scope key for desktop sidebar vs profile modal.
 * @param {boolean} isModal
 * @returns {'desktop'|'modal'}
 */
export function getProfileScopeKey(isModal) {
    return isModal ? 'modal' : 'desktop';
}

function clearDropdownNode(dropdown) {
    dropdown.innerHTML = '';
    if (typeof dropdown.replaceChildren === 'function') {
        dropdown.replaceChildren();
    }
}

/**
 * Renders safe plain-text status node inside a Nova Poshta dropdown container.
 * @param {HTMLElement} dropdown
 * @param {string} text
 * @param {string} color
 * @param {boolean} [italic=true]
 */
function renderDropdownStatus(dropdown, text, color, italic = true) {
    clearDropdownNode(dropdown);
    const statusEl = document.createElement('div');
    statusEl.style.color = color;
    statusEl.style.padding = '8px';
    if (italic) statusEl.style.fontStyle = 'italic';
    statusEl.textContent = text;
    dropdown.appendChild(statusEl);
    dropdown.style.display = 'block';
}

/**
 * Reads cached Nova Poshta lookup response from IndexedDB helper or session storage.
 * @param {string} cacheKey
 * @returns {Promise<any>}
 */
async function readNpCache(cacheKey) {
    const getNpAsyncFn = getGlobalFn('getNPStorageAsync');
    if (getNpAsyncFn) {
        return await getNpAsyncFn(cacheKey);
    }
    const store = getStore();
    if (store && store.session) {
        return store.session.getJSON('nisha_np_' + cacheKey, null);
    }
    return null;
}

/**
 * Persists Nova Poshta lookup response into IndexedDB helper or session storage.
 * @param {string} cacheKey
 * @param {any} payload
 */
function writeNpCache(cacheKey, payload) {
    const setNpFn = getGlobalFn('setNPStorage');
    if (setNpFn) {
        setNpFn(cacheKey, payload);
        return;
    }
    const store = getStore();
    if (store && store.session) {
        store.session.setJSON('nisha_np_' + cacheKey, payload);
    }
}

/**
 * Binds desktop/mobile tap/mouse selection with double-fire protection on a dropdown option.
 * @param {HTMLElement} div
 * @param {Function} onSelect
 */
function bindDropdownOptionSelect(div, onSelect) {
    let selectedOnce = false;
    const handler = (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (selectedOnce) return;
        selectedOnce = true;
        setTimeout(() => { selectedOnce = false; }, 300);
        onSelect();
    };
    div.onmousedown = handler;
    div.onclick = handler;
    getGlobalFn('bindTouchTapSelect')?.(div, handler);
}

/**
 * Synchronizes hidden combined delivery address field from city and branch inputs.
 * @param {boolean} isModal
 */
export function syncProfileCombinedAddress(isModal) {
    if (typeof document === 'undefined') return;
    const prefix = isModal ? 'modalProfile' : 'profile';
    const cityEl = document.getElementById(`${prefix}DeliveryCity`);
    const branchEl = document.getElementById(`${prefix}DeliveryBranch`);
    const legacyEl = document.getElementById(`${prefix}DeliveryAddress`);
    if (legacyEl && cityEl && branchEl) {
        const c = cityEl.value.trim();
        const b = branchEl.value.trim();
        legacyEl.value = (c && b) ? `${c}, ${b}` : (c || b);
    }
}
bindWindowFn('syncProfileCombinedAddress', syncProfileCombinedAddress);

/**
 * Searches Nova Poshta cities with local cache lookup and proxy fallback.
 * @param {boolean} isModal
 * @param {string} query
 */
export async function searchProfileNPCity(isModal, query) {
    if (typeof document === 'undefined') return;
    const prefix = isModal ? 'modalProfile' : 'profile';
    const dropdown = document.getElementById(`${prefix}DeliveryCityDropdown`);
    if (!dropdown) return;

    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
        dropdown.style.display = 'none';
        return;
    }

    const searchingCityNp = tProfile('profile.search_city_np', '[ Поиск города в базе НП... ]');
    renderDropdownStatus(dropdown, searchingCityNp, '#888');

    const normKey = 'city_' + trimmed.toLowerCase();
    let data = await readNpCache(normKey);

    if (!data) {
        try {
            data = await window.apiClient.post('/api/np-proxy', {
                modelName: 'Address',
                calledMethod: 'searchSettlements',
                methodProperties: { CityName: trimmed, Limit: '10' }
            }, { timeout: 10000, retries: 1, dedupe: true });

            if (data && data.success) {
                writeNpCache(normKey, data);
            }
        } catch (e) {
            console.error('Ошибка поиска города НП в профиле:', e);
            dropdown.style.display = 'none';
            return;
        }
    }

    renderProfileCityDropdown(isModal, data);
}
bindWindowFn('searchProfileNPCity', searchProfileNPCity);

/**
 * Renders Nova Poshta city autocomplete suggestions dropdown.
 * @param {boolean} isModal
 * @param {object} data
 */
export function renderProfileCityDropdown(isModal, data) {
    if (typeof document === 'undefined') return;
    const prefix = isModal ? 'modalProfile' : 'profile';
    const scopeKey = getProfileScopeKey(isModal);
    const dropdown = document.getElementById(`${prefix}DeliveryCityDropdown`);
    const cityInput = document.getElementById(`${prefix}DeliveryCity`);
    const branchInput = document.getElementById(`${prefix}DeliveryBranch`);
    if (!dropdown || !cityInput) return;

    clearDropdownNode(dropdown);
    getGlobalFn('bindDropdownScrollDismissKeyboard')?.(dropdown, `${prefix}DeliveryCity`);
    const addrs = (data && data.success && data.data && data.data[0] && Array.isArray(data.data[0].Addresses))
        ? data.data[0].Addresses
        : [];

    if (addrs.length === 0) {
        const notFoundLabel = typeof i18next !== 'undefined'
            ? i18next.t('np.not_found', { defaultValue: 'Не найдено' })
            : 'Не найдено';
        renderDropdownStatus(dropdown, `[ ${notFoundLabel} ]`, '#666');
        return;
    }

    const fragment = (typeof document.createDocumentFragment === 'function')
        ? document.createDocumentFragment()
        : dropdown;

    addrs.forEach(city => {
        const div = document.createElement('div');
        div.textContent = city.Present;
        bindDropdownOptionSelect(div, () => {
            cityInput.value = city.Present;
            profileSelectedCityRef[scopeKey] = city.DeliveryCity || city.Ref || '';
            dropdown.style.display = 'none';

            if (branchInput) {
                branchInput.value = '';
                if (typeof branchInput.focus === 'function') branchInput.focus();
                loadProfileBranches(isModal, '');
            } else if (typeof cityInput.blur === 'function') {
                cityInput.blur();
            }
            syncProfileCombinedAddress(isModal);
        });
        fragment.appendChild(div);
    });

    if (fragment !== dropdown && typeof dropdown.appendChild === 'function') {
        dropdown.appendChild(fragment);
    }
    dropdown.style.display = 'block';
    if (isModal) getGlobalFn('scrollNPFieldIntoModalView')?.(cityInput);
}

/**
 * Resolves city DeliveryCity ref from selection cache or proxy lookup.
 * @param {boolean} isModal
 * @returns {Promise<string>}
 */
export async function resolveProfileCityRef(isModal) {
    const prefix = isModal ? 'modalProfile' : 'profile';
    const scopeKey = getProfileScopeKey(isModal);
    if (profileSelectedCityRef[scopeKey]) {
        return profileSelectedCityRef[scopeKey];
    }

    if (typeof document === 'undefined') return '';
    const cityInput = document.getElementById(`${prefix}DeliveryCity`);
    const typed = cityInput ? cityInput.value.trim() : '';
    if (typed.length < 2) return '';

    try {
        const data = await window.apiClient.post('/api/np-proxy', {
            modelName: 'Address',
            calledMethod: 'searchSettlements',
            methodProperties: { CityName: typed, Limit: '10' }
        }, { timeout: 10000, dedupe: true });

        const addrs = (data && data.success && data.data && data.data[0] && data.data[0].Addresses) || [];
        if (addrs.length > 0) {
            const ref = addrs.at(0).DeliveryCity || addrs.at(0).Ref || '';
            profileSelectedCityRef[scopeKey] = ref;
            return ref;
        }
    } catch (e) {
        console.error('Ошибка определения города в профиле:', e);
    }
    return '';
}

/**
 * Loads Nova Poshta branches/postomats for selected profile city from IDB cache or proxy.
 * @param {boolean} isModal
 * @param {string} [searchString='']
 */
export async function loadProfileBranches(isModal, searchString = '') {
    if (typeof document === 'undefined') return;
    const prefix = isModal ? 'modalProfile' : 'profile';
    const dropdown = document.getElementById(`${prefix}DeliveryBranchDropdown`);
    const cityInput = document.getElementById(`${prefix}DeliveryCity`);
    const branchInput = document.getElementById(`${prefix}DeliveryBranch`);
    if (!dropdown) return;

    if (!cityInput || !cityInput.value.trim()) {
        const indicateCityFirst = tProfile('profile.indicate_city_first', 'Сначала укажите город ☝️');
        renderDropdownStatus(dropdown, indicateCityFirst, '#aaa');
        return;
    }

    if (isModal && branchInput) {
        getGlobalFn('scrollNPFieldIntoModalView')?.(branchInput);
    }

    const loadingBranchesMsg = tProfile('profile.loading_branches', '[ Загрузка отделений... ]');
    renderDropdownStatus(dropdown, loadingBranchesMsg, '#888');

    const cityRef = await resolveProfileCityRef(isModal);
    if (!cityRef) {
        const chooseCityFromList = tProfile('profile.choose_city_from_list', '[ Выберите город из списка выше ]');
        renderDropdownStatus(dropdown, chooseCityFromList, '#888');
        return;
    }

    const rawTrimmed = (searchString || '').trim();
    const cacheKey = `branches_${cityRef}_${rawTrimmed.toLowerCase()}`;
    let list = await readNpCache(cacheKey);
    // Если чекаут уже сохранил полный список отделений города в IndexedDB — фильтруем его на месте
    if (!list) {
        const allCityBranches = await readNpCache(`branchall_${cityRef}_`);
        if (allCityBranches && Array.isArray(allCityBranches) && allCityBranches.length > 0) {
            const filterBranchesFn = getGlobalFn('filterAndSortBranches');
            list = rawTrimmed && filterBranchesFn
                ? filterBranchesFn(allCityBranches, rawTrimmed)
                : allCityBranches;
        }
    }

    if (!list) {
        try {
            const props = { CityRef: cityRef, Limit: '100' };
            if (rawTrimmed) {
                const parseQueryFn = getGlobalFn('parseNPBranchQuery');
                const parsed = parseQueryFn
                    ? parseQueryFn(rawTrimmed)
                    : null;
                props.FindByString = (parsed && parsed.apiSearch)
                    ? parsed.apiSearch
                    : (/^[№#]?\s*\d+$/.test(rawTrimmed) ? '№' + rawTrimmed.replace(/^[№#]\s*/, '') : rawTrimmed);
            }
            let data = await window.apiClient.post('/api/np-proxy', {
                modelName: 'Address',
                calledMethod: 'getWarehouses',
                methodProperties: props
            }, { timeout: 10000, dedupe: true });

            if (rawTrimmed && (!data || !Array.isArray(data.data) || data.data.length === 0) && props.FindByString !== rawTrimmed) {
                props.FindByString = rawTrimmed;
                data = await window.apiClient.post('/api/np-proxy', {
                    modelName: 'Address',
                    calledMethod: 'getWarehouses',
                    methodProperties: props
                }, { timeout: 10000, dedupe: true });
            }

            if (data && data.success && Array.isArray(data.data)) {
                list = data.data.map(b => ({
                    Ref: b.Ref,
                    Description: b.Description || '',
                    TypeOfWarehouse: b.TypeOfWarehouse || '',
                    Number: b.Number ? String(b.Number) : ''
                }));
                const filterBranchesFn = getGlobalFn('filterAndSortBranches');
                if (rawTrimmed && filterBranchesFn) {
                    list = filterBranchesFn(list, rawTrimmed);
                }
                writeNpCache(cacheKey, list);
            } else {
                list = [];
            }
        } catch (e) {
            console.error('Ошибка загрузки отделений в профиле:', e);
            const branchesLoadErr = tProfile('profile.branches_load_error', '[ Сбой загрузки отделений ]');
            renderDropdownStatus(dropdown, branchesLoadErr, '#ff6666', false);
            return;
        }
    } else if (rawTrimmed) {
        const filterBranchesFn = getGlobalFn('filterAndSortBranches');
        if (filterBranchesFn) {
            list = filterBranchesFn(list, rawTrimmed);
        }
    }

    renderProfileBranchDropdown(isModal, list);
}
bindWindowFn('loadProfileBranches', loadProfileBranches);

/**
 * Renders Nova Poshta branches and postomats dropdown list.
 * @param {boolean} isModal
 * @param {Array<object>} list
 */
export function renderProfileBranchDropdown(isModal, list) {
    if (typeof document === 'undefined') return;
    const prefix = isModal ? 'modalProfile' : 'profile';
    const scopeKey = getProfileScopeKey(isModal);
    const dropdown = document.getElementById(`${prefix}DeliveryBranchDropdown`);
    const branchInput = document.getElementById(`${prefix}DeliveryBranch`);
    if (!dropdown || !branchInput) return;

    clearDropdownNode(dropdown);
    getGlobalFn('bindDropdownScrollDismissKeyboard')?.(dropdown, `${prefix}DeliveryBranch`);
    if (!list || list.length === 0) {
        const emptyLabel = typeof i18next !== 'undefined'
            ? i18next.t('np.branch_empty', { defaultValue: 'Не найдено' })
            : 'Не найдено';
        renderDropdownStatus(dropdown, `[ ${emptyLabel} ]`, '#666');
        return;
    }

    if (typeof dropdown.setAttribute === 'function') {
        dropdown.setAttribute('data-lenis-prevent', 'true');
    }

    const fragment = (typeof document.createDocumentFragment === 'function')
        ? document.createDocumentFragment()
        : dropdown;

    list.forEach(b => {
        const desc = b.Description;
        const isPostomat = desc.includes('Поштомат') || desc.includes('Почтомат') || b.TypeOfWarehouse === 'f9316480-5f2d-425d-bc2c-ac7cd29decf0';

        const div = document.createElement('div');
        if (isPostomat) {
            div.className = 'profile-np-item-postomat';
            div.textContent = `📦 ${desc}`;
        } else {
            div.textContent = `🏬 ${desc}`;
        }

        bindDropdownOptionSelect(div, () => {
            branchInput.value = desc;
            profileSelectedBranchRef[scopeKey] = b.Ref || '';
            dropdown.style.display = 'none';
            if (typeof branchInput.blur === 'function') branchInput.blur();
            syncProfileCombinedAddress(isModal);
        });
        fragment.appendChild(div);
    });

    if (fragment !== dropdown && typeof dropdown.appendChild === 'function') {
        dropdown.appendChild(fragment);
    }
    dropdown.style.display = 'block';
}
