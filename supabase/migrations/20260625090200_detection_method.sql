-- ============================================================
-- file: 20260625090200_detection_method.sql
-- 商材の「契約の把握方法」
--  manual : 手動で「契約（有料登録）」に印をつける（デザイン等・全商材で利用可）
--  stripe : Stripe課金で自動把握（将来：各アプリが紹介コードをStripeへ渡す改修とセット）
-- ============================================================
alter table public.products
  add column if not exists detection_method text not null default 'manual';
