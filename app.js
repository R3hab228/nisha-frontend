// ==========================================
// HAPTIC FEEDBACK (РўРђРљРўРР›Р¬РќРђРЇ РћРўР”РђР§Рђ Р”Р›РЇ РўР•Р›Р•Р¤РћРќРћР’)
// ==========================================
function triggerHaptic(type = 'light') {
    if (window.innerWidth > 900 || !navigator.vibrate) return;
    
    try {
        switch(type) {
            case 'light': navigator.vibrate(25); break;  // 25РјСЃ - С‚РµР»РµС„РѕРЅ С‚РѕС‡РЅРѕ РїРѕС‡СѓРІСЃС‚РІСѓРµС‚
            case 'medium': navigator.vibrate(40); break; 
            case 'heavy': navigator.vibrate(70); break;  
            case 'success': navigator.vibrate([20, 60, 20]); break; 
            case 'error': navigator.vibrate([30, 50, 30, 50, 30]); break; 
        }
    } catch(e) {} 
}

console.log(`
      _   _ _____  _____ _    _          
     | \\ | |_   _|/ ____| |  | |   /\\    
     |  \\| | | | | (___ | |__| |  /  \\   
     | . \` | | |  \\___ \\|  __  | / /\\ \\  
     | |\\  |_| |_ ____) | |  | |/ ____ \\ 
     |_| \\_|_____|_____/|_|  |_/_/    \\_\\
                                         
    LOOKING AT THE SOURCE CODE? 
`);


function toggleLangDropdown(event) {
    event.stopPropagation();
    document.getElementById('langDropdown').classList.toggle('show');
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('langDropdown');
    if (dropdown && !e.target.closest('.lang-switcher-wrapper')) {
        dropdown.classList.remove('show');
    }
});

function changeLanguage(lng) {
    if (typeof i18next !== 'undefined') {
        i18next.changeLanguage(lng).then(() => {
            // Р–Р•Р›Р•Р—РћР‘Р•РўРћРќРќРћР• СЃРѕС…СЂР°РЅРµРЅРёРµ:
            localStorage.setItem('nisha_lang', lng); 
            // РЎРѕС…СЂР°РЅСЏРµРј СЏР·С‹РєРѕРІРѕР№ С„Р»Р°Рі РґР»СЏ РїР»Р°РіРёРЅР° i18next
            localStorage.setItem('i18nextLng', lng); 
            
            updateContentLanguage();
            
            // РњРіРЅРѕРІРµРЅРЅРѕ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј РІРѕРѕР±С‰Рµ Р’РЎР• С†РµРЅС‹ Рё С‚РµРєСЃС‚С‹ РЅР° СЃР°Р№С‚Рµ
            applyFilters(); 
            if (typeof renderCartItems === 'function') renderCartItems();
            if (typeof updateCartUI === 'function') updateCartUI();
            if (typeof renderHistory === 'function') renderHistory();
            
            const msg = i18next.t('messages.lang_changed') + ' [' + lng.toUpperCase() + ']';
            showToast(msg, 'success');

            
            // Р•СЃР»Рё РјРѕР±РёР»СЊРЅРѕРµ РјРµРЅСЋ РѕС‚РєСЂС‹С‚Рѕ/Р·Р°РєСЂС‹С‚Рѕ вЂ” РїРµСЂРµРІРѕРґРёРј РєРЅРѕРїРєСѓ С„РёР»СЊС‚СЂРѕРІ
            const sidebar = document.querySelector('.sidebar');
            const btn = document.getElementById('mobileFilterBtn');
            if (btn && sidebar) {
                if (sidebar.classList.contains('active-mobile')) {
                    btn.innerText = i18next.t('mobile.hide_filters', { defaultValue: '[-] РЎРљР Р«РўР¬ Р¤РР›Р¬РўР Р«' });
                } else {
                    btn.innerText = i18next.t('mobile.show_filters', { defaultValue: '[+] РџРћРљРђР—РђРўР¬ Р¤РР›Р¬РўР Р«' });
                }
            }
            
            if (currentUser && _supabase) {
                _supabase.from('profiles').update({ language: lng }).eq('id', currentUser.id).then();
            }
        });
    }
}


// === РђР’РўРћРњРђРўРР§Р•РЎРљРћР• РћР‘РќРћР’Р›Р•РќРР• РЎРђР™РўРђ (Р‘Р•Р— РљР­РЁРђ) ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('[PWA] SW Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ');
            
            // РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ РїСЂРѕРІРµСЂСЏРµРј РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂРё РєР°Р¶РґРѕРј Р·Р°С…РѕРґРµ
            registration.update();

            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[PWA] РќР°Р№РґРµРЅРѕ РѕР±РЅРѕРІР»РµРЅРёРµ!');
                        showTerminalModal(
                            'SYSTEM_UPDATE.EXE', 
                            'Р’С‹РїСѓС‰РµРЅР° РЅРѕРІР°СЏ РІРµСЂСЃРёСЏ СЃР°Р№С‚Р° (РёСЃРїСЂР°РІР»РµРЅРёРµ Р±Р°РіРѕРІ, РЅРѕРІС‹Рµ С„РёС‡Рё).<br><br>Р РµРєРѕРјРµРЅРґСѓРµРј РѕР±РЅРѕРІРёС‚СЊ СЃС‚СЂР°РЅРёС†Сѓ.', 
                            '[ РћР‘РќРћР’РРўР¬ РЎР•Р™Р§РђРЎ ]', 
                            () => {
                                caches.keys().then(names => {
                                    for (let name of names) caches.delete(name);
// WEB PUSH РџРћР”РџРРЎРљРђ
                                }).then(() => {
                                    window.location.reload(true);
                                });
                            }
                        );
                    }
                };
            };
        }).catch(err => console.log('[PWA] РћС€РёР±РєР° SW: ', err));
    });
}
if (typeof Sentry !== 'undefined') {
    Sentry.init({
        dsn: "https://13d63555c1c64605be8f9659af548581@o4511428929323008.ingest.de.sentry.io/4511428931682384", 
        release: "nisha-store@1.0.0",
        environment: "production",
        tracesSampleRate: 1.0, 
    });
    console.log('[ SENTRY ] РЎРРЎРўР•РњРђ РњРћРќРРўРћР РРќР“Рђ РђРљРўРР’РќРђ.');
}
// РџРµСЂРµРјРµРЅРЅС‹Рµ РґР»СЏ Р°РЅРёРјР°С†РёРё РїРѕРёСЃРєР°
let searchTypewriterInterval = null;
let currentSearchLang = 'ru';

function updateContentLanguage() {
    // РџРµСЂРµРІРѕРґРёРј РѕР±С‹С‡РЅС‹Р№ С‚РµРєСЃС‚
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerHTML = i18next.t(key);
    });
    
    // РџРµСЂРµРІРѕРґРёРј Placeholder'С‹ РёРЅРїСѓС‚РѕРІ
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        el.placeholder = i18next.t(key);
    });

    // Р—Р°РїСѓСЃРєР°РµРј РїРµС‡Р°С‚РЅСѓСЋ РјР°С€РёРЅРєСѓ РїРѕРёСЃРєР°
    currentSearchLang = i18next.language || 'ru';
    startSearchTypewriter();
}

function startSearchTypewriter() {
    const searchInput = document.getElementById('mainSearch');
    if (!searchInput) return;

    if (searchTypewriterInterval) clearTimeout(searchTypewriterInterval);
    if (window.searchCursorBlinkInterval) clearInterval(window.searchCursorBlinkInterval);

    const translatedWords = {
        'ua': ['РџРѕС€СѓРє СЂРµС‡РµР№...'],
        'ru': ['РџРѕРёСЃРє РІРµС‰Рё...'],
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
                const maxBlinks = 4; // 4 * 0.6СЃ = 2.4 СЃРµРєСѓРЅРґС‹ РїР°СѓР·С‹ РїРµСЂРµРґ СѓРґР°Р»РµРЅРёРµРј
                
                window.searchCursorBlinkInterval = setInterval(() => {
                    if (document.activeElement === searchInput || searchInput.value.length > 0) {
                        searchInput.placeholder = currentWord;
                        return;
                    }
                    showCursor = !showCursor;
                    searchInput.placeholder = currentWord + (showCursor ? '|' : '');
                    blinkCount++;
                    
                    if (blinkCount >= maxBlinks) {
                        clearInterval(window.searchCursorBlinkInterval);
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
// ==========================================
// Р‘Р•Р—РћРџРђРЎРќР«Р™ РџР›РђР’РќР«Р™ РЎРљР РћР›Р› (РўРћР›Р¬РљРћ Р”Р›РЇ РџРљ)
// ==========================================
let lenis;

if (window.innerWidth > 900) {
    lenis = new Lenis({
        lerp: 0.1, 
        wheelMultiplier: 1, 
        smoothWheel: true
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
}

// Р–РµР»РµР·РѕР±РµС‚РѕРЅРЅС‹Рµ С„СѓРЅРєС†РёРё РѕСЃС‚Р°РЅРѕРІРєРё Рё Р·Р°РїСѓСЃРєР°
window.stopLenis = function() {
    if (typeof lenis !== 'undefined' && lenis) {
        // Р’С‹Р·С‹РІР°РµРј РѕСЂРёРіРёРЅР°Р»СЊРЅС‹Р№ РјРµС‚РѕРґ Р±РёР±Р»РёРѕС‚РµРєРё, С‡С‚РѕР±С‹ РёР·Р±РµР¶Р°С‚СЊ СЂРµРєСѓСЂСЃРёРё
        Object.getPrototypeOf(lenis).stop.call(lenis); 
    }
};

window.startLenis = function() {
    if (typeof lenis !== 'undefined' && lenis) {
        Object.getPrototypeOf(lenis).start.call(lenis); 
    }
};

// РћС‚РєСЂС‹С‚РёРµ РЅРѕРІРѕРіРѕ РјРѕРґР°Р»СЊРЅРѕРіРѕ РѕРєРЅР° РїСЂРѕС„РёР»СЏ
function openProfileModal() {
    if (typeof lenis !== 'undefined') window.stopLenis();
    document.getElementById('profileModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// --- РЈРњРќР«Р• РџР›РђР’РђР®Р©РР• РљРќРћРџРљР (РџР Р•Р”Р›РћР–РљРђ Р Р¤РР›Р¬РўР Р«) ---
let fabScrollTimeout;
let lastScrollY = window.scrollY || document.documentElement.scrollTop;

let scrollTicking = false;
window.addEventListener('scroll', () => {
    if (document.body.classList.contains('search-lock')) return;

    if (!scrollTicking) {
        window.requestAnimationFrame(() => {
            const fab = document.querySelector('.fab-propose');
            const filterBtn = document.getElementById('mobileFilterBtn');
            const currentScrollY = window.scrollY || document.documentElement.scrollTop;
            
            if (Math.abs(currentScrollY - lastScrollY) > 10) {
                if (currentScrollY > lastScrollY && currentScrollY > 150) {
                    // РџСЂРѕРєСЂСѓС‚РєР° РІРЅРёР· - СЃРєСЂС‹РІР°РµРј СЌР»РµРјРµРЅС‚С‹
                    if (fab && !fab.classList.contains('cart-active')) fab.classList.add('hidden-scroll');
                    if (filterBtn && window.innerWidth <= 900) filterBtn.classList.add('hidden-scroll');
                } else {
                    // РџСЂРѕРєСЂСѓС‚РєР° РІРІРµСЂС… - РІРѕР·РІСЂР°С‰Р°РµРј СЌР»РµРјРµРЅС‚С‹
                    if (fab) fab.classList.remove('hidden-scroll');
                    if (filterBtn) filterBtn.classList.remove('hidden-scroll');
                }
                lastScrollY = currentScrollY;
            }

            // Р’РѕР·РІСЂР°С‰Р°РµРј UI, РµСЃР»Рё СЃРєСЂРѕР»Р» РѕСЃС‚Р°РЅРѕРІРёР»СЃСЏ (РЅР° 800РјСЃ)
            clearTimeout(fabScrollTimeout);
            fabScrollTimeout = setTimeout(() => {
                if (fab) fab.classList.remove('hidden-scroll');
                if (filterBtn) filterBtn.classList.remove('hidden-scroll');
            }, 800);

            scrollTicking = false;
        });
        scrollTicking = true;
    }
}, { passive: true });


let allItems = []; 
// РЈРјРЅРѕРµ РѕРїСЂРµРґРµР»РµРЅРёРµ РІР°Р»СЋС‚С‹ (Р¶РµСЃС‚РєРѕ С‡РёС‚Р°РµРј РёР· РїР°РјСЏС‚Рё)
function getCurrency() {
    const lang = localStorage.getItem('nisha_lang') || 'ru';
    return lang === 'en' ? 'UAH' : 'РіСЂРЅ';
}
let currentUser = null;
let userProfile = null;
let favorites = [];
let cart = JSON.parse(localStorage.getItem('nisha_cart') || '[]');
let currentCategory = '';
let currentBrand = '';
let showingOnlyFavs = false;
let currentOpenedItem = null;
let isHacked = false; 
let _supabase = null;
let clientFingerprint = "guest_" + Date.now(); 
let orderStatusChannel = null; // РљР°РЅР°Р» Р·Р°РєР°Р·РѕРІ
let qaUpdatesChannel = null; // РљР°РЅР°Р» РІРѕРїСЂРѕСЃРѕРІ


let envData = (typeof window.ENV !== 'undefined') ? window.ENV : ((typeof CONFIG !== 'undefined') ? CONFIG : {});
let rawUrl = envData.SUPABASE_URL || '';
let rawAnonKey = envData.SUPABASE_ANON_KEY || '';

const SUPABASE_URL = rawUrl.replace(/[^\x20-\x7E]/g, '').trim();
const SUPABASE_ANON_KEY = rawAnonKey.replace(/[^\x20-\x7E]/g, '').trim();


if (!SUPABASE_ANON_KEY) {
    console.error("РћРЁРР‘РљРђ: РљР»СЋС‡ Supabase РїСѓСЃС‚РѕР№. Р‘Р°Р·Р° РґР°РЅРЅС‹С… РЅРµРґРѕСЃС‚СѓРїРЅР°.");
    setTimeout(() => showToast('РљСЂРёС‚РёС‡РµСЃРєР°СЏ РѕС€РёР±РєР°: РќРµС‚ СЃРІСЏР·Рё СЃ Р‘Р”', 'error'), 2000);
} else {
    const { createClient } = supabase;
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            fetch: (url, options) => {
                // РСЃРїРѕР»СЊР·СѓРµРј CDN РўРћР›Р¬РљРћ РґР»СЏ РіР»Р°РІРЅРѕРіРѕ СЃРїРёСЃРєР° С‚РѕРІР°СЂРѕРІ (limit=1000). РўРѕС‡РµС‡РЅС‹Рµ Р·Р°РїСЂРѕСЃС‹ РёРґСѓС‚ РЅР°РїСЂСЏРјСѓСЋ!
                if (typeof url === 'string' && url.includes('/rest/v1/items') && url.includes('limit=1000') && !url.includes('id=eq.') && (!options || options.method === 'GET' || !options.method)) {
                    url = url.replace('nmpuefxqtkhvtltdvllz.supabase.co', 'nisha-cdn.mtyagniryadno.workers.dev');
                }
                return fetch(url, options);
            }
        }
    });
}
// ==========================================
// РЎРРЎРўР•РњРђ Р’Р•Р§РќРћР™ РЎР•РЎРЎРР (JWT REFRESH)
// ==========================================
if (_supabase) {
    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
            console.log('[AUTH] РўРѕРєРµРЅ Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё СѓСЃРїРµС€РЅРѕ РїСЂРѕРґР»РµРЅ (Refresh Token).');
            currentUser = session.user;
        } else if (event === 'SIGNED_OUT') {
            console.log('[AUTH] Р’С‹РїРѕР»РЅРµРЅ РІС‹С…РѕРґ РёР· Р°РєРєР°СѓРЅС‚Р°.');
            currentUser = null;
            userProfile = null;
            favorites = [];
            updateFavBadge();
            // РЎРєСЂС‹РІР°РµРј РїСЂРѕС„РёР»СЊ, РїРѕРєР°Р·С‹РІР°РµРј Р»РѕРіРёРЅ
            const loginForm = document.getElementById('loginForm');
            const profileForm = document.getElementById('profileForm');
            if (loginForm) loginForm.style.display = 'flex';
            if (profileForm) profileForm.style.display = 'none';
            // РњРѕР±РёР»РєР°
            const mLog = document.getElementById('modalLoginForm');
            const mProf = document.getElementById('modalProfileForm');
            if (mLog) mLog.style.display = 'flex';
            if (mProf) mProf.style.display = 'none';
        } else if (event === 'SIGNED_IN') {
            // Р•СЃР»Рё СЋР·РµСЂ РІРѕС€РµР» РІ СЃРѕСЃРµРґРЅРµР№ РІРєР»Р°РґРєРµ, С‚РµРєСѓС‰Р°СЏ С‚РѕР¶Рµ РґРѕР»Р¶РЅР° РѕР±РЅРѕРІРёС‚СЊСЃСЏ
            if (!currentUser) await checkSession();
        }
    });
}

function showToast(message, type = 'success', imgUrl = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Р•СЃР»Рё РїРµСЂРµРґР°Р»Рё РєР°СЂС‚РёРЅРєСѓ вЂ” РґРѕР±Р°РІР»СЏРµРј РµС‘ СЃР»РµРІР° РѕС‚ С‚РµРєСЃС‚Р°
    let html = '';
    if (imgUrl) {
        html += `<div style="width: 35px; height: 35px; background-image: url('${imgUrl}'); background-size: cover; background-position: center; border-radius: 4px; border: 1px solid #444; flex-shrink: 0;"></div>`;
    }
    html += `<div>${message}</div>`;
    
    toast.innerHTML = html;
    container.appendChild(toast);
    
    // 2500 РјРёР»Р»РёСЃРµРєСѓРЅРґ (2.5 СЃРµРєСѓРЅРґС‹) + 500РјСЃ РЅР° СЃР°РјСѓ Р°РЅРёРјР°С†РёСЋ Р·Р°С‚СѓС…Р°РЅРёСЏ
    setTimeout(() => { 
        if(container.contains(toast)) container.removeChild(toast); 
    }, 3000);
}

// --- РљР РЈРўР«Р• РўР•Р РњРРќРђР›Р¬РќР«Р• РћРљРќРђ Р”Р›РЇ РЈР’Р•Р”РћРњР›Р•РќРР™ ---
function showTerminalModal(title, htmlText, btnText, callback) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(5px); z-index: 10000; display: flex; justify-content: center; align-items: center; flex-direction: column;";
    
    overlay.innerHTML = `
        <div class="success-terminal-box">
            <div class="success-title typewriter">${title}</div>
            <div class="success-divider"></div>
            <div class="success-text" style="margin-bottom: 20px; color: #ddd; text-align: left;">${htmlText}</div>
            <button class="cart-checkout-btn btn-target" style="width: 100%; padding: 15px;">${btnText}</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const btn = overlay.querySelector('button');
    btn.addEventListener('click', () => {
        overlay.remove();
        if (callback) callback();
    });
}

function checkRules() {
    if (!localStorage.getItem('nisha_rules_accepted')) {
        const modal = document.getElementById('rulesModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
}

function showRulesModal() { 
    const modal = document.getElementById('rulesModal');
    if (modal) {
        modal.style.display = 'flex'; 
    }
}

function acceptRules() {
    localStorage.setItem('nisha_rules_accepted', 'true');
    const modal = document.getElementById('rulesModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    if (typeof lenis !== 'undefined') window.startLenis(); 
    showToast(i18next.t('messages.rules_accepted'), 'success');
    
    // Р—Р°РїСѓСЃРєР°РµРј С‚СѓСЂ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ Р·Р°РєСЂС‹С‚РёСЏ РѕРєРЅР° РїСЂР°РІРёР»
    setTimeout(startOnboardingTour, 400); 
}
window.onload = async () => {
    document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();

    try {
        try {
            // --- РЈРњРќР«Р™ Р”РћР–РРњ РљРћР Р—РРќР« (РЎСЂР°Р±Р°С‚С‹РІР°РµС‚ РїСЂРё РІРѕР·РІСЂР°С‰РµРЅРёРё РЅР° СЃР°Р№С‚) ---
            if (cart.length > 0) {
                let lastTime = localStorage.getItem('nisha_cart_time');
                // РџСЂРѕРІРµСЂСЏРµРј: РµСЃР»Рё РїСЂРѕС€РµР» 1 С‡Р°СЃ Р РјС‹ РµС‰Рµ РЅРµ РЅР°РїРѕРјРёРЅР°Р»Рё
                if (lastTime && (Date.now() - parseInt(lastTime)) > 3600000 && !localStorage.getItem('nisha_cart_reminded')) {
                    setTimeout(() => {
                        showTerminalModal(
                            'SYSTEM_ALERT.LOG',
                            'РњС‹ Р·Р°РјРµС‚РёР»Рё, С‡С‚Рѕ РІС‹ РЅРµ Р·Р°РІРµСЂС€РёР»Рё Р·Р°РєР°Р·. Р РµРґРєРёРµ РІРµС‰Рё Р·Р°Р±РёСЂР°СЋС‚ Р±С‹СЃС‚СЂРѕ!<br><br><b style="color:var(--accent-yellow);">РСЃРїРѕР»СЊР·СѓР№С‚Рµ РїСЂРѕРјРѕРєРѕРґ COMEBACK5 РґР»СЏ СЃРєРёРґРєРё 5%!</b>',
                            '[ РџР РћР”РћР›Р–РРўР¬ РџРћРљРЈРџРљР ]', null
                        );
                        localStorage.setItem('nisha_cart_reminded', 'true');
                    }, 2000);
                }
            }

            // Р”РѕР¶РёРј С‡РµСЂРµР· СЃРёСЃС‚РµРјРЅС‹Р№ PUSH + Р¤РѕРЅРѕРІРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ РїСЂРё РІРѕР·РІСЂР°С‰РµРЅРёРё РёР· РґСЂСѓРіРёС… РїСЂРёР»РѕР¶СѓС…
            document.addEventListener("visibilitychange", async () => {
                if (document.hidden) {
                    // Р®Р·РµСЂ СЃРІРµСЂРЅСѓР» СЃР°Р№С‚ (СѓС€РµР» РІ TikTok)
                    if (cart.length > 0) {
                        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
                            navigator.serviceWorker.ready.then(reg => {
                                reg.showNotification("NISHA STORE", {
                                    body: "Р’Р°С€Р° РєРѕСЂР·РёРЅР° Р¶РґРµС‚! РћС„РѕСЂРјР»СЏР№С‚Рµ, РїРѕРєР° РЅРµ Р·Р°Р±СЂР°Р»Рё.",
                                    icon: '/icon-192.png',
                                    badge: '/badge.png',
                                    vibrate: [200, 100, 200],
                                    data: { url: '/' }
                                });
                            });
                        }
                    }
                } else {
                    // Р®Р—Р•Р  Р’Р•Р РќРЈР›РЎРЇ РќРђ РЎРђР™Рў!
                    if (_supabase) {
                        // Р–Р•РЎРўРљРћР• Р’РћРЎРЎРўРђРќРћР’Р›Р•РќРР• РЎР•РЎРЎРР (С‡С‚РѕР±С‹ РЅРµ СЂР°Р·Р»РѕРіРёРЅРёРІР°Р»Рѕ РїРѕСЃР»Рµ РіР»СѓР±РѕРєРѕРіРѕ СЃРЅР° Р±СЂР°СѓР·РµСЂР°)
                        await checkSession();
                        
                        // РўРѕР»СЊРєРѕ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё СЃРµСЃСЃРёРё С‚РёС…Рѕ РѕР±РЅРѕРІР»СЏРµРј Р±Р°Р·Сѓ С‚РѕРІР°СЂРѕРІ
                        if (allItems.length > 0) {
                            loadAllItems(); 
                        }
                    }
                }
            });

            if (typeof i18next !== 'undefined') {
                let savedLng = localStorage.getItem('nisha_lang');
                let savedFlag = localStorage.getItem('nisha_flag');
                
                if (!savedLng) {
                    const browserLang = navigator.language || navigator.userLanguage;
                    if (browserLang.toLowerCase().includes('ru')) {
                        savedLng = 'ru'; savedFlag = 'рџ‡·рџ‡є';
                    } else if (browserLang.toLowerCase().includes('en')) {
                        savedLng = 'en'; savedFlag = 'рџ‡¬рџ‡§';
                    } else {
                        savedLng = 'ua'; savedFlag = 'рџ‡єрџ‡¦';
                    }
                    localStorage.setItem('nisha_lang', savedLng);
                    localStorage.setItem('nisha_flag', savedFlag);
                }
                
                if (typeof i18nextBrowserLanguageDetector !== 'undefined') {
                    i18next.use(i18nextBrowserLanguageDetector);
                }

                // Р—Р°РіСЂСѓР¶Р°РµРј СЃР»РѕРІР°СЂРё РёР· РѕС‚РґРµР»СЊРЅРѕРіРѕ С„Р°Р№Р»Р°
                const locRes = await fetch('/locales.json');
                const localesData = await locRes.json();

                await i18next.init({
                    resources: localesData,
                    lng: savedLng, 
                    fallbackLng: 'ru',
                    debug: false
                });
                
                updateContentLanguage();
                const flagEl = document.getElementById('currentFlag');
                if (flagEl) flagEl.innerText = savedFlag;
            }
        } catch (langErr) {
            console.warn("[ РЇР—Р«РљР ] РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё СЃР»РѕРІР°СЂРµР№:", langErr);
        }


        const phoneInput = document.getElementById('orderPhone');
        const searchPhoneInput = document.getElementById('ordersSearchPhone');
        if (phoneInput && typeof IMask !== 'undefined') {
            const phoneMask = IMask(phoneInput, { mask: '+{380} (00) 000-00-00' });
            phoneMask.on('accept', () => checkPhoneAuth());
        }
        if (searchPhoneInput && typeof IMask !== 'undefined') {
            IMask(searchPhoneInput, { mask: '+{380} (00) 000-00-00' });
        }

        
       if (typeof autoAnimate === 'function') {
            autoAnimate(document.getElementById('historyGrid'));
            // РЈР±СЂР°Р»Рё ordersListArea, С‚РµРїРµСЂСЊ РјС‹ Р°РЅРёРјРёСЂСѓРµРј РµРіРѕ СЃР°РјРё С‡РµСЂРµР· CSS
        }

        checkRules();
        updateCartUI(); 
        
        
        if (typeof lottie !== 'undefined' && document.getElementById('lottie-box')) {
            lottie.loadAnimation({
                container: document.getElementById('lottie-box'),
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: 'https://lottie.host/80c43ca5-5dc1-477c-ab0f-b47209e9db6b/rY8Vz5P1t8.json' 
            });
        }
        
        if (_supabase) {
            await checkSession();
            const urlParams = new URLSearchParams(window.location.search);
            
            // Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµРј РІРєР»Р°РґРєСѓ "РР·Р±СЂР°РЅРЅРѕРµ"
            if (sessionStorage.getItem('nisha_showing_favs') === 'true') {
                showingOnlyFavs = true;
                const favNav = document.getElementById('favNav');
                if (favNav) favNav.style.color = '#fff';
            }

            // --- Р¤РРљРЎ: РР”Р•РђР›Р¬РќРћР• Р’РћРЎРЎРўРђРќРћР’Р›Р•РќРР• РљРђРўР•Р“РћР РР Р UI ---
            const savedCat = urlParams.get('cat') || sessionStorage.getItem('nisha_last_category');
            
            // 1. РћС‡РёС‰Р°РµРј РІСЃРµ РІС‹РґРµР»РµРЅРёСЏ РІ РјРµРЅСЋ РєР°С‚РµРіРѕСЂРёР№
            const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
            catLinks.forEach(el => el.classList.remove('active-filter'));

            if (savedCat) {
                currentCategory = savedCat;
                
                // 2. РС‰РµРј СЃСЃС‹Р»РєСѓ, РІРЅСѓС‚СЂРё onclick РєРѕС‚РѕСЂРѕР№ РµСЃС‚СЊ РЅР°С€Р° СЃРѕС…СЂР°РЅРµРЅРЅР°СЏ РєР°С‚РµРіРѕСЂРёСЏ, Рё РєСЂР°СЃРёРј РµС‘
                catLinks.forEach(link => {
                    const onclickText = link.getAttribute('onclick') || '';
                    if (onclickText.includes(`'${currentCategory}'`)) {
                        link.classList.add('active-filter');
                    }
                });
            } else {
                // Р•СЃР»Рё РЅРёС‡РµРіРѕ РЅРµ СЃРѕС…СЂР°РЅРµРЅРѕ - РІС‹РґРµР»СЏРµРј "Р’СЃРµ РІРµС‰Рё"
                const firstLink = document.querySelector('.sidebar .filter-list:first-of-type a');
                if (firstLink) firstLink.classList.add('active-filter');
            }

            // --- РќРћР’РћР•: Р’РћРЎРЎРўРђРќРћР’Р›Р•РќРР• РџРћРРЎРљРћР’РћР“Рћ Р—РђРџР РћРЎРђ Р’ UI ---
            const savedQuery = urlParams.get('q');
            if (savedQuery) {
                const sInput = document.getElementById('mainSearch');
                if (sInput) {
                    sInput.value = savedQuery;
                    // РџРѕРєР°Р·С‹РІР°РµРј РєСЂРµСЃС‚РёРє РґР»СЏ СЃР±СЂРѕСЃР° РїРѕРёСЃРєР°
                    const clearBtn = document.getElementById('clearSearchBtn');
                    if (clearBtn) clearBtn.style.display = 'block';
                }
            }

            await loadAllItems();

         // --- РџР РћР’Р•Р РљРђ Р РђРЎРЎР«Р›РћРљ РћРў РђР”РњРРќРђ (РЈРњРќРђРЇ) ---
            setTimeout(async () => {
                try {
                    const { data: broadcasts } = await _supabase.from('site_broadcasts').select('*').order('created_at', { ascending: false }).limit(1);
                    
                    if (broadcasts && broadcasts.length > 0) {
                        const bData = broadcasts[0];
                        
                        const localSeenId = localStorage.getItem('nisha_last_broadcast');
                        const dbSeenId = userProfile ? userProfile.last_broadcast_id : null;
                        const hasSeen = (localSeenId === bData.id) || (dbSeenId === bData.id);

                        if (!hasSeen) {
                            let broadcastContent = ''; // РџРµСЂРµРёРјРµРЅРѕРІР°Р»Рё РїРµСЂРµРјРµРЅРЅСѓСЋ РґР»СЏ 100% Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё
                            if (bData.image_url) {
                                broadcastContent += `<img src="${bData.image_url}" style="width:100%; max-height:200px; object-fit:cover; border-radius:4px; border:1px solid #333; margin-bottom:15px;">`;
                            }
                            if (bData.message_text) {
                                broadcastContent += `<div style="font-size:14px; line-height:1.5;">${bData.message_text.replace(/\n/g, '<br>')}</div>`;
                            }

                            const markAsSeen = () => {
                                localStorage.setItem('nisha_last_broadcast', bData.id);
                                if (currentUser && _supabase) {
                                    _supabase.from('profiles').update({ last_broadcast_id: bData.id }).eq('id', currentUser.id).then();
                                }
                            };

                            if (localStorage.getItem('nisha_tour_done')) {
                                showTerminalModal('SYSTEM_BROADCAST.MSG', broadcastContent, '[ Р—РђРљР Р«РўР¬ ]', markAsSeen);
                            } else {
                                window.pendingBroadcastHtml = broadcastContent;
                                window.pendingBroadcastId = bData.id;
                            }
                        }
                    }
                } catch(e) { console.warn("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё СЂР°СЃСЃС‹Р»РєРё", e); }
            }, 3000);

            const openItemId = urlParams.get('item');
            if (openItemId) {
                setTimeout(() => openProductModalById(openItemId), 500);
            }
            
           // --- РќРћР’РћР•: Р РђРЎРЎР«Р›РљРђ Р’ Р Р•РђР›Р¬РќРћРњ Р’Р Р•РњР•РќР Р”Р›РЇ РўР•РҐ, РљРўРћ РЈР–Р• РќРђ РЎРђР™РўР• ---
            _supabase.channel('public:site_broadcasts')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_broadcasts' }, payload => {
                    const bData = payload.new;
                    let bHtml = '';
                    if (bData.image_url) {
                        bHtml += `<img src="${bData.image_url}" style="width:100%; max-height:200px; object-fit:cover; border-radius:4px; border:1px solid #333; margin-bottom:15px;">`;
                    }
                    if (bData.message_text) {
                        bHtml += `<div style="font-size:14px; line-height:1.5;">${bData.message_text.replace(/\n/g, '<br>')}</div>`;
                    }

                    // РЎСЂР°Р·Сѓ РїРѕРєР°Р·С‹РІР°РµРј СЂР°СЃСЃС‹Р»РєСѓ РїРѕРІРµСЂС… РІСЃРµРіРѕ, РґР°Р¶Рµ РµСЃР»Рё СЃС‚СЂР°РЅРёС†Р° РЅРµ РѕР±РЅРѕРІР»СЏР»Р°СЃСЊ
                    showTerminalModal('SYSTEM_BROADCAST.MSG', bHtml, '[ Р—РђРљР Р«РўР¬ ]', () => {
                        localStorage.setItem('nisha_last_broadcast', bData.id);
                    });
                })
                .subscribe();

         _supabase.channel('public:items')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, payload => {
                    // Р•РЎР›Р Р”РћР‘РђР’РР›Р РќРћР’РЈР® Р’Р•Р©Р¬ Р§Р•Р Р•Р— Р‘РћРўРђ
                    if (payload.eventType === 'INSERT') {
                        allItems.unshift(payload.new); // Р”РѕР±Р°РІР»СЏРµРј РІ РЅР°С‡Р°Р»Рѕ РјР°СЃСЃРёРІР°
                        showToast(`рџ†• РќРѕРІР°СЏ РІРµС‰СЊ РЅР° СЃР°Р№С‚Рµ: ${payload.new.name}`, 'success');
                        applyFilters(); // РџР»Р°РІРЅРѕ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј СЃРµС‚РєСѓ
                    } 
                    // Р•РЎР›Р РђР”РњРРќ РЈР”РђР›РР› Р’Р•Р©Р¬
                    else if (payload.eventType === 'DELETE') {
                        allItems = allItems.filter(i => i.id !== payload.old.id);
                        applyFilters();
                    }
                    // Р•РЎР›Р Р’Р•Р©Р¬ РљРЈРџРР›Р РР›Р РћР‘РќРћР’РР›Р
                    else if (payload.eventType === 'UPDATE') {
                        const updatedItem = payload.new;
                        const index = allItems.findIndex(i => i.id === updatedItem.id);
                        let needsGridUpdate = false;
                        if (index !== -1) {
                            const oldItem = allItems[index];
                            
                            // РџСЂРѕРІРµСЂРєР°: СѓРїР°Р»Р° Р»Рё С†РµРЅР° / РїРѕСЏРІРёР»Р°СЃСЊ Р»Рё СЃРєРёРґРєР°
                            const priceDropped = (!oldItem.is_sale && updatedItem.is_sale) || (oldItem.price > updatedItem.price);
                            const imgUrl = (updatedItem.thumbnails && updatedItem.thumbnails.length > 0) ? updatedItem.thumbnails[0] : ((updatedItem.images && updatedItem.images.length > 0) ? updatedItem.images[0] : null);

                            needsGridUpdate = oldItem.is_top !== updatedItem.is_top || 
                                              oldItem.top_until !== updatedItem.top_until || 
                                              oldItem.status !== updatedItem.status ||
                            Object.assign(allItems[index], updatedItem);
                            
                            if (priceDropped && updatedItem.status === 'available') {
                                showToast('рџ”Ґ РЎРљРР”РљРђ!!!', 'success', imgUrl);
                            }

                            if (updatedItem.status === 'available') {
                                const cartIdx = cart.findIndex(c => c.id === updatedItem.id);
                                if (cartIdx !== -1) {
                                    cart.splice(cartIdx, 1);
                                    localStorage.setItem('nisha_cart', JSON.stringify(cart));
                                    syncCartToServer();
                                    updateCartUI();
                                    showToast(`Р‘СЂРѕРЅСЊ РёСЃС‚РµРєР»Р°. ${updatedItem.name} СЃРЅРѕРІР° РІ РЅР°Р»РёС‡РёРё.`, 'error');
                                }
                            }
                            
                            // РЎРРќРҐР РћРќРќРћР• Р”РРќРђРњРР§Р•РЎРљРћР• РћР‘РќРћР’Р›Р•РќРР• РљРђР РўРћР§РљР Р‘Р•Р— РџР•Р Р•Р—РђР“Р РЈР—РљР Р“Р РР”Рђ
                            if (typeof updateCardDOM === 'function') {
                                updateCardDOM(allItems[index]);
                            }
                            
                            if (currentOpenedItem && currentOpenedItem.id === updatedItem.id) {
                                if (updatedItem.status === 'sold') {
                                    const cartBtn = document.getElementById('modalCartBtn');
                                    const waitBtn = document.getElementById('modalWaitlistBtn');
                                    if(cartBtn) cartBtn.style.display = 'none';
                                    if(waitBtn) waitBtn.style.display = 'block';
                                }
                            }
                        }
                    }
                })
                .subscribe();
        } else {
            document.getElementById('itemsGrid').innerHTML = `<div style="color:red; padding:20px; text-align:center;">[ Р‘Р” РќР• РџРћР”РљР›Р®Р§Р•РќРђ ]</div>`;
        }
        
       // рџљЂ РЎРћР’Р Р•РњР•РќРќР«Р™ РРќРўР•Р›Р›Р•РљРўРЈРђР›Р¬РќР«Р™ РЎРљР РћР›Р› (РљР°Рє РІ Instagram)
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                if (renderedCount < filteredItems.length && window.innerWidth <= 900) {
                    const scrollTrigger = document.getElementById('loadingTrigger');
                    if (scrollTrigger) {
                        scrollTrigger.style.display = 'block';
                        scrollTrigger.innerHTML = '<span style="animation: pulse 1s infinite; color: var(--accent-green);">[ Р—РђР“Р РЈР—РљРђ РђР РҐРР’Рђ... ]</span>';
                    }
                    setTimeout(() => {
                        renderNextBatch();
                    }, 300);
                }
            }
        }, { rootMargin: "600px", threshold: 0.1 }); 
        
        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) observer.observe(scrollTrigger);

        renderHistory();
        initHitCounter();
        
        if (currentUser && currentUser.phone) {
            document.getElementById('ordersSearchPhone').value = currentUser.phone;
        }

       // Р•СЃР»Рё РїСЂР°РІРёР»Р° СѓР¶Рµ Р±С‹Р»Рё РїСЂРёРЅСЏС‚С‹ СЂР°РЅРµРµ, РЅРѕ С‚СѓСЂ РЅРµ РїСЂРѕР№РґРµРЅ вЂ” Р·Р°РїСѓСЃРєР°РµРј
        if (localStorage.getItem('nisha_rules_accepted')) {
            startOnboardingTour();
        }

        // ==============================================================
        // --- РЎРРЎРўР•РњРђ Р›РР§РќР«РҐ РћРўР’Р•РўРћР’ РћРў РџРћР”Р”Р•Р Р–РљР (Р¤РРљРЎ) ---
        // ==============================================================
        setTimeout(async () => {
            console.log("[РЎРРЎРўР•РњРђ РћРўР’Р•РўРћР’] РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ... РњРѕР№ ID:", clientFingerprint);
            try {
                // 1. РџСЂРѕРІРµСЂСЏРµРј РїСЂРѕРїСѓС‰РµРЅРЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ (Offline)
                const { data: replies, error: replErr } = await _supabase
                    .from('support_replies')
                    .select('*')
                    .eq('client_id', clientFingerprint)
                    .eq('is_read', false);
                
                if (replErr) console.error("[РЎРРЎРўР•РњРђ РћРўР’Р•РўРћР’] РћС€РёР±РєР° Р‘Р”:", replErr.message);

                if (replies && replies.length > 0) {
                    console.log(`[РЎРРЎРўР•РњРђ РћРўР’Р•РўРћР’] РќР°Р№РґРµРЅРѕ ${replies.length} РЅРѕРІС‹С… СЃРѕРѕР±С‰РµРЅРёР№!`);
                    replies.forEach(r => {
                        showTerminalModal('INCOMING_MESSAGE.SYS', `<b>РћС‚РІРµС‚ РѕС‚ РџРѕРґРґРµСЂР¶РєРё:</b><br><br>${r.answer_text}`, '[ РџР РћР§РРўРђРќРћ ]', () => {
                            _supabase.from('support_replies').update({ is_read: true }).eq('id', r.id).then();
                        });
                    });
                }

                // 2. РЎР»СѓС€Р°РµРј РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё (Online)
                console.log("[РЎРРЎРўР•РњРђ РћРўР’Р•РўРћР’] РџРѕРґРїРёСЃРєР° РЅР° Realtime РІРєР»СЋС‡РµРЅР°.");
                _supabase.channel('support-replies-channel')
                    .on('postgres_changes', { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'support_replies', 
                        filter: `client_id=eq.${clientFingerprint}` 
                    }, payload => {
                        console.log("[РЎРРЎРўР•РњРђ РћРўР’Р•РўРћР’] РџСЂРёС€Р»Рѕ РЅРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ Online:", payload.new);
                        const r = payload.new;
                        showTerminalModal('INCOMING_MESSAGE.SYS', `<b>РћС‚РІРµС‚ РѕС‚ РџРѕРґРґРµСЂР¶РєРё:</b><br><br>${r.answer_text}`, '[ РџР РћР§РРўРђРќРћ ]', () => {
                            _supabase.from('support_replies').update({ is_read: true }).eq('id', r.id).then();
                        });
                    })
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            console.log("[РЎРРЎРўР•РњРђ РћРўР’Р•РўРћР’] РЈСЃРїРµС€РЅРѕ РїРѕРґРєР»СЋС‡РµРЅ Рє РєР°РЅР°Р»Сѓ!");
                        }
                    });
            } catch(e) {
                console.error("[РЎРРЎРўР•РњРђ РћРўР’Р•РўРћР’] Р“Р»РѕР±Р°Р»СЊРЅР°СЏ РѕС€РёР±РєР°:", e);
            }
        }, 3000); // Р–РґРµРј 3 СЃРµРєСѓРЅРґС‹ РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё СЃР°Р№С‚Р°, С‡С‚РѕР±С‹ РЅРµ РјРµС€Р°С‚СЊ

    } catch (err) {
       
        console.error("РћРЁРР‘РљРђ РРќРР¦РРђР›РР—РђР¦РР РџР РР›РћР–Р•РќРРЇ:", err);
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            grid.innerHTML = `<div style="color:red; text-align:center; padding:40px; grid-column:1/-1;">[ РЎРРЎРўР•РњРќРђРЇ РћРЁРР‘РљРђ: ${err.message} ]</div>`;
        }
    }
};

// РРґРµР°Р»СЊРЅРѕ РїР»Р°РІРЅРѕРµ Р·Р°РєСЂС‹С‚РёРµ РїРѕ РєСЂРµСЃС‚РёРєСѓ
// ==========================================
// Р”Р’РЈРҐРљРќРћРџРћР§РќР«Р™ РўР•Р РњРРќРђР› Р”Р›РЇ РџРћР”РўР’Р•Р Р–Р”Р•РќРР™
// ==========================================
function showConfirmTerminalModal(title, htmlText, confirmBtnText, cancelBtnText, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(5px); z-index: 100000; display: flex; justify-content: center; align-items: center; flex-direction: column;";
    
    overlay.innerHTML = `
        <div class="success-terminal-box" style="animation: none; transform: scale(1); opacity: 1;">
            <div class="success-title typewriter" style="color: var(--accent-yellow);">${title}</div>
            <div class="success-divider" style="background: repeating-linear-gradient(90deg, var(--accent-yellow), var(--accent-yellow) 5px, transparent 5px, transparent 10px);"></div>
            <div class="success-text" style="margin-bottom: 20px; color: #ddd; text-align: left;">${htmlText}</div>
            <div style="display: flex; gap: 10px;">
                <button class="cart-checkout-btn btn-target confirm-yes" style="flex: 1; background: var(--accent-red); border-color: var(--accent-red); color: #fff;">${confirmBtnText}</button>
                <button class="cart-checkout-btn btn-target confirm-no" style="flex: 1; background: #333; border-color: #555; color: #fff;">${cancelBtnText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    overlay.querySelector('.confirm-yes').addEventListener('click', () => { overlay.remove(); if (onConfirm) onConfirm(); });
    overlay.querySelector('.confirm-no').addEventListener('click', () => { overlay.remove(); });
}

// РРґРµР°Р»СЊРЅРѕ РїР»Р°РІРЅРѕРµ Р·Р°РєСЂС‹С‚РёРµ РїРѕ РєСЂРµСЃС‚РёРєСѓ (РЎ Р—РђР©РРўРћР™ Р”РђРќРќР«РҐ)
function closeModal(id) { 
    if (id === 'proposeModal') {
        const files = document.getElementById('propFiles')?.files?.length || 0;
        const brand = document.getElementById('propBrand')?.value.trim() || '';
        const size = document.getElementById('propSize')?.value.trim() || '';
        const contact = document.getElementById('propContact')?.value.trim() || '';
        
        // Р•СЃР»Рё СЋР·РµСЂ РІРІРµР» С…РѕС‚СЊ С‡С‚Рѕ-С‚Рѕ вЂ” РІС‹Р·С‹РІР°РµРј С‚РµСЂРјРёРЅР°Р»
        if (files > 0 || brand !== '' || size !== '' || contact !== '') {
            showConfirmTerminalModal(
                'WARNING_DATA_LOSS.SYS', 
                'РЈ РІР°СЃ РµСЃС‚СЊ РЅРµСЃРѕС…СЂР°РЅРµРЅРЅС‹Рµ РґР°РЅРЅС‹Рµ. Р•СЃР»Рё РІС‹ Р·Р°РєСЂРѕРµС‚Рµ РѕРєРЅРѕ, С„РѕСЂРјР° РїРѕР»РЅРѕСЃС‚СЊСЋ РѕС‡РёСЃС‚РёС‚СЃСЏ.', 
                '[ Р—РђРљР Р«РўР¬ ]', 
                '[ РћРўРњР•РќРђ ]', 
                () => { resetProposalForm(); executeCloseModal(id); } // Р•СЃР»Рё СЃРѕРіР»Р°СЃРёР»СЃСЏ - СЃС‚РёСЂР°РµРј Рё Р·Р°РєСЂС‹РІР°РµРј
            );
            return; 
        }
    }
    executeCloseModal(id); // Р•СЃР»Рё Р·Р°С‰РёС‰Р°С‚СЊ РЅРµ РЅСѓР¶РЅРѕ вЂ” РїСЂРѕСЃС‚Рѕ Р·Р°РєСЂС‹РІР°РµРј
}

// Р’СЃСЏ СЃС‚Р°СЂР°СЏ Р»РѕРіРёРєР° Р°РЅРёРјР°С†РёР№ РїРµСЂРµРЅРµСЃРµРЅР° СЃСЋРґР°
function executeCloseModal(id) {
    if (id === 'checkoutModal' && window.otpPollInterval) clearInterval(window.otpPollInterval);
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const win = modal.querySelector('.modal-window');
    
    if (win) {
        win.style.animation = 'none';
        win.offsetHeight; 
        win.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease';
        if (window.innerWidth > 900) { win.style.transform = 'scale(0.95) translateY(20px)'; } 
        else { win.style.transform = 'translateY(100vh)'; }
        win.style.opacity = '0';
    }

    modal.style.transition = 'background-color 0.3s ease, opacity 0.3s ease';
    modal.style.backgroundColor = 'transparent';
    modal.style.opacity = '0';
    
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; 
        if (typeof lenis !== 'undefined') window.startLenis(); 
        
        if (win) { win.style.transform = ''; win.style.opacity = ''; win.style.transition = ''; win.style.animation = ''; }
        modal.style.opacity = ''; modal.style.transition = ''; modal.style.backgroundColor = '';
        
        if (id === 'productModal') { document.title = 'NISHA | Underground Store'; renderHistory(); }
    }, 300);
}

async function openReviewsModal() { 
    const modal = document.getElementById('reviewsModal');
    modal.style.display = 'flex'; 
    document.body.style.overflow = 'hidden'; 
    if (typeof lenis !== 'undefined') window.stopLenis(); 
    
    const container = document.getElementById('reviewsContainerList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; color: var(--accent-green); font-family: var(--font-mono); padding: 40px 20px;">[ Р—РђР“Р РЈР—РљРђ РћРўР—Р«Р’РћР’... ]</div>';
    
    const { data, error } = await _supabase.from('reviews').select('*').eq('is_published', true).order('created_at', { ascending: false });
    
    if (error || !data || data.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #555; font-family: var(--font-mono); padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a;">[ ${i18next.t('reviews_modal.empty_reviews', { defaultValue: 'Р’ Р”РђРќРќР«Р™ РњРћРњР•РќРў РћРўР—Р«Р’Р« РћРўРЎРЈРўРЎРўР’РЈР®Рў' })} ]</div>`;
        return;
    }

    // Р“Р»РѕР±Р°Р»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ РґР»СЏ РѕС‚РєСЂС‹С‚РёСЏ 1 РєР°СЂС‚РёРЅРєРё РІ PhotoSwipe
    if (!window.openReviewImage) {
        window.openReviewImage = function(url) {
            if (!window.PhotoSwipeLightbox) return;
            const lightbox = new window.PhotoSwipeLightbox({
                dataSource: [{ src: url, width: 1000, height: 1000 }],
                pswpModule: () => import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/photoswipe.esm.min.js')
            });
            lightbox.init();
            lightbox.loadAndOpen(0);
        };
    }
    
    let html = ''; 
    







    data.forEach(rev => {
            const date = new Date(rev.created_at).toLocaleDateString('ru-RU');
            const safeText = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rev.text) : rev.text;
            const safeName = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rev.user_name) : rev.user_name;
            
            const clickAction = rev.item_image ? `onclick="openReviewImage('${rev.item_image}')"` : '';
            const imgHtml = rev.item_image ? `<div ${clickAction} style="width: 45px; height: 45px; border-radius: 4px; border: 1px solid #333; background-image: url('${rev.item_image}'); background-size: cover; background-position: center; flex-shrink: 0; box-shadow: 0 0 10px rgba(0,255,0,0.1); cursor: zoom-in;" title="РЈРІРµР»РёС‡РёС‚СЊ С„РѕС‚Рѕ"></div>` : '';
            
            const productLinkStyle = rev.item_id ? `cursor: pointer; text-decoration: underline; text-decoration-style: dashed;` : '';
            const productLinkAction = rev.item_id ? `onclick="openProductModalById('${rev.item_id}')" title="РћС‚РєСЂС‹С‚СЊ С‚РѕРІР°СЂ"` : '';

            html += `
            <div class="review-card-ui">
                <div class="review-head" style="align-items: flex-start; justify-content: space-between; display: flex;">
                    <div style="display: flex; flex-direction: column;">
                        <span class="review-name" ${productLinkAction} style="color: #fff; font-weight: bold; font-family: var(--font-main); font-size: 14px; ${productLinkStyle}">@${safeName}</span>
                        <div class="review-date" style="text-align: left; margin-top: 4px; color: #555; font-size: 11px; font-family: var(--font-mono);">${date}</div>
                    </div>
                    ${imgHtml}
                </div>
                <div class="review-text-body" style="margin-top: 10px; color: #ccc; font-size: 13px; line-height: 1.5; font-style: italic;">${safeText}</div>
            </div>`;
        });



    
    container.innerHTML = html;
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
        if (this.id === 'rulesModal') return; 
        if (e.target === this) { 
            closeModal(this.id); 
        }
    });
});


document.querySelectorAll('.modal-window, .orders-container').forEach(el => {
    el.setAttribute('data-lenis-prevent', 'true');
});

async function checkSession() {
    try {
        // Р–РµСЃС‚РєР°СЏ РїСЂРѕРІРµСЂРєР° СЋР·РµСЂР° РЅР° СЃРµСЂРІРµСЂРµ, Р° РЅРµ РІ РєСЌС€Рµ
        const { data: { user }, error: userError } = await _supabase.auth.getUser();
        
        if (user && !userError) {
            currentUser = user;
            const { data: profiles, error } = await _supabase.from('profiles').select('*').eq('id', currentUser.id).limit(1);
           if (!error && profiles && profiles.length > 0) { 
                userProfile = profiles[0]; 
                
                // --- РЎРРќРҐР РћРќРР—РђР¦РРЇ РЇР—Р«РљРђ РР— Р‘Р” Р’ Р‘Р РђРЈР—Р•Р  ---
                if (userProfile.language) {
                    const currentLang = localStorage.getItem('nisha_lang') || 'ru';
                    if (userProfile.language !== currentLang) {
                        localStorage.setItem('nisha_lang', userProfile.language);
                        const newFlag = userProfile.language === 'ru' ? 'рџ‡·рџ‡є' : (userProfile.language === 'en' ? 'рџ‡¬рџ‡§' : 'рџ‡єрџ‡¦');
                        localStorage.setItem('nisha_flag', newFlag);
                        if (typeof i18next !== 'undefined') {
                            i18next.changeLanguage(userProfile.language).then(() => {
                                updateContentLanguage();
                                const footLang = document.getElementById('currentLangLabelFooter');
                                if (footLang) footLang.innerText = '[' + userProfile.language.toUpperCase() + '] в–ј';
                            });
                        }
                    }
                }
            }

            // РЈРњРќРђРЇ Р›РћР“РРљРђ РРњР•РќР:
            // Р•СЃР»Рё РІ Р‘Р” Р·Р°РїРёСЃР°Р»РѕСЃСЊ РґРµС„РѕР»С‚РЅРѕРµ 'User' (РёР»Рё РїСѓСЃС‚Рѕ), С‚Рѕ Р¶РµСЃС‚РєРѕ Р±РµСЂРµРј РёРјСЏ РёР· Google
            let uName = userProfile?.username;
            if (!uName || uName === 'User') {
                uName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
            }
            const uEmail = currentUser.email;

            // Р‘Р•Р—РћРџРђРЎРќРћ РћР±РЅРѕРІР»СЏРµРј РџРљ (РЎР°Р№РґР±Р°СЂ)
            const loginForm = document.getElementById('loginForm');
            const profileForm = document.getElementById('profileForm');
            if (loginForm) loginForm.style.display = 'none';
            if (profileForm) profileForm.style.display = 'flex';
            
            if(document.getElementById('profileName')) document.getElementById('profileName').innerText = uName;
            if(document.getElementById('profileEmail')) document.getElementById('profileEmail').innerText = uEmail; // Р”РћР‘РђР’РР›Р E-MAIL Р”Р›РЇ РџРљ

            // Р‘Р•Р—РћРџРђРЎРќРћ РћР±РЅРѕРІР»СЏРµРј РњРѕР±РёР»РєСѓ (РњРѕРґР°Р»РєР°)
            const mLog = document.getElementById('modalLoginForm');
            const mProf = document.getElementById('modalProfileForm');
            if (mLog) mLog.style.display = 'none';
            if (mProf) mProf.style.display = 'block';
            
            if(document.getElementById('modalProfileName')) document.getElementById('modalProfileName').innerText = uName;
            if(document.getElementById('modalProfileEmail')) document.getElementById('modalProfileEmail').innerText = uEmail;
            // --- РџР РР’РЇР—РљРђ РџРЈРЁР•Р™ Рљ РџР РћР¤РР›Р® ---
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    if (typeof subscribeUserToPush === 'function') {
                        subscribeUserToPush(reg, true); // silent = true
                    }
                });
            }
            
           // --- РЈР’Р•Р”РћРњР›Р•РќРРЇ Рћ РЎРўРђРўРЈРЎР• Р—РђРљРђР—Рђ Р’ Р Р•РђР›Р¬РќРћРњ Р’Р Р•РњР•РќР ---
            if (orderStatusChannel) _supabase.removeChannel(orderStatusChannel);
            orderStatusChannel = _supabase.channel('order-status-updates')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'orders',
                    filter: `user_id=eq.${currentUser.id}` 
                }, payload => {
                    const newStatus = payload.new.status;
                    if (newStatus !== payload.old.status) {
                        showToast(`Р—Р°РєР°Р· #${payload.new.id.split('-')[0].toUpperCase()}: ${newStatus.toUpperCase()}`, 'success');
                        
                        showTerminalModal(
                            'SYSTEM_NOTIFICATION.LOG',
                            `Р’РќРРњРђРќРР•! РЎС‚Р°С‚СѓСЃ РІР°С€РµРіРѕ Р·Р°РєР°Р·Р° РёР·РјРµРЅРёР»СЃСЏ.<br><br>` +
                            `Р—Р°РєР°Р·: #${payload.new.id.split('-')[0].toUpperCase()}<br>` +
                            `РќРѕРІС‹Р№ СЃС‚Р°С‚СѓСЃ: <b style="color:var(--accent-green);">${newStatus.toUpperCase()}</b>`,
                            '[ РџРћРЎРњРћРўР Р•РўР¬ ]',
                            () => openOrdersModal()
                        );
                    }
                })
                .subscribe();

           // --- РЈР’Р•Р”РћРњР›Р•РќРРЇ РћР‘ РћРўР’Р•РўРђРҐ РќРђ Р’РћРџР РћРЎР« ---
            if (qaUpdatesChannel) _supabase.removeChannel(qaUpdatesChannel);
            qaUpdatesChannel = _supabase.channel('qa-updates')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'item_questions',
                    filter: `user_id=eq.${currentUser.id}` 
                }, payload => {
                    if (payload.new.answer && !payload.old.answer) {
                        const msg = i18next.t('messages.qa_answered', {defaultValue: 'Р’Р°Рј РѕС‚РІРµС‚РёР»Рё РЅР° РІРѕРїСЂРѕСЃ!'});
                        showToast(msg, 'success');
                    }
                })
                .subscribe();

            await loadFavorites();
           
            
          // --- РЈРњРќРћР• Р’РћРЎРЎРўРђРќРћР’Р›Р•РќРР• Р‘Р РћРЁР•РќРќРћР™ РљРћР Р—РРќР« ---
            if (userProfile && userProfile.cart && userProfile.cart.length > 0) {
                const dbCart = userProfile.cart;
                
                // Р•СЃР»Рё С‚РµРєСѓС‰Р°СЏ Р»РѕРєР°Р»СЊРЅР°СЏ РєРѕСЂР·РёРЅР° РїСѓСЃС‚Р° вЂ” РїСЂРѕСЃС‚Рѕ Р±РµСЂРµРј РёР· Р‘Р”
                if (cart.length === 0) {
                    cart = dbCart;
                    showToast('РљРѕСЂР·РёРЅР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР°', 'success');
                } else {
                    // Р•СЃР»Рё Р»РѕРєР°Р»СЊРЅРѕ С‡С‚Рѕ-С‚Рѕ РµСЃС‚СЊ, РѕР±СЉРµРґРёРЅСЏРµРј РѕР±Рµ РєРѕСЂР·РёРЅС‹ Р±РµР· РґСѓР±Р»РёРєР°С‚РѕРІ
                    let mergedCart = [...cart];
                    let addedCount = 0;
                    
                    dbCart.forEach(dbItem => {
                        if (!mergedCart.some(localItem => localItem.id === dbItem.id)) {
                            mergedCart.push(dbItem);
                            addedCount++;
                        }
                    });
                    
                    cart = mergedCart;
                    if (addedCount > 0) showToast('РљРѕСЂР·РёРЅС‹ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅС‹', 'success');
                }
                
                // РЎРѕС…СЂР°РЅСЏРµРј РѕР±СЉРµРґРёРЅРµРЅРЅС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚ Р»РѕРєР°Р»СЊРЅРѕ Рё РѕС‚РїСЂР°РІР»СЏРµРј РѕР±СЂР°С‚РЅРѕ РІ Р‘Р”
                localStorage.setItem('nisha_cart', JSON.stringify(cart));
                await syncCartToServer();
            } else {
                // Р•СЃР»Рё РІ Р‘Р” РїСѓСЃС‚Рѕ, РЅРѕ СЋР·РµСЂ РЅР°РєРёРґР°Р» РІРµС‰РµР№ РіРѕСЃС‚РµРј вЂ” РѕС‚РїСЂР°РІР»СЏРµРј РёС… РІ Р±Р°Р·Сѓ
                if (cart.length > 0) {
                    await syncCartToServer();
                }
            }
            updateCartUI();
        } else {
            currentUser = null;
            userProfile = null;
            favorites = [];
            
            // Р‘Р•Р—РћРџРђРЎРќРћ РџРљ
            const loginForm = document.getElementById('loginForm');
            const profileForm = document.getElementById('profileForm');
            if (loginForm) loginForm.style.display = 'flex';
            if (profileForm) profileForm.style.display = 'none';
            
            // Р‘Р•Р—РћРџРђРЎРќРћ РњРѕР±РёР»РєР°
            const mLog = document.getElementById('modalLoginForm');
            const mProf = document.getElementById('modalProfileForm');
            if (mLog) mLog.style.display = 'flex';
            if (mProf) mProf.style.display = 'none';
            
            updateFavBadge();
        }
    } catch (err) { console.error("РћС€РёР±РєР° РІ checkSession:", err); }
}

let isRegMode = false;
function toggleRegMode(isModal = false) {
    isRegMode = !isRegMode;
    const p = isModal ? 'modal' : '';
    const a = isModal ? 'modalAuth' : 'auth';

    const btnLogin = document.getElementById(p ? 'modalBtnLogin' : 'btnLogin');
    const btnShowReg = document.getElementById(p ? 'modalBtnShowReg' : 'btnShowReg');
    const btnRegister = document.getElementById(p ? 'modalBtnRegister' : 'btnRegister');
    const btnBackLogin = document.getElementById(p ? 'modalBtnBackLogin' : 'btnBackLogin');
    const authUsername = document.getElementById(a + 'Username');

    if (isRegMode) {
        btnLogin.style.display = 'none';
        btnShowReg.style.display = 'none';
        btnRegister.style.display = 'block';
        btnBackLogin.style.display = 'block';
        authUsername.style.display = 'block';
    } else {
        btnLogin.style.display = 'block';
        btnShowReg.style.display = 'block';
        btnRegister.style.display = 'none';
        btnBackLogin.style.display = 'none';
        authUsername.style.display = 'none';
    }
}

async function handleAuth(action, isModal = false) {
    const p = isModal ? 'modalAuth' : 'auth';
    const email = document.getElementById(p + 'Email').value.trim();
    const password = document.getElementById(p + 'Pass').value.trim();
    const username = document.getElementById(p + 'Username').value.trim();

    if (!email || !password) { showToast('Р’РІРµРґРёС‚Рµ Email Рё РїР°СЂРѕР»СЊ!', 'error'); return; }

    let result;
    if (action === 'register') {
        if (!username) { showToast('Р”Р»СЏ СЂРµРіРёСЃС‚СЂР°С†РёРё РЅСѓР¶РµРЅ РЅРёРєРЅРµР№Рј!', 'error'); return; }
        result = await _supabase.auth.signUp({ email, password, options: { data: { username: username } } });
        if (!result.error) showToast('Р РµРіРёСЃС‚СЂР°С†РёСЏ СѓСЃРїРµС€РЅР°! РџСЂРѕРІРµСЂСЊС‚Рµ РїРѕС‡С‚Сѓ.', 'success');
    } else {
        result = await _supabase.auth.signInWithPassword({ email, password });
        if (!result.error) showToast(i18next.t('messages.login_success'), 'success');
    }

    if (result.error) { showToast(result.error.message, 'error'); } 
    else { await checkSession(); if(isModal) closeModal('profileModal'); }
}


async function logout() {
    await _supabase.auth.signOut();
    showToast(i18next.t('messages.logout'), 'success');
    
    
    showingOnlyFavs = false; 
    if(document.getElementById('favNav')) document.getElementById('favNav').style.color = 'var(--accent-yellow)';
    
    await checkSession();
    applyFilters(); 
}


let renderedCount = 0;
let filteredItems = [];

// Р—Р°РїСЂРµС‰Р°РµРј Р±СЂР°СѓР·РµСЂСѓ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°С‚СЊ СЃРєСЂРѕР»Р» РїСЂРё РїРµСЂРµР·Р°РіСЂСѓР·РєРµ СЃС‚СЂР°РЅРёС†С‹
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ РїРµСЂРµС…РІР°С‚С‡РёРє URL РґР»СЏ CDN (Р’С‹РЅРµСЃР»Рё РЅР°РІРµСЂС…, С‡С‚РѕР±С‹ Р±СЂР°СѓР·РµСЂ РµРіРѕ РІРёРґРµР» СЃСЂР°Р·Сѓ!)
window.toCDN = function(url) {
    if (typeof url === 'string' && url.includes('nmpuefxqtkhvtltdvllz.supabase.co')) {
        // РСЃРїРѕР»СЊР·СѓРµРј С‚РІРѕР№ Р±РµСЃРїР»Р°С‚РЅС‹Р№ СЂР°Р±РѕС‡РёР№ РґРѕРјРµРЅ Cloudflare Workers!
        return url.replace('https://nmpuefxqtkhvtltdvllz.supabase.co', 'https://nisha-cdn.mtyagniryadno.workers.dev');
    }
    return url || '';
};

function getOptimizedImageUrl(item, wantsThumb = false) {
    if (!item || typeof item !== 'object') return '';
    const isValid = (url) => typeof url === 'string' && url.trim().length > 10;

    let resultUrl = '';

    if (wantsThumb && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
        if (isValid(item.thumbnails[0])) resultUrl = item.thumbnails[0];
    }

    if (!resultUrl && Array.isArray(item.images) && item.images.length > 0) {
        if (isValid(item.images[0])) resultUrl = item.images[0];
    }

    // рџ”Ґ РњРђР“РРЇ CDN: РџСЂРёРјРµРЅСЏРµРј РіР»РѕР±Р°Р»СЊРЅСѓСЋ РїРѕРґРјРµРЅСѓ
    return window.toCDN(resultUrl);
}

async function loadAllItems() {
    const grid = document.getElementById('itemsGrid');
    
    // 1. РњР“РќРћР’Р•РќРќРђРЇ Р—РђР“Р РЈР—РљРђ (РР· РєСЌС€Р°)
    const cachedData = localStorage.getItem('nisha_cached_db');
    if (cachedData && allItems.length === 0) {
        try {
            allItems = JSON.parse(cachedData);
            applyFilters(); 
        } catch(e) { console.error("РћС€РёР±РєР° РєСЌС€Р°"); }
    }

    // 2. Р¤РћРќРћР’Р«Р™ Р—РђРџР РћРЎ Рљ Р‘Р” (РЎРЅРёРјР°РµРј Р»РёРјРёС‚, Р±РµСЂРµРј 1000 С‚РѕРІР°СЂРѕРІ)
    // РћРџРўРРњРР—РђР¦РРЇ: Р·Р°РїСЂР°С€РёРІР°РµРј С‚РѕР»СЊРєРѕ Р»РµРіРєРёРµ РїРѕР»СЏ, Р±РµР· 'description' Рё 'measurements', РѕРЅРё РїРѕРґРіСЂСѓР·СЏС‚СЃСЏ РїСЂРё РєР»РёРєРµ
    const { data, error } = await _supabase.from('items').select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, is_drop').limit(1000).order('created_at', { ascending: false });
    
    if (error) { 
        if (allItems.length === 0 && grid) grid.innerHTML = `<div style="color:red; padding:20px; grid-column: 1/-1;">[ РћРЁРР‘РљРђ Р‘Р”: ${error.message} ]</div>`;
        return; 
    }
    
    // --- Р¤РРљРЎ Р‘РђР“Рђ "6 РўРћР’РђР РћР’": РЎСЂР°РІРЅРёРІР°РµРј РЅРµ С‚РѕР»СЊРєРѕ С‚РµРєСЃС‚, РЅРѕ Рё РґР»РёРЅСѓ РјР°СЃСЃРёРІРѕРІ! ---
    // Р•СЃР»Рё РґР°РЅРЅС‹Рµ РёР·РјРµРЅРёР»РёСЃСЊ, СЃРѕС…СЂР°РЅСЏРµРј РІ РєСЌС€
    const isChanged = (JSON.stringify(data) !== JSON.stringify(allItems)) || (data.length !== allItems.length);
    allItems = data; 
    localStorage.setItem('nisha_cached_db', JSON.stringify(data)); 
    
    // --- РРЎРўРћР РРЇ РџР РћРЎРњРћРўР РћР’ ---
    if (userProfile && userProfile.viewed_history && userProfile.viewed_history.length > 0) {
        let dbHistory = [];
        userProfile.viewed_history.forEach(uuid => {
            const histItem = allItems.find(i => i.id === uuid);
            if (histItem) {
                const img = (histItem.images && histItem.images.length > 0) ? histItem.images[0] : '';
                dbHistory.push({ id: histItem.id, name: histItem.name, price: histItem.price, img: img });
            }
        });
        localStorage.setItem('nisha_history', JSON.stringify(dbHistory));
        renderHistory();
    }

    // Р¤РРљРЎ РљРћР Р—РРќР«
    const validCart = cart.filter(cItem => allItems.some(dbItem => dbItem.id === cItem.id));
    if (validCart.length !== cart.length) {
        cart = validCart;
        localStorage.setItem('nisha_cart', JSON.stringify(cart));
        updateCartUI();
    }

    // 3. РџР•Р Р•Р РРЎРћР’РљРђ (Р•СЃР»Рё РґР°РЅРЅС‹Рµ СЂРµР°Р»СЊРЅРѕ РѕР±РЅРѕРІРёР»РёСЃСЊ)
    if (!cachedData || isChanged) {
        applyFilters(); 
    }
    
    // 4. Р¤РћРќРћР’РђРЇ РџР РћР’Р•Р РљРђ (РћР±С…РѕРґ РєРµС€Р° CDN) - СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµРј Р°РєС‚СѓР°Р»СЊРЅС‹Рµ СЃС‚Р°С‚СѓСЃС‹ TOP/SOLD
    syncCriticalStatuses();
}

// --- РЎРРќРҐР РћРќРР—РђР¦РРЇ РљР РРўРР§Р•РЎРљРРҐ РЎРўРђРўРЈРЎРћР’ (TOP, RESERVED, SOLD) РІ РѕР±С…РѕРґ CDN ---
async function syncCriticalStatuses() {
    if (typeof _supabase === 'undefined') return;
    try {
        // Р’С‹С‚Р°СЃРєРёРІР°РµРј РЅР°РїСЂСЏРјСѓСЋ Р±Р°Р·РѕРІС‹Рµ СЃС‚Р°С‚СѓСЃС‹ Р’РЎР•РҐ РІРµС‰РµР№ РёР· Р‘Р”, РјРёРЅСѓСЏ CDN РєСЌС€!
        const { data } = await _supabase.from('items').select('id, is_top, top_until, status');
        
        if (data) {
            let changed = false;
            
            // 1. РћС‡РёСЃС‚РєР° РѕС‚ РїСЂРёР·СЂР°РєРѕРІ (СѓРґР°Р»СЏРµРј РёР· РєСЌС€Р° РІРµС‰Рё, РєРѕС‚РѕСЂС‹Рµ СѓРґР°Р»РµРЅС‹ РёР· Р‘Р”)
            const validIds = new Set(data.map(d => d.id));
            const originalLength = allItems.length;
            allItems = allItems.filter(i => validIds.has(i.id));
            if (allItems.length !== originalLength) changed = true;
            
            // 2. РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РєСЂРёС‚РёС‡РµСЃРєРёС… СЃС‚Р°С‚СѓСЃРѕРІ
            const dataMap = new Map();
            data.forEach(d => dataMap.set(d.id, d));
            
            allItems.forEach(old => {
                const fresh = dataMap.get(old.id);
                if (fresh) {
                    if (old.is_top !== fresh.is_top || old.top_until !== fresh.top_until || old.status !== fresh.status) {
                        old.is_top = fresh.is_top;
                        old.top_until = fresh.top_until;
                        old.status = fresh.status;
                        changed = true;
                    }
                }
            });
            const { data: latestItems } = await _supabase.from('items')
                .select('id, name, brand, price, old_price, is_sale, is_top, top_until, status, thumbnails, images, category, size, views_count, created_at, condition, is_drop')
                .order('created_at', { ascending: false })
                .limit(5);

            if (latestItems) {
                let latestAdded = false;
                latestItems.forEach(newItem => {
                    if (!allItems.find(i => i.id === newItem.id)) {
                        allItems.unshift(newItem);
                        latestAdded = true;
                        changed = true;
                    }
                });
                if (latestAdded) {
                    allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                }
            }
            
            if (changed) applyFilters();
        }
    } catch(e) { console.error("Sync error:", e); }
}

// --- РћР‘РќРћР’Р›Р•РќРР• РљР РђРЎРќР«РҐ РЎР§Р•РўР§РРљРћР’ Р’ Р‘РћРљРћР’РћРњ РњР•РќР® ---
function updateSidebarCounters() {
    // РЎС‡РёС‚Р°РµРј РєР°С‚РµРіРѕСЂРёРё (С‚РѕР»СЊРєРѕ РґРѕСЃС‚СѓРїРЅС‹Рµ С‚РѕРІР°СЂС‹)
    const availableItemsAll = allItems.filter(i => i.status === 'available');
    const catCounts = { 'Р’СЃРµ РІРµС‰Рё': availableItemsAll.length };
    availableItemsAll.forEach(item => {
        if (!item) return;
        const c = item.category || 'Р‘РµР· РєР°С‚РµРіРѕСЂРёРё';
        catCounts[c] = (catCounts[c] || 0) + 1;
    });

    // РћР±РЅРѕРІР»СЏРµРј HTML РєР°С‚РµРіРѕСЂРёР№
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(link => {
        // РЈР±РёСЂР°РµРј СЃС‚Р°СЂС‹Р№ СЃС‡РµС‚С‡РёРє (РµСЃР»Рё Р±С‹Р»)
        let baseText = link.innerHTML.split('<span')[0].trim();
        
        // РћРїСЂРµРґРµР»СЏРµРј, РєР°РєР°СЏ СЌС‚Рѕ РєР°С‚РµРіРѕСЂРёСЏ
        let catName = '';
        if (baseText.includes('Р’СЃРµ РІРµС‰Рё')) catName = 'Р’СЃРµ РІРµС‰Рё';
        else if (baseText.includes('Р’РµСЂС…РЅСЏСЏ РѕРґРµР¶РґР°')) catName = 'Р’РµСЂС…РЅСЏСЏ РѕРґРµР¶РґР°';
        else if (baseText.includes('РљРѕС„С‚С‹ Рё РЎРІРёС‚РµСЂР°')) catName = 'РљРѕС„С‚С‹ Рё РЎРІРёС‚РµСЂР°';
        else if (baseText.includes('РЁС‚Р°РЅС‹ Рё Р”Р¶РёРЅСЃС‹')) catName = 'РЁС‚Р°РЅС‹ Рё Р”Р¶РёРЅСЃС‹';
        else if (baseText.includes('РћР±СѓРІСЊ')) catName = 'РћР±СѓРІСЊ';
        else if (baseText.includes('РђРєСЃРµСЃСЃСѓР°СЂС‹')) catName = 'РђРєСЃРµСЃСЃСѓР°СЂС‹';

        const count = catCounts[catName] || 0;
        
        // Р РёСЃСѓРµРј СЃС‚РёР»СЊРЅС‹Р№ РєСЂР°СЃРЅС‹Р№ СЃС‡РµС‚С‡РёРє (СЃРєСЂС‹РІР°РµРј, РµСЃР»Рё 0)
        if (count > 0) {
            link.innerHTML = `${baseText} <span style="color:#ff3333; font-weight:bold; font-family:var(--font-mono); font-size:11px;">(${count})</span>`;
        } else {
            link.innerHTML = baseText;
        }

        // --- Р–Р•Р›Р•Р—РћР‘Р•РўРћРќРќР«Р™ Р’РћР—Р’Р РђРў Р—Р•Р›Р•РќРћР“Рћ Р’Р«Р”Р•Р›Р•РќРРЇ ---
        link.classList.remove('active-filter'); // РЎРЅР°С‡Р°Р»Р° РѕС‡РёС‰Р°РµРј
        if (currentCategory !== '' && catName === currentCategory) {
            link.classList.add('active-filter');
        } else if (currentCategory === '' && catName === 'Р’СЃРµ РІРµС‰Рё') {
            link.classList.add('active-filter');
        }
    });
    

    // РЎС‡РёС‚Р°РµРј СЂР°Р·РјРµСЂС‹ (С‚РѕР»СЊРєРѕ РґР»СЏ РўР•РљРЈР©Р•Р™ РІС‹Р±СЂР°РЅРЅРѕР№ РєР°С‚РµРіРѕСЂРёРё Рё РўРћР›Р¬РљРћ Р”РћРЎРўРЈРџРќР«Р•)
    const sizeCounts = {};
    allItems.forEach(item => {
        if (!item || item.status !== 'available') return;
        if (currentCategory !== '' && item.category !== currentCategory) return; // РЈРјРЅС‹Р№ РїРѕРґСЃС‡РµС‚
        const s = item.size || '-';
        sizeCounts[s] = (sizeCounts[s] || 0) + 1;
    });

    // РћР±РЅРѕРІР»СЏРµРј HTML СЂР°Р·РјРµСЂРѕРІ
    document.querySelectorAll('.size-cb').forEach(cb => {
        const labelSpan = cb.nextElementSibling;
        let baseText = labelSpan.innerHTML.split('<span')[0].trim();
        const sizeVal = cb.value;
        const count = sizeCounts[sizeVal] || 0;

        if (count > 0) {
            labelSpan.innerHTML = `${baseText} <span style="color:#ff3333; font-weight:bold; font-family:var(--font-mono); font-size:11px;">(${count})</span>`;
            cb.parentElement.style.opacity = '1';
            cb.disabled = false;
        } else {
            labelSpan.innerHTML = baseText;
            cb.parentElement.style.opacity = '0.4'; // Р”РµР»Р°РµРј РїРѕР»СѓРїСЂРѕР·СЂР°С‡РЅС‹Рј, РµСЃР»Рё СЂР°Р·РјРµСЂР° РЅРµС‚
            cb.disabled = true; // Р‘Р»РѕРєРёСЂСѓРµРј РіР°Р»РѕС‡РєСѓ
            cb.checked = false; // РЎРЅРёРјР°РµРј РіР°Р»РѕС‡РєСѓ, РµСЃР»Рё Р±С‹Р»Р°
        }
    });
}

// РћРџРўРРњРР—РђР¦РРЇ PREFETCH: Р¤СѓРЅРєС†РёСЏ РґР»СЏ РїСЂРµРґР·Р°РіСЂСѓР·РєРё С„РѕС‚РѕРє РІС‹СЃРѕРєРѕРіРѕ РєР°С‡РµСЃС‚РІР°
window.prefetchItemImages = function(id) {
    if (!window._prefetchedItems) window._prefetchedItems = new Set();
    if (window._prefetchedItems.has(id)) return;
    
    window._prefetchedItems.add(id);
    const item = allItems.find(i => i.id === id);
    if (item && item.images) {
        // Р—Р°РіСЂСѓР¶Р°РµРј РІ РїР°РјСЏС‚СЊ Р±СЂР°СѓР·РµСЂР° РїРµСЂРІС‹Рµ 2 С„РѕС‚РєРё РёР· РіР°Р»РµСЂРµРё С‚РѕРІР°СЂР°
        item.images.slice(0, 2).forEach(url => {
            const img = new Image();
            img.src = window.toCDN ? window.toCDN(url) : url;
        });
    }
};

let itemsPageSize = window.innerWidth <= 900 ? 12 : 15; 
let applyFiltersTimeout;
function applyFilters() {
    const grid = document.getElementById('itemsGrid');
    if (grid) grid.classList.add('fade-out');

    clearTimeout(applyFiltersTimeout);
    applyFiltersTimeout = setTimeout(() => {
        try {
            const searchInput = document.getElementById('mainSearch');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const checkedSizes = Array.from(document.querySelectorAll('.size-cb:checked')).map(cb => cb.value);
            const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
            
            const minInput = document.getElementById('priceMin');
            const maxInput = document.getElementById('priceMax');
            const minPrice = minInput ? parseInt(minInput.value) : 0;
            const maxPrice = maxInput ? parseInt(maxInput.value) : 15000;

            // РЈРњРќРђРЇ РћР§РРЎРўРљРђ Р¦Р•РќР« (РЈР±РёСЂР°РµС‚ РїСЂРѕР±РµР»С‹, Р±СѓРєРІС‹ "РіСЂРЅ" Рё Р·Р°С‰РёС‰Р°РµС‚ РѕС‚ NaN)
           // РЈРњРќРђРЇ РћР§РРЎРўРљРђ Р¦Р•РќР«
            const getSafePrice = (price) => parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;

            // 1. РЎРќРђР§РђР›Рђ Р–Р•РЎРўРљРђРЇ Р¤РР›Р¬РўР РђР¦РРЇ
            filteredItems = allItems.filter(item => {
                if (!item) return false;
                
                const isFav = favorites.includes(item.id);
                const matchesAvailability = !hideUnavailable || item.status === 'available';
                
                // --- Р¤РРљРЎ Р›РћР“РРљР РР—Р‘Р РђРќРќРћР“Рћ ---
                if (showingOnlyFavs) {
                    // Р’ СЂРµР¶РёРјРµ РР·Р±СЂР°РЅРЅРѕРіРѕ РёРіРЅРѕСЂРёСЂСѓРµРј Р’РЎРЃ (РєР°С‚РµРіРѕСЂРёРё, СЂР°Р·РјРµСЂС‹, С†РµРЅС‹, РїРѕРёСЃРє). 
                    // РџРѕРєР°Р·С‹РІР°РµРј РїСЂРѕСЃС‚Рѕ Р»Р°Р№РєРЅСѓС‚С‹Рµ РІРµС‰Рё (СЃ СѓС‡РµС‚РѕРј РіР°Р»РѕС‡РєРё "РЎРєСЂС‹С‚СЊ РїСЂРѕРґР°РЅРЅРѕРµ").
                    return isFav && matchesAvailability;
                }

                // --- РћР‘Р«Р§РќР«Р™ Р Р•Р–РРњ Р›Р•РќРўР« (Р Р°Р±РѕС‚Р°СЋС‚ РІСЃРµ С„РёР»СЊС‚СЂС‹) ---
                const itemCategory = item.category || '';
                const itemBrand = item.brand ? item.brand.toLowerCase() : '';
                const itemSize = item.size ? item.size.trim() : '';
                const searchBrand = currentBrand ? currentBrand.toLowerCase() : '';
                
                const matchesCategory = currentCategory === '' || itemCategory === currentCategory;
                const matchesBrand = searchBrand === '' || itemBrand.includes(searchBrand);
                const matchesSize = checkedSizes.length === 0 || checkedSizes.includes(itemSize);
                
                const itemFinalPrice = isHacked ? Math.floor(getSafePrice(item.price) * 0.9) : getSafePrice(item.price);
                const matchesPrice = itemFinalPrice >= minPrice && itemFinalPrice <= maxPrice;
                
                return matchesCategory && matchesBrand && matchesSize && matchesPrice && matchesAvailability;
            });

            // 2. РџРћРўРћРњ РЈРњРќР«Р™ РџРћРРЎРљ (FUSE.JS) - РС‰РµРј РўРћР›Р¬РљРћ РµСЃР»Рё РјС‹ РќР• РІ СЂРµР¶РёРјРµ РР·Р±СЂР°РЅРЅРѕРіРѕ!
            if (searchTerm !== '' && typeof Fuse !== 'undefined' && !showingOnlyFavs && currentCategory === '') {
                const cleanSearchTerm = searchTerm.replace(/#/g, '').trim();
                const fuseOptions = {
                    includeScore: true, threshold: 0.4, ignoreLocation: true, useExtendedSearch: true, 
                    keys: [{ name: 'tags', weight: 1.0 }, { name: 'brand', weight: 0.8 }, { name: 'name', weight: 0.8 }, { name: 'size', weight: 0.8 }, { name: 'category', weight: 0.2 }]
                };
                const fuse = new Fuse(filteredItems, fuseOptions);
                filteredItems = fuse.search(cleanSearchTerm).map(result => result.item);
            }

            // 3. РџР РђР’РР›Р¬РќРђРЇ РЎРћР РўРР РћР’РљРђ Р’ РЎРђРњРћРњ РљРћРќР¦Р• (Р§С‚РѕР±С‹ РїРѕРёСЃРє РµРµ РЅРµ СЃР±РёРІР°Р»)
            const now = Date.now();
            const isItemTop = (item) => item.is_top === true && item.top_until && new Date(item.top_until).getTime() > now;

            // 3. РЎРѕСЂС‚РёСЂРѕРІРєР° СЌР»РµРјРµРЅС‚РѕРІ РІ СЃРµС‚РєРµ (СЃ СѓС‡РµС‚РѕРј Р·Р°РєСЂРµРїР»РµРЅРЅС‹С… TOP)
            const sortCheap = document.getElementById('sort-cheap');
            if (sortCheap && sortCheap.classList.contains('active-sort')) {
                filteredItems.sort((a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return getSafePrice(a.price) - getSafePrice(b.price);
                });
            } else {
                filteredItems.sort((a, b) => {
                    const topA = isItemTop(a);
                    const topB = isItemTop(b);
                    if (topA && !topB) return -1;
                    if (!topA && topB) return 1;
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                }); // РЎРІРµР¶РёРµ СЃРІРµСЂС…Сѓ
            }
            
            // РЎР‘Р РћРЎ Р Р Р•РќР”Р•Р 
            if (grid) grid.innerHTML = ''; 
            renderedCount = 0; 
            window.currentPage = 1; 
            
            // РђРєС‚РёРІРёСЂСѓРµРј С‚СЂРёРіРіРµСЂ Р»РµРЅРёРІРѕР№ Р·Р°РіСЂСѓР·РєРё РґР»СЏ С‚РµР»РµС„РѕРЅРѕРІ
            const scrollTrigger = document.getElementById('loadingTrigger');
            if (scrollTrigger && window.innerWidth <= 900) {
                scrollTrigger.style.display = 'block';
                scrollTrigger.innerHTML = '';
            }
            
            const countEl = document.getElementById('itemCount');
            if (countEl) {
                // РЎС‡РёС‚Р°РµРј СЂРѕРІРЅРѕ С‚Рѕ, С‡С‚Рѕ РѕС‚С„РёР»СЊС‚СЂРѕРІР°РЅРѕ Рё РІС‹РІРѕРґРёС‚СЃСЏ РЅР° СЌРєСЂР°РЅ
                countEl.innerText = filteredItems.length;
            }

            if (filteredItems.length === 0) {
                if (grid) grid.innerHTML = `<div style="color: #666; font-family: monospace; padding: 30px; grid-column: 1/-1; text-align:center;">[ РўРћР’РђР РћР’ РќР• РќРђР™Р”Р•РќРћ ]</div>`;
            } else {
                renderNextBatch(); 
            }

            // РћР±РЅРѕРІР»СЏРµРј URL
            const url = new URL(window.location);
            if (currentCategory) url.searchParams.set('cat', currentCategory); else url.searchParams.delete('cat');
            if (searchTerm) url.searchParams.set('q', searchTerm); else url.searchParams.delete('q');
            window.history.replaceState(null, '', url);

            // --- Р–Р•Р›Р•Р—РћР‘Р•РўРћРќРќР«Р™ Р¤РРљРЎ Р—Р•Р›Р•РќРћР“Рћ Р’Р«Р”Р•Р›Р•РќРРЇ ---
            const catLinks = document.querySelectorAll('.sidebar .filter-list:first-of-type a');
            catLinks.forEach(el => el.classList.remove('active-filter'));
            
            if (currentCategory) {
                catLinks.forEach(link => {
                    const onclickText = link.getAttribute('onclick') || '';
                    if (onclickText.includes(`'${currentCategory}'`)) {
                        link.classList.add('active-filter');
                    }
                });
            } else {
                const firstLink = document.querySelector('.sidebar .filter-list:first-of-type a');
                if (firstLink) firstLink.classList.add('active-filter');
            }

            updateSidebarCounters();
            
            if (grid) {
                requestAnimationFrame(() => {
                    setTimeout(() => grid.classList.remove('fade-out'), 50);
                });
            }
        } catch (err) {
            console.error("РћРЁРР‘РљРђ Р¤РР›Р¬РўР РђР¦РР:", err);
            if (grid) {
                grid.innerHTML = `<div style="color:red; grid-column:1/-1; padding:20px; text-align:center;">[ РћРЁРР‘РљРђ Р Р•РќР”Р•Р Рђ: ${err.message} ]</div>`;
                grid.classList.remove('fade-out');
            }
        }
    }, 300); 
}
// --- РЈРњРќР«Р™ РџР›Р•Р•Р  Р”Р›РЇ Р’РР”Р•Рћ Р’ РЎР•РўРљР• (Р‘Р•Р Р•Р–Р•Рў Р‘РђРўРђР Р•Р®) ---
const gridVideoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
            // Р’РёРґРµРѕ РїРѕСЏРІРёР»РѕСЃСЊ РЅР° СЌРєСЂР°РЅРµ вЂ” Р·Р°РїСѓСЃРєР°РµРј
            video.play().catch(() => {}); 
        } else {
            // Р’РёРґРµРѕ СѓС€Р»Рѕ Р·Р° СЌРєСЂР°РЅ вЂ” Р¶РµСЃС‚РєР°СЏ РїР°СѓР·Р° (Р­РєРѕРЅРѕРјРёСЏ Р±Р°С‚Р°СЂРµРё Рё РћР—РЈ)
            video.pause(); 
        }
    });
}, { rootMargin: "50px" }); // РќР°С‡РёРЅР°РµС‚ РіСЂСѓР·РёС‚СЊ С‡СѓС‚СЊ Р·Р°СЂР°РЅРµРµ

let changePageTimeout;
window.changePage = function(step) {
    window.currentPage += step;
    const grid = document.getElementById('itemsGrid');
    
    if (grid) {
        grid.classList.add('fade-out'); // РџР»Р°РІРЅРѕРµ РёСЃС‡РµР·РЅРѕРІРµРЅРёРµ
    }

    clearTimeout(changePageTimeout);
    changePageTimeout = setTimeout(() => {
        renderNextBatch(); 
        
        const sortingEl = document.querySelector('.sorting');
        if (sortingEl) {
            const y = sortingEl.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
        
        if (grid) {
            // РќРµР±РѕР»СЊС€Р°СЏ Р·Р°РґРµСЂР¶РєР°, С‡С‚РѕР±С‹ Р±СЂР°СѓР·РµСЂ СѓСЃРїРµР» РІСЃС‚Р°РІРёС‚СЊ РЅРѕРІС‹Рµ РєР°СЂС‚РѕС‡РєРё
            requestAnimationFrame(() => {
                grid.classList.remove('fade-out'); // РџР»Р°РІРЅРѕРµ РїРѕСЏРІР»РµРЅРёРµ
            });
        }
    }, 300);
};

function renderNextBatch() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;
    
    const isMobile = window.innerWidth <= 900;
    
    let oldPagination = document.getElementById('mainPagination');
    if (oldPagination) oldPagination.remove();

    let startIndex = 0;
    let endIndex = 0;
    const BATCH_SIZE = window.innerWidth <= 900 ? 12 : 15; itemsPageSize = BATCH_SIZE; // Р“СЂСѓР·РёРј СЃС‚СЂРѕРіРѕ РїРѕ 12 С‚РѕРІР°СЂРѕРІ Р·Р° СЂР°Р·!

    if (isMobile) {
        if (renderedCount === 0) grid.innerHTML = ''; 
        startIndex = renderedCount;
        endIndex = Math.min(startIndex + BATCH_SIZE, filteredItems.length); 
    } else {
        grid.innerHTML = ''; 
        startIndex = (window.currentPage - 1) * BATCH_SIZE; 
        endIndex = Math.min(startIndex + BATCH_SIZE, filteredItems.length);
    }
    
    if (startIndex >= endIndex) return;
    
    let seenItemsIds = [];
    try {
        seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items')) || [];
        if (!Array.isArray(seenItemsIds)) seenItemsIds = [];
    } catch(e) { seenItemsIds = []; }
    
    for (let i = startIndex; i < endIndex; i++) {
        try {
            const item = filteredItems[i];
            if (!item) continue;
            
            let badgeHTML = '';
            if (item.status === 'sold') {
                badgeHTML = '<div class="sold-badge">SOLD</div>';
            } else if (item.status === 'reserved') {
                badgeHTML = '<div class="reserved-badge">RESERVED</div>';
            } else {
                const hasSale = item.is_sale;
                const hasHot = (item.views_count || 0) >= 25;
                const isTop = item.is_top === true && item.top_until && new Date(item.top_until).getTime() > Date.now();

                if (hasSale || hasHot || isTop) {
                    badgeHTML = `<div class="system-status-bar">`;
                    if (isTop) {
                        badgeHTML += `<span class="status-item status-top"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> TOP</span>`;
                    }
                    if (isTop && (hasSale || hasHot)) badgeHTML += `<div class="status-divider"></div>`;
                    if (hasSale) badgeHTML += `<span class="status-item status-sale">% SALE</span>`;
                    if (hasSale && hasHot) badgeHTML += `<div class="status-divider"></div>`;
                    if (hasHot) {
                        const chartSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
                        badgeHTML += `<span class="status-item status-hot">${chartSvg} HOT</span>`;
                    }
                    badgeHTML += `</div>`;
                }
            }

            const thumbsArray = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails : (item.images && item.images.length > 0 ? item.images : []);
            let slidesStr = '';
            let dotsStr = '';

            // РћРџРўРРњРР—РђР¦РРЇ LCP: РџРµСЂРІС‹Рµ 4 РєР°СЂС‚РёРЅРєРё РіСЂСѓР·РёРј РјРіРЅРѕРІРµРЅРЅРѕ, РѕСЃС‚Р°Р»СЊРЅС‹Рµ Р»РµРЅРёРІРѕ
            const loadAttr = (i < 4) ? 'fetchpriority="high"' : 'loading="lazy"';

            thumbsArray.forEach((thumbUrl, idx) => {
                const rawVidUrl = item.images && item.images[idx] ? item.images[idx] : '';
                const isVid = typeof rawVidUrl === 'string' && rawVidUrl.endsWith('.mp4');
                
                const cdnThumb = window.toCDN(thumbUrl);
                const cdnVidUrl = window.toCDN(rawVidUrl);

                if (isVid) {
                    slidesStr += `
                        <div class="card-slide img-8bit-loading" style="background: #0a0a0a;">
                            <video class="grid-lazy-video" src="${cdnVidUrl}#t=0.001" muted loop playsinline preload="metadata" style="width:100%; height:100%; object-fit:cover; pointer-events:none; opacity:0;" oncanplay="this.style.opacity='1'; this.parentElement.classList.remove('img-8bit-loading'); this.parentElement.classList.add('img-8bit-loaded');"></video>
                        </div>`;
                } else {
                    slidesStr += `
                        <div class="card-slide img-8bit-loading" style="background-image: none;">
                           <img src="${cdnThumb}" ${loadAttr} style="position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none;" 
onload="this.parentElement.style.backgroundImage='url(\\''+this.src+'\\')'; this.parentElement.classList.remove('img-8bit-loading'); this.parentElement.classList.add('img-8bit-loaded');" 
onerror="this.parentElement.classList.remove('img-8bit-loading'); this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:red;font-size:10px;font-family:monospace;\\'>NO SIGNAL</div>';">
                        </div>`;
                }
                dotsStr += `<div class="card-dot ${idx === 0 ? 'active' : ''}"></div>`;
            });

            const starClass = favorites.includes(item.id) ? 'fav-star active' : 'fav-star';
            const isUnseen = !seenItemsIds.includes(item.id) && item.status === 'available';
            const pulseClass = isUnseen ? 'unseen-pulse' : '';

            const card = document.createElement('div');
            card.className = `item-card ${item.status !== 'available' ? 'sold-out' : ''} ${pulseClass}`;
            card.setAttribute('data-id', item.id);
            
            // РћРџРўРРњРР—РђР¦РРЇ PREFETCH: РџСЂРµРґР·Р°РіСЂСѓР·РєР° РїСЂРё РЅР°РІРµРґРµРЅРёРё
            card.setAttribute('onmouseenter', `window.prefetchItemImages('${item.id}')`);
            card.setAttribute('ontouchstart', `window.prefetchItemImages('${item.id}')`);
            
            let priceHTML = '';
            const curr = getCurrency();
            if (item.is_sale && item.old_price) {
                priceHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 14px; margin-right: 8px;">${item.old_price} ${curr}</span><span style="color: var(--accent-green);">${item.price} ${curr}</span>`;
            } else {
                priceHTML = `<span style="color: var(--accent-green);">${item.price} ${curr}</span>`;
            }

            let controlsHTML = '';
            if (thumbsArray.length > 1) {
                controlsHTML = `
                    <div class="grid-slider-btn prev" onclick="scrollGridSlider(event, '${item.id}', -1)">&#10094;</div>
                    <div class="grid-slider-btn next" onclick="scrollGridSlider(event, '${item.id}', 1)">&#10095;</div>
                    <div class="card-dots-container" id="dots-${item.id}">${dotsStr}</div>
                `;
            }

            card.innerHTML = `
                ${badgeHTML}
                <div class="${starClass}" onclick="toggleFav(event, '${item.id}')">в…</div>
                <div class="card-slider-wrapper">
                    <div class="card-slider-container" id="slider-${item.id}" onscroll="updateCardDots(this, '${item.id}')">
                        ${slidesStr}
                    </div>
                    ${controlsHTML}
                </div>
                <div class="item-info" onclick="openProductModalById('${item.id}')">
                    <h3 class="item-title">${item.name}</h3>
                    <div class="item-price">${priceHTML}</div>
                    <div class="item-size"><span data-i18n="grid.size_prefix">${i18next.t('grid.size_prefix')}</span>${item.size}</div>
                    <div class="item-footer"><span>${item.brand}</span><span>${item.condition}</span></div>
                </div>
<button class="grid-cart-btn" data-i18n="product.add_to_cart" style="${item.status === 'sold' ? 'display:none;' : ''}" onclick="addToCartWithAnimation('${item.id}', this, event)">${i18next.t('product.add_to_cart')}</button>
            `;

            const sliderWrapper = card.querySelector('.card-slider-wrapper');
            let isDraggingSlider = false;
            let startX = 0; let startY = 0;
            
            sliderWrapper.addEventListener('touchstart', (e) => { 
                isDraggingSlider = false; 
                startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            }, {passive: true});
            
            sliderWrapper.addEventListener('touchmove', (e) => { 
                if(Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10) isDraggingSlider = true;
            }, {passive: true});
            
            // РРґРµР°Р»СЊРЅС‹Р№ Р±Р°Р»Р°РЅСЃ: Р”РІРѕР№РЅРѕР№ С‚Р°Рї + РћС‡РµРЅСЊ Р±С‹СЃС‚СЂРѕРµ РѕС‚РєСЂС‹С‚РёРµ
            let clickTimer = null;
            
            // Р’РёР·СѓР°Р»СЊРЅС‹Р№ РѕС‚РєР»РёРє (С‡С‚РѕР±С‹ СЋР·РµСЂ С‡СѓРІСЃС‚РІРѕРІР°Р», С‡С‚Рѕ РєР»РёРє РїСЂРѕС€РµР»)
            sliderWrapper.addEventListener('touchstart', () => {
                if(!isDraggingSlider) sliderWrapper.style.transform = 'scale(0.98)';
            }, {passive: true});
            
            sliderWrapper.addEventListener('touchend', () => {
                sliderWrapper.style.transform = 'scale(1)';
            }, {passive: true});

            sliderWrapper.addEventListener('click', (e) => {
                if (isDraggingSlider) { e.preventDefault(); e.stopPropagation(); return; } 
                
                if (clickTimer === null) {
                    // Р–РґРµРј РІСЃРµРіРѕ 180РјСЃ. Р“Р»Р°Р· СЌС‚РѕРіРѕ РїРѕС‡С‚Рё РЅРµ Р·Р°РјРµС‚РёС‚, РЅРѕ СЃРёСЃС‚РµРјР° СѓСЃРїРµРµС‚ РїРѕР№РјР°С‚СЊ РґРІРѕР№РЅРѕР№ РєР»РёРє.
                    clickTimer = setTimeout(() => {
                        clickTimer = null;
                        openProductModalById(item.id); 
                    }, 180);
                } else {
                    // Р­С‚Рѕ Р±С‹Р» РґРІРѕР№РЅРѕР№ С‚Р°Рї! РћС‚РјРµРЅСЏРµРј РѕС‚РєСЂС‹С‚РёРµ РѕРєРЅР° Рё СЃС‚Р°РІРёРј Р»Р°Р№Рє.
                    clearTimeout(clickTimer);
                    clickTimer = null;
                    handleDoubleTapLike(e, item.id, sliderWrapper); 
                }
            });

            grid.appendChild(card);
            const vids = card.querySelectorAll('.grid-lazy-video');
            vids.forEach(v => gridVideoObserver.observe(v));

        } catch (err) { console.error(err); }
    }

    // --- Р¤РРќРђР›РР—РђР¦РРЇ Р РЎРўР РђРҐРћР’РљРђ ---
    if (isMobile) {
        renderedCount = endIndex;
        
        // РџСЂСЏС‡РµРј С‚СЂРёРіРіРµСЂ, РµСЃР»Рё РґРѕР»РёСЃС‚Р°Р»Рё РґРѕ СЃР°РјРѕРіРѕ РєРѕРЅС†Р° Р±Р°Р·С‹
        const scrollTrigger = document.getElementById('loadingTrigger');
        if (scrollTrigger) {
            if (renderedCount >= filteredItems.length) {
                scrollTrigger.style.display = 'none';
            } else {
                scrollTrigger.innerHTML = ''; // РћС‡РёС‰Р°РµРј С‚РµРєСЃС‚ РґР»СЏ СЃР»РµРґСѓСЋС‰РµРіРѕ СЃРєСЂРѕР»Р»Р°
            }
        }
    } else {
        renderedCount = filteredItems.length; 
        
        const totalPages = Math.ceil(filteredItems.length / itemsPageSize);
        if (totalPages >= 1) {
            const paginationWrap = document.createElement('div');
            paginationWrap.id = 'mainPagination';
            paginationWrap.className = 'pagination-wrapper';
            
            // РЈР‘РР РђР•Рњ РђР‘РЎРћР›Р®РўРќРћР• РџРћР—РР¦РРћРќРР РћР’РђРќРР•
            paginationWrap.style.position = 'relative';
            paginationWrap.style.width = '100%';
            paginationWrap.style.marginTop = '40px';
            paginationWrap.style.display = 'flex';
            paginationWrap.style.justifyContent = 'center';
            
            // РљР РРўРР§РќРћ: Р Р°СЃС‚СЏРіРёРІР°РµРј Р±Р»РѕРє РЅР° РІСЃСЋ С€РёСЂРёРЅСѓ СЃРµС‚РєРё
            paginationWrap.style.gridColumn = '1 / -1'; 
            
            const prevDisabled = window.currentPage === 1 ? 'disabled' : '';
            const nextDisabled = window.currentPage === totalPages ? 'disabled' : '';

            paginationWrap.innerHTML = `
                <button class="page-arrow" onclick="changePage(-1)" ${prevDisabled}>&#10094;</button>
                <div class="page-numbers">[ РЎРўР РђРќРР¦Рђ <span style="color:var(--accent-green); font-weight:bold;">${window.currentPage}</span> РР— ${totalPages} ]</div>
                <button class="page-arrow" onclick="changePage(1)" ${nextDisabled}>&#10095;</button>
            `;
            
            grid.style.paddingBottom = '0px';
            
            // Р’СЃС‚Р°РІР»СЏРµРј Р’РќРЈРўР Р¬ СЃРµС‚РєРё, РЅРѕ Р·Р° СЃС‡РµС‚ gridColumn РѕРЅ Р·Р°Р№РјРµС‚ РІСЃСЋ С€РёСЂРёРЅСѓ Рё РІСЃС‚Р°РЅРµС‚ РїРѕ С†РµРЅС‚СЂСѓ!
            grid.appendChild(paginationWrap);
        }
    }
}

function startOnboardingTour() {
    // 1. РџСЂРѕРІРµСЂСЏРµРј, РїСЂРѕР№РґРµРЅ Р»Рё С‚СѓСЂ Рё РїСЂРёРЅСЏС‚С‹ Р»Рё РїСЂР°РІРёР»Р°
    if (!localStorage.getItem('nisha_rules_accepted') || 
        localStorage.getItem('nisha_tour_done') || 
        typeof window.driver === 'undefined') return;

    // 2. Р¤СѓРЅРєС†РёСЏ, РєРѕС‚РѕСЂР°СЏ Р¶РґРµС‚ РёРґРµР°Р»СЊРЅРѕРіРѕ РјРѕРјРµРЅС‚Р° РґР»СЏ Р·Р°РїСѓСЃРєР°
    const checkAndRun = setInterval(() => {
        // РџСЂРѕРІРµСЂСЏРµРј РѕС‚РєСЂС‹С‚С‹Рµ РѕРєРЅР°
        const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some(el => {
            return window.getComputedStyle(el).display === 'flex';
        });
        
        // РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё СЃРµР№С‡Р°СЃ РЅР° СЌРєСЂР°РЅРµ Р·РµР»РµРЅС‹Рµ РёР»Рё РєСЂР°СЃРЅС‹Рµ РІСЃРїР»С‹РІР°СЋС‰РёРµ С‚РѕСЃС‚С‹
        const toastContainer = document.getElementById('toastContainer');
        const anyToastVisible = toastContainer && toastContainer.children.length > 0;

        // Р•СЃР»Рё РѕС‚РєСЂС‹С‚Рѕ РѕРєРЅРѕ РР›Р РІРёСЃРёС‚ СЃРѕРѕР±С‰РµРЅРёРµ-С‚РѕСЃС‚ вЂ” Р¶РґРµРј РґР°Р»СЊС€Рµ
        if (anyModalOpen || anyToastVisible) return;

        // Р•СЃР»Рё РІСЃС‘ С‡РёСЃС‚Рѕ вЂ” РЈР‘РР’РђР•Рњ РўРђР™РњР•Р  Рё Р·Р°РїСѓСЃРєР°РµРј С‚СѓСЂ!
        clearInterval(checkAndRun);
        const isMobile = window.innerWidth <= 900;
        const firstStar = document.querySelector('.item-card .fav-star');
        const firstCartBtn = document.querySelector('.item-card .grid-cart-btn');

        let activeSteps = [];
        activeSteps.push({ element: '.search-wrapper', popover: { title: i18next.t('tour.search_title'), description: i18next.t('tour.search_desc') } });

        if (isMobile) {
            activeSteps.push(
                { element: '.mobile-profile-link', popover: { title: i18next.t('tour.prof_title'), description: i18next.t('tour.prof_desc') } },
                { element: '#mobileFilterBtn', popover: { title: i18next.t('tour.filt_title'), description: i18next.t('tour.filt_desc') } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: i18next.t('tour.star_title'), description: i18next.t('tour.star_desc') } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: i18next.t('tour.cartbtn_title'), description: i18next.t('tour.cartbtn_desc') } });
            activeSteps.push({ element: '.fab-propose', popover: { title: i18next.t('tour.prop_title'), description: i18next.t('tour.prop_desc') } });
            activeSteps.push({ element: '#cartInfoWrapper', popover: { title: i18next.t('tour.cart_title'), description: i18next.t('tour.cart_desc') } });
        } else {
            activeSteps.push(
                { element: '#authBox', popover: { title: i18next.t('tour.prof_title'), description: i18next.t('tour.prof_desc') } },
                { element: '.sidebar', popover: { title: i18next.t('tour.filt_title'), description: i18next.t('tour.filt_desc') } }
            );
            if (firstStar) activeSteps.push({ element: firstStar, popover: { title: i18next.t('tour.star_title'), description: i18next.t('tour.star_desc') } });
            if (firstCartBtn) activeSteps.push({ element: firstCartBtn, popover: { title: i18next.t('tour.cartbtn_title'), description: i18next.t('tour.cartbtn_desc') } });
            activeSteps.push({ element: '.fab-propose', popover: { title: i18next.t('tour.prop_title'), description: i18next.t('tour.prop_desc') } });
        }

        const driverObj = window.driver.js.driver({
            showProgress: true,
            nextBtnText: i18next.t('tour.next'),
            prevBtnText: i18next.t('tour.prev'),
            doneBtnText: i18next.t('tour.done'),
            steps: activeSteps,
            onDestroyStarted: () => {
                localStorage.setItem('nisha_tour_done', 'true');
                driverObj.destroy();
                
                // РўРЈР  Р—РђРљРћРќР§Р•Рќ. РџСЂРѕРІРµСЂСЏРµРј, РЅРµ Р¶РґРµС‚ Р»Рё РЅР°СЃ СЃРєСЂС‹С‚Р°СЏ СЂР°СЃСЃС‹Р»РєР°?
                if (window.pendingBroadcastHtml) {
                    setTimeout(() => {
                        showTerminalModal('SYSTEM_BROADCAST.MSG', window.pendingBroadcastHtml, '[ Р—РђРљР Р«РўР¬ ]', () => {
                            localStorage.setItem('nisha_last_broadcast', window.pendingBroadcastId);
                        });
                        window.pendingBroadcastHtml = null; // РћС‡РёС‰Р°РµРј РїР°РјСЏС‚СЊ
                    }, 600); // Р–РґРµРј РїРѕР»СЃРµРєСѓРЅРґС‹ РїРѕСЃР»Рµ С‚СѓСЂР°, С‡С‚РѕР±С‹ Р±С‹Р»Рѕ РєСЂР°СЃРёРІРѕ
                }
            }
        });
        driverObj.drive();
    }, 500); // РџСЂРѕРІРµСЂСЏРµРј РєР°Р¶РґС‹Рµ РїРѕР»СЃРµРєСѓРЅРґС‹
}

// Р¤СѓРЅРєС†РёСЏ РґРѕР±Р°РІР»РµРЅРёСЏ РІ РєРѕСЂР·РёРЅСѓ РїСЂСЏРјРѕ СЃ РіР»Р°РІРЅРѕР№ СЃС‚СЂР°РЅРёС†С‹
async function addToCartById(itemId) {
    // --- РџР РћР’Р•Р РљРђ РќРђ Р“РћРЎРўРЇ ---
    if (!currentUser) {
        showToast(i18next.t('messages.cart_error_auth'), 'error');
        openProfileModal(); // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕС‚РєСЂС‹РІР°РµРј РѕРєРЅРѕ РІС…РѕРґР°!
        
        // Р•СЃР»Рё СЌС‚Рѕ РџРљ (РЅРµС‚ РјРѕРґР°Р»РєРё), С‚Рѕ РїРѕРґСЃРІРµС‡РёРІР°РµРј Р»РµРІРѕРµ РјРµРЅСЋ
        if (window.innerWidth > 900) {
            const authBox = document.getElementById('authBox');
            if(authBox) {
                authBox.style.boxShadow = "0 0 20px var(--accent-red)";
                setTimeout(() => authBox.style.boxShadow = "none", 2000);
            }
        }
        return;
    }

    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    if (cart.some(i => i.id === item.id)) { 
        showToast(i18next.t('messages.cart_exist'), 'error');
        return; 
    }

    let cartItem = { ...item };
    if (isHacked) {
        cartItem.price = Math.floor(cartItem.price * 0.9);
    }
    cart.push(cartItem);
    
    localStorage.setItem('nisha_cart', JSON.stringify(cart));
    await syncCartToServer();
    
localStorage.setItem('nisha_cart_time', Date.now());
localStorage.removeItem('nisha_cart_reminded');
    updateCartUI();
    showToast(i18next.t('messages.cart_add'), 'success', getOptimizedImageUrl(item, true));
}

// РР·РјРµРЅРµРЅРѕ РґР»СЏ СЃРѕР·РґР°РЅРёСЏ DOM СЌР»РµРјРµРЅС‚РѕРІ РІСЂСѓС‡РЅСѓСЋ (С‡С‚РѕР±С‹ СЂР°Р±РѕС‚Р°Р» AutoAnimate Рё Tilt.js)

function sortItems(type) {
    // 1. РџРµСЂРµРєР»СЋС‡Р°РµРј Р°РєС‚РёРІРЅС‹Р№ РєР»Р°СЃСЃ
    document.getElementById('sort-new').classList.remove('active-sort');
    document.getElementById('sort-cheap').classList.remove('active-sort');
    document.getElementById('sort-' + type).classList.add('active-sort');
    
    // 2. Р”РµР»Р°РµРј РєСЂР°СЃРёРІРѕРµ РјРёРіР°РЅРёРµ Р¶РµР»С‚С‹Рј С†РІРµС‚РѕРј, С‡С‚РѕР±С‹ РїРѕРєР°Р·Р°С‚СЊ, С‡С‚Рѕ РїСЂРѕС†РµСЃСЃ РїРѕС€РµР»
    const countEl = document.getElementById('itemCount');
    if (countEl) {
        countEl.style.transition = '0.3s';
        countEl.style.opacity = '0.2';
        countEl.style.color = 'var(--accent-yellow)';
        setTimeout(() => { 
            countEl.style.opacity = '1'; 
            countEl.style.color = 'var(--accent-green)';
        }, 300);
    }
    
    // 3. Р—Р°РїСѓСЃРєР°РµРј СЃР°РјСѓ СЃРѕСЂС‚РёСЂРѕРІРєСѓ (С‚Сѓ, РєРѕС‚РѕСЂСѓСЋ РјС‹ РѕР±РЅРѕРІРёР»Рё РІ РїСЂРѕС€Р»РѕРј С€Р°РіРµ)
    applyFilters();
    
    // 4. РџР»Р°РІРЅРѕ РїСЂРѕРєСЂСѓС‡РёРІР°РµРј СЌРєСЂР°РЅ Рє С‚РѕРІР°СЂР°Рј, С‡С‚РѕР±С‹ СЋР·РµСЂ СЃСЂР°Р·Сѓ СѓРІРёРґРµР» СЃР°РјС‹Рµ РґРµС€РµРІС‹Рµ
    setTimeout(() => {
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            const y = grid.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, 100);
}

function setCategoryFilter(cat, element) { 
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(el => el.classList.remove('active-filter'));
    if (element) {
        element.classList.add('active-filter');
    }
    currentCategory = cat; 
    
    
    sessionStorage.setItem('nisha_last_category', cat);
    
    applyFilters(); 
}
// --- РђРќРРњРђР¦РРЇ РџРћР›Р•РўРђ Р’ РљРћР Р—РРќРЈ ---
// --- РђРќРРњРђР¦РРЇ РџРћР›Р•РўРђ Р’ РљРћР Р—РРќРЈ ---
function addToCartWithAnimation(itemId, btnElement, event) {
    if (event) event.stopPropagation(); 
    
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    // Р•СЃР»Рё РіРѕСЃС‚СЊ - РїСЂРµСЂС‹РІР°РµРј РїРѕР»РµС‚ РєР°СЂС‚РёРЅРєРё, Р»РѕРіРёРєР° РєРѕСЂР·РёРЅС‹ СЃР°РјР° РїРѕРєР°Р¶РµС‚ РѕРєРЅРѕ РІС…РѕРґР°
    if (!currentUser) {
        addToCartById(itemId); // Р’С‹Р·РѕРІРµС‚ РѕРєРЅРѕ Р°РІС‚РѕСЂРёР·Р°С†РёРё
        return;
    }
    
    // Р’РђР–РќРћ: Р”РѕР±Р°РІР»СЏРµРј РІ РєРѕСЂР·РёРЅСѓ (Р‘Р•Р— Р­РўРћР“Рћ РќРР§Р•Р“Рћ РќР• РЎРћРҐР РђРќРРўРЎРЇ)
    addToCartById(itemId);
    
    // Р‘Р•Р—РћРџРђРЎРќРђРЇ Р’РР‘Р РђР¦РРЇ
    if (typeof triggerHaptic === 'function') triggerHaptic('success');
    
    const cartIcon = document.getElementById('cartInfoWrapper');
    if (!cartIcon) return; 

    const btnRect = btnElement.getBoundingClientRect();

    const flyingImg = document.createElement('div');
    flyingImg.className = 'flying-item';

    // Р•СЃР»Рё С„РѕС‚Рѕ РµСЃС‚СЊ - СЃС‚Р°РІРёРј РµРіРѕ. Р•СЃР»Рё РЅРµС‚ - СЃС‚Р°РІРёРј С‚РµРјРЅС‹Р№ С„РѕРЅ.
    if (item.images && item.images.length > 0) {
        flyingImg.style.backgroundImage = `url('${getOptimizedImageUrl(item, true)}')`;
    } else {
        flyingImg.style.backgroundColor = '#111';
    }

    // РЎС‚Р°СЂС‚РѕРІР°СЏ РїРѕР·РёС†РёСЏ (СЂРѕРІРЅРѕ РЅР°Рґ РєРЅРѕРїРєРѕР№)
    flyingImg.style.left = `${btnRect.left + (btnRect.width/2) - 30}px`;
    flyingImg.style.top = `${btnRect.top - 30}px`;
    
    document.body.appendChild(flyingImg);

    // Р“Р°СЂР°РЅС‚РёСЂСѓРµРј, С‡С‚Рѕ Р±СЂР°СѓР·РµСЂ СЃРЅР°С‡Р°Р»Р° РѕС‚СЂРёСЃСѓРµС‚ СЃС‚Р°СЂС‚РѕРІСѓСЋ РїРѕР·РёС†РёСЋ, Р° С‚РѕР»СЊРєРѕ РїРѕС‚РѕРј РЅР°С‡РЅРµС‚ РґРІРёРіР°С‚СЊ
    requestAnimationFrame(() => {
        setTimeout(() => {
            // РљРѕРЅРµС‡РЅР°СЏ РїРѕР·РёС†РёСЏ (РІСЃРµРіРґР° РІ Р»РµРІС‹Р№ РЅРёР¶РЅРёР№ СѓРіРѕР» СЌРєСЂР°РЅР°, РєСѓРґР° РїСЂРёРµРґРµС‚ РєРѕСЂР·РёРЅР°)
            flyingImg.style.left = `20px`;
            flyingImg.style.top = `${window.innerHeight - 60}px`;
            
            // Р”РѕР±Р°РІРёР»Рё СЌС„С„РµРєС‚ РІСЂР°С‰РµРЅРёСЏ РІ РїРѕР»РµС‚Рµ (rotate(360deg))
            flyingImg.style.transform = 'scale(0.1) rotate(360deg)';
            flyingImg.style.opacity = '0.3';
        }, 10); 
    });

    // РЈРґР°Р»СЏРµРј СЌР»РµРјРµРЅС‚, РєРѕРіРґР° Р°РЅРёРјР°С†РёСЏ Р·Р°РєРѕРЅС‡РёС‚СЃСЏ (0.85s = 850ms)
    setTimeout(() => flyingImg.remove(), 850);
}

// --- РљР Р•РЎРўРРљ Р’ РџРћРРЎРљР• ---
function clearSearchInput() {
    const input = document.getElementById('mainSearch');
    if (input) input.value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    document.getElementById('liveSearchDropdown').style.display = 'none';
    document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();
    applyFilters();
}

// Р”РѕР±Р°РІР»СЏРµРј СЃР»СѓС€Р°С‚РµР»СЊ, С‡С‚РѕР±С‹ РєСЂРµСЃС‚РёРє РїРѕСЏРІР»СЏР»СЃСЏ РїСЂРё РІРІРѕРґРµ
const mainSearchInput = document.getElementById('mainSearch');
if (mainSearchInput) {
    mainSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveRecentSearch(this.value.trim());
            applyFilters();
            closeSearch();
        }
    });
    mainSearchInput.addEventListener('input', function() {
        document.getElementById('clearSearchBtn').style.display = this.value.length > 0 ? 'block' : 'none';
    });
    
    // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј Р°РЅРёРјР°С†РёСЋ РїСЂРё С„РѕРєСѓСЃРµ
    mainSearchInput.addEventListener('focus', () => {
        mainSearchInput.placeholder = i18next.t('search.placeholder') || 'РџРѕРёСЃРє...';
    });
    // Р’РѕР·РІСЂР°С‰Р°РµРј РїСЂРё РїРѕС‚РµСЂРµ С„РѕРєСѓСЃР°
    mainSearchInput.addEventListener('blur', () => {
        if (mainSearchInput.value.length === 0) startSearchTypewriter();
    });
}

// ==========================================
// 7. РР—Р‘Р РђРќРќРћР• (Р›РђР™РљР)
// ==========================================
async function loadFavorites() {
    if (!currentUser) return;
    const { data, error } = await _supabase.from('favorites').select('item_id').eq('user_id', currentUser.id);
    if (data && !error) {
        favorites = data.map(f => f.item_id);
        if(document.getElementById('profileLikesCount')) {
            document.getElementById('profileLikesCount').innerText = favorites.length;
        }
        if(document.getElementById('modalProfileLikesCount')) {
            document.getElementById('modalProfileLikesCount').innerText = favorites.length;
        }
    }
    updateFavBadge();
}

let isToggling = false; // Р—Р°С‰РёС‚Р° РѕС‚ РґРІРѕР№РЅРѕРіРѕ РєР»РёРєР° РЅР° С‚РµР»РµС„РѕРЅРµ

async function toggleFav(event, itemId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!currentUser) { 
        showToast(i18next.t('messages.cart_error_auth'), 'error'); 
        return; 
    }

    if (isToggling) return;
    isToggling = true;
    setTimeout(() => { isToggling = false; }, 300);

    // Р’Р«Р—Р«Р’РђР•Рњ Р’РР‘Р РђР¦РР®
    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    const isFav = favorites.includes(itemId);

    if (isFav) {
        favorites = favorites.filter(id => id !== itemId);
    } else {
        favorites.push(itemId);
    }

    // 2. Р–Р•РЎРўРљРћ РёС‰РµРј РЅСѓР¶РЅСѓСЋ Р·РІРµР·РґСѓ РІ СЃРµС‚РєРµ РїРѕ ID Рё РјРµРЅСЏРµРј РєР»Р°СЃСЃ + РЎР РђР—РЈ РљР РђРЎРРњ
    const gridStar = document.querySelector(`.item-card[data-id="${itemId}"] .fav-star`);
    if (gridStar) {
        if (isFav) {
            gridStar.classList.remove('active');
            gridStar.style.color = '#444'; // РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ СЃРµСЂС‹Р№
        } else {
            gridStar.classList.add('active');
            gridStar.style.color = 'var(--accent-red)'; // РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ РєСЂР°СЃРЅС‹Р№
        }
    }

    // Р–Р•РЎРўРљРћ РёС‰РµРј Р·РІРµР·РґСѓ РІ РјРѕРґР°Р»РєРµ (РµСЃР»Рё РѕС‚РєСЂС‹С‚ СЌС‚РѕС‚ С‚РѕРІР°СЂ)
    if (currentOpenedItem && currentOpenedItem.id === itemId) {
        const modalStar = document.getElementById('modalFavStar');
        if (modalStar) {
            if (isFav) {
                modalStar.classList.remove('active');
                modalStar.style.color = '#444';
            } else {
                modalStar.classList.add('active');
                modalStar.style.color = 'var(--accent-red)';
            }
        }
    }

    // РћР±РЅРѕРІР»СЏРµРј СЃС‡РµС‚С‡РёРєРё РјРіРЅРѕРІРµРЅРЅРѕ
    const profileLikes = document.getElementById('profileLikesCount');
    if (profileLikes) profileLikes.innerText = favorites.length;
    const modalProfileLikes = document.getElementById('modalProfileLikesCount');
    if (modalProfileLikes) modalProfileLikes.innerText = favorites.length;
    updateFavBadge();

    // 3. РўРёС…Рѕ РѕС‚РїСЂР°РІР»СЏРµРј РІ Р±Р°Р·Сѓ Рё РІС‹РІРѕРґРёРј РєСЂР°СЃРёРІРѕРµ СѓРІРµРґРѕРјР»РµРЅРёРµ СЃ С„РѕС‚Рѕ
    const itemObj = allItems.find(i => i.id === itemId);
    const imgUrl = itemObj ? getOptimizedImageUrl(itemObj, true) : null;

    try {
        if (isFav) {
            await _supabase.from('favorites').delete().match({ user_id: currentUser.id, item_id: itemId });
            showToast(i18next.t('messages.fav_remove'), 'success', imgUrl);
        } else {
            await _supabase.from('favorites').insert([{ user_id: currentUser.id, item_id: itemId }]);
            showToast(i18next.t('messages.fav_add'), 'success', imgUrl);
        }
    } catch (err) {
        console.error("РћС€РёР±РєР° Р»Р°Р№РєР°:", err);
    }
}

function updateFavBadge() { 
    const badge = document.getElementById('favCountBadge');
    if (badge) badge.innerText = `[${favorites.length}]`; 
}

function filterFavorites() { 
    if(!currentUser) { 
        showToast(i18next.t('messages.cart_error_auth'), 'error'); 
        return; 
    }
    showingOnlyFavs = !showingOnlyFavs; 
    sessionStorage.setItem('nisha_showing_favs', showingOnlyFavs); // Р—Р°РїРѕРјРёРЅР°РµРј
    document.getElementById('favNav').style.color = showingOnlyFavs ? '#fff' : 'var(--accent-yellow)'; 
    applyFilters(); 
}

// ==========================================
// 8. РљРћР Р—РРќРђ Р РЎРРќРҐР РћРќРР—РђР¦РРЇ
// ==========================================
async function syncCartToServer() {
    if (!currentUser) return;
    await _supabase.from('profiles').update({ cart: cart }).eq('id', currentUser.id);
}

async function addToCartFromModal() {
    if (!currentOpenedItem) return;
    
    // --- РџР РћР’Р•Р РљРђ РќРђ Р“РћРЎРўРЇ Р’ РњРћР”РђР›РљР• ---
    if (!currentUser) {
        showToast(i18next.t('messages.cart_error_auth', {defaultValue: 'РЎРЅР°С‡Р°Р»Р° РІРѕР№РґРёС‚Рµ РІ СЃРёСЃС‚РµРјСѓ!'}), 'error');
        closeModal('productModal'); // Р—Р°РєСЂС‹РІР°РµРј С‚РѕРІР°СЂ
        openProfileModal(); // РћС‚РєСЂС‹РІР°РµРј Р°РІС‚РѕСЂРёР·Р°С†РёСЋ
        return;
    }
    
    if (cart.some(i => i.id === currentOpenedItem.id)) { 
        showToast(i18next.t('messages.cart_exist'), 'error');
        return; 
    }
    
    let cartItem = { ...currentOpenedItem };
    if (isHacked) {
        cartItem.price = Math.floor(cartItem.price * 0.9);
    }
    cart.push(cartItem);
    
    localStorage.setItem('nisha_cart', JSON.stringify(cart));
    await syncCartToServer();
    
    updateCartUI();
    closeModal('productModal');
    showToast(i18next.t('messages.cart_add'), 'success')
}

function updateCartUI() {
    const p = document.getElementById('cartPanel');
    const fab = document.querySelector('.fab-propose');
    if (!p) return; 
    
    if (cart.length === 0) { 
        p.classList.remove('show'); 
        if(fab) {
            fab.classList.remove('cart-active'); 
            fab.classList.remove('hidden-scroll'); 
            fab.style.display = 'flex'; 
            fab.style.opacity = '1';
            fab.style.pointerEvents = 'auto';
        }
        return; 
    }
    
    p.classList.add('show'); 
    if(fab) fab.classList.add('cart-active'); 
    
    document.getElementById('cartCount').innerText = cart.length;
    let total = cart.reduce((sum, item) => sum + (parseInt(String(item.price).replace(/[^\d]/g, ''), 10) || 0), 0);
    
    // РџСЂРёРјРµРЅСЏРµРј СЃРєРёРґРєСѓ РїРѕ РїСЂРѕРјРѕРєРѕРґСѓ, РµСЃР»Рё РѕРЅР° РµСЃС‚СЊ
    if (typeof currentPromoDiscount !== 'undefined' && currentPromoDiscount > 0) {
        const savedMoney = Math.floor(total * currentPromoDiscount);
        total = total - savedMoney;
        
        const msg = document.getElementById('promoMessage');
        if (msg && appliedPromoCode) {
            msg.innerHTML = `<span style="color: var(--accent-green);">[вњ”] РљРѕРґ Р°РєС‚РёРІРёСЂРѕРІР°РЅ! РЎРєРёРґРєР° ${currentPromoDiscount * 100}%<br><span style="font-size: 13px;">Р’С‹ СЃСЌРєРѕРЅРѕРјРёР»Рё: <b>${savedMoney} ${getCurrency()}</b></span></span>`;
        }
    }
    
    document.getElementById('cartTotal').innerText = total + ' ' + getCurrency(); // Р—Р°РјРµРЅРёР»Рё Р¶РµСЃС‚РєРёРµ "РіСЂРЅ" РЅР° РјСѓР»СЊС‚РёСЏР·С‹С‡РЅС‹Рµ
    
    if (typeof renderCartItems === 'function') renderCartItems();
}

// ==========================================
// 9. РРќРўР•Р“Р РђР¦РРЇ РќРћР’РћР™ РџРћР§РўР« (NOVA POSHTA)
// ==========================================

let citySearchTimeout = null;
let selectedCityRef = '';
let selectedBranchRef = '';
let cachedBranches = []; 

function debouncedNPCitySearch(query) {
    if (citySearchTimeout) clearTimeout(citySearchTimeout);
    
    document.getElementById('orderBranch').value = ''; 
    document.getElementById('orderBranch').readOnly = true;
    selectedCityRef = '';
    selectedBranchRef = '';
    cachedBranches = [];
    
    const dropdown = document.getElementById('cityDropdown');

    if(query.length < 2) { 
        dropdown.style.display = 'none'; 
        return; 
    }
    
    citySearchTimeout = setTimeout(() => { 
        searchNPCity(query); 
    }, 500);
}

// --- РџРћРРЎРљ Р“РћР РћР”Рђ ---
async function searchNPCity(query) {
    try {
        const res = await fetch('https://nisha-api.onrender.com/api/np-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                modelName: 'Address', 
                calledMethod: 'searchSettlements', 
                methodProperties: { CityName: query, Limit: "10" } 
            })
        });
        const data = await res.json();
        const dropdown = document.getElementById('cityDropdown');
        dropdown.innerHTML = '';
        
        if(data.success && data.data[0] && data.data[0].Addresses.length > 0) {
            data.data[0].Addresses.forEach(city => {
                const div = document.createElement('div');
                div.innerText = city.Present;
                
                div.onmousedown = (e) => {
                    e.preventDefault();
                    document.getElementById('orderCity').value = city.Present;
                    selectedCityRef = city.DeliveryCity || city.Ref; 
                    dropdown.style.display = 'none';
                    
                    const branchInput = document.getElementById('orderBranch');
                    branchInput.readOnly = false;
                    branchInput.value = '';
                    branchInput.placeholder = "Р—Р°РіСЂСѓР·РєР° РѕС‚РґРµР»РµРЅРёР№...";
                    
                    cachedBranches = []; 
                    loadNPBranches();
                };
                dropdown.appendChild(div);
            });
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    } catch(e) { 
        console.error("РћС€РёР±РєР° РїРѕРёСЃРєР° РіРѕСЂРѕРґР° РќРџ", e); 
        document.getElementById('cityDropdown').style.display = 'none';
        showToast(i18next.t('np.city_err'), 'error');
    }
}

// --- РЈРњРќР«Р™ РџРћРРЎРљ РћРўР”Р•Р›Р•РќРР™ (Р§РµСЂРµР· API РќРѕРІРѕР№ РџРѕС‡С‚С‹ РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё) ---
let branchSearchTimeout = null;

// Р­С‚Р° С„СѓРЅРєС†РёСЏ СЃСЂР°Р±Р°С‚С‹РІР°РµС‚ РєР°Р¶РґС‹Р№ СЂР°Р·, РєРѕРіРґР° С‚С‹ РїРµС‡Р°С‚Р°РµС€СЊ РІ РїРѕР»Рµ "РћС‚РґРµР»РµРЅРёРµ"
function filterNPBranches(query) {
    const dropdown = document.getElementById('branchDropdown');
    
    // Р•СЃР»Рё РЅР°С‡Р°Р»Рё РїРµС‡Р°С‚Р°С‚СЊ, РїРѕРєР°Р·С‹РІР°РµРј СЃС‚Р°С‚СѓСЃ Р·Р°РіСЂСѓР·РєРё
    if (query.length > 0) {
        dropdown.innerHTML = '<div style="color:#aaa; padding:12px; font-style: italic;">РЁСѓРєР°С”РјРѕ РІС–РґРґС–Р»РµРЅРЅСЏ РІ Р±Р°Р·С– РќРџ...</div>';
        dropdown.style.display = 'block';
    }

    if (branchSearchTimeout) clearTimeout(branchSearchTimeout);
    
    // Р–РґРµРј 400РјСЃ, С‡С‚РѕР±С‹ РЅРµ СЃРїР°РјРёС‚СЊ Р·Р°РїСЂРѕСЃР°РјРё РЅР° РєР°Р¶РґСѓСЋ Р±СѓРєРІСѓ
    branchSearchTimeout = setTimeout(() => {
        loadNPBranches(query);
    }, 400);
}

const npBranchCache = {}; // РџР°РјСЏС‚СЊ РґР»СЏ РѕС‚РґРµР»РµРЅРёР№ РќРѕРІРѕР№ РџРѕС‡С‚С‹

// Р—Р°РїСЂРѕСЃ РІ РёРЅС‚РµСЂРЅРµС‚ Рє Р±Р°Р·Рµ РќРѕРІРѕР№ РџРѕС‡С‚С‹
async function loadNPBranches(searchString = "") {
    if (typeof searchString !== 'string') searchString = ""; 
    if(!selectedCityRef) return;
    
    const input = document.getElementById('orderBranch');
    const dropdown = document.getElementById('branchDropdown');

    // РљР­РЁРР РћР’РђРќРР•: Р¤РѕСЂРјРёСЂСѓРµРј СѓРЅРёРєР°Р»СЊРЅС‹Р№ РєР»СЋС‡ (Р“РѕСЂРѕРґ + Р’РІРµРґРµРЅРЅС‹Р№ С‚РµРєСЃС‚)
    const cacheKey = selectedCityRef + "_" + searchString.trim();
    if (npBranchCache[cacheKey]) {
        renderBranches(npBranchCache[cacheKey]); // РћС‚РґР°РµРј РёР· РїР°РјСЏС‚Рё Р·Р° 0.001 СЃРµРєСѓРЅРґС‹
        return;
    }

    try {
        // Р¤РѕСЂРјРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ
        const reqBody = {
            modelName: 'Address', 
            calledMethod: 'getWarehouses', 
            methodProperties: { 
                CityRef: selectedCityRef, 
                Limit: "50" // 50 С€С‚СѓРє Р·Р° РіР»Р°Р·Р° С…РІР°С‚Р°РµС‚ РґР»СЏ Р°РІС‚РѕРґРѕРїРѕР»РЅРµРЅРёСЏ
            } 
        };

        // Р•СЃР»Рё СЋР·РµСЂ РІРІРµР» С‚РµРєСЃС‚ (РЅР°РїСЂРёРјРµСЂ "245" РёР»Рё "РџРѕС€С‚РѕРјР°С‚"), РїРµСЂРµРґР°РµРј СЌС‚Рѕ РќРѕРІРѕР№ РџРѕС‡С‚Рµ!
        if (searchString.trim() !== "") {
            reqBody.methodProperties.FindByString = searchString.trim();
        }

        const res = await fetch('https://nisha-api.onrender.com/api/np-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
        });

        if (!res.ok) throw new Error("РЎРµС‚РµРІР°СЏ РѕС€РёР±РєР° HTTP " + res.status);

        const data = await res.json();
        
        if(data.success && Array.isArray(data.data) && data.data.length > 0) {
            npBranchCache[cacheKey] = data.data; // РЎРѕС…СЂР°РЅСЏРµРј РІ РїР°РјСЏС‚СЊ
            renderBranches(data.data);
        } else {
            dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">${i18next.t('np.branch_empty')}</div>`;
            dropdown.style.display = 'block';
        }
   } catch(e) { 
        console.error("РЎР±РѕР№ Р·Р°РіСЂСѓР·РєРё РѕС‚РґРµР»РµРЅРёР№ РќРџ:", e); 
        dropdown.innerHTML = `<div style="color:#ff6666; padding:12px; font-family:var(--font-mono); font-size:12px;">${i18next.t('np.branch_err')}</div>`;
        dropdown.style.display = 'block';
    }
}

// РћС‚СЂРёСЃРѕРІРєР° СЃРїРёСЃРєР°
function renderBranches(branches) {
    const dropdown = document.getElementById('branchDropdown');
    dropdown.innerHTML = '';
    
    if(branches.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    // Р’РђР–РќРћ: Р’С‹РєР»СЋС‡Р°РµРј РїРµСЂРµС…РІР°С‚ СЃРєСЂРѕР»Р»Р° Р±РёР±Р»РёРѕС‚РµРєРѕР№ Lenis РґР»СЏ СЌС‚РѕРіРѕ СЃРїРёСЃРєР°!
    dropdown.setAttribute('data-lenis-prevent', 'true');

    for (let i = 0; i < branches.length; i++) {
        const branch = branches[i];
        const isPostomat = branch.Description.includes("РџРѕС€С‚РѕРјР°С‚") || branch.Description.includes("РџРѕС‡С‚РѕРјР°С‚");
        const div = document.createElement('div');
        
        div.innerHTML = isPostomat ? `рџ“¦ <span style="color:#00aaff">${branch.Description}</span>` : branch.Description;

        div.onmousedown = (e) => {
            e.preventDefault(); 
            document.getElementById('orderBranch').value = branch.Description;
            selectedBranchRef = branch.Ref;
            dropdown.style.display = 'none';
            calculateDeliveryCost(); 
        };
        dropdown.appendChild(div);
    }
    
    dropdown.style.display = 'block';
}

// --- Р РђРЎР§Р•Рў РЎРўРћРРњРћРЎРўР Р”РћРЎРўРђР’РљР ---
// --- Р РђРЎР§Р•Рў РЎРўРћРРњРћРЎРўР Р”РћРЎРўРђР’РљР ---
async function calculateDeliveryCost() {
    if(!selectedCityRef || cart.length === 0) return;
    
    document.getElementById('deliveryCostInfo').style.display = 'block';
    document.getElementById('calcCostVal').innerText = "Р Р°СЃСЃС‡РёС‚С‹РІР°РµРј...";
    
    const getSafePrice = (price) => parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
    const totalCost = cart.reduce((sum, item) => sum + getSafePrice(item.price), 0);

    try {
        // Р—РђРџР РђРЁРР’РђР•Рњ Р“РћРўРћР’РЈР® Р¦Р•РќРЈ РЈ РќРђРЁР•Р“Рћ РЎР•Р Р’Р•Р Рђ
        const res = await fetch('https://nisha-api.onrender.com/api/calc-delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cityRef: selectedCityRef, cartTotal: totalCost })
        });
        const data = await res.json();
        
        if(data.success) {
            document.getElementById('calcCostVal').innerText = data.cost + " РіСЂРЅ";
        } else {
            document.getElementById('calcCostVal').innerText = "РџРѕ С‚Р°СЂРёС„Р°Рј РќРџ";
        }
    } catch(e) { 
        console.error("РћС€РёР±РєР° СЂР°СЃС‡РµС‚Р° РќРџ", e);
        document.getElementById('calcCostVal').innerText = "РџРѕ С‚Р°СЂРёС„Р°Рј РќРџ";
    }
}

// ==========================================
// Р›РћР“РРљРђ Р’РЎРџР›Р«Р’РђР®Р©Р•Р™ РљРћР Р—РРќР«
// ==========================================

function toggleCartDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('cartDropdown');
    const fab = document.querySelector('.fab-propose');
    if (dropdown) {
        dropdown.classList.toggle('active');
        // РџСЂСЏС‡РµРј РёР»Рё РїРѕРєР°Р·С‹РІР°РµРј РєРЅРѕРїРєСѓ [+] РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ СЃС‚Р°С‚СѓСЃР° РєРѕСЂР·РёРЅС‹
        if (fab) {
            if (dropdown.classList.contains('active')) {
                fab.style.opacity = '0';
                fab.style.pointerEvents = 'none';
            } else {
                fab.style.opacity = '1';
                fab.style.pointerEvents = 'auto';
            }
        }
    }
}
function renderCartItems() {
    const list = document.getElementById('cartDropdownList');
    if (!list) return;
    list.innerHTML = '';
    
    if (cart.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a; margin: 10px;">
                <div style="font-size: 30px; margin-bottom: 15px;">рџ›’</div>
                <div style="color:var(--accent-red); font-family: var(--font-mono); font-weight:bold; margin-bottom: 10px;">${i18next.t('cart.empty_title')}</div>
                <div style="color:#888; font-size: 12px; line-height: 1.5;">${i18next.t('cart.empty_desc')}</div>
            </div>`;
        return;
    }
    list.innerHTML = `
        <div style="padding: 10px; margin-bottom: 10px; border-bottom: 1px dashed #333; display: flex; flex-direction: column; gap: 10px;">
            <div style="color: #666; font-size: 10px; font-family: var(--font-main); text-align: center; margin-top: 5px;">
                ${i18next.t('cart.warning', {defaultValue: 'Р’РµС‰Рё РЅРµ Р±СЂРѕРЅРёСЂСѓСЋС‚СЃСЏ Рё РјРѕРіСѓС‚ Р±С‹С‚СЊ РєСѓРїР»РµРЅС‹ РєРµРј-С‚Рѕ РґСЂСѓРіРёРј РІ Р»СЋР±РѕР№ РјРѕРјРµРЅС‚.'})}
            </div>
        </div>
    `;

   cart.forEach((item, index) => {
        
        const imgUrl = getOptimizedImageUrl(item, true);
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        
        row.innerHTML = `
            <div class="swipe-background">
                <svg class="trash-icon" viewBox="0 0 24 24">
                    <!-- РљСЂС‹С€РєР° РєРѕСЂР·РёРЅС‹ -->
                    <path class="trash-lid" d="M3 6h18 M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    <!-- Р‘Р°Р·Р° РєРѕСЂР·РёРЅС‹ -->
                    <path class="trash-base" d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6 M10 11v6 M14 11v6"></path>
                </svg>
            </div>
            <div class="swipe-surface" 
                 data-index="${index}"
                 ontouchstart="handleSwipeStart(event)" 
                 ontouchmove="handleSwipeMove(event)" 
                 ontouchend="handleSwipeEnd(event)">
                <div class="cart-item-img" style="background-image: url('${imgUrl}')"></div>
                <div class="cart-item-info">
                    <div class="cart-item-name" title="${item.name}">${item.name}</div>
                    <div class="cart-item-size">${i18next.t('grid.size_prefix')}${item.size}</div>
                </div>
                <div class="cart-item-price-wrapper">
                    <div class="cart-item-price">${item.price} ${getCurrency()}</div>
                    <div class="cart-item-remove hide-on-mobile" onclick="removeFromCart(${index}, event, this.closest('.cart-item-row'))">Г—</div>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
}

async function removeFromCart(index, event, rowElement) {
    if (event) event.stopPropagation(); 
    
    // РЎРѕС…СЂР°РЅСЏРµРј РґР°РЅРЅС‹Рµ СѓРґР°Р»СЏРµРјРѕРіРѕ С‚РѕРІР°СЂР° РґР»СЏ СѓРІРµРґРѕРјР»РµРЅРёСЏ
    const removedItem = cart[index];
    const imgUrl = getOptimizedImageUrl(removedItem, true);

    const executeRemoval = async () => {
        // Р Р°РЅСЊС€Рµ РјС‹ С‚СѓС‚ СЃРЅРёРјР°Р»Рё Р±СЂРѕРЅСЊ, С‚РµРїРµСЂСЊ СЌС‚Рѕ РЅРµ РЅСѓР¶РЅРѕ, С‚Р°Рє РєР°Рє С‚РѕРІР°СЂ Рё РЅРµ Р±С‹Р» Р·Р°Р±СЂРѕРЅРёСЂРѕРІР°РЅ
        
        cart.splice(index, 1);
        localStorage.setItem('nisha_cart', JSON.stringify(cart));
        await syncCartToServer();
        updateCartUI(); 
        showToast(`${i18next.t('messages.cart_delete')}${removedItem.name}`, 'error', imgUrl);
        
        if (cart.length === 0) {
            const dropdown = document.getElementById('cartDropdown');
            if (dropdown) dropdown.classList.remove('active');
        }
    };

    // Р•СЃР»Рё РїРµСЂРµРґР°РЅ СЌР»РµРјРµРЅС‚ СЃС‚СЂРѕРєРё вЂ” СЃРЅР°С‡Р°Р»Р° РїР»Р°РІРЅРѕ СЃРєСЂС‹РІР°РµРј РµРіРѕ, РїРѕС‚РѕРј СѓРґР°Р»СЏРµРј
    if (rowElement) {
        rowElement.classList.add('removing');
        setTimeout(executeRemoval, 300); // Р–РґРµРј 0.3 СЃРµРє РїРѕРєР° Р·Р°РєРѕРЅС‡РёС‚СЃСЏ Р°РЅРёРјР°С†РёСЏ CSS
    } else {
        await executeRemoval();
    }
}



function closeCartDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('cartDropdown');
    const fab = document.querySelector('.fab-propose');
    if (dropdown) dropdown.classList.remove('active');
    if (fab) {
        fab.style.opacity = '1';
        fab.style.pointerEvents = 'auto';
    }
}

// Р•Р”РРќР«Р™ РћР‘Р РђР‘РћРўР§РРљ РљР›РРљРћР’ Р”Р›РЇ Р—РђРљР Р«РўРРЇ Р’РЎР•РҐ Р’Р«РџРђР”РђР®Р©РРҐ РЎРџРРЎРљРћР’
document.addEventListener('mousedown', (e) => {
    // Р—Р°РєСЂС‹С‚РёРµ СЃРїРёСЃРєР° РіРѕСЂРѕРґРѕРІ
    if (!e.target.closest('#orderCity') && !e.target.closest('#cityDropdown')) {
        const cd = document.getElementById('cityDropdown');
        if (cd) cd.style.display = 'none';
    }
    // Р—Р°РєСЂС‹С‚РёРµ СЃРїРёСЃРєР° РѕС‚РґРµР»РµРЅРёР№
    if (!e.target.closest('#orderBranch') && !e.target.closest('#branchDropdown')) {
        const bd = document.getElementById('branchDropdown');
        if (bd) bd.style.display = 'none';
    }
    // Р—Р°РєСЂС‹С‚РёРµ РєРѕСЂР·РёРЅС‹ (РјРѕР±РёР»СЊРЅР°СЏ РІРµСЂСЃРёСЏ)
    if (!e.target.closest('#cartInfoWrapper')) {
        const cartDrop = document.getElementById('cartDropdown');
        if (cartDrop && cartDrop.classList.contains('active')) {
            cartDrop.classList.remove('active');
            const fab = document.querySelector('.fab-propose');
            if (fab) {
                fab.style.opacity = '1';
                fab.style.pointerEvents = 'auto';
            }
        }
    }
    // Р—РђРљР Р«РўРР• РџР•Р Р•РљР›Р®Р§РђРўР•Р›РЇ РЇР—Р«РљРћР’
    if (!e.target.closest('#footerLangWrapper')) {
        const langWrap = document.getElementById('footerLangWrapper');
        if (langWrap) langWrap.classList.remove('active');
    }
});

// ==========================================
// 10. РћР¤РћР РњР›Р•РќРР• Р—РђРљРђР—Рђ (OTP + ANTI-SPAM)
// ==========================================
let otpVerified = false;
let otpInterval = null;

async function checkPhoneAuth() {
    const btnSubmit = document.getElementById('btnSubmitOrder');
    const btnOtp = document.getElementById('btnGetOtp');
    const statusOtp = document.getElementById('otpStatus');
    const rawPhone = document.getElementById('orderPhone').value;
    const cleanPhone = rawPhone.replace(/[^\d+]/g, ''); 

    // Р‘Р»РѕРєРёСЂСѓРµРј РєРЅРѕРїРєСѓ Р·Р°РєР°Р·Р° РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ
    otpVerified = false;
    btnSubmit.style.opacity = "0.5";
    btnSubmit.style.pointerEvents = "none";

    // Р•СЃР»Рё РЅРѕРјРµСЂ РєРѕСЂРѕС‚РєРёР№ - РїСЂРѕСЃС‚Рѕ РїРѕРєР°Р·С‹РІР°РµРј РєРЅРѕРїРєСѓ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ
    if (!cleanPhone || cleanPhone.length < 10) {
        if(btnOtp) {
            btnOtp.style.display = "block";
            btnOtp.disabled = false;
            btnOtp.innerHTML = "РџРѕРґС‚РІРµСЂРґРёС‚СЊ";
            btnOtp.style.background = "var(--text-main)";
            btnOtp.style.borderColor = "#eee";
            btnOtp.style.opacity = "1";
        }
        if(statusOtp) statusOtp.style.display = "block";
        return;
    }

    // Р•СЃР»Рё РЅРѕРјРµСЂ РІРІРµРґРµРЅ - РўРРҐРћ СЃРїСЂР°С€РёРІР°РµРј Сѓ Р±Р°Р·С‹: "Р­С‚РѕС‚ РЅРѕРјРµСЂ СѓР¶Рµ РїРѕРґС‚РІРµСЂР¶РґР°Р»Рё?"
    if (_supabase) {
        const { data: vResult } = await _supabase.rpc('check_otp_verified', { p_phone: cleanPhone });
    const existCode = vResult ? [{is_verified: true}] : [];
        
        if (existCode && existCode.length > 0 && existCode[0].is_verified) {
            // РќРѕРјРµСЂ РЈР–Р• РїРѕРґС‚РІРµСЂР¶РґРµРЅ! Р—РµР»РµРЅС‹Р№ СЃРІРµС‚.
            otpVerified = true;
            btnSubmit.style.opacity = "1";
            btnSubmit.style.pointerEvents = "auto";
            
            if(statusOtp) statusOtp.style.display = "none";
            if(btnOtp) {
                btnOtp.style.display = "block";
                btnOtp.disabled = true; 
                btnOtp.innerHTML = "<span style='color:var(--accent-green); font-weight:bold;'>РЈРЎРџР•РҐ!</span>";
                btnOtp.style.background = "var(--text-main)";
                btnOtp.style.borderColor = "var(--accent-green)";
                btnOtp.style.opacity = "1";
            }
        } else {
            // РќРѕРјРµСЂ РµСЃС‚СЊ, РЅРѕ РµС‰Рµ РќР• РїРѕРґС‚РІРµСЂР¶РґРµРЅ. Р–РґРµРј РЅР°Р¶Р°С‚РёСЏ.
            if(btnOtp) {
                btnOtp.style.display = "block";
                btnOtp.disabled = false;
                btnOtp.innerHTML = "РџРѕРґС‚РІРµСЂРґРёС‚СЊ";
                btnOtp.style.background = "var(--text-main)";
                btnOtp.style.borderColor = "#eee";
                btnOtp.style.opacity = "1";
            }
            if(statusOtp) statusOtp.style.display = "block";
        }
    }
}

let otpRealtimeChannel = null;

async function generateAndSendOTP() {
    const rawPhone = document.getElementById('orderPhone').value;
    const cleanPhone = rawPhone.replace(/[^\d+]/g, ''); 
    
    if(!cleanPhone || cleanPhone.length < 10) {
        showToast('Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°!', 'error');
        return;
    }

    const btnOtp = document.getElementById('btnGetOtp');
    if (btnOtp.disabled) return; // Р•СЃР»Рё СѓР¶Рµ Р·РµР»РµРЅС‹Р№ - РЅРёС‡РµРіРѕ РЅРµ РґРµР»Р°РµРј
    
    // Р‘Р»РѕРєРёСЂСѓРµРј РєРЅРѕРїРєСѓ РѕС‚ РґРІРѕР№РЅС‹С… РЅР°Р¶Р°С‚РёР№
    btnOtp.disabled = true;
    btnOtp.innerText = "РЎРІСЏР·СЊ СЃ Р‘Р”...";
    btnOtp.style.opacity = "0.5";

    // 1. РџСЂРѕРІРµСЂСЏРµРј Р§РµСЂРЅС‹Р№ РЎРїРёСЃРѕРє
    const { data: blacklisted } = await _supabase.from('blacklist').select('phone').eq('phone', cleanPhone).limit(1);
    if (blacklisted && blacklisted.length > 0) {
        document.getElementById('otpStatus').innerHTML = "<span style='color:red; font-weight:bold;'>[!] РћРЁРР‘РљРђ Р‘Р•Р—РћРџРђРЎРќРћРЎРўР. Р’РђРЁ РќРћРњР•Р  Р—РђР‘Р›РћРљРР РћР’РђРќ.</span>";
        showToast('Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰РµРЅ', 'error');
        btnOtp.innerText = "РџРѕРґС‚РІРµСЂРґРёС‚СЊ";
        return; 
    }
    
    // 2. РЎРЅРѕРІР° РїСЂРѕРІРµСЂСЏРµРј, РІРґСЂСѓРі РѕРЅ СѓР¶Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅ (РґРІРѕР№РЅР°СЏ СЃС‚СЂР°С…РѕРІРєР°)
    const { data: vResult } = await _supabase.rpc('check_otp_verified', { p_phone: cleanPhone });
    const existCode = vResult ? [{is_verified: true}] : [];
    if (existCode && existCode.length > 0 && existCode[0].is_verified) {
        checkPhoneAuth(); // РџСЂРѕСЃС‚Рѕ РІС‹Р·С‹РІР°РµРј UI-РѕР±РЅРѕРІР»РµРЅРёРµ
        return; 
    }

    // 3. Р—Р°РїСѓСЃРєР°РµРј РўР°Р№РјРµСЂ РѕР¶РёРґР°РЅРёСЏ (60 СЃРµРєСѓРЅРґ)
    let timer = 60;
    btnOtp.innerText = `Р–РґРёС‚Рµ ${timer}СЃ`;
    if (otpInterval) clearInterval(otpInterval);
    
    otpInterval = setInterval(() => {
        timer--;
        btnOtp.innerText = `Р–РґРёС‚Рµ ${timer}СЃ`;
        if (timer <= 0) {
            clearInterval(otpInterval);
            btnOtp.disabled = false;
            btnOtp.innerText = "РџРѕРґС‚РІРµСЂРґРёС‚СЊ";
            btnOtp.style.opacity = "1";
        }
    }, 1000);

    // 4. Р“РµРЅРµСЂРёСЂСѓРµРј РєРѕРґ РІ Р±Р°Р·Рµ
    const { error } = await _supabase.rpc('generate_secure_otp', { p_phone: cleanPhone });
    
    if (error) {
        showToast('РћС€РёР±РєР° СЃРµСЂРІРµСЂР°', 'error');
        clearInterval(otpInterval);
        btnOtp.disabled = false;
        btnOtp.innerText = "РџРѕРґС‚РІРµСЂРґРёС‚СЊ";
        return;
    }
    
    // 5. РћС‚РєСЂС‹РІР°РµРј Р±РѕС‚Р°
    const payloadPhone = cleanPhone.replace('+', '');
    const tgLink = `https://t.me/nisha_store1_bot?start=otp_${payloadPhone}`;
    
    if (/android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase())) {
        window.location.href = tgLink;
    } else {
        window.open(tgLink, '_blank');
    }
    
    document.getElementById('otpStatus').innerHTML = "РџРµСЂРµР№РґРёС‚Рµ РІ Р±РѕС‚Р° Рё РЅР°Р¶РјРёС‚Рµ 'РЎРўРђР Рў' РґР»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ... <span style='color:var(--accent-yellow)'>вЏі</span>";
    
    // 6. РЎР»СѓС€Р°РµРј РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё
    if (window.otpPollInterval) clearInterval(window.otpPollInterval);

    window.otpPollInterval = setInterval(async () => {
        const { data: isVerified } = await _supabase.rpc('check_otp_verified', { p_phone: cleanPhone });
        if (isVerified) {
            clearInterval(window.otpPollInterval);
            let id = window.setTimeout(function() {}, 0);
            while (id--) { window.clearTimeout(id); }
            checkPhoneAuth();
        }
    }, 2000);
}

async function openCheckoutModal() { 
    // 1. РќР°С…РѕРґРёРј РРњР•РќРќРћ РєРЅРѕРїРєСѓ "РћР¤РћР РњРРўР¬ Р—РђРљРђР—" РІРЅРёР·Сѓ РїР°РЅРµР»Рё РєРѕСЂР·РёРЅС‹
    const btn = document.querySelector('.cart-panel .cart-checkout-btn');
    if (!btn) return; // Р—Р°С‰РёС‚Р° РѕС‚ РѕС€РёР±РѕРє, РµСЃР»Рё РєРЅРѕРїРєР° РЅРµ РЅР°Р№РґРµРЅР°
    
    // РЎРѕС…СЂР°РЅСЏРµРј РѕСЂРёРіРёРЅР°Р»СЊРЅС‹Р№ С‚РµРєСЃС‚ Рё Р±Р»РѕРєРёСЂСѓРµРј РєРЅРѕРїРєСѓ
    const originalText = btn.innerText;
    btn.innerText = "[ РџР РћР’Р•Р РљРђ РќРђР›РР§РРЇ... ]";
    btn.style.pointerEvents = "none";

    // 2. Р‘Р«РЎРўР РђРЇ РџР РћР’Р•Р РљРђ: Рђ РІРґСЂСѓРі С‚РѕРІР°СЂ СѓР¶Рµ РєСѓРїРёР»Рё, РїРѕРєР° РѕРЅ Р»РµР¶Р°Р» РІ РєРѕСЂР·РёРЅРµ?
    const itemIds = cart.map(i => i.id);
    const { data: dbItems, error } = await _supabase.from('items').select('id, name, status').in('id', itemIds);

    let hasSoldItems = false;
    if (dbItems && !error) {
        // Р¤РёР»СЊС‚СЂСѓРµРј РєРѕСЂР·РёРЅСѓ, РѕСЃС‚Р°РІР»СЏСЏ С‚РѕР»СЊРєРѕ РґРѕСЃС‚СѓРїРЅС‹Рµ С‚РѕРІР°СЂС‹ (Рё Р·Р°Р±СЂРѕРЅРёСЂРѕРІР°РЅРЅС‹Рµ С‚РѕР±РѕР№)
        cart = cart.filter(cartItem => {
            const dbItem = dbItems.find(i => i.id === cartItem.id);
            // Р•СЃР»Рё С‚РѕРІР°СЂР° РЅРµС‚ РІ Р‘Р” РёР»Рё РµРіРѕ СЃС‚Р°С‚СѓСЃ 'sold' вЂ” СѓРґР°Р»СЏРµРј РёР· РєРѕСЂР·РёРЅС‹
            if (!dbItem || dbItem.status === 'sold') {
                showToast(`РўРѕРІР°СЂ "${cartItem.name}" СѓР¶Рµ РєС‚Рѕ-С‚Рѕ РєСѓРїРёР»! рџў`, 'error');
                hasSoldItems = true;
                return false; 
            }
            return true;
        });
    }

    if (hasSoldItems) {
        // Р•СЃР»Рё С‡С‚Рѕ-С‚Рѕ СѓРґР°Р»РёР»РѕСЃСЊ, РѕР±РЅРѕРІР»СЏРµРј РєРѕСЂР·РёРЅСѓ Рё РѕС‚РјРµРЅСЏРµРј РѕС‚РєСЂС‹С‚РёРµ РѕРєРЅР°
        localStorage.setItem('nisha_cart', JSON.stringify(cart));
        await syncCartToServer();
        updateCartUI();
        btn.innerText = originalText;
        btn.style.pointerEvents = "auto";
        if (cart.length === 0) closeCartDropdown();
        return; 
    }

    // Р•СЃР»Рё РІСЃС‘ РЅР° РјРµСЃС‚Рµ - РѕС‚РєСЂС‹РІР°РµРј РѕРєРЅРѕ РѕС„РѕСЂРјР»РµРЅРёСЏ
    btn.innerText = originalText;
    btn.style.pointerEvents = "auto";

    if (typeof lenis !== 'undefined') window.stopLenis();
    document.getElementById('checkoutModal').style.display = 'flex'; 
    document.body.style.overflow = 'hidden';
    
    // РђР’РўРћ-Р—РђРџРћР›РќР•РќРР• Р”РђРќРќР«РҐ РљР›РР•РќРўРђ (Seamless Checkout)
    const savedDataRaw = localStorage.getItem('nisha_checkout_data');
    if (savedDataRaw) {
        try {
            const saved = JSON.parse(savedDataRaw);
            document.getElementById('orderName').value = saved.name || '';
            document.getElementById('orderPhone').value = saved.phone || '';
            document.getElementById('orderCity').value = saved.city || '';
            document.getElementById('orderBranch').value = saved.branch || '';
            
            selectedCityRef = saved.cityRef || '';
            selectedBranchRef = saved.branchRef || '';
            
            // Р•СЃР»Рё РµСЃС‚СЊ С‚РµР»РµС„РѕРЅ - Р·Р°РїСѓСЃРєР°РµРј РїСЂРѕРІРµСЂРєСѓ РєРЅРѕРїРєРё
            if (saved.phone) checkPhoneAuth();
            
            // Р•СЃР»Рё РµСЃС‚СЊ РќРџ - СЃСЂР°Р·Сѓ СЃС‡РёС‚Р°РµРј РґРѕСЃС‚Р°РІРєСѓ!
            if (selectedCityRef && selectedBranchRef && cart.length > 0) {
                calculateDeliveryCost();
            }
        } catch(e) { autoDetectCity(); }
    } else {
        checkPhoneAuth();
        autoDetectCity(); // Р•СЃР»Рё РґР°РЅРЅС‹С… РЅРµС‚ - РѕРїСЂРµРґРµР»СЏРµРј РіРѕСЂРѕРґ РїРѕ IP
    }
}

async function submitOrder() {
    const botTrap = document.getElementById('botTrap');
    if (botTrap && botTrap.value !== "") return;

    if (!otpVerified) {
        showToast('РџРѕРґС‚РІРµСЂРґРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°!', 'error');
        return;
    }

    // Р‘Р•Р—РћРџРђРЎРќРђРЇ РћР§РРЎРўРљРђ Р”РђРќРќР«РҐ РћРў XSS-РђРўРђРљ
    const rawName = document.getElementById('orderName').value.trim();
    const rawCity = document.getElementById('orderCity').value.trim();
    const rawBranch = document.getElementById('orderBranch').value.trim();
    
    const name = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawName) : rawName;
    const city = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawCity) : rawCity;
    const branch = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawBranch) : rawBranch;

    const phoneRaw = document.getElementById('orderPhone').value;
    const phone = phoneRaw.replace(/[^\d+]/g, '');

    if(!name || !phone || !city || !branch) { 
        showToast(i18next.t('messages.req_fields'), 'error'); 
        return; 
    }

    // РќРћР’РђРЇ Р–Р•РЎРўРљРђРЇ Р’РђР›РР”РђР¦РРЇ РќРћР’РћР™ РџРћР§РўР«
    if (!selectedCityRef || !selectedBranchRef) {
        showToast('Р’С‹Р±РµСЂРёС‚Рµ Р“РѕСЂРѕРґ Рё РћС‚РґРµР»РµРЅРёРµ СЃС‚СЂРѕРіРѕ РёР· РІС‹РїР°РґР°СЋС‰РµРіРѕ СЃРїРёСЃРєР°!', 'error');
        return;
    }

    // РџР РћР’Р•Р РЇР•Рњ, Р—РђРџРћРњРќРР› Р›Р РЎРђР™Рў Р’Р«Р‘РћР  Р®Р—Р•Р Рђ Р РђРќР•Р•
    const savedEmailPreference = localStorage.getItem('nisha_email_preference');
    
    if (savedEmailPreference === 'skipped') {
        return await executeOrderFinal('');
    }
    if (savedEmailPreference && savedEmailPreference.includes('@')) {
        return await executeOrderFinal(savedEmailPreference);
    }

    if (currentUser && currentUser.email) {
        localStorage.setItem('nisha_email_preference', currentUser.email);
        return await executeOrderFinal(currentUser.email);
    }

    // Р•СЃР»Рё СЌС‚Рѕ Р“РћРЎРўР¬ (РЅРµ РІРѕС€РµР» РІ Р°РєРєР°СѓРЅС‚) Рё РґРµР»Р°РµС‚ Р·Р°РєР°Р· РІРїРµСЂРІС‹Рµ вЂ” С‚РѕРіРґР° СЃРїСЂР°С€РёРІР°РµРј
    const prompt = document.getElementById('emailPromptOverlay');
    const emailInput = document.getElementById('promptEmailInput');
    emailInput.value = '';
    prompt.style.display = 'flex';
}

async function confirmEmailPrompt(wantsEmail) {
    const prompt = document.getElementById('emailPromptOverlay');
    const emailInput = document.getElementById('promptEmailInput');
    let finalEmail = '';

    if (wantsEmail) {
        finalEmail = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(finalEmail)) {
            showToast('Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ E-mail!', 'error');
            return; 
        }
        // Р—Р°РїРѕРјРёРЅР°РµРј Email РЅР°РІСЃРµРіРґР°
        localStorage.setItem('nisha_email_preference', finalEmail);
    } else {
        // Р—Р°РїРѕРјРёРЅР°РµРј, С‡С‚Рѕ СЋР·РµСЂ РѕС‚РєР°Р·Р°Р»СЃСЏ
        localStorage.setItem('nisha_email_preference', 'skipped');
    }

    prompt.style.display = 'none'; 
    await executeOrderFinal(finalEmail); 
}

async function executeOrderFinal(emailToSave) {
    const btnSubmit = document.getElementById('btnSubmitOrder');
    
    // --- РљР РЈРўРћР™ РџР РћР“Р Р•РЎРЎ-Р‘РђР  Р—РђР“Р РЈР—РљР ---
    btnSubmit.style.pointerEvents = "none";
    btnSubmit.style.position = "relative";
    btnSubmit.style.overflow = "hidden";
    btnSubmit.style.color = "#000";
    btnSubmit.innerHTML = `
        <span style="position: relative; z-index: 2;">[ РћР‘Р РђР‘РћРўРљРђ Р”РђРќРќР«РҐ... ]</span>
        <div id="btnProgressBar" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: #fff; z-index: 1; transition: width 3s cubic-bezier(0.1, 0.7, 1.0, 0.1);"></div>
    `;
    
    // Р—Р°РїСѓСЃРєР°РµРј С„РµР№РєРѕРІСѓСЋ Р°РЅРёРјР°С†РёСЋ РґРѕ 90% (РѕСЃС‚Р°Р»СЊРЅС‹Рµ 10% Р·Р°РїРѕР»РЅСЏС‚СЃСЏ, РєРѕРіРґР° Р‘Р” РѕС‚РІРµС‚РёС‚)
    setTimeout(() => {
        const bar = document.getElementById('btnProgressBar');
        if(bar) bar.style.width = "90%";
    }, 50);
    // ------------------------------------

    const name = document.getElementById('orderName').value.trim();
    const phoneRaw = document.getElementById('orderPhone').value;
    const phone = phoneRaw.replace(/[^\d+]/g, '');
    const city = document.getElementById('orderCity').value.trim();
    const branch = document.getElementById('orderBranch').value.trim();

    const orderItemIds = cart.map(i => i.id);
    // РЎРћРҐР РђРќРЇР•Рњ Р”РђРќРќР«Р• РљР›РР•РќРўРђ РќРђ Р‘РЈР”РЈР©Р•Р•
    const checkoutData = {
        name: name,
        phone: phoneRaw,
        city: city,
        branch: branch,
        cityRef: selectedCityRef,
        branchRef: selectedBranchRef
    };
    localStorage.setItem('nisha_checkout_data', JSON.stringify(checkoutData));

    try {
        // Р’РђР–РќРћ: РїРµСЂРµРґР°РµРј p_email РІ Р±Р°Р·Сѓ!
        const { data: orderId, error: orderError } = await _supabase.rpc('create_secure_order', {
            p_user_id: currentUser ? currentUser.id : null,
            p_name: name,
            p_phone: phone,
            p_email: emailToSave,
            p_tg: '',
            p_city: city,
            p_branch: branch,
            p_city_ref: selectedCityRef || '',
            p_branch_ref: selectedBranchRef || '',
            p_item_ids: orderItemIds,
            p_promocode: appliedPromoCode || null
        });

        if (orderError) throw orderError; 

        // РЈРЎРџР•РЁРќР«Р™ Р—РђРљРђР—
        localStorage.setItem('nisha_last_phone', phone);
        localStorage.setItem('nisha_last_order', Date.now());

        cart = [];
        localStorage.setItem('nisha_cart', JSON.stringify([]));
        await syncCartToServer();
        
        updateCartUI();
        
        // Р”РѕР±РёРІР°РµРј РїСЂРѕРіСЂРµСЃСЃ-Р±Р°СЂ РґРѕ 100% РїРµСЂРµРґ Р·Р°РєСЂС‹С‚РёРµРј
        const bar = document.getElementById('btnProgressBar');
        if(bar) {
            bar.style.transition = "width 0.2s ease";
            bar.style.width = "100%";
        }

        setTimeout(() => {
            closeModal('checkoutModal');
            // Р’РѕР·РІСЂР°С‰Р°РµРј РєРЅРѕРїРєСѓ РІ РЅРѕСЂРјСѓ
            btnSubmit.innerHTML = i18next.t('checkout.btn_submit');
            
            // РџРѕРєР°Р·С‹РІР°РµРј С‚РµСЂРјРёРЅР°Р» СѓСЃРїРµС€РЅРѕРіРѕ Р·Р°РєР°Р·Р°
            const overlay = document.getElementById('orderSuccessOverlay');
            overlay.style.display = 'flex';
            
            setTimeout(() => { 
                overlay.style.display = 'none'; 
                loadAllItems(); 
                btnSubmit.style.pointerEvents = "auto";
                btnSubmit.style.opacity = "1";
            }, 3500);
        }, 300); // Р–РґРµРј С‚СЂРµС‚СЊ СЃРµРєСѓРЅРґС‹, С‡С‚РѕР±С‹ СЋР·РµСЂ СѓРІРёРґРµР» 100%
        

    } catch (err) {
        showToast('РћС€РёР±РєР° РїСЂРё РѕС„РѕСЂРјР»РµРЅРёРё: ' + err.message, 'error');
        btnSubmit.innerHTML = i18next.t('checkout.btn_submit');
        btnSubmit.style.pointerEvents = "auto";
        btnSubmit.style.opacity = "1";
        loadAllItems(); 
    }
}

// ==========================================
// 11. РњРћР Р—РђРљРђР—Р« (РРЎРўРћР РРЇ Р JSBARCODE)
// ==========================================
   function openOrdersModal() {

    document.getElementById('ordersModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (typeof lenis !== 'undefined') window.stopLenis(); 
    
    const guestInputGroup = document.getElementById('guestOrderInputGroup');
    const guestText = document.getElementById('guestOrderText');
    const listArea = document.getElementById('ordersListArea');

    if (currentUser) {
        if(guestInputGroup) guestInputGroup.style.display = 'none';
        
        // РЈРјРЅРѕРµ РїРѕР»СѓС‡РµРЅРёРµ РЅРёРєРЅРµР№РјР° (СЃРїР°СЃР°РµС‚ РѕС‚ Р·Р°РіР»СѓС€РєРё "User")
        let dName = userProfile?.username;
        if (!dName || dName === 'User') {
            dName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
        }
        
        if(guestText) guestText.innerHTML = `${i18next.t('orders_modal.access_granted', {defaultValue: 'Р”РѕСЃС‚СѓРї СЂР°Р·СЂРµС€РµРЅ'})}: <span style="color:var(--accent-green); font-weight:bold;">@${dName}</span>`;
        fetchMyOrders();
    } else {
        if(guestInputGroup) guestInputGroup.style.display = 'flex';
        if(guestText) guestText.innerHTML = 'Р’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°, СѓРєР°Р·Р°РЅРЅС‹Р№ РїСЂРё Р·Р°РєР°Р·Рµ, С‡С‚РѕР±С‹ РѕС‚СЃР»РµРґРёС‚СЊ СЃС‚Р°С‚СѓСЃ:';
        if(listArea) listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace; padding: 30px;">Р’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР° РґР»СЏ РїРѕРёСЃРєР°...</div>';

        const lastPhone = localStorage.getItem('nisha_last_phone');
        const phoneInput = document.getElementById('ordersSearchPhone');
        if (lastPhone && phoneInput && !phoneInput.value) {
            phoneInput.value = lastPhone;
        }
        if (phoneInput && phoneInput.value) {
            fetchMyOrders();
        }
    }
}

// Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ РґР»СЏ С„РёР»СЊС‚СЂР°С†РёРё Р·Р°РєР°Р·РѕРІ
let globalOrdersData = [];
let currentOrderTab = 'accepted'; // accepted, shipped, cancelled

async function fetchMyOrders() {
    const listArea = document.getElementById('ordersListArea');
    const tabsContainer = document.getElementById('ordersTabs');
    if(!listArea) return;
    
    listArea.innerHTML = '<div style="text-align:center; color:#aaa; font-family: monospace;">[ Р—РђР“Р РЈР—РљРђ Р‘РђР—Р« Р”РђРќРќР«РҐ... ]</div>';
    tabsContainer.style.display = 'none'; // РџСЂСЏС‡РµРј С‚Р°Р±С‹ РЅР° РІСЂРµРјСЏ Р·Р°РіСЂСѓР·РєРё

    let fetchError = null;

    if (currentUser) {
        const { data, error } = await _supabase.from('orders').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        globalOrdersData = data || []; 
        fetchError = error;
    } else {
        const phoneInput = document.getElementById('ordersSearchPhone');
        const phone = phoneInput ? phoneInput.value.replace(/[^\d+]/g, '') : '';
        if (!phone || phone.length < 10) { 
            showToast('Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°!', 'error'); 
            listArea.innerHTML = '<div style="text-align:center; color:#555; font-family: monospace;">[ РќРћРњР•Р  РќР• Р’Р’Р•Р”Р•Рќ ]</div>';
            return; 
        }

        const { data: vResult } = await _supabase.rpc('check_otp_verified', { p_phone: phone });
        const otpCheck = vResult ? [{is_verified: true}] : [];
        if (!otpCheck || otpCheck.length === 0 || !otpCheck[0].is_verified) {
            listArea.innerHTML = `<div style="text-align:center; color:var(--accent-red); font-family: monospace; padding: 20px;">[ Р”РћРЎРўРЈРџ Р—РђРџР Р•Р©Р•Рќ ]<br><br>РЎРЅР°С‡Р°Р»Р° РїРѕРґС‚РІРµСЂРґРёС‚Рµ, С‡С‚Рѕ СЌС‚Рѕ РІР°С€ РЅРѕРјРµСЂ.</div>
            <button class="cart-checkout-btn btn-target" style="margin: 0 auto; display: block;" onclick="document.getElementById('orderPhone').value='${phone}'; generateAndSendOTP();">РџРћР”РўР’Р•Р Р”РРўР¬ РќРћРњР•Р  Р’ Р‘РћРўР•</button>`;
            return;
        }

        const { data, error } = await _supabase.rpc('get_orders_by_phone', { search_phone: phone });
        globalOrdersData = data || []; 
        fetchError = error;
    }

    if (fetchError) { 
        listArea.innerHTML = `<div style="color:red; text-align:center;">[ РћРЁРР‘РљРђ: ${fetchError.message} ]</div>`; 
        return; 
    }

    if (globalOrdersData.length === 0) { 
        listArea.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; border: 1px dashed #333; background: #0a0a0a;">
                <div style="font-size: 30px; margin-bottom: 15px;">рџ“¦</div>
                <div style="color:var(--accent-red); font-family: var(--font-mono); font-weight:bold; margin-bottom: 10px;">${i18next.t('orders_modal.empty_title')}</div>
                <div style="color:#888; font-size: 13px; line-height: 1.5;">${i18next.t('orders_modal.empty_desc')}</div>
            </div>`; 
        return; 
    }

    // Р•СЃР»Рё РґР°РЅРЅС‹Рµ РµСЃС‚СЊ, РїРѕРєР°Р·С‹РІР°РµРј С‚Р°Р±С‹ Рё СЂРµРЅРґРµСЂРёРј
    tabsContainer.style.display = 'flex';
    
    // РЎР±СЂР°СЃС‹РІР°РµРј С‚Р°Р± РЅР° "РџСЂРёРЅСЏС‚С‹Рµ" РїСЂРё РЅРѕРІРѕРј РїРѕРёСЃРєРµ
    currentOrderTab = 'accepted';
    document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.order-tab.tab-yellow').classList.add('active');
    
    renderFilteredOrders();
}

window.switchOrderTab = function(tabName) {
    if (currentOrderTab === tabName) return; // РќРµ СЂРµРЅРґРµСЂРёРј, РµСЃР»Рё РЅР°Р¶Р°Р»Рё РЅР° С‚РѕС‚ Р¶Рµ С‚Р°Р±
    currentOrderTab = tabName;
    
    // РћР±РЅРѕРІР»СЏРµРј РєР»Р°СЃСЃС‹ Р°РєС‚РёРІРЅРѕСЃС‚Рё
    document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
    if (tabName === 'accepted') document.querySelector('.order-tab.tab-yellow').classList.add('active');
    if (tabName === 'shipped') document.querySelector('.order-tab.tab-blue').classList.add('active');
    if (tabName === 'cancelled') document.querySelector('.order-tab.tab-red').classList.add('active');
    
    renderFilteredOrders();
};

function renderFilteredOrders() {
    const listArea = document.getElementById('ordersListArea');
    listArea.innerHTML = ''; // РћС‡РёС‰Р°РµРј (Auto-animate СЃРґРµР»Р°РµС‚ РїР»Р°РІРЅРѕРµ РёСЃС‡РµР·РЅРѕРІРµРЅРёРµ/РїРѕСЏРІР»РµРЅРёРµ)

    // Р¤РёР»СЊС‚СЂСѓРµРј Р»РѕРєР°Р»СЊРЅРѕ
    const filteredData = globalOrdersData.filter(order => {
        const s = order.status.toLowerCase();
        if (currentOrderTab === 'accepted') return s.includes('РїСЂРёРЅСЏС‚') || s.includes('РѕРїР»Р°С‡РµРЅ');
        if (currentOrderTab === 'shipped') return s.includes('РѕС‚РїСЂР°РІР»РµРЅ') || s.includes('Р·Р°РІРµСЂС€РµРЅ');
        if (currentOrderTab === 'cancelled') return s.includes('РѕС‚РјРµРЅРµРЅ') || s.includes('РІРѕР·РІСЂР°С‚');
        return false;
    });

    if (filteredData.length === 0) {
        let emptyMsg = currentOrderTab === 'accepted' ? 'РќРµС‚ Р°РєС‚РёРІРЅС‹С… Р·Р°РєР°Р·РѕРІ.' : 
                       currentOrderTab === 'shipped' ? 'РќРµС‚ РѕС‚РїСЂР°РІР»РµРЅРЅС‹С… РїРѕСЃС‹Р»РѕРє.' : 'РќРµС‚ РѕС‚РјРµРЅРµРЅРЅС‹С… Р·Р°РєР°Р·РѕРІ.';
        listArea.innerHTML = `<div style="text-align:center; color:#666; font-family: monospace; padding: 30px;">[ ${emptyMsg} ]</div>`;
        return;
    }

    // Р РµРЅРґРµСЂРёРј РѕС‚С„РёР»СЊС‚СЂРѕРІР°РЅРЅС‹Рµ РєР°СЂС‚РѕС‡РєРё
    filteredData.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
        let itemsHtml = '';
        if (order.items && Array.isArray(order.items)) {
           order.items.forEach(item => {
                const imgStyle = item.image ? `background-image: url('${item.image}');` : '';
                itemsHtml += `
                    <div class="order-item-row" onclick="openProductModalById('${item.id}')" title="РћС‚РєСЂС‹С‚СЊ РєР°СЂС‚РѕС‡РєСѓ С‚РѕРІР°СЂР°">
                        <div class="order-item-img" style="${imgStyle}">${item.image ? '' : 'NO IMG'}</div>
                        <div class="order-item-details">
                            <div class="order-item-name">${item.name}</div>
                            <div class="order-item-meta"><span>Р Р°Р·РјРµСЂ: ${item.size}</span><span class="order-item-price">${item.currentPrice} РіСЂРЅ</span></div>
                        </div>
                    </div>`;
            });
        }

        const ttnHtml = order.tracking_number 
            ? `<div class="order-ttn">РўРўРќ: <span style="color:var(--accent-green); font-weight:bold;">${order.tracking_number}</span>
                 <div style="background:#fff; text-align:center; padding: 10px; margin-top: 10px; border-radius:4px;">
                     <svg class="barcode-svg" data-ttn="${order.tracking_number}"></svg>
                 </div>
               </div>` 
            : `<div class="order-ttn" style="color:#777;">РўРўРќ: РћР¶РёРґР°РµС‚СЃСЏ РіРµРЅРµСЂР°С†РёСЏ...</div>`;

        // --- Р›РћР“РРљРђ РљРќРћРџРљР РћРўР—Р«Р’Рђ ---
        let reviewBtnHtml = '';
        if (order.status.toLowerCase() === 'Р·Р°РІРµСЂС€РµРЅ') {
            let reviewedOrders = JSON.parse(localStorage.getItem('nisha_reviewed_orders') || '[]');
            
            if (!reviewedOrders.includes(order.id) && order.items && order.items.length > 0) {
                const firstItem = order.items[0];
                const safeName = firstItem.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const msgIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; position: relative; top: 2px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
                
                reviewBtnHtml = `
                    <div style="margin-top: 10px; cursor: pointer; color: var(--accent-green); font-size: 12px; font-family: var(--font-main); text-align: center; transition: 0.2s;" 
                         onclick="closeModal('ordersModal'); promptOrderReview('${order.id}', '${safeName}', '${firstItem.image}', '${firstItem.id}')" 
                         onmouseover="this.style.textDecoration='underline'; this.style.color='#fff';" 
                         onmouseout="this.style.textDecoration='none'; this.style.color='var(--accent-green)';">
                        ${msgIcon} РћСЃС‚Р°РІРёС‚СЊ РѕС‚Р·С‹РІ
                    </div>
                `;
            } else if (reviewedOrders.includes(order.id)) {
                // Р•СЃР»Рё РѕС‚Р·С‹РІ СѓР¶Рµ РѕСЃС‚Р°РІР»РµРЅ вЂ” РїРѕРєР°Р·С‹РІР°РµРј СЃРµСЂС‹Р№ С‚РµРєСЃС‚ (РЅРµРєР»РёРєР°Р±РµР»СЊРЅС‹Р№)
                reviewBtnHtml = `
                    <div style="margin-top: 10px; color: #555; font-size: 12px; font-family: var(--font-mono); text-align: center; pointer-events: none;">
                        [вњ”] РћРўР—Р«Р’ РћРЎРўРђР’Р›Р•Рќ
                    </div>
                `;
            }
        }

        // --- Р’РЎРўРђР’Р›РЇР•Рњ РљРќРћРџРљРЈ РћРўР—Р«Р’Рђ Р’ РљРђР РўРћР§РљРЈ ---
        listArea.innerHTML += `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-id">Р—РђРљРђР— #${order.id.split('-')[0].toUpperCase()} <span style="color:#666; font-weight:normal;">(${date})</span></span>
                    <span class="order-status status-${order.status}">${order.status.toUpperCase()}</span>
                </div>
                <div class="order-items-list">${itemsHtml}</div>
                ${reviewBtnHtml}
                <div class="order-footer">${ttnHtml}<div class="order-total">РРўРћР“Рћ: ${order.total_sum} РіСЂРЅ</div></div>
            </div>`;
    });

    // РџРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј С€С‚СЂРёС…РєРѕРґС‹
    if (typeof JsBarcode !== 'undefined') {
        document.querySelectorAll('.barcode-svg').forEach(svg => {
            const ttn = svg.getAttribute('data-ttn');
            if (ttn) {
                JsBarcode(svg, ttn, { format: "CODE128", lineColor: "#000", background: "transparent", width: 1.5, height: 50, displayValue: false });
            }
        });
    }
}
// ==========================================
// 12. РњРћР”РђР›РљРђ РўРћР’РђР Рђ & РџРћРҐРћР–РР• РўРћР’РђР Р« & PHOTOSWIPE
// ==========================================
async function openProductModalById(itemId) {
    let item = allItems.find(i => i.id === itemId);
    
    // РњР“РќРћР’Р•РќРќРћ РѕС‚РєСЂС‹РІР°РµРј РјРѕРґР°Р»РєСѓ, РµСЃР»Рё С‚РѕРІР°СЂ РµСЃС‚СЊ РІ РєСЌС€Рµ
    if (item) {
        const cardInGrid = document.querySelector(`.item-card[data-id="${itemId}"]`);
        if (cardInGrid) cardInGrid.classList.remove('unseen-pulse');

        let seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
        if (!seenItemsIds.includes(itemId)) {
            seenItemsIds.push(itemId);
            if (seenItemsIds.length > 500) seenItemsIds.shift(); 
            localStorage.setItem('nisha_seen_items', JSON.stringify(seenItemsIds));
        }

        closeModal('ordersModal'); 
        closeModal('reviewsModal'); 
        openProductModal(item); 
    }
    
    // Р’ Р¤РћРќР• РїРѕРґРіСЂСѓР¶Р°РµРј РїРѕР»РЅРѕРµ РѕРїРёСЃР°РЅРёРµ Рё Р·Р°РјРµСЂС‹
    if (typeof _supabase !== 'undefined') {
        try {
            let { data } = await _supabase.from('items').select('*').eq('id', itemId).limit(1);
            let fullItem = null;
            if (data && data.length > 0) {
                fullItem = data[0];
            } else {
                let { data: archData } = await _supabase.from('archived_items').select('*').eq('id', itemId).limit(1);
                if (archData && archData.length > 0) fullItem = archData[0];
            }
            
            // Р•СЃР»Рё С‚РѕРІР°СЂР° РЅРµ Р±С‹Р»Рѕ РІ РєСЌС€Рµ РІРѕРѕР±С‰Рµ (РїРµСЂРµС…РѕРґ РїРѕ РїСЂСЏРјРѕР№ СЃСЃС‹Р»РєРµ), РѕС‚РєСЂС‹РІР°РµРј СЃРµР№С‡Р°СЃ
            if (!item && fullItem) {
                openProductModal(fullItem);
                return;
            }
            
            // Р•СЃР»Рё РјРѕРґР°Р»РєР° РѕС‚РєСЂС‹С‚Р° Рё РјС‹ РґРѕРіСЂСѓР·РёР»Рё РѕРїРёСЃР°РЅРёРµ - РїСЂРѕСЃС‚Рѕ РІСЃС‚Р°РІР»СЏРµРј С‚РµРєСЃС‚
            if (fullItem && currentOpenedItem && currentOpenedItem.id === fullItem.id) {
                currentOpenedItem = fullItem;
                if (fullItem.description) {
                    const descText = fullItem.description ? fullItem.description.replace(/\n/g, '<br>') : `<span style="color:#666;">[ РћРїРёСЃР°РЅРёРµ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ ]</span>`;
                    const descContainer = document.querySelector('.modal-desc');
                    if (descContainer) {
                        // РћР±РЅРѕРІР»СЏРµРј С‚РµРєСЃС‚ РѕРїРёСЃР°РЅРёСЏ, РЅРµ С‚СЂРѕРіР°СЏ Q&A
                        descContainer.innerHTML = `
                            <div style="margin-bottom: 5px;">
                                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${i18next.t('product.size')}</span></strong> 
                                <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${fullItem.size}</span>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${i18next.t('product.brand')}</span></strong> 
                                <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${fullItem.brand}</span>
                            </div>
                            <div style="color: #aaa; font-size: 13px;">${descText}</div>
                        ` + (descContainer.innerHTML.substring(descContainer.innerHTML.indexOf('<!-- Р‘Р»РѕРє Р’РѕРїСЂРѕСЃРѕРІ Рё РћС‚РІРµС‚РѕРІ (Q&A) -->') !== -1 ? descContainer.innerHTML.indexOf('<!-- Р‘Р»РѕРє Р’РѕРїСЂРѕСЃРѕРІ Рё РћС‚РІРµС‚РѕРІ (Q&A) -->') : descContainer.innerHTML.indexOf('<div id="qaWrapper"')));
                    }
                }
            }
        } catch(e) { console.error("РћС€РёР±РєР° СЃРµС‚Рё:", e); }
    } else if (!item) {
        showToast('РўРѕРІР°СЂ РЅРµ РЅР°Р№РґРµРЅ', 'error'); 
    }
}

function openProductModal(item) {
    currentOpenedItem = item;
    if (typeof lenis !== 'undefined') window.stopLenis();
    document.title = `NISHA | ${item.brand} - ${item.name}`;
    
    document.getElementById('modalItemTitle').innerText = item.name;
    // РљСЂР°СЃРёРј Р·РІРµР·РґРѕС‡РєСѓ РІ РјРѕРґР°Р»РєРµ, РµСЃР»Рё С‚РѕРІР°СЂ СѓР¶Рµ РІ РёР·Р±СЂР°РЅРЅРѕРј
    const modalStar = document.getElementById('modalFavStar');
    if (modalStar) {
        if (favorites.includes(item.id)) {
            modalStar.classList.add('active');
        } else {
            modalStar.classList.remove('active');
        }
    }
    let finalPrice = isHacked ? Math.floor(item.price * 0.9) : item.price;
    document.getElementById('modalItemPrice').innerText = finalPrice + ' ' + getCurrency();
    document.getElementById('modalItemSizeDesc').innerText = item.size;
    document.getElementById('modalItemBrand').innerText = item.brand;
    
    const condStr = item.condition || '9 / 10';
    const condMatch = condStr.match(/(\d+)/);
    
    // РџРѕР»СѓС‡Р°РµРј СЃР°РјСѓ РѕС†РµРЅРєСѓ (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ 9)
    let condNum = 9;
    if (condMatch && condMatch[1]) condNum = parseInt(condMatch[1]);
    
    // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј С€РёСЂРёРЅСѓ РїРѕР»РѕСЃРєРё РІ РїСЂРѕС†РµРЅС‚Р°С…
    const condFill = document.getElementById('modalCondFill');
    condFill.style.width = (condNum * 10) + '%';
    
    // РџРѕР»СѓС‡Р°РµРј СЌР»РµРјРµРЅС‚ С‚РµРєСЃС‚Р° "9 / 10"
    const condText = document.getElementById('modalItemCond');
    condText.innerText = condStr;

    // РЈРјРЅР°СЏ СЂР°СЃРєСЂР°СЃРєР° РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ РѕС†РµРЅРєРё
    if (condNum <= 3) {
        condFill.style.backgroundColor = 'var(--accent-red)';
        condText.style.color = 'var(--accent-red)';
    } else if (condNum <= 6) {
        condFill.style.backgroundColor = '#ff9900'; // РћСЂР°РЅР¶РµРІС‹Р№
        condText.style.color = '#ff9900';
    } else if (condNum <= 8) {
        condFill.style.backgroundColor = 'var(--accent-yellow)';
        condText.style.color = 'var(--accent-yellow)';
    } else {
        condFill.style.backgroundColor = 'var(--accent-green)';
        condText.style.color = 'var(--accent-green)';
    }

    // --- Р Р•РќР”Р•Р  РҐР­РЁРўР•Р“РћР’ ---
    const tagsContainer = document.getElementById('modalItemTags');
    if (tagsContainer) {
        if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
            
            tagsContainer.innerHTML = item.tags.slice(0, 3).map(t => `<span style="color: #fff; margin-right: 12px; letter-spacing: 0.5px;">#${t}</span>`).join('');
            tagsContainer.style.display = 'block';
        } else {
            tagsContainer.style.display = 'none';
            tagsContainer.innerHTML = '';
        }
    }

    const descText = item.description ? item.description : "РћСЂРёРіРёРЅР°Р». Р›СЋР±С‹Рµ РїСЂРѕРІРµСЂРєРё. РћС‚Р»РёС‡РЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ. Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ Р·Р°РјРµСЂС‹ РїРѕ Р·Р°РїСЂРѕСЃСѓ РІ Р›РЎ.";
   
    document.querySelector('.modal-desc').innerHTML = `
        <div style="margin-bottom: 5px;">
            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.size">${i18next.t('product.size')}</span></strong> 
            <span id="modalItemSizeDesc" style="color: #ccc; margin-left: 5px;">${item.size}</span>
        </div>
        <div style="margin-bottom: 15px;">
            <strong style="color: #fff; font-family: var(--font-mono);"><span data-i18n="product.brand">${i18next.t('product.brand')}</span></strong> 
            <span id="modalItemBrand" style="color: #ccc; margin-left: 5px; text-transform: uppercase;">${item.brand}</span>
        </div>
        <div style="color: #aaa; font-size: 13px;">${descText}</div>
        
        <!-- Р‘Р›РћРљ Р’РћРџР РћРЎРћР’ Р РћРўР’Р•РўРћР’ (РђРљРљРћР Р”Р•РћРќ) -->
        <div id="qaWrapper" class="qa-wrapper">
            <h4 class="qa-title" onclick="document.getElementById('qaList').classList.toggle('collapsed'); this.querySelector('.qa-arrow').style.transform = document.getElementById('qaList').classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';">
                <span data-i18n="product.qa_title">${i18next.t('product.qa_title', {defaultValue: 'Q&A: Р’РѕРїСЂРѕСЃС‹ РїРѕРєСѓРїР°С‚РµР»РµР№'})}</span>
                <span class="qa-arrow" style="transition: transform 0.2s; color: var(--accent-green); display: inline-block;">в–ј</span>
            </h4>
            <div id="qaList" class="qa-content"></div>
        </div>

        <!-- РљРќРћРџРљРђ Р—РђР”РђРўР¬ Р’РћРџР РћРЎ -->
        <div style="margin-top: 15px; text-align: right;">
            <button onclick="toggleQuestionForm()" style="background: transparent; border: none; color: var(--accent-green); font-family: var(--font-mono); font-weight: bold; cursor: pointer; padding: 0; font-size: 13px; text-decoration: underline;" data-i18n="product.ask_btn">${i18next.t('product.ask_btn', {defaultValue: 'Р—Р°РґР°С‚СЊ РІРѕРїСЂРѕСЃ?'})}</button>
        </div>
        <div id="questionFormContainer" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; margin-top: 5px;">
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <input type="text" id="questionInput" class="form-input" placeholder="Р’Р°С€ РІРѕРїСЂРѕСЃ..." data-i18n-ph="product.ask_ph" style="font-size: 12px; padding: 8px;">
                <!-- РџРµСЂРµРґР°РµРј С‚РѕР»СЊРєРѕ ID, Р° РёРјСЏ РЅР°Р№РґРµРј РІРЅСѓС‚СЂРё JS -->
                <button class="search-btn btn-target" onclick="submitQuestion('${item.id}')" style="padding: 8px 15px; font-size: 12px;" data-i18n="product.ask_send">${i18next.t('product.ask_send', {defaultValue: 'РћРўРџР РђР’РРўР¬'})}</button>
            </div>
        </div>
    `;
   // --- Р—РђР©РР©Р•РќРќР«Р• РџР РћРЎРњРћРўР Р« РўРћР’РђР Рђ (Р–Р•Р›Р•Р—РћР‘Р•РўРћРќРќР«Р™ ANTI-SPAM) ---
    const viewCount = document.getElementById('modalItemViews');
    if (viewCount) {
        viewCount.innerText = item.views_count || 0; // РЎСЂР°Р·Сѓ РїРѕРєР°Р·С‹РІР°РµРј С‚Рѕ, С‡С‚Рѕ РµСЃС‚СЊ РІ РєСЌС€Рµ
        
        if (_supabase) {
            // Р”РѕСЃС‚Р°РµРј РјР°СЃСЃРёРІ С‚РµС… С‚РѕРІР°СЂРѕРІ, РєРѕС‚РѕСЂС‹Рј РјС‹ РЈР–Р• РїСЂРёР±Р°РІРёР»Рё РїСЂРѕСЃРјРѕС‚СЂ
            let viewedItems = JSON.parse(localStorage.getItem('nisha_added_views') || '[]');
            
            // Р•СЃР»Рё РјС‹ Р•Р©Р• РќР• СЃРјРѕС‚СЂРµР»Рё СЌС‚РѕС‚ С‚РѕРІР°СЂ -> РїСЂРёР±Р°РІР»СЏРµРј +1 РЅР° СЃРµСЂРІРµСЂРµ
            if (!viewedItems.includes(item.id)) {
                // Р“РµРЅРµСЂРёСЂСѓРµРј СѓРЅРёРєР°Р»СЊРЅС‹Р№ ID РєР»РёРµРЅС‚Р°, РµСЃР»Рё РµРіРѕ РЅРµС‚
                if (!clientFingerprint || clientFingerprint.startsWith('guest_')) {
                    clientFingerprint = localStorage.getItem('nisha_visitor_id') || 'user_' + Math.random().toString(36).substr(2, 9);
                }
                const viewerId = currentUser ? currentUser.id : clientFingerprint;
                
                _supabase.rpc('increment_item_views', { 
                    p_item_uuid: item.id, 
                    p_viewer_id: viewerId 
                }).then(({ data, error }) => {
                    if (!error && data !== null) {
                        viewCount.innerText = data; // РџРѕРєР°Р·С‹РІР°РµРј РЅРѕРІСѓСЋ С†РёС„СЂСѓ
                        item.views_count = data; // РЎРѕС…СЂР°РЅСЏРµРј РІ РїР°РјСЏС‚СЊ РјР°СЃСЃРёРІР°
                        
                        // Р—Р°РїРѕРјРёРЅР°РµРј, С‡С‚Рѕ РјС‹ СѓР¶Рµ РЅР°РєСЂСѓС‚РёР»Рё +1 СЌС‚РѕРјСѓ С‚РѕРІР°СЂСѓ
                        viewedItems.push(item.id);
                        localStorage.setItem('nisha_added_views', JSON.stringify(viewedItems));
                    }
                });
            } else {
                // Р•СЃР»Рё РјС‹ РЈР–Р• СЃРјРѕС‚СЂРµР»Рё РµРіРѕ СЂР°РЅСЊС€Рµ, РїСЂРѕСЃС‚Рѕ Р·Р°РїСЂР°С€РёРІР°РµРј Р°РєС‚СѓР°Р»СЊРЅСѓСЋ С†РёС„СЂСѓ (Р±РµР· РЅР°РєСЂСѓС‚РєРё)
                _supabase.from('items').select('views_count').eq('id', item.id).limit(1).then(({ data, error }) => {
                    if (!error && data && data.length > 0) {
                        viewCount.innerText = data[0].views_count || 0;
                        item.views_count = data[0].views_count || 0;
                    }
                });
            }
        }
    }

    const cartBtn = document.getElementById('modalCartBtn');
    
    if (item.status === 'sold') {
        if(cartBtn) cartBtn.style.display = 'none';
    } else {
        if(cartBtn) cartBtn.style.display = 'block';
    }

    const wrapper = document.getElementById('sliderWrapper');
    const thumbs = document.getElementById('modalThumbnails');
    wrapper.innerHTML = ''; 
    thumbs.innerHTML = '';
    
    
   // РџРѕРґРґРµСЂР¶РєР° Р¤РћРўРћ Рё Р’РР”Р•Рћ (.mp4)
   // РЎРєСЂС‹РІР°РµРј СЃС‚СЂРµР»РѕС‡РєРё, РµСЃР»Рё СЃР»Р°Р№Рґ С‚РѕР»СЊРєРѕ РѕРґРёРЅ
    const totalMedia = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails.length : (item.images ? item.images.length : 0);
    const prevBtn = document.querySelector('.slider-btn.prev');
    const nextBtn = document.querySelector('.slider-btn.next');
    
    if (totalMedia <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    } else {
        if (prevBtn) prevBtn.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'block';
    }

   // РџРѕРґРґРµСЂР¶РєР° Р¤РћРўРћ Рё Р’РР”Р•Рћ (.mp4)
    if (item.images && item.images.length > 0) {
        item.images.forEach((url, index) => {
            const cdnUrl = window.toCDN(url);
            const isVideo = cdnUrl.endsWith('.mp4');
            let currentThumb = (item.thumbnails && item.thumbnails[index]) ? window.toCDN(item.thumbnails[index]) : cdnUrl;
            
            if (isVideo && (!item.thumbnails || !item.thumbnails[index])) {
                currentThumb = 'https://via.placeholder.com/400x400.png?text=VIDEO&bg=000000&color=00ff00';
            }
            
            if (isVideo) {
                wrapper.innerHTML += `
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
                            oncanplay="this.style.opacity='1'; this.parentElement.classList.remove('img-8bit-loading');"
                        >
                            <source src="${url}#t=0.001" type="video/mp4">
                        </video>
                    </div>`;
            } else {
                // Р”РћР‘РђР’Р›РЇР•Рњ SKELETON: РџРѕРєР° С„РѕС‚Рѕ РіСЂСѓР·РёС‚СЃСЏ - СЃР»Р°Р№РґРµСЂ РєСЂР°СЃРёРІРѕ РїРµСЂРµР»РёРІР°РµС‚СЃСЏ
                wrapper.innerHTML += `
                    <a href="${url}" data-pswp-width="1000" data-pswp-height="1000" target="_blank" class="slide skeleton" style="background-image:none; display:flex; align-items:center; justify-content:center; border: 1px solid #222;">
                        <img src="${url}" loading="lazy" style="width:100%; height:100%; object-fit:contain; opacity:0; transition:opacity 0.4s ease-in-out;" 
                        onload="this.style.opacity='1'; this.parentElement.setAttribute('data-pswp-width', this.naturalWidth); this.parentElement.setAttribute('data-pswp-height', this.naturalHeight); this.parentElement.classList.remove('skeleton'); this.parentElement.style.border='none';">
                    </a>`;
            }
            
            thumbs.innerHTML += `<div class="thumb" style="background-image:url('${currentThumb}'); position:relative;" onclick="setSlide(${index})">${isVideo ? '<span style="position:absolute; font-size:24px; color:#fff; text-shadow:0 0 5px #000; left:50%; top:50%; transform:translate(-50%, -50%);">в–¶</span>' : ''}</div>`;
        });
    } else {
        wrapper.innerHTML = `<a class="slide" style="background:#111; pointer-events:none;">РќР•Рў Р¤РћРўРћ</a>`;
    }

    setSlide(0);

    // Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ РїРёРЅРѕРє РґР»СЏ Р·Р°РїСѓСЃРєР° РїР»РµРµСЂР°
    setTimeout(() => {
        const modalVideos = document.querySelectorAll('#sliderWrapper video.modal-video-player');
        modalVideos.forEach(vid => {
            let playPromise = vid.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Р•СЃР»Рё Р±СЂР°СѓР·РµСЂ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°Р» Р°РІС‚РѕРїР»РµР№, РѕРЅ С…РѕС‚СЏ Р±С‹ РїРѕРєР°Р¶РµС‚ РїРµСЂРІС‹Р№ РєР°РґСЂ Р±Р»Р°РіРѕРґР°СЂСЏ С…Р°РєСѓ #t=0.001
                    console.log("РћР¶РёРґР°РЅРёРµ РєР»РёРєР° (РїРѕР»РёС‚РёРєР° Р±СЂР°СѓР·РµСЂР°)");
                });
            }
        });
    }, 100);

    // РџРµСЂРµР·Р°РїСѓСЃРє PhotoSwipe РїРѕСЃР»Рµ РІСЃС‚Р°РІРєРё РЅРѕРІС‹С… РєР°СЂС‚РёРЅРѕРє
    if (window.pswpLightbox) {
        try { window.pswpLightbox.init(); } catch (e) {} 
    }

    const simCont = document.getElementById('similarItemsContainer');
    if (simCont) {
        simCont.innerHTML = '';
        
        // РЎС‡РёС‚С‹РІР°РµРј СЃРѕСЃС‚РѕСЏРЅРёРµ РіР°Р»РѕС‡РєРё "РЎРєСЂС‹С‚СЊ РїСЂРѕРґР°РЅРЅРѕРµ"
        const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;
        
        // Р¤РёР»СЊС‚СЂСѓРµРј РїРѕС…РѕР¶РёРµ С‚РѕРІР°СЂС‹ (СѓС‡РёС‚С‹РІР°СЏ СЃС‚Р°С‚СѓСЃ, РµСЃР»Рё РЅР°РґРѕ)
        let similar = allItems.filter(i => {
            if (i.id === item.id) return false; // РЎР°РјСѓ РѕС‚РєСЂС‹С‚СѓСЋ РІРµС‰СЊ РЅРµ РїРѕРєР°Р·С‹РІР°РµРј
            if (hideUnavailable && i.status !== 'available') return false; // РџСЂСЏС‡РµРј РїСЂРѕРґР°РЅРЅРѕРµ, РµСЃР»Рё СЃС‚РѕРёС‚ РіР°Р»РѕС‡РєР°
            return (i.category === item.category || i.brand === item.brand);
        });
        
        if (similar.length < 4) {
            const priceMargin = item.price * 0.3;
            const extra = allItems.filter(i => {
                if (i.id === item.id || similar.includes(i)) return false;
                if (hideUnavailable && i.status !== 'available') return false; // РџСЂСЏС‡РµРј РїСЂРѕРґР°РЅРЅРѕРµ, РµСЃР»Рё СЃС‚РѕРёС‚ РіР°Р»РѕС‡РєР°
                return i.price >= item.price - priceMargin && i.price <= item.price + priceMargin;
            });
            similar = [...similar, ...extra];
        }
        
        similar = similar.sort(() => 0.5 - Math.random()).slice(0, 4);
        
        // Р”РѕСЃС‚Р°РµРј РёСЃС‚РѕСЂРёСЋ РїСЂРѕСЃРјРѕС‚СЂРѕРІ, С‡С‚РѕР±С‹ РїСЂРѕРІРµСЂРёС‚СЊ, РІРёРґРµР» Р»Рё СЋР·РµСЂ СЌС‚Рё РїРѕС…РѕР¶РёРµ РІРµС‰Рё
        let seenItemsIds = JSON.parse(localStorage.getItem('nisha_seen_items') || '[]');
            
       if(similar.length > 0) {
            similar.forEach(s => {
                const sImg = getOptimizedImageUrl(s, true); 
                
                // 1. РњРРќР-Р‘Р•Р™Р”Р–Р (% SALE / HOT) - РѕСЃС‚Р°СЋС‚СЃСЏ РІ Р»РµРІРѕРј РІРµСЂС…РЅРµРј СѓРіР»Сѓ
                let miniBadgeHTML = '';
                const hasSale = s.is_sale;
                const hasHot = (s.views_count || 0) >= 25;
                const isTop = s.is_top === true && s.top_until && new Date(s.top_until).getTime() > Date.now();

                // Р‘РµР№РґР¶Рё SALE, HOT, TOP (С‚РѕР»СЊРєРѕ 'available')
                if ((hasSale || hasHot || isTop) && s.status === 'available') {
                    miniBadgeHTML = `<div style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; display: flex; align-items: center; gap: 4px; padding: 1px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none;">`;
                    if (isTop) {
                        miniBadgeHTML += `<span style="color: #cc00ff;"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: -1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> TOP</span>`;
                    }
                    if (isTop && (hasSale || hasHot)) miniBadgeHTML += `<div style="width: 1px; height: 8px; background: #888;"></div>`;
                    if (hasSale) miniBadgeHTML += `<span style="color: #cc0000;">% SALE</span>`;
                    if (hasSale && hasHot) miniBadgeHTML += `<div style="width: 1px; height: 8px; background: #888;"></div>`;
                    if (hasHot) {
                        miniBadgeHTML += `<span style="color: #0044cc;"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: -1px;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg> HOT</span>`;
                    }
                    miniBadgeHTML += `</div>`;
                }

                const curr = getCurrency();
                let miniPriceHTML = `${s.price} ${curr}`;
                if (s.is_sale && s.old_price) {
                    miniPriceHTML = `<span style="color: #4a704a; text-decoration: line-through; font-size: 9px; margin-right: 4px;">${s.old_price}</span><span style="color: var(--accent-green);">${s.price} ${curr}</span>`;
                }

                const isUnseen = !seenItemsIds.includes(s.id) && s.status === 'available';
                const pulseAnim = isUnseen ? 'animation: unseenPulseAnim 2s infinite alternate;' : '';
                const baseBorder = isUnseen ? 'var(--accent-red)' : '#333';

                // 2. Р›РћР“РРљРђ РћРўРћР‘Р РђР–Р•РќРРЇ SOLD / RESERVED
                let statusOverlayHTML = '';
                let imageFilter = '';

                if (s.status === 'sold') {
                    // РџР»Р°С€РєР° SOLD (РїРѕ С†РµРЅС‚СЂСѓ, С‡СѓС‚СЊ СѓРјРµРЅСЊС€РµРЅР° РґР»СЏ РјРёРЅРё-РєР°СЂС‚РѕС‡РµРє)
                    statusOverlayHTML = `<div class="sold-badge" style="font-size: 14px !important; letter-spacing: 2px !important; padding: 2px 8px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">SOLD</div>`;
                    imageFilter = 'filter: grayscale(80%) brightness(0.5);'; 
                    // РџРµСЂРµС‡РµСЂРєРёРІР°РµРј С†РµРЅСѓ, РµСЃР»Рё РІРµС‰СЊ РїСЂРѕРґР°РЅР°
                    miniPriceHTML = `<span style="color:#888; text-decoration:line-through;">${s.price} ${curr}</span>`;
                } else if (s.status === 'reserved') {
                    // РџР»Р°С€РєР° RESERVED
                    statusOverlayHTML = `<div class="reserved-badge" style="font-size: 11px !important; letter-spacing: 1px !important; padding: 2px 4px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">RESERVED</div>`;
                    imageFilter = 'filter: brightness(0.6);'; 
                }

                // 3. РЎР‘РћР РљРђ РљРђР РўРРќРљР РР›Р Р’РР”Р•Рћ (РќР°РґРµР¶РЅР°СЏ Р·Р°РіСЂСѓР·РєР°)
                let imageBlockHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#555; font-family:var(--font-mono); font-size:10px;">NO FOTO</div>`;
                
                if (sImg) {
                    if (sImg.endsWith('.mp4')) {
                        imageBlockHTML = `<video src="${sImg}#t=0.001" style="width:100%; height:100%; object-fit:cover; pointer-events:none; ${imageFilter} transition: 0.3s;" preload="metadata"></video>`;
                    } else {
                        // РСЃРїРѕР»СЊР·СѓРµРј СЂРµР°Р»СЊРЅС‹Р№ С‚РµРі <img> СЃ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРј РѕС€РёР±РѕРє (onerror) Рё РЅР°РєР»Р°РґС‹РІР°РµРј С„РёР»СЊС‚СЂ, РµСЃР»Рё РІРµС‰СЊ РїСЂРѕРґР°РЅР°
                        imageBlockHTML = `<img src="${sImg}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block; ${imageFilter} transition: 0.3s;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;font-family:var(--font-mono);\\'>ERROR</div>';">`;
                    }
                }

                // 4. Р¤РРќРђР›Р¬РќР«Р™ Р Р•РќР”Р•Р  РљРђР РўРћР§РљР
                simCont.innerHTML += `
                    <div style="min-width: 120px; cursor: pointer; border: 1px solid ${baseBorder}; background: #000; transition: 0.2s; ${pulseAnim} display:flex; flex-direction:column;" 
                         onmouseover="this.style.borderColor='var(--accent-green)'" 
                         onmouseout="this.style.borderColor='${baseBorder}'" 
                         onclick="openProductModalById('${s.id}')">
                        <div style="position: relative; height: 100px; width: 100%; overflow: hidden; background: #111;">
                            ${miniBadgeHTML}
                            ${statusOverlayHTML}
                            ${imageBlockHTML}
                        </div>
                        <div style="padding: 8px; font-size: 11px; color: #fff; font-family: var(--font-mono); text-align: center; margin-top: auto;">${miniPriceHTML}</div>
                    </div>`;
            });
        } else {
            simCont.innerHTML = '<div style="color:#555; font-size:12px; font-family: var(--font-mono);">РџРѕС…РѕР¶РёС… С‚РѕРІР°СЂРѕРІ РїРѕРєР° РЅРµС‚.</div>';
        }
    }
   // --- Р”РРќРђРњРР§Р•РЎРљРР• Р‘Р•Р™Р”Р–Р Р РџР РћР’Р•Р РљРђ РќРђ РџР Р•Р”Р›РћР–РљРЈ ---
    const badgesContainer = document.querySelector('.trust-badges');
    if (badgesContainer) {
        const isDropItem = item.is_drop === true || (item.tags && item.tags.map(t => t.toLowerCase()).includes('drop'));
        const isReturnable = item.is_returnable === true; 
        
        let refundBadgeHTML = '';
        
        if (isDropItem) {
            const alertSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
            refundBadgeHTML = `
                <div class="badge-item danger-badge" onclick="showBadgeInfo('drop')">
                    <span class="badge-icon">${alertSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_drop">${i18next.t('product.badge_drop')}</span>
                </div>`;
        } else if (isReturnable) {
            const returnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
            refundBadgeHTML = `
                <div class="badge-item" onclick="showBadgeInfo('refund_yes')">
                    <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${returnSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_refund">${i18next.t('product.badge_refund')}</span>
                </div>`;
        } else {
            const noReturnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><text x="12" y="16" font-family="monospace" font-size="12" font-weight="bold" fill="var(--accent-green)" text-anchor="middle" stroke="none">R</text></svg>`;
            refundBadgeHTML = `
                <div class="badge-item" onclick="showBadgeInfo('refund_no')">
                    <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${noReturnSvg}</span> 
                    <span class="badge-text" data-i18n="product.badge_norefund">${i18next.t('product.badge_norefund')}</span>
                </div>`;
        }

        const secureSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;

        badgesContainer.innerHTML = `
            <div class="badge-item" onclick="showBadgeInfo('secure')">
                <span class="badge-icon" style="background: transparent; padding: 0; display: flex;">${secureSvg}</span> 
                <span class="badge-text" data-i18n="product.badge_orig">${i18next.t('product.badge_orig')}</span>
            </div>
            <div class="badge-item" onclick="showBadgeInfo('fast')">
                <span class="badge-icon">24H</span> 
                <span class="badge-text" data-i18n="product.badge_fast">${i18next.t('product.badge_fast')}</span>
            </div>
            ${refundBadgeHTML}
        `;
    }

    document.getElementById('productModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const tw = document.getElementById('modalTypewriterTitle');
    if(tw) {
        tw.style.animation = 'none'; 
        tw.offsetHeight; 
        tw.style.animation = null;
    }

    addToHistory(item);

    const modalWin = document.querySelector('#productModal .modal-window');
    if (modalWin) {
        modalWin.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- РЈРњРќРђРЇ РћР§РРЎРўРљРђ URL ---
    // Р•СЃР»Рё РјС‹ РїРµСЂРµС€Р»Рё РїРѕ СЃСЃС‹Р»РєРµ РЅР° СЌС‚РѕС‚ С‚РѕРІР°СЂ, СЃС‚РёСЂР°РµРј ?item=... РёР· Р°РґСЂРµСЃРЅРѕР№ СЃС‚СЂРѕРєРё,
    // С‡С‚РѕР±С‹ РїСЂРё СЃР»РµРґСѓСЋС‰РµРј РѕР±РЅРѕРІР»РµРЅРёРё СЃС‚СЂР°РЅРёС†С‹ РѕРєРЅРѕ РЅРµ РІС‹Р»РµР·Р»Рѕ СЃРЅРѕРІР°.
    const url = new URL(window.location);
    if (url.searchParams.has('item')) {
        url.searchParams.delete('item');
        window.history.replaceState(null, '', url.pathname + url.search);
    }
    // Р—Р°РіСЂСѓР¶Р°РµРј РІРѕРїСЂРѕСЃС‹ Рё СЂРµРЅРґРµСЂРёРј
    if (_supabase) window.loadItemQuestions(item.id);

    // === SEO JSON-LD Р РђР—РњР•РўРљРђ Р”Р›РЇ GOOGLE ===
    let schemaScript = document.getElementById('seo-schema');
    if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'seo-schema';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
    }
    const schemaData = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": item.name,
        "image": (item.images && item.images.length > 0) ? item.images[0] : "",
        "description": item.description || item.name,
        "brand": { "@type": "Brand", "name": item.brand },
        "offers": {
            "@type": "Offer",
            "url": window.location.href,
            "priceCurrency": "UAH",
            "price": item.price,
            "availability": item.status === 'available' ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "itemCondition": "https://schema.org/UsedCondition"
        }
    };
    schemaScript.innerText = JSON.stringify(schemaData);

    // ==============================================================
    // Р”РРќРђРњРР§Р•РЎРљРћР• РћР‘РќРћР’Р›Р•РќРР• РўР•Р“РћР’ Р”Р›РЇ TELEGRAM Р Р”Р РЈР“РРҐ РњР•РЎРЎР•РќР”Р–Р•Р РћР’
    // ==============================================================
    const setMetaTag = (property, content) => {
        let tag = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            if (property.startsWith('og:')) tag.setAttribute('property', property);
            else tag.setAttribute('name', property);
            document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
    };

    let statusPrefix = item.status === 'sold' ? 'рџ”ґ SOLD | ' : (item.status === 'reserved' ? 'рџџЎ RESERVED | ' : 'рџџў ');
    let ogTitle = `${statusPrefix}NISHA: ${item.brand} - ${item.name}`;
    let ogDesc = `Р Р°Р·РјРµСЂ: ${item.size} | Р¦РµРЅР°: ${item.price} РіСЂРЅ`;
    let ogImage = (item.images && item.images.length > 0) ? item.images[0] : 'https://i.ibb.co/3s6HhXz/icon.ico';

    setMetaTag('og:title', ogTitle);
    setMetaTag('og:description', ogDesc);
    setMetaTag('og:image', ogImage);
    setMetaTag('twitter:title', ogTitle);
    setMetaTag('twitter:description', ogDesc);
    setMetaTag('twitter:image', ogImage);
}

let currentSlide = 0;
let totalSlides = 0; // Р”РѕР±Р°РІРёР»Рё РїРµСЂРµРјРµРЅРЅСѓСЋ

function moveSlide(step) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    currentSlide = (currentSlide + step + slides.length) % slides.length;
    updateSlider();
}

function setSlide(index) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    currentSlide = index;
    updateSlider();
}

function updateSlider() {
    const sliderWrapper = document.getElementById('sliderWrapper');
    if (!sliderWrapper) return; // РўСѓС‚ return Р»РµРіР°Р»РµРЅ, РѕРЅ РІРЅСѓС‚СЂРё С„СѓРЅРєС†РёРё

    sliderWrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    const counter = document.getElementById('photoCounter');
    const totalSlides = document.querySelectorAll('.slide').length;
    
    if (counter) {
        counter.innerText = `${currentSlide + 1} / ${totalSlides}`;
    }

    const thumbs = document.querySelectorAll('.thumb');
    thumbs.forEach((t, i) => { 
        if(i === currentSlide) t.classList.add('active-thumb'); 
        else t.classList.remove('active-thumb'); 
    });
}

// ==========================================
// 14. РРЎРўРћР РРЇ РџР РћРЎРњРћРўР РћР’ (HISTORY LOG)
// ==========================================
function addToHistory(item) {
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    hist = hist.filter(i => i.id !== item.id);
    const img = (item.images && item.images.length > 0) ? item.images[0] : '';
    
    // Р”РћР‘РђР’РР›Р is_sale Рё old_price РґР»СЏ РїСЂР°РІРёР»СЊРЅРѕРіРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ СЃРєРёРґРѕРє
    hist.unshift({ 
        id: item.id, 
        name: item.name, 
        price: item.price, 
        old_price: item.old_price, 
        is_sale: item.is_sale, 
        img: img 
    });
    
    if(hist.length > 8) hist.pop(); 
    
    localStorage.setItem('nisha_history', JSON.stringify(hist));
    renderHistory();
}

// ==========================================
// 14. РРЎРўРћР РРЇ РџР РћРЎРњРћРўР РћР’ (HISTORY LOG)
// ==========================================
function renderHistory() {
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    const container = document.getElementById('historyGrid');
    const section = document.getElementById('historySection');
    
    if(!container || !section) return;

    if (allItems.length > 0) {
        const validHist = hist.filter(h => allItems.some(dbItem => dbItem.id === h.id));
        if (validHist.length !== hist.length) {
            hist = validHist;
            localStorage.setItem('nisha_history', JSON.stringify(hist));
        }
    }
    
    if(hist.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    container.innerHTML = '';
    
    // РЎС‡РёС‚С‹РІР°РµРј СЃРѕСЃС‚РѕСЏРЅРёРµ РіР°Р»РѕС‡РєРё "РЎРєСЂС‹С‚СЊ РїСЂРѕРґР°РЅРЅРѕРµ"
    const hideUnavailable = document.getElementById('hideUnavailableCb') ? document.getElementById('hideUnavailableCb').checked : false;

    hist.forEach(h => {
        // --- РЈР—РќРђР•Рњ Р Р•РђР›Р¬РќР«Р™ РЎРўРђРўРЈРЎ Р’Р•Р©Р РР— Р‘РђР—Р« ---
        const realItem = allItems.find(i => i.id === h.id);
        const currentStatus = realItem ? realItem.status : 'available';

        // --- Р¤РРљРЎ: РџСЂСЏС‡РµРј РёР· РёСЃС‚РѕСЂРёРё, РµСЃР»Рё РЅР°Р¶Р°С‚Р° РіР°Р»РѕС‡РєР° "РЎРєСЂС‹С‚СЊ РїСЂРѕРґР°РЅРЅРѕРµ" ---
        if (hideUnavailable && currentStatus !== 'available') return; // РџСЂРѕСЃС‚Рѕ РїСЂРѕРїСѓСЃРєР°РµРј СЌС‚РѕС‚ С‚РѕРІР°СЂ!

        const optImg = h.img;
        const isVideo = optImg && optImg.endsWith('.mp4');
        
        let finalPriceHTML = '';
        const curr = getCurrency();
        if (h.is_sale && h.old_price) {
            finalPriceHTML = `<span style="color:#4a704a; text-decoration:line-through; font-size:10px; margin-right:4px;">${h.old_price}</span>${h.price} ${curr}`;
        } else {
            finalPriceHTML = `${h.price} ${curr}`;
        }

        // --- Р›РћР“РРљРђ РћРўРћР‘Р РђР–Р•РќРРЇ SOLD / RESERVED ---
        let statusOverlayHTML = '';
        let imageFilter = '';

        if (currentStatus === 'sold') {
            // РЈР±СЂР°Р»Рё translateZ Рё СЃРєРѕСЂСЂРµРєС‚РёСЂРѕРІР°Р»Рё РїРѕР·РёС†РёСЋ, С‡С‚РѕР±С‹ Р±С‹Р»Рѕ СЂРѕРІРЅРѕ РїРѕ С†РµРЅС‚СЂСѓ
            statusOverlayHTML = `<div class="sold-badge" style="font-size: 16px !important; letter-spacing: 2px !important; padding: 2px 10px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">SOLD</div>`;
            imageFilter = 'filter: grayscale(80%) brightness(0.5);'; 
        } else if (currentStatus === 'reserved') {
            statusOverlayHTML = `<div class="reserved-badge" style="font-size: 14px !important; letter-spacing: 1px !important; padding: 2px 5px !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) rotate(-15deg) !important; z-index: 10;">RESERVED</div>`;
        }

        const card = document.createElement('div');
        // РЈР±СЂР°Р»Рё РєР»Р°СЃСЃ sold-out СЃ СЃР°РјРѕР№ РєР°СЂС‚РѕС‡РєРё, С‡С‚РѕР±С‹ РєСЂРµСЃС‚РёРє Рё С†РµРЅР° РѕСЃС‚Р°РІР°Р»РёСЃСЊ СЏСЂРєРёРјРё!
        card.className = `history-card`;
        card.onclick = () => openProductModalById(h.id);
        
        let mediaHTML = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#555;">NO FOTO</div>';
        
        if (optImg) {
            if (isVideo) {
                mediaHTML = `
                    <video src="${optImg}#t=0.001" muted playsinline webkit-playsinline preload="metadata" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; ${imageFilter} transition: 0.3s;"></video>
                    <div style="position:absolute; z-index:5; top:4px; left:4px; background:rgba(0,0,0,0.8); padding:2px 4px; border-radius:2px; color:var(--accent-green); font-size:8px; font-family:var(--font-mono); border: 1px solid #333; pointer-events: none;">в–¶ VIDEO</div>
                `;
            } else {
                mediaHTML = `<div style="width:100%; height:100%; background-image:url('${optImg}'); background-size:cover; background-position:center; ${imageFilter} transition: 0.3s;"></div>`;
            }
        }
        
        let miniBadgeHTML = '';
        if (h.is_sale && currentStatus === 'available') {
            miniBadgeHTML = `<div style="position: absolute; top: 4px; left: 4px; z-index: 10; background: #c0c0c0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-bottom: 1px solid #555; border-right: 1px solid #555; box-shadow: 1px 1px 0px #000; padding: 1px 4px; font-family: 'Tahoma', sans-serif; font-size: 8px; font-weight: bold; pointer-events: none; color: #cc0000;">% SALE</div>`;
        }

        card.innerHTML = `
            <div class="history-img" style="position: relative; overflow: hidden; padding: 0; background: #111;">
                ${mediaHTML}
                ${miniBadgeHTML}
                ${statusOverlayHTML}
                <!-- РљСЂРµСЃС‚РёРє РІС‹РЅРµСЃРµРЅ РџРћР’Р•Р РҐ РІСЃРµРіРѕ Рё РЅРµ РїРѕРїР°РґР°РµС‚ РїРѕРґ С„РёР»СЊС‚СЂС‹! -->
                <div class="history-item-remove" onclick="removeHistoryItem(event, '${h.id}')" title="РЈРґР°Р»РёС‚СЊ" style="z-index: 20;">X</div>
            </div>
            <div class="history-info">
                <div class="history-name" title="${h.name}" style="${currentStatus !== 'available' ? 'color:#888; text-decoration:line-through;' : ''}">${h.name}</div>
                <div class="history-price">${finalPriceHTML}</div>
            </div>`;
            
        container.appendChild(card);

        if (typeof VanillaTilt !== 'undefined' && window.innerWidth > 900) {
            VanillaTilt.init(card, { max: 15, speed: 300, scale: 1.05 });
        }
    });

    if (currentUser && _supabase) {
        _supabase.from('profiles').update({ viewed_history: hist.map(h => h.id) }).eq('id', currentUser.id).then();
    }
}

function triggerEasterEgg() {
    isHacked = true;
    const overlay = document.getElementById('glitchOverlay');
    
    if (overlay) {
        document.getElementById('glitchMessage').innerHTML = "SYSTEM OVERRIDE<br>[ ACCESS GRANTED ]<br><span style='font-size: 20px; color:#fff; font-family: Tahoma;'>РЎРµРєСЂРµС‚РЅР°СЏ СЃРєРёРґРєР° -10% Р°РєС‚РёРІРёСЂРѕРІР°РЅР°</span>";
        overlay.style.display = 'flex';
        
        setTimeout(() => { 
            overlay.style.display = 'none'; 
        }, 2500);
    }
    
    applyFilters(); 
    
    cart.forEach(item => { 
        item.price = Math.floor(item.price * 0.9); 
    });
    localStorage.setItem('nisha_cart', JSON.stringify(cart));
    syncCartToServer();
    updateCartUI();
}
// ==========================================
// 16. РЎР§Р•РўР§РРљ РџРћРЎР•РўРРўР•Р›Р•Р™ (Р–Р•Р›Р•Р—РћР‘Р•РўРћРќРќР«Р• РЈРќРРљРђР›Р¬РќР«Р• Р—Рђ Р”Р•РќР¬)
// ==========================================
async function initHitCounter() {
    const counterEl = document.getElementById('hitCounterValue');
    if (!counterEl) return;

    try {
        // 1. Р”РѕР±С‹РІР°РµРј СѓРЅРёРєР°Р»СЊРЅС‹Р№ ID СѓСЃС‚СЂРѕР№СЃС‚РІР°
        let visitorId = localStorage.getItem('nisha_visitor_id');
        if (!visitorId) {
            visitorId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('nisha_visitor_id', visitorId);
        }
        clientFingerprint = visitorId; // Р”Р»СЏ Р·Р°С‰РёС‚С‹ РїСЂРѕСЃРјРѕС‚СЂРѕРІ РІ РєР°СЂС‚РѕС‡РєРµ С‚РѕРІР°СЂР°

        // 2. РЈР·РЅР°РµРј СЃРµРіРѕРґРЅСЏС€РЅСЋСЋ РґР°С‚Сѓ
        const todayDate = new Date().toLocaleDateString('en-CA'); // Р¤РѕСЂРјР°С‚ YYYY-MM-DD
        const lastVisitDate = localStorage.getItem('nisha_last_visit_date');

        // 3. РЎР РђР—РЈ РїРѕРєР°Р·С‹РІР°РµРј РїРѕСЃР»РµРґРЅСЋСЋ РёР·РІРµСЃС‚РЅСѓСЋ С†РёС„СЂСѓ РёР· РїР°РјСЏС‚Рё (С‡С‚РѕР±С‹ РЅРµ Р±С‹Р»Рѕ РЅСѓР»РµР№ РїСЂРё СЃС‚Р°СЂС‚Рµ)
        const cachedCount = localStorage.getItem('nisha_last_hit_count') || '0';
        counterEl.innerText = String(cachedCount).padStart(5, '0').split('').join(' ');

        // 4. РџСЂРѕРІРµСЂСЏРµРј, Р±С‹Р» Р»Рё СЋР·РµСЂ РўРЈРў РЎР•Р“РћР”РќРЇ
        const isNewVisitToday = (lastVisitDate !== todayDate);

        // 5. РћС‚РїСЂР°РІР»СЏРµРј Р·Р°РїСЂРѕСЃ РЅР° СЃРµСЂРІРµСЂ
        const res = await fetch('https://nisha-api.onrender.com/api/hit', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({ 
                date: todayDate,
                countAsNew: isNewVisitToday
            })
        });
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const data = await res.json();
        
        if (data && data.success && data.count !== undefined) {
            // Р•СЃР»Рё СЌС‚Рѕ Р±С‹Р» РЅРѕРІС‹Р№ РІРёР·РёС‚ вЂ” Р·Р°РїРѕРјРёРЅР°РµРј
            if (isNewVisitToday) {
                localStorage.setItem('nisha_last_visit_date', todayDate);
            }
            
            // РЎРѕС…СЂР°РЅСЏРµРј Р°РєС‚СѓР°Р»СЊРЅСѓСЋ С†РёС„СЂСѓ РґР»СЏ СЃР»РµРґСѓСЋС‰РёС… Р·Р°С…РѕРґРѕРІ
            localStorage.setItem('nisha_last_hit_count', data.count);
            
            // Р’С‹РІРѕРґРёРј СЃ РїСЂРѕР±РµР»Р°РјРё
            const strCount = data.count.toString().padStart(5, '0');
            counterEl.innerText = strCount.split('').join(' ');
        }
    } catch (err) {
        console.error("РЎС‡РµС‚С‡РёРє СЂР°Р±РѕС‚Р°РµС‚ РІ РѕС„С„Р»Р°Р№РЅ-СЂРµР¶РёРјРµ (РЎРµСЂРІРµСЂ СЃРїРёС‚):", err.message);
        // Р’РђР–РќРћ: РњС‹ Р±РѕР»СЊС€Рµ РЅРµ СЃС‚Р°РІРёРј С‚СѓС‚ '0 0 0 0 0'! 
        // Р®Р·РµСЂ РїСЂРѕСЃС‚Рѕ РїСЂРѕРґРѕР»Р¶РёС‚ РІРёРґРµС‚СЊ СЃС‚Р°СЂСѓСЋ С†РёС„СЂСѓ РёР· РєСЌС€Р° (С€Р°Рі 3), РїРѕРєР° СЃРµСЂРІРµСЂ РЅРµ РїСЂРѕСЃРЅРµС‚СЃСЏ.
    }
}
// ==========================================
// 17. UI Р¤РР›Р¬РўР РћР’ Р РњРћР‘РР›Р¬РќРћР• РњР•РќР®
// ==========================================
let priceTimeout;
function updatePriceUI() {
    let minInput = document.getElementById('priceMin');
    let maxInput = document.getElementById('priceMax');
    let minVal = parseInt(minInput.value);
    let maxVal = parseInt(maxInput.value);

    // Р—Р°С‰РёС‚Р°, С‡С‚РѕР±С‹ РїРѕР»Р·СѓРЅРєРё РЅРµ Р·Р°С…РѕРґРёР»Рё РґСЂСѓРі Р·Р° РґСЂСѓРіР°
    if (minVal >= maxVal) {
        if (event.target.id === 'priceMin') { minInput.value = maxVal - 100; minVal = maxVal - 100; }
        else { maxInput.value = minVal + 100; maxVal = minVal + 100; }
    }

    document.getElementById('priceMinVal').innerText = minVal;
    document.getElementById('priceMaxVal').innerText = maxVal;

    // Р РёСЃСѓРµРј Р·РµР»РµРЅСѓСЋ РїРѕР»РѕСЃРєСѓ РјРµР¶РґСѓ РїРѕР»Р·СѓРЅРєР°РјРё
    const percentMin = (minVal / 15000) * 100;
    const percentMax = (maxVal / 15000) * 100;
    document.getElementById('rangeFill').style.left = percentMin + '%';
    document.getElementById('rangeFill').style.right = (100 - percentMax) + '%';

    // РџСЂРёРјРµРЅСЏРµРј С„РёР»СЊС‚СЂ СЃ Р·Р°РґРµСЂР¶РєРѕР№ (С‡С‚РѕР±С‹ РЅРµ Р»Р°РіР°Р»Рѕ РїСЂРё РґРµСЂРіР°РЅРёРё РїРѕР»Р·СѓРЅРєР°)
    clearTimeout(priceTimeout);
    priceTimeout = setTimeout(() => { applyFilters(); }, 300);
}

function toggleMobileSidebar() {
    // Р’Р«Р—Р«Р’РђР•Рњ Р’РР‘Р РђР¦РР®
    if (typeof triggerHaptic === 'function') triggerHaptic('light');

    const sidebar = document.querySelector('.sidebar');
    const btn = document.getElementById('mobileFilterBtn');
    const fab = document.querySelector('.fab-propose'); 
    
    sidebar.classList.toggle('active-mobile');
    
    const hideText = i18next.t('mobile.hide_filters', { defaultValue: '[-] РЎРљР Р«РўР¬ Р¤РР›Р¬РўР Р«' });
    const showText = i18next.t('mobile.show_filters', { defaultValue: '[+] РџРћРљРђР—РђРўР¬ Р¤РР›Р¬РўР Р«' });

    if (sidebar.classList.contains('active-mobile')) {
        btn.innerText = hideText;
        btn.style.borderColor = 'var(--accent-red)';
        btn.style.color = 'var(--accent-red)';
        btn.style.background = '#111'; 
        
        // РџСЂСЏС‡РµРј РїСЂРµРґР»РѕР¶РєСѓ, С‡С‚РѕР±С‹ РЅРµ РјРµС€Р°Р»Р°
        if (fab) fab.style.display = 'none';
    } else {
        btn.innerText = showText;
        btn.style.borderColor = '#444';
        btn.style.color = 'var(--accent-green)';
        btn.style.background = '#050505'; 
        
        // Р’РѕР·РІСЂР°С‰Р°РµРј РїСЂРµРґР»РѕР¶РєСѓ
        if (fab) fab.style.display = 'flex';
    }
}
// Р—Р°РґРµСЂР¶РєР° РїРѕРёСЃРєР°, С‡С‚РѕР±С‹ РЅРµ Р»Р°РіР°Р»Рѕ РїСЂРё Р±С‹СЃС‚СЂРѕРј РІРІРѕРґРµ С‚РµРєСЃС‚Р°
let searchDebounce;
// Р¤СѓРЅРєС†РёСЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РёСЃС‚РѕСЂРёРё РїРѕРёСЃРєР°
function saveRecentSearch(term) {
    if (!term || term.length < 2) return;
    let history = JSON.parse(localStorage.getItem('nisha_search_history') || '[]');
    history = history.filter(t => t.toLowerCase() !== term.toLowerCase());
    history.unshift(term);
    if (history.length > 5) history.pop(); // РҐСЂР°РЅРёРј С‚РѕР»СЊРєРѕ 5 РїРѕСЃР»РµРґРЅРёС…
    localStorage.setItem('nisha_search_history', JSON.stringify(history));
}

// РћС‚РѕР±СЂР°Р¶РµРЅРёРµ РёСЃС‚РѕСЂРёРё РїРѕРёСЃРєР°
function showSearchHistory() {
    const dropdown = document.getElementById('liveSearchDropdown');
    let history = JSON.parse(localStorage.getItem('nisha_search_history') || '[]');
    if (history.length === 0) return;

    let html = `<div class="search-history-title">рџ•’ РќР•Р”РђР’РќРР• Р—РђРџР РћРЎР« <span class="search-history-clear" onclick="localStorage.removeItem('nisha_search_history'); closeSearch(); event.stopPropagation();">[ РћР§РРЎРўРРўР¬ ]</span></div>`;
    history.forEach(term => {
        const safeTerm = term.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        html += `<div class="search-history-item" onclick="document.getElementById('mainSearch').value='${safeTerm}'; handleLiveSearch();">
                    <span>> ${safeTerm}</span>
                 </div>`;
    });
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
    document.body.classList.add('search-lock'); if (typeof window.stopLenis === 'function') window.stopLenis();
}

function handleLiveSearch() {
    clearTimeout(searchDebounce);
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchInput = document.getElementById('mainSearch');
    const searchTerm = searchInput.value.trim();

    // Р•СЃР»Рё РїРѕР»Рµ РїСѓСЃС‚РѕРµ, РїРѕРєР°Р·С‹РІР°РµРј РёСЃС‚РѕСЂРёСЋ (Р»РµРЅС‚Сѓ РќР• С‚СЂРѕРіР°РµРј)
    if (searchTerm.length === 0) {
        showSearchHistory();
        return; 
    }

    if (searchTerm.length < 2) {
        // Р¤РРљРЎ: РџСЂРѕСЃС‚Рѕ РїСЂСЏС‡РµРј РїРѕРґСЃРєР°Р·РєРё, РЅРѕ РќР• РЈР‘РР’РђР•Рњ С„РѕРєСѓСЃ РєР»Р°РІРёР°С‚СѓСЂС‹!
        if (dropdown) dropdown.style.display = 'none';
        document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();
        return; 
    }

    searchDebounce = setTimeout(() => {
        // РЈР›РЈР§РЁР•РќРќР«Р™ РџРћРРЎРљ Р§Р•Р Р•Р— FUSE.JS Р”Р›РЇ Р’Р«РџРђР”РђР®Р©Р•Р“Рћ РЎРџРРЎРљРђ
        const cleanSearchTerm = searchTerm.replace(/#/g, '').trim().toLowerCase();
        const fuseOptions = {
            includeScore: true, 
            includeMatches: true, 
            threshold: 0.4, ignoreLocation: true, useExtendedSearch: true, 
            keys: [
                { name: 'tags', weight: 1.0 }, { name: 'brand', weight: 0.8 }, 
                { name: 'name', weight: 0.8 }, { name: 'size', weight: 0.8 }
            ]
        };
        const fuse = new Fuse(allItems, fuseOptions);
        const results = fuse.search(cleanSearchTerm).slice(0, 8); 

        dropdown.innerHTML = '';
        if (results.length > 0) {
            document.body.classList.add('search-lock'); if (typeof window.stopLenis === 'function') window.stopLenis();
            
            results.forEach(result => {
                const item = result.item;
                const img = (item.thumbnails && item.thumbnails.length > 0) ? item.thumbnails[0] : (item.images[0] || '');
                
                // РџРѕРґСЃРІРµС‚РєР° СЃРѕРІРїР°РґРµРЅРёР№ Р·РµР»РµРЅС‹Рј С†РІРµС‚РѕРј
                let highlightedName = item.name;
                if (result.matches) {
                    const nameMatch = result.matches.find(m => m.key === 'name');
                    if (nameMatch) {
                        let tempName = '';
                        let lastIdx = 0;
                        nameMatch.indices.forEach(([start, end]) => {
                            tempName += item.name.substring(lastIdx, start);
                            tempName += `<span style="color: var(--accent-green); background: rgba(0,255,0,0.1);">${item.name.substring(start, end + 1)}</span>`;
                            lastIdx = end + 1;
                        });
                        tempName += item.name.substring(lastIdx);
                        highlightedName = tempName;
                    }
                }

                dropdown.innerHTML += `
                    <div class="live-search-item" onclick="openProductModalById('${item.id}'); closeSearch();">
                        <div class="live-search-img" style="background-image: url('${img}')"></div>
                        <div class="live-search-info">
                            <span class="live-search-title">${highlightedName}</span>
                            <span class="live-search-price">${item.price} РіСЂРЅ</span>
                        </div>
                    </div>`;
            });
            dropdown.style.display = 'block';

            dropdown.ongetscroll = () => {}; 
            dropdown.addEventListener('touchstart', () => {
                if (document.activeElement === searchInput) searchInput.blur();
            }, {passive: true});

        } else {
            dropdown.innerHTML = '<div style="padding: 20px; color: #666; font-family: monospace; text-align: center;">[ РЎРћР’РџРђР”Р•РќРР™ РќР•Рў ]</div>';
            dropdown.style.display = 'block';
            document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();
        }
        
        // Р’РђР–РќРћ: РњС‹ СѓРґР°Р»РёР»Рё РѕС‚СЃСЋРґР° applyFilters()!
        // РўРµРїРµСЂСЊ Р»РµРЅС‚Р° РЅРµ Р±СѓРґРµС‚ РїСЂС‹РіР°С‚СЊ РІРѕ РІСЂРµРјСЏ РЅР°Р±РѕСЂР° С‚РµРєСЃС‚Р°.
    }, 300);
}

function closeSearch() {
    const dropdown = document.getElementById('liveSearchDropdown');
    const searchInput = document.getElementById('mainSearch');
    if (dropdown) dropdown.style.display = 'none';
    document.body.classList.remove('search-lock'); if (typeof window.startLenis === 'function') window.startLenis();
    if (searchInput) searchInput.blur(); // РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ РїСЂСЏС‡РµРј РєР»Р°РІРёР°С‚СѓСЂСѓ
}


document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        closeSearch(); // РСЃРїРѕР»СЊР·СѓРµРј РЅР°С€Сѓ РЅРѕРІСѓСЋ С„СѓРЅРєС†РёСЋ
    }
});
async function toggleFavFromModal(event) {
    if (!currentOpenedItem) return;
    
    // РЎРЅРёРјР°РµРј С„РѕРєСѓСЃ СЃ С‚РµР»РµС„РѕРЅР°, С‡С‚РѕР±С‹ РЅРµ Р·Р°Р»РёРїР°Р»Рѕ
    const modalStar = document.getElementById('modalFavStar');
    if (modalStar) modalStar.blur();

    // РџСЂРѕСЃС‚Рѕ РІС‹Р·С‹РІР°РµРј РіР»Р°РІРЅСѓСЋ Р·Р°С‰РёС‰РµРЅРЅСѓСЋ С„СѓРЅРєС†РёСЋ
    await toggleFav(event, currentOpenedItem.id);
}
// ==========================================
// РџР›РђР’РќР«Р• РђРљРљРћР Р”Р•РћРќР« (Р’ РњРћР”РђР›РљР• РўРћР’РђР Рђ)
// ==========================================
function toggleAccordion(element) {
    const parent = element.parentElement; // РџРѕР»СѓС‡Р°РµРј Р±Р»РѕРє .custom-details
    const isOpen = parent.classList.contains('open');
    
    // (РћРїС†РёРѕРЅР°Р»СЊРЅРѕ) Р—Р°РєСЂС‹РІР°РµРј РґСЂСѓРіРёРµ РѕС‚РєСЂС‹С‚С‹Рµ РІРєР»Р°РґРєРё, РµСЃР»Рё С…РѕС‡РµС€СЊ, С‡С‚РѕР±С‹ РѕС‚РєСЂС‹С‚РѕР№ Р±С‹Р»Р° С‚РѕР»СЊРєРѕ РѕРґРЅР°
    document.querySelectorAll('.custom-details').forEach(el => el.classList.remove('open'));
    
    // Р•СЃР»Рё РєР»РёРєРЅСѓР»Рё РїРѕ Р·Р°РєСЂС‹С‚РѕР№ - РѕС‚РєСЂС‹РІР°РµРј РµС‘
    if (!isOpen) {
        parent.classList.add('open');
    }
}
// ==========================================
// РЎРљР Р«РўРР•/РџРћРљРђР— РРЎРўРћР РР РџР РћРЎРњРћРўР РћР’ (РџР›РђР’РќРћ)
// ==========================================
function toggleHistory() {
    const grid = document.getElementById('historyGrid');
    const arrow = document.getElementById('historyArrow');
    
    // Р’РјРµСЃС‚Рѕ Р¶РµСЃС‚РєРѕРіРѕ display: none, РїСЂРѕСЃС‚Рѕ РґРѕР±Р°РІР»СЏРµРј/СѓР±РёСЂР°РµРј РєР»Р°СЃСЃ
    grid.classList.toggle('collapsed');
    
    if (grid.classList.contains('collapsed')) {
        arrow.style.transform = 'rotate(-90deg)'; // РЎС‚СЂРµР»РєР° РІР»РµРІРѕ (Р·Р°РєСЂС‹С‚Рѕ)
    } else {
        arrow.style.transform = 'rotate(0deg)';   // РЎС‚СЂРµР»РєР° РІРЅРёР· (РѕС‚РєСЂС‹С‚Рѕ)
    }
}
// ==========================================
// РЎР‘Р РћРЎ РќРђ Р“Р›РђР’РќРЈР® РЎРўР РђРќРР¦РЈ (Р¤РРљРЎ РР—Р‘Р РђРќРќРћР“Рћ)
// ==========================================
function resetToMain() {
    // 1. РЎРєСЂРѕР»Р»РёРј РЅР°РІРµСЂС…
    window.scrollTo(0,0);
    
    // 2. РЎР±СЂР°СЃС‹РІР°РµРј РіР»РѕР±Р°Р»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ
    currentCategory = '';
    currentBrand = '';
    showingOnlyFavs = false; // Р’Р«РљР›Р®Р§РђР•Рњ Р Р•Р–РРњ РР—Р‘Р РђРќРќРћР“Рћ
    
    // 3. РћС‡РёС‰Р°РµРј СЃС‚СЂРѕРєСѓ РїРѕРёСЃРєР°
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) searchInput.value = '';
    
    // 4. РЎРЅРёРјР°РµРј РіР°Р»РѕС‡РєРё СЃ СЂР°Р·РјРµСЂРѕРІ
    document.querySelectorAll('.size-cb').forEach(cb => cb.checked = false);
    
    // 5. Р’РѕР·РІСЂР°С‰Р°РµРј РєРЅРѕРїРєРµ "РР—Р‘Р РђРќРќРћР•" Р¶РµР»С‚С‹Р№ С†РІРµС‚ (РІС‹РєР»СЋС‡Р°РµРј Р±РµР»С‹Р№)
    const favNav = document.getElementById('favNav');
    if (favNav) favNav.style.color = 'var(--accent-yellow)';
    
    // 6. Р’РёР·СѓР°Р»СЊРЅРѕ РїРµСЂРµРєР»СЋС‡Р°РµРј Р°РєС‚РёРІРЅСѓСЋ РєР°С‚РµРіРѕСЂРёСЋ РІ СЃР°Р№РґР±Р°СЂРµ РЅР° "Р’СЃРµ РІРµС‰Рё"
    document.querySelectorAll('.sidebar .filter-list:first-of-type a').forEach(el => el.classList.remove('active-filter'));
    const allItemsLink = document.querySelector('.sidebar .filter-list:first-of-type a');
    if (allItemsLink) allItemsLink.classList.add('active-filter');

    // 7. РџСЂРёРјРµРЅСЏРµРј С„РёР»СЊС‚СЂС‹ (РїРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј СЃРµС‚РєСѓ)
    applyFilters();
}
// ==========================================
// PWA INSTALL BUTTON LOGIC
// ==========================================
let deferredPrompt;
const installBtn = document.getElementById('installAppBtn');

// Р‘СЂР°СѓР·РµСЂ СЃР°Рј СЂРµС€Р°РµС‚, РєРѕРіРґР° РїРѕРєР°Р·Р°С‚СЊ РїСЂРµРґР»РѕР¶РµРЅРёРµ СѓСЃС‚Р°РЅРѕРІРєРё. РњС‹ РµРіРѕ РїРµСЂРµС…РІР°С‚С‹РІР°РµРј.
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј СЃС‚Р°РЅРґР°СЂС‚РЅРѕРµ РІСЃРїР»С‹РІР°СЋС‰РµРµ РѕРєРЅРѕ Р±СЂР°СѓР·РµСЂР°
    deferredPrompt = e; // РЎРѕС…СЂР°РЅСЏРµРј СЃРѕР±С‹С‚РёРµ
    if(installBtn) installBtn.style.display = 'block'; // РџРѕРєР°Р·С‹РІР°РµРј РЅР°С€Сѓ Р·РµР»РµРЅСѓСЋ РєРЅРѕРїРєСѓ
});

if(installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt(); // РџРѕРєР°Р·С‹РІР°РµРј СЃРёСЃС‚РµРјРЅРѕРµ РѕРєРЅРѕ СѓСЃС‚Р°РЅРѕРІРєРё
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓСЃС‚Р°РЅРѕРІРёР» PWA');
            installBtn.style.display = 'none'; // РџСЂСЏС‡РµРј РєРЅРѕРїРєСѓ РїРѕСЃР»Рµ СѓСЃС‚Р°РЅРѕРІРєРё
        }
        deferredPrompt = null;
    });
}
// ==========================================
// РџРћР”Р•Р›РРўР¬РЎРЇ РўРћР’РђР РћРњ (NATIVE SHARE)
// ==========================================
function shareItem() {
    if (!currentOpenedItem) return;
    
    // Р’РѕР·РІСЂР°С‰Р°РµРј СЃСЃС‹Р»РєСѓ РЅР° РѕСЃРЅРѕРІРЅРѕР№ РґРѕРјРµРЅ (Р±РµР· РєСЂР°СЃРёРІС‹С… РїСЂРµРІСЊСЋ РІ Telegram)
    const shareUrl = `https://www.nisha-store.shop/share/${currentOpenedItem.id}`;
    const shareTitle = `NISHA | ${currentOpenedItem.brand} - ${currentOpenedItem.name}`;
    const shareText = `Р—Р°С†РµРЅРё: ${currentOpenedItem.brand} (${currentOpenedItem.size}).`;

    if (navigator.share) {
        navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
        }).catch((err) => {
            console.log('РЁРµСЂРёРЅРі РѕС‚РјРµРЅРµРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј');
        });
    } else {
        // Р•СЃР»Рё СЌС‚Рѕ РѕР±С‹С‡РЅС‹Р№ РџРљ РЅР° Windows (РєРѕРїРёСЂСѓРµРј СЃСЃС‹Р»РєСѓ)
        navigator.clipboard.writeText(shareUrl)
            .then(() => {
                const msg = typeof i18next !== 'undefined' ? i18next.t('messages.link_copied', {defaultValue: 'РЎСЃС‹Р»РєР° СЃРєРѕРїРёСЂРѕРІР°РЅР°!'}) : 'РЎСЃС‹Р»РєР° СЃРєРѕРїРёСЂРѕРІР°РЅР°!';
                showToast(msg, 'success');
            })
            .catch(() => {
                const msg = typeof i18next !== 'undefined' ? i18next.t('messages.copy_error', {defaultValue: 'РћС€РёР±РєР° РєРѕРїРёСЂРѕРІР°РЅРёСЏ'}) : 'РћС€РёР±РєР° РєРѕРїРёСЂРѕРІР°РЅРёСЏ';
                showToast(msg, 'error');
            });
    }
}
let currentPromoDiscount = 0; 
let appliedPromoCode = '';

async function applyPromoCode() {
    const input = document.getElementById('promoInput').value.trim().toUpperCase();
    const msg = document.getElementById('promoMessage');
    const btn = document.querySelector('.promo-wrapper button');

    if (!input) return;

    btn.innerText = '...';
    
    // РЎС‡РёС‚Р°РµРј РѕР±С‰СѓСЋ СЃСѓРјРјСѓ Р”Рћ СЃРєРёРґРєРё
    const originalTotal = cart.reduce((sum, item) => sum + item.price, 0);

    try {
        // РћС‚РїСЂР°РІР»СЏРµРј Р·Р°РїСЂРѕСЃ РЅР° РЅР°С€ Р‘СЌРєРµРЅРґ
        const res = await fetch('https://nisha-api.onrender.com/api/check-promo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: input, cartTotal: originalTotal })
        });
        
        const data = await res.json();

        // Р”РѕСЃС‚Р°РµРј Р°РєС‚СѓР°Р»СЊРЅС‹Р№ СЏР·С‹Рє, С‡С‚РѕР±С‹ РїРµСЂРµРІРѕРґС‹ РЅРµ Р·Р°РІРёСЃР°Р»Рё
        const currentLang = localStorage.getItem('nisha_lang') || 'ru';
        
        // РњРµРЅСЏРµРј СЏР·С‹Рє i18next РџР•Р Р•Р” РїРѕР»СѓС‡РµРЅРёРµРј РїРµСЂРµРІРѕРґР° (СЃС‚СЂР°С…РѕРІРєР°)
        if (i18next.language !== currentLang) {
            await i18next.changeLanguage(currentLang);
        }

        const savedText = i18next.t('checkout.saved');
        const successText = i18next.t('checkout.promo_success');
        const limitErrorText = i18next.t('checkout.promo_limit');
        const invalidErrorText = i18next.t('checkout.promo_invalid');
        const serverErrorText = i18next.t('checkout.promo_error');

        if (data.success) {
            currentPromoDiscount = data.discount_percent;
            appliedPromoCode = input;
            
            msg.innerHTML = `<span style="color: var(--accent-green);">[вњ”] ${successText} ${data.discount_percent * 100}%<br><span style="font-size: 13px;">${savedText}: <b>${data.saved_money} РіСЂРЅ</b></span></span>`;
        } else {
            currentPromoDiscount = 0;
            appliedPromoCode = '';
            
            let errorMsg = invalidErrorText;
            if (data.message && data.message.includes('Р›РёРјРёС‚')) {
                errorMsg = limitErrorText;
            }
            msg.innerHTML = `<span style="color: var(--accent-red);">[!] ${errorMsg}</span>`;
        }
    } catch (err) {
        msg.innerHTML = `<span style="color: var(--accent-red);">[!] ${i18next.t('checkout.promo_error')}</span>`;
    }
    
    btn.innerText = i18next.t('checkout.apply');
    updateCartUI();
}
// --- РРќРўР•Р РђРљРўРР’РќР«Р™ РЎР’РђР™Рџ Р”Р›РЇ РљРћР Р—РРќР« (Р’Р«Р‘Р РћРЎРРўР¬ РўРћР’РђР ) ---
let cartSwipeStartX = 0;
let cartSwipeCurrentX = 0;

window.handleSwipeStart = function(e) {
    cartSwipeStartX = e.touches[0].clientX;
    e.currentTarget.style.transition = 'none'; // РћС‚РєР»СЋС‡Р°РµРј РїР»Р°РІРЅРѕСЃС‚СЊ, С‡С‚РѕР±С‹ С‚РѕРІР°СЂ "РїСЂРёР»РёРї" Рє РїР°Р»СЊС†Сѓ
};

window.handleSwipeMove = function(e) {
    cartSwipeCurrentX = e.touches[0].clientX;
    let diff = cartSwipeStartX - cartSwipeCurrentX;
    
    if (diff > 0) {
        let moveX = diff > 200 ? 200 + (diff - 200) * 0.2 : diff;
        e.currentTarget.style.transform = `translateX(-${moveX}px)`;
        
        let surfaceOpacity = Math.max(0.2, 1 - (moveX / 200));
        e.currentTarget.style.opacity = surfaceOpacity;

        // --- РњРђР“РРЇ РљРћР Р—РРќР« ---
        const parentRow = e.currentTarget.closest('.cart-item-row');
        const trashIcon = parentRow.querySelector('.trash-icon');
        const trashLid = parentRow.querySelector('.trash-lid');
        
        if (trashIcon && trashLid) {
            // 1. РРєРѕРЅРєР° РїР»Р°РІРЅРѕ РїРѕСЏРІР»СЏРµС‚СЃСЏ РёР· С‚РµРјРЅРѕС‚С‹
            let bgOpacity = Math.min(1, moveX / 80); 
            trashIcon.style.opacity = bgOpacity;

            // 2. РљСЂС‹С€РєР° РїСЂРёРѕС‚РєСЂС‹РІР°РµС‚СЃСЏ (РґРѕ 45 РіСЂР°РґСѓСЃРѕРІ), РµСЃР»Рё РїРѕС‚СЏРЅСѓР»Рё РґР°Р»СЊС€Рµ 50px
            if (moveX > 50) {
                let openAngle = Math.min(45, (moveX - 50) * 0.6);
                trashLid.style.transform = `rotate(${openAngle}deg)`;
            } else {
                trashLid.style.transform = `rotate(0deg)`;
            }
        }
    }
};

window.handleSwipeEnd = function(e) {
    let diff = cartSwipeStartX - cartSwipeCurrentX;
    const rowSurface = e.currentTarget;
    const parentRow = rowSurface.closest('.cart-item-row');
    const itemIndex = parseInt(rowSurface.getAttribute('data-index'));
    
    // Р’РѕР·РІСЂР°С‰Р°РµРј РїР»Р°РІРЅСѓСЋ Р°РЅРёРјР°С†РёСЋ
    rowSurface.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    
    // Р•СЃР»Рё РїСЂРѕС‚Р°С‰РёР»Рё Р±РѕР»СЊС€Рµ 120 РїРёРєСЃРµР»РµР№ вЂ” РЈР”РђР›РЇР•Рњ
    if (diff > 120) {
        triggerHaptic('heavy');
        // РўРѕРІР°СЂ "СѓР»РµС‚Р°РµС‚" Р·Р° Р»РµРІС‹Р№ РєСЂР°Р№ СЌРєСЂР°РЅР°
        rowSurface.style.transform = `translateX(-150%)`;
        rowSurface.style.opacity = '0';
        
        // Р–РґРµРј 200РјСЃ, РїРѕРєР° РїСЂРѕРёРіСЂР°РµС‚ Р°РЅРёРјР°С†РёСЏ, Рё РѕРєРѕРЅС‡Р°С‚РµР»СЊРЅРѕ СѓРґР°Р»СЏРµРј РёР· Р±Р°Р·С‹
        setTimeout(() => {
            removeFromCart(itemIndex, null, parentRow);
        }, 200);
    } else {
        // Р•СЃР»Рё РЅРµ РґРѕС‚СЏРЅСѓР»Рё вЂ” РІРѕР·РІСЂР°С‰Р°РµРј РєР°СЂС‚РѕС‡РєСѓ РЅР° РјРµСЃС‚Рѕ
        rowSurface.style.transform = `translateX(0px)`;
        rowSurface.style.opacity = '1';
        
        // РџСЂСЏС‡РµРј РёРєРѕРЅРєСѓ Рё Р·Р°С…Р»РѕРїС‹РІР°РµРј РєСЂС‹С€РєСѓ
        const trashIcon = parentRow.querySelector('.trash-icon');
        const trashLid = parentRow.querySelector('.trash-lid');
        if (trashIcon) trashIcon.style.opacity = '0';
        if (trashLid) trashLid.style.transform = `rotate(0deg)`;
    }
    
    // РЎР±СЂР°СЃС‹РІР°РµРј РїРµСЂРµРјРµРЅРЅС‹Рµ
    cartSwipeStartX = 0;
    cartSwipeCurrentX = 0;
};
// ==========================================
// 18. ZERO-LAG РЎР’РђР™Рџ РљРђР РўРћР§РљР (РР”Р•РђР›Р¬РќРћР• РЎР›Р•Р”РћР’РђРќРР• Р—Рђ РџРђР›Р¬Р¦Р•Рњ)
// ==========================================
function initMobileSwipe() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        const modalWin = overlay.querySelector('.modal-window');
        if (!modalWin) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        let canDrag = false;

        modalWin.addEventListener('touchstart', (e) => {
                if (window.innerWidth > 900) return;
                
                // Р—РђР©РРўРђ: РћС‚РєР»СЋС‡Р°РµРј СЃРІР°Р№Рї РѕРєРЅР°, РµСЃР»Рё СЋР·РµСЂ Р»РёСЃС‚Р°РµС‚ СЃРїРёСЃРєРё РР›Р РџР•Р Р•РўРђРЎРљРР’РђР•Рў Р¤РћРўРћ
                if (document.body.classList.contains('sort-lock') || e.target.closest('.preview-container') || e.target.closest('.modal-gallery') || e.target.closest('.pswp') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('.rules-content') || e.target.closest('.orders-container') || e.target.closest('#reviewsContainerList')) {
                    canDrag = false;
                    return;
                }

                startY = e.touches[0].clientY;
            canDrag = (modalWin.scrollTop <= 0); 
            isDragging = false;

            modalWin.style.transition = 'none';
            overlay.style.transition = 'none';
        }, { passive: true });

        modalWin.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 900 || !canDrag) return;

            currentY = e.touches[0].clientY;
            const diffY = currentY - startY;

            if (diffY > 0) {
                isDragging = true;
                if (e.cancelable) e.preventDefault(); 
                
                // РСЃРїРѕР»СЊР·СѓРµРј requestAnimationFrame РґР»СЏ РјРіРЅРѕРІРµРЅРЅРѕР№ СЂРµР°РєС†РёРё СЌРєСЂР°РЅР° (Р±РµР· Р·Р°РґРµСЂР¶РµРє)
                requestAnimationFrame(() => {
                    modalWin.style.transform = `translateY(${diffY}px)`;
                    let opacity = 1 - (diffY / window.innerHeight);
                    overlay.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(0, opacity * 0.95)})`;
                });
            } else {
                isDragging = false;
                modalWin.style.transform = `translateY(0px)`;
            }
        }, { passive: false });

        modalWin.addEventListener('touchend', (e) => {
            if (window.innerWidth > 900) return;
            
            if (isDragging) {
                const diffY = currentY - startY;
                isDragging = false;
                canDrag = false;
                
                if (diffY > 150) { 
                    closeModal(overlay.id);
                } else {
                    modalWin.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    overlay.style.transition = 'background-color 0.3s ease';
                    modalWin.style.transform = `translateY(0px)`;
                    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
                }
            }
        });
    });
}
// ==========================================
// РџРћР›РќРђРЇ Р›РћР“РРљРђ РџР Р•Р”Р›РћР–РљР РўРћР’РђР РћР’ (DROP_ITEM.EXE)
// ==========================================

// 1. РћС‚РєСЂС‹С‚РёРµ РјРѕРґР°Р»СЊРЅРѕРіРѕ РѕРєРЅР° РїСЂРµРґР»РѕР¶РєРё
function openProposeModal() {
    if (typeof lenis !== 'undefined') window.stopLenis();
    const modal = document.getElementById('proposeModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// 2. РЎР¶Р°С‚РёРµ С„РѕС‚Рѕ (РЎРђРњРћР• РџР РћРЎРўРћР• Р Р›Р•Р“РљРћР• Р”Р›РЇ РџРђРњРЇРўР)
async function compressImage(file) {
    // 1. Р’РёРґРµРѕ РїСЂРѕСЃС‚Рѕ РїСЂРѕРїСѓСЃРєР°РµРј
    if (file.type.startsWith('video/')) return file;

    return new Promise((resolve) => {
        // 2. РЎРѕР·РґР°РµРј Р»РµРіРєСѓСЋ "СЃСЃС‹Р»РєСѓ" РЅР° С„Р°Р№Р» РІРЅСѓС‚СЂРё С‚РµР»РµС„РѕРЅР° (РЅРµ Р¶СЂРµС‚ RAM!)
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 1200; // Р–РјРµРј РґРѕ 1200px

            // РџСЂРѕРїРѕСЂС†РёРѕРЅР°Р»СЊРЅРѕ СѓРјРµРЅСЊС€Р°РµРј СЂР°Р·РјРµСЂС‹
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
                // РћР±СЏР·Р°С‚РµР»СЊРЅРѕ СѓРґР°Р»СЏРµРј "СЃСЃС‹Р»РєСѓ", С‡С‚РѕР±С‹ РѕС‡РёСЃС‚РёС‚СЊ РїР°РјСЏС‚СЊ
                URL.revokeObjectURL(objectUrl);
                
                // Р•СЃР»Рё РІСЃС‘ РѕРє - РѕС‚РґР°РµРј СЃР¶Р°С‚С‹Р№ С„Р°Р№Р»
                if (blob) {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                } else {
                    // РЎС‚СЂР°С…РѕРІРєР°: РµСЃР»Рё РєР°РЅРІР°СЃ РіР»СЋРєР°РЅСѓР», РѕС‚РґР°РµРј РѕСЂРёРіРёРЅР°Р», С‡С‚РѕР±С‹ РЅРµ Р±С‹Р»Рѕ РѕС€РёР±РєРё
                    resolve(file);
                }
            }, 'image/jpeg', 0.7);
        };

        img.onerror = () => {
            // РЎС‚СЂР°С…РѕРІРєР°: РµСЃР»Рё С„РѕСЂРјР°С‚ СЃС‚СЂР°РЅРЅС‹Р№ (РЅР°РїСЂРёРјРµСЂ Р°Р№С„РѕРЅРѕРІСЃРєРёР№ HEIC), 
            // РїСЂРѕСЃС‚Рѕ РїСЂРѕРїСѓСЃРєР°РµРј С„РѕС‚Рѕ Р±РµР· СЃР¶Р°С‚РёСЏ, С‡С‚РѕР±С‹ РЅРµ Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ СЋР·РµСЂР°!
            URL.revokeObjectURL(objectUrl);
            resolve(file); 
        };

        // Р—Р°РїСѓСЃРєР°РµРј РїСЂРѕС†РµСЃСЃ
        img.src = objectUrl;
    });
}

// --- Р“Р›РћР‘РђР›Р¬РќР«Р™ РњРђРЎРЎРР’ Р”Р›РЇ Р¤РћРўРћР“Р РђР¤РР™ РџР Р•Р”Р›РћР–РљР ---
let currentProposalFiles = []; // РўРµРїРµСЂСЊ С‚СѓС‚ Р±СѓРґСѓС‚ РѕР±СЉРµРєС‚С‹: { file, url }

// 3. РџРѕР»РЅР°СЏ РѕС‡РёСЃС‚РєР° С„РѕСЂРјС‹
function resetProposalForm() {
    const fields = ['propBrand', 'propSize', 'propCond', 'propPrice', 'propContact', 'propName', 'propDesc'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('propFiles').value = '';
    currentProposalFiles = [];
    renderProposalPreviews();
}

// --- РћР‘Р©РђРЇ Р¤РЈРќРљР¦РРЇ Р”РћР‘РђР’Р›Р•РќРРЇ Р¤РђР™Р›РћР’ ---
function handleNewProposalFiles(newFiles) {
    if (newFiles.length === 0) return;

    // РћСЃС‚Р°РІР»СЏРµРј С‚РѕР»СЊРєРѕ С„РѕС‚Рѕ Рё РІРёРґРµРѕ
    const validFiles = newFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));

    if (currentProposalFiles.length + validFiles.length > 5) {
        showToast('РњР°РєСЃРёРјСѓРј 5 С„РѕС‚Рѕ/РІРёРґРµРѕ!', 'error');
        return;
    }

    validFiles.forEach(file => {
        currentProposalFiles.push({
            file: file,
            url: file.type.startsWith('video/') ? null : URL.createObjectURL(file)
        });
    });
    
    renderProposalPreviews();
}

// 4. Р—Р°РіСЂСѓР·РєР° С‡РµСЂРµР· РєР»РёРє (РєРЅРѕРїРєР°)
document.getElementById('propFiles')?.addEventListener('change', function(e) {
    handleNewProposalFiles(Array.from(e.target.files));
    this.value = ''; 
});

// 5. DRAG & DROP (РџР•Р Р•РўРђРЎРљРР’РђРќРР• Р¤РђР™Р›РћР’ РЎ РџРљ Р’ Р‘Р РђРЈР—Р•Р )
const dropzone = document.getElementById('propDropzone');
if (dropzone) {
    // РћС‚РєР»СЋС‡Р°РµРј СЃС‚Р°РЅРґР°СЂС‚РЅРѕРµ РїРѕРІРµРґРµРЅРёРµ Р±СЂР°СѓР·РµСЂР° (С‡С‚РѕР±С‹ РѕРЅ РЅРµ РѕС‚РєСЂС‹РІР°Р» РєР°СЂС‚РёРЅРєСѓ РЅР° РІРµСЃСЊ СЌРєСЂР°РЅ)
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    // Р”РѕР±Р°РІР»СЏРµРј РєСЂР°СЃРёРІСѓСЋ Р·РµР»РµРЅСѓСЋ РїРѕРґСЃРІРµС‚РєСѓ, РєРѕРіРґР° С„Р°Р№Р» РЅР°Рґ Р·РѕРЅРѕР№
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('drag-active'), false);
    });

    // РЈР±РёСЂР°РµРј РїРѕРґСЃРІРµС‚РєСѓ
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('drag-active'), false);
    });

    // Р›РѕРІРёРј С„Р°Р№Р»С‹ РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё РјС‹С€РєРё
    dropzone.addEventListener('drop', e => {
        const droppedFiles = Array.from(e.dataTransfer.files);
        handleNewProposalFiles(droppedFiles);
    });
}

// Р“Р»РѕР±Р°Р»СЊРЅР°СЏ РїРµСЂРµРјРµРЅРЅР°СЏ РґР»СЏ С…СЂР°РЅРµРЅРёСЏ СЃРѕСЂС‚РёСЂРѕРІС‰РёРєР° (С‡С‚РѕР±С‹ РЅРµ Р±С‹Р»Рѕ Р»Р°РіРѕРІ)
let proposalSortable = null;

// 6. РћС‚СЂРёСЃРѕРІРєР° РїСЂРµРІСЊСЋ СЃ РР”Р•РђР›Р¬РќР«Рњ РџР•Р Р•РўРђРЎРљРР’РђРќРР•Рњ Р РљР›РРљРћРњ
function renderProposalPreviews() {
    const container = document.getElementById('propPreviewContainer');
    const placeholder = document.getElementById('propPlaceholder');
    container.innerHTML = '';

    if (currentProposalFiles.length > 0) {
        placeholder.style.display = 'none';

        currentProposalFiles.forEach((item, index) => {
            const img = document.createElement('div');
            img.className = 'preview-img';
            img.setAttribute('data-index', index);

            const dragIcon = '<div style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.7); padding:2px; border-radius:2px; pointer-events:none;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>';

            if (!item.url) { 
                img.style.backgroundColor = '#111';
                img.innerHTML = `<span style="color:var(--accent-green); font-family:var(--font-mono); font-size:10px; display:flex; align-items:center; justify-content:center; height:100%; text-shadow:0 0 5px #000;">в–¶ VID</span>${dragIcon}`;
            } else {
                img.style.backgroundImage = `url('${item.url}')`;
                img.innerHTML = dragIcon;
            }

            const delBtn = document.createElement('div');
            delBtn.innerHTML = 'вњ–';
            delBtn.style.cssText = 'position:absolute; top:-6px; left:-6px; background:var(--accent-red); color:#fff; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:10px; cursor:pointer; z-index:10; font-family:var(--font-mono); border: 1px solid #000;';
            
            // РЈРґР°Р»РµРЅРёРµ С„РѕС‚Рѕ
            delBtn.onclick = (e) => {
                e.stopPropagation(); 
                currentProposalFiles.splice(index, 1);
                if (typeof triggerHaptic === 'function') triggerHaptic('light');
                renderProposalPreviews(); 
            };
            img.appendChild(delBtn);

            // Р¤РРљРЎ: РљР»РёРє РїРѕ РєР°СЂС‚РёРЅРєРµ (РћС‚РєСЂС‹РІР°РµС‚ РЅР° РІРµСЃСЊ СЌРєСЂР°РЅ!)
            img.onclick = (e) => {
                e.stopPropagation();
                if (!item.url) return; // Р’РёРґРµРѕ РїРѕРєР° РЅРµ РѕС‚РєСЂС‹РІР°РµРј, С‚РѕР»СЊРєРѕ С„РѕС‚Рѕ
                
                // РџРѕРґРєР»СЋС‡Р°РµРј СЂРѕРґРЅСѓСЋ РіР°Р»РµСЂРµСЋ
                if (window.PhotoSwipeLightbox) {
                    const photos = currentProposalFiles.filter(f => f.url);
                    const clickedIndex = photos.findIndex(f => f === item);
                    
                    const pswp = new window.PhotoSwipeLightbox({
                        dataSource: photos.map(f => ({ src: f.url, width: 1000, height: 1000 })),
                        pswpModule: () => import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/photoswipe.esm.min.js')
                    });
                    pswp.init();
                    pswp.loadAndOpen(clickedIndex);
                }
            };

            container.appendChild(img);
        });

        // Р¤РРљРЎ Р›РђР“РћР’: РЈР±РёРІР°РµРј СЃС‚Р°СЂС‹Р№ СЃРѕСЂС‚РёСЂРѕРІС‰РёРє РїРµСЂРµРґ СЃРѕР·РґР°РЅРёРµРј РЅРѕРІРѕРіРѕ!
        if (proposalSortable) {
            proposalSortable.destroy();
        }

        if (window.Sortable) {
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

            proposalSortable = Sortable.create(container, {
                animation: 150, // РЈСЃРєРѕСЂРёР»Рё Р°РЅРёРјР°С†РёСЋ (Р±С‹Р»Рѕ 250)
                delay: isTouchDevice ? 150 : 0, 
                delayOnTouchOnly: true,
                touchStartThreshold: 5,
                forceFallback: isTouchDevice, 
                fallbackOnBody: false, 
                ghostClass: 'sortable-ghost', 
                dragClass: 'sortable-drag', 
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
                }
            });
        }
    } else {
        placeholder.style.display = 'block';
    }
}

// 5. Р“Р»Р°РІРЅР°СЏ С„СѓРЅРєС†РёСЏ РѕС‚РїСЂР°РІРєРё РґР°РЅРЅС‹С… РЅР° СЃРµСЂРІРµСЂ
// Р’СЃРїРѕРјРѕРіР°С‚РµР»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ (РєРѕРЅРІРµСЂС‚РёСЂСѓРµС‚ С„РѕС‚Рѕ РІ С‚РµРєСЃС‚ РґР»СЏ РїРµСЂРµРґР°С‡Рё РЅР° СЃРµСЂРІРµСЂ)
const fileToBase64 = file => new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
});

async function submitProposal() {
    const btn = document.getElementById('btnSubmitProp');
    
    // Р‘Р•Р Р•Рњ Р¤РђР™Р›Р« РР— РќРђРЁР•Р“Рћ РћРўРЎРћР РўРР РћР’РђРќРќРћР“Рћ РњРђРЎРЎРР’Рђ!
    const files = currentProposalFiles.map(obj => obj.file);
    
    // РЎР§РРўР«Р’РђР•Рњ Р’РЎР• РџРћР›РЇ
    const rawName = document.getElementById('propName').value.trim();
    const rawBrand = document.getElementById('propBrand').value.trim();
    const rawSize = document.getElementById('propSize').value.trim();
    const rawDesc = document.getElementById('propDesc').value.trim(); // Р”РћРЎРўРђР•Рњ РћРџРРЎРђРќРР•
    const cond = parseInt(document.getElementById('propCond').value);
    const price = parseInt(document.getElementById('propPrice').value) || 0; 
    const rawContact = document.getElementById('propContact').value.trim();
    
    // РћР§РР©РђР•Рњ РћРў Р’Р Р•Р”РћРќРћРЎРќРћР“Рћ РљРћР”Рђ (Р•РЎР›Р Р•РЎРўР¬ DOMPURIFY)
    const nameItem = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawName) : rawName; 
    const brand = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawBrand) : rawBrand;
    const size = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawSize) : rawSize;
    const desc = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawDesc) : rawDesc; // Р§РРЎРўРРњ РћРџРРЎРђРќРР•
    const contact = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawContact) : rawContact;

    // Р–Р•РЎРўРљРђРЇ РџР РћР’Р•Р РљРђ (Р•СЃР»Рё РїСѓСЃС‚Рѕ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ РїРѕР»Рµ вЂ” РІС‹РґР°РµРј РѕС€РёР±РєСѓ)
    if (!files.length || !nameItem || !brand || !size || !desc || isNaN(cond) || price <= 0 || !contact) {
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        showToast('РџРѕР¶Р°Р»СѓР№СЃС‚Р°, Р·Р°РїРѕР»РЅРёС‚Рµ РђР‘РЎРћР›Р®РўРќРћ Р’РЎР• РїРѕР»СЏ!', 'error');
        return;
    }

    if (cond < 1 || cond > 10) {
        showToast('РћС†РµРЅРєР° СЃРѕСЃС‚РѕСЏРЅРёСЏ РѕС‚ 1 РґРѕ 10!', 'error');
        return;
    }

    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.7';

    try {
        // Р­РўРђРџ 1: РџР РћРЎРўРћР• РЎР–РђРўРР• Р¤РћРўРћ
        let compressedFiles = [];
        for (let i = 0; i < files.length; i++) {
            btn.innerText = `[ РЎР–РђРўРР• Р¤РћРўРћ: ${i + 1}/${files.length} ]`;
            await new Promise(r => setTimeout(r, 100)); 
            const compressed = await compressImage(files[i]);
            compressedFiles.push(compressed);
        }

        // Р­РўРђРџ 2: РћРўРџР РђР’РљРђ РќРђРџР РЇРњРЈР® Р‘Р•Р— РљРћРќР’Р•Р РўРђР¦РР
        btn.innerText = '[ РџР•Р Р•Р”РђР§Рђ РќРђ РЎР•Р Р’Р•Р ... ]';
        
        // РЎРѕР·РґР°РµРј РїР°РєРµС‚ РґР°РЅРЅС‹С… (FormData)
        const formData = new FormData();
        formData.append('name', nameItem);
        formData.append('brand', brand);
        formData.append('measurements', size);
        formData.append('condition', cond);
        formData.append('price', price);
        formData.append('description', desc);
        formData.append('contact', contact);
        formData.append('clientId', (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : clientFingerprint); // Р”РѕР±Р°РІРёР»Рё ID РєР»РёРµРЅС‚Р°!
        
        // РљР»Р°РґРµРј С‚СѓРґР° С„Р°Р№Р»С‹ РєР°Рє РѕРЅРё РµСЃС‚СЊ!
        compressedFiles.forEach((file, index) => {
            formData.append('images', file, `prop_${index}.jpg`);
        });

        // РћС‚РїСЂР°РІР»СЏРµРј РЅР° СЃРµСЂРІРµСЂ РІ С„РѕРЅРµ
        fetch('https://nisha-api.onrender.com/api/propose-files', {
            method: 'POST',
            body: formData // РќРёРєР°РєРѕРіРѕ JSON, РїСЂРѕСЃС‚Рѕ С„Р°Р№Р»С‹!
        }).catch(e => console.log("Р¤РѕРЅРѕРІР°СЏ РѕС‚РїСЂР°РІРєР°: ", e));

        // Р¤РРќРђР›: Р—РђРљР Р«РўРР• (РњРіРЅРѕРІРµРЅРЅРѕ)
        resetProposalForm(); 
        executeCloseModal('proposeModal'); 
        
        setTimeout(() => {
            showTerminalModal('SYSTEM_OK.LOG', 'Р’Р°С€Р° Р·Р°СЏРІРєР° РѕС‚РїСЂР°РІР»РµРЅР° РЅР° СЃРµСЂРІРµСЂ.', '[ РџР РРќРЇРўРћ ]', null);
            btn.innerText = '[ РћРўРџР РђР’РРўР¬ Р—РђРЇР’РљРЈ ]';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        }, 300);

    } catch (err) {
        console.error(err);
        showToast('РЎР±РѕР№ СЃРµСЂРІРµСЂР°: ' + err.message, 'error');
        btn.innerText = '[ РџРћР’РўРћР РРўР¬ РџРћРџР«РўРљРЈ ]';
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
    }
}



// 6. РЎРІР°Р№Рї С„РѕС‚РѕРіСЂР°С„РёР№ РІ РјРѕРґР°Р»РєРµ С‚РѕРІР°СЂР°
function initSliderSwipe() {
    const sliderContainer = document.getElementById('sliderContainer');
    if (!sliderContainer) return;

    let touchStartX = 0;
    let touchEndX = 0;
    let lastTapTime = 0;

    sliderContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return;
        touchStartX = e.touches[0].clientX;

        // Р›РћР“РРљРђ Р”РђР‘Р›-РўРђРџРђ (Р”РІРѕР№РЅРѕРµ РєР°СЃР°РЅРёРµ)
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0) {
            // Р­С‚Рѕ РґРІРѕР№РЅРѕР№ С‚Р°Рї! РќР°С…РѕРґРёРј С‚РµРєСѓС‰РёР№ СЃР»Р°Р№Рґ Рё СѓРІРµР»РёС‡РёРІР°РµРј РµРіРѕ
            const slides = document.querySelectorAll('.slide');
            if (slides[currentSlide]) {
                slides[currentSlide].classList.toggle('zoomed-in');
            }
            e.preventDefault(); // Р‘Р»РѕРєРёСЂСѓРµРј СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№ Р·СѓРј Р±СЂР°СѓР·РµСЂР°
        }
        lastTapTime = currentTime;

    }, { passive: false });

    sliderContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        
        const currentSlideEl = document.querySelectorAll('.slide')[currentSlide];
        const isZoomed = currentSlideEl && currentSlideEl.classList.contains('zoomed-in');

        // РЎРІР°Р№РїР°РµРј С‚РѕР»СЊРєРѕ РµСЃР»Рё С„РѕС‚РєР° РќР• СѓРІРµР»РёС‡РµРЅР°
        if (Math.abs(diff) > 50 && !isZoomed) {
            if (diff > 0) moveSlide(1);
            else moveSlide(-1);
        }
    }, { passive: true });
}

// 7. Р¤СѓРЅРєС†РёСЏ РІС…РѕРґР° С‡РµСЂРµР· Google
async function loginWithGoogle() {
    const isInApp = /Instagram|FBAN|FBAV|TikTok/i.test(navigator.userAgent);
    if (isInApp) {
        alert("Р”Р»СЏ РІС…РѕРґР° С‡РµСЂРµР· Google РѕС‚РєСЂРѕР№ СЃР°Р№С‚ РІ РѕР±С‹С‡РЅРѕРј Р±СЂР°СѓР·РµСЂРµ (Safari РёР»Рё Chrome)");
        return;
    }
    const { data, error } = await _supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'https://www.nisha-store.shop',
            queryParams: { prompt: 'select_account', access_type: 'offline' }
        }
    });
    if (error) showToast('РћС€РёР±РєР°: ' + error.message, 'error');
}
// --- Р›РћР“РРљРђ Р”Р›РЇ РўРћР§Р•Рљ Р’ РљРђР РўРћР§РљРђРҐ ---
window.updateCardDots = function(container, itemId) {
    // РСЃРїРѕР»СЊР·СѓРµРј С€РёСЂРёРЅСѓ РєРѕРЅС‚РµР№РЅРµСЂР° РґР»СЏ РІС‹С‡РёСЃР»РµРЅРёСЏ РёРЅРґРµРєСЃР°
    const index = Math.round(container.scrollLeft / container.offsetWidth);
    const dotsContainer = document.getElementById(`dots-${itemId}`);
    if (dotsContainer) {
        const dots = dotsContainer.querySelectorAll('.card-dot');
        dots.forEach((dot, i) => {
            if (i === index) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }
};

// ==========================================
// РРќР¤РћР РњРђР¦РРћРќРќР«Р• РћРљРќРђ Р”Р›РЇ Р‘Р•Р™Р”Р–Р•Р™ РўРћР’РђР РћР’
// ==========================================
window.showBadgeInfo = function(type) {
    let title = '';
    let text = '';

    if (type === 'secure') {
        title = 'SECURE_PAYMENT.EXE';
        
        // РЈР·РЅР°РµРј, РјРѕР¶РЅРѕ Р»Рё РІРµСЂРЅСѓС‚СЊ С‚РµРєСѓС‰РёР№ С‚РѕРІР°СЂ
        const isReturnable = currentOpenedItem && currentOpenedItem.is_returnable === true;
        const isDropItem = currentOpenedItem && (currentOpenedItem.is_drop === true || (currentOpenedItem.tags && currentOpenedItem.tags.map(t => t.toLowerCase()).includes('drop')));

        if (!isReturnable || isDropItem) {
            // РўРµРєСЃС‚ РґР»СЏ РІРµС‰РµР№ Р‘Р•Р— Р’РћР—Р’Р РђРўРђ (Р–РµСЃС‚РєРёР№)
            text = 'NISHA РІС‹СЃС‚СѓРїР°РµС‚ РіР°СЂР°РЅС‚РѕРј СЃРґРµР»РєРё. Р’Р°С€Рё РґРµРЅСЊРіРё РЅР°РґРµР¶РЅРѕ Р·Р°С‰РёС‰РµРЅС‹.<br><br>Р”Р°РЅРЅР°СЏ РІРµС‰СЊ РїСЂРѕРґР°РµС‚СЃСЏ <b style="color:var(--accent-red);">Р±РµР· РїСЂР°РІР° РЅР° РІРѕР·РІСЂР°С‚ РёР»Рё РѕР±РјРµРЅ РЅРё РїСЂРё РєР°РєРёС… СѓСЃР»РѕРІРёСЏС…</b>.<br><br>РњС‹ РЅР°СЃС‚РѕСЏС‚РµР»СЊРЅРѕ РїСЂРѕСЃРёРј РІР°СЃ РІРЅРёРјР°С‚РµР»СЊРЅРѕ РёР·СѓС‡Р°С‚СЊ С„РѕС‚Рѕ, Р·Р°РјРµСЂС‹ Рё РѕРїРёСЃР°РЅРёРµ РїРµСЂРµРґ РѕС„РѕСЂРјР»РµРЅРёРµРј Р·Р°РєР°Р·Р°.';
        } else {
            // РўРµРєСЃС‚ РґР»СЏ РІРµС‰РµР№ РЎ Р’РћР—Р’Р РђРўРћРњ
            text = 'NISHA РІС‹СЃС‚СѓРїР°РµС‚ РіР°СЂР°РЅС‚РѕРј СЃРґРµР»РєРё. Р’Р°С€Рё РґРµРЅСЊРіРё РЅР°РґРµР¶РЅРѕ Р·Р°С‰РёС‰РµРЅС‹.<br><br>Р’С‹ РјРѕР¶РµС‚Рµ РїСЂРёРјРµСЂРёС‚СЊ РІРµС‰СЊ РЅР° РїРѕС‡С‚Рµ. Р”Р°Р¶Рµ РµСЃР»Рё РІС‹ Р·Р°Р±СЂР°Р»Рё РµС‘ РґРѕРјРѕР№, РЅР° РґР°РЅРЅС‹Р№ С‚РѕРІР°СЂ РґРµР№СЃС‚РІСѓРµС‚ <b style="color:var(--accent-green);">РіР°СЂР°РЅС‚РёСЏ РІРѕР·РІСЂР°С‚Р° Рё РѕР±РјРµРЅР° РІ С‚РµС‡РµРЅРёРµ 14 РґРЅРµР№</b>.<br><br><i>РћР±СЏР·Р°С‚РµР»СЊРЅРѕРµ СѓСЃР»РѕРІРёРµ РІРѕР·РІСЂР°С‚Р°: СЃРѕС…СЂР°РЅРµРЅРёРµ С‚РѕРІР°СЂРЅРѕРіРѕ РІРёРґР° Рё РѕС‚СЃСѓС‚СЃС‚РІРёРµ СЃР»РµРґРѕРІ РЅРѕСЃРєРё.</i>';
        }
    } else if (type === 'fast') {
        title = 'FAST_SHIPPING.SYS';
        text = 'РћС‚РїСЂР°РІРєР° Р·Р°РєР°Р·Р° РѕСЃСѓС‰РµСЃС‚РІР»СЏРµС‚СЃСЏ РІ РґРµРЅСЊ РѕРїР»Р°С‚С‹ (РїСЂРё РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРё РґРѕ 16:00) РёР»Рё РЅР° СЃР»РµРґСѓСЋС‰РёР№ СЂР°Р±РѕС‡РёР№ РґРµРЅСЊ.';
    } else if (type === 'refund_no') {
        title = 'NO_RETURN_POLICY.LOG';
        text = '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ РўРћР’РђР  РќР• РџРћР”Р›Р•Р–РРў Р’РћР—Р’Р РђРўРЈ ]</span><br><br>РњС‹ РЅР°СЃС‚РѕСЏС‚РµР»СЊРЅРѕ РїСЂРѕСЃРёРј РІР°СЃ РІРЅРёРјР°С‚РµР»СЊРЅРѕ РёР·СѓС‡Р°С‚СЊ С„РѕС‚Рѕ, Р·Р°РјРµСЂС‹ Рё РѕРїРёСЃР°РЅРёРµ РїРµСЂРµРґ РѕС„РѕСЂРјР»РµРЅРёРµРј Р·Р°РєР°Р·Р°.<br><br><b style="color:var(--accent-red);">Р”Р°РЅРЅР°СЏ РІРµС‰СЊ РЅРµ РїРѕРґР»РµР¶РёС‚ РІРѕР·РІСЂР°С‚Сѓ РёР»Рё РѕР±РјРµРЅСѓ РЅРё РїСЂРё РєР°РєРёС… СѓСЃР»РѕРІРёСЏС….</b>';
    } else if (type === 'refund_yes') {
        title = 'RETURN_POLICY.SYS';
        text = '<span style="color:var(--accent-green); font-weight:bold; font-size:16px;">[ Р”РћРЎРўРЈРџР•Рќ Р’РћР—Р’Р РђРў ]</span><br><br>Р”Р°РЅРЅС‹Р№ С‚РѕРІР°СЂ РїРѕРґР»РµР¶РёС‚ РІРѕР·РІСЂР°С‚Сѓ Рё РѕР±РјРµРЅСѓ РІ С‚РµС‡РµРЅРёРµ <b>14 РґРЅРµР№</b> СЃ РјРѕРјРµРЅС‚Р° РїРѕРєСѓРїРєРё, СЃРѕРіР»Р°СЃРЅРѕ Р·Р°РєРѕРЅРѕРґР°С‚РµР»СЊСЃС‚РІСѓ РЈРєСЂР°РёРЅС‹.<br><br><i>РЈСЃР»РѕРІРёРµ РІРѕР·РІСЂР°С‚Р°: СЃРѕС…СЂР°РЅРµРЅРёРµ С‚РѕРІР°СЂРЅРѕРіРѕ РІРёРґР°, РІСЃРµС… Р±РёСЂРѕРє Рё РѕС‚СЃСѓС‚СЃС‚РІРёРµ СЃР»РµРґРѕРІ РЅРѕСЃРєРё.</i>';
    } else if (type === 'drop') {
        title = 'WARNING: DROP_ITEM';
        text = '<span style="color:var(--accent-red); font-weight:bold; font-size:16px;">[ Р’РќРРњРђРќРР• ]</span><br><span style="color:#fff;">Р­С‚Р° РІРµС‰СЊ Р·Р°РіСЂСѓР¶РµРЅР° СЃС‚РѕСЂРѕРЅРЅРёРј РїСЂРѕРґР°РІС†РѕРј (Creator).</span><br><br>РћР±СЏР·Р°С‚РµР»СЊРЅРѕ РїСЂРѕРІРѕРґРёС‚Рµ РїРѕР»РЅС‹Р№ РѕСЃРјРѕС‚СЂ РІРµС‰Рё РЅР° РѕС‚РґРµР»РµРЅРёРё РќРѕРІРѕР№ РџРѕС‡С‚С‹. <b style="color:var(--accent-red);">Р•СЃР»Рё РІС‹ Р·Р°Р±СЂР°Р»Рё РїРѕСЃС‹Р»РєСѓ РґРѕРјРѕР№ вЂ” РІРѕР·РІСЂР°С‚ РёР»Рё РѕР±РјРµРЅ РќР•Р’РћР—РњРћР–Р•Рќ</b>, С‚Р°Рє РєР°Рє РґРµРЅСЊРіРё СЃСЂР°Р·Сѓ РїРµСЂРµРІРѕРґСЏС‚СЃСЏ РІР»Р°РґРµР»СЊС†Сѓ РІРµС‰Рё.';
    }
    
    showTerminalModal(title, text, '[ РџРћРќРЇРўРќРћ ]', null);
};
// ==========================================
// Р›РћР“РРљРђ Р“Р›РђР—РРљРђ (РџРћРљРђР—РђРўР¬/РЎРљР Р«РўР¬ РџРђР РћР›Р¬)
// ==========================================
window.togglePasswordVisibility = function(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        iconElement.classList.add('visible'); // Р“Р»Р°Р·РёРє СЃС‚Р°РЅРѕРІРёС‚СЃСЏ Р·РµР»РµРЅС‹Рј, Р»РёРЅРёСЏ РёСЃС‡РµР·Р°РµС‚
    } else {
        input.type = 'password';
        iconElement.classList.remove('visible'); // Р“Р»Р°Р·РёРє СЃС‚Р°РЅРѕРІРёС‚СЃСЏ РєСЂР°СЃРЅС‹Рј, Р»РёРЅРёСЏ РїРѕСЏРІР»СЏРµС‚СЃСЏ
    }
};
// ==========================================
// РђР’РўРћРћРџР Р•Р”Р•Р›Р•РќРР• Р“РћР РћР”Рђ РџРћ IP (GEO IP)
// ==========================================
async function autoDetectCity() {
    const cityInput = document.getElementById('orderCity');
    const branchInput = document.getElementById('orderBranch');
    
    // Р•СЃР»Рё РїРѕР»Рµ СѓР¶Рµ Р·Р°РїРѕР»РЅРµРЅРѕ, РЅРµ С‚СЂРѕРіР°РµРј РµРіРѕ
    if (!cityInput || cityInput.value.trim() !== '') return;

    const originalPlaceholder = cityInput.placeholder;
    cityInput.placeholder = "РџРѕРёСЃРє СЃРїСѓС‚РЅРёРєРѕРІ..."; 

    try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await res.json();

                if (data.country_code === 'UA' && data.city) {
            const enToUaCities = {
                'Kyiv': 'РљРёС—РІ', 'Kiev': 'РљРёС—РІ', 'Kharkiv': 'РҐР°СЂРєС–РІ', 'Kharkov': 'РҐР°СЂРєС–РІ',
                'Odesa': 'РћРґРµСЃР°', 'Odessa': 'РћРґРµСЃР°', 'Dnipro': 'Р”РЅС–РїСЂРѕ', 'Dnipropetrovsk': 'Р”РЅС–РїСЂРѕ',
                'Donetsk': 'Р”РѕРЅРµС†СЊРє', 'Zaporizhzhia': 'Р—Р°РїРѕСЂС–Р¶Р¶СЏ', 'Zaporozhye': 'Р—Р°РїРѕСЂС–Р¶Р¶СЏ',
                'Lviv': 'Р›СЊРІС–РІ', 'Lvov': 'Р›СЊРІС–РІ', 'Kryvyi Rih': 'РљСЂРёРІРёР№ Р С–Рі', 'Krivoy Rog': 'РљСЂРёРІРёР№ Р С–Рі',
                'Mykolaiv': 'РњРёРєРѕР»Р°С—РІ', 'Nikolaev': 'РњРёРєРѕР»Р°С—РІ', 'Mariupol': 'РњР°СЂС–СѓРїРѕР»СЊ',
                'Luhansk': 'Р›СѓРіР°РЅСЃСЊРє', 'Lugansk': 'Р›СѓРіР°РЅСЃСЊРє', 'Vinnytsia': 'Р’С–РЅРЅРёС†СЏ', 'Vinnitsa': 'Р’С–РЅРЅРёС†СЏ',
                'Makiivka': 'РњР°РєС–С—РІРєР°', 'Makeyevka': 'РњР°РєС–С—РІРєР°', 'Simferopol': 'РЎС–РјС„РµСЂРѕРїРѕР»СЊ',
                'Chernihiv': 'Р§РµСЂРЅС–РіС–РІ', 'Chernigov': 'Р§РµСЂРЅС–РіС–РІ', 'Kherson': 'РҐРµСЂСЃРѕРЅ',
                'Poltava': 'РџРѕР»С‚Р°РІР°', 'Khmelnytskyi': 'РҐРјРµР»СЊРЅРёС†СЊРєРёР№', 'Khmelnytskyy': 'РҐРјРµР»СЊРЅРёС†СЊРєРёР№',
                'Cherkasy': 'Р§РµСЂРєР°СЃРё', 'Cherkassy': 'Р§РµСЂРєР°СЃРё', 'Chernivtsi': 'Р§РµСЂРЅС–РІС†С–', 'Chernovtsy': 'Р§РµСЂРЅС–РІС†С–',
                'Zhytomyr': 'Р–РёС‚РѕРјРёСЂ', 'Zhitomir': 'Р–РёС‚РѕРјРёСЂ', 'Sumy': 'РЎСѓРјРё',
                'Rivne': 'Р С–РІРЅРµ', 'Rovno': 'Р С–РІРЅРµ', 'Horlivka': 'Р“РѕСЂР»С–РІРєР°', 'Gorlovka': 'Р“РѕСЂР»С–РІРєР°',
                'Ivano-Frankivsk': 'Р†РІР°РЅРѕ-Р¤СЂР°РЅРєС–РІСЃСЊРє', 'Ivano-Frankovsk': 'Р†РІР°РЅРѕ-Р¤СЂР°РЅРєС–РІСЃСЊРє',
                'Kamianske': 'РљР°Рј\'СЏРЅСЃСЊРєРµ', 'Dniprodzerzhynsk': 'РљР°Рј\'СЏРЅСЃСЊРєРµ', 'Kropyvnytskyi': 'РљСЂРѕРїРёРІРЅРёС†СЊРєРёР№', 'Kirovohrad': 'РљСЂРѕРїРёРІРЅРёС†СЊРєРёР№',
                'Ternopil': 'РўРµСЂРЅРѕРїС–Р»СЊ', 'Ternopol': 'РўРµСЂРЅРѕРїС–Р»СЊ', 'Kremenchuk': 'РљСЂРµРјРµРЅС‡СѓРє', 'Kremenchug': 'РљСЂРµРјРµРЅС‡СѓРє',
                'Lutsk': 'Р›СѓС†СЊРє', 'Bila Tserkva': 'Р‘С–Р»Р° Р¦РµСЂРєРІР°', 'Belaya Tserkov': 'Р‘С–Р»Р° Р¦РµСЂРєРІР°',
                'Kramatorsk': 'РљСЂР°РјР°С‚РѕСЂСЃСЊРє', 'Melitopol': 'РњРµР»С–С‚РѕРїРѕР»СЊ', 'Uzhhorod': 'РЈР¶РіРѕСЂРѕРґ', 'Uzhgorod': 'РЈР¶РіРѕСЂРѕРґ',
                'Brovary': 'Р‘СЂРѕРІР°СЂРё', 'Berdiansk': 'Р‘РµСЂРґСЏРЅСЃСЊРє', 'Berdyansk': 'Р‘РµСЂРґСЏРЅСЃСЊРє',
                'Pavlohrad': 'РџР°РІР»РѕРіСЂР°Рґ', 'Pavlograd': 'РџР°РІР»РѕРіСЂР°Рґ', 'Sievierodonetsk': 'РЎС”РІС”СЂРѕРґРѕРЅРµС†СЊРє', 'Severodonetsk': 'РЎС”РІС”СЂРѕРґРѕРЅРµС†СЊРє',
                'Kamianets-Podilskyi': 'РљР°Рј\'СЏРЅРµС†СЊ-РџРѕРґС–Р»СЊСЃСЊРєРёР№', 'Kamenets-Podolskiy': 'РљР°Рј\'СЏРЅРµС†СЊ-РџРѕРґС–Р»СЊСЃСЊРєРёР№'
            };
            let detectedCity = enToUaCities[data.city] || data.city;
            if (detectedCity === data.city && data.latitude && data.longitude) {
                try {
                    const nomRes = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + data.latitude + '&lon=' + data.longitude + '&format=json&accept-language=uk');
                    const nomData = await nomRes.json();
                    if (nomData && nomData.address) {
                        detectedCity = nomData.address.city || nomData.address.town || nomData.address.village || detectedCity;
                    }
                } catch(e) {}
            }
            
            // РўРёС…Рѕ СЃРїСЂР°С€РёРІР°РµРј РќРѕРІСѓСЋ РџРѕС‡С‚Сѓ, РєР°Рє РїСЂР°РІРёР»СЊРЅРѕ РЅР°Р·С‹РІР°РµС‚СЃСЏ СЌС‚РѕС‚ РіРѕСЂРѕРґ
            const npRes = await fetch('https://nisha-api.onrender.com/api/np-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    modelName: 'Address', calledMethod: 'searchSettlements', 
                    methodProperties: { CityName: detectedCity, Limit: "1" } 
                })
            });
            const npData = await npRes.json();

            // Р•СЃР»Рё РќРѕРІР°СЏ РџРѕС‡С‚Р° РЅР°С€Р»Р° РіРѕСЂРѕРґ РїРѕ Р°РЅРіР»РёР№СЃРєРѕРјСѓ РЅР°Р·РІР°РЅРёСЋ
            if(npData.success && npData.data[0] && npData.data[0].Addresses.length > 0) {
                const cityObj = npData.data[0].Addresses[0];
                
                // Р’РїРёСЃС‹РІР°РµРј РїСЂР°РІРёР»СЊРЅРѕРµ СѓРєСЂР°РёРЅСЃРєРѕРµ РЅР°Р·РІР°РЅРёРµ!
                cityInput.value = cityObj.Present; 
                
                // РЎРѕС…СЂР°РЅСЏРµРј Ref (ID Р“РѕСЂРѕРґР°) РґР»СЏ РїРѕРёСЃРєР° РѕС‚РґРµР»РµРЅРёР№!
                selectedCityRef = cityObj.DeliveryCity || cityObj.Ref; 
                
                // Р Р°Р·Р±Р»РѕРєРёСЂСѓРµРј РїРѕР»Рµ РѕС‚РґРµР»РµРЅРёР№
                if (branchInput) {
                    branchInput.readOnly = false;
                    branchInput.placeholder = "Р’С‹Р±РµСЂРёС‚Рµ РѕС‚РґРµР»РµРЅРёРµ...";
                }
                
                showToast(`[GEO] Р›РѕРєР°С†РёСЏ: ${cityObj.MainDescription}`, 'success');
            } else {
                // Р•СЃР»Рё РќРџ РЅРµ РїРѕРЅСЏР»Р° Р°РЅРіР»РёР№СЃРєРѕРµ РЅР°Р·РІР°РЅРёРµ
                cityInput.value = detectedCity; 
                searchNPCity(detectedCity); // РћСЃС‚Р°РІР»СЏРµРј СЃС‚Р°СЂС‹Р№ РјРµС‚РѕРґ РєР°Рє С„РѕР»Р»Р±СЌРє
            }
        } else {
            cityInput.placeholder = originalPlaceholder;
        }
    } catch (err) {
        console.error("РћС€РёР±РєР° GeoIP:", err);
        cityInput.placeholder = originalPlaceholder;
    }
}
// ==========================================
// РЈРњРќР«Р™ РЎР‘РћР  РћРўР—Р«Р’РћР’ Р—Рђ РџРћР›РЈР§Р•РќРќР«Р• РџРћРЎР«Р›РљР
// ==========================================
window.promptOrderReview = function(orderId, itemName, itemImage, itemId) {
    document.getElementById('autoReviewOrderId').value = orderId;
    document.getElementById('autoReviewItemImage').value = itemImage || '';
    document.getElementById('autoReviewItemId').value = itemId || ''; // РЎРѕС…СЂР°РЅСЏРµРј ID С‚РѕРІР°СЂР°
    document.getElementById('autoReviewName').innerText = itemName;
    document.getElementById('autoReviewImg').style.backgroundImage = `url('${itemImage}')`;
    document.getElementById('autoReviewInput').value = ''; 

    if (typeof lenis !== 'undefined') window.stopLenis();
    document.getElementById('autoReviewModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.submitAutoReview = async function() {
    const text = document.getElementById('autoReviewInput').value.trim();
    const orderId = document.getElementById('autoReviewOrderId').value;
    const itemImage = document.getElementById('autoReviewItemImage').value;
    const itemId = document.getElementById('autoReviewItemId').value;

    if (text.length < 3) {
        showToast('РўРµРєСЃС‚ СЃР»РёС€РєРѕРј РєРѕСЂРѕС‚РєРёР№!', 'error');
        return;
    }

    let uName = userProfile?.username;
    if (!uName || uName === 'User') {
        uName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
    }
    
    // РџРёС€РµРј РІ Р‘Р” РѕС‚Р·С‹РІ РІРјРµСЃС‚Рµ СЃ ID Р·Р°РєР°Р·Р°, С„РѕС‚РєРѕР№ Рё ID РўРћР’РђР Рђ
    const { error } = await _supabase.from('reviews').insert([{ 
        user_name: uName, 
        text: text, 
        rating: 5,
        order_id: orderId,
        item_image: itemImage !== '' ? itemImage : null,
        item_id: itemId !== '' ? itemId : null
    }]);
    
    if (!error) {
        showToast('РћС‚Р·С‹РІ РѕРїСѓР±Р»РёРєРѕРІР°РЅ! РЎРїР°СЃРёР±Рѕ.', 'success');
        let reviewedOrders = JSON.parse(localStorage.getItem('nisha_reviewed_orders') || '[]');
        reviewedOrders.push(orderId);
        localStorage.setItem('nisha_reviewed_orders', JSON.stringify(reviewedOrders));
        closeModal('autoReviewModal');
    } else {
        showToast('РћС€РёР±РєР°: ' + error.message, 'error');
    }
};

window.skipAutoReview = function() {
    const orderId = document.getElementById('autoReviewOrderId').value;
    let dismissedOrders = JSON.parse(localStorage.getItem('nisha_dismissed_reviews') || '[]');
    dismissedOrders.push(orderId); 
    localStorage.setItem('nisha_dismissed_reviews', JSON.stringify(dismissedOrders));
    closeModal('autoReviewModal');
};

// ==========================================
// Р›РћР“РРљРђ РќРђРџРРЎРђРќРРЇ РћРўР—Р«Р’Рђ РќРђ РЎРђР™РўР• (РљРќРћРџРљРђ РР— РЎРџРРЎРљРђ)
// ==========================================
window.writeReviewOnSite = function() {
    if (!currentUser) {
        showToast(i18next.t('messages.cart_error_auth', {defaultValue: 'РЎРЅР°С‡Р°Р»Р° РІРѕР№РґРёС‚Рµ РІ СЃРёСЃС‚РµРјСѓ!'}), 'error');
        closeModal('reviewsModal');
        openProfileModal();
        return;
    }

    document.getElementById('manualReviewInput').value = ''; // РћС‡РёС‰Р°РµРј РїРѕР»Рµ
    closeModal('reviewsModal'); // РџСЂСЏС‡РµРј СЃРїРёСЃРѕРє РѕС‚Р·С‹РІРѕРІ
    
    setTimeout(() => {
        if (typeof lenis !== 'undefined') window.stopLenis();
        document.getElementById('writeReviewModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }, 300); // РћС‚РєСЂС‹РІР°РµРј С„РѕСЂРјСѓ РѕС‚Р·С‹РІР° РїР»Р°РІРЅРѕ
};

window.submitManualReview = async function() {
    const text = document.getElementById('manualReviewInput').value.trim();
    
    if (text.length < 3) {
        showToast('РўРµРєСЃС‚ СЃР»РёС€РєРѕРј РєРѕСЂРѕС‚РєРёР№!', 'error');
        return;
    }

    const btn = document.querySelector('#writeReviewModal .cart-checkout-btn');
    btn.style.pointerEvents = 'none';
    btn.innerText = '...';

    const uName = userProfile?.username || currentUser.email.split('@')[0];
    
    const { error } = await _supabase.from('reviews').insert([{ user_name: uName, text: text, rating: 5 }]);

    btn.style.pointerEvents = 'auto';
    btn.innerText = 'РћРўРџР РђР’РРўР¬';

    if (error) {
        showToast('РћС€РёР±РєР° РїСЂРё РѕС‚РїСЂР°РІРєРµ: ' + error.message, 'error');
    } else {
        showToast('РћС‚Р·С‹РІ СѓСЃРїРµС€РЅРѕ РѕРїСѓР±Р»РёРєРѕРІР°РЅ!', 'success');
        closeModal('writeReviewModal');
        
        // РњР°РіРёСЏ: Р¶РґРµРј РїРѕРєР° Р·Р°РєСЂРѕРµС‚СЃСЏ РѕРєРЅРѕ, Рё Р·Р°РЅРѕРІРѕ РѕС‚РєСЂС‹РІР°РµРј РЎРџРРЎРћРљ РћРўР—Р«Р’РћР’ (РѕРЅ СЃРєР°С‡Р°РµС‚ СЃРІРµР¶СѓСЋ Р±Р°Р·Сѓ СЃ С‚РІРѕРёРј РѕС‚Р·С‹РІРѕРј!)
        setTimeout(() => {
            openReviewsModal();
        }, 400);
    }
};
// ==========================================
// Р›РћР“РРљРђ РЈР”РђР›Р•РќРРЇ РР— РРЎРўРћР РР РџР РћРЎРњРћРўР РћР’
// ==========================================
window.removeHistoryItem = function(event, itemId) {
    // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј "РїСЂРѕРІР°Р»РёРІР°РЅРёРµ" РєР»РёРєР°, С‡С‚РѕР±С‹ РЅРµ РѕС‚РєСЂС‹Р»Р°СЃСЊ РєР°СЂС‚РѕС‡РєР° С‚РѕРІР°СЂР°
    event.stopPropagation(); 
    
    // РџРѕР»СѓС‡Р°РµРј С‚РµРєСѓС‰СѓСЋ РёСЃС‚РѕСЂРёСЋ
    let hist = JSON.parse(localStorage.getItem('nisha_history') || '[]');
    
    // РЈР±РёСЂР°РµРј С‚РѕРІР°СЂ СЃ РЅСѓР¶РЅС‹Рј ID
    hist = hist.filter(item => item.id !== itemId);
    
    // РЎРѕС…СЂР°РЅСЏРµРј РѕР±СЂР°С‚РЅРѕ РІ РїР°РјСЏС‚СЊ С‚РµР»РµС„РѕРЅР°/РџРљ
    localStorage.setItem('nisha_history', JSON.stringify(hist));
    
    // РЎРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµРј СѓРґР°Р»РµРЅРёРµ СЃ Р‘Р” (РµСЃР»Рё СЋР·РµСЂ РІРѕС€РµР» РІ Р°РєРєР°СѓРЅС‚)
    if (currentUser && _supabase) {
        _supabase.from('profiles').update({ 
            viewed_history: hist.map(h => h.id) 
        }).eq('id', currentUser.id).then();
    }
    
    // РњРіРЅРѕРІРµРЅРЅРѕ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј Р±Р»РѕРє РёСЃС‚РѕСЂРёРё (РєР°СЂС‚РѕС‡РєР° РёСЃС‡РµР·РЅРµС‚)
    renderHistory(); 
};
// ==========================================
// Р›РћР“РРљРђ РЎРўР Р•Р›РћР§Р•Рљ Р’ Р›Р•РќРўР• РќРђ РџРљ
// ==========================================
window.scrollGridSlider = function(event, itemId, direction) {
    event.stopPropagation();
    const slider = document.getElementById(`slider-${itemId}`);
    if (!slider) return;
    const slideWidth = slider.offsetWidth;
    slider.scrollBy({ left: slideWidth * direction, behavior: 'smooth' });
};

// ==========================================
// Р›РћР“РРљРђ "Р—РђР”РђРўР¬ Р’РћРџР РћРЎ"
// ==========================================
window.toggleQuestionForm = function() {
    const container = document.getElementById('questionFormContainer');
    if (!container) return;
    
    if (container.style.maxHeight === '0px' || container.style.maxHeight === '') {
        container.style.maxHeight = '100px';
        setTimeout(() => document.getElementById('questionInput').focus(), 100);
    } else {
        container.style.maxHeight = '0px';
    }
};

window.submitQuestion = async function(itemId) {
    if (!currentUser) {
        showToast('Р”Р»СЏ РѕС‚РїСЂР°РІРєРё РІРѕРїСЂРѕСЃР° РЅСѓР¶РЅРѕ РІРѕР№С‚Рё РІ Р°РєРєР°СѓРЅС‚!', 'error');
        openProfileModal();
        return;
    }

    const input = document.getElementById('questionInput');
    const text = input.value.trim();
    if (text.length < 5) {
        showToast('Р’РѕРїСЂРѕСЃ СЃР»РёС€РєРѕРј РєРѕСЂРѕС‚РєРёР№!', 'error');
        return;
    }

    const today = new Date().toLocaleDateString('en-CA');
    let questionData = JSON.parse(localStorage.getItem('nisha_questions') || '{"date":"","count":0}');
    
    if (questionData.date !== today) questionData = { date: today, count: 0 };
    if (questionData.count >= 2) {
        triggerHaptic('error');
        return showToast('Р›РёРјРёС‚: 2 РІРѕРїСЂРѕСЃР° РІ РґРµРЅСЊ.', 'error');
    }

    // Р”РћРЎРўРђР•Рњ Р‘Р•Р—РћРџРђРЎРќРћР• РРњРЇ РўРћР’РђР Рђ РџР РЇРњРћ РР— Р“Р›РћР‘РђР›Р¬РќРћР™ РџР•Р Р•РњР•РќРќРћР™
    let itemName = "РўРѕРІР°СЂ";
    if (currentOpenedItem && currentOpenedItem.id === itemId) {
        itemName = currentOpenedItem.name;
    }

    try {
        const res = await fetch('https://nisha-api.onrender.com/api/question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: currentUser.id,
                email: currentUser.email || 'РќРµРёР·РІРµСЃС‚РЅРѕ',
                itemId: itemId, 
                itemName: itemName, 
                questionText: text 
            })
        });

        const data = await res.json();
        
        if (data.success) {
            questionData.count += 1;
            localStorage.setItem('nisha_questions', JSON.stringify(questionData));
            input.value = '';
            window.toggleQuestionForm(); 
            showToast('Р’РѕРїСЂРѕСЃ РѕС‚РїСЂР°РІР»РµРЅ!', 'success');
        } else {
            showToast('РћС€РёР±РєР° РїСЂРё РѕС‚РїСЂР°РІРєРµ РІРѕРїСЂРѕСЃР°.', 'error');
        }
    } catch (err) {
        showToast('РћС€РёР±РєР° СЃРѕРµРґРёРЅРµРЅРёСЏ СЃ СЃРµСЂРІРµСЂРѕРј.', 'error');
    }
};
// ==========================================
// Р›РћР“РРљРђ РћРўРћР‘Р РђР–Р•РќРРЇ Р РћР‘РќРћР’Р›Р•РќРРЇ Q&A
// ==========================================
window.loadItemQuestions = async function(itemId) {
    const { data, error } = await _supabase.from('item_questions').select('*').eq('item_id', itemId).order('created_at', { ascending: true });
    
    const wrapper = document.getElementById('qaWrapper');
    const list = document.getElementById('qaList');
    
    if (data && data.length > 0 && wrapper && list) {
        wrapper.style.display = 'block';
        list.innerHTML = '';
        data.forEach(q => {
            // Р‘Р•Р—РћРџРђРЎРќРћРЎРўР¬: РћС‡РёС‰Р°РµРј С‚РµРєСЃС‚
            const safeQ = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(q.question) : q.question;
            const safeA = q.answer ? (typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(q.answer) : q.answer) : null;
            const safeU = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(q.user_name) : q.user_name;

            let answerHtml = safeA ? `<div style="color: var(--accent-green); font-size: 12px; font-weight: bold; margin-top: 4px;">в†і NISHA: ${safeA}</div>` : '';
            list.innerHTML += `
                <div style="border-left: 2px solid #333; padding-left: 10px; margin-bottom: 12px; font-family: var(--font-main);">
                    <span style="color:#888; font-size:11px; font-family:var(--font-mono);">@${safeU}:</span>
                    <div style="color:#ddd; font-size:13px; margin-top:2px;">${safeQ}</div>
                    ${answerHtml}
                </div>`;
        });
    } else if (wrapper) {
        wrapper.style.display = 'none'; // РџСЂСЏС‡РµРј РІРµСЃСЊ Р±Р»РѕРє, РµСЃР»Рё РІРѕРїСЂРѕСЃРѕРІ РЅРµС‚
    }
};

// РџРѕРґРїРёСЃС‹РІР°РµРјСЃСЏ РЅР° РѕР±РЅРѕРІР»РµРЅРёСЏ РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё (РєРѕРіРґР° РѕС‚РєСЂС‹С‚Р° РєР°СЂС‚РѕС‡РєР°)
if (_supabase) {
    _supabase.channel('public-qa-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'item_questions' }, payload => {
            // Р•СЃР»Рё СЃРµР№С‡Р°СЃ РѕС‚РєСЂС‹С‚Р° РєР°СЂС‚РѕС‡РєР° С‚РѕРІР°СЂР° Рё РїСЂРёС€Р»Рѕ РѕР±РЅРѕРІР»РµРЅРёРµ РёРјРµРЅРЅРѕ РїРѕ СЌС‚РѕРјСѓ С‚РѕРІР°СЂСѓ
            if (currentOpenedItem && payload.new && payload.new.item_id === currentOpenedItem.id) {
                window.loadItemQuestions(currentOpenedItem.id); // РџРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј СЃРїРёСЃРѕРє РІРѕРїСЂРѕСЃРѕРІ РЅР°Р¶РёРІСѓСЋ!
            }
        })
        .subscribe();
}
// ==========================================
// РЈРњРќРђРЇ Р’РљР›РђР”РљРђ (Р’РћР—Р’Р РђРў РљР›РР•РќРўРђ)
// ==========================================
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // Р®Р·РµСЂ СѓС€РµР» РЅР° РґСЂСѓРіСѓСЋ РІРєР»Р°РґРєСѓ
        if (cart.length > 0) {
            document.title = `(${cart.length}) рџ›’ Р–РґРµРј С‚РµР±СЏ | NISHA`;
        } else {
            document.title = `Zzz... | NISHA`;
        }
    } else {
        // Р®Р·РµСЂ РІРµСЂРЅСѓР»СЃСЏ
        if (currentOpenedItem) {
            document.title = `NISHA | ${currentOpenedItem.brand} - ${currentOpenedItem.name}`;
        } else {
            document.title = 'NISHA | Underground Store';
        }
    }
});
// ==========================================
// PULL-TO-REFRESH (РљРђРљ Р’ РќРђРўРР’РќР«РҐ РџР РР›РћР–Р•РќРРЇРҐ)
// ==========================================
let touchStartY = 0;
document.addEventListener('touchstart', e => {
    // Р Р°Р±РѕС‚Р°РµС‚ С‚РѕР»СЊРєРѕ РµСЃР»Рё РјС‹ РІ СЃР°РјРѕРј РІРµСЂС…Сѓ СЃС‚СЂР°РЅРёС†С‹
    if (window.scrollY === 0) touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
    if (window.scrollY === 0 && touchStartY > 0) {
        let touchEndY = e.changedTouches[0].clientY;
        // Р•СЃР»Рё РїРѕС‚СЏРЅСѓР»Рё РІРЅРёР· Р±РѕР»СЊС€Рµ С‡РµРј РЅР° 150px
        if (touchEndY - touchStartY > 150) {
            triggerHaptic('medium'); // Р’РёР±СЂР°С†РёСЏ
            showToast('РћР‘РќРћР’Р›Р•РќРР• Р‘РђР—Р« Р”РђРќРќР«РҐ...', 'success');
            loadAllItems(); // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј С‚РѕРІР°СЂС‹ РёР· Р±Р°Р·С‹ Р±РµР· РїРµСЂРµР·Р°РіСЂСѓР·РєРё СЃС‚СЂР°РЅРёС†С‹
        }
    }
    touchStartY = 0;
}, { passive: true });
// ==========================================
// Р›РћР“РРљРђ РђРќРРњРђР¦РР Р”Р’РћР™РќРћР“Рћ РўРђРџРђ
// ==========================================
window.handleDoubleTapLike = async function(event, itemId, container) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    // 1. РЎРѕР·РґР°РµРј Рё РїРѕРєР°Р·С‹РІР°РµРј Р·РІРµР·РґСѓ
    const star = document.createElement('div');
    star.className = 'double-tap-star-anim';
    star.innerText = 'в…'; 
    container.appendChild(star);

    // РЈРґР°Р»СЏРµРј СЌР»РµРјРµРЅС‚ РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ Р°РЅРёРјР°С†РёРё
    setTimeout(() => star.remove(), 800);
    
    // Р’РєР»СЋС‡Р°РµРј Р¶РµСЃС‚РєСѓСЋ РІРёР±СЂР°С†РёСЋ С‚РµР»РµС„РѕРЅР°
    if (typeof triggerHaptic === 'function') triggerHaptic('heavy');

    // 2. Р•СЃР»Рё С‚РѕРІР°СЂ РµС‰Рµ РЅРµ РІ РёР·Р±СЂР°РЅРЅРѕРј вЂ” РґРѕР±Р°РІР»СЏРµРј РµРіРѕ!
    if (!favorites.includes(itemId)) {
        await toggleFav(null, itemId);
    }
};
// ==========================================
// Р¤РћР РњРђ РџРћР”Р”Р•Р Р–РљР (NATIVE MODAL)
// ==========================================

// 1. РћС‚РєСЂС‹С‚РёРµ РѕРєРЅР° (1 РІ 1 РєР°Рє РѕСЃС‚Р°Р»СЊРЅС‹Рµ РјРѕРґР°Р»РєРё)
function openSupportModalWindow() {
    if (typeof lenis !== 'undefined') window.stopLenis();
    document.getElementById('supportInput').value = ''; // РћС‡РёС‰Р°РµРј РїРѕР»Рµ РїСЂРё РѕС‚РєСЂС‹С‚РёРё
    document.getElementById('supportModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// 2. Р‘Р«РЎРўР РђРЇ РћС‚РїСЂР°РІРєР° СЃРѕРѕР±С‰РµРЅРёСЏ (Р’ С„РѕРЅРµ)
async function submitSupportTicket() {
    const input = document.getElementById('supportInput');
    const btn = document.getElementById('btnSubmitSupport');
    const message = input.value.trim();

    if (message.length < 5) {
        showToast('РћРїРёС€Рё РїСЂРѕР±Р»РµРјСѓ РїРѕРґСЂРѕР±РЅРµРµ (РјРёРЅРёРјСѓРј 5 СЃРёРјРІРѕР»РѕРІ)', 'error');
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        return;
    }

    btn.style.pointerEvents = 'none';
    btn.innerText = '[ РћРўРџР РђР’РљРђ... ]';

    const safeText = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(message) : message;
    const userContact = currentUser ? (currentUser.email || currentUser.phone || 'РђРЅРѕРЅРёРј') : 'Р“РѕСЃС‚СЊ';

    // 1. РћС‚РїСЂР°РІР»СЏРµРј Р·Р°РїСЂРѕСЃ РЅР° СЃРµСЂРІРµСЂ Рё РќР• Р–Р”Р•Рњ РѕС‚РІРµС‚Р°! (РСЃРїРѕР»СЊР·СѓРµРј .catch РґР»СЏ С‚РёС…РѕР№ Р·Р°РїРёСЃРё РѕС€РёР±РѕРє)
    fetch('https://nisha-api.onrender.com/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: userContact, message: safeText, clientId: clientFingerprint })
    }).catch(e => console.log("Р¤РѕРЅРѕРІР°СЏ РѕС‚РїСЂР°РІРєР° РІ СЃР°РїРїРѕСЂС‚ РЅРµ СѓРґР°Р»Р°СЃСЊ: ", e));

    // 2. РњРѕРјРµРЅС‚Р°Р»СЊРЅРѕ РїРѕРєР°Р·С‹РІР°РµРј СѓСЃРїРµС… Рё Р·Р°РєСЂС‹РІР°РµРј РѕРєРЅРѕ!
    if (typeof triggerHaptic === 'function') triggerHaptic('success');
    showToast('РЎРѕРѕР±С‰РµРЅРёРµ СѓСЃРїРµС€РЅРѕ РґРѕСЃС‚Р°РІР»РµРЅРѕ Р°РґРјРёРЅСѓ!', 'success');
    closeModal('supportModal');

    // 3. Р’РѕР·РІСЂР°С‰Р°РµРј РєРЅРѕРїРєСѓ РІ РЅРѕСЂРјСѓ (РЅР° РІСЃСЏРєРёР№ СЃР»СѓС‡Р°Р№, РµСЃР»Рё РѕРєРЅРѕ РѕС‚РєСЂРѕСЋС‚ СЃРЅРѕРІР°)
    setTimeout(() => {
        btn.style.pointerEvents = 'auto';
        btn.innerText = 'РћРўРџР РђР’РРўР¬ РЎРР“РќРђР›';
        input.value = '';
    }, 500);
}
// ==========================================
// РЈРњРќРђРЇ Р’РљР›РђР”РљРђ (Р’РћР—Р’Р РђРў РљР›РР•РќРўРђ)
// ==========================================
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // Р®Р·РµСЂ СЃРІРµСЂРЅСѓР» Р±СЂР°СѓР·РµСЂ РёР»Рё СѓС€РµР» РЅР° РґСЂСѓРіСѓСЋ РІРєР»Р°РґРєСѓ
        if (cart.length > 0) {
            // Р•СЃР»Рё РІ РєРѕСЂР·РёРЅРµ С‡С‚Рѕ-С‚Рѕ РµСЃС‚СЊ, РґР°РІРёРј РЅР° РїСЃРёС…РёРєСѓ
            document.title = `(${cart.length}) рџ›’ Р–РґРµРј С‚РµР±СЏ | NISHA`;
        } else {
            // Р•СЃР»Рё РєРѕСЂР·РёРЅР° РїСѓСЃС‚Р°СЏ, РїСЂРѕСЃС‚Рѕ "Р·Р°СЃС‹РїР°РµРј"
            document.title = `Zzz... | NISHA`;
        }
    } else {
        // Р®Р·РµСЂ РІРµСЂРЅСѓР»СЃСЏ РѕР±СЂР°С‚РЅРѕ РЅР° РЅР°С€ СЃР°Р№С‚
        if (typeof currentOpenedItem !== 'undefined' && currentOpenedItem) {
            // Р•СЃР»Рё Сѓ РЅРµРіРѕ РѕС‚РєСЂС‹С‚Р° РєР°СЂС‚РѕС‡РєР° С‚РѕРІР°СЂР°
            document.title = `NISHA | ${currentOpenedItem.brand} - ${currentOpenedItem.name}`;
        } else {
            // Р•СЃР»Рё РѕРЅ РїСЂРѕСЃС‚Рѕ РІ Р»РµРЅС‚Рµ
            document.title = 'NISHA | Underground Store';
        }
    }
});

// --- Р–РР’РћР™ РЎР§Р•РўР§РРљ РЎРРњР’РћР›РћР’ Р”Р›РЇ РџР Р•Р”Р›РћР–РљР (РћР‘Р РђРўРќР«Р™ РћРўРЎР§Р•Рў) ---
function updateCharCount(textarea) {
    const label = document.getElementById('descLabel');
    if (!label) return;
    
    // РЎС‡РёС‚Р°РµРј СЃРєРѕР»СЊРєРѕ РѕСЃС‚Р°Р»РѕСЃСЊ СЃРёРјРІРѕР»РѕРІ
    const remaining = 250 - textarea.value.length;
    
    // Р‘РµСЂРµРј РѕСЂРёРіРёРЅР°Р»СЊРЅС‹Р№ С‚РµРєСЃС‚ РїРµСЂРµРІРѕРґР° (РґР»СЏ Р»СЋР±РѕРіРѕ СЏР·С‹РєР°)
    let originalText = i18next.t('propose.desc_label', { defaultValue: 'РћРџРРЎРђРќРР• Р Р”Р•Р¤Р•РљРўР« (Р”Рћ 250 РЎРРњР’РћР›РћР’):' });
    
    // РџСЂРѕСЃС‚Рѕ Р·Р°РјРµРЅСЏРµРј С‡РёСЃР»Рѕ 250 РЅР° РѕСЃС‚Р°С‚РѕРє
    label.innerText = originalText.replace('250', remaining);
    
    // РљСЂР°СЃРёРј РІ РєСЂР°СЃРЅС‹Р№, РµСЃР»Рё Р»РёРјРёС‚ РёСЃС‡РµСЂРїР°РЅ
    if (remaining <= 0) {
        label.style.color = 'var(--accent-red)';
    } else {
        label.style.color = 'var(--accent-green)';
    }
}

// ==========================================
// РџР•Р Р•РҐРћР” Рљ РЎР›Р•Р”РЈР®Р©Р•РњРЈ РџРћР›Р® РџРћ РќРђР–РђРўРР® ENTER (Р”Р›РЇ РџРљ)
// ==========================================
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const activeEl = document.activeElement;

        // Р•СЃР»Рё РјС‹ РїРµС‡Р°С‚Р°РµРј РІ Textarea (РЅР°РїСЂРёРјРµСЂ, РІ РѕРїРёСЃР°РЅРёРё), Enter РґРѕР»Р¶РµРЅ РґРµР»Р°С‚СЊ РїРµСЂРµРЅРѕСЃ СЃС‚СЂРѕРєРё. РќРµ С‚СЂРѕРіР°РµРј!
        if (activeEl.tagName === 'TEXTAREA') return;

        // Р•СЃР»Рё С„РѕРєСѓСЃ РЅР° РѕР±С‹С‡РЅРѕРј РїРѕР»Рµ РІРІРѕРґР° (input)
        if (activeEl.tagName === 'INPUT') {
            e.preventDefault(); // Р‘Р»РѕРєРёСЂСѓРµРј СЃР»СѓС‡Р°Р№РЅСѓСЋ РѕС‚РїСЂР°РІРєСѓ РёР»Рё РїРµСЂРµР·Р°РіСЂСѓР·РєСѓ СЃС‚СЂР°РЅРёС†С‹

            // РќР°С…РѕРґРёРј СЂРѕРґРёС‚РµР»СЊСЃРєРёР№ Р±Р»РѕРє С„РѕСЂРјС‹, РІ РєРѕС‚РѕСЂРѕР№ РјС‹ СЃРµР№С‡Р°СЃ РЅР°С…РѕРґРёРјСЃСЏ (РћРєРЅРѕ РїСЂРµРґР»РѕР¶РєРё, Р°РІС‚РѕСЂРёР·Р°С†РёСЏ, РєРѕСЂР·РёРЅР°)
            const form = activeEl.closest('.form-layout') || activeEl.closest('.auth-fields');
            
            if (form) {
                // РЎРѕР±РёСЂР°РµРј РІСЃРµ РІРёРґРёРјС‹Рµ РїРѕР»СЏ РІРІРѕРґР° Рё РєРЅРѕРїРєРё РІ СЌС‚РѕР№ С„РѕСЂРјРµ РїРѕ РїРѕСЂСЏРґРєСѓ
                const focusables = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([style*="display: none"]):not([disabled]), textarea, button:not([style*="display: none"]):not([disabled])'));
                
                const currentIndex = focusables.indexOf(activeEl);
                
                // Р•СЃР»Рё РјС‹ РЅР°С€Р»Рё С‚РµРєСѓС‰РµРµ РїРѕР»Рµ Рё РѕРЅРѕ РЅРµ РїРѕСЃР»РµРґРЅРµРµ РІ СЃРїРёСЃРєРµ вЂ” РїСЂС‹РіР°РµРј РЅР° СЃР»РµРґСѓСЋС‰РµРµ!
                if (currentIndex > -1 && currentIndex < focusables.length - 1) {
                    focusables[currentIndex + 1].focus();
                }
            }
        }
    }

    if (window.innerWidth > 900) {
        const pModal = document.getElementById('productModal');
        if (pModal && pModal.style.display === 'flex') {
            if (e.key === 'Escape') {
                closeModal('productModal');
            } else if (e.key === 'ArrowLeft') {
                if (typeof moveSlide === 'function') moveSlide(-1);
            } else if (e.key === 'ArrowRight') {
                if (typeof moveSlide === 'function') moveSlide(1);
            }
        }
    }
});

// ==========================================
// РЎР›РђР™Р”Р•Р  РћРўР—Р«Р’РћР’ (РџР РћРљР РЈРўРљРђ)
// ==========================================
window.scrollReviews = function(direction) {
    const slider = document.getElementById('reviewsContainerList');
    if (!slider) return;
    const card = slider.querySelector('.review-card-ui');
    if (!card) return;
    const colWidth = card.offsetWidth + 15;
    const scrollAmount = window.innerWidth > 900 ? (colWidth * 2) : colWidth;
    slider.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
};



document.addEventListener('DOMContentLoaded', () => {
    initSliderSwipe();
    initMobileSwipe();
});

// ==========================================
// WEB PUSH РџРћР”РџРРЎРљРђ
// ==========================================
let pushPrompted = false;
async function subscribeUserToPush(registration, silent = false) {
    try {
        if (Notification.permission === 'denied') return;
        
        let targetSub = await registration.pushManager.getSubscription();
        
        if (!targetSub) {
            if (silent) return;
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
            
            const res = await fetch('https://nisha-api.onrender.com/api/vapid-key');
            if (!res.ok) return;
            const { publicKey } = await res.json();
            
            const padding = '='.repeat((4 - publicKey.length % 4) % 4);
            const base64 = (publicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }

            targetSub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: outputArray
            });
        }
        
        if (targetSub) {
            const payload = {
                subscription: targetSub,
                userId: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : clientFingerprint
            };
            await fetch('https://nisha-api.onrender.com/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
    } catch(e) {
        console.error('Push error:', e);
    }
}

document.addEventListener('click', (e) => {
    if (pushPrompted) return;
    
    // 1. РРіРЅРѕСЂРёСЂСѓРµРј, РµСЃР»Рё РѕС‚РєСЂС‹С‚Рѕ Р»СЋР±РѕРµ РјРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ (РўРѕРІР°СЂ, РљРѕСЂР·РёРЅР°, РћС„РѕСЂРјР»РµРЅРёРµ Рё С‚Рґ)
    const isModalOpen = Array.from(document.querySelectorAll('[id$="Modal"], .modal-overlay, #cartSidebar')).some(m => {
        const style = window.getComputedStyle(m);
        return style.display === 'flex' || style.display === 'block' || m.classList.contains('active');
    });
    if (isModalOpen) return;
    
    // 2. РРіРЅРѕСЂРёСЂСѓРµРј РєР»РёРє РїРѕ РєР°СЂС‚РѕС‡РєРµ С‚РѕРІР°СЂР° (С‡С‚РѕР±С‹ РЅРµ РїРµСЂРµР±РёРІР°С‚СЊ РѕС‚РєСЂС‹С‚РёРµ С‚РѕРІР°СЂР°)
    if (e.target.closest('.item-card')) return;

    // 3. РРіРЅРѕСЂРёСЂСѓРµРј РєР»РёРєРё РїРѕ РЅРёР¶РЅРµРјСѓ РЅР°РІРёРіР°С‚РѕСЂСѓ/РєРѕСЂР·РёРЅРµ
    if (e.target.closest('.bottom-nav, #cartBtn, #profileBtn')) return;

    // Р•СЃР»Рё РІСЃС‘ С‡РёСЃС‚Рѕ вЂ” РјС‹ РІ Р»РµРЅС‚Рµ С‚РѕРІР°СЂРѕРІ, Рё РєР»РёРє Р±С‹Р» РїРѕ Р±РµР·РѕРїР°СЃРЅРѕРјСѓ СЌР»РµРјРµРЅС‚Сѓ (С„РёР»СЊС‚СЂ, Р»РѕРіРѕ, С„РѕРЅ)
    pushPrompted = true;
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            subscribeUserToPush(reg);
        });
    }
});
// Р”РРќРђРњРР§Р•РЎРљРћР• РћР‘РќРћР’Р›Р•РќРР• Р‘Р•Р™Р”Р–РРљРћР’ РќРђ РљРђР РўРћР§РљР•
window.updateCardDOM = function(item) {
    const cards = document.querySelectorAll(`.item-card[data-id="${item.id}"]`);
    cards.forEach(card => {
        // РћС‡РёС‰Р°РµРј СЃС‚Р°СЂС‹Рµ Р±РµР№РґР¶Рё СЃС‚Р°С‚СѓСЃР°
        const oldBadges = card.querySelectorAll('.sold-badge, .reserved-badge, .system-status-bar');
        oldBadges.forEach(b => b.remove());
        card.classList.remove('sold-out', 'reserved-item');

        // Р”РѕР±Р°РІР»СЏРµРј РЅРѕРІС‹Рµ Р±РµР№РґР¶Рё SOLD / RESERVED
        if (item.status === 'sold') {
            card.classList.add('sold-out');
            card.insertAdjacentHTML('afterbegin', '<div class="sold-badge">SOLD</div>');
        } else if (item.status === 'reserved') {
            card.classList.add('reserved-item');
            card.insertAdjacentHTML('afterbegin', '<div class="reserved-badge">RESERVED</div>');
        } else {
            // Р”Р»СЏ РґРѕСЃС‚СѓРїРЅС‹С… С‚РѕРІР°СЂРѕРІ - РіРµРЅРµСЂРёСЂСѓРµРј СЃРёСЃС‚РµРјСѓ SALE / HOT / TOP
            const hasSale = item.is_sale;
            const hasHot = (item.views_count || 0) >= 25;
            const isTop = item.is_top === true && item.top_until && new Date(item.top_until).getTime() > Date.now();

            if (hasSale || hasHot || isTop) {
                let badgeHTML = `<div class="system-status-bar">`;
                if (isTop) {
                    badgeHTML += `<span class="status-item status-top"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> TOP</span>`;
                }
                if (isTop && (hasSale || hasHot)) badgeHTML += `<div class="status-divider"></div>`;
                if (hasSale) badgeHTML += `<span class="status-item status-sale">% SALE</span>`;
                if (hasSale && hasHot) badgeHTML += `<div class="status-divider"></div>`;
                if (hasHot) {
                    const chartSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
                    badgeHTML += `<span class="status-item status-hot">${chartSvg} HOT</span>`;
                }
                badgeHTML += `</div>`;
                
                card.insertAdjacentHTML('afterbegin', badgeHTML);
            }
        }
        
        // РћР±РЅРѕРІР»СЏРµРј С†РµРЅСѓ РґРёРЅР°РјРёС‡РµСЃРєРё
        const priceDiv = card.querySelector('.price-container');
        if (priceDiv) {
            const curr = getCurrency();
            if (item.is_sale && item.old_price) {
                priceDiv.innerHTML = `<span class="old-price">${item.old_price} ${curr}</span><span class="new-price">${item.price} ${curr}</span>`;
            } else {
                priceDiv.innerHTML = `${item.price} ${curr}`;
            }
        }
    });
};









