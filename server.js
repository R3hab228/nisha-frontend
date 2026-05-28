// server.js - ПРОКСИ ДЛЯ НОВОЙ ПОЧТЫ
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

const corsOptions = {
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'https://nisha-frontend.pages.dev'], // <-- ВСТАВЬ СЮДА СВОЮ ССЫЛКУ VERCEL
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());

const NP_API_KEY = process.env.NP_API_KEY;

app.post('/api/np-proxy', async (req, res) => {
    try {
        const { modelName, calledMethod, methodProperties } = req.body;
        
        // Запрос к реальному API Новой Почты
        const npResponse = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: NP_API_KEY, // Ключ подставляется здесь, безопасно!
                modelName: modelName,
                calledMethod: calledMethod,
                methodProperties: methodProperties
            })
        });

        const data = await npResponse.json();
        res.json(data);
    } catch (error) {
        console.error("Ошибка прокси НП:", error);
        res.status(500).json({ success: false, error: "Proxy Error" });
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