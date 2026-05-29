import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Expense, JobSite, Client } from '../lib/types';
import { EXPENSE_CATEGORY_DATA, PAYMENT_METHODS, TAX_CONFIDENCE_OPTIONS } from '../lib/expenseData';
import { Plus, X, Receipt, AlertTriangle, Upload, ExternalLink, FileText, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { getFileUrl } from '../lib/storage';

function ReceiptPreview({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getFileUrl(path, 'receipts').then(setUrl);
  }, [path]);

  if (!url) return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-400">
      <FileText className="w-4 h-4" /> Loading...
    </div>
  );

  const isImage = /\.(jpg|jpeg|png|gif|webp|heic)/i.test(path);

  if (isImage) {
    return (
      <button onClick={() => window.open(url, '_blank')} className="w-full text-left">
        <img
          src={url}
          alt="Receipt"
          className={className || 'w-full rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity'}
        />
      </button>
    );
  }

  return (
    <button
      onClick={() => window.open(url, '_blank')}
      className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-teal-600 dark:text-teal-400 hover:underline w-full"
    >
      <FileText className="w-4 h-4" />
      View Receipt
      <ExternalLink className="w-3 h-3 ml-auto" />
    </button>
  );
}

export function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewExpense, setPreviewExpense] = useState<Expense | null>(null);

  const [formData, setFormData] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    vendor: '',
    category: '',
    subcategory: '',
    description: '',
    job_site_id: '',
    client_id: '',
    subtotal_before_gst: 0,
    gst_paid: 0,
    business_use_percent: 100,
    payment_method: '',
    tax_confidence_status: 'clear',
    notes: '',
    home_office_related: false,
  });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const [expRes, sitesRes, clientsRes] = await Promise.all([
      supabase.from('expenses').select('*, job_sites(site_name)').eq('user_id', user!.id).order('expense_date', { ascending: false }),
      supabase.from('job_sites').select('*').eq('user_id', user!.id).eq('active', true).order('site_name'),
      supabase.from('clients').select('*').eq('user_id', user!.id).eq('active', true).order('name'),
    ]);
    setExpenses(expRes.data || []);
    setJobSites(sitesRes.data || []);
    setClients(clientsRes.data || []);
    setLoading(false);
  }

  const selectedCategoryData = EXPENSE_CATEGORY_DATA.find(c => c.name === formData.category);
  const selectedSubcategoryData = selectedCategoryData?.subcategories.find(s => s.name === formData.subcategory);

  function onCategoryChange(cat: string) {
    setFormData(f => ({
      ...f,
      category: cat,
      subcategory: '',
      home_office_related: cat === 'Home office',
      business_use_percent: cat === 'Phone' ? 50 : cat === 'Internet' ? 25 : cat === 'Meals' ? 50 : 100,
    }));
  }

  function onSubcategoryChange(sub: string) {
    const subData = selectedCategoryData?.subcategories.find(s => s.name === sub);
    setFormData(f => ({
      ...f,
      subcategory: sub,
      business_use_percent: subData?.defaultBusinessUse ?? f.business_use_percent,
      tax_confidence_status: subData?.needsReview ? 'needs_review' : f.tax_confidence_status,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const totalPaid = formData.subtotal_before_gst + formData.gst_paid;
    const bup = formData.business_use_percent / 100;
    const deductibleAmount = formData.subtotal_before_gst * bup;
    const itcClaimAmount = formData.gst_paid * bup;

    let receiptUrl: string | null = null;
    if (receiptFile) {
      setUploading(true);
      const filePath = `${user!.id}/${Date.now()}-${receiptFile.name}`;
      await supabase.storage.from('receipts').upload(filePath, receiptFile);
      receiptUrl = filePath;
      setUploading(false);
    }

    const record: any = {
      user_id: user!.id,
      expense_date: formData.expense_date,
      vendor: formData.vendor || null,
      category: formData.category || null,
      description: formData.subcategory
        ? `${formData.subcategory}${formData.description ? ' - ' + formData.description : ''}`
        : formData.description || null,
      job_site_id: formData.job_site_id || null,
      client_id: formData.client_id || null,
      subtotal_before_gst: formData.subtotal_before_gst,
      gst_paid: formData.gst_paid,
      total_paid: totalPaid,
      business_use_percent: formData.business_use_percent,
      deductible_amount: deductibleAmount,
      itc_claim_amount: itcClaimAmount,
      payment_method: formData.payment_method || null,
      tax_confidence_status: formData.tax_confidence_status,
      home_office_related: formData.home_office_related,
      needs_receipt: true,
      receipt_uploaded: !!receiptFile || !!receiptUrl,
      notes: formData.notes || null,
    };

    if (receiptUrl) record.receipt_url = receiptUrl;

    if (editingId) {
      await supabase.from('expenses').update(record).eq('id', editingId);
    } else {
      await supabase.from('expenses').insert(record);
    }
    setShowForm(false);
    setEditingId(null);
    resetForm();
    loadData();
  }

  function resetForm() {
    setFormData({
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      vendor: '', category: '', subcategory: '', description: '',
      job_site_id: '', client_id: '',
      subtotal_before_gst: 0, gst_paid: 0, business_use_percent: 100,
      payment_method: '', tax_confidence_status: 'clear', notes: '',
      home_office_related: false,
    });
    setReceiptFile(null);
  }

  function editExpense(exp: Expense) {
    setFormData({
      expense_date: exp.expense_date,
      vendor: exp.vendor || '',
      category: exp.category || '',
      subcategory: '',
      description: exp.description || '',
      job_site_id: exp.job_site_id || '',
      client_id: (exp as any).client_id || '',
      subtotal_before_gst: exp.subtotal_before_gst,
      gst_paid: exp.gst_paid,
      business_use_percent: exp.business_use_percent,
      payment_method: (exp as any).payment_method || '',
      tax_confidence_status: (exp as any).tax_confidence_status || 'clear',
      notes: exp.notes || '',
      home_office_related: (exp as any).home_office_related || false,
    });
    setEditingId(exp.id);
    setShowForm(true);
  }

  const filtered = expenses.filter(e => {
    if (filterCategory !== 'all' && e.category !== filterCategory) return false;
    if (dateFrom && e.expense_date < dateFrom) return false;
    if (dateTo && e.expense_date > dateTo) return false;
    return true;
  });

  const totalExpenses = filtered.reduce((s, e) => s + e.total_paid, 0);
  const totalDeductible = filtered.reduce((s, e) => s + e.deductible_amount, 0);

  const taxStatusLabel = (status: string) => {
    if (status === 'needs_review') return { label: 'Needs Review', color: 'text-amber-600 dark:text-amber-400' };
    if (status === 'ask_accountant') return { label: 'Ask Accountant', color: 'text-red-600 dark:text-red-400' };
    return { label: 'Clear', color: 'text-emerald-600 dark:text-emerald-400' };
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total: ${totalExpenses.toFixed(2)} | Deductible: ${totalDeductible.toFixed(2)}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${filterCategory === 'all' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
        >
          All
        </button>
        {EXPENSE_CATEGORY_DATA.map(c => (
          <button
            key={c.name}
            onClick={() => setFilterCategory(c.name)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${filterCategory === c.name ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
          >
            {c.name}
          </button>
        ))}
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

      {/* Preview Modal */}
      {previewExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Expense Details</h2>
              <button onClick={() => setPreviewExpense(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">

              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {previewExpense.vendor || previewExpense.category || 'Expense'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {format(new Date(previewExpense.expense_date + 'T00:00'), 'MMMM d, yyyy')}
                </p>
                {previewExpense.category && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {previewExpense.category}{previewExpense.description ? ` • ${previewExpense.description}` : ''}
                  </p>
                )}
                {(previewExpense as any).job_sites?.site_name && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Job Site: {(previewExpense as any).job_sites.site_name}
                  </p>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Before GST</span>
                  <span className="font-medium text-gray-900 dark:text-white">${previewExpense.subtotal_before_gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">GST Paid</span>
                  <span className="font-medium text-gray-900 dark:text-white">${previewExpense.gst_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-gray-200 dark:border-gray-600 pt-2">
                  <span className="text-gray-900 dark:text-white">Total Paid</span>
                  <span className="text-teal-600 dark:text-teal-400">${previewExpense.total_paid.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Business Use</span>
                  <span className="font-medium text-gray-900 dark:text-white">{previewExpense.business_use_percent}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Deductible Amount</span>
                  <span className="font-medium text-gray-900 dark:text-white">${previewExpense.deductible_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">GST ITC Claim</span>
                  <span className="font-medium text-gray-900 dark:text-white">${previewExpense.itc_claim_amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                {(previewExpense as any).payment_method && (
                  <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Payment Method</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{(previewExpense as any).payment_method}</p>
                  </div>
                )}
                <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tax Status</p>
                  <p className={`text-sm font-medium ${taxStatusLabel((previewExpense as any).tax_confidence_status || 'clear').color}`}>
                    {taxStatusLabel((previewExpense as any).tax_confidence_status || 'clear').label}
                  </p>
                </div>
              </div>

              {previewExpense.notes && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{previewExpense.notes}</p>
                </div>
              )}

              {previewExpense.receipt_url && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Receipt</p>
                  <ReceiptPreview path={previewExpense.receipt_url} />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPreviewExpense(null)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { editExpense(previewExpense); setPreviewExpense(null); }}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">What type of expense is this?</label>
                <select value={formData.category} onChange={e => onCategoryChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Select category...</option>
                  {EXPENSE_CATEGORY_DATA.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {formData.category && selectedCategoryData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subcategory</label>
                  <select value={formData.subcategory} onChange={e => onSubcategoryChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Select subcategory...</option>
                    {selectedCategoryData.subcategories.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                  {selectedSubcategoryData?.helperText && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {selectedSubcategoryData.helperText}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input type="date" value={formData.expense_date} onChange={e => setFormData(f => ({ ...f, expense_date: e.target.value }))} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
                  <input type="text" value={formData.vendor} onChange={e => setFormData(f => ({ ...f, vendor: e.target.value }))} placeholder="Store name" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="What did you buy?" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client (optional)</label>
                  <select value={formData.client_id} onChange={e => setFormData(f => ({ ...f, client_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">None</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Site (optional)</label>
                  <select value={formData.job_site_id} onChange={e => setFormData(f => ({ ...f, job_site_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">None</option>
                    {jobSites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (before GST)</label>
                  <input type="number" value={formData.subtotal_before_gst || ''} onChange={e => setFormData(f => ({ ...f, subtotal_before_gst: parseFloat(e.target.value) || 0 }))} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST Paid</label>
                  <input type="number" value={formData.gst_paid || ''} onChange={e => setFormData(f => ({ ...f, gst_paid: parseFloat(e.target.value) || 0 }))} min={0} step={0.01} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Use %</label>
                <input type="number" value={formData.business_use_percent} onChange={e => setFormData(f => ({ ...f, business_use_percent: parseFloat(e.target.value) || 100 }))} min={0} max={100} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <p className="text-xs text-gray-400 mt-1">Only claim the business-use portion.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                  <select value={formData.payment_method} onChange={e => setFormData(f => ({ ...f, payment_method: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Select...</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Confidence</label>
                  <select value={formData.tax_confidence_status} onChange={e => setFormData(f => ({ ...f, tax_confidence_status: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    {TAX_CONFIDENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total paid:</span>
                  <span className="font-medium">${(formData.subtotal_before_gst + formData.gst_paid).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Deductible amount:</span>
                  <span className="font-medium">${(formData.subtotal_before_gst * formData.business_use_percent / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>GST ITC claim:</span>
                  <span className="font-medium">${(formData.gst_paid * formData.business_use_percent / 100).toFixed(2)}</span>
                </div>
              </div>

              {/* Current receipt when editing */}
              {editingId && (() => {
                const currentExp = expenses.find(e => e.id === editingId);
                if (!currentExp?.receipt_url) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Current Receipt</p>
                    <ReceiptPreview
                      path={currentExp.receipt_url}
                      className="w-full max-h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Select a new file below to replace it</p>
                  </div>
                );
              })()}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {editingId ? 'Replace Receipt (optional)' : 'Receipt / Photo'}
                </label>
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-600 dark:text-gray-400">
                  <Upload className="w-4 h-4" />
                  {receiptFile ? receiptFile.name : 'Choose file'}
                  <input type="file" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="hidden" accept="image/*,.pdf" />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>

              <button type="submit" disabled={uploading} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                {uploading ? 'Uploading...' : editingId ? 'Update' : 'Save Expense'}
              </button>

              <p className="text-xs text-gray-400 dark:text-gray-500 text-center italic">
                This is an estimate only, not official tax advice.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Expense list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No expenses recorded{(dateFrom || dateTo) ? ' for this date range' : ''}</p>
          </div>
        ) : filtered.map(exp => (
          <div
            key={exp.id}
            onClick={() => setPreviewExpense(exp)}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {exp.vendor || exp.description || 'Expense'}
                  </span>
                  {(exp as any).tax_confidence_status === 'needs_review' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  {(exp as any).tax_confidence_status === 'ask_accountant' && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                  {exp.receipt_url && <Receipt className="w-3 h-3 text-teal-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {format(new Date(exp.expense_date + 'T00:00'), 'MMM d, yyyy')} • {exp.category || 'Uncategorized'}
                  {exp.description && ` • ${exp.description}`}
                </p>
              </div>
              <div className="text-right ml-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">${exp.total_paid.toFixed(2)}</p>
                <p className="text-xs text-gray-400">{exp.business_use_percent}% biz</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}