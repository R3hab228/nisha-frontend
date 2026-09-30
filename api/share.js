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

    const escapeHTML = (str) => String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const title = escapeHTML('NISHA | ' + (item.brand || '') + ' ' + (item.name || ''));
    const description = escapeHTML('Цена: ' + item.price + ' грн.');
    
    let imageUrl = 'https://i.ibb.co/3s6HhXz/icon.ico';
    let videoUrl = '';
    
    if (item.images && item.images.length > 0) {
      const photo = item.images[0];
      if (photo.endsWith('.mp4')) {
          videoUrl = escapeHTML(photo);
          if (item.thumbnails && item.thumbnails.length > 0 && item.thumbnails[0]) {
              imageUrl = escapeHTML(item.thumbnails[0]);
          }
      } else {
          imageUrl = escapeHTML(photo);
      }
    }

    const videoTags = videoUrl ? 
      '<meta property="og:video" content="' + videoUrl + '">\n<meta property="og:video:type" content="video/mp4">' : '';

    const html = '<!DOCTYPE html>\n' +
'<html lang="ru">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<title>' + title + '</title>\n' +
'<meta property="og:type" content="website">\n' +
'<meta property="og:title" content="' + title + '">\n' +
'<meta property="og:description" content="' + description + '">\n' +
'<meta property="og:image" content="' + imageUrl + '">\n' +
'<meta property="og:url" content="https://www.nisha-store.shop/share/' + id + '">\n' +
videoTags + '\n' +
'<meta name="twitter:card" content="summary">\n' +
'</head>\n' +
'<body>\n' +
'<script>window.location.replace("/?item=' + id + '");</script>\n' +
'</body>\n' +
'</html>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).send(html);

  } catch (e) {
    console.error(e);
    return res.redirect('/?item=' + id);
  }
}