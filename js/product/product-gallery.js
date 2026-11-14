// ==========================================
// NISHA PRODUCT GALLERY, SLIDER, SWIPE & PHOTOSWIPE MODULE
// ==========================================

import {
    getActiveOpenedItem,
    getActiveSlideIndex,
    setActiveSlideIndex,
    toCDN
} from './product-state.js';

/**
 * Preloads the next/previous image slide when hovering slider controls.
 * @param {number} step
 */
export function preloadSlide(step) {
    const active = getActiveOpenedItem();
    if (!active || !active.images || active.images.length <= 1) return;
    const current = getActiveSlideIndex();
    const targetIndex = (current + step + active.images.length) % active.images.length;
    const url = toCDN(active.images[targetIndex]);
    if (url && !url.endsWith('.mp4')) {
        const img = new Image();
        img.src = url;
    }
}

/**
 * Updates slider transform, counter, active thumbnail, and pauses off-slide videos.
 * @param {boolean} [animated=true]
 */
export function updateSlider(animated = true) {
    const sliderWrapper = document.getElementById('sliderWrapper');
    if (!sliderWrapper) return;

    const current = getActiveSlideIndex();
    if (!animated && sliderWrapper.style) {
        sliderWrapper.style.transition = 'none';
    } else if (sliderWrapper.style) {
        sliderWrapper.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    }

    sliderWrapper.style.transform = `translateX(-${current * 100}%)`;

    if (!animated) {
        requestAnimationFrame(() => {
            if (sliderWrapper && sliderWrapper.style) {
                sliderWrapper.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            }
        });
    }

    const counter = document.getElementById('photoCounter');
    const total = document.querySelectorAll('.slide').length;
    if (counter) {
        counter.innerText = `${current + 1} / ${total}`;
    }

    const thumbs = document.querySelectorAll('.thumb');
    thumbs.forEach((t, i) => {
        t.classList.toggle('active-thumb', i === current);
    });

    const allSlides = Array.from(document.querySelectorAll('#sliderWrapper .slide'));
    allSlides.forEach((slide, idx) => {
        const vid = slide.querySelector('video.modal-video-player');
        if (vid) {
            if (idx === current) {
                vid.play().catch(() => {});
            } else {
                vid.pause();
            }
        }
    });
}

/**
 * Moves slider by relative step (+1 / -1) wrapping around total slides.
 * @param {number} step
 */
export function moveSlide(step) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    const nextIdx = (getActiveSlideIndex() + step + slides.length) % slides.length;
    setActiveSlideIndex(nextIdx);
    updateSlider();
}

/**
 * Jumps slider directly to slide index and preloads adjacent image.
 * @param {number} index
 * @param {boolean} [animated=true]
 */
export function setSlide(index, animated = true) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    setActiveSlideIndex(index);
    updateSlider(animated);

    const active = getActiveOpenedItem();
    if (active && active.images && active.images[index + 1]) {
        const nextUrl = toCDN(active.images[index + 1]);
        if (!nextUrl.endsWith('.mp4')) {
            const preImg = new Image();
            preImg.src = nextUrl;
        }
    }
}

/**
 * Renders product modal media slides (photos + mp4 videos), thumbnails, and PhotoSwipe click trigger.
 * @param {object} item
 */
