const https = require('node:https');

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function sendReleaseAlert() {
    const token = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_ADMIN_ID;

    if (!token || !chatId) {
        console.log('ℹ️ TG_BOT_TOKEN or TG_ADMIN_ID is not configured. Skipping Telegram release notification.');
        return;
    }

    const repo = process.env.REPO_NAME || 'nisha-frontend';
    const tag = process.env.RELEASE_TAG || 'v1.0.0';
    const releaseName = process.env.RELEASE_NAME || tag;
    const releaseUrl = process.env.RELEASE_URL || `https://github.com/${repo}/releases/tag/${tag}`;
    const actor = process.env.ACTOR || 'github-actions';

    const message = [
        '🚀 <b>Опубликован новый релиз NISHA STORE!</b>',
        '',
        `🏷️ <b>Версия:</b> <code>${escapeHtml(tag)}</code>`,
        `📦 <b>Репозиторий:</b> <code>${escapeHtml(repo)}</code>`,
        `👤 <b>Инициатор:</b> @${escapeHtml(actor)}`,
        `✨ <b>Название:</b> ${escapeHtml(releaseName)}`,
        '',
        `🔗 <a href="${releaseUrl}">Посмотреть релиз и список изменений (Changelog)</a>`
    ].join('\n');

    const payload = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
    });

    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('✅ Telegram release notification sent successfully.');
                } else {
                    console.warn(`⚠️ Telegram API returned status ${res.statusCode}: ${body}`);
                }
                resolve();
            });
        });

        req.on('error', (err) => {
            console.warn('⚠️ Network error sending Telegram alert:', err.message);
            resolve();
        });

        req.setTimeout(10000, () => {
            console.warn('⚠️ Telegram notification request timed out.');
            req.destroy();
            resolve();
        });

        req.write(payload);
        req.end();
    });
}

sendReleaseAlert().catch(err => {
    console.warn('⚠️ Unexpected error in notify-release script:', err.message);
});
