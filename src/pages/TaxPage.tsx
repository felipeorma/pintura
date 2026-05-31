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
