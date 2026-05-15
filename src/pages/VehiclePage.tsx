import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Client, JobSite } from '../lib/types';
import { Plus, X, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

interface Vehicle {
  id: string;
  vehicle_name: string;
  year: number | null;
  make: string | null;
  model: string | null;
  opening_odometer: number | null;
  closing_odometer: number | null;
  total_km: number | null;
  business_km: number | null;
  business_use_percent: number | null;
  active: boolean;
}

interface MileageLog {
  id: string;
  vehicle_id: string | null;
  log_date: string;
  client_id: string | null;
  job_site_id: string | null;
  start_location: string | null;
  destination: string | null;
  purpose: string | null;
  km_driven: number;
  notes: string | null;
  clients?: { name: string };
  job_sites?: { site_name: string };
}

export function VehiclePage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<MileageLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  const [vehicleForm, setVehicleForm] = useState({
    vehicle_name: '', year: '', make: '', model: '',
    opening_odometer: '', closing_odometer: '',
    total_km: '', business_km: '',
  });

  const [logForm, setLogForm] = useState({
    log_date: format(new Date(), 'yyyy-MM-dd'),
    vehicle_id: '',
    client_id: '',
    job_site_id: '',
    start_location: '',
    destination: '',
    purpose: '',
    km_driven: '',
    notes: '',
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const [vRes, lRes, cRes, sRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('user_id', user!.id).order('active', { ascending: false }),
      supabase.from('mileage_logs').select('*, clients(name), job_sites(site_name)').eq('user_id', user!.id).order('log_date', { ascending: false }).limit(100),
      supabase.from('clients').select('*').eq('user_id', user!.id).eq('active', true).order('name'),
      supabase.from('job_sites').select('*').eq('user_id', user!.id).eq('active', true).order('site_name'),
    ]);
    setVehicles(vRes.data || []);
    setLogs(lRes.data || []);
    setClients(cRes.data || []);
    setJobSites(sRes.data || []);
    setLoading(false);
  }

  async function handleVehicleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const totalKm = parseFloat(vehicleForm.total_km) || null;
    const businessKm = parseFloat(vehicleForm.business_km) || null;
    const bup = totalKm && businessKm ? (businessKm / totalKm) * 100 : null;

    const record = {
      user_id: user!.id,
      vehicle_name: vehicleForm.vehicle_name,
      year: parseInt(vehicleForm.year) || null,
      make: vehicleForm.make || null,
      model: vehicleForm.model || null,
      opening_odometer: parseFloat(vehicleForm.opening_odometer) || null,
      closing_odometer: parseFloat(vehicleForm.closing_odometer) || null,
      total_km: totalKm,
      business_km: businessKm,
      business_use_percent: bup,
    };

    if (editingVehicleId) {
      await supabase.from('vehicles').update(record).eq('id', editingVehicleId);
    } else {
      await supabase.from('vehicles').insert(record);
    }
    setShowVehicleForm(false);
    setEditingVehicleId(null);
    setVehicleForm({ vehicle_name: '', year: '', make: '', model: '', opening_odometer: '', closing_odometer: '', total_km: '', business_km: '' });
    loadData();
  }

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('mileage_logs').insert({
      user_id: user!.id,
      log_date: logForm.log_date,
      vehicle_id: logForm.vehicle_id || null,
      client_id: logForm.client_id || null,
      job_site_id: logForm.job_site_id || null,
      start_location: logForm.start_location || null,
      destination: logForm.destination || null,
      purpose: logForm.purpose || null,
      km_driven: parseFloat(logForm.km_driven) || 0,
      notes: logForm.notes || null,
    });
    setShowLogForm(false);
    setLogForm({ log_date: format(new Date(), 'yyyy-MM-dd'), vehicle_id: '', client_id: '', job_site_id: '', start_location: '', destination: '', purpose: '', km_driven: '', notes: '' });
    loadData();
  }

  function editVehicle(v: Vehicle) {
    setVehicleForm({
      vehicle_name: v.vehicle_name,
      year: v.year?.toString() || '',
      make: v.make || '',
      model: v.model || '',
      opening_odometer: v.opening_odometer?.toString() || '',
      closing_odometer: v.closing_odometer?.toString() || '',
      total_km: v.total_km?.toString() || '',
      business_km: v.business_km?.toString() || '',
    });
    setEditingVehicleId(v.id);
    setShowVehicleForm(true);
  }

  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  const yearStart = format(startOfYear(now), 'yyyy-MM-dd');
  const yearEnd = format(endOfYear(now), 'yyyy-MM-dd');

  const kmThisMonth = logs.filter(l => l.log_date >= monthStart && l.log_date <= monthEnd).reduce((s, l) => s + l.km_driven, 0);
  const kmThisYear = logs.filter(l => l.log_date >= yearStart && l.log_date <= yearEnd).reduce((s, l) => s + l.km_driven, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vehicle & Mileage</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowLogForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Log Trip
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">This Month</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{kmThisMonth.toFixed(0)} km</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">This Year</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{kmThisYear.toFixed(0)} km</p>
        </div>
        {vehicles[0] && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Business Use %</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{vehicles[0].business_use_percent?.toFixed(0) || '—'}%</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Vehicle</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{vehicles[0].vehicle_name}</p>
            </div>
          </>
        )}
      </div>

      {/* Vehicles section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Vehicles</h2>
          <button onClick={() => { setVehicleForm({ vehicle_name: '', year: '', make: '', model: '', opening_odometer: '', closing_odometer: '', total_km: '', business_km: '' }); setEditingVehicleId(null); setShowVehicleForm(true); }} className="text-xs text-teal-600 hover:text-teal-700 font-medium">+ Add Vehicle</button>
        </div>
        {vehicles.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No vehicles added. Add your work vehicle to track mileage.</p>
        ) : vehicles.map(v => (
          <div key={v.id} onClick={() => editVehicle(v)} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 mb-2 cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{v.vehicle_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{[v.year, v.make, v.model].filter(Boolean).join(' ')}</p>
              </div>
              <div className="text-right">
                {v.business_use_percent && <p className="text-sm font-semibold text-gray-900 dark:text-white">{v.business_use_percent.toFixed(0)}% biz</p>}
                {v.business_km && <p className="text-xs text-gray-400">{v.business_km.toFixed(0)} km biz</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mileage logs */}
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent Trips</h2>
      <div className="space-y-2">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No trips logged yet</p>
          </div>
        ) : logs.map(log => (
          <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {log.start_location || '?'} → {log.destination || '?'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {format(new Date(log.log_date + 'T00:00'), 'MMM d')}
                  {log.purpose && ` • ${log.purpose}`}
                  {(log as any).clients?.name && ` • ${(log as any).clients.name}`}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white ml-3">{log.km_driven} km</span>
            </div>
          </div>
        ))}
      </div>

      {/* Vehicle Form Modal */}
      {showVehicleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingVehicleId ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => setShowVehicleForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleVehicleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle Name</label>
                <input type="text" value={vehicleForm.vehicle_name} onChange={e => setVehicleForm(f => ({ ...f, vehicle_name: e.target.value }))} required placeholder="e.g. My Work Truck" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
                  <input type="number" value={vehicleForm.year} onChange={e => setVehicleForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Make</label>
                  <input type="text" value={vehicleForm.make} onChange={e => setVehicleForm(f => ({ ...f, make: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
                  <input type="text" value={vehicleForm.model} onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opening Odometer (Jan 1)</label>
                  <input type="number" value={vehicleForm.opening_odometer} onChange={e => setVehicleForm(f => ({ ...f, opening_odometer: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Closing Odometer (Dec 31)</label>
                  <input type="number" value={vehicleForm.closing_odometer} onChange={e => setVehicleForm(f => ({ ...f, closing_odometer: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total KM (Year)</label>
                  <input type="number" value={vehicleForm.total_km} onChange={e => setVehicleForm(f => ({ ...f, total_km: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business KM (Year)</label>
                  <input type="number" value={vehicleForm.business_km} onChange={e => setVehicleForm(f => ({ ...f, business_km: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              {vehicleForm.total_km && vehicleForm.business_km && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Business-use %: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{((parseFloat(vehicleForm.business_km) / parseFloat(vehicleForm.total_km)) * 100).toFixed(1)}%</span>
                </div>
              )}
              <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors">
                {editingVehicleId ? 'Update Vehicle' : 'Add Vehicle'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Log Trip Modal */}
      {showLogForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Log Business Trip</h2>
              <button onClick={() => setShowLogForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleLogSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input type="date" value={logForm.log_date} onChange={e => setLogForm(f => ({ ...f, log_date: e.target.value }))} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle</label>
                  <select value={logForm.vehicle_id} onChange={e => setLogForm(f => ({ ...f, vehicle_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Select...</option>
                    {vehicles.filter(v => v.active).map(v => <option key={v.id} value={v.id}>{v.vehicle_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
                  <select value={logForm.client_id} onChange={e => setLogForm(f => ({ ...f, client_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Select...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Site</label>
                  <select value={logForm.job_site_id} onChange={e => setLogForm(f => ({ ...f, job_site_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Select...</option>
                    {jobSites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Location</label>
                  <input type="text" value={logForm.start_location} onChange={e => setLogForm(f => ({ ...f, start_location: e.target.value }))} placeholder="e.g. Home" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination</label>
                  <input type="text" value={logForm.destination} onChange={e => setLogForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Job site" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purpose of Trip</label>
                <input type="text" value={logForm.purpose} onChange={e => setLogForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. Travel to paint job" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kilometres Driven (business)</label>
                <input type="number" value={logForm.km_driven} onChange={e => setLogForm(f => ({ ...f, km_driven: e.target.value }))} required min={0} step={0.1} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors">
                Log Trip
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
