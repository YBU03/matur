-- Hapus adalah koreksi pencatatan dengan arsip, bukan pengembalian uang bank.
-- Koreksi pembayaran dan pembatalan nota harus selesai dalam satu transaksi.
create function proyek_internal.hapus_belanja(p_id uuid,p_versi timestamptz,p_alasan text,p_akui_pembayaran boolean)
returns void language plpgsql security definer set search_path='' as $$
declare b public.belanja_proyek; v timestamptz; alasan text:=left(trim(p_alasan),988);u uuid:=auth.uid();
begin
 if u is null or not coalesce(public.admin_proyek(),false) then raise exception 'Hanya Owner/Admin Pusat';end if;
 if not exists(select 1 from public.pengguna where id=u and status='aktif') then raise exception 'Akun tidak aktif';end if;
 if length(coalesce(alasan,''))<5 then raise exception 'Isi alasan hapus minimal 5 karakter';end if;
 select * into b from public.belanja_proyek where id=p_id for update;
 if not found or not exists(select 1 from public.proyek where id=b.proyek_id and deleted_at is null) then raise exception 'Nota tidak tersedia';end if;
 if b.batal_at is not null then
  if b.alasan_batal='Hapus nota: '||alasan then return;end if;
  raise exception 'Nota sudah dihapus atau dibatalkan';
 end if;
 if b.updated_at is distinct from p_versi then raise exception 'Nota sudah berubah. Muat ulang sebelum menghapus';end if;
 if exists(select 1 from public.belanja_proyek_bayar where belanja_id=p_id and batal_at is null) then
  if not coalesce(p_akui_pembayaran,false) then raise exception 'Konfirmasi dampak pembayaran dan saldo sebelum menghapus';end if;
  perform proyek_internal.koreksi_bayar_belanja(null,p_id,b.updated_at,'Hapus nota: '||alasan);
 end if;
 select updated_at into v from public.belanja_proyek where id=p_id;
 perform proyek_internal.batalkan_belanja(p_id,v,'Hapus nota: '||alasan);
end $$;
create function public.hapus_belanja_proyek(p_id uuid,p_versi timestamptz,p_alasan text,p_akui_pembayaran boolean)
returns void language sql security invoker set search_path='' as $$select proyek_internal.hapus_belanja(p_id,p_versi,p_alasan,p_akui_pembayaran)$$;
revoke all on function proyek_internal.hapus_belanja(uuid,timestamptz,text,boolean) from public,anon;
grant execute on function proyek_internal.hapus_belanja(uuid,timestamptz,text,boolean) to authenticated;
revoke all on function public.hapus_belanja_proyek(uuid,timestamptz,text,boolean) from public,anon;
grant execute on function public.hapus_belanja_proyek(uuid,timestamptz,text,boolean) to authenticated;
