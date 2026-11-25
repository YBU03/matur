CREATE OR REPLACE FUNCTION public.punya_peran(p peran[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from penugasan t join pengguna u on u.id = t.pengguna_id
                 where t.pengguna_id = auth.uid() and u.status = 'aktif' and t.peran = any(p));
$function$;

CREATE OR REPLACE FUNCTION public.boleh_outlet(o uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from penugasan t
    join pengguna u on u.id = t.pengguna_id and u.status = 'aktif'
    left join outlet x on x.id = o
    where t.pengguna_id = auth.uid()
      and (t.outlet_id = o
           or (t.outlet_id is null and t.peran in ('owner','finance','hrd','admin_pusat','admin_gudang'))
           or (t.peran = 'manajer_area' and t.area_id = x.area_id))
  );
$function$;

CREATE OR REPLACE FUNCTION matur_internal.outlet_pantau()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id from outlet o
  where o.deleted_at is null and exists (
    select 1 from penugasan t join pengguna u on u.id = t.pengguna_id and u.status = 'aktif'
    where t.pengguna_id = auth.uid()
      and (t.peran = 'owner' or (t.peran = 'pemantau_pos' and (t.outlet_id is null or t.outlet_id = o.id)))
  );
$function$;
