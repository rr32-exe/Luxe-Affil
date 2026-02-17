import { Env } from '../index';

export async function renderRSS(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`
    SELECT a.title, a.slug, a.excerpt, a.published_at, c.name as category
    FROM articles a LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.status = 'published'
    ORDER BY a.published_at DESC LIMIT 50
  `).all<any>();

  const items = results.map(a => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${env.SITE_URL}/articles/${a.slug}</link>
      <description><![CDATA[${a.excerpt || ''}]]></description>
      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
      <category>${a.category || ''}</category>
      <guid>${env.SITE_URL}/articles/${a.slug}</guid>
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${env.SITE_NAME}</title>
    <link>${env.SITE_URL}</link>
    <description>Curated excellence for the discerning professional.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${env.SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
