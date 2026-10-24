create table if not exists public.collaborators (
 id uuid primary key default gen_random_uuid(),
 full_name text not null check (length(trim(full_name)) > 0),
 document_type text, document_number text, phone text, email text,
 service_area text not null default 'Otros servicios',
 payment_frequency text not null default 'variable' check (payment_frequency in ('per_service','weekly','biweekly','monthly','variable')),
 default_rate numeric(14,2) not null default 0 check (default_rate >= 0),
 notes text, active boolean not null default true,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists collaborators_document_unique on public.collaborators(document_type,document_number) where document_number is not null and document_number<>'';
create table if not exists public.collaborator_services (
 id uuid primary key default gen_random_uuid(),
 collaborator_id uuid not null references public.collaborators(id) on delete restrict,
 title text not null check(length(trim(title))>0), description text,
 amount numeric(14,2) not null check(amount>0), service_date date not null default current_date,
 due_date date, status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 support_reference text, approved_by uuid references public.profiles(id), approved_at timestamptz,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(due_date is null or due_date>=service_date)
);
create index if not exists collaborator_services_collaborator_date_idx on public.collaborator_services(collaborator_id,service_date desc);
create index if not exists collaborator_services_status_due_idx on public.collaborator_services(status,due_date);
create table if not exists public.collaborator_payments (
 id uuid primary key default gen_random_uuid(), collaborator_id uuid not null references public.collaborators(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0), payment_method public.payment_method not null,
 paid_at date not null default current_date, reference text, notes text, cash_session_id uuid references public.cash_sessions(id),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 voided_at timestamptz, voided_by uuid references public.profiles(id), void_reason text
);
create index if not exists collaborator_payments_collaborator_date_idx on public.collaborator_payments(collaborator_id,paid_at desc);
create table if not exists public.collaborator_payment_allocations (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.collaborator_payments(id) on delete restrict,
 service_id uuid not null references public.collaborator_services(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0), created_at timestamptz not null default now(), unique(payment_id,service_id)
);
create index if not exists collaborator_allocations_service_idx on public.collaborator_payment_allocations(service_id);
alter table public.expenses add column if not exists collaborator_payment_id uuid unique references public.collaborator_payments(id) on delete restrict;
alter table public.cash_movements add column if not exists collaborator_payment_id uuid unique references public.collaborator_payments(id) on delete restrict;
alter table public.collaborators enable row level security;
alter table public.collaborator_services enable row level security;
alter table public.collaborator_payments enable row level security;
alter table public.collaborator_payment_allocations enable row level security;
drop policy if exists "Active users read collaborators" on public.collaborators;
create policy "Active users read collaborators" on public.collaborators for select to authenticated using(public.is_active_user());
drop policy if exists "Managers manage collaborators" on public.collaborators;
create policy "Managers manage collaborators" on public.collaborators for all to authenticated using(public.is_active_user() and public.has_role(array['owner','admin']::public.app_role[])) with check(public.is_active_user() and public.has_role(array['owner','admin']::public.app_role[]));
drop policy if exists "Active users read collaborator services" on public.collaborator_services;
create policy "Active users read collaborator services" on public.collaborator_services for select to authenticated using(public.is_active_user());
drop policy if exists "Staff manage collaborator services" on public.collaborator_services;
create policy "Staff manage collaborator services" on public.collaborator_services for all to authenticated using(public.is_active_user() and public.has_role(array['owner','admin','technician']::public.app_role[])) with check(public.is_active_user() and public.has_role(array['owner','admin','technician']::public.app_role[]));
drop policy if exists "Active users read collaborator payments" on public.collaborator_payments;
create policy "Active users read collaborator payments" on public.collaborator_payments for select to authenticated using(public.is_active_user());
drop policy if exists "Managers record collaborator payments" on public.collaborator_payments;
create policy "Managers record collaborator payments" on public.collaborator_payments for insert to authenticated with check(public.is_active_user() and public.has_role(array['owner','admin','cashier']::public.app_role[]));
drop policy if exists "Active users read collaborator allocations" on public.collaborator_payment_allocations;
create policy "Active users read collaborator allocations" on public.collaborator_payment_allocations for select to authenticated using(public.is_active_user());
grant select,insert,update,delete on public.collaborators,public.collaborator_services to authenticated;
grant select,insert on public.collaborator_payments to authenticated;
grant select on public.collaborator_payment_allocations to authenticated;
create or replace function public.audit_collaborator_changes()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_id text; v_details jsonb;
begin
 if TG_OP='DELETE' then v_id:=old.id::text;v_details:=jsonb_build_object('old',to_jsonb(old));
 elsif TG_OP='UPDATE' then v_id:=new.id::text;v_details:=jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new));
 else v_id:=new.id::text;v_details:=jsonb_build_object('new',to_jsonb(new));end if;
 insert into public.audit_log(actor_id,action,entity,entity_id,details) values(auth.uid(),lower(TG_OP),TG_TABLE_NAME,v_id,v_details);
 if TG_OP='DELETE' then return old;else return new;end if;
