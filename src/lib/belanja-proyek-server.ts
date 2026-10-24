import "server-only";
import { supabaseServer } from "./supabase/server";
import type { Belanja } from "./belanja-proyek";

export async function loadBelanjaProyek(proyekId?: string): Promise<Belanja[]> {
  const db = await supabaseServer();
  let q = db.from("belanja_proyek").select("id,proyek_id,tanggal,toko,nomor_nota,penanggung_jawab,catatan,nota_path,total,nota_dp,nama_pencatat,updated_at,batal_at,alasan_batal,items:belanja_proyek_item(id,belanja_id,item_rab_id,nama,kategori,satuan,qty,harga_satuan,jumlah,urutan),pembayaran:belanja_proyek_bayar(id,belanja_id,tanggal,jumlah,sumber,metode,catatan,nama_pencatat,batal_at,alasan_batal,nama_pembatal)").order("tanggal", { ascending: false }).order("created_at", { ascending: false }).order("id");
  if (proyekId) q = q.eq("proyek_id", proyekId);
  const rows: Belanja[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await q.range(from, from + 499);
    if (error) throw new Error("Realisasi belanja belum dapat dimuat. Coba lagi.");
    rows.push(...((data ?? []) as unknown as Belanja[]));
    if ((data?.length ?? 0) < 500) break;
  }
  for (const b of rows) {
    b.total = Number(b.total);
    b.items = b.items.map((i) => ({ ...i, qty: Number(i.qty), harga_satuan: Number(i.harga_satuan), jumlah: Number(i.jumlah) })).sort((a, c) => a.urutan - c.urutan);
    b.pembayaran = b.pembayaran.map((p) => ({ ...p, jumlah: Number(p.jumlah) })).sort((a, c) => a.tanggal.localeCompare(c.tanggal));
  }
  if (proyekId) {
    const paths = rows.filter((b) => b.nota_path);
    if (paths.length) {
      const { data: urls } = await db.storage.from("proyek").createSignedUrls(paths.map((b) => b.nota_path!), 600);
      paths.forEach((b, i) => { b.nota_url = urls?.[i]?.signedUrl ?? undefined; });
    }
  }
  return rows;
}
