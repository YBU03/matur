"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmEditDialog, Modal, type Change } from "@/components/confirm-edit";
import { DeleteTwoStepDialog } from "@/components/delete-two-step";
import type { Entity, Field } from "@/lib/master";
import { saveMaster, setDeleted, uploadFotoMenu } from "@/lib/master-actions";
import { compressImage } from "@/lib/compress-image";
import { formatRupiah, formatTanggal } from "@/lib/format";

export type Row = Record<string, unknown>;
export type Refs = Record<string, { id: string; label: string }[]>;
type Form = Record<string, string | boolean>;

export function show(f: Field, v: unknown, refs: Refs): string {
  if (v === null || v === undefined || v === "") return "-";
  switch (f.type) {
    case "money":
      return formatRupiah(Number(v));
    case "percent":
      return `${Number(v)}%`;
    case "bool":
      return v ? "Ya" : "Tidak";
    case "date":
      return formatTanggal(String(v));
    case "select":
      return refs[f.key]?.find((o) => o.id === v)?.label ?? "-";
    default:
      return String(v);
  }
}

export const toForm = (entity: Entity, row: Row | null, initial: Record<string, string> = {}): Form =>
  Object.fromEntries(
    entity.fields.map((f) => [
      f.key,
      f.type === "bool" ? Boolean(row?.[f.key] ?? f.key === "aktif") : String(row?.[f.key] ?? (row ? "" : (initial[f.key] ?? ""))),
    ]),
  );

