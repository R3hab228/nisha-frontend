// ==========================================
// NISHA DROP IMAGES: COMPRESSION, PREVIEWS & LIGHTBOX
// ==========================================

import { getProposalFiles, setProposalFiles } from './drop-state.js';
import { bindPhotoSwipeBackGesture } from '../ui/back-gesture.js';

let proposalSortable = null;
const BG_COMPRESS_CONCURRENCY = 2;
const bgCompressQueue = [];
let bgCompressActive = 0;

function pumpBackgroundCompression() {
    while (bgCompressActive < BG_COMPRESS_CONCURRENCY && bgCompressQueue.length > 0) {
        const job = bgCompressQueue.shift();
        if (!job || job.item._cancelled) {
            if (job) job.resolve(job.item?.file || null);
            continue;
        }
        bgCompressActive++;
        Promise.resolve()
            .then(() => compressImage(job.item.file))
            .then((compressed) => {
                if (!job.item._cancelled) {
                    job.item.compressedFile = compressed;
                }
                job.resolve(compressed);
            })
            .catch(() => {
                job.resolve(job.item.file);
            })
            .finally(() => {
                bgCompressActive = Math.max(0, bgCompressActive - 1);
                // Даем браузеру отрисовать кадр/обработать ввод текста между сжатиями
                setTimeout(pumpBackgroundCompression, 16);
            });
    }
}

function scheduleBackgroundCompression(itemObj) {
    if (!itemObj || !itemObj.file) return null;
    const isVid = (itemObj.file.type && itemObj.file.type.startsWith('video/')) || /\.(mp4|mov|webm|m4v)$/i.test(itemObj.file.name || '');
    if (isVid) {
        itemObj.compressedFile = itemObj.file;
        return Promise.resolve(itemObj.file);
    }
    const { promise, resolve } = Promise.withResolvers();
    itemObj.compressedPromise = promise;
    bgCompressQueue.push({ item: itemObj, resolve });
    // Запускаем после отрисовки превьюшек, чтобы интерфейс не дергался при выборе фото
    setTimeout(pumpBackgroundCompression, 30);
    return promise;
}

function canvasToBlobAsync(canvas, mimeType, quality) {
    return new Promise((resolve) => {
        try {
            canvas.toBlob((blob) => resolve(blob || null), mimeType, quality);
        } catch {
            resolve(null);
        }
    });
}

// Сжатие фото (асинхронное декодирование + WebP 1000px с фолбэком в JPEG без фризов UI)
export async function compressImage(file) {
    if (!file || (file.type && file.type.startsWith('video/'))) return file;

    const { promise, resolve } = Promise.withResolvers();

    let settled = false;
    const objectUrl = URL.createObjectURL(file);
    const finish = (resultFile) => {
        if (settled) return;
        settled = true;
        try { URL.revokeObjectURL(objectUrl); } catch {}
        resolve(resultFile || file);
    };

    const timeoutId = setTimeout(() => finish(file), 8000);
    const img = new Image();

    const processLoadedImage = async () => {
        if (settled) return;
        try {
            if (typeof img.decode === 'function') {
                await img.decode().catch(() => {});
            }
            if (settled) return;

            const canvas = document.createElement('canvas');
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            const MAX_SIZE = 1000;

            if (width > height && width > MAX_SIZE) {
                height = Math.round(height * (MAX_SIZE / width));
                width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
                width = Math.round(width * (MAX_SIZE / height));
                height = MAX_SIZE;
            }

            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                clearTimeout(timeoutId);
                finish(file);
                return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Пробуем WebP (на 25-35% легче при том же качестве), при неподдержке — JPEG
            let blob = await canvasToBlobAsync(canvas, 'image/webp', 0.8);
            let outType = 'image/webp';
            let outExt = 'webp';
            if (!blob || (blob.type && blob.type !== 'image/webp')) {
                blob = await canvasToBlobAsync(canvas, 'image/jpeg', 0.75);
                outType = 'image/jpeg';
                outExt = 'jpg';
            }

            clearTimeout(timeoutId);
            if (blob) {
                const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
                finish(new File([blob], `${baseName}.${outExt}`, { type: outType }));
            } else {
                finish(file);
            }
        } catch {
            clearTimeout(timeoutId);
            finish(file);
        }
    };

    img.onload = () => {
        void processLoadedImage();
    };

    img.onerror = () => {
        clearTimeout(timeoutId);
        finish(file);
    };

    img.src = objectUrl;
    return promise;
}

