// ==========================================
// NISHA CATALOG — UI САЙДБАРА: СЧЁТЧИКИ, ПОИСК-ИНПУТ, ЦЕНА И МОБИЛЬНЫЙ ДРОЕР
// ==========================================

import { clearSavedFeedScrollState } from './scroll-restoration.js';
import { hasAction, invokeAction } from '../core/action-registry.js';

let priceTimeout = null;

/**
 * Запускает DOM-обновление через View Transitions API (если доступно), либо синхронно.
 * @param {Function} updateDom
 * @returns {any}
 */
export function runCatalogViewTransition(updateDom) {
    if (typeof safeViewTransition === 'function') {
        return safeViewTransition(updateDom);
    }
    if (hasAction('safeViewTransition')) {
        return invokeAction('safeViewTransition', updateDom);
    }
    return updateDom();
}

/**
 * Обновляет счетчики категорий и размеров в боковом меню через textContent за один проход.
 */
export function updateSidebarCounters() {
    if (typeof document === 'undefined' || !window.allItems || window.allItems.length === 0) return;
    const curCat = window.currentCategory || '';
    const onlySale = document.getElementById('onlySaleCb') ? document.getElementById('onlySaleCb').checked : false;

    const availableItemsAll = window.allItems.filter(i => {
        if (!i || i.status !== 'available') return false;
        if (onlySale && !i.is_sale) return false;
        return true;
    });

    const catCounts = { 'Все вещи': availableItemsAll.length };
    if (typeof Object.groupBy === 'function') {
        const groups = Object.groupBy(availableItemsAll, item => item?.category || 'Без категории');
        for (const [cat, items] of Object.entries(groups)) {
            catCounts[cat] = items ? items.length : 0;
        }
    } else {
        availableItemsAll.forEach(item => {
            if (!item) return;
            const c = item.category || 'Без категории';
            catCounts[c] = (catCounts[c] || 0) + 1;
        });
    }

    const setFilterCountBadge = (el, count) => {
        if (!el) return;
        let badge = el.querySelector('.filter-count-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'filter-count-badge';
                el.appendChild(document.createTextNode(' '));
                el.appendChild(badge);
            }
            const nextText = `(${count})`;
            if (badge.textContent !== nextText) badge.textContent = nextText;
        } else if (badge) {
            if (badge.previousSibling && badge.previousSibling.nodeType === 3 && badge.previousSibling.textContent === ' ') {
                badge.previousSibling.remove();
            }
            badge.remove();
        }
    };

    // 1. Категории
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(link => {
        const badgeEl = link.querySelector('.filter-count-badge');
        const baseText = (badgeEl
            ? Array.from(link.childNodes).filter(n => n !== badgeEl).map(n => n.textContent).join('')
            : link.textContent).trim();
        const dataCat = link.getAttribute('data-category');
        const onclickAttr = link.getAttribute('onclick') || '';

        let catName = 'Все вещи';
        if (dataCat !== null) {
            catName = dataCat || 'Все вещи';
        } else {
            const match = onclickAttr.match(/setCategoryFilter\s*\(\s*["']([^"']*)["']/);
            if (match && match[1]) {
                catName = match[1];
            } else if (onclickAttr.includes('""') || onclickAttr.includes("''")) {
                catName = 'Все вещи';
            } else {
                if (baseText.includes('Все') || baseText.includes('Всі') || baseText.includes('All')) catName = 'Все вещи';
                else if (baseText.includes('Верхн')) catName = 'Верхняя одежда';
                else if (baseText.includes('Кофт') || baseText.includes('Светр')) catName = 'Кофты и Свитера';
                else if (baseText.includes('Штан') || baseText.includes('Джинс')) catName = 'Штаны и Джинсы';
                else if (baseText.includes('Обув') || baseText.includes('Взутт') || baseText.includes('Shoes')) catName = 'Обувь';
                else if (baseText.includes('Акс') || baseText.includes('Acc')) catName = 'Аксессуары';
            }
        }

        const count = (typeof hasOwn === 'function' ? hasOwn(catCounts, catName) : Object.hasOwn(catCounts, catName)) ? catCounts[catName] : 0;
        setFilterCountBadge(link, count);

        link.classList.remove('active-filter');
        if (curCat !== '' && catName === curCat) {
            link.classList.add('active-filter');
        } else if (curCat === '' && catName === 'Все вещи') {
            link.classList.add('active-filter');
        }
    });

    // 2. Размеры (только для текущей категории — подсчет за один проход)
    const availableCategoryItems = availableItemsAll.filter(item => {
        if (curCat !== '' && item.category !== curCat) return false;
        return true;
    });

    const sizeCheckboxes = Array.from(document.querySelectorAll('.size-cb'));
    const sizeCounts = new Map();
    sizeCheckboxes.forEach(cb => {
        if (cb.value && !sizeCounts.has(cb.value)) {
            sizeCounts.set(cb.value, 0);
        }
    });

    for (let i = 0; i < availableCategoryItems.length; i++) {
        const item = availableCategoryItems[i];
        for (const [sizeVal, currentCount] of sizeCounts.entries()) {
            if (hasAction('itemMatchesSizeFilter') && invokeAction('itemMatchesSizeFilter', item, sizeVal)) {
                sizeCounts.set(sizeVal, currentCount + 1);
            }
        }
    }

    sizeCheckboxes.forEach(cb => {
        const labelSpan = cb.nextElementSibling;
        if (!labelSpan) return;
        const count = sizeCounts.get(cb.value) || 0;
        setFilterCountBadge(labelSpan, count);

        if (count > 0) {
            cb.parentElement.style.opacity = '1';
            cb.disabled = false;
        } else {
            cb.parentElement.style.opacity = '0.4';
            cb.disabled = true;
            cb.checked = false;
        }
    });
}

