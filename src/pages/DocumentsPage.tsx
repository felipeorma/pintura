import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DOCUMENT_TYPES } from '../lib/types';
import type { Document } from '../lib/types';
import { X, FolderOpen, Upload, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState('all');

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
    const { data } = await supabase.from('documents').select('*').eq('user_id', user!.id).order('uploaded_at', { ascending: false });
    setDocuments(data || []);
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

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const fileUrl = urlData?.publicUrl || filePath;

    await supabase.from('documents').insert({
      user_id: user!.id,
      document_type: formData.document_type || null,
      title: formData.title || file.name,
      file_url: fileUrl,
      notes: formData.notes || null,
    });

    setShowForm(false);
    setFormData({ document_type: '', title: '', notes: '' });
    setFile(null);
    setUploading(false);
    loadDocuments();
  }

  function getBucket(type: string): string {
    switch (type) {
      case 'Receipt': return 'receipts';
      case 'Invoice PDF': return 'invoices';
      case 'WCB document': return 'wcb-documents';
      case 'Job site photo': return 'job-site-photos';
      case 'GST / CRA document': return 'cra-gst-documents';
      default: return 'receipts';
    }
  }

  async function deleteDocument(doc: Document) {
    if (!confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', doc.id);
    loadDocuments();
  }

  const filtered = filterType === 'all' ? documents : documents.filter(d => d.document_type === filterType);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documents</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Upload className="w-4 h-4" /> Upload
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        <button onClick={() => setFilterType('all')} className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap ${filterType === 'all' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>All</button>
        {DOCUMENT_TYPES.map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap ${filterType === t ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>{t}</button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Document</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select value={formData.document_type} onChange={e => setFormData(f => ({ ...f, document_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Select type...</option>
                  {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input type="text" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} placeholder="Document name" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File</label>
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/20 dark:file:text-teal-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <button type="submit" disabled={!file || uploading} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No documents uploaded</p>
          </div>
        ) : filtered.map(doc => (
          <div key={doc.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{doc.title || 'Untitled'}</span>
                  {doc.document_type && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">{doc.document_type}</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</p>
              </div>
              <div className="flex items-center gap-2">
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-teal-600">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => deleteDocument(doc)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
