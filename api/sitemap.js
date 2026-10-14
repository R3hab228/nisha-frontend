module.exports = async function handler(req, res) {
  const SITE_URL = 'https://www.nisha-store.shop';
  const supabaseUrl = 'https://nmpuefxqtkhvtltdvllz.supabase.co/rest/v1/items?select=id,created_at,status&order=created_at.desc&limit=1000';

  try {
    const dbRes = await fetch(supabaseUrl, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcHVlZnhxdGtodnRsdGR2bGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQ2MzEsImV4cCI6MjA5NDUxMDYzMX0.SPspCdwRKd6Hu0Zx3Hhm-orTOpPdcigNWLiV1TTwLMo'
      }
    });

    let items = [];
    if (dbRes.ok) {
      items = await dbRes.json();
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${SITE_URL}/return-policy</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.3</priority>\n  </url>\n`;

    if (Array.isArray(items)) {
      items.forEach(item => {
        if (!item || !item.id) return;
        const date = item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '';
        const lastModTag = date ? `\n    <lastmod>${date}</lastmod>` : '';
        const isSold = item.status === 'sold';
        const changeFreq = isSold ? 'monthly' : 'weekly';
        const priority = isSold ? '0.4' : '0.8';
        xml += `  <url>\n    <loc>${SITE_URL}/share/${item.id}</loc>${lastModTag}\n    <changefreq>${changeFreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
      });
    }

    xml += `</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
  } catch (e) {
    console.error('Error generating dynamic sitemap:', e);
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(fallbackXml);
  }
};
