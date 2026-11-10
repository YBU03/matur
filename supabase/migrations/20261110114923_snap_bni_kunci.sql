-- Kunci RSA + sertifikat X.509 Matoer untuk BNI Direct API (sandbox). Private key hanya di Vault; tabel hanya menyimpan bagian publik.
create table if not exists snap_sandbox_internal.bni_kunci (
 id boolean primary key default true check (id),
 secret_id uuid not null references vault.secrets(id),
 public_pem text not null,
 sertifikat text not null,
 dibuat_at timestamptz not null default now(),
 dibuat_oleh uuid
);
alter table snap_sandbox_internal.bni_kunci enable row level security;
revoke all on snap_sandbox_internal.bni_kunci from public, anon, authenticated;

-- Hanya server (Edge Function, service_role): simpan kunci baru / ambil private key untuk menandatangani.
create or replace function public.snap_bni_kunci_service(p_action text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k snap_sandbox_internal.bni_kunci; sid uuid; s text;
begin
 if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Server only'; end if;
 if p_action = 'simpan' then
  if coalesce(length(p_data->>'private'), 0) < 1000 or coalesce(length(p_data->>'sertifikat'), 0) < 500 or coalesce(length(p_data->>'public'), 0) < 300 then raise exception 'Kunci tidak lengkap'; end if;
  perform pg_advisory_xact_lock(hashtext('matoer-bni-kunci'));
  select * into k from snap_sandbox_internal.bni_kunci where id for update;
  if k.id is not null and coalesce((p_data->>'ganti')::boolean, false) is false then raise exception 'Kunci BNI sudah ada. Pilih ganti untuk membuat yang baru.'; end if;
  if k.id is null then
   select vault.create_secret(p_data->>'private', 'matoer-bni-sandbox-private-' || gen_random_uuid()::text, 'Private key Matoer untuk BNI Direct API sandbox') into sid;
  else
   sid := k.secret_id;
   perform vault.update_secret(sid, p_data->>'private');
  end if;
  insert into snap_sandbox_internal.bni_kunci(id, secret_id, public_pem, sertifikat, dibuat_at, dibuat_oleh)
  values (true, sid, p_data->>'public', p_data->>'sertifikat', now(), nullif(p_data->>'oleh', '')::uuid)
  on conflict (id) do update set public_pem = excluded.public_pem, sertifikat = excluded.sertifikat, dibuat_at = now(), dibuat_oleh = excluded.dibuat_oleh;
  insert into public.log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru)
  values (nullif(p_data->>'oleh', '')::uuid, case when k.id is null then 'buat_kunci_bni' else 'ganti_kunci_bni' end, 'snap_sandbox', 'bni_kunci', jsonb_build_object('sertifikat_diganti', k.id is not null));
  return jsonb_build_object('sertifikat', p_data->>'sertifikat');
 elsif p_action = 'private' then
  select v.decrypted_secret into s from vault.decrypted_secrets v join snap_sandbox_internal.bni_kunci b on b.secret_id = v.id where b.id;
  if s is null then raise exception 'Kunci BNI belum dibuat'; end if;
  return jsonb_build_object('private', s);
 end if;
 raise exception 'Aksi tidak dikenal';
end $$;
revoke all on function public.snap_bni_kunci_service(text, jsonb) from public, anon, authenticated;
grant execute on function public.snap_bni_kunci_service(text, jsonb) to service_role;

-- Owner/Admin Pusat/Finance: lihat sertifikat (publik) dan waktu dibuat.
create or replace function public.snap_bni_kunci_info() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare k snap_sandbox_internal.bni_kunci;
begin
 if not snap_sandbox_internal.boleh_admin() then raise exception 'Hanya Owner, Admin Pusat atau Finance aktif'; end if;
 select * into k from snap_sandbox_internal.bni_kunci where id;
 if k.id is null then return jsonb_build_object('ada', false); end if;
 return jsonb_build_object('ada', true, 'sertifikat', k.sertifikat, 'public_pem', k.public_pem, 'dibuat_at', k.dibuat_at);
end $$;
revoke all on function public.snap_bni_kunci_info() from public, anon;
grant execute on function public.snap_bni_kunci_info() to authenticated;
