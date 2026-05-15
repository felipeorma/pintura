/*
  # WCB Alberta Full Schema — premiums, installments, clearance letters, charges

  1. Modified Tables
    - `profiles`
      - `wcb_industry_code` (text) - WCB industry classification (e.g. 'Painting services')
      - `wcb_industry_rate` (numeric) - Rate per $100 of insurable earnings
      - `wcb_coverage_effective_date` (date) - Coverage start
      - `wcb_coverage_expiry_date` (date) - Coverage end (1 year)
      - `wcb_insurable_earnings` (numeric) - Declared insurable earnings
      - `wcb_annual_premium` (numeric) - Annual premium total

  2. New Tables
    - `wcb_premiums` — annual premium ledger
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK auth.users)
      - `year` (integer) - Premium year
      - `total_premium_amount` (numeric) - Full premium for the year
      - `insurable_earnings_declared` (numeric)
      - `industry_code` (text)
      - `industry_rate` (numeric)
      - `assessment_letter_date` (date) - When WCB sent the letter
      - `notes` (text)
      - `created_at`, `updated_at` (timestamptz)

    - `wcb_installments` — payment schedule for premiums
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK auth.users)
      - `wcb_premium_id` (uuid, FK wcb_premiums)
      - `installment_number` (integer)
      - `due_date` (date)
      - `amount_due` (numeric)
      - `amount_paid` (numeric, default 0)
      - `paid_date` (date, nullable)
      - `payment_method` (text) - e.g. 'Visa Debit', 'online banking', 'PAD'
      - `receipt_number` (text)
      - `notes` (text)
      - `created_at`, `updated_at` (timestamptz)

    - `wcb_clearance_letters` — track clearance letters issued/received
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK auth.users)
      - `direction` (text) - 'issued_to_me' or 'i_issued'
      - `counterparty_name` (text)
      - `letter_date` (date)
      - `valid_through_date` (date)
      - `status` (text) - 'cleared', 'not_cleared', 'pending'
      - `pdf_url` (text, nullable)
      - `notes` (text)
      - `created_at`, `updated_at` (timestamptz)

    - `wcb_charges` — non-premium charges (penalties, interest — NOT deductible)
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK auth.users)
      - `wcb_premium_id` (uuid, FK wcb_premiums, nullable)
      - `charge_type` (text) - CHECK IN ('penalty', 'interest', 'admin_fee', 'other')
      - `amount` (numeric)
      - `charge_date` (date)
      - `paid` (boolean, default false)
      - `paid_date` (date, nullable)
      - `notes` (text)
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on all new tables
    - Per-user access policies (authenticated only)

  4. Important Notes
    - WCB charges (penalties/interest) are NEVER tax-deductible (ITA 67.6)
    - WCB premiums (regular) ARE 100% deductible on T2125 line 8690
    - The check constraint on wcb_charges.charge_type enforces valid types
*/

-- Extend profiles with WCB-specific fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wcb_industry_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wcb_industry_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wcb_industry_rate'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wcb_industry_rate numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wcb_coverage_effective_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wcb_coverage_effective_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wcb_coverage_expiry_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wcb_coverage_expiry_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wcb_insurable_earnings'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wcb_insurable_earnings numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wcb_annual_premium'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wcb_annual_premium numeric;
  END IF;
END $$;

-- Create wcb_premiums table
CREATE TABLE IF NOT EXISTS wcb_premiums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  total_premium_amount numeric NOT NULL DEFAULT 0,
  insurable_earnings_declared numeric,
  industry_code text,
  industry_rate numeric,
  assessment_letter_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year)
);

ALTER TABLE wcb_premiums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wcb premiums"
  ON wcb_premiums FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wcb premiums"
  ON wcb_premiums FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wcb premiums"
  ON wcb_premiums FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wcb premiums"
  ON wcb_premiums FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create wcb_installments table
CREATE TABLE IF NOT EXISTS wcb_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wcb_premium_id uuid REFERENCES wcb_premiums(id) ON DELETE CASCADE,
  installment_number integer NOT NULL DEFAULT 1,
  due_date date,
  amount_due numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  paid_date date,
  payment_method text,
  receipt_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wcb_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wcb installments"
  ON wcb_installments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wcb installments"
  ON wcb_installments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wcb installments"
  ON wcb_installments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wcb installments"
  ON wcb_installments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create wcb_clearance_letters table
CREATE TABLE IF NOT EXISTS wcb_clearance_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('issued_to_me', 'i_issued')),
  counterparty_name text NOT NULL,
  letter_date date,
  valid_through_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('cleared', 'not_cleared', 'pending')),
  pdf_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wcb_clearance_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wcb clearance letters"
  ON wcb_clearance_letters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wcb clearance letters"
  ON wcb_clearance_letters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wcb clearance letters"
  ON wcb_clearance_letters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wcb clearance letters"
  ON wcb_clearance_letters FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create wcb_charges table (penalties/interest — NOT tax deductible)
CREATE TABLE IF NOT EXISTS wcb_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wcb_premium_id uuid REFERENCES wcb_premiums(id) ON DELETE SET NULL,
  charge_type text NOT NULL CHECK (charge_type IN ('penalty', 'interest', 'admin_fee', 'other')),
  amount numeric NOT NULL DEFAULT 0,
  charge_date date,
  paid boolean NOT NULL DEFAULT false,
  paid_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wcb_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wcb charges"
  ON wcb_charges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wcb charges"
  ON wcb_charges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wcb charges"
  ON wcb_charges FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wcb charges"
  ON wcb_charges FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wcb_premiums_user_year ON wcb_premiums(user_id, year);
CREATE INDEX IF NOT EXISTS idx_wcb_installments_premium ON wcb_installments(wcb_premium_id);
CREATE INDEX IF NOT EXISTS idx_wcb_installments_user ON wcb_installments(user_id);
CREATE INDEX IF NOT EXISTS idx_wcb_clearance_user ON wcb_clearance_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_wcb_charges_user ON wcb_charges(user_id);
CREATE INDEX IF NOT EXISTS idx_wcb_charges_premium ON wcb_charges(wcb_premium_id);
