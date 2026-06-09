import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DashboardCard } from '../components/DashboardCard';
import {
  Clock, DollarSign, FileText, Receipt,
  TrendingUp, Calculator, ShieldCheck, Wallet, Car, Home,
  AlertTriangle, CreditCard
} from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

interface DashboardData {
  hoursThisWeek: number;
  hoursThisMonth: number;
  uninvoicedHours: number;
  unpaidInvoices: number;
  incomeThisMonth: number;
  gstCollectedThisMonth: number;
  expensesThisMonth: number;
  wcbPaidThisYear: number;
  estimatedGstPayable: number;
  estimatedProfit: number;
  suggestedTaxReserve: number;
  safeCash: number;
  businessKmMonth: number;
  businessKmYear: number;
  vehicleBusinessPercent: number | null;
  homeOfficeDeductible: number;
  // New TOTAL NET fields
  totalPaymentsReceived: number;
  totalDeductibleExpenses: number;
  totalIncomeBeforeGst: number;
  upcomingWcbBalance: number;
  missingReceipts: number;
  unpaidInvoiceCount: number;
  uninvoicedHoursCount: number;
  totalNet: number;
  profitBeforeTaxReserve: number;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const yearStart = `${now.getFullYear()}-01-01`;

    const [
      weekHours, monthHours, uninvoiced, unpaidInv,
      monthInvoices, monthExpenses, yearWcbPaid, yearWcbAll,
      yearGstCollected, yearGstItc, paymentsReceived,
      profile, mileageMonth, mileageYear, vehicles, homeExpenses,
      yearExpenses, yearInvoices, missingReceiptsRes, uninvoicedCount,
    ] = await Promise.all([
      supabase.from('work_hours').select('total_hours').eq('user_id', user!.id).gte('work_date', weekStart).lte('work_date', weekEnd),
      supabase.from('work_hours').select('total_hours').eq('user_id', user!.id).gte('work_date', monthStart).lte('work_date', monthEnd),
      supabase.from('work_hours').select('subtotal').eq('user_id', user!.id).eq('status', 'not_invoiced'),
      supabase.from('invoices').select('balance_due').eq('user_id', user!.id).in('status', ['sent', 'overdue']),
      supabase.from('invoices').select('subtotal, gst_amount').eq('user_id', user!.id).gte('invoice_date', monthStart).lte('invoice_date', monthEnd).in('status', ['sent', 'paid']),
      supabase.from('expenses').select('deductible_amount, itc_claim_amount').eq('user_id', user!.id).gte('expense_date', monthStart).lte('expense_date', monthEnd),
      supabase.from('wcb_payments').select('amount_paid').eq('user_id', user!.id).gte('created_at', yearStart).eq('status', 'paid'),
      supabase.from('wcb_payments').select('remaining_balance, status').eq('user_id', user!.id),
      supabase.from('invoices').select('gst_amount').eq('user_id', user!.id).gte('invoice_date', yearStart).in('status', ['sent', 'paid']),
      supabase.from('expenses').select('itc_claim_amount').eq('user_id', user!.id).gte('expense_date', yearStart),
      supabase.from('payments').select('amount').eq('user_id', user!.id).gte('payment_date', yearStart),
      supabase.from('profiles').select('default_tax_reserve_percent').eq('id', user!.id).maybeSingle(),
      supabase.from('mileage_logs').select('km_driven').eq('user_id', user!.id).gte('log_date', monthStart).lte('log_date', monthEnd),
      supabase.from('mileage_logs').select('km_driven').eq('user_id', user!.id).gte('log_date', yearStart),
      supabase.from('vehicles').select('business_use_percent').eq('user_id', user!.id).eq('active', true).limit(1),
      supabase.from('expenses').select('deductible_amount').eq('user_id', user!.id).eq('home_office_related', true).gte('expense_date', yearStart),
      supabase.from('expenses').select('deductible_amount').eq('user_id', user!.id).gte('expense_date', yearStart),
      supabase.from('invoices').select('subtotal').eq('user_id', user!.id).gte('invoice_date', yearStart).in('status', ['sent', 'paid']),
      supabase.from('expenses').select('id').eq('user_id', user!.id).is('receipt_url', null).gte('expense_date', yearStart),
      supabase.from('work_hours').select('id').eq('user_id', user!.id).eq('status', 'not_invoiced'),
    ]);

