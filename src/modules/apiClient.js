// ==========================================
// NISHA STORE - MODULAR API CLIENT FACADE
// Safe, typed ES module exports for backend communication
// ==========================================

/**
 * Returns active protected apiClient instance
 * @returns {any}
 */
export function getApiClient() {
    if (typeof window !== 'undefined' && window.apiClient) return window.apiClient;
    if (typeof globalThis !== 'undefined' && globalThis.apiClient) return globalThis.apiClient;
    return null;
}

/**
 * Protected API client proxy allowing modular imports:
 * `import { apiClient } from '@/modules';` or `import apiClient from '@/modules/apiClient';`
 */
export const apiClient = new Proxy({}, {
    get(_target, prop) {
        const client = getApiClient();
        if (!client) return undefined;
        const val = client[prop];
        if (typeof val === 'function') {
            return val.bind(client);
        }
        return val;
    },
    has(_target, prop) {
        const client = getApiClient();
        return client ? prop in client : false;
    }
});

/**
 * Warms up Render/Supabase backend server
 * @param {boolean} [force=false]
 * @returns {Promise<any>}
 */
export async function warmupBackendServer(force = false) {
    if (typeof window !== 'undefined' && typeof window.warmupBackendServer === 'function') {
        return window.warmupBackendServer(force);
    }
    const client = getApiClient();
    if (client && typeof client.warmup === 'function') {
        return client.warmup(force);
    }
    return null;
}

/**
 * Resolves full API URL with base domain
 * @param {string} endpoint
 * @returns {string}
 */
export function resolveApiUrl(endpoint) {
    const client = getApiClient();
    if (client && typeof client.resolveUrl === 'function') {
        return client.resolveUrl(endpoint);
    }
    return endpoint;
}

export default apiClient;
