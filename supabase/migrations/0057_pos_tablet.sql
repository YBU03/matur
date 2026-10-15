-- POS tablet outlet: satu URL (/pos), tablet dipasangkan sekali oleh admin/SPV dengan "akun tablet"
-- tersembunyi (peran 'tablet'), operator = anggota tim yang terakhir membuka kunci PIN.
-- (nilai enum 'tablet' ditambahkan di 0056_peran_tablet)

-- akun tablet memenuhi pemeriksaan outlet untuk kasir/barista (bukan SPV/peran lain)
create or replace function public.peran_di_outlet(p_outlet uuid, p peran[]) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from penugasan t join pengguna u on u.id = t.pengguna_id
                 where t.pengguna_id = auth.uid() and u.status = 'aktif' and t.outlet_id = p_outlet
                   and (t.peran = any(p) or (t.peran = 'tablet' and p && '{kasir,barista}'::peran[])));
$$;

alter table pengguna add column if not exists akun_tablet boolean not null default false;
alter table pos_perangkat add column if not exists mode text not null default 'kasir' check (mode in ('kasir','antrean'));
alter table pos_perangkat add column if not exists akun_id uuid references pengguna;
create index if not exists pos_perangkat_akun_id_idx on pos_perangkat(akun_id);
alter table transaksi add column if not exists operator_id uuid references pengguna;
alter table transaksi add column if not exists operator_nama text;
create index if not exists transaksi_operator_id_idx on transaksi(operator_id);

-- admin (Owner/HRD/Admin Gudang) atau SPV outlet memasangkan tablet: buat akun tablet + perangkat aktif
create or replace function public.pasang_tablet_pos(p_outlet uuid, p_nama text, p_mode text, p_rahasia text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid(); dev uuid; v_email text; v_outlet text; v_nama text := left(trim(coalesce(p_nama,'')),100);
begin
  if auth.uid() is null or not (punya_peran('{owner,hrd,admin_gudang}') or exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id and u.status='aktif' where t.pengguna_id=auth.uid() and t.outlet_id=p_outlet and t.peran='spv')) then
    raise exception 'Hanya Owner/HRD/Admin Gudang atau SPV outlet ini yang dapat memasangkan tablet';
  end if;
  select nama into v_outlet from outlet where id = p_outlet and deleted_at is null;
  if v_outlet is null then raise exception 'Outlet tidak ditemukan'; end if;
  if length(v_nama) < 3 then raise exception 'Nama tablet minimal 3 huruf'; end if;
  if coalesce(p_mode,'') not in ('kasir','antrean') then raise exception 'Mode tablet tidak valid'; end if;
  if length(coalesce(p_rahasia,'')) < 40 or length(coalesce(p_password,'')) < 24 then raise exception 'Identitas perangkat tidak valid'; end if;
  if exists(select 1 from matur_internal.pos_perangkat_rahasia where hash = encode(digest(p_rahasia,'sha256'),'hex')) then raise exception 'Perangkat sudah terdaftar'; end if;
  v_email := 'tablet-' || substr(replace(uid::text,'-',''),1,12) || '@tablet.matur.id';
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nama', 'Tablet ' || v_nama), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', v_email), 'email', now(), now(), now());
  insert into pengguna (id, nama, email, status, akun_tablet) values (uid, 'Tablet ' || v_nama, v_email, 'aktif', true);
  insert into penugasan (pengguna_id, peran, outlet_id) values (uid, 'tablet', p_outlet);
  insert into pos_perangkat (outlet_id, nama, status, diminta_oleh, disetujui_oleh, mode, akun_id)
    values (p_outlet, v_nama, 'aktif', auth.uid(), auth.uid(), p_mode, uid) returning id into dev;
  insert into matur_internal.pos_perangkat_rahasia values (dev, encode(digest(p_rahasia,'sha256'),'hex'));
  insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru)
    values (auth.uid(),'pasang_tablet','pos_perangkat',dev::text,jsonb_build_object('outlet',v_outlet,'nama',v_nama,'mode',p_mode));
  return jsonb_build_object('email', v_email, 'perangkat_id', dev, 'outlet', v_outlet);
end $$;
revoke all on function pasang_tablet_pos(uuid,text,text,text,text) from public, anon;
grant execute on function pasang_tablet_pos(uuid,text,text,text,text) to authenticated;

-- outlet yang boleh dipasangi tablet oleh pemanggil
create or replace function public.outlet_pasang_tablet() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'nama', o.nama) order by o.nama), '[]')
  from outlet o
  where o.deleted_at is null and auth.uid() is not null
    and (punya_peran('{owner,hrd,admin_gudang}')
         or exists(select 1 from penugasan t join pengguna u on u.id=t.pengguna_id and u.status='aktif' where t.pengguna_id=auth.uid() and t.outlet_id=o.id and t.peran='spv'));
