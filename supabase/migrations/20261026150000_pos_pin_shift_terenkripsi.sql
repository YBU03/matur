-- PIN outlet (Alur Shift): hash tetap dipakai untuk verifikasi; salinan terenkripsi di Vault
-- agar admin POS outlet yang berwenang dapat menampilkannya (tombol mata). Setiap lihat tercatat di log.
alter table pos_kas_internal.aturan_shift add column if not exists pin_secret_id uuid;

-- Salinan lama dibuang setiap kali hash berubah (PIN diganti lewat jalur apa pun).
create function pos_kas_internal.lupakan_pin_lama() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.pin_hash is distinct from old.pin_hash and old.pin_secret_id is not null then
  delete from vault.secrets where id=old.pin_secret_id;
  new.pin_secret_id:=null;
 end if;
 return new;
end $$;
create trigger lupakan_pin_lama before update of pin_hash on pos_kas_internal.aturan_shift
 for each row execute function pos_kas_internal.lupakan_pin_lama();

-- Simpan salinan terenkripsi hanya bila PIN cocok dengan hash yang berlaku.
create function pos_kas_internal.simpan_pin_vault(o uuid,pin text) returns boolean
language plpgsql security definer set search_path='' as $$
declare a pos_kas_internal.aturan_shift;sid uuid;
begin
 select * into a from pos_kas_internal.aturan_shift where outlet_id=o for update;
 if a.outlet_id is null or a.pin_hash is null or coalesce(pin,'')='' or pin !~ '^[0-9]{4,6}$'
    or extensions.crypt(pin,a.pin_hash)<>a.pin_hash then return false;end if;
 if a.pin_secret_id is null then
  sid:=vault.create_secret(pin);
  update pos_kas_internal.aturan_shift set pin_secret_id=sid where outlet_id=o;
 else
  perform vault.update_secret(a.pin_secret_id,pin);
 end if;
 return true;
end $$;
revoke all on function pos_kas_internal.simpan_pin_vault(uuid,text) from public,anon,authenticated;

-- Atur alur shift: perilaku lama tetap, PIN baru sekaligus disimpan terenkripsi.
create function pos_kas_internal.atur_shift_pin(o uuid,aktif boolean,pin text,versi integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pos_kas_internal.atur_shift(o,aktif,pin,versi);
 if coalesce(pin,'')<>'' then perform pos_kas_internal.simpan_pin_vault(o,pin);end if;
end $$;
create or replace function public.atur_alur_shift_pos(p_outlet uuid,p_aktif boolean,p_pin text,p_versi integer) returns void
language sql security invoker set search_path='' as $$ select pos_kas_internal.atur_shift_pin(p_outlet,p_aktif,p_pin,p_versi) $$;

-- Tampilkan PIN (admin POS outlet berwenang), dicatat di log aktivitas.
create function pos_kas_internal.lihat_pin_shift(o uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a pos_kas_internal.aturan_shift;pin text;
begin
 if not matur_internal.admin_pos_outlet(o) then raise exception 'Tidak berwenang melihat PIN outlet ini';end if;
 select * into a from pos_kas_internal.aturan_shift where outlet_id=o;
 if a.outlet_id is null or a.pin_hash is null then return jsonb_build_object('belum_diatur',true);end if;
 if a.pin_secret_id is null then return jsonb_build_object('belum_tersimpan',true);end if;
 select decrypted_secret into pin from vault.decrypted_secrets where id=a.pin_secret_id;
 if pin is null then return jsonb_build_object('belum_tersimpan',true);end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id) values(auth.uid(),'lihat_pin_alur_shift','outlet',o::text);
 return jsonb_build_object('pin',pin);
end $$;
create function public.lihat_pin_alur_shift(p_outlet uuid) returns jsonb
language sql security invoker set search_path='' as $$ select pos_kas_internal.lihat_pin_shift(p_outlet) $$;

-- PIN lama: masukkan sekali agar bisa ditampilkan, tanpa mengganti PIN. Dibatasi 8 percobaan salah / 15 menit.
create function pos_kas_internal.simpan_pin_shift_lama(o uuid,pin text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not matur_internal.admin_pos_outlet(o) then raise exception 'Tidak berwenang mengelola PIN outlet ini';end if;
 perform pg_advisory_xact_lock(hashtext('pos-outlet:'||o));
 if (select count(*) from public.log_aktivitas where aksi='pin_alur_shift_salah' and entitas_id=o::text and waktu>now()-interval '15 minutes')>=8 then
  return jsonb_build_object('error','Terlalu banyak percobaan. Coba lagi 15 menit lagi.');end if;
 if not pos_kas_internal.simpan_pin_vault(o,pin) then
  insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id) values(auth.uid(),'pin_alur_shift_salah','outlet',o::text);
  return jsonb_build_object('error','PIN tidak cocok dengan PIN outlet saat ini. Tidak ada perubahan.');
 end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id) values(auth.uid(),'simpan_pin_alur_shift_lama','outlet',o::text);
 return jsonb_build_object('ok',true);
end $$;
create function public.simpan_pin_alur_shift_lama(p_outlet uuid,p_pin text) returns jsonb
language sql security invoker set search_path='' as $$ select pos_kas_internal.simpan_pin_shift_lama(p_outlet,p_pin) $$;

revoke all on function pos_kas_internal.atur_shift_pin(uuid,boolean,text,integer),pos_kas_internal.lihat_pin_shift(uuid),pos_kas_internal.simpan_pin_shift_lama(uuid,text),
 public.atur_alur_shift_pos(uuid,boolean,text,integer),public.lihat_pin_alur_shift(uuid),public.simpan_pin_alur_shift_lama(uuid,text) from public,anon;
grant execute on function pos_kas_internal.atur_shift_pin(uuid,boolean,text,integer),pos_kas_internal.lihat_pin_shift(uuid),pos_kas_internal.simpan_pin_shift_lama(uuid,text),
 public.atur_alur_shift_pos(uuid,boolean,text,integer),public.lihat_pin_alur_shift(uuid),public.simpan_pin_alur_shift_lama(uuid,text) to authenticated;
