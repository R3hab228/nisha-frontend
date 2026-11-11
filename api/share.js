// Кэш-щит от всплесков трафика (In-Memory Micro-Cache для Vercel Serverless)
const shareHtmlCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут
const MAX_CACHE_ENTRIES = 250;

module.exports = async function handler(req, res) {
  const id = req.query.id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!id || !uuidRegex.test(id)) {
    return res.redirect('/');
  }

  const cached = shareHtmlCache.get(id);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Cache-Shield', 'HIT');
    return res.status(200).send(cached.html);
  }

  const headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo'
  };

  const supabaseUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/rest/v1/items?id=eq.' + id + '&select=name,price,brand,images,thumbnails,size,condition,description,status';
  
  try {
    const dbRes = await fetch(supabaseUrl, { headers, signal: AbortSignal.timeout(4500) });
    let item = null;
    if (dbRes.ok) {
      const data = await dbRes.json();
      item = data.at(0);
    }

    // Фоллбек на архивные товары, если вещь уже выкуплена и отправлена в архив
    if (!item) {
      const archiveUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/rest/v1/archived_items?id=eq.' + id + '&select=name,price,brand,images,thumbnails,size,condition,description,status';
      try {
        const archRes = await fetch(archiveUrl, { headers, signal: AbortSignal.timeout(3000) });
        if (archRes.ok) {
          const archData = await archRes.json();
          if (archData && archData.at(0)) {
            item = archData.at(0);
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
    const fullItemTitle = [rawBrand, rawName].filter(Boolean).join(' ') || 'Вінтажна річ';
    const statusPrefix = isSold ? '[ПРОДАНО] ' : '';

    // Оптимальный заголовок до 55 символов для идеального Ahrefs / Google SEO
    const cleanTitle = (statusPrefix + fullItemTitle).slice(0, 48).trim();
    const title = escapeHTML(cleanTitle + ' | NISHA');

    const cleanItemDesc = String(item.description || '').replace(/\s*\[ТОРГ:?[^\]]*\]/gi, '').trim();
    const descSnippet = cleanItemDesc ? ` ${cleanItemDesc.slice(0, 50)}.` : '';
    const rawMetaDesc = `${statusPrefix}Купити ${fullItemTitle} в інтернет-магазині NISHA. Розмір: ${item.size || 'One size'}, стан: ${item.condition || '9/10'}, ціна: ${item.price || 0} грн.${descSnippet} Доставка Новою Поштою по Україні.`.slice(0, 155);
    const description = escapeHTML(rawMetaDesc);
    const shareUrl = 'https://www.nisha-store.shop/share/' + id;
    
    let rawImageUrl = 'https://www.nisha-store.shop/og-image.png';
    let imageUrl = rawImageUrl;
    let videoUrl = '';
    
    if (item.images && item.images.length > 0) {
      const photo = item.images.at(0);
      if (photo.endsWith('.mp4')) {
          videoUrl = escapeHTML(photo);
          if (item.thumbnails && item.thumbnails.length > 0 && item.thumbnails.at(0)) {
              rawImageUrl = String(item.thumbnails.at(0));
              imageUrl = escapeHTML(rawImageUrl);
          }
      } else {
          rawImageUrl = String(photo);
          imageUrl = escapeHTML(rawImageUrl);
      }
    }

    const videoTags = videoUrl ? 
      '<meta property="og:video" content="' + videoUrl + '">\n<meta property="og:video:type" content="video/mp4">' : '';

    const safePriceStr = escapeHTML(String(item.price || 0));
    const safeSize = escapeHTML(item.size || 'One size');
    const safeCondition = escapeHTML(item.condition || '9/10');
    const safeCleanDesc = escapeHTML(cleanItemDesc || 'Вінтажна та архівна річ у відмінному стані. Доставка по всій Україні.');

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": fullItemTitle,
      "image": [rawImageUrl],
      "description": rawMetaDesc,
      "brand": {
        "@type": "Brand",
        "name": rawBrand || "NISHA"
      },
      "offers": {
        "@type": "Offer",
        "url": "https://www.nisha-store.shop/share/" + id,
        "priceCurrency": "UAH",
        "price": String(item.price || 0),
        "priceValidUntil": "2027-12-31",
        "itemCondition": "https://schema.org/UsedCondition",
        "availability": isSold ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        "seller": {
          "@type": "Organization",
          "name": "NISHA STORE",
          "url": "https://www.nisha-store.shop"
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "UA",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": 14,
          "returnMethod": "https://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/FreeReturn"
        },
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "value": "80",
            "currency": "UAH"
          },
          "shippingDestination": [{
            "@type": "DefinedRegion",
            "addressCountry": "UA"
          }]
        }
      }
    });

    const html = '<!DOCTYPE html>\n' +
