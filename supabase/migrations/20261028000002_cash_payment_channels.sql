-- Let a cash session track physical cash and bank transfers separately.
-- Existing cash movements retain the cash default; no historical records are rewritten.
alter table public.cash_movements
  add column if not exists payment_channel text not null default 'cash';

alter table public.cash_movements
  drop constraint if exists cash_movements_payment_channel_check;

alter table public.cash_movements
  add constraint cash_movements_payment_channel_check
  check (payment_channel in ('cash', 'bank_transfer'));

-- Permit the central ledger to store opening balances and cash-sourced movements,
-- while preserving the existing adjustment direction.
alter table public.financial_movements
  drop constraint if exists financial_movements_direction_check;
alter table public.financial_movements
  add constraint financial_movements_direction_check
  check (direction in ('income', 'expense', 'opening', 'adjustment'));

alter table public.financial_movements
  drop constraint if exists financial_movements_source_check;
alter table public.financial_movements
  add constraint financial_movements_source_check
  check (source in ('manual', 'whatsapp_october_2026', 'sale', 'cash'));

create unique index if not exists financial_movements_source_key_unique
  on public.financial_movements (source_key)
  where source_key is not null;
