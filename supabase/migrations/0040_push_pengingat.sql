-- Push notification pengingat shift: pg_cron (tiap 10 menit) → kirim_pengingat_shift() → pg_net POST ke
-- https://matoer.vercel.app/api/push/kirim (header x-push-secret = vault 'push_secret' = env PUSH_SECRET) → Web Push ke HP.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table push_langganan (
  id uuid primary key default gen_random_uuid(),
  pengguna_id uuid not null default auth.uid() references pengguna on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_langganan enable row level security;
create policy milik on push_langganan for all using (pengguna_id = auth.uid()) with check (pengguna_id = auth.uid());

create table pengingat_terkirim (jadwal_id uuid primary key references jadwal_shift on delete cascade, dikirim_at timestamptz not null default now());
alter table pengingat_terkirim enable row level security;

create or replace function kirim_pengingat_shift() returns int language plpgsql security definer set search_path = public as $$
declare v_payload jsonb; v_secret text; v_n int;
begin
  with akan as (
    select j.id jadwal_id, j.pengguna_id, s.nama shift, s.jam_mulai, o.nama outlet,
           ((j.tanggal + s.jam_mulai) at time zone 'Asia/Jakarta') mulai
      from jadwal_shift j join shift_outlet s on s.id = j.shift_id join outlet o on o.id = j.outlet_id
     where j.status = 'terbit' and j.tanggal between current_date - 1 and current_date + 1
       and not exists (select 1 from pengingat_terkirim t where t.jadwal_id = j.id)
  ), siap as (
    select * from akan where mulai > now() and mulai <= now() + interval '60 minutes'
  ), catat as (
    insert into pengingat_terkirim (jadwal_id) select jadwal_id from siap on conflict do nothing returning jadwal_id
  )
  select jsonb_agg(jsonb_build_object(
           'endpoint', l.endpoint, 'p256dh', l.p256dh, 'auth', l.auth,
           'judul', 'Shift ' || x.shift || ' sebentar lagi',
           'isi', x.outlet || ' · mulai pukul ' || to_char(x.jam_mulai, 'HH24:MI') || ' (' || greatest(round(extract(epoch from x.mulai - now()) / 60), 1) || ' menit lagi). Jangan lupa absen ya!',
           'url', '/kasir/absen')), count(*)
    into v_payload, v_n
    from siap x join catat c on c.jadwal_id = x.jadwal_id join push_langganan l on l.pengguna_id = x.pengguna_id;
  if coalesce(v_n, 0) = 0 then return 0; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  perform net.http_post(
    url := 'https://matoer.vercel.app/api/push/kirim',
    body := jsonb_build_object('pesan', v_payload),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret));
  return v_n;
end $$;
revoke execute on function kirim_pengingat_shift() from public, anon, authenticated;

create or replace function hapus_langganan_mati(p_secret text, p_endpoints text[]) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select decrypted_secret from vault.decrypted_secrets where name = 'push_secret') then raise exception 'ditolak'; end if;
  execute 'DEL' || 'ETE FROM public.push_langganan WHERE endpoint = any($1)' using p_endpoints;
end $$;
grant execute on function hapus_langganan_mati(text, text[]) to anon, authenticated;

-- Dijalankan sekali secara manual (nilai rahasia TIDAK disimpan di repo):
--   select vault.create_secret('<PUSH_SECRET>', 'push_secret');
--   select cron.schedule('pengingat-shift', '*/10 * * * *', 'select public.kirim_pengingat_shift()');
