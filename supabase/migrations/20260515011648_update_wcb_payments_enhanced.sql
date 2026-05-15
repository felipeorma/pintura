/*
  # Enhance wcb_payments table for full WCB tracking

  1. Modified Tables
    - `wcb_payments`
      - Add `expected_invoice_date` (date, nullable) - when invoice is expected
      - Add `invoice_received` (boolean, default false) - whether official invoice arrived
      - Add `invoice_date` (date, nullable) - when invoice was received
      - Add `amount_expected` (numeric, default 0) - total expected for this installment
      - Add `amount_paid` (numeric, default 0) - how much has been paid
      - Add `remaining_balance` (numeric, default 0) - amount_expected - amount_paid
      - Add `updated_at` (timestamptz, default now())

  2. Notes
    - Existing `amount` column kept for backward compat, new columns used going forward
    - Status values expanded: waiting_for_invoice, invoice_received, partially_paid, paid, overdue, pending
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wcb_payments' AND column_name = 'expected_invoice_date'
  ) THEN
    ALTER TABLE wcb_payments ADD COLUMN expected_invoice_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wcb_payments' AND column_name = 'invoice_received'
  ) THEN
    ALTER TABLE wcb_payments ADD COLUMN invoice_received boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wcb_payments' AND column_name = 'invoice_date'
  ) THEN
    ALTER TABLE wcb_payments ADD COLUMN invoice_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wcb_payments' AND column_name = 'amount_expected'
  ) THEN
    ALTER TABLE wcb_payments ADD COLUMN amount_expected numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wcb_payments' AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE wcb_payments ADD COLUMN amount_paid numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wcb_payments' AND column_name = 'remaining_balance'
  ) THEN
    ALTER TABLE wcb_payments ADD COLUMN remaining_balance numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wcb_payments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE wcb_payments ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
