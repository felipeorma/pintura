import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import type { Invoice, Client, WorkHour, Profile, InvoiceItem } from '../lib/types';
import {
  Plus,
  X,
  FileText,
  Download,
  Trash2,
  Pencil,
  Eye,
  Send,
  History,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { generateInvoicePdf } from '../lib/invoicePdf';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

type InvoiceMode = 'hours' | 'service';

interface ServiceItem {
  description: string;
  quantity: number;
  rate: number;
}

interface InvoiceHistoryEntry {
  id: string;
  invoice_id: string | null;
  invoice_number: string;
  action: string;
  note: string | null;
  created_at: string;
}

type BillingInfo = {
  address: string;
  city: string;
  province: string;
  postal_code: string;
};

function parseBillingFromNotes(notes: string | null): BillingInfo {
  const emptyBilling: BillingInfo = {
    address: '',
    city: '',
    province: '',
    postal_code: '',
  };

  if (!notes) return emptyBilling;

  const blockMatch = notes.match(/\[BILLING_ADDRESS\]([\s\S]*?)\[\/BILLING_ADDRESS\]/);

  if (blockMatch?.[1]) {
    const values = blockMatch[1]
      .split('\n')
      .reduce<Record<string, string>>((acc, line) => {
        const [key, ...rest] = line.split('=');
        if (!key) return acc;

        acc[key.trim()] = rest.join('=').trim();
        return acc;
      }, {});

    return {
      address: values.address || '',
      city: values.city || '',
      province: values.province || '',
      postal_code: values.postal_code || '',
    };
  }

  const legacyMatch = notes.match(/^Billing Address:\s*(.*)$/im);

  if (legacyMatch?.[1]) {
    return {
      ...emptyBilling,
      address: legacyMatch[1].trim(),
    };
  }

  return emptyBilling;
}

function getClientBillingInfo(client: Client): BillingInfo {
  const parsed = parseBillingFromNotes(client.notes);

  return {
    address: (client as any).address || parsed.address || '',
    city: (client as any).city || parsed.city || '',
    province: (client as any).province || parsed.province || '',
    postal_code: (client as any).postal_code || parsed.postal_code || '',
  };
}

function formatBillingAddressLines(info: BillingInfo) {
  const cityProvince = [info.city, info.province].filter(Boolean).join(', ');
  const cityLine = [cityProvince, info.postal_code].filter(Boolean).join(' ');

  return [info.address, cityLine].filter(Boolean);
}

function getBusinessAddressLines(profile: Profile | null) {
  if (!profile) return [];

  const cityProvince = [profile.city, profile.province].filter(Boolean).join(', ');

  return [profile.home_address, cityProvince].filter(Boolean);
}

function getGstRate(profile: Profile | null) {
  if (!profile?.gst_enabled) return 0;

  const rawRate = profile.gst_rate || 0.05;

  return rawRate > 1 ? rawRate / 100 : rawRate;
}

function formatCurrency(value: number | null | undefined) {
  return `$${(value || 0).toFixed(2)}`;
}

export function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>('hours');
  const [selectedClient, setSelectedClient] = useState('');
  const [uninvoicedHours, setUninvoicedHours] = useState<WorkHour[]>([]);
  const [selectedHours, setSelectedHours] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<Profile | null>(null);

  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([
    { description: '', quantity: 1, rate: 0 },
  ]);
  const [serviceNotes, setServiceNotes] = useState('');
  const [includeGst, setIncludeGst] = useState(true);

  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editItems, setEditItems] = useState<ServiceItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewItems, setPreviewItems] = useState<InvoiceItem[]>([]);
  const [previewClient, setPreviewClient] = useState<Client | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleteUsage, setDeleteUsage] = useState('');

  const [history, setHistory] = useState<InvoiceHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [invoiceFlags, setInvoiceFlags] = useState<
    Record<string, { downloaded: boolean; sent: boolean }>
  >({});

  const [clearanceWarnings, setClearanceWarnings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const [invRes, clientsRes, profileRes, historyRes, lettersRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, clients(name)')
        .eq('user_id', user!.id)
        .order('invoice_date', { ascending: false }),

      supabase
        .from('clients')
        .select('*')
        .eq('user_id', user!.id)
        .eq('active', true)
        .order('name'),

      supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle(),

      supabase
        .from('invoice_history')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('wcb_clearance_letters')
        .select('counterparty_name, valid_through_date, direction')
        .eq('user_id', user!.id)
        .eq('direction', 'i_issued')
        .eq('status', 'cleared'),
    ]);

    setInvoices(invRes.data || []);
    setClients(clientsRes.data || []);
    setProfile(profileRes.data);
    setHistory(historyRes.data || []);

    const flags: Record<string, { downloaded: boolean; sent: boolean }> = {};

    (historyRes.data || []).forEach((h: InvoiceHistoryEntry) => {
      if (!h.invoice_id) return;

      if (!flags[h.invoice_id]) {
        flags[h.invoice_id] = { downloaded: false, sent: false };
      }

      if (h.action === 'downloaded') flags[h.invoice_id].downloaded = true;
      if (h.action === 'sent') flags[h.invoice_id].sent = true;
    });

    setInvoiceFlags(flags);

    const now = new Date();

    const recentLetters = (lettersRes.data || []).filter(
      l => l.valid_through_date && new Date(l.valid_through_date) > now
    );

    const recentCounterparties = new Set(
      recentLetters.map(l => l.counterparty_name.toLowerCase())
    );

    const warnings: Record<string, boolean> = {};

    (clientsRes.data || []).forEach(c => {
      if (!recentCounterparties.has(c.name.toLowerCase())) {
        warnings[c.id] = true;
      }
    });

    setClearanceWarnings(warnings);
    setLoading(false);
  }

  async function loadUninvoiced(clientId: string) {
    setSelectedClient(clientId);

    if (!clientId) {
      setUninvoicedHours([]);
      return;
    }

    const { data } = await supabase
      .from('work_hours')
      .select('*, job_sites(site_name)')
      .eq('user_id', user!.id)
      .eq('client_id', clientId)
      .eq('status', 'not_invoiced')
      .order('work_date');

    setUninvoicedHours(data || []);
    setSelectedHours(new Set());
  }

  function getNextInvoiceNumber() {
    const invoiceCount = invoices.length + 1;
    return `INV-${format(new Date(), 'yyyyMM')}-${String(invoiceCount).padStart(3, '0')}`;
  }

  async function logHistory(
    invoiceId: string | null,
    invoiceNumber: string,
    action: string,
    note?: string
  ) {
    await supabase.from('invoice_history').insert({
      user_id: user!.id,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      action,
      note: note || null,
    });
  }

  async function createInvoiceFromHours() {
    if (selectedHours.size === 0) return;
  
    const hours = uninvoicedHours.filter(h => selectedHours.has(h.id));
    const subtotal = hours.reduce((s, h) => s + (h.subtotal || 0), 0);
    const gstAmount = includeGst ? subtotal * 0.05 : 0;
    const totalAmount = subtotal + gstAmount;
  
    const { data: invoice } = await supabase
      .from('invoices')
      .insert({
        user_id: user!.id,
        client_id: selectedClient,
        invoice_number: getNextInvoiceNumber(),
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        status: 'draft',
        subtotal,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        balance_due: totalAmount,
      })
      .select()
      .single();
  
    if (invoice) {
      const items = hours.map(h => {
        const siteName = (h as any).job_sites?.site_name || 'Painting services';
        const timeRange =
          h.start_time && h.end_time
            ? ` (${h.start_time.slice(0, 5)} - ${h.end_time.slice(0, 5)})`
            : '';
  
        const itemSubtotal = h.subtotal || 0;
        const itemGst = includeGst ? itemSubtotal * 0.05 : 0;
  
        return {
          user_id: user!.id,
          invoice_id: invoice.id,
          work_hour_id: h.id,
          job_site_id: h.job_site_id,
          description: `${siteName}${timeRange}`,
          work_date: h.work_date,
          hours: h.total_hours,
          rate: h.hourly_rate,
          subtotal: itemSubtotal,
          gst_amount: itemGst,
          total_amount: itemSubtotal + itemGst,
        };
      });
  
      await supabase.from('invoice_items').insert(items);
  
      await supabase
        .from('work_hours')
        .update({ status: 'invoiced' })
        .in('id', Array.from(selectedHours));
    }
  
    closeModal();
    loadData();
  }

  async function createInvoiceFromService() {
    const validItems = serviceItems.filter(i => i.description && i.rate > 0);
  
    if (validItems.length === 0 || !selectedClient) return;
  
    const gstRate = includeGst ? 0.05 : 0;
    const subtotal = validItems.reduce((s, i) => s + i.quantity * i.rate, 0);
    const gstAmount = subtotal * gstRate;
    const totalAmount = subtotal + gstAmount;
  
    const { data: invoice } = await supabase
      .from('invoices')
      .insert({
        user_id: user!.id,
        client_id: selectedClient,
        invoice_number: getNextInvoiceNumber(),
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        status: 'draft',
        subtotal,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        balance_due: totalAmount,
        notes: serviceNotes || null,
      })
      .select()
      .single();
  
    if (invoice) {
      const items = validItems.map(i => {
        const itemSubtotal = i.quantity * i.rate;
        const itemGst = itemSubtotal * gstRate;
  
        return {
          user_id: user!.id,
          invoice_id: invoice.id,
          work_hour_id: null,
          job_site_id: null,
          description: i.description,
          work_date: format(new Date(), 'yyyy-MM-dd'),
          hours: i.quantity,
          rate: i.rate,
          subtotal: itemSubtotal,
          gst_amount: itemGst,
          total_amount: itemSubtotal + itemGst,
        };
      });
  
      await supabase.from('invoice_items').insert(items);
    }
  
    closeModal();
    loadData();
  }

  function closeModal() {
    setShowCreate(false);
    setSelectedClient('');
    setUninvoicedHours([]);
    setSelectedHours(new Set());
    setServiceItems([{ description: '', quantity: 1, rate: 0 }]);
    setServiceNotes('');
    setInvoiceMode('hours');
    setIncludeGst(true);
  }

  async function deleteInvoice(inv: Invoice) {
    const statusLabel = inv.status === 'sent' || inv.status === 'paid' ? 'Sent' : 'Not sent';
    const wasDownloaded = invoiceFlags[inv.id]?.downloaded;
    const note = `Status at deletion: ${statusLabel}${wasDownloaded ? ', Downloaded' : ''}`;

    await logHistory(null, inv.invoice_number, 'deleted', note);

    const { data: items } = await supabase
      .from('invoice_items')
      .select('work_hour_id')
      .eq('invoice_id', inv.id);

    const workHourIds = (items || []).map(i => i.work_hour_id).filter(Boolean);

    if (workHourIds.length > 0) {
      await supabase
        .from('work_hours')
        .update({ status: 'not_invoiced' })
        .in('id', workHourIds);
    }

    await supabase.from('invoice_items').delete().eq('invoice_id', inv.id);
    await supabase.from('invoices').delete().eq('id', inv.id);

    setDeleteConfirm(null);
    loadData();
  }

  async function handleDeleteInvoice(invoice: Invoice) {
    const { count } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', invoice.id);

    if ((count || 0) > 0) {
      setDeleteUsage(`Cannot delete — ${count} payment(s) linked. Cancel the invoice instead.`);
    } else {
      setDeleteUsage('');
    }

    setDeleteTarget(invoice);
  }

  async function confirmDeleteInvoice() {
    if (!deleteTarget) return;

    await supabase
      .from('invoice_items')
      .select('work_hour_id')
      .eq('invoice_id', deleteTarget.id)
      .then(async ({ data }) => {
        const workHourIds = (data || []).map(i => i.work_hour_id).filter(Boolean);

        if (workHourIds.length > 0) {
          await supabase
            .from('work_hours')
            .update({ status: 'not_invoiced' })
            .in('id', workHourIds);
        }
      });

    await supabase.from('invoice_items').delete().eq('invoice_id', deleteTarget.id);
    await supabase.from('invoices').delete().eq('id', deleteTarget.id);

    setDeleteTarget(null);
    loadData();
  }

  async function startEdit(inv: Invoice) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', inv.id);

    setEditingInvoice(inv);
    setEditDate(inv.invoice_date);
    setEditDueDate(inv.due_date || '');
    setEditNotes(inv.notes || '');

    setEditItems(
      (items || []).map(item => ({
        description: item.description || '',
        quantity: item.hours || 1,
        rate: item.rate || 0,
      }))
    );
  }

  async function saveEdit() {
    if (!editingInvoice) return;

    const validItems = editItems.filter(i => i.description && i.rate > 0);

    if (validItems.length === 0) return;

    const gstRate = getGstRate(profile);
    const subtotal = validItems.reduce((s, i) => s + i.quantity * i.rate, 0);
    const gstAmount = subtotal * gstRate;
    const totalAmount = subtotal + gstAmount;

    await supabase
      .from('invoices')
      .update({
        invoice_date: editDate,
        due_date: editDueDate || null,
        subtotal,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        balance_due: totalAmount - (editingInvoice.amount_paid || 0),
        notes: editNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingInvoice.id);

    await supabase.from('invoice_items').delete().eq('invoice_id', editingInvoice.id);

    const newItems = validItems.map(i => ({
      user_id: user!.id,
      invoice_id: editingInvoice.id,
      work_hour_id: null,
      job_site_id: null,
      description: i.description,
      work_date: editDate,
      hours: i.quantity,
      rate: i.rate,
      subtotal: i.quantity * i.rate,
      gst_amount: i.quantity * i.rate * gstRate,
      total_amount: i.quantity * i.rate * (1 + gstRate),
    }));

    await supabase.from('invoice_items').insert(newItems);

    await logHistory(editingInvoice.id, editingInvoice.invoice_number, 'edited');
    setEditingInvoice(null);
    loadData();
  }

  async function openPreview(inv: Invoice) {
    const [itemsRes, clientRes] = await Promise.all([
      supabase.from('invoice_items').select('*').eq('invoice_id', inv.id),
      supabase.from('clients').select('*').eq('id', inv.client_id!).maybeSingle(),
    ]);

    setPreviewInvoice(inv);
    setPreviewItems(itemsRes.data || []);
    setPreviewClient(clientRes.data);
  }

  async function confirmSend() {
    if (!previewInvoice) return;

    await supabase
      .from('invoices')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', previewInvoice.id);

    await logHistory(previewInvoice.id, previewInvoice.invoice_number, 'sent');

    setPreviewInvoice(null);
    loadData();
  }

  async function updateStatus(id: string, status: string) {
    await supabase
      .from('invoices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (status === 'paid') {
      const { data: items } = await supabase
        .from('invoice_items')
        .select('work_hour_id')
        .eq('invoice_id', id);

      const workHourIds = (items || []).map(i => i.work_hour_id).filter(Boolean);

      if (workHourIds.length > 0) {
        await supabase.from('work_hours').update({ status: 'paid' }).in('id', workHourIds);
      }

      const invoice = invoices.find(i => i.id === id);

      if (invoice) {
        await supabase
          .from('invoices')
          .update({ amount_paid: invoice.total_amount, balance_due: 0 })
          .eq('id', id);
      }
    }

    loadData();
  }

  function toggleHour(id: string) {
    const next = new Set(selectedHours);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    setSelectedHours(next);
  }

  function addServiceItem() {
    setServiceItems([...serviceItems, { description: '', quantity: 1, rate: 0 }]);
  }

  function updateServiceItem(index: number, field: keyof ServiceItem, value: string | number) {
    const updated = [...serviceItems];
    updated[index] = { ...updated[index], [field]: value };
    setServiceItems(updated);
  }

  function removeServiceItem(index: number) {
    if (serviceItems.length <= 1) return;

    setServiceItems(serviceItems.filter((_, i) => i !== index));
  }

  async function downloadPdf(inv: Invoice) {
    const [itemsRes, clientRes] = await Promise.all([
      supabase.from('invoice_items').select('*').eq('invoice_id', inv.id),
      supabase.from('clients').select('*').eq('id', inv.client_id!).maybeSingle(),
    ]);

    if (!profile || !clientRes.data) return;

    const billingInfo = getClientBillingInfo(clientRes.data);

    const clientForPdf = {
      ...clientRes.data,
      address: billingInfo.address,
      city: billingInfo.city,
      province: billingInfo.province,
      postal_code: billingInfo.postal_code,
    } as any;

    generateInvoicePdf(inv, itemsRes.data || [], profile, clientForPdf);

    await logHistory(inv.id, inv.invoice_number, 'downloaded');
    loadData();
  }

  const filtered =
    filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus);

  const serviceSubtotal = serviceItems.reduce((s, i) => s + i.quantity * i.rate, 0);
  const serviceGst = serviceSubtotal * getGstRate(profile);

  const editSubtotal = editItems.reduce((s, i) => s + i.quantity * i.rate, 0);
  const editGst = editSubtotal * getGstRate(profile);

  const previewClientBilling = previewClient ? getClientBillingInfo(previewClient) : null;
  const previewClientAddressLines = previewClientBilling
    ? formatBillingAddressLines(previewClientBilling)
    : [];
  const businessAddressLines = getBusinessAddressLines(profile);

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
          Invoices
        </h1>

        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <History className="w-4 h-4" />
            History
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap ${
              filterStatus === s
                ? 'bg-teal-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create Invoice
              </h2>

              <button
                onClick={closeModal}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                <button
                  onClick={() => setInvoiceMode('hours')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    invoiceMode === 'hours'
                      ? 'bg-teal-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  From Hours
                </button>

                <button
                  onClick={() => setInvoiceMode('service')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    invoiceMode === 'service'
                      ? 'bg-teal-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Service / Custom
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Client
                </label>

                <select
                  value={selectedClient}
                  onChange={e => {
                    setSelectedClient(e.target.value);
                    if (invoiceMode === 'hours') loadUninvoiced(e.target.value);
                  }}
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

              {invoiceMode === 'hours' && (
                <>
                  {uninvoicedHours.length > 0 && (
                    <>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Select hours to include:
                      </p>

                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {uninvoicedHours.map(h => (
                          <label
                            key={h.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedHours.has(h.id)}
                              onChange={() => toggleHour(h.id)}
                              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            />

                            <div className="flex-1">
                              <span className="text-sm text-gray-900 dark:text-white">
                                {format(new Date(h.work_date + 'T00:00'), 'MMM d')} -{' '}
                                {h.total_hours?.toFixed(1)}h
                              </span>

                              {h.start_time && h.end_time && (
                                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                                  ({h.start_time.slice(0, 5)} - {h.end_time.slice(0, 5)})
                                </span>
                              )}

                              <br />

                              <span className="text-xs text-gray-500">
                                {(h as any).job_sites?.site_name}
                              </span>
                            </div>

                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {formatCurrency(h.subtotal)}
                            </span>
                          </label>
                        ))}
                      </div>

                      {selectedHours.size > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Subtotal:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatCurrency(
                                uninvoicedHours
                                  .filter(h => selectedHours.has(h.id))
                                  .reduce((s, h) => s + (h.subtotal || 0), 0)
                              )}
                            </span>
                          </div>

                          {profile?.gst_enabled && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                GST ({(getGstRate(profile) * 100).toFixed(0)}%):
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {formatCurrency(
                                  uninvoicedHours
                                    .filter(h => selectedHours.has(h.id))
                                    .reduce((s, h) => s + (h.gst_amount || 0), 0)
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={createInvoiceFromHours}
                        disabled={selectedHours.size === 0}
                        className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        Create Invoice ({selectedHours.size} entries)
                      </button>
                    </>
                  )}

                  {selectedClient && uninvoicedHours.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                      No uninvoiced hours for this client
                    </p>
                  )}
                </>
              )}

              {invoiceMode === 'service' && selectedClient && (
                <>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Line Items
                    </p>

                    {serviceItems.map((item, i) => (
                      <div
                        key={i}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Item {i + 1}
                          </span>

                          {serviceItems.length > 1 && (
                            <button
                              onClick={() => removeServiceItem(i)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateServiceItem(i, 'description', e.target.value)}
                          placeholder="Description (e.g. Interior painting - Living room)"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                              Qty
                            </label>

                            <input
                              type="number"
                              value={item.quantity}
                              onChange={e =>
                                updateServiceItem(i, 'quantity', parseFloat(e.target.value) || 0)
                              }
                              min={0.01}
                              step={0.01}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                              Rate ($)
                            </label>

                            <input
                              type="number"
                              value={item.rate}
                              onChange={e =>
                                updateServiceItem(i, 'rate', parseFloat(e.target.value) || 0)
                              }
                              min={0}
                              step={0.01}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <p className="text-xs text-right text-gray-600 dark:text-gray-400">
                          Line total: {formatCurrency(item.quantity * item.rate)}
                        </p>
                      </div>
                    ))}

                    <button
                      onClick={addServiceItem}
                      className="w-full py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      + Add another item
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes (optional)
                    </label>

                    <textarea
                      value={serviceNotes}
                      onChange={e => setServiceNotes(e.target.value)}
                      rows={2}
                      placeholder="Additional notes for this invoice..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {serviceSubtotal > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Subtotal:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(serviceSubtotal)}
                        </span>
                      </div>

                      {profile?.gst_enabled && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            GST ({(getGstRate(profile) * 100).toFixed(0)}%):
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(serviceGst)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200 dark:border-gray-600">
                        <span className="text-gray-900 dark:text-white">
                          Total:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {formatCurrency(serviceSubtotal + serviceGst)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={createInvoiceFromService}
                    disabled={serviceItems.filter(i => i.description && i.rate > 0).length === 0}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Create Invoice
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit {editingInvoice.invoice_number}
              </h2>

              <button
                onClick={() => setEditingInvoice(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Invoice Date
                  </label>

                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date
                  </label>

                  <input
                    type="date"
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Line Items
                </p>

                {editItems.map((item, i) => (
                  <div
                    key={i}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Item {i + 1}
                      </span>

                      {editItems.length > 1 && (
                        <button
                          onClick={() => setEditItems(editItems.filter((_, idx) => idx !== i))}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={item.description}
                      onChange={e => {
                        const u = [...editItems];
                        u[i] = { ...u[i], description: e.target.value };
                        setEditItems(u);
                      }}
                      placeholder="Description"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">
                          Qty
                        </label>

                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => {
                            const u = [...editItems];
                            u[i] = { ...u[i], quantity: parseFloat(e.target.value) || 0 };
                            setEditItems(u);
                          }}
                          min={0.01}
                          step={0.01}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">
                          Rate ($)
                        </label>

                        <input
                          type="number"
                          value={item.rate}
                          onChange={e => {
                            const u = [...editItems];
                            u[i] = { ...u[i], rate: parseFloat(e.target.value) || 0 };
                            setEditItems(u);
                          }}
                          min={0}
                          step={0.01}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-right text-gray-600 dark:text-gray-400">
                      Line total: {formatCurrency(item.quantity * item.rate)}
                    </p>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setEditItems([...editItems, { description: '', quantity: 1, rate: 0 }])
                  }
                  className="w-full py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  + Add another item
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>

                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {editSubtotal > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Subtotal:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(editSubtotal)}
                    </span>
                  </div>

                  {profile?.gst_enabled && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        GST ({(getGstRate(profile) * 100).toFixed(0)}%):
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(editGst)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200 dark:border-gray-600">
                    <span className="text-gray-900 dark:text-white">
                      Total:
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(editSubtotal + editGst)}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={saveEdit}
                disabled={editItems.filter(i => i.description && i.rate > 0).length === 0}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {previewInvoice && previewClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-teal-900 p-6 text-white">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-200">
                    Invoice Preview
                  </p>

                  <h2 className="mt-2 text-3xl font-bold tracking-tight">
                    {previewInvoice.invoice_number}
                  </h2>

                  <p className="mt-2 text-sm text-gray-300">
                    Issued {format(new Date(previewInvoice.invoice_date + 'T00:00'), 'MMMM d, yyyy')}
                  </p>

                  {previewInvoice.due_date && (
                    <p className="text-sm text-gray-300">
                      Due {format(new Date(previewInvoice.due_date + 'T00:00'), 'MMMM d, yyyy')}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-teal-200">
                    Total
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {formatCurrency(previewInvoice.total_amount)}
                  </p>

                  <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20">
                    {previewInvoice.status.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">
                    From
                  </p>

                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    {profile?.business_name || profile?.full_name || 'Business'}
                  </p>

                  {profile?.full_name && profile?.business_name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {profile.full_name}
                    </p>
                  )}

                  {businessAddressLines.map((line, i) => (
                    <p key={i} className="text-sm text-gray-500 dark:text-gray-400">
                      {line}
                    </p>
                  ))}

                  {profile?.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {profile.email}
                    </p>
                  )}

                  {profile?.phone && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {profile.phone}
                    </p>
                  )}

                  {profile?.gst_number && (
                    <div className="mt-3 inline-flex rounded-full bg-teal-50 dark:bg-teal-900/20 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-800">
                      GST: {profile.gst_number}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">
                    Bill To
                  </p>

                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    {previewClient.name}
                  </p>

                  {previewClientAddressLines.map((line, i) => (
                    <p key={i} className="text-sm text-gray-500 dark:text-gray-400">
                      {line}
                    </p>
                  ))}

                  {previewClient.contact_name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Contact: {previewClient.contact_name}
                    </p>
                  )}

                  {previewClient.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {previewClient.email}
                    </p>
                  )}

                  {previewClient.phone && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {previewClient.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800">
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Description
                      </th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Qty/Hrs
                      </th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Rate
                      </th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white dark:bg-gray-900">
                    {previewItems.map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {item.work_date
                            ? format(new Date(item.work_date + 'T00:00'), 'MMM d, yyyy')
                            : '-'}
                        </td>

                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                          {item.description || 'Service'}
                        </td>

                        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                          {item.hours?.toFixed(2) || '-'}
                        </td>

                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {item.rate ? formatCurrency(item.rate) : '-'}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-full md:w-80 rounded-2xl bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-800 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Subtotal
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(previewInvoice.subtotal)}
                    </span>
                  </div>

                  {previewInvoice.gst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        GST
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(previewInvoice.gst_amount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-bold pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-900 dark:text-white">
                      Total
                    </span>
                    <span className="text-teal-700 dark:text-teal-400">
                      {formatCurrency(previewInvoice.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {previewInvoice.notes && (
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-800 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-2">
                    Notes
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                    {previewInvoice.notes}
                  </p>
                </div>
              )}

              {previewInvoice.status === 'draft' &&
                previewInvoice.client_id &&
                clearanceWarnings[previewInvoice.client_id] && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />

                    <div>
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        No recent WCB clearance letter on file for {previewClient.name}.
                      </p>

                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        Some contractors require this before payment. Get one from myWCB.
                      </p>
                    </div>
                  </div>
                )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>

                {previewInvoice.status === 'draft' && (
                  <button
                    onClick={confirmSend}
                    className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Confirm & Mark Sent
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Invoice?
            </h3>

            <div className="mb-4 space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">{deleteConfirm.invoice_number}</span> -{' '}
                {formatCurrency(deleteConfirm.total_amount)}
              </p>

              <div className="flex items-center gap-2">
                {deleteConfirm.status === 'sent' ||
                deleteConfirm.status === 'paid' ||
                deleteConfirm.status === 'overdue' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    <Send className="w-3 h-3" />
                    Sent to client
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    Not sent
                  </span>
                )}

                {invoiceFlags[deleteConfirm.id]?.downloaded && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                    <Download className="w-3 h-3" />
                    Downloaded
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                This will permanently delete this invoice. Linked work hours will return
                to "not invoiced". A record will be kept in your history.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={() => deleteInvoice(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Invoice History
              </h2>

              <button
                onClick={() => setShowHistory(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                  No history yet
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map(h => (
                    <div
                      key={h.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30"
                    >
                      <div
                        className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${
                          h.action === 'downloaded'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : h.action === 'sent'
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : h.action === 'deleted'
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : 'bg-amber-100 dark:bg-amber-900/30'
                        }`}
                      >
                        {h.action === 'downloaded' && (
                          <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}

                        {h.action === 'sent' && (
                          <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        )}

                        {h.action === 'deleted' && (
                          <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        )}

                        {h.action === 'edited' && (
                          <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {h.invoice_number}
                          </span>

                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              h.action === 'downloaded'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                : h.action === 'sent'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : h.action === 'deleted'
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {h.action}
                          </span>
                        </div>

                        {h.note && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {h.note}
                          </p>
                        )}

                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {format(new Date(h.created_at), 'MMM d, yyyy - h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No invoices yet</p>
          </div>
        ) : (
          filtered.map(inv => {
            const flags = invoiceFlags[inv.id];

            return (
              <div
                key={inv.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {inv.invoice_number}
                      </span>

                      <StatusBadge status={inv.status} />
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {(inv as any).clients?.name} •{' '}
                      {format(new Date(inv.invoice_date + 'T00:00'), 'MMM d, yyyy')}
                    </p>

                    {flags && (flags.downloaded || flags.sent) && (
                      <div className="flex gap-1.5 mt-1">
                        {flags.downloaded && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Downloaded
                          </span>
                        )}

                        {flags.sent && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
                            <CheckCircle className="w-3 h-3" />
                            Sent
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(inv.total_amount)}
                      </p>

                      {inv.balance_due > 0 && inv.status !== 'draft' && (
                        <p className="text-xs text-red-500">
                          Due: {formatCurrency(inv.balance_due)}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteInvoice(inv)}
                      disabled={inv.status === 'paid'}
                      title={inv.status === 'paid' ? 'Cannot delete paid invoice' : 'Delete invoice'}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex gap-2 flex-wrap">
                  <button
                    onClick={() => openPreview(inv)}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>

                  <button
                    onClick={() => downloadPdf(inv)}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </button>

                  <button
                    onClick={() => startEdit(inv)}
                    className="text-xs px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded flex items-center gap-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>

                  <button
                    onClick={() => setDeleteConfirm(inv)}
                    className="text-xs px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded flex items-center gap-1 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>

                  {(inv.status === 'sent' || inv.status === 'overdue') && (
                    <button
                      onClick={() => updateStatus(inv.id, 'paid')}
                      className="text-xs px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded"
                    >
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete Invoice"
          itemName={deleteTarget.invoice_number}
          usageInfo={deleteUsage || undefined}
          onDelete={confirmDeleteInvoice}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}