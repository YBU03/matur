-- Provenance is private: legacy/manual Dibeli and Terpasang must never regress.
create table proyek_internal.status_rab_otomatis (
  item_rab_id uuid primary key references public.item_rab(id) on delete cascade
);
alter table proyek_internal.status_rab_otomatis enable row level security;
revoke all on proyek_internal.status_rab_otomatis from public, anon, authenticated;
comment on table proyek_internal.status_rab_otomatis is
  'Internal provenance only; no client access. Status manually recorded before this migration is preserved.';

create function proyek_internal.sinkron_status_rab(p_item uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_proyek uuid; v_status text; v_deleted timestamptz; v_ada boolean;
begin
  select proyek_id into v_proyek from public.item_rab where id=p_item;
  if v_proyek is null then return; end if;
  -- Serialize deferred synchronizations for the same project, without taking
  -- the project-row lock used by save RPCs (cancel RPCs lock notes first).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_proyek::text, 74101));
  select status,deleted_at into v_status,v_deleted from public.item_rab where id=p_item for update;
  if not found then return; end if;
  if v_deleted is not null or v_status not in ('rencana','dibeli') then
    delete from proyek_internal.status_rab_otomatis where item_rab_id=p_item;
    return;
  end if;
  select exists (
    select 1 from public.belanja_proyek_item i
    join public.belanja_proyek b on b.id=i.belanja_id
    where i.item_rab_id=p_item and i.qty>0 and b.batal_at is null
      and b.proyek_id=v_proyek
  ) into v_ada;
  if v_ada and v_status='rencana' then
    update public.item_rab set status='dibeli' where id=p_item;
    insert into proyek_internal.status_rab_otomatis values(p_item) on conflict do nothing;
  elsif not v_ada and v_status='dibeli' and exists (
    select 1 from proyek_internal.status_rab_otomatis where item_rab_id=p_item
  ) then
    update public.item_rab set status='rencana' where id=p_item;
    delete from proyek_internal.status_rab_otomatis where item_rab_id=p_item;
  end if;
end;
$$;
revoke all on function proyek_internal.sinkron_status_rab(uuid) from public,anon,authenticated;

create function proyek_internal.status_rab_dari_realisasi()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_item uuid; v_lama uuid; v_baru uuid;
begin
  if tg_table_name='belanja_proyek_item' then
    if tg_op<>'INSERT' then v_lama:=old.item_rab_id; end if;
    if tg_op<>'DELETE' then v_baru:=new.item_rab_id; end if;
    for v_item in select distinct x from unnest(array[v_lama,v_baru]) x where x is not null order by x loop
      perform proyek_internal.sinkron_status_rab(v_item);
    end loop;
  else
    if tg_op='UPDATE' and old.batal_at is not distinct from new.batal_at
       and old.proyek_id is not distinct from new.proyek_id then return null; end if;
    if tg_op<>'INSERT' then v_lama:=old.id; end if;
    if tg_op<>'DELETE' then v_baru:=new.id; end if;
    for v_item in select distinct item_rab_id from public.belanja_proyek_item
      where belanja_id in (v_lama,v_baru) and item_rab_id is not null order by item_rab_id loop
      perform proyek_internal.sinkron_status_rab(v_item);
    end loop;
  end if;
  return null;
end;
$$;
revoke all on function proyek_internal.status_rab_dari_realisasi() from public,anon,authenticated;

-- Deferred: edits delete/reinsert detail rows. Evaluate the final transaction,
-- avoiding a temporary Rencana -> Dibeli flip and duplicate audit entries.
create constraint trigger status_rab_realisasi_item
  after insert or update or delete on public.belanja_proyek_item
  deferrable initially deferred for each row
  execute function proyek_internal.status_rab_dari_realisasi();
create constraint trigger status_rab_realisasi_nota
  after insert or update or delete on public.belanja_proyek
  deferrable initially deferred for each row
  execute function proyek_internal.status_rab_dari_realisasi();

create function proyek_internal.status_rab_manual()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- A direct status edit owns the status from now on. Synchronizer updates
  -- are nested under a deferred trigger (depth 2), and retain provenance.
  if pg_catalog.pg_trigger_depth()=1 then
    delete from proyek_internal.status_rab_otomatis where item_rab_id=new.id;
  end if;
  return null;
end;
$$;
revoke all on function proyek_internal.status_rab_manual() from public,anon,authenticated;
create trigger status_rab_manual after update of status on public.item_rab
  for each row when (old.status is distinct from new.status)
  execute function proyek_internal.status_rab_manual();

-- Backfill only Rencana linked to active notes. Never claim ownership of
-- existing manually recorded Dibeli, nor alter quantities or payment amounts.
do $$ declare v_item uuid; begin
  for v_item in select distinct r.id from public.item_rab r
    join public.belanja_proyek_item i on i.item_rab_id=r.id
    join public.belanja_proyek b on b.id=i.belanja_id and b.proyek_id=r.proyek_id
    where r.status='rencana' and r.deleted_at is null and b.batal_at is null and i.qty>0
    order by r.id loop
    perform proyek_internal.sinkron_status_rab(v_item);
  end loop;
end $$;
