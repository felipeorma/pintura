/*
  # Create year-end checklist table

  1. New Tables
    - `year_end_checklist`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `year` (integer, the tax year)
      - `item_key` (text, identifies the checklist item)
      - `checked` (boolean, default false)
      - `checked_at` (timestamptz, when item was checked)

  2. Security
    - Enable RLS on `year_end_checklist` table
    - Users can only access their own checklist items

  3. Notes
    - Unique constraint on (user_id, year, item_key) so each item only exists once per user per year
    - Used by the Tax Centre "Tips & Strategies" tab for persistent year-end checklists
*/

CREATE TABLE IF NOT EXISTS year_end_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  item_key text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  UNIQUE(user_id, year, item_key)
);

ALTER TABLE year_end_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checklist items"
  ON year_end_checklist
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checklist items"
  ON year_end_checklist
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checklist items"
  ON year_end_checklist
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own checklist items"
  ON year_end_checklist
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
