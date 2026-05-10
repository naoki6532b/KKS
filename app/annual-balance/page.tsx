"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/app/components/header";
import { BudgetBar } from "@/app/components/budget-bar";
import { SALARY_ITEM_MAP } from "@/lib/salary";
import { ChartZoom } from "@/app/components/chart-zoom";
import { BarChartCanvas } from "@/app/components/bar-chart-canvas";
import { BudgetBarCanvas } from "@/app/components/budget-bar-canvas";

function getCurrentYear() { return new Date().getFullYear(); }

const PIE_COLORS = ["#f87171","#fb923c","#fbbf24","#4ade80","#60a5fa","#a78bfa","#e879f9","#f472b6","#34d399","#94a3b8"];

type CpMeta    = { id: string; name: string };
type TxRow     = { tx_date: string; tx_type: "income"|"expense"; amount: number; category_id: string|null; counterparty_id: string|null; counterparty_name: string|null; has_tax?: boolean|null; tax_amount?: number|null; salary_slip_id?: string|null };
type SlipWithItems = { id: string; slip_date: string; salary_slip_items: { item_key: string; amount: number }[] };
type PieSlice  = { name: string; value: number };
type MonthBar  = { name: string; isTotal: boolean; [k: string]: number|string|boolean };

function buildCpNamePie(txRows: TxRow[]): PieSlice[] {
  const map = new Map<string, number>();
  let totalTax = 0;
  for (const tx of txRows) {
    if (tx.tx_type !== "expense" || tx.amount <= 0) continue;
    const key = tx.counterparty_name?.trim() || "未設定";
    map.set(key, (map.get(key) ?? 0) + tx.amount);
    if (tx.has_tax && tx.tax_amount && tx.tax_amount > 0) totalTax += tx.tax_amount;
  }
  if (totalTax > 0) map.set("消費税", (map.get("消費税") ?? 0) + totalTax);
  return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function buildCpGenrePie(txRows: TxRow[], cpMap: Map<string, string>): PieSlice[] {
  const map = new Map<string, number>();
  let totalTax = 0;
  for (const tx of txRows) {
    if (tx.tx_type !== "expense" || tx.amount <= 0) continue;
    const key = tx.counterparty_id ? (cpMap.get(tx.counterparty_id) ?? "未設定") : "未設定";
    map.set(key, (map.get(key) ?? 0) + tx.amount);
    if (tx.has_tax && tx.tax_amount && tx.tax_amount > 0) totalTax += tx.tax_amount;
  }
  if (totalTax > 0) map.set("税金", (map.get("税金") ?? 0) + totalTax);
  return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 45;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#f1f5f9" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={15} fontWeight={700}>
      {`${name} ${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:"1px solid #d6e2f0", borderRadius:8, padding:"8px 12px", fontSize:12, boxShadow:"0 4px 16px rgba(13,43,94,0.12)" }}>
      <div style={{ fontWeight:700, color:"#0d2b5e" }}>{payload[0].name}</div>
      <div style={{ color:"#dc2626" }}>{payload[0].value.toLocaleString()} 円</div>
    </div>
  );
}

function buildMonthlyTotalData(txRows: TxRow[]): MonthBar[] {
  const mm = new Map<string, { income: number; expense: number }>();
  for (let m = 1; m <= 12; m++) mm.set(String(m).padStart(2,"0"), { income: 0, expense: 0 });
  for (const tx of txRows) {
    const mon = tx.tx_date.slice(5, 7);
    const e = mm.get(mon); if (!e) continue;
    if (tx.tx_type === "income") e.income += tx.amount; else e.expense += tx.amount;
  }
  const result: MonthBar[] = [];
  for (let m = 1; m <= 12; m++) {
    const e = mm.get(String(m).padStart(2,"0"))!;
    result.push({ name: `${m}月`, income: e.income, expense: -e.expense, isTotal: false });
  }
  return result;
}

export default function AnnualBalancePage() {
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [year, setYear]       = useState(getCurrentYear());
  const [loading, setLoading] = useState(true);

  const [carryover, setCarryover]     = useState(0);
  const [yearIncome, setYearIncome]   = useState(0);
  const [yearExpense, setYearExpense] = useState(0);
  const [budget, setBudget]           = useState(0);
  const [totalData, setTotalData]     = useState<MonthBar[]>([]);
  const [cpNamePie, setCpNamePie]     = useState<PieSlice[]>([]);
  const [cpGenrePie, setCpGenrePie]   = useState<PieSlice[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) { router.push("/login"); router.refresh(); return; }

        const yearStart = `${year}-01-01`;
        const yearEnd   = `${year + 1}-01-01`;

        const [
          { data: prevRows },
          { data: curRows },
          { data: budgetRows },
          { data: cpRows },
          { data: userSettings },
          { data: slipsRaw },
        ] = await Promise.all([
          supabase.from("transactions").select("amount, tx_type").lt("tx_date", yearStart),
          supabase.from("transactions").select("tx_date, tx_type, amount, category_id, counterparty_id, counterparty_name, has_tax, tax_amount, salary_slip_id").gte("tx_date", yearStart).lt("tx_date", yearEnd),
          supabase.from("monthly_budgets").select("budget_amount").gte("target_month", yearStart).lt("target_month", yearEnd),
          supabase.from("counterparties").select("id, name").eq("is_active", true),
          supabase.from("user_settings").select("strict_display").eq("user_id", user.id).maybeSingle(),
          supabase.from("salary_slips").select("id, slip_date, salary_slip_items(item_key, amount)").gte("slip_date", yearStart).lt("slip_date", yearEnd),
        ]);

        if (!mounted) return;

        const strictDisplay = userSettings?.strict_display ?? false;
        const slips  = (slipsRaw ?? []) as unknown as SlipWithItems[];
        const rawCur = (curRows ?? []) as TxRow[];

        let cur: TxRow[];
        let totalDeductions = 0;

        if (strictDisplay) {
          cur = rawCur;
          for (const slip of slips) {
            for (const it of slip.salary_slip_items) {
              const def = SALARY_ITEM_MAP.get(it.item_key);
              if (def?.section === "deduction") totalDeductions += it.amount;
            }
          }
        } else {
          const nonSalary = rawCur.filter((t) => !t.salary_slip_id);
          const synth: TxRow[] = slips.map((slip) => {
            let payment = 0, deduction = 0;
            for (const it of slip.salary_slip_items) {
              const def = SALARY_ITEM_MAP.get(it.item_key);
              if (!def) continue;
              if (def.section === "deduction") deduction += it.amount;
              else payment += it.amount;
            }
            return {
              tx_date: slip.slip_date,
              tx_type: "income" as const,
              amount: payment - deduction,
              category_id: null,
              counterparty_id: null,
              counterparty_name: null,
              has_tax: false,
              tax_amount: null,
            };
          });
          cur = [...nonSalary, ...synth];
        }

        const prevBal   = (prevRows ?? []).reduce((s, t) => s + (t.tx_type === "income" ? t.amount : -t.amount), 0);
        const income    = cur.filter((t) => t.tx_type === "income").reduce((s, t) => s + t.amount, 0);
        const expense   = cur.filter((t) => t.tx_type === "expense").reduce((s, t) => s + t.amount, 0);
        const rawBudget = (budgetRows ?? []).reduce((s, b) => s + b.budget_amount, 0);
        const adjBudget = strictDisplay ? rawBudget + totalDeductions : rawBudget;
        const cpMap     = new Map<string, string>((cpRows ?? []).map((c: CpMeta) => [c.id, c.name]));

        setCarryover(prevBal);
        setYearIncome(income);
        setYearExpense(expense);
        setBudget(adjBudget);
        setTotalData(buildMonthlyTotalData(cur));
        setCpNamePie(buildCpNamePie(cur));
        setCpGenrePie(buildCpGenrePie(cur, cpMap));
      } catch (err) {
        console.error("[annual-balance] loadData error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, [year, router, supabase]);

  const nextCarryover  = carryover + yearIncome - yearExpense;
  const budgetVariance = budget - yearExpense;

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-heading">
          <h1 className="page-title">年間収支</h1>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button type="button" onClick={() => setYear((y) => y - 1)} className="btn btn-secondary" style={{ padding:"6px 12px", fontSize:16 }}>‹</button>
            <span className="field-input" style={{ display:"flex", alignItems:"center", padding:"6px 20px", fontWeight:700 }}>{year}年</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} className="btn btn-secondary" style={{ padding:"6px 12px", fontSize:16 }} disabled={year >= getCurrentYear()}>›</button>
          </div>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns:"repeat(3, 1fr)" }}>
          <div className="stat-card">
            <div className="stat-label">前年繰越</div>
            <div className="stat-value" style={{ color: carryover >= 0 ? "var(--text)" : "var(--red)" }}>
              {carryover.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">当年収入</div>
            <div className="stat-value" style={{ color:"var(--green)" }}>
              {yearIncome.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">当年支出</div>
            <div className="stat-value" style={{ color:"var(--red)" }}>
              {yearExpense.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">年間予算</div>
            <div className="stat-value" style={{ color:"var(--sapphire)" }}>
              {budget > 0 ? <>{budget.toLocaleString()}<span className="stat-value-unit">円</span></> : <span style={{ fontSize:16, color:"var(--text-3)" }}>未設定</span>}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">予算差額 <span style={{ fontSize:11, fontWeight:400, color:"var(--text-4)" }}>（予算−支出）</span></div>
            <div className="stat-value" style={{ color: budget === 0 ? "var(--text-3)" : budgetVariance >= 0 ? "var(--green)" : "var(--red)" }}>
              {budget > 0 ? <>{budgetVariance >= 0 ? "+" : ""}{budgetVariance.toLocaleString()}<span className="stat-value-unit">円</span></> : <span style={{ fontSize:16, color:"var(--text-3)" }}>—</span>}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">翌年繰越</div>
            <div className="stat-value" style={{ color: nextCarryover >= 0 ? "var(--sapphire)" : "var(--red)" }}>
              {nextCarryover.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
        </div>

        <BudgetBar expense={yearExpense} budget={budget} loading={loading} />

        {!loading && budget > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h2 className="card-title">予算消化状況（グラフ）</h2></div>
            <div className="card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
              <ChartZoom title="予算消化状況" normalHeight={160}>
                {(h, zoomed, w) => (
                  <BudgetBarCanvas
                    expense={yearExpense}
                    budget={budget}
                    label="当年支出"
                    height={h as number}
                    width={w}
                    dark={zoomed}
                  />
                )}
              </ChartZoom>
            </div>
          </div>
        )}

        {!loading && (cpNamePie.length > 0 || cpGenrePie.length > 0) && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
            <div className="card">
              <div className="card-header"><h2 className="card-title">相手先名別 支出</h2></div>
              <div className="card-body" style={{ paddingTop:8, paddingBottom:8 }}>
                {cpNamePie.length === 0 ? (
                  <p className="empty-state" style={{ fontSize:13 }}>相手先名のデータなし</p>
                ) : (
                  <ChartZoom title="相手先名別 支出" normalHeight={260}>
                    {(h, zoomed, w) => w ? (
                      <PieChart width={w} height={h as number} margin={{ top: 45, right: 70, bottom: 35, left: 70 }}>
                        <Pie data={cpNamePie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius="60%" innerRadius="30%"
                          label={renderPieLabel} labelLine={{ stroke: "#64748b" }}>
                          {cpNamePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend iconSize={12} wrapperStyle={{ fontSize: 13, color: "#cbd5e1" }} />
                      </PieChart>
                    ) : (
                      <ResponsiveContainer width="100%" height={h}>
                        <PieChart>
                          <Pie data={cpNamePie} dataKey="value" nameKey="name" cx="50%" cy="45%"
                            outerRadius={90} innerRadius={44} labelLine={false}>
                            {cpNamePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </ChartZoom>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h2 className="card-title">相手先ジャンル別 支出</h2></div>
              <div className="card-body" style={{ paddingTop:8, paddingBottom:8 }}>
                {cpGenrePie.length === 0 ? (
                  <p className="empty-state" style={{ fontSize:13 }}>相手先ジャンルのデータなし</p>
                ) : (
                  <ChartZoom title="相手先ジャンル別 支出" normalHeight={260}>
                    {(h, zoomed, w) => w ? (
                      <PieChart width={w} height={h as number} margin={{ top: 45, right: 70, bottom: 35, left: 70 }}>
                        <Pie data={cpGenrePie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius="60%" innerRadius="30%"
                          label={renderPieLabel} labelLine={{ stroke: "#64748b" }}>
                          {cpGenrePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend iconSize={12} wrapperStyle={{ fontSize: 13, color: "#cbd5e1" }} />
                      </PieChart>
                    ) : (
                      <ResponsiveContainer width="100%" height={h}>
                        <PieChart>
                          <Pie data={cpGenrePie} dataKey="value" nameKey="name" cx="50%" cy="45%"
                            outerRadius={90} innerRadius={44} labelLine={false}>
                            {cpGenrePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </ChartZoom>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">月次収支グラフ</h2>
          </div>
          <div className="card-body" style={{ paddingTop:8, paddingBottom:8 }}>
            {loading ? (
              <div className="empty-state">読込中...</div>
            ) : (
              <ChartZoom title="月次収支グラフ" normalHeight={460}>
                {(h, zoomed, w) => (
                  <BarChartCanvas
                    data={totalData.map(d => ({
                      name: d.name as string,
                      income: (d.income as number) || 0,
                      expense: (d.expense as number) || 0,
                      isTotal: d.isTotal as boolean,
                    }))}
                    height={h as number}
                    width={w}
                    dark={zoomed}
                  />
                )}
              </ChartZoom>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
