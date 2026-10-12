-- Profil saya: pengguna aktif mengubah nama & no HP miliknya sendiri (kolom lain tidak tersentuh)
create or replace function ubah_profil(p_nama text, p_hp text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Belum login'; end if;
  if length(trim(coalesce(p_nama, ''))) < 2 then raise exception 'Nama minimal 2 huruf'; end if;
  update pengguna
     set nama = left(trim(p_nama), 100),
         no_hp = nullif(left(regexp_replace(coalesce(p_hp, ''), '[^0-9+]', '', 'g'), 20), '')
   where id = auth.uid() and status = 'aktif';
  if not found then raise exception 'Akun tidak aktif'; end if;
end $$;
revoke execute on function ubah_profil(text, text) from public, anon;
grant execute on function ubah_profil(text, text) to authenticated;
