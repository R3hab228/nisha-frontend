module.exports = async function handler(req, res) {
  const id = req.query.id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!id || !uuidRegex.test(id)) {
    return res.redirect('/');
  }

  const headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo'
  };

  const supabaseUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/rest/v1/items?id=eq.' + id + '&select=name,price,brand,images,thumbnails,size,condition,description,status';
  
  try {
    const dbRes = await fetch(supabaseUrl, { headers });
    let item = null;
    if (dbRes.ok) {
      const data = await dbRes.json();
      item = data[0];
    }

    // Фоллбек на архивные товары, если вещь уже выкуплена и отправлена в архив
    if (!item) {
      const archiveUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/rest/v1/archived_items?id=eq.' + id + '&select=name,price,brand,images,thumbnails,size,condition,description,status';
      try {
        const archRes = await fetch(archiveUrl, { headers });
        if (archRes.ok) {
          const archData = await archRes.json();
          if (archData && archData[0]) {
            item = archData[0];
            item.status = item.status || 'sold';
          }
        }
      } catch (err) {}
    }

    if (!item) {
      return res.redirect('/?item=' + id);
    }

    const isSold = item.status === 'sold';
    const escapeHTML = (str) => String(str || '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    const rawBrand = item.brand ? item.brand.trim() : '';
    const rawName = item.name ? item.name.trim() : '';
    const fullItemTitle = [rawBrand, rawName].filter(Boolean).join(' ') || 'Винтажная вещь';
    const statusPrefix = isSold ? '[ПРОДАНО] ' : '';
    const title = escapeHTML(statusPrefix + 'NISHA | ' + fullItemTitle);

    let descParts = [];
    if (isSold) descParts.push('ПРОДАНО');
    if (item.size) descParts.push('Размер: ' + item.size);
    if (item.condition) descParts.push('Состояние: ' + item.condition);
    if (item.price) descParts.push('Цена: ' + item.price + ' грн');
    const rawDescription = descParts.join(' | ') || (item.description ? item.description.slice(0, 150) : 'Винтажная одежда в магазине NISHA');
    const description = escapeHTML(rawDescription);
    const shareUrl = 'https://www.nisha-store.shop/share/' + id;
    
    let rawImageUrl = 'https://www.nisha-store.shop/og-image.png';
    let imageUrl = rawImageUrl;
    let videoUrl = '';
    
    if (item.images && item.images.length > 0) {
      const photo = item.images[0];
      if (photo.endsWith('.mp4')) {
          videoUrl = escapeHTML(photo);
          if (item.thumbnails && item.thumbnails.length > 0 && item.thumbnails[0]) {
              rawImageUrl = String(item.thumbnails[0]);
              imageUrl = escapeHTML(rawImageUrl);
          }
      } else {
          rawImageUrl = String(photo);
          imageUrl = escapeHTML(rawImageUrl);
      }
    }

    const videoTags = videoUrl ? 
      '<meta property="og:video" content="' + videoUrl + '">\n<meta property="og:video:type" content="video/mp4">' : '';

    const safePriceStr = escapeHTML(item.price || 0);

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": fullItemTitle,
      "image": [rawImageUrl],
      "description": rawDescription,
      "brand": {
        "@type": "Brand",
        "name": rawBrand || "NISHA"
      },
      "offers": {
        "@type": "Offer",
        "url": "https://www.nisha-store.shop/?item=" + id,
        "priceCurrency": "UAH",
        "price": String(item.price || 0),
        "itemCondition": "https://schema.org/UsedCondition",
        "availability": isSold ? "https://schema.org/OutOfStock" : "https://schema.org/InStock"
      }
    });

    const html = '<!DOCTYPE html>\n' +
'<html lang="ru">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<title>' + title + '</title>\n' +
'<meta name="description" content="' + description + '">\n' +
'<link rel="canonical" href="' + shareUrl + '">\n' +
'<meta property="og:type" content="product">\n' +
'<meta property="og:site_name" content="NISHA">\n' +
'<meta property="og:title" content="' + title + '">\n' +
'<meta property="og:description" content="' + description + '">\n' +
'<meta property="og:image" content="' + imageUrl + '">\n' +
'<meta property="og:url" content="' + shareUrl + '">\n' +
'<meta property="product:availability" content="' + (isSold ? 'out of stock' : 'in stock') + '">\n' +
'<meta property="product:price:amount" content="' + safePriceStr + '">\n' +
'<meta property="product:price:currency" content="UAH">\n' +
videoTags + '\n' +
'<meta name="twitter:card" content="summary_large_image">\n' +
'<meta name="twitter:title" content="' + title + '">\n' +
'<meta name="twitter:description" content="' + description + '">\n' +
'<meta name="twitter:image" content="' + imageUrl + '">\n' +
'<script type="application/ld+json">' + jsonLd.replaceAll('<', '\\u003c') + '</script>\n' +
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