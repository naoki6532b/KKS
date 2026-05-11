export type SalarySection = "payment_taxable" | "payment_nontaxable" | "deduction";
export type LedgerMode = "individual" | "aggregate";

export type SalaryItemDef = {
  key: string;
  label: string;
  section: SalarySection;
};

export const SALARY_ITEMS: SalaryItemDef[] = [
  // 支給（課税）
  { key: "base_salary",          label: "生活基本給",      section: "payment_taxable" },
  { key: "duty_eval",            label: "職務評価給",      section: "payment_taxable" },
  { key: "duty_allowance",       label: "職務手当",        section: "payment_taxable" },
  { key: "skill_allowance",      label: "職能手当",        section: "payment_taxable" },
  { key: "performance",          label: "実績給",          section: "payment_taxable" },
  { key: "adjustment1",          label: "調整給1",         section: "payment_taxable" },
  { key: "adjustment2",          label: "調整給2",         section: "payment_taxable" },
  { key: "adjustment3",          label: "調整給3",         section: "payment_taxable" },
  { key: "family_allowance",     label: "家族手当",        section: "payment_taxable" },
  { key: "outside_work",         label: "外勤手当",        section: "payment_taxable" },
  { key: "staff_allowance",      label: "スタッフ手当",    section: "payment_taxable" },
  { key: "area_allowance",       label: "地域手当",        section: "payment_taxable" },
  { key: "overtime",             label: "残業手当",        section: "payment_taxable" },
  { key: "holiday_work",         label: "休出手当",        section: "payment_taxable" },
  { key: "overnight",            label: "宿直手当",        section: "payment_taxable" },
  { key: "commute",              label: "通勤手当",        section: "payment_taxable" },
  { key: "short_time",           label: "短時間",          section: "payment_taxable" },
  { key: "sales_allowance",      label: "販売手当",        section: "payment_taxable" },
  { key: "profit_commission",    label: "利益コミッション", section: "payment_taxable" },
  { key: "contest",              label: "コンテスト",      section: "payment_taxable" },
  { key: "other_allowance2",     label: "他手当2",         section: "payment_taxable" },
  { key: "other_allowance",      label: "他手当(給)",      section: "payment_taxable" },
  { key: "referral",             label: "紹介料",          section: "payment_taxable" },
  { key: "prev_month_adj",       label: "前月調整",        section: "payment_taxable" },
  { key: "absence_deduction",    label: "欠勤控除",        section: "payment_taxable" },
  { key: "daily_deduction",      label: "日割控除",        section: "payment_taxable" },

  // 支給（非課税）
  { key: "tax_free_commute",     label: "非課税交通",      section: "payment_nontaxable" },
  { key: "tax_free_overnight",   label: "非宿日直",        section: "payment_nontaxable" },
  { key: "tax_free_payment",     label: "非課税支給",      section: "payment_nontaxable" },
  { key: "additional_benefit",   label: "付加給付金",      section: "payment_nontaxable" },
  { key: "refund",               label: "還付金",          section: "payment_nontaxable" },
  { key: "social_ins_excluded",  label: "社保対象外",      section: "payment_nontaxable" },
  { key: "health_pension_excluded", label: "健厚対象外",   section: "payment_nontaxable" },

  // 控除
  { key: "health_insurance",     label: "健康保険",        section: "deduction" },
  { key: "pension",              label: "厚生年金",        section: "deduction" },
  { key: "employment_insurance", label: "雇用保険",        section: "deduction" },
  { key: "care_insurance",       label: "介護保険",        section: "deduction" },
  { key: "income_tax",           label: "所得税",          section: "deduction" },
  { key: "resident_tax",         label: "住民税",          section: "deduction" },
  { key: "corporate_pension",    label: "企業年金",        section: "deduction" },
  { key: "life_damage_insurance", label: "生・損保料",     section: "deduction" },
  { key: "asset_savings",        label: "財形貯蓄",        section: "deduction" },
  { key: "dorm_fee",             label: "寮費",            section: "deduction" },
  { key: "goods",                label: "物品代",          section: "deduction" },
  { key: "other_deduction1",     label: "他控除1",         section: "deduction" },
  { key: "other_deduction2",     label: "他控除2",         section: "deduction" },
  { key: "other_deduction",      label: "他控除(給)",      section: "deduction" },
  { key: "social_fee",           label: "親睦会費",        section: "deduction" },
  { key: "department_fee",       label: "部会費",          section: "deduction" },
  { key: "repayment",            label: "返済金等",        section: "deduction" },
  { key: "tax_reduction",        label: "定額減税額",      section: "deduction" },
  { key: "year_end_adjustment",  label: "年調過不足",      section: "deduction" },
];

