/*
  # Create job_sites table

  1. New Tables
    - `job_sites`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `client_id` (uuid, references clients, nullable)
      - `site_name` (text, not null)
      - `address` (text)
      - `city` (text)
      - `province` (text, default AB)
      - `postal_code` (text)
      - `notes` (text)
      - `active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `job_sites` table
    - Users can only access their own job sites
*/

CREATE TABLE IF NOT EXISTS job_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  site_name text NOT NULL,
  address text,
  city text,
  province text DEFAULT 'AB',
  postal_code text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE job_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own job sites"
  ON job_sites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job sites"
  ON job_sites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job sites"
  ON job_sites FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own job sites"
  ON job_sites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_job_sites_user_active ON job_sites(user_id, active);
CREATE INDEX IF NOT EXISTS idx_job_sites_client ON job_sites(client_id);