// ==========================================
// NISHA I18N & LANGUAGE MODULE (Локализация и печатная машинка поиска)
// ==========================================

let searchTypewriterInterval = null;
let currentSearchLang = 'ru';

function toggleLangDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('langDropdown');
    if (dropdown) dropdown.classList.toggle('show');
}
window.toggleLangDropdown = toggleLangDropdown;

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('langDropdown');
    if (dropdown && !e.target.closest('.lang-switcher-wrapper')) {
        dropdown.classList.remove('show');
    }
});

// Ленивая подгрузка языковых словарей (экономит 67% трафика)
async function ensureLanguageLoaded(lng) {
    if (typeof i18next === 'undefined') return;
    if (i18next.hasResourceBundle && i18next.hasResourceBundle(lng, 'translation')) return;
    
    // 1. Загрузка отдельного легкого файла (~14-21 КБ)
    try {
        const res = await fetch(`/locales/${lng}.json`);
        if (res.ok) {
            const data = await res.json();
            const translations = data.translation || data;
            i18next.addResourceBundle(lng, 'translation', translations, true, true);
            return;
        }
    } catch (e) {
        console.warn(`[i18n] Failed to fetch /locales/${lng}.json:`, e);
    }

    // 2. Fallback к единому locales.json, если отдельный файл недоступен
    try {
        const fallbackRes = await fetch('/locales.json');
        if (fallbackRes.ok) {
            const fullData = await fallbackRes.json();
            if (fullData[lng]) {
                const translations = fullData[lng].translation || fullData[lng];
                i18next.addResourceBundle(lng, 'translation', translations, true, true);
            }
        }
    } catch (fbErr) {
        console.error('[i18n] Fallback to /locales.json failed:', fbErr);
    }
}
window.ensureLanguageLoaded = ensureLanguageLoaded;

async function changeLanguage(lng) {
    if (typeof i18next !== 'undefined') {
        await ensureLanguageLoaded(lng);
        i18next.changeLanguage(lng).then(() => {
            // ЖЕЛЕЗОБЕТОННОЕ сохранение:
            localStorage.setItem('nisha_lang', lng); 
            // Сохраняем языковой флаг для плагина i18next
            localStorage.setItem('i18nextLng', lng); 
            document.documentElement.lang = (lng === 'ua' ? 'uk' : (lng || 'ru'));
            
            updateContentLanguage();
            
            // Мгновенно перерисовываем вообще ВСЕ цены и тексты на сайте
            if (typeof applyFilters === 'function') applyFilters(); 
            if (typeof renderCartItems === 'function') renderCartItems();
            if (typeof updateCartUI === 'function') updateCartUI();
            if (typeof renderHistory === 'function') renderHistory();
            if (typeof window.updateOrderTabCounters === 'function') window.updateOrderTabCounters();
            if (typeof window.renderFilteredOrders === 'function' && document.getElementById('ordersModal')?.style.display === 'flex') {
                window.renderFilteredOrders();
            }
            
            const msg = i18next.t('messages.lang_changed') + ' [' + lng.toUpperCase() + ']';
            if (typeof showToast === 'function') showToast(msg, 'success');

            // Если мобильное меню открыто/закрыто — переводим кнопку фильтров
            const sidebar = document.querySelector('.sidebar');
            const btn = document.getElementById('mobileFilterBtn');
            if (btn && sidebar) {
                if (sidebar.classList.contains('active-mobile')) {
                    btn.innerText = i18next.t('mobile.hide_filters', { defaultValue: '[-] СКРЫТЬ ФИЛЬТРЫ' });
                } else {
                    btn.innerText = i18next.t('mobile.show_filters', { defaultValue: '[+] ПОКАЗАТЬ ФИЛЬТРЫ' });
                }
            }
            
            const activeUser = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
            const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
            if (activeUser && sb) {
                sb.from('profiles').update({ language: lng }).eq('id', activeUser.id).then();
            }
        });
    }
}
window.changeLanguage = changeLanguage;

