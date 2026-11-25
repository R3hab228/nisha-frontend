// Кэш-щит от всплесков трафика (In-Memory Bounded TTL Cache для Vercel Serverless)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут
const MAX_CACHE_ENTRIES = 250;

class ShareTTLCache {
  constructor(ttlMs, maxEntries) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp >= this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  set(key, html) {
    if (this.store.has(key)) this.store.delete(key);
    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
      else break;
    }
    this.store.set(key, { html, timestamp: Date.now() });
  }
}

const shareHtmlCache = new ShareTTLCache(CACHE_TTL_MS, MAX_CACHE_ENTRIES);

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function normalizeShareLang(rawLang) {
  const lang = String(rawLang || '').trim().toLowerCase();
  return (lang === 'ru' || lang === 'en') ? lang : 'ua';
}

function toCdnShareUrl(rawUrl) {
  const str = String(rawUrl || '').trim();
  if (!str) return '';
  return str.replace(
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i,
    'https://cdn.nisha-store.shop/storage/v1/object/public/'
  );
}

function buildShareMeta(item, shareLang) {
  const isSold = item.status === 'sold';
  const isReserved = item.status === 'reserved';
  const rawBrand = item.brand ? item.brand.trim() : '';
  const rawName = item.name ? item.name.trim() : '';
  const fullItemTitle = [rawBrand, rawName].filter(Boolean).join(' ') || (shareLang === 'en' ? 'Archive Piece' : 'Вінтажна річ');
  const statusPrefix = isSold
    ? (shareLang === 'en' ? '[SOLD] ' : '[ПРОДАНО] ')
    : isReserved
      ? (shareLang === 'en' ? '[RESERVED] ' : '[БРОНЬ] ')
      : '';
  const cleanTitle = (statusPrefix + fullItemTitle).slice(0, 64).trim();
  const priceVal = item.price || 0;
  const sizeVal = item.size || 'One size';
  const condVal = item.condition ? String(item.condition).trim() : '';
  const rawMetaDesc = shareLang === 'en'
    ? `${statusPrefix}Price: ${priceVal} UAH · Size: ${sizeVal}${condVal ? ` · Condition: ${condVal}` : ''}`
    : shareLang === 'ru'
      ? `${statusPrefix}Цена: ${priceVal} грн · Размер: ${sizeVal}${condVal ? ` · Состояние: ${condVal}` : ''}`
      : `${statusPrefix}Ціна: ${priceVal} грн · Розмір: ${sizeVal}${condVal ? ` · Стан: ${condVal}` : ''}`;
  return { isSold, isReserved, rawBrand, fullItemTitle, cleanTitle, rawMetaDesc };
}

function parseShareParams(req) {
  const parsedUrl = new URL(req.url || '/', 'https://www.nisha-store.shop');
  let id = parsedUrl.searchParams.get('id') || '';
  if (!id && parsedUrl.pathname.startsWith('/share/')) {
    id = parsedUrl.pathname.slice('/share/'.length).split('/')[0] || '';
  }
  const lang = parsedUrl.searchParams.get('lang') || '';
  return { id, lang };
}

const SHARE_BOT_UA_RE = /(bot|crawl|spider|slurp|facebookexternalhit|facebot|meta-external|whatsapp|viber|discord|twitter|slack|linkedin|pinterest|applebot|telegram|yandex|duckduck|bytespider|preview|embed|curl|wget|python-requests|axios|node-fetch|postman|lighthouse|pagespeed)/i;

function isCrawlerOrPreviewBot(req) {
  const ua = String((req && req.headers && req.headers['user-agent']) || '');
  if (!ua) return true;
  return SHARE_BOT_UA_RE.test(ua);
}

