export type IsiSo = { kemasan: string; eceran: string };
export type SoAttempt = { requestId: string; tanggal: string; catatan: string; items: { bahan_id: string; qty_fisik: number; qty_sistem: number }[] };
export type SoDraft = {
  version: 2; id: string; outletId: string; tanggal: string; scope: string;
  isi: Record<string, IsiSo>; sistem: Record<string, number>; catatan: string;
  jenis: "awal" | "rutin"; updatedAt: number; attempt?: SoAttempt; completedId?: string;
};
export const hariSo = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
export const kemarinSo = () => new Date(Date.now() + 7 * 3600_000 - 86400_000).toISOString().slice(0, 10);
export function bacaSoDraft(value: unknown, outletId: string): SoDraft | null {
  if (!value || typeof value !== "object") return null;
  const d = value as SoDraft;
  if (d.version !== 2 || d.outletId !== outletId || !/^[a-f0-9-]{36}$/.test(d.id) || !/^\d{4}-\d{2}-\d{2}$/.test(d.tanggal) || !d.isi || !d.sistem || !Number.isFinite(d.updatedAt)) return null;
  if (typeof d.scope !== "string" || !d.scope || typeof d.catatan !== "string" || !["awal","rutin"].includes(d.jenis)) return null;
  if (Object.values(d.isi).some(x => !x || typeof x.kemasan !== "string" || typeof x.eceran !== "string")) return null;
  if (Object.values(d.sistem).some(x => !Number.isFinite(x))) return null;
  if (d.attempt && (!/^[a-f0-9-]{36}$/.test(d.attempt.requestId) || !Array.isArray(d.attempt.items) || typeof d.attempt.catatan !== "string" || d.attempt.tanggal !== d.tanggal || d.attempt.items.some(i => typeof i.bahan_id !== "string" || !Number.isFinite(i.qty_fisik) || !Number.isFinite(i.qty_sistem)))) return null;
  return d;
}
/** Bahan yang berubah harus dihitung ulang, bukan sekadar mengganti stok pembanding. */
export function konflikSo(items: SoAttempt["items"], stok: Record<string, number>) {
  return items.filter(i => Math.abs((stok[i.bahan_id] ?? 0) - i.qty_sistem) > 0.0001).map(i => ({ ...i, qty_terbaru: stok[i.bahan_id] ?? 0 }));
}
