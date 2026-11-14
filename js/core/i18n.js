// ==========================================
// NISHA I18N & LANGUAGE MODULE (Локализация и печатная машинка поиска)
// ==========================================

import { emitAppEvent, invokeAction, registerActions } from './action-registry.js';
import { getSupabase } from './helpers-security-media.js';
import { storage } from './helpers-storage-idb.js';
import { showLanguageToast } from './helpers-toasts-modals.js';

const NISHA_FLAGS = {
    ua: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 18'%3E%3Crect width='24' height='9' fill='%230057B7'/%3E%3Crect y='9' width='24' height='9' fill='%23FFD700'/%3E%3C/svg%3E",
    ru: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 18'%3E%3Crect width='24' height='6' fill='%23FFFFFF'/%3E%3Crect y='6' width='24' height='6' fill='%230039A6'/%3E%3Crect y='12' width='24' height='6' fill='%23D52B1E'/%3E%3C/svg%3E",
    en: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 18'%3E%3CclipPath id='s'%3E%3Cpath d='M0,0 v18 h24 v-18 z'/%3E%3C/clipPath%3E%3Cpath d='M0,0 L24,18 M24,0 L0,18' stroke='%23fff' stroke-width='3' clip-path='url(%23s)'/%3E%3Cpath d='M0,0 L24,18 M24,0 L0,18' stroke='%23C8102E' stroke-width='1.5' clip-path='url(%23s)'/%3E%3Cpath d='M12,0 v18 M0,9 h24' stroke='%23fff' stroke-width='5'/%3E%3Cpath d='M12,0 v18 M0,9 h24' stroke='%23C8102E' stroke-width='3'/%3E%3C/svg%3E"
};

const NISHA_EMOJI_FLAGS = {
    ua: '🇺🇦',
    ru: '🇷🇺',
    en: '🇬🇧'
};

function normalizeSiteLang(lang) {
    if (!lang || typeof lang !== 'string') return 'ua';
    const clean = lang.trim().toLowerCase().substring(0, 2);
    if (clean === 'ru') return 'ru';
    if (clean === 'en') return 'en';
    return 'ua';
}

function getFlagUrlByLang(lang) {
    const code = normalizeSiteLang(lang);
    return NISHA_FLAGS[code] || NISHA_FLAGS.ua;
}

function detectInitialSiteLang() {
    let saved = storage && typeof storage.get === 'function' ? storage.get('nisha_lang') : null;
    if (!saved && typeof localStorage !== 'undefined') {
        try { saved = localStorage.getItem('nisha_lang'); } catch {}
    }
    if (saved) return normalizeSiteLang(saved);

    let i18nSaved = store && typeof store.get === 'function' ? store.get('i18nextLng') : null;
    if (!i18nSaved && typeof localStorage !== 'undefined') {
        try { i18nSaved = localStorage.getItem('i18nextLng'); } catch {}
    }
    if (i18nSaved) return normalizeSiteLang(i18nSaved);

    if (typeof navigator !== 'undefined') {
        const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
        if (nav.startsWith('ru')) return 'ru';
        if (nav.startsWith('en')) return 'en';
        if (nav.startsWith('uk')) return 'ua';
    }
    return 'ua';
}

function updateFooterLanguageUI(lang) {
    const code = normalizeSiteLang(lang);
    const upper = code.toUpperCase();
    const flagUrl = getFlagUrlByLang(code);

    if (typeof document === 'undefined') return;

    const flagImg = document.getElementById('currentFlagImg');
    if (flagImg) {
        flagImg.src = flagUrl;
        flagImg.alt = upper;
    }

    const labelFooter = document.getElementById('currentLangLabelFooter');
    if (labelFooter) {
        const span = labelFooter.querySelector('span');
        if (span) {
            span.textContent = `[${upper}] ▼`;
        }
    }

    const menuLinks = document.querySelectorAll('.footer-lang-menu a[data-lang]');
    menuLinks.forEach(link => {
        const itemLang = normalizeSiteLang(link.getAttribute('data-lang'));
        if (itemLang === code) {
            link.classList.add('active');
            link.setAttribute('aria-selected', 'true');
        } else {
            link.classList.remove('active');
            link.setAttribute('aria-selected', 'false');
        }
    });

    if (document.documentElement) {
        document.documentElement.lang = (code === 'ua' ? 'uk' : code);
    }
}

function setLang(lang) {
    const code = normalizeSiteLang(lang);
    const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
    if (store && typeof store.set === 'function') {
        store.set('nisha_lang', code);
        store.set('i18nextLng', code);
        const emoji = code === 'ru' ? '🇷🇺' : (code === 'en' ? '🇬🇧' : '🇺🇦');
        store.set('nisha_flag', emoji);
    } else if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem('nisha_lang', code);
            localStorage.setItem('i18nextLng', code);
        } catch {}
    }
    updateFooterLanguageUI(code);
    if (typeof changeLanguage === 'function') {
        changeLanguage(code);
    }
    if (typeof document !== 'undefined') {
        const wrapper = document.getElementById('footerLangWrapper');
        if (wrapper) wrapper.classList.remove('active');
    }
}

window.NISHA_FLAGS = NISHA_FLAGS;
window.NISHA_EMOJI_FLAGS = NISHA_EMOJI_FLAGS;
window.normalizeSiteLang = normalizeSiteLang;
window.getFlagUrlByLang = getFlagUrlByLang;
window.detectInitialSiteLang = detectInitialSiteLang;
window.updateFooterLanguageUI = updateFooterLanguageUI;
window.setLang = setLang;

