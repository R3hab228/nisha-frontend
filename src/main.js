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
import '../js/core/apiClient.js';
import '../js/core/helpers-core.js';
import '../js/core/web-locks.js';
import '../js/core/i18n.js';
import '../js/core/pwa-network.js';
import '../js/ui/windows.js';
import '../js/ui/system-features.js';
import '../js/auth/auth.js';

// 6. Code Splitting: Ленивая подгрузка вторичных модулей (Товар, Поиск, Аналитика, Чекаут/НП, Предложка, Отзывы, Чат, Заказы)
import '../js/core/lazy-loader.js';

// 7. Основные модули витрины и оркестратор приложения
import '../js/catalog/catalog.js';
import '../js/cart/cart-core.js';
import '../js/profile/profile-core.js';
import '../app.js';

// 8. Отложенная загрузка некритичной аналитики и RUM (после первого рендера, 0 мс влияния на LCP)
if (typeof window !== 'undefined') {
    let _telemetryLoaded = false;
    const loadTelemetryChunks = () => {
        if (_telemetryLoaded) return;
        _telemetryLoaded = true;
        Promise.all([
            import('../js/core/analytics.js'),
            import('../js/core/rum.js')
        ]).then(([analyticsMod]) => {
            const analyticsApi = (analyticsMod && analyticsMod.default) || window.analytics;
            if (analyticsApi && typeof analyticsApi.init === 'function') {
                analyticsApi.init();
            }
        }).catch(() => {});
    };
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadTelemetryChunks, { timeout: 1500 });
    } else {
        setTimeout(loadTelemetryChunks, 800);
    }
}

// 9. Vercel Speed Insights (Real User Monitoring: LCP, INP, CLS, TTFB)
import { injectSpeedInsights } from '@vercel/speed-insights';
if (typeof window !== 'undefined' && import.meta.env.PROD) {
    try {
        injectSpeedInsights();
    } catch {}
}
