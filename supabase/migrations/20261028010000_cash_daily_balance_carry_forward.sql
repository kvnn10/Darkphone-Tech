alter table public.cash_sessions
  add column if not exists opening_transfer_amount numeric(14,2) not null default 0 check (opening_transfer_amount >= 0),
  add column if not exists expected_transfer_amount numeric(14,2) null check (expected_transfer_amount is null or expected_transfer_amount >= 0),
  add column if not exists counted_transfer_amount numeric(14,2) null check (counted_transfer_amount is null or counted_transfer_amount >= 0);
