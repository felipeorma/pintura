import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Home, Save, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface HomeOfficeSettings {
  id: string;
  total_home_area: number | null;
  workspace_area: number | null;
  calculation_method: string;
  business_use_percent: number | null;
  notes: string | null;
}

interface HomeExpense {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  subtotal_before_gst: number;
  gst_paid: number;
  total_paid: number;
  deductible_amount: number;
}

export function HomeOfficePage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<HomeOfficeSettings | null>(null);
  const [expenses, setExpenses] = useState<HomeExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    total_home_area: '',
    workspace_area: '',
    calculation_method: 'square_footage',
    business_use_percent: '',
    notes: '',
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const [settingsRes, expensesRes] = await Promise.all([
      supabase.from('home_office_settings').select('*').eq('user_id', user!.id).maybeSingle(),
      supabase.from('expenses').select('*').eq('user_id', user!.id).eq('home_office_related', true).order('expense_date', { ascending: false }),
    ]);
    if (settingsRes.data) {
      setSettings(settingsRes.data);
      setForm({
        total_home_area: settingsRes.data.total_home_area?.toString() || '',
        workspace_area: settingsRes.data.workspace_area?.toString() || '',
        calculation_method: settingsRes.data.calculation_method || 'square_footage',
        business_use_percent: settingsRes.data.business_use_percent?.toString() || '',
        notes: settingsRes.data.notes || '',
      });
    }
    setExpenses(expensesRes.data || []);
    setLoading(false);
  }

  function calculatePercent(): number | null {
    if (form.calculation_method === 'custom_percentage') {
      return parseFloat(form.business_use_percent) || null;
    }
    const total = parseFloat(form.total_home_area);
    const workspace = parseFloat(form.workspace_area);
    if (total && workspace && total > 0) {
      return (workspace / total) * 100;
    }
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const bup = calculatePercent();

    const record = {
      user_id: user!.id,
      total_home_area: parseFloat(form.total_home_area) || null,
      workspace_area: parseFloat(form.workspace_area) || null,
      calculation_method: form.calculation_method,
      business_use_percent: bup,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (settings) {
      await supabase.from('home_office_settings').update(record).eq('id', settings.id);
    } else {
      await supabase.from('home_office_settings').insert(record);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    loadData();
  }

  const bup = calculatePercent();
  const totalHomeExpenses = expenses.reduce((s, e) => s + e.total_paid, 0);
  const totalDeductible = expenses.reduce((s, e) => s + e.deductible_amount, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Home Office</h1>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Business Use %</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{bup ? `${bup.toFixed(1)}%` : 'Not set'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Home Expenses</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">${totalHomeExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Deductible</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">${totalDeductible.toFixed(2)}</p>
        </div>
      </div>

      {/* Settings form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4 mb-6 max-w-lg">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Home className="w-4 h-4" /> Home Office Setup</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Calculation Method</label>
          <select value={form.calculation_method} onChange={e => setForm(f => ({ ...f, calculation_method: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="square_footage">Square Footage</option>
            <option value="rooms">Rooms</option>
            <option value="custom_percentage">Custom Percentage</option>
          </select>
        </div>

        {form.calculation_method !== 'custom_percentage' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Home Area (sq ft)</label>
              <input type="number" value={form.total_home_area} onChange={e => setForm(f => ({ ...f, total_home_area: e.target.value }))} min={0} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Workspace Area (sq ft)</label>
              <input type="number" value={form.workspace_area} onChange={e => setForm(f => ({ ...f, workspace_area: e.target.value }))} min={0} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
        )}

        {form.calculation_method === 'custom_percentage' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Use %</label>
            <input type="number" value={form.business_use_percent} onChange={e => setForm(f => ({ ...f, business_use_percent: e.target.value }))} min={0} max={100} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        )}

        {bup && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Calculated Business Use: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{bup.toFixed(1)}%</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (explain how % was calculated)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="e.g. I use one room (10x12 = 120 sq ft) out of a total 900 sq ft apartment." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>

        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Warning */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400">Only claim the reasonable business-use portion. Keep records of how you calculated the percentage.</p>
      </div>

      {/* Home office expenses */}
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Home Office Expenses</h2>
      {expenses.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No home office expenses yet. Add expenses with the "Home office" category in the Expenses page.</p>
      ) : (
        <div className="space-y-2">
          {expenses.map(exp => (
            <div key={exp.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{exp.description || exp.category}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(exp.expense_date + 'T00:00'), 'MMM d, yyyy')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">${exp.total_paid.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">Deduct: ${exp.deductible_amount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
