/**
 * AI Article Generator
 * Uses Cloudflare Workers AI (free tier) — @cf/meta/llama-3.1-8b-instruct
 * Generates luxury editorial content from affiliate product data
 */

import { Env } from '../index';

export type ArticleType = 'spotlight' | 'comparison' | 'lifestyle' | 'guide';

interface AffiliateLink {
  id: number;
  product_name: string;
  product_description: string;
  price_display: string;
  brand: string;
  affiliate_url: string;
  category_id: number;
  tags: string;
}

interface GeneratedArticle {
  title: string;
  subtitle: string;
  excerpt: string;
  body_html: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  schema_json: string;
}

// ─── Prompt Templates ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior editor at a prestigious luxury lifestyle publication — 
think Robb Report meets Monocle meets GQ Luxury. You write with authoritative confidence, 
subtle wit, and genuine connoisseurship. Your prose is elegant, never salesy. 
You celebrate craft, heritage, and considered consumption.
IMPORTANT: Always respond with ONLY valid JSON — no markdown, no preamble, no explanation.`;

function buildSpotlightPrompt(link: AffiliateLink): string {
  const tags = JSON.parse(link.tags || '[]').join(', ');
  return `Write a luxury editorial spotlight article for this product.

Product: ${link.product_name}
Brand: ${link.brand}
Price: ${link.price_display}
Description: ${link.product_description}
Keywords: ${tags}

Return this exact JSON structure (no markdown, just raw JSON):
{
  "title": "A compelling, elegant headline (50-70 chars). Can be a statement or evocative phrase.",
  "subtitle": "A refined one-sentence subheadline that expands on the title (80-120 chars).",
  "excerpt": "A 2-sentence preview for article cards and social sharing.",
  "body_html": "Full HTML article body. Include: opening paragraph with strong hook, 2-3 body sections with H2 headings, a 'The Verdict' conclusion section. Use <h2>, <p>, <ul>, <li>, <strong>, <em> tags. Minimum 600 words. Weave in the affiliate link naturally as [AFFILIATE_LINK] placeholder. Never be salesy — be editorial.",
  "seo_title": "SEO-optimized title including brand and product name (55-60 chars)",
  "seo_description": "Meta description (150-160 chars) — informative, not clickbait",
  "seo_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;
}

function buildComparisonPrompt(link: AffiliateLink): string {
  return `Write a luxury editorial comparison article featuring this product against its category peers.

Product: ${link.product_name}
Brand: ${link.brand}
Price: ${link.price_display}
Description: ${link.product_description}

Return this exact JSON structure:
{
  "title": "A comparison headline (e.g. 'The Contenders: ...' or 'Four Watches, One Winner')",
  "subtitle": "A subheadline setting up the comparison narrative",
  "excerpt": "2-sentence preview explaining what's being compared and why it matters",
  "body_html": "Full HTML comparison article. Include: intro paragraph on the category, brief mentions of 2-3 alternatives (use generic names like 'The German Rival' or 'The Swiss Contender'), deep dive on the featured product with [AFFILIATE_LINK] placeholder, verdict section. Use <h2>, <p>, <table> where appropriate. Minimum 700 words. Tone: informed, fair, authoritative.",
  "seo_title": "Comparison SEO title with 'vs' or 'review' keyword",
  "seo_description": "Meta description for comparison article",
  "seo_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;
}

function buildLifestylePrompt(link: AffiliateLink): string {
  return `Write a luxury lifestyle integration article — show how this product fits into an aspirational life, not just what it is.

Product: ${link.product_name}
Brand: ${link.brand}
Price: ${link.price_display}
Description: ${link.product_description}

Return this exact JSON structure:
{
  "title": "A lifestyle-oriented, aspirational headline (e.g. 'The Morning Ritual of...' or 'Why the Serious Traveller...')",
  "subtitle": "A lifestyle subheadline that paints a picture",
  "excerpt": "2-sentence lifestyle-focused preview",
  "body_html": "Full HTML lifestyle article. Paint a vivid scene. Show the product in context of an aspirational life — morning routines, business travel, weekend escapes. Include product details but through the lens of lived experience. Use [AFFILIATE_LINK] placeholder naturally. Include at least one pull-quote wrapped in <blockquote>. Minimum 600 words.",
  "seo_title": "Lifestyle-angle SEO title",
  "seo_description": "Lifestyle-focused meta description",
  "seo_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;
}

// ─── Schema.org JSON-LD generator ──────────────────────────────────────────────

function buildSchema(article: GeneratedArticle, link: AffiliateLink, slug: string, siteUrl: string): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    url: `${siteUrl}/articles/${slug}`,
    author: { '@type': 'Organization', name: 'LUXE STANDARD Editorial' },
    publisher: {
      '@type': 'Organization',
      name: 'LUXE STANDARD',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/logo.png` },
    },
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteUrl}/articles/${slug}` },
    about: {
      '@type': 'Product',
      name: link.product_name,
      brand: { '@type': 'Brand', name: link.brand },
      offers: {
        '@type': 'Offer',
        price: link.price_display,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: link.affiliate_url,
      },
    },
  });
}

