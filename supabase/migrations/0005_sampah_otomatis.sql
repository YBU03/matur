-- STATUS: BELUM TERPASANG di project Supabase (pemasangan otomatis dibatalkan).
-- Jalankan manual lewat Supabase Dashboard → SQL Editor.
-- AKS-07: data di tempat sampah lebih dari 30 hari dihapus permanen, dijalankan harian.
create extension if not exists pg_cron;

create or replace function kosongkan_sampah() returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  foreach t in array array['resep','varian','menu','kategori_menu','bahan','supplier','karyawan','perjanjian','mitra','outlet'] loop
    begin
      execute format('delete from %I where deleted_at < now() - interval ''30 days''', t);
    exception when foreign_key_violation then null; -- masih dirujuk data lain (mis. transaksi), tetap disimpan
    end;
  end loop;
end $$;
revoke execute on function kosongkan_sampah() from public, anon, authenticated;

select cron.schedule('kosongkan-sampah', '15 19 * * *', 'select public.kosongkan_sampah()'); -- 02.15 WIB
