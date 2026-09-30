export const config = {
  matcher: '/',
};

export default async function middleware(req) {
  const url = new URL(req.url);
  const itemId = url.searchParams.get('item');
  
  if (!itemId) {
    return;
  }

  const userAgent = req.headers.get('user-agent') || '';
  const isBot = /bot|telegram|facebook|twitter|whatsapp|viber|skype|vkShare/i.test(userAgent);

  if (!isBot) {
    return;
  }

  const supabaseUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/rest/v1/items?id=eq.' + itemId + '&select=name,price,brand,images,thumbnails';
  
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
      const title = 'NISHA | ' + (item.brand || '') + ' ' + (item.name || '');
      const description = 'Цена: ' + item.price + ' грн.';
      
      let imageUrl = 'https://i.ibb.co/3s6HhXz/icon.ico'; // дефолт
      let videoUrl = '';
      
      if (item.images && item.images.length > 0) {
        const photo = item.images[0];
        
        if (photo.endsWith('.mp4')) {
            videoUrl = photo; // Задаем как видео
            // Если есть превью для видео - берем его, иначе оставляем дефолт лого
            if (item.thumbnails && item.thumbnails.length > 0 && item.thumbnails[0]) {
                imageUrl = item.thumbnails[0];
            }
        } else {
            imageUrl = photo;
        }
      }

      // Добавляем теги для видео, если это mp4
      const videoTags = videoUrl ? 
        <meta property="og:video" content=" + videoUrl + ">
         <meta property="og:video:type" content="video/mp4"> : '';

      const html = <!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title> + title + </title>
  <meta property="og:type" content="website">
  <meta property="og:title" content=" + title + ">
  <meta property="og:description" content=" + description + ">
  <meta property="og:image" content=" + imageUrl + ">
   + videoTags + 
  <meta name="twitter:card" content="summary_large_image">
</head>
<body>
  <script>window.location.replace('/?item= + itemId + ');</script>
</body>
</html>;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  } catch (e) {
    console.error('Error in Edge SEO Middleware:', e);
  }
}