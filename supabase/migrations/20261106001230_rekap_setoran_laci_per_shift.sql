-- Rekap setoran: pengeluaran LACI yang tercatat di sesi kas dihitung pada hari operasional saat uang keluar
-- (tgl_op(created_at)), sama dengan kas shift. Pengeluaran yang ditulis mundur (mis. "tambahan es" kemarin) tidak lagi
-- membuat "harus disetor" meleset. Pengeluaran pusat tetap per tanggal catatan.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.rekap_setoran(uuid, date, date)'::regprocedure);
  if position($q$biaya as(select tanggal,sum(jumlah) filter(where sumber='laci') laci,sum(jumlah) filter(where sumber='pusat') pusat from biaya_outlet where outlet_id=p_outlet and mode='asli' and deleted_at is null and tanggal between p_dari and p_sampai group by 1),$q$ in d) = 0 then
    raise exception 'pola biaya rekap_setoran tidak ditemukan';
  end if;
  d := replace(d, $q$biaya as(select tanggal,sum(jumlah) filter(where sumber='laci') laci,sum(jumlah) filter(where sumber='pusat') pusat from biaya_outlet where outlet_id=p_outlet and mode='asli' and deleted_at is null and tanggal between p_dari and p_sampai group by 1),$q$,
    $q$biaya as(select x.tanggal,sum(x.jumlah) filter(where x.sumber='laci') laci,sum(x.jumlah) filter(where x.sumber='pusat') pusat from (
   select case when b.sumber='laci' then coalesce(sk.tanggal_shift,b.tanggal) else b.tanggal end tanggal,b.jumlah,b.sumber
     from biaya_outlet b left join sesi_kas sk on sk.id=b.sesi_kas_id
    where b.outlet_id=p_outlet and b.mode='asli' and b.deleted_at is null and b.tanggal between p_dari-7 and p_sampai+7) x
   where x.tanggal between p_dari and p_sampai group by 1),$q$);
  execute d;
end $$;

-- Penyempurnaan (diterapkan bersama): pakai hari operasional saat dicatat, bukan tanggal_shift sesi
-- (sesi lama 30 Okt–2 Nov yang panjang membuat pengeluaran 1 Nov pindah ke 30 Okt).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.rekap_setoran(uuid, date, date)'::regprocedure);
  if position($q$case when b.sumber='laci' then coalesce(sk.tanggal_shift,b.tanggal) else b.tanggal end tanggal$q$ in d) = 0 then raise exception 'pola laci rekap_setoran tidak ditemukan'; end if;
  d := replace(d, $q$case when b.sumber='laci' then coalesce(sk.tanggal_shift,b.tanggal) else b.tanggal end tanggal$q$,
    $q$case when b.sumber='laci' and b.sesi_kas_id is not null then greatest(b.tanggal, public.tgl_op(b.created_at)) else b.tanggal end tanggal$q$);
  execute d;
end $$;