if (typeof document !== 'undefined') {
    const syncInitialLangUI = () => {
        updateFooterLanguageUI(detectInitialSiteLang());
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncInitialLangUI);
    } else {
        syncInitialLangUI();
    }
}

if (typeof i18next !== 'undefined' && typeof i18next.on === 'function') {
    i18next.on('languageChanged', (lng) => {
        const norm = normalizeSiteLang(lng);
        updateFooterLanguageUI(norm);
    });
}

let searchTypewriterInterval = null;
let currentSearchLang = 'ua';

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
            if (fullData && Object.hasOwn(fullData, lng)) {
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
    const normalized = normalizeSiteLang(lng);
    if (typeof i18next !== 'undefined') {
        await ensureLanguageLoaded(normalized);
        i18next.changeLanguage(normalized).then(() => {
            // ЖЕЛЕЗОБЕТОННОЕ сохранение через единый storage:
            const store = window.storage || (typeof storage !== 'undefined' ? storage : null);
            if (store) {
                store.set('nisha_lang', normalized); 
                store.set('i18nextLng', normalized); 
                const emoji = normalized === 'ru' ? '🇷🇺' : (normalized === 'en' ? '🇬🇧' : '🇺🇦');
                store.set('nisha_flag', emoji);
            } 
            document.documentElement.lang = (normalized === 'ua' ? 'uk' : normalized);
            
            updateContentLanguage();
            updateFooterLanguageUI(normalized);
            
            // Мгновенно перерисовываем вообще ВСЕ цены и тексты на сайте
            invokeAction('applyFilters');
            invokeAction('renderCartItems');
            invokeAction('updateCartUI');
            invokeAction('renderHistory');
            invokeAction('updateOrderTabCounters');
            if (document.getElementById('ordersModal')?.style.display === 'flex') {
                invokeAction('renderFilteredOrders');
            }
            emitAppEvent('nisha:language-changed', { lang: normalized });

            showLanguageToast(normalized);

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
            const sb = getSupabase();
            if (activeUser && sb) {
                sb.from('profiles').update({ language: normalized }).eq('id', activeUser.id).then();
            }
        });
    }
}
window.changeLanguage = changeLanguage;

function updateContentLanguage() {
    const activeLang = normalizeSiteLang((typeof i18next !== 'undefined' && i18next.language) || 'ua');
    updateFooterLanguageUI(activeLang);

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
        if (key && typeof i18next !== 'undefined') {
            const trans = i18next.t(key);
            if (trans && trans !== key) {
                el.placeholder = trans;
            }
        }
    });

    // Переводим всплывающие подсказки title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key && typeof i18next !== 'undefined') {
            const trans = i18next.t(key);
            if (trans && trans !== key) {
                el.title = trans;
            }
        }
    });

    // Переводим aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (key && typeof i18next !== 'undefined') {
            const trans = i18next.t(key);
            if (trans && trans !== key) {
                el.setAttribute('aria-label', trans);
            }
        }
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
    currentSearchLang = normalizeSiteLang(i18next.language || 'ua');
    startSearchTypewriter();

    // Немедленно восстанавливаем красные индикаторы количества товаров в фильтрах и счетчики заказов после перевода
    invokeAction('updateSidebarCounters');
    invokeAction('updateOrderTabCounters');
    // Обновляем текст статусов в карточках заказов при переключении языка
    document.querySelectorAll('.order-status[data-raw-status]').forEach(el => {
        const raw = el.getAttribute('data-raw-status');
        if (raw) {
            const translated = invokeAction('formatOrderStatus', raw);
            if (translated) el.textContent = translated;
        }
    });
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
    
    const words = Object.hasOwn(translatedWords, currentSearchLang) ? translatedWords[currentSearchLang] : translatedWords['ua'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let showCursor = true;

    function stopCursorBlink() {
        if (window.searchCursorBlinkInterval) {
            clearInterval(window.searchCursorBlinkInterval);
            window.searchCursorBlinkInterval = null;
        }
    }

    function typeLoop() {
        if (!document.getElementById('mainSearch')) return;
        if (document.hidden) {
            stopCursorBlink();
            searchTypewriterInterval = null;
            return;
        }
        
        if (document.activeElement === searchInput || searchInput.value.length > 0) {
            stopCursorBlink();
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
                    if (document.hidden || document.activeElement === searchInput || searchInput.value.length > 0) {
                        stopCursorBlink();
                        if (!document.hidden) searchInput.placeholder = currentWord;
                        else searchTypewriterInterval = null;
                        return;
                    }
                    showCursor = !showCursor;
                    searchInput.placeholder = currentWord + (showCursor ? '|' : '');
                    blinkCount++;
                    
                    if (blinkCount >= maxBlinks) {
                        stopCursorBlink();
                        showCursor = true;
                        searchTypewriterInterval = setTimeout(typeLoop, 50);
                    }
                }, 600);
                return;
            }
            searchTypewriterInterval = setTimeout(typeLoop, 100);
        }
    }

    if (!window._searchTypewriterVisBound) {
        window._searchTypewriterVisBound = true;
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !window.searchCursorBlinkInterval && !searchTypewriterInterval && document.getElementById('mainSearch')) {
                typeLoop();
            }
        });
    }

    typeLoop();
}
window.startSearchTypewriter = startSearchTypewriter;

registerActions({
    setLang,
    'set-lang': setLang,
    changeLanguage,
    updateContentLanguage,
    updateFooterLanguageUI,
    startSearchTypewriter
});
