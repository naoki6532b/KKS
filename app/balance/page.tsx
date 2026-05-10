"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { nextMonthStart } from "@/lib/money";
import { Header } from "@/app/components/header";
import { BudgetBar } from "@/app/components/budget-bar";
import { SALARY_ITEM_MAP } from "@/lib/salary";
import { ChartZoom } from "@/app/components/chart-zoom";

type ViewMode = "total" | "category";

const INCOME_COLORS  = ["#4ade80","#22d3ee","#60a5fa","#818cf8","#a78bfa","#34d399","#86efac","#67e8f9"];
const EXPENSE_COLORS = ["#f87171","#fb923c","#fbbf24","#e879f9","#f472b6","#c084fc","#fd8a6a","#fca5a5"];

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

type CategoryMeta = { id: string; name: string; kind: "income"|"expense" };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 30;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#e2e8f0" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12} fontWeight={600}>
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

function initDays(monthStart: string): Map<string, { income: number; expense: number; byCat: Map<string,number> }> {
  const [year, month] = monthStart.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  const map = new Map<string, { income: number; expense: number; byCat: Map<string,number> }>();
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    map.set(key, { income: 0, expense: 0, byCat: new Map() });
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

function buildCategoryData(txRows: TxRow[], cats: CategoryMeta[], monthStart: string): DayBase[] {
  const map = initDays(monthStart);
  for (const tx of txRows) {
    const e = map.get(tx.tx_date); if (!e) continue;
    const cid = tx.category_id ?? (tx.tx_type === "income" ? "_inc_other" : "_exp_other");
    const prev = e.byCat.get(cid) ?? 0;
    e.byCat.set(cid, prev + (tx.tx_type === "income" ? tx.amount : -tx.amount));
  }
  const allKeys = cats.map((c) => c.id);
  allKeys.push("_inc_other", "_exp_other");

  const totals: DayBase = { name: "月計", isTotal: true };
  allKeys.forEach((k) => { totals[k] = 0; });

  const result: DayBase[] = [];
  for (const [date, e] of map) {
    const row: DayBase = { name: String(Number(date.split("-")[2])), isTotal: false };
    allKeys.forEach((k) => { row[k] = 0; });
    for (const [cid, val] of e.byCat) {
      row[cid] = val;
      totals[cid] = ((totals[cid] as number) ?? 0) + val;
    }
    result.push(row);
  }
  result.push(totals);
  return result;
}

function fmtLabel(v: number): string {
  const a = Math.abs(v);
  if (a < 1000) return "";
  if (a >= 10000) return `${Math.round(a/10000)}万`;
  return `${Math.round(a/1000)}k`;
}

function IncomeLabel(props: { x?: number; y?: number; width?: number; value?: number }) {
  const { x=0, y=0, width=0, value=0 } = props;
  const txt = fmtLabel(value);
  if (!txt) return null;
  return <text x={x+width/2} y={y-4} textAnchor="middle" fontSize={9} fill="#16a34a" fontWeight={600}>{txt}</text>;
}

function ExpenseLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x=0, y=0, width=0, height=0, value=0 } = props;
  const txt = fmtLabel(value);
  if (!txt) return null;
  return <text x={x+width/2} y={y+Math.abs(height)+11} textAnchor="middle" fontSize={9} fill="#dc2626" fontWeight={600}>{txt}</text>;
}

