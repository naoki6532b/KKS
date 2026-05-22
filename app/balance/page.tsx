"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { nextMonthStart } from "@/lib/money";
import { Header } from "@/app/components/header";
import { SALARY_ITEM_MAP } from "@/lib/salary";
import { ChartZoom } from "@/app/components/chart-zoom";
import { BarChartCanvas } from "@/app/components/bar-chart-canvas";
import { BudgetBarCanvas } from "@/app/components/budget-bar-canvas";

function getCurrentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"00")}`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2,"0")}`;
}

const PIE_COLORS = ["#f87171","#fb923c","#fbbf24","#4ade80","#60a5fa","#a78bfa","#e879f9","#f472b6","#34d399","#94a3b8"];

type CpMeta = { id: string; name: string };
type TxRow = { tx_date: string; tx_type: "income"|"expense"; amount: number; category_id: string|null; counterparty_id: string|null; counterparty_name: string|null; has_tax?: boolean|null; tax_amount?: number|null; salary_slip_id?: string|null };
type SlipWithItems = { id: string; slip_date: string; salary_slip_items: { item_key: string; amount: number }[] };

type PieSlice = { name: string; value: number };

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

function buildCategoryPie(txRows: TxRow[], catMap: Map<string, string>): PieSlice[] {
  const map = new Map<string, number>();
  for (const tx of txRows) {
    if (tx.tx_type !== "expense" || tx.amount <= 0) continue;
    const key = tx.category_id ? (catMap.get(tx.category_id) ?? "未設定") : "未設定";
    map.set(key, (map.get(key) ?? 0) + tx.amount);
  }
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

type DayBase = { name: string; isTotal: boolean; [k: string]: number|string|boolean };

function initDays(monthStart: string): Map<string, { income: number; expense: number }> {
  const [year, month] = monthStart.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  const map = new Map<string, { income: number; expense: number }>();
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    map.set(key, { income: 0, expense: 0 });
  }
  return map;
}

function buildTotalData(txRows: TxRow[], monthStart: string): DayBase[] {
  const map = initDays(monthStart);
  for (const tx of txRows) {
    const e = map.get(tx.tx_date); if (!e) continue;
    if (tx.tx_type === "income") e.income += tx.amount; else e.expense += tx.amount;
  }
  let ti = 0, te = 0;
  const result: DayBase[] = [];
  for (const [date, e] of map) {
    result.push({ name: String(Number(date.split("-")[2])), income: e.income, expense: -e.expense, isTotal: false });
    ti += e.income; te += e.expense;
  }
  result.push({ name: "月計", income: ti, expense: -te, isTotal: true });
  return result;
}

