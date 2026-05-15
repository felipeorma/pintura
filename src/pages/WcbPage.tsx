import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { WcbPayment, WcbStatus } from '../lib/types';
import { Plus, X, ShieldCheck, AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';

const WCB_TOTAL_PREMIUM = 838.92;

const STATUS_CONFIG: Record<WcbStatus, { label: string; color: string; icon: typeof Clock }> = {
  waiting_for_invoice: { label: 'Waiting for Invoice', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  invoice_received: { label: 'Invoice Received', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: FileText },
  partially_paid: { label: 'Partially Paid', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300', icon: AlertCircle },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: AlertCircle },
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Clock },
};

const EMPTY_FORM = {
  description: '',
  expected_invoice_date: '',
  invoice_received: false,
  invoice_date: '',
  due_date: '',
  amount_expected: 0,
  amount_paid: 0,
  payment_date: '',
  status: 'waiting_for_invoice' as WcbStatus,
  notes: '',
};

export function WcbPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<WcbPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const { data } = await supabase
      .from('wcb_payments')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true });
    setPayments(data || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const remainingBalance = formData.amount_expected - formData.amount_paid;
    const record = {
      user_id: user!.id,
      description: formData.description || null,
      expected_invoice_date: formData.expected_invoice_date || null,
      invoice_received: formData.invoice_received,
      invoice_date: formData.invoice_date || null,
      due_date: formData.due_date || null,
      amount_expected: formData.amount_expected,
      amount_paid: formData.amount_paid,
      remaining_balance: remainingBalance,
      payment_date: formData.payment_date || null,
      status: formData.status,
      notes: formData.notes || null,
      amount: formData.amount_expected,
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      await supabase.from('wcb_payments').update(record).eq('id', editingId);
    } else {
      await supabase.from('wcb_payments').insert(record);
    }
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    loadData();
  }

  function editPayment(p: WcbPayment) {
    setFormData({
      description: p.description || '',
      expected_invoice_date: p.expected_invoice_date || '',
      invoice_received: p.invoice_received,
      invoice_date: p.invoice_date || '',
      due_date: p.due_date || '',
      amount_expected: p.amount_expected,
      amount_paid: p.amount_paid,
      payment_date: p.payment_date || '',
      status: p.status,
      notes: p.notes || '',
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0);
  const totalRemaining = WCB_TOTAL_PREMIUM - totalPaid;
  const upcomingBalance = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + p.remaining_balance, 0);

  const nextUnpaid = payments.find(p => p.status !== 'paid');
  const nextExpectedDate = nextUnpaid?.expected_invoice_date;
  const nextDueDate = nextUnpaid?.due_date;

  function getOverallStatus(): WcbStatus {
    if (totalRemaining <= 0) return 'paid';
    if (payments.some(p => p.status === 'overdue')) return 'overdue';
    if (payments.some(p => p.status === 'invoice_received')) return 'invoice_received';
    if (payments.some(p => p.status === 'partially_paid')) return 'partially_paid';
    return 'waiting_for_invoice';
  }

  const overallStatus = getOverallStatus();
  const statusInfo = STATUS_CONFIG[overallStatus];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WCB Payments</h1>
        <button onClick={() => { setFormData(EMPTY_FORM); setEditingId(null); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Payment
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">WCB Alberta - Painting Services</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Account #11029825 - Provisionally Approved</p>
          </div>
          <div className="ml-auto">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
              <statusInfo.icon className="w-3 h-3" />
              {statusInfo.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">2026 Premium</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">${WCB_TOTAL_PREMIUM.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Paid</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">${totalPaid.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Remaining Balance</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">${totalRemaining.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Upcoming Due</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">${upcomingBalance.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Next expected invoice: </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {nextExpectedDate ? format(new Date(nextExpectedDate + 'T00:00'), 'MMM d, yyyy') : 'Not set'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Next due date: </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {nextDueDate ? format(new Date(nextDueDate + 'T00:00'), 'MMM d, yyyy') : 'Pending invoice'}
            </span>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-5 text-xs text-blue-700 dark:text-blue-300 space-y-1">
        <p>WCB invoices may arrive later. Record the official invoice when received and update the due date.</p>
        <p>Expected WCB balances are not deducted from actual profit until paid.</p>
      </div>

      {/* Payments List */}
      <div className="space-y-2">
        {payments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No WCB payments recorded</p>
          </div>
        ) : payments.map(p => {
          const config = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
          return (
            <div key={p.id} onClick={() => editPayment(p)} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{p.description || 'WCB Payment'}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    {p.payment_date && <span>Paid: {format(new Date(p.payment_date + 'T00:00'), 'MMM d, yyyy')}</span>}
                    {p.expected_invoice_date && <span>Expected: {format(new Date(p.expected_invoice_date + 'T00:00'), 'MMM d, yyyy')}</span>}
                    {p.due_date && <span>Due: {format(new Date(p.due_date + 'T00:00'), 'MMM d, yyyy')}</span>}
                    {p.invoice_received && <span className="text-blue-600 dark:text-blue-400">Invoice received</span>}
                  </div>
                  {p.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{p.notes}</p>}
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">${p.amount_expected.toFixed(2)}</p>
                  {p.amount_paid > 0 && p.amount_paid < p.amount_expected && (
                    <p className="text-xs text-green-600 dark:text-green-400">Paid: ${p.amount_paid.toFixed(2)}</p>
                  )}
                  {p.remaining_balance > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Remaining: ${p.remaining_balance.toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingId ? 'Edit WCB Payment' : 'Add WCB Payment'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="e.g. First installment" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Expected</label>
                  <input type="number" value={formData.amount_expected} onChange={e => setFormData(f => ({ ...f, amount_expected: parseFloat(e.target.value) || 0 }))} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Paid</label>
                  <input type="number" value={formData.amount_paid} onChange={e => setFormData(f => ({ ...f, amount_paid: parseFloat(e.target.value) || 0 }))} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Remaining Balance: <span className="font-semibold">${(formData.amount_expected - formData.amount_paid).toFixed(2)}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value as WcbStatus }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="waiting_for_invoice">Waiting for Invoice</option>
                  <option value="invoice_received">Invoice Received</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Invoice Date</label>
                  <input type="date" value={formData.expected_invoice_date} onChange={e => setFormData(f => ({ ...f, expected_invoice_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Date</label>
                  <input type="date" value={formData.payment_date} onChange={e => setFormData(f => ({ ...f, payment_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={formData.invoice_received} onChange={e => setFormData(f => ({ ...f, invoice_received: e.target.checked }))} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-600 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
                <span className="text-sm text-gray-700 dark:text-gray-300">Invoice Received</span>
              </div>

              {formData.invoice_received && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invoice Date</label>
                    <input type="date" value={formData.invoice_date} onChange={e => setFormData(f => ({ ...f, invoice_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                    <input type="date" value={formData.due_date} onChange={e => setFormData(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>

              <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors">
                {editingId ? 'Update' : 'Add Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