    const hoursThisWeek = (weekHours.data || []).reduce((s, r) => s + (r.total_hours || 0), 0);
    const hoursThisMonth = (monthHours.data || []).reduce((s, r) => s + (r.total_hours || 0), 0);
    const uninvoicedHours = (uninvoiced.data || []).reduce((s, r) => s + (r.subtotal || 0), 0);
    const unpaidInvoices = (unpaidInv.data || []).reduce((s, r) => s + (r.balance_due || 0), 0);
    const incomeThisMonth = (monthInvoices.data || []).reduce((s, r) => s + (r.subtotal || 0), 0);
    const gstCollectedThisMonth = (monthInvoices.data || []).reduce((s, r) => s + (r.gst_amount || 0), 0);
    const expensesThisMonth = (monthExpenses.data || []).reduce((s, r) => s + (r.deductible_amount || 0), 0);
    const wcbPaidThisYear = (yearWcbPaid.data || []).reduce((s, r) => s + (r.amount_paid || 0), 0);

    const upcomingWcbBalance = (yearWcbAll.data || [])
      .filter(r => r.status !== 'paid')
      .reduce((s, r) => s + (r.remaining_balance || 0), 0);

    const totalGstCollected = (yearGstCollected.data || []).reduce((s, r) => s + (r.gst_amount || 0), 0);
    const totalGstItc = (yearGstItc.data || []).reduce((s, r) => s + (r.itc_claim_amount || 0), 0);
    const estimatedGstPayable = Math.max(0, totalGstCollected - totalGstItc);

    const totalPaymentsReceived = (paymentsReceived.data || []).reduce((s, r) => s + (r.amount || 0), 0);
    const taxReservePercent = profile.data?.default_tax_reserve_percent || 25;

    const totalDeductibleExpenses = (yearExpenses.data || []).reduce((s, r) => s + (r.deductible_amount || 0), 0);
    const totalIncomeBeforeGst = (yearInvoices.data || []).reduce((s, r) => s + (r.subtotal || 0), 0);

    const estimatedProfit = incomeThisMonth - expensesThisMonth;
    const profitBeforeTaxReserve = totalIncomeBeforeGst - totalDeductibleExpenses - wcbPaidThisYear;
    const suggestedTaxReserve = Math.max(0, profitBeforeTaxReserve * (taxReservePercent / 100));
    const totalNet = totalPaymentsReceived - totalDeductibleExpenses - wcbPaidThisYear - estimatedGstPayable - suggestedTaxReserve;
    const safeCash = totalPaymentsReceived - estimatedGstPayable - wcbPaidThisYear - suggestedTaxReserve;

    const businessKmMonth = (mileageMonth.data || []).reduce((s, r) => s + (r.km_driven || 0), 0);
    const businessKmYear = (mileageYear.data || []).reduce((s, r) => s + (r.km_driven || 0), 0);
    const vehicleBusinessPercent = vehicles.data?.[0]?.business_use_percent || null;
    const homeOfficeDeductible = (homeExpenses.data || []).reduce((s, r) => s + (r.deductible_amount || 0), 0);

    const missingReceipts = missingReceiptsRes.data?.length || 0;
    const unpaidInvoiceCount = unpaidInv.data?.length || 0;
    const uninvoicedHoursCount = uninvoicedCount.data?.length || 0;

