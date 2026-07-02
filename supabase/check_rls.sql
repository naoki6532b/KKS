-- RLSの状態確認用（Supabase SQL Editor で実行して結果を確認）

-- 1) 各テーブルのRLS有効/無効
select relname as table_name,
       relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by relname;

-- 2) 設定済みポリシーの一覧
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
