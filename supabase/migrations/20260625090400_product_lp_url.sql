-- file: 20260625090400_product_lp_url.sql
-- 商材ごとのLP（ランディングページ）URL
-- パートナーの紹介リンクは「このLP URL + ?ref=紹介コード」で生成する
alter table public.products
  add column if not exists lp_url text;
