-- Owner-approved classification of the existing shared RUMA catalogue only.
-- Run after menu_coffee_series migration. Uses authenticated RLS and existing audit trigger.
begin;
select set_config('request.jwt.claim.sub','f1e0a66c-55f7-4f04-81b8-965d24a597ab',true);
set local role authenticated;
create temporary table coffee_before on commit drop as select id,to_jsonb(m)-array['kategori_id','penyajian','jenis_kemasan'] protected from public.menu m;
create temporary table coffee_map(nama text primary key,lama text,kategori text,penyajian text,kemasan text) on commit drop;
insert into coffee_map values
 ('Berry Manuka Americano','Ice','Coffee Series','ice','Cup'),
 ('Butterscotch Latte','Ice','Coffee Series','ice','Cup'),
 ('Black Aren','Ice','Coffee Series','ice','Cup'),
 ('Black Coffee','Ice','Coffee Series','ice','Cup'),
 ('Black Honey Orange','Ice','Coffee Series','ice','Cup'),
 ('Cappucino','Ice','Coffee Series','ice','Cup'),
 ('Caramel Latte','Ice','Coffee Series','ice','Cup'),
 ('Kopi Susu Keluarga','Ice','Coffee Series','ice','Cup'),
 ('Mocachino','Ice','Coffee Series','ice','Cup'),
 ('Salted Caramel Latte','Ice','Coffee Series','ice','Cup'),
 ('Hot Black Coffee','Hot','Coffee Series','hot','Cup'),
 ('Hot Cappucino','Hot','Coffee Series','hot','Cup'),
 ('Hot Caramel Latte','Hot','Coffee Series','hot','Cup'),
 ('Hot Kopi Susu Keluarga','Hot','Coffee Series','hot','Cup'),
 ('Hot Mochaccino','Hot','Coffee Series','hot','Cup'),
 ('Cappucino Can Series','Can Series','Coffee Series',null,'Can'),
 ('KSK Can Series','Can Series','Coffee Series',null,'Can'),
 ('Caramel Can Series','Can Series','Coffee Series',null,'Can'),
 ('Hot Chocolate','Hot','Non-Coffee','hot','Cup'),
 ('Hot Matcha Latte','Hot','Non-Coffee','hot','Cup'),
 ('Strawberry Matcha Latte','Non-Coffee','Non-Coffee','ice','Cup'),
 ('Chocolate','Non-Coffee','Non-Coffee','ice','Cup'),
 ('Brown Sugar Matcha','Non-Coffee','Non-Coffee','ice','Cup'),
 ('Teh Java','Non-Coffee','Non-Coffee','ice','Cup'),
 ('Lemonade','Non-Coffee','Non-Coffee','ice','Cup'),
 ('Lychee Tea','Non-Coffee','Non-Coffee','ice','Cup'),
 ('Matcha Latte','Non-Coffee','Non-Coffee','ice','Cup'),
 ('Milo Dino','Non-Coffee','Non-Coffee','ice','Cup'),
 ('Matcha Cookies','Non-Coffee','Non-Coffee','ice','Cup'),
 ('Mineral Water','Non-Coffee','Non-Coffee',null,'Botol');
-- Require exactly one active shared row for each expected menu; fail rather than guess.
do $$begin
 if exists(select 1 from coffee_map x where (select count(*) from public.menu m join public.kategori_menu k on k.id=m.kategori_id where m.nama=x.nama and m.outlet_id is null and m.mode='asli' and m.deleted_at is null and k.nama in(x.lama,x.kategori))<>1) then raise exception 'Katalog berubah: periksa pemetaan dahulu';end if;
end$$;
insert into public.kategori_menu(mode,nama,urutan) select 'asli','Coffee Series',1 where not exists(select 1 from public.kategori_menu where mode='asli' and deleted_at is null and nama='Coffee Series');
update public.kategori_menu set urutan=1 where mode='asli' and deleted_at is null and nama='Coffee Series' and urutan<>1;
update public.menu m set kategori_id=k.id,penyajian=x.penyajian,jenis_kemasan=x.kemasan
from coffee_map x,public.kategori_menu k where m.nama=x.nama and m.mode='asli' and m.outlet_id is null and m.deleted_at is null and k.mode='asli' and k.deleted_at is null and k.nama=x.kategori
 and (m.kategori_id,m.penyajian,m.jenis_kemasan) is distinct from (k.id,x.penyajian,x.kemasan);
do $$begin
 if exists(select 1 from coffee_before b full join public.menu m on m.id=b.id where b.protected is distinct from (to_jsonb(m)-array['kategori_id','penyajian','jenis_kemasan'])) then raise exception 'Kolom menu terlindungi berubah';end if;
end$$;
select k.nama,m.penyajian,m.jenis_kemasan,count(*) jumlah from public.menu m join public.kategori_menu k on k.id=m.kategori_id where m.mode='asli' and m.deleted_at is null group by k.nama,m.penyajian,m.jenis_kemasan order by k.nama,m.penyajian;
commit;
