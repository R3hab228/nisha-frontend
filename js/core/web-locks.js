// ==========================================
// NISHA STORE - WEB LOCKS & LEADER ELECTION API
// Multi-tab synchronization, mutual exclusion & leader election
// ==========================================

let _isLeader = false;
let _leaderAbortController = null;
const _leaderCallbacks = new Set();

/**
 * Checks if browser supports the Web Locks API
 * @returns {boolean}
 */
function isWebLocksSupported() {
    return typeof navigator !== 'undefined' &&
           'locks' in navigator &&
           typeof navigator.locks?.request === 'function';
}
window.isWebLocksSupported = isWebLocksSupported;

/**
 * Checks whether current browser tab is the elected leader
 * @returns {boolean}
 */
function isTabLeader() {
    return _isLeader;
}
window.isTabLeader = isTabLeader;

/**
 * Subscribes a callback to run when this tab is elected as the leader
 * @param {() => void} callback
 * @returns {() => void} Unsubscribe function
 */
function onLeaderElected(callback) {
    if (typeof callback !== 'function') return () => {};
    if (_isLeader) {
        try { callback(); } catch (e) { console.error('[WebLocks] Leader callback error:', e); }
    }
    _leaderCallbacks.add(callback);
    return () => _leaderCallbacks.delete(callback);
}
window.onLeaderElected = onLeaderElected;

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
async function runWithLock(lockName, taskFn, options = {}) {
    if (typeof taskFn !== 'function') return null;
    const { ifAvailable = true, mode = 'exclusive' } = options;

    if (isWebLocksSupported()) {
        try {
            return await navigator.locks.request(lockName, { mode, ifAvailable }, async (lock) => {
                if (ifAvailable && !lock) {
                    // Another tab is actively holding this lock. Skip duplicate operation.
                    return null;
                }
                return await taskFn();
            });
        } catch (err) {
            return await taskFn();
        }
    }

    // Graceful fallback for environments without Web Locks API
    return await taskFn();
}
window.runWithLock = runWithLock;

/**
 * Initiates leader election among open tabs of the store
 * The first tab to acquire 'nisha_tab_leader' becomes Leader until closed or navigated
 * @returns {Promise<boolean>}
 */
function initLeaderElection() {
    if (typeof window === 'undefined') return Promise.resolve(false);

    if (!isWebLocksSupported()) {
        // Fallback: standalone tab always acts as leader
        _isLeader = true;
        _leaderCallbacks.forEach(cb => { try { cb(); } catch {} });
        return Promise.resolve(true);
    }

    if (_leaderAbortController) {
        return Promise.resolve(_isLeader);
    }

    _leaderAbortController = new AbortController();

    const leaderPromise = navigator.locks.request(
        'nisha_tab_leader',
        { mode: 'exclusive', signal: _leaderAbortController.signal },
        async () => {
            _isLeader = true;
            console.info('[WebLocks] Tab elected as Leader (cross-tab coordination active)');
            _leaderCallbacks.forEach(cb => { try { cb(); } catch {} });

            // Hold lock until tab closes, navigates away, or is hidden into bfcache
            const { promise, resolve } = Promise.withResolvers();
            window.addEventListener('pagehide', resolve, { once: true });
            window.addEventListener('beforeunload', resolve, { once: true });
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

    return leaderPromise;
}
window.initLeaderElection = initLeaderElection;

// Auto-initialize leader election in browser environment
if (typeof window !== 'undefined') {
    initLeaderElection();
}
