-- Kasir ↔ gudang: resep menu dibentuk dari data HPP (seri Ice = menu POS), lalu setiap penjualan POS
-- memotong stok bahan di outlet (mutasi "pemakaian") dan mengisi HPP teoritis transaksi.

-- 1) resep dari komponen HPP → bahan gudang (takaran dalam satuan pakai bahan)
with peta(komponen, bahan, faktor) as (values
  ('Biang Teh','Jasmine Tea',0.05), ('Buah Lychee','Buah Lychee',0.05), ('Can Bottle','Set Can Bottle (cup & lid)',1),
  ('Coklat','Powder Chocolate',20), ('Creamer','Creamer',1), ('Crumble','Crumble',1), ('Fresh Milk','Fresh Milk',1),
  ('Gula Aren','Brown Sugar',1), ('Gula Cair','Simple Syrup',1), ('Gula Cair (req)','Simple Syrup',1), ('Honey Manuka','Honey Manuka',1),
  ('Honey Ori','Honey',1), ('Milo','Powder Milo',10), ('Orange Juice','Orange Juice',1), ('RK Lemonade','Powder Lemonade',1.0/150),
  ('RK Matcha','Powder Matcha',1), ('Sauce Caramel','Caramel Sauce',1), ('Set Cup Hot','Set Cup Hot (cup, lid, straw)',1),
  ('Set Cup Reg','Set Cup Reg (cup, lid, straw)',1), ('SKM','SKM',1), ('Strawberry Jam','Strawberry Jam',1),
  ('Syrup Butterscotch','Syrup Butterscotch',1), ('Syrup Caramel','Syrup Caramel',1), ('Syrup Chocolate','Syrup Chocolate',1),
  ('Syrup Lychee','Syrup Lychee',1), ('Syrup Strawberry','Syrup Strawberry',1), ('Syrup Mixberry','Mixberry Juice',1), ('Zoda','Soda',1),
  -- Cream Machiato (350 ml): whipcream 200 ml, fresh milk 100 ml, SKM 35, salt 1
  ('Cream Machiato','Whipping Cream Liquid',200.0/350), ('Cream Machiato','Fresh Milk',100.0/350), ('Cream Machiato','SKM',35.0/350), ('Cream Machiato','Sea Salt',1.0/350)
),
sumber as (  -- satu resep per menu: seri Ice bila ada (menu POS = versi es)
  select distinct on (menu_id) menu_id, komponen from hpp_menu where menu_id is not null and deleted_at is null
   order by menu_id, (seri = 'Ice') desc, seri
),
baris as (
  select s.menu_id, k->>'nama' nama, (k->>'qty')::numeric qty, (k->>'harga_unit')::numeric hu
    from sumber s, jsonb_array_elements(s.komponen) k
   where k->>'qty' is not null and (k->>'qty')::numeric > 0
),
takar as (
  select b.menu_id, bh.id bahan_id,
         sum(case when b.nama = 'Espresso' then b.qty * b.hu / 194.35 else b.qty * p.faktor end) takaran
    from baris b
    join peta p on p.komponen = b.nama
    join bahan bh on bh.nama = p.bahan and bh.mode = 'asli' and bh.deleted_at is null
   group by 1, 2
  union all
  select b.menu_id, bh.id, sum(b.qty * b.hu / 194.35)   -- espresso → biji kopi (gram)
    from baris b join bahan bh on bh.nama = 'Beans Coffee Blend' and bh.mode = 'asli' and bh.deleted_at is null
   where b.nama = 'Espresso' group by 1, 2
)
insert into resep (mode, menu_id, bahan_id, takaran)
select 'asli', menu_id, bahan_id, round(sum(takaran), 4) from takar
 where not exists (select 1 from resep r where r.menu_id = takar.menu_id and r.deleted_at is null)
 group by menu_id, bahan_id;

-- 2) buat_transaksi: setelah item tersimpan, stok outlet dipotong sesuai resep (mutasi "pemakaian")
--    (definisi lengkap = versi sebelumnya + blok potong stok di bawah ini)
-- (diterapkan sebagai migrasi 0033b_transaksi_potong_stok: buat_transaksi + loop geser_stok(..., 'pemakaian', ...) per bahan resep)
