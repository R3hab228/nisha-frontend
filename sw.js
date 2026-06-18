const CACHE_NAME = 'nisha-cache-v99'; 
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
    // 1. Игнорируем запросы не по протоколу http/https (например, расширения)
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);
    
    // 2. КРИТИЧНО: Игнорируем видео файлы и запросы к хранилищу видео
    // Видео не поддерживают стандартное кэширование воркером (Range requests)
    if (url.pathname.endsWith('.mp4') || url.href.includes('items-images')) {
        return; // Просто выходим, браузер скачает видео как обычно
    }

    // 3. НЕ кэшируем API запросы (Supabase, Новая почта)
    if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co') || url.hostname.includes('novaposhta')) {
        return; 
    }

    // Стратегия Stale-While-Revalidate для остальной статики
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {});
            
            return cachedResponse || fetchPromise;
        })
    );
});