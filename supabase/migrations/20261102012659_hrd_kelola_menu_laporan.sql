-- HRD operasional: kelola menu/kategori/varian/kemasan/resep/HPP & laporan POS lengkap (hanya menambah izin).
create policy kelola_hrd on public.menu for all to authenticated using (punya_peran('{hrd}')) with check (punya_peran('{hrd}'));
create policy kelola_hrd on public.kategori_menu for all to authenticated using (punya_peran('{hrd}')) with check (punya_peran('{hrd}'));
create policy kelola_hrd on public.varian for all to authenticated using (punya_peran('{hrd}')) with check (punya_peran('{hrd}'));
create policy kelola_hrd on public.resep for all to authenticated using (punya_peran('{hrd}')) with check (punya_peran('{hrd}'));
create policy kelola_hrd on public.hpp_menu for all to authenticated using (punya_peran('{hrd}')) with check (punya_peran('{hrd}'));
create policy menu_unggah_hrd on storage.objects for insert to authenticated with check (bucket_id = 'menu' and punya_peran('{hrd}'));

do $$
declare d text;
begin
  d := pg_get_functiondef('menu_internal.atur_varian'::regproc);
  if position('{owner,admin_pusat,admin_gudang}' in d) = 0 then raise exception 'atur_varian: pola peran tidak ditemukan'; end if;
  execute replace(replace(d, '{owner,admin_pusat,admin_gudang}', '{owner,admin_pusat,admin_gudang,hrd}'), 'Owner/Admin Pusat/Admin Gudang', 'Owner/Admin Pusat/Admin Gudang/HRD');

  d := pg_get_functiondef('menu_internal.atur_resep'::regproc);
  if position('{owner,admin_pusat,admin_gudang}' in d) = 0 then raise exception 'atur_resep: pola peran tidak ditemukan'; end if;
  execute replace(replace(d, '{owner,admin_pusat,admin_gudang}', '{owner,admin_pusat,admin_gudang,hrd}'), 'Owner/Admin Pusat/Admin Gudang', 'Owner/Admin Pusat/Admin Gudang/HRD');

  d := pg_get_functiondef('public.laporan_operasional'::regproc);
  if position($q$punya_peran('{owner,admin_pusat,finance,admin_gudang}') then raise exception 'Tidak diizinkan'$q$ in d) = 0 then raise exception 'laporan_operasional: pola peran tidak ditemukan'; end if;
  execute replace(d, $q$punya_peran('{owner,admin_pusat,finance,admin_gudang}') then raise exception 'Tidak diizinkan'$q$,
                     $q$punya_peran('{owner,admin_pusat,finance,admin_gudang,hrd}') then raise exception 'Tidak diizinkan'$q$);
end $$;
