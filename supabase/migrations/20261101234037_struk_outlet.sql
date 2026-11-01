-- Pengaturan isi struk POS per outlet (kepala, alamat, telepon, kaki struk). Bisa diubah kapan saja.
create schema if not exists struk_internal;
revoke all on schema struk_internal from public, anon;
grant usage on schema struk_internal to authenticated;

create table public.struk_outlet (
  outlet_id uuid primary key references public.outlet(id) on delete cascade,
  judul text not null default 'RUMA' check (length(judul) <= 40),
  alamat text not null default '' check (length(alamat) <= 200),
  telepon text not null default '' check (length(telepon) <= 40),
  instagram text not null default 'di.rumakopi' check (length(instagram) <= 60),
  wifi text not null default 'keluargaruma' check (length(wifi) <= 60),
  tagline text not null default 'tempat ngopi, tempat pulang' check (length(tagline) <= 80),
  hashtag text not null default '#RUMAKOPI' check (length(hashtag) <= 60),
  catatan text not null default '' check (length(catatan) <= 300),
  tampil_logo boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.struk_outlet enable row level security;
create policy struk_outlet_baca on public.struk_outlet for select to authenticated using (public.boleh_outlet(outlet_id));
grant select on public.struk_outlet to authenticated;

insert into public.struk_outlet(outlet_id) select id from public.outlet where deleted_at is null on conflict do nothing;
update public.struk_outlet s set alamat = 'Jl. Komisaris Noto Sumarsono No.23, Purbalingga Kidul', telepon = '085869288356'
  from public.outlet o where o.id = s.outlet_id and o.nama ilike '%kominot%';

create function struk_internal.atur(p jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := (p->>'outlet_id')::uuid;
begin
  if not public.punya_peran(array['owner','admin_pusat','admin_gudang']::public.peran[]) then
    raise exception 'Hanya Owner / Admin Pusat / Admin Gudang yang boleh mengubah struk';
  end if;
  if o is null or not exists (select 1 from public.outlet where id = o and deleted_at is null) then raise exception 'Outlet tidak ditemukan'; end if;
  insert into public.struk_outlet(outlet_id, judul, alamat, telepon, instagram, wifi, tagline, hashtag, catatan, tampil_logo, updated_at, updated_by)
  values (o, coalesce(nullif(trim(p->>'judul'), ''), 'RUMA'), trim(coalesce(p->>'alamat', '')), trim(coalesce(p->>'telepon', '')),
          trim(coalesce(p->>'instagram', '')), trim(coalesce(p->>'wifi', '')), trim(coalesce(p->>'tagline', '')),
          trim(coalesce(p->>'hashtag', '')), trim(coalesce(p->>'catatan', '')), coalesce((p->>'tampil_logo')::boolean, true), now(), auth.uid())
  on conflict (outlet_id) do update set judul = excluded.judul, alamat = excluded.alamat, telepon = excluded.telepon,
    instagram = excluded.instagram, wifi = excluded.wifi, tagline = excluded.tagline, hashtag = excluded.hashtag,
    catatan = excluded.catatan, tampil_logo = excluded.tampil_logo, updated_at = now(), updated_by = auth.uid();
  insert into public.log_aktivitas(pengguna_id, aksi, entitas, nilai_baru) values (auth.uid(), 'atur_struk_outlet', 'struk_outlet', p);
end $$;
create function public.atur_struk_outlet(p jsonb) returns void language sql security invoker set search_path = '' as $$ select struk_internal.atur(p) $$;
revoke all on function struk_internal.atur(jsonb) from public, anon;
grant execute on function struk_internal.atur(jsonb) to authenticated;
revoke all on function public.atur_struk_outlet(jsonb) from public, anon;
grant execute on function public.atur_struk_outlet(jsonb) to authenticated;