export function MasterTable({
  entityKey,
  entity,
  rows,
  refs,
  trash,
  filter = {},
  canEdit,
  backHref,
}: {
  entityKey: string;
  entity: Entity;
  rows: Row[];
  refs: Refs;
  trash: boolean;
  filter?: Record<string, string>;
  canEdit: boolean;
  backHref?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ row: Row | null; form: Form } | null>(null);
  const [confirm, setConfirm] = useState<Change[] | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const cols = entity.fields.filter((f) => f.list !== false);
  const [q, setQ] = useState("");
  const kata = q.trim().toLowerCase();
  const tampil = kata ? rows.filter((r) => entity.fields.some((f) => show(f, r[f.key], refs).toLowerCase().includes(kata))) : rows;
  const nameField = entity.fields.find((f) => f.key === entity.nameKey)!;

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: ok });
      if (!r.error) {
        setEditing(null);
        setConfirm(null);
        setDeleting(null);
        router.refresh();
      }
    });

  const askSave = () => {
    if (!editing) return;
    const before = toForm(entity, editing.row);
    const changes = entity.fields
      .filter((f) => before[f.key] !== editing.form[f.key])
      .map((f) => ({
        field: f.label,
        before: editing.row ? show(f, editing.row[f.key], refs) : "-",
        after: show(f, f.type === "bool" ? editing.form[f.key] : editing.form[f.key] || null, refs),
      }));
    setConfirm(changes);
  };

  return (
    <div className="space-y-4">
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-1 rounded-xl border border-matur-300 bg-white px-3 py-1.5 text-sm font-semibold text-matur-700">
          ← Kembali ke proyek
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">
          {entity.title}
          {trash && <span className="ml-2 text-base font-normal text-stone-500">· Tempat Sampah</span>}
        </h1>
        <Link
          href={`/master/${entityKey}?${new URLSearchParams({ ...filter, ...(trash ? {} : { sampah: "1" }) })}`}
          className="rounded-xl border border-matur-300 px-3 py-2 text-sm hover:bg-matur-50"
        >
          {trash ? "← Kembali" : "Tempat Sampah"}
        </Link>
        {canEdit && !trash && (
          <button
            onClick={() => setEditing({ row: null, form: toForm(entity, null, filter) })}
            className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white hover:bg-matur-600"
          >
            + Tambah
          </button>
        )}
      </div>
      {trash && <p className="text-sm text-stone-500">Data di sini bisa dipulihkan selama 30 hari sejak dihapus.</p>}
      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      {(rows.length > 5 || entity.card) && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={entity.card ? `🔍 Cari nama ${entity.title.toLowerCase()}…` : `🔍 Cari di ${entity.title}…`} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500" />
      )}
      {entity.card ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tampil.length === 0 && <p className="col-span-full rounded-2xl border border-matur-200 bg-white px-3 py-8 text-center text-sm text-stone-400">{rows.length ? "Tidak ada yang cocok dengan pencarian." : "Belum ada data."}</p>}
          {tampil.map((r) => {
            const status = String(r.status ?? "");
            return (
              <div key={String(r.id)} className="flex gap-3 rounded-2xl border border-matur-200 bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element -- aset statis */}
                <img src={entity.card} alt="" className="size-20 shrink-0 rounded-xl bg-matur-50 object-contain p-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate font-bold text-kopi-900">{String(r[entity.nameKey] ?? "-")}</p>
                    {status && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${["operasional", "aktif"].includes(status) ? "bg-green-100 text-green-800" : status === "pembangunan" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>{status}</span>
                    )}
                  </div>
                  <dl className="mt-1 space-y-0.5 text-xs">
                    {cols
                      .filter((f) => f.key !== entity.nameKey && f.key !== "status" && show(f, r[f.key], refs) !== "-")
                      .map((f) => (
                        <div key={f.key} className="flex gap-1">
                          <dt className="shrink-0 text-stone-500">{f.label}:</dt>
                          <dd className="truncate text-stone-800">{show(f, r[f.key], refs)}</dd>
                        </div>
                      ))}
                  </dl>
                  {canEdit && (
                    <div className="mt-2 flex gap-3 text-xs font-semibold">
                      {trash ? (
                        <button disabled={pending} onClick={() => run(() => setDeleted(entityKey, String(r.id), false), "Data dipulihkan.")} className="text-matur-700 hover:underline">
                          Pulihkan
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setEditing({ row: r, form: toForm(entity, r) })} className="text-matur-700 hover:underline">
                            Ubah
                          </button>
                          <button onClick={() => setDeleting(r)} className="text-red-600 hover:underline">
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-2xl border border-matur-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-matur-50 text-left text-kopi-700">
            <tr>
              {cols.map((f) => (
                <th key={f.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {f.label}
                </th>
              ))}
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {tampil.length === 0 && (
              <tr>
                <td colSpan={cols.length + 1} className="px-3 py-8 text-center text-stone-400">
                  {rows.length ? "Tidak ada yang cocok dengan pencarian." : "Belum ada data."}
                </td>
              </tr>
            )}
            {tampil.map((r) => (
              <tr key={String(r.id)} className="border-t border-stone-100">
                {cols.map((f) => (
                  <td key={f.key} className={`whitespace-nowrap px-3 py-2 ${f.type === "money" ? "text-right tabular-nums" : ""}`}>
                    {f.type === "image" ? (
                      r[f.key] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- foto dari aset/Storage
                        <img src={String(r[f.key])} alt="" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <span className="text-stone-300">—</span>
                      )
                    ) : (
                      show(f, r[f.key], refs)
                    )}
                  </td>
                ))}
                {canEdit && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {trash ? (
                      <button
                        disabled={pending}
                        onClick={() => run(() => setDeleted(entityKey, String(r.id), false), "Data dipulihkan.")}
                        className="text-matur-700 hover:underline"
                      >
                        Pulihkan
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setEditing({ row: r, form: toForm(entity, r) })} className="mr-3 text-matur-700 hover:underline">
                          Ubah
                        </button>
                        <button onClick={() => setDeleting(r)} className="text-red-600 hover:underline">
                          Hapus
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {editing && !confirm && (
        <Modal title={`${editing.row ? "Ubah" : "Tambah"} ${entity.title}`}>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
            {entity.fields.map((f) => (
              <Input key={f.key} f={f} refs={refs} value={editing.form[f.key]} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, [f.key]: v } })} />
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">
              Batal
            </button>
            <button onClick={askSave} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white">
              Simpan
            </button>
          </div>
        </Modal>
      )}
      {editing && confirm && (
        <ConfirmEditDialog
          changes={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            run(() => saveMaster(entityKey, editing.row ? String(editing.row.id) : null, editing.form), "Tersimpan dan tercatat di log.")
          }
        />
      )}
      {deleting && (
        <DeleteTwoStepDialog
          name={`${entity.title} ${show(nameField, deleting[entity.nameKey], refs)}`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => run(() => setDeleted(entityKey, String(deleting.id), true), "Dipindahkan ke tempat sampah.")}
        />
      )}
    </div>
  );
}

export function Input({ f, refs, value, onChange }: { f: Field; refs: Refs; value: string | boolean; onChange: (v: string | boolean) => void }) {
  const cls = "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-matur-500";
  if (f.type === "image") return <ImageInput label={f.label} value={String(value)} onChange={onChange} />;
  if (f.type === "bool")
    return (
      <label className="flex items-center gap-2 self-end py-2 text-sm font-medium">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-matur-500" />
        {f.label}
      </label>
    );
  return (
    <label className="block text-sm font-medium">
      {f.label}
      {f.required && <span className="text-red-500"> *</span>}
      {f.type === "select" || f.type === "enum" ? (
        <select value={String(value)} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="">— pilih —</option>
          {f.type === "select"
            ? refs[f.key]?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))
            : f.options!.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
        </select>
      ) : (
        <input
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          type={f.type === "date" ? "date" : "text"}
          inputMode={f.type === "text" || f.type === "date" ? undefined : "decimal"}
          className={cls}
        />
      )}
    </label>
  );
}

function ImageInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("foto", new File([await compressImage(file, 600, 0.82)], "foto.jpg", { type: "image/jpeg" }));
      const r = await uploadFotoMenu(fd);
      if (r.error) setErr(r.error);
      else onChange(r.url!);
    } catch {
      setErr("Gagal memproses foto.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3 sm:col-span-2">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element -- pratinjau foto
        <img src={value} alt="" className="size-20 rounded-xl object-cover" />
      ) : (
        <div className="grid size-20 place-items-center rounded-xl bg-stone-100 text-xs text-stone-400">Belum ada</div>
      )}
      <div className="text-sm">
        <p className="font-medium">{label}</p>
        <label className="mt-1 inline-block cursor-pointer rounded-lg border border-matur-400 px-3 py-1.5 text-matur-700">
          {busy ? "Mengunggah…" : value ? "Ganti foto" : "Pilih foto"}
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {value && <button type="button" onClick={() => onChange("")} className="ml-2 text-xs text-red-600">Hapus</button>}
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </div>
    </div>
  );
}