module.exports = async function handler(req, res) {
  const { id, lang } = parseShareParams(req);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!id || !uuidRegex.test(id)) {
    return res.redirect(302, '/');
  }

  res.setHeader('Vary', 'User-Agent');

  // Реальных пользователей мгновенно перекидываем HTTP 302 прямо в карточку на сайте (0ms без промежуточного экрана),
  // а боты/превьюеры (Telegram, Instagram/FB, Google, WhatsApp и др.) получают полный OpenGraph + JSON-LD HTML.
  if (!isCrawlerOrPreviewBot(req)) {
    res.setHeader('Cache-Control', 'private, no-store');
    return res.redirect(302, '/?item=' + encodeURIComponent(id));
  }

  const shareLang = normalizeShareLang(lang);
  const cacheKey = `${id}:${shareLang}`;

  const cached = shareHtmlCache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.setHeader('X-Cache-Shield', 'HIT');
    return res.status(200).send(cached.html);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[share] Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    return res.redirect('/?item=' + id);
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  };

  const supabaseUrl = `${SUPABASE_URL}/rest/v1/items?id=eq.${id}&select=name,price,brand,images,thumbnails,size,condition,description,status`;
  
  try {
    const dbRes = await fetch(supabaseUrl, { headers, signal: AbortSignal.timeout(4500) });
    let item = null;
    if (dbRes.ok) {
      const data = await dbRes.json();
      item = data.at(0);
    }

    // Фоллбек на архивные товары, если вещь уже выкуплена и отправлена в архив
    if (!item) {
      const archiveUrl = `${SUPABASE_URL}/rest/v1/archived_items?id=eq.${id}&select=name,price,brand,images,thumbnails,size,condition,description,status`;
      try {
        const archRes = await fetch(archiveUrl, { headers, signal: AbortSignal.timeout(3000) });
        if (archRes.ok) {
          const archData = await archRes.json();
          if (archData && archData.at(0)) {
            item = archData.at(0);
            item.status = item.status || 'sold';
          }
        }
      } catch {}
    }

    if (!item) {
      return res.redirect('/?item=' + id);
    }

    const escapeHTML = (str) => String(str || '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    const { isSold, isReserved, rawBrand, fullItemTitle, cleanTitle, rawMetaDesc } = buildShareMeta(item, shareLang);
    const title = escapeHTML(cleanTitle + ' | NISHA');

    const cleanItemDesc = String(item.description || '').replace(/\s*\[ТОРГ:?[^\]]*\]/gi, '').trim();
    const description = escapeHTML(rawMetaDesc);
    const shareUrl = 'https://www.nisha-store.shop/share/' + id;
    
    let rawImageUrl = 'https://www.nisha-store.shop/og-image.png';
    let imageUrl = rawImageUrl;
    let videoUrl = '';
    
    if (Array.isArray(item.images) && item.images.length > 0) {
      const photo = String(item.images.at(0) || '');
      if (/\.(mp4|mov|webm)(?:\?|$)/i.test(photo)) {
          videoUrl = escapeHTML(toCdnShareUrl(photo));
          const thumbCandidate = Array.isArray(item.thumbnails) && item.thumbnails.at(0)
            ? String(item.thumbnails.at(0))
            : String(item.images.find((u) => u && !/\.(mp4|mov|webm)(?:\?|$)/i.test(String(u))) || '');
          if (thumbCandidate) {
              rawImageUrl = toCdnShareUrl(thumbCandidate);
              imageUrl = escapeHTML(rawImageUrl);
          }
      } else if (photo) {
          rawImageUrl = toCdnShareUrl(photo);
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

    const htmlLang = shareLang === 'ua' ? 'uk' : shareLang;
    const ogLocale = shareLang === 'en' ? 'en_US' : shareLang === 'ru' ? 'ru_RU' : 'uk_UA';
    const ogAvailability = (isSold || isReserved) ? 'out of stock' : 'in stock';
    const html = '<!DOCTYPE html>\n' +
'<html lang="' + htmlLang + '">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'<title>' + title + '</title>\n' +
'<meta name="description" content="' + description + '">\n' +
'<link rel="canonical" href="' + shareUrl + '">\n' +
'<link rel="preload" as="image" href="' + imageUrl + '" fetchpriority="high">\n' +
'<meta property="og:type" content="product">\n' +
'<meta property="og:locale" content="' + ogLocale + '">\n' +
'<meta property="og:site_name" content="NISHA">\n' +
'<meta property="og:title" content="' + title + '">\n' +
'<meta property="og:description" content="' + description + '">\n' +
'<meta property="og:image" content="' + imageUrl + '">\n' +
'<meta property="og:image:secure_url" content="' + imageUrl + '">\n' +
'<meta property="og:image:alt" content="' + title + '">\n' +
'<meta property="og:url" content="' + shareUrl + '">\n' +
'<meta property="product:availability" content="' + ogAvailability + '">\n' +
'<meta property="product:price:amount" content="' + safePriceStr + '">\n' +
'<meta property="product:price:currency" content="UAH">\n' +
videoTags + '\n' +
'<meta name="twitter:card" content="summary_large_image">\n' +
'<meta name="twitter:title" content="' + title + '">\n' +
'<meta name="twitter:description" content="' + description + '">\n' +
'<meta name="twitter:image" content="' + imageUrl + '">\n' +
'<meta name="twitter:image:alt" content="' + title + '">\n' +
'<script type="application/ld+json">' + jsonLd.replaceAll('<', '\\u003c') + '</script>\n' +
'<script type="speculationrules">{"prerender":[{"source":"list","urls":["/","/?item=' + id + '"],"eagerness":"immediate"}],"prefetch":[{"source":"list","urls":["/","/?item=' + id + '"],"eagerness":"immediate"}]}</script>\n' +
'<script>try{if(!/(bot|crawl|spider|slurp|facebookexternalhit|facebot|meta-external|whatsapp|viber|discord|twitter|slack|linkedin|pinterest|applebot|telegram|bingbot|googlebot|ahrefs)/i.test(navigator.userAgent)){window.location.replace("/?item=' + id + '");}}catch(e){window.location.replace("/?item=' + id + '");}</script>\n' +
'</head>\n' +
'<body style="background:#000;color:#e0e0e0;font-family:\'Courier New\',Courier,monospace;margin:0;padding:16px;text-align:center;">\n' +
'<main style="max-width:600px;margin:20px auto;background:#111;border:2px outset #555;text-align:left;box-shadow:0 0 30px rgba(0,255,0,0.12);">\n' +
'  <div style="background:#002244;padding:10px 16px;border-bottom:2px inset #555;display:flex;justify-content:space-between;align-items:center;">\n' +
'    <span style="color:#fff;font-weight:700;font-size:14px;letter-spacing:1px;">ITEM_INFO.EXE</span>\n' +
'    <a href="/" style="color:#00ff00;text-decoration:none;font-weight:700;font-size:12px;">[ NISHA STORE ]</a>\n' +
'  </div>\n' +
'  <div style="padding:20px;">\n' +
'    <h1 style="font-size:20px;color:#fff;margin:0 0 14px 0;line-height:1.3;">' + title + '</h1>\n' +
'    <div style="text-align:center;margin-bottom:16px;background:#000;border:1px solid #333;padding:6px;">\n' +
'      <img src="' + imageUrl + '" alt="' + title + '" style="max-width:100%;max-height:420px;object-fit:contain;display:block;margin:0 auto;">\n' +
'    </div>\n' +
'    <div style="font-size:14px;line-height:1.6;color:#ccc;margin-bottom:18px;">\n' +
'      <p style="margin:4px 0;"><strong style="color:#888;">ЦІНА:</strong> <span style="color:#00ff00;font-size:18px;font-weight:700;">' + safePriceStr + ' грн</span></p>\n' +
'      <p style="margin:4px 0;"><strong style="color:#888;">РОЗМІР:</strong> ' + safeSize + '</p>\n' +
'      <p style="margin:4px 0;"><strong style="color:#888;">СТАН:</strong> ' + safeCondition + '</p>\n' +
'      <p style="margin:4px 0;"><strong style="color:#888;">СТАТУС:</strong> ' + (isSold ? '<span style="color:#ff3333;font-weight:700;">ПРОДАНО</span>' : '<span style="color:#00ff00;font-weight:700;">В НАЯВНОСТІ</span>') + '</p>\n' +
'      <p style="margin:10px 0 0 0;color:#aaa;font-family:Tahoma,Verdana,sans-serif;font-size:13px;">' + safeCleanDesc + '</p>\n' +
'    </div>\n' +
'    <a href="/?item=' + id + '" rel="nofollow" style="display:block;text-align:center;padding:12px 20px;background:#00ff00;color:#000;font-weight:700;text-decoration:none;border:2px outset #fff;text-transform:uppercase;letter-spacing:0.6px;">[ ВІДКРИТИ В NISHA STORE → ]</a>\n' +
'  </div>\n' +
'</main>\n' +
'</body>\n' +
'</html>';

    shareHtmlCache.set(cacheKey, html);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.setHeader('X-Cache-Shield', 'MISS');
    return res.status(200).send(html);

  } catch (e) {
    console.error(e);
    return res.redirect('/?item=' + id);
  }
}
