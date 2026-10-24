-- DarkPhone Tech: extend the existing expenses table for the operating expenses workspace.
alter table public.expenses
  add column if not exists expense_date date not null default current_date,
  add column if not exists responsible text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists expenses_date_idx on public.expenses(expense_date desc);
create index if not exists expenses_category_idx on public.expenses(category);
alter table public.expenses enable row level security;

drop policy if exists "Owners and admins can read expenses" on public.expenses;
create policy "Owners and admins can read expenses" on public.expenses for select to authenticated
using (public.has_role(array['owner','admin']::public.app_role[]));

drop policy if exists "Owners and admins can create expenses" on public.expenses;
create policy "Owners and admins can create expenses" on public.expenses for insert to authenticated
with check (public.has_role(array['owner','admin']::public.app_role[]) and (created_by is null or created_by = auth.uid()));

drop policy if exists "Owners and admins can update expenses" on public.expenses;
create policy "Owners and admins can update expenses" on public.expenses for update to authenticated
using (public.has_role(array['owner','admin']::public.app_role[]))
with check (public.has_role(array['owner','admin']::public.app_role[]));

drop policy if exists "Owners and admins can delete expenses" on public.expenses;
create policy "Owners and admins can delete expenses" on public.expenses for delete to authenticated
using (public.has_role(array['owner','admin']::public.app_role[]));

create or replace function public.set_expenses_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at before update on public.expenses
for each row execute function public.set_expenses_updated_at();
