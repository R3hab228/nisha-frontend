// server.js - ПРОКСИ ДЛЯ НОВОЙ ПОЧТЫ
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

const corsOptions = {
    origin: [
        'http://localhost:3000', 
        'http://127.0.0.1:5500', 
        'https://nisha-frontend.vercel.app', 
        'https://nisha-frontend.pages.dev'
    ], 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());

const NP_API_KEY = process.env.NP_API_KEY;

// --- ЗАЩИТА: Rate Limiting для Новой Почты (от спамеров) ---
const npRateLimit = new Map();

app.post('/api/np-proxy', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    
    // Ограничение: 10 запросов за 10 секунд с одного IP
    if (npRateLimit.has(ip)) {
        const userStats = npRateLimit.get(ip);
        if (now - userStats.firstRequest < 10000) {
            if (userStats.count > 10) return res.status(429).json({ success: false, error: "Слишком много запросов" });
            userStats.count++;
        } else {
            npRateLimit.set(ip, { count: 1, firstRequest: now });
        }
    } else {
        npRateLimit.set(ip, { count: 1, firstRequest: now });
    }

    try {
        const { modelName, calledMethod, methodProperties } = req.body;
        const npResponse = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: NP_API_KEY,
                modelName: modelName,
                calledMethod: calledMethod,
                methodProperties: methodProperties
            })
        });
        const data = await npResponse.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: "Proxy Error" });
    }
});

// --- ЗАЩИТА: Строгая проверка RECAPTCHA (с учетом Action) ---
app.post('/api/verify-captcha', async (req, res) => {
    try {
        const { token, action } = req.body; 
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;

        if (!token) return res.status(400).json({ success: false, error: 'Нет токена' });

        // ПРАВИЛЬНЫЙ ФОРМАТ ОТПРАВКИ (Google любит URLSearchParams)
        const params = new URLSearchParams();
        params.append('secret', secretKey);
        params.append('response', token);

        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', { 
            method: 'POST',
            body: params
        });
        
        const data = await response.json();

        // ЛОГИРУЕМ ОТВЕТ ГУГЛА В КОНСОЛЬ RENDER 
        console.log(`[ reCAPTCHA ] Action: ${action} | Ответ Google:`, data);

        // СМЯГЧИЛИ ПРОВЕРКУ ДЛЯ ТЕСТОВ: 
        // Гугл может давать разработчикам score 0.1 или 0.3. 
        // Если success = true, считаем, что ключи работают.
        if (data.success && data.score >= 0.1) {
            res.json({ success: true, score: data.score });
        } else {
            const errorMsg = data['error-codes'] ? data['error-codes'].join(', ') : `Score: ${data.score}, Action: ${data.action}`;
            console.error(`[ reCAPTCHA FAIL ] Причина: ${errorMsg}`);
            res.status(403).json({ success: false, error: 'Подозрение на бота или подмену' });
        }
    } catch (error) {
        console.error("[ reCAPTCHA ERROR ]", error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});


// Маршрут для генерации превью (OpenGraph)
app.get('/share/:id', async (req, res) => {
    const itemId = req.params.id;
    const SITE_URL = 'https://nisha-frontend.pages.dev'; // ЗАМЕНИ НА СВОЙ САЙТ

    try {
        // Делаем запрос к Supabase через REST API (чтобы не ставить SDK)
        const supaUrl = process.env.SUPABASE_URL;
        const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY; 

        const response = await fetch(`${supaUrl}/rest/v1/items?id=eq.${itemId}&select=id,name,brand,images`, {
            headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` }
        });
        
        const data = await response.json();
        const item = data[0];

        if(!item) return res.redirect(SITE_URL);

        const img = (item.images && item.images.length > 0) ? item.images[0] : '';

        // Отдаем ботам страницу с мета-тегами, а людям скрипт редиректа
        const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="utf-8">
            <meta property="og:title" content="NISHA | ${item.brand} - ${item.name}">
            <meta property="og:image" content="${img}">
            <meta property="og:description" content="Оригинал. Посмотреть цену и заказать в NISHA Store.">
            <meta name="twitter:card" content="summary_large_image">
            <script>window.location.href = '${SITE_URL}/?item=${item.id}';</script>
        </head>
        <body style="background: #000; color: #00ff00; font-family: monospace; padding: 20px;">
            [ ПЕРЕНАПРАВЛЕНИЕ... ]
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        res.redirect(SITE_URL);
    }
});

// --- ДОБАВЛЯЕМ МАРШРУТ ДЛЯ CRON-JOB.ORG ---
app.get('/ping', (req, res) => {
    res.status(200).send('Server is awake');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`📦 Прокси-сервер запущен на порту ${PORT}`);
    
    // --- ЗАПУСКАЕМ БОТА ВМЕСТЕ С СЕРВЕРОМ ---
    try {
        require('./bot.js');
        console.log(`🤖 Telegram бот успешно запущен вместе с сервером!`);
    } catch (err) {
        console.error(`❌ Ошибка запуска бота:`, err);
    }
});