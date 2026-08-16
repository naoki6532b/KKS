import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/components/header";
import { TransactionList, type TxRow } from "@/app/components/transaction-list";
import { SALARY_ITEM_MAP } from "@/lib/salary";

type SlipWithItems = {
  id: string;
  slip_date: string;
  slip_type: "salary" | "bonus";
  accounts: { name?: string } | null;
  salary_slip_items: { item_key: string; amount: number }[];
};

type AggSetting = {
  category_id: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  categories: { name?: string } | null;
  counterparties: { name?: string } | null;
};

type TransactionsPageProps = {
  searchParams: Promise<{ month?: string | string[] }>;
};

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function getCurrentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = year * 12 + monthNumber - 1 + delta;
  const nextYear = Math.floor(shifted / 12);
  const nextMonth = (shifted % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function slipToSyntheticRow(slip: SlipWithItems, aggPayment: AggSetting | null): TxRow {
  let payment = 0, deduction = 0;
  for (const it of slip.salary_slip_items) {
    const def = SALARY_ITEM_MAP.get(it.item_key);
    if (!def) continue;
    if (def.section === "deduction") deduction += it.amount;
    else payment += it.amount;
  }
  const net = payment - deduction;
  const m = parseInt(slip.slip_date.split("-")[1], 10);
  const typeLabel = slip.slip_type === "salary" ? "給与" : "賞与";
  return {
    id: `__slip__${slip.id}`,
    tx_date: slip.slip_date,
    tx_type: "income",
    amount: net,
    currency: "JPY",
    currency_amount: null,
    exchange_rate: null,
    item_name: `${typeLabel}（${m}月分）`,
    counterparty_name: aggPayment?.counterparty_name ?? null,
    memo: null,
    has_tax: false,
    tax_amount: null,
    salary_slip_id: slip.id,
    categories: aggPayment?.categories ?? null,
    counterparties: aggPayment?.counterparties ?? null,
    accounts: slip.accounts,
  };
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const requestedMonth = (await searchParams).month;
  const monthParam = Array.isArray(requestedMonth) ? requestedMonth[0] : requestedMonth;
  const selectedMonth = monthParam && MONTH_PATTERN.test(monthParam)
    ? monthParam
    : getCurrentMonth();
  const monthStart = `${selectedMonth}-01`;
  const monthEnd = `${shiftMonth(selectedMonth, 1)}-01`;
  const previousMonth = shiftMonth(selectedMonth, -1);
  const nextMonth = shiftMonth(selectedMonth, 1);

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rows, error }, { data: userSettings }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, tx_date, tx_type, amount, currency, currency_amount, exchange_rate, item_name, counterparty_name, memo, has_tax, tax_amount, salary_slip_id, categories(name), counterparties(name), accounts(name)")
      .gte("tx_date", monthStart)
      .lt("tx_date", monthEnd)
      .order("tx_date", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(500),

    supabase
      .from("user_settings")
      .select("strict_display")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const strictDisplay = userSettings?.strict_display ?? false;

  let displayRows: TxRow[] = (rows ?? []) as TxRow[];

  if (!strictDisplay) {
    const nonSalaryRows = displayRows.filter((r) => !r.salary_slip_id);

    const [{ data: slips }, { data: aggRaw }] = await Promise.all([
      supabase
        .from("salary_slips")
        .select("id, slip_date, slip_type, accounts(name), salary_slip_items(item_key, amount)")
        .gte("slip_date", monthStart)
        .lt("slip_date", monthEnd)
        .order("slip_date", { ascending: true }),
      supabase
        .from("salary_item_settings")
        .select("category_id, counterparty_id, counterparty_name")
        .eq("user_id", user.id)
        .eq("item_key", "__aggregate_payment__")
        .maybeSingle(),
    ]);

    let aggPayment: AggSetting | null = null;
    if (aggRaw) {
      const [catRes, cpRes] = await Promise.all([
        aggRaw.category_id
          ? supabase.from("categories").select("name").eq("id", aggRaw.category_id).maybeSingle()
          : Promise.resolve({ data: null }),
        aggRaw.counterparty_id
          ? supabase.from("counterparties").select("name").eq("id", aggRaw.counterparty_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      aggPayment = {
        category_id: aggRaw.category_id,
        counterparty_id: aggRaw.counterparty_id,
        counterparty_name: aggRaw.counterparty_name,
        categories: catRes.data ? { name: (catRes.data as { name?: string }).name } : null,
        counterparties: cpRes.data ? { name: (cpRes.data as { name?: string }).name } : null,
      };
    }

    const syntheticRows: TxRow[] = ((slips ?? []) as unknown as SlipWithItems[]).map((slip) =>
      slipToSyntheticRow(slip, aggPayment)
    );

    displayRows = [...nonSalaryRows, ...syntheticRows].sort((a, b) =>
      a.tx_date.localeCompare(b.tx_date)
    );
  }

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-heading">
          <h1 className="page-title">取引一覧</h1>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <nav aria-label="表示月の移動" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <Link
                href={`/transactions?month=${previousMonth}`}
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: 16 }}
                aria-label={`${previousMonth}を表示`}
              >
                ‹
              </Link>
              <form action="/transactions" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="month"
                  name="month"
                  defaultValue={selectedMonth}
                  className="field-input"
                  style={{ width: "auto" }}
                  aria-label="表示する月"
                />
                <button type="submit" className="btn btn-secondary" style={{ padding: "6px 12px" }}>
                  表示
                </button>
              </form>
              <Link
                href={`/transactions?month=${nextMonth}`}
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: 16 }}
                aria-label={`${nextMonth}を表示`}
              >
                ›
              </Link>
            </nav>
            <Link href="/transactions/new" className="btn btn-primary">
              ＋ 出入金入力
            </Link>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error.message}</div>}

        <TransactionList rows={displayRows} />
      </main>
    </>
  );
}

