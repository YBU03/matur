-- Pertahankan RPC publik sebagai invoker; implementasi definer privat tetap memeriksa uid/outlet.
alter function public.atur_modal_pos(uuid,text,bigint) set schema pos_kas_internal;
alter function pos_kas_internal.atur_modal_pos(uuid,text,bigint) rename to modal_shift_aman;
create function public.atur_modal_pos(p_sesi uuid,p_device text,p_jumlah bigint) returns void language sql security invoker set search_path='' as $$ select pos_kas_internal.modal_shift_aman(p_sesi,p_device,p_jumlah) $$;
alter function public.tutup_kas_outlet(uuid,text,text,text,bigint,text,uuid[]) set schema pos_kas_internal;
alter function pos_kas_internal.tutup_kas_outlet(uuid,text,text,text,bigint,text,uuid[]) rename to tutup_shift_aman;
create function public.tutup_kas_outlet(p_sesi uuid,p_device text,p_kode text,p_pin text,p_aktual bigint,p_catatan text,p_pending uuid[]) returns jsonb language sql security invoker set search_path='' as $$ select pos_kas_internal.tutup_shift_aman(p_sesi,p_device,p_kode,p_pin,p_aktual,p_catatan,p_pending) $$;
alter function public.foto_staf_pos(text) set schema pos_kas_internal;
create function public.foto_staf_pos(p_path text) returns boolean language sql stable security invoker set search_path='' as $$ select pos_kas_internal.foto_staf_pos(p_path) $$;
alter policy foto_staf_pos on storage.objects using(bucket_id='profil' and public.foto_staf_pos(name));
revoke all on function public.atur_modal_pos(uuid,text,bigint),public.tutup_kas_outlet(uuid,text,text,text,bigint,text,uuid[]),public.foto_staf_pos(text),pos_kas_internal.modal_shift_aman(uuid,text,bigint),pos_kas_internal.tutup_shift_aman(uuid,text,text,text,bigint,text,uuid[]),pos_kas_internal.foto_staf_pos(text) from public,anon;
grant execute on function public.atur_modal_pos(uuid,text,bigint),public.tutup_kas_outlet(uuid,text,text,text,bigint,text,uuid[]),public.foto_staf_pos(text),pos_kas_internal.modal_shift_aman(uuid,text,bigint),pos_kas_internal.tutup_shift_aman(uuid,text,text,text,bigint,text,uuid[]),pos_kas_internal.foto_staf_pos(text) to authenticated;
