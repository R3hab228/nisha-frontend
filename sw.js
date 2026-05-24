const CACHE_NAME = 'nisha-cache-v6'; 
const STATIC_URLS = ['/', '/index.html', '/app.js', '/config.js', '/style.css'];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_URLS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // 1. Игнорируем запросы от расширений Chrome (chrome-extension:// и т.д.)
    if (!event.request.url.startsWith('http')) {
        return;
    }

    const url = new URL(event.request.url);
    
    // 2. НЕ кэшируем API запросы (Supabase, Новая почта)
    if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co') || url.hostname.includes('novaposhta')) {
        return; // Браузер сам сделает обычный запрос в сеть
    }

    // Стратегия Stale-While-Revalidate для статики (HTML, CSS, JS, Картинки)
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // Если запрос успешен и это наш сайт (или CDN), обновляем кэш в фоне
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                // Игнорируем ошибку сети для фона
            });
            
            // Отдаем из кэша мгновенно, если есть. Иначе ждем ответа из сети.
            return cachedResponse || fetchPromise;
        })
    );
});