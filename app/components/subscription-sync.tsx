"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { firstDayOfMonth } from "@/lib/money";
import { fetchRateToJPY } from "@/lib/exchange";

function calcNextBillingDate(dateStr: string, frequency: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const addM = (months: number) => {
    const total = y * 12 + (m - 1) + months;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    const last = new Date(ny, nm, 0).getDate();
    return `${ny}-${String(nm).padStart(2,"0")}-${String(Math.min(d, last)).padStart(2,"0")}`;
  };
  if (frequency === "weekly") {
    const dt = new Date(y, m - 1, d + 7);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  }
  const offsetMap: Record<string, number> = { monthly:1, "2months":2, "3months":3, "6months":6, annual:12 };
  return addM(offsetMap[frequency] ?? 1);
}

export function SubscriptionSync() {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function run() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().slice(0, 10);
      const { data: dueSubs } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .lte("next_billing_date", today);

      if (!dueSubs?.length) return;

      for (const sub of dueSubs) {
        let billingDate: string = sub.next_billing_date;

        while (billingDate <= today) {
          const { data: existing } = await supabase
            .from("transactions")
            .select("id")
            .eq("user_id", user.id)
            .eq("subscription_id", sub.id)
            .eq("tx_date", billingDate)
            .maybeSingle();

          if (!existing) {
            const currency = sub.currency ?? "JPY";
            const currencyAmount = sub.currency_amount ?? null;
            let jpyAmount = sub.amount;
            let exchangeRate: number | null = null;
            if (currency !== "JPY" && currencyAmount) {
              try {
                exchangeRate = await fetchRateToJPY(currency, billingDate);
                jpyAmount = Math.round(currencyAmount * exchangeRate);
              } catch {
                jpyAmount = sub.amount;
              }
            }
            await supabase.from("transactions").insert({
              user_id: user.id,
              tx_date: billingDate,
              target_month: firstDayOfMonth(billingDate),
              tx_type: sub.tx_type ?? "expense",
              amount: jpyAmount,
              currency,
              currency_amount: currency !== "JPY" ? currencyAmount : null,
              exchange_rate: exchangeRate,
              account_id: sub.account_id ?? null,
              category_id: sub.category_id ?? null,
              counterparty_id: sub.counterparty_id ?? null,
              counterparty_name: sub.counterparty_name ?? null,
              item_name: sub.name,
              memo: "サブスク自動記録",
              subscription_id: sub.id,
              card_due_date: null,
            });
          }

          billingDate = calcNextBillingDate(billingDate, sub.frequency);
        }

        await supabase
          .from("subscriptions")
          .update({ next_billing_date: billingDate })
          .eq("id", sub.id)
          .eq("user_id", user.id);
      }
    }

    run();
  }, [supabase]);

  return null;
}
