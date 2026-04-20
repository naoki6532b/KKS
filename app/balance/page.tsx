"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { nextMonthStart } from "@/lib/money";
import { Header } from "@/app/components/header";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type TxRow = { tx_date: string; tx_type: "income" | "expense"; amount: number };

type DayData = {
  name: string;
  income: number;
  expense: number;
  isTotal: boolean;
};

function buildChartData(txRows: TxRow[], monthStart: string): DayData[] {
  const [year, month] = monthStart.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const dayMap = new Map<string, { income: number; expense: number }>();
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dayMap.set(key, { income: 0, expense: 0 });
  }

  for (const tx of txRows) {
    const entry = dayMap.get(tx.tx_date);
    if (!entry) continue;
    if (tx.tx_type === "income") entry.income += tx.amount;
    else entry.expense += tx.amount;
  }

  let totalIncome = 0;
  let totalExpense = 0;
  const result: DayData[] = [];

  for (const [date, data] of dayMap) {
    const dayNum = Number(date.split("-")[2]);
    result.push({
      name: String(dayNum),
      income: data.income,
      expense: -data.expense,
      isTotal: false,
    });
    totalIncome  += data.income;
    totalExpense += data.expense;
  }

  result.push({
    name: "月計",
    income: totalIncome,
    expense: -totalExpense,
    isTotal: true,
  });

  return result;
}

function fmtY(value: number) {
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 100000) return `${(abs / 10000).toFixed(0)}万`;
  if (abs >= 10000)  return `${(abs / 10000).toFixed(1)}万`;
  return `${abs.toLocaleString()}`;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const isTotal = label === "月計";
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #d6e2f0",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 13,
      boxShadow: "0 4px 16px rgba(13,43,94,0.12)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#0d2b5e" }}>
        {isTotal ? "月間合計" : `${label}日`}
      </div>
      {payload.map((p) => {
        if (p.value === 0) return null;
        const isIncome = p.dataKey === "income";
        return (
          <div key={p.dataKey} style={{ color: isIncome ? "#16a34a" : "#dc2626", lineHeight: 1.8 }}>
            {isIncome ? "収入" : "支出"}: {Math.abs(p.value).toLocaleString()} 円
          </div>
        );
      })}
    </div>
  );
}

export default function BalancePage() {
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [month, setMonth]           = useState(getCurrentMonth());
  const [loading, setLoading]       = useState(true);
  const [carryover, setCarryover]   = useState(0);
  const [monthIncome, setMonthIncome]   = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  const [budget, setBudget]         = useState(0);
  const [chartData, setChartData]   = useState<DayData[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/login"); router.refresh(); return; }

      const monthStart = `${month}-01`;
      const monthEnd   = nextMonthStart(monthStart);

      const [
        { data: prevRows },
        { data: curRows },
        { data: budgetRow },
      ] = await Promise.all([
        supabase.from("transactions").select("amount, tx_type").lt("tx_date", monthStart),
        supabase.from("transactions").select("tx_date, tx_type, amount").gte("tx_date", monthStart).lt("tx_date", monthEnd),
        supabase.from("monthly_budgets").select("budget_amount").eq("target_month", monthStart).maybeSingle(),
      ]);

      if (!mounted) return;

      const prev = prevRows ?? [];
      const prevBalance = prev.reduce((s, tx) => s + (tx.tx_type === "income" ? tx.amount : -tx.amount), 0);

      const cur     = (curRows ?? []) as TxRow[];
      const income  = cur.filter((t) => t.tx_type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = cur.filter((t) => t.tx_type === "expense").reduce((s, t) => s + t.amount, 0);

      setCarryover(prevBalance);
      setMonthIncome(income);
      setMonthExpense(expense);
      setBudget(budgetRow?.budget_amount ?? 0);
      setChartData(buildChartData(cur, monthStart));
      setLoading(false);
    }
    loadData();
    return () => { mounted = false; };
  }, [month, router, supabase]);

  const currentCarryover = carryover + monthIncome - monthExpense;

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-heading">
          <div>
            <h1 className="page-title">収支バランス</h1>
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="field-input"
            style={{ width: "auto" }}
          />
        </div>

        {/* Summary */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">前月繰越</div>
            <div className="stat-value" style={{ color: carryover >= 0 ? "var(--text)" : "var(--red)" }}>
              {carryover.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">当月収入</div>
            <div className="stat-value" style={{ color: "var(--green)" }}>
              {monthIncome.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">当月支出</div>
            <div className="stat-value" style={{ color: "var(--red)" }}>
              {monthExpense.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">当月繰越</div>
            <div
              className="stat-value"
              style={{ color: currentCarryover >= 0 ? "var(--sapphire)" : "var(--red)" }}
            >
              {currentCarryover.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">日次収支グラフ</h2>
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-3)", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 12, height: 12, background: "#86efac", borderRadius: 2, display: "inline-block" }} />
                収入
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 12, height: 12, background: "#f87171", borderRadius: 2, display: "inline-block" }} />
                支出
              </span>
              {budget > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 18, height: 2, background: "#9ca3af", display: "inline-block", borderTop: "2px dashed #9ca3af" }} />
                  予算
                </span>
              )}
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {loading ? (
              <div className="empty-state">読込中...</div>
            ) : (
              <ResponsiveContainer width="100%" height={420}>
                <BarChart
                  data={chartData}
                  margin={{ top: 16, right: 48, bottom: 0, left: 8 }}
                  barCategoryGap="22%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#94afc8" }}
                    axisLine={{ stroke: "#d6e2f0" }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={fmtY}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(26,74,143,0.05)" }} />

                  {/* Center line */}
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />

                  {/* Budget line on expense side */}
                  {budget > 0 && (
                    <ReferenceLine
                      y={-budget}
                      stroke="#9ca3af"
                      strokeDasharray="6 3"
                      strokeWidth={1.5}
                      label={{
                        value: `予算 ${budget >= 10000 ? `${(budget / 10000).toFixed(0)}万` : budget.toLocaleString()}円`,
                        position: "insideRight",
                        fontSize: 11,
                        fill: "#9ca3af",
                        offset: 4,
                      }}
                    />
                  )}

                  {/* Income bars — upward, yellow-green; monthly total is darker */}
                  <Bar dataKey="income" name="収入" radius={[3, 3, 0, 0]} maxBarSize={20}>
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.isTotal ? "#22c55e" : "#86efac"}
                      />
                    ))}
                  </Bar>

                  {/* Expense bars — downward, red; monthly total is darker */}
                  <Bar dataKey="expense" name="支出" radius={[0, 0, 3, 3]} maxBarSize={20}>
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.isTotal ? "#ef4444" : "#f87171"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
