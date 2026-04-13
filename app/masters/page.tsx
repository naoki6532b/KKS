"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MasterTab = "categories" | "counterparties" | "accounts";

type CategoryRow = {
  id: string;
  kind: "income" | "expense";
  name: string;
  sort_order: number;
  is_active: boolean;
  is_favorite: boolean;
};

type CounterpartyRow = {
  id: string;
  kind: "income" | "expense" | "both";
  name: string;
  sort_order: number;
  is_active: boolean;
  is_favorite: boolean;
  default_category_id: string | null;
};

type AccountRow = {
  id: string;
  name: string;
  account_type: "cash" | "bank" | "card";
  close_day_type: "fixed" | "month_end" | null;
  close_day: number | null;
  pay_month_offset: number | null;
  pay_day_type: "fixed" | "month_end" | null;
  pay_day: number | null;
  sort_order: number;
  is_active: boolean;
  is_favorite: boolean;
};

function compareMasterRows<
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

export default function MastersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<MasterTab>("categories");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  const [categorySearch, setCategorySearch] = useState("");
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");

  const [categoryFilterKind, setCategoryFilterKind] = useState<"all" | "income" | "expense">("all");
  const [counterpartyFilterKind, setCounterpartyFilterKind] = useState<
    "all" | "income" | "expense" | "both"
  >("all");
  const [accountFilterType, setAccountFilterType] = useState<"all" | "cash" | "bank" | "card">("all");

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    kind: "expense" as "income" | "expense",
    name: "",
    sort_order: "0",
    is_active: true,
    is_favorite: false,
  });

  const [counterpartyForm, setCounterpartyForm] = useState({
    id: "",
    kind: "expense" as "income" | "expense" | "both",
    name: "",
    sort_order: "0",
    is_active: true,
    is_favorite: false,
    default_category_id: "",
  });

  const [accountForm, setAccountForm] = useState({
    id: "",
    name: "",
    account_type: "cash" as "cash" | "bank" | "card",
    sort_order: "0",
    is_active: true,
    is_favorite: false,
    close_day_type: "month_end" as "fixed" | "month_end",
    close_day: "",
    pay_month_offset: "1",
    pay_day_type: "fixed" as "fixed" | "month_end",
    pay_day: "27",
  });

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
        .select("id, kind, name, sort_order, is_active, is_favorite"),
      supabase
        .from("counterparties")
        .select("id, kind, name, sort_order, is_active, is_favorite, default_category_id"),
      supabase
        .from("accounts")
        .select(
          "id, name, account_type, close_day_type, close_day, pay_month_offset, pay_day_type, pay_day, sort_order, is_active, is_favorite"
        ),
    ]);

    if (catError || cpError || accError) {
      setErrorMessage("マスタデータの読込でエラーが発生しました。");
      setLoading(false);
      return;
    }

    setCategories([...(catData ?? [])].sort(compareMasterRows) as CategoryRow[]);
    setCounterparties([...(cpData ?? [])].sort(compareMasterRows) as CounterpartyRow[]);
    setAccounts([...(accData ?? [])].sort(compareMasterRows) as AccountRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetCategoryForm() {
    setCategoryForm({
      id: "",
      kind: "expense",
      name: "",
      sort_order: "0",
      is_active: true,
      is_favorite: false,
    });
  }

  function resetCounterpartyForm() {
    setCounterpartyForm({
      id: "",
      kind: "expense",
      name: "",
      sort_order: "0",
      is_active: true,
      is_favorite: false,
      default_category_id: "",
    });
  }

  function resetAccountForm() {
    setAccountForm({
      id: "",
      name: "",
      account_type: "cash",
      sort_order: "0",
      is_active: true,
      is_favorite: false,
      close_day_type: "month_end",
      close_day: "",
      pay_month_offset: "1",
      pay_day_type: "fixed",
      pay_day: "27",
    });
  }

  async function handleSaveCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const name = categoryForm.name.trim();
      const sortOrder = Number(categoryForm.sort_order);

      if (!name) {
        setErrorMessage("科目名を入力してください。");
        return;
      }

      if (Number.isNaN(sortOrder)) {
        setErrorMessage("表示順は数値で入力してください。");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        router.refresh();
        return;
      }

      const payload = {
        user_id: user.id,
        kind: categoryForm.kind,
        name,
        sort_order: sortOrder,
        is_active: categoryForm.is_active,
        is_favorite: categoryForm.is_favorite,
      };

      const result = categoryForm.id
        ? await supabase.from("categories").update(payload).eq("id", categoryForm.id)
        : await supabase.from("categories").insert(payload);

      if (result.error) {
        setErrorMessage(result.error.message);
        return;
      }

      setInfoMessage(categoryForm.id ? "科目を更新しました。" : "科目を追加しました。");
      resetCategoryForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCounterparty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const name = counterpartyForm.name.trim();
      const sortOrder = Number(counterpartyForm.sort_order);

      if (!name) {
        setErrorMessage("相手先名を入力してください。");
        return;
      }

      if (Number.isNaN(sortOrder)) {
        setErrorMessage("表示順は数値で入力してください。");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        router.refresh();
        return;
      }

      const payload = {
        user_id: user.id,
        kind: counterpartyForm.kind,
        name,
        sort_order: sortOrder,
        is_active: counterpartyForm.is_active,
        is_favorite: counterpartyForm.is_favorite,
        default_category_id:
          counterpartyForm.kind === "both"
            ? null
            : counterpartyForm.default_category_id || null,
      };

      const result = counterpartyForm.id
        ? await supabase.from("counterparties").update(payload).eq("id", counterpartyForm.id)
        : await supabase.from("counterparties").insert(payload);

      if (result.error) {
        setErrorMessage(result.error.message);
        return;
      }

      setInfoMessage(counterpartyForm.id ? "相手先を更新しました。" : "相手先を追加しました。");
      resetCounterpartyForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const name = accountForm.name.trim();
      const sortOrder = Number(accountForm.sort_order);

      if (!name) {
        setErrorMessage("名称を入力してください。");
        return;
      }

      if (Number.isNaN(sortOrder)) {
        setErrorMessage("表示順は数値で入力してください。");
        return;
      }

      let closeDay: number | null = null;
      let payMonthOffset: number | null = null;
      let payDay: number | null = null;

      if (accountForm.account_type === "card") {
        payMonthOffset = Number(accountForm.pay_month_offset);
        if (Number.isNaN(payMonthOffset) || payMonthOffset < 0) {
          setErrorMessage("支払月ずれは0以上の数値で入力してください。");
          return;
        }

        if (accountForm.close_day_type === "fixed") {
          closeDay = Number(accountForm.close_day);
          if (Number.isNaN(closeDay) || closeDay < 1 || closeDay > 31) {
            setErrorMessage("締め日は1〜31で入力してください。");
            return;
          }
        }

        if (accountForm.pay_day_type === "fixed") {
          payDay = Number(accountForm.pay_day);
          if (Number.isNaN(payDay) || payDay < 1 || payDay > 31) {
            setErrorMessage("支払日は1〜31で入力してください。");
            return;
          }
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        router.refresh();
        return;
      }

      const payload = {
        user_id: user.id,
        name,
        account_type: accountForm.account_type,
        sort_order: sortOrder,
        is_active: accountForm.is_active,
        is_favorite: accountForm.is_favorite,
        close_day_type: accountForm.account_type === "card" ? accountForm.close_day_type : null,
        close_day: accountForm.account_type === "card" ? closeDay : null,
        pay_month_offset: accountForm.account_type === "card" ? payMonthOffset : null,
        pay_day_type: accountForm.account_type === "card" ? accountForm.pay_day_type : null,
        pay_day: accountForm.account_type === "card" ? payDay : null,
      };

      const result = accountForm.id
        ? await supabase.from("accounts").update(payload).eq("id", accountForm.id)
        : await supabase.from("accounts").insert(payload);

      if (result.error) {
        setErrorMessage(result.error.message);
        return;
      }

      setInfoMessage(accountForm.id ? "支払方法を更新しました。" : "支払方法を追加しました。");
      resetAccountForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategoryActive(row: CategoryRow) {
    setErrorMessage("");
    setInfoMessage("");
    const result = await supabase
      .from("categories")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);

    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    setInfoMessage(row.is_active ? "科目を使用停止にしました。" : "科目を再度有効化しました。");
    await loadData();
  }

  async function toggleCounterpartyActive(row: CounterpartyRow) {
    setErrorMessage("");
    setInfoMessage("");
    const result = await supabase
      .from("counterparties")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);

    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    setInfoMessage(row.is_active ? "相手先を使用停止にしました。" : "相手先を再度有効化しました。");
    await loadData();
  }

  async function toggleAccountActive(row: AccountRow) {
    setErrorMessage("");
    setInfoMessage("");
    const result = await supabase
      .from("accounts")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);

    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    setInfoMessage(row.is_active ? "支払方法を使用停止にしました。" : "支払方法を再度有効化しました。");
    await loadData();
  }

  const visibleCategories = categories.filter((row) => {
    const kindOk = categoryFilterKind === "all" || row.kind === categoryFilterKind;
    const searchOk = !categorySearch || row.name.includes(categorySearch);
    return kindOk && searchOk;
  });

  const visibleCounterparties = counterparties.filter((row) => {
    const kindOk = counterpartyFilterKind === "all" || row.kind === counterpartyFilterKind;
    const searchOk = !counterpartySearch || row.name.includes(counterpartySearch);
    return kindOk && searchOk;
  });

  const visibleAccounts = accounts.filter((row) => {
    const typeOk = accountFilterType === "all" || row.account_type === accountFilterType;
    const searchOk = !accountSearch || row.name.includes(accountSearch);
    return typeOk && searchOk;
  });

  const selectableDefaultCategories = categories.filter((row) => {
    if (counterpartyForm.kind === "both") return false;
    return row.kind === counterpartyForm.kind;
  });

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>マスタ管理</h1>
          <div style={{ color: "#666", marginTop: 4 }}>科目・相手先・支払方法をまとめて管理します</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/">ホーム</Link>
          <Link href="/transactions/new">出入金入力</Link>
        </div>
      </div>

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

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: activeTab === "categories" ? "#222" : "#fff",
            color: activeTab === "categories" ? "#fff" : "#222",
          }}
        >
          科目
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("counterparties")}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: activeTab === "counterparties" ? "#222" : "#fff",
            color: activeTab === "counterparties" ? "#fff" : "#222",
          }}
        >
          相手先
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: activeTab === "accounts" ? "#222" : "#fff",
            color: activeTab === "accounts" ? "#fff" : "#222",
          }}
        >
          支払方法
        </button>
      </div>

      {activeTab === "categories" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>{categoryForm.id ? "科目編集" : "科目追加"}</h2>
            <form onSubmit={handleSaveCategory} style={{ display: "grid", gap: 12 }}>
              <label>
                種別
                <br />
                <select
                  value={categoryForm.kind}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      kind: e.target.value as "income" | "expense",
                    }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                >
                  <option value="expense">出金</option>
                  <option value="income">入金</option>
                </select>
              </label>

              <label>
                科目名
                <br />
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                />
              </label>

              <label>
                表示順
                <br />
                <input
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, sort_order: e.target.value }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={categoryForm.is_favorite}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, is_favorite: e.target.checked }))
                  }
                />
                よく使う
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                使用中
              </label>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={saving || loading} style={{ padding: "10px 14px" }}>
                  {saving ? "保存中..." : categoryForm.id ? "更新" : "追加"}
                </button>
                <button type="button" onClick={resetCategoryForm} style={{ padding: "10px 14px" }}>
                  クリア
                </button>
              </div>
            </form>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>科目一覧</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                placeholder="科目名で検索"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                style={{ padding: 10, fontSize: 16, flex: 1 }}
              />
              <select
                value={categoryFilterKind}
                onChange={(e) =>
                  setCategoryFilterKind(e.target.value as "all" | "income" | "expense")
                }
                style={{ padding: 10, fontSize: 16 }}
              >
                <option value="all">全種別</option>
                <option value="expense">出金</option>
                <option value="income">入金</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {visibleCategories.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    background: row.is_active ? "#fff" : "#f6f6f6",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {row.is_favorite ? "★ " : ""}
                      {row.name}
                    </div>
                    <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                      {row.kind === "expense" ? "出金" : "入金"} / 表示順 {row.sort_order} /{" "}
                      {row.is_active ? "使用中" : "停止中"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryForm({
                          id: row.id,
                          kind: row.kind,
                          name: row.name,
                          sort_order: String(row.sort_order),
                          is_active: row.is_active,
                          is_favorite: row.is_favorite,
                        })
                      }
                    >
                      編集
                    </button>
                    <button type="button" onClick={() => toggleCategoryActive(row)}>
                      {row.is_active ? "停止" : "有効化"}
                    </button>
                  </div>
                </div>
              ))}

              {!loading && visibleCategories.length === 0 && <div>該当データがありません。</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "counterparties" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>{counterpartyForm.id ? "相手先編集" : "相手先追加"}</h2>
            <form onSubmit={handleSaveCounterparty} style={{ display: "grid", gap: 12 }}>
              <label>
                種別
                <br />
                <select
                  value={counterpartyForm.kind}
                  onChange={(e) =>
                    setCounterpartyForm((prev) => ({
                      ...prev,
                      kind: e.target.value as "income" | "expense" | "both",
                      default_category_id: "",
                    }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                >
                  <option value="expense">出金</option>
                  <option value="income">入金</option>
                  <option value="both">両方</option>
                </select>
              </label>

              <label>
                相手先名
                <br />
                <input
                  type="text"
                  value={counterpartyForm.name}
                  onChange={(e) =>
                    setCounterpartyForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                />
              </label>

              <label>
                表示順
                <br />
                <input
                  type="number"
                  value={counterpartyForm.sort_order}
                  onChange={(e) =>
                    setCounterpartyForm((prev) => ({ ...prev, sort_order: e.target.value }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                />
              </label>

              <label>
                デフォルト科目
                <br />
                <select
                  value={counterpartyForm.default_category_id}
                  disabled={counterpartyForm.kind === "both"}
                  onChange={(e) =>
                    setCounterpartyForm((prev) => ({
                      ...prev,
                      default_category_id: e.target.value,
                    }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                >
                  <option value="">未設定</option>
                  {selectableDefaultCategories.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={counterpartyForm.is_favorite}
                  onChange={(e) =>
                    setCounterpartyForm((prev) => ({
                      ...prev,
                      is_favorite: e.target.checked,
                    }))
                  }
                />
                よく使う
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={counterpartyForm.is_active}
                  onChange={(e) =>
                    setCounterpartyForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
                使用中
              </label>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={saving || loading} style={{ padding: "10px 14px" }}>
                  {saving ? "保存中..." : counterpartyForm.id ? "更新" : "追加"}
                </button>
                <button type="button" onClick={resetCounterpartyForm} style={{ padding: "10px 14px" }}>
                  クリア
                </button>
              </div>
            </form>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>相手先一覧</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                placeholder="相手先名で検索"
                value={counterpartySearch}
                onChange={(e) => setCounterpartySearch(e.target.value)}
                style={{ padding: 10, fontSize: 16, flex: 1 }}
              />
              <select
                value={counterpartyFilterKind}
                onChange={(e) =>
                  setCounterpartyFilterKind(
                    e.target.value as "all" | "income" | "expense" | "both"
                  )
                }
                style={{ padding: 10, fontSize: 16 }}
              >
                <option value="all">全種別</option>
                <option value="expense">出金</option>
                <option value="income">入金</option>
                <option value="both">両方</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {visibleCounterparties.map((row) => {
                const defaultCategory = categories.find(
                  (x) => x.id === row.default_category_id
                );

                return (
                  <div
                    key={row.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 10,
                      padding: 12,
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      background: row.is_active ? "#fff" : "#f6f6f6",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {row.is_favorite ? "★ " : ""}
                        {row.name}
                      </div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                        {row.kind === "expense"
                          ? "出金"
                          : row.kind === "income"
                          ? "入金"
                          : "両方"}
                        {" / "}
                        表示順 {row.sort_order} / {row.is_active ? "使用中" : "停止中"}
                        {defaultCategory ? ` / 既定科目: ${defaultCategory.name}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() =>
                          setCounterpartyForm({
                            id: row.id,
                            kind: row.kind,
                            name: row.name,
                            sort_order: String(row.sort_order),
                            is_active: row.is_active,
                            is_favorite: row.is_favorite,
                            default_category_id: row.default_category_id ?? "",
                          })
                        }
                      >
                        編集
                      </button>
                      <button type="button" onClick={() => toggleCounterpartyActive(row)}>
                        {row.is_active ? "停止" : "有効化"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {!loading && visibleCounterparties.length === 0 && <div>該当データがありません。</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "accounts" && (
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16 }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>{accountForm.id ? "支払方法編集" : "支払方法追加"}</h2>
            <form onSubmit={handleSaveAccount} style={{ display: "grid", gap: 12 }}>
              <label>
                名称
                <br />
                <input
                  type="text"
                  value={accountForm.name}
                  onChange={(e) =>
                    setAccountForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                />
              </label>

              <label>
                種別
                <br />
                <select
                  value={accountForm.account_type}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      account_type: e.target.value as "cash" | "bank" | "card",
                    }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                >
                  <option value="cash">現金</option>
                  <option value="bank">銀行</option>
                  <option value="card">カード</option>
                </select>
              </label>

              <label>
                表示順
                <br />
                <input
                  type="number"
                  value={accountForm.sort_order}
                  onChange={(e) =>
                    setAccountForm((prev) => ({ ...prev, sort_order: e.target.value }))
                  }
                  style={{ padding: 10, fontSize: 16 }}
                />
              </label>

              {accountForm.account_type === "card" && (
                <>
                  <label>
                    締め日種別
                    <br />
                    <select
                      value={accountForm.close_day_type}
                      onChange={(e) =>
                        setAccountForm((prev) => ({
                          ...prev,
                          close_day_type: e.target.value as "fixed" | "month_end",
                        }))
                      }
                      style={{ padding: 10, fontSize: 16 }}
                    >
                      <option value="month_end">月末</option>
                      <option value="fixed">固定日</option>
                    </select>
                  </label>

                  {accountForm.close_day_type === "fixed" && (
                    <label>
                      締め日
                      <br />
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={accountForm.close_day}
                        onChange={(e) =>
                          setAccountForm((prev) => ({ ...prev, close_day: e.target.value }))
                        }
                        style={{ padding: 10, fontSize: 16 }}
                      />
                    </label>
                  )}

                  <label>
                    支払月ずれ
                    <br />
                    <input
                      type="number"
                      min="0"
                      value={accountForm.pay_month_offset}
                      onChange={(e) =>
                        setAccountForm((prev) => ({
                          ...prev,
                          pay_month_offset: e.target.value,
                        }))
                      }
                      style={{ padding: 10, fontSize: 16 }}
                    />
                  </label>

                  <label>
                    支払日種別
                    <br />
                    <select
                      value={accountForm.pay_day_type}
                      onChange={(e) =>
                        setAccountForm((prev) => ({
                          ...prev,
                          pay_day_type: e.target.value as "fixed" | "month_end",
                        }))
                      }
                      style={{ padding: 10, fontSize: 16 }}
                    >
                      <option value="fixed">固定日</option>
                      <option value="month_end">月末</option>
                    </select>
                  </label>

                  {accountForm.pay_day_type === "fixed" && (
                    <label>
                      支払日
                      <br />
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={accountForm.pay_day}
                        onChange={(e) =>
                          setAccountForm((prev) => ({ ...prev, pay_day: e.target.value }))
                        }
                        style={{ padding: 10, fontSize: 16 }}
                      />
                    </label>
                  )}
                </>
              )}

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={accountForm.is_favorite}
                  onChange={(e) =>
                    setAccountForm((prev) => ({ ...prev, is_favorite: e.target.checked }))
                  }
                />
                よく使う
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={accountForm.is_active}
                  onChange={(e) =>
                    setAccountForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                使用中
              </label>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={saving || loading} style={{ padding: "10px 14px" }}>
                  {saving ? "保存中..." : accountForm.id ? "更新" : "追加"}
                </button>
                <button type="button" onClick={resetAccountForm} style={{ padding: "10px 14px" }}>
                  クリア
                </button>
              </div>
            </form>
          </div>

          <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>支払方法一覧</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                placeholder="名称で検索"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                style={{ padding: 10, fontSize: 16, flex: 1 }}
              />
              <select
                value={accountFilterType}
                onChange={(e) =>
                  setAccountFilterType(e.target.value as "all" | "cash" | "bank" | "card")
                }
                style={{ padding: 10, fontSize: 16 }}
              >
                <option value="all">全種別</option>
                <option value="cash">現金</option>
                <option value="bank">銀行</option>
                <option value="card">カード</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {visibleAccounts.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    background: row.is_active ? "#fff" : "#f6f6f6",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {row.is_favorite ? "★ " : ""}
                      {row.name}
                    </div>
                    <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                      {row.account_type === "cash"
                        ? "現金"
                        : row.account_type === "bank"
                        ? "銀行"
                        : "カード"}
                      {" / "}
                      表示順 {row.sort_order} / {row.is_active ? "使用中" : "停止中"}
                      {row.account_type === "card"
                        ? ` / 締め: ${
                            row.close_day_type === "month_end"
                              ? "月末"
                              : `${row.close_day ?? ""}日`
                          } / 支払: ${
                            row.pay_month_offset ?? 0
                          }か月後 ${
                            row.pay_day_type === "month_end"
                              ? "月末"
                              : `${row.pay_day ?? ""}日`
                          }`
                        : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setAccountForm({
                          id: row.id,
                          name: row.name,
                          account_type: row.account_type,
                          sort_order: String(row.sort_order),
                          is_active: row.is_active,
                          is_favorite: row.is_favorite,
                          close_day_type: row.close_day_type ?? "month_end",
                          close_day: row.close_day ? String(row.close_day) : "",
                          pay_month_offset:
                            row.pay_month_offset != null ? String(row.pay_month_offset) : "1",
                          pay_day_type: row.pay_day_type ?? "fixed",
                          pay_day: row.pay_day ? String(row.pay_day) : "27",
                        })
                      }
                    >
                      編集
                    </button>
                    <button type="button" onClick={() => toggleAccountActive(row)}>
                      {row.is_active ? "停止" : "有効化"}
                    </button>
                  </div>
                </div>
              ))}

              {!loading && visibleAccounts.length === 0 && <div>該当データがありません。</div>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}