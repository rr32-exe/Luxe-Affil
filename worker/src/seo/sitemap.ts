import { Env } from '../index';

export async function renderSitemap(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`
    SELECT slug, updated_at FROM articles WHERE status = 'published'
    ORDER BY updated_at DESC LIMIT 1000
  `).all<{ slug: string; updated_at: string }>();

  const { results: cats } = await env.DB.prepare(
    `SELECT slug FROM categories`
  ).all<{ slug: string }>();

  const urls = [
    `<url><loc>${env.SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...cats.map(c => `<url><loc>${env.SITE_URL}/category/${c.slug}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`),
    ...results.map(a => `<url><loc>${env.SITE_URL}/articles/${a.slug}</loc><lastmod>${a.updated_at?.slice(0, 10) || ''}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
