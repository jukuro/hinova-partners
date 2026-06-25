-- file: 20260625110000_product_fk_set_null.sql
-- ============================================================
-- プラン(products)を参照する外部キーを ON DELETE SET NULL に変更
--  紹介(leads/deals)やお礼(commissions)から参照されていても、
--  プラン/商材を削除できるようにする（参照側は商材未定になるだけ。
--  commissions は product_name スナップショットを保持しているので表示は維持）
-- ============================================================

alter table public.leads drop constraint if exists leads_product_id_fkey;
alter table public.leads
  add constraint leads_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

alter table public.deals drop constraint if exists deals_product_id_fkey;
alter table public.deals
  add constraint deals_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

alter table public.commissions drop constraint if exists commissions_product_id_fkey;
alter table public.commissions
  add constraint commissions_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;
