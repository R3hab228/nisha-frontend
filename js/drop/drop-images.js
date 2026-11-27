// @ts-check
// ==========================================
// NISHA DROP IMAGES: COMPRESSION, PREVIEWS & LIGHTBOX
// ==========================================

import { getProposalFiles, setProposalFiles } from './drop-state.js';
import { bindPhotoSwipeBackGesture } from '../ui/back-gesture.js';

/** @type {any} */
let proposalSortable = null;
const BG_COMPRESS_CONCURRENCY = 2;
/** @type {Array<{ item: any, resolve: (val: any) => void }>} */
const bgCompressQueue = [];
let bgCompressActive = 0;

const BG_PREUPLOAD_CONCURRENCY = 2;
/** @type {Array<{ item: any, file: any, resolve: (val: any) => void }>} */
const bgPreuploadQueue = [];
let bgPreuploadActive = 0;

function pumpBackgroundPreupload() {
    while (bgPreuploadActive < BG_PREUPLOAD_CONCURRENCY && bgPreuploadQueue.length > 0) {
        const job = bgPreuploadQueue.shift();
        if (!job || job.item._cancelled || !job.file) {
            if (job) job.resolve(null);
            continue;
        }
        if (typeof window === 'undefined' || !window.apiClient || typeof window.apiClient.fetchRaw !== 'function') {
            job.resolve(null);
            continue;
        }
        bgPreuploadActive++;
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        job.item._uploadAbortCtrl = ctrl;

        const fd = new FormData();
        const f = job.file;
        const isVid = (f.type && f.type.startsWith('video/')) || /\.(mp4|mov|webm|m4v)$/i.test(f.name || '');
        const ext = isVid ? 'mp4' : (f.type === 'image/webp' ? 'webp' : 'jpg');
        fd.append('image', f, `prop_pre.${ext}`);

        window.apiClient.fetchRaw('/api/propose-media', {
            method: 'POST',
            body: fd,
            timeout: 25000,
            retries: 0,
            signal: ctrl ? ctrl.signal : undefined
        })
            .then(async (/** @type {any} */ res) => {
                if (!res || !res.ok || job.item._cancelled) return null;
                const data = await res.json().catch(() => null);
                const url = data && data.success && typeof data.url === 'string' ? data.url : null;
                if (url && !job.item._cancelled) {
                    job.item.uploadedUrl = url;
                }
                return url;
            })
            .catch(() => null)
            .then((/** @type {any} */ url) => job.resolve(url))
            .finally(() => {
                job.item._uploadAbortCtrl = null;
                bgPreuploadActive = Math.max(0, bgPreuploadActive - 1);
                setTimeout(pumpBackgroundPreupload, 16);
            });
    }
}

/**
 * @param {any} itemObj
 * @param {any} fileToUpload
 */
function scheduleBackgroundPreupload(itemObj, fileToUpload) {
    if (!itemObj || itemObj._cancelled || !fileToUpload) return null;
    if (typeof window === 'undefined' || !window.apiClient || typeof window.apiClient.fetchRaw !== 'function') {
        return null;
    }
    const { promise, resolve } = Promise.withResolvers();
    itemObj.uploadPromise = promise;
    bgPreuploadQueue.push({ item: itemObj, file: fileToUpload, resolve });
    if (typeof queueMicrotask === 'function') queueMicrotask(pumpBackgroundPreupload);
    else Promise.resolve().then(pumpBackgroundPreupload);
    return promise;
}

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
                    scheduleBackgroundPreupload(job.item, compressed);
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

/** @param {any} itemObj */
function scheduleBackgroundCompression(itemObj) {
    if (!itemObj || !itemObj.file) return null;
    const isVid = (itemObj.file.type && itemObj.file.type.startsWith('video/')) || /\.(mp4|mov|webm|m4v)$/i.test(itemObj.file.name || '');
    if (isVid) {
        itemObj.compressedFile = itemObj.file;
        scheduleBackgroundPreupload(itemObj, itemObj.file);
        return Promise.resolve(itemObj.file);
    }
    const { promise, resolve } = Promise.withResolvers();
    itemObj.compressedPromise = promise;
    bgCompressQueue.push({ item: itemObj, resolve });
    // Запускаем после отрисовки превьюшек, чтобы интерфейс не дергался при выборе фото
    setTimeout(pumpBackgroundCompression, 30);
    return promise;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} mimeType
 * @param {number} quality
 * @returns {Promise<Blob | null>}
 */
function canvasToBlobAsync(canvas, mimeType, quality) {
    return new Promise((resolve) => {
        try {
            canvas.toBlob((blob) => resolve(blob || null), mimeType, quality);
        } catch {
            resolve(null);
        }
    });
}

const CLIENT_COMPRESS_MAX_SIZE = 1000;
const CLIENT_COMPRESS_WEBP_QUALITY = 0.82;
const CLIENT_COMPRESS_JPEG_QUALITY = 0.78;

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [maxSize]
 */
