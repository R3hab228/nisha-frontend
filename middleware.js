export const config = {
  matcher: '/',
};

export default async function middleware(req) {
  const url = new URL(req.url);
  const itemId = url.searchParams.get('item');
  
  // 1. Если это не ссылка на товар - ничего не делаем, грузим обычный сайт
  if (!itemId) {
    return;
  }

  // 2. Проверяем, кто запросил ссылку (Бот Телеграма/Инсты или живой человек)
  const userAgent = req.headers.get('user-agent') || '';
  const isBot = /bot|telegram|facebook|twitter|whatsapp|viber|skype|vkShare/i.test(userAgent);

  if (!isBot) {
    return; // Живому человеку отдаем обычный сайт (он сам подгрузит данные)
  }

  // 3. Бот запросил товар! Идем в Supabase, чтобы достать фотку и цену
  const supabaseUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/rest/v1/items?id=eq.' + itemId + '&select=name,price,brand,photos';
  
  try {
    const dbRes = await fetch(supabaseUrl, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo'
      }
    });
    
    const data = await dbRes.json();
    const item = data[0];

    if (item) {
      // Формируем красивые данные для Telegram
      const title = 'NISHA | ' + (item.brand || '') + ' ' + (item.name || '');
      const description = 'Цена: ' + item.price + ' грн.';
      
      let imageUrl = 'https://i.ibb.co/3s6HhXz/icon.ico'; // дефолт
      if (item.photos && item.photos.length > 0) {
        const photo = item.photos[0];
        if (photo.startsWith('http')) {
            imageUrl = photo;
        } else {
            imageUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/storage/v1/object/public/item-photos/' + photo;
        }
      }

      // 4. Отдаем боту HTML-заглушку ТОЛЬКО с мета-тегами
      const html = <!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title> + title + </title>
  <meta property="og:type" content="website">
  <meta property="og:title" content=" + title + ">
  <meta property="og:description" content=" + description + ">
  <meta property="og:image" content=" + imageUrl + ">
  <meta name="twitter:card" content="summary_large_image">
</head>
<body></body>
</html>;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  } catch (e) {
    console.error('Error in Edge SEO Middleware:', e);
  }
}