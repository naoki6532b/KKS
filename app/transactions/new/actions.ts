"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeCardDueDate, firstDayOfMonth, type AccountRule } from "@/lib/money";

export async function saveTransactionAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const txDate = String(formData.get("tx_date") ?? "");
  const txType = String(formData.get("tx_type") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const categoryId = String(formData.get("category_id") ?? "");
  const counterpartyId = String(formData.get("counterparty_id") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  const memo = String(formData.get("memo") ?? "");

  if (!txDate || !["income", "expense"].includes(txType) || amount <= 0 || !accountId) {
    redirect("/transactions/new");
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("account_type, close_day_type, close_day, pay_month_offset, pay_day_type, pay_day")
    .eq("id", accountId)
    .single();

  const cardDueDate = account
    ? computeCardDueDate(txDate, account as AccountRule)
    : null;

  await supabase.from("transactions").insert({
    user_id: user.id,
    tx_date: txDate,
    target_month: firstDayOfMonth(txDate),
    tx_type: txType,
    amount,
    category_id: categoryId || null,
    counterparty_id: counterpartyId || null,
    account_id: accountId,
    memo: memo || null,
    card_due_date: txType === "expense" ? cardDueDate : null,
  });

  revalidatePath("/");
  revalidatePath("/transactions/new");
  redirect("/");
}