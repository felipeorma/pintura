import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Profile } from '../lib/types';
import { Save, Settings } from 'lucide-react';

export function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle();
    if (data) setProfile(data);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('profiles').update({
      full_name: profile.full_name,
      business_name: profile.business_name,
      email: profile.email,
      phone: profile.phone,
      city: profile.city,
      province: profile.province,
      gst_enabled: profile.gst_enabled,
      gst_number: profile.gst_number,
      gst_rate: profile.gst_rate,
      wcb_account_number: profile.wcb_account_number,
      default_hourly_rate: profile.default_hourly_rate,
      default_tax_reserve_percent: profile.default_tax_reserve_percent,
      payment_instructions: profile.payment_instructions,
      updated_at: new Date().toISOString(),
    }).eq('id', user!.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update(field: string, value: any) {
    setProfile(p => ({ ...p, [field]: value }));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-lg">
        {/* Business Info */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Settings className="w-4 h-4" /> Business Info</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Legal Name</label>
            <input type="text" value={profile.full_name || ''} onChange={e => update('full_name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
            <input type="text" value={profile.business_name || ''} onChange={e => update('business_name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" value={profile.email || ''} onChange={e => update('email', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input type="tel" value={profile.phone || ''} onChange={e => update('phone', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
              <input type="text" value={profile.city || ''} onChange={e => update('city', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Province</label>
              <input type="text" value={profile.province || ''} onChange={e => update('province', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
        </section>

        {/* Rates */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Rates & Defaults</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Hourly Rate ($)</label>
            <input type="number" value={profile.default_hourly_rate || ''} onChange={e => update('default_hourly_rate', parseFloat(e.target.value) || null)} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Reserve % (estimate)</label>
            <input type="number" value={profile.default_tax_reserve_percent || 25} onChange={e => update('default_tax_reserve_percent', parseFloat(e.target.value) || 25)} min={0} max={100} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <p className="text-xs text-gray-400 mt-1">Tax reserve is only an estimate.</p>
          </div>
        </section>

        {/* GST */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">GST</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={profile.gst_enabled || false} onChange={e => update('gst_enabled', e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">GST Enabled (charge 5% on invoices)</span>
          </label>
          {profile.gst_enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST Number</label>
                <input type="text" value={profile.gst_number || ''} onChange={e => update('gst_number', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST Rate</label>
                <input type="number" value={(profile.gst_rate || 0.05) * 100} onChange={e => update('gst_rate', (parseFloat(e.target.value) || 5) / 100)} min={0} max={100} step={0.1} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
            </>
          )}
          <p className="text-xs text-gray-400 italic">GST is not income. Keep it separate.</p>
        </section>

        {/* WCB */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">WCB</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WCB Account Number</label>
            <input type="text" value={profile.wcb_account_number || ''} onChange={e => update('wcb_account_number', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        </section>

        {/* Payment Instructions */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Payment Instructions</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions (shown on invoices)</label>
            <textarea value={profile.payment_instructions || ''} onChange={e => update('payment_instructions', e.target.value)} rows={3} placeholder="e.g. E-transfer to email@example.com" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        </section>

        <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
