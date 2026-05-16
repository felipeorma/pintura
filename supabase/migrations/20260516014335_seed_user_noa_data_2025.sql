/*
  # Seed user's verified 2025 NOA data

  1. Updated Tables
    - `profiles` - populates tax data from 2025 CRA Notice of Assessment (issued March 9, 2026)
      - RRSP room: $27,309.00 (2026 available)
      - RRSP planned contribution: $0 (low income year)
      - TFSA room: $96,926.37 (CRA warning flagged)
      - Previous year net income (line 23600): $28,611.00
      - Previous year taxable income (line 26000): $28,611.00
      - Last NOA year: 2025
      - Canada Training Credit remaining: $250.00
      - TFSA warning: true (CRA flagged)

  2. New Records
    - `personal_tax_credits` - 2026 SAIT tuition payment ($1,921.81)

  3. Notes
    - These values are user-verified from their CRA My Account
    - TFSA room has a CRA warning flag (likely unreported recent contributions)
    - T2202 form for tuition expected February 2027
*/

-- Update the user's profile with NOA data
-- Uses a subquery to find the user (single-user app pattern)
UPDATE profiles SET
  rrsp_room_remaining = 27309.00,
  rrsp_planned_contribution = 0,
  tfsa_room_remaining = 96926.37,
  prev_year_net_income = 28611.00,
  previous_year_taxable_income = 28611.00,
  last_noa_year = 2025,
  canada_training_credit_remaining = 250.00,
  tfsa_room_warning = true,
  tfsa_room_verified_date = NULL
WHERE id = (SELECT id FROM profiles ORDER BY created_at LIMIT 1);

-- Insert 2026 tuition entry
INSERT INTO personal_tax_credits (user_id, year, credit_type, amount, description, t_form_received, notes)
SELECT
  id,
  2026,
  'tuition',
  1921.81,
  'SAIT — second semester payment (PayPath fee $50.93 excluded — not deductible)',
  false,
  'T2202 form expected February 2027'
FROM profiles
ORDER BY created_at
LIMIT 1
ON CONFLICT DO NOTHING;
