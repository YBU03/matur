import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Alihkan } from "@/components/alihkan";
import { InstallButton } from "@/components/install-button";
import { LiveRefresh } from "@/components/live-refresh";
import { NavBawah, NavSamping } from "@/components/staf/nav";
import { Avatar } from "@/components/staf/ui";
import { LogoutButton } from "@/components/logout-button";
import { BISA_JUAL, POS_ROLES, ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

// Ruang Karyawan (HP pribadi kasir & barista). Bentuk & tata letak mengikuti aplikasi host Makaryo:
// pil melayang di bawah (HP), sidebar (desktop), kartu besar membulat; warna Matoer.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  // pengalihan lewat <Alihkan> (bukan redirect()) agar tidak blank setelah login
  if (!s) return <Alihkan ke="/login" />;
  if (s.active?.role === "tablet") return <Alihkan ke="/pos" />;
  if (!s.assignments.some((a) => POS_ROLES.includes(a.role))) return <Alihkan ke={s.status === "aktif" ? "/dashboard" : "/menunggu"} />;

  const supabase = await supabaseServer();
  // profil wajib lengkap (foto, TTL, alamat KTP, sharelok, kontak darurat); absen tetap boleh agar shift tidak terhambat
  const path = (await headers()).get("x-matur-pathname") ?? "/karyawan";
  const { data: kurang } = await supabase.rpc("profil_kurang", { p_uid: s.userId });
  if ((kurang ?? []).length && !path.startsWith("/karyawan/profil") && !path.startsWith("/karyawan/absen")) return <Alihkan ke="/karyawan/profil#lengkapi" label="Lengkapi profil dulu, ya…" />;
  const [{ count: belumDibaca }, { count: tukarMasuk }] = await Promise.all([
    supabase.from("notifikasi").select("id", { count: "exact", head: true }).eq("pengguna_id", s.userId).is("dibaca_at", null),
    supabase.from("tukar_shift").select("id", { count: "exact", head: true }).eq("rekan_id", s.userId).eq("status", "menunggu_rekan"),
  ]);
  const badge = { "/karyawan/izin": tukarMasuk ?? 0 };
  const peran = s.active && POS_ROLES.includes(s.active.role) ? ROLES[s.active.role].label : "Karyawan";
  const outlet = s.active?.outletId ? s.active.outletNama : "Pilih outlet";
  const bisaPos = !!s.active && BISA_JUAL.includes(s.active.role);
  const n = belumDibaca ?? 0;

  const lonceng = (
    <Link href="/karyawan/notifikasi" className="relative grid size-11 place-items-center rounded-full hover:bg-matur-50" aria-label={`Notifikasi${n ? `, ${n} belum dibaca` : ""}`}>
      <Bell className="size-5 text-kopi-900" aria-hidden />
      {!!n && <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{n > 9 ? "9+" : n}</span>}
    </Link>
  );

  return (
    <div className="min-h-dvh bg-krem">
      <LiveRefresh pantau={[{ table: "notifikasi", filter: `pengguna_id=eq.${s.userId}` }]} cadanganDetik={120} />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col overflow-y-auto border-r border-garis bg-white p-4 lg:flex">
        <Link href="/karyawan" className="mb-6 flex items-center gap-2 px-2">
          <Image src="/brand/logo-192.png" alt="" width={36} height={36} className="rounded-xl" />
          <span className="leading-tight">
            <span className="block text-lg font-extrabold text-kopi-900">Matoer</span>
            <span className="block text-[11px] font-semibold text-redup">Ruang Karyawan</span>
          </span>
        </Link>
        <NavSamping badge={badge} tambahan={bisaPos ? [{ href: "/pos", label: "Buka POS (tablet)" }] : undefined} />
        <div className="mt-auto space-y-3 pt-4">
          <InstallButton />
          <div className="flex items-center gap-2 rounded-2xl bg-krem p-2">
            <Avatar nama={s.nama} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-semibold text-kopi-900">{s.nama}</p>
              <p className="truncate text-[11px] text-redup">
                {peran} · {outlet}
              </p>
            </div>
            {lonceng}
          </div>
          <LogoutButton className="flex w-full items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" />
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-garis bg-krem/90 px-4 backdrop-blur lg:hidden">
          <Link href="/karyawan" className="flex items-center gap-2">
            <Image src="/brand/logo-192.png" alt="" width={32} height={32} className="rounded-xl" />
            <span className="text-base font-extrabold text-kopi-900">Matoer</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {lonceng}
            <Link href="/karyawan/profil" aria-label="Profil">
              <Avatar nama={s.nama} />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
      </div>
      <NavBawah badge={badge} />
    </div>
  );
}
