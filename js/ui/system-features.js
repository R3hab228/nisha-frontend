// ==========================================
// NISHA SYSTEM FEATURES (Broadcasts, Rules, Hit Counter, Easter Egg, Shortcuts)
// ==========================================

let pendingBroadcastQueue = null;

function tryShowBroadcast(title, htmlText, btnText, callback) {
    if (!htmlText || htmlText === 'null' || (typeof htmlText === 'string' && !htmlText.trim())) {
        if (callback) callback();
        return;
    }
    const inFeed = (typeof isUserInProductFeed === 'function') ? isUserInProductFeed() : (typeof window.isUserInProductFeed === 'function' ? window.isUserInProductFeed() : false);
    if (inFeed) {
        showTerminalModal(title, htmlText, btnText, callback);
        pendingBroadcastQueue = null;
    } else {
        pendingBroadcastQueue = { title, htmlText, btnText, callback };
    }
}
window.tryShowBroadcast = tryShowBroadcast;

function checkPendingBroadcast() {
    if (!pendingBroadcastQueue) return;
    setTimeout(() => {
        const inFeed = (typeof isUserInProductFeed === 'function') ? isUserInProductFeed() : (typeof window.isUserInProductFeed === 'function' ? window.isUserInProductFeed() : false);
        if (pendingBroadcastQueue && inFeed) {
            const { title, htmlText, btnText, callback } = pendingBroadcastQueue;
            pendingBroadcastQueue = null;
            if (htmlText && htmlText !== 'null' && (typeof htmlText !== 'string' || htmlText.trim())) {
                showTerminalModal(title, htmlText, btnText, callback);
            } else if (callback) {
                callback();
            }
        }
    }, 200);
}
window.checkPendingBroadcast = checkPendingBroadcast;

setInterval(() => {
    if (document.hidden) return;
    const inFeed = (typeof isUserInProductFeed === 'function') ? isUserInProductFeed() : (typeof window.isUserInProductFeed === 'function' ? window.isUserInProductFeed() : false);
    if (pendingBroadcastQueue && inFeed) {
        checkPendingBroadcast();
    }
}, 1500);

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pendingBroadcastQueue) {
        const inFeed = (typeof isUserInProductFeed === 'function') ? isUserInProductFeed() : (typeof window.isUserInProductFeed === 'function' ? window.isUserInProductFeed() : false);
        if (inFeed) checkPendingBroadcast();
    }
});

// === RULES MODAL ===
function checkRules() {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (!store || !store.get('nisha_rules_accepted')) {
        setTimeout(() => {
            const s = window.storage || (typeof storage !== 'undefined' ? storage : null);
            if (!s || !s.get('nisha_rules_accepted')) {
                showRulesModal();
            }
        }, 550);
    }
}
window.checkRules = checkRules;

function showRulesModal() { 
    if (typeof openModal === 'function') {
        openModal('rulesModal');
    } else {
        const modal = document.getElementById('rulesModal');
        if (modal) {
            modal.inert = false;
            modal.removeAttribute('inert');
            modal.setAttribute('aria-hidden', 'false');
            modal.classList.remove('closing');
            const win = modal.querySelector('.modal-window');
            if (win) {
                win.style.transform = '';
                win.style.opacity = '';
            }
            if (typeof window.stopLenis === 'function') window.stopLenis();
            document.body.style.overflow = 'hidden';
            modal.style.display = 'flex'; 
        }
    }
}
window.showRulesModal = showRulesModal;

function acceptRules() {
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (store) store.set('nisha_rules_accepted', 'true');
    if (typeof executeCloseModal === 'function') {
        executeCloseModal('rulesModal');
    } else {
        const modal = document.getElementById('rulesModal');
        if (modal) {
            if (modal.classList.contains('closing')) return;
            modal.classList.add('closing');
            modal.setAttribute('aria-hidden', 'true');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.classList.remove('closing');
                modal.inert = true;
                modal.setAttribute('inert', '');
                const win = modal.querySelector('.modal-window');
                if (win) {
                    win.style.transform = '';
                    win.style.opacity = '';
                }
                document.body.style.overflow = 'auto';
                if (typeof window.startLenis === 'function') window.startLenis(); 
            }, 300);
        } else {
            document.body.style.overflow = 'auto';
            if (typeof window.startLenis === 'function') window.startLenis(); 
        }
    }
    if (typeof showToast === 'function' && typeof i18next !== 'undefined') {
        showToast(i18next.t('messages.rules_accepted'), 'success');
    }
    
    setTimeout(() => {
        if (typeof startOnboardingTour === 'function') startOnboardingTour();
    }, 450); 
}
window.acceptRules = acceptRules;

// === EASTER EGG ===
function triggerEasterEgg() {
    window.isHacked = true;
    const overlay = document.getElementById('glitchOverlay');
    
    if (overlay) {
        const msgEl = document.getElementById('glitchMessage');
        if (msgEl) {
            const secretMsg = typeof i18next !== 'undefined' ? i18next.t('messages.secret_discount_applied', { defaultValue: 'Секретная скидка -10% активирована' }) : 'Секретная скидка -10% активирована';
            msgEl.innerHTML = `SYSTEM OVERRIDE<br>[ ACCESS GRANTED ]<br><span style='font-size: 20px; color:#fff; font-family: Tahoma;'>${secretMsg}</span>`;
        }
        overlay.style.display = 'flex';
        setTimeout(() => { 
            overlay.style.display = 'none'; 
        }, 2500);
    }
    
    if (typeof applyFilters === 'function') applyFilters(); 
    
    const activeCart = (typeof cart !== 'undefined' && Array.isArray(cart)) ? cart : (window.cart || []);
    activeCart.forEach(item => { 
        item.price = Math.floor(item.price * 0.9); 
    });
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (store) store.setJSON('nisha_cart', activeCart);
    if (typeof syncCartToServer === 'function') syncCartToServer();
    if (typeof updateCartUI === 'function') updateCartUI();
}
window.triggerEasterEgg = triggerEasterEgg;

