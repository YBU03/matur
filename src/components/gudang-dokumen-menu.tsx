"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./confirm-edit";
import { aksiEditorGudang } from "@/lib/gudang-editor-actions";
import type { JenisDokumen, DokumenKiriman } from "@/lib/gudang-dokumen-model";
export function MenuDokumen({
  id,
  dokumen = [],
}: {
  id: string;
  dokumen?: DokumenKiriman[];
}) {
  const [open, setOpen] = useState(false),
    [hapus, setHapus] = useState<JenisDokumen | null>(null),
    [msg, setMsg] = useState(""),
    [busy, start] = useTransition(),
    router = useRouter();
  return (
    <div className="relative shrink-0">
      <button
        aria-label="Menu dokumen"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-lg border bg-white px-3 py-2 text-xl"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 z-20 min-w-52 rounded-xl border bg-white p-2 shadow-xl">
          {(["invoice", "surat-jalan"] as const).map((j) => (
            <div key={j} className="border-b p-1 last:border-0">
              <Link
                href={"/gudang/kiriman/" + id + "/dokumen?jenis=" + j}
                className="block rounded-lg px-2 py-2 text-sm hover:bg-amber-50"
              >
                Edit {j === "invoice" ? "Invoice" : "Surat Jalan"}
              </Link>
              <button
                onClick={() => {
                  setHapus(j);
                  setOpen(false);
                  setMsg("");
                }}
                className="w-full rounded-lg px-2 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              >
                Hapus {j === "invoice" ? "Invoice" : "Surat Jalan"}
              </button>
            </div>
          ))}
          <Link
            href="/gudang/dokumen-arsip"
            className="block p-2 text-sm underline"
          >
            Arsip Dokumen
          </Link>
        </div>
      )}
      {!!dokumen.filter((d) => d.arsip_at).length && (
        <p className="mt-1 max-w-28 text-[10px] text-stone-500">
          {dokumen
            .filter((d) => d.arsip_at)
            .map((d) =>
              d.jenis === "invoice"
                ? "Invoice diarsipkan"
                : "Surat jalan diarsipkan",
            )
            .join(" · ")}
        </p>
      )}
      {hapus && (
        <Modal
          title="Yakin ingin menghapus dokumen ini?"
          onClose={busy ? undefined : () => setHapus(null)}
        >
          <p className="text-sm">
            {hapus === "invoice" ? "Invoice" : "Surat Jalan"} dipindahkan ke
            arsip. Riwayat pengiriman, penerimaan, stok dan perhitungan laporan
            tetap tersimpan.
          </p>
          {msg && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {msg}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              disabled={busy}
              onClick={() => setHapus(null)}
              className="rounded-lg border px-4 py-2"
            >
              Batal
            </button>
            <button
              disabled={busy}
              onClick={() =>
                start(async () => {
                  try {
                    const a = await aksiEditorGudang("editor_dokumen_gudang", {
                      id,
                      jenis: hapus,
                      aksi: "arsip",
                      versi: dokumen.find((d) => d.jenis === hapus)?.versi ?? 0,
                    });
                    if (a.error) setMsg(a.error);
                    else {
                      setHapus(null);
                      router.refresh();
                    }
                  } catch {
                    setMsg("Belum dihapus. Periksa koneksi.");
                  }
                })
              }
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white"
            >
              {busy ? "Memproses…" : "Ya, Hapus"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