export function renderModalSlider(item) {
    setActiveSlideIndex(0);
    const wrapper = document.getElementById('sliderWrapper');
    const thumbs = document.getElementById('modalThumbnails');
    if (wrapper) {
        if (wrapper.style) {
            wrapper.style.transition = 'none';
            wrapper.style.transform = 'translateX(0%)';
        }
        if (typeof wrapper.replaceChildren === 'function') wrapper.replaceChildren();
        else wrapper.innerHTML = '';
    }
    if (thumbs) {
        if (typeof thumbs.replaceChildren === 'function') thumbs.replaceChildren();
        else thumbs.innerHTML = '';
    }

    const mediaList = (Array.isArray(item.images) && item.images.length > 0)
        ? item.images
        : ((Array.isArray(item.thumbnails) && item.thumbnails.length > 0) ? item.thumbnails : []);

    const totalMedia = mediaList.length;
    const prevBtn = document.querySelector('.slider-btn.prev');
    const nextBtn = document.querySelector('.slider-btn.next');

    if (totalMedia <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    } else {
        if (prevBtn) prevBtn.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'block';
    }

    if (wrapper && thumbs) {
        if (mediaList.length > 0) {
            let slidesHtml = '';
            let thumbsHtml = '';
            mediaList.forEach((url, index) => {
                const cdnUrl = toCDN(url);
                const isVideo = typeof cdnUrl === 'string' && cdnUrl.endsWith('.mp4');
                let currentThumb = (item.thumbnails && item.thumbnails[index])
                    ? toCDN(item.thumbnails[index], { isThumb: true })
                    : toCDN(url, { isThumb: true });

                if (isVideo && (!item.thumbnails || !item.thumbnails[index])) {
                    currentThumb = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23000'/%3E%3Cpolygon points='40,30 70,50 40,70' fill='%2300ff00'/%3E%3Ctext x='50' y='88' font-family='monospace' font-size='11' font-weight='bold' fill='%2300ff00' text-anchor='middle'%3EVIDEO%3C/text%3E%3C/svg%3E";
                }

                if (isVideo) {
                    slidesHtml += `
                        <div class="slide img-8bit-loading" style="background:#000; display:flex; justify-content:center; align-items:center;">
                            <video 
                                class="modal-video-player"
                                autoplay="autoplay" 
                                muted="muted" 
                                loop="loop" 
                                playsinline="playsinline" 
                                webkit-playsinline="webkit-playsinline" 
                                preload="metadata"
                                controls 
                                style="width:100%; height:100%; max-height:400px; object-fit:contain; opacity:0;"
                            >
                                <source src="${cdnUrl}#t=0.001" type="video/mp4">
                            </video>
                        </div>`;
                } else {
                    const isFirst = (index === 0);
                    const isSecond = (index === 1);
                    const loadAttr = isFirst ? 'fetchpriority="high" loading="eager"' : (isSecond ? 'loading="eager"' : 'loading="lazy"');
                    const safeThumbBg = isFirst && currentThumb
                        ? (typeof window.escapeAttr === 'function' ? window.escapeAttr(currentThumb) : String(currentThumb).replace(/'/g, '%27').replace(/"/g, '%22'))
                            .replaceAll('(', '%28')
                            .replaceAll(')', '%29')
                        : '';
                    const slideBgStyle = safeThumbBg ? `background:#000 url('${safeThumbBg}') center/contain no-repeat;` : 'background:#000;';
                    slidesHtml += `
                        <a href="${cdnUrl}" data-pswp-width="1000" data-pswp-height="1000" target="_blank" class="slide" style="display:flex; align-items:center; justify-content:center; box-sizing:border-box; ${slideBgStyle}">
                            <img class="modal-slide-img" src="${cdnUrl}" ${loadAttr} decoding="async" style="width:100%; height:100%; object-fit:contain; opacity:${isFirst ? '1' : '0'}; transition:opacity 0.2s ease-in-out;">
                        </a>`;
                }

                thumbsHtml += `<div class="thumb" style="background-image:url('${currentThumb}'); position:relative;" data-action="set-slide" data-index="${index}">${isVideo ? '<span style="position:absolute; font-size:24px; color:#fff; text-shadow:0 0 5px #000; left:50%; top:50%; transform:translate(-50%, -50%);">▶</span>' : ''}</div>`;
            });

            wrapper.innerHTML = slidesHtml;
            wrapper.querySelectorAll('img.modal-slide-img').forEach(img => {
                if (img.complete && img.naturalWidth > 0 && img.style.opacity !== '1') {
                    img.style.opacity = '1';
                    if (img.parentElement) {
                        img.parentElement.setAttribute('data-pswp-width', img.naturalWidth);
                        img.parentElement.setAttribute('data-pswp-height', img.naturalHeight);
                        img.parentElement.classList.remove('skeleton');
                    }
                }
            });
            thumbs.innerHTML = thumbsHtml;
        } else {
            const noPhotoText = typeof i18next !== 'undefined' ? i18next.t('product.no_photo', { defaultValue: 'НЕТ ФОТО' }) : 'НЕТ ФОТО';
            wrapper.innerHTML = `<a class="slide" style="background:#111; pointer-events:none;">${noPhotoText}</a>`;
        }
    }

    setSlide(0, false);

    if (mediaList.length > 0) {
        mediaList.slice(0, 3).forEach((url, i) => {
            const cdnUrl = toCDN(url);
            if (typeof cdnUrl === 'string' && !cdnUrl.endsWith('.mp4')) {
                const preImg = new Image();
                preImg.decoding = 'async';
                preImg.fetchPriority = (i === 0) ? 'high' : 'auto';
                preImg.src = cdnUrl;
            }
        });
    }

    setTimeout(() => {
        const modalVideos = document.querySelectorAll('#sliderWrapper video.modal-video-player');
        modalVideos.forEach(vid => {
            const playPromise = vid.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    if (typeof window !== 'undefined' && window.__NISHA_DEBUG__) {
                        console.log('Ожидание клика (политика браузера)');
                    }
                });
            }
        });
    }, 100);

    if (typeof ensurePhotoSwipe === 'function') {
        ensurePhotoSwipe().catch(() => {});
    }

    if (wrapper && !wrapper._pswpClickBound) {
        wrapper._pswpClickBound = true;
        wrapper.addEventListener('click', (e) => {
            const slide = e.target.closest('a.slide');
            if (!slide || !wrapper.contains(slide)) return;
            if (e.target.closest('button, [data-action], video')) return;
            if (window._isSliderSwiping) return;

            e.preventDefault();
            e.stopPropagation();
            if (typeof openProductPhotoZoom === 'function') {
                openProductPhotoZoom(slide);
            }
        });
    }
}

