import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readCartSource } from './helpers/readCartSource.js';

describe('Abandoned Cart Recovery — Frontend Sync', () => {
    it('cart.js implements syncCartToServer dispatching /api/cart/sync with userId and deviceId', () => {
        const content = readCartSource();

        // Check syncCartToServer exists and sends to /api/cart/sync
        expect(content).toContain('async function syncCartToServer()');
        expect(content).toContain("window.apiClient.post('/api/cart/sync'");
        expect(content).toContain('cart: activeCart');
        expect(content).toContain('userId: user ? user.id : null');
        expect(content).toContain('deviceId:');
    });

    it('syncCartToServer is invoked upon adding items, removing items, and checkout completion', () => {
        const content = readCartSource();

        // Check addToCart calls syncCartToServer
        expect(content).toContain('await syncCartToServer()');
        // Check window exposure
        expect(content).toContain('window.syncCartToServer = syncCartToServer');
    });
});
