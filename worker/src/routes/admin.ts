/**
 * Admin routes — protected by X-Admin-Secret header
 */

import { json, error } from 'itty-router';
import { Env } from '../index';
import { generateArticle, ArticleType } from '../ai/generator';

function requireAdmin(req: Request, env: Env) {
  const secret = req.headers.get('X-Admin-Secret');
  if (!secret || secret !== env.ADMIN_SECRET) {
    return error(401, 'Unauthorized');
  }
  return null;
}

export const adminRouter = {
  // ─── Affiliate Links CRUD ───────────────────────────────────────────────────

  async createLink(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;

    const body = await req.json() as any;
    const { product_name, product_description, price_usd, price_display, brand,
            affiliate_url, network, category_id, tags, is_featured } = body;

    if (!product_name || !affiliate_url || !category_id) {
      return error(400, 'product_name, affiliate_url, and category_id are required');
    }

    const result = await env.DB.prepare(`
      INSERT INTO affiliate_links (product_name, product_description, price_usd, price_display,
        brand, affiliate_url, network, category_id, tags, is_featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      product_name, product_description || '', price_usd || null,
      price_display || '', brand || '', affiliate_url,
      network || 'shareasale', category_id,
      JSON.stringify(tags || []), is_featured ? 1 : 0
    ).first();

    return json(result, { status: 201 });
  },

  async listLinks(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;

    const url = new URL(req.url);
    const categoryId = url.searchParams.get('category_id');
    let query = `SELECT al.*, c.name as category_name,
      (SELECT COUNT(*) FROM articles WHERE affiliate_link_id = al.id) as article_count
      FROM affiliate_links al LEFT JOIN categories c ON c.id = al.category_id`;
    const params: any[] = [];
    if (categoryId) { query += ` WHERE al.category_id = ?`; params.push(categoryId); }
    query += ` ORDER BY al.created_at DESC`;

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return json(results);
  },

  async updateLink(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;

    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    const body = await req.json() as any;

    const result = await env.DB.prepare(`
      UPDATE affiliate_links SET
        product_name = COALESCE(?, product_name),
        product_description = COALESCE(?, product_description),
        price_usd = COALESCE(?, price_usd),
        price_display = COALESCE(?, price_display),
        brand = COALESCE(?, brand),
        affiliate_url = COALESCE(?, affiliate_url),
        tags = COALESCE(?, tags),
        is_featured = COALESCE(?, is_featured),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `).bind(
      body.product_name || null, body.product_description || null,
      body.price_usd || null, body.price_display || null,
      body.brand || null, body.affiliate_url || null,
      body.tags ? JSON.stringify(body.tags) : null,
      body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : null,
      id
    ).first();

    if (!result) return error(404, 'Link not found');
    return json(result);
  },

  async deleteLink(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    await env.DB.prepare('DELETE FROM affiliate_links WHERE id = ?').bind(id).run();
    return json({ success: true });
  },

  // ─── AI Generation ──────────────────────────────────────────────────────────

  async generateFromLink(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;

    const body = await req.json() as any;
    const { link_id, article_type = 'spotlight', auto_publish = false } = body;

    if (!link_id) return error(400, 'link_id required');

    const link = await env.DB.prepare('SELECT * FROM affiliate_links WHERE id = ?')
      .bind(link_id).first() as any;

    if (!link) return error(404, 'Affiliate link not found');

    const result = await generateArticle(env, link, article_type as ArticleType, auto_publish);
    return json(result, { status: 201 });
  },

  async generateBatch(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;

    const body = await req.json() as any;
    const { link_ids, article_type = 'spotlight', auto_publish = false } = body;

    if (!link_ids || !Array.isArray(link_ids)) return error(400, 'link_ids array required');
    if (link_ids.length > 10) return error(400, 'Max 10 links per batch');

    const results = [];
    const errors = [];

    for (const lid of link_ids) {
      const link = await env.DB.prepare('SELECT * FROM affiliate_links WHERE id = ?')
        .bind(lid).first() as any;
      if (!link) { errors.push({ id: lid, error: 'Not found' }); continue; }
      try {
        const r = await generateArticle(env, link, article_type as ArticleType, auto_publish);
        results.push({ id: lid, ...r });
      } catch (e) {
        errors.push({ id: lid, error: (e as Error).message });
      }
    }

    return json({ generated: results, errors });
  },

  // ─── Article Management ──────────────────────────────────────────────────────

  async publishArticle(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;
    const url = new URL(req.url);
    const id = url.pathname.split('/')[url.pathname.split('/').length - 2];

    const result = await env.DB.prepare(`
      UPDATE articles SET status = 'published', published_at = CURRENT_TIMESTAMP
      WHERE id = ? RETURNING id, slug, title, status
    `).bind(id).first();

    if (!result) return error(404, 'Article not found');
    await env.CACHE.delete(`article_${(result as any).slug}`);
    return json(result);
  },

  async unpublishArticle(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;
    const url = new URL(req.url);
    const id = url.pathname.split('/')[url.pathname.split('/').length - 2];

    const result = await env.DB.prepare(`
      UPDATE articles SET status = 'draft' WHERE id = ? RETURNING id, slug, title, status
    `).bind(id).first();

    if (!result) return error(404, 'Article not found');
    await env.CACHE.delete(`article_${(result as any).slug}`);
    return json(result);
  },

  async deleteArticle(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    await env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
    return json({ success: true });
  },

  // ─── Stats Dashboard ─────────────────────────────────────────────────────────

  async stats(req: Request, env: Env) {
    const authError = requireAdmin(req, env);
    if (authError) return authError;

    const [articles, links, byCategory, byType, recent] = await Promise.all([
      env.DB.prepare(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as drafts
        FROM articles`).first(),
      env.DB.prepare(`SELECT COUNT(*) as total FROM affiliate_links`).first(),
      env.DB.prepare(`
        SELECT c.name, COUNT(a.id) as count
        FROM categories c LEFT JOIN articles a ON a.category_id = c.id AND a.status='published'
        GROUP BY c.id ORDER BY count DESC`).all(),
      env.DB.prepare(`
        SELECT article_type, COUNT(*) as count FROM articles WHERE status='published'
        GROUP BY article_type`).all(),
      env.DB.prepare(`
        SELECT id, slug, title, status, created_at FROM articles
        ORDER BY created_at DESC LIMIT 10`).all(),
    ]);

    return json({
      articles,
      affiliate_links: links,
      by_category: byCategory.results,
      by_type: byType.results,
      recent_articles: recent.results,
    });
  },
};
