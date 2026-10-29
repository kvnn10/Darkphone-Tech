-- Keep cash sales working when the daily register has not yet been opened.
-- Carry forward the last closed session's final balance when opening automatically.
do $$
declare
  v_def text;
  v_old text := '  select id into v_session_id from public.cash_sessions where closed_at is null order by opened_at desc limit 1;';
  v_new text := $replacement$  select id into v_session_id from public.cash_sessions where closed_at is null order by opened_at desc limit 1;
  if v_session_id is null and exists(select 1 from jsonb_array_elements(p_payments) p where p.value->>'method' = 'cash' and coalesce((p.value->>'amount')::numeric,0) > 0) then
    insert into public.cash_sessions(opened_by, opening_amount, notes)
    select v_user, coalesce(counted_amount, expected_amount, 0), 'Apertura automática al registrar venta en efectivo; saldo anterior trasladado.'
    from public.cash_sessions where closed_at is not null order by closed_at desc limit 1;
    if not found then
      insert into public.cash_sessions(opened_by, opening_amount, notes)
      values(v_user, 0, 'Apertura automática al registrar venta en efectivo.');
    end if;
    select id into v_session_id from public.cash_sessions where closed_at is null order by opened_at desc limit 1;
  end if;$replacement$;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_sale';
  if v_def is null then
    raise exception 'Function public.create_sale not found';
  end if;
  if position('Apertura automática al registrar venta en efectivo' in v_def) > 0 then
    return;
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'Could not find expected cash session lookup in create_sale';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;
