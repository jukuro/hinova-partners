-- ============================================================
-- file: 20260625090300_referral_intake.sql
-- 紹介URL（パートナーがLINE/SNSで送り、顧客が自分で登録）
--  紹介コード(referral_code)付きの公開ページから、顧客本人が登録する。
--  匿名(anon)でも安全に使えるよう、必要最小限のRPCのみ公開する。
-- ============================================================

-- 紹介コードからパートナーの最小情報を返す（anon可）
create or replace function public.get_partner_by_code(p_code text)
returns table (id uuid, name text, active boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, (p.status = 'active') as active
  from public.partners p
  where p.referral_code = p_code
  limit 1;
$$;

-- 紹介ページに出す商材一覧（報酬率など内部情報は返さない・anon可）
create or replace function public.list_referral_products()
returns table (id uuid, name text, business text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.business
  from public.products p
  where p.is_active = true
  order by p.name;
$$;

-- 顧客本人が紹介フォームを送信（anon可）。商材ごとに1件ずつ lead を作成。
create or replace function public.submit_referral(
  p_code text,
  p_customer_name text,
  p_customer_contact text,
  p_memo text,
  p_product_ids uuid[]
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_partner_id uuid;
  v_ids uuid[];
  v_pid uuid;
  v_count int := 0;
begin
  select id into v_partner_id from public.partners where referral_code = p_code limit 1;
  if v_partner_id is null then
    raise exception 'invalid referral code';
  end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'name required';
  end if;

  -- 商材未選択なら商材なしで1件
  v_ids := case when p_product_ids is null or array_length(p_product_ids, 1) is null
                then array[null]::uuid[] else p_product_ids end;

  foreach v_pid in array v_ids loop
    insert into public.leads (partner_id, product_id, customer_name, customer_contact, ok_to_contact, memo, status)
    values (v_partner_id, v_pid, btrim(p_customer_name), nullif(btrim(coalesce(p_customer_contact,'')), ''), true, nullif(btrim(coalesce(p_memo,'')), ''), 'referred');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.get_partner_by_code(text) to anon, authenticated;
grant execute on function public.list_referral_products() to anon, authenticated;
grant execute on function public.submit_referral(text, text, text, text, uuid[]) to anon, authenticated;
