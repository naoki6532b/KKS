import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveBudgetAction } from "./actions";

export default async function BudgetsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthStart = `${currentMonth}-01`;

  const [{ data: currentBudget }, { data: previousBudget }] = await Promise.all([
    supabase
      .from("monthly_budgets")
      .select("budget_amount")
      .eq("target_month", currentMonthStart)
      .maybeSingle(),

    supabase
      .from("monthly_budgets")
      .select("budget_amount")
      .lt("target_month", currentMonthStart)
      .order("target_month", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const defaultAmount =
    currentBudget?.budget_amount ?? previousBudget?.budget_amount ?? "";

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/">← 戻る</Link>
      </div>

      <div style={{ background: "#fff", padding: 24, borderRadius: 12 }}>
        <h1>月度予算入力</h1>

        <form action={saveBudgetAction} style={{ display: "grid", gap: 12 }}>
          <label>
            対象月
            <br />
            <input
              name="month"
              type="month"
              defaultValue={currentMonth}
              required
              style={{ padding: 10, fontSize: 16 }}
            />
          </label>

          <label>
            予算額
            <br />
            <input
              name="budget_amount"
              type="number"
              min="0"
              defaultValue={defaultAmount}
              required
              style={{ padding: 10, fontSize: 16 }}
            />
          </label>

          <button type="submit" style={{ padding: 12, fontSize: 16 }}>
            保存
          </button>
        </form>
      </div>
    </main>
  );
}         