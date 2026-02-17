/**
 * Affiliate link redirect tracker
 * Handles /go/:id → tracks click → redirects to affiliate URL
 */

import { Env } from '../index';

export const affiliateRouter = {
  async redirect(req: Request, env: Env) {
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();

    const link = await env.DB.prepare(
      'SELECT affiliate_url, product_name FROM affiliate_links WHERE id = ?'
    ).bind(id).first<{ affiliate_url: string; product_name: string }>();

    if (!link) {
      return new Response('Link not found', { status: 404 });
    }

    // Track click count asynchronously (fire-and-forget via KV)
    const clickKey = `clicks_${id}_${new Date().toISOString().slice(0, 10)}`;
    env.CACHE.get(clickKey).then(async (val) => {
      const current = parseInt(val || '0');
      await env.CACHE.put(clickKey, String(current + 1), { expirationTtl: 86400 * 7 });
    });

    return Response.redirect(link.affiliate_url, 302);
  },
};
