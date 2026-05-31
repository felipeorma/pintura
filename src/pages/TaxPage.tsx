import { useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  AlertTriangle,
  Calculator,
  Car,
  CheckCircle,
  ClipboardCheck,
  DollarSign,
  FileText,
  Home,
  Lightbulb,
  Receipt,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface TaxData {
  incomeBeforeGst: number;
  gstCollected: number;
  gstItc: number;
  gstPayable: number;
  expenses: number;
  wcbPaid: number;
  paymentsReceived: number;
  estimatedProfit: number;
  federalTax: number;
  albertaTax: number;
  cpp: number;
  cpp2: number;
  incomeTaxAndCpp: number;
  totalToSave: number;
  safeCash: number;
  filingDeadline: string;
  paymentDeadline: string;
  missingReceipts: number;
  missingReceiptsAmount: number;
  needsReview: number;
  totalKm: number;
  hasVehicle: boolean;
  hasHomeOffice: boolean;
  uninvoicedCount: number;
  uninvoicedAmount: number;
  formRows: FormRow[];
  opportunities: Opportunity[];
}

interface FormRow {
  form: string;
  line: string;
  description: string;
  amount: number;
}

interface Opportunity {
  id: string;
  priority: 'high' | 'medium' | 'low';
  icon: ReactElement;
  title: string;
  detail: string;
  action: string;
  estimate?: number;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value || 0);

const COMMON_DEDUCTION_CATEGORIES = [
  'Materials and supplies',
  'Tools and equipment',
  'Parking',
  'Phone',
  'Internet',
  'Insurance',
  'Bank fees',
  'Accounting / tax preparation',
  'Safety equipment',
  'Work clothing',
];

const CATEGORY_LINES: Record<string, { line: string; label: string }> = {
  'Materials and supplies': { line: 'T2125 line 8320 / 8811', label: 'Materials, supplies, office supplies' },
  'Tools and equipment': { line: 'T2125 CCA area / line 9270 if current expense', label: 'Tools and equipment' },
  'Vehicle / auto': { line: 'T2125 line 9281 + Motor vehicle chart', label: 'Motor vehicle expenses' },
  Fuel: { line: 'T2125 line 9281 + Motor vehicle chart', label: 'Fuel and vehicle costs' },
  Parking: { line: 'T2125 line 9281', label: 'Parking for business trips' },
  Phone: { line: 'T2125 line 9220', label: 'Telephone and utilities' },
  Internet: { line: 'T2125 line 9220 / business-use-of-home', label: 'Internet business portion' },
  'Home office': { line: 'T2125 line 9945', label: 'Business-use-of-home expenses' },
  WCB: { line: 'T2125 line 8760 / 8690', label: 'Business fees or insurance' },
  Insurance: { line: 'T2125 line 8690', label: 'Business insurance' },
  'Business license / admin': { line: 'T2125 line 8760', label: 'Licences, dues, memberships' },
  'Software / apps': { line: 'T2125 line 8810', label: 'Office/software expenses' },
  'Bank fees': { line: 'T2125 line 8710', label: 'Interest and bank charges' },
  'Accounting / tax preparation': { line: 'T2125 line 8860', label: 'Professional fees' },
  'Safety equipment': { line: 'T2125 line 8811 / 9270', label: 'Safety supplies and equipment' },
  'Work clothing': { line: 'T2125 line 8811 / 9270', label: 'Protective work clothing' },
  Meals: { line: 'T2125 line 8523', label: 'Meals and entertainment' },
  'Subcontractor payments': { line: 'T2125 line 8360', label: 'Subcontracts' },
  Other: { line: 'T2125 line 9270', label: 'Other expenses' },
};

const FEDERAL_2024 = [
  { from: 0, to: 55867, rate: 0.15 },
  { from: 55867, to: 111733, rate: 0.205 },
  { from: 111733, to: 173205, rate: 0.26 },
  { from: 173205, to: 246752, rate: 0.29 },
  { from: 246752, to: Infinity, rate: 0.33 },
];

const FEDERAL_2025 = [
  { from: 0, to: 57375, rate: 0.145 },
  { from: 57375, to: 114750, rate: 0.205 },
  { from: 114750, to: 177882, rate: 0.26 },
  { from: 177882, to: 253414, rate: 0.29 },
  { from: 253414, to: Infinity, rate: 0.33 },
];

const FEDERAL_2026 = [
  { from: 0, to: 58523, rate: 0.14 },
  { from: 58523, to: 117045, rate: 0.205 },
  { from: 117045, to: 181440, rate: 0.26 },
  { from: 181440, to: 258482, rate: 0.29 },
  { from: 258482, to: Infinity, rate: 0.33 },
];

const ALBERTA_2024 = [
  { from: 0, to: 148269, rate: 0.10 },
  { from: 148269, to: 177922, rate: 0.12 },
  { from: 177922, to: 237230, rate: 0.13 },
  { from: 237230, to: 355845, rate: 0.14 },
  { from: 355845, to: Infinity, rate: 0.15 },
];

const ALBERTA_2025 = [
  { from: 0, to: 60000, rate: 0.08 },
  { from: 60000, to: 151234, rate: 0.10 },
  { from: 151234, to: 181481, rate: 0.12 },
  { from: 181481, to: 241974, rate: 0.13 },
  { from: 241974, to: 362961, rate: 0.14 },
  { from: 362961, to: Infinity, rate: 0.15 },
];

const ALBERTA_2026 = [
  { from: 0, to: 61200, rate: 0.08 },
  { from: 61200, to: 154259, rate: 0.10 },
  { from: 154259, to: 185111, rate: 0.12 },
  { from: 185111, to: 246813, rate: 0.13 },
  { from: 246813, to: 370220, rate: 0.14 },
  { from: 370220, to: Infinity, rate: 0.15 },
];

function bracketTax(income: number, brackets: typeof FEDERAL_2024) {
  return brackets.reduce((tax, bracket) => {
    const taxable = Math.max(0, Math.min(income, bracket.to) - bracket.from);
    return tax + taxable * bracket.rate;
  }, 0);
}

function estimateIncomeTax(profit: number, year: number) {
  const taxable = Math.max(0, profit);
  const federalBrackets = year >= 2026 ? FEDERAL_2026 : year === 2025 ? FEDERAL_2025 : FEDERAL_2024;
  const albertaBrackets = year >= 2026 ? ALBERTA_2026 : year === 2025 ? ALBERTA_2025 : ALBERTA_2024;
  const federalBasicAmount = year >= 2026 ? 16452 : year === 2025 ? 16129 : 15705;
  const federalFirstRate = year >= 2026 ? 0.14 : year === 2025 ? 0.145 : 0.15;
  const albertaBasicAmount = year >= 2026 ? 22769 : year === 2025 ? 22323 : 21885;
  return {
    federalTax: Math.max(0, bracketTax(taxable, federalBrackets) - federalBasicAmount * federalFirstRate),
    albertaTax: Math.max(0, bracketTax(taxable, albertaBrackets) - albertaBasicAmount * 0.08),
  };
}

function estimateCpp(profit: number, year: number) {
  const ympe = year >= 2026 ? 74600 : year === 2025 ? 71300 : 68500;
  const yampe = year >= 2026 ? 85000 : year === 2025 ? 81200 : 73200;
  const exemption = 3500;
  const base = Math.max(0, Math.min(profit, ympe) - exemption) * 0.119;
  const second = Math.max(0, Math.min(profit, yampe) - ympe) * 0.08;
  return { cpp: base, cpp2: second };
}

function getDeadlines(year: number) {
  if (year === 2024) return { filingDeadline: 'June 16, 2025', paymentDeadline: 'April 30, 2025' };
  return { filingDeadline: `June 15, ${year + 1}`, paymentDeadline: `April 30, ${year + 1}` };
}

function expenseLineRows(expensesByCategory: Record<string, number>) {
  return Object.entries(expensesByCategory)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      const info = CATEGORY_LINES[category] || CATEGORY_LINES.Other;
      return {
        form: 'T2125',
        line: info.line,
        description: `${info.label} (${category})`,
        amount,
      };
    });
}

