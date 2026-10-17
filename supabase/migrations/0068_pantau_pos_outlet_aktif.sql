-- Pemantau POS: abaikan outlet yang sudah dihapus
create or replace function matur_internal.outlet_pantau()
returns setof uuid language sql stable security definer set search_path = public as $$
  select o.id from outlet o
  where o.deleted_at is null and exists (
    select 1 from penugasan t join pengguna u on u.id = t.pengguna_id and u.status = 'aktif'
    where t.pengguna_id = auth.uid()
      and (t.peran = 'owner' or (t.peran = 'pemantau_pos' and (t.outlet_id is null or t.outlet_id = o.id)))
  );
$$;
revoke all on function matur_internal.outlet_pantau() from public, anon, authenticated;
