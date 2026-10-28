create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date date not null,
  direction text not null check (direction in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  payment_channel text not null check (payment_channel in ('bank_transfer','cash')),
  description text null,
  pending_amount numeric(14,2) not null default 0 check (pending_amount >= 0),
  pending_delta numeric(14,2) not null default 0,
  source text not null default 'manual' check (source in ('manual','whatsapp_october_2026')),
  source_key text unique,
  source_message text null,
  created_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (pending_amount = 0 or (direction='income' and payment_channel='bank_transfer'))
);
alter table public.financial_movements enable row level security;
drop policy if exists financial_movements_read_staff on public.financial_movements;
create policy financial_movements_read_staff on public.financial_movements for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true));
drop policy if exists financial_movements_insert_admin on public.financial_movements;
create policy financial_movements_insert_admin on public.financial_movements for insert to authenticated
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('owner','admin','cashier')));
drop policy if exists financial_movements_update_admin on public.financial_movements;
create policy financial_movements_update_admin on public.financial_movements for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('owner','admin','cashier')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('owner','admin','cashier')));
grant select,insert,update on public.financial_movements to authenticated;