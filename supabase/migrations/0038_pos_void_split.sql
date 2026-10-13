-- POS: void transaksi (persetujuan SPV), izin diskon besar sekali pakai, split payment.
alter table transaksi add column if not exists void_oleh uuid references pengguna, add column if not exists void_alasan text, add column if not exists void_at timestamptz;
alter table mutasi_stok drop constraint if exists mutasi_stok_jenis_check;
alter table mutasi_stok add constraint mutasi_stok_jenis_check check (jenis in ('kiriman_keluar','kiriman_masuk','kiriman_batal','opname','pembelian','pemakaian','koreksi','void','waste','transfer_keluar','transfer_masuk'));

create table if not exists otorisasi (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlet,
  jenis text not null check (jenis in ('diskon')),
  nilai int not null default 0,
  oleh uuid not null default auth.uid() references pengguna,
  created_at timestamptz not null default now(),
  dipakai_at timestamptz
);
alter table otorisasi enable row level security;
create policy baca on otorisasi for select using (boleh_outlet(outlet_id));

create or replace function izinkan_diskon(p_outlet uuid, p_persen int) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not (peran_di_outlet(p_outlet, '{spv}') or punya_peran('{owner,admin_pusat}')) then raise exception 'Hanya SPV/Owner yang bisa menyetujui'; end if;
  insert into otorisasi (outlet_id, jenis, nilai) values (p_outlet, 'diskon', greatest(least(p_persen, 100), 0)) returning id into v;
  return v;
end $$;

create or replace function void_transaksi(p_id uuid, p_alasan text) returns void language plpgsql security definer set search_path = public as $$
declare t transaksi; r record; v_buka boolean;
begin
  select * into t from transaksi where id = p_id for update;
  if t.id is null then raise exception 'Transaksi tidak ditemukan'; end if;
  if t.status <> 'lunas' then raise exception 'Transaksi sudah dibatalkan'; end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan pembatalan wajib diisi'; end if;
  select ditutup_at is null into v_buka from sesi_kas where id = t.sesi_kas_id;
  if not (punya_peran('{owner,admin_pusat}') or (peran_di_outlet(t.outlet_id, '{spv}') and coalesce(v_buka, false))) then
    raise exception 'Void hanya oleh SPV selama shift masih buka (atau Owner)';
  end if;
  update transaksi set status = 'void', void_oleh = auth.uid(), void_alasan = trim(p_alasan), void_at = now() where id = p_id;
  for r in select bahan_id, sum(jumlah) jml from mutasi_stok where ref_id = p_id and jenis = 'pemakaian' group by bahan_id loop
    perform geser_stok(t.mode, t.outlet_id, r.bahan_id, -r.jml, 'void', p_id, 'Void POS #' || t.nomor);
  end loop;
end $$;
grant execute on function izinkan_diskon(uuid, int), void_transaksi(uuid, text) to authenticated;

-- buat_transaksi (0038b): p.pembayaran [{metode, nominal, diterima}] untuk split payment (jumlah = total,
-- kembalian dari bagian tunai), p.otorisasi untuk diskon di atas batas (izin SPV sekali pakai ≤ 10 menit).
-- Definisi lengkap diterapkan lewat MCP; sisanya sama dengan versi 0033b (potong stok resep).
