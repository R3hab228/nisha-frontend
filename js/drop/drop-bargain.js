// ==========================================
// NISHA DROP BARGAIN MODE & TOASTS
// ==========================================

export function openPropBargainInput() {
    const label = document.getElementById('propPriceLabel');
    const priceInput = document.getElementById('propPrice');
    const minBox = document.getElementById('propMinBargainBox');
    const minInput = document.getElementById('propMinBargainPrice');
    const btnToggle = document.getElementById('btnTogglePropBargain');
    const btnConfirm = document.getElementById('btnConfirmPropBargain');

    if (!minBox || !btnConfirm) return;

    window._propBargainMode = true;

    if (label) {
        label.classList.add('label-animating');
        setTimeout(() => {
            const minBidText = (typeof i18next !== 'undefined')
                ? i18next.t('propose.min_bid_label', { defaultValue: 'МИНИМАЛЬНАЯ СТАВКА (ГРН) :' })
                : 'МИНИМАЛЬНАЯ СТАВКА (ГРН) :';
            label.innerText = minBidText;
            label.setAttribute('data-i18n', 'propose.min_bid_label');
            label.classList.remove('label-animating');
        }, 110);
    }

    if (priceInput) priceInput.style.display = 'none';
    minBox.style.display = 'flex';
    minBox.classList.remove('anim-switch');
    void minBox.offsetWidth;
    minBox.classList.add('anim-switch');

    if (btnToggle) btnToggle.style.display = 'none';
    btnConfirm.style.display = 'flex';
    btnConfirm.classList.remove('anim-switch');
    void btnConfirm.offsetWidth;
    btnConfirm.classList.add('anim-switch');

    if (minInput) minInput.focus();
}

export function showBargainSavedToast(minBid) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const oldToast = container.querySelector('.toast-bargain-saved');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast toast-new-item toast-bargain-saved success';

    const tagText = (typeof i18next !== 'undefined')
        ? i18next.t('propose.toast_bargain_tag', { defaultValue: 'ТОРГ' })
        : 'ТОРГ';
    const savedText = (typeof i18next !== 'undefined')
        ? i18next.t('propose.toast_bargain_saved', { min: minBid, defaultValue: `СОХРАНЕНО: от ${minBid} грн` })
        : `СОХРАНЕНО: от ${minBid} грн`;

    toast.innerHTML = `
        <div class="toast-item-thumb toast-bargain-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green, #00ff66)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <div class="toast-item-content">
            <div class="toast-item-tag">${tagText}</div>
            <div class="toast-item-title">${savedText}</div>
        </div>
    `;

    container.appendChild(toast);

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        toast.classList.add('toast-leaving');
        setTimeout(() => toast.remove(), 320);
    };

    const timer = setTimeout(dismiss, 3200);
    toast.onclick = () => {
        clearTimeout(timer);
        dismiss();
    };
}

export function returnToDesiredPriceMode(hasBargain = false) {
    const label = document.getElementById('propPriceLabel');
    const priceInput = document.getElementById('propPrice');
    const minBox = document.getElementById('propMinBargainBox');
    const btnToggle = document.getElementById('btnTogglePropBargain');
    const btnConfirm = document.getElementById('btnConfirmPropBargain');

    window._propBargainMode = false;

    if (label) {
        label.classList.add('label-animating');
        setTimeout(() => {
            const priceLabelText = (typeof i18next !== 'undefined')
                ? i18next.t('propose.price_label', { defaultValue: 'ЖЕЛАЕМАЯ ЦЕНА (ГРН):' })
                : 'ЖЕЛАЕМАЯ ЦЕНА (ГРН):';
            label.innerText = priceLabelText;
            label.setAttribute('data-i18n', 'propose.price_label');
            label.classList.remove('label-animating');
        }, 110);
    }

    if (minBox) minBox.style.display = 'none';
    if (priceInput) {
        priceInput.style.display = 'block';
        priceInput.classList.remove('anim-switch');
        void priceInput.offsetWidth;
        priceInput.classList.add('anim-switch');
    }

    if (btnConfirm) btnConfirm.style.display = 'none';
    if (btnToggle) {
        btnToggle.style.display = 'flex';
        btnToggle.classList.remove('anim-switch');
        void btnToggle.offsetWidth;
        btnToggle.classList.add('anim-switch');

        if (hasBargain) {
            btnToggle.classList.add('active');
            const activeText = (typeof i18next !== 'undefined')
                ? i18next.t('propose.btn_bargain_active', { defaultValue: '[ ТОРГ ✓ ]' })
                : '[ ТОРГ ✓ ]';
            btnToggle.innerText = activeText;
        } else {
            btnToggle.classList.remove('active');
            const defText = (typeof i18next !== 'undefined')
                ? i18next.t('propose.btn_bargain', { defaultValue: '[ ТОРГ ]' })
                : '[ ТОРГ ]';
            btnToggle.innerText = defText;
        }
    }
}

