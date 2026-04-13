import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nextMonthStart } from "@/lib/money";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
      .lt("tx_date", monthEnd)
      .order("tx_date", { ascending: false }),

    supabase
      .from("transactions")
      .select("id, tx_date, amount, card_due_date, counterparties(name), accounts(name)")
      .not("card_due_date", "is", null)
      .gte("card_due_date", today)
      .order("card_due_date", { ascending: true })
      .limit(10),
  ]);

  const budget = budgetRow?.budget_amount ?? 0;
  const incomeTotal =
    txRows?.filter((x) => x.tx_type === "income").reduce((s, x) => s + x.amount, 0) ?? 0;
  const expenseTotal =
    txRows?.filter((x) => x.tx_type === "expense").reduce((s, x) => s + x.amount, 0) ?? 0;
  const remaining = budget - expenseTotal;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Money Manager</h1>
          <div>{currentMonth}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/budgets">月度予算</Link>
          <Link href="/transactions/new">出入金入力</Link>
          <Link href="/masters">マスタ管理</Link>
          <form action="/logout" method="post">
            <button type="submit">ログアウト</button>
          </form>
        </div>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <div>当月予算</div>
          <strong style={{ fontSize: 24 }}>{budget.toLocaleString()} 円</strong>
        </div>
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <div>当月収入</div>
          <strong style={{ fontSize: 24 }}>{incomeTotal.toLocaleString()} 円</strong>
        </div>
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <div>当月支出</div>
          <strong style={{ fontSize: 24 }}>{expenseTotal.toLocaleString()} 円</strong>
        </div>
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <div>あと使える額</div>
          <strong style={{ fontSize: 24 }}>{remaining.toLocaleString()} 円</strong>
        </div>
      </section>

      <section style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
        <h2>今後のカード引落予定</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {(dueRows ?? []).map((row) => (
            <li key={row.id}>
              {row.card_due_date} / {(row.accounts as { name?: string } | null)?.name ?? "-"} /{" "}
              {(row.counterparties as { name?: string } | null)?.name ?? "-"} /{" "}
              {row.amount.toLocaleString()} 円
            </li>
          ))}
          {(dueRows ?? []).length === 0 && <li>予定はありません</li>}
        </ul>
      </section>
    </main>
  );
}