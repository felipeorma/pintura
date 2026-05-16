/*
  # Add RRSP planned contribution to profiles

  1. Modified Tables
    - `profiles`
      - `rrsp_planned_contribution` (numeric, nullable) - tracks the user's planned RRSP contribution for tax planning

  2. Notes
    - Used by the Tax Tips card to track planned RRSP contributions
    - Nullable since not all users will set this
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rrsp_planned_contribution'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rrsp_planned_contribution numeric;
  END IF;
END $$;
