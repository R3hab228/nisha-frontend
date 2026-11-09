// api/sitemap.js — ДИНАМИЧЕСКИЙ SITEMAP.XML С ПОДДЕРЖКОЙ GOOGLE IMAGES И MEMORY-КЭШЕМ
let cachedSitemapXml = null;
let cachedSitemapTime = 0;
const SITEMAP_CACHE_TTL_MS = 60 * 60 * 1000; // 1 час

function escapeXml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

module.exports = async function handler(req, res) {
  const SITE_URL = 'https://www.nisha-store.shop';

  // Отдаем из Serverless памяти при повторных обращениях краулеров
  if (cachedSitemapXml && (Date.now() - cachedSitemapTime < SITEMAP_CACHE_TTL_MS)) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Cache-Shield', 'HIT');
    return res.status(200).send(cachedSitemapXml);
  }

  const supabaseUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/rest/v1/items?select=id,created_at,status,name,brand,images,thumbnails&order=created_at.desc&limit=1000';

  try {
    const dbRes = await fetch(supabaseUrl, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo'
      },
      signal: AbortSignal.timeout(5000)
    });

    let items = [];
    if (dbRes.ok) {
      items = await dbRes.json();
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
    xml += '  <url>\n    <loc>' + SITE_URL + '/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n';
    xml += '  <url>\n    <loc>' + SITE_URL + '/return-policy</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.3</priority>\n  </url>\n';

    if (Array.isArray(items)) {
      items.forEach(item => {
        if (!item || !item.id) return;
        let date = '';
        if (item.created_at) {
          const parsedTs = Date.parse(item.created_at);
          if (Number.isFinite(parsedTs)) {
            date = new Date(parsedTs).toISOString().split('T').at(0);
          }
        }
        const lastModTag = date ? ('\n    <lastmod>' + date + '</lastmod>') : '';
        const isSold = item.status === 'sold';
        const changeFreq = isSold ? 'monthly' : 'weekly';
        const priority = isSold ? '0.4' : '0.8';
        const safeId = encodeURIComponent(String(item.id));

        // Определение главного фото для Google Картинки
        let imageUrl = '';
        if (item.thumbnails && Array.isArray(item.thumbnails) && item.thumbnails.length > 0 && item.thumbnails[0]) {
          imageUrl = String(item.thumbnails[0]);
        } else if (item.images && Array.isArray(item.images) && item.images.length > 0 && item.images[0]) {
          const firstImg = item.images[0];
          if (typeof firstImg === 'string' && !firstImg.endsWith('.mp4')) {
            imageUrl = firstImg;
          }
        }

        let imageTag = '';
        if (imageUrl) {
          const rawBrand = item.brand ? String(item.brand).trim() : '';
          const rawName = item.name ? String(item.name).trim() : '';
          const fullTitle = [rawBrand, rawName].filter(Boolean).join(' ') || 'Вінтажний одяг NISHA';
          imageTag = '\n    <image:image>\n      <image:loc>' + escapeXml(imageUrl) + '</image:loc>\n      <image:title>' + escapeXml(fullTitle) + '</image:title>\n    </image:image>';
        }

        xml += '  <url>\n    <loc>' + SITE_URL + '/share/' + safeId + '</loc>' + lastModTag + '\n    <changefreq>' + changeFreq + '</changefreq>\n    <priority>' + priority + '</priority>' + imageTag + '\n  </url>\n';
      });
    }

    xml += '</urlset>';

    cachedSitemapXml = xml;
    cachedSitemapTime = Date.now();

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Cache-Shield', 'MISS');
    return res.status(200).send(xml);
  } catch (e) {
    console.error('Error generating dynamic sitemap:', e);
    const fallbackXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>' + SITE_URL + '/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>';
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(fallbackXml);
  }
};
