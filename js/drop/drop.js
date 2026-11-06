// ==========================================
// NISHA DROP MODULE (Предложить вещь / DROP_ITEM.EXE)
// ==========================================

// Глобальный массив для файлов предложки: объекты { file, url }
let currentProposalFiles = [];
window.currentProposalFiles = currentProposalFiles;

// Сортировщик Sortable
let proposalSortable = null;

// // Очередь фоновой отправки предложек с авто-повтором при сбоях сети
let proposalUploadChain = Promise.resolve();
let activeProposalUploads = 0;

window.addEventListener('beforeunload', (e) => {
    if (activeProposalUploads > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

async function sendProposalFormDataWithRetry(formData, maxAttempts = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await window.apiClient.fetchRaw('/api/propose-files', {
                method: 'POST',
                body: formData,
                timeout: 45000,
                retries: 0
            });
            if (res.ok) {
                return true;
            }
            const errText = await res.text().catch(() => '');
            lastError = new Error(`HTTP ${res.status}: ${errText}`);
            console.warn(`[PROPOSAL UPLOAD] Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);
        } catch (err) {
            lastError = err;
            console.warn(`[PROPOSAL UPLOAD] Network error on attempt ${attempt}/${maxAttempts}:`, err.message);
        }
        if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 1500 * attempt));
        }
    }
    throw lastError || new Error('Upload failed');
}

function enqueueProposalUpload(formData) {
    activeProposalUploads++;
    proposalUploadChain = proposalUploadChain
        .then(() => sendProposalFormDataWithRetry(formData, 3))
        .catch((err) => {
            console.error('[PROPOSAL BACKGROUND UPLOAD FAILED]', err);
            if (typeof showToast === 'function') {
                const errMsg = (typeof i18next !== 'undefined' && i18next.t('propose.err_network')) || 'Ошибка отправки вещи на сервер. Проверьте интернет и попробуйте еще раз.';
                showToast(errMsg, 'error');
            }
        })
        .finally(() => {
            activeProposalUploads = Math.max(0, activeProposalUploads - 1);
        });
    return proposalUploadChain;
}

// Защита поля «Название вещи» от автозаполнения браузером ФИО покупателя (Chrome Autofill принимает поле за «имя»)
function sanitizeProposalNameField() {
    const el = document.getElementById('propName');
    if (!el || el.dataset.userTyped === '1') return;
    const val = (el.value || '').trim();
    if (!val) return;

    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    let cachedDelivery = null;
    try { cachedDelivery = store ? store.getJSON('nisha_profile_delivery', null) : null; } catch (e) {}
    const prof = window.userProfile || (typeof userProfile !== 'undefined' ? userProfile : null);

    const knownNames = [
        prof?.full_name,
        prof?.username,
        cachedDelivery?.full_name,
        document.getElementById('orderName')?.value,
        document.getElementById('profileDeliveryFullName')?.value,
        document.getElementById('modalProfileDeliveryFullName')?.value
    ].map(norm).filter(Boolean);

    if (knownNames.includes(norm(val))) {
        el.value = '';
    }
}
window.sanitizeProposalNameField = sanitizeProposalNameField;

// Любой реальный ввод пользователя в поле названия отключает авто-очистку (чтобы не стереть то, что он написал сам)
['keydown', 'paste', 'compositionstart'].forEach(evtName => {
    document.addEventListener(evtName, (e) => {
        if (e.target && e.target.id === 'propName') e.target.dataset.userTyped = '1';
    }, true);
});
['input', 'change', 'focusin'].forEach(evtName => {
    document.addEventListener(evtName, (e) => {
        if (e.target && e.target.id === 'propName') sanitizeProposalNameField();
    }, true);
});

// 1. Открытие модального окна предложки
function openProposeModal() {
    if (typeof lenis !== 'undefined' && window.stopLenis) window.stopLenis();
    if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
    if (typeof resetPropBargainState === 'function') {
        resetPropBargainState();
    }
    const propNameEl = document.getElementById('propName');
    if (propNameEl) {
        delete propNameEl.dataset.userTyped;
        // Автозаполнение браузера может прилететь с задержкой — мгновенная проверка через очередь микрозадач и отложенные таймеры
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(sanitizeProposalNameField);
        } else if (typeof runMicrotask === 'function') {
            runMicrotask(sanitizeProposalNameField);
        } else {
            Promise.resolve().then(sanitizeProposalNameField);
        }
        [150, 400, 900, 1800].forEach(ms => setTimeout(sanitizeProposalNameField, ms));
    }
    const contactEl = document.getElementById('propContact');
    if (contactEl && !contactEl.value.trim() && window._lastProposalContact) {
        contactEl.value = window._lastProposalContact;
    }
    if (typeof Sortable === 'undefined' && typeof window.Sortable === 'undefined') {
        import('sortablejs').then(mod => {
            window.Sortable = mod.default || mod;
        }).catch(() => {});
    }
    
    if (typeof openModal === 'function') {
        openModal('proposeModal');
        if (typeof triggerModalTypewriter === 'function') triggerModalTypewriter('proposeModal');
        if (typeof initTurnstileWidgets === 'function') {
            setTimeout(initTurnstileWidgets, 100);
        }
    } else {
        const modal = document.getElementById('proposeModal');
        if (modal) {
            if (modal._closeTimer) {
                clearTimeout(modal._closeTimer);
                modal._closeTimer = null;
            }
            modal.inert = false;
            modal.removeAttribute('inert');
            modal.setAttribute('aria-hidden', 'false');
            modal.classList.remove('closing');
            modal.style.pointerEvents = '';
            const win = modal.querySelector('.modal-window');
            if (win) {
                win.style.transform = '';
                win.style.opacity = '';
                win.style.transition = '';
                win.style.animation = '';
            }
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            if (typeof initTurnstileWidgets === 'function') {
                setTimeout(initTurnstileWidgets, 100);
            }
        }
    }
}
window.openProposeModal = openProposeModal;

// 2. Сжатие фото (легкое для памяти телефонов + защита от зависания)
async function compressImage(file) {
    if (!file || (file.type && file.type.startsWith('video/'))) return file;

    return new Promise((resolve) => {
        let settled = false;
        const objectUrl = URL.createObjectURL(file);
        const finish = (resultFile) => {
            if (settled) return;
            settled = true;
            try { URL.revokeObjectURL(objectUrl); } catch (e) {}
            resolve(resultFile || file);
        };

        const timeoutId = setTimeout(() => finish(file), 8000);
        const img = new Image();

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1200; // Жмем до 1200px

                // Пропорционально уменьшаем размеры
                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    clearTimeout(timeoutId);
                    if (blob) {
                        finish(new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' }));
                    } else {
                        finish(file);
                    }
                }, 'image/jpeg', 0.7);
            } catch (e) {
                clearTimeout(timeoutId);
                finish(file);
            }
        };

        img.onerror = () => {
            // Фолбек для форматов типа HEIC
            clearTimeout(timeoutId);
            finish(file);
        };

        img.src = objectUrl;
    });
}
window.compressImage = compressImage;

// 3. Полная очистка формы предложки
function resetProposalForm() {
    window._propBargainEnabled = false;
    window._propBargainMode = false;
    if (typeof resetPropBargainState === 'function') {
        resetPropBargainState();
    } else if (typeof window.hidePropBargainInput === 'function') {
        window.hidePropBargainInput(true);
    }
    const fields = ['propBrand', 'propSize', 'propCond', 'propPrice', 'propContact', 'propName', 'propDesc', 'propMinBargainPrice'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            if (id === 'propName') delete el.dataset.userTyped;
        }
    });
    
    const filesInput = document.getElementById('propFiles');
    if (filesInput) filesInput.value = '';
    
    // Освобождаем Blob URLs из памяти устройства
    if (Array.isArray(currentProposalFiles)) {
        currentProposalFiles.forEach(item => {
            if (item && item.url) {
                try { URL.revokeObjectURL(item.url); } catch(e) {}
            }
        });
    }

    currentProposalFiles = [];
    window.currentProposalFiles = currentProposalFiles;
    
    renderProposalPreviews();
    if (typeof updateProposeAndCheckoutFields === 'function') updateProposeAndCheckoutFields();
    const contactEl = document.getElementById('propContact');
    if (contactEl && !contactEl.value.trim() && window._lastProposalContact) {
        contactEl.value = window._lastProposalContact;
    }
    const descLabel = document.getElementById('descLabel');
    if (descLabel) {
        descLabel.innerText = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
            ? i18next.t('propose.desc_label', { defaultValue: 'ОПИСАНИЕ И ДЕФЕКТЫ (ДО 250 СИМВОЛОВ):' })
            : 'ОПИСАНИЕ И ДЕФЕКТЫ (ДО 250 СИМВОЛОВ):';
        descLabel.style.color = '';
    }
    
    const propWidgetId = (typeof turnstilePropWidgetId !== 'undefined') ? turnstilePropWidgetId : window.turnstilePropWidgetId;
    if (typeof turnstile !== 'undefined' && propWidgetId !== null && propWidgetId !== undefined) {
        try { turnstile.reset(propWidgetId); } catch(e) {}
    }
    window._turnstilePropToken = null;
}
window.resetProposalForm = resetProposalForm;

function openPropBargainInput() {
    const label = document.getElementById('propPriceLabel');
    const priceInput = document.getElementById('propPrice');
    const minBox = document.getElementById('propMinBargainBox');
    const minInput = document.getElementById('propMinBargainPrice');
    const btnToggle = document.getElementById('btnTogglePropBargain');
    const btnConfirm = document.getElementById('btnConfirmPropBargain');

    if (!minBox || !btnConfirm) return;

    window._propBargainMode = true;

    // 1. Анимация зеленого лейбла
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

    // 2. Переключение инпута с комфортной анимацией
    if (priceInput) priceInput.style.display = 'none';
    minBox.style.display = 'flex';
    minBox.classList.remove('anim-switch');
    void minBox.offsetWidth;
    minBox.classList.add('anim-switch');

    // 3. Переключение кнопки справа на черную с зеленой галочкой
    if (btnToggle) btnToggle.style.display = 'none';
    btnConfirm.style.display = 'flex';
    btnConfirm.classList.remove('anim-switch');
    void btnConfirm.offsetWidth;
    btnConfirm.classList.add('anim-switch');

    if (minInput) minInput.focus();
}
window.openPropBargainInput = openPropBargainInput;

function confirmPropBargainInput() {
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

    if (typeof showBargainSavedToast === 'function') {
        showBargainSavedToast(minBid);
    } else {
        const onMsg = (typeof i18next !== 'undefined')
            ? i18next.t('propose.toast_bargain_on', { min: minBid, defaultValue: `Торг включен (мин. ставка: ${minBid} грн)` })
            : `Торг включен (мин. ставка: ${minBid} грн)`;
        if (typeof showToast === 'function') showToast(onMsg, 'success');
    }
}
window.confirmPropBargainInput = confirmPropBargainInput;

function showBargainSavedToast(minBid) {
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
window.showBargainSavedToast = showBargainSavedToast;

function hidePropBargainInput(silent = false) {
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
window.hidePropBargainInput = hidePropBargainInput;

function returnToDesiredPriceMode(hasBargain = false, minBid = null) {
    const label = document.getElementById('propPriceLabel');
    const priceInput = document.getElementById('propPrice');
    const minBox = document.getElementById('propMinBargainBox');
    const btnToggle = document.getElementById('btnTogglePropBargain');
    const btnConfirm = document.getElementById('btnConfirmPropBargain');

    window._propBargainMode = false;

    // 1. Анимация лейбла назад
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

    // 2. Переключение инпутов с анимацией
    if (minBox) minBox.style.display = 'none';
    if (priceInput) {
        priceInput.style.display = 'block';
        priceInput.classList.remove('anim-switch');
        void priceInput.offsetWidth;
        priceInput.classList.add('anim-switch');
    }

    // 3. Переключение кнопки справа
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
window.returnToDesiredPriceMode = returnToDesiredPriceMode;

function resetPropBargainState() {
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
if (typeof globalThis !== 'undefined') globalThis.resetPropBargainState = resetPropBargainState;


// 4. Добавление новых файлов (до 5 шт)
function handleNewProposalFiles(newFiles) {
    if (!newFiles || newFiles.length === 0) return;

    // Оставляем только фото и видео (включая HEIC/MOV на iOS, где file.type может быть пустым)
    const validFiles = newFiles.filter(f => {
        if (f.type && (f.type.startsWith('image/') || f.type.startsWith('video/'))) return true;
        const n = (f.name || '').toLowerCase();
        return /\.(jpg|jpeg|png|webp|heic|heif|gif|mp4|mov|webm|m4v)$/.test(n);
    });

    if (currentProposalFiles.length + validFiles.length > 5) {
        const maxFilesMsg = (typeof i18next !== 'undefined' && i18next.t('propose.err_max_files')) || 'Максимум 5 фото/видео!';
        showToast(maxFilesMsg, 'error');
        return;
    }

    validFiles.forEach(file => {
        const isVid = (file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|m4v)$/i.test(file.name || '');
        const itemObj = {
            file: file,
            url: isVid ? null : URL.createObjectURL(file),
            width: 1200,
            height: 1200
        };
        if (!isVid && itemObj.url) {
            const probe = new Image();
            probe.onload = () => {
                if (probe.naturalWidth && probe.naturalHeight) {
                    itemObj.width = probe.naturalWidth;
                    itemObj.height = probe.naturalHeight;
                }
            };
            probe.src = itemObj.url;
        }
        currentProposalFiles.push(itemObj);
    });
    
    window.currentProposalFiles = currentProposalFiles;
    renderProposalPreviews();
}
window.handleNewProposalFiles = handleNewProposalFiles;

// Функция открытия фото в полный экран через PhotoSwipe
async function openProposalPhotoByIndex(index, element = null) {
    let targetIndex = index;
    if (element) {
        const previewEl = element.closest('.preview-img');
        if (previewEl && previewEl.parentElement) {
            const allPreviews = Array.from(previewEl.parentElement.querySelectorAll('.preview-img'));
            const domIndex = allPreviews.indexOf(previewEl);
            if (domIndex !== -1) targetIndex = domIndex;
        }
    }
    const files = Array.isArray(window.currentProposalFiles) ? window.currentProposalFiles : currentProposalFiles;
    if (typeof targetIndex !== 'number' || targetIndex < 0 || targetIndex >= files.length) return;
    const item = files.at(targetIndex);
    if (!item || !item.url) return;

    if (typeof ensurePhotoSwipe === 'function') {
        await ensurePhotoSwipe();
    }

    if (window.PhotoSwipeLightbox) {
        const photos = files.filter(f => f && f.url);
        const clickedIndex = photos.findIndex(f => f === item);
        if (clickedIndex < 0) return;

        const pswp = new window.PhotoSwipeLightbox({
            dataSource: photos.map(f => ({
                src: f.url,
                width: f.width || 1200,
                height: f.height || 1200
            })),
            pswpModule: window.PhotoSwipe || (() => import('photoswipe'))
        });
        pswp.init();
        pswp.loadAndOpen(clickedIndex);
    }
}
window.openProposalPhotoByIndex = openProposalPhotoByIndex;
if (typeof globalThis !== 'undefined') globalThis.openProposalPhotoByIndex = openProposalPhotoByIndex;

// Функция удаления файла из предложки с освобождением памяти
function removeProposalFile(index, element = null) {
    let targetIndex = index;
    if (element && typeof element.closest === 'function') {
        const previewEl = element.closest('.preview-img');
        if (previewEl && previewEl.parentElement) {
            const allPreviews = Array.from(previewEl.parentElement.querySelectorAll('.preview-img'));
            const domIndex = allPreviews.indexOf(previewEl);
            if (domIndex !== -1) targetIndex = domIndex;
        }
    }
    const files = Array.isArray(window.currentProposalFiles) ? window.currentProposalFiles : currentProposalFiles;
    if (typeof targetIndex !== 'number' || targetIndex < 0 || targetIndex >= files.length) return;
    const removed = files.splice(targetIndex, 1);
    if (removed && removed.length > 0 && removed.at(0)?.url) {
        try { URL.revokeObjectURL(removed.at(0).url); } catch (e) {}
    }
    currentProposalFiles = files;
    window.currentProposalFiles = files;
    if (typeof triggerHaptic === 'function') triggerHaptic('light');
    renderProposalPreviews();
}
window.removeProposalFile = removeProposalFile;
if (typeof globalThis !== 'undefined') globalThis.removeProposalFile = removeProposalFile;

// 5. Отрисовка превью с сортировкой и зумом
function renderProposalPreviews() {
    const container = document.getElementById('propPreviewContainer');
    const placeholder = document.getElementById('propPlaceholder');
    if (!container) return;

    if (typeof container.replaceChildren === 'function') container.replaceChildren();
    else container.innerHTML = '';

    if (currentProposalFiles.length > 0) {
        if (placeholder) placeholder.style.display = 'none';

        currentProposalFiles.forEach((item, index) => {
            const img = document.createElement('div');
            img.className = 'preview-img';
            img.setAttribute('data-index', index);
            img.setAttribute('data-action', 'preview-proposal-photo');
            img.setAttribute('title', 'Нажмите, чтобы просмотреть');

            if (!item.url) { 
                img.style.backgroundColor = '#111';
                img.innerHTML = '<span style="color:var(--accent-green); font-family:var(--font-mono); font-size:10px; display:flex; align-items:center; justify-content:center; height:100%; text-shadow:0 0 5px #000;">▶ VID</span>';
            } else {
                img.style.backgroundImage = `url('${item.url}')`;
            }

            const delBtn = document.createElement('div');
            delBtn.innerHTML = '✖';
            delBtn.className = 'preview-del-btn';
            delBtn.setAttribute('data-action', 'delete-proposal-photo');
            delBtn.setAttribute('data-index', index);
            delBtn.setAttribute('title', 'Удалить');
            
            // Удаление фото с освобождением памяти Blob URL
            delBtn.onclick = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                }
                removeProposalFile(index, delBtn);
            };
            img.appendChild(delBtn);

            // Клик по превью — открывает на весь экран через PhotoSwipe
            img.onclick = async (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                }
                openProposalPhotoByIndex(index, img);
            };

            container.appendChild(img);
        });

        // Сортировка SortableJS
        if (proposalSortable) {
            proposalSortable.destroy();
            proposalSortable = null;
        }

        const initSortable = () => {
            const SortableLib = window.Sortable || (typeof Sortable !== 'undefined' ? Sortable : null);
            if (!SortableLib || !container || currentProposalFiles.length <= 1) return;
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

            proposalSortable = SortableLib.create(container, {
                animation: 150,
                delay: isTouchDevice ? 150 : 0, 
                delayOnTouchOnly: true,
                touchStartThreshold: 5,
                forceFallback: isTouchDevice, 
                fallbackOnBody: false, 
                ghostClass: 'sortable-ghost', 
                dragClass: 'sortable-drag', 
                filter: '.preview-del-btn',
                preventOnFilter: false,
                onStart: function () {
                    if (isTouchDevice) {
                        if (typeof triggerHaptic === 'function') triggerHaptic('medium'); 
                        document.body.classList.add('sort-lock');
                        const modalWin = document.querySelector('#proposeModal .modal-window');
                        if (modalWin) {
                            modalWin.style.overflow = 'hidden';
                            modalWin.style.touchAction = 'none';
                        }
                    }
                },
                onEnd: function (evt) {
                    if (isTouchDevice) {
                        document.body.classList.remove('sort-lock');
                        const modalWin = document.querySelector('#proposeModal .modal-window');
                        if (modalWin) {
                            modalWin.style.overflow = 'auto';
                            modalWin.style.touchAction = 'auto';
                        }
                        if (typeof triggerHaptic === 'function') triggerHaptic('light'); 
                    }
                    
                    const movedItem = currentProposalFiles.splice(evt.oldIndex, 1)[0];
                    currentProposalFiles.splice(evt.newIndex, 0, movedItem);
                    window.currentProposalFiles = currentProposalFiles;

                    // Обновляем data-index на элементах DOM после перемещения
                    container.querySelectorAll('.preview-img').forEach((el, idx) => {
                        el.setAttribute('data-index', idx);
                        const btn = el.querySelector('.preview-del-btn');
                        if (btn) btn.setAttribute('data-index', idx);
                    });
                }
            });
        };

        if (window.Sortable) {
            initSortable();
        } else if (currentProposalFiles.length > 1) {
            import('sortablejs').then(mod => {
                window.Sortable = mod.default || mod;
                initSortable();
            }).catch(err => {
                console.warn('[Sortable] Local load failed, trying CDN:', err);
                if (typeof loadExternalScript === 'function') {
                    loadExternalScript('https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/Sortable.min.js').then(initSortable).catch(() => {});
                }
            });
        }
    } else {
        if (placeholder) placeholder.style.display = 'block';
    }
}
window.renderProposalPreviews = renderProposalPreviews;

// 6. Отправка заявки на сервер
async function submitProposal() {
    const btn = document.getElementById('btnSubmitProp');
    if (!btn || window._isSubmittingProposal) return;
    
    const files = currentProposalFiles.map(obj => obj.file).filter(Boolean);
    
    // Считываем значения полей
    const rawName = (document.getElementById('propName')?.value || '').trim();
    const rawBrand = (document.getElementById('propBrand')?.value || '').trim();
    const rawSize = (document.getElementById('propSize')?.value || '').trim();
    const rawDesc = (document.getElementById('propDesc')?.value || '').trim();
    const cond = Number.parseInt(document.getElementById('propCond')?.value, 10);
    const price = Number.parseInt(document.getElementById('propPrice')?.value, 10) || 0; 
    let rawContact = (document.getElementById('propContact')?.value || '').trim();
    
    if (!rawContact && typeof getUserPhone === 'function' && typeof getUserTg === 'function') {
        const uPhone = getUserPhone();
        const uTg = getUserTg();
        if (uPhone && uTg) rawContact = `${uTg} | ${uPhone}`;
        else if (uTg) rawContact = uTg;
        else if (uPhone) rawContact = uPhone;
    }
    if (!rawContact && window._lastProposalContact) {
        rawContact = window._lastProposalContact;
    }
    
    // Очистка от вредоносного кода
    const sanitize = (typeof window.sanitizeText === 'function') ? window.sanitizeText : (s) => String(s || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const nameItem = sanitize(rawName); 
    const brand = sanitize(rawBrand);
    const size = sanitize(rawSize);
    const desc = sanitize(rawDesc);
    const contact = sanitize(rawContact);

    // Валидация
    if ((Number.isNaN(price) || price <= 0) && window._propBargainMode) {
        const minEl = document.getElementById('propMinBargainPrice');
        const savedMin = Number.parseInt((minEl?.value || '').trim(), 10);
        if (!Number.isNaN(savedMin) && savedMin >= 100) {
            window._propBargainEnabled = true;
            returnToDesiredPriceMode(true, savedMin);
        } else {
            returnToDesiredPriceMode(false);
        }
        const prEl = document.getElementById('propPrice');
        if (prEl) prEl.focus();
    }

    const minBargainInput = document.getElementById('propMinBargainPrice');
    const rawMinBargain = (minBargainInput?.value || '').trim();

    // Защита: если открыт ввод торга или введена мин. ставка, но галочка подтверждения [ ✓ ] не была нажата
    if (window._propBargainMode || (rawMinBargain && !window._propBargainEnabled)) {
        if (typeof triggerHaptic === 'function') triggerHaptic('warning');
        const confirmMsg = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
            ? i18next.t('propose.err_confirm_bargain', { defaultValue: 'Подтвердите торг нажатием на галочку [ ✓ ]!' })
            : 'Подтвердите торг нажатием на галочку [ ✓ ]!';
        showToast(confirmMsg, 'warning');

        const btnConfirm = document.getElementById('btnConfirmPropBargain');
        if (btnConfirm && btnConfirm.style.display !== 'none') {
            btnConfirm.focus();
            btnConfirm.classList.add('pulse-highlight');
            setTimeout(() => btnConfirm.classList.remove('pulse-highlight'), 1200);
        } else if (minBargainInput) {
            minBargainInput.focus();
        }
        return;
    }

    if (!files.length || !nameItem || !brand || !size || !desc || Number.isNaN(cond) || Number.isNaN(price) || price <= 0 || !contact) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        const fillAllMsg = (typeof i18next !== 'undefined' && i18next.t('propose.err_fill_all')) || 'Пожалуйста, заполните АБСОЛЮТНО ВСЕ поля!';
        showToast(fillAllMsg, 'error');
        return;
    }

    if (cond < 1 || cond > 10) {
        const condMsg = (typeof i18next !== 'undefined' && i18next.t('propose.err_cond_range')) || 'Оценка состояния от 1 до 10!';
        showToast(condMsg, 'error');
        return;
    }

    let minBargainPrice = null;

    if (window._propBargainEnabled && rawMinBargain) {
        minBargainPrice = Number.parseInt(rawMinBargain, 10);
        if (Number.isNaN(minBargainPrice) || minBargainPrice < 100) {
            if (typeof triggerHaptic === 'function') triggerHaptic('error');
            const minBargainMsg = (typeof i18next !== 'undefined' && i18next.t('propose.err_bargain_min')) || 'Минимальная цена торга должна быть не менее 100 грн!';
            showToast(minBargainMsg, 'error');
            if (!window._propBargainMode && typeof openPropBargainInput === 'function') openPropBargainInput();
            else if (minBargainInput) minBargainInput.focus();
            return;
        }
        if (minBargainPrice >= price) {
            if (typeof triggerHaptic === 'function') triggerHaptic('error');
            const lessPriceMsg = (typeof i18next !== 'undefined' && i18next.t('propose.err_bargain_less_price')) || 'Минимальная цена торга должна быть меньше желаемой цены!';
            showToast(lessPriceMsg, 'error');
            if (!window._propBargainMode && typeof openPropBargainInput === 'function') openPropBargainInput();
            else if (minBargainInput) minBargainInput.focus();
            return;
        }
    }

    // Сохраняем контакт для мгновенной отправки следующей вещи без повторного ввода
    window._lastProposalContact = contact;

    // Фоновый токен Turnstile (защита от повторной отправки уже использованного токена)
    const propWidgetId = (typeof turnstilePropWidgetId !== 'undefined') ? turnstilePropWidgetId : window.turnstilePropWidgetId;
    let propToken = window._turnstilePropToken || (typeof turnstile !== 'undefined' && propWidgetId !== null && propWidgetId !== undefined ? turnstile.getResponse(propWidgetId) : null);
    if (propToken && propToken === window._lastUsedPropToken) {
        propToken = null;
    }
    if (propToken) {
        window._lastUsedPropToken = propToken;
    }

    window._isSubmittingProposal = true;
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.7';

    try {
        // Сжатие фотографий
        let compressedFiles = [];
        for (let i = 0; i < files.length; i++) {
            const compressText = typeof i18next !== 'undefined' ? i18next.t('propose.compressing', { defaultValue: 'СЖАТИЕ ФОТО' }) : 'СЖАТИЕ ФОТО';
                btn.innerText = `[ ${compressText}: ${i + 1}/${files.length} ]`;
            const compressed = await compressImage(files.at(i));
            compressedFiles.push(compressed);
        }
        
        const activeUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : (window.currentUser || null);
        const activeFp = (typeof clientFingerprint !== 'undefined' && clientFingerprint) ? clientFingerprint : (window.clientFingerprint || null);
        const activeClientId = activeUser ? activeUser.id : (activeFp || 'guest_' + Date.now());

        const formData = new FormData();
        formData.append('name', nameItem);
        formData.append('brand', brand);
        formData.append('measurements', size);
        formData.append('condition', cond);
        formData.append('price', price);
        let finalDesc = desc;
        if (minBargainPrice && !finalDesc.includes('[ТОРГ:')) {
            finalDesc = `${finalDesc}\n\n[ТОРГ: от ${minBargainPrice} грн]`;
        }
        formData.append('description', finalDesc);
        if (minBargainPrice) {
            formData.append('minBargainPrice', minBargainPrice);
            formData.append('isBargain', 'true');
        }
        formData.append('contact', contact);
        formData.append('clientId', activeClientId);
        if (propToken) formData.append('turnstileToken', propToken);
        
        compressedFiles.forEach((file, index) => {
            const isVid = (file && file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|m4v)$/i.test(file?.name || '');
            const ext = isVid ? 'mp4' : 'jpg';
            formData.append('images', file, `prop_${index}.${ext}`);
        });
        
        // Ставим в гарантированную очередь отправки на бэкенд (с авто-повтором при сбоях)
        enqueueProposalUpload(formData);
        if (window.analytics && typeof window.analytics.trackProposalSubmitted === 'function') {
            window.analytics.trackProposalSubmitted({
                brand,
                price,
                filesCount: compressedFiles.length
            });
        }
        
        // Мгновенно очищаем форму и разблокируем кнопку, чтобы можно было сразу закинуть вторую вещь без ожидания
        resetProposalForm();
        btn.innerText = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
            ? i18next.t('propose.btn_submit', { defaultValue: '[ ОТПРАВИТЬ ЗАЯВКУ ]' })
            : '[ ОТПРАВИТЬ ЗАЯВКУ ]';
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        window._isSubmittingProposal = false;
        
        if (typeof executeCloseModal === 'function') {
            executeCloseModal('proposeModal');
        } else if (typeof closeModal === 'function') {
            closeModal('proposeModal');
        }
        
        setTimeout(() => {
            const okTitle = (typeof i18next !== 'undefined' && i18next.t('propose.success_title', { defaultValue: 'SYSTEM_OK.LOG' })) || 'SYSTEM_OK.LOG';
            const okText = (typeof i18next !== 'undefined' && i18next.t('propose.success_text', { defaultValue: 'Заявка успешно отправлена.' })) || 'Заявка успешно отправлена.';
            const okBtn = (typeof i18next !== 'undefined' && i18next.t('propose.btn_close', { defaultValue: '[ ЗАКРЫТЬ ]' })) || '[ ЗАКРЫТЬ ]';
            showTerminalModal(okTitle, okText, okBtn, null);
        }, 100);

    } catch (err) {
        console.error(err);
        const serverErrPref = typeof i18next !== 'undefined' ? i18next.t('propose.err_server', { defaultValue: 'Сбой сервера: ' }) : 'Сбой сервера: ';
        showToast(serverErrPref + err.message, 'error');
        btn.innerText = typeof i18next !== 'undefined' ? i18next.t('propose.btn_retry', { defaultValue: '[ ПОВТОРИТЬ ПОПЫТКУ ]' }) : '[ ПОВТОРИТЬ ПОПЫТКУ ]';
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        window._isSubmittingProposal = false;
    }
}
window.submitProposal = submitProposal;

// 7. Инициализация слушателей для инпута и Drag & Drop
function initProposalListeners() {
    const minInput = document.getElementById('propMinBargainPrice');
    if (minInput && !minInput._bargainKeyBound) {
        minInput._bargainKeyBound = true;
        minInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmPropBargainInput();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hidePropBargainInput();
            }
        });
    }

    const fileInput = document.getElementById('propFiles');
    if (fileInput && !fileInput._propBound) {
        fileInput._propBound = true;
        fileInput.addEventListener('change', function(e) {
            handleNewProposalFiles(Array.from(e.target.files));
            this.value = '';
        });
    }

    const dropzone = document.getElementById('propDropzone');
    if (dropzone && !dropzone._propBound) {
        dropzone._propBound = true;
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.add('drag-active'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.remove('drag-active'), false);
        });

        dropzone.addEventListener('drop', e => {
            const droppedFiles = Array.from(e.dataTransfer.files);
            handleNewProposalFiles(droppedFiles);
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProposalListeners);
} else {
    initProposalListeners();
}