function updateContentLanguage() {
    // Переводим обычный текст и placeholder'ы с префиксом [placeholder]
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key.startsWith('[placeholder]')) {
            const rawKey = key.replace('[placeholder]', '');
            const trans = i18next.t(rawKey);
            if (trans && trans !== rawKey) el.placeholder = trans;
        } else {
            const trans = i18next.t(key);
            if (trans && trans !== key) {
                el.innerHTML = trans;
            }
        }
    });
    
    // Переводим Placeholder'ы инпутов
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        el.placeholder = i18next.t(key);
    });

    // Обновляем выбранный способ оплаты в чекауте (текст на языке интерфейса, значение в БД всегда на русском)
    const paymentSelectedText = document.getElementById('paymentSelectedText');
    const paymentMethodInput = document.getElementById('orderPaymentMethod');
    if (paymentSelectedText && paymentMethodInput) {
        const rawVal = String(paymentMethodInput.value || '').toLowerCase();
        if (rawVal.includes('200') || rawVal.includes('налож') || rawVal.includes('наклад') || rawVal.includes('delivery') || rawVal.includes('cod')) {
            paymentMethodInput.value = 'Наложка (предоплата 200грн)';
            paymentSelectedText.setAttribute('data-i18n', 'checkout.payment_cod');
            paymentSelectedText.innerText = i18next.t('checkout.payment_cod');
        } else {
            paymentMethodInput.value = 'Полная предоплата';
            paymentSelectedText.setAttribute('data-i18n', 'checkout.payment_full');
            paymentSelectedText.innerText = i18next.t('checkout.payment_full');
        }
    }

    // Запускаем печатную машинку поиска
    currentSearchLang = i18next.language || 'ru';
    startSearchTypewriter();

    // Немедленно восстанавливаем красные индикаторы количества товаров в фильтрах и счетчики заказов после перевода
    if (typeof updateSidebarCounters === 'function') {
        updateSidebarCounters();
    }
    if (typeof window.updateOrderTabCounters === 'function') {
        window.updateOrderTabCounters();
    }
}
window.updateContentLanguage = updateContentLanguage;

function startSearchTypewriter() {
    const searchInput = document.getElementById('mainSearch');
    if (!searchInput) return;

    if (searchTypewriterInterval) clearTimeout(searchTypewriterInterval);
    if (window.searchCursorBlinkInterval) clearInterval(window.searchCursorBlinkInterval);

    const translatedWords = {
        'ua': ['Пошук речей...'],
        'ru': ['Поиск вещи...'],
        'en': ['Search items...']
    };
    
    const words = translatedWords[currentSearchLang] || translatedWords['ru'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let showCursor = true;

    function typeLoop() {
        if (!document.getElementById('mainSearch')) return;
        
        if (document.activeElement === searchInput || searchInput.value.length > 0) {
            if (window.searchCursorBlinkInterval) {
                clearInterval(window.searchCursorBlinkInterval);
                window.searchCursorBlinkInterval = null;
            }
            searchInput.placeholder = words[wordIndex];
            searchTypewriterInterval = setTimeout(typeLoop, 500);
            return;
        }

        const currentWord = words[wordIndex];

        if (isDeleting) {
            charIndex--;
            searchInput.placeholder = currentWord.substring(0, charIndex) + '|';
            if (charIndex === 0) {
                isDeleting = false;
                wordIndex = (wordIndex + 1) % words.length;
                searchTypewriterInterval = setTimeout(typeLoop, 500);
                return;
            }
            searchTypewriterInterval = setTimeout(typeLoop, 50);
        } else {
            charIndex++;
            searchInput.placeholder = currentWord.substring(0, charIndex) + '|';
            
            if (charIndex === currentWord.length) {
                isDeleting = true;
                let blinkCount = 0;
                const maxBlinks = 4; // 4 * 0.6с = 2.4 секунды паузы перед удалением
                
                window.searchCursorBlinkInterval = setInterval(() => {
                    if (document.activeElement === searchInput || searchInput.value.length > 0) {
                        clearInterval(window.searchCursorBlinkInterval);
                        window.searchCursorBlinkInterval = null;
                        searchInput.placeholder = currentWord;
                        return;
                    }
                    showCursor = !showCursor;
                    searchInput.placeholder = currentWord + (showCursor ? '|' : '');
                    blinkCount++;
                    
                    if (blinkCount >= maxBlinks) {
                        clearInterval(window.searchCursorBlinkInterval);
                        window.searchCursorBlinkInterval = null;
                        showCursor = true;
                        searchTypewriterInterval = setTimeout(typeLoop, 50);
                    }
                }, 600);
                return;
            }
            searchTypewriterInterval = setTimeout(typeLoop, 100);
        }
    }

    typeLoop();
}
window.startSearchTypewriter = startSearchTypewriter;
