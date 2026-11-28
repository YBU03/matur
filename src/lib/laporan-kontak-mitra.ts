import { nomorSupport } from "./support-outlet";
import { namaBulan } from "./laporan";
export type KontakMitraLaporan = { id: string; nama: string; no_hp: string | null };
export function waKonfirmasiMitra(k: KontakMitraLaporan, l: { id: string; nama_outlet: string; periode: string }) {
  const nomor = nomorSupport(k.no_hp ?? "");
  if (!nomor) return null;
  const laporan = `https://matoer.id/laporan/${encodeURIComponent(l.id)}`;
  const pesan = `Halo ${k.nama}, kami dari Akunting Matoer ingin mengonfirmasi laporan keuangan ${l.nama_outlet} periode ${namaBulan(l.periode)}.\nSilakan periksa laporan berikut: ${laporan}\nApakah ada pertanyaan atau bagian yang perlu kita bahas?`;
  return `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`;
}
