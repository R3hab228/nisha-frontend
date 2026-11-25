(function () {
    'use strict';
    var scriptEl = document.currentScript;
    var docKey = (scriptEl && scriptEl.dataset && scriptEl.dataset.docKey) || document.body.dataset.docKey || 'return';
    var buttons = document.querySelectorAll('.lang-btn');
    var backLabels = { ua: '[ ← КАТАЛОГ ]', ru: '[ ← КАТАЛОГ ]', en: '[ ← CATALOG ]' };

    function norm(l) {
        l = String(l || '').toLowerCase();
        if (l.startsWith('ru')) return 'ru';
        if (l.startsWith('en')) return 'en';
        return 'ua';
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderList(items) {
        var html = '<ul>';
        for (var i = 0; i < items.length; i += 1) {
            if (items[i]) html += '<li>' + esc(items[i]) + '</li>';
        }
        return html + '</ul>';
    }

    function render(lang, data) {
        var d = data && data.translation && data.translation.legal_docs && data.translation.legal_docs[docKey];
        if (!d) return;
        document.documentElement.lang = lang === 'ua' ? 'uk' : lang;
        var backLink = document.getElementById('backLink');
        if (backLink) backLink.textContent = backLabels[lang] || backLabels.ua;
        buttons.forEach(function (b) { b.classList.toggle('active', b.dataset.lang === lang); });

        var docBody = document.getElementById('docBody');
        if (!docBody) return;

        var h3Class = docKey === 'return' ? ' class="danger"' : '';
        var p1Items = docKey === 'shipping'
            ? [d.p1_1, d.p1_2, d.p1_3, d.p1_4]
            : [d.p1_1, d.p1_2];

        docBody.innerHTML =
            '<h1>' + esc(d.title) + '</h1>' +
            '<h2>' + esc(d.h1) + '</h2>' + renderList(p1Items) +
            '<h2>' + esc(d.h2) + '</h2>' + renderList([d.p2_1, d.p2_2, d.p2_3]) +
            '<h2' + h3Class + '>' + esc(d.h3) + '</h2>' + renderList([d.p3_1, d.p3_2]) +
            '<h2>' + esc(d.h4) + '</h2>' + renderList([d.p4_1, d.p4_2]);
    }

    function loadLang(lang) {
        lang = norm(lang);
        try { localStorage.setItem('nisha_lang', lang); } catch (_) {}
        fetch('/locales/' + lang + '.json')
            .then(function (r) { return r.json(); })
            .then(function (data) { render(lang, data); })
            .catch(function () {});
    }

    buttons.forEach(function (b) {
        b.addEventListener('click', function () { loadLang(b.dataset.lang); });
    });

    var saved = 'ua';
    try { saved = norm(localStorage.getItem('nisha_lang')); } catch (_) {}
    loadLang(saved);
})();
