/*
  # Update expenses table with new columns

  1. Modified Tables
    - `expenses` - Adding new columns:
      - `category_id` (uuid, references expense_categories)
      - `subcategory_id` (uuid, references expense_subcategories)
      - `tax_confidence_status` (text) - clear, needs_review, ask_accountant
      - `needs_receipt` (boolean) - Whether receipt is required
      - `receipt_uploaded` (boolean) - Whether receipt was uploaded
      - `payment_method` (text) - How the expense was paid
      - `vehicle_id` (uuid, references vehicles, nullable)
      - `home_office_related` (boolean) - Is this a home office expense
      - `client_id` (uuid, references clients, nullable)

  2. Important Notes
    - Existing expenses retain their data
    - New columns have safe defaults
    - No data is deleted or modified
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN category_id uuid REFERENCES expense_categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN subcategory_id uuid REFERENCES expense_subcategories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'tax_confidence_status'
  ) THEN
    ALTER TABLE expenses ADD COLUMN tax_confidence_status text DEFAULT 'clear';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'needs_receipt'
  ) THEN
    ALTER TABLE expenses ADD COLUMN needs_receipt boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'receipt_uploaded'
  ) THEN
    ALTER TABLE expenses ADD COLUMN receipt_uploaded boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE expenses ADD COLUMN payment_method text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'home_office_related'
  ) THEN
    ALTER TABLE expenses ADD COLUMN home_office_related boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;