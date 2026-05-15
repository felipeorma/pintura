import { getYearRates } from './taxRates';

export interface TaxBreakdown {
  netBusinessIncome: number;
  cppContribution: number;
  cpp2Contribution: number;
  totalCpp: number;
  cppDeduction: number;
  taxableIncome: number;
  federalTax: number;
  albertaTax: number;
  totalTax: number;
  marginalRate: number;
  effectiveRate: number;
  afterTaxIncome: number;
  monthlyReserve: number;
}

export interface GstSummary {
  collected: number;
  paid: number;
  netOwing: number;
}

function applyBrackets(income: number, brackets: { min: number; max: number | null; rate: number }[]): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const upper = bracket.max !== null ? Math.min(income, bracket.max) : income;
    tax += (upper - bracket.min) * bracket.rate;
  }
  return tax;
}

function getMarginalRate(income: number, brackets: { min: number; max: number | null; rate: number }[]): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (income > brackets[i].min) return brackets[i].rate;
  }
  return brackets[0].rate;
}

export function calculateCpp(netIncome: number, year: number): { cpp: number; cpp2: number; deduction: number } {
  const rates = getYearRates(year);
  const { basicExemption, ympe, yampe, rate, cpp2Rate, maxContribution, maxCpp2Contribution } = rates.cpp;

  const pensionableEarnings = Math.max(0, Math.min(netIncome, ympe) - basicExemption);
  const cpp = Math.min(pensionableEarnings * rate, maxContribution);

  let cpp2 = 0;
  if (netIncome > ympe) {
    const cpp2Earnings = Math.min(netIncome, yampe) - ympe;
    cpp2 = Math.min(cpp2Earnings * cpp2Rate, maxCpp2Contribution);
  }

  const deduction = (cpp + cpp2) / 2;
  return { cpp, cpp2, deduction };
}

export function calculatePersonalTax(netBusinessIncome: number, year: number, otherIncome = 0, rrspDeduction = 0): TaxBreakdown {
  const rates = getYearRates(year);
  const totalIncome = netBusinessIncome + otherIncome;

  const { cpp, cpp2, deduction: cppDeduction } = calculateCpp(netBusinessIncome, year);
  const totalCpp = cpp + cpp2;

  const taxableIncome = Math.max(0, totalIncome - cppDeduction - rrspDeduction);

  const federalTaxableIncome = Math.max(0, taxableIncome - rates.federalBPA);
  const federalTax = applyBrackets(federalTaxableIncome, rates.federal);

  const albertaTaxableIncome = Math.max(0, taxableIncome - rates.albertaBPA);
  const albertaTax = applyBrackets(albertaTaxableIncome, rates.alberta);

  const totalTax = federalTax + albertaTax + totalCpp;

  const federalMarginal = getMarginalRate(federalTaxableIncome, rates.federal);
  const albertaMarginal = getMarginalRate(albertaTaxableIncome, rates.alberta);
  const marginalRate = federalMarginal + albertaMarginal;

  const effectiveRate = totalIncome > 0 ? totalTax / totalIncome : 0;
  const afterTaxIncome = totalIncome - totalTax;
  const monthlyReserve = totalTax / 12;

  return {
    netBusinessIncome,
    cppContribution: cpp,
    cpp2Contribution: cpp2,
    totalCpp,
    cppDeduction,
    taxableIncome,
    federalTax,
    albertaTax,
    totalTax,
    marginalRate,
    effectiveRate,
    afterTaxIncome,
    monthlyReserve,
  };
}

export function calculateGst(gstCollected: number, gstPaid: number): GstSummary {
  return {
    collected: gstCollected,
    paid: gstPaid,
    netOwing: gstCollected - gstPaid,
  };
}

export function isInstalmentRequired(previousYearTax: number): boolean {
  return previousYearTax > 3000;
}

export function calculateInstalmentAmount(previousYearTax: number): number {
  return previousYearTax / 4;
}

export const T2125_CATEGORIES: Record<string, string> = {
  'Advertising': 'Advertising',
  'Meals': 'Meals & entertainment (50%)',
  'Insurance': 'Insurance',
  'Bank fees': 'Interest & bank charges',
  'Office supplies': 'Office expenses',
  'Accounting / tax preparation': 'Professional fees',
  'Rent': 'Rent',
  'Maintenance & repairs': 'Maintenance & repairs',
  'Subcontractor payments': 'Salaries, wages, benefits',
  'Travel': 'Travel expenses',
  'Phone': 'Telephone & utilities',
  'Internet': 'Telephone & utilities',
  'Fuel': 'Fuel costs',
  'Vehicle / auto': 'Motor vehicle expenses',
  'Materials and supplies': 'Supplies',
  'Tools and equipment': 'Tools (under $500)',
  'Safety equipment': 'Supplies',
  'Work clothing': 'Supplies',
  'Home office': 'Business-use-of-home expenses',
  'Software / apps': 'Office expenses',
  'Business license / admin': 'Licences, memberships',
  'WCB': 'Insurance',
  'Other': 'Other expenses',
};

export function mapCategoryToT2125Line(category: string): string {
  return T2125_CATEGORIES[category] || 'Other expenses';
}
