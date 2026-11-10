-- Hapus draft laporan internal (hasil impor/koreksi yang tidak sesuai). Laporan resmi (laporan_bulanan) tidak disentuh.
-- Isi draft disalin utuh ke log_aktivitas agar bisa dipulihkan.
create or replace function public.hapus_laporan_internal(p_outlet uuid, p_periode date, p_versi timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.laporan_internal;
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner, Admin Pusat, atau Finance'; end if;
 select * into d from public.laporan_internal where outlet_id = p_outlet and periode = p_periode for update;
 if d.outlet_id is null then raise exception 'Draft sudah tidak ada. Muat ulang halaman.'; end if;
 if p_versi is not null and d.updated_at is distinct from p_versi then raise exception 'Draft sudah diubah pengguna lain. Muat ulang sebelum menghapus.'; end if;
 insert into public.log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru)
 values (auth.uid(), 'hapus_laporan_internal', 'laporan_internal', p_outlet::text || '|' || p_periode::text, to_jsonb(d), jsonb_build_object('dihapus', true, 'laporan_resmi_tetap', true));
 delete from public.laporan_internal where outlet_id = p_outlet and periode = p_periode;
end $$;
revoke all on function public.hapus_laporan_internal(uuid, date, timestamptz) from public, anon;
grant execute on function public.hapus_laporan_internal(uuid, date, timestamptz) to authenticated;
