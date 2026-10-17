// ==========================================
// NISHA STORE - MAIN VITE ENTRY POINT
// ==========================================

// 1. Инициализация всех внешних библиотек (ДОЛЖНА выполняться строго первой)
import './init-libs.js';

// 2. Единое реактивное хранилище состояния (Reactive State Store)
import '../js/core/store.js';

// 3. Фоновый поисковый воркер Fuse.js (Web Worker)
import '../js/core/search-worker-client.js';

// 4. Стили
import '../style.css';

// 5. Подключение конфигурации и базовых модулей ядра
import '../config.js';
import '../js/core/helpers.js';
import '../js/core/i18n.js';
import '../js/core/pwa-network.js';
import '../js/ui/windows.js';
import '../js/ui/system-features.js';
import '../js/auth/auth.js';

// 6. Code Splitting: Ленивая подгрузка вторичных модальных модулей (Предложка, Отзывы, Чат поддержки)
import '../js/core/lazy-loader.js';

// 7. Основные модули витрины и оркестратор приложения
import '../js/catalog/catalog.js';
import '../js/catalog/live-search.js';
import '../js/cart/cart.js';
import '../js/product/product.js';
import '../js/profile/profile.js';
import '../app.js';
