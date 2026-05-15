/*
  # Seed WCB data for existing user

  1. Profile Updates
    - Sets wcb_account_number = '11029825'
    - Sets wcb_industry_code = 'Painting services'
    - Sets wcb_coverage_effective_date = '2026-05-11'
    - Sets wcb_coverage_expiry_date = '2027-05-14'
    - Sets wcb_annual_premium = 838.92

  2. New Records
    - `wcb_premiums`: 1 row for 2026 premium ($838.92)
    - `wcb_installments`: 2 installments
      - #1: due 2026-06-17, amount_due $419.46, amount_paid $200.00 (partial)
      - #2: due 2026-11-17, amount_due $419.46, amount_paid $0

  3. Notes
    - Uses DO block to find user by existing profiles row
    - Only seeds if no wcb_premiums exist for the user (idempotent)
    - Premium total matches declared wcb_annual_premium on profile
*/

DO $$
DECLARE
  v_user_id uuid;
  v_premium_id uuid;
BEGIN
  -- Get the first user with a profile (sole proprietor app)
  SELECT id INTO v_user_id FROM profiles LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Update profile with WCB info
  UPDATE profiles SET
    wcb_account_number = '11029825',
    wcb_industry_code = 'Painting services',
    wcb_industry_rate = 1.69,
    wcb_coverage_effective_date = '2026-05-11',
    wcb_coverage_expiry_date = '2027-05-14',
    wcb_insurable_earnings = 50000,
    wcb_annual_premium = 838.92
  WHERE id = v_user_id;

  -- Only seed premium if not already present
  IF NOT EXISTS (
    SELECT 1 FROM wcb_premiums WHERE user_id = v_user_id AND year = 2026
  ) THEN
    INSERT INTO wcb_premiums (id, user_id, year, total_premium_amount, insurable_earnings_declared, industry_code, industry_rate, assessment_letter_date, notes)
    VALUES (
      gen_random_uuid(),
      v_user_id,
      2026,
      838.92,
      50000,
      'Painting services',
      1.69,
      '2026-05-11',
      'Initial assessment — coverage effective May 11, 2026'
    )
    RETURNING id INTO v_premium_id;

    -- Installment 1: partially paid
    INSERT INTO wcb_installments (user_id, wcb_premium_id, installment_number, due_date, amount_due, amount_paid, paid_date, payment_method, notes)
    VALUES (
      v_user_id,
      v_premium_id,
      1,
      '2026-06-17',
      419.46,
      200.00,
      '2026-05-15',
      'Visa Debit',
      'Partial payment — $200 of $419.46'
    );

    -- Installment 2: unpaid
    INSERT INTO wcb_installments (user_id, wcb_premium_id, installment_number, due_date, amount_due, amount_paid, notes)
    VALUES (
      v_user_id,
      v_premium_id,
      2,
      '2026-11-17',
      419.46,
      0,
      'Second installment'
    );
  END IF;
END $$;
