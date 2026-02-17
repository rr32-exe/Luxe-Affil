-- Seed data — run after migration
-- wrangler d1 execute luxe-db --file=./src/db/seed.sql

-- Categories
INSERT OR IGNORE INTO categories (slug, name, description, icon) VALUES
  ('executive-gear', 'Executive Gear', 'High-end tech, watches, and business essentials for the discerning professional.', '⌚'),
  ('luxury-lifestyle', 'Luxury Lifestyle', 'Yachts, private air travel, bespoke tailoring, and the art of living well.', '✈️'),
  ('elite-grooming', 'Elite Grooming', 'Premium colognes, skincare, and grooming tools curated for the modern gentleman.', '🪒'),
  ('work-travel', 'Work & Travel', 'Luggage, business-class essentials, and travel tech for the global executive.', '🧳'),
  ('home-office', 'Home & Office Prestige', 'Espresso machines, office furniture, and workspace objects that inspire excellence.', '🏛️');

-- Site config defaults
INSERT OR IGNORE INTO site_config (key, value) VALUES
  ('articles_per_page', '12'),
  ('auto_publish', 'false'),
  ('ai_model', '@cf/meta/llama-3.1-8b-instruct'),
  ('site_tagline', 'Curated excellence for the discerning professional.'),
  ('footer_text', 'LUXE STANDARD — The editorial standard for refined living.');

-- Example affiliate links (replace URLs with your real ShareASale/Impact links)
-- Format: product_name, description, price_usd, price_display, brand, affiliate_url, network, tags
INSERT OR IGNORE INTO affiliate_links (category_id, product_name, product_description, price_usd, price_display, brand, affiliate_url, network, tags, is_featured) VALUES
  (1, 'Montblanc Meisterstück Briefcase', 'The iconic black leather briefcase favoured by executives across three continents. Full-grain calfskin with gold hardware.', 1850.00, '$1,850', 'Montblanc', 'https://shareasale.com/r.cfm?YOUR_LINK_1', 'shareasale', '["leather","briefcase","luxury","executive"]', 1),
  (1, 'Apple Watch Ultra 2', 'Titanium case, precision GPS, 36-hour battery life. The instrument of choice for executives who refuse compromise.', 799.00, '$799', 'Apple', 'https://shareasale.com/r.cfm?YOUR_LINK_2', 'shareasale', '["watch","tech","titanium","apple"]', 1),
  (2, 'Rimowa Essential Cabin', 'Aerospace-grade polycarbonate with the smooth multi-wheel system. Cabin-approved and unmistakably iconic.', 700.00, '$700', 'Rimowa', 'https://shareasale.com/r.cfm?YOUR_LINK_3', 'shareasale', '["luggage","travel","german","minimalist"]', 0),
  (3, 'Creed Aventus Cologne', 'The definitive masculine fragrance. Smoky birch, blackcurrant, ambergris — complexity that matches the wearer.', 475.00, '$475', 'Creed', 'https://shareasale.com/r.cfm?YOUR_LINK_4', 'shareasale', '["fragrance","cologne","luxury","niche"]', 1),
  (5, 'De Longhi La Specialista', 'Bean-to-cup mastery with integrated grinder, dual heating system, and professional tamper. Your office deserves better.', 649.00, '$649', 'De Longhi', 'https://shareasale.com/r.cfm?YOUR_LINK_5', 'shareasale', '["coffee","espresso","kitchen","office"]', 0);
