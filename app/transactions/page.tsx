import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/components/header";
import { TransactionList, type TxRow } from "@/app/components/transaction-list";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("id, tx_date, tx_type, amount, currency, currency_amount, exchange_rate, item_name, counterparty_name, memo, categories(name), counterparties(name), accounts(name)")
    .order("tx_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(500);

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

        <TransactionList rows={(rows ?? []) as TxRow[]} />
      </main>
    </>
  );
}
