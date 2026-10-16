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

// 5. Подключение конфигурации и модулей приложения в строгом порядке зависимостей
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
