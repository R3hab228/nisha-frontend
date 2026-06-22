const CACHE_NAME = 'nisha-cache-v105'; 
const STATIC_URLS = ['/', '/index.html', '/app.js', '/config.js', '/style.css', '/locales.json'];

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
    // 1. Игнорируем не-HTTP запросы (chrome-extension и т.д.)
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // 2. ЖЕСТКОЕ ИСКЛЮЧЕНИЕ: Игнорируем видео, аудио и все файлы из Supabase Storage.
    // Браузер сам отлично их закэширует без нашей помощи.
    if (
        url.pathname.endsWith('.mp4') || 
        url.pathname.endsWith('.webm') || 
        url.href.includes('supabase.co/storage') ||
        url.href.includes('/cdn-images/') ||
        event.request.headers.get('range') // Игнорируем Range-запросы
    ) {
        return; 
    }

    // 3. НЕ кэшируем API запросы (Supabase БД, Render, Новая Почта)
    if (
        url.pathname.startsWith('/api/') || 
        url.hostname.includes('supabase.co') || 
        url.hostname.includes('novaposhta') ||
        url.hostname.includes('onrender.com')
    ) {
        return; 
    }

    // Стратегия Stale-While-Revalidate для HTML/CSS/JS
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                // Игнорируем ошибку сети для фона
            });
            
            return cachedResponse || fetchPromise;
        })
    );
});