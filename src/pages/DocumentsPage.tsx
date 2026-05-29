import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DOCUMENT_TYPES } from '../lib/types';
import type { Document, Expense } from '../lib/types';
import { X, FolderOpen, Upload, ExternalLink, FileText, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { getFileUrl, getBucket } from '../lib/storage';

interface UnifiedItem {
  id: string;
  title: string;
  label: string;
  path: string | null;
  date: string;
  notes: string | null;
  canDelete: boolean;
  source: 'document' | 'expense';
  rawDoc?: Document;
}

function ItemThumbnail({ path, bucket }: { path: string; bucket: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = /\.(jpg|jpeg|png|gif|webp|heic)/i.test(path);

  useEffect(() => {
    if (isImage) getFileUrl(path, bucket).then(setUrl);
  }, [path, bucket]);

  if (isImage && url) {
    return (
      <button
        onClick={() => window.open(url, '_blank')}
        className="w-8 h-8 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0"
      >
        <img src={url} alt="" className="w-full h-full object-cover" />
      </button>
    );
  }

  return (
    <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
      {bucket === 'receipts'
        ? <Receipt className="w-4 h-4 text-gray-400" />
        : <FileText className="w-4 h-4 text-gray-400" />
      }
    </div>
  );
}

function OpenFileButton({ path, bucket, className, children }: {
  path: string;
  bucket: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getFileUrl(path, bucket).then(setUrl);
  }, [path, bucket]);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (url) window.open(url, '_blank'); }}
      disabled={!url}
      className={className}
    >
      {children}
    </button>
  );
}

export function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expensesWithReceipts, setExpensesWithReceipts] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [formData, setFormData] = useState({
    document_type: '',
    title: '',
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (user) loadDocuments();
  }, [user]);

  async function loadDocuments() {
    const [docsRes, expRes] = await Promise.all([
      supabase.from('documents').select('*').eq('user_id', user!.id).order('uploaded_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('user_id', user!.id).not('receipt_url', 'is', null).order('expense_date', { ascending: false }),
    ]);
    setDocuments(docsRes.data || []);
    setExpensesWithReceipts(expRes.data || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    const bucket = getBucket(formData.document_type);
    const filePath = `${user!.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);

    if (uploadError) {
      setUploading(false);
      return;
    }

    await supabase.from('documents').insert({
      user_id: user!.id,
      document_type: formData.document_type || null,
      title: formData.title || file.name,
      file_url: filePath,
      notes: formData.notes || null,
    });

    setShowForm(false);
    setFormData({ document_type: '', title: '', notes: '' });
    setFile(null);
    setUploading(false);
    loadDocuments();
  }

  async function deleteDocument(doc: Document) {
    if (!confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', doc.id);
    loadDocuments();
  }

  const docItems: UnifiedItem[] = documents.map(d => ({
    id: d.id,
    title: d.title || 'Untitled',
    label: d.document_type || 'Other',
    path: d.file_url,
    date: d.uploaded_at,
    notes: d.notes,
    canDelete: true,
    source: 'document',
    rawDoc: d,
  }));

  const receiptItems: UnifiedItem[] = expensesWithReceipts.map(e => ({
    id: e.id,
    title: [e.vendor, e.category, e.description].filter(Boolean).join(' • ') || 'Expense Receipt',
    label: 'Receipt',
    path: e.receipt_url,
    date: e.expense_date,
    notes: e.notes,
    canDelete: false,
    source: 'expense',
  }));

  const allItems = [...docItems, ...receiptItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const filtered = allItems.filter(i => {
    if (filterType !== 'all' && i.label !== filterType) return false;
    const d = i.date.includes('T') ? i.date.split('T')[0] : i.date;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  const labelColors: Record<string, string> = {
    'Receipt': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    'Invoice PDF': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'WCB document': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    'GST / CRA document': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    'Contract': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    'Job site photo': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
    'Other': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documents</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{allItems.length} files total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" /> Upload
        </button>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 mb-3 overflow-x-auto">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap ${filterType === 'all' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
        >
          All ({allItems.length})
        </button>
        {DOCUMENT_TYPES.map(t => {
          const count = allItems.filter(i => i.label === t).length;
          if (count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap ${filterType === t ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
            >
              {t} ({count})
            </button>
          );
        })}
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

      {/* Upload Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Document</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={formData.document_type}
                  onChange={e => setFormData(f => ({ ...f, document_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select type...</option>
                  {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  placeholder="Document name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File</label>
                <input
                  type="file"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  required
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/20 dark:file:text-teal-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={!file || uploading}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No documents found{(dateFrom || dateTo) ? ' for this date range' : ''}</p>
          </div>
        ) : filtered.map(item => {
          const bucket = getBucket(item.label);
          return (
            <div
              key={`${item.source}-${item.id}`}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3"
            >
              <div className="flex items-start gap-3">

                {item.path
                  ? <ItemThumbnail path={item.path} bucket={bucket} />
                  : (
                    <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                  )
                }

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {item.title}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${labelColors[item.label] || labelColors['Other']}`}>
                      {item.label}
                    </span>
                    {item.source === 'expense' && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        from Expenses
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {format(new Date(item.date + (item.date.includes('T') ? '' : 'T00:00')), 'MMM d, yyyy')}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{item.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.path && (
                    <OpenFileButton
                      path={item.path}
                      bucket={bucket}
                      className="p-1.5 text-gray-400 hover:text-teal-600 transition-colors disabled:opacity-30"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </OpenFileButton>
                  )}
                  {item.canDelete && item.rawDoc && (
                    <button
                      onClick={() => deleteDocument(item.rawDoc!)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}