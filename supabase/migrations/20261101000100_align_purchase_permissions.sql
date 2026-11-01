-- Align purchase RPC permissions with the UI and RLS.
drop policy if exists purchases_staff_manage on public.purchases;
create policy purchases_staff_manage on public.purchases for all to authenticated
using (public.has_role(array['owner','admin','sales']::public.app_role[]))
with check (public.has_role(array['owner','admin','sales']::public.app_role[]));
drop policy if exists purchase_items_staff_manage on public.purchase_items;
create policy purchase_items_staff_manage on public.purchase_items for all to authenticated
using (public.has_role(array['owner','admin','sales']::public.app_role[]))
with check (public.has_role(array['owner','admin','sales']::public.app_role[]));
drop policy if exists suppliers_staff_manage on public.suppliers;
create policy suppliers_staff_manage on public.suppliers for all to authenticated
using (public.has_role(array['owner','admin','sales']::public.app_role[]))
with check (public.has_role(array['owner','admin','sales']::public.app_role[]));

create or replace function public.create_purchase_with_items(p_purchase_date date,p_supplier text,p_reference text,p_payment_method text,p_notes text,p_receipt_url text,p_items jsonb)
returns uuid language plpgsql set search_path=public as $function$
declare v_purchase_id uuid;v_fm_id uuid;v_item jsonb;v_product_id uuid;v_qty integer;v_cost numeric;v_total numeric:=0;v_key text;
begin
 if auth.uid() is null or not public.has_role(array['owner','admin','sales']::public.app_role[]) then raise exception 'No tienes permisos para registrar compras.'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Agrega al menos un producto.'; end if;
 if p_purchase_date is null then raise exception 'La fecha de compra es obligatoria.'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::integer;v_cost:=(v_item->>'unit_cost')::numeric;
  if v_qty is null or v_qty<=0 or v_cost is null or v_cost<0 then raise exception 'Cantidad o costo inválido.'; end if;
  v_product_id:=(v_item->>'product_id')::uuid;
  if not exists(select 1 from public.products where id=v_product_id and active=true) then raise exception 'Producto no disponible.'; end if;
  v_total:=v_total+(v_qty*v_cost);
 end loop;
 v_key:='purchase-'||gen_random_uuid()::text;
 insert into public.financial_movements(movement_date,direction,amount,payment_channel,description,source,source_key,source_message,created_by)
 values(p_purchase_date,'expense',v_total,'bank_transfer','Compra a proveedor: '||coalesce(nullif(p_supplier,''),'No especificado'),'manual',v_key,coalesce(p_notes,''),auth.uid()) returning id into v_fm_id;
 insert into public.purchases(purchase_date,supplier,reference,status,payment_method,subtotal,total,financial_movement_id,receipt_url,notes,created_by)
 values(p_purchase_date,nullif(p_supplier,''),coalesce(nullif(p_reference,''),v_key),'in_transit',p_payment_method,v_total,v_total,v_fm_id,nullif(p_receipt_url,''),p_notes,auth.uid()) returning id into v_purchase_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_product_id:=(v_item->>'product_id')::uuid;v_qty:=(v_item->>'quantity')::integer;v_cost:=(v_item->>'unit_cost')::numeric;
  insert into public.purchase_items(purchase_id,product_id,quantity,unit_cost) values(v_purchase_id,v_product_id,v_qty,v_cost);
  update public.products set pending_stock_quantity=pending_stock_quantity+v_qty,updated_at=now() where id=v_product_id;
 end loop;
 return v_purchase_id;
end;$function$;

create or replace function public.receive_purchase_item(p_purchase_item_id uuid,p_quantity integer)
returns void language plpgsql security definer set search_path=public as $function$
declare v_item public.purchase_items%rowtype;
begin
 if auth.uid() is null or not public.has_role(array['owner','admin','sales','cashier']::public.app_role[]) then raise exception 'No tienes permisos para recibir compras.'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'La cantidad debe ser mayor que cero.'; end if;
 select * into v_item from public.purchase_items where id=p_purchase_item_id for update;
 if not found then raise exception 'No se encontró el producto de la compra.'; end if;
 if v_item.received_quantity+p_quantity>v_item.quantity then raise exception 'La cantidad supera lo pendiente de recibir.'; end if;
 update public.products set stock_quantity=stock_quantity+p_quantity,pending_stock_quantity=greatest(0,pending_stock_quantity-p_quantity),updated_at=now() where id=v_item.product_id;
 update public.purchase_items set received_quantity=received_quantity+p_quantity where id=p_purchase_item_id;
 insert into public.inventory_movements(product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,notes,created_by)
 values(v_item.product_id,'purchase_received',p_quantity,v_item.unit_cost,'purchase',v_item.purchase_id,'Recepción de compra',auth.uid());
 update public.purchases p set status=case
  when not exists(select 1 from public.purchase_items i where i.purchase_id=p.id and i.received_quantity<i.quantity) then 'received'
  when exists(select 1 from public.purchase_items i where i.purchase_id=p.id and i.received_quantity>0) then 'partially_received'
  else 'in_transit' end,updated_at=now() where p.id=v_item.purchase_id;
end;$function$;
revoke all on function public.receive_purchase_item(uuid,integer) from public,anon;
grant execute on function public.receive_purchase_item(uuid,integer) to authenticated;
