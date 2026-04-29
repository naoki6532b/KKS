export type CurrencyInfo = { code: string; name: string; symbol: string };

export const CURRENCIES: CurrencyInfo[] = [
  { code: "JPY", name: "日本円",               symbol: "¥" },
  { code: "USD", name: "米ドル",               symbol: "$" },
  { code: "EUR", name: "ユーロ",               symbol: "€" },
  { code: "GBP", name: "英ポンド",             symbol: "£" },
  { code: "CNY", name: "中国元",               symbol: "¥" },
  { code: "KRW", name: "韓国ウォン",           symbol: "₩" },
  { code: "AUD", name: "豪ドル",               symbol: "A$" },
  { code: "CAD", name: "カナダドル",           symbol: "C$" },
  { code: "CHF", name: "スイスフラン",         symbol: "Fr" },
  { code: "HKD", name: "香港ドル",             symbol: "HK$" },
  { code: "SGD", name: "シンガポールドル",     symbol: "S$" },
  { code: "THB", name: "タイバーツ",           symbol: "฿" },
  { code: "MYR", name: "マレーシアリンギット", symbol: "RM" },
  { code: "IDR", name: "インドネシアルピア",   symbol: "Rp" },
  { code: "PHP", name: "フィリピンペソ",       symbol: "₱" },
  { code: "INR", name: "インドルピー",         symbol: "₹" },
  { code: "MXN", name: "メキシコペソ",         symbol: "MX$" },
  { code: "BRL", name: "ブラジルレアル",       symbol: "R$" },
  { code: "ZAR", name: "南アフリカランド",     symbol: "R" },
  { code: "NZD", name: "NZドル",               symbol: "NZ$" },
  { code: "SEK", name: "スウェーデンクローナ", symbol: "kr" },
  { code: "NOK", name: "ノルウェークローネ",   symbol: "kr" },
  { code: "DKK", name: "デンマーククローネ",   symbol: "kr" },
  { code: "TRY", name: "トルコリラ",           symbol: "₺" },
  { code: "PLN", name: "ポーランドズロチ",     symbol: "zł" },
];

export const CURRENCY_MAP = new Map(CURRENCIES.map((c) => [c.code, c]));

export async function fetchRateToJPY(currency: string, date: string): Promise<number> {
  if (currency === "JPY") return 1;
  const tryFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.rates?.JPY as number) ?? null;
  };
  const rate =
    (await tryFetch(`https://api.frankfurter.app/${date}?from=${currency}&to=JPY`)) ??
    (await tryFetch(`https://api.frankfurter.app/latest?from=${currency}&to=JPY`));
  if (rate == null) throw new Error(`${currency}の為替レートを取得できませんでした`);
  return rate;
}

export function fmtFx(currencyAmount: number, currency: string, exchangeRate: number): string {
  const info = CURRENCY_MAP.get(currency);
  const sym = info?.symbol ?? currency;
  const decimals = ["JPY", "KRW", "IDR"].includes(currency) ? 0 : 2;
  return `${sym}${currencyAmount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} (1${currency}=${Math.round(exchangeRate)}円)`;
}
