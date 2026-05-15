/*
  # Add distance_from_home_km to job_sites

  1. Modified Tables
    - `job_sites`
      - `distance_from_home_km` (numeric, nullable) - One-way distance in km from home address to this job site

  2. Notes
    - Used for auto-calculating mileage when logging trips
    - Can be manually entered or updated at any time
    - Represents one-way distance; round trip is 2x this value
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_sites' AND column_name = 'distance_from_home_km'
  ) THEN
    ALTER TABLE job_sites ADD COLUMN distance_from_home_km numeric;
  END IF;
END $$;
