import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nextMonthStart } from "@/lib/money";
import { Header } from "@/app/components/header";
import { DueList, type DueRow } from "@/app/components/due-list";

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

  const [{ data: budgetRow }, { data: txRows }, { data: dueRows }] = await Promise.all([
    supabase
      .from("monthly_budgets")
      .select("budget_amount")
      .eq("target_month", monthStart)
      .maybeSingle(),

    supabase
      .from("transactions")
      .select("amount, tx_type")
      .gte("tx_date", monthStart)
      .lt("tx_date", monthEnd),

    supabase
      .from("transactions")
      .select("id, tx_date, amount, card_due_date, account_id, item_name, counterparties(name), accounts(name)")
      .not("card_due_date", "is", null)
      .gte("card_due_date", today)
      .order("card_due_date", { ascending: true })
      .order("account_id", { ascending: true }),
  ]);

  const budget       = budgetRow?.budget_amount ?? 0;
  const incomeTotal  = txRows?.filter((x) => x.tx_type === "income").reduce((s, x) => s + x.amount, 0) ?? 0;
  const expenseTotal = txRows?.filter((x) => x.tx_type === "expense").reduce((s, x) => s + x.amount, 0) ?? 0;
  const remaining    = budget - expenseTotal;

  return (
    <>
      <Header />
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
              {budget.toLocaleString()}<span className="stat-value-unit">円</span>
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
