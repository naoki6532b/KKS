import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/components/header";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("id, tx_date, tx_type, amount, memo, categories(name), counterparties(name), accounts(name)")
    .order("tx_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-heading">
          <h1 className="page-title">取引一覧</h1>
          <Link href="/transactions/new" className="btn btn-primary">
            ＋ 出入金入力
          </Link>
        </div>

        <div className="card">
          {error && <div className="alert alert-error" style={{ margin: 16 }}>{error.message}</div>}

          {(rows ?? []).length === 0 ? (
            <p className="empty-state">取引がまだありません。</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>種別</th>
                    <th style={{ textAlign: "right" }}>金額</th>
                    <th>科目</th>
                    <th>相手先</th>
                    <th>口座</th>
                    <th>メモ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((row) => (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{row.tx_date}</td>
                      <td>
                        <span className={row.tx_type === "income" ? "badge badge-income" : "badge badge-expense"}>
                          {row.tx_type === "income" ? "入金" : "出金"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <span className={row.tx_type === "income" ? "amount-income" : "amount-expense"}>
                          {row.amount.toLocaleString()} 円
                        </span>
                      </td>
                      <td>{(row.categories as { name?: string } | null)?.name ?? "—"}</td>
                      <td>{(row.counterparties as { name?: string } | null)?.name ?? "—"}</td>
                      <td>{(row.accounts as { name?: string } | null)?.name ?? "—"}</td>
                      <td
                        style={{
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--text-3)",
                        }}
                      >
                        {row.memo ?? ""}
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link href={`/transactions/${row.id}/edit`} className="btn btn-secondary btn-sm">
                            訂正
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
