"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
    case "enum":
      return f.optionLabels?.[String(v)] ?? String(v);
    default:
      return String(v);
  }
}

const TANPA = "Belum terhubung ke outlet";
/** kelompokkan baris per nama kelompok (urut abjad, yang belum terhubung paling akhir) */
function kelompokkan(rows: Row[], kelompok?: Record<string, string>): [string, Row[]][] {
  if (!kelompok) return [["", rows]];
  const g = (r: Row) => kelompok[String(r.id)] ?? TANPA;
  return [...new Set(rows.map(g))]
    .sort((a, b) => (a === TANPA ? 1 : b === TANPA ? -1 : a.localeCompare(b)))
    .map((k) => [k, rows.filter((r) => g(r) === k)]);
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
  kelompok,
  periode,
}: {
  entityKey: string;
  entity: Entity;
  rows: Row[];
  refs: Refs;
  trash: boolean;
  filter?: Record<string, string>;
  canEdit: boolean;
  backHref?: string;
  /** id baris → nama kelompok (mis. outlet); kartu ditampilkan per kelompok */
  kelompok?: Record<string, string>;
  /** filter periode aktif (entitas bertanggal, mis. biaya operasional) */
  periode?: { bulan: string | null; dari: string; sampai: string };
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
  const [urut, setUrut] = useState<{ k: string; naik: boolean } | null>(null);
  const [sel, setSel] = useState<{ id: string; key: string } | null>(null);
  const [undo, setUndo] = useState<{ teks: string; id: string; key: string; lama: string | boolean } | null>(null);
  const tampil = useMemo(() => {
    const xs = kata ? rows.filter((r) => entity.fields.some((f) => show(f, r[f.key], refs).toLowerCase().includes(kata))) : rows;
    if (!urut) return xs;
    const f = entity.fields.find((x) => x.key === urut.k)!;
    const nilai = (r: Row) => (["money", "number", "percent"].includes(f.type) ? Number(r[f.key] ?? 0) : show(f, r[f.key], refs).toLowerCase());
    return [...xs].sort((a, b) => (nilai(a) < nilai(b) ? -1 : nilai(a) > nilai(b) ? 1 : 0) * (urut.naik ? 1 : -1));
  }, [rows, kata, urut, entity.fields, refs]);
  const bisaSel = (f: Field) => canEdit && !trash && f.type !== "image";
  /** simpan satu kolom langsung dari sel tabel (tercatat di log; bisa diurungkan) */
  const simpanSel = (r: Row, f: Field, v: string | boolean) => {
    const lama = toForm(entity, r)[f.key];
    setSel(null);
    if (lama === v) return;
    start(async () => {
      const res = await saveMaster(entityKey, String(r.id), { [f.key]: v }, [f.key]);
      if (res.error) setMsg({ ok: false, text: `${f.label}: ${res.error}` });
      else {
        setMsg(null);
        setUndo({ teks: `${f.label}: ${show(f, r[f.key], refs)} → ${show(f, f.type === "bool" ? v : v || null, refs)}`, id: String(r.id), key: f.key, lama });
        router.refresh();
      }
    });
  };
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);
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

  const simpanBaru = (lagi: boolean) => {
    if (!editing) return;
    const form = editing.form;
    start(async () => {
      const r = await saveMaster(entityKey, null, form);
      if (r.error) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: lagi ? "Tersimpan. Silakan isi data berikutnya." : "Tersimpan dan tercatat di log." });
      // tambah lagi: kolom pilihan (mis. outlet, kategori, tanggal) dipertahankan agar input beruntun cepat
      setEditing(lagi ? { row: null, form: Object.fromEntries(entity.fields.map((f) => [f.key, ["select", "enum", "date", "bool"].includes(f.type) ? form[f.key] : ""])) } : null);
      router.refresh();
    });
  };
  const askSave = () => {
    if (!editing) return;
    if (!editing.row) return simpanBaru(false);
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

      {periode && <PeriodeBar entityKey={entityKey} periode={periode} filter={filter} outletRef={entity.fields.some((f) => f.key === "outlet_id") ? refs.outlet_id : undefined} />}
      {periode && (
        <div className="flex flex-wrap gap-2 text-sm">
          {entity.fields
            .filter((f) => f.type === "money")
            .map((f) => (
              <span key={f.key} className="rounded-xl bg-matur-50 px-3 py-1.5">
                Total {f.label.toLowerCase()} {kata ? "(hasil cari)" : ""}: <b className="tabular-nums">Rp {tampil.reduce((t, r) => t + (Number(r[f.key]) || 0), 0).toLocaleString("id-ID")}</b> · {tampil.length} catatan
              </span>
            ))}
        </div>
      )}
      {canEdit && !trash && !entity.card && rows.length > 0 && <p className="text-xs text-stone-500">💡 Klik sel tabel untuk mengubah langsung (Enter simpan, Tab pindah kolom, Esc batal). Klik judul kolom untuk mengurutkan.</p>}
      {(rows.length > 5 || entity.card || periode) && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={entity.card ? `🔍 Cari nama ${entity.title.toLowerCase()}…` : `🔍 Cari di ${entity.title}…`} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500" />
      )}
      {entity.card ? (
        <div className="space-y-5">
          {tampil.length === 0 && <p className="rounded-2xl border border-matur-200 bg-white px-3 py-8 text-center text-sm text-stone-400">{rows.length ? "Tidak ada yang cocok dengan pencarian." : "Belum ada data."}</p>}
          {kelompokkan(tampil, kelompok).map(([g, daftar]) => (
            <div key={g || "semua"}>
              {g && (
                <div className="mb-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- aset statis */}
                  <img src="/brand/outlet.png" alt="" className="size-8 rounded-lg bg-matur-50" />
                  <h2 className="font-bold text-kopi-900">{g}</h2>
                  <span className="rounded-full bg-matur-100 px-2 text-xs font-semibold text-matur-700">{daftar.length}</span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {daftar.map((r) => {
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
            </div>
          ))}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-2xl border border-matur-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-matur-50 text-left text-kopi-700">
            <tr>
              {cols.map((f) => (
                <th
                  key={f.key}
                  onClick={() => setUrut(urut?.k === f.key ? { k: f.key, naik: !urut.naik } : { k: f.key, naik: true })}
                  className={`sticky top-0 cursor-pointer select-none whitespace-nowrap bg-matur-50 px-3 py-2 font-semibold hover:text-kopi-900 ${f.type === "money" ? "text-right" : ""}`}
                  title="Klik untuk mengurutkan"
                >
                  {f.label}
                  <span className="ml-1 text-[10px] text-stone-400">{urut?.k === f.key ? (urut.naik ? "▲" : "▼") : "↕"}</span>
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
              <tr key={String(r.id)} className="border-t border-stone-100 odd:bg-white even:bg-stone-50/40 hover:bg-matur-50/60">
                {cols.map((f) => (
                  <td
                    key={f.key}
                    onClick={() => bisaSel(f) && !(sel?.id === String(r.id) && sel.key === f.key) && setSel({ id: String(r.id), key: f.key })}
                    title={bisaSel(f) ? "Klik untuk ubah langsung" : undefined}
                    className={`whitespace-nowrap px-3 py-2 ${f.type === "money" ? "text-right tabular-nums" : ""} ${bisaSel(f) ? "cursor-text hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-matur-300" : ""}`}
                  >
                    {sel?.id === String(r.id) && sel.key === f.key ? (
                      <SelEdit
                        f={f}
                        refs={refs}
                        awal={toForm(entity, r)[f.key]}
                        onSimpan={(v) => simpanSel(r, f, v)}
                        onBatal={() => setSel(null)}
                        onTab={(mundur) => {
                          const bisa = cols.filter(bisaSel);
                          const i = bisa.findIndex((x) => x.key === f.key) + (mundur ? -1 : 1);
                          if (bisa[i]) setTimeout(() => setSel({ id: String(r.id), key: bisa[i].key }), 0);
                        }}
                      />
                    ) : f.type === "image" ? (
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
        <Modal title={`${editing.row ? "Ubah" : "Tambah"} ${entity.title}`} onClose={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              askSave();
            }}
          >
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
              {entity.fields.map((f, i) => (
                <Input key={f.key} f={f} refs={refs} autoFocus={i === 0 || undefined} value={editing.form[f.key]} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, [f.key]: v } })} />
              ))}
            </div>
            {msg && !msg.ok && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.text}</p>}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-stone-400">Enter = simpan · Esc = batal</span>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">
                Batal
              </button>
              {!editing.row && (
                <button type="button" disabled={pending} onClick={() => simpanBaru(true)} className="rounded-lg border border-matur-400 px-4 py-2 text-sm font-semibold text-matur-700 disabled:opacity-50">
                  Simpan & tambah lagi
                </button>
              )}
              <button type="submit" disabled={pending} className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {pending ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </form>
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
      {undo && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-xl bg-kopi-900 px-4 py-2.5 text-sm text-white shadow-lg md:bottom-6">
          <span className="truncate">✓ {undo.teks}</span>
          <button
            onClick={() => {
              const u = undo;
              setUndo(null);
              start(async () => {
                const res = await saveMaster(entityKey, u.id, { [u.key]: u.lama }, [u.key]);
                setMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: "Perubahan diurungkan." });
                router.refresh();
              });
            }}
            className="shrink-0 font-semibold text-matur-200 underline"
          >
            Urungkan
          </button>
        </div>
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

const rp = new Intl.NumberFormat("id-ID");
/** tampilan uang saat diketik: 1500000 → 1.500.000 */
const formatUang = (v: string) => {
  const neg = v.trim().startsWith("-");
  const d = v.replace(/[^\d]/g, "");
  return d ? `${neg ? "-" : ""}${rp.format(Number(d))}` : neg ? "-" : "";
};

/** Editor kecil di dalam sel tabel. */
function SelEdit({ f, refs, awal, onSimpan, onBatal, onTab }: { f: Field; refs: Refs; awal: string | boolean; onSimpan: (v: string | boolean) => void; onBatal: () => void; onTab: (mundur: boolean) => void }) {
  const [v, setV] = useState<string | boolean>(f.type === "money" ? formatUang(String(awal)) : awal);
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const selesai = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    if (ref.current && "select" in ref.current && f.type !== "select" && f.type !== "enum") ref.current.select?.();
  }, [f.type]);
  const kirim = (x: string | boolean = v) => {
    if (selesai.current) return;
    selesai.current = true;
    onSimpan(f.type === "money" ? String(x).replace(/[^\d-]/g, "") : x);
  };
  const kunci = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") (e.preventDefault(), kirim());
    else if (e.key === "Escape") ((selesai.current = true), onBatal());
    else if (e.key === "Tab") (e.preventDefault(), kirim(), onTab(e.shiftKey));
  };
  const cls = "w-full min-w-28 rounded-md border border-matur-500 bg-white px-2 py-1 text-sm outline-none ring-2 ring-matur-200";
  if (f.type === "bool")
    return (
      <select ref={ref} value={String(v)} onChange={(e) => kirim(e.target.value === "true")} onBlur={() => kirim()} onKeyDown={kunci} className={cls}>
        <option value="true">Ya</option>
        <option value="false">Tidak</option>
      </select>
    );
  if (f.type === "select" || f.type === "enum")
    return (
      <select ref={ref} value={String(v)} onChange={(e) => kirim(e.target.value)} onBlur={() => kirim()} onKeyDown={kunci} className={cls}>
        <option value="">— pilih —</option>
        {f.type === "select"
          ? refs[f.key]?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))
          : f.options!.map((o) => (
              <option key={o} value={o}>
                {f.optionLabels?.[o] ?? o}
              </option>
            ))}
      </select>
    );
  return (
    <input
      ref={ref}
      value={String(v)}
      type={f.type === "date" ? "date" : "text"}
      inputMode={f.type === "text" || f.type === "date" ? undefined : "decimal"}
      onChange={(e) => setV(f.type === "money" ? formatUang(e.target.value) : e.target.value)}
      onBlur={() => kirim()}
      onKeyDown={kunci}
      className={`${cls} ${f.type === "money" ? "text-right tabular-nums" : ""}`}
    />
  );
}

export function Input({ f, refs, value, onChange, autoFocus }: { f: Field; refs: Refs; value: string | boolean; onChange: (v: string | boolean) => void; autoFocus?: boolean }) {
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
                  {f.optionLabels?.[o] ?? o}
                </option>
              ))}
        </select>
      ) : (
        <div className="relative">
          {f.type === "money" && <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-stone-400">Rp</span>}
          <input
            value={f.type === "money" ? formatUang(String(value)) : String(value)}
            onChange={(e) => onChange(f.type === "money" ? formatUang(e.target.value).replace(/[^\d-]/g, "") : e.target.value)}
            type={f.type === "date" ? "date" : "text"}
            inputMode={f.type === "text" || f.type === "date" ? undefined : "decimal"}
            autoFocus={autoFocus}
            className={`${cls} ${f.type === "money" ? "pl-9 text-right tabular-nums" : ""}`}
          />
        </div>
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

/** Filter per bulan atau rentang tanggal bebas (+ outlet) untuk data bertanggal. */
function PeriodeBar({ entityKey, periode, filter, outletRef }: { entityKey: string; periode: { bulan: string | null; dari: string; sampai: string }; filter: Record<string, string>; outletRef?: { id: string; label: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"bulan" | "rentang">(periode.bulan ? "bulan" : "rentang");
  const [dari, setDari] = useState(periode.dari);
  const [sampai, setSampai] = useState(periode.sampai);
  const buka = (q: Record<string, string>) => router.push(`/master/${entityKey}?${new URLSearchParams({ ...filter, ...q })}`);
  const tanpaOutlet = Object.fromEntries(Object.entries(filter).filter(([k]) => k !== "outlet_id"));
  const pq: Record<string, string> = periode.bulan ? { bulan: periode.bulan } : { dari: periode.dari, sampai: periode.sampai };
  return (
    <section className="flex flex-wrap items-end gap-2 rounded-2xl border border-matur-200 bg-white p-3 text-sm">
      {outletRef && (
        <label className="text-xs font-semibold text-stone-600">
          Outlet
          <select
            value={filter.outlet_id ?? ""}
            onChange={(e) => router.push(`/master/${entityKey}?${new URLSearchParams({ ...tanpaOutlet, ...pq, ...(e.target.value ? { outlet_id: e.target.value } : {}) })}`)}
            className="mt-1 block rounded-lg border px-3 py-2 text-sm font-normal"
          >
            <option value="">Semua outlet</option>
            {outletRef.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex overflow-hidden rounded-lg border">
        {(["bulan", "rentang"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-2 text-xs font-semibold ${mode === m ? "bg-kopi-900 text-white" : "bg-white text-kopi-700"}`}>
            {m === "bulan" ? "Per bulan" : "Rentang tanggal"}
          </button>
        ))}
      </div>
      {mode === "bulan" ? (
        <label className="text-xs font-semibold text-stone-600">
          Bulan
          <input type="month" value={periode.bulan ?? periode.sampai.slice(0, 7)} onChange={(e) => e.target.value && buka({ bulan: e.target.value })} className="mt-1 block rounded-lg border px-3 py-2 text-sm font-normal" />
        </label>
      ) : (
        <>
          <label className="text-xs font-semibold text-stone-600">
            Dari
            <input type="date" value={dari} max={sampai} onChange={(e) => setDari(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Sampai
            <input type="date" value={sampai} min={dari} onChange={(e) => setSampai(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2 text-sm font-normal" />
          </label>
          <button onClick={() => dari && sampai && buka({ dari, sampai })} className="rounded-lg bg-kopi-900 px-4 py-2 text-xs font-semibold text-white">
            Terapkan
          </button>
        </>
      )}
      <span className="ml-auto text-xs text-stone-500">
        Menampilkan {new Date(periode.dari + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} – {new Date(periode.sampai + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
      </span>
    </section>
  );
}
