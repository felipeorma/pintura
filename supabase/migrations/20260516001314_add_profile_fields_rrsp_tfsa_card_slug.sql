/*
  # Add profile fields for RRSP, TFSA, previous year income, and business card

  1. Modified Tables
    - `profiles`
      - `rrsp_room_remaining` (numeric) - Unused RRSP contribution room from CRA NOA
      - `tfsa_room_remaining` (numeric) - Unused TFSA contribution room
      - `prev_year_net_income` (numeric) - Previous year's net business income (for instalment calc)
      - `card_slug` (text, unique) - Public business card URL slug
      - `card_image_url` (text) - Custom hero image for business card
      - `tagline` (text) - Business tagline shown on card
      - `website` (text) - Business website URL
      - `service_area` (text) - Service area description (e.g. "Calgary & Area")

  2. Notes
    - card_slug has UNIQUE constraint for public URL routing
    - All fields are nullable with no defaults
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rrsp_room_remaining'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rrsp_room_remaining numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tfsa_room_remaining'
  ) THEN
    ALTER TABLE profiles ADD COLUMN tfsa_room_remaining numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'prev_year_net_income'
  ) THEN
    ALTER TABLE profiles ADD COLUMN prev_year_net_income numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'card_slug'
  ) THEN
    ALTER TABLE profiles ADD COLUMN card_slug text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'card_image_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN card_image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tagline'
  ) THEN
    ALTER TABLE profiles ADD COLUMN tagline text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'website'
  ) THEN
    ALTER TABLE profiles ADD COLUMN website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'service_area'
  ) THEN
    ALTER TABLE profiles ADD COLUMN service_area text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_card_slug ON profiles(card_slug) WHERE card_slug IS NOT NULL;
