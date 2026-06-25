-- 商材ごとのLP（ランディングページ）URL
-- パートナーの紹介リンクは「このLP URL + ?ref=紹介コード」で生成する
alter table public.products
  add column if not exists lp_url text;
