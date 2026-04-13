"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type BudgetRow = {
  budget_amount: number;
};

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function BudgetsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [month, setMonth] = useState(getCurrentMonth());
  const [budgetAmount, setBudgetAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      setLoading(true);
      setErrorMessage("");
      setInfoMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        router.refresh();
        return;
      }

      const currentMonthStart = `${month}-01`;

      const [{ data: currentBudget, error: currentError }, { data: previousBudget, error: previousError }] =
        await Promise.all([
          supabase
            .from("monthly_budgets")
            .select("budget_amount")
            .eq("target_month", currentMonthStart)
            .maybeSingle<BudgetRow>(),

          supabase
            .from("monthly_budgets")
            .select("budget_amount")
            .lt("target_month", currentMonthStart)
            .order("target_month", { ascending: false })
            .limit(1)
            .maybeSingle<BudgetRow>(),
        ]);

      if (!mounted) return;

      if (currentError || previousError) {
        setErrorMessage("予算データの読込でエラーが発生しました。");
        setLoading(false);
        return;
      }

      const defaultAmount =
        currentBudget?.budget_amount ?? previousBudget?.budget_amount ?? "";

      setBudgetAmount(String(defaultAmount));
      setLoading(false);
    }

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, [month, router, supabase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        router.refresh();
        return;
      }

      const amount = Number(budgetAmount);

      if (!month) {
        setErrorMessage("対象月を入力してください。");
        return;
      }

      if (Number.isNaN(amount) || amount < 0) {
        setErrorMessage("予算額は0以上の数値で入力してください。");
        return;
      }

      const { error } = await supabase.from("monthly_budgets").upsert(
        {
          user_id: user.id,
          target_month: `${month}-01`,
          budget_amount: amount,
        },
        {
          onConflict: "user_id,target_month",
        }
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setInfoMessage("予算を保存しました。");
      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("予算保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/">← 戻る</Link>
      </div>

      <div style={{ background: "#fff", padding: 24, borderRadius: 12 }}>
        <h1>月度予算入力</h1>

        {errorMessage ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: "#ffe8e8",
              color: "#b00020",
              fontSize: 14,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {infoMessage ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: "#e8f4ff",
              color: "#0b57a4",
              fontSize: 14,
            }}
          >
            {infoMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            対象月
            <br />
            <input
              name="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
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
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              required
              style={{ padding: 10, fontSize: 16 }}
            />
          </label>

          <button
            type="submit"
            disabled={loading || saving}
            style={{ padding: 12, fontSize: 16 }}
          >
            {loading ? "読込中..." : saving ? "保存中..." : "保存"}
          </button>
        </form>
      </div>
    </main>
  );
}