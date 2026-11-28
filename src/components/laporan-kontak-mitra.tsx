"use client";
import { useState } from "react";
import Link from "next/link";
import { waKonfirmasiMitra, type KontakMitraLaporan } from "@/lib/laporan-kontak-mitra";
export function LaporanKontakMitra({ kontak, laporan, error, bisaKelola }: {
  kontak: KontakMitraLaporan[];
  laporan: { id: string; nama_outlet: string; periode: string };
  error?: boolean;
  bisaKelola: boolean;
}) {
  const [pilihan, setPilihan] = useState("");
  const penerima = kontak.length === 1 ? kontak[0] : kontak.find((k) => k.id === pilihan);
  const wa = penerima ? waKonfirmasiMitra(penerima, laporan) : null;
  return <div className="w-full space-y-2 border-t border-matur-100 pt-3" aria-label="Kontak mitra laporan">
    <p className="text-sm font-bold text-kopi-900">Konfirmasi laporan ke Mitra</p>
    {error ? <p role="alert" className="text-sm text-red-700">Kontak mitra belum dapat dimuat. Muat ulang untuk mencoba kembali.</p> : <>
      {!kontak.length ? <p className="text-sm text-stone-600">Belum ada mitra yang terhubung dengan outlet laporan ini.</p> : <div className="flex flex-wrap items-center gap-2">
        {kontak.length > 1 ? <label className="flex min-w-0 flex-col gap-1 text-xs text-stone-600">Pilih penerima
          <select aria-label="Pilih mitra penerima laporan" className="max-w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm text-kopi-900" value={pilihan} onChange={(e) => setPilihan(e.target.value)}>
            <option value="">Pilih mitra…</option>{kontak.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
        </label> : <p className="text-sm text-stone-700">{penerima?.nama}</p>}
        {penerima && (wa ? <><span className="text-xs text-stone-500">{penerima.no_hp}</span><a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-800">Hubungi Mitra via WhatsApp</a></> : <p className="text-sm text-amber-800">{penerima.no_hp?.trim() ? "Nomor mitra belum valid untuk WhatsApp." : "Nomor mitra belum diisi."}</p>)}
      </div>}
      {bisaKelola ? <div className="flex flex-wrap gap-3 text-xs"><Link href="/master/mitra" className="underline">Kelola data mitra</Link><Link href="/master/perjanjian" className="underline">Atur hubungan outlet</Link></div> : <p className="text-xs text-stone-500">Untuk perubahan nomor atau hubungan outlet, hubungi Admin Pusat.</p>}
    </>}
    <p className="text-xs text-stone-500">Pesan dibuka untuk diperiksa dan dikirim sendiri. Tidak mengubah status konfirmasi, pembayaran, atau publikasi laporan; penerima tetap mengikuti hak akses laporan.</p>
  </div>;
}
