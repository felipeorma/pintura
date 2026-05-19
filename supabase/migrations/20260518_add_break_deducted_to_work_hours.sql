alter table public.work_hours
add column if not exists break_deducted boolean not null default true;

alter table public.invoice_items
add column if not exists break_minutes integer;

alter table public.invoice_items
add column if not exists break_deducted boolean;