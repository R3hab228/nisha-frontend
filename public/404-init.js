(function () {
    'use strict';
    var fakeId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
        : Math.random().toString(36).substring(2, 10).toUpperCase();
    var el = document.getElementById('session-id');
    if (el) el.textContent = fakeId + '-' + Date.now();

    setTimeout(function () {
        window.location.href = '/';
    }, 15000);
})();
