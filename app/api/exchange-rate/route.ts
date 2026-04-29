import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const currency = searchParams.get("currency");
  const date     = searchParams.get("date");

  if (!currency || !date) {
    return NextResponse.json({ error: "currency and date required" }, { status: 400 });
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
    (await tryFetch(`https://api.frankfurter.app/${date}?from=${currency}&to=JPY`)) ??
    (await tryFetch(`https://api.frankfurter.app/latest?from=${currency}&to=JPY`));

  if (rate == null) {
    return NextResponse.json({ error: `${currency}のレートを取得できませんでした` }, { status: 502 });
  }

  return NextResponse.json({ rate });
}
