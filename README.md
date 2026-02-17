# LUXE STANDARD — AI-Powered Luxury Affiliate Platform

> Fully automated luxury editorial site powered by Cloudflare Workers AI (free tier).  
> Zero infrastructure cost. One-command deploy. Built for ShareASale + Impact.com affiliate networks.

---

## Architecture (100% Cloudflare Free Tier)

| Layer | Service | Free Tier Limits |
|-------|---------|-----------------|
| Frontend | Cloudflare Pages | 500 deploys/month, unlimited bandwidth |
| API Backend | Cloudflare Workers | 100,000 req/day |
| AI Content Gen | Workers AI (Llama 3.1 8B) | 10,000 neurons/day |
| Database | D1 (SQLite) | 5M reads/day, 100K writes/day |
| Caching | Workers KV | 100K reads/day, 1K writes/day |
| File Storage | R2 | 10GB storage, 10M reads/month |
| Auto-publish | Workers Cron | 3 cron triggers |

**Affiliate Networks (better than Amazon Associates):**
- **ShareASale** — 4,000+ merchants, luxury brands, up to 30% commission. Free to join.
- **Impact.com** — Premium brands (Adidas, Levi's, Sennheiser, etc.), real-time tracking. Free to join.
- **Commission Junction (CJ)** — Enterprise brands, high-ticket items
- **Awin** — European luxury brands (Burberry, Farfetch, etc.)

---

## Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Cloudflare account (free)](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`
- GitHub account (for CI/CD)

---

## One-Shot Setup

### 1. Clone into GitHub Copilot / your editor

```bash
# Clone this repo or paste files into a new GitHub project
git clone <your-repo-url>
cd luxe-affiliate
npm install
```

### 2. Authenticate Wrangler

```bash
wrangler login
```

### 3. Create Cloudflare resources

```bash
# Create D1 database — copy the ID from output
wrangler d1 create luxe-db

# Create KV namespace — copy the ID from output  
wrangler kv:namespace create CACHE

# Create R2 bucket (for future image uploads)
wrangler r2 bucket create luxe-assets
```

### 4. Update wrangler.toml

Edit `worker/wrangler.toml` and replace placeholders:

```toml
# Replace these with your actual IDs from step 3:
database_id = "REPLACE_WITH_YOUR_D1_ID"   # from: wrangler d1 create luxe-db
id = "REPLACE_WITH_YOUR_KV_ID"             # from: wrangler kv:namespace create CACHE

# Update these with your info:
SITE_URL = "https://luxe-affiliate.pages.dev"  # your Pages URL
ADMIN_SECRET = "your-strong-secret-here"        # make this hard to guess!
SHAREASALE_AFFILIATE_ID = "your-id"
IMPACT_AFFILIATE_ID = "your-id"
```

### 5. Run database migrations

```bash
cd worker
npm install
npx wrangler d1 migrations apply luxe-db
npx wrangler d1 execute luxe-db --file=./src/db/seed.sql
```

### 6. Deploy the Worker

```bash
# From worker/ directory:
npx wrangler deploy
```

Note the Worker URL (e.g., `https://luxe-affiliate-worker.YOUR-SUBDOMAIN.workers.dev`)

### 7. Deploy the Frontend

```bash
cd ../frontend
npm install

# Create the Pages project
npx wrangler pages project create luxe-affiliate

# Build and deploy
npm run build
npx wrangler pages deploy dist --project-name=luxe-affiliate
```

Note your Pages URL (e.g., `https://luxe-affiliate.pages.dev`)

### 8. Configure Worker routing (connect Pages + Worker)

In Cloudflare Dashboard:
1. Go to **Pages** → your project → **Settings** → **Functions**
2. Add route: `/api/*` → your Worker name `luxe-affiliate-worker`
3. Add route: `/go/*` → `luxe-affiliate-worker`
4. Add route: `/sitemap.xml` → `luxe-affiliate-worker`
5. Add route: `/robots.txt` → `luxe-affiliate-worker`
6. Add route: `/feed.xml` → `luxe-affiliate-worker`

Or if using a custom domain with Cloudflare DNS, add routes in `wrangler.toml`:

```toml
[[routes]]
pattern = "yourdomain.com/api/*"
zone_name = "yourdomain.com"
```

### 9. Set up GitHub CI/CD (optional but recommended)

Add these secrets to your GitHub repo (Settings → Secrets → Actions):

```
CLOUDFLARE_API_TOKEN   # From dash.cloudflare.com/profile/api-tokens → Create Token → Edit Cloudflare Workers template
CLOUDFLARE_ACCOUNT_ID  # From dash.cloudflare.com right sidebar
```

Push to `main` → auto-deploys both Worker and Pages.

---

## Usage

### Admin Panel

Visit `https://your-pages-url.pages.dev/admin/` and enter your `ADMIN_SECRET`.

#### Adding Affiliate Links

1. Go to **Affiliate Links** → **Add Link**
2. Paste your ShareASale/Impact link URL
3. Fill in product details
4. Save

#### Generating Articles

1. Go to **Generate Content**
2. Select your affiliate link
3. Choose article type:
   - **Spotlight** — Deep-dive product editorial
   - **Comparison** — vs. category competitors  
   - **Lifestyle** — Aspirational narrative piece
4. Click **Generate Article**
5. Review in **Articles** tab, then **Publish**

#### Batch Generation

1. Note the IDs of your affiliate links (from the Links table)
2. In **Generate Content**, paste IDs comma-separated: `1, 2, 3, 4, 5`
3. Click **Run Batch** — generates up to 10 articles at once

### Auto-Generation (Cron)

The Worker is configured to auto-generate 3 articles/day for any affiliate links that don't yet have articles. Add this cron to `wrangler.toml` to enable:

```toml
[triggers]
crons = ["0 9 * * *"]  # Daily at 9am UTC
```

Redeploy: `wrangler deploy`

---

## Affiliate Network Setup

### ShareASale (Recommended)

1. Sign up free at [shareasale.com](https://www.shareasale.com)
2. Browse merchants in the luxury categories:
   - **Fashion**: Nordstrom, Brooks Brothers, Bonobos
   - **Tech**: B&H Photo, Adorama
   - **Travel**: Hotels.com, Viator
   - **Grooming**: Art of Shaving, Dollar Shave Club
3. Apply to merchants → get deep links
4. Format: `https://shareasale.com/r.cfm?b=BANNER_ID&u=YOUR_ID&m=MERCHANT_ID`

### Impact.com

1. Sign up at [impact.com](https://impact.com)
2. Apply to brands:
   - **Luxury**: Levi's, Sennheiser, Casper
   - **Travel**: Booking.com, Airbnb, Hopper
   - **Tech**: Samsung, Lenovo, Bose
3. Use the Impact link format from their dashboard

### Commission Junction (CJ)

1. Sign up at [cj.com](https://www.cj.com)
2. High-ticket luxury merchants available

### Awin (European Brands)

1. Sign up at [awin.com](https://www.awin.com)
2. Great for: Farfetch, ASOS, luxury European brands

---

## API Reference

All public endpoints return JSON. Admin endpoints require `X-Admin-Secret` header.

### Public

```
GET /api/articles          ?page=1&limit=12&category=slug&type=spotlight
GET /api/articles/:slug    Single article with related
GET /api/categories        All categories with article counts
GET /api/featured          Featured articles (from featured products)
GET /api/search            ?q=query — full text search
GET /go/:id                Affiliate redirect (tracked)
GET /sitemap.xml
GET /feed.xml
GET /robots.txt
```

### Admin (add X-Admin-Secret header)

```
POST   /api/admin/links              Create affiliate link
GET    /api/admin/links              List all links
PUT    /api/admin/links/:id          Update link
DELETE /api/admin/links/:id          Delete link

POST   /api/admin/generate           Generate article from link
                                     Body: { link_id, article_type, auto_publish }
POST   /api/admin/generate/batch     Batch generate (max 10)
                                     Body: { link_ids: [1,2,3], article_type, auto_publish }

PUT    /api/admin/articles/:id/publish
PUT    /api/admin/articles/:id/unpublish
DELETE /api/admin/articles/:id

GET    /api/admin/stats              Dashboard statistics
```

---

## Content Strategy

### Recommended Launch Workflow

1. Add 20 affiliate links across all 5 categories
2. Run batch generation: spotlight articles for all 20 → 20 articles
3. Review + publish your best 10 immediately
4. Run comparison and lifestyle variants over the next week
5. Enable auto-publish cron once you trust quality

### Improving AI Output Quality

The AI uses `@cf/meta/llama-3.1-8b-instruct` (free). To improve output:
- **More specific product descriptions** in your link data → better articles
- **Richer tags** → better keyword targeting
- **Edit prompts** in `worker/src/ai/generator.ts` to match your brand voice

For higher quality (optional, paid), swap the model:
- `@cf/meta/llama-3.3-70b-instruct` — better quality, uses more AI neurons
- External API (OpenAI/Claude) — add `OPENAI_API_KEY` as Worker secret

### SEO Best Practices

- All articles auto-generate: title tags, meta descriptions, JSON-LD schema, Open Graph
- Sitemap auto-updates at `/sitemap.xml`
- Submit sitemap to Google Search Console after launch
- Add `hreflang` tags in future for multi-region expansion

---

## Customization

### Brand Name
Search and replace `LUXE STANDARD` in:
- `frontend/index.html`
- `frontend/article.html`
- `worker/wrangler.toml` → `SITE_NAME`

### Colors
Update CSS variables in `frontend/index.html`:
```css
--gold: #c9a84c;       /* primary accent */
--black: #0a0a0a;
--cream: #faf7f2;       /* page background */
```

### Adding Categories
Edit `worker/src/db/seed.sql` and re-run seed, or insert directly:
```bash
wrangler d1 execute luxe-db --command "INSERT INTO categories (slug, name, description, icon) VALUES ('art-design', 'Art & Design', 'Curated objects for discerning collectors.', '🎨')"
```

### Custom Domain
1. Add domain to Cloudflare DNS
2. In Pages → Custom Domains → Add domain
3. Update `SITE_URL` in `wrangler.toml`
4. Update Worker routes in `wrangler.toml`

---

## Troubleshooting

**"AI returned invalid JSON"** — Llama occasionally mis-formats. The article will fail gracefully. Retry or try a different product description.

**"Unauthorized"** — Check `ADMIN_SECRET` in `wrangler.toml` matches what you type in the admin panel.

**Worker returns 404 on /api/** — Ensure Pages functions routing is configured (Step 8).

**Articles not loading on frontend** — Open browser console; check for CORS errors. Ensure Worker is deployed and routing is set up.

---

## Free Tier Limits & Scaling

At scale you may hit:
- **Workers**: 100K req/day free → $5/mo for 10M req on paid plan
- **Workers AI**: ~33 articles/day on free (Workers AI neurons). Upgrade: $0.011/1K neurons
- **D1**: Very generous free tier, unlikely to hit limits early

The platform is designed to scale horizontally — multiple Workers instances, read replicas with D1, and R2 for media as you grow.

---

## File Structure

```
luxe-affiliate/
├── .github/workflows/deploy.yml    # CI/CD
├── package.json                    # Monorepo root
├── worker/                         # Cloudflare Worker (API)
│   ├── wrangler.toml               # ← EDIT THIS FIRST
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── index.ts                # Router + cron handler
│       ├── ai/generator.ts         # Workers AI article generator
│       ├── routes/
│       │   ├── articles.ts         # Public API
│       │   ├── admin.ts            # Protected admin API
│       │   └── affiliate.ts        # Click tracking + redirect
│       ├── seo/
│       │   ├── sitemap.ts
│       │   └── rss.ts
│       └── db/
│           ├── 0001_initial.sql    # Schema migration
│           └── seed.sql            # Sample data
└── frontend/                       # Cloudflare Pages (static)
    ├── vite.config.js
    ├── package.json
    ├── public/_redirects            # SPA routing
    ├── index.html                   # Homepage
    ├── article.html                 # Article detail
    ├── category.html                # Category listing
    └── admin.html                   # Admin panel
```

---

*Built on Cloudflare's free tier. No servers. No monthly bills at launch. Scales to millions of readers.*
