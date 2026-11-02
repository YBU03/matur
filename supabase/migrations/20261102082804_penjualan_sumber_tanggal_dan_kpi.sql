-- Pertahankan waktu pembayaran yang diketahui: PDF hanya menyatakan tanggal, bukan jam.
-- Guard pada definisi mencegah patch diam-diam menimpa fungsi yang telah berubah.
do $patch$
declare s text;old text;new text;fn text;
begin
 select pg_get_functiondef('public.laporan_operasional(text,uuid,date,date,mode_data,uuid)'::regprocedure) into s;
 old:='''terakhir_dibayar'', case when t.status=''lunas'' then t.created_at end';
 new:='''terakhir_dibayar'', case when t.status=''lunas'' then case when t.sumber_penjualan is not null then to_char(t.created_at at time zone ''Asia/Jakarta'',''YYYY-MM-DD'') else t.created_at::text end end';
 if strpos(s,old)=0 then raise exception 'Definisi laporan berubah, periksa ulang';end if;
 s:=replace(s,old,new);
 s:=replace(s,'''kanal'', t.kanal, ''tipe'', t.tipe','''kanal'', case when t.sumber_penjualan is null then t.kanal::text end, ''tipe'', case when t.sumber_penjualan is null then t.tipe end');
 execute s;
 foreach fn in array array['public.ringkasan_penjualan(uuid,date,date,mode_data)','public.pantau_pos(uuid,date,date)'] loop
  select pg_get_functiondef(fn::regprocedure) into s;
  old:='''trx'', count(*),';
  new:='''trx'', count(*), ''impor_tanpa_rincian'', count(*) filter(where sumber_penjualan is not null),';
  if strpos(s,old)=0 then raise exception 'Definisi KPI berubah: %',fn;end if;
  execute replace(s,old,new);
 end loop;
end $patch$;
