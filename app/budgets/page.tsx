"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/app/components/header";

type BudgetRow = { budget_amount: number };

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
    async function load() {
      setLoading(true);
      setErrorMessage("");
      setInfoMessage("");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/login"); router.refresh(); return; }

      const currentMonthStart = `${month}-01`;
      const [{ data: cur, error: curErr }, { data: prev, error: prevErr }] = await Promise.all([
        supabase.from("monthly_budgets").select("budget_amount").eq("target_month", currentMonthStart).maybeSingle<BudgetRow>(),
        supabase.from("monthly_budgets").select("budget_amount").lt("target_month", currentMonthStart).order("target_month", { ascending: false }).limit(1).maybeSingle<BudgetRow>(),
      ]);
      if (!mounted) return;
      if (curErr || prevErr) { setErrorMessage("予算データの読込でエラーが発生しました。"); setLoading(false); return; }
      setBudgetAmount(String(cur?.budget_amount ?? prev?.budget_amount ?? ""));
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [month, router, supabase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/login"); router.refresh(); return; }
      const amount = Number(budgetAmount);
      if (!month) { setErrorMessage("対象月を入力してください。"); return; }
      if (Number.isNaN(amount) || amount < 0) { setErrorMessage("予算額は0以上の数値で入力してください。"); return; }
      const { error } = await supabase.from("monthly_budgets").upsert(
        { user_id: user.id, target_month: `${month}-01`, budget_amount: amount },
        { onConflict: "user_id,target_month" }
      );
      if (error) { setErrorMessage(error.message); return; }
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
    <>
      <Header />
      <main className="page-sm">
        <div className="page-heading">
          <h1 className="page-title">月度予算</h1>
        </div>

        <div className="card">
          <div className="card-body">
            {errorMessage && <div className="alert alert-error">{errorMessage}</div>}
            {infoMessage  && <div className="alert alert-success">{infoMessage}</div>}

            <form onSubmit={handleSubmit} className="form-grid">
              <div className="field">
                <label className="field-label">対象月</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                  className="field-input"
                />
              </div>
              <div className="field">
                <label className="field-label">予算額（円）</label>
                <input
                  type="number"
                  min="0"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  required
                  className="field-input"
                  placeholder="例: 200000"
                />
              </div>
              <button type="submit" disabled={loading || saving} className="btn btn-primary btn-lg">
                {loading ? "読込中..." : saving ? "保存中..." : "保存する"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
