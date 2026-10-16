-- Selesaikan proyek pembangunan: status selesai + tanggal selesai, outlet berubah menjadi operasional
-- (portal mitra ikut menampilkan "pembangunan selesai"). Bisa dibuka kembali bila salah tandai.
alter table proyek add column if not exists selesai_at timestamptz;
alter table proyek add column if not exists selesai_oleh uuid references pengguna;
create index if not exists proyek_selesai_oleh_idx on proyek(selesai_oleh);

create or replace function public.selesaikan_proyek(p_id uuid, p_selesai boolean, p_tgl date default null) returns void
language plpgsql security definer set search_path = public as $$
declare pr proyek;
begin
  if auth.uid() is null or not punya_peran('{owner,admin_pusat}') then raise exception 'Hanya Owner/Admin Pusat'; end if;
  select * into pr from proyek where id = p_id and deleted_at is null for update;
  if pr.id is null then raise exception 'Proyek tidak ditemukan'; end if;
  if p_selesai then
    update proyek set status = 'selesai', selesai_at = coalesce(p_tgl::timestamp at time zone 'Asia/Jakarta', now()), selesai_oleh = auth.uid(),
           target_buka = coalesce(target_buka, coalesce(p_tgl, (now() at time zone 'Asia/Jakarta')::date))
     where id = p_id;
    update outlet set status = 'operasional', tgl_mulai = coalesce(tgl_mulai, p_tgl, (now() at time zone 'Asia/Jakarta')::date)
     where id = pr.outlet_id and status = 'pembangunan';
  else
    update proyek set status = 'berjalan', selesai_at = null, selesai_oleh = null where id = p_id;
    update outlet set status = 'pembangunan' where id = pr.outlet_id and status = 'operasional'
      and not exists (select 1 from transaksi where outlet_id = pr.outlet_id and mode = 'asli');
  end if;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru)
    values (auth.uid(), case when p_selesai then 'proyek_selesai' else 'proyek_dibuka_kembali' end, 'proyek', p_id::text, jsonb_build_object('tgl', p_tgl));
end $$;
revoke all on function selesaikan_proyek(uuid, boolean, date) from public, anon;
grant execute on function selesaikan_proyek(uuid, boolean, date) to authenticated;
