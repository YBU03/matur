"use server";

// Impor file Excel Ruma: sheet "Transaksi" → Catatan Harian, sheet "Laporan Keuangan" → Laporan Keuangan bulanan.
import { revalidatePath } from "next/cache";
import { KANAL_HARIAN, type KanalHarian } from "./harian";
import { terbitkanLaporan } from "./laporan-actions";
import { kategoriUntuk, type HariImpor, type LaporanImpor } from "./ruma-excel";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };
const KANAL_OK = new Set<string>([...KANAL_HARIAN, "diskon"]);
const PUSAT = /sewa|gaji/i;

async function bolehAkunting() {
  const r = (await getSession())?.active?.role;
  return !!r && ["owner", "admin_pusat", "finance"].includes(r);
}

export async function imporHarian(outletId: string, bulan: string, hari: HariImpor[], ganti: boolean): Promise<Result> {
  if (!(await bolehAkunting())) return { error: "Hanya Owner / Admin Pusat / Akunting." };
  if (!/^\d{4}-\d{2}$/.test(bulan)) return { error: "Bulan tidak valid." };
  const dalam = hari.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.tanggal) && h.tanggal.startsWith(bulan));
  if (!dalam.length) return { error: `Tidak ada tanggal bulan ${bulan} di file ini.` };
  const supabase = await supabaseServer();
  const { data: kat } = await supabase.from("kategori_biaya").select("id, nama");
  const kategori = kat ?? [];
  const akhir = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const id = crypto.randomUUID();
  const kini = new Date().toISOString();

  if (ganti) {
    for (const t of ["penjualan_manual", "biaya_outlet"]) {
      const { error } = await supabase.from(t).update({ deleted_at: kini }).eq("outlet_id", outletId).eq("mode", "asli").gte("tanggal", `${bulan}-01`).lte("tanggal", akhir).not("impor_id", "is", null).is("deleted_at", null);
      if (error) return { error: error.message };
    }
  }
  const jual = dalam.flatMap((h) =>
    Object.entries(h.jual)
      .filter(([k, v]) => KANAL_OK.has(k) && Number(v))
      .map(([k, v]) => ({ outlet_id: outletId, tanggal: h.tanggal, kanal: k as KanalHarian, jenis: "platform", jumlah: Math.round(Number(v)), keterangan: "Impor Excel", impor_id: id })),
  );
  const biaya = dalam.flatMap((h) =>
    h.biaya
      .filter((b) => Number(b.jumlah) > 0)
      .map((b) => {
        const k = kategoriUntuk(b.kolom, kategori);
        return k ? { outlet_id: outletId, tanggal: h.tanggal, kategori_id: k.id, jumlah: Math.round(Number(b.jumlah)), keterangan: String(b.keterangan).slice(0, 200), sumber: PUSAT.test(b.kolom) ? "pusat" : "laci", impor_id: id } : null;
      })
      .filter((x) => x !== null),
  );
  for (let i = 0; i < jual.length; i += 500) {
    const { error } = await supabase.from("penjualan_manual").insert(jual.slice(i, i + 500));
    if (error) return { error: "Gagal menyimpan penjualan: " + error.message };
  }
  for (let i = 0; i < biaya.length; i += 500) {
    const { error } = await supabase.from("biaya_outlet").insert(biaya.slice(i, i + 500));
    if (error) return { error: "Gagal menyimpan pengeluaran: " + error.message };
  }
  for (const p of ["/catatan-harian", "/laporan/proyeksi", "/master/biaya_outlet", "/persediaan", "/laporan-pos"]) revalidatePath(p);
  const lewat = hari.length - dalam.length;
  return { ok: `Impor selesai: ${dalam.length} tanggal, ${jual.length} angka penjualan, ${biaya.length} pengeluaran.${lewat ? ` ${lewat} tanggal di luar bulan ${bulan} dilewati (cek salah ketik tanggal di Excel).` : ""}` };
}

export async function imporLaporan(outletId: string, l: LaporanImpor, ganti: boolean): Promise<Result & { id?: string }> {
  if (!(await bolehAkunting())) return { error: "Hanya Owner / Admin Pusat / Akunting." };
  if (!l.periode) return { error: 'Periode laporan tidak terbaca (baris "Periode Laporan : Per <Bulan> <Tahun>").' };
  const r = await terbitkanLaporan(
    {
      outlet_id: outletId,
      periode: `${l.periode}-01`,
      nama_outlet: l.nama_outlet ?? "Outlet",
      mitra: l.mitra,
      pj_laporan: l.pj_laporan,
      karyawan: l.karyawan,
      modal_awal: l.modal_awal,
      persediaan_awal: l.persediaan_awal,
      pembelian: l.pembelian,
      tagihan_titipan: l.tagihan_titipan,
      persediaan_akhir: l.persediaan_akhir,
      pendapatan: l.pendapatan,
      diskon: l.diskon,
      persen_sedekah: l.persen_sedekah,
      sedekah: l.sedekah,
      beban: l.beban,
      bagi_hasil: l.bagi_hasil,
      transfer: l.transfer,
      tgl_terbit: l.tgl_terbit ?? "",
      penandatangan: l.penandatangan,
      jabatan_penandatangan: l.jabatan_penandatangan,
      catatan: "Diimpor dari file Excel laporan keuangan.",
    },
    ganti,
  );
  if (r.error) return { error: r.error };
  revalidatePath("/laporan");
  revalidatePath("/dashboard");
  return { ok: "Laporan keuangan diimpor.", id: r.id };
}
