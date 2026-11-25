CREATE OR REPLACE FUNCTION public.setujui_pengguna(p_uid uuid, p_peran peran, p_outlet uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u pengguna;
begin
  if not punya_peran('{owner,admin_pusat}') then raise exception 'Hanya Owner/Admin Pusat'; end if;
  if p_peran = 'owner' and not punya_peran('{owner}') then raise exception 'Hanya Owner yang bisa memberi peran Owner'; end if;
  select * into u from pengguna where id = p_uid;
  if u.id is null then raise exception 'Pengguna tidak ditemukan'; end if;
  if p_peran not in ('owner','finance','hrd','admin_pusat','admin_gudang','pemantau_pos') and p_outlet is null then
    raise exception 'Peran ini wajib memilih outlet';
  end if;
  update pengguna set status = 'aktif' where id = p_uid;
  if p_peran in ('owner','finance','hrd','admin_pusat','admin_gudang') then p_outlet := null; end if;
  if not exists (select 1 from penugasan where pengguna_id = p_uid and peran = p_peran and outlet_id is not distinct from p_outlet) then
    insert into penugasan (pengguna_id, peran, outlet_id) values (p_uid, p_peran, p_outlet);
  end if;
  if p_peran = 'mitra' and not exists (select 1 from mitra where pengguna_id = p_uid) then
    insert into mitra (pengguna_id, nama, email, no_hp) values (p_uid, u.nama, u.email, u.no_hp);
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.edit_penugasan_pengguna(p_id uuid, p_sebelum jsonb, p_peran peran, p_outlet uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare lama public.penugasan;n int;
begin
 if auth.uid() is null then raise exception 'Silakan login';end if;
 if p_peran is null or p_peran='tablet' then raise exception 'Pilih peran akun pribadi';end if;
 select * into lama from public.penugasan where id=p_id;
 if lama.id is null then raise exception 'Akses tidak tersedia atau tidak diizinkan';end if;
 if lama.pengguna_id=auth.uid() or lama.peran='owner' then raise exception 'Akses sendiri dan peran Owner dilindungi';end if;
 if lama.peran::text is distinct from p_sebelum->>'peran' or lama.outlet_id is distinct from (p_sebelum->>'outlet_id')::uuid then raise exception 'Akses sudah berubah. Muat ulang sebelum mengedit';end if;
 if p_peran in ('owner','finance','hrd','admin_pusat','admin_gudang') then
  if p_outlet is not null then raise exception 'Peran pusat memakai semua outlet';end if;
 elsif p_peran<>'pemantau_pos' and p_outlet is null then raise exception 'Pilih outlet untuk peran ini';end if;
 if p_outlet is not null and not exists(select 1 from outlet where id=p_outlet and mode='asli' and deleted_at is null) then raise exception 'Outlet tidak tersedia';end if;
 perform pg_advisory_xact_lock(hashtextextended(lama.pengguna_id::text,0));
 if exists(select 1 from penugasan where pengguna_id=lama.pengguna_id and id<>p_id and peran=p_peran and outlet_id is not distinct from p_outlet) then raise unique_violation using message='Akses peran dan outlet ini sudah ada';end if;
 -- DELETE ... RETURNING memastikan konflik tidak menghapus perubahan admin lain.
 delete from public.penugasan where id=p_id and peran=lama.peran and outlet_id is not distinct from lama.outlet_id returning * into lama;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Tidak diizinkan atau akses sudah berubah';end if;
 lama.peran:=p_peran;lama.outlet_id:=p_outlet;
 insert into public.penugasan select (lama).*;
 -- Jika INSERT ditolak RLS/duplikat, DELETE juga otomatis rollback.
end $function$;
