-- Pesan di tablet saat kas kemarin tertinggal: arahkan ke Owner/SPV/Admin Gudang (menu Kas POS tertinggal).
do $$ declare d text; d0 text; begin
  d := pg_get_functiondef('public.pilih_pic_pos_outlet(uuid,text,uuid,bigint,bigint,text,text)'::regprocedure); d0 := d;
  d := replace(d, 'Tutup kas hari sebelumnya dahulu sebelum membuka kas baru', 'Kas hari sebelumnya belum ditutup. Minta Owner, SPV, atau Admin Gudang menutupnya di menu Akses Kasir POS Outlet (Kas POS tertinggal)');
  if d = d0 then raise exception 'patch pesan gagal'; end if;
  execute d;
end $$;
