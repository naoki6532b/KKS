"use client";

import { useState } from "react";
import Link from "next/link";
import { CURRENCY_MAP } from "@/lib/exchange";

export type TxRow = {
  id: string;
  tx_date: string;
  tx_type: string;
  amount: number;
  currency?: string | null;
  currency_amount?: number | null;
  exchange_rate?: number | null;
  item_name?: string | null;
  counterparty_name?: string | null;
  memo?: string | null;
  has_tax?: boolean | null;
  tax_amount?: number | null;
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

function AmountCell({ row, type }: { row: TxRow; type: "income" | "expense" }) {
  if (row.tx_type !== type) return <></>;
  const foreign = row.currency && row.currency !== "JPY" && row.currency_amount;
  return (
    <span className={type === "income" ? "amount-income" : "amount-expense"}>
      {foreign
        ? <>{CURRENCY_MAP.get(row.currency!)?.symbol}{row.currency_amount!.toLocaleString()}<br /><span style={{ fontSize: 11, fontWeight: 400 }}>({row.amount.toLocaleString()}円)</span></>
        : <>{row.amount.toLocaleString()}</>}
    </span>
  );
}

export function TransactionList({ rows }: { rows: TxRow[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((row) =>
        row.counterparty_name?.toLowerCase().includes(q) ||
        row.item_name?.toLowerCase().includes(q) ||
        String(row.amount).includes(q) ||
        row.memo?.toLowerCase().includes(q) ||
        row.categories?.name?.toLowerCase().includes(q) ||
        row.counterparties?.name?.toLowerCase().includes(q) ||
        row.accounts?.name?.toLowerCase().includes(q)
      )
    : rows;

  const groups = groupByMonth(filtered);

  return (
    <>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
          <span style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-4)", fontSize: 15, pointerEvents: "none",
          }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="相手先名・品名・金額・メモで検索..."
            className="field-input"
            style={{ paddingLeft: 34, paddingRight: query ? 36 : 12 }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-3)", fontSize: 16, lineHeight: 1, padding: 2,
              }}
              title="検索クリア"
            >×</button>
          )}
        </div>
        {q && (
          <span style={{ fontSize: 13, color: "var(--text-3)", whiteSpace: "nowrap" }}>
            {filtered.length}件ヒット
          </span>
        )}
        {q && (
          <button type="button" onClick={() => setQuery("")} className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 14px", whiteSpace: "nowrap" }}>
            検索解除
          </button>
        )}
      </div>

      {/* Results */}
      {groups.length === 0 ? (
        <div className="card">
          <p className="empty-state">{q ? `「${query}」に一致する取引がありません。` : "取引がまだありません。"}</p>
        </div>
      ) : (
        groups.map(({ month, rows: mRows }) => {
          const incomeTotal  = mRows.filter((r) => r.tx_type === "income").reduce((s, r) => s + r.amount, 0);
          const expenseTotal = mRows.filter((r) => r.tx_type === "expense").reduce((s, r) => s + r.amount, 0);
          const [y, m] = month.split("-");

          return (
            <div key={month} className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <h2 className="card-title">{y}年{m}月</h2>
                {q && <span style={{ fontSize: 12, color: "var(--text-3)" }}>{mRows.length}件</span>}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 95 }}>日付</th>
                      <th style={{ minWidth: 100 }}>科目</th>
                      <th className="col-sp-hide" style={{ minWidth: 110 }}>相手先ジャンル</th>
                      <th style={{ minWidth: 110 }}>相手先名</th>
                      <th style={{ minWidth: 120 }}>品名 / 名称</th>
                      <th className="col-sp-hide" style={{ minWidth: 90 }}>口座</th>
                      <th className="col-sp-hide" style={{ minWidth: 120 }}>メモ</th>
                      <th style={{ textAlign: "right", minWidth: 90 }}>入金</th>
                      <th style={{ textAlign: "right", minWidth: 90 }}>出金</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mRows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{row.tx_date}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{row.categories?.name ?? "—"}</td>
                        <td className="col-sp-hide">{row.counterparties?.name ?? "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{row.counterparty_name ?? "—"}</td>
                        <td style={{ minWidth: 120, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-2)" }}>
                          {row.item_name ?? ""}
                          {row.has_tax && <span style={{ marginLeft:4, fontSize:10, background:"var(--sapphire-light)", color:"var(--sapphire)", borderRadius:4, padding:"1px 4px", fontWeight:600, verticalAlign:"middle" }}>税</span>}
                        </td>
                        <td className="col-sp-hide">{row.accounts?.name ?? "—"}</td>
                        <td className="col-sp-hide" style={{ minWidth: 120, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-3)" }}>
                          {row.memo ?? ""}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <AmountCell row={row} type="income" />
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <AmountCell row={row} type="expense" />
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link href={`/transactions/${row.id}/edit`} className="btn btn-secondary btn-sm">訂正</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--surface-2)", fontWeight: 700 }}>
                      <td colSpan={7} style={{ textAlign: "right", color: "var(--text-2)", fontSize: 13 }}>
                        {q ? "絞込合計" : "月合計"}
                      </td>
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
    </>
  );
}