// Добавление новых файлов (до 5 шт)
export function handleNewProposalFiles(newFiles) {
    if (!newFiles || newFiles.length === 0) return;

    const validFiles = newFiles.filter(f => {
        if (f.type && (f.type.startsWith('image/') || f.type.startsWith('video/'))) return true;
        const n = (f.name || '').toLowerCase();
        return /\.(jpg|jpeg|png|webp|heic|heif|gif|mp4|mov|webm|m4v)$/.test(n);
    });

    const filesList = [...getProposalFiles()];

    if (filesList.length + validFiles.length > 5) {
        const maxFilesMsg = (typeof i18next !== 'undefined' && i18next.t('propose.err_max_files')) || 'Максимум 5 фото/видео!';
        if (typeof showToast === 'function') showToast(maxFilesMsg, 'error');
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
        scheduleBackgroundCompression(itemObj);
        filesList.push(itemObj);
    });

    setProposalFiles(filesList);
    renderProposalPreviews();
}

// Открытие фото в полный экран через PhotoSwipe
export async function openProposalPhotoByIndex(index, element = null) {
    let targetIndex = index;
    if (element) {
        const previewEl = element.closest('.preview-img');
        if (previewEl && previewEl.parentElement) {
            const allPreviews = Array.from(previewEl.parentElement.querySelectorAll('.preview-img'));
            const domIndex = allPreviews.indexOf(previewEl);
            if (domIndex !== -1) targetIndex = domIndex;
        }
    }
    const files = getProposalFiles();
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
            showHideAnimationType: 'fade',
            showAnimationDuration: 200,
            hideAnimationDuration: 200,
            pswpModule: window.PhotoSwipe || (() => import('photoswipe'))
        });
        bindPhotoSwipeBackGesture(pswp);
        pswp.init();
        pswp.loadAndOpen(clickedIndex);
    }
}

// Удаление файла из предложки с освобождением памяти
export function removeProposalFile(index, element = null) {
    let targetIndex = index;
    if (element && typeof element.closest === 'function') {
        const previewEl = element.closest('.preview-img');
        if (previewEl && previewEl.parentElement) {
            const allPreviews = Array.from(previewEl.parentElement.querySelectorAll('.preview-img'));
            const domIndex = allPreviews.indexOf(previewEl);
            if (domIndex !== -1) targetIndex = domIndex;
        }
    }
    const files = [...getProposalFiles()];
    if (typeof targetIndex !== 'number' || targetIndex < 0 || targetIndex >= files.length) return;
    const removed = files.splice(targetIndex, 1);
    if (removed && removed.length > 0 && removed.at(0)) {
        removed.at(0)._cancelled = true;
        if (removed.at(0).url) {
            try { URL.revokeObjectURL(removed.at(0).url); } catch {}
        }
    }
    setProposalFiles(files);
    if (typeof triggerHaptic === 'function') triggerHaptic('light');
    renderProposalPreviews();
}

// Отрисовка превью с сортировкой и зумом
export function renderProposalPreviews() {
    const container = document.getElementById('propPreviewContainer');
    const placeholder = document.getElementById('propPlaceholder');
    if (placeholder && placeholder.textContent && placeholder.textContent.includes('📸')) {
        placeholder.textContent = placeholder.textContent.replace(/📸\s*/g, '').trim();
    }
    if (!container) return;

    if (typeof container.replaceChildren === 'function') container.replaceChildren();
    else container.innerHTML = '';

    const files = getProposalFiles();

    if (files.length > 0) {
        if (placeholder) placeholder.style.display = 'none';

        files.forEach((item, index) => {
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

            if (typeof delBtn.addEventListener === 'function') {
                delBtn.addEventListener('click', (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                    }
                    removeProposalFile(index, delBtn);
                });
            }
            img.appendChild(delBtn);

            if (typeof img.addEventListener === 'function') {
                img.addEventListener('click', async (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                    }
                    openProposalPhotoByIndex(index, img);
                });
            }

            container.appendChild(img);
        });

        if (proposalSortable) {
            proposalSortable.destroy();
            proposalSortable = null;
        }

        const initSortable = () => {
            const SortableLib = window.Sortable || (typeof Sortable !== 'undefined' ? Sortable : null);
            const latestFiles = getProposalFiles();
            if (!SortableLib || !container || latestFiles.length <= 1) return;
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

                    const nextFiles = [...getProposalFiles()];
                    const movedItem = nextFiles.splice(evt.oldIndex, 1)[0];
                    nextFiles.splice(evt.newIndex, 0, movedItem);
                    setProposalFiles(nextFiles);

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
        } else if (files.length > 1) {
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
