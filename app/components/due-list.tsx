"use client";

import { useState } from "react";

export type DueRow = {
  id: string;
  tx_date: string;
  amount: number;
  card_due_date: string;
  account_id: string;
  counterparties: { name?: string } | null;
  accounts: { name?: string } | null;
};

type Group = {
  key: string;
  card_due_date: string;
  account_name: string;
  total: number;
  rows: DueRow[];
};

function groupDueRows(rows: DueRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const row of rows) {
    const key = `${row.card_due_date}__${row.account_id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        card_due_date: row.card_due_date,
        account_name: (row.accounts as { name?: string } | null)?.name ?? "—",
        total: 0,
        rows: [],
      });
    }
    const g = map.get(key)!;
    g.total += row.amount;
    g.rows.push(row);
  }
  return Array.from(map.values());
}

export function DueList({ rows }: { rows: DueRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (rows.length === 0) {
    return <p className="empty-state">引落予定はありません</p>;
  }

  const groups = groupDueRows(rows);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {groups.map((g) => {
        const isOpen = expanded.has(g.key);
        const hasMultiple = g.rows.length > 1;

        return (
          <div key={g.key} style={{ border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
            {/* Group header row */}
            <div
              onClick={() => hasMultiple && toggle(g.key)}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "11px 14px",
                background: isOpen ? "var(--sapphire-light)" : "var(--surface)",
                cursor: hasMultiple ? "pointer" : "default",
                transition: "background 0.15s",
                userSelect: "none",
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--sapphire)", whiteSpace: "nowrap", fontSize: 13 }}>
                {g.card_due_date}
              </span>
              <span style={{ color: "var(--text-2)", fontSize: 13, fontWeight: hasMultiple ? 600 : 400 }}>
                {g.account_name}
                {hasMultiple && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>
                    （{g.rows.length}件）
                  </span>
                )}
              </span>
              <span style={{ fontWeight: 700, color: "var(--red)", whiteSpace: "nowrap", fontSize: 13 }}>
                {g.total.toLocaleString()} 円
              </span>
              {hasMultiple && (
                <span style={{ color: "var(--text-3)", fontSize: 11, transition: "transform 0.2s", display: "inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                  ▼
                </span>
              )}
            </div>

            {/* Detail rows */}
            {isOpen && (
              <div style={{ borderTop: "1px solid var(--border)" }}>
                {g.rows.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "8px 14px 8px 28px",
                      borderBottom: "1px solid #f0f4f9",
                      fontSize: 12,
                      color: "var(--text-3)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <span style={{ whiteSpace: "nowrap" }}>{row.tx_date}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(row.counterparties as { name?: string } | null)?.name ?? "—"}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--red)", whiteSpace: "nowrap" }}>
                      {row.amount.toLocaleString()} 円
                    </span>
                  </div>
                ))}
                {/* Subtotal row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    padding: "8px 14px",
                    background: "#fef2f2",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--red)",
                  }}
                >
                  <span>合計</span>
                  <span>{g.total.toLocaleString()} 円</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
