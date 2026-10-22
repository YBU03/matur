-- Simpan satu susunan timeline secara atomik; tetap memakai RLS dan hak admin proyek.
create or replace function public.simpan_urutan_timeline(p_proyek uuid, p_ids uuid[], p_dasar jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  aktual jsonb;
  jumlah integer;
  diubah integer;
begin
  if auth.uid() is null or not coalesce(public.admin_proyek(), false) then
    raise exception 'Hanya Owner/Admin Pusat yang dapat mengatur urutan';
  end if;
  if p_ids is null or cardinality(p_ids) < 1 or cardinality(p_ids) > 2000
     or array_ndims(p_ids) <> 1 or array_position(p_ids, null) is not null
     or (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids)
     or p_dasar is null or jsonb_typeof(p_dasar) <> 'object' then
    raise exception 'Susunan kegiatan tidak valid';
  end if;
  perform id from public.proyek where id=p_proyek and deleted_at is null for update;
  if not found then raise exception 'Proyek tidak tersedia'; end if;
  perform id from public.jadwal_proyek where proyek_id=p_proyek and deleted_at is null order by id for update;
  select count(*), coalesce(jsonb_object_agg(id::text, urutan), '{}'::jsonb)
    into jumlah, aktual from public.jadwal_proyek where proyek_id=p_proyek and deleted_at is null;
  if aktual <> p_dasar or jumlah <> cardinality(p_ids)
     or exists(select 1 from unnest(p_ids) x where not (aktual ? x::text)) then
    raise exception 'Jadwal telah berubah. Muat ulang halaman sebelum menyusun kembali';
  end if;
  update public.jadwal_proyek j set urutan=n.posisi::integer
    from unnest(p_ids) with ordinality n(id,posisi)
    where j.id=n.id and j.proyek_id=p_proyek and j.deleted_at is null;
  get diagnostics diubah = row_count;
  if diubah <> jumlah then raise exception 'Urutan belum tersimpan seluruhnya'; end if;
end;
$$;
revoke all on function public.simpan_urutan_timeline(uuid,uuid[],jsonb) from public, anon;
grant execute on function public.simpan_urutan_timeline(uuid,uuid[],jsonb) to authenticated;
