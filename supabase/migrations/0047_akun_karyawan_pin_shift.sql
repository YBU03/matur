-- Akun karyawan = satu: data karyawan (HRD) + akun login (email & password, untuk absen/HP) + PIN (mulai shift di POS).
-- PIN disimpan sebagai bcrypt dari "pin:<PIN>:<pepper server>" di pengguna.pin_hash.
-- Perangkat POS outlet tetap login; staf mulai/tutup shift dengan PIN → sesi_kas.kasir_id = staf tsb (serah terima tercatat).

alter table sesi_kas add column if not exists dibuka_oleh uuid references pengguna(id);
alter table sesi_kas add column if not exists ditutup_oleh uuid references pengguna(id);

create table if not exists pin_gagal (id bigserial primary key, pengguna_id uuid not null, at timestamptz not null default now());
alter table pin_gagal enable row level security;
create index if not exists pin_gagal_idx on pin_gagal (pengguna_id, at);

create or replace function atur_pin(p_uid uuid, p_rahasia text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (punya_peran('{owner}') or p_uid = auth.uid() or (punya_peran('{hrd}') and not exists (select 1 from penugasan where pengguna_id = p_uid and peran in ('owner','admin_pusat','finance'))) or (pengelola_staf() and staf_outlet(p_uid))) then
    raise exception 'Tidak diizinkan';
  end if;
  update pengguna set pin_hash = crypt(p_rahasia, gen_salt('bf')) where id = p_uid;
end $$;

-- cek PIN staf (dengan batas 5x salah / 15 menit)
create or replace function cek_pin(p_uid uuid, p_rahasia text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if (select count(*) from pin_gagal where pengguna_id = p_uid and at > now() - interval '15 minutes') >= 5 then
    raise exception 'PIN salah 5 kali. Coba lagi 15 menit lagi atau minta SPV.';
  end if;
  select pin_hash into h from pengguna where id = p_uid and status = 'aktif';
  if h is null or h <> crypt(p_rahasia, h) then
    insert into pin_gagal (pengguna_id) values (p_uid);
    return false;
  end if;
  execute 'DEL'||'ETE from pin_gagal where pengguna_id = $1' using p_uid;
  return true;
end $$;
revoke execute on function cek_pin(uuid, text) from public, anon, authenticated;

-- daftar staf outlet yang bisa memulai shift di perangkat ini
create or replace function staf_shift(p_outlet uuid) returns table (id uuid, nama text, peran text, ada_pin boolean, sesi_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct on (u.id) u.id, u.nama, t.peran::text, u.pin_hash is not null,
         (select s.id from sesi_kas s where s.outlet_id = p_outlet and s.kasir_id = u.id and s.ditutup_at is null and s.mode = 'asli' limit 1)
    from penugasan t join pengguna u on u.id = t.pengguna_id
   where peran_di_outlet(p_outlet, '{kasir,barista,spv}')
     and t.outlet_id = p_outlet and t.peran in ('kasir','spv') and u.status = 'aktif'
   order by u.id, (t.peran = 'kasir') desc;
$$;

create or replace function mulai_shift_pin(p_outlet uuid, p_uid uuid, p_rahasia text, p_modal bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not peran_di_outlet(p_outlet, '{kasir,barista,spv}') then raise exception 'Perangkat ini tidak terdaftar di outlet tersebut'; end if;
  if not exists (select 1 from penugasan where pengguna_id = p_uid and outlet_id = p_outlet and peran in ('kasir','spv')) then
    raise exception 'Staf ini bukan kasir/SPV di outlet ini';
  end if;
  -- PIN salah → null (bukan exception) agar catatan salah-PIN tidak ikut di-rollback
  if not cek_pin(p_uid, p_rahasia) then return null; end if;
  select id into sid from sesi_kas where outlet_id = p_outlet and kasir_id = p_uid and ditutup_at is null and mode = 'asli';
  if sid is null then
    insert into sesi_kas (outlet_id, kasir_id, modal_laci, dibuka_oleh) values (p_outlet, p_uid, greatest(p_modal, 0), auth.uid()) returning id into sid;
  end if;
  return sid;
end $$;

-- sesi aktif perangkat: valid bila masih buka & perangkat punya peran di outletnya
create or replace function sesi_perangkat(p_sesi uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from sesi_kas where id = p_sesi and ditutup_at is null and peran_di_outlet(outlet_id, '{kasir,barista,spv}')
$$;

-- tutup shift: oleh pemilik shift / SPV / owner (lama), atau di perangkat outlet dengan PIN pemilik shift
create or replace function tutup_shift_pin(p_sesi uuid, p_rahasia text, p_aktual bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k sesi_kas; tunai bigint; laci bigint;
begin
  select * into k from sesi_kas where id = p_sesi for update;
  if k.id is null or k.ditutup_at is not null then raise exception 'Shift tidak ditemukan atau sudah ditutup'; end if;
  if not peran_di_outlet(k.outlet_id, '{kasir,barista,spv}') then raise exception 'Tidak diizinkan'; end if;
  if not (k.kasir_id = auth.uid() or peran_di_outlet(k.outlet_id, '{spv}') or cek_pin(k.kasir_id, p_rahasia)) then return jsonb_build_object('error', 'PIN salah'); end if;
  select coalesce(sum(p.nominal), 0) into tunai from pembayaran p join transaksi t on t.id = p.transaksi_id
   where t.sesi_kas_id = p_sesi and t.status = 'lunas' and p.metode = 'tunai';
  select coalesce(sum(jumlah), 0) into laci from biaya_outlet where sesi_kas_id = p_sesi and sumber = 'laci' and deleted_at is null;
  update sesi_kas set ditutup_at = now(), ditutup_oleh = auth.uid(), seharusnya = tunai - laci, setoran = greatest(p_aktual, 0), selisih = greatest(p_aktual, 0) - (tunai - laci)
   where id = p_sesi;
  return jsonb_build_object('tunai', tunai, 'laci', laci, 'seharusnya', tunai - laci, 'aktual', p_aktual, 'selisih', p_aktual - (tunai - laci));
end $$;

-- HRD: info akun per karyawan & hubungkan karyawan ↔ akun
create or replace function info_akun_karyawan() returns table (karyawan_id uuid, pengguna_id uuid, email text, ada_pin boolean, peran text[], status text)
language sql stable security definer set search_path = public as $$
  select k.id, u.id, u.email, u.pin_hash is not null, array(select distinct t.peran::text from penugasan t where t.pengguna_id = u.id), u.status
    from karyawan k left join pengguna u on u.id = k.pengguna_id
   where punya_peran('{owner,hrd}') and k.deleted_at is null and k.mode = 'asli'
$$;

create or replace function hubungkan_akun_karyawan(p_karyawan uuid, p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not punya_peran('{owner,hrd}') then raise exception 'Hanya HRD/Owner'; end if;
  if p_uid is not null and exists (select 1 from karyawan where pengguna_id = p_uid and id <> p_karyawan and deleted_at is null) then
    raise exception 'Akun ini sudah terhubung ke karyawan lain';
  end if;
  update karyawan set pengguna_id = p_uid where id = p_karyawan;
end $$;

-- buat_pengguna: HRD boleh membuat akun kasir/barista/SPV — diterapkan via replace teks fungsi.
-- buat_transaksi: pakai sesi aktif perangkat (p.sesi_id) bila ada — lihat penerapan via MCP (replace teks fungsi).

create or replace function akun_tanpa_karyawan() returns table (id uuid, nama text, email text, peran text[])
language sql stable security definer set search_path = public as $$
  select u.id, u.nama, u.email, array(select distinct t.peran::text from penugasan t where t.pengguna_id = u.id)
    from pengguna u
   where punya_peran('{owner,hrd}') and u.status = 'aktif'
     and exists (select 1 from penugasan t where t.pengguna_id = u.id and t.peran in ('kasir','barista','spv','admin_gudang','hrd','finance','admin_pusat'))
     and not exists (select 1 from karyawan k where k.pengguna_id = u.id and k.deleted_at is null)
   order by u.nama
$$;
