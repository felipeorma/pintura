import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import type { WorkHour, Client, JobSite, Profile } from '../lib/types';
import { Plus, X, Clock, Trash2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

type DateView = 'week' | 'month' | 'custom';
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
type WorkHourDisplayStatus = 'not_invoiced' | 'invoiced' | InvoiceStatus;

type WorkHourWithRelations = WorkHour & {
  clients?: { name: string | null } | null;
  job_sites?: { site_name: string | null } | null;
  invoiceStatus?: WorkHourDisplayStatus;
  invoiceNumber?: string | null;
};

interface WorkHourInvoiceLink {
  work_hour_id: string | null;
  invoices:
    | {
        invoice_number: string;
        status: InvoiceStatus;
      }
    | {
        invoice_number: string;
        status: InvoiceStatus;
      }[]
    | null;
}

export function WorkHoursPage() {
  const { user } = useAuth();

  const [entries, setEntries] = useState<WorkHourWithRelations[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DateView>('week');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<WorkHourWithRelations | null>(null);

  const [dateFrom, setDateFrom] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );
  const [dateTo, setDateTo] = useState(
    format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );

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
  }, [user, view, dateFrom, dateTo]);

  function getGstRate() {
    if (!profile?.gst_enabled) return 0;

    const rawRate = profile.gst_rate || 5;
    return rawRate > 1 ? rawRate / 100 : rawRate;
  }

  function getInvoiceFromLink(link: WorkHourInvoiceLink) {
    return Array.isArray(link.invoices) ? link.invoices[0] : link.invoices;
  }

  function getDateRange() {
    const now = new Date();

    if (view === 'week') {
      return {
        dateStart: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        dateEnd: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    }

    if (view === 'month') {
      return {
        dateStart: format(startOfMonth(now), 'yyyy-MM-dd'),
        dateEnd: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    }

    return {
      dateStart: dateFrom,
      dateEnd: dateTo,
    };
  }

  async function loadData() {
    setLoading(true);

    const { dateStart, dateEnd } = getDateRange();

    const [hoursRes, clientsRes, sitesRes, profileRes] = await Promise.all([
      supabase
        .from('work_hours')
        .select('*, clients(name), job_sites(site_name)')
        .eq('user_id', user!.id)
        .gte('work_date', dateStart)
        .lte('work_date', dateEnd)
        .order('work_date', { ascending: false }),

      supabase
        .from('clients')
        .select('*')
        .eq('user_id', user!.id)
        .eq('active', true)
        .order('name'),

      supabase
        .from('job_sites')
        .select('*')
        .eq('user_id', user!.id)
        .eq('active', true)
        .order('site_name'),

      supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle(),
    ]);

    const hours = (hoursRes.data || []) as WorkHourWithRelations[];
    const hourIds = hours.map(h => h.id);

    let invoiceByHourId: Record<
      string,
      { status: WorkHourDisplayStatus; invoiceNumber: string | null }
    > = {};

    if (hourIds.length > 0) {
      const { data: invoiceLinks } = await supabase
        .from('invoice_items')
        .select('work_hour_id, invoices(invoice_number, status)')
        .in('work_hour_id', hourIds);

      invoiceByHourId = ((invoiceLinks || []) as WorkHourInvoiceLink[]).reduce(
        (acc, link) => {
          if (!link.work_hour_id) return acc;

          const invoice = getInvoiceFromLink(link);
          if (!invoice) return acc;

          acc[link.work_hour_id] = {
            status: invoice.status,
            invoiceNumber: invoice.invoice_number,
          };

          return acc;
        },
        {} as Record<string, { status: WorkHourDisplayStatus; invoiceNumber: string | null }>
      );
    }

    const hoursWithInvoiceStatus = hours.map(hour => {
      const invoiceInfo = invoiceByHourId[hour.id];

      return {
        ...hour,
        invoiceStatus: invoiceInfo?.status || hour.status || 'not_invoiced',
        invoiceNumber: invoiceInfo?.invoiceNumber || null,
      };
    });

    setEntries(hoursWithInvoiceStatus);
    setClients(clientsRes.data || []);
    setJobSites(sitesRes.data || []);

    if (profileRes.data) {
      setProfile(profileRes.data);

      if (profileRes.data.default_hourly_rate && !formData.hourly_rate) {
        setFormData(f => ({
          ...f,
          hourly_rate: profileRes.data!.default_hourly_rate || 0,
        }));
      }
    }

    setLoading(false);
  }

  function calculateHours() {
    if (!formData.start_time || !formData.end_time) return 0;

    const [sh, sm] = formData.start_time.split(':').map(Number);
    const [eh, em] = formData.end_time.split(':').map(Number);

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    const totalMinutes = endMinutes - startMinutes - formData.break_minutes;

    return Math.max(0, totalMinutes / 60);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const totalHours = calculateHours();
    const subtotal = totalHours * formData.hourly_rate;
    const gstAmount = subtotal * getGstRate();
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

  async function deleteEntry(entry: WorkHourWithRelations) {
    await supabase.from('work_hours').delete().eq('id', entry.id);
    setDeleteConfirm(null);
    setShowForm(false);
    setEditingId(null);
    loadData();
  }

  function editEntry(entry: WorkHour) {
    setFormData({
      work_date: entry.work_date,
      client_id: entry.client_id || '',
      job_site_id: entry.job_site_id || '',
      start_time: entry.start_time || '07:00',
      end_time: entry.end_time || '15:30',
      break_minutes: entry.break_minutes || 0,
      hourly_rate: entry.hourly_rate || 0,
      notes: entry.notes || '',
    });

    setEditingId(entry.id);
    setShowForm(true);
  }

  async function addQuickSite() {
    if (!newSiteName.trim()) return;

    const { data } = await supabase
      .from('job_sites')
      .insert({
        user_id: user!.id,
        site_name: newSiteName.trim(),
        client_id: formData.client_id || null,
      })
      .select()
      .single();

    if (data) {
      setJobSites(s => [...s, data]);
      setFormData(f => ({ ...f, job_site_id: data.id }));
    }

    setNewSiteName('');
    setShowNewSite(false);
  }

  const breakIncluded = formData.break_minutes > 0;

  const filtered =
    filterStatus === 'all'
      ? entries
      : entries.filter(e => e.invoiceStatus === filterStatus);

  const totalHoursDisplay = filtered.reduce((s, e) => s + (e.total_hours || 0), 0);
  const totalAmountDisplay = filtered.reduce((s, e) => s + (e.subtotal || 0), 0);

  const formSubtotal = calculateHours() * formData.hourly_rate;
  const formGstAmount = formSubtotal * getGstRate();
  const formTotal = formSubtotal + formGstAmount;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Work Hours</h1>

        <button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Hours
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1.5 text-sm font-medium ${
              view === 'week' ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Week
          </button>

          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 text-sm font-medium ${
              view === 'month' ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Month
          </button>

          <button
            onClick={() => setView('custom')}
            className={`px-3 py-1.5 text-sm font-medium ${
              view === 'custom' ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Custom
          </button>
        </div>

        {view === 'custom' && (
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            />

            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            />
          </div>
        )}

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <option value="all">All Status</option>
          <option value="not_invoiced">Not Invoiced</option>
          <option value="draft">Draft Invoice</option>
          <option value="sent">Sent Invoice</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="invoiced">Invoiced</option>
        </select>
      </div>

      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5 inline mr-1" />
          {totalHoursDisplay.toFixed(1)} hrs
        </span>

        <span className="text-gray-600 dark:text-gray-400">
          ${totalAmountDisplay.toFixed(2)} earned
        </span>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Entry' : 'Add Work Hours'}
              </h2>

              <button
                onClick={() => setShowForm(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>

                <input
                  type="date"
                  value={formData.work_date}
                  onChange={e => setFormData(f => ({ ...f, work_date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Client
                </label>

                <select
                  value={formData.client_id}
                  onChange={e => setFormData(f => ({ ...f, client_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Job Site
                </label>

                <select
                  value={formData.job_site_id}
                  onChange={e => setFormData(f => ({ ...f, job_site_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select job site...</option>
                  {jobSites.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.site_name}
                    </option>
                  ))}
                </select>

                {!showNewSite ? (
                  <button
                    type="button"
                    onClick={() => setShowNewSite(true)}
                    className="mt-1 text-xs text-teal-600 hover:text-teal-700"
                  >
                    + Add new site
                  </button>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newSiteName}
                      onChange={e => setNewSiteName(e.target.value)}
                      placeholder="Site name"
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />

                    <button
                      type="button"
                      onClick={addQuickSite}
                      className="px-2 py-1.5 text-xs bg-teal-600 text-white rounded-lg"
                    >
                      Add
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowNewSite(false)}
                      className="px-2 py-1.5 text-xs text-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start
                  </label>

                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={e => setFormData(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End
                  </label>

                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={e => setFormData(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 px-3 py-2 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Include 30 min break
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    When checked, 30 minutes are deducted from total hours.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={breakIncluded}
                  onChange={e =>
                    setFormData(f => ({
                      ...f,
                      break_minutes: e.target.checked ? 30 : 0,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rate ($/hr)
                </label>

                <input
                  type="number"
                  value={formData.hourly_rate}
                  onChange={e =>
                    setFormData(f => ({
                      ...f,
                      hourly_rate: parseFloat(e.target.value) || 0,
                    }))
                  }
                  min={0}
                  step={0.01}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Break:</span>
                  <span className="font-medium">{formData.break_minutes} min</span>
                </div>

                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Hours:</span>
                  <span className="font-medium">{calculateHours().toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal:</span>
                  <span className="font-medium">${formSubtotal.toFixed(2)}</span>
                </div>

                {profile?.gst_enabled && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>GST ({(getGstRate() * 100).toFixed(0)}%):</span>
                    <span className="font-medium">${formGstAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between font-semibold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-gray-600">
                  <span>Total:</span>
                  <span>${formTotal.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>

                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-3">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const entry = entries.find(e => e.id === editingId);
                      if (entry) setDeleteConfirm(entry);
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors"
                >
                  {editingId ? 'Update' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Entry?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {format(new Date(deleteConfirm.work_date + 'T00:00'), 'EEE, MMM d')} — {deleteConfirm.total_hours?.toFixed(1)}h @ ${deleteConfirm.hourly_rate}/hr
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteEntry(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No work hours recorded</p>
          </div>
        ) : (
          filtered.map(entry => (
            <div
              key={entry.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => editEntry(entry)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {format(new Date(entry.work_date + 'T00:00'), 'EEE, MMM d')}
                    </span>

                    <StatusBadge status={entry.invoiceStatus || entry.status} />

                    {entry.invoiceNumber && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {entry.invoiceNumber}
                      </span>
                    )}

                    {(entry.break_minutes || 0) > 0 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                        Break {entry.break_minutes}m
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {entry.clients?.name || 'No client'}
                    {entry.job_sites?.site_name ? ` • ${entry.job_sites.site_name}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {entry.total_hours?.toFixed(1)}h
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ${entry.subtotal?.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm(entry)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}