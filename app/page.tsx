import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nextMonthStart } from "@/lib/money";
import { Header } from "@/app/components/header";
import { DueList, type DueRow } from "@/app/components/due-list";
import { SubscriptionSync } from "@/app/components/subscription-sync";
import { BudgetBar } from "@/app/components/budget-bar";
import { SALARY_ITEM_MAP } from "@/lib/salary";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthStart = `${currentMonth}-01`;
  const monthEnd = nextMonthStart(monthStart);
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: budgetRow }, { data: txRows }, { data: dueRows }, { data: userSettings }, { data: slipsThisMonth }] = await Promise.all([
    supabase
      .from("monthly_budgets")
      .select("budget_amount")
      .eq("target_month", monthStart)
      .maybeSingle(),

    supabase
      .from("transactions")
      .select("amount, tx_type, salary_slip_id")
      .gte("tx_date", monthStart)
      .lt("tx_date", monthEnd),

    supabase
      .from("transactions")
      .select("id, tx_date, amount, card_due_date, account_id, item_name, counterparties(name), accounts(name)")
      .not("card_due_date", "is", null)
      .gte("card_due_date", today)
      .order("card_due_date", { ascending: true })
      .order("account_id", { ascending: true }),

    supabase
      .from("user_settings")
      .select("strict_display")
      .eq("user_id", user.id)
      .maybeSingle(),

    supabase
      .from("salary_slips")
      .select("id, slip_date, slip_type, salary_slip_items(item_key, amount)")
      .gte("slip_date", monthStart)
      .lt("slip_date", monthEnd),
  ]);

  const strictDisplay = userSettings?.strict_display ?? false;
  const budget = budgetRow?.budget_amount ?? 0;

  let incomeTotal: number;
  let expenseTotal: number;
  let displayedBudget: number;

  if (strictDisplay) {
    incomeTotal  = txRows?.filter((x) => x.tx_type === "income").reduce((s, x) => s + x.amount, 0) ?? 0;
    expenseTotal = txRows?.filter((x) => x.tx_type === "expense").reduce((s, x) => s + x.amount, 0) ?? 0;

    let totalDeductions = 0;
    for (const slip of slipsThisMonth ?? []) {
      for (const it of (slip.salary_slip_items as { item_key: string; amount: number }[])) {
        const def = SALARY_ITEM_MAP.get(it.item_key);
        if (def?.section === "deduction") totalDeductions += it.amount;
      }
    }
    displayedBudget = budget + totalDeductions;
  } else {
    const nonSalaryTx = txRows?.filter((x) => !x.salary_slip_id) ?? [];
    const nonSalaryIncome  = nonSalaryTx.filter((x) => x.tx_type === "income").reduce((s, x) => s + x.amount, 0);
    const nonSalaryExpense = nonSalaryTx.filter((x) => x.tx_type === "expense").reduce((s, x) => s + x.amount, 0);

    let netPayFromSlips = 0;
    for (const slip of slipsThisMonth ?? []) {
      let payment = 0, deduction = 0;
      for (const it of (slip.salary_slip_items as { item_key: string; amount: number }[])) {
        const def = SALARY_ITEM_MAP.get(it.item_key);
        if (!def) continue;
        if (def.section === "deduction") deduction += it.amount;
        else payment += it.amount;
      }
      netPayFromSlips += payment - deduction;
    }

    incomeTotal  = nonSalaryIncome + netPayFromSlips;
    expenseTotal = nonSalaryExpense;
    displayedBudget = budget;
  }

  const remaining = displayedBudget - expenseTotal;

  return (
    <>
      <Header />
      <SubscriptionSync />
      <main className="page">
        <div className="page-heading">
          <div>
            <h1 className="page-title">ダッシュボード</h1>
            <p className="page-subtitle">{currentMonth.replace("-", "年")}月</p>
          </div>
          <Link href="/transactions/new" className="btn btn-primary">
            ＋ 出入金入力
          </Link>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">当月予算</div>
            <div className="stat-value">
              {displayedBudget.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">当月収入</div>
            <div className="stat-value" style={{ color: "var(--green)" }}>
              {incomeTotal.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">当月支出</div>
            <div className="stat-value" style={{ color: "var(--red)" }}>
              {expenseTotal.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">残り使用可能</div>
            <div
              className="stat-value"
              style={{ color: remaining < 0 ? "var(--red)" : "var(--sapphire)" }}
            >
              {remaining.toLocaleString()}<span className="stat-value-unit">円</span>
            </div>
          </div>
        </div>

        <BudgetBar expense={expenseTotal} budget={displayedBudget} />

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">今後のカード引落予定</h2>
          </div>
          <div className="card-body">
            <DueList rows={(dueRows ?? []) as DueRow[]} />
          </div>
        </div>
      </main>
    </>
  );
}
