-- ============================================================
-- file: 20260625090000_reward_rate_system.sql
-- Hinova Partners 報酬率ベース化（固定額 → 月額 × 報酬率）
-- ============================================================

-- ------------------------------------------------------------
-- 1. パートナーランク（ランク加算率）
-- ------------------------------------------------------------
create table if not exists public.partner_ranks (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- 表示名
  slug text not null unique,                -- 内部識別子
  rate_addition numeric(5,2) not null default 0, -- ランク加算率（%）
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- 初期3ランク（仕様書の用語に準拠。「代理店」表現は使わない）
insert into public.partner_ranks (slug, name, rate_addition, sort_order)
values
  ('partner',         'Hinova Partner',         0, 1),
  ('local_partner',   'Hinova Local Partner',   3, 2),
  ('trusted_partner', 'Hinova Trusted Partner', 8, 3)
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 2. 商材：報酬率カラム
-- ------------------------------------------------------------
alter table public.products
  add column if not exists base_reward_rate numeric(5,2),  -- 基本報酬率（%）
  add column if not exists max_reward_rate  numeric(5,2),  -- 最大報酬率（上限・任意）
  add column if not exists rounding_rule    text not null default 'floor_10';
  -- rounding_rule: 'floor_10' | 'floor_100' | 'round'

-- ------------------------------------------------------------
-- 3. パートナー：ランクFK・ステータス
-- ------------------------------------------------------------
alter table public.partners
  add column if not exists rank_id uuid references public.partner_ranks(id),
  add column if not exists status  text not null default 'reviewing';
  -- status: 'reviewing'（審査中）| 'active'（稼働中）| 'inactive'（停止）

-- 既存 rank(text) → rank_id / status へ移行
update public.partners p set
  rank_id = r.id,
  status = case when p.rank = 'supporter' then 'reviewing' else 'active' end
from public.partner_ranks r
where r.slug = case p.rank
    when 'supporter'       then 'partner'
    when 'guide'           then 'partner'
    when 'partner'         then 'partner'
    when 'local_partner'   then 'local_partner'
    when 'trusted_partner' then 'trusted_partner'
    else 'partner'
  end
  and p.rank_id is null;

-- ランク未設定のパートナーは partner にフォールバック
update public.partners p set rank_id = r.id
from public.partner_ranks r
where r.slug = 'partner' and p.rank_id is null;

-- ------------------------------------------------------------
-- 4. パートナー個別報酬率（既存 partner_commission_rules を流用）
-- ------------------------------------------------------------
alter table public.partner_commission_rules
  add column if not exists custom_rate numeric(5,2);  -- 個別報酬率（%）

-- ------------------------------------------------------------
-- 5. 契約（deals）への報酬率スナップショット（契約日ロック）
-- ------------------------------------------------------------
alter table public.deals
  add column if not exists locked_reward_rate numeric(5,2),  -- 契約日に確定した適用報酬率（%）
  add column if not exists locked_rate_basis  jsonb;         -- 確定時の計算根拠
-- 契約日は既存の contracted_at を使用

-- ------------------------------------------------------------
-- 6. 報酬履歴（既存 commissions を拡張・不変スナップショット）
-- ------------------------------------------------------------
alter table public.commissions
  add column if not exists product_id        uuid references public.products(id) on delete set null,
  add column if not exists product_name      text,            -- 商材名スナップショット
  add column if not exists customer_name     text,            -- 顧客名スナップショット
  add column if not exists payment_amount    numeric,         -- 決済金額
  add column if not exists applied_rate      numeric(5,2),    -- 適用された報酬率（%）
  add column if not exists calculation_basis jsonb;           -- 計算根拠
-- amount = 計算されたお礼金額（既存カラムを継続使用）
-- status: 'pending'（未払い）| 'paid'（支払済み）| 'cancelled'（取消）

-- ------------------------------------------------------------
-- 7. RLS（新規テーブル：ログイン済みユーザーは全操作可）
-- ------------------------------------------------------------
alter table public.partner_ranks enable row level security;
drop policy if exists partner_ranks_authenticated_all on public.partner_ranks;
create policy partner_ranks_authenticated_all on public.partner_ranks
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
