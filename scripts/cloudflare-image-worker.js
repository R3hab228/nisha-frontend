/**
 * CLOUDFLARE WORKER: NISHA STORE CDN & ON-THE-FLY IMAGE RESIZING
 * Deploy to: nisha-cdn.mtyagniryadno.workers.dev
 * 
 * Features:
 * 1. Automatic On-The-Fly WebP / AVIF conversion and compression via Cloudflare Edge.
 * 2. Responsive Resizing with parameters: ?w=400&q=85&fmt=webp (or ?width=400&quality=85).
 * 3. 30-Day Browser & Edge Cache with immutable headers for ultra-fast repeating loads.
 * 4. Graceful Fallback: If resizing is unsupported or disabled, proxies the clean Supabase asset directly.
 */

const SUPABASE_ORIGIN = 'https://nmpuefxqtkhvtltdvllz.supabase.co';

export default {
    async fetch(request, env, ctx) {
        // Handle CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Max-Age': '86400',
                }
            });
        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        const url = new URL(request.url);
        const targetUrl = new URL(url.pathname, SUPABASE_ORIGIN);

        // Parse query params for resizing
        const width = url.searchParams.get('w') || url.searchParams.get('width');
        const height = url.searchParams.get('h') || url.searchParams.get('height');
        const quality = url.searchParams.get('q') || url.searchParams.get('quality') || '85';
        const format = url.searchParams.get('fmt') || url.searchParams.get('format') || 'webp';

        const isImage = /\.(webp|jpe?g|png|avif)$/i.test(url.pathname);
        const hasResizeParams = Boolean(width || height || quality !== '85' || format !== 'webp');

        // Cloudflare Image Resizing options
        if (isImage && (hasResizeParams || width)) {
            const cfOptions = {
                image: {
                    quality: Math.min(100, Math.max(20, parseInt(quality, 10) || 85)),
                    format: format === 'origin' ? undefined : (format || 'webp'),
                    fit: 'scale-down',
                    metadata: 'none',
                }
            };
            if (width) cfOptions.image.width = Math.min(2400, Math.max(32, parseInt(width, 10)));
            if (height) cfOptions.image.height = Math.min(2400, Math.max(32, parseInt(height, 10)));

            try {
                const response = await fetch(targetUrl.toString(), {
                    headers: request.headers,
                    cf: cfOptions
                });

                if (response.ok) {
                    const newHeaders = new Headers(response.headers);
                    newHeaders.set('Access-Control-Allow-Origin', '*');
                    newHeaders.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400, immutable');
                    newHeaders.set('Vary', 'Accept');
                    return new Response(response.body, {
                        status: response.status,
                        headers: newHeaders
                    });
                }
            } catch (err) {
                // If CF image resizing fails, seamlessly fall through to direct proxy
                console.warn('Image resizing error, falling back to direct proxy:', err);
            }
        }

        // Direct edge-cached proxy to Supabase Storage
        const cache = caches.default;
        const cacheKey = new Request(targetUrl.toString(), request);
        let cachedResponse = await cache.match(cacheKey);

        if (!cachedResponse) {
            const originResponse = await fetch(targetUrl.toString() + url.search, {
                headers: request.headers,
                cf: {
                    cacheTtl: 2592000,
                    cacheEverything: true
                }
            });

            const newHeaders = new Headers(originResponse.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            if (originResponse.ok) {
                newHeaders.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400, immutable');
            }

            cachedResponse = new Response(originResponse.body, {
                status: originResponse.status,
                headers: newHeaders
            });

            if (originResponse.ok && request.method === 'GET') {
                ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
            }
        }

        return cachedResponse;
    }
};
