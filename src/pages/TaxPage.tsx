import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calculator, Lightbulb, AlertTriangle, CheckCircle, TrendingUp, Car, Home, Receipt, Clock, DollarSign } from 'lucide-react';

interface TaxData {
  gstCollected: number;
  gstPaidOnExpenses: number;
  estimatedGstPayable: number;
  incomeBeforeGst: number;
  expenses: number;
  wcbPaid: number;
  estimatedProfit: number;
  taxReservePercent: number;
  suggestedTaxReserve: number;
  estimatedSafeCash: number;
  paymentsReceived: number;
}

interface OptimizationTip {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  potentialSavings: number | null;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

export function TaxPage() {
  const { user } = useAuth();
  const [data, setData] = useState<TaxData | null>(null);
  const [tips, setTips] = useState<OptimizationTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showTips, setShowTips] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user, year]);

  async function loadData() {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const [invoices, expenses, wcb, payments, profile, mileageLogs, vehicles, homeOffice, workHours, expensesAll] = await Promise.all([
      supabase.from('invoices').select('subtotal, gst_amount').eq('user_id', user!.id).gte('invoice_date', yearStart).lte('invoice_date', yearEnd).in('status', ['sent', 'paid']),
      supabase.from('expenses').select('deductible_amount, itc_claim_amount').eq('user_id', user!.id).gte('expense_date', yearStart).lte('expense_date', yearEnd),
      supabase.from('wcb_payments').select('amount').eq('user_id', user!.id).gte('payment_date', yearStart).lte('payment_date', yearEnd).eq('status', 'paid'),
      supabase.from('payments').select('amount').eq('user_id', user!.id).gte('payment_date', yearStart).lte('payment_date', yearEnd),
      supabase.from('profiles').select('default_tax_reserve_percent').eq('id', user!.id).maybeSingle(),
      supabase.from('mileage_logs').select('km_driven').eq('user_id', user!.id).gte('log_date', yearStart).lte('log_date', yearEnd),
      supabase.from('vehicles').select('*').eq('user_id', user!.id).eq('active', true),
      supabase.from('home_office_settings').select('*').eq('user_id', user!.id).maybeSingle(),
      supabase.from('work_hours').select('id, status').eq('user_id', user!.id).eq('status', 'not_invoiced'),
      supabase.from('expenses').select('id, category, receipt_url, expense_date, total_paid').eq('user_id', user!.id).gte('expense_date', yearStart).lte('expense_date', yearEnd),
    ]);

    const gstCollected = (invoices.data || []).reduce((s, r) => s + (r.gst_amount || 0), 0);
    const incomeBeforeGst = (invoices.data || []).reduce((s, r) => s + (r.subtotal || 0), 0);
    const gstPaidOnExpenses = (expenses.data || []).reduce((s, r) => s + (r.itc_claim_amount || 0), 0);
    const expensesTotal = (expenses.data || []).reduce((s, r) => s + (r.deductible_amount || 0), 0);
    const wcbPaid = (wcb.data || []).reduce((s, r) => s + (r.amount || 0), 0);
    const paymentsReceived = (payments.data || []).reduce((s, r) => s + (r.amount || 0), 0);

    const estimatedGstPayable = Math.max(0, gstCollected - gstPaidOnExpenses);
    const estimatedProfit = incomeBeforeGst - expensesTotal - wcbPaid;
    const taxReservePercent = profile.data?.default_tax_reserve_percent || 25;
    const suggestedTaxReserve = Math.max(0, estimatedProfit * (taxReservePercent / 100));
    const estimatedSafeCash = paymentsReceived - estimatedGstPayable - suggestedTaxReserve;

    setData({
      gstCollected,
      gstPaidOnExpenses,
      estimatedGstPayable,
      incomeBeforeGst,
      expenses: expensesTotal,
      wcbPaid,
      estimatedProfit,
      taxReservePercent,
      suggestedTaxReserve,
      estimatedSafeCash: Math.max(0, estimatedSafeCash),
      paymentsReceived,
    });

    // Generate optimization tips
    const generatedTips: OptimizationTip[] = [];

    // 1. Missing receipts
    const missingReceipts = (expensesAll.data || []).filter(e => !e.receipt_url);
    if (missingReceipts.length > 0) {
      const missingTotal = missingReceipts.reduce((s, e) => s + (e.total_paid || 0), 0);
      generatedTips.push({
        id: 'missing-receipts',
        icon: <Receipt className="w-5 h-5" />,
        title: `${missingReceipts.length} expenses without receipts`,
        description: `$${missingTotal.toFixed(0)} in expenses could be denied by CRA without proof. Upload photos of your receipts to protect these deductions.`,
        potentialSavings: null,
        priority: 'high',
        action: 'Go to Expenses and upload missing receipts',
      });
    }

    // 2. Vehicle / mileage
    const totalKm = (mileageLogs.data || []).reduce((s, r) => s + (r.km_driven || 0), 0);
    const hasVehicle = (vehicles.data || []).length > 0;
    if (!hasVehicle) {
      generatedTips.push({
        id: 'no-vehicle',
        icon: <Car className="w-5 h-5" />,
        title: 'No vehicle registered',
        description: 'If you drive to job sites, you can deduct vehicle expenses. At $0.70/km (CRA 2024 rate for first 5,000 km), even 100 km/week = $3,640/year in deductions.',
        potentialSavings: 3640,
        priority: 'high',
        action: 'Add your vehicle in the Vehicle section',
      });
    } else if (totalKm === 0) {
      generatedTips.push({
        id: 'no-mileage',
        icon: <Car className="w-5 h-5" />,
        title: 'No mileage logged this year',
        description: 'You have a vehicle registered but no trips logged. Every business trip is deductible. Start logging to build your claim.',
        potentialSavings: 2500,
        priority: 'high',
        action: 'Log your trips in the Vehicle section',
      });
    } else if (totalKm < 5000) {
      const potential = (5000 - totalKm) * 0.70;
      generatedTips.push({
        id: 'low-mileage',
        icon: <Car className="w-5 h-5" />,
        title: `Only ${totalKm.toFixed(0)} km logged so far`,
        description: `CRA allows the first 5,000 km at $0.70/km. Make sure you're logging ALL business trips -- to job sites, supply stores, client meetings, etc.`,
        potentialSavings: potential > 500 ? potential : null,
        priority: 'medium',
        action: 'Review if you have unlogged trips',
      });
    }

    // 3. Home office
    if (!homeOffice.data) {
      generatedTips.push({
        id: 'no-home-office',
        icon: <Home className="w-5 h-5" />,
        title: 'Home office not set up',
        description: 'If you do admin work from home (invoicing, planning, bookkeeping), you can deduct a portion of rent/mortgage interest, utilities, insurance, and internet.',
        potentialSavings: 1500,
        priority: 'medium',
        action: 'Set up your home office in the Home Office section',
      });
    } else if ((homeOffice.data.business_use_percent || 0) < 10) {
      generatedTips.push({
        id: 'low-home-office',
        icon: <Home className="w-5 h-5" />,
        title: 'Home office at very low percentage',
        description: 'Your business use is under 10%. If you have a dedicated workspace, recalculate based on square footage. A 150sqft office in a 1200sqft home = 12.5%.',
        potentialSavings: null,
        priority: 'low',
        action: 'Review your home office calculation',
      });
    }

    // 4. Uninvoiced hours
    const uninvoicedCount = (workHours.data || []).length;
    if (uninvoicedCount > 10) {
      generatedTips.push({
        id: 'uninvoiced-hours',
        icon: <Clock className="w-5 h-5" />,
        title: `${uninvoicedCount} hours not yet invoiced`,
        description: 'Uninvoiced work means uncollected income. Invoice regularly to maintain cash flow and keep your records current for year-end.',
        potentialSavings: null,
        priority: 'medium',
        action: 'Create invoices for outstanding work',
      });
    }

    // 5. Expense categories check
    const allExpenses = expensesAll.data || [];
    const categories = new Set(allExpenses.map(e => e.category));
    const commonDeductions = ['Phone', 'Internet', 'Safety equipment', 'Work clothing', 'Tools and equipment', 'Insurance'];
    const missingCategories = commonDeductions.filter(c => !categories.has(c));
    if (missingCategories.length >= 3 && incomeBeforeGst > 0) {
      generatedTips.push({
        id: 'missing-categories',
        icon: <DollarSign className="w-5 h-5" />,
        title: 'Common deductions you may be missing',
        description: `You haven't claimed: ${missingCategories.slice(0, 3).join(', ')}${missingCategories.length > 3 ? ` and ${missingCategories.length - 3} more` : ''}. These are all legitimate business expenses for a painter.`,
        potentialSavings: null,
        priority: 'medium',
        action: 'Review common expenses and add any you paid',
      });
    }

    // 6. Low expense ratio warning
    if (incomeBeforeGst > 0 && expensesTotal > 0) {
      const ratio = expensesTotal / incomeBeforeGst;
      if (ratio < 0.15) {
        generatedTips.push({
          id: 'low-expenses',
          icon: <TrendingUp className="w-5 h-5" />,
          title: 'Your expense ratio is very low',
          description: `Expenses are only ${(ratio * 100).toFixed(0)}% of income. Most painters/contractors have 25-40%. You may be paying for business items out of pocket without tracking them.`,
          potentialSavings: incomeBeforeGst * 0.1,
          priority: 'medium',
          action: 'Track all receipts -- even small purchases add up',
        });
      }
    }

    // 7. GST ITC optimization
    if (gstCollected > 0 && gstPaidOnExpenses === 0 && allExpenses.length > 0) {
      generatedTips.push({
        id: 'no-itc',
        icon: <DollarSign className="w-5 h-5" />,
        title: 'No GST Input Tax Credits claimed',
        description: 'You collected GST but have $0 in ITCs. Make sure to enter the GST portion when logging expenses -- you get that money back when filing.',
        potentialSavings: gstCollected * 0.2,
        priority: 'high',
        action: 'Update expenses with GST amounts paid',
      });
    }

    // 8. Year-end planning
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 9 && estimatedProfit > 30000) {
      generatedTips.push({
        id: 'year-end',
        icon: <Calculator className="w-5 h-5" />,
        title: 'Consider year-end purchases',
        description: `With $${estimatedProfit.toFixed(0)} estimated profit, buying tools, safety gear, or supplies before Dec 31 reduces your taxable income for this year.`,
        potentialSavings: estimatedProfit * 0.05,
        priority: 'medium',
        action: 'Plan purchases before December 31',
      });
    }

    setTips(generatedTips.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }));

    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;
  if (!data) return null;

  const rows = [
    { label: 'Income (before GST)', value: data.incomeBeforeGst, info: 'Total from invoices sent/paid' },
    { label: 'GST Collected', value: data.gstCollected, info: 'GST is not income - keep it separate' },
    { label: 'GST Paid on Expenses (ITC)', value: data.gstPaidOnExpenses, info: 'You can claim this back' },
    { label: 'Estimated GST Payable', value: data.estimatedGstPayable, info: 'GST Collected minus ITC' },
    { label: 'Business Expenses', value: data.expenses, info: 'Deductible expenses' },
    { label: 'WCB Paid', value: data.wcbPaid, info: 'WCB payments are business expenses' },
    { label: 'Estimated Profit', value: data.estimatedProfit, info: 'Income - expenses - WCB' },
    { label: `Tax Reserve (${data.taxReservePercent}%)`, value: data.suggestedTaxReserve, info: 'Set aside for income tax' },
    { label: 'Payments Received', value: data.paymentsReceived, info: 'Cash actually received' },
    { label: 'Estimated Safe Cash', value: data.estimatedSafeCash, info: 'After GST and tax reserve' },
  ];

  const priorityColors = {
    high: { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-800', icon: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    medium: { bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
    low: { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800', icon: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GST / Tax Estimate</h1>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Tax Optimization Tips */}
      {tips.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowTips(!showTips)}
            className="flex items-center gap-2 mb-3 group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <Lightbulb className="w-4 h-4 text-teal-700 dark:text-teal-300" />
            </div>
            <div className="flex-1 text-left">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                Tax Optimization Tips
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tips.length} action{tips.length !== 1 ? 's' : ''} to maximize your deductions
              </p>
            </div>
            <span className="text-xs text-gray-400">{showTips ? 'Hide' : 'Show'}</span>
          </button>

          {showTips && (
            <div className="space-y-3">
              {tips.map(tip => {
                const colors = priorityColors[tip.priority];
                return (
                  <div key={tip.id} className={`${colors.bg} border ${colors.border} rounded-xl p-4 transition-all`}>
                    <div className="flex gap-3">
                      <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
                        {tip.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tip.title}</h3>
                          <span className={`flex-shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${colors.badge}`}>
                            {tip.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{tip.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 italic">{tip.action}</span>
                          {tip.potentialSavings && (
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              ~ ${tip.potentialSavings.toFixed(0)} potential
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {tips.filter(t => t.potentialSavings).length > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Estimated potential savings if all actions are taken:
                  </p>
                  <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
                    ${tips.reduce((s, t) => s + (t.potentialSavings || 0), 0).toFixed(0)}
                  </p>
                </div>
              )}
            </div>
          )}

          {tips.length === 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">Looking good! No immediate actions needed.</p>
            </div>
          )}
        </div>
      )}

      {/* Tax Summary Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{row.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{row.info}</p>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">${row.value.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Disclaimer</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">This is an estimate only and not official tax advice. Consult a tax professional for accurate filing.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