/**
 * Opens fullscreen PhotoSwipe gallery at the specified slide or active index.
 * @param {number|HTMLElement} [targetSlideOrIndex]
 * @returns {Promise<void>}
 */
export async function openProductPhotoZoom(targetSlideOrIndex) {
    if (typeof ensurePhotoSwipe === 'function') {
        await ensurePhotoSwipe();
    }
    if (!window.PhotoSwipeLightbox) return;

    const wrapper = document.getElementById('sliderWrapper');
    if (!wrapper) return;

    const imageSlides = Array.from(wrapper.querySelectorAll('a.slide'));
    if (imageSlides.length === 0) return;

    let targetIndex = 0;
    if (typeof targetSlideOrIndex === 'number') {
        targetIndex = Math.max(0, Math.min(targetSlideOrIndex, imageSlides.length - 1));
    } else if (targetSlideOrIndex && typeof targetSlideOrIndex.closest === 'function') {
        const slideEl = targetSlideOrIndex.closest('a.slide');
        const foundIdx = imageSlides.indexOf(slideEl);
        if (foundIdx >= 0) targetIndex = foundIdx;
    } else {
        const allSlides = Array.from(wrapper.querySelectorAll('.slide'));
        const activeSlide = allSlides.at(getActiveSlideIndex() || 0);
        const foundIdx = imageSlides.indexOf(activeSlide);
        if (foundIdx >= 0) targetIndex = foundIdx;
    }

    const items = imageSlides.map(slide => {
        const img = slide.querySelector('img');
        const parsedW = Number.parseInt(slide.getAttribute('data-pswp-width') || (img && img.naturalWidth) || 0, 10);
        const parsedH = Number.parseInt(slide.getAttribute('data-pswp-height') || (img && img.naturalHeight) || 0, 10);
        const src = slide.href || slide.getAttribute('data-pswp-src') || (img && img.src);
        const msrc = (img && (img.currentSrc || img.src)) || src;
        return {
            src,
            msrc,
            width: parsedW > 0 ? parsedW : 1200,
            height: parsedH > 0 ? parsedH : 1200,
            element: slide
        };
    });

    imageSlides.forEach(s => s.classList.remove('zoomed-in'));

    if (window.pswpLightbox) {
        try { window.pswpLightbox.destroy(); } catch {}
        window.pswpLightbox = null;
    }

    const lightbox = new window.PhotoSwipeLightbox({
        dataSource: items,
        showHideAnimationType: 'fade',
        zoomAnimationDuration: 200,
        bgOpacity: 0.9,
        closeOnVerticalDrag: true,
        wheelToZoom: true,
        pswpModule: window.PhotoSwipe || (() => import('photoswipe'))
    });

    const syncSliderIndex = () => {
        const currPswpIndex = lightbox.pswp && lightbox.pswp.currIndex;
        if (typeof currPswpIndex === 'number' && items[currPswpIndex] && items[currPswpIndex].element) {
            const allSlides = Array.from(wrapper.querySelectorAll('.slide'));
            const fullSliderIdx = allSlides.indexOf(items[currPswpIndex].element);
            const activeSetSlide = (typeof window.setSlide === 'function') ? window.setSlide : setSlide;
            if (fullSliderIdx >= 0 && getActiveSlideIndex() !== fullSliderIdx) {
                activeSetSlide(fullSliderIdx);
            }
        }
    };

    lightbox.on('change', syncSliderIndex);
    lightbox.on('close', syncSliderIndex);

    window.pswpLightbox = lightbox;
    lightbox.init();
    lightbox.loadAndOpen(targetIndex);
}

