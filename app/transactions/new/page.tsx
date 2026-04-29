"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeCardDueDate, firstDayOfMonth, type AccountRule } from "@/lib/money";
import { Header } from "@/app/components/header";

type CategoryRow    = { id: string; kind: "income"|"expense"; name: string; is_favorite: boolean; sort_order: number };
type CounterpartyRow = { id: string; kind: "income"|"expense"|"both"; name: string; is_favorite: boolean; sort_order: number; default_category_id: string | null };
type AccountRow     = { id: string; account_type: "cash"|"bank"|"card"; name: string; is_favorite: boolean; sort_order: number; close_day_type: "fixed"|"month_end"|null; close_day: number|null; pay_month_offset: number|null; pay_day_type: "fixed"|"month_end"|null; pay_day: number|null };

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function compareRows<T extends { is_favorite?: boolean; sort_order?: number; name?: string }>(a: T, b: T) {
  const af = a.is_favorite ? 1 : 0, bf = b.is_favorite ? 1 : 0;
  if (af !== bf) return bf - af;
  const as = a.sort_order ?? 0, bs = b.sort_order ?? 0;
  if (as !== bs) return as - bs;
  return (a.name ?? "").localeCompare(b.name ?? "", "ja");
}

export default function NewTransactionPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [categories, setCategories]         = useState<CategoryRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [accounts, setAccounts]             = useState<AccountRow[]>([]);

  const [txDate, setTxDate]                   = useState(todayYmd());
  const [txType, setTxType]                   = useState<"income"|"expense">("expense");
  const [amount, setAmount]                   = useState("");
  const [itemName, setItemName]               = useState("");
  const [categoryId, setCategoryId]           = useState("");
  const [counterpartyId, setCounterpartyId]   = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [accountId, setAccountId]             = useState("");
  const [memo, setMemo]                       = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/login"); router.refresh(); return; }

      const [{ data: catData, error: catError }, { data: cpData, error: cpError }, { data: accData, error: accError }] = await Promise.all([
        supabase.from("categories").select("id, kind, name, is_favorite, sort_order").eq("is_active", true),
        supabase.from("counterparties").select("id, kind, name, is_favorite, sort_order, default_category_id").eq("is_active", true),
        supabase.from("accounts").select("id, account_type, name, is_favorite, sort_order, close_day_type, close_day, pay_month_offset, pay_day_type, pay_day").eq("is_active", true),
      ]);
      if (!mounted) return;
      if (catError || cpError || accError) { setErrorMessage("マスタデータの読込でエラーが発生しました。"); setLoading(false); return; }
      setCategories([...(catData ?? [])].sort(compareRows) as CategoryRow[]);
      setCounterparties([...(cpData ?? [])].sort(compareRows) as CounterpartyRow[]);
      setAccounts([...(accData ?? [])].sort(compareRows) as AccountRow[]);
      setLoading(false);
    }
    loadData();
    return () => { mounted = false; };
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/login"); router.refresh(); return; }
      const numericAmount = Number(amount);
      if (!txDate) { setErrorMessage("日付を入力してください。"); return; }
      if (Number.isNaN(numericAmount) || numericAmount <= 0) { setErrorMessage("金額は1以上の数値で入力してください。"); return; }
      if (!accountId) { setErrorMessage("現金/銀行/カードを選択してください。"); return; }
      const selectedAccount = accounts.find((x) => x.id === accountId);
      if (!selectedAccount) { setErrorMessage("選択された支払方法が見つかりません。"); return; }
      const cardDueDate = txType === "expense" ? computeCardDueDate(txDate, selectedAccount as AccountRule) : null;
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id, tx_date: txDate, target_month: firstDayOfMonth(txDate),
        tx_type: txType, amount: numericAmount,
        category_id: categoryId || null, counterparty_id: counterpartyId || null,
        counterparty_name: counterpartyName.trim() || null,
        account_id: accountId, item_name: itemName.trim() || null, memo: memo.trim() || null, card_due_date: cardDueDate,
      });
      if (error) { setErrorMessage(error.message); return; }
      router.push("/transactions");
      router.refresh();
    } catch {
      setErrorMessage("保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  }

  const filteredCategories    = categories.filter((x) => x.kind === txType);
  const filteredCounterparties = counterparties.filter((x) => x.kind === txType || x.kind === "both");

  return (
    <>
      <Header />
      <main className="page-sm">
        <div className="page-heading">
          <h1 className="page-title">出入金入力</h1>
        </div>

        <div className="card">
          <div className="card-body">
            {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

            <form onSubmit={handleSubmit} className="form-grid">
              <div className="field">
                <label className="field-label">日付</label>
                <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required className="field-input" />
              </div>

              <div className="field">
                <label className="field-label">種別</label>
                <select
                  value={txType}
                  onChange={(e) => { setTxType(e.target.value as "income"|"expense"); setCategoryId(""); setCounterpartyId(""); }}
                  className="field-input"
                >
                  <option value="expense">出金</option>
                  <option value="income">入金</option>
                </select>
              </div>

              <div className="field">
                <label className="field-label">金額（円）</label>
                <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required className="field-input" placeholder="例: 3500" />
              </div>

              <div className="field">
                <label className="field-label">品名 / 名称 <span style={{ fontWeight:400, color:"var(--text-4)", fontSize:11 }}>（任意）</span></label>
                <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="field-input" placeholder="例: 電気代、Amazonプライム" />
              </div>

              <div className="field">
                <label className="field-label">科目</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field-input">
                  <option value="">未選択</option>
                  {filteredCategories.map((r) => (
                    <option key={r.id} value={r.id}>{r.is_favorite ? "★ " : ""}{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label">相手先ジャンル <span style={{ fontWeight:400, color:"var(--text-4)", fontSize:11 }}>（任意）</span></label>
                <select
                  value={counterpartyId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCounterpartyId(v);
                    const sel = filteredCounterparties.find((x) => x.id === v);
                    if (sel?.default_category_id && filteredCategories.some((x) => x.id === sel.default_category_id)) {
                      setCategoryId(sel.default_category_id);
                    }
                  }}
                  className="field-input"
                >
                  <option value="">未選択</option>
                  {filteredCounterparties.map((r) => (
                    <option key={r.id} value={r.id}>{r.is_favorite ? "★ " : ""}{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label">相手先名 <span style={{ fontWeight:400, color:"var(--text-4)", fontSize:11 }}>（任意）</span></label>
                <input type="text" value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} className="field-input" placeholder="例: イオン、東京電力" />
              </div>

              <div className="field">
                <label className="field-label">現金 / 銀行 / カード</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required className="field-input">
                  <option value="">選択してください</option>
                  {accounts.map((r) => (
                    <option key={r.id} value={r.id}>{r.is_favorite ? "★ " : ""}[{r.account_type}] {r.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label">メモ</label>
                <textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} className="field-input" style={{ resize: "vertical" }} />
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
