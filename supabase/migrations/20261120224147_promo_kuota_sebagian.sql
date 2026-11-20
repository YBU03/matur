-- Promo sebagian sesuai sisa kuota: bila pesanan melebihi sisa kuota, item promo pertama (urutan keranjang)
-- mendapat potongan sebanyak sisa kuota, sisanya otomatis harga normal — tetap satu nota.
-- Hanya promo per item; voucher per transaksi tetap memakai 1 kuota per nota. Data lama tidak berubah.
do $$
declare f text;
begin
 f := pg_get_functiondef('promo_internal.pesan(jsonb)'::regprocedure);
 if position('lokal timestamp:=clock_timestamp() at time zone ''Asia/Jakarta'';' in f) = 0
  or position(' for it in select * from jsonb_array_elements(p->''items'') loop' in f) = 0
  or position('if unit_diskon>0 then pot:=pot+unit_diskon*(it->>''qty'')::integer; rin:=rin||jsonb_build_object(it->>''menu_id'',coalesce((rin->>(it->>''menu_id''))::integer,0)+(it->>''qty'')::integer); end if;' in f) = 0
  or position(' if pot<=0 then raise exception ''Tidak ada item yang memenuhi promo''; end if;' in f) = 0
  or position('''minimum_belanja'',r.snapshot->''minimum_belanja'');' in f) = 0
  or position('''minimum_belanja'',x.minimum_belanja));' in f) = 0
  or position('''minimum_belanja'',x.minimum_belanja);' || chr(10) || 'end' in f) = 0
 then raise exception 'Pola promo_internal.pesan berubah'; end if;

 -- Variabel: sisa kuota per kunci, jumlah unit yang dapat potongan, dan unit yang kembali ke harga normal.
 f := replace(f, 'lokal timestamp:=clock_timestamp() at time zone ''Asia/Jakarta'';',
  'lokal timestamp:=clock_timestamp() at time zone ''Asia/Jakarta''; sisa_k jsonb; kk text; dapat integer; lebih jsonb:=''{}'';');
 -- Ambil sisa kuota sekali (promo sudah dikunci FOR UPDATE) sebelum menghitung item.
 f := replace(f, ' for it in select * from jsonb_array_elements(p->''items'') loop',
  ' sisa_k:=case when x.kuota is not null and coalesce(x.cakupan,''item'')<>''transaksi'' then promo_internal.sisa_kuota(x,o,public.tgl_op(clock_timestamp())) end;' || chr(10) ||
  ' for it in select * from jsonb_array_elements(p->''items'') loop');
 -- Potongan hanya untuk unit yang masih kebagian kuota (urutan keranjang); sisanya harga normal.
 f := replace(f, 'if unit_diskon>0 then pot:=pot+unit_diskon*(it->>''qty'')::integer; rin:=rin||jsonb_build_object(it->>''menu_id'',coalesce((rin->>(it->>''menu_id''))::integer,0)+(it->>''qty'')::integer); end if;',
  'if unit_diskon>0 then
    dapat:=(it->>''qty'')::integer;
    if sisa_k is not null then
     kk:=case when x.per_menu then it->>''menu_id'' else ''semua'' end;
     dapat:=least(dapat,greatest(coalesce((sisa_k->>kk)::integer,0),0));
     sisa_k:=sisa_k||jsonb_build_object(kk,coalesce((sisa_k->>kk)::integer,0)-dapat);
     if dapat<(it->>''qty'')::integer then lebih:=lebih||jsonb_build_object(it->>''menu_id'',coalesce((lebih->>(it->>''menu_id''))::integer,0)+(it->>''qty'')::integer-dapat); end if;
    end if;
    if dapat>0 then pot:=pot+unit_diskon*dapat; rin:=rin||jsonb_build_object(it->>''menu_id'',coalesce((rin->>(it->>''menu_id''))::integer,0)+dapat); end if;
   end if;');
 -- Semua item promo melebihi kuota (sisa 0): pesan kuota agar kasir beralih ke harga normal.
 f := replace(f, ' if pot<=0 then raise exception ''Tidak ada item yang memenuhi promo''; end if;',
  ' if pot<=0 and lebih<>''{}''::jsonb then raise exception ''Kuota promo tidak cukup (sisa 0). Kurangi jumlah atau pilih promo lain''; end if;' || chr(10) ||
  ' if pot<=0 then raise exception ''Tidak ada item yang memenuhi promo''; end if;');
 -- Kembalikan rincian unit berpromo & unit harga normal (juga untuk permintaan ulang yang sama).
 f := replace(f, '''minimum_belanja'',r.snapshot->''minimum_belanja'');',
  '''minimum_belanja'',r.snapshot->''minimum_belanja'',''rincian'',r.rincian,''lebih'',coalesce(r.snapshot->''lebih'',''{}''::jsonb));');
 f := replace(f, '''minimum_belanja'',x.minimum_belanja));',
  '''minimum_belanja'',x.minimum_belanja,''lebih'',lebih));');
 f := replace(f, '''minimum_belanja'',x.minimum_belanja);' || chr(10) || 'end',
  '''minimum_belanja'',x.minimum_belanja,''rincian'',rin,''lebih'',lebih);' || chr(10) || 'end');
 execute f;
end $$;