export function TaxPage() {
  const { user } = useAuth();
  const [data, setData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<'plan' | 'forms' | 'optimize'>('plan');

  useEffect(() => {
    if (user) loadData();
  }, [user, year]);

  async function loadData() {
    setLoading(true);
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const [invoices, expenses, wcb, payments, mileageLogs, vehicles, homeOffice, workHours] = await Promise.all([
      supabase.from('invoices').select('subtotal, gst_amount').eq('user_id', user!.id).gte('invoice_date', yearStart).lte('invoice_date', yearEnd).in('status', ['sent', 'paid']),
      supabase.from('expenses').select('category, description, deductible_amount, itc_claim_amount, total_paid, receipt_uploaded, receipt_url, tax_confidence_status, business_use_percent, subtotal_before_gst').eq('user_id', user!.id).gte('expense_date', yearStart).lte('expense_date', yearEnd),
      supabase.from('wcb_payments').select('amount, amount_paid').eq('user_id', user!.id).gte('payment_date', yearStart).lte('payment_date', yearEnd).eq('status', 'paid'),
      supabase.from('payments').select('amount').eq('user_id', user!.id).gte('payment_date', yearStart).lte('payment_date', yearEnd),
      supabase.from('mileage_logs').select('km_driven').eq('user_id', user!.id).gte('log_date', yearStart).lte('log_date', yearEnd),
      supabase.from('vehicles').select('id').eq('user_id', user!.id).eq('active', true),
      supabase.from('home_office_settings').select('id, business_use_percent').eq('user_id', user!.id).maybeSingle(),
      supabase.from('work_hours').select('subtotal').eq('user_id', user!.id).eq('status', 'not_invoiced'),
    ]);

    const invoiceData = invoices.data || [];
    const expenseData = expenses.data || [];
    const wcbData = wcb.data || [];
    const workHourData = workHours.data || [];

    const incomeBeforeGst = invoiceData.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const gstCollected = invoiceData.reduce((sum, item) => sum + (item.gst_amount || 0), 0);
    const gstItc = expenseData.reduce((sum, item) => sum + (item.itc_claim_amount || 0), 0);
    const expensesTotal = expenseData.reduce((sum, item) => sum + (item.deductible_amount || 0), 0);
    const wcbPaid = wcbData.reduce((sum, item: any) => sum + (item.amount_paid || item.amount || 0), 0);
    const paymentsReceived = (payments.data || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    const estimatedProfit = incomeBeforeGst - expensesTotal - wcbPaid;
    const gstPayable = Math.max(0, gstCollected - gstItc);
    const { federalTax, albertaTax } = estimateIncomeTax(estimatedProfit, year);
    const { cpp, cpp2 } = estimateCpp(estimatedProfit, year);
    const incomeTaxAndCpp = federalTax + albertaTax + cpp + cpp2;
    const totalToSave = gstPayable + incomeTaxAndCpp;
    const { filingDeadline, paymentDeadline } = getDeadlines(year);
    const missingReceiptRows = expenseData.filter((item: any) => !item.receipt_uploaded && !item.receipt_url);
    const needsReviewRows = expenseData.filter((item: any) => item.tax_confidence_status === 'needs_review' || item.tax_confidence_status === 'ask_accountant');
    const expensesByCategory = expenseData.reduce<Record<string, number>>((acc, item: any) => {
      const category = item.category || 'Other';
      acc[category] = (acc[category] || 0) + (item.deductible_amount || 0);
      return acc;
    }, {});
    const totalKm = (mileageLogs.data || []).reduce((sum, item) => sum + (item.km_driven || 0), 0);
    const hasVehicle = (vehicles.data || []).length > 0;
    const hasHomeOffice = Boolean(homeOffice.data);
    const uninvoicedAmount = workHourData.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
    const formRows: FormRow[] = [
      { form: 'GST/HST Return', line: 'Line 101', description: 'Sales and other revenue before GST', amount: incomeBeforeGst },
      { form: 'GST/HST Return', line: 'Line 103', description: 'GST collected or collectible', amount: gstCollected },
      { form: 'GST/HST Return', line: 'Line 106', description: 'Input tax credits from expenses', amount: gstItc },
      { form: 'GST/HST Return', line: 'Line 109', description: 'Net GST to remit', amount: gstPayable },
      { form: 'T2125', line: 'Part 3D', description: 'Gross business income before GST', amount: incomeBeforeGst },
      { form: 'T2125', line: 'Part 4', description: 'Total deductible expenses before WCB split', amount: expensesTotal },
      { form: 'T2125', line: 'Part 4', description: 'WCB paid as business expense', amount: wcbPaid },
      { form: 'T2125', line: 'Net income', description: 'Estimated net self-employment income', amount: estimatedProfit },
      { form: 'T1', line: 'Income tax', description: 'Estimated federal income tax', amount: federalTax },
      { form: 'AB428', line: 'Alberta tax', description: 'Estimated Alberta income tax', amount: albertaTax },
      { form: 'Schedule 8', line: 'CPP', description: 'Estimated self-employed CPP and CPP2', amount: cpp + cpp2 },
      ...expenseLineRows(expensesByCategory),
    ];

    const opportunities: Opportunity[] = [];
    const categories = new Set(expenseData.map((item: any) => item.category).filter(Boolean));
    const missingCommonCategories = COMMON_DEDUCTION_CATEGORIES.filter(category => !categories.has(category));
    const largeTools = expenseData.filter((item: any) =>
      item.category === 'Tools and equipment' && (item.subtotal_before_gst || 0) >= 500
    );
    const mealsTotal = expensesByCategory.Meals || 0;

    if (missingReceiptRows.length > 0) {
      opportunities.push({
        id: 'receipts',
        priority: 'high',
        icon: <Receipt className="w-5 h-5" />,
        title: `${missingReceiptRows.length} expenses need receipts`,
        detail: `${money(missingReceiptRows.reduce((sum: number, item: any) => sum + (item.total_paid || 0), 0))} could be hard to defend if CRA asks for proof.`,
        action: 'Upload receipts before filing.',
      });
    }

    if (!hasVehicle) {
      opportunities.push({
        id: 'vehicle',
        priority: 'high',
        icon: <Car className="w-5 h-5" />,
        title: 'Vehicle not set up',
        detail: 'If you drive to job sites, suppliers, estimates, or client meetings, track the business portion and keep a logbook.',
        action: 'Add vehicle and start logging business kilometres.',
        estimate: 2500,
      });
    } else if (totalKm === 0) {
      opportunities.push({
        id: 'mileage',
        priority: 'high',
        icon: <Car className="w-5 h-5" />,
        title: 'No mileage logged',
        detail: 'Vehicle expenses need business-use support. A logbook protects the deduction.',
        action: 'Record trips for job sites, suppliers, estimates, and client visits.',
      });
    } else if (!categories.has('Parking')) {
      opportunities.push({
        id: 'parking',
        priority: 'low',
        icon: <Car className="w-5 h-5" />,
        title: 'Review business parking',
        detail: 'CRA allows the full amount of parking fees related to business activities, even when other vehicle costs are prorated.',
        action: 'Add parking receipts for suppliers, estimates, client visits, and job sites.',
      });
    }

    if (!hasHomeOffice) {
      opportunities.push({
        id: 'home-office',
        priority: 'medium',
        icon: <Home className="w-5 h-5" />,
        title: 'Home office not configured',
        detail: 'Admin work from home can support a portion of rent, utilities, insurance, internet, and maintenance.',
        action: 'Set up square footage and business-use percentage.',
        estimate: 1200,
      });
    }

    if (gstCollected > 0 && gstItc === 0 && expenseData.length > 0) {
      opportunities.push({
        id: 'itc',
        priority: 'high',
        icon: <DollarSign className="w-5 h-5" />,
        title: 'No GST input tax credits claimed',
        detail: 'You are collecting GST but not claiming GST paid on business expenses.',
        action: 'Edit expenses and enter GST paid where the receipt shows GST.',
        estimate: Math.min(gstCollected * 0.25, expensesTotal * 0.05),
      });
    } else if (gstCollected > 0 && gstItc > 0) {
      opportunities.push({
        id: 'itc-history',
        priority: 'low',
        icon: <DollarSign className="w-5 h-5" />,
        title: 'Review unclaimed GST input tax credits',
        detail: 'Eligible GST/HST paid on prior business expenses may still be claimable within the CRA time limit when supported by proper documents.',
        action: 'Review older receipts for missed GST and confirm the eligible claim period before filing.',
      });
    }

    if (incomeBeforeGst > 30000 && gstCollected === 0) {
      opportunities.push({
        id: 'gst-registration',
        priority: 'high',
        icon: <AlertTriangle className="w-5 h-5" />,
        title: 'Review GST registration immediately',
        detail: 'Your tracked taxable revenue exceeds $30,000 and no GST is recorded. CRA registration and charging rules may apply based on the quarter when you crossed the threshold.',
        action: 'Confirm your GST/HST registration status and effective date before sending more invoices.',
      });
    }

    if (gstCollected > 0 && incomeBeforeGst > 0 && incomeBeforeGst <= 400000) {
      opportunities.push({
        id: 'gst-quick-method',
        priority: 'low',
        icon: <Calculator className="w-5 h-5" />,
        title: 'Compare the GST/HST Quick Method',
        detail: 'Some eligible small businesses with taxable sales within the CRA limit can elect a simplified GST/HST calculation. It is not automatically better because most ITCs are handled differently.',
        action: 'Ask your accountant to compare the regular method against the Quick Method before making a GST74 election.',
      });
    }

    if (incomeTaxAndCpp > 3000) {
      opportunities.push({
        id: 'instalments',
        priority: 'high',
        icon: <DollarSign className="w-5 h-5" />,
        title: 'Plan for CRA income-tax instalments',
        detail: `${money(incomeTaxAndCpp)} estimated tax and CPP is above the $3,000 threshold used in the CRA instalment rules outside Quebec. Prior-year balances also matter.`,
        action: 'Check CRA My Account for INNS1 reminders and plan for March 15, June 15, September 15, and December 15 payments.',
      });
    }

    if (mealsTotal > 0) {
      opportunities.push({
        id: 'meals',
        priority: 'medium',
        icon: <Receipt className="w-5 h-5" />,
        title: 'Confirm the allowable meals amount',
        detail: `${money(mealsTotal)} is recorded under meals. CRA generally limits meals and entertainment deductions to 50% of the lesser of the actual or reasonable amount.`,
        action: 'Confirm the deductible amount and keep receipts plus the business purpose for each meal.',
      });
    }

    if (largeTools.length > 0) {
      opportunities.push({
        id: 'cca',
        priority: 'medium',
        icon: <Calculator className="w-5 h-5" />,
        title: `${largeTools.length} tool purchases may need CCA review`,
        detail: `${money(largeTools.reduce((sum: number, item: any) => sum + (item.subtotal_before_gst || 0), 0))} in larger tool purchases may be capital assets instead of current expenses.`,
        action: 'Ask your accountant whether to claim capital cost allowance (CCA).',
      });
    }

    if (missingCommonCategories.length >= 3 && incomeBeforeGst > 0) {
      opportunities.push({
        id: 'missing-categories',
        priority: 'medium',
        icon: <Receipt className="w-5 h-5" />,
        title: 'Review commonly missed deductions',
        detail: `No expenses are recorded yet for: ${missingCommonCategories.slice(0, 5).join(', ')}${missingCommonCategories.length > 5 ? ', and more' : ''}.`,
        action: 'Check bank and credit-card statements. Add only real business expenses with supporting documents.',
      });
    }

    if (estimatedProfit > 0) {
      opportunities.push({
        id: 'registered-savings',
        priority: 'low',
        icon: <DollarSign className="w-5 h-5" />,
        title: 'Review RRSP and FHSA contribution room',
        detail: 'Eligible RRSP contributions can reduce taxable income. If you qualify as a first-time home buyer, FHSA contributions are generally deductible too.',
        action: 'Check your CRA account or Notice of Assessment before contributing. Do not exceed your available room.',
      });
    }

    if (estimatedProfit > 0 && estimatedProfit < 50000) {
      opportunities.push({
        id: 'benefits',
        priority: 'low',
        icon: <ShieldCheck className="w-5 h-5" />,
        title: 'Check refundable benefits and personal credits',
        detail: 'Depending on family net income and your situation, filing may unlock benefits such as the Canada Workers Benefit and GST/HST credit.',
        action: 'Confirm spouse, dependant, medical, childcare, disability, and donation details in your tax software.',
      });
    }

    if (needsReviewRows.length > 0) {
      opportunities.push({
        id: 'review',
        priority: 'medium',
        icon: <ShieldCheck className="w-5 h-5" />,
        title: `${needsReviewRows.length} expenses marked for review`,
        detail: 'Clean these before filing so your accountant is not guessing.',
        action: 'Review category, business-use percentage, receipt, and notes.',
      });
    }

    if (workHourData.length > 0) {
      opportunities.push({
        id: 'uninvoiced',
        priority: 'medium',
        icon: <FileText className="w-5 h-5" />,
        title: `${workHourData.length} uninvoiced work entries`,
        detail: `${money(uninvoicedAmount)} is not billed yet, which affects cash flow and year-end planning.`,
        action: 'Create invoices or mark entries correctly.',
      });
    }

    if (incomeBeforeGst > 0 && expensesTotal / incomeBeforeGst < 0.15) {
      opportunities.push({
        id: 'low-expenses',
        priority: 'medium',
        icon: <TrendingUp className="w-5 h-5" />,
        title: 'Expense ratio looks low',
        detail: `Tracked expenses are only ${((expensesTotal / incomeBeforeGst) * 100).toFixed(1)}% of income. Contractors often miss small supplies, parking, phone, internet, tools, bank fees, and accounting costs.`,
        action: 'Review bank/credit card statements for legitimate business purchases.',
      });
    }

    if (expenseData.length > 0) {
      opportunities.push({
        id: 'records',
        priority: 'low',
        icon: <ClipboardCheck className="w-5 h-5" />,
        title: 'Keep a six-year CRA audit file',
        detail: 'CRA generally requires business and tax records to be kept for at least six years. Receipts alone may not be enough for every claim.',
        action: 'Keep readable receipts, invoices, bank statements, contracts, mileage logs, and CRA notices together by tax year.',
      });
    }

    setData({
      incomeBeforeGst,
      gstCollected,
      gstItc,
      gstPayable,
      expenses: expensesTotal,
      wcbPaid,
      paymentsReceived,
      estimatedProfit,
      federalTax,
      albertaTax,
      cpp,
      cpp2,
      incomeTaxAndCpp,
      totalToSave,
      safeCash: Math.max(0, paymentsReceived - totalToSave),
      filingDeadline,
      paymentDeadline,
      missingReceipts: missingReceiptRows.length,
      missingReceiptsAmount: missingReceiptRows.reduce((sum: number, item: any) => sum + (item.total_paid || 0), 0),
      needsReview: needsReviewRows.length,
      totalKm,
      hasVehicle,
      hasHomeOffice,
      uninvoicedCount: workHourData.length,
      uninvoicedAmount,
      formRows,
      opportunities: opportunities.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])),
    });
    setLoading(false);
  }

  const reservePercent = useMemo(() => {
    if (!data || data.paymentsReceived <= 0) return 0;
    return Math.min(100, (data.totalToSave / data.paymentsReceived) * 100);
  }, [data]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;
  if (!data) return null;

  const summaryCards = [
    { label: 'Keep saved for filing', value: data.totalToSave, detail: `${money(data.gstPayable)} GST + ${money(data.incomeTaxAndCpp)} tax/CPP`, tone: 'red' },
    { label: 'Estimated net profit', value: data.estimatedProfit, detail: 'Income minus expenses and WCB', tone: 'gray' },
    { label: 'Safe cash after reserve', value: data.safeCash, detail: `${reservePercent.toFixed(1)}% of received payments reserved`, tone: 'emerald' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Command Center</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">GST, income tax reserve, CRA forms, and legal deduction planning.</p>
        </div>
        <select value={year} onChange={event => setYear(Number(event.target.value))} className="w-full sm:w-auto px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm">
          {[2024, 2025, 2026].map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.tone === 'red' ? 'text-red-600 dark:text-red-400' : card.tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>{money(card.value)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{card.detail}</p>
          </div>
        ))}
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Current Tax Return Estimate</p>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">Estimated balance owing: {money(data.incomeTaxAndCpp)}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Personal income tax and self-employed CPP based on the business records currently entered. GST is shown separately.</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Self-employed filing deadline</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{data.filingDeadline}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Pay balance by {data.paymentDeadline}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Metric label="Net business income" value={data.estimatedProfit} />
          <Metric label="Income tax estimate" value={data.federalTax + data.albertaTax} />
          <Metric label="CPP + CPP2 estimate" value={data.cpp + data.cpp2} />
          <Metric label="GST tracked separately" value={data.gstPayable} danger />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">A refund cannot be calculated accurately until personal credits, deductions, other income, and CRA instalments are entered in your filing software.</p>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Income before GST" value={data.incomeBeforeGst} />
        <Metric label="GST to remit" value={data.gstPayable} danger />
        <Metric label="Expenses + WCB" value={data.expenses + data.wcbPaid} />
        <Metric label="CPP estimate" value={data.cpp + data.cpp2} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'plan'} onClick={() => setTab('plan')} icon={<Calculator className="w-4 h-4" />} label="Plan" />
        <TabButton active={tab === 'forms'} onClick={() => setTab('forms')} icon={<ClipboardCheck className="w-4 h-4" />} label="Forms" />
        <TabButton active={tab === 'optimize'} onClick={() => setTab('optimize')} icon={<Lightbulb className="w-4 h-4" />} label={`Tax Optimization Tips (${data.opportunities.length})`} />
      </div>

      {tab === 'plan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="What to Keep Saved">
            <Row label="GST collected" value={data.gstCollected} />
            <Row label="Minus GST paid on expenses (ITCs)" value={-data.gstItc} />
            <Row label="GST payable" value={data.gstPayable} strong danger />
            <Row label="Federal income tax estimate" value={data.federalTax} />
            <Row label="Alberta income tax estimate" value={data.albertaTax} />
            <Row label="Self-employed CPP + CPP2" value={data.cpp + data.cpp2} />
            <Row label="Total to reserve" value={data.totalToSave} strong danger />
          </Panel>

          <Panel title="Filing Readiness">
            <Check ok={data.missingReceipts === 0} label={data.missingReceipts === 0 ? 'All receipts uploaded' : `${data.missingReceipts} receipts missing (${money(data.missingReceiptsAmount)})`} />
            <Check ok={data.needsReview === 0} label={data.needsReview === 0 ? 'No expenses marked for review' : `${data.needsReview} expenses need review`} />
            <Check ok={!data.hasVehicle || data.totalKm > 0} label={data.hasVehicle ? `${data.totalKm.toFixed(0)} business km logged` : 'Vehicle not configured'} />
            <Check ok={data.hasHomeOffice} label={data.hasHomeOffice ? 'Home office configured' : 'Home office not configured'} />
            <Check ok={data.uninvoicedCount === 0} label={data.uninvoicedCount === 0 ? 'No uninvoiced hours' : `${data.uninvoicedCount} uninvoiced entries (${money(data.uninvoicedAmount)})`} />
          </Panel>
        </div>
      )}

      {tab === 'forms' && (
        <Panel title="Forms and Amounts to Prepare">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="py-2 pr-3">Form</th>
                  <th className="py-2 pr-3">Line / section</th>
                  <th className="py-2 pr-3">What to enter</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.formRows.map((row, index) => (
                  <tr key={`${row.form}-${row.line}-${index}`}>
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">{row.form}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{row.line}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{row.description}</td>
                    <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'optimize' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tax Optimization Tips</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Actions to maximize deductions, reduce tax risk, and keep more cash legally.</p>
          </div>

          {data.opportunities.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Everything looks clean with the records currently entered.</p>
            </div>
          ) : data.opportunities.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 flex gap-3">
              <div className={`mt-0.5 ${item.priority === 'high' ? 'text-red-500' : item.priority === 'medium' ? 'text-amber-500' : 'text-blue-500'}`}>{item.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{item.priority}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.detail}</p>
                <p className="text-xs font-medium text-teal-700 dark:text-teal-300 mt-2">{item.action}</p>
                {item.estimate && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Possible deduction to protect: about {money(item.estimate)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400">Estimate only, based on Alberta planning assumptions and your records. Confirm with CRA software or an accountant before filing.</p>
      </div>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-lg font-bold mt-1 ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{money(value)}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactElement; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${active ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
      {icon}
      {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, strong = false, danger = false }: { label: string; value: number; strong?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className={`${strong ? 'font-semibold' : ''} text-sm text-gray-600 dark:text-gray-400`}>{label}</span>
      <span className={`${strong ? 'font-bold' : 'font-medium'} ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{money(value)}</span>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {ok ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
      <span className={`text-sm ${ok ? 'text-gray-600 dark:text-gray-400' : 'text-amber-700 dark:text-amber-300'}`}>{label}</span>
    </div>
  );
}
