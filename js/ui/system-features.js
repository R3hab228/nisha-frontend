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
    if (!localStorage.getItem('nisha_rules_accepted')) {
        setTimeout(() => {
            if (!localStorage.getItem('nisha_rules_accepted')) {
                showRulesModal();
            }
        }, 550);
    }
}
window.checkRules = checkRules;

function showRulesModal() { 
    const modal = document.getElementById('rulesModal');
    if (modal) {
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
window.showRulesModal = showRulesModal;

function acceptRules() {
    localStorage.setItem('nisha_rules_accepted', 'true');
    const modal = document.getElementById('rulesModal');
    if (modal) {
        if (modal.classList.contains('closing')) return;
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
            const win = modal.querySelector('.modal-window');
            if (win) {
                win.style.transform = '';
                win.style.opacity = '';
            }
            document.body.style.overflow = 'auto';
            if (typeof window.startLenis === 'function') window.startLenis(); 
        }, 400);
    } else {
        document.body.style.overflow = 'auto';
        if (typeof window.startLenis === 'function') window.startLenis(); 
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
            msgEl.innerHTML = "SYSTEM OVERRIDE<br>[ ACCESS GRANTED ]<br><span style='font-size: 20px; color:#fff; font-family: Tahoma;'>Секретная скидка -10% активирована</span>";
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
    localStorage.setItem('nisha_cart', JSON.stringify(activeCart));
    if (typeof syncCartToServer === 'function') syncCartToServer();
    if (typeof updateCartUI === 'function') updateCartUI();
}
window.triggerEasterEgg = triggerEasterEgg;

// === СЧЕТЧИК ПОСЕТИТЕЛЕЙ ===
async function initHitCounter() {
    const counterEl = document.getElementById('hitCounterValue');
    if (!counterEl) return;

    try {
        let visitorId = localStorage.getItem('nisha_visitor_id');
        if (!visitorId) {
            visitorId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('nisha_visitor_id', visitorId);
        }
        window.clientFingerprint = visitorId;
        if (typeof globalThis !== 'undefined') globalThis.clientFingerprint = visitorId;

        const todayDate = new Date().toLocaleDateString('en-CA');
        const lastVisitDate = localStorage.getItem('nisha_last_visit_date');

        const cachedCount = localStorage.getItem('nisha_last_hit_count') || '0';
        counterEl.innerText = String(cachedCount).padStart(5, '0').split('').join(' ');

        const isNewVisitToday = (lastVisitDate !== todayDate);

        const data = await window.apiClient.post('/api/hit', {
            date: todayDate,
            countAsNew: isNewVisitToday
        }, { timeout: 5500, retries: 1, dedupe: true });

        if (data && data.success && data.count !== undefined) {
            if (isNewVisitToday) {
                if (typeof safeSetItem === 'function') {
                    safeSetItem('nisha_last_visit_date', todayDate);
                } else {
                    localStorage.setItem('nisha_last_visit_date', todayDate);
                }
            }
            
            if (typeof safeSetItem === 'function') {
                safeSetItem('nisha_last_hit_count', data.count);
            } else {
                localStorage.setItem('nisha_last_hit_count', data.count);
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
