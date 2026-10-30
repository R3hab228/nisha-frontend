// ==========================================
// NISHA LIVE SEARCH & SEARCH HISTORY MODULE
// ==========================================

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
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    let history = store ? store.getJSON('nisha_search_history', []) : [];
    if (!Array.isArray(history)) history = [];
    history = history.filter(t => t.toLowerCase() !== term.toLowerCase());
    history.unshift(term);
    if (history.length > 5) history.pop();
    
    if (store) {
        store.setJSON('nisha_search_history', history);
    }
}

// Отображение истории поиска
function showSearchHistory() {
    const dropdown = document.getElementById('liveSearchDropdown');
    if (!dropdown) return;
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    const history = store ? store.getJSON('nisha_search_history', []) : [];
    if (!Array.isArray(history) || history.length === 0) return;

    const escHtml = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s) => String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    let html = `<div class="search-history-title">🕒 НЕДАВНИЕ ЗАПРОСЫ <span class="search-history-clear" data-action="clear-search-history">[ ОЧИСТИТЬ ]</span></div>`;
    history.forEach(term => {
        const safeTermHtml = escHtml(term);
        html += `<div class="search-history-item" data-action="apply-search-history" data-term="${safeTermHtml}">
                    <span>> ${safeTermHtml}</span>
                 </div>`;
    });
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
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
        if (dropdown) dropdown.style.display = 'none';
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
                const fuse = getLiveSearchFuse();
                if (!fuse) return;
                const queryVariants = (typeof expandSearchQuery === 'function') 
                    ? expandSearchQuery(cleanSearchTerm) 
                    : [cleanSearchTerm];
                
                const collected = [];
                const seenIds = new Set();
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
            
            const escHtml = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s) => String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
            const escJs = typeof window.escapeJsString === 'function' ? window.escapeJsString : (s) => escHtml(String(s || '').replaceAll('\\', '\\\\').replaceAll("'", "\\'"));
            let html = '';
            results.forEach(result => {
                const item = result.item;
                if (!item || item.status === 'sold') return;
                const isReserved = item.status === 'reserved';
                const reservedBadgeHtml = isReserved ? '<div class="live-search-reserved-badge">RESERVED</div>' : '';
                const rawImg = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails[0] : ((item.images && item.images[0]) ? item.images[0] : '');
                const img = typeof window.toCDN === 'function' ? window.toCDN(rawImg) : rawImg;
                const safeImg = escJs(img);
                const rawItemName = String(item.name || '');
                
                let highlightedName = escHtml(rawItemName);
                if (result.matches) {
                    const nameMatch = result.matches.find(m => m.key === 'name');
                    if (nameMatch) {
                        let tempName = '';
                        let lastIdx = 0;
                        nameMatch.indices.forEach(([start, end]) => {
                            tempName += escHtml(rawItemName.substring(lastIdx, start));
                            tempName += `<span style="color: var(--accent-green); background: rgba(0,255,0,0.1);">${escHtml(rawItemName.substring(start, end + 1))}</span>`;
                            lastIdx = end + 1;
                        });
                        tempName += escHtml(rawItemName.substring(lastIdx));
                        highlightedName = tempName;
                    }
                }

                const curr = typeof getCurrency === 'function' ? getCurrency() : 'грн';
                const formattedSearchPrice = typeof window.formatPrice === 'function' ? window.formatPrice(item.price) : `${escHtml(item.price)} ${curr}`;
                let priceHtml = formattedSearchPrice;
                if (item.is_sale && item.old_price) {
                    const formattedOld = typeof window.formatPrice === 'function' ? window.formatPrice(item.old_price) : `${escHtml(item.old_price)} ${curr}`;
                    priceHtml = `<span style="color:#666; text-decoration:line-through; font-size:10px; margin-right:4px;">${formattedOld}</span>${formattedSearchPrice}`;
                }

                html += `
                    <div class="live-search-item ${isReserved ? 'reserved-item' : ''}" data-action="select-live-search-item" data-id="${escHtml(item.id)}">
                        <div class="live-search-img" style="background-image: url('${safeImg}')">${reservedBadgeHtml}</div>
                        <div class="live-search-info">
                            <span class="live-search-title">${highlightedName}</span>
                            <span class="live-search-price">${priceHtml}</span>
                        </div>
                    </div>`;
            });

            if (dropdown) {
                if (html) {
                    dropdown.innerHTML = html;
                    dropdown.style.display = 'block';
                } else {
                    const noMatchesText = typeof i18next !== 'undefined' ? i18next.t('search.no_matches', { defaultValue: 'СОВПАДЕНИЙ НЕТ' }) : 'СОВПАДЕНИЙ НЕТ';
        dropdown.innerHTML = `<div style="padding: 20px; color: #666; font-family: monospace; text-align: center;">[ ${noMatchesText} ]</div>`;
                    dropdown.style.display = 'block';
                    document.body.classList.remove('search-lock');
                    if (typeof window.startLenis === 'function') window.startLenis();
                }
            }
        } else if (dropdown) {
            const noMatchesText = typeof i18next !== 'undefined' ? i18next.t('search.no_matches', { defaultValue: 'СОВПАДЕНИЙ НЕТ' }) : 'СОВПАДЕНИЙ НЕТ';
        dropdown.innerHTML = `<div style="padding: 20px; color: #666; font-family: monospace; text-align: center;">[ ${noMatchesText} ]</div>`;
            dropdown.style.display = 'block';
            document.body.classList.remove('search-lock');
            if (typeof window.startLenis === 'function') window.startLenis();
        }
    }, 250);
}

function closeSearch() {
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchInput = document.getElementById('mainSearch');
    if (dropdown) dropdown.style.display = 'none';
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
            if (typeof applyFilters === 'function') applyFilters();
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
