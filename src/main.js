// ==========================================
// NISHA STORE - MAIN VITE ENTRY POINT
// ==========================================

// 1. Стили
import '../style.css';

// 2. Внешние библиотеки (упакованные через npm и привязанные к window для 100% обратной совместимости)
import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'dompurify';
import Fuse from 'fuse.js';
import IMask from 'imask';
import Lenis from 'lenis';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

window.supabase = { createClient };
window.createClient = createClient;
window.DOMPurify = DOMPurify;
window.Fuse = Fuse;
window.IMask = IMask;
window.Lenis = Lenis;
window.i18next = i18next;
window.i18nextBrowserLanguageDetector = LanguageDetector;

// 3. Подключение конфигурации и модулей приложения в строгом порядке зависимостей
import '../config.js';
import '../js/core/helpers.js';
import '../js/ui/windows.js';
import '../js/auth/auth.js';
import '../js/drop/drop.js';
import '../js/chat/chat.js';
import '../js/reviews/reviews.js';
import '../js/catalog/catalog.js';
import '../js/cart/cart.js';
import '../js/product/product.js';
import '../js/profile/profile.js';
import '../app.js';
