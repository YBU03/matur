-- Simulasi internal khusus ID Outlet Demo. Tidak menyentuh mesin transaksi/ledger produksi.
create schema qris_demo_internal;
revoke all on schema qris_demo_internal from public;
grant usage on schema qris_demo_internal to anon,authenticated;
create table qris_demo_internal.pesanan(
 id uuid primary key default gen_random_uuid(), client_id uuid not null unique,
 nomor bigint generated always as identity, outlet_id uuid not null check(outlet_id='dc2f5309-5f4a-4bed-9cb8-3f93c8e2d146'),
 pembuat uuid not null references public.pengguna(id), token text not null unique default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
 checkout jsonb not null, lines jsonb not null, subtotal bigint not null, diskon bigint not null,total bigint not null check(total>0),
 status text not null default 'pending' check(status in ('pending','paid','cancelled')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes', paid_at timestamptz
);
alter table qris_demo_internal.pesanan enable row level security;
revoke all on qris_demo_internal.pesanan from public,anon,authenticated;
create policy deny_direct on qris_demo_internal.pesanan for all to authenticated using(false) with check(false);
create function qris_demo_internal.boleh(o uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select o='dc2f5309-5f4a-4bed-9cb8-3f93c8e2d146'::uuid and auth.uid() is not null and exists(
 select 1 from public.pengguna u join public.penugasan p on p.pengguna_id=u.id where u.id=auth.uid() and u.status='aktif'
 and (p.peran in ('owner','admin_pusat') or (p.outlet_id=o and p.peran in ('tablet','kasir','barista','spv','hrd','admin_gudang'))));
$$;
revoke all on function qris_demo_internal.boleh(uuid) from public,anon;
grant execute on function qris_demo_internal.boleh(uuid) to authenticated;
create function qris_demo_internal.pos(a text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r qris_demo_internal.pesanan;it jsonb;m public.menu;v public.varian;price bigint;sub bigint:=0;disc bigint;qty int;ls jsonb:='[]';vid text;nm text;ids text[];
begin
 if not qris_demo_internal.boleh(o) then raise exception 'Simulasi hanya untuk akun Outlet Demo';end if;
 if a='history' then return coalesce((select jsonb_agg((to_jsonb(x)-'token'-'checkout')||jsonb_build_object('kanal',x.checkout->>'kanal')) from (select * from qris_demo_internal.pesanan where outlet_id=o order by created_at desc limit 50)x),'[]');end if;
 if a in ('status','cancel') then
 select * into r from qris_demo_internal.pesanan where id=(p->>'id')::uuid and outlet_id=o for update;
 if r.id is null then raise exception 'Simulasi tidak ditemukan';end if;
 if a='cancel' and r.status='pending' then update qris_demo_internal.pesanan set status='cancelled' where id=r.id returning * into r;end if;
 else
 if a<>'create' then raise exception 'Aksi tidak valid';end if;
 if not exists(select 1 from public.outlet where id=o and qris_mode='dinamis' and deleted_at is null) then raise exception 'Aktifkan QRIS Dinamis di Outlet Demo dahulu';end if;
 if octet_length(p::text)>16000 or coalesce(p->>'metode','')<>'qris' or p ? 'pembayaran' or nullif(p->>'draft_id','') is not null then raise exception 'Simulasi memakai QRIS penuh tanpa split/draft';end if;
 perform pg_advisory_xact_lock(hashtext('qris-demo:'||(p->>'client_id')));
 select * into r from qris_demo_internal.pesanan where client_id=(p->>'client_id')::uuid for update;
 if r.id is not null then
 if r.checkout is distinct from p or r.outlet_id<>o then raise exception 'ID percobaan sudah dipakai keranjang lain';end if;
 else
 if jsonb_typeof(p->'items')<>'array' or coalesce(jsonb_array_length(p->'items'),0) not between 1 and 100 then raise exception 'Keranjang tidak valid';end if;
 if coalesce(p->>'kanal','') not in ('langsung','gofood','grabfood','shopeefood','tiktok','ruma_app','tumbler') then raise exception 'Kanal tidak valid';end if;
 for it in select * from jsonb_array_elements(p->'items') loop
 select * into m from public.menu where id=(it->>'menu_id')::uuid and aktif and mode='asli' and deleted_at is null;
 qty:=(it->>'qty')::int;if m.id is null or qty is null or qty not between 1 and 100 then raise exception 'Menu/jumlah tidak valid';end if;
 price:=case when p->>'kanal' in ('gofood','grabfood','shopeefood','tiktok') then m.harga_ojol else m.harga_langsung end;nm:=m.nama;ids:='{}';
 for vid in select jsonb_array_elements_text(coalesce(it->'varian_ids','[]')) loop
 if vid=any(ids) then raise exception 'Varian duplikat';end if;ids:=array_append(ids,vid);
 select * into v from public.varian where id=vid::uuid and menu_id=m.id and mode='asli' and deleted_at is null;
 if v.id is null then raise exception 'Varian tidak sesuai';end if;price:=price+v.tambahan_harga;nm:=nm||' · '||v.nama;
 end loop;
 if price<0 then raise exception 'Harga tidak valid';end if;
 sub:=sub+price*qty;ls:=ls||jsonb_build_array(jsonb_build_object('key',jsonb_array_length(ls)::text,'nama',nm,'qty',qty,'total',price*qty));
 end loop;
 disc:=coalesce((p->>'diskon')::bigint,0);if disc<0 or disc>=sub then raise exception 'Diskon/total tidak valid';end if;
 insert into qris_demo_internal.pesanan(client_id,outlet_id,pembuat,checkout,lines,subtotal,diskon,total) values((p->>'client_id')::uuid,o,auth.uid(),p,ls,sub,disc,sub-disc) returning * into r;
 end if;
 end if;
 return (to_jsonb(r)-'pembuat'-'checkout')||jsonb_build_object('kembalian',0,'simulasi',true,'kanal',r.checkout->>'kanal','status',case when r.status='pending' and r.expires_at<=now() then 'expired' else r.status end);
end $$;
revoke all on function qris_demo_internal.pos(text,uuid,jsonb) from public,anon;
grant execute on function qris_demo_internal.pos(text,uuid,jsonb) to authenticated;
create function public.qris_demo_pos(a text,o uuid,p jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select qris_demo_internal.pos(a,o,p)$$;
revoke all on function public.qris_demo_pos(text,uuid,jsonb) from public,anon;
grant execute on function public.qris_demo_pos(text,uuid,jsonb) to authenticated;
-- Kemampuan membaca/membayar hanya melalui token acak 256 bit, tanpa PII/checkout.
create function qris_demo_internal.publik(t text,bayar boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r qris_demo_internal.pesanan;
begin
 if t is null or t !~ '^[a-f0-9]{64}$' then raise exception 'Tautan simulasi tidak valid';end if;
 select * into r from qris_demo_internal.pesanan where token=t for update;
 if r.id is null then raise exception 'Tautan simulasi tidak ditemukan';end if;
 if bayar and r.status='pending' then
 if r.expires_at<=now() then raise exception 'QR simulasi kedaluwarsa';end if;
 if not exists(select 1 from public.outlet where id=r.outlet_id and qris_mode='dinamis' and deleted_at is null) then raise exception 'Simulasi dinonaktifkan';end if;
 update qris_demo_internal.pesanan set status='paid',paid_at=now() where id=r.id returning * into r;
 end if;
 return jsonb_build_object('nomor',r.nomor,'total',r.total,'expires_at',r.expires_at,'status',case when r.status='pending' and r.expires_at<=now() then 'expired' else r.status end);
end $$;
revoke all on function qris_demo_internal.publik(text,boolean) from public;
grant execute on function qris_demo_internal.publik(text,boolean) to anon,authenticated;
create function public.qris_demo_publik(t text,bayar boolean default false) returns jsonb language sql security invoker set search_path='' as $$select qris_demo_internal.publik(t,bayar)$$;
revoke all on function public.qris_demo_publik(text,boolean) from public;
grant execute on function public.qris_demo_publik(text,boolean) to anon,authenticated;
