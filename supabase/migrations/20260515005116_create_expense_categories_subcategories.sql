/*
  # Create expense_categories and expense_subcategories tables

  1. New Tables
    - `expense_categories`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text) - Category name
      - `active` (boolean)

    - `expense_subcategories`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `category_id` (uuid, references expense_categories)
      - `name` (text) - Subcategory name
      - `helper_text` (text) - Guidance text for the user
      - `default_business_use_percent` (numeric) - Default % for this type
      - `needs_review` (boolean) - Flag if accountant should check
      - `active` (boolean)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own categories/subcategories
*/

CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expense categories"
  ON expense_categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expense categories"
  ON expense_categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expense categories"
  ON expense_categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS expense_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  helper_text text,
  default_business_use_percent numeric DEFAULT 100,
  needs_review boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expense_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own expense subcategories"
  ON expense_subcategories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expense subcategories"
  ON expense_subcategories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expense subcategories"
  ON expense_subcategories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expense subcategories"
  ON expense_subcategories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_expense_categories_user ON expense_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_subcategories_category ON expense_subcategories(category_id);