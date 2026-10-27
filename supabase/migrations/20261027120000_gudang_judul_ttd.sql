-- Judul default 4 kotak tanda tangan invoice/surat jalan Gudang (nama & tanggal diedit saat cetak, tidak disimpan).
alter table public.pengaturan_dokumen_gudang
  add column judul_ttd text[] not null default array['Dibuat oleh','Diperiksa oleh','Dikirim oleh','Diterima oleh']
  check (cardinality(judul_ttd)=4 and array_position(judul_ttd,null) is null
    and length(array_to_string(judul_ttd,''))<=160);

create function gudang_internal.dokumen_ttd(p_alamat text,p_logo text,p_versi integer,p_judul text[]) returns void language plpgsql security definer set search_path='' as $$
declare j text[];
begin
 if p_judul is null or cardinality(p_judul)<>4 or array_position(p_judul,null) is not null then raise exception 'Judul kotak tanda tangan wajib 4 isian';end if;
 select array_agg(trim(x) order by n) into j from unnest(p_judul) with ordinality t(x,n);
 if exists(select 1 from unnest(j) x where length(x)>40) then raise exception 'Judul kotak tanda tangan maksimal 40 karakter';end if;
 perform gudang_internal.dokumen(p_alamat,p_logo,p_versi);
 update public.pengaturan_dokumen_gudang set judul_ttd=j where id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,nilai_baru) values(auth.uid(),'judul_ttd_dokumen_gudang','pengaturan_dokumen_gudang',jsonb_build_object('judul_ttd',to_jsonb(j)));
end $$;
create function public.atur_dokumen_gudang_ttd(p_alamat text,p_logo text,p_versi integer,p_judul text[]) returns void language sql security invoker set search_path='' as $$select gudang_internal.dokumen_ttd(p_alamat,p_logo,p_versi,p_judul)$$;
revoke all on function gudang_internal.dokumen_ttd(text,text,integer,text[]) from public,anon;
grant execute on function gudang_internal.dokumen_ttd(text,text,integer,text[]) to authenticated;
revoke all on function public.atur_dokumen_gudang_ttd(text,text,integer,text[]) from public,anon;
grant execute on function public.atur_dokumen_gudang_ttd(text,text,integer,text[]) to authenticated;
