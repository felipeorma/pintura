import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Profile } from '../lib/types';
import { calculatePersonalTax, calculateGst, mapCategoryToT2125Line, isInstalmentRequired, calculateInstalmentAmount } from '../lib/taxCalculator';
import { Calculator, TrendingUp, Calendar, Lightbulb, Download, ChevronDown, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'summary' | 'personal' | 'instalments' | 'tips' | 'export';

interface YearData {
  revenue: number;
  gstCollected: number;
  gstPaid: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
}

interface Instalment {
  id: string;
  year: number;
  quarter: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  paid_date: string | null;
}

export function TaxPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearData, setYearData] = useState<YearData>({ revenue: 0, gstCollected: 0, gstPaid: 0, expensesByCategory: {}, totalExpenses: 0 });
  const [instalments, setInstalments] = useState<Instalment[]>([]);
  const [otherIncome, setOtherIncome] = useState(0);
  const [rrspDeduction, setRrspDeduction] = useState(0);
  const [expandedTips, setExpandedTips] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (user) loadData();
  }, [user, selectedYear]);

  async function loadData() {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const [pRes, invRes, expRes, instRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle(),
      supabase.from('invoices').select('subtotal, gst_amount').eq('user_id', user!.id).gte('invoice_date', yearStart).lte('invoice_date', yearEnd).not('status', 'eq', 'cancelled'),
      supabase.from('expenses').select('category, subtotal_before_gst, gst_paid, business_use_percent, home_office_related').eq('user_id', user!.id).gte('expense_date', yearStart).lte('expense_date', yearEnd),
      supabase.from('tax_installments').select('*').eq('user_id', user!.id).eq('year', selectedYear).order('quarter'),
    ]);

    setProfile(pRes.data);

    const invoices = invRes.data || [];
    const revenue = invoices.reduce((s, i) => s + (i.subtotal || 0), 0);
    const gstCollected = invoices.reduce((s, i) => s + (i.gst_amount || 0), 0);

    const expenses = expRes.data || [];
    const expensesByCategory: Record<string, number> = {};
    let totalExpenses = 0;
    let gstPaid = 0;

    expenses.forEach(exp => {
      const cat = exp.category || 'Other';
      const t2125Line = mapCategoryToT2125Line(cat);
      const bup = (exp.business_use_percent || 100) / 100;
      let deductible = (exp.subtotal_before_gst || 0) * bup;

      if (cat === 'Meals') deductible *= 0.5;

      expensesByCategory[t2125Line] = (expensesByCategory[t2125Line] || 0) + deductible;
      totalExpenses += deductible;
      gstPaid += (exp.gst_paid || 0) * bup;
    });

    setYearData({ revenue, gstCollected, gstPaid, expensesByCategory, totalExpenses });
    setInstalments(instRes.data || []);
    setLoading(false);
  }

  async function markInstalmentPaid(instalment: Instalment) {
    if (instalment.id) {
      await supabase.from('tax_installments').update({ amount_paid: instalment.amount_due, paid_date: format(new Date(), 'yyyy-MM-dd') }).eq('id', instalment.id);
    } else {
      await supabase.from('tax_installments').insert({
        user_id: user!.id,
        year: selectedYear,
        quarter: instalment.quarter,
        due_date: instalment.due_date,
        amount_due: instalment.amount_due,
        amount_paid: instalment.amount_due,
        paid_date: format(new Date(), 'yyyy-MM-dd'),
      });
    }
    loadData();
  }

  const netIncome = yearData.revenue - yearData.totalExpenses;
  const taxBreakdown = calculatePersonalTax(netIncome, selectedYear, otherIncome, rrspDeduction);
  const gstSummary = calculateGst(yearData.gstCollected, yearData.gstPaid);

  const tabs: { key: Tab; label: string; icon: typeof Calculator }[] = [
    { key: 'summary', label: 'Summary', icon: Calculator },
    { key: 'personal', label: 'Tax Estimate', icon: TrendingUp },
    { key: 'instalments', label: 'Instalments', icon: Calendar },
    { key: 'tips', label: 'Tips', icon: Lightbulb },
    { key: 'export', label: 'Export', icon: Download },
  ];

  function toggleTip(idx: number) {
    setExpandedTips(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function formatMoney(n: number) {
    return n < 0 ? `-$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Centre</h1>
        <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && renderSummary()}
      {activeTab === 'personal' && renderPersonalTax()}
      {activeTab === 'instalments' && renderInstalments()}
      {activeTab === 'tips' && renderTips()}
      {activeTab === 'export' && renderExport()}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-8 text-center italic">
        Estimate only. Consult a CPA for filing.
      </p>
    </div>
  );

  function renderSummary() {
    const sortedExpenses = Object.entries(yearData.expensesByCategory).sort((a, b) => b[1] - a[1]);

    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Revenue</h3>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-700 dark:text-gray-300">Gross Sales (invoice subtotals)</span>
            <span className="text-lg font-bold text-emerald-600">{formatMoney(yearData.revenue)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-400">GST collected (not income)</span>
            <span className="text-xs text-gray-400">{formatMoney(yearData.gstCollected)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Expenses (T2125 Categories)</h3>
          <div className="space-y-2">
            {sortedExpenses.map(([cat, amount]) => (
              <div key={cat} className="flex justify-between items-center">
                <span className="text-sm text-gray-700 dark:text-gray-300">{cat}</span>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">{formatMoney(amount)}</span>
              </div>
            ))}
            {sortedExpenses.length === 0 && <p className="text-sm text-gray-400">No expenses recorded for {selectedYear}.</p>}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Total Expenses</span>
            <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatMoney(yearData.totalExpenses)}</span>
          </div>
        </div>

        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800 p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-teal-800 dark:text-teal-200">Net Business Income</span>
            <span className="text-xl font-bold text-teal-700 dark:text-teal-300">{formatMoney(netIncome)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">GST/HST Summary</h3>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">GST collected on sales</span>
              <span className="text-gray-900 dark:text-white">{formatMoney(gstSummary.collected)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">GST paid on purchases (ITCs)</span>
              <span className="text-gray-900 dark:text-white">-{formatMoney(gstSummary.paid)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700 font-semibold">
              <span className="text-gray-900 dark:text-white">{gstSummary.netOwing >= 0 ? 'Net GST owed to CRA' : 'GST refund from CRA'}</span>
              <span className={gstSummary.netOwing >= 0 ? 'text-red-600' : 'text-emerald-600'}>{formatMoney(Math.abs(gstSummary.netOwing))}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderPersonalTax() {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Adjustments (Optional)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Other personal income</label>
              <input type="number" value={otherIncome || ''} onChange={e => setOtherIncome(parseFloat(e.target.value) || 0)} min={0} placeholder="0" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">RRSP deduction</label>
              <input type="number" value={rrspDeduction || ''} onChange={e => setRrspDeduction(parseFloat(e.target.value) || 0)} min={0} placeholder="0" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tax Breakdown</h3>
          <div className="space-y-2">
            <TaxRow label="Net business income" value={formatMoney(taxBreakdown.netBusinessIncome)} />
            {otherIncome > 0 && <TaxRow label="Other income" value={formatMoney(otherIncome)} />}
            <TaxRow label="CPP deduction (half of CPP)" value={`-${formatMoney(taxBreakdown.cppDeduction)}`} />
            {rrspDeduction > 0 && <TaxRow label="RRSP deduction" value={`-${formatMoney(rrspDeduction)}`} />}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <TaxRow label="Taxable income" value={formatMoney(taxBreakdown.taxableIncome)} bold />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estimated Tax Owing</h3>
          <div className="space-y-2">
            <TaxRow label="Federal income tax" value={formatMoney(taxBreakdown.federalTax)} />
            <TaxRow label="Alberta income tax" value={formatMoney(taxBreakdown.albertaTax)} />
            <TaxRow label="CPP contributions (both halves)" value={formatMoney(taxBreakdown.totalCpp)} />
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <TaxRow label="TOTAL ESTIMATED TAX" value={formatMoney(taxBreakdown.totalTax)} bold color="text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Marginal Rate</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{(taxBreakdown.marginalRate * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Effective Rate</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{(taxBreakdown.effectiveRate * 100).toFixed(1)}%</p>
          </div>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">After-Tax Income</span>
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(taxBreakdown.afterTaxIncome)}</span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            Set aside ~{formatMoney(taxBreakdown.monthlyReserve)}/month for taxes.
          </p>
        </div>
      </div>
    );
  }

  function renderInstalments() {
    const dueDates = [
      { quarter: 1, date: `${selectedYear}-03-15` },
      { quarter: 2, date: `${selectedYear}-06-15` },
      { quarter: 3, date: `${selectedYear}-09-15` },
      { quarter: 4, date: `${selectedYear}-12-15` },
    ];

    const required = isInstalmentRequired(taxBreakdown.totalTax);
    const suggestedAmount = calculateInstalmentAmount(taxBreakdown.totalTax);

    return (
      <div className="space-y-4">
        <div className={`rounded-xl border p-4 ${required ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
          <div className="flex items-center gap-2">
            {required ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <Check className="w-4 h-4 text-emerald-600" />}
            <span className={`text-sm font-medium ${required ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-800 dark:text-emerald-200'}`}>
              {required ? 'Quarterly instalments likely required (est. tax > $3,000)' : 'Instalments likely not required (est. tax < $3,000)'}
            </span>
          </div>
          {required && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 ml-6">
              Suggested instalment: {formatMoney(suggestedAmount)} per quarter
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {dueDates.map(dd => {
            const inst = instalments.find(i => i.quarter === dd.quarter);
            const isPaid = inst && inst.amount_paid > 0;
            const isPast = new Date(dd.date) < new Date() && !isPaid;

            return (
              <div key={dd.quarter} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Q{dd.quarter} — {format(new Date(dd.date + 'T00:00'), 'MMMM d, yyyy')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isPaid ? `Paid ${format(new Date(inst!.paid_date + 'T00:00'), 'MMM d')} — ${formatMoney(inst!.amount_paid)}` : `Due: ${formatMoney(suggestedAmount)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isPast && !isPaid && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">Overdue</span>
                  )}
                  {isPaid ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" /> Paid
                    </span>
                  ) : (
                    <button
                      onClick={() => markInstalmentPaid({ id: inst?.id || '', year: selectedYear, quarter: dd.quarter, due_date: dd.date, amount_due: suggestedAmount, amount_paid: 0, paid_date: null })}
                      className="px-3 py-1 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                    >
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderTips() {
    const tips = getTips();
    return (
      <div className="space-y-2">
        {tips.map((tip, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleTip(idx)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white">{tip.title}</span>
              {expandedTips.has(idx) ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
            </button>
            {expandedTips.has(idx) && (
              <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line border-t border-gray-100 dark:border-gray-700 pt-3">
                {tip.content}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function getTips() {
    const homePercent = profile?.home_office_percent || 0;
    const vehiclePercent = profile?.vehicle_business_use_percent || 0;
    const phonePercent = profile?.phone_business_use_percent || 50;
    const internetPercent = profile?.internet_business_use_percent || 25;
    const homeExpenses = yearData.expensesByCategory['Business-use-of-home expenses'] || 0;
    const marginalSavings5k = 5000 * taxBreakdown.marginalRate;

    return [
      { title: '1. Business-Use-of-Home (T2125 Part 7)', content: `You're claiming ${homePercent}% of home expenses.\nBased on entries this year, deduction so far: ${formatMoney(homeExpenses)}.\nIncludes: utilities, internet, property tax, mortgage interest (NOT principal), insurance, maintenance, rent.\nLimit: cannot create or increase a business loss.` },
      { title: '2. Vehicle Expenses (T2125 Chart A)', content: `Business use: ${vehiclePercent}%.\nKeep a logbook with total km and business km per trip.\nDeductible: fuel x business %, insurance x business %, maintenance x business %, lease payments x business % (capped), licensing, CCA on the vehicle.` },
      { title: '3. Meals & Entertainment (50% rule)', content: `Only 50% is deductible. Separate this expense category.\nDoesn't apply to long-haul travel meals (those are 80%).` },
      { title: '4. Tools, Supplies, Work Clothing', content: `Paint, brushes, rollers, drop cloths, ladders, scaffolding, coveralls, safety boots, masks — fully deductible the year purchased (if under $500). Larger items go through CCA.` },
      { title: '5. Phone & Internet (business portion)', content: `Phone business use: ${phonePercent}%.\nInternet business use: ${internetPercent}%.\nDeduct only that portion of your bills.` },
      { title: '6. Professional Development', content: `Courses, WHMIS, fall protection, asbestos awareness, association memberships (e.g. MPI), trade magazines — all deductible.` },
      { title: '7. CPP Self-Employed (both halves)', content: `As self-employed you pay 11.9% CPP on net business income above $3,500 (max YMPE $71,300 in 2025). Half is deductible from taxable income — this estimate already accounts for that.\nYour estimated CPP: ${formatMoney(taxBreakdown.totalCpp)}.` },
      { title: '8. RRSP Contribution Room', content: `Contribution limit: 18% of last year's earned income, up to $32,490 (2025 max). RRSP contributions reduce this year's taxable income dollar-for-dollar.\nEstimated tax savings on a $5,000 contribution at your marginal rate: ${formatMoney(marginalSavings5k)}.` },
      { title: '9. TFSA (tax-free growth)', content: `No deduction today, but all growth and withdrawals are tax-free forever. 2025 room: $7,000 (plus any unused room).` },
      { title: '10. Quarterly Instalment Compliance', content: `If your net tax owing exceeds $3,000, CRA requires quarterly instalments (March 15, June 15, Sept 15, Dec 15). Missing them triggers interest and penalties.` },
      { title: '11. Should You Incorporate?', content: `At your current net income of ${formatMoney(netIncome)}, incorporation MAY make sense if income exceeds $80K-$100K AND you don't need to spend it all personally (small business rate = 11% combined fed+AB on active income under $500K). But it adds compliance costs (~$1,500-3,000/yr). Talk to a CPA.` },
      { title: '12. GST/HST Registration Threshold', content: `Mandatory once gross revenue exceeds $30,000 in any 4 consecutive quarters. You're currently at ${formatMoney(yearData.revenue)} this year.${!profile?.gst_enabled ? ' Even below that, voluntary registration lets you claim ITCs on business purchases.' : ''}` },
      { title: '13. Record Keeping (6 years)', content: `Keep all receipts, invoices, mileage logs, contracts for 6 years after the fiscal year. Digital copies are accepted if legible.` },
      { title: '14. Capital Cost Allowance (CCA)', content: `Big purchases (truck, equipment > $500) aren't fully deducted year one — they depreciate via CCA classes.\nClass 10 (vehicles) = 30%/year.\nClass 8 (tools, equipment) = 20%/year.` },
    ];
  }

  function renderExport() {
    function downloadCSV(filename: string, headers: string[], rows: string[][]) {
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    async function exportInvoices() {
      const { data } = await supabase.from('invoices').select('*, clients(name)').eq('user_id', user!.id).gte('invoice_date', `${selectedYear}-01-01`).lte('invoice_date', `${selectedYear}-12-31`).order('invoice_date');
      if (!data) return;
      const headers = ['Invoice #', 'Date', 'Client', 'Subtotal', 'GST', 'Total', 'Status'];
      const rows = data.map(i => [i.invoice_number, i.invoice_date, (i as any).clients?.name || '', i.subtotal.toFixed(2), i.gst_amount.toFixed(2), i.total_amount.toFixed(2), i.status]);
      downloadCSV(`invoices-${selectedYear}.csv`, headers, rows);
    }

    async function exportExpenses() {
      const { data } = await supabase.from('expenses').select('*').eq('user_id', user!.id).gte('expense_date', `${selectedYear}-01-01`).lte('expense_date', `${selectedYear}-12-31`).order('expense_date');
      if (!data) return;
      const headers = ['Date', 'Vendor', 'Category', 'Description', 'Subtotal', 'GST Paid', 'Total', 'Business %', 'Deductible', 'T2125 Line'];
      const rows = data.map(e => [e.expense_date, e.vendor || '', e.category || '', e.description || '', e.subtotal_before_gst.toFixed(2), e.gst_paid.toFixed(2), e.total_paid.toFixed(2), String(e.business_use_percent), e.deductible_amount.toFixed(2), mapCategoryToT2125Line(e.category || 'Other')]);
      downloadCSV(`expenses-${selectedYear}.csv`, headers, rows);
    }

    async function exportGst() {
      const { data: inv } = await supabase.from('invoices').select('invoice_date, subtotal, gst_amount').eq('user_id', user!.id).gte('invoice_date', `${selectedYear}-01-01`).lte('invoice_date', `${selectedYear}-12-31`).not('status', 'eq', 'cancelled');
      const { data: exp } = await supabase.from('expenses').select('expense_date, gst_paid, business_use_percent').eq('user_id', user!.id).gte('expense_date', `${selectedYear}-01-01`).lte('expense_date', `${selectedYear}-12-31`);
      const totalCollected = (inv || []).reduce((s, i) => s + i.gst_amount, 0);
      const totalPaid = (exp || []).reduce((s, e) => s + (e.gst_paid * (e.business_use_percent / 100)), 0);
      const headers = ['Description', 'Amount'];
      const rows = [['GST Collected', totalCollected.toFixed(2)], ['ITCs (GST Paid)', totalPaid.toFixed(2)], ['Net GST Owing', (totalCollected - totalPaid).toFixed(2)]];
      downloadCSV(`gst-report-${selectedYear}.csv`, headers, rows);
    }

    async function exportMileage() {
      const { data } = await supabase.from('mileage_logs').select('*, clients(name), job_sites(site_name)').eq('user_id', user!.id).gte('log_date', `${selectedYear}-01-01`).lte('log_date', `${selectedYear}-12-31`).order('log_date');
      if (!data) return;
      const headers = ['Date', 'From', 'To', 'Client', 'Job Site', 'KM', 'Purpose'];
      const rows = data.map(l => [l.log_date, l.start_location || '', l.destination || '', (l as any).clients?.name || '', (l as any).job_sites?.site_name || '', String(l.km_driven), l.purpose || '']);
      downloadCSV(`mileage-log-${selectedYear}.csv`, headers, rows);
    }

    const buttons = [
      { label: 'Export Invoices (CSV)', onClick: exportInvoices },
      { label: 'Export Expenses (CSV)', onClick: exportExpenses },
      { label: 'Export GST/HST Report (CSV)', onClick: exportGst },
      { label: 'Export Vehicle Log (CSV)', onClick: exportMileage },
    ];

    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Export data for your accountant or CRA filings for {selectedYear}.</p>
        {buttons.map(btn => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900 dark:text-white">{btn.label}</span>
            <Download className="w-4 h-4 text-teal-600" />
          </button>
        ))}
      </div>
    );
  }
}

function TaxRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${color || 'text-gray-900 dark:text-white'}`}>{value}</span>
    </div>
  );
}
