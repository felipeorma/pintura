import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Client } from '../lib/types';
import { Plus, X, Users, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';

interface ClientUsage {
  hours: number;
  sites: number;
  invoices: number;
}

export function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, ClientUsage>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    notes: '',
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    // Load clients + everything that references them, so we know which ones
    // are safe to delete vs. which need to be archived to preserve history.
    const [clientsRes, hoursRes, sitesRes, invoicesRes] = await Promise.all([
      supabase.from('clients').select('*').eq('user_id', user!.id).order('active', { ascending: false }).order('name'),
      supabase.from('work_hours').select('client_id').eq('user_id', user!.id),
      supabase.from('job_sites').select('client_id').eq('user_id', user!.id),
      supabase.from('invoices').select('client_id').eq('user_id', user!.id),
    ]);

    setClients(clientsRes.data || []);

    const usageMap: Record<string, ClientUsage> = {};
    const bump = (id: string | null, field: keyof ClientUsage) => {
      if (!id) return;
      if (!usageMap[id]) usageMap[id] = { hours: 0, sites: 0, invoices: 0 };
      usageMap[id][field] += 1;
    };
    (hoursRes.data || []).forEach(h => bump(h.client_id, 'hours'));
    (sitesRes.data || []).forEach(s => bump(s.client_id, 'sites'));
    (invoicesRes.data || []).forEach(i => bump(i.client_id, 'invoices'));
    setUsage(usageMap);

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const record = {
      user_id: user!.id,
      name: formData.name,
      contact_name: formData.contact_name || null,
      phone: formData.phone || null,
      email: formData.email || null,
      notes: formData.notes || null,
    };
    if (editingId) {
      await supabase.from('clients').update(record).eq('id', editingId);
    } else {
      await supabase.from('clients').insert(record);
    }
    setShowForm(false);
    setEditingId(null);
    resetForm();
    loadData();
  }

  function resetForm() {
    setFormData({ name: '', contact_name: '', phone: '', email: '', notes: '' });
  }

  function editClient(client: Client, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setFormData({
      name: client.name,
      contact_name: client.contact_name || '',
      phone: client.phone || '',
      email: client.email || '',
      notes: client.notes || '',
    });
    setEditingId(client.id);
    setShowForm(true);
  }

  async function toggleActive(client: Client, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from('clients').update({ active: !client.active }).eq('id', client.id);
    loadData();
  }

  function requestDelete(client: Client, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteConfirm(client);
  }

  function totalUsage(clientId: string): number {
    const u = usage[clientId];
    if (!u) return 0;
    return u.hours + u.sites + u.invoices;
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;

    // Safety: never delete a client that has any related records.
    // Doing so would either fail at the DB level (FK constraint) or worse,
    // orphan all the historical data. Force the user toward archiving instead.
    if (totalUsage(deleteConfirm.id) > 0) {
      setDeleteConfirm(null);
      return;
    }

    const { error } = await supabase.from('clients').delete().eq('id', deleteConfirm.id);
    if (error) {
      alert('Error deleting client: ' + error.message);
      setDeleteConfirm(null);
      return;
    }
    setDeleteConfirm(null);
    loadData();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
        <button onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingId ? 'Edit Client' : 'Add Client'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company / Client Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Person</label>
                <input type="text" value={formData.contact_name} onChange={e => setFormData(f => ({ ...f, contact_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors">
                {editingId ? 'Update' : 'Add Client'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (() => {
        const u = usage[deleteConfirm.id];
        const hasUsage = totalUsage(deleteConfirm.id) > 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm shadow-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {hasUsage ? 'Cannot Delete Client' : 'Delete Client?'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span className="font-medium">{deleteConfirm.name}</span>
              </p>
              {hasUsage ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-medium">This client has linked records:</p>
                  <ul className="list-disc list-inside ml-1 space-y-0.5">
                    {u?.hours > 0 && <li>{u.hours} work hour {u.hours === 1 ? 'entry' : 'entries'}</li>}
                    {u?.sites > 0 && <li>{u.sites} job {u.sites === 1 ? 'site' : 'sites'}</li>}
                    {u?.invoices > 0 && <li>{u.invoices} {u.invoices === 1 ? 'invoice' : 'invoices'}</li>}
                  </ul>
                  <p className="pt-1">
                    Permanent deletion would break those records.
                    Use <strong>Deactivate</strong> instead — the client will be hidden from dropdowns but the history stays intact.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  This will permanently delete this client. This cannot be undone.
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                {hasUsage ? (
                  <button
                    onClick={async () => {
                      await supabase.from('clients').update({ active: false }).eq('id', deleteConfirm.id);
                      setDeleteConfirm(null);
                      loadData();
                    }}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Deactivate Instead
                  </button>
                ) : (
                  <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clients list */}
      <div className="space-y-2">
        {clients.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No clients yet</p>
          </div>
        ) : clients.map(client => {
          const hasUsage = totalUsage(client.id) > 0;
          return (
            <div key={client.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="cursor-pointer flex-1 min-w-0" onClick={() => editClient(client)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{client.name}</span>
                    {!client.active && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">Inactive</span>}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {[client.contact_name, client.phone, client.email].filter(Boolean).join(' • ') || 'No contact info'}
                  </p>
                  {hasUsage && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {usage[client.id].hours > 0 && `${usage[client.id].hours} entries`}
                      {usage[client.id].sites > 0 && ` • ${usage[client.id].sites} sites`}
                      {usage[client.id].invoices > 0 && ` • ${usage[client.id].invoices} invoices`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => editClient(client, e)}
                    className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-md transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => toggleActive(client, e)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors"
                    title={client.active ? 'Deactivate' : 'Activate'}
                  >
                    {client.active ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => requestDelete(client, e)}
                    disabled={hasUsage}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                    title={hasUsage ? 'Cannot delete — client has linked records. Deactivate instead.' : 'Delete permanently'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
