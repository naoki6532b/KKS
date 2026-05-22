-- 子育て支援金 (childcare_support) 項目追加
-- =====================================================================
-- salary_slip_items / salary_item_settings の item_key は TEXT 型のため
-- 通常はスキーマ変更不要。TypeScript 側の SALARY_ITEMS 追加のみで動作します。
--
-- ただし item_key に CHECK 制約が設定されている場合は以下を実行してください。
-- =====================================================================

-- CHECK 制約の確認（Supabase SQL エディタで実行して制約名を確認）
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'salary_item_settings'::regclass
  AND contype = 'c';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'salary_slip_items'::regclass
  AND contype = 'c';

-- ↑ の結果で item_key に IN(...) 制約がある場合のみ、以下を実行 ----------
-- （制約名は確認結果に合わせて変更すること）

-- ALTER TABLE salary_item_settings
--   DROP CONSTRAINT IF EXISTS salary_item_settings_item_key_check;

-- ALTER TABLE salary_slip_items
--   DROP CONSTRAINT IF EXISTS salary_slip_items_item_key_check;

-- 制約を削除するだけで OK（アプリ側で有効な item_key を管理するため再作成不要）
-- =========================================================================
