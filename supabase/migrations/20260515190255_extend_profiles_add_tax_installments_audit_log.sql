/*
  # Extend profiles, add tax_installments and audit_log tables

  1. Modified Tables
    - `profiles`
      - `business_number` (text) - CRA Business Number
      - `home_office_percent` (numeric) - % of home used as office
      - `vehicle_business_use_percent` (numeric) - % of vehicle for business
      - `phone_business_use_percent` (numeric) - % of phone for business
      - `internet_business_use_percent` (numeric) - % of internet for business
      - `fiscal_year_start` (text) - Default '01-01' (calendar year)
      - `industry_code` (text) - NAICS code for T2125

  2. New Tables
    - `tax_installments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `year` (integer) - Tax year
      - `quarter` (integer) - 1-4
      - `due_date` (date) - Instalment due date
      - `amount_due` (numeric) - Expected amount
      - `amount_paid` (numeric) - Actual amount paid
      - `paid_date` (date) - When paid
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `audit_log`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `entity_type` (text) - e.g. 'invoice', 'expense', 'work_hour'
      - `entity_id` (uuid) - ID of the affected record
      - `action` (text) - e.g. 'created', 'updated', 'deleted', 'status_changed'
      - `note` (text) - Human-readable description
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on new tables
    - Users can only access their own data
*/

-- Extend profiles with new fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'home_office_percent'
  ) THEN
    ALTER TABLE profiles ADD COLUMN home_office_percent numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'vehicle_business_use_percent'
  ) THEN
    ALTER TABLE profiles ADD COLUMN vehicle_business_use_percent numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_business_use_percent'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_business_use_percent numeric DEFAULT 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'internet_business_use_percent'
  ) THEN
    ALTER TABLE profiles ADD COLUMN internet_business_use_percent numeric DEFAULT 25;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'fiscal_year_start'
  ) THEN
    ALTER TABLE profiles ADD COLUMN fiscal_year_start text DEFAULT '01-01';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'industry_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN industry_code text DEFAULT '238320';
  END IF;
END $$;

-- Create tax_installments table
CREATE TABLE IF NOT EXISTS tax_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  due_date date NOT NULL,
  amount_due numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  paid_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year, quarter)
);

ALTER TABLE tax_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tax installments"
  ON tax_installments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax installments"
  ON tax_installments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tax installments"
  ON tax_installments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tax installments"
  ON tax_installments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tax_installments_user_year ON tax_installments(user_id, year);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);