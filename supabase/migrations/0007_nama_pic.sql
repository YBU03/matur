-- MTR-01: mitra melihat nama PIC pekerjaan di proyek outletnya
create policy baca_pic on pengguna for select to authenticated using (
  exists (select 1 from pekerjaan k where k.pic_id = pengguna.id and k.deleted_at is null
          and (admin_proyek() or boleh_outlet(proyek_outlet(k.proyek_id))))
);
