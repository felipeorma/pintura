alter table public.profiles
add column if not exists postal_code text;

notify pgrst, 'reload schema';