/**
 * Очищает поисковый инпут, закрывает live-dropdown и сбрасывает фильтрацию.
 * @returns {any}
 */
export function clearSearchInput() {
    clearSavedFeedScrollState();
    const input = document.getElementById('mainSearch');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = 'none';

    // Закрываем дропдаун ДО запуска ViewTransition, чтобы старый кадр не захватывал открытый поповер
    if (hasAction('closeSearch')) {
        invokeAction('closeSearch');
    } else {
        const liveDropdown = document.getElementById('liveSearchDropdown');
        if (liveDropdown) {
            if (hasAction('hidePopoverSafe')) {
                invokeAction('hidePopoverSafe', liveDropdown);
            } else if (typeof liveDropdown.hidePopover === 'function' && liveDropdown.matches && liveDropdown.matches(':popover-open')) {
                try { liveDropdown.hidePopover(); } catch {}
            }
            liveDropdown.style.display = 'none';
        }
        document.body.classList.remove('search-lock');
        invokeAction('startLenis');
    }

    return runCatalogViewTransition(() => invokeAction('applyFilters', true, false));
}

/**
 * Синхронизирует ползунки и метки ценового диапазона и запускает отложенную фильтрацию.
 * @param {Event} [e]
 */
export function updatePriceUI(e) {
    const minInput = document.getElementById('priceMin');
    const maxInput = document.getElementById('priceMax');
    if (!minInput || !maxInput) return;
    let minVal = Number.parseInt(minInput.value, 10);
    let maxVal = Number.parseInt(maxInput.value, 10);

    if (minVal >= maxVal) {
        const activeTargetId = e?.target?.id
            || (typeof document !== 'undefined' ? document.activeElement?.id : '')
            || (typeof window !== 'undefined' && window.event ? window.event.target?.id : '');
        if (activeTargetId === 'priceMin') {
            minInput.value = maxVal - 100;
            minVal = maxVal - 100;
        } else {
            maxInput.value = minVal + 100;
            maxVal = minVal + 100;
        }
    }

    const minLabel = document.getElementById('priceMinVal');
    const maxLabel = document.getElementById('priceMaxVal');
    if (minLabel) minLabel.innerText = minVal;
    if (maxLabel) maxLabel.innerText = maxVal;

    const percentMin = (minVal / 15000) * 100;
    const percentMax = (maxVal / 15000) * 100;
    const rangeFill = document.getElementById('rangeFill');
    if (rangeFill) {
        rangeFill.style.left = percentMin + '%';
        rangeFill.style.right = (100 - percentMax) + '%';
    }

    clearTimeout(priceTimeout);
    priceTimeout = setTimeout(() => { invokeAction('applyFilters'); }, 300);
}

