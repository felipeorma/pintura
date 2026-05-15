/*
  # Create work_hours table

  1. New Tables
    - `work_hours`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `client_id` (uuid, references clients)
      - `job_site_id` (uuid, references job_sites)
      - `work_date` (date, not null)
      - `start_time` (time)
      - `end_time` (time)
      - `break_minutes` (integer, default 0)
      - `total_hours` (numeric)
      - `hourly_rate` (numeric)
      - `subtotal` (numeric)
      - `gst_amount` (numeric, default 0)
      - `total_amount` (numeric)
      - `status` (text) - not_invoiced, invoiced, paid
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `work_hours` table
    - Users can only access their own work hours
*/

CREATE TABLE IF NOT EXISTS work_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  job_site_id uuid REFERENCES job_sites(id) ON DELETE SET NULL,
  work_date date NOT NULL,
  start_time time,
  end_time time,
  break_minutes integer DEFAULT 0,
  total_hours numeric,
  hourly_rate numeric,
  subtotal numeric,
  gst_amount numeric DEFAULT 0,
  total_amount numeric,
  status text DEFAULT 'not_invoiced',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE work_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own work hours"
  ON work_hours FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own work hours"
  ON work_hours FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work hours"
  ON work_hours FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own work hours"
  ON work_hours FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_work_hours_user_date ON work_hours(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_hours_status ON work_hours(user_id, status);
CREATE INDEX IF NOT EXISTS idx_work_hours_client ON work_hours(client_id);
CREATE INDEX IF NOT EXISTS idx_work_hours_job_site ON work_hours(job_site_id);