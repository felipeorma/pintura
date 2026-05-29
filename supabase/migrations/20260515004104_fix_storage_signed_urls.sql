-- Ensure buckets exist (in case previous migration didn't run)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('receipts',          'receipts',          false),
  ('invoices',          'invoices',          false),
  ('wcb-documents',     'wcb-documents',     false),
  ('job-site-photos',   'job-site-photos',   false),
  ('cra-gst-documents', 'cra-gst-documents', false)
ON CONFLICT (id) DO NOTHING;