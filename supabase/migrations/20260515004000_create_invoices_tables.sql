/*
  # Create invoices and invoice_items tables

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `client_id` (uuid, references clients)
      - `invoice_number` (text, not null)
      - `invoice_date` (date, not null)
      - `due_date` (date)
      - `status` (text) - draft, sent, paid, overdue, cancelled
      - `subtotal` (numeric)
      - `gst_amount` (numeric)
      - `total_amount` (numeric)
      - `amount_paid` (numeric)
      - `balance_due` (numeric)
      - `notes` (text)
      - `pdf_url` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `invoice_items`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `invoice_id` (uuid, references invoices)
      - `work_hour_id` (uuid, references work_hours, nullable)
      - `job_site_id` (uuid, references job_sites, nullable)
      - `description` (text)
      - `work_date` (date)
      - `hours` (numeric)
      - `rate` (numeric)
      - `subtotal` (numeric)
      - `gst_amount` (numeric)
      - `total_amount` (numeric)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own data
*/

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  due_date date,
  status text DEFAULT 'draft',
  subtotal numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  balance_due numeric DEFAULT 0,
  notes text,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  work_hour_id uuid REFERENCES work_hours(id) ON DELETE SET NULL,
  job_site_id uuid REFERENCES job_sites(id) ON DELETE SET NULL,
  description text,
  work_date date,
  hours numeric,
  rate numeric,
  subtotal numeric,
  gst_amount numeric DEFAULT 0,
  total_amount numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoice items"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoice items"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);