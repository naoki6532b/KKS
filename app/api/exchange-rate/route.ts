import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENCY_MAP } from "@/lib/exchange";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const currency = searchParams.get("currency");
  const date     = searchParams.get("date");

  if (!currency || !date) {
    return NextResponse.json({ error: "currency and date required" }, { status: 400 });
  }
  if (!CURRENCY_MAP.has(currency)) {
    return NextResponse.json({ error: "unsupported currency" }, { status: 400 });
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "invalid date format" }, { status: 400 });
  }
  if (currency === "JPY") {
    return NextResponse.json({ rate: 1 });
  }

  const tryFetch = async (url: string): Promise<number | null> => {
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.rates?.JPY as number) ?? null;
    } catch {
      return null;
    }
  };

  const rate =
    (await tryFetch(`https://api.frankfurter.app/${encodeURIComponent(date)}?from=${encodeURIComponent(currency)}&to=JPY`)) ??
    (await tryFetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(currency)}&to=JPY`));

  if (rate == null) {
    return NextResponse.json({ error: `${currency}のレートを取得できませんでした` }, { status: 502 });
  }

  return NextResponse.json({ rate });
}
