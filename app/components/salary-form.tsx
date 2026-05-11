"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { firstDayOfMonth } from "@/lib/money";
import {
  SALARY_ITEMS, type SalarySection, type ItemSetting, defaultSetting,
  buildSlipTransactions, sumBySection, type SlipItemAmounts,
} from "@/lib/salary";

type AccountRow = { id: string; account_type: "cash"|"bank"|"card"; name: string; is_favorite: boolean };

type Props = {
  mode: "new" | "edit";
  slipId?: string;
};

const SECTION_LABEL: Record<SalarySection, string> = {
  payment_taxable:    "支給（課税）",
  payment_nontaxable: "支給（非課税）",
  deduction:          "控除",
};

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function SalaryForm({ mode, slipId }: Props) {
  const router  = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err,     setErr]     = useState("");

  const [slipDate, setSlipDate] = useState(todayYmd());
  const [slipType, setSlipType] = useState<"salary"|"bonus">("salary");
  const [accountId, setAccountId] = useState("");
  const [memo, setMemo] = useState("");

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [settings, setSettings] = useState<Record<string, ItemSetting>>({});
  const [amounts,  setAmounts]  = useState<SlipItemAmounts>({});
  const [taxRate,  setTaxRate]  = useState(10);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push("/login"); return; }

      const [accRes, setRes, taxRes] = await Promise.all([
        supabase.from("accounts").select("id, account_type, name, is_favorite").eq("is_active", true),
        supabase.from("salary_item_settings").select("*").eq("user_id", user.id),
        supabase.from("user_settings").select("tax_rate").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!mounted) return;

      const accs = ((accRes.data ?? []) as AccountRow[]).slice().sort((a, b) => (b.is_favorite?1:0)-(a.is_favorite?1:0) || a.name.localeCompare(b.name, "ja"));
      setAccounts(accs);

      const map: Record<string, ItemSetting> = {};
      for (const it of SALARY_ITEMS) map[it.key] = defaultSetting(it.key);
      // Initialize aggregate settings so buildSlipTransactions can read them
      map["__aggregate_payment__"]   = defaultSetting("__aggregate_payment__");
      map["__aggregate_deduction__"] = defaultSetting("__aggregate_deduction__");
      for (const r of ((setRes.data ?? []) as ItemSetting[])) map[r.item_key] = { ...map[r.item_key], ...r };
      setSettings(map);

      if (taxRes.data?.tax_rate != null) setTaxRate(Number(taxRes.data.tax_rate));

      if (mode === "edit" && slipId) {
        const [{ data: slip, error: slipErr }, { data: items }] = await Promise.all([
          supabase.from("salary_slips").select("*").eq("id", slipId).eq("user_id", user.id).single(),
          supabase.from("salary_slip_items").select("*").eq("slip_id", slipId),
        ]);
        if (!mounted) return;
        if (slipErr || !slip) { setErr("給与明細が見つかりません。"); setLoading(false); return; }
        const slipRec = slip as Record<string, unknown>;
        setSlipDate(slipRec.slip_date as string);
        setSlipType(slipRec.slip_type as "salary"|"bonus");
        setAccountId((slipRec.account_id as string) ?? "");
        setMemo((slipRec.memo as string) ?? "");
        const a: SlipItemAmounts = {};
        for (const it of (items ?? []) as { item_key: string; amount: number }[]) a[it.item_key] = it.amount;
        setAmounts(a);
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [router, supabase, mode, slipId]);

  function setAmt(key: string, v: string) {
    const n = v === "" ? 0 : Math.round(Number(v));
    if (Number.isNaN(n)) return;
    setAmounts((a) => ({ ...a, [key]: n }));
  }

  const totalPayment   = sumBySection(amounts, "payment_taxable") + sumBySection(amounts, "payment_nontaxable");
  const totalDeduction = sumBySection(amounts, "deduction");
  const netPay = totalPayment - totalDeduction;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      if (!slipDate) { setErr("支給日を入力してください。"); return; }
      if (!accountId) { setErr("振込先口座を選択してください。"); return; }

      const slipTypeLabel = slipType === "salary" ? "給与" : "賞与";
      const generated = buildSlipTransactions(amounts, settings, taxRate, slipTypeLabel);

      let finalSlipId = slipId ?? "";
      if (mode === "new") {
        const { data, error } = await supabase.from("salary_slips").insert({
          user_id: user.id, slip_date: slipDate, slip_type: slipType,
          account_id: accountId, memo: memo.trim() || null,
        }).select("id").single();
        if (error || !data) { setErr(error?.message ?? "保存に失敗しました。"); return; }
        finalSlipId = data.id as string;
      } else {
        const { error } = await supabase.from("salary_slips").update({
          slip_date: slipDate, slip_type: slipType,
          account_id: accountId, memo: memo.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq("id", finalSlipId).eq("user_id", user.id);
        if (error) { setErr(error.message); return; }
        await supabase.from("salary_slip_items").delete().eq("slip_id", finalSlipId);
        await supabase.from("transactions").delete().eq("salary_slip_id", finalSlipId);
      }

      const itemRows = SALARY_ITEMS
        .filter((it) => (amounts[it.key] ?? 0) !== 0)
        .map((it) => ({ slip_id: finalSlipId, item_key: it.key, amount: amounts[it.key] }));
      if (itemRows.length > 0) {
        const { error } = await supabase.from("salary_slip_items").insert(itemRows);
        if (error) { setErr(error.message); return; }
      }

      const txRows = generated.map((t) => ({
        user_id: user.id,
        tx_date: slipDate,
        target_month: firstDayOfMonth(slipDate),
        tx_type: t.tx_type,
        amount: t.amount,
        currency: "JPY",
        category_id: t.category_id,
        counterparty_id: t.counterparty_id,
        counterparty_name: t.counterparty_name,
        account_id: accountId,
        item_name: t.item_name,
        memo: memo.trim() || null,
        has_tax: t.has_tax,
        tax_amount: t.tax_amount,
        salary_slip_id: finalSlipId,
        salary_item_key: t.salary_item_key,
      }));
      if (txRows.length > 0) {
        const { error } = await supabase.from("transactions").insert(txRows);
        if (error) { setErr(error.message); return; }
      }
      router.push("/salary");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!slipId) return;
    if (!confirm("この給与明細と関連する出入金明細をすべて削除します。よろしいですか？")) return;
    setDeleting(true); setErr("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      await supabase.from("transactions").delete().eq("salary_slip_id", slipId);
      const { error } = await supabase.from("salary_slips").delete().eq("id", slipId).eq("user_id", user.id);
      if (error) { setErr(error.message); return; }
      router.push("/salary");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "削除中にエラーが発生しました。");
    } finally {
      setDeleting(false);
    }
  }

  function renderSection(section: SalarySection) {
    const items = SALARY_ITEMS.filter((it) => it.section === section);
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">{SECTION_LABEL[section]}</h3>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--sapphire)" }}>
            小計 ¥{sumBySection(amounts, section).toLocaleString()}
          </span>
        </div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {items.map((it) => {
            const v = amounts[it.key] ?? 0;
            const mode = (settings[it.key] ?? defaultSetting(it.key)).ledger_mode;
            return (
              <label key={it.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
                  {it.label}
                  {mode === "aggregate" && (
                    <span style={{ fontSize: 9, background: "var(--surface-2)", color: "var(--text-3)", padding: "1px 4px", borderRadius: 3 }}>合算</span>
                  )}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={v === 0 ? "" : String(v)}
                  onChange={(e) => setAmt(it.key, e.target.value)}
                  className="field-input"
                  style={{ padding: "6px 8px", fontSize: 13, textAlign: "right" }}
                  placeholder="0"
                />
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1 className="page-title">{mode === "new" ? "給与・賞与 入力" : "給与・賞与 訂正"}</h1>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      {loading ? (
        <div className="card"><p className="empty-state">読込中...</p></div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <div className="field">
                  <label className="field-label">種別</label>
                  <select value={slipType} onChange={(e) => setSlipType(e.target.value as "salary"|"bonus")} className="field-input">
                    <option value="salary">給与</option>
                    <option value="bonus">賞与</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">支給日</label>
                  <input type="date" value={slipDate} onChange={(e) => setSlipDate(e.target.value)} required className="field-input" />
                </div>
                <div className="field">
                  <label className="field-label">振込先口座</label>
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required className="field-input">
                    <option value="">選択してください</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.is_favorite ? "★ " : ""}[{a.account_type}] {a.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label className="field-label">メモ</label>
                  <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} className="field-input" placeholder="例: 4月分給与" />
                </div>
              </div>
            </div>
          </div>

          {renderSection("payment_taxable")}
          {renderSection("payment_nontaxable")}
          {renderSection("deduction")}

          <div className="card" style={{ marginBottom: 16, background: "var(--surface-2)" }}>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>支給合計</div>
                  <div className="amount-income" style={{ fontSize: 22, marginTop: 4 }}>¥{totalPayment.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>控除合計</div>
                  <div className="amount-expense" style={{ fontSize: 22, marginTop: 4 }}>¥{totalDeduction.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>差引支給額</div>
                  <div style={{ fontSize: 22, marginTop: 4, fontWeight: 800, color: "var(--sapphire)" }}>¥{netPay.toLocaleString()}</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12, textAlign: "center" }}>
                明細書の「差引支給額」と一致するか確認してください。
              </p>
            </div>
          </div>

          <div className="btn-group">
            <button type="submit" disabled={saving || deleting} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
              {saving ? "保存中..." : mode === "new" ? "保存して出入金明細へ反映" : "更新する"}
            </button>
            {mode === "edit" && (
              <button type="button" onClick={handleDelete} disabled={saving || deleting} className="btn btn-danger">
                {deleting ? "削除中..." : "削除"}
              </button>
            )}
          </div>
        </form>
      )}
    </main>
  );
}