    setData({
      hoursThisWeek,
      hoursThisMonth,
      uninvoicedHours,
      unpaidInvoices,
      incomeThisMonth,
      gstCollectedThisMonth,
      expensesThisMonth,
      wcbPaidThisYear,
      estimatedGstPayable,
      estimatedProfit,
      suggestedTaxReserve,
      safeCash: Math.max(0, safeCash),
      businessKmMonth,
      businessKmYear,
      vehicleBusinessPercent,
      homeOfficeDeductible,
      totalPaymentsReceived,
      totalDeductibleExpenses,
      totalIncomeBeforeGst,
      upcomingWcbBalance,
      missingReceipts,
      unpaidInvoiceCount,
      uninvoicedHoursCount,
      totalNet,
      profitBeforeTaxReserve,
    });
    setLoading(false);
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;
  }

  if (!data) return null;

  const netColor = data.totalNet > 0
    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
    : data.totalNet < 0
    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800';

  const netTextColor = data.totalNet > 0
    ? 'text-green-700 dark:text-green-300'
    : data.totalNet < 0
    ? 'text-red-700 dark:text-red-300'
    : 'text-gray-700 dark:text-gray-300';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <DashboardCard title="Hours This Week" value={data.hoursThisWeek.toFixed(1)} icon={<Clock className="w-5 h-5" />} />
        <DashboardCard title="Hours This Month" value={data.hoursThisMonth.toFixed(1)} icon={<Clock className="w-5 h-5" />} />
        <DashboardCard title="Uninvoiced" value={fmt(data.uninvoicedHours)} icon={<FileText className="w-5 h-5" />} subtitle="Hours worked but not billed yet" />
        <DashboardCard title="Unpaid Invoices" value={fmt(data.unpaidInvoices)} icon={<FileText className="w-5 h-5" />} />
        <DashboardCard title="Income This Month" value={fmt(data.incomeThisMonth)} icon={<DollarSign className="w-5 h-5" />} subtitle="Before GST" />
        <DashboardCard title="GST Collected" value={fmt(data.gstCollectedThisMonth)} icon={<Calculator className="w-5 h-5" />} subtitle="This month" />
        <DashboardCard title="Expenses This Month" value={fmt(data.expensesThisMonth)} icon={<Receipt className="w-5 h-5" />} />
        <DashboardCard title="WCB Paid (Year)" value={fmt(data.wcbPaidThisYear)} icon={<ShieldCheck className="w-5 h-5" />} />
        <DashboardCard title="GST Payable" value={fmt(data.estimatedGstPayable)} icon={<Calculator className="w-5 h-5" />} subtitle="Estimate for the year" />
        <DashboardCard title="Estimated Profit" value={fmt(data.estimatedProfit)} icon={<TrendingUp className="w-5 h-5" />} subtitle="This month" />
        <DashboardCard title="Tax Reserve" value={fmt(data.suggestedTaxReserve)} icon={<Wallet className="w-5 h-5" />} subtitle="Set aside for taxes" />
        <DashboardCard title="Safe Cash" value={fmt(data.safeCash)} icon={<DollarSign className="w-5 h-5" />} subtitle="After GST, WCB, taxes" />
        <DashboardCard title="Business KM (Month)" value={`${data.businessKmMonth.toFixed(0)} km`} icon={<Car className="w-5 h-5" />} />
        <DashboardCard title="Business KM (Year)" value={`${data.businessKmYear.toFixed(0)} km`} icon={<Car className="w-5 h-5" />} subtitle={data.vehicleBusinessPercent ? `${data.vehicleBusinessPercent.toFixed(0)}% business use` : undefined} />
        <DashboardCard title="Home Office Deductible" value={fmt(data.homeOfficeDeductible)} icon={<Home className="w-5 h-5" />} subtitle="This year" />
      </div>

      {/* TOTAL NET Section */}
      <div className={`mt-8 rounded-xl border-2 p-6 ${netColor}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${data.totalNet >= 0 ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
            <CreditCard className={`w-6 h-6 ${data.totalNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">TOTAL NET</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Estimated safe cash after expenses, WCB paid, GST payable, and tax reserve.</p>
          </div>
        </div>

        <p className={`text-3xl font-bold ${netTextColor} mb-4`}>{fmt(data.totalNet)}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Profit Before Tax Reserve</p>
            <p className="font-bold text-gray-900 dark:text-white">{fmt(data.profitBeforeTaxReserve)}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">GST Payable Estimate</p>
            <p className="font-bold text-gray-900 dark:text-white">{fmt(data.estimatedGstPayable)}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Tax Reserve Estimate</p>
            <p className="font-bold text-gray-900 dark:text-white">{fmt(data.suggestedTaxReserve)}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">WCB Paid</p>
            <p className="font-bold text-gray-900 dark:text-white">{fmt(data.wcbPaidThisYear)}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Upcoming WCB Balance</p>
            <p className="font-bold text-amber-600 dark:text-amber-400">{fmt(data.upcomingWcbBalance)}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Missing Receipts</p>
            <p className="font-bold text-gray-900 dark:text-white">{data.missingReceipts}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Unpaid Invoices</p>
            <p className="font-bold text-gray-900 dark:text-white">{data.unpaidInvoiceCount}</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Uninvoiced Hours</p>
            <p className="font-bold text-gray-900 dark:text-white">{data.uninvoicedHoursCount}</p>
          </div>
        </div>
      </div>

      {/* Helper notices */}
      <div className="mt-4 space-y-1.5">
        <p className="text-xs text-gray-400 dark:text-gray-500 italic flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          TOTAL NET is an estimate for planning only.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 italic flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Expected WCB balances are not deducted from actual profit until paid.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 italic flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          WCB invoices may arrive later. Record the official invoice when received and update the due date.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          GST is not income - keep it separate.
        </p>
      </div>
    </div>
  );
}
