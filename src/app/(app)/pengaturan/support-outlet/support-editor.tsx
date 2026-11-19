"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { HeaderHalaman } from "@/components/ui-halaman";
import { Modal } from "@/components/confirm-edit";
import { tanya } from "@/components/dialog-tanya";
import { SupportOutletCards } from "@/components/support-outlet-cards";
import {
  nomorSupport,
  tampilNomorSupport,
  type KontakSupport,
} from "@/lib/support-outlet";
import { simpanSupport, hapusSupport } from "@/lib/support-outlet-actions";

type Draft = Omit<KontakSupport, "updated_at"> & { versi: string | null };
export function SupportEditor({ rows }: { rows: KontakSupport[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const edit = (row?: KontakSupport) => {
    setError("");
    setMessage("");
    setDraft(
      row
        ? { ...row, versi: row.updated_at, nomor: "+" + row.nomor }
        : {
            id: crypto.randomUUID(),
            bagian: "",
            nama: "",
            nomor: "",
            aktif: true,
            urutan: Math.min(
              9999,
              Math.max(0, ...rows.map((r) => r.urutan)) + 10,
            ),
            versi: null,
          },
    );
  };
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!draft || busy) return;
    if (!nomorSupport(draft.nomor)) {
      setError(
        "Nomor tidak valid. Contoh: 085135990588 atau +62 851-3599-0588.",
      );
      return;
    }
    setError("");
    start(async () => {
      try {
        const r = await simpanSupport(draft);
        if (r.error) {
          setError(r.error);
          return;
        }
        setDraft(null);
        setMessage(
          "Kontak tersimpan. Daftar Support Outlet Mitra sudah diperbarui.",
        );
        router.refresh();
      } catch {
        setError("Koneksi terputus. Muat ulang daftar sebelum mencoba lagi.");
      }
    });
  };
  const remove = async (row: KontakSupport) => {
    if (
      !(await tanya(
        `Hapus kontak ${row.bagian} (${row.nama}) dari Support Outlet?`,
        { judul: "Hapus kontak support", bahaya: true },
      ))
    )
      return;
    setError("");
    setMessage("");
    start(async () => {
      try {
        const r = await hapusSupport(row.id, row.updated_at);
        if (r.error) {
          setError(r.error);
          return;
        }
        setMessage("Kontak dihapus dari daftar Mitra.");
        router.refresh();
      } catch {
        setError("Koneksi terputus. Muat ulang daftar sebelum mencoba lagi.");
      }
    });
  };
  const field =
    "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";
  return (
    <div className="space-y-5">
      <HeaderHalaman
        judul="Kelola Support Outlet"
        ikon="☎️"
        keterangan="Kontak bantuan untuk seluruh Mitra. Tambah atau ubah kontak di sini; perubahan berlaku saat halaman Mitra dimuat ulang."
      >
        <button
          disabled={busy}
          onClick={() => edit()}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-matur-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          <Plus size={18} />
          Tambah kontak
        </button>
      </HeaderHalaman>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}
      {error && !draft && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          {rows.filter((k) => k.aktif).length} aktif ·{" "}
          {rows.filter((k) => !k.aktif).length} nonaktif. Urutan terkecil tampil
          lebih dahulu.
        </p>
        <button
          onClick={() => setPreview((v) => !v)}
          className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
        >
          <Eye size={17} />
          {preview ? "Tutup pratinjau" : "Pratinjau Mitra"}
        </button>
      </div>
      {preview && <SupportOutletCards rows={rows.filter((k) => k.aktif)} />}
      <div className="space-y-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-matur-100 bg-white p-4 shadow-sm"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-matur-50 text-sm font-bold text-matur-700">
              {row.urutan}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-kopi-900">
                {row.bagian}{" "}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs ${row.aktif ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}
                >
                  {row.aktif ? "Aktif" : "Nonaktif"}
                </span>
              </h2>
              <p className="break-words text-sm text-stone-500">
                {row.nama} · {tampilNomorSupport(row.nomor)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => edit(row)}
                aria-label={`Edit kontak ${row.bagian}`}
                className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm disabled:opacity-50"
              >
                <Pencil size={16} />
                Edit
              </button>
              <button
                disabled={busy}
                onClick={() => remove(row)}
                aria-label={`Hapus kontak ${row.bagian}`}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-red-100 px-3 text-sm text-red-600 disabled:opacity-50"
              >
                <Trash2 size={16} />
                Hapus
              </button>
            </div>
          </article>
        ))}
        {!rows.length && (
          <p className="rounded-xl border border-dashed p-8 text-center text-stone-500">
            Belum ada kontak. Tambahkan kontak pertama.
          </p>
        )}
      </div>
      <Link
        href="/log"
        className="inline-block text-sm font-semibold text-matur-700 underline"
      >
        Lihat riwayat perubahan di Log Aktivitas
      </Link>
      {draft && (
        <Modal
          title={draft.versi ? "Edit kontak support" : "Tambah kontak support"}
          onClose={busy ? undefined : () => setDraft(null)}
          scrollable
        >
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
              <label className="block space-y-1 text-sm font-semibold">
                Bagian
                <input
                  required
                  maxLength={80}
                  value={draft.bagian}
                  onChange={(e) =>
                    setDraft({ ...draft, bagian: e.target.value })
                  }
                  className={field}
                  placeholder="Contoh: Warehouse"
                />
              </label>
              <label className="block space-y-1 text-sm font-semibold">
                Nama petugas
                <input
                  required
                  maxLength={120}
                  value={draft.nama}
                  onChange={(e) => setDraft({ ...draft, nama: e.target.value })}
                  className={field}
                  placeholder="Contoh: Isma"
                />
              </label>
              <label className="block space-y-1 text-sm font-semibold">
                Nomor WhatsApp / telepon
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  maxLength={40}
                  value={draft.nomor}
                  onChange={(e) =>
                    setDraft({ ...draft, nomor: e.target.value })
                  }
                  className={field}
                  placeholder="08… atau +62…"
                />
              </label>
              <label className="block space-y-1 text-sm font-semibold">
                Urutan tampil
                <input
                  required
                  type="number"
                  min={0}
                  max={9999}
                  step={1}
                  value={draft.urutan}
                  onChange={(e) =>
                    setDraft({ ...draft, urutan: Number(e.target.value) })
                  }
                  className={field}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.aktif}
                  onChange={(e) =>
                    setDraft({ ...draft, aktif: e.target.checked })
                  }
                  className="size-4"
                />
                Aktif · tampil di dashboard Mitra
              </label>
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDraft(null)}
                className="min-h-11 rounded-xl border px-4"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded-xl bg-matur-600 px-5 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Menyimpan…" : "Simpan kontak"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
