-- DarkPhone Tech: atomic sale creation
-- Apply this migration to the active Supabase project before using Confirmar venta.
create or replace function public.create_sale(
  p_customer_id uuid,
  p_discount numeric,
  p_notes text,
  p_items jsonb,
  p_payments jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale_id uuid;
  v_sale_number bigint;
  v_session_id uuid;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := greatest(coalesce(p_discount,0),0);
  v_total numeric(14,2);
  v_paid numeric(14,2) := 0;
  v_item jsonb;
  v_payment jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_unit_price numeric(14,2);
  v_line_total numeric(14,2);
  v_serial_id uuid;
  v_serial_text text;
  v_method public.payment_method;
  v_amount numeric(14,2);
  v_user_profile uuid;
begin
  if v_user is null or not public.has_role(array['owner','admin','sales','cashier']::public.app_role[]) then
    raise exception 'No tienes permisos para registrar ventas.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto a la venta.';
  end if;
  if p_discount is null or p_discount < 0 then raise exception 'El descuento no puede ser negativo.'; end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Registra al menos un medio de pago.';
  end if;
  if p_customer_id is not null and not exists(select 1 from public.customers where id=p_customer_id) then
    raise exception 'El cliente seleccionado ya no existe.';
  end if;

  select id into v_session_id from public.cash_sessions where closed_at is null order by opened_at desc limit 1;
  if exists(select 1 from jsonb_array_elements(p_items) e where coalesce((e->>'quantity')::integer,0)<=0) then
    raise exception 'Todas las cantidades deben ser mayores que cero.';
  end if;

  -- Lock and validate each product before any write. Duplicate cart lines are not accepted.
  if exists(select 1 from (select value->>'product_id' id from jsonb_array_elements(p_items) group by value->>'product_id' having count(*)>1) d) then
    raise exception 'Hay productos duplicados en el carrito. Actualiza la venta e inténtalo de nuevo.';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and active=true for update;
    if not found then raise exception 'Uno de los productos ya no está disponible.'; end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_product.stock_quantity < v_quantity then raise exception 'Existencias insuficientes para "%". Disponible: %.',v_product.name,v_product.stock_quantity; end if;
    if v_product.has_imei then
      if jsonb_typeof(v_item->'serial_ids') <> 'array' or jsonb_array_length(v_item->'serial_ids') <> v_quantity then
        raise exception 'El producto "%" requiere un IMEI/serial disponible por unidad.',v_product.name;
      end if;
      if exists(select 1 from jsonb_array_elements_text(v_item->'serial_ids') sid left join public.product_serials ps on ps.id=sid.value::uuid where ps.id is null or ps.product_id<>v_product.id or ps.status<>'available') then
        raise exception 'Uno de los IMEI/seriales de "%" ya no está disponible.',v_product.name;
      end if;
    elsif coalesce(jsonb_array_length(coalesce(v_item->'serial_ids','[]'::jsonb)),0)>0 then
      raise exception 'No se deben enviar seriales para productos sin control individual.';
    end if;
    v_subtotal := v_subtotal + (v_product.selling_price * v_quantity);
  end loop;

  if v_discount > v_subtotal then raise exception 'El descuento no puede superar el subtotal.'; end if;
  v_total := v_subtotal - v_discount;
  if v_total <= 0 then raise exception 'El total de la venta debe ser mayor que cero.'; end if;

  for v_payment in select value from jsonb_array_elements(p_payments) loop
    v_amount := coalesce((v_payment->>'amount')::numeric,0);
    if v_amount <= 0 then raise exception 'Cada pago debe ser mayor que cero.'; end if;
    v_method := (v_payment->>'method')::public.payment_method;
    v_paid := v_paid + v_amount;
    if v_method='cash' and v_session_id is null then raise exception 'Abre la caja antes de registrar un pago en efectivo.'; end if;
  end loop;
  if abs(v_paid-v_total)>0.5 then raise exception 'Los medios de pago deben cubrir exactamente el total de la venta.'; end if;

  insert into public.sales(customer_id,cash_session_id,status,subtotal,discount,total,notes,created_by)
  values(p_customer_id,v_session_id,'completed',v_subtotal,v_discount,v_total,nullif(trim(coalesce(p_notes,'')),''),v_user)
  returning id,sale_number into v_sale_id,v_sale_number;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid for update;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := v_product.selling_price;
    v_line_total := v_unit_price*v_quantity;
    if v_product.has_imei then
      for v_serial_text in select value from jsonb_array_elements_text(v_item->'serial_ids') loop
        v_serial_id := v_serial_text::uuid;
        update public.product_serials set status='sold' where id=v_serial_id and product_id=v_product.id and status='available';
        if not found then raise exception 'No se pudo reservar un IMEI/serial de "%".',v_product.name; end if;
        insert into public.sale_items(sale_id,product_id,serial_id,quantity,unit_price,unit_cost,line_total)
        values(v_sale_id,v_product.id,v_serial_id,1,v_unit_price,v_product.cost_price,v_unit_price);
      end loop;
    else
      insert into public.sale_items(sale_id,product_id,quantity,unit_price,unit_cost,line_total)
      values(v_sale_id,v_product.id,v_quantity,v_unit_price,v_product.cost_price,v_line_total);
    end if;
    update public.products set stock_quantity=stock_quantity-v_quantity,updated_at=now() where id=v_product.id;
    insert into public.inventory_movements(product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,notes,created_by)
    values(v_product.id,'sale',-v_quantity,v_product.cost_price,'sale',v_sale_id,'Venta #'||v_sale_number,v_user);
  end loop;

  for v_payment in select value from jsonb_array_elements(p_payments) loop
    v_amount := (v_payment->>'amount')::numeric;
    v_method := (v_payment->>'method')::public.payment_method;
    insert into public.sale_payments(sale_id,method,amount,reference,received_by)
    values(v_sale_id,v_method,v_amount,nullif(trim(coalesce(v_payment->>'reference','')),''),v_user);
    if v_method='cash' then
      insert into public.cash_movements(cash_session_id,kind,amount,category,description,reference,created_by)
      values(v_session_id,'income',v_amount,'Venta','Venta #'||v_sale_number,'sale:'||v_sale_id,v_user);
    end if;
  end loop;

  insert into public.audit_log(actor_id,action,entity,entity_id,details)
  values(v_user,'create','sale',v_sale_id::text,jsonb_build_object('sale_number',v_sale_number,'subtotal',v_subtotal,'discount',v_discount,'total',v_total,'paid',v_paid));

  return jsonb_build_object('id',v_sale_id,'sale_number',v_sale_number,'subtotal',v_subtotal,'discount',v_discount,'total',v_total,'paid',v_paid,'balance',v_total-v_paid);
end;
$$;
revoke all on function public.create_sale(uuid,numeric,text,jsonb,jsonb) from public, anon;
grant execute on function public.create_sale(uuid,numeric,text,jsonb,jsonb) to authenticated;
