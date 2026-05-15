/*
  # Create vehicles and mileage_logs tables

  1. New Tables
    - `vehicles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `vehicle_name` (text) - Display name
      - `year` (integer) - Vehicle year
      - `make` (text) - Vehicle make
      - `model` (text) - Vehicle model
      - `opening_odometer` (numeric) - Jan 1 reading
      - `closing_odometer` (numeric) - Dec 31 reading
      - `total_km` (numeric) - Total km driven for the year
      - `business_km` (numeric) - Business km driven
      - `business_use_percent` (numeric) - Calculated %
      - `active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `mileage_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `vehicle_id` (uuid, references vehicles)
      - `log_date` (date)
      - `client_id` (uuid, references clients, nullable)
      - `job_site_id` (uuid, references job_sites, nullable)
      - `start_location` (text)
      - `destination` (text)
      - `purpose` (text)
      - `km_driven` (numeric)
      - `notes` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own data
*/

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_name text NOT NULL,
  year integer,
  make text,
  model text,
  opening_odometer numeric,
  closing_odometer numeric,
  total_km numeric,
  business_km numeric,
  business_use_percent numeric,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS mileage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  log_date date NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  job_site_id uuid REFERENCES job_sites(id) ON DELETE SET NULL,
  start_location text,
  destination text,
  purpose text,
  km_driven numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mileage logs"
  ON mileage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mileage logs"
  ON mileage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mileage logs"
  ON mileage_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mileage logs"
  ON mileage_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_user_date ON mileage_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_vehicle ON mileage_logs(vehicle_id);