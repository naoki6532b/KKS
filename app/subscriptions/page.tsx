"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/app/components/header";

type CategoryRow     = { id: string; kind: "income" | "expense"; name: string; is_favorite: boolean; sort_order: number };
type AccountRow      = { id: string; account_type: "cash" | "bank" | "card"; name: string; is_favorite: boolean; sort_order: number };
type CounterpartyRow = { id: string; kind: "income" | "expense" | "both"; name: string; is_favorite: boolean; sort_order: number };
type SubRow = {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  next_billing_date: string;
  account_id: string | null;
  category_id: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  is_active: boolean;
};

const FREQ_LABELS: Record<string, string> = {
  weekly: "毎週",
  monthly: "毎月",
  "2months": "2ヶ月毎",
  "3months": "3ヶ月毎",
  "6months": "6ヶ月毎",
  annual: "毎年",
};

function compareRows<T extends { is_favorite?: boolean; sort_order?: number; name?: string }>(a: T, b: T) {
  const af = a.is_favorite ? 1 : 0, bf = b.is_favorite ? 1 : 0;
  if (af !== bf) return bf - af;
  const as = a.sort_order ?? 0, bs = b.sort_order ?? 0;
  if (as !== bs) return as - bs;
  return (a.name ?? "").localeCompare(b.name ?? "", "ja");
}

const EMPTY_FORM = { name: "", amount: "", frequency: "monthly", next_billing_date: "", account_id: "", category_id: "", counterparty_id: "", counterparty_name: "" };

