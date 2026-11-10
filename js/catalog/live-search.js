
function isItemBargainEnabled(item) {
    if (!item || item.status === 'sold') return false;
    if (item.is_bargain === true || String(item.is_bargain) === 'true' || item.is_bargain === 1) return true;
    if (item.min_bargain_price !== null && item.min_bargain_price !== undefined && Number(item.min_bargain_price) > 0) return true;
    if (typeof item.description === 'string' && /(?:\[\s*(?:торг|bargain)|(?<![\p{L}\p{N}_])торг(?![\p{L}\p{N}_]))/iu.test(item.description)) return true;
    return false;
}
window.isItemBargainEnabled = isItemBargainEnabled;

// ==========================================
// NISHA LIVE SEARCH & SEARCH HISTORY MODULE
// ==========================================

import {
    storage,
    escapeHtml,
    escapeJsString,
    formatPrice,
    toCDN,
    applyFilters,
    showPopoverSafe,
    hidePopoverSafe
} from '../../src/modules/index.js';

let searchDebounce;
let currentLiveSearchSeq = 0;
let cachedFuseInstance = null;
let cachedFuseItemsRef = null;

function getLiveSearchFuse() {
    const FuseClass = window.Fuse || (typeof Fuse !== 'undefined' ? Fuse : null);
    if (!FuseClass) return null;
    const items = window.allItems || (typeof allItems !== 'undefined' ? allItems : []);
    if (!cachedFuseInstance || cachedFuseItemsRef !== items) {
        cachedFuseItemsRef = items;
        const fuseOptions = {
            includeScore: true, 
            includeMatches: true, 
            threshold: 0.4, 
            ignoreLocation: true, 
            useExtendedSearch: true, 
            keys: [
                { name: 'tags', weight: 1.0 }, 
                { name: 'brand', weight: 0.8 }, 
                { name: 'name', weight: 0.8 }, 
                { name: 'size', weight: 0.8 }
            ]
        };
        cachedFuseInstance = new FuseClass(items, fuseOptions);
    }
    return cachedFuseInstance;
}

const liveSearchMemoCache = new Map();
const MAX_SEARCH_MEMO = 25;

window.invalidateLiveSearchFuse = function() {
    cachedFuseInstance = null;
    cachedFuseItemsRef = null;
    liveSearchMemoCache.clear();
    currentLiveSearchSeq++;
};

// Функция сохранения истории поиска (с защитой от квоты localStorage)
function saveRecentSearch(term) {
    if (!term || term.length < 2) return;
    let history = storage ? storage.getJSON('nisha_search_history', []) : [];
    if (!Array.isArray(history)) history = [];
    history = history.filter(t => t.toLowerCase() !== term.toLowerCase());
    history.unshift(term);
    if (history.length > 8) history.pop();
    
    if (storage) {
        storage.setJSON('nisha_search_history', history);
    }
}

function openSearchDropdown(dropdown) {
    if (!dropdown) return;
    if (typeof showPopoverSafe === 'function') {
        showPopoverSafe(dropdown);
    } else if (typeof window.showPopoverSafe === 'function') {
        window.showPopoverSafe(dropdown);
    }
    dropdown.style.display = 'block';
    if (dropdown.matches && dropdown.matches(':popover-open')) {
        const wrapper = dropdown.closest('.search-wrapper');
        if (wrapper) {
            const rect = wrapper.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.top = `${rect.bottom}px`;
            dropdown.style.left = `${rect.left}px`;
            dropdown.style.width = `${rect.width}px`;
            dropdown.style.margin = '0';
            dropdown.style.inset = 'auto';
        }
    }
}
window.openSearchDropdown = openSearchDropdown;

// Отображение истории поиска
function showSearchHistory() {
    const dropdown = document.getElementById('liveSearchDropdown');
    if (!dropdown) return;
    const history = storage ? storage.getJSON('nisha_search_history', []) : [];
    if (!Array.isArray(history) || history.length < 4) return;

    const t = (k, def) => (typeof i18next !== 'undefined' && typeof i18next.t === 'function') ? i18next.t(k, { defaultValue: def }) : def;
    const recentQueriesText = t('search.recent_queries', 'НЕДАВНИЕ ЗАПРОСЫ');
    const clearText = t('search.clear_history', 'ОЧИСТИТЬ');

    let html = `<div class="search-history-title"><span>${recentQueriesText}</span><span class="search-history-clear" data-action="clear-search-history">[ ${clearText} ]</span></div>`;
    history.forEach(term => {
        const safeTermHtml = escapeHtml(term);
        html += `<div class="search-history-item" data-action="apply-search-history" data-term="${safeTermHtml}">
                    <span>> ${safeTermHtml}</span>
                 </div>`;
    });
    dropdown.innerHTML = html;
    openSearchDropdown(dropdown);
    document.body.classList.add('search-lock');
    if (typeof window.stopLenis === 'function') window.stopLenis();
}

function handleLiveSearch() {
    clearTimeout(searchDebounce);
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchInput = document.getElementById('mainSearch');
    if (!searchInput) return;
    const searchTerm = searchInput.value.trim();

    if (searchTerm.length === 0) {
        showSearchHistory();
        return; 
    }

    if (searchTerm.length < 2) {
        if (dropdown) {
            if (typeof hidePopoverSafe === 'function') hidePopoverSafe(dropdown);
            else if (typeof window.hidePopoverSafe === 'function') window.hidePopoverSafe(dropdown);
            dropdown.style.display = 'none';
            dropdown.style.removeProperty('position');
            dropdown.style.removeProperty('top');
            dropdown.style.removeProperty('left');
            dropdown.style.removeProperty('width');
        }
        document.body.classList.remove('search-lock');
        if (typeof window.startLenis === 'function') window.startLenis();
        return; 
    }

    const seq = ++currentLiveSearchSeq;
    searchDebounce = setTimeout(async () => {
        const cleanSearchTerm = searchTerm.replaceAll('#', '').trim().toLowerCase();
        let results = liveSearchMemoCache.get(cleanSearchTerm);
        if (!results) {
            if (window.searchWorker && typeof window.searchWorker.searchLive === 'function') {
                results = await window.searchWorker.searchLive(cleanSearchTerm, 8);
            } else {
                const priceQuery = (typeof parsePriceSearchQuery === 'function')
                    ? parsePriceSearchQuery(cleanSearchTerm)
                    : (typeof window.parsePriceSearchQuery === 'function' ? window.parsePriceSearchQuery(cleanSearchTerm) : null);
                const checkPriceFn = typeof itemMatchesPrice === 'function' ? itemMatchesPrice : window.itemMatchesPrice;

                const collected = [];
                const seenIds = new Set();

                if (priceQuery && typeof checkPriceFn === 'function') {
                    const allItemsList = window.allItems || (typeof allItems !== 'undefined' ? allItems : []);
                    for (let i = 0; i < allItemsList.length; i++) {
                        const itm = allItemsList[i];
                        if (!itm || itm.status === 'sold') continue;
                        if (checkPriceFn(itm, priceQuery)) {
                            if (!seenIds.has(itm.id)) {
                                seenIds.add(itm.id);
                                collected.push({ item: itm, matches: [], score: 0, isPriceMatch: true });
                                if (collected.length >= 8) break;
                            }
                        }
                    }
                }

                const fuse = getLiveSearchFuse();
                if (fuse && collected.length < 8) {
                    const queryVariants = (typeof expandSearchQuery === 'function') 
                        ? expandSearchQuery(cleanSearchTerm) 
                        : [cleanSearchTerm];
                    
                    for (const variant of queryVariants) {
                        const subResults = fuse.search(variant);
                        subResults.forEach(r => {
                            if (r.item && r.item.status === 'sold') return;
                            if (!seenIds.has(r.item.id)) {
                                seenIds.add(r.item.id);
                                collected.push(r);
                            }
                        });
                        if (collected.length >= 8) break;
                    }
                }
                results = collected.slice(0, 8);
            }

            if (results && results.length > 0) {
                if (liveSearchMemoCache.size >= MAX_SEARCH_MEMO) {
                    const oldestKey = liveSearchMemoCache.keys().next().value;
                    liveSearchMemoCache.delete(oldestKey);
                }
                liveSearchMemoCache.set(cleanSearchTerm, results);
            }
        } 

        // Исключаем Race Condition: если за время асинхронного поиска запрос устарел или поле изменилось — не рендерим
        if (seq !== currentLiveSearchSeq) return;
        if (searchInput.value.trim() !== searchTerm) return;

        if (results && results.length > 0) {
            document.body.classList.add('search-lock');
            if (typeof window.stopLenis === 'function') window.stopLenis();
            
            let html = '';
            results.forEach(result => {
                const rawItem = result.item;
                if (!rawItem) return;
                const catItem = (window.allItems && window.allItems.find(i => String(i.id) === String(rawItem.id))) || {};
                const item = { ...rawItem, ...catItem };
                if (item.is_bargain === undefined) item.is_bargain = rawItem.is_bargain;
                if (item.min_bargain_price === undefined) item.min_bargain_price = rawItem.min_bargain_price;
                if (!item.description && rawItem.description) item.description = rawItem.description;
                if (!item || item.status === 'sold') return;
                const isReserved = item.status === 'reserved';
                const reservedBadgeHtml = isReserved ? '<div class="live-search-reserved-badge">RESERVED</div>' : '';
                const rawImg = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails[0] : ((item.images && item.images[0]) ? item.images[0] : '');
                const img = toCDN(rawImg);
                const safeImg = escapeJsString(img);
                const rawItemName = String(item.name || '');
                
                let highlightedName = escapeHtml(rawItemName);
                if (result.matches) {
                    const nameMatch = result.matches.find(m => m.key === 'name');
                    if (nameMatch) {
                        let tempName = '';
                        let lastIdx = 0;
                        nameMatch.indices.forEach(([start, end]) => {
                            tempName += escapeHtml(rawItemName.substring(lastIdx, start));
                            tempName += `<span style="color: var(--accent-green); background: rgba(0,255,0,0.1);">${escapeHtml(rawItemName.substring(start, end + 1))}</span>`;
                            lastIdx = end + 1;
                        });
                        tempName += escapeHtml(rawItemName.substring(lastIdx));
                        highlightedName = tempName;
                    }
                }

                const formattedSearchPrice = formatPrice(item.price);
                let priceHtml = formattedSearchPrice;
                if (item.is_sale && item.old_price) {
                    const formattedOld = formatPrice(item.old_price);
                    priceHtml = `<span style="color:#666; text-decoration:line-through; font-size:10px; margin-right:4px;">${formattedOld}</span>${formattedSearchPrice}`;
                }

                const priceQuery = (typeof parsePriceSearchQuery === 'function')
                    ? parsePriceSearchQuery(cleanSearchTerm)
                    : (typeof window.parsePriceSearchQuery === 'function' ? window.parsePriceSearchQuery(cleanSearchTerm) : null);
                const checkPriceFn = typeof itemMatchesPrice === 'function' ? itemMatchesPrice : window.itemMatchesPrice;
                if (priceQuery && typeof checkPriceFn === 'function' && checkPriceFn(item, priceQuery)) {
                    priceHtml = `<span style="color: var(--accent-green); text-shadow: 0 0 6px rgba(0,255,0,0.5); font-weight: bold;">★ ${priceHtml}</span>`;
                }

                const hasBargain = isItemBargainEnabled(item);
                const rawBargainText = (typeof i18next !== 'undefined' && i18next.t && i18next.t('search.bargain_badge', { defaultValue: 'ТОРГ' })) || 'ТОРГ';
                const bargainText = (typeof rawBargainText === 'string' && !rawBargainText.includes('search.')) ? rawBargainText : 'ТОРГ';
                const bargainBadgeHtml = hasBargain
                    ? `<span class="live-search-bargain-badge">${bargainText}</span>`
                    : '';

                html += `
                    <div class="live-search-item ${isReserved ? 'reserved-item' : ''}" data-action="select-live-search-item" data-id="${escapeHtml(item.id)}">
                        <div class="live-search-img" style="background-image: url('${safeImg}')">${reservedBadgeHtml}</div>
                        <div class="live-search-info">
                            <span class="live-search-title">${highlightedName}</span>
                            <span class="live-search-price">${priceHtml}</span>
                        </div>
                        ${bargainBadgeHtml}
                    </div>`;
            });

            if (dropdown) {
                if (html) {
                    if (typeof window.yieldToMain === 'function') await window.yieldToMain();
                    if (seq !== currentLiveSearchSeq) return;
                    if (searchInput.value.trim() !== searchTerm) return;
                    dropdown.innerHTML = html;
                    openSearchDropdown(dropdown);
                } else {
                    const noMatchesText = typeof i18next !== 'undefined' ? i18next.t('search.no_matches', { defaultValue: 'СОВПАДЕНИЙ НЕТ' }) : 'СОВПАДЕНИЙ НЕТ';
        dropdown.innerHTML = `<div style="padding: 20px; color: #666; font-family: monospace; text-align: center;">[ ${noMatchesText} ]</div>`;
                    openSearchDropdown(dropdown);
                    document.body.classList.remove('search-lock');
                    if (typeof window.startLenis === 'function') window.startLenis();
                }
            }
        } else if (dropdown) {
            const noMatchesText = typeof i18next !== 'undefined' ? i18next.t('search.no_matches', { defaultValue: 'СОВПАДЕНИЙ НЕТ' }) : 'СОВПАДЕНИЙ НЕТ';
        dropdown.innerHTML = `<div style="padding: 20px; color: #666; font-family: monospace; text-align: center;">[ ${noMatchesText} ]</div>`;
            openSearchDropdown(dropdown);
            document.body.classList.remove('search-lock');
            if (typeof window.startLenis === 'function') window.startLenis();
        }
    }, 250);
}

function closeSearch() {
    clearTimeout(searchDebounce);
    currentLiveSearchSeq++;
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchInput = document.getElementById('mainSearch');
    if (dropdown) {
        if (typeof hidePopoverSafe === 'function') hidePopoverSafe(dropdown);
        else if (typeof window.hidePopoverSafe === 'function') window.hidePopoverSafe(dropdown);
        dropdown.style.display = 'none';
        dropdown.style.removeProperty('position');
        dropdown.style.removeProperty('top');
        dropdown.style.removeProperty('left');
        dropdown.style.removeProperty('width');
    }
    document.body.classList.remove('search-lock');
    if (typeof window.startLenis === 'function') window.startLenis();
    if (searchInput) searchInput.blur();
}

window.saveRecentSearch = saveRecentSearch;
window.showSearchHistory = showSearchHistory;
window.handleLiveSearch = handleLiveSearch;
window.closeSearch = closeSearch;

// Слушатели строки главного поиска
const mainSearchInput = document.getElementById('mainSearch');
if (mainSearchInput) {
    mainSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveRecentSearch(this.value.trim());
            applyFilters();
            closeSearch();
        } else if (e.key === 'Escape') {
            closeSearch();
        }
    });
    mainSearchInput.addEventListener('input', function() {
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) clearBtn.style.display = this.value.length > 0 ? 'block' : 'none';
    });
    mainSearchInput.addEventListener('focus', () => {
        mainSearchInput.placeholder = (typeof i18next !== 'undefined' && i18next.t('search.placeholder')) || 'Поиск...';
    });
    mainSearchInput.addEventListener('blur', () => {
        if (mainSearchInput.value.length === 0 && typeof startSearchTypewriter === 'function') {
            startSearchTypewriter();
        }
    });
}

document.addEventListener('click', (e) => {
    if (!e.target || !e.target.isConnected) return;
    if (!e.target.closest('.search-wrapper')) {
        closeSearch();
    }
});

document.addEventListener('touchstart', (e) => {
    if (e.target.closest('#liveSearchDropdown')) {
        const searchInput = document.getElementById('mainSearch');
        if (searchInput && document.activeElement === searchInput) {
            searchInput.blur();
        }
    }
}, { passive: true });


// Native Popover API Light Dismiss Sync
if (typeof document !== 'undefined') {
    const initLiveSearchPopoverSync = () => {
        const liveSearchDropEl = document.getElementById('liveSearchDropdown');
        if (liveSearchDropEl && !liveSearchDropEl._popoverBound) {
            liveSearchDropEl._popoverBound = true;
            liveSearchDropEl.addEventListener('toggle', (evt) => {
                if (evt.newState === 'closed') {
                    closeSearch();
                }
            });
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLiveSearchPopoverSync);
    } else {
        initLiveSearchPopoverSync();
    }
}
