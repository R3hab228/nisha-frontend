// ==========================================
// NISHA NOVA POSHTA — CITY SEARCH, AUTODETECT & CACHE
// ==========================================

import { getNPStorageAsync, setNPStorage } from './npCacheStorage.js';
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
    npProxyRequest,
    hideNPDropdowns
} from './novaposhta-helpers.js';
import { invokeAction } from '../core/action-registry.js';

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
                invokeAction('loadNPBranches', '', false);
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
                invokeAction('loadNPBranches', '', false);
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
