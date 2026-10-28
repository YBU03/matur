"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aksiEditorGudang } from "@/lib/gudang-editor-actions";
export function ArsipDokumen({
  rows,
}: {
  rows: {
    kiriman_id: string;
    jenis: string;
    versi: number;
    arsip_at: string;
    kiriman: { nomor: string; outlet: { nama: string } | null } | null;
  }[];
}) {
  const [msg, setMsg] = useState(""),
    [busy, start] = useTransition(),
    router = useRouter();
  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <Link href="/gudang/kiriman" className="underline">
        ← Riwayat Kiriman
      </Link>
      <h1 className="text-2xl font-bold">Arsip Dokumen</h1>
      <p className="text-sm text-stone-600">
        Penghapusan dokumen tidak menghapus transaksi atau stok. Pulihkan untuk
        mengedit dan mencetak kembali.
      </p>
      {!rows.length && <p>Belum ada dokumen diarsipkan.</p>}
      {rows.map((r) => (
        <section
          key={r.kiriman_id + r.jenis}
          className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4"
        >
          <div>
            <h2 className="font-bold">
              {r.jenis} · {r.kiriman?.nomor}
            </h2>
            <p className="text-sm">{r.kiriman?.outlet?.nama}</p>
            <p className="text-xs text-stone-500">
              {new Date(r.arsip_at).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}
            </p>
          </div>
          <button
            disabled={busy}
            onClick={() =>
              start(async () => {
                try {
                  const a = await aksiEditorGudang("editor_dokumen_gudang", {
                    id: r.kiriman_id,
                    jenis: r.jenis,
                    aksi: "pulihkan",
                    versi: r.versi,
                  });
                  setMsg(a.error ?? "Dokumen dipulihkan.");
                  if (!a.error) router.refresh();
                } catch {
                  setMsg("Belum dipulihkan.");
                }
              })
            }
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Pulihkan
          </button>
        </section>
      ))}
      {msg && <p role="status">{msg}</p>}
    </main>
  );
}
