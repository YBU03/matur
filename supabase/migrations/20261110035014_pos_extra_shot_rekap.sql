-- ID berulang merepresentasikan jumlah Extra Shot, tanpa mengganti payload/riwayat lama.
create function matur_internal.jumlah_varian(v uuid, ids uuid[]) returns integer language sql immutable security invoker set search_path='' as $$select count(*)::int from unnest(ids) x where x=v$$;
revoke all on function matur_internal.jumlah_varian(uuid,uuid[]) from public,anon,authenticated;
create function matur_internal.cek_varian_berulang(m uuid,ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
 if cardinality(ids)>100 or exists(select 1 from unnest(ids) x group by x having count(*)>10 or (count(*)>1 and not exists(select 1 from public.varian v where v.id=x and v.menu_id=m and v.grup='Extra' and lower(trim(v.nama)) in ('extra shot','extra shoot')))) then raise exception 'Jumlah additional tidak valid (Extra Shot maksimal 10)';end if;
end $$;
revoke all on function matur_internal.cek_varian_berulang(uuid,uuid[]) from public,anon,authenticated;
do $patch$
declare d text;old text;replacement text;
begin
 d:=pg_get_functiondef('matur_internal.buat_transaksi(jsonb)'::regprocedure);
 old:='    v_harga := case when v_kanal';
 if position(old in d)=0 then raise exception 'Core harga berubah';end if;
 d:=replace(d,old,'    perform matur_internal.cek_varian_berulang(m.id,v_vids);'||chr(10)||old);
 old:='sum(coalesce((p#>>array[''_katalog'',''varian'',id::text])::bigint,tambahan_harga))';
 if position(old in d)=0 then raise exception 'Snapshot harga berubah';end if;
 d:=replace(d,old,'sum(coalesce((p#>>array[''_katalog'',''varian'',id::text])::bigint,tambahan_harga)*matur_internal.jumlah_varian(id,v_vids))');
 d:=replace(d,'string_agg(nama, '', '') from varian where id = any(v_vids)','string_agg(nama||case when matur_internal.jumlah_varian(id,v_vids)>1 then '' ×''||matur_internal.jumlah_varian(id,v_vids) else '''' end, '', '' order by grup,nama) from varian where id = any(v_vids)');
 old:='sum(r2.takaran * b2.harga_pokok)';
 if position(old in d)=0 then raise exception 'Perhitungan HPP berubah';end if;
 d:=replace(d,old,'sum(r2.takaran * b2.harga_pokok * case when r2.varian_id is null then 1 else matur_internal.jumlah_varian(r2.varian_id,v_vids) end)');
 old:='sum(ri.takaran * x.qty)';
 if position(old in d)=0 then raise exception 'Perhitungan stok berubah';end if;
 d:=replace(d,old,'sum(ri.takaran * x.qty * case when ri.varian_id is null then 1 else matur_internal.jumlah_varian(ri.varian_id,x.varian_ids) end)');
 execute d;
 -- Rekap additional membaca jumlah, bukan sekadar keberadaan ID.
 d:=pg_get_functiondef('public.laporan_operasional(text,uuid,date,date,public.mode_data,uuid)'::regprocedure);
 old:='''varian'', v.nama, ''qty'', sum(i.qty), ''tambahan'', sum(i.qty * v.tambahan_harga)';
 if position(old in d)=0 then raise exception 'Laporan modifier berubah';end if;
 d:=replace(d,old,'''varian'', v.nama, ''qty'', sum(i.qty*matur_internal.jumlah_varian(v.id,i.varian_ids)), ''tambahan'', sum(i.qty * v.tambahan_harga*matur_internal.jumlah_varian(v.id,i.varian_ids))');
 execute d;
 if to_regprocedure('qris_demo_internal.pos(text,uuid,jsonb)') is not null then
 d:=pg_get_functiondef('qris_demo_internal.pos(text,uuid,jsonb)'::regprocedure);
 old:='if vid=any(ids) then raise exception ''Varian duplikat'';end if;ids:=array_append(ids,vid);';
 if position(old in d)=0 then raise exception 'Validasi demo berubah';end if;
 d:=replace(d,old,'ids:=array_append(ids,vid);perform matur_internal.cek_varian_berulang(m.id,ids::uuid[]);');
 execute d;
 end if;
end $patch$;
-- Hasil agregat seluruh periode; invoker tetap mengikuti RLS outlet, tidak memperluas akses.
create function public.rekap_produk_pos(p_outlet uuid,p_dari timestamptz,p_sampai timestamptz) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare r jsonb;
begin
 if auth.uid() is null or p_outlet is null or p_sampai<=p_dari or p_sampai-p_dari>interval '94 days' then raise exception 'Periode rekap tidak valid';end if;
 select coalesce(jsonb_agg(x),'[]') into r from(
 select coalesce(k.nama,'Tanpa kategori') kategori,coalesce(k.urutan,999) urutan,i.menu_id,i.nama,sum(i.qty) qty,sum(i.qty*i.harga) nilai
 from public.transaksi t join public.item_transaksi i on i.transaksi_id=t.id left join public.menu m on m.id=i.menu_id left join public.kategori_menu k on k.id=m.kategori_id
 where t.outlet_id=p_outlet and t.mode='asli' and t.status='lunas' and t.created_at>=p_dari and t.created_at<p_sampai
 group by k.nama,k.urutan,i.menu_id,i.nama)x;
 return r;
end $$;
revoke all on function public.rekap_produk_pos(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.rekap_produk_pos(uuid,timestamptz,timestamptz) to authenticated;
