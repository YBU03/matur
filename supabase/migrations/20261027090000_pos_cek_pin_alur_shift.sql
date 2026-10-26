-- Cek PIN outlet lebih awal (langkah PIN di layar mulai shift) tanpa membuka kas.
-- Memakai verifier_pin yang sama: akun tablet + perangkat outlet, batas 8 salah / menit.
create function pos_kas_internal.cek_pin_shift(o uuid,d text,pin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e text;
begin
 if coalesce(pin,'') !~ '^[0-9]{4,6}$' then return jsonb_build_object('error','PIN outlet terdiri dari 4–6 angka');end if;
 e:=pos_kas_internal.verifier_pin(o,d,pin);
 if e is not null then return jsonb_build_object('error',e);end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.cek_pin_alur_shift(p_outlet uuid,p_device text,p_pin text) returns jsonb
language sql security invoker set search_path='' as $$ select pos_kas_internal.cek_pin_shift(p_outlet,p_device,p_pin) $$;
revoke all on function pos_kas_internal.cek_pin_shift(uuid,text,text),public.cek_pin_alur_shift(uuid,text,text) from public,anon;
grant execute on function pos_kas_internal.cek_pin_shift(uuid,text,text),public.cek_pin_alur_shift(uuid,text,text) to authenticated;
