-- Inbox uji notifikasi QRIS dari simulator BNI (sandbox). Tanpa data pribadi pelanggan; maksimal 200 baris. Dijalankan pemilik via SQL Editor 10 Nov 2026.
create table if not exists snap_sandbox_internal.bni_notif (
 id bigint generated always as identity primary key,
 diterima_at timestamptz not null default now(),
 external_id text,
 reference_no text,
 partner_reference_no text,
 status text,
 status_desc text,
 amount text,
 bill_number text,
 header_lengkap boolean not null default false,
 body_hash text
);
alter table snap_sandbox_internal.bni_notif enable row level security;
revoke all on snap_sandbox_internal.bni_notif from public, anon, authenticated;

create or replace function public.snap_bni_notif_service(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Server only'; end if;
 insert into snap_sandbox_internal.bni_notif(external_id, reference_no, partner_reference_no, status, status_desc, amount, bill_number, header_lengkap, body_hash)
 values (left(p_data->>'external_id', 64), left(p_data->>'reference_no', 120), left(p_data->>'partner_reference_no', 120), left(p_data->>'status', 10), left(p_data->>'status_desc', 120), left(p_data->>'amount', 30), left(p_data->>'bill_number', 64), coalesce((p_data->>'header_lengkap')::boolean, false), left(p_data->>'body_hash', 64));
 delete from snap_sandbox_internal.bni_notif where id not in (select id from snap_sandbox_internal.bni_notif order by id desc limit 200);
 return jsonb_build_object('ok', true);
end $$;
revoke all on function public.snap_bni_notif_service(jsonb) from public, anon, authenticated;
grant execute on function public.snap_bni_notif_service(jsonb) to service_role;

create or replace function public.snap_bni_kunci_info() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare k snap_sandbox_internal.bni_kunci; o snap_sandbox_internal.bni_oauth;
begin
 if not snap_sandbox_internal.boleh_admin() then raise exception 'Hanya Owner, Admin Pusat atau Finance aktif'; end if;
 select * into k from snap_sandbox_internal.bni_kunci where id;
 select * into o from snap_sandbox_internal.bni_oauth where id;
 return jsonb_build_object('ada', k.id is not null, 'sertifikat', k.sertifikat, 'public_pem', k.public_pem, 'dibuat_at', k.dibuat_at,
  'oauth', jsonb_build_object('ada', o.id is not null, 'client_id', o.client_id, 'diubah_at', o.diubah_at),
  'notif', coalesce((select jsonb_agg(to_jsonb(n) - 'body_hash' order by n.id desc) from (select * from snap_sandbox_internal.bni_notif order by id desc limit 10) n), '[]'::jsonb));
end $$;
