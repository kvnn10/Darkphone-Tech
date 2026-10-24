insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('service-order-evidence','service-order-evidence',false,31457280,array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.service_order_evidence (
 id uuid primary key default gen_random_uuid(),
 service_order_id uuid not null references public.service_orders(id) on delete cascade,
 storage_path text not null unique,
 file_name text not null,
 mime_type text not null,
 file_size bigint not null check(file_size>0),
 category text not null default 'initial' check(category in ('initial','diagnosis','repair','delivery')),
 notes text,
 uploaded_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
alter table public.service_order_evidence enable row level security;
create policy "Active users read service order evidence" on public.service_order_evidence for select to authenticated using(public.is_active_user());
create policy "Technicians manage service order evidence" on public.service_order_evidence for all to authenticated using(public.is_active_user() and public.has_role(array['owner','admin','technician']::public.app_role[])) with check(public.is_active_user() and public.has_role(array['owner','admin','technician']::public.app_role[]));
grant select,insert,update,delete on public.service_order_evidence to authenticated;
create policy "Active staff read service evidence files" on storage.objects for select to authenticated using(bucket_id='service-order-evidence' and public.is_active_user() and exists(select 1 from public.service_orders so where so.id::text=(storage.foldername(name))[1]));
create policy "Technicians upload service evidence files" on storage.objects for insert to authenticated with check(bucket_id='service-order-evidence' and public.is_active_user() and public.has_role(array['owner','admin','technician']::public.app_role[]) and exists(select 1 from public.service_orders so where so.id::text=(storage.foldername(name))[1]));
create policy "Technicians delete service evidence files" on storage.objects for delete to authenticated using(bucket_id='service-order-evidence' and public.is_active_user() and public.has_role(array['owner','admin','technician']::public.app_role[]) and exists(select 1 from public.service_orders so where so.id::text=(storage.foldername(name))[1]));