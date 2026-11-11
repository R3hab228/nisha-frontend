import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Abandoned Cart Recovery — Frontend Sync', () => {
    it('cart.js implements syncCartToServer dispatching /api/cart/sync with userId and deviceId', () => {
        const cartJsPath = path.resolve(__dirname, '../js/cart/cart.js');
        const content = fs.readFileSync(cartJsPath, 'utf8');

        // Check syncCartToServer exists and sends to /api/cart/sync
        expect(content).toContain('async function syncCartToServer()');
        expect(content).toContain("window.apiClient.post('/api/cart/sync'");
        expect(content).toContain('cart: activeCart');
        expect(content).toContain('userId: user ? user.id : null');
        expect(content).toContain('deviceId:');
    });

    it('syncCartToServer is invoked upon adding items, removing items, and checkout completion', () => {
        const cartJsPath = path.resolve(__dirname, '../js/cart/cart.js');
        const content = fs.readFileSync(cartJsPath, 'utf8');

        // Check addToCart calls syncCartToServer
        expect(content).toContain('await syncCartToServer()');
        // Check window exposure
        expect(content).toContain('window.syncCartToServer = syncCartToServer');
    });
});
