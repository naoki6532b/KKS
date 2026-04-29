"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeCardDueDate, firstDayOfMonth, type AccountRule } from "@/lib/money";
import { CURRENCIES, fetchRateToJPY } from "@/lib/exchange";
import { Header } from "@/app/components/header";
import { ComboInput } from "@/app/components/combo-input";

type CategoryRow     = { id: string; kind: "income"|"expense"; name: string; is_favorite: boolean; sort_order: number };
type CounterpartyRow = { id: string; kind: "income"|"expense"|"both"; name: string; is_favorite: boolean; sort_order: number; default_category_id: string|null };
type AccountRow      = { id: string; account_type: "cash"|"bank"|"card"; name: string; is_favorite: boolean; sort_order: number; close_day_type: "fixed"|"month_end"|null; close_day: number|null; pay_month_offset: number|null; pay_day_type: "fixed"|"month_end"|null; pay_day: number|null };

function compareRows<T extends { is_favorite?: boolean; sort_order?: number; name?: string }>(a: T, b: T) {
  const af = a.is_favorite ? 1 : 0, bf = b.is_favorite ? 1 : 0;
  if (af !== bf) return bf - af;
  const as = a.sort_order ?? 0, bs = b.sort_order ?? 0;
  if (as !== bs) return as - bs;
  return (a.name ?? "").localeCompare(b.name ?? "", "ja");
}

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const txId   = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [categories, setCategories]         = useState<CategoryRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [accounts, setAccounts]             = useState<AccountRow[]>([]);
  const [pastCpNames, setPastCpNames]       = useState<string[]>([]);

  const [txDate, setTxDate]                   = useState("");
  const [txType, setTxType]                   = useState<"income"|"expense">("expense");
  const [amount, setAmount]                   = useState("");
  const [currency, setCurrency]               = useState("JPY");
  const [exchangeRate, setExchangeRate]       = useState<number | null>(null);
  const [rateFetching, setRateFetching]       = useState(false);
  const [rateError, setRateError]             = useState("");
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

      const [{ data: txData, error: txError }, { data: catData, error: catError }, { data: cpData, error: cpError }, { data: accData, error: accError }, { data: nameData }] = await Promise.all([
        supabase.from("transactions").select("id, tx_date, tx_type, amount, currency, currency_amount, item_name, category_id, counterparty_id, counterparty_name, account_id, memo").eq("id", txId).eq("user_id", user.id).single(),
        supabase.from("categories").select("id, kind, name, is_favorite, sort_order").eq("is_active", true),
        supabase.from("counterparties").select("id, kind, name, is_favorite, sort_order, default_category_id").eq("is_active", true),
        supabase.from("accounts").select("id, account_type, name, is_favorite, sort_order, close_day_type, close_day, pay_month_offset, pay_day_type, pay_day").eq("is_active", true),
        supabase.from("transactions").select("counterparty_name").not("counterparty_name", "is", null).eq("user_id", user.id),
      ]);
      if (!mounted) return;
      if (txError || catError || cpError || accError) {
        setErrorMessage(txError ? "取引データが見つかりません。" : "マスタデータの読込でエラーが発生しました。");
        setLoading(false);
        return;
      }
      const tx = txData as Record<string, unknown>;
      const cur = (tx.currency as string) ?? "JPY";
      setTxDate(txData.tx_date);
      setTxType(txData.tx_type as "income"|"expense");
      setCurrency(cur);
      // Display in original currency if foreign, otherwise JPY amount
      setAmount(cur !== "JPY" && tx.currency_amount ? String(tx.currency_amount) : String(txData.amount));
      setItemName((tx.item_name as string) ?? "");
      setCategoryId(txData.category_id ?? "");
      setCounterpartyId(txData.counterparty_id ?? "");
      setCounterpartyName((tx.counterparty_name as string) ?? "");
      setAccountId(txData.account_id ?? "");
      setMemo(txData.memo ?? "");
      setCategories([...(catData ?? [])].sort(compareRows) as CategoryRow[]);
      setCounterparties([...(cpData ?? [])].sort(compareRows) as CounterpartyRow[]);
      setAccounts([...(accData ?? [])].sort(compareRows) as AccountRow[]);
      setPastCpNames([...new Set((nameData ?? []).map((r: { counterparty_name: string | null }) => r.counterparty_name).filter(Boolean))] as string[]);
      setLoading(false);
    }
    loadData();
    return () => { mounted = false; };
  }, [router, supabase, txId]);

  useEffect(() => {
    if (currency === "JPY") { setExchangeRate(1); setRateError(""); return; }
    if (!txDate) return;
    let cancelled = false;
    setRateFetching(true);
    setRateError("");
    setExchangeRate(null);
    fetchRateToJPY(currency, txDate).then((rate) => {
      if (!cancelled) { setExchangeRate(rate); setRateFetching(false); }
    }).catch((err: Error) => {
      if (!cancelled) { setRateError(err.message); setRateFetching(false); }
    });
    return () => { cancelled = true; };
  }, [currency, txDate]);

  const foreignAmount = Number(amount);
  const jpyAmount = currency === "JPY" ? foreignAmount : (exchangeRate ? Math.round(foreignAmount * exchangeRate) : null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/login"); router.refresh(); return; }
      if (!txDate) { setErrorMessage("日付を入力してください。"); return; }
      if (Number.isNaN(foreignAmount) || foreignAmount <= 0) { setErrorMessage("金額は1以上の数値で入力してください。"); return; }
      if (currency !== "JPY" && !exchangeRate) { setErrorMessage("為替レートの取得を待ってください。"); return; }
      if (!accountId) { setErrorMessage("現金/銀行/カードを選択してください。"); return; }
      const selectedAccount = accounts.find((x) => x.id === accountId);
      if (!selectedAccount) { setErrorMessage("選択された支払方法が見つかりません。"); return; }
      const finalJpy = jpyAmount ?? 0;
      const cardDueDate = txType === "expense" ? computeCardDueDate(txDate, selectedAccount as AccountRule) : null;
      const { error } = await supabase.from("transactions").update({
        tx_date: txDate, target_month: firstDayOfMonth(txDate), tx_type: txType,
        amount: finalJpy,
        currency, currency_amount: currency !== "JPY" ? foreignAmount : null,
        exchange_rate: currency !== "JPY" ? exchangeRate : null,
        category_id: categoryId || null,
        counterparty_id: counterpartyId || null,
        counterparty_name: counterpartyName.trim() || null,
        account_id: accountId,
        item_name: itemName.trim() || null, memo: memo.trim() || null, card_due_date: cardDueDate,
      }).eq("id", txId).eq("user_id", user.id);
      if (error) { setErrorMessage(error.message); return; }
      router.push("/transactions");
      router.refresh();
    } catch {
      setErrorMessage("保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("この取引を削除しますか？")) return;
    setDeleting(true);
    setErrorMessage("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/login"); router.refresh(); return; }
      const { error } = await supabase.from("transactions").delete().eq("id", txId).eq("user_id", user.id);
      if (error) { setErrorMessage(error.message); return; }
      router.push("/transactions");
      router.refresh();
    } catch {
      setErrorMessage("削除中にエラーが発生しました。");
    } finally {
      setDeleting(false);
    }
  }

  const filteredCategories     = categories.filter((x) => x.kind === txType);
  const filteredCounterparties = counterparties.filter((x) => x.kind === txType || x.kind === "both");
  const currencyInfo = CURRENCIES.find((c) => c.code === currency);

  return (
    <>
      <Header />
      <main className="page-sm">
        <div className="page-heading">
          <h1 className="page-title">取引訂正</h1>
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
                <select value={txType} onChange={(e) => { setTxType(e.target.value as "income"|"expense"); setCategoryId(""); setCounterpartyId(""); }} className="field-input">
                  <option value="expense">出金</option>
                  <option value="income">入金</option>
                </select>
              </div>

              <div className="field">
                <label className="field-label">通貨</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field-input">
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="field-label">金額{currencyInfo && currency !== "JPY" ? `（${currencyInfo.symbol}）` : "（円）"}</label>
                <input type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required className="field-input" />
                {currency !== "JPY" && (
                  <div style={{ marginTop: 4, fontSize: 12, color: rateError ? "var(--red)" : "var(--text-3)" }}>
                    {rateFetching && "為替レート取得中..."}
                    {rateError && rateError}
                    {!rateFetching && !rateError && exchangeRate && (
                      <>1 {currency} = {Math.round(exchangeRate).toLocaleString()} 円
                        {amount && !Number.isNaN(foreignAmount) && foreignAmount > 0 && (
                          <> &nbsp;→&nbsp; <strong style={{ color: "var(--sapphire)" }}>≈ {(jpyAmount ?? 0).toLocaleString()} 円</strong></>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="field">
                <label className="field-label">品名 / 名称 <span style={{ fontWeight:400, color:"var(--text-4)", fontSize:11 }}>（任意）</span></label>
                <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="field-input" placeholder="例: 電気代、Amazonプライム" />
              </div>

              <div className="field">
                <label className="field-label">科目</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field-input">
                  <option value="">未選択</option>
                  {filteredCategories.map((r) => <option key={r.id} value={r.id}>{r.is_favorite ? "★ " : ""}{r.name}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="field-label">相手先ジャンル <span style={{ fontWeight:400, color:"var(--text-4)", fontSize:11 }}>（任意）</span></label>
                <select value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)} className="field-input">
                  <option value="">未選択</option>
                  {filteredCounterparties.map((r) => <option key={r.id} value={r.id}>{r.is_favorite ? "★ " : ""}{r.name}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="field-label">相手先名 <span style={{ fontWeight:400, color:"var(--text-4)", fontSize:11 }}>（任意）</span></label>
                <ComboInput value={counterpartyName} onChange={setCounterpartyName} suggestions={pastCpNames} placeholder="例: イオン、東京電力" className="field-input" />
              </div>

              <div className="field">
                <label className="field-label">現金 / 銀行 / カード</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required className="field-input">
                  <option value="">選択してください</option>
                  {accounts.map((r) => <option key={r.id} value={r.id}>{r.is_favorite ? "★ " : ""}[{r.account_type}] {r.name}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="field-label">メモ</label>
                <textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} className="field-input" style={{ resize: "vertical" }} />
              </div>

              <div className="btn-group">
                <button type="submit" disabled={loading || saving || deleting || rateFetching} className="btn btn-primary" style={{ flex: 1 }}>
                  {loading ? "読込中..." : saving ? "保存中..." : rateFetching ? "レート取得中..." : "保存する"}
                </button>
                <button type="button" onClick={handleDelete} disabled={loading || saving || deleting} className="btn btn-danger">
                  {deleting ? "削除中..." : "削除"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
