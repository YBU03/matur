-- Match the owner-supplied poster. Preserve existing period, active flag and explicit menu IDs.
begin;
do $$declare p jsonb;begin
 select to_jsonb(x) into p from promo_internal.promo x where id='c3378cc2-0e60-43c7-be19-78ae44c3863b' and nama='Promo NGOPAG';
 if p is null then raise exception 'NGOPAG tidak ditemukan';end if;
 perform set_config('task.ngopag_before',p::text,true);
 perform set_config('request.jwt.claim.sub','f1e0a66c-55f7-4f04-81b8-965d24a597ab',true);
end$$;
set local role authenticated;
select public.simpan_promo(current_setting('task.ngopag_before')::jsonb || jsonb_build_object('batas_diskon',5000,'dasar_minimum','keranjang','kanal_ids',jsonb_build_array('langsung','ruma_app')));
reset role;
do $$declare b jsonb:=current_setting('task.ngopag_before')::jsonb; a jsonb; allowed text[]:=array['batas_diskon','dasar_minimum','kanal_ids','versi','diubah_at','diubah_oleh'];begin
 select to_jsonb(x) into a from promo_internal.promo x where id=(b->>'id')::uuid;
 if (a-allowed) is distinct from (b-allowed) then raise exception 'Pengaturan lain NGOPAG berubah';end if;
end$$;
select nama,aktif,mulai,selesai,hari,slot,minimum_belanja,dasar_minimum,batas_diskon,kanal_ids,jsonb_array_length(aturan) jumlah_menu,versi from promo_internal.promo where id='c3378cc2-0e60-43c7-be19-78ae44c3863b';
commit;
