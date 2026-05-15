/*
  # Fix security issues on handle_new_user function

  1. Security Changes
    - Set immutable search_path to prevent search path manipulation
    - Revoke EXECUTE from public, anon, and authenticated roles
    - Function is only called by trigger, never directly by users

  2. Notes
    - Function is a trigger handler and should not be callable via RPC
    - Setting search_path explicitly prevents privilege escalation
*/

-- Recreate function with secure search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Revoke execute from all roles that should not call it directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