export default function SubscriptionsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [subs, setSubs]                 = useState<SubRow[]>([]);
  const [categories, setCategories]     = useState<CategoryRow[]>([]);
  const [accounts, setAccounts]         = useState<AccountRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [errorMsg, setErrorMsg]         = useState("");

  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: subData, error: subErr }, { data: catData }, { data: accData }, { data: cpData }] = await Promise.all([
      supabase.from("subscriptions")
        .select("id, name, amount, frequency, next_billing_date, account_id, category_id, counterparty_id, counterparty_name, is_active")
        .eq("user_id", user.id)
        .order("next_billing_date", { ascending: true }),
      supabase.from("categories").select("id, kind, name, is_favorite, sort_order").eq("is_active", true),
      supabase.from("accounts").select("id, account_type, name, is_favorite, sort_order").eq("is_active", true),
      supabase.from("counterparties").select("id, kind, name, is_favorite, sort_order").eq("is_active", true),
    ]);

    if (subErr) { setErrorMsg(`取得エラー: ${subErr.message}`); setLoading(false); return; }
    setSubs((subData ?? []) as SubRow[]);
    setCategories([...(catData ?? [])].filter((x) => x.kind === "expense").sort(compareRows) as CategoryRow[]);
    setAccounts([...(accData ?? [])].sort(compareRows) as AccountRow[]);
    setCounterparties([...(cpData ?? [])].filter((x) => x.kind === "expense" || x.kind === "both").sort(compareRows) as CounterpartyRow[]);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setErrorMsg("");
    setShowForm(true);
  }

  function openEdit(sub: SubRow) {
    setEditId(sub.id);
    setForm({
      name: sub.name,
      amount: String(sub.amount),
      frequency: sub.frequency,
      next_billing_date: sub.next_billing_date,
      account_id: sub.account_id ?? "",
      category_id: sub.category_id ?? "",
      counterparty_id: sub.counterparty_id ?? "",
      counterparty_name: sub.counterparty_name ?? "",
    });
    setErrorMsg("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setErrorMsg("");
  }

  function setField(key: keyof typeof EMPTY_FORM, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!form.name.trim()) { setErrorMsg("名称を入力してください。"); return; }
    const amt = Number(form.amount);
    if (Number.isNaN(amt) || amt <= 0) { setErrorMsg("金額は1以上の数値で入力してください。"); return; }
    if (!form.next_billing_date) { setErrorMsg("次回請求日を入力してください。"); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErrorMsg("ログインが必要です。"); return; }

      const payload = {
        name: form.name.trim(),
        amount: amt,
        frequency: form.frequency,
        next_billing_date: form.next_billing_date,
        account_id: form.account_id || null,
        category_id: form.category_id || null,
        counterparty_id: form.counterparty_id || null,
        counterparty_name: form.counterparty_name.trim() || null,
      };

      let err;
      if (editId) {
        ({ error: err } = await supabase.from("subscriptions").update(payload).eq("id", editId).eq("user_id", user.id));
      } else {
        ({ error: err } = await supabase.from("subscriptions").insert({ ...payload, user_id: user.id, is_active: true }));
      }
      if (err) { setErrorMsg(err.message); return; }
      closeForm();
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(sub: SubRow) {
    const { error } = await supabase.from("subscriptions").update({ is_active: !sub.is_active }).eq("id", sub.id);
    if (error) { setErrorMsg(error.message); return; }
    await loadAll();
  }

  async function handleDelete(sub: SubRow) {
    if (!confirm(`「${sub.name}」を削除しますか？`)) return;
    const { error } = await supabase.from("subscriptions").delete().eq("id", sub.id);
    if (error) { setErrorMsg(error.message); return; }
    await loadAll();
  }

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-heading">
          <h1 className="page-title">サブスク管理</h1>
          <button className="btn btn-primary" onClick={openNew}>＋ 追加</button>
        </div>

        {errorMsg && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errorMsg}</div>}

        {/* Form panel */}
        {showForm && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h2 className="card-title">{editId ? "サブスク編集" : "新規サブスク登録"}</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit} className="form-grid">
                <div className="field">
                  <label className="field-label">名称</label>
                  <input type="text" className="field-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="例: Netflix、Spotify" required />
                </div>

                <div className="field">
                  <label className="field-label">金額（円）</label>
                  <input type="number" min="1" className="field-input" value={form.amount} onChange={(e) => setField("amount", e.target.value)} required />
                </div>

                <div className="field">
                  <label className="field-label">更新頻度</label>
                  <select className="field-input" value={form.frequency} onChange={(e) => setField("frequency", e.target.value)}>
                    <option value="weekly">毎週</option>
                    <option value="monthly">毎月</option>
                    <option value="2months">2ヶ月毎</option>
                    <option value="3months">3ヶ月毎</option>
                    <option value="6months">6ヶ月毎</option>
                    <option value="annual">毎年</option>
                  </select>
                </div>

                <div className="field">
                  <label className="field-label">次回請求日</label>
                  <input type="date" className="field-input" value={form.next_billing_date} onChange={(e) => setField("next_billing_date", e.target.value)} required />
                </div>

                <div className="field">
                  <label className="field-label">口座 <span style={{ fontWeight: 400, color: "var(--text-4)", fontSize: 11 }}>（任意）</span></label>
                  <select className="field-input" value={form.account_id} onChange={(e) => setField("account_id", e.target.value)}>
                    <option value="">未選択</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.is_favorite ? "★ " : ""}[{a.account_type}] {a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label">科目 <span style={{ fontWeight: 400, color: "var(--text-4)", fontSize: 11 }}>（任意）</span></label>
                  <select className="field-input" value={form.category_id} onChange={(e) => setField("category_id", e.target.value)}>
                    <option value="">未選択</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.is_favorite ? "★ " : ""}{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label">相手先ジャンル <span style={{ fontWeight: 400, color: "var(--text-4)", fontSize: 11 }}>（任意）</span></label>
                  <select className="field-input" value={form.counterparty_id} onChange={(e) => setField("counterparty_id", e.target.value)}>
                    <option value="">未選択</option>
                    {counterparties.map((c) => (
                      <option key={c.id} value={c.id}>{c.is_favorite ? "★ " : ""}{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label">相手先名 <span style={{ fontWeight: 400, color: "var(--text-4)", fontSize: 11 }}>（任意）</span></label>
                  <input type="text" className="field-input" value={form.counterparty_name} onChange={(e) => setField("counterparty_name", e.target.value)} placeholder="例: Netflix Japan" />
                </div>

                <div className="btn-group">
                  <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                    {saving ? "保存中..." : "保存する"}
                  </button>
                  <button type="button" onClick={closeForm} className="btn btn-secondary">
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* List */}
        <div className="card">
          {loading ? (
            <p className="empty-state">読み込み中...</p>
          ) : subs.length === 0 ? (
            <p className="empty-state">サブスクが登録されていません。</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th style={{ textAlign: "right" }}>金額</th>
                    <th>頻度</th>
                    <th>次回請求日</th>
                    <th>口座</th>
                    <th>科目</th>
                    <th>相手先ジャンル</th>
                    <th>相手先名</th>
                    <th>状態</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub) => (
                    <tr key={sub.id} style={{ opacity: sub.is_active ? 1 : 0.45 }}>
                      <td style={{ fontWeight: 600 }}>{sub.name}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <span className="amount-expense">{sub.amount.toLocaleString()} 円</span>
                      </td>
                      <td>{FREQ_LABELS[sub.frequency] ?? sub.frequency}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{sub.next_billing_date}</td>
                      <td>{accounts.find((a) => a.id === sub.account_id)?.name ?? "—"}</td>
                      <td>{categories.find((c) => c.id === sub.category_id)?.name ?? "—"}</td>
                      <td>{counterparties.find((c) => c.id === sub.counterparty_id)?.name ?? "—"}</td>
                      <td>{sub.counterparty_name ?? "—"}</td>
                      <td>
                        <span className={sub.is_active ? "badge badge-income" : "badge"} style={!sub.is_active ? { background: "var(--surface-2)", color: "var(--text-3)" } : {}}>
                          {sub.is_active ? "有効" : "停止"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(sub)}>編集</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleToggleActive(sub)} style={{ minWidth: 52 }}>
                            {sub.is_active ? "停止" : "再開"}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(sub)}>削除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
