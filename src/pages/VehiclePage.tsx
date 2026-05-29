import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Client, JobSite } from '../lib/types';
import { Plus, X, MapPin, Pencil, Trash2 } from 'lucide-react';
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
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [deleteLogConfirm, setDeleteLogConfirm] = useState<MileageLog | null>(null);

  // Date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
  const [roundTrip, setRoundTrip] = useState(true);
  const [kmManualOverride, setKmManualOverride] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const [vRes, lRes, cRes, sRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('user_id', user!.id).order('active', { ascending: false }),
      supabase.from('mileage_logs').select('*, clients(name), job_sites(site_name)').eq('user_id', user!.id).order('log_date', { ascending: false }).limit(200),
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

  function handleJobSiteChange(siteId: string) {
    setLogForm(f => ({ ...f, job_site_id: siteId }));
    if (!kmManualOverride && siteId) {
      const site = jobSites.find(s => s.id === siteId);
      if (site?.distance_from_home_km) {
        const km = roundTrip ? site.distance_from_home_km * 2 : site.distance_from_home_km;
        setLogForm(f => ({ ...f, km_driven: km.toString(), start_location: 'Home', destination: site.site_name }));
      }
    }
  }

  function handleRoundTripToggle(checked: boolean) {
    setRoundTrip(checked);
    if (!kmManualOverride && logForm.job_site_id) {
      const site = jobSites.find(s => s.id === logForm.job_site_id);
      if (site?.distance_from_home_km) {
        const km = checked ? site.distance_from_home_km * 2 : site.distance_from_home_km;
        setLogForm(f => ({ ...f, km_driven: km.toString() }));
      }
    }
  }

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    const record = {
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
    };

    if (editingLogId) {
      await supabase.from('mileage_logs').update(record).eq('id', editingLogId);
    } else {
      await supabase.from('mileage_logs').insert(record);
    }

    closeLogForm();
    loadData();
  }

  function closeLogForm() {
    setShowLogForm(false);
    setEditingLogId(null);
    setLogForm({
      log_date: format(new Date(), 'yyyy-MM-dd'),
      vehicle_id: '', client_id: '', job_site_id: '',
      start_location: '', destination: '', purpose: '',
      km_driven: '', notes: '',
    });
    setKmManualOverride(false);
    setRoundTrip(true);
  }

  function editLog(log: MileageLog) {
    setLogForm({
      log_date: log.log_date,
      vehicle_id: log.vehicle_id || '',
      client_id: log.client_id || '',
      job_site_id: log.job_site_id || '',
      start_location: log.start_location || '',
      destination: log.destination || '',
      purpose: log.purpose || '',
      km_driven: log.km_driven.toString(),
      notes: log.notes || '',
    });
    setEditingLogId(log.id);
    setKmManualOverride(true);
    setShowLogForm(true);
  }

  async function deleteLog(log: MileageLog) {
    await supabase.from('mileage_logs').delete().eq('id', log.id);
    setDeleteLogConfirm(null);
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

  const filteredLogs = logs.filter(l => {
    if (dateFrom && l.log_date < dateFrom) return false;
    if (dateTo && l.log_date > dateTo) return false;
    return true;
  });

  const filteredKm = filteredLogs.reduce((s, l) => s + l.km_driven, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vehicle & Mileage</h1>
        <button
          onClick={() => { setEditingLogId(null); setShowLogForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Log Trip
        </button>
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
          <button
            onClick={() => {
              setVehicleForm({ vehicle_name: '', year: '', make: '', model: '', opening_odometer: '', closing_odometer: '', total_km: '', business_km: '' });
              setEditingVehicleId(null);
              setShowVehicleForm(true);
            }}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
          >
            + Add Vehicle
          </button>
        </div>
        {vehicles.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No vehicles added. Add your work vehicle to track mileage.</p>
        ) : vehicles.map(v => (
          <div
            key={v.id}
            onClick={() => editVehicle(v)}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 mb-2 cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
          >
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

      {/* Trips header + date filter */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Trips {(dateFrom || dateTo) && <span className="text-teal-600 dark:text-teal-400">— {filteredKm.toFixed(0)} km</span>}
        </h2>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Date:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        />
        <span className="text-xs text-gray-400">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="px-2 py-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Mileage logs */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{logs.length === 0 ? 'No trips logged yet' : 'No trips in this date range'}</p>
          </div>
        ) : filteredLogs.map(log => (
          <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {log.start_location || '?'} → {log.destination || '?'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {format(new Date(log.log_date + 'T00:00'), 'MMM d, yyyy')}
                  {log.purpose && ` • ${log.purpose}`}
                  {(log as any).clients?.name && ` • ${(log as any).clients.name}`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{log.km_driven} km</span>
                <button
                  onClick={() => editLog(log)}
                  className="p-1.5 text-gray-400 hover:text-amber-500 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteLogConfirm(log)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Log Confirmation */}
      {deleteLogConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Trip?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {format(new Date(deleteLogConfirm.log_date + 'T00:00'), 'MMM d, yyyy')} — {deleteLogConfirm.start_location || '?'} → {deleteLogConfirm.destination || '?'} ({deleteLogConfirm.km_driven} km)
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteLogConfirm(null)}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteLog(deleteLogConfirm)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Form Modal */}
      {showVehicleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingVehicleId ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => setShowVehicleForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
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
                  <span className="font-medium text-gray-900 dark:text-white">
                    {((parseFloat(vehicleForm.business_km) / parseFloat(vehicleForm.total_km)) * 100).toFixed(1)}%
                  </span>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingLogId ? 'Edit Trip' : 'Log Business Trip'}
              </h2>
              <button onClick={closeLogForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
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
                  <select value={logForm.job_site_id} onChange={e => handleJobSiteChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Select...</option>
                    {jobSites.map(s => <option key={s.id} value={s.id}>{s.site_name}{s.distance_from_home_km ? ` (${s.distance_from_home_km} km)` : ''}</option>)}
                  </select>
                </div>
              </div>

              {logForm.job_site_id && (() => {
                const selectedSite = jobSites.find(s => s.id === logForm.job_site_id);
                return selectedSite?.distance_from_home_km ? (
                  <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-teal-700 dark:text-teal-300">
                        Auto: {selectedSite.distance_from_home_km} km x {roundTrip ? '2 (round trip)' : '1 (one-way)'} = {roundTrip ? (selectedSite.distance_from_home_km * 2).toFixed(1) : selectedSite.distance_from_home_km.toFixed(1)} km
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={roundTrip} onChange={e => handleRoundTripToggle(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                        <span className="text-xs text-teal-700 dark:text-teal-300">Round trip</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">No distance saved for this site. Enter km manually or update the job site.</p>
                );
              })()}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kilometres Driven</label>
                  {logForm.job_site_id && jobSites.find(s => s.id === logForm.job_site_id)?.distance_from_home_km && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={kmManualOverride} onChange={e => setKmManualOverride(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Manual</span>
                    </label>
                  )}
                </div>
                <input
                  type="number"
                  value={logForm.km_driven}
                  onChange={e => { setLogForm(f => ({ ...f, km_driven: e.target.value })); setKmManualOverride(true); }}
                  required
                  min={0}
                  step={0.1}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors">
                {editingLogId ? 'Update Trip' : 'Log Trip'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}