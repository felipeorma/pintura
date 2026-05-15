/*
  # Create storage buckets for file uploads

  1. Storage Buckets
    - `receipts` - Expense receipt photos
    - `invoices` - Generated invoice PDFs
    - `wcb-documents` - WCB clearance letters, payments
    - `job-site-photos` - Photos from job sites
    - `cra-gst-documents` - CRA/GST documents

  2. Security
    - All buckets are private
    - Users can only access their own files (path prefixed with user_id)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('receipts', 'receipts', false),
  ('invoices', 'invoices', false),
  ('wcb-documents', 'wcb-documents', false),
  ('job-site-photos', 'job-site-photos', false),
  ('cra-gst-documents', 'cra-gst-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for all buckets: users can only access files in their own folder
CREATE POLICY "Users can upload own receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own invoices"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own wcb documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'wcb-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own wcb documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'wcb-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own wcb documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'wcb-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own job site photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'job-site-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own job site photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-site-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own job site photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'job-site-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own cra gst documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'cra-gst-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own cra gst documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'cra-gst-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own cra gst documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'cra-gst-documents' AND (storage.foldername(name))[1] = auth.uid()::text);