import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveTransactionAction } from "./actions";

export default async function NewTransactionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: categories }, { data: counterparties }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, kind, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),

      supabase
        .from("counterparties")
        .select("id, kind, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),

      supabase
        .from("accounts")
        .select("id, account_type, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/">← 戻る</Link>
      </div>

      <div style={{ background: "#fff", padding: 24, borderRadius: 12 }}>
        <h1>出入金入力</h1>

        <form action={saveTransactionAction} style={{ display: "grid", gap: 12 }}>
          <label>
            日付
            <br />
            <input
              name="tx_date"
              type="date"
              defaultValue={today}
              required
              style={{ padding: 10, fontSize: 16 }}
            />
          </label>

          <label>
            種別
            <br />
            <select name="tx_type" defaultValue="expense" style={{ padding: 10, fontSize: 16 }}>
              <option value="expense">出金</option>
              <option value="income">入金</option>
            </select>
          </label>

          <label>
            金額
            <br />
            <input
              name="amount"
              type="number"
              min="1"
              required
              style={{ padding: 10, fontSize: 16 }}
            />
          </label>

          <label>
            科目
            <br />
            <select name="category_id" style={{ padding: 10, fontSize: 16 }}>
              <option value="">未選択</option>
              {(categories ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  [{row.kind}] {row.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            相手先
            <br />
            <select name="counterparty_id" style={{ padding: 10, fontSize: 16 }}>
              <option value="">未選択</option>
              {(counterparties ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  [{row.kind}] {row.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            現金/銀行/カード
            <br />
            <select name="account_id" required style={{ padding: 10, fontSize: 16 }}>
              <option value="">選択してください</option>
              {(accounts ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  [{row.account_type}] {row.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            メモ
            <br />
            <textarea
              name="memo"
              rows={4}
              style={{ padding: 10, fontSize: 16, resize: "vertical" }}
            />
          </label>

          <button type="submit" style={{ padding: 12, fontSize: 16 }}>
            保存
          </button>
        </form>
      </div>
    </main>
  );
}