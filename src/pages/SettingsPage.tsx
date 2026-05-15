import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Profile } from '../lib/types';
import { Save, Settings, DollarSign, Calculator, Home, ShieldCheck } from 'lucide-react';

type Tab = 'business' | 'defaults' | 'tax' | 'home' | 'wcb';

export function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('business');

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
      home_address: profile.home_address,
      business_number: profile.business_number,
      gst_enabled: profile.gst_enabled,
      gst_number: profile.gst_number,
      gst_rate: profile.gst_rate,
      wcb_account_number: profile.wcb_account_number,
      wcb_industry_code: profile.wcb_industry_code,
      wcb_industry_rate: profile.wcb_industry_rate,
      wcb_coverage_effective_date: profile.wcb_coverage_effective_date,
      wcb_coverage_expiry_date: profile.wcb_coverage_expiry_date,
      wcb_insurable_earnings: profile.wcb_insurable_earnings,
      wcb_annual_premium: profile.wcb_annual_premium,
      default_hourly_rate: profile.default_hourly_rate,
      default_tax_reserve_percent: profile.default_tax_reserve_percent,
      home_office_percent: profile.home_office_percent,
      vehicle_business_use_percent: profile.vehicle_business_use_percent,
      phone_business_use_percent: profile.phone_business_use_percent,
      internet_business_use_percent: profile.internet_business_use_percent,
      fiscal_year_start: profile.fiscal_year_start,
      industry_code: profile.industry_code,
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

  const tabs: { key: Tab; label: string; icon: typeof Settings }[] = [
    { key: 'business', label: 'Business Info', icon: Settings },
    { key: 'defaults', label: 'Defaults', icon: DollarSign },
    { key: 'tax', label: 'Tax Settings', icon: Calculator },
    { key: 'home', label: 'Home & Vehicle', icon: Home },
    { key: 'wcb', label: 'WCB', icon: ShieldCheck },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        {saved && <span className="text-sm text-emerald-600 font-medium animate-pulse">Saved!</span>}
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

      <form onSubmit={handleSave} className="space-y-6 max-w-lg">
        {activeTab === 'business' && (
          <>
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Identity</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Legal Name</label>
                <input type="text" value={profile.full_name || ''} onChange={e => update('full_name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
                <input type="text" value={profile.business_name || ''} onChange={e => update('business_name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CRA Business Number</label>
                <input type="text" value={profile.business_number || ''} onChange={e => update('business_number', e.target.value)} placeholder="e.g. 123456789RT0001" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
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

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Payment Instructions</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions (shown on invoices)</label>
                <textarea value={profile.payment_instructions || ''} onChange={e => update('payment_instructions', e.target.value)} rows={3} placeholder="e.g. E-transfer to email@example.com" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
            </section>
          </>
        )}

        {activeTab === 'defaults' && (
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Rates & Defaults</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Hourly Rate ($)</label>
              <input type="number" value={profile.default_hourly_rate || ''} onChange={e => update('default_hourly_rate', parseFloat(e.target.value) || null)} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Reserve % (monthly set-aside estimate)</label>
              <input type="number" value={profile.default_tax_reserve_percent || 25} onChange={e => update('default_tax_reserve_percent', parseFloat(e.target.value) || 25)} min={0} max={100} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Business Use %</label>
              <input type="number" value={profile.phone_business_use_percent ?? 50} onChange={e => update('phone_business_use_percent', parseFloat(e.target.value) || 0)} min={0} max={100} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <p className="text-xs text-gray-400 mt-1">Applied automatically when you log a Phone expense.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Internet Business Use %</label>
              <input type="number" value={profile.internet_business_use_percent ?? 25} onChange={e => update('internet_business_use_percent', parseFloat(e.target.value) || 0)} min={0} max={100} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              <p className="text-xs text-gray-400 mt-1">Applied automatically when you log an Internet expense.</p>
            </div>
          </section>
        )}

        {activeTab === 'tax' && (
          <>
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">GST/HST</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={profile.gst_enabled || false} onChange={e => update('gst_enabled', e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">GST Registered (charge 5% on invoices)</span>
              </label>
              {profile.gst_enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST Number</label>
                    <input type="text" value={profile.gst_number || ''} onChange={e => update('gst_number', e.target.value)} placeholder="e.g. 123456789 RT 0001" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST Rate (%)</label>
                    <input type="number" value={(profile.gst_rate || 0.05) * 100} onChange={e => update('gst_rate', (parseFloat(e.target.value) || 5) / 100)} min={0} max={100} step={0.1} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </>
              )}
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">T2125 / CRA</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fiscal Year Start (MM-DD)</label>
                <input type="text" value={profile.fiscal_year_start || '01-01'} onChange={e => update('fiscal_year_start', e.target.value)} placeholder="01-01" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <p className="text-xs text-gray-400 mt-1">Sole proprietors use calendar year (01-01).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Industry Code (NAICS)</label>
                <input type="text" value={profile.industry_code || '238320'} onChange={e => update('industry_code', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <p className="text-xs text-gray-400 mt-1">Painting & wall covering (238320). Used on T2125.</p>
              </div>
            </section>
          </>
        )}

        {activeTab === 'wcb' && (
          <>
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">WCB Account</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Number</label>
                <input type="text" value={profile.wcb_account_number || ''} onChange={e => update('wcb_account_number', e.target.value)} placeholder="e.g. 11029825" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Industry Classification</label>
                <input type="text" value={profile.wcb_industry_code || ''} onChange={e => update('wcb_industry_code', e.target.value)} placeholder="e.g. Painting services" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Industry Rate (per $100 of insurable earnings)</label>
                <input type="number" value={profile.wcb_industry_rate ?? ''} onChange={e => update('wcb_industry_rate', parseFloat(e.target.value) || null)} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Coverage Period</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Effective Date</label>
                  <input type="date" value={profile.wcb_coverage_effective_date || ''} onChange={e => update('wcb_coverage_effective_date', e.target.value || null)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                  <input type="date" value={profile.wcb_coverage_expiry_date || ''} onChange={e => update('wcb_coverage_expiry_date', e.target.value || null)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Premium & Earnings</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Insurable Earnings (declared)</label>
                <input type="number" value={profile.wcb_insurable_earnings ?? ''} onChange={e => update('wcb_insurable_earnings', parseFloat(e.target.value) || null)} min={0} step={100} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <p className="text-xs text-gray-400 mt-1">Must be less than or equal to actual net business income. WCB caps benefits at the lower.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Annual Premium ($)</label>
                <input type="number" value={profile.wcb_annual_premium ?? ''} onChange={e => update('wcb_annual_premium', parseFloat(e.target.value) || null)} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
            </section>
          </>
        )}

        {activeTab === 'home' && (
          <>
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Home Address</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Home Address</label>
                <input type="text" value={profile.home_address || ''} onChange={e => update('home_address', e.target.value)} placeholder="e.g. 88 Everstone Rise SE, Calgary, AB" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <p className="text-xs text-gray-400 mt-1">Used as start point for mileage calculations.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Home Office %</label>
                <input type="number" value={profile.home_office_percent ?? 0} onChange={e => update('home_office_percent', parseFloat(e.target.value) || 0)} min={0} max={100} step={0.1} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <p className="text-xs text-gray-400 mt-1">% of home used exclusively for business (sq ft of office / total sq ft).</p>
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Vehicle</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle Business Use %</label>
                <input type="number" value={profile.vehicle_business_use_percent ?? 0} onChange={e => update('vehicle_business_use_percent', parseFloat(e.target.value) || 0)} min={0} max={100} step={0.1} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <p className="text-xs text-gray-400 mt-1">Applied to vehicle-related expenses for deduction calculations.</p>
              </div>
            </section>
          </>
        )}

        <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
