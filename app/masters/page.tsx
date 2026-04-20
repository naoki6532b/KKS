"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/app/components/header";

type MasterTab = "categories" | "counterparties" | "accounts";

type CategoryRow = { id: string; kind: "income"|"expense"; name: string; sort_order: number; is_active: boolean; is_favorite: boolean };
type CounterpartyRow = { id: string; kind: "income"|"expense"|"both"; name: string; sort_order: number; is_active: boolean; is_favorite: boolean; default_category_id: string|null };
type AccountRow = { id: string; name: string; account_type: "cash"|"bank"|"card"; close_day_type: "fixed"|"month_end"|null; close_day: number|null; pay_month_offset: number|null; pay_day_type: "fixed"|"month_end"|null; pay_day: number|null; sort_order: number; is_active: boolean; is_favorite: boolean };

function compareMasterRows<T extends { is_favorite?: boolean; sort_order?: number; name?: string }>(a: T, b: T) {
  const af = a.is_favorite ? 1 : 0, bf = b.is_favorite ? 1 : 0;
  if (af !== bf) return bf - af;
  const as = a.sort_order ?? 0, bs = b.sort_order ?? 0;
  if (as !== bs) return as - bs;
  return (a.name ?? "").localeCompare(b.name ?? "", "ja");
}

