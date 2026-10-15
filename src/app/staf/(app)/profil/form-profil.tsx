"use client";

import { useActionState } from "react";
import { masukan, Pesan, tombol } from "@/components/staf/ui";
import { gantiPassword, gantiPin, simpanProfil, type Result } from "@/lib/profil-actions";

export function FormDataDiri({ nama, hp }: { nama: string; hp: string }) {
  const [hasil, aksi, pending] = useActionState<Result, FormData>(simpanProfil, {});
  return (
    <form action={aksi} className="space-y-3">
      <label className="block text-sm font-semibold text-kopi-900">
        Nama lengkap
        <input name="nama" defaultValue={nama} required minLength={2} className={masukan} />
      </label>
      <label className="block text-sm font-semibold text-kopi-900">
        Nomor HP
        <input name="hp" defaultValue={hp} inputMode="tel" className={masukan} />
      </label>
      <Pesan hasil={hasil} />
      <button disabled={pending} className={`${tombol.utama} w-full`}>
        {pending ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}

export function FormGantiKunci({ pin }: { pin: boolean }) {
  const [hasil, aksi, pending] = useActionState<Result, FormData>(pin ? gantiPin : gantiPassword, {});
  const isian = pin ? { type: "password", inputMode: "numeric" as const, pattern: "\\d{4,6}", maxLength: 6 } : { type: "password", minLength: 8 };
  return (
    <form action={aksi} className="space-y-3">
      <label className="block text-sm font-semibold text-kopi-900">
        {pin ? "PIN lama" : "Password lama"}
        <input name="lama" required autoComplete="current-password" className={masukan} {...isian} />
      </label>
      <label className="block text-sm font-semibold text-kopi-900">
        {pin ? "PIN baru" : "Password baru"}
        <input name="baru" required autoComplete="new-password" className={masukan} {...isian} />
      </label>
      <label className="block text-sm font-semibold text-kopi-900">
        Ulangi {pin ? "PIN" : "password"} baru
        <input name="baru2" required autoComplete="new-password" className={masukan} {...isian} />
      </label>
      <Pesan hasil={hasil} />
      <button disabled={pending} className={`${tombol.lembut} w-full`}>
        {pending ? "Memproses…" : pin ? "Ganti PIN" : "Ganti password"}
      </button>
    </form>
  );
}