export default function BalancePage() {
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [month, setMonth]     = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);

  const [carryover, setCarryover]       = useState(0);
  const [monthIncome, setMonthIncome]   = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  const [budget, setBudget]             = useState(0);

  const [totalData, setTotalData]   = useState<DayBase[]>([]);
  const [cpNamePie, setCpNamePie]   = useState<PieSlice[]>([]);
  const [cpGenrePie, setCpGenrePie] = useState<PieSlice[]>([]);
  const [catPie, setCatPie]         = useState<PieSlice[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) { router.push("/login"); router.refresh(); return; }

        const monthStart = `${month}-01`;
        const monthEnd   = nextMonthStart(monthStart);

        const [
          { data: prevRows },
          { data: curRows },
          { data: budgetRow, error: budgetError },
          { data: cpRows },
          { data: catRows },
          { data: userSettings },
          { data: slipsRaw },
        ] = await Promise.all([
          supabase.from("transactions").select("amount, tx_type").lt("tx_date", monthStart),
          supabase.from("transactions").select("tx_date, tx_type, amount, category_id, counterparty_id, counterparty_name, has_tax, tax_amount, salary_slip_id").gte("tx_date", monthStart).lt("tx_date", monthEnd),
          supabase.from("monthly_budgets").select("budget_amount").eq("target_month", monthStart).maybeSingle(),
          supabase.from("counterparties").select("id, name").eq("is_active", true),
          supabase.from("categories").select("id, name").eq("is_active", true),
          supabase.from("user_settings").select("strict_display").eq("user_id", user.id).maybeSingle(),
          supabase.from("salary_slips").select("id, slip_date, salary_slip_items(item_key, amount)").gte("slip_date", monthStart).lt("slip_date", monthEnd),
        ]);

        if (budgetError) console.error("[balance] budget query error:", budgetError);
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

        const prev    = prevRows ?? [];
        const prevBal = prev.reduce((s, t) => s + (t.tx_type === "income" ? t.amount : -t.amount), 0);
        const income  = cur.filter(t => t.tx_type === "income").reduce((s, t) => s + t.amount, 0);
        const expense = cur.filter(t => t.tx_type === "expense").reduce((s, t) => s + t.amount, 0);
        const cpMap   = new Map<string, string>((cpRows ?? []).map((c: CpMeta) => [c.id, c.name]));
        const catMap  = new Map<string, string>((catRows ?? []).map((c: CpMeta) => [c.id, c.name]));

        const rawBudget      = budgetRow?.budget_amount ?? 0;
        const adjustedBudget = strictDisplay ? rawBudget + totalDeductions : rawBudget;

        setCarryover(prevBal);
        setMonthIncome(income);
        setMonthExpense(expense);
        setBudget(adjustedBudget);
        setTotalData(buildTotalData(cur, monthStart));
        // 円グラフは実トランザクション(rawCur)で集計する。非表示モードでも給与控除を支出として反映するため。
        setCpNamePie(buildCpNamePie(rawCur));
        setCpGenrePie(buildCpGenrePie(rawCur, cpMap));
        setCatPie(buildCategoryPie(rawCur, catMap));
      } catch (err) {
        console.error("[balance] loadData error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, [month, router, supabase]);

  const nextCarryover  = carryover + monthIncome - monthExpense;
  const budgetVariance = budget - monthExpense;

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-heading">
          <h1 className="page-title">収支バランス</h1>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="btn btn-secondary" style={{ padding:"6px 12px", fontSize:16 }}>‹</button>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="field-input" style={{ width:"auto" }} />
            <button type="button" onClick={() => setMonth((m) => shiftMonth(m, +1))} className="btn btn-secondary" style={{ padding:"6px 12px", fontSize:16 }} disabled={month >= getCurrentMonth()}>›</button>
          </div>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns:"repeat(3, 1fr)" }}>
          <div className="stat-card">
            <div className="stat-label">前月繰越</div>
            <div className="stat-value" style={{ color: carryover >= 0 ? "var(--text)" : "var(--red)" }}>
              {carryover.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">当月収入</div>
            <div className="stat-value" style={{ color:"var(--green)" }}>
              {monthIncome.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">当月支出</div>
            <div className="stat-value" style={{ color:"var(--red)" }}>
              {monthExpense.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">予算</div>
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
            <div className="stat-label">翌月繰越</div>
            <div className="stat-value" style={{ color: nextCarryover >= 0 ? "var(--sapphire)" : "var(--red)" }}>
              {nextCarryover.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
        </div>

        {!loading && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h2 className="card-title">予算消化状況</h2></div>
            <div className="card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
              <ChartZoom title="予算消化状況" normalHeight={160}>
                {(h, zoomed, w) => (
                  <BudgetBarCanvas
                    expense={monthExpense}
                    budget={budget}
                    label="当月支出"
                    height={h as number}
                    width={w}
                    dark={zoomed}
                  />
                )}
              </ChartZoom>
            </div>
          </div>
        )}

        {!loading && (cpNamePie.length > 0 || cpGenrePie.length > 0 || catPie.length > 0) && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16, marginBottom:20 }}>
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

            <div className="card">
              <div className="card-header"><h2 className="card-title">科目別 支出</h2></div>
              <div className="card-body" style={{ paddingTop:8, paddingBottom:8 }}>
                {catPie.length === 0 ? (
                  <p className="empty-state" style={{ fontSize:13 }}>科目のデータなし</p>
                ) : (
                  <ChartZoom title="科目別 支出" normalHeight={260}>
                    {(h, zoomed, w) => w ? (
                      <PieChart width={w} height={h as number} margin={{ top: 45, right: 70, bottom: 35, left: 70 }}>
                        <Pie data={catPie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          outerRadius="60%" innerRadius="30%"
                          label={renderPieLabel} labelLine={{ stroke: "#64748b" }}>
                          {catPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend iconSize={12} wrapperStyle={{ fontSize: 13, color: "#cbd5e1" }} />
                      </PieChart>
                    ) : (
                      <ResponsiveContainer width="100%" height={h}>
                        <PieChart>
                          <Pie data={catPie} dataKey="value" nameKey="name" cx="50%" cy="45%"
                            outerRadius={90} innerRadius={44} labelLine={false}>
                            {catPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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
            <h2 className="card-title">日次収支グラフ</h2>
          </div>
          <div className="card-body" style={{ paddingTop:8, paddingBottom:8 }}>
            {loading ? (
              <div className="empty-state">読込中...</div>
            ) : (
              <ChartZoom title="日次収支グラフ" normalHeight={460}>
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
