-- Intake checklist fields for service orders. Existing orders remain valid.
alter table public.service_orders
  add column if not exists device_condition text,
  add column if not exists accessories text,
  add column if not exists intake_checklist jsonb not null default '{}'::jsonb;
comment on column public.service_orders.device_condition is 'Physical condition of the device recorded at intake.';
comment on column public.service_orders.accessories is 'Accessories received with the device.';
comment on column public.service_orders.intake_checklist is 'Boolean intake inspection checklist, keyed by inspection item.';
