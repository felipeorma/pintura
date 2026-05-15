import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, CheckCircle, XCircle, Lightbulb, ClipboardCheck } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear } from 'date-fns';

interface ReviewItem {
  id: string;
  item_type: string;
  message: string;
  status: string;
}

interface MonthlyData {
  incomeBeforeGst: number;
  gstCollected: number;
  gstItc: number;
  estimatedGstPayable: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  missingReceipts: number;
  needsReview: number;
  estimatedProfit: number;
  taxReservePercent: number;
  suggestedTaxReserve: number;
  wcbPaid: number;
}

export function TaxReviewPage() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<ReviewItem[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'monthly'>('suggestions');

  useEffect(() => {
    if (user) {
      generateSuggestions();
      loadMonthlyData();
    }
  }, [user]);

  async function generateSuggestions() {
    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;

    const [expenses, mileage, workHours, invoices, homeOffice, profile] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', user!.id).gte('expense_date', yearStart),
      supabase.from('mileage_logs').select('*').eq('user_id', user!.id).gte('log_date', yearStart),
      supabase.from('work_hours').select('*').eq('user_id', user!.id).eq('status', 'not_invoiced'),
      supabase.from('invoices').select('*').eq('user_id', user!.id).gte('invoice_date', yearStart),
      supabase.from('home_office_settings').select('*').eq('user_id', user!.id).maybeSingle(),
      supabase.from('profiles').select('gst_enabled').eq('id', user!.id).maybeSingle(),
    ]);

    const items: ReviewItem[] = [];
    const expenseData = expenses.data || [];
    const mileageData = mileage.data || [];
    const workHoursData = workHours.data || [];

    const hasFuelExpenses = expenseData.some(e => e.category === 'Fuel' || e.category === 'Vehicle / auto');
    if (hasFuelExpenses && mileageData.length === 0) {
      items.push({ id: '1', item_type: 'mileage', message: 'You entered fuel/vehicle expenses but no mileage log. Add mileage records to support your vehicle deductions.', status: 'open' });
    }

    const phoneExpenses = expenseData.filter(e => e.category === 'Phone');
    const phoneWithLowBiz = phoneExpenses.filter(e => e.business_use_percent === 100);
    if (phoneWithLowBiz.length > 0) {
      items.push({ id: '2', item_type: 'business_use', message: 'You have phone bills at 100% business use. Consider if a reasonable percentage (50-80%) would be more accurate.', status: 'open' });
    }

    if (!homeOffice.data && expenseData.some(e => e.category === 'Internet' || e.home_office_related)) {
      items.push({ id: '3', item_type: 'home_office', message: 'You have internet/home expenses but no home office setup. Configure your workspace percentage to support deductions.', status: 'open' });
    }

    const largeTools = expenseData.filter(e => e.description?.includes('capital asset') || (e.subtotal_before_gst > 500 && e.category === 'Tools and equipment'));
    if (largeTools.length > 0) {
      items.push({ id: '4', item_type: 'capital_asset', message: 'You bought tools over $500. Check if these should be a current expense or capital asset (CCA) for depreciation.', status: 'open' });
    }

    if (profile.data?.gst_enabled) {
      const gstCollected = (invoices.data || []).reduce((s: number, i: any) => s + (i.gst_amount || 0), 0);
      if (gstCollected > 0) {
        items.push({ id: '5', item_type: 'gst', message: `You collected $${gstCollected.toFixed(2)} in GST this year. Keep this amount separate - it is not your income.`, status: 'open' });
      }
    }

    if (workHoursData.length > 0) {
      const totalUninvoiced = workHoursData.reduce((s: number, w: any) => s + (w.subtotal || 0), 0);
      items.push({ id: '6', item_type: 'uninvoiced', message: `You have ${workHoursData.length} uninvoiced work entries ($${totalUninvoiced.toFixed(2)}). Create invoices to track billing.`, status: 'open' });
    }

    const noReceipt = expenseData.filter(e => !e.receipt_uploaded && !e.receipt_url);
    if (noReceipt.length > 0) {
      items.push({ id: '7', item_type: 'receipt', message: `${noReceipt.length} expense(s) are missing receipts. Upload receipt photos to support your deductions.`, status: 'open' });
    }

    const reviewNeeded = expenseData.filter(e => e.tax_confidence_status === 'needs_review' || e.tax_confidence_status === 'ask_accountant');
    if (reviewNeeded.length > 0) {
      items.push({ id: '8', item_type: 'review', message: `${reviewNeeded.length} expense(s) are marked for review. Check these before tax filing.`, status: 'open' });
    }

    const internetExpenses = expenseData.filter(e => e.category === 'Internet');
    const internetFullBiz = internetExpenses.filter(e => e.business_use_percent === 100);
    if (internetFullBiz.length > 0) {
      items.push({ id: '9', item_type: 'business_use', message: 'Internet expenses are at 100% business use. A reasonable percentage (15-40%) is usually more appropriate for home internet.', status: 'open' });
    }

    setSuggestions(items);
    setLoading(false);
  }

  async function loadMonthlyData() {
    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const yearStart = format(startOfYear(now), 'yyyy-MM-dd');

    const [invoices, expenses, wcb, profile] = await Promise.all([
      supabase.from('invoices').select('subtotal, gst_amount').eq('user_id', user!.id).gte('invoice_date', monthStart).lte('invoice_date', monthEnd).in('status', ['sent', 'paid']),
      supabase.from('expenses').select('category, deductible_amount, itc_claim_amount, receipt_uploaded, receipt_url, tax_confidence_status').eq('user_id', user!.id).gte('expense_date', monthStart).lte('expense_date', monthEnd),
      supabase.from('wcb_payments').select('amount').eq('user_id', user!.id).gte('payment_date', yearStart).eq('status', 'paid'),
      supabase.from('profiles').select('default_tax_reserve_percent').eq('id', user!.id).maybeSingle(),
    ]);

    const expData = expenses.data || [];
    const invData = invoices.data || [];

    const expensesByCategory: Record<string, number> = {};
    expData.forEach(e => {
      const cat = e.category || 'Uncategorized';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (e.deductible_amount || 0);
    });

    const incomeBeforeGst = invData.reduce((s, i) => s + (i.subtotal || 0), 0);
    const gstCollected = invData.reduce((s, i) => s + (i.gst_amount || 0), 0);
    const gstItc = expData.reduce((s, e) => s + (e.itc_claim_amount || 0), 0);
    const totalExpenses = expData.reduce((s, e) => s + (e.deductible_amount || 0), 0);
    const missingReceipts = expData.filter(e => !e.receipt_uploaded && !e.receipt_url).length;
    const needsReview = expData.filter(e => e.tax_confidence_status === 'needs_review' || e.tax_confidence_status === 'ask_accountant').length;
    const wcbPaid = (wcb.data || []).reduce((s, w) => s + (w.amount || 0), 0);
    const taxReservePercent = profile.data?.default_tax_reserve_percent || 25;

    const estimatedProfit = incomeBeforeGst - totalExpenses - wcbPaid;
    const suggestedTaxReserve = Math.max(0, estimatedProfit * (taxReservePercent / 100));

    setMonthlyData({
      incomeBeforeGst,
      gstCollected,
      gstItc,
      estimatedGstPayable: Math.max(0, gstCollected - gstItc),
      expensesByCategory,
      totalExpenses,
      missingReceipts,
      needsReview,
      estimatedProfit,
      taxReservePercent,
      suggestedTaxReserve,
      wcbPaid,
    });
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tax Planning</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Review your records and get suggestions to stay organized.</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('suggestions')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'suggestions' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
          Suggestions {suggestions.length > 0 && `(${suggestions.length})`}
        </button>
        <button onClick={() => setActiveTab('monthly')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'monthly' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
          Monthly Review
        </button>
      </div>

      {activeTab === 'suggestions' && (
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="text-sm text-gray-500 dark:text-gray-400">All good! No suggestions at this time.</p>
            </div>
          ) : suggestions.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 flex gap-3">
              <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-200">{item.message}</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">{item.item_type.replace('_', ' ')}</p>
              </div>
            </div>
          ))}

          <div className="mt-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">These suggestions are based on your records. This is not official tax advice. No fake expenses are suggested.</p>
          </div>
        </div>
      )}

      {activeTab === 'monthly' && monthlyData && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Income (before GST)</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">${monthlyData.incomeBeforeGst.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">GST Collected</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">${monthlyData.gstCollected.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">GST ITC (paid on expenses)</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">${monthlyData.gstItc.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Estimated GST Payable</span>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">${monthlyData.estimatedGstPayable.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">${monthlyData.totalExpenses.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">WCB Paid (Year)</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">${monthlyData.wcbPaid.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Estimated Profit</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">${monthlyData.estimatedProfit.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tax Reserve ({monthlyData.taxReservePercent}%)</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">${monthlyData.suggestedTaxReserve.toFixed(2)}</span>
            </div>
          </div>

          {/* Expenses by category */}
          {Object.keys(monthlyData.expensesByCategory).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Expenses by Category</h3>
              <div className="space-y-2">
                {Object.entries(monthlyData.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                  <div key={cat} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{cat}</span>
                    <span className="font-medium text-gray-900 dark:text-white">${amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checklist */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> Tax Season Checklist</h3>
            <div className="space-y-2">
              <CheckItem ok={monthlyData.missingReceipts === 0} label={monthlyData.missingReceipts === 0 ? 'All receipts uploaded' : `${monthlyData.missingReceipts} receipt(s) missing`} />
              <CheckItem ok={monthlyData.needsReview === 0} label={monthlyData.needsReview === 0 ? 'No expenses need review' : `${monthlyData.needsReview} expense(s) need review`} />
              <CheckItem ok={monthlyData.gstCollected === 0 || monthlyData.estimatedGstPayable >= 0} label="GST tracked" />
              <CheckItem ok={monthlyData.wcbPaid > 0} label="WCB payments recorded" />
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center italic">This is an estimate only and not official tax advice.</p>
        </div>
      )}
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-amber-500" />}
      <span className={`text-sm ${ok ? 'text-gray-600 dark:text-gray-400' : 'text-amber-700 dark:text-amber-300'}`}>{label}</span>
    </div>
  );
}
