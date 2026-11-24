// ==========================================
// NISHA DROP — CUSTOM TERMINAL SELECT UI & SIZE SYNC
// ==========================================

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];
const SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];
const ACCESSORY_SIZES = ['One Size', 'XS', 'S', 'M', 'L', 'XL'];

/**
 * Syncs `#propSize` options according to selected item category.
 * @param {string} category
 */
export function syncPropSizeOptionsByCategory(category) {
    const sizeSelect = document.getElementById('propSize');
    if (!sizeSelect || sizeSelect.tagName !== 'SELECT') return;

    let options = CLOTHING_SIZES;
    if (category === 'Обувь') options = SHOE_SIZES;
    else if (category === 'Аксессуары') options = ACCESSORY_SIZES;

    const prevValue = sizeSelect.value;
    sizeSelect.innerHTML = '';

    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent = '—';
    sizeSelect.appendChild(placeholderOpt);

    options.forEach(sz => {
        const opt = document.createElement('option');
        opt.value = sz;
        opt.textContent = sz;
        sizeSelect.appendChild(opt);
    });

    sizeSelect.value = options.includes(prevValue) ? prevValue : '';
    refreshCustomPropSelect(sizeSelect);
}

/**
 * Refreshes custom terminal select trigger label and dropdown options from the native <select>.
 * @param {HTMLSelectElement|null} selectEl
 */
export function refreshCustomPropSelect(selectEl) {
    if (!selectEl || typeof selectEl.closest !== 'function') return;
    const wrap = selectEl.closest('.prop-select-wrap');
    if (!wrap || typeof wrap.querySelector !== 'function') return;

    const trigger = wrap.querySelector('.prop-custom-trigger');
    const triggerText = wrap.querySelector('.prop-custom-trigger-text');
    const dropdown = wrap.querySelector('.prop-custom-dropdown');
    if (!trigger || !triggerText || !dropdown) return;

    const options = Array.from(selectEl.options || []);
    const selectedOpt = options.find(opt => opt.value === selectEl.value) || options[0];
    const currentLabel = selectedOpt ? selectedOpt.textContent : '';
    triggerText.textContent = currentLabel;
    trigger.classList.toggle('is-placeholder', !selectEl.value);

    dropdown.innerHTML = '';
    options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'prop-custom-option';
        btn.setAttribute('role', 'option');
        btn.dataset.value = opt.value;
        const isSelected = opt.value === selectEl.value;
        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        if (isSelected) btn.classList.add('is-selected');
        if (!opt.value) btn.classList.add('is-placeholder-opt');

        const labelSpan = document.createElement('span');
        labelSpan.textContent = opt.textContent;
        btn.appendChild(labelSpan);

        if (isSelected) {
            const checkSpan = document.createElement('span');
            checkSpan.className = 'prop-custom-option-check';
            checkSpan.textContent = '✓';
            btn.appendChild(checkSpan);
        }

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const changed = selectEl.value !== opt.value;
            selectEl.value = opt.value;
            wrap.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            refreshCustomPropSelect(selectEl);
            if (changed) {
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        dropdown.appendChild(btn);
    });
}

/**
 * Enhances a native <select> inside .prop-select-wrap with a custom terminal-styled dropdown
 * so mobile and desktop both render the NISHA dark/green UI instead of OS native popups.
 * @param {HTMLSelectElement|null} selectEl
 */
export function initCustomPropSelect(selectEl) {
    if (!selectEl || typeof selectEl.closest !== 'function' || typeof document.createElement !== 'function') return;
    const wrap = selectEl.closest('.prop-select-wrap');
    if (!wrap || typeof wrap.querySelector !== 'function') return;

    if (!wrap.querySelector('.prop-custom-trigger')) {
        selectEl.classList.add('prop-native-select-hidden');
        selectEl.tabIndex = -1;
        selectEl.setAttribute('aria-hidden', 'true');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'form-input prop-select prop-custom-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        if (selectEl.getAttribute('aria-label')) {
            trigger.setAttribute('aria-label', selectEl.getAttribute('aria-label'));
        }

        const triggerText = document.createElement('span');
        triggerText.className = 'prop-custom-trigger-text';
        trigger.appendChild(triggerText);

        const dropdown = document.createElement('div');
        dropdown.className = 'prop-custom-dropdown';
        dropdown.setAttribute('role', 'listbox');

        const arrow = wrap.querySelector('.prop-select-arrow');
        if (arrow) {
            wrap.insertBefore(trigger, arrow);
        } else {
            wrap.appendChild(trigger);
        }
        wrap.appendChild(dropdown);

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const willOpen = !wrap.classList.contains('is-open');
            document.querySelectorAll('.prop-select-wrap.is-open').forEach(w => {
                w.classList.remove('is-open');
                const t = w.querySelector('.prop-custom-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
            });
            if (willOpen) {
                refreshCustomPropSelect(selectEl);
                wrap.classList.add('is-open');
                trigger.setAttribute('aria-expanded', 'true');
            }
        });

        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                wrap.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (!selectEl._customPropBound) {
        selectEl._customPropBound = true;
        selectEl.addEventListener('change', () => refreshCustomPropSelect(selectEl));
    }

    if (typeof document !== 'undefined' && !window._propCustomSelectOutsideBound) {
        window._propCustomSelectOutsideBound = true;
        document.addEventListener('click', (e) => {
            if (e.target && typeof e.target.closest === 'function' && e.target.closest('.prop-select-wrap')) return;
            document.querySelectorAll('.prop-select-wrap.is-open').forEach(w => {
                w.classList.remove('is-open');
                const t = w.querySelector('.prop-custom-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
            });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.prop-select-wrap.is-open').forEach(w => {
                    w.classList.remove('is-open');
                    const t = w.querySelector('.prop-custom-trigger');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
            }
        });
    }

    refreshCustomPropSelect(selectEl);
}