export function hidePropBargainInput(silent = false) {
    const minInput = document.getElementById('propMinBargainPrice');
    if (minInput) minInput.value = '';
    const wasBargain = window._propBargainEnabled;
    window._propBargainEnabled = false;

    returnToDesiredPriceMode(false);

    if (wasBargain && !silent) {
        const offMsg = (typeof i18next !== 'undefined')
            ? i18next.t('propose.toast_bargain_off', { defaultValue: 'Торг выключен' })
            : 'Торг выключен';
        if (typeof showToast === 'function') showToast(offMsg, 'info');
    }
}

export function confirmPropBargainInput() {
    const minInput = document.getElementById('propMinBargainPrice');
    const priceInput = document.getElementById('propPrice');
    const rawVal = (minInput?.value || '').trim();

    if (!rawVal) {
        window._propBargainEnabled = false;
        hidePropBargainInput();
        return;
    }

    const minBid = Number.parseInt(rawVal, 10);
    if (Number.isNaN(minBid) || minBid < 100) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const minErrMsg = (typeof i18next !== 'undefined')
            ? i18next.t('propose.err_bargain_min', { defaultValue: 'Минимальная цена торга должна быть не менее 100 грн!' })
            : 'Минимальная цена торга должна быть не менее 100 грн!';
        if (typeof showToast === 'function') showToast(minErrMsg, 'error');
        if (minInput) minInput.focus();
        return;
    }

    const desiredPrice = Number.parseInt(priceInput?.value || '', 10);
    if (!Number.isNaN(desiredPrice) && desiredPrice > 0 && minBid >= desiredPrice) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const lessErrMsg = (typeof i18next !== 'undefined')
            ? i18next.t('propose.err_bargain_less_price', { defaultValue: 'Минимальная цена торга должна быть меньше желаемой цены!' })
            : 'Минимальная цена торга должна быть меньше желаемой цены!';
        if (typeof showToast === 'function') showToast(lessErrMsg, 'error');
        if (minInput) minInput.focus();
        return;
    }

    window._propBargainEnabled = true;
    if (typeof triggerHaptic === 'function') triggerHaptic('success');

    returnToDesiredPriceMode(true, minBid);

    if (priceInput && (!desiredPrice || Number.isNaN(desiredPrice) || desiredPrice <= 0)) {
        priceInput.focus();
    }

    showBargainSavedToast(minBid);
}

export function resetPropBargainState() {
    window._propBargainMode = false;
    const label = document.getElementById('propPriceLabel');
    const priceInput = document.getElementById('propPrice');
    const minBox = document.getElementById('propMinBargainBox');
    const btnToggle = document.getElementById('btnTogglePropBargain');
    const btnConfirm = document.getElementById('btnConfirmPropBargain');

    if (label) {
        label.classList.remove('label-animating');
        const priceLabelText = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
            ? i18next.t('propose.price_label', { defaultValue: 'ЖЕЛАЕМАЯ ЦЕНА (ГРН):' })
            : 'ЖЕЛАЕМАЯ ЦЕНА (ГРН):';
        label.innerText = priceLabelText;
        label.setAttribute('data-i18n', 'propose.price_label');
    }
    if (minBox) minBox.style.display = 'none';
    if (priceInput) priceInput.style.display = 'block';
    if (btnConfirm) btnConfirm.style.display = 'none';
    if (btnToggle) {
        btnToggle.style.display = 'flex';
        if (window._propBargainEnabled) {
            btnToggle.classList.add('active');
            const activeText = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
                ? i18next.t('propose.btn_bargain_active', { defaultValue: '[ ТОРГ ✓ ]' })
                : '[ ТОРГ ✓ ]';
            btnToggle.innerText = activeText;
        } else {
            btnToggle.classList.remove('active');
            const defText = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
                ? i18next.t('propose.btn_bargain', { defaultValue: '[ ТОРГ ]' })
                : '[ ТОРГ ]';
            btnToggle.innerText = defText;
        }
    }
}
window.resetPropBargainState = resetPropBargainState;
