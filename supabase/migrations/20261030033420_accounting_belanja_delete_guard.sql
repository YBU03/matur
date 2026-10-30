-- DELETE tanpa relasi penerimaan tetap mengembalikan OLD agar perilaku purge lama terjaga.
create or replace function operasional_outlet_internal.jaga_belanja() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if exists(select 1 from belanja_bahan_outlet where biaya_id=old.id) and (tg_op='DELETE' or new.jumlah is distinct from old.jumlah or new.kategori_id is distinct from old.kategori_id or new.outlet_id is distinct from old.outlet_id or new.tanggal is distinct from old.tanggal or new.deleted_at is distinct from old.deleted_at or new.mode is distinct from old.mode) then raise exception 'Pembelian terkait penerimaan: nominal, kategori, tanggal dan penghapusannya dilindungi. Gunakan koreksi terpisah agar riwayat stok tetap cocok.';end if;
 if tg_op='DELETE' then return old;end if;
 return new;end $$;