export const SALARY_ITEM_MAP = new Map(SALARY_ITEMS.map((it) => [it.key, it]));

export function getItemsBySection(section: SalarySection): SalaryItemDef[] {
  return SALARY_ITEMS.filter((it) => it.section === section);
}

export const AGGREGATE_ITEMS: { key: string; label: string; isPayment: boolean }[] = [
  { key: "__aggregate_payment__",   label: "支給合計", isPayment: true  },
  { key: "__aggregate_deduction__", label: "控除合計", isPayment: false },
];

export type ItemSetting = {
  item_key: string;
  ledger_mode: LedgerMode;
  category_id: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  has_tax: boolean;
};

export function defaultSetting(item_key: string): ItemSetting {
  return {
    item_key,
    ledger_mode: "individual",
    category_id: null,
    counterparty_id: null,
    counterparty_name: null,
    has_tax: false,
  };
}

export type SlipItemAmounts = Record<string, number>;

export type GeneratedTx = {
  tx_type: "income" | "expense";
  amount: number;
  item_name: string;
  category_id: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  has_tax: boolean;
  tax_amount: number;
  salary_item_key: string | null;
};

export function buildSlipTransactions(
  amounts: SlipItemAmounts,
  settings: Record<string, ItemSetting>,
  taxRate: number,
  slipTypeLabel: string,
): GeneratedTx[] {
  const out: GeneratedTx[] = [];
  let aggPayment = 0;
  let aggDeduction = 0;

  for (const it of SALARY_ITEMS) {
    const amount = Math.abs(amounts[it.key] ?? 0);
    if (amount <= 0) continue;
    const setting = settings[it.key] ?? defaultSetting(it.key);
    const isPayment = it.section !== "deduction";

    if (setting.ledger_mode === "aggregate") {
      if (isPayment) aggPayment += amount;
      else           aggDeduction += amount;
      continue;
    }
    const taxAmount = setting.has_tax ? Math.round(amount * taxRate / (100 + taxRate)) : 0;
    out.push({
      tx_type: isPayment ? "income" : "expense",
      amount,
      item_name: it.label,
      category_id: setting.category_id,
      counterparty_id: setting.counterparty_id,
      counterparty_name: setting.counterparty_name,
      has_tax: setting.has_tax,
      tax_amount: taxAmount,
      salary_item_key: it.key,
    });
  }

  if (aggPayment > 0) {
    const s = settings["__aggregate_payment__"];
    const hasTax = s?.has_tax ?? false;
    out.push({
      tx_type: "income",
      amount: aggPayment,
      item_name: `${slipTypeLabel}（支給合計）`,
      category_id: s?.category_id ?? null,
      counterparty_id: s?.counterparty_id ?? null,
      counterparty_name: s?.counterparty_name ?? null,
      has_tax: hasTax,
      tax_amount: hasTax ? Math.round(aggPayment * taxRate / (100 + taxRate)) : 0,
      salary_item_key: "__aggregate_payment__",
    });
  }
  if (aggDeduction > 0) {
    const s = settings["__aggregate_deduction__"];
    const hasTax = s?.has_tax ?? false;
    out.push({
      tx_type: "expense",
      amount: aggDeduction,
      item_name: `${slipTypeLabel}（控除合計）`,
      category_id: s?.category_id ?? null,
      counterparty_id: s?.counterparty_id ?? null,
      counterparty_name: s?.counterparty_name ?? null,
      has_tax: hasTax,
      tax_amount: hasTax ? Math.round(aggDeduction * taxRate / (100 + taxRate)) : 0,
      salary_item_key: "__aggregate_deduction__",
    });
  }
  return out;
}

export function sumBySection(amounts: SlipItemAmounts, section: SalarySection): number {
  return SALARY_ITEMS
    .filter((it) => it.section === section)
    .reduce((sum, it) => sum + (amounts[it.key] ?? 0), 0);
}

export function summarizeSlipItems(items: { item_key: string; amount: number }[]): { payment: number; deduction: number; net: number } {
  let payment = 0, deduction = 0;
  for (const it of items) {
    const def = SALARY_ITEM_MAP.get(it.item_key);
    if (!def) continue;
    if (def.section === "deduction") deduction += it.amount;
    else payment += it.amount;
  }
  return { payment, deduction, net: payment - deduction };
}
