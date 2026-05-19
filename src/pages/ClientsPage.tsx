import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Client } from '../lib/types';
import { Plus, X, Users, Pencil, Archive, ArchiveRestore, Trash2, AlertCircle } from 'lucide-react';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

export function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const emptyForm = {
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: 'AB',
    postal_code: '',
    notes: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (user) loadClients();
  }, [user]);

  async function loadClients() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user!.id)
      .order('active', { ascending: false })
      .order('name');

    if (error) {
      setErrorMessage(error.message);
      setClients([]);
    } else {
      setClients(data || []);
    }

    setLoading(false);
  }

  function formatCanadianPhone(value: string) {
    const cleaned = value.trim();

    if (!cleaned) return '';

    const digits = cleaned.replace(/\D/g, '');

    let phoneDigits = digits;

    if (digits.length === 11 && digits.startsWith('1')) {
      phoneDigits = digits.slice(1);
    }

    if (phoneDigits.length !== 10) {
      return cleaned;
    }

    const area = phoneDigits.slice(0, 3);
    const prefix = phoneDigits.slice(3, 6);
    const line = phoneDigits.slice(6, 10);

    return `+1 (${area}) ${prefix}-${line}`;
  }

  function formatPostalCode(value: string) {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!cleaned) return '';

    if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }

    return value.trim().toUpperCase();
  }

  function formatClientAddress(client: Client) {
    const cityProvince = [client.city, client.province].filter(Boolean).join(', ');
    const cityLine = [cityProvince, client.postal_code].filter(Boolean).join(' ');

    return [client.address, cityLine].filter(Boolean).join(' • ');
  }

  function openCreateForm() {
    setFormData({ ...emptyForm });
    setEditingId(null);
    setErrorMessage('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ ...emptyForm });
    setErrorMessage('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user || saving) return;

    setSaving(true);
    setErrorMessage('');

    const formattedPhone = formData.phone ? formatCanadianPhone(formData.phone) : '';
    const formattedPostalCode = formData.postal_code ? formatPostalCode(formData.postal_code) : '';

    const billingAddressText = [
      formData.address.trim(),
      [formData.city.trim(), formData.province.trim().toUpperCase()].filter(Boolean).join(', '),
      formattedPostalCode,
    ].filter(Boolean).join(' ');
    
    const notesWithBilling = [
      formData.notes.trim(),
      billingAddressText ? `Billing Address: ${billingAddressText}` : '',
    ].filter(Boolean).join('\n');
    
    const record = {
      user_id: user.id,
      name: formData.name.trim(),
      contact_name: formData.contact_name.trim() || null,
      phone: formattedPhone || null,
      email: formData.email.trim() || null,
      notes: notesWithBilling || null,
    };

    if (!record.name) {
      setErrorMessage('Client name is required.');
      setSaving(false);
      return;
    }

    const { error } = editingId
      ? await supabase.from('clients').update(record).eq('id', editingId)
      : await supabase.from('clients').insert(record);

    if (error) {
      setErrorMessage(
        `${error.message}. If this mentions address, city, province, or postal_code, the migration has not been applied to the real Supabase database yet.`
      );
      setSaving(false);
      return;
    }

    setShowForm(false);
    setEditingId(null);
    setFormData({ ...emptyForm });
    setSaving(false);
    loadClients();
  }

  function editClient(client: Client) {
    setFormData({
      name: client.name,
      contact_name: client.contact_name || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      city: client.city || '',
      province: client.province || 'AB',
      postal_code: client.postal_code || '',
      notes: client.notes || '',
    });

    setEditingId(client.id);
    setErrorMessage('');
    setShowForm(true);
  }

  async function toggleArchive(client: Client) {
    setErrorMessage('');

    const { error } = await supabase
      .from('clients')
      .update({ active: !client.active })
      .eq('id', client.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadClients();
  }

  async function handleDelete(client: Client) {
    setErrorMessage('');

    const { count } = await supabase
      .from('work_hours')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id);

    const { count: invCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id);

    const linked = (count || 0) + (invCount || 0);

    if (linked > 0) {
      setDeleteTarget({ ...client, _linkedCount: linked } as any);
    } else {
      setDeleteTarget(client);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setErrorMessage('');

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      setErrorMessage(error.message);
      setDeleteTarget(null);
      return;
    }

    setDeleteTarget(null);
    loadClients();
  }

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Clients
        </h1>

        <button
          onClick={openCreateForm}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {errorMessage && !showForm && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Client' : 'Add Client'}
              </h2>

              <button
                onClick={closeForm}
                className="p-1 text-gray-400 hover:text-gray-600"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {errorMessage && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company / Client Name
                </label>

                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact Person
                </label>

                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={e =>
                    setFormData(f => ({ ...f, contact_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>

                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e =>
                      setFormData(f => ({ ...f, phone: e.target.value }))
                    }
                    onBlur={e =>
                      setFormData(f => ({
                        ...f,
                        phone: formatCanadianPhone(e.target.value),
                      }))
                    }
                    placeholder="+1 (403) 923-1034"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>

                  <input
                    type="email"
                    value={formData.email}
                    onChange={e =>
                      setFormData(f => ({ ...f, email: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
                  Billing Address
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address
                    </label>

                    <input
                      type="text"
                      value={formData.address}
                      onChange={e =>
                        setFormData(f => ({ ...f, address: e.target.value }))
                      }
                      placeholder="Street address"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        City
                      </label>

                      <input
                        type="text"
                        value={formData.city}
                        onChange={e =>
                          setFormData(f => ({ ...f, city: e.target.value }))
                        }
                        placeholder="Calgary"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Province
                      </label>

                      <input
                        type="text"
                        value={formData.province}
                        onChange={e =>
                          setFormData(f => ({
                            ...f,
                            province: e.target.value.toUpperCase(),
                          }))
                        }
                        onBlur={e =>
                          setFormData(f => ({
                            ...f,
                            province: e.target.value.trim().toUpperCase(),
                          }))
                        }
                        placeholder="AB"
                        maxLength={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Postal Code
                      </label>

                      <input
                        type="text"
                        value={formData.postal_code}
                        onChange={e =>
                          setFormData(f => ({
                            ...f,
                            postal_code: e.target.value.toUpperCase(),
                          }))
                        }
                        onBlur={e =>
                          setFormData(f => ({
                            ...f,
                            postal_code: formatPostalCode(e.target.value),
                          }))
                        }
                        placeholder="T1S-1A1"
                        maxLength={7}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>

                <textarea
                  value={formData.notes}
                  onChange={e =>
                    setFormData(f => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add Client'}
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
        ) : (
          clients.map(client => {
            const address = formatClientAddress(client);

            return (
              <div
                key={client.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {client.name}
                      </span>

                      {!client.active && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">
                          Archived
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {[client.contact_name, client.phone, client.email]
                        .filter(Boolean)
                        .join(' • ') || 'No contact info'}
                    </p>

                    {address && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {address}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => editClient(client)}
                      className="p-1.5 text-gray-400 hover:text-teal-600"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => toggleArchive(client)}
                      className="p-1.5 text-gray-400 hover:text-amber-600"
                      title={client.active ? 'Archive' : 'Restore'}
                    >
                      {client.active ? (
                        <Archive className="w-4 h-4" />
                      ) : (
                        <ArchiveRestore className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(client)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
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
              ? () => {
                  toggleArchive(deleteTarget);
                  setDeleteTarget(null);
                }
              : undefined
          }
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}