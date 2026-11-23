-- Read outlet/menu eligibility once per catalogue, not once per recipe/variant row.
create or replace function matur_internal.katalog_pos(o uuid) returns jsonb
language sql stable security definer set search_path=public,extensions as $$
 with selected as materialized (
  select m.* from menu m join outlet ot on ot.id=o
  where m.mode='asli' and m.mode=ot.mode and ot.deleted_at is null
   and (m.outlet_id=o or (m.outlet_id is null and ot.katalog_bersama))
 )
 select jsonb_build_object(
 'menu',(select coalesce(jsonb_object_agg(id::text,jsonb_build_object('langsung',harga_langsung,'ojol',harga_ojol)),'{}') from selected where aktif and deleted_at is null),
 'varian',(select coalesce(jsonb_object_agg(id::text,tambahan_harga),'{}') from varian where mode='asli' and deleted_at is null and menu_id in(select id from selected)),
 'resep_hash',encode(digest(
  coalesce((select jsonb_agg(to_jsonb(r)-'outlet_id' order by r.id)::text from resep r where mode='asli' and deleted_at is null and menu_id in(select id from selected)),'[]')||
  coalesce((select jsonb_agg(jsonb_build_array(id,harga_pokok) order by id)::text from bahan where mode='asli' and deleted_at is null),'[]')||
  coalesce((select jsonb_agg(jsonb_build_array(id,titipan,harga_titip) order by id)::text from selected where deleted_at is null),'[]'),
 'sha256'),'hex')) where auth.uid() is not null
$$;
revoke all on function matur_internal.katalog_pos(uuid) from public,anon,authenticated;
