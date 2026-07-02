-- =============================================================
-- 全テーブルの Row Level Security (RLS) を有効化し、
-- 「自分の行しか読み書きできない」ポリシーを設定する。
-- 冪等（何度実行しても安全）。Supabase SQL Editor でそのまま実行可。
-- =============================================================

-- ---------- user_id 列を持つテーブル ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts',
    'categories',
    'counterparties',
    'monthly_budgets',
    'salary_item_settings',
    'salary_slips',
    'subscriptions',
    'transactions',
    'user_settings'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice 'skip: table public.% not found', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_select_own" on public.%I', t, t);
    execute format(
      'create policy "%s_select_own" on public.%I for select using (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
    execute format(
      'create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists "%s_update_own" on public.%I', t, t);
    execute format(
      'create policy "%s_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);

    execute format('drop policy if exists "%s_delete_own" on public.%I', t, t);
    execute format(
      'create policy "%s_delete_own" on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- ---------- salary_slip_items（user_id 列が無く slip_id で親に紐付く） ----------
alter table public.salary_slip_items enable row level security;

drop policy if exists "salary_slip_items_select_own" on public.salary_slip_items;
create policy "salary_slip_items_select_own" on public.salary_slip_items
  for select using (
    exists (select 1 from public.salary_slips s
            where s.id = salary_slip_items.slip_id and s.user_id = auth.uid()));

drop policy if exists "salary_slip_items_insert_own" on public.salary_slip_items;
create policy "salary_slip_items_insert_own" on public.salary_slip_items
  for insert with check (
    exists (select 1 from public.salary_slips s
            where s.id = salary_slip_items.slip_id and s.user_id = auth.uid()));

drop policy if exists "salary_slip_items_update_own" on public.salary_slip_items;
create policy "salary_slip_items_update_own" on public.salary_slip_items
  for update using (
    exists (select 1 from public.salary_slips s
            where s.id = salary_slip_items.slip_id and s.user_id = auth.uid()))
  with check (
    exists (select 1 from public.salary_slips s
            where s.id = salary_slip_items.slip_id and s.user_id = auth.uid()));

drop policy if exists "salary_slip_items_delete_own" on public.salary_slip_items;
create policy "salary_slip_items_delete_own" on public.salary_slip_items
  for delete using (
    exists (select 1 from public.salary_slips s
            where s.id = salary_slip_items.slip_id and s.user_id = auth.uid()));

-- ---------- profiles（主キーが id か user_id かを自動判定） ----------
do $$
declare
  col text;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    raise notice 'skip: table public.profiles not found';
    return;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_id') then
    col := 'user_id';
  elsif exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'profiles' and column_name = 'id') then
    col := 'id';
  else
    raise notice 'skip: profiles has neither user_id nor id column';
    return;
  end if;

  execute 'alter table public.profiles enable row level security';

  execute 'drop policy if exists "profiles_select_own" on public.profiles';
  execute format(
    'create policy "profiles_select_own" on public.profiles for select using (auth.uid() = %I)', col);

  execute 'drop policy if exists "profiles_insert_own" on public.profiles';
  execute format(
    'create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = %I)', col);

  execute 'drop policy if exists "profiles_update_own" on public.profiles';
  execute format(
    'create policy "profiles_update_own" on public.profiles for update using (auth.uid() = %I) with check (auth.uid() = %I)', col, col);

  execute 'drop policy if exists "profiles_delete_own" on public.profiles';
  execute format(
    'create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = %I)', col);
end $$;

-- ---------- ビューは呼び出し元の権限で実行させる（RLSを素通りさせない） ----------
do $$
begin
  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'budget_summary_view'
  ) then
    execute 'alter view public.budget_summary_view set (security_invoker = true)';
  end if;
end $$;
