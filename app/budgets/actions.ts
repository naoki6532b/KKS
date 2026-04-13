"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveBudgetAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const month = String(formData.get("month") ?? "");
  const amount = Number(formData.get("budget_amount") ?? 0);

  if (!month || Number.isNaN(amount) || amount < 0) {
    redirect("/budgets");
  }

  await supabase.from("monthly_budgets").upsert(
    {
      user_id: user.id,
      target_month: `${month}-01`,
      budget_amount: amount,
    },
    {
      onConflict: "user_id,target_month",
    }
  );

  revalidatePath("/");
  revalidatePath("/budgets");
  redirect("/");
}