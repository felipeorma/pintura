/*
  # Create profiles table

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `full_name` (text) - Legal business name
      - `business_name` (text) - Display business name
      - `email` (text)
      - `phone` (text)
      - `city` (text) - Default Calgary
      - `province` (text) - Default AB
      - `gst_enabled` (boolean) - Whether to charge GST
      - `gst_number` (text) - GST registration number
      - `gst_rate` (numeric) - GST rate, default 5%
      - `wcb_account_number` (text) - WCB account
      - `default_hourly_rate` (numeric) - Default rate for new entries
      - `default_tax_reserve_percent` (numeric) - Tax reserve estimate
      - `payment_instructions` (text) - For invoices
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `profiles` table
    - Add policies for authenticated users to manage their own profile
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT 'FELIPE ANDRES ORMAZABAL SANHUEZA',
  business_name text DEFAULT 'FELIPE ANDRES ORMAZABAL SANHUEZA',
  email text,
  phone text,
  city text DEFAULT 'Calgary',
  province text DEFAULT 'AB',
  gst_enabled boolean DEFAULT false,
  gst_number text,
  gst_rate numeric DEFAULT 0.05,
  wcb_account_number text DEFAULT '11029825',
  default_hourly_rate numeric,
  default_tax_reserve_percent numeric DEFAULT 25,
  payment_instructions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();