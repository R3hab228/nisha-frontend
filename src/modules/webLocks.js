// ==========================================
// NISHA STORE - MODULAR WEB LOCKS & LEADER ELECTION FACADE
// Safe, typed ES module exports for multi-tab coordination
// ==========================================

import { callAction } from './_facade.js';

let _isLeader = false;
let _leaderAbortController = null;
const _leaderCallbacks = new Set();

/**
 * Checks if browser supports the Web Locks API
 * @returns {boolean}
 */
export function isWebLocksSupported() {
    return callAction('isWebLocksSupported', [], () => (
        typeof navigator !== 'undefined' &&
        'locks' in navigator &&
        typeof navigator.locks?.request === 'function'
    ));
}

/**
 * Checks whether current browser tab is the elected leader
 * @returns {boolean}
 */
export function isTabLeader() {
    return callAction('isTabLeader', [], () => _isLeader);
}

/**
 * Subscribes a callback to run when this tab is elected as the leader
 * @param {() => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onLeaderElected(callback) {
    return callAction('onLeaderElected', [callback], (cb) => {
        if (typeof cb !== 'function') return () => {};
        if (_isLeader) {
            try { cb(); } catch (e) { console.error('[WebLocks] Leader callback error:', e); }
        }
        _leaderCallbacks.add(cb);
        return () => _leaderCallbacks.delete(cb);
    });
}

/**
 * Runs an async task protected by an exclusive or shared Web Lock
 * When ifAvailable is true (default), returns null if lock cannot be acquired immediately
 * @param {string} lockName
 * @param {() => Promise<any>} taskFn
 * @param {Object} [options]
 * @param {boolean} [options.ifAvailable=true]
 * @param {'exclusive'|'shared'} [options.mode='exclusive']
 * @returns {Promise<any>}
 */
export async function runWithLock(lockName, taskFn, options = {}) {
    return callAction('runWithLock', [lockName, taskFn, options], async (name, fn, opts = {}) => {
        if (typeof fn !== 'function') return null;
        const { ifAvailable = true, mode = 'exclusive' } = opts;

        if (isWebLocksSupported()) {
            try {
                return await navigator.locks.request(name, { mode, ifAvailable }, async (lock) => {
                    if (ifAvailable && !lock) {
                        return null;
                    }
                    return await fn();
                });
            } catch (_) {
                return await fn();
            }
        }

        return await fn();
    });
}

/**
 * Initiates leader election among open tabs of the store
 * @returns {Promise<boolean>}
 */
export function initLeaderElection() {
    return callAction('initLeaderElection', [], () => {
        if (!isWebLocksSupported()) {
            _isLeader = true;
            _leaderCallbacks.forEach(cb => { try { cb(); } catch {} });
            return Promise.resolve(true);
        }

        if (_leaderAbortController) {
            return Promise.resolve(_isLeader);
        }

        _leaderAbortController = new AbortController();

        return navigator.locks.request(
            'nisha_tab_leader',
            { mode: 'exclusive', signal: _leaderAbortController.signal },
            async () => {
                _isLeader = true;
                _leaderCallbacks.forEach(cb => { try { cb(); } catch {} });

                const { promise, resolve } = Promise.withResolvers();
                if (typeof window !== 'undefined') {
                    window.addEventListener('pagehide', resolve, { once: true });
                    window.addEventListener('beforeunload', resolve, { once: true });
                } else {
                    resolve();
                }
                await promise;

                _isLeader = false;
            }
        ).catch(err => {
            if (err && err.name !== 'AbortError') {
                console.debug('[WebLocks] Tab is follower or election standby:', err.message);
            }
        }).finally(() => {
            _isLeader = false;
            _leaderAbortController = null;
        });
    });
}

export default {
    isWebLocksSupported,
    isTabLeader,
    onLeaderElected,
    runWithLock,
    initLeaderElection
};
