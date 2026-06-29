const CACHE_NAME = 'nisha-cache-v106'; 
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
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

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

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                // Если пропал интернет и страницы нет в кэше — отдаем главную страницу (интерфейс загрузится из кэша)
                // Так как у нас Single Page App, главная страница сможет сказать "Нет связи с БД" вместо вылета динозавра
                if (event.request.mode === 'navigate') {
                    return caches.match('/');
                }
            });
            
            return cachedResponse || fetchPromise;
        })
    );
});