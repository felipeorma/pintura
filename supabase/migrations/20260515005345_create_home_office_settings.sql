/*
  # Create home_office_settings table

  1. New Tables
    - `home_office_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `total_home_area` (numeric) - Total home area in sq ft
      - `workspace_area` (numeric) - Workspace area in sq ft
      - `calculation_method` (text) - square_footage, rooms, custom_percentage
      - `business_use_percent` (numeric) - Calculated or custom %
      - `notes` (text) - How % was calculated
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only access their own settings
*/

CREATE TABLE IF NOT EXISTS home_office_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_home_area numeric,
  workspace_area numeric,
  calculation_method text DEFAULT 'square_footage',
  business_use_percent numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE home_office_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own home office settings"
  ON home_office_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own home office settings"
  ON home_office_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own home office settings"
  ON home_office_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own home office settings"
  ON home_office_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);