"use client";
import Link from "next/link";
import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { simpanDokumenGudang } from "@/lib/gudang-dokumen-actions";
export function PengaturanDokumen({
  alamat,
  versi,
  logo,
  judul,
}: {
  alamat: string;
  versi: number;
  logo: string;
  judul: string[];
}) {
  const [preview, setPreview] = useState(logo),
    [bawaan, setBawaan] = useState(false),
    [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, start] = useTransition(),
    router = useRouter(),
    blob = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (blob.current) URL.revokeObjectURL(blob.current);
    },
    [],
  );
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/gudang/stok" className="text-sm underline">
        ← Stok Gudang
      </Link>
      <h1 className="text-2xl font-bold">Pengaturan Dokumen Gudang</h1>
      <p className="text-sm text-stone-600">
        Logo, alamat, dan judul kotak tanda tangan ini dipakai bersama pada invoice dan surat jalan Gudang,
        termasuk saat diunduh oleh outlet. Unduh ulang PDF setelah menyimpan
        perubahan.
      </p>
      <form
        className="space-y-5 rounded-2xl border bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          start(async () => {
            try {
              const r = await simpanDokumenGudang(form);
              setMsg(r);
              if (r.ok) router.refresh();
            } catch {
              setMsg({
                error: "Belum tersimpan. Periksa koneksi dan coba lagi.",
              });
            }
          });
        }}
      >
        <input type="hidden" name="versi" value={versi} />
        <div>
          <p className="mb-2 font-semibold">Logo perusahaan</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bawaan ? "/brand/hazna-logo.png" : preview}
            alt="Pratinjau logo dokumen Gudang"
            className="h-28 w-36 rounded-lg border bg-white p-2 object-contain"
          />
          <label className="mt-3 block text-sm">
            Upload / ganti logo (PNG atau JPG, maksimal 2 MB)
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg"
              disabled={busy || bawaan}
              className="mt-2 block w-full rounded-lg border p-2"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 2097152) {
                    e.target.value = "";
                    setMsg({ error: "Ukuran logo maksimal 2 MB." });
                    return;
                  }
                  if (blob.current) URL.revokeObjectURL(blob.current);
                  blob.current = URL.createObjectURL(f);
                  setPreview(blob.current);
                  setMsg({});
                } else setPreview(logo);
              }}
            />
          </label>
          <label className="mt-3 flex gap-2 text-sm">
            <input
              type="checkbox"
              name="bawaan"
              checked={bawaan}
              disabled={busy}
              onChange={(e) => setBawaan(e.target.checked)}
            />
            Gunakan kembali logo Hazna bawaan
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Alamat perusahaan
          <textarea
            name="alamat"
            required
            minLength={10}
            maxLength={600}
            rows={4}
            defaultValue={alamat}
            disabled={busy}
            className="mt-2 block w-full rounded-xl border p-3 font-normal"
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="font-semibold">Judul kotak tanda tangan</legend>
          <p className="text-xs text-stone-500">
            Judul default untuk 4 kotak di bawah invoice dan surat jalan. Boleh
            dikosongkan. Saat mencetak, judul, nama, dan tanggal tetap bisa
            diubah lagi khusus untuk cetakan itu.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <label key={i} className="block text-xs text-stone-500">
                Kotak {i + 1}
                <input
                  name={"judul" + i}
                  maxLength={40}
                  defaultValue={judul[i] ?? ""}
                  disabled={busy}
                  className="mt-1 block w-full rounded-xl border p-2.5 text-sm text-kopi-900"
                />
              </label>
            ))}
          </div>
        </fieldset>
        {msg.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {msg.error}
          </p>
        )}
        {msg.ok && (
          <p
            role="status"
            className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
          >
            ✓ {msg.ok}
          </p>
        )}
        <button
          disabled={busy}
          className="rounded-xl bg-matur-500 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Menyimpan pengaturan…" : "Simpan pengaturan"}
        </button>
      </form>
    </div>
  );
}
