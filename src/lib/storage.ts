import { supabase } from './supabase';

export async function getFileUrl(path: string, bucket: string): Promise<string | null> {
  if (!path) return null;
  // If it's already a full URL (old data), return as-is
  if (path.startsWith('http')) {
    // Convert public URL to signed URL by extracting the path
    const parts = path.split(`/${bucket}/`);
    if (parts.length < 2) return path;
    path = parts[1];
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60); // 1 hora de validez
  if (error) return null;
  return data.signedUrl;
}

export function getBucket(type: string): string {
  switch (type) {
    case 'Receipt':           return 'receipts';
    case 'Invoice PDF':       return 'invoices';
    case 'WCB document':      return 'wcb-documents';
    case 'Job site photo':    return 'job-site-photos';
    case 'GST / CRA document':return 'cra-gst-documents';
    default:                  return 'receipts';
  }
}