$$;
revoke all on function outlet_pasang_tablet() from public, anon;
grant execute on function outlet_pasang_tablet() to authenticated;

-- cabut/aktifkan tablet: juga SPV outlet; akun tablet ikut nonaktif/aktif
create or replace function public.atur_tablet_pos(p_id uuid,p_aktif boolean,p_alasan text) returns void
language plpgsql security definer set search_path=public as $$
declare d pos_perangkat;
begin
 select * into d from pos_perangkat where id=p_id;
 if d.id is null then raise exception 'Perangkat tidak ditemukan';end if;
 if auth.uid() is null or not (punya_peran('{owner,hrd,admin_gudang}') or exists(select 1 from penugasan where pengguna_id=auth.uid() and outlet_id=d.outlet_id and peran='spv')) then raise exception 'Hanya admin perangkat';end if;
 if length(trim(coalesce(p_alasan,'')))<3 then raise exception 'Alasan wajib';end if;
 update pos_perangkat set status=case when p_aktif then 'aktif' else 'dicabut' end,disetujui_oleh=auth.uid(),diubah_at=now() where id=p_id;
 if d.akun_id is not null then update pengguna set status=case when p_aktif then 'aktif' else 'nonaktif' end where id=d.akun_id and akun_tablet; end if;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'akses_tablet','pos_perangkat',p_id::text,jsonb_build_object('aktif',p_aktif,'alasan',p_alasan));
end $$;

-- buka kunci: semua anggota tim (termasuk barista) boleh; membuka shift baru tetap wajib akses kasir
do $$ declare d text; d0 text; begin
 d:=pg_get_functiondef('public.buka_pos_tim(uuid,text,text,text,bigint,uuid[],text)'::regprocedure); d0:=d;
 d:=replace(d,'peran in (''kasir'',''spv'')) then raise exception ''Petugas tidak memiliki akses kasir outlet ini'';end if;',
              'peran in (''kasir'',''barista'',''spv'')) then raise exception ''Petugas tidak terdaftar di outlet ini'';end if;');
 d:=replace(d,'if p_anggota is null or not uid=any(p_anggota)',
              'if not exists(select 1 from penugasan where pengguna_id=uid and outlet_id=p_outlet and peran in (''kasir'',''spv'')) then raise exception ''Pembuka shift harus anggota dengan akses kasir (menghitung modal laci)'';end if;
  if p_anggota is null or not uid=any(p_anggota)');
 if d=d0 or position('akses kasir (menghitung' in d)=0 or position('tidak terdaftar di outlet ini' in d)=0 then raise exception 'patch buka_pos_tim gagal'; end if;
 execute d;

 d:=pg_get_functiondef('public.status_pos_tim(uuid,text,text,boolean)'::regprocedure); d0:=d;
 d:=replace(d,'where u.id=iz.diverifikasi_oleh and u.status=''aktif'' and t.outlet_id=p_outlet and t.peran in (''kasir'',''spv''));',
              'where u.id=iz.diverifikasi_oleh and u.status=''aktif'' and t.outlet_id=p_outlet and t.peran in (''kasir'',''barista'',''spv''));');
 d:=replace(d,'''roster'',roster);',
   '''roster'',roster,''mode'',coalesce(dev.mode,''kasir''),
 ''operator'',(select jsonb_build_object(''id'',u.id,''nama'',u.nama,''kasir'',exists(select 1 from penugasan t where t.pengguna_id=u.id and t.outlet_id=p_outlet and t.peran in (''kasir'',''spv''))) from pengguna u where iz.id is not null and u.id=iz.diverifikasi_oleh),
 ''omzet'',(select jsonb_build_object(''total'',coalesce(sum(total),0),''jumlah'',count(*)) from transaksi where s.id is not null and sesi_kas_id=s.id and status=''lunas''));');
 if d=d0 or position('''operator''' in d)=0 or position('''kasir'',''barista'',''spv''));' in d)=0 then raise exception 'patch status_pos_tim gagal'; end if;
 execute d;

 d:=pg_get_functiondef('public.buat_transaksi(jsonb)'::regprocedure); d0:=d;
 d:=replace(d,'update transaksi set pos_payload_hash=h,',
              'update transaksi set operator_id=iz.diverifikasi_oleh,operator_nama=(select nama from pengguna where id=iz.diverifikasi_oleh),pos_payload_hash=h,');
 if d=d0 then raise exception 'patch buat_transaksi gagal'; end if;
 execute d;
end $$;
