const BUILD_ID = '__BUILD_ID__'; // подставляется при сборке (vite.config.mjs), уникален для каждого деплоя
const CACHE_NAME = 'nisha-cache-' + BUILD_ID;
const IMAGE_CACHE = 'nisha-images-v4';
const API_CACHE = 'nisha-api-v2';
const STATIC_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/locales.json',
    '/locales/ru.json',
    '/locales/ua.json',
    '/locales/en.json',
    '/404.html',
    '/return-policy.html',
    '/badge.png',
    '/icon-192.png',
    '/icon-512.png',
    '/icon.png',
    '/cables.svg'
];

// Оптимизированная пакетная очистка кэша без рекурсии с дебаунсом
let _trimTimeout = null;
function scheduleTrimCache(cacheName, maxItems = 150) {
    if (_trimTimeout) return;
    _trimTimeout = setTimeout(() => {
        _trimTimeout = null;
        caches.open(cacheName).then(cache => {
            cache.keys().then(keys => {
                if (keys && keys.length > maxItems) {
                    const excess = keys.slice(0, keys.length - maxItems);
                    Promise.all(excess.map(k => cache.delete(k))).catch(() => {});
                }
            }).catch(() => {});
        }).catch(() => {});
    }, 4000);
}

self.addEventListener('message', event => {
    if (!event.data) return;
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (const url of STATIC_URLS) {
                try {
                    await cache.add(url);
                } catch (e) {}
            }
        })
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
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http') || event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Исключения (сам Service Worker, видео, сторонние API)
    if (
        url.pathname === '/sw.js' ||
        url.pathname.endsWith('/sw.js') ||
        url.pathname.endsWith('.mp4') || 
        url.pathname.endsWith('.webm') || 
        event.request.headers.get('range') ||
        url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/.well-known/') || 
        url.hostname.includes('novaposhta') ||
        url.hostname === 'accounts.google.com' ||
        url.hostname.includes('onrender.com')
    ) {
        return; 
    }

    // Проверяем происхождение запроса
    const isSameOrigin = url.origin === self.location.origin;
    const isAllowedCdn = (
        url.hostname.includes('cdn.jsdelivr.net') || 
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('unpkg.com') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com')
    );
    const isAllowedBackend = (
        url.hostname.includes('supabase.co') || 
        url.hostname.includes('workers.dev')
    );

    // Сторонние сервисы (аналитика Clarity, TikTok Pixel, GeoJS, Turnstile и сторонние трекеры) НЕ перехватываем в SW!
    if (!isSameOrigin && !isAllowedCdn && !isAllowedBackend) {
        return;
    }

    // --- ХЭШИРОВАННЫЕ АССЕТЫ VITE (/assets/) (Cache-First) ---
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // --- ПЕРЕХВАТ SUPABASE API ДЛЯ ОФЛАЙНА (ТОЛЬКО ПУБЛИЧНЫЙ КАТАЛОГ, БЕЗ ПРОФИЛЕЙ И ЗАКАЗОВ) ---
    const isSupabaseRestApi = (url.hostname.includes('supabase.co') || url.hostname.includes('workers.dev')) &&
        (url.pathname.includes('/rest/v1/items') || url.pathname.includes('/rest/v1/reviews') || url.pathname.includes('/rest/v1/site_broadcasts') || url.pathname.includes('/rest/v1/item_questions'));
    if (isSupabaseRestApi) {
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(API_CACHE).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                // Если нет сети, отдаем из кэша (точный запрос с параметрами, без ignoreSearch)
                return caches.match(event.request).then(cached => cached || new Response('[]', {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                }));
            })
        );
        return; 
    }

    // --- ИЗОБРАЖЕНИЯ (Cache-First + Лимит) ---
    const isImage = (url.hostname.includes('workers.dev') || url.hostname.includes('supabase.co')) &&
                    (url.pathname.includes('/storage/') || /\.(webp|jpg|jpeg|png|gif|svg|avif|ico)$/i.test(url.pathname)) &&
                    !url.pathname.includes('/rest/v1/');
    
    if (isImage) {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                        const responseToCache = networkResponse.clone();
                        caches.open(IMAGE_CACHE).then(cache => {
                            cache.put(event.request, responseToCache).then(() => {
                                scheduleTrimCache(IMAGE_CACHE, 150);
                            });
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    const fallbackSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><rect width="400" height="400" fill="#111"/><rect x="12" y="12" width="376" height="376" fill="none" stroke="#262626" stroke-width="2" stroke-dasharray="6 4"/><path d="M160 170l40 40 40-40M160 230l40-40 40 40" stroke="#333" stroke-width="2" stroke-linecap="round"/><text x="200" y="270" fill="#666" font-family="Courier New, monospace" font-size="11" letter-spacing="2" text-anchor="middle">[ NISHA ARCHIVE ]</text><text x="200" y="290" fill="#ff0055" font-family="Courier New, monospace" font-size="10" letter-spacing="1.5" text-anchor="middle">OFFLINE // NO IMAGE</text></svg>';
                    return new Response(fallbackSvg, {
                        headers: {'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store'}
                    });
                });
            })
        );
        return; 
    }

    // --- ОСНОВНЫЕ ФАЙЛЫ САЙТА (Network-First с fallback на кэш при офлайне) ---
    event.respondWith(
        (async () => {
            try {
                // Пытаемся получить свежую версию из сети
                const networkPromise = fetch(event.request);
                
                // Проверяем наличие в кэше на случай медленной сети / офлайна
                const cachedResponse = await caches.match(event.request, { ignoreSearch: true });

                let networkResponse;
                if (cachedResponse) {
                    // Если копия уже есть в кэше — даем сети до 3.5 сек, иначе плавно отдаем кэш без принудительного разрыва соединения
                    let timeoutId;
                    const timeoutPromise = new Promise(resolve => {
                        timeoutId = setTimeout(() => resolve(null), 3500);
                    });
                    
                    networkResponse = await Promise.race([
                        networkPromise.then(res => {
                            clearTimeout(timeoutId);
                            return res;
                        }).catch(() => null),
                        timeoutPromise
                    ]);

                    if (!networkResponse) {
                        return cachedResponse;
                    }
                } else {
                    // Если в кэше еще ничего нет — ждем ответа от сети (не убиваем на медленном соединении)
                    networkResponse = await networkPromise.catch(() => null);
                }

                const isAllowedToCache = networkResponse && networkResponse.status === 200 && (
                    networkResponse.type === 'basic' || 
                    (networkResponse.type === 'cors' && (
                        url.hostname.includes('cdn.jsdelivr.net') || 
                        url.hostname.includes('cdnjs.cloudflare.com') ||
                        url.hostname.includes('unpkg.com')
                    ))
                );

                if (isAllowedToCache) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache)).catch(() => {});
                }

                if (networkResponse && networkResponse.status === 200) {
                    return networkResponse;
                }

                // Если сеть вернула ошибку или недоступна — отдаем кэш или страницу 404/shell
                if (cachedResponse) return cachedResponse;

                if (event.request.mode === 'navigate') {
                    const fallback = await caches.match('/', { ignoreSearch: true });
                    return fallback || (await caches.match('/404.html')) || Response.error();
                }

                return Response.error();
            } catch (err) {
                // Безопасный перехват любых сетевых отмен (AbortError) и офлайна без unhandled rejection
                const cached = await caches.match(event.request, { ignoreSearch: true });
                if (cached) return cached;
                if (event.request.mode === 'navigate') {
                    const fallback = await caches.match('/', { ignoreSearch: true });
                    return fallback || (await caches.match('/404.html')) || Response.error();
                }
                return Response.error();
            }
        })()
    );
});

