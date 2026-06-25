-- ============================================================
-- Hinova Partners パートナーポータル化
--  - パートナー本人ログイン（auth紐付け）
--  - 招待トークン → 本登録
--  - パートナー向け RLS（自分のデータのみ）
-- ============================================================

-- ------------------------------------------------------------
-- 1. partners：認証紐付け・招待・追加プロフィール
-- ------------------------------------------------------------
alter table public.partners
  add column if not exists auth_user_id uuid,
  add column if not exists invite_token text unique,
  add column if not exists invited_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists address text;
-- bank_info(jsonb) は初期スキーマに存在

create index if not exists idx_partners_auth_user_id on public.partners(auth_user_id);

-- ------------------------------------------------------------
-- 2. materials：ランク出し分け
-- ------------------------------------------------------------
alter table public.materials
  add column if not exists min_rank_sort int;  -- このランク sort_order 以上で閲覧可（null=全員）

-- ------------------------------------------------------------
-- 3. ヘルパー関数
-- ------------------------------------------------------------
-- ログイン中ユーザーに紐づくパートナーID
create or replace function public.current_partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.partners where auth_user_id = auth.uid() limit 1;
$$;

-- 招待トークンから本登録に必要な最小情報を返す（anon可・トークンを知る人のみ）
create or replace function public.get_invite_partner(p_token text)
returns table (id uuid, name text, phone_last4 text, activated boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name,
         right(regexp_replace(coalesce(p.phone,''), '\D', '', 'g'), 4) as phone_last4,
         (p.auth_user_id is not null) as activated
  from public.partners p
  where p.invite_token = p_token
  limit 1;
$$;

-- 認証済みユーザーが招待を受諾し、自分の auth.uid() を紐付ける
create or replace function public.claim_partner_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  update public.partners
    set auth_user_id = auth.uid(), activated_at = coalesce(activated_at, now())
    where invite_token = p_token and auth_user_id is null
    returning id into v_id;
  return v_id;  -- null の場合は無効/使用済みトークン
end;
$$;

grant execute on function public.get_invite_partner(text) to anon, authenticated;
grant execute on function public.claim_partner_invite(text) to authenticated;
grant execute on function public.current_partner_id() to authenticated;

-- ------------------------------------------------------------
-- 4. RLS：パートナー本人向けポリシー（管理者ポリシーは既存のまま併存）
-- ------------------------------------------------------------

-- 参照テーブル（商材・ランク・資料）：ログイン済みは閲覧可
do $$
declare t text;
begin
  foreach t in array array['products','partner_ranks','materials'] loop
    execute format('drop policy if exists %I on public.%I;', t || '_partner_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true);',
      t || '_partner_select', t
    );
  end loop;
end $$;

-- partners：自分の行を参照・更新できる
drop policy if exists partners_self_select on public.partners;
create policy partners_self_select on public.partners
  for select to authenticated
  using (public.is_partner_admin() or auth_user_id = auth.uid());

drop policy if exists partners_self_update on public.partners;
create policy partners_self_update on public.partners
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- partner_products / partner_commission_rules：自分の分を参照
do $$
declare t text;
begin
  foreach t in array array['partner_products','partner_commission_rules'] loop
    execute format('drop policy if exists %I on public.%I;', t || '_partner_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (partner_id = public.current_partner_id());',
      t || '_partner_select', t
    );
  end loop;
end $$;

-- leads / deals：自分の紹介を参照・新規作成できる
do $$
declare t text;
begin
  foreach t in array array['leads','deals'] loop
    execute format('drop policy if exists %I on public.%I;', t || '_partner_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (partner_id = public.current_partner_id());',
      t || '_partner_select', t
    );
    execute format('drop policy if exists %I on public.%I;', t || '_partner_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (partner_id = public.current_partner_id());',
      t || '_partner_insert', t
    );
  end loop;
end $$;

-- commissions：自分のお礼を参照
drop policy if exists commissions_partner_select on public.commissions;
create policy commissions_partner_select on public.commissions
  for select to authenticated
  using (partner_id = public.current_partner_id());
