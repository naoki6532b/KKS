"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/app/components/header";
import { SALARY_ITEMS, AGGREGATE_ITEMS, type ItemSetting, type LedgerMode, defaultSetting, type SalarySection } from "@/lib/salary";

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
      for (const it of SALARY_ITEMS)    map[it.key] = defaultSetting(it.key);
      for (const it of AGGREGATE_ITEMS) map[it.key] = defaultSetting(it.key);
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
      setInfo("保存しました。");
    } catch { setErr("保存中にエラーが発生しました。"); }
    finally { setSaving(false); }
  }

  function renderAggregateSection() {
    return (
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">合計登録時の設定</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            「合計」を選んだ項目をまとめて1件登録する際の科目・相手先を設定します
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>合計区分</th>
                <th style={{ minWidth: 140 }}>科目</th>
                <th style={{ minWidth: 140 }}>相手先ジャンル</th>
                <th style={{ minWidth: 140 }}>相手先名</th>
                <th style={{ minWidth: 70, textAlign: "center" }}>税込み</th>
              </tr>
            </thead>
            <tbody>
              {AGGREGATE_ITEMS.map(({ key, label, isPayment }) => {
                const s = settings[key] ?? defaultSetting(key);
                const cats = categories.filter((c) => isPayment ? c.kind === "income" : c.kind === "expense");
                const cps  = counterparties.filter((c) => isPayment ? (c.kind === "income" || c.kind === "both") : (c.kind === "expense" || c.kind === "both"));
                return (
                  <tr key={key}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{label}</td>
                    <td>
                      <select
                        value={s.category_id ?? ""}
                        onChange={(e) => update(key, { category_id: e.target.value || null })}
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
                        onChange={(e) => update(key, { counterparty_id: e.target.value || null })}
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
                        onChange={(e) => update(key, { counterparty_name: e.target.value || null })}
                        className="field-input"
                        style={{ padding: "6px 8px", fontSize: 13 }}
                        placeholder="例: ○○会社"
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={s.has_tax}
                        onChange={(e) => update(key, { has_tax: e.target.checked })}
                        style={{ width: 16, height: 16, accentColor: "var(--sapphire-mid)" }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderSection(section: SalarySection) {
    const items = SALARY_ITEMS.filter((it) => it.section === section);
    const isPayment = section !== "deduction";
    const cats = categories.filter((c) => isPayment ? c.kind === "income" : c.kind === "expense");
    const cps  = counterparties.filter((c) => isPayment ? (c.kind === "income" || c.kind === "both") : (c.kind === "expense" || c.kind === "both"));

    return (
      <div key={section} className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">{SECTION_LABEL[section]}</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            「個別」を選ぶと出入金明細に項目別に登録、「合計」を選ぶと支給合計／控除合計にまとめて1件登録
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
                  <tr key={it.key}>
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
                    <td>
                      <select
                        value={s.category_id ?? ""}
                        onChange={(e) => update(it.key, { category_id: e.target.value || null })}
                        disabled={isAgg}
                        className="field-input"
                        style={{ padding: "6px 8px", fontSize: 13, opacity: isAgg ? 0.4 : 1 }}
                      >
                        <option value="">未選択</option>
                        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        value={s.counterparty_id ?? ""}
                        onChange={(e) => update(it.key, { counterparty_id: e.target.value || null })}
                        disabled={isAgg}
                        className="field-input"
                        style={{ padding: "6px 8px", fontSize: 13, opacity: isAgg ? 0.4 : 1 }}
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
                        disabled={isAgg}
                        className="field-input"
                        style={{ padding: "6px 8px", fontSize: 13, opacity: isAgg ? 0.4 : 1 }}
                        placeholder="例: ○○健保"
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={s.has_tax}
                        onChange={(e) => update(it.key, { has_tax: e.target.checked })}
                        disabled={isAgg}
                        style={{ width: 16, height: 16, opacity: isAgg ? 0.4 : 1, accentColor: "var(--sapphire-mid)" }}
                      />
                    </td>
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
            {renderAggregateSection()}
            {renderSection("payment_taxable")}
            {renderSection("payment_nontaxable")}
            {renderSection("deduction")}
          </>
        )}
      </main>
    </>
  );
}
