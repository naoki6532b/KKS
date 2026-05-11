"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/app/components/header";
import { SALARY_ITEMS, type ItemSetting, type LedgerMode, defaultSetting, type SalarySection, buildSlipTransactions } from "@/lib/salary";
import { firstDayOfMonth } from "@/lib/money";

type CategoryRow     = { id: string; kind: "income"|"expense"; name: string };
type CounterpartyRow = { id: string; kind: "income"|"expense"|"both"; name: string };

const SECTION_LABEL: Record<SalarySection, string> = {
  payment_taxable:    "支給（課税）",
  payment_nontaxable: "支給（非課税）",
  deduction:          "控除",
};

export default function SalarySettingsPage() {
  const router  = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [info,    setInfo]    = useState("");
  const [err,     setErr]     = useState("");

  const [categories, setCategories]         = useState<CategoryRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [settings, setSettings] = useState<Record<string, ItemSetting>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push("/login"); return; }
      const [{ data: cats }, { data: cps }, { data: rows }] = await Promise.all([
        supabase.from("categories").select("id, kind, name").eq("is_active", true).order("name"),
        supabase.from("counterparties").select("id, kind, name").eq("is_active", true).order("name"),
        supabase.from("salary_item_settings").select("*").eq("user_id", user.id),
      ]);
      if (!mounted) return;
      setCategories((cats ?? []) as CategoryRow[]);
      setCounterparties((cps ?? []) as CounterpartyRow[]);
      const map: Record<string, ItemSetting> = {};
      for (const it of SALARY_ITEMS) map[it.key] = defaultSetting(it.key);
      map["__aggregate_payment__"]   = defaultSetting("__aggregate_payment__");
      map["__aggregate_deduction__"] = defaultSetting("__aggregate_deduction__");
      for (const r of (rows ?? []) as ItemSetting[]) map[r.item_key] = { ...map[r.item_key], ...r };
      setSettings(map);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [router, supabase]);

  function update(key: string, patch: Partial<ItemSetting>) {
    setSettings((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  }

  async function handleSave() {
    setSaving(true); setInfo(""); setErr("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const rows = Object.values(settings).map((s) => ({
        user_id: user.id,
        item_key: s.item_key,
        ledger_mode: s.ledger_mode,
        category_id: s.category_id,
        counterparty_id: s.counterparty_id,
        counterparty_name: s.counterparty_name,
        has_tax: s.has_tax,
      }));
      const { error } = await supabase.from("salary_item_settings").upsert(rows, { onConflict: "user_id,item_key" });
      if (error) { setErr(error.message); return; }

      const { data: taxData } = await supabase.from("user_settings").select("tax_rate").eq("user_id", user.id).maybeSingle();
      const taxRate = taxData?.tax_rate != null ? Number(taxData.tax_rate) : 10;

      const { data: slips } = await supabase.from("salary_slips").select("*").eq("user_id", user.id);
      if (slips && slips.length > 0) {
        for (const slip of slips as { id: string; slip_date: string; slip_type: string; account_id: string; memo: string | null }[]) {
          const { data: items } = await supabase.from("salary_slip_items").select("*").eq("slip_id", slip.id);
          const amounts: Record<string, number> = {};
          for (const it of (items ?? []) as { item_key: string; amount: number }[]) amounts[it.item_key] = it.amount;

          const slipTypeLabel = slip.slip_type === "salary" ? "給与" : "賞与";
          const generated = buildSlipTransactions(amounts, settings, taxRate, slipTypeLabel);

          await supabase.from("transactions").delete().eq("salary_slip_id", slip.id);
          if (generated.length > 0) {
            const txRows = generated.map((t) => ({
              user_id: user.id,
              tx_date: slip.slip_date,
              target_month: firstDayOfMonth(slip.slip_date),
              tx_type: t.tx_type,
              amount: t.amount,
              currency: "JPY",
              category_id: t.category_id,
              counterparty_id: t.counterparty_id,
              counterparty_name: t.counterparty_name,
              account_id: slip.account_id,
              item_name: t.item_name,
              memo: slip.memo ?? null,
              has_tax: t.has_tax,
              tax_amount: t.tax_amount,
              salary_slip_id: slip.id,
              salary_item_key: t.salary_item_key,
            }));
            await supabase.from("transactions").insert(txRows);
          }
        }
        setInfo(`保存しました。既存の給与明細 ${slips.length} 件の出入金明細を更新しました。`);
      } else {
        setInfo("保存しました。");
      }
    } catch { setErr("保存中にエラーが発生しました。"); }
    finally { setSaving(false); }
  }

  const hasPaymentAgg = SALARY_ITEMS
    .filter((it) => it.section !== "deduction")
    .some((it) => (settings[it.key] ?? defaultSetting(it.key)).ledger_mode === "aggregate");
  const hasDeductionAgg = SALARY_ITEMS
    .filter((it) => it.section === "deduction")
    .some((it) => (settings[it.key] ?? defaultSetting(it.key)).ledger_mode === "aggregate");

  const incomeCats  = categories.filter((c) => c.kind === "income");
  const expenseCats = categories.filter((c) => c.kind === "expense");
  const incomeCps   = counterparties.filter((c) => c.kind === "income" || c.kind === "both");
  const expenseCps  = counterparties.filter((c) => c.kind === "expense" || c.kind === "both");

  function renderAggregateSettings() {
    if (!hasPaymentAgg && !hasDeductionAgg) return null;
    return (
      <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid var(--sapphire, #3b82f6)" }}>
        <div className="card-header">
          <h2 className="card-title">合計登録時の設定</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            「合計」モードの項目をまとめて1件の取引として登録する際の科目・相手先
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ minWidth: 100 }}>区分</th>
                <th style={{ minWidth: 140 }}>科目</th>
                <th style={{ minWidth: 140 }}>相手先ジャンル</th>
                <th style={{ minWidth: 140 }}>相手先名</th>
                <th style={{ minWidth: 70, textAlign: "center" }}>税込み</th>
              </tr>
            </thead>
            <tbody>
              {hasPaymentAgg && (
                <tr>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>支給合計</td>
                  <td>
                    <select
                      value={settings["__aggregate_payment__"]?.category_id ?? ""}
                      onChange={(e) => update("__aggregate_payment__", { category_id: e.target.value || null })}
                      className="field-input"
                      style={{ padding: "6px 8px", fontSize: 13 }}
                    >
                      <option value="">未選択</option>
                      {incomeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={settings["__aggregate_payment__"]?.counterparty_id ?? ""}
                      onChange={(e) => update("__aggregate_payment__", { counterparty_id: e.target.value || null })}
                      className="field-input"
                      style={{ padding: "6px 8px", fontSize: 13 }}
                    >
                      <option value="">未選択</option>
                      {incomeCps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={settings["__aggregate_payment__"]?.counterparty_name ?? ""}
                      onChange={(e) => update("__aggregate_payment__", { counterparty_name: e.target.value || null })}
                      className="field-input"
                      style={{ padding: "6px 8px", fontSize: 13 }}
                      placeholder="例: ○○会社"
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={settings["__aggregate_payment__"]?.has_tax ?? false}
                      onChange={(e) => update("__aggregate_payment__", { has_tax: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: "var(--sapphire-mid)" }}
                    />
                  </td>
                </tr>
              )}
              {hasDeductionAgg && (
                <tr>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>控除合計</td>
                  <td>
                    <select
                      value={settings["__aggregate_deduction__"]?.category_id ?? ""}
                      onChange={(e) => update("__aggregate_deduction__", { category_id: e.target.value || null })}
                      className="field-input"
                      style={{ padding: "6px 8px", fontSize: 13 }}
                    >
                      <option value="">未選択</option>
                      {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={settings["__aggregate_deduction__"]?.counterparty_id ?? ""}
                      onChange={(e) => update("__aggregate_deduction__", { counterparty_id: e.target.value || null })}
                      className="field-input"
                      style={{ padding: "6px 8px", fontSize: 13 }}
                    >
                      <option value="">未選択</option>
                      {expenseCps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={settings["__aggregate_deduction__"]?.counterparty_name ?? ""}
                      onChange={(e) => update("__aggregate_deduction__", { counterparty_name: e.target.value || null })}
                      className="field-input"
                      style={{ padding: "6px 8px", fontSize: 13 }}
                      placeholder="例: ○○会社"
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={settings["__aggregate_deduction__"]?.has_tax ?? false}
                      onChange={(e) => update("__aggregate_deduction__", { has_tax: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: "var(--sapphire-mid)" }}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderSection(section: SalarySection) {
    const items = SALARY_ITEMS.filter((it) => it.section === section);
    const isPayment = section !== "deduction";
    const cats = isPayment ? incomeCats : expenseCats;
    const cps  = isPayment ? incomeCps  : expenseCps;

    return (
      <div key={section} className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">{SECTION_LABEL[section]}</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            「個別」→ 項目別に登録　／　「合計」→ {isPayment ? "支給合計" : "控除合計"}として1件登録
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>項目</th>
                <th style={{ minWidth: 100 }}>登録方法</th>
                <th style={{ minWidth: 140 }}>科目</th>
                <th style={{ minWidth: 140 }}>相手先ジャンル</th>
                <th style={{ minWidth: 140 }}>相手先名</th>
                <th style={{ minWidth: 70, textAlign: "center" }}>税込み</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const s = settings[it.key] ?? defaultSetting(it.key);
                const isAgg = s.ledger_mode === "aggregate";
                return (
                  <tr key={it.key} style={{ color: isAgg ? "var(--text-3)" : undefined }}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{it.label}</td>
                    <td>
                      <select
                        value={s.ledger_mode}
                        onChange={(e) => update(it.key, { ledger_mode: e.target.value as LedgerMode })}
                        className="field-input"
                        style={{ padding: "6px 8px", fontSize: 13 }}
                      >
                        <option value="individual">個別</option>
                        <option value="aggregate">合計</option>
                      </select>
                    </td>
                    {isAgg ? (
                      <td colSpan={4} style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
                        上の「合計登録時の設定」で一括設定
                      </td>
                    ) : (
                      <>
                        <td>
                          <select
                            value={s.category_id ?? ""}
                            onChange={(e) => update(it.key, { category_id: e.target.value || null })}
                            className="field-input"
                            style={{ padding: "6px 8px", fontSize: 13 }}
                          >
                            <option value="">未選択</option>
                            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <select
                            value={s.counterparty_id ?? ""}
                            onChange={(e) => update(it.key, { counterparty_id: e.target.value || null })}
                            className="field-input"
                            style={{ padding: "6px 8px", fontSize: 13 }}
                          >
                            <option value="">未選択</option>
                            {cps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={s.counterparty_name ?? ""}
                            onChange={(e) => update(it.key, { counterparty_name: e.target.value || null })}
                            className="field-input"
                            style={{ padding: "6px 8px", fontSize: 13 }}
                            placeholder="例: ○○会社"
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={s.has_tax}
                            onChange={(e) => update(it.key, { has_tax: e.target.checked })}
                            style={{ width: 16, height: 16, accentColor: "var(--sapphire-mid)" }}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-heading">
          <h1 className="page-title">給与マッピング設定</h1>
          <button onClick={handleSave} disabled={saving || loading} className="btn btn-primary">
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>
        {info && <div className="alert alert-success">{info}</div>}
        {err  && <div className="alert alert-error">{err}</div>}
        {loading ? (
          <div className="card"><p className="empty-state">読込中...</p></div>
        ) : (
          <>
            {renderAggregateSettings()}
            {renderSection("payment_taxable")}
            {renderSection("payment_nontaxable")}
            {renderSection("deduction")}
          </>
        )}
      </main>
    </>
  );
}
