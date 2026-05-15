import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Client } from '../lib/types';
import { Plus, X, Users, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

export function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    notes: '',
  });

  useEffect(() => {
    if (user) loadClients();
  }, [user]);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').eq('user_id', user!.id).order('active', { ascending: false }).order('name');
    setClients(data || []);
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
    setFormData({ name: '', contact_name: '', phone: '', email: '', notes: '' });
    loadClients();
  }

  function editClient(client: Client) {
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

  async function toggleArchive(client: Client) {
    await supabase.from('clients').update({ active: !client.active }).eq('id', client.id);
    loadClients();
  }

  async function handleDelete(client: Client) {
    const { count } = await supabase.from('work_hours').select('id', { count: 'exact', head: true }).eq('client_id', client.id);
    const { count: invCount } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('client_id', client.id);
    const linked = (count || 0) + (invCount || 0);
    if (linked > 0) {
      setDeleteTarget({ ...client, _linkedCount: linked } as any);
    } else {
      setDeleteTarget(client);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await supabase.from('clients').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    loadClients();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
        <button onClick={() => { setFormData({ name: '', contact_name: '', phone: '', email: '', notes: '' }); setEditingId(null); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

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

      <div className="space-y-2">
        {clients.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No clients yet</p>
          </div>
        ) : clients.map(client => (
          <div key={client.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{client.name}</span>
                  {!client.active && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">Archived</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {[client.contact_name, client.phone, client.email].filter(Boolean).join(' • ') || 'No contact info'}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => editClient(client)} className="p-1.5 text-gray-400 hover:text-teal-600" title="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => toggleArchive(client)} className="p-1.5 text-gray-400 hover:text-amber-600" title={client.active ? 'Archive' : 'Restore'}>
                  {client.active ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(client)} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete Client"
          itemName={deleteTarget.name}
          usageInfo={
            (deleteTarget as any)._linkedCount
              ? `This client has ${(deleteTarget as any)._linkedCount} linked records (work hours or invoices). Archive instead.`
              : undefined
          }
          onDelete={confirmDelete}
          onArchive={
            (deleteTarget as any)._linkedCount
              ? () => { toggleArchive(deleteTarget); setDeleteTarget(null); }
              : undefined
          }
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