export default function MastersPage() {
  const router  = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<MasterTab>("categories");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage]   = useState("");

  const [categories, setCategories]         = useState<CategoryRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [accounts, setAccounts]             = useState<AccountRow[]>([]);

  const [categorySearch, setCategorySearch]         = useState("");
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [accountSearch, setAccountSearch]           = useState("");

  const [categoryFilterKind, setCategoryFilterKind]         = useState<"all"|"income"|"expense">("all");
  const [counterpartyFilterKind, setCounterpartyFilterKind] = useState<"all"|"income"|"expense"|"both">("all");
  const [accountFilterType, setAccountFilterType]           = useState<"all"|"cash"|"bank"|"card">("all");

  const [categoryForm, setCategoryForm] = useState({ id: "", kind: "expense" as "income"|"expense", name: "", sort_order: "0", is_active: true, is_favorite: false });
  const [counterpartyForm, setCounterpartyForm] = useState({ id: "", kind: "expense" as "income"|"expense"|"both", name: "", sort_order: "0", is_active: true, is_favorite: false, default_category_id: "" });
  const [accountForm, setAccountForm] = useState({ id: "", name: "", account_type: "cash" as "cash"|"bank"|"card", sort_order: "0", is_active: true, is_favorite: false, close_day_type: "month_end" as "fixed"|"month_end", close_day: "", pay_month_offset: "1", pay_day_type: "fixed" as "fixed"|"month_end", pay_day: "27" });

  async function loadData() {
    setLoading(true);
    setErrorMessage("");
    setInfoMessage("");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { router.push("/login"); router.refresh(); return; }
    const [{ data: catData, error: catError }, { data: cpData, error: cpError }, { data: accData, error: accError }] = await Promise.all([
      supabase.from("categories").select("id, kind, name, sort_order, is_active, is_favorite"),
      supabase.from("counterparties").select("id, kind, name, sort_order, is_active, is_favorite, default_category_id"),
      supabase.from("accounts").select("id, name, account_type, close_day_type, close_day, pay_month_offset, pay_day_type, pay_day, sort_order, is_active, is_favorite"),
    ]);
    if (catError || cpError || accError) { setErrorMessage("マスタデータの読込でエラーが発生しました。"); setLoading(false); return; }
    setCategories([...(catData ?? [])].sort(compareMasterRows) as CategoryRow[]);
    setCounterparties([...(cpData ?? [])].sort(compareMasterRows) as CounterpartyRow[]);
    setAccounts([...(accData ?? [])].sort(compareMasterRows) as AccountRow[]);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const resetCategoryForm    = () => setCategoryForm({ id: "", kind: "expense", name: "", sort_order: "0", is_active: true, is_favorite: false });
  const resetCounterpartyForm = () => setCounterpartyForm({ id: "", kind: "expense", name: "", sort_order: "0", is_active: true, is_favorite: false, default_category_id: "" });
  const resetAccountForm     = () => setAccountForm({ id: "", name: "", account_type: "cash", sort_order: "0", is_active: true, is_favorite: false, close_day_type: "month_end", close_day: "", pay_month_offset: "1", pay_day_type: "fixed", pay_day: "27" });

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErrorMessage(""); setInfoMessage("");
    try {
      const name = categoryForm.name.trim(); const sortOrder = Number(categoryForm.sort_order);
      if (!name) { setErrorMessage("科目名を入力してください。"); return; }
      if (Number.isNaN(sortOrder)) { setErrorMessage("表示順は数値で入力してください。"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); router.refresh(); return; }
      const payload = { user_id: user.id, kind: categoryForm.kind, name, sort_order: sortOrder, is_active: categoryForm.is_active, is_favorite: categoryForm.is_favorite };
      const result = categoryForm.id ? await supabase.from("categories").update(payload).eq("id", categoryForm.id) : await supabase.from("categories").insert(payload);
      if (result.error) { setErrorMessage(result.error.message); return; }
      setInfoMessage(categoryForm.id ? "科目を更新しました。" : "科目を追加しました。");
      resetCategoryForm(); await loadData();
    } finally { setSaving(false); }
  }

  async function handleSaveCounterparty(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErrorMessage(""); setInfoMessage("");
    try {
      const name = counterpartyForm.name.trim(); const sortOrder = Number(counterpartyForm.sort_order);
      if (!name) { setErrorMessage("相手先名を入力してください。"); return; }
      if (Number.isNaN(sortOrder)) { setErrorMessage("表示順は数値で入力してください。"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); router.refresh(); return; }
      const payload = { user_id: user.id, kind: counterpartyForm.kind, name, sort_order: sortOrder, is_active: counterpartyForm.is_active, is_favorite: counterpartyForm.is_favorite, default_category_id: counterpartyForm.kind === "both" ? null : counterpartyForm.default_category_id || null };
      const result = counterpartyForm.id ? await supabase.from("counterparties").update(payload).eq("id", counterpartyForm.id) : await supabase.from("counterparties").insert(payload);
      if (result.error) { setErrorMessage(result.error.message); return; }
      setInfoMessage(counterpartyForm.id ? "相手先を更新しました。" : "相手先を追加しました。");
      resetCounterpartyForm(); await loadData();
    } finally { setSaving(false); }
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErrorMessage(""); setInfoMessage("");
    try {
      const name = accountForm.name.trim(); const sortOrder = Number(accountForm.sort_order);
      if (!name) { setErrorMessage("名称を入力してください。"); return; }
      if (Number.isNaN(sortOrder)) { setErrorMessage("表示順は数値で入力してください。"); return; }
      let closeDay: number|null = null, payMonthOffset: number|null = null, payDay: number|null = null;
      if (accountForm.account_type === "card") {
        payMonthOffset = Number(accountForm.pay_month_offset);
        if (Number.isNaN(payMonthOffset) || payMonthOffset < 0) { setErrorMessage("支払月ずれは0以上の数値で入力してください。"); return; }
        if (accountForm.close_day_type === "fixed") { closeDay = Number(accountForm.close_day); if (Number.isNaN(closeDay) || closeDay < 1 || closeDay > 31) { setErrorMessage("締め日は1〜31で入力してください。"); return; } }
        if (accountForm.pay_day_type === "fixed") { payDay = Number(accountForm.pay_day); if (Number.isNaN(payDay) || payDay < 1 || payDay > 31) { setErrorMessage("支払日は1〜31で入力してください。"); return; } }
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); router.refresh(); return; }
      const isCard = accountForm.account_type === "card";
      const payload = { user_id: user.id, name, account_type: accountForm.account_type, sort_order: sortOrder, is_active: accountForm.is_active, is_favorite: accountForm.is_favorite, close_day_type: isCard ? accountForm.close_day_type : null, close_day: isCard ? closeDay : null, pay_month_offset: isCard ? payMonthOffset : null, pay_day_type: isCard ? accountForm.pay_day_type : null, pay_day: isCard ? payDay : null };
      const result = accountForm.id ? await supabase.from("accounts").update(payload).eq("id", accountForm.id) : await supabase.from("accounts").insert(payload);
      if (result.error) { setErrorMessage(result.error.message); return; }
      setInfoMessage(accountForm.id ? "支払方法を更新しました。" : "支払方法を追加しました。");
      resetAccountForm(); await loadData();
    } finally { setSaving(false); }
  }

  async function toggleCategoryActive(row: CategoryRow) {
    setErrorMessage(""); setInfoMessage("");
    const result = await supabase.from("categories").update({ is_active: !row.is_active }).eq("id", row.id);
    if (result.error) { setErrorMessage(result.error.message); return; }
    setInfoMessage(row.is_active ? "科目を使用停止にしました。" : "科目を再度有効化しました。");
    await loadData();
  }

  async function toggleCounterpartyActive(row: CounterpartyRow) {
    setErrorMessage(""); setInfoMessage("");
    const result = await supabase.from("counterparties").update({ is_active: !row.is_active }).eq("id", row.id);
    if (result.error) { setErrorMessage(result.error.message); return; }
    setInfoMessage(row.is_active ? "相手先を使用停止にしました。" : "相手先を再度有効化しました。");
    await loadData();
  }

  async function toggleAccountActive(row: AccountRow) {
    setErrorMessage(""); setInfoMessage("");
    const result = await supabase.from("accounts").update({ is_active: !row.is_active }).eq("id", row.id);
    if (result.error) { setErrorMessage(result.error.message); return; }
    setInfoMessage(row.is_active ? "支払方法を使用停止にしました。" : "支払方法を再度有効化しました。");
    await loadData();
  }

  const visibleCategories    = categories.filter((r) => (categoryFilterKind === "all" || r.kind === categoryFilterKind) && (!categorySearch || r.name.includes(categorySearch)));
  const visibleCounterparties = counterparties.filter((r) => (counterpartyFilterKind === "all" || r.kind === counterpartyFilterKind) && (!counterpartySearch || r.name.includes(counterpartySearch)));
  const visibleAccounts      = accounts.filter((r) => (accountFilterType === "all" || r.account_type === accountFilterType) && (!accountSearch || r.name.includes(accountSearch)));
  const selectableDefaultCategories = categories.filter((r) => counterpartyForm.kind !== "both" && r.kind === counterpartyForm.kind);

  const kindLabel = (k: string) => k === "expense" ? "出金" : k === "income" ? "入金" : "両方";
  const accountTypeLabel = (t: string) => t === "cash" ? "現金" : t === "bank" ? "銀行" : "カード";

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-heading">
          <div>
            <h1 className="page-title">マスタ管理</h1>
            <p className="page-subtitle">科目・相手先・支払方法を管理します</p>
          </div>
        </div>

        {errorMessage && <div className="alert alert-error">{errorMessage}</div>}
        {infoMessage  && <div className="alert alert-success">{infoMessage}</div>}

        <div className="tab-list">
          {(["categories", "counterparties", "accounts"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`tab-btn${activeTab === tab ? " active" : ""}`}>
              {tab === "categories" ? "科目" : tab === "counterparties" ? "相手先" : "支払方法"}
            </button>
          ))}
        </div>

        {/* ── Categories ── */}
        {activeTab === "categories" && (
          <div className="split-layout">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">{categoryForm.id ? "科目を編集" : "科目を追加"}</h2>
                {categoryForm.id && <button type="button" onClick={resetCategoryForm} className="btn btn-ghost btn-sm">クリア</button>}
              </div>
              <div className="card-body">
                <form onSubmit={handleSaveCategory} className="form-grid">
                  <div className="field">
                    <label className="field-label">種別</label>
                    <select value={categoryForm.kind} onChange={(e) => setCategoryForm((p) => ({ ...p, kind: e.target.value as "income"|"expense" }))} className="field-input">
                      <option value="expense">出金</option>
                      <option value="income">入金</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">科目名</label>
                    <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} className="field-input" />
                  </div>
                  <div className="field">
                    <label className="field-label">表示順</label>
                    <input type="number" value={categoryForm.sort_order} onChange={(e) => setCategoryForm((p) => ({ ...p, sort_order: e.target.value }))} className="field-input" />
                  </div>
                  <label className="field-check"><input type="checkbox" checked={categoryForm.is_favorite} onChange={(e) => setCategoryForm((p) => ({ ...p, is_favorite: e.target.checked }))} />よく使う</label>
                  <label className="field-check"><input type="checkbox" checked={categoryForm.is_active} onChange={(e) => setCategoryForm((p) => ({ ...p, is_active: e.target.checked }))} />使用中</label>
                  <button type="submit" disabled={saving || loading} className="btn btn-primary">
                    {saving ? "保存中..." : categoryForm.id ? "更新" : "追加"}
                  </button>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">科目一覧</h2>
              </div>
              <div className="card-body">
                <div className="filter-bar">
                  <input type="text" placeholder="科目名で検索" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="field-input" />
                  <select value={categoryFilterKind} onChange={(e) => setCategoryFilterKind(e.target.value as "all"|"income"|"expense")} className="field-input" style={{ flex: "none", width: "auto" }}>
                    <option value="all">全種別</option><option value="expense">出金</option><option value="income">入金</option>
                  </select>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {visibleCategories.map((row) => (
                    <div key={row.id} className={`master-item${row.is_active ? "" : " inactive"}`}>
                      <div>
                        <div className="master-item-name">{row.is_favorite ? "★ " : ""}{row.name}</div>
                        <div className="master-item-meta">
                          <span className={`badge ${row.kind === "expense" ? "badge-expense" : "badge-income"}`}>{kindLabel(row.kind)}</span>
                          {" "}<span className={`badge ${row.is_active ? "badge-active" : "badge-inactive"}`}>{row.is_active ? "使用中" : "停止中"}</span>
                        </div>
                      </div>
                      <div className="btn-group">
                        <button type="button" onClick={() => setCategoryForm({ id: row.id, kind: row.kind, name: row.name, sort_order: String(row.sort_order), is_active: row.is_active, is_favorite: row.is_favorite })} className="btn btn-secondary btn-sm">編集</button>
                        <button type="button" onClick={() => toggleCategoryActive(row)} className="btn btn-ghost btn-sm">{row.is_active ? "停止" : "有効化"}</button>
                      </div>
                    </div>
                  ))}
                  {!loading && visibleCategories.length === 0 && <p className="empty-state">該当データがありません。</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Counterparties ── */}
        {activeTab === "counterparties" && (
          <div className="split-layout">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">{counterpartyForm.id ? "相手先を編集" : "相手先を追加"}</h2>
                {counterpartyForm.id && <button type="button" onClick={resetCounterpartyForm} className="btn btn-ghost btn-sm">クリア</button>}
              </div>
              <div className="card-body">
                <form onSubmit={handleSaveCounterparty} className="form-grid">
                  <div className="field">
                    <label className="field-label">種別</label>
                    <select value={counterpartyForm.kind} onChange={(e) => setCounterpartyForm((p) => ({ ...p, kind: e.target.value as "income"|"expense"|"both", default_category_id: "" }))} className="field-input">
                      <option value="expense">出金</option><option value="income">入金</option><option value="both">両方</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">相手先名</label>
                    <input type="text" value={counterpartyForm.name} onChange={(e) => setCounterpartyForm((p) => ({ ...p, name: e.target.value }))} className="field-input" />
                  </div>
                  <div className="field">
                    <label className="field-label">表示順</label>
                    <input type="number" value={counterpartyForm.sort_order} onChange={(e) => setCounterpartyForm((p) => ({ ...p, sort_order: e.target.value }))} className="field-input" />
                  </div>
                  <div className="field">
                    <label className="field-label">デフォルト科目</label>
                    <select value={counterpartyForm.default_category_id} disabled={counterpartyForm.kind === "both"} onChange={(e) => setCounterpartyForm((p) => ({ ...p, default_category_id: e.target.value }))} className="field-input">
                      <option value="">未設定</option>
                      {selectableDefaultCategories.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <label className="field-check"><input type="checkbox" checked={counterpartyForm.is_favorite} onChange={(e) => setCounterpartyForm((p) => ({ ...p, is_favorite: e.target.checked }))} />よく使う</label>
                  <label className="field-check"><input type="checkbox" checked={counterpartyForm.is_active} onChange={(e) => setCounterpartyForm((p) => ({ ...p, is_active: e.target.checked }))} />使用中</label>
                  <button type="submit" disabled={saving || loading} className="btn btn-primary">
                    {saving ? "保存中..." : counterpartyForm.id ? "更新" : "追加"}
                  </button>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">相手先一覧</h2>
              </div>
              <div className="card-body">
                <div className="filter-bar">
                  <input type="text" placeholder="相手先名で検索" value={counterpartySearch} onChange={(e) => setCounterpartySearch(e.target.value)} className="field-input" />
                  <select value={counterpartyFilterKind} onChange={(e) => setCounterpartyFilterKind(e.target.value as "all"|"income"|"expense"|"both")} className="field-input" style={{ flex: "none", width: "auto" }}>
                    <option value="all">全種別</option><option value="expense">出金</option><option value="income">入金</option><option value="both">両方</option>
                  </select>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {visibleCounterparties.map((row) => {
                    const defCat = categories.find((x) => x.id === row.default_category_id);
                    return (
                      <div key={row.id} className={`master-item${row.is_active ? "" : " inactive"}`}>
                        <div>
                          <div className="master-item-name">{row.is_favorite ? "★ " : ""}{row.name}</div>
                          <div className="master-item-meta">
                            <span className={`badge ${row.kind === "expense" ? "badge-expense" : row.kind === "income" ? "badge-income" : "badge-cash"}`}>{kindLabel(row.kind)}</span>
                            {" "}<span className={`badge ${row.is_active ? "badge-active" : "badge-inactive"}`}>{row.is_active ? "使用中" : "停止中"}</span>
                            {defCat && <span style={{ marginLeft: 4, color: "var(--text-3)", fontSize: 12 }}>既定: {defCat.name}</span>}
                          </div>
                        </div>
                        <div className="btn-group">
                          <button type="button" onClick={() => setCounterpartyForm({ id: row.id, kind: row.kind, name: row.name, sort_order: String(row.sort_order), is_active: row.is_active, is_favorite: row.is_favorite, default_category_id: row.default_category_id ?? "" })} className="btn btn-secondary btn-sm">編集</button>
                          <button type="button" onClick={() => toggleCounterpartyActive(row)} className="btn btn-ghost btn-sm">{row.is_active ? "停止" : "有効化"}</button>
                        </div>
                      </div>
                    );
                  })}
                  {!loading && visibleCounterparties.length === 0 && <p className="empty-state">該当データがありません。</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Accounts ── */}
        {activeTab === "accounts" && (
          <div className="split-layout">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">{accountForm.id ? "支払方法を編集" : "支払方法を追加"}</h2>
                {accountForm.id && <button type="button" onClick={resetAccountForm} className="btn btn-ghost btn-sm">クリア</button>}
              </div>
              <div className="card-body">
                <form onSubmit={handleSaveAccount} className="form-grid">
                  <div className="field">
                    <label className="field-label">名称</label>
                    <input type="text" value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} className="field-input" />
                  </div>
                  <div className="field">
                    <label className="field-label">種別</label>
                    <select value={accountForm.account_type} onChange={(e) => setAccountForm((p) => ({ ...p, account_type: e.target.value as "cash"|"bank"|"card" }))} className="field-input">
                      <option value="cash">現金</option><option value="bank">銀行</option><option value="card">カード</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">表示順</label>
                    <input type="number" value={accountForm.sort_order} onChange={(e) => setAccountForm((p) => ({ ...p, sort_order: e.target.value }))} className="field-input" />
                  </div>
                  {accountForm.account_type === "card" && (
                    <>
                      <div className="field">
                        <label className="field-label">締め日種別</label>
                        <select value={accountForm.close_day_type} onChange={(e) => setAccountForm((p) => ({ ...p, close_day_type: e.target.value as "fixed"|"month_end" }))} className="field-input">
                          <option value="month_end">月末</option><option value="fixed">固定日</option>
                        </select>
                      </div>
                      {accountForm.close_day_type === "fixed" && (
                        <div className="field">
                          <label className="field-label">締め日</label>
                          <input type="number" min="1" max="31" value={accountForm.close_day} onChange={(e) => setAccountForm((p) => ({ ...p, close_day: e.target.value }))} className="field-input" />
                        </div>
                      )}
                      <div className="field">
                        <label className="field-label">支払月ずれ</label>
                        <input type="number" min="0" value={accountForm.pay_month_offset} onChange={(e) => setAccountForm((p) => ({ ...p, pay_month_offset: e.target.value }))} className="field-input" />
                      </div>
                      <div className="field">
                        <label className="field-label">支払日種別</label>
                        <select value={accountForm.pay_day_type} onChange={(e) => setAccountForm((p) => ({ ...p, pay_day_type: e.target.value as "fixed"|"month_end" }))} className="field-input">
                          <option value="fixed">固定日</option><option value="month_end">月末</option>
                        </select>
                      </div>
                      {accountForm.pay_day_type === "fixed" && (
                        <div className="field">
                          <label className="field-label">支払日</label>
                          <input type="number" min="1" max="31" value={accountForm.pay_day} onChange={(e) => setAccountForm((p) => ({ ...p, pay_day: e.target.value }))} className="field-input" />
                        </div>
                      )}
                    </>
                  )}
                  <label className="field-check"><input type="checkbox" checked={accountForm.is_favorite} onChange={(e) => setAccountForm((p) => ({ ...p, is_favorite: e.target.checked }))} />よく使う</label>
                  <label className="field-check"><input type="checkbox" checked={accountForm.is_active} onChange={(e) => setAccountForm((p) => ({ ...p, is_active: e.target.checked }))} />使用中</label>
                  <button type="submit" disabled={saving || loading} className="btn btn-primary">
                    {saving ? "保存中..." : accountForm.id ? "更新" : "追加"}
                  </button>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">支払方法一覧</h2>
              </div>
              <div className="card-body">
                <div className="filter-bar">
                  <input type="text" placeholder="名称で検索" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} className="field-input" />
                  <select value={accountFilterType} onChange={(e) => setAccountFilterType(e.target.value as "all"|"cash"|"bank"|"card")} className="field-input" style={{ flex: "none", width: "auto" }}>
                    <option value="all">全種別</option><option value="cash">現金</option><option value="bank">銀行</option><option value="card">カード</option>
                  </select>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {visibleAccounts.map((row) => (
                    <div key={row.id} className={`master-item${row.is_active ? "" : " inactive"}`}>
                      <div>
                        <div className="master-item-name">{row.is_favorite ? "★ " : ""}{row.name}</div>
                        <div className="master-item-meta">
                          <span className={`badge badge-${row.account_type}`}>{accountTypeLabel(row.account_type)}</span>
                          {" "}<span className={`badge ${row.is_active ? "badge-active" : "badge-inactive"}`}>{row.is_active ? "使用中" : "停止中"}</span>
                          {row.account_type === "card" && (
                            <span style={{ marginLeft: 4, color: "var(--text-3)", fontSize: 12 }}>
                              締: {row.close_day_type === "month_end" ? "月末" : `${row.close_day}日`} / 支払: {row.pay_month_offset}か月後 {row.pay_day_type === "month_end" ? "月末" : `${row.pay_day}日`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="btn-group">
                        <button type="button" onClick={() => setAccountForm({ id: row.id, name: row.name, account_type: row.account_type, sort_order: String(row.sort_order), is_active: row.is_active, is_favorite: row.is_favorite, close_day_type: row.close_day_type ?? "month_end", close_day: row.close_day ? String(row.close_day) : "", pay_month_offset: row.pay_month_offset != null ? String(row.pay_month_offset) : "1", pay_day_type: row.pay_day_type ?? "fixed", pay_day: row.pay_day ? String(row.pay_day) : "27" })} className="btn btn-secondary btn-sm">編集</button>
                        <button type="button" onClick={() => toggleAccountActive(row)} className="btn btn-ghost btn-sm">{row.is_active ? "停止" : "有効化"}</button>
                      </div>
                    </div>
                  ))}
                  {!loading && visibleAccounts.length === 0 && <p className="empty-state">該当データがありません。</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
