/*
  # Create expenses table

  1. New Tables
    - `expenses`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `expense_date` (date, not null)
      - `vendor` (text)
      - `category` (text)
      - `description` (text)
      - `job_site_id` (uuid, references job_sites, nullable)
      - `subtotal_before_gst` (numeric)
      - `gst_paid` (numeric)
      - `total_paid` (numeric)
      - `business_use_percent` (numeric, default 100)
      - `deductible_amount` (numeric)
      - `itc_claim_amount` (numeric)
      - `receipt_url` (text)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only access their own expenses
*/

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_date date NOT NULL,
  vendor text,
  category text,
  description text,
  job_site_id uuid REFERENCES job_sites(id) ON DELETE SET NULL,
  subtotal_before_gst numeric DEFAULT 0,
  gst_paid numeric DEFAULT 0,
  total_paid numeric DEFAULT 0,
  business_use_percent numeric DEFAULT 100,
  deductible_amount numeric DEFAULT 0,
  itc_claim_amount numeric DEFAULT 0,
  receipt_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(user_id, category);