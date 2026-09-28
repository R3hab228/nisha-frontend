const CACHE_NAME = 'nisha-cache-v115';
const IMAGE_CACHE = 'nisha-images-v1';
const API_CACHE = 'nisha-api-v1';
const STATIC_URLS = ['/', '/index.html', '/app.js', '/config.js', '/style.css', '/locales.json', '/404.html', '/badge.png'];

// Функция лимитирования кэша
function trimCache(cacheName, maxItems) {
    caches.open(cacheName).then(cache => {
        cache.keys().then(keys => {
            if (keys.length > maxItems) {
                cache.delete(keys[0]).then(() => {
                    trimCache(cacheName, maxItems);
                });
            }
        });
    });
}

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
                    if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE && cacheName !== API_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http') || event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Исключения (видео, сторонние API)
    if (
        url.pathname.endsWith('.mp4') || 
        url.pathname.endsWith('.webm') || 
        event.request.headers.get('range') ||
        url.pathname.startsWith('/api/') || 
        url.hostname.includes('novaposhta') ||
        url.hostname.includes('onrender.com')
    ) {
        return; 
    }

    // --- ПЕРЕХВАТ SUPABASE API ДЛЯ ОФЛАЙНА ---
    if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/items')) {
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(API_CACHE).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                // Если нет сети, отдаем из кэша (вчерашние товары)
                return caches.match(event.request);
            })
        );
        return;
    }

    // --- ИЗОБРАЖЕНИЯ (Cache-First + Лимит) ---
    const isImage = url.hostname.includes('workers.dev') || url.hostname.includes('supabase.co/storage');
    
    if (isImage) {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                        const responseToCache = networkResponse.clone();
                        caches.open(IMAGE_CACHE).then(cache => {
                            cache.put(event.request, responseToCache).then(() => {
                                trimCache(IMAGE_CACHE, 50); // Лимитируем до 50 штук
                            });
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>', {
                        headers: {'Content-Type': 'image/svg+xml'}
                    });
                });
            })
        );
        return; 
    }

    // --- ОСТАЛЬНЫЕ ФАЙЛЫ (Stale-While-Revalidate) ---
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('/', { ignoreSearch: true }).then(res => {
                        return res || caches.match('/404.html');
                    });
                }
            });
            
            return cachedResponse || fetchPromise;
        })
    );
});

// Перехват Push-уведомлений
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/badge.png',
            vibrate: [200, 100, 200],
            data: { url: data.url || '/' }
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
