"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aksiEditorGudang } from "@/lib/gudang-editor-actions";
import { Modal } from "@/components/confirm-edit";
type Outlet = {
  id: string;
  nama: string;
  alamat: string | null;
  telepon: string | null;
  profil_versi: number;
  status: string;
};
export function OutletGudang({ rows }: { rows: Outlet[] }) {
  const [edit, setEdit] = useState<Partial<Outlet> | null>(null),
    [query, setQuery] = useState(""),
    [busy, start] = useTransition(),
    [msg, setMsg] = useState(""),
    router = useRouter();
  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <Link href="/gudang/kiriman" className="text-sm underline">
        ← Kiriman Gudang
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Kontak Outlet</h1>
        <button
          onClick={() => {
            setEdit({ nama: "", alamat: "", telepon: "" });
            setMsg("");
          }}
          className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white"
        >
          + Tambah Outlet
        </button>
      </div>
      <p className="text-sm text-stone-600">
        Kontak dipakai pada dokumen baru. Identitas dokumen yang sudah tersimpan
        tidak berubah otomatis. Outlet baru dibuat dengan status pembangunan;
        akses POS dikelola terpisah.
      </p>
      <input
        aria-label="Cari outlet"
        placeholder="Cari outlet…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl border p-3"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {rows
          .filter((r) => r.nama.toLowerCase().includes(query.toLowerCase()))
          .map((r) => (
            <section key={r.id} className="rounded-xl border bg-white p-4">
              <div className="flex justify-between gap-2">
                <h2 className="font-bold">{r.nama}</h2>
                <button
                  onClick={() => {
                    setEdit(r);
                    setMsg("");
                  }}
                  className="text-sm underline"
                >
                  Edit
                </button>
              </div>
              <p className="mt-2 text-sm">{r.alamat || "Alamat belum diisi"}</p>
              <p className="mt-1 text-sm">Telp: {r.telepon || "Belum diisi"}</p>
              <p className="text-xs text-stone-500">{r.status}</p>
            </section>
          ))}
      </div>
      {edit && (
        <Modal
          title={edit.id ? "Edit Kontak Outlet" : "Tambah Outlet"}
          onClose={busy ? undefined : () => setEdit(null)}
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                try {
                  const a = await aksiEditorGudang("outlet_dokumen_gudang", {
                    id: edit.id ?? null,
                    nama: edit.nama,
                    alamat: edit.alamat,
                    telepon: edit.telepon,
                    versi: edit.profil_versi ?? 0,
                  });
                  if (a.error) setMsg(a.error);
                  else {
                    setEdit(null);
                    setMsg("Data outlet tersimpan.");
                    router.refresh();
                  }
                } catch {
                  setMsg("Belum tersimpan. Periksa koneksi.");
                }
              });
            }}
          >
            {(["nama", "alamat", "telepon"] as const).map((key) => (
              <label key={key} className="block text-sm font-semibold">
                {key === "nama"
                  ? "Nama outlet"
                  : key === "alamat"
                    ? "Alamat outlet"
                    : "Nomor telepon outlet"}
                {key === "alamat" ? (
                  <textarea
                    value={edit[key] ?? ""}
                    onChange={(e) =>
                      setEdit({ ...edit, [key]: e.target.value })
                    }
                    maxLength={600}
                    className="mt-1 block w-full rounded-lg border p-2"
                  />
                ) : (
                  <input
                    type={key === "telepon" ? "tel" : "text"}
                    required={key === "nama"}
                    minLength={key === "nama" ? 2 : undefined}
                    maxLength={key === "nama" ? 150 : 40}
                    value={edit[key] ?? ""}
                    onChange={(e) =>
                      setEdit({ ...edit, [key]: e.target.value })
                    }
                    className="mt-1 block w-full rounded-lg border p-2"
                  />
                )}
              </label>
            ))}
            {msg && (
              <p role="alert" className="text-sm text-red-700">
                {msg}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEdit(null)}
                className="rounded-lg border px-3 py-2"
              >
                Batal
              </button>
              <button
                disabled={busy}
                className="rounded-lg bg-orange-500 px-4 py-2 text-white"
              >
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {!edit && msg && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm">
          {msg}
        </p>
      )}
    </main>
  );
}
