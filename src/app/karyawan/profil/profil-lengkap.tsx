"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { masukan, Pesan, tombol } from "@/components/staf/ui";
import { compressImage } from "@/lib/compress-image";
import { simpanProfilLengkap, type HasilProfil } from "@/lib/profil-actions";

export type ProfilLengkap = {
  foto_url: string | null;
  nik: string | null;
  jenis_kelamin: string | null;
  tempat_lahir: string | null;
  tgl_lahir: string | null;
  alamat_ktp: string | null;
  alamat_domisili: string | null;
  maps_url: string | null;
  no_hp: string | null;
  darurat_nama: string | null;
  darurat_hubungan: string | null;
  darurat_hp: string | null;
};

const label = "block text-sm font-semibold text-kopi-900";
const wajib = <span className="text-red-600"> *</span>;

/** Form profil lengkap karyawan (wajib): foto asli, NIK, TTL, alamat KTP, sharelok rumah, kontak darurat. */
export function FormProfilLengkap({ p }: { p: ProfilLengkap }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(p.foto_url);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [hasil, setHasil] = useState<HasilProfil | null>(null);
  const [busy, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.delete("foto_input");
        if (foto)
          fd.set("foto", new File([foto], "foto.jpg", { type: "image/jpeg" }));
        start(async () => {
          try {
            const r = await simpanProfilLengkap(fd);
            setHasil(r);
            if (!r.error) {
              setFoto(null);
              router.refresh();
            }
          } catch {
            setHasil({ error: "Koneksi terputus. Coba lagi." });
          }
        });
      }}
    >
      <div className="flex items-center gap-4">
        <div className="size-24 shrink-0 overflow-hidden rounded-full bg-matur-100 ring-4 ring-matur-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Foto diri"
              className="size-full object-cover"
            />
          ) : (
            <span className="grid size-full place-items-center text-3xl">
              📷
            </span>
          )}
        </div>
        <label className={`${tombol.lembut} cursor-pointer`}>
          {preview ? "Ganti foto" : "Ambil foto diri"}
          <input
            name="foto_input"
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const b = await compressImage(f, 800, 0.82);
                setFoto(b);
                setPreview(URL.createObjectURL(b));
              } catch {
                setHasil({ error: "Foto tidak bisa dibaca. Coba foto lain." });
              }
            }}
          />
        </label>
      </div>
      <p className="-mt-2 text-xs text-redup">
        Foto wajah asli, jelas, tanpa filter (bukan avatar/kartun).{wajib}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          NIK (sesuai KTP){wajib}
          <input
            name="nik"
            defaultValue={p.nik ?? ""}
            inputMode="numeric"
            maxLength={20}
            placeholder="16 angka"
            className={masukan}
          />
        </label>
        <label className={label}>
          Jenis kelamin{wajib}
          <select
            name="jenis_kelamin"
            defaultValue={p.jenis_kelamin ?? ""}
            className={masukan}
          >
            <option value="">Pilih</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </label>
        <label className={label}>
          Tempat lahir{wajib}
          <input
            name="tempat_lahir"
            defaultValue={p.tempat_lahir ?? ""}
            className={masukan}
          />
        </label>
        <label className={label}>
          Tanggal lahir{wajib}
          <input
            name="tgl_lahir"
            type="date"
            defaultValue={p.tgl_lahir ?? ""}
            className={masukan}
          />
        </label>
        <label className={label}>
          Nomor HP / WhatsApp{wajib}
          <input
            name="no_hp"
            defaultValue={p.no_hp ?? ""}
            inputMode="tel"
            className={masukan}
          />
        </label>
      </div>
      <label className={label}>
        Alamat sesuai KTP{wajib}
        <textarea
          name="alamat_ktp"
          defaultValue={p.alamat_ktp ?? ""}
          rows={2}
          placeholder="Jalan, RT/RW, desa/kelurahan, kecamatan, kabupaten"
          className={masukan}
        />
      </label>
      <label className={label}>
        Alamat tinggal sekarang (bila beda dengan KTP)
        <textarea
          name="alamat_domisili"
          defaultValue={p.alamat_domisili ?? ""}
          rows={2}
          className={masukan}
        />
      </label>
      <label className={label}>
        Sharelok rumah (link Google Maps){wajib}
        <input
          name="maps_url"
          defaultValue={p.maps_url ?? ""}
          inputMode="url"
          placeholder="https://maps.app.goo.gl/…"
          className={masukan}
        />
        <span className="mt-1 block text-xs font-normal text-redup">
          Buka Google Maps → tekan lama titik rumah → <b>Bagikan</b> →{" "}
          <b>Salin link</b>, lalu tempel di sini.
        </span>
      </label>
      <fieldset className="grid gap-3 rounded-2xl border border-garis p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-kopi-900">
          Kontak darurat{wajib}
        </legend>
        <input
          name="darurat_nama"
          defaultValue={p.darurat_nama ?? ""}
          placeholder="Nama"
          className={masukan}
        />
        <input
          name="darurat_hubungan"
          defaultValue={p.darurat_hubungan ?? ""}
          placeholder="Hubungan (ibu, suami…)"
          className={masukan}
        />
        <input
          name="darurat_hp"
          defaultValue={p.darurat_hp ?? ""}
          inputMode="tel"
          placeholder="Nomor HP"
          className={masukan}
        />
      </fieldset>
      <Pesan hasil={hasil} />
      {!!hasil?.kurang?.length && (
        <p className="text-sm text-amber-800">
          Belum lengkap: {hasil.kurang.join(", ")}.
        </p>
      )}
      <button disabled={busy} className={`${tombol.utama} w-full`}>
        {busy ? "Menyimpan…" : "Simpan profil"}
      </button>
    </form>
  );
}