// ─── Slug generator ────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 80);
}

function uniqueSlug(base: string): string {
  const timestamp = Date.now().toString(36);
  return `${base}-${timestamp}`;
}

// ─── Word count helpers ────────────────────────────────────────────────────────

function countWords(html: string): number {
  return html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
}

// ─── Main generator ────────────────────────────────────────────────────────────

export async function generateArticle(
  env: Env,
  link: AffiliateLink,
  type: ArticleType = 'spotlight',
  autoPublish = false
): Promise<{ id: number; slug: string }> {

  // Select prompt by article type
  let userPrompt: string;
  switch (type) {
    case 'comparison': userPrompt = buildComparisonPrompt(link); break;
    case 'lifestyle':  userPrompt = buildLifestylePrompt(link); break;
    default:           userPrompt = buildSpotlightPrompt(link); break;
  }

  // Call Workers AI
  const response = await (env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 2048,
    temperature: 0.75,
  }) as { response: string };

  // Parse JSON response
  let generated: GeneratedArticle;
  try {
    const raw = response.response.trim();
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    generated = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`AI returned invalid JSON: ${(e as Error).message}`);
  }

  // Replace [AFFILIATE_LINK] placeholder with actual tracked link
  const trackedUrl = `/go/${link.id}`;
  const bodyWithLinks = generated.body_html.replace(
    /\[AFFILIATE_LINK\]/g,
    `<a href="${trackedUrl}" class="affiliate-cta" rel="nofollow sponsored" target="_blank">${link.product_name}</a>`
  );

  // Build slug
  const baseSlug = slugify(generated.title);
  const slug = uniqueSlug(baseSlug);

  // Calculate metadata
  const wordCount = countWords(bodyWithLinks);
  const readTime = Math.ceil(wordCount / 238);

  // Build schema markup
  const schemaJson = buildSchema(generated, link, slug, env.SITE_URL);

  // Persist to D1
  const result = await env.DB.prepare(`
    INSERT INTO articles (
      affiliate_link_id, category_id, slug, title, subtitle, excerpt,
      body_html, article_type, seo_title, seo_description, seo_keywords,
      schema_json, word_count, read_time_minutes, status, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).bind(
    link.id,
    link.category_id,
    slug,
    generated.title,
    generated.subtitle || '',
    generated.excerpt,
    bodyWithLinks,
    type,
    generated.seo_title,
    generated.seo_description,
    JSON.stringify(generated.seo_keywords || []),
    schemaJson,
    wordCount,
    readTime,
    autoPublish ? 'published' : 'draft',
    autoPublish ? new Date().toISOString() : null,
  ).first<{ id: number }>();

  if (!result) throw new Error('Failed to insert article');

  // Update article-affiliate mapping
  await env.DB.prepare(`
    INSERT OR IGNORE INTO article_affiliate_links (article_id, affiliate_link_id, placement)
    VALUES (?, ?, 'body')
  `).bind(result.id, link.id).run();

  // Bust cache
  await env.CACHE.delete('featured_articles');
  await env.CACHE.delete(`category_${link.category_id}`);

  return { id: result.id, slug };
}
