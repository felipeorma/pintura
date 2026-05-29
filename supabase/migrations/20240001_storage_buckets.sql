-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('receipts',          'receipts',          true),
  ('invoices',          'invoices',          true),
  ('wcb-documents',     'wcb-documents',     true),
  ('job-site-photos',   'job-site-photos',   true),
  ('cra-gst-documents', 'cra-gst-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for all buckets
CREATE POLICY IF NOT EXISTS "Public read storage"
ON storage.objects FOR SELECT
USING (true);

-- Authenticated users can upload to their own folder
CREATE POLICY IF NOT EXISTS "Users can upload"
ON storage.objects FOR INSERT
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own files
CREATE POLICY IF NOT EXISTS "Users can update own files"
ON storage.objects FOR UPDATE
USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own files
CREATE POLICY IF NOT EXISTS "Users can delete own files"
ON storage.objects FOR DELETE
USING (auth.uid()::text = (storage.foldername(name))[1]);