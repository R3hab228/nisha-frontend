const CACHE_NAME = 'nisha-cache-v108'; // Поменяли версию на 107
const STATIC_URLS = ['/', '/index.html', '/app.js', '/config.js', '/style.css', '/locales.json']; // Добавили 404.html

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
    // 1. Игнорируем не-HTTP запросы и POST/PUT/DELETE запросы (SW не должен их кэшировать)
    if (!event.request.url.startsWith('http') || event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // 2. ЖЕСТКОЕ ИСКЛЮЧЕНИЕ: Игнорируем тяжелые медиа и БД
    if (
        url.pathname.endsWith('.mp4') || 
        url.pathname.endsWith('.webm') || 
        url.href.includes('supabase.co/storage') ||
        url.href.includes('/cdn-images/') ||
        event.request.headers.get('range')
    ) {
        return; 
    }

    if (
        url.pathname.startsWith('/api/') || 
        url.hostname.includes('supabase.co') || 
        url.hostname.includes('novaposhta') ||
        url.hostname.includes('onrender.com')
    ) {
        return; 
    }

    // 3. Стратегия Stale-While-Revalidate с умным оффлайном
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                // Если пропал интернет:
                if (event.request.mode === 'navigate') {
                    // Пытаемся отдать "оболочку" сайта (index.html), игнорируя GET-параметры (?item=...)
                    return caches.match('/', { ignoreSearch: true }).then(res => {
                        // Если даже оболочки нет в кэше - отдаем красивую страницу 404 (Терминал без интернета)
                        return res || caches.match('/404.html');
                    });
                }
            });
            
            return cachedResponse || fetchPromise;
        })
    );
});