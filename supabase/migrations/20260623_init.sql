-- ============================================================
-- Hinova Partners 初期スキーマ（フェーズ0：管理者専用）
-- ============================================================

-- パートナー
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_kana text,
  email text,
  phone text,
  referral_code text unique,
  partner_type text,            -- 'local'|'user'|'industry'|'side_job'|'support'|'creative'
  company_name text,
  bank_info jsonb,
  rank text default 'supporter', -- 'supporter'|'guide'|'partner'|'local_partner'|'trusted_partner'
  note text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 商材
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  business text,                -- 'hinova_biz'|'hinova_crm'|'medaka'|'ochome'|'design'|'family_tree'|'other'
  unit_price numeric,
  commission_type text,         -- 'fixed'|'rate'|'recurring'
  commission_value numeric,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- パートナー別商材割当
create table if not exists public.partner_products (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(partner_id, product_id)
);

-- パートナー別報酬ルール（商材の標準報酬を上書き）
create table if not exists public.partner_commission_rules (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  commission_type text,
  commission_value numeric,
  note text,
  created_at timestamptz default now(),
  unique(partner_id, product_id)
);

-- かんたん紹介
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id),
  product_id uuid references public.products(id),
  customer_name text not null,
  customer_contact text,
  ok_to_contact boolean default true,
  memo text,
  status text default 'received', -- 'received'|'in_progress'|'started'|'skipped'
  created_at timestamptz default now()
);

-- 紹介状況（しっかり管理）
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id),
  product_id uuid references public.products(id),
  customer_name text not null,
  customer_contact text,
  status text default 'memo',
    -- 'memo'|'introduced'|'hinova_handling'|'considering'
    -- |'started'|'payment_confirmed'|'skipped'|'not_applicable'
  contracted_at date,
  paid_at date,
  amount numeric,
  next_contact_date date,
  note text,
  registered_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 紹介状況履歴
create table if not exists public.deal_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  status_from text,
  status_to text,
  note text,
  created_at timestamptz default now()
);

-- お礼額
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  partner_id uuid references public.partners(id),
  amount numeric,                  -- null = 管理者確認待ち
  commission_type text,
  status text default 'pending',   -- 'pending'|'confirmed'|'paid'|'cancelled'
  payment_month text,              -- '2026-07'
  paid_at date,
  note text,
  created_at timestamptz default now()
);

-- 支払い記録
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id),
  payment_month text not null,
  total_amount numeric not null,
  paid_at date,
  note text,
  created_at timestamptz default now()
);

-- 説明資料ライブラリ
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,  -- 'intro'|'customer_facing'|'partner_guide'|'faq'|'prohibited'|'industry'|'url_qr'
  business text,
  file_url text,
  description text,
  is_public boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS（フェーズ0：ログイン済みユーザーは全操作可）
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'partners','products','partner_products','partner_commission_rules',
    'leads','deals','deal_events','commissions','payouts','materials'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_authenticated_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
