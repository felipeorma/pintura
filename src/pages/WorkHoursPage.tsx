import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import type { WorkHour, Client, JobSite, Profile } from '../lib/types';
import { Plus, X, Clock, Pencil, Trash2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

export function WorkHoursPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WorkHour[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkHour | null>(null);

  const [formData, setFormData] = useState({
    work_date: format(new Date(), 'yyyy-MM-dd'),
    client_id: '',
    job_site_id: '',
    start_time: '07:00',
    end_time: '15:30',
    break_minutes: 30,
    hourly_rate: 0,
    notes: '',
  });

  const [newSiteName, setNewSiteName] = useState('');
  const [showNewSite, setShowNewSite] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user, view]);

  async function loadData() {
    const now = new Date();
    let dateStart: string, dateEnd: string;
    if (view === 'week') {
      dateStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      dateEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else {
      dateStart = format(startOfMonth(now), 'yyyy-MM-dd');
      dateEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    }

    const [hoursRes, clientsRes, sitesRes, profileRes] = await Promise.all([
      supabase.from('work_hours').select('*, clients(name), job_sites(site_name)').eq('user_id', user!.id).gte('work_date', dateStart).lte('work_date', dateEnd).order('work_date', { ascending: false }),
      supabase.from('clients').select('*').eq('user_id', user!.id).eq('active', true).order('name'),
      supabase.from('job_sites').select('*').eq('user_id', user!.id).eq('active', true).order('site_name'),
      supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle(),
    ]);

    setEntries(hoursRes.data || []);
    setClients(clientsRes.data || []);
    setJobSites(sitesRes.data || []);
    if (profileRes.data) {
      setProfile(profileRes.data);
      if (profileRes.data.default_hourly_rate && !formData.hourly_rate) {
        setFormData(f => ({ ...f, hourly_rate: profileRes.data!.default_hourly_rate || 0 }));
      }
    }
    setLoading(false);
  }

  function calculateHours() {
    if (!formData.start_time || !formData.end_time) return 0;
    const [sh, sm] = formData.start_time.split(':').map(Number);
    const [eh, em] = formData.end_time.split(':').map(Number);
    const totalMinutes = (eh * 60 + em) - (sh * 60 + sm) - formData.break_minutes;
    return Math.max(0, totalMinutes / 60);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const totalHours = calculateHours();
    const subtotal = totalHours * formData.hourly_rate;
    const gstAmount = profile?.gst_enabled ? subtotal * (profile.gst_rate || 0.05) : 0;
    const totalAmount = subtotal + gstAmount;

    const record = {
      user_id: user!.id,
      work_date: formData.work_date,
      client_id: formData.client_id || null,
      job_site_id: formData.job_site_id || null,
      start_time: formData.start_time,
      end_time: formData.end_time,
      break_minutes: formData.break_minutes,
      total_hours: totalHours,
      hourly_rate: formData.hourly_rate,
      subtotal,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      notes: formData.notes || null,
    };

    if (editingId) {
      await supabase.from('work_hours').update(record).eq('id', editingId);
    } else {
      await supabase.from('work_hours').insert(record);
    }

    setShowForm(false);
    setEditingId(null);
    resetForm();
    loadData();
  }

  function resetForm() {
    setFormData({
      work_date: format(new Date(), 'yyyy-MM-dd'),
      client_id: '',
      job_site_id: '',
      start_time: '07:00',
      end_time: '15:30',
      break_minutes: 30,
      hourly_rate: profile?.default_hourly_rate || 0,
      notes: '',
    });
  }

  function editEntry(entry: WorkHour) {
    setFormData({
      work_date: entry.work_date,
      client_id: entry.client_id || '',
      job_site_id: entry.job_site_id || '',
      start_time: entry.start_time || '07:00',
      end_time: entry.end_time || '15:30',
      break_minutes: entry.break_minutes,
      hourly_rate: entry.hourly_rate || 0,
      notes: entry.notes || '',
    });
    setEditingId(entry.id);
    setShowForm(true);
  }

  async function handleDelete(entry: WorkHour) {
    setDeleteTarget(entry);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await supabase.from('work_hours').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    loadData();
  }

  async function addQuickSite() {
    if (!newSiteName.trim()) return;
    const { data } = await supabase.from('job_sites').insert({
      user_id: user!.id,
      site_name: newSiteName.trim(),
      client_id: formData.client_id || null,
    }).select().single();
    if (data) {
      setJobSites(s => [...s, data]);
      setFormData(f => ({ ...f, job_site_id: data.id }));
    }
    setNewSiteName('');
    setShowNewSite(false);
  }

  const filtered = filterStatus === 'all' ? entries : entries.filter(e => e.status === filterStatus);
  const totalHoursDisplay = filtered.reduce((s, e) => s + (e.total_hours || 0), 0);
  const totalAmountDisplay = filtered.reduce((s, e) => s + (e.subtotal || 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Work Hours</h1>
        <button onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Hours
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button onClick={() => setView('week')} className={`px-3 py-1.5 text-sm font-medium ${view === 'week' ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400'}`}>Week</button>
          <button onClick={() => setView('month')} className={`px-3 py-1.5 text-sm font-medium ${view === 'month' ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400'}`}>Month</button>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="all">All Status</option>
          <option value="not_invoiced">Not Invoiced</option>
          <option value="invoiced">Invoiced</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-gray-600 dark:text-gray-400"><Clock className="w-3.5 h-3.5 inline mr-1" />{totalHoursDisplay.toFixed(1)} hrs</span>
        <span className="text-gray-600 dark:text-gray-400">${totalAmountDisplay.toFixed(2)} earned</span>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingId ? 'Edit Entry' : 'Add Work Hours'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input type="date" value={formData.work_date} onChange={e => setFormData(f => ({ ...f, work_date: e.target.value }))} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
                <select value={formData.client_id} onChange={e => setFormData(f => ({ ...f, client_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Site</label>
                <select value={formData.job_site_id} onChange={e => setFormData(f => ({ ...f, job_site_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Select job site...</option>
                  {jobSites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
                </select>
                {!showNewSite ? (
                  <button type="button" onClick={() => setShowNewSite(true)} className="mt-1 text-xs text-teal-600 hover:text-teal-700">+ Add new site</button>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <input type="text" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} placeholder="Site name" className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    <button type="button" onClick={addQuickSite} className="px-2 py-1.5 text-xs bg-teal-600 text-white rounded-lg">Add</button>
                    <button type="button" onClick={() => setShowNewSite(false)} className="px-2 py-1.5 text-xs text-gray-500">Cancel</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start</label>
                  <input type="time" value={formData.start_time} onChange={e => setFormData(f => ({ ...f, start_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End</label>
                  <input type="time" value={formData.end_time} onChange={e => setFormData(f => ({ ...f, end_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Break (min)</label>
                  <input type="number" value={formData.break_minutes} onChange={e => setFormData(f => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))} min={0} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rate ($/hr)</label>
                  <input type="number" value={formData.hourly_rate} onChange={e => setFormData(f => ({ ...f, hourly_rate: parseFloat(e.target.value) || 0 }))} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Hours:</span><span className="font-medium">{calculateHours().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal:</span><span className="font-medium">${(calculateHours() * formData.hourly_rate).toFixed(2)}</span>
                </div>
                {profile?.gst_enabled && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>GST (5%):</span><span className="font-medium">${(calculateHours() * formData.hourly_rate * 0.05).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors">
                {editingId ? 'Update' : 'Save Entry'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No work hours recorded</p>
          </div>
        ) : filtered.map(entry => (
          <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{format(new Date(entry.work_date + 'T00:00'), 'EEE, MMM d')}</span>
                  <StatusBadge status={entry.status} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {(entry as any).clients?.name || 'No client'} {(entry as any).job_sites?.site_name ? `• ${(entry as any).job_sites.site_name}` : ''}
                </p>
              </div>
              <div className="text-right mr-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{entry.total_hours?.toFixed(1)}h</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">${entry.subtotal?.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => editEntry(entry)}
                  className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                  title="Edit entry"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(entry)}
                  disabled={entry.status === 'invoiced' || entry.status === 'paid'}
                  className={`p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors ${
                    entry.status === 'invoiced' || entry.status === 'paid' ? 'opacity-30 cursor-not-allowed' : ''
                  }`}
                  title={entry.status === 'invoiced' || entry.status === 'paid' ? 'Cannot delete invoiced entry' : 'Delete entry'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete Work Entry"
          itemName={`${format(new Date(deleteTarget.work_date + 'T00:00'), 'EEE, MMM d')} - ${deleteTarget.total_hours?.toFixed(1)}h`}
          usageInfo={
            deleteTarget.status !== 'not_invoiced'
              ? `This entry has been ${deleteTarget.status}. It cannot be deleted.`
              : undefined
          }
          onDelete={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
