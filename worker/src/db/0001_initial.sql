-- Migration 0001: Initial schema
-- Run: wrangler d1 migrations apply luxe-db

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id),
  product_name TEXT NOT NULL,
  product_description TEXT,
  price_usd REAL,
  price_display TEXT,
  brand TEXT,
  affiliate_url TEXT NOT NULL,
  network TEXT DEFAULT 'shareasale', -- shareasale | impact | direct
  image_url TEXT,
  tags TEXT, -- JSON array stored as text
  is_featured INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_link_id INTEGER REFERENCES affiliate_links(id),
  category_id INTEGER REFERENCES categories(id),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  excerpt TEXT,
  body_html TEXT NOT NULL,
  hero_image_url TEXT,
  article_type TEXT DEFAULT 'spotlight', -- spotlight | comparison | lifestyle | guide
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT, -- JSON array as text
  og_image_url TEXT,
  schema_json TEXT, -- JSON-LD structured data
  word_count INTEGER DEFAULT 0,
  read_time_minutes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft', -- draft | published | archived
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_affiliate_links (
  article_id INTEGER REFERENCES articles(id),
  affiliate_link_id INTEGER REFERENCES affiliate_links(id),
  placement TEXT DEFAULT 'body', -- hero | body | sidebar | cta
  PRIMARY KEY (article_id, affiliate_link_id)
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_category ON affiliate_links(category_id);
