"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeCardDueDate, firstDayOfMonth, type AccountRule } from "@/lib/money";

type CategoryRow = {
  id: string;
  kind: "income" | "expense";
  name: string;
  is_favorite: boolean;
  sort_order: number;
};

type CounterpartyRow = {
  id: string;
  kind: "income" | "expense" | "both";
  name: string;
  is_favorite: boolean;
  sort_order: number;
  default_category_id: string | null;
};

type AccountRow = {
  id: string;
  account_type: "cash" | "bank" | "card";
  name: string;
  is_favorite: boolean;
  sort_order: number;
  close_day_type: "fixed" | "month_end" | null;
  close_day: number | null;
  pay_month_offset: number | null;
  pay_day_type: "fixed" | "month_end" | null;
  pay_day: number | null;
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function compareRows<
  T extends {
    is_favorite?: boolean;
    sort_order?: number;
    name?: string;
  }
>(a: T, b: T) {
  const af = a.is_favorite ? 1 : 0;
  const bf = b.is_favorite ? 1 : 0;
  if (af !== bf) return bf - af;

  const as = a.sort_order ?? 0;
  const bs = b.sort_order ?? 0;
  if (as !== bs) return as - bs;

  return (a.name ?? "").localeCompare(b.name ?? "", "ja");
}

export default function NewTransactionPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  const [txDate, setTxDate] = useState(todayYmd());
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
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

      const [
        { data: catData, error: catError },
        { data: cpData, error: cpError },
        { data: accData, error: accError },
      ] = await Promise.all([
        supabase
          .from("categories")
          .select("id, kind, name, is_favorite, sort_order")
          .eq("is_active", true),
        supabase
          .from("counterparties")
          .select("id, kind, name, is_favorite, sort_order, default_category_id")
          .eq("is_active", true),
        supabase
          .from("accounts")
          .select(
            "id, account_type, name, is_favorite, sort_order, close_day_type, close_day, pay_month_offset, pay_day_type, pay_day"
          )
          .eq("is_active", true),
      ]);

      if (!mounted) return;

      if (catError || cpError || accError) {
        setErrorMessage("マスタデータの読込でエラーが発生しました。");
        setLoading(false);
        return;
      }

      setCategories([...(catData ?? [])].sort(compareRows) as CategoryRow[]);
      setCounterparties([...(cpData ?? [])].sort(compareRows) as CounterpartyRow[]);
      setAccounts([...(accData ?? [])].sort(compareRows) as AccountRow[]);
      setLoading(false);
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

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

      const numericAmount = Number(amount);

      if (!txDate) {
        setErrorMessage("日付を入力してください。");
        return;
      }

      if (Number.isNaN(numericAmount) || numericAmount <= 0) {
        setErrorMessage("金額は1以上の数値で入力してください。");
        return;
      }

      if (!accountId) {
        setErrorMessage("現金/銀行/カードを選択してください。");
        return;
      }

      const selectedAccount = accounts.find((x) => x.id === accountId);
      if (!selectedAccount) {
        setErrorMessage("選択された支払方法が見つかりません。");
        return;
      }

      const cardDueDate =
        txType === "expense"
          ? computeCardDueDate(txDate, selectedAccount as AccountRule)
          : null;

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        tx_date: txDate,
        target_month: firstDayOfMonth(txDate),
        tx_type: txType,
        amount: numericAmount,
        category_id: categoryId || null,
        counterparty_id: counterpartyId || null,
        account_id: accountId,
        memo: memo.trim() || null,
        card_due_date: cardDueDate,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setInfoMessage("出入金を保存しました。");
      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  }

  const filteredCategories = categories.filter((x) => x.kind === txType);
  const filteredCounterparties = counterparties.filter(
    (x) => x.kind === txType || x.kind === "both"
  );

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link href="/">← 戻る</Link>
        <Link href="/masters">マスタ管理</Link>
      </div>

      <div style={{ background: "#fff", padding: 24, borderRadius: 12 }}>
        <h1>出入金入力</h1>

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
            日付
            <br />
            <input
              name="tx_date"
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              required
              style={{ padding: 10, fontSize: 16 }}
            />
          </label>

          <label>
            種別
            <br />
            <select
              name="tx_type"
              value={txType}
              onChange={(e) => {
                const value = e.target.value as "income" | "expense";
                setTxType(value);
                setCategoryId("");
                setCounterpartyId("");
              }}
              style={{ padding: 10, fontSize: 16 }}
            >
              <option value="expense">出金</option>
              <option value="income">入金</option>
            </select>
          </label>

          <label>
            金額
            <br />
            <input
              name="amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              style={{ padding: 10, fontSize: 16 }}
            />
          </label>

          <label>
            科目
            <br />
            <select
              name="category_id"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ padding: 10, fontSize: 16 }}
            >
              <option value="">未選択</option>
              {filteredCategories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.is_favorite ? "★ " : ""}
                  {row.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            相手先
            <br />
            <select
              name="counterparty_id"
              value={counterpartyId}
              onChange={(e) => {
                const value = e.target.value;
                setCounterpartyId(value);

                const selected = filteredCounterparties.find((x) => x.id === value);
                if (
                  selected?.default_category_id &&
                  filteredCategories.some((x) => x.id === selected.default_category_id)
                ) {
                  setCategoryId(selected.default_category_id);
                }
              }}
              style={{ padding: 10, fontSize: 16 }}
            >
              <option value="">未選択</option>
              {filteredCounterparties.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.is_favorite ? "★ " : ""}
                  {row.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            現金/銀行/カード
            <br />
            <select
              name="account_id"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              style={{ padding: 10, fontSize: 16 }}
            >
              <option value="">選択してください</option>
              {accounts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.is_favorite ? "★ " : ""}
                  [{row.account_type}] {row.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            メモ
            <br />
            <textarea
              name="memo"
              rows={4}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              style={{ padding: 10, fontSize: 16, resize: "vertical" }}
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

        {!loading && filteredCategories.length === 0 && (
          <div style={{ marginTop: 16, fontSize: 14, color: "#666" }}>
            この種別の科目がまだ登録されていません。
          </div>
        )}

        {!loading && filteredCounterparties.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
            この種別の相手先がまだ登録されていません。
          </div>
        )}

        {!loading && accounts.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
            支払方法がまだ登録されていません。
          </div>
        )}
      </div>
    </main>
  );
}