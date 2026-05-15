import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Profile, WcbPremium, WcbInstallment, WcbClearanceLetter, WcbCharge, WcbChargeType, WcbClearanceDirection, WcbClearanceStatus } from '../lib/types';
import { ShieldCheck, Plus, X, Check, AlertTriangle, ExternalLink, Pencil, Trash2, Clock, DollarSign, FileText, Ban } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

type Tab = 'overview' | 'premiums' | 'clearance' | 'tax';

export function WcbPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [premiums, setPremiums] = useState<WcbPremium[]>([]);
  const [installments, setInstallments] = useState<WcbInstallment[]>([]);
  const [charges, setCharges] = useState<WcbCharge[]>([]);
  const [letters, setLetters] = useState<WcbClearanceLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [yearNetIncome, setYearNetIncome] = useState(0);

  const [showInstForm, setShowInstForm] = useState(false);
  const [editingInstId, setEditingInstId] = useState<string | null>(null);
  const [instForm, setInstForm] = useState({ installment_number: 1, due_date: '', amount_due: 0, amount_paid: 0, paid_date: '', payment_method: '', receipt_number: '', notes: '' });

  const [showChargeForm, setShowChargeForm] = useState(false);
  const [chargeForm, setChargeForm] = useState({ charge_type: 'penalty' as WcbChargeType, amount: 0, charge_date: '', paid: false, paid_date: '', notes: '' });

  const [showLetterForm, setShowLetterForm] = useState(false);
  const [editingLetterId, setEditingLetterId] = useState<string | null>(null);
  const [letterForm, setLetterForm] = useState({ direction: 'issued_to_me' as WcbClearanceDirection, counterparty_name: '', letter_date: '', valid_through_date: '', status: 'cleared' as WcbClearanceStatus, notes: '' });

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const [pRes, premRes, instRes, chargeRes, letterRes, invRes, expRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle(),
      supabase.from('wcb_premiums').select('*').eq('user_id', user!.id).order('year', { ascending: false }),
      supabase.from('wcb_installments').select('*').eq('user_id', user!.id).order('due_date'),
      supabase.from('wcb_charges').select('*').eq('user_id', user!.id).order('charge_date', { ascending: false }),
      supabase.from('wcb_clearance_letters').select('*').eq('user_id', user!.id).order('letter_date', { ascending: false }),
      supabase.from('invoices').select('subtotal').eq('user_id', user!.id).gte('invoice_date', `${currentYear}-01-01`).lte('invoice_date', `${currentYear}-12-31`).not('status', 'eq', 'cancelled'),
      supabase.from('expenses').select('deductible_amount').eq('user_id', user!.id).gte('expense_date', `${currentYear}-01-01`).lte('expense_date', `${currentYear}-12-31`),
    ]);

    setProfile(pRes.data);
    setPremiums(premRes.data || []);
    setInstallments(instRes.data || []);
    setCharges(chargeRes.data || []);
    setLetters(letterRes.data || []);

    const rev = (invRes.data || []).reduce((s, i) => s + (i.subtotal || 0), 0);
    const exp = (expRes.data || []).reduce((s, e) => s + (e.deductible_amount || 0), 0);
    setYearNetIncome(rev - exp);
    setLoading(false);
  }

  const currentPremium = premiums.find(p => p.year === currentYear);
  const currentInstallments = installments.filter(i => i.wcb_premium_id === currentPremium?.id);
  const totalPaidInstallments = currentInstallments.reduce((s, i) => s + i.amount_paid, 0);
  const totalDueInstallments = currentPremium?.total_premium_amount || 0;
  const remainingBalance = totalDueInstallments - totalPaidInstallments;
  const progressPercent = totalDueInstallments > 0 ? Math.min(100, (totalPaidInstallments / totalDueInstallments) * 100) : 0;

  const nextInstallment = currentInstallments.find(i => i.amount_paid < i.amount_due);
  const overdueInstallments = currentInstallments.filter(i => i.due_date && new Date(i.due_date) < new Date() && i.amount_paid < i.amount_due);

  const totalNonDeductiblePaid = charges.filter(c => c.paid).reduce((s, c) => s + c.amount, 0);
  const totalDeductiblePremiums = totalPaidInstallments;

  const coverageActive = profile?.wcb_coverage_expiry_date && new Date(profile.wcb_coverage_expiry_date) > new Date();
  const daysToExpiry = profile?.wcb_coverage_expiry_date ? differenceInDays(parseISO(profile.wcb_coverage_expiry_date), new Date()) : null;

  // Installment form handlers
  async function handleInstSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPremium) return;
    const record = {
      user_id: user!.id,
      wcb_premium_id: currentPremium.id,
      installment_number: instForm.installment_number,
      due_date: instForm.due_date || null,
      amount_due: instForm.amount_due,
      amount_paid: instForm.amount_paid,
      paid_date: instForm.paid_date || null,
      payment_method: instForm.payment_method || null,
      receipt_number: instForm.receipt_number || null,
      notes: instForm.notes || null,
    };
    if (editingInstId) {
      await supabase.from('wcb_installments').update(record).eq('id', editingInstId);
    } else {
      await supabase.from('wcb_installments').insert(record);
    }
    setShowInstForm(false);
    setEditingInstId(null);
    resetInstForm();
    loadData();
  }

  function resetInstForm() {
    setInstForm({ installment_number: (currentInstallments.length || 0) + 1, due_date: '', amount_due: 0, amount_paid: 0, paid_date: '', payment_method: '', receipt_number: '', notes: '' });
  }

  function editInstallment(inst: WcbInstallment) {
    setInstForm({
      installment_number: inst.installment_number,
      due_date: inst.due_date || '',
      amount_due: inst.amount_due,
      amount_paid: inst.amount_paid,
      paid_date: inst.paid_date || '',
      payment_method: inst.payment_method || '',
      receipt_number: inst.receipt_number || '',
      notes: inst.notes || '',
    });
    setEditingInstId(inst.id);
    setShowInstForm(true);
  }

  async function markInstPaid(inst: WcbInstallment) {
    await supabase.from('wcb_installments').update({
      amount_paid: inst.amount_due,
      paid_date: format(new Date(), 'yyyy-MM-dd'),
    }).eq('id', inst.id);
    loadData();
  }

  // Charge form handlers
  async function handleChargeSubmit(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('wcb_charges').insert({
      user_id: user!.id,
      wcb_premium_id: currentPremium?.id || null,
      charge_type: chargeForm.charge_type,
      amount: chargeForm.amount,
      charge_date: chargeForm.charge_date || null,
      paid: chargeForm.paid,
      paid_date: chargeForm.paid_date || null,
      notes: chargeForm.notes || null,
    });
    setShowChargeForm(false);
    setChargeForm({ charge_type: 'penalty', amount: 0, charge_date: '', paid: false, paid_date: '', notes: '' });
    loadData();
  }

  // Letter form handlers
  async function handleLetterSubmit(e: React.FormEvent) {
    e.preventDefault();
    const record = {
      user_id: user!.id,
      direction: letterForm.direction,
      counterparty_name: letterForm.counterparty_name,
      letter_date: letterForm.letter_date || null,
      valid_through_date: letterForm.valid_through_date || null,
      status: letterForm.status,
      notes: letterForm.notes || null,
    };
    if (editingLetterId) {
      await supabase.from('wcb_clearance_letters').update(record).eq('id', editingLetterId);
    } else {
      await supabase.from('wcb_clearance_letters').insert(record);
    }
    setShowLetterForm(false);
    setEditingLetterId(null);
    setLetterForm({ direction: 'issued_to_me', counterparty_name: '', letter_date: '', valid_through_date: '', status: 'cleared', notes: '' });
    loadData();
  }

  function editLetter(letter: WcbClearanceLetter) {
    setLetterForm({
      direction: letter.direction,
      counterparty_name: letter.counterparty_name,
      letter_date: letter.letter_date || '',
      valid_through_date: letter.valid_through_date || '',
      status: letter.status,
      notes: letter.notes || '',
    });
    setEditingLetterId(letter.id);
    setShowLetterForm(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'installment') {
      await supabase.from('wcb_installments').delete().eq('id', deleteTarget.id);
    } else if (deleteTarget.type === 'charge') {
      await supabase.from('wcb_charges').delete().eq('id', deleteTarget.id);
    } else if (deleteTarget.type === 'letter') {
      await supabase.from('wcb_clearance_letters').delete().eq('id', deleteTarget.id);
    }
    setDeleteTarget(null);
    loadData();
  }

  function formatMoney(n: number) {
    return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const tabs: { key: Tab; label: string; icon: typeof ShieldCheck }[] = [
    { key: 'overview', label: 'Account', icon: ShieldCheck },
    { key: 'premiums', label: 'Premiums', icon: DollarSign },
    { key: 'clearance', label: 'Clearance', icon: FileText },
    { key: 'tax', label: 'Tax Impact', icon: Clock },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WCB Alberta</h1>
        <a href="https://myaccount.wcb.ab.ca" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          <ExternalLink className="w-4 h-4" /> myWCB Portal
        </a>
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

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'premiums' && renderPremiums()}
      {activeTab === 'clearance' && renderClearance()}
      {activeTab === 'tax' && renderTaxImpact()}

      {deleteTarget && (
        <ConfirmDeleteModal
          title={`Delete ${deleteTarget.type}`}
          itemName={deleteTarget.name}
          onDelete={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );

  function renderOverview() {
    return (
      <div className="space-y-4">
        {/* Account Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {profile?.wcb_industry_code || 'Painting Services'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Account #{profile?.wcb_account_number || 'Not set'}
                {profile?.wcb_industry_rate && ` — Rate: $${profile.wcb_industry_rate}/100 earnings`}
              </p>
            </div>
            <div className="ml-auto">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                coverageActive
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {coverageActive ? 'Active' : 'Expired/Not Set'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Coverage From</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {profile?.wcb_coverage_effective_date ? format(parseISO(profile.wcb_coverage_effective_date), 'MMM d, yyyy') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Coverage To</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {profile?.wcb_coverage_expiry_date ? format(parseISO(profile.wcb_coverage_expiry_date), 'MMM d, yyyy') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Insurable Earnings</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {profile?.wcb_insurable_earnings ? formatMoney(profile.wcb_insurable_earnings) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Days to Renewal</p>
              <p className={`font-medium ${daysToExpiry !== null && daysToExpiry < 30 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                {daysToExpiry !== null ? `${daysToExpiry} days` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Premium Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{currentYear} Premium</h3>
          <div className="flex items-end justify-between mb-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(totalDueInstallments)}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatMoney(totalPaidInstallments)} paid
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Remaining: {formatMoney(Math.max(0, remainingBalance))}</span>
            <span>{progressPercent.toFixed(0)}% paid</span>
          </div>
        </div>

        {/* Overdue Warning */}
        {overdueInstallments.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {overdueInstallments.length} overdue installment{overdueInstallments.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                Total overdue: {formatMoney(overdueInstallments.reduce((s, i) => s + (i.amount_due - i.amount_paid), 0))}
              </p>
            </div>
          </div>
        )}

        {/* Next Installment */}
        {nextInstallment && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Next Payment</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Installment #{nextInstallment.installment_number} — {formatMoney(nextInstallment.amount_due - nextInstallment.amount_paid)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {nextInstallment.due_date ? `Due ${format(parseISO(nextInstallment.due_date), 'MMMM d, yyyy')}` : 'No due date set'}
                  {nextInstallment.due_date && (() => {
                    const days = differenceInDays(parseISO(nextInstallment.due_date), new Date());
                    return days > 0 ? ` (${days} days)` : days === 0 ? ' (today)' : ` (${Math.abs(days)} days overdue)`;
                  })()}
                </p>
              </div>
              <button
                onClick={() => markInstPaid(nextInstallment)}
                className="px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
              >
                Mark Paid
              </button>
            </div>
          </div>
        )}

        {/* Quick Link */}
        <a
          href="https://myaccount.wcb.ab.ca"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Get Clearance Letter</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Request via myWCB portal, then upload the PDF here</p>
            </div>
            <ExternalLink className="w-4 h-4 text-blue-400 ml-auto" />
          </div>
        </a>
      </div>
    );
  }

  function renderPremiums() {
    return (
      <div className="space-y-4">
        {/* Action Buttons */}
        <div className="flex gap-2">
          <button onClick={() => { resetInstForm(); setEditingInstId(null); setShowInstForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Installment
          </button>
          <button onClick={() => setShowChargeForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Charge
          </button>
        </div>

        {/* Running Totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Deductible Premiums Paid</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(totalDeductiblePremiums)}</p>
            <p className="text-xs text-emerald-500 dark:text-emerald-500 mt-1">T2125 line 8690</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">Non-Deductible Charges</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">{formatMoney(totalNonDeductiblePaid)}</p>
            <p className="text-xs text-red-500 dark:text-red-500 mt-1">Penalties/interest — ITA 67.6</p>
          </div>
        </div>

        {/* Installments List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Installments ({currentYear})</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {currentInstallments.length === 0 ? (
              <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">No installments recorded</div>
            ) : currentInstallments.map(inst => {
              const isPaid = inst.amount_paid >= inst.amount_due;
              const isOverdue = inst.due_date && new Date(inst.due_date) < new Date() && !isPaid;
              return (
                <div key={inst.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Installment #{inst.installment_number}
                      </span>
                      {isPaid && <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium"><Check className="w-3 h-3" /> Paid</span>}
                      {isOverdue && <span className="text-xs text-red-600 dark:text-red-400 font-medium">Overdue</span>}
                      {!isPaid && inst.amount_paid > 0 && <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Partial</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {inst.due_date ? `Due: ${format(parseISO(inst.due_date), 'MMM d, yyyy')}` : 'No due date'}
                      {inst.paid_date && ` — Paid: ${format(parseISO(inst.paid_date), 'MMM d, yyyy')}`}
                      {inst.payment_method && ` via ${inst.payment_method}`}
                      {inst.receipt_number && ` (Ref: ${inst.receipt_number})`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(inst.amount_due)}</p>
                      {inst.amount_paid > 0 && inst.amount_paid < inst.amount_due && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Paid: {formatMoney(inst.amount_paid)}</p>
                      )}
                    </div>
                    {!isPaid && (
                      <button onClick={() => markInstPaid(inst)} className="p-1.5 text-gray-400 hover:text-emerald-600" title="Mark Paid">
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => editInstallment(inst)} className="p-1.5 text-gray-400 hover:text-teal-600" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {!isPaid && (
                      <button onClick={() => setDeleteTarget({ type: 'installment', id: inst.id, name: `Installment #${inst.installment_number}` })} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charges List */}
        {charges.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800">
            <div className="p-4 border-b border-red-100 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Non-Deductible Charges</h3>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">These CANNOT be deducted on your taxes (ITA 67.6)</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {charges.map(ch => (
                <div key={ch.id} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{ch.charge_type.replace('_', ' ')}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {ch.charge_date && format(parseISO(ch.charge_date), 'MMM d, yyyy')}
                      {ch.paid && ' — Paid'}
                      {ch.notes && ` — ${ch.notes}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatMoney(ch.amount)}</span>
                    <button onClick={() => setDeleteTarget({ type: 'charge', id: ch.id, name: `${ch.charge_type} charge` })} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Installment Form Modal */}
        {showInstForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingInstId ? 'Edit Installment' : 'Add Installment'}</h2>
                <button onClick={() => setShowInstForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleInstSubmit} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Installment #</label>
                    <input type="number" value={instForm.installment_number} onChange={e => setInstForm(f => ({ ...f, installment_number: parseInt(e.target.value) || 1 }))} min={1} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                    <input type="date" value={instForm.due_date} onChange={e => setInstForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Due</label>
                    <input type="number" value={instForm.amount_due || ''} onChange={e => setInstForm(f => ({ ...f, amount_due: parseFloat(e.target.value) || 0 }))} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Paid</label>
                    <input type="number" value={instForm.amount_paid || ''} onChange={e => setInstForm(f => ({ ...f, amount_paid: parseFloat(e.target.value) || 0 }))} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paid Date</label>
                  <input type="date" value={instForm.paid_date} onChange={e => setInstForm(f => ({ ...f, paid_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                    <select value={instForm.payment_method} onChange={e => setInstForm(f => ({ ...f, payment_method: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="">—</option>
                      <option value="Visa Debit">Visa Debit</option>
                      <option value="Online Banking">Online Banking</option>
                      <option value="PAD">PAD (Pre-authorized)</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Receipt #</label>
                    <input type="text" value={instForm.receipt_number} onChange={e => setInstForm(f => ({ ...f, receipt_number: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={instForm.notes} onChange={e => setInstForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors">
                  {editingInstId ? 'Update' : 'Add Installment'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Charge Form Modal */}
        {showChargeForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Non-Deductible Charge</h2>
                <button onClick={() => setShowChargeForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleChargeSubmit} className="p-4 space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium">This charge is NOT tax-deductible (ITA 67.6)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select value={chargeForm.charge_type} onChange={e => setChargeForm(f => ({ ...f, charge_type: e.target.value as WcbChargeType }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="penalty">Penalty</option>
                    <option value="interest">Interest</option>
                    <option value="admin_fee">Admin Fee</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                    <input type="number" value={chargeForm.amount || ''} onChange={e => setChargeForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} min={0} step={0.01} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                    <input type="date" value={chargeForm.charge_date} onChange={e => setChargeForm(f => ({ ...f, charge_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={chargeForm.paid} onChange={e => setChargeForm(f => ({ ...f, paid: e.target.checked }))} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Already paid</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={chargeForm.notes} onChange={e => setChargeForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <button type="submit" className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
                  Add Charge
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderClearance() {
    const issuedToMe = letters.filter(l => l.direction === 'issued_to_me');
    const iIssued = letters.filter(l => l.direction === 'i_issued');

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Track clearance letters for contractors and subcontractors.</p>
          <button onClick={() => { setEditingLetterId(null); setLetterForm({ direction: 'issued_to_me', counterparty_name: '', letter_date: '', valid_through_date: '', status: 'cleared', notes: '' }); setShowLetterForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Letter
          </button>
        </div>

        {/* Letters Issued TO Me */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Letters Issued TO Me</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">From contractors who hired me — proof of coverage for payment release</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {issuedToMe.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No letters recorded</div>
            ) : issuedToMe.map(l => renderLetterRow(l))}
          </div>
        </div>

        {/* Letters I Issued */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Letters I Issued</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">For subcontractors I hired, or letters I generated for my contractors</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {iIssued.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No letters recorded</div>
            ) : iIssued.map(l => renderLetterRow(l))}
          </div>
        </div>

        {/* Letter Form Modal */}
        {showLetterForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingLetterId ? 'Edit Letter' : 'Add Clearance Letter'}</h2>
                <button onClick={() => setShowLetterForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleLetterSubmit} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Direction</label>
                  <select value={letterForm.direction} onChange={e => setLetterForm(f => ({ ...f, direction: e.target.value as WcbClearanceDirection }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="issued_to_me">Issued TO me (from a contractor)</option>
                    <option value="i_issued">I issued (to my contractor/sub)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Counterparty Name</label>
                  <input type="text" value={letterForm.counterparty_name} onChange={e => setLetterForm(f => ({ ...f, counterparty_name: e.target.value }))} required placeholder="Company or person name" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Letter Date</label>
                    <input type="date" value={letterForm.letter_date} onChange={e => setLetterForm(f => ({ ...f, letter_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valid Through</label>
                    <input type="date" value={letterForm.valid_through_date} onChange={e => setLetterForm(f => ({ ...f, valid_through_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select value={letterForm.status} onChange={e => setLetterForm(f => ({ ...f, status: e.target.value as WcbClearanceStatus }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="cleared">Cleared</option>
                    <option value="not_cleared">Not Cleared</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={letterForm.notes} onChange={e => setLetterForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors">
                  {editingLetterId ? 'Update' : 'Add Letter'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderLetterRow(l: WcbClearanceLetter) {
    const isExpiring = l.valid_through_date && differenceInDays(parseISO(l.valid_through_date), new Date()) < 30 && differenceInDays(parseISO(l.valid_through_date), new Date()) >= 0;
    const isExpired = l.valid_through_date && new Date(l.valid_through_date) < new Date();

    return (
      <div key={l.id} className="p-4 flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{l.counterparty_name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              l.status === 'cleared' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
              l.status === 'not_cleared' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
              'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>{l.status.replace('_', ' ')}</span>
            {isExpiring && <span className="text-xs text-amber-600 font-medium">Expiring soon</span>}
            {isExpired && <span className="text-xs text-red-600 font-medium">Expired</span>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {l.letter_date && `Issued: ${format(parseISO(l.letter_date), 'MMM d, yyyy')}`}
            {l.valid_through_date && ` — Valid through: ${format(parseISO(l.valid_through_date), 'MMM d, yyyy')}`}
          </p>
          {l.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{l.notes}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => editLetter(l)} className="p-1.5 text-gray-400 hover:text-teal-600" title="Edit">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => setDeleteTarget({ type: 'letter', id: l.id, name: `Letter — ${l.counterparty_name}` })} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  function renderTaxImpact() {
    const marginalRate = yearNetIncome > 0 ? 0.305 : 0;
    const taxSavings = totalDeductiblePremiums * marginalRate;

    return (
      <div className="space-y-4">
        {/* Deductible */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Deductible This Year</h3>
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(totalDeductiblePremiums)}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            WCB premiums — flows into T2125 expenses, line 8690 (Insurance)
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            Estimated tax savings at your marginal rate: {formatMoney(taxSavings)}
          </p>
        </div>

        {/* Non-Deductible */}
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">NOT Deductible</h3>
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatMoney(totalNonDeductiblePaid)}</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            Penalties and interest — cannot be deducted (ITA 67.6). Tracked for accounting only.
          </p>
        </div>

        {/* WCB Benefits Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">If Injured — WCB Benefits</h3>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            WCB benefits go on T1 line 14400 and offset on line 25000 — not business income.
            Effectively tax-free at federal level but still affects some calculations.
          </p>
        </div>

        {/* Insurable Earnings Mismatch */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Insurable Earnings vs Actual Income</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Declared Insurable Earnings</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {profile?.wcb_insurable_earnings ? formatMoney(profile.wcb_insurable_earnings) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Actual Net Business Income ({currentYear})</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(yearNetIncome)}</p>
            </div>
          </div>
          {profile?.wcb_insurable_earnings && yearNetIncome > 0 && Math.abs(profile.wcb_insurable_earnings - yearNetIncome) > profile.wcb_insurable_earnings * 0.3 && (
            <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Large mismatch detected. WCB caps benefits at the lower of declared insurable earnings or actual net income. Consider updating your declared amount.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center italic mt-6">
          Estimate only. Consult a CPA for filing.
        </p>
      </div>
    );
  }
}
