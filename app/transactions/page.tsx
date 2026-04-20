import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/components/header";

type TxRow = {
  id: string;
  tx_date: string;
  tx_type: string;
  amount: number;
  item_name?: string | null;
  memo?: string | null;
  categories: { name?: string } | null;
  counterparties: { name?: string } | null;
  accounts: { name?: string } | null;
};

function groupByMonth(rows: TxRow[]): { month: string; rows: TxRow[] }[] {
  const map = new Map<string, TxRow[]>();
  for (const row of rows) {
    const month = row.tx_date.slice(0, 7);
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(row);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, rows]) => ({ month, rows }));
}

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("id, tx_date, tx_type, amount, item_name, memo, categories(name), counterparties(name), accounts(name)")
    .order("tx_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(500);

  const groups = groupByMonth((rows ?? []) as TxRow[]);

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

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error.message}</div>}

        {groups.length === 0 ? (
          <div className="card"><p className="empty-state">取引がまだありません。</p></div>
        ) : (
          groups.map(({ month, rows: mRows }) => {
            const incomeTotal  = mRows.filter((r) => r.tx_type === "income").reduce((s, r) => s + r.amount, 0);
            const expenseTotal = mRows.filter((r) => r.tx_type === "expense").reduce((s, r) => s + r.amount, 0);
            const [y, m] = month.split("-");

            return (
              <div key={month} className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <h2 className="card-title">{y}年{m}月</h2>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>日付</th>
                        <th>科目</th>
                        <th>相手先</th>
                        <th>品名 / 名称</th>
                        <th>口座</th>
                        <th>メモ</th>
                        <th style={{ textAlign: "right" }}>入金</th>
                        <th style={{ textAlign: "right" }}>出金</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mRows.map((row) => (
                        <tr key={row.id}>
                          <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{row.tx_date}</td>
                          <td>{row.categories?.name ?? "—"}</td>
                          <td>{row.counterparties?.name ?? "—"}</td>
                          <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-2)" }}>
                            {row.item_name ?? ""}
                          </td>
                          <td>{row.accounts?.name ?? "—"}</td>
                          <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-3)" }}>
                            {row.memo ?? ""}
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {row.tx_type === "income" ? (
                              <span className="amount-income">{row.amount.toLocaleString()}</span>
                            ) : ""}
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {row.tx_type === "expense" ? (
                              <span className="amount-expense">{row.amount.toLocaleString()}</span>
                            ) : ""}
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
                    <tfoot>
                      <tr style={{ background: "var(--surface-2)", fontWeight: 700 }}>
                        <td colSpan={6} style={{ textAlign: "right", color: "var(--text-2)", fontSize: 13 }}>月合計</td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <span className="amount-income">{incomeTotal.toLocaleString()}</span>
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <span className="amount-expense">{expenseTotal.toLocaleString()}</span>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </main>
    </>
  );
}
