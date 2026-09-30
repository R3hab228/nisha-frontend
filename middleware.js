export default async function middleware(req) {
  const url = new URL(req.url);
  const itemId = url.searchParams.get('item');
  
  if (!itemId) {
    return;
  }

  const userAgent = req.headers.get('user-agent') || '';
  const isBot = /bot|telegram|whatsapp|viber|skype|vkShare|facebook/i.test(userAgent);

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
      
      let imageUrl = 'https://i.ibb.co/3s6HhXz/icon.ico';
      let videoUrl = '';
      
      if (item.images && item.images.length > 0) {
        const photo = item.images[0];
        
        if (photo.endsWith('.mp4')) {
            videoUrl = photo;
            if (item.thumbnails && item.thumbnails.length > 0 && item.thumbnails[0]) {
                imageUrl = item.thumbnails[0];
            }
        } else {
            imageUrl = photo;
        }
      }

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
  <meta property="og:url" content="https://www.nisha-store.shop/?item= + itemId + ">
   + videoTags + 
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content=" + title + ">
  <meta name="twitter:description" content=" + description + ">
  <meta name="twitter:image" content=" + imageUrl + ">
</head>
<body>
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