// Перехват Push-уведомлений
self.addEventListener('push', event => {
    if (event.data) {
        let data = {};
        try {
            data = event.data.json();
        } catch(e) {
            data = { title: 'NISHA STORE', body: event.data.text() };
        }
        const origin = 'https://www.nisha-store.shop';
        const options = {
            body: data.body,
            icon: (data.icon && !data.icon.includes('vercel.app')) ? data.icon : (origin + '/icon-192.png?v=5'),
            badge: (data.badge && !data.badge.includes('vercel.app')) ? data.badge : (origin + '/badge.png?v=5'),
            vibrate: [200, 100, 200],
            tag: data.tag || (data.itemId ? 'nisha-item-' + data.itemId : (data.id ? 'nisha-item-' + data.id : (data.title ? 'nisha-' + encodeURIComponent(data.title) : 'nisha-push'))),
            renotify: false,
            data: { url: data.url || (origin + '/') }
        };
        event.waitUntil(
            self.registration.showNotification(data.title || 'NISHA STORE', options)
        );
    }
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const PROD_ORIGIN = 'https://www.nisha-store.shop';
    const rawTarget = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';
    
    // Всегда направляем пользователя на официальный домен www.nisha-store.shop, а не на технический Vercel превью
    let targetUrl = rawTarget;
    if (targetUrl.startsWith('/')) {
        targetUrl = PROD_ORIGIN + (targetUrl === '/' ? '/' : targetUrl);
    } else {
        try {
            const parsed = new URL(targetUrl);
            if (parsed.hostname.includes('vercel.app') || (parsed.hostname !== 'www.nisha-store.shop' && parsed.hostname !== 'nisha-store.shop')) {
                parsed.protocol = 'https:';
                parsed.hostname = 'www.nisha-store.shop';
                parsed.port = '';
                targetUrl = parsed.toString();
            }
        } catch(e) {
            targetUrl = PROD_ORIGIN + '/';
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url && client.url.includes('nisha-store.shop') && 'focus' in client) {
                    if (targetUrl !== (PROD_ORIGIN + '/') && 'navigate' in client && !client.url.includes(targetUrl)) {
                        return client.navigate(targetUrl).then(c => c ? c.focus() : client.focus());
                    }
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});
