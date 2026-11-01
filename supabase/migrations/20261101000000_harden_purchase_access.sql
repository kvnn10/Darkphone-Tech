-- Restrict purchase data and supplier maintenance to active purchasing staff.
drop policy if exists purchases_authenticated_all on public.purchases;
create policy purchases_staff_manage on public.purchases for all to authenticated
using (public.has_role(array['owner','admin','cashier']::public.app_role[]))
with check (public.has_role(array['owner','admin','cashier']::public.app_role[]));

drop policy if exists purchase_items_authenticated_all on public.purchase_items;
create policy purchase_items_staff_manage on public.purchase_items for all to authenticated
using (public.has_role(array['owner','admin','cashier']::public.app_role[]))
with check (public.has_role(array['owner','admin','cashier']::public.app_role[]));

drop policy if exists "Authenticated users can manage suppliers" on public.suppliers;
create policy suppliers_staff_manage on public.suppliers for all to authenticated
using (public.has_role(array['owner','admin','cashier']::public.app_role[]))
with check (public.has_role(array['owner','admin','cashier']::public.app_role[]));

create or replace function public.receive_pending_inventory_units(p_product_id uuid,p_quantity integer)
returns void language plpgsql set search_path=public as $function$
declare v_cost numeric;
begin
 if auth.uid() is null or not public.has_role(array['owner','admin','cashier']::public.app_role[]) then
  raise exception 'No tienes permisos para registrar recepciones de inventario.';
 end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'La cantidad debe ser mayor que cero.'; end if;
 update public.products set stock_quantity=stock_quantity+p_quantity,pending_stock_quantity=pending_stock_quantity-p_quantity,updated_at=now()
 where id=p_product_id and pending_stock_quantity>=p_quantity returning cost_price into v_cost;
 if not found then raise exception 'La cantidad supera las unidades pendientes o el producto no existe.'; end if;
 insert into public.inventory_movements(product_id,movement_type,quantity_delta,unit_cost,notes,created_by)
 values(p_product_id,'purchase_received',p_quantity,v_cost,'Recepción de unidades pendientes',auth.uid());
end;$function$;

revoke all on function public.receive_pending_inventory_units(uuid,integer) from public,anon;
grant execute on function public.receive_pending_inventory_units(uuid,integer) to authenticated;
revoke all on function public.guard_technician_product_update() from public,anon;
revoke all on function public.set_expenses_updated_at() from public,anon;
