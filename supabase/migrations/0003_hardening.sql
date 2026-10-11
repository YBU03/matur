-- Fungsi helper RLS tidak perlu bisa dipanggil tanpa login;
-- trigger log tidak boleh dipanggil langsung lewat API.
revoke execute on function punya_peran(peran[]) from public, anon;
revoke execute on function boleh_outlet(uuid) from public, anon;
grant execute on function punya_peran(peran[]) to authenticated;
grant execute on function boleh_outlet(uuid) to authenticated;
revoke execute on function catat_log() from public, anon, authenticated;
