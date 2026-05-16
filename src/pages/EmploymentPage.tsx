import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { EmploymentIncome, Paystub } from '../lib/types';
import { Briefcase, FileText, DollarSign, Plus, Pencil, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

type Tab = 'employers' | 't4' | 'paystubs';

export function EmploymentPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('employers');
  const [employers, setEmployers] = useState<EmploymentIncome[]>([]);
  const [paystubs, setPaystubs] = useState<(Paystub & { employment_income?: { employer_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPaystubForm, setShowPaystubForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'employer' | 'paystub' } | null>(null);

  const [form, setForm] = useState({
    employer_name: '',
    employer_address: '',
    start_date: '',
    end_date: '',
    is_current: true,
    position_title: '',
    box_14: 0,
    box_16: 0,
    box_18: 0,
    box_20: 0,
    box_22: 0,
    box_26: 0,
    box_44: 0,
    box_46: 0,
    box_52: 0,
    t4_received: false,
    notes: '',
  });

  const [paystubForm, setPaystubForm] = useState({
    employment_income_id: '',
    pay_period_end: '',
    gross_pay: 0,
    cpp_withheld: 0,
    ei_withheld: 0,
    tax_withheld: 0,
    rpp_withheld: 0,
    other_deductions: 0,
    net_pay: 0,
    notes: '',
  });

  useEffect(() => {
    if (user) loadData();
  }, [user, selectedYear]);

  async function loadData() {
    setLoading(true);
    const [empRes, payRes] = await Promise.all([
      supabase.from('employment_income').select('*').eq('user_id', user!.id).eq('year', selectedYear).order('employer_name'),
      supabase.from('paystubs').select('*, employment_income(employer_name)').eq('user_id', user!.id).order('pay_period_end', { ascending: false }),
    ]);
    setEmployers(empRes.data || []);
    setPaystubs((payRes.data || []).filter(p => {
      const emp = (empRes.data || []).find(e => e.id === p.employment_income_id);
      return emp?.year === selectedYear;
    }));
    setLoading(false);
  }

  function resetForm() {
    setForm({ employer_name: '', employer_address: '', start_date: '', end_date: '', is_current: true, position_title: '', box_14: 0, box_16: 0, box_18: 0, box_20: 0, box_22: 0, box_26: 0, box_44: 0, box_46: 0, box_52: 0, t4_received: false, notes: '' });
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(emp: EmploymentIncome) {
    setForm({
      employer_name: emp.employer_name,
      employer_address: emp.employer_address || '',
      start_date: emp.start_date || '',
      end_date: emp.end_date || '',
      is_current: emp.is_current,
      position_title: emp.position_title || '',
      box_14: emp.box_14_employment_income,
      box_16: emp.box_16_cpp_contributions,
      box_18: emp.box_18_ei_premiums,
      box_20: emp.box_20_rpp_contributions,
      box_22: emp.box_22_income_tax_deducted,
      box_26: emp.box_26_cpp_pensionable_earnings,
      box_44: emp.box_44_union_dues,
      box_46: emp.box_46_charitable_donations,
      box_52: emp.box_52_pension_adjustment,
      t4_received: emp.t4_received,
      notes: emp.notes || '',
    });
    setEditingId(emp.id);
    setShowForm(true);
  }

  async function saveEmployer() {
    if (!form.employer_name.trim()) return;
    const payload = {
      user_id: user!.id,
      year: selectedYear,
      employer_name: form.employer_name.trim(),
      employer_address: form.employer_address || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_current: form.is_current,
      position_title: form.position_title || null,
      box_14_employment_income: form.box_14,
      box_16_cpp_contributions: form.box_16,
      box_17_qpp_contributions: 0,
      box_18_ei_premiums: form.box_18,
      box_20_rpp_contributions: form.box_20,
      box_22_income_tax_deducted: form.box_22,
      box_24_ei_insurable_earnings: form.box_14,
      box_26_cpp_pensionable_earnings: form.box_26 || form.box_14,
      box_44_union_dues: form.box_44,
      box_46_charitable_donations: form.box_46,
      box_52_pension_adjustment: form.box_52,
      t4_received: form.t4_received,
      notes: form.notes || null,
    };

    if (editingId) {
      await supabase.from('employment_income').update(payload).eq('id', editingId);
    } else {
      await supabase.from('employment_income').insert(payload);
    }
    resetForm();
    loadData();
  }

  async function savePaystub() {
    if (!paystubForm.employment_income_id || !paystubForm.pay_period_end) return;
    await supabase.from('paystubs').insert({
      user_id: user!.id,
      employment_income_id: paystubForm.employment_income_id,
      pay_period_end: paystubForm.pay_period_end,
      gross_pay: paystubForm.gross_pay,
      cpp_withheld: paystubForm.cpp_withheld,
      ei_withheld: paystubForm.ei_withheld,
      tax_withheld: paystubForm.tax_withheld,
      rpp_withheld: paystubForm.rpp_withheld,
      other_deductions: paystubForm.other_deductions,
      net_pay: paystubForm.net_pay,
      notes: paystubForm.notes || null,
    });
    setShowPaystubForm(false);
    setPaystubForm({ employment_income_id: '', pay_period_end: '', gross_pay: 0, cpp_withheld: 0, ei_withheld: 0, tax_withheld: 0, rpp_withheld: 0, other_deductions: 0, net_pay: 0, notes: '' });
    loadData();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'employer') {
      await supabase.from('employment_income').delete().eq('id', deleteTarget.id);
    } else {
      await supabase.from('paystubs').delete().eq('id', deleteTarget.id);
    }
    setDeleteTarget(null);
    loadData();
  }

  function formatMoney(n: number) {
    return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const tabs: { key: Tab; label: string; icon: typeof Briefcase }[] = [
    { key: 'employers', label: 'Employers', icon: Briefcase },
    { key: 't4', label: 'T4 Slips', icon: FileText },
    { key: 'paystubs', label: 'Paystub Log', icon: DollarSign },
  ];

  const totalEmploymentIncome = employers.reduce((s, e) => s + e.box_14_employment_income, 0);
  const totalTaxWithheld = employers.reduce((s, e) => s + e.box_22_income_tax_deducted, 0);
  const totalCppPaid = employers.reduce((s, e) => s + e.box_16_cpp_contributions, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employment Income</h1>
        <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary strip */}
      {employers.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">T4 Income</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(totalEmploymentIncome)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Tax Withheld</p>
            <p className="text-lg font-bold text-emerald-600">{formatMoney(totalTaxWithheld)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">CPP Paid</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(totalCppPaid)}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
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

      {activeTab === 'employers' && renderEmployers()}
      {activeTab === 't4' && renderT4()}
      {activeTab === 'paystubs' && renderPaystubs()}

      {deleteTarget && (
        <ConfirmDeleteModal
          title={`Delete ${deleteTarget.type === 'employer' ? 'employer' : 'paystub'}?`}
          itemName={deleteTarget.name}
          onDelete={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );

  function renderEmployers() {
    const current = employers.filter(e => e.is_current);
    const past = employers.filter(e => !e.is_current);

    return (
      <div className="space-y-4">
        <button onClick={() => { resetForm(); setShowForm(true); }} className="w-full flex items-center justify-center gap-2 p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Employer
        </button>

        {showForm && renderEmployerForm()}

        {current.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Current Employers</h3>
            <div className="space-y-2">
              {current.map(emp => renderEmployerRow(emp))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Past Employers</h3>
            <div className="space-y-2">
              {past.map(emp => renderEmployerRow(emp))}
            </div>
          </div>
        )}

        {employers.length === 0 && !showForm && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">No employment income recorded for {selectedYear}.</p>
        )}
      </div>
    );
  }

  function renderEmployerRow(emp: EmploymentIncome) {
    return (
      <div key={emp.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{emp.employer_name}</p>
            {emp.position_title && <p className="text-xs text-gray-500 dark:text-gray-400">{emp.position_title}</p>}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {emp.start_date ? format(new Date(emp.start_date + 'T00:00'), 'MMM yyyy') : 'Start N/A'}
              {' — '}
              {emp.is_current ? 'Ongoing' : emp.end_date ? format(new Date(emp.end_date + 'T00:00'), 'MMM yyyy') : 'Ended'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => startEdit(emp)} className="p-1.5 text-gray-400 hover:text-teal-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => setDeleteTarget({ id: emp.id, name: emp.employer_name, type: 'employer' })} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Income</span>
            <p className="font-medium text-gray-900 dark:text-white">{formatMoney(emp.box_14_employment_income)}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Tax Withheld</span>
            <p className="font-medium text-emerald-600">{formatMoney(emp.box_22_income_tax_deducted)}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">CPP</span>
            <p className="font-medium text-gray-900 dark:text-white">{formatMoney(emp.box_16_cpp_contributions)}</p>
          </div>
        </div>
      </div>
    );
  }

  function renderEmployerForm() {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{editingId ? 'Edit' : 'Add'} Employer / T4</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Employer name *</label>
            <input type="text" value={form.employer_name} onChange={e => setForm(f => ({ ...f, employer_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Position</label>
            <input type="text" value={form.position_title} onChange={e => setForm(f => ({ ...f, position_title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.is_current} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Currently employed
            </label>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start date</label>
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          {!form.is_current && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">T4 Boxes</h4>
          <div className="grid grid-cols-2 gap-3">
            <FormNum label="Box 14 — Employment income" value={form.box_14} onChange={v => setForm(f => ({ ...f, box_14: v }))} />
            <FormNum label="Box 22 — Income tax deducted" value={form.box_22} onChange={v => setForm(f => ({ ...f, box_22: v }))} />
            <FormNum label="Box 16 — CPP contributions" value={form.box_16} onChange={v => setForm(f => ({ ...f, box_16: v }))} />
            <FormNum label="Box 18 — EI premiums" value={form.box_18} onChange={v => setForm(f => ({ ...f, box_18: v }))} />
            <FormNum label="Box 26 — CPP pensionable earnings" value={form.box_26} onChange={v => setForm(f => ({ ...f, box_26: v }))} />
            <FormNum label="Box 20 — RPP contributions" value={form.box_20} onChange={v => setForm(f => ({ ...f, box_20: v }))} />
            <FormNum label="Box 44 — Union dues" value={form.box_44} onChange={v => setForm(f => ({ ...f, box_44: v }))} />
            <FormNum label="Box 52 — Pension adjustment" value={form.box_52} onChange={v => setForm(f => ({ ...f, box_52: v }))} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.t4_received} onChange={e => setForm(f => ({ ...f, t4_received: e.target.checked }))} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
            T4 slip received
          </label>
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
        </div>

        <div className="flex gap-2">
          <button onClick={saveEmployer} className="flex-1 flex items-center justify-center gap-2 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Check className="w-3.5 h-3.5" /> {editingId ? 'Update' : 'Save'}
          </button>
          <button onClick={resetForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  function renderT4() {
    return (
      <div className="space-y-4">
        {employers.length === 0 ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">No T4 slips for {selectedYear}. Add an employer first.</p>
        ) : (
          <div className="space-y-3">
            {employers.map(emp => (
              <div key={emp.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{emp.employer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {emp.t4_received ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> T4 received
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Awaiting T4
                      </span>
                    )}
                    <button onClick={() => startEdit(emp)} className="p-1.5 text-gray-400 hover:text-teal-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-gray-500 dark:text-gray-400">Box 14 — Income</span><p className="font-semibold text-gray-900 dark:text-white mt-0.5">{formatMoney(emp.box_14_employment_income)}</p></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Box 22 — Tax</span><p className="font-semibold text-emerald-600 mt-0.5">{formatMoney(emp.box_22_income_tax_deducted)}</p></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Box 16 — CPP</span><p className="font-semibold text-gray-900 dark:text-white mt-0.5">{formatMoney(emp.box_16_cpp_contributions)}</p></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Box 18 — EI</span><p className="font-semibold text-gray-900 dark:text-white mt-0.5">{formatMoney(emp.box_18_ei_premiums)}</p></div>
                </div>
                {(emp.box_44_union_dues > 0 || emp.box_20_rpp_contributions > 0) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    {emp.box_44_union_dues > 0 && <div><span className="text-gray-500 dark:text-gray-400">Box 44 — Union</span><p className="font-medium text-gray-700 dark:text-gray-300 mt-0.5">{formatMoney(emp.box_44_union_dues)}</p></div>}
                    {emp.box_20_rpp_contributions > 0 && <div><span className="text-gray-500 dark:text-gray-400">Box 20 — RPP</span><p className="font-medium text-gray-700 dark:text-gray-300 mt-0.5">{formatMoney(emp.box_20_rpp_contributions)}</p></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={() => { resetForm(); setShowForm(true); setActiveTab('employers'); }} className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-500 hover:text-teal-600 hover:border-teal-300 transition-colors">
          <Plus className="w-4 h-4" /> Add T4 manually
        </button>
      </div>
    );
  }

  function renderPaystubs() {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">Optional: Log individual paycheques for cash flow tracking. At year-end, cross-check totals against your T4.</p>
        </div>

        {employers.length > 0 && (
          <button onClick={() => { setPaystubForm(f => ({ ...f, employment_income_id: employers[0].id })); setShowPaystubForm(true); }} className="w-full flex items-center justify-center gap-2 p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium text-sm transition-colors">
            <Plus className="w-4 h-4" /> Log Paystub
          </button>
        )}

        {showPaystubForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Log Paystub</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Employer</label>
                <select value={paystubForm.employment_income_id} onChange={e => setPaystubForm(f => ({ ...f, employment_income_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  {employers.map(emp => <option key={emp.id} value={emp.id}>{emp.employer_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pay period end</label>
                <input type="date" value={paystubForm.pay_period_end} onChange={e => setPaystubForm(f => ({ ...f, pay_period_end: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <FormNum label="Gross pay" value={paystubForm.gross_pay} onChange={v => setPaystubForm(f => ({ ...f, gross_pay: v }))} />
              <FormNum label="CPP" value={paystubForm.cpp_withheld} onChange={v => setPaystubForm(f => ({ ...f, cpp_withheld: v }))} />
              <FormNum label="EI" value={paystubForm.ei_withheld} onChange={v => setPaystubForm(f => ({ ...f, ei_withheld: v }))} />
              <FormNum label="Tax" value={paystubForm.tax_withheld} onChange={v => setPaystubForm(f => ({ ...f, tax_withheld: v }))} />
              <FormNum label="Net pay" value={paystubForm.net_pay} onChange={v => setPaystubForm(f => ({ ...f, net_pay: v }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={savePaystub} className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors">Save</button>
              <button onClick={() => setShowPaystubForm(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {paystubs.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {paystubs.map(ps => (
              <div key={ps.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {ps.employment_income?.employer_name || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(ps.pay_period_end + 'T00:00'), 'MMM d, yyyy')} — Gross: {formatMoney(ps.gross_pay)} / Net: {formatMoney(ps.net_pay)}
                  </p>
                </div>
                <button onClick={() => setDeleteTarget({ id: ps.id, name: `Paystub ${format(new Date(ps.pay_period_end + 'T00:00'), 'MMM d')}`, type: 'paystub' })} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        ) : (
          !showPaystubForm && <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">No paystubs logged yet.</p>
        )}
      </div>
    );
  }
}

function FormNum({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input type="number" value={value || ''} onChange={e => onChange(parseFloat(e.target.value) || 0)} min={0} step="0.01" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
    </div>
  );
}
