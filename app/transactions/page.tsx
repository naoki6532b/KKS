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

function slipToSyntheticRow(slip: SlipWithItems): TxRow {
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
    counterparty_name: null,
    memo: null,
    has_tax: false,
    tax_amount: null,
    salary_slip_id: slip.id,
    categories: null,
    counterparties: null,
    accounts: slip.accounts,
  };
}

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rows, error }, { data: userSettings }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, tx_date, tx_type, amount, currency, currency_amount, exchange_rate, item_name, counterparty_name, memo, has_tax, tax_amount, salary_slip_id, categories(name), counterparties(name), accounts(name)")
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

    const { data: slips } = await supabase
      .from("salary_slips")
      .select("id, slip_date, slip_type, accounts(name), salary_slip_items(item_key, amount)")
      .order("slip_date", { ascending: true });

    const syntheticRows: TxRow[] = ((slips ?? []) as unknown as SlipWithItems[]).map(slipToSyntheticRow);

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
          <Link href="/transactions/new" className="btn btn-primary">
            ＋ 出入金入力
          </Link>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error.message}</div>}

        <TransactionList rows={displayRows} />
      </main>
    </>
  );
}
