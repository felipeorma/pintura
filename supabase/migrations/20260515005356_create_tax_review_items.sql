/*
  # Create tax_review_items table

  1. New Tables
    - `tax_review_items`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `item_date` (date) - When the item was generated
      - `item_type` (text) - Category of review item
      - `message` (text) - Suggestion/action text
      - `status` (text) - open, resolved, dismissed
      - `related_expense_id` (uuid, nullable)
      - `related_invoice_id` (uuid, nullable)
      - `related_work_hour_id` (uuid, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only access their own review items
*/

CREATE TABLE IF NOT EXISTS tax_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_date date DEFAULT CURRENT_DATE,
  item_type text,
  message text NOT NULL,
  status text DEFAULT 'open',
  related_expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  related_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  related_work_hour_id uuid REFERENCES work_hours(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tax_review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tax review items"
  ON tax_review_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax review items"
  ON tax_review_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tax review items"
  ON tax_review_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tax review items"
  ON tax_review_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tax_review_items_user_status ON tax_review_items(user_id, status);