function CustomTooltip({ active, payload, label, cats }: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color?: string }[];
  label?: string;
  cats: CategoryMeta[];
}) {
  if (!active || !payload?.length) return null;
  const isTotal = label === "月計";
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  catMap.set("_inc_other", "未分類");
  catMap.set("_exp_other", "未分類");

  const incEntries = payload.filter((p) => (p.value ?? 0) > 0);
  const expEntries = payload.filter((p) => (p.value ?? 0) < 0);

  return (
    <div style={{ background:"#fff", border:"1px solid #d6e2f0", borderRadius:10, padding:"10px 14px", fontSize:12, boxShadow:"0 4px 16px rgba(13,43,94,0.12)", maxWidth:200 }}>
      <div style={{ fontWeight:700, marginBottom:6, color:"#0d2b5e" }}>{isTotal ? "月間合計" : `${label}日`}</div>
      {incEntries.length > 0 && (
        <div style={{ marginBottom:4 }}>
          <div style={{ fontSize:10, color:"#6b7280", marginBottom:2 }}>収入</div>
          {incEntries.map((p) => (
            <div key={p.dataKey} style={{ color:"#16a34a", display:"flex", justifyContent:"space-between", gap:8 }}>
              <span>{catMap.get(p.dataKey.replace("","")) ?? "収入"}</span>
              <span>{p.value.toLocaleString()}円</span>
            </div>
          ))}
        </div>
      )}
      {expEntries.length > 0 && (
        <div>
          <div style={{ fontSize:10, color:"#6b7280", marginBottom:2 }}>支出</div>
          {expEntries.map((p) => (
            <div key={p.dataKey} style={{ color:"#dc2626", display:"flex", justifyContent:"space-between", gap:8 }}>
              <span>{catMap.get(p.dataKey.replace("","")) ?? "支出"}</span>
              <span>{Math.abs(p.value).toLocaleString()}円</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BalancePage() {
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [month, setMonth]       = useState(getCurrentMonth());
  const [mode, setMode]         = useState<ViewMode>("total");
  const [loading, setLoading]   = useState(true);

  const [carryover, setCarryover]       = useState(0);
  const [monthIncome, setMonthIncome]   = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  const [budget, setBudget]             = useState(0);

  const [totalData, setTotalData]       = useState<DayBase[]>([]);
  const [catData, setCatData]           = useState<DayBase[]>([]);
  const [cats, setCats]                 = useState<CategoryMeta[]>([]);
  const [cpNamePie, setCpNamePie]       = useState<PieSlice[]>([]);
  const [cpGenrePie, setCpGenrePie]     = useState<PieSlice[]>([]);

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
        { data: catRows },
        { data: cpRows },
        { data: userSettings },
        { data: slipsRaw },
      ] = await Promise.all([
        supabase.from("transactions").select("amount, tx_type").lt("tx_date", monthStart),
        supabase.from("transactions").select("tx_date, tx_type, amount, category_id, counterparty_id, counterparty_name, has_tax, tax_amount, salary_slip_id").gte("tx_date", monthStart).lt("tx_date", monthEnd),
        supabase.from("monthly_budgets").select("budget_amount").eq("target_month", monthStart).maybeSingle(),
        supabase.from("categories").select("id, name, kind").eq("is_active", true),
        supabase.from("counterparties").select("id, name").eq("is_active", true),
        supabase.from("user_settings").select("strict_display").eq("user_id", user.id).maybeSingle(),
        supabase.from("salary_slips").select("id, slip_date, salary_slip_items(item_key, amount)").gte("slip_date", monthStart).lt("slip_date", monthEnd),
      ]);

      if (budgetError) console.error("[balance] budget query error:", budgetError);

      if (!mounted) return;

      const strictDisplay = userSettings?.strict_display ?? false;
      const slips = (slipsRaw ?? []) as unknown as SlipWithItems[];
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

      const prev     = prevRows ?? [];
      const prevBal  = prev.reduce((s,t) => s + (t.tx_type==="income" ? t.amount : -t.amount), 0);
      const income   = cur.filter(t=>t.tx_type==="income").reduce((s,t)=>s+t.amount, 0);
      const expense  = cur.filter(t=>t.tx_type==="expense").reduce((s,t)=>s+t.amount, 0);
      const allCats  = (catRows ?? []) as CategoryMeta[];
      const cpMap    = new Map<string, string>((cpRows ?? []).map((c: CpMeta) => [c.id, c.name]));

      const rawBudget = budgetRow?.budget_amount ?? 0;
      const adjustedBudget = strictDisplay ? rawBudget + totalDeductions : rawBudget;

      setCarryover(prevBal);
      setMonthIncome(income);
      setMonthExpense(expense);
      setBudget(adjustedBudget);
      setCats(allCats);
      setTotalData(buildTotalData(cur, monthStart));
      setCatData(buildCategoryData(cur, allCats, monthStart));
      setCpNamePie(buildCpNamePie(cur));
      setCpGenrePie(buildCpGenrePie(cur, cpMap));
      } catch (err) {
        console.error("[balance] loadData error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, [month, router, supabase]);

  const nextCarryover   = carryover + monthIncome - monthExpense;
  const budgetVariance  = budget - monthExpense;
  const chartData = mode === "total" ? totalData : catData;

  const incCats = cats.filter(c=>c.kind==="income");
  const expCats = cats.filter(c=>c.kind==="expense");

  const fmtY = (v: number) => {
    const a = Math.abs(v);
    if (a === 0) return "0";
    if (a >= 100000) return `${a/10000}万`;
    return `${(a/10000).toFixed(1)}万`;
  };

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
            <div className="stat-value" style={{ color: carryover>=0 ? "var(--text)" : "var(--red)" }}>
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
            <div className="stat-value" style={{ color: budget===0 ? "var(--text-3)" : budgetVariance>=0 ? "var(--green)" : "var(--red)" }}>
              {budget > 0 ? <>{budgetVariance >= 0 ? "+" : ""}{budgetVariance.toLocaleString()}<span className="stat-value-unit">円</span></> : <span style={{ fontSize:16, color:"var(--text-3)" }}>—</span>}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">翼月繰越</div>
            <div className="stat-value" style={{ color: nextCarryover>=0 ? "var(--sapphire)" : "var(--red)" }}>
              {nextCarryover.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
        </div>

        <BudgetBar expense={monthExpense} budget={budget} loading={loading} />

        {!loading && (cpNamePie.length > 0 || cpGenrePie.length > 0) && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
            <div className="card">
              <div className="card-header"><h2 className="card-title">相手先名別 支出</h2></div>
              <div className="card-body" style={{ paddingTop:8, paddingBottom:8 }}>
                {cpNamePie.length === 0 ? (
                  <p className="empty-state" style={{ fontSize:13 }}>相手先名のデータなし</p>
                ) : (
                  <ChartZoom title="相手先名別 支出" normalHeight={260}>
                    {(h, zoomed) => (
                      <ResponsiveContainer width="100%" height={h}>
                        <PieChart margin={zoomed ? { top: 40, right: 80, bottom: 30, left: 80 } : undefined}>
                          <Pie data={cpNamePie} dataKey="value" nameKey="name" cx="50%"
                            cy={zoomed ? "50%" : "45%"}
                            outerRadius={zoomed ? "36%" : 90}
                            innerRadius={zoomed ? "18%" : 44}
                            label={zoomed ? renderPieLabel : undefined}
                            labelLine={zoomed ? { stroke: "#64748b" } : false}>
                            {cpNamePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                          <Legend iconSize={zoomed ? 12 : 10} wrapperStyle={{ fontSize: zoomed ? 13 : 11, color: zoomed ? "#cbd5e1" : undefined }} />
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
                    {(h, zoomed) => (
                      <ResponsiveContainer width="100%" height={h}>
                        <PieChart margin={zoomed ? { top: 40, right: 80, bottom: 30, left: 80 } : undefined}>
                          <Pie data={cpGenrePie} dataKey="value" nameKey="name" cx="50%"
                            cy={zoomed ? "50%" : "45%"}
                            outerRadius={zoomed ? "36%" : 90}
                            innerRadius={zoomed ? "18%" : 44}
                            label={zoomed ? renderPieLabel : undefined}
                            labelLine={zoomed ? { stroke: "#64748b" } : false}>
                            {cpGenrePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                          <Legend iconSize={zoomed ? 12 : 10} wrapperStyle={{ fontSize: zoomed ? 13 : 11, color: zoomed ? "#cbd5e1" : undefined }} />
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
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <div style={{ display:"flex", border:"1px solid var(--border-strong)", borderRadius:8, overflow:"hidden" }}>
                {(["total","category"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={()=>setMode(m)}
                    style={{
                      padding:"5px 12px", fontSize:12, fontWeight:600, border:"none", cursor:"pointer",
                      background: mode===m ? "var(--sapphire-mid)" : "var(--surface)",
                      color: mode===m ? "#fff" : "var(--text-3)",
                      transition:"background 0.15s, color 0.15s",
                    }}
                  >
                    {m==="total" ? "総数" : "科目別"}
                  </button>
                ))}
              </div>

              {mode === "total" ? (
                <div style={{ display:"flex", gap:10, fontSize:11, color:"var(--text-3)", alignItems:"center" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:10,height:10,background:"#86efac",borderRadius:2,display:"inline-block" }} />収入
                  </span>
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:10,height:10,background:"#f87171",borderRadius:2,display:"inline-block" }} />支出
                  </span>
                  {budget>0 && (
                    <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ width:14,height:0,borderTop:"2px dashed #9ca3af",display:"inline-block" }} />予算
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ display:"flex", gap:6, fontSize:11, flexWrap:"wrap", maxWidth:400 }}>
                  {incCats.map((c,i) => (
                    <span key={c.id} style={{ display:"flex", alignItems:"center", gap:3, color:"var(--text-3)" }}>
                      <span style={{ width:8,height:8,borderRadius:2,background:INCOME_COLORS[i%INCOME_COLORS.length],display:"inline-block" }} />{c.name}
                    </span>
                  ))}
                  {expCats.map((c,i) => (
                    <span key={c.id} style={{ display:"flex", alignItems:"center", gap:3, color:"var(--text-3)" }}>
                      <span style={{ width:8,height:8,borderRadius:2,background:EXPENSE_COLORS[i%EXPENSE_COLORS.length],display:"inline-block" }} />{c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card-body" style={{ paddingTop:8, paddingBottom:8 }}>
            {loading ? (
              <div className="empty-state">読込中...</div>
            ) : (
              <ChartZoom title="日次収支グラフ" normalHeight={460}>
                {(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <BarChart
                      data={chartData}
                      margin={{ top:24, right:52, bottom:0, left:8 }}
                      barCategoryGap="18%"
                      barGap={2}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize:10, fill:"#94afc8" }}
                        axisLine={{ stroke:"#d6e2f0" }}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis
                        domain={[-500000, 500000]}
                        ticks={[-500000,-400000,-300000,-200000,-100000,0,100000,200000,300000,400000,500000]}
                        tickFormatter={fmtY}
                        tick={{ fontSize:11, fill:"#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <Tooltip
                        content={<CustomTooltip cats={cats} />}
                        cursor={{ fill:"rgba(26,74,143,0.05)" }}
                      />

                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />

                      {budget>0 && (
                        <ReferenceLine
                          y={-budget}
                          stroke="#9ca3af"
                          strokeDasharray="6 3"
                          strokeWidth={1.5}
                          label={{
                            value:`予算 ${budget>=10000?`${(budget/10000).toFixed(0)}万`:budget.toLocaleString()}円`,
                            position:"insideRight", fontSize:10, fill:"#9ca3af", offset:4,
                          }}
                        />
                      )}

                      {mode === "total" && (
                        <>
                          <Bar dataKey="income" name="収入" maxBarSize={28} radius={[4,4,0,0]}>
                            {chartData.map((d,i) => <Cell key={i} fill={d.isTotal ? "#22c55e" : "#86efac"} />)}
                            <LabelList content={IncomeLabel as any} />
                          </Bar>
                          <Bar dataKey="expense" name="支出" maxBarSize={28} radius={[0,0,4,4]}>
                            {chartData.map((d,i) => <Cell key={i} fill={d.isTotal ? "#ef4444" : "#f87171"} />)}
                            <LabelList content={ExpenseLabel as any} />
                          </Bar>
                        </>
                      )}

                      {mode === "category" && (
                        <>
                          {incCats.map((c,i) => (
                            <Bar key={`inc_${c.id}`} dataKey={c.id} name={c.name} stackId="income"
                              fill={INCOME_COLORS[i%INCOME_COLORS.length]} maxBarSize={28}
                              radius={i===incCats.length-1 ? [4,4,0,0] : [0,0,0,0]}
                            />
                          ))}
                          <Bar dataKey="_inc_other" name="未分類(収入)" stackId="income"
                            fill={INCOME_COLORS[incCats.length%INCOME_COLORS.length]} maxBarSize={28}
                            radius={[4,4,0,0]}
                          />

                          {expCats.map((c,i) => (
                            <Bar key={`exp_${c.id}`} dataKey={c.id} name={c.name} stackId="expense"
                              fill={EXPENSE_COLORS[i%EXPENSE_COLORS.length]} maxBarSize={28}
                              radius={i===expCats.length-1 ? [0,0,4,4] : [0,0,0,0]}
                            />
                          ))}
                          <Bar dataKey="_exp_other" name="未分類(支出)" stackId="expense"
                            fill={EXPENSE_COLORS[expCats.length%EXPENSE_COLORS.length]} maxBarSize={28}
                            radius={[0,0,4,4]}
                          />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartZoom>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
