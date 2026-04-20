import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { navButtonStyle } from "@/lib/navButtonStyle";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rows, error } = await supabase
    .from("transactions")
    .select(
      "id, tx_date, tx_type, amount, memo, categories(name), counterparties(name), accounts(name)"
    )
    .order("tx_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <Link href="/" style={navButtonStyle}>
          ホームへ戻る
        </Link>
        <Link href="/transactions/new" style={navButtonStyle}>
          出入金入力
        </Link>
      </div>

      <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
        <h1 style={{ marginTop: 0 }}>取引一覧</h1>

        {error && (
          <div style={{ color: "#b00020", marginBottom: 12 }}>{error.message}</div>
        )}

        {(rows ?? []).length === 0 && (
          <p style={{ color: "#666" }}>取引がまだありません。</p>
        )}

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
              minWidth: 600,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>日付</th>
                <th style={{ padding: "8px 6px" }}>種別</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>金額</th>
                <th style={{ padding: "8px 6px" }}>科目</th>
                <th style={{ padding: "8px 6px" }}>相手先</th>
                <th style={{ padding: "8px 6px" }}>口座</th>
                <th style={{ padding: "8px 6px" }}>メモ</th>
                <th style={{ padding: "8px 6px" }}></th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: "1px solid #f0f0f0" }}
                >
                  <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{row.tx_date}</td>
                  <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                    {row.tx_type === "income" ? "入金" : "出金"}
                  </td>
                  <td
                    style={{
                      padding: "8px 6px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      color: row.tx_type === "income" ? "#0b57a4" : "#b00020",
                    }}
                  >
                    {row.amount.toLocaleString()} 円
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {(row.categories as { name?: string } | null)?.name ?? "-"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {(row.counterparties as { name?: string } | null)?.name ?? "-"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {(row.accounts as { name?: string } | null)?.name ?? "-"}
                  </td>
                  <td
                    style={{
                      padding: "8px 6px",
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "#666",
                    }}
                  >
                    {row.memo ?? ""}
                  </td>
                  <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                    <Link
                      href={`/transactions/${row.id}/edit`}
                      style={{ ...navButtonStyle, fontSize: 13, padding: "6px 10px" }}
                    >
                      訂正
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