/**
 * Плавно раскрывает и сворачивает мобильное меню фильтров (`.sidebar`).
 */
export function toggleMobileSidebar() {
    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    const sidebar = document.querySelector('.sidebar');
    const btn = document.getElementById('mobileFilterBtn');
    const fab = document.querySelector('.fab-propose');
    if (!sidebar || !btn) return;

    const isOpen = sidebar.classList.contains('active-mobile');

    const hideText = (typeof i18next !== 'undefined') ? i18next.t('mobile.hide_filters', { defaultValue: '[-] СКРЫТЬ ФИЛЬТРЫ' }) : '[-] СКРЫТЬ ФИЛЬТРЫ';
    const showText = (typeof i18next !== 'undefined') ? i18next.t('mobile.show_filters', { defaultValue: '[+] ПОКАЗАТЬ ФИЛЬТРЫ' }) : '[+] ПОКАЗАТЬ ФИЛЬТРЫ';

    if (!isOpen) {
        btn.innerText = hideText;
        btn.style.borderColor = 'var(--accent-red)';
        btn.style.color = 'var(--accent-red)';
        btn.style.background = '#111';
        if (fab) fab.style.display = 'none';

        sidebar.classList.add('active-mobile');
        sidebar.style.maxHeight = '0px';
        sidebar.offsetHeight;

        const targetHeight = sidebar.scrollHeight + 35;
        sidebar.style.maxHeight = targetHeight + 'px';

        if (sidebar._transitionCtrl) {
            try { sidebar._transitionCtrl.abort(); } catch {}
        }
        const openCtrl = new AbortController();
        sidebar._transitionCtrl = openCtrl;

        const onOpenEnd = (e) => {
            if (e.target === sidebar && e.propertyName === 'max-height') {
                openCtrl.abort();
                sidebar._transitionCtrl = null;
                if (sidebar.classList.contains('active-mobile')) {
                    sidebar.style.maxHeight = 'none';
                }
            }
        };
        sidebar.addEventListener('transitionend', onOpenEnd, { signal: openCtrl.signal });
        updateSidebarCounters();
    } else {
        btn.innerText = showText;
        btn.style.borderColor = '#444';
        btn.style.color = 'var(--accent-green)';
        btn.style.background = '#050505';
        if (fab) fab.style.display = 'flex';

        const currentHeight = sidebar.offsetHeight || (sidebar.scrollHeight + 35);
        sidebar.style.maxHeight = currentHeight + 'px';
        sidebar.offsetHeight;

        sidebar.classList.remove('active-mobile');
        sidebar.style.maxHeight = '0px';

        if (sidebar._transitionCtrl) {
            try { sidebar._transitionCtrl.abort(); } catch {}
        }
        const closeCtrl = new AbortController();
        sidebar._transitionCtrl = closeCtrl;

        const onCloseEnd = (e) => {
            if (e.target === sidebar && e.propertyName === 'max-height') {
                closeCtrl.abort();
                sidebar._transitionCtrl = null;
                if (!sidebar.classList.contains('active-mobile')) {
                    sidebar.style.maxHeight = '';
                }
            }
        };
        sidebar.addEventListener('transitionend', onCloseEnd, { signal: closeCtrl.signal });
        if (hasAction('checkPendingBroadcast')) {
            setTimeout(() => invokeAction('checkPendingBroadcast'), 350);
        }
    }
}
