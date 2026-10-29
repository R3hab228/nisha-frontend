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
    const propNameEl = document.getElementById('propName');
    if (propNameEl) {
        delete propNameEl.dataset.userTyped;
        // Автозаполнение браузера может прилететь с задержкой — проверяем несколько раз после открытия окна
        [0, 150, 400, 900, 1800].forEach(ms => setTimeout(sanitizeProposalNameField, ms));
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
    const fields = ['propBrand', 'propSize', 'propCond', 'propPrice', 'propContact', 'propName', 'propDesc'];
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
    const item = files[targetIndex];
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
    if (removed && removed.length > 0 && removed[0].url) {
        try { URL.revokeObjectURL(removed[0].url); } catch (e) {}
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
    if (!files.length || !nameItem || !brand || !size || !desc || Number.isNaN(cond) || price <= 0 || !contact) {
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
            const compressed = await compressImage(files[i]);
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
        formData.append('description', desc);
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
