/*
  # Create invoice history table

  1. New Tables
    - `invoice_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `invoice_id` (uuid, references invoices)
      - `action` (text) - 'downloaded', 'sent', 'edited', 'deleted'
      - `note` (text, nullable) - optional context
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `invoice_history` table
    - Add policies for authenticated users to manage their own history
*/

CREATE TABLE IF NOT EXISTS invoice_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  invoice_number text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT '',
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice history"
  ON invoice_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoice history"
  ON invoice_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoice history"
  ON invoice_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
