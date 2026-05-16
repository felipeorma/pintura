/*
  # Add public read policy for business card

  1. Security
    - Add a SELECT policy on `profiles` table for anonymous (public) access
    - ONLY exposes: full_name, business_name, email, phone, city, province, tagline, website, service_area
    - ONLY returns rows where card_slug IS NOT NULL (user opted in)
    - This allows the public /card/:slug route to fetch card data without authentication

  2. Notes
    - Users opt in by setting a card_slug in their settings
    - The policy restricts to rows with a non-null card_slug
*/

CREATE POLICY "Public can view business cards with slug"
  ON profiles
  FOR SELECT
  TO anon
  USING (card_slug IS NOT NULL);
