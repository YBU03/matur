import Link from "next/link";
import { LogOut } from "lucide-react";
import { InstallButton } from "@/components/install-button";
import { Avatar, Kartu, KepalaKartu, tombol } from "@/components/staf/ui";
import { stafLogoutAction } from "@/lib/actions";
import { ROLES } from "@/lib/roles";
import { sesiStaf } from "@/lib/staf";
import { supabaseServer } from "@/lib/supabase/server";
import { FormDataDiri, FormGantiKunci } from "./form-profil";

export default async function ProfilStaf() {
  const { s, a } = await sesiStaf();
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
            {ROLES[a.role].label} · {a.outletNama}
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
      {s.assignments.length > 1 && (
        <Kartu>
          <KepalaKartu judul="Tempat bertugas" />
          <ul className="space-y-1 text-sm">
            {s.assignments.map((a) => (
              <li key={`${a.role}-${a.outletId}`} className="text-kopi-900">
                {ROLES[a.role].label} · <span className="text-redup">{a.outletNama}</span>
              </li>
            ))}
          </ul>
          <Link href="/staf/pilih" className={`${tombol.garis} mt-3`}>
            Ganti outlet
          </Link>
        </Kartu>
      )}
      <div className="lg:max-w-xs">
        <InstallButton />
      </div>
      <form action={stafLogoutAction}>
        <button className={`${tombol.bahaya} w-full lg:w-auto`}>
          <LogOut className="size-4" aria-hidden /> Keluar
        </button>
      </form>
    </div>
  );
}
