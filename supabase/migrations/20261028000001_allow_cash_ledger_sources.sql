-- Allow the financial ledger to represent opening balances and cash-register sync rows.
-- Existing records are preserved; only the allowed values are expanded.
alter table public.financial_movements
  drop constraint if exists financial_movements_direction_check;

alter table public.financial_movements
  add constraint financial_movements_direction_check
  check (direction in ('income', 'expense', 'opening'));

alter table public.financial_movements
  drop constraint if exists financial_movements_source_check;

alter table public.financial_movements
  add constraint financial_movements_source_check
  check (source in ('manual', 'whatsapp_october_2026', 'sale', 'cash'));

-- source_key is already unique in the original ledger migration; this index is
-- safe for databases where the table was created before that constraint existed.
create unique index if not exists financial_movements_source_key_unique
  on public.financial_movements (source_key)
  where source_key is not null;
