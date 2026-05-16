import { getYearRates } from './taxRates';

export interface TaxBreakdown {
  netBusinessIncome: number;
  employmentIncome: number;
  totalIncome: number;
  cppContribution: number;
  cpp2Contribution: number;
  totalCpp: number;
  cppDeduction: number;
  cppAlreadyPaid: number;
  selfEmployedCppOwing: number;
  taxableIncome: number;
  federalTax: number;
  albertaTax: number;
  personalCredits: number;
  refundableCredits: number;
  taxAlreadyWithheld: number;
  totalTax: number;
  totalTaxBeforeWithholding: number;
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

export interface TaxOptions {
  employmentIncome?: number;
  taxAlreadyWithheld?: number;
  cppAlreadyPaid?: number;
  eiAlreadyPaid?: number;
  pensionAdjustment?: number;
  rrspDeduction?: number;
  unionDues?: number;
  rppContributions?: number;
  personalCredits?: {
    tuition: number;
    medical: number;
    charitable: number;
    canadaTraining: number;
  };
  otherIncome?: number;
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

export function calculateCpp(
  netBusinessIncome: number,
  year: number,
  cppAlreadyPaid = 0,
  employmentPensionableEarnings = 0
): { cpp: number; cpp2: number; deduction: number; selfEmployedCppOwing: number } {
  const rates = getYearRates(year);
  const { basicExemption, ympe, yampe, rate, cpp2Rate, maxContribution, maxCpp2Contribution } = rates.cpp;

  const combinedPensionable = netBusinessIncome + employmentPensionableEarnings;
  const totalPensionableEarnings = Math.max(0, Math.min(combinedPensionable, ympe) - basicExemption);
  const totalCpp1Owed = Math.min(totalPensionableEarnings * rate, maxContribution);

  // Self-employed owes both halves on their business income,
  // but total CPP across all sources is capped at max.
  // The employee half already paid via T4 reduces what's owed.
  // For self-employed: they owe both halves on their portion.
  const employeeCppPaid = cppAlreadyPaid; // box_16 is employee's half only
  const employerCppPaid = cppAlreadyPaid; // employer matches it (not shown on T4 but counts toward ceiling)

  // Business pensionable earnings (after removing what's already covered by T4)
  const businessPensionable = Math.max(0, Math.min(netBusinessIncome, ympe - employmentPensionableEarnings) - Math.max(0, basicExemption - employmentPensionableEarnings));

  const selfEmployedCpp1 = Math.min(
    businessPensionable * rate,
    Math.max(0, totalCpp1Owed - employeeCppPaid - employerCppPaid)
  );

  // CPP2: earnings between YMPE and YAMPE
  let totalCpp2 = 0;
  if (combinedPensionable > ympe) {
    const cpp2Earnings = Math.min(combinedPensionable, yampe) - ympe;
    totalCpp2 = Math.min(cpp2Earnings * cpp2Rate, maxCpp2Contribution);
  }

  const totalCpp = selfEmployedCpp1 + totalCpp2;
  const deduction = totalCpp / 2;

  return {
    cpp: selfEmployedCpp1,
    cpp2: totalCpp2,
    deduction,
    selfEmployedCppOwing: totalCpp,
  };
}

function calculateCharitableCredit(amount: number, taxableIncome: number): { federal: number; alberta: number } {
  const first200Federal = Math.min(amount, 200) * 0.15;
  const restFederal = Math.max(0, amount - 200) * (taxableIncome > 235675 ? 0.33 : 0.29);
  const federal = first200Federal + restFederal;

  const first200AB = Math.min(amount, 200) * 0.10;
  const restAB = Math.max(0, amount - 200) * 0.21;
  const alberta = first200AB + restAB;

  return { federal, alberta };
}

function calculateMedicalCredit(amount: number, netIncome: number): { federal: number; alberta: number } {
  const threshold = Math.min(netIncome * 0.03, 2759);
  const eligible = Math.max(0, amount - threshold);
  return {
    federal: eligible * 0.15,
    alberta: eligible * 0.10,
  };
}

export function calculatePersonalTax(
  netBusinessIncome: number,
  year: number,
  otherIncomeOrOptions: number | TaxOptions = 0,
  rrspDeductionLegacy = 0
): TaxBreakdown {
  const rates = getYearRates(year);

  let options: TaxOptions;
  if (typeof otherIncomeOrOptions === 'number') {
    options = { otherIncome: otherIncomeOrOptions, rrspDeduction: rrspDeductionLegacy };
  } else {
    options = otherIncomeOrOptions;
  }

  const employmentIncome = options.employmentIncome || 0;
  const otherIncome = options.otherIncome || 0;
  const rrspDeduction = options.rrspDeduction || 0;
  const taxAlreadyWithheld = options.taxAlreadyWithheld || 0;
  const cppAlreadyPaid = options.cppAlreadyPaid || 0;
  const employmentPensionable = options.employmentIncome || 0;
  const unionDues = options.unionDues || 0;
  const rppContributions = options.rppContributions || 0;
  const credits = options.personalCredits || { tuition: 0, medical: 0, charitable: 0, canadaTraining: 0 };

  const totalIncome = netBusinessIncome + employmentIncome + otherIncome;

  const { cpp, cpp2, deduction: cppDeduction, selfEmployedCppOwing } = calculateCpp(
    netBusinessIncome, year, cppAlreadyPaid, employmentPensionable
  );
  const totalCpp = cpp + cpp2;

  const taxableIncome = Math.max(0, totalIncome - cppDeduction - rrspDeduction - unionDues - rppContributions);

  const federalTaxableIncome = Math.max(0, taxableIncome - rates.federalBPA);
  let federalTax = applyBrackets(federalTaxableIncome, rates.federal);

  const albertaTaxableIncome = Math.max(0, taxableIncome - rates.albertaBPA);
  let albertaTax = applyBrackets(albertaTaxableIncome, rates.alberta);

  // Non-refundable personal credits
  let totalNonRefundable = 0;

  // Tuition credit: 15% federal, 10% Alberta
  if (credits.tuition > 0) {
    const tuitionFed = credits.tuition * 0.15;
    const tuitionAB = credits.tuition * 0.10;
    federalTax = Math.max(0, federalTax - tuitionFed);
    albertaTax = Math.max(0, albertaTax - tuitionAB);
    totalNonRefundable += tuitionFed + tuitionAB;
  }

  // Medical credit
  if (credits.medical > 0) {
    const med = calculateMedicalCredit(credits.medical, totalIncome);
    federalTax = Math.max(0, federalTax - med.federal);
    albertaTax = Math.max(0, albertaTax - med.alberta);
    totalNonRefundable += med.federal + med.alberta;
  }

  // Charitable credit
  if (credits.charitable > 0) {
    const char = calculateCharitableCredit(credits.charitable, taxableIncome);
    federalTax = Math.max(0, federalTax - char.federal);
    albertaTax = Math.max(0, albertaTax - char.alberta);
    totalNonRefundable += char.federal + char.alberta;
  }

  // CPP/EI credits for employees (non-refundable)
  if (cppAlreadyPaid > 0) {
    const cppCredit = cppAlreadyPaid * 0.15;
    federalTax = Math.max(0, federalTax - cppCredit);
  }

  // Refundable credits
  const refundableCredits = credits.canadaTraining;

  const totalTaxBeforeWithholding = federalTax + albertaTax + selfEmployedCppOwing;
  const totalTax = Math.max(0, totalTaxBeforeWithholding - refundableCredits - taxAlreadyWithheld);

  const federalMarginal = getMarginalRate(federalTaxableIncome, rates.federal);
  const albertaMarginal = getMarginalRate(albertaTaxableIncome, rates.alberta);
  const marginalRate = federalMarginal + albertaMarginal;

  const effectiveRate = totalIncome > 0 ? totalTaxBeforeWithholding / totalIncome : 0;
  const afterTaxIncome = totalIncome - totalTaxBeforeWithholding;
  const monthlyReserve = totalTax / 12;

  return {
    netBusinessIncome,
    employmentIncome,
    totalIncome,
    cppContribution: cpp,
    cpp2Contribution: cpp2,
    totalCpp,
    cppDeduction,
    cppAlreadyPaid,
    selfEmployedCppOwing,
    taxableIncome,
    federalTax,
    albertaTax,
    personalCredits: totalNonRefundable,
    refundableCredits,
    taxAlreadyWithheld,
    totalTax,
    totalTaxBeforeWithholding,
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
  'WCB': 'Insurance (line 8690)',
  'WCB Premium': 'Insurance (line 8690)',
  'WCB Penalty/Interest': 'Non-deductible (ITA 67.6)',
  'Other': 'Other expenses',
};

export function mapCategoryToT2125Line(category: string): string {
  return T2125_CATEGORIES[category] || 'Other expenses';
}