function computeResizedDimensions(width, height, maxSize = CLIENT_COMPRESS_MAX_SIZE) {
    let targetW = width;
    let targetH = height;
    if (targetW > targetH && targetW > maxSize) {
        targetH = Math.round(targetH * (maxSize / targetW));
        targetW = maxSize;
    } else if (targetH > maxSize) {
        targetW = Math.round(targetW * (maxSize / targetH));
        targetH = maxSize;
    }
    return {
        width: Math.max(1, targetW),
        height: Math.max(1, targetH),
        wasResized: targetW !== width || targetH !== height
    };
}

/** @param {File} file */
async function compressWithOffscreenCanvas(file) {
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return null;
    let bitmap = null;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const { width, height, wasResized } = computeResizedDimensions(bitmap.width, bitmap.height);
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, width, height);

        let blob = await canvas.convertToBlob({ type: 'image/webp', quality: CLIENT_COMPRESS_WEBP_QUALITY }).catch(() => null);
        let outType = 'image/webp';
        let outExt = 'webp';
        if (!blob || (blob.type && blob.type !== 'image/webp')) {
            blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: CLIENT_COMPRESS_JPEG_QUALITY }).catch(() => null);
            outType = 'image/jpeg';
            outExt = 'jpg';
        }
        if (!blob) return null;
        if (!wasResized && file.type === outType && file.size > 0 && blob.size >= file.size) {
            return file;
        }
        const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
        return new File([blob], `${baseName}.${outExt}`, { type: outType });
    } catch {
        return null;
    } finally {
        if (bitmap && typeof bitmap.close === 'function') {
            try { bitmap.close(); } catch {}
        }
    }
}

// Сжатие фото (OffscreenCanvas + createImageBitmap fast-path или <canvas> fallback: WebP max 1600px)
/** @param {File} file */
export async function compressImage(file) {
    if (!file || (file.type && file.type.startsWith('video/'))) return file;

    const offscreenResult = await compressWithOffscreenCanvas(file);
    if (offscreenResult) return offscreenResult;

    const { promise, resolve } = Promise.withResolvers();

    let settled = false;
    const objectUrl = URL.createObjectURL(file);
    const finish = (/** @type {File} */ resultFile) => {
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
            const { width, height, wasResized } = computeResizedDimensions(
                img.naturalWidth || img.width,
                img.naturalHeight || img.height
            );

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                clearTimeout(timeoutId);
                finish(file);
                return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Пробуем WebP (на 25-35% легче при том же качестве), при неподдержке — JPEG
            let blob = await canvasToBlobAsync(canvas, 'image/webp', CLIENT_COMPRESS_WEBP_QUALITY);
            let outType = 'image/webp';
            let outExt = 'webp';
            if (!blob || (blob.type && blob.type !== 'image/webp')) {
                blob = await canvasToBlobAsync(canvas, 'image/jpeg', CLIENT_COMPRESS_JPEG_QUALITY);
                outType = 'image/jpeg';
                outExt = 'jpg';
            }

            clearTimeout(timeoutId);
            if (blob) {
                if (!wasResized && file.type === outType && file.size > 0 && blob.size >= file.size) {
                    finish(file);
                    return;
                }
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
/** @param {File[]} newFiles */
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
/**
 * @param {number} index
 * @param {Element | null} [element]
 */
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

        if (window._activeDropLightbox && typeof window._activeDropLightbox.destroy === 'function') {
            try { window._activeDropLightbox.destroy(); } catch {}
            window._activeDropLightbox = null;
        }
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
        window._activeDropLightbox = pswp;
        bindPhotoSwipeBackGesture(pswp);
        pswp.init();
        pswp.loadAndOpen(clickedIndex);
    }
}

// Удаление файла из предложки с освобождением памяти
/**
 * @param {number} index
 * @param {Element | null} [element]
 */
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
        if (removed.at(0)._uploadAbortCtrl) {
            try { removed.at(0)._uploadAbortCtrl.abort(); } catch {}
        }
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
            img.setAttribute('data-index', String(index));
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
            delBtn.setAttribute('data-index', String(index));
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
                        const modalWin = /** @type {HTMLElement | null} */ (document.querySelector('#proposeModal .modal-window'));
                        if (modalWin) {
                            modalWin.style.overflow = 'hidden';
                            modalWin.style.touchAction = 'none';
                        }
                    }
                },
                onEnd: function (/** @type {any} */ evt) {
                    if (isTouchDevice) {
                        document.body.classList.remove('sort-lock');
                        const modalWin = /** @type {HTMLElement | null} */ (document.querySelector('#proposeModal .modal-window'));
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
                        el.setAttribute('data-index', String(idx));
                        const btn = el.querySelector('.preview-del-btn');
                        if (btn) btn.setAttribute('data-index', String(idx));
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
