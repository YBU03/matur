import Link from "next/link";
import { LogOut } from "lucide-react";
import { InstallButton } from "@/components/install-button";
import { Avatar, Kartu, KepalaKartu, tombol } from "@/components/staf/ui";
import { logoutAction } from "@/lib/actions";
import { ROLES } from "@/lib/roles";
import { redirect } from "next/navigation";
import { POS_ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { FormDataDiri, FormGantiKunci } from "./form-profil";

export default async function ProfilStaf() {
  const s = await getSession();
  if (!s) redirect("/login");
  const a = s.active?.outletId && POS_ROLES.includes(s.active.role) ? s.active : null;
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("pengguna").select("nama, email, no_hp").eq("id", s.userId).single();
  const pin = p?.email?.endsWith("@pin.matur.id") ?? false;
  const kode = pin ? p!.email!.replace("@pin.matur.id", "") : p?.email;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-4 rounded-[var(--radius-kartu)] bg-gradient-to-br from-matur-500 to-kopi-700 p-5 text-white shadow-[var(--shadow-melayang)]">
        <span className="rounded-full ring-4 ring-white/30">
          <Avatar nama={p?.nama ?? s.nama} besar />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold">{p?.nama ?? s.nama}</h1>
          <p className="truncate text-[13px] text-white/85">{pin ? `Kode staf: ${kode}` : kode}</p>
          <p className="mt-1 text-[12px] font-semibold text-white/80">
            {a ? `${ROLES[a.role].label} · ${a.outletNama}` : "Belum memilih outlet"}
          </p>
        </div>
      </div>
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
        <Kartu>
          <KepalaKartu judul="Data diri" keterangan="Nomor HP dipakai HRD untuk menghubungi." />
          <FormDataDiri nama={p?.nama ?? ""} hp={p?.no_hp ?? ""} />
        </Kartu>
        <Kartu>
          <KepalaKartu judul={pin ? "Ganti PIN" : "Ganti password"} keterangan={pin ? "PIN 4–6 angka untuk masuk dengan kode staf." : "Minimal 8 karakter."} />
          <FormGantiKunci pin={pin} />
        </Kartu>
      </div>
      {s.assignments.filter((x) => POS_ROLES.includes(x.role)).length > 1 && (
        <Kartu>
          <KepalaKartu judul="Tempat bertugas" keterangan="Ketuk untuk pindah outlet." />
          <div className="space-y-2">
            {[...new Map(s.assignments.filter((x) => POS_ROLES.includes(x.role) && x.outletId).map((x) => [x.outletId, x])).values()].map((x) => (
              <Link key={x.outletId} href={`/karyawan/masuk?outlet=${x.outletId}`} className={`${tombol.garis} w-full !justify-between`}>
                {x.outletNama}
                {a?.outletId === x.outletId && <span className="text-xs text-matur-700">aktif</span>}
              </Link>
            ))}
          </div>
        </Kartu>
      )}
      <div className="lg:max-w-xs">
        <InstallButton />
      </div>
      <form action={logoutAction}>
        <button className={`${tombol.bahaya} w-full lg:w-auto`}>
          <LogOut className="size-4" aria-hidden /> Keluar
        </button>
      </form>
    </div>
  );
}