end $$;
drop trigger if exists audit_collaborators_changes on public.collaborators;
create trigger audit_collaborators_changes after insert or update or delete on public.collaborators for each row execute function public.audit_collaborator_changes();
drop trigger if exists audit_collaborator_services_changes on public.collaborator_services;
create trigger audit_collaborator_services_changes after insert or update or delete on public.collaborator_services for each row execute function public.audit_collaborator_changes();
drop trigger if exists audit_collaborator_payments_changes on public.collaborator_payments;
create trigger audit_collaborator_payments_changes after insert or update or delete on public.collaborator_payments for each row execute function public.audit_collaborator_changes();
drop trigger if exists audit_collaborator_allocations_changes on public.collaborator_payment_allocations;
create trigger audit_collaborator_allocations_changes after insert or update or delete on public.collaborator_payment_allocations for each row execute function public.audit_collaborator_changes();
create or replace function public.register_collaborator_payment(p_collaborator_id uuid,p_service_id uuid,p_amount numeric,p_method text,p_paid_at date default current_date,p_reference text default null,p_notes text default null,p_cash_session_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_payment_id uuid;v_service public.collaborator_services%rowtype;v_collaborator public.collaborators%rowtype;v_paid numeric(14,2);v_session uuid;v_method public.payment_method;
begin
 if v_user is null or not public.is_active_user() or not public.has_role(array['owner','admin','cashier']::public.app_role[]) then raise exception 'No tienes permisos para registrar pagos a colaboradores.';end if;
 if p_amount is null or p_amount<=0 then raise exception 'El valor del pago debe ser mayor que cero.';end if;
 begin v_method:=p_method::public.payment_method;exception when others then raise exception 'Medio de pago no válido.';end;
 select * into v_collaborator from public.collaborators where id=p_collaborator_id and active=true;
 if not found then raise exception 'El colaborador no existe o está inactivo.';end if;
 select * into v_service from public.collaborator_services where id=p_service_id and collaborator_id=p_collaborator_id for update;
 if not found then raise exception 'El servicio no corresponde a este colaborador.';end if;
 if v_service.status<>'approved' then raise exception 'Solo se pueden pagar servicios aprobados.';end if;
 select coalesce(sum(a.amount),0) into v_paid from public.collaborator_payment_allocations a join public.collaborator_payments p on p.id=a.payment_id where a.service_id=p_service_id and p.voided_at is null;
 if p_amount>v_service.amount-v_paid then raise exception 'El pago supera el saldo pendiente del servicio (%).',greatest(v_service.amount-v_paid,0);end if;
 if v_method='cash' then
  if p_cash_session_id is null then raise exception 'Para pagar en efectivo debes seleccionar una caja abierta.';end if;
  select id into v_session from public.cash_sessions where id=p_cash_session_id and closed_at is null for update;
  if v_session is null then raise exception 'La caja seleccionada no está abierta.';end if;
 else v_session:=null;end if;
 insert into public.collaborator_payments(collaborator_id,amount,payment_method,paid_at,reference,notes,cash_session_id,created_by) values(p_collaborator_id,p_amount,v_method,coalesce(p_paid_at,current_date),nullif(trim(p_reference),''),nullif(trim(p_notes),''),v_session,v_user) returning id into v_payment_id;
 insert into public.collaborator_payment_allocations(payment_id,service_id,amount) values(v_payment_id,p_service_id,p_amount);
 insert into public.expenses(cash_session_id,category,concept,amount,payment_method,receipt_number,notes,created_by,expense_date,responsible,collaborator_payment_id)
 values(v_session,'Servicios de colaboradores','Pago a colaborador: '||v_collaborator.full_name,p_amount,v_method,nullif(trim(p_reference),''),nullif(trim(p_notes),''),v_user,coalesce(p_paid_at,current_date),v_collaborator.full_name,v_payment_id);
 if v_method='cash' then insert into public.cash_movements(cash_session_id,kind,amount,category,description,reference,created_by,collaborator_payment_id)
 values(v_session,'expense',p_amount,'Servicios de colaboradores','Pago a colaborador: '||v_collaborator.full_name,coalesce(nullif(trim(p_reference),''),v_payment_id::text),v_user,v_payment_id);end if;
 return v_payment_id;
end $$;
revoke all on function public.register_collaborator_payment(uuid,uuid,numeric,text,date,text,text,uuid) from public;
grant execute on function public.register_collaborator_payment(uuid,uuid,numeric,text,date,text,text,uuid) to authenticated;
