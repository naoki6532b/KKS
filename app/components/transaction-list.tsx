"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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

type SortKey = "date" | "cat" | "genre" | "cpName" | "item" | "account" | "memo";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

const collator = new Intl.Collator("ja");

function getSortValue(row: TxRow, key: SortKey): string {
  switch (key) {
    case "date":    return row.tx_date ?? "";
    case "cat":     return row.categories?.name ?? "";
    case "genre":   return row.counterparties?.name ?? "";
    case "cpName":  return row.counterparty_name ?? "";
    case "item":    return row.item_name ?? "";
    case "account": return row.accounts?.name ?? "";
    case "memo":    return row.memo ?? "";
  }
}

function sortRows(rows: TxRow[], sort: SortState): TxRow[] {
  if (!sort) return rows;
  const arr = [...rows];
  arr.sort((a, b) => {
    const cmp = collator.compare(getSortValue(a, sort.key), getSortValue(b, sort.key));
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return arr;
}

function ColumnFilter({
  label, sortKey, text, onTextChange, suggestions, sort, onToggleSort, rightAlignDropdown,
}: {
  label: string;
  sortKey?: SortKey;
  text: string;
  onTextChange: (v: string) => void;
  suggestions: string[];
  sort: SortState;
  onToggleSort: (k: SortKey) => void;
  rightAlignDropdown?: boolean;
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

  const t = text.toLowerCase();
  const filteredSugs = t ? suggestions.filter((s) => s.toLowerCase().includes(t)) : suggestions;
  const sortDir = sort && sortKey && sort.key === sortKey ? sort.dir : null;
  const hasFilter = text !== "";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {sortKey ? (
        <button
          type="button"
          onClick={() => onToggleSort(sortKey)}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontWeight: 600, fontSize: "inherit",
            color: hasFilter ? "var(--sapphire)" : "inherit",
            display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap",
          }}
          title={`${label}で並び替え（昇順 → 降順 → 解除）`}
        >
          {label}
          <span style={{ fontSize: 9, opacity: sortDir ? 1 : 0.4 }}>
            {sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "↕"}
          </span>
        </button>
      ) : (
        <span style={{ fontWeight: 600, color: hasFilter ? "var(--sapphire)" : "inherit", whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: "0 2px",
          color: hasFilter ? "var(--sapphire)" : "var(--text-3)", fontSize: 10,
        }}
        title={`${label}で絞り込む`}
      >
        {hasFilter ? "▼" : "▽"}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)",
          left: rightAlignDropdown ? "auto" : 0,
          right: rightAlignDropdown ? 0 : "auto",
          zIndex: 200, backgroundColor: "var(--surface-1)",
          border: "1px solid var(--border)", borderRadius: 8,
          boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
          minWidth: 220, maxWidth: 320,
        }}>
          <div style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
            <input
              type="text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder={`${label}で絞り込み`}
              autoFocus
              className="field-input"
              style={{ width: "100%", fontSize: 13, padding: "6px 8px" }}
            />
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={() => onTextChange("")}
              style={{
                display: "block", width: "100%", padding: "7px 14px", textAlign: "left",
                background: "none", border: "none",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer", fontSize: 12, color: "var(--text-3)",
              }}
            >
              絞り込み解除
            </button>
          )}
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filteredSugs.length === 0 ? (
              <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-3)" }}>候補なし</div>
            ) : filteredSugs.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { onTextChange(v); setOpen(false); }}
                style={{
                  display: "block", width: "100%", padding: "7px 14px", textAlign: "left",
                  background: text === v ? "var(--sapphire-light)" : "none",
                  border: "none", cursor: "pointer", fontSize: 13,
                  color: text === v ? "var(--sapphire)" : "var(--text-1)",
                  fontWeight: text === v ? 700 : 400,
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TransactionList({ rows }: { rows: TxRow[] }) {
  const [query, setQuery]           = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [filters, setFilters] = useState<Record<string, string>>({
    date: "", cat: "", genre: "", cpName: "", item: "", account: "", memo: "",
  });
  const setFilter = (key: string, v: string) => setFilters((f) => ({ ...f, [key]: v }));

  const [sort, setSort] = useState<SortState>(null);
  const toggleSort = (key: SortKey) => {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const dates    = useMemo(() => uniq(rows.map((r) => r.tx_date)),               [rows]);
  const cats     = useMemo(() => uniq(rows.map((r) => r.categories?.name)),      [rows]);
  const genres   = useMemo(() => uniq(rows.map((r) => r.counterparties?.name)),  [rows]);
  const cpNames  = useMemo(() => uniq(rows.map((r) => r.counterparty_name)),     [rows]);
  const items    = useMemo(() => uniq(rows.map((r) => r.item_name)),             [rows]);
  const accounts = useMemo(() => uniq(rows.map((r) => r.accounts?.name)),        [rows]);
  const memos    = useMemo(() => uniq(rows.map((r) => r.memo)),                  [rows]);

  const q = query.trim().toLowerCase();

  const containsCi = (val: string | null | undefined, needle: string) =>
    !needle || (val ?? "").toLowerCase().includes(needle.toLowerCase());

  const filtered = rows.filter((row) => {
    if (typeFilter === "income"  && row.tx_type !== "income")  return false;
    if (typeFilter === "expense" && row.tx_type !== "expense") return false;
    if (!containsCi(row.tx_date,             filters.date))    return false;
    if (!containsCi(row.categories?.name,    filters.cat))     return false;
    if (!containsCi(row.counterparties?.name, filters.genre))  return false;
    if (!containsCi(row.counterparty_name,   filters.cpName))  return false;
    if (!containsCi(row.item_name,           filters.item))    return false;
    if (!containsCi(row.accounts?.name,      filters.account)) return false;
    if (!containsCi(row.memo,                filters.memo))    return false;
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

  const anyColFilter = Object.values(filters).some((v) => v !== "");
  const hasFilter = typeFilter !== "all" || anyColFilter || q !== "" || sort !== null;

  const clearAll = () => {
    setQuery("");
    setTypeFilter("all");
    setFilters({ date: "", cat: "", genre: "", cpName: "", item: "", account: "", memo: "" });
    setSort(null);
  };

  const groups = groupByMonth(filtered).map((g) => ({ ...g, rows: sortRows(g.rows, sort) }));

  return (
    <>
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
            絞込・並び解除
          </button>
        )}
      </div>

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
            placeholder="全項目から検索..."
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
                      <th>
                        <ColumnFilter label="日付" sortKey="date" text={filters.date} onTextChange={(v) => setFilter("date", v)} suggestions={dates} sort={sort} onToggleSort={toggleSort} />
                      </th>
                      <th>
                        <ColumnFilter label="科目" sortKey="cat" text={filters.cat} onTextChange={(v) => setFilter("cat", v)} suggestions={cats} sort={sort} onToggleSort={toggleSort} />
                      </th>
                      <th className="col-sp-hide">
                        <ColumnFilter label="相手先ジャンル" sortKey="genre" text={filters.genre} onTextChange={(v) => setFilter("genre", v)} suggestions={genres} sort={sort} onToggleSort={toggleSort} />
                      </th>
                      <th>
                        <ColumnFilter label="相手先名" sortKey="cpName" text={filters.cpName} onTextChange={(v) => setFilter("cpName", v)} suggestions={cpNames} sort={sort} onToggleSort={toggleSort} />
                      </th>
                      <th>
                        <ColumnFilter label="品名 / 名称" sortKey="item" text={filters.item} onTextChange={(v) => setFilter("item", v)} suggestions={items} sort={sort} onToggleSort={toggleSort} />
                      </th>
                      <th className="col-sp-hide">
                        <ColumnFilter label="口座" sortKey="account" text={filters.account} onTextChange={(v) => setFilter("account", v)} suggestions={accounts} sort={sort} onToggleSort={toggleSort} />
                      </th>
                      <th className="col-sp-hide">
                        <ColumnFilter label="メモ" sortKey="memo" text={filters.memo} onTextChange={(v) => setFilter("memo", v)} suggestions={memos} sort={sort} onToggleSort={toggleSort} rightAlignDropdown />
                      </th>
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
