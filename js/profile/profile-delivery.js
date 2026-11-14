// ==========================================
// NISHA PROFILE DELIVERY & NOVA POSHTA MODULE
// ==========================================

import {
    profileState,
    getSupabase,
    getStore,
    tProfile,
    notifyToast,
    getGlobalFn,
    bindWindowFn
} from './profile-state.js';

let profileNpCityTimeout = null;
let profileNpBranchTimeout = null;
let outsideClickBound = false;
let _isSavingProfileDelivery = false;
let _deliveryLockTimer = null;

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
 * Toggles CSS class flag defensively for both native DOMTokenList and test mocks.
 * @param {object} el
 * @param {string} className
 * @param {boolean} flag
 */
function setElementClassFlag(el, className, flag) {
    if (!el || !el.classList) return;
    if (typeof el.classList.toggle === 'function') {
        el.classList.toggle(className, Boolean(flag));
    } else if (flag && typeof el.classList.add === 'function') {
        el.classList.add(className);
    } else if (!flag && typeof el.classList.remove === 'function') {
        el.classList.remove(className);
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
    dropdown.innerHTML = `<div style="color:#888;padding:8px;font-style:italic">${searchingCityNp}</div>`;
    dropdown.style.display = 'block';

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

    dropdown.innerHTML = '';
    getGlobalFn('bindDropdownScrollDismissKeyboard')?.(dropdown, `${prefix}DeliveryCity`);
    const addrs = (data && data.success && data.data && data.data[0] && Array.isArray(data.data[0].Addresses))
        ? data.data[0].Addresses
        : [];

    if (addrs.length === 0) {
        const notFoundLabel = typeof i18next !== 'undefined'
            ? i18next.t('np.not_found', { defaultValue: 'Не найдено' })
            : 'Не найдено';
        dropdown.innerHTML = `<div style="color:#666;padding:8px;font-style:italic">[ ${notFoundLabel} ]</div>`;
        dropdown.style.display = 'block';
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
        dropdown.innerHTML = `<div style="color:#aaa;padding:8px;font-style:italic">${indicateCityFirst}</div>`;
        dropdown.style.display = 'block';
        return;
    }

    if (isModal && branchInput) {
        getGlobalFn('scrollNPFieldIntoModalView')?.(branchInput);
    }

    const loadingBranchesMsg = tProfile('profile.loading_branches', '[ Загрузка отделений... ]');
    dropdown.innerHTML = `<div style="color:#888;padding:8px;font-style:italic">${loadingBranchesMsg}</div>`;
    dropdown.style.display = 'block';

    const cityRef = await resolveProfileCityRef(isModal);
    if (!cityRef) {
        const chooseCityFromList = tProfile('profile.choose_city_from_list', '[ Выберите город из списка выше ]');
        dropdown.innerHTML = `<div style="color:#888;padding:8px;font-style:italic">${chooseCityFromList}</div>`;
        dropdown.style.display = 'block';
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
            dropdown.innerHTML = `<div style="color:#ff6666;padding:8px">${branchesLoadErr}</div>`;
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

    dropdown.innerHTML = '';
    getGlobalFn('bindDropdownScrollDismissKeyboard')?.(dropdown, `${prefix}DeliveryBranch`);
    if (!list || list.length === 0) {
        const emptyLabel = typeof i18next !== 'undefined'
            ? i18next.t('np.branch_empty', { defaultValue: 'Не найдено' })
            : 'Не найдено';
        dropdown.innerHTML = `<div style="color:#666;padding:8px;font-style:italic">[ ${emptyLabel} ]</div>`;
        dropdown.style.display = 'block';
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

/**
 * Binds debounced Nova Poshta input handlers and browser autofill protection on delivery fields.
 */
export function initProfileDeliveryEvents() {
    if (typeof document === 'undefined') return;
    [false, true].forEach(isModal => {
        const prefix = isModal ? 'modalProfile' : 'profile';
        const fnEl = document.getElementById(`${prefix}DeliveryFullName`);
        const cityEl = document.getElementById(`${prefix}DeliveryCity`);
        const branchEl = document.getElementById(`${prefix}DeliveryBranch`);

        if (fnEl) {
            getGlobalFn('attachFullNameAutoCapitalize')?.(fnEl);
        }
        if (fnEl && typeof fnEl.addEventListener === 'function' && !fnEl._autofillShieldBound) {
            fnEl._autofillShieldBound = true;
            if (fnEl.value && typeof fnEl.value.trim === 'function' && fnEl.value.trim()) {
                fnEl._lastExplicitValue = fnEl.value.trim();
            }
            fnEl.addEventListener('input', () => {
                if (document.activeElement === fnEl) {
                    fnEl._lastExplicitValue = fnEl.value;
                } else if (fnEl._lastExplicitValue && fnEl.value !== fnEl._lastExplicitValue) {
                    fnEl.value = fnEl._lastExplicitValue;
                }
            });
        }

        if (cityEl) {
            const isBound = cityEl.dataset ? Boolean(cityEl.dataset.npBound) : Boolean(cityEl._npBound);
            if (!isBound) {
                if (cityEl.dataset) cityEl.dataset.npBound = '1';
                else cityEl._npBound = true;

                if (typeof cityEl.addEventListener === 'function') {
                    cityEl.addEventListener('input', (e) => {
                        if (profileNpCityTimeout) clearTimeout(profileNpCityTimeout);
                        profileNpCityTimeout = setTimeout(() => {
                            searchProfileNPCity(isModal, e.target.value);
                        }, 300);
                        syncProfileCombinedAddress(isModal);
                    });
                    cityEl.addEventListener('focus', () => {
                        if (cityEl.value && cityEl.value.trim().length >= 2) {
                            searchProfileNPCity(isModal, cityEl.value);
                        }
                    });
                }
            }
        }

        if (branchEl) {
            const isBound = branchEl.dataset ? Boolean(branchEl.dataset.npBound) : Boolean(branchEl._npBound);
            if (!isBound) {
                if (branchEl.dataset) branchEl.dataset.npBound = '1';
                else branchEl._npBound = true;

                if (typeof branchEl.addEventListener === 'function') {
                    branchEl.addEventListener('input', (e) => {
                        if (profileNpBranchTimeout) clearTimeout(profileNpBranchTimeout);
                        profileNpBranchTimeout = setTimeout(() => {
                            loadProfileBranches(isModal, e.target.value);
                        }, 300);
                        syncProfileCombinedAddress(isModal);
                    });
                    branchEl.addEventListener('focus', () => {
                        loadProfileBranches(isModal, branchEl.value);
                    });
                }
            }
        }
    });
}
bindWindowFn('initProfileDeliveryEvents', initProfileDeliveryEvents);

/**
 * Toggles read-only lock mode and [ ИЗМЕНИТЬ ] / [ СОХРАНИТЬ ] state across desktop & modal forms.
 * @param {boolean} locked
 */
export function setProfileDeliveryLockState(locked) {
    if (typeof document === 'undefined') return;
    [false, true].forEach(modalFlag => {
        const prefix = modalFlag ? 'modalProfile' : 'profile';
        const fnEl = document.getElementById(`${prefix}DeliveryFullName`);
        const cityEl = document.getElementById(`${prefix}DeliveryCity`);
        const branchEl = document.getElementById(`${prefix}DeliveryBranch`);
        const btn = document.getElementById(`${prefix}DeliverySaveBtn`);

        [fnEl, cityEl, branchEl].forEach(input => {
            if (!input) return;
            input.readOnly = Boolean(locked);
            setElementClassFlag(input, 'is-locked', Boolean(locked));
            if (locked) {
                if (typeof input.setAttribute === 'function') input.setAttribute('tabindex', '-1');
            } else {
                if (typeof input.removeAttribute === 'function') input.removeAttribute('tabindex');
            }
        });

        if (btn) {
            if (typeof btn.setAttribute === 'function') {
                btn.setAttribute('data-mode', locked ? 'edit' : 'save');
            }
            const saveText = tProfile('profile.delivery_save', '[ СОХРАНИТЬ ]');
            const editText = tProfile('profile.delivery_edit', '[ ИЗМЕНИТЬ ]');
            btn.innerText = locked ? editText : saveText;
            setElementClassFlag(btn, 'is-edit-mode', Boolean(locked));
            if (btn.classList && typeof btn.classList.remove === 'function') {
                btn.classList.remove('is-saved');
            }
        }

        if (locked) {
            const cityDropdown = document.getElementById(`${prefix}DeliveryCityDropdown`);
            const branchDropdown = document.getElementById(`${prefix}DeliveryBranchDropdown`);
            if (cityDropdown) cityDropdown.style.display = 'none';
            if (branchDropdown) branchDropdown.style.display = 'none';
        }
    });
}
bindWindowFn('setProfileDeliveryLockState', setProfileDeliveryLockState);

/**
 * Renders full name and Nova Poshta address across desktop sidebar & modal profile delivery forms.
 * @param {string} fullName
 * @param {string} address
 */
export function renderProfileDelivery(fullName, address) {
    const fn = (fullName || '').trim();
    const addr = (address || '').trim();

    const parseFn = getGlobalFn('parseDeliveryAddress');
    const parsed = parseFn ? parseFn(addr) : null;
    const cityPart = parsed ? parsed.city : (addr.split(',').at(0) || '').trim();
    const branchPart = parsed ? parsed.branch : (addr.split(',').slice(1).join(', ') || '').trim();

    if (typeof document !== 'undefined') {
        [false, true].forEach(isModal => {
            const prefix = isModal ? 'modalProfile' : 'profile';
            const fnEl = document.getElementById(`${prefix}DeliveryFullName`);
            const cityEl = document.getElementById(`${prefix}DeliveryCity`);
            const branchEl = document.getElementById(`${prefix}DeliveryBranch`);
            const addrEl = document.getElementById(`${prefix}DeliveryAddress`);
            if (fnEl) fnEl.value = fn;
            if (cityEl) cityEl.value = cityPart;
            if (branchEl) branchEl.value = branchPart;
            if (addrEl) addrEl.value = addr;
        });
    }

    initProfileDeliveryEvents();

    if (!_isSavingProfileDelivery) {
        setProfileDeliveryLockState(Boolean(fn || addr));
    }

    const store = getStore();
    if (store) {
        if (fn || addr) {
            store.setJSON('nisha_profile_delivery', { full_name: fn, delivery_address: addr });
            const cRef = profileSelectedCityRef.desktop || profileSelectedCityRef.modal || '';
            const bRef = profileSelectedBranchRef.desktop || profileSelectedBranchRef.modal || '';
            if (cRef || bRef) {
                store.setJSON('nisha_profile_delivery_refs', { cityRef: cRef, branchRef: bRef });
            }
        } else {
            store.remove('nisha_profile_delivery');
            store.remove('nisha_profile_delivery_refs');
        }
    }
}
bindWindowFn('renderProfileDelivery', renderProfileDelivery);

/**
 * Toggles Win95 profile delivery accordion expand/collapse state.
 * @param {boolean} isModal
 * @param {HTMLElement} [btn]
 */
export function toggleProfileDeliveryAccordion(isModal, btn) {
    if (typeof document === 'undefined') return;
    const prefix = isModal ? 'modalProfile' : 'profile';
    const collapseEl = document.getElementById(`${prefix}DeliveryCollapse`);
    const toggleBtn = btn || document.getElementById(`${prefix}DeliveryToggleBtn`);
    if (!collapseEl) return;

    const isCollapsed = collapseEl.classList.toggle('collapsed');

    if (!isCollapsed) {
        if (typeof collapseEl.classList.remove === 'function') collapseEl.classList.remove('is-expanded');
        if (collapseEl._expandTimer) clearTimeout(collapseEl._expandTimer);
        collapseEl._expandTimer = setTimeout(() => {
            const stillOpen = typeof collapseEl.classList.contains === 'function'
                ? !collapseEl.classList.contains('collapsed')
                : true;
            if (stillOpen && typeof collapseEl.classList.add === 'function') {
                collapseEl.classList.add('is-expanded');
            }
        }, 360);
        initProfileDeliveryEvents();
    } else {
        if (collapseEl._expandTimer) clearTimeout(collapseEl._expandTimer);
        if (typeof collapseEl.classList.remove === 'function') collapseEl.classList.remove('is-expanded');
        document.querySelectorAll('.profile-np-dropdown').forEach(d => { d.style.display = 'none'; });
    }

    if (toggleBtn) {
        toggleBtn.classList.toggle('is-open', !isCollapsed);
        const textSpan = toggleBtn.querySelector('.profile-delivery-btn-text');
        const openText = tProfile('profile.delivery_btn_open', '[ ДАННЫЕ ДОСТАВКИ ▲ ]');
        const closedText = tProfile('profile.delivery_btn', '[ ДАННЫЕ ДОСТАВКИ ▼ ]');
        if (textSpan) {
            textSpan.innerText = isCollapsed ? closedText : openText;
        } else {
            toggleBtn.innerText = isCollapsed ? closedText : openText;
        }
    }
}
bindWindowFn('toggleProfileDeliveryAccordion', toggleProfileDeliveryAccordion);

/**
 * Handles [ ИЗМЕНИТЬ ] unlock or [ СОХРАНИТЬ ] persistence from profile delivery form.
 * @param {boolean} isModal
 * @param {HTMLElement} [btn]
 */
export async function saveProfileDeliveryFromForm(isModal, btn) {
    if (typeof document === 'undefined') return;
    const prefix = isModal ? 'modalProfile' : 'profile';
    const activeBtn = btn || document.getElementById(`${prefix}DeliverySaveBtn`);
    const mode = (activeBtn && typeof activeBtn.getAttribute === 'function')
        ? activeBtn.getAttribute('data-mode')
        : 'save';

    if (mode === 'edit') {
        setProfileDeliveryLockState(false);
        const fnEl = document.getElementById(`${prefix}DeliveryFullName`);
        if (fnEl && typeof fnEl.focus === 'function') fnEl.focus();
        return;
    }

    const fnEl = document.getElementById(`${prefix}DeliveryFullName`);
    const cityEl = document.getElementById(`${prefix}DeliveryCity`);
    const branchEl = document.getElementById(`${prefix}DeliveryBranch`);
    const addrEl = document.getElementById(`${prefix}DeliveryAddress`);
    const fullName = (fnEl ? fnEl.value : '').trim();
    const city = (cityEl ? cityEl.value : '').trim();
    const branch = (branchEl ? branchEl.value : '').trim();

    let address = '';
    if (city && branch) address = `${city}, ${branch}`;
    else if (city) address = city;
    else if (branch) address = branch;
    else if (addrEl && addrEl.value.trim()) address = addrEl.value.trim();

    if (!fullName && !address) {
        notifyToast(tProfile('profile.delivery_fill_warn', 'Заполните ФИО или место доставки!'), 'warning');
        return;
    }

    const saveBtns = [
        btn,
        document.getElementById('profileDeliverySaveBtn'),
        document.getElementById('modalProfileDeliverySaveBtn')
    ].filter(Boolean);

    saveBtns.forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.7';
    });

    const scopeKey = getProfileScopeKey(isModal);
    const cityRef = profileSelectedCityRef[scopeKey] || '';
    const branchRef = profileSelectedBranchRef[scopeKey] || '';

    _isSavingProfileDelivery = true;
    try {
        await saveDeliveryToProfile(fullName, address, { cityRef, branchRef });
        notifyToast(tProfile('profile.delivery_saved_toast', 'Данные доставки сохранены!'), 'success');

        const savedText = tProfile('profile.delivery_saved_btn', '[ СОХРАНЕНО ✓ ]');
        saveBtns.forEach(b => {
            b.innerText = savedText;
            if (b.classList && typeof b.classList.add === 'function') b.classList.add('is-saved');
        });

        if (_deliveryLockTimer) clearTimeout(_deliveryLockTimer);
        _deliveryLockTimer = setTimeout(() => {
            setProfileDeliveryLockState(true);
        }, 800);
    } catch (e) {
        notifyToast(tProfile('profile.delivery_save_error', 'Ошибка сохранения данных: ') + (e.message || 'Сбой сети'), 'error');
    } finally {
        _isSavingProfileDelivery = false;
        saveBtns.forEach(b => {
            b.disabled = false;
            b.style.opacity = '1';
        });
    }
}
bindWindowFn('saveProfileDeliveryFromForm', saveProfileDeliveryFromForm);

/**
 * Persists delivery details and optional Nova Poshta refs into userProfile, localStorage, and Supabase.
 * @param {string} fullName
 * @param {string} address
 * @param {object} [refs={}]
 */
export async function saveDeliveryToProfile(fullName, address, refs = {}) {
    const fn = (fullName || '').trim();
    const addr = (address || '').trim();
    const cityRef = (refs && refs.cityRef) || '';
    const branchRef = (refs && refs.branchRef) || '';

    if (profileState.userProfile) {
        profileState.userProfile.full_name = fn;
        profileState.userProfile.delivery_address = addr;
        if (cityRef) profileState.userProfile.delivery_city_ref = cityRef;
        if (branchRef) profileState.userProfile.delivery_branch_ref = branchRef;
    }

    renderProfileDelivery(fn, addr);

    getGlobalFn('clearCheckoutDraft')?.();
    const store = getStore();
    if (store) {
        store.remove('nisha_checkout_data');
        if (fn || addr) {
            store.setJSON('nisha_profile_delivery', {
                full_name: fn,
                delivery_address: addr
            });
            if (cityRef || branchRef) {
                store.setJSON('nisha_profile_delivery_refs', {
                    cityRef: cityRef,
                    branchRef: branchRef
                });
            }
        } else {
            store.remove('nisha_profile_delivery_refs');
        }
    }
    // Адрес в профиле изменился — форма заказа при следующем открытии подставит его заново
    getGlobalFn('resetCheckoutAddressState')?.();

    const activeUser = profileState.currentUser;
    const sb = getSupabase();
    if (activeUser && sb) {
        try {
            await sb.from('profiles').update({
                full_name: fn,
                delivery_address: addr
            }).eq('id', activeUser.id);
        } catch (err) {
            console.error('Ошибка сохранения доставки в профиле Supabase:', err);
        }
    }
}
bindWindowFn('saveDeliveryToProfile', saveDeliveryToProfile);

/**
 * Hides open Nova Poshta profile dropdowns when user clicks outside .profile-np-wrap.
 */
export function initProfileDeliveryOutsideClick() {
    if (outsideClickBound) return;
    outsideClickBound = true;
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('click', (e) => {
            if (!e?.target?.closest || !e.target.closest('.profile-np-wrap')) {
                document.querySelectorAll('.profile-np-dropdown').forEach(d => {
                    d.style.display = 'none';
                });
            }
        });
    }
}
