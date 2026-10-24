-- Darkphone Tech: service parts and transactional stock consumption
alter table public.service_orders
  add column if not exists approval_status text not null default 'not_required'
  check (approval_status in ('not_required','pending','approved','rejected'));

create table if not exists public.service_order_parts (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.service_order_parts enable row level security;
create policy "Active users read service order parts"
  on public.service_order_parts for select to authenticated
  using (public.is_active_user());
create policy "Technicians manage service order parts"
  on public.service_order_parts for all to authenticated
  using (public.has_role(array['owner','admin','technician']::public.app_role[]))
  with check (public.has_role(array['owner','admin','technician']::public.app_role[]));
grant select,insert,update,delete on public.service_order_parts to authenticated;

create or replace function public.consume_service_part(
  p_service_order_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_order public.service_orders%rowtype;
  v_unit_cost numeric(14,2);
  v_part_id uuid;
begin
  if not public.has_role(array['owner','admin','technician']::public.app_role[]) then
    raise exception 'No tienes permisos para descontar repuestos.';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;

  select * into v_order from public.service_orders where id=p_service_order_id for update;
  if not found then raise exception 'No se encontró la orden de servicio.'; end if;
  if v_order.status in ('delivered','cancelled') then
    raise exception 'No puedes agregar repuestos a una orden cerrada.';
  end if;

  select * into v_product from public.products where id=p_product_id and active=true for update;
  if not found then raise exception 'No se encontró el repuesto activo.'; end if;
  if v_product.stock_quantity < p_quantity then
    raise exception 'Existencias insuficientes. Disponibles: %.', v_product.stock_quantity;
  end if;

  v_unit_cost := coalesce(v_product.cost_price,0);
  update public.products set stock_quantity=stock_quantity-p_quantity, updated_at=now() where id=p_product_id;

  insert into public.service_order_parts(service_order_id,product_id,quantity,unit_cost,created_by)
  values(p_service_order_id,p_product_id,p_quantity,v_unit_cost,auth.uid())
  returning id into v_part_id;

  insert into public.inventory_movements(product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,notes,created_by)
  values(p_product_id,'service_use',-p_quantity,v_unit_cost,'service_order',p_service_order_id,
    coalesce(p_notes,'Repuesto utilizado en orden #'||v_order.order_number),auth.uid());

  update public.service_orders
  set parts_cost=coalesce((select sum(quantity*unit_cost) from public.service_order_parts where service_order_id=p_service_order_id),0),
      updated_at=now()
  where id=p_service_order_id;

  insert into public.audit_log(actor_id,action,entity,entity_id,details)
  values(auth.uid(),'consume_part','service_order',p_service_order_id::text,
    jsonb_build_object('part_id',v_part_id,'product_id',p_product_id,'quantity',p_quantity,'unit_cost',v_unit_cost));

  return jsonb_build_object('part_id',v_part_id,'unit_cost',v_unit_cost,'stock_remaining',v_product.stock_quantity-p_quantity);
end;
$$;


-- Technicians may adjust stock only through the guarded service-part workflow.
create policy "Technicians update stock for service"
  on public.products for update to authenticated
  using (public.has_role(array['owner','admin','technician']::public.app_role[]))
  with check (public.has_role(array['owner','admin','technician']::public.app_role[]));

create policy "Technicians record service inventory movements"
  on public.inventory_movements for insert to authenticated
  with check (
    public.has_role(array['owner','admin','technician']::public.app_role[])
    and movement_type='service_use'
  );

create or replace function public.guard_technician_product_update()
returns trigger language plpgsql
set search_path = public
as $guard$
begin
  if public.has_role(array['technician']::public.app_role[])
     and not public.has_role(array['owner','admin','sales']::public.app_role[]) then
    if new.name is distinct from old.name
       or new.brand is distinct from old.brand
       or new.model is distinct from old.model
       or new.sku is distinct from old.sku
       or new.category is distinct from old.category
       or new.cost_price is distinct from old.cost_price
       or new.selling_price is distinct from old.selling_price
       or new.min_stock is distinct from old.min_stock
       or new.has_imei is distinct from old.has_imei
       or new.active is distinct from old.active
       or new.notes is distinct from old.notes
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'El rol técnico solo puede actualizar existencias mediante una orden de servicio.';
    end if;
  end if;
  return new;
end;
$guard$;

drop trigger if exists guard_technician_product_update on public.products;
create trigger guard_technician_product_update
before update on public.products
for each row execute function public.guard_technician_product_update();

revoke all on function public.consume_service_part(uuid,uuid,integer,text) from public, anon;
grant execute on function public.consume_service_part(uuid,uuid,integer,text) to authenticated;
