import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { JobSite, Client } from '../lib/types';
import { Plus, X, MapPin, Search, Navigation } from 'lucide-react';

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=ca`,
    { headers: { 'User-Agent': 'Pintura/1.0' } }
  );
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function getDrivingDistanceKm(origin: { lat: number; lon: number }, dest: { lat: number; lon: number }): Promise<number | null> {
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=false`
  );
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) return null;
  return Math.round((data.routes[0].distance / 1000) * 10) / 10;
}

export function JobSitesPage() {
  const { user } = useAuth();
  const [sites, setSites] = useState<JobSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [siteStats, setSiteStats] = useState<Record<string, { hours: number; amount: number }>>({});
  const [homeAddress, setHomeAddress] = useState<string | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    site_name: '',
    address: '',
    city: '',
    province: 'AB',
    postal_code: '',
    client_id: '',
    distance_from_home_km: '',
    notes: '',
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const [sitesRes, clientsRes, hoursRes, profileRes] = await Promise.all([
      supabase.from('job_sites').select('*, clients(name)').eq('user_id', user!.id).order('active', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('clients').select('*').eq('user_id', user!.id).eq('active', true).order('name'),
      supabase.from('work_hours').select('job_site_id, total_hours, subtotal').eq('user_id', user!.id),
      supabase.from('profiles').select('home_address').eq('id', user!.id).maybeSingle(),
    ]);

    setSites(sitesRes.data || []);
    setClients(clientsRes.data || []);
    setHomeAddress(profileRes.data?.home_address || null);

    const stats: Record<string, { hours: number; amount: number }> = {};
    (hoursRes.data || []).forEach(h => {
      if (!h.job_site_id) return;
      if (!stats[h.job_site_id]) stats[h.job_site_id] = { hours: 0, amount: 0 };
      stats[h.job_site_id].hours += h.total_hours || 0;
      stats[h.job_site_id].amount += h.subtotal || 0;
    });
    setSiteStats(stats);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const record = {
      user_id: user!.id,
      site_name: formData.site_name,
      address: formData.address || null,
      city: formData.city || null,
      province: formData.province,
      postal_code: formData.postal_code || null,
      client_id: formData.client_id || null,
      distance_from_home_km: parseFloat(formData.distance_from_home_km) || null,
      notes: formData.notes || null,
    };

    if (editingId) {
      await supabase.from('job_sites').update(record).eq('id', editingId);
    } else {
      await supabase.from('job_sites').insert(record);
    }
    setShowForm(false);
    setEditingId(null);
    resetForm();
    loadData();
  }

  function resetForm() {
    setFormData({ site_name: '', address: '', city: '', province: 'AB', postal_code: '', client_id: '', distance_from_home_km: '', notes: '' });
    setDistanceError(null);
  }

  function editSite(site: JobSite) {
    setFormData({
      site_name: site.site_name,
      address: site.address || '',
      city: site.city || '',
      province: site.province,
      postal_code: site.postal_code || '',
      client_id: site.client_id || '',
      distance_from_home_km: site.distance_from_home_km?.toString() || '',
      notes: site.notes || '',
    });
    setEditingId(site.id);
    setDistanceError(null);
    setShowForm(true);
  }

  async function handleCalculateDistance() {
    setDistanceError(null);

    const parts = [formData.address, formData.city, formData.province, formData.postal_code].filter(Boolean);
    const siteAddressStr = parts.join(', ');

    if (!homeAddress) {
      setDistanceError('Set your home address in Settings first.');
      return;
    }
    if (!siteAddressStr) {
      setDistanceError('Enter the site address first.');
      return;
    }

    setCalculatingDistance(true);
    try {
      const [originCoords, destCoords] = await Promise.all([
        geocode(homeAddress),
        geocode(siteAddressStr),
      ]);

      if (!originCoords) {
        setDistanceError('Could not locate home address.');
        return;
      }
      if (!destCoords) {
        setDistanceError('Could not locate site address.');
        return;
      }

      const km = await getDrivingDistanceKm(originCoords, destCoords);
      if (km === null) {
        setDistanceError('Could not calculate route.');
        return;
      }

      setFormData(f => ({ ...f, distance_from_home_km: km.toString() }));
    } catch {
      setDistanceError('Network error. Try again.');
    } finally {
      setCalculatingDistance(false);
    }
  }

  async function toggleArchive(site: JobSite) {
    await supabase.from('job_sites').update({ active: !site.active }).eq('id', site.id);
    loadData();
  }

  const filtered = sites.filter(s =>
    s.site_name.toLowerCase().includes(search.toLowerCase()) ||
    s.address?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase()) ||
    (s as any).clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const siteAddressForCalc = [formData.address, formData.city, formData.province, formData.postal_code].filter(Boolean).join(', ');
  const canCalculate = !!homeAddress && !!siteAddressForCalc;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Job Sites</h1>
        <button onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Site
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites..." className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingId ? 'Edit Site' : 'Add Job Site'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Name</label>
                <input type="text" value={formData.site_name} onChange={e => setFormData(f => ({ ...f, site_name: e.target.value }))} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
                <select value={formData.client_id} onChange={e => setFormData(f => ({ ...f, client_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">No client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                <input type="text" value={formData.address} onChange={e => setFormData(f => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                  <input type="text" value={formData.city} onChange={e => setFormData(f => ({ ...f, city: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Province</label>
                  <input type="text" value={formData.province} onChange={e => setFormData(f => ({ ...f, province: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Postal</label>
                  <input type="text" value={formData.postal_code} onChange={e => setFormData(f => ({ ...f, postal_code: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Distance from Home (km, one-way)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.distance_from_home_km}
                    onChange={e => setFormData(f => ({ ...f, distance_from_home_km: e.target.value }))}
                    min={0}
                    step={0.1}
                    placeholder="e.g. 15.2"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleCalculateDistance}
                    disabled={!canCalculate || calculatingDistance}
                    title={!homeAddress ? 'Set home address in Settings first' : !siteAddressForCalc ? 'Enter site address first' : 'Calculate driving distance'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    {calculatingDistance ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                    {calculatingDistance ? 'Calculating…' : 'Auto'}
                  </button>
                </div>
                {distanceError ? (
                  <p className="text-xs text-red-500 mt-1">{distanceError}</p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {homeAddress
                      ? `From: ${homeAddress}`
                      : 'Set your home address in Settings to enable auto-calculation.'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors">
                {editingId ? 'Update' : 'Add Site'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No job sites yet</p>
          </div>
        ) : filtered.map(site => (
          <div key={site.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 cursor-pointer" onClick={() => editSite(site)}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{site.site_name}</span>
                  {!site.active && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">Archived</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {[site.address, site.city].filter(Boolean).join(', ') || 'No address'}
                  {(site as any).clients?.name && ` • ${(site as any).clients.name}`}
                  {site.distance_from_home_km && ` • ${site.distance_from_home_km} km`}
                </p>
                {siteStats[site.id] && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {siteStats[site.id].hours.toFixed(1)}h total • ${siteStats[site.id].amount.toFixed(0)} earned
                  </p>
                )}
              </div>
              <button onClick={() => toggleArchive(site)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {site.active ? 'Archive' : 'Restore'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
