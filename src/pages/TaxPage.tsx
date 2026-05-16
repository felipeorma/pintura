import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Profile, PersonalTaxCredit, PersonalCreditType, EmploymentIncome } from '../lib/types';
import { PERSONAL_CREDIT_TYPES } from '../lib/types';
import { calculatePersonalTax, calculateGst, mapCategoryToT2125Line, isInstalmentRequired, calculateInstalmentAmount } from '../lib/taxCalculator';
import type { TaxOptions } from '../lib/taxCalculator';
import { marginalRate as getMarginalRate, taxSavingsFromDeduction, bracketHeadroom } from '../lib/taxOptimizer';
import { getYearRates } from '../lib/taxRates';
import { TipCard } from '../components/TipCard';
import {
  Calculator, TrendingUp, Calendar, Lightbulb, Download, ChevronDown, ChevronRight, Check, AlertTriangle,
  Home, Car, Wrench, ShoppingCart, Users, Utensils, Phone, Receipt, PiggyBank, BarChart3,
  Building2, ShieldCheck, GraduationCap, ClipboardCheck, Wallet, Plus, Trash2, Award
} from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'summary' | 'personal' | 'credits' | 'instalments' | 'tips' | 'export';

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
  const [tipsData, setTipsData] = useState<{
    trackedKm: number;
    workDays: number;
    tripDays: number;
    avgKmPerTrip: number;
    mealExpenses: number;
    toolExpenses: number;
    profDevExpenses: number;
    phoneExpenses: number;
    internetExpenses: number;
    homeOfficeExpenses: number;
    wcbPaid: number;
  }>({ trackedKm: 0, workDays: 0, tripDays: 0, avgKmPerTrip: 0, mealExpenses: 0, toolExpenses: 0, profDevExpenses: 0, phoneExpenses: 0, internetExpenses: 0, homeOfficeExpenses: 0, wcbPaid: 0 });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [rrspPlanned, setRrspPlanned] = useState(0);
  const [employmentData, setEmploymentData] = useState<EmploymentIncome[]>([]);
  const [personalCredits, setPersonalCredits] = useState<PersonalTaxCredit[]>([]);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditForm, setCreditForm] = useState({ credit_type: 'tuition' as PersonalCreditType, amount: 0, description: '', t_form_received: false, notes: '' });
  const navigate = useNavigate();

  useEffect(() => {
    if (user) loadData();
  }, [user, selectedYear]);

  async function loadData() {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const [pRes, invRes, expRes, instRes, wcbInstRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle(),
      supabase.from('invoices').select('subtotal, gst_amount').eq('user_id', user!.id).gte('invoice_date', yearStart).lte('invoice_date', yearEnd).not('status', 'eq', 'cancelled'),
      supabase.from('expenses').select('category, subtotal_before_gst, gst_paid, business_use_percent, home_office_related').eq('user_id', user!.id).gte('expense_date', yearStart).lte('expense_date', yearEnd),
      supabase.from('tax_installments').select('*').eq('user_id', user!.id).eq('year', selectedYear).order('quarter'),
      supabase.from('wcb_installments').select('amount_paid, paid_date').eq('user_id', user!.id),
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
      if (cat === 'WCB Penalty/Interest') return;
      const t2125Line = mapCategoryToT2125Line(cat);
      const bup = (exp.business_use_percent || 100) / 100;
      let deductible = (exp.subtotal_before_gst || 0) * bup;

      if (cat === 'Meals') deductible *= 0.5;

      expensesByCategory[t2125Line] = (expensesByCategory[t2125Line] || 0) + deductible;
      totalExpenses += deductible;
      gstPaid += (exp.gst_paid || 0) * bup;
    });

    const wcbDeductiblePremiums = (wcbInstRes.data || []).reduce((s, i) => s + (i.amount_paid || 0), 0);
    if (wcbDeductiblePremiums > 0) {
      const insuranceLine = 'Insurance (line 8690)';
      expensesByCategory[insuranceLine] = (expensesByCategory[insuranceLine] || 0) + wcbDeductiblePremiums;
      totalExpenses += wcbDeductiblePremiums;
    }

    setYearData({ revenue, gstCollected, gstPaid, expensesByCategory, totalExpenses });
    setInstalments(instRes.data || []);

    const [mileageRes, workHoursRes, checklistRes, empRes, creditsRes] = await Promise.all([
      supabase.from('mileage_logs').select('km_driven, log_date').eq('user_id', user!.id).gte('log_date', yearStart).lte('log_date', yearEnd),
      supabase.from('work_hours').select('work_date').eq('user_id', user!.id).gte('work_date', yearStart).lte('work_date', yearEnd),
      supabase.from('year_end_checklist').select('item_key, checked').eq('user_id', user!.id).eq('year', selectedYear),
      supabase.from('employment_income').select('*').eq('user_id', user!.id).eq('year', selectedYear),
      supabase.from('personal_tax_credits').select('*').eq('user_id', user!.id).eq('year', selectedYear).order('created_at', { ascending: false }),
    ]);

    setEmploymentData(empRes.data || []);
    setPersonalCredits(creditsRes.data || []);

    const mileageLogs = mileageRes.data || [];
    const trackedKm = mileageLogs.reduce((s, l) => s + (l.km_driven || 0), 0);
    const tripDates = new Set(mileageLogs.map(l => l.log_date));
    const avgKmPerTrip = mileageLogs.length > 0 ? trackedKm / mileageLogs.length : 25;

    const workDates = new Set((workHoursRes.data || []).map(w => w.work_date));
    const workDays = workDates.size;
    const tripDays = tripDates.size;

    let mealExp = 0, toolExp = 0, profDevExp = 0, phoneExp = 0, internetExp = 0, homeExp = 0;
    expenses.forEach(exp => {
      const cat = exp.category || '';
      const amt = (exp.subtotal_before_gst || 0) * ((exp.business_use_percent || 100) / 100);
      if (cat === 'Meals') mealExp += amt * 0.5;
      if (cat === 'Tools and equipment') toolExp += amt;
      if (cat === 'Software / apps' || cat === 'Accounting / tax preparation') profDevExp += amt;
      if (cat === 'Phone') phoneExp += (exp.subtotal_before_gst || 0);
      if (cat === 'Internet') internetExp += (exp.subtotal_before_gst || 0);
      if (cat === 'Home office') homeExp += amt;
    });

    setTipsData({
      trackedKm,
      workDays,
      tripDays,
      avgKmPerTrip,
      mealExpenses: mealExp,
      toolExpenses: toolExp,
      profDevExpenses: profDevExp,
      phoneExpenses: phoneExp,
      internetExpenses: internetExp,
      homeOfficeExpenses: homeExp,
      wcbPaid: wcbDeductiblePremiums,
    });

    const checklistMap: Record<string, boolean> = {};
    (checklistRes.data || []).forEach(c => { checklistMap[c.item_key] = c.checked; });
    setChecklist(checklistMap);

    if (pRes.data?.rrsp_planned_contribution) {
      setRrspPlanned(pRes.data.rrsp_planned_contribution);
    }

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
  const totalEmploymentIncome = employmentData.reduce((s, e) => s + e.box_14_employment_income, 0);
  const totalTaxWithheld = employmentData.reduce((s, e) => s + e.box_22_income_tax_deducted, 0);
  const totalCppPaid = employmentData.reduce((s, e) => s + e.box_16_cpp_contributions, 0);
  const totalEiPaid = employmentData.reduce((s, e) => s + e.box_18_ei_premiums, 0);
  const totalUnionDues = employmentData.reduce((s, e) => s + e.box_44_union_dues, 0);
  const totalRpp = employmentData.reduce((s, e) => s + e.box_20_rpp_contributions, 0);

  const creditTotals = {
    tuition: personalCredits.filter(c => c.credit_type === 'tuition').reduce((s, c) => s + c.amount, 0),
    medical: personalCredits.filter(c => c.credit_type === 'medical').reduce((s, c) => s + c.amount, 0),
    charitable: personalCredits.filter(c => c.credit_type === 'charitable').reduce((s, c) => s + c.amount, 0),
    canadaTraining: personalCredits.filter(c => c.credit_type === 'canada_training').reduce((s, c) => s + c.amount, 0),
  };

  const taxOptions: TaxOptions = {
    employmentIncome: totalEmploymentIncome,
    taxAlreadyWithheld: totalTaxWithheld,
    cppAlreadyPaid: totalCppPaid,
    eiAlreadyPaid: totalEiPaid,
    unionDues: totalUnionDues,
    rppContributions: totalRpp,
    rrspDeduction: rrspPlanned,
    personalCredits: creditTotals,
    otherIncome,
  };

  const taxBreakdown = calculatePersonalTax(netIncome, selectedYear, taxOptions);
  const gstSummary = calculateGst(yearData.gstCollected, yearData.gstPaid);

  const tabs: { key: Tab; label: string; icon: typeof Calculator }[] = [
    { key: 'summary', label: 'Summary', icon: Calculator },
    { key: 'personal', label: 'Tax Estimate', icon: TrendingUp },
    { key: 'credits', label: 'Personal Credits', icon: Award },
    { key: 'instalments', label: 'Instalments', icon: Calendar },
    { key: 'tips', label: 'Tips', icon: Lightbulb },
    { key: 'export', label: 'Export', icon: Download },
  ];

  function toggleSection(key: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function toggleChecklistItem(key: string) {
    const newChecked = !checklist[key];
    setChecklist(prev => ({ ...prev, [key]: newChecked }));
    await supabase.from('year_end_checklist').upsert({
      user_id: user!.id,
      year: selectedYear,
      item_key: key,
      checked: newChecked,
      checked_at: newChecked ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,year,item_key' });
  }

  async function saveRrspPlanned(val: number) {
    setRrspPlanned(val);
    await supabase.from('profiles').update({ rrsp_planned_contribution: val }).eq('id', user!.id);
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
      {activeTab === 'credits' && renderCredits()}
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
              <input type="number" value={rrspPlanned || ''} onChange={e => saveRrspPlanned(parseFloat(e.target.value) || 0)} min={0} placeholder="0" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Income Summary</h3>
          <div className="space-y-2">
            <TaxRow label="Net business income" value={formatMoney(taxBreakdown.netBusinessIncome)} />
            {totalEmploymentIncome > 0 && <TaxRow label="Employment income (T4)" value={formatMoney(totalEmploymentIncome)} />}
            {otherIncome > 0 && <TaxRow label="Other income" value={formatMoney(otherIncome)} />}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <TaxRow label="Total income" value={formatMoney(taxBreakdown.totalIncome)} bold />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Deductions</h3>
          <div className="space-y-2">
            <TaxRow label="CPP deduction (half of self-employed CPP)" value={`-${formatMoney(taxBreakdown.cppDeduction)}`} />
            {rrspPlanned > 0 && <TaxRow label="RRSP deduction" value={`-${formatMoney(rrspPlanned)}`} />}
            {totalUnionDues > 0 && <TaxRow label="Union dues (T4 box 44)" value={`-${formatMoney(totalUnionDues)}`} />}
            {totalRpp > 0 && <TaxRow label="RPP contributions (T4 box 20)" value={`-${formatMoney(totalRpp)}`} />}
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
            <TaxRow label="Self-employed CPP owing" value={formatMoney(taxBreakdown.selfEmployedCppOwing)} />
            {taxBreakdown.personalCredits > 0 && <TaxRow label="Personal credits applied" value={`-${formatMoney(taxBreakdown.personalCredits)}`} color="text-emerald-600 dark:text-emerald-400" />}
            {taxBreakdown.refundableCredits > 0 && <TaxRow label="Refundable credits (CTC)" value={`-${formatMoney(taxBreakdown.refundableCredits)}`} color="text-emerald-600 dark:text-emerald-400" />}
            {totalTaxWithheld > 0 && <TaxRow label="Tax already withheld (T4)" value={`-${formatMoney(totalTaxWithheld)}`} color="text-emerald-600 dark:text-emerald-400" />}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <TaxRow label={taxBreakdown.totalTax >= 0 ? 'BALANCE OWING' : 'REFUND'} value={formatMoney(Math.abs(taxBreakdown.totalTax))} bold color={taxBreakdown.totalTax >= 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} />
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

  function renderCredits() {
    const totalCredits = personalCredits.reduce((s, c) => s + c.amount, 0);
    const creditValue = creditTotals.tuition * 0.25 + creditTotals.medical * 0.25 + creditTotals.charitable * 0.29 + creditTotals.canadaTraining;

    async function addCredit() {
      if (!creditForm.amount) return;
      await supabase.from('personal_tax_credits').insert({
        user_id: user!.id,
        year: selectedYear,
        credit_type: creditForm.credit_type,
        amount: creditForm.amount,
        description: creditForm.description || null,
        t_form_received: creditForm.t_form_received,
        notes: creditForm.notes || null,
      });
      setCreditForm({ credit_type: 'tuition', amount: 0, description: '', t_form_received: false, notes: '' });
      setShowCreditForm(false);
      loadData();
    }

    async function deleteCredit(id: string) {
      await supabase.from('personal_tax_credits').delete().eq('id', id);
      loadData();
    }

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">These credits reduce your personal income tax via T1, not T2125 business expenses. They do not appear in your Tax Summary's expenses section.</p>
        </div>

        {totalCredits > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{selectedYear} Credits Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total claimed</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(totalCredits)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Approx tax reduction</p>
                <p className="text-lg font-bold text-emerald-600">{formatMoney(creditValue)}</p>
              </div>
            </div>
          </div>
        )}

        <button onClick={() => setShowCreditForm(true)} className="w-full flex items-center justify-center gap-2 p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Personal Credit
        </button>

        {showCreditForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add Personal Tax Credit</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Credit type</label>
                <select value={creditForm.credit_type} onChange={e => setCreditForm(f => ({ ...f, credit_type: e.target.value as PersonalCreditType }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  {PERSONAL_CREDIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Amount ($)</label>
                <input type="number" value={creditForm.amount || ''} onChange={e => setCreditForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} min={0} step="0.01" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={creditForm.t_form_received} onChange={e => setCreditForm(f => ({ ...f, t_form_received: e.target.checked }))} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  Tax form received
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
                <input type="text" value={creditForm.description} onChange={e => setCreditForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. SAIT tuition, dental work" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
            </div>
            {creditForm.credit_type === 'tuition' && (
              <p className="text-xs text-amber-600 dark:text-amber-400">T2202 form needed from your institution. Usually available by February of the following year.</p>
            )}
            <div className="flex gap-2">
              <button onClick={addCredit} className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors">Save</button>
              <button onClick={() => setShowCreditForm(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {personalCredits.length > 0 && (
          <div className="space-y-2">
            {personalCredits.map(credit => (
              <div key={credit.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{PERSONAL_CREDIT_TYPES.find(t => t.value === credit.credit_type)?.label || credit.credit_type}</span>
                      <span className="text-sm font-bold text-teal-600">{formatMoney(credit.amount)}</span>
                    </div>
                    {credit.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{credit.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {credit.t_form_received ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Form received</span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Awaiting form</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteCredit(credit.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {personalCredits.length === 0 && !showCreditForm && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">No personal credits recorded for {selectedYear}.</p>
        )}
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
    const mRate = getMarginalRate(netIncome, selectedYear);
    const bracket = bracketHeadroom(netIncome, selectedYear);
    const rrspRoom = profile?.rrsp_room_remaining || 0;
    const tfsaRoom = profile?.tfsa_room_remaining || 0;
    const homePercent = profile?.home_office_percent || 0;
    const phonePercent = profile?.phone_business_use_percent || 50;
    const internetPercent = profile?.internet_business_use_percent || 25;
    const wcbPremium = profile?.wcb_annual_premium || 0;
    const quarterlyAmount = taxBreakdown.totalTax / 4;

    const missedKmDays = Math.max(0, tipsData.workDays - tipsData.tripDays);
    const estMissedKm = missedKmDays * tipsData.avgKmPerTrip * 0.6;
    const perKmValue = 0.72 * mRate;

    const phoneOptimal = 85;
    const internetOptimal = 60;
    const phoneExtra = Math.max(0, ((phoneOptimal - phonePercent) / 100) * (tipsData.phoneExpenses > 0 ? tipsData.phoneExpenses * 12 / Math.max(1, new Date().getMonth() + 1) : 1200));
    const internetExtra = Math.max(0, ((internetOptimal - internetPercent) / 100) * (tipsData.internetExpenses > 0 ? tipsData.internetExpenses * 12 / Math.max(1, new Date().getMonth() + 1) : 960));
    const phoneInternetSavings = taxSavingsFromDeduction(phoneExtra + internetExtra, netIncome, selectedYear);

    const homeOptimalPercent = 15;
    const homeExtraDeduction = homePercent < homeOptimalPercent ? ((homeOptimalPercent - homePercent) / 100) * 18000 : 0;
    const homeExtraSavings = taxSavingsFromDeduction(homeExtraDeduction, netIncome, selectedYear);

    const rrspSavings = taxSavingsFromDeduction(rrspRoom, netIncome, selectedYear);
    const vehicleSavings = estMissedKm * perKmValue;
    const mealMissedEstimate = 600;
    const mealSavings = taxSavingsFromDeduction(mealMissedEstimate * 0.5, netIncome, selectedYear);
    const wcbSavings = taxSavingsFromDeduction(tipsData.wcbPaid || wcbPremium, netIncome, selectedYear);

    const now = new Date();
    const isYearEnd = now.getMonth() >= 9;
    const isChecklist = now.getMonth() >= 10 || now.getMonth() === 0;

    type CardDef = {
      id: string;
      section: string;
      savings: number;
      show: boolean;
      render: () => React.ReactNode;
    };

    const cards: CardDef[] = [
      {
        id: 'rrsp',
        section: 'quick',
        savings: rrspSavings,
        show: true,
        render: () => (
          <TipCard
            key="rrsp"
            icon={PiggyBank}
            title={`RRSP Room: ${formatMoney(rrspRoom)} unused`}
            currentClaim={formatMoney(rrspPlanned)}
            optimalClaim={formatMoney(rrspRoom)}
            extraSavings={rrspSavings}
            missingData={!profile?.rrsp_room_remaining ? 'Set your RRSP room in Settings > Tax Settings (from your latest CRA Notice of Assessment) to see personalized savings.' : undefined}
            body={`Contributing your full ${formatMoney(rrspRoom)} of RRSP room reduces your ${selectedYear} taxable income by the same amount. At your marginal rate of ${(mRate * 100).toFixed(1)}%, that's ${formatMoney(rrspSavings)} back in your pocket. Deadline: March 2, ${selectedYear + 1}.

EXTRA STRATEGY: ${bracket.deductionToDropBracket > 0 && bracket.deductionToDropBracket < rrspRoom ? `Even contributing ${formatMoney(bracket.deductionToDropBracket)} would drop you from the ${bracket.currentBracket}% combined bracket — high-value dollars.` : `Your full contribution stays within your current ${bracket.currentBracket}% bracket — every dollar saves at the same rate.`}

If you can't afford the full amount, even $5,000 saves you ${formatMoney(taxSavingsFromDeduction(5000, netIncome, selectedYear))}.`}
            legalBasis="ITA §146 / T1 line 20800"
            action={
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">RRSP planned:</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    type="number"
                    value={rrspPlanned || ''}
                    onChange={e => saveRrspPlanned(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min={0}
                    className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            }
            defaultExpanded={rrspRoom > 0}
          />
        ),
      },
      {
        id: 'home-office',
        section: 'quick',
        savings: homeExtraSavings,
        show: true,
        render: () => (
          <TipCard
            key="home-office"
            icon={Home}
            title="Home Office — Underclaiming Detector"
            currentClaim={`${homePercent}%`}
            optimalClaim={homePercent < homeOptimalPercent ? `${homeOptimalPercent}%` : undefined}
            extraSavings={homeExtraSavings}
            body={`You're claiming only ${homePercent}%. For a dedicated home office (room used ONLY for business), painters typically claim 10-20%. Measure: business_sqft / total_home_sqft.

Current deduction: ${formatMoney(tipsData.homeOfficeExpenses)}. Bumping to ${homeOptimalPercent}% would add ~${formatMoney(homeExtraDeduction)} in deductions, saving ${formatMoney(homeExtraSavings)} in tax at your ${(mRate * 100).toFixed(0)}% marginal rate.

ELIGIBLE EXPENSES (per T2125 Part 7):
- Utilities (heat, electricity, water)
- Home internet
- Property tax
- Mortgage INTEREST (not principal!)
- Home insurance
- Maintenance & repairs
- Rent (if renting)

LIMIT: Cannot create or increase a business loss. Excess carries forward to next year.`}
            legalBasis="T2125 Part 7 / ITA §18(12)"
            action={
              <button onClick={() => navigate('/settings')} className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
                Update home office % in Settings
              </button>
            }
            defaultExpanded={homePercent < 10 && homeExtraSavings > 200}
          />
        ),
      },
      {
        id: 'vehicle',
        section: 'quick',
        savings: vehicleSavings,
        show: true,
        render: () => (
          <TipCard
            key="vehicle"
            icon={Car}
            title="Vehicle — Untracked KMs Cost Detector"
            currentClaim={`${tipsData.trackedKm.toLocaleString()} km logged`}
            optimalClaim={missedKmDays > 0 ? `~${Math.round(estMissedKm).toLocaleString()} km missed` : undefined}
            extraSavings={vehicleSavings}
            body={`You logged ${tipsData.trackedKm.toLocaleString()} business km this year across ${tipsData.tripDays} trip days. You worked ${tipsData.workDays} days total — that's ${missedKmDays} workdays with NO trip logged.

Estimated missed km: ~${Math.round(estMissedKm).toLocaleString()} km (at avg ${Math.round(tipsData.avgKmPerTrip)} km/trip × 60%). At ~$${perKmValue.toFixed(2)}/km in tax savings, you're leaving ${formatMoney(vehicleSavings)} on the table.

UNTRACKED TRIPS PAINTERS COMMONLY MISS:
- Home Depot / Rona / Cloverdale Paint runs
- Client estimate visits (round trip)
- Bank, post office, supplier pickup
- Trips to job site for inspection without logging hours
- Driving to pick up subs or materials mid-job

REQUIREMENT: CRA wants a logbook with date, start/end km, purpose for each business trip. The app does this automatically.`}
            legalBasis="T2125 Chart A / Motor Vehicle Expenses"
            action={
              <button onClick={() => navigate('/vehicle')} className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
                Log a missed trip now
              </button>
            }
            defaultExpanded={vehicleSavings > 200}
          />
        ),
      },
      {
        id: 'phone-internet',
        section: 'quick',
        savings: phoneInternetSavings,
        show: true,
        render: () => (
          <TipCard
            key="phone-internet"
            icon={Phone}
            title="Phone & Internet — Increase the Business %"
            currentClaim={`Phone ${phonePercent}%, Internet ${internetPercent}%`}
            optimalClaim={`Phone ${phoneOptimal}%, Internet ${internetOptimal}%`}
            extraSavings={phoneInternetSavings}
            body={`If you use your phone primarily for client calls, quotes, scheduling, and supplier orders — 80-90% business use is defensible. Internet for invoicing, supplier ordering, research, marketing — 50-70% is normal.

YOUR CURRENT: Phone ${phonePercent}%, Internet ${internetPercent}% → extra deduction: ${formatMoney(phoneExtra + internetExtra)}/year
DEFENSIBLE OPTIMAL: Phone ${phoneOptimal}%, Internet ${internetOptimal}%
EXTRA TAX SAVED: ${formatMoney(phoneInternetSavings)}

CRA expects the percentage to reflect REALITY. If asked, you should be able to explain how you arrived at it (e.g. "I track calls — 9 of 10 are work-related"). Don't claim 100% on a personal device — that invites audit.`}
            legalBasis="T2125 line 9220 / ITA §18(1)(h)"
            action={
              <button onClick={() => navigate('/settings')} className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
                Adjust percentages in Settings
              </button>
            }
          />
        ),
      },
      {
        id: 'tools',
        section: 'quick',
        savings: 0,
        show: true,
        render: () => (
          <TipCard
            key="tools"
            icon={Wrench}
            title="Tools & Supplies Under $500 — Instant Deduction"
            currentClaim={formatMoney(tipsData.toolExpenses)}
            extraSavings={0}
            body={`Any tool/equipment costing under $500 is 100% deductible the year you buy it (no CCA). For a painter, this covers most of what you buy:

- Brushes, rollers, trays, drop cloths
- Standard ladders (8-12 ft)
- Hand tools (scrapers, putty knives)
- Safety gear (boots, masks, eyewear, harnesses)
- Smaller airless sprayers
- Drop cloths, painter's tape, plastic sheeting

You spent ${formatMoney(tipsData.toolExpenses)} on tools this year (saving ${formatMoney(taxSavingsFromDeduction(tipsData.toolExpenses, netIncome, selectedYear))} in tax).

YEAR-END STRATEGY: If you'll need to replace anything in Q1, buy in December instead. Same money out the door, faster tax benefit.`}
            legalBasis="ITA §20(1)(a) / Class 12 (100% CCA) for tools under $500"
            action={
              <button onClick={() => navigate('/expenses')} className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
                Quick-add a tool purchase
              </button>
            }
          />
        ),
      },
      {
        id: 'gst-itc',
        section: 'quick',
        savings: yearData.gstPaid * 0.1,
        show: profile?.gst_enabled === true,
        render: () => {
          const estMissedItc = yearData.totalExpenses * 0.05 * 0.1;
          return (
            <TipCard
              key="gst-itc"
              icon={Receipt}
              title="GST Input Tax Credits — Missed Dollars"
              currentClaim={`ITCs: ${formatMoney(yearData.gstPaid)}`}
              optimalClaim={estMissedItc > 0 ? `~${formatMoney(estMissedItc)} potentially missed` : undefined}
              extraSavings={estMissedItc}
              body={`You collected ${formatMoney(yearData.gstCollected)} in GST and claimed ${formatMoney(yearData.gstPaid)} in ITCs.

EVERY business purchase with GST should generate an ITC:
- Fuel (gas station receipts — yes, they have GST)
- Materials & supplies
- Tools
- Phone and internet (business %)
- Vehicle repairs & parts
- Software (QuickBooks, Adobe, etc.)
- Business meals (only 50% of the GST too, mirroring the deduction rule)
- Parking
- Vehicle leases (business portion)

KEY: You need the receipt with GST registration number visible. Without it, no ITC. Take a photo immediately.`}
              legalBasis="Excise Tax Act §169 / GST34 return"
              action={
                <button onClick={() => navigate('/expenses')} className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
                  Add a missed expense with GST
                </button>
              }
            />
          );
        },
      },
      {
        id: 'capital-timing',
        section: 'yearend',
        savings: 300 * mRate,
        show: isYearEnd,
        render: () => {
          const sprayer3k = taxSavingsFromDeduction(3000 * 0.5 * 0.2, netIncome, selectedYear);
          const truck40k = taxSavingsFromDeduction(40000 * 0.5 * 0.3, netIncome, selectedYear);
          return (
            <TipCard
              key="capital-timing"
              icon={ShoppingCart}
              title="Capital Assets — Timing the Purchase"
              extraSavings={sprayer3k + truck40k}
              body={`Buying equipment BEFORE Dec 31 lets you claim CCA this year (under the half-year rule, 50% of normal CCA in year one). Buying Jan 1 delays that deduction 12+ months.

EXAMPLE FOR YOU:
- $3,000 paint sprayer (Class 8, 20% CCA)
  Bought Dec 31: deduct $300 this year (saves ${formatMoney(sprayer3k)})
  Bought Jan 1: $0 this year, $600 next year

- $40,000 work truck (Class 10, 30% CCA)
  Bought Dec 31: deduct $6,000 this year (saves ${formatMoney(truck40k)})
  Bought Jan 1: deduct $12,000 NEXT year

If you're planning a purchase anyway, accelerate it. Don't buy junk just for the deduction — it must be needed for the business.`}
              legalBasis="ITA §1100 / Class 8 (20%), Class 10 (30%), Class 10.1 (luxury), Class 50 (computers 55%)"
            />
          );
        },
      },
      {
        id: 'meals',
        section: 'yearend',
        savings: mealSavings,
        show: true,
        render: () => (
          <TipCard
            key="meals"
            icon={Utensils}
            title="Meals & Entertainment — Underclaimed"
            currentClaim={formatMoney(tipsData.mealExpenses)}
            optimalClaim={formatMoney(tipsData.mealExpenses + mealMissedEstimate * 0.5)}
            extraSavings={mealSavings}
            body={`Current claim: ${formatMoney(tipsData.mealExpenses)} (after 50% rule). Painters typically under-claim meals by $400-1,200/year.

ELIGIBLE BUSINESS MEALS:
- Coffee/lunch with a potential client during a quote
- Lunch with a subcontractor discussing job logistics
- Meals during overnight travel >40km from home
- Meals provided to your subs on long jobs

NOT eligible: your own daily lunch on a regular job site (CRA considers this personal)

50% RULE: Only 50% is deductible. Save receipts and write the client/sub name and purpose on the back.

EXCEPTION: Meals on overnight long-haul (>160km away) are 80% deductible if you're a transport worker, but painters typically don't qualify. Stick with 50%.`}
            legalBasis="ITA §67.1 / T2125 line 8523"
            action={
              <button onClick={() => navigate('/expenses')} className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
                Add a meal expense
              </button>
            }
          />
        ),
      },
      {
        id: 'instalments',
        section: 'yearend',
        savings: quarterlyAmount > 1000 ? quarterlyAmount * 4 * 0.045 * 0.5 : 0,
        show: taxBreakdown.totalTax > 3000,
        render: () => {
          const interestEarned = quarterlyAmount * 4 * 0.045 * 0.5;
          return (
            <TipCard
              key="instalments"
              icon={Calendar}
              title="Quarterly Instalment Interest Play"
              extraSavings={interestEarned}
              body={`Your quarterly instalments: ${formatMoney(quarterlyAmount)} due Mar 15, Jun 15, Sep 15, Dec 15.

STRATEGY: Park the money in a HISA (high-interest savings account) like EQ Bank or Wealthsimple Cash (4-5% APY in 2026) until each due date. On ${formatMoney(quarterlyAmount * 4)} in average float across the year, you earn approximately ${formatMoney(interestEarned)}.

That interest is taxable, but it's yours instead of CRA's.

WARNING: Don't miss a due date. Late instalment interest from CRA is currently ~8% — higher than HISA rates — and the penalties are nasty.`}
              legalBasis="ITA §156 (instalments) / §161 (interest)"
            />
          );
        },
      },
      {
        id: 'income-smoothing',
        section: 'yearend',
        savings: 0,
        show: isYearEnd,
        render: () => {
          const prevYearNet = profile?.prev_year_net_income || 0;
          const isHigherThisYear = netIncome > prevYearNet && prevYearNet > 0;
          return (
            <TipCard
              key="income-smoothing"
              icon={BarChart3}
              title="Income Smoothing Across Year-End"
              body={prevYearNet > 0 ? (isHigherThisYear ?
                `Your ${selectedYear} income (${formatMoney(netIncome)}) looks HIGHER than last year (${formatMoney(prevYearNet)}). Strategy: DELAY December invoices to January (taxed at potentially lower rate next year). ACCELERATE December expenses NOW — buy needed tools, prepay annual insurance, restock supplies. Each $1,000 of expenses moved to this year saves ${formatMoney(taxSavingsFromDeduction(1000, netIncome, selectedYear))} at your current rate.` :
                `Your ${selectedYear} income (${formatMoney(netIncome)}) looks LOWER than last year (${formatMoney(prevYearNet)}). Strategy: ACCELERATE December invoices into this year so they're taxed at a lower rate. DELAY December expenses to January where they offset higher-bracket income.`
              ) : `Set your previous year's net income in Settings > Tax Settings to get personalized income smoothing advice. This strategy can shift thousands of dollars between tax brackets.

General rule: If next year will be higher income, delay invoices and accelerate expenses. If next year will be lower, accelerate invoices and delay expenses.`}
              legalBasis="Timing / cash-method accounting under ITA §28"
              missingData={prevYearNet === 0 ? 'Set your previous year net income in Settings > Tax Settings to get personalized smoothing advice.' : undefined}
            />
          );
        },
      },
      {
        id: 'checklist',
        section: 'yearend',
        savings: 0,
        show: isChecklist,
        render: () => {
          const items = [
            { key: 'invoices_sent', label: 'All completed jobs invoiced' },
            { key: 'receipts_logged', label: 'All receipts logged in app' },
            { key: 'mileage_complete', label: 'Vehicle mileage log complete and exported' },
            { key: 'home_office_verified', label: 'Home office % verified and updated' },
            { key: 'phone_internet_verified', label: 'Phone/internet % verified' },
            { key: 'tools_q1', label: 'Tools needed for Q1 — buy by Dec 31?' },
            { key: 'insurance_prepay', label: 'Annual insurance — prepay next year in Dec?' },
            { key: 'courses_registered', label: 'Professional courses for Q1 — register by Dec 31?' },
            { key: 'rrsp_decided', label: 'RRSP contribution decided (deadline Mar 2)' },
            { key: 'tfsa_topped', label: 'TFSA topped up' },
            { key: 'q4_instalment', label: 'Q4 instalment paid by Dec 15' },
            { key: 'receipts_backed_up', label: 'All receipt PDFs/photos backed up' },
            { key: 'mileage_saved', label: 'Mileage logbook digitally saved' },
            { key: 'gst_q4', label: 'GST return filed for Q4' },
            { key: 't2125_trial', label: 'T2125 trial-run with CPA before Feb' },
          ];
          const checkedCount = items.filter(i => checklist[i.key]).length;
          return (
            <div key="checklist" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                    <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Year-End Execution Checklist</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{checkedCount}/{items.length} complete</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(checkedCount / items.length) * 100}%` }} />
                </div>
              </div>
              <div className="p-4 space-y-2">
                {items.map(item => (
                  <label key={item.key} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checklist[item.key] || false}
                      onChange={() => toggleChecklistItem(item.key)}
                      className="rounded border-gray-300 dark:border-gray-600 text-teal-600 focus:ring-teal-500"
                    />
                    <span className={`text-sm ${checklist[item.key] ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-300'} group-hover:text-gray-900 dark:group-hover:text-white transition-colors`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">Checklist persists — your progress is saved.</p>
              </div>
            </div>
          );
        },
      },
      {
        id: 'spouse',
        section: 'longterm',
        savings: netIncome > 60000 ? taxSavingsFromDeduction(8000, netIncome, selectedYear) - 8000 * 0.15 : 0,
        show: netIncome > 60000,
        render: () => {
          const spouseSavings = taxSavingsFromDeduction(8000, netIncome, selectedYear);
          return (
            <TipCard
              key="spouse"
              icon={Users}
              title="Spouse/Family Income Splitting"
              extraSavings={spouseSavings - 8000 * 0.0}
              body={`If your spouse or adult child does REAL work for the business — bookkeeping, invoicing, scheduling, marketing, job-site cleanup, helping with quotes — paying them at market rate shifts income from your ${(mRate * 100).toFixed(0)}% bracket to their lower bracket.

EXAMPLE: Paying $8,000/year for ~5 hrs/week of bookkeeping ($30/hr) splits $8,000 from your ${bracket.currentBracket}% bracket. If your spouse has no other income, their effective rate on that $8,000 is roughly 0% (covered by basic personal amount of ~$16,129 federal + ~$22,323 AB). Net family savings: ${formatMoney(spouseSavings)}.

CRA REQUIREMENTS:
- Work must be real and documented (timesheet/job log)
- Rate must match market value
- Payment by traceable method (transfer, not cash)
- Issue T4 if total > $500/year (basic withholding)
- Cannot pay minors below working age for fictitious work

RISK: CRA can reassess if amounts are unreasonable or work isn't real. Keep good records.`}
              legalBasis="ITA §67 (reasonableness) / CRA Income Tax Folio S4-F3-C1"
            />
          );
        },
      },
      {
        id: 'tfsa',
        section: 'longterm',
        savings: 0,
        show: true,
        render: () => {
          const hasWarning = profile?.tfsa_room_warning && !profile?.tfsa_room_verified_date;
          const warningText = hasWarning ? `WARNING: CRA has flagged your TFSA room. Click into CRA My Account to see the warning detail before treating this number as final. Common causes: recent unreported contributions, non-resident periods, or past over-contribution adjustments.\n\n` : '';
          return (
            <TipCard
              key="tfsa"
              icon={Wallet}
              title="TFSA — Tax-Free Forever"
              currentClaim={tfsaRoom > 0 ? `${formatMoney(tfsaRoom)} room` : undefined}
              missingData={!profile?.tfsa_room_remaining ? 'Set your TFSA room in Settings > Tax Settings to see personalized advice.' : undefined}
              body={`${warningText}Your TFSA room: ${formatMoney(tfsaRoom)}. No deduction today, but EVERY dollar of growth and EVERY withdrawal is tax-free FOREVER. Unlike RRSP, withdrawals don't count as income in retirement (won't claw back OAS).

PRIORITY ORDER FOR EXTRA CASH:
1. Emergency fund (3 months expenses, in HISA)
2. RRSP if in top brackets (${bracket.currentBracket}%+ marginal)
3. TFSA if in lower brackets or already maxed RRSP
4. Pay down debt > 5% interest
5. Non-registered investing

2026 TFSA room: $7,000 + any unused room from prior years.`}
              legalBasis="ITA §146.2 / T1 (no specific line — not deductible)"
              action={hasWarning ? (
                <button
                  onClick={async () => {
                    await supabase.from('profiles').update({ tfsa_room_verified_date: new Date().toISOString().split('T')[0] }).eq('id', user!.id);
                    loadData();
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                >
                  I verified the warning — room is correct
                </button>
              ) : undefined}
            />
          );
        },
      },
      {
        id: 'incorporate',
        section: 'longterm',
        savings: netIncome > 80000 ? (netIncome - 80000) * (mRate - 0.11) : 0,
        show: netIncome > 75000,
        render: () => {
          const corpSavings = (netIncome - 80000) * (mRate - 0.11);
          return (
            <TipCard
              key="incorporate"
              icon={Building2}
              title="Should You Incorporate?"
              extraSavings={corpSavings > 0 ? corpSavings : 0}
              body={`Your net income: ${formatMoney(netIncome)}. Incorporation starts making sense at this level — BUT only if you don't need to draw all the income personally.

SMALL BUSINESS DEDUCTION (CCPC in AB):
- First $500K of active income: 11% combined tax rate
- Vs. your current personal rate of ~${(mRate * 100).toFixed(0)}% on top dollars

EXTRA ANNUAL COSTS OF CORP:
- Accountant: $1,500-3,000/year
- Corporate registry: ~$100
- T2 return prep: included in accountant fee usually
- Separate bookkeeping discipline required

ROUGH BREAKEVEN:
- Net income > $80K
- You can leave $20K+ inside the corp (retained earnings)
- You're disciplined with bookkeeping
- Don't incorporate if you spend every dollar personally — you give back the SBD via dividend tax

NEXT STEP: Free consultation with a CPA who knows trades. Don't DIY this decision.`}
              legalBasis="ITA §125 (Small Business Deduction)"
            />
          );
        },
      },
      {
        id: 'wcb',
        section: 'dontforget',
        savings: wcbSavings,
        show: (tipsData.wcbPaid > 0 || wcbPremium > 0),
        render: () => (
          <TipCard
            key="wcb"
            icon={ShieldCheck}
            title="WCB Premiums — Remember These Are Deductible"
            currentClaim={formatMoney(tipsData.wcbPaid || wcbPremium)}
            extraSavings={wcbSavings}
            body={`You've paid ${formatMoney(tipsData.wcbPaid || wcbPremium)} in WCB premiums this year. 100% deductible on T2125 line 8690 (Insurance).

Tax saved: ${formatMoney(wcbSavings)}.

WHAT'S NOT DEDUCTIBLE: WCB penalties or interest charges (ITA §67.6). Track them separately — they're business costs but don't reduce tax.

If you receive WCB benefits (injury): NOT business income. Goes on T1 line 14400, offsets on line 25000 — effectively tax-free.`}
            legalBasis="T2125 line 8690 / ITA §67.6"
          />
        ),
      },
      {
        id: 'profdev',
        section: 'dontforget',
        savings: 0,
        show: true,
        render: () => (
          <TipCard
            key="profdev"
            icon={GraduationCap}
            title="Professional Development & Memberships"
            currentClaim={formatMoney(tipsData.profDevExpenses)}
            body={`100% deductible:
- Trade courses (PDCA, MPI training, color theory)
- Safety certifications (WHMIS, fall protection, asbestos awareness, scaffolding)
- Association memberships (Master Painters Institute, Calgary Construction Association)
- Trade magazines, online subscriptions for painters
- Business courses (QuickBooks, marketing)

CURRENT CLAIM: ${formatMoney(tipsData.profDevExpenses)}
TYPICAL FOR ACTIVE PAINTER: $800-2,000/year

If you're not regularly investing in skills/certifications, either (a) you should be — it makes you more bookable, or (b) you're missing receipts.`}
            legalBasis="T2125 line 8760 / ITA §18"
            action={
              <button onClick={() => navigate('/expenses')} className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
                Add a professional development expense
              </button>
            }
          />
        ),
      },
      {
        id: 't4-reduces-tax',
        section: 'dontforget',
        savings: 0,
        show: totalEmploymentIncome > 0,
        render: () => (
          <TipCard
            key="t4-reduces-tax"
            icon={Award}
            title="T4 Income Reduces Your Tax Surprise"
            currentClaim={formatMoney(totalTaxWithheld) + ' withheld'}
            body={`You earned ${formatMoney(totalEmploymentIncome)} as an employee this year with ${formatMoney(totalTaxWithheld)} already withheld for tax. This means you need to set aside LESS for your sole prop income.

Your combined tax estimate factors this in — the "Balance Owing" on the Tax Estimate tab already subtracts what your employer withheld. No double-counting.

If you expect employment income to continue, your quarterly instalments should be lower than a pure sole-prop calculation would suggest.`}
            legalBasis="T1 line 43700 (total tax withheld) / ITA §153"
          />
        ),
      },
      {
        id: 'cpp-no-double',
        section: 'dontforget',
        savings: 0,
        show: totalEmploymentIncome > 0 && netIncome > 0,
        render: () => (
          <TipCard
            key="cpp-no-double"
            icon={ShieldCheck}
            title="Verify CPP Hasn't Been Double-Counted"
            currentClaim={`T4 CPP: ${formatMoney(totalCppPaid)}`}
            body={`Your employer withheld ${formatMoney(totalCppPaid)} in CPP on your T4 income. When filing your T2125, you only owe CPP on business income for earnings BEYOND what your T4 already covered (total ceiling: $${getYearRates(selectedYear).cpp.ympe.toLocaleString()} in ${selectedYear}).

The app has automatically accounted for this — your self-employed CPP owing (${formatMoney(taxBreakdown.selfEmployedCppOwing)}) already credits what was paid via T4.

IMPORTANT: Keep your T4 slip. CRA cross-references employer remittances — if the numbers don't match, they'll reassess.`}
            legalBasis="ITA §10 of Canada Pension Plan / Schedule 8"
          />
        ),
      },
      {
        id: 'tuition-carry',
        section: 'dontforget',
        savings: creditTotals.tuition * 0.25,
        show: creditTotals.tuition > 0,
        render: () => {
          const tuitionCreditFed = creditTotals.tuition * 0.15;
          const tuitionCreditAB = creditTotals.tuition * 0.10;
          const totalTuitionCredit = tuitionCreditFed + tuitionCreditAB;
          const taxOwedBeforeCredit = taxBreakdown.federalTax + taxBreakdown.albertaTax + taxBreakdown.personalCredits;
          const usedThisYear = Math.min(totalTuitionCredit, taxOwedBeforeCredit);
          const carryForward = Math.max(0, totalTuitionCredit - usedThisYear);
          return (
            <TipCard
              key="tuition-carry"
              icon={GraduationCap}
              title="Tuition Credits Stack Across Years"
              currentClaim={formatMoney(creditTotals.tuition) + ' tuition'}
              extraSavings={totalTuitionCredit}
              body={`Your ${formatMoney(creditTotals.tuition)} in tuition this year generates ${formatMoney(totalTuitionCredit)} in credits (15% federal + 10% Alberta).

${carryForward > 0 ? `Because your taxable income is relatively low this year, you'll likely only use ${formatMoney(usedThisYear)} of it. The remaining ${formatMoney(carryForward)} carries forward indefinitely OR can be transferred up to $5,000 to a parent, grandparent, or spouse.` : `At your current income level, you should be able to use the full credit this year.`}

IMPORTANT: You need the T2202 form from your institution to claim. Usually available by February.`}
              legalBasis="ITA §118.5 (tuition credit) / T1 lines 32300, 32400"
            />
          );
        },
      },
    ];

    const visibleCards = cards.filter(c => c.show);
    const totalPotentialSavings = visibleCards.reduce((s, c) => s + c.savings, 0);

    const sections = [
      { key: 'quick', title: 'Quick Wins', subtitle: 'Highest dollar impact, easiest to action', cards: visibleCards.filter(c => c.section === 'quick') },
      { key: 'yearend', title: 'Year-End Strategy', subtitle: 'Seasonal and timing plays', cards: visibleCards.filter(c => c.section === 'yearend') },
      { key: 'longterm', title: 'Long-Term Plays', subtitle: 'Bigger life decisions', cards: visibleCards.filter(c => c.section === 'longterm') },
      { key: 'dontforget', title: "Don't Forget", subtitle: 'Easy to miss', cards: visibleCards.filter(c => c.section === 'dontforget') },
    ].filter(s => s.cards.length > 0);

    return (
      <div className="space-y-6">
        {/* Total savings banner */}
        {totalPotentialSavings > 0 && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white shadow-lg">
            <p className="text-sm font-medium text-emerald-100 uppercase tracking-wide">Estimated extra savings if you action all open tips</p>
            <p className="text-3xl font-bold mt-1">${Math.round(totalPotentialSavings).toLocaleString('en-CA')} <span className="text-base font-normal text-emerald-200">this year</span></p>
          </div>
        )}

        {/* Sections */}
        {sections.map(section => (
          <div key={section.key}>
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between mb-3 group"
            >
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">{section.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{section.subtitle}</p>
              </div>
              {collapsedSections.has(section.key) ? (
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              )}
            </button>
            {!collapsedSections.has(section.key) && (
              <div className="space-y-3">
                {section.cards.map(card => card.render())}
              </div>
            )}
          </div>
        ))}

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            All strategies are based on CRA published rules for sole proprietorships in Alberta as of {selectedYear}. Estimates use current-year tax brackets and YOUR data in this app. This is tax PLANNING (legal optimization), not tax advice. Confirm specifics with a CPA before filing your T2125. The app is not responsible for outcomes — you are.
          </p>
        </div>
      </div>
    );
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