/**
 * Binds horizontal touch-swipe gestures on `#sliderContainer`.
 */
export function initSliderSwipe() {
    const sliderContainer = document.getElementById('sliderContainer');
    if (!sliderContainer) return;
    if (sliderContainer._swipeBound) return;
    sliderContainer._swipeBound = true;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    sliderContainer.addEventListener('contextmenu', (e) => e.preventDefault());
    sliderContainer.addEventListener('dragstart', (e) => e.preventDefault());

    sliderContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchEndX = touchStartX;
        touchEndY = touchStartY;
        window._isSliderSwiping = false;
    }, { passive: true });

    sliderContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) return;
        touchEndX = e.touches[0].clientX;
        touchEndY = e.touches[0].clientY;
        const diffX = Math.abs(touchEndX - touchStartX);
        const diffY = Math.abs(touchEndY - touchStartY);

        if (diffX > 10) {
            window._isSliderSwiping = true;
        }

        if (diffX > 10 && diffX > diffY) {
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });

    sliderContainer.addEventListener('touchend', () => {
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;

        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
            const slides = document.querySelectorAll('.slide');
            const current = getActiveSlideIndex();
            if (slides.length > 1) {
                if (diffX > 0 && current < slides.length - 1) {
                    if (typeof triggerHaptic === 'function') triggerHaptic('light');
                    setSlide(current + 1);
                } else if (diffX < 0 && current > 0) {
                    if (typeof triggerHaptic === 'function') triggerHaptic('light');
                    setSlide(current - 1);
                }
            }
        }

        setTimeout(() => {
            window._isSliderSwiping = false;
        }, 120);
    }, { passive: true });
}

if (typeof window !== 'undefined') {
    window.preloadSlide = preloadSlide;
    window.moveSlide = moveSlide;
    window.setSlide = setSlide;
    window.updateSlider = updateSlider;
    window.openProductPhotoZoom = openProductPhotoZoom;
    window.initSliderSwipe = initSliderSwipe;
}
