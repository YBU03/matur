-- Owner, Admin Pusat & Finance boleh memilih skema bagi hasil outlet (hanya kolom ini, bukan data outlet lain)
create or replace function atur_skema_outlet(p_outlet uuid, p_skema uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Tidak diizinkan'; end if;
  if p_skema is not null and not exists (select 1 from skema_bagi_hasil where id = p_skema and deleted_at is null) then raise exception 'Skema tidak ditemukan'; end if;
  update outlet set skema_bagi_hasil_id = p_skema where id = p_outlet;
  if not found then raise exception 'Outlet tidak ditemukan'; end if;
end $$;
revoke execute on function atur_skema_outlet(uuid, uuid) from public, anon;
grant execute on function atur_skema_outlet(uuid, uuid) to authenticated;
