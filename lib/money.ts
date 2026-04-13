export type AccountRule = {
  account_type: "cash" | "bank" | "card";
  close_day_type: "fixed" | "month_end" | null;
  close_day: number | null;
  pay_month_offset: number | null;
  pay_day_type: "fixed" | "month_end" | null;
  pay_day: number | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getLastDay(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(year: number, month: number, offset: number) {
  const total = year * 12 + (month - 1) + offset;
  return {
    year: Math.floor(total / 12),
    month: (total % 12) + 1,
  };
}

export function firstDayOfMonth(dateString: string) {
  return `${dateString.slice(0, 7)}-01`;
}

export function nextMonthStart(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  const next = addMonths(year, month, 1);
  return `${next.year}-${pad2(next.month)}-01`;
}

export function computeCardDueDate(
  txDate: string,
  rule: AccountRule
): string | null {
  if (rule.account_type !== "card") return null;
  if (
    !rule.close_day_type ||
    rule.pay_month_offset == null ||
    !rule.pay_day_type
  ) {
    return null;
  }

  const [year, month, day] = txDate.split("-").map(Number);

  const currentMonthLastDay = getLastDay(year, month);

  const closeDay =
    rule.close_day_type === "month_end"
      ? currentMonthLastDay
      : Math.min(rule.close_day ?? 31, currentMonthLastDay);

  let statementYear = year;
  let statementMonth = month;

  if (day > closeDay) {
    const next = addMonths(year, month, 1);
    statementYear = next.year;
    statementMonth = next.month;
  }

  const dueMonth = addMonths(
    statementYear,
    statementMonth,
    rule.pay_month_offset
  );
  const dueMonthLastDay = getLastDay(dueMonth.year, dueMonth.month);

  const dueDay =
    rule.pay_day_type === "month_end"
      ? dueMonthLastDay
      : Math.min(rule.pay_day ?? 31, dueMonthLastDay);

  return `${dueMonth.year}-${pad2(dueMonth.month)}-${pad2(dueDay)}`;
}