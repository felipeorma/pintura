/*
  # Add Employment Income, Personal Tax Credits, and extend Profiles

  1. Modified Tables
    - `profiles`
      - `previous_year_taxable_income` (numeric) - T1 line 26000 from NOA
      - `last_noa_year` (integer) - tax year of most recent NOA
      - `canada_training_credit_remaining` (numeric) - CTC limit per NOA
      - `tfsa_room_warning` (boolean) - CRA flagged TFSA room
      - `tfsa_room_verified_date` (date) - when user confirmed TFSA room

  2. New Tables
    - `personal_tax_credits`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `year` (integer)
      - `credit_type` (text) - tuition, medical, charitable, political, canada_training, other
      - `amount` (numeric)
      - `description` (text)
      - `receipt_url` (text, nullable)
      - `t_form_received` (boolean)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

    - `employment_income`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `year` (integer)
      - `employer_name` (text)
      - `employer_address` (text, nullable)
      - `start_date` (date, nullable)
      - `end_date` (date, nullable)
      - `is_current` (boolean)
      - `position_title` (text, nullable)
      - T4 box fields (box_14 through box_52)
      - `t4_received` (boolean)
      - `t4_filed_with_cra` (boolean)
      - `notes` (text, nullable)
      - `created_at`, `updated_at` (timestamptz)

    - `paystubs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `employment_income_id` (uuid, references employment_income)
      - `pay_period_end` (date)
      - `gross_pay` (numeric)
      - `cpp_withheld` (numeric)
      - `ei_withheld` (numeric)
      - `tax_withheld` (numeric)
      - `rpp_withheld` (numeric)
      - `other_deductions` (numeric)
      - `net_pay` (numeric)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on all new tables
    - Users can only CRUD their own records
*/

-- Extend profiles with new NOA and TFSA fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'previous_year_taxable_income'
  ) THEN
    ALTER TABLE profiles ADD COLUMN previous_year_taxable_income numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_noa_year'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_noa_year integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'canada_training_credit_remaining'
  ) THEN
    ALTER TABLE profiles ADD COLUMN canada_training_credit_remaining numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tfsa_room_warning'
  ) THEN
    ALTER TABLE profiles ADD COLUMN tfsa_room_warning boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tfsa_room_verified_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN tfsa_room_verified_date date;
  END IF;
END $$;

-- Personal Tax Credits table
CREATE TABLE IF NOT EXISTS personal_tax_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  credit_type text NOT NULL CHECK (credit_type IN ('tuition', 'medical', 'charitable', 'political', 'canada_training', 'other')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  receipt_url text,
  t_form_received boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE personal_tax_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personal tax credits"
  ON personal_tax_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personal tax credits"
  ON personal_tax_credits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personal tax credits"
  ON personal_tax_credits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personal tax credits"
  ON personal_tax_credits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Employment Income table
CREATE TABLE IF NOT EXISTS employment_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  employer_name text NOT NULL,
  employer_address text,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT true,
  position_title text,
  box_14_employment_income numeric(12,2) NOT NULL DEFAULT 0,
  box_16_cpp_contributions numeric(12,2) NOT NULL DEFAULT 0,
  box_17_qpp_contributions numeric(12,2) NOT NULL DEFAULT 0,
  box_18_ei_premiums numeric(12,2) NOT NULL DEFAULT 0,
  box_20_rpp_contributions numeric(12,2) NOT NULL DEFAULT 0,
  box_22_income_tax_deducted numeric(12,2) NOT NULL DEFAULT 0,
  box_24_ei_insurable_earnings numeric(12,2) NOT NULL DEFAULT 0,
  box_26_cpp_pensionable_earnings numeric(12,2) NOT NULL DEFAULT 0,
  box_44_union_dues numeric(12,2) NOT NULL DEFAULT 0,
  box_46_charitable_donations numeric(12,2) NOT NULL DEFAULT 0,
  box_52_pension_adjustment numeric(12,2) NOT NULL DEFAULT 0,
  t4_received boolean NOT NULL DEFAULT false,
  t4_filed_with_cra boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE employment_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own employment income"
  ON employment_income FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own employment income"
  ON employment_income FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own employment income"
  ON employment_income FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own employment income"
  ON employment_income FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Paystubs table
CREATE TABLE IF NOT EXISTS paystubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employment_income_id uuid NOT NULL REFERENCES employment_income(id) ON DELETE CASCADE,
  pay_period_end date NOT NULL,
  gross_pay numeric(12,2) NOT NULL DEFAULT 0,
  cpp_withheld numeric(12,2) NOT NULL DEFAULT 0,
  ei_withheld numeric(12,2) NOT NULL DEFAULT 0,
  tax_withheld numeric(12,2) NOT NULL DEFAULT 0,
  rpp_withheld numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_pay numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE paystubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own paystubs"
  ON paystubs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own paystubs"
  ON paystubs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own paystubs"
  ON paystubs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own paystubs"
  ON paystubs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_personal_tax_credits_user_year ON personal_tax_credits(user_id, year);
CREATE INDEX IF NOT EXISTS idx_employment_income_user_year ON employment_income(user_id, year);
CREATE INDEX IF NOT EXISTS idx_paystubs_employment_income ON paystubs(employment_income_id);
