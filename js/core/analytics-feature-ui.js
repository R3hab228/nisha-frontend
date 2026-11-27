// @ts-check
// ==========================================
// NISHA CORE — FEATURE FLAGS DOM & RETENTION UI
// Управляет UI-флагами PostHog: DROP_LOCK, рубильниками чекаута,
// Win95-полоской бесплатной доставки и промо-баннером.
// ==========================================

/**
 * @typedef {Object} FeatureFlagReader
 * @property {(flagKey: string, defaultValue?: boolean) => boolean} isFeatureEnabled
 * @property {(flagKey: string, defaultValue?: any) => any} getFeatureFlagPayload
 */

/**
 * Создаёт контроллер DOM-эффектов для встроенных фича-флагов PostHog.
 * @param {FeatureFlagReader} reader
 */
export function createAnalyticsFeatureUi({ isFeatureEnabled, getFeatureFlagPayload }) {
    /** @type {ReturnType<typeof setInterval> | null} */
    let _dropLockTimerId = null;

    function getCurrentFlagLang() {
        const raw = (typeof window !== 'undefined' && window.i18next && window.i18next.language)
            ? String(window.i18next.language).toLowerCase().slice(0, 2)
            : 'ua';
        if (raw === 'ru') return 'ru';
        if (raw === 'en') return 'en';
        return 'ua';
    }

    /**
     * @param {any} payload
     * @param {string} baseKey
     * @param {Record<string, string>} fallbacks
     */
    function pickLocalizedText(payload, baseKey, fallbacks) {
        const lang = getCurrentFlagLang();
        if (payload && typeof payload === 'object') {
            const direct = payload[`${baseKey}_${lang}`] || payload[lang] || payload[baseKey] || payload[`${baseKey}_ua`] || payload[`${baseKey}_ru`] || payload[`${baseKey}_en`];
            if (typeof direct === 'string' && direct.trim()) return direct.trim();
        }
        return (fallbacks && (fallbacks[lang] || fallbacks.ua)) || '';
    }

    function removeDropCountdownOverlay() {
        if (_dropLockTimerId) {
            clearInterval(_dropLockTimerId);
            _dropLockTimerId = null;
        }
        if (typeof document !== 'undefined') {
            const existing = document.getElementById('nishaDropCountdownOverlay');
            if (existing) existing.remove();
            if (document.body && document.body.dataset && document.body.dataset.dropLockScroll === '1') {
                delete document.body.dataset.dropLockScroll;
                document.body.style.overflow = '';
            }
        }
    }

    function applyDropCountdownLock() {
        if (typeof document === 'undefined' || !document.body) return;
        const enabled = isFeatureEnabled('drop_countdown_lock', false);
        if (!enabled) {
            removeDropCountdownOverlay();
            return;
        }

        const payload = getFeatureFlagPayload('drop_countdown_lock', null);
        const unlockRaw = payload && typeof payload === 'object' ? (payload.unlock_at || payload.unlockAt || '') : '';
        const unlockMs = unlockRaw ? Date.parse(String(unlockRaw)) : NaN;
        if (Number.isFinite(unlockMs) && unlockMs <= Date.now()) {
            removeDropCountdownOverlay();
            return;
        }

        const lang = getCurrentFlagLang();
        const title = pickLocalizedText(payload, 'title', {
            ua: 'ГОТУЄМО НОВИЙ ДРОП',
            ru: 'ГОТОВИМ НОВЫЙ ДРОП',
            en: 'PREPARING NEW DROP'
        });
        const subtitle = pickLocalizedText(payload, 'subtitle', {
            ua: 'Магазин відкриється автоматично за таймером. Слідкуй за анонсами в Telegram.',
            ru: 'Магазин откроется автоматически по таймеру. Следи за анонсами в Telegram.',
            en: 'Store unlocks automatically when the countdown ends.'
        });
        const labels = lang === 'en'
            ? ['DAYS', 'HRS', 'MIN', 'SEC']
            : (lang === 'ru' ? ['ДНИ', 'ЧАС', 'МИН', 'СЕК'] : ['ДНІ', 'ГОД', 'ХВ', 'СЕК']);
        const rawTgUrl = (payload && typeof payload === 'object' && typeof payload.tg_url === 'string') ? payload.tg_url.trim() : '';
        const safeTgUrl = /^https:\/\/t\.me\/[a-zA-Z0-9_/-]+$/i.test(rawTgUrl) ? rawTgUrl : '';

        let overlay = document.getElementById('nishaDropCountdownOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'nishaDropCountdownOverlay';
            overlay.className = 'nisha-drop-lock-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            document.body.appendChild(overlay);
        }

        const win = document.createElement('div');
        win.className = 'nisha-drop-lock-window';

        const hdr = document.createElement('div');
        hdr.className = 'modal-header';
        const hdrTitle = document.createElement('span');
        hdrTitle.className = 'modal-title';
        hdrTitle.textContent = 'DROP_LOCK.EXE';
        hdr.appendChild(hdrTitle);

        const body = document.createElement('div');
        body.className = 'nisha-drop-lock-body';

        const h2 = document.createElement('h2');
        h2.className = 'nisha-drop-lock-title';
        h2.textContent = title;
        body.appendChild(h2);

        const p = document.createElement('p');
        p.className = 'nisha-drop-lock-sub';
        p.textContent = subtitle;
        body.appendChild(p);

        /** @type {HTMLSpanElement[]} */
        const numEls = [];
        if (Number.isFinite(unlockMs)) {
            const timerGrid = document.createElement('div');
            timerGrid.className = 'nisha-drop-lock-timer';
            labels.forEach((lbl) => {
                const cell = document.createElement('div');
                cell.className = 'nisha-drop-lock-cell';
                const num = document.createElement('span');
                num.className = 'nisha-drop-lock-num';
                num.textContent = '00';
                const cap = document.createElement('span');
                cap.className = 'nisha-drop-lock-lbl';
                cap.textContent = lbl;
                cell.appendChild(num);
                cell.appendChild(cap);
                timerGrid.appendChild(cell);
                numEls.push(num);
            });
            body.appendChild(timerGrid);
        }

        if (safeTgUrl) {
            const link = document.createElement('a');
            link.className = 'nisha-drop-lock-link';
            link.href = safeTgUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = '[ TELEGRAM ]';
            body.appendChild(link);
        }

        win.appendChild(hdr);
        win.appendChild(body);
        if (typeof overlay.replaceChildren === 'function') overlay.replaceChildren(win);
        else { overlay.innerHTML = ''; overlay.appendChild(win); }

        if (document.body.style) {
            document.body.dataset.dropLockScroll = '1';
            document.body.style.overflow = 'hidden';
        }

        if (_dropLockTimerId) {
            clearInterval(_dropLockTimerId);
            _dropLockTimerId = null;
        }
        if (Number.isFinite(unlockMs) && numEls.length === 4) {
            const tick = () => {
                const diff = unlockMs - Date.now();
                if (diff <= 0) {
                    removeDropCountdownOverlay();
                    return;
                }
                const totalSec = Math.floor(diff / 1000);
                const d = Math.floor(totalSec / 86400);
                const h = Math.floor((totalSec % 86400) / 3600);
                const m = Math.floor((totalSec % 3600) / 60);
                const s = totalSec % 60;
                numEls[0].textContent = String(d).padStart(2, '0');
                numEls[1].textContent = String(h).padStart(2, '0');
                numEls[2].textContent = String(m).padStart(2, '0');
                numEls[3].textContent = String(s).padStart(2, '0');
            };
            tick();
            _dropLockTimerId = setInterval(tick, 1000);
        }
    }

    function applyCheckoutFeatureFlags() {
        if (typeof document === 'undefined') return;
        // 3. Рубильник наложенного платежа (default: enabled)
        const codEnabled = isFeatureEnabled('enable_cod_payment', true);
        const codOptions = document.querySelectorAll('#paymentDropdown .payment-dropdown-option[data-i18n="checkout.payment_cod"], #paymentDropdown [data-payment-method*="200"]');
        codOptions.forEach((rawOpt) => {
            const opt = /** @type {HTMLElement} */ (rawOpt);
            if (opt && opt.style) opt.style.display = codEnabled ? '' : 'none';
        });
        if (!codEnabled) {
            const pmInput = /** @type {HTMLInputElement | null} */ (document.getElementById('orderPaymentMethod'));
            const pmText = document.getElementById('paymentSelectedText');
            const curVal = pmInput ? String(pmInput.value || '').toLowerCase() : '';
            if (curVal.includes('200') || curVal.includes('налож') || curVal.includes('наклад') || curVal.includes('cod')) {
                if (pmInput) pmInput.value = 'Полная предоплата';
                if (pmText) {
                    pmText.setAttribute('data-i18n', 'checkout.payment_full');
                    pmText.textContent = (typeof window !== 'undefined' && window.i18next && typeof window.i18next.t === 'function')
                        ? window.i18next.t('checkout.payment_full', { defaultValue: 'Полная предоплата' })
                        : 'Полная предоплата';
                }
            }
        }

        // 4. Рубильник поля промокодов в чекауте (default: enabled)
        const promoCodesEnabled = isFeatureEnabled('enable_promo_codes', true);
        const promoLabel = /** @type {HTMLElement | null} */ (document.querySelector('#checkoutModal label[data-i18n="checkout.promo"]'));
        const promoWrap = /** @type {HTMLElement | null} */ (document.querySelector('#checkoutModal .promo-wrapper'));
        const promoMsg = document.getElementById('promoMessage');
        if (promoLabel && promoLabel.style) promoLabel.style.display = promoCodesEnabled ? '' : 'none';
        if (promoWrap && promoWrap.style) promoWrap.style.display = promoCodesEnabled ? '' : 'none';
        if (promoMsg && promoMsg.style) promoMsg.style.display = promoCodesEnabled ? '' : 'none';
    }

    /**
     * Обновляет Win95-полоску прогресса бесплатной доставки в корзине и чекауте по флагу free_shipping_promo.
     * @param {number} [cartTotalUah]
     */
    function syncFreeShippingUI(cartTotalUah) {
        if (typeof document === 'undefined') return;
        const enabled = isFeatureEnabled('free_shipping_promo', false);
        const removeBars = () => {
            ['cartFreeShippingBar', 'checkoutFreeShippingBar'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.remove();
            });
        };

        if (!enabled) {
            removeBars();
            return;
        }

        const payload = getFeatureFlagPayload('free_shipping_promo', null);
        const rawMin = payload && typeof payload === 'object' ? Number(payload.min_uah ?? payload.min ?? 3000) : 3000;
        const minUah = (Number.isFinite(rawMin) && rawMin > 0) ? Math.round(rawMin) : 3000;

        let total = Number(cartTotalUah);
        if (!Number.isFinite(total)) {
            const activeCart = (typeof window !== 'undefined' && typeof window.getActiveCart === 'function')
                ? window.getActiveCart()
                : ((typeof window !== 'undefined' && Array.isArray(window.cart)) ? window.cart : []);
            total = Array.isArray(activeCart)
                ? activeCart.reduce((sum, item) => sum + (Number(item && item.price) || 0), 0)
                : 0;
        }

        if (total <= 0) {
            removeBars();
            return;
        }

        const remaining = Math.max(0, Math.round(minUah - total));
        const pct = Math.min(100, Math.max(0, Math.round((total / minUah) * 100)));
        const lang = getCurrentFlagLang();
        const curr = lang === 'en' ? 'UAH' : 'грн';
        const remainingFormatted = (typeof window !== 'undefined' && typeof window.formatPrice === 'function')
            ? window.formatPrice(remaining)
            : `${remaining} ${curr}`;
        const isUnlocked = remaining <= 0;
        const labelText = isUnlocked
            ? (lang === 'en' ? '✓ FREE SHIPPING UNLOCKED!' : (lang === 'ru' ? '✓ БЕСПЛАТНАЯ ДОСТАВКА АКТИВИРОВАНА!' : '✓ БЕЗКОШТОВНА ДОСТАВКА АКТИВОВАНА!'))
            : (lang === 'en'
                ? `ADD ${remainingFormatted} FOR FREE SHIPPING`
                : (lang === 'ru'
                    ? `ДО БЕСПЛАТНОЙ ДОСТАВКИ: +${remainingFormatted}`
                    : `ДО БЕЗКОШТОВНОЇ ДОСТАВКИ: +${remainingFormatted}`));

        /**
         * @param {string} barId
         * @param {Node | null} parentEl
         * @param {Node | null} anchorEl
         * @param {string} [extraClass='']
         */
        const renderBar = (barId, parentEl, anchorEl, extraClass = '') => {
            if (!parentEl) return;
            let bar = document.getElementById(barId);
            if (!bar) {
                bar = document.createElement('div');
                bar.id = barId;
                bar.className = `nisha-free-ship-bar${extraClass ? ' ' + extraClass : ''}`;
                const txt = document.createElement('div');
                txt.className = 'nisha-free-ship-text';
                const track = document.createElement('div');
                track.className = 'nisha-free-ship-track';
                const fill = document.createElement('div');
                fill.className = 'nisha-free-ship-fill';
                track.appendChild(fill);
                bar.appendChild(txt);
                bar.appendChild(track);
                if (anchorEl && anchorEl.parentNode === parentEl) {
                    parentEl.insertBefore(bar, anchorEl);
                } else {
                    parentEl.appendChild(bar);
                }
            }
            bar.classList.toggle('is-unlocked', isUnlocked);
            const txtEl = bar.querySelector('.nisha-free-ship-text');
            if (txtEl) txtEl.textContent = labelText;
            const fillEl = /** @type {HTMLElement | null} */ (bar.querySelector('.nisha-free-ship-fill'));
            if (fillEl) fillEl.style.width = `${pct}%`;
        };

        const cartDropdown = document.getElementById('cartDropdown');
        const cartList = document.getElementById('cartDropdownList');
        if (cartDropdown && cartList) {
            renderBar('cartFreeShippingBar', cartDropdown, cartList);
        }
        const deliveryInfo = document.getElementById('deliveryCostInfo');
        if (deliveryInfo && deliveryInfo.parentNode) {
            renderBar('checkoutFreeShippingBar', deliveryInfo.parentNode, deliveryInfo, 'nisha-free-ship-bar--checkout');
        }
    }

    function applyBuiltinFeatureFlags() {
        if (typeof document === 'undefined') return;
        try {
            // 1. Рубильник предложки DROP_ITEM.EXE (default: enabled)
            const dropEnabled = isFeatureEnabled('enable_drop_propose', true);
            document.querySelectorAll('[data-action="open-propose-modal"]').forEach((rawEl) => {
                const el = /** @type {HTMLElement} */ (rawEl);
                if (el && el.style) el.style.display = dropEnabled ? '' : 'none';
            });

            // 2. Режим ожидания дропа с обратным отсчётом (default: disabled)
            applyDropCountdownLock();

            // 3 & 4. Рубильники наложенного платежа и промокодов в чекауте
            applyCheckoutFeatureFlags();

            // 5. Прогресс-бар бесплатной доставки в корзине и чекауте
            syncFreeShippingUI();

            // 6. Динамический промо-баннер из PostHog JSON payload (default: disabled)
            const promoEnabled = isFeatureEnabled('promo_banner', false);
            const existingBanner = document.getElementById('nishaFeaturePromoBanner');
            if (!promoEnabled) {
                if (existingBanner) existingBanner.remove();
                return;
            }

            const payload = getFeatureFlagPayload('promo_banner', null);
            const text = (payload && typeof payload === 'object')
                ? pickLocalizedText(payload, 'text', {})
                : (typeof payload === 'string' ? payload.trim() : '');
            if (!text) {
                if (existingBanner) existingBanner.remove();
                return;
            }

            let banner = existingBanner;
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'nishaFeaturePromoBanner';
                banner.className = 'nisha-ff-promo-banner';
                banner.setAttribute('role', 'status');
                const host = document.querySelector('header') || document.body;
                if (host && host.parentNode && host.tagName === 'HEADER') {
                    host.parentNode.insertBefore(banner, host.nextSibling);
                } else if (document.body) {
                    document.body.prepend(banner);
                }
            }
            banner.textContent = text;
        } catch {}
    }

    return {
        syncFreeShippingUI,
        applyBuiltinFeatureFlags,
        applyDropCountdownLock,
        removeDropCountdownOverlay,
        applyCheckoutFeatureFlags
    };
}

if (typeof window !== 'undefined') {
    /** @type {any} */ (window).__nishaAnalyticsFeatureUiFactory = createAnalyticsFeatureUi;
}
