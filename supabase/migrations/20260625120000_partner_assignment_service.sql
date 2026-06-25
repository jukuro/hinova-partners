-- file: 20260625120000_partner_assignment_service.sql
-- ============================================================
-- パートナーの担当・個別報酬率を「商材（サービス）単位」に変更
--  partner_products / partner_commission_rules に service_id を追加し、
--  以降は service 単位で割当・個別報酬率を管理する
--  （個別報酬率は商材に対して1つ。その商材の全プランに適用される）
-- ============================================================

alter table public.partner_products
  add column if not exists service_id uuid references public.services(id) on delete cascade;

alter table public.partner_commission_rules
  add column if not exists service_id uuid references public.services(id) on delete cascade;

-- 既存の product(プラン)単位データを service へ寄せる（重複は無視）
update public.partner_products pp
  set service_id = pr.service_id
  from public.products pr
  where pp.product_id = pr.id and pp.service_id is null;

update public.partner_commission_rules r
  set service_id = pr.service_id
  from public.products pr
  where r.product_id = pr.id and r.service_id is null;
