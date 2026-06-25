-- file: 20260625100000_services_plans.sql
-- ============================================================
-- 商材／プランの2階層化
--  services（商材：Biz/CRM）… LP URL・事業・把握方法（共通）
--  products（プラン）        … 月額・報酬率・端数処理（プランごと）。service_id で商材に紐付け
--  ※ deals/leads/commissions 等は従来どおり product_id（=プラン）参照
-- ============================================================

-- 1. 商材（サービス）テーブル
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business text,
  lp_url text,
  detection_method text not null default 'manual',
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- 2. プラン（既存products）に商材への参照を追加
alter table public.products
  add column if not exists service_id uuid references public.services(id) on delete set null;

-- 3. 既存データ移行：「商材名 - プラン名」で分割し、商材ごとに service を作成
do $$
declare r record; v_service uuid;
begin
  -- 既に移行済み（service_idがある）なら何もしない
  if exists (select 1 from public.products where service_id is not null) then
    return;
  end if;

  for r in
    select trim(split_part(name, ' - ', 1)) as base,
           max(lp_url) as lp_url,
           max(business) as business,
           max(detection_method) as detection_method
    from public.products
    group by trim(split_part(name, ' - ', 1))
  loop
    insert into public.services (name, business, lp_url, detection_method)
      values (r.base, r.business, r.lp_url, coalesce(r.detection_method, 'manual'))
      returning id into v_service;

    update public.products p set
      service_id = v_service,
      name = coalesce(nullif(trim(split_part(p.name, ' - ', 2)), ''), '標準')
    where trim(split_part(p.name, ' - ', 1)) = r.base;
  end loop;
end $$;

-- 4. RLS（管理者=全操作 / ログイン済み=閲覧）
alter table public.services enable row level security;
drop policy if exists services_admin_all on public.services;
create policy services_admin_all on public.services
  for all to authenticated using (public.is_partner_admin()) with check (public.is_partner_admin());
drop policy if exists services_partner_select on public.services;
create policy services_partner_select on public.services
  for select to authenticated using (true);
