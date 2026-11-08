const https = require('https');

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function sendTelegramAlert() {
    const token = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_ADMIN_ID;

    if (!token || !chatId) {
        console.log('ℹ️ TG_BOT_TOKEN or TG_ADMIN_ID is not configured in GitHub Secrets. Skipping Telegram alert.');
        return;
    }

    const repo = process.env.REPO_NAME || 'nisha-frontend';
    const branch = process.env.BRANCH_NAME || 'main';
    const sha = (process.env.COMMIT_SHA || '').slice(0, 7) || 'unknown';
    const author = process.env.ACTOR || 'unknown';
    const rawMsg = (process.env.COMMIT_MSG || '').split('\n')[0].trim().slice(0, 100) || 'No commit message';
    const runId = process.env.RUN_ID || '';
    const runUrl = runId ? `https://github.com/${repo}/actions/runs/${runId}` : `https://github.com/${repo}/actions`;

    const message = [
        '🚨 <b>Сбой тестов / сборки в GitHub Actions!</b>',
        '',
        `📦 <b>Репозиторий:</b> <code>${escapeHtml(repo)}</code>`,
        `🌿 <b>Ветка:</b> <code>${escapeHtml(branch)}</code>`,
        `👤 <b>Автор:</b> @${escapeHtml(author)}`,
        `💬 <b>Коммит:</b> <code>${sha}</code> — ${escapeHtml(rawMsg)}`,
        '',
        `🔗 <a href="${runUrl}">Посмотреть логи и причину ошибки</a>`
    ].join('\n');

    const payload = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
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
                    console.log('✅ Telegram failure alert sent successfully.');
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

sendTelegramAlert().catch(err => {
    console.warn('⚠️ Unexpected error in notify-failure script:', err.message);
});
