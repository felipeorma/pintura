alter table public.clients
add column if not exists address text;

alter table public.clients
add column if not exists city text;

alter table public.clients
add column if not exists province text default 'AB';

alter table public.clients
add column if not exists postal_code text;

alter table public.invoices
add column if not exists show_business_address boolean not null default true;

alter table public.invoices
add column if not exists show_gst_number boolean not null default true;

alter table public.work_hours
add column if not exists break_deducted boolean not null default true;

alter table public.invoice_items
add column if not exists break_minutes integer;

alter table public.invoice_items
add column if not exists break_deducted boolean;