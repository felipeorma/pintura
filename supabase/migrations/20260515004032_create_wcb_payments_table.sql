/*
  # Create wcb_payments table

  1. New Tables
    - `wcb_payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `payment_date` (date)
      - `description` (text)
      - `amount` (numeric)
      - `due_date` (date, nullable)
      - `status` (text) - pending, paid
      - `document_url` (text)
      - `notes` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only access their own WCB payments
*/

CREATE TABLE IF NOT EXISTS wcb_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_date date,
  description text,
  amount numeric,
  due_date date,
  status text DEFAULT 'pending',
  document_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wcb_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wcb payments"
  ON wcb_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wcb payments"
  ON wcb_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wcb payments"
  ON wcb_payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wcb payments"
  ON wcb_payments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);