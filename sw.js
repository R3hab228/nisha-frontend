const CACHE_NAME = 'nisha-cache-v107'; // Поменяли версию на 107
const STATIC_URLS = ['/', '/index.html', '/app.js', '/config.js', '/style.css', '/locales.json', '/404.html']; // Добавили 404.html

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

const IMAGE_CACHE = 'nisha-images-v1';

self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http') || event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Игнорируем тяжелое видео и чужие API
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

    // НАСТОЯЩИЙ ОФЛАЙН: Кэшируем картинки товаров (Cloudflare CDN / Supabase)
    const isImage = url.hostname.includes('workers.dev') || url.hostname.includes('supabase.co/storage');
    
    if (isImage) {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
                if (cachedResponse) return cachedResponse; // Cache-First для картинок
                
                return fetch(event.request).then(networkResponse => {
                    // Кэшируем даже если status === 0 (Opaque cross-origin response)
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                        const responseToCache = networkResponse.clone();
                        caches.open(IMAGE_CACHE).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Если нет интернета и картинки нет в кэше - возвращаем пустой пиксель
                    return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>', {
                        headers: {'Content-Type': 'image/svg+xml'}
                    });
                });
            })
        );
        return; 
    }

    // Для остальных файлов (HTML, JS, CSS): Stale-While-Revalidate
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
// Ловим Push-уведомления от сервера
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/icon.png',
            vibrate: [200, 100, 200],
            data: { url: data.url || '/' }
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Открываем сайт при клике на уведомление
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});