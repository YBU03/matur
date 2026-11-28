export type InfoStokBahan = {
  jumlah: number | null;
  satuan: string;
  satuanBeli?: string | null;
  konversi?: number | null;
  minimum: number;
  sumberMinimum?: string;
};
export function statusStokTertulis(jumlah: number | null, minimum: number) {
  if (jumlah === null) return "Belum tercatat";
  if (jumlah < 0) return "Negatif · perlu cek";
  if (jumlah === 0) return "Habis di sistem";
  return jumlah <= minimum ? "Stok rendah" : "Di atas batas minimum";
}

export function batasPeringatanStok(master: number, konversi: number, minimumOutlet?: number) {
  if (minimumOutlet !== undefined) return { minimum: minimumOutlet, sumberMinimum: "pengaturan khusus outlet" };
  return master > 0 ? { minimum: master, sumberMinimum: "master bahan" } : { minimum: konversi > 0 ? konversi : 1, sumberMinimum: "batas bawaan satu kemasan" };
}
