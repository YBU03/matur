-- Financial summary exposes staff names needed for loans without granting access to account records.
create or replace function ringkasan_kasbon(p_outlet uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare staf jsonb; rows jsonb;
begin
 if auth.uid() is null or not punya_peran('{owner,hrd,finance}') then raise exception 'Hanya HRD/Owner/Akunting'; end if;
 if not exists(select 1 from outlet where id=p_outlet and mode='asli' and deleted_at is null) then raise exception 'Outlet tidak ditemukan'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nama',u.nama) order by u.nama),'[]') into staf
 from pengguna u where u.status='aktif' and exists(select 1 from penugasan p where p.pengguna_id=u.id and p.outlet_id=p_outlet and p.peran in ('kasir','barista','spv'));
 select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'nama',u.nama,'tanggal',k.tanggal,'jumlah',k.jumlah,'cicilan',k.cicilan,'catatan',k.catatan,
 'terbayar',coalesce(q.terbayar,0),'draft',coalesce(q.draft,0)) order by k.tanggal desc,k.created_at desc),'[]') into rows
 from kasbon_staf k join pengguna u on u.id=k.pengguna_id
 left join lateral (
  select sum(x.jumlah) filter(where g.status='final') terbayar,sum(x.jumlah) filter(where g.status='draft') draft
  from kasbon_potongan x join slip_gaji s on s.id=x.slip_id join penggajian g on g.id=s.penggajian_id where x.kasbon_id=k.id
 ) q on true where k.outlet_id=p_outlet;
 return jsonb_build_object('staf',staf,'rows',rows);
end $$;
revoke all on function ringkasan_kasbon(uuid) from public,anon;
grant execute on function ringkasan_kasbon(uuid) to authenticated;
