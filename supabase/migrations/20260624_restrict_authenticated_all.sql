-- Replace the phase-0 "any authenticated user can do everything" policies.
-- Add administrator rows with the Supabase service role, for example:
-- insert into public.partner_admins (user_email) values ('admin@example.com');

create table if not exists public.partner_admins (
  id uuid primary key default gen_random_uuid(),
  user_email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.partner_admins enable row level security;

create or replace function public.is_partner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_admins
    where lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists partner_admins_select on public.partner_admins;
create policy partner_admins_select on public.partner_admins
  for select to authenticated
  using (public.is_partner_admin() or lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists partner_admins_insert on public.partner_admins;
create policy partner_admins_insert on public.partner_admins
  for insert to authenticated
  with check (public.is_partner_admin());

drop policy if exists partner_admins_update on public.partner_admins;
create policy partner_admins_update on public.partner_admins
  for update to authenticated
  using (public.is_partner_admin())
  with check (public.is_partner_admin());

drop policy if exists partner_admins_delete on public.partner_admins;
create policy partner_admins_delete on public.partner_admins
  for delete to authenticated
  using (public.is_partner_admin());

do $$
declare
  t text;
begin
  foreach t in array array[
    'partners',
    'products',
    'partner_products',
    'partner_commission_rules',
    'leads',
    'deals',
    'deal_events',
    'commissions',
    'payouts',
    'materials'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_authenticated_all', t);
    execute format('drop policy if exists %I on public.%I;', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_partner_admin()) with check (public.is_partner_admin());',
      t || '_admin_all',
      t
    );
  end loop;
end $$;