'<html lang="uk">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'<title>' + title + '</title>\n' +
'<meta name="description" content="' + description + '">\n' +
'<link rel="canonical" href="' + shareUrl + '">\n' +
'<link rel="preload" as="image" href="' + imageUrl + '" fetchpriority="high">\n' +
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
'<script type="speculationrules">{"prerender":[{"source":"list","urls":["/","/?item=' + id + '"],"eagerness":"immediate"}],"prefetch":[{"source":"list","urls":["/","/?item=' + id + '"],"eagerness":"immediate"}]}</script>\n' +
'</head>\n' +
'<body style="background:#0a0a0a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;margin:0;padding:20px;text-align:center;">\n' +
'<main style="max-width:640px;margin:30px auto;background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:24px;text-align:left;box-shadow:0 10px 30px rgba(0,0,0,0.5);">\n' +
'  <nav style="margin-bottom:16px;">\n' +
'    <a href="/" style="color:#00ff66;text-decoration:none;font-weight:700;font-family:monospace;font-size:14px;">← ГОЛОВНА NISHA STORE</a>\n' +
'  </nav>\n' +
'  <h1 style="font-size:22px;color:#fff;margin:0 0 16px 0;line-height:1.3;">' + title + '</h1>\n' +
'  <div style="text-align:center;margin-bottom:20px;">\n' +
'    <img src="' + imageUrl + '" alt="' + title + '" style="max-width:100%;max-height:480px;border-radius:8px;object-fit:cover;border:1px solid #2a2a2a;">\n' +
'  </div>\n' +
'  <div style="font-size:15px;line-height:1.6;color:#ccc;margin-bottom:20px;">\n' +
'    <p style="margin:6px 0;"><strong style="color:#fff;">Ціна:</strong> <span style="color:#00ff66;font-size:18px;font-weight:700;">' + safePriceStr + ' грн</span></p>\n' +
'    <p style="margin:6px 0;"><strong style="color:#fff;">Розмір:</strong> ' + safeSize + '</p>\n' +
'    <p style="margin:6px 0;"><strong style="color:#fff;">Стан:</strong> ' + safeCondition + '</p>\n' +
'    <p style="margin:6px 0;"><strong style="color:#fff;">Статус:</strong> ' + (isSold ? '<span style="color:#ff3366;font-weight:700;">ПРОДАНО</span>' : '<span style="color:#00ff66;font-weight:700;">В наявності</span>') + '</p>\n' +
'    <p style="margin:12px 0 0 0;color:#aaa;">' + safeCleanDesc + '</p>\n' +
'  </div>\n' +
'  <div style="margin-top:24px;text-align:center;">\n' +
'    <a href="/?item=' + id + '" rel="nofollow" style="display:inline-block;padding:12px 28px;background:#00ff66;color:#000;font-weight:700;text-decoration:none;border-radius:6px;text-transform:uppercase;font-family:monospace;">Відкрити в магазині NISHA →</a>\n' +
'  </div>\n' +
'</main>\n' +
'<script>\n' +
'  try {\n' +
'    if (!navigator.userAgent.match(/(bot|crawl|spider|slurp|facebookexternalhit|bingbot|googlebot|ahrefs)/i)) {\n' +
'      window.location.replace("/?item=' + id + '");\n' +
'    }\n' +
'  } catch(e) {\n' +
'    window.location.replace("/?item=' + id + '");\n' +
'  }\n' +
'</script>\n' +
'</body>\n' +
'</html>';

    if (shareHtmlCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = shareHtmlCache.keys().next().value;
      if (oldestKey) shareHtmlCache.delete(oldestKey);
    }
    shareHtmlCache.set(id, { html, timestamp: Date.now() });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Cache-Shield', 'MISS');
    return res.status(200).send(html);

  } catch (e) {
    console.error(e);
    return res.redirect('/?item=' + id);
  }
}
