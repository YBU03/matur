"use client";

// Edit/tambah/hapus satu baris data master langsung di halaman (tanpa pindah ke Data Master).
// Memakai alur standar: konfirmasi sebelum → sesudah (AKS-05) dan hapus 2 tahap (AKS-06).

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input, show, toForm, type Refs, type Row } from "@/app/(app)/master/[entity]/master-table";
import { ConfirmEditDialog, Modal, type Change } from "@/components/confirm-edit";
import { DeleteTwoStepDialog } from "@/components/delete-two-step";
import { ENTITIES } from "@/lib/master";
import { saveMaster, setDeleted } from "@/lib/master-actions";

type Form = Record<string, string | boolean>;

export function RowEditor({
  entityKey,
  row,
  initial = {},
  fields,
  refs = {},
  label,
  title,
  className = "",
}: {
  entityKey: string;
  row: Row | null;
  initial?: Record<string, string>;
  /** kolom yang ditampilkan (kolom lain tetap disimpan apa adanya) */
  fields?: string[];
  refs?: Refs;
  label?: string;
  title?: string;
  className?: string;
}) {
  const entity = ENTITIES[entityKey];
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState<Change[] | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const shown = entity.fields.filter((f) => !fields || fields.includes(f.key));

  const open = () => {
    setErr("");
    setConfirm(null);
    setForm(toForm(entity, row, initial));
  };
  const close = () => {
    setForm(null);
    setConfirm(null);
  };
  const ask = () => {
    if (!form) return;
    const before = toForm(entity, row, initial);
    setConfirm(
      shown
        .filter((f) => before[f.key] !== form[f.key])
        .map((f) => ({ field: f.label, before: row ? show(f, row[f.key], refs) : "-", after: show(f, f.type === "bool" ? form[f.key] : form[f.key] || null, refs) })),
    );
  };
  const save = () =>
    start(async () => {
      const r = await saveMaster(entityKey, row ? String(row.id) : null, form!, fields);
      if (r.error) {
        setErr(r.error);
        setConfirm(null);
        return;
      }
      close();
      router.refresh();
    });

  return (
    <>
      <button onClick={open} className={className || "rounded-lg px-2 py-1 text-sm text-matur-700 hover:bg-matur-50"} title={row ? "Ubah" : "Tambah"}>
        {label ?? (row ? "✏️ Ubah" : "+ Tambah")}
      </button>
      {form && !confirm && (
        <Modal title={title ?? `${row ? "Ubah" : "Tambah"} ${entity.title}`}>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
            {shown.map((f) => (
              <Input key={f.key} f={f} refs={refs} value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
            ))}
          </div>
          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={close} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button onClick={ask} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white">Simpan</button>
          </div>
        </Modal>
      )}
      {form && confirm && (
        <ConfirmEditDialog changes={confirm} onCancel={() => setConfirm(null)} onConfirm={() => !pending && save()} />
      )}
    </>
  );
}

export function RowDeleter({ entityKey, id, name, className = "" }: { entityKey: string; id: string; name: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [, start] = useTransition();
  return (
    <>
      <button onClick={() => setOpen(true)} className={className || "rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"} title="Hapus">
        🗑
      </button>
      {open && (
        <DeleteTwoStepDialog
          name={name}
          onCancel={() => setOpen(false)}
          onConfirm={() =>
            start(async () => {
              const r = await setDeleted(entityKey, id, true);
              if (r.error) return setErr(r.error);
              setOpen(false);
              router.refresh();
            })
          }
        />
      )}
      {err && <Modal title="Gagal menghapus"><p className="text-sm text-red-700">{err}</p><div className="mt-4 text-right"><button onClick={() => setErr("")} className="rounded-lg border px-4 py-2 text-sm">Tutup</button></div></Modal>}
    </>
  );
}
