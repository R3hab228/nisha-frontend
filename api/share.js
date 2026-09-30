module.exports = async function handler(req, res) {
  const id = req.query.id;
  
  if (!id) {
    return res.redirect('/');
  }

  const supabaseUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/rest/v1/items?id=eq.' + id + '&select=name,price,brand,images,thumbnails';
  
  try {
    const dbRes = await fetch(supabaseUrl, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo'
      }
    });
    
    const data = await dbRes.json();
    const item = data[0];

    if (!item) {
      return res.redirect('/?item=' + id);
    }

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
<meta property="og:url" content="https://www.nisha-store.shop/share/ + id + ">
 + videoTags + 
<meta name="twitter:card" content="summary_large_image">
</head>
<body>
<script>window.location.replace('/?item= + id + ');</script>
</body>
</html>;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).send(html);

  } catch (e) {
    console.error(e);
    return res.redirect('/?item=' + id);
  }
}