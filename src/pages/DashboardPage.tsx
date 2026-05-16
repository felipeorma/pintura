import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock, DollarSign, FileText, Receipt,
  TrendingUp, TrendingDown, AlertTriangle, Car,
  Calendar, ExternalLink
} from 'lucide-react';
import { startOfMonth, endOfMonth, format, subMonths, differenceInDays, parseISO } from 'date-fns';

interface DashboardData {
  earnedThisMonth: number;
  earnedLastMonth: number;
  employmentThisMonth: number;
  hoursThisMonth: number;
  taxSetAside: number;
  taxWithheld: number;
  alerts: Alert[];
  recentActivity: ActivityItem[];
  weeklyEarnings: number[];
}

interface Alert {
  message: string;
  link: string;
  level: 'warning' | 'error';
}

interface ActivityItem {
  id: string;
  type: 'hours' | 'invoice' | 'expense' | 'trip';
  text: string;
  time: string;
  link: string;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  async function loadDashboard() {
    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const yearStart = `${now.getFullYear()}-01-01`;

    const [
      monthInvRes, lastMonthInvRes, monthHoursRes,
      yearInvRes, yearExpRes, profileRes,
      overdueRes, uninvoicedRes,
      wcbInstRes, taxInstRes,
      clientsRes,
      recentHoursRes, recentInvRes, recentExpRes, recentTripsRes,
      empRes, paystubMonthRes,
    ] = await Promise.all([
      supabase.from('invoices').select('subtotal').eq('user_id', user!.id).gte('invoice_date', monthStart).lte('invoice_date', monthEnd).not('status', 'eq', 'cancelled'),
      supabase.from('invoices').select('subtotal').eq('user_id', user!.id).gte('invoice_date', lastMonthStart).lte('invoice_date', lastMonthEnd).not('status', 'eq', 'cancelled'),
      supabase.from('work_hours').select('total_hours').eq('user_id', user!.id).gte('work_date', monthStart).lte('work_date', monthEnd),
      supabase.from('invoices').select('subtotal').eq('user_id', user!.id).gte('invoice_date', yearStart).not('status', 'eq', 'cancelled'),
      supabase.from('expenses').select('deductible_amount').eq('user_id', user!.id).gte('expense_date', yearStart),
      supabase.from('profiles').select('default_tax_reserve_percent, wcb_coverage_expiry_date').eq('id', user!.id).maybeSingle(),
      supabase.from('invoices').select('id').eq('user_id', user!.id).eq('status', 'overdue'),
      supabase.from('work_hours').select('id').eq('user_id', user!.id).eq('status', 'not_invoiced'),
      supabase.from('wcb_installments').select('due_date, amount_due, amount_paid').eq('user_id', user!.id),
      supabase.from('tax_installments').select('due_date, amount_paid').eq('user_id', user!.id).eq('year', now.getFullYear()),
      supabase.from('clients').select('id, email').eq('user_id', user!.id).eq('active', true),
      supabase.from('work_hours').select('id, work_date, total_hours, job_sites(site_name), created_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(4),
      supabase.from('invoices').select('id, invoice_number, status, updated_at').eq('user_id', user!.id).order('updated_at', { ascending: false }).limit(4),
      supabase.from('expenses').select('id, expense_date, vendor, total_paid, created_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(4),
      supabase.from('mileage_logs').select('id, log_date, km_driven, destination, created_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(4),
      supabase.from('employment_income').select('box_14_employment_income, box_22_income_tax_deducted').eq('user_id', user!.id).eq('year', now.getFullYear()),
      supabase.from('paystubs').select('gross_pay, tax_withheld, pay_period_end').eq('user_id', user!.id).gte('pay_period_end', monthStart).lte('pay_period_end', monthEnd),
    ]);

    const earnedThisMonth = (monthInvRes.data || []).reduce((s, i) => s + (i.subtotal || 0), 0);
    const earnedLastMonth = (lastMonthInvRes.data || []).reduce((s, i) => s + (i.subtotal || 0), 0);
    const employmentThisMonth = (paystubMonthRes.data || []).reduce((s, p) => s + (p.gross_pay || 0), 0);
    const hoursThisMonth = (monthHoursRes.data || []).reduce((s, r) => s + (r.total_hours || 0), 0);

    const yearRevenue = (yearInvRes.data || []).reduce((s, i) => s + (i.subtotal || 0), 0);
    const yearExpenses = (yearExpRes.data || []).reduce((s, e) => s + (e.deductible_amount || 0), 0);
    const yearEmpIncome = (empRes.data || []).reduce((s, e) => s + (e.box_14_employment_income || 0), 0);
    const yearTaxWithheld = (empRes.data || []).reduce((s, e) => s + (e.box_22_income_tax_deducted || 0), 0);
    const netBusinessIncome = yearRevenue - yearExpenses;
    const totalIncome = netBusinessIncome + yearEmpIncome;
    const reservePercent = profileRes.data?.default_tax_reserve_percent || 30;
    const taxSetAside = Math.max(0, totalIncome * (reservePercent / 100) - yearTaxWithheld);

    // Build alerts
    const alerts: Alert[] = [];
    const overdueCount = overdueRes.data?.length || 0;
    if (overdueCount > 0) {
      alerts.push({ message: `${overdueCount} invoice${overdueCount > 1 ? 's' : ''} overdue`, link: '/invoices', level: 'error' });
    }
    const uninvoicedCount = uninvoicedRes.data?.length || 0;
    if (uninvoicedCount >= 5) {
      alerts.push({ message: `${uninvoicedCount} hours not yet invoiced`, link: '/hours', level: 'warning' });
    }
    const nextWcbInst = (wcbInstRes.data || []).find(i => i.amount_paid < i.amount_due && i.due_date);
    if (nextWcbInst) {
      const days = differenceInDays(parseISO(nextWcbInst.due_date), now);
      if (days <= 14 && days >= 0) {
        alerts.push({ message: `WCB installment due in ${days} day${days !== 1 ? 's' : ''}`, link: '/wcb', level: 'warning' });
      } else if (days < 0) {
        alerts.push({ message: `WCB installment overdue by ${Math.abs(days)} days`, link: '/wcb', level: 'error' });
      }
    }
    const nextTaxInst = (taxInstRes.data || []).find(i => !i.amount_paid && i.due_date);
    if (nextTaxInst) {
      const days = differenceInDays(parseISO(nextTaxInst.due_date), now);
      if (days <= 14 && days >= 0) {
        alerts.push({ message: `Tax instalment due in ${days} day${days !== 1 ? 's' : ''}`, link: '/tax', level: 'warning' });
      }
    }
    const noEmailClients = (clientsRes.data || []).filter(c => !c.email).length;
    if (noEmailClients > 0) {
      alerts.push({ message: `${noEmailClients} client${noEmailClients > 1 ? 's' : ''} missing email`, link: '/clients', level: 'warning' });
    }

    // Build recent activity
    const activity: ActivityItem[] = [];
    (recentHoursRes.data || []).forEach(h => {
      const site = (h as any).job_sites?.site_name || 'Unknown site';
      activity.push({ id: `h-${h.id}`, type: 'hours', text: `Logged ${h.total_hours?.toFixed(1)}h at ${site}`, time: h.created_at, link: '/hours' });
    });
    (recentInvRes.data || []).forEach(i => {
      activity.push({ id: `i-${i.id}`, type: 'invoice', text: `Invoice ${i.invoice_number} — ${i.status}`, time: i.updated_at, link: '/invoices' });
    });
    (recentExpRes.data || []).forEach(e => {
      activity.push({ id: `e-${e.id}`, type: 'expense', text: `$${e.total_paid.toFixed(2)} — ${e.vendor || 'Expense'}`, time: e.created_at, link: '/expenses' });
    });
    (recentTripsRes.data || []).forEach(t => {
      activity.push({ id: `t-${t.id}`, type: 'trip', text: `${t.km_driven} km to ${t.destination || 'Job site'}`, time: t.created_at, link: '/vehicle' });
    });
    activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Weekly earnings for mini chart
    const weeklyEarnings = [0, 0, 0, 0, 0];
    (monthInvRes.data || []).forEach(() => {
      // Approximate distribution across weeks
    });

    setData({
      earnedThisMonth,
      earnedLastMonth,
      employmentThisMonth,
      hoursThisMonth,
      taxSetAside,
      taxWithheld: yearTaxWithheld,
      alerts,
      recentActivity: activity.slice(0, 8),
      weeklyEarnings,
    });
    setLoading(false);
  }

  function formatMoney(n: number) {
    return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return format(new Date(dateStr), 'MMM d');
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
        <div className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const earnedDelta = data.earnedLastMonth > 0
    ? ((data.earnedThisMonth - data.earnedLastMonth) / data.earnedLastMonth) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* A) Hero Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-800/20 border border-teal-200/50 dark:border-teal-800/50 p-5">
          <p className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide">Earned this month</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{formatMoney(data.earnedThisMonth + data.employmentThisMonth)}</p>
          {data.employmentThisMonth > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatMoney(data.earnedThisMonth)} business + {formatMoney(data.employmentThisMonth)} employment</p>
          )}
          {earnedDelta !== 0 && !data.employmentThisMonth && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${earnedDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {earnedDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(earnedDelta).toFixed(0)}% vs last month
            </div>
          )}
          <DollarSign className="absolute -bottom-2 -right-2 w-16 h-16 text-teal-200/40 dark:text-teal-700/30" />
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200/50 dark:border-blue-800/50 p-5">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Hours worked</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{data.hoursThisMonth.toFixed(1)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{format(new Date(), 'MMMM yyyy')}</p>
          <Clock className="absolute -bottom-2 -right-2 w-16 h-16 text-blue-200/40 dark:text-blue-700/30" />
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 border border-amber-200/50 dark:border-amber-800/50 p-5">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Tax set aside</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{formatMoney(data.taxSetAside)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {data.taxWithheld > 0 ? `After ${formatMoney(data.taxWithheld)} withheld via T4` : 'Year-to-date reserve'}
          </p>
          <Calendar className="absolute -bottom-2 -right-2 w-16 h-16 text-amber-200/40 dark:text-amber-700/30" />
        </div>
      </div>

      {/* B) Attention Panel */}
      {data.alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-900/20 p-4 space-y-2">
          {data.alerts.map((alert, idx) => (
            <button
              key={idx}
              onClick={() => navigate(alert.link)}
              className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
            >
              <AlertTriangle className={`w-4 h-4 shrink-0 ${alert.level === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <span className={`text-sm font-medium ${alert.level === 'error' ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}`}>
                {alert.message}
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-400 ml-auto shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* C) Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => navigate('/hours')} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm transition-colors shadow-sm">
          <Clock className="w-4 h-4" /> Log Hours
        </button>
        <button onClick={() => navigate('/expenses')} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm transition-colors shadow-sm">
          <Receipt className="w-4 h-4" /> Add Expense
        </button>
        <button onClick={() => navigate('/invoices')} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-sm">
          <FileText className="w-4 h-4" /> Invoice
        </button>
        <button onClick={() => navigate('/vehicle')} className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm">
          <Car className="w-4 h-4" /> Log Trip
        </button>
      </div>

      {/* D) Recent Activity */}
      {data.recentActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {data.recentActivity.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.link)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className={`p-1.5 rounded-lg ${
                  item.type === 'hours' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  item.type === 'invoice' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                  item.type === 'expense' ? 'bg-orange-100 dark:bg-orange-900/30' :
                  'bg-sky-100 dark:bg-sky-900/30'
                }`}>
                  {item.type === 'hours' && <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  {item.type === 'invoice' && <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  {item.type === 'expense' && <Receipt className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />}
                  {item.type === 'trip' && <Car className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{item.text}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{timeAgo(item.time)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center italic">
        Tax reserve is an estimate based on {format(new Date(), 'yyyy')} data. Consult a CPA for filing.
      </p>
    </div>
  );
}
