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
import {
    profileSelectedCityRef,
    profileSelectedBranchRef,
    getProfileScopeKey,
    syncProfileCombinedAddress,
    searchProfileNPCity,
    renderProfileCityDropdown,
    resolveProfileCityRef,
    loadProfileBranches,
    renderProfileBranchDropdown
} from './profile-np-delivery.js';

export {
    profileSelectedCityRef,
    profileSelectedBranchRef,
    getProfileScopeKey,
    syncProfileCombinedAddress,
    searchProfileNPCity,
    renderProfileCityDropdown,
    resolveProfileCityRef,
    loadProfileBranches,
    renderProfileBranchDropdown
};

let profileNpCityTimeout = null;
let profileNpBranchTimeout = null;
let outsideClickBound = false;
let _isSavingProfileDelivery = false;
let _deliveryLockTimer = null;

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