// === ПРИВАТНАЯ АНАЛИТИКА (PLAUSIBLE / POSTHOG) И ВИЗУАЛЬНЫЙ РЕТРО-СЧЕТЧИК WIN95 ===
async function initHitCounter() {
    if (window.analytics && typeof window.analytics.init === 'function') {
        window.analytics.init();
    }

    const counterEl = document.getElementById('hitCounterValue');

    try {
        const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
        let visitorId = store ? store.get('nisha_visitor_id') : null;
        if (!visitorId) {
            visitorId = 'user_' + (typeof window.generateShortId === 'function' ? window.generateShortId(9) : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().replaceAll('-', '').slice(0, 9) : Date.now().toString(36)));
            if (store) store.set('nisha_visitor_id', visitorId);
        }
        window.clientFingerprint = visitorId;
        if (typeof globalThis !== 'undefined') globalThis.clientFingerprint = visitorId;

        const todayDate = new Date().toISOString().slice(0, 10);
        const lastVisitDate = store ? store.get('nisha_last_visit_date') : null;
        const isNewVisitToday = (lastVisitDate !== todayDate);

        if (isNewVisitToday && window.analytics && typeof window.analytics.track === 'function') {
            window.analytics.track('Daily Unique Visit', { date: todayDate });
        }

        if (!counterEl) return;

        const cachedCount = (store ? store.get('nisha_last_hit_count', '0') : '0') || '0';
        counterEl.innerText = String(cachedCount).padStart(5, '0').split('').join(' ');

        const data = await window.apiClient.post('/api/hit', {
            date: todayDate,
            countAsNew: isNewVisitToday
        }, { timeout: 5500, retries: 1, dedupe: true });

        if (data && data.success && data.count !== undefined) {
            if (isNewVisitToday && store) {
                store.set('nisha_last_visit_date', todayDate);
            }
            
            if (store) {
                store.set('nisha_last_hit_count', data.count);
            }
            
            const strCount = data.count.toString().padStart(5, '0');
            counterEl.innerText = strCount.split('').join(' ');
        }
    } catch (err) {
        console.warn("Счетчик работает в оффлайн-режиме (Сервер спит или нет сети):", err.message);
    }
}
window.initHitCounter = initHitCounter;

// === ЖИВОЙ СЧЕТЧИК СИМВОЛОВ ДЛЯ ПРЕДЛОЖКИ ===
function updateCharCount(textarea) {
    const label = document.getElementById('descLabel');
    if (!label) return;
    
    const remaining = 250 - textarea.value.length;
    const originalText = (typeof i18next !== 'undefined' && typeof i18next.t === 'function')
        ? i18next.t('propose.desc_label', { defaultValue: 'ОПИСАНИЕ И ДЕФЕКТЫ (ДО 250 СИМВОЛОВ):' })
        : 'ОПИСАНИЕ И ДЕФЕКТЫ (ДО 250 СИМВОЛОВ):';
    
    label.innerText = originalText.replace('250', remaining);
    label.style.color = remaining <= 0 ? 'var(--accent-red)' : 'var(--accent-green)';
}
window.updateCharCount = updateCharCount;

// === ГОРЯЧИЕ КЛАВИШИ И НАВИГАЦИЯ С КЛАВИАТУРЫ ===
document.addEventListener('keydown', function(e) {
    const isCtrlK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
    const isSlash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey;

    if (isCtrlK || isSlash) {
        const activeEl = document.activeElement;
        const tag = activeEl ? activeEl.tagName : '';
        const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (activeEl && activeEl.isContentEditable);

        if (!(isSlash && isEditing)) {
            const hasOpenModal = document.querySelector('.modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
            if (!hasOpenModal || isCtrlK) {
                const searchInput = document.getElementById('mainSearch');
                if (searchInput && activeEl !== searchInput) {
                    e.preventDefault();
                    if (hasOpenModal && typeof closeModal === 'function') {
                        if (hasOpenModal.id === 'productModal') closeModal('productModal');
                    }
                    searchInput.focus();
                    searchInput.select();
                    const rect = searchInput.getBoundingClientRect();
                    if (rect.top < 0 || rect.bottom > window.innerHeight) {
                        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
        }
    }

    if (e.key === 'Enter') {
        const activeEl = document.activeElement;
        if (!activeEl || activeEl.tagName === 'TEXTAREA') return;

        if (activeEl.tagName === 'INPUT') {
            e.preventDefault();
            const form = activeEl.closest('.form-layout') || activeEl.closest('.auth-fields');
            if (form) {
                const focusables = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([style*="display: none"]):not([disabled]), textarea, button:not([style*="display: none"]):not([disabled])'));
                const currentIndex = focusables.indexOf(activeEl);
                if (currentIndex > -1 && currentIndex < focusables.length - 1) {
                    focusables[currentIndex + 1].focus();
                }
            }
        }
    }

    const pModal = document.getElementById('productModal');
    if (pModal && (pModal.style.display === 'flex' || pModal.style.display === 'block')) {
        if (e.key === 'ArrowLeft') {
            if (typeof moveSlide === 'function') moveSlide(-1);
        } else if (e.key === 'ArrowRight') {
            if (typeof moveSlide === 'function') moveSlide(1);
        }
    }
});
