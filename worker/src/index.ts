/**
 * LUXE STANDARD — Cloudflare Worker
 * Full-stack API: article generation, affiliate management, admin panel
 */

import { AutoRouter, cors, error, json } from 'itty-router';
import { generateArticle } from './ai/generator';
import { articlesRouter } from './routes/articles';
import { adminRouter } from './routes/admin';
import { affiliateRouter } from './routes/affiliate';
import { renderSitemap } from './seo/sitemap';
import { renderRSS } from './seo/rss';

export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  AI: Ai;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  SITE_NAME: string;
  SITE_URL: string;
  ADMIN_SECRET: string;
  SHAREASALE_AFFILIATE_ID: string;
  IMPACT_AFFILIATE_ID: string;
}

const { preflight, corsify } = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
});

const router = AutoRouter<Request, [Env, ExecutionContext]>({
  before: [preflight],
  finally: [corsify],
  catch: (err) => {
    console.error(err);
    return error(err);
  },
});

// ─── Public API ───────────────────────────────────────────────────────────────
router.get('/api/articles', articlesRouter.list);
router.get('/api/articles/:slug', articlesRouter.get);
router.get('/api/categories', articlesRouter.categories);
router.get('/api/featured', articlesRouter.featured);
router.get('/api/search', articlesRouter.search);

// ─── Affiliate redirect tracker ────────────────────────────────────────────────
router.get('/go/:id', affiliateRouter.redirect);

// ─── SEO ──────────────────────────────────────────────────────────────────────
router.get('/sitemap.xml', (req, env) => renderSitemap(env));
router.get('/feed.xml', (req, env) => renderRSS(env));
router.get('/robots.txt', (req, env) =>
  new Response(
    `User-agent: *\nAllow: /\nSitemap: ${env.SITE_URL}/sitemap.xml\nDisallow: /api/admin/`,
    { headers: { 'Content-Type': 'text/plain' } }
  )
);

// ─── Admin API (protected by ADMIN_SECRET header) ──────────────────────────────
router.post('/api/admin/links', adminRouter.createLink);
router.get('/api/admin/links', adminRouter.listLinks);
router.put('/api/admin/links/:id', adminRouter.updateLink);
router.delete('/api/admin/links/:id', adminRouter.deleteLink);
router.post('/api/admin/generate', adminRouter.generateFromLink);
router.post('/api/admin/generate/batch', adminRouter.generateBatch);
router.put('/api/admin/articles/:id/publish', adminRouter.publishArticle);
router.put('/api/admin/articles/:id/unpublish', adminRouter.unpublishArticle);
router.delete('/api/admin/articles/:id', adminRouter.deleteArticle);
router.get('/api/admin/stats', adminRouter.stats);

// ─── Health check ──────────────────────────────────────────────────────────────
router.get('/api/health', () => json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
router.all('*', () => error(404, 'Not found'));

export default {
  fetch: router.fetch,

  // ─── Cron: auto-generate articles daily ─────────────────────────────────────
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(autoGenerateBatch(env));
  },
};

async function autoGenerateBatch(env: Env) {
  try {
    // Find affiliate links that don't yet have articles
    const { results } = await env.DB.prepare(`
      SELECT al.* FROM affiliate_links al
      LEFT JOIN articles a ON a.affiliate_link_id = al.id AND a.status = 'published'
      WHERE a.id IS NULL
      LIMIT 3
    `).all();

    for (const link of results as any[]) {
      try {
        await generateArticle(env, link, 'spotlight');
        console.log(`Generated article for: ${link.product_name}`);
      } catch (e) {
        console.error(`Failed to generate for ${link.id}:`, e);
      }
    }
  } catch (e) {
    console.error('Auto-generate batch failed:', e);
  }
}
