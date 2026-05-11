"use client";

import { useState, useRef, useEffect } from "react";
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
  salary_slip_id?: string | null;
  categories: { name?: string } | null;
  counterparties: { name?: string } | null;
  accounts: { name?: string } | null;
};

function uniq(vals: (string | undefined | null)[]): string[] {
  return Array.from(new Set(vals.filter((v): v is string => v != null && v !== ""))).sort();
}

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

function FilterDropdown({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  selected: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (values.length === 0) return <>{label}</>;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          padding: 0,
          fontWeight: 600,
          fontSize: "inherit",
          color: selected ? "var(--sapphire)" : "inherit",
          whiteSpace: "nowrap",
        }}
        title={selected ? `${label}：${selected}（クリックで変更）` : `${label}で絞り込む`}
      >
        {label}
        <span style={{ fontSize: 8, opacity: 0.7 }}>{selected ? "▼" : "▽"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          zIndex: 200,
          backgroundColor: "white",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 8,
          boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
          minWidth: 160,
          maxHeight: 260,
          overflowY: "auto",
        }}>
          {([null, ...values] as (string | null)[]).map((v) => (
            <button
              key={v ?? "__all__"}
              type="button"
              onClick={() => { onChange(v); setOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 14px",
                textAlign: "left",
                background: selected === v ? "var(--sapphire-light, #eff6ff)" : "none",
                border: "none",
                borderBottom: "1px solid var(--border-light, rgba(0,0,0,0.06))",
                cursor: "pointer",
                fontSize: 13,
                color: selected === v ? "var(--sapphire)" : "var(--text)",
                fontWeight: selected === v ? 700 : 400,
              }}
            >
              {v ?? "全て表示"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TransactionList({ rows }: { rows: TxRow[] }) {
  const [query, setQuery]           = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [catFilter, setCatFilter]   = useState<string | null>(null);
  const [genreFilter, setGenreFilter]     = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [cpNameFilter, setCpNameFilter]   = useState<string | null>(null);

  const cats    = uniq(rows.map((r) => r.categories?.name));
  const genres  = uniq(rows.map((r) => r.counterparties?.name));
  const accounts = uniq(rows.map((r) => r.accounts?.name));
  const cpNames  = uniq(rows.map((r) => r.counterparty_name));

  const q = query.trim().toLowerCase();

  const filtered = rows.filter((row) => {
    if (typeFilter === "income"  && row.tx_type !== "income")  return false;
    if (typeFilter === "expense" && row.tx_type !== "expense") return false;
    if (catFilter    !== null && (row.categories?.name    ?? null) !== catFilter)    return false;
    if (genreFilter  !== null && (row.counterparties?.name ?? null) !== genreFilter) return false;
    if (accountFilter !== null && (row.accounts?.name      ?? null) !== accountFilter) return false;
    if (cpNameFilter !== null && (row.counterparty_name    ?? null) !== cpNameFilter)  return false;
    if (q) {
      return (
        row.counterparty_name?.toLowerCase().includes(q) ||
        row.item_name?.toLowerCase().includes(q) ||
        String(row.amount).includes(q) ||
        row.memo?.toLowerCase().includes(q) ||
        row.categories?.name?.toLowerCase().includes(q) ||
        row.counterparties?.name?.toLowerCase().includes(q) ||
        row.accounts?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const hasFilter = typeFilter !== "all" || catFilter !== null || genreFilter !== null || accountFilter !== null || cpNameFilter !== null || q !== "";

  const clearAll = () => {
    setQuery(""); setTypeFilter("all");
    setCatFilter(null); setGenreFilter(null);
    setAccountFilter(null); setCpNameFilter(null);
  };

  const groups = groupByMonth(filtered);

  return (
    <>
      {/* 収入 / 支出 チップ */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", "income", "expense"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`btn ${typeFilter === t ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 13, padding: "5px 16px" }}
          >
            {t === "all" ? "全て" : t === "income" ? "収入" : "支出"}
          </button>
        ))}
        {hasFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: "5px 12px", marginLeft: "auto", color: "var(--text-3)" }}
          >
            絞込解除
          </button>
        )}
      </div>

      {/* 検索バー */}
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
        {hasFilter && (
          <span style={{ fontSize: 13, color: "var(--text-3)", whiteSpace: "nowrap" }}>
            {filtered.length}件
          </span>
        )}
      </div>

      {/* 結果 */}
      {groups.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            {hasFilter ? "絞り込み条件に一致する取引がありません。" : "取引がまだありません。"}
          </p>
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
                {hasFilter && <span style={{ fontSize: 12, color: "var(--text-3)" }}>{mRows.length}件</span>}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>
                        <FilterDropdown label="科目" values={cats} selected={catFilter} onChange={setCatFilter} />
                      </th>
                      <th className="col-sp-hide">
                        <FilterDropdown label="相手先ジャンル" values={genres} selected={genreFilter} onChange={setGenreFilter} />
                      </th>
                      <th>
                        <FilterDropdown label="相手先名" values={cpNames} selected={cpNameFilter} onChange={setCpNameFilter} />
                      </th>
                      <th>品名 / 名称</th>
                      <th className="col-sp-hide">
                        <FilterDropdown label="口座" values={accounts} selected={accountFilter} onChange={setAccountFilter} />
                      </th>
                      <th className="col-sp-hide">メモ</th>
                      <th style={{ textAlign: "right" }}>入金</th>
                      <th style={{ textAlign: "right" }}>出金</th>
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
                        <td style={{ color: "var(--text-2)" }}>
                          {row.item_name ?? ""}
                          {row.has_tax && <span style={{ marginLeft:4, fontSize:10, background:"var(--sapphire-light)", color:"var(--sapphire)", borderRadius:4, padding:"1px 4px", fontWeight:600, verticalAlign:"middle" }}>税</span>}
                        </td>
                        <td className="col-sp-hide">{row.accounts?.name ?? "—"}</td>
                        <td className="col-sp-hide" style={{ color: "var(--text-3)" }}>
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
                            <Link
              href={row.salary_slip_id ? `/salary/${row.salary_slip_id}/edit` : `/transactions/${row.id}/edit`}
                              className="btn btn-secondary btn-sm"
                            >訂正</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--surface-2)", fontWeight: 700 }}>
                      <td colSpan={7} style={{ textAlign: "right", color: "var(--text-2)", fontSize: 13 }}>
                        {hasFilter ? "絞込合計" : "月合計"}
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
