import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/components/header";

type SlipRow = {
  id: string;
  slip_date: string;
  slip_type: "salary" | "bonus";
  memo: string | null;
  accounts: { name?: string } | null;
  salary_slip_items: { amount: number; item_key: string }[];
};

import { SALARY_ITEM_MAP } from "@/lib/salary";

function summarize(items: { amount: number; item_key: string }[]) {
  let payment = 0, deduction = 0;
  for (const it of items) {
    const def = SALARY_ITEM_MAP.get(it.item_key);
    if (!def) continue;
    if (def.section === "deduction") deduction += it.amount;
    else                              payment += it.amount;
  }
  return { payment, deduction, net: payment - deduction };
}

export default async function SalaryListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("salary_slips")
    .select("id, slip_date, slip_type, memo, accounts(name), salary_slip_items(item_key, amount)")
    .order("slip_date", { ascending: false })
    .limit(120);

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-heading">
          <h1 className="page-title">給与・賞与 明細</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/salary/settings" className="btn btn-secondary">マッピング設定</Link>
            <Link href="/salary/new" className="btn btn-primary">＋ 給与入力</Link>
          </div>
        </div>

        {error && <div className="alert alert-error">{error.message}</div>}

        {(!rows || rows.length === 0) ? (
          <div className="card">
            <p className="empty-state">
              給与明細はまだありません。<br />
              先に <Link href="/salary/settings" style={{ color: "var(--sapphire)" }}>マッピング設定</Link> で各項目の出入金登録方法を設定してください。
            </p>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>支給日</th>
                    <th>種別</th>
                    <th className="col-sp-hide">振込先口座</th>
                    <th className="col-sp-hide">メモ</th>
                    <th style={{ textAlign: "right" }}>支給合計</th>
                    <th style={{ textAlign: "right" }}>控除合計</th>
                    <th style={{ textAlign: "right" }}>差引支給額</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as unknown as SlipRow[]).map((r) => {
                    const s = summarize(r.salary_slip_items);
                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{r.slip_date}</td>
                        <td>{r.slip_type === "salary" ? "給与" : "賞与"}</td>
                        <td className="col-sp-hide">{r.accounts?.name ?? "—"}</td>
                        <td className="col-sp-hide" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-3)" }}>
                          {r.memo ?? ""}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <span className="amount-income">{s.payment.toLocaleString()}</span>
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <span className="amount-expense">{s.deduction.toLocaleString()}</span>
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: "var(--sapphire)" }}>
                          {s.net.toLocaleString()}
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link href={`/salary/${r.id}/edit`} className="btn btn-secondary btn-sm">訂正</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
