// ==========================================
// NISHA SEARCH WORKER CLIENT
// High-performance asynchronous bridge to Fuse.js Web Worker with synchronous fallback
// ==========================================

import SearchWorker from '../../src/workers/search.worker.js?worker';

(function() {
    'use strict';

    let worker = null;
    let isWorkerReady = false;
    let requestIdCounter = 0;
    const pendingRequests = new Map();
    const lastActiveRequestId = { live: 0, catalog: 0 };

    // Попытка инициализации Web Worker
    try {
        if (typeof Worker !== 'undefined') {
            worker = new SearchWorker();

            worker.onmessage = function(e) {
                const data = e.data;
                if (!data) return;

                if (data.type === 'ITEMS_SET_SUCCESS') {
                    isWorkerReady = true;
                }

                if (data.requestId !== undefined && pendingRequests.has(data.requestId)) {
                    const { resolve, channel, reqId } = pendingRequests.get(data.requestId);
                    pendingRequests.delete(data.requestId);

                    // Проверка на устаревшие запросы (race condition protection)
                    if (channel && reqId < lastActiveRequestId[channel]) {
                        return; // Запрос устарел, более новый уже отправлен
                    }

                    if (data.type === 'SEARCH_LIVE_RESULTS') {
                        resolve(data.results || []);
                    } else if (data.type === 'SEARCH_CATALOG_RESULTS') {
                        resolve(data.matchedIds || []);
                    } else {
                        resolve(data);
                    }
                }
            };

            worker.onerror = function(err) {
                console.warn('[SearchWorker] Worker error, falling back to main-thread Fuse:', err);
                isWorkerReady = false;
            };
        }
    } catch (e) {
        console.warn('[SearchWorker] Web Worker initialization failed, using main-thread Fuse:', e);
        worker = null;
        isWorkerReady = false;
    }

    // Вспомогательный синхронный fallback в основном потоке на случай сбоя Worker
    let _fallbackFuse = null;
    let _fallbackItemsRef = null;

    function getFallbackFuse(items) {
        if (typeof window.Fuse === 'undefined') return null;
        if (!_fallbackFuse || _fallbackItemsRef !== items) {
            _fallbackItemsRef = items;
            _fallbackFuse = new window.Fuse(items, {
                includeScore: true,
                includeMatches: true,
                threshold: 0.4,
                ignoreLocation: true,
                useExtendedSearch: true,
                keys: [
                    { name: 'tags', weight: 1.0 },
                    { name: 'brand', weight: 0.8 },
                    { name: 'name', weight: 0.8 },
                    { name: 'size', weight: 0.8 },
                    { name: 'category', weight: 0.2 }
                ]
            });
        }
        return _fallbackFuse;
    }

    // ПУБЛИЧНЫЙ КЛИЕНТСКИЙ API
    const searchWorkerClient = {
        // Загрузка товаров в воркер
        setItems(items) {
            if (!Array.isArray(items)) return;
            _fallbackItemsRef = null;
            _fallbackFuse = null;

            if (worker) {
                const reqId = ++requestIdCounter;
                worker.postMessage({
                    type: 'SET_ITEMS',
                    items: items,
                    requestId: reqId
                });
            }
        },

        // Быстрый асинхронный поиск для живого выпадающего списка
        searchLive(query, limit = 8) {
            const reqId = ++requestIdCounter;
            lastActiveRequestId.live = reqId;

            // Если воркер доступен и готов — выполняем поиск в фоновом потоке
            if (worker && isWorkerReady) {
                return new Promise((resolve) => {
                    pendingRequests.set(reqId, { resolve, channel: 'live', reqId });
                    worker.postMessage({
                        type: 'SEARCH_LIVE',
                        query,
                        limit,
                        requestId: reqId
                    });

                    // Таймаут на случай непредвиденного зависания воркера
                    setTimeout(() => {
                        if (pendingRequests.has(reqId)) {
                            pendingRequests.delete(reqId);
                            resolve(searchWorkerClient.fallbackLiveSearch(query, limit));
                        }
                    }, 400);
                });
            }

            // Мгновенный синхронный fallback
            return Promise.resolve(searchWorkerClient.fallbackLiveSearch(query, limit));
        },

        // Поиск по каталогу (возвращает массив ID подходящих товаров в порядке релевантности)
        searchCatalog(query, candidateIds = null) {
            const reqId = ++requestIdCounter;
            lastActiveRequestId.catalog = reqId;

            if (worker && isWorkerReady) {
                return new Promise((resolve) => {
                    pendingRequests.set(reqId, { resolve, channel: 'catalog', reqId });
                    worker.postMessage({
                        type: 'SEARCH_CATALOG',
                        query,
                        candidateIds,
                        requestId: reqId
                    });

                    setTimeout(() => {
                        if (pendingRequests.has(reqId)) {
                            pendingRequests.delete(reqId);
                            resolve(searchWorkerClient.fallbackCatalogSearch(query, candidateIds));
                        }
                    }, 400);
                });
            }

            return Promise.resolve(searchWorkerClient.fallbackCatalogSearch(query, candidateIds));
        },

        // Синхронный fallback для живого поиска
        fallbackLiveSearch(query, limit = 8) {
            const items = window.allItems || [];
            const fuse = getFallbackFuse(items);
            if (!fuse || !query || !query.trim()) return [];

            const cleanTerm = query.replaceAll('#', '').trim().toLowerCase();
            const queryVariants = (typeof window.expandSearchQuery === 'function')
                ? window.expandSearchQuery(cleanTerm)
                : [cleanTerm];

            const collected = [];
            const seenIds = new Set();
            for (const variant of queryVariants) {
                const subResults = fuse.search(variant);
                for (let i = 0; i < subResults.length; i++) {
                    const r = subResults[i];
                    if (!seenIds.has(r.item.id)) {
                        seenIds.add(r.item.id);
                        collected.push({
                            item: r.item,
                            matches: r.matches,
                            score: r.score
                        });
                        if (collected.length >= limit) break;
                    }
                }
                if (collected.length >= limit) break;
            }
            return collected.slice(0, limit);
        },

        // Синхронный fallback для каталога
        fallbackCatalogSearch(query, candidateIds = null) {
            const items = window.allItems || [];
            const fuse = getFallbackFuse(items);
            if (!fuse || !query || !query.trim()) return candidateIds || [];

            const cleanTerm = query.replaceAll('#', '').trim().toLowerCase();
            const queryVariants = (typeof window.expandSearchQuery === 'function')
                ? window.expandSearchQuery(cleanTerm)
                : [cleanTerm];

            const candidateSet = candidateIds ? new Set(candidateIds) : null;
            const matchedIds = [];
            const seenIds = new Set();

            for (const variant of queryVariants) {
                const results = fuse.search(variant);
                for (let i = 0; i < results.length; i++) {
                    const id = results[i].item.id;
                    if (!seenIds.has(id)) {
                        if (!candidateSet || candidateSet.has(id)) {
                            seenIds.add(id);
                            matchedIds.push(id);
                        }
                    }
                }
            }
            return matchedIds;
        },

        isReady() {
            return isWorkerReady;
        },

        invalidateCache() {
            _fallbackFuse = null;
            _fallbackItemsRef = null;
        }
    };

    window.searchWorker = searchWorkerClient;
    window.invalidateFuseCache = function() {
        searchWorkerClient.invalidateCache();
        if (window.allItems) {
            searchWorkerClient.setItems(window.allItems);
        }
    };

})();
