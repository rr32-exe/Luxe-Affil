/**
 * Articles public routes
 */

import { json, error } from 'itty-router';
import { Env } from '../index';

const CACHE_TTL = 300; // 5 minutes

async function withCache<T>(
  cache: KVNamespace,
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await cache.get(key, 'json');
  if (cached) return cached as T;
  const result = await fn();
  await cache.put(key, JSON.stringify(result), { expirationTtl: ttl });
  return result;
}

export const articlesRouter = {
  async list(req: Request, env: Env) {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '12');
    const category = url.searchParams.get('category') || null;
    const type = url.searchParams.get('type') || null;
    const offset = (page - 1) * limit;

    const cacheKey = `articles_${category || 'all'}_${type || 'all'}_${page}_${limit}`;

    const result = await withCache(env.CACHE, cacheKey, CACHE_TTL, async () => {
      let query = `
        SELECT a.id, a.slug, a.title, a.subtitle, a.excerpt, a.article_type,
               a.hero_image_url, a.read_time_minutes, a.published_at,
               c.name as category_name, c.slug as category_slug,
               al.product_name, al.brand, al.price_display, al.affiliate_url,
               '/go/' || al.id as tracked_url
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        LEFT JOIN affiliate_links al ON al.id = a.affiliate_link_id
        WHERE a.status = 'published'
      `;
      const params: any[] = [];

      if (category) {
        query += ` AND c.slug = ?`;
        params.push(category);
      }
      if (type) {
        query += ` AND a.article_type = ?`;
        params.push(type);
      }

      query += ` ORDER BY a.published_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const { results } = await env.DB.prepare(query).bind(...params).all();

      // Count total
      let countQuery = `SELECT COUNT(*) as total FROM articles a LEFT JOIN categories c ON c.id = a.category_id WHERE a.status = 'published'`;
      const countParams: any[] = [];
      if (category) { countQuery += ` AND c.slug = ?`; countParams.push(category); }
      if (type) { countQuery += ` AND a.article_type = ?`; countParams.push(type); }
      const countResult = await env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();

      return {
        articles: results,
        pagination: {
          page,
          limit,
          total: countResult?.total || 0,
          pages: Math.ceil((countResult?.total || 0) / limit),
        },
      };
    });

    return json(result);
  },

  async get(req: Request, env: Env) {
    const url = new URL(req.url);
    const slug = url.pathname.split('/').pop();
    if (!slug) return error(400, 'Missing slug');

    const cacheKey = `article_${slug}`;

    const article = await withCache(env.CACHE, cacheKey, CACHE_TTL * 2, async () => {
      const result = await env.DB.prepare(`
        SELECT a.*,
               c.name as category_name, c.slug as category_slug,
               al.product_name, al.brand, al.price_display, al.affiliate_url, al.image_url as product_image_url,
               '/go/' || al.id as tracked_url
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        LEFT JOIN affiliate_links al ON al.id = a.affiliate_link_id
        WHERE a.slug = ? AND a.status = 'published'
      `).bind(slug).first();

      if (!result) return null;

      // Related articles
      const { results: related } = await env.DB.prepare(`
        SELECT id, slug, title, excerpt, hero_image_url, read_time_minutes
        FROM articles
        WHERE category_id = ? AND status = 'published' AND slug != ?
        ORDER BY published_at DESC LIMIT 3
      `).bind((result as any).category_id, slug).all();

      return { ...result, related };
    });

    if (!article) return error(404, 'Article not found');
    return json(article);
  },

  async categories(req: Request, env: Env) {
    const result = await withCache(env.CACHE, 'categories_with_counts', 600, async () => {
      const { results } = await env.DB.prepare(`
        SELECT c.*, COUNT(a.id) as article_count
        FROM categories c
        LEFT JOIN articles a ON a.category_id = c.id AND a.status = 'published'
        GROUP BY c.id
        ORDER BY c.name
      `).all();
      return results;
    });
    return json(result);
  },

  async featured(req: Request, env: Env) {
    const result = await withCache(env.CACHE, 'featured_articles', CACHE_TTL, async () => {
      const { results } = await env.DB.prepare(`
        SELECT a.id, a.slug, a.title, a.subtitle, a.excerpt, a.article_type,
               a.hero_image_url, a.read_time_minutes, a.published_at,
               c.name as category_name, c.slug as category_slug,
               al.product_name, al.brand, al.price_display,
               '/go/' || al.id as tracked_url
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        LEFT JOIN affiliate_links al ON al.id = a.affiliate_link_id
        JOIN affiliate_links featured_al ON featured_al.id = a.affiliate_link_id AND featured_al.is_featured = 1
        WHERE a.status = 'published'
        ORDER BY a.published_at DESC LIMIT 6
      `).all();
      return results;
    });
    return json(result);
  },

  async search(req: Request, env: Env) {
    const url = new URL(req.url);
    const q = url.searchParams.get('q');
    if (!q || q.length < 2) return json({ results: [] });

    const searchTerm = `%${q}%`;
    const { results } = await env.DB.prepare(`
      SELECT a.id, a.slug, a.title, a.excerpt, a.read_time_minutes, a.published_at,
             c.name as category_name
      FROM articles a
      LEFT JOIN categories c ON c.id = a.category_id
      WHERE a.status = 'published'
        AND (a.title LIKE ? OR a.excerpt LIKE ? OR a.seo_keywords LIKE ?)
      ORDER BY a.published_at DESC LIMIT 10
    `).bind(searchTerm, searchTerm, searchTerm).all();

    return json({ results });
